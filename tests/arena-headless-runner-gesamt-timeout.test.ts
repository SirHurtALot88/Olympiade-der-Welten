import { describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

/**
 * OPUS-REVIEW B2 (Plan Abschnitt 9, PR 3/K1): "Gesamt-Timeout pro Durchlauf mit Hard-Kill +
 * Semaphore-Freigabe" -- deckt genau den Codepfad ab, den die bestehenden Tests NICHT erreichen
 * koennen:
 *
 *   - `tests/arena-headless-runner.test.ts` laeuft gegen ECHTES Chromium, aber nie gegen eine
 *     haengende Simulation (es gibt keine im Mockup-Motor einbaubare Endlosschleife, die nicht
 *     den Motor selbst veraendert).
 *   - `tests/arena-vorlauf-service.test.ts` injiziert einen `runArenaFixturesImpl`, der
 *     `runArenaFixtures()` komplett ERSETZT -- die Gesamt-Timeout-Logik LEBT INNERHALB dieser
 *     Funktion (der `Promise.race([lauf, gesamtTimeoutPromise])`-Wettlauf plus
 *     `schliesseEinmal()`), eine Injektion auf dieser Ebene kann sie also nie ausueben.
 *
 * Dieser Test mockt stattdessen `"playwright"` selbst: `chromium.launch()` liefert einen
 * Fake-Browser, dessen `page.evaluate()` NIE aufloest (eine echte haengende Simulation, ohne
 * echten Browser und ohne Abhaengigkeit von einer echten Endlosschleife im Motor). Geprueft wird:
 *
 *   1. `runArenaFixtures(..., { gesamtTimeoutMs: <kurz> })` wirft INNERHALB des Budgets (nicht
 *      erst beim Vitest-Timeout) mit einer Fehlermeldung, die `leiteGrundAusText()`
 *      (arena-vorlauf-service.ts) auf den Ausfallgrund "timeout" abbildet (sie enthaelt
 *      "Timeout").
 *   2. Der Fake-Browser wurde dabei TATSAECHLICH hart geschlossen (`close()` beobachtet) --
 *      ohne das bliebe der globale Chromium-Semaphor (`mitChromiumSemaphor()` in
 *      arena-vorlauf-service.ts) fuer ALLE Saves fuer immer blockiert, nicht nur fuer den
 *      haengenden Lauf.
 *   3. `close()` wird GENAU EINMAL aufgerufen, nie doppelt (der `browserGeschlossen`-Schutz in
 *      `runArenaFixtures()` greift bei einem Wettlauf zwischen dem Timeout-Pfad und einem
 *      eigenen `finally` im Haupt-Lauf).
 */

const fakeBrowser = {
  close: vi.fn(async () => {}),
  newPage: vi.fn(async () => ({
    addInitScript: vi.fn(async () => {}),
    goto: vi.fn(async () => {}),
    // Simuliert eine haengende Simulation: `page.evaluate()` loest absichtlich NIE auf, genau
    // wie ein Motor, der in einer Endlosschleife (Rezept-Bug) stecken bleibt.
    evaluate: vi.fn(() => new Promise(() => {})),
  })),
};

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => fakeBrowser),
  },
}));

// ENV VOR DEM IMPORT GESETZT (B2: "per ENV konfigurierbar"): `STANDARD_GESAMT_TIMEOUT_MS` in
// arena-headless-runner.ts wird als modulweite Konstante EINMAL beim ersten Import ausgewertet --
// ein spaeteres Setzen von `process.env` haette darauf keinen Einfluss mehr. Das deckt den
// ENV-Pfad ab, ohne auf das reale 180s-Produktions-Default warten zu muessen, UND ohne jeden
// Aufruf einzeln mit einer Test-Option ueberschreiben zu muessen.
process.env.OLY_ARENA_GESAMT_TIMEOUT_MS = "300";

// Import NACH dem vi.mock-Aufruf (Vitest hebt vi.mock ohnehin per Hoisting vor alle Imports --
// dieser Import holt trotzdem explizit den gemockten Modulgraphen) UND nach dem ENV-Setzen oben.
const { runArenaFixtures } = await import("@/lib/battle/arena-headless-runner");

function baueMinimalenGameState(): GameState {
  const machePlayer = (id: string): Player =>
    ({
      id,
      name: id,
      rating: 50,
      marketValue: 100_000,
      salaryDemand: 10_000,
      className: "Warrior",
      race: "Human",
      alignment: "neutral",
      gender: "diverse",
      subclasses: ["Warrior"],
      traitsPositive: [],
      traitsNegative: [],
      disciplineRatings: { basketball: 40, tdm: 20, spurt: 20 },
      attributeSheetStats: {
        power: 40,
        health: 50,
        stamina: 45,
        intelligence: 30,
        awareness: 35,
        determination: 40,
        speed: 55,
        dexterity: 50,
        charisma: 20,
        will: 30,
        spirit: 25,
        torment: 10,
      },
      preferredDisciplineIds: ["basketball"],
    } as unknown as Player);
  const macheRoster = (teamId: string, playerId: string): RosterEntry =>
    ({ id: `roster-${playerId}`, teamId, playerId, contractLength: 3 } as unknown as RosterEntry);

  const heim = ["heim-0", "heim-1"].map(machePlayer);
  const gast = ["gast-0", "gast-1"].map(machePlayer);
  const rosters = [
    ...["heim-0", "heim-1"].map((id) => macheRoster("team-heim", id)),
    ...["gast-0", "gast-1"].map((id) => macheRoster("team-gast", id)),
  ];
  return { players: [...heim, ...gast], rosters } as unknown as GameState;
}

describe("arena-headless-runner · Gesamt-Timeout (Opus-Review B2, kritisch)", () => {
  it(
    "wirft innerhalb des Gesamt-Timeout-Budgets und schliesst den haengenden Browser hart, GENAU EINMAL",
    async () => {
      fakeBrowser.close.mockClear();
      const gameState = baueMinimalenGameState();
      const start = Date.now();
      const kurzesTimeoutMs = 300;

      await expect(
        runArenaFixtures(
          gameState,
          [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "b2-haengender-lauf" }],
          "basketball",
          { gesamtTimeoutMs: kurzesTimeoutMs },
        ),
      ).rejects.toThrow(/Gesamt-Timeout/);

      const dauerMs = Date.now() - start;
      // Grosszuegige obere Schranke -- das Ziel ist "wirft innerhalb des Budgets, nicht erst beim
      // Vitest-Timeout von 90s", nicht eine exakte Millisekunden-Behauptung.
      expect(dauerMs).toBeLessThan(kurzesTimeoutMs + 5_000);

      // Hard-Kill beobachtet, und zwar nur einmal (kein doppelter close() aus einem Wettlauf
      // zwischen dem Timeout-Pfad und dem finally des Haupt-Laufs -- beide greifen hier, weil der
      // Haupt-Lauf durch das haengende evaluate() nie selbst in sein eigenes finally kommt; der
      // Timeout-Pfad ist in diesem Test also der EINZIGE, der close() tatsaechlich aufruft).
      expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
    },
    15_000,
  );

  it(
    "greift auch ueber den ENV-Standard (OLY_ARENA_GESAMT_TIMEOUT_MS), ganz ohne Aufruf-Option",
    async () => {
      // Reiner Vertragstest fuer den ENV-Pfad: `gesamtTimeoutMs` bleibt optional (bestehende
      // Aufrufer wie battle-mode-arena-team-points.ts setzen die Option nie) -- hier wirkt NUR
      // der oben vor dem Modul-Import gesetzte `OLY_ARENA_GESAMT_TIMEOUT_MS=300`, kein
      // Options-Override.
      fakeBrowser.close.mockClear();
      const gameState = baueMinimalenGameState();
      const start = Date.now();

      await expect(
        runArenaFixtures(
          gameState,
          [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "b2-env-standard" }],
          "basketball",
          // bewusst KEIN gesamtTimeoutMs hier
        ),
      ).rejects.toThrow(/Gesamt-Timeout/);

      expect(Date.now() - start).toBeLessThan(5_300);
      expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
    },
    15_000,
  );
});
