import { describe, expect, it } from "vitest";

import {
  buildSeasonAwareDisciplineAreaGroups,
  SEASON_DISCIPLINE_AREA_GROUPS,
} from "@/lib/season/season-discipline-area-groups";

/**
 * GEMELDET VON CHRIS (mit Bild): „Showcase hat 6 Spieler in der Season und trotzdem ist SHO
 * nur 2." Ursache, nachgemessen am gemeldeten Spielstand
 * (new-game-1785823388048-1hf25q, Saison season-2): der Saison-Spielplan wuerfelt die
 * Spielerzahl pro Disziplin JEDE Saison neu aus (`buildSeasonPlayerCountByDiscipline` in
 * season-discipline-schedule.ts — dieselbe Zahl, die auch die echte Punkteverteilung steuert,
 * `resolveDisciplinePlayerCount` in rank-to-points.ts). Die alte `SEASON_DISCIPLINE_AREA_GROUPS`-
 * Sortierung nutzte dafuer aber `SEASON_DISCIPLINE_PLAYER_COUNT`, die STATISCHE Katalog-Zahl,
 * die davon komplett unabhaengig ist und nur zufaellig noch mit einer Saison uebereinstimmt.
 *
 * Live gemessen: SOC-Katalog sagt basketball=6 · showcase=5 · football=4 · eiskunst=3 ·
 * battlefield=2 (Reihenfolge BAS·SHO·FOO·EIS·BAT), die echte Saison-2-Auslosung sagte aber
 * basketball=6 · showcase=3 · football=2 · eiskunst=4 · battlefield=5 — keine absteigende Reihe
 * mehr unter der alten Sortierung; SHO landete auf Position 2, obwohl football und battlefield
 * in Wirklichkeit WENIGER bzw. MEHR Spieler hatten als angenommen.
 */
describe("buildSeasonAwareDisciplineAreaGroups", () => {
  it("sortiert die SOC-Gruppe nach der tatsaechlichen Saison-Spielerzahl, nicht nach dem Katalog", () => {
    // Exakt die am gemeldeten Spielstand gemessenen Season-Werte.
    const seasonCounts = {
      basketball: 6,
      showcase: 3,
      football: 2,
      eiskunstlauf: 4,
      battlefield: 5,
    };

    const groups = buildSeasonAwareDisciplineAreaGroups(seasonCounts);
    const soc = groups.find((group) => group.id === "soc");

    // Absteigend nach dem ECHTEN Saison-Wert: BAS(6) · BAT(5) · EIS(4) · SHO(3) · FOO(2).
    expect(soc?.keys).toEqual(["basketball", "battlefield", "eiskunst", "showcase", "football"]);
  });

  it("Gegenprobe: die alte statische Sortierung setzt SHO tatsaechlich auf Position 2", () => {
    const soc = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.id === "soc");
    // Katalog: basketball=6 · showcase=5 · football=4 · eiskunst=3 · battlefield=2 —
    // exakt die Reihenfolge, die Chris' Meldung beschreibt (SHO an zweiter Stelle).
    expect(soc?.keys).toEqual(["basketball", "showcase", "football", "eiskunst", "battlefield"]);
    expect(soc?.keys.indexOf("showcase")).toBe(1);
  });

  it("faellt ohne Season-Wert fuer eine einzelne Disziplin auf die Katalog-Zahl zurueck", () => {
    // Nur basketball bekommt einen (Season-)Wert, der Rest der SOC-Gruppe fehlt in der Map —
    // dort greift pro Disziplin einzeln der Katalog-Fallback (showcase=5 · football=4 ·
    // eiskunst=3 · battlefield=2), nicht ein Absturz der ganzen Sortierung.
    const groups = buildSeasonAwareDisciplineAreaGroups({ basketball: 2 });
    const soc = groups.find((group) => group.id === "soc");
    expect(soc?.keys[0]).toBe("showcase");
  });

  it("akzeptiert auch eine Map (wie buildSeasonDisciplinePlayerCountMap sie liefert)", () => {
    const map = new Map<string, number | null>([
      ["basketball", 2],
      ["showcase", 6],
      ["football", 5],
      ["eiskunstlauf", 4],
      ["battlefield", 3],
    ]);
    const groups = buildSeasonAwareDisciplineAreaGroups(map);
    const soc = groups.find((group) => group.id === "soc");
    expect(soc?.keys).toEqual(["showcase", "football", "eiskunst", "battlefield", "basketball"]);
  });

  it("bleibt bei allen vier Achsen bei denselben Disziplinen wie die statische Variante — nur die Reihenfolge aendert sich", () => {
    const groups = buildSeasonAwareDisciplineAreaGroups({});
    for (const staticGroup of SEASON_DISCIPLINE_AREA_GROUPS) {
      const seasonGroup = groups.find((group) => group.id === staticGroup.id);
      expect(new Set(seasonGroup?.keys)).toEqual(new Set(staticGroup.keys));
    }
  });
});
