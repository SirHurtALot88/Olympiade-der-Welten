import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  applyAiMarketPlanLocally,
  type AiMarketPlanApplyResult,
  type AiMarketPlanApplyTeamResult,
} from "@/lib/ai/ai-market-plan-apply-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
import type { AiSeasonStrategy, GameState } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { isSeasonOne, isTransferActionAllowed } from "@/lib/season/transfer-season-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import type { LocalTransferWindowPhase } from "@/lib/market/transfer-window-policy";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";

const CONVERGENCE_BUY_STRATEGIES: AiSeasonStrategy[] = ["roster_repair", "depth_repair", "win_now_push"];

export type ConvergencePassId = "standard" | "escalated";

export type ConvergenceTeamStatus =
  | "converged"
  | "valid_sell_only_below_min"
  | "convergence_exhausted"
  | "blocked"
  | "skipped";

export type ConvergenceRoundRecord = {
  passId: ConvergencePassId;
  round: number;
  appliedBuys: number;
  appliedSells: number;
  fingerprint: string;
  blockingReasons: string[];
  warnings: string[];
};

export type ConvergenceTeamResult = {
  teamId: string;
  teamName: string;
  status: ConvergenceTeamStatus;
  passes: number;
  rounds: number;
  appliedBuys: number;
  appliedSells: number;
  rosterAfter: number;
  hardMin: number;
  optTarget: number;
  /** @deprecated use hardMin */
  minRequired: number;
  doctrineStrategy: AiSeasonStrategy;
  blockingReasons: string[];
  warnings: string[];
  roundHistory: ConvergenceRoundRecord[];
};

export type MarketPlanConvergenceInput = {
  saveId: string;
  seasonId: string;
  persistence?: PersistenceService;
  dryRun?: boolean;
  confirmToken?: string | null;
  transferPhase: LocalTransferWindowPhase | string;
  teamScope?: "ai" | "all";
  targetTeamIds?: string[];
  maxRoundsPerPass?: number;
  maxPasses?: number;
  allowBuys?: boolean;
  skipIfExistingMarketTransfers?: boolean;
  progressLog?: boolean;
};

export type MarketPlanConvergenceResult = {
  passes: number;
  rounds: number;
  perTeam: ConvergenceTeamResult[];
  emergencyRepairTeams: string[];
  appliedBuys: number;
  appliedSells: number;
  warnings: string[];
  blockingReasons: string[];
  skipped: boolean;
  roundHistory: ConvergenceRoundRecord[];
};

export type EmergencyRosterRepairResult = {
  repaired: boolean;
  teamIds: string[];
  purchases: Array<Record<string, unknown>>;
  blockers: string[];
  warnings: string[];
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function getSeasonMaxRequiredSlots(gameState: GameState) {
  const counts = (gameState.seasonState.disciplineSchedule ?? [])
    .filter((entry) => entry.seasonId === gameState.season.id || !entry.seasonId)
    .flatMap((entry) => [entry.discipline1?.playerCount ?? 0, entry.discipline2?.playerCount ?? 0])
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (counts.length === 0) return 8;
  return Math.max(7, Math.max(...counts) * 2);
}

export function getTeamHardMinRequired(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  return deriveRosterTargets(team, identity).playerMin;
}

export function getTeamOptTarget(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  return deriveRosterTargets(team, identity).playerOpt;
}

/** Identity hard floor only — not slot depth. Prefer getTeamHardMinRequired. */
export function getTeamMinRequired(gameState: GameState, teamId: string) {
  return getTeamHardMinRequired(gameState, teamId);
}

function getTeamRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

export function teamNeedsMarketConvergence(gameState: GameState, teamId: string) {
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const hardMin = getTeamHardMinRequired(gameState, teamId);
  const optTarget = getTeamOptTarget(gameState, teamId);
  if (rosterCount < hardMin) return true;
  if (rosterCount >= optTarget) return false;
  const strategy = buildSeasonStrategyState(gameState)[teamId]?.seasonStrategy ?? "balanced_growth";
  return CONVERGENCE_BUY_STRATEGIES.includes(strategy);
}

export function getTeamsBelowHardMin(gameState: GameState) {
  return gameState.teams
    .map((team) => {
      const rosterCount = getTeamRosterCount(gameState, team.teamId);
      const hardMin = getTeamHardMinRequired(gameState, team.teamId);
      const optTarget = getTeamOptTarget(gameState, team.teamId);
      const strategy = buildSeasonStrategyState(gameState)[team.teamId]?.seasonStrategy ?? "balanced_growth";
      return { teamId: team.teamId, teamName: team.name, rosterCount, hardMin, optTarget, strategy };
    })
    .filter((entry) => entry.rosterCount < entry.hardMin);
}

export function getTeamsNeedingConvergence(gameState: GameState) {
  return gameState.teams
    .filter((team) => teamNeedsMarketConvergence(gameState, team.teamId))
    .map((team) => {
      const rosterCount = getTeamRosterCount(gameState, team.teamId);
      const hardMin = getTeamHardMinRequired(gameState, team.teamId);
      const optTarget = getTeamOptTarget(gameState, team.teamId);
      const strategy = buildSeasonStrategyState(gameState)[team.teamId]?.seasonStrategy ?? "balanced_growth";
      return { teamId: team.teamId, teamName: team.name, rosterCount, hardMin, optTarget, strategy };
    });
}

export function getTeamsBelowMin(gameState: GameState) {
  return getTeamsBelowHardMin(gameState).map(({ teamId, teamName, rosterCount, hardMin }) => ({
    teamId,
    teamName,
    rosterCount,
    minRequired: hardMin,
  }));
}

function getExistingMarketTransfers(gameState: GameState, seasonId: string) {
  return gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      (entry.source === "ai_preseason_market_buy" ||
        entry.source === "ai_preseason_market_sell" ||
        entry.source === "manual_transfer_window"),
  );
}

function buildTeamFingerprint(team: AiMarketPlanApplyTeamResult) {
  const buyIds = team.appliedBuyDetails.map((entry) => entry.playerId).sort().join(",");
  const sellIds = team.appliedSellDetails.map((entry) => entry.playerId).sort().join(",");
  const blockers = team.blockingReasons.slice().sort().join("|");
  return `${team.result}:${buyIds}:${sellIds}:${blockers}`;
}

function buildRoundFingerprint(apply: AiMarketPlanApplyResult) {
  return apply.teams
    .map((team) => `${team.teamId}=${buildTeamFingerprint(team)}`)
    .sort()
    .join(";");
}

function collectAttemptedBuyPlayerIds(apply: AiMarketPlanApplyResult) {
  const ids = new Set<string>();
  for (const team of apply.teams) {
    for (const step of [...team.appliedBuyDetails, ...team.plannedBuyDetails, ...team.skippedSteps]) {
      if (step.stepType === "buy") ids.add(step.playerId);
    }
  }
  for (const row of apply.buyGateRows ?? []) {
    const playerId = typeof row.playerId === "string" ? row.playerId : null;
    if (playerId) ids.add(playerId);
  }
  return [...ids];
}

function collectAttemptedSellPlayerIds(apply: AiMarketPlanApplyResult) {
  const ids = new Set<string>();
  for (const team of apply.teams) {
    for (const step of [...team.appliedSellDetails, ...team.plannedSellDetails, ...team.skippedSteps]) {
      if (step.stepType === "sell") ids.add(step.playerId);
    }
  }
  return [...ids];
}

type RoundProfile = {
  passId: ConvergencePassId;
  round: number;
  applySellSteps: boolean;
  applyBuySteps: boolean;
  maxSellsPerTeam: number;
  previewBuyLimit: number;
  previewSellLimit: number;
  applyBuyStepsInBatch: number | null;
  performanceBudgetMs: number;
  maxApplyMs: number;
};

function buildRoundProfile(input: {
  passId: ConvergencePassId;
  round: number;
  allowBuys: boolean;
  teamsNeedingConvergenceCount: number;
}): RoundProfile {
  const needsRosterFill = input.teamsNeedingConvergenceCount > 0;

  if (input.passId === "standard") {
    const buyFirstRound = needsRosterFill;
    return {
      passId: "standard",
      round: input.round,
      applySellSteps: !buyFirstRound,
      applyBuySteps: input.allowBuys,
      maxSellsPerTeam: buyFirstRound ? 0 : 2,
      previewBuyLimit: buyFirstRound ? 128 : input.round === 1 ? 96 : 112,
      previewSellLimit: buyFirstRound ? 4 : input.round === 1 ? 16 : 12,
      applyBuyStepsInBatch: buyFirstRound ? 3 : input.round === 1 ? 2 : 1,
      performanceBudgetMs: 12_000,
      maxApplyMs: 75_000,
    };
  }

  return {
    passId: "escalated",
    round: input.round,
    applySellSteps: needsRosterFill ? input.round === 1 : input.round === 1,
    applyBuySteps: input.allowBuys && (!needsRosterFill || input.round > 1),
    maxSellsPerTeam: needsRosterFill ? (input.round === 1 ? 1 : 0) : input.round === 1 ? 4 : 1,
    previewBuyLimit: needsRosterFill ? 144 : input.round === 1 ? 72 : 144,
    previewSellLimit: needsRosterFill ? 4 : 8,
    applyBuyStepsInBatch: needsRosterFill ? 2 : input.round === 1 ? null : 2,
    performanceBudgetMs: 14_000,
    maxApplyMs: 90_000,
  };
}

function resolveTeamStatus(input: {
  team: { result?: string; executedBuys?: number; executedSells?: number };
  rosterAfter: number;
  hardMin: number;
  optTarget: number;
  needsConvergence: boolean;
  exhausted: boolean;
}): ConvergenceTeamStatus {
  const { team, rosterAfter, hardMin, optTarget, needsConvergence, exhausted } = input;
  if (team.result === "blocked" || team.result === "failed_buy" || team.result === "failed_sell") {
    return exhausted ? "convergence_exhausted" : "blocked";
  }
  if ((team.executedBuys ?? 0) > 0 && rosterAfter < hardMin) {
    return exhausted ? "convergence_exhausted" : "blocked";
  }
  if (rosterAfter < hardMin && (team.executedBuys ?? 0) === 0) {
    return exhausted ? "convergence_exhausted" : "valid_sell_only_below_min";
  }
  if (needsConvergence && rosterAfter < optTarget) {
    return exhausted ? "convergence_exhausted" : "valid_sell_only_below_min";
  }
  return "converged";
}

export { resolveTeamStatus };

function mergeTeamResults(
  existing: Map<string, ConvergenceTeamResult>,
  apply: AiMarketPlanApplyResult,
  gameState: GameState,
  roundRecord: ConvergenceRoundRecord,
  passIndex: number,
  roundIndex: number,
  exhaustedTeamIds: Set<string>,
) {
  const strategyMap = buildSeasonStrategyState(gameState);
  for (const team of apply.teams) {
    const rosterAfter =
      gameState.rosters.filter((entry) => entry.teamId === team.teamId).length ??
      team.rosterAfter ??
      team.rosterBefore ??
      0;
    const hardMin = getTeamHardMinRequired(gameState, team.teamId);
    const optTarget = getTeamOptTarget(gameState, team.teamId);
    const needsConvergence = teamNeedsMarketConvergence(gameState, team.teamId);
    const doctrineStrategy = strategyMap[team.teamId]?.seasonStrategy ?? "balanced_growth";
    const previous = existing.get(team.teamId);
    const status = resolveTeamStatus({
      team,
      rosterAfter,
      hardMin,
      optTarget,
      needsConvergence,
      exhausted: exhaustedTeamIds.has(team.teamId),
    });
    existing.set(team.teamId, {
      teamId: team.teamId,
      teamName: team.teamName,
      status,
      passes: Math.max(previous?.passes ?? 0, passIndex),
      rounds: Math.max(previous?.rounds ?? 0, roundIndex),
      appliedBuys: (previous?.appliedBuys ?? 0) + team.executedBuys,
      appliedSells: (previous?.appliedSells ?? 0) + team.executedSells,
      rosterAfter,
      hardMin,
      optTarget,
      minRequired: hardMin,
      doctrineStrategy,
      blockingReasons: unique([...(previous?.blockingReasons ?? []), ...team.blockingReasons]),
      warnings: unique([...(previous?.warnings ?? []), ...team.warnings.slice(0, 8)]),
      roundHistory: [...(previous?.roundHistory ?? []), roundRecord],
    });
  }
}

export async function runMarketPlanConvergence(input: MarketPlanConvergenceInput): Promise<MarketPlanConvergenceResult> {
  const session = await runTransferWindowSession({
    saveId: input.saveId,
    seasonId: input.seasonId,
    persistence: input.persistence,
    phase: "preseason",
    dryRun: input.dryRun,
    confirmToken: input.confirmToken,
    transferPhase: input.transferPhase,
    teamScope: input.teamScope,
    targetTeamIds: input.targetTeamIds,
    maxTeamCycles: Math.max(1, input.maxRoundsPerPass ?? 5),
    maxLeagueRounds: Math.max(1, input.maxPasses ?? 3),
    allowBuys: input.allowBuys,
    skipIfExistingMarketTransfers: input.skipIfExistingMarketTransfers,
    progressLog: input.progressLog,
  });

  return {
    passes: session.passes,
    rounds: session.rounds,
    perTeam: session.perTeam,
    emergencyRepairTeams: session.emergencyRepairTeams,
    appliedBuys: session.appliedBuys,
    appliedSells: session.appliedSells,
    warnings: session.warnings,
    blockingReasons: session.blockingReasons,
    skipped: session.skipped,
    roundHistory: session.roundHistory,
  };
}

export function runEmergencyRosterRepairForTeams(input: {
  saveId: string;
  seasonId: string;
  teamIds: string[];
  persistence: PersistenceService;
  outputDir?: string;
}): EmergencyRosterRepairResult {
  const uniqueTeamIds = unique(input.teamIds);
  if (uniqueTeamIds.length === 0) {
    return { repaired: false, teamIds: [], purchases: [], blockers: [], warnings: [] };
  }
  if (!isTransferActionAllowed(input.seasonId, "preseason_roster_repair")) {
    return {
      repaired: false,
      teamIds: uniqueTeamIds,
      purchases: [],
      blockers: uniqueTeamIds.map((teamId) => `preseason_roster_repair_not_allowed:${teamId}`),
      warnings: [],
    };
  }

  const save = input.persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing before emergency roster repair.");

  const result = runChunkedRedraftTopup({
    persistence: input.persistence,
    saveId: input.saveId,
    seasonId: input.seasonId,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "preseason_roster_repair",
    target: "playerOpt",
    targetTeamIds: uniqueTeamIds,
    roundLimit: 16,
    teamTimeLimitMs: 60_000,
    watchdogMs: 120_000,
    outputDir: input.outputDir,
  });

  const purchases = result.picks.map((pick) => ({
    seasonId: input.seasonId,
    teamId: pick.teamId,
    playerId: pick.playerId,
    playerName: pick.playerName,
    fee: pick.marketValue,
    rosterAfter: pick.rosterAfter,
    cashAfter: pick.cashAfter,
    source: "preseason_roster_repair_buy",
    emergencyFallback: true,
  }));

  const after = input.persistence.getSaveById(input.saveId);
  const blockers: string[] = [];
  if (after) {
    for (const teamId of uniqueTeamIds) {
      const rosterCount = after.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
      const hardMin = getTeamHardMinRequired(after.gameState, teamId);
      if (rosterCount < hardMin) {
        blockers.push(`emergency_roster_repair_below_min:${teamId}:${rosterCount}/${hardMin}`);
      }
    }
  }

  return {
    repaired: true,
    teamIds: uniqueTeamIds,
    purchases,
    blockers,
    warnings: [...result.warnings.slice(0, 20), "emergency_fallback:true"],
  };
}
