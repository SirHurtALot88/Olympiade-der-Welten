import { beforeEach, describe, expect, it, vi } from "vitest";

const listTransferHistory = vi.fn();
const listLocalTransferHistory = vi.fn();

vi.mock("@/lib/market/transfer-history-read-service", () => ({
  listTransferHistory,
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  listLocalTransferHistory,
}));

describe("transfer history api", () => {
  beforeEach(() => {
    listTransferHistory.mockReset();
    listLocalTransferHistory.mockReset();
  });

  it("defaults to the local sqlite history source when source is missing", async () => {
    listLocalTransferHistory.mockResolvedValue({
      items: [
        {
          transferId: "transfer-1",
          type: "buy",
          playerId: "player-k",
          playerName: "Kloeschen",
          fromTeamId: null,
          fromTeamName: null,
          toTeamId: "A-A",
          toTeamName: "Armageddon Aftermath",
          fee: 5000,
          salary: 1000,
          marketValue: 5000,
          happenedAt: "2026-06-03T18:58:31.102Z",
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          seasonLabel: "Season 1",
          matchdayId: "matchday-1",
          phase: "manual_transfer_window",
          source: "manual_transfermarkt_buy",
          remainingContractLength: 3,
        },
      ],
      total: 1,
      offset: 0,
      limit: 5,
      returned: 1,
      hasMore: false,
      scope: { saveId: "save-singleplayer-dev", seasonId: "season-1", teamId: null, type: null },
      saveContext: {
        source: "sqlite",
        requestedSaveId: null,
        resolvedSaveId: "save-singleplayer-dev",
        requestedSeasonId: null,
        resolvedSeasonId: "season-1",
        saveName: "Singleplayer Dev",
        saveStatus: "active",
        scopeWarning: null,
      },
    });

    const { GET } = await import("@/app/api/transfermarkt/history/route");
    const response = await GET(new Request("http://localhost/api/transfermarkt/history?limit=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listLocalTransferHistory).toHaveBeenCalledWith({
      saveId: undefined,
      seasonId: undefined,
      allSeasons: false,
      teamId: null,
      type: null,
      limit: 5,
      offset: undefined,
    });
    expect(listTransferHistory).not.toHaveBeenCalled();
    expect(body.total).toBe(1);
    expect(body.items[0]?.playerName).toBe("Kloeschen");
    expect(body.scope.seasonId).toBe("season-1");
    expect(body.saveContext.resolvedSaveId).toBe("save-singleplayer-dev");
    expect(body.items[0]?.matchdayId).toBe("matchday-1");
    expect(body.items[0]?.phase).toBe("manual_transfer_window");
  });

  it("uses the prisma history source only when source=prisma is explicit", async () => {
    listTransferHistory.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 5,
      returned: 0,
      hasMore: false,
      scope: { saveId: "save-initial", seasonId: "season-1", teamId: null, type: null },
      saveContext: {
        source: "prisma",
        requestedSaveId: "save-initial",
        resolvedSaveId: "save-initial",
        requestedSeasonId: "season-1",
        resolvedSeasonId: "season-1",
        saveName: "Initial Save",
        saveStatus: "active",
        scopeWarning: null,
      },
    });

    const { GET } = await import("@/app/api/transfermarkt/history/route");
    const response = await GET(
      new Request("http://localhost/api/transfermarkt/history?source=prisma&saveId=save-initial&seasonId=season-1&limit=5"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listTransferHistory).toHaveBeenCalledWith({
      saveId: "save-initial",
      seasonId: "season-1",
      allSeasons: false,
      teamId: null,
      type: null,
      limit: 5,
      offset: undefined,
    });
    expect(listLocalTransferHistory).not.toHaveBeenCalled();
    expect(body.scope.saveId).toBe("save-initial");
    expect(body.saveContext.source).toBe("prisma");
  });

  it("returns a clear error without pretending the list is just empty", async () => {
    listTransferHistory.mockRejectedValue(new Error("Transfer history could not be loaded."));

    const { GET } = await import("@/app/api/transfermarkt/history/route");
    const response = await GET(new Request("http://localhost/api/transfermarkt/history?source=prisma"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("Transfer history could not be loaded");
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("keeps explicit invalid local save requests scoped and warns instead of faking another save", async () => {
    listLocalTransferHistory.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 5,
      returned: 0,
      hasMore: false,
      scope: { saveId: "missing-save", seasonId: "season-1", teamId: null, type: null },
      saveContext: {
        source: "sqlite",
        requestedSaveId: "missing-save",
        resolvedSaveId: null,
        requestedSeasonId: "season-1",
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: "Requested save missing-save could not be resolved for local transfer history.",
      },
    });

    const { GET } = await import("@/app/api/transfermarkt/history/route");
    const response = await GET(
      new Request("http://localhost/api/transfermarkt/history?saveId=missing-save&seasonId=season-1&limit=5"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.saveContext.requestedSaveId).toBe("missing-save");
    expect(body.saveContext.scopeWarning).toContain("missing-save");
  });
});
