import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getFieldRaceRankMovement,
  type FieldRaceLedger,
  type FieldRaceLedgerEntry,
} from "@/lib/foundation/build-field-race-ledger";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * "Saisonstand zeigt immer noch keine Rangänderung im Vergleich zum letzten Spieltag."
 *
 * Ursache: die Rang-Spalte der Daten-Tabelle hing allein an `row.rankDiff`. Das ist
 * die Bewegung seit SAISONSTART, und die wird erst beim Saisonabschluss geschrieben
 * (`cash-prize-apply-service`) — in der laufenden Saison steht sie auf 0 bzw. fehlt.
 * Die Spalte blieb damit die ganze Saison leer. Das Spieltags-Delta lag dagegen
 * bereits fertig im Zeilenmodell (`fieldRaceRankDelta`), wurde aber nur vom
 * Board-Chip gelesen.
 */
describe("Saisonstand: Rang-Bewegung gegenüber dem letzten Spieltag", () => {
  const standings = read("app/foundation/season-v2/SeasonStandingsNewLook.tsx");

  it("liest in der Rang-Spalte der Daten-Tabelle das Spieltags-Delta", () => {
    expect(standings).toContain("function renderRankMovementChip");
    expect(standings).toContain("const matchdayDelta = row.fieldRaceRankDelta;");
    expect(standings).toContain('title="Rang-Bewegung gegenüber dem letzten Spieltag"');
    // Die Zelle ruft den Helfer auf, statt `rankDiff` direkt zu rendern.
    expect(standings).toContain('<td className="nl-standings-td-rank">');
    expect(standings).toContain("{renderRankMovementChip(row)}");
  });

  it("behält die Saisonstart-Bewegung als Rückfallebene mit eigenem Tooltip", () => {
    // Beide Größen sind echt — sie dürfen nur nicht als dieselbe gelesen werden.
    expect(standings).toContain('title="Rang-Bewegung seit Saisonstart"');
    const helper = standings.slice(
      standings.indexOf("function renderRankMovementChip"),
      standings.indexOf("function renderAreaMiniBars"),
    );
    // Reihenfolge: erst Spieltag, dann Saisonstart.
    expect(helper.indexOf("row.fieldRaceRankDelta")).toBeLessThan(helper.indexOf("row.rankDiff"));
  });

  it("zeigt ±0 statt einer leeren Zelle, wenn sich nichts bewegt hat", () => {
    // Vorher war `rankDiff !== 0` Bedingung — "keine Bewegung" und "keine Daten"
    // sahen dadurch identisch aus.
    const helper = standings.slice(
      standings.indexOf("function renderRankMovementChip"),
      standings.indexOf("function renderAreaMiniBars"),
    );
    expect(helper).toContain('n === 0 ? "±0"');
  });
});

/**
 * Die Datenseite dahinter: `getFieldRaceRankMovement` liefert das Delta zum letzten
 * GESPIELTEN Spieltag — noch nicht gewertete Spieltage am Listenende dürfen es nicht
 * auf ±0 verwässern. (Der Ledger-Aufbau selbst hängt an einer echten `GameState` und
 * ist in `field-race-played-matchdays.test.ts` abgedeckt.)
 */
describe("Feld-Rennen-Ledger: Delta zum letzten gespielten Spieltag", () => {
  const entry = (partial: Partial<FieldRaceLedgerEntry> & { matchdayNumber: number; played: boolean }) => ({
    matchdayId: `md-${partial.matchdayNumber}`,
    tagespunkte: partial.tagespunkte ?? null,
    tagesrang: partial.tagesrang ?? null,
    cumulativePoints: partial.cumulativePoints ?? 0,
    cumulativeRank: partial.cumulativeRank ?? null,
    rankDeltaVsPrev: partial.rankDeltaVsPrev ?? null,
    ...partial,
  }) as FieldRaceLedgerEntry;

  it("überspringt die ungespielten Spieltage am Listenende", () => {
    const ledger: FieldRaceLedger = {
      seasonId: "s1",
      matchdays: [],
      rowsByTeamId: new Map([
        [
          "A",
          [
            entry({ matchdayNumber: 1, played: true, rankDeltaVsPrev: null }),
            entry({ matchdayNumber: 2, played: true, rankDeltaVsPrev: -7 }),
            entry({ matchdayNumber: 3, played: false, rankDeltaVsPrev: 0 }),
            entry({ matchdayNumber: 4, played: false, rankDeltaVsPrev: 0 }),
          ],
        ],
      ]),
    };

    // Ohne den `played`-Filter stünde hier ±0, obwohl das Team sieben Plätze verloren hat.
    expect(getFieldRaceRankMovement(ledger, "A")).toBe(-7);
    // Team ohne Ledger-Zeilen: kein erfundenes Delta.
    expect(getFieldRaceRankMovement(ledger, "B")).toBeNull();
  });
});
