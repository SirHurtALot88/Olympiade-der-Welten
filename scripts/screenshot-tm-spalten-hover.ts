// ===================================================================================
// SPALTEN ZIEHEN, HOVER-KARTE, GROSSES PROFIL (19.11.): Wegwerf-SQLite mit einem Markt-Save UND einem Draft-Save,
// Dev-Server (Auto-Export AUS) gegen genau diese Datei, Aufnahmen 1920x1080 nach docs/design/tm-spalten-hover-19-11/.
// AUFRUF: npx tsx scripts/screenshot-tm-spalten-hover.ts
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

const PORT = process.env.SCREENSHOT_PORT ?? "3218";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "tm-spalten-hover-19-11");
const SQLITE_PATH = path.join(os.tmpdir(), `oly-tm-spalten-${process.pid}.sqlite`);
process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
process.env.OLY_AUTO_EXPORT_SAVES = "0";
process.env.OLY_AUTO_EXPORT_PUSH = "0";
const FRANKY = "franky_remote_placeholder";

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


async function baueDraft(): Promise<{ saveId: string; chris: string }> {
  const { starteLigaDraft, laufeKiZuege } = await import("@/lib/draft/liga-draft-dienst");
  const persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "draft-spalten-aufnahme" });
  const saveId = frisch.saveId;
  const nachKasse = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0));
  const chris = nachKasse[0]!.teamId;
  const franky = nachKasse[1]!.teamId;
  const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
  settings[chris] = { ...settings[chris]!, controlMode: "manual", ownerId: "user_local" };
  settings[franky] = { ...settings[franky]!, controlMode: "manual", ownerId: FRANKY };
  persistence.saveSingleplayerState(saveId, { ...frisch.gameState, seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings } });
  starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [chris, franky] });
  laufeKiZuege({ persistence, saveId, maxPicks: 8 });
  return { saveId, chris };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  for (const x of ["", "-wal", "-shm"]) await fs.rm(`${SQLITE_PATH}${x}`, { force: true });
  const markt = await baueSave();
  const draft = await baueDraft();
  const server = starteDevServer();
  let browser: Browser | null = null;
  try {
    await warteAufServer(900_000);
    browser = await chromium.launch();
    const neu = async () => {
      const ctx = await browser!.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      return { ctx, page };
    };
    const marktOeffnen = async (page: Page) => {
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "marketV2");
      url.searchParams.set("saveId", markt.saveId);
      url.searchParams.set("team", markt.teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await briefingSchliessen(page);
      await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 120_000 });
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForTimeout(1500);
    };
    const breite = (page: Page, id: string) => page.evaluate((i) => document.querySelector<HTMLElement>(`[data-testid="spalten-griff-${i}"]`)!.parentElement!.getBoundingClientRect().width, id);
    const mass = (page: Page, tag: string) => page.evaluate((t) => { const m = document.querySelector<HTMLElement>(".mt.sl")!; return `${t}: seite ${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight} von ${window.innerWidth}x${window.innerHeight}, tabelle scrollW ${m.scrollWidth} clientW ${m.clientWidth}`; }, tag);
    const ziehen = async (page: Page, id: string, dx: number) => {
      const g = await page.getByTestId(`spalten-griff-${id}`).boundingBox();
      await page.mouse.move(g!.x + g!.width / 2, g!.y + g!.height / 2);
      await page.mouse.down();
      await page.mouse.move(g!.x + g!.width / 2 + dx / 2, g!.y + g!.height / 2, { steps: 5 });
      await page.mouse.move(g!.x + g!.width / 2 + dx, g!.y + g!.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    };
    // --- Transfermarkt ---------------------------------------------------------------------------------------
    {
      const { ctx, page } = await neu();
      await marktOeffnen(page);
      await page.getByTestId("tm-portrait").first().hover();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, "01-markt-hover-karte.png") });
      console.log("hover-karte:", await page.getByTestId("portraet-vorschau").count(), (await page.getByTestId("portraet-vorschau-achsen").innerText()).replace(/\n/g, " "));
      await page.mouse.move(5, 5);
      const vorher = await breite(page, "por");
      await ziehen(page, "por", 140);
      const nachher = await breite(page, "por");
      console.log("portraetbreite px:", vorher, "->", nachher);
      console.log(await mass(page, "nach Ziehen"));
      await page.getByTestId("tm-portrait").first().hover();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, "02-markt-portraet-breit-gezogen.png") });
      await page.mouse.move(5, 5);
      await page.reload({ waitUntil: "domcontentloaded" });
      await briefingSchliessen(page);
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForTimeout(1500);
      const nachReload = await breite(page, "por");
      console.log("nach Reload px:", nachReload);
      await page.screenshot({ path: path.join(OUT, "03-markt-nach-reload-gleiche-breite.png") });
      await ziehen(page, "ax", 400);
      console.log(await mass(page, "sehr breit"));
      await page.screenshot({ path: path.join(OUT, "04-markt-sehr-breit-scrollt-tabelle.png") });
      await page.getByTestId("tm-spalten-zuruecksetzen").click();
      await page.waitForTimeout(400);
      console.log("nach Zuruecksetzen px:", await breite(page, "por"));
      // Großes Profil: Zeile wählen, nochmal klicken.
      await page.getByTestId("tm-zeile").nth(1).click();
      await page.getByTestId("tm-zeile").nth(1).click();
      await page.getByTestId("tm-profil").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(OUT, "05-markt-grosses-profil.png") });
      await page.keyboard.press("Escape");
      console.log("profil nach Esc sichtbar:", await page.getByTestId("tm-profil").count());
      await ctx.close();
    }
    // --- Draft-Brett -------------------------------------------------------------------------------------------
    {
      const { ctx, page } = await neu();
      await page.goto(`${BASE_URL}/foundation?saveId=${encodeURIComponent(draft.saveId)}&team=${encodeURIComponent(draft.chris)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByTestId("liga-draft-seite").waitFor({ state: "visible", timeout: 120_000 });
      await page.getByTestId("draft-zeile").first().waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForTimeout(1500);
      await page.getByTestId("draft-portrait").first().hover();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, "06-draft-hover-karte.png") });
      await page.mouse.move(5, 5);
      await ziehen(page, "por", 120);
      console.log(await mass(page, "draft breit"));
      await page.screenshot({ path: path.join(OUT, "07-draft-portraet-breit.png") });
      await ctx.close();
    }
  } finally {
    await browser?.close().catch(() => undefined);
    try { process.kill(-server.pid!, "SIGTERM"); } catch { /* */ }
    for (const x of ["", "-wal", "-shm"]) await fs.rm(`${SQLITE_PATH}${x}`, { force: true });
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
