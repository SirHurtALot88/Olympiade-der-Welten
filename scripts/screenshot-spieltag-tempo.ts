// ===================================================================================
// LIVE-CHROMIUM-MESSUNG + SCREENSHOTS "Spieltag-Tempo" (21.11.): Abgabe der Einsatzliste (Sofort-Rueckmeldung,
// Wartezeit), Arena D1 -> D2 (kein Auto-Sprung, Endergebnis bleibt). Baut eine WEGWERF-SQLite (Spieltag 1,
// ein Mensch-Team), startet den Dev-Server (Auto-Export AUS) gegen genau diese Datei.
//
// AUFRUF: npx tsx scripts/screenshot-spieltag-tempo.ts [abgabe|arena|beides]
// Bilder: docs/design/spieltag-tempo-21-11/
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { setTeamCaptain, buildCaptainCandidateProfiles, hasPersistedTeamCaptain } from "@/lib/morale/team-captain-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const MODUS = process.argv[2] ?? "beides";
const OUT = path.join(process.cwd(), "docs", "design", "spieltag-tempo-21-11");
const SQLITE = path.join(os.tmpdir(), `oly-spieltag-tempo-${process.pid}.sqlite`);
const ENDUNGEN = ["", "-wal", "-shm"];

async function baueSave(): Promise<{ saveId: string; teamId: string }> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[tempo]" });
  const teamId = persistence.getSaveById(saveId)!.gameState.teams[0]!.teamId;
  const st = persistence.getSaveById(saveId)!.gameState;
  persistence.saveSingleplayerState(saveId, applyGameModeOwnership(st, { saveMode: "solo_1", chrisTeamIds: [teamId], frankyTeamIds: [] }));
  const st2 = persistence.getSaveById(saveId)!.gameState;
  if (!hasPersistedTeamCaptain(st2, teamId)) {
    const k = buildCaptainCandidateProfiles(st2, teamId)[0] as unknown as { playerId?: string; id?: string } | undefined;
    const pid = k?.playerId ?? k?.id;
    if (pid) persistence.saveSingleplayerState(saveId, setTeamCaptain(st2, teamId, pid));
  }
  return { saveId, teamId };
}

function startDevServer(): ChildProcess {
  const [befehl, args]: [string, string[]] = process.env.OLY_SERVER === "start" ? ["npx", ["next", "start", "-p", PORT]] : ["npm", ["run", "dev"]];
  const child = spawn(befehl, args, {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", () => undefined);
  child.stderr?.on("data", () => undefined);
  return child;
}
async function waitForServer(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store" }); if (r.status < 500) return; } catch { /* warten */ }
    await delay(2000);
  }
  throw new Error("Server nicht erreichbar.");
}
async function dismiss(page: Page) {
  for (const name of [/^Erledigt$/, /^Später$/]) {
    const b = page.getByRole("button", { name });
    if (await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => undefined);
  }
  await page.waitForTimeout(300);
}
const jetzt = () => Date.now();

async function abgabe(page: Page, ids: { saveId: string; teamId: string }) {
  const url = new URL("/foundation", BASE_URL);
  url.searchParams.set("view", "lineup-v2");
  url.searchParams.set("team", ids.teamId);
  url.searchParams.set("saveId", ids.saveId);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 400_000 });
  await dismiss(page);
  await page.getByTestId("elm-feld").waitFor({ state: "visible", timeout: 150_000 }).catch(async () => {
    console.log(`[tempo] elm-feld fehlt. URL ${page.url()} Text: ${(await page.locator("body").innerText().catch(() => "?")).replace(/\s+/g, " ").slice(0, 500)}`);
    await page.screenshot({ path: path.join(OUT, "00-fehler.png") });
    throw new Error("elm-feld fehlt");
  });
  await page.waitForTimeout(3000);
  await dismiss(page);
  for (let i = 0; i < 3; i += 1) {
    const fuell = page.getByRole("button", { name: /Auffüllen/ }).first();
    if (await fuell.isEnabled().catch(() => false)) { await fuell.click(); await page.waitForTimeout(3500); }
    const reiter = page.locator(".bc-reiter").nth(1);
    if (await reiter.isVisible().catch(() => false)) { await reiter.click(); await page.waitForTimeout(600); }
  }
  const knopf = page.getByTestId("foundation-global-next-button");
  console.log(`[tempo] Abgabe-Knopf vor Klick: "${(await knopf.innerText()).replace(/\s+/g, " ")}"`);
  await page.screenshot({ path: path.join(OUT, "01-abgabe-vor-klick.png") });
  page.once("dialog", (d) => void d.accept());
  const t0 = jetzt();
  await knopf.click();
  await page.waitForTimeout(150);
  const sofort = (await knopf.innerText().catch(() => "?")).replace(/\s+/g, " ");
  const gesperrt = await knopf.isDisabled().catch(() => false);
  console.log(`[tempo] 150 ms nach Klick: "${sofort}" gesperrt=${gesperrt}`);
  await page.screenshot({ path: path.join(OUT, "02-abgabe-speichert.png") });
  await page.waitForFunction(() => /Zur Arena/i.test(document.querySelector('[data-testid="foundation-global-next-button"]')?.textContent ?? ""), undefined, { timeout: 240_000 });
  console.log(`[tempo] Klick bis "Zur Arena": ${jetzt() - t0} ms`);
  await page.screenshot({ path: path.join(OUT, "03-abgabe-fertig.png") });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  for (const e of ENDUNGEN) await fs.rm(SQLITE + e, { force: true });
  const ids = await baueSave();
  const server = startDevServer();
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    await waitForServer(300_000);
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (/\[tempo\]/.test(m.text())) console.log(m.text()); });
    if (MODUS === "abgabe" || MODUS === "beides") await abgabe(page, ids);
    if (MODUS === "arena" || MODUS === "beides") {
      await page.getByTestId("foundation-global-next-button").click().catch(() => undefined);
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(OUT, "04-arena-offen.png") });
      console.log(`[tempo] URL: ${page.url()}`);
      console.log(`[tempo] Text: ${(await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 600)}`);
    }
    await ctx.close();
  } finally {
    await browser.close().catch(() => undefined);
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    await delay(800);
    for (const e of ENDUNGEN) await fs.rm(SQLITE + e, { force: true });
  }
  process.exit(0);
}
void main().catch((e) => { console.error(e); process.exit(1); });
