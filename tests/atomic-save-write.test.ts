import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { AtomicSaveRecoveryError, runWithSaveRecovery } from "@/lib/persistence/atomic-save-write";
import type { PersistedSaveGame, PersistenceService, SaveStatus } from "@/lib/persistence/types";

function gameState(label: string): GameState {
  return {
    gamePhase: label === "before" ? "season_active" : "season_completed",
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
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

function persisted(saveId: string, status: SaveStatus, state: GameState): PersistedSaveGame {
  return {
    saveId,
    name: "Test Save",
    status,
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
    gameState: state,
  };
}

describe("atomic save write recovery", () => {
  it("restores the previous save state when a multi-step write crashes", async () => {
    const before = gameState("before");
    const after = gameState("after");
    let stored = before;
    const persistence = {
      saveSingleplayerState: (_saveId: string, nextState: GameState, input?: { status?: SaveStatus }) => {
        stored = nextState;
        return persisted("save-1", input?.status ?? "active", nextState);
      },
    } as PersistenceService;

    await expect(
      runWithSaveRecovery({
        label: "test_write",
        saveId: "save-1",
        status: "active",
        beforeGameState: before,
        persistence,
        run: () => {
          persistence.saveSingleplayerState("save-1", after, { status: "active" });
          throw new Error("crashed_after_partial_write");
        },
      }),
    ).rejects.toBeInstanceOf(AtomicSaveRecoveryError);

    expect(stored.gamePhase).toBe("season_active");
  });
});
