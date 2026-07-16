import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildPlayerLeagueCareerStatsMap } from "@/lib/foundation/player-league-career-stats";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

function buildSummary(partial: Partial<PlayerSeasonPerformanceSummary>): PlayerSeasonPerformanceSummary {
  return {
    seasonId: "season-2",
    seasonName: "Season 2",
    sourceLabel: "test",
    appearances: 0,
    totalPoints: null,
    pointsByArea: { pow: null, spe: null, men: null, soc: null },
    averageContribution: null,
    averageFinalScore: null,
    top10Count: 0,
    mvpCount: 0,
    bestDisciplineLabel: null,
    bestDisciplineScore: null,
    weakestDisciplineLabel: null,
    weakestDisciplineScore: null,
    latestDisciplineLabel: null,
    latestFinalScore: null,
    latestContribution: null,
    latestRankInDiscipline: null,
    latestMatchdayId: null,
    topDisciplineRows: [],
    matchdayBreakdown: [],
    disciplineBreakdown: [],
    warnings: [],
    ...partial,
  };
}

function buildGameState(partial: Partial<GameState>): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: { seasonSnapshots: [] },
    ...partial,
  } as GameState;
}

describe("player-league-career-stats", () => {
  it("aggregates all archived seasons plus the live season", () => {
    const currentSeason = new Map<string, PlayerSeasonPerformanceSummary>([
      ["p1", buildSummary({ appearances: 8, totalPoints: 18.5 })],
    ]);

    const stats = buildPlayerLeagueCareerStatsMap(
      buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              playerPerformances: [{ playerId: "p1", playerName: "A", appearances: 10, totalPoints: 22.2 }],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              playerPerformances: [{ playerId: "p1", playerName: "A", appearances: 9, totalContribution: 19.8 }],
            },
          ],
        } as GameState["seasonState"],
      }),
      { currentSeasonPerformanceByPlayerId: currentSeason },
    );

    expect(stats.get("p1")).toEqual({
      appearances: 27,
      totalPps: 60.5,
      seasonsPlayed: 3,
    });
  });

  it("uses discipline breakdown when snapshot season totals are missing", () => {
    const stats = buildPlayerLeagueCareerStatsMap(
      buildGameState({
        season: { id: "season-2", name: "Season 2" },
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              playerPerformances: [
                {
                  playerId: "p1",
                  playerName: "A",
                  appearances: 0,
                  disciplineBreakdown: [
                    { disciplineId: "tennis", disciplineName: "Tennis", appearances: 6, totalContribution: 11.1 },
                    { disciplineId: "schach", disciplineName: "Schach", appearances: 4, totalContribution: 8.4 },
                  ],
                },
              ],
            },
          ],
        } as GameState["seasonState"],
      }),
      {
        currentSeasonPerformanceByPlayerId: new Map([
          ["p1", buildSummary({ appearances: 5, totalPoints: 7.5 })],
        ]),
      },
    );

    expect(stats.get("p1")).toEqual({
      appearances: 15,
      totalPps: 27,
      seasonsPlayed: 2,
    });
  });

  it("drops snapshots for seasons newer than the live season", () => {
    // Contaminated save: a fresh Season-1 save that still carries a Season-3 snapshot.
    const stats = buildPlayerLeagueCareerStatsMap(
      buildGameState({
        season: { id: "season-1", name: "Season 1" },
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              playerPerformances: [{ playerId: "p1", playerName: "A", appearances: 10, totalPoints: 20 }],
            },
            {
              seasonId: "season-3",
              seasonName: "Season 3",
              playerPerformances: [{ playerId: "p1", playerName: "A", appearances: 99, totalPoints: 999 }],
            },
          ],
        } as GameState["seasonState"],
      }),
    );

    expect(stats.get("p1")).toEqual({
      appearances: 10,
      totalPps: 20,
      seasonsPlayed: 1,
    });
  });

  it("does not double-count the live season when it is already archived", () => {
    const currentSeason = new Map<string, PlayerSeasonPerformanceSummary>([
      ["p1", buildSummary({ appearances: 99, totalPoints: 999 })],
    ]);
    const ledger = {
      playerSummariesByPlayerId: new Map([
        ["p1", { playerId: "p1", totalPoints: 999, appearances: 99, pointsByArea: {}, pointsByDiscipline: {}, pointsByTeamId: {}, warnings: [] }],
      ]),
    } as SeasonPointsLedger;

    const stats = buildPlayerLeagueCareerStatsMap(
      buildGameState({
        season: { id: "season-2", name: "Season 2" },
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              playerPerformances: [{ playerId: "p1", playerName: "A", appearances: 10, totalPoints: 20 }],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              playerPerformances: [{ playerId: "p1", playerName: "A", appearances: 7, totalPoints: 14.5 }],
            },
          ],
        } as GameState["seasonState"],
      }),
      {
        currentSeasonPerformanceByPlayerId: currentSeason,
        currentSeasonLedger: ledger,
      },
    );

    expect(stats.get("p1")).toEqual({
      appearances: 17,
      totalPps: 34.5,
      seasonsPlayed: 2,
    });
  });
});
