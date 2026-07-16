import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAiTransfermarktPreview = vi.fn();

vi.mock("@/lib/ai/ai-transfermarkt-preview-service", () => ({
  buildAiTransfermarktPreview,
}));

describe("ai transfermarkt preview api", () => {
  beforeEach(() => {
    buildAiTransfermarktPreview.mockReset();
  });

  it("uses local sqlite preview by default and stays read-only", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: null,
        teamScope: "ai",
      },
      totalTeams: 3,
      aiTeams: 3,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 2,
      warningTeams: 1,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/transfermarkt/ai-preview/route");
    const response = await GET(
      new Request("http://localhost/api/transfermarkt/ai-preview?saveId=save-local&seasonId=season-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiTransfermarktPreview).toHaveBeenCalledWith({
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
    buildAiTransfermarktPreview.mockResolvedValue({
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
      readyTeams: 1,
      warningTeams: 0,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/transfermarkt/ai-preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/transfermarkt/ai-preview?saveId=save-ref&seasonId=season-2&teamId=W-W&teamScope=all&source=prisma&limit=25",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiTransfermarktPreview).toHaveBeenCalledWith({
      source: "prisma",
      saveId: "save-ref",
      seasonId: "season-2",
      teamId: "W-W",
      teamScope: "all",
      limit: 25,
    });
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("prisma");
  });

  it("returns a structured read-only error payload on failure", async () => {
    buildAiTransfermarktPreview.mockRejectedValue(new Error("SQLite save could not be loaded."));

    const { GET } = await import("@/app/api/transfermarkt/ai-preview/route");
    const response = await GET(new Request("http://localhost/api/transfermarkt/ai-preview"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.readOnly).toBe(true);
    expect(body.teams).toEqual([]);
    expect(body.aiTeams).toBe(0);
    expect(body.skippedManual).toBe(0);
    expect(body.skippedPassive).toBe(0);
    expect(body.skippedDisabled).toBe(0);
    expect(body.error).toContain("could not be loaded");
  });
});
