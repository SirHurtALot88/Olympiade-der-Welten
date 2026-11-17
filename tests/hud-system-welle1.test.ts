/**
 * HUD-SYSTEM, WELLE 1: HOCKEY und FOOTBALL (17.11., docs/design/hud-system-17-11.md).
 *
 * Wie `hud-system-basketball.test.ts` im echten Motor (Chromium). Geprueft wird je Disziplin:
 *   1. KOMPONENTEN: Kopfleiste, Dock mit zwoelf Spielerleisten und Spielverlauf, Bedienleiste; das alte
 *      HUD (.scoreline, .hpbars, .kaderleiste, #bbug) ist ausgeblendet.
 *   2. GEZEIGT = GEBUCHT: Stand = fsPunkte (= #score), Leisten = Zeilen der Wertung (Hockey: Tore/Ass/Sch,
 *      Torwart: Par/Fg%; Football: Yds = Pass+Lauf+Fang, Pkt, Tkl), Teamfeld (SOG, YDS) aus denselben
 *      Zaehlern, Verlauf endet mit dem gebuchten Stand.
 *   3. Hockey: Zusatzfeld (Power-Play-Uhr) und Strafbank-Marken haben das gebuchte Format.
 *      Football: Zusatzfeld ist "Kickoff" oder Down & Distance mit Feldposition.
 *   4. KLICKS/TASTEN: Karte, Filter. SCHALTER: hudSystem(false) stellt das alte HUD her.
 *   5. PHONE (390 px): kein waagerechtes Ueberlaufen, Kopf und Dock sichtbar.
 *   6. Keine Seitenfehler.
 *
 * In der CI laeuft die Datei im Job `arena-chromium-tests` (OLY_ARENA_CHROMIUM_PFLICHT=1) und ist aus
 * dem Shard-Lauf von `full-test-suite` ausgeschlossen.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(
  join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.html"),
).href;
const LAUF_TIMEOUT_MS = 240_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

type Roh = {
  passYards: number;
  laufYards: number;
  fangYards: number;
  punkte: number;
  assists: number;
  feldwuerfe: number;
  saves: number;
  gegentore: number;
  strafminuten: number;
};
type SpielerGebucht = { id: number; n: string; seite: number; kernId: string; kern: string; leiste: string[]; roh: Roh };
type SpielerGezeigt = { id: number; kern: string | null; leiste: (string | null)[] };
type Probe = {
  aktiv: boolean;
  disc: string;
  profile: Record<string, string>;
  gebucht: { stand: [number, number]; score: string; spieler: SpielerGebucht[]; zuege: number };
  gezeigt: {
    stand: [string | null, string | null];
    uhr: string | null;
    zusatz: string | null;
    stat: (string | null)[];
    bank: (string | null)[];
    spieler: SpielerGezeigt[];
    verlauf: { i: number; art: string; kat: string; seite: number; stand: string; text: string; label: string }[];
    filter: string;
    karte: number | null;
  };
};

declare global {
  interface Window {
    __arena: Record<string, (...args: unknown[]) => unknown>;
  }
}

const CHROMIUM_PFLICHT = process.env.OLY_ARENA_CHROMIUM_PFLICHT === "1";

describe("HUD-System Welle 1: Chromium-Pflicht", () => {
  it("in der CI (OLY_ARENA_CHROMIUM_PFLICHT=1) ist Chromium da, sonst waere der Test stumm", () => {
    if (CHROMIUM_PFLICHT) expect(chromiumVerfuegbar()).toBe(true);
  });
});

async function neueDisziplin(seite: Page, disc: string) {
  await seite.evaluate((d) => {
    const a = window.__arena;
    a.setDisc(d);
    if (a.anpfiffCountdown) a.anpfiffCountdown(false);
  }, disc);
}

async function probe(seite: Page): Promise<Probe> {
  return seite.evaluate(() => window.__arena.hudProbe() as Probe);
}

async function sichtbar(seite: Page, sel: string): Promise<boolean> {
  return seite.evaluate((s) => {
    const e = document.querySelector(s) as HTMLElement | null;
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return getComputedStyle(e).display !== "none" && !e.hidden && r.width > 0 && r.height > 0;
  }, sel);
}

const zahl = (t: string | null) => Number((t || "").replace(/\D+/g, "") || "0");

function pruefeGezeigtGleichGebucht(disc: "hockey" | "football", p: Probe) {
  expect(p.aktiv).toBe(true);
  expect(p.disc).toBe(disc);
  const [a, b] = p.gebucht.score.split(":").map((x) => Number(x.trim()));
  expect(p.gebucht.stand).toEqual([a, b]);
  expect(p.gezeigt.stand).toEqual([String(a), String(b)]);
  expect(p.gezeigt.spieler.length).toBe(12);
  for (const g of p.gebucht.spieler) {
    const z = p.gezeigt.spieler.find((x) => x.id === g.id);
    expect(z, g.n).toBeDefined();
    expect(z!.kern, g.n).toBe(g.kern);
    expect(z!.leiste, g.n).toEqual(g.leiste);
  }
  if (disc === "hockey") {
    // Tore der Skater summieren sich zum Stand; Torwart-Leisten tragen Paraden statt Tore.
    for (const s of [0, 1]) {
      const summe = p.gebucht.spieler
        .filter((x) => x.seite === s && x.kernId === "tore")
        .reduce((acc, x) => acc + Number(x.kern), 0);
      expect(summe, "Seite " + s).toBe(p.gebucht.stand[s]);
    }
    const tw = p.gebucht.spieler.filter((x) => x.kernId === "par");
    expect(tw.length).toBe(2);
    for (const t of tw) expect(t.kern).toBe(String(t.roh.saves));
    // Schuesse aufs Tor (Teamfeld) sind mindestens so viele wie Tore der Seite.
    for (const s of [0, 1]) expect(zahl(p.gezeigt.stat[s])).toBeGreaterThanOrEqual(p.gebucht.stand[s]);
    expect(p.gezeigt.zusatz === "" || /^PP [A-Z-]+ \d+:\d\d( · 5v3)?$/.test(p.gezeigt.zusatz || "")).toBe(true);
    for (const t of p.gezeigt.bank) if (t) expect(t).toMatch(/^BANK \d+:\d\d$/);
    const tore = p.gezeigt.verlauf.filter((r) => r.art === "treffer");
    if (tore.length) expect(tore[tore.length - 1].stand).toBe(`${a}:${b}`);
  } else {
    // Yds = Pass- + Lauf- + Fangyards (Wertungsspalten), Teamfeld YDS = Pass- + Laufyards der Seite.
    for (const g of p.gebucht.spieler) {
      const y = g.roh.passYards + g.roh.laufYards + g.roh.fangYards;
      expect(g.kern, g.n).toBe(y ? String(y) : "0");
    }
    for (const s of [0, 1]) {
      const y = p.gebucht.spieler.filter((x) => x.seite === s).reduce((acc, x) => acc + x.roh.passYards + x.roh.laufYards, 0);
      expect(p.gezeigt.stat[s], "Seite " + s).toBe("YDS " + y);
    }
    expect(p.gezeigt.zusatz === "" || p.gezeigt.zusatz === "Kickoff" || /^(1st|2nd|3rd|4th) & \d+ · (OPP|OWN) \d+$/.test(p.gezeigt.zusatz || "")).toBe(true);
    // Der letzte Punkte-Eintrag traegt den gebuchten Stand (fsPunkte, inklusive Extra-Punkte).
    const punkte = p.gezeigt.verlauf.filter((r) => r.art === "treffer");
    if (punkte.length) expect(punkte[punkte.length - 1].stand).toBe(`${a}:${b}`);
  }
}

describe.skipIf(!chromiumVerfuegbar())("HUD-System Welle 1 (Arena-Motor, Chromium)", () => {
  let browser: Browser;
  let seite: Page;
  const fehler: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => {
      if (m.type() === "warning" && m.text().startsWith("HUD-System")) fehler.push(m.text());
    });
    await seite.goto(SEITEN_PFAD, { waitUntil: "domcontentloaded", timeout: LAUF_TIMEOUT_MS });
    await seite.waitForFunction(() => window.__arena && window.__arena.hudProbe, null, { timeout: 90_000 });
    await seite.click("#t2");
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Profile: Basketball, Hockey und Football fertig, die anderen 17 Disziplinen als Skelett", async () => {
    const p = await seite.evaluate(() => (window.__arena.hudProbe() as Probe).profile);
    for (const d of ["basketball", "hockey", "football"]) expect(p[d], d).toBe("fertig");
    const skelett = Object.entries(p).filter(([, v]) => v === "skelett").map(([k]) => k);
    expect(skelett.length).toBe(17);
  });

  for (const disc of ["hockey", "football"] as const) {
    describe(disc, () => {
      it("Komponenten vorhanden, altes HUD ersetzt, Zusatzfeld als Textzeile", async () => {
        await neueDisziplin(seite, disc);
        await seite.waitForFunction(
          (d) =>
            (window.__arena.hudProbe() as Probe).disc === d &&
            document.querySelectorAll("#hudDock .hud-leiste").length === 12 &&
            !(document.getElementById("hudDock") as HTMLElement).hidden &&
            !(document.getElementById("hudBedien") as HTMLElement).hidden,
          disc,
          { timeout: 20_000 },
        );
        for (const neu of ["#hudKopf", "#hudDock", "#hudBedien", "#hudKopf .hud-mom", "#hudDock .hud-verlauf"]) {
          expect(await sichtbar(seite, neu), neu).toBe(true);
        }
        for (const alt of [".scoreline", ".hpbars", ".kaderleiste", "#bbug", "#bbugcallout"]) {
          expect(await sichtbar(seite, alt), alt).toBe(false);
        }
        expect(await seite.$eval("#hudKopf .hud-zusatz", (e) => e.classList.contains("txt"))).toBe(true);
        const filter = await seite.$$eval("#hudDock [data-hud-filter]", (b) => b.map((x) => (x as HTMLElement).dataset.hudFilter));
        expect(filter).toEqual(disc === "hockey" ? ["alle", "tor", "strafe", "abwehr"] : ["alle", "punkte", "turnover", "sack"]);
      });

      it("laufendes Spiel: gezeigt = gebucht, Karte, Filter", async () => {
        await seite.click("#play");
        await seite.click("#spd");
        await seite.click("#spd");
        await seite.waitForFunction(
          (d) => {
            const a = window.__arena.hudProbe() as Probe;
            return a.disc === d && a.gezeigt.verlauf.length >= 3;
          },
          disc,
          { timeout: 200_000 },
        );
        await seite.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        const vorPause = (await seite.textContent("#play"))?.trim();
        await seite.keyboard.press("Space");
        await seite.waitForTimeout(600);
        expect((await seite.textContent("#play"))?.trim()).not.toBe(vorPause);
        pruefeGezeigtGleichGebucht(disc, await probe(seite));

        // Spielerkarte: Klick auf die erste Leiste, Kernwert = gebuchter Kernwert, Esc schliesst.
        const erste = await seite.$("#hudDock .hud-leiste");
        const id = Number(await erste!.getAttribute("data-hud-spieler"));
        await erste!.click();
        await seite.waitForTimeout(150);
        expect(await sichtbar(seite, "#hudKarte")).toBe(true);
        const g = (await probe(seite)).gebucht.spieler.find((x) => x.id === id)!;
        const karteWerte = await seite.$$eval("#hudKarte .hud-kwerte b", (b) => b.map((x) => (x.textContent || "").trim()));
        expect(karteWerte[0]).toBe(g.kern);
        await seite.keyboard.press("Escape");
        await seite.waitForTimeout(100);
        expect(await sichtbar(seite, "#hudKarte")).toBe(false);

        // Filter: nur Zeilen der gewaehlten Kategorie (oder der Leer-Hinweis).
        const kat = disc === "hockey" ? "abwehr" : "punkte";
        await seite.click(`#hudDock [data-hud-filter=${kat}]`);
        await seite.waitForTimeout(100);
        const kats = await seite.$$eval("#hudDock .hud-vliste li", (l) => l.map((x) => (x as HTMLElement).dataset.kat || "leer"));
        expect(kats.length).toBeGreaterThan(0);
        for (const k of kats) expect([kat, "leer"]).toContain(k);
        await seite.click("#hudDock [data-hud-filter=alle]");
        await seite.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await seite.keyboard.press("Space");
      }, LAUF_TIMEOUT_MS);

      it("Spielende: gezeigt = gebucht", async () => {
        await seite.evaluate(() => window.__arena.schnellDurch());
        await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: LAUF_TIMEOUT_MS });
        await seite.waitForTimeout(500);
        const p = await probe(seite);
        pruefeGezeigtGleichGebucht(disc, p);
        expect(p.gezeigt.verlauf.length).toBeGreaterThan(3);
        if (disc === "hockey") {
          const tw = p.gebucht.spieler.find((x) => x.kernId === "par")!;
          // Torwart-Karte zeigt Paraden vorn.
          await seite.click(`#hudDock [data-hud-spieler="${tw.id}"]`);
          await seite.waitForTimeout(150);
          const kopf = await seite.$$eval("#hudKarte .hud-kwerte small", (b) => b.map((x) => (x.textContent || "").trim()));
          expect(kopf[0]).toBe("Par");
          await seite.keyboard.press("Escape");
        }
      }, LAUF_TIMEOUT_MS);

      it("Schalter: hudSystem(false) stellt das alte HUD her, true wieder das neue", async () => {
        await seite.evaluate(() => window.__arena.hudSystem(false));
        await seite.waitForTimeout(100);
        expect(await sichtbar(seite, ".scoreline")).toBe(true);
        expect(await sichtbar(seite, "#hudKopf")).toBe(false);
        await seite.evaluate(() => window.__arena.hudSystem(true));
        await seite.waitForTimeout(100);
        expect(await sichtbar(seite, "#hudKopf")).toBe(true);
        expect(await sichtbar(seite, ".scoreline")).toBe(false);
      });

      it("Phone 390 px: kein waagerechtes Ueberlaufen, Kopf und Dock sichtbar, Karte als Blatt", async () => {
        const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
        phone.on("pageerror", (e) => fehler.push(String(e)));
        await phone.goto(SEITEN_PFAD, { waitUntil: "domcontentloaded", timeout: LAUF_TIMEOUT_MS });
        await phone.waitForFunction(() => window.__arena && window.__arena.hudProbe, null, { timeout: 90_000 });
        await phone.click("#t2");
        await neueDisziplin(phone, disc);
        await phone.waitForFunction(() => document.querySelectorAll("#hudDock .hud-leiste").length === 12, null, { timeout: 20_000 });
        expect(await sichtbar(phone, "#hudKopf")).toBe(true);
        expect(await sichtbar(phone, "#hudDock")).toBe(true);
        expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
        expect(await phone.$eval("#hudKopf", (e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
        await phone.click("#hudDock .hud-leiste");
        await phone.waitForTimeout(350);
        const blatt = await phone.$eval("#hudKarte", (e) => ({ pos: getComputedStyle(e).position, unten: e.getBoundingClientRect().bottom }));
        expect(blatt.pos).toBe("fixed");
        expect(Math.round(blatt.unten)).toBe(844);
        await phone.close();
      }, LAUF_TIMEOUT_MS);
    });
  }

  it("keine Seitenfehler", () => {
    expect(fehler).toEqual([]);
  });
});
