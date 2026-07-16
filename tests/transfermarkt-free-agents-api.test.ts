import { beforeEach, describe, expect, it, vi } from "vitest";

const listTransfermarktFreeAgents = vi.fn();
const listLocalTransfermarktFreeAgents = vi.fn();

vi.mock("@/lib/market/transfermarkt-read-service", () => ({
  listTransfermarktFreeAgents,
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  listLocalTransfermarktFreeAgents,
}));

describe("transfermarkt free agents api", () => {
  beforeEach(() => {
    listTransfermarktFreeAgents.mockReset();
    listLocalTransfermarktFreeAgents.mockReset();
  });

  it("defaults to the local sqlite free-agent source when source is missing", async () => {
    listLocalTransfermarktFreeAgents.mockReturnValue({
      items: [{ playerId: "player-1", name: "Arkon" }],
      total: 1,
      offset: 0,
      limit: 5,
      returned: 1,
      hasMore: false,
      source: "derived_free_agents",
      scope: { saveId: "save-singleplayer-dev", seasonId: "season-1", teamId: null },
      teamContext: null,
      notes: ["SQLite/local free agents derived directly from the active singleplayer save."],
      warnings: [],
      poolAudit: {
        activeFreeAgentCount: 1,
        visibleFeedCount: 1,
        marketValueBuckets: [
          { label: "0-5", count: 0 },
          { label: "5-10", count: 0 },
          { label: "10-20", count: 1 },
          { label: "20-30", count: 0 },
          { label: "30-50", count: 0 },
          { label: "50+", count: 0 },
        ],
        cheapestVisiblePlayer: { playerId: "player-1", name: "Arkon", marketValue: 18 },
        cheapestBuyablePlayer: null,
        cheapestCandidatePoolPlayer: null,
      },
    });

    const { GET } = await import("@/app/api/transfermarkt/free-agents/route");
    const response = await GET(new Request("http://localhost/api/transfermarkt/free-agents?search=ark&limit=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listLocalTransfermarktFreeAgents).toHaveBeenCalledWith({
      saveId: null,
      seasonId: null,
      teamId: null,
      limit: 5,
      offset: null,
      search: "ark",
      minMarketValue: null,
      maxMarketValue: null,
      scoutingLevel: null,
    });
    expect(listTransfermarktFreeAgents).not.toHaveBeenCalled();
    expect(body.total).toBe(1);
    expect(body.scope.saveId).toBe("save-singleplayer-dev");
    expect(body.source).toBe("derived_free_agents");
    expect(body.teamContext).toBeNull();
    expect(body.warnings).toEqual([]);
    expect(body.poolAudit.activeFreeAgentCount).toBe(1);
    expect(body.poolAudit.visibleFeedCount).toBe(1);
  });

  it("uses the prisma read service only when source=prisma is explicit", async () => {
    listTransfermarktFreeAgents.mockResolvedValue({
      items: [{ playerId: "player-1", name: "Arkon" }],
      total: 1,
      offset: 0,
      limit: 100,
      returned: 1,
      hasMore: false,
      source: "derived_free_agents",
      scope: { saveId: "save-initial", seasonId: "season-1", teamId: null },
      teamContext: null,
      notes: ["No Prisma TransferListing model exists yet."],
      warnings: [],
      poolAudit: {
        activeFreeAgentCount: 1,
        visibleFeedCount: 1,
        marketValueBuckets: [
          { label: "0-5", count: 0 },
          { label: "5-10", count: 0 },
          { label: "10-20", count: 1 },
          { label: "20-30", count: 0 },
          { label: "30-50", count: 0 },
          { label: "50+", count: 0 },
        ],
        cheapestVisiblePlayer: { playerId: "player-1", name: "Arkon", marketValue: 18 },
        cheapestBuyablePlayer: null,
        cheapestCandidatePoolPlayer: null,
      },
    });

    const { GET } = await import("@/app/api/transfermarkt/free-agents/route");
    const response = await GET(
      new Request("http://localhost/api/transfermarkt/free-agents?source=prisma&saveId=save-initial&seasonId=season-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listTransfermarktFreeAgents).toHaveBeenCalledWith({
      saveId: "save-initial",
      seasonId: "season-1",
      teamId: null,
      limit: null,
      offset: null,
      search: null,
      minMarketValue: null,
      maxMarketValue: null,
      scoutingLevel: null,
    });
    expect(listLocalTransfermarktFreeAgents).not.toHaveBeenCalled();
    expect(body.scope.saveId).toBe("save-initial");
    expect(body.poolAudit.activeFreeAgentCount).toBe(1);
  });

  it("returns a clear error when the service fails", async () => {
    listTransfermarktFreeAgents.mockRejectedValue(new Error("DATABASE_URL is missing."));

    const { GET } = await import("@/app/api/transfermarkt/free-agents/route");
    const response = await GET(new Request("http://localhost/api/transfermarkt/free-agents?source=prisma"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("DATABASE_URL");
    expect(body.items).toEqual([]);
    expect(body.warnings).toEqual([]);
    expect(body.poolAudit.activeFreeAgentCount).toBe(0);
    expect(body.poolAudit.visibleFeedCount).toBe(0);
  });
});
