import { describe, expect, it } from "vitest";

import {
  bracketsToLegacyAnchors,
  buildLeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";

describe("quartile-classification-guard", () => {
  it("uses absolute bracket thresholds, not pool-relative quantiles, even for an all-cheap candidate pool", () => {
    // Artificial pool where EVERY price is low (10-20 MW). Under the old pool-quantile approach,
    // q85/q95 would be computed from this cheap distribution and would themselves come out low
    // (e.g. ~18-20). Under the absolute-bracket approach, the thresholds are fixed regardless of
    // the pool's price distribution: Superstar >= 65, Star >= 45.
    const cheapPrices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    const brackets = buildLeagueMarketBrackets(cheapPrices);
    const anchors = bracketsToLegacyAnchors(brackets);

    expect(anchors.q95Price).toBe(65);
    expect(anchors.q85Price).toBe(45);
  });
});
