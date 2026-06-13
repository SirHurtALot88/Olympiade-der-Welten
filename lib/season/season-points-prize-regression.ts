import fs from "node:fs";
import path from "node:path";

import rankToPointsJson from "@/references/sheets/rank-to-points.json";
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";

export const SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR =
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

type RankToPointsRow = Record<string, string>;

type CsvRecord = Record<string, string>;

export type SeasonPointsPrizeRegressionSummary = {
  generatedAt: string;
  saveId: string;
  seasonId: string;
  seasonCompleted: boolean;
  resolvedMatchdays: number;
  expectedMatchdays: number;
  standingsTeamCount: number;
  champion: {
    teamId: string;
    teamName: string;
    points: number;
  } | null;
  expectedTotalSeasonPoints: number;
  actualTotalSeasonPoints: number;
  recomputedTotalSeasonPoints: number;
  totalPointsDelta: number;
  topTeamPoints: number | null;
  bottomTeamPoints: number | null;
  teamsWithZeroPoints: string[];
  startRankMissingCount: number;
  rankChangePrizeMissingCount: number;
  totalPrizeMoney: number | null;
  totalRankChangeBonus: number | null;
  thresholds: {
    topTeamPointsMin: number;
    bottomTeamPointsMin: number;
    maxTotalPointsDelta: number;
    expectedBasePrizeTotal: number;
  };
  warnings: string[];
  exports: {
    markdown: string;
    json: string;
  };
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function readCsvRecords(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function toNumber(value: unknown) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function buildRankPointTables() {
  return new Map(
    ((rankToPointsJson as { rows?: RankToPointsRow[] }).rows ?? [])
      .map((row) => {
        const playerCount = toNumber(row.Spieleranzahl);
        if (playerCount == null) return null;
        const rankPointTable = Object.fromEntries(
          Object.entries(row)
            .filter(([key]) => /^\d+\.$/.test(key.trim()))
            .map(([key, value]) => [key.replace(".", ""), toNumber(value)])
            .filter((entry): entry is [string, number] => entry[1] != null),
        );
        return [
          playerCount,
          {
            playerCount,
            rankPointTable,
            expectedTotalPointsDistributed: roundValue(Object.values(rankPointTable).reduce((sum, points) => sum + points, 0)),
          },
        ] as const;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null),
  );
}

function buildStaticPersistence(save: PersistedSaveGame): PersistenceService {
  return {
    bootstrapSingleplayerSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (saveId === save.saveId ? save : null),
    saveSingleplayerState: () => save,
    createSave: () => save,
    createFreshSeasonOneSave: () => save,
    cloneSave: () => save,
    createScenarioSnapshot: () => save,
    activateSave: () => save,
    listSaves: () => [],
  };
}

function buildCompletedSeasonOneSave(input: {
  activeSave: PersistedSaveGame;
  standingsRows: CsvRecord[];
}) {
  const standings = Object.fromEntries(
    input.standingsRows.map((row) => [
      row.teamId,
      {
        points: toNumber(row.correctedPoints) ?? 0,
        rank: toNumber(row.correctedRank) ?? undefined,
      },
    ]),
  );
  const cashByTeamId = new Map(input.standingsRows.map((row) => [row.teamId, toNumber(row.cash)] as const));

  return {
    ...input.activeSave,
    saveId: `${input.activeSave.saveId}__season1_points_prize_regression`,
    name: `${input.activeSave.name} · S1 Points/Prize Regression`,
    gameState: {
      ...input.activeSave.gameState,
      gamePhase: "season_completed",
      season: {
        ...input.activeSave.gameState.season,
        id: "season-1",
        name: "Season 1",
        year: 1,
        currentMatchday: 10,
      },
      matchdayState: {
        ...input.activeSave.gameState.matchdayState,
        matchdayId: "matchday-10",
        status: "resolved",
      },
      teams: input.activeSave.gameState.teams.map((team) => ({
        ...team,
        cash: cashByTeamId.get(team.teamId) ?? team.cash,
      })),
      seasonState: {
        ...input.activeSave.gameState.seasonState,
        seasonId: "season-1",
        standings,
      },
    } satisfies GameState,
  } satisfies PersistedSaveGame;
}

function resolveParticipantCount(gameState: GameState, disciplineId: string) {
  return gameState.disciplines.find((discipline) => discipline.id === disciplineId)?.playerCount ?? null;
}

function buildMarkdown(summary: SeasonPointsPrizeRegressionSummary) {
  return [
    "# Season Points & Preisgeld Regression Smoke",
    "",
    `- Save: ${summary.saveId}`,
    `- Season: ${summary.seasonId}`,
    `- Season completed: ${summary.seasonCompleted ? "ja" : "nein"}`,
    `- Resolved Matchdays: ${summary.resolvedMatchdays}/${summary.expectedMatchdays}`,
    `- Champion: ${summary.champion ? `${summary.champion.teamName} (${summary.champion.points})` : "—"}`,
    `- Teams im Endstand: ${summary.standingsTeamCount}`,
    `- Expected Total Season Points: ${summary.expectedTotalSeasonPoints}`,
    `- Actual Total Season Points: ${summary.actualTotalSeasonPoints}`,
    `- Recomputed Total Season Points: ${summary.recomputedTotalSeasonPoints}`,
    `- Top Team Points: ${summary.topTeamPoints ?? "—"}`,
    `- Bottom Team Points: ${summary.bottomTeamPoints ?? "—"}`,
    `- Zero-Point Teams: ${summary.teamsWithZeroPoints.length}`,
    `- StartRank missing: ${summary.startRankMissingCount}`,
    `- RankChangePrize missing: ${summary.rankChangePrizeMissingCount}`,
    `- Total Prize Money: ${summary.totalPrizeMoney ?? "—"}`,
    `- Total RankChange Bonus: ${summary.totalRankChangeBonus ?? "—"}`,
    "",
    "## Schwellen",
    `- Topteam Punkte > ${summary.thresholds.topTeamPointsMin}`,
    `- Bottomteam Punkte > ${summary.thresholds.bottomTeamPointsMin}`,
    `- Gesamtpunkte Delta <= ${summary.thresholds.maxTotalPointsDelta}`,
    `- Basis-Preisgeld total = ${summary.thresholds.expectedBasePrizeTotal}`,
    "",
    "## Warnings",
    ...(summary.warnings.length > 0 ? summary.warnings.map((warning) => `- ${warning}`) : ["- keine"]),
  ].join("\n") + "\n";
}

export async function runSeasonPointsPrizeRegressionSmoke(input?: {
  outputDir?: string;
  persistence?: PersistenceService;
  write?: boolean;
}) {
  const outputDir = input?.outputDir ?? SEASON_POINTS_PRIZE_REGRESSION_OUTPUT_DIR;
  const persistence = input?.persistence ?? createPersistenceService();
  const activeSave = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const simulationSummary = readJson<{
    saveId: string;
    seasonId: string;
    matchdays: Array<{ resolvedTeams: number; disciplineRows: number; blockers?: string[] }>;
    final?: {
      gamePhase?: string;
      matchdayResultCount?: number;
      disciplineRows?: number;
      champion?: { teamId: string; teamName: string; points: number };
      cashPrizeApplyLogs?: number;
    };
  }>(path.join(outputDir, "season1-simulation-summary.json"));
  const standingsRows = readCsvRecords(path.join(outputDir, "season1-standings-final-points-parity.csv"));
  const matchdayRows = readCsvRecords(path.join(outputDir, "season1-matchday-results.csv"));
  const completedSave = buildCompletedSeasonOneSave({ activeSave, standingsRows });
  const staticPersistence = buildStaticPersistence(completedSave);
  const prizePreview = await buildPrizeMoneyPreview(
    {
      saveId: completedSave.saveId,
      seasonId: "season-1",
      source: "sqlite",
      phase: "season_end",
    },
    staticPersistence,
  );

  const rankTables = buildRankPointTables();
  const expectedByDisciplineSide = new Map<string, number>();
  let recomputedTotalSeasonPoints = 0;
  for (const row of matchdayRows) {
    const participantCount = resolveParticipantCount(completedSave.gameState, row.disciplineId);
    const points = participantCount == null ? null : rankTables.get(participantCount)?.rankPointTable[String(toNumber(row.rank) ?? "")] ?? null;
    if (points != null) {
      recomputedTotalSeasonPoints = roundValue(recomputedTotalSeasonPoints + points);
    }
    const groupKey = `${row.matchdayId}:${row.disciplineId}:${row.side}`;
    if (!expectedByDisciplineSide.has(groupKey) && participantCount != null) {
      const total = rankTables.get(participantCount)?.expectedTotalPointsDistributed ?? null;
      if (total != null) expectedByDisciplineSide.set(groupKey, total);
    }
  }

  const standings = standingsRows
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      rank: toNumber(row.correctedRank),
      points: toNumber(row.correctedPoints),
    }))
    .filter((row): row is { teamId: string; teamName: string; rank: number; points: number } => row.rank != null && row.points != null)
    .sort((left, right) => left.rank - right.rank);
  const actualTotalSeasonPoints = roundValue(standings.reduce((sum, row) => sum + row.points, 0));
  const expectedTotalSeasonPoints = roundValue(Array.from(expectedByDisciplineSide.values()).reduce((sum, points) => sum + points, 0));
  const totalPointsDelta = roundValue(Math.abs(actualTotalSeasonPoints - expectedTotalSeasonPoints));
  const startRankMissingCount = prizePreview.items.filter((item) => item.rankChangePrize.startRank == null).length;
  const rankChangePrizeMissingCount = prizePreview.items.filter((item) => item.rankChangePrize.bonusMalus == null).length;
  const totalRankChangeBonus =
    prizePreview.summary.totalRankChangePrize == null ? null : roundValue(prizePreview.summary.totalRankChangePrize);
  const warnings = [
    simulationSummary.seasonId !== "season-1" ? "simulation_summary_not_season_1" : null,
    simulationSummary.final?.gamePhase !== "season_completed" ? "season_not_completed" : null,
    simulationSummary.matchdays.length !== 10 ? "matchday_count_not_10" : null,
    simulationSummary.matchdays.some((matchday) => matchday.resolvedTeams !== 32) ? "not_all_matchdays_have_32_teams" : null,
    standings.length !== 32 ? "standings_team_count_not_32" : null,
    standings[0] == null ? "champion_missing" : null,
    standings.some((row) => row.points === 0) ? "zero_point_team_detected" : null,
    (standings[0]?.points ?? 0) <= 100 ? "top_team_points_not_above_100" : null,
    (standings.at(-1)?.points ?? 0) <= 20 ? "bottom_team_points_too_low" : null,
    totalPointsDelta > 0.2 ? `total_points_delta:${totalPointsDelta}` : null,
    Math.abs((prizePreview.summary.totalPrizeMoney ?? 0) - 1656.5) > 0.2 ? "base_prize_total_not_1656_5" : null,
    startRankMissingCount > 0 ? `start_rank_missing:${startRankMissingCount}` : null,
    rankChangePrizeMissingCount > 0 ? `rank_change_prize_missing:${rankChangePrizeMissingCount}` : null,
  ].filter((warning): warning is string => warning != null);

  const jsonPath = path.join(outputDir, "season-points-prize-regression.json");
  const markdownPath = path.join(outputDir, "season-points-prize-regression-summary.md");
  const summary: SeasonPointsPrizeRegressionSummary = {
    generatedAt: new Date().toISOString(),
    saveId: simulationSummary.saveId,
    seasonId: "season-1",
    seasonCompleted: simulationSummary.final?.gamePhase === "season_completed",
    resolvedMatchdays: simulationSummary.matchdays.filter((matchday) => matchday.resolvedTeams === 32).length,
    expectedMatchdays: 10,
    standingsTeamCount: standings.length,
    champion: standings[0] ? { teamId: standings[0].teamId, teamName: standings[0].teamName, points: standings[0].points } : null,
    expectedTotalSeasonPoints,
    actualTotalSeasonPoints,
    recomputedTotalSeasonPoints: roundValue(recomputedTotalSeasonPoints),
    totalPointsDelta,
    topTeamPoints: standings[0]?.points ?? null,
    bottomTeamPoints: standings.at(-1)?.points ?? null,
    teamsWithZeroPoints: standings.filter((row) => row.points === 0).map((row) => row.teamId),
    startRankMissingCount,
    rankChangePrizeMissingCount,
    totalPrizeMoney: prizePreview.summary.totalPrizeMoney,
    totalRankChangeBonus,
    thresholds: {
      topTeamPointsMin: 100,
      bottomTeamPointsMin: 20,
      maxTotalPointsDelta: 0.2,
      expectedBasePrizeTotal: 1656.5,
    },
    warnings,
    exports: {
      markdown: markdownPath,
      json: jsonPath,
    },
  };

  if (input?.write !== false) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownPath, buildMarkdown(summary), "utf8");
  }

  return summary;
}
