import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import {
  ARENA_TEAM_POINTS,
  BASKETBALL_INDIVIDUAL_PPS_MAX,
  BASKETBALL_PPS_ANTEIL_MITTE,
  arenaTeamPointsForFixture,
  buildArenaMatchSeed,
  computeArenaTeamPointsFromFixtureResults,
  computeIndividualBoxscorePpsFromFixtureResults,
  findLeagueFixturesForMatchday,
  ppsAusBasketballImpact,
  resolveBasketballPpsReferenz,
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
 * DIE IMPACT-KURVE (docs/design/pps-skalierung-opus.md Abschnitt 4.1,
 * docs/design/pps-skalierung-umsetzung.md): reine Funktionspruefung mit einer HANDGEBAUTEN
 * Referenz (unabhaengig von den echten, gezogenen Werten in
 * data/generated/basketball-pps-referenz.json) -- bleibt gueltig, auch wenn die Referenz spaeter
 * neu gezogen wird.
 */
describe("ppsAusBasketballImpact (Impact-Kurve)", () => {
  const referenz = { iMittel: 10, iKrass: 100 };

  it("ein Impact von 0 bekommt 0 PPs", () => {
    expect(ppsAusBasketballImpact(0, referenz)).toBe(0);
  });

  it("ein negativer Impact bekommt 0 PPs, nie negative (Bodenregel wie in distributeByValues())", () => {
    expect(ppsAusBasketballImpact(-5, referenz)).toBe(0);
  });

  it("Impact == iMittel trifft GENAU den Mitte-Anker: MAX * BASKETBALL_PPS_ANTEIL_MITTE", () => {
    expect(ppsAusBasketballImpact(referenz.iMittel, referenz)).toBeCloseTo(
      BASKETBALL_INDIVIDUAL_PPS_MAX * BASKETBALL_PPS_ANTEIL_MITTE,
      2,
    );
  });

  it("Impact == iKrass trifft GENAU den Krass-Anker: die volle Hoechstpunktzahl MAX", () => {
    expect(ppsAusBasketballImpact(referenz.iKrass, referenz)).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX, 5);
  });

  it("ein Impact weit ueber iKrass bleibt bei MAX gedeckelt (Deckel, keine Asymptote/Extrapolation)", () => {
    expect(ppsAusBasketballImpact(referenz.iKrass * 5, referenz)).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX, 5);
  });

  it("ist streng monoton steigend zwischen 0 und iKrass", () => {
    const werte = [1, 5, 10, 25, 50, 75, 100].map((impact) => ppsAusBasketballImpact(impact, referenz));
    for (let i = 1; i < werte.length; i += 1) {
      expect(werte[i]).toBeGreaterThan(werte[i - 1]!);
    }
  });

  it("ein schwacher Spieltag (alle Werte auf/unter iMittel) vergibt NIRGENDS mehr als die Haelfte der Hoechstpunktzahl", () => {
    // Genau Chris' Beschwerde am alten Perzentil-Modell: ein durchweg mittelmaessiger/schwacher
    // Satz an Werten soll NICHT trotzdem nahe an MAX liegen.
    for (const impact of [1, 3, 5, 8, referenz.iMittel]) {
      // +0.01 Toleranz fuer `roundPps()`s Rundung auf zwei Nachkommastellen (5,5*0,25 = 1,375
      // rundet auf 1,38).
      expect(ppsAusBasketballImpact(impact, referenz)).toBeLessThanOrEqual(
        BASKETBALL_INDIVIDUAL_PPS_MAX * BASKETBALL_PPS_ANTEIL_MITTE + 0.01,
      );
    }
  });

  it("eine entartete Referenz (iKrass <= iMittel) liefert 0 statt NaN/Infinity", () => {
    expect(ppsAusBasketballImpact(50, { iMittel: 100, iKrass: 50 })).toBe(0);
    expect(ppsAusBasketballImpact(50, { iMittel: 0, iKrass: 0 })).toBe(0);
  });
});

describe("resolveBasketballPpsReferenz (Feldgroessen-Weiche)", () => {
  it("liefert fuer eine bekannte Feldgroesse (2..6) genau diese zurueck", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      expect(resolveBasketballPpsReferenz(n).feldgroesseGenutzt).toBe(n);
    }
  });

  it("faellt fuer playerCount=null auf Basketballs Katalog-Standardwert 6 zurueck", () => {
    expect(resolveBasketballPpsReferenz(null).feldgroesseGenutzt).toBe(6);
  });

  it("faellt fuer eine zu kleine Feldgroesse (< 2) auf die kleinste gezogene zurueck, statt zu werfen", () => {
    expect(resolveBasketballPpsReferenz(1).feldgroesseGenutzt).toBe(2);
  });

  it("faellt fuer eine zu grosse Feldgroesse (> 6) auf die groesste gezogene zurueck, statt zu werfen", () => {
    expect(resolveBasketballPpsReferenz(9).feldgroesseGenutzt).toBe(6);
  });

  it("verschiedene Feldgroessen tragen unterschiedliche Referenzwerte (Opus-Dokument Abschnitt 7: der Rohwert skaliert massiv mit der Feldgroesse)", () => {
    const klein = resolveBasketballPpsReferenz(2).referenz;
    const gross = resolveBasketballPpsReferenz(6).referenz;
    expect(klein.iMittel).not.toBeCloseTo(gross.iMittel, 5);
    expect(klein.iKrass).not.toBeCloseTo(gross.iKrass, 5);
  });
});

/**
 * BOXSCORE-AN-PPS, V2 (docs/design/boxscore-an-pps.md, docs/design/pps-skalierung-opus.md,
 * docs/design/pps-skalierung-umsetzung.md): individuelle Spieler-PPs ueber die Impact-Kurve gegen
 * eine feste, je Feldgroesse gezogene Referenz -- NICHT mehr ueber ein Perzentil gegen den
 * Spieltags-Pool (V1, entfernt). Nutzt die ECHTE, gezogene Referenz aus
 * data/generated/basketball-pps-referenz.json (ueber `computeIndividualBoxscorePpsFromFixtureResults`
 * selbst geladen) -- die Tests unten pruefen deshalb RELATIVE Eigenschaften und mit
 * `resolveBasketballPpsReferenz()` selbst abgeleitete Werte, keine an die aktuelle Ziehung
 * gebundenen Festwerte, damit ein Neuziehen der Referenz (Opus-Dokument Abschnitt 8.3) diese
 * Tests nicht bricht.
 */
describe("computeIndividualBoxscorePpsFromFixtureResults (BOXSCORE-AN-PPS, V2 Impact-Kurve)", () => {
  function eintrag(name: string, wert: number, playerId: string | null, side: "home" | "away" | null) {
    return { name, wert, playerId, side };
  }

  it("ein hoeherer Impact bekommt bei gleicher Feldgroesse nie weniger PPs als ein niedrigerer", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [eintrag("Top", 40, "p-top", "home"), eintrag("Rest", 5, "p-rest", "away")],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6);
    expect(pps.get("p-top")!).toBeGreaterThan(pps.get("p-rest")!);
  });

  it("ein negativer Impact bekommt 0 PPs, nie negative", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [eintrag("Top", 20, "p-top", "home"), eintrag("Schwach", -3, "p-schwach", "away")],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6);
    expect(pps.get("p-schwach")).toBe(0);
  });

  it("KEIN Spieltags-Pool mehr: derselbe rohe Impact ergibt UNABHAENGIG davon, wie stark der Rest des Spieltags war, dieselben PPs (Chris' Kernbeschwerde am V1-Modell)", () => {
    const schwacherSpieltag: ArenaFixtureResult[] = [
      {
        homeTeamId: "a",
        awayTeamId: "b",
        seiten: [1, 0],
        boxscore: [eintrag("X", 33.5, "p-x", "home"), eintrag("Y", 1, "p-y", "away")],
      },
    ];
    const starkerSpieltag: ArenaFixtureResult[] = [
      {
        homeTeamId: "a",
        awayTeamId: "b",
        seiten: [1, 0],
        // Y hat hier einen VIEL hoeheren Impact (67.4 statt 1) -- unter dem alten Perzentil-Modell
        // haette das X's PPs gesenkt, obwohl X selbst genau gleich gut war.
        boxscore: [eintrag("X", 33.5, "p-x", "home"), eintrag("Y", 67.4, "p-y", "away")],
      },
    ];

    const ppsSchwach = computeIndividualBoxscorePpsFromFixtureResults(schwacherSpieltag, 6).get("p-x")!;
    const ppsStark = computeIndividualBoxscorePpsFromFixtureResults(starkerSpieltag, 6).get("p-x")!;
    expect(ppsSchwach).toBeCloseTo(ppsStark, 5);
  });

  it("dieselbe Rohleistung wird bei unterschiedlicher Feldgroesse unterschiedlich bewertet (kein gemeinsamer Massstab ueber alle Feldgroessen)", () => {
    const fixtureResultsMit = (wert: number): ArenaFixtureResult[] => [
      { homeTeamId: "a", awayTeamId: "b", seiten: [1, 0], boxscore: [eintrag("X", wert, "p-x", "home")] },
    ];
    // Ein Rohwert von 20 ist bei 2v2 (hoeherer iMittel/iKrass, s. Opus-Dokument Abschnitt 7)
    // relativ schwaecher als bei 6v6 -- die Feldgroesse muss also den Ausschlag geben, nicht nur
    // der nackte Rohwert.
    const ppsBei2 = computeIndividualBoxscorePpsFromFixtureResults(fixtureResultsMit(20), 2).get("p-x")!;
    const ppsBei6 = computeIndividualBoxscorePpsFromFixtureResults(fixtureResultsMit(20), 6).get("p-x")!;
    expect(ppsBei2).not.toBeCloseTo(ppsBei6, 5);
  });

  it("ein wirklich krasser Ausreisser (Impact >= iKrass dieser Feldgroesse) erreicht nahe die volle Punktzahl", () => {
    const { referenz } = resolveBasketballPpsReferenz(6);
    const fixtureResults: ArenaFixtureResult[] = [
      { homeTeamId: "a", awayTeamId: "b", seiten: [1, 0], boxscore: [eintrag("Krass", referenz.iKrass * 1.2, "p-krass", "home")] },
    ];
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6);
    expect(pps.get("p-krass")).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX, 5);
  });

  it("ein schwacher Spieltag (alle Werte klar unter iMittel dieser Feldgroesse) vergibt in KEINEM Duell die volle Punktzahl", () => {
    const { referenz } = resolveBasketballPpsReferenz(6);
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "a",
        awayTeamId: "b",
        seiten: [1, 0],
        boxscore: [
          eintrag("S1", referenz.iMittel * 0.3, "p-1", "home"),
          eintrag("S2", referenz.iMittel * 0.6, "p-2", "home"),
          eintrag("S3", referenz.iMittel * 0.9, "p-3", "away"),
        ],
      },
    ];
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6);
    for (const wert of pps.values()) {
      expect(wert).toBeLessThan(BASKETBALL_INDIVIDUAL_PPS_MAX * 0.95);
    }
  });

  it("ein Boxscore-Eintrag ohne eindeutige playerId (Namens-Kollision) bekommt keinen Eintrag im Ergebnis", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        seiten: [10, 5],
        boxscore: [
          eintrag("Top", 20, "p-top", "home"),
          eintrag("Unklar", 1000, null, null),
          eintrag("Rest", 5, "p-rest", "away"),
        ],
      },
    ];

    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6);
    expect(pps.size).toBe(2);
    expect(pps.has("p-top")).toBe(true);
    expect(pps.has("p-rest")).toBe(true);
  });

  it("ein leeres Ergebnis (kein einziges Duell mit zuordenbarem Boxscore) liefert eine leere Map, keinen Fehler", () => {
    const pps = computeIndividualBoxscorePpsFromFixtureResults([], 6);
    expect(pps.size).toBe(0);
  });

  it("playerCount=null wirft nicht, sondern faellt auf eine gueltige Referenz zurueck", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      { homeTeamId: "a", awayTeamId: "b", seiten: [1, 0], boxscore: [eintrag("X", 20, "p-x", "home")] },
    ];
    expect(() => computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, null)).not.toThrow();
  });
});

describe("runBattleModeArenaMatchday liefert individualBoxscorePpsByPlayerId liga-uebergreifend (gemockter Runner)", () => {
  it("V2: liga2-Spieler bekommen dieselben PPs, UNABHAENGIG davon, was liga1 desselben Spieltags leistet (kein gemeinsamer Pool mehr noetig)", async () => {
    const gameStateBeideLigen = {
      disciplines: [{ id: "basketball", playerCount: 6 }],
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f-liga1", homeTeamId: "liga1-a", awayTeamId: "liga1-b", matchdayId: "matchday-1", leagueTier: "liga1" },
          { id: "f-liga2", homeTeamId: "liga2-a", awayTeamId: "liga2-b", matchdayId: "matchday-1", leagueTier: "liga2" },
        ]),
      },
    } as unknown as GameState;
    const gameStateNurLiga2 = {
      ...gameStateBeideLigen,
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f-liga2", homeTeamId: "liga2-a", awayTeamId: "liga2-b", matchdayId: "matchday-1", leagueTier: "liga2" },
        ]),
      },
    } as unknown as GameState;

    const buildRunnerImpl = () =>
      vi.fn(async (_gameState, fixtures) =>
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

    const { individualBoxscorePpsByPlayerId: mitLiga1, warnings: warnungenMit } = await runBattleModeArenaMatchday({
      gameState: gameStateBeideLigen,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: buildRunnerImpl() as never,
    });
    const { individualBoxscorePpsByPlayerId: ohneLiga1, warnings: warnungenOhne } = await runBattleModeArenaMatchday({
      gameState: gameStateNurLiga2,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: buildRunnerImpl() as never,
    });

    expect(warnungenMit).toHaveLength(0);
    expect(warnungenOhne).toHaveLength(0);
    expect(mitLiga1.size).toBe(4);
    expect(ohneLiga1.size).toBe(2);
    // DER KERN DER V2-AENDERUNG: liga2Heim/liga2Gast bekommen exakt dieselben PPs, ob liga1
    // an diesem Spieltag krass stark war (Impact 100/50) oder gar nicht mitlief -- unter dem
    // alten Perzentil-Modell (V1) haette der starke liga1-Pool liga2Heims Perzentil GESENKT.
    expect(mitLiga1.get("p-liga2-heim")).toBeCloseTo(ohneLiga1.get("p-liga2-heim")!, 5);
    expect(mitLiga1.get("p-liga2-gast")).toBeCloseTo(ohneLiga1.get("p-liga2-gast")!, 5);
    // Reihenfolge nach Rohwert bleibt trotzdem erhalten (die Kurve ist monoton).
    expect(mitLiga1.get("p-liga1-heim")!).toBeGreaterThan(mitLiga1.get("p-liga1-gast")!);
    expect(mitLiga1.get("p-liga1-gast")!).toBeGreaterThan(mitLiga1.get("p-liga2-heim")!);
    expect(mitLiga1.get("p-liga2-heim")!).toBeGreaterThan(mitLiga1.get("p-liga2-gast")!);
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
      disciplines: [{ id: "basketball", playerCount: 6 }],
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
      disciplines: [{ id: "basketball", playerCount: 6 }],
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
