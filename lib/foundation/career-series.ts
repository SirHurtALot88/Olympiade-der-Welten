import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import {
  resolveSnapshotPlayerPerformanceRow,
  snapshotPerformanceRowHasData,
} from "@/lib/foundation/snapshot-player-performance";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { clampSeasonSnapshotsToCurrentSeason } from "@/lib/foundation/season-history-clamp";

/**
 * Career series selectors for the Werdegang panel.
 *
 * Grounding notes:
 * - Season-over-season development is REAL data (season snapshots). There is NO
 *   per-matchday rank/form history — never synthesize an intra-season trend.
 * - MVS = Market Value Score (fame from discipline strength + appearances,
 *   drives market value/offers). MW = Marktwert (money). Label them distinctly.
 */

export type CareerMedal = "gold" | "silver" | "bronze";

export type PlayerCareerSeasonEntry = {
  seasonId: string;
  seasonLabel: string;
  ovr: number | null;
  ovrRank: number | null;
  pps: number | null;
  ppsRank: number | null;
  mvs: number | null;
  mvsRank: number | null;
  marketValue: number | null;
  appearances: number | null;
  rankMedal: CareerMedal | null;
  mvpCount: number;
  bestDiscipline: string | null;
};

export type CareerMedalCabinet = {
  gold: number;
  silver: number;
  bronze: number;
};

export type PlayerCareerSuperlatives = {
  bestSeasonRank: { seasonLabel: string; rank: number } | null;
  biggestMwJump: { seasonLabel: string; delta: number } | null;
  peakMvs: { seasonLabel: string; value: number } | null;
};

export type PlayerCareerSeries = {
  playerId: string;
  seasons: PlayerCareerSeasonEntry[];
  medals: CareerMedalCabinet;
  mvpTotal: number;
  superlatives: PlayerCareerSuperlatives;
};

export type TeamCareerSeasonEntry = {
  seasonId: string;
  seasonLabel: string;
  rank: number | null;
  points: number | null;
  area: {
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
  };
  marketValueTotal: number | null;
  medal: CareerMedal | null;
};

export type TeamCareerSuperlatives = {
  bestSeason: { seasonLabel: string; rank: number } | null;
  biggestPointsSwing: { seasonLabel: string; delta: number } | null;
  peakMarketValue: { seasonLabel: string; value: number } | null;
};

export type TeamCareerSeries = {
  teamId: string;
  seasons: TeamCareerSeasonEntry[];
  medals: CareerMedalCabinet;
  superlatives: TeamCareerSuperlatives;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getSeasonSortValue(seasonId: string) {
  const numericMatch = seasonId.match(/(\d+)$/);
  return numericMatch ? Number(numericMatch[1]) : Number.NEGATIVE_INFINITY;
}

function compareSeasonSnapshotsAsc(left: SeasonSnapshotRecord, right: SeasonSnapshotRecord) {
  const leftValue = getSeasonSortValue(left.seasonId);
  const rightValue = getSeasonSortValue(right.seasonId);
  if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue) {
    return leftValue - rightValue;
  }
  return left.seasonId.localeCompare(right.seasonId, "de", { numeric: true });
}

function deriveMedalFromRank(rank: number | null | undefined): CareerMedal | null {
  if (!isFiniteNumber(rank)) {
    return null;
  }
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}

function countMedals(medals: Array<CareerMedal | null>): CareerMedalCabinet {
  return medals.reduce<CareerMedalCabinet>(
    (cabinet, medal) => {
      if (medal === "gold") cabinet.gold += 1;
      if (medal === "silver") cabinet.silver += 1;
      if (medal === "bronze") cabinet.bronze += 1;
      return cabinet;
    },
    { gold: 0, silver: 0, bronze: 0 },
  );
}

function getSortedSnapshots(gameState: GameState) {
  // Drop any snapshot for a season newer than the live season (contaminated saves)
  // so career tables never show future seasons.
  return clampSeasonSnapshotsToCurrentSeason(gameState).sort(compareSeasonSnapshotsAsc);
}

export function buildPlayerCareerSeries(gameState: GameState, playerId: string): PlayerCareerSeries {
  const seasons: PlayerCareerSeasonEntry[] = [];

  for (const snapshot of getSortedSnapshots(gameState)) {
    const row = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, playerId);
    if (!row) {
      continue;
    }
    const hasRatingData =
      isFiniteNumber(row.ovr) || isFiniteNumber(row.mvs) || isFiniteNumber(row.marketValue) || isFiniteNumber(row.pps);
    if (!hasRatingData && !snapshotPerformanceRowHasData(row)) {
      continue;
    }

    seasons.push({
      seasonId: snapshot.seasonId,
      seasonLabel: getCanonicalSeasonLabel({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName }),
      ovr: row.ovr ?? null,
      ovrRank: row.ovrRank ?? null,
      pps: row.pps ?? row.totalPoints ?? row.totalContribution ?? null,
      ppsRank: row.ppsRank ?? null,
      mvs: row.mvs ?? null,
      mvsRank: row.mvsRank ?? null,
      marketValue: row.marketValue ?? null,
      appearances: isFiniteNumber(row.appearances) ? row.appearances : null,
      // Player snapshots carry no explicit medal flags — derive podium medals
      // from the season PPs-rank (league-wide performance rank of that season).
      rankMedal: deriveMedalFromRank(row.ppsRank ?? null),
      mvpCount: isFiniteNumber(row.mvpCount) ? row.mvpCount : 0,
      bestDiscipline: row.bestDisciplineLabel ?? row.bestDisciplineId ?? null,
    });
  }

  let bestSeasonRank: PlayerCareerSuperlatives["bestSeasonRank"] = null;
  let biggestMwJump: PlayerCareerSuperlatives["biggestMwJump"] = null;
  let peakMvs: PlayerCareerSuperlatives["peakMvs"] = null;

  seasons.forEach((entry, index) => {
    const seasonRank = entry.ppsRank ?? entry.ovrRank;
    if (seasonRank != null && (bestSeasonRank == null || seasonRank < bestSeasonRank.rank)) {
      bestSeasonRank = { seasonLabel: entry.seasonLabel, rank: seasonRank };
    }
    if (isFiniteNumber(entry.mvs) && (peakMvs == null || entry.mvs > peakMvs.value)) {
      peakMvs = { seasonLabel: entry.seasonLabel, value: entry.mvs };
    }
    const previous = index > 0 ? seasons[index - 1] : null;
    if (previous && isFiniteNumber(entry.marketValue) && isFiniteNumber(previous.marketValue)) {
      const delta = Number((entry.marketValue - previous.marketValue).toFixed(2));
      if (delta > 0 && (biggestMwJump == null || delta > biggestMwJump.delta)) {
        biggestMwJump = { seasonLabel: entry.seasonLabel, delta };
      }
    }
  });

  return {
    playerId,
    seasons,
    medals: countMedals(seasons.map((entry) => entry.rankMedal)),
    mvpTotal: seasons.reduce((total, entry) => total + entry.mvpCount, 0),
    superlatives: { bestSeasonRank, biggestMwJump, peakMvs },
  };
}

export function buildTeamCareerSeries(gameState: GameState, teamId: string): TeamCareerSeries {
  const seasons: TeamCareerSeasonEntry[] = [];

  for (const snapshot of getSortedSnapshots(gameState)) {
    const record = resolveSeasonSnapshotTeamRecords(snapshot).find((entry) => entry.teamId === teamId) ?? null;
    if (!record) {
      continue;
    }

    const explicitMedal: CareerMedal | null = record.isGold
      ? "gold"
      : record.isSilver
        ? "silver"
        : record.isBronze
          ? "bronze"
          : null;

    seasons.push({
      seasonId: snapshot.seasonId,
      seasonLabel: getCanonicalSeasonLabel({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName }),
      rank: isFiniteNumber(record.rank) ? record.rank : null,
      points: isFiniteNumber(record.points) ? record.points : null,
      area: {
        pow: record.disciplinePointsByArea?.pow ?? null,
        spe: record.disciplinePointsByArea?.spe ?? null,
        men: record.disciplinePointsByArea?.men ?? null,
        soc: record.disciplinePointsByArea?.soc ?? null,
      },
      marketValueTotal: record.marketValueTotalEnd ?? record.marketValueEnd ?? null,
      medal: explicitMedal ?? deriveMedalFromRank(record.rank),
    });
  }

  let bestSeason: TeamCareerSuperlatives["bestSeason"] = null;
  let biggestPointsSwing: TeamCareerSuperlatives["biggestPointsSwing"] = null;
  let peakMarketValue: TeamCareerSuperlatives["peakMarketValue"] = null;

  seasons.forEach((entry, index) => {
    if (entry.rank != null && (bestSeason == null || entry.rank < bestSeason.rank)) {
      bestSeason = { seasonLabel: entry.seasonLabel, rank: entry.rank };
    }
    if (isFiniteNumber(entry.marketValueTotal) && (peakMarketValue == null || entry.marketValueTotal > peakMarketValue.value)) {
      peakMarketValue = { seasonLabel: entry.seasonLabel, value: entry.marketValueTotal };
    }
    const previous = index > 0 ? seasons[index - 1] : null;
    if (previous && isFiniteNumber(entry.points) && isFiniteNumber(previous.points)) {
      const delta = Number((entry.points - previous.points).toFixed(1));
      if (biggestPointsSwing == null || Math.abs(delta) > Math.abs(biggestPointsSwing.delta)) {
        biggestPointsSwing = { seasonLabel: entry.seasonLabel, delta };
      }
    }
  });

  return {
    teamId,
    seasons,
    medals: countMedals(seasons.map((entry) => entry.medal)),
    superlatives: { bestSeason, biggestPointsSwing, peakMarketValue },
  };
}
