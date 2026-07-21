import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Einheitliche Definition für "Training gesetzt": jeder Kader-Spieler des Teams
 * hat einen Trainingsmodus. Wird von Game-Flow-Controller, Season-Readiness-
 * Checklist und Season-Briefing-Dossier gemeinsam genutzt, damit alle
 * Oberflächen denselben Abschlusszustand zeigen (vorher droben vier leicht
 * unterschiedliche Heuristiken auseinander).
 */
export function isTeamTrainingComplete(gameState: GameState, teamId: string | null | undefined): boolean {
  if (!teamId) {
    return false;
  }
  const rosterPlayerIds = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => entry.playerId);
  if (rosterPlayerIds.length === 0) {
    return false;
  }
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return rosterPlayerIds.every((playerId) => playersById.get(playerId)?.trainingMode != null);
}
