import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PANEL = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);

/**
 * Die Spieltags-Wertung trug die beiden Disziplinen als eigene SPALTEN (z. B.
 * "BATTLEFIELD · SPURT") und darunter noch einmal die Spieler nach D1/D2 gruppiert —
 * zwei parallele Achsen fuer denselben Sachverhalt, nur unterschiedlich angeordnet.
 *
 * Jetzt traegt die Team-Zeile die Gesamtwerte und darunter steht je Disziplin eine
 * eigene Zeile mit DENSELBEN vier Groessen (Punkte · Form · Mutator · Gesamt). Aus zwei
 * nebeneinanderliegenden Achsen wird damit eine Hierarchie.
 */
describe("Spieltags-Wertung: Disziplin-Zeilen unter dem Team", () => {
  it("rendert je aufgedeckter Disziplin eine eigene Zeile", () => {
    expect(PANEL).toContain('data-testid={`matchday-panel-side-${row.teamId}-${side}`}');
    expect(PANEL).toContain('.filter((side) => sideRevealed[side])');
  });

  it("zeigt dort dieselben vier Größen wie in der Team-Zeile", () => {
    expect(PANEL).toContain("const values = row.bySide[side];");
    for (const field of ["points", "form", "mutator", "total"]) {
      expect(PANEL).toContain(`values.${field}`);
    }
  });

  it("verrät über eine verdeckte Disziplin nichts", () => {
    // null statt 0 — "noch nicht aufgedeckt" ist etwas anderes als "null Punkte".
    expect(PANEL).toContain("points: d1Revealed ? d1Pts ?? 0 : null,");
    expect(PANEL).toContain("points: d2Revealed ? d2Pts ?? 0 : null,");
  });

  it("hängt die Disziplin-Zeilen nicht ans Aufklappen", () => {
    // Der Pfeil steuert nur die Spieler-Chips; die Aufschlüsselung steht immer.
    // Deshalb filtert die Zeilenliste über `sideRevealed`, und erst die Chips darin
    // fragen `openSides`.
    expect(PANEL).toContain("players: openSides.includes(side) ? playersByTeam?.get(row.teamId)?.[side] ?? [] : [],");
  });

  /**
   * "Die Splittung der Punkte soll auf der gleichen Höhe sein wie die Spieler — also
   * keine extra Zeile, sondern dieselbe Zeile. Gesamt oben und darunter zwei Zeilen mit
   * erst die Spieler und rechts die Aufschlüsselung der Punkte."
   *
   * Vorher standen je Disziplin ZWEI Zeilen untereinander: eine mit den vier Zahlen und
   * darunter eine mit den Spieler-Chips. Vier Zeilen pro Team für zwei Disziplinen.
   */
  it("legt Spieler und Zahlen in EINE Zeile", () => {
    const rowStart = PANEL.indexOf("data-testid={`matchday-panel-side-${row.teamId}-${side}`}");
    const rowEnd = PANEL.indexOf("gridColumn: COL.points", rowStart);
    expect(rowStart).toBeGreaterThan(-1);
    expect(rowEnd).toBeGreaterThan(rowStart);
    // Die Chips sitzen innerhalb derselben Zeile, VOR den Zahlenspalten.
    const between = PANEL.slice(rowStart, rowEnd);
    expect(between).toContain("data-testid={`matchday-panel-players-${row.teamId}-${side}`}");
    // Und zwar in der Team-Spalte, damit die Zahlen rechts in ihren Spalten bleiben.
    expect(between).toContain("gridColumn: COL.team");
  });

  /**
   * "Und das Team-Logo kannst du dann so groß wie alle 3 Zeilen machen."
   */
  it("lässt das Wappen über den ganzen Team-Block laufen", () => {
    expect(PANEL).toContain("const blockRowCount = 1 + openSideRows.length;");
    expect(PANEL).toContain("gridRow: `1 / span ${blockRowCount}`");
    // Über der Tönung der Disziplin-Zeilen — die liegt später im DOM und würde dem
    // Wappen sonst die unteren zwei Drittel einfärben.
    const crestStart = PANEL.indexOf("gridColumn: COL.crest");
    expect(PANEL.slice(crestStart, crestStart + 700)).toContain("zIndex: 1");
    // Gedeckelt: ohne `maxHeight` wird das Wappen bei umbrechenden Chips zum Balken.
    expect(PANEL).toContain("maxHeight: 66,");
  });

  it("behält das Sortieren nach einer einzelnen Disziplin", () => {
    // Die Disziplin-Spalten sind weg — die Schalter dafür sind in die Team-Spalte gezogen.
    expect(PANEL).toContain("nach den Punkten dieser Disziplin sortieren");
  });
});
