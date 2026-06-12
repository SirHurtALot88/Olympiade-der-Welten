import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listTransferHistory, type TransferHistoryReadResult } from "@/lib/market/transfer-history-read-service";

describe("transfer history read service", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://example";
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("returns the Kloeschen buy row in normalized read-only form", async () => {
    const mockDb = {
      save: {
        findUnique: async () => ({ id: "save-initial" }),
        findFirst: async () => ({ id: "save-initial" }),
      },
      season: {
        findFirst: async () => ({ id: "season-1", saveId: "save-initial" }),
      },
      transfer: {
        findMany: async () => [
          {
            id: "transfer-1",
            saveId: "save-initial",
            seasonId: "season-1",
            playerId: "player-k",
            fromTeamId: null,
            toTeamId: "W-W",
            type: "buy" as const,
            fee: 5000,
            salary: 1000,
            marketValue: 5000,
            remainingContractLength: 3,
            happenedAt: new Date("2026-06-03T18:58:31.102Z"),
            player: { id: "player-k", name: "Kloeschen" },
            fromTeam: null,
            toTeam: { id: "W-W", name: "Wicked Wizards" },
          },
        ],
      },
    };

    const result = (await listTransferHistory(
      { saveId: "save-initial", seasonId: "season-1" },
      mockDb as never,
    )) as TransferHistoryReadResult;

    expect(result.total).toBe(1);
    expect(result.items[0]?.playerName).toBe("Kloeschen");
    expect(result.items[0]?.toTeamId).toBe("W-W");
    expect(result.items[0]?.fee).toBe(5000);
    expect(result.items[0]?.salary).toBe(1000);
    expect(result.scope.saveId).toBe("save-initial");
    expect(result.saveContext.source).toBe("prisma");
    expect(result.saveContext.requestedSaveId).toBe("save-initial");
    expect(result.saveContext.resolvedSaveId).toBe("save-initial");
    expect(result.saveContext.scopeWarning).toBeNull();
    expect(result.items[0]?.seasonLabel).toBe("season-1");
    expect(result.items[0]?.matchdayId).toBeNull();
    expect(result.items[0]?.phase).toBeNull();
    expect(result.items[0]?.remainingContractLength).toBe(3);
  });

  it("passes team and limit filters into the read query", async () => {
    const calls: Array<unknown> = [];
    const mockDb = {
      save: {
        findUnique: async () => ({ id: "save-initial" }),
        findFirst: async () => ({ id: "save-initial" }),
      },
      season: {
        findFirst: async () => ({ id: "season-1", saveId: "save-initial" }),
      },
      transfer: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [];
        },
      },
    };

    await listTransferHistory(
      { saveId: "save-initial", seasonId: "season-1", teamId: "W-W", limit: 5 },
      mockDb as never,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      where: {
        saveId: "save-initial",
        seasonId: "season-1",
        OR: [{ fromTeamId: "W-W" }, { toTeamId: "W-W" }],
      },
      take: 5,
    });
  });

  it("returns a scoped warning instead of silently falling back when an explicit save cannot be resolved", async () => {
    const mockDb = {
      save: {
        findUnique: async () => null,
        findFirst: async () => ({ id: "save-initial", name: "Initial Save", status: "active" }),
      },
      season: {
        findFirst: async () => ({ id: "season-1", saveId: "save-initial" }),
      },
      transfer: {
        findMany: async () => {
          throw new Error("should not query transfers for an invalid explicit save");
        },
      },
    };

    const result = await listTransferHistory({ saveId: "missing-save", seasonId: "season-1" }, mockDb as never);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.saveContext.requestedSaveId).toBe("missing-save");
    expect(result.saveContext.resolvedSaveId).toBeNull();
    expect(result.saveContext.scopeWarning).toContain("missing-save");
  });
});
