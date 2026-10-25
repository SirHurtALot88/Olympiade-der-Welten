import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueRecordsHallOfFame } from "@/lib/foundation/league-records-hall-of-fame";

function buildGameState(partial: Partial<GameState>): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: { seasonSnapshots: [] },
    teams: [],
    // Seit die Hall of Fame die LAUFENDE Saison mitliest (sonst waere sie in Saison 1 leer),
    // gehoeren diese Listen zum Mindestzustand. Leer heisst hier: keine Live-Daten — die
    // Erwartungen dieser Datei bleiben damit reine Archiv-Aussagen.
    players: [],
    rosters: [],
    disciplines: [],
    transferHistory: [],
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
        liga2ChampionTeamId: null,
        liga2ChampionTeamName: null,
      },
      {
        seasonId: "season-1",
        seasonLabel: expect.any(String),
        goldTeamId: "t1",
        goldTeamCode: "AAA",
        goldTeamName: "Alpha",
        silverTeamName: "Beta",
        bronzeTeamName: "Gamma",
        liga2ChampionTeamId: null,
        liga2ChampionTeamName: null,
      },
    ]);
  });

  it("Task #158/#161 (10.8): Liga-2-Rang-1 ist ein eigener Titel, getrennt vom Liga-1-/Gesamt-Meister", () => {
    const records = buildLeagueRecordsHallOfFame(
      buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                // Liga 1: t1 ist Liga-1-Meister (isGold), t2 Vize.
                { teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, leagueTier: "liga1", isGold: true, disciplinePointsByArea: {} },
                { teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 2, leagueTier: "liga1", disciplinePointsByArea: {} },
                // Liga 2: t3 hat ebenfalls rank === 1 (liga-lokal!), ist aber NICHT isGold, sondern
                // isLiga2Champion — genau der Fall, den die rohe `rank === 1`-Lesart vor Task #158
                // falsch (als zweiten "Meister") gezählt hätte.
                { teamId: "t3", teamCode: "CCC", teamName: "Gamma", rank: 1, leagueTier: "liga2", isLiga2Champion: true, disciplinePointsByArea: {} },
                { teamId: "t4", teamCode: "DDD", teamName: "Delta", rank: 2, leagueTier: "liga2", disciplinePointsByArea: {} },
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
      }),
    );

    expect(records.seasonChampions).toHaveLength(1);
    const entry = records.seasonChampions[0]!;
    expect(entry.goldTeamId).toBe("t1");
    expect(entry.liga2ChampionTeamId).toBe("t3");
    expect(entry.liga2ChampionTeamName).toBe("Gamma");
    // Der Liga-2-Erste darf NICHT als Liga-1-/Gesamt-Meister durchrutschen.
    expect(entry.goldTeamId).not.toBe("t3");
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
