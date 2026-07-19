import { describe, expect, it } from "vitest";

import {
  PRESEASON_REPAIR_MARKET_VALUE_CAP,
  isPreseasonRepairCandidateEligible,
} from "@/lib/ai/chunked-redraft-topup-service";
import {
  assessTeamSellRunwayPressure,
  countTeamSeasonSells,
  estimateBuyoutLikelihood,
  getProactiveStrongOfferPremiumBar,
  getProfitWindowSellThreshold,
  isAttractiveProfitSell,
} from "@/lib/ai/team-sell-runway-pressure";
import type { GameState } from "@/lib/data/olyDataTypes";

describe("preseason repair eligibility", () => {
  it("rejects expensive free agents above the cheap-fill cap", () => {
    expect(isPreseasonRepairCandidateEligible({ marketValue: 66.91, teamCash: 200 })).toBe(false);
    expect(isPreseasonRepairCandidateEligible({ marketValue: PRESEASON_REPAIR_MARKET_VALUE_CAP, teamCash: 20 })).toBe(true);
  });

  it("requires full market value cash, never a discounted fee", () => {
    expect(isPreseasonRepairCandidateEligible({ marketValue: 12, teamCash: 8 })).toBe(false);
    expect(isPreseasonRepairCandidateEligible({ marketValue: 12, teamCash: 12 })).toBe(true);
  });
});

describe("team sell runway pressure", () => {
  const baseState = {
    season: { id: "season-2" },
    transferHistory: [],
    teams: [{ teamId: "L-K", cash: 8, name: "L-K", shortCode: "L-K", budget: 100 }],
  } as unknown as GameState;

  it("raises cash pressure score without mandating a sell", () => {
    const result = assessTeamSellRunwayPressure({
      gameState: baseState,
      team: baseState.teams[0]!,
      salaryTotal: 58,
    });
    expect(result.seasonSells).toBe(0);
    expect(result.cashPressureScore).toBeGreaterThan(0.5);
    expect(result.lowCashBuffer).toBe(true);
    expect("needsProactiveSell" in result).toBe(false);
  });

  it("lowers profit-window threshold when cash pressure is high", () => {
    expect(getProfitWindowSellThreshold(0.7)).toBeLessThan(getProfitWindowSellThreshold(0.1));
  });

  it("treats sell value above market value as attractive under cash pressure", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 55,
        marketValue: 50,
        cashPressureScore: 0.6,
      }),
    ).toBe(true);
  });

  it("does not flag attractive profit when edge is too small and cash is healthy", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 51,
        marketValue: 50,
        cashPressureScore: 0.1,
      }),
    ).toBe(false);
  });

  it("flags moderate profit edges when cash is healthy after threshold loosening", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 55,
        marketValue: 50,
        cashPressureScore: 0.1,
      }),
    ).toBe(true);
  });

  it("uses pressureOverride to keep buyout likelihood above the proactive threshold under cash pressure", () => {
    const likelihood = estimateBuyoutLikelihood({
      buyoutCost: 20,
      teamCash: 15,
      baseLikelihood: 0.4,
      pressureOverride: true,
    });
    expect(likelihood).toBeGreaterThanOrEqual(0.32);
  });

  it("counts season sells", () => {
    const gameState = {
      ...baseState,
      transferHistory: [
        {
          seasonId: "season-2",
          transferType: "sell",
          fromTeamId: "L-K",
          fee: 20,
        },
      ],
    } as unknown as GameState;
    expect(countTeamSeasonSells(gameState, "L-K")).toBe(1);
  });
});

describe("proactive strong-offer path for weak teams (no cash pressure)", () => {
  it("scales the strong-offer premium bar from ~15% (weakest) to ~25% (strongest)", () => {
    expect(getProactiveStrongOfferPremiumBar(1)).toBeCloseTo(0.15, 5);
    expect(getProactiveStrongOfferPremiumBar(0)).toBeCloseTo(0.25, 5);
    expect(getProactiveStrongOfferPremiumBar(0.5)).toBeCloseTo(0.2, 5);
    // Never below the floor or above the ceiling, even for out-of-range input.
    expect(getProactiveStrongOfferPremiumBar(-1)).toBe(0.25);
    expect(getProactiveStrongOfferPremiumBar(2)).toBe(0.15);
  });

  it("does not change legacy no-pressure behaviour when teamWeaknessScore is omitted", () => {
    // Same cases already covered above without teamWeaknessScore — passing cashPressureScore
    // alone must be untouched by the new parameter.
    expect(
      isAttractiveProfitSell({ expectedSellValue: 51, marketValue: 50, cashPressureScore: 0.1 }),
    ).toBe(false);
    expect(
      isAttractiveProfitSell({ expectedSellValue: 55, marketValue: 50, cashPressureScore: 0.1 }),
    ).toBe(true);
  });

  it("a weak team (weaknessScore near 1) fires on a genuine ~20% premium with no cash pressure", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 60,
        marketValue: 50,
        purchasePrice: 200, // keep vs-purchase profit negative so only the new path can fire
        cashPressureScore: 0.1,
        teamWeaknessScore: 1,
      }),
    ).toBe(true);
  });

  it("the same weak team does NOT fire on only a marginal ~5% premium", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 52.5,
        marketValue: 50,
        purchasePrice: 200,
        cashPressureScore: 0.1,
        teamWeaknessScore: 1,
      }),
    ).toBe(false);
  });

  it("a strong team (weaknessScore 0) needs a much bigger premium than a weak team", () => {
    // ~20% premium: fires for a weak team, but NOT for a strong one — it needs ~25%+.
    const twentyPercentPremium = { expectedSellValue: 60, marketValue: 50, purchasePrice: 200, cashPressureScore: 0.1 };
    expect(isAttractiveProfitSell({ ...twentyPercentPremium, teamWeaknessScore: 1 })).toBe(true);
    expect(isAttractiveProfitSell({ ...twentyPercentPremium, teamWeaknessScore: 0 })).toBe(false);

    // A big enough premium (~30%) still tempts even the strongest team.
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 65,
        marketValue: 50,
        purchasePrice: 200,
        cashPressureScore: 0.1,
        teamWeaknessScore: 0,
      }),
    ).toBe(true);
  });

  it("is premium-graded: a bigger overpay clears the bar at a lower weakness than a smaller one", () => {
    const bar = (weakness: number, premiumRatio: number) =>
      isAttractiveProfitSell({
        expectedSellValue: 50 * (1 + premiumRatio),
        marketValue: 50,
        purchasePrice: 200,
        cashPressureScore: 0.1,
        teamWeaknessScore: weakness,
      });
    // At weakness=0.3 a 18% premium doesn't clear the bar, but a 30% one does.
    expect(bar(0.3, 0.18)).toBe(false);
    expect(bar(0.3, 0.3)).toBe(true);
  });

  it("still requires cash pressure OR an explicit weakness score — a plain no-pressure call without it keeps the original (much lower) threshold", () => {
    // Without teamWeaknessScore, a ~10% edge already clears the legacy no-pressure threshold —
    // confirming the new path is strictly additive and does not change omitted-param behaviour.
    expect(
      isAttractiveProfitSell({ expectedSellValue: 55, marketValue: 50, cashPressureScore: 0.1 }),
    ).toBe(true);
  });
});
