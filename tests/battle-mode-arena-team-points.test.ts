import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import {
  ARENA_TEAM_POINTS,
  arenaTeamPointsForFixture,
  buildArenaMatchSeed,
  computeArenaTeamPointsFromFixtureResults,
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
