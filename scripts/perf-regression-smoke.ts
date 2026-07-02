import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildGameStateContentSignature,
  getSeasonDerivations,
} from "@/lib/foundation/get-season-derivations";
import { invalidateSeasonDerivationsCache } from "@/lib/foundation/season-derivations-cache";
import { listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildSeasonEndProgressionPreview } from "@/lib/training/season-end-progression-preview";

const VERSION_BUDGET_MS = 250;
const DERIVATIONS_HIT_BUDGET_MS = 50;
const TRAINING_BUILD_BUDGET_MS = 3500;
const FREE_AGENT_WARM_HIT_BUDGET_MS = 500;
const FREE_AGENT_COLD_BUILD_BUDGET_MS = 5000;

async function main() {
  const persistence = createPersistenceService();
  const active = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const versionStartedAt = performance.now();
  const versionMeta = persistence.getSaveVersionMetadata(active.saveId);
  const versionElapsedMs = performance.now() - versionStartedAt;

  if (!versionMeta) {
    throw new Error("Version metadata could not be loaded.");
  }

  if (versionElapsedMs > VERSION_BUDGET_MS) {
    throw new Error(`Version metadata load exceeded budget: ${Math.round(versionElapsedMs)}ms > ${VERSION_BUDGET_MS}ms`);
  }

  const contentSignature =
    versionMeta.contentSignature ?? buildGameStateContentSignature(active.gameState);
  invalidateSeasonDerivationsCache(active.saveId);
  getSeasonDerivations({
    gameState: active.gameState,
    saveId: active.saveId,
    contentSignature,
  });

  const hitStartedAt = performance.now();
  getSeasonDerivations({
    gameState: active.gameState,
    saveId: active.saveId,
    contentSignature,
  });
  const derivationsHitMs = performance.now() - hitStartedAt;

  if (derivationsHitMs > DERIVATIONS_HIT_BUDGET_MS) {
    throw new Error(
      `Season derivations cache hit exceeded budget: ${Math.round(derivationsHitMs)}ms > ${DERIVATIONS_HIT_BUDGET_MS}ms`,
    );
  }

  const team =
    active.gameState.teams.find((entry) => entry.humanControlled) ?? active.gameState.teams[0] ?? null;
  if (!team) {
    throw new Error("No team found for perf smoke.");
  }

  listLocalTransfermarktFreeAgents({
    saveId: active.saveId,
    seasonId: active.gameState.season.id,
    teamId: team.teamId,
    limit: 250,
  });
  listLocalTransfermarktFreeAgents({
    saveId: active.saveId,
    seasonId: active.gameState.season.id,
    teamId: team.teamId,
    limit: 250,
  });

  const freeAgentStartedAt = performance.now();
  const freeAgentFeed = listLocalTransfermarktFreeAgents({
    saveId: active.saveId,
    seasonId: active.gameState.season.id,
    teamId: team.teamId,
    limit: 250,
  });
  const freeAgentFeedMs = performance.now() - freeAgentStartedAt;

  if (freeAgentFeedMs > FREE_AGENT_WARM_HIT_BUDGET_MS) {
    throw new Error(
      `Transfermarkt free-agent warm cache hit exceeded budget: ${Math.round(freeAgentFeedMs)}ms > ${FREE_AGENT_WARM_HIT_BUDGET_MS}ms`,
    );
  }

  const { invalidateLocalTransfermarktCachesForSave } = await import("@/lib/market/transfermarkt-local-service");
  invalidateLocalTransfermarktCachesForSave(active.saveId);
  const freeAgentColdStartedAt = performance.now();
  const freeAgentCold = listLocalTransfermarktFreeAgents({
    saveId: active.saveId,
    seasonId: active.gameState.season.id,
    teamId: team.teamId,
    limit: 1,
  });
  const freeAgentColdMs = performance.now() - freeAgentColdStartedAt;
  void freeAgentCold;

  if (freeAgentColdMs > FREE_AGENT_COLD_BUILD_BUDGET_MS) {
    console.warn(
      `Transfermarkt free-agent cold build above interim budget: ${Math.round(freeAgentColdMs)}ms > ${FREE_AGENT_COLD_BUILD_BUDGET_MS}ms`,
    );
  }

  const trainingStartedAt = performance.now();
  const rosterPlayers = active.gameState.rosters
    .filter((entry) => entry.teamId === team.teamId)
    .map((entry) => active.gameState.players.find((playerEntry) => playerEntry.id === entry.playerId))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const forecastsByPlayerId = new Map(
    rosterPlayers.map((player) => [
      player.id,
      buildPlayerProgressionForecast({
        gameState: active.gameState,
        player,
        playerRating: null,
        seasonPerformance: null,
        trainingModeByPlayerId: {},
        currentXP: player.currentXP ?? 0,
        spentXP: player.spentXP ?? 0,
        lifetimeXP: player.lifetimeXP ?? null,
      }),
    ] as const),
  );
  const trainingPreview = buildSeasonEndProgressionPreview({
    gameState: active.gameState,
    forecastsByPlayerId,
  });
  const trainingBuildMs = performance.now() - trainingStartedAt;

  if (trainingBuildMs > TRAINING_BUILD_BUDGET_MS) {
    throw new Error(`Training page build exceeded budget: ${Math.round(trainingBuildMs)}ms > ${TRAINING_BUILD_BUDGET_MS}ms`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      saveId: versionMeta.saveId,
      versionElapsedMs: Math.round(versionElapsedMs),
      derivationsHitMs: Math.round(derivationsHitMs),
      freeAgentColdMs: Math.round(freeAgentColdMs),
      freeAgentFeedMs: Math.round(freeAgentFeedMs),
      freeAgentCount: freeAgentFeed.items.length,
      trainingBuildMs: Math.round(trainingBuildMs),
      trainingRowCount: trainingPreview.rows.length,
      saveVersion: versionMeta.saveVersion,
      lineupDraftCount: versionMeta.lineupDraftCount,
    }),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
