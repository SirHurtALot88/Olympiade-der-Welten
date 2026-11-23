// ===================================================================================
// AUFNAHMEN: Training „Wo das ankommt", Plan-Vorschau Top 5, Verletzte und Belastungs-Verlauf (22.11.,
// docs/design/training-wirkung-22-11.md). Echte App (Dev-Server, Auto-Export aus) auf einer KOPIE des Live-Abbilds:
//
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz | gunzip -c > /tmp/abbild.sqlite
//   flock /tmp/oly-aufnahme.lock env OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite \
//     npx tsx scripts/screenshot-training-wirkung.ts --team D-P --spieler "Aeon Flux" --verletzt Zynara
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

const PORT = process.env.SCREENSHOT_PORT ?? "3218";
const BASE_URL = `http://localhost:${PORT}`;
const TEAM = arg("team", "D-P");
const SPIELER = arg("spieler", "Aeon Flux");
const VERLETZT = arg("verletzt", "Zynara");
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "training-wirkung-22-11");
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
  child.stdout?.on("data", (chunk) => process.stdout.write(`[srv] ${chunk}`));
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

async function waehleSpieler(page: Page, name: string) {
  const zeile = page.getByTestId("training-kader-tabelle").getByText(name, { exact: false }).first();
  await zeile.click({ timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function aufnehmen() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const save = createPersistenceService().getActiveSave();
  if (!save) throw new Error("Kein aktiver Spielstand.");
  const url = new URL("/foundation", BASE_URL);
  url.searchParams.set("view", "trainingCompact");
  url.searchParams.set("saveId", save.saveId);
  url.searchParams.set("team", TEAM);
  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(300_000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    for (const groesse of GROESSEN) {
      const ctx = await browser.newContext({ viewport: { width: groesse.breite, height: groesse.hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 600_000 });
      await page.waitForLoadState("networkidle", { timeout: 300_000 }).catch(() => undefined);
      await page.getByTestId("training-modern").waitFor({ state: "visible", timeout: 300_000 });
      await page.waitForTimeout(4000);
      await schliesseBriefing(page);
      await page.waitForTimeout(800);

      await waehleSpieler(page, SPIELER);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `01-kader-im-blick-${groesse.breite}.png`) });
      console.log(`[aufnahme] kader ${groesse.breite}`);

      await page.getByRole("tab", { name: /^Plan/ }).click();
      await page.getByTestId("training-plan").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `02-plan-top5-${groesse.breite}.png`) });

      // Entwurf: Intensität „Hart" wählen, damit „bisher → mit Änderung" und die Verläufe sichtbar sind.
      const hart = page.locator(".te-modus", { hasText: "Hart" }).first();
      if (await hart.isEnabled().catch(() => false)) await hart.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `03-plan-aenderung-${groesse.breite}.png`) });
      console.log(`[aufnahme] plan ${groesse.breite}`);

      // Verletzter Spieler: zurück in den Kader, wählen, Im Blick und Plan.
      await page.getByRole("tab", { name: /^Kader/ }).click();
      await page.waitForTimeout(1000);
      await waehleSpieler(page, VERLETZT);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `04-verletzt-im-blick-${groesse.breite}.png`) });
      await page.getByRole("tab", { name: /^Plan/ }).click();
      await page.getByTestId("training-plan").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `05-verletzt-plan-${groesse.breite}.png`) });
      console.log(`[aufnahme] verletzt ${groesse.breite}`);
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

aufnehmen().catch((error) => {
  console.error(error);
  process.exit(1);
});
