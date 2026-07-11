import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { buildGameStateContentSignature, getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildPlayerLeagueCareerStatsMap } from "@/lib/foundation/player-league-career-stats";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { hydrateSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { ratingsSliceRowsFromPersisted } from "@/lib/foundation/resolve-slice-save-context";
import {
  buildSeasonRatingsSlice,
  type SeasonRatingsSlicePlayerRow,
} from "@/lib/foundation/season-ratings-slice";

export type PlayerDirectoryPerformanceRow = Pick<
  PlayerSeasonPerformanceSummary,
  | "appearances"
  | "totalPoints"
  | "bestDisciplineLabel"
  | "bestDisciplineScore"
  | "latestMatchdayId"
  | "latestFinalScore"
>;

export type PlayerDirectorySliceResponse = {
  scope: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
  };
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>;
  performanceByPlayerId: Record<string, PlayerDirectoryPerformanceRow>;
  careerStatsByPlayerId: Record<
    string,
    {
      appearances: number;
      totalPps: number;
      seasonsPlayed: number;
    }
  >;
  count: number;
};

function toPerformanceRow(summary: PlayerSeasonPerformanceSummary): PlayerDirectoryPerformanceRow {
  return {
    appearances: summary.appearances,
    totalPoints: summary.totalPoints,
    bestDisciplineLabel: summary.bestDisciplineLabel,
    bestDisciplineScore: summary.bestDisciplineScore,
    latestMatchdayId: summary.latestMatchdayId,
    latestFinalScore: summary.latestFinalScore,
  };
}

export function buildPlayerDirectorySliceFromPersisted(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  persistedRecord: PersistedSeasonDerivationsRecord;
  seasonState: SeasonState;
}): PlayerDirectorySliceResponse {
  const derivations = hydrateSeasonDerivations(input.persistedRecord);
  const ratingsByPlayerId = ratingsSliceRowsFromPersisted(input.persistedRecord);
  const careerStatsByPlayerId = Object.fromEntries(
    buildPlayerLeagueCareerStatsMap(
      {
        season: { id: input.seasonId },
        seasonState: input.seasonState,
      } as GameState,
      {
        currentSeasonPerformanceByPlayerId: derivations.performanceByPlayerId,
        currentSeasonLedger: derivations.ledger,
      },
    ),
  );
  const performanceByPlayerId = Object.fromEntries(
    Array.from(derivations.performanceByPlayerId.entries()).map(
      ([playerId, summary]) => [playerId, toPerformanceRow(summary)] as const,
    ),
  );

  return {
    scope: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      contentSignature: input.contentSignature,
    },
    ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    count: Object.keys(ratingsByPlayerId).length,
  };
}

export function buildPlayerDirectorySlice(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
}): PlayerDirectorySliceResponse {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const contentSignature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const derivations = getSeasonDerivations({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });
  const ratingsSlice = buildSeasonRatingsSlice({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });
  const careerStatsByPlayerId = Object.fromEntries(
    buildPlayerLeagueCareerStatsMap(input.gameState, {
      currentSeasonPerformanceByPlayerId: derivations.performanceByPlayerId,
      currentSeasonLedger: derivations.ledger,
    }),
  );

  const performanceByPlayerId = Object.fromEntries(
    Array.from(derivations.performanceByPlayerId.entries()).map(
      ([playerId, summary]) => [playerId, toPerformanceRow(summary)] as const,
    ),
  );

  return {
    scope: {
      saveId: input.saveId,
      seasonId,
      contentSignature,
    },
    ratingsByPlayerId: ratingsSlice.ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    count: Object.keys(ratingsSlice.ratingsByPlayerId).length,
  };
}
