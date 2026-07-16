import { createHash } from "node:crypto";

import type { GameState } from "@/lib/data/olyDataTypes";

import { withPersistedSeasonDerivations } from "./materialize-season-derivations";
import { buildGameStateContentSignature } from "./season-derivations-signature";

function buildRatingsRelevantFingerprint(gameState: GameState): string {
  const performanceCount = gameState.seasonState.playerDisciplinePerformances?.length ?? 0;
  const rosterSignature = gameState.rosters
    .map((entry) => `${entry.playerId}:${entry.teamId}`)
    .sort()
    .join("|");
  const playerSignature = gameState.players
    .map(
      (player) =>
        `${player.id}:${player.rating ?? ""}:${player.coreStats?.pow ?? ""}:${player.coreStats?.spe ?? ""}:${player.coreStats?.men ?? ""}:${player.coreStats?.soc ?? ""}`,
    )
    .join("|");

  return createHash("sha256")
    .update(
      [
        String(gameState.players.length),
        String(gameState.rosters.length),
        String(gameState.transferHistory.length),
        String(performanceCount),
        rosterSignature,
        playerSignature,
      ].join("\n"),
    )
    .digest("hex");
}

export function hasRatingRelevantGameStateChange(before: GameState, after: GameState): boolean {
  if (buildGameStateContentSignature(before) === buildGameStateContentSignature(after)) {
    return false;
  }

  return buildRatingsRelevantFingerprint(before) !== buildRatingsRelevantFingerprint(after);
}

export function prepareGameStateForPersistence(before: GameState | null, after: GameState): GameState {
  if (!before || !hasRatingRelevantGameStateChange(before, after)) {
    return after;
  }

  return withPersistedSeasonDerivations(after);
}
