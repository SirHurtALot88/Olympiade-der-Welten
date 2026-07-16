import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import {
  fetchPlayerAttributeSheetRows,
  normalizeAttributeSheetName,
  summarizeMissingAttributeRows,
} from "../lib/data/playerAttributeSheet";

loadEnvConfig(path.resolve(__dirname, ".."));
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

function parseArgs(argv: string[]) {
  return {
    write: argv.includes("--write"),
  };
}

async function runInBatches<T>(items: T[], runner: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);
    for (const item of batch) {
      await runner(item);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`DATABASE_URL present: ${process.env.DATABASE_URL ? "yes" : "no"}`);
  console.log(`DIRECT_URL present: ${process.env.DIRECT_URL ? "yes" : "no"}`);
  console.log(`mode: ${args.write ? "write" : "dry-run"}`);

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. player:sync-attribute-sheet-db requires .env.local in the project root.",
    );
  }

  const [rows, players] = await Promise.all([
    fetchPlayerAttributeSheetRows(),
    prisma.player.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const playerByName = new Map(players.map((player) => [player.name, player]));
  const missingInPlayers = new Set<string>();
  let updatableAttributes = 0;
  let aliasMatches = 0;

  const plannedUpdates = rows.flatMap((row) => {
    const normalizedName = normalizeAttributeSheetName(row.name);
    const player = playerByName.get(normalizedName);

    if (!player) {
      missingInPlayers.add(row.name);
      return [];
    }

    if (normalizedName !== row.name) {
      aliasMatches += 1;
    }

    updatableAttributes += 1;
    return [
      {
        playerId: player.id,
        row,
      },
    ];
  });

  const playersMissingAttributes = summarizeMissingAttributeRows(
    players.map((player) => player.name),
    rows,
  );

  console.log(`attributeRows: ${rows.length}`);
  console.log(`updatableAttributes: ${updatableAttributes}`);
  console.log(`exactMatches: ${updatableAttributes - aliasMatches}`);
  console.log(`aliasMatches: ${aliasMatches}`);
  console.log(`missingInPlayers: ${missingInPlayers.size}`);
  if (missingInPlayers.size > 0) {
    console.log(`missingInPlayersList: ${Array.from(missingInPlayers).join(", ")}`);
  }
  console.log(`playersMissingAttributes: ${playersMissingAttributes.length}`);
  if (playersMissingAttributes.length > 0) {
    console.log(`playersMissingAttributesList: ${playersMissingAttributes.join(", ")}`);
  }

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to persist Attribute rows into PlayerAttribute.");
    return;
  }

  let updatedAttributes = 0;
  await runInBatches(plannedUpdates, async ({ playerId, row }) => {
    await prisma.playerAttribute.update({
      where: {
        playerId,
      },
      data: {
        power: row.power,
        health: row.health,
        stamina: row.stamina,
        intelligence: row.intelligence,
        awareness: row.awareness,
        determination: row.determination,
        speed: row.speed,
        dexterity: row.dexterity,
        charisma: row.charisma,
        will: row.will,
        spirit: row.spirit,
        torment: row.torment,
        powerRating: row.powerRating,
        healthRating: row.healthRating,
        staminaRating: row.staminaRating,
        intelligenceRating: row.intelligenceRating,
        awarenessRating: row.awarenessRating,
        determinationRating: row.determinationRating,
        speedRating: row.speedRating,
        dexterityRating: row.dexterityRating,
        charismaRating: row.charismaRating,
        willRating: row.willRating,
        spiritRating: row.spiritRating,
        tormentRating: row.tormentRating,
      },
    });

    updatedAttributes += 1;
  });

  console.log(`updatedAttributes: ${updatedAttributes}`);
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
