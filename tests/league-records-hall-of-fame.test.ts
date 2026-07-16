import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueRecordsHallOfFame } from "@/lib/foundation/league-records-hall-of-fame";

function buildGameState(partial: Partial<GameState>): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: { seasonSnapshots: [] },
    teams: [],
    ...partial,
  } as GameState;
}

describe("league-records-hall-of-fame", () => {
  it("derives season-für-season champions (gold/silver/bronze) newest first", () => {
    const records = buildLeagueRecordsHallOfFame(
      buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                { teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, disciplinePointsByArea: {} },
                { teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 2, disciplinePointsByArea: {} },
                { teamId: "t3", teamCode: "CCC", teamName: "Gamma", rank: 3, disciplinePointsByArea: {} },
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                { teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 1, disciplinePointsByArea: {} },
                { teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 2, disciplinePointsByArea: {} },
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
      }),
    );

    expect(records.hasHistory).toBe(true);
    expect(records.seasonChampions).toEqual([
      {
        seasonId: "season-2",
        seasonLabel: expect.any(String),
        goldTeamId: "t2",
        goldTeamCode: "BBB",
        goldTeamName: "Beta",
        silverTeamName: "Alpha",
        bronzeTeamName: null,
      },
      {
        seasonId: "season-1",
        seasonLabel: expect.any(String),
        goldTeamId: "t1",
        goldTeamCode: "AAA",
        goldTeamName: "Alpha",
        silverTeamName: "Beta",
        bronzeTeamName: "Gamma",
      },
    ]);
  });

  it("tracks distinct teams per player and exposes an extended legendary-players list", () => {
    const records = buildLeagueRecordsHallOfFame(
      buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [{ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, disciplinePointsByArea: {} }],
              playerPerformances: [
                { playerId: "p1", playerName: "Legend One", teamName: "Alpha", appearances: 10, totalPoints: 40, mvpCount: 2 },
              ],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [{ teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 1, disciplinePointsByArea: {} }],
              playerPerformances: [
                { playerId: "p1", playerName: "Legend One", teamName: "Beta", appearances: 8, totalPoints: 30, mvpCount: 1 },
              ],
            },
          ],
        } as unknown as GameState["seasonState"],
      }),
    );

    const legend = records.legendaryPlayers.find((row) => row.playerId === "p1");
    expect(legend).toBeDefined();
    expect(legend?.teams).toEqual(["Alpha", "Beta"]);
    expect(legend?.appearances).toBe(18);
    expect(legend?.totalPps).toBe(70);
    expect(legend?.mvpTotal).toBe(3);
    expect(legend?.seasonsPlayed).toBe(2);
    expect(records.careerLeaderboard.length).toBeLessThanOrEqual(8);
    expect(records.legendaryPlayers.length).toBeLessThanOrEqual(25);
  });

  it("returns no history / empty legends for an empty snapshot list", () => {
    const records = buildLeagueRecordsHallOfFame(buildGameState({}));
    expect(records.hasHistory).toBe(false);
    expect(records.seasonChampions).toEqual([]);
    expect(records.legendaryPlayers).toEqual([]);
  });
});
