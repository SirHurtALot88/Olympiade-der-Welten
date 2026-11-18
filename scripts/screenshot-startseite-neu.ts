// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: neue Startseite (Home) im Duell-Save (Battle, Liga-Split)
// mitten in der Saison. Baut eine Wegwerf-SQLite, spielt N Spieltage per Auto-Run, startet den
// Dev-Server (Auto-Export AUS) gegen genau diese Datei und schreibt die Bilder app-n-01..04.
//
// AUFRUF: npx tsx scripts/screenshot-startseite-neu.ts [spieltage=12] [tag=mitte|vor|ende] [BxH,...]
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";

const PORT = process.env.SCREENSHOT_PORT ?? "3200";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "startseite-neu-18-11");
const SQLITE_PATH = process.env.SCREENSHOT_SQLITE ?? path.join(os.tmpdir(), "oly-startseite-screenshot.sqlite");
const SPIELTAGE = Number(process.argv[2] ?? 12);
const TAG = process.argv[3] ?? "mitte";
const GROESSEN: Array<[number, number]> = (process.argv[4] ?? "2560x1440,1920x1080,1710x1112,412x900").split(",").map((g) => g.split("x").map(Number) as [number, number]);
const MOCKUP_ZUSTAND = TAG === "vor" ? "vor" : TAG === "ende" ? "ende" : "mitte";

const SQLITE_BEHALTEN = process.env.SCREENSHOT_BEHALTEN === "1";

/** Baut den Wegwerf-Save neu — oder setzt mit SCREENSHOT_BEHALTEN=1 einen vorhandenen fort — und spielt bis SPIELTAGE Spieltage. */
async function baueSave(): Promise<{ saveId: string; teamId: string }> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  let saveId: string;
  let teamId: string;
  const vorhanden = SQLITE_BEHALTEN ? persistence.listSaves() : [];
  if (vorhanden.length > 0) {
    saveId = vorhanden[0]!.saveId;
    const gs = persistence.getSaveById(saveId)!.gameState;
    teamId = gs.teams[0]!.teamId;
  } else {
    persistence.bootstrapSingleplayerSave();
    const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    saveId = angelegt.save.saveId;
    await fuehreLigaSetupDraftAus({
      persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
      callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[screenshot-start]",
    });
    const nachDraft = persistence.getSaveById(saveId)!;
    teamId = nachDraft.gameState.teams[0]!.teamId;
    persistence.saveSingleplayerState(
      saveId, applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
  }
  for (;;) {
    const aktuell = persistence.getSaveById(saveId)!;
    const gespielt = aktuell.gameState.season.matchdayIds.indexOf(aktuell.gameState.matchdayState.matchdayId);
    if (gespielt >= SPIELTAGE) break;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      { saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
      persistence,
    );
    if (!lauf.ok) { console.log(`[screenshot-start] ${matchdayId} blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence,
    );
    if (!adv.ok || !adv.applied) { console.log(`[screenshot-start] Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`); break; }
    console.log(`[screenshot-start] ${matchdayId} gespielt`);
  }
  return { saveId, teamId };
}

async function isServerReachable(timeoutMs: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return response.status < 500;
  } catch {
    return false;
  }
}

function startDevServer(): ChildProcess {
  console.log("[screenshot-start] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT: PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return child;
}

async function dismissSeasonBriefingIfOpen(page: Page, timeoutMs: number) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  const visible = await backdrop.isVisible().catch(() => false);
  if (!visible) return;
  const doneButton = page.getByRole("button", { name: /^Erledigt$/ });
  const laterButton = page.getByRole("button", { name: /^Später$/ });
  if (await doneButton.isVisible().catch(() => false)) {
    await doneButton.click();
  } else if (await laterButton.isVisible().catch(() => false)) {
    await laterButton.click();
  }
  await backdrop.waitFor({ state: "hidden", timeout: timeoutMs }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReachable(5000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
}

async function main() {
  if (!SQLITE_BEHALTEN) await fs.rm(SQLITE_PATH, { force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { saveId, teamId } = await baueSave();
  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(720_000);
    browser = await chromium.launch();
    for (const [breite, hoehe] of GROESSEN) {
      const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "home-v2");
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      // Das Saison-Briefing deckt die Seite zu und der Home-Chunk kompiliert im Dev-Server langsam: so lange abwechselnd schließen und warten.
      const frist = Date.now() + 240_000;
      while (Date.now() < frist && (await page.getByTestId("home-modern").count()) === 0) {
        await dismissSeasonBriefingIfOpen(page, 3_000);
        await page.waitForTimeout(1000);
      }
      await page.getByTestId("home-modern").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(2500);
      const ueberlauf = await page.evaluate(() => {
        const wurzel = document.querySelector('[data-testid="home-modern"]') as HTMLElement | null;
        if (!wurzel) return null;
        const raster = wurzel.querySelector(".hm-raster") as HTMLElement | null;
        return { seiteScrollt: document.documentElement.scrollHeight > window.innerHeight + 1, wurzelH: wurzel.getBoundingClientRect().height, innerH: window.innerHeight, rasterScroll: raster ? raster.scrollHeight - raster.clientHeight : null, wurzelScroll: wurzel.scrollHeight - wurzel.clientHeight };
      });
      console.log(`[screenshot-start] ${breite}x${hoehe} Messung`, JSON.stringify(ueberlauf));
      const ziel = path.join(OUTPUT_DIR, `app-${TAG}-${breite}x${hoehe}.png`);
      await page.screenshot({ path: ziel });
      console.log(`[screenshot-start] ${ziel}`);
      const mk = await ctx.newPage();
      await mk.goto(`${BASE_URL}/mockups/oly-start-modern-18-11.html?z=${MOCKUP_ZUSTAND}&still=1${breite < 760 ? "&phone=1" : ""}`, { waitUntil: "load", timeout: 60_000 });
      await mk.waitForTimeout(800);
      await mk.screenshot({ path: path.join(OUTPUT_DIR, `mockup-${TAG}-${breite}x${hoehe}.png`) });
      await ctx.close();
    }
  } finally {
    await browser?.close();
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    if (process.env.SCREENSHOT_LOESCHEN === "1") {
      await fs.rm(SQLITE_PATH, { force: true });
      await fs.rm(`${SQLITE_PATH}-wal`, { force: true });
      await fs.rm(`${SQLITE_PATH}-shm`, { force: true });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
