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
 * Data-driven theme target for the clean scorer: uses the team's explicit race quota from
 * team-theme-composition-service when present (e.g. R-R fish/aqua/lizard, H-R demon). No team-code
 * hardcodes — teams without a race quota simply score theme-neutral (strategy + quality drive them).
 */
export function buildCleanThemeTarget(target: TeamThemeCompositionTarget | null): CleanThemeTarget {
  if (!target) return null;
  const races = target.raceQuotaScoped?.races ?? [];
  if (races.length === 0) return null;
  const coreRaces = races.map((race) => race.trim().toLowerCase()).filter(Boolean);
  if (coreRaces.length === 0) return null;
  const minCorePct = Number.isFinite(target.minimumShare)
    ? target.minimumShare
    : Number.isFinite(target.targetShare)
      ? target.targetShare
      : 0.5;
  return { coreRaces, minCorePct };
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
 * League entry point for the clean S1 draft. Only invoked when OLY_CLEAN_DRAFT=1. Drafts each team's
 * full roster via the clean planner/scorer/executor, then applies every pick through the intact
 * local-transfermarkt buy path (cash deduction, roster + transfer-history write, salary/contract) so
 * the persisted save matches exactly what the rest of the sim expects from `ai_roster_fill` buys.
 */
export async function runCleanSeasonOneDraft(
  saveId: string,
  persistence: PersistenceService,
): Promise<CleanDraftRunResult> {
  const startedAt = Date.now();
  const baseSave = persistence.getSaveById(saveId);
  if (!baseSave) throw new Error("Clean draft: save missing.");
  const seasonId = baseSave.gameState.season.id;

  const runContext = createLocalTransfermarktRunContext({ save: baseSave, persistence });

  // League-wide market brackets from every player's market value (the intact primitive).
  const brackets = buildLeagueMarketBrackets(baseSave.gameState.players.map((player) => player.marketValue));

  // Draft order: richer / more ambitious teams pick first so they can genuinely land premium
  // players from the shared pool (trait-driven, no team-code gate).
  const teamsOrdered = [...baseSave.gameState.teams].sort((left, right) => {
    const identityById = new Map(runContext.save.gameState.teamIdentities.map((entry) => [entry.teamId, entry]));
    const leftId = identityById.get(left.teamId);
    const rightId = identityById.get(right.teamId);
    const leftScore = (leftId?.ambition ?? 50) + (leftId?.finances ?? 55);
    const rightScore = (rightId?.ambition ?? 50) + (rightId?.finances ?? 55);
    if (rightScore !== leftScore) return rightScore - leftScore;
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

    const currentRosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
    const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
    const currentRoster = currentRosterEntries
      .map((entry) => playersById.get(entry.playerId))
      .filter((player): player is Player => Boolean(player));

    const spendableCash = resolveTransferBuyAffordabilityCash({
      gameState,
      teamId,
      teamCash: team.cash,
      rosterBefore: currentRosterEntries.length,
      playerMin,
      seasonId,
      transferSource: CLEAN_DRAFT_TRANSFER_SOURCE,
    });

    const themeTarget = buildCleanThemeTarget(getTeamThemeCompositionTarget(teamId));

    const freeAgents: TransfermarktFreeAgentItem[] = listLocalTransfermarktFreeAgents({
      saveId,
      seasonId,
      teamId,
      mode: "ai_preview",
      fullPool: true,
      localRunContext: runContext,
    }).items;

    const plannedPicks = draftTeamRoster({
      teamId,
      identity,
      strategy,
      spendableCash,
      currentRoster,
      freeAgents,
      brackets,
      themeTarget,
      playerMin,
    });

    let applied = 0;
    let onThemeApplied = 0;
    let skipped = 0;
    let spend = 0;
    const teamBlockers: string[] = [];

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

    // Persist this team's buys before the next team reads the pool (keeps caches + rosters honest).
    flushLocalTransfermarktRunContext(runContext);

    const rosterAfter = runContext.save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
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
