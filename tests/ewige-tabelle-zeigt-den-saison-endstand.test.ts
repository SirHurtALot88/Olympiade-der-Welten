/**
 * ENTSCHIEDEN VON CHRIS am 22.08.: „ewige tabelle immer zum ende der saison speichern also in
 * Season 2 sehe ich dort Season 1 ergebnisse."
 *
 * DAS DREHT SEINE EIGENE FRUEHERE VORGABE UM, und der Test haelt fest, welche jetzt gilt. Vorher
 * zeigte die Tabelle den EINTRITTSSTAND der Folgesaison (Kader gefuellt, Kaeufe getaetigt) — auf
 * seine damalige Ansage hin, die im Quelltext woertlich zitiert stand: „die snapshots für Cash und
 * Marktwert sollen ja auch erst am anfang der Saison nach den Käufen stattfinden".
 *
 * Die Begruendung fuer den Wechsel ist die staerkere: eine EWIGE Tabelle beantwortet „was hat diese
 * Saison gebracht", nicht „womit ging es weiter". Kaeufe der Folgesaison gehoeren in deren Zeile.
 *
 * BEIDE STAENDE BLEIBEN GESPEICHERT — es ist eine Auswahl, kein Datenverlust. Am Live-Abbild
 * gemessen aendert der Wechsel bei 29 von 32 Teams etwas; Beispiel `M-M`:
 *
 *   Cash   alt 77,1  ->  neu −33,6      (Saisonende im Minus, danach verkauft)
 *   MW     alt 231,1 ->  neu 320,2      (Kader am Saisonende, danach abgebaut)
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";

/**
 * Ein Snapshot mit BEIDEN Staenden, klar auseinandergehalten — so wie er im echten Spielstand
 * liegt, wenn `patchCompletedSeasonSnapshotAfterPreseasonBuy` gelaufen ist.
 */
function spielstand(): GameState {
  return {
    season: { id: "season-2", name: "Saison 2", currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1", status: "planning" },
    teams: [{ teamId: "M-M", shortCode: "MM", name: "Team MM" }],
    players: [],
    rosters: [],
    seasonState: {
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Saison 1",
          // Der Patch ist gelaufen — genau der Fall, in dem die alte Auswahl den Eintrittsstand nahm.
          entryRosterPatchedAt: "2026-08-21T14:09:28.000Z",
          finalStandings: [{ teamId: "M-M", teamCode: "MM", teamName: "Team MM", rank: 1, points: 60 }],
          teamSnapshots: [
            {
              teamId: "M-M",
              teamCode: "MM",
              teamName: "Team MM",
              rank: 1,
              points: 60,
              // SAISONENDE VOR DEN VERKAEUFEN — was jetzt gezeigt werden soll. `cashSeasonEnd`
              // ist laut Typ (olyDataTypes.ts:2654) der Stand am Ende von `player_development`:
              // NACH Sponsorgeld und Gehaltsabzug, VOR dem ersten Verkauf.
              marketValueSeasonEnd: 320.2,
              cashSeasonEnd: -33.6,
              // NACH DEN VERKAEUFEN — bewusst ein anderer Wert, damit die Auswahl beweisbar ist.
              cashEnd: 137.4,
              // EINTRITT IN DIE FOLGESAISON — was vorher gezeigt wurde:
              marketValueTotalEnd: 231.1,
              cashEntry: 77.1,
            },
          ],
        },
      ],
    },
  } as unknown as GameState;
}

function saisonZeile() {
  return buildAllTimeTableModel({ gameState: spielstand() }).rows.find((zeile) => zeile.teamId === "M-M")
    ?.seasons[0];
}

describe("Die Ewige Tabelle zeigt den Saison-ENDSTAND", () => {
  it("nimmt den Marktwert vom Saisonende, nicht den nach den Kaeufen", () => {
    expect(saisonZeile()?.marketValue).toBeCloseTo(320.2, 1);
  });

  it("nimmt den Kontostand vom Saisonende — auch wenn er negativ ist", () => {
    // Der Vorzeichenwechsel ist der Kern: am Saisonende stand M-M im Minus, erst die Verkaeufe
    // danach machten daraus ein Plus. Die Ewige Tabelle soll die Saison zeigen, nicht die Rettung.
    expect(saisonZeile()?.cash).toBeCloseTo(-33.6, 1);
  });

  it("nimmt NICHT die Eintrittswerte der Folgesaison", () => {
    // Die aufgehobene Regel, ausdruecklich festgenagelt, damit sie nicht zurueckkehrt.
    expect(saisonZeile()?.marketValue).not.toBeCloseTo(231.1, 1);
    expect(saisonZeile()?.cash).not.toBeCloseTo(77.1, 1);
  });

  it("nimmt auch NICHT den Stand nach dem Ausverkauf", () => {
    /**
     * DIE ZWEITE FALSCHE ZAHL, und sie ist die verfuehrerischere. `cashEnd` heisst „Ende", traegt
     * aber den Stand NACH den Verkaeufen — an `1hf25q` gemessen steht dort bei `L-K` 137,4, die
     * Spitze direkt nach dem Ausverkauf, gegen 25,6 beim Eintritt. Genau diese Zahl hat Chris
     * beanstandet: „hier sind die verkäufe auch wieder mit dirn!!!"
     */
    expect(saisonZeile()?.cash).not.toBeCloseTo(137.4, 1);
  });

  it("faellt ehrlich zurueck, wenn der Endstand fehlt", () => {
    // Aeltere Snapshots tragen `marketValueSeasonEnd`/`cashEnd` nicht. Dann ist der Eintrittswert
    // die naechstbeste Antwort — besser als ein leeres Feld, aber eben nur der Rueckfall.
    const gs = spielstand() as unknown as {
      seasonState: { seasonSnapshots: Array<{ teamSnapshots: Array<Record<string, unknown>> }> };
    };
    const eintrag = gs.seasonState.seasonSnapshots[0]!.teamSnapshots[0]!;
    delete eintrag.marketValueSeasonEnd;
    delete eintrag.cashSeasonEnd;
    delete eintrag.cashCarryOver;
    delete eintrag.cashEnd;
    const zeile = buildAllTimeTableModel({ gameState: gs as unknown as GameState }).rows[0]?.seasons[0];
    expect(zeile?.marketValue).toBeCloseTo(231.1, 1);
    expect(zeile?.cash).toBeCloseTo(77.1, 1);
  });

  it("laesst Punkte und Rang unberuehrt", () => {
    // Gegenprobe zur Gegenprobe: der Eingriff betrifft NUR Marktwert und Cash.
    expect(saisonZeile()?.points).toBe(60);
    expect(saisonZeile()?.rank).toBe(1);
  });
});
