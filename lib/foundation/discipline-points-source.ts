/**
 * WOHER kommen die Disziplin-PPs eines Spielers?
 *
 * Diese Frage stellt sich inzwischen an drei Stellen (Spielerliste, Kader-
 * Rostertabelle im Teams-Tab, Saisonstand-Aufklappung) — und sie hat überall
 * dieselbe Antwort. Deshalb steht die Regel hier einmal statt dreimal.
 *
 * Der Directory-Slice rechnet SERVERSEITIG auf dem vollständigen Save. Der
 * Foundation-Client hält dagegen den kompakten Payload
 * (`compactFoundationInitialGameState`).
 *
 * HIER STAND, `matchdayResults`/`disciplineResults` seien darin „auf den AKTIVEN
 * Spieltag beschnitten" — das stimmt seit `8ec6454b` NICHT MEHR, beide fahren
 * vollständig mit. Am Live-Abbild nachgemessen (Spieltag 10, 32 Teams): der
 * clientseitig frisch gebaute Ledger kommt auf dieselben 2534 Punkteinträge und
 * dieselben 340 Ratings wie der Server. Der alte Befund lautete 2449 gegen 254
 * Einträge; er ist Geschichte. Wer diesen Absatz noch als Warnung liest, baut
 * eine Wache gegen einen Fehler, den es nicht mehr gibt.
 *
 * `persistedSeasonDerivations` fährt weiterhin NICHT mit (5,5 MB) — der Browser
 * rechnet die Ableitungen dann eben frisch, und zwar nachgemessen auf dieselben
 * Zahlen. Das kostet Zeit, keine Richtigkeit.
 *
 * Der Slice bleibt trotzdem die bevorzugte Quelle, solange er da ist: er ist
 * bereits gerechnet. Fehlt ein Spieler dort, hat er in dieser Saison keine PPs
 * geholt — dann bleibt es leer. Der Ledger ist der Fallback für Pfade ohne Slice
 * (Home-V2-/Markt-Kacheln, oder Slice-Fehler).
 */

export type PlayerDirectoryDisciplinePointsSlice = {
  payload: unknown;
  error: string | null;
  disciplinePointsByPlayerId: Record<string, Record<string, number>>;
};

/**
 * Ein Slice ohne Nutzlast ist noch unterwegs, einer mit Fehler ist unbrauchbar —
 * in beiden Fällen darf er die Quelle nicht an sich ziehen, sonst zeigte die
 * Oberfläche während des Ladens "keine PPs" statt der Fallback-Werte.
 */
export function isDisciplinePointsSliceUsable(
  slice: PlayerDirectoryDisciplinePointsSlice | null | undefined,
): slice is PlayerDirectoryDisciplinePointsSlice {
  return Boolean(slice?.payload) && !slice?.error;
}

/** Disziplin-PPs EINES Spielers (Spielerliste, Kader-Rostertabelle). */
export function resolvePlayerDisciplinePoints(input: {
  playerId: string;
  playerDirectorySlice: PlayerDirectoryDisciplinePointsSlice;
  ledgerPointsByDiscipline: Record<string, number> | null | undefined;
}): Record<string, number> | null {
  if (isDisciplinePointsSliceUsable(input.playerDirectorySlice)) {
    return input.playerDirectorySlice.disciplinePointsByPlayerId[input.playerId] ?? null;
  }
  return input.ledgerPointsByDiscipline ?? null;
}

/**
 * Dieselbe Entscheidung für Verbraucher, die den GANZEN Ledger brauchen statt
 * einer einzelnen Zeile — der Saisonstand baut daraus seine Teilnehmerlisten je
 * Team und Disziplin (`buildSeasonStandingsTopPlayersByTeam`).
 *
 * Rückgabe ist bewusst wieder in Ledger-Form (`playerSummariesByPlayerId` mit
 * `pointsByDiscipline`): so bleibt der Verbraucher unverändert und muss nicht
 * wissen, aus welcher Quelle die Zahlen stammen.
 */
export function resolveDisciplinePointsLedgerView(input: {
  playerDirectorySlice: PlayerDirectoryDisciplinePointsSlice | null | undefined;
  seasonPointsLedger:
    | { playerSummariesByPlayerId: Map<string, { pointsByDiscipline?: Record<string, number> }> }
    | null
    | undefined;
}): { playerSummariesByPlayerId: Map<string, { pointsByDiscipline?: Record<string, number> }> } | null {
  if (isDisciplinePointsSliceUsable(input.playerDirectorySlice)) {
    return {
      playerSummariesByPlayerId: new Map(
        Object.entries(input.playerDirectorySlice.disciplinePointsByPlayerId).map(
          ([playerId, pointsByDiscipline]) => [playerId, { pointsByDiscipline }] as const,
        ),
      ),
    };
  }
  return input.seasonPointsLedger ?? null;
}
