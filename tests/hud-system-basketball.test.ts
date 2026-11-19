/**
 * HUD-SYSTEM, BASKETBALL (17.11., docs/design/hud-system-17-11.md).
 *
 * Prueft das Broadcast-HUD im echten Motor (Chromium, wie `live-stand-welle1.test.ts`):
 *   1. KOMPONENTEN: bei Basketball stehen Kopfleiste (#hudKopf), Dock mit zwoelf Spielerleisten und
 *      Spielverlauf (#hudDock) und Bedienleiste (#hudBedien); das alte HUD (.scoreline, .hpbars, #bbug,
 *      .kaderleiste) ist ausgeblendet. Eine Disziplin mit Skelett-Profil (Hockey) behaelt ihr altes HUD.
 *   2. GEZEIGT = GEBUCHT: im laufenden Spiel und am Ende zeigt die Kopfleiste fsPunkte (= #score), jede
 *      Leiste den Kernwert und die Nebenwerte der Wertungszeile, die Foul-Marken die gebuchten Fouls,
 *      und der Spielverlauf endet mit dem gebuchten Stand.
 *   3. KLICKS/TASTEN: Leiste oeffnet die Spielerkarte, Pfeiltaste schaltet weiter, Esc schliesst; der
 *      Filter "Fouls" zeigt nur Fouls; der Tempo-Knopf der Bedienleiste schaltet #spd.
 *   4. SCHALTER: window.__arena.hudSystem(false) stellt das alte HUD wieder her.
 *   5. PHONE (390 px): kein waagerechtes Ueberlaufen der Seite, Kopfleiste und Dock sichtbar.
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

type SpielerGebucht = { id: number; n: string; seite: number; kern: string; leiste: string[]; fouls: number };
type SpielerGezeigt = { id: number; kern: string | null; leiste: (string | null)[]; fouls: number };
type Probe = {
  aktiv: boolean;
  disc: string;
  status: string | null;
  profile: Record<string, string>;
  gebucht: { stand: [number, number]; score: string; spieler: SpielerGebucht[]; zuege: number };
  gezeigt: {
    stand: [string | null, string | null];
    uhr: string | null;
    spieler: SpielerGezeigt[];
    verlauf: { i: number; art: string; kat: string; seite: number; stand: string; text: string }[];
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

describe("HUD-System Basketball: Chromium-Pflicht", () => {
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

function pruefeGezeigtGleichGebucht(p: Probe) {
  expect(p.aktiv).toBe(true);
  const [a, b] = p.gebucht.score.split(":").map((x) => Number(x.trim()));
  expect(p.gebucht.stand).toEqual([a, b]);
  expect(p.gezeigt.stand).toEqual([String(a), String(b)]);
  expect(p.gezeigt.spieler.length).toBe(12);
  for (const g of p.gebucht.spieler) {
    const z = p.gezeigt.spieler.find((x) => x.id === g.id);
    expect(z, g.n).toBeDefined();
    expect(z!.kern, g.n).toBe(g.kern);
    expect(z!.leiste, g.n).toEqual(g.leiste);
    expect(z!.fouls, g.n).toBe(g.fouls);
  }
  // Summe der Kernwerte (Punkte) je Seite = Stand der Seite.
  for (const s of [0, 1]) {
    const summe = p.gebucht.spieler.filter((x) => x.seite === s).reduce((acc, x) => acc + Number(x.kern), 0);
    expect(summe, "Seite " + s).toBe(p.gebucht.stand[s]);
  }
  // Spielverlauf: der letzte Korb traegt den gebuchten Stand.
  const koerbe = p.gezeigt.verlauf.filter((r) => r.art === "treffer");
  if (koerbe.length) expect(koerbe[koerbe.length - 1].stand).toBe(`${a}:${b}`);
  const punkteImVerlauf = [0, 0];
  for (const r of koerbe) {
    const m = r.stand.split(":").map(Number);
    punkteImVerlauf[0] = m[0];
    punkteImVerlauf[1] = m[1];
  }
  if (koerbe.length) expect(punkteImVerlauf).toEqual([a, b]);
}

describe.skipIf(!chromiumVerfuegbar())("HUD-System Basketball (Arena-Motor, Chromium)", () => {
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

  // Climbing (Canyon live, 18.11.) ist fertig, gilt aber nur im Format Canyon (tests/hud-system-climbing.test.ts).
  it("Profile: Basketball, Hockey, Football (Welle 1) und Climbing fertig, die anderen 16 Disziplinen als Skelett", async () => {
    const p = await seite.evaluate(() => (window.__arena.hudProbe() as Probe).profile);
    expect(p.basketball).toBe("fertig");
    expect(p.climbing).toBe("fertig");
    const skelett = Object.entries(p).filter(([, v]) => v === "skelett").map(([k]) => k);
    expect(skelett.length).toBe(16);
    for (const d of ["tdm", "battlefield", "mini-dm", "fechten", "tennis", "speed-schach", "breaking",
      "eiskunstlauf", "showcase", "gewichtheben", "wettessen", "i-spy", "staffel", "time-trial", "spurt", "takeshis-castle"]) {
      expect(skelett, d).toContain(d);
    }
  });

  it("TDM (Skelett) behaelt das alte HUD", async () => {
    await neueDisziplin(seite, "tdm");
    await seite.waitForTimeout(150);
    expect((await probe(seite)).aktiv).toBe(false);
    expect(await sichtbar(seite, ".scoreline")).toBe(true);
    expect(await sichtbar(seite, ".kaderleiste")).toBe(true);
    expect(await sichtbar(seite, "#hudKopf")).toBe(false);
    expect(await sichtbar(seite, "#hudDock")).toBe(false);
  });

  it("Chris' Live-Befund 17.11.: keine Battlefield-KP-Zeile in Basketball, Seitenspalte unter dem Host-Badge", async () => {
    // Battlefield anspielen, damit updateHud() #kpzeile einschaltet ...
    await neueDisziplin(seite, "battlefield");
    await seite.click("#play");
    await seite.waitForFunction(() => getComputedStyle(document.getElementById("kpzeile")!).display !== "none", null, { timeout: 20_000 });
    // ... und dann wechseln: die Zeile darf nicht stehen bleiben.
    await neueDisziplin(seite, "basketball");
    await seite.waitForTimeout(150);
    expect(await seite.$eval("#kpzeile", (e) => getComputedStyle(e).display)).toBe("none");
    // Einbettungs-Modus mit Login-Badge (wie app/globals.css): Ticker/Wertung beginnen unterhalb.
    const abstand = await seite.evaluate(() => {
      document.querySelector(".oly-battle-arena")!.classList.add("im-spiel");
      const b = document.createElement("div");
      b.className = "oly-auth-status-badge";
      document.body.appendChild(b);
      const r = getComputedStyle(document.querySelector("#p2 .frame>.untenraum")!).paddingTop;
      b.remove();
      document.querySelector(".oly-battle-arena")!.classList.remove("im-spiel");
      return r;
    });
    expect(abstand).toBe("78px");
    // Die Planzeile ("Spielaufbau 0 gegen 0" im Host) ist bei fertigem Profil ausgeblendet.
    expect(await sichtbar(seite, ".planzeile")).toBe(false);
  });

  it("Basketball: Komponenten vorhanden, altes HUD ersetzt", async () => {
    await neueDisziplin(seite, "basketball");
    await seite.waitForFunction(() => document.querySelectorAll("#hudDock .hud-leiste").length === 12, null, { timeout: 20_000 });
    expect(await sichtbar(seite, "#hudKopf")).toBe(true);
    expect(await sichtbar(seite, "#hudDock")).toBe(true);
    expect(await sichtbar(seite, "#hudBedien")).toBe(true);
    expect(await sichtbar(seite, "#hudKopf .hud-mom")).toBe(true);
    expect(await sichtbar(seite, "#hudDock .hud-verlauf")).toBe(true);
    for (const alt of [".scoreline", ".hpbars", ".kaderleiste", "#bbug", "#bbugcallout"]) {
      expect(await sichtbar(seite, alt), alt).toBe(false);
    }
    const filter = await seite.$$eval("#hudDock [data-hud-filter]", (b) => b.map((x) => (x as HTMLElement).dataset.hudFilter));
    expect(filter).toEqual(["alle", "korb", "foul", "abwehr"]);
    // Tooltips/Tastenkuerzel an der Bedienleiste.
    const tips = await seite.$$eval("#hudBedien [data-tip]", (b) => b.map((x) => (x as HTMLElement).dataset.tip || ""));
    expect(tips.length).toBeGreaterThanOrEqual(4);
    expect(tips.join(" ")).toMatch(/Leertaste/);
  });

  it("laufendes Spiel: gezeigt = gebucht; Klicks und Tasten", async () => {
    await seite.click("#play");
    await seite.click("#hudBedien [data-hud-aktion=tempo]");
    expect((await seite.textContent("#spd"))?.trim()).not.toBe("Tempo 1×");
    await seite.waitForFunction(() => {
      const s = document.getElementById("score")?.textContent || "";
      const m = s.match(/(\d+)\s*:\s*(\d+)/);
      return !!m && Number(m[1]) + Number(m[2]) >= 12;
    }, null, { timeout: 120_000 });
    // Pause per Leertaste (Fokus weg vom zuletzt geklickten Knopf, sonst loest Space diesen aus),
    // damit Anzeige und Buchung im selben Zustand verglichen werden.
    await seite.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const vorPause = (await seite.textContent("#play"))?.trim();
    await seite.keyboard.press("Space");
    await seite.waitForTimeout(600);
    expect((await seite.textContent("#play"))?.trim()).not.toBe(vorPause);
    pruefeGezeigtGleichGebucht(await probe(seite));

    // Spielerkarte: Klick auf die erste Leiste.
    const erste = await seite.$("#hudDock .hud-leiste");
    const id = Number(await erste!.getAttribute("data-hud-spieler"));
    await erste!.click();
    await seite.waitForTimeout(100);
    expect(await sichtbar(seite, "#hudKarte")).toBe(true);
    expect((await probe(seite)).gezeigt.karte).toBe(id);
    const name = (await seite.textContent("#hudDock .hud-leiste .hud-lname"))?.trim();
    expect((await seite.textContent("#hudKarte .hud-kwer b"))?.trim()).toBe(name);
    // Kernwert auf der Karte = Kernwert der Leiste (= Wertungszeile).
    const p = await probe(seite);
    const g = p.gebucht.spieler.find((x) => x.id === id)!;
    const karteWerte = await seite.$$eval("#hudKarte .hud-kwerte b", (b) => b.map((x) => (x.textContent || "").trim()));
    expect(karteWerte[0]).toBe(g.kern);
    expect(await seite.$eval(`#hudDock [data-hud-spieler="${id}"]`, (e) => e.classList.contains("sel"))).toBe(true);
    // Pfeiltaste schaltet weiter, Esc schliesst.
    await seite.keyboard.press("ArrowRight");
    await seite.waitForTimeout(80);
    expect((await probe(seite)).gezeigt.karte).not.toBe(id);
    await seite.keyboard.press("Escape");
    await seite.waitForTimeout(80);
    expect(await sichtbar(seite, "#hudKarte")).toBe(false);

    // Filter "Fouls": nur Foul-Zeilen (oder der Leer-Hinweis).
    await seite.click("#hudDock [data-hud-filter=foul]");
    await seite.waitForTimeout(80);
    const kats = await seite.$$eval("#hudDock .hud-vliste li", (l) => l.map((x) => (x as HTMLElement).dataset.kat || "leer"));
    expect(kats.length).toBeGreaterThan(0);
    for (const k of kats) expect(["foul", "leer"]).toContain(k);
    expect((await probe(seite)).gezeigt.filter).toBe("foul");
    await seite.click("#hudDock [data-hud-filter=alle]");
    const alle = await seite.$$eval("#hudDock .hud-vliste li", (l) => l.length);
    expect(alle).toBeGreaterThan(0);
    await seite.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await seite.keyboard.press("Space");
  }, LAUF_TIMEOUT_MS);

  it("Spielende: gezeigt = gebucht", async () => {
    await seite.evaluate(() => window.__arena.schnellDurch());
    await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: LAUF_TIMEOUT_MS });
    await seite.waitForTimeout(500);
    const p = await probe(seite);
    pruefeGezeigtGleichGebucht(p);
    expect(p.gezeigt.verlauf.filter((r) => r.art === "treffer").length).toBeGreaterThan(5);
  }, LAUF_TIMEOUT_MS);

  it("Schalter: hudSystem(false) stellt das alte HUD her, true wieder das neue", async () => {
    await seite.evaluate(() => window.__arena.hudSystem(false));
    await seite.waitForTimeout(100);
    expect(await sichtbar(seite, ".scoreline")).toBe(true);
    expect(await sichtbar(seite, ".kaderleiste")).toBe(true);
    expect(await sichtbar(seite, "#hudKopf")).toBe(false);
    await seite.evaluate(() => window.__arena.hudSystem(true));
    await seite.waitForTimeout(100);
    expect(await sichtbar(seite, "#hudKopf")).toBe(true);
    expect(await sichtbar(seite, ".scoreline")).toBe(false);
  });

  it("Phone 390 px: kein waagerechtes Ueberlaufen, Kopfleiste und Dock sichtbar", async () => {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    phone.on("pageerror", (e) => fehler.push(String(e)));
    await phone.goto(SEITEN_PFAD, { waitUntil: "domcontentloaded", timeout: LAUF_TIMEOUT_MS });
    await phone.waitForFunction(() => window.__arena && window.__arena.hudProbe, null, { timeout: 90_000 });
    await phone.click("#t2");
    await neueDisziplin(phone, "basketball");
    await phone.waitForFunction(() => document.querySelectorAll("#hudDock .hud-leiste").length === 12, null, { timeout: 20_000 });
    expect(await sichtbar(phone, "#hudKopf")).toBe(true);
    expect(await sichtbar(phone, "#hudDock")).toBe(true);
    const breite = await phone.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(391);
    // Kopf passt in die Spalte, Leisten liegen in einer wischbaren Reihe statt die Seite zu verbreitern.
    const kopf = await phone.$eval("#hudKopf", (e) => e.getBoundingClientRect().width);
    expect(kopf).toBeLessThanOrEqual(390);
    // Klick auf eine Leiste oeffnet die Karte als Blatt von unten.
    await phone.click("#hudDock .hud-leiste");
    await phone.waitForTimeout(350);
    const blatt = await phone.$eval("#hudKarte", (e) => ({ pos: getComputedStyle(e).position, unten: e.getBoundingClientRect().bottom }));
    expect(blatt.pos).toBe("fixed");
    expect(Math.round(blatt.unten)).toBe(844);
    await phone.close();
  }, LAUF_TIMEOUT_MS);

  it("keine Seitenfehler", () => {
    expect(fehler).toEqual([]);
  });
});
