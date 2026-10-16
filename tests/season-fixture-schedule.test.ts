import { describe, expect, it } from "vitest";

import type { LeagueTier } from "@/lib/season/league-split";
import { buildSeasonFixtureSchedule, getOpponentOf } from "@/lib/season/season-fixture-schedule";

function buildTeamIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

function buildLeagueTeamIds(): Record<LeagueTier, string[]> {
  return {
    liga1: buildTeamIds("L1", 16),
    liga2: buildTeamIds("L2", 16),
  };
}

function buildMatchdayIds(count: number, seasonId = "season-1") {
  return Array.from({ length: count }, (_, index) => `${seasonId}-matchday-${index + 1}`);
}

describe("buildSeasonFixtureSchedule", () => {
  it("gives every team exactly one fixture per matchday", () => {
    const { fixtures, warnings } = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: buildLeagueTeamIds(),
    });

    expect(warnings).toEqual([]);
    // 2 Ligen * 10 Spieltage * 8 Paarungen = 160 Fixtures.
    expect(fixtures.length).toBe(160);

    for (const matchdayId of buildMatchdayIds(10)) {
      const teamsThisMatchday = fixtures
        .filter((fixture) => fixture.matchdayId === matchdayId)
        .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
      expect(teamsThisMatchday.length).toBe(32);
      expect(new Set(teamsThisMatchday).size).toBe(32);
    }
  });

  it("never repeats a pairing within the season", () => {
    const { fixtures } = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: buildLeagueTeamIds(),
    });

    const pairingKeys = fixtures.map((fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join("::"));
    expect(new Set(pairingKeys).size).toBe(pairingKeys.length);
  });

  it("keeps every pairing league-internal", () => {
    const { fixtures } = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: buildLeagueTeamIds(),
    });

    for (const fixture of fixtures) {
      const homeIsLiga1 = fixture.homeTeamId.startsWith("L1-");
      const awayIsLiga1 = fixture.awayTeamId.startsWith("L1-");
      expect(homeIsLiga1).toBe(awayIsLiga1);
      expect(fixture.leagueTier).toBe(homeIsLiga1 ? "liga1" : "liga2");
    }
  });

  it("is deterministic for the same seed inputs", () => {
    const first = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: buildLeagueTeamIds(),
    });
    const second = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: buildLeagueTeamIds(),
    });

    expect(second.fixtures).toEqual(first.fixtures);
  });

  it("produces a different plan for a different season id (rotating missed opponents)", () => {
    const season1 = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10, "season-1"),
      leagueTeamIds: buildLeagueTeamIds(),
    });
    const season2 = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-2",
      matchdayIds: buildMatchdayIds(10, "season-2"),
      leagueTeamIds: buildLeagueTeamIds(),
    });

    const pairingKeysOf = (fixtures: typeof season1.fixtures) =>
      new Set(fixtures.map((fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join("::")));

    expect(pairingKeysOf(season2.fixtures)).not.toEqual(pairingKeysOf(season1.fixtures));
  });

  it("varies the plan across many seeds (save/season combinations)", () => {
    const signatures = new Set<string>();
    for (let index = 0; index < 12; index += 1) {
      const { fixtures } = buildSeasonFixtureSchedule({
        saveId: `save-${index}`,
        seasonId: "season-1",
        matchdayIds: buildMatchdayIds(10),
        leagueTeamIds: buildLeagueTeamIds(),
      });
      const signature = fixtures
        .filter((fixture) => fixture.leagueTier === "liga1")
        .map((fixture) => `${fixture.matchdayId}:${fixture.homeTeamId}-${fixture.awayTeamId}`)
        .join("|");
      signatures.add(signature);
    }
    // Nicht jeder Seed muss einzigartig sein, aber ueber 12 Seeds sollten sich klar mehrere
    // unterschiedliche Plaene ergeben statt eines einzigen konstanten Musters.
    expect(signatures.size).toBeGreaterThan(6);
  });

  it("warns (but does not throw) for a league with the wrong team count, and still builds a valid plan for the other", () => {
    const { fixtures, warnings } = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: {
        liga1: buildTeamIds("L1", 15),
        liga2: buildTeamIds("L2", 16),
      },
    });

    expect(warnings).toContain("fixture_schedule_league_size_mismatch:liga1:15");
    const liga2Fixtures = fixtures.filter((fixture) => fixture.leagueTier === "liga2");
    expect(liga2Fixtures.length).toBe(80);
    // liga1 (odd team count) still gets a best-effort plan (one bye per round) without crashing,
    // and never double-books a team on the same matchday.
    const liga1Fixtures = fixtures.filter((fixture) => fixture.leagueTier === "liga1");
    expect(liga1Fixtures.length).toBeGreaterThan(0);
    for (const matchdayId of buildMatchdayIds(10)) {
      const teamsThisMatchday = liga1Fixtures
        .filter((fixture) => fixture.matchdayId === matchdayId)
        .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
      expect(new Set(teamsThisMatchday).size).toBe(teamsThisMatchday.length);
    }
  });

  it("skips a league entirely when it has fewer than 2 teams, without throwing", () => {
    const { fixtures, warnings } = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: {
        liga1: [],
        liga2: buildTeamIds("L2", 16),
      },
    });

    expect(warnings).toContain("fixture_schedule_league_size_mismatch:liga1:0");
    expect(fixtures.every((fixture) => fixture.leagueTier === "liga2")).toBe(true);
  });

  it("20 Spieltage: Doppel-Rundenplan — jeder gegen jeden, fünf Rückspiele mit getauschter Seite, keine Warnung", () => {
    // Konzept 16.10. Abschnitt 2.2, Variante C. Vorher: Modulo-Wrap über 15 Runden, Spieltage
    // 16-20 wiederholten Spieltage 1-5 mit DERSELBEN Heim/Auswärts-Seite, plus Warnung.
    for (let seed = 0; seed < 200; seed += 1) {
      const { fixtures, warnings } = buildSeasonFixtureSchedule({
        saveId: `save-${seed}`,
        seasonId: "season-1",
        matchdayIds: buildMatchdayIds(20),
        leagueTeamIds: buildLeagueTeamIds(),
      });
      expect(warnings).toEqual([]);
      expect(fixtures.length).toBe(2 * 20 * 8);
      for (const matchdayId of buildMatchdayIds(20)) {
        const teamsThisMatchday = fixtures
          .filter((fixture) => fixture.matchdayId === matchdayId)
          .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
        expect(new Set(teamsThisMatchday).size).toBe(32);
      }
      for (const tier of ["liga1", "liga2"] as const) {
        const ligaFixtures = fixtures.filter((fixture) => fixture.leagueTier === tier);
        const byPair = new Map<string, Array<{ home: string }>>();
        for (const fixture of ligaFixtures) {
          const key = [fixture.homeTeamId, fixture.awayTeamId].sort().join("::");
          byPair.set(key, [...(byPair.get(key) ?? []), { home: fixture.homeTeamId }]);
        }
        // 16 Teams: C(16,2) = 120 Paare, alle mindestens einmal.
        expect(byPair.size).toBe(120);
        const doppelt = [...byPair.values()].filter((meetings) => meetings.length === 2);
        expect(doppelt.length).toBe(40);
        expect([...byPair.values()].every((meetings) => meetings.length <= 2)).toBe(true);
        for (const meetings of doppelt) {
          expect(meetings[0]!.home).not.toBe(meetings[1]!.home);
        }
      }
    }
  });

  it("bis 15 Spieltage bit-identisch zum Einfach-Rundenplan (jeder heutige Save)", () => {
    const zehn = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(10),
      leagueTeamIds: buildLeagueTeamIds(),
    });
    // Referenz: Rundenindex (offset + i) % 15 über die 15 Einfach-Runden — die ersten 10 Spieltage
    // eines 15er-Plans mit derselben Saat sind exakt die 10 eines 10er-Plans.
    const fuenfzehn = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(15),
      leagueTeamIds: buildLeagueTeamIds(),
    });
    const ersteZehn = new Set(buildMatchdayIds(10));
    expect(fuenfzehn.fixtures.filter((fixture) => ersteZehn.has(fixture.matchdayId))).toEqual(zehn.fixtures);
  });

  it("warns when more matchdays are requested than the double round robin holds, without crashing", () => {
    const { fixtures, warnings } = buildSeasonFixtureSchedule({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayIds: buildMatchdayIds(32),
      leagueTeamIds: buildLeagueTeamIds(),
    });

    expect(warnings.some((warning) => warning.startsWith("fixture_schedule_matchday_count_exceeds_rounds:liga1:32:30"))).toBe(
      true,
    );
    for (const matchdayId of buildMatchdayIds(32)) {
      const teamsThisMatchday = fixtures
        .filter((fixture) => fixture.matchdayId === matchdayId)
        .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
      expect(new Set(teamsThisMatchday).size).toBe(32);
    }
  });
});

describe("getOpponentOf", () => {
  it("returns the other team of a fixture, in either home/away direction", () => {
    const gameState = {
      seasonState: {
        schedule: [
          { id: "f1", homeTeamId: "A", awayTeamId: "B", matchdayId: "md1", status: "scheduled" as const },
        ],
      },
    };

    expect(getOpponentOf(gameState, "A", "md1")).toBe("B");
    expect(getOpponentOf(gameState, "B", "md1")).toBe("A");
  });

  it("returns null when there is no fixture for this team/matchday", () => {
    const gameState = {
      seasonState: {
        schedule: [
          { id: "f1", homeTeamId: "A", awayTeamId: "B", matchdayId: "md1", status: "scheduled" as const },
        ],
      },
    };

    expect(getOpponentOf(gameState, "C", "md1")).toBeNull();
    expect(getOpponentOf(gameState, "A", "md2")).toBeNull();
  });
});
