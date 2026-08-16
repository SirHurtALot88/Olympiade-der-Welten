import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createRoom, joinRoom } from "@/lib/room/room-store";

const runAutoRosterFillForMatchdaySetup = vi.fn();

vi.mock("@/lib/ai/auto-roster-fill-service", () => ({
  runAutoRosterFillForMatchdaySetup,
}));

// S6: most tests below don't need a resolvable save (the route's ownership-scope read then finds
// nothing and omits `callerWritableTeamIds`, see the "no room context" test) — only the new
// "restricts callerWritableTeamIds..." test below populates this.
const persistenceState = { save: null as { saveId: string; gameState: GameState } | null };

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
  }),
}));

describe("auto roster fill api", () => {
  beforeEach(() => {
    runAutoRosterFillForMatchdaySetup.mockReset();
    persistenceState.save = null;
  });

  it("requires explicit confirm token for execute", async () => {
    const { POST } = await import("@/app/api/ai/roster-fill/route");

    const response = await POST(
      new Request("http://localhost:3000/api/ai/roster-fill?saveId=save-1&seasonId=season-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      }),
    );

    expect(response.status).toBe(409);
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  });

  it("runs the local roster-fill service in dry-run mode", async () => {
    runAutoRosterFillForMatchdaySetup.mockResolvedValue({
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "ready",
      saveContext: {
        source: "sqlite",
        requestedSaveId: "save-1",
        resolvedSaveId: "save-1",
        requestedSeasonId: "season-1",
        resolvedSeasonId: "season-1",
        saveName: "Smoke Save",
        saveStatus: "active",
        scopeWarning: null,
      },
      summary: {
        totalTeams: 32,
        targetResolvedTeams: 32,
        missingTargetTeams: 0,
        teamsNeedingBuys: 12,
        alreadyAtTargetTeams: 20,
        filledTeams: 0,
        partialTeams: 0,
        blockedTeams: 0,
        plannedBuys: 18,
        appliedBuys: 0,
        historyWrites: 0,
      },
      teams: [],
      warnings: [],
      blockingReasons: [],
    });

    const { POST } = await import("@/app/api/ai/roster-fill/route");

    const response = await POST(
      new Request("http://localhost:3000/api/ai/roster-fill?saveId=save-1&seasonId=season-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runAutoRosterFillForMatchdaySetup).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-1",
      seasonId: "season-1",
      dryRun: true,
      confirmToken: null,
    });
    expect(body.summary.plannedBuys).toBe(18);
  });

  // S6 regression: the route must compute `callerWritableTeamIds` from the authoritative room
  // state (never a client-supplied claim) and pass it through to the service, restricted to
  // AI-controlled teams plus the caller's own team(s) — never another human participant's team.
  it("restricts callerWritableTeamIds to the caller's own team plus AI teams, excluding the other participant's room-owned team", async () => {
    const saveId = "roster-fill-room-save";
    const gameState = {
      season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
      seasonState: { seasonId: "season-1", schedule: [], standings: {} },
      matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [
        { teamId: "P-S", name: "Chris Team", shortCode: "P-S", cash: 50, rosterLimit: 14, humanControlled: true },
        { teamId: "M-S", name: "Franky Team", shortCode: "M-S", cash: 50, rosterLimit: 14, humanControlled: true },
        { teamId: "A-A", name: "AI Team", shortCode: "A-A", cash: 50, rosterLimit: 14, humanControlled: false },
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
        generatedAt: "2026-07-26T00:00:00.000Z",
        processedMappingRows: 0,
        importedPlayerCount: 0,
        matchedRosterCount: 0,
        teamCount: 3,
        unmappedPlayers: [],
      },
      disciplines: [],
    } as unknown as GameState;
    persistenceState.save = { saveId, gameState };

    const created = createRoom("roster-fill-api-a", {
      displayName: "Chris",
      saveId,
      preset: "chris_4_franky_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "roster-fill-api-b", { displayName: "Franky" });
    if (!joined.ok) {
      throw new Error("expected franky to join room");
    }
    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    if (!chris) {
      throw new Error("expected host participant");
    }

    runAutoRosterFillForMatchdaySetup.mockResolvedValue({
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "ready",
      saveContext: null,
      summary: {
        totalTeams: 3,
        targetResolvedTeams: 3,
        missingTargetTeams: 0,
        teamsNeedingBuys: 0,
        alreadyAtTargetTeams: 3,
        filledTeams: 0,
        partialTeams: 0,
        blockedTeams: 0,
        plannedBuys: 0,
        appliedBuys: 0,
        historyWrites: 0,
      },
      teams: [],
      warnings: [],
      blockingReasons: [],
      skippedTeamIds: [],
    });

    const { POST } = await import("@/app/api/ai/roster-fill/route");
    const response = await POST(
      new Request(`http://localhost:3000/api/ai/roster-fill?saveId=${saveId}&seasonId=season-1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: true,
          roomCode: created.room.roomCode,
          participantId: chris.participantId,
          // Seit Befund F12 weist NUR das Sitz-Token eine Identitaet nach; eine `participantId`
          // allein reicht nicht mehr. Der echte Client schickt das Token ohnehin immer mit
          // (`buildRoomWriteBody`, lib/room/foundation-room-context-client.ts) — ohne es hier
          // pruefte der Test einen Fall, den es in der Anwendung gar nicht gibt.
          seatToken: created.seat.seatToken,
          userId: chris.userId,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(runAutoRosterFillForMatchdaySetup).toHaveBeenCalledTimes(1);
    const callArgs = runAutoRosterFillForMatchdaySetup.mock.calls[0]![0] as { callerWritableTeamIds?: string[] };
    expect(new Set(callArgs.callerWritableTeamIds)).toEqual(new Set(["P-S", "A-A"]));
    expect(callArgs.callerWritableTeamIds).not.toContain("M-S");
  });
});
