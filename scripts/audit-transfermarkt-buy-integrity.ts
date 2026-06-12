import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";

import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";
import { db } from "@/src/server/db";

type AuditParams = {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId?: string;
  playerName?: string;
};

export type TransfermarktBuyIntegrityAudit = {
  player: { id: string; name: string } | null;
  activePlayerMatches: number;
  activePlayer: {
    teamId: string;
    saveId: string;
    seasonId: string;
    salary: number;
    purchasePrice: number | null;
    currentValue: number | null;
    contractLength: number;
    joinedSeasonId: string;
  } | null;
  transferMatches: number;
  transfer: {
    type: string;
    toTeamId: string | null;
    fromTeamId: string | null;
    fee: number;
    salary: number;
    marketValue: number;
    happenedAt: string;
  } | null;
  teamSeasonState: {
    cash: number;
    rosterCount: number;
    teamSalary: number;
    playerMin: number;
    playerOpt: number;
  } | null;
  freeAgentStillVisible: boolean;
  readinessStatus: string | null;
  teamsUnderfilled: number;
};

function parseArgs(argv: string[]): AuditParams {
  const getValue = (flag: string, fallback?: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] ?? fallback : fallback;
  };

  return {
    saveId: getValue("--saveId", "save-initial")!,
    seasonId: getValue("--seasonId", "season-1")!,
    teamId: getValue("--teamId", "W-W")!,
    playerId: getValue("--playerId"),
    playerName: getValue("--playerName", "Kloeschen"),
  };
}

export async function buildTransfermarktBuyIntegrityAudit(
  params: AuditParams,
): Promise<TransfermarktBuyIntegrityAudit> {
  const player =
    (params.playerId
      ? await db.player.findUnique({ where: { id: params.playerId }, select: { id: true, name: true } })
      : null) ??
    (params.playerName
      ? await db.player.findFirst({
          where: { name: params.playerName },
          select: { id: true, name: true },
        })
      : null);

  const teamState = await db.teamSeasonState.findUnique({
    where: {
      saveId_seasonId_teamId: {
        saveId: params.saveId,
        seasonId: params.seasonId,
        teamId: params.teamId,
      },
    },
  });

  const activePlayers = await db.activePlayer.findMany({
    where: {
      saveId: params.saveId,
      seasonId: params.seasonId,
      ...(player ? { playerId: player.id } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const transfers = await db.transfer.findMany({
    where: {
      saveId: params.saveId,
      seasonId: params.seasonId,
      ...(player ? { playerId: player.id } : {}),
      toTeamId: params.teamId,
    },
    orderBy: [{ happenedAt: "desc" }],
  });

  const teamRoster = await db.activePlayer.findMany({
    where: {
      saveId: params.saveId,
      seasonId: params.seasonId,
      teamId: params.teamId,
    },
    select: {
      salary: true,
    },
  });

  const freeAgents = await listTransfermarktFreeAgents({
    saveId: params.saveId,
    seasonId: params.seasonId,
    search: player?.name ?? params.playerName ?? undefined,
    limit: 50,
  });

  const matchday = await db.matchday.findFirst({
    where: { seasonId: params.seasonId },
    orderBy: [{ index: "asc" }],
  });

  let readinessStatus: string | null = null;
  let teamsUnderfilled = 0;
  if (matchday) {
    const teamStates = await db.teamSeasonState.findMany({
      where: { saveId: params.saveId, seasonId: params.seasonId },
      orderBy: [{ teamId: "asc" }],
    });
    const loader = new LegacyLineupContextLoader(db, new LegacyLineupRepository(db));
    const loaded = await Promise.all(
      teamStates.map((team) =>
        loader.loadLegacyLineupContext({
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: matchday.id,
          teamId: team.teamId,
        }),
      ),
    );
    const readinessRows = loaded.flatMap((result) =>
      result.ok ? [buildLegacyMatchdayReadiness(result.context)] : [],
    );
    teamsUnderfilled = readinessRows.filter((row) => row.readinessStatus === "underfilled_roster").length;
    readinessStatus =
      readinessRows.find((row) => row.teamId === params.teamId)?.readinessStatus ?? null;
  }

  return {
    player: player ?? null,
    activePlayerMatches: activePlayers.filter((row) => row.teamId === params.teamId).length,
    activePlayer:
      activePlayers.find((row) => row.teamId === params.teamId)
        ? {
            teamId: activePlayers.find((row) => row.teamId === params.teamId)!.teamId,
            saveId: activePlayers.find((row) => row.teamId === params.teamId)!.saveId,
            seasonId: activePlayers.find((row) => row.teamId === params.teamId)!.seasonId,
            salary: activePlayers.find((row) => row.teamId === params.teamId)!.salary,
            purchasePrice: activePlayers.find((row) => row.teamId === params.teamId)!.purchasePrice,
            currentValue: activePlayers.find((row) => row.teamId === params.teamId)!.currentValue,
            contractLength: activePlayers.find((row) => row.teamId === params.teamId)!.contractLength,
            joinedSeasonId: activePlayers.find((row) => row.teamId === params.teamId)!.joinedSeasonId,
          }
        : null,
    transferMatches: transfers.length,
    transfer: transfers[0]
      ? {
          type: transfers[0].type,
          toTeamId: transfers[0].toTeamId,
          fromTeamId: transfers[0].fromTeamId,
          fee: transfers[0].fee,
          salary: transfers[0].salary,
          marketValue: transfers[0].marketValue,
          happenedAt: transfers[0].happenedAt.toISOString(),
        }
      : null,
    teamSeasonState: teamState
      ? {
          cash: teamState.cash,
          rosterCount: teamRoster.length,
          teamSalary: teamRoster.reduce((sum, row) => sum + row.salary, 0),
          playerMin: teamState.playerMin,
          playerOpt: teamState.playerOpt,
        }
      : null,
    freeAgentStillVisible: freeAgents.items.some((item) => item.playerId === player?.id),
    readinessStatus,
    teamsUnderfilled,
  };
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. transfermarkt:audit-buy-integrity requires .env.local in the project root.",
    );
  }

  const audit = await buildTransfermarktBuyIntegrityAudit(parseArgs(process.argv.slice(2)));

  console.log("Transfermarkt buy integrity audit");
  console.log(`player: ${audit.player ? `${audit.player.name} (${audit.player.id})` : "not_found"}`);
  console.log(`activePlayerMatches: ${audit.activePlayerMatches}`);
  if (audit.activePlayer) {
    console.log(
      [
        "activePlayer:",
        `teamId=${audit.activePlayer.teamId}`,
        `saveId=${audit.activePlayer.saveId}`,
        `seasonId=${audit.activePlayer.seasonId}`,
        `salary=${audit.activePlayer.salary}`,
        `purchasePrice=${audit.activePlayer.purchasePrice ?? "null"}`,
        `currentValue=${audit.activePlayer.currentValue ?? "null"}`,
        `contractLength=${audit.activePlayer.contractLength}`,
        `joinedSeasonId=${audit.activePlayer.joinedSeasonId}`,
      ].join(" "),
    );
  }
  console.log(`transferMatches: ${audit.transferMatches}`);
  if (audit.transfer) {
    console.log(
      [
        "transfer:",
        `type=${audit.transfer.type}`,
        `toTeamId=${audit.transfer.toTeamId ?? "null"}`,
        `fromTeamId=${audit.transfer.fromTeamId ?? "null"}`,
        `fee=${audit.transfer.fee}`,
        `salary=${audit.transfer.salary}`,
        `marketValue=${audit.transfer.marketValue}`,
        `happenedAt=${audit.transfer.happenedAt}`,
      ].join(" "),
    );
  }
  if (audit.teamSeasonState) {
    console.log(
      [
        "teamSeasonState:",
        `cash=${audit.teamSeasonState.cash}`,
        `teamSalary=${audit.teamSeasonState.teamSalary}`,
        `rosterCount=${audit.teamSeasonState.rosterCount}`,
        `playerMin=${audit.teamSeasonState.playerMin}`,
        `playerOpt=${audit.teamSeasonState.playerOpt}`,
      ].join(" "),
    );
  }
  console.log(`freeAgentStillVisible: ${audit.freeAgentStillVisible ? "yes" : "no"}`);
  console.log(`readinessStatus: ${audit.readinessStatus ?? "unknown"}`);
  console.log(`teamsUnderfilled: ${audit.teamsUnderfilled}`);
}

const isDirectRun =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
