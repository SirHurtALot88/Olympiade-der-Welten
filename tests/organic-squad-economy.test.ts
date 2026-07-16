import { describe, expect, it } from "vitest";

import { cashOptionValue } from "@/lib/ai/organic-squad/cash-option-value";
import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import type { CashFlowForecast } from "@/lib/ai/organic-squad/types";

describe("projectCashFlow", () => {
  it("computes exact arithmetic on a worked example", () => {
    const forecast = projectCashFlow({
      cash: 1000,
      salaryTotal: 400,
      expectedPrize: 50,
      sponsorIncome: 30,
      facilityNet: -20,
      netTransfer: 10,
      cashBuffer: 200,
    });

    // 1000 - 400 + 50 + 30 - 20 + 10 = 670
    expect(forecast.projectedSeasonEndCash).toBe(670);
    // 670 - 200 = 470
    expect(forecast.sustainabilityMargin).toBe(470);
  });

  it("produces a positive sustainabilityMargin when season-end cash comfortably clears the buffer", () => {
    const forecast = projectCashFlow({
      cash: 1000,
      salaryTotal: 400,
      expectedPrize: 50,
      sponsorIncome: 30,
      facilityNet: -20,
      netTransfer: 10,
      cashBuffer: 200,
    });

    expect(forecast.sustainabilityMargin).toBeGreaterThan(0);
  });

  it("produces a negative sustainabilityMargin when the team is bleeding cash", () => {
    const forecast = projectCashFlow({
      cash: 100,
      salaryTotal: 500,
      expectedPrize: 0,
      sponsorIncome: 0,
      facilityNet: 0,
      netTransfer: 0,
      cashBuffer: 200,
    });

    // 100 - 500 = -400; -400 - 200 = -600
    expect(forecast.projectedSeasonEndCash).toBe(-400);
    expect(forecast.sustainabilityMargin).toBe(-600);
    expect(forecast.sustainabilityMargin).toBeLessThan(0);
  });

  it("rounds results to 2 decimals", () => {
    const forecast = projectCashFlow({
      cash: 100.111,
      salaryTotal: 10.005,
      expectedPrize: 0,
      sponsorIncome: 0,
      facilityNet: 0,
      netTransfer: 0,
      cashBuffer: 0,
    });

    expect(forecast.projectedSeasonEndCash).toBeCloseTo(90.11, 2);
    expect(Number.isInteger(forecast.projectedSeasonEndCash * 100)).toBe(true);
  });

  it("treats NaN/missing inputs as 0", () => {
    const forecast = projectCashFlow({
      cash: Number.NaN,
      salaryTotal: 400,
      expectedPrize: Number.NaN,
      sponsorIncome: 30,
      facilityNet: Number.NaN,
      netTransfer: 10,
      cashBuffer: 200,
    });

    // cash and expectedPrize/facilityNet treated as 0: 0 - 400 + 0 + 30 + 0 + 10 = -360
    expect(forecast.projectedSeasonEndCash).toBe(-360);
    expect(forecast.sustainabilityMargin).toBe(-560);
    expect(Number.isNaN(forecast.projectedSeasonEndCash)).toBe(false);
    expect(Number.isNaN(forecast.sustainabilityMargin)).toBe(false);
  });

  it("treats undefined-ish (missing) numeric fields as 0 without producing NaN", () => {
    const forecast = projectCashFlow({
      cash: 500,
      salaryTotal: Number.NaN,
      expectedPrize: Number.NaN,
      sponsorIncome: Number.NaN,
      facilityNet: Number.NaN,
      netTransfer: Number.NaN,
      cashBuffer: Number.NaN,
    });

    expect(forecast.projectedSeasonEndCash).toBe(500);
    expect(forecast.sustainabilityMargin).toBe(500);
  });
});

describe("cashOptionValue", () => {
  const positiveForecast: CashFlowForecast = {
    projectedSeasonEndCash: 500,
    sustainabilityMargin: 300,
  };
  const negativeForecast: CashFlowForecast = {
    projectedSeasonEndCash: -100,
    sustainabilityMargin: -300,
  };

  const base = {
    cash: 500,
    cashBuffer: 200,
    forecast: positiveForecast,
    boardRisk: 0.3,
    rosterSize: 10,
    optTarget: 12,
  };

  it("is always >= 0", () => {
    const cases = [
      base,
      { ...base, cash: -1000 },
      { ...base, cash: 1_000_000 },
      { ...base, boardRisk: 0 },
      { ...base, boardRisk: 1 },
      { ...base, rosterSize: 0 },
      { ...base, rosterSize: 20 },
      { ...base, forecast: negativeForecast },
      { ...base, cashBuffer: 0 },
    ];

    for (const c of cases) {
      expect(cashOptionValue(c)).toBeGreaterThanOrEqual(0);
    }
  });

  it("rises as cash falls (all else equal)", () => {
    // Chosen so bufferPressure is strictly between its clamped extremes for both
    // "high" and "mid" (bufferPressure saturates to 0 once cash >= 2 * cashBuffer).
    const highCash = cashOptionValue({ ...base, cash: 800 });
    const midCash = cashOptionValue({ ...base, cash: 300 });
    const lowCash = cashOptionValue({ ...base, cash: 50 });

    expect(lowCash).toBeGreaterThan(midCash);
    expect(midCash).toBeGreaterThan(highCash);
  });

  it("is higher when the forecast has a negative sustainability margin than a positive one", () => {
    const withPositiveMargin = cashOptionValue({ ...base, forecast: positiveForecast });
    const withNegativeMargin = cashOptionValue({ ...base, forecast: negativeForecast });

    expect(withNegativeMargin).toBeGreaterThan(withPositiveMargin);
  });

  it("rises with higher boardRisk (all else equal)", () => {
    const lowBoardRisk = cashOptionValue({ ...base, boardRisk: 0.1 });
    const highBoardRisk = cashOptionValue({ ...base, boardRisk: 0.9 });

    expect(highBoardRisk).toBeGreaterThan(lowBoardRisk);
  });

  it("is higher when rosterSize >= optTarget than when well below optTarget", () => {
    const fullRoster = cashOptionValue({ ...base, rosterSize: 12, optTarget: 12 });
    const overFullRoster = cashOptionValue({ ...base, rosterSize: 14, optTarget: 12 });
    const wellBelowTarget = cashOptionValue({ ...base, rosterSize: 3, optTarget: 12 });

    expect(fullRoster).toBeGreaterThan(wellBelowTarget);
    // Roster boost saturates at 1 once at/above target, so an over-full roster shouldn't be
    // lower than an exactly-full one.
    expect(overFullRoster).toBeGreaterThanOrEqual(fullRoster);
  });

  it("treats NaN inputs defensively without producing NaN", () => {
    const value = cashOptionValue({
      cash: Number.NaN,
      cashBuffer: 200,
      forecast: { projectedSeasonEndCash: Number.NaN, sustainabilityMargin: Number.NaN },
      boardRisk: Number.NaN,
      rosterSize: Number.NaN,
      optTarget: Number.NaN,
    });

    expect(Number.isNaN(value)).toBe(false);
    expect(value).toBeGreaterThanOrEqual(0);
  });
});
