import type {
  DisciplineCategory,
  DisciplineResultRecord,
  GameState,
  MatchdayResultRecord,
  PlayerDisciplinePerformanceRecord,
} from "@/lib/data/olyDataTypes";
import { distributeRankPointsToPlayers, resolveDisciplinePlayerCount } from "@/lib/resolve/rank-to-points";

type LedgerPointSource =
  | "rank_to_points_base_share"
  | "rank_to_points_final_score_fallback"
  | "rank_to_points_score_share_fallback"
  | "final_player_score"
  | "score_contribution"
  | "share_times_team_total"
  | "final_player_score_without_team_total"
  | "score_contribution_without_team_total";

export type SeasonPlayerPointLedgerEntry = {
  performanceId: string;
  matchdayResultId: string;
  matchdayId: string | null;
  seasonId: string;
  teamId: string;
  playerId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  basePoints: number;
  mutatorPpsBonus: number;
  points: number;
  pointSource: LedgerPointSource;
  baseValue: number;
  finalPlayerScore: number;
  rawScoreContribution: number;
  rankInTeam: number;
  rankInDiscipline: number;
  isTop10: boolean;
  isMvpCandidate: boolean;
  warnings: string[];
};

export type SeasonTeamPointsSummary = {
  teamId: string;
  totalPoints: number;
  mutatorPpsBonus: number;
  pointsByArea: Record<DisciplineCategory, number>;
  pointsByDiscipline: Record<string, number>;
  playerDerivedTotal: number;
  reconciliationStatus: "reconciled" | "reconciliation_failed" | "missing_player_points";
  warnings: string[];
};

export type SeasonPlayerPointsSummary = {
  playerId: string;
  totalPoints: number;
  appearances: number;
  pointsByArea: Record<DisciplineCategory, number>;
  pointsByDiscipline: Record<string, number>;
  pointsByTeamId: Record<string, number>;
  warnings: string[];
};

export type SeasonPointsLedger = {
  hasResultSource: boolean;
  pointEntries: SeasonPlayerPointLedgerEntry[];
  pointEntriesByPerformanceId: Map<string, SeasonPlayerPointLedgerEntry>;
  teamSummariesByTeamId: Map<string, SeasonTeamPointsSummary>;
  playerSummariesByPlayerId: Map<string, SeasonPlayerPointsSummary>;
  warnings: string[];
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWithinTolerance(left: number, right: number, tolerance = 0.2) {
  return Math.abs(left - right) <= tolerance;
}

function toDisciplineResultKey(result: Pick<DisciplineResultRecord, "matchdayResultId" | "teamId" | "disciplineId" | "disciplineSide">) {
  return `${result.matchdayResultId}::${result.teamId}::${result.disciplineId}::${result.disciplineSide}`;
}

function toPerformanceGroupKey(
  performance: Pick<PlayerDisciplinePerformanceRecord, "matchdayResultId" | "teamId" | "disciplineId" | "disciplineSide">,
) {
  return `${performance.matchdayResultId}::${performance.teamId}::${performance.disciplineId}::${performance.disciplineSide}`;
}

function choosePointSource(
  performances: PlayerDisciplinePerformanceRecord[],
  teamTotal: number | null,
) {
  const summedFinalPlayerScore = roundValue(
    performances.reduce((sum, performance) => sum + (isFiniteNumber(performance.finalPlayerScore) ? performance.finalPlayerScore : 0), 0),
    4,
  );
  const summedScoreContribution = roundValue(
    performances.reduce((sum, performance) => sum + (isFiniteNumber(performance.scoreContribution) ? performance.scoreContribution : 0), 0),
    4,
  );
  const scoreContributionLooksLikeShare =
    teamTotal != null &&
    performances.length > 0 &&
    performances.every(
      (performance) =>
        isFiniteNumber(performance.scoreContribution) &&
        performance.scoreContribution >= 0 &&
        performance.scoreContribution <= 1.0001,
    ) &&
    isWithinTolerance(summedScoreContribution, 1, 0.05);

  if (teamTotal != null && isWithinTolerance(summedFinalPlayerScore, teamTotal)) {
    return "final_player_score" as const;
  }

  if (teamTotal != null && isWithinTolerance(summedScoreContribution, teamTotal)) {
    return "score_contribution" as const;
  }

  if (scoreContributionLooksLikeShare) {
    return "share_times_team_total" as const;
  }

  if (
    teamTotal == null &&
    performances.some(
      (performance) =>
        isFiniteNumber(performance.scoreContribution) &&
        (performance.scoreContribution > 1.0001 || performance.scoreContribution < 0),
    )
  ) {
    return "score_contribution_without_team_total" as const;
  }

  if (teamTotal == null && summedScoreContribution > 1.05) {
    return "score_contribution_without_team_total" as const;
  }

  if (teamTotal == null && performances.some((performance) => isFiniteNumber(performance.finalPlayerScore))) {
    return "final_player_score_without_team_total" as const;
  }

  return "score_contribution_without_team_total" as const;
}

function derivePointsFromPerformance(
  performance: PlayerDisciplinePerformanceRecord,
  pointSource: LedgerPointSource,
  teamTotal: number | null,
) {
  switch (pointSource) {
    case "final_player_score":
    case "final_player_score_without_team_total":
      return roundValue(performance.finalPlayerScore, 4);
    case "score_contribution":
    case "score_contribution_without_team_total":
      return roundValue(performance.scoreContribution, 4);
    case "share_times_team_total":
      return roundValue((teamTotal ?? 0) * performance.scoreContribution, 4);
  }
}

function deriveRankPointsFromPerformances(
  gameState: GameState,
  matchdayId: string | null,
  performances: PlayerDisciplinePerformanceRecord[],
  teamResult: DisciplineResultRecord | null,
) {
  const reference = performances[0];
  if (!reference || !teamResult) {
    return null;
  }

  const playerCount = resolveDisciplinePlayerCount(gameState, {
    matchdayId,
    disciplineId: reference.disciplineId,
    disciplineSide: reference.disciplineSide,
  });
  const distributed = distributeRankPointsToPlayers({
    playerCount,
    rank: teamResult.rank,
    entries: performances,
  });

  if (distributed.teamPoints == null) {
    return null;
  }

  return distributed;
}

function buildSeasonResultLookup(
  gameState: GameState,
  seasonId: string,
) {
  const seasonMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.seasonId === seasonId && result.status === "preview_applied",
  );
  const matchdayResultById = new Map<string, MatchdayResultRecord>(
    seasonMatchdayResults.map((result) => [result.id, result] as const),
  );
  const seasonResultIds = new Set(matchdayResultById.keys());

  return {
    seasonMatchdayResults,
    matchdayResultById,
    seasonResultIds,
  };
}

export function buildSeasonPointsLedger(
  gameState: GameState,
  seasonId: string = gameState.season.id,
): SeasonPointsLedger {
  const { seasonMatchdayResults, matchdayResultById, seasonResultIds } = buildSeasonResultLookup(gameState, seasonId);
  const disciplineCategoryById = new Map(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );
  const disciplineIds = gameState.disciplines.map((discipline) => discipline.id);
  const warnings: string[] = [];

  const seasonDisciplineResults = (gameState.seasonState.disciplineResults ?? []).filter((result) =>
    seasonResultIds.has(result.matchdayResultId),
  );
  const seasonPlayerPerformances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((performance) =>
    seasonResultIds.has(performance.matchdayResultId),
  );

  const disciplineResultByKey = new Map(
    seasonDisciplineResults.map((result) => [toDisciplineResultKey(result), result] as const),
  );
  const groupedPerformances = new Map<string, PlayerDisciplinePerformanceRecord[]>();

  for (const performance of seasonPlayerPerformances) {
    const key = toPerformanceGroupKey(performance);
    const currentGroup = groupedPerformances.get(key) ?? [];
    currentGroup.push(performance);
    groupedPerformances.set(key, currentGroup);
  }

  const pointEntries: SeasonPlayerPointLedgerEntry[] = [];

  for (const performances of groupedPerformances.values()) {
    const reference = performances[0];
    if (!reference) {
      continue;
    }

    const teamResult = disciplineResultByKey.get(toPerformanceGroupKey(reference)) ?? null;
    const teamTotal = teamResult?.totalScore ?? null;
    const entryWarnings: string[] = [];
    const matchdayResult = matchdayResultById.get(reference.matchdayResultId) ?? null;
    const rankPointDistribution = deriveRankPointsFromPerformances(
      gameState,
      matchdayResult?.matchdayId ?? null,
      performances,
      teamResult,
    );
    const pointSource =
      (rankPointDistribution?.pointSource as LedgerPointSource | undefined) ??
      choosePointSource(performances, teamTotal);

    if (teamTotal == null) {
      entryWarnings.push("missing_team_discipline_total");
    }
    if (rankPointDistribution?.warnings.length) {
      entryWarnings.push(...rankPointDistribution.warnings);
    }

    const normalizedEntries = performances.map((performance) => {
      const derivedPoints =
        rankPointDistribution?.entries.find((entry) => entry.item === performance)?.points ??
        derivePointsFromPerformance(performance, pointSource, teamTotal);
      if (!isFiniteNumber(derivedPoints)) {
        throw new Error(
          `Could not derive season points for ${performance.id} (${performance.teamId}/${performance.disciplineId}/${performance.disciplineSide}).`,
        );
      }
      const mutatorPpsBonus = isFiniteNumber(performance.mutatorPpsBonus) ? performance.mutatorPpsBonus : 0;
      return {
        performanceId: performance.id,
        matchdayResultId: performance.matchdayResultId,
        matchdayId: matchdayResult?.matchdayId ?? null,
        seasonId,
        teamId: performance.teamId,
        playerId: performance.playerId,
        disciplineId: performance.disciplineId,
        disciplineSide: performance.disciplineSide,
        basePoints: derivedPoints,
        mutatorPpsBonus,
        points: roundValue(derivedPoints + mutatorPpsBonus, 4),
        pointSource,
        baseValue: performance.baseValue,
        finalPlayerScore: performance.finalPlayerScore,
        rawScoreContribution: performance.scoreContribution,
        rankInTeam: performance.rankInTeam,
        rankInDiscipline: performance.rankInDiscipline,
        isTop10: performance.isTop10,
        isMvpCandidate: performance.isMvpCandidate,
        warnings: [...entryWarnings],
      } satisfies SeasonPlayerPointLedgerEntry;
    });

    const reconciliationTarget = rankPointDistribution?.teamPoints ?? teamTotal;
    if (reconciliationTarget != null) {
      const derivedGroupTotal = roundValue(
        normalizedEntries.reduce((sum, entry) => sum + entry.basePoints, 0),
        4,
      );
      if (!isWithinTolerance(derivedGroupTotal, reconciliationTarget)) {
        const warning = `reconciliation_failed:${reference.teamId}:${reference.disciplineId}:${reference.disciplineSide}`;
        warnings.push(warning);
        for (const entry of normalizedEntries) {
          entry.warnings.push(warning);
        }
      }
    }

    pointEntries.push(...normalizedEntries);
  }

  const pointEntriesByPerformanceId = new Map(
    pointEntries.map((entry) => [entry.performanceId, entry] as const),
  );

  const teamSummariesByTeamId = new Map<string, SeasonTeamPointsSummary>();
  const expectedRankPointsByTeamId = new Map<string, number>();
  for (const team of gameState.teams) {
    teamSummariesByTeamId.set(team.teamId, {
      teamId: team.teamId,
      totalPoints: 0,
      mutatorPpsBonus: 0,
      pointsByArea: { power: 0, speed: 0, mental: 0, social: 0 },
      pointsByDiscipline: Object.fromEntries(disciplineIds.map((disciplineId) => [disciplineId, 0] as const)),
      playerDerivedTotal: 0,
      reconciliationStatus: "missing_player_points",
      warnings: [],
    });
  }

  for (const result of seasonDisciplineResults) {
    const summary = teamSummariesByTeamId.get(result.teamId);
    const performances = groupedPerformances.get(toDisciplineResultKey(result)) ?? [];
    if (!summary || performances.length > 0) {
      continue;
    }

    summary.totalPoints = roundValue(summary.totalPoints + result.totalScore, 4);
    summary.pointsByDiscipline[result.disciplineId] = roundValue(
      (summary.pointsByDiscipline[result.disciplineId] ?? 0) + result.totalScore,
      4,
    );
    const category = disciplineCategoryById.get(result.disciplineId);
    if (category) {
      summary.pointsByArea[category] = roundValue(summary.pointsByArea[category] + result.totalScore, 4);
    }
  }

  const playerSummariesByPlayerId = new Map<string, SeasonPlayerPointsSummary>();
  for (const entry of pointEntries) {
    const category = disciplineCategoryById.get(entry.disciplineId) ?? null;
    const playerSummary = playerSummariesByPlayerId.get(entry.playerId) ?? {
      playerId: entry.playerId,
      totalPoints: 0,
      appearances: 0,
      pointsByArea: { power: 0, speed: 0, mental: 0, social: 0 },
      pointsByDiscipline: Object.fromEntries(disciplineIds.map((disciplineId) => [disciplineId, 0] as const)),
      pointsByTeamId: {},
      warnings: [],
    };

    playerSummary.totalPoints = roundValue(playerSummary.totalPoints + entry.points, 1);
    playerSummary.appearances += 1;
    playerSummary.pointsByDiscipline[entry.disciplineId] = roundValue(
      (playerSummary.pointsByDiscipline[entry.disciplineId] ?? 0) + entry.points,
      1,
    );
    if (category) {
      playerSummary.pointsByArea[category] = roundValue(playerSummary.pointsByArea[category] + entry.points, 1);
    }
    playerSummary.pointsByTeamId[entry.teamId] = roundValue(
      (playerSummary.pointsByTeamId[entry.teamId] ?? 0) + entry.points,
      1,
    );
    playerSummary.warnings = Array.from(new Set([...playerSummary.warnings, ...entry.warnings]));
    playerSummariesByPlayerId.set(entry.playerId, playerSummary);

    const teamSummary = teamSummariesByTeamId.get(entry.teamId);
    if (teamSummary) {
      teamSummary.totalPoints = roundValue(teamSummary.totalPoints + entry.points, 4);
      teamSummary.pointsByDiscipline[entry.disciplineId] = roundValue(
        (teamSummary.pointsByDiscipline[entry.disciplineId] ?? 0) + entry.points,
        4,
      );
      if (category) {
        teamSummary.pointsByArea[category] = roundValue(teamSummary.pointsByArea[category] + entry.points, 4);
      }
      teamSummary.mutatorPpsBonus = roundValue(teamSummary.mutatorPpsBonus + entry.mutatorPpsBonus, 4);
      teamSummary.playerDerivedTotal = roundValue(teamSummary.playerDerivedTotal + entry.points, 4);
      teamSummary.warnings = Array.from(new Set([...teamSummary.warnings, ...entry.warnings]));
    }
  }

  for (const result of seasonDisciplineResults) {
    const rankPoints = deriveRankPointsFromPerformances(
      gameState,
      matchdayResultById.get(result.matchdayResultId)?.matchdayId ?? null,
      groupedPerformances.get(toDisciplineResultKey(result)) ?? [],
      result,
    )?.teamPoints;

    if (!isFiniteNumber(rankPoints)) {
      continue;
    }

    expectedRankPointsByTeamId.set(
      result.teamId,
      roundValue((expectedRankPointsByTeamId.get(result.teamId) ?? 0) + rankPoints, 4),
    );
  }

  for (const teamSummary of teamSummariesByTeamId.values()) {
    teamSummary.totalPoints = roundValue(teamSummary.totalPoints, 1);
    teamSummary.mutatorPpsBonus = roundValue(teamSummary.mutatorPpsBonus, 1);
    teamSummary.pointsByArea = {
      power: roundValue(teamSummary.pointsByArea.power, 1),
      speed: roundValue(teamSummary.pointsByArea.speed, 1),
      mental: roundValue(teamSummary.pointsByArea.mental, 1),
      social: roundValue(teamSummary.pointsByArea.social, 1),
    };
    teamSummary.pointsByDiscipline = Object.fromEntries(
      Object.entries(teamSummary.pointsByDiscipline).map(([disciplineId, value]) => [disciplineId, roundValue(value, 1)] as const),
    );

    const expectedRankPoints = expectedRankPointsByTeamId.get(teamSummary.teamId) ?? 0;

    const basePlayerDerivedTotal = roundValue(teamSummary.playerDerivedTotal - teamSummary.mutatorPpsBonus, 4);

    if (basePlayerDerivedTotal === 0 && expectedRankPoints === 0) {
      teamSummary.reconciliationStatus = "reconciled";
      continue;
    }

    if (basePlayerDerivedTotal === 0 && expectedRankPoints > 0) {
      teamSummary.reconciliationStatus = "missing_player_points";
      continue;
    }

    teamSummary.reconciliationStatus =
      expectedRankPoints === 0 || isWithinTolerance(basePlayerDerivedTotal, expectedRankPoints)
        ? "reconciled"
        : "reconciliation_failed";

    if (teamSummary.reconciliationStatus === "reconciliation_failed") {
      const warning = `team_reconciliation_failed:${teamSummary.teamId}`;
      teamSummary.warnings = Array.from(new Set([...teamSummary.warnings, warning]));
      warnings.push(warning);
    }
  }

  return {
    hasResultSource: seasonMatchdayResults.length > 0,
    pointEntries,
    pointEntriesByPerformanceId,
    teamSummariesByTeamId,
    playerSummariesByPlayerId,
    warnings: Array.from(new Set(warnings)),
  };
}
