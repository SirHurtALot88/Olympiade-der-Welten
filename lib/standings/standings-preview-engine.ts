import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  inspectRankToPointsSheet,
  inspectSeasonStandingsSheet,
  mapSeasonStandingsRowsToTeams,
} from "@/lib/standings/season-standings-sheet";
import {
  DEFAULT_STANDINGS_TIEBREAKER_MODE,
  detectStandingTieGroups,
  resolveMatchdayRankWithTiePolicy,
  resolveProjectedRankWithTiePolicy,
} from "@/lib/standings/standings-tiebreaker-policy";
import type { RankToPointsSheetRow, SeasonStandingsSheetRow } from "@/lib/standings/season-standings-sheet";
import { db } from "@/src/server/db";

export type StandingsPreviewSource = "sqlite" | "prisma";
export type StandingsPreviewResultStatus =
  | "ready"
  | "missing_result"
  | "incomplete_result"
  | "tie_warning";

export type StandingsPreviewInput = {
  saveId?: string | null;
  seasonId?: string | null;
  matchdayId?: string | null;
  source?: StandingsPreviewSource;
};

export type StandingsPreviewItem = {
  teamId: string;
  teamName: string;
  currentRank: number | null;
  projectedRank: number | null;
  currentPoints: number | null;
  projectedPoints: number | null;
  pointsDelta: number | null;
  matchdayRank: number | null;
  d1Score: number | null;
  d2Score: number | null;
  matchdayScore: number | null;
  totalScore: number | null;
  cash: number | null;
  readinessStatus: string;
  resultStatus: StandingsPreviewResultStatus;
  warnings: string[];
  blockedRules: string[];
};

export type StandingsPreviewTieGroup = {
  type: "totalScore" | "projectedPoints";
  value: number;
  affectedTeams: Array<{
    teamId: string;
    teamName: string;
    totalScore: number | null;
    projectedPoints: number | null;
    currentRank: number | null;
    currentPoints: number | null;
    matchdayRank: number | null;
    cash: number | null;
  }>;
  requiresConfirmedTieBreaker: boolean;
};

export type StandingsPreviewResult = {
  items: StandingsPreviewItem[];
  summary: {
    totalTeams: number;
    matchdayResultFound: boolean;
    readyTeams: number;
    blockedTeamCount: number;
  };
  blockedRules: string[];
  tieGroups: StandingsPreviewTieGroup[];
  source: {
    mode: StandingsPreviewSource;
    matchdayResult: "local_saved_result" | "prisma_matchday_result" | "missing";
    currentPoints: "local_save_standings" | "sheet_mapping_ready" | "sheet_mapping_missing";
    standingsRules: "global_total_score_preview";
    fixtureCoverage: "not_required_local_results" | "missing_before_after_snapshots" | "before_after_snapshots_ready";
  };
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
};

type StandingsPreviewWorkingItem = StandingsPreviewItem & {
  rankToPointsKey: number;
  hasStoredResult: boolean;
  isIncomplete: boolean;
};

type LocalResolvedScope = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  save: NonNullable<ReturnType<PersistenceService["getSaveById"]>>;
};

type PrismaResolvedScope = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

type DatabaseLike = {
  save: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  season: {
    findFirst(args: unknown): Promise<{ id: string; saveId: string } | null>;
  };
  teamSeasonState: {
    findMany(args: unknown): Promise<Array<{
      teamId: string;
      cash: number;
      playerMin: number;
      playerOpt: number;
      team: { id: string; name: string; shortCode: string };
    }>>;
  };
  matchdayResult: {
    findFirst(args: unknown): Promise<{
      id: string;
      matchdayId: string;
      disciplineResults: Array<{
        teamId: string;
        disciplineSide: "d1" | "d2";
        totalScore: number;
        rank: number;
        readinessStatus: string;
        warnings: unknown;
      }>;
    } | null>;
  };
};

const DEFAULT_SCOPE = {
  saveId: "save-initial",
  seasonId: "season-1",
  matchdayId: "matchday-1",
} as const;

const LOCAL_RESULT_DISCIPLINE_SIDE_COUNT = 2;

type DisciplinePointsLookup = {
  points: number | null;
  playerCount: number | null;
  warnings: string[];
};

function toWarningsArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function hasStandingsBeforeAfterFixtures() {
  const standingsDir = path.join(
    "/Users/chrisfalk/Documents/Codex/Olympiade der Welten",
    "references",
    "golden-master-fixtures",
    "standings",
  );

  const beforePath = path.join(standingsDir, "matchday-1-standings-before.json");
  const afterPath = path.join(standingsDir, "matchday-1-standings-after.json");
  if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
    return false;
  }

  const beforeText = fs.readFileSync(beforePath, "utf8");
  const afterText = fs.readFileSync(afterPath, "utf8");
  return !beforeText.includes("TODO_RETOOL_EXPORT_REQUIRED") && !afterText.includes("TODO_RETOOL_EXPORT_REQUIRED");
}

function isSeasonStandingsSheetRow(row: SeasonStandingsSheetRow | Record<string, unknown>): row is SeasonStandingsSheetRow {
  return "resolvedTeamId" in row && "points" in row && "rank" in row;
}

function isRankToPointsSheetRow(row: RankToPointsSheetRow | Record<string, unknown>): row is RankToPointsSheetRow {
  return "playerCount" in row && "pointsByRank" in row;
}

function buildRankToPointsMap(rows: RankToPointsSheetRow[]) {
  const warnings: string[] = [];
  const byPlayerCount = new Map<number, Map<number, number>>();

  for (const row of rows) {
    if (row.playerCount == null) {
      warnings.push("rank_to_points_row_missing_player_count");
      continue;
    }

    const rankMap = new Map<number, number>();
    for (const [rankLabel, points] of Object.entries(row.pointsByRank)) {
      const rank = Number(rankLabel.replace(".", ""));
      if (!Number.isFinite(rank)) {
        warnings.push(`rank_to_points_invalid_rank:${rankLabel}`);
        continue;
      }
      if (points == null || !Number.isFinite(points)) {
        warnings.push(`rank_to_points_invalid_points:${row.playerCount}:${rankLabel}`);
        continue;
      }
      rankMap.set(rank, points);
    }
    byPlayerCount.set(row.playerCount, rankMap);
  }

  return {
    byPlayerCount,
    warnings: Array.from(new Set(warnings)),
  };
}

function normalizeSource(source?: string): StandingsPreviewSource {
  return source === "prisma" ? "prisma" : "sqlite";
}

function buildCurrentRankMap<T extends { teamId: string; teamName: string; currentPoints: number | null }>(items: T[]) {
  const sorted = [...items]
    .filter((item) => item.currentPoints != null)
    .sort((left, right) => {
      if ((right.currentPoints ?? Number.NEGATIVE_INFINITY) !== (left.currentPoints ?? Number.NEGATIVE_INFINITY)) {
        return (right.currentPoints ?? Number.NEGATIVE_INFINITY) - (left.currentPoints ?? Number.NEGATIVE_INFINITY);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

  return new Map(sorted.map((item, index) => [item.teamId, index + 1] as const));
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function resolveLocalDisciplinePlayerCount(
  gameState: LocalResolvedScope["save"]["gameState"],
  input: {
    matchdayId: string;
    disciplineId: string;
    disciplineSide: "d1" | "d2";
  },
) {
  const scheduleRow = (gameState.seasonState.disciplineSchedule ?? []).find((entry) => entry.matchdayId === input.matchdayId);
  const scheduledDiscipline = input.disciplineSide === "d1" ? scheduleRow?.discipline1 : scheduleRow?.discipline2;
  if (
    scheduledDiscipline?.disciplineId === input.disciplineId &&
    typeof scheduledDiscipline.playerCount === "number" &&
    Number.isFinite(scheduledDiscipline.playerCount)
  ) {
    return scheduledDiscipline.playerCount;
  }

  const discipline = gameState.disciplines.find((entry) => entry.id === input.disciplineId);
  if (typeof discipline?.playerCount === "number" && Number.isFinite(discipline.playerCount)) {
    return discipline.playerCount;
  }

  return LOCAL_RESULT_DISCIPLINE_SIDE_COUNT;
}

function resolveDisciplinePoints(input: {
  pointsMap: Map<number, Map<number, number>> | null | undefined;
  playerCount: number | null;
  rank: number | null;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
}): DisciplinePointsLookup {
  const warnings: string[] = [];
  if (input.playerCount == null || input.rank == null) {
    warnings.push(`rank_to_points_missing:${input.disciplineId}:${input.disciplineSide}`);
    return { points: null, playerCount: input.playerCount, warnings };
  }

  const points = input.pointsMap?.get(input.playerCount)?.get(input.rank) ?? null;
  if (points == null) {
    warnings.push(`rank_to_points_missing:${input.playerCount}:${input.rank}:${input.disciplineId}:${input.disciplineSide}`);
  }

  return {
    points,
    playerCount: input.playerCount,
    warnings,
  };
}

function buildResultStatus(input: {
  hasMatchdayResult: boolean;
  hasStoredResult: boolean;
  isIncomplete: boolean;
  tiedTeamIds: Set<string>;
  teamId: string;
}): StandingsPreviewResultStatus {
  if (!input.hasMatchdayResult) {
    return "missing_result";
  }
  if (input.isIncomplete) {
    return "incomplete_result";
  }
  if (!input.hasStoredResult) {
    return "missing_result";
  }
  if (input.tiedTeamIds.has(input.teamId)) {
    return "tie_warning";
  }
  return "ready";
}

function resolveLocalScope(
  persistence: PersistenceService,
  input: StandingsPreviewInput,
): LocalResolvedScope {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (input.saveId ? persistence.getSaveById(input.saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for standings preview.");
  }

  return {
    saveId: save.saveId,
    seasonId: input.seasonId?.trim() || save.gameState.season.id,
    matchdayId: input.matchdayId?.trim() || save.gameState.matchdayState.matchdayId,
    save,
  };
}

async function resolvePrismaScope(database: DatabaseLike, input: StandingsPreviewInput): Promise<PrismaResolvedScope> {
  const save =
    (input.saveId ? await database.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await database.save.findUnique({ where: { id: DEFAULT_SCOPE.saveId } })) ??
    (await database.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await database.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No save available for standings preview.");
  }

  const season =
    (input.seasonId ? await database.season.findFirst({ where: { id: input.seasonId, saveId: save.id } }) : null) ??
    (await database.season.findFirst({ where: { id: DEFAULT_SCOPE.seasonId, saveId: save.id } })) ??
    (await database.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));

  if (!season) {
    throw new Error(`No season available for save ${save.id}.`);
  }

  return {
    saveId: save.id,
    seasonId: season.id,
    matchdayId: input.matchdayId?.trim() || DEFAULT_SCOPE.matchdayId,
  };
}

export async function buildStandingsPreview(
  input: StandingsPreviewInput = {},
  database: DatabaseLike = db as unknown as DatabaseLike,
  persistence: PersistenceService = createPersistenceService(),
): Promise<StandingsPreviewResult> {
  const source = normalizeSource(input.source);
  const rankToPointsAudit = await inspectRankToPointsSheet();
  const rankToPointsParsed =
    rankToPointsAudit.status === "ok"
      ? buildRankToPointsMap(rankToPointsAudit.mappedRows.filter(isRankToPointsSheetRow))
      : null;
  const rankToPointsReady =
    rankToPointsParsed != null &&
    rankToPointsParsed.byPlayerCount.size > 0 &&
    rankToPointsParsed.warnings.length === 0;
  const baseBlockedRules = [
    ...(rankToPointsReady ? [] : (["points_table_missing", "rank_to_points_mapping_missing"] as const)),
  ];

  if (source === "sqlite") {
    const scope = resolveLocalScope(persistence, input);
    const seasonState = scope.save.gameState.seasonState;
    const standings = seasonState.standings ?? {};
    const matchdayResult =
      (seasonState.matchdayResults ?? []).find(
        (result) =>
          result.saveId === scope.saveId &&
          result.seasonId === scope.seasonId &&
          result.matchdayId === scope.matchdayId,
      ) ?? null;
    const disciplineResults = matchdayResult
      ? (seasonState.disciplineResults ?? []).filter((result) => result.matchdayResultId === matchdayResult.id)
      : [];

    const disciplineByTeam = new Map<
      string,
      {
        d1Score: number | null;
        d2Score: number | null;
        d1Points: number | null;
        d2Points: number | null;
        readinessStatus: string;
        warnings: string[];
      }
    >();

    for (const row of disciplineResults) {
      const current = disciplineByTeam.get(row.teamId) ?? {
        d1Score: null,
        d2Score: null,
        d1Points: null,
        d2Points: null,
        readinessStatus: row.readinessStatus,
        warnings: [],
      };
      const playerCount = resolveLocalDisciplinePlayerCount(scope.save.gameState, {
        matchdayId: scope.matchdayId,
        disciplineId: row.disciplineId,
        disciplineSide: row.disciplineSide,
      });
      const disciplinePoints = resolveDisciplinePoints({
        pointsMap: rankToPointsParsed?.byPlayerCount,
        playerCount,
        rank: row.rank,
        disciplineId: row.disciplineId,
        disciplineSide: row.disciplineSide,
      });
      if (row.disciplineSide === "d1") {
        current.d1Score = row.totalScore;
        current.d1Points = disciplinePoints.points;
      }
      if (row.disciplineSide === "d2") {
        current.d2Score = row.totalScore;
        current.d2Points = disciplinePoints.points;
      }
      current.readinessStatus = row.readinessStatus;
      current.warnings.push(...row.warnings, ...disciplinePoints.warnings);
      disciplineByTeam.set(row.teamId, current);
    }

    const itemsBase: StandingsPreviewWorkingItem[] = scope.save.gameState.teams.map((team) => {
      const resultRow = disciplineByTeam.get(team.teamId) ?? null;
      const currentPointsRaw = standings[team.teamId]?.points;
      const currentPoints = typeof currentPointsRaw === "number" ? currentPointsRaw : null;
      const d1Score = resultRow?.d1Score ?? null;
      const d2Score = resultRow?.d2Score ?? null;
      const pointsDelta =
        resultRow?.d1Points == null && resultRow?.d2Points == null
          ? null
          : roundValue((resultRow?.d1Points ?? 0) + (resultRow?.d2Points ?? 0), 1);
      const hasStoredResult = d1Score != null && d2Score != null;
      const isIncomplete =
        matchdayResult != null &&
        (!hasStoredResult || resultRow?.readinessStatus !== "ready");
      const warnings = [
        ...(resultRow?.warnings ?? []),
        ...(matchdayResult == null ? ["missing_result_for_matchday"] : []),
        ...(resultRow == null ? ["missing_result_for_team"] : []),
        ...(isIncomplete ? ["incomplete_result"] : []),
        ...(rankToPointsParsed?.warnings ?? []),
      ];
      const matchdayScore = hasStoredResult ? (d1Score ?? 0) + (d2Score ?? 0) : null;

      return {
        teamId: team.teamId,
        teamName: team.name,
        currentRank: null,
        projectedRank: null,
        currentPoints,
        projectedPoints:
          currentPoints != null && pointsDelta != null ? roundValue(currentPoints + pointsDelta, 1) : null,
        pointsDelta,
        matchdayRank: null,
        d1Score,
        d2Score,
        matchdayScore,
        totalScore: matchdayScore,
        cash: team.cash,
        readinessStatus: resultRow?.readinessStatus ?? "missing_result",
        resultStatus: "missing_result",
        warnings: Array.from(new Set(warnings)),
        blockedRules: baseBlockedRules.slice(),
        rankToPointsKey: LOCAL_RESULT_DISCIPLINE_SIDE_COUNT,
        hasStoredResult,
        isIncomplete,
      };
    });

    const currentRankByTeamId = buildCurrentRankMap(itemsBase);
    const matchdayRankByTeamId = resolveMatchdayRankWithTiePolicy(
      itemsBase.map((item) => ({
        teamId: item.teamId,
        teamName: item.teamName,
        totalScore: item.totalScore,
        projectedPoints: null,
        currentRank: currentRankByTeamId.get(item.teamId) ?? null,
        currentPoints: item.currentPoints,
        matchdayRank: null,
        cash: item.cash,
      })),
      DEFAULT_STANDINGS_TIEBREAKER_MODE,
    );

    const withProjectedPoints = itemsBase.map((item) => {
      const matchdayRank = matchdayRankByTeamId.get(item.teamId) ?? null;
      return {
        ...item,
        currentRank: currentRankByTeamId.get(item.teamId) ?? null,
        matchdayRank,
      };
    });

    const projectedRankByTeamId = resolveProjectedRankWithTiePolicy(
      withProjectedPoints.map((item) => ({
        teamId: item.teamId,
        teamName: item.teamName,
        totalScore: item.totalScore,
        projectedPoints: item.projectedPoints,
        currentRank: item.currentRank,
        currentPoints: item.currentPoints,
        matchdayRank: item.matchdayRank,
        cash: item.cash,
      })),
      DEFAULT_STANDINGS_TIEBREAKER_MODE,
    );
    const tieGroups = detectStandingTieGroups(
      withProjectedPoints.map((item) => ({
        teamId: item.teamId,
        teamName: item.teamName,
        totalScore: item.totalScore,
        projectedPoints: item.projectedPoints,
        currentRank: item.currentRank,
        currentPoints: item.currentPoints,
        matchdayRank: item.matchdayRank,
        cash: item.cash,
      })),
    ) as StandingsPreviewTieGroup[];
    const tieTeamIds = new Set(tieGroups.flatMap((group) => group.affectedTeams.map((team) => team.teamId)));
    const blockedRules =
      tieGroups.length > 0 ? [...baseBlockedRules, "global_score_tie_breaker_missing"] : baseBlockedRules.slice();

    const items = withProjectedPoints.map<StandingsPreviewItem>((item) => ({
      teamId: item.teamId,
      teamName: item.teamName,
      currentRank: item.currentRank,
      projectedRank: projectedRankByTeamId.get(item.teamId) ?? null,
      currentPoints: item.currentPoints,
      projectedPoints: item.projectedPoints,
      pointsDelta: item.pointsDelta,
      matchdayRank: item.matchdayRank,
      d1Score: item.d1Score,
      d2Score: item.d2Score,
      matchdayScore: item.matchdayScore,
      totalScore: item.totalScore,
      cash: item.cash,
      readinessStatus: item.readinessStatus,
      resultStatus: buildResultStatus({
        hasMatchdayResult: matchdayResult != null,
        hasStoredResult: item.hasStoredResult,
        isIncomplete: item.isIncomplete,
        tiedTeamIds: tieTeamIds,
        teamId: item.teamId,
      }),
      warnings: Array.from(
        new Set([
          ...item.warnings,
          ...(tieTeamIds.has(item.teamId) ? ["tie_warning"] : []),
        ]),
      ),
      blockedRules,
    }));

    return {
      items,
      summary: {
        totalTeams: items.length,
        matchdayResultFound: Boolean(matchdayResult),
        readyTeams: items.filter((item) => item.resultStatus === "ready").length,
        blockedTeamCount: items.filter((item) => item.resultStatus !== "ready").length,
      },
      blockedRules,
      tieGroups,
      source: {
        mode: "sqlite",
        matchdayResult: matchdayResult ? "local_saved_result" : "missing",
        currentPoints: "local_save_standings",
        standingsRules: "global_total_score_preview",
        fixtureCoverage: "not_required_local_results",
      },
      scope: {
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
      },
    };
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Prisma standings preview requires a configured Prisma database.");
  }

  const scope = await resolvePrismaScope(database, input);
  const [teamStates, matchdayResult, standingsSheetAudit] = await Promise.all([
    database.teamSeasonState.findMany({
      where: {
        saveId: scope.saveId,
        seasonId: scope.seasonId,
      },
      select: {
        teamId: true,
        cash: true,
        playerMin: true,
        playerOpt: true,
        team: {
          select: {
            id: true,
            name: true,
            shortCode: true,
          },
        },
      },
      orderBy: [{ teamId: "asc" }],
    }),
    database.matchdayResult.findFirst({
      where: {
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
      },
      select: {
        id: true,
        matchdayId: true,
        disciplineResults: {
          select: {
            teamId: true,
            disciplineSide: true,
            totalScore: true,
            rank: true,
            readinessStatus: true,
            warnings: true,
          },
        },
      },
    }),
    inspectSeasonStandingsSheet(),
  ]);

  const mappedStandings =
    standingsSheetAudit.status === "ok"
      ? mapSeasonStandingsRowsToTeams(
          standingsSheetAudit.mappedRows.filter(isSeasonStandingsSheetRow),
          teamStates.map((teamState) => ({
            teamId: teamState.teamId,
            shortCode: teamState.team.shortCode,
            teamName: teamState.team.name,
          })),
        )
      : null;
  const seasonStandingsMappedReady =
    mappedStandings != null &&
    mappedStandings.mappedTeamsCount > 0 &&
    mappedStandings.duplicateSheetTeams.length === 0;
  const fixtureCoverageMissing = !hasStandingsBeforeAfterFixtures();
  const blockedRules = [
    ...baseBlockedRules,
    ...(seasonStandingsMappedReady ? [] : (["season_standings_sheet_mapping_missing"] as const)),
    ...(fixtureCoverageMissing ? (["standings_before_after_snapshots_missing"] as const) : []),
  ];

  const disciplineByTeam = new Map<
    string,
    {
      d1Score: number | null;
      d2Score: number | null;
      readinessStatus: string;
      warnings: string[];
    }
  >();
  for (const row of matchdayResult?.disciplineResults ?? []) {
    const current = disciplineByTeam.get(row.teamId) ?? {
      d1Score: null,
      d2Score: null,
      readinessStatus: row.readinessStatus,
      warnings: [],
    };
    if (row.disciplineSide === "d1") current.d1Score = row.totalScore;
    if (row.disciplineSide === "d2") current.d2Score = row.totalScore;
    current.readinessStatus = row.readinessStatus;
    current.warnings.push(...toWarningsArray(row.warnings));
    disciplineByTeam.set(row.teamId, current);
  }

  const sheetRowByTeamId = new Map(
    (mappedStandings?.rows ?? [])
      .filter((row) => row.resolvedTeamId)
      .map((row) => [row.resolvedTeamId!, row] as const),
  );

  const itemsBase: StandingsPreviewWorkingItem[] = teamStates.map((teamState) => {
    const resultRow = disciplineByTeam.get(teamState.teamId) ?? null;
    const sheetRow = sheetRowByTeamId.get(teamState.teamId) ?? null;
    const d1Score = resultRow?.d1Score ?? null;
    const d2Score = resultRow?.d2Score ?? null;
    const hasStoredResult = d1Score != null && d2Score != null;
    const matchdayScore = hasStoredResult ? (d1Score ?? 0) + (d2Score ?? 0) : null;
    const isIncomplete = matchdayResult != null && (!hasStoredResult || resultRow?.readinessStatus !== "ready");

    return {
      teamId: teamState.teamId,
      teamName: teamState.team.name,
      currentRank: sheetRow?.rank ?? null,
      projectedRank: null,
      currentPoints: sheetRow?.points ?? null,
      projectedPoints: null,
      pointsDelta: null,
      matchdayRank: null,
      d1Score,
      d2Score,
      matchdayScore,
      totalScore: matchdayScore,
      cash: sheetRow?.cash ?? teamState.cash ?? null,
      readinessStatus: resultRow?.readinessStatus ?? "missing_result",
      resultStatus: "missing_result",
      warnings: Array.from(
        new Set([
          ...(resultRow?.warnings ?? []),
          ...(sheetRow?.warnings ?? []),
          ...(mappedStandings?.mappingWarnings ?? []),
          ...(matchdayResult == null ? ["missing_result_for_matchday"] : []),
          ...(resultRow == null ? ["missing_result_for_team"] : []),
          ...(isIncomplete ? ["incomplete_result"] : []),
          ...(rankToPointsParsed?.warnings ?? []),
        ]),
      ),
      blockedRules: blockedRules.slice(),
      rankToPointsKey: LOCAL_RESULT_DISCIPLINE_SIDE_COUNT,
      hasStoredResult,
      isIncomplete,
    };
  });

  const matchdayRankByTeamId = resolveMatchdayRankWithTiePolicy(
    itemsBase.map((item) => ({
      teamId: item.teamId,
      teamName: item.teamName,
      totalScore: item.totalScore,
      projectedPoints: null,
      currentRank: item.currentRank,
      currentPoints: item.currentPoints,
      matchdayRank: null,
      cash: item.cash,
    })),
    DEFAULT_STANDINGS_TIEBREAKER_MODE,
  );

  const withProjectedPoints = itemsBase.map((item) => {
    const matchdayRank = matchdayRankByTeamId.get(item.teamId) ?? null;
    const pointsDelta =
      matchdayRank != null
        ? rankToPointsParsed?.byPlayerCount.get(item.rankToPointsKey)?.get(matchdayRank) ?? null
        : null;
    return {
      ...item,
      matchdayRank,
      pointsDelta,
      projectedPoints:
        item.currentPoints != null && pointsDelta != null ? item.currentPoints + pointsDelta : null,
    };
  });

  const projectedRankByTeamId = resolveProjectedRankWithTiePolicy(
    withProjectedPoints.map((item) => ({
      teamId: item.teamId,
      teamName: item.teamName,
      totalScore: item.totalScore,
      projectedPoints: item.projectedPoints,
      currentRank: item.currentRank,
      currentPoints: item.currentPoints,
      matchdayRank: item.matchdayRank,
      cash: item.cash,
    })),
    DEFAULT_STANDINGS_TIEBREAKER_MODE,
  );
  const tieGroups = detectStandingTieGroups(
    withProjectedPoints.map((item) => ({
      teamId: item.teamId,
      teamName: item.teamName,
      totalScore: item.totalScore,
      projectedPoints: item.projectedPoints,
      currentRank: item.currentRank,
      currentPoints: item.currentPoints,
      matchdayRank: item.matchdayRank,
      cash: item.cash,
    })),
  ) as StandingsPreviewTieGroup[];
  const tieTeamIds = new Set(tieGroups.flatMap((group) => group.affectedTeams.map((team) => team.teamId)));
  const effectiveBlockedRules =
    tieGroups.length > 0 ? [...blockedRules, "global_score_tie_breaker_missing"] : blockedRules;

  const items = withProjectedPoints.map<StandingsPreviewItem>((item) => ({
    teamId: item.teamId,
    teamName: item.teamName,
    currentRank: item.currentRank,
    projectedRank: projectedRankByTeamId.get(item.teamId) ?? null,
    currentPoints: item.currentPoints,
    projectedPoints: item.projectedPoints,
    pointsDelta: item.pointsDelta,
    matchdayRank: item.matchdayRank,
    d1Score: item.d1Score,
    d2Score: item.d2Score,
    matchdayScore: item.matchdayScore,
    totalScore: item.totalScore,
    cash: item.cash,
    readinessStatus: item.readinessStatus,
    resultStatus: buildResultStatus({
      hasMatchdayResult: matchdayResult != null,
      hasStoredResult: item.hasStoredResult,
      isIncomplete: item.isIncomplete,
      tiedTeamIds: tieTeamIds,
      teamId: item.teamId,
    }),
    warnings: Array.from(new Set([...item.warnings, ...(tieTeamIds.has(item.teamId) ? ["tie_warning"] : [])])),
    blockedRules: effectiveBlockedRules,
  }));

  return {
    items,
    summary: {
      totalTeams: items.length,
      matchdayResultFound: Boolean(matchdayResult),
      readyTeams: items.filter((item) => item.resultStatus === "ready").length,
      blockedTeamCount: items.filter((item) => item.resultStatus !== "ready").length,
    },
    blockedRules: effectiveBlockedRules,
    tieGroups,
    source: {
      mode: "prisma",
      matchdayResult: matchdayResult ? "prisma_matchday_result" : "missing",
      currentPoints: seasonStandingsMappedReady ? "sheet_mapping_ready" : "sheet_mapping_missing",
      standingsRules: "global_total_score_preview",
      fixtureCoverage: fixtureCoverageMissing ? "missing_before_after_snapshots" : "before_after_snapshots_ready",
    },
    scope,
  };
}
