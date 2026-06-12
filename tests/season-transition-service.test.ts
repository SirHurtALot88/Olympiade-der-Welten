import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  buildSeasonTransitionPreview,
  resolveGamePhase,
  startSeasonTransition,
} from "@/lib/season/season-transition-service";

function gameState(input?: { completed?: boolean; gamePhase?: GameState["gamePhase"] }): GameState {
  const completed = input?.completed ?? false;
  return {
    ...(input?.gamePhase ? { gamePhase: input.gamePhase } : {}),
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: completed ? 2 : 1, matchdayIds: ["md-1", "md-2"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [
        { id: "fixture-1", homeTeamId: "team-1", awayTeamId: "team-2", matchdayId: "md-1", status: "resolved" },
        { id: "fixture-2", homeTeamId: "team-1", awayTeamId: "team-2", matchdayId: "md-2", status: completed ? "resolved" : "scheduled" },
      ],
      standings: { "team-1": { points: 3, rank: 1 }, "team-2": { points: 0, rank: 2 } },
      lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2", teamId: "team-1", status: "submitted", entries: [], createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" }],
      formCards: [{ cardId: "form-1", seasonId: "season-1", teamId: "team-1", playerId: "player-1", type: "buff", value: 1 } as never],
    },
    matchdayState: { matchdayId: completed ? "md-2" : "md-1", status: completed ? "resolved" : "planning", pendingTeamIds: completed ? [] : ["team-1"], resolvedFixtureIds: completed ? ["fixture-2"] : [] },
    teams: [
      { teamId: "team-1", shortCode: "T-1", name: "Team One", budget: 100, cash: 50, identityId: "identity-1", humanControlled: true, rosterLimit: 12 },
      { teamId: "team-2", shortCode: "T-2", name: "Team Two", budget: 100, cash: 40, identityId: "identity-2", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [{ id: "r-1", teamId: "team-1", playerId: "player-1", salary: 1, upkeep: 1, currentValue: 10, contractLength: 1, roleTag: "starter", joinedSeasonId: "season-1" }],
    contracts: [],
    transferListings: [],
    transferHistory: [{ transferId: "t-1", playerId: "player-x", transferType: "buy", toTeamId: "team-1", fromTeamId: null, fee: 10, seasonId: "season-1", createdAt: "2026-06-11T00:00:00.000Z", source: "test" } as never],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 2,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function save(input?: { completed?: boolean; gamePhase?: GameState["gamePhase"] }): PersistedSaveGame {
  return {
    saveId: "save-1",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    gameState: gameState(input),
  };
}

function persistenceMock(sourceSave: PersistedSaveGame) {
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => ({
    ...sourceSave,
    saveId,
    gameState: nextGameState,
  }));
  return {
    persistence: { saveSingleplayerState } as unknown as PersistenceService,
    saveSingleplayerState,
  };
}

describe("season transition service", () => {
  it("reads gamePhase and falls back to season_active for legacy saves", () => {
    expect(resolveGamePhase(gameState())).toBe("season_active");
    expect(resolveGamePhase(gameState({ gamePhase: "season_review" }))).toBe("season_review");
  });

  it("blocks the season close gate while the last matchday is not complete", () => {
    const preview = buildSeasonTransitionPreview(save({ completed: false }));

    expect(preview.canCompleteSeason).toBe(false);
    expect(preview.disabledReason).toBe("last_matchday_not_completed");
    expect(preview.steps[0]?.status).toBe("blocked");
  });

  it("enables the season close gate when all last-matchday data is resolved", () => {
    const preview = buildSeasonTransitionPreview(save({ completed: true }));

    expect(preview.canCompleteSeason).toBe(true);
    expect(preview.disabledReason).toBeNull();
    expect(preview.steps.map((step) => step.stepId)).toEqual([
      "season_check",
      "season_review",
      "season_rewards",
      "player_development",
      "preseason_management",
      "transfer_sell_phase",
      "transfer_buy_phase",
      "lineup_setup",
      "next_season_ready",
    ]);
  });

  it("keeps completed/review phases transition-ready after reload even if fixture flags are stale", () => {
    const sourceSave = save({ completed: false, gamePhase: "season_completed" });
    const preview = buildSeasonTransitionPreview(sourceSave);

    expect(preview.gamePhase).toBe("season_completed");
    expect(preview.canCompleteSeason).toBe(true);
    expect(preview.disabledReason).toBeNull();
  });

  it("stores transition currentStep without productive domain writes", () => {
    const sourceSave = save({ completed: true });
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    const result = startSeasonTransition(sourceSave, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    if (!savedState) throw new Error("Expected transition metadata to be saved.");
    expect(savedState.gamePhase).toBe("season_review");
    expect(savedState.seasonTransition?.currentStep).toBe("season_review");
    expect(savedState.seasonTransition?.fromSeasonId).toBe("season-1");
    expect(savedState.seasonTransition?.toSeasonId).toBe("season-2");
    expect(savedState.season.id).toBe(sourceSave.gameState.season.id);
    expect(savedState.rosters).toEqual(sourceSave.gameState.rosters);
    expect(savedState.transferHistory).toEqual(sourceSave.gameState.transferHistory);
    expect(savedState.teams).toEqual(sourceSave.gameState.teams);
  });

  it("keeps service source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/season/season-transition-service.ts",
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(source).toContain("productiveWrites: false");
  });
});
