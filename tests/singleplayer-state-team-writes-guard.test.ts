import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { createRoom, getRoom, joinRoom } from "@/lib/room/room-store";

const getSaveById = vi.fn();
const saveSingleplayerState = vi.fn();
const listSaves = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    saveSingleplayerState,
    listSaves,
  }),
}));

// NOTE: `@/lib/room/room-gameplay-write-notifier` is deliberately NOT mocked here (matches
// tests/training-api-guards.test.ts) — this exercises the real recordRoomGameplayWrite ->
// room.state.roomEvents path, which is exactly what broadcastRoomGameplayUpdate reads from to
// emit `roomGameplayEvent` to every socket in the room. Asserting a new roomEvents entry is the
// server-side proof that the partner's client would receive the broadcast.

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    rating: 70,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "m",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: ["motivated"],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 60, soc: 55 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 50 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as unknown as Player;
}

function createRoster(teamId: string, playerId: string): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary: 5,
    upkeep: 5,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    joinedSeasonId: "season-2",
  } as unknown as RosterEntry;
}

function createTeam(teamId: string, name: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name,
    budget: 100,
    cash: 80,
    identityId: teamId,
    humanControlled: true,
    rosterLimit: 12,
    logoPath: null,
  } as unknown as Team;
}

function createGameState(): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamIdentityOverrides: {},
      teamControlSettings: {},
      contractNegotiationDrafts: [],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [createTeam("P-S", "Chris Team"), createTeam("M-S", "Franky Team")],
    teamIdentities: [],
    teamCaptains: [],
    players: [createPlayer("player-chris-1", "Chris Spieler"), createPlayer("player-franky-1", "Franky Spieler")],
    rosters: [createRoster("P-S", "player-chris-1"), createRoster("M-S", "player-franky-1")],
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
  const saveId = `singleplayer-state-team-writes-save-${suffix}`;
  const created = createRoom(`sps-team-writes-a-${suffix}`, {
    displayName: "Chris",
    saveId,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `sps-team-writes-b-${suffix}`, { displayName: "Franky" });
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

// The route module pulls in a large dependency graph (season/sponsor/ai services). Preloading it
// once in `beforeAll` — with a generous hook timeout — avoids the first `it()` eating that import
// cost out of vitest's default 5s per-test budget (the failure mode this exact setup hit before).
let POST: typeof import("@/app/api/singleplayer-state/route").POST;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/singleplayer-state/route"));
}, 30000);

function postSingleplayerState(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/singleplayer-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("singleplayer-state team-write guards (S9)", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    saveSingleplayerState.mockReset();
    listSaves.mockReset();
    listSaves.mockReturnValue([]);
    getSaveById.mockReturnValue({ gameState: createGameState() });
    saveSingleplayerState.mockImplementation((saveId: string, gameState: GameState) => ({
      saveId,
      name: "Singleplayer-State Guard Save",
      status: "active",
      createdAt: "2026-06-27T00:00:00.000Z",
      updatedAt: "2026-06-27T00:00:00.000Z",
      gameState,
    }));
  });

  describe("assign-team-captain", () => {
    it("lets Chris appoint a captain on his own team and broadcasts it to the room", async () => {
      const { saveId, roomCode, chris } = setUpRoom("captain-own");
      const eventsBefore = getRoom(roomCode)?.state.roomEvents.length ?? 0;

      const response = await postSingleplayerState({
        action: "assign-team-captain",
        saveId,
        teamId: "P-S",
        playerId: "player-chris-1",
        roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(saveSingleplayerState).toHaveBeenCalledTimes(1);

      const eventsAfter = getRoom(roomCode)?.state.roomEvents.length ?? 0;
      expect(eventsAfter).toBe(eventsBefore + 1);
      expect(getRoom(roomCode)?.state.roomEvents.at(-1)?.type).toBe("save_updated");
      expect(body.save?.saveId).toBe(saveId);
    });

    it("denies Franky appointing a captain on Chris' team (ownership)", async () => {
      const { saveId, roomCode, franky } = setUpRoom("captain-ownership");

      const response = await postSingleplayerState({
        action: "assign-team-captain",
        saveId,
        teamId: "P-S",
        playerId: "player-chris-1",
        roomCode,
        participantId: franky.participantId,
        userId: franky.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBeTruthy();
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });

    it("rejects a teamId/playerId mismatch (can't smuggle a captain write to another team)", async () => {
      const { saveId, roomCode, chris } = setUpRoom("captain-mismatch");

      const response = await postSingleplayerState({
        action: "assign-team-captain",
        saveId,
        teamId: "P-S",
        playerId: "player-franky-1",
        roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBeTruthy();
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });
  });

  describe("new-game-flow-step", () => {
    it("lets Chris complete a flow step for his own team and broadcasts it to the room", async () => {
      const { saveId, roomCode, chris } = setUpRoom("flow-own");
      const eventsBefore = getRoom(roomCode)?.state.roomEvents.length ?? 0;

      const response = await postSingleplayerState({
        action: "new-game-flow-step",
        saveId,
        stepId: "appoint_captain",
        status: "completed",
        selectedTeamId: "P-S",
        roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(saveSingleplayerState).toHaveBeenCalledTimes(1);

      const eventsAfter = getRoom(roomCode)?.state.roomEvents.length ?? 0;
      expect(eventsAfter).toBe(eventsBefore + 1);
      expect(getRoom(roomCode)?.state.roomEvents.at(-1)?.type).toBe("flow_step_changed");
      expect(body.save?.saveId).toBe(saveId);
    });

    it("denies Franky flipping a flow step for Chris' team (ownership)", async () => {
      const { saveId, roomCode, franky } = setUpRoom("flow-ownership");

      const response = await postSingleplayerState({
        action: "new-game-flow-step",
        saveId,
        stepId: "appoint_captain",
        status: "completed",
        selectedTeamId: "P-S",
        roomCode,
        participantId: franky.participantId,
        userId: franky.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBeTruthy();
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });

    it("rejects a Chris-authenticated request that mislabels selectedTeamId as Franky's team (can't smuggle a write onto another team by relabeling teamId)", async () => {
      const { saveId, roomCode, chris } = setUpRoom("flow-mismatch");

      // Chris is a genuine, connected room participant — but he's targeting M-S (Franky's team)
      // by passing its id as selectedTeamId. There's no separate roster/entity id on this write
      // path (unlike training/captain's playerId): the teamId itself is the smuggled claim, and
      // authorizeServerRoomWrite must still reject it purely on ownership.
      const response = await postSingleplayerState({
        action: "new-game-flow-step",
        saveId,
        stepId: "roster_review",
        status: "completed",
        selectedTeamId: "M-S",
        roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBeTruthy();
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });
  });

  describe("contract-negotiation-outcome", () => {
    function buildSummary(teamId: string, playerId: string) {
      return {
        canBuy: true,
        blockingReasons: [],
        warnings: [],
        player: { id: playerId, name: "Target Player", className: "Hero", race: "Human" },
        team: { id: teamId, name: "Team", shortCode: teamId },
        cashBefore: 80,
        cashAfter: 60,
        salaryBefore: 0,
        salaryAfter: 5,
        marketValueBefore: 0,
        marketValueAfter: 20,
        rosterBefore: 1,
        rosterAfter: 2,
        purchasePrice: 20,
        salary: 5,
        contractLength: 2,
        currentValue: 20,
        joinedSeasonId: "season-2",
      };
    }

    it("lets Chris record a negotiation outcome for his own team and broadcasts it to the room", async () => {
      const { saveId, roomCode, chris } = setUpRoom("negotiation-own");
      const eventsBefore = getRoom(roomCode)?.state.roomEvents.length ?? 0;

      const response = await postSingleplayerState({
        action: "contract-negotiation-outcome",
        saveId,
        summary: buildSummary("P-S", "player-target-1"),
        status: "ready_for_review",
        roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(saveSingleplayerState).toHaveBeenCalledTimes(1);

      const eventsAfter = getRoom(roomCode)?.state.roomEvents.length ?? 0;
      expect(eventsAfter).toBe(eventsBefore + 1);
      expect(getRoom(roomCode)?.state.roomEvents.at(-1)?.type).toBe("save_updated");
      expect(body.save?.saveId).toBe(saveId);
    });

    it("denies Franky recording a negotiation outcome for Chris' team (ownership)", async () => {
      const { saveId, roomCode, franky } = setUpRoom("negotiation-ownership");

      const response = await postSingleplayerState({
        action: "contract-negotiation-outcome",
        saveId,
        summary: buildSummary("P-S", "player-target-1"),
        status: "ready_for_review",
        roomCode,
        participantId: franky.participantId,
        userId: franky.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBeTruthy();
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });

    it("rejects a summary.team.id that doesn't exist in the save (can't smuggle a write to an unknown team)", async () => {
      const { saveId, roomCode, chris } = setUpRoom("negotiation-unknown-team");

      const response = await postSingleplayerState({
        action: "contract-negotiation-outcome",
        saveId,
        summary: buildSummary("Z-Z", "player-target-1"),
        status: "ready_for_review",
        roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("team_not_found");
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });
  });
});
