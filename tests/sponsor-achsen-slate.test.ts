/**
 * ACHSEN IM SLATE — jeder Achsen-Slot bekommt eine eigene Achse (sponsor-tier-pool.ts).
 *
 * Der Achsen-Seed hatte dieselbe FNV-1a-Schwäche wie ehedem der Kurvenform-Seed (siehe PR #360):
 * mit der variierenden Komponente am Seed-ANFANG und Saison/Team dahinter blieb die Reihenfolge
 * für alle Teams derselben Saison praktisch identisch — FNV-1a avalanched erst NACH dem Zeichen,
 * an dem sich zwei Seeds zum ersten Mal unterscheiden. Dieser Test nagelt die drei Eigenschaften
 * fest, die der Fix herstellt: Ziehung ohne Zurücklegen, Determinismus je (Saison, Team), und
 * echte Varianz ZWISCHEN Teams derselben Saison.
 */
import { describe, expect, it } from "vitest";

import { SPONSOR_V4_AXIS_KEYS } from "@/lib/sponsor/sponsor-v3-model";
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

function axisOrderFor(seasonId: string, teamId: string, position: number): string[] {
  const slate = rollSponsorOfferSlate({
    seasonId,
    teamId,
    qualityRank: qualityRank(teamId, position),
  });
  return slate.entries
    .filter((entry) => entry.axisKey != null)
    .map((entry) => entry.axisKey!);
}

describe("Sponsor-Slate: Achsen je Slot", () => {
  it("jeder Achsen-Slot traegt eine Achse aus dem Katalog, und alle Achsen eines Slates sind paarweise verschieden", () => {
    for (let team = 0; team < 12; team += 1) {
      const axes = axisOrderFor("season-achsen", `T-${team}`, 1 + team);
      for (const axis of axes) {
        expect(SPONSOR_V4_AXIS_KEYS, `${axis} nicht im Katalog`).toContain(axis);
      }
      expect(new Set(axes).size, `T-${team}: Achsen nicht paarweise verschieden (${axes.join(", ")})`).toBe(
        axes.length,
      );
    }
  });

  it("ist deterministisch: derselbe (seasonId, teamId) liefert zweimal dieselbe Achsen-Reihenfolge", () => {
    const seasonId = "season-determinismus";
    const teamId = "M-M";
    const first = axisOrderFor(seasonId, teamId, 5);
    const second = axisOrderFor(seasonId, teamId, 5);
    expect(second).toEqual(first);
  });

  it("verschiedene Teams derselben Saison bekommen unterschiedliche Achsen-Reihenfolgen — kein globaler Fixwert", () => {
    const seasonId = "season-vielfalt";
    const orders = Array.from({ length: 12 }, (_, index) => axisOrderFor(seasonId, `T-${index}`, 1 + index));
    // Nicht ALLE Teams duerfen exakt dieselbe Achsen-Reihenfolge bekommen — sonst haengt die Ziehung
    // nur am Saison-Seed, nicht an der Team-ID (das war genau der Fehler vor dem Fix).
    const serialized = orders.map((order) => order.join(","));
    expect(new Set(serialized).size, "alle Teams bekamen dieselbe Achsen-Reihenfolge").toBeGreaterThan(1);
  });
});
