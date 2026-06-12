import { describe, expect, it } from "vitest";

import { assessPlayerBoardTrust } from "@/lib/ai/player-board-trust-service";

describe("player board trust service", () => {
  it("penalizes expensive starters when actual ranks trail expected ranks", () => {
    const result = assessPlayerBoardTrust({
      boardConfidence: 55,
      appearances: 8,
      averageContribution: 24,
      averageFinalScore: 41,
      expectedPerformanceValue: 78,
      contractLength: 1,
      roleTag: "starter",
      salary: 18,
      marketValue: 88,
      purchasePrice: 90,
      currentValue: 62,
      ovrRank: 11,
      actualPpsRank: 35,
      actualMvsRank: 38,
      expectedAxisRank: 11,
      actualAxisPpsRank: 31,
      weakTeamFit: false,
    });

    expect(result.trustScore).toBeLessThan(30);
    expect(result.reasons).toContain("actual_rank_below_expected_rank");
    expect(result.reasons).toContain("expensive_player_underperformed");
    expect(result.reasons).toContain("market_value_loss_after_purchase");
    expect(result.renewalPolicy).not.toBe("normal");
  });

  it("keeps more patience for cheap depth players with acceptable rank gaps", () => {
    const result = assessPlayerBoardTrust({
      boardConfidence: 55,
      appearances: 5,
      averageContribution: 42,
      averageFinalScore: 52,
      expectedPerformanceValue: 58,
      contractLength: 2,
      roleTag: "bench",
      salary: 3,
      marketValue: 15,
      purchasePrice: 14,
      currentValue: 16,
      ovrRank: 40,
      actualPpsRank: 48,
      actualMvsRank: 44,
      weakTeamFit: false,
    });

    expect(result.trustScore).toBeGreaterThanOrEqual(52);
    expect(result.reasons).toContain("cheap_player_value_patience");
    expect(result.renewalPolicy).toBe("normal");
  });

  it("rewards players who outperform expected rank", () => {
    const result = assessPlayerBoardTrust({
      boardConfidence: 50,
      appearances: 7,
      averageContribution: 70,
      averageFinalScore: 76,
      expectedPerformanceValue: 64,
      contractLength: 2,
      roleTag: "starter",
      salary: 7,
      marketValue: 35,
      purchasePrice: 34,
      currentValue: 45,
      ovrRank: 28,
      actualPpsRank: 10,
      actualMvsRank: 12,
      expectedAxisRank: 24,
      actualAxisPpsRank: 8,
      weakTeamFit: false,
    });

    expect(result.trustScore).toBeGreaterThan(55);
    expect(result.reasons).toContain("outperformed_expected_rank");
  });
});
