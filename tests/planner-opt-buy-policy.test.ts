import { describe, expect, it } from "vitest";

import {
  filterEmergencyRepairTeamIds,
  filterQualityPlannedBuyCandidates,
  isTrashMarketBuyCandidate,
  prefersReserveLaneOverCheapFill,
  resolveAllowedMarketBuyCount,
  resolveBelowOptCashReserve,
  shouldBlockEmergencyPathAtOpt,
  strategicPoolHasReserveLaneCandidates,
} from "@/lib/ai/planner-opt-buy-policy";
import { applyTightBudgetReserveLaneBias } from "@/lib/ai/unified-pick-planner-service";

describe("planner opt buy policy", () => {
  it("allows planned quality buys at Opt while blocking trash filler", () => {
    const allowed = resolveAllowedMarketBuyCount({
      rosterBase: 10,
      currentRoster: 10,
      playerOpt: 10,
      expiringCount: 0,
      plannedCandidates: [
        { playerId: "good", price: 28, overallRecommendationScore: 62 },
        { playerId: "trash", price: 6, overallRecommendationScore: 20 },
      ],
      maxBuysPerTeam: 3,
      postOptUpgradeDeploy: true,
      maxUpgradeBuys: 2,
    });

    expect(allowed).toBe(1);
    expect(
      filterQualityPlannedBuyCandidates([
        { price: 28, overallRecommendationScore: 62 },
        { price: 6, overallRecommendationScore: 20 },
      ]),
    ).toHaveLength(1);
    expect(isTrashMarketBuyCandidate({ price: 6, score: 20 })).toBe(true);
  });

  it("blocks emergency repair paths at or above Opt", () => {
    expect(shouldBlockEmergencyPathAtOpt(10, 10)).toBe(true);
    expect(shouldBlockEmergencyPathAtOpt(11, 10)).toBe(true);
    expect(shouldBlockEmergencyPathAtOpt(9, 10)).toBe(false);

    const gameState = {
      season: { id: "season-2" },
      rosters: [{ teamId: "A", playerId: "p1" }],
      teams: [{ teamId: "A" }],
      teamIdentities: [{ teamId: "A", playerOpt: 10 }],
    } as never;

    expect(
      filterEmergencyRepairTeamIds(
        gameState,
        ["A", "B"],
        () => 10,
        () => 10,
      ),
    ).toEqual([]);
  });

  it("skips emergency fallback when strategic reserve-lane candidates exist", () => {
    expect(
      strategicPoolHasReserveLaneCandidates({
        candidates: [{ marketValue: 12 }],
        teamCash: 15,
        rosterBelowHardMin: false,
      }),
    ).toBe(true);
    expect(
      strategicPoolHasReserveLaneCandidates({
        candidates: [{ marketValue: 12 }],
        teamCash: 15,
        rosterBelowHardMin: true,
      }),
    ).toBe(false);
    expect(
      strategicPoolHasReserveLaneCandidates({
        candidates: [{ marketValue: 25 }],
        teamCash: 30,
        rosterBelowHardMin: false,
      }),
    ).toBe(false);
  });

  it("prefers reserve lane below Opt on tight budget and keeps cash reserve at zero until Opt", () => {
    expect(
      prefersReserveLaneOverCheapFill({
        rosterGap: 5,
        cash: 45,
      }),
    ).toBe(true);

    expect(
      resolveBelowOptCashReserve({
        rosterGap: 5,
        minimumReserveCash: 18,
      }),
    ).toBe(0);

    expect(
      resolveBelowOptCashReserve({
        rosterGap: 0,
        minimumReserveCash: 18,
      }),
    ).toBe(18);

    const reserveBias = applyTightBudgetReserveLaneBias({
      rosterGap: 5,
      missingToMin: 2,
      cash: 45,
      coreNeeded: 1,
      cheapFillNeeded: 2,
      backupNeeded: 0,
      depthNeeded: 1,
      specialistNeeded: 0,
    });

    expect(reserveBias.preferReserveLanes).toBe(true);
    expect(reserveBias.cheapFillNeeded).toBe(0);
    expect(reserveBias.backupNeeded).toBeGreaterThan(0);
    expect(reserveBias.backupNeeded + reserveBias.depthNeeded).toBeGreaterThanOrEqual(5);
  });

  it("still allows expiry-replacement buys when roster headline is at Opt", () => {
    const allowed = resolveAllowedMarketBuyCount({
      rosterBase: 10,
      currentRoster: 10,
      playerOpt: 10,
      expiringCount: 2,
      plannedCandidates: [],
      maxBuysPerTeam: 4,
    });

    expect(allowed).toBe(2);
  });

  it("allows up to two on-top buys at opt when deploy flag is set", () => {
    const allowed = resolveAllowedMarketBuyCount({
      rosterBase: 8,
      currentRoster: 8,
      playerOpt: 8,
      expiringCount: 0,
      plannedCandidates: [
        { price: 35, overallRecommendationScore: 70 },
        { price: 32, overallRecommendationScore: 66 },
        { price: 30, overallRecommendationScore: 62 },
      ],
      maxBuysPerTeam: 4,
      postOptUpgradeDeploy: true,
      maxUpgradeBuys: 2,
    });
    expect(allowed).toBe(2);
  });
});
