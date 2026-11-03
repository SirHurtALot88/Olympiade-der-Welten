/**
 * STAFFEL UNTERBESETZT: FEHLENDE LAEUFER LAUFEN DOPPELT — MIT IHRER ERSCHOEPFUNG (02.11.).
 *
 * Der Befund (docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6.3): die Staffel teilte die Strecke
 * nach den tatsaechlich gemeldeten Laeufern. Ein Team mit zwei Laeufern lief zwei lange Beine mit
 * EINEM Wechsel gegen sechs kurze mit fuenf und gewann damit ueberdurchschnittlich oft — im Duell mit
 * seinen besten zwei 90 % gegen 48 % voll besetzt (Kader-Familie, 300 Rennen).
 *
 * Chris' Regel (Option a, 6.7), mit seiner Praezisierung: alle Seiten laufen dieselbe Beinzahl, die
 * vorhandenen Laeufer uebernehmen die fehlenden Beine reihum, und wer doppelt laeuft, behaelt seine
 * Erschoepfung ("nicht, dass dann einfach der beste Spieler nochmal laufen darf und dann das Ergebnis
 * besser ist, als wenn irgendein anderer das gemacht haette"). Unterbesetzung muss ein echter Nachteil
 * bleiben wie 5 gegen 6 im Kampf — nicht neutral und schon gar nicht ein Vorteil.
 *
 * Geprueft gegen echten Chromium (Engine-IIFE mit DOM-Zugriff):
 *  1. Beinverteilung und Erschoepfung im Duell (`bahnLauf`, Aufstellung ueber __olyArenaKader wie im
 *     Runner): beide Seiten laufen sechs Beine, die zwei Gemeldeten je drei, ihre Zusatzbeine sind
 *     langsamer als ihr erstes.
 *  2. Duell-A/B: dasselbe Gast-Team mit seinen besten 5 bzw. 2 gewinnt seltener als voll besetzt.
 *  3. Pod-A/B (`spieleBahnPod`): dasselbe Team in derselben Gruppe mit derselben Saat ist mit weniger
 *     Laeufern im Mittel langsamer und schlechter platziert, monoton in der Kopfzahl — auch mit nur
 *     einem Laeufer (er geht durch jede Wechselzone, statt k-1 Wechsel zu sparen).
 * Voll besetzt aendert sich nichts: das halten die Fingerabdruecke in tests/bahn-pod-vier-teams.test.ts.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const LAUF_TIMEOUT_MS = 240_000;
const SLOTS = ["startrunner", "tempolink", "batontech", "curverunner", "chaserunner", "anchor"];

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

type KaderSpieler = { n: string; d: Record<string, number>; a: Record<string, number> };
type Variante = { heim: KaderSpieler[]; gast: KaderSpieler[] };
const FAMILIE: Variante[] = CHROMIUM_VERFUEGBAR
  ? JSON.parse(readFileSync(join(WURZEL, "data", "generated", "kaderfamilie-live-save.json"), "utf8")).varianten
  : [];

const besteNachStaffel = (kader: KaderSpieler[]) => [...kader].sort((a, b) => (b.d.staffel || 0) - (a.d.staffel || 0));
const aufstellungAus = (spieler: KaderSpieler[]) =>
  Object.fromEntries(spieler.map((p, i) => [p.n, { d: "staffel", slot: SLOTS[i]! }]));
const mittel = (w: number[]) => w.reduce((s, x) => s + x, 0) / w.length;

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Staffel unterbesetzt: fehlende Laeufer laufen doppelt", () => {
  let browser: Browser;
  let seite: Page;

  // Laedt die Engine mit einem Duell-Kader neu — genau wie `haengeMotorNeuEin` im Runner.
  async function ladeDuell(heim: KaderSpieler[], gast: KaderSpieler[], aufstellung: Record<string, unknown>) {
    await seite.evaluate((kader) => {
      const w = window as unknown as Record<string, unknown>;
      w.__olyArenaKader = kader;
      delete w.__arena;
      document.querySelectorAll("script[data-oly-test-engine]").forEach((el) => el.remove());
      const s = document.createElement("script");
      s.src = "battle-mode.engine.js";
      s.setAttribute("data-oly-test-engine", "1");
      document.body.appendChild(s);
    }, { heim, gast, aufstellung, mutatoren: [] });
    await seite.waitForFunction(() => {
      const a = (window as unknown as { __arena?: Record<string, unknown> }).__arena;
      return !!(a && a.spieleBahn && a.bahnLauf);
    }, null, { timeout: 120_000 });
  }

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      w.AudioContext = undefined;
      w.webkitAudioContext = undefined;
    });
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => !!(window as unknown as { __arena?: unknown }).__arena, null, { timeout: 120_000 });
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Duell: beide Seiten laufen sechs Beine, die zwei Gemeldeten je drei, ihre Zusatzbeine sind muede", async () => {
    const { heim, gast } = FAMILIE[0]!;
    await ladeDuell(heim, gast, aufstellungAus(besteNachStaffel(gast).slice(0, 2)));
    type Laeufer = { n: string; seite: number; beine?: number[]; etappe: number | null; zusatzEtappen?: number[] };
    const laeufe = await seite.evaluate(() => {
      const a = (window as unknown as { __arena: { bahnLauf: (d: string, s: number) => { laeufer: unknown[] } } }).__arena;
      return [11, 42, 1337].map((s) => a.bahnLauf("staffel", s).laeufer);
    }) as Laeufer[][];
    const ersteBeine: number[] = [];
    const zusatzBeine: number[] = [];
    for (const laeufer of laeufe) {
      const heimL = laeufer.filter((u) => u.seite === 0);
      const gastL = laeufer.filter((u) => u.seite === 1);
      expect(heimL).toHaveLength(6);
      expect(heimL.every((u) => u.beine === undefined)).toBe(true);
      expect(gastL).toHaveLength(2);
      expect(gastL.map((u) => u.beine)).toEqual([[0, 2, 4], [1, 3, 5]]);
      for (const u of gastL) {
        expect(u.zusatzEtappen).toHaveLength(2);
        ersteBeine.push(u.etappe!);
        zusatzBeine.push(...u.zusatzEtappen!);
      }
    }
    // Die Erschoepfung bleibt: im Mittel deutlich langsamer als das eigene erste Bein.
    expect(mittel(zusatzBeine)).toBeGreaterThan(mittel(ersteBeine) * 1.1);
  }, LAUF_TIMEOUT_MS);

  it("Duell-A/B: dasselbe Gast-Team gewinnt mit seinen besten 5 bzw. 2 seltener als voll besetzt", async () => {
    const SAATEN = Array.from({ length: 10 }, (_, i) => 7000 + i * 31);
    const siege: Record<number, number> = { 6: 0, 5: 0, 2: 0 };
    for (const v of FAMILIE.slice(0, 3)) {
      for (const [heim, gast] of [[v.heim, v.gast], [v.gast, v.heim]] as const) {
        for (const m of [6, 5, 2]) {
          await ladeDuell(heim, gast, aufstellungAus(besteNachStaffel(gast).slice(0, m)));
          siege[m]! += await seite.evaluate((saaten) => {
            const a = (window as unknown as { __arena: { spieleBahn: (d: string, s: number) => { seiten: number[] } } }).__arena;
            return saaten.filter((s) => { const e = a.spieleBahn("staffel", s); return e.seiten[1]! > e.seiten[0]!; }).length;
          }, SAATEN);
        }
      }
    }
    // 60 Rennen je Kopfzahl. Vorher (Beine = Kopfzahl) lag das 2er-Team weit VOR dem vollen.
    expect(siege[5]).toBeLessThan(siege[6]!);
    expect(siege[2]).toBeLessThan(siege[5]!);
  }, LAUF_TIMEOUT_MS * 2);

  it("Pod-A/B: weniger Laeufer heisst im Mittel langsamer und schlechter platziert, monoton bis zu einem", async () => {
    const teams = [FAMILIE[0]!.heim, FAMILIE[0]!.gast, FAMILIE[1]!.heim, FAMILIE[1]!.gast];
    const r = await seite.evaluate(({ teams, slots }) => {
      type Pod = { teams: { zielzeit: number | null; eventPlatz: number }[] };
      const a = (window as unknown as { __arena: { spieleBahnPod: (bd: string, t: unknown[], s: number, p: unknown[], o: unknown) => Pod } }).__arena;
      const aus: Record<number, { zeit: number[]; platz: number[] }> = {};
      for (let X = 0; X < teams.length; X++) {
        const beste = [...teams[X]!].sort((p, q) => (q.d.staffel || 0) - (p.d.staffel || 0));
        for (const saat of [3, 17, 101]) {
          for (const m of [6, 5, 3, 2, 1]) {
            const pl: Record<string, { d: string; slot: string }> = {};
            beste.slice(0, m).forEach((p, i) => { pl[p.n] = { d: "staffel", slot: slots[i]! }; });
            const e = a.spieleBahnPod("staffel", teams, saat, teams.map((_, i) => (i === X ? pl : null)), { formSaat: saat, k: 6 });
            const z = (aus[m] = aus[m] || { zeit: [], platz: [] });
            z.zeit.push(e.teams[X]!.zielzeit ?? 99);
            z.platz.push(e.teams[X]!.eventPlatz);
          }
        }
      }
      return aus;
    }, { teams, slots: SLOTS });
    const zeit = (m: number) => mittel(r[m]!.zeit);
    const platz = (m: number) => mittel(r[m]!.platz);
    expect(zeit(5)).toBeGreaterThan(zeit(6));
    expect(zeit(3)).toBeGreaterThan(zeit(5));
    expect(zeit(2)).toBeGreaterThan(zeit(3));
    expect(zeit(1)).toBeGreaterThan(zeit(2));
    expect(platz(5)).toBeGreaterThanOrEqual(platz(6));
    expect(platz(2)).toBeGreaterThan(platz(6));
    expect(platz(1)).toBeGreaterThanOrEqual(platz(2));
  }, LAUF_TIMEOUT_MS);
});
