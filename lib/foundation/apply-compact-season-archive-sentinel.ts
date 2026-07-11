import type { GameState } from "@/lib/data/olyDataTypes";

/** Marks compact bootstrap state so archive views can slice-load without undefined re-triggers. */
export function withCompactSeasonArchiveSentinel(gameState: GameState): GameState {
  if (gameState.seasonState.seasonSnapshots !== undefined) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      seasonSnapshots: [],
    },
  };
}

export function applyCompactSeasonArchiveSentinelIfNeeded(
  gameState: GameState,
  options?: { compactInitial?: boolean },
): GameState {
  if (options?.compactInitial === false) {
    return gameState;
  }

  return withCompactSeasonArchiveSentinel(gameState);
}
