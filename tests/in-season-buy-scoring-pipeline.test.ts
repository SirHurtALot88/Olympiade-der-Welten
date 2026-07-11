import { describe, expect, it } from "vitest";

import { rankFinalBuyCandidates } from "@/lib/ai/in-season-engine/buy-scoring-pipeline";
import type { GameState } from "@/lib/data/olyDataTypes";

// Minimal stand-ins: the strategic-score branch of the comparator returns before touching the
// diversity path, so gameState/count maps are never read when strategicBuyScore values differ.
const gameState = { season: { id: "season-2" } } as unknown as GameState;

function candidate(overrides: Record<string, unknown>) {
  return {
    playerId: "p",
    playerName: "Player",
    strategicBuyScore: null,
    overallRecommendationScore: 0,
    score: 0,
    price: null,
    marketValue: null,
    ...overrides,
  } as unknown as Parameters<typeof rankFinalBuyCandidates>[0]["candidates"][number];
}

const baseArgs = {
  gameState,
  teamId: "team-a",
  playersById: new Map(),
  classCounts: new Map<string, number>(),
  raceCounts: new Map<string, number>(),
  coverageFallback: false,
  pickedCount: 0,
  watchPlayerIds: new Set<string>(),
};

describe("in-season buy-scoring-pipeline — rankFinalBuyCandidates re-export", () => {
  it("re-exports the apply-service ranking comparator", () => {
    expect(typeof rankFinalBuyCandidates).toBe("function");
  });

  it("orders candidates by descending strategicBuyScore", () => {
    const ranked = rankFinalBuyCandidates({
      ...baseArgs,
      candidates: [
        candidate({ playerId: "low", playerName: "Low", strategicBuyScore: 20 }),
        candidate({ playerId: "high", playerName: "High", strategicBuyScore: 80 }),
        candidate({ playerId: "mid", playerName: "Mid", strategicBuyScore: 50 }),
      ],
    });
    expect(ranked.map((entry) => entry.playerId)).toEqual(["high", "mid", "low"]);
  });

  it("falls back to overallRecommendationScore when no strategic score is present", () => {
    const ranked = rankFinalBuyCandidates({
      ...baseArgs,
      candidates: [
        candidate({ playerId: "a", playerName: "A", overallRecommendationScore: 30 }),
        candidate({ playerId: "b", playerName: "B", overallRecommendationScore: 70 }),
      ],
    });
    expect(ranked[0].playerId).toBe("b");
  });

  it("does not mutate the input array", () => {
    const input = [
      candidate({ playerId: "x", playerName: "X", strategicBuyScore: 10 }),
      candidate({ playerId: "y", playerName: "Y", strategicBuyScore: 90 }),
    ];
    const order = input.map((entry) => entry.playerId);
    rankFinalBuyCandidates({ ...baseArgs, candidates: input });
    expect(input.map((entry) => entry.playerId)).toEqual(order);
  });
});
