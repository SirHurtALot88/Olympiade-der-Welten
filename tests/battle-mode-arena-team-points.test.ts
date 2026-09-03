import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import {
  ARENA_TEAM_POINTS,
  BASKETBALL_INDIVIDUAL_PPS_MAX,
  arenaTeamPointsForFixture,
  buildArenaMatchSeed,
  computeArenaTeamPointsFromFixtureResults,
  computeIndividualBoxscorePpsFromFixtureResults,
  findLeagueFixturesForMatchday,
  runBattleModeArenaMatchday,
} from "@/lib/resolve/battle-mode-arena-team-points";

/**
 * Reine, browserlose Tests fuer den Battle-Mode-Arena-Team-Punkte-Adapter (PR 7 von 9).
 *
 * Die Testing-Lektion aus PR6 (full-test-suite faehrt OHNE Chromium): NUR
 * `runBattleModeArenaMatchday` ruft ueberhaupt Playwright auf, und hier IMMER mit einem
 * gemockten `runArenaFixturesImpl` — kein einziger Test in dieser Datei braucht einen echten
 * Browser.
 */

function buildFixtureSchedule(entries: Array<{ id: string; homeTeamId: string; awayTeamId: string; matchdayId: string; leagueTier: "liga1" | "liga2" }>) {
  return entries.map((entry) => ({ ...entry, status: "scheduled" as const }));
}

describe("arenaTeamPointsForFixture", () => {
  it("Sieg=2/Niederlage=0 fuer die Heimmannschaft bei hoeherem Punktestand", () => {
    expect(arenaTeamPointsForFixture([80, 70])).toEqual([ARENA_TEAM_POINTS.win, ARENA_TEAM_POINTS.loss]);
  });

  it("Sieg=2/Niederlage=0 fuer die Gastmannschaft bei hoeherem Punktestand", () => {
    expect(arenaTeamPointsForFixture([60, 65])).toEqual([ARENA_TEAM_POINTS.loss, ARENA_TEAM_POINTS.win]);
  });

  it("Unentschieden=1/1 bei exakt gleichem Punktestand (defensiv behandelt)", () => {
    expect(arenaTeamPointsForFixture([50, 50])).toEqual([ARENA_TEAM_POINTS.draw, ARENA_TEAM_POINTS.draw]);
  });

  it("NICHT das Rang-basierte Modell: die Groesse der Punktdifferenz aendert nichts an den Punkten", () => {
    expect(arenaTeamPointsForFixture([100, 10])).toEqual(arenaTeamPointsForFixture([51, 50]));
  });
});

describe("buildArenaMatchSeed", () => {
  it("baut den im Plan (Abschnitt 3.3c) vorgeschlagenen Seed-String", () => {
    expect(
      buildArenaMatchSeed({
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "matchday-3",
        homeTeamId: "team-a",
        awayTeamId: "team-b",
      }),
    ).toBe("save-1:season-1:matchday-3:arena:team-a:team-b");
  });
});

describe("computeArenaTeamPointsFromFixtureResults", () => {
  it("weist beiden Seiten eines Duells konsistente Overrides zu (Sieger/Verlierer, Gegner, Seed)", () => {
    const seedByFixtureKey = new Map([["team-a::team-b", "seed-a-b"]]);
    const fixtureResults: ArenaFixtureResult[] = [
      { homeTeamId: "team-a", awayTeamId: "team-b", seiten: [80, 70], boxscore: [] },
    ];

    const overrides = computeArenaTeamPointsFromFixtureResults(fixtureResults, seedByFixtureKey);

    expect(overrides.get("team-a")).toEqual({
      teamPoints: ARENA_TEAM_POINTS.win,
      arenaMatchSeed: "seed-a-b",
      opponentTeamId: "team-b",
      seiten: [80, 70],
      outcome: "win",
    });
    expect(overrides.get("team-b")).toEqual({
      teamPoints: ARENA_TEAM_POINTS.loss,
      arenaMatchSeed: "seed-a-b",
      opponentTeamId: "team-a",
      seiten: [70, 80],
      outcome: "loss",
    });
  });

  it("mehrere Duelle in einem Batch bleiben unabhaengig voneinander", () => {
    const seedByFixtureKey = new Map([
      ["team-a::team-b", "seed-1"],
      ["team-c::team-d", "seed-2"],
    ]);
    const fixtureResults: ArenaFixtureResult[] = [
      { homeTeamId: "team-a", awayTeamId: "team-b", seiten: [80, 70], boxscore: [] },
      { homeTeamId: "team-c", awayTeamId: "team-d", seiten: [50, 50], boxscore: [] },
    ];

    const overrides = computeArenaTeamPointsFromFixtureResults(fixtureResults, seedByFixtureKey);
    expect(overrides.get("team-a")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    expect(overrides.get("team-c")?.teamPoints).toBe(ARENA_TEAM_POINTS.draw);
    expect(overrides.get("team-d")?.teamPoints).toBe(ARENA_TEAM_POINTS.draw);
  });

});

/**
 * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): individuelle Spieler-PPs nach dem in
 * battle-mode-pps-modell-plan.md Abschnitt 5 vorgeschlagenen Modell -- Perzentilrang gegen den
 * Referenz-Pool, linear auf BASKETBALL_INDIVIDUAL_PPS_MAX abgebildet.
 */
describe("computeIndividualBoxscorePpsFromFixtureResults (BOXSCORE-AN-PPS)", () => {
  function eintrag(name: string, wert: number, playerId: string | null, side: "home" | "away" | null) {
    return { name, wert, playerId, side };
  }

  it("der Spieler mit dem hoechsten Impact im Pool bekommt mehr PPs als jeder andere im selben Pool", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [eintrag("Top", 20, "p-top", "home"), eintrag("Rest", 5, "p-rest", "away")],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults);
    // Perzentil = Anteil STRIKT kleinerer Werte im Pool (dasselbe Prinzip wie percentileOf() in
    // lib/scouting/player-axis-star-rating.ts): bei 2 Werten hat der groessere GENAU EINEN
    // kleineren Wert vor sich -> 1/2 = 50 %, der kleinere 0 kleinere Werte -> 0 %.
    expect(pps.get("p-top")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.5, 5);
    expect(pps.get("p-rest")).toBe(0);
    expect(pps.get("p-top")!).toBeGreaterThan(pps.get("p-rest")!);
  });

  it("der Spieler mit dem niedrigsten Impact im Pool bekommt 0 PPs (Perzentil 0, nie negativ)", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [
          eintrag("Top", 20, "p-top", "home"),
          // Negativer Boxscore-Impact ist real moeglich (Plan Abschnitt 3) -- fuehrt zu 0 PPs,
          // nie zu negativen PPs (Plan Abschnitt 5, "Bodenregel").
          eintrag("Schwach", -3, "p-schwach", "away"),
        ],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults);
    expect(pps.get("p-schwach")).toBe(0);
  });

  it("ein Durchschnittsspieler in der Mitte des Pools bekommt ungefaehr die Haelfte von BASKETBALL_INDIVIDUAL_PPS_MAX", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [
          eintrag("Schlecht", 0, "p-1", "home"),
          eintrag("Mittel", 10, "p-2", "home"),
          eintrag("Gut", 20, "p-3", "away"),
          eintrag("SehrGut", 30, "p-4", "away"),
        ],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults);
    // Aufsteigend sortiert [0,10,20,30] -- "Mittel" (10) hat GENAU EINEN kleineren Wert vor sich
    // (Perzentil = 1/4 = 25%), "Gut" (20) hat zwei kleinere davor (50%).
    expect(pps.get("p-2")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.25, 5);
    expect(pps.get("p-3")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.5, 5);
  });

  it("beide Liga-Stufen EINES Spieltags bilden GEMEINSAM einen Pool (Plan Abschnitt 7, Frage 2: 'gemeinsam ueber beide Ligen')", () => {
    // liga2 hat insgesamt schwaechere Werte -- ohne gemeinsamen Pool waere der liga2-Topspieler
    // trotzdem bei PPS_MAX (bestes Perzentil SEINER eigenen Liga). Mit gemeinsamem Pool nicht mehr.
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "liga1-a",
        awayTeamId: "liga1-b",
        seiten: [10, 5],
        boxscore: [eintrag("Liga1Top", 100, "p-liga1-top", "home"), eintrag("Liga1Rest", 50, "p-liga1-rest", "away")],
      },
      {
        homeTeamId: "liga2-a",
        awayTeamId: "liga2-b",
        seiten: [10, 5],
        boxscore: [eintrag("Liga2Top", 5, "p-liga2-top", "home"), eintrag("Liga2Rest", 1, "p-liga2-rest", "away")],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults);
    // Gemeinsamer, aufsteigend sortierter Pool: [1, 5, 50, 100].
    // Liga2Top (5) hat nur EINEN kleineren Wert vor sich (1) -> Perzentil 25 % -- WAERE der Pool
    // pro Liga getrennt, haette er (bester seiner eigenen Liga) das hoechste Perzentil bekommen.
    expect(pps.get("p-liga2-top")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.25, 5);
    // Liga1Top (100) hat drei kleinere Werte vor sich (1, 5, 50) -> Perzentil 75 %, das hoechste
    // in diesem Pool.
    expect(pps.get("p-liga1-top")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.75, 5);
    expect(pps.get("p-liga1-top")!).toBeGreaterThan(pps.get("p-liga2-top")!);
  });

  it("ein Boxscore-Eintrag ohne eindeutige playerId (Namens-Kollision) bekommt KEINE PPs und verzerrt auch nicht den Pool anderer Spieler", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [
          eintrag("Top", 20, "p-top", "home"),
          eintrag("Unklar", 1000, null, null), // riesiger Wert, aber nicht zuordenbar
          eintrag("Rest", 5, "p-rest", "away"),
        ],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults);
    expect(pps.size).toBe(2);
    // Der Pool besteht NUR aus [5, 20] -- waere der unzuordenbare Wert (1000) mit reingerutscht,
    // haette "Top" (20) ein KLEINERES Perzentil bekommen (2 von 3 statt 1 von 2 kleiner).
    expect(pps.get("p-top")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.5, 5);
  });

  it("ein leerer Pool (kein einziges Duell mit zuordenbarem Boxscore) liefert eine leere Map, keinen Fehler", () => {
    const pps = computeIndividualBoxscorePpsFromFixtureResults([]);
    expect(pps.size).toBe(0);
  });
});

describe("runBattleModeArenaMatchday liefert individualBoxscorePpsByPlayerId liga-uebergreifend (gemockter Runner)", () => {
  it("fasst die Boxscores BEIDER Liga-Stufen EINES Spieltags zu einem gemeinsamen Pool zusammen", async () => {
    const gameState = {
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f-liga1", homeTeamId: "liga1-a", awayTeamId: "liga1-b", matchdayId: "matchday-1", leagueTier: "liga1" },
          { id: "f-liga2", homeTeamId: "liga2-a", awayTeamId: "liga2-b", matchdayId: "matchday-1", leagueTier: "liga2" },
        ]),
      },
    } as unknown as GameState;

    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures) =>
      fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => {
        const istLiga1 = fixture.homeTeamId === "liga1-a";
        return {
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          seiten: [10, 5] as [number, number],
          boxscore: istLiga1
            ? [
                { name: "Liga1Heim", wert: 100, playerId: "p-liga1-heim", side: "home" as const },
                { name: "Liga1Gast", wert: 50, playerId: "p-liga1-gast", side: "away" as const },
              ]
            : [
                { name: "Liga2Heim", wert: 5, playerId: "p-liga2-heim", side: "home" as const },
                { name: "Liga2Gast", wert: 1, playerId: "p-liga2-gast", side: "away" as const },
              ],
        };
      }),
    );

    const { individualBoxscorePpsByPlayerId, warnings } = await runBattleModeArenaMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(warnings).toHaveLength(0);
    expect(individualBoxscorePpsByPlayerId.size).toBe(4);
    // Gemeinsamer, aufsteigend sortierter Pool ueber BEIDE Liga-Stufen: [1, 5, 50, 100].
    // Bester Wert insgesamt (100, liga1-heim) hat drei kleinere Werte vor sich -> 75 %.
    expect(individualBoxscorePpsByPlayerId.get("p-liga1-heim")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.75, 5);
    // Der beste liga2-Spieler (5) hat nur EINEN kleineren Wert vor sich (1) -> 25 % --
    // waere der Pool pro Liga getrennt, haette er (bester seiner Liga) das hoechste Perzentil
    // seiner eigenen, schwaecheren Liga bekommen.
    expect(individualBoxscorePpsByPlayerId.get("p-liga2-heim")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.25, 5);
    expect(individualBoxscorePpsByPlayerId.get("p-liga1-heim")!).toBeGreaterThan(
      individualBoxscorePpsByPlayerId.get("p-liga2-heim")!,
    );
  });
});

describe("findLeagueFixturesForMatchday", () => {
  it("filtert exakt auf leagueTier UND matchdayId", () => {
    const gameState = {
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f1", homeTeamId: "a", awayTeamId: "b", matchdayId: "matchday-1", leagueTier: "liga1" },
          { id: "f2", homeTeamId: "c", awayTeamId: "d", matchdayId: "matchday-1", leagueTier: "liga2" },
          { id: "f3", homeTeamId: "e", awayTeamId: "f", matchdayId: "matchday-2", leagueTier: "liga1" },
        ]),
      },
    } as unknown as Pick<GameState, "seasonState">;

    expect(findLeagueFixturesForMatchday(gameState, "liga1", "matchday-1").map((f) => f.id)).toEqual(["f1"]);
    expect(findLeagueFixturesForMatchday(gameState, "liga2", "matchday-1").map((f) => f.id)).toEqual(["f2"]);
    expect(findLeagueFixturesForMatchday(gameState, "liga1", "matchday-2").map((f) => f.id)).toEqual(["f3"]);
  });
});

describe("runBattleModeArenaMatchday (gemockter Runner, kein Browser)", () => {
  function buildGameState(): GameState {
    return {
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f-liga1", homeTeamId: "liga1-a", awayTeamId: "liga1-b", matchdayId: "matchday-1", leagueTier: "liga1" },
          { id: "f-liga2", homeTeamId: "liga2-a", awayTeamId: "liga2-b", matchdayId: "matchday-1", leagueTier: "liga2" },
        ]),
      },
    } as unknown as GameState;
  }

  it("ruft runArenaFixtures GENAU EINMAL je Liga auf (Batching, nicht 8/2 einzelne Aufrufe)", async () => {
    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures, disziplin) => {
      expect(disziplin).toBe("basketball");
      return fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        seiten: [80, 70] as [number, number],
        boxscore: [],
      }));
    });

    const { overridesByTeamId, warnings } = await runBattleModeArenaMatchday({
      gameState: buildGameState(),
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(runArenaFixturesImpl).toHaveBeenCalledTimes(2);
    expect(warnings).toHaveLength(0);
    expect(overridesByTeamId.get("liga1-a")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    expect(overridesByTeamId.get("liga1-b")?.teamPoints).toBe(ARENA_TEAM_POINTS.loss);
    expect(overridesByTeamId.get("liga2-a")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    expect(overridesByTeamId.get("liga2-b")?.teamPoints).toBe(ARENA_TEAM_POINTS.loss);
  });

  it("baut den Seed im vorgeschriebenen Format und reicht ihn an den Runner durch", async () => {
    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures) =>
      fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        seiten: [1, 0] as [number, number],
        boxscore: [],
      })),
    );

    await runBattleModeArenaMatchday({
      gameState: buildGameState(),
      saveId: "save-42",
      seasonId: "season-7",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    const [, firstCallFixtures] = runArenaFixturesImpl.mock.calls[0];
    expect(firstCallFixtures[0].seed).toBe("save-42:season-7:matchday-1:arena:liga1-a:liga1-b");
  });

  it("eine Liga ohne Fixtures an diesem Spieltag wird uebersprungen, ohne den Lauf zu blockieren", async () => {
    const gameState = {
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f-liga1", homeTeamId: "liga1-a", awayTeamId: "liga1-b", matchdayId: "matchday-1", leagueTier: "liga1" },
        ]),
      },
    } as unknown as GameState;
    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures) =>
      fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        seiten: [1, 0] as [number, number],
        boxscore: [],
      })),
    );

    const { overridesByTeamId } = await runBattleModeArenaMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(runArenaFixturesImpl).toHaveBeenCalledTimes(1);
    expect(overridesByTeamId.size).toBe(2);
  });

  it("ein fehlschlagender Liga-Batch sammelt eine Warnung statt den ganzen Lauf zu werfen", async () => {
    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures, _disziplin, _options) => {
      if (fixtures[0].homeTeamId === "liga1-a") {
        throw new Error("chromium crashed");
      }
      return fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        seiten: [1, 0] as [number, number],
        boxscore: [],
      }));
    });

    const { overridesByTeamId, warnings } = await runBattleModeArenaMatchday({
      gameState: buildGameState(),
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(warnings.some((warning) => warning.startsWith("arena_matchday_league_failed:liga1"))).toBe(true);
    expect(overridesByTeamId.has("liga1-a")).toBe(false);
    expect(overridesByTeamId.get("liga2-a")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
  });
});
