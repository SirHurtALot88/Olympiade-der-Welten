/**
 * Season-1 draft spend corridors (% of starting budget).
 * End cash is also capped at DRAFT_MAX_CASH_TO_SALARY_RATIO (1.25× salary) in season1-draft-cash-planner.
 */
import type { Team } from "@/lib/data/olyDataTypes";

export type Season1BudgetTier = "top" | "upper" | "normal" | "low";

export type Season1SpendPolicyIdentity = {
  ambition?: number | null;
  finances?: number | null;
  harmony?: number | null;
};

export type Season1PrizeSignal = {
  prizeSourceStatus?: string | null;
  expectedPrizeTrend?: string | null;
  expectedPrizeFiveSeasonSum?: number | null;
};

export type Season1SpendPolicy = {
  archetype: string;
  minPct: number;
  maxPct: number;
  targetPct: number;
  budgetTier: Season1BudgetTier;
  reserveBonus: number;
};

const TOP_BUDGET_CODES = new Set(["G-G", "C-S", "Z-H", "M-M"]);
const UPPER_BUDGET_CODES = new Set(["L-R", "P-S", "H-R", "R-R", "V-V", "D-L"]);

function roundValue(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeTeamCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function normalizeManagementValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0.5;
  if (value <= 1) return clamp(value, 0, 1);
  return clamp(value / 10, 0, 1);
}

export function getSeason1BudgetTier(team: Pick<Team, "budget" | "shortCode" | "teamId">): Season1BudgetTier {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  const budget = team.budget ?? 0;
  if (TOP_BUDGET_CODES.has(code) || budget >= 300) return "top";
  if (UPPER_BUDGET_CODES.has(code) || budget >= 260) return "upper";
  if (budget >= 200) return "normal";
  return "low";
}

export function isSeason1TopOrUpperBudgetTeam(team: Pick<Team, "budget" | "shortCode" | "teamId">) {
  const tier = getSeason1BudgetTier(team);
  return tier === "top" || tier === "upper";
}

export function isSeason1PremiumDraftTeam(
  team: Pick<Team, "budget" | "shortCode" | "teamId">,
  identity?: Season1SpendPolicyIdentity | null,
) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  if (code === "T-T") return true;
  if (isSeason1TopOrUpperBudgetTeam(team)) return true;
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  return (team.budget ?? 0) >= 260 && ambition >= 0.65;
}

export function isSeason1ImpactDraftTeam(
  team: Pick<Team, "budget" | "shortCode" | "teamId">,
  identity?: Season1SpendPolicyIdentity | null,
) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  if (["M-M", "H-R", "R-R", "G-G", "C-S", "Z-H", "L-R", "P-S"].includes(code)) {
    return true;
  }
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  return (team.budget ?? 0) >= 260 && ambition >= 0.65;
}

export function getSeason1PrizeTrendSpendAdjustment(
  signal: Season1PrizeSignal,
  identity: Season1SpendPolicyIdentity | null | undefined,
) {
  if (signal.prizeSourceStatus === "missing_source" || signal.expectedPrizeTrend === "unknown") {
    return 0;
  }
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  const finances = normalizeManagementValue(identity?.finances ?? 55);
  const partialFactor = signal.expectedPrizeFiveSeasonSum == null ? 0.75 : 1;
  if (signal.expectedPrizeTrend === "up") {
    return roundValue(((ambition >= 0.65 || finances < 0.55) ? 0.018 : 0.008) * partialFactor, 3);
  }
  if (signal.expectedPrizeTrend === "down") {
    const reduction = finances >= 0.68 ? -0.045 : ambition >= 0.72 ? -0.012 : -0.025;
    return roundValue(reduction * partialFactor, 3);
  }
  if (signal.expectedPrizeTrend === "volatile") {
    const reduction = finances >= 0.68 ? -0.03 : -0.015;
    return roundValue(reduction * partialFactor, 3);
  }
  return 0;
}

export function resolveSeason1SpendPolicy(
  team: Pick<Team, "budget" | "shortCode" | "teamId">,
  identity: Season1SpendPolicyIdentity | null | undefined,
  expectedPrizeSignal: Season1PrizeSignal,
  options?: { preferDepthOverStars?: boolean },
): Season1SpendPolicy {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  const finances = normalizeManagementValue(identity?.finances ?? 55);
  const harmony = normalizeManagementValue(identity?.harmony ?? 50);
  const budgetTier = getSeason1BudgetTier(team);
  const budget = team.budget ?? 0;

  let archetype = "normal";
  let minPct = 0.9;
  let maxPct = 0.95;
  let targetPct = 0.93;

  if (code === "C-C") {
    archetype = "value_buffer";
    minPct = 0.85;
    maxPct = 0.92;
    targetPct = 0.88;
  } else if (code === "B-P") {
    archetype = "small_elite_top";
    minPct = 0.94;
    maxPct = 0.985;
    targetPct = 0.96;
  } else if (code === "A-A" || budget <= 180) {
    archetype = "cash_poor_pragmatic";
    minPct = 0.85;
    maxPct = 0.95;
    targetPct = 0.9;
  } else if (code === "C-S") {
    archetype = "disciplined_precision";
    if (budgetTier === "top" || budget >= 300) {
      minPct = 0.9;
      maxPct = 0.96;
      targetPct = 0.93;
    } else {
      minPct = 0.88;
      maxPct = 0.93;
      targetPct = 0.91;
    }
  } else if (code === "T-T") {
    archetype = "leaders_then_fill";
    minPct = 0.88;
    maxPct = 0.94;
    targetPct = 0.9;
  } else if (
    budgetTier === "top" ||
    ["M-M", "H-R", "R-R", "V-V", "G-G", "Z-H"].includes(code) ||
    ambition >= 0.78
  ) {
    archetype = "aggressive_top";
    minPct = 0.95;
    maxPct = 1;
    targetPct = code === "G-G" || code === "Z-H" || budgetTier === "top" ? 0.97 : 0.975;
  } else if (budgetTier === "upper" || ["L-R", "P-S", "D-L"].includes(code)) {
    archetype = "upper_ambition";
    minPct = 0.92;
    maxPct = 0.98;
    targetPct = 0.94;
  } else if (["C-C", "N-W", "R-C"].includes(code)) {
    targetPct = 0.88;
  } else if (ambition >= 0.72 && finances < 0.68) {
    targetPct = 0.96;
  } else if (finances >= 0.72 && ambition < 0.58) {
    targetPct = 0.88;
  }

  const allowCautious = budget < 260 && ambition < 0.58;
  if (
    allowCautious &&
    (finances >= 0.72 || harmony >= 0.74 || ["N-W", "R-C"].includes(code)) &&
    archetype === "normal"
  ) {
    archetype = "cautious_or_value";
    minPct = 0.85;
    maxPct = 0.9;
    targetPct = Math.min(targetPct, 0.88);
  }

  const prizeAdjustment = getSeason1PrizeTrendSpendAdjustment(expectedPrizeSignal, identity);
  if (prizeAdjustment < 0) {
    minPct = Math.max(0.82, minPct + prizeAdjustment * 0.45);
    maxPct = Math.max(minPct + 0.03, maxPct + prizeAdjustment * 0.75);
  } else if (prizeAdjustment > 0) {
    minPct = Math.min(0.96, minPct + prizeAdjustment * 0.25);
    maxPct = Math.min(1, maxPct + prizeAdjustment * 0.5);
  }

  if (options?.preferDepthOverStars) {
    maxPct = Math.min(maxPct, code === "A-A" ? 0.95 : 0.92);
  }

  const reserveBonus = budgetTier === "top" ? 0.02 : budgetTier === "upper" ? 0.03 : 0.05;
  minPct = Math.max(0.75, minPct - reserveBonus);
  maxPct = Math.max(minPct + 0.03, maxPct - reserveBonus);
  if (code === "C-S") {
    minPct = Math.max(minPct, budgetTier === "top" || budget >= 300 ? 0.9 : 0.88);
  }
  targetPct = clamp(targetPct + prizeAdjustment, minPct, maxPct);

  return {
    archetype,
    minPct: roundValue(minPct),
    maxPct: roundValue(maxPct),
    targetPct: roundValue(targetPct),
    budgetTier,
    reserveBonus,
  };
}

/** Minimum MW price floor below which cheap filler picks are rejected when spend budget remains. */
export function getSeason1CheapPickPriceFloor(tier: Season1BudgetTier): number {
  switch (tier) {
    case "top":
    case "upper":
      return 15;
    case "normal":
      return 12;
    case "low":
      return 0;
  }
}

export function shouldBlockCheapSeason1Pick(input: {
  team: Pick<Team, "budget" | "shortCode" | "teamId">;
  price: number | null | undefined;
  remainingCash: number | null | undefined;
  startingCash?: number | null | undefined;
  spendTargetPct?: number | null | undefined;
  spendMinPct?: number | null | undefined;
  minimumSlotsBefore: number;
  simulatedRosterCount: number | null | undefined;
  targetRosterSize: number | null | undefined;
  salaryForRatio?: number | null | undefined;
  cashSalaryOverCap?: boolean;
  pickPhase?: string | null;
  /**
   * Canonical end-of-draft cash floor from the single Season1DraftSpendPlan (salary-buffer +
   * 1.25x-cap aware). When provided, this replaces the pure spendTargetPct-based estimate below
   * so the blocker agrees with the force-spend search and the corridor checks on "how much should
   * be spent by now" instead of each re-deriving its own number.
   */
  targetCashLeft?: number | null | undefined;
}) {
  const tier = getSeason1BudgetTier(input.team);
  const priceFloor = getSeason1CheapPickPriceFloor(tier);
  if (priceFloor <= 0) return false;

  const price = input.price ?? 0;
  const remainingCash = input.remainingCash ?? 0;
  if (price >= priceFloor) return false;
  if (remainingCash <= 35) return false;

  const startingCash =
    input.startingCash != null && input.startingCash > 0 ? input.startingCash : (input.team.budget ?? 0);
  if (startingCash <= 0) return false;

  const spendTargetPct = input.spendTargetPct ?? 0.93;
  const spendMinPct = input.spendMinPct ?? Math.max(0.82, spendTargetPct - 0.05);
  const spentSoFar = Math.max(startingCash - remainingCash, 0);
  const remainingSpendToTarget =
    input.targetCashLeft != null
      ? Math.max(remainingCash - input.targetCashLeft, 0)
      : Math.max(startingCash * spendTargetPct - spentSoFar, 0);
  const remainingSpendToMin = Math.max(startingCash * spendMinPct - spentSoFar, 0);

  const rosterGap =
    input.targetRosterSize != null && input.simulatedRosterCount != null
      ? input.targetRosterSize - input.simulatedRosterCount
      : null;
  const picksLeft = Math.max(input.minimumSlotsBefore, rosterGap ?? input.minimumSlotsBefore, 1);
  const spendPerPickNeeded = remainingSpendToTarget / picksLeft;
  const minSpendPerPickNeeded = remainingSpendToMin / picksLeft;
  const spendBudgetThreshold = Math.max(12, minSpendPerPickNeeded * 0.55, spendPerPickNeeded * 0.35);

  const cashSalaryOverCap =
    input.cashSalaryOverCap ??
    (input.salaryForRatio != null &&
      input.salaryForRatio > 0 &&
      remainingCash / input.salaryForRatio > 1.25 + 0.001);

  if (rosterGap != null && rosterGap <= 1 && input.minimumSlotsBefore <= 1 && remainingSpendToTarget <= 8) {
    return false;
  }

  if (cashSalaryOverCap && remainingSpendToTarget > 8) {
    return true;
  }

  if (input.minimumSlotsBefore > 0) {
    if (input.pickPhase === "minimum_skeleton" || input.pickPhase == null) {
      return remainingSpendToTarget > spendBudgetThreshold;
    }
    return false;
  }

  if (tier !== "top" && tier !== "upper") {
    return tier === "normal" && remainingSpendToTarget > 25;
  }

  return remainingSpendToTarget > spendBudgetThreshold;
}
