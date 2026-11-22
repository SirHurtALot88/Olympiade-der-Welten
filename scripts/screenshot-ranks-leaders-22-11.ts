// ===================================================================================
// LIVE-CHROMIUM-ABGLEICH Ranks / Leaders (22.11.): echte App gegen Mockup, Live-Abbild-Kopie, Team D-P.
// AUFRUF (unter flock): flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-ranks-leaders-22-11.ts <ranks|leaders> [BxH,...] [zustand,...]
// Voraussetzung: OLY_APP_SQLITE_PATH zeigt auf eine KOPIE des Live-Abbilds (git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz).
// Der Dev-Server startet mit OLY_AUTO_EXPORT_SAVES=0 / OLY_AUTO_EXPORT_PUSH=0.
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

const SEITE = process.argv[2] === "leaders" ? "leaders" : "ranks";
const PORT = process.env.SCREENSHOT_PORT ?? "3200";
const BASE_URL = `http://localhost:${PORT}`;
const SQLITE_PATH = process.env.OLY_APP_SQLITE_PATH;
const SAVE_ID = process.env.SCREENSHOT_SAVE_ID ?? "new-game-1795114260527-nzr0z9";
const TEAM_ID = process.env.SCREENSHOT_TEAM ?? "D-P";
const OUT = path.join(process.cwd(), "docs", "design", `${SEITE}-modern-22-11`);
const GROESSEN: Array<[number, number]> = (process.argv[3] ?? "1920x1080,2560x1440,1710x1112").split(",").map((g) => g.split("x").map(Number) as [number, number]);
const ZUSTAENDE = (process.argv[4] ?? (SEITE === "ranks" ? "teams,teams-punkte,spieler" : "spieler,teams,medaillen,spieltag")).split(",");
const VIEW = SEITE === "ranks" ? "ranks" : "leagueLeaders";
const TESTID = SEITE === "ranks" ? "ranks-modern" : "leaders-modern";

if (!SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH fehlt (Kopie des Live-Abbilds).");

async function erreichbar() {
  try {
    const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return r.status < 500;
  } catch {
    return false;
  }
}
function startDevServer(): ChildProcess {
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", (c) => process.stdout.write(`[dev] ${c}`));
  child.stderr?.on("data", (c) => process.stderr.write(`[dev] ${c}`));
  return child;
}
async function briefingSchliessen(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  if (!(await backdrop.isVisible().catch(() => false))) return;
  for (const name of [/^Erledigt$/, /^Später$/]) {
    const b = page.getByRole("button", { name });
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      break;
    }
  }
  await backdrop.waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
}

/** Zustand -> Klicks in der App. */
async function inApp(page: Page, zustand: string) {
  if (SEITE === "ranks") {
    if (zustand === "teams-punkte") {
      await page.getByRole("button", { name: "Punkte", exact: true }).first().click();
      await page.waitForTimeout(500);
    }
    if (zustand === "spieler") {
      await page.getByRole("tab", { name: /Spieler/ }).click();
      await page.waitForTimeout(700);
      await page.locator(".rk-dzw button").nth(16).click();
      await page.waitForTimeout(500);
    }
  } else {
    if (zustand === "teams") await page.getByRole("tab", { name: /Teams/ }).click();
    if (zustand === "medaillen") await page.getByRole("tab", { name: /Medaillen/ }).click();
    if (zustand === "spieltag") await page.getByTestId("leaders-zeit-spieltag").click().catch(() => undefined);
    await page.waitForTimeout(700);
  }
}
const mockupUrl = (zustand: string) =>
  SEITE === "ranks"
    ? `/mockups/ranks-modern-22-11.html?still=1${zustand === "teams-punkte" ? "&mass=punkte" : zustand === "spieler" ? "&sicht=spieler&d=basketball" : ""}`
    : `/mockups/leaders-modern-22-11.html?still=1${zustand === "teams" ? "&sicht=teams" : zustand === "medaillen" ? "&sicht=medaillen" : zustand === "spieltag" ? "&zeit=11" : ""}`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const server = (await erreichbar()) ? null : startDevServer();
  let browser: Browser | null = null;
  try {
    const frist = Date.now() + 720_000;
    while (Date.now() < frist && !(await erreichbar())) await delay(2000);
    browser = await chromium.launch();
    for (const [b, h] of GROESSEN) {
      for (const z of ZUSTAENDE) {
        const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const url = new URL("/foundation", BASE_URL);
        url.searchParams.set("view", VIEW);
        url.searchParams.set("saveId", SAVE_ID);
        url.searchParams.set("team", TEAM_ID);
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
        const f2 = Date.now() + 300_000;
        while (Date.now() < f2 && (await page.getByTestId(TESTID).count()) === 0) {
          await briefingSchliessen(page);
          await page.waitForTimeout(1000);
        }
        await page.getByTestId(TESTID).waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(2500);
        await inApp(page, z);
        const mess = await page.evaluate((id) => {
          const w = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
          return { seiteScrollt: document.documentElement.scrollHeight - window.innerHeight, wurzelH: w?.getBoundingClientRect().height, breiteScrollt: document.documentElement.scrollWidth - window.innerWidth };
        }, TESTID);
        console.log(`[shot] ${SEITE} ${z} ${b}x${h}`, JSON.stringify(mess));
        await page.screenshot({ path: path.join(OUT, `app-${z}-${b}x${h}.png`) });
        const mk = await ctx.newPage();
        await mk.goto(`${BASE_URL}${mockupUrl(z)}`, { waitUntil: "load", timeout: 60_000 });
        await mk.waitForTimeout(800);
        await mk.screenshot({ path: path.join(process.env.SCREENSHOT_MOCKUP_DIR ?? "/tmp/claude-0", `mockup-${SEITE}-${z}-${b}x${h}.png`) });
        await ctx.close();
      }
    }
  } finally {
    await browser?.close();
    if (server) {
      try {
        process.kill(-server.pid!, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
