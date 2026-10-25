/**
 * OPUS-REVIEW F1 (BLOCKER, PR 6 des 6-PR-Opus-Plans 21.10., "Buehnen-Anzeige"):
 * Formkarten-Isolations-Regressionstest fuer `renderMiniDmFfa()`.
 *
 * BEFUND (Opus, echtes Headless-Chromium): seit dieser PR `formSaat` an `renderMiniDmFfa()`
 * uebergibt (s. deren Kopfkommentar "GEZEIGT = GEBUCHT"), schreibt `spieleMiniDmFfaEvent()` ueber
 * `mdffaFormkartenFuer()` DAUERHAFT in die GLOBALE `FORMKARTE`-Variable -- fuer alle Spieler ALLER
 * VIER Pod-Teams. Die Heim-/Gast-Kader der Vorschauseite (SQUAD/OPP) stecken dabei praktisch immer
 * im angezeigten Pod (dasselbe Team, zwei Ansichten). Wer zuerst die Mini-DM-Vorschau oeffnet und
 * danach zu einer ANDEREN Disziplin wechselt, sah deshalb dort ein anderes Ergebnis als das
 * eigentlich gebuchte, weil die Formwerte der eigenen Spieler ueberschrieben wurden -- genau die
 * "gezeigt != gebucht"-Fehlerklasse, die diese PR fuer Mini-DM selbst beheben sollte, jetzt aber
 * fuer die anderen 19 Disziplinen neu eingefuehrt haette. Opus mass (Hockey, Saat 4242): vor einem
 * Mini-DM-Aufruf mit Pod-Saat 8:2, danach 9:2 -- derselbe Browser-Zustand, nur weil zwischendurch
 * einmal `renderMiniDmFfa()` mit `formSaat` lief. Ohne Pod-Saat (alter Pfad) blieb es unveraendert
 * bei 8:2.
 *
 * FIX: `renderMiniDmFfa()` kopiert `FORMKARTE` VOR dem `spieleMiniDmFfaEvent()`-Aufruf
 * (`FORMKARTE={...FORMKARTE}` -- Kopie, nicht Referenz, der Aufruf darf also weiterhin
 * schreiben) und spielt im `finally`-Block den urspruenglichen Objekt-Verweis zurueck --
 * dasselbe Kopie-vor/Rueckspielen-nach-Muster wie die bestehenden Sonden `miniDmFfaSonde()`/
 * `miniDmFfaEinfluss()` (s. dort).
 *
 * DIESER TEST, ECHTES CHROMIUM, KEINE INJEKTION: laedt `battle-mode.html` echt, speist Heim-/
 * Gast-Kader EIN, die ZUGLEICH als zwei der vier Mini-DM-Pod-Teams dienen (genau Opus' Szenario:
 * dieselben Spieler in beiden Ansichten). (1) Hockey mit fester Saat liefert vor UND direkt noch
 * einmal vor einem Mini-DM-Render dasselbe Ergebnis (Sanity: deterministisch ohne Zwischenschritt).
 * (2) Hockey mit DERSELBEN Saat NACH `window.__arena.setDisc("mini-dm")` (loest genau den
 * Produktionspfad `renderMiniDmFfa()` aus, den ein Tab-Wechsel in der echten UI ausloesen wuerde)
 * liefert ERNEUT dasselbe Ergebnis -- die Behauptung dieses Tests. (3) Gegenprobe/Kalibrierung:
 * derselbe Formkarten-Zug ueber den rohen Test-Interface-Pfad `window.__arena.miniDmFfaEvent(...,
 * {formSaat})` (OHNE die Isolation von `renderMiniDmFfa()`, s. dessen Kopfkommentar "Test-
 * Interface-Pfad ... die Anzeige renderMiniDmFfa()") veraendert Hockeys Ergebnis TATSAECHLICH --
 * zeigt, dass der gemessene Effekt real ist und dieser Test bei einer entfernten Isolation
 * tatsaechlich rot wuerde, kein Zufallstreffer.
 */
import { describe, expect, it } from "vitest";

import { chromiumVerfuegbar } from "@/tests/helpers/chromium-verfuegbar";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();
const LAUF_TIMEOUT_MS = 180_000;
/**
 * CI-FUND 25.10.: Dieser Regressionstest fuer einen bereits real aufgetretenen Produktionsbug
 * (F1 oben) lief in KEINEM CI-Job mit echtem Chromium -- `full-test-suite`/`persistenz-suiten`
 * installieren keines (stilles `describe.skipIf`, EXIT 0, "skipped" statt rot), und die Jobs, die
 * Chromium installieren (`test-and-smoke`, `arena-chromium-tests`), fuhren diese Datei bisher
 * nicht. Jetzt in `arena-chromium-tests` verdrahtet (eigener Schritt, s. ci.yml) -- und genau wie
 * `tests/arena-vorlauf-parity.test.ts` (selbes Muster, dort zuerst eingefuehrt) setzt dieser Job
 * `OLY_ARENA_CHROMIUM_PFLICHT=1`: bricht der Install-Schritt dort kuenftig (falsche Revision,
 * Netzwerk), wird daraus ein LAUTER Testfehler statt wieder eines stillen Skips -- sonst waere
 * exakt dieselbe Luecke nur einen Schritt weiter hinten erneut offen.
 */
const CHROMIUM_PFLICHT = process.env.OLY_ARENA_CHROMIUM_PFLICHT === "1";
const UEBERSPRINGEN = !CHROMIUM_VERFUEGBAR && !CHROMIUM_PFLICHT;

/** Zehn Spieler je Team, volle Attribute fuer Hockey (Feldspiel) UND Mini-DM gleichzeitig --
 *  dieselbe Bauart wie `tests/mini-dm-ffa-formkarten-position-fix.test.ts`s `baueKader()`, nur
 *  zusaetzlich mit einer `hockey`-Eignung, weil die Gegenprobe/Messung ueber diese Disziplin
 *  laeuft (Opus' eigene Messung war Hockey). */
function baueKader(spielerPrefix: string): { players: Player[]; rosters: RosterEntry[] } {
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
      disciplineRatings: { "mini-dm": 30 + i * 5, hockey: 30 + i * 3, tdm: 20 + i, spurt: 20 + i },
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
    rosters.push({ id: `roster-${playerId}`, teamId: spielerPrefix, playerId, contractLength: 3 } as unknown as RosterEntry);
  }
  return { players, rosters };
}

function baueGameState(): GameState {
  const heim = baueKader("heim");
  const gast = baueKader("gast");
  const fuell1 = baueKader("fuell1");
  const fuell2 = baueKader("fuell2");
  return {
    players: [...heim.players, ...gast.players, ...fuell1.players, ...fuell2.players],
    rosters: [...heim.rosters, ...gast.rosters, ...fuell1.rosters, ...fuell2.rosters],
  } as unknown as GameState;
}

describe.skipIf(UEBERSPRINGEN)("OPUS-REVIEW F1 · renderMiniDmFfa() isoliert FORMKARTE von anderen Disziplinen", () => {
  // Laut statt leise, wenn der CI-Job, der Chromium garantiert haben SOLLTE
  // (OLY_ARENA_CHROMIUM_PFLICHT=1), trotzdem keines findet -- s. Kommentar bei CHROMIUM_PFLICHT
  // oben. `describe.skipIf` greift in diesem Fall NICHT (s. UEBERSPRINGEN).
  if (CHROMIUM_PFLICHT && !CHROMIUM_VERFUEGBAR) {
    it("OLY_ARENA_CHROMIUM_PFLICHT=1, aber kein Chromium gefunden -- Install-Schritt dieses Jobs pruefen", () => {
      throw new Error(
        "Dieser CI-Job setzt OLY_ARENA_CHROMIUM_PFLICHT=1 (Chromium MUSS installiert sein), aber " +
          "chromiumVerfuegbar() fand keines. Vermutlich ist der \"npx playwright install chromium\"-" +
          "Schritt dieses Jobs fehlgeschlagen oder wurde entfernt.",
      );
    });
    return;
  }
  it(
    "Hockey-Ergebnis bei fester Saat bleibt unveraendert, nachdem die Mini-DM-Vorschau mit echtem Pod/formSaat lief",
    async () => {
      const { chromium } = await import("playwright");
      const { existsSync: fsExistsSync } = await import("node:fs");
      const path = await import("node:path");
      const { pathToFileURL } = await import("node:url");
      const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
      if (!fsExistsSync(seitenPfad)) throw new Error("battle-mode.html nicht gefunden.");

      const gameState = baueGameState();
      const { buildArenaTeam } = await import("@/lib/foundation/battle-arena/arena-kader-adapter");
      const heim = buildArenaTeam(gameState, "heim");
      const gast = buildArenaTeam(gameState, "gast");
      const fuell1 = buildArenaTeam(gameState, "fuell1");
      const fuell2 = buildArenaTeam(gameState, "fuell2");

      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.addInitScript(() => {
          const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
          if (typeof fenster.__name !== "function") fenster.__name = (fn) => fn;
        });
        // GENAU OPUS' SZENARIO: `heim`/`gast` (die beiden Teams, die jede andere Disziplin --
        // hier Hockey -- simuliert) sind ZUGLEICH zwei der vier `miniDmFfaTeams` -- dieselben
        // Spieler, dieselben Namen, zwei Ansichten. `miniDmFfaSaat`/`miniDmFfaK` gesetzt und
        // `miniDmFfaTeams` vollstaendig (4 Teams mit Kader) macht `renderMiniDmFfa()`s
        // `echteBuchung` wahr -- exakt der Zweig, der `formSaat` an `spieleMiniDmFfaEvent()`
        // durchreicht.
        await page.addInitScript(
          (kader) => {
            (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
          },
          {
            heim,
            gast,
            aufstellung: {},
            mutatoren: [],
            miniDmFfaK: 4,
            miniDmFfaSaat: 777,
            miniDmFfaAufstellung: [],
            miniDmFfaTeams: [
              { name: "Heim", kader: heim },
              { name: "Gast", kader: gast },
              { name: "Fuellteam 1", kader: fuell1 },
              { name: "Fuellteam 2", kader: fuell2 },
            ],
          },
        );
        await page.goto(pathToFileURL(seitenPfad).href);

        const HOCKEY_SAAT = 4242;
        const ergebnis = await page.evaluate(
          ({ saat }) => {
            const fenster = window as unknown as {
              __arena: {
                spiele: (dId: string, saat: number) => { punkte: unknown; wert: unknown };
                setDisc: (d: string) => void;
              };
            };
            const vor = fenster.__arena.spiele("hockey", saat);
            // Sanity: zwei Aufrufe OHNE jeden Zwischenschritt muessen bit-identisch sein --
            // sonst waere ein spaeterer Unterschied kein Beweis fuer einen Formkarten-Leck,
            // sondern nur Motor-Nichtdeterminismus.
            const vorNochmal = fenster.__arena.spiele("hockey", saat);
            // GENAU DER PRODUKTIONSPFAD: ein Tab-Wechsel in der echten UI ruft `setDisc()`,
            // das intern `reset()` -> `renderMiniDmFfa()` fuer disc==="mini-dm" aufruft --
            // dieselbe Funktion, die der F1-Fund betrifft.
            fenster.__arena.setDisc("mini-dm");
            const nach = fenster.__arena.spiele("hockey", saat);
            return { vor, vorNochmal, nach };
          },
          { saat: HOCKEY_SAAT },
        );

        expect(ergebnis.vor).toEqual(ergebnis.vorNochmal);
        // DIE BEHAUPTUNG DIESES TESTS: Hockey liefert nach dem Mini-DM-Render (mit echtem
        // Pod/formSaat) exakt dasselbe Ergebnis wie davor -- kein Formkarten-Leck.
        expect(ergebnis.nach).toEqual(ergebnis.vor);
      } finally {
        await browser.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "Gegenprobe/Kalibrierung: derselbe Formkarten-Zug ueber den rohen Test-Interface-Pfad (ohne renderMiniDmFfa()s Isolation) veraendert Hockeys Ergebnis tatsaechlich",
    async () => {
      const { chromium } = await import("playwright");
      const { existsSync: fsExistsSync } = await import("node:fs");
      const path = await import("node:path");
      const { pathToFileURL } = await import("node:url");
      const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
      if (!fsExistsSync(seitenPfad)) throw new Error("battle-mode.html nicht gefunden.");

      const gameState = baueGameState();
      const { buildArenaTeam } = await import("@/lib/foundation/battle-arena/arena-kader-adapter");
      const heim = buildArenaTeam(gameState, "heim");
      const gast = buildArenaTeam(gameState, "gast");
      const fuell1 = buildArenaTeam(gameState, "fuell1");
      const fuell2 = buildArenaTeam(gameState, "fuell2");

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
          { heim, gast, aufstellung: {}, mutatoren: [] },
        );
        await page.goto(pathToFileURL(seitenPfad).href);

        const HOCKEY_SAAT = 4242;
        const ergebnis = await page.evaluate(
          ({ saat, teams }) => {
            const fenster = window as unknown as {
              __arena: {
                spiele: (dId: string, saat: number) => { punkte: unknown };
                miniDmFfaEvent: (vierTeams: unknown[], saat: number, platzJeTeam: unknown, optionen: unknown) => unknown;
              };
            };
            const vor = fenster.__arena.spiele("hockey", saat);
            // ROHER Motor-Aufruf OHNE `renderMiniDmFfa()`s Kopie-vor/Rueckspielen-nach-Schutz --
            // derselbe `formSaat`-Mechanismus, den `renderMiniDmFfa()` seit dieser PR intern
            // auch benutzt, hier aber direkt und ungeschuetzt.
            fenster.__arena.miniDmFfaEvent(teams, 777, [], { k: 4, formSaat: 777 });
            const nach = fenster.__arena.spiele("hockey", saat);
            return { vor, nach };
          },
          { saat: HOCKEY_SAAT, teams: [heim, gast, fuell1, fuell2] },
        );

        // Die alte, ungeschuetzte Verzerrung muss hier (Isolation bewusst nicht aktiviert)
        // reproduzierbar sein -- sonst waere die Gegenprobe selbst wertlos.
        expect(ergebnis.nach).not.toEqual(ergebnis.vor);
      } finally {
        await browser.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});

/**
 * OPUS-REVIEW F2 (PR 6 des 6-PR-Opus-Plans 21.10., "Buehnen-Anzeige"): `mdffaRollenLabel()` las
 * nur `SLOTS_JE_DISC["mini-dm"]` mit den alten VIER Eintraegen. Bei k=5/6 erschienen die Runden
 * 5/6 deshalb als rohe IDs ("chaosdriver"/"lasthit") statt als Anzeigenamen -- erst durch diese PR
 * sichtbar (PR 6 ist der erste Aufrufer, der `k` ueberhaupt an die Live-Buehne durchreicht).
 * FIX: Rueckfall auf `MINI_DM_FFA_SLOTS_JE_K[6]` (die volle Sechser-Liste), wenn
 * `SLOTS_JE_DISC["mini-dm"]` die Rolle nicht kennt.
 */
describe.skipIf(UEBERSPRINGEN)("OPUS-REVIEW F2 · Rollen-Anzeigenamen bei k=6 (Paarungs-Vorschau)", () => {
  if (CHROMIUM_PFLICHT && !CHROMIUM_VERFUEGBAR) {
    it("OLY_ARENA_CHROMIUM_PFLICHT=1, aber kein Chromium gefunden -- Install-Schritt dieses Jobs pruefen", () => {
      throw new Error(
        "Dieser CI-Job setzt OLY_ARENA_CHROMIUM_PFLICHT=1 (Chromium MUSS installiert sein), aber " +
          "chromiumVerfuegbar() fand keines. Vermutlich ist der \"npx playwright install chromium\"-" +
          "Schritt dieses Jobs fehlgeschlagen oder wurde entfernt.",
      );
    });
    return;
  }
  it(
    "Runde 5/6 zeigen 'Chaos Driver'/'Last Hit', nicht die rohen Ids 'chaosdriver'/'lasthit'",
    async () => {
      const { chromium } = await import("playwright");
      const { existsSync: fsExistsSync } = await import("node:fs");
      const path = await import("node:path");
      const { pathToFileURL } = await import("node:url");
      const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
      if (!fsExistsSync(seitenPfad)) throw new Error("battle-mode.html nicht gefunden.");

      const gameState = baueGameState();
      const { buildArenaTeam } = await import("@/lib/foundation/battle-arena/arena-kader-adapter");
      const heim = buildArenaTeam(gameState, "heim");
      const gast = buildArenaTeam(gameState, "gast");
      const fuell1 = buildArenaTeam(gameState, "fuell1");
      const fuell2 = buildArenaTeam(gameState, "fuell2");

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
          {
            heim,
            gast,
            aufstellung: {},
            mutatoren: [],
            miniDmFfaK: 6,
            miniDmFfaSaat: 555,
            miniDmFfaAufstellung: [],
            miniDmFfaTeams: [
              { name: "Heim", kader: heim },
              { name: "Gast", kader: gast },
              { name: "Fuellteam 1", kader: fuell1 },
              { name: "Fuellteam 2", kader: fuell2 },
            ],
          },
        );
        await page.goto(pathToFileURL(seitenPfad).href);

        const paarungenText = await page.evaluate(() => {
          const fenster = window as unknown as { __arena: { setDisc: (d: string) => void } };
          fenster.__arena.setDisc("mini-dm");
          const el = document.getElementById("mdffaPaarungen");
          return el ? el.textContent ?? "" : null;
        });

        expect(paarungenText).not.toBeNull();
        expect(paarungenText).toContain("Chaos Driver");
        expect(paarungenText).toContain("Last Hit");
        expect(paarungenText).not.toContain("chaosdriver");
        expect(paarungenText).not.toContain("lasthit");
      } finally {
        await browser.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});
