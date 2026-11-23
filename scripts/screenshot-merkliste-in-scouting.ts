// AUFNAHME: Merkliste als Reiter der Scouting-Seite (22.11.). Alter Link view=merkliste muss auf Scouting mit aktivem Reiter fuehren.
//   flock /tmp/oly-aufnahme.lock env OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/screenshot-merkliste-in-scouting.ts --team D-P
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3219";
const BASE_URL = `http://localhost:${PORT}`;
const i = process.argv.indexOf("--team");
const TEAM = i >= 0 ? process.argv[i + 1]! : "D-P";
const OUT = path.join(process.cwd(), "docs", "design", "merkliste-in-scouting-22-11");

function startServer(): ChildProcess {
  const child = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", (c) => process.stdout.write(`[srv] ${c}`));
  return child;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const save = createPersistenceService().getActiveSave();
  if (!save) throw new Error("Kein Spielstand");
  const server = startServer();
  try {
    for (let n = 0; n < 150; n += 1) {
      try {
        if ((await fetch(`${BASE_URL}/api/health`)).status < 500) break;
      } catch {
        /* noch nicht oben */
      }
      await delay(2000);
    }
    const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    const alt = `${BASE_URL}/foundation?view=merkliste&saveId=${save.saveId}&team=${TEAM}`;
    await page.goto(alt, { waitUntil: "domcontentloaded", timeout: 600_000 });
    await page.getByTestId("merkliste-view").waitFor({ state: "visible", timeout: 300_000 });
    await page.waitForTimeout(3000);
    console.log("[aktiv]", await page.locator(".foundation-subnav-item.is-active").allTextContents(), page.url());
    await page.screenshot({ path: path.join(OUT, "01-alter-link-merkliste-1920.png") });
    await page.getByRole("button", { name: /^Übersicht$/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, "02-scouting-uebersicht-1920.png") });
    await browser.close();
  } finally {
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
