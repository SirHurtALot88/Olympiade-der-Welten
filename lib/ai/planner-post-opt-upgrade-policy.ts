import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { getLeagueMarketAnchorsForState } from "@/lib/ai/ai-market-quality-profile-service";
import {
  resolveTeamSpendableCashForPlanning,
  usesSingleCashPlanningPolicy,
} from "@/lib/ai/planner-cash-buffer-policy";
import { resolvePlannerRosterTargets } from "@/lib/foundation/roster-limits";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function rosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

export type PostOptUpgradeMode = "expand";

export type PostOptUpgradeMandate = {
  active: boolean;
  mode: PostOptUpgradeMode | null;
  maxSells: number;
  maxBuys: number;
  minUpgradeBuyPrice: number | null;
  expandRosterTarget: number | null;
  postOptUpgradeDeploy: boolean;
};

/** S2+: at Opt with spendable cash beyond salary buffer → up to 1–2 on-top buys (fatigue/depth). */
export function resolvePostOptUpgradeMandate(gameState: GameState, teamId: string): PostOptUpgradeMandate {
  const inactive: PostOptUpgradeMandate = {
    active: false,
    mode: null,
    maxSells: 0,
    maxBuys: 0,
    minUpgradeBuyPrice: null,
    expandRosterTarget: null,
    postOptUpgradeDeploy: false,
  };

  if (!usesSingleCashPlanningPolicy(gameState)) {
    return inactive;
  }

  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return inactive;

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt, playerMax, depthRepairMandate } = resolvePlannerRosterTargets(gameState, teamId, team, identity);
  const count = rosterCount(gameState, teamId);

  const salary = getTeamSalarySum(gameState, teamId);
  const cash = team.cash ?? 0;
  const spendable = resolveTeamSpendableCashForPlanning(gameState, teamId, cash);
  const cashSalaryRatio = salary > 0 ? cash / salary : 0;
  const spendableThreshold = depthRepairMandate ? 8 : cashSalaryRatio >= 1.15 ? 6 : 12;

  function buildExcessCashMandate() {
    if (cashSalaryRatio + 0.01 < 1.1 || spendable + 0.01 < 6) return inactive;
    const rosterHeadroom = Math.max(0, playerMax - count);
    const slotsFromExcess = cashSalaryRatio >= 1.5 ? 3 : cashSalaryRatio >= 1.25 ? 2 : 1;
    const gapToOpt = Math.max(0, playerOpt - count);
    const maxBuys = Math.min(
      slotsFromExcess,
      rosterHeadroom > 0 ? rosterHeadroom : 1,
      gapToOpt > 0 ? Math.max(gapToOpt, 1) : slotsFromExcess,
    );
    if (maxBuys <= 0) return inactive;
    const expandTarget = Math.min(playerMax, Math.max(count + maxBuys, playerOpt));
    return {
      active: true,
      mode: "expand" as const,
      maxSells: 0,
      maxBuys,
      minUpgradeBuyPrice: null,
      expandRosterTarget: expandTarget > count ? expandTarget : null,
      postOptUpgradeDeploy: true,
    };
  }

  if (count < playerOpt) {
    if (depthRepairMandate && spendable + 0.01 >= spendableThreshold) {
      const gap = playerOpt - count;
      const maxBuys = Math.min(2, gap);
      if (maxBuys <= 0) return buildExcessCashMandate();
      return {
        active: true,
        mode: "expand",
        maxSells: 0,
        maxBuys,
        minUpgradeBuyPrice: null,
        expandRosterTarget: Math.min(playerMax, count + maxBuys),
        postOptUpgradeDeploy: true,
      };
    }
    return buildExcessCashMandate();
  }

  if (spendable + 0.01 < spendableThreshold && cashSalaryRatio + 0.01 < 1.1) return inactive;

  const rosterHeadroom = Math.max(0, Math.min(playerMax, playerOpt + 2) - count);
  const extraSlots = cashSalaryRatio >= 1.25 || spendable >= 20 ? 2 : 1;
  const expandTarget = Math.min(playerMax, playerOpt + extraSlots);
  const maxBuys =
    rosterHeadroom > 0
      ? Math.min(extraSlots === 2 ? 3 : 2, rosterHeadroom, extraSlots)
      : spendable >= 12
        ? 1
        : 0;

  if (maxBuys <= 0) return buildExcessCashMandate();

  return {
    active: true,
    mode: "expand",
    maxSells: 0,
    maxBuys,
    minUpgradeBuyPrice: null,
    expandRosterTarget: expandTarget > count ? expandTarget : null,
    postOptUpgradeDeploy: true,
  };
}

/** Soft price hint when preview scoring uses upgrade lanes — not a hard session gate. */
export function resolveEffectiveUpgradeBuyPriceFloor(input: {
  gameState: GameState;
  strictFloor: number | null;
  candidatePrices: number[];
  spendableCash: number;
}): number | null {
  if (input.strictFloor == null || input.strictFloor <= 0) return null;
  const strict = input.strictFloor;
  if (input.candidatePrices.some((price) => price + 0.01 >= strict)) {
    return strict;
  }
  const anchors = getLeagueMarketAnchorsForState(input.gameState);
  const relaxed = Math.max(18, anchors.q75Price * 0.85);
  if (
    input.spendableCash + 0.01 >= relaxed &&
    input.candidatePrices.some((price) => price + 0.01 >= relaxed)
  ) {
    return round(relaxed, 2);
  }
  return strict;
}

export function teamHasPostOptUpgradeMandate(gameState: GameState, teamId: string) {
  return resolvePostOptUpgradeMandate(gameState, teamId).active;
}

export function resolvePostOptPlannerRosterTarget(gameState: GameState, teamId: string, playerOpt: number) {
  const mandate = resolvePostOptUpgradeMandate(gameState, teamId);
  if (mandate.expandRosterTarget != null && mandate.expandRosterTarget > playerOpt) {
    return mandate.expandRosterTarget;
  }
  return playerOpt;
}
