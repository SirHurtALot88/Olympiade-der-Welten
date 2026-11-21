// ===================================================================================
// KI-MERKLISTE, AUFNAHMEN (21.11.): Postfach mit der Meldung „Interesse an einem Spieler" bei 1920x1080 und 2560x1440 nach
// docs/design/ki-merkliste-21-11/ (app-<zustand>-<breite>x<hoehe>.png).
//
// VORAUSSETZUNG: `scripts/ki-merkliste-aufbau.ts` lief auf der KOPIE, und der Dev-Server laeuft gegen dieselbe Kopie:
//   OLY_APP_SQLITE_PATH=<kopie.sqlite> OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 PORT=3245 npm run dev
// AUFRUF (unter flock, ein Browser zugleich):
//   flock /tmp/oly-aufnahme.lock env SCREENSHOT_PORT=3245 npx tsx scripts/screenshot-ki-merkliste-21-11.ts
// ===================================================================================
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3245";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "ki-merkliste-21-11");
const SAVE = process.env.IB_SAVE ?? "new-game-1795114260527-nzr0z9";
const TEAM = process.env.IB_TEAM ?? "D-P";
const GROESSEN = [
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
];

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

async function oeffnePostfach(page: Page) {
  const url = `${BASE_URL}/foundation?view=inboxV2&saveId=${encodeURIComponent(SAVE)}&team=${encodeURIComponent(TEAM)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await briefingSchliessen(page);
  await page.getByTestId("postfach").waitFor({ state: "visible", timeout: 240_000 });
  await page.waitForTimeout(1500);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const g of GROESSEN) {
    const ctx = await browser.newContext({ viewport: { width: g.w, height: g.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
    await oeffnePostfach(page);
    const dok = await page.evaluate(() => ({
      scrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      meldungen: document.querySelectorAll('[data-testid="postfach-meldung"]').length,
    }));
    console.log(`[posteingang] ${g.w}x${g.h}`, JSON.stringify(dok));
    await page.screenshot({ path: path.join(OUT, `app-01-posteingang-${g.w}x${g.h}.png`) });

    const zeile = page.getByTestId("postfach-meldung").filter({ hasText: /Interesse an/ }).first();
    await zeile.waitFor({ state: "visible", timeout: 20_000 });
    await zeile.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `app-02-interesse-${g.w}x${g.h}.png`) });
    await ctx.close();
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
