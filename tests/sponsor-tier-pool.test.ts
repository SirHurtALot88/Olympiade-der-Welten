import { describe, expect, it } from "vitest";

import { getDemandMultiplier, getRewardMultiplier, rollSponsorStarTiers } from "@/lib/sponsor/sponsor-tier-pool";

describe("sponsor tier pool", () => {
  it("rolls deterministic tiers with offer variation", () => {
    const tiers = rollSponsorStarTiers({ seasonId: "season-2", teamId: "M-M", commercialRating: 95 });
    expect(tiers).toHaveLength(3);
    expect(new Set(tiers).size).toBeGreaterThan(1);
  });

  it("scales rewards and demands with star tier", () => {
    expect(getRewardMultiplier(5)).toBeGreaterThan(getRewardMultiplier(2));
    expect(getDemandMultiplier(5)).toBeGreaterThan(getDemandMultiplier(2));
  });
});
