import type { AiPicksRunResult, AiPicksRunGlobalSummary } from "@/lib/ai/ai-picks-run-service";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import {
  getTeamThemeCompositionTarget,
  type TeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";
import type { Player } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  resolveTransferBuyAffordabilityCash,
} from "@/lib/market/transfermarkt-local-service";
import type { PersistenceService } from "@/lib/persistence/types";

import { draftTeamRoster } from "./draft-team-roster";
import type { CleanDraftPick, CleanThemeTarget } from "./types";

export const CLEAN_DRAFT_TRANSFER_SOURCE = "ai_roster_fill";

/** The single flag that gates this entire isolated engine. */
export function isCleanDraftEnabled(): boolean {
  // Default ON — the clean engine is now the S1 draft. Opt out to the legacy path with
  // OLY_CLEAN_DRAFT=0 (kept as an escape hatch while the legacy path is retired).
  return process.env.OLY_CLEAN_DRAFT !== "0" && process.env.OLY_CLEAN_DRAFT !== "false";
}

/**
 * Data-driven theme target for the clean scorer: the team's FULL theme model from
 * team-theme-composition-service (primary/secondary/soft tags, gender/race quota, strictness). The
 * scorer evaluates every candidate against it via the canonical tag derivation (theme-match.ts), so
 * ALL themed teams get an identity signal — tag-based (Undead, Divine, Pirate…), gender-quota
 * (D-P/V-D Female) and race-quota (R-R, H-R) alike. No team-code hardcodes; a team with no configured
 * theme simply scores theme-neutral (strategy + quality drive it).
 */
export function buildCleanThemeTarget(target: TeamThemeCompositionTarget | null): CleanThemeTarget {
  return target ?? null;
}

export type CleanDraftTeamOutcome = {
  teamId: string;
  teamCode: string;
  appliedPicks: number;
  onThemePicks: number;
  skippedPicks: number;
  spend: number;
  blockingReasons: string[];
};

export type CleanDraftRunResult = {
  blockers: string[];
  purchases: Array<Record<string, unknown>>;
  result: AiPicksRunResult;
  teamOutcomes: CleanDraftTeamOutcome[];
};

/**
 * League entry point for the clean S1 draft (the DEFAULT engine; OLY_CLEAN_DRAFT=0 opts out). Drafts each team's
 * full roster via the clean planner/scorer/executor, then applies every pick through the intact
 * local-transfermarkt buy path (cash deduction, roster + transfer-history write, salary/contract) so
 * the persisted save matches exactly what the rest of the sim expects from `ai_roster_fill` buys.
 */
export async function runCleanSeasonOneDraft(
  saveId: string,
  persistence: PersistenceService,
  options?: { teamIds?: string[] },
): Promise<CleanDraftRunResult> {
  const startedAt = Date.now();
  const baseSave = persistence.getSaveById(saveId);
  if (!baseSave) throw new Error("Clean draft: save missing.");
  const seasonId = baseSave.gameState.season.id;
  // Optional team restriction: the long-run sim drafts every team (all AI), but the in-app preseason
  // path must draft ONLY the AI-controlled teams and leave protected/human teams untouched.
  const teamFilter =
    options?.teamIds && options.teamIds.length > 0 ? new Set(options.teamIds) : null;

  const runContext = createLocalTransfermarktRunContext({ save: baseSave, persistence });

  // League-wide market brackets from every player's market value (the intact primitive).
  const brackets = buildLeagueMarketBrackets(baseSave.gameState.players.map((player) => player.marketValue));

  // Draft order: richer / more ambitious teams pick first so they can genuinely land premium
  // players from the shared pool (trait-driven, no team-code gate). ambition + finances are 0-10
  // management axes; a missing identity takes the neutral midpoint (5+5) so it no longer sorts ahead
  // of every real team (the old 50/55 fallbacks were on the wrong scale). Map hoisted out of the
  // comparator to keep the sort O(n log n).
  const identityById = new Map(runContext.save.gameState.teamIdentities.map((entry) => [entry.teamId, entry] as const));
  const draftOrderScore = (teamId: string) => {
    const identity = identityById.get(teamId);
    return (identity?.ambition ?? 5) + (identity?.finances ?? 5);
  };
  const teamsOrdered = [...baseSave.gameState.teams]
    .filter((team) => !teamFilter || teamFilter.has(team.teamId))
    .sort((left, right) => {
      const diff = draftOrderScore(right.teamId) - draftOrderScore(left.teamId);
      if (diff !== 0) return diff;
      return left.teamId.localeCompare(right.teamId);
    });

  const blockers: string[] = [];
  const purchases: Array<Record<string, unknown>> = [];
  const teamOutcomes: CleanDraftTeamOutcome[] = [];
  let totalApplied = 0;
  let totalSpend = 0;

  for (const teamRow of teamsOrdered) {
    const teamId = teamRow.teamId;
    const gameState = runContext.save.gameState;
    const team = gameState.teams.find((entry) => entry.teamId === teamId);
    if (!team) continue;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
    const strategy = getTeamStrategyProfile(gameState, teamId);
    const { playerMin } = deriveRosterTargets(team, identity ?? undefined);

    const themeTarget = buildCleanThemeTarget(getTeamThemeCompositionTarget(teamId));

    let applied = 0;
    let onThemeApplied = 0;
    let skipped = 0;
    let spend = 0;
    const teamBlockers: string[] = [];

    // Apply a planned batch through the intact buy path; returns how many actually landed so a repair
    // pass can tell whether it made progress.
    const applyPicks = (plannedPicks: CleanDraftPick[]): number => {
      let batchApplied = 0;
      for (const pick of plannedPicks) {
        const preview = previewLocalTransfermarktBuy({
          saveId,
          seasonId,
          teamId,
          playerId: pick.playerId,
          transferSource: CLEAN_DRAFT_TRANSFER_SOURCE,
          localRunContext: runContext,
        });
        if (!preview.canBuy) {
          skipped += 1;
          continue;
        }
        const execResult = executeLocalTransfermarktBuy({
          saveId,
          seasonId,
          teamId,
          playerId: pick.playerId,
          transferSource: CLEAN_DRAFT_TRANSFER_SOURCE,
          localRunContext: runContext,
          fastLocalBatch: true,
          deferPersist: true,
        });
        if (!execResult.transferCreated) {
          skipped += 1;
          continue;
        }
        applied += 1;
        batchApplied += 1;
        if (pick.onTheme) onThemeApplied += 1;
        const fee = execResult.purchasePrice ?? pick.fee;
        spend += fee;
        purchases.push({
          seasonId,
          teamId,
          playerId: pick.playerId,
          fee,
          lane: pick.lane,
          onTheme: pick.onTheme,
          source: CLEAN_DRAFT_TRANSFER_SOURCE,
        });
      }
      return batchApplied;
    };

    // Plan + draft a full roster from the team's LIVE run-context state (current roster, remaining
    // cash, residual free-agent pool). At loop start this is the pre-team state; after a flush it is
    // the post-buy state, so the same routine both drafts and repairs.
    const draftFromLiveState = (): CleanDraftPick[] => {
      const gs = runContext.save.gameState;
      const liveTeam = gs.teams.find((entry) => entry.teamId === teamId);
      if (!liveTeam) return [];
      const liveRosterEntries = gs.rosters.filter((entry) => entry.teamId === teamId);
      const livePlayersById = new Map(gs.players.map((player) => [player.id, player] as const));
      const liveRoster = liveRosterEntries
        .map((entry) => livePlayersById.get(entry.playerId))
        .filter((player): player is Player => Boolean(player));
      const liveSpendable = resolveTransferBuyAffordabilityCash({
        gameState: gs,
        teamId,
        teamCash: liveTeam.cash,
        rosterBefore: liveRosterEntries.length,
        playerMin,
        seasonId,
        transferSource: CLEAN_DRAFT_TRANSFER_SOURCE,
      });
      const livePool: TransfermarktFreeAgentItem[] = listLocalTransfermarktFreeAgents({
        saveId,
        seasonId,
        teamId,
        mode: "ai_preview",
        fullPool: true,
        localRunContext: runContext,
      }).items;
      return draftTeamRoster({
        teamId,
        identity,
        strategy,
        spendableCash: liveSpendable,
        currentRoster: liveRoster,
        freeAgents: livePool,
        brackets,
        themeTarget,
        playerMin,
      });
    };

    // 1) Initial full-roster draft, then persist so caches + rosters stay honest.
    applyPicks(draftFromLiveState());
    flushLocalTransfermarktRunContext(runContext);

    // 2) Below-min repair: a skipped pick (missing salary/market value, disposition blocker) strands
    //    its freed cash and can leave a team short of its hard minimum. Re-draft the residual gap from
    //    the players STILL in the pool with the cash that remains and re-apply — bounded, until the
    //    team reaches its minimum or a pass makes no progress. Cash-guarded by the executor, so this
    //    never overspends. (Any team still short after this falls through to the long-run topup pass.)
    let rosterAfter = runContext.save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    const maxRepairPasses = 3;
    for (let pass = 0; pass < maxRepairPasses && rosterAfter < playerMin; pass += 1) {
      const landed = applyPicks(draftFromLiveState());
      flushLocalTransfermarktRunContext(runContext);
      const nextRosterAfter = runContext.save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
      const progressed = landed > 0 && nextRosterAfter > rosterAfter;
      rosterAfter = nextRosterAfter;
      if (!progressed) break;
    }

    if (rosterAfter < playerMin) {
      teamBlockers.push(`clean_draft_below_min:${team.shortCode}:${rosterAfter}/${playerMin}`);
    }

    totalApplied += applied;
    totalSpend += spend;
    teamOutcomes.push({
      teamId,
      teamCode: team.shortCode,
      appliedPicks: applied,
      onThemePicks: onThemeApplied,
      skippedPicks: skipped,
      spend: Math.round(spend * 100) / 100,
      blockingReasons: teamBlockers,
    });
    blockers.push(...teamBlockers);
  }

  const totalMs = Date.now() - startedAt;
  const result = buildCleanPicksRunResultSkeleton({
    saveId,
    seasonId,
    appliedPickCount: totalApplied,
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalMs,
    blockers,
  });

  return { blockers, purchases, result, teamOutcomes };
}

function emptyGlobalSummary(appliedPickCount: number, totalSpend: number): AiPicksRunGlobalSummary {
  return {
    plannedPickCount: appliedPickCount,
    appliedPickCount,
    totalSpend,
    totalSalary: null,
    laneDistribution: [],
    classDistribution: [],
    raceDistribution: [],
    berserkerCount: 0,
    warlordCount: 0,
    berserkerWarlordSharePct: null,
    superstarCount: 0,
    starCount: 0,
    criticalPicks: [],
    strongestNeedFits: [],
    bestTeamFitPicks: [],
  };
}

/**
 * Type-valid AiPicksRunResult skeleton so the clean path can return through the same contract as the
 * old engine. Intentionally minimal — the clean engine reports via `purchases` / `teamOutcomes`; the
 * persisted save (rosters/cash/transfers) is the real output.
 */
function buildCleanPicksRunResultSkeleton(input: {
  saveId: string;
  seasonId: string;
  appliedPickCount: number;
  totalSpend: number;
  totalMs: number;
  blockers: string[];
}): AiPicksRunResult {
  const summary = emptyGlobalSummary(input.appliedPickCount, input.totalSpend);
  return {
    source: "sqlite",
    readOnly: false,
    dryRun: false,
    executed: true,
    status: input.blockers.length > 0 ? "partial_applied" : "applied",
    scope: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamScope: "all",
      allowSetupAllTeams: true,
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId: input.saveId,
      resolvedSaveId: input.saveId,
      requestedSeasonId: input.seasonId,
      resolvedSeasonId: input.seasonId,
      saveName: null,
      saveStatus: null,
      scopeWarning: null,
    },
    preflight: {
      activeSaveName: null,
      existingAutoTransfers: 0,
      manualTransfersProtected: 0,
      resetStatus: "already_clean",
      checks: [],
    },
    qualityGate: {
      passed: input.blockers.length === 0,
      blockingReasons: input.blockers,
      warnings: [],
      metrics: {
        plannedPickCount: input.appliedPickCount,
        berserkerWarlordSharePct: null,
        offThemeSharePct: null,
        classSpamSharePct: null,
        superstarSharePct: null,
        starSharePct: null,
      },
    },
    globalPreview: summary,
    globalExecution: summary,
    traceParity: {
      dryRunExecuteTraceMatch: true,
      dryRunPickCount: input.appliedPickCount,
      executePickCount: input.appliedPickCount,
      sameTeams: true,
      samePlayers: true,
      sameOrder: true,
      sameLanes: true,
      sameCosts: true,
      traceDifferences: [],
    },
    teams: [],
    performance: {
      totalMs: input.totalMs,
      previewMs: 0,
      executeMs: input.totalMs,
      teamTimings: [],
    },
    historyCheck: {
      allAppliedBuysVisible: true,
      missingTransferIds: [],
      visibleTransferIds: [],
    },
    warnings: [],
    blockingReasons: input.blockers,
  };
}
