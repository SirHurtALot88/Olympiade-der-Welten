import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { executeTransfermarktSell, previewTransfermarktSell } from "@/lib/market/transfermarkt-sell-service";
import { listTransferHistory } from "@/lib/market/transfer-history-read-service";
import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";
import { db } from "@/src/server/db";

function parseArgs(argv: string[]) {
  return {
    write: argv.includes("--write"),
  };
}

async function selectSmokeSellCandidate(saveId: string, seasonId: string) {
  const [teamStates, activePlayers, firstMatchday] = await Promise.all([
    db.teamSeasonState.findMany({
      where: { saveId, seasonId },
      include: { team: true },
      orderBy: [{ cash: "desc" }],
    }),
    db.activePlayer.findMany({
      where: { saveId, seasonId, status: "active" },
      select: {
        id: true,
        playerId: true,
        teamId: true,
        roleTag: true,
        currentValue: true,
        purchasePrice: true,
        createdAt: true,
        player: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ currentValue: "asc" }, { purchasePrice: "asc" }, { createdAt: "asc" }],
    }),
    db.matchday.findFirst({
      where: { seasonId },
      orderBy: [{ index: "asc" }],
    }),
  ]);

  const rosterCounts = new Map<string, number>();
  for (const row of activePlayers) {
    rosterCounts.set(row.teamId, (rosterCounts.get(row.teamId) ?? 0) + 1);
  }

  const loader =
    firstMatchday != null ? new LegacyLineupContextLoader(db, new LegacyLineupRepository(db)) : null;
  const readinessByTeamId = new Map<string, string>();
  if (loader && firstMatchday) {
    const loaded = await Promise.all(
      teamStates.map((row) =>
        loader.loadLegacyLineupContext({
          saveId,
          seasonId,
          matchdayId: firstMatchday.id,
          teamId: row.teamId,
        }),
      ),
    );
    for (const result of loaded) {
      if (result.ok) {
        const readiness = buildLegacyMatchdayReadiness(result.context);
        readinessByTeamId.set(readiness.teamId, readiness.readinessStatus);
      }
    }
  }

  const candidates = activePlayers
    .filter((row) => row.player.name !== "Kloeschen")
    .map((row) => {
      const teamState = teamStates.find((team) => team.teamId === row.teamId);
      if (!teamState) return null;
      const rosterCount = rosterCounts.get(row.teamId) ?? 0;
      return {
        activePlayerId: row.id,
        playerId: row.playerId,
        playerName: row.player.name,
        teamId: row.teamId,
        teamName: row.team.name,
        roleTag: row.roleTag,
        salePrice: row.currentValue ?? row.purchasePrice ?? null,
        rosterCount,
        playerMin: teamState.playerMin,
        readinessStatus: readinessByTeamId.get(row.teamId) ?? "unknown",
        isSafeRoster: rosterCount - 1 >= Math.max(7, teamState.playerMin),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => {
      const leftSafety = left.isSafeRoster ? 0 : 1;
      const rightSafety = right.isSafeRoster ? 0 : 1;
      const leftBench = left.roleTag === "bench" || left.roleTag === "prospect" ? 0 : 1;
      const rightBench = right.roleTag === "bench" || right.roleTag === "prospect" ? 0 : 1;
      return (
        leftSafety - rightSafety ||
        leftBench - rightBench ||
        (left.salePrice ?? Number.MAX_SAFE_INTEGER) - (right.salePrice ?? Number.MAX_SAFE_INTEGER) ||
        left.playerName.localeCompare(right.playerName, "de")
      );
    });

  return {
    candidate: candidates[0] ?? null,
    alternatives: candidates.slice(0, 5),
  };
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. transfermarkt:smoke-sell requires .env.local in the project root.");
  }

  const args = parseArgs(process.argv.slice(2));
  const saveId = "save-initial";
  const seasonId = "season-1";
  const { candidate, alternatives } = await selectSmokeSellCandidate(saveId, seasonId);

  if (!candidate) {
    console.log("Transfermarkt smoke sell");
    console.log("mode: dry-run");
    console.log("No safe sell candidate found.");
    return;
  }

  const preview = await previewTransfermarktSell({
    saveId,
    seasonId,
    teamId: candidate.teamId,
    activePlayerId: candidate.activePlayerId,
  });

  console.log("Transfermarkt smoke sell");
  console.log(`mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`teamId: ${candidate.teamId}`);
  console.log(`teamName: ${candidate.teamName}`);
  console.log(`playerId: ${candidate.playerId}`);
  console.log(`playerName: ${candidate.playerName}`);
  console.log(`activePlayerId: ${candidate.activePlayerId}`);
  console.log(`salePrice: ${preview.salePrice}`);
  console.log(`cashBefore: ${preview.cashBefore}`);
  console.log(`cashAfter: ${preview.cashAfter}`);
  console.log(`rosterBefore: ${preview.rosterBefore}`);
  console.log(`rosterAfter: ${preview.rosterAfter}`);
  console.log(`teamSalaryBefore: ${preview.teamSalaryBefore}`);
  console.log(`teamSalaryAfter: ${preview.teamSalaryAfter}`);
  console.log(`projectedReadinessAfterSell: ${preview.projectedReadinessAfterSell ?? "unknown"}`);
  console.log(`canSell: ${preview.canSell ? "yes" : "no"}`);
  console.log(`blockingReasons: ${preview.blockingReasons.join(", ") || "none"}`);
  console.log(`warnings: ${preview.warnings.join(", ") || "none"}`);

  if (alternatives.length > 1) {
    console.log(
      `alternatives: ${alternatives
        .slice(1)
        .map((row) => `${row.playerName}@${row.teamId}`)
        .join(", ") || "none"}`,
    );
  }

  if (!args.write) {
    return;
  }

  if (!preview.canSell) {
    throw new Error("Sell smoke write aborted because the selected candidate is blocked.");
  }

  const result = await executeTransfermarktSell({
    saveId,
    seasonId,
    teamId: candidate.teamId,
    activePlayerId: candidate.activePlayerId,
  });

  const [history, freeAgents] = await Promise.all([
    listTransferHistory({ saveId, seasonId, teamId: candidate.teamId, type: "sell", limit: 5 }),
    listTransfermarktFreeAgents({ saveId, seasonId, search: candidate.playerName, limit: 20 }),
  ]);

  console.log(`activePlayerRemoved: ${result.activePlayerRemoved ? "yes" : "no"}`);
  console.log(`transferCreated: ${result.transferCreated ? "yes" : "no"}`);
  console.log(`teamSeasonStateUpdated: ${result.teamSeasonStateUpdated ? "yes" : "no"}`);
  console.log(`recentSellTransferFound: ${history.items.some((item) => item.playerId === candidate.playerId) ? "yes" : "no"}`);
  console.log(`freeAgentVisibleAfterSell: ${freeAgents.items.some((item) => item.playerId === candidate.playerId) ? "yes" : "no"}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
