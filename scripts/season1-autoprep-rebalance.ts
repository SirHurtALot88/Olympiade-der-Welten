import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  listLocalTransfermarktFreeAgents,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame } from "@/lib/persistence/types";

const NEED_TEAMS = ["A-A", "B-P", "N-N", "P-S", "R-L", "S-C", "S-S", "V-V", "V-W"];
const WRITE_ENABLED = process.argv.includes("--write");
const ALLOW_NON_SEASON1 = process.argv.includes("--allow-non-season1");

function getTargetRoster(save: PersistedSaveGame, teamId: string) {
  const team = save.gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const playerMin = Number.isFinite(identity?.playerMin) ? Math.round(identity?.playerMin ?? 7) : 7;
  const playerOpt = Number.isFinite(identity?.playerOpt) ? Math.round(identity?.playerOpt ?? playerMin) : playerMin;
  const rosterLimit = Number.isFinite(team?.rosterLimit) ? Math.round(team?.rosterLimit ?? 12) : 12;
  return Math.min(Math.max(playerOpt, playerMin), rosterLimit, 12);
}

function getSave(saveId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} not found.`);
  return save;
}

function buyCheapest(saveId: string, teamId: string) {
  const save = getSave(saveId);
  const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) throw new Error(`Team ${teamId} not found.`);
  const feed = listLocalTransfermarktFreeAgents({
    saveId,
    seasonId: save.gameState.season.id,
    teamId,
    limit: 5000,
  });
  const candidate = feed.items
    .filter((item) => item.marketValue != null && item.marketValue > 0 && item.marketValue <= team.cash)
    .sort((left, right) => (left.marketValue ?? Infinity) - (right.marketValue ?? Infinity) || (right.ovr ?? 0) - (left.ovr ?? 0))[0];
  if (!candidate) return null;
  if (!WRITE_ENABLED) {
    return {
      action: "buy",
      teamId,
      playerId: candidate.playerId,
      playerName: candidate.name,
      fee: candidate.marketValue,
      cashAfter: team.cash - (candidate.marketValue ?? 0),
      rosterAfter: save.gameState.rosters.filter((entry) => entry.teamId === teamId).length + 1,
    };
  }
  const result = executeLocalTransfermarktBuy({
    saveId,
    seasonId: save.gameState.season.id,
    teamId,
    playerId: candidate.playerId,
    contractLength: 1,
    transferSource: "season1_autoprep_topup",
  });
  if (!result.canBuy) {
    return null;
  }
  return {
    action: "buy",
    teamId,
    playerId: candidate.playerId,
    playerName: candidate.name,
    fee: result.purchasePrice,
    cashAfter: result.cashAfter,
    rosterAfter: result.rosterAfter,
  };
}

function sellMostValuable(saveId: string, teamId: string) {
  const save = getSave(saveId);
  const playersById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const roster = save.gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId),
      value: entry.currentValue ?? entry.purchasePrice ?? playersById.get(entry.playerId)?.marketValue ?? 0,
    }))
    .filter((entry) => Boolean(entry.player))
    .sort((left, right) => right.value - left.value);
  const candidate = roster[0];
  if (!candidate) return null;
  if (!WRITE_ENABLED) {
    const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
    return {
      action: "sell",
      teamId,
      playerId: candidate.entry.playerId,
      playerName: candidate.player?.name ?? candidate.entry.playerId,
      fee: candidate.value,
      cashAfter: (team?.cash ?? 0) + candidate.value,
      rosterAfter: roster.length - 1,
    };
  }
  const result = executeLocalTransfermarktSell({
    saveId,
    seasonId: save.gameState.season.id,
    teamId,
    activePlayerId: candidate.entry.id,
  });
  if (!result.canSell) {
    return null;
  }
  return {
    action: "sell",
    teamId,
    playerId: candidate.entry.playerId,
    playerName: candidate.player?.name ?? candidate.entry.playerId,
    fee: result.salePrice,
    cashAfter: result.cashAfter,
    rosterAfter: result.rosterAfter,
  };
}

function main() {
  const persistence = createPersistenceService();
  const active = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  if (!active) throw new Error("No active save.");
  if (active.gameState.season.id !== "season-1" && !ALLOW_NON_SEASON1) {
    throw new Error(
      `season1-autoprep-rebalance is limited to season-1 saves. Active season is ${active.gameState.season.id}; pass --allow-non-season1 only for an explicit sandbox repair.`,
    );
  }
  const actions: unknown[] = [];
  const blockers: string[] = [];

  for (const teamId of NEED_TEAMS) {
    let guard = 0;
    while (guard < 8) {
      guard += 1;
      const save = getSave(active.saveId);
      const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
      if (rosterCount >= getTargetRoster(save, teamId)) break;
      const buy = buyCheapest(active.saveId, teamId);
      if (buy) {
        actions.push(buy);
        if (!WRITE_ENABLED) break;
        continue;
      }
      const sell = sellMostValuable(active.saveId, teamId);
      if (sell) {
        actions.push(sell);
        if (!WRITE_ENABLED) break;
        continue;
      }
      blockers.push(`rebalance_blocked:${teamId}:roster_${rosterCount}`);
      break;
    }
  }

  console.log(JSON.stringify({
    saveId: active.saveId,
    dryRun: !WRITE_ENABLED,
    actions,
    actionCount: actions.length,
    blockers,
  }, null, 2));

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
