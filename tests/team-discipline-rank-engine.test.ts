import { describe, expect, it } from "vitest";

import type { Discipline, GameState } from "@/lib/data/olyDataTypes";
import {
  buildPreviousTeamDisciplineRankLookup,
  buildTeamDisciplineRankDeltaPack,
  buildTeamDisciplineRankRowsFromGameState,
  computeTeamDisciplineRankDelta,
  resolvePreviousSeasonId,
} from "@/lib/foundation/team-discipline-rank-engine";

/**
 * Minimaler GameState fuer buildTeamDisciplineRankRowsFromGameState: 4 Teams, je 1 Spieler mit
 * genau EINER Disziplin-Bewertung, so dass der Rang direkt aus dem Rating folgt. A > B > C > D.
 */
function buildRankEngineGameState(input: { leagueByTeamId?: Record<string, "liga1" | "liga2"> }): GameState {
  const discipline: Discipline = {
    id: "d1",
    name: "Discipline One",
    category: "power",
    weight: 1,
    playerCount: 1,
  } as Discipline;
  const teamRatings: Array<[string, number]> = [
    ["A-A", 100],
    ["B-B", 80],
    ["C-C", 60],
    ["D-D", 40],
  ];

  return {
    teams: teamRatings.map(([teamId]) => ({ teamId, shortCode: teamId, name: teamId })),
    players: teamRatings.map(([teamId, rating]) => ({
      id: `${teamId}-p1`,
      disciplineRatings: { d1: rating },
    })),
    rosters: teamRatings.map(([teamId]) => ({ teamId, playerId: `${teamId}-p1` })),
    disciplines: [discipline],
    seasonState: {
      leagueByTeamId: input.leagueByTeamId,
    },
  } as unknown as GameState;
}

describe("team-discipline-rank-engine", () => {
  it("resolves previous season id", () => {
    expect(resolvePreviousSeasonId("season-1")).toBeNull();
    expect(resolvePreviousSeasonId("season-3")).toBe("season-2");
  });

  it("computes rank delta with lower rank as improvement", () => {
    expect(computeTeamDisciplineRankDelta(20, 16)).toBe(4);
    expect(computeTeamDisciplineRankDelta(8, 12)).toBe(-4);
    expect(computeTeamDisciplineRankDelta(5, 5)).toBeNull();
    expect(computeTeamDisciplineRankDelta(null, 3)).toBeNull();
  });

  it("builds delta pack for summary columns only when scores exist", () => {
    const deltas = buildTeamDisciplineRankDeltaPack(
      {
        totalRank: 16,
        powRank: 4,
        speRank: 0,
        menRank: 9,
        socRank: 11,
        scorePack: { total: 100, pow: 20, spe: 0, men: 15, soc: 12, disciplines: {} },
      },
      {
        teamId: "team-a",
        teamName: "Team A",
        totalRank: 20,
        powRank: 7,
        speRank: 3,
        menRank: 12,
        socRank: 8,
      },
    );

    expect(deltas).toEqual({
      total: 4,
      pow: 3,
      spe: null,
      men: 3,
      soc: -3,
    });
  });

  it("builds previous rank lookup from season snapshots", () => {
    const lookup = buildPreviousTeamDisciplineRankLookup(
      [
        {
          seasonId: "season-1",
          teamDisciplineRankSnapshots: [
            {
              teamId: "team-a",
              teamName: "Team A",
              totalRank: 12,
              powRank: 5,
              speRank: 6,
              menRank: 7,
              socRank: 8,
            },
          ],
        },
        {
          seasonId: "season-2",
          teamDisciplineRankSnapshots: [
            {
              teamId: "team-a",
              teamName: "Team A",
              totalRank: 8,
              powRank: 3,
              speRank: 4,
              menRank: 5,
              socRank: 6,
            },
          ],
        },
      ],
      "season-2",
    );

    expect(lookup.get("team-a")?.totalRank).toBe(12);
  });

  describe("liga split (docs/design/liga-split-plan.md, Abschnitt 2.2, PR 3)", () => {
    // A(100) > B(80) > C(60) > D(40) in einer einzelnen Disziplin.
    it("without leagueByTeamId, ranks all teams globally (legacy, unveraendert)", () => {
      const rows = buildTeamDisciplineRankRowsFromGameState(buildRankEngineGameState({}), [
        buildRankEngineGameState({}).disciplines[0]!,
      ]);
      const rankOf = (teamId: string) => rows.find((row) => row.teamId === teamId)?.totalRank;

      expect(rankOf("A-A")).toBe(1);
      expect(rankOf("B-B")).toBe(2);
      expect(rankOf("C-C")).toBe(3);
      expect(rankOf("D-D")).toBe(4);
    });

    it("with leagueByTeamId set, ranks each team only within its own league", () => {
      const gameState = buildRankEngineGameState({
        leagueByTeamId: { "A-A": "liga1", "B-B": "liga1", "C-C": "liga2", "D-D": "liga2" },
      });
      const rows = buildTeamDisciplineRankRowsFromGameState(gameState, gameState.disciplines);
      const rankOf = (teamId: string) => rows.find((row) => row.teamId === teamId)?.totalRank;

      // Global waeren B und C Rang 2/3 -- liga-lokal ist B Liga-1-Rang 2 UND C Liga-2-Rang 1.
      expect(rankOf("A-A")).toBe(1);
      expect(rankOf("B-B")).toBe(2);
      expect(rankOf("C-C")).toBe(1);
      expect(rankOf("D-D")).toBe(2);
    });
  });
});
