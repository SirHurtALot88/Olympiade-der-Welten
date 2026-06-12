import { beforeEach, describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";

describe("season start reset service", () => {
  beforeEach(() => {
    resetDatabaseForTests();
  });

  it("previews a hard reset against the current save without mutating it", async () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({
      saveId: "fresh-season-1-reset-preview",
      name: "Reset Preview",
    });
    const baseline = createFreshSeasonOneGameState();
    const player = baseline.players[0];
    const team = baseline.teams[0];

    baseline.teams[0] = {
      ...team,
      cash: team.cash - 25,
    };
    baseline.rosters = [
      {
        id: "roster-reset-1",
        teamId: team.teamId,
        playerId: player.id,
        contractYears: 2,
        salary: 3,
        purchasePrice: 15,
        acquiredAt: new Date().toISOString(),
        currentValue: 15,
        status: "starter",
      },
    ];
    baseline.transferHistory = [
      {
        id: "history-reset-1",
        playerId: player.id,
        playerName: player.name,
        seasonId: baseline.season.id,
        matchdayId: null,
        happenedAt: new Date().toISOString(),
        transferType: "buy",
        fromTeamId: null,
        toTeamId: team.teamId,
        fee: 15,
        salary: 3,
        contractLength: 2,
        source: "manual_buy",
        phase: "manual_window",
      },
    ];
    baseline.seasonState.matchdayResults = [
      {
        matchdayId: "matchday-1",
        discipline1: {
          disciplineId: "mini-dm",
          teamResults: [],
        },
        discipline2: {
          disciplineId: "fechten",
          teamResults: [],
        },
        createdAt: new Date().toISOString(),
      },
    ];

    persistence.saveSingleplayerState(save.saveId, baseline);

    const result = await runSeasonStartReset({
      saveId: save.saveId,
      seasonId: baseline.season.id,
      dryRun: true,
    });

    expect(result.executed).toBe(false);
    expect(result.summary.currentTransfers).toBe(1);
    expect(result.summary.currentRosterEntries).toBe(1);
    expect(result.summary.resetTransfers).toBe(0);
    expect(result.summary.resetRosterEntries).toBe(0);
    expect(result.teams.find((entry) => entry.teamId === team.teamId)).toMatchObject({
      currentRosterCount: 1,
      resetRosterCount: 0,
      currentTransferCount: 1,
      currentCash: team.cash - 25,
      resetCash: team.cash,
    });

    const afterPreview = persistence.getSaveById(save.saveId);
    expect(afterPreview?.gameState.transferHistory).toHaveLength(1);
    expect(afterPreview?.gameState.rosters).toHaveLength(1);
  });

  it("replaces the current save state with a clean season-start basis on execute", async () => {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({
      saveId: "fresh-season-1-reset-execute",
      name: "Reset Execute",
    });
    const baseline = createFreshSeasonOneGameState();
    const player = baseline.players[0];
    const team = baseline.teams[0];

    baseline.teams[0] = {
      ...team,
      cash: team.cash - 40,
    };
    baseline.rosters = [
      {
        id: "roster-reset-2",
        teamId: team.teamId,
        playerId: player.id,
        contractYears: 3,
        salary: 5,
        purchasePrice: 20,
        acquiredAt: new Date().toISOString(),
        currentValue: 20,
        status: "starter",
      },
    ];
    baseline.transferHistory = [
      {
        id: "history-reset-2",
        playerId: player.id,
        playerName: player.name,
        seasonId: baseline.season.id,
        matchdayId: null,
        happenedAt: new Date().toISOString(),
        transferType: "buy",
        fromTeamId: null,
        toTeamId: team.teamId,
        fee: 20,
        salary: 5,
        contractLength: 3,
        source: "ai_buy",
        phase: "ai_window",
      },
    ];
    persistence.saveSingleplayerState(save.saveId, baseline);

    const result = await runSeasonStartReset({
      saveId: save.saveId,
      seasonId: baseline.season.id,
      dryRun: false,
      confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe("applied");

    const resetSave = persistence.getSaveById(save.saveId);
    expect(resetSave).not.toBeNull();
    expect(resetSave?.gameState.transferHistory).toHaveLength(0);
    expect(resetSave?.gameState.rosters).toHaveLength(0);
    expect(resetSave?.gameState.seasonState.matchdayResults ?? []).toHaveLength(0);
    expect(resetSave?.gameState.teams.find((entry) => entry.teamId === team.teamId)?.cash).toBe(team.cash);
  });
});
