import { beforeEach, describe, expect, it, vi } from "vitest";

const previewLocalTransfermarktSell = vi.fn();
const executeLocalTransfermarktSell = vi.fn();
const persistenceMocks = vi.hoisted(() => ({
  getSaveById: vi.fn(),
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  previewLocalTransfermarktSell,
  executeLocalTransfermarktSell,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: persistenceMocks.getSaveById,
  }),
}));

function phaseSave(gamePhase = "transfer_sell_phase") {
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

describe("transfermarkt sell api", () => {
  beforeEach(() => {
    previewLocalTransfermarktSell.mockReset();
    executeLocalTransfermarktSell.mockReset();
    persistenceMocks.getSaveById.mockReset();
    persistenceMocks.getSaveById.mockReturnValue(phaseSave());
  });

  it("uses the local sqlite dry-run path by default", async () => {
    previewLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Selene Dusk", className: "Overseer", race: "Human" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      activePlayer: {
        id: "active-1",
        playerId: "player-1",
        status: "active",
        roleTag: "bench",
        contractLength: 1,
        salary: 4000,
        purchasePrice: 50000,
        currentValue: 52000,
        joinedSeasonId: "season-1",
      },
      cashBefore: 200000,
      cashAfter: 252000,
      rosterBefore: 8,
      rosterAfter: 7,
      teamSalaryBefore: 32000,
      teamSalaryAfter: 28000,
      salePrice: 52000,
      salaryReduction: 4000,
      projectedReadinessAfterSell: "ready",
    });

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(previewLocalTransfermarktSell).toHaveBeenCalledTimes(1);
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(body.success).toBe(true);
  });

  it("writes through the local sqlite execute path when dryRun is false", async () => {
    executeLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Selene Dusk", className: "Overseer", race: "Human" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      activePlayer: {
        id: "active-1",
        playerId: "player-1",
        status: "active",
        roleTag: "bench",
        contractLength: 1,
        salary: 4000,
        purchasePrice: 50000,
        currentValue: 52000,
        joinedSeasonId: "season-1",
      },
      cashBefore: 200000,
      cashAfter: 252000,
      rosterBefore: 8,
      rosterAfter: 7,
      teamSalaryBefore: 32000,
      teamSalaryAfter: 28000,
      salePrice: 52000,
      salaryReduction: 4000,
      projectedReadinessAfterSell: "ready",
      activePlayerRemoved: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      transferId: "local-transfer:save-singleplayer-dev:player-1",
    });

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(executeLocalTransfermarktSell).toHaveBeenCalledTimes(1);
    expect(previewLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(body.summary.activePlayerRemoved).toBe(true);
  });

  it("blocks sells in prisma read-only mode", async () => {
    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-initial",
          seasonId: "season-1",
          teamId: "A-A",
          activePlayerId: "active-1",
          source: "prisma",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain("read-only");
    expect(previewLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
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

  it("blocks sells outside the transfer/setup phase", async () => {
    persistenceMocks.getSaveById.mockReturnValue(phaseSave("season_completed"));

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("phase_blocked:sell_players:season_completed");
    expect(previewLocalTransfermarktSell).not.toHaveBeenCalled();
  });
});
