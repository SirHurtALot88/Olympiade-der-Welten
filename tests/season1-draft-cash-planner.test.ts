import { describe, expect, it } from "vitest";

import {
  applySeason1DraftCashSalaryCapAdjustments,
  buildSeason1DraftSpendPlan,
  DRAFT_MAX_CASH_TO_SALARY_RATIO,
  distributeSeason1LaneSpendCaps,
  estimateSeason1DraftSalaryTotal,
  isDraftCashSalaryRatioOverCap,
  resolveDraftCashSalaryRatio,
  resolveDraftMaxCashAllowed,
  resolveMinPickPriceForPlan,
  resolveSeason1BonusDraftSteps,
  resolveSeason1DraftSpendBudget,
  resolveSeason1LaneSpendPool,
  resolveSeason1SalaryBufferMultiplier,
  resolveSeason1TargetCashLeft,
} from "@/lib/ai/season1-draft-cash-planner";

describe("season1 draft cash planner", () => {
  it("caps end cash at salary float for high-finances teams", () => {
    const startingCash = 315;
    const spendTargetPct = 0.93;
    const estimatedSalaryTotal = estimateSeason1DraftSalaryTotal({
      anchorsQ50Price: 22,
      plannedRosterSize: 10,
    });
    const targetLeft = resolveSeason1TargetCashLeft({
      startingCash,
      spendTargetPct,
      finances: 8.8,
      estimatedSalaryTotal,
    });
    expect(targetLeft).toBeLessThanOrEqual(estimatedSalaryTotal * resolveSeason1SalaryBufferMultiplier(8.8) + 0.01);
    expect(targetLeft).toBeLessThan(40);
  });

  it("builds lane spend pool from corridor minus minimum reserve", () => {
    expect(
      resolveSeason1LaneSpendPool({
        startingCash: 300,
        spendTargetPct: 0.93,
        reservedCashForMinimum: 40,
      }),
    ).toBe(239);
  });

  it("grants bonus draft steps for C-S and G-G", () => {
    expect(resolveSeason1BonusDraftSteps({ shortCode: "C-S", teamId: "C-S", budget: 315 })).toBe(2);
    expect(resolveSeason1BonusDraftSteps({ shortCode: "G-G", teamId: "G-G", budget: 310 })).toBe(2);
    expect(resolveSeason1BonusDraftSteps({ shortCode: "A-A", teamId: "A-A", budget: 175 })).toBe(0);
  });

  it("caps end-of-draft cash left at 1.25× salary", () => {
    const salary = 80;
    const startingCash = 300;
    const targetLeft = resolveSeason1TargetCashLeft({
      startingCash,
      spendTargetPct: 0.88,
      finances: 5,
      estimatedSalaryTotal: salary,
    });
    expect(targetLeft).toBeLessThanOrEqual(salary * DRAFT_MAX_CASH_TO_SALARY_RATIO + 0.01);
    expect(resolveDraftMaxCashAllowed(salary)).toBe(100);
    expect(isDraftCashSalaryRatioOverCap(130, salary)).toBe(true);
    expect(resolveDraftCashSalaryRatio(100, salary)).toBe(1.25);
  });

  it("boosts spend appetite when cash/salary exceeds cap", () => {
    const salary = 60;
    const adjusted = applySeason1DraftCashSalaryCapAdjustments({
      remainingCash: 120,
      salaryForRatio: salary,
      season1TargetCashLeft: 40,
      shouldSaveCash: true,
      spendFactor: 1,
      overspendTolerance: 0.05,
      minCashBuffer: 40,
      allowedBudgetForSearch: 30,
      maxSpendPerPick: 18,
      availableCashForCurrentPick: 120,
      anchorsQ50Price: 22,
    });
    expect(adjusted.shouldSaveCash).toBe(false);
    expect(adjusted.spendFactor).toBeGreaterThan(1);
    expect(adjusted.season1TargetCashLeft).toBeLessThanOrEqual(salary * DRAFT_MAX_CASH_TO_SALARY_RATIO);
    expect(adjusted.cashSalarySpendPressure).toBeGreaterThan(0);
  });

  it("derives draft spend budget from starting cash minus 1.25×-aware target cash left", () => {
    const startingCash = 300;
    const estimatedSalaryTotal = 80;
    const targetLeft = resolveSeason1TargetCashLeft({
      startingCash,
      spendTargetPct: 0.93,
      finances: 5,
      estimatedSalaryTotal,
    });
    const spendBudget = resolveSeason1DraftSpendBudget({ startingCash, targetCashLeft: targetLeft });
    expect(targetLeft).toBeLessThanOrEqual(estimatedSalaryTotal * DRAFT_MAX_CASH_TO_SALARY_RATIO + 0.01);
    expect(spendBudget).toBe(Number((startingCash - targetLeft).toFixed(2)));
    expect(spendBudget).toBeGreaterThan(
      resolveSeason1LaneSpendPool({
        startingCash,
        spendTargetPct: 0.93,
        reservedCashForMinimum: 40,
      }),
    );
  });

  it("distributes lane spend caps to sum near draft spend budget", () => {
    const spendBudget = 279;
    const slotCounts = {
      superstar: 0,
      star: 1,
      core: 2,
      specialist: 1,
      depth: 3,
      cheap_fill: 0,
      backup: 2,
    };
    const laneWeights = {
      superstar: 0.5,
      star: 0.35,
      core: 0.28,
      specialist: 0.22,
      depth: 0.18,
      cheap_fill: 0.08,
      backup: 0.1,
    };
    const { spendCaps, sumSpendCaps } = distributeSeason1LaneSpendCaps({
      spendBudget,
      slotCounts,
      laneWeights,
      lanePriceFloors: {
        star: 28,
        core: 18,
        specialist: 20,
        depth: 14,
        backup: 10,
      },
    });
    expect(sumSpendCaps).toBeLessThanOrEqual(spendBudget + 0.01);
    expect(sumSpendCaps).toBeGreaterThan(spendBudget * 0.95);
    expect(spendCaps.star / slotCounts.star).toBeGreaterThan(spendCaps.depth / slotCounts.depth);
    expect(spendCaps.core / slotCounts.core).toBeGreaterThan(spendCaps.backup / slotCounts.backup);
  });

  it("allocates no cheap_fill budget when slot plan has zero cheap_fill lanes", () => {
    const spendBudget = 260;
    const slotCounts = {
      superstar: 0,
      star: 1,
      core: 2,
      specialist: 1,
      depth: 4,
      cheap_fill: 0,
      backup: 2,
    };
    const laneWeights = {
      superstar: 0.5,
      star: 0.35,
      core: 0.28,
      specialist: 0.22,
      depth: 0.22,
      cheap_fill: 0,
      backup: 0.12,
    };
    const { spendCaps, sumSpendCaps } = distributeSeason1LaneSpendCaps({
      spendBudget,
      slotCounts,
      laneWeights,
      lanePriceFloors: {
        star: 28,
        core: 18,
        specialist: 20,
        depth: 14,
        backup: 10,
      },
    });
    expect(spendCaps.cheap_fill).toBe(0);
    expect(sumSpendCaps).toBeLessThanOrEqual(spendBudget + 0.01);
    expect(sumSpendCaps).toBeGreaterThan(spendBudget * 0.95);
    expect(spendCaps.depth).toBeGreaterThan(0);
  });

  describe("buildSeason1DraftSpendPlan (single upfront spend plan)", () => {
    it("matches resolveSeason1TargetCashLeft / resolveSeason1DraftSpendBudget composed separately", () => {
      const startingCash = 300;
      const spendTargetPct = 0.93;
      const estimatedSalaryTotal = 80;
      const plan = buildSeason1DraftSpendPlan({
        startingCash,
        spendTargetPct,
        finances: 5,
        estimatedSalaryTotal,
      });
      const expectedTargetLeft = resolveSeason1TargetCashLeft({
        startingCash,
        spendTargetPct,
        finances: 5,
        estimatedSalaryTotal,
      });
      expect(plan.targetCashLeft).toBe(expectedTargetLeft);
      expect(plan.totalSpendBudget).toBe(
        resolveSeason1DraftSpendBudget({ startingCash, targetCashLeft: expectedTargetLeft }),
      );
      expect(plan.maxCashAllowed).toBe(resolveDraftMaxCashAllowed(estimatedSalaryTotal));
    });

    it("flags mustSpendDown once remaining cash sits over the 1.25x cash/salary cap", () => {
      const plan = buildSeason1DraftSpendPlan({
        startingCash: 300,
        spendTargetPct: 0.93,
        finances: 5,
        estimatedSalaryTotal: 60,
        remainingCash: 130,
      });
      expect(plan.mustSpendDown).toBe(true);
      expect(plan.cashSalaryRatio).toBeGreaterThan(DRAFT_MAX_CASH_TO_SALARY_RATIO);
    });

    it("does not flag mustSpendDown once remaining cash is close to target", () => {
      const plan = buildSeason1DraftSpendPlan({
        startingCash: 300,
        spendTargetPct: 0.93,
        finances: 5,
        estimatedSalaryTotal: 80,
        remainingCash: plan_targetCashLeftPlusSlack(300, 0.93, 5, 80),
      });
      expect(plan.mustSpendDown).toBe(false);
    });
  });

  describe("resolveMinPickPriceForPlan", () => {
    it("derives per-pick pace from remaining cash minus target cash left over picks left", () => {
      const plan = buildSeason1DraftSpendPlan({
        startingCash: 300,
        spendTargetPct: 0.93,
        finances: 5,
        estimatedSalaryTotal: 80,
      });
      const price = resolveMinPickPriceForPlan(plan, { remainingCash: 150, picksLeft: 3 });
      expect(price).toBe(Number(((150 - plan.targetCashLeft) / 3).toFixed(2)));
    });

    it("floors at zero once remaining cash is already below target", () => {
      const plan = buildSeason1DraftSpendPlan({
        startingCash: 300,
        spendTargetPct: 0.93,
        finances: 5,
        estimatedSalaryTotal: 80,
      });
      const price = resolveMinPickPriceForPlan(plan, { remainingCash: plan.targetCashLeft - 5, picksLeft: 2 });
      expect(price).toBe(0);
    });
  });
});

function plan_targetCashLeftPlusSlack(
  startingCash: number,
  spendTargetPct: number,
  finances: number,
  estimatedSalaryTotal: number,
) {
  const targetLeft = resolveSeason1TargetCashLeft({ startingCash, spendTargetPct, finances, estimatedSalaryTotal });
  return targetLeft + 2;
}
