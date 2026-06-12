import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAiTransfermarktSellPreview = vi.fn();

vi.mock("@/lib/ai/ai-transfermarkt-sell-preview-service", () => ({
  buildAiTransfermarktSellPreview,
}));

describe("ai transfermarkt sell preview api", () => {
  beforeEach(() => {
    buildAiTransfermarktSellPreview.mockReset();
  });

  it("uses local sqlite preview by default and stays read-only", async () => {
    buildAiTransfermarktSellPreview.mockResolvedValue({
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
      readyTeams: 1,
      warningTeams: 1,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/transfermarkt/ai-sell-preview/route");
    const response = await GET(
      new Request("http://localhost/api/transfermarkt/ai-sell-preview?saveId=save-local&seasonId=season-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiTransfermarktSellPreview).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: null,
      teamScope: "ai",
      limit: null,
    });
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("sqlite");
  });

  it("forwards prisma read-only params explicitly", async () => {
    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "prisma",
      scope: {
        saveId: "save-ref",
        seasonId: "season-2",
        teamId: "W-W",
        teamScope: "all",
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 0,
      warningTeams: 1,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/transfermarkt/ai-sell-preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/transfermarkt/ai-sell-preview?saveId=save-ref&seasonId=season-2&teamId=W-W&teamScope=all&source=prisma&limit=4",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiTransfermarktSellPreview).toHaveBeenCalledWith({
      source: "prisma",
      saveId: "save-ref",
      seasonId: "season-2",
      teamId: "W-W",
      teamScope: "all",
      limit: 4,
    });
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("prisma");
  });

  it("returns a structured read-only error payload on failure", async () => {
    buildAiTransfermarktSellPreview.mockRejectedValue(new Error("SQLite save could not be loaded."));

    const { GET } = await import("@/app/api/transfermarkt/ai-sell-preview/route");
    const response = await GET(new Request("http://localhost/api/transfermarkt/ai-sell-preview"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.readOnly).toBe(true);
    expect(body.teams).toEqual([]);
    expect(body.error).toContain("could not be loaded");
  });

  it("supports the dedicated ai sell preview alias route", async () => {
    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: "A-I",
        teamScope: "all",
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 1,
      warningTeams: 0,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/ai/sell-preview/route");
    const response = await GET(
      new Request("http://localhost/api/ai/sell-preview?saveId=save-local&seasonId=season-1&teamCode=A-I&onlyAiTeams=false&limitPerTeam=3"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiTransfermarktSellPreview).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "A-I",
      teamScope: "all",
      limit: 3,
    });
    expect(body.readOnly).toBe(true);
    expect(body.aiTeams).toBe(1);
  });
});
