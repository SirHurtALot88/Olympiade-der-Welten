// ===================================================================================
// POSTFACH-BAU 21.11.: Aufnahmen der echten App neben dem Mockup (public/mockups/inbox-modern-21-11.html), je Zustand bei
// 1920x1080 und 2560x1440 nach docs/design/inbox-bau-21-11/ (app-<zustand>-<breite>x<hoehe>.png).
//
// VORAUSSETZUNG: Dev-Server läuft gegen eine KOPIE des live-save-Abbilds (CLAUDE.md):
//   OLY_APP_SQLITE_PATH=<kopie.sqlite> OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 PORT=3245 npm run dev
// AUFRUF (unter flock, ein Browser zugleich):
//   flock /tmp/oly-aufnahme.lock env SCREENSHOT_PORT=3245 npx tsx scripts/screenshot-inbox-bau-21-11.ts [zustand ...]
// Der Aufnahme-Aufbau (Wunsch, Verletzung, Vorstand) schreibt NUR in die Kopie (OLY_APP_SQLITE_PATH), nie auf den Server.
// ===================================================================================
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3245";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "inbox-bau-21-11");
const SAVE = process.env.IB_SAVE ?? "new-game-1795114260527-nzr0z9";
const TEAM = process.env.IB_TEAM ?? "D-P";
const GROESSEN = [
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
];
const gewuenscht = process.argv.slice(2);

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

async function oeffnePostfach(page: Page, team: string) {
  const url = `${BASE_URL}/foundation?view=inboxV2&saveId=${encodeURIComponent(SAVE)}&team=${encodeURIComponent(team)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await briefingSchliessen(page);
  await page.getByTestId("postfach").waitFor({ state: "visible", timeout: 240_000 });
  await page.waitForTimeout(1500);
}

type Zustand = { name: string; vorbereiten: (page: Page) => Promise<void>; danach?: (page: Page) => Promise<void>; team?: string };

async function waehleMeldung(page: Page, muster: RegExp) {
  const zeile = page.getByTestId("postfach-meldung").filter({ hasText: muster }).first();
  await zeile.waitFor({ state: "visible", timeout: 20_000 });
  await zeile.click();
  await page.waitForTimeout(500);
}

const ZUSTAENDE: Zustand[] = [
  { name: "01-posteingang", vorbereiten: async () => undefined },
  { name: "02-trainingswunsch", vorbereiten: (page) => waehleMeldung(page, /Trainingswunsch/) },
  { name: "03-info-moral-gekippt", vorbereiten: (page) => waehleMeldung(page, /Moral gekippt/) },
  { name: "04-spieltag-bericht", vorbereiten: (page) => waehleMeldung(page, /Spieltag \d+/) },
  { name: "05-wieder-einsetzbar", vorbereiten: (page) => waehleMeldung(page, /Wieder einsetzbar/) },
  {
    name: "06-alles-erledigt",
    vorbereiten: async (page) => {
      // Handeln-Bahn leer: ein Absender ohne Aufgaben (Markt & Scouting) im Filter
      await page.getByTestId("postfach-absender-markt").click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "07-erledigt-ordner",
    vorbereiten: async (page) => {
      // Wunsch ablehnen: er wandert nach „Erledigt“; danach wieder zurück, damit die zweite Größe dieselbe Lage vorfindet.
      await waehleMeldung(page, /Trainingswunsch/);
      await page.getByTestId("postfach-option-wunsch-ablehnen").click();
      await page.waitForTimeout(1200);
      await page.getByTestId("postfach-ordner-erledigt").click();
      await page.waitForTimeout(500);
      await waehleMeldung(page, /Trainingswunsch/);
    },
    danach: async (page) => {
      await page.getByTestId("postfach-brief-wieder-oeffnen").click();
      await page.waitForTimeout(1200);
    },
  },
];

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const g of GROESSEN) {
    const ctx = await browser.newContext({ viewport: { width: g.w, height: g.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
    page.on("console", (m) => {
      if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 300));
    });
    for (const z of ZUSTAENDE) {
      if (gewuenscht.length > 0 && !gewuenscht.some((x) => z.name.includes(x))) continue;
      await oeffnePostfach(page, z.team ?? TEAM);
      try {
        await z.vorbereiten(page);
      } catch (error) {
        console.log(`[${z.name}] Vorbereitung gescheitert:`, String(error).slice(0, 200));
      }
      const dok = await page.evaluate(() => ({
        scrollH: document.documentElement.scrollHeight,
        innerH: window.innerHeight,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        meldungen: document.querySelectorAll('[data-testid="postfach-meldung"]').length,
      }));
      console.log(`[${z.name}] ${g.w}x${g.h}`, JSON.stringify(dok));
      await page.screenshot({ path: path.join(OUT, `app-${z.name}-${g.w}x${g.h}.png`) });
      await z.danach?.(page);
    }
    await ctx.close();
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
