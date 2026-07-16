import { describe, expect, it } from "vitest";

import { runSeasonPointsPrizeRegressionSmoke } from "@/lib/season/season-points-prize-regression";

describe("season points and prize regression smoke", () => {
  it("keeps completed Season 1 points and prize rank-change plausible", async () => {
    const summary = await runSeasonPointsPrizeRegressionSmoke({ write: false });

    expect(summary.seasonCompleted).toBe(true);
    expect(summary.resolvedMatchdays).toBe(10);
    expect(summary.standingsTeamCount).toBe(32);
    expect(summary.champion?.teamId).toBe("W-L");
    expect(summary.topTeamPoints ?? 0).toBeGreaterThan(summary.thresholds.topTeamPointsMin);
    expect(summary.bottomTeamPoints ?? 0).toBeGreaterThan(summary.thresholds.bottomTeamPointsMin);
    expect(summary.teamsWithZeroPoints).toEqual([]);
    expect(summary.totalPointsDelta).toBeLessThanOrEqual(summary.thresholds.maxTotalPointsDelta);
    expect(summary.actualTotalSeasonPoints).toBe(summary.expectedTotalSeasonPoints);
    expect(summary.recomputedTotalSeasonPoints).toBe(summary.expectedTotalSeasonPoints);
    expect(summary.totalPrizeMoney).toBe(summary.thresholds.expectedBasePrizeTotal);
    expect(summary.startRankMissingCount).toBe(0);
    expect(summary.rankChangePrizeMissingCount).toBe(0);
    expect(summary.totalRankChangeBonus).not.toBeNull();
    expect(summary.warnings).toEqual([]);
  });
});
