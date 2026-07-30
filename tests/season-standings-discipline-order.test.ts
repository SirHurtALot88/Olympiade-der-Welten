import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER,
} from "@/lib/season/season-discipline-area-groups";

const standings = readFileSync(join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"), "utf8");

/**
 * "Im Saisonstand sollen die Reihenfolgen der ausklappbaren Diszis immer die
 * Standardreihenfolge sein: TDM, Mini DM, Gewichtheben usw. — und in Klammern
 * dahinter die Zahl, wie viele Spieler diese Season dort teilgenommen haben pro
 * Team."
 *
 * `SEASON_DISCIPLINE_AREA_GROUPS` sortiert die Disziplinen nach Kadergroesse.
 * Das war eine Anforderung an die RANG-Tabelle (dort korrespondiert die Spalte
 * mit der Spielerzahl) und ist ueber den gemeinsamen Export im Saisonstand
 * gelandet, wo POW dadurch GEW · HOC · BRE · TDM · MIN las.
 */
describe("Saisonstand: Disziplinen in kanonischer Reihenfolge", () => {
  it("liefert den Standard-Export in der Katalog-Reihenfolge", () => {
    const pow = SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.find((group) => group.id === "pow");
    expect(pow?.keys).toEqual(["tdm", "mini_dm", "gewichtheben", "hockey", "breaking"]);
  });

  it("laesst die nach Kadergroesse sortierte Variante unveraendert", () => {
    // Die Rang-Tabelle haengt daran — der neue Export ist additiv, kein Umbau.
    const pow = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.id === "pow");
    expect(pow?.keys).toEqual(["gewichtheben", "hockey", "breaking", "tdm", "mini_dm"]);
  });

  it("enthaelt in beiden Varianten exakt dieselben Disziplinen je Achse", () => {
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER) {
      const sorted = SEASON_DISCIPLINE_AREA_GROUPS.find((entry) => entry.id === group.id);
      expect(new Set(group.keys), group.id).toEqual(new Set(sorted?.keys));
    }
  });

  it("nutzt der Saisonstand die Standard-Reihenfolge statt group.keys", () => {
    expect(standings).toContain("SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER");
    expect(standings).toContain("standardOrderKeysByArea.get(group.id)?.map((key)");
  });

  it("zeigt die Teilnehmerzahl des Teams hinter dem Kuerzel", () => {
    expect(standings).toContain("const participantCount = participants?.length ?? 0;");
    expect(standings).toContain('<small className="nl-standings-disc-count nl-tnum">({participantCount})</small>');
    // Tooltip benennt, WESSEN Spieler gezaehlt werden — die Zahl ist teambezogen,
    // nicht ligaweit.
    expect(standings).toContain("Spieler dieses Teams waren diese Saison hier im Einsatz");
  });
});
