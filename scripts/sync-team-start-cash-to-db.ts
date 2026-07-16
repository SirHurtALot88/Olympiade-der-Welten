import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import {
  buildTeamStartCashSyncPlan,
  loadTeamStartCashReference,
} from "../lib/season/team-start-cash";

loadEnvConfig(path.resolve(__dirname, ".."));
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };

  return {
    write: argv.includes("--write"),
    saveId: getValue("--saveId", "save-initial"),
    seasonId: getValue("--seasonId", "season-1"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`mode: ${args.write ? "write" : "dry-run"}`);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. team start cash sync requires .env.local in the project root.");
  }

  const [reference, teamStates, transfersTotal] = await Promise.all([
    loadTeamStartCashReference(),
    prisma.teamSeasonState.findMany({
      where: {
        saveId: args.saveId,
        seasonId: args.seasonId,
      },
      select: {
        id: true,
        saveId: true,
        seasonId: true,
        teamId: true,
        cash: true,
        team: {
          select: {
            shortCode: true,
            name: true,
          },
        },
      },
      orderBy: {
        teamId: "asc",
      },
    }),
    prisma.transfer.count({
      where: {
        saveId: args.saveId,
        seasonId: args.seasonId,
      },
    }),
  ]);

  const plan = buildTeamStartCashSyncPlan({
    referenceRows: reference.rows,
    teamStates: teamStates.map((state) => ({
      id: state.id,
      saveId: state.saveId,
      seasonId: state.seasonId,
      teamId: state.teamId,
      teamCode: state.team.shortCode,
      teamName: state.team.name,
      currentCash: state.cash,
    })),
    transfersTotal,
    dryRun: !args.write,
  });

  console.log(`referenceStatus: ${reference.status}`);
  console.log(`matchedTeams: ${plan.summary.matchedTeams}`);
  console.log(`transfersTotal: ${plan.summary.transfersTotal}`);
  console.log(`canWrite: ${plan.canWrite ? "yes" : "no"}`);
  if (plan.blockingReasons.length > 0) {
    console.log(`blockingReasons: ${plan.blockingReasons.join(", ")}`);
  }
  if (plan.warnings.length > 0) {
    console.log(`warnings: ${plan.warnings.join(", ")}`);
  }

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to sync start cash into TeamSeasonState.cash.");
    return;
  }

  if (!plan.canWrite) {
    throw new Error(`Start cash sync blocked: ${plan.blockingReasons.join(", ")}`);
  }

  const updates = plan.items.filter(
    (item) => item.status === "matched" && item.teamStateId && item.startCash != null && item.delta !== 0,
  );

  await prisma.$transaction(
    updates.map((item) =>
      prisma.teamSeasonState.update({
        where: {
          id: item.teamStateId!,
        },
        data: {
          cash: Math.round(item.startCash!),
        },
      }),
    ),
  );

  console.log(`updatedTeamStates: ${updates.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
