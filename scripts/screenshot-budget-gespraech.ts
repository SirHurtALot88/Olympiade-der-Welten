// ===================================================================================
// ABGLEICH-AUFNAHMEN BUDGET-GESPRAECH (23.11.): echte App neben dem Mockup, 1920x1080 und 2560x1440, deviceScaleFactor 1.
// Baut eine Wegwerf-SQLite (neues Spiel, Saison 1, Death Peaches als menschliches Team des Dev-Nutzers `user_local`, alle anderen KI),
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

import { fuehreKiBudgetGespraecheAus } from "@/lib/finance/vorstand-budget-gespraech";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { getLeagueOf } from "@/lib/season/league-split";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3267";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "budget-gespraech-23-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-budget-gespraech-${process.pid}.sqlite`);
// Das echte Spiel braucht ein Team im Mittelfeld der Startbudgets (Erwartungsrang um 6, wie im Mockup); ohne Vorgabe wird es gewaehlt.
let TEAM = process.env.SCREENSHOT_TEAM ?? "";
const GROESSEN: Array<[number, number]> = [
  [1920, 1080],
  [2560, 1440],
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
  if (!TEAM) {
    const liga1 = gs.teams.filter((t) => getLeagueOf(gs, t.teamId) === getLeagueOf(gs, gs.teams[0]!.teamId));
    TEAM = [...liga1].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))[8]!.teamId;
  }
  const mitMensch = applyGameModeOwnership(gs, { saveMode: "solo_1", chrisTeamIds: [TEAM], frankyTeamIds: [] });
  // Wie im echten Spiel: das menschliche Team hat noch NICHT unterschrieben (die Anlage hat es als KI-Team gestempelt, weil es damals eines war).
  const stempel = { ...(mitMensch.seasonState.budgetVereinbarung ?? {}) };
  delete stempel[TEAM];
  const budget = { ...(mitMensch.seasonState.vorstandBudget ?? {}) };
  delete budget[TEAM];
  const ohneStempel = { ...mitMensch, seasonState: { ...mitMensch.seasonState, budgetVereinbarung: stempel, vorstandBudget: budget } };
  persistence.saveSingleplayerState(saveId, fuehreKiBudgetGespraecheAus(ohneStempel));
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
  const knopf = page.getByRole("button", { name: /^Erledigt$/ }).or(page.getByRole("button", { name: /^Später$/ })).first();
  if (await knopf.isVisible().catch(() => false)) await knopf.click();
  await backdrop.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
}

async function main() {
  await fs.rm(SQLITE_PATH, { force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const saveId = await baueSave();
  console.log(`[budget-shot] Save ${saveId}, Team ${TEAM}`);
  const server = starteServer();
  let browser: Browser | null = null;
  try {
    for (let i = 0; i < 450 && !(await erreichbar()); i += 1) await delay(2000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });

    const ausMockup = async (b: number, h: number, name: string, query: string) => {
      const ctx = await browser!.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/mockups/budget-gespraech-22-11.html?still=1&team=D-P&${query}`, { waitUntil: "load" });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `mockup-${name}-${b}.png`) });
      await ctx.close();
    };

    {
      // Ein Durchgang, jeder Zustand in beiden Groessen (die Unterschrift laesst sich nicht zurueckdrehen).
      const [b0, h0] = GROESSEN[0]!;
      const ctx = await browser.newContext({ viewport: { width: b0, height: h0 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log(`[budget-shot] Seitenfehler: ${String(e).slice(0, 160)}`));
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "homeV2");
      url.searchParams.set("tab", "office");
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", TEAM);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await schliesseBriefing(page);
      await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 150_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      await schliesseBriefing(page);
      // Der Draft-Tor zeigt die Seite selbst; sonst ueber den Reiter im Office.
      const seite = page.getByTestId("budget-gespraech");
      if (!(await seite.isVisible().catch(() => false))) {
        await page.getByRole("tab", { name: /Budget/ }).first().click({ timeout: 60_000 });
      }
      await seite.waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(800);
      const aufnahme = async (name: string) => {
        for (const [b, h] of GROESSEN) {
        await page.setViewportSize({ width: b, height: h });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUTPUT_DIR, `app-${name}-${b}.png`) });
        const ueberlauf = await page.evaluate(() => {
          const wurzel = document.querySelector(".bgs") as HTMLElement | null;
          const kaputt: string[] = [];
          wurzel?.querySelectorAll<HTMLElement>(".karte,.pan,.gtopf,.klauseln,.topf,.kader,.waage,.vfolgen").forEach((e) => {
            if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) kaputt.push(`${e.className}:${e.scrollHeight}>${e.clientHeight}`);
          });
          return { seitenScroll: document.documentElement.scrollHeight > window.innerHeight + 2, kaputt };
        });
        console.log(`[budget-shot] ${name}-${b}: ${JSON.stringify(ueberlauf)}`);
        }
        await page.setViewportSize({ width: b0, height: h0 });
      };
      await aufnahme("1-lage");
      await page.getByRole("button", { name: /^Verhandeln/ }).click();
      await aufnahme("2-verhandeln");
      await page.getByRole("button", { name: /Ehrgeizig/ }).click();
      await aufnahme("2-zusage-ehrgeizig");
      await page.getByRole("button", { name: /Mutig/ }).click();
      await aufnahme("2-gegenangebot");
      await page.getByRole("button", { name: /Alles auf eine Karte beantragen/ }).click();
      await aufnahme("2-alles");
      await page.getByRole("button", { name: /Antrag zurückziehen/ }).click();
      await page.getByRole("button", { name: /Ehrgeizig/ }).click();
      await page.getByRole("button", { name: /Normal/ }).click();
      await page.getByRole("button", { name: /Zur Vereinbarung/ }).click();
      await aufnahme("3-vereinbarung");
      await page.getByRole("button", { name: /Unterschreiben/ }).click();
      await page.waitForTimeout(2500);
      await aufnahme("3-unterschrieben");
      await ctx.close();
    }
    for (const [b, h] of GROESSEN) {
      await ausMockup(b, h, "1-lage", "schritt=1");
      await ausMockup(b, h, "2-verhandeln", "schritt=2");
      await ausMockup(b, h, "2-gegenangebot", "schritt=2&amb=hoch&rl=mutig");
      await ausMockup(b, h, "3-vereinbarung", "schritt=3&amb=hoch");
      await ausMockup(b, h, "3-unterschrieben", "schritt=3&amb=hoch&sign=1");
    }
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
