import type { GameState, Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";

type PlayerAttributeSheetRatings = NonNullable<Player["attributeSheetRatings"]>;

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
  const attributeSheetStats = sheet.attributeSheetStats;

  return {
    ...gameState,
    players: gameState.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            attributeSheetStats,
            attributeSheetRatings: sheet.attributeSheetRatings ?? player.attributeSheetRatings,
          }
        : player,
    ),
  };
}

const playerAttributeSheetCache = new Map<string, PlayerAttributeSheetPayload | null>();

function buildPlayerAttributeSheetCacheKey(saveId: string, playerId: string) {
  return `${saveId}:${playerId}`;
}

export function invalidatePlayerAttributeSheetCache(input?: { saveId?: string; playerId?: string }) {
  if (!input?.saveId && !input?.playerId) {
    playerAttributeSheetCache.clear();
    return;
  }

  for (const key of [...playerAttributeSheetCache.keys()]) {
    const [saveId, playerId] = key.split(":");
    if (input.saveId && saveId !== input.saveId) {
      continue;
    }
    if (input.playerId && playerId !== input.playerId) {
      continue;
    }
    playerAttributeSheetCache.delete(key);
  }
}

export async function fetchPlayerAttributeSheet(input: {
  saveId: string;
  playerId: string;
}): Promise<PlayerAttributeSheetPayload | null> {
  const cacheKey = buildPlayerAttributeSheetCacheKey(input.saveId, input.playerId);
  if (playerAttributeSheetCache.has(cacheKey)) {
    return playerAttributeSheetCache.get(cacheKey) ?? null;
  }

  const params = new URLSearchParams({
    saveId: input.saveId,
    playerId: input.playerId,
  });
  const response = await fetch(`/api/singleplayer-state/player-sheet?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    playerAttributeSheetCache.set(cacheKey, null);
    return null;
  }
  const payload = (await response.json()) as PlayerAttributeSheetPayload;
  playerAttributeSheetCache.set(cacheKey, payload);
  return payload;
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
