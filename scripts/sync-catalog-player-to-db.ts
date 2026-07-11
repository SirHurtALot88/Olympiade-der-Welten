import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { foundationSeedDisciplines } from "../lib/data/dataAdapter";
import { loadImportedPlayerStats } from "../lib/data/playerStatsAdapter";
import {
  mapPlayerAttributeRecord,
  mapPlayerDisciplineScoreRecords,
  mapPlayerRecord,
} from "../lib/db/seed/mappers";
import { createPlayerBaselineFromPlayer } from "../lib/players/player-baseline-service";
import {
  clearPlayerSavePatches,
  upsertPlayerBaselineCatalogEntries,
  upsertPlayerCatalogEntries,
} from "../lib/persistence/save-repository";

loadEnvConfig(path.resolve(__dirname, ".."));
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const write = argv.includes("--write");
  const keepSavePatches = argv.includes("--keep-save-patches");
  const playerFlagIndex = argv.findIndex((arg) => arg === "--player");
  const playerName = playerFlagIndex >= 0 ? argv[playerFlagIndex + 1]?.trim() : "";
  const playerIdFlagIndex = argv.findIndex((arg) => arg === "--id");
  const playerId = playerIdFlagIndex >= 0 ? argv[playerIdFlagIndex + 1]?.trim() : "";

  if (!playerName && !playerId) {
    throw new Error("Provide --player \"VIP Wal\" or --id player-2984-vip-wal");
  }

  return { write, keepSavePatches, playerName, playerId };
}

async function syncPrismaPlayer(player: ReturnType<typeof loadImportedPlayerStats>[number]) {
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
  const catalog = loadImportedPlayerStats();
  const player = catalog.find((entry) => {
    if (args.playerId) return entry.id === args.playerId;
    return entry.name === args.playerName;
  });

  if (!player) {
    throw new Error(`Player not found in catalog: ${args.playerId || args.playerName}`);
  }

  console.log(`mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`player: ${player.name} (${player.id})`);
  console.log(`class: ${player.className} | race: ${player.race} | alignment: ${player.alignment}`);
  console.log(`traits+: ${player.traitsPositive.join(", ") || "-"}`);
  console.log(`traits-: ${player.traitsNegative.join(", ") || "-"}`);
  console.log(`portraitPath: ${player.portraitPath ?? "-"}`);
  console.log(`marketValue: ${player.marketValue} | salaryDemand: ${player.salaryDemand}`);
  console.log(`flavorDe: ${player.flavorDe ? `${player.flavorDe.slice(0, 80)}...` : "-"}`);
  console.log(`12 attributes present: ${player.attributeSheetStats ? "yes" : "no"}`);
  console.log(`save patch reset: ${args.keepSavePatches ? "skipped" : "planned"}`);

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to refresh SQLite catalog, save patches and Postgres.");
    return;
  }

  upsertPlayerCatalogEntries([player]);
  upsertPlayerBaselineCatalogEntries([
    createPlayerBaselineFromPlayer(player, {
      source: "import",
      sourceFile: "data/generated/oly-player-stats.json",
    }),
  ]);
  console.log("sqlite player_catalog + player_baseline_catalog upserted");

  if (!args.keepSavePatches) {
    clearPlayerSavePatches(player.id);
    console.log("sqlite save-specific player patches cleared");
  }

  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL missing: skipped Postgres sync (SQLite transfermarkt source updated).");
    return;
  }

  await syncPrismaPlayer(player);
  console.log(`postgres upserted: ${player.name}`);
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
