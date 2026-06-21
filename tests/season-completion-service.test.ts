import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";

function createPersistence(gameState: GameState): PersistenceService & { getState: () => GameState } {
  let save: PersistedSaveGame = {
    saveId: "season-completion-test-save",
    name: "Season Completion Test",
    status: "active",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    getState() {
      return structuredClone(save.gameState);
    },
    bootstrapSingleplayerSave() {
      return { save: structuredClone(save), createdFromSeed: false };
    },
    getActiveSave() {
      return structuredClone(save);
    },
    getSaveById(saveId) {
      return saveId === save.saveId ? structuredClone(save) : null;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (saveId !== save.saveId) throw new Error(`Unknown save ${saveId}`);
      save = {
        ...save,
        updatedAt: "2026-06-20T00:01:00.000Z",
        gameState: structuredClone(nextGameState),
      };
      return structuredClone(save);
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
      return saveId === save.saveId ? structuredClone(save) : null;
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

function createCompletedSeasonState() {
  const gameState = createFreshSeasonOneGameState();
  const seasonId = gameState.season.id;
  const lastMatchdayId = gameState.season.matchdayIds[gameState.season.matchdayIds.length - 1]!;

  gameState.season.currentMatchday = gameState.season.matchdayIds.length;
  gameState.gamePhase = "season_completed";
  gameState.matchdayState = {
    matchdayId: lastMatchdayId,
    status: "resolved",
    pendingTeamIds: [],
    resolvedFixtureIds: [],
  };
  gameState.seasonState.matchdayResults = gameState.season.matchdayIds.map((matchdayId, index) => ({
    id: `completion-result-${matchdayId}`,
    saveId: "season-completion-test-save",
    seasonId,
    matchdayId,
    status: "preview_applied",
    sourceVersion: "test",
    teamsTotal: gameState.teams.length,
    teamsReady: gameState.teams.length,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: `2026-06-20T00:${String(index).padStart(2, "0")}:00.000Z`,
    updatedAt: `2026-06-20T00:${String(index).padStart(2, "0")}:00.000Z`,
  }));
  gameState.seasonState.disciplineResults = [
    ...(gameState.seasonState.disciplineResults ?? []),
    {
      id: "completion-dr-r-r",
      matchdayResultId: `completion-result-${lastMatchdayId}`,
      teamId: "R-R",
      disciplineId: "basketball",
      disciplineSide: "d1",
      rank: 2,
      baseScore: 80,
      totalScore: 80,
      readinessStatus: "ready",
      warnings: [],
      createdAt: "2026-06-20T00:55:00.000Z",
    },
    {
      id: "completion-dr-n-w",
      matchdayResultId: `completion-result-${lastMatchdayId}`,
      teamId: "N-W",
      disciplineId: "basketball",
      disciplineSide: "d1",
      rank: 3,
      baseScore: 75,
      totalScore: 75,
      readinessStatus: "ready",
      warnings: [],
      createdAt: "2026-06-20T00:55:00.000Z",
    },
    {
      id: "completion-dr-p-c",
      matchdayResultId: `completion-result-${lastMatchdayId}`,
      teamId: "P-C",
      disciplineId: "basketball",
      disciplineSide: "d1",
      rank: 1,
      baseScore: 100,
      totalScore: 100,
      readinessStatus: "ready",
      warnings: [],
      createdAt: "2026-06-20T00:55:00.000Z",
    },
  ];
  gameState.seasonState.standingsApplyLogs = gameState.season.matchdayIds.map((matchdayId, index) => ({
    id: `completion-standings-${matchdayId}`,
    saveId: "season-completion-test-save",
    seasonId,
    matchdayId,
    action: "apply",
    payload: {
      idempotencyKey: `completion-standings-${matchdayId}`,
      totalTeams: gameState.teams.length,
      appliedTeams: gameState.teams.length,
      tieGroupsCount: 0,
      previewWarningsCount: 0,
    },
    createdAt: `2026-06-20T01:${String(index).padStart(2, "0")}:00.000Z`,
  }));
  gameState.seasonState.cashPrizeApplyLogs = [
    {
      id: "completion-cash-season-end",
      saveId: "season-completion-test-save",
      seasonId,
      matchdayId: lastMatchdayId,
      action: "apply",
      payload: {
        idempotencyKey: `cash-prize-apply:season-completion-test-save:${seasonId}:${lastMatchdayId}`,
        totalTeams: gameState.teams.length,
        appliedTeams: gameState.teams.length,
        totalPrizeMoney: 0,
      },
      createdAt: "2026-06-20T02:00:00.000Z",
    },
  ];

  return gameState;
}

describe("runLocalSeasonCompletion", () => {
  it("applies the season review pipeline without duplicating existing cash", async () => {
    const gameState = createCompletedSeasonState();
    const persistence = createPersistence(gameState);

    const result = await runLocalSeasonCompletion(
      {
        saveId: "season-completion-test-save",
        seasonId: gameState.season.id,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
      },
      persistence,
    );
    const saved = persistence.getState();

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.steps.find((step) => step.key === "cash_apply")?.status).toBe("already_done");
    expect(result.steps.find((step) => step.key === "relationships")?.status).toBe("applied");
    expect(result.steps.find((step) => step.key === "snapshot")?.status).toBe("applied");
    expect(result.steps.find((step) => step.key === "transition")?.status).toBe("applied");
    expect(saved.seasonState.cashPrizeApplyLogs).toHaveLength(1);
    expect(saved.seasonState.teamRelationshipEvents?.length).toBeGreaterThan(0);
    expect(saved.seasonState.teamRelationshipEvents?.every((event) => event.source === "matchday_result")).toBe(true);
    expect(saved.seasonState.seasonSnapshots?.some((snapshot) => snapshot.seasonId === gameState.season.id)).toBe(true);
    expect(saved.gamePhase).toBe("season_review");
    expect((saved.seasonReviewState as { seasonConsequences?: Record<string, unknown> }).seasonConsequences?.[gameState.season.id]).toBeDefined();
    expect(result.seasonReview.objectiveSettlement.rows.length).toBeGreaterThan(0);
    expect(result.aiSeasonAudit.seasonId).toBe(gameState.season.id);
  });
});
