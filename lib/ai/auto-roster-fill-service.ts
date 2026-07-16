import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import type { GameState, Team, TeamControlMode } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
} from "@/lib/market/transfermarkt-local-service";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { getMercenaryNegativeFitPenalty } from "@/lib/market/transfermarkt-fit";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";

export type AutoRosterFillTargetSource =
  | "team_identity_player_opt"
  | "strategy_profile_roster_opt"
  | "target_roster_size_missing";

export type AutoRosterFillTeamStatus =
  | "already_at_target"
  | "planned"
  | "filled"
  | "partially_filled"
  | "target_roster_size_missing"
  | "target_unreachable_cash"
  | "target_unreachable_no_free_agents"
  | "buy_blocked_by_existing_rules";

export type AutoRosterFillAcquisition = {
  playerId: string;
  playerName: string;
  purchasePrice: number | null;
  salary: number | null;
  contractLength: number;
  transferHistoryId: string | null;
  recommendationScore: number | null;
  status: "planned" | "applied";
  warnings: string[];
  blockingReasons: string[];
};

export type AutoRosterFillTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  targetRosterSize: number | null;
  /** The team's MINIMUM roster (min-first pass target). Callers use this to detect teams left below floor. */
  targetRosterMin: number;
  targetSource: AutoRosterFillTargetSource;
  rosterBefore: number;
  rosterAfter: number;
  missingBefore: number | null;
  missingAfter: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  freeAgentsAvailable: number | null;
  acquiredPlayers: AutoRosterFillAcquisition[];
  transferHistoryIds: string[];
  warnings: string[];
  blockingReasons: string[];
  status: AutoRosterFillTeamStatus;
};

export type AutoRosterFillSummary = {
  totalTeams: number;
  targetResolvedTeams: number;
  missingTargetTeams: number;
  teamsNeedingBuys: number;
  alreadyAtTargetTeams: number;
  filledTeams: number;
  partialTeams: number;
  blockedTeams: number;
  plannedBuys: number;
  appliedBuys: number;
  historyWrites: number;
};

export type AutoRosterFillResult = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  scope: {
    saveId: string;
    seasonId: string;
    mode: "fill_all_teams_to_target_for_matchday_setup";
  };
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string;
    requestedSeasonId: string | null;
    resolvedSeasonId: string;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: AutoRosterFillSummary;
  teams: AutoRosterFillTeamResult[];
  warnings: string[];
  blockingReasons: string[];
};

export type AutoRosterFillParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function resolveStrictLocalSave(persistence: PersistenceService, saveId: string) {
  const requestedSave = persistence.getSaveById(saveId);
  if (!requestedSave) {
    throw new Error(`Requested save ${saveId} could not be resolved for roster fill.`);
  }

  return requestedSave;
}

function getTeamRosterPlayers(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: GameState["rosters"][number]; player: GameState["players"][number] } => Boolean(item.player));
}

/** Count a team's season buy-transfers directly off the (possibly in-memory / deferred) gameState, so the
 *  history-integrity check works against the run context without a DB read. Mirrors the listLocalTransferHistory
 *  filter (seasonId + toTeamId + buy). */
function countTeamSeasonBuys(gameState: GameState, seasonId: string, teamId: string): number {
  return (gameState.transferHistory ?? []).filter(
    (entry) => entry.seasonId === seasonId && entry.toTeamId === teamId && entry.transferType === "buy",
  ).length;
}

function buildTeamEconomySnapshot(gameState: GameState, team: Team) {
  const rosterPlayers = getTeamRosterPlayers(gameState, team.teamId);
  return {
    rosterCount: rosterPlayers.length,
    cash: team.cash ?? null,
    salaryTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
        0,
      ),
      2,
    ),
    marketValueTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
        0,
      ),
      2,
    ),
  };
}

function resolveTargetRoster(team: Team, gameState: GameState) {
  const teamIdentity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  if (teamIdentity && Number.isFinite(teamIdentity.playerOpt) && teamIdentity.playerOpt > 0) {
    return {
      targetRosterSize: Math.round(teamIdentity.playerOpt),
      targetSource: "team_identity_player_opt" as const,
    };
  }

  const strategyProfile = getTeamStrategyProfile(gameState, team.teamId);
  if (strategyProfile?.rosterOptTarget != null && Number.isFinite(strategyProfile.rosterOptTarget) && strategyProfile.rosterOptTarget > 0) {
    return {
      targetRosterSize: Math.round(strategyProfile.rosterOptTarget),
      targetSource: "strategy_profile_roster_opt" as const,
    };
  }

  return {
    targetRosterSize: null,
    targetSource: "target_roster_size_missing" as const,
  };
}

/** The team's MINIMUM roster size — derived the same way the rest of the codebase does (FIXED_ROSTER_MIN=8,
 *  clamped to the team's player max). Used for the min-first pass so no team is left empty while others fill to opt. */
function resolveTargetRosterMin(team: Team, gameState: GameState): number {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  return deriveRosterTargets(team, identity).playerMin;
}

/** Per-team accumulator carried across BOTH fill passes (min, then opt) so the final teamResult reflects the
 *  cumulative outcome. One entry per active team; skipped teams (no target / already at target) never get one. */
type TeamFillAccumulator = {
  team: Team;
  teamResult: AutoRosterFillTeamResult;
  targetOpt: number;
  targetMin: number;
  beforeHistoryCount: number;
  /** Players already bought OR recorded as blocked in an earlier pass — never re-offer them (cash only ever
   *  drops between passes, so a pass-1 rejection stays a rejection; a pass-1 buy is off the free-agent feed). */
  consideredIds: Set<string>;
  simulatedCash: number | null;
  simulatedSalary: number | null;
  simulatedMarketValue: number | null;
  simulatedRoster: number;
  runningCash: number | null;
  runningSalary: number | null;
  runningMarketValue: number | null;
  freeAgentsAvailable: number | null;
  fallbackWarnings: string[];
  fallbackBlockingReasons: string[];
  hardWriteFailure: boolean;
};

function classifyUnreachableReason(input: {
  missingCount: number;
  freeAgentsAvailable: number;
  acquisitions: AutoRosterFillAcquisition[];
  fallbackWarnings: string[];
  fallbackBlockingReasons: string[];
}) {
  if (input.missingCount <= 0) {
    return {
      status: "already_at_target" as const,
      blockingReasons: [] as string[],
      warnings: [] as string[],
    };
  }

  if (input.freeAgentsAvailable <= 0) {
    return {
      status: "target_unreachable_no_free_agents" as const,
      blockingReasons: ["target_unreachable_no_free_agents"],
      warnings: ["Keine Free Agents mehr im aktuellen Save verfuegbar."],
    };
  }

  const combinedReasons = unique([
    ...input.fallbackBlockingReasons,
    ...input.acquisitions.flatMap((entry) => entry.blockingReasons),
  ]);

  if (combinedReasons.some((reason) => reason.includes("insufficient_cash"))) {
    return {
      status: "target_unreachable_cash" as const,
      blockingReasons: unique(["target_unreachable_cash", ...combinedReasons]),
      warnings: unique(["Mindestens ein noetiger Kauf scheitert am verfuegbaren Cash.", ...input.fallbackWarnings]),
    };
  }

  return {
    status: "buy_blocked_by_existing_rules" as const,
    blockingReasons: unique(["buy_blocked_by_existing_rules", ...combinedReasons]),
    warnings: unique(input.fallbackWarnings),
  };
}

function buildCandidatePool(items: TransfermarktFreeAgentItem[]) {
  const seen = new Set<string>();
  return items.filter((entry) => {
    if (seen.has(entry.playerId)) {
      return false;
    }
    seen.add(entry.playerId);
    return true;
  });
}

function getRosterFillPreviewLimit(missingCount: number | null | undefined) {
  const normalizedMissing = missingCount != null && Number.isFinite(missingCount) ? Math.max(1, Math.round(missingCount)) : 1;
  return Math.max(36, Math.min(84, normalizedMissing * 12));
}

function scoreRosterFillCandidate(input: {
  gameState: GameState;
  teamId: string;
  item: TransfermarktFreeAgentItem;
  cash: number | null;
}) {
  const needs = evaluateAiNeeds(input.gameState, input.teamId);
  const weakestAxes = needs.uncoveredNeedAxes.slice(0, 2);
  const itemNeedCoverage = input.item.topDisciplineScores.filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)).length;
  const axisMap = {
    pow: roundValue((input.item.pow ?? 0) / 100, 3),
    spe: roundValue((input.item.spe ?? 0) / 100, 3),
    men: roundValue((input.item.men ?? 0) / 100, 3),
    soc: roundValue((input.item.soc ?? 0) / 100, 3),
  };
  const weakestAxisScore =
    weakestAxes.length > 0
      ? weakestAxes.reduce((sum, axis) => sum + axisMap[axis], 0) / weakestAxes.length
      : Math.max(axisMap.pow, axisMap.spe, axisMap.men, axisMap.soc);
  const fitScore = clamp(((input.item.fit ?? 0) + 8) / 16, 0, 1);
  const valueScore = clamp((input.item.marketValueSalaryRatio ?? 0) / 20, 0, 1);
  const mercenaryNegativeFitPenalty = getMercenaryNegativeFitPenalty({
    teamId: input.teamId,
    isMercenary: input.item.mercenary,
    teamFit: input.item.fit,
  });
  const pricePenalty =
    input.cash != null && input.cash > 0 && input.item.marketValue != null
      ? clamp(input.item.marketValue / input.cash, 0, 1)
      : 0;
  const overall =
    fitScore * 0.38 +
    valueScore * 0.22 +
    clamp(itemNeedCoverage / 2, 0, 1) * 0.2 +
    weakestAxisScore * 0.2 -
    pricePenalty * 0.1 +
    mercenaryNegativeFitPenalty / 100;

  return roundValue(overall * 100, 2);
}

function buildRosterFillCandidates(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  team: Team;
  limit: number;
  localRunContext?: unknown;
}) {
  const freeAgentFeed = listLocalTransfermarktFreeAgents({
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.team.teamId,
    limit: input.limit,
    // Rank the full free-agent pool by THIS team's identity fit before slicing, so a POW+MEN team's
    // candidates are POW/MEN players (not a generic diversity cross-section that lets it draft speed stars).
    rankByTeamFit: true,
    localRunContext: input.localRunContext,
  });

  const scored = buildCandidatePool(freeAgentFeed.items ?? [])
    .map((item) => ({
      item,
      score: scoreRosterFillCandidate({
        gameState: input.gameState,
        teamId: input.team.teamId,
        item,
        cash: input.team.cash ?? null,
      }),
    }))
    .sort((left, right) => right.score - left.score);

  return {
    freeAgentFeed,
    candidates: scored.map((entry) => entry.item),
    warnings: [] as string[],
    blockingReasons: [] as string[],
  };
}

export async function runAutoRosterFillForMatchdaySetup(
  input: AutoRosterFillParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<AutoRosterFillResult> {
  if (input.source === "prisma") {
    throw new Error("Prisma/Supabase mode is read-only in this build.");
  }

  const dryRun = input.dryRun ?? true;
  if (!dryRun && input.confirmToken !== AUTO_ROSTER_FILL_CONFIRM_TOKEN) {
    throw new Error("Roster fill execute requires explicit confirm token.");
  }

  const save = resolveStrictLocalSave(persistence, input.saveId);
  const seasonId = input.seasonId?.trim() || save.gameState.season.id;
  if (seasonId !== save.gameState.season.id) {
    throw new Error(`Requested season ${seasonId} is not available in save ${save.saveId}.`);
  }

  // One in-memory run context for the ENTIRE fill: every buy accumulates here (deferPersist) and we persist
  // ONCE at the very end. All per-team reads come from this context's live gameState instead of
  // re-deserializing the ~33MB save from SQLite per team (the per-team reload + per-team flush were the last
  // O(teams) cost after the per-pick fix). dryRun makes no buys, so its context stays == the loaded save.
  const runContext = createLocalTransfermarktRunContext({ save, persistence });

  // ---- Per-team, single-pass fill helpers. Each is called ONCE per team per pass (min pass, then opt pass),
  // so the candidate pool is rebuilt+rescored at most 2× per team — NOT once per player. Both mutate the
  // shared per-team accumulator so the final teamResult reflects the cumulative outcome of both passes. ----

  const fillTeamDryRunPass = (acc: TeamFillAccumulator, targetSize: number) => {
    if (acc.simulatedRoster >= targetSize) return;
    const gameState = runContext.save.gameState;
    const previewLimit = getRosterFillPreviewLimit(targetSize - acc.simulatedRoster);
    const candidateSetup = buildRosterFillCandidates({
      gameState,
      saveId: save.saveId,
      seasonId,
      team: acc.team,
      limit: previewLimit,
      localRunContext: runContext,
    });
    acc.teamResult.freeAgentsAvailable = candidateSetup.freeAgentFeed.total;
    acc.freeAgentsAvailable = candidateSetup.freeAgentFeed.total;
    acc.fallbackWarnings = unique([...acc.fallbackWarnings, ...candidateSetup.warnings]);
    acc.fallbackBlockingReasons = unique([...acc.fallbackBlockingReasons, ...candidateSetup.blockingReasons]);

    for (const candidate of candidateSetup.candidates) {
      if (acc.simulatedRoster >= targetSize) break;
      if (acc.consideredIds.has(candidate.playerId)) continue;

      const buyPreview = previewLocalTransfermarktBuy({
        saveId: save.saveId,
        seasonId,
        teamId: acc.team.teamId,
        playerId: candidate.playerId,
        transferSource: "ai_roster_fill",
      });
      const purchasePrice = buyPreview.purchasePrice ?? candidate.marketValue ?? null;
      const salary = buyPreview.salary ?? candidate.salary ?? null;
      acc.consideredIds.add(candidate.playerId);

      if (!buyPreview.canBuy) {
        acc.teamResult.acquiredPlayers.push({
          playerId: candidate.playerId,
          playerName: candidate.name,
          purchasePrice,
          salary,
          contractLength: buyPreview.contractLength,
          transferHistoryId: null,
          recommendationScore: scoreRosterFillCandidate({
            gameState,
            teamId: acc.team.teamId,
            item: candidate,
            cash: acc.simulatedCash,
          }),
          status: "planned",
          warnings: buyPreview.warnings,
          blockingReasons: buyPreview.blockingReasons,
        });
        continue;
      }

      acc.teamResult.acquiredPlayers.push({
        playerId: candidate.playerId,
        playerName: candidate.name,
        purchasePrice,
        salary,
        contractLength: buyPreview.contractLength,
        transferHistoryId: null,
        recommendationScore: scoreRosterFillCandidate({
          gameState,
          teamId: acc.team.teamId,
          item: candidate,
          cash: acc.simulatedCash,
        }),
        status: "planned",
        warnings: buyPreview.warnings,
        blockingReasons: [],
      });

      acc.simulatedCash = acc.simulatedCash != null && purchasePrice != null ? roundValue(acc.simulatedCash - purchasePrice, 2) : acc.simulatedCash;
      acc.simulatedSalary = acc.simulatedSalary != null && salary != null ? roundValue(acc.simulatedSalary + salary, 2) : acc.simulatedSalary;
      acc.simulatedMarketValue =
        acc.simulatedMarketValue != null && purchasePrice != null ? roundValue(acc.simulatedMarketValue + purchasePrice, 2) : acc.simulatedMarketValue;
      acc.simulatedRoster += 1;
    }
  };

  const fillTeamExecutePass = (acc: TeamFillAccumulator, targetSize: number) => {
    if (acc.hardWriteFailure) return;
    if (acc.teamResult.rosterAfter >= targetSize) return;
    const gameState = runContext.save.gameState;
    const previewLimit = getRosterFillPreviewLimit(targetSize - acc.teamResult.rosterAfter);
    const candidateSetup = buildRosterFillCandidates({
      gameState,
      saveId: save.saveId,
      seasonId,
      team: acc.team,
      limit: previewLimit,
      localRunContext: runContext,
    });
    acc.teamResult.freeAgentsAvailable = candidateSetup.freeAgentFeed.total;
    acc.freeAgentsAvailable = candidateSetup.freeAgentFeed.total;
    acc.fallbackWarnings = unique([...acc.fallbackWarnings, ...candidateSetup.warnings]);
    acc.fallbackBlockingReasons = unique([...acc.fallbackBlockingReasons, ...candidateSetup.blockingReasons]);

    // In-memory fill: iterate the once-built, once-scored candidate pool in order and only call
    // executeLocalTransfermarktBuy per pick (that call persists the buy against live state and validates
    // cash/rules) — no extra per-pick save reloads or pool rebuilds. Authoritative numbers reconciled below.
    for (const nextCandidate of candidateSetup.candidates) {
      if (acc.teamResult.rosterAfter >= targetSize) break;
      if (acc.consideredIds.has(nextCandidate.playerId)) continue;

      const buyResult = executeLocalTransfermarktBuy({
        saveId: save.saveId,
        seasonId,
        teamId: acc.team.teamId,
        playerId: nextCandidate.playerId,
        transferSource: "ai_roster_fill",
        localRunContext: runContext,
        deferPersist: true,
      });
      acc.consideredIds.add(nextCandidate.playerId);

      // Cash/rules rejection: record as planned-blocked and try the NEXT (cheaper) candidate instead of
      // aborting the whole team on the first unaffordable pick.
      if (!buyResult.canBuy) {
        acc.teamResult.acquiredPlayers.push({
          playerId: nextCandidate.playerId,
          playerName: nextCandidate.name,
          purchasePrice: buyResult.purchasePrice ?? nextCandidate.marketValue ?? null,
          salary: buyResult.salary ?? nextCandidate.salary ?? null,
          contractLength: buyResult.contractLength,
          transferHistoryId: null,
          recommendationScore: scoreRosterFillCandidate({
            gameState,
            teamId: acc.team.teamId,
            item: nextCandidate,
            cash: acc.runningCash,
          }),
          status: "planned",
          warnings: buyResult.warnings,
          blockingReasons: buyResult.blockingReasons,
        });
        continue;
      }

      // Buy was allowed but no transfer persisted → a real write-integrity failure; stop this team for good.
      if (!buyResult.transferCreated || !buyResult.transferId) {
        acc.teamResult.acquiredPlayers.push({
          playerId: nextCandidate.playerId,
          playerName: nextCandidate.name,
          purchasePrice: buyResult.purchasePrice ?? nextCandidate.marketValue ?? null,
          salary: buyResult.salary ?? nextCandidate.salary ?? null,
          contractLength: buyResult.contractLength,
          transferHistoryId: buyResult.transferId,
          recommendationScore: scoreRosterFillCandidate({
            gameState,
            teamId: acc.team.teamId,
            item: nextCandidate,
            cash: acc.runningCash,
          }),
          status: "planned",
          warnings: buyResult.warnings,
          blockingReasons: unique([...buyResult.blockingReasons, "transfer_history_missing"]),
        });
        acc.teamResult.status = "buy_blocked_by_existing_rules";
        acc.teamResult.blockingReasons = unique([...acc.teamResult.blockingReasons, ...buyResult.blockingReasons, "transfer_history_missing"]);
        acc.hardWriteFailure = true;
        break;
      }

      const purchasePrice = buyResult.purchasePrice ?? nextCandidate.marketValue ?? null;
      const salary = buyResult.salary ?? nextCandidate.salary ?? null;
      acc.teamResult.acquiredPlayers.push({
        playerId: nextCandidate.playerId,
        playerName: nextCandidate.name,
        purchasePrice: buyResult.purchasePrice,
        salary: buyResult.salary,
        contractLength: buyResult.contractLength,
        transferHistoryId: buyResult.transferId,
        recommendationScore: scoreRosterFillCandidate({
          gameState,
          teamId: acc.team.teamId,
          item: nextCandidate,
          cash: acc.runningCash,
        }),
        status: "applied",
        warnings: buyResult.warnings,
        blockingReasons: [],
      });
      acc.teamResult.transferHistoryIds.push(buyResult.transferId);
      acc.teamResult.rosterAfter += 1;
      acc.runningCash = acc.runningCash != null && purchasePrice != null ? roundValue(acc.runningCash - purchasePrice, 2) : acc.runningCash;
      acc.runningSalary = acc.runningSalary != null && salary != null ? roundValue(acc.runningSalary + salary, 2) : acc.runningSalary;
      acc.runningMarketValue =
        acc.runningMarketValue != null && purchasePrice != null ? roundValue(acc.runningMarketValue + purchasePrice, 2) : acc.runningMarketValue;
      acc.teamResult.cashAfter = acc.runningCash;
      acc.teamResult.salaryAfter = acc.runningSalary;
      acc.teamResult.marketValueAfter = acc.runningMarketValue;
      acc.teamResult.missingAfter = Math.max(0, acc.targetOpt - acc.teamResult.rosterAfter);
    }

    // Reconcile authoritative roster/economy from the live in-memory context after this pass (buys deferred
    // until the single flush at the very end). Cheap in-memory read; runs at most 2× per team.
    const afterGameState = runContext.save.gameState;
    const afterTeam = afterGameState.teams.find((entry) => entry.teamId === acc.team.teamId) ?? acc.team;
    const afterSnapshot = buildTeamEconomySnapshot(afterGameState, afterTeam);
    acc.teamResult.rosterAfter = afterSnapshot.rosterCount;
    acc.teamResult.cashAfter = afterSnapshot.cash;
    acc.teamResult.salaryAfter = afterSnapshot.salaryTotal;
    acc.teamResult.marketValueAfter = afterSnapshot.marketValueTotal;
    acc.teamResult.missingAfter = Math.max(0, acc.targetOpt - afterSnapshot.rosterCount);
    acc.runningCash = afterSnapshot.cash;
    acc.runningSalary = afterSnapshot.salaryTotal;
    acc.runningMarketValue = afterSnapshot.marketValueTotal;
  };

  // Classify the CUMULATIVE per-team outcome (after BOTH passes) against the team's OPT target — the same
  // status taxonomy the single-pass version applied, now run once at the end.
  const finalizeTeamResult = (acc: TeamFillAccumulator) => {
    const teamResult = acc.teamResult;
    if (dryRun) {
      teamResult.rosterAfter = acc.simulatedRoster;
      teamResult.missingAfter = Math.max(0, acc.targetOpt - acc.simulatedRoster);
      teamResult.cashAfter = acc.simulatedCash;
      teamResult.salaryAfter = acc.simulatedSalary;
      teamResult.marketValueAfter = acc.simulatedMarketValue;
      if (teamResult.missingAfter === 0) {
        teamResult.status = "planned";
      } else {
        const unreachable = classifyUnreachableReason({
          missingCount: teamResult.missingAfter,
          freeAgentsAvailable: acc.freeAgentsAvailable ?? 0,
          acquisitions: teamResult.acquiredPlayers,
          fallbackWarnings: acc.fallbackWarnings,
          fallbackBlockingReasons: acc.fallbackBlockingReasons,
        });
        teamResult.status = teamResult.acquiredPlayers.some((entry) => entry.blockingReasons.length === 0)
          ? "partially_filled"
          : unreachable.status;
        teamResult.blockingReasons = unreachable.blockingReasons;
        teamResult.warnings = unreachable.warnings;
      }
      return;
    }

    let failedToAdvance = acc.hardWriteFailure;
    // Ran out of candidates / couldn't fund the full OPT target without a hard write failure → classify why.
    if (!failedToAdvance && teamResult.rosterAfter < acc.targetOpt) {
      const unreachable = classifyUnreachableReason({
        missingCount: Math.max(0, acc.targetOpt - teamResult.rosterAfter),
        freeAgentsAvailable: acc.freeAgentsAvailable ?? 0,
        acquisitions: teamResult.acquiredPlayers,
        fallbackWarnings: acc.fallbackWarnings,
        fallbackBlockingReasons: acc.fallbackBlockingReasons,
      });
      failedToAdvance = true;
      teamResult.status = teamResult.acquiredPlayers.some((entry) => entry.status === "applied")
        ? "partially_filled"
        : unreachable.status;
      teamResult.blockingReasons = unique([...teamResult.blockingReasons, ...unreachable.blockingReasons]);
      teamResult.warnings = unique([...teamResult.warnings, ...unreachable.warnings]);
    }

    const afterGameState = runContext.save.gameState;
    const afterHistoryCount = countTeamSeasonBuys(afterGameState, seasonId, acc.team.teamId);
    const newHistoryCount = Math.max(0, afterHistoryCount - acc.beforeHistoryCount);
    if (newHistoryCount < teamResult.acquiredPlayers.filter((entry) => entry.status === "applied").length) {
      teamResult.status = "buy_blocked_by_existing_rules";
      teamResult.blockingReasons = unique([...teamResult.blockingReasons, "transfer_history_write_mismatch"]);
      teamResult.warnings = unique([...teamResult.warnings, "Mindestens ein Kauf hat keine saubere Transferspur hinterlassen."]);
    } else if (!failedToAdvance && teamResult.missingAfter === 0) {
      teamResult.status = "filled";
    } else if (!failedToAdvance && teamResult.acquiredPlayers.some((entry) => entry.status === "applied")) {
      teamResult.status = "partially_filled";
    }
  };

  // Build per-team accumulators. Teams with no resolvable target, or already at their OPT target, are settled
  // immediately and excluded from the fill passes.
  const resultByTeamId = new Map<string, AutoRosterFillTeamResult>();
  const activeAccumulators: TeamFillAccumulator[] = [];

  for (const team of save.gameState.teams) {
    const beforeGameState = runContext.save.gameState;
    const beforeSnapshot = buildTeamEconomySnapshot(beforeGameState, team);
    const targetInfo = resolveTargetRoster(team, beforeGameState);
    const beforeHistoryCount = countTeamSeasonBuys(runContext.save.gameState, seasonId, team.teamId);

    const teamResult: AutoRosterFillTeamResult = {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      controlMode: beforeGameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode ?? (team.humanControlled ? "manual" : "ai"),
      targetRosterSize: targetInfo.targetRosterSize,
      targetRosterMin: resolveTargetRosterMin(team, beforeGameState),
      targetSource: targetInfo.targetSource,
      rosterBefore: beforeSnapshot.rosterCount,
      rosterAfter: beforeSnapshot.rosterCount,
      missingBefore: targetInfo.targetRosterSize != null ? Math.max(0, targetInfo.targetRosterSize - beforeSnapshot.rosterCount) : null,
      missingAfter: targetInfo.targetRosterSize != null ? Math.max(0, targetInfo.targetRosterSize - beforeSnapshot.rosterCount) : null,
      cashBefore: beforeSnapshot.cash,
      cashAfter: beforeSnapshot.cash,
      salaryBefore: beforeSnapshot.salaryTotal,
      salaryAfter: beforeSnapshot.salaryTotal,
      marketValueBefore: beforeSnapshot.marketValueTotal,
      marketValueAfter: beforeSnapshot.marketValueTotal,
      freeAgentsAvailable: null,
      acquiredPlayers: [],
      transferHistoryIds: [],
      warnings: [],
      blockingReasons: [],
      status: "already_at_target",
    };
    resultByTeamId.set(team.teamId, teamResult);

    if (targetInfo.targetRosterSize == null) {
      teamResult.status = "target_roster_size_missing";
      teamResult.blockingReasons = ["target_roster_size_missing"];
      continue;
    }

    if (beforeSnapshot.rosterCount >= targetInfo.targetRosterSize) {
      teamResult.status = "already_at_target";
      continue;
    }

    // Minimum pass target never exceeds the opt target (a team whose configured opt sits below the fixed min
    // is filled only to its opt, not overshot).
    const targetMin = Math.max(0, Math.min(resolveTargetRosterMin(team, beforeGameState), targetInfo.targetRosterSize));

    activeAccumulators.push({
      team,
      teamResult,
      targetOpt: targetInfo.targetRosterSize,
      targetMin,
      beforeHistoryCount,
      consideredIds: new Set<string>(),
      simulatedCash: beforeSnapshot.cash,
      simulatedSalary: beforeSnapshot.salaryTotal,
      simulatedMarketValue: beforeSnapshot.marketValueTotal,
      simulatedRoster: beforeSnapshot.rosterCount,
      runningCash: beforeSnapshot.cash,
      runningSalary: beforeSnapshot.salaryTotal,
      runningMarketValue: beforeSnapshot.marketValueTotal,
      freeAgentsAvailable: null,
      fallbackWarnings: [],
      fallbackBlockingReasons: [],
      hardWriteFailure: false,
    });
  }

  // PASS 1 (min-first): every active team reaches at least its MINIMUM roster before ANY team fills toward its
  // opt. This is the core no-empty-team guarantee — the shared free-agent pool is spent on floors first.
  for (const acc of activeAccumulators) {
    if (!dryRun) {
      // Yield to the event loop between teams. The per-team buy work is CPU-bound and synchronous, so without
      // this the whole execute fill would block the single JS thread in one go — the caller's background
      // detach would be a no-op and any concurrent request (e.g. the league-setup status poll) would stall.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    if (dryRun) {
      fillTeamDryRunPass(acc, acc.targetMin);
    } else {
      fillTeamExecutePass(acc, acc.targetMin);
    }
  }

  // PASS 2: every active team fills from its minimum toward its OPTIMUM roster with whatever pool/cash remains.
  for (const acc of activeAccumulators) {
    if (!dryRun) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    if (dryRun) {
      fillTeamDryRunPass(acc, acc.targetOpt);
    } else {
      fillTeamExecutePass(acc, acc.targetOpt);
    }
  }

  for (const acc of activeAccumulators) {
    finalizeTeamResult(acc);
  }

  if (!dryRun) {
    // Single batch persist for the ENTIRE league fill — all deferred buys across all 32 teams in one write.
    flushLocalTransfermarktRunContext(runContext);
  }

  // One row per team, in league (team) order, reflecting the cumulative outcome across both passes.
  const teamResults: AutoRosterFillTeamResult[] = save.gameState.teams
    .map((team) => resultByTeamId.get(team.teamId))
    .filter((entry): entry is AutoRosterFillTeamResult => Boolean(entry));

  const summary: AutoRosterFillSummary = {
    totalTeams: teamResults.length,
    targetResolvedTeams: teamResults.filter((team) => team.targetRosterSize != null).length,
    missingTargetTeams: teamResults.filter((team) => team.targetRosterSize == null).length,
    teamsNeedingBuys: teamResults.filter((team) => (team.missingBefore ?? 0) > 0).length,
    alreadyAtTargetTeams: teamResults.filter((team) => team.status === "already_at_target").length,
    filledTeams: teamResults.filter((team) => team.status === "filled" || team.status === "planned").length,
    partialTeams: teamResults.filter((team) => team.status === "partially_filled").length,
    blockedTeams: teamResults.filter((team) =>
      [
        "target_roster_size_missing",
        "target_unreachable_cash",
        "target_unreachable_no_free_agents",
        "buy_blocked_by_existing_rules",
      ].includes(team.status),
    ).length,
    plannedBuys: dryRun
      ? teamResults.reduce((sum, team) => sum + team.acquiredPlayers.filter((entry) => entry.status === "planned" && entry.blockingReasons.length === 0).length, 0)
      : 0,
    appliedBuys: dryRun
      ? 0
      : teamResults.reduce((sum, team) => sum + team.acquiredPlayers.filter((entry) => entry.status === "applied").length, 0),
    historyWrites: dryRun ? 0 : teamResults.reduce((sum, team) => sum + team.transferHistoryIds.length, 0),
  };

  const warnings = unique(teamResults.flatMap((team) => team.warnings));
  const blockingReasons = unique(teamResults.flatMap((team) => team.blockingReasons));

  return {
    source: "sqlite",
    readOnly: dryRun,
    dryRun,
    executed: !dryRun,
    status: !dryRun
      ? (summary.blockedTeams > 0 ? "warning" : "applied")
      : (summary.blockedTeams > 0 ? "warning" : "ready"),
    scope: {
      saveId: save.saveId,
      seasonId,
      mode: "fill_all_teams_to_target_for_matchday_setup",
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId: input.saveId ?? null,
      resolvedSaveId: save.saveId,
      requestedSeasonId: input.seasonId ?? null,
      resolvedSeasonId: seasonId,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
    summary,
    teams: teamResults,
    warnings,
    blockingReasons,
  };
}
