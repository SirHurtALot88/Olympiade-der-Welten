import fs from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import rankToPointsJson from "@/references/sheets/rank-to-points.json";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GameState } from "@/lib/data/olyDataTypes";

const OUTPUT_DIR =
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

type RankToPointsRow = Record<string, string>;

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    }
  }

  return {
    saveId: args.get("saveId") ?? null,
    seasonId: args.get("seasonId") ?? null,
  };
}

function parseNumber(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function buildRankPointTables() {
  const rows = ((rankToPointsJson as { rows?: RankToPointsRow[] }).rows ?? [])
    .map((row) => {
      const playerCount = parseNumber(row.Spieleranzahl);
      if (playerCount == null) return null;
      const rankPointTable = Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => /^\d+\.$/.test(key.trim()))
          .map(([key, value]) => [key.replace(".", ""), parseNumber(value)])
          .filter((entry): entry is [string, number] => entry[1] != null),
      );
      const expectedTotalPointsDistributed = roundValue(
        Object.values(rankPointTable).reduce((sum, points) => sum + points, 0),
        1,
      );

      return {
        playerCount,
        rankPointTable,
        expectedTotalPointsDistributed,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return new Map(rows.map((row) => [row.playerCount, row] as const));
}

function resolveDisciplinePlayerCount(gameState: GameState, input: {
  matchdayId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
}) {
  const scheduleRow = (gameState.seasonState.disciplineSchedule ?? []).find((entry) => entry.matchdayId === input.matchdayId);
  const scheduled = input.disciplineSide === "d1" ? scheduleRow?.discipline1 : scheduleRow?.discipline2;
  if (scheduled?.disciplineId === input.disciplineId && typeof scheduled.playerCount === "number") {
    return scheduled.playerCount;
  }

  const discipline = gameState.disciplines.find((entry) => entry.id === input.disciplineId);
  return typeof discipline?.playerCount === "number" ? discipline.playerCount : null;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = (args.saveId ? persistence.getSaveById(args.saveId) : null) ?? persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) {
    throw new Error("No local save available for season points parity audit.");
  }

  const gameState = save.gameState;
  const seasonId = args.seasonId ?? gameState.season.id;
  const rankTables = buildRankPointTables();
  const expectedPointsByDiscipline = gameState.disciplines.map((discipline) => {
    const participantCount = discipline.playerCount ?? null;
    const table = participantCount == null ? null : rankTables.get(participantCount) ?? null;
    return {
      disciplineId: discipline.id,
      disciplineName: discipline.name,
      participantCount,
      rankPointTable: table?.rankPointTable ?? {},
      expectedTotalPointsDistributed: table?.expectedTotalPointsDistributed ?? null,
      warnings: table ? [] : [`rank_to_points_missing_for_participant_count:${participantCount ?? "unknown"}`],
    };
  });

  const matchdayResults = (gameState.seasonState.matchdayResults ?? []).filter((entry) => entry.seasonId === seasonId);
  const matchdayResultById = new Map(matchdayResults.map((entry) => [entry.id, entry] as const));
  const disciplinePointAudit = (gameState.seasonState.disciplineResults ?? [])
    .filter((entry) => matchdayResultById.has(entry.matchdayResultId))
    .map((entry) => {
      const matchdayResult = matchdayResultById.get(entry.matchdayResultId)!;
      const participantCount = resolveDisciplinePlayerCount(gameState, {
        matchdayId: matchdayResult.matchdayId,
        disciplineId: entry.disciplineId,
        disciplineSide: entry.disciplineSide,
      });
      const expectedTeamPoints =
        participantCount == null ? null : rankTables.get(participantCount)?.rankPointTable[String(entry.rank)] ?? null;
      return {
        matchdayId: matchdayResult.matchdayId,
        disciplineId: entry.disciplineId,
        disciplineSide: entry.disciplineSide,
        teamId: entry.teamId,
        rank: entry.rank,
        participantCount,
        expectedTeamPoints,
        warning:
          expectedTeamPoints == null
            ? `rank_to_points_missing:${participantCount ?? "unknown"}:${entry.rank}:${entry.disciplineId}`
            : null,
      };
    });

  const recomputedSeasonPointsByTeam = new Map<string, number>();
  for (const row of disciplinePointAudit) {
    if (typeof row.expectedTeamPoints !== "number") continue;
    recomputedSeasonPointsByTeam.set(row.teamId, roundValue((recomputedSeasonPointsByTeam.get(row.teamId) ?? 0) + row.expectedTeamPoints, 1));
  }

  const standingsComparison = gameState.teams
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.name,
      storedPoints: gameState.seasonState.standings?.[team.teamId]?.points ?? null,
      recomputedPointsFromStoredDisciplineResults: recomputedSeasonPointsByTeam.get(team.teamId) ?? null,
    }))
    .sort((left, right) => (right.recomputedPointsFromStoredDisciplineResults ?? -1) - (left.recomputedPointsFromStoredDisciplineResults ?? -1));

  const audit = {
    generatedAt: new Date().toISOString(),
    saveId: save.saveId,
    saveName: save.name,
    activeSeasonId: gameState.season.id,
    auditedSeasonId: seasonId,
    matchdayResultsCount: matchdayResults.length,
    disciplineResultsCount: disciplinePointAudit.length,
    expectedPointsByDiscipline,
    disciplinePointAudit,
    standingsComparison,
    findings: [
      "Retool/Sheet-Punkte kommen aus references/sheets/rank-to-points.*.",
      "D1 und D2 zaehlen separat: Team-Punkte pro Matchday sind Summe der beiden Diszi-Rangpunkte.",
      "Formkarten, Mutatoren und Captain beeinflussen Score/Rank; Team-Punkte werden anschliessend aus Rank + Teilnehmerzahl gelesen.",
      "Spieler-PPs sind eine Verteilung der Team-Diszipunkte und laufen getrennt von Standings-Team-Punkten.",
    ],
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "season-points-parity-audit.json");
  const mdPath = path.join(OUTPUT_DIR, "season-points-parity-audit.md");
  const csvPath = path.join(OUTPUT_DIR, "season-points-parity-audit.csv");

  await fs.writeFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await fs.writeFile(
    csvPath,
    [
      ["disciplineId", "disciplineName", "participantCount", "rank1Points", "expectedTotalPointsDistributed"]
        .map(csvEscape)
        .join(","),
      ...expectedPointsByDiscipline.map((entry) =>
        [
          entry.disciplineId,
          entry.disciplineName,
          entry.participantCount,
          entry.rankPointTable["1"] ?? null,
          entry.expectedTotalPointsDistributed,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n") + "\n",
    "utf8",
  );
  await fs.writeFile(
    mdPath,
    [
      "# Season Points Parity Audit",
      "",
      `- Save: ${save.name} (${save.saveId})`,
      `- Audited Season: ${seasonId}`,
      `- Matchday Results: ${matchdayResults.length}`,
      `- Discipline Results: ${disciplinePointAudit.length}`,
      "",
      "## Findings",
      ...audit.findings.map((entry) => `- ${entry}`),
      "",
      "## Rank-1 Punkte je Teilnehmerzahl",
      ...Array.from(rankTables.values()).map(
        (entry) =>
          `- ${entry.playerCount} Spieler: Platz 1 = ${entry.rankPointTable["1"]}, Summe Top 32 = ${entry.expectedTotalPointsDistributed}`,
      ),
      "",
      "## Top Recomputed Standings",
      ...standingsComparison.slice(0, 10).map(
        (entry, index) =>
          `${index + 1}. ${entry.teamName}: stored=${entry.storedPoints ?? "-"} recomputed=${entry.recomputedPointsFromStoredDisciplineResults ?? "-"}`,
      ),
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        jsonPath,
        csvPath,
        mdPath,
        saveId: save.saveId,
        seasonId,
        matchdayResultsCount: matchdayResults.length,
        disciplineResultsCount: disciplinePointAudit.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
