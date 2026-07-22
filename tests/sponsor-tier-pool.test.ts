import { describe, expect, it } from "vitest";

import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { getDemandMultiplierForRarity, rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import { SPONSOR_RARITIES, getSponsorCurveFamily } from "@/lib/sponsor/sponsor-curve-shapes";
import type { SponsorCurveFamily } from "@/lib/data/olyDataTypes";

function createQualityRank(overrides: Partial<SponsorTeamQualityRank> & Pick<SponsorTeamQualityRank, "teamId">): SponsorTeamQualityRank {
  return {
    qualityRank: 16,
    components: [],
    maxRarity: "magisch",
    targetRarity: "magisch",
    leaguePosition: 16,
    leaguePercentile: 50,
    ...overrides,
  };
}

describe("sponsor demand multiplier (rarity-keyed)", () => {
  it("scales demand with rarity (baked from the old per-star-tier multiplier, same numbers)", () => {
    // Legacy: getDemandMultiplier(starTier) = 0.85 + starTier*0.08. gewöhnlich=★2 -> 1.01, legendär=★5 -> 1.25.
    expect(getDemandMultiplierForRarity("legendär")).toBeGreaterThan(getDemandMultiplierForRarity("gewöhnlich"));
    expect(getDemandMultiplierForRarity("gewöhnlich")).toBeCloseTo(1.01, 5);
    expect(getDemandMultiplierForRarity("magisch")).toBeCloseTo(1.09, 5);
    expect(getDemandMultiplierForRarity("selten")).toBeCloseTo(1.17, 5);
    expect(getDemandMultiplierForRarity("legendär")).toBeCloseTo(1.25, 5);
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
      qualityRank: createQualityRank({ teamId: "M-M", qualityRank: 5, maxRarity: "legendär", targetRarity: "selten" }),
    });
    expect(slate.entries).toHaveLength(5);
    const curves = slate.entries.map((entry) => entry.curveShape);
    expect(new Set(curves).size).toBe(curves.length); // distinkt
    const counts = familyCounts(curves.map(getSponsorCurveFamily));
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it("never lets a slate rarity exceed the team's quality-rank cap by more than the +1 luck step", () => {
    // maxRarity magisch (order 1). Der Cap ist der Normalfall, aber die Über-Cap-Glücksstufe
    // (RARITY_OVERCAP_LUCK_WEIGHT) darf SELTEN eine Rarity EINE Stufe darüber ziehen (order+1), nie mehr.
    // Über viele Teams: die Über-Cap-Stufe bleibt die Ausnahme, keine Rarity > maxOrder+1.
    const maxOrder = SPONSOR_RARITIES.magisch.order;
    let overCapCount = 0;
    let total = 0;
    for (let t = 0; t < 100; t += 1) {
      const capped = rollSponsorOfferSlate({
        seasonId: "season-cap",
        teamId: `MID-${t}`,
        qualityRank: createQualityRank({ teamId: `MID-${t}`, qualityRank: 16, maxRarity: "magisch", targetRarity: "magisch" }),
      });
      for (const entry of capped.entries) {
        total += 1;
        const order = SPONSOR_RARITIES[entry.rarity].order;
        expect(order).toBeLessThanOrEqual(maxOrder + 1); // never more than one step over the cap
        if (order > maxOrder) overCapCount += 1;
      }
    }
    // Over-cap draws are the rare exception, not the norm.
    expect(overCapCount).toBeGreaterThan(0);
    expect(overCapCount / total).toBeLessThan(0.2);

    // Bottom-Team (maxRarity gewöhnlich, order 0). Der Normalfall bleibt gewöhnlich, aber die
    // Über-Cap-Glücksstufe darf SELTEN magisch (order 1) ziehen — nie höher. So bekommt auch die schwache
    // Liga-Hälfte etwas Loot-Varianz, ohne im Schnitt überzahlt zu werden.
    let bottomGewoehnlich = 0;
    let bottomTotal = 0;
    for (let t = 0; t < 100; t += 1) {
      const bottom = rollSponsorOfferSlate({
        seasonId: "season-cap-bottom",
        teamId: `R-${t}`,
        qualityRank: createQualityRank({ teamId: `R-${t}`, qualityRank: 31, maxRarity: "gewöhnlich", targetRarity: "gewöhnlich", leaguePosition: 32 }),
      });
      for (const entry of bottom.entries) {
        bottomTotal += 1;
        expect(SPONSOR_RARITIES[entry.rarity].order).toBeLessThanOrEqual(1); // gewöhnlich or the +1 magisch
        if (entry.rarity === "gewöhnlich") bottomGewoehnlich += 1;
      }
    }
    expect(bottomGewoehnlich / bottomTotal).toBeGreaterThan(0.7); // gewöhnlich stays the norm
  });

  it("produces intra-slate rarity variance — slates are NOT all-one-rarity (seed-correlation regression)", () => {
    // Regression gegen den FNV-1a-Seed-Korrelations-Bug: als der Slot als SUFFIX im Seed stand
    // (`…:sponsor-rarity:${slot}`), lagen die 5 Slot-Rolls nur ~0.0039 auseinander → 94 % aller Slates
    // waren komplett einfarbig (jede Saison „5× dieselbe Rarity"). Mit Slot-PRÄFIX muss der Anteil
    // einfarbiger Slates auf die statistische Erwartung (~8 %) fallen. Cap legendär, damit alle 4
    // Rarities ziehbar sind und Varianz überhaupt sichtbar werden kann.
    let uniform = 0;
    let total = 0;
    for (let season = 0; season < 60; season += 1) {
      for (let team = 0; team < 12; team += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: `season-${season}`,
          teamId: `T-${team}`,
          qualityRank: createQualityRank({ teamId: `T-${team}`, qualityRank: 3, maxRarity: "legendär", targetRarity: "selten", leaguePosition: 3 }),
        });
        total += 1;
        if (new Set(slate.entries.map((entry) => entry.rarity)).size === 1) uniform += 1;
      }
    }
    // Vor dem Fix: ~0.94. Nach dem Fix erwartet ~0.08; großzügige Obergrenze gegen Flakiness.
    expect(uniform / total).toBeLessThan(0.25);
  });

  it("is deterministic — identical input yields an identical slate", () => {
    const input = {
      seasonId: "season-det",
      teamId: "M-M",
      qualityRank: createQualityRank({ teamId: "M-M", qualityRank: 8, maxRarity: "selten", targetRarity: "selten" }),
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
      qualityRank: createQualityRank({ teamId: "R-R", qualityRank: 30, maxRarity: "gewöhnlich", targetRarity: "gewöhnlich", leaguePosition: 31 }),
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
