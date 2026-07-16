import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAiNeedsPicksCompare = vi.fn();

vi.mock("@/lib/ai/ai-needs-picks-compare-service", () => ({
  buildAiNeedsPicksCompare,
}));

describe("ai needs picks compare api", () => {
  beforeEach(() => {
    buildAiNeedsPicksCompare.mockReset();
  });

  it("uses local sqlite compare by default and stays read-only", async () => {
    buildAiNeedsPicksCompare.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: null,
        teamScope: "ai",
        compareSet: ["C-C", "W-W", "T-T", "A-A"],
      },
      totalTeams: 4,
      aiTeams: 4,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      comparedTeams: 4,
      matchedTeams: 0,
      partialTeams: 0,
      deviatedTeams: 0,
      missingRetoolTeams: 4,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/ai/needs-picks-compare/route");
    const response = await GET(
      new Request("http://localhost/api/ai/needs-picks-compare?saveId=save-local&seasonId=season-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiNeedsPicksCompare).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: null,
      teamScope: "ai",
      teamIds: null,
      limit: null,
      steps: null,
    });
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("sqlite");
  });

  it("forwards prisma params, aliases and explicit team ids", async () => {
    buildAiNeedsPicksCompare.mockResolvedValue({
      readOnly: true,
      source: "prisma",
      scope: {
        saveId: "save-ref",
        seasonId: "season-2",
        teamId: "C-C",
        teamScope: "all",
        compareSet: ["C-C", "W-W"],
      },
      totalTeams: 2,
      aiTeams: 2,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      comparedTeams: 2,
      matchedTeams: 0,
      partialTeams: 1,
      deviatedTeams: 0,
      missingRetoolTeams: 1,
      blockedTeams: 0,
      teams: [],
    });

    const { GET } = await import("@/app/api/ai/needs-picks-compare/route");
    const response = await GET(
      new Request(
        "http://localhost/api/ai/needs-picks-compare?saveId=save-ref&seasonId=season-2&teamCode=C-C&teamScope=all&source=prisma&teamIds=C-C,W-W&limit=25&steps=4",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildAiNeedsPicksCompare).toHaveBeenCalledWith({
      source: "prisma",
      saveId: "save-ref",
      seasonId: "season-2",
      teamId: "C-C",
      teamScope: "all",
      teamIds: ["C-C", "W-W"],
      limit: 25,
      steps: 4,
    });
    expect(body.readOnly).toBe(true);
    expect(body.scope.compareSet).toEqual(["C-C", "W-W"]);
  });

  it("returns a structured read-only error payload on failure", async () => {
    buildAiNeedsPicksCompare.mockRejectedValue(new Error("SQLite save could not be loaded."));

    const { GET } = await import("@/app/api/ai/needs-picks-compare/route");
    const response = await GET(new Request("http://localhost/api/ai/needs-picks-compare"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.readOnly).toBe(true);
    expect(body.teams).toEqual([]);
    expect(body.missingRetoolTeams).toBe(0);
    expect(body.error).toContain("could not be loaded");
  });
});
