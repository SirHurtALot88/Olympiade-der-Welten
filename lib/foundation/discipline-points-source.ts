/**
 * WOHER kommen die Disziplin-PPs eines Spielers?
 *
 * Diese Frage stellt sich inzwischen an drei Stellen (Spielerliste, Kader-
 * Rostertabelle im Teams-Tab, Saisonstand-Aufklappung) — und sie hat überall
 * dieselbe Antwort. Deshalb steht die Regel hier einmal statt dreimal.
 *
 * Der Directory-Slice rechnet SERVERSEITIG auf dem vollständigen Save. Der
 * Foundation-Client hält dagegen den kompakten Payload
 * (`compactFoundationInitialGameState`): dort sind `matchdayResults` /
 * `disciplineResults` auf den AKTIVEN Spieltag beschnitten und
 * `persistedSeasonDerivations` entfernt. Ein clientseitig gebauter
 * `buildSeasonPointsLedger` kennt daher nur diesen einen Spieltag.
 *
 * Am echten Spielstand (Spieltag 10, 32 Teams) gemessen:
 *
 *   VOLL     Ledger: 2449 Punkteinträge, 330 Spieler mit Disziplin-PPs
 *   KOMPAKT  Ledger:  254 Punkteinträge — und je Team nur die 2 Disziplinen
 *            des aktiven Spieltags; die anderen 18 stehen auf 0.
 *
 * Sobald der Slice da ist, ist er deshalb die alleinige Quelle: fehlt ein
 * Spieler dort, hat er in dieser Saison keine PPs geholt — dann bleibt es leer,
 * statt auf den beschnittenen Ledger zurückzufallen. Der Ledger bleibt nur
 * Fallback für Pfade ohne Slice (Home-V2-/Markt-Kacheln, oder Slice-Fehler).
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
