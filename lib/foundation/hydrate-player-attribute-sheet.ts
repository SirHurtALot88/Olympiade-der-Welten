import type { GameState, PlayerAttributeSheetRatings, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";

export type PlayerAttributeSheetPayload = {
  ok?: boolean;
  playerId?: string;
  attributeSheetStats?: PlayerAttributeSheetStats | null;
  attributeSheetRatings?: PlayerAttributeSheetRatings | null;
};

export function gameStateNeedsPlayerAttributeSheetHydration(gameState: GameState, playerId: string) {
  const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
  return player != null && player.attributeSheetStats == null;
}

export function mergePlayerAttributeSheetIntoGameState(
  gameState: GameState,
  playerId: string,
  sheet: PlayerAttributeSheetPayload | null | undefined,
): GameState {
  if (!sheet?.attributeSheetStats) {
    return gameState;
  }

  return {
    ...gameState,
    players: gameState.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            attributeSheetStats: sheet.attributeSheetStats,
            attributeSheetRatings: sheet.attributeSheetRatings ?? player.attributeSheetRatings,
          }
        : player,
    ),
  };
}

export async function fetchPlayerAttributeSheet(input: {
  saveId: string;
  playerId: string;
}): Promise<PlayerAttributeSheetPayload | null> {
  const params = new URLSearchParams({
    saveId: input.saveId,
    playerId: input.playerId,
  });
  const response = await fetch(`/api/singleplayer-state/player-sheet?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as PlayerAttributeSheetPayload;
}

export async function hydrateGameStatePlayerAttributeSheet(input: {
  gameState: GameState;
  saveId: string | null | undefined;
  playerId: string;
}): Promise<GameState> {
  if (!input.saveId || input.saveId === "loading-save") {
    return input.gameState;
  }
  if (!gameStateNeedsPlayerAttributeSheetHydration(input.gameState, input.playerId)) {
    return input.gameState;
  }

  const sheet = await fetchPlayerAttributeSheet({
    saveId: input.saveId,
    playerId: input.playerId,
  });
  return mergePlayerAttributeSheetIntoGameState(input.gameState, input.playerId, sheet);
}
