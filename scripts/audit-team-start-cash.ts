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
    saveId: getValue("--saveId", "save-initial"),
    seasonId: getValue("--seasonId", "season-1"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const reference = await loadTeamStartCashReference();
  console.log(`referenceStatus: ${reference.status}`);
  console.log(`referenceAccess: ${reference.access}`);
  console.log(`referencePath: ${reference.sourcePath ?? "missing"}`);
  console.log(`referenceRows: ${reference.rows.length}`);
  if (reference.errors.length > 0) {
    console.log(`referenceErrors: ${reference.errors.join(", ")}`);
  }

  if (!process.env.DATABASE_URL) {
    console.log("database: missing");
    return;
  }

  const [teamStates, transfersTotal] = await Promise.all([
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
    dryRun: true,
  });

  console.log(`dbTeams: ${plan.summary.dbTeams}`);
  console.log(`matchedTeams: ${plan.summary.matchedTeams}`);
  console.log(`differingCashRows: ${plan.summary.differingCashRows}`);
  console.log(`transfersTotal: ${plan.summary.transfersTotal}`);
  console.log(`activeSeasonMutated: ${plan.summary.activeSeasonMutated ? "yes" : "no"}`);
  console.log(`canWrite: ${plan.canWrite ? "yes" : "no"}`);
  if (plan.blockingReasons.length > 0) {
    console.log(`blockingReasons: ${plan.blockingReasons.join(", ")}`);
  }
  if (plan.warnings.length > 0) {
    console.log(`warnings: ${plan.warnings.join(", ")}`);
  }

  const changed = plan.items.filter((item) => item.status === "matched" && item.delta !== 0);
  if (changed.length > 0) {
    console.log("changedTeams:");
    for (const item of changed.slice(0, 32)) {
      console.log(
        `- ${item.teamCode} | current=${item.currentCash ?? "?"} | start=${item.startCash ?? "?"} | delta=${item.delta ?? "?"}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
