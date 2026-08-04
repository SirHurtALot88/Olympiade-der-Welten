/**
 * LAUFZEIT IM SLATE (Umsetzungsplan D) — je Slot gewuerfelt in `rollSponsorOfferSlate`
 * (sponsor-tier-pool.ts). Diese Tests sind bewusst nach demselben Muster wie
 * sponsor-kurvenformen-slate.test.ts und tests/sponsor-tier-pool.test.ts (Rarity-Intra-Slate-Test)
 * gebaut — DIESELBE Seed-Falle (#360, #362) ist hier ZWEIMAL relevant, weil dieser Wurf sowohl
 * Intra-Slate- als auch Inter-Team-Varianz braucht (siehe Kommentar bei der Ziehung selbst).
 */
import { describe, expect, it } from "vitest";

import { rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";

function qualityRank(teamId: string, position: number): SponsorTeamQualityRank {
  return {
    teamId,
    qualityRank: position,
    components: [],
    maxRarity: "legendär",
    targetRarity: "magisch",
    leaguePosition: position,
    leaguePercentile: (position / 32) * 100,
  };
}

describe("Sponsor-Slate: Laufzeit je Slot", () => {
  it("jedes Angebot traegt eine gueltige Laufzeit (1/2/3 Saisons)", () => {
    const slate = rollSponsorOfferSlate({
      seasonId: "season-laufzeit",
      teamId: "M-M",
      qualityRank: qualityRank("M-M", 5),
    });
    for (const entry of slate.entries) {
      expect([1, 2, 3]).toContain(entry.termSeasons);
    }
  });

  it("ist deterministisch: derselbe (seasonId, teamId) liefert zweimal dieselben Laufzeiten", () => {
    const input = { seasonId: "season-determinismus", teamId: "M-M", qualityRank: qualityRank("M-M", 5) };
    const first = rollSponsorOfferSlate(input).entries.map((entry) => entry.termSeasons);
    const second = rollSponsorOfferSlate(input).entries.map((entry) => entry.termSeasons);
    expect(second).toEqual(first);
  });

  it("Mehrheit einjaehrig — Marginalverteilung ueber viele Teams nahe den Zielgewichten (3:1:1)", () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    let total = 0;
    for (let season = 0; season < 40; season += 1) {
      for (let team = 0; team < 32; team += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: `season-${season}`,
          teamId: `T-${team}`,
          qualityRank: qualityRank(`T-${team}`, 1 + team),
        });
        for (const entry of slate.entries) {
          counts[entry.termSeasons] += 1;
          total += 1;
        }
      }
    }
    const share1 = counts[1]! / total;
    const share2 = counts[2]! / total;
    const share3 = counts[3]! / total;
    // Zielgewichte 3:1:1 -> 60/20/20 %; grosszuegiges Band gegen statistisches Rauschen.
    expect(share1).toBeGreaterThan(0.5);
    expect(share1).toBeLessThan(0.7);
    expect(share2).toBeGreaterThan(0.1);
    expect(share2).toBeLessThan(0.3);
    expect(share3).toBeGreaterThan(0.1);
    expect(share3).toBeLessThan(0.3);
  });

  it("produziert Intra-Slate-Varianz — nicht jedes Slate zieht 5x dieselbe Laufzeit (Seed-Korrelations-Regression, wie bei Rarity #360)", () => {
    let uniform = 0;
    let total = 0;
    for (let season = 0; season < 60; season += 1) {
      for (let team = 0; team < 12; team += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: `season-${season}`,
          teamId: `T-${team}`,
          qualityRank: qualityRank(`T-${team}`, 3),
        });
        total += 1;
        if (new Set(slate.entries.map((entry) => entry.termSeasons)).size === 1) uniform += 1;
      }
    }
    // Bei einer 3-Kandidaten-Ziehung mit Gewichten 3:1:1 liegt die statistische Monochrom-Erwartung
    // (alle 5 Slots ziehen dieselbe Laufzeit) bei ~(0.6^5+0.2^5+0.2^5) ≈ 8.1 %. Ein Seed, der Slot nur
    // als Suffix behandelt, kollabiert stattdessen auf > 90 % (siehe #360-Regression).
    expect(uniform / total).toBeLessThan(0.25);
  });

  it("verschiedene Teams derselben Saison bekommen unterschiedliche Laufzeit-Verteilungen — kein globaler Fixwert je Saison (Seed-Korrelations-Regression, wie bei Achsen/Kurvenformen #360/#362)", () => {
    // Der Kern der Abnahme-Vorgabe: ueber 8-12 Teams derselben Saison muessen verschiedene Laufzeiten
    // herauskommen — nicht alle 12 Teams duerfen fuer denselben Slot dieselbe Laufzeit ziehen.
    let seasonsWithSingleValueAcrossTeams = 0;
    const totalSeasons = 40;
    for (let season = 0; season < totalSeasons; season += 1) {
      const seasonId = `season-vielfalt-${season}`;
      const slot0Terms = Array.from({ length: 12 }, (_, team) =>
        rollSponsorOfferSlate({
          seasonId,
          teamId: `T-${team}`,
          qualityRank: qualityRank(`T-${team}`, 1 + team),
        }).entries[0]!.termSeasons,
      );
      if (new Set(slot0Terms).size === 1) seasonsWithSingleValueAcrossTeams += 1;
    }
    // Vor dem Fix (Slot als reiner Praefix, Team-ID direkt am Ende): 25 von 60 Saisons kollabierten auf
    // eine einzige Laufzeit fuer alle 12 Teams. Mit dem gewaehlten Seed (Slot, dann Team, dann Saison)
    // duerfen es nur vereinzelte Ausreisser sein.
    expect(seasonsWithSingleValueAcrossTeams).toBeLessThan(totalSeasons * 0.2);

    // Zusaetzlich, konkret ueber 8-12 Teams EINER Saison: mindestens zwei verschiedene Laufzeiten
    // muessen vorkommen (das ist die woertliche Abnahme-Vorgabe aus dem Plan).
    const seasonId = "season-vielfalt-check";
    const teamCount = 12;
    const terms = Array.from({ length: teamCount }, (_, team) =>
      rollSponsorOfferSlate({
        seasonId,
        teamId: `T-${team}`,
        qualityRank: qualityRank(`T-${team}`, 1 + team),
      }).entries[0]!.termSeasons,
    );
    expect(new Set(terms).size, `Laufzeiten ueber ${teamCount} Teams: ${terms.join(",")}`).toBeGreaterThan(1);
  });
});
