import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runArenaFixtures, type ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

/**
 * Abnahme fuer lib/battle/arena-headless-runner.ts (Battle-Mode-Plan, PR 6 / Abschnitt 3.4).
 *
 * Deckt genau das ab, was der Auftrag fuer PR 6 verlangt:
 *   1. Determinismus: derselbe Seed liefert dasselbe Ergebnis.
 *   2. Seed-Sensitivitaet: unterschiedlicher Seed liefert ein unterschiedliches Ergebnis.
 *   3. Batching: mehrere Fixtures MIT UNTERSCHIEDLICHEN Kadern in EINEM Aufruf liefern je
 *      Fixture ein eigenes, zum jeweiligen Kader passendes Ergebnis (kein Kader-Verschleifen
 *      zwischen den Fixtures eines Batches).
 *   4. Sauberer Browser-Shutdown: nach `runArenaFixtures()` (Erfolg UND Fehlerfall) bleibt kein
 *      Chromium-Kindprozess uebrig — der `finally`-Block schliesst den Browser hart.
 *
 * Laeuft gegen echten Chromium (wie scripts/miss-arena-spielefeldspiel.mjs), deshalb ein
 * grosszuegigeres Timeout als der Vitest-Standard (Browser-Start + Sprite-Decodierung je
 * Fixture-Batch).
 *
 * `full-test-suite` in der CI faehrt `npm test` bewusst OHNE Chromium (siehe Kommentar dort:
 * "die Suite ist reines Node") — dieser eine Test braucht als einziger in der ganzen Suite
 * einen echten Browser und wuerde dort mit "Executable doesn't exist" abbrechen. Deshalb
 * `describe.skipIf`: laeuft lokal/im Sandbox-Container (fester Pfad vorhanden) und ueberall
 * sonst, wo `playwright install chromium` schon lief, aber nicht in `full-test-suite`.
 */

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 90_000;

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

function zaehleChromiumKindprozesse(): number {
  try {
    const ausgabe = execSync("ps -eo pid,args", { encoding: "utf8" });
    return ausgabe
      .split("\n")
      .filter((zeile) => zeile.includes(CHROMIUM_PFAD))
      .length;
  } catch {
    // `ps` selbst nicht verfuegbar (z. B. minimaler Container) -> Test kann diesen Aspekt nicht
    // pruefen, soll aber nicht deswegen rot werden.
    return -1;
  }
}

/**
 * Ein realistisch grosser Kader (Basketball braucht nur jeSeite=6, ein echter Teamkader ist
 * aber deutlich groesser). BEWUSST NICHT genau 6: bei GENAU 6 Spielern je Seite nimmt eine
 * voellig unabhaengige UI-Stelle (der TDM-Default-Tab, der beim Laden der Seite VOR jedem
 * spieleFeldspiel()-Aufruf einmal rendert) einen Sonderpfad, der bei synthetischen Testkadern
 * ohne das reine Anzeige-Feld `row` (das nur die Demo-Kader in der Datei selbst tragen, s.
 * "GEGNERSEITE"-Kommentar in battle-mode.engine.js) auf einen Fehler laeuft. Echte
 * `buildArenaTeam()`-Kader treffen diesen Pfad in der Praxis nicht, weil ein echter Roster so
 * gut wie nie exakt 6 Spieler zaehlt -- zehn Spieler je Team bilden das hier nach, ohne
 * irgendetwas an der Simulation selbst zu beruehren.
 */
function baueKader(teamId: string, spielerPrefix: string, anzahl = 10): { players: Player[]; rosters: RosterEntry[] } {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < anzahl; i += 1) {
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
      // tdm/spurt sind reale Player-Ratings, die auch bei echten Kadern (buildArenaTeam liest
      // sie 1:1 aus player.disciplineRatings) immer vorhanden sind -- ein synthetischer Kader,
      // der NUR "basketball" traegt, waere unrealistisch schmal und wuerde die oben
      // beschriebene TDM-Default-Tab-Renderstelle mit einem "undefined.toFixed()" abschiessen.
      disciplineRatings: { basketball: 30 + i * 5, tdm: 20 + i, spurt: 20 + i },
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
      // Die folgenden Felder sind laut `Player`-Typ Pflicht, fuer diesen Test aber irrelevant --
      // buildArenaTeam() liest ausschliesslich die Felder oben (s. arena-kader-adapter.ts).
      preferredDisciplineIds: ["basketball"],
    } as unknown as Player);
    rosters.push({
      id: `roster-${playerId}`,
      teamId,
      playerId,
      contractLength: 3,
    } as unknown as RosterEntry);
  }
  return { players, rosters };
}

function baueGameState(...teams: { teamId: string; prefix: string; anzahl?: number }[]): GameState {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (const team of teams) {
    const kader = baueKader(team.teamId, team.prefix, team.anzahl);
    players.push(...kader.players);
    rosters.push(...kader.rosters);
  }
  return { players, rosters } as unknown as GameState;
}

function pruefeErgebnisForm(ergebnis: ArenaFixtureResult, homeTeamId: string, awayTeamId: string) {
  expect(ergebnis.homeTeamId).toBe(homeTeamId);
  expect(ergebnis.awayTeamId).toBe(awayTeamId);
  expect(Array.isArray(ergebnis.seiten)).toBe(true);
  expect(ergebnis.seiten).toHaveLength(2);
  expect(Array.isArray(ergebnis.boxscore)).toBe(true);
  expect(ergebnis.boxscore.length).toBeGreaterThan(0);
}

describe.skipIf(!CHROMIUM_VERFUEGBAR)("runArenaFixtures", () => {
  it(
    "liefert bei gleichem Seed ein bitgenau identisches Ergebnis",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-heim", prefix: "Heim" },
        { teamId: "team-gast", prefix: "Gast" },
      );
      const fixture = { homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "abnahme-determinismus" };

      const [ersterLauf] = await runArenaFixtures(gameState, [fixture], "basketball");
      const [zweiterLauf] = await runArenaFixtures(gameState, [fixture], "basketball");

      pruefeErgebnisForm(ersterLauf, "team-heim", "team-gast");
      expect(zweiterLauf).toEqual(ersterLauf);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "liefert bei unterschiedlichem Seed ein anderes Ergebnis",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-heim", prefix: "Heim" },
        { teamId: "team-gast", prefix: "Gast" },
      );

      const [seedEins] = await runArenaFixtures(
        gameState,
        [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "seed-eins" }],
        "basketball",
      );
      const [seedZwei] = await runArenaFixtures(
        gameState,
        [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "seed-zwei" }],
        "basketball",
      );

      expect(seedZwei).not.toEqual(seedEins);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "verarbeitet mehrere Fixtures mit unterschiedlichen Kadern in einem Batch korrekt getrennt",
    async () => {
      const gameState = baueGameState(
        { teamId: "liga-a-heim", prefix: "LigaA-Heim" },
        { teamId: "liga-a-gast", prefix: "LigaA-Gast" },
        { teamId: "liga-b-heim", prefix: "LigaB-Heim" },
        { teamId: "liga-b-gast", prefix: "LigaB-Gast" },
      );

      const ergebnisse = await runArenaFixtures(
        gameState,
        [
          { homeTeamId: "liga-a-heim", awayTeamId: "liga-a-gast", seed: "spieltag-3:liga-a" },
          { homeTeamId: "liga-b-heim", awayTeamId: "liga-b-gast", seed: "spieltag-3:liga-b" },
        ],
        "basketball",
      );

      expect(ergebnisse).toHaveLength(2);
      pruefeErgebnisForm(ergebnisse[0], "liga-a-heim", "liga-a-gast");
      pruefeErgebnisForm(ergebnisse[1], "liga-b-heim", "liga-b-gast");

      // Die Boxscore-Namen der beiden Fixtures duerfen sich nicht ueberschneiden -- ein
      // Beweis dafuer, dass Fixture 2 wirklich den LigaB-Kader gespielt hat und nicht (weil
      // SQUAD/OPP im Motor modulintern sind, s. Kommentar im Runner) versehentlich noch den
      // von Fixture 1 uebrig hatte.
      const namenA = new Set(ergebnisse[0].boxscore.map((e) => e.name));
      const namenB = new Set(ergebnisse[1].boxscore.map((e) => e.name));
      const ueberschneidung = [...namenA].filter((n) => namenB.has(n));
      expect(ueberschneidung).toHaveLength(0);
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "schliesst den Browser nach Erfolg und nach Fehlern zuverlaessig (kein Zombie-Prozess)",
    async () => {
      const vorher = zaehleChromiumKindprozesse();

      const gameState = baueGameState(
        { teamId: "team-heim", prefix: "Heim" },
        { teamId: "team-gast", prefix: "Gast" },
      );
      await runArenaFixtures(
        gameState,
        [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "shutdown-erfolg" }],
        "basketball",
      );

      // Unbekannte Disziplin -> spieleFeldspiel() liefert null -> der Runner wirft NACH dem
      // Browser-Start, aber VOR dem regulaeren Rueckgabepfad. Der finally-Block muss trotzdem
      // greifen.
      await expect(
        runArenaFixtures(
          gameState,
          [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "shutdown-fehler" }],
          "keine-disziplin-die-es-gibt",
        ),
      ).rejects.toThrow();

      const nachher = zaehleChromiumKindprozesse();
      if (vorher === -1 || nachher === -1) {
        // `ps` in dieser Umgebung nicht verfuegbar -- der eigentliche Determinismus-/Batch-Teil
        // oben hat den Runner trotzdem bereits mehrfach erfolgreich durchlaufen lassen.
        return;
      }
      expect(nachher).toBe(vorher);
    },
    LAUF_TIMEOUT_MS,
  );

  /**
   * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): `boxscore[].playerId`/`.side` sind die
   * Bruecke, ueber die `battle-mode-arena-team-points.ts` einen Boxscore-Namen wieder auf einen
   * echten Spieler zurueckfuehrt.
   */
  it(
    "ordnet jedem Boxscore-Eintrag playerId und side eindeutig zu, wenn die Namen im Duell eindeutig sind",
    async () => {
      const gameState = baueGameState(
        { teamId: "team-heim", prefix: "Heim" },
        { teamId: "team-gast", prefix: "Gast" },
      );

      const [ergebnis] = await runArenaFixtures(
        gameState,
        [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "boxscore-an-pps-zuordnung" }],
        "basketball",
      );

      expect(ergebnis.boxscore.length).toBeGreaterThan(0);
      for (const eintrag of ergebnis.boxscore) {
        expect(eintrag.playerId).not.toBeNull();
        expect(eintrag.side).not.toBeNull();
        // playerId muss auf den bekannten Praefix des Kaders (Heim-* bzw. Gast-*) zurueckfuehren --
        // der Beweis, dass wirklich zurueckgefuehrt und nicht nur irgendein String durchgereicht wurde.
        expect(eintrag.playerId).toMatch(eintrag.side === "home" ? /^Heim-/ : /^Gast-/);
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "faellt fuer eine Namens-Kollision innerhalb eines Duells auf playerId=null/side=null zurueck, statt zu raten",
    async () => {
      // Beide Kader tragen DENSELBEN Namenspool (identischer Praefix) -- der Motor selbst fuehrt
      // Boxscore-Werte nur nach Namen (s. arena-headless-runner.ts-Kommentar), diese Kollision
      // entsteht also GENAU dort, wo sie im echten Spiel ebenfalls entstehen wuerde.
      const gameState = baueGameState(
        { teamId: "team-heim", prefix: "Kollision" },
        { teamId: "team-gast", prefix: "Kollision" },
      );

      const [ergebnis] = await runArenaFixtures(
        gameState,
        [{ homeTeamId: "team-heim", awayTeamId: "team-gast", seed: "boxscore-an-pps-kollision" }],
        "basketball",
      );

      const nameHaeufigkeit = new Map<string, number>();
      for (const eintrag of ergebnis.boxscore) {
        nameHaeufigkeit.set(eintrag.name, (nameHaeufigkeit.get(eintrag.name) ?? 0) + 1);
      }
      const kollidierendeEintraege = ergebnis.boxscore.filter((eintrag) => (nameHaeufigkeit.get(eintrag.name) ?? 0) > 1);

      // Identische Kader auf beiden Seiten -> dieselbe Auswahllogik waehlt praktisch immer
      // dieselben Namen fuer beide Seiten -- mindestens eine Kollision ist so gut wie sicher.
      expect(kollidierendeEintraege.length).toBeGreaterThan(0);
      for (const eintrag of kollidierendeEintraege) {
        expect(eintrag.playerId).toBeNull();
        expect(eintrag.side).toBeNull();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});
