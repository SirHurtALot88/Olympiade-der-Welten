import { describe, expect, it } from "vitest";

import { getDemandMultiplier, getRewardMultiplier, rollSponsorStarTiers } from "@/lib/sponsor/sponsor-tier-pool";

describe("sponsor tier pool", () => {
  it("rolls deterministic tiers with offer variation", () => {
    const tiers = rollSponsorStarTiers({ seasonId: "season-2", teamId: "M-M", commercialRating: 95, standingRank: 1 });
    expect(tiers).toHaveLength(3);
    expect(new Set(tiers).size).toBeGreaterThan(1);
  });

  it("scales rewards and demands with star tier", () => {
    expect(getRewardMultiplier(5)).toBeGreaterThan(getRewardMultiplier(2));
    expect(getDemandMultiplier(5)).toBeGreaterThan(getDemandMultiplier(2));
  });

  it("never returns three identical tiers when cap allows variety", () => {
    for (const cr of [50, 75, 95, 100]) {
      for (const seed of ["season-1", "season-2", "season-99"]) {
        const tiers = rollSponsorStarTiers({ seasonId: seed, teamId: "TEST", commercialRating: cr, standingRank: 10 });
        expect(tiers).toHaveLength(3);
        expect(new Set(tiers).size).toBeGreaterThan(1);
      }
    }
  });

  it("caps star tiers for bottom-table teams at season start", () => {
    const bottom = rollSponsorStarTiers({
      seasonId: "season-1",
      teamId: "R-R",
      commercialRating: 21,
      standingRank: 32,
    });
    expect(Math.max(...bottom)).toBeLessThanOrEqual(1);

    const top = rollSponsorStarTiers({
      seasonId: "season-1",
      teamId: "M-M",
      commercialRating: 88,
      standingRank: 1,
    });
    expect(Math.max(...top)).toBeGreaterThanOrEqual(4);
  });

  it("adjustTiers boundary: high-tier teams still spread within cap", () => {
    let seenSpread = false;
    for (let index = 0; index < 50; index += 1) {
      const tiers = rollSponsorStarTiers({
        seasonId: `season-adjust-${index}`,
        teamId: "BOUNDARY",
        commercialRating: 100,
        standingRank: 1,
      });
      const unique = new Set(tiers).size;
      expect(unique).toBeGreaterThan(1);
      if (unique === 3) {
        seenSpread = true;
      }
    }
    expect(seenSpread).toBe(true);
  });
});
