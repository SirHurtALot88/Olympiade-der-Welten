// ===================================================================================
// ABGLEICH-AUFNAHMEN SPONSORENSEITE (24.11.): echte App neben dem Mockup, 1920x1080 und 2560x1440, deviceScaleFactor 1.
// Baut eine Wegwerf-SQLite (neues Spiel, Saison 1, erstes Team als menschliches Team des Dev-Nutzers `user_local`, alle anderen KI),
// startet den Dev-Server (Auto-Export AUS) auf Port 3267 gegen genau diese Datei und nimmt Lage, Verhandeln (Gegenangebot, Ablehnung),
// Vereinbarung (offen, unterschrieben) auf. Danach dieselben Zustaende im Mockup (`?still=1`).
//
// AUFRUF: flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-budget-gespraech.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { getLeagueOf } from "@/lib/season/league-split";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3268";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "sponsoren-seite-24-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-sponsoren-seite-${process.pid}.sqlite`);
// Das echte Spiel braucht ein Team im Mittelfeld der Startbudgets (Erwartungsrang um 6, wie im Mockup); ohne Vorgabe wird es gewaehlt.
let TEAM = process.env.SCREENSHOT_TEAM ?? "";
const GROESSEN: Array<[number, number]> = [
  [1920, 1080],
  [2560, 1440],
  [1710, 1112],
];

async function baueSave(): Promise<string> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const gs = persistence.getSaveById(saveId)!.gameState;
  if (!TEAM) TEAM = gs.teams[0]!.teamId;
  const mitMensch = applyGameModeOwnership(gs, { saveMode: "solo_1", chrisTeamIds: [TEAM], frankyTeamIds: [] });
  // Das menschliche Team hat noch KEINEN Sponsor gewaehlt (die Anlage hat es als KI-Team versorgt).
  const vertraege = { ...(mitMensch.seasonState.sponsorContractsByTeamId ?? {}) };
  delete vertraege[TEAM];
  persistence.saveSingleplayerState(saveId, { ...mitMensch, seasonState: { ...mitMensch.seasonState, sponsorContractsByTeamId: vertraege } });
  return saveId;
}

async function erreichbar(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: AbortSignal.timeout(40_000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

function starteServer(): ChildProcess {
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", (c) => process.stdout.write(`[dev] ${c}`));
  child.stderr?.on("data", (c) => process.stderr.write(`[dev] ${c}`));
  return child;
}

async function schliesseBriefing(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  if (!(await backdrop.isVisible().catch(() => false))) return;
  const knopf = page.getByRole("button", { name: /^Später$/ }).or(page.getByRole("button", { name: /^Erledigt$/ })).first();
  if (await knopf.isVisible().catch(() => false)) await knopf.click();
  await backdrop.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
}

const ANSICHTEN: Array<[string, RegExp]> = [
  ["angebote", /Verhandlung/],
  ["liga", /Liga-Vergleich/],
  ["rechnung", /Saisonfaktor/],
  ["vertrag", /Laufender Vertrag/],
];

async function main() {
  await fs.rm(SQLITE_PATH, { force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const saveId = await baueSave();
  console.log(`[sponsoren-shot] Save ${saveId}, Team ${TEAM}`);
  const server = starteServer();
  let browser: Browser | null = null;
  try {
    for (let i = 0; i < 450 && !(await erreichbar()); i += 1) await delay(2000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const [b0, h0] = GROESSEN[0]!;
    const ctx = await browser.newContext({ viewport: { width: b0, height: h0 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log(`[sponsoren-shot] Seitenfehler: ${String(e).slice(0, 200)}`));
    const url = new URL("/foundation", BASE_URL);
    url.searchParams.set("view", "prize");
    url.searchParams.set("tab", "sponsors");
    url.searchParams.set("saveId", saveId);
    url.searchParams.set("team", TEAM);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await schliesseBriefing(page);
    await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 150_000 }).catch(() => undefined);
    const seite = page.getByTestId("sponsoren-modern");
    await seite.waitFor({ state: "visible", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const aufnahme = async (name: string) => {
      for (const [b, h] of GROESSEN) {
        await page.setViewportSize({ width: b, height: h });
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(OUTPUT_DIR, `app-${name}-${b}.png`) });
        const ueberlauf = await page.evaluate(() => {
          const kaputt: string[] = [];
          document.querySelectorAll<HTMLElement>(".so .so-pan,.so .so-kb,.so .so-ak,.so .so-tw").forEach((e) => {
            if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) kaputt.push(`${e.className}:${e.scrollHeight}>${e.clientHeight}/${e.scrollWidth}>${e.clientWidth}`);
          });
          return { seitenScroll: document.documentElement.scrollHeight > window.innerHeight + 2, kaputt };
        });
        console.log(`[sponsoren-shot] ${name}-${b}: ${JSON.stringify(ueberlauf)}`);
      }
      await page.setViewportSize({ width: b0, height: h0 });
    };
    const reiter = (muster: RegExp) => page.getByRole("tab", { name: muster }).first();
    const klickReiter = async (muster: RegExp) => {
      for (let i = 0; i < 4; i += 1) {
        await schliesseBriefing(page);
        if (await page.getByTestId("season-briefing-backdrop").isVisible().catch(() => false)) await page.keyboard.press("Escape");
        try {
          await reiter(muster).click({ timeout: 8000 });
          return;
        } catch {
          /* Modal oder Laden: erneut versuchen */
        }
      }
      await reiter(muster).click({ timeout: 8000, force: true });
    };
    for (const [name, muster] of ANSICHTEN.slice(0, 3)) {
      await klickReiter(muster);
      await aufnahme(name);
    }
    // Unterschreiben (Leistungsvertrag, zwei Jahre), danach Vertrag und Termine.
    await klickReiter(ANSICHTEN[0]![1]);
    const knopf = page.getByRole("button", { name: /^Unterschreiben$/ });
    if (await knopf.isEnabled().catch(() => false)) {
      await knopf.click();
      await page.waitForTimeout(3500);
    } else {
      console.log("[sponsoren-shot] Unterschreiben gesperrt (Phase?)");
    }
    await klickReiter(ANSICHTEN[3]![1]);
    await aufnahme("vertrag");
    await ctx.close();
    const ausMockup = async (b: number, h: number, name: string) => {
      const c = await browser!.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
      const p = await c.newPage();
      await p.goto(`${BASE_URL}/mockups/sponsoren-modern-22-11.html?still=1&ansicht=${name}`, { waitUntil: "load" });
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(OUTPUT_DIR, `mockup-${name}-${b}.png`) });
      await c.close();
    };
    for (const [b, h] of GROESSEN) for (const [name] of ANSICHTEN) await ausMockup(b, h, name);
  } finally {
    await browser?.close().catch(() => undefined);
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        /* schon beendet */
      }
    }
    for (const suffix of ["", "-wal", "-shm"]) await fs.rm(`${SQLITE_PATH}${suffix}`, { force: true });
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
