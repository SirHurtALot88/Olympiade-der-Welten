import { describe, expect, it } from "vitest";

import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import { resolveArenaHostSeeds } from "@/lib/battle/arena-host-seed";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import { findLeagueFixturesForMatchday } from "@/lib/resolve/battle-mode-arena-team-points";
import { baueFixtureIndex, findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";

/**
 * SAAT-IDENTITAETS-TEST (PR4 "Determinismus-Feinschliff", Plan
 * `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 5.3): "Für einen
 * Fixture-Satz liefern Runner-Eingabebau (`bereiteFixturesVor`) und Host-Saatberechnung (als
 * reine Funktion herausgezogen) denselben Zahlen-Seed, auch wenn die UI-Auswahl verkehrt herum
 * ist. Für Nicht-Fixture-Paare liefert der Host keine Saat."
 *
 * `bereiteFixturesVor()` selbst ist nicht exportiert (lebt in `arena-headless-runner.ts`, zieht
 * Playwright/`node:fs` mit) -- was dieser Test tatsaechlich braucht, ist der SEED-STRING-BAU, der
 * `bereiteFixturesVor()` vorgelagert ist: `findLeagueFixturesForMatchday()` +
 * `buildArenaMatchSeed()` (`battle-mode-arena-team-points.ts:1445-1460`), danach `seedZuZahl()`
 * auf exakt denselben Wert, den `bereiteFixturesVor()` dann nur noch normalisiert
 * (`seed: seedZuZahl(fixture.seed)`). Dieser Test vergleicht also den NORMALISIERTEN Zahl-Seed
 * beider Pfade -- der Vergleichspunkt, an dem beide Aufrufer tatsaechlich zusammenlaufen.
 */

const SAVE_ID = "save-1";
const SEASON_ID = "season-1";
const MATCHDAY_ID = "md-5";
const DISCIPLINE_ID = "basketball";

function fixture(input: Partial<Fixture> & { id: string; homeTeamId: string; awayTeamId: string }): Fixture {
  return {
    matchdayId: MATCHDAY_ID,
    status: "scheduled",
    leagueTier: "liga1",
    ...input,
  } as Fixture;
}

/** Der Seed, den der ZAEHLENDE Runner-Lauf fuer dieses Fixture/Disziplin tatsaechlich verwendet. */
function runnerSeed(f: Fixture, disciplineId: string): number {
  return seedZuZahl(
    buildArenaMatchSeed({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineId,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
    }),
  );
}

describe("Arena-Saat-Identitaet: Host-Saatberechnung vs. Runner-Eingabebau", () => {
  it("liefert fuer korrekt orientierte UI-Auswahl denselben Seed wie der Runner", () => {
    const echtesFixture = fixture({ id: "fx-1", homeTeamId: "team-a", awayTeamId: "team-b" });
    const fixtureIndex = baueFixtureIndex([echtesFixture]);

    const host = resolveArenaHostSeeds({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineIds: [DISCIPLINE_ID],
      heimTeamId: "team-a",
      gastTeamId: "team-b",
      fixtureIndex,
    });

    expect(host.istKeinGewertetesDuell).toBe(false);
    expect(host.seedByDisciplineId[DISCIPLINE_ID]).toBe(runnerSeed(echtesFixture, DISCIPLINE_ID));
  });

  it("liefert BITGLEICHEN Seed, auch wenn die UI-Auswahl Heim/Gast verkehrt herum waehlt (F9)", () => {
    const echtesFixture = fixture({ id: "fx-2", homeTeamId: "team-a", awayTeamId: "team-b" });
    const fixtureIndex = baueFixtureIndex([echtesFixture]);

    // UI-Auswahl verkehrt herum: der Spieler waehlt team-b als "Heim" und team-a als "Gast".
    const hostVerkehrt = resolveArenaHostSeeds({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineIds: [DISCIPLINE_ID],
      heimTeamId: "team-b",
      gastTeamId: "team-a",
      fixtureIndex,
    });
    const hostRichtig = resolveArenaHostSeeds({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineIds: [DISCIPLINE_ID],
      heimTeamId: "team-a",
      gastTeamId: "team-b",
      fixtureIndex,
    });

    expect(hostVerkehrt.istKeinGewertetesDuell).toBe(false);
    expect(hostVerkehrt.seedByDisciplineId[DISCIPLINE_ID]).toBe(hostRichtig.seedByDisciplineId[DISCIPLINE_ID]);
    expect(hostVerkehrt.seedByDisciplineId[DISCIPLINE_ID]).toBe(runnerSeed(echtesFixture, DISCIPLINE_ID));
  });

  it("liefert KEINE Saat fuer ein Paar, das an diesem Spieltag kein Fixture ist", () => {
    const echtesFixture = fixture({ id: "fx-3", homeTeamId: "team-a", awayTeamId: "team-b" });
    const fixtureIndex = baueFixtureIndex([echtesFixture]);

    const host = resolveArenaHostSeeds({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineIds: [DISCIPLINE_ID],
      heimTeamId: "team-a",
      gastTeamId: "team-c", // team-c ist nicht team-as Gegner an diesem Spieltag
      fixtureIndex,
    });

    expect(host.istKeinGewertetesDuell).toBe(true);
    expect(host.seedByDisciplineId).toEqual({});
  });

  it("liefert KEINE Saat, wenn fuer das Heim-Team ueberhaupt kein Fixture existiert", () => {
    const fixtureIndex = baueFixtureIndex([]);

    const host = resolveArenaHostSeeds({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineIds: [DISCIPLINE_ID],
      heimTeamId: "team-a",
      gastTeamId: "team-b",
      fixtureIndex,
    });

    expect(host.istKeinGewertetesDuell).toBe(true);
    expect(host.seedByDisciplineId).toEqual({});
  });

  it("meldet keine Warnung bei leerer/unvollstaendiger Eingabe (kein Team gewaehlt)", () => {
    const fixtureIndex = baueFixtureIndex([fixture({ id: "fx-4", homeTeamId: "team-a", awayTeamId: "team-b" })]);

    const host = resolveArenaHostSeeds({
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      disciplineIds: [DISCIPLINE_ID],
      heimTeamId: "",
      gastTeamId: "",
      fixtureIndex,
    });

    expect(host.istKeinGewertetesDuell).toBe(false);
    expect(host.seedByDisciplineId).toEqual({});
  });

  it("ist konsistent mit `findLeagueFixturesForMatchday()` ueber zwei Disziplinen (WEG B) eines echten Spielplans", () => {
    const fixtures: Fixture[] = [
      fixture({ id: "fx-5", homeTeamId: "team-a", awayTeamId: "team-b", leagueTier: "liga1" }),
      fixture({ id: "fx-6", homeTeamId: "team-c", awayTeamId: "team-d", leagueTier: "liga1" }),
      fixture({ id: "fx-7", homeTeamId: "team-e", awayTeamId: "team-f", leagueTier: "liga2" }),
    ];
    const gameState = { seasonState: { schedule: fixtures } } as unknown as GameState;

    // Runner-Seite: liest ueber `findLeagueFixturesForMatchday()` je Liga-Stufe.
    const runnerFixturesLiga1 = findLeagueFixturesForMatchday(gameState, "liga1", MATCHDAY_ID);
    expect(runnerFixturesLiga1).toHaveLength(2);

    // Host-Seite: liest ueber `findeSpieltagsFixtures()`/`baueFixtureIndex()` -- liga-unabhaengig,
    // genau wie der Host es tut (er kennt die Liga-Stufe des gewaehlten Teams nicht vorab).
    const hostFixtureIndex = baueFixtureIndex(findeSpieltagsFixtures(gameState, MATCHDAY_ID));

    for (const disciplineId of ["gewichtheben", "staffel"]) {
      for (const f of runnerFixturesLiga1) {
        const host = resolveArenaHostSeeds({
          saveId: SAVE_ID,
          seasonId: SEASON_ID,
          matchdayId: MATCHDAY_ID,
          disciplineIds: [disciplineId],
          heimTeamId: f.homeTeamId,
          gastTeamId: f.awayTeamId,
          fixtureIndex: hostFixtureIndex,
        });
        expect(host.seedByDisciplineId[disciplineId]).toBe(runnerSeed(f, disciplineId));
      }
    }
  });
});
