import { describe, expect, it } from "vitest";

import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { getDemandMultiplier, getRewardMultiplier, rollSponsorStarTiers } from "@/lib/sponsor/sponsor-tier-pool";

function createQualityRank(overrides: Partial<SponsorTeamQualityRank> & Pick<SponsorTeamQualityRank, "teamId">): SponsorTeamQualityRank {
  return {
    qualityRank: 16,
    components: [],
    maxStarTier: 3,
    targetStarTier: 3,
    leaguePosition: 16,
    leaguePercentile: 50,
    ...overrides,
  };
}

describe("sponsor tier pool", () => {
  it("clusters elite teams around 4-5 stars when quality rank is top", () => {
    const roll = rollSponsorStarTiers({
      seasonId: "season-2",
      teamId: "M-M",
      qualityRank: createQualityRank({
        teamId: "M-M",
        qualityRank: 1.5,
        maxStarTier: 5,
        targetStarTier: 5,
        leaguePosition: 1,
        leaguePercentile: 99,
      }),
    });
    expect(roll.tiers).toHaveLength(3);
    expect(Math.min(...roll.tiers)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...roll.tiers)).toBeGreaterThanOrEqual(4);
  });

  it("keeps bottom-table teams on 1-2 stars with rare golden-card luck", () => {
    const roll = rollSponsorStarTiers({
      seasonId: "season-1",
      teamId: "R-R",
      qualityRank: createQualityRank({
        teamId: "R-R",
        qualityRank: 30,
        maxStarTier: 1,
        targetStarTier: 1,
        leaguePosition: 31,
        leaguePercentile: 3,
      }),
    });
    expect(Math.max(...roll.tiers)).toBeLessThanOrEqual(2);
    expect(Math.min(...roll.tiers)).toBe(1);
  });

  it("scales rewards and demands with star tier", () => {
    expect(getRewardMultiplier(5)).toBeGreaterThan(getRewardMultiplier(2));
    expect(getDemandMultiplier(5)).toBeGreaterThan(getDemandMultiplier(2));
  });

  it("does not force artificial 1-5 spread for mid-table teams", () => {
    const roll = rollSponsorStarTiers({
      seasonId: "season-mid",
      teamId: "MID",
      qualityRank: createQualityRank({
        teamId: "MID",
        qualityRank: 14,
        maxStarTier: 3,
        targetStarTier: 3,
        leaguePosition: 14,
        leaguePercentile: 55,
      }),
    });
    expect(roll.tiers.every((tier) => tier >= 2 && tier <= 4)).toBe(true);
  });

  it("caps star tiers for bottom-table teams at season start", () => {
    const bottom = rollSponsorStarTiers({
      seasonId: "season-1",
      teamId: "R-R",
      qualityRank: createQualityRank({
        teamId: "R-R",
        qualityRank: 31,
        maxStarTier: 1,
        targetStarTier: 1,
        leaguePosition: 32,
        leaguePercentile: 0,
      }),
    });
    expect(Math.max(...bottom.tiers)).toBeLessThanOrEqual(1);

    const top = rollSponsorStarTiers({
      seasonId: "season-1",
      teamId: "M-M",
      qualityRank: createQualityRank({
        teamId: "M-M",
        qualityRank: 2,
        maxStarTier: 5,
        targetStarTier: 4,
        leaguePosition: 2,
        leaguePercentile: 94,
      }),
    });
    expect(Math.min(...top.tiers)).toBeGreaterThanOrEqual(4);
  });

  it("uses softer tier mobility thresholds for season balancing", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const poolPath = path.join(process.cwd(), "lib/sponsor/sponsor-tier-pool.ts");
    const poolText = await fs.readFile(poolPath, "utf8");

    expect(poolText).toContain("roll < 0.10");
    expect(poolText).toContain("roll < 0.28");
    expect(poolText).toContain("roll < 0.38");
  });
});
