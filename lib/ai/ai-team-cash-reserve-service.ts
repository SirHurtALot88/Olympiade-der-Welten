import type { GameState } from "@/lib/data/olyDataTypes";
import {
  resolveHoardTighteningMultiplier,
} from "@/lib/ai/ai-cash-salary-target-service";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { countTeamInjuredPlayers } from "@/lib/fatigue/fatigue-injury-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import {
  resolveTeamLiquidityBufferTarget,
  usesSingleCashPlanningPolicy,
  PLANNER_LIQUIDITY_BUFFER_MIN,
} from "@/lib/ai/planner-cash-buffer-policy";
import { resolvePostOptPlannerRosterTarget } from "@/lib/ai/planner-post-opt-upgrade-policy";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getTeamObjectiveAiBias } from "@/lib/board/team-season-objectives-service";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTeamRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

export function isTeamRosterBelowOpt(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  return getTeamRosterCount(gameState, teamId) < playerOpt;
}

/** Cash runway buffer for market buys — zero while rebuilding below identity Opt. */
export function resolveMarketPlannerCashBuffer(
  gameState: GameState,
  teamId: string,
  opts?: { coverageFallback?: boolean; expectedSalaryAfterPlan?: number },
) {
  if (opts?.coverageFallback) return 0;
  if (isTeamRosterBelowOpt(gameState, teamId)) return 0;
  if (usesSingleCashPlanningPolicy(gameState)) {
    return resolveTeamLiquidityBufferTarget(gameState, teamId);
  }
  return resolveTeamCashRunwayReserve(gameState, teamId, {
    expectedSalaryAfterPlan: opts?.expectedSalaryAfterPlan,
  });
}

function getTeamRosterSalarySum(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        if (!player) return sum + (entry.salary ?? 0);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.salary ?? entry.salary ?? 0);
      }, 0),
  );
}

export function projectExpectedSalaryAtPlannerTarget(
  gameState: GameState,
  teamId: string,
  plannerTarget?: number,
) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  const target = plannerTarget ?? playerOpt;
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const currentSalary = getTeamRosterSalarySum(gameState, teamId);
  const finances = identity?.finances ?? 5;
  const salaryFloor = target * (3.6 + finances * 0.1);
  if (rosterCount <= 0) return round(Math.max(salaryFloor, currentSalary), 2);
  const avgSalary = currentSalary / rosterCount;
  const missing = Math.max(0, target - rosterCount);
  return round(Math.max(currentSalary + avgSalary * missing, salaryFloor), 2);
}

export function resolveHoardMultiplier(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const profile = getTeamStrategyProfile(gameState, teamId);
  const cashPriority = profile?.bias.cashPriority ?? 5;
  const finances = identity?.finances ?? 5;
  const financeCap = clamp(0.35 + (finances / 10) * 0.35, 0.35, 0.7);
  return clamp(0.25 + (cashPriority / 10) * 0.25 + (finances / 10) * 0.3, 0.25, financeCap);
}

export function resolveTeamCashRunwayReserve(
  gameState: GameState,
  teamId: string,
  opts?: { expectedSalaryAfterPlan?: number },
) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  const expectedSalary =
    opts?.expectedSalaryAfterPlan ?? projectExpectedSalaryAtPlannerTarget(gameState, teamId, playerOpt);
  const hoardMultiplier = resolveHoardMultiplier(gameState, teamId);
  const cashSalaryRatio =
    expectedSalary > 0 ? (team?.cash ?? 0) / expectedSalary : 0;
  const hoardTightening = resolveHoardTighteningMultiplier(
    gameState,
    teamId,
    gameState.season.id,
    cashSalaryRatio,
  );
  const facilityPreview = previewFacilitySeasonEndFinance(
    {
      saveId: "reserve-preview",
      name: "Cash Reserve Preview",
      status: "active",
      createdAt: "",
      updatedAt: "",
      gameState,
    },
    teamId,
  );
  const maintenancePad = round(Math.max(5, (facilityPreview.facilityUpkeepTotal ?? 0) * 0.5), 2);
  let reserve = round(expectedSalary * hoardMultiplier * hoardTightening + maintenancePad, 2);
  const rosterCount = getTeamRosterCount(gameState, teamId);
  if (rosterCount < playerOpt) {
    reserve = round(Math.max(5, Math.min(reserve * 0.45, reserve - 10)), 2);
  }
  return reserve;
}

/**
 * Share of the combined liquidity reserve (salary runway + cash buffer) to keep protected
 * during draft/rebuild. Lower = more cash unlocked for transfers. Aggressive and cash-poor
 * teams get factors near 0; conservative rich teams keep more back.
 */
export function resolveDraftLiquidityReserveFactor(input: {
  gameState: GameState;
  teamId: string;
  cash: number;
  expectedSalary: number;
  buyAggression?: number;
  rosterBelowOpt?: boolean;
}) {
  const profile = getTeamStrategyProfile(input.gameState, input.teamId);
  const objectiveBias = getTeamObjectiveAiBias(input.gameState, input.teamId);
  const buyAggression = clamp((input.buyAggression ?? objectiveBias?.buyAggression ?? 0) / 10, 0, 1);
  const starPriority = clamp((profile?.bias.starPriority ?? 5) / 10, 0, 1);
  const riskTolerance = clamp((profile?.bias.riskTolerance ?? 5) / 10, 0, 1);
  const cashPriority = clamp((profile?.bias.cashPriority ?? 5) / 10, 0, 1);
  const spendAggression =
    profile?.spendAggression === "high" ? 0.9 : profile?.spendAggression === "low" ? 0.15 : 0.45;

  const cashSalaryRatio = input.expectedSalary > 0 ? input.cash / input.expectedSalary : 1;
  const tightnessFactor = clamp(0.1 + cashSalaryRatio * 0.38, 0.06, 0.78);

  const ranked = input.gameState.teams
    .map((team) => ({ teamId: team.teamId, cash: team.cash ?? 0 }))
    .sort((left, right) => left.cash - right.cash || left.teamId.localeCompare(right.teamId));
  const rank = ranked.findIndex((entry) => entry.teamId === input.teamId);
  const rankRatio = ranked.length > 1 && rank >= 0 ? rank / (ranked.length - 1) : 0.5;
  const rankRelief = 1 - rankRatio * 0.6;

  const aggressionRelief = 1 - clamp(
    buyAggression * 0.7 + starPriority * 0.22 + riskTolerance * 0.12 + spendAggression * 0.18 - cashPriority * 0.24,
    0,
    0.95,
  );

  let factor = tightnessFactor * rankRelief * aggressionRelief;
  if (input.rosterBelowOpt) {
    factor = clamp(factor, 0.02, 0.5);
  } else {
    factor = clamp(factor, 0.35, 0.95);
  }
  return round(factor, 3);
}

/** Combined emergency/liquidity pool — salary runway plus any cash buffer, as one drawable reserve. */
export function resolveCombinedLiquidityReserve(input: {
  gameState: GameState;
  teamId: string;
  expectedSalaryAfterPlan: number;
  rosterBelowOpt: boolean;
  buyAggression?: number;
}) {
  const fullRunway = resolveTeamCashRunwayReserve(input.gameState, input.teamId, {
    expectedSalaryAfterPlan: input.expectedSalaryAfterPlan,
  });
  if (!input.rosterBelowOpt) {
    const cashBuffer = round(Math.max(5, fullRunway * 0.08), 2);
    return {
      salaryReserve: fullRunway,
      cashReserve: cashBuffer,
      fullRunway,
      reserveFactor: 1,
    };
  }
  const reserveFactor = resolveDraftLiquidityReserveFactor({
    gameState: input.gameState,
    teamId: input.teamId,
    cash: input.gameState.teams.find((team) => team.teamId === input.teamId)?.cash ?? 0,
    expectedSalary: input.expectedSalaryAfterPlan,
    buyAggression: input.buyAggression,
    rosterBelowOpt: true,
  });
  const protectedLiquidity = round(Math.max(1, fullRunway * reserveFactor), 2);
  return {
    salaryReserve: protectedLiquidity,
    cashReserve: 0,
    fullRunway,
    reserveFactor,
  };
}

function countTeamFatigueStress(gameState: GameState, teamId: string) {
  const players = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const fatigued = players.filter((player) => (player.fatigue ?? 0) >= 65).length;
  const injured = countTeamInjuredPlayers(gameState, teamId);
  return { fatigued, injured };
}

export function getTeamPlannerRosterTarget(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerMin, playerOpt, playerMax } = deriveRosterTargets(team, identity);
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const strategy = buildSeasonStrategyState(gameState)[teamId]?.seasonStrategy ?? "balanced_growth";
  const cash = team?.cash ?? 0;

  if (strategy === "cash_recovery" && cash < 0) {
    return playerMin;
  }

  let target = playerOpt;
  target = resolvePostOptPlannerRosterTarget(gameState, teamId, playerOpt);
  const { fatigued, injured } = countTeamFatigueStress(gameState, teamId);
  if (fatigued >= 1 || injured >= 1) {
    target = Math.min(playerMax, Math.max(target, playerOpt));
  }
  if (fatigued >= 2 || injured >= 2) {
    target = Math.min(playerMax, target + 1);
  }

  const expectedSalary = projectExpectedSalaryAtPlannerTarget(gameState, teamId, playerOpt);
  const reserve = resolveTeamCashRunwayReserve(gameState, teamId, { expectedSalaryAfterPlan: expectedSalary });
  const transferBudget = gameState.seasonState.aiManagerBudgetReservations?.[teamId]?.transferBudget ?? 0;
  const spendable = round(Math.max(0, cash - reserve), 2);
  const cashTight = cash < reserve || (transferBudget > 0 && transferBudget < 6);
  if (rosterCount < playerOpt) {
    return Math.max(playerMin, Math.min(playerMax, playerOpt));
  }
  if (cashTight && rosterCount >= playerMin && spendable < 6 && fatigued < 2 && injured < 2) {
    target = Math.max(playerMin, target - 1);
  }

  return Math.max(playerMin, Math.min(playerMax, target));
}

export function teamHasCashBufferRebuildFocus(gameState: GameState, teamId: string) {
  return Boolean(gameState.seasonState.aiCashBufferDipLedger?.[teamId]?.rebuildFocusActive);
}

export function resolveTransferAffordableBudget(input: {
  teamCash: number;
  cashReservePct: number;
  spendableBudget?: number | null;
  gameState?: GameState;
  teamId?: string;
  rosterBelowOpt?: boolean;
}) {
  if (input.spendableBudget != null && Number.isFinite(input.spendableBudget) && input.spendableBudget > 0) {
    return input.spendableBudget;
  }
  const reservation =
    input.teamId != null
      ? input.gameState?.seasonState.aiManagerBudgetReservations?.[input.teamId] ?? null
      : null;
  if (reservation?.transferBudget != null && reservation.transferBudget > 0) {
    return reservation.transferBudget;
  }
  const standardBudget = input.teamCash * (1 - input.cashReservePct);
  if (!input.gameState || !input.teamId || !input.rosterBelowOpt) {
    return standardBudget;
  }
  const bufferTarget = resolveTeamLiquidityBufferTarget(input.gameState, input.teamId);
  const bufferFloor = round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, bufferTarget * 0.15), 2);
  const emergencyBudget = round(Math.max(0, input.teamCash - bufferFloor), 2);
  return Math.max(standardBudget, emergencyBudget);
}

export function recordCashBufferDipIfNeeded(
  gameState: GameState,
  teamId: string,
  seasonId: string,
): GameState {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return gameState;
  const bufferTarget = resolveTeamLiquidityBufferTarget(gameState, teamId);
  const cashAfter = team.cash ?? 0;
  if (cashAfter >= bufferTarget - 0.01) return gameState;

  const dipped = round(Math.max(0, bufferTarget - cashAfter), 2);
  const ledger = { ...(gameState.seasonState.aiCashBufferDipLedger ?? {}) };
  const previous = ledger[teamId];
  const dipCount = (previous?.dipCount ?? 0) + 1;
  ledger[teamId] = {
    teamId,
    seasonId,
    dipCount,
    totalDipped: round((previous?.totalDipped ?? 0) + dipped, 2),
    lastAt: new Date().toISOString(),
    rebuildFocusActive: dipCount >= 1,
  };
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      aiCashBufferDipLedger: ledger,
    },
  };
}
