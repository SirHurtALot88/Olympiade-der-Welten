// Screenshots 1920x1080: Startwahl-Dialog im Office, "KI rechnet", Abbruch-Dialog, Zustand nach dem Abbruch.
// AUFRUF: npx tsx scripts/screenshot-draft-startwahl-abbruch.ts   (der Dev-Server startet mit Auto-Export AUS)
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Page } from "@playwright/test";

import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3216";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "draft-tempo-abbruch-21-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-draft-shot-${process.pid}.sqlite`);

async function baueSave() {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const gs = persistence.getSaveById(saveId)!.gameState;
  const mitEigner = applyGameModeOwnership(gs, { saveMode: "solo_1", chrisTeamIds: [gs.teams[0]!.teamId], frankyTeamIds: [] });
  persistence.saveSingleplayerState(saveId, mitEigner);
  const manuelle = Object.values(mitEigner.seasonState.teamControlSettings ?? {}).filter((e) => e.controlMode === "manual").map((e) => e.teamId);
  console.log("manuelle Teams:", manuelle.join(","));
  const teamId = manuelle[0] ?? gs.teams[0]!.teamId;
  const { starteLigaDraft } = await import("@/lib/draft/liga-draft-dienst");
  starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: manuelle.length ? manuelle : [teamId], wahlOffen: true });
  return { saveId, teamId };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.rm(SQLITE_PATH, { force: true });
  const { saveId, teamId } = await baueSave();
  const server: ChildProcess = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0", OLY_LIGA_DRAFT_MODUS: "einzelschritt" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout?.on("data", () => undefined);
  server.stderr?.on("data", () => undefined);
  try {
    for (let i = 0; i < 450; i += 1) {
      try {
        const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store" });
        if (r.status < 500) break;
      } catch {
        /* warten */
      }
      await delay(2000);
    }
    const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const page: Page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    page.on("crash", () => console.log("PAGE CRASH"));
    page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
    const url = new URL("/foundation", BASE_URL);
    url.searchParams.set("saveId", saveId);
    url.searchParams.set("team", teamId);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByTestId("draft-startwahl-dialog").waitFor({ state: "visible", timeout: 150_000 }).catch(async (e) => {
      console.log("DEBUG-TEXT", (await page.locator("body").innerText()).slice(0, 600));
      throw e;
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "01-startwahl-dialog-office.png") });
    console.log("01 ok");
    await page.getByTestId("draft-startwahl-spielen").click();
    await page.getByTestId("draft-abbrechen").waitFor({ state: "visible", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "02-draft-seite-nach-wahl.png") });
    const vor = page.getByTestId("draft-vor-zu-meinem-pick");
    if (await vor.isVisible().catch(() => false)) {
      await vor.click();
      await page.getByTestId("draft-rechnet").waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      await page.screenshot({ path: path.join(OUT, "03-ki-rechnet.png") });
      console.log("03 ok");
      await page.getByTestId("draft-rechnet").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, "04-nach-vor-lauf.png") });
    }
    await page.getByTestId("draft-abbrechen").click();
    await page.getByTestId("draft-abbruch-dialog").waitFor({ state: "visible", timeout: 20_000 });
    await page.screenshot({ path: path.join(OUT, "05-abbruch-dialog.png") });
    await page.getByTestId("draft-abbruch-ja").click();
    await page.getByTestId("draft-abbrechen").waitFor({ state: "detached", timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, "06-nach-abbruch.png") });
    const res = (await fetch(`${BASE_URL}/api/draft?saveId=${saveId}&vorschau=0&verlauf=1`).then((r) => r.json())) as { ansicht?: { status?: string } };
    console.log("Draft-Status nach Abbruch:", res.ansicht?.status);
    await browser.close();
  } finally {
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* ok */
    }
    for (const e of ["", "-wal", "-shm"]) await fs.rm(`${SQLITE_PATH}${e}`, { force: true });
  }
}
void main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
