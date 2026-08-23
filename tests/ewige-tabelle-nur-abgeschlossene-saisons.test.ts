/**
 * GEMELDET, zwei Meldungen mit derselben Ursache (Spielstand `swnjlk`, Saison 2, Spieltag 1):
 *
 *   `bia63a`  „in der Ewigen Tabelle haben alle Teams doppelte Punkte - da wird was doppelt
 *              gespeichert, bitte fixen"
 *   `6l1b0i`  „in der ewigen Tabelle sollen wirklich nur vergangene abgeschlossene Seasons
 *              getrackt werden!"
 *
 * NICHTS WIRD DOPPELT GESPEICHERT. Am Live-Abbild nachgezaehlt (scripts/messe-ewige-tabelle-
 * doppelt.ts) liegt je Saison genau EIN Snapshot — `swnjlk` hatte einen einzigen fuer season-1,
 * 32 Teamzeilen. Chris' Verdacht auf die Speicherung war der naheliegende, aber der falsche.
 *
 * DIE VERDOPPLUNG ENTSTAND BEIM RECHNEN. `buildAllTimeTableModel` haengte die LAUFENDE Saison als
 * eigene Zeile an, sobald ein Standings-Feed geladen war. Am Saisonanfang traegt dieser Feed noch
 * den Stand der eben beendeten Saison — die stand damit zweimal in der Liste: einmal als Snapshot,
 * einmal als „live". `cumulativePoints` summiert ueber alle Zeilen, also verdoppelten sich die
 * Punkte bei JEDEM Team gleichzeitig. Genau das hat Chris gesehen.
 *
 * Der Fix ist derselbe, den seine zweite Meldung ohnehin verlangt: die laufende Saison gehoert
 * nicht in eine Ewige Tabelle. Damit ist die Verdopplung strukturell unmoeglich statt nur behoben.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel, type LiveTeamStanding } from "@/lib/foundation/all-time-table";

const TEAMS = [
  { teamId: "T-1", shortCode: "T1", name: "Team Eins" },
  { teamId: "T-2", shortCode: "T2", name: "Team Zwei" },
];

/** Ein abgeschlossener Saison-1-Snapshot mit klaren Punktzahlen. */
function spielstand(): GameState {
  return {
    season: { id: "season-2", name: "Saison 2", currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1", status: "planning" },
    teams: TEAMS,
    players: [],
    rosters: [],
    seasonState: {
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Saison 1",
          createdAt: "2026-08-21T14:09:28.000Z",
          // Beide Felder: `resolveSeasonSnapshotTeamRecords` bevorzugt `teamSnapshots`,
          // `buildAllTimeTableFromSnapshots` (Medaillen/Ø-Rang) liest `finalStandings`.
          finalStandings: [
            { teamId: "T-1", teamCode: "T1", teamName: "Team Eins", rank: 1, points: 60 },
            { teamId: "T-2", teamCode: "T2", teamName: "Team Zwei", rank: 2, points: 40 },
          ],
          teamSnapshots: [
            { teamId: "T-1", teamCode: "T1", teamName: "Team Eins", rank: 1, points: 60, marketValueEnd: 100, cashEnd: 10 },
            { teamId: "T-2", teamCode: "T2", teamName: "Team Zwei", rank: 2, points: 40, marketValueEnd: 90, cashEnd: 8 },
          ],
        },
      ],
    },
  } as unknown as GameState;
}

/**
 * Der Standings-Feed, wie er an Spieltag 1 der neuen Saison aussieht: er traegt noch den Stand der
 * eben beendeten Saison. Das ist keine Erfindung fuer den Test, sondern die Lage aus der Meldung.
 */
const FEED_MIT_VORSAISON_STAND: Record<string, LiveTeamStanding> = {
  "T-1": { rank: 1, points: 60, marketValue: 100, cash: 10 },
  "T-2": { rank: 2, points: 40, marketValue: 90, cash: 8 },
};

describe("Die Ewige Tabelle zaehlt nur abgeschlossene Saisons", () => {
  it("verdoppelt die Punkte NICHT, wenn der Feed den Vorsaison-Stand traegt", () => {
    // Der gemeldete Fall, Zahl fuer Zahl: 60 muessen 60 bleiben, nicht 120 werden.
    const modell = buildAllTimeTableModel({
      gameState: spielstand(),
      liveStandingsByTeamId: FEED_MIT_VORSAISON_STAND,
    });
    expect(modell.rows.find((zeile) => zeile.teamId === "T-1")?.cumulativePoints).toBe(60);
    expect(modell.rows.find((zeile) => zeile.teamId === "T-2")?.cumulativePoints).toBe(40);
  });

  it("fuehrt die laufende Saison in keiner Zeile", () => {
    const modell = buildAllTimeTableModel({
      gameState: spielstand(),
      liveStandingsByTeamId: FEED_MIT_VORSAISON_STAND,
    });
    for (const zeile of modell.rows) {
      expect(zeile.seasons.map((saison) => saison.seasonId)).toEqual(["season-1"]);
      expect(zeile.seasons.some((saison) => saison.isLive)).toBe(false);
    }
  });

  it("nennt die laufende Saison auch nicht in den Achsen-Beschriftungen", () => {
    // Sonst haette die Liga-Grafik eine Spalte, zu der keine Zeile gehoert.
    const modell = buildAllTimeTableModel({
      gameState: spielstand(),
      liveStandingsByTeamId: FEED_MIT_VORSAISON_STAND,
    });
    expect(modell.seasonLabels).toHaveLength(1);
    expect(modell.seasonLabels.join(" ")).not.toContain("2");
  });

  it("liefert dasselbe Ergebnis mit und ohne Feed", () => {
    // Die eigentliche Zusage: der Live-Feed darf das Ergebnis dieser Tabelle nicht mehr bewegen.
    const mit = buildAllTimeTableModel({ gameState: spielstand(), liveStandingsByTeamId: FEED_MIT_VORSAISON_STAND });
    const ohne = buildAllTimeTableModel({ gameState: spielstand(), liveStandingsByTeamId: null });
    expect(mit.rows.map((zeile) => [zeile.teamId, zeile.cumulativePoints])).toEqual(
      ohne.rows.map((zeile) => [zeile.teamId, zeile.cumulativePoints]),
    );
    expect(mit.seasonLabels).toEqual(ohne.seasonLabels);
  });

  it("zaehlt die archivierten Saisons weiterhin richtig", () => {
    // Gegenprobe zur Gegenprobe: haette der Eingriff die Snapshots mit entfernt, waere die
    // Tabelle jetzt leer — und alle Zusagen oben trivial erfuellt.
    const modell = buildAllTimeTableModel({ gameState: spielstand(), liveStandingsByTeamId: null });
    expect(modell.archivedSeasonCount).toBe(1);
    expect(modell.hasHistory).toBe(true);
    expect(modell.rows).toHaveLength(2);
  });
});
