import { describe, expect, it } from "vitest";

import {
  buildLeagueMarketAnchors,
  buildMarketAnchoredSlotPlan,
  getMarketLaneBand,
  isPriceEligibleForMarketLane,
  shouldDisableCheapLanes,
} from "@/lib/ai/ai-market-slot-plan-service";

const sampleAnchors = buildLeagueMarketAnchors([
  12, 14, 18, 22, 28, 35, 42, 55, 68, 82, 95, 110, 125, 140, 160, 52,
]);

describe("ai-market-slot-plan-service", () => {
  it("sets star floor at absolute 45 MW bracket", () => {
    const starBand = getMarketLaneBand("star", sampleAnchors);
    expect(starBand.floorMW).toBeGreaterThanOrEqual(45);
    expect(isPriceEligibleForMarketLane(44, "star", sampleAnchors)).toBe(false);
    expect(isPriceEligibleForMarketLane(52, "star", sampleAnchors)).toBe(true);
  });

  it("drops star slots when spendable is below q85", () => {
    const plan = buildMarketAnchoredSlotPlan({
      spendable: 40,
      rosterCount: 10,
      playerMin: 8,
      playerOpt: 12,
      steps: 4,
      missingToMin: 0,
      rosterGap: 2,
      starAllowed: 1,
      superstarAllowed: 0,
      coreNeeded: 1,
      specialistNeeded: 0,
      anchors: sampleAnchors,
    });
    expect(plan.includes("star")).toBe(false);
    expect(plan.includes("superstar")).toBe(false);
  });

  it("avoids cheap_fill when spendable exceeds q50 and roster is at minimum", () => {
    expect(shouldDisableCheapLanes(sampleAnchors.q50Price + 5, sampleAnchors, true)).toBe(true);
    expect(shouldDisableCheapLanes(sampleAnchors.q65Price, sampleAnchors, true)).toBe(true);
    expect(shouldDisableCheapLanes(10, sampleAnchors, true, { forceDisableCheap: true })).toBe(true);
    const plan = buildMarketAnchoredSlotPlan({
      spendable: sampleAnchors.q50Price + 20,
      rosterCount: 11,
      playerMin: 8,
      playerOpt: 12,
      steps: 3,
      missingToMin: 0,
      rosterGap: 1,
      starAllowed: 0,
      superstarAllowed: 0,
      coreNeeded: 1,
      specialistNeeded: 0,
      anchors: sampleAnchors,
    });
    expect(plan.includes("cheap_fill")).toBe(false);
    expect(plan.includes("core")).toBe(true);
  });

  it("uses cheap_fill only for hard minimum emergency when spendable is below depth band", () => {
    const cheapFillFloor = getMarketLaneBand("cheap_fill", sampleAnchors).floorMW;
    const depthFloor = getMarketLaneBand("depth", sampleAnchors).floorMW;
    expect(cheapFillFloor).toBeLessThan(depthFloor);
    const plan = buildMarketAnchoredSlotPlan({
      spendable: cheapFillFloor + 2,
      rosterCount: 6,
      playerMin: 8,
      playerOpt: 12,
      steps: 3,
      missingToMin: 2,
      rosterGap: 6,
      starAllowed: 0,
      superstarAllowed: 0,
      coreNeeded: 0,
      specialistNeeded: 0,
      anchors: sampleAnchors,
    });
    expect(plan.filter((lane) => lane === "cheap_fill").length).toBeGreaterThan(0);
    expect(plan.filter((lane) => lane === "star" || lane === "superstar").length).toBe(0);
  });
});

describe("market lane eligibility regression", () => {
  it("routes 85 MW to superstar lane and 52 MW to star lane", () => {
    const anchors = buildLeagueMarketAnchors(Array.from({ length: 40 }, (_, index) => 20 + index * 2));
    anchors.q85Price = 85;
    expect(isPriceEligibleForMarketLane(52, "star", anchors)).toBe(true);
    expect(isPriceEligibleForMarketLane(44, "star", anchors)).toBe(false);
    expect(isPriceEligibleForMarketLane(85, "star", anchors)).toBe(false);
    expect(isPriceEligibleForMarketLane(85, "superstar", anchors)).toBe(true);
  });
});
