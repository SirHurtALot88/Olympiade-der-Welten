// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS fuer den UX-Umbau Draft + Transfermarkt (19.11., PR A/B): der GEBAUTE Stand beider Drei-Spalten-Seiten bei
// 1920x1080 und 1710x1112, zum Vergleich mit den Mockup-Bildern in docs/design/ux-review-draft-markt-19-11/. Baut eine Wegwerf-SQLite
// mit einem neuen Battle-Mode-Spiel (solo_1), startet den Dev-Server (Auto-Export AUS) und schreibt die Bilder nach
// docs/design/ux-umbau-19-11/. Vorbild: scripts/screenshot-draft-mensch-ablauf.ts.
//
// AUFRUF: npx tsx scripts/screenshot-ux-umbau-draft-markt.ts            (Draft)
//         NUR_MARKT=1 npx tsx scripts/screenshot-ux-umbau-draft-markt.ts  (Transfermarkt, eigener Spielstand nach dem Draft)
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
const OUT = path.join(process.cwd(), "docs", "design", "ux-umbau-19-11");
const SQLITE_PATH = process.env.SHOT_SQLITE ?? path.join(os.tmpdir(), `oly-ux-umbau-${process.pid}.sqlite`);

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


const NUR_MOCKUP = false;
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
    page.on("pageerror", (e) => console.log(`[shot] PAGEERROR ${String(e).slice(0, 400)}`));
    page.on("console", (m) => { if (m.type() === "error") console.log(`[shot] CONSOLE-ERROR ${m.text().slice(0, 300)}`); });
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
      await page.getByRole("button", { name: "Pause" }).click();
      await page.waitForTimeout(2500);
      await shot("umbau-01-draft-ki-am-zug.png");
      await schritt("top3 der KI auswaehlen (E5)", async () => {
        await page.getByTestId("draft-top3-karte").nth(1).hover();
        await shot("umbau-02-draft-ki-top3-hover.png");
        await page.getByTestId("draft-top3-karte").nth(1).click();
        await shot("umbau-03-draft-ki-top3-ausgewaehlt.png");
        await page.getByTestId("draft-top3-karte").nth(1).click();
        await page.getByTestId("draft-profil").waitFor({ state: "visible", timeout: 30_000 });
        await shot("umbau-04-draft-ki-top3-zweiter-klick-profil.png");
        await page.keyboard.press("Escape");
        await page.getByTestId("draft-profil").waitFor({ state: "hidden", timeout: 10_000 });
      });
      await schritt("danach am zug portrait", async () => {
        await page.getByTestId("draft-danach-portrait").first().click();
        await shot("umbau-05-draft-portrait-ausgewaehlt.png");
      });
      await page.waitForFunction(() => { const b = document.querySelector<HTMLButtonElement>('[data-testid="draft-vor-zu-meinem-pick"]'); return !b || !b.disabled; }, undefined, { timeout: 600_000 });
      if ((await page.getByTestId("draft-vor-zu-meinem-pick").count()) > 0) await page.getByTestId("draft-vor-zu-meinem-pick").click();
      await page.waitForFunction(() => !document.querySelector('[data-testid="draft-vor-zu-meinem-pick"]'), undefined, { timeout: 900_000 });
      await page.waitForFunction(() => !document.querySelector(".fk.pick, .fk.raus"), undefined, { timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      await shot("umbau-10-draft-ich-bin-dran-vorschlag-1.png");
      await page.setViewportSize({ width: 1710, height: 1112 });
      await shot("umbau-10b-draft-ich-bin-dran-1710x1112.png");
      await page.setViewportSize({ width: 1920, height: 1080 });
      await schritt("hover zeile", async () => {
        await page.getByTestId("draft-zeile").nth(4).hover();
        await shot("umbau-11-draft-zeile-hover.png");
      });
      await schritt("vorschlag 2 ausgewaehlt, zweiter klick = profil", async () => {
        await page.getByTestId("draft-top3-karte").nth(1).click();
        await shot("umbau-12-draft-vorschlag-2-ausgewaehlt.png");
        await page.getByTestId("draft-top3-karte").nth(1).click();
        await page.getByTestId("draft-profil").waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(2500);
        await shot("umbau-13-draft-zweiter-klick-profil.png");
        await page.keyboard.press("Escape");
        await page.getByTestId("draft-profil").waitFor({ state: "hidden", timeout: 10_000 });
      });
      await schritt("zeile ausgewaehlt, Tastatur", async () => {
        await page.getByTestId("draft-zeile").nth(4).click({ position: { x: 500, y: 20 } });
        await shot("umbau-14-draft-zeile-ausgewaehlt-picken-profil.png");
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(300);
        await shot("umbau-15-draft-pfeil-runter.png");
        await page.keyboard.press("Enter");
        await page.getByTestId("draft-profil").waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(2500);
        await shot("umbau-16-draft-enter-profil.png");
        await page.keyboard.press("Escape");
        await page.getByTestId("draft-profil").waitFor({ state: "hidden", timeout: 10_000 });
      });
      await schritt("nicht picken", async () => {
        await shot("umbau-20-draft-nicht-picken-fertig-gesperrt.png");
        await page.getByTestId("draft-auslassen").click();
        await page.getByTestId("draft-auslassen-dialog").waitFor({ state: "visible", timeout: 10_000 });
        await shot("umbau-21-draft-pick-auslassen-dialog.png");
        await page.keyboard.press("Escape");
        await page.getByTestId("draft-ueberspringen-block").click();
        await page.getByTestId("draft-skip-dialog").waitFor({ state: "visible", timeout: 10_000 });
        await shot("umbau-22-draft-ueberspringen-dialog.png");
        await page.keyboard.press("Escape");
      });
      await schritt("pick", async () => {
        await page.getByTestId("draft-mein-picken").click();
        await page.waitForTimeout(6000);
        await shot("umbau-30-draft-nach-pick.png");
        await page.getByTestId("draft-zeile").nth(1).click();
        await page.waitForTimeout(600);
        await shot("umbau-32-draft-nach-pick-ausgewaehlt-mein-kader.png");
        await page.setViewportSize({ width: 1710, height: 1112 });
        await shot("umbau-32b-draft-nach-pick-1710x1112.png");
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.getByTestId("mein-kader-spieler").first().click();
        await page.waitForTimeout(3500);
        await shot("umbau-31-draft-kader-klick-profil.png");
        await page.getByTestId("draft-profil-zu").click();
      });
      // Draft zu Ende bringen, damit der Markt mit Kader zu sehen ist.
      await schritt("draft fertig", async () => {
        await page.getByTestId("draft-ueberspringen").click();
        await page.getByTestId("draft-skip-b").click();
        await page.waitForTimeout(90_000);
        await shot("umbau-40-draft-nach-auto-draft.png");
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
        await shot("umbau-50-markt.png");
        await page.setViewportSize({ width: 1710, height: 1112 });
        await shot("umbau-50b-markt-1710x1112.png");
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.getByTestId("tm-zeile").nth(3).hover();
        await shot("umbau-51-markt-zeile-hover.png");
        await page.getByTestId("tm-zeile").nth(3).click({ position: { x: 400, y: 20 } });
        await shot("umbau-52-markt-zeile-ausgewaehlt.png");
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(300);
        await shot("umbau-53-markt-pfeil-runter.png");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2500);
        await shot("umbau-54-markt-enter-profil.png");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(800);
        await page.getByTestId("tm-buehne").click();
        await page.waitForTimeout(2500);
        await shot("umbau-55-markt-buehne-klick-profil.png");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(800);
        await page.getByTestId("tm-reiter-verkauf").click();
        await page.waitForTimeout(4000);
        await shot("umbau-60-markt-verkauf-eigener-kader.png");
        await page.getByTestId("tm-reiter-vertraege").click();
        await page.waitForTimeout(3000);
        await shot("umbau-61-markt-vertraege.png");
      });
    }
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
