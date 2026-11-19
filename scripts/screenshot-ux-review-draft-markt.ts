// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS fuer das UX-Review Draft + Transfermarkt (19.11.): Ist-Stand beider Drei-Spalten-Seiten bei
// 1920x1080 (ist-*.png) und danach das Mockup public/mockups/ux-draft-markt-19-11.html (mockup-*.png). Baut eine Wegwerf-SQLite
// mit einem neuen Battle-Mode-Spiel (solo_1), startet den Dev-Server (Auto-Export AUS) und schreibt die Bilder nach
// docs/design/ux-review-draft-markt-19-11/. Vorbild: scripts/screenshot-draft-mensch-ablauf.ts.
//
// AUFRUF: npx tsx scripts/screenshot-ux-review-draft-markt.ts            (Ist-Stand Draft + Mockup)
//         NUR_MARKT=1 npx tsx scripts/screenshot-ux-review-draft-markt.ts  (Ist-Stand Transfermarkt, eigener Spielstand nach dem Draft)
//         NUR_MOCKUP=1 npx tsx scripts/screenshot-ux-review-draft-markt.ts (nur das Mockup, ohne Spielstand)
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus, kickoffLeagueSetupDraft } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";

const PORT = process.env.SCREENSHOT_PORT ?? "3231";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "ux-review-draft-markt-19-11");
const SQLITE_PATH = process.env.SHOT_SQLITE ?? path.join(os.tmpdir(), `oly-ux-review-${process.pid}.sqlite`);

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


const NUR_MOCKUP = process.env.NUR_MOCKUP === "1";
// NUR_MARKT=1: nur den Transfermarkt aufnehmen. Der Markt braucht einen Spielstand NACH dem Draft (waehrend der Draft laeuft,
// gehoert die Seite dem Draft); deshalb ein zweiter Spielstand, dessen Draft komplett von der KI gefahren ist (Vorbild:
// scripts/screenshot-transfermarkt-neu.ts).
const NUR_MARKT = process.env.NUR_MARKT === "1";

async function baueMarktSave() {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[shot]" });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  const zustand = applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [teamId], frankyTeamIds: [] });
  persistence.saveSingleplayerState(saveId, zustand);
  console.log(`[shot] Markt-Spielstand: ${saveId}, Team ${teamId}`);
  return { saveId, teamId };
}

async function mockupBilder(page: Page) {
  const m = `${BASE_URL}/mockups/ux-draft-markt-19-11.html`;
  const bild = async (name: string) => {
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log(`[shot] ${name}`);
  };
  await page.goto(`${m}#draft`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(1200);
  await bild("mockup-01-draft-ausgewaehlt.png");
  await page.locator('[data-zeile]').nth(3).hover();
  await bild("mockup-02-draft-hover-hinweis.png");
  await page.locator('[data-fav]').nth(1).click();
  await bild("mockup-03-draft-vorschlag-gewaehlt.png");
  await page.locator('[data-fav]').nth(1).click();
  await bild("mockup-04-draft-profil-offen.png");
  await page.keyboard.press("Escape");
  await page.locator('[data-platz]').first().click();
  await bild("mockup-05-draft-kader-klick-profil.png");
  await page.keyboard.press("Escape");
  // Nicht picken: Auslassen, Fertig (gesperrt / frei mit Bestaetigung), Ueberspringen
  await page.locator('[data-np="fertig"]').hover();
  await bild("mockup-10-draft-nicht-picken-fertig-gesperrt.png");
  await page.locator('[data-np="auslassen"]').click();
  await bild("mockup-11-draft-pick-auslassen-dialog.png");
  await page.keyboard.press("Escape");
  await page.locator('#b-schalt button[data-g="1"]').click();
  await bild("mockup-12-draft-kader-9-fertig-frei.png");
  await page.locator('[data-np="fertig"]').click();
  await bild("mockup-13-draft-ich-bin-fertig-dialog.png");
  await page.keyboard.press("Escape");
  await page.locator('[data-np="skip"]').click();
  await bild("mockup-14-draft-ueberspringen-dialog.png");
  await page.keyboard.press("Escape");
  await page.goto(`${m}#markt`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await bild("mockup-06-markt-ausgewaehlt.png");
  await page.locator('[data-zeile]').nth(2).click();
  await bild("mockup-07-markt-andere-wahl.png");
  await page.keyboard.press("Enter");
  await bild("mockup-08-markt-profil-per-enter.png");
  await page.keyboard.press("Escape");
  await page.goto(`${m}#regel`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await bild("mockup-09-klickregel.png");
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const { saveId, teamId } = NUR_MOCKUP ? { saveId: "", teamId: "" } : NUR_MARKT ? await baueMarktSave() : await baueSave();
  if (NUR_MOCKUP) process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const server = startDevServer();
  try {
    await warteAufServer();
    const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page: Page = await ctx.newPage();
    if (!NUR_MOCKUP) {
      const schliesseBriefing = async () => {
        const laeuft = await page.getByTestId("season-briefing-backdrop").isVisible().catch(() => false);
        if (!laeuft) return;
        await page.getByRole("button", { name: /^(Später|Erledigt)$/ }).first().click().catch(() => undefined);
        await page.getByTestId("season-briefing-backdrop").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
      };
      const shot = async (name: string) => {
        await schliesseBriefing();
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUT, name) });
        console.log(`[shot] ${name}`);
      };
      const schritt = async (name: string, f: () => Promise<void>) => {
        try {
          await f();
        } catch (e) {
          console.log(`[shot] SCHRITT FEHLGESCHLAGEN ${name}: ${String(e).slice(0, 300)}`);
        }
      };
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", teamId);
      if (!NUR_MARKT) {
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByTestId("draft-hinweis").waitFor({ state: "visible", timeout: 180_000 });
      await schliesseBriefing();
      await page.getByTestId("draft-hinweis-zum-draft").click();
      await page.getByTestId("draft-start").waitFor({ state: "visible", timeout: 60_000 });
      await page.getByTestId("draft-start-spielen").click();
      await page.getByTestId("draft-vor-zu-meinem-pick").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(2500);
      await shot("ist-01-draft-ki-am-zug.png");
      await schritt("zeile waehrend KI", async () => {
        await page.getByTestId("draft-zeile").nth(2).click();
        await shot("ist-02-draft-ki-am-zug-zeile-geklickt.png");
      });
      await page.getByTestId("draft-vor-zu-meinem-pick").click();
      await page.waitForFunction(() => !document.querySelector('[data-testid="draft-vor-zu-meinem-pick"]'), undefined, { timeout: 900_000 });
      await page.waitForTimeout(1500);
      await shot("ist-03-draft-ich-bin-dran.png");
      await schritt("top3 klick", async () => {
        await page.getByTestId("draft-top3-karte").nth(1).click({ position: { x: 20, y: 60 } });
        await shot("ist-04-draft-vorschlag-2-geklickt.png");
        await page.getByTestId("draft-top3-karte").nth(1).click({ position: { x: 20, y: 60 } });
        await shot("ist-05-draft-vorschlag-2-nochmal-geklickt.png");
      });
      await schritt("zeile klick", async () => {
        await page.getByTestId("draft-zeile").nth(4).click({ position: { x: 500, y: 20 } });
        await shot("ist-06-draft-zeile-geklickt.png");
        await page.getByTestId("draft-zeile").nth(4).click({ position: { x: 500, y: 20 } });
        await shot("ist-07-draft-zeile-nochmal-geklickt.png");
      });
      await schritt("pick", async () => {
        await page.getByTestId("draft-mein-picken").click();
        await page.waitForTimeout(6000);
        await shot("ist-08-draft-nach-pick-kader.png");
        await page.getByTestId("draft-kader-spieler").first().click();
        await page.waitForTimeout(3500);
        await shot("ist-09-draft-kader-klick-profil.png");
        await page.getByTestId("draft-profil-zu").click();
      });
      // Draft zu Ende bringen, damit der Markt mit Kader zu sehen ist.
      await schritt("draft fertig", async () => {
        await page.getByTestId("draft-ueberspringen").click();
        await page.getByTestId("draft-skip-b").click();
        await page.waitForTimeout(90_000);
        await shot("ist-10-draft-nach-auto-draft.png");
      });
      }
      if (NUR_MARKT) await schritt("markt", async () => {
        const mu = new URL("/foundation", BASE_URL);
        mu.searchParams.set("view", "marketV2");
        mu.searchParams.set("saveId", saveId);
        mu.searchParams.set("team", teamId);
        await page.goto(mu.toString(), { waitUntil: "domcontentloaded", timeout: 600_000 });
        await schliesseBriefing();
        await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 60_000 }).catch(async () => {
          await page.getByTestId("foundation-nav-marketV2").click({ timeout: 20_000 });
        });
        await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 300_000 });
        await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 120_000 });
        await page.waitForTimeout(2500);
        await shot("ist-11-markt.png");
        await page.getByTestId("tm-zeile").nth(3).click({ position: { x: 400, y: 20 } });
        await shot("ist-12-markt-zeile-geklickt.png");
        await page.getByTestId("tm-zeile").nth(3).click({ position: { x: 400, y: 20 } });
        await page.waitForTimeout(1500);
        await shot("ist-13-markt-zeile-nochmal-geklickt.png");
        await page.getByTestId("tm-reiter-verkauf").click();
        await page.waitForTimeout(4000);
        await shot("ist-14-markt-verkauf-eigener-kader.png");
        await page.getByTestId("tm-reiter-vertraege").click();
        await page.waitForTimeout(3000);
        await shot("ist-15-markt-vertraege.png");
      });
    }
    if (!NUR_MARKT) await mockupBilder(page).catch((e) => console.log(`[shot] MOCKUP FEHLGESCHLAGEN: ${String(e).slice(0, 300)}`));
    await browser.close();
  } finally {
    try {
      if (server) process.kill(-server.pid!, "SIGTERM");
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
