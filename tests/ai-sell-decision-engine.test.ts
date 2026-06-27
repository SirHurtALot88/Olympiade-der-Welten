import { describe, expect, it } from "vitest";

import { evaluateAiSellDecision, isProductiveElite } from "@/lib/ai/ai-sell-decision-engine";
import { resolveTransferDoctrineFromProfile } from "@/lib/ai/ai-transfer-doctrine-layer";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";

function churnerDoctrine() {
  return resolveTransferDoctrineFromProfile({
    teamId: "C-C",
    strategySummary: "Churn roster",
    bias: {
      starPriority: 6,
      cashPriority: 3,
      sellForProfitAggression: 8,
      valuePriority: 7,
      loyaltyBias: 2,
      rosterDepthPreference: 5,
      shortContractPreference: 7,
    },
  } as TeamStrategyProfile);
}

describe("ai-sell-decision-engine", () => {
  it("raises sell intent for negative cash and profit window", () => {
    const result = evaluateAiSellDecision({
      sellPriority: 40,
      reasonToSell: ["negatives Teamcash zum Seasonstart", "realisierbarer Gewinn von 4.0"],
      sellReasonCodes: ["negative_cash", "profit_window"],
      reasonToKeep: [],
      expectedSellValue: 22,
      marketValue: 18,
      contractLength: 2,
      teamCash: -3,
      ovrRank: 45,
      ppsSeasonRank: 50,
      underperformed: true,
    });

    expect(result.sellIntentScore).toBeGreaterThan(40);
    expect(result.strategicSellScore).toBeGreaterThanOrEqual(result.sellIntentScore - result.keepIntentScore);
    expect(result.sellDecisionLabel.length).toBeGreaterThan(0);
  });

  it("protects productive elite with keep intent", () => {
    expect(isProductiveElite({ ovrRank: 8, ppsSeasonRank: 30 })).toBe(true);

    const result = evaluateAiSellDecision({
      sellPriority: 35,
      reasonToSell: [],
      reasonToKeep: ["Star-/Core-Spieler wird nur bei echtem Finanz- oder Boarddruck bewegt", "laengerer Restvertrag"],
      keepReasonCodes: ["star_core_protection", "long_contract"],
      expectedSellValue: 15,
      marketValue: 20,
      contractLength: 5,
      teamCash: 40,
      ovrRank: 8,
      ppsSeasonRank: 18,
    });

    expect(result.keepIntentScore).toBeGreaterThan(20);
    expect(result.productiveElite).toBe(true);
  });

  it("applies doctrine multiplier without hard locks", () => {
    const base = evaluateAiSellDecision({
      sellPriority: 50,
      reasonToSell: ["Performance blieb unter Erwartung"],
      sellReasonCodes: ["underperformance"],
      reasonToKeep: [],
      expectedSellValue: 12,
      marketValue: 10,
      contractLength: 1,
      teamCash: 5,
      ovrRank: 60,
      ppsSeasonRank: 55,
      underperformed: true,
    });

    const withDoctrine = evaluateAiSellDecision({
      sellPriority: 50,
      reasonToSell: ["Performance blieb unter Erwartung"],
      sellReasonCodes: ["underperformance"],
      reasonToKeep: [],
      expectedSellValue: 12,
      marketValue: 10,
      contractLength: 1,
      teamCash: 5,
      ovrRank: 60,
      ppsSeasonRank: 55,
      underperformed: true,
      doctrine: churnerDoctrine(),
    });

    expect(withDoctrine.strategicSellScore).not.toBe(base.strategicSellScore);
  });
});
