import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { runWholeSeasonDryRun } from "@/lib/season/whole-season-dryrun-service";
import type { PersistenceService } from "@/lib/persistence/types";

function createTestPersistence(gameState = createFreshSeasonOneGameState()): PersistenceService & { state: { gameState: typeof gameState } } {
  const state = {
    gameState: structuredClone(gameState),
  };

  return {
    state,
    bootstrapSingleplayerSave() {
      return {
        save: {
          saveId: "test-save",
          name: "Test Save",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          gameState: structuredClone(state.gameState),
        },
        createdFromSeed: false,
      };
    },
    getActiveSave() {
      return {
        saveId: "test-save",
        name: "Test Save",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        gameState: structuredClone(state.gameState),
      };
    },
    getSaveById(saveId) {
      if (saveId !== "test-save") return null;
      return {
        saveId: "test-save",
        name: "Test Save",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        gameState: structuredClone(state.gameState),
      };
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (saveId !== "test-save") {
        throw new Error(`Unknown save ${saveId}`);
      }
      state.gameState = structuredClone(nextGameState);
      return this.getActiveSave()!;
    },
    createSave() {
      throw new Error("not needed in test");
    },
    createFreshSeasonOneSave() {
      throw new Error("not needed in test");
    },
    cloneSave() {
      throw new Error("not needed in test");
    },
    activateSave(saveId) {
      return saveId === "test-save" ? this.getActiveSave() : null;
    },
    listSaves() {
      return [
        {
          saveId: "test-save",
          name: "Test Save",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
    },
  };
}

function topUpRostersForSeasonMaximum(
  persistence: ReturnType<typeof createTestPersistence>,
  saveId = "test-save",
) {
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Expected save ${saveId} for season top-up test helper.`);
  }

  let maxRequiredUniquePlayers = 0;
  for (const matchdayId of save.gameState.season.matchdayIds) {
    const scheduleEntry = save.gameState.seasonState.disciplineSchedule?.find((entry) => entry.matchdayId === matchdayId);
    if (!scheduleEntry) {
      throw new Error(`Expected discipline schedule for ${matchdayId}.`);
    }

    const discipline1 = save.gameState.disciplines.find((entry) => entry.id === scheduleEntry.discipline1.disciplineId);
    const discipline2 = save.gameState.disciplines.find((entry) => entry.id === scheduleEntry.discipline2.disciplineId);
    if (!discipline1 || !discipline2) {
      throw new Error(`Expected mapped disciplines for ${matchdayId}.`);
    }

    const requiredUniquePlayers = (discipline1.playerCount ?? 0) + (discipline2.playerCount ?? 0);
    maxRequiredUniquePlayers = Math.max(maxRequiredUniquePlayers, requiredUniquePlayers);
  }

  const nextGameState = structuredClone(persistence.state.gameState);
  const usedPlayerIds = new Set(nextGameState.rosters.map((entry) => entry.playerId));
  const freePlayers = nextGameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = nextGameState.rosters.length;

  for (const team of nextGameState.teams) {
    const teamRoster = nextGameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, maxRequiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up whole season test rosters.");
      }
      poolIndex += 1;
      nextGameState.rosters.push({
        id: `whole-season-test-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: nextGameState.season.id,
      });
      rosterCounter += 1;
    }
  }

  persistence.saveSingleplayerState(saveId, nextGameState);
}

describe("runWholeSeasonDryRun", () => {
  it("blocks prisma immediately", async () => {
    const result = await runWholeSeasonDryRun({
      source: "prisma",
      saveId: "test-save",
      seasonId: "season-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockingReasons[0]).toContain("read-only");
    expect(result.snapshotReadiness.status).toBe("blocked");
    expect(result.playerPPsReconciliation.status).toBe("missing_source");
    expect(result.teamPPsReconciliation.status).toBe("missing_source");
  });

  it("keeps the real local save untouched because the full season runs on an isolated in-memory copy", async () => {
    const persistence = createTestPersistence();
    const before = structuredClone(persistence.state.gameState);

    const result = await runWholeSeasonDryRun(
      {
        source: "sqlite",
        saveId: "test-save",
        seasonId: before.season.id,
      },
      persistence,
    );

    expect(result.dryRun).toBe(true);
    expect(result.simulationMode).toBe("in_memory_local_copy");
    expect(result.matchdays.length).toBeGreaterThan(0);
    expect(result.marketPhaseStatus.status).toBe("policy_missing");
    expect(result.warnings).toContain("market_phase_policy_missing");
    expect(Array.isArray(result.missingFormulaSources)).toBe(true);
    expect(Array.isArray(result.missingPerformanceSources)).toBe(true);
    expect(result.snapshotReadiness.totalMatchdays).toBe(before.season.matchdayIds.length);
    expect(result.playerPPsReconciliation.status).toBe("missing_source");
    expect(result.teamPPsReconciliation.status).toBe("missing_source");
    expect(result.skippedDisabledAiTeams).toBe(before.teams.length);
    expect(result.missingAiLineups).toBe(0);
    expect(result.blockingReasons).toContain("ai_lineup_apply_disabled");
    expect(persistence.state.gameState).toEqual(before);
  }, 20_000);

  it("supports capped simulation runs and reports the read-only dryrun contract", async () => {
    const persistence = createTestPersistence();

    const result = await runWholeSeasonDryRun(
      {
        source: "sqlite",
        saveId: "test-save",
        seasonId: "season-1",
        maxMatchdays: 1,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: true,
          stopOnMissingManualLineups: true,
          advanceAfterEachMatchday: true,
          includeMarketPhase: false,
        },
      },
      persistence,
    );

    expect(result.readOnly).toBe(true);
    expect(result.scope.maxMatchdays).toBe(1);
    expect(result.stepsByMatchday).toEqual(result.matchdays);
    expect(result.teamSummaries).toEqual(result.projectedTeamSummaries);
    expect(result.projectedCashTable).toEqual(result.projectedCash);
    expect(result.missingLineups).toBe(result.missingManualLineups);
    expect(result.marketPhaseStatus.warning).toBe("market_phase_policy_missing");
    expect(result.snapshotReadiness.status).toMatch(/ready|warning|blocked/);
    expect(result.playerPPsReconciliation.totalPlayerPoints).toBeGreaterThanOrEqual(0);
    expect(result.teamPPsReconciliation.totalTeamPoints).toBeGreaterThanOrEqual(0);
    expect(result.simulatedMatchdays).toBeLessThanOrEqual(1);
  });

  it("reaches matchday 2 without captain-limit or lineup-scope regressions when AI teams are enabled and rosters cover the whole season", async () => {
    const persistence = createTestPersistence();
    topUpRostersForSeasonMaximum(persistence);

    const current = persistence.getActiveSave();
    if (!current) {
      throw new Error("Expected active save for season whole-dryrun test.");
    }

    current.gameState.seasonState.teamControlSettings = Object.fromEntries(
      current.gameState.teams.map((team) => [
        team.teamId,
        {
          teamId: team.teamId,
          controlMode: "ai" as const,
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
    persistence.saveSingleplayerState("test-save", current.gameState);

    const before = structuredClone(persistence.state.gameState);
    const result = await runWholeSeasonDryRun(
      {
        source: "sqlite",
        saveId: "test-save",
        seasonId: before.season.id,
        maxMatchdays: 2,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: false,
          stopOnMissingManualLineups: true,
          advanceAfterEachMatchday: true,
          includeMarketPhase: false,
        },
      },
      persistence,
    );

    expect(result.matchdays).toHaveLength(2);
    expect(result.matchdays[0]?.status).toBe("applied");
    expect(result.matchdays[1]?.status).toBe("applied");
    expect(result.blockedAtMatchday).toBeNull();
    expect(result.blockingReasons).not.toContain(expect.stringContaining("Season captain limit"));
    expect(result.blockingReasons).not.toContain("resolve_status:incomplete_lineups");
    expect(result.missingAiLineups).toBe(0);
    expect(result.skippedDisabledAiTeams).toBe(0);
    expect(result.simulatedMatchdays).toBe(2);
    expect(persistence.state.gameState).toEqual(before);
  }, 90_000);
});
