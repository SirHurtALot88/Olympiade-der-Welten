import type { GameState, Player } from "@/lib/data/olyDataTypes";

/** Default training fields for rostered players missing mode/class after a roster add. */
export function applyDefaultTrainingFieldsToPlayer(player: Player): Player {
  let next = player;
  if (!player.trainingMode) {
    next = { ...next, trainingMode: "mittel" };
  }
  if (!player.trainingClass && player.className) {
    next = { ...next, trainingClass: player.className };
  }
  return next;
}

export function applyDefaultTrainingFieldsToRosteredPlayers(gameState: GameState): GameState {
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  let changed = false;
  const players = gameState.players.map((player) => {
    if (!rosterPlayerIds.has(player.id)) return player;
    const next = applyDefaultTrainingFieldsToPlayer(player);
    if (next !== player) changed = true;
    return next;
  });
  return changed ? { ...gameState, players } : gameState;
}
