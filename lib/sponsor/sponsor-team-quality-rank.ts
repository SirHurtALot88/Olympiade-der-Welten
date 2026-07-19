import type { GameState, SponsorRarity } from "@/lib/data/olyDataTypes";
import {
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";
import { mapStarTierToRarity } from "@/lib/sponsor/sponsor-curve-shapes";

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
  /** Rarity-Obergrenze für die Angebots-/Slate-Roller. */
  maxRarity: SponsorRarity;
  /** Rarity-Ziel (der Normalfall unter der Decke). */
  targetRarity: SponsorRarity;
  leaguePosition: number;
  leaguePercentile: number;
};

/**
 * Internal 1..5 ladder step used only to compute maxRarity/targetRarity below — this is NOT a public
 * star-tier concept, it's the private bucketing the original calibration was tuned against (it folds
 * 4-to-1 into the 4 public rarities via mapStarTierToRarity, exactly like the legacy save migration does).
 * Kept private so no consumer can depend on a 5-level tier again.
 */
type RarityLadderStep = 1 | 2 | 3 | 4 | 5;

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

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
}

/**
 * Feed 1 (TEIL A) — Beliebtheit hebt/senkt die Rarity-Decke organisch:
 *  +1 Leiterstufe ab Beliebtheit ≥ UP1 (Default 1.20),
 *  +1 weitere (gesamt bis Deckel 5) ab ≥ UP2 (Default 1.35),
 *  −1 symmetrisch bei ≤ DOWN (Default 0.70).
 * So kann z. B. ein Rang-24-Überperformer mit hoher Beliebtheit magisch statt gewöhnlich erreichen.
 * ENV-tunebar.
 */
export const SPONSOR_BELIEBTHEIT_TIER_UP1 = envNumber("OLY_SPONSOR_BELIEBTHEIT_STAR_UP1", 1.2);
export const SPONSOR_BELIEBTHEIT_TIER_UP2 = envNumber("OLY_SPONSOR_BELIEBTHEIT_STAR_UP2", 1.35);
export const SPONSOR_BELIEBTHEIT_TIER_DOWN = envNumber("OLY_SPONSOR_BELIEBTHEIT_STAR_DOWN", 0.7);

function getBeliebtheitTierDelta(beliebtheit?: number | null): number {
  if (beliebtheit == null || !Number.isFinite(beliebtheit)) {
    return 0;
  }
  if (beliebtheit >= SPONSOR_BELIEBTHEIT_TIER_UP2) return 2;
  if (beliebtheit >= SPONSOR_BELIEBTHEIT_TIER_UP1) return 1;
  if (beliebtheit <= SPONSOR_BELIEBTHEIT_TIER_DOWN) return -1;
  return 0;
}

function clampTierBucket(tier: number): RarityLadderStep {
  return Math.max(1, Math.min(5, Math.round(tier))) as RarityLadderStep;
}

function getMaxTierBucketForQualityRank(qualityRank: number, beliebtheit?: number | null): RarityLadderStep {
  let baseTier: RarityLadderStep;
  if (qualityRank <= 4) baseTier = 5;
  else if (qualityRank <= 10) baseTier = 4;
  else if (qualityRank <= 18) baseTier = 3;
  else if (qualityRank <= 26) baseTier = 2;
  else baseTier = 1;
  return clampTierBucket(baseTier + getBeliebtheitTierDelta(beliebtheit));
}

function getPercentileTargetTierBucket(leaguePosition: number, teamCount: number): RarityLadderStep {
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

/** Public rarity-keyed equivalent of the max ladder bucket (same bucketing, exposed as a rarity). */
export function getMaxRarityForQualityRank(qualityRank: number, beliebtheit?: number | null): SponsorRarity {
  return mapStarTierToRarity(getMaxTierBucketForQualityRank(qualityRank, beliebtheit));
}

/** Public rarity-keyed equivalent of the percentile target bucket (same bucketing, exposed as a rarity). */
export function getPercentileTargetRarity(leaguePosition: number, teamCount: number): SponsorRarity {
  return mapStarTierToRarity(getPercentileTargetTierBucket(leaguePosition, teamCount));
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

export function buildLeagueTeamQualityRanks(
  rows: TeamManagementSnapshotRow[],
  beliebtheitByTeamId?: Record<string, { value: number }>,
): Map<string, SponsorTeamQualityRank> {
  const teamCount = Math.max(1, rows.length);
  const budgetRankByTeamId = buildBudgetRankByTeamId(rows);
  const marketValueRankByTeamId = buildMarketValueRankByTeamId(rows, budgetRankByTeamId);

  const beliebtheitOf = (teamId: string): number | null => {
    const value = beliebtheitByTeamId?.[teamId]?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

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
      maxTierBucket: getMaxTierBucketForQualityRank(qualityRank, beliebtheitOf(row.teamId)),
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
    const percentileTier = getPercentileTargetTierBucket(leaguePosition, teamCount);
    // Feed 1: Beliebtheit hebt auch die (perzentil-basierte) Ziel-Leiterstufe mit an, damit ein kleiner
    // Überperformer den erhöhten Deckel tatsächlich erreicht (nicht nur der Cap steigt).
    const beliebtheitDelta = getBeliebtheitTierDelta(beliebtheitOf(entry.teamId));
    const liftedPercentileTier = clampTierBucket(percentileTier + beliebtheitDelta);
    const targetTierBucket = Math.min(entry.maxTierBucket, liftedPercentileTier) as RarityLadderStep;

    result.set(entry.teamId, {
      teamId: entry.teamId,
      qualityRank: entry.qualityRank,
      components: entry.components,
      maxRarity: mapStarTierToRarity(entry.maxTierBucket),
      targetRarity: mapStarTierToRarity(targetTierBucket),
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
