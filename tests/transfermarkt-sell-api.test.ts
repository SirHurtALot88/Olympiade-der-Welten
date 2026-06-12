import { beforeEach, describe, expect, it, vi } from "vitest";

const previewLocalTransfermarktSell = vi.fn();
const executeLocalTransfermarktSell = vi.fn();

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  previewLocalTransfermarktSell,
  executeLocalTransfermarktSell,
}));

describe("transfermarkt sell api", () => {
  beforeEach(() => {
    previewLocalTransfermarktSell.mockReset();
    executeLocalTransfermarktSell.mockReset();
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
          teamId: "A-A",
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
          teamId: "A-A",
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
});
