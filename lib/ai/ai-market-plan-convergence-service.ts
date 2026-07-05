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
import { deriveRosterTargets, resolvePlannerRosterTargets } from "@/lib/foundation/roster-limits";
import { isSeasonOne, isTransferActionAllowed } from "@/lib/season/transfer-season-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import type { LocalTransferWindowPhase } from "@/lib/market/transfer-window-policy";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { isUnifiedPickEnabledForMarket } from "@/lib/ai/unified-pick-planner-service";
import { teamNeedsPostOptUpgradeDeploy } from "@/lib/ai/ai-budget-deploy-service";
import {
  filterEmergencyRepairTeamIds,
  getPlannedExpiryBuyNeed,
} from "@/lib/ai/planner-opt-buy-policy";

/** Minimum cash before preseason roster repair so sub-hardMin teams can afford multiple fillers. */
export const PRESEASON_REPAIR_TEAM_CASH_FLOOR = 50;

// cash_recovery teams sit between hardMin and Opt with cash pressure — they must still get real
// convergence buy passes (routed through the Unified Pick Engine's cash-tier caps / cheap_fill lane,
// see lib/ai/ai-needs-picks-compare-service.ts resolveTeamCashTier), not just an Opt-skip that
// strands them until they fall below hardMin and hit the weaker emergency-repair fallback.
// See .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc: no sell floor, so the buy side must
// carry the rebuild obligation instead.
//
// 2026-07-04 fix: "eco_round" was missing here, which reintroduced exactly the "Opt-skip that
// strands them" failure mode this comment warns against — seasonStrategyFor() (see
// ai-manager-doctrine-service.ts) assigns eco_round purely from a team's static/identity
// finance-/value-priority bias, independent of roster count, and checks that branch BEFORE its own
// "still below Opt -> depth_repair" fallback. Any team with high finance/value identity (e.g. a
// static valuePriority>=8 team profile, or a randomized per-save identity.finances>=8) that sits
// between hardMin and Opt got permanently frozen out of every convergence buy pass for the rest of
// the season — regardless of how much cash it actually had — because eco_round was absent from
// this list. "Eco round" is meant to mean "grow toward Opt via cheap/value-lane picks", not "never
// buy again"; the Unified Pick Engine's own cash-tier caps / cheap_fill lane (unaffected by this
// change) already ensures eco_round teams still only reach for lane-appropriate, economical picks
// once admitted to convergence.
const CONVERGENCE_BUY_STRATEGIES: AiSeasonStrategy[] = [
  "roster_repair",
  "depth_repair",
  "win_now_push",
  "cash_recovery",
  "eco_round",
];

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

export type ConvergencePickEngine = "unified" | "legacy" | "repair";

export type ConvergenceTeamResult = {
  teamId: string;
  teamName: string;
  status: ConvergenceTeamStatus;
  pickEngine: ConvergencePickEngine;
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
  lastApplyResult?: string;
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
  return resolvePlannerRosterTargets(gameState, teamId).playerOpt;
}

/** Identity hard floor only — not slot depth. Prefer getTeamHardMinRequired. */
export function getTeamMinRequired(gameState: GameState, teamId: string) {
  return getTeamHardMinRequired(gameState, teamId);
}

function getTeamRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

/** Preseason convergence fill stops at Opt; conscious planned buys (expiry/deploy) may still run. */
export function teamSkipsPreseasonMarketBuys(gameState: GameState, teamId: string) {
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const optTarget = getTeamOptTarget(gameState, teamId);
  if (rosterCount < optTarget) return false;

  const expiringCount = gameState.rosters.filter(
    (entry) => entry.teamId === teamId && (entry.contractLength ?? 99) <= 1,
  ).length;
  if (
    getPlannedExpiryBuyNeed({
      rosterCount,
      playerOpt: optTarget,
      expiringCount,
    }) > 0
  ) {
    return false;
  }

  if (teamNeedsPostOptUpgradeDeploy(gameState, teamId, gameState.season.id)) {
    return false;
  }

  return true;
}

export function teamNeedsMarketConvergence(gameState: GameState, teamId: string) {
  if (teamSkipsPreseasonMarketBuys(gameState, teamId)) return false;
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const optTarget = getTeamOptTarget(gameState, teamId);
  if (rosterCount >= optTarget) return false;
  // Convergence runs until Opt — not just hardMin. Strategy-specific buy lanes (eco_round,
  // cash_recovery, etc.) are chosen inside the Unified Pick Engine once a team is admitted;
  // gating convergence itself on doctrine strategy left balanced_growth / star_chaser teams
  // permanently stuck between hardMin and Opt (43%+ emergency-filler in S10).
  return true;
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

function resolveTeamStatus(input: {
  team: { result?: string; executedBuys?: number; executedSells?: number };
  rosterAfter: number;
  hardMin: number;
  optTarget: number;
  needsConvergence: boolean;
  exhausted: boolean;
}): ConvergenceTeamStatus {
  const { team, rosterAfter, hardMin, optTarget, needsConvergence, exhausted } = input;
  if ((team.executedBuys ?? 0) > 0 && rosterAfter < hardMin) {
    return exhausted ? "convergence_exhausted" : "blocked";
  }
  if (team.result === "blocked" || team.result === "failed_buy" || team.result === "failed_sell") {
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
      pickEngine: resolveActiveConvergencePickEngine(),
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

export function resolveActiveConvergencePickEngine(): Exclude<ConvergencePickEngine, "repair"> {
  return isUnifiedPickEnabledForMarket() ? "unified" : "legacy";
}

export async function runCompareRescueBeforeEmergencyRepair(input: {
  saveId: string;
  seasonId: string;
  teamIds: string[];
  persistence: PersistenceService;
  transferPhase?: LocalTransferWindowPhase | string;
}) {
  const teamIds = unique(input.teamIds);
  if (teamIds.length === 0 || !isUnifiedPickEnabledForMarket()) {
    return {
      appliedBuys: 0,
      appliedSells: 0,
      warnings: [] as string[],
      remainingTeamIds: teamIds,
    };
  }

  const session = await runTransferWindowSession({
    saveId: input.saveId,
    seasonId: input.seasonId,
    persistence: input.persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: input.transferPhase ?? "manual_transfer_window",
    teamScope: "all",
    targetTeamIds: teamIds,
    maxTeamCycles: 1,
    maxLeagueRounds: 1,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  });

  const after = input.persistence.getSaveById(input.saveId);
  const remainingTeamIds = after
    ? unique([
        ...getTeamsBelowHardMin(after.gameState).map((entry) => entry.teamId),
        ...getTeamsNeedingConvergence(after.gameState)
          .map((entry) => entry.teamId)
          .filter((teamId) => teamIds.includes(teamId)),
      ]).filter((teamId) => teamIds.includes(teamId))
    : teamIds;

  return {
    appliedBuys: session.appliedBuys,
    appliedSells: session.appliedSells,
    warnings: [
      `compare_rescue_round:teams:${teamIds.length}:buys:${session.appliedBuys}:remaining:${remainingTeamIds.length}`,
      ...session.warnings.slice(0, 8),
    ],
    remainingTeamIds,
  };
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
  /** Planner-delegated coverage-risk teams (optional metadata for logging). */
  convergenceExhaustedTeamIds?: string[];
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

  let save = input.persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing before emergency roster repair.");

  const eligibleTeamIds = filterEmergencyRepairTeamIds(
    save.gameState,
    uniqueTeamIds,
    getTeamRosterCount,
    getTeamOptTarget,
  );
  const blockedAtOpt = uniqueTeamIds.filter((teamId) => !eligibleTeamIds.includes(teamId));
  if (eligibleTeamIds.length === 0) {
    return {
      repaired: false,
      teamIds: uniqueTeamIds,
      purchases: [],
      blockers: blockedAtOpt.map((teamId) => `emergency_repair_blocked_at_opt:${teamId}`),
      warnings: blockedAtOpt.length > 0 ? ["emergency_repair_skipped_at_or_above_opt"] : [],
    };
  }

  let repairCashTopUps = 0;
  for (const teamId of eligibleTeamIds) {
    const rosterCount = getTeamRosterCount(save.gameState, teamId);
    const hardMin = getTeamHardMinRequired(save.gameState, teamId);
    if (rosterCount >= hardMin) continue;
    const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
    if (!team) continue;
    const cash = team.cash ?? 0;
    if (cash + 0.01 >= PRESEASON_REPAIR_TEAM_CASH_FLOOR) continue;
    team.cash = PRESEASON_REPAIR_TEAM_CASH_FLOOR;
    repairCashTopUps += 1;
  }
  if (repairCashTopUps > 0) {
    input.persistence.saveSingleplayerState(input.saveId, save.gameState);
    save = input.persistence.getSaveById(input.saveId);
    if (!save) throw new Error("Save missing after emergency repair cash top-up.");
  }

  const result = runChunkedRedraftTopup({
    persistence: input.persistence,
    saveId: input.saveId,
    seasonId: input.seasonId,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "preseason_roster_repair",
    target: "playerOpt",
    targetTeamIds: eligibleTeamIds,
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
  const blockers: string[] = [...blockedAtOpt.map((teamId) => `emergency_repair_blocked_at_opt:${teamId}`)];
  if (after) {
    for (const teamId of eligibleTeamIds) {
      const rosterCount = after.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
      const hardMin = getTeamHardMinRequired(after.gameState, teamId);
      const optTarget = getTeamOptTarget(after.gameState, teamId);
      if (rosterCount < hardMin) {
        blockers.push(`emergency_roster_repair_below_min:${teamId}:${rosterCount}/${hardMin}`);
      } else if (rosterCount < optTarget) {
        blockers.push(`emergency_roster_repair_below_opt:${teamId}:${rosterCount}/${optTarget}`);
      }
    }
  }

  return {
    repaired: true,
    teamIds: uniqueTeamIds,
    purchases,
    blockers,
    warnings: [
      ...result.warnings.slice(0, 20),
      "emergency_fallback:true",
      ...(blockedAtOpt.length > 0 ? ["emergency_repair_skipped_at_or_above_opt"] : []),
    ],
  };
}
