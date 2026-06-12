import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function createInMemoryPersistence(gameState: GameState, cloneOnRead = false): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
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
      if (save.saveId !== saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      save = {
        ...save,
        updatedAt: "2026-06-06T00:00:01.000Z",
        gameState: structuredClone(nextGameState),
      };
      return save;
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
      if (save.saveId !== saveId) {
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
  const contextResult = loadLocalLegacyLineupContext({
    saveId,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    teamId: gameState.teams[0]!.teamId,
  }, persistence);

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
        id: `test-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
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

describe("matchday auto-run manual-team policy", () => {
  it("blocks clearly when manual or passive teams have no saved lineup and keeps them out of AI apply", async () => {
    const gameState = createFreshSeasonOneGameState();
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};

    gameState.seasonState.teamControlSettings = {
      ...existingSettings,
      "B-B": {
        ...existingSettings["B-B"],
        teamId: "B-B",
        controlMode: "manual",
        aiLineupApplyEnabled: false,
      },
      "O-S": {
        ...existingSettings["O-S"],
        teamId: "O-S",
        controlMode: "passive",
        aiLineupApplyEnabled: false,
      },
      "D-L": {
        ...existingSettings["D-L"],
        teamId: "D-L",
        controlMode: "ai",
        aiLineupApplyEnabled: true,
      },
    };

    const persistence = createInMemoryPersistence(gameState);
    const result = await runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        dryRun: true,
        options: {
          includeWarningLineups: false,
          overwriteExistingLineups: false,
          stopOnTie: true,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.summary.manualReady).toBe(0);
    expect(result.summary.manualMissing).toBe(1);
    expect(result.summary.missingManualTeams).toBe(1);
    expect(result.summary.passiveReady).toBe(0);
    expect(result.summary.passiveMissing).toBeGreaterThanOrEqual(0);
    expect(result.blockingReasons).toContain("missing_manual_lineup");
    expect(result.blockingReasons).toContain("resolve_status:missing_lineups");

    const aiLineupStep = result.steps.find((step) => step.key === "ai_lineups");
    const resolveStep = result.steps.find((step) => step.key === "resolve_preview");

    expect(aiLineupStep?.metrics.skippedManual).toBe(1);
    expect(Number(aiLineupStep?.metrics.skippedPassive ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.metrics.manualMissing).toBe(1);
    expect(Number(resolveStep?.metrics.passiveMissing ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.blockingReasons).toContain("missing_manual_lineup");
  });

  it("uses the persisted post-AI snapshot for execute mode so resolve preview sees saved AI lineups", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};

    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );

    const persistence = createInMemoryPersistence(gameState, true);
    const result = await runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: true,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    const resolveStep = result.steps.find((step) => step.key === "resolve_preview");
    const prizeStep = result.steps.find((step) => step.key === "prize_preview");
    const cashStep = result.steps.find((step) => step.key === "cash_apply");
    const advanceStep = result.steps.find((step) => step.key === "matchday_advance");

    expect(resolveStep?.metrics.usedHypotheticalAiLineups).toBe(false);
    expect(resolveStep?.metrics.previewStatus).not.toBe("missing_lineups");
    expect(resolveStep?.metrics.teamsMissingLineup).toBe(0);
    expect(result.summary.lineupsReady).toBe(32);
    expect(result.summary.aiReady).toBe(32);
    expect(result.summary.cashApplyAllowed).toBe(false);
    expect(result.summary.advanceAllowed).toBe(false);
    expect(result.appliedAudits.cashApply).toBeNull();
    expect(result.appliedAudits.matchdayAdvance).toBeNull();
    expect(prizeStep).toBeUndefined();
    expect(cashStep).toBeUndefined();
    expect(advanceStep).toBeUndefined();
  }, 40_000);
});
