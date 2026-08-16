import type {
  GameState,
  InjuryEventRecord,
  Player,
  PlayerInjuryHistoryRecord,
} from "@/lib/data/olyDataTypes";
import { INJURY_RECOVERY_PCT } from "@/lib/fatigue/fatigue-injury-service";

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
  /**
   * Der Prozentsatz kommt aus dem GESPEICHERTEN Ereignis, nicht aus dem heutigen Faktor — ein
   * Eintrag aus der Zeit von 0,5 soll auch nach der Umstellung 50 % zeigen. Das ist Geschichte,
   * die stimmen muss, keine Regel.
   *
   * Nur wenn das Ereignis gar keine Erholung mitfuehrt (alte, schlanke Zeilen), greift der
   * heutige Faktor. Hier stand eine eingetippte 50 — die haette nach Chris' Umstellung auf 1,0
   * bei jedem Bestandseintrag ohne Werte eine Halbierung behauptet, die es nicht mehr gibt.
   */
  const injuryRecoveryPct =
    normalRecovery > 0 ? Math.round((injuryRecovery / normalRecovery) * 100) : INJURY_RECOVERY_PCT;

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

/** Disziplin, in der ein Spieler am Spieltag der Verletzung eingesetzt war. */
export type PlayerInjuryDiscipline = {
  disciplineId: string;
  name: string;
  /** Kadergröße der Disziplin — wie viele Spieler pro Team dort antreten. */
  playerCount: number | null;
};

/**
 * Loest auf, in welchen Disziplinen ein Spieler am Spieltag seiner Verletzung aufgestellt war.
 *
 * WICHTIG zur Semantik: Der Verletzungswurf haengt am SPIELTAG und an der Fatigue, nicht an
 * einer einzelnen Disziplin — `InjuryEventRecord` traegt deshalb gar keine `disciplineId`.
 * Was hier ermittelt wird, ist der tatsaechliche Einsatz laut Einsatzliste desselben
 * Spieltags. Ein Spieler kann in BEIDEN Disziplinen eines Spieltags gestanden haben; dann
 * liefert die Funktion beide, statt sich willkuerlich fuer eine zu entscheiden.
 *
 * Ohne Einsatzliste (alter Spielstand, Draft geloescht) bleibt das Ergebnis leer — es wird
 * keine Disziplin geraten.
 */
export function resolveInjuryMatchdayDisciplines(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  matchdayId: string;
}): PlayerInjuryDiscipline[] {
  const drafts = (input.gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.teamId === input.teamId && draft.matchdayId === input.matchdayId,
  );

  const disciplineIds: string[] = [];
  for (const draft of drafts) {
    for (const entry of draft.entries ?? []) {
      if (entry.playerId !== input.playerId || !entry.disciplineId) {
        continue;
      }
      if (!disciplineIds.includes(entry.disciplineId)) {
        disciplineIds.push(entry.disciplineId);
      }
    }
  }

  return disciplineIds.map((disciplineId) => {
    const discipline = input.gameState.disciplines?.find((entry) => entry.id === disciplineId) ?? null;
    return {
      disciplineId,
      name: discipline?.name ?? disciplineId,
      playerCount:
        typeof discipline?.playerCount === "number" && Number.isFinite(discipline.playerCount)
          ? discipline.playerCount
          : null,
    };
  });
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
  return backfillPlayerInjuryHistoryFromSeasonEvents(gameState);
}
