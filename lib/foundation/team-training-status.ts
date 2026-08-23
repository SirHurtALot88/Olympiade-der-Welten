import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Einheitliche Definition für "Training gesetzt": jeder Kader-Spieler des Teams
 * hat einen Trainingsmodus. Wird von Game-Flow-Controller, Season-Readiness-
 * Checklist und Season-Briefing-Dossier gemeinsam genutzt, damit alle
 * Oberflächen denselben Abschlusszustand zeigen (vorher droben vier leicht
 * unterschiedliche Heuristiken auseinander).
 */
export function isTeamTrainingComplete(gameState: GameState, teamId: string | null | undefined): boolean {
  return findPlayersWithoutTrainingMode(gameState, teamId).status === "complete";
}

export type TeamTrainingGap = {
  status: "complete" | "incomplete" | "no_team" | "empty_roster";
  /** Namen der Kaderspieler ohne Trainingsmodus — leer, wenn nichts fehlt. */
  missingPlayerNames: string[];
  missingCount: number;
};

/**
 * WER GENAU FEHLT — nicht nur DASS etwas fehlt.
 *
 * GEMELDET VON CHRIS (`j53iox`): „der Flow hängt bei Training prüfen fest - weiß nicht warum dabei
 * müsste er auf die Einsatzliste verweisen, training ist erledigt."
 *
 * „Weiß nicht warum" ist der eigentliche Befund. Die Regel oben ist ein blankes Ja/Nein; ein Team
 * mit einem einzigen Spieler ohne Trainingsmodus steht damit auf „offen", und keine Oberfläche
 * konnte sagen, an wem es liegt. Genau so sieht ein Schritt aus, der „hängt".
 *
 * NACHGEMESSEN an den fünf Live-Spielständen: T-G steht mit 8 von 8 Kaderspielern ohne
 * Trainingsmodus da, C-C mit 2 von 9 — beide mit Vertragsstatus `active`. Es sind also keine
 * Karteileichen, sondern echte Kaderspieler, die über Draft oder KI-Picks ins Team kamen; den
 * Vorgabewert setzte bis dahin nur der Marktweg (`applyDefaultTrainingFieldsToRosteredPlayers`,
 * seit dieser Meldung auch am Saisonwechsel).
 *
 * Die Namen sind gedeckelt: eine Warnung mit dreißig Namen ist so unlesbar wie gar keine.
 */
const MAX_GENANNTE_NAMEN = 5;

export function findPlayersWithoutTrainingMode(
  gameState: GameState,
  teamId: string | null | undefined,
): TeamTrainingGap {
  if (!teamId) {
    return { status: "no_team", missingPlayerNames: [], missingCount: 0 };
  }
  const rosterPlayerIds = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => entry.playerId);
  if (rosterPlayerIds.length === 0) {
    return { status: "empty_roster", missingPlayerNames: [], missingCount: 0 };
  }
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const fehlende = rosterPlayerIds.filter((playerId) => playersById.get(playerId)?.trainingMode == null);
  if (fehlende.length === 0) {
    return { status: "complete", missingPlayerNames: [], missingCount: 0 };
  }
  return {
    status: "incomplete",
    missingCount: fehlende.length,
    missingPlayerNames: fehlende
      .slice(0, MAX_GENANNTE_NAMEN)
      // Ein Kadereintrag ohne passenden Spieler ist ebenfalls ein Grund — er darf nicht als
      // namenloser Eintrag verschwinden, sonst sucht man wieder im Dunkeln.
      .map((playerId) => playersById.get(playerId)?.name ?? `Unbekannter Spieler (${playerId})`),
  };
}
