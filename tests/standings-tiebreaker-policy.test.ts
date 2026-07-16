import { describe, expect, it } from "vitest";

import {
  DEFAULT_STANDINGS_TIEBREAKER_MODE,
  detectStandingTieGroups,
  resolveMatchdayRankWithTiePolicy,
  resolveProjectedRankWithTiePolicy,
} from "@/lib/standings/standings-tiebreaker-policy";

const baseItems = [
  {
    teamId: "A-A",
    teamName: "Alpha",
    totalScore: 10,
    projectedPoints: 5,
    currentRank: 2,
    currentPoints: 1,
    matchdayRank: 2,
    cash: 10,
  },
  {
    teamId: "B-B",
    teamName: "Beta",
    totalScore: 8,
    projectedPoints: 4,
    currentRank: 1,
    currentPoints: 2,
    matchdayRank: 1,
    cash: 9,
  },
];

describe("standings tiebreaker policy", () => {
  it("defaults to block_on_tie", () => {
    expect(DEFAULT_STANDINGS_TIEBREAKER_MODE).toBe("block_on_tie");
  });

  it("block_on_tie does not block unique ranks", () => {
    const ranks = resolveProjectedRankWithTiePolicy(baseItems);
    expect(ranks.get("A-A")).toBe(1);
    expect(ranks.get("B-B")).toBe(2);
    expect(detectStandingTieGroups(baseItems)).toEqual([]);
  });

  it("block_on_tie nulls tied ranks", () => {
    const tied = [
      baseItems[0],
      {
        ...baseItems[1],
        totalScore: 10,
        projectedPoints: 5,
      },
    ];

    expect(resolveMatchdayRankWithTiePolicy(tied).get("A-A")).toBeNull();
    expect(resolveMatchdayRankWithTiePolicy(tied).get("B-B")).toBeNull();
    expect(resolveProjectedRankWithTiePolicy(tied).get("A-A")).toBeNull();
    expect(resolveProjectedRankWithTiePolicy(tied).get("B-B")).toBeNull();
    expect(detectStandingTieGroups(tied).length).toBeGreaterThan(0);
  });

  it("breaks projectedPoints ties via matchdayScore when totalScore differs", () => {
    const tiedOnPointsOnly = [
      baseItems[0],
      {
        ...baseItems[1],
        totalScore: 9,
        projectedPoints: 5,
      },
    ];

    const ranks = resolveProjectedRankWithTiePolicy(tiedOnPointsOnly);
    expect(ranks.get("A-A")).toBe(1);
    expect(ranks.get("B-B")).toBe(2);
    expect(detectStandingTieGroups(tiedOnPointsOnly)).toEqual([]);
  });

  it("shared_rank is prepared but not default", () => {
    const tied = [
      baseItems[0],
      {
        ...baseItems[1],
        totalScore: 10,
        projectedPoints: 5,
      },
    ];

    const ranks = resolveProjectedRankWithTiePolicy(tied, "shared_rank");
    expect(ranks.get("A-A")).toBe(1);
    expect(ranks.get("B-B")).toBe(1);
    expect(DEFAULT_STANDINGS_TIEBREAKER_MODE).not.toBe("shared_rank");
  });

  it("deterministic_sort is prepared but not default", () => {
    const tied = [
      baseItems[0],
      {
        ...baseItems[1],
        totalScore: 10,
        projectedPoints: 5,
      },
    ];

    const ranks = resolveProjectedRankWithTiePolicy(tied, "deterministic_sort");
    expect(ranks.get("A-A")).toBe(2);
    expect(ranks.get("B-B")).toBe(1);
    expect(DEFAULT_STANDINGS_TIEBREAKER_MODE).not.toBe("deterministic_sort");
  });
});
