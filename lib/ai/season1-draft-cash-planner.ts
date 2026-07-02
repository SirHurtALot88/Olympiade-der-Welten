import type { Team } from "@/lib/data/olyDataTypes";

import {
  getSeason1BudgetTier,
  isSeason1TopOrUpperBudgetTeam,
  normalizeManagementValue,
  normalizeTeamCode,
} from "@/lib/ai/season1-draft-spend-policy";

/** Absolute max cash after draft: 1.25× roster salary sum (unless min-roster blocked). */
export const DRAFT_MAX_CASH_TO_SALARY_RATIO = 1.25;

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveDraftMaxCashAllowed(salaryTotal: number) {
  if (salaryTotal <= 0) {
    return null;
  }
  return roundValue(salaryTotal * DRAFT_MAX_CASH_TO_SALARY_RATIO, 2);
}

export function resolveDraftCashSalaryRatio(cash: number, salaryTotal: number) {
  if (salaryTotal <= 0) {
    return null;
  }
  return roundValue(cash / salaryTotal, 3);
}

export function isDraftCashSalaryRatioOverCap(cash: number, salaryTotal: number) {
  const ratio = resolveDraftCashSalaryRatio(cash, salaryTotal);
  return ratio != null && ratio > DRAFT_MAX_CASH_TO_SALARY_RATIO + 0.001;
}

/** Spend pressure when cash/salary exceeds cap: 0 at cap, up to 1 well above. */
export function resolveDraftCashSalarySpendPressure(cash: number, salaryTotal: number) {
  const ratio = resolveDraftCashSalaryRatio(cash, salaryTotal);
  if (ratio == null || ratio <= DRAFT_MAX_CASH_TO_SALARY_RATIO) {
    return 0;
  }
  return roundValue(clamp((ratio - DRAFT_MAX_CASH_TO_SALARY_RATIO) / 0.25, 0, 1), 3);
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
 */
export function resolveSeason1TargetCashLeft(input: {
  startingCash: number;
  spendTargetPct: number;
  finances?: number | null;
  estimatedSalaryTotal?: number | null;
}) {
  const corridorLeft = input.startingCash * (1 - input.spendTargetPct);
  const salaryTotal = input.estimatedSalaryTotal ?? 0;
  if (salaryTotal <= 0) {
    return roundValue(corridorLeft, 2);
  }
  const salaryBuffered = salaryTotal * resolveSeason1SalaryBufferMultiplier(input.finances);
  const maxCashLeft = salaryTotal * DRAFT_MAX_CASH_TO_SALARY_RATIO;
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
  /** End-of-draft cash floor (salary-buffer + 1.25x-cap aware). */
  targetCashLeft: number;
  /** startingCash - targetCashLeft; total transfer spend the plan expects across all lanes. */
  totalSpendBudget: number;
  maxCashAllowed: number | null;
  cashSalaryRatio: number | null;
  /** True once remaining cash sits meaningfully above target (over 1.25x cap, or corridor slack). */
  mustSpendDown: boolean;
};

export function buildSeason1DraftSpendPlan(input: {
  startingCash: number;
  spendTargetPct: number;
  finances?: number | null;
  estimatedSalaryTotal?: number | null;
  remainingCash?: number | null;
}): Season1DraftSpendPlan {
  const estimatedSalaryTotal =
    input.estimatedSalaryTotal != null && input.estimatedSalaryTotal > 0 ? input.estimatedSalaryTotal : null;
  const targetCashLeft = resolveSeason1TargetCashLeft({
    startingCash: input.startingCash,
    spendTargetPct: input.spendTargetPct,
    finances: input.finances,
    estimatedSalaryTotal,
  });
  const totalSpendBudget = resolveSeason1DraftSpendBudget({ startingCash: input.startingCash, targetCashLeft });
  const maxCashAllowed = estimatedSalaryTotal != null ? resolveDraftMaxCashAllowed(estimatedSalaryTotal) : null;
  const remainingCash = input.remainingCash ?? null;
  const cashSalaryRatio =
    remainingCash != null && estimatedSalaryTotal != null
      ? resolveDraftCashSalaryRatio(remainingCash, estimatedSalaryTotal)
      : null;
  const overCap = remainingCash != null && estimatedSalaryTotal != null && isDraftCashSalaryRatioOverCap(remainingCash, estimatedSalaryTotal);
  const mustSpendDown =
    remainingCash != null &&
    (overCap || remainingCash > targetCashLeft + Math.max(input.startingCash * 0.015, 6));
  return {
    startingCash: input.startingCash,
    spendTargetPct: input.spendTargetPct,
    estimatedSalaryTotal,
    targetCashLeft,
    totalSpendBudget,
    maxCashAllowed,
    cashSalaryRatio,
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
    const scale = input.spendBudget / sumSpendCaps;
    for (const lane of SEASON1_DRAFT_LANES) {
      spendCaps[lane] = roundValue(spendCaps[lane] * scale, 2);
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

/** Boost spend appetite when cash/salary exceeds DRAFT_MAX_CASH_TO_SALARY_RATIO. */
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
}): Season1DraftCashSalaryCapAdjustments {
  const cash = input.remainingCash ?? 0;
  const salary = input.salaryForRatio ?? 0;
  const cashSalaryRatio = resolveDraftCashSalaryRatio(cash, salary);
  const cashSalarySpendPressure =
    cash > 0 && salary > 0 ? resolveDraftCashSalarySpendPressure(cash, salary) : 0;
  const maxCashAllowed = resolveDraftMaxCashAllowed(salary);

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
    if (minCashBuffer != null) {
      minCashBuffer = roundValue(Math.min(minCashBuffer, maxCashAllowed), 2);
    }
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
