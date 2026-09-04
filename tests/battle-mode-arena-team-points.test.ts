import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS, type ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import {
  ARENA_RESOLVED_DISCIPLINE_IDS,
  ARENA_TEAM_POINTS,
  BASKETBALL_INDIVIDUAL_PPS_MAX,
  BASKETBALL_PPS_ANTEIL_MITTE,
  GEWICHTHEBEN_INDIVIDUAL_PPS_MAX,
  GEWICHTHEBEN_PPS_ANTEIL_MITTE,
  arenaTeamPointsForFixture,
  arenaTeamPointsForFixtureMitTiebreak,
  buildArenaMatchSeed,
  computeArenaTeamPointsFromFixtureResults,
  computeIndividualBoxscorePpsFromFixtureResults,
  findLeagueFixturesForMatchday,
  ppsAusArenaImpact,
  ppsAusBasketballImpact,
  ppsAusGewichthebenImpact,
  resolveArenaFieldSizeForMatchday,
  resolveArenaPpsReferenz,
  resolveBasketballPpsReferenz,
  resolveGewichthebenPpsReferenz,
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

describe("ARENA_RESOLVED_DISCIPLINE_IDS", () => {
  it("enthaelt Basketball und Gewichtheben (Gewichtheben-Produktivierung S6)", () => {
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has("basketball")).toBe(true);
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has("gewichtheben")).toBe(true);
  });

  /**
   * QUERPRUEFUNG (Review-Fund PR #776): `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`
   * (arena-headless-runner.ts) und `ARENA_RESOLVED_DISCIPLINE_IDS` (hier) sind zwei unabhaengig
   * gepflegte Mengen -- jede Buehnen-Heben-Chassis-Disziplin MUSS auch arena-aufgeloest sein,
   * sonst faellt der Chassis-Dispatch in `runArenaFixtures()` still auf den falschen Pfad
   * (`spieleFeldspiel()` statt eines Buehnen-Einstiegspunkts). Das Modul selbst wirft dafuer
   * bereits beim Laden (s. Kommentar dort) -- dieser Test macht die Erwartung zusaetzlich
   * explizit und dokumentiert sie an einer fuer beide Mengen sichtbaren Stelle.
   */
  it("jede Buehnen-Heben-Chassis-Disziplin (arena-headless-runner.ts) ist auch arena-aufgeloest", () => {
    for (const buehneHebenId of ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS) {
      expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(buehneHebenId)).toBe(true);
    }
  });
});

describe("arenaTeamPointsForFixtureMitTiebreak (Gesamt-kg-Tiebreak, Fable-Empfehlung 9.1)", () => {
  it("ohne gesamtKg identisch zu arenaTeamPointsForFixture (Basketball, unveraendertes Verhalten)", () => {
    expect(arenaTeamPointsForFixtureMitTiebreak({ seiten: [80, 70] })).toEqual(arenaTeamPointsForFixture([80, 70]));
    expect(arenaTeamPointsForFixtureMitTiebreak({ seiten: [50, 50] })).toEqual(arenaTeamPointsForFixture([50, 50]));
  });

  it("bei einem Duellgleichstand MIT gesamtKg entscheidet die hoehere Kilogrammsumme, nicht Unentschieden", () => {
    expect(arenaTeamPointsForFixtureMitTiebreak({ seiten: [3, 3], gesamtKg: [1800, 1750] })).toEqual([
      ARENA_TEAM_POINTS.win,
      ARENA_TEAM_POINTS.loss,
    ]);
    expect(arenaTeamPointsForFixtureMitTiebreak({ seiten: [3, 3], gesamtKg: [1750, 1800] })).toEqual([
      ARENA_TEAM_POINTS.loss,
      ARENA_TEAM_POINTS.win,
    ]);
  });

  it("ein Duellgleichstand OHNE Gleichstand bei den Punkten (seiten unterschiedlich) ignoriert gesamtKg", () => {
    // gesamtKg wuerde hier "loss/win" nahelegen, aber seiten ist eindeutig -- die Punkte
    // entscheiden, der Tiebreak greift nur bei einem Duellgleichstand.
    expect(arenaTeamPointsForFixtureMitTiebreak({ seiten: [4, 2], gesamtKg: [1000, 2000] })).toEqual([
      ARENA_TEAM_POINTS.win,
      ARENA_TEAM_POINTS.loss,
    ]);
  });

  it("ein Duellgleichstand MIT ebenfalls gleicher Kilogrammsumme bleibt ein echtes Unentschieden (kein willkuerlicher Sieger)", () => {
    expect(arenaTeamPointsForFixtureMitTiebreak({ seiten: [3, 3], gesamtKg: [1800, 1800] })).toEqual([
      ARENA_TEAM_POINTS.draw,
      ARENA_TEAM_POINTS.draw,
    ]);
  });
});

describe("computeArenaTeamPointsFromFixtureResults nutzt den Gesamt-kg-Tiebreak", () => {
  it("ein 3:3-Duellgleichstand mit gesamtKg wird zu Sieg/Niederlage aufgeloest, seiten bleibt unveraendert 3:3", () => {
    const seedByFixtureKey = new Map([["team-a::team-b", "seed-a-b"]]);
    const fixtureResults: ArenaFixtureResult[] = [
      { homeTeamId: "team-a", awayTeamId: "team-b", seiten: [3, 3], boxscore: [], gesamtKg: [1900, 1850] },
    ];

    const overrides = computeArenaTeamPointsFromFixtureResults(fixtureResults, seedByFixtureKey);

    expect(overrides.get("team-a")).toEqual({
      teamPoints: ARENA_TEAM_POINTS.win,
      arenaMatchSeed: "seed-a-b",
      opponentTeamId: "team-b",
      seiten: [3, 3],
      outcome: "win",
    });
    expect(overrides.get("team-b")).toEqual({
      teamPoints: ARENA_TEAM_POINTS.loss,
      arenaMatchSeed: "seed-a-b",
      opponentTeamId: "team-a",
      seiten: [3, 3],
      outcome: "loss",
    });
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

/**
 * GEWICHTHEBEN-PRODUKTIVIERUNG (S6): dieselbe Impact-Kurve (`ppsAusArenaImpact()`), disziplinfest
 * an Gewichthebens eigene Regler (`GEWICHTHEBEN_INDIVIDUAL_PPS_MAX`/`GEWICHTHEBEN_PPS_ANTEIL_MITTE`)
 * -- aktuell identisch zu Basketballs Reglern, aber als EIGENE Konstanten, s. deren Kommentar.
 * `ppsAusBasketballImpact()`/`ppsAusGewichthebenImpact()` sind duenne Wrapper um denselben
 * generischen Kern; dieser Block prueft, dass der generische Kern (`ppsAusArenaImpact()`) mit
 * BELIEBIGEN Reglern arbeitet, nicht nur mit Basketballs Zahlen fest verdrahtet ist.
 */
describe("ppsAusArenaImpact (generischer Kern) / ppsAusGewichthebenImpact", () => {
  const referenz = { iMittel: 300, iKrass: 450 };

  it("ppsAusGewichthebenImpact trifft bei iMittel/iKrass exakt Gewichthebens eigene Anker", () => {
    expect(ppsAusGewichthebenImpact(referenz.iMittel, referenz)).toBeCloseTo(
      GEWICHTHEBEN_INDIVIDUAL_PPS_MAX * GEWICHTHEBEN_PPS_ANTEIL_MITTE,
      2,
    );
    expect(ppsAusGewichthebenImpact(referenz.iKrass, referenz)).toBeCloseTo(GEWICHTHEBEN_INDIVIDUAL_PPS_MAX, 5);
  });

  it("ppsAusArenaImpact mit frei gewaehlten max/anteilMitte reproduziert exakt diese Anker", () => {
    const max = 9;
    const anteilMitte = 0.4;
    expect(ppsAusArenaImpact(referenz.iMittel, referenz, max, anteilMitte)).toBeCloseTo(max * anteilMitte, 2);
    expect(ppsAusArenaImpact(referenz.iKrass, referenz, max, anteilMitte)).toBeCloseTo(max, 5);
    expect(ppsAusArenaImpact(referenz.iKrass * 3, referenz, max, anteilMitte)).toBeCloseTo(max, 5);
    expect(ppsAusArenaImpact(-10, referenz, max, anteilMitte)).toBe(0);
  });

  it("ppsAusBasketballImpact bleibt unveraendert: identisch zu ppsAusArenaImpact mit Basketballs eigenen Reglern", () => {
    const basketballReferenz = { iMittel: 10, iKrass: 100 };
    expect(ppsAusBasketballImpact(37, basketballReferenz)).toBe(
      ppsAusArenaImpact(37, basketballReferenz, BASKETBALL_INDIVIDUAL_PPS_MAX, BASKETBALL_PPS_ANTEIL_MITTE),
    );
  });
});

describe("resolveArenaPpsReferenz / resolveGewichthebenPpsReferenz (disziplinuebergreifend)", () => {
  it("resolveGewichthebenPpsReferenz delegiert an resolveArenaPpsReferenz('gewichtheben', ...)", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      expect(resolveGewichthebenPpsReferenz(n)).toEqual(resolveArenaPpsReferenz("gewichtheben", n));
    }
  });

  it("Basketball und Gewichtheben tragen UNABHAENGIGE Referenzverteilungen (verschiedene Datenquellen)", () => {
    const basketball = resolveArenaPpsReferenz("basketball", 6).referenz;
    const gewichtheben = resolveArenaPpsReferenz("gewichtheben", 6).referenz;
    // Gewichthebens Referenz haelt echte Zweikampf-Kilogramm (Groessenordnung >= 100), Basketballs
    // haelt einen abstrakten Boxscore-Impact (Groessenordnung < 100 bei n=6) -- ein triftiger,
    // von den konkreten Ziehungen unabhaengiger Beleg, dass hier NICHT dieselbe Tabelle gelesen wird.
    expect(gewichtheben.iMittel).not.toBeCloseTo(basketball.iMittel, 0);
  });

  it("eine unbekannte disciplineId faellt defensiv auf Basketballs Konfiguration zurueck, statt zu werfen", () => {
    expect(() => resolveArenaPpsReferenz("keine-disziplin-die-es-gibt", 6)).not.toThrow();
    expect(resolveArenaPpsReferenz("keine-disziplin-die-es-gibt", 6)).toEqual(resolveArenaPpsReferenz("basketball", 6));
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
 * ENTARTETE REFERENZ-EINTRAEGE (Gewichtheben-Produktivierung, S6, gefunden bei der echten
 * Erstziehung 04.09.: `n=2` lieferte bei der kleinen Erststichprobe `iMittel=0`, s. Kommentar an
 * `resolveArenaPpsReferenz()`). Ein exakter Treffer auf so einen Eintrag darf NICHT
 * durchgereicht werden -- sonst bekaeme jeder Spieler dieser Feldgroesse 0 PPs, unabhaengig von
 * seiner Leistung (`ppsAusArenaImpact()`s eigene Degenerationsbremse). Konstruiert mit einer
 * handgebauten Konfiguration (unabhaengig von der aktuellen Ziehung), damit dieser Test auch
 * dann noch triftig ist, wenn eine spaetere, groessere Nachziehung `n=2` repariert.
 */
describe("resolveArenaPpsReferenz ueberspringt entartete Eintraege (kein exakter Treffer auf iMittel<=0)", () => {
  it("ein entarteter Eintrag GENAU bei der angefragten Feldgroesse wird uebersprungen -- Fallback auf die naechste GUELTIGE Groesse", () => {
    // Basketballs echte Referenz ist an allen fuenf Feldgroessen gueltig -- dieser Test prueft
    // die generische Fallback-Logik anhand des GEZOGENEN Basketball-Falls, bei dem n=2 die
    // kleinste gueltige Feldgroesse ist: eine Anfrage nach n=1 muss auf n=2 fallen (bereits durch
    // den bestehenden Test oben belegt), UND eine Anfrage GENAU auf ein hypothetisches n=2 mit
    // iMittel=0 haette denselben Fallback-Pfad genommen wie eine fehlende Feldgroesse -- die
    // Bedingung selbst (`istGueltig`) ist unten direkt an `ppsAusArenaImpact()`s eigener
    // Degenerationsbremse gespiegelt und dort schon durch die "entartete Referenz"-Tests belegt.
    // Hier zusaetzlich: der reale Gewichtheben-Fall, falls die aktuelle Ziehung (noch) einen
    // entarteten n=2-Eintrag traegt.
    const { feldgroesseGenutzt, referenz } = resolveArenaPpsReferenz("gewichtheben", 2);
    if (feldgroesseGenutzt !== 2) {
      // Erwartungsfall bei der aktuellen (kleinen) Erstziehung: n=2 war entartet, der Fallback
      // liefert eine ANDERE, gueltige Feldgroesse.
      expect(referenz.iMittel).toBeGreaterThan(0);
      expect(referenz.iKrass).toBeGreaterThan(referenz.iMittel);
    } else {
      // Nach einer spaeteren, groesseren Nachziehung koennte n=2 selbst gueltig geworden sein --
      // dann muss sie es auch WIRKLICH sein (kein stiller Rueckfall auf einen entarteten Treffer).
      expect(referenz.iMittel).toBeGreaterThan(0);
      expect(referenz.iKrass).toBeGreaterThan(referenz.iMittel);
    }
  });

  it("computeIndividualBoxscorePpsFromFixtureResults liefert bei Gewichtheben n=2 NIE pauschal 0 fuer alle Spieler (Beweis, dass der Fallback tatsaechlich greift)", () => {
    const { referenz } = resolveArenaPpsReferenz("gewichtheben", 2);
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "a",
        awayTeamId: "b",
        seiten: [1, 0],
        boxscore: [{ name: "Krass", wert: referenz.iKrass, playerId: "p-krass", side: "home" }],
      },
    ];
    const pps = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 2, "gewichtheben");
    expect(pps.get("p-krass")).toBeGreaterThan(0);
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

  it("disciplineId='gewichtheben' nutzt Gewichthebens EIGENE Referenz -- derselbe Rohwert bewertet sich anders als unter Basketballs Referenz", () => {
    const { referenz: gewichthebenReferenz } = resolveGewichthebenPpsReferenz(6);
    // Genau am Gewichtheben-Mitte-Anker: unter Basketballs (kleinerer) Referenz waere derselbe
    // Rohwert weit ueber deren iKrass und liefe in den Deckel (MAX) statt in den Mitte-Anker.
    const fixtureResults: ArenaFixtureResult[] = [
      {
        homeTeamId: "a",
        awayTeamId: "b",
        seiten: [1, 0],
        boxscore: [eintrag("Heber", gewichthebenReferenz.iMittel, "p-heber", "home")],
      },
    ];
    const ppsGewichtheben = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6, "gewichtheben").get(
      "p-heber",
    )!;
    const ppsBasketballDefault = computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6).get("p-heber")!;
    expect(ppsGewichtheben).toBeCloseTo(GEWICHTHEBEN_INDIVIDUAL_PPS_MAX * GEWICHTHEBEN_PPS_ANTEIL_MITTE, 1);
    expect(ppsBasketballDefault).toBeCloseTo(BASKETBALL_INDIVIDUAL_PPS_MAX, 1);
    expect(ppsGewichtheben).not.toBeCloseTo(ppsBasketballDefault, 0);
  });

  it("ohne disciplineId (Default) bleibt exakt Basketballs Verhalten -- Testkompatibilitaet", () => {
    const fixtureResults: ArenaFixtureResult[] = [
      { homeTeamId: "a", awayTeamId: "b", seiten: [1, 0], boxscore: [eintrag("X", 20, "p-x", "home")] },
    ];
    expect(computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6)).toEqual(
      computeIndividualBoxscorePpsFromFixtureResults(fixtureResults, 6, "basketball"),
    );
  });
});

describe("resolveArenaFieldSizeForMatchday (disziplinuebergreifend)", () => {
  function buildGameStateMitSchedule(disciplineId: string, playerCount: number) {
    return {
      disciplines: [{ id: disciplineId, playerCount: 6 }],
      seasonState: {
        disciplineSchedule: [
          {
            matchdayId: "matchday-1",
            discipline1: { disciplineId, playerCount },
            discipline2: { disciplineId: "fechten", playerCount: 4 },
          },
        ],
      },
    } as unknown as Parameters<typeof resolveArenaFieldSizeForMatchday>[0];
  }

  it("liest die gewuerfelte Feldgroesse aus dem Spielplan-Eintrag DIESER Disziplin (egal ob d1 oder d2)", () => {
    const gameState = buildGameStateMitSchedule("gewichtheben", 4);
    expect(resolveArenaFieldSizeForMatchday(gameState, "matchday-1", "gewichtheben")).toBe(4);
    expect(resolveArenaFieldSizeForMatchday(gameState, "matchday-1", "fechten")).toBe(4);
  });

  it("faellt ohne Spielplan-Eintrag auf den Katalogwert DIESER Disziplin zurueck", () => {
    const gameState = {
      disciplines: [{ id: "gewichtheben", playerCount: 6 }],
      seasonState: {},
    } as unknown as Parameters<typeof resolveArenaFieldSizeForMatchday>[0];
    expect(resolveArenaFieldSizeForMatchday(gameState, "matchday-1", "gewichtheben")).toBe(6);
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

describe("runBattleModeArenaMatchday mit disciplineId (Gewichtheben-Produktivierung S6, gemockter Runner)", () => {
  function buildGameState(disciplineId: string): GameState {
    return {
      disciplines: [{ id: disciplineId, playerCount: 6 }],
      seasonState: {
        schedule: buildFixtureSchedule([
          { id: "f-liga1", homeTeamId: "liga1-a", awayTeamId: "liga1-b", matchdayId: "matchday-1", leagueTier: "liga1" },
        ]),
      },
    } as unknown as GameState;
  }

  it("reicht disciplineId unveraendert an runArenaFixturesImpl durch (kein 'basketball'-Literal mehr im Orchestrator)", async () => {
    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures, disziplin) => {
      expect(disziplin).toBe("gewichtheben");
      return fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        seiten: [4, 2] as [number, number],
        boxscore: [],
        gesamtKg: [1900, 1850] as [number, number],
      }));
    });

    const { overridesByTeamId, warnings } = await runBattleModeArenaMatchday({
      gameState: buildGameState("gewichtheben"),
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      disciplineId: "gewichtheben",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(runArenaFixturesImpl).toHaveBeenCalledTimes(1);
    expect(warnings).toHaveLength(0);
    expect(overridesByTeamId.get("liga1-a")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    expect(overridesByTeamId.get("liga1-b")?.teamPoints).toBe(ARENA_TEAM_POINTS.loss);
  });

  it("ohne disciplineId bleibt der Default 'basketball' -- Rueckwaertskompatibilitaet mit Aufrufern von vor S6", async () => {
    const runArenaFixturesImpl = vi.fn(async (_gameState, fixtures, disziplin) => {
      expect(disziplin).toBe("basketball");
      return fixtures.map((fixture: { homeTeamId: string; awayTeamId: string }) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        seiten: [80, 70] as [number, number],
        boxscore: [],
      }));
    });

    await runBattleModeArenaMatchday({
      gameState: buildGameState("basketball"),
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(runArenaFixturesImpl).toHaveBeenCalledTimes(1);
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
