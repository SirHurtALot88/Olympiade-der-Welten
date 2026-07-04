/**
 * Ad-hoc profiling harness for the player profile cold-path.
 *
 * Times each stage of opening a player profile against the live active save:
 * getSaveById (twice, to see cache effect), buildPlayerDrawerDataFromGameState,
 * and the individual rank-map builders inside it.
 *
 * Usage:
 *   npx tsx scripts/profile-player-drawer.ts [--player-id <id>]
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
loadEnvConfig(PROJECT_ROOT);

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const { createSaveRepository } = await import("@/lib/persistence/save-repository");
  const repo = createSaveRepository();

  console.time("getActiveSave#1 (cold, direct repo)");
  const save1 = repo.getActiveSave();
  console.timeEnd("getActiveSave#1 (cold, direct repo)");
  if (!save1) throw new Error("No active save found.");

  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const persistence = createPersistenceService();

  console.time("getActiveSave#2 (warm)");
  const save2 = persistence.getActiveSave();
  console.timeEnd("getActiveSave#2 (warm)");

  const gameState = save2!.gameState;
  console.log(`players=${gameState.players.length} disciplines=${gameState.disciplines.length} rosters=${gameState.rosters.length} snapshots=${gameState.seasonState.seasonSnapshots?.length ?? 0}`);

  const playerId = argValue("--player-id") ?? gameState.players[0]?.id;
  if (!playerId) throw new Error("No player found in save.");
  console.log(`playerId=${playerId}`);

  const { buildPlayerDrawerDataFromGameState } = await import("@/lib/foundation/player-detail-drawer");
  const { getSeasonDerivations } = await import("@/lib/foundation/get-season-derivations");
  const { buildPlayerEconomyCompareMap } = await import("@/lib/foundation/player-economy-compare-service");

  console.time("getSeasonDerivations#1 (cold)");
  getSeasonDerivations({ gameState, saveId: `local:${gameState.season.id}` });
  console.timeEnd("getSeasonDerivations#1 (cold)");

  console.time("getSeasonDerivations#2 (warm)");
  getSeasonDerivations({ gameState, saveId: `local:${gameState.season.id}` });
  console.timeEnd("getSeasonDerivations#2 (warm)");

  console.time("buildPlayerEconomyCompareMap");
  buildPlayerEconomyCompareMap({ gameState });
  console.timeEnd("buildPlayerEconomyCompareMap");

  console.time("buildPlayerDrawerDataFromGameState#1 (cold)");
  buildPlayerDrawerDataFromGameState({
    gameState,
    playerId,
    source: "sqlite",
    activePlayerId: null,
    manageableTeamIds: null,
    saveId: save2!.saveId,
  });
  console.timeEnd("buildPlayerDrawerDataFromGameState#1 (cold)");

  console.time("buildPlayerDrawerDataFromGameState#2 (warm, same player)");
  buildPlayerDrawerDataFromGameState({
    gameState,
    playerId,
    source: "sqlite",
    activePlayerId: null,
    manageableTeamIds: null,
    saveId: save2!.saveId,
  });
  console.timeEnd("buildPlayerDrawerDataFromGameState#2 (warm, same player)");

  const secondPlayerId = gameState.players[1]?.id;
  if (secondPlayerId) {
    console.time("buildPlayerDrawerDataFromGameState#3 (different player)");
    buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: secondPlayerId,
      source: "sqlite",
      activePlayerId: null,
      manageableTeamIds: null,
      saveId: save2!.saveId,
    });
    console.timeEnd("buildPlayerDrawerDataFromGameState#3 (different player)");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
