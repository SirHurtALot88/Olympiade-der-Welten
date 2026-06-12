import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  runMatchdayMvpScoring,
} from "@/lib/season/matchday-mvp-scoring-service";

function createInMemoryPersistence(gameState: GameState, cloneOnRead = false): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return {
        save: cloneOnRead ? structuredClone(save) : save,
        createdFromSeed: false,
      };
    },
    getActiveSave() {
      return cloneOnRead ? structuredClone(save) : save;
    },
    getSaveById(saveId) {
      if (saveId !== save.saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (saveId !== save.saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      save = {
        ...save,
        updatedAt: "2026-06-07T00:00:01.000Z",
        gameState: structuredClone(nextGameState),
      };
      return cloneOnRead ? structuredClone(save) : save;
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(saveId) {
      if (saveId !== save.saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    listSaves() {
      return [
        {
          saveId: save.saveId,
          name: save.name,
          status: save.status,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
        },
      ];
    },
  };
}

function topUpRostersForLineupMinimum(gameState: GameState, saveId = "test-save") {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext(
    {
      saveId,
      seasonId: gameState.season.id,
      matchdayId: gameState.season.matchdayIds[0]!,
      teamId: gameState.teams[0]!.teamId,
    },
    persistence,
  );

  if (!contextResult.ok) {
    throw new Error(contextResult.errors.join(" | "));
  }

  const requiredUniquePlayers =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);

    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up lineup test rosters.");
      }
      poolIndex += 1;
      gameState.rosters.push({
        id: `mvp-test-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 2,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
      rosterCounter += 1;
    }
  }
}

describe("matchday MVP scoring service", () => {
  it("builds 32-team D1 and D2 scoreboards with auto lineups in dry-run", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const persistence = createInMemoryPersistence(gameState, true);

    const result = await runMatchdayMvpScoring(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.season.matchdayIds[0],
        dryRun: true,
      },
      persistence,
    );

    expect(result.dryRun).toBe(true);
    expect(result.status).toBe("warning");
    expect(result.totalTeamsScored).toBe(32);
    expect(result.mutatorMode).toBe("mvp_forced_mutators");
    expect(result.resolveSources.formCardSourceStatus).toBe("ready");
    expect(result.resolveSources.mutatorSourceStatus).toBe("ready");
    expect(result.resolveSources.captainSourceStatus).toBe("missing_source");
    expect(result.d1Scoreboard).toHaveLength(32);
    expect(result.d2Scoreboard).toHaveLength(32);
    expect(result.d1Scoreboard.every((row) => row.mutator1Label && row.mutator1Modifier === 6 && row.mutator2Label && row.mutator2Modifier === 6)).toBe(true);
    expect(result.d2Scoreboard.every((row) => row.mutator1Label && row.mutator1Modifier === 6 && row.mutator2Label && row.mutator2Modifier === 6)).toBe(true);
    expect(result.d1TopPlayers).toHaveLength(10);
    expect(result.d2TopPlayers).toHaveLength(10);
    expect(result.ppWinners.some((entry) => (entry.mutatorPpsBonus ?? 0) >= 0.3)).toBe(true);
    expect(result.lineupSummary.autoGeneratedLineups).toBeGreaterThan(0);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("writes local matchday results and standings for the MVP slice", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const persistence = createInMemoryPersistence(gameState, true);

    const result = await runMatchdayMvpScoring(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.season.matchdayIds[0],
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
      },
      persistence,
    );

    const updatedSave = persistence.getSaveById("test-save");
    const points = updatedSave?.gameState.seasonState.standings ?? {};

    expect(result.executed).toBe(true);
    expect(result.status).toBe("applied");
    expect(result.d1Scoreboard.every((row) => row.mutator1Modifier === 6 && row.mutator2Modifier === 6)).toBe(true);
    expect(result.d2Scoreboard.every((row) => row.mutator1Modifier === 6 && row.mutator2Modifier === 6)).toBe(true);
    expect(result.resultApply.applied).toBe(true);
    expect(result.standingsApply.applied).toBe(true);
    expect(updatedSave?.gameState.seasonState.matchdayResults?.length ?? 0).toBeGreaterThan(0);
    expect(Object.values(points).some((entry) => typeof entry.points === "number")).toBe(true);
  }, 40_000);
});
