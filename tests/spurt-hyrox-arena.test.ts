/**
 * ABNAHME DER HYROX-ARENA (Variante B, 17.11., `docs/design/hyrox-optik-konzept-17-11.md` 3.4).
 *
 * Die Arena ist reine Anzeige: ein leerer PixelLab-Trainingshof (`hyrox_arena.jpg`), darauf legt der Motor
 * Laufrunde, drei Inseln und sieben Geraete als Requisiten. Dieser Test prueft, dass Geometrie, Geraete und
 * Herkunftsnachweise zusammenpassen -- die Wertung selbst belegt `scripts/pruefe-wertung-fingerabdruck.mjs`
 * (GESAMT e80babacb68c, HYROX-Saaten 1/7/42), die Fahrplan-Mathematik `tests/spurt-hyrox-fahrplan.test.ts`.
 *
 *   1. Alle Wegpunkte liegen auf der Leinwand (1240x470).
 *   2. Die Mitte jedes Arbeitsabschnitts liegt auf der Bahnmitte der Inseln und auf der x-Position des
 *      zugehoerigen Geraets (Geraet und Laeufer stehen zusammen).
 *   3. Sieben echte HYROX-Geraete, Namen wie im HUD (kein Rudern: keine Sitzpose im Figurenbestand), je ein
 *      PixelLab-Sprite mit Job-ID in `public/sprites/arena/quellen.json`; die Arena selbst ebenso.
 *   4. Feste Totale: Zoom 1, Kamera auf der Leinwandmitte, Regie aus (Haken fuer Variante C).
 *
 * WARUM ECHTER CHROMIUM: `battle-mode.engine.js` ist ein IIFE, das beim Laden auf `document`/Canvas zugreift.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it, afterAll, beforeAll } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const LAUF_TIMEOUT_MS = 120_000;

type ArenaProbe = {
  halle: boolean;
  zoom: number;
  camR: { x: number; y: number };
  w: number;
  h: number;
  pts: { x: number; y: number }[];
  geraete: { x: number; gruppe: string; name: string; bild: string }[];
  inseln: Record<string, { x0: number; x1: number; bahnen: number }>;
  inselY: number;
  arbeitMitten: { station: number; gruppe: string; x: number; y: number }[];
  regie: boolean;
  reihen: { station: number; gruppe: string; bahnen: number; y: number[]; reihenY: number[] }[];
  pferch: { x0: number; x1: number; y0: number; y1: number };
  ringR: number;
};

declare global {
  interface Window {
    __arena: {
      bahnFlags: (neu?: Record<string, string>) => Record<string, string>;
      setDisc: (d: string) => void;
      hyroxArenaProbe: () => ArenaProbe;
    };
  }
}

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

describe("HYROX-Arena -- Herkunft der Bilder (ohne Browser)", () => {
  const quellen = JSON.parse(readFileSync(join(WURZEL, "public/sprites/arena/quellen.json"), "utf8"));
  const geraete = [
    "hyrox_skierg",
    "hyrox_schlitten_schub",
    "hyrox_schlitten_zug",
    "hyrox_burpee",
    "hyrox_wallball",
    "hyrox_farmers",
    "hyrox_sandsack",
  ];

  it("jedes der sieben Geraete ist eine PixelLab-Datei mit Job-ID und liegt als PNG vor", () => {
    for (const g of geraete) {
      expect(existsSync(join(WURZEL, "public/sprites/arena", `${g}.png`)), g).toBe(true);
      const q = quellen[`${g}.png`];
      expect(q?.paket, g).toBe("PixelLab");
      expect(q?.auftrag?.job, g).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("die Arena ist ein PixelLab-Breitformat (792x300) mit Job-ID, das Bild liegt auf der Leinwandgroesse vor", () => {
    const q = quellen["hyrox_arena.jpg"];
    expect(q?.paket).toBe("PixelLab");
    expect(q?.auftrag?.job).toMatch(/^[0-9a-f-]{36}$/);
    expect(q?.auftrag?.gen).toEqual([792, 300]);
    expect(existsSync(join(WURZEL, "public/sprites/arena/hyrox_arena.jpg"))).toBe(true);
    // Das alte Hallenbild (aus der Szene abgeleitet) ist nicht mehr Teil des Spiels.
    expect(existsSync(join(WURZEL, "public/sprites/arena/hyrox_halle.jpg"))).toBe(false);
    expect(quellen["hyrox_halle.jpg"]).toBeUndefined();
  });
});

describe.skipIf(!chromiumVerfuegbar())("HYROX-Arena -- Geometrie und feste Totale", () => {
  let browser: Browser;
  let seite: Page;
  let probe: ArenaProbe;

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(
      () => typeof window.__arena !== "undefined" && typeof window.__arena.hyroxArenaProbe === "function",
      null,
      { timeout: LAUF_TIMEOUT_MS },
    );
    await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "hyrox" }));
    await seite.evaluate(() => window.__arena.setDisc("spurt"));
    probe = await seite.evaluate(() => window.__arena.hyroxArenaProbe());
    await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "klassisch" }));
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Arena aktiv, alle Wegpunkte liegen auf der Leinwand", () => {
    expect(probe.halle).toBe(true);
    expect(probe.pts.length).toBeGreaterThan(50);
    for (const p of probe.pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(probe.w);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(probe.h);
    }
  });

  it("sieben Geraete mit den Namen der echten HYROX-Stationen, kein Rudern", () => {
    expect(probe.geraete.map((g) => g.name)).toEqual([
      "BURPEE BROAD JUMPS",
      "WALL BALLS",
      "SKIERG",
      "SLED PULL",
      "SLED PUSH",
      "FARMERS CARRY",
      "SANDBAG LUNGES",
    ]);
    expect(probe.geraete.map((g) => g.gruppe)).toEqual(["technik", "technik", "kletter", "kletter", "kraft", "kraft", "kraft"]);
    expect(probe.geraete.some((g) => /ROW|RUDER/i.test(g.name))).toBe(false);
  });

  it("die Mitte jedes Arbeitsabschnitts liegt auf der Bahnmitte der Insel und am Geraet seiner Station", () => {
    expect(probe.arbeitMitten.length).toBe(7);
    for (const m of probe.arbeitMitten) {
      const g = probe.geraete[m.station];
      expect(m.gruppe).toBe(g.gruppe);
      expect(Math.abs(m.y - probe.inselY)).toBeLessThan(2);
      expect(Math.abs(m.x - g.x)).toBeLessThan(10);
      const insel = probe.inseln[g.gruppe];
      expect(g.x).toBeGreaterThan(insel.x0);
      expect(g.x).toBeLessThan(insel.x1);
    }
  });

  it("in den Inseln stehen alle zwoelf Laeufer auf den Geraete-Reihen (Anzeige-y), keiner dazwischen", () => {
    expect(probe.reihen.length).toBe(7);
    for (const r of probe.reihen) {
      expect(r.y.length).toBe(12);
      for (const y of r.y) {
        const abstand = Math.min(...r.reihenY.map((ry) => Math.abs(ry - y)));
        expect(abstand, `Station ${r.station}, y ${y}`).toBeLessThan(1);
      }
      // jede Reihe ist belegt (12 Bahnen auf 4 bzw. 3 Reihen)
      for (const ry of r.reihenY) expect(r.y.some((y) => Math.abs(y - ry) < 1)).toBe(true);
    }
  });

  it("der Zielpferch liegt frei: rechts von der Kraft-Insel und links vom FINISH-Bogen", () => {
    expect(probe.pferch.x0).toBeGreaterThan(probe.inseln.kraft.x1);
    expect(probe.pferch.x1).toBeLessThan(probe.ringR - 40);
  });

  it("vier / drei / vier Bahnen je Insel (Platz fuer 'belegt' und 'wartet' der spaeteren Stau-Mechanik)", () => {
    expect([probe.inseln.technik.bahnen, probe.inseln.kletter.bahnen, probe.inseln.kraft.bahnen]).toEqual([4, 3, 4]);
  });

  it("feste Totale: Zoom 1, Kamera auf der Leinwandmitte, Regie aus", () => {
    expect(probe.zoom).toBe(1);
    expect(probe.camR.x).toBe(probe.w / 2);
    expect(probe.camR.y).toBe(probe.h / 2);
    expect(probe.regie).toBe(false);
  });
});
