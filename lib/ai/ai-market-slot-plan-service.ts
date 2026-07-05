import type { GameState } from "@/lib/data/olyDataTypes";
import {
  resolveTeamLiquidityBufferTarget,
  resolveTeamSpendableCashForPlanning,
  usesSingleCashPlanningPolicy,
} from "@/lib/ai/planner-cash-buffer-policy";
import { resolveMarketSpendableCashForPlanner } from "@/lib/ai/ai-manager-apply-service";
import {
  isTeamRosterBelowOpt,
  projectExpectedSalaryAtPlannerTarget,
  resolveCombinedLiquidityReserve,
  resolveMarketPlannerCashBuffer,
} from "@/lib/ai/ai-team-cash-reserve-service";
import { getTeamObjectiveAiBias } from "@/lib/board/team-season-objectives-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  getBracketBandForPickLane,
  isPriceEligibleForBracketLane,
  type LeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { buildBudgetEnvelope } from "@/lib/ai/market-pick-engine/budget-envelope";

export type MarketPickLane = "superstar" | "star" | "core" | "specialist" | "depth" | "cheap_fill" | "backup";

export type LeagueMarketAnchors = {
  q25Price: number;
  q50Price: number;
  q65Price: number;
  q75Price: number;
  q85Price: number;
  q90Price: number;
  q95Price: number;
};

export type MarketLaneBand = {
  lane: MarketPickLane;
  floorMW: number;
  ceilingMW: number;
};

export type MarketSlotWish = {
  lane: MarketPickLane;
  floorMW: number;
  ceilingMW: number;
  priority: number;
};

export type MarketAnchoredSlotPlanInput = {
  spendable: number;
  rosterCount: number;
  playerMin: number;
  playerOpt: number;
  steps: number;
  missingToMin: number;
  rosterGap: number;
  starAllowed: number;
  superstarAllowed: number;
  coreNeeded: number;
  specialistNeeded: number;
  anchors: LeagueMarketAnchors;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function quantile(values: Array<number | null | undefined>, ratio: number) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const index = clamp(Math.floor((finite.length - 1) * ratio), 0, finite.length - 1);
  return finite[index] ?? 0;
}

export function buildLeagueMarketAnchors(prices: Array<number | null | undefined>): LeagueMarketAnchors {
  const q50 = quantile(prices, 0.5);
  return {
    q25Price: quantile(prices, 0.25) || q50 * 0.75,
    q50Price: q50,
    q65Price: quantile(prices, 0.65) || q50 * 1.15,
    q75Price: quantile(prices, 0.75) || q50 * 1.3,
    q85Price: quantile(prices, 0.85) || q50 * 1.45,
    q90Price: quantile(prices, 0.9) || q50 * 1.55,
    q95Price: quantile(prices, 0.95) || q50 * 1.7,
  };
}

export function getMarketLaneBand(
  lane: MarketPickLane,
  anchors: LeagueMarketAnchors,
  brackets?: LeagueMarketBrackets,
): MarketLaneBand {
  const resolved =
    brackets ??
    buildLeagueMarketBrackets([
      anchors.q25Price,
      anchors.q50Price,
      anchors.q65Price,
      anchors.q75Price,
      anchors.q85Price,
      anchors.q90Price,
      anchors.q95Price,
    ]);
  return getBracketBandForPickLane(lane, resolved);
}

export type MarketTierLabel = "Superstar" | "Star" | "Core" | "Depth" | "Fill" | "Backup";

export function classifyMarketTier(price: number | null, anchors: LeagueMarketAnchors): MarketTierLabel {
  const brackets = buildLeagueMarketBrackets([
    anchors.q25Price,
    anchors.q50Price,
    anchors.q65Price,
    anchors.q75Price,
    anchors.q85Price,
    anchors.q90Price,
    anchors.q95Price,
  ]);
  const tier = classifyMarketBracket(price, brackets);
  if (tier === "Reserve") return "Backup";
  if (tier === "Backup") return "Fill";
  return tier;
}

export function resolvePlannerSpendableCash(gameState: GameState, teamId: string, cash?: number | null) {
  return resolveSimulatedPlannerSpendableCash({
    gameState,
    teamId,
    teamCash: cash ?? gameState.teams.find((entry) => entry.teamId === teamId)?.cash ?? 0,
    simulatedRosterCount: gameState.rosters.filter((entry) => entry.teamId === teamId).length,
    simulatedSalaryTotal: null,
  });
}

/** Mirrors execute-time buy affordability using simulated draft cash/roster state. */
export function resolveSimulatedPlannerSpendableCash(input: {
  gameState: GameState;
  teamId: string;
  teamCash: number;
  simulatedRosterCount: number;
  simulatedSalaryTotal?: number | null;
}) {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);
  const { playerOpt, playerMin } = deriveRosterTargets(team, identity);
  const rosterBelowMin = playerMin != null && input.simulatedRosterCount < playerMin;
  const belowOpt = input.simulatedRosterCount < playerOpt;

  if (usesSingleCashPlanningPolicy(input.gameState)) {
    if (rosterBelowMin) {
      const minPad = round(Math.max(3, Math.min(15, input.teamCash * 0.05)), 2);
      return round(Math.max(0, input.teamCash - minPad), 2);
    }
    return resolveTeamSpendableCashForPlanning(input.gameState, input.teamId, input.teamCash);
  }

  if (input.gameState.seasonState.aiManagerBudgetReservations?.[input.teamId]) {
    return resolveMarketSpendableCashForPlanner({
      gameState: input.gameState,
      teamId: input.teamId,
      teamCash: input.teamCash,
      rosterBelowMin,
      forceRosterFill: belowOpt,
    });
  }

  if (belowOpt || rosterBelowMin) {
    const expectedSalary =
      input.simulatedSalaryTotal != null && input.simulatedSalaryTotal > 0 && input.simulatedRosterCount > 0
        ? (() => {
            const avgSalary = input.simulatedSalaryTotal! / input.simulatedRosterCount;
            const missing = Math.max(0, playerOpt - input.simulatedRosterCount);
            const finances = identity?.finances ?? 5;
            const salaryFloor = playerOpt * (3.6 + finances * 0.1);
            return round(Math.max(input.simulatedSalaryTotal! + avgSalary * missing, salaryFloor), 2);
          })()
        : projectExpectedSalaryAtPlannerTarget(input.gameState, input.teamId, playerOpt);

    const objectiveBias = getTeamObjectiveAiBias(input.gameState, input.teamId);
    const liquidity = resolveCombinedLiquidityReserve({
      gameState: input.gameState,
      teamId: input.teamId,
      expectedSalaryAfterPlan: expectedSalary,
      rosterBelowOpt: belowOpt,
      buyAggression: objectiveBias?.buyAggression,
    });
    const emergencyPad = round(Math.max(5, input.teamCash * 0.08), 2);
    return round(Math.max(0, input.teamCash - liquidity.salaryReserve - liquidity.cashReserve - emergencyPad), 2);
  }

  const reserve = resolveMarketPlannerCashBuffer(input.gameState, input.teamId);
  return round(Math.max(0, input.teamCash - reserve), 2);
}

/** @deprecated Prefer buildBudgetEnvelope from market-pick-engine. Premium-first slot plan. */
export function buildMarketAnchoredSlotPlan(input: MarketAnchoredSlotPlanInput): MarketPickLane[] {
  const profile = {
    playerMin: input.playerMin,
    identityPlayerOpt: input.playerOpt,
    effectiveOptTarget: input.playerOpt,
    comfortTarget: input.playerOpt,
    optFlexSlots: 0,
    starChaser: input.starAllowed > 0 || input.superstarAllowed > 0,
    starAllowed: input.starAllowed,
    superstarAllowed: input.superstarAllowed,
    coreNeeded: input.coreNeeded,
    premiumFirst: input.starAllowed > 0 || input.superstarAllowed > 0,
    qualityFloorMw: input.anchors.q25Price,
    disableCheapLanes: false,
    pickPhase: input.missingToMin > 0 ? ("fill_to_opt" as const) : ("post_opt_upgrade" as const),
  };

  const envelope = buildBudgetEnvelope({
    spendable: input.spendable,
    rosterGap: input.rosterGap,
    missingToMin: input.missingToMin,
    steps: input.steps,
    profile,
    starAllowed: input.starAllowed,
    superstarAllowed: input.superstarAllowed,
    coreNeeded: input.coreNeeded,
    specialistNeeded: input.specialistNeeded,
    faPrices: [
      input.anchors.q25Price,
      input.anchors.q50Price,
      input.anchors.q65Price,
      input.anchors.q75Price,
      input.anchors.q85Price,
      input.anchors.q90Price,
      input.anchors.q95Price,
    ],
  });

  return envelope.slotSequence;
}

export function isPriceEligibleForMarketLane(price: number | null, lane: MarketPickLane, anchors: LeagueMarketAnchors) {
  const brackets = buildLeagueMarketBrackets([
    anchors.q25Price,
    anchors.q50Price,
    anchors.q65Price,
    anchors.q75Price,
    anchors.q85Price,
    anchors.q90Price,
    anchors.q95Price,
  ]);
  return isPriceEligibleForBracketLane(price, lane, brackets);
}

export function shouldDisableCheapLanes(
  spendable: number,
  anchors: LeagueMarketAnchors,
  rosterAtOrAboveMin: boolean,
  opts?: { forceDisableCheap?: boolean },
) {
  if (opts?.forceDisableCheap) return true;
  if (rosterAtOrAboveMin && spendable + 0.01 >= anchors.q65Price) return true;
  return rosterAtOrAboveMin && spendable >= getMarketLaneBand("depth", anchors).floorMW;
}
