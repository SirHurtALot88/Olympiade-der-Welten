import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { calculateLocalLegacyLineupPreview, loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type SourceMode = "sqlite" | "prisma";

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback?: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback ?? "") : fallback ?? "";
  };

  const rawSource = getValue("--source", "sqlite");
  return {
    source: (rawSource === "prisma" ? "prisma" : "sqlite") as SourceMode,
    saveId: getValue("--saveId"),
    seasonId: getValue("--seasonId"),
    matchdayId: getValue("--matchdayId"),
    teamId: getValue("--teamId"),
  };
}

function resolveDefaultSqliteParams(input: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  teamId?: string;
}): LegacyLineupKeyParams {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (input.saveId ? persistence.getSaveById(input.saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for legacy lineup context check.");
  }

  const seasonId = input.seasonId && input.seasonId === save.gameState.season.id ? input.seasonId : save.gameState.season.id;
  const matchdayId =
    input.matchdayId && save.gameState.season.matchdayIds.includes(input.matchdayId)
      ? input.matchdayId
      : save.gameState.matchdayState.matchdayId;
  const teamId =
    input.teamId && save.gameState.teams.some((team) => team.teamId === input.teamId)
      ? input.teamId
      : save.gameState.teams[0]?.teamId;

  if (!teamId) {
    throw new Error(`No team available in local save ${save.saveId}.`);
  }

  return {
    saveId: save.saveId,
    seasonId,
    matchdayId,
    teamId,
  };
}

async function resolveDefaultPrismaParams(input: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  teamId?: string;
}): Promise<LegacyLineupKeyParams> {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const { db } = await import("@/src/server/db");

  const save =
    (input.saveId ? await db.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await db.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No Prisma save found for legacy lineup context check.");
  }

  const season =
    (input.seasonId
      ? await db.season.findFirst({
          where: { id: input.seasonId, saveId: save.id },
        })
      : null) ??
    (await db.season.findFirst({
      where: { saveId: save.id },
      orderBy: [{ year: "asc" }],
    }));

  if (!season) {
    throw new Error(`No season found for save ${save.id}.`);
  }

  const matchday =
    (input.matchdayId
      ? await db.matchday.findFirst({
          where: { id: input.matchdayId, seasonId: season.id },
        })
      : null) ??
    (await db.matchday.findFirst({
      where: { seasonId: season.id },
      orderBy: [{ index: "asc" }],
    }));

  if (!matchday) {
    throw new Error(`No matchday found for season ${season.id}.`);
  }

  const teamState =
    (input.teamId
      ? await db.teamSeasonState.findUnique({
          where: {
            saveId_seasonId_teamId: {
              saveId: save.id,
              seasonId: season.id,
              teamId: input.teamId,
            },
          },
        })
      : null) ??
    (await db.teamSeasonState.findFirst({
      where: { saveId: save.id, seasonId: season.id },
      orderBy: [{ teamId: "asc" }],
    }));

  if (!teamState) {
    throw new Error(`No teamSeasonState found for save ${save.id} and season ${season.id}.`);
  }

  await db.$disconnect();

  return {
    saveId: save.id,
    seasonId: season.id,
    matchdayId: matchday.id,
    teamId: teamState.teamId,
  };
}

async function loadPrismaContext(params: LegacyLineupKeyParams) {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const [{ db }, { LegacyLineupContextLoader }, { LegacyLineupRepository }, { buildLegacyLineupPreview }] = await Promise.all([
    import("@/src/server/db"),
    import("@/lib/lineups/legacy-lineup-context-loader"),
    import("@/lib/lineups/legacy-lineup-repository"),
    import("@/lib/lineups/legacy-lineup-context-loader"),
  ]);

  const loader = new LegacyLineupContextLoader(db, new LegacyLineupRepository(db));
  const result = await loader.loadLegacyLineupContext(params);
  if (!result.ok) {
    return { result, preview: null as null };
  }
  const preview = await buildLegacyLineupPreview(params, result.context.existingDraft?.entries ?? []);
  await db.$disconnect();
  return { result, preview };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source: SourceMode = args.source;
  const params =
    source === "prisma"
      ? await resolveDefaultPrismaParams(args)
      : resolveDefaultSqliteParams(args);

  if (source === "prisma") {
    const { result, preview } = await loadPrismaContext(params);
    if (!result.ok) {
      console.log("Legacy lineup context check failed.");
      result.errors.forEach((error) => console.log(`- ${error}`));
      process.exit(1);
    }

    const { context } = result;
    console.log("Legacy lineup context check");
    console.log(`source: prisma`);
    console.log(`saveId: ${context.save.id}`);
    console.log(`seasonId: ${context.season.id}`);
    console.log(`matchdayId: ${context.matchday.id}`);
    console.log(`teamId: ${context.team.id}`);
    console.log(`activePlayers: ${context.activePlayers.length}`);
    console.log(`relevantDisciplines: ${context.disciplines.map((discipline) => discipline.id).join(", ")}`);
    console.log(
      `expectedPlayerCounts: ${context.seasonDisciplineConfigs
        .map((config) => `${config.disciplineId}=${config.playerCount ?? "—"}`)
        .join(", ")}`,
    );
    console.log(`playerDisciplineScores: ${context.disciplineScores.length}`);
    console.log(`existingLineup: ${context.existingDraft ? "yes" : "no"}`);
    console.log(`d1DisciplineId: ${context.contextMeta.d1DisciplineId ?? "n/a"}`);
    console.log(`d2DisciplineId: ${context.contextMeta.d2DisciplineId ?? "n/a"}`);
    console.log(`lineupFilledCount: ${context.teamStatus?.lineupFilledCount ?? 0}`);
    console.log(`captainUsedCount: ${context.teamStatus?.captainUsedCount ?? 0}/${context.teamStatus?.captainSlots ?? 3}`);
    console.log(`teamRanks: ${(context.teamDisciplineRanks && Object.keys(context.teamDisciplineRanks).length > 0) ? "missing_source" : "n/a"}`);

    if (!preview?.ok) {
      console.log("previewStatus: failed");
      preview?.errors.forEach((error) => console.log(`- ${error}`));
      process.exit(1);
    }

    console.log(`validationStatus: ${preview.validation.isValid ? "valid" : "invalid"}`);
    console.log(`previewTotalScore: ${preview.scorePreview.totalScore}`);
    console.log(`previewWarnings: ${preview.scorePreview.validationWarnings.length}`);
    return;
  }

  const result = loadLocalLegacyLineupContext(params);
  if (!result.ok) {
    console.log("Legacy lineup context check failed.");
    result.errors.forEach((error) => console.log(`- ${error}`));
    process.exit(1);
  }

  const { context } = result;
  console.log("Legacy lineup context check");
  console.log(`source: sqlite`);
  console.log(`saveId: ${context.save.id}`);
  console.log(`seasonId: ${context.season.id}`);
  console.log(`matchdayId: ${context.matchday.id}`);
  console.log(`teamId: ${context.team.id}`);
  console.log(`activePlayers: ${context.activePlayers.length}`);
  console.log(`relevantDisciplines: ${(context.matchdayContract ? [context.matchdayContract.discipline1?.disciplineId, context.matchdayContract.discipline2?.disciplineId].filter(Boolean).join(", ") : "n/a")}`);
  console.log(
    `expectedPlayerCounts: ${[context.matchdayContract?.discipline1, context.matchdayContract?.discipline2]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => `${entry.disciplineId}=${entry.requiredPlayers ?? "—"}`)
      .join(", ")}`,
  );
  console.log(`playerDisciplineScores: ${context.disciplineScores.length}`);
  console.log(`existingLineup: ${context.existingDraft ? "yes" : "no"}`);
  console.log(`d1DisciplineId: ${context.contextMeta.d1DisciplineId ?? "n/a"}`);
  console.log(`d2DisciplineId: ${context.contextMeta.d2DisciplineId ?? "n/a"}`);
  console.log(`lineupFilledCount: ${context.teamStatus?.lineupFilledCount ?? 0}/${context.teamStatus?.totalLineupSides ?? 20}`);
  console.log(`captainUsedCount: ${context.teamStatus?.captainUsedCount ?? 0}/${context.teamStatus?.captainSlots ?? 3}`);
  console.log(
    `teamRanks: ${Object.entries(context.teamDisciplineRanks ?? {})
      .map(([disciplineId, value]) => `${disciplineId}=${value.rank ?? "—"} (${value.sourceStatus})`)
      .join(", ") || "n/a"}`,
  );

  const preview = calculateLocalLegacyLineupPreview(params, context.existingDraft?.entries);
  if (!preview.ok) {
    console.log("previewStatus: failed");
    preview.errors.forEach((error) => console.log(`- ${error}`));
    process.exit(1);
  }

  console.log(`validationStatus: ${preview.validation.isValid ? "valid" : "invalid"}`);
  console.log(`previewTotalScore: ${preview.scorePreview.totalScore}`);
  console.log(`previewWarnings: ${preview.scorePreview.validationWarnings.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
