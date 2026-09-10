/**
 * PFLICHT-INVARIANTEN FUER `window.__arena.spieleBahn()` (Ziel 3, Abschnitt 6.2 des Opus-Plans
 * `docs/pm-briefings/opus-plan-feinschliff-vier-disziplinen-09-10.md`).
 *
 * `spieleBahn()` ist das VIERTE Chassis, das ueber `window.__arena` fuer die Arena freigelegt
 * wird (nach Feldspiel/Buehne-Heben/Buehne-Duell/Buehne-Auftritt) -- fuer alle vier bestandenen
 * Bahn-Disziplinen auf einmal (Staffel, Spurt, Takeshi's Castle, Time-Trial; Climbing bleibt
 * bewusst draussen, rho 0,790 < 0,80). Zwei Eigenschaften sind hier NICHT verhandelbar, weil eine
 * falsche Wahl die Rangtreue-Messung (rho ueber ARENA_RESOLVED_DISCIPLINE_IDS) leise auf etwas
 * anderes umstellen wuerde, als das Spiel selbst dem Zuschauer zeigt:
 *
 *   1. DER BOXSCORE-WERT MUSS RANGGLEICH ZU `bahnTeamstand().punkte` SEIN, NICHT NUR IRGENDEINE
 *      ZAHL. `MOTOREN[bd].wert()` liefert fuer "rang"/"etappe" NEGATIVE Werte (Platzierung negativ
 *      genommen bzw. -(etappenZeit)+wechselKonto) -- die Impact-Kurve (`ppsAusArenaImpact()`,
 *      `max(0,I)/I_krass`) wuerde daraus JEDEM Bahn-Laeufer 0 PPs machen. `bahnTeamstand().punkte`
 *      ist die ordnungsidentische, nicht-negative Zwillingsgroesse -- "ordnungsidentisch" ist hier
 *      als STRIKTE Spearman-Rangkorrelation von exakt 1,0 ueber viele Saaten geprueft, nicht nur
 *      an einem Einzelfall.
 *   2. `spieleBahn(d,saat).seiten` MUSS ELEMENTWEISE GLEICH `bahnLauf(d,saat).seiten` SEIN --
 *      `bahnLauf()` ist die bereits vertraute, separat gepflegte Sonde (Rennplan-Ansage-Abnahme);
 *      ein Abweichen wuerde bedeuten, dass die Produktion (`spieleBahn`) etwas anderes zaehlt als
 *      die Sonde, die das Overlay/HUD nachbildet.
 *
 * WARUM ECHTER CHROMIUM: `battle-mode.engine.js` ist ein IIFE, das beim Laden sofort auf
 * `document`/Canvas zugreift (s. `tests/arena-headless-runner.test.ts`) -- ein reiner Node-Import
 * scheitert vor der ersten Zeile Simulation. Anders als `arena-headless-runner.test.ts` wird hier
 * NICHT ueber `runArenaFixtures()`/echte Liga-Kader gegangen (kein Motor-Neu-Einhaengen je
 * Fixture noetig): `window.__arena.spieleBahn()`/`bahnLauf()`/`spiele()` laufen bereits auf dem
 * fest eingebauten Demo-Kader (SQUAD/OPP), den auch `disziplinProbe()`
 * (scripts/lib/rangtreue-messung.mjs) fuer die Rangtreue-Messung selbst nutzt -- ein einziger
 * Seitenaufbau traegt beide Invarianten ueber alle vier Disziplinen und >= 200 Saaten.
 *
 * `full-test-suite` faehrt bewusst ohne Chromium (s. `arena-headless-runner.test.ts`) --
 * `describe.skipIf` uebernimmt dasselbe Verfuegbarkeits-Muster.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it, afterAll, beforeAll } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(
  join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.html"),
).href;
const LAUF_TIMEOUT_MS = 120_000;
// >= 200 Saaten, wie vom Plan (Abschnitt 6.2) verlangt -- 240 statt exakt 200, damit ein paar
// Saaten mehr Ausreisser (z.B. eine Bahn ohne einzigen fertigen Laeufer) nicht knapp unter die
// verlangte Stichprobengroesse druecken, falls einzelne Saaten uebersprungen werden muessen.
const SAATEN_ANZAHL = 240;
const BAHNEN = ["staffel", "spurt", "takeshis-castle", "time-trial"] as const;

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

declare global {
  interface Window {
    __arena: {
      spiele: (dId: string, saat: number) => { wert: Record<string, number>; namen: string[] } | null;
      spieleBahn: (bd: string, saat: number) => { seiten: [number, number]; boxscore: { name: string; wert: number }[] } | null;
      bahnLauf: (d: string, saat: number) => { seiten: [number, number] };
    };
  }
}

describe.skipIf(!CHROMIUM_VERFUEGBAR)("window.__arena.spieleBahn() -- Pflicht-Invarianten (Ziel 3, Abschnitt 6.2)", () => {
  let browser: Browser;
  let seite: Page;

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => typeof window.__arena !== "undefined", null, { timeout: LAUF_TIMEOUT_MS });
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it.each(BAHNEN)(
    "Invariante 1 -- %s: MOTOREN[bd].wert() und bahnTeamstand().punkte sind in JEDEM von 240 Saaten-Rennen EXAKT ranggleich (rho = 1,0 je Rennen)",
    async (bd) => {
      // WICHTIG, ERSTER ANLAUF DAVON GESTOLPERT: die Rangkorrelation muss JE RENNEN (je Saat)
      // gebildet werden, nicht ueber alle 240 Saaten HINWEG GEPOOLT. `bahnTeamstand().punkte`
      // ist eine reine RANG-Zahl INNERHALB eines Rennens (1..N), waehrend `MOTOREN[bd].wert()`
      // eine absolute Groesse ist (Etappenzeit/Burgpunkte/Platzierung), deren Skala von Rennen zu
      // Rennen wandert. Ueber viele Rennen gepoolt correlaten deshalb selbst zwei Groessen mit
      // PERFEKTER Ordnungstreue INNERHALB jedes einzelnen Rennens global auf < 1,0 -- nachgemessen
      // (240 Saaten Staffel: gepoolt 0,992, je Rennen 240x exakt 1,0). Das ist exakt dieselbe
      // Konvention wie `rho je Spiel` in scripts/lib/rangtreue-messung.mjs (`auswerten()` bildet
      // `rho()` ebenfalls je Spiel und erst danach den Mittelwert/Median darueber).
      const rhoJeRennen = await seite.evaluate<number[], { bd: string; anzahl: number }>(
        ({ bd, anzahl }) => {
          const ergebnisse: number[] = [];
          for (let saat = 1; saat <= anzahl; saat += 1) {
            // `spiele()` liefert `M.wert()` unveraendert (keyed by Name) -- exakt die Groesse,
            // die die Sonde `disziplinProbe`/die Rangtreue-Messung selbst als Gegenstueck zur
            // Eignung ordnet.
            const motorLauf = window.__arena.spiele(bd, saat);
            // `spieleBahn()` liefert den Boxscore aus `bahnTeamstand().punkte` -- die Groesse,
            // die dieser Test als ordnungsidentisch zu `M.wert()` nachweisen soll.
            const bahnLauf = window.__arena.spieleBahn(bd, saat);
            if (!motorLauf || !bahnLauf) continue;
            const punkteVonName = new Map(bahnLauf.boxscore.map((e) => [e.name, e.wert]));
            const paare: { eig: number; wert: number }[] = [];
            for (const name of motorLauf.namen) {
              const eig = motorLauf.wert[name];
              const wert = punkteVonName.get(name);
              if (typeof eig === "number" && typeof wert === "number") paare.push({ eig, wert });
            }
            if (paare.length < 3) continue;
            // Spearman ueber DIESES eine Rennen -- Zeichen fuer Zeichen dieselbe Formel wie
            // `rho()` unten in Node (hier inline, weil der Browser-Kontext kein Modul importieren
            // kann, s. arena-headless-runner.ts-Kommentar zu page.evaluate()).
            const n = paare.length;
            const rang = (key: "eig" | "wert") => {
              const s = paare.map((p, i) => ({ i, v: p[key] })).sort((a, b) => b.v - a.v);
              const r = new Array(n);
              let k = 0;
              while (k < n) {
                let j = k;
                while (j + 1 < n && s[j + 1].v === s[k].v) j += 1;
                const mittel = (k + j) / 2 + 1;
                for (let m = k; m <= j; m += 1) r[s[m].i] = mittel;
                k = j + 1;
              }
              return r;
            };
            const a = rang("eig");
            const b = rang("wert");
            const ma = a.reduce((x: number, y: number) => x + y, 0) / n;
            const mb = b.reduce((x: number, y: number) => x + y, 0) / n;
            let sab = 0;
            let sa = 0;
            let sb = 0;
            for (let i = 0; i < n; i += 1) {
              const da = a[i] - ma;
              const db = b[i] - mb;
              sab += da * db;
              sa += da * da;
              sb += db * db;
            }
            ergebnisse.push(sab / Math.sqrt(sa * sb || 1));
          }
          return ergebnisse;
        },
        { bd, anzahl: SAATEN_ANZAHL },
      );

      // Genuegend Rennen fuer eine belastbare Aussage -- ein leeres/fast leeres Ergebnis waere
      // selbst ein Fund (kaputte Disziplin), kein stiller Erfolg mangels Daten.
      expect(rhoJeRennen.length).toBeGreaterThan(SAATEN_ANZAHL * 0.9);

      for (const r of rhoJeRennen) {
        expect(r).toBeCloseTo(1, 9);
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it.each(BAHNEN)(
    "Invariante 2 -- %s: spieleBahn(d,saat).seiten ist fuer dieselbe Saat elementweise gleich bahnLauf(d,saat).seiten",
    async (bd) => {
      const abweichungen = await seite.evaluate<
        { saat: number; spieleBahn: [number, number]; bahnLauf: [number, number] }[],
        { bd: string; anzahl: number }
      >(
        ({ bd, anzahl }) => {
          const gefunden: { saat: number; spieleBahn: [number, number]; bahnLauf: [number, number] }[] = [];
          for (let saat = 1; saat <= anzahl; saat += 1) {
            const spieleBahnErgebnis = window.__arena.spieleBahn(bd, saat);
            const bahnLaufErgebnis = window.__arena.bahnLauf(bd, saat);
            if (!spieleBahnErgebnis || !bahnLaufErgebnis) continue;
            const [a0, a1] = spieleBahnErgebnis.seiten;
            const [b0, b1] = bahnLaufErgebnis.seiten;
            if (a0 !== b0 || a1 !== b1) {
              gefunden.push({ saat, spieleBahn: spieleBahnErgebnis.seiten, bahnLauf: bahnLaufErgebnis.seiten });
            }
          }
          return gefunden;
        },
        { bd, anzahl: SAATEN_ANZAHL },
      );

      expect(abweichungen, `Abweichende Saaten fuer ${bd}: ${JSON.stringify(abweichungen)}`).toHaveLength(0);
    },
    LAUF_TIMEOUT_MS,
  );

  /**
   * SLOT-INVARIANTE (Plan Abschnitt 8, Punkt 3): zweimal derselbe Aufruf muss zweimal dasselbe
   * Ergebnis liefern -- der Beweis, dass `M.zurueck(g)` am Ende von `spieleBahn()` den
   * Motorzustand wirklich vollstaendig zuruecksetzt und keine zweite Simulation von einem
   * verunreinigten Zwischenstand aus laeuft.
   */
  it.each(BAHNEN)(
    "%s: zweimal spieleBahn(d,saat) hintereinander liefert bitgenau dasselbe Ergebnis",
    async (bd) => {
      const [ersterLauf, zweiterLauf] = await seite.evaluate<
        [ReturnType<Window["__arena"]["spieleBahn"]>, ReturnType<Window["__arena"]["spieleBahn"]>],
        { bd: string }
      >(({ bd }) => [window.__arena.spieleBahn(bd, 4242), window.__arena.spieleBahn(bd, 4242)], { bd });

      expect(ersterLauf).not.toBeNull();
      expect(zweiterLauf).toEqual(ersterLauf);
    },
    LAUF_TIMEOUT_MS,
  );
});
