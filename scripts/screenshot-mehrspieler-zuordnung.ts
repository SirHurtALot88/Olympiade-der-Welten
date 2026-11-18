// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Ramona als waehlbare Person (Mehrspieler-Delegation, 18.11.).
//
// Nimmt aus der ECHTEN App (Produktions-Build, `npm start`) bei 1920x1080 auf:
//   01 Login-Seite mit Chris / Franky / Ramona
//   02 „Neues Spiel starten“: Klub-Raster mit Ramona-Teams
//   03 „Mitspieler (Franky, Ramona)“: Zuordnung je Team mit Ramona-Knopf
//   04 Team-Steuerung des laufenden Spielstands: „Wer steuert was“ mit Ramona · Halbautomatik
//
// Voraussetzung: `npm run build` im selben Arbeitsbaum. Aufnahmen nur unter
// `flock /tmp/oly-aufnahme.lock`, danach `.next` loeschen (CLAUDE.md, Regel #1602).
//
// AUFRUF: flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-mehrspieler-zuordnung.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3210";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "mehrspieler-delegation-18-11");
const SQLITE_PATH = path.join(os.tmpdir(), "oly-mehrspieler-zuordnung.sqlite");
const BREITE = 1920;
const HOEHE = 1080;
// Nur fuer diesen Wegwerf-Server: Login an, Platzhalter-Passwoerter (keine echten Geheimnisse).
const TEST_PASSWORT = "aufnahme-nur-lokal";

function baueSave(): string {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = {
    presetId: "custom" as const,
    chrisTeamIds: ["M-M"],
    frankyTeamIds: ["D-P"],
    ramonaTeamIds: ["P-S", "G-G"],
    saveName: "Mehrspieler-Aufnahme 18.11.",
  };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  return angelegt.save.saveId;
}

function startServer(): ChildProcess {
  console.log("[aufnahme] starte Produktions-Server (npm start, Auto-Export aus) ...");
  const child = spawn("npm", ["start"], {
    env: {
      ...process.env,
      OLY_APP_SQLITE_PATH: SQLITE_PATH,
      PORT,
      OLY_AUTO_EXPORT_SAVES: "0",
      OLY_AUTO_EXPORT_PUSH: "0",
      OLY_AUTH_ENABLED: "1",
      OLY_AUTH_SECRET: "aufnahme-nur-lokal-secret",
      OLY_USER_CHRIS_PASSWORD: TEST_PASSWORT,
      OLY_USER_FRANKY_PASSWORD: TEST_PASSWORT,
      OLY_USER_RAMONA_PASSWORD: TEST_PASSWORT,
    },
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
      const response = await fetch(`${BASE_URL}/login`, { cache: "no-store" });
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

async function main() {
  await fs.rm(SQLITE_PATH, { force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const saveId = baueSave();
  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(180_000);
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: BREITE, height: HOEHE }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();

    // 01 Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.getByRole("radio", { name: "Ramona" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `app-01-login-${BREITE}x${HOEHE}.png`) });

    // Als Chris anmelden (Host, legt Spiele an) — ueber denselben Login-Endpunkt wie das Formular;
    // der Sitzungs-Cookie landet im Browser-Kontext.
    const login = await ctx.request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "chris", password: TEST_PASSWORT },
    });
    if (!login.ok()) throw new Error(`Login fehlgeschlagen: ${login.status()}`);

    // 02/03 Neues Spiel: Ramona-Teams zuordnen
    const url = new URL("/foundation", BASE_URL);
    url.searchParams.set("view", "teamSettings");
    url.searchParams.set("tab", "saves");
    url.searchParams.set("saveId", saveId);
    url.searchParams.set("team", "M-M");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByTestId("new-game-wizard-toggle").waitFor({ state: "visible", timeout: 120_000 });
    await schliesseBriefing(page);
    await page.getByTestId("new-game-wizard-toggle").click();
    for (const teamId of ["P-C", "C-S"]) {
      const knopf = page.getByTestId(`new-game-ramona-${teamId}`);
      await knopf.scrollIntoViewIfNeeded();
      await knopf.click();
    }
    await page.waitForTimeout(500);
    const raster = page.getByTestId("new-game-ownership-picker");
    await raster.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -260));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `app-02-neues-spiel-klubs-${BREITE}x${HOEHE}.png`) });
    // Die Seite scrollt in einem inneren Container, nicht im Fenster: deshalb ein Element-Bild des
    // aufgeklappten Abschnitts statt eines Fensterbilds.
    const mitspieler = page.locator("details", { has: page.locator("summary", { hasText: "Mitspieler (Franky, Ramona)" }) });
    await mitspieler.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await mitspieler.screenshot({ path: path.join(OUTPUT_DIR, `app-03-mitspieler-${BREITE}x${HOEHE}.png`) });

    // 04 Laufender Spielstand: wer steuert was
    url.searchParams.set("tab", "control");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    const wer = page.getByTestId("game-mode-ownership-readonly");
    await wer.waitFor({ state: "visible", timeout: 120_000 });
    await schliesseBriefing(page);
    await wer.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -200));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `app-04-wer-steuert-was-${BREITE}x${HOEHE}.png`) });
    console.log(`[aufnahme] Bilder unter ${OUTPUT_DIR}`);
  } finally {
    await browser?.close();
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
    await fs.rm(SQLITE_PATH, { force: true });
    await fs.rm(`${SQLITE_PATH}-wal`, { force: true });
    await fs.rm(`${SQLITE_PATH}-shm`, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
