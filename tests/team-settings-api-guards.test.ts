import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createRoom, joinRoom } from "@/lib/room/room-store";

const getSaveById = vi.fn();
const saveSingleplayerState = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    saveSingleplayerState,
  }),
}));

vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({
  notifyRoomGameplayWrite: vi.fn(),
}));

function createGameState(): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamIdentityOverrides: {},
      teamControlSettings: {},
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "P-S", name: "Chris Team", shortCode: "P-S", cash: 50, rosterLimit: 14, humanControlled: true },
      { teamId: "M-S", name: "Franky Team", shortCode: "M-S", cash: 50, rosterLimit: 14, humanControlled: true },
    ],
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
      generatedAt: "2026-06-27T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 2,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as unknown as GameState;
}

function setUpRoom(suffix: string) {
  const saveId = `team-settings-api-save-${suffix}`;
  const created = createRoom(`team-settings-api-a-${suffix}`, {
    displayName: "Chris",
    saveId,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `team-settings-api-b-${suffix}`, { displayName: "Franky" });
  if (!joined.ok) {
    throw new Error("expected franky to join room");
  }
  const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
  const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
  if (!chris || !franky) {
    throw new Error("expected both participants");
  }
  return { saveId, roomCode: created.room.roomCode, chris, franky };
}

describe("team-settings identity/control api guards", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    saveSingleplayerState.mockReset();
    getSaveById.mockReturnValue({ gameState: createGameState() });
    saveSingleplayerState.mockImplementation((saveId: string, gameState: GameState) => ({
      saveId,
      name: "Team Settings Guard Save",
      status: "active",
      createdAt: "2026-06-27T00:00:00.000Z",
      updatedAt: "2026-06-27T00:00:00.000Z",
      gameState,
    }));
  });

  it("allows a participant to update their own team's identity and denies the other team", async () => {
    const { saveId, roomCode, chris, franky } = setUpRoom("identity");
    const { POST } = await import("@/app/api/team-settings/identity/route");

    const ownWrite = await POST(
      new Request("http://localhost/api/team-settings/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "P-S",
          identity: { pow: 12 },
          roomCode,
          participantId: chris.participantId,
          userId: chris.userId,
        }),
      }),
    );
    const ownBody = await ownWrite.json();
    expect(ownWrite.status).toBe(200);
    expect(ownBody.success).toBe(true);
    expect(saveSingleplayerState).toHaveBeenCalledTimes(1);

    saveSingleplayerState.mockClear();

    const wrongOwnerWrite = await POST(
      new Request("http://localhost/api/team-settings/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "P-S",
          identity: { pow: 3 },
          roomCode,
          participantId: franky.participantId,
          userId: franky.userId,
        }),
      }),
    );
    const wrongOwnerBody = await wrongOwnerWrite.json();
    expect(wrongOwnerWrite.status).toBe(403);
    expect(wrongOwnerBody.success).toBe(false);
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("allows a participant to update their own team's control settings and denies the other team", async () => {
    const { saveId, roomCode, chris, franky } = setUpRoom("control");
    const { POST } = await import("@/app/api/team-settings/control/route");

    const ownWrite = await POST(
      new Request("http://localhost/api/team-settings/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "M-S",
          control: { notes: "franky note" },
          roomCode,
          participantId: franky.participantId,
          userId: franky.userId,
        }),
      }),
    );
    const ownBody = await ownWrite.json();
    expect(ownWrite.status).toBe(200);
    expect(ownBody.success).toBe(true);
    expect(ownBody.teamControlSettings?.notes).toBe("franky note");
    // Ownership fields must never be smuggled through the patch.
    expect(ownBody.teamControlSettings?.controlMode).toBe("manual");
    expect(saveSingleplayerState).toHaveBeenCalledTimes(1);

    saveSingleplayerState.mockClear();

    const wrongOwnerWrite = await POST(
      new Request("http://localhost/api/team-settings/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "M-S",
          control: { notes: "chris trying to hijack" },
          roomCode,
          participantId: chris.participantId,
          userId: chris.userId,
        }),
      }),
    );
    const wrongOwnerBody = await wrongOwnerWrite.json();
    expect(wrongOwnerWrite.status).toBe(403);
    expect(wrongOwnerBody.success).toBe(false);
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });
});
