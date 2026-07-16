import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { computePlayerSeasonAverageMatchdayFatigue } from "@/lib/foundation/player-season-fatigue-stats";

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function countTeamSeasonInjuries(gameState: GameState, teamId: string, seasonId: string): number {
  const seenEventIds = new Set<string>();
  let count = 0;

  for (const event of gameState.seasonState.injuryEvents ?? []) {
    if (event.seasonId !== seasonId || event.teamId !== teamId || event.result !== "injured") {
      continue;
    }
    if (seenEventIds.has(event.eventId)) {
      continue;
    }
    seenEventIds.add(event.eventId);
    count += 1;
  }

  for (const player of gameState.players) {
    for (const entry of player.injuryHistory ?? []) {
      if (entry.seasonId !== seasonId || entry.teamId !== teamId) {
        continue;
      }
      if (seenEventIds.has(entry.eventId)) {
        continue;
      }
      seenEventIds.add(entry.eventId);
      count += 1;
    }
  }

  return count;
}

function resolveTeamPlayerIdsForSeason(input: {
  gameState: GameState;
  teamId: string;
  seasonId: string;
  snapshot?: SeasonSnapshotRecord | null;
}): string[] {
  if (input.seasonId === input.gameState.season.id) {
    return input.gameState.rosters
      .filter((entry) => entry.teamId === input.teamId)
      .map((entry) => entry.playerId);
  }

  const performances = input.snapshot?.playerPerformances ?? input.snapshot?.playerPerformanceSnapshots ?? [];
  return [
    ...new Set(
      performances
        .filter((entry) => entry.teamId === input.teamId && entry.appearances > 0)
        .map((entry) => entry.playerId),
    ),
  ];
}

export function computeTeamSeasonAverageMatchdayFatigue(input: {
  gameState: GameState;
  teamId: string;
  seasonId: string;
  snapshot?: SeasonSnapshotRecord | null;
}): number | null {
  const playerIds = resolveTeamPlayerIdsForSeason(input);
  if (playerIds.length === 0) {
    return null;
  }

  const injuryEvents = input.gameState.seasonState.injuryEvents ?? [];
  const fatigueValues: number[] = [];

  for (const playerId of playerIds) {
    const average =
      input.seasonId === input.gameState.season.id
        ? computePlayerSeasonAverageMatchdayFatigue({
            playerId,
            seasonId: input.seasonId,
            performances: input.gameState.seasonState.playerDisciplinePerformances ?? [],
            matchdayResults: input.gameState.seasonState.matchdayResults ?? [],
            injuryEvents,
          })
        : input.snapshot
          ? computePlayerSeasonAverageMatchdayFatigue({
              playerId,
              seasonId: input.snapshot.seasonId,
              performances: input.snapshot.playerDisciplinePerformances ?? [],
              matchdayResults: input.snapshot.matchdayResults ?? [],
              injuryEvents,
            })
          : null;

    if (average != null) {
      fatigueValues.push(average);
    }
  }

  if (fatigueValues.length === 0) {
    return null;
  }

  return roundValue(fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length, 1);
}
