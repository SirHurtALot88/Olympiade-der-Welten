import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.fn();
const readFile = vi.fn();
const readNormalizedPrizeMoneyRows = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    access,
    readFile,
  },
}));

vi.mock("@/lib/season/prize-money-sheet", () => ({
  PRIZE_MONEY_NORMALIZED_CSV_PATH: "/tmp/prize-money-table.normalized.csv",
  PRIZE_MONEY_NORMALIZED_JSON_PATH: "/tmp/prize-money-table.normalized.json",
  readNormalizedPrizeMoneyRows,
}));

describe("audit prize money normalized", () => {
  beforeEach(() => {
    access.mockReset();
    readFile.mockReset();
    readNormalizedPrizeMoneyRows.mockReset();
  });

  it("accepts a complete normalized table with 32 ranks", async () => {
    access.mockResolvedValue(undefined);
    readFile.mockResolvedValue(JSON.stringify({ selectedBlock: { id: "r2c6" } }));
    readNormalizedPrizeMoneyRows.mockResolvedValue(
      Array.from({ length: 32 }, (_, index) => ({
        rank: index + 1,
        prizeMoney: 100 - index,
        sourceRow: index + 3,
      })),
    );

    const { auditPrizeMoneyNormalized } = await import("@/scripts/audit-prize-money-normalized");
    const result = await auditPrizeMoneyNormalized();

    expect(result.status).toBe("ok");
    expect(result.rowsCount).toBe(32);
    expect(result.minRank).toBe(1);
    expect(result.maxRank).toBe(32);
    expect(result.missingRanks).toEqual([]);
    expect(result.duplicateRanks).toEqual([]);
    expect(result.invalidPrizeValues).toEqual([]);
  });

  it("blocks duplicate ranks", async () => {
    access.mockResolvedValue(undefined);
    readFile.mockResolvedValue(JSON.stringify({ selectedBlock: { id: "r2c6" } }));
    readNormalizedPrizeMoneyRows.mockResolvedValue([
      { rank: 1, prizeMoney: 91.4, sourceRow: 3 },
      { rank: 1, prizeMoney: 88, sourceRow: 4 },
    ]);

    const { auditPrizeMoneyNormalized } = await import("@/scripts/audit-prize-money-normalized");
    const result = await auditPrizeMoneyNormalized();

    expect(result.status).toBe("blocked");
    expect(result.duplicateRanks).toEqual([1]);
  });

  it("blocks invalid prize values", async () => {
    access.mockResolvedValue(undefined);
    readFile.mockResolvedValue(JSON.stringify({ selectedBlock: { id: "r2c6" } }));
    readNormalizedPrizeMoneyRows.mockResolvedValue([
      { rank: 1, prizeMoney: 91.4, sourceRow: 3 },
      { rank: 2, prizeMoney: null, sourceRow: 4 },
    ]);

    const { auditPrizeMoneyNormalized } = await import("@/scripts/audit-prize-money-normalized");
    const result = await auditPrizeMoneyNormalized();

    expect(result.status).toBe("blocked");
    expect(result.invalidPrizeValues).toEqual([{ rank: 2, value: null, sourceRow: 4 }]);
  });
});
