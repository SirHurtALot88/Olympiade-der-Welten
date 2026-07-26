import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { resolveAiBulkTeamWriteScope } from "@/lib/room/ai-bulk-team-write-scope";
import { createRoom, joinRoom } from "@/lib/room/room-store";

function createTeam(teamId: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name: teamId,
    budget: 100,
    cash: 100,
    identityId: teamId,
    rosterLimit: 12,
    humanControlled: false,
  };
}

function createGameState(teamIds: string[]): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: teamIds.map(createTeam),
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-07-26T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teamIds.length,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as unknown as GameState;
}

function makeManualControlSettings(teamId: string, ownerId: string): TeamControlSettings {
  return {
    teamId,
    controlMode: "manual",
    ownerId,
    ownerSlot: ownerId === DEFAULT_ACTIVE_OWNER_ID ? "user" : ownerId,
    displayLabel: teamId,
    aiLineupPreviewEnabled: false,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: false,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: false,
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

describe("resolveAiBulkTeamWriteScope", () => {
  it("in an online room: AI/passive teams and the caller's own team are writable, another human's team is not", () => {
    const created = createRoom("bulk-scope-a", {
      displayName: "Chris",
      saveId: "bulk-scope-save",
      preset: "chris_4_franky_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "bulk-scope-b", { displayName: "Franky" });
    if (!joined.ok) {
      throw new Error("expected franky to join room");
    }
    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    if (!chris) {
      throw new Error("expected host participant");
    }

    // Chris (host) owns "P-S", Franky owns "M-S" (per the "chris_4_franky_4_rest_ai" preset's
    // FOUR_PLUS_FOUR_HOST_TEAM_IDS / FOUR_PLUS_FOUR_FRANKY_TEAM_IDS), "A-A" stays ai-controlled.
    const gameState = createGameState(["P-S", "M-S", "A-A"]);

    const scope = resolveAiBulkTeamWriteScope({
      gameState,
      room: joined.room,
      participant: chris,
      activeOwnerId: null,
    });

    expect(scope.writableTeamIds.has("P-S")).toBe(true); // Chris's own team
    expect(scope.writableTeamIds.has("A-A")).toBe(true); // ai-controlled, fair game for any caller
    expect(scope.writableTeamIds.has("M-S")).toBe(false); // Franky's team — never writable by Chris
    expect(scope.isTeamWritable("M-S")).toBe(false);
  });

  it("in an online room: a passive (unclaimed) team is writable by any caller", () => {
    // No second participant joins — "chris_4_rest_ai" leaves exactly one seat filled; every other
    // preset team defaults to controllerType "ai" per buildOwnershipForPreset, so this exercises
    // the ai/passive branch specifically for a team nobody has claimed yet.
    const created = createRoom("bulk-scope-c", {
      displayName: "Chris",
      saveId: "bulk-scope-save-2",
      preset: "chris_1_rest_ai",
    });
    const chris = created.room.state.roomParticipants[0]!;
    const gameState = createGameState(["P-S", "D-P"]);

    const scope = resolveAiBulkTeamWriteScope({
      gameState,
      room: created.room,
      participant: chris,
      activeOwnerId: null,
    });

    // "D-P" is one of the FOUR_PLUS_FOUR_HOST_TEAM_IDS but is not assigned under a 1-team preset —
    // it stays ai-controlled and is writable by the caller.
    expect(scope.writableTeamIds.has("D-P")).toBe(true);
  });

  it("in local (non-room) singleplayer: manual teams are writable only when owned by activeOwnerId", () => {
    const gameState = createGameState(["P-S", "M-S", "A-A"]);
    gameState.seasonState.teamControlSettings = {
      "P-S": makeManualControlSettings("P-S", DEFAULT_ACTIVE_OWNER_ID),
      "M-S": makeManualControlSettings("M-S", FRANKY_OWNER_ID),
      // "A-A" left unset — falls back to controlMode "ai" (team.humanControlled === false).
    };

    const scope = resolveAiBulkTeamWriteScope({
      gameState,
      room: null,
      participant: null,
      activeOwnerId: DEFAULT_ACTIVE_OWNER_ID,
    });

    expect(scope.writableTeamIds.has("P-S")).toBe(true); // owned by the caller (default local user)
    expect(scope.writableTeamIds.has("A-A")).toBe(true); // ai-controlled
    expect(scope.writableTeamIds.has("M-S")).toBe(false); // manual, owned by Franky — not the caller
  });
});
