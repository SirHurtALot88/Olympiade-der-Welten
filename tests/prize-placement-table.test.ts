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

  it("ist asymmetrisch: aufwaerts +1,28 je Platz, abwaerts −0,96 — und flacht oberhalb ±10 ab", () => {
    expect(getPrizePlacementBonus(1)).toBeCloseTo(1.28, 2);
    expect(getPrizePlacementBonus(-1)).toBeCloseTo(-0.96, 2);
    expect(getPrizePlacementBonus(10)).toBeCloseTo(12.84, 2);
    // Ab +11 flacher: +0,64 statt +1,28 je Platz.
    expect(getPrizePlacementBonus(11) - getPrizePlacementBonus(10)).toBeCloseTo(0.65, 2);
    expect(getPrizePlacementBonus(0)).toBe(0);
  });

  it("klammert ausserhalb der Tabelle auf den Rand statt auf 0 zu fallen", () => {
    expect(getPrizePlacementBonus(99)).toBeCloseTo(26.33, 2);
    expect(getPrizePlacementBonus(-99)).toBeCloseTo(-12.84, 2);
    expect(getPrizePlacementBonus(Number.NaN)).toBe(0);
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
