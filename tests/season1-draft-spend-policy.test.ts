import { describe, expect, it } from "vitest";

import {
  getSeason1BudgetTier,
  getSeason1CheapPickPriceFloor,
  isSeason1ImpactDraftTeam,
  isSeason1PremiumDraftTeam,
  resolveSeason1SpendPolicy,
  shouldBlockCheapSeason1Pick,
} from "@/lib/ai/season1-draft-spend-policy";

const unknownPrize = { expectedPrizeTrend: "unknown" as const };

describe("season1 draft spend policy", () => {
  it("classifies G-G with budget 310 as top tier", () => {
    expect(getSeason1BudgetTier({ shortCode: "G-G", teamId: "g-g", budget: 310 })).toBe("top");
  });

  it("G-G with high harmony spends aggressively, not cautious_or_value", () => {
    const policy = resolveSeason1SpendPolicy(
      { shortCode: "G-G", teamId: "g-g", budget: 310 },
      { ambition: 7.5, finances: 5.5, harmony: 9.3 },
      unknownPrize,
    );
    expect(policy.archetype).not.toBe("cautious_or_value");
    expect(policy.archetype).toBe("aggressive_top");
    expect(policy.targetPct).toBeGreaterThanOrEqual(0.94);
    expect(policy.minPct).toBeGreaterThanOrEqual(0.93);
  });

  it("C-S with top budget keeps disciplined_precision with higher spend floor", () => {
    const policy = resolveSeason1SpendPolicy(
      { shortCode: "C-S", teamId: "c-s", budget: 305 },
      { ambition: 6.8, finances: 6.2, harmony: 7.1 },
      unknownPrize,
    );
    expect(policy.archetype).toBe("disciplined_precision");
    expect(policy.minPct).toBeGreaterThanOrEqual(0.9);
    expect(policy.targetPct).toBeGreaterThanOrEqual(0.92);
  });

  it("low-budget team with high harmony stays cautious_or_value", () => {
    const policy = resolveSeason1SpendPolicy(
      { shortCode: "N-W", teamId: "n-w", budget: 245 },
      { ambition: 4.5, finances: 7.5, harmony: 8.2 },
      unknownPrize,
    );
    expect(policy.archetype).toBe("cautious_or_value");
    expect(policy.maxPct).toBeLessThanOrEqual(0.9);
  });

  it("includes top-budget teams in impact and premium lanes", () => {
    const team = { shortCode: "G-G", teamId: "g-g", budget: 310 };
    const identity = { ambition: 7.2, finances: 5.5, harmony: 9.3 };
    expect(isSeason1ImpactDraftTeam(team, identity)).toBe(true);
    expect(isSeason1PremiumDraftTeam(team, identity)).toBe(true);
  });

  it("blocks cheap filler picks for top tier when cash remains", () => {
    expect(
      shouldBlockCheapSeason1Pick({
        team: { shortCode: "G-G", teamId: "g-g", budget: 310 },
        price: 12,
        remainingCash: 55,
        startingCash: 310,
        spendTargetPct: 0.97,
        spendMinPct: 0.95,
        minimumSlotsBefore: 0,
        simulatedRosterCount: 10,
        targetRosterSize: 12,
      }),
    ).toBe(true);
    expect(
      shouldBlockCheapSeason1Pick({
        team: { shortCode: "G-G", teamId: "g-g", budget: 310 },
        price: 12,
        remainingCash: 30,
        startingCash: 310,
        spendTargetPct: 0.97,
        spendMinPct: 0.95,
        minimumSlotsBefore: 0,
        simulatedRosterCount: 10,
        targetRosterSize: 12,
      }),
    ).toBe(false);
  });

  it("uses tier-adjusted price floors", () => {
    expect(getSeason1CheapPickPriceFloor("top")).toBe(15);
    expect(getSeason1CheapPickPriceFloor("upper")).toBe(15);
    expect(getSeason1CheapPickPriceFloor("normal")).toBe(12);
    expect(getSeason1CheapPickPriceFloor("low")).toBe(0);
  });

  it("blocks sub-floor picks during minimum_skeleton when spend budget remains", () => {
    const team = { shortCode: "W-L", teamId: "w-l", budget: 320 };
    expect(getSeason1BudgetTier(team)).toBe("upper");
    expect(
      shouldBlockCheapSeason1Pick({
        team,
        price: 11,
        remainingCash: 290,
        startingCash: 320,
        spendTargetPct: 0.94,
        spendMinPct: 0.92,
        minimumSlotsBefore: 3,
        simulatedRosterCount: 4,
        targetRosterSize: 10,
        pickPhase: "minimum_skeleton",
      }),
    ).toBe(true);
    expect(
      shouldBlockCheapSeason1Pick({
        team,
        price: 11,
        remainingCash: 18,
        startingCash: 320,
        spendTargetPct: 0.94,
        spendMinPct: 0.92,
        minimumSlotsBefore: 1,
        simulatedRosterCount: 9,
        targetRosterSize: 10,
        pickPhase: "minimum_skeleton",
      }),
    ).toBe(false);
  });

  it("prefers the canonical targetCashLeft over the spendTargetPct estimate when both are given", () => {
    const team = { shortCode: "W-L", teamId: "w-l", budget: 320 };
    // spendTargetPct alone would say plenty of spend room remains (94% of 320 not yet spent),
    // but the canonical plan already says only a small gap remains — the canonical value should win.
    expect(
      shouldBlockCheapSeason1Pick({
        team,
        price: 11,
        remainingCash: 60,
        startingCash: 320,
        spendTargetPct: 0.94,
        spendMinPct: 0.92,
        targetCashLeft: 55,
        minimumSlotsBefore: 0,
        simulatedRosterCount: 10,
        targetRosterSize: 10,
      }),
    ).toBe(false);
    expect(
      shouldBlockCheapSeason1Pick({
        team,
        price: 11,
        remainingCash: 60,
        startingCash: 320,
        spendTargetPct: 0.94,
        spendMinPct: 0.92,
        targetCashLeft: 10,
        minimumSlotsBefore: 0,
        simulatedRosterCount: 10,
        targetRosterSize: 10,
      }),
    ).toBe(true);
  });

  it("blocks cheap picks when cash/salary exceeds 1.25× cap with spend headroom", () => {
    expect(
      shouldBlockCheapSeason1Pick({
        team: { shortCode: "L-R", teamId: "l-r", budget: 265 },
        price: 10,
        remainingCash: 120,
        startingCash: 265,
        spendTargetPct: 0.94,
        spendMinPct: 0.92,
        minimumSlotsBefore: 0,
        simulatedRosterCount: 10,
        targetRosterSize: 12,
        salaryForRatio: 80,
        cashSalaryOverCap: true,
      }),
    ).toBe(true);
  });
});
