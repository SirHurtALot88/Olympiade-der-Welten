import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback?: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback ?? "") : fallback ?? "";
  };

  return {
    source: (getValue("--source", "sqlite") === "prisma" ? "prisma" : "sqlite") as "sqlite" | "prisma",
    saveId: getValue("--saveId"),
    seasonId: getValue("--seasonId"),
    matchdayId: getValue("--matchdayId"),
  };
}

function printReadinessSummary(input: {
  source: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  matchdayId: string;
  readiness: ReturnType<typeof buildLegacyMatchdayReadiness>[];
}) {
  const { readiness } = input;
  console.log("Legacy matchday readiness check");
  console.log(`source: ${input.source}`);
  console.log(`saveId: ${input.saveId}`);
  console.log(`seasonId: ${input.seasonId}`);
  console.log(`matchdayId: ${input.matchdayId}`);
  console.log(`teamsTotal: ${readiness.length}`);
  console.log(`teamsReady: ${readiness.filter((row) => row.readinessStatus === "ready").length}`);
  console.log(`teamsUnderfilled: ${readiness.filter((row) => row.readinessStatus === "underfilled_roster").length}`);
  console.log(`teamsMissingLineup: ${readiness.filter((row) => row.readinessStatus === "missing_lineup").length}`);
  console.log(`teamsInvalidLineup: ${readiness.filter((row) => row.readinessStatus === "invalid_lineup").length}`);
  console.log(
    `teamsMissingScoreCoverage: ${readiness.filter((row) => row.readinessStatus === "missing_score_coverage").length}`,
  );
  console.log("teams:");

  for (const row of readiness) {
    console.log(
      [
        `- ${row.teamId} (${row.teamName})`,
        `activePlayers=${row.activePlayersCount}`,
        `requiredUnique=${row.requiredTotalUniquePlayers}`,
        `status=${row.readinessStatus}`,
        `reasonCodes=${row.reasonCodes.join(",") || "none"}`,
        `shortReason=${row.shortReason}`,
      ].join(" | "),
    );
  }
}

async function runSqliteCheck(input: { saveId?: string; seasonId?: string; matchdayId?: string }) {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (input.saveId ? persistence.getSaveById(input.saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for legacy matchday readiness check.");
  }

  const seasonId = input.seasonId && input.seasonId === save.gameState.season.id ? input.seasonId : save.gameState.season.id;
  const matchdayId =
    input.matchdayId && save.gameState.season.matchdayIds.includes(input.matchdayId)
      ? input.matchdayId
      : save.gameState.matchdayState.matchdayId;

  const readiness = save.gameState.teams.flatMap((team) => {
    const result = loadLocalLegacyLineupContext({
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teamId: team.teamId,
    });
    return result.ok ? [buildLegacyMatchdayReadiness(result.context)] : [];
  });

  printReadinessSummary({
    source: "sqlite",
    saveId: save.saveId,
    seasonId,
    matchdayId,
    readiness,
  });
}

async function runPrismaCheck(input: { saveId?: string; seasonId?: string; matchdayId?: string }) {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const [{ db }, { LegacyLineupContextLoader }] = await Promise.all([
    import("@/src/server/db"),
    import("@/lib/lineups/legacy-lineup-context-loader"),
  ]);
  const { LegacyLineupRepository: RepositoryClass } = await import("@/lib/lineups/legacy-lineup-repository");

  const save =
    (input.saveId ? await db.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await db.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No Prisma save available for legacy matchday readiness check.");
  }

  const season =
    (input.seasonId
      ? await db.season.findFirst({ where: { id: input.seasonId, saveId: save.id } })
      : null) ??
    (await db.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));

  if (!season) {
    throw new Error(`No season available for save ${save.id}.`);
  }

  const matchday =
    (input.matchdayId
      ? await db.matchday.findFirst({ where: { id: input.matchdayId, seasonId: season.id } })
      : null) ??
    (await db.matchday.findFirst({ where: { seasonId: season.id }, orderBy: [{ index: "asc" }] }));

  if (!matchday) {
    throw new Error(`No matchday available for season ${season.id}.`);
  }

  const teamStates = await db.teamSeasonState.findMany({
    where: { saveId: save.id, seasonId: season.id },
    orderBy: [{ teamId: "asc" }],
  });

  const loader = new LegacyLineupContextLoader(db, new RepositoryClass(db));
  const loaded = await Promise.all(
    teamStates.map((team) =>
      loader.loadLegacyLineupContext({
        saveId: save.id,
        seasonId: season.id,
        matchdayId: matchday.id,
        teamId: team.teamId,
      }),
    ),
  );
  const contexts = loaded.flatMap((result) => (result.ok ? [result.context] : []));
  const readiness = contexts.map((context) => buildLegacyMatchdayReadiness(context));

  printReadinessSummary({
    source: "prisma",
    saveId: save.id,
    seasonId: season.id,
    matchdayId: matchday.id,
    readiness,
  });

  await db.$disconnect();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.source === "prisma") {
    await runPrismaCheck(args);
    return;
  }

  await runSqliteCheck(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
