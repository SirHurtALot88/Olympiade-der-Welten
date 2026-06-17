import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import type { GameState, Player, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger, type SeasonPlayerPointsSummary, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";

export type PlayerRatingWarning =
  | "ovr_raw_source_missing"
  | "ovr_pool_no_spread"
  | "mvs_source_missing";

export type PlayerRatingSourceStatus = {
  rawOvr: "ready" | "missing_source";
  normalizedOvr: "ready" | "missing_source" | "pool_no_spread";
  ppsSeason: "ready" | "missing_source";
  mvs: "ready" | "missing_source";
};

export type PlayerRatingContractRow = {
  playerId: string;
  rawOvrScore: number | null;
  ovrNormalized: number | null;
  ovrRank: number | null;
  ppsSeason: number | null;
  ppsSeasonRank: number | null;
  ppPow: number | null;
  ppPowRank: number | null;
  ppSpe: number | null;
  ppSpeRank: number | null;
  ppMen: number | null;
  ppMenRank: number | null;
  ppSoc: number | null;
  ppSocRank: number | null;
  ratingPps: number | null;
  mvs: number | null;
  mvsRank: number | null;
  marketValue: number | null;
  sourceStatus: PlayerRatingSourceStatus;
  warnings: PlayerRatingWarning[];
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapRankToMvsPoints(rank: number) {
  return playerFormulaSources.rankToDisciplineMarketValue?.find((entry) => entry.rank === rank)?.disciplineMarketValue ?? null;
}

const playerFormulaSources = loadPlayerFormulaSources();
const MARKET_VALUE_BRACKET_STARTS = [0, 12.5, 17.5, 22.5, 30, 37.5, 45, 55, 70];

export function getPlayerRawOvrScore(player: Pick<Player, "rating">) {
  return isFiniteNumber(player.rating) ? player.rating : null;
}

function getCoreStatAverage(player: Pick<Player, "coreStats">) {
  const values = [
    player.coreStats?.pow,
    player.coreStats?.spe,
    player.coreStats?.men,
    player.coreStats?.soc,
  ].filter((value): value is number => isFiniteNumber(value));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getThresholdScore(player: Pick<Player, "coreStats">) {
  const values = [
    player.coreStats?.pow,
    player.coreStats?.spe,
    player.coreStats?.men,
    player.coreStats?.soc,
  ].filter((value): value is number => isFiniteNumber(value));

  if (values.length === 0) {
    return null;
  }

  const above60 = values.filter((value) => value > 60).length;
  const above80 = values.filter((value) => value > 80).length;
  return above60 + above80 * 2;
}

function getMarketValueBracketId(marketValue: number | null) {
  if (marketValue == null || !Number.isFinite(marketValue)) {
    return 1;
  }

  for (let index = MARKET_VALUE_BRACKET_STARTS.length - 1; index >= 0; index -= 1) {
    if (marketValue >= MARKET_VALUE_BRACKET_STARTS[index]) {
      return index + 1;
    }
  }

  return 1;
}

export function getPlayerImportedRatingPps(player: Pick<Player, "disciplineRatings">) {
  const ratings = Object.values(player.disciplineRatings ?? {}).filter((value): value is number => isFiniteNumber(value));
  if (ratings.length === 0) {
    return null;
  }

  return roundValue(ratings.reduce((sum, value) => sum + value, 0) / ratings.length, 2);
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

    const nextRank = index + 1;
    previousValue = entry.value;
    previousRank = nextRank;
    rankMap.set(entry.playerId, nextRank);
  });

  return rankMap;
}

function buildSourceStatus(input: {
  rawOvrScore: number | null;
  normalizedOvr: number | null;
  ppsSeason: number | null;
  mvs: number | null;
  poolHasSpread: boolean;
}): PlayerRatingSourceStatus {
  const rawOvr = input.rawOvrScore == null ? "missing_source" : "ready";
  const normalizedOvr =
    input.rawOvrScore == null
      ? "missing_source"
      : input.normalizedOvr != null || input.poolHasSpread
        ? "ready"
        : "pool_no_spread";

  return {
    rawOvr,
    normalizedOvr,
    ppsSeason: input.ppsSeason == null ? "missing_source" : "ready",
    mvs: input.mvs == null ? "missing_source" : "ready",
  };
}

function buildWarnings(input: {
  rawOvrScore: number | null;
  normalizedOvr: number | null;
  mvs: number | null;
  poolHasSpread: boolean;
}): PlayerRatingWarning[] {
  const warnings: PlayerRatingWarning[] = [];
  if (input.mvs == null) {
    warnings.push("mvs_source_missing");
  }
  if (input.rawOvrScore == null) {
    warnings.push("ovr_raw_source_missing");
  } else if (input.normalizedOvr == null) {
    warnings.push("ovr_pool_no_spread");
  }
  return warnings;
}

function buildPointsByArea(summary: SeasonPlayerPointsSummary | null | undefined) {
  if (!summary) {
    return {
      ppPow: null,
      ppSpe: null,
      ppMen: null,
      ppSoc: null,
    };
  }

  return {
    ppPow: roundValue(summary.pointsByArea.power ?? 0, 1),
    ppSpe: roundValue(summary.pointsByArea.speed ?? 0, 1),
    ppMen: roundValue(summary.pointsByArea.mental ?? 0, 1),
    ppSoc: roundValue(summary.pointsByArea.social ?? 0, 1),
  };
}

export function buildPlayerRatingContractRows(input: {
  players: Player[];
  seasonPointsLedger?: SeasonPointsLedger | null;
  mvsPerformances?: PlayerDisciplinePerformanceRecord[] | null;
  normalizationPoolPlayerIds?: string[] | null;
  rankPoolPlayerIds?: string[] | null;
}) {
  const players = input.players;
  const seasonPointsLedger = input.seasonPointsLedger ?? null;
  const normalizationPoolPlayerIds = input.normalizationPoolPlayerIds ?? null;
  const normalizationPoolIdSet =
    normalizationPoolPlayerIds != null ? new Set(normalizationPoolPlayerIds.filter(Boolean)) : null;
  const rankPoolPlayerIds = input.rankPoolPlayerIds ?? null;
  const rankPoolIdSet = rankPoolPlayerIds != null ? new Set(rankPoolPlayerIds.filter(Boolean)) : null;

  const rawRows = players.map((player) => ({
    player,
    importedRawOvrScore: getPlayerRawOvrScore(player),
    skills: getCoreStatAverage(player),
    threshold: getThresholdScore(player),
    ratingPps: getPlayerImportedRatingPps(player),
    seasonPointsSummary: seasonPointsLedger?.playerSummariesByPlayerId.get(player.id) ?? null,
    marketValue: getImportedPlayerDisplayMarketValue(player),
  }));

  const performanceRows =
    input.mvsPerformances != null
      ? input.mvsPerformances.filter(
          (entry) =>
            entry.playerId != null &&
            typeof entry.rankInDiscipline === "number" &&
            Number.isFinite(entry.rankInDiscipline) &&
            entry.rankInDiscipline > 0,
        )
      : null;
  const mvsByPlayerId =
    performanceRows != null && playerFormulaSources.rankToDisciplineMarketValue?.length
      ? performanceRows.reduce((map, entry) => {
          const points = mapRankToMvsPoints(entry.rankInDiscipline);
          if (points == null) {
            return map;
          }
          map.set(entry.playerId, roundValue((map.get(entry.playerId) ?? 0) + points, 2));
          return map;
        }, new Map<string, number>())
      : new Map<string, number>();

  const sourceRows = rawRows.map((row) => {
    const seasonPoints = row.seasonPointsSummary?.totalPoints ?? null;
    const mvs =
      performanceRows == null
        ? null
        : roundValue(mvsByPlayerId.get(row.player.id) ?? 0, 2);

    return {
      ...row,
      seasonPoints,
      mvs,
      bracketId: getMarketValueBracketId(row.marketValue),
    };
  });

  const ovrCalculationRows = sourceRows.filter((row) => normalizationPoolIdSet == null || normalizationPoolIdSet.has(row.player.id));
  const maxPPs = Math.max(1, ...ovrCalculationRows.map((row) => row.seasonPoints ?? 0));
  const maxMVS = Math.max(1, ...ovrCalculationRows.map((row) => row.mvs ?? 0));
  const maxSkills = Math.max(1, ...ovrCalculationRows.map((row) => row.skills ?? 0));
  const maxThreshold = Math.max(1, ...ovrCalculationRows.map((row) => row.threshold ?? 0));

  const bracketScoreByPlayerId = new Map<string, number>();
  const rowsByBracket = new Map<number, typeof sourceRows>();
  for (const row of ovrCalculationRows) {
    const currentRows = rowsByBracket.get(row.bracketId) ?? [];
    currentRows.push(row);
    rowsByBracket.set(row.bracketId, currentRows);
  }
  for (const rowsInBracket of rowsByBracket.values()) {
    const sorted = rowsInBracket
      .filter((row) => (row.mvs ?? 0) > 0)
      .sort((left, right) => {
        const mvsDelta = (right.mvs ?? 0) - (left.mvs ?? 0);
        if (mvsDelta !== 0) {
          return mvsDelta;
        }
        const ppsDelta = (right.seasonPoints ?? 0) - (left.seasonPoints ?? 0);
        if (ppsDelta !== 0) {
          return ppsDelta;
        }
        return left.player.name.localeCompare(right.player.name, "de");
      });
    const count = sorted.length;
    if (count <= 1) {
      for (const row of sorted) {
        bracketScoreByPlayerId.set(row.player.id, 1);
      }
      continue;
    }
    sorted.forEach((row, index) => {
      bracketScoreByPlayerId.set(row.player.id, 1 - index / (count - 1));
    });
  }

  const ovrRawByPlayerId = new Map<string, number | null>();
  for (const row of sourceRows) {
    if (row.skills == null || row.threshold == null) {
      ovrRawByPlayerId.set(row.player.id, null);
      continue;
    }

    const skillsComp = (row.skills / maxSkills) * 15;
    const thresholdComp = (row.threshold / maxThreshold) * 5;
    const ppsComp = ((row.seasonPoints ?? 0) / maxPPs) * 25;
    const mvsComp = ((row.mvs ?? 0) / maxMVS) * 20;
    const bracketPerfComp = (bracketScoreByPlayerId.get(row.player.id) ?? 0) * 20;
    ovrRawByPlayerId.set(row.player.id, skillsComp + thresholdComp + ppsComp + mvsComp + bracketPerfComp);
  }

  const rawOvrValues = ovrCalculationRows
    .map((row) => ovrRawByPlayerId.get(row.player.id) ?? null)
    .filter((value): value is number => value != null);
  const minRawOvrScore = rawOvrValues.length > 0 ? Math.min(...rawOvrValues) : null;
  const maxRawOvrScore = rawOvrValues.length > 0 ? Math.max(...rawOvrValues) : null;
  const poolHasSpread =
    minRawOvrScore != null && maxRawOvrScore != null && maxRawOvrScore > minRawOvrScore;

  const normalizedRows = sourceRows.map((row) => {
    const rawOvrScore = ovrRawByPlayerId.get(row.player.id) ?? null;
    const normalizationSpread =
      minRawOvrScore == null || maxRawOvrScore == null
        ? null
        : maxRawOvrScore === minRawOvrScore
          ? 1
          : maxRawOvrScore - minRawOvrScore;
    const ovrNormalized =
      rawOvrScore == null || minRawOvrScore == null || normalizationSpread == null
        ? null
        : roundValue(
            Math.min(
              100,
              Math.max(0, Math.sqrt(Math.max(0, Math.min(1, (rawOvrScore - minRawOvrScore) / normalizationSpread))) * 100),
            ),
            2,
          );
    const areaPoints = buildPointsByArea(row.seasonPointsSummary);

    const result = {
      playerId: row.player.id,
      rawOvrScore,
      ovrNormalized,
      ovrRank: null,
      ppsSeason: row.seasonPoints == null ? null : roundValue(row.seasonPoints, 1),
      ppsSeasonRank: null,
      ppPow: areaPoints.ppPow,
      ppPowRank: null,
      ppSpe: areaPoints.ppSpe,
      ppSpeRank: null,
      ppMen: areaPoints.ppMen,
      ppMenRank: null,
      ppSoc: areaPoints.ppSoc,
      ppSocRank: null,
      ratingPps: row.ratingPps,
      mvs: row.mvs,
      mvsRank: null,
      marketValue: row.marketValue,
      sourceStatus: buildSourceStatus({
        rawOvrScore,
        normalizedOvr: ovrNormalized,
        ppsSeason: row.seasonPoints,
        mvs: row.mvs,
        poolHasSpread,
      }),
      warnings: buildWarnings({
        rawOvrScore,
        normalizedOvr: ovrNormalized,
        mvs: row.mvs,
        poolHasSpread,
      }),
    } satisfies PlayerRatingContractRow;

    return result;
  });

  const rankRows = rankPoolIdSet ? normalizedRows.filter((row) => rankPoolIdSet.has(row.playerId)) : normalizedRows;

  const ovrRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.ovrNormalized,
    })),
  );
  const mvsRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.mvs,
    })),
  );
  const ppsSeasonRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.ppsSeason,
    })),
  );
  const ppPowRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.ppPow,
    })),
  );
  const ppSpeRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.ppSpe,
    })),
  );
  const ppMenRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.ppMen,
    })),
  );
  const ppSocRankMap = buildSharedRankMap(
    rankRows.map((row) => ({
      playerId: row.playerId,
      value: row.ppSoc,
    })),
  );

  return normalizedRows.map((row) => ({
    ...row,
    ovrRank: ovrRankMap.get(row.playerId) ?? null,
    ppsSeasonRank: ppsSeasonRankMap.get(row.playerId) ?? null,
    ppPowRank: ppPowRankMap.get(row.playerId) ?? null,
    ppSpeRank: ppSpeRankMap.get(row.playerId) ?? null,
    ppMenRank: ppMenRankMap.get(row.playerId) ?? null,
    ppSocRank: ppSocRankMap.get(row.playerId) ?? null,
    mvsRank: mvsRankMap.get(row.playerId) ?? null,
  }));
}

export function buildPlayerRatingContractMap(gameState: GameState) {
  const seasonPointsLedger = buildSeasonPointsLedger(gameState);
  const activePlayerIds = Array.from(new Set((gameState.rosters ?? []).map((entry) => entry.playerId).filter(Boolean)));
  return new Map(
    buildPlayerRatingContractRows({
      players: gameState.players,
      seasonPointsLedger,
      mvsPerformances: gameState.seasonState.playerDisciplinePerformances ?? [],
      normalizationPoolPlayerIds: activePlayerIds,
      rankPoolPlayerIds: activePlayerIds,
    }).map((row) => [row.playerId, row] as const),
  );
}
