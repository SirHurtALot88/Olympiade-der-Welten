import type { GameState, SeasonSnapshotPlayerPerformanceRecord } from "@/lib/data/olyDataTypes";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { clampSeasonSnapshotsToCurrentSeason } from "@/lib/foundation/season-history-clamp";

export type PlayerLeagueCareerStats = {
  appearances: number;
  totalPps: number;
  seasonsPlayed: number;
};

type PlayerSeasonContribution = {
  appearances: number;
  totalPps: number;
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function extractSeasonContributionFromSnapshotRow(
  row: SeasonSnapshotPlayerPerformanceRecord,
): PlayerSeasonContribution {
  const breakdown = row.disciplineBreakdown ?? [];
  if (breakdown.length > 0) {
    return {
      appearances: breakdown.reduce((sum, entry) => sum + (entry.appearances ?? 0), 0),
      totalPps: roundValue(
        breakdown.reduce((sum, entry) => sum + (entry.totalContribution ?? 0), 0),
        1,
      ),
    };
  }

  return {
    appearances: row.appearances ?? 0,
    totalPps: roundValue(row.totalPoints ?? row.totalContribution ?? 0, 1),
  };
}

function extractSeasonContributionFromPerformanceSummary(
  performance: PlayerSeasonPerformanceSummary,
): PlayerSeasonContribution {
  const breakdown = performance.disciplineBreakdown ?? [];
  if (breakdown.length > 0) {
    return {
      appearances: breakdown.reduce((sum, entry) => sum + (entry.appearances ?? 0), 0),
      totalPps: roundValue(
        breakdown.reduce((sum, entry) => sum + (entry.totalContribution ?? 0), 0),
        1,
      ),
    };
  }

  return {
    appearances: performance.appearances ?? 0,
    totalPps: roundValue(performance.totalPoints ?? 0, 1),
  };
}

export function buildPlayerLeagueCareerStatsMap(
  gameState: GameState,
  options?: {
    currentSeasonPerformanceByPlayerId?: Map<string, PlayerSeasonPerformanceSummary>;
    currentSeasonLedger?: SeasonPointsLedger | null;
  },
): Map<string, PlayerLeagueCareerStats> {
  const seasonContributionsByPlayerId = new Map<string, Map<string, PlayerSeasonContribution>>();
  const snapshotSeasonIds = new Set<string>();

  const rememberSeasonContribution = (playerId: string, seasonId: string, contribution: PlayerSeasonContribution) => {
    if (!playerId || !seasonId) {
      return;
    }
    if (contribution.appearances <= 0 && contribution.totalPps <= 0) {
      return;
    }

    const bySeason = seasonContributionsByPlayerId.get(playerId) ?? new Map<string, PlayerSeasonContribution>();
    bySeason.set(seasonId, contribution);
    seasonContributionsByPlayerId.set(playerId, bySeason);
  };

  for (const snapshot of clampSeasonSnapshotsToCurrentSeason(gameState)) {
    snapshotSeasonIds.add(snapshot.seasonId);
    for (const row of snapshot.playerPerformances ?? []) {
      rememberSeasonContribution(
        row.playerId,
        snapshot.seasonId,
        extractSeasonContributionFromSnapshotRow(row),
      );
    }
  }

  const currentSeasonId = gameState.season.id;
  if (!snapshotSeasonIds.has(currentSeasonId)) {
    const ledgerSummaries = options?.currentSeasonLedger?.playerSummariesByPlayerId;
    if (ledgerSummaries && ledgerSummaries.size > 0) {
      for (const [playerId, summary] of ledgerSummaries.entries()) {
        rememberSeasonContribution(playerId, currentSeasonId, {
          appearances: summary.appearances ?? 0,
          totalPps: roundValue(summary.totalPoints ?? 0, 1),
        });
      }
    } else {
      for (const [playerId, performance] of options?.currentSeasonPerformanceByPlayerId ?? []) {
        rememberSeasonContribution(
          playerId,
          currentSeasonId,
          extractSeasonContributionFromPerformanceSummary(performance),
        );
      }
    }
  }

  return new Map(
    [...seasonContributionsByPlayerId.entries()]
      .map(([playerId, bySeason]) => {
        const totals = [...bySeason.values()].reduce(
          (accumulator, season) => ({
            appearances: accumulator.appearances + season.appearances,
            totalPps: roundValue(accumulator.totalPps + season.totalPps, 1),
          }),
          { appearances: 0, totalPps: 0 },
        );

        return [
          playerId,
          {
            appearances: totals.appearances,
            totalPps: totals.totalPps,
            seasonsPlayed: bySeason.size,
          },
        ] as const;
      })
      .filter(([, stats]) => stats.appearances > 0 || stats.totalPps > 0),
  );
}
