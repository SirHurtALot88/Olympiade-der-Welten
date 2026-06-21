import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  listLocalTransferHistory,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type SmokeCandidate = {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function findRowMetrics(saveId: string, teamId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded.`);
  }

  const rows = buildTeamSeasonOverviewRows({ gameState: save.gameState });
  const row = rows.find((entry) => entry.teamId === teamId);
  if (!row) {
    throw new Error(`Team ${teamId} is missing from the management overview for save ${saveId}.`);
  }

  return {
    save,
    row,
  };
}

function validateFreshSeasonStart(saveId: string) {
  const { save } = findRowMetrics(saveId, "A-A");
  const gameState = save.gameState;

  if (gameState.teams.length !== 32) {
    throw new Error(`Fresh Season 1 save ${saveId} should contain 32 teams, got ${gameState.teams.length}.`);
  }

  if (gameState.transferHistory.length !== 0) {
    throw new Error(`Fresh Season 1 save ${saveId} should start with empty transfer history.`);
  }

  const rows = buildTeamSeasonOverviewRows({ gameState });
  for (const row of rows) {
    const roster = gameState.rosters.filter((entry) => entry.teamId === row.teamId);
    const salaryTotal = roster.reduce((sum, entry) => sum + entry.salary, 0);
    const marketValueTotal = roster.reduce(
      (sum, entry) => sum + (entry.currentValue ?? entry.purchasePrice ?? 0),
      0,
    );
    const avgContractLength =
      roster.length > 0
        ? Number((roster.reduce((sum, entry) => sum + entry.contractLength, 0) / roster.length).toFixed(1))
        : null;

    if (row.budget !== row.cash) {
      throw new Error(`Fresh save budget/cash mismatch for ${row.teamId}: budget=${row.budget}, cash=${row.cash}`);
    }
    if (row.rosterCount !== roster.length) {
      throw new Error(`Fresh save roster mismatch for ${row.teamId}: row=${row.rosterCount}, actual=${roster.length}`);
    }
    if (row.salaryTotal !== Number(salaryTotal.toFixed(2))) {
      throw new Error(`Fresh save salary mismatch for ${row.teamId}: row=${row.salaryTotal}, actual=${salaryTotal}`);
    }
    const expectedMarketValueTotal = roster.length > 0 ? Number(marketValueTotal.toFixed(2)) : null;
    if ((row.marketValueTotal ?? null) !== expectedMarketValueTotal) {
      throw new Error(`Fresh save MW mismatch for ${row.teamId}: row=${row.marketValueTotal}, actual=${marketValueTotal}`);
    }
    if ((row.avgContractLength ?? null) !== avgContractLength) {
      throw new Error(
        `Fresh save avg contract mismatch for ${row.teamId}: row=${row.avgContractLength}, actual=${avgContractLength}`,
      );
    }
    if (row.avgContractLength != null && !Number.isInteger(row.avgContractLength * 10)) {
      throw new Error(`Fresh save avg contract must keep one decimal for ${row.teamId}, got ${row.avgContractLength}.`);
    }
  }

  const allPointsZero = Object.values(gameState.seasonState.standings).every(
    (standing) => (standing.points ?? 0) === 0,
  );
  if (!allPointsZero) {
    throw new Error(`Fresh Season 1 save ${saveId} should start with zero points for every team.`);
  }
}

function selectBuyCandidate(saveId: string): SmokeCandidate {
  const { save } = findRowMetrics(saveId, "A-A");
  const gameState = save.gameState;

  const orderedTeams = buildTeamSeasonOverviewRows({ gameState }).sort((left, right) => {
    return (
      (right.cash ?? Number.NEGATIVE_INFINITY) - (left.cash ?? Number.NEGATIVE_INFINITY) ||
      left.rosterCount - right.rosterCount ||
      left.teamName.localeCompare(right.teamName, "de")
    );
  });

  for (const teamRow of orderedTeams) {
    const freeAgents = listLocalTransfermarktFreeAgents({
      saveId,
      seasonId: gameState.season.id,
      teamId: teamRow.teamId,
      limit: 250,
    });

    for (const item of freeAgents.items) {
      const preview = previewLocalTransfermarktBuy({
        saveId,
        seasonId: gameState.season.id,
        teamId: teamRow.teamId,
        playerId: item.playerId,
      });

      if (preview.canBuy) {
        return {
          teamId: teamRow.teamId,
          teamName: teamRow.teamName,
          playerId: item.playerId,
          playerName: item.name,
        };
      }
    }
  }

  throw new Error(`No valid local buy candidate could be found in fresh save ${saveId}.`);
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));

  const prismaBefore = await loadFoundationSnapshotFromPrisma("save-initial");
  const prismaBeforeTransferCount = prismaBefore?.teamSeasonStates.length ?? null;
  const prismaBeforeActivePlayers = prismaBefore?.activePlayers.length ?? null;

  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const freshSave = persistence.createFreshSeasonOneSave({
    name: `Fresh Season 1 Smoke ${new Date().toLocaleString("de-DE")}`,
  });

  try {
    validateFreshSeasonStart(freshSave.saveId);

    const candidate = selectBuyCandidate(freshSave.saveId);
    const before = findRowMetrics(freshSave.saveId, candidate.teamId).row;
    const seasonId = freshSave.gameState.season.id;
    const buyPreview = previewLocalTransfermarktBuy({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      playerId: candidate.playerId,
    });

    if (!buyPreview.canBuy) {
      throw new Error(`Smoke buy unexpectedly blocked: ${buyPreview.blockingReasons.join(", ") || "unknown"}`);
    }

    const buyResult = executeLocalTransfermarktBuy({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      playerId: candidate.playerId,
    });

    if (!buyResult.canBuy || !buyResult.activePlayerCreated || !buyResult.transferCreated) {
      throw new Error(`Smoke buy failed for ${candidate.playerName} -> ${candidate.teamId}.`);
    }

    const afterBuy = findRowMetrics(freshSave.saveId, candidate.teamId).row;
    const freeAgentsAfterBuy = listLocalTransfermarktFreeAgents({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      limit: 250,
    });
    const historyAfterBuy = listLocalTransferHistory({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      limit: 20,
    });

    if (freeAgentsAfterBuy.items.some((item) => item.playerId === candidate.playerId)) {
      throw new Error(`Bought player ${candidate.playerName} is still visible in local free agents.`);
    }
    if (afterBuy.rosterCount !== before.rosterCount + 1) {
      throw new Error(`Roster count did not increase after buy for ${candidate.teamId}.`);
    }
    if (afterBuy.cash !== (before.cash ?? 0) - requireValue(buyPreview.purchasePrice, "Missing buy purchase price.")) {
      throw new Error(`Cash did not decrease correctly after buy for ${candidate.teamId}.`);
    }
    if (
      afterBuy.salaryTotal !==
      before.salaryTotal + requireValue(buyPreview.salary, "Missing buy salary.")
    ) {
      throw new Error(`Salary total did not increase correctly after buy for ${candidate.teamId}.`);
    }
    if (
      afterBuy.marketValueTotal !==
      (before.marketValueTotal ?? 0) + requireValue(buyPreview.purchasePrice, "Missing buy market value.")
    ) {
      throw new Error(`Market value total did not increase correctly after buy for ${candidate.teamId}.`);
    }
    if (!historyAfterBuy.items.some((entry) => entry.type === "buy" && entry.playerId === candidate.playerId)) {
      throw new Error(`Buy transfer history entry is missing for ${candidate.playerName}.`);
    }

    const postBuySave = persistence.getSaveById(freshSave.saveId);
    const boughtRosterEntry = postBuySave?.gameState.rosters.find(
      (entry) => entry.teamId === candidate.teamId && entry.playerId === candidate.playerId,
    );
    if (!boughtRosterEntry) {
      throw new Error(`Bought roster entry could not be found for ${candidate.playerName}.`);
    }

    const sellPreview = previewLocalTransfermarktSell({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      activePlayerId: boughtRosterEntry.id,
    });
    if (!sellPreview.canSell) {
      throw new Error(`Smoke sell unexpectedly blocked: ${sellPreview.blockingReasons.join(", ") || "unknown"}`);
    }

    const sellResult = executeLocalTransfermarktSell({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      activePlayerId: boughtRosterEntry.id,
    });

    if (!sellResult.canSell || !sellResult.activePlayerRemoved || !sellResult.transferCreated) {
      throw new Error(`Smoke sell failed for ${candidate.playerName} -> ${candidate.teamId}.`);
    }

    const afterSell = findRowMetrics(freshSave.saveId, candidate.teamId).row;
    const freeAgentsAfterSell = listLocalTransfermarktFreeAgents({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      limit: 250,
    });
    const historyAfterSell = listLocalTransferHistory({
      saveId: freshSave.saveId,
      seasonId,
      teamId: candidate.teamId,
      limit: 20,
    });

    if (!freeAgentsAfterSell.items.some((item) => item.playerId === candidate.playerId)) {
      throw new Error(`Sold player ${candidate.playerName} did not return to local free agents.`);
    }
    if (afterSell.rosterCount !== before.rosterCount) {
      throw new Error(`Roster count did not return after sell for ${candidate.teamId}.`);
    }
    if (afterSell.cash !== before.cash) {
      throw new Error(`Cash did not return after buy+sell loop for ${candidate.teamId}.`);
    }
    if (afterSell.salaryTotal !== before.salaryTotal) {
      throw new Error(`Salary total did not return after buy+sell loop for ${candidate.teamId}.`);
    }
    if (afterSell.marketValueTotal !== before.marketValueTotal) {
      throw new Error(`Market value total did not return after buy+sell loop for ${candidate.teamId}.`);
    }
    if (!historyAfterSell.items.some((entry) => entry.type === "sell" && entry.playerId === candidate.playerId)) {
      throw new Error(`Sell transfer history entry is missing for ${candidate.playerName}.`);
    }

    const prismaAfter = await loadFoundationSnapshotFromPrisma("save-initial");
    const prismaAfterTransferCount = prismaAfter?.teamSeasonStates.length ?? null;
    const prismaAfterActivePlayers = prismaAfter?.activePlayers.length ?? null;

    if (prismaBeforeTransferCount !== prismaAfterTransferCount || prismaBeforeActivePlayers !== prismaAfterActivePlayers) {
      throw new Error("Prisma reference snapshot changed during local smoke loop.");
    }

    console.log("Season management smoke loop");
    console.log(`saveId: ${freshSave.saveId}`);
    console.log(`smokeTeam: ${candidate.teamId} (${candidate.teamName})`);
    console.log(`smokePlayer: ${candidate.playerId} (${candidate.playerName})`);
    console.log(`beforeRoster: ${before.rosterCount}`);
    console.log(`afterBuyRoster: ${afterBuy.rosterCount}`);
    console.log(`afterSellRoster: ${afterSell.rosterCount}`);
    console.log(`beforeCash: ${before.cash}`);
    console.log(`afterBuyCash: ${afterBuy.cash}`);
    console.log(`afterSellCash: ${afterSell.cash}`);
    console.log(`beforeSalary: ${before.salaryTotal}`);
    console.log(`afterBuySalary: ${afterBuy.salaryTotal}`);
    console.log(`afterSellSalary: ${afterSell.salaryTotal}`);
    console.log(`beforeMW: ${before.marketValueTotal}`);
    console.log(`afterBuyMW: ${afterBuy.marketValueTotal}`);
    console.log(`afterSellMW: ${afterSell.marketValueTotal}`);
    console.log(`avgContract: ${roundValue(afterSell.avgContractLength ?? 0, 1).toFixed(1)}`);
    console.log("prismaUnchanged: yes");
  } finally {
    if (previousActiveSave?.saveId) {
      persistence.activateSave(previousActiveSave.saveId);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
