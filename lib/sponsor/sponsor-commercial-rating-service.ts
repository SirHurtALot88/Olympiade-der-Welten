import type { GameState, SponsorCommercialRating, SponsorStarTier, TeamManagementSnapshotRow } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rankToScore(rank: number | null | undefined) {
  if (rank == null || !Number.isFinite(rank)) {
    return 50;
  }
  return clamp(100 - (rank - 1) * 2.8, 15, 100);
}

function percentileRank(values: number[], value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || values.length === 0) {
    return 50;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const below = sorted.filter((entry) => entry < value).length;
  return clamp(Math.round((below / sorted.length) * 100), 0, 100);
}

function computeWeightedHistoricalRank(row: TeamManagementSnapshotRow) {
  const seasons = row.historicalPointsBySeason ?? [];
  if (seasons.length > 0) {
    const weights = [0.6, 0.25, 0.15];
    let weightedSum = 0;
    let weightTotal = 0;
    for (let index = 0; index < Math.min(seasons.length, weights.length); index += 1) {
      const rank = seasons[index]?.rank ?? null;
      if (rank != null) {
        weightedSum += rank * weights[index]!;
        weightTotal += weights[index]!;
      }
    }
    if (weightTotal > 0) {
      return weightedSum / weightTotal;
    }
  }
  if (row.historicalLastSeasonRank != null) {
    return row.historicalLastSeasonRank;
  }
  return row.startplatz ?? row.rank ?? null;
}

function computePrestigeScore(row: TeamManagementSnapshotRow, identityAmbition: number) {
  const medalScore =
    row.historicalGoldCount * 4 +
    row.historicalSilverCount * 2.5 +
    row.historicalBronzeCount * 1.5 +
    row.historicalTop5Count * 0.8 +
    row.historicalTop10Count * 0.4;
  const ambitionBonus = clamp(identityAmbition - 5, 0, 4);
  return clamp(medalScore + ambitionBonus, 0, 20);
}

function scoreToTierHint(score: number): SponsorStarTier {
  if (score >= 86) return 5;
  if (score >= 71) return 4;
  if (score >= 51) return 3;
  if (score >= 26) return 2;
  return 1;
}

export function buildSponsorCommercialRating(input: {
  gameState: GameState;
  teamId: string;
}): SponsorCommercialRating {
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.teamId) ?? null;
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;

  const avgWeightedRank = row ? computeWeightedHistoricalRank(row) : null;
  const recentPerformance = rankToScore(avgWeightedRank) * 0.45;

  const marketValues = rows.map((entry) => entry.marketValueTotal ?? 0);
  const axisValues = rows.map((entry) => {
    const values = [entry.ppsPow, entry.ppsSpe, entry.ppsMen, entry.ppsSoc].filter((value) => value != null && value > 0);
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  });
  const mvPct = percentileRank(marketValues, row?.marketValueTotal ?? null);
  const axisPct = percentileRank(
    axisValues,
    row
      ? [row.ppsPow, row.ppsSpe, row.ppsMen, row.ppsSoc].filter((value) => value > 0).reduce((sum, value, _, arr) => sum + value / arr.length, 0) ||
          null
      : null,
  );
  const depthScore = clamp((row?.rosterCount ?? 0) >= 12 ? 80 : (row?.rosterCount ?? 0) >= 10 ? 60 : 40, 0, 100);
  const rosterPotential = (mvPct * 0.5 + axisPct * 0.35 + depthScore * 0.15) * 0.35;

  const prestige = row ? computePrestigeScore(row, identity?.ambition ?? 5) : 0;
  const score = Math.round(clamp(recentPerformance + rosterPotential + prestige, 0, 100));

  return {
    score,
    tierHint: scoreToTierHint(score),
    breakdown: {
      recentPerformance: Number(recentPerformance.toFixed(1)),
      rosterPotential: Number(rosterPotential.toFixed(1)),
      prestige: Number(prestige.toFixed(1)),
    },
    inputs: {
      lastSeasonRank: row?.historicalLastSeasonRank ?? row?.rank ?? null,
      avgWeightedRank,
      marketValuePercentile: mvPct,
      axisPercentile: axisPct,
      depthScore,
      prestigeMedalScore: prestige,
    },
  };
}
