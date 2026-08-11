import { describe, expect, it } from "vitest";

import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { getDemandMultiplierForRarity, rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import { SPONSOR_V4_AXIS_KEYS } from "@/lib/sponsor/sponsor-v3-model";

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

describe("sponsor offer slate (rarity + Modellkurven)", () => {
  it("stellt eine Basis-Karte und vier VERSCHIEDENE Achsen ins Slate", () => {
    // Frueher waren es fuenf Risikoprofile um dieselbe Rangleiter — alle mit identischem
    // Erwartungswert, aber mit einem Ausschlag von nur +-1 bis 3 C. Das war keine Wahl.
    // Jetzt traegt Slot 0 die risikofreie Basis, und jeder weitere Slot eine ANDERE Achse: die
    // Entscheidung ist, wofuer man diese Saison bezahlt werden will.
    const slate = rollSponsorOfferSlate({
      seasonId: "season-slate",
      teamId: "M-M",
      qualityRank: createQualityRank({ teamId: "M-M", qualityRank: 5, maxRarity: "legendär", targetRarity: "selten" }),
    });
    expect(slate.entries).toHaveLength(5);
    expect(slate.entries[0]!.cardKey).toBe("basis");
    expect(slate.entries[0]!.axisKey).toBeUndefined();

    const axes = slate.entries.slice(1).map((entry) => entry.axisKey);
    expect(axes.every((key) => key != null)).toBe(true);
    // Zwei Karten auf derselben Achse waeren keine Wahl, sondern zwei Preise fuer dasselbe.
    expect(new Set(axes).size).toBe(axes.length);
    for (const key of axes) {
      expect(SPONSOR_V4_AXIS_KEYS).toContain(key);
    }
    // Eine Achse bleibt je Saison uebrig — das rotiert das Slate von selbst.
    expect(axes.length).toBe(SPONSOR_V4_AXIS_KEYS.length - 1);
  });

  it("bietet keine Achse an, die dieses Team gar nicht bewegen kann — deckelt aber die Kartenzahl nicht mehr", () => {
    // GEFILTERT STATT GEKLAMMERT bleibt: eine unerfuellbare Achse waere eine Karte, die dieses Team
    // niemals einloest.
    //
    // GEAENDERT hat sich, was daraus FOLGT. Frueher bestimmte die Zahl der bespielbaren Achsen auch
    // die Zahl der Karten (1 Basis + je eine Achse), ein Team mit zwei Achsen bekam also drei statt
    // fuenf Angebote. Seit die Gebaeude-Karten die zwei Leih-Ziele tragen statt einer Achse
    // unterscheiden sie sich ueber Gebaeude, Groesse und Rarität — die Achsen entscheiden nichts
    // mehr, duerfen die Auswahl also auch nicht mehr verkleinern.
    const slate = rollSponsorOfferSlate({
      seasonId: "season-slate",
      teamId: "M-M",
      qualityRank: createQualityRank({ teamId: "M-M", qualityRank: 5, maxRarity: "legendär", targetRarity: "selten" }),
      offerableAxes: ["ausbau", "soliditaet"],
    });
    expect(slate.entries).toHaveLength(5);
    // Die zugeteilten Achsen stammen weiterhin ausschliesslich aus der erlaubten Liste.
    for (const eintrag of slate.entries.slice(1)) {
      if (eintrag.axisKey != null) {
        expect(["ausbau", "soliditaet"]).toContain(eintrag.axisKey);
      }
    }
  });

  it("wuerfelt deterministisch — zweimal dasselbe Team ergibt dasselbe Slate", () => {
    const roll = () =>
      rollSponsorOfferSlate({
        seasonId: "season-det",
        teamId: "V-D",
        qualityRank: createQualityRank({ teamId: "V-D", qualityRank: 16, maxRarity: "legendär", targetRarity: "magisch" }),
      });
    expect(roll()).toEqual(roll());
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
