// ===================================================================================
// BATTLEFIELD-FUENF-PUNKTE: Aufnahmen aus der ECHTEN APP (Battle-Arena im Foundation-Host, nicht die Mockup-Seite) bei
// 1920x1080 und 2560x1440 nach docs/design/battlefield-5punkte-22-11/ (app-pod-<breite>x<hoehe>[-ganz].png).
//
// VORAUSSETZUNG: Dev-Server gegen eine KOPIE des live-save-Abbilds (CLAUDE.md):
//   OLY_APP_SQLITE_PATH=<kopie.sqlite> OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 PORT=3245 npm run dev
// AUFRUF (unter flock, ein Browser zugleich):
//   flock /tmp/oly-aufnahme.lock env SCREENSHOT_PORT=3245 npx tsx scripts/screenshot-battlefield-app.ts [--schritte=n]
// Der Entwurfsreiter der Arena zeigt die Vierergruppe des naechsten Battlefield-Spieltags (VORSCHAU, gezeigt = gebucht);
// die Aufnahme spult die Wiedergabe mit `sondenLauf` an eine Stelle mit Respawns und nimmt den Arena-Bereich auf.
// ===================================================================================
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3245";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "battlefield-5punkte-22-11");
const SAVE = process.env.BF_SAVE ?? "new-game-1795114260527-nzr0z9";
const TEAM = process.env.BF_TEAM ?? "D-P";
// Ein Schritt = sondenLauf(6000) = rund 100 s Kampfzeit der Wiedergabe (der Kampf dauert 8:00).
const SCHRITTE = Number(process.argv.find((a) => a.startsWith("--schritte="))?.split("=")[1] ?? 2);
const GROESSEN = [
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
];

type Arena = {
  setDisc: (d: string) => void;
  sondenLauf: (ms: number) => void;
  battlefieldPodStand?: () => { done: boolean } | null;
};

async function briefingSchliessen(page: Page) {
  const hintergrund = page.getByTestId("season-briefing-backdrop");
  await hintergrund.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  if (!(await hintergrund.isVisible().catch(() => false))) return;
  const erledigt = page.getByRole("button", { name: /^Erledigt$/ });
  const spaeter = page.getByRole("button", { name: /^Später$/ });
  if (await erledigt.isVisible().catch(() => false)) await erledigt.click();
  else if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
  await hintergrund.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const { w, h } of GROESSEN) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const fehler: string[] = [];
      page.on("pageerror", (e) => fehler.push(String(e)));
      const url = `${BASE_URL}/foundation?view=battleArena&saveId=${encodeURIComponent(SAVE)}&team=${encodeURIComponent(TEAM)}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240_000 });
      await briefingSchliessen(page);
      await page.waitForFunction(() => Boolean((window as unknown as { __arena?: unknown }).__arena), null, { timeout: 240_000 });
      // Reiter "Arena" (Aufstellung | Arena | Spielerprofil) und Disziplin Battlefield (die Aufstellung zeigt sie als Spieltags-Disziplin).
      // Der Seitenleisten-Eintrag "Arena" steht im DOM vor dem Reiter, der Reiter ist deshalb der letzte Treffer.
      await page.locator("button, [role=tab]", { hasText: /^Arena$/i }).last().click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join("/tmp/claude-0/mess", `debug-${w}.png`) });
      await page.evaluate(() => (window as unknown as { __arena: Arena }).__arena.setDisc("battlefield"));
      await page.waitForTimeout(2500);
      const stand = await page.evaluate(() => {
        const A = (window as unknown as { __arena: Arena }).__arena;
        return { pod: A.battlefieldPodStand ? A.battlefieldPodStand() : "keine Sonde" };
      });
      console.log(`${w}x${h} Pod-Stand:`, JSON.stringify(stand));
      // Kampf starten (Knopf der Arena), danach die Vorstellung abwarten.
      await page.getByRole("button", { name: /Kampf starten/i }).first().click().catch(() => undefined);
      await page.waitForTimeout(6000);
      // Wiedergabe vorspulen (Sekunden Kampfzeit), damit Respawns und HP-Stufen sichtbar sind.
      for (let s = 0; s < SCHRITTE; s += 1) {
        await page.evaluate(() => (window as unknown as { __arena: Arena }).__arena.sondenLauf(6000));
      }
      await page.waitForTimeout(600);
      const arena = page.locator(".oly-battle-arena").first();
      await arena.screenshot({ path: path.join(OUT, `app-pod-${w}x${h}.png`) });
      await page.screenshot({ path: path.join(OUT, `app-pod-${w}x${h}-ganz.png`) });
      const masse = await page.evaluate(() => {
        const a = document.querySelector(".oly-battle-arena") as HTMLElement | null;
        const r = a?.getBoundingClientRect();
        return {
          arena: r ? { b: Math.round(r.width), h: Math.round(r.height) } : null,
          seitenScroll: document.documentElement.scrollHeight > window.innerHeight + 2,
        };
      });
      console.log(`${w}x${h}`, JSON.stringify(masse), "Seitenfehler:", fehler.length ? fehler.join(" | ") : "keine");
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

void main();
