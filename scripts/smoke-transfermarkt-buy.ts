import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { executeTransfermarktBuy, previewTransfermarktBuy } from "@/lib/market/transfermarkt-buy-service";
import { db } from "@/src/server/db";

function parseArgs(argv: string[]) {
  return {
    write: argv.includes("--write"),
  };
}

async function selectSmokeCandidate(saveId: string, seasonId: string) {
  const [teamStates, activePlayers, freeAgents] = await Promise.all([
    db.teamSeasonState.findMany({
      where: {
        saveId,
        seasonId,
      },
      include: {
        team: true,
      },
      orderBy: [{ cash: "desc" }],
    }),
    db.activePlayer.findMany({
      where: {
        saveId,
        seasonId,
      },
      select: {
        teamId: true,
      },
    }),
    db.player.findMany({
      include: {
        attributes: true,
      },
    }),
  ]);

  const activePlayersByTeamId = new Map<string, number>();
  const activePlayerIds = new Set<string>();
  for (const row of activePlayers) {
    activePlayersByTeamId.set(row.teamId, (activePlayersByTeamId.get(row.teamId) ?? 0) + 1);
  }
  const activeAssignments = await db.activePlayer.findMany({
    where: {
      saveId,
      seasonId,
    },
    select: {
      playerId: true,
    },
  });
  for (const row of activeAssignments) {
    activePlayerIds.add(row.playerId);
  }

  const preferredTeams = [...teamStates]
    .map((row) => ({
      ...row,
      activePlayersCount: activePlayersByTeamId.get(row.teamId) ?? 0,
    }))
    .sort((left, right) => {
      const leftMissingToSeven = Math.max(0, 7 - left.activePlayersCount);
      const rightMissingToSeven = Math.max(0, 7 - right.activePlayersCount);
      const leftUnderfilled = leftMissingToSeven > 0 ? 0 : 1;
      const rightUnderfilled = rightMissingToSeven > 0 ? 0 : 1;

      return (
        leftUnderfilled - rightUnderfilled ||
        leftMissingToSeven - rightMissingToSeven ||
        right.activePlayersCount - left.activePlayersCount ||
        right.cash - left.cash
      );
    });

  const eligiblePlayers = freeAgents
    .filter(
      (player) =>
        !activePlayerIds.has(player.id) &&
        player.attributes?.marketValue != null &&
        player.attributes.marketValue > 0 &&
        player.attributes?.salaryDemand != null &&
        player.attributes.salaryDemand > 0,
    )
    .sort((left, right) => {
      const leftValue = left.attributes?.marketValue ?? Number.MAX_SAFE_INTEGER;
      const rightValue = right.attributes?.marketValue ?? Number.MAX_SAFE_INTEGER;
      return leftValue - rightValue || left.name.localeCompare(right.name, "de");
    });

  for (const team of preferredTeams) {
    for (const player of eligiblePlayers) {
      const preview = await previewTransfermarktBuy({
        saveId,
        seasonId,
        teamId: team.teamId,
        playerId: player.id,
      });
      if (preview.canBuy) {
        return {
          teamId: team.teamId,
          teamName: team.team.name,
          playerId: player.id,
          playerName: player.name,
          preview,
        };
      }
    }
  }

  return null;
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. transfermarkt:smoke-buy requires .env.local in the project root.");
  }

  const args = parseArgs(process.argv.slice(2));
  const saveId = "save-initial";
  const seasonId = "season-1";
  const candidate = await selectSmokeCandidate(saveId, seasonId);

  if (!candidate) {
    throw new Error("No valid smoke-buy candidate could be found.");
  }

  console.log("Transfermarkt smoke buy");
  console.log(`mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`teamId: ${candidate.teamId}`);
  console.log(`teamName: ${candidate.teamName}`);
  console.log(`playerId: ${candidate.playerId}`);
  console.log(`playerName: ${candidate.playerName}`);
  console.log(`rosterBefore: ${candidate.preview.rosterBefore}`);
  console.log(`rosterAfter: ${candidate.preview.rosterAfter}`);
  console.log(`cashBefore: ${candidate.preview.cashBefore}`);
  console.log(`cashAfter: ${candidate.preview.cashAfter}`);
  console.log(`salaryBefore: ${candidate.preview.salaryBefore}`);
  console.log(`salaryAfter: ${candidate.preview.salaryAfter}`);
  console.log(`purchasePrice: ${candidate.preview.purchasePrice}`);
  console.log(`salary: ${candidate.preview.salary}`);
  console.log(`canBuy: ${candidate.preview.canBuy ? "yes" : "no"}`);
  console.log(`blockingReasons: ${candidate.preview.blockingReasons.join(", ") || "none"}`);

  if (!args.write) {
    return;
  }

  const result = await executeTransfermarktBuy({
    saveId,
    seasonId,
    teamId: candidate.teamId,
    playerId: candidate.playerId,
  });

  console.log(`activePlayerCreated: ${result.activePlayerCreated ? "yes" : "no"}`);
  console.log(`transferCreated: ${result.transferCreated ? "yes" : "no"}`);
  console.log(`teamSeasonStateUpdated: ${result.teamSeasonStateUpdated ? "yes" : "no"}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
