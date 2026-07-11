import { describe, expect, it } from "vitest";

import {
  applyTightBudgetReserveLaneBias,
  isUnifiedPickEnabledForMarket,
  mapPlannedPicksToBuyCandidates,
  mapPlannedPicksToBuyRecommendations,
  OPT_REBUILD_RESERVE_BUDGET_PER_PICK_THRESHOLD,
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

  it("prefers compare pick metadata over narrow pool mapping", () => {
    const picks = [
      {
        playerId: "p9",
        playerName: "Fallback",
        className: "Rogue",
        race: "Elf",
        price: 11.5,
        salary: 3.2,
        ovr: 55,
        mvs: 12,
        laneReason: "cheap_fill",
      },
    ] as AiNeedsPicksPlannedPick[];
    const mapped = mapPlannedPicksToBuyRecommendations(picks);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.playerId).toBe("p9");
    expect(mapped[0]?.price).toBe(11.5);
  });

  it("resolves market pick steps from roster gap below min", () => {
    const steps = resolveUnifiedMarketPickSteps({
      currentState: { rosterCount: 6, playerMin: 8, playerOpt: 12 },
      sellPlan: { candidates: [] },
      buyPlan: { candidates: [] },
    });
    expect(steps).toBe(2);
  });

  it("returns zero unified pick steps at Opt when no legacy buy candidates remain", () => {
    const steps = resolveUnifiedMarketPickSteps({
      currentState: { rosterCount: 12, playerMin: 7, playerOpt: 12 },
      sellPlan: { candidates: [] },
      buyPlan: { candidates: [] },
    });
    expect(steps).toBe(0);
  });

  it("keeps legacy buy candidate count at Opt for post-opt upgrade deploy", () => {
    const steps = resolveUnifiedMarketPickSteps({
      currentState: { rosterCount: 12, playerMin: 7, playerOpt: 12 },
      sellPlan: { candidates: [] },
      buyPlan: { candidates: [{ playerId: "p1" }] },
    });
    expect(steps).toBe(1);
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

  it("prefers reserve lanes when average budget per Opt-gap pick is tight", () => {
    const biased = applyTightBudgetReserveLaneBias({
      rosterGap: 5,
      missingToMin: 0,
      cash: 45,
      coreNeeded: 1,
      cheapFillNeeded: 0,
      backupNeeded: 0,
      depthNeeded: 2,
      specialistNeeded: 1,
    });
    expect(biased.preferReserveLanes).toBe(true);
    expect(biased.avgBudgetPerPick).toBe(9);
    expect(biased.coreNeeded).toBe(0);
    expect(biased.cheapFillNeeded).toBe(0);
    expect(biased.backupNeeded).toBeGreaterThan(0);
    expect(OPT_REBUILD_RESERVE_BUDGET_PER_PICK_THRESHOLD).toBe(12);
  });

  it("keeps premium lane counts when budget per pick is comfortable", () => {
    const biased = applyTightBudgetReserveLaneBias({
      rosterGap: 3,
      missingToMin: 0,
      cash: 60,
      coreNeeded: 1,
      cheapFillNeeded: 0,
      backupNeeded: 0,
      depthNeeded: 1,
      specialistNeeded: 0,
    });
    expect(biased.preferReserveLanes).toBe(false);
    expect(biased.coreNeeded).toBe(1);
  });
});
