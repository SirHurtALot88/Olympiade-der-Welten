import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildMultiSeasonBalanceDashboard } from "@/lib/foundation/multiseason-balance-dashboard";

function snapshot(seasonId: string, ranks: Record<string, number>, points: Record<string, number>): SeasonSnapshotRecord {
  return {
    seasonId,
    seasonName: seasonId,
    archivedAt: "2026-06-12T00:00:00.000Z",
    status: "completed",
    sourceStatus: "mapped",
    finalStandings: Object.entries(ranks).map(([teamId, rank]) => ({
      teamId,
      teamCode: teamId,
      teamName: teamId === "A-A" ? "Alpha" : "Beta",
      rank,
      points: points[teamId] ?? 0,
      disciplinePoints: null,
      disciplinePointsByArea: {
        pow: teamId === "A-A" ? 220 : 90,
        spe: 80,
        men: 75,
        soc: 70,
      },
      cashEnd: teamId === "A-A" ? 210 : -5,
      rosterEnd: 10,
      salaryEnd: teamId === "A-A" ? 70 : 30,
      marketValueEnd: 250,
      transferCount: 0,
      transferBuyCount: 0,
      transferSellCount: 0,
      transferNet: 0,
    })),
    playerPerformances: [
      {
        playerId: "p1",
        playerName: "Rocket",
        teamId: "A-A",
        teamCode: "A-A",
        teamName: "Alpha",
        appearances: 10,
        totalContribution: 40,
        totalPoints: 40,
        averageContribution: 4,
        averageFinalScore: 82,
        top10Count: 8,
        mvpCount: 2,
        bestDisciplineId: "tdm",
        bestDisciplineScore: 99,
      },
    ],
  };
}

function createGameState(input?: { includeSeason3?: boolean; negativeCash?: boolean; xpOutlier?: boolean }): GameState {
  const includeSeason3 = input?.includeSeason3 ?? true;
  return {
    season: { id: includeSeason3 ? "season-3" : "season-2", name: includeSeason3 ? "Season 3" : "Season 2", year: includeSeason3 ? 3 : 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    gamePhase: includeSeason3 ? "season_active" : "season_completed",
    teams: [
      { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 220, identityId: "id-a", humanControlled: false, rosterLimit: 12 },
      { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: input?.negativeCash ? -3 : 20, identityId: "id-b", humanControlled: false, rosterLimit: 12 },
    ],
    players: [{ id: "p1", name: "Rocket", race: "Human", className: "Runner", subclasses: [], traits: [], attributes: {}, ovr: 90, mvs: 50 } as never],
    rosters: [
      { id: "r1", teamId: "A-A", playerId: "p1", contractLength: 1, salary: 40, upkeep: 40, currentValue: 120, roleTag: "starter", joinedSeasonId: "season-1" },
    ],
    transferHistory: [],
    seasonState: {
      seasonId: includeSeason3 ? "season-3" : "season-2",
      schedule: [],
      standings: includeSeason3
        ? {
            "A-A": { teamId: "A-A", points: 0, rank: 1, movement: 0 },
            "B-B": { teamId: "B-B", points: 0, rank: 2, movement: 0 },
          }
        : {},
      seasonSnapshots: [
        snapshot("season-1", { "A-A": 1, "B-B": 2 }, { "A-A": 120, "B-B": 50 }),
        snapshot("season-2", { "A-A": 1, "B-B": 2 }, { "A-A": 130, "B-B": 45 }),
      ],
      facilityEvents: [
        { eventId: "f1", seasonId: "season-2", teamId: "A-A", facilityId: "fan_shop", previousLevel: 1, nextLevel: 1, cost: 60, timestamp: "2026-06-12T00:00:00.000Z", source: "facility_income_collected" },
      ],
    },
    playerProgressionEvents: input?.xpOutlier
      ? [
          {
            eventId: "xp1",
            seasonId: "season-2",
            teamId: "A-A",
            playerId: "p1",
            xpSpent: 25,
            upgrades: [{ playerId: "p1", attribute: "pow", fromValue: 70, toValue: 78, cost: 25, source: "manual_xp_spend_preview" }],
            timestamp: "2026-06-12T00:00:00.000Z",
            source: "manual_season_end_xp_spend",
          },
        ]
      : [],
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    mappingReport: { importedPlayerCount: 1, warnings: [] },
    disciplines: [],
    teamIdentities: [],
    transferListings: [],
  } as unknown as GameState;
}

describe("multi-season balance dashboard", () => {
  it("builds dashboard rows with 2+ season sources", () => {
    const dashboard = buildMultiSeasonBalanceDashboard(createGameState());

    expect(dashboard.sourceSummary.snapshotSeasons).toContain("season-1");
    expect(dashboard.sourceSummary.snapshotSeasons).toContain("season-2");
    expect(dashboard.teamRows.find((row) => row.teamId === "A-A")?.alwaysTop5).toBe(true);
  });

  it("shows season data quality and keeps active Season 3 out of completed history", () => {
    const dashboard = buildMultiSeasonBalanceDashboard(createGameState());

    expect(dashboard.sourceSummary.completedSeasonCount).toBe(2);
    expect(dashboard.sourceSummary.seasonQuality).toEqual([
      expect.objectContaining({ seasonId: "season-1", status: "complete" }),
      expect.objectContaining({ seasonId: "season-2", status: "complete" }),
      expect.objectContaining({ seasonId: "season-3", status: "active" }),
    ]);
    expect(dashboard.summaryCards.find((card) => card.label === "Data Quality")?.detail).toContain("S3: active");
    expect(dashboard.summaryCards.find((card) => card.label === "Champions")?.value).not.toContain("season-3");
  });

  it("warns when Season 3 is missing", () => {
    const dashboard = buildMultiSeasonBalanceDashboard(createGameState({ includeSeason3: false }));

    expect(dashboard.warnings.some((warning) => warning.type === "season_source_missing" && warning.title.includes("season-3"))).toBe(true);
  });

  it("detects cash hoarding and negative cash", () => {
    const dashboard = buildMultiSeasonBalanceDashboard(createGameState({ negativeCash: true }));

    expect(dashboard.warnings.some((warning) => warning.type === "cash_hoarding" && warning.teamId === "A-A")).toBe(true);
    expect(dashboard.warnings.some((warning) => warning.type === "cash_crisis" && warning.teamId === "B-B")).toBe(true);
  });

  it("detects XP outliers from progression events", () => {
    const dashboard = buildMultiSeasonBalanceDashboard(createGameState({ xpOutlier: true }));

    expect(dashboard.playerRows.find((row) => row.playerId === "p1")?.xpSpent).toBe(25);
    expect(dashboard.warnings.some((warning) => warning.type === "xp_growth_too_fast" && warning.playerId === "p1")).toBe(true);
  });
});
