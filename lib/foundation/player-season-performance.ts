import type { GameState, SeasonSnapshotPlayerPerformanceRecord } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

export type PlayerSeasonPerformanceSummary = {
  seasonId: string | null;
  seasonName: string | null;
  sourceLabel: string;
  appearances: number;
  totalPoints: number | null;
  pointsByArea: {
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
  };
  averageContribution: number | null;
  averageFinalScore: number | null;
  top10Count: number;
  mvpCount: number;
  bestDisciplineLabel: string | null;
  bestDisciplineScore: number | null;
  weakestDisciplineLabel: string | null;
  weakestDisciplineScore: number | null;
  latestDisciplineLabel: string | null;
  latestFinalScore: number | null;
  latestContribution: number | null;
  latestRankInDiscipline: number | null;
  latestMatchdayId: string | null;
  topDisciplineRows: Array<{
    disciplineId: string;
    disciplineName: string;
    totalContribution: number | null;
    averageContribution: number | null;
    averageFinalScore: number | null;
  }>;
  matchdayBreakdown: Array<{
    matchdayId: string;
    appearances: number;
    totalContribution: number | null;
    averageFinalScore: number | null;
    bestDisciplineLabel: string | null;
    bestContribution: number | null;
  }>;
  disciplineBreakdown: Array<{
    disciplineId: string;
    disciplineName: string;
    appearances: number;
    totalContribution: number | null;
    averageContribution: number | null;
    averageFinalScore: number | null;
  }>;
  warnings: string[];
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function buildEmptyAreaPoints() {
  return {
    pow: null,
    spe: null,
    men: null,
    soc: null,
  };
}

function buildAreaPointsFromDisciplineBreakdown(
  disciplineBreakdown: Array<{
    disciplineId: string;
    totalContribution: number | null;
  }>,
  categoryById: Map<string, string>,
) {
  const totals = {
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  };
  let hasAnyValue = false;

  for (const entry of disciplineBreakdown) {
    if (entry.totalContribution == null) {
      continue;
    }
    const category = categoryById.get(entry.disciplineId);
    if (category === "power") totals.pow += entry.totalContribution;
    if (category === "speed") totals.spe += entry.totalContribution;
    if (category === "mental") totals.men += entry.totalContribution;
    if (category === "social") totals.soc += entry.totalContribution;
    hasAnyValue = true;
  }

  if (!hasAnyValue) {
    return buildEmptyAreaPoints();
  }

  return {
    pow: roundValue(totals.pow, 1),
    spe: roundValue(totals.spe, 1),
    men: roundValue(totals.men, 1),
    soc: roundValue(totals.soc, 1),
  };
}

function buildSummaryFromSnapshotRow(
  gameState: GameState,
  row: SeasonSnapshotPlayerPerformanceRecord,
  snapshot?: { seasonId: string; seasonName: string } | null,
): PlayerSeasonPerformanceSummary {
  const disciplineCategoryById = new Map(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );
  const breakdown = [...(row.disciplineBreakdown ?? [])].sort(
    (left, right) => (right.totalContribution ?? Number.NEGATIVE_INFINITY) - (left.totalContribution ?? Number.NEGATIVE_INFINITY),
  );
  const hasSnapshotPointData = typeof row.totalPoints === "number" && Number.isFinite(row.totalPoints);
  const weakest = [...breakdown]
    .filter((entry) => entry.averageFinalScore != null)
    .sort((left, right) => (left.averageFinalScore ?? Number.POSITIVE_INFINITY) - (right.averageFinalScore ?? Number.POSITIVE_INFINITY))[0] ?? null;

  return {
    seasonId: snapshot?.seasonId ?? row.seasonId ?? gameState.season.id,
    seasonName: snapshot?.seasonName ?? gameState.season.name,
    sourceLabel: "Season Snapshot",
    appearances: row.appearances,
    totalPoints: hasSnapshotPointData ? row.totalPoints ?? null : null,
    pointsByArea: hasSnapshotPointData
      ? buildAreaPointsFromDisciplineBreakdown(breakdown, disciplineCategoryById)
      : buildEmptyAreaPoints(),
    averageContribution: row.averageContribution,
    averageFinalScore: row.averageFinalScore,
    top10Count: row.top10Count,
    mvpCount: row.mvpCount,
    bestDisciplineLabel: row.bestDisciplineLabel ?? null,
    bestDisciplineScore: row.bestDisciplineScore ?? null,
    weakestDisciplineLabel: weakest?.disciplineName ?? null,
    weakestDisciplineScore: weakest?.averageFinalScore ?? null,
    latestDisciplineLabel: null,
    latestFinalScore: null,
    latestContribution: null,
    latestRankInDiscipline: null,
    latestMatchdayId: null,
    topDisciplineRows: breakdown.slice(0, 5).map((entry) => ({
      disciplineId: entry.disciplineId,
      disciplineName: entry.disciplineName,
      totalContribution: entry.totalContribution ?? null,
      averageContribution: entry.averageContribution ?? null,
      averageFinalScore: entry.averageFinalScore ?? null,
    })),
    matchdayBreakdown: [],
    disciplineBreakdown: breakdown,
    warnings: hasSnapshotPointData ? (row.warnings ?? []) : Array.from(new Set([...(row.warnings ?? []), "snapshot_player_points_missing"])),
  };
}

function getSnapshotPlayerPerformances(snapshot: {
  playerPerformances?: SeasonSnapshotPlayerPerformanceRecord[];
  playerPerformanceSnapshots?: SeasonSnapshotPlayerPerformanceRecord[];
}) {
  const byPlayerId = new Map<string, SeasonSnapshotPlayerPerformanceRecord>();
  for (const row of snapshot.playerPerformances ?? []) {
    byPlayerId.set(row.playerId, row);
  }
  for (const row of snapshot.playerPerformanceSnapshots ?? []) {
    if (!byPlayerId.has(row.playerId)) {
      byPlayerId.set(row.playerId, row);
    }
  }
  return [...byPlayerId.values()];
}

export function buildPlayerSeasonPerformanceMap(gameState: GameState, seasonPointsLedger?: SeasonPointsLedger) {
  const matchdayResultsById = new Map((gameState.seasonState.matchdayResults ?? []).map((entry) => [entry.id, entry] as const));
  const disciplineNamesById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.name] as const));
  const disciplineCategoryById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const));
  const pointsLedger = seasonPointsLedger ?? buildSeasonPointsLedger(gameState);
  const performanceMap = new Map<
    string,
    {
      appearances: number;
      totalContribution: number;
      totalFinalScore: number;
      top10Count: number;
      mvpCount: number;
      bestDisciplineLabel: string | null;
      bestDisciplineScore: number | null;
      latestDisciplineLabel: string | null;
      latestFinalScore: number | null;
      latestContribution: number | null;
      latestRankInDiscipline: number | null;
      latestMatchdayId: string | null;
      latestSortKey: string;
      pointsByArea: {
        pow: number;
        spe: number;
        men: number;
        soc: number;
      };
      matchdayMap: Map<
        string,
        {
          matchdayId: string;
          appearances: number;
          totalContribution: number;
          totalFinalScore: number;
          bestDisciplineLabel: string | null;
          bestContribution: number | null;
        }
      >;
      breakdownMap: Map<
        string,
        {
          disciplineId: string;
          disciplineName: string;
          appearances: number;
          totalContribution: number;
          totalFinalScore: number;
        }
      >;
    }
  >();

  for (const entry of gameState.seasonState.playerDisciplinePerformances ?? []) {
    const result = matchdayResultsById.get(entry.matchdayResultId);
    if ((result?.seasonId ?? gameState.season.id) !== gameState.season.id) {
      continue;
    }

    const disciplineLabel = disciplineNamesById.get(entry.disciplineId) ?? entry.disciplineId;
    const playerSummary = performanceMap.get(entry.playerId) ?? {
      appearances: 0,
      totalContribution: 0,
      totalFinalScore: 0,
      top10Count: 0,
      mvpCount: 0,
      bestDisciplineLabel: null,
      bestDisciplineScore: null,
      latestDisciplineLabel: null,
      latestFinalScore: null,
      latestContribution: null,
      latestRankInDiscipline: null,
      latestMatchdayId: null,
      latestSortKey: "",
      pointsByArea: { pow: 0, spe: 0, men: 0, soc: 0 },
      matchdayMap: new Map(),
      breakdownMap: new Map(),
    };

    playerSummary.appearances += 1;
    const normalizedPoints = pointsLedger.pointEntriesByPerformanceId.get(entry.id)?.points ?? entry.scoreContribution;
    playerSummary.totalContribution += normalizedPoints;
    playerSummary.totalFinalScore += entry.finalPlayerScore;
    playerSummary.top10Count += entry.isTop10 ? 1 : 0;
    playerSummary.mvpCount += entry.isMvpCandidate ? 1 : 0;

    const category = disciplineCategoryById.get(entry.disciplineId) ?? null;
    if (category === "power") playerSummary.pointsByArea.pow += normalizedPoints;
    if (category === "speed") playerSummary.pointsByArea.spe += normalizedPoints;
    if (category === "mental") playerSummary.pointsByArea.men += normalizedPoints;
    if (category === "social") playerSummary.pointsByArea.soc += normalizedPoints;

    if ((playerSummary.bestDisciplineScore ?? Number.NEGATIVE_INFINITY) < entry.finalPlayerScore) {
      playerSummary.bestDisciplineScore = entry.finalPlayerScore;
      playerSummary.bestDisciplineLabel = disciplineLabel;
    }

    const breakdown = playerSummary.breakdownMap.get(entry.disciplineId) ?? {
      disciplineId: entry.disciplineId,
      disciplineName: disciplineLabel,
      appearances: 0,
      totalContribution: 0,
      totalFinalScore: 0,
    };
    breakdown.appearances += 1;
    breakdown.totalContribution += normalizedPoints;
    breakdown.totalFinalScore += entry.finalPlayerScore;
    playerSummary.breakdownMap.set(entry.disciplineId, breakdown);

    const latestSortKey = `${result?.matchdayId ?? ""}-${entry.createdAt}`;
    if (latestSortKey >= playerSummary.latestSortKey) {
      playerSummary.latestSortKey = latestSortKey;
      playerSummary.latestDisciplineLabel = disciplineLabel;
      playerSummary.latestFinalScore = entry.finalPlayerScore;
      playerSummary.latestContribution = normalizedPoints;
      playerSummary.latestRankInDiscipline = entry.rankInDiscipline ?? null;
      playerSummary.latestMatchdayId = result?.matchdayId ?? null;
    }

    const matchdayId = result?.matchdayId ?? "unknown-matchday";
    const matchdayEntry = playerSummary.matchdayMap.get(matchdayId) ?? {
      matchdayId,
      appearances: 0,
      totalContribution: 0,
      totalFinalScore: 0,
      bestDisciplineLabel: null,
      bestContribution: null,
    };
    matchdayEntry.appearances += 1;
    matchdayEntry.totalContribution += normalizedPoints;
    matchdayEntry.totalFinalScore += entry.finalPlayerScore;
    if ((matchdayEntry.bestContribution ?? Number.NEGATIVE_INFINITY) < normalizedPoints) {
      matchdayEntry.bestContribution = normalizedPoints;
      matchdayEntry.bestDisciplineLabel = disciplineLabel;
    }
    playerSummary.matchdayMap.set(matchdayId, matchdayEntry);

    performanceMap.set(entry.playerId, playerSummary);
  }

  const sortedSnapshots = [...(gameState.seasonState.seasonSnapshots ?? [])].sort((left, right) =>
    right.seasonId.localeCompare(left.seasonId, "de"),
  );
  const snapshot = sortedSnapshots.find((entry) => entry.status == null || entry.status === "completed") ?? null;
  const snapshotMap = new Map(
    (snapshot ? getSnapshotPlayerPerformances(snapshot) : []).map((row) => [row.playerId, buildSummaryFromSnapshotRow(gameState, row, snapshot)] as const),
  );

  const summaryMap = new Map<string, PlayerSeasonPerformanceSummary>();
  for (const [playerId, entry] of performanceMap.entries()) {
    const disciplineBreakdown = Array.from(entry.breakdownMap.values())
      .map((disciplineEntry) => ({
        disciplineId: disciplineEntry.disciplineId,
        disciplineName: disciplineEntry.disciplineName,
        appearances: disciplineEntry.appearances,
        totalContribution: roundValue(disciplineEntry.totalContribution, 1),
        averageContribution: roundValue(disciplineEntry.totalContribution / disciplineEntry.appearances, 1),
        averageFinalScore: roundValue(disciplineEntry.totalFinalScore / disciplineEntry.appearances, 1),
      }))
      .sort((left, right) => (right.totalContribution ?? Number.NEGATIVE_INFINITY) - (left.totalContribution ?? Number.NEGATIVE_INFINITY));
    const matchdayBreakdown = Array.from(entry.matchdayMap.values())
      .map((matchdayEntry) => ({
        matchdayId: matchdayEntry.matchdayId,
        appearances: matchdayEntry.appearances,
        totalContribution: roundValue(matchdayEntry.totalContribution, 1),
        averageFinalScore: roundValue(matchdayEntry.totalFinalScore / matchdayEntry.appearances, 1),
        bestDisciplineLabel: matchdayEntry.bestDisciplineLabel,
        bestContribution: matchdayEntry.bestContribution != null ? roundValue(matchdayEntry.bestContribution, 1) : null,
      }))
      .sort((left, right) => right.matchdayId.localeCompare(left.matchdayId, "de"));
    const weakest = [...disciplineBreakdown]
      .filter((disciplineEntry) => disciplineEntry.averageFinalScore != null)
      .sort((left, right) => (left.averageFinalScore ?? Number.POSITIVE_INFINITY) - (right.averageFinalScore ?? Number.POSITIVE_INFINITY))[0] ?? null;

    summaryMap.set(playerId, {
      seasonId: gameState.season.id,
      seasonName: gameState.season.name,
      sourceLabel: "Aktuelle Matchday-Results",
      appearances: entry.appearances,
      totalPoints: roundValue(entry.totalContribution, 1),
      pointsByArea: {
        pow: roundValue(entry.pointsByArea.pow, 1),
        spe: roundValue(entry.pointsByArea.spe, 1),
        men: roundValue(entry.pointsByArea.men, 1),
        soc: roundValue(entry.pointsByArea.soc, 1),
      },
      averageContribution: roundValue(entry.totalContribution / entry.appearances, 1),
      averageFinalScore: roundValue(entry.totalFinalScore / entry.appearances, 1),
      top10Count: entry.top10Count,
      mvpCount: entry.mvpCount,
      bestDisciplineLabel: entry.bestDisciplineLabel,
      bestDisciplineScore: entry.bestDisciplineScore != null ? roundValue(entry.bestDisciplineScore, 1) : null,
      weakestDisciplineLabel: weakest?.disciplineName ?? null,
      weakestDisciplineScore: weakest?.averageFinalScore ?? null,
      latestDisciplineLabel: entry.latestDisciplineLabel,
      latestFinalScore: entry.latestFinalScore != null ? roundValue(entry.latestFinalScore, 1) : null,
      latestContribution: entry.latestContribution != null ? roundValue(entry.latestContribution, 1) : null,
      latestRankInDiscipline: entry.latestRankInDiscipline,
      latestMatchdayId: entry.latestMatchdayId,
      topDisciplineRows: disciplineBreakdown.slice(0, 5).map((disciplineEntry) => ({
        disciplineId: disciplineEntry.disciplineId,
        disciplineName: disciplineEntry.disciplineName,
        totalContribution: disciplineEntry.totalContribution,
        averageContribution: disciplineEntry.averageContribution,
        averageFinalScore: disciplineEntry.averageFinalScore,
      })),
      matchdayBreakdown,
      disciplineBreakdown,
      warnings: [],
    });
  }

  for (const [playerId, summary] of snapshotMap.entries()) {
    if (!summaryMap.has(playerId)) {
      summaryMap.set(playerId, summary);
    }
  }

  return summaryMap;
}

const playerSeasonPerformanceMapCache = new WeakMap<GameState, ReturnType<typeof buildPlayerSeasonPerformanceMap>>();

function getCachedPlayerSeasonPerformanceMap(gameState: GameState): ReturnType<typeof buildPlayerSeasonPerformanceMap> {
  const cached = playerSeasonPerformanceMapCache.get(gameState);
  if (cached) return cached;
  const map = buildPlayerSeasonPerformanceMap(gameState);
  playerSeasonPerformanceMapCache.set(gameState, map);
  return map;
}

export function isCurrentSeasonLivePerformanceSummary(
  gameState: GameState,
  summary: PlayerSeasonPerformanceSummary,
) {
  return summary.seasonId === gameState.season.id && summary.sourceLabel === "Aktuelle Matchday-Results";
}

export function buildPlayerSeasonPerformance(gameState: GameState, playerId: string) {
  return getCachedPlayerSeasonPerformanceMap(gameState).get(playerId) ?? null;
}
