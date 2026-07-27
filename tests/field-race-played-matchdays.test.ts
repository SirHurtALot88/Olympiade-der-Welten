import { describe, expect, it } from "vitest";

import {
  countPlayedFieldRaceMatchdays,
  getFieldRaceRankMovement,
  getFieldRaceRecentForm,
  type FieldRaceLedger,
  type FieldRaceLedgerEntry,
} from "@/lib/foundation/build-field-race-ledger";

/**
 * Situation aus dem Spiel: Season mit 10 Spieltagen, gespielt sind erst zwei. Der Ledger
 * enthaelt bewusst ALLE Spieltage (Reihenfolge/Nummerierung), die kuenftigen ohne Punkte.
 * Das Team faellt an Spieltag 2 von Rang 8 auf Rang 18 — also -10.
 */
function entry(partial: Partial<FieldRaceLedgerEntry> & { matchdayNumber: number; played: boolean }): FieldRaceLedgerEntry {
  return {
    matchdayId: `matchday-${partial.matchdayNumber}`,
    matchdayNumber: partial.matchdayNumber,
    tagespunkte: partial.tagespunkte ?? null,
    tagesrang: partial.tagesrang ?? null,
    cumulativePoints: partial.cumulativePoints ?? 0,
    cumulativeRank: partial.cumulativeRank ?? null,
    rankDeltaVsPrev: partial.rankDeltaVsPrev ?? null,
    played: partial.played,
  };
}

function buildLedger(): FieldRaceLedger {
  const rows: FieldRaceLedgerEntry[] = [
    entry({ matchdayNumber: 1, played: true, tagespunkte: 12.8, cumulativePoints: 12.8, cumulativeRank: 8, rankDeltaVsPrev: null }),
    entry({ matchdayNumber: 2, played: true, tagespunkte: 4.2, cumulativePoints: 17, cumulativeRank: 18, rankDeltaVsPrev: -10 }),
    // Noch nicht gewertet: keine Punkte, Rang unveraendert → Delta 0.
    entry({ matchdayNumber: 3, played: false, cumulativePoints: 17, cumulativeRank: 18, rankDeltaVsPrev: 0 }),
    entry({ matchdayNumber: 4, played: false, cumulativePoints: 17, cumulativeRank: 18, rankDeltaVsPrev: 0 }),
    entry({ matchdayNumber: 5, played: false, cumulativePoints: 17, cumulativeRank: 18, rankDeltaVsPrev: 0 }),
  ];
  return {
    seasonId: "season-1",
    matchdays: rows.map((row) => ({ matchdayId: row.matchdayId, matchdayNumber: row.matchdayNumber, played: row.played })),
    rowsByTeamId: new Map([["C-C", rows]]),
  };
}

describe("Feld-Rennen · nur gewertete Spieltage", () => {
  it("meldet die Rang-Bewegung des letzten GEWERTETEN Spieltags, nicht des letzten geplanten", () => {
    // Regression: vorher wurde rows[rows.length - 1] gelesen — ein kuenftiger Spieltag mit
    // Delta 0. Im Cockpit stand "±0", obwohl das Team zehn Plaetze verloren hatte.
    expect(getFieldRaceRankMovement(buildLedger(), "C-C")).toBe(-10);
  });

  it("zeigt im Form-Strip die gespielten Spieltage statt lauter leerer Felder", () => {
    const form = getFieldRaceRecentForm(buildLedger(), "C-C", 5);

    expect(form.map((row) => row.matchdayNumber)).toEqual([1, 2]);
    // Regression: vorher waren es die Spieltage 1..5 bzw. das Listenende — durchgehend ohne Wertung.
    expect(form.every((row) => row.played)).toBe(true);
    expect(form.every((row) => row.tagespunkte != null)).toBe(true);
  });

  it("zaehlt gewertete Spieltage, nicht die Laenge des Spielplans", () => {
    expect(countPlayedFieldRaceMatchdays(buildLedger())).toBe(2);
  });

  it("liefert null bzw. leer, solange nichts gewertet ist", () => {
    const rows = [entry({ matchdayNumber: 1, played: false }), entry({ matchdayNumber: 2, played: false })];
    const ledger: FieldRaceLedger = {
      seasonId: "season-1",
      matchdays: rows.map((row) => ({ matchdayId: row.matchdayId, matchdayNumber: row.matchdayNumber, played: false })),
      rowsByTeamId: new Map([["C-C", rows]]),
    };

    expect(getFieldRaceRankMovement(ledger, "C-C")).toBeNull();
    expect(getFieldRaceRecentForm(ledger, "C-C", 5)).toEqual([]);
    expect(countPlayedFieldRaceMatchdays(ledger)).toBe(0);
  });

  it("begrenzt den Form-Strip auf die letzten count gewerteten Spieltage", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      entry({ matchdayNumber: index + 1, played: true, tagespunkte: index + 1 }),
    );
    const ledger: FieldRaceLedger = {
      seasonId: "season-1",
      matchdays: rows.map((row) => ({ matchdayId: row.matchdayId, matchdayNumber: row.matchdayNumber, played: true })),
      rowsByTeamId: new Map([["C-C", rows]]),
    };

    expect(getFieldRaceRecentForm(ledger, "C-C", 5).map((row) => row.matchdayNumber)).toEqual([4, 5, 6, 7, 8]);
  });
});
