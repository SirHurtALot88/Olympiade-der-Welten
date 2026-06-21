import { beforeEach, describe, expect, it, vi } from "vitest";

const previewLocalTransfermarktBuy = vi.fn();
const executeLocalTransfermarktBuy = vi.fn();
const persistenceMocks = vi.hoisted(() => ({
  getSaveById: vi.fn(),
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  previewLocalTransfermarktBuy,
  executeLocalTransfermarktBuy,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: persistenceMocks.getSaveById,
  }),
}));

function phaseSave(gamePhase = "transfer_buy_phase") {
  return {
    saveId: "save-singleplayer-dev",
    status: "active",
    gameState: {
      gamePhase,
      season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
      seasonState: { seasonId: "season-1", schedule: [], standings: {} },
      matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [{ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", budget: 500, cash: 300, identityId: "M-M", humanControlled: true, rosterLimit: 12 }],
      rosters: [],
      players: [],
      disciplines: [],
      teamIdentities: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
      mappingReport: { mappingSource: "", teamSource: "", generatedAt: "", processedMappingRows: 0, importedPlayerCount: 0, matchedRosterCount: 0, teamCount: 1, unmappedPlayers: [], teamsWithoutPlayers: [], mappingRowsWithoutPlayerMatch: [], duplicateMappedPlayers: [], unknownTeamCodes: [], duplicateTeamCodes: [], warnings: [] },
    },
  };
}

describe("transfermarkt buy api", () => {
  beforeEach(() => {
    previewLocalTransfermarktBuy.mockReset();
    executeLocalTransfermarktBuy.mockReset();
    persistenceMocks.getSaveById.mockReset();
    persistenceMocks.getSaveById.mockReturnValue(phaseSave());
  });

  it("uses the local sqlite preview path by default and writes nothing on dry-run", async () => {
    previewLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Citrine Miri", className: "Warlord", race: "Demon" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      cashBefore: 200000,
      cashAfter: 100000,
      salaryBefore: 24000,
      salaryAfter: 34000,
      marketValueBefore: 40000,
      marketValueAfter: 140000,
      rosterBefore: 6,
      rosterAfter: 7,
      purchasePrice: 100000,
      salary: 10000,
      contractLength: 1,
      currentValue: 100000,
      joinedSeasonId: "season-1",
    });

    const { POST } = await import("@/app/api/transfermarkt/buy/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/buy", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          playerId: "player-1",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(previewLocalTransfermarktBuy).toHaveBeenCalledTimes(1);
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
    expect(body.success).toBe(true);
    expect(body.scope).toMatchObject({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "M-M",
      playerId: "player-1",
      dryRun: true,
      source: "sqlite",
    });
  });

  it("passes contract shape and offered salary into the preview path", async () => {
    previewLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Citrine Miri", className: "Warlord", race: "Demon" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      cashBefore: 200000,
      cashAfter: 100000,
      salaryBefore: 24000,
      salaryAfter: 34000,
      marketValueBefore: 40000,
      marketValueAfter: 140000,
      rosterBefore: 6,
      rosterAfter: 7,
      purchasePrice: 100000,
      salary: 10000,
      contractLength: 4,
      contractShape: "front_loaded",
      offeredSalary: 12.5,
      currentValue: 100000,
      joinedSeasonId: "season-1",
    });

    const { POST } = await import("@/app/api/transfermarkt/buy/route");
    await POST(
      new Request("http://localhost/api/transfermarkt/buy", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          playerId: "player-1",
          contractLength: 4,
          contractShape: "front_loaded",
          offeredSalary: 12.5,
        }),
      }),
    );

    expect(previewLocalTransfermarktBuy).toHaveBeenCalledWith(
      expect.objectContaining({
        contractLength: 4,
        contractShape: "front_loaded",
        offeredSalary: 12.5,
      }),
    );
  });

  it("writes through the local sqlite execute path when dryRun is false", async () => {
    executeLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Citrine Miri", className: "Warlord", race: "Demon" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      cashBefore: 200000,
      cashAfter: 100000,
      salaryBefore: 24000,
      salaryAfter: 34000,
      marketValueBefore: 40000,
      marketValueAfter: 140000,
      rosterBefore: 6,
      rosterAfter: 7,
      purchasePrice: 100000,
      salary: 10000,
      contractLength: 1,
      currentValue: 100000,
      joinedSeasonId: "season-1",
      activePlayerCreated: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      activePlayerId: "local-roster:save-singleplayer-dev:player-1",
      transferId: "local-transfer:save-singleplayer-dev:player-1",
    });

    const { POST } = await import("@/app/api/transfermarkt/buy/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/buy", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          playerId: "player-1",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(executeLocalTransfermarktBuy).toHaveBeenCalledTimes(1);
    expect(previewLocalTransfermarktBuy).not.toHaveBeenCalled();
    expect(body.summary.activePlayerCreated).toBe(true);
    expect(body.scope).toMatchObject({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "M-M",
      playerId: "player-1",
      dryRun: false,
      source: "sqlite",
    });
  });

  it("blocks buys in prisma read-only mode", async () => {
    const { POST } = await import("@/app/api/transfermarkt/buy/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/buy", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-initial",
          seasonId: "season-1",
          teamId: "A-A",
          playerId: "player-1",
          source: "prisma",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain("read-only");
    expect(previewLocalTransfermarktBuy).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/transfermarkt/buy/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/buy", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          source: "sqlite",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("blocks buys outside the transfer/setup phase", async () => {
    persistenceMocks.getSaveById.mockReturnValue(phaseSave("season_completed"));

    const { POST } = await import("@/app/api/transfermarkt/buy/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/buy", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          playerId: "player-1",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("phase_blocked:buy_players:season_completed");
    expect(previewLocalTransfermarktBuy).not.toHaveBeenCalled();
  });
});
