import { describe, expect, it } from "vitest";

import {
  isUnifiedPickEnabledForMarket,
  mapPlannedPicksToBuyCandidates,
  resolveUnifiedMarketPickSteps,
} from "@/lib/ai/unified-pick-planner-service";
import type { AiNeedsPicksPlannedPick } from "@/lib/ai/ai-needs-picks-compare-service";

describe("unified pick planner service", () => {
  it("maps planned picks to pool candidates by playerId", () => {
    const picks = [
      { playerId: "p1", playerName: "A" },
      { playerId: "p2", playerName: "B" },
    ] as AiNeedsPicksPlannedPick[];
    const pool = [
      { playerId: "p2", price: 12 },
      { playerId: "p1", price: 20 },
      { playerId: "p3", price: 8 },
    ];
    const mapped = mapPlannedPicksToBuyCandidates(picks, pool);
    expect(mapped.map((entry) => entry.playerId)).toEqual(["p1", "p2"]);
  });

  it("resolves market pick steps from roster gap below min", () => {
    const steps = resolveUnifiedMarketPickSteps({
      currentState: { rosterCount: 6, playerMin: 8, playerOpt: 12 },
      sellPlan: { candidates: [] },
      buyPlan: { candidates: [] },
    });
    expect(steps).toBe(2);
  });

  it("defaults unified pick to enabled unless env disables", () => {
    const previous = process.env.OLY_UNIFIED_PICK;
    delete process.env.OLY_UNIFIED_PICK;
    expect(isUnifiedPickEnabledForMarket()).toBe(true);
    process.env.OLY_UNIFIED_PICK = "0";
    expect(isUnifiedPickEnabledForMarket()).toBe(false);
    if (previous == null) delete process.env.OLY_UNIFIED_PICK;
    else process.env.OLY_UNIFIED_PICK = previous;
  });
});
