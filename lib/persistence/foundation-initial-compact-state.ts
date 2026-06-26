import type { GameState } from "@/lib/data/olyDataTypes";

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function matchesCompactSlice<T>(incoming: T, compactSlice: T) {
  return stableJson(incoming) === stableJson(compactSlice);
}

function preserveIfUnchangedFromCompact<T>(incoming: T, existing: T, compactSlice: T): T {
  return matchesCompactSlice(incoming, compactSlice) ? existing : incoming;
}

function mergeKeyedCollection<T>(
  incoming: T[],
  existing: T[],
  compactSlice: T[],
  key: (item: T) => string,
): T[] {
  if (matchesCompactSlice(incoming, compactSlice)) {
    return existing;
  }

  const incomingByKey = new Map(incoming.map((item) => [key(item), item] as const));
  const preservedFromExisting = existing.filter((item) => !incomingByKey.has(key(item)));
  return [...preservedFromExisting, ...incoming];
}

/** Slim initial Foundation payload: strips heavy history and non-active matchday slices. */
export function compactFoundationInitialGameState(gameState: GameState): GameState {
  const activeMatchdayId = gameState.matchdayState.matchdayId;
  const activeMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.matchdayId === activeMatchdayId,
  );
  const activeMatchdayResultIds = new Set(activeMatchdayResults.map((result) => result.id));

  return {
    ...gameState,
    playerBaselines: undefined,
    baselineWriteGuardEvents: undefined,
    transferHistory: [],
    logs: [],
    players: gameState.players.map((player) => ({
      ...player,
      attributeSheetStats: undefined,
      attributeSheetRatings: undefined,
      flavorEn: "",
      flavorDe: "",
      previousDisciplineRatings: undefined,
      lastSeasonDisciplineValues: undefined,
      currentDisciplineValues: undefined,
      disciplineDelta: undefined,
    })),
    seasonState: {
      ...gameState.seasonState,
      seasonSnapshots: undefined,
      standingsApplyLogs: undefined,
      disciplineResults: (gameState.seasonState.disciplineResults ?? []).filter((result) =>
        activeMatchdayResultIds.has(result.matchdayResultId),
      ),
      matchdayResults: activeMatchdayResults,
      lineupDrafts: (gameState.seasonState.lineupDrafts ?? []).filter(
        (draft) => draft.matchdayId === activeMatchdayId,
      ),
    },
  };
}

function mergePlayerAfterCompactEdit(
  existingPlayer: GameState["players"][number],
  incomingPlayer: GameState["players"][number],
  compactPlayer: GameState["players"][number],
) {
  if (matchesCompactSlice(incomingPlayer, compactPlayer)) {
    return existingPlayer;
  }

  const merged = { ...existingPlayer, ...incomingPlayer };
  const strippedFields = [
    "attributeSheetStats",
    "attributeSheetRatings",
    "flavorEn",
    "flavorDe",
    "previousDisciplineRatings",
    "lastSeasonDisciplineValues",
    "currentDisciplineValues",
    "disciplineDelta",
  ] as const;

  for (const field of strippedFields) {
    if (incomingPlayer[field] === compactPlayer[field]) {
      const preserved = existingPlayer[field];
      if (preserved !== undefined) {
        Object.assign(merged, { [field]: preserved });
      }
    }
  }

  return merged;
}

/** Restore compact-stripped slices when the client PUT still reflects the compact load. */
export function rehydrateGameStateAfterCompactPut(existing: GameState, incoming: GameState): GameState {
  const compactFromExisting = compactFoundationInitialGameState(existing);
  const incomingIds = new Set(incoming.players.map((player) => player.id));
  const preservedPlayers = existing.players.filter((player) => !incomingIds.has(player.id));
  const compactPlayersById = new Map(compactFromExisting.players.map((player) => [player.id, player] as const));
  const existingPlayersById = new Map(existing.players.map((player) => [player.id, player] as const));

  const rehydratedPlayers = incoming.players.map((incomingPlayer) => {
    const existingPlayer = existingPlayersById.get(incomingPlayer.id);
    const compactPlayer = compactPlayersById.get(incomingPlayer.id);
    if (!existingPlayer || !compactPlayer) {
      return incomingPlayer;
    }
    return mergePlayerAfterCompactEdit(existingPlayer, incomingPlayer, compactPlayer);
  });

  return {
    ...incoming,
    playerBaselines: incoming.playerBaselines ?? existing.playerBaselines,
    baselineWriteGuardEvents: incoming.baselineWriteGuardEvents ?? existing.baselineWriteGuardEvents,
    transferHistory: preserveIfUnchangedFromCompact(
      incoming.transferHistory,
      existing.transferHistory,
      compactFromExisting.transferHistory,
    ),
    logs: preserveIfUnchangedFromCompact(incoming.logs, existing.logs, compactFromExisting.logs),
    players: [...preservedPlayers, ...rehydratedPlayers],
    seasonState: {
      ...incoming.seasonState,
      seasonSnapshots: incoming.seasonState.seasonSnapshots ?? existing.seasonState.seasonSnapshots,
      standingsApplyLogs: incoming.seasonState.standingsApplyLogs ?? existing.seasonState.standingsApplyLogs,
      lineupDrafts: mergeKeyedCollection(
        incoming.seasonState.lineupDrafts ?? [],
        existing.seasonState.lineupDrafts ?? [],
        compactFromExisting.seasonState.lineupDrafts ?? [],
        (draft) => draft.matchdayId,
      ),
      matchdayResults: mergeKeyedCollection(
        incoming.seasonState.matchdayResults ?? [],
        existing.seasonState.matchdayResults ?? [],
        compactFromExisting.seasonState.matchdayResults ?? [],
        (result) => result.id,
      ),
      disciplineResults: mergeKeyedCollection(
        incoming.seasonState.disciplineResults ?? [],
        existing.seasonState.disciplineResults ?? [],
        compactFromExisting.seasonState.disciplineResults ?? [],
        (result) => result.id,
      ),
    },
  };
}
