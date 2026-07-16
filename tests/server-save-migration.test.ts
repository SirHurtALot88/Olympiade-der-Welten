import { describe, expect, it } from "vitest";

import type { GameState, ServerActionRequest } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  exportLocalSandboxSaveForServer,
  importServerGameSave,
  validateServerActionConcurrency,
} from "@/lib/server/server-save-migration";

function buildSave(overrides: Partial<GameState> = {}): PersistedSaveGame {
  const gameState: GameState = {
    gamePhase: "season_active",
    scenarioMeta: {
      scenarioType: "sandbox_multiseason_test",
      label: "Server Save Test",
      createdAt: "2026-06-13T00:00:00.000Z",
      allowTestWrites: true,
    },
    saveVersion: 7,
    season: {
      id: "season-3",
      name: "Season 3",
      currentMatchday: 1,
      matchdayIds: ["season-3-matchday-1"],
    } as any,
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings: {},
      matchdayResults: [],
      seasonSnapshots: [{ seasonId: "season-2", seasonName: "Season 2", archivedAt: "now", finalStandings: [], playerPerformances: [] }],
    } as any,
    matchdayState: {
      matchdayId: "season-3-matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [{ teamId: "T-1", name: "Test Team", cash: 10 }] as any,
    teamIdentities: [],
    players: [{ id: "p-1", name: "Player One" }] as any,
    disciplines: [],
    rosters: [{ id: "r-1", teamId: "T-1", playerId: "p-1" }] as any,
    contracts: [{ id: "c-1", teamId: "T-1", playerId: "p-1" }] as any,
    transferListings: [],
    transferHistory: [{ id: "tr-1", playerId: "p-1", fromTeamId: null, toTeamId: "T-1" }] as any,
    playerBaselines: [
      {
        playerId: "p-1",
        name: "Player One",
        race: "Human",
        className: "Hero",
        subclasses: [],
        traits: [],
        attributes: {},
        marketValue: null,
        salary: null,
        bracket: null,
        disciplineRatings: {},
        imageRef: null,
        source: "seed",
        baselineVersion: "test",
        createdAt: "2026-06-13T00:00:00.000Z",
      },
    ],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "now",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
    ...overrides,
  };

  return {
    saveId: "save-test",
    name: "Server Save Test",
    status: "active",
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
    gameState,
  };
}

function buildRequest(overrides: Partial<ServerActionRequest> = {}): ServerActionRequest {
  return {
    roomId: "room-1",
    saveId: "save-test",
    userId: "user-1",
    actionType: "lineup_save",
    payload: {},
    confirmToken: "token-ok",
    expectedSaveVersion: 7,
    idempotencyKey: "event-2",
    ...overrides,
  };
}

describe("server save migration contract", () => {
  it("exports a complete local sandbox payload without productive import writes", () => {
    const payload = exportLocalSandboxSaveForServer(buildSave());
    const importResult = importServerGameSave(payload);

    expect(payload.schemaVersion).toBe("server-game-save-v1");
    expect(payload.serverGameSave.version).toBe(7);
    expect(payload.validation.ok).toBe(true);
    expect(payload.validation.counts.players).toBe(1);
    expect(payload.validation.counts.playerBaselines).toBe(1);
    expect(importResult.dryRun).toBe(true);
    expect(importResult.productiveWrites).toBe(false);
  });

  it("blocks server migration when player baseline is missing", () => {
    const payload = exportLocalSandboxSaveForServer(buildSave({ playerBaselines: [] }));

    expect(payload.validation.ok).toBe(false);
    expect(payload.validation.blockers.map((entry) => entry.code)).toContain(
      "player_baseline_required_before_server_save",
    );
  });

  it("detects dangling roster refs and duplicate active roster players", () => {
    const payload = exportLocalSandboxSaveForServer(
      buildSave({
        rosters: [
          { id: "r-1", teamId: "T-1", playerId: "p-1" },
          { id: "r-2", teamId: "T-2", playerId: "p-1" },
          { id: "r-3", teamId: "T-1", playerId: "missing-player" },
        ] as any,
      }),
    );

    expect(payload.validation.ok).toBe(false);
    expect(payload.validation.blockers.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["dangling_roster_player_ref", "dangling_roster_team_ref", "duplicate_active_roster_player"]),
    );
  });

  it("blocks stale save versions", () => {
    const result = validateServerActionConcurrency({
      request: buildRequest({ expectedSaveVersion: 6 }),
      currentSaveVersion: 7,
      expectedConfirmToken: "token-ok",
    });

    expect(result.ok).toBe(false);
    expect(result.conflictCode).toBe("save_version_conflict");
  });

  it("blocks duplicate idempotency keys", () => {
    const result = validateServerActionConcurrency({
      request: buildRequest({ idempotencyKey: "event-1" }),
      currentSaveVersion: 7,
      lastAppliedEventId: "event-1",
      expectedConfirmToken: "token-ok",
    });

    expect(result.ok).toBe(false);
    expect(result.conflictCode).toBe("action_already_applied");
  });

  it("blocks stale confirm tokens", () => {
    const result = validateServerActionConcurrency({
      request: buildRequest({ confirmToken: "old-token" }),
      currentSaveVersion: 7,
      expectedConfirmToken: "token-ok",
    });

    expect(result.ok).toBe(false);
    expect(result.conflictCode).toBe("confirm_token_stale");
  });
});
