import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createRoom, getRoom, joinRoom } from "@/lib/room/room-store";

const getSaveById = vi.fn();
const saveSingleplayerState = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    saveSingleplayerState,
  }),
}));

// NOTE: `@/lib/room/room-gameplay-write-notifier` is deliberately NOT mocked here (unlike
// tests/team-settings-api-guards.test.ts) — this test exercises the real
// recordRoomGameplayWrite → room.state.roomEvents path, which is exactly what
// broadcastRoomGameplayUpdate reads from to emit `roomGameplayEvent` to every socket in the
// room. Asserting a new roomEvents entry is the server-side proof that Franky's client would
// receive the broadcast, without needing a live socket.io server (see scripts/smoke-coop-sync.ts
// for the full socket-level version of this same guarantee, which needs a running dev server).

function createGameState(): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamIdentityOverrides: {},
      teamControlSettings: {},
      trainingIntensityConfirmations: {},
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "P-S", name: "Chris Team", shortCode: "P-S", cash: 50, rosterLimit: 14, humanControlled: true },
      { teamId: "M-S", name: "Franky Team", shortCode: "M-S", cash: 50, rosterLimit: 14, humanControlled: true },
    ],
    teamIdentities: [],
    players: [
      { id: "player-chris-1", name: "Chris Spieler", trainingMode: "mittel", trainingClass: "balanced" },
      { id: "player-franky-1", name: "Franky Spieler", trainingMode: "mittel", trainingClass: "balanced" },
    ],
    rosters: [
      { id: "roster-1", teamId: "P-S", playerId: "player-chris-1" },
      { id: "roster-2", teamId: "M-S", playerId: "player-franky-1" },
    ],
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
  const saveId = `training-api-save-${suffix}`;
  const created = createRoom(`training-api-a-${suffix}`, {
    displayName: "Chris",
    saveId,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `training-api-b-${suffix}`, { displayName: "Franky" });
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

describe("training api guard", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    saveSingleplayerState.mockReset();
    getSaveById.mockReturnValue({ gameState: createGameState() });
    saveSingleplayerState.mockImplementation((saveId: string, gameState: GameState) => ({
      saveId,
      name: "Training Guard Save",
      status: "active",
      createdAt: "2026-06-27T00:00:00.000Z",
      updatedAt: "2026-06-27T00:00:00.000Z",
      gameState,
    }));
  });

  it("lets Chris change training mode on his own team's player and broadcasts it to the room", async () => {
    const { saveId, roomCode, chris } = setUpRoom("mode");
    const { POST } = await import("@/app/api/training/route");

    const eventsBefore = getRoom(roomCode)?.state.roomEvents.length ?? 0;

    const response = await POST(
      new Request("http://localhost/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "P-S",
          playerId: "player-chris-1",
          trainingMode: "hart",
          roomCode,
          participantId: chris.participantId,
          userId: chris.userId,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.player?.trainingMode).toBe("hart");
    expect(saveSingleplayerState).toHaveBeenCalledTimes(1);

    // Not a 409 — this is the S1 bug: the whole-state PUT is blocked in a room save, and the
    // scoped /api/training route must succeed where that PUT would 409.
    expect(response.status).not.toBe(409);

    // Franky's client receives this via `roomGameplayEvent` — proven here by asserting a new
    // event landed in the room's real event log (see broadcastRoomGameplayUpdate).
    const eventsAfter = getRoom(roomCode)?.state.roomEvents.length ?? 0;
    expect(eventsAfter).toBe(eventsBefore + 1);
    expect(getRoom(roomCode)?.state.roomEvents.at(-1)?.type).toBe("save_updated");
  });

  it("lets a human change training class on their own team's player", async () => {
    const { saveId, roomCode, chris } = setUpRoom("class");
    const { POST } = await import("@/app/api/training/route");

    const response = await POST(
      new Request("http://localhost/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "P-S",
          playerId: "player-chris-1",
          trainingClass: "explosive",
          roomCode,
          participantId: chris.participantId,
          userId: chris.userId,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.player?.trainingClass).toBe("explosive");
  });

  it("denies Franky changing a training setting on Chris' team (ownership)", async () => {
    const { saveId, roomCode, franky } = setUpRoom("ownership");
    const { POST } = await import("@/app/api/training/route");

    const response = await POST(
      new Request("http://localhost/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "P-S",
          playerId: "player-chris-1",
          trainingMode: "hart",
          roomCode,
          participantId: franky.participantId,
          userId: franky.userId,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("rejects a teamId/playerId mismatch (can't smuggle a write to another team's player)", async () => {
    const { saveId, roomCode, chris } = setUpRoom("mismatch");
    const { POST } = await import("@/app/api/training/route");

    const response = await POST(
      new Request("http://localhost/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId,
          teamId: "P-S",
          playerId: "player-franky-1",
          trainingMode: "hart",
          roomCode,
          participantId: chris.participantId,
          userId: chris.userId,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("player_not_on_team");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });
});
