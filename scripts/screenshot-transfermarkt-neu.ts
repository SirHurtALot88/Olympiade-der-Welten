// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Transfermarkt neu (18.11.) im Transferfenster eines Wegwerf-Battle-Saves.
// Baut eine Wegwerf-SQLite (Neues Spiel, Liga-Setup-Draft), macht ein paar freie Spieler "voll gescoutet",
// startet den Dev-Server (Auto-Export AUS) gegen genau diese Datei, nimmt Markt, Kauf, Verkauf, Verträge auf
// und loescht Datei und Server danach.
//
// AUFRUF: npx tsx scripts/screenshot-transfermarkt-neu.ts
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

const PORT = process.env.SCREENSHOT_PORT ?? "3216";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "transfermarkt-neu-18-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-transfermarkt-neu-${process.pid}.sqlite`);

async function baueSave(): Promise<{ saveId: string; teamId: string; gescoutet: string[] }> {
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
    logPrefix: "[screenshot-tm]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  let zustand = applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [teamId], frankyTeamIds: [] });
  // Drei freie Spieler mit hoher Hockey-Eignung voll scouten (Sicherheit 100).
  const imKader = new Set(zustand.rosters.map((r) => r.playerId));
  const frei = zustand.players
    .filter((p) => !imKader.has(p.id))
    .sort((a, b) => (b.disciplineRatings?.hockey ?? 0) - (a.disciplineRatings?.hockey ?? 0))
    .slice(0, 3)
    .map((p) => p.id);
  const jetzt = new Date().toISOString();
  zustand = {
    ...zustand,
    seasonState: {
      ...zustand.seasonState,
      scoutIntelByTeamId: {
        ...(zustand.seasonState.scoutIntelByTeamId ?? {}),
        [teamId]: frei.map((playerId) => ({
          playerId,
          teamId,
          seasonId: zustand.season.id,
          source: "watchlist",
          certainty: 100,
          startedAt: jetzt,
          lastTickAt: jetzt,
          ticksCompleted: 4,
        })) as never,
      },
    },
  };
  // Genug Kasse für den Kauf im Bild.
  zustand = { ...zustand, teams: zustand.teams.map((t) => (t.teamId === teamId ? { ...t, cash: 400, budget: Math.max(t.budget, 400) } : t)) };
  persistence.saveSingleplayerState(saveId, zustand);
  return { saveId, teamId, gescoutet: frei };
}

async function istErreichbar(timeoutMs: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const antwort = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return antwort.status < 500;
  } catch {
    return false;
  }
}

function starteDevServer(): ChildProcess {
  console.log("[screenshot-tm] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const kind = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stdout?.on("data", (chunk) => process.stdout.write(`[dev] ${chunk}`));
  kind.stderr?.on("data", (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return kind;
}

async function warteAufServer(timeoutMs: number) {
  const ende = Date.now() + timeoutMs;
  while (Date.now() < ende) {
    if (await istErreichbar(40_000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
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
  const { saveId, teamId, gescoutet } = await baueSave();
  console.log(`[screenshot-tm] Save ${saveId}, Team ${teamId}, gescoutet: ${gescoutet.join(", ")}`);
  const server = starteDevServer();
  let browser: Browser | null = null;
  try {
    await warteAufServer(900_000);
    browser = await chromium.launch();
    const sitzung = async (breite: number, hoehe: number, dsf: number) => {
      const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: dsf });
      const page = await ctx.newPage();
      const fehler: string[] = [];
      page.on("pageerror", (e) => fehler.push(`pageerror: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") fehler.push(`console: ${m.text().slice(0, 200)}`); });
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "marketV2");
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await briefingSchliessen(page);
      await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 45_000 }).catch(async () => {
        console.log("[screenshot-tm] Markt nicht direkt offen, klicke in der Schiene");
        await page.screenshot({ path: path.join(OUTPUT_DIR, "debug-vor-klick.png") });
        await page.getByTestId("foundation-nav-marketV2").click({ timeout: 20_000 });
      });
      await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 90_000 });
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 90_000 }).catch(async (e) => {
        await page.screenshot({ path: path.join(OUTPUT_DIR, "debug.png") });
        console.log("[screenshot-tm] DEBUG Text:", (await page.locator(".tmk").innerText().catch(() => "?")).slice(0, 600).replace(/\n/g, " | "));
        console.log("[screenshot-tm] DEBUG Konsole:", fehler.slice(0, 6).join(" || "));
        throw e;
      });
      await page.waitForTimeout(1500);
      return { ctx, page, fehler };
    };
    const ziel = (name: string) => path.join(OUTPUT_DIR, name);
    const messen = async (page: Page, tag: string, fehler: string[]) => {
      const mass = await page.evaluate(() => {
        const wurzel = document.querySelector<HTMLElement>(".tmk");
        return { scrollH: document.documentElement.scrollHeight, innerH: window.innerHeight, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, kasten: wurzel ? wurzel.getBoundingClientRect().toJSON() : null };
      });
      console.log(`[screenshot-tm] ${tag}: ${JSON.stringify(mass)}`);
      if (fehler.length) console.log(`[screenshot-tm] ${tag} Konsole: ${fehler.slice(0, 4).join(" || ")}`);
    };
    const GROESSEN = [[2560, 1440, 1, "2560"], [1920, 1080, 1, "1920"]] as const;

    // --- Kaufphase: Markt (ungescoutet / gescoutet), Kauf bis zum Abschluss -----------------------------------
    for (const [breite, hoehe, dsf, tag] of GROESSEN) {
      const { ctx, page, fehler } = await sitzung(breite, hoehe, dsf);
      await page.getByTestId("tm-disziplin-hockey").click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: ziel(`01-markt-ungescoutet-${tag}.png`) });
      const gescoutetZeile = page.locator(`[data-testid="tm-zeile"][data-player-id="${gescoutet[0]}"]`);
      if (await gescoutetZeile.count()) {
        await gescoutetZeile.first().click();
      } else {
        for (let i = 0; i < 400 && !(await page.locator(`[data-player-id="${gescoutet[0]}"]`).count()); i += 1) {
          const weiter = page.getByLabel("Nächstes Blatt");
          if (await weiter.isDisabled().catch(() => true)) break;
          await weiter.click();
        }
        await page.locator(`[data-player-id="${gescoutet[0]}"]`).first().click().catch(() => undefined);
      }
      await page.waitForTimeout(600);
      await page.screenshot({ path: ziel(`02-markt-gescoutet-${tag}.png`) });
      // Kauf: der Billigste der Liste (bezahlbar), verhandeln, abschließen.
      await page.getByTestId("tm-sort-abloese").click();
      await page.waitForTimeout(500);
      await page.locator('[data-testid="tm-zeile"]').first().click();
      await page.getByTestId("tm-verhandeln-oeffnen").click();
      await page.getByTestId("tm-tisch").waitFor({ state: "visible", timeout: 30_000 });
      await page.getByTestId("tm-verhandeln").waitFor({ state: "visible" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: ziel(`03-kauf-angebot-${tag}.png`) });
      await page.getByTestId("tm-verhandeln").click();
      await page.getByTestId("tm-antwort").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: ziel(`04-kauf-antwort-${tag}.png`) });
      const abschliessen = page.getByTestId("tm-abschliessen");
      if (await abschliessen.isEnabled().catch(() => false)) {
        await abschliessen.click();
        await page.getByTestId("tm-tisch").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
        await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 90_000 });
        await page.waitForTimeout(2500);
        await page.screenshot({ path: ziel(`05-kauf-erfolgreich-${tag}.png`) });
      } else {
        console.log(`[screenshot-tm] ${tag}: Abschluss gesperrt`);
        await page.getByLabel("Schließen").first().click();
      }
      await messen(page, `${tag} markt`, fehler);
      await ctx.close();
    }

    // --- Verkaufsfenster öffnen (Saisonende-Management), dann Verkauf mit Erlös und Verträge -----------------
    const persistence = createPersistenceService();
    const stand = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(saveId, { ...stand.gameState, gamePhase: "transfer_sell_phase" });
    for (const [breite, hoehe, dsf, tag] of GROESSEN) {
      const { ctx, page, fehler } = await sitzung(breite, hoehe, dsf);
      await page.getByTestId("tm-reiter-verkauf").click();
      await page.getByTestId("tm-verkauf-erloes").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: ziel(`06-verkauf-erloes-${tag}.png`) });
      if (tag === "1920") {
        const verkaufen = page.getByTestId("tm-verkaufen");
        if (await verkaufen.isEnabled().catch(() => false)) {
          await verkaufen.click();
          await page.getByTestId("tm-verkauf-bestaetigen").click();
          await page.waitForTimeout(3500);
          await page.screenshot({ path: ziel(`07-verkauf-erledigt-${tag}.png`) });
        } else console.log("[screenshot-tm] Verkaufen gesperrt");
      }
      await page.getByTestId("tm-reiter-vertraege").click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: ziel(`08-vertraege-${tag}.png`) });
      await messen(page, `${tag} verkauf`, fehler);
      await ctx.close();
    }
    // Verkaufsfenster zu (Kaufphase): die Seite sagt es klar. Dazu der Vergleich.
    persistence.saveSingleplayerState(saveId, { ...persistence.getSaveById(saveId)!.gameState, gamePhase: "season_active" });
    {
      const { ctx, page } = await sitzung(1920, 1080, 1);
      await page.getByTestId("tm-reiter-verkauf").click();
      await page.getByTestId("tm-verkauf-fenster-zu").waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await page.screenshot({ path: ziel("09-verkauf-fenster-zu-1920.png") });
      await page.getByTestId("tm-reiter-markt").click();
      await page.waitForTimeout(400);
      const pins = page.locator(".pinb");
      await pins.nth(0).click();
      await pins.nth(1).click();
      await pins.nth(2).click();
      await page.getByTestId("tm-vergleich-oeffnen").click();
      await page.getByTestId("tm-vergleich").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: ziel("10-vergleich-1920.png") });
      await ctx.close();
    }
  } finally {
    await browser?.close();
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    for (const endung of ["", "-wal", "-shm"]) await fs.rm(`${SQLITE_PATH}${endung}`, { force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
