import { describe, expect, it } from "vitest";

import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { getDemandMultiplierForRarity, rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import { getSponsorCurveFamily } from "@/lib/sponsor/sponsor-curve-shapes";
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

  it("gives EVERY team the same full rarity distribution — no quality-rank cap (bottom teams can roll legendär)", () => {
    // Rebalance: der frühere Qualitäts-Rang-Deckel ist weg. Tabellenführer wie Schlusslicht ziehen aus
    // DERSELBEN vollen Verteilung (gewöhnlich 50 / magisch 30 / selten 14 / legendär 6). Ein Bottom-Team
    // darf also — selten, aber eben doch — legendäre Angebote sehen, genau wie ein Top-Team.
    const sample = (teamPrefix: string, leaguePosition: number) => {
      const counts: Record<string, number> = { gewöhnlich: 0, magisch: 0, selten: 0, legendär: 0 };
      let total = 0;
      for (let t = 0; t < 300; t += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: "season-equal",
          teamId: `${teamPrefix}-${t}`,
          // maxRarity ist bewusst noch gewöhnlich gesetzt, um zu beweisen, dass der Deckel NICHT mehr greift.
          qualityRank: createQualityRank({ teamId: `${teamPrefix}-${t}`, qualityRank: leaguePosition, maxRarity: "gewöhnlich", targetRarity: "gewöhnlich", leaguePosition }),
        });
        for (const entry of slate.entries) {
          counts[entry.rarity] += 1;
          total += 1;
        }
      }
      return { counts, total };
    };

    const bottom = sample("BOT", 32);
    const top = sample("TOP", 1);

    // Das Bottom-Team zieht ALLE Rarities inklusive legendär — der Deckel ist wirklich weg.
    expect(bottom.counts.legendär).toBeGreaterThan(0);
    expect(bottom.counts.selten).toBeGreaterThan(0);

    // Marginalverteilung entspricht ~ den Draw-Weights (50/30/14/6), nicht mehr ~91 % gewöhnlich.
    const bottomCommonShare = bottom.counts.gewöhnlich / bottom.total;
    expect(bottomCommonShare).toBeGreaterThan(0.4);
    expect(bottomCommonShare).toBeLessThan(0.6);

    // Bottom- und Top-Team haben (ohne Beliebtheits-Lift) statistisch dieselbe Verteilung.
    const topCommonShare = top.counts.gewöhnlich / top.total;
    expect(Math.abs(bottomCommonShare - topCommonShare)).toBeLessThan(0.08);
    const bottomLegendaryShare = bottom.counts.legendär / bottom.total;
    const topLegendaryShare = top.counts.legendär / top.total;
    expect(Math.abs(bottomLegendaryShare - topLegendaryShare)).toBeLessThan(0.05);
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
