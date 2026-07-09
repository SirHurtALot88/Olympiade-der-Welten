import type { Team } from "@/lib/data/olyDataTypes";

import {
  getSeason1BudgetTier,
  isSeason1TopOrUpperBudgetTeam,
  normalizeManagementValue,
  normalizeTeamCode,
} from "@/lib/ai/season1-draft-spend-policy";

/** Absolute max cash after S1 draft: 1.25× roster salary sum (unless min-roster blocked). */
export const DRAFT_MAX_CASH_TO_SALARY_RATIO = 1.25;

/**
 * Hard ceiling for S2+ preseason / market buys (planner buffer): never hold more than 1.0×
 * actual roster salary. Soft objective is team-aware 0.25–0.75× (soft target).
 */
export const POSTSEASON_MAX_CASH_TO_SALARY_RATIO = 1.0;

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveDraftMaxCashAllowed(
  salaryTotal: number,
  maxCashSalaryRatio: number = DRAFT_MAX_CASH_TO_SALARY_RATIO,
) {
  if (salaryTotal <= 0) {
    return null;
  }
  const ratio =
    Number.isFinite(maxCashSalaryRatio) && maxCashSalaryRatio > 0
      ? maxCashSalaryRatio
      : DRAFT_MAX_CASH_TO_SALARY_RATIO;
  return roundValue(salaryTotal * ratio, 2);
}

export function resolveDraftCashSalaryRatio(cash: number, salaryTotal: number) {
  if (salaryTotal <= 0) {
    return null;
  }
  return roundValue(cash / salaryTotal, 3);
}

export function isDraftCashSalaryRatioOverCap(
  cash: number,
  salaryTotal: number,
  maxCashSalaryRatio: number = DRAFT_MAX_CASH_TO_SALARY_RATIO,
) {
  const ratio = resolveDraftCashSalaryRatio(cash, salaryTotal);
  const cap =
    Number.isFinite(maxCashSalaryRatio) && maxCashSalaryRatio > 0
      ? maxCashSalaryRatio
      : DRAFT_MAX_CASH_TO_SALARY_RATIO;
  return ratio != null && ratio > cap + 0.001;
}

/**
 * Spend pressure when cash/salary exceeds the soft target (or hard cap when no soft is set):
 * 0 at soft, approaches 1 near/above the hard ceiling.
 */
export function resolveDraftCashSalarySpendPressure(
  cash: number,
  salaryTotal: number,
  options?: { softRatio?: number | null; hardRatio?: number | null },
) {
  const ratio = resolveDraftCashSalaryRatio(cash, salaryTotal);
  const hard =
    options?.hardRatio != null && options.hardRatio > 0
      ? options.hardRatio
      : DRAFT_MAX_CASH_TO_SALARY_RATIO;
  const soft =
    options?.softRatio != null && options.softRatio > 0
      ? options.softRatio
      : hard;
  if (ratio == null || ratio <= soft) {
    return 0;
  }
  const span = Math.max(hard - soft, 0.25);
  return roundValue(clamp((ratio - soft) / span, 0, 1), 3);
}

export function resolveSeason1DraftSalaryForRatio(
  actualSalary: number | null | undefined,
  estimatedSalaryTotal: number | null | undefined,
) {
  if (actualSalary != null && actualSalary > 0) {
    return actualSalary;
  }
  if (estimatedSalaryTotal != null && estimatedSalaryTotal > 0) {
    return estimatedSalaryTotal;
  }
  return null;
}

/** High-finances teams keep a smaller salary float (0.5x); others up to 1.0x projected salary. */
export function resolveSeason1SalaryBufferMultiplier(finances?: number | null) {
  const financesValue = normalizeManagementValue(finances ?? 55);
  return roundValue(clamp(1 - financesValue * 0.5, 0.5, 1), 3);
}

export function estimateSeason1DraftSalaryTotal(input: { anchorsQ50Price: number; plannedRosterSize: number }) {
  const perPlayerSalary = Math.max(4, input.anchorsQ50Price * 0.24);
  return roundValue(perPlayerSalary * Math.max(1, input.plannedRosterSize), 2);
}

/**
 * End-of-draft cash buffer: corridor target (e.g. 7% left at 93% spend) capped by salary float.
 * Prevents top-budget teams from hoarding 100+ when finances are strong.
 *
 * S2+ preseason: pass `softTargetCashSalaryRatio` (0.25–0.75) so remaining cash aims at
 * salary × softTarget, and `maxCashSalaryRatio` (1.0) as the absolute ceiling.
 */
export function resolveSeason1TargetCashLeft(input: {
  startingCash: number;
  spendTargetPct: number;
  finances?: number | null;
  estimatedSalaryTotal?: number | null;
  softTargetCashSalaryRatio?: number | null;
  maxCashSalaryRatio?: number | null;
}) {
  const corridorLeft = input.startingCash * (1 - input.spendTargetPct);
  const salaryTotal = input.estimatedSalaryTotal ?? 0;
  if (salaryTotal <= 0) {
    return roundValue(corridorLeft, 2);
  }
  const maxRatio =
    input.maxCashSalaryRatio != null && input.maxCashSalaryRatio > 0
      ? input.maxCashSalaryRatio
      : DRAFT_MAX_CASH_TO_SALARY_RATIO;
  const maxCashLeft = salaryTotal * maxRatio;
  if (input.softTargetCashSalaryRatio != null && input.softTargetCashSalaryRatio > 0) {
    const softCashLeft = salaryTotal * input.softTargetCashSalaryRatio;
    const softFloor = salaryTotal * Math.max(0.22, input.softTargetCashSalaryRatio - 0.03);
    return roundValue(clamp(softCashLeft, softFloor, maxCashLeft), 2);
  }
  const salaryBuffered = salaryTotal * resolveSeason1SalaryBufferMultiplier(input.finances);
  return roundValue(Math.min(corridorLeft, salaryBuffered, maxCashLeft), 2);
}

/** Transfer-fee pool for lane splits after salary float + minimum reserve. */
export function resolveSeason1LaneSpendPool(input: {
  startingCash: number;
  spendTargetPct: number;
  reservedCashForMinimum?: number | null;
}) {
  return roundValue(Math.max(0, input.startingCash * input.spendTargetPct - (input.reservedCashForMinimum ?? 0)), 2);
}

/** Total draft transfer spend baked into lane budgets: starting cash minus end-cash target (1.25× cap aware). */
export function resolveSeason1DraftSpendBudget(input: { startingCash: number; targetCashLeft: number }) {
  return roundValue(Math.max(0, input.startingCash - input.targetCashLeft), 2);
}

/**
 * Single upfront spend plan for a Season-1 draft: computed once per team (and refreshed once
 * per pick-loop step when real remaining salary becomes known) so every reactive consumer
 * (blockers, force-spend candidate search, corridor checks) reads the same numbers instead of
 * re-deriving "how much should be spent by now" with its own formula.
 */
export type Season1DraftSpendPlan = {
  startingCash: number;
  spendTargetPct: number;
  estimatedSalaryTotal: number | null;
  /** End-of-draft cash floor (salary-buffer + soft/hard cash-salary aware). */
  targetCashLeft: number;
  /** startingCash - targetCashLeft; total transfer spend the plan expects across all lanes. */
  totalSpendBudget: number;
  maxCashAllowed: number | null;
  cashSalaryRatio: number | null;
  /** Soft cash/salary objective (S2+: 0.25–0.75); null for S1 draft. */
  softTargetCashSalaryRatio: number | null;
  /** Hard cash/salary ceiling (S1: 1.25, S2+: 1.0). */
  maxCashSalaryRatio: number;
  /** True once remaining cash sits meaningfully above soft target / corridor / hard cap. */
  mustSpendDown: boolean;
};

export function buildSeason1DraftSpendPlan(input: {
  startingCash: number;
  spendTargetPct: number;
  finances?: number | null;
  estimatedSalaryTotal?: number | null;
  remainingCash?: number | null;
  softTargetCashSalaryRatio?: number | null;
  maxCashSalaryRatio?: number | null;
}): Season1DraftSpendPlan {
  const estimatedSalaryTotal =
    input.estimatedSalaryTotal != null && input.estimatedSalaryTotal > 0 ? input.estimatedSalaryTotal : null;
  const maxCashSalaryRatio =
    input.maxCashSalaryRatio != null && input.maxCashSalaryRatio > 0
      ? input.maxCashSalaryRatio
      : DRAFT_MAX_CASH_TO_SALARY_RATIO;
  const softTargetCashSalaryRatio =
    input.softTargetCashSalaryRatio != null && input.softTargetCashSalaryRatio > 0
      ? input.softTargetCashSalaryRatio
      : null;
  const targetCashLeft = resolveSeason1TargetCashLeft({
    startingCash: input.startingCash,
    spendTargetPct: input.spendTargetPct,
    finances: input.finances,
    estimatedSalaryTotal,
    softTargetCashSalaryRatio,
    maxCashSalaryRatio,
  });
  const totalSpendBudget = resolveSeason1DraftSpendBudget({ startingCash: input.startingCash, targetCashLeft });
  const maxCashAllowed =
    estimatedSalaryTotal != null ? resolveDraftMaxCashAllowed(estimatedSalaryTotal, maxCashSalaryRatio) : null;
  const remainingCash = input.remainingCash ?? null;
  const cashSalaryRatio =
    remainingCash != null && estimatedSalaryTotal != null
      ? resolveDraftCashSalaryRatio(remainingCash, estimatedSalaryTotal)
      : null;
  const overHardCap =
    remainingCash != null &&
    estimatedSalaryTotal != null &&
    isDraftCashSalaryRatioOverCap(remainingCash, estimatedSalaryTotal, maxCashSalaryRatio);
  const overSoftTarget =
    remainingCash != null &&
    estimatedSalaryTotal != null &&
    softTargetCashSalaryRatio != null &&
    remainingCash > estimatedSalaryTotal * softTargetCashSalaryRatio + Math.max(input.startingCash * 0.01, 4);
  const mustSpendDown =
    remainingCash != null &&
    (overHardCap ||
      overSoftTarget ||
      remainingCash > targetCashLeft + Math.max(input.startingCash * 0.015, 6));
  return {
    startingCash: input.startingCash,
    spendTargetPct: input.spendTargetPct,
    estimatedSalaryTotal,
    targetCashLeft,
    totalSpendBudget,
    maxCashAllowed,
    cashSalaryRatio,
    softTargetCashSalaryRatio,
    maxCashSalaryRatio,
    mustSpendDown,
  };
}

/**
 * Minimum price a pick should hit, given remaining picks, to stay on pace toward the plan's
 * target cash left. Shared by the cheap-pick blocker and the force-spend candidate search so
 * both use the same pacing math instead of two independently tuned formulas.
 */
export function resolveMinPickPriceForPlan(
  plan: Pick<Season1DraftSpendPlan, "targetCashLeft">,
  input: { remainingCash: number; picksLeft: number },
) {
  const remainingSpendToTarget = Math.max(input.remainingCash - plan.targetCashLeft, 0);
  return roundValue(remainingSpendToTarget / Math.max(input.picksLeft, 1), 2);
}

export type Season1DraftLane =
  | "superstar"
  | "star"
  | "core"
  | "specialist"
  | "depth"
  | "cheap_fill"
  | "backup";

const SEASON1_DRAFT_LANES: Season1DraftLane[] = [
  "cheap_fill",
  "backup",
  "depth",
  "specialist",
  "core",
  "star",
  "superstar",
];

/** Split draft spend budget across lane types proportional to slot count × lane weight. */
export function distributeSeason1LaneSpendCaps(input: {
  spendBudget: number;
  slotCounts: Record<Season1DraftLane, number>;
  laneWeights: Record<Season1DraftLane, number>;
  lanePriceFloors?: Partial<Record<Season1DraftLane, number>>;
}) {
  const emptyCaps = Object.fromEntries(SEASON1_DRAFT_LANES.map((lane) => [lane, 0])) as Record<
    Season1DraftLane,
    number
  >;

  if (input.spendBudget <= 0) {
    return { spendCaps: emptyCaps, sumSpendCaps: 0 };
  }

  let totalWeight = 0;
  for (const lane of SEASON1_DRAFT_LANES) {
    const count = input.slotCounts[lane] ?? 0;
    if (count > 0) {
      totalWeight += (input.laneWeights[lane] ?? 0) * count;
    }
  }

  if (totalWeight <= 0) {
    return { spendCaps: emptyCaps, sumSpendCaps: 0 };
  }

  const spendCaps = { ...emptyCaps };
  for (const lane of SEASON1_DRAFT_LANES) {
    const count = input.slotCounts[lane] ?? 0;
    if (count <= 0) {
      continue;
    }
    const proportional = (input.spendBudget * (input.laneWeights[lane] ?? 0) * count) / totalWeight;
    const floor = (input.lanePriceFloors?.[lane] ?? 0) * count;
    spendCaps[lane] = roundValue(Math.max(floor, proportional), 2);
  }

  let sumSpendCaps = roundValue(
    SEASON1_DRAFT_LANES.reduce((sum, lane) => sum + spendCaps[lane], 0),
    2,
  );

  if (sumSpendCaps > input.spendBudget + 0.01) {
    const premiumLanes: Season1DraftLane[] = ["star", "superstar"];
    const protectedTotal = premiumLanes.reduce((sum, lane) => {
      const count = input.slotCounts[lane] ?? 0;
      if (count <= 0) {
        return sum;
      }
      const floor = (input.lanePriceFloors?.[lane] ?? 0) * count;
      return sum + floor;
    }, 0);
    const scalableBudget = Math.max(input.spendBudget - protectedTotal, 0);
    const scalableTotal = roundValue(sumSpendCaps - protectedTotal, 2);
    if (scalableTotal > 0) {
      const scale = scalableBudget / scalableTotal;
      for (const lane of SEASON1_DRAFT_LANES) {
        const count = input.slotCounts[lane] ?? 0;
        if (count <= 0) {
          continue;
        }
        if (premiumLanes.includes(lane)) {
          const floor = (input.lanePriceFloors?.[lane] ?? 0) * count;
          spendCaps[lane] = roundValue(Math.max(floor, spendCaps[lane]), 2);
          continue;
        }
        spendCaps[lane] = roundValue(spendCaps[lane] * scale, 2);
      }
    } else {
      const scale = input.spendBudget / sumSpendCaps;
      for (const lane of SEASON1_DRAFT_LANES) {
        spendCaps[lane] = roundValue(spendCaps[lane] * scale, 2);
      }
    }
    sumSpendCaps = roundValue(
      SEASON1_DRAFT_LANES.reduce((sum, lane) => sum + spendCaps[lane], 0),
      2,
    );
  }

  return { spendCaps, sumSpendCaps };
}

/** Extra draft steps when top teams should spend down excess budget (on top of base steps). */
export function resolveSeason1BonusDraftSteps(team: Pick<Team, "budget" | "shortCode" | "teamId">) {
  if (!isSeason1TopOrUpperBudgetTeam(team)) {
    return 0;
  }
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  if (code === "C-S" || code === "G-G" || code === "Z-H") {
    return 2;
  }
  return getSeason1BudgetTier(team) === "top" ? 1 : 0;
}

export type Season1DraftCashSalaryCapAdjustments = {
  shouldSaveCash: boolean;
  spendFactor: number | null;
  overspendTolerance: number;
  minCashBuffer: number | null;
  season1TargetCashLeft: number | null;
  allowedBudgetForSearch: number | null;
  maxSpendPerPick: number | null;
  cashSalarySpendPressure: number;
  cashSalaryRatio: number | null;
};

/** Boost spend appetite when cash/salary exceeds the soft target / hard ceiling. */
export function applySeason1DraftCashSalaryCapAdjustments(input: {
  remainingCash: number | null;
  salaryForRatio: number | null;
  season1TargetCashLeft: number | null;
  shouldSaveCash: boolean;
  spendFactor: number | null;
  overspendTolerance: number;
  minCashBuffer: number | null;
  allowedBudgetForSearch: number | null;
  maxSpendPerPick: number | null;
  availableCashForCurrentPick: number | null;
  anchorsQ50Price?: number | null;
  softTargetCashSalaryRatio?: number | null;
  maxCashSalaryRatio?: number | null;
}): Season1DraftCashSalaryCapAdjustments {
  const cash = input.remainingCash ?? 0;
  const salary = input.salaryForRatio ?? 0;
  const maxCashSalaryRatio =
    input.maxCashSalaryRatio != null && input.maxCashSalaryRatio > 0
      ? input.maxCashSalaryRatio
      : DRAFT_MAX_CASH_TO_SALARY_RATIO;
  const softTargetCashSalaryRatio =
    input.softTargetCashSalaryRatio != null && input.softTargetCashSalaryRatio > 0
      ? input.softTargetCashSalaryRatio
      : null;
  const cashSalaryRatio = resolveDraftCashSalaryRatio(cash, salary);
  const cashSalarySpendPressure =
    cash > 0 && salary > 0
      ? resolveDraftCashSalarySpendPressure(cash, salary, {
          softRatio: softTargetCashSalaryRatio,
          hardRatio: maxCashSalaryRatio,
        })
      : 0;
  const maxCashAllowed = resolveDraftMaxCashAllowed(salary, maxCashSalaryRatio);

  let shouldSaveCash = input.shouldSaveCash;
  let spendFactor = input.spendFactor;
  let overspendTolerance = input.overspendTolerance;
  let minCashBuffer = input.minCashBuffer;
  let season1TargetCashLeft = input.season1TargetCashLeft;
  let allowedBudgetForSearch = input.allowedBudgetForSearch;
  let maxSpendPerPick = input.maxSpendPerPick;

  if (maxCashAllowed != null) {
    season1TargetCashLeft =
      season1TargetCashLeft == null
        ? maxCashAllowed
        : roundValue(Math.min(season1TargetCashLeft, maxCashAllowed), 2);
  }
  if (softTargetCashSalaryRatio != null && salary > 0) {
    const softCashLeft = salary * softTargetCashSalaryRatio;
    const softFloor = salary * Math.max(0.22, softTargetCashSalaryRatio - 0.03);
    season1TargetCashLeft =
      season1TargetCashLeft == null
        ? roundValue(softCashLeft, 2)
        : roundValue(Math.max(season1TargetCashLeft, softFloor), 2);
    minCashBuffer =
      minCashBuffer == null
        ? roundValue(softFloor, 2)
        : roundValue(Math.max(minCashBuffer, softFloor), 2);
  }

  if (cashSalarySpendPressure > 0) {
    shouldSaveCash = false;
    spendFactor =
      spendFactor == null
        ? roundValue(1.08 + cashSalarySpendPressure * 0.18, 3)
        : roundValue(Math.min(1.45, spendFactor + cashSalarySpendPressure * 0.22), 3);
    overspendTolerance = roundValue(Math.min(0.2, overspendTolerance + cashSalarySpendPressure * 0.08), 3);

    if (allowedBudgetForSearch != null && cash > 0) {
      const spendableAboveCap =
        maxCashAllowed != null ? Math.max(cash - maxCashAllowed, 0) : allowedBudgetForSearch;
      allowedBudgetForSearch = roundValue(
        Math.max(allowedBudgetForSearch, spendableAboveCap * (0.55 + cashSalarySpendPressure * 0.35)),
        2,
      );
    }

    if (maxSpendPerPick != null && input.availableCashForCurrentPick != null) {
      const q50 = input.anchorsQ50Price ?? 18;
      maxSpendPerPick = roundValue(
        Math.max(
          maxSpendPerPick,
          Math.min(input.availableCashForCurrentPick, q50 * (1.2 + cashSalarySpendPressure * 1.4)),
        ),
        2,
      );
    }
  }

  return {
    shouldSaveCash,
    spendFactor,
    overspendTolerance,
    minCashBuffer,
    season1TargetCashLeft,
    allowedBudgetForSearch,
    maxSpendPerPick,
    cashSalarySpendPressure,
    cashSalaryRatio,
  };
}

/** Finance-scaled soft cash/salary target (0.25–0.75), mirrors ai-cash-salary-target-service. */
export function resolveCashSalarySoftRatioFromFinances(finances?: number | null) {
  const financesValue = normalizeManagementValue(finances ?? 55);
  return roundValue(clamp(0.25 + financesValue * 0.5, 0.25, 0.75), 3);
}

export type CashSalaryDraftPickGuidance = {
  softRatio: number;
  hardRatio: number;
  cashSalaryRatio: number | null;
  softCash: number;
  hardCash: number;
  needsSpendDown: boolean;
  mustSpendDown: boolean;
  minSpendPerPick: number;
  maxCashReservePct: number | null;
  extraRosterSlotsForSpendDown: number;
};

/** Guides S1 redraft picks toward finance-scaled cash/salary band (soft 0.25–0.75, hard max 1.25). */
export function resolveCashSalaryDraftPickGuidance(input: {
  cash: number;
  salaryTotal: number;
  finances?: number | null;
  remainingSlots: number;
  rosterAtOrAboveMin: boolean;
  avgPickPrice?: number | null;
}): CashSalaryDraftPickGuidance {
  const softRatio = resolveCashSalarySoftRatioFromFinances(input.finances);
  const hardRatio = DRAFT_MAX_CASH_TO_SALARY_RATIO;
  const salary = Math.max(input.salaryTotal, 0);
  const ratio = salary > 0 && input.cash > 0 ? input.cash / salary : null;
  const softCash = salary * softRatio;
  const hardCash = salary * hardRatio;
  const needsSpendDown =
    input.rosterAtOrAboveMin && ratio != null && ratio > softRatio + 0.04;
  const mustSpendDown = ratio != null && ratio > hardRatio + 0.02;
  const slots = Math.max(1, input.remainingSlots);
  const excessOverSoft = Math.max(0, input.cash - softCash);
  const avgPick = Math.max(input.avgPickPrice ?? 22, 8);
  const minSpendPerPick = mustSpendDown
    ? Math.max(avgPick * 0.85, excessOverSoft / slots)
    : needsSpendDown
      ? Math.max(avgPick * 0.55, (excessOverSoft / slots) * 0.8)
      : 0;
  const maxCashReservePct =
    mustSpendDown || needsSpendDown
      ? roundValue(clamp((softRatio / Math.max(ratio ?? softRatio, 0.01)) * 0.15, 0.02, 0.12), 3)
      : null;
  const extraRosterSlotsForSpendDown =
    mustSpendDown || needsSpendDown
      ? Math.min(4, Math.ceil(excessOverSoft / Math.max(avgPick, minSpendPerPick || avgPick)))
      : 0;

  return {
    softRatio,
    hardRatio,
    cashSalaryRatio: ratio != null ? roundValue(ratio, 3) : null,
    softCash: roundValue(softCash, 2),
    hardCash: roundValue(hardCash, 2),
    needsSpendDown,
    mustSpendDown,
    minSpendPerPick: roundValue(minSpendPerPick, 2),
    maxCashReservePct,
    extraRosterSlotsForSpendDown,
  };
}

/** True when cash/salary sits in the league soft band (0.25–0.75). */
export function isCashSalaryRatioInSoftBand(ratio: number | null | undefined, tolerance = 0.04) {
  if (ratio == null || !Number.isFinite(ratio)) return false;
  return ratio + tolerance >= 0.25 && ratio - tolerance <= 0.75;
}
