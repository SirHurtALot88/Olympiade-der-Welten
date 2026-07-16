import { describe, expect, it } from "vitest";

import { mapPlannedPicksToBuyRecommendations } from "@/lib/ai/unified-pick-planner-service";
import { rankFinalBuyCandidates } from "@/lib/ai/ai-market-plan-apply-service";
import type { AiNeedsPicksPlannedPick } from "@/lib/ai/ai-needs-picks-compare-service";
import type { GameState } from "@/lib/data/olyDataTypes";

// Minimal planned picks in the compare planner's need-priority order. Same className on purpose:
// the apply gate's diversity fallback would penalise the 2nd/3rd same-class pick and reorder them,
// which is exactly the identity-concentration inversion we are fixing. With the order-preserving
// strategicBuyScore the planner order must survive.
function pick(overrides: Partial<AiNeedsPicksPlannedPick>): AiNeedsPicksPlannedPick {
  return {
    playerId: "p",
    playerName: "P",
    className: "Knight",
    race: "Human",
    ovr: 70,
    mvs: 30,
    price: 20,
    salary: 5,
    laneReason: "identity_core",
    focusTeamFitScore: null,
    ...overrides,
  } as unknown as AiNeedsPicksPlannedPick;
}

const gameState = { season: { id: "season-2" } } as unknown as GameState;

describe("unified buy handoff — planner need-order survives the apply gate", () => {
  it("stamps a monotonically decreasing strategicBuyScore in planner order", () => {
    const recs = mapPlannedPicksToBuyRecommendations([
      pick({ playerId: "first", playerName: "First" }),
      pick({ playerId: "second", playerName: "Second" }),
      pick({ playerId: "third", playerName: "Third" }),
    ]);
    expect(recs.map((r) => r.playerId)).toEqual(["first", "second", "third"]);
    const scores = recs.map((r) => r.strategicBuyScore ?? null);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[1]).toBeGreaterThan(scores[2]!);
    // Only strategicBuyScore is set; base score stays 0 so cross-team priority is untouched.
    expect(recs.every((r) => r.overallRecommendationScore === 0 && r.score === 0)).toBe(true);
  });

  it("rankFinalBuyCandidates preserves the planner order for same-class picks (no diversity scramble)", () => {
    const recs = mapPlannedPicksToBuyRecommendations([
      pick({ playerId: "core-a", playerName: "Core A" }),
      pick({ playerId: "core-b", playerName: "Core B" }),
      pick({ playerId: "core-c", playerName: "Core C" }),
    ]);
    const ranked = rankFinalBuyCandidates({
      gameState,
      teamId: "team-a",
      candidates: recs as never,
      playersById: new Map(),
      classCounts: new Map<string, number>([["Knight", 3]]),
      raceCounts: new Map<string, number>([["Human", 3]]),
      coverageFallback: false,
      pickedCount: 0,
      watchPlayerIds: new Set<string>(),
    });
    expect(ranked.map((c) => c.playerId)).toEqual(["core-a", "core-b", "core-c"]);
  });
});
