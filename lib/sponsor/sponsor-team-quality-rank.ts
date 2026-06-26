import type { GameState, SponsorStarTier } from "@/lib/data/olyDataTypes";
import {
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";

export type SponsorTeamQualityComponent = {
  key: string;
  rank: number;
  weight: number;
  available: boolean;
};

export type SponsorTeamQualityRank = {
  teamId: string;
  qualityRank: number;
  components: SponsorTeamQualityComponent[];
  maxStarTier: SponsorStarTier;
  targetStarTier: SponsorStarTier;
  leaguePosition: number;
  leaguePercentile: number;
};

const HISTORY_SLOT_WEIGHTS = [25, 21, 17, 13, 9] as const;
const HISTORY_SLOT_KEYS = ["seasonN1", "seasonN2", "seasonN3", "seasonN4", "seasonN5"] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clampRank(rank: number, teamCount: number) {
  return Math.min(teamCount, Math.max(1, Math.round(rank)));
}

function buildBudgetRankByTeamId(rows: TeamManagementSnapshotRow[]) {
  const sorted = [...rows].sort((left, right) => {
    const leftBudget = left.budget ?? left.cash ?? Number.NEGATIVE_INFINITY;
    const rightBudget = right.budget ?? right.cash ?? Number.NEGATIVE_INFINITY;
    if (rightBudget !== leftBudget) {
      return rightBudget - leftBudget;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  const rankByTeamId = new Map<string, number>();
  let previousBudget: number | null = null;
  let previousRank = 0;

  sorted.forEach((row, index) => {
    const budget = row.budget ?? row.cash ?? null;
    if (previousBudget != null && budget === previousBudget) {
      rankByTeamId.set(row.teamId, previousRank);
      return;
    }
    const rank = index + 1;
    rankByTeamId.set(row.teamId, rank);
    previousBudget = budget;
    previousRank = rank;
  });

  return rankByTeamId;
}

function buildMarketValueRankByTeamId(rows: TeamManagementSnapshotRow[], budgetRankByTeamId: Map<string, number>) {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = left.marketValueTotal ?? 0;
    const rightValue = right.marketValueTotal ?? 0;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    const leftBudgetRank = budgetRankByTeamId.get(left.teamId) ?? 32;
    const rightBudgetRank = budgetRankByTeamId.get(right.teamId) ?? 32;
    if (leftBudgetRank !== rightBudgetRank) {
      return leftBudgetRank - rightBudgetRank;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  const rankByTeamId = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sorted.forEach((row, index) => {
    const value = row.marketValueTotal ?? 0;
    if (previousValue != null && value === previousValue) {
      rankByTeamId.set(row.teamId, previousRank);
      return;
    }
    const rank = index + 1;
    rankByTeamId.set(row.teamId, rank);
    previousValue = value;
    previousRank = rank;
  });

  for (const row of rows) {
    if (!rankByTeamId.has(row.teamId)) {
      rankByTeamId.set(row.teamId, budgetRankByTeamId.get(row.teamId) ?? rows.length);
    }
  }

  return rankByTeamId;
}

function getCurrentTableRank(row: TeamManagementSnapshotRow, budgetRankByTeamId: Map<string, number>, teamCount: number) {
  const rank = row.startplatz ?? row.rank ?? budgetRankByTeamId.get(row.teamId) ?? Math.ceil(teamCount / 2);
  return clampRank(rank, teamCount);
}

function getHistoricalSeasonRanks(row: TeamManagementSnapshotRow, teamCount: number) {
  const seasons = [...(row.historicalPointsBySeason ?? [])]
    .filter((entry) => entry.rank != null && Number.isFinite(entry.rank))
    .reverse()
    .slice(0, 5);

  return seasons.map((entry) => clampRank(entry.rank as number, teamCount));
}

export function getMaxStarTierForQualityRank(qualityRank: number): SponsorStarTier {
  if (qualityRank <= 4) return 5;
  if (qualityRank <= 10) return 4;
  if (qualityRank <= 18) return 3;
  if (qualityRank <= 26) return 2;
  return 1;
}

export function getPercentileTargetStarTier(leaguePosition: number, teamCount: number): SponsorStarTier {
  if (teamCount <= 1) {
    return 3;
  }
  const percentile = (leaguePosition - 1) / Math.max(1, teamCount - 1);
  if (percentile <= 0.12) return 5;
  if (percentile <= 0.3) return 4;
  if (percentile <= 0.6) return 3;
  if (percentile <= 0.85) return 2;
  return 1;
}

function computeWeightedQualityRank(input: {
  row: TeamManagementSnapshotRow;
  teamCount: number;
  budgetRankByTeamId: Map<string, number>;
  marketValueRankByTeamId: Map<string, number>;
}): { qualityRank: number; components: SponsorTeamQualityComponent[] } {
  const { row, teamCount, budgetRankByTeamId, marketValueRankByTeamId } = input;
  const budgetRank = budgetRankByTeamId.get(row.teamId) ?? Math.ceil(teamCount / 2);
  const currentRank = getCurrentTableRank(row, budgetRankByTeamId, teamCount);
  const marketValueRank =
    (row.marketValueTotal ?? 0) > 0
      ? marketValueRankByTeamId.get(row.teamId) ?? budgetRank
      : budgetRank;
  const historyRanks = getHistoricalSeasonRanks(row, teamCount);

  const components: SponsorTeamQualityComponent[] = [
    { key: "current", rank: currentRank, weight: 0.25, available: true },
    { key: "marketValue", rank: marketValueRank, weight: 0.2, available: true },
  ];

  const historyWeightTotal = 0.55;
  const historyRelativeSum = HISTORY_SLOT_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  historyRanks.forEach((rank, index) => {
    components.push({
      key: HISTORY_SLOT_KEYS[index] ?? `seasonN${index + 1}`,
      rank,
      weight: historyWeightTotal * (HISTORY_SLOT_WEIGHTS[index]! / historyRelativeSum),
      available: true,
    });
  });

  const available = components.filter((component) => component.available);
  const weightSum = available.reduce((sum, component) => sum + component.weight, 0);
  const qualityRank =
    weightSum > 0
      ? available.reduce((sum, component) => sum + component.rank * (component.weight / weightSum), 0)
      : currentRank;

  return {
    qualityRank: round2(qualityRank),
    components: available,
  };
}

export function buildLeagueTeamQualityRanks(rows: TeamManagementSnapshotRow[]): Map<string, SponsorTeamQualityRank> {
  const teamCount = Math.max(1, rows.length);
  const budgetRankByTeamId = buildBudgetRankByTeamId(rows);
  const marketValueRankByTeamId = buildMarketValueRankByTeamId(rows, budgetRankByTeamId);

  const preliminary = rows.map((row) => {
    const { qualityRank, components } = computeWeightedQualityRank({
      row,
      teamCount,
      budgetRankByTeamId,
      marketValueRankByTeamId,
    });
    return {
      teamId: row.teamId,
      qualityRank,
      components,
      maxStarTier: getMaxStarTierForQualityRank(qualityRank),
    };
  });

  const sorted = [...preliminary].sort((left, right) => {
    if (left.qualityRank !== right.qualityRank) {
      return left.qualityRank - right.qualityRank;
    }
    return left.teamId.localeCompare(right.teamId);
  });

  const result = new Map<string, SponsorTeamQualityRank>();
  sorted.forEach((entry, index) => {
    const leaguePosition = index + 1;
    const leaguePercentile = round2(((teamCount - leaguePosition) / Math.max(1, teamCount - 1)) * 100);
    const percentileTier = getPercentileTargetStarTier(leaguePosition, teamCount);
    const targetStarTier = Math.min(entry.maxStarTier, percentileTier) as SponsorStarTier;

    result.set(entry.teamId, {
      teamId: entry.teamId,
      qualityRank: entry.qualityRank,
      components: entry.components,
      maxStarTier: entry.maxStarTier,
      targetStarTier,
      leaguePosition,
      leaguePercentile,
    });
  });

  return result;
}

export function computeSponsorTeamQualityRank(input: {
  rows: TeamManagementSnapshotRow[];
  teamId: string;
}): SponsorTeamQualityRank | null {
  const ranks = buildLeagueTeamQualityRanks(input.rows);
  return ranks.get(input.teamId) ?? null;
}

export function computeSponsorTeamQualityRankForGame(input: {
  gameState: GameState;
  teamId: string;
}): SponsorTeamQualityRank | null {
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  return computeSponsorTeamQualityRank({ rows, teamId: input.teamId });
}
