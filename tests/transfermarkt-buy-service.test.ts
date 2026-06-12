import { describe, expect, it, vi } from "vitest";

import { executeTransfermarktBuy, previewTransfermarktBuy } from "@/lib/market/transfermarkt-buy-service";

function createDatabase(options?: {
  activePlayerRows?: Array<{ id: string; playerId: string; teamId: string; salary?: number; currentValue?: number; purchasePrice?: number }>;
  cash?: number;
  rosterLimit?: number;
  marketValue?: number | null;
  salaryDemand?: number | null;
}) {
  const activePlayerRows =
    options?.activePlayerRows ??
    Array.from({ length: 6 }, (_, index) => ({
      id: `active-${index + 1}`,
      playerId: `roster-${index + 1}`,
      teamId: "A-A",
      salary: 4000,
    }));
  const activePlayerCreate = vi.fn(async () => ({}));
  const transferCreate = vi.fn(async () => ({}));
  const teamSeasonStateUpdate = vi.fn(async () => ({}));

  return {
    save: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "save-initial" ? { id: "save-initial" } : null,
      ),
    },
    season: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "season-1" ? { id: "season-1", saveId: "save-initial" } : null,
      ),
    },
    team: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "A-A" ? { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" } : null,
      ),
    },
    teamSeasonState: {
      findUnique: vi.fn(async () => ({
        id: "state-1",
        saveId: "save-initial",
        seasonId: "season-1",
        teamId: "A-A",
        cash: options?.cash ?? 250000,
        rosterLimit: options?.rosterLimit ?? 10,
      })),
      update: teamSeasonStateUpdate,
    },
    player: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "player-1"
          ? {
              id: "player-1",
              name: "Citrine Miri",
              className: "Warlord",
              race: "Demon",
              attributes:
                options?.marketValue === null && options?.salaryDemand === null
                  ? null
                  : {
                      marketValue: options?.marketValue === undefined ? 100000 : options.marketValue,
                      salaryDemand: options?.salaryDemand === undefined ? 10000 : options.salaryDemand,
                    },
            }
          : null,
      ),
    },
    activePlayer: {
      findMany: vi.fn(async ({ where }: { where: { teamId?: string; OR?: Array<{ playerId: string }>; saveId: string; seasonId: string } }) => {
        if (where.teamId === "A-A") {
          return activePlayerRows;
        }
        return activePlayerRows.filter((row) => where.OR?.some((entry) => entry.playerId === row.playerId));
      }),
      create: activePlayerCreate,
    },
    transfer: {
      create: transferCreate,
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        activePlayer: { create: activePlayerCreate },
        transfer: { create: transferCreate },
        teamSeasonState: { update: teamSeasonStateUpdate },
      }),
    ),
    __mocks: {
      activePlayerCreate,
      transferCreate,
      teamSeasonStateUpdate,
    },
  };
}

describe("transfermarkt buy service", () => {
  it("blocks preview when player is not a free agent", async () => {
    const database = createDatabase({
      activePlayerRows: [{ id: "active-existing", playerId: "player-1", teamId: "B-B", salary: 5000 }],
    });

    const result = await previewTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(false);
    expect(result.blockingReasons).toContain("player_not_free_agent_in_scope");
  });

  it("blocks preview when cash is insufficient", async () => {
    const database = createDatabase({ cash: 50000 });
    const result = await previewTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(false);
    expect(result.blockingReasons).toContain("insufficient_cash");
  });

  it("blocks preview when market value is missing", async () => {
    const database = createDatabase({ marketValue: null });
    const result = await previewTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(false);
    expect(result.blockingReasons).toContain("market_value_missing");
  });

  it("blocks preview when salary demand is missing", async () => {
    const database = createDatabase({ salaryDemand: null });
    const result = await previewTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(false);
    expect(result.blockingReasons).toContain("salary_demand_missing");
  });

  it("blocks preview when roster is full", async () => {
    const database = createDatabase({
      activePlayerRows: Array.from({ length: 10 }, (_, index) => ({
        id: `full-${index + 1}`,
        playerId: `roster-${index + 1}`,
        teamId: "A-A",
        salary: 3000,
      })),
      rosterLimit: 10,
    });
    const result = await previewTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(false);
    expect(result.blockingReasons).toContain("roster_limit_reached");
  });

  it("writes ActivePlayer, Transfer and TeamSeasonState on execute", async () => {
    const database = createDatabase();
    const result = await executeTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(true);
    expect(result.marketValueBefore).toBe(0);
    expect(result.marketValueAfter).toBe(100000);
    expect(result.activePlayerCreated).toBe(true);
    expect(result.transferCreated).toBe(true);
    expect(result.teamSeasonStateUpdated).toBe(true);
    expect(database.__mocks.activePlayerCreate).toHaveBeenCalledTimes(1);
    expect(database.__mocks.transferCreate).toHaveBeenCalledTimes(1);
    expect(database.__mocks.teamSeasonStateUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not write anything when execute is blocked", async () => {
    const database = createDatabase({ cash: 1 });
    const result = await executeTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.canBuy).toBe(false);
    expect(result.marketValueBefore).toBe(0);
    expect(database.__mocks.activePlayerCreate).not.toHaveBeenCalled();
    expect(database.__mocks.transferCreate).not.toHaveBeenCalled();
    expect(database.__mocks.teamSeasonStateUpdate).not.toHaveBeenCalled();
  });

  it("recomputes before and after values for roster, salary, cash and team market value", async () => {
    const database = createDatabase({
      activePlayerRows: [
        { id: "active-1", playerId: "roster-1", teamId: "A-A", salary: 4000, currentValue: 15000, purchasePrice: 15000 },
        { id: "active-2", playerId: "roster-2", teamId: "A-A", salary: 6000, currentValue: 25000, purchasePrice: 25000 },
      ],
      cash: 200000,
      marketValue: 100000,
      salaryDemand: 10000,
    });

    const result = await previewTransfermarktBuy(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      database as never,
    );

    expect(result.rosterBefore).toBe(2);
    expect(result.rosterAfter).toBe(3);
    expect(result.salaryBefore).toBe(10000);
    expect(result.salaryAfter).toBe(20000);
    expect(result.cashBefore).toBe(200000);
    expect(result.cashAfter).toBe(100000);
    expect(result.marketValueBefore).toBe(40000);
    expect(result.marketValueAfter).toBe(140000);
  });
});
