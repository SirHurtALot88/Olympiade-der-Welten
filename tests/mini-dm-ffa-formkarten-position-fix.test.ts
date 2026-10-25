/**
 * OPUS-REVIEW B1 (kritischer Blocker, PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung"):
 * Positions-Permutations-Regressionstest.
 *
 * BEFUND (Opus, echtes Headless-Chromium): `runMiniDmFfaPodFixtures()` lud VOR dem Fix fuer alle
 * Pods eines Batches genau EINE globale `FORMKARTE` (`zieheFormkarten(20260823)` beim Seiten-
 * Bootstrap, battle-mode.engine.js Zeile ~50186) -- gezogen NUR fuer die beiden Teams, die als
 * `window.__olyArenaKader` (SQUAD/OPP) geladen werden, in `runMiniDmFfaPodFixtures()` die beiden
 * ERSTEN Teams des ERSTEN Pods im Batch. Jedes andere Team -- auch Team 2/3 DESSELBEN ersten Pods,
 * und ALLE Teams jedes weiteren Pods -- bekam `formVon() = 0` (kein Formkarten-Bonus, nie). Zwei
 * attributgleiche Teams, nur an verschiedenen Pod-Positionen, gewannen dadurch strukturell
 * verschieden oft: Opus mass 192/200 (k=4) bzw. 181/200 (k=6) fuer das Team an Position 0 gegen
 * seinen Klon an Position 3.
 *
 * FIX: `spieleMiniDmFfaEvent()` zieht ueber `optionen.formSaat` (additiv, s. Kommentar an der
 * Funktion, battle-mode.engine.js) jetzt JE POD eigene Formkarten fuer alle vier Kader --
 * `runMiniDmFfaPodFixtures()` setzt das seit diesem Fix IMMER (je Pod auf dessen eigenen `seed`).
 *
 * DIESER TEST: 200 Events (dieselbe Groessenordnung wie Opus' Messung), ein Pod je Event, IMMER
 * dieselben vier Teams (A an Position 0, dessen ATTRIBUTGLEICHER Klon an Position 3, zwei bewusst
 * schwaechere Fuellteams an Position 1/2, die praktisch nie gewinnen), nur `podId`/`seed` variiert.
 * Erwartung NACH dem Fix: A und sein Klon gewinnen (gemessen an `ligaPunkte`) ungefaehr gleich oft
 * -- keine Haeufung auf "immer Position 0" mehr. Harte Schranke: das schwaechere Team darf nicht
 * weniger als 35 % der direkten A-gegen-Klon-Vergleiche gewinnen (symmetrisch) -- bei einem echten
 * 50/50-Zufall mit n=200 ist die Streuung (Binomial, sd~7) weit innerhalb dieser Schranke; 35 %
 * waere >2 Standardabweichungen vom Opus-Befund (4 %) entfernt und trotzdem klar strenger als ein
 * zufaelliges 50/50.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runMiniDmFfaPodFixtures, type MiniDmFfaPodFixtureInput, type MiniDmFfaPodFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 180_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}
const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

/** Zehn Spieler je Team, IDENTISCHE Attribut-/Eignungswerte je Index zwischen `prefix`-Paaren --
 *  so sind zwei Teams mit demselben `statSeed` (hier implizit durch denselben Index-Aufbau)
 *  tatsaechlich attributgleich, nur Name/ID unterscheiden sich. */
function baueKader(teamId: string, spielerPrefix: string): { players: Player[]; rosters: RosterEntry[] } {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < 10; i += 1) {
    const playerId = `${spielerPrefix}-${i}`;
    players.push({
      id: playerId,
      name: `${spielerPrefix} Spieler ${i}`,
      rating: 50,
      marketValue: 100_000,
      salaryDemand: 10_000,
      className: "Warrior",
      race: "Human",
      alignment: "neutral",
      gender: "diverse",
      subclasses: ["Warrior"],
      traitsPositive: ["Loyal"],
      traitsNegative: [],
      disciplineRatings: { "mini-dm": 30 + i * 5, tdm: 20 + i, spurt: 20 + i },
      attributeSheetStats: {
        power: 40 + i,
        health: 50 + i,
        stamina: 45 + i,
        intelligence: 30 + i,
        awareness: 35 + i,
        determination: 40 + i,
        speed: 55 + i,
        dexterity: 50 + i,
        charisma: 20 + i,
        will: 30 + i,
        spirit: 25 + i,
        torment: 10 + i,
      },
      preferredDisciplineIds: ["mini-dm"],
    } as unknown as Player);
    rosters.push({ id: `roster-${playerId}`, teamId, playerId, contractLength: 3 } as unknown as RosterEntry);
  }
  return { players, rosters };
}

/** Dieselbe Kader-Bauart, aber deutlich schwaecher (fuer die beiden Fuellteams, die den A-gegen-
 *  Klon-Vergleich nicht verzerren sollen). */
function baueSchwachenKader(teamId: string, spielerPrefix: string): { players: Player[]; rosters: RosterEntry[] } {
  const { players, rosters } = baueKader(teamId, spielerPrefix);
  return {
    players: players.map((p) => ({
      ...p,
      attributeSheetStats: Object.fromEntries(
        Object.entries(p.attributeSheetStats as Record<string, number>).map(([k, v]) => [k, Math.max(1, Math.round(v * 0.2))]),
      ),
      disciplineRatings: { "mini-dm": 2 },
    })) as Player[],
    rosters,
  };
}

function baueGameState(): GameState {
  const a = baueKader("team-a", "A");
  const klon = baueKader("team-a-klon", "AK");
  const fuell1 = baueSchwachenKader("team-fuell-1", "F1");
  const fuell2 = baueSchwachenKader("team-fuell-2", "F2");
  return {
    players: [...a.players, ...klon.players, ...fuell1.players, ...fuell2.players],
    rosters: [...a.rosters, ...klon.rosters, ...fuell1.rosters, ...fuell2.rosters],
  } as unknown as GameState;
}

describe.skipIf(!CHROMIUM_VERFUEGBAR)("OPUS-REVIEW B1 · Positions-Permutationstest (echtes Chromium)", () => {
  it(
    "Team A (Pod-Position 0) und sein attributgleicher Klon (Pod-Position 3) gewinnen nach dem Formkarten-Fix ungefaehr gleich oft",
    async () => {
      const gameState = baueGameState();
      const ANZAHL_EVENTS = 200;
      const pods: MiniDmFfaPodFixtureInput[] = Array.from({ length: ANZAHL_EVENTS }, (_v, i) => ({
        podId: `b1-regressionstest-pod-${i}`,
        // Position 0 = team-a, Position 3 = team-a-klon -- FEST, unveraendert ueber alle 200
        // Events, genau wie Opus' eigene Messung (nur der Seed variiert je Event).
        teamIds: ["team-a", "team-fuell-1", "team-fuell-2", "team-a-klon"] as const,
        seed: `b1-regressionstest-${i}`,
      }));

      const ergebnisse = await runMiniDmFfaPodFixtures(gameState, pods);
      expect(ergebnisse).toHaveLength(ANZAHL_EVENTS);

      let aGewinnt = 0;
      let klonGewinnt = 0;
      let unentschieden = 0;
      for (const ergebnis of ergebnisse) {
        expect(ergebnis).not.toBeNull();
        const e = ergebnis as MiniDmFfaPodFixtureResult;
        const a = e.teams.find((t) => t.teamId === "team-a")!;
        const klon = e.teams.find((t) => t.teamId === "team-a-klon")!;
        if (a.ligaPunkte > klon.ligaPunkte) aGewinnt += 1;
        else if (klon.ligaPunkte > a.ligaPunkte) klonGewinnt += 1;
        else unentschieden += 1;
      }

      const entschiedene = aGewinnt + klonGewinnt;
      // Sanity: bei zwei attributgleichen Teams gegen zwei deutlich schwaechere Fuellteams
      // entscheidet sich der Pod praktisch immer zwischen A und Klon (kein Gleichstand-Chaos).
      expect(entschiedene).toBeGreaterThan(ANZAHL_EVENTS * 0.9);

      const aAnteil = aGewinnt / entschiedene;
      const klonAnteil = klonGewinnt / entschiedene;
      console.error(
        `[b1-regressionstest] A (Position 0): ${aGewinnt}/${entschiedene} (${(aAnteil * 100).toFixed(1)}%), ` +
          `Klon (Position 3): ${klonGewinnt}/${entschiedene} (${(klonAnteil * 100).toFixed(1)}%), ` +
          `Unentschieden: ${unentschieden}`,
      );

      // VOR dem Fix (Opus' Messung): 192/200 bzw. 181/200 fuer Position 0 -- 96 % / 90.5 %, weit
      // ausserhalb dieser Schranke. NACH dem Fix muss beide Seiten mindestens 35 % der
      // entschiedenen Vergleiche gewinnen (symmetrisch) -- bei echtem 50/50 mit n~200 ist die
      // Streuung (Binomial, sd ~ 7 Prozentpunkte) weit innerhalb von [35,65].
      expect(aAnteil).toBeGreaterThanOrEqual(0.35);
      expect(aAnteil).toBeLessThanOrEqual(0.65);
      expect(klonAnteil).toBeGreaterThanOrEqual(0.35);
      expect(klonAnteil).toBeLessThanOrEqual(0.65);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "ohne den Fix (formSaat weggelassen, direkter Motor-Aufruf) waere die alte, einseitige Verzerrung weiterhin nachweisbar -- Gegenprobe, dass dieser Test ueberhaupt etwas misst",
    async () => {
      // Direkter Aufruf des Node-Runners mit einer Chromium-Instanz, aber OHNE den TS-Wrapper
      // `runMiniDmFfaPodFixtures()` (der `formSaat` jetzt immer setzt) -- stattdessen wird die
      // Browser-Seite direkt angesprochen, um den VOR-Fix-Zustand (keine `formSaat`-Option) zu
      // reproduzieren. Das ist bewusst eine Gegenprobe/Kalibrierung dieses Tests selbst: zeigt sie
      // die alte Verzerrung NICHT, waere der obige "bestanden"-Befund kein Beweis fuer den Fix,
      // sondern Zufall oder ein zu lascher Test.
      const { chromium } = await import("playwright");
      const { existsSync: fsExistsSync } = await import("node:fs");
      const path = await import("node:path");
      const { pathToFileURL } = await import("node:url");
      const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
      if (!fsExistsSync(seitenPfad)) throw new Error("battle-mode.html nicht gefunden.");

      const gameState = baueGameState();
      const { buildArenaTeam } = await import("@/lib/foundation/battle-arena/arena-kader-adapter");
      const teamA = buildArenaTeam(gameState, "team-a");
      const teamKlon = buildArenaTeam(gameState, "team-a-klon");
      const teamF1 = buildArenaTeam(gameState, "team-fuell-1");
      const teamF2 = buildArenaTeam(gameState, "team-fuell-2");

      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.addInitScript(() => {
          const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
          if (typeof fenster.__name !== "function") fenster.__name = (fn) => fn;
        });
        await page.addInitScript(
          (kader) => {
            (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
          },
          { heim: teamA, gast: teamF1, aufstellung: {}, mutatoren: [] },
        );
        await page.goto(pathToFileURL(seitenPfad).href);

        const ANZAHL_EVENTS = 200;
        const ergebnisse = await page.evaluate(
          ({ teams, anzahl }) => {
            const fenster = window as unknown as {
              __arena: { miniDmFfaEvent: (vierTeams: unknown[], saat: number) => { teams: Array<{ side: number; ligaPunkte: number }> } };
            };
            const ausgabe: Array<{ teams: Array<{ side: number; ligaPunkte: number }> }> = [];
            for (let i = 0; i < anzahl; i += 1) {
              // OHNE vierten `optionen`-Parameter -- genau der VOR-Fix-Zustand.
              ausgabe.push(fenster.__arena.miniDmFfaEvent(teams, 1000 + i * 7919));
            }
            return ausgabe;
          },
          { teams: [teamA, teamF1, teamF2, teamKlon], anzahl: ANZAHL_EVENTS },
        );

        let aGewinnt = 0;
        let klonGewinnt = 0;
        for (const ergebnis of ergebnisse) {
          const a = ergebnis.teams.find((t) => t.side === 0)!;
          const klon = ergebnis.teams.find((t) => t.side === 3)!;
          if (a.ligaPunkte > klon.ligaPunkte) aGewinnt += 1;
          else if (klon.ligaPunkte > a.ligaPunkte) klonGewinnt += 1;
        }
        const entschiedene = aGewinnt + klonGewinnt;
        console.error(`[b1-gegenprobe-ohne-fix] A (Position 0): ${aGewinnt}/${entschiedene}, Klon (Position 3): ${klonGewinnt}/${entschiedene}`);
        // Die alte, einseitige Verzerrung muss hier (Fix bewusst nicht aktiviert) reproduzierbar
        // sein -- sonst waere die Gegenprobe selbst wertlos.
        expect(entschiedene).toBeGreaterThan(ANZAHL_EVENTS * 0.9);
        expect(aGewinnt / entschiedene).toBeGreaterThan(0.75);
      } finally {
        await browser.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});
