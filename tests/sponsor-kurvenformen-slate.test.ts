/**
 * KURVENFORMEN IM SLATE — jeder Angebots-Slot bekommt eine eigene Form (sponsor-tier-pool.ts).
 *
 * Ohne Ziehung ohne Zuruecklegen waeren fuenf Angebote nur fuenf Preise fuer dieselbe Kurve — genau
 * der Zustand, den docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md und dieser Umbau beheben sollen.
 */
import { describe, expect, it } from "vitest";

import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
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

describe("Sponsor-Slate: Kurvenformen je Slot", () => {
  it("jeder Slot traegt eine Form aus dem Katalog, und alle Formen eines Slates sind paarweise verschieden", () => {
    for (let team = 0; team < 12; team += 1) {
      const slate = rollSponsorOfferSlate({
        seasonId: "season-formen",
        teamId: `T-${team}`,
        qualityRank: qualityRank(`T-${team}`, 1 + team),
      });
      const shapes = slate.entries.map((entry) => entry.curveShape);
      for (const shape of shapes) {
        expect(SPONSOR_CURVE_SHAPE_KEYS, `${shape} nicht im Katalog`).toContain(shape);
      }
      expect(new Set(shapes).size, `T-${team}: Formen nicht paarweise verschieden (${shapes.join(", ")})`).toBe(
        shapes.length,
      );
    }
  });

  it("ist deterministisch: derselbe (seasonId, teamId) liefert zweimal dieselben Formen", () => {
    const input = {
      seasonId: "season-determinismus",
      teamId: "M-M",
      qualityRank: qualityRank("M-M", 5),
    };
    const first = rollSponsorOfferSlate(input).entries.map((entry) => entry.curveShape);
    const second = rollSponsorOfferSlate(input).entries.map((entry) => entry.curveShape);
    expect(second).toEqual(first);
  });

  it("verschiedene Teams derselben Saison bekommen unterschiedliche Formen — kein globaler Fixwert", () => {
    const seasonId = "season-vielfalt";
    const slates = Array.from({ length: 8 }, (_, index) =>
      rollSponsorOfferSlate({
        seasonId,
        teamId: `T-${index}`,
        qualityRank: qualityRank(`T-${index}`, 1 + index * 4),
      }).entries.map((entry) => entry.curveShape),
    );
    // Nicht ALLE Teams duerfen exakt denselben Formen-Satz in derselben Reihenfolge bekommen — sonst
    // haengt die Ziehung nur am Saison-Seed, nicht an der Team-ID.
    const serialized = slates.map((shapes) => shapes.join(","));
    expect(new Set(serialized).size, "alle Teams bekamen denselben Formen-Satz").toBeGreaterThan(1);
  });
});
