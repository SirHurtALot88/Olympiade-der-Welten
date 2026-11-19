// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Draft-Ablauf fuer Menschen (19.11.): Office mit Hinweis -> Draft bei Pick 1 -> Draft spielen ->
// Vor zu meinem Pick -> Profil -> Pick -> Liga & Raenge -> Zurueck ins Office -> zurueck. Baut eine Wegwerf-SQLite mit einem
// neuen Battle-Mode-Spiel (solo_1) ueber den echten Kickoff, startet den Dev-Server (Auto-Export AUS) und schreibt die Bilder.
//
// AUFRUF: npx tsx scripts/screenshot-draft-mensch-ablauf.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { kickoffLeagueSetupDraft } from "@/lib/game/league-setup-draft-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "draft-mensch-ablauf-19-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-draft-ablauf-${process.pid}.sqlite`);

async function baueSave() {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const humanTeamIds = [...preview.chrisTeamIds, ...preview.frankyTeamIds, ...(preview.ramonaTeamIds ?? [])];
  kickoffLeagueSetupDraft({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, excludeTeamIds: humanTeamIds, logPrefix: "[shot]" });
  await delay(4000);
  const gs = persistence.getSaveById(saveId)!.gameState;
  console.log(`[shot] Draft angelegt: Picks ${gs.seasonState.ligaDraft?.verlauf.length} (erwartet 0), Menschen ${humanTeamIds.join(",")}`);
  return { saveId, teamId: humanTeamIds[0]! };
}

function startDevServer(): ChildProcess {
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", () => undefined);
  child.stderr?.on("data", () => undefined);
  return child;
}

async function warteAufServer() {
  const ende = Date.now() + 900_000;
  while (Date.now() < ende) {
    try {
      const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store" });
      if (r.status < 500) return;
    } catch {
      /* noch nicht da */
    }
    await delay(2000);
  }
  throw new Error("Dev-Server nicht erreichbar");
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const { saveId, teamId } = await baueSave();
  const server = startDevServer();
  try {
    await warteAufServer();
    const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page: Page = await ctx.newPage();
    const schliesseBriefing = async () => {
      const laeuft = await page.getByTestId("season-briefing-backdrop").isVisible().catch(() => false);
      if (!laeuft) return;
      const knopf = page.getByRole("button", { name: /^(Später|Erledigt)$/ }).first();
      await knopf.click().catch(() => undefined);
      await page.getByTestId("season-briefing-backdrop").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
    };
    const shot = async (name: string) => {
      await schliesseBriefing();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, name) });
      console.log(`[shot] ${name}`);
    };
    const url = new URL("/foundation", BASE_URL);
    url.searchParams.set("saveId", saveId);
    url.searchParams.set("team", teamId);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
    const briefing = page.getByTestId("season-briefing-backdrop");
    if (await briefing.isVisible().catch(() => false)) await page.getByRole("button", { name: /^(Erledigt|Später)$/ }).first().click().catch(() => undefined);
    // 1) Office mit Hinweis und der Wahl
    await page.getByTestId("draft-hinweis").waitFor({ state: "visible", timeout: 180_000 });
    await page.waitForTimeout(1500);
    await schliesseBriefing();
    await shot("01-office-hinweis-wahl.png");
    // 2) Zum Draft: bei Pick 1, Startwahl
    await schliesseBriefing();
    await page.getByTestId("draft-hinweis-zum-draft").click();
    await page.getByTestId("draft-start").waitFor({ state: "visible", timeout: 60_000 });
    await shot("02-draft-pick-1-startwahl.png");
    // 3) Zurueck ins Office (Hinweis), wieder zum Draft: nichts verloren
    await page.getByTestId("draft-start-office").click();
    await page.getByTestId("draft-hinweis").waitFor({ state: "visible", timeout: 30_000 });
    await shot("03-zurueck-im-office-hinweis.png");
    await page.getByTestId("draft-hinweis-zum-draft").click();
    await page.getByTestId("draft-start").waitFor({ state: "visible", timeout: 30_000 });
    // 4) Draft spielen, Vor zu meinem Pick
    await page.getByTestId("draft-start-spielen").click();
    await page.getByTestId("draft-vor-zu-meinem-pick").waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(2500);
    await shot("04-draft-laeuft-vor-zu-meinem-pick.png");
    await page.getByTestId("draft-vor-zu-meinem-pick").click();
    await page.getByTestId("draft-mein-picken").or(page.getByTestId("draft-zeile").first()).first().waitFor({ state: "visible", timeout: 240_000 });
    // warten, bis man dran ist (Knopf ohne "Vorgemerkt")
    await page.waitForFunction(() => !document.querySelector('[data-testid="draft-vor-zu-meinem-pick"]'), undefined, { timeout: 240_000 });
    await page.waitForTimeout(1500);
    await shot("05-ich-bin-dran.png");
    // 5) Profil ueber dem Draft
    await page.getByTestId("draft-profil-link").first().click();
    await page.getByTestId("draft-profil").waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(3500);
    await shot("06-grosses-spielerprofil-overlay.png");
    await page.getByTestId("draft-profil-zu").click();
    // 6) Wunsch-Stern + Pick
    await page.getByTestId("draft-zeile").first().click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="draft-mein"] button[title="Wunschliste"]').first().click().catch(() => undefined);
    await shot("07-gewaehlt-wunschstern-mein-draft.png");
    await page.getByTestId("draft-mein-picken").click();
    await page.waitForTimeout(2500);
    await shot("08-gepickt-mein-kader-opt.png");
    // 7) Liga & Raenge
    await page.getByTestId("draft-reiter-liga").click();
    await page.getByTestId("draft-liga").waitFor({ state: "visible", timeout: 30_000 });
    await shot("09-liga-und-raenge.png");
    // 8) Zurueck ins Office und wieder zum Draft
    await page.getByTestId("draft-zum-office").click();
    await page.getByTestId("draft-hinweis").waitFor({ state: "visible", timeout: 30_000 });
    await shot("10-office-draft-pausiert-hinweis.png");
    await page.getByTestId("draft-hinweis-zum-draft").click();
    await page.getByTestId("draft-live").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    await shot("11-zurueck-im-draft-nichts-verloren.png");
    // 9) Reload mitten im Draft
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("liga-draft-seite").waitFor({ state: "visible", timeout: 120_000 });
    await shot("12-nach-reload.png");
    await browser.close();
  } finally {
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* schon weg */
    }
  }
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
