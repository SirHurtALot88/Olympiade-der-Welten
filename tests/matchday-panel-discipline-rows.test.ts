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
    const sideRowIndex = PANEL.indexOf("matchday-panel-side-");
    const playerRowIndex = PANEL.indexOf("matchday-panel-players-");
    expect(sideRowIndex).toBeGreaterThan(-1);
    // Die Disziplin-Zeile wird VOR den Spieler-Chips gerendert.
    expect(sideRowIndex).toBeLessThan(playerRowIndex);
  });

  it("behält das Sortieren nach einer einzelnen Disziplin", () => {
    // Die Disziplin-Spalten sind weg — die Schalter dafür sind in die Team-Spalte gezogen.
    expect(PANEL).toContain("nach den Punkten dieser Disziplin sortieren");
  });
});
