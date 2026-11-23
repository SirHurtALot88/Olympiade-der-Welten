// ===================================================================================
// ABGLEICH-AUFNAHMEN WERBEKLAUSEL + AUSHAENGESCHILD (23.11.): echte App neben dem Mockup, 1920x1080 und 2560x1440, deviceScaleFactor 1.
// Baut eine Wegwerf-SQLite (neues Spiel, Liga-Setup-Draft, erstes Team als menschliches Team des Dev-Nutzers `user_local`, manuell), startet den
// Dev-Server (Auto-Export AUS) auf Port 3307 gegen genau diese Datei und nimmt auf: Verhandlung (Kauf), Verlaengerung, Marketing/Aushaengeschild
// (offen, gewaehlt und gesperrt). Gegen den echten Server wird nie aufgenommen.
//
// AUFRUF: flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-werbeklausel.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3307";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "werbeklausel-aushaengeschild-23-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-werbeklausel-${process.pid}.sqlite`);
const GROESSEN: Array<[number, number, string]> = [
  [1920, 1080, "1920x1080"],
  [2560, 1440, "2560x1440"],
];

async function baueSave(): Promise<{ saveId: string; teamId: string }> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: "[screenshot-wk]",
  });
  const nachDraft = persistence.getSaveById(saveId)!.gameState;
  const teamId = nachDraft.teams[0]!.teamId;
  let zustand = applyGameModeOwnership(nachDraft, { saveMode: "solo_1", chrisTeamIds: [teamId], frankyTeamIds: [] });
  // Genug Kasse; drei Vertraege laufen aus und sind keine Draft-Festvertraege mehr, damit der Verlaengerungsdialog offen steht.
  const eigene = zustand.rosters.filter((r) => r.teamId === teamId).slice(0, 3).map((r) => r.id);
  zustand = {
    ...zustand,
    teams: zustand.teams.map((t) => (t.teamId === teamId ? { ...t, cash: 400, budget: Math.max(t.budget, 400) } : t)),
    rosters: zustand.rosters.map((r) => (eigene.includes(r.id) ? { ...r, contractLength: 1, draftPickS1: false as const } : r)) as typeof zustand.rosters,
  };
  persistence.saveSingleplayerState(saveId, zustand);
  console.log(`[screenshot-wk] Regel: ${JSON.stringify(zustand.seasonState.marketingRegel?.version)} ${zustand.seasonState.marketingRegel?.regel}`);
  return { saveId, teamId };
}

async function erreichbar(timeoutMs: number) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: c.signal });
    clearTimeout(t);
    return r.status < 500;
  } catch {
    return false;
  }
}

function starteDevServer(): ChildProcess {
  console.log("[screenshot-wk] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const kind = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stdout?.on("data", (c) => process.stdout.write(`[dev] ${c}`));
  kind.stderr?.on("data", (c) => process.stderr.write(`[dev] ${c}`));
  return kind;
}

async function briefingSchliessen(page: Page) {
  const hintergrund = page.getByTestId("season-briefing-backdrop");
  await hintergrund.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  if (!(await hintergrund.isVisible().catch(() => false))) return;
  const erledigt = page.getByRole("button", { name: /^Erledigt$/ });
  const spaeter = page.getByRole("button", { name: /^Später$/ });
  if (await erledigt.isVisible().catch(() => false)) await erledigt.click();
  else if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
  await hintergrund.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.rm(SQLITE_PATH, { force: true });
  const { saveId, teamId } = await baueSave();
  const server = starteDevServer();
  let browser: Browser | null = null;
  try {
    const frist = Date.now() + 900_000;
    while (Date.now() < frist && !(await erreichbar(40_000))) await delay(2000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const nurFilter = process.env.OLY_SHOT_NUR ? new RegExp(process.env.OLY_SHOT_NUR) : null;
    const oeffne = async (ansicht: string, breite: number, hoehe: number) => {
      const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const fehler: string[] = [];
      page.on("pageerror", (e) => fehler.push(String(e)));
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", ansicht);
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await briefingSchliessen(page);
      await page.getByTestId("foundation-regieband").first().waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 150_000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
      await briefingSchliessen(page);
      // "Erledigt" im Briefing kann zur Kapitaen-Seite springen: Ansicht dann erneut per URL oeffnen.
      if (new URL(page.url()).searchParams.get("view") !== ansicht) {
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
        await briefingSchliessen(page);
        await page.getByTestId("foundation-regieband").first().waitFor({ state: "visible", timeout: 120_000 });
        await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 150_000 }).catch(() => undefined);
        await page.waitForTimeout(2000);
        console.log("[screenshot-wk] Ansicht nach Briefing:", page.url());
      }
      return { ctx, page, fehler };
    };
    const knipse = async (page: Page, datei: string, fehler: string[]) => {
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUTPUT_DIR, datei) });
      const mass = await page.evaluate(() => ({
        sx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sy: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      console.log(`[screenshot-wk] ${datei} Seitenscroll x=${mass.sx} y=${mass.sy} JS-Fehler=${fehler.length}${fehler.length ? ` ${fehler[0]!.slice(0, 160)}` : ""}`);
    };
    for (const [b, h, n] of GROESSEN.filter(([, , g]) => !process.env.OLY_SHOT_GROESSE || g === process.env.OLY_SHOT_GROESSE)) {
      // Marketing / Aushaengeschild: offen, dann gewaehlt und gesperrt
      if (!nurFilter || nurFilter.test("marketing")) {
        const { ctx, page, fehler } = await oeffne("marketing", b, h);
        await page.getByRole("tab", { name: /Aushängeschild/ }).first().click({ timeout: 30_000 }).catch(async (e) => {
          await page.screenshot({ path: path.join(OUTPUT_DIR, "debug-marketing.png") });
          console.log("[screenshot-wk] Reiter nicht gefunden; URL:", page.url(), "Text:", (await page.evaluate(() => document.body.innerText)).slice(0, 400));
          throw e;
        });
        await page.getByTestId("aushaengeschild-ansicht").waitFor({ state: "visible", timeout: 30_000 });
        await knipse(page, `app-aushaengeschild-offen-${n}.png`, fehler);
        await page.locator('[data-testid^="ag-zeile-"]').nth(2).click();
        await knipse(page, `app-aushaengeschild-vorschau-${n}.png`, fehler);
        await page.getByTestId("ag-bestaetigen").click();
        await page.getByTestId("ag-gesperrt").waitFor({ state: "visible", timeout: 60_000 }).catch(() => console.log("[screenshot-wk] Sperre nicht sichtbar geworden"));
        await page.getByRole("tab", { name: /Aushängeschild/ }).first().click().catch(() => undefined);
        await knipse(page, `app-aushaengeschild-gesperrt-${n}.png`, fehler);
        await ctx.close();
      }
      // Verhandlung (Kauf)
      if (!nurFilter || nurFilter.test("verhandlung")) {
        const { ctx, page, fehler } = await oeffne("marketV2", b, h);
        await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 90_000 });
        await page.getByTestId("tm-sort-abloese").click();
        await page.waitForTimeout(500);
        await page.locator('[data-testid="tm-zeile"]').first().click();
        if ((await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0) await page.keyboard.press("Escape");
        await page.getByTestId("tm-verhandeln-oeffnen").click();
        await page.getByTestId("tm-tisch").waitFor({ state: "visible", timeout: 30_000 });
        await page.getByTestId("wk-block").waitFor({ state: "visible", timeout: 30_000 }).catch(() => console.log("[screenshot-wk] Klausel-Block fehlt im Kauf-Dialog"));
        await page.waitForTimeout(1500);
        await knipse(page, `app-verhandlung-standard-${n}.png`, fehler);
        await page.getByTestId("wk-zeile--1").click().catch(() => undefined);
        await page.waitForTimeout(1500);
        await knipse(page, `app-verhandlung-spieler-behaelt-${n}.png`, fehler);
        await ctx.close();
      }
      // Verlaengerung
      if (!nurFilter || nurFilter.test("verlaengerung")) {
        const { ctx, page, fehler } = await oeffne("marketV2", b, h);
        await page.getByTestId("tm-reiter-vertraege").click();
        await page.getByTestId("tm-vertrag").waitFor({ state: "visible", timeout: 30_000 });
        await page.getByTestId("tm-verlaengern").first().click();
        await page.getByTestId("tm-tisch").waitFor({ state: "visible", timeout: 30_000 });
        await page.getByTestId("wk-block").waitFor({ state: "visible", timeout: 30_000 }).catch(() => console.log("[screenshot-wk] Klausel-Block fehlt im Verlaengerungs-Dialog"));
        await page.waitForTimeout(1500);
        await knipse(page, `app-verlaengerung-${n}.png`, fehler);
        await ctx.close();
      }
    }
  } finally {
    await browser?.close().catch(() => undefined);
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* Server schon weg */
    }
    await fs.rm(SQLITE_PATH, { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
