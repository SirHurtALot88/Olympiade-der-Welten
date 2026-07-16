import { beforeEach, describe, expect, it, vi } from "vitest";

const buildPrizeMoneyPreview = vi.fn();

vi.mock("@/lib/season/prize-money-preview", () => ({
  buildPrizeMoneyPreview,
}));

describe("prize money preview api", () => {
  beforeEach(() => {
    buildPrizeMoneyPreview.mockReset();
  });

  it("returns local read-only prize preview rows", async () => {
    buildPrizeMoneyPreview.mockResolvedValue({
      items: [
        {
          teamId: "W-W",
          teamCode: "W-W",
          teamName: "Wicked Wizards",
          rank: 1,
          points: 22,
          currentCash: 37.9,
          prizeMoney: 91.4,
          projectedCash: 129.3,
          status: "ready",
          warnings: [],
        },
      ],
      blockedRules: [],
      globalWarnings: [],
      summary: {
        totalTeams: 1,
        calculableTeams: 1,
        prizeRowsCount: 32,
        blockedItemsCount: 0,
      },
      source: {
        mode: "sqlite",
        standings: "local_save",
        prizeTable: "normalized_sheet",
      },
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
      },
    });

    const { GET } = await import("@/app/api/season/prize-preview/route");
    const response = await GET(new Request("http://localhost/api/season/prize-preview?saveId=save-local&seasonId=season-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildPrizeMoneyPreview).toHaveBeenCalledWith({
      saveId: "save-local",
      seasonId: "season-1",
      source: "sqlite",
      phase: "season_end",
    });
    expect(body.items[0]?.projectedCash).toBe(129.3);
  });
});
