/**
 * CLIMBING: GEZEIGT = GEBUCHT, FIGUR FUER FIGUR UND TICK FUER TICK (Pilot "Keine Demos mehr", 11.11.).
 *
 * Chris am 11.11., woertlich: "KEINE DEMOS mehr! das soll nicht einfach abgespult werden! das muss
 * sauber simuliert sein durch unsere engine und das in JEDER disziplin". Dieser Test haelt fuer die
 * Pilot-Disziplin Climbing fest, dass die Battle Arena genau das tut -- nicht nur, dass das ENDERGEBNIS
 * stimmt (das prueft scripts/miss-sendedauer.mjs --nur-anzeige-treue), sondern dass JEDE gezeichnete
 * Figur in JEDEM abgetasteten Moment dort steht, wo der gebuchte Lauf sie in diesem Tick hat:
 *
 *   1. Dieselben Figuren: die Laeufer an der Wand sind die Spieler des uebergebenen (echten) Kaders,
 *      und jede gezeichnete Figur ist als PixelLab-Figur unter ihrem Namen angemeldet.
 *   2. Derselbe Zustand: `pos` jedes Laeufers in der zuschaubaren Wiedergabe (`sondenLauf`, also
 *      derselbe anzeigeSechzigstel()-Takt wie loop()) ist BITGLEICH zu `pos` desselben Laeufers im
 *      gebuchten Lauf (`bahnSpurProbe`, dieselbe Schleife wie bahnLauf()/die Buchung) nach derselben
 *      Zahl an Simulations-Ticks.
 *   3. Dieselbe Stelle: die gezeichnete Hoehe folgt `pos` (ausserhalb der kurzen Sturz-Interpolation
 *      climbAnzeigeAnteil() exakt), jede Figur bleibt in ihrer eigenen Routen-Spalte, und wer laut
 *      Motor hoeher ist, wird auch hoeher gezeichnet.
 *
 * Kader: die erste Paarung aus data/generated/kaderfamilie-live-save.json (echte Spieler aus dem
 * Live-Save, dieselbe Quelle wie scripts/pruefe-wertung-fingerabdruck.mjs), nicht der Demo-Kader.
 * Chromium-Pflicht wie tests/spiele-bahn-invarianten.test.ts (das Motor-IIFE braucht DOM/Canvas).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const KADER_PFAD = join(WURZEL, "data", "generated", "kaderfamilie-live-save.json");
const LAUF_TIMEOUT_MS = 240_000;
// Dieselbe Saat-Konvention wie disziplinProbe()/miss-sendedauer.mjs (1337 + i*7919).
const SAATEN = [1337, 1337 + 7919, 1337 + 2 * 7919];
// Ungerade Blockgroesse, damit die Abtastpunkte nicht immer auf dieselbe Phase des
// zeitFaktor()-Takts (4,38 Anzeige-Sechzigstel je Simulations-Tick) fallen.
const BLOCK = 37;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  // PLAYWRIGHT_BROWSERS_PATH (z.B. /opt/pw-browsers in den Cloud-Containern) ist der Ort, an dem
  // chromium.launch() selbst sucht; ~/.cache/ms-playwright ist Playwrights Vorgabe.
  const orte = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), ".cache", "ms-playwright")].filter(Boolean) as string[];
  return orte.some((ort) => {
    try {
      return readdirSync(ort).some((e) => e.startsWith("chromium"));
    } catch {
      return false;
    }
  });
}

type Kaderzeile = { n: string };
type Spur = { namen: { id: number; n: string; seite: number }[]; spur: number[][] };
type Figur = {
  id: number;
  n: string;
  seite: number;
  pos: number;
  fertig: boolean;
  x: number;
  y: number;
  anzeige: number | null;
  sturz: boolean;
  figurAngemeldet: boolean;
};
type Bild = { tick: number; laeufer: Figur[] };

declare global {
  interface Window {
    __olyArenaKader: { seedByDisciplineId: Record<string, number> };
    __arena: {
      kaderSetzen: (k: { heim: unknown[]; gast: unknown[] }) => unknown;
      endstandNachlauf: (an: boolean) => void;
      anpfiffCountdown: (an: boolean) => void;
      bahnPodAnzeigen: (bd: string, pod: unknown) => void;
      setDisc: (d: string) => void;
      sondenLauf: (ticks: number) => void;
      vorbei: () => boolean;
      bahnSpurProbe: (bd: string, saat: number) => Spur | null;
      bahnFigurenProbe: () => { disc: string; rennT: number; wand: boolean; laeufer: Figur[] } | null;
    };
  }
}

const KADER_DA = existsSync(KADER_PFAD);

describe.skipIf(!chromiumVerfuegbar() || !KADER_DA)("Climbing-Arena: gezeigt = gebucht, Figur fuer Figur, Tick fuer Tick", () => {
  let browser: Browser;
  let seite: Page;
  let heim: Kaderzeile[] = [];
  let gast: Kaderzeile[] = [];

  beforeAll(async () => {
    const familie = JSON.parse(readFileSync(KADER_PFAD, "utf8")) as { varianten: { heim: Kaderzeile[]; gast: Kaderzeile[] }[] };
    heim = familie.varianten[0]!.heim;
    gast = familie.varianten[0]!.gast;
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.addInitScript(() => {
      window.__olyArenaKader = { seedByDisciplineId: {} };
    });
    await seite.goto(SEITEN_PFAD, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && typeof window.__arena.bahnSpurProbe === "function", null, {
      timeout: LAUF_TIMEOUT_MS,
    });
    await seite.evaluate(
      ({ heim, gast }) => {
        window.__arena.endstandNachlauf(false);
        window.__arena.anpfiffCountdown(false);
        window.__arena.kaderSetzen({ heim, gast });
      },
      { heim, gast },
    );
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  for (const saat of SAATEN) {
    it(
      `Saat ${saat}: jede gezeichnete Figur steht in jedem abgetasteten Tick dort, wo der gebuchte Lauf sie hat`,
      async () => {
        const { gebucht, bilder } = await seite.evaluate(
          ({ saat, BLOCK }) => {
            const A = window.__arena;
            const gebucht = A.bahnSpurProbe("climbing", saat)!;
            A.bahnPodAnzeigen("climbing", null);
            window.__olyArenaKader.seedByDisciplineId.climbing = saat;
            A.setDisc("climbing");
            const bilder: { tick: number; laeufer: unknown[] }[] = [];
            let anzeigeTicks = 0;
            while (anzeigeTicks < 60 * 60 * 12) {
              A.sondenLauf(BLOCK);
              anzeigeTicks += BLOCK;
              const p = A.bahnFigurenProbe();
              if (p && p.wand) bilder.push({ tick: Math.round(p.rennT * 60), laeufer: p.laeufer });
              if (A.vorbei()) break;
            }
            return { gebucht, bilder: bilder as Bild[] };
          },
          { saat, BLOCK },
        );

        // --- 1. Dieselben Figuren: echter Kader, als PixelLab-Figur angemeldet -----------------
        const kaderNamen = new Set([...heim, ...gast].map((z) => z.n));
        expect(gebucht.namen.length).toBeGreaterThanOrEqual(2);
        for (const l of gebucht.namen) expect(kaderNamen.has(l.n), `${l.n} gehoert zum uebergebenen Kader`).toBe(true);
        expect(bilder.length).toBeGreaterThan(20);
        const gebuchtNachId = new Map(gebucht.namen.map((l, i) => [l.id, { ...l, i }]));

        let verglicheneTicks = 0;
        let figurBilder = 0;
        let sturzBilder = 0;
        const spalteJeId = new Map<number, number>();
        for (const bild of bilder) {
          if (bild.tick <= 0) continue;
          const idx = Math.min(bild.tick, gebucht.spur.length) - 1;
          const zeile = gebucht.spur[idx]!;
          expect(bild.laeufer.map((l) => l.n).sort()).toEqual(gebucht.namen.map((l) => l.n).sort());
          for (const l of bild.laeufer) {
            const g = gebuchtNachId.get(l.id)!;
            expect(g, `Laeufer ${l.id} existiert im gebuchten Lauf`).toBeDefined();
            expect(l.n).toBe(g.n);
            expect(l.seite).toBe(g.seite);
            // 2. Derselbe Zustand: BITGLEICH, nicht "ungefaehr".
            expect(l.pos, `${l.n} @ Tick ${bild.tick}`).toBe(zeile[g.i]);
            expect(l.figurAngemeldet, `${l.n} ist als PixelLab-Figur angemeldet`).toBe(true);
            // 3. Dieselbe Stelle: eigene Spalte, Hoehe folgt pos.
            const spalte = spalteJeId.get(l.id);
            if (spalte == null) spalteJeId.set(l.id, l.x);
            else expect(Math.abs(l.x - spalte), `${l.n} bleibt in seiner Routen-Spalte`).toBeLessThan(1e-6);
            if (l.sturz) sturzBilder += 1;
            else expect(l.anzeige, `${l.n} gezeichnete Hoehe = Motor-Fortschritt`).toBe(Math.max(0, Math.min(1, l.pos)));
            figurBilder += 1;
          }
          // Wer laut Motor hoeher haengt, wird hoeher (kleineres y) gezeichnet.
          const stabil = bild.laeufer.filter((l) => !l.sturz && l.anzeige != null);
          for (const a of stabil) {
            for (const b of stabil) {
              if ((a.anzeige as number) > (b.anzeige as number) + 1e-9) {
                expect(a.y, `${a.n} ueber ${b.n} @ Tick ${bild.tick}`).toBeLessThan(b.y);
              }
            }
          }
          verglicheneTicks += 1;
        }
        expect(verglicheneTicks).toBeGreaterThan(20);
        // Die Sturz-Interpolation ist eine kurze Ueberblendung, kein Dauerzustand.
        expect(sturzBilder).toBeLessThan(figurBilder * 0.25);
      },
      LAUF_TIMEOUT_MS,
    );
  }
});
