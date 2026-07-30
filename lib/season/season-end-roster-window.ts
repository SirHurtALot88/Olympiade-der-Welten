import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Phasen, in denen Kader-Entscheidungen am Saisonende offenstehen: Verkaufen, Verlängern
 * und die Vertragsauflösung auf Spielerwunsch.
 *
 * Bewusst als geteilte Konstante statt als zweite Kopie: die Liste wird sowohl von der
 * Oberfläche (Freigabe der Knöpfe im Kader) als auch von der Inbox (Hinweis auf offene
 * Angebote) gebraucht. Zwei Listen wären genau die Sorte Drift, bei der die Inbox etwas
 * meldet, das der Kader gar nicht anbietet — oder umgekehrt.
 */
export const SEASON_END_ROSTER_PHASES = new Set([
  "season_completed",
  "season_review",
  "season_rewards",
  "player_development",
  "preseason_management",
  "transfer_sell_phase",
]);

/**
 * Steht der Spielstand allein aufgrund seiner PHASE im Saisonende-Fenster?
 *
 * Die Oberfläche kennt zusätzlich einen Übergangs-Gate (`canCompleteSeason`), der eine
 * noch laufende Saison freigibt, sobald sie abschließbar ist. Der ist hier bewusst nicht
 * enthalten — er haengt an lokal berechnetem Zustand, den serverseitige Aufrufer nicht
 * haben. Wer ihn braucht, oder-verknuepft ihn selbst.
 */
export function isSeasonEndRosterPhase(gameState: GameState): boolean {
  return SEASON_END_ROSTER_PHASES.has(gameState.gamePhase ?? "season_active");
}
