import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { db } from "@/src/server/db";
import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";

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
  loadEnvConfig(path.resolve(__dirname, ".."));
  console.log(`DATABASE_URL present: ${process.env.DATABASE_URL ? "yes" : "no"}`);
  console.log(`DIRECT_URL present: ${process.env.DIRECT_URL ? "yes" : "no"}`);

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. transfermarkt:audit requires a configured Prisma database. Check .env.local in the project root.",
    );
  }

  const input = parseArgs(process.argv.slice(2));
  const [playersTotal, transfersTotal, teamStates, freeAgents, activePlayerRows] = await Promise.all([
    db.player.count(),
    db.transfer.count(),
    db.teamSeasonState.findMany({
      where: {
        saveId: input.saveId,
        seasonId: input.seasonId,
      },
      include: {
        team: true,
      },
      orderBy: [{ teamId: "asc" }],
    }),
    listTransfermarktFreeAgents({ saveId: input.saveId, seasonId: input.seasonId, limit: 20 }),
    db.activePlayer.findMany({
      where: {
        saveId: input.saveId,
        seasonId: input.seasonId,
      },
      select: {
        teamId: true,
        salary: true,
      },
    }),
  ]);
  const recentTransfers = await db.transfer.findMany({
    where: {
      saveId: input.saveId,
      seasonId: input.seasonId,
    },
    include: {
      player: { select: { name: true } },
      toTeam: { select: { shortCode: true, name: true } },
      fromTeam: { select: { shortCode: true, name: true } },
    },
    orderBy: [{ happenedAt: "desc" }],
    take: 5,
  });

  const activePlayersTotal = activePlayerRows.length;
  const purchasesTotal = recentTransfers.length > 0 ? await db.transfer.count({
    where: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      type: "buy",
    },
  }) : await db.transfer.count({
    where: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      type: "buy",
    },
  });
  const activePlayersByTeamId = new Map<string, number>();
  for (const row of activePlayerRows) {
    activePlayersByTeamId.set(row.teamId, (activePlayersByTeamId.get(row.teamId) ?? 0) + 1);
  }

  const teamCounts = teamStates.map((row) => ({
    ...row,
    activePlayersCount: activePlayersByTeamId.get(row.teamId) ?? 0,
  }));
  const teamsUnder7 = teamCounts.filter((row) => row.activePlayersCount < 7);
  const teamsUnderPlayerMin = teamCounts.filter((row) => row.activePlayersCount < row.playerMin);
  const teamsUnderPlayerOpt = teamCounts.filter((row) => row.activePlayersCount < row.playerOpt);

  console.log("Transfermarkt state audit");
  console.log(`saveId: ${freeAgents.scope.saveId}`);
  console.log(`seasonId: ${freeAgents.scope.seasonId}`);
  console.log(`playersTotal: ${playersTotal}`);
  console.log(`activePlayersTotal: ${activePlayersTotal}`);
  console.log(`freeAgentsTotal: ${freeAgents.total}`);
  console.log(`purchasesTotal: ${purchasesTotal}`);
  console.log(`transfersTotal: ${transfersTotal}`);
  console.log("transferListingsTotal: model_missing");
  console.log(`teamsUnder7: ${teamsUnder7.length}`);
  console.log(`teamsUnderPlayerMin: ${teamsUnderPlayerMin.length}`);
  console.log(`teamsUnderPlayerOpt: ${teamsUnderPlayerOpt.length}`);
  console.log("topFreeAgents:");

  for (const item of freeAgents.items) {
    const topDisciplines = item.topDisciplineScores.map((entry) => `${entry.disciplineId}:${entry.scoreTier ?? "—"}`).join(", ");
    console.log(
      [
        `- ${item.name}`,
        `playerId=${item.playerId}`,
        `class=${item.className}`,
        `marketValue=${item.marketValue ?? "missing"}`,
        `salary=${item.salary ?? "missing"}`,
        `axes=${[item.pow, item.spe, item.men, item.soc].map((value) => value ?? "x").join("/")}`,
        `top=${topDisciplines || "none"}`,
      ].join(" | "),
    );
  }

  console.log("recentTransfers:");
  if (recentTransfers.length === 0) {
    console.log("- none");
  } else {
    for (const transfer of recentTransfers) {
      console.log(
        [
          `- ${transfer.player.name}`,
          `type=${transfer.type}`,
          `from=${transfer.fromTeam?.shortCode ?? "FA"}`,
          `to=${transfer.toTeam?.shortCode ?? "FA"}`,
          `fee=${transfer.fee}`,
          `salary=${transfer.salary}`,
          `at=${transfer.happenedAt.toISOString()}`,
        ].join(" | "),
      );
    }
  }

  console.log("missingDataForMvp:");
  console.log("- No Prisma TransferListing model exists yet.");
  console.log("- Transfer history exists as a table, but the read-side market currently derives listings from players without ActivePlayer assignment.");
  console.log("- Salary fallback logic is not implemented; missing salary remains missing.");
  console.log("- Buy path exists; this audit only covers the read-only market state.");
  if (freeAgents.warnings.length > 0) {
    console.log("warnings:");
    for (const warning of freeAgents.warnings) {
      console.log(`- ${warning}`);
    }
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
