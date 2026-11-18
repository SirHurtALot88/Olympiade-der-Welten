// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Saisonstand "Disziplin-Matrix" im Duell-Save (Battle, Liga-Split)
// mitten in der Saison. Baut eine Wegwerf-SQLite, spielt N Spieltage per Auto-Run, startet den
// Dev-Server (Auto-Export AUS) gegen genau diese Datei und schreibt die Bilder app-n-01..04.
//
// AUFRUF: npx tsx scripts/screenshot-saisonstand-matrix-duell.ts [spieltage=11]
// ===================================================================================
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
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

const PORT = process.env.SCREENSHOT_PORT ?? "3215";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "app-rahmen-bau-18-11");
// OLY_SHOT_BEHALTEN=1: feste Wegwerf-Datei, die nach dem Lauf stehen bleibt und beim naechsten Lauf wiederverwendet wird (spart das Spielen der Spieltage).
const BEHALTEN = process.env.OLY_SHOT_BEHALTEN === "1";
const SQLITE_PATH = path.join(os.tmpdir(), BEHALTEN ? "oly-app-rahmen-behalten.sqlite" : `oly-app-rahmen-screenshot-${process.pid}.sqlite`);
const IDS_PATH = `${SQLITE_PATH}.ids.json`;
const SPIELTAGE = Number(process.argv[2] ?? 4);

async function baueSave(): Promise<{ saveId: string; teamId: string }> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[screenshot-rahmen]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  persistence.saveSingleplayerState(
    saveId, applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  for (let i = 0; i < SPIELTAGE; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      { saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
      persistence,
    );
    if (!lauf.ok) { console.log(`[screenshot-rahmen] ${matchdayId} blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence,
    );
    if (!adv.ok || !adv.applied) { console.log(`[screenshot-rahmen] Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`); break; }
    console.log(`[screenshot-rahmen] ${matchdayId} gespielt (${i + 1}/${SPIELTAGE})`);
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

function startDevServer(): ChildProcessWithoutNullStreams {
  console.log("[screenshot-rahmen] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
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
    if (await isServerReachable(40_000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
}

async function main() {
  let ids: { saveId: string; teamId: string } | null = null;
  if (BEHALTEN) ids = await fs.readFile(IDS_PATH, "utf8").then((t) => JSON.parse(t) as { saveId: string; teamId: string }).catch(() => null);
  if (!ids) {
    await fs.rm(SQLITE_PATH, { force: true });
    ids = await baueSave();
    if (BEHALTEN) await fs.writeFile(IDS_PATH, JSON.stringify(ids));
  }
  const { saveId, teamId } = ids;
  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(900_000);
    browser = await chromium.launch();
    const GROESSEN: Array<[number, number, string, number]> = [[2560, 1440, "2560x1440", 1], [1920, 1080, "1920x1080", 1], [1710, 1112, "1710x1112", 1]];
    const aufnehmen = async (ansicht: string, breite: number, hoehe: number, datei: string, vorher: (p: Page) => Promise<void>) => {
      if (process.env.OLY_SHOT_NUR && !datei.includes(process.env.OLY_SHOT_NUR)) return;
      const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", ansicht);
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await dismissSeasonBriefingIfOpen(page, 30_000);
      await page.getByTestId("foundation-regieband").or(page.getByTestId("foundation-arena-griff")).first().waitFor({ state: "visible", timeout: 90_000 });
      await page.waitForTimeout(1500);
      await dismissSeasonBriefingIfOpen(page, 30_000);
      await vorher(page);
      await page.waitForTimeout(700);
      const ziel = path.join(OUTPUT_DIR, datei);
      await page.screenshot({ path: ziel });
      console.log(`[screenshot-rahmen] ${ziel}`);
      await ctx.close();
    };
    const nichts = async () => undefined;
    for (const [w, h, g] of GROESSEN) {
      await aufnehmen("season-v2", w, h, `app-saisonstand-${g}.png`, nichts);
      await aufnehmen("lineup", w, h, `app-einsatzliste-${g}.png`, nichts);
      await aufnehmen("home", w, h, `app-start-${g}.png`, nichts);
      await aufnehmen("matchday-arena", w, h, `app-arena-vollbild-${g}.png`, nichts);
    }
    await aufnehmen("season-v2", 1920, 1080, "app-schiene-hover-1920x1080.png", async (p) => { await p.getByTestId("foundation-sidebar").hover(); await p.waitForTimeout(600); });
    await aufnehmen("season-v2", 1920, 1080, "app-takt-ablauf-1920x1080.png", async (p) => { await p.getByTestId("foundation-takt-status").click(); });
    await aufnehmen("home", 1920, 1080, "app-office-1920x1080.png", async (p) => { await p.getByTestId("foundation-rail-office").click(); });
    await aufnehmen("matchday-arena", 1920, 1080, "app-arena-mit-rahmen-1920x1080.png", async (p) => { await p.keyboard.press("r"); });
  } finally {
    await browser?.close();
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    if (!BEHALTEN) {
      await fs.rm(SQLITE_PATH, { force: true });
      await fs.rm(`${SQLITE_PATH}-wal`, { force: true });
      await fs.rm(`${SQLITE_PATH}-shm`, { force: true });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
