import { describe, expect, it } from "vitest";

import {
  adjustBuyDecisionForDoctrine,
  adjustSellScoreForDoctrine,
  resolveTransferDoctrineFromProfile,
} from "@/lib/ai/ai-transfer-doctrine-layer";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";

function profile(overrides: Partial<TeamStrategyProfile["bias"]> = {}): TeamStrategyProfile {
  return {
    teamId: "T-T",
    strategySummary: "Test profile",
    bias: {
      starPriority: 5,
      cashPriority: 5,
      sellForProfitAggression: 5,
      valuePriority: 5,
      loyaltyBias: 5,
      rosterDepthPreference: 5,
      shortContractPreference: 5,
      ...overrides,
    },
  } as TeamStrategyProfile;
}

describe("ai-transfer-doctrine-layer", () => {
  it("resolves star_builder persona from high star priority and loyalty", () => {
    const doctrine = resolveTransferDoctrineFromProfile(
      profile({ starPriority: 8, loyaltyBias: 7, sellForProfitAggression: 4 }),
    );
    expect(doctrine.persona).toBe("star_builder");
    expect(doctrine.keepIntentScale).toBeGreaterThan(1);
  });

  it("softly scales sell scores without hard blocking star keep reasons", () => {
    const starBuilder = resolveTransferDoctrineFromProfile(profile({ starPriority: 8, loyaltyBias: 7 }));
    const churner = resolveTransferDoctrineFromProfile(profile({ sellForProfitAggression: 8, shortContractPreference: 7 }));

    const starKeepScore = adjustSellScoreForDoctrine({
      baseScore: 72,
      reasonToSell: ["Verkaufsfenster"],
      reasonToKeep: ["Star bleibt Core"],
      doctrine: starBuilder,
    });
    const churnSellScore = adjustSellScoreForDoctrine({
      baseScore: 72,
      reasonToSell: ["Performance blieb unter Erwartung"],
      reasonToKeep: [],
      doctrine: churner,
    });

    expect(starKeepScore).toBeLessThan(72);
    expect(churnSellScore).toBeGreaterThan(72);
    expect(starKeepScore).toBeGreaterThan(0);
  });

  it("reduces hoarder buy intent while increasing pass intent", () => {
    const hoarder = resolveTransferDoctrineFromProfile(profile({ cashPriority: 8, sellForProfitAggression: 4 }));
    const adjusted = adjustBuyDecisionForDoctrine({
      buyIntentScore: 40,
      passIntentScore: 10,
      replacementFitScore: 0,
      doctrine: hoarder,
    });

    expect(hoarder.persona).toBe("hoarder");
    expect(adjusted.buyIntent).toBeLessThan(40);
    expect(adjusted.passIntent).toBeGreaterThan(10);
    expect(adjusted.strategicBuyScore).toBeLessThan(30);
  });
});
