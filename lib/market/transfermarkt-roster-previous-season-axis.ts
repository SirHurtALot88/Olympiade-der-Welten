import type { DisciplineCategory, GameState, SeasonSnapshotPlayerPerformanceRecord, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import {
  getSnapshotPlayerPerformances,
  resolveSnapshotPlayerPerformanceRow,
  snapshotPerformanceRowHasData,
} from "@/lib/foundation/snapshot-player-performance";

export type MarketRosterPreviousSeasonAxisStats = {
  seasonId: string;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  ppPowRank: number | null;
  ppSpeRank: number | null;
  ppMenRank: number | null;
  ppSocRank: number | null;
};

type AxisId = keyof Pick<MarketRosterPreviousSeasonAxisStats, "ppPow" | "ppSpe" | "ppMen" | "ppSoc">;

const AXIS_POINT_FIELDS: Record<AxisId, "powPoints" | "spePoints" | "menPoints" | "socPoints"> = {
  ppPow: "powPoints",
  ppSpe: "spePoints",
  ppMen: "menPoints",
  ppSoc: "socPoints",
};

const AXIS_DISCIPLINE_CATEGORIES: Record<AxisId, DisciplineCategory> = {
  ppPow: "power",
  ppSpe: "speed",
  ppMen: "mental",
  ppSoc: "social",
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildSharedRankMap(values: Array<{ playerId: string; value: number | null }>) {
  const sorted = [...values].sort((left, right) => {
    const leftValue = left.value ?? Number.NEGATIVE_INFINITY;
    const rightValue = right.value ?? Number.NEGATIVE_INFINITY;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.playerId.localeCompare(right.playerId, "de");
  });

  const rankMap = new Map<string, number | null>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sorted.forEach((entry, index) => {
    if (entry.value == null) {
      rankMap.set(entry.playerId, null);
      return;
    }

    if (previousValue != null && entry.value === previousValue) {
      rankMap.set(entry.playerId, previousRank);
      return;
    }

    previousValue = entry.value;
    previousRank = index + 1;
    rankMap.set(entry.playerId, previousRank);
  });

  return rankMap;
}

function resolveSnapshotAxisPoints(
  gameState: GameState,
  row: SeasonSnapshotPlayerPerformanceRecord,
  axisId: AxisId,
) {
  const directValue = row[AXIS_POINT_FIELDS[axisId]];
  if (isFiniteNumber(directValue)) {
    return directValue;
  }

  const category = AXIS_DISCIPLINE_CATEGORIES[axisId];
  const disciplineCategoryById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const));
  const values = (row.disciplineBreakdown ?? [])
    .filter((entry) => disciplineCategoryById.get(entry.disciplineId) === category && isFiniteNumber(entry.totalContribution))
    .map((entry) => entry.totalContribution ?? 0);
  if (values.length === 0) {
    return null;
  }

  return roundValue(values.reduce((total, value) => total + value, 0), 1);
}

function findPreviousSeasonSnapshot(gameState: GameState): SeasonSnapshotRecord | null {
  const currentSeasonId = gameState.season.id;
  const snapshots = [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.seasonId !== currentSeasonId)
    .filter((snapshot) => getSnapshotPlayerPerformances(snapshot).some(snapshotPerformanceRowHasData))
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }));

  return snapshots[0] ?? null;
}

export function buildMarketRosterPreviousSeasonAxisByPlayerId(gameState: GameState): Map<string, MarketRosterPreviousSeasonAxisStats> {
  const snapshot = findPreviousSeasonSnapshot(gameState);
  const result = new Map<string, MarketRosterPreviousSeasonAxisStats>();
  if (!snapshot) {
    return result;
  }

  const performanceRows = getSnapshotPlayerPerformances(snapshot)
    .map((row) => resolveSnapshotPlayerPerformanceRow(gameState, snapshot, row.playerId) ?? row)
    .filter((row) => Boolean(row.teamId));

  const axisIds = ["ppPow", "ppSpe", "ppMen", "ppSoc"] as const;
  const rankMaps = Object.fromEntries(
    axisIds.map((axisId) => [
      axisId,
      buildSharedRankMap(
        performanceRows.map((row) => ({
          playerId: row.playerId,
          value: resolveSnapshotAxisPoints(gameState, row, axisId),
        })),
      ),
    ]),
  ) as Record<(typeof axisIds)[number], Map<string, number | null>>;

  for (const row of performanceRows) {
    result.set(row.playerId, {
      seasonId: snapshot.seasonId,
      ppPow: resolveSnapshotAxisPoints(gameState, row, "ppPow"),
      ppSpe: resolveSnapshotAxisPoints(gameState, row, "ppSpe"),
      ppMen: resolveSnapshotAxisPoints(gameState, row, "ppMen"),
      ppSoc: resolveSnapshotAxisPoints(gameState, row, "ppSoc"),
      ppPowRank: rankMaps.ppPow.get(row.playerId) ?? null,
      ppSpeRank: rankMaps.ppSpe.get(row.playerId) ?? null,
      ppMenRank: rankMaps.ppMen.get(row.playerId) ?? null,
      ppSocRank: rankMaps.ppSoc.get(row.playerId) ?? null,
    });
  }

  return result;
}
