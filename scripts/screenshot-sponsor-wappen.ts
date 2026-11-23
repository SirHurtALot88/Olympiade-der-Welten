// ===================================================================================
// AUFNAHMEN: Sponsor-Wappen (22.11., docs/design/sponsor-wappen-22-11/).
//
// Nimmt aus der ECHTEN App (Dev-Server, Auto-Export aus) auf einer WEGWERF-KOPIE des Live-Abbilds auf:
// Sponsor-Seite (aktiver Vertrag + Liga-Tabelle), Finanzseite Reiter „Sponsor“ und das Postfach mit dem Absender
// „Sponsor“, je bei 1920x1080 und 2560x1440.
//
//   flock /tmp/oly-aufnahme.lock env OLY_APP_SQLITE_PATH=<kopie>.sqlite \
//     npx tsx scripts/screenshot-sponsor-wappen.ts --save <saveId> --team D-P
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const PORT = process.env.SCREENSHOT_PORT ?? "3231";
const BASE_URL = `http://localhost:${PORT}`;
const SAVE = arg("save", "");
const TEAM = arg("team", "D-P");
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "sponsor-wappen-22-11");
const GROESSEN = [
  { breite: 1920, hoehe: 1080 },
  { breite: 2560, hoehe: 1440 },
];

function startServer(): ChildProcess {
  const child = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stderr?.on("data", (chunk) => process.stderr.write(`[srv] ${chunk}`));
  return child;
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {
      // noch nicht oben
    }
    await delay(2000);
  }
  throw new Error("Server wurde nicht rechtzeitig erreichbar.");
}

async function schliesseBriefing(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const backdrop = page.getByTestId("season-briefing-backdrop");
    if (!(await backdrop.isVisible().catch(() => false))) return;
    const knopf = page.getByRole("button", { name: /^(Erledigt|Später)$/ }).first();
    if (await knopf.isVisible().catch(() => false)) await knopf.click();
    await page.waitForTimeout(500);
  }
}

async function oeffne(page: Page, view: string, testId: string) {
  const url = new URL("/foundation", BASE_URL);
  url.searchParams.set("view", view);
  url.searchParams.set("saveId", SAVE);
  url.searchParams.set("team", TEAM);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 600_000 });
  await page.waitForLoadState("networkidle", { timeout: 300_000 }).catch(() => undefined);
  await page.getByTestId(testId).first().waitFor({ state: "visible", timeout: 300_000 });
  await page.waitForTimeout(3000);
  await schliesseBriefing(page);
  await page.waitForTimeout(800);
}

/** Zaehlt geladene Wappenbilder und meldet kaputte (naturalWidth 0). */
async function wappenBericht(page: Page, wo: string) {
  const bericht = await page.evaluate(async () => {
    const bilder = Array.from(document.querySelectorAll<HTMLImageElement>("img.sponsor-wappen"));
    await Promise.all(bilder.map((b) => (b.complete ? null : new Promise((r) => { b.onload = r; b.onerror = r; }))));
    return { anzahl: bilder.length, kaputt: bilder.filter((b) => b.naturalWidth === 0).map((b) => b.src) };
  });
  console.log(`[wappen] ${wo}: ${bericht.anzahl} Bilder, kaputt ${JSON.stringify(bericht.kaputt)}`);
}

async function main() {
  if (!SAVE) throw new Error("--save fehlt");
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(300_000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    for (const groesse of GROESSEN) {
      const ctx = await browser.newContext({ viewport: { width: groesse.breite, height: groesse.hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      const bild = (name: string) => path.join(OUTPUT_DIR, `${name}-${groesse.breite}.png`);

      await oeffne(page, "prize", "foundation-sponsors");
      await page.getByTestId("nl-sponsor-active-contract").scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(500);
      await wappenBericht(page, `sponsorseite ${groesse.breite}`);
      await page.screenshot({ path: bild("01-sponsorseite-vertrag") });
      const tabelle = page.getByTestId("sponsor-league-table");
      if (await tabelle.isVisible().catch(() => false)) {
        await tabelle.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await wappenBericht(page, `liga-tabelle ${groesse.breite}`);
        await page.screenshot({ path: bild("02-sponsorseite-liga") });
      } else {
        console.log("[aufnahme] Liga-Tabelle nicht sichtbar");
      }

      await oeffne(page, "finances", "finanzen-modern");
      await page.getByRole("tab", { name: /^Sponsor$/ }).first().click();
      await page.getByTestId("fin-sponsor").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1200);
      await wappenBericht(page, `finanzen ${groesse.breite}`);
      await page.screenshot({ path: bild("03-finanzen-sponsor") });

      await oeffne(page, "inboxV2", "postfach");
      const absender = page.getByTestId("postfach-absender-sponsor");
      if (await absender.isVisible().catch(() => false)) {
        await absender.click();
        await page.waitForTimeout(800);
        const erste = page.getByTestId("postfach-meldung").first();
        if (await erste.isVisible().catch(() => false)) await erste.click();
        await page.waitForTimeout(800);
      }
      await wappenBericht(page, `postfach ${groesse.breite}`);
      await page.screenshot({ path: bild("04-postfach-sponsor") });
      console.log(`[aufnahme] ${groesse.breite} fertig`);
      await ctx.close();
    }
  } finally {
    await browser?.close();
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
