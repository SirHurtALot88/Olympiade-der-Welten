import { readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { foundationSeedDisciplines } from "../lib/data/dataAdapter";
import {
  buildPlayerFromBrief,
  type OlympiadeCharacterBrief,
  syncImportedCharacterPersistence,
  validateCharacterBrief,
} from "../lib/player-import/character-import-service";
import {
  mapPlayerAttributeRecord,
  mapPlayerDisciplineScoreRecords,
  mapPlayerRecord,
} from "../lib/db/seed/mappers";

loadEnvConfig(path.resolve(__dirname, ".."));
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const write = argv.includes("--write");
  const briefFlagIndex = argv.findIndex((arg) => arg === "--brief");
  const briefPath = briefFlagIndex >= 0 ? argv[briefFlagIndex + 1] : "";
  if (!briefPath) {
    throw new Error("Provide --brief path/to/character-brief.json");
  }
  return { write, briefPath: path.resolve(process.cwd(), briefPath) };
}

async function syncPrismaPlayer(player: ReturnType<typeof buildPlayerFromBrief>["player"]) {
  const playerRecord = mapPlayerRecord(player);
  const attributeRecord = mapPlayerAttributeRecord(player);
  const disciplineRecords = mapPlayerDisciplineScoreRecords(player, foundationSeedDisciplines);

  await prisma.player.upsert({
    where: { id: playerRecord.id },
    update: playerRecord,
    create: playerRecord,
  });

  await prisma.playerAttribute.upsert({
    where: { playerId: player.id },
    update: attributeRecord,
    create: attributeRecord,
  });

  for (const score of disciplineRecords) {
    await prisma.playerDisciplineScore.upsert({
      where: {
        playerId_disciplineId: {
          playerId: score.playerId,
          disciplineId: score.disciplineId,
        },
      },
      update: { score: score.score },
      create: score,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const brief = JSON.parse(readFileSync(args.briefPath, "utf8")) as OlympiadeCharacterBrief;
  const validationIssues = validateCharacterBrief(brief);
  const result = buildPlayerFromBrief(brief);

  console.log(`mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`player: ${result.player.name} (${result.player.id})`);
  console.log(`class: ${result.player.className} | race: ${result.player.race}`);
  console.log(`rating: ${result.player.rating}`);
  console.log(`economy: MW ${result.economy.marketValue} | salary ${result.economy.salaryDemand}`);
  console.log(`disciplines: ${Object.keys(result.player.disciplineRatings).length}`);
  console.log(`traits+: ${result.player.traitsPositive.join(", ") || "-"}`);
  console.log(`traits-: ${result.player.traitsNegative.join(", ") || "-"}`);
  console.log(`portraitPath: ${result.player.portraitPath ?? "-"}`);

  if (validationIssues.length > 0) {
    console.log("validationIssues:");
    for (const issue of validationIssues) {
      console.log(`- ${issue.field}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to update catalog JSON, SQLite and Postgres.");
    return;
  }

  syncImportedCharacterPersistence(result);
  console.log("catalog JSON + SQLite player/baseline catalog updated");

  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL missing: skipped Postgres sync.");
    return;
  }

  await syncPrismaPlayer(result.player);
  console.log("postgres upserted");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
