import { beforeEach, describe, expect, it, vi } from "vitest";

const buildStandingsPreview = vi.fn();

vi.mock("@/lib/standings/standings-preview-engine", () => ({
  buildStandingsPreview,
}));

describe("standings preview api", () => {
  beforeEach(() => {
    buildStandingsPreview.mockReset();
  });

  it("returns read-only preview rows", async () => {
    buildStandingsPreview.mockResolvedValue({
      items: [
        {
          teamId: "A-A",
          teamName: "Armageddon Aftermath",
          currentRank: null,
          projectedRank: null,
          currentPoints: null,
          projectedPoints: null,
          pointsDelta: null,
          matchdayRank: 1,
          d1Score: 55,
          d2Score: 44,
          matchdayScore: 99,
          totalScore: 99,
          cash: 900000,
          readinessStatus: "ready",
          resultStatus: "ready",
          warnings: [],
          blockedRules: ["points_table_missing", "rank_to_points_mapping_missing"],
        },
      ],
      summary: {
        totalTeams: 1,
        matchdayResultFound: true,
        readyTeams: 1,
        blockedTeamCount: 1,
      },
      blockedRules: ["points_table_missing", "rank_to_points_mapping_missing"],
      source: {
        mode: "sqlite",
        matchdayResult: "local_saved_result",
        currentPoints: "local_save_standings",
        standingsRules: "global_total_score_preview",
        fixtureCoverage: "not_required_local_results",
      },
      scope: {
        saveId: "save-initial",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
    });

    const { GET } = await import("@/app/api/standings/preview/route");
    const response = await GET(new Request("http://localhost/api/standings/preview?saveId=save-initial&seasonId=season-1&matchdayId=matchday-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(buildStandingsPreview).toHaveBeenCalledWith({
      saveId: "save-initial",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "sqlite",
    });
    expect(body.blockedRules).toContain("points_table_missing");
    expect(body.items[0]?.teamName).toBe("Armageddon Aftermath");
    expect(body.items[0]?.currentPoints).toBeNull();
  });

  it("passes source=prisma through as read-only preview mode", async () => {
    buildStandingsPreview.mockResolvedValue({
      items: [],
      summary: {
        totalTeams: 0,
        matchdayResultFound: false,
        readyTeams: 0,
        blockedTeamCount: 0,
      },
      blockedRules: [],
      tieGroups: [],
      source: {
        mode: "prisma",
        matchdayResult: "missing",
        currentPoints: "sheet_mapping_missing",
        standingsRules: "global_total_score_preview",
        fixtureCoverage: "missing_before_after_snapshots",
      },
      scope: {
        saveId: "save-initial",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
    });

    const { GET } = await import("@/app/api/standings/preview/route");
    const response = await GET(
      new Request("http://localhost/api/standings/preview?saveId=save-initial&seasonId=season-1&matchdayId=matchday-1&source=prisma"),
    );

    expect(response.status).toBe(200);
    expect(buildStandingsPreview).toHaveBeenCalledWith({
      saveId: "save-initial",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "prisma",
    });
  });

  it("returns a clear error payload without pretending the preview is just empty", async () => {
    buildStandingsPreview.mockRejectedValue(new Error("Standings preview could not be loaded."));

    const { GET } = await import("@/app/api/standings/preview/route");
    const response = await GET(new Request("http://localhost/api/standings/preview"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("Standings preview could not be loaded");
    expect(body.blockedRules).toContain("preview_load_failed");
  });
});
