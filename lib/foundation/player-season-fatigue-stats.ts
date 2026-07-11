import type {
  GameState,
  InjuryEventRecord,
  MatchdayResultRecord,
  PlayerDisciplinePerformanceRecord,
} from "@/lib/data/olyDataTypes";
import { MATCHDAY_FATIGUE_LOAD } from "@/lib/fatigue/fatigue-injury-service";

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function clampFatigue(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function resolvePreMatchFatigueFromEvent(event: InjuryEventRecord) {
  return clampFatigue(event.fatigueBefore - MATCHDAY_FATIGUE_LOAD);
}

export function computePlayerSeasonAverageMatchdayFatigue(input: {
  playerId: string;
  seasonId: string;
  performances: PlayerDisciplinePerformanceRecord[];
  matchdayResults: MatchdayResultRecord[];
  injuryEvents: InjuryEventRecord[];
}) {
  const matchdayIdByResultId = new Map(
    input.matchdayResults.map((result) => [result.id, result.matchdayId] as const),
  );
  const appearanceMatchdays = new Set<string>();

  for (const performance of input.performances) {
    if (performance.playerId !== input.playerId) {
      continue;
    }
    const matchdayId = matchdayIdByResultId.get(performance.matchdayResultId);
    if (matchdayId) {
      appearanceMatchdays.add(matchdayId);
    }
  }

  if (appearanceMatchdays.size === 0) {
    return null;
  }

  const preMatchFatigueByMatchday = new Map<string, number>();
  for (const event of input.injuryEvents) {
    if (event.playerId !== input.playerId || event.seasonId !== input.seasonId) {
      continue;
    }
    preMatchFatigueByMatchday.set(event.matchdayId, resolvePreMatchFatigueFromEvent(event));
  }

  let total = 0;
  let count = 0;
  for (const matchdayId of appearanceMatchdays) {
    const fatigue = preMatchFatigueByMatchday.get(matchdayId);
    if (fatigue == null) {
      continue;
    }
    total += fatigue;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return roundValue(total / count, 1);
}

export function buildPlayerAverageMatchdayFatigueBySeason(gameState: GameState, playerId: string) {
  const injuryEvents = gameState.seasonState.injuryEvents ?? [];
  const bySeasonId = new Map<string, number>();

  const currentAverage = computePlayerSeasonAverageMatchdayFatigue({
    playerId,
    seasonId: gameState.season.id,
    performances: gameState.seasonState.playerDisciplinePerformances ?? [],
    matchdayResults: gameState.seasonState.matchdayResults ?? [],
    injuryEvents,
  });
  if (currentAverage != null) {
    bySeasonId.set(gameState.season.id, currentAverage);
  }

  for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) {
    const average = computePlayerSeasonAverageMatchdayFatigue({
      playerId,
      seasonId: snapshot.seasonId,
      performances: snapshot.playerDisciplinePerformances ?? [],
      matchdayResults: snapshot.matchdayResults ?? [],
      injuryEvents,
    });
    if (average != null) {
      bySeasonId.set(snapshot.seasonId, average);
    }
  }

  return bySeasonId;
}
