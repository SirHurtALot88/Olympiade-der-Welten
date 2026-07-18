import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import {
  getDemandMultiplier,
  getRewardMultiplier,
  rollSponsorOfferSlate,
  rollSponsorStarTiers,
} from "@/lib/sponsor/sponsor-tier-pool";
import {
  SPONSOR_RARITIES,
  getSponsorCurveFamily,
  mapStarTierToRarity,
} from "@/lib/sponsor/sponsor-curve-shapes";
import type { SponsorCurveFamily } from "@/lib/data/olyDataTypes";

// Diese Suite prüft die HARTEN Cap-/Cluster-Grenzen (den Normalfall). Die Golden-Sterne-Varianz ist die
// bewusste AUSNAHME davon (kleine Teams selten über Cap, große selten drunter) und würde die exakten
// Grenzen seed-abhängig verletzen. Deshalb hier deterministisch abgeschaltet (Balance unverändert).
beforeAll(() => {
  process.env.OLY_SPONSOR_STAR_VARIANCE_OFF = "1";
});
afterAll(() => {
  delete process.env.OLY_SPONSOR_STAR_VARIANCE_OFF;
});

function createQualityRank(overrides: Partial<SponsorTeamQualityRank> & Pick<SponsorTeamQualityRank, "teamId">): SponsorTeamQualityRank {
  const maxStarTier = overrides.maxStarTier ?? 3;
  const targetStarTier = overrides.targetStarTier ?? 3;
  return {
    qualityRank: 16,
    components: [],
    maxStarTier,
    targetStarTier,
    maxRarity: mapStarTierToRarity(maxStarTier),
    targetRarity: mapStarTierToRarity(targetStarTier),
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

describe("sponsor offer slate (rarity + curve shapes)", () => {
  function familyCounts(shapes: SponsorCurveFamily[]) {
    const counts = new Map<SponsorCurveFamily, number>();
    for (const family of shapes) {
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    return counts;
  }

  it("rolls five DISTINCT curve shapes with at most two per family", () => {
    const slate = rollSponsorOfferSlate({
      seasonId: "season-slate",
      teamId: "M-M",
      qualityRank: createQualityRank({ teamId: "M-M", qualityRank: 5, maxStarTier: 5, targetStarTier: 4 }),
    });
    expect(slate.entries).toHaveLength(5);
    const curves = slate.entries.map((entry) => entry.curveShape);
    expect(new Set(curves).size).toBe(curves.length); // distinkt
    const counts = familyCounts(curves.map(getSponsorCurveFamily));
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it("never lets a slate rarity exceed the team's quality-rank cap", () => {
    // maxStarTier 3 → Rarity-Decke magisch (order 1): keine selten/legendär-Angebote.
    const capped = rollSponsorOfferSlate({
      seasonId: "season-cap",
      teamId: "MID",
      qualityRank: createQualityRank({ teamId: "MID", qualityRank: 16, maxStarTier: 3, targetStarTier: 3 }),
    });
    const maxOrder = SPONSOR_RARITIES[mapStarTierToRarity(3)].order;
    for (const entry of capped.entries) {
      expect(SPONSOR_RARITIES[entry.rarity].order).toBeLessThanOrEqual(maxOrder);
    }

    // Bottom-Team (maxStarTier 1) → Decke gewöhnlich (order 0): ausschließlich gewöhnliche Angebote.
    const bottom = rollSponsorOfferSlate({
      seasonId: "season-cap-bottom",
      teamId: "R-R",
      qualityRank: createQualityRank({ teamId: "R-R", qualityRank: 31, maxStarTier: 1, targetStarTier: 1, leaguePosition: 32 }),
    });
    expect(bottom.entries.every((entry) => entry.rarity === "gewöhnlich")).toBe(true);
  });

  it("is deterministic — identical input yields an identical slate", () => {
    const input = {
      seasonId: "season-det",
      teamId: "M-M",
      qualityRank: createQualityRank({ teamId: "M-M", qualityRank: 8, maxStarTier: 4, targetStarTier: 4 }),
    };
    const first = rollSponsorOfferSlate(input);
    const second = rollSponsorOfferSlate(input);
    expect(second.entries).toEqual(first.entries);
    expect(second.goldenCardSlots).toEqual(first.goldenCardSlots);
  });

  it("keeps the golden-card luck orthogonal to the slate (at most one slot)", () => {
    const slate = rollSponsorOfferSlate({
      seasonId: "season-golden",
      teamId: "R-R",
      qualityRank: createQualityRank({ teamId: "R-R", qualityRank: 30, maxStarTier: 2, targetStarTier: 2, leaguePosition: 31 }),
      beliebtheit: 1.5,
    });
    expect(Array.isArray(slate.goldenCardSlots)).toBe(true);
    expect(slate.goldenCardSlots.length).toBeLessThanOrEqual(1);
    // Golden verändert die Slot-Anzahl / Rarity-Decke nicht: weiterhin 5 distinkte, gedeckelte Einträge.
    expect(slate.entries).toHaveLength(5);
    for (const index of slate.goldenCardSlots) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(slate.entries.length);
    }
  });
});
