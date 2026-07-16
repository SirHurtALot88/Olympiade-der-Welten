import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAiMarketPlanPreview = vi.fn();

vi.mock("@/lib/ai/ai-market-plan-preview-service", () => ({
  buildAiMarketPlanPreview,
}));

describe("ai market plan preview api", () => {
  beforeEach(() => {
    buildAiMarketPlanPreview.mockReset();
  });

  it("uses local sqlite preview by default and stays read-only", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: null,
        teamScope: "ai",
      },
      totalTeams: 2,
      aiTeams: 2,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 1,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 2,
        ready: 2,
        hold: 0,
        buyOnly: 1,
        sellOnly: 1,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [],
    });

    const { GET } = await import("@/app/api/ai/market-plan-preview/route");
    const response = await GET(
      new Request("http://localhost/api/ai/market-plan-preview?saveId=save-local&seasonId=season-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiMarketPlanPreview).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: null,
      teamScope: "ai",
      buyLimit: null,
      sellLimit: null,
    });
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("sqlite");
  });

  it("forwards prisma read-only params explicitly", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "prisma",
      scope: {
        saveId: "save-ref",
        seasonId: "season-2",
        teamId: "Z-H",
        teamScope: "all",
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 0,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 1,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 1,
        hold: 0,
        buyOnly: 0,
        sellOnly: 0,
        sellThenBuy: 1,
        warning: 0,
        blocked: 0,
      },
      teams: [],
    });

    const { GET } = await import("@/app/api/ai/market-plan-preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/ai/market-plan-preview?saveId=save-ref&seasonId=season-2&teamId=Z-H&teamScope=all&source=prisma&buyLimit=25&sellLimit=4",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiMarketPlanPreview).toHaveBeenCalledWith({
      source: "prisma",
      saveId: "save-ref",
      seasonId: "season-2",
        teamId: "Z-H",
        teamScope: "all",
      buyLimit: 25,
      sellLimit: 4,
    });
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("prisma");
  });

  it("returns a structured read-only error payload on failure", async () => {
    buildAiMarketPlanPreview.mockRejectedValue(new Error("SQLite save could not be loaded."));

    const { GET } = await import("@/app/api/ai/market-plan-preview/route");
    const response = await GET(new Request("http://localhost/api/ai/market-plan-preview"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.readOnly).toBe(true);
    expect(body.teams).toEqual([]);
    expect(body.blockedTeams).toBe(0);
    expect(body.error).toContain("could not be loaded");
  });

  it("accepts teamCode, onlyAiTeams and per-team limit aliases", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: "C-C",
        teamScope: "all",
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 1,
      buyOnlyTeams: 0,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 0,
        hold: 1,
        buyOnly: 0,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [],
    });

    const { GET } = await import("@/app/api/ai/market-plan-preview/route");
    const response = await GET(
      new Request("http://localhost/api/ai/market-plan-preview?saveId=save-local&seasonId=season-1&teamCode=C-C&onlyAiTeams=false&limitBuysPerTeam=3&limitSellsPerTeam=2"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiMarketPlanPreview).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "C-C",
      teamScope: "all",
      buyLimit: 3,
      sellLimit: 2,
    });
    expect(body.summary.hold).toBe(1);
  });
});
