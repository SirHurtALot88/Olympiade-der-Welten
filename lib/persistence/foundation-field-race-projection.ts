/**
 * GEMELDET (Nachpruefung, Spieltag 4 halb gewertet): Home behauptete mitten in Season 2
 * „Noch keine Form — erst 0 Spieltage" und „verbleibend 10 Spieltage", waehrend Kopfzeile
 * (Rang #23, 17,1 Punkte), Teams und Leaders laengst mit vier gewerteten Spieltagen rechneten.
 *
 * BEFUND: es fehlten keine Daten — der Feld-Rennen-Ledger sah sie nur nicht. Er wird im
 * Browser gebaut, und der kompakte Foundation-Payload streicht `matchdayResults`/
 * `disciplineResults` bis auf den aktiven Spieltag sowie `persistedSeasonDerivations`
 * komplett (docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md). Ein clientseitiger Neubau kann auf
 * diesem Stand bestenfalls EINEN gespielten Spieltag finden.
 *
 * Nach dem Muster von `foundation-season-history-projection`: statt der schweren Quellen
 * faehrt die fertige, kleine Antwort mit — der Feld-Rennen-Ledger, serverseitig auf dem
 * VOLLEN Save gerechnet, beschnitten auf die gewerteten Spieltage (ungespielte Zeilen sind
 * ableitbar und reines Gewicht). Reine Anzeigefracht: wird beim Compact-PUT-Roundtrip
 * verworfen und bei jeder Auslieferung frisch gebaut, es gibt keine zweite Wahrheit.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildFieldRaceLedger,
  type FieldRaceLedger,
  type FieldRaceLedgerEntry,
} from "@/lib/foundation/build-field-race-ledger";

export type FoundationFieldRaceProjection = {
  seasonId: string;
  /** ALLE Spieltage der Season (fuer Zaehlung/Nummerierung), je mit `played`-Flag. */
  matchdays: Array<{ matchdayId: string; matchdayNumber: number; played: boolean }>;
  /** Je Team NUR die Zeilen der bereits GEWERTETEN Spieltage. */
  rowsByTeamId: Record<string, FieldRaceLedgerEntry[]>;
};

export function projiziereFieldRace(gameState: GameState): FoundationFieldRaceProjection | undefined {
  try {
    const ledger = buildFieldRaceLedger(gameState);
    if (ledger.matchdays.length === 0) {
      return undefined;
    }
    return {
      seasonId: ledger.seasonId,
      matchdays: ledger.matchdays,
      rowsByTeamId: Object.fromEntries(
        [...ledger.rowsByTeamId].map(([teamId, rows]) => [teamId, rows.filter((row) => row.played)]),
      ),
    };
  } catch {
    // Defensiv wie die Saison-Historie: eine kaputte Projektion darf die
    // Compact-Auslieferung nie zu Fall bringen — dann eben clientseitiger Fallback.
    return undefined;
  }
}

/**
 * Baut aus der Projektion wieder ein `FieldRaceLedger` im Browser-Zuschnitt. Die
 * fehlenden (ungespielten) Zeilen sind unkritisch: alle Konsumenten filtern ohnehin
 * auf `played` (getFieldRaceSeasonForm/getFieldRaceRankMovement) bzw. zaehlen ueber
 * die vollstaendig mitgelieferte `matchdays`-Liste (countPlayedFieldRaceMatchdays).
 */
export function hydriereFieldRaceProjection(projection: FoundationFieldRaceProjection): FieldRaceLedger {
  return {
    seasonId: projection.seasonId,
    matchdays: projection.matchdays,
    rowsByTeamId: new Map(Object.entries(projection.rowsByTeamId)),
  };
}
