import { describe, expect, it } from "vitest";

import { loadFreshSeasonOneSeedData } from "@/lib/data/dataAdapter";
import {
  MARKET_BRACKET_DEFINITIONS,
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  isPriceEligibleForBracketLane,
  quantilePrice,
} from "@/lib/ai/market-pick-engine/market-brackets";

describe("market-brackets", () => {
  const seed = loadFreshSeasonOneSeedData();
  const prices = seed.players.map((player) => player.displayMarketValue ?? player.marketValue ?? null);
  const brackets = buildLeagueMarketBrackets(prices);

  it("uses absolute MW floors for star/core separation", () => {
    expect(brackets.star.floorMw).toBeGreaterThanOrEqual(45);
    expect(brackets.core.floorMw).toBeGreaterThanOrEqual(30);
    expect(brackets.core.ceilingMw).toBeLessThanOrEqual(45);
    expect(brackets.superstar.ceilingMw).toBeNull();
  });

  it("classifies prices into user bracket bands", () => {
    expect(classifyMarketBracket(29, brackets)).toBe("Depth");
    expect(classifyMarketBracket(35, brackets)).toBe("Core");
    expect(classifyMarketBracket(44, brackets)).toBe("Core");
    expect(classifyMarketBracket(46, brackets)).toBe("Star");
    expect(classifyMarketBracket(64, brackets)).toBe("Star");
    expect(classifyMarketBracket(66, brackets)).toBe("Superstar");
    expect(classifyMarketBracket(105, brackets)).toBe("Superstar");
  });

  it("maps S1 seed thresholds to expected percentiles", () => {
    expect(quantilePrice(prices, 0.97)).toBeGreaterThanOrEqual(60);
    expect(brackets.star.floorMw).toBeGreaterThanOrEqual(45);
    expect(brackets.depth.floorMw).toBeGreaterThanOrEqual(20);
    expect(brackets.backup.floorMw).toBeGreaterThanOrEqual(12);
  });

  it("rejects sub-star prices in star lane", () => {
    expect(isPriceEligibleForBracketLane(52, "star", brackets)).toBe(true);
    expect(isPriceEligibleForBracketLane(44, "star", brackets)).toBe(false);
  });

  it("keeps bracket definition table stable", () => {
    expect(MARKET_BRACKET_DEFINITIONS.map((entry) => entry.lane)).toEqual([
      "superstar",
      "star",
      "core",
      "depth",
      "backup",
      "reserve",
    ]);
  });
});
