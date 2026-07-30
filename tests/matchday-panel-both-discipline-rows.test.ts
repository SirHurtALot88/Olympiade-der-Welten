import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const panel = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);

/**
 * "Ich haette hier gern im Spieltags-Ranking darueber noch eine Zeile, wo die
 * Spieler aus der ersten Diszi auch aufgelistet sind mit ihren PPs."
 *
 * Unter der Teamzeile stand bisher nur EINE Disziplin — die zuletzt gewertete.
 * Nach D2 war D1 damit unsichtbar, obwohl beide in dieselbe Spieltags-Summe
 * eingehen. Der Kopf-Chevron konnte umschalten, aber eben nur umschalten.
 */
describe("Spieltags-Wertung: beide Disziplinen untereinander", () => {
  it("zeigt im Default alle AUFGEDECKTEN Seiten statt nur der letzten", () => {
    expect(panel).toContain("const openSides: Array<\"d1\" | \"d2\"> = expandTouched");
    expect(panel).toContain('(["d1", "d2"] as const).filter((side) => sideRevealed[side])');
  });

  it("haelt die Reihenfolge D1 oben, D2 darunter", () => {
    // Die Filterreihenfolge ist die Renderreihenfolge — D1 zuerst.
    const openSidesBlock = panel.slice(panel.indexOf("const openSides"), panel.indexOf("const openSides") + 400);
    expect(openSidesBlock.indexOf('"d1"')).toBeLessThan(openSidesBlock.indexOf('"d2"'));
    // Die Zeilen selbst haengen an `sideRevealed`, nicht mehr an `openSides`: seit
    // Spieler und Punkt-Aufschluesselung EINE Zeile sind, muss die Zeile auch dann
    // stehen, wenn die Spieler eingeklappt sind. `openSides` entscheidet nur noch
    // darueber, ob die Chips darin auftauchen.
    expect(panel).toContain('const openSideRows = (["d1", "d2"] as const)');
    expect(panel).toContain("players: openSides.includes(side) ? playersByTeam?.get(row.teamId)?.[side] ?? [] : [],");
  });

  it("laesst verdeckte Disziplinen weg (Anti-Spoiler)", () => {
    // Gefiltert wird ueber `sideRevealed`, nicht ueber "gibt es Spieler?".
    expect(panel).toContain("filter((side) => sideRevealed[side])");
  });

  it("beschriftet jede Zeile mit ihrer Disziplin", () => {
    // Zwei gleich aussehende Chip-Reihen untereinander waeren sonst nicht
    // auseinanderzuhalten.
    expect(panel).toContain("{side.toUpperCase()}");
    expect(panel).toContain('const disc = side === "d1" ? d1 : d2;');
    expect(panel).toContain('{disc?.displayName ?? (side === "d1" ? "Disziplin 1" : "Disziplin 2")}');
  });

  it("faerbt die PP weiter gegen den Pool DIESER Disziplin", () => {
    // Sonst verglichen sich D1-Spieler ploetzlich mit dem D2-Feld.
    expect(panel).toContain("getPoolHeatClass(entry.pp, ppPoolBySide[side])");
  });

  it("gibt jeder Zeile ihre eigene Test-ID", () => {
    expect(panel).toContain("data-testid={`matchday-panel-players-${row.teamId}-${side}`}");
  });

  it("laesst den Chevron weiter auf EINE Seite einschraenken", () => {
    // Eigene Wahl schlaegt den Default — inklusive bewusstem Zuklappen.
    expect(panel).toContain("const isOpen = openSides.includes(side);");
    expect(panel).toContain("setExpandedSide(side);");
  });

  it("klappt beim Klick auf eine von zwei offenen Seiten nur diese zu", () => {
    // Vorher haette `isOpen ? null : side` beide weggeraeumt.
    expect(panel).toContain(
      "setExpandedSide(openSides.length > 1 && sideRevealed[otherSide] ? otherSide : null);",
    );
  });
});
