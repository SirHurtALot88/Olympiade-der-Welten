import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  runSeasonPointsPrizeRegressionSmoke,
  SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR,
} from "@/lib/season/season-points-prize-regression";

// This regression smoke reads a pre-generated Season-1 simulation artifact
// (season1-simulation-summary.json + 2 CSVs) from the gitignored outputs/
// directory. That artifact is produced by an ad-hoc simulation run that is
// not part of this repo/CI and was never committed (outputs/ is in
// .gitignore), so it is only present on a machine where someone has run
// that simulation locally. Skip cleanly instead of failing with ENOENT when
// it is absent.
const hasRegressionFixture = fs.existsSync(
  path.join(SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR, "season1-simulation-summary.json"),
);

describe("season points and prize regression smoke", () => {
  it.skipIf(!hasRegressionFixture)("keeps completed Season 1 points and prize rank-change plausible", async () => {
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
