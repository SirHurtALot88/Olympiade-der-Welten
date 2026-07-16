import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { db } from "@/src/server/db";

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const save =
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] }));
  if (!save) {
    throw new Error("No save found for legacy matchday resolve check.");
  }

  const season =
    (await db.season.findUnique({ where: { id: "season-1" } })) ??
    (await db.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));
  if (!season) {
    throw new Error(`No season found for save ${save.id}.`);
  }

  const matchday =
    (await db.matchday.findUnique({ where: { id: "matchday-1" } })) ??
    (await db.matchday.findFirst({ where: { seasonId: season.id }, orderBy: [{ index: "asc" }] }));
  if (!matchday) {
    throw new Error(`No matchday found for season ${season.id}.`);
  }

  const teamStates = await db.teamSeasonState.findMany({
    where: {
      saveId: save.id,
      seasonId: season.id,
    },
    orderBy: [{ teamId: "asc" }],
  });

  const loader = new LegacyLineupContextLoader(db, new LegacyLineupRepository(db));
  const contexts = [];
  for (const state of teamStates) {
    const result = await loader.loadLegacyLineupContext({
      saveId: save.id,
      seasonId: season.id,
      matchdayId: matchday.id,
      teamId: state.teamId,
    });
    if (result.ok) {
      contexts.push(result.context);
    }
  }

  if (contexts.length === 0) {
    throw new Error("No team contexts could be loaded for legacy matchday resolve check.");
  }

  const preview = buildLegacyMatchdayResolvePreview(contexts);

  console.log("Legacy matchday resolve check");
  console.log(`saveId: ${preview.saveId}`);
  console.log(`seasonId: ${preview.seasonId}`);
  console.log(`matchdayId: ${preview.matchdayId}`);
  console.log(`teamResults: ${preview.teamResults.length}`);
  console.log(`missingLineups: ${preview.missingLineups.length}`);
  console.log(`missingScores: ${preview.missingScores.length}`);
  console.log(`warnings: ${preview.warnings.length}`);

  for (const discipline of preview.disciplinePreviews) {
    console.log(`discipline: ${discipline.disciplineSide}:${discipline.disciplineId} (${discipline.disciplineName})`);
    console.log(`topPlayers: ${discipline.topPlayers.slice(0, 10).map((player) => `${player.rankInDiscipline}.${player.playerName}=${player.finalPlayerScore}`).join(", ") || "none"}`);
    console.log(`highlights: ${discipline.highlightCandidates.map((candidate) => candidate.highlightType).join(", ") || "none"}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
