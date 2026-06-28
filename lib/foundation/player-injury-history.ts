import type {
  GameState,
  InjuryEventRecord,
  Player,
  PlayerInjuryHistoryRecord,
} from "@/lib/data/olyDataTypes";

export type PlayerInjurySummary = {
  totalInjuries: number;
  totalMatchdaysMissed: number;
  seasonsAffected: number;
};

export type PlayerInjurySeasonAggregate = {
  seasonId: string;
  injuriesCount: number;
  matchdaysMissed: number;
};

function resolveSeasonName(gameState: GameState, seasonId: string) {
  if (gameState.season.id === seasonId) {
    return gameState.season.name;
  }
  return (
    gameState.seasonState.seasonSnapshots?.find((entry) => entry.seasonId === seasonId)?.seasonName ??
    seasonId
  );
}

function resolveMatchdayLabel(gameState: GameState, matchdayId: string) {
  const index = gameState.season.matchdayIds?.findIndex((entry) => entry === matchdayId) ?? -1;
  if (index >= 0) {
    return `Spieltag ${index + 1}`;
  }
  return matchdayId;
}

export function injuryEventToPlayerHistoryRecord(
  event: InjuryEventRecord,
  gameState: GameState,
): PlayerInjuryHistoryRecord | null {
  if (event.result !== "injured") {
    return null;
  }
  const normalRecovery = event.normalRecovery ?? 0;
  const injuryRecovery = event.injuryRecovery ?? 0;
  const injuryRecoveryPct =
    normalRecovery > 0 ? Math.round((injuryRecovery / normalRecovery) * 100) : 50;

  return {
    eventId: event.eventId,
    seasonId: event.seasonId,
    seasonName: resolveSeasonName(gameState, event.seasonId),
    matchdayId: event.matchdayId,
    matchdayLabel: resolveMatchdayLabel(gameState, event.matchdayId),
    teamId: event.teamId,
    fatigueBefore: event.fatigueBefore,
    riskPercent: event.riskPercent,
    unavailableUntil: event.unavailableUntil ?? null,
    matchdaysMissed: event.unavailableForMatchdays ?? 1,
    injuryRecoveryPct,
    timestamp: event.timestamp,
  };
}

export function appendPlayerInjuryHistory(
  player: Player,
  record: PlayerInjuryHistoryRecord,
): Player {
  const existing = player.injuryHistory ?? [];
  if (existing.some((entry) => entry.eventId === record.eventId)) {
    return player;
  }
  return {
    ...player,
    injuryHistory: [...existing, record],
  };
}

export function buildPlayerInjuryHistoryFromEvents(input: {
  playerId: string;
  gameState: GameState;
  persistedHistory?: PlayerInjuryHistoryRecord[] | null;
}): PlayerInjuryHistoryRecord[] {
  const fromPlayer = input.persistedHistory ?? [];
  const fromSeasonEvents = (input.gameState.seasonState.injuryEvents ?? [])
    .filter((event) => event.playerId === input.playerId && event.result === "injured")
    .map((event) => injuryEventToPlayerHistoryRecord(event, input.gameState))
    .filter((entry): entry is PlayerInjuryHistoryRecord => Boolean(entry));

  const merged = new Map<string, PlayerInjuryHistoryRecord>();
  for (const entry of [...fromPlayer, ...fromSeasonEvents]) {
    merged.set(entry.eventId, entry);
  }

  return [...merged.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp, "de"));
}

export function buildPlayerInjurySummary(history: PlayerInjuryHistoryRecord[]): PlayerInjurySummary {
  const seasons = new Set(history.map((entry) => entry.seasonId));
  return {
    totalInjuries: history.length,
    totalMatchdaysMissed: history.reduce((sum, entry) => sum + entry.matchdaysMissed, 0),
    seasonsAffected: seasons.size,
  };
}

export function aggregatePlayerInjuryHistoryBySeason(
  history: PlayerInjuryHistoryRecord[],
): PlayerInjurySeasonAggregate[] {
  const bySeason = new Map<string, PlayerInjurySeasonAggregate>();
  for (const entry of history) {
    const bucket = bySeason.get(entry.seasonId) ?? {
      seasonId: entry.seasonId,
      injuriesCount: 0,
      matchdaysMissed: 0,
    };
    bucket.injuriesCount += 1;
    bucket.matchdaysMissed += entry.matchdaysMissed;
    bySeason.set(entry.seasonId, bucket);
  }
  return [...bySeason.values()].sort((left, right) =>
    left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }),
  );
}

export function backfillPlayerInjuryHistoryFromSeasonEvents(gameState: GameState): GameState {
  const injuredEvents = (gameState.seasonState.injuryEvents ?? []).filter((event) => event.result === "injured");
  if (injuredEvents.length === 0) {
    return gameState;
  }

  const eventsByPlayerId = new Map<string, InjuryEventRecord[]>();
  for (const event of injuredEvents) {
    const bucket = eventsByPlayerId.get(event.playerId) ?? [];
    bucket.push(event);
    eventsByPlayerId.set(event.playerId, bucket);
  }

  let changed = false;
  const nextPlayers = gameState.players.map((player) => {
    const playerEvents = eventsByPlayerId.get(player.id);
    if (!playerEvents || playerEvents.length === 0) {
      return player;
    }
    const existingIds = new Set((player.injuryHistory ?? []).map((entry) => entry.eventId));
    const missing = playerEvents
      .map((event) => injuryEventToPlayerHistoryRecord(event, gameState))
      .filter((entry): entry is PlayerInjuryHistoryRecord => Boolean(entry))
      .filter((entry) => !existingIds.has(entry.eventId));
    if (missing.length === 0) {
      return player;
    }
    changed = true;
    return {
      ...player,
      injuryHistory: [...(player.injuryHistory ?? []), ...missing].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp, "de"),
      ),
    };
  });

  return changed ? { ...gameState, players: nextPlayers } : gameState;
}

export function ensurePlayerInjuryHistoryForGameState(gameState: GameState): GameState {
  const needsBackfill = gameState.players.some(
    (player) =>
      (player.injuryHistory?.length ?? 0) === 0 &&
      (gameState.seasonState.injuryEvents ?? []).some(
        (event) => event.playerId === player.id && event.result === "injured",
      ),
  );
  if (!needsBackfill) {
    return gameState;
  }
  return backfillPlayerInjuryHistoryFromSeasonEvents(gameState);
}
