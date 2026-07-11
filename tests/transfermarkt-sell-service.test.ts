import { describe, expect, it, vi } from "vitest";

import { executeTransfermarktSell, previewTransfermarktSell } from "@/lib/market/transfermarkt-sell-service";

function createDatabase(options?: {
  activePlayerRow?: {
    id?: string;
    saveId?: string;
    seasonId?: string;
    teamId?: string;
    playerId?: string;
    status?: string;
    roleTag?: string;
    contractLength?: number;
    salary?: number;
    purchasePrice?: number | null;
    currentValue?: number | null;
    joinedSeasonId?: string;
    player?: { id: string; name: string; className: string; race: string } | null;
  } | null;
  rosterRows?: Array<{ id: string; salary: number }>;
  cash?: number;
  playerMin?: number;
  playerOpt?: number;
  lineupSlots?: Array<{ id: string; lineupId: string }>;
  readinessStatus?: string | null;
}) {
  const activePlayerDelete = vi.fn(async () => ({}));
  const transferCreate = vi.fn(async () => ({}));
  const teamSeasonStateUpdate = vi.fn(async () => ({}));

  const activePlayerRow =
    options?.activePlayerRow === null
      ? null
      : {
          id: options?.activePlayerRow?.id ?? "active-1",
          saveId: options?.activePlayerRow?.saveId ?? "save-initial",
          seasonId: options?.activePlayerRow?.seasonId ?? "season-1",
          teamId: options?.activePlayerRow?.teamId ?? "A-A",
          playerId: options?.activePlayerRow?.playerId ?? "player-1",
          status: options?.activePlayerRow?.status ?? "active",
          roleTag: options?.activePlayerRow?.roleTag ?? "bench",
          contractLength: options?.activePlayerRow?.contractLength ?? 1,
          salary: options?.activePlayerRow?.salary ?? 52,
          purchasePrice:
            options?.activePlayerRow && "purchasePrice" in options.activePlayerRow
              ? options.activePlayerRow.purchasePrice ?? null
              : 50000,
          currentValue:
            options?.activePlayerRow && "currentValue" in options.activePlayerRow
              ? options.activePlayerRow.currentValue ?? null
              : 52000,
          joinedSeasonId: options?.activePlayerRow?.joinedSeasonId ?? "season-1",
          player: options?.activePlayerRow?.player ?? {
            id: "player-1",
            name: "Selene Dusk",
            className: "Overseer",
            race: "Human",
          },
        };

  const rosterRows = options?.rosterRows ?? [
    { id: "active-1", salary: 4000 },
    { id: "active-2", salary: 4000 },
    { id: "active-3", salary: 4000 },
    { id: "active-4", salary: 4000 },
    { id: "active-5", salary: 4000 },
    { id: "active-6", salary: 4000 },
    { id: "active-7", salary: 4000 },
    { id: "active-8", salary: 4000 },
  ];

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
        cash: options?.cash ?? 200000,
        playerMin: options?.playerMin ?? 7,
        playerOpt: options?.playerOpt ?? 10,
      })),
      update: teamSeasonStateUpdate,
    },
    activePlayer: {
      findUnique: vi.fn(async () => activePlayerRow),
      findMany: vi.fn(async ({ where }: { where: { teamId: string } }) => (where.teamId === "A-A" ? rosterRows : [])),
      delete: activePlayerDelete,
    },
    matchday: {
      findFirst: vi.fn(async () => null),
    },
    lineupSlot: {
      findMany: vi.fn(async () => options?.lineupSlots ?? []),
    },
    transfer: {
      create: transferCreate,
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        transfer: { create: transferCreate },
        activePlayer: { delete: activePlayerDelete },
        teamSeasonState: { update: teamSeasonStateUpdate },
      }),
    ),
    __mocks: {
      activePlayerDelete,
      transferCreate,
      teamSeasonStateUpdate,
    },
  };
}

describe("transfermarkt sell service", () => {
  it("blocks preview for wrong team ownership", async () => {
    const database = createDatabase({
      activePlayerRow: {
        teamId: "B-B",
      },
    });

    const result = await previewTransfermarktSell(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", activePlayerId: "active-1" },
      database as never,
    );

    expect(result.canSell).toBe(false);
    expect(result.blockingReasons).toContain("active_player_not_in_team");
  });

  it("blocks preview when active player is missing", async () => {
    const database = createDatabase({
      activePlayerRow: null,
    });

    const result = await previewTransfermarktSell(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", activePlayerId: "missing" },
      database as never,
    );

    expect(result.canSell).toBe(false);
    expect(result.blockingReasons).toContain("active_player_not_found");
  });

  it("warns when selling drops the team below 7 players", async () => {
    const database = createDatabase({
      rosterRows: Array.from({ length: 7 }, (_, index) => ({ id: `active-${index + 1}`, salary: 4000 })),
    });

    const result = await previewTransfermarktSell(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", activePlayerId: "active-1" },
      database as never,
    );

    expect(result.warnings).toContain("team_would_fall_under_7");
  });

  it("warns when selling drops the team below playerMin", async () => {
    const database = createDatabase({
      playerMin: 8,
      rosterRows: Array.from({ length: 8 }, (_, index) => ({ id: `active-${index + 1}`, salary: 4000 })),
    });

    const result = await previewTransfermarktSell(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", activePlayerId: "active-1" },
      database as never,
    );

    expect(result.warnings).toContain("team_would_fall_under_player_min");
  });

  it("writes sell transfer, removes active player and increases cash", async () => {
    const database = createDatabase({
      activePlayerRow: {
        player: {
          id: "player-1",
          name: "Selene Dusk",
          className: "Overseer",
          race: "Human",
          attributes: {
            displayMarketValue: 520,
            marketValue: 520,
          },
        },
      },
    });

    const result = await executeTransfermarktSell(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", activePlayerId: "active-1" },
      database as never,
    );

    expect(result.canSell).toBe(true);
    expect(result.netProceeds).toBeCloseTo(468, 0);
    expect(result.buyoutCost).toBeCloseTo(52, 0);
    expect(result.transferCreated).toBe(true);
    expect(result.activePlayerRemoved).toBe(true);
    expect(result.teamSeasonStateUpdated).toBe(true);
    expect(database.__mocks.transferCreate).toHaveBeenCalledTimes(1);
    expect(database.__mocks.activePlayerDelete).toHaveBeenCalledTimes(1);
    expect(database.__mocks.teamSeasonStateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          cash: {
            increment: 468,
          },
        },
      }),
    );
  });

  it("does not write anything when preview is blocked", async () => {
    const database = createDatabase({
      activePlayerRow: {
        currentValue: null,
        purchasePrice: null,
      },
    });

    const result = await executeTransfermarktSell(
      { saveId: "save-initial", seasonId: "season-1", teamId: "A-A", activePlayerId: "active-1" },
      database as never,
    );

    expect(result.canSell).toBe(false);
    expect(database.__mocks.transferCreate).not.toHaveBeenCalled();
    expect(database.__mocks.activePlayerDelete).not.toHaveBeenCalled();
    expect(database.__mocks.teamSeasonStateUpdate).not.toHaveBeenCalled();
  });
});
