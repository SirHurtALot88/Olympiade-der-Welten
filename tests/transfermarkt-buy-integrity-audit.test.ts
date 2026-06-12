import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = {
  player: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  teamSeasonState: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  activePlayer: {
    findMany: vi.fn(),
  },
  transfer: {
    findMany: vi.fn(),
  },
  matchday: {
    findFirst: vi.fn(),
  },
};

const mockListTransfermarktFreeAgents = vi.fn();
const mockBuildLegacyMatchdayReadiness = vi.fn();
const mockLoadLegacyLineupContext = vi.fn();

vi.mock("@/src/server/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/market/transfermarkt-read-service", () => ({
  listTransfermarktFreeAgents: mockListTransfermarktFreeAgents,
}));

vi.mock("@/lib/lineups/legacy-matchday-readiness", () => ({
  buildLegacyMatchdayReadiness: mockBuildLegacyMatchdayReadiness,
}));

vi.mock("@/lib/lineups/legacy-lineup-context-loader", () => ({
  LegacyLineupContextLoader: class {
    loadLegacyLineupContext = mockLoadLegacyLineupContext;
  },
}));

vi.mock("@/lib/lineups/legacy-lineup-repository", () => ({
  LegacyLineupRepository: class {},
}));

describe("transfermarkt buy integrity audit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("detects a correct completed buy without writes", async () => {
    mockDb.player.findUnique.mockResolvedValue(null);
    mockDb.player.findFirst.mockResolvedValue({ id: "player-k", name: "Kloeschen" });
    mockDb.teamSeasonState.findUnique.mockResolvedValue({
      cash: 810000,
      playerMin: 7,
      playerOpt: 10,
    });
    mockDb.teamSeasonState.findMany.mockResolvedValue([{ teamId: "W-W" }, { teamId: "A-A" }]);
    mockDb.activePlayer.findMany
      .mockResolvedValueOnce([
        {
          teamId: "W-W",
          saveId: "save-initial",
          seasonId: "season-1",
          salary: 1000,
          purchasePrice: 5000,
          currentValue: 5000,
          contractLength: 1,
          joinedSeasonId: "season-1",
        },
      ])
      .mockResolvedValueOnce([{ salary: 1000 }, { salary: 9000 }]);
    mockDb.transfer.findMany.mockResolvedValue([
      {
        type: "buy",
        toTeamId: "W-W",
        fromTeamId: null,
        fee: 5000,
        salary: 1000,
        marketValue: 5000,
        happenedAt: new Date("2026-06-03T12:00:00.000Z"),
      },
    ]);
    mockDb.matchday.findFirst.mockResolvedValue({ id: "matchday-1" });
    mockListTransfermarktFreeAgents.mockResolvedValue({ items: [] });
    mockLoadLegacyLineupContext
      .mockResolvedValueOnce({ ok: true, context: { team: { id: "W-W" } } })
      .mockResolvedValueOnce({ ok: true, context: { team: { id: "A-A" } } });
    mockBuildLegacyMatchdayReadiness
      .mockReturnValueOnce({ teamId: "W-W", readinessStatus: "missing_lineup" })
      .mockReturnValueOnce({ teamId: "A-A", readinessStatus: "underfilled_roster" });

    const { buildTransfermarktBuyIntegrityAudit } = await import(
      "@/scripts/audit-transfermarkt-buy-integrity"
    );

    const result = await buildTransfermarktBuyIntegrityAudit({
      saveId: "save-initial",
      seasonId: "season-1",
      teamId: "W-W",
      playerName: "Kloeschen",
    });

    expect(result.player?.name).toBe("Kloeschen");
    expect(result.activePlayerMatches).toBe(1);
    expect(result.activePlayer?.salary).toBe(1000);
    expect(result.activePlayer?.purchasePrice).toBe(5000);
    expect(result.transferMatches).toBe(1);
    expect(result.transfer?.fee).toBe(5000);
    expect(result.teamSeasonState?.cash).toBe(810000);
    expect(result.teamSeasonState?.rosterCount).toBe(2);
    expect(result.teamSeasonState?.teamSalary).toBe(10000);
    expect(result.freeAgentStillVisible).toBe(false);
    expect(result.readinessStatus).toBe("missing_lineup");
    expect(result.teamsUnderfilled).toBe(1);
  });
});
