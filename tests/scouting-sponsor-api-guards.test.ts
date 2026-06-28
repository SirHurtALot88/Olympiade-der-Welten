import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const getSaveById = vi.fn();
const saveSingleplayerState = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    saveSingleplayerState,
  }),
}));

vi.mock("@/lib/room/server-authoritative-write-guard", () => ({
  authorizeServerRoomWrite: () => ({ allowed: true, reason: null, status: 200 }),
}));

vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({
  notifyRoomGameplayWrite: vi.fn(),
}));

function createGameState(partial?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      scoutingWatchlist: [
        {
          playerId: "p-listed",
          teamId: "M-M",
          seasonId: "season-2",
          addedAt: "2026-06-27T00:00:00.000Z",
          source: "manual_scouting_hub",
          note: null,
        },
        {
          playerId: "p-other-team",
          teamId: "A-A",
          seasonId: "season-2",
          addedAt: "2026-06-27T00:00:00.000Z",
          source: "manual_scouting_hub",
          note: null,
        },
      ],
      sponsorEvents: [
        {
          eventId: "event-open",
          saveId: "save-1",
          seasonId: "season-2",
          teamId: "M-M",
          matchday: 1,
          eventType: "activation_bonus",
          sponsorName: "Acme",
          cashDelta: 4,
          status: "open",
          createdAt: "2026-06-27T00:00:00.000Z",
          message: "Bonus",
        },
        {
          eventId: "event-resolved",
          saveId: "save-1",
          seasonId: "season-2",
          teamId: "M-M",
          matchday: 1,
          eventType: "activation_bonus",
          sponsorName: "Acme",
          cashDelta: 4,
          status: "resolved",
          createdAt: "2026-06-27T00:00:00.000Z",
          message: "Bonus",
        },
      ],
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: 3, enabled: true },
          },
        },
      },
      ...partial?.seasonState,
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", cash: 50, rosterLimit: 14, humanControlled: true }],
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
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
    ...partial,
  } as GameState;
}

describe("scouting watchlist api", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    saveSingleplayerState.mockReset();
    getSaveById.mockReturnValue({ gameState: createGameState() });
  });

  it("rejects duplicate watchlist adds without persisting", async () => {
    const { POST } = await import("@/app/api/scouting/watchlist/route");
    const response = await POST(
      new Request("http://localhost/api/scouting/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: "save-1",
          teamId: "M-M",
          playerId: "p-listed",
          action: "add",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toBe("watchlist_player_already_listed");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("returns a team-scoped watchlist on successful add", async () => {
    const { POST } = await import("@/app/api/scouting/watchlist/route");
    const response = await POST(
      new Request("http://localhost/api/scouting/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: "save-1",
          teamId: "M-M",
          playerId: "p-new",
          action: "add",
          dryRun: true,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.watchlist.every((entry: { teamId: string }) => entry.teamId === "M-M")).toBe(true);
    expect(body.watchlist.some((entry: { playerId: string }) => entry.playerId === "p-new")).toBe(true);
    expect(body.watchlist.some((entry: { playerId: string }) => entry.playerId === "p-other-team")).toBe(false);
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });
});

describe("sponsor event api", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    saveSingleplayerState.mockReset();
    getSaveById.mockReturnValue({ gameState: createGameState() });
  });

  it("rejects resolving sponsor events that are no longer open", async () => {
    const { POST } = await import("@/app/api/sponsor/event/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: "save-1",
          eventId: "event-resolved",
          action: "accept",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toBe("sponsor_event_not_open");
    expect(body.cashDelta).toBe(0);
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });
});
