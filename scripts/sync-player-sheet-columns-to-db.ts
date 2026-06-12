import { PrismaClient } from "@prisma/client";

import { loadImportedPlayerStats } from "../lib/data/playerStatsAdapter";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

function parseArgs(argv: string[]) {
  return {
    write: argv.includes("--write"),
  };
}

async function runInBatches<T>(items: T[], batchSize: number, runner: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    for (const item of batch) {
      await runner(item);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const players = loadImportedPlayerStats();
  console.log(`mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`playersLoaded: ${players.length}`);

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to persist Player and PlayerAttribute sheet columns.");
    return;
  }

  let updatedPlayers = 0;
  let updatedAttributes = 0;
  await runInBatches(players, BATCH_SIZE, async (player) => {
    await prisma.player.update({
      where: { id: player.id },
      data: {
        referenceClass: player.referenceClass ?? null,
        imageSource: player.imageSource ?? null,
        bracketLabel: player.bracketLabel ?? null,
      },
    });
    updatedPlayers += 1;

    await prisma.playerAttribute.update({
      where: { playerId: player.id },
      data: {
        displayMarketValue: Number((player.displayMarketValue ?? player.marketValue).toFixed(2)),
        displaySalary: Number((player.displaySalary ?? player.salaryDemand).toFixed(2)),
        cost: Math.round(player.cost ?? player.marketValue),
        upkeepBase: Math.round(player.upkeepBase ?? player.salaryDemand),
      },
    });
    updatedAttributes += 1;
  });

  console.log(`updatedPlayers: ${updatedPlayers}`);
  console.log(`updatedAttributes: ${updatedAttributes}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
