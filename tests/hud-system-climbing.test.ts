/**
 * HUD-SYSTEM CLIMBING IM FORMAT CANYON (Canyon live, 18.11., docs/design/climbing-canyon-live-18-11.md).
 *
 * Prueft das HUD-Profil `climbing` und die Kamera-Modi im echten Motor (Chromium, wie hud-system-basketball):
 *   1. KOMPONENTEN: Kopfleiste mit Phase, Dock mit drei Seilschaft-Kaesten je Team und zwoelf Leisten, Verlauf.
 *   2. GEZEIGT = GEBUCHT: an mehreren Stellen der Wiedergabe zeigt die Kopfleiste bahnTeamstand() und die Uhr
 *      von #clock, jede Leiste Rang (bahnRangliste), Anteil bzw. Glockenzeit, Ort, Weg und Puste des gebuchten
 *      Kletterer-Zustands.
 *   3. KAMERA: Totale zielt auf die ganze Wand, ein Klick auf eine Leiste oeffnet die Karte und die Kamera folgt
 *      diesem Kletterer, Esc schliesst und kehrt in die Regie zurueck, K schaltet weiter.
 *   4. FORMAT: im alten Format "standard" (Abschalt-Schalter) bleibt das alte HUD; hudSystem(false) ebenso.
 *   5. Keine Seitenfehler.
 *
 * In der CI laeuft die Datei im Job `arena-chromium-tests` (OLY_ARENA_CHROMIUM_PFLICHT=1) und ist aus dem
 * Shard-Lauf von `full-test-suite` ausgeschlossen.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const LAUF_TIMEOUT_MS = 180_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  try {
    return readdirSync(join(homedir(), ".cache", "ms-playwright")).some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

type Spieler = { id: number; rang: string | null; kern: string | null; ort: string | null; weg: string | null; puste: string | null };
type Probe = {
  aktiv: boolean;
  kamera: { modus: string; id: number | null };
  kamZiel: { x: number; y: number; z: number } | null;
  totaleZ: number;
  gebucht: { stand: string[]; score: string; clock: string; spieler: Spieler[]; ereignisse: number };
  gezeigt: { stand: (string | null)[]; uhr: string | null; phase: string | null; oben: (string | null)[]; spieler: Spieler[]; seilschaften: number; verlauf: number; karte: number | null };
};

declare global {
  interface Window {
    __arena: Record<string, (...args: unknown[]) => unknown>;
    __olyArenaKader: { seedByDisciplineId: Record<string, number> };
  }
}

const CHROMIUM_PFLICHT = process.env.OLY_ARENA_CHROMIUM_PFLICHT === "1";
const v0 = JSON.parse(readFileSync(join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten[0];

describe("HUD-System Climbing: Chromium-Pflicht", () => {
  it("in der CI (OLY_ARENA_CHROMIUM_PFLICHT=1) ist Chromium da, sonst waere der Test stumm", () => {
    if (CHROMIUM_PFLICHT) expect(chromiumVerfuegbar()).toBe(true);
  });
});

describe.skipIf(!chromiumVerfuegbar())("HUD-System Climbing (Canyon)", () => {
  let browser: Browser;
  let seite: Page;
  const fehler: string[] = [];

  const probe = async () =>
    (await seite.evaluate(() => {
      window.__arena.hudSystem(true);
      return window.__arena.canyonHudProbe();
    })) as Probe;
  const spule = (ticks: number) => seite.evaluate((t) => window.__arena.sondenLauf(t), ticks);

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.addInitScript(() => {
      window.__olyArenaKader = { seedByDisciplineId: {} };
    });
    await seite.goto(SEITEN_PFAD, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && typeof window.__arena.canyonHudProbe === "function", null, { timeout: LAUF_TIMEOUT_MS });
    await seite.evaluate(({ heim, gast }) => {
      const A = window.__arena;
      A.endstandNachlauf(false);
      A.anpfiffCountdown(false);
      A.kaderSetzen({ heim, gast });
      A.bahnPodAnzeigen("climbing", null);
      window.__olyArenaKader.seedByDisciplineId.climbing = 1337;
    }, { heim: v0.heim.slice(0, 6), gast: v0.gast.slice(0, 6) });
    await seite.click("#t2");
    await seite.evaluate(() => window.__arena.setDisc("climbing"));
    await seite.click("#play");
    await seite.waitForTimeout(200);
    await seite.click("#play");
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Kopfleiste, Dock mit Seilschaft-Kaesten und Verlauf stehen; das alte HUD ist aus", async () => {
    await spule(300);
    const p = await probe();
    expect(p.aktiv).toBe(true);
    expect(p.gezeigt.seilschaften).toBe(6);
    expect(p.gezeigt.spieler).toHaveLength(12);
    expect(p.gezeigt.phase).toBeTruthy();
    expect(p.gezeigt.oben[0]).toMatch(/^OBEN \d\/3$/);
    const altesHud = await seite.evaluate(() => getComputedStyle(document.querySelector(".scoreline") as Element).display);
    expect(altesHud).toBe("none");
  });

  it("gezeigt = gebucht: Stand, Uhr und jede Leiste an mehreren Stellen bis zum Ende", async () => {
    for (let schritt = 0; schritt < 30; schritt += 1) {
      const p = await probe();
      expect(p.gezeigt.stand, `Stand @${schritt}`).toEqual(p.gebucht.stand);
      expect(p.gezeigt.uhr, `Uhr @${schritt}`).toBe(p.gebucht.clock);
      for (const g of p.gebucht.spieler) {
        const z = p.gezeigt.spieler.find((s) => s.id === g.id)!;
        expect({ rang: z.rang, kern: z.kern, ort: z.ort, weg: z.weg, puste: z.puste }, `${g.id} @${schritt}`).toEqual({
          rang: g.rang, kern: g.kern, ort: g.ort, weg: g.weg, puste: g.puste,
        });
      }
      if (await seite.evaluate(() => window.__arena.vorbei())) break;
      await spule(240);
    }
    await spule(60 * 60 * 6);
    const ende = await probe();
    expect(ende.gezeigt.phase).toBe("Alle oben");
    expect(ende.gezeigt.oben).toEqual(["OBEN 3/3", "OBEN 3/3"]);
    expect(ende.gezeigt.stand).toEqual(ende.gebucht.stand);
    expect(ende.gezeigt.verlauf).toBe(ende.gebucht.ereignisse);
  }, LAUF_TIMEOUT_MS);

  it("Kamera: Totale, Folgen per Klick auf eine Leiste, Esc zurueck in die Regie, K schaltet weiter", async () => {
    await seite.evaluate(() => window.__arena.canyonKamera("totale"));
    await seite.waitForTimeout(1500);
    let p = await probe();
    expect(p.kamera.modus).toBe("totale");
    expect(p.kamZiel!.z).toBeCloseTo(p.totaleZ, 1);
    const id = p.gebucht.spieler[3]!.id;
    await seite.click(`#hudDock [data-hud-spieler="${id}"]`);
    p = await probe();
    expect(p.kamera).toEqual({ modus: "folgen", id });
    expect(p.gezeigt.karte).toBe(id);
    expect(await seite.isVisible("#hudKarte")).toBe(true);
    await seite.keyboard.press("Escape");
    p = await probe();
    expect(p.kamera.modus).toBe("regie");
    expect(p.gezeigt.karte).toBeNull();
    await seite.keyboard.press("k");
    expect((await probe()).kamera.modus).toBe("totale");
    await seite.keyboard.press("k");
    expect((await probe()).kamera.modus).toBe("folgen");
    await seite.keyboard.press("k");
    expect((await probe()).kamera.modus).toBe("regie");
  }, LAUF_TIMEOUT_MS);

  it("altes Format 'standard' und hudSystem(false) behalten das alte HUD", async () => {
    const aus = await seite.evaluate(() => {
      window.__arena.hudSystem(false);
      const r = (window.__arena.canyonHudProbe() as { aktiv: boolean }).aktiv;
      window.__arena.hudSystem(true);
      return r;
    });
    expect(aus).toBe(false);
    const standard = await seite.evaluate(() => {
      const A = window.__arena;
      A.bahnFlags({ climbingFormat: "standard" });
      A.setDisc("tdm");
      A.setDisc("climbing");
      A.hudSystem(true);
      const r = (A.canyonHudProbe() as { aktiv: boolean }).aktiv;
      A.bahnFlags({ climbingFormat: null });
      return r;
    });
    expect(standard).toBe(false);
  });

  it("keine Seitenfehler", () => {
    expect(fehler).toEqual([]);
  });
});
