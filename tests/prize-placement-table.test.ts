/**
 * DAS PLATZIERUNGSTABELLEN-DOPPEL IST AUFGELOEST — und dieser Test haelt es aufgeloest.
 *
 * Vor dem V3-Umbau gab es zwei Tabellen, die dieselbe Groesse behaupteten: die Sheet-Tabelle aus
 * `references/sheets/prize-money-table.csv` (die der Preisgeld-Benchmark benutzt, +1,28 aufwaerts /
 * −0,96 abwaerts) und eine Code-Tabelle `getSponsorPlacementLookup()` (±8,33 fuer einen Platz). Sie
 * lagen um Faktor sechs auseinander. Geblieben ist die Sheet-Tabelle.
 *
 * `lib/season/prize-placement-table.ts` haelt sie synchron lesbar vor (die Angebotserzeugung ist
 * synchron und laeuft auch im Client-Bundle, das CSV-Lesen ist asynchron und dateisystemgebunden).
 * Dieser Test liest das CSV und vergleicht Zeile fuer Zeile — die Doppelhaltung ist damit
 * abgesichert und nicht gehofft.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getPrizePlacementBonus,
  getPrizePlacementRows,
  PRIZE_PLACEMENT_EFFECTIVE_CAP,
  PRIZE_PLACEMENT_SHEET_TABLE,
} from "@/lib/season/prize-placement-table";

function readSheetPlacementRows(): Array<[number, number]> {
  const csv = fs.readFileSync(
    path.join(process.cwd(), "references", "sheets", "prize-money-table.csv"),
    "utf8",
  );
  const rows: Array<[number, number]> = [];
  // Die Platzierungsspalten stehen in Spalte 0 (rankDelta) und 1 (Betrag), ab Datenzeile 3.
  for (const line of csv.split(/\r?\n/).slice(2)) {
    const cells = line.split(",");
    const delta = Number(cells[0]);
    const amount = Number(cells[1]);
    if (cells[0]?.trim() && cells[1]?.trim() && Number.isFinite(delta) && Number.isFinite(amount)) {
      rows.push([delta, amount]);
    }
  }
  return rows;
}

describe("Platzierungsbonus — eine Tabelle, aus dem Sheet", () => {
  it("die eingefrorene Tabelle ist Zeile fuer Zeile das CSV", () => {
    const sheetRows = readSheetPlacementRows();
    expect(sheetRows.length).toBe(63); // −31 … +31
    for (const [delta, amount] of sheetRows) {
      expect(PRIZE_PLACEMENT_SHEET_TABLE.get(delta), `rankDelta ${delta}`).toBeCloseTo(amount, 6);
    }
    expect(PRIZE_PLACEMENT_SHEET_TABLE.size).toBe(sheetRows.length);
  });

  it("ist asymmetrisch: aufwaerts +1,28 je Platz, abwaerts −0,96", () => {
    expect(getPrizePlacementBonus(1)).toBeCloseTo(1.28, 2);
    expect(getPrizePlacementBonus(-1)).toBeCloseTo(-0.96, 2);
    expect(getPrizePlacementBonus(0)).toBe(0);
    // Innerhalb der Kappung laeuft die Tabelle unveraendert weiter.
    expect(getPrizePlacementBonus(6)).toBeCloseTo(7.71, 2);
    expect(getPrizePlacementBonus(-6)).toBeCloseTo(-5.78, 2);
  });

  /**
   * DIE KAPPUNG BEI SECHS PLAETZEN. Ungekappt honorierte die Tabelle einen Sprung von Rang 32 auf 1
   * mit +26,33 C — mehr als ein Drittel dessen, was ein Mittelfeldteam eine ganze Saison lang
   * bekommt, entstanden in einer einzigen Saison. Weil die Tabelle asymmetrisch ist, leckte die
   * Ligasumme in den Extremen zusaetzlich nach oben. Ab sechs Plaetzen zahlt kein weiterer mehr;
   * die Belohnung fuer den besseren Endrang steckt ohnehin schon in der Rangkurve selbst.
   */
  it("kappt den Rangsprung bei sechs Plaetzen — in beide Richtungen", () => {
    expect(PRIZE_PLACEMENT_EFFECTIVE_CAP).toBe(6);
    for (const delta of [7, 10, 20, 31, 99]) {
      expect(getPrizePlacementBonus(delta), `+${delta}`).toBeCloseTo(getPrizePlacementBonus(6), 6);
    }
    for (const delta of [-7, -10, -20, -31, -99]) {
      expect(getPrizePlacementBonus(delta), `${delta}`).toBeCloseTo(getPrizePlacementBonus(-6), 6);
    }
    expect(getPrizePlacementBonus(Number.NaN)).toBe(0);
    // Bis zur Grenze bleibt sie streng monoton — sonst waere ein Platz mehr plotzlich weniger wert.
    for (let delta = -5; delta <= 6; delta += 1) {
      expect(getPrizePlacementBonus(delta), `${delta}`).toBeGreaterThan(getPrizePlacementBonus(delta - 1));
    }
  });

  it("liefert die Anzeigeform absteigend nach rankDelta", () => {
    const rows = getPrizePlacementRows();
    expect(rows[0]!.rankDelta).toBe(31);
    expect(rows.at(-1)!.rankDelta).toBe(-31);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.rankDelta).toBeLessThan(rows[i - 1]!.rankDelta);
      // Monoton: ein groesserer Sprung nach vorn ist nie weniger wert.
      expect(rows[i]!.placement).toBeLessThan(rows[i - 1]!.placement);
    }
  });
});
