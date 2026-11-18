// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Saisonstand "Disziplin-Matrix" im Duell-Save (Battle, Liga-Split)
// mitten in der Saison. Baut eine Wegwerf-SQLite, spielt N Spieltage per Auto-Run, startet den
// Dev-Server (Auto-Export AUS) gegen genau diese Datei und schreibt die Bilder app-n-01..04.
//
// AUFRUF: npx tsx scripts/screenshot-saisonstand-matrix-duell.ts [spieltage=11]
// ===================================================================================
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";

const PORT = process.env.SCREENSHOT_PORT ?? "3200";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "saisonstand-modern-17-11");
// OLY_SHOT_BEHALTEN=1: feste Wegwerf-Datei, die nach dem Lauf stehen bleibt und beim naechsten Lauf wiederverwendet wird (spart das Spielen der Spieltage).
const BEHALTEN = process.env.OLY_SHOT_BEHALTEN === "1";
const SQLITE_PATH = path.join(os.tmpdir(), BEHALTEN ? "oly-saisonstand-r2-behalten.sqlite" : `oly-saisonstand-matrix-screenshot-${process.pid}.sqlite`);
const IDS_PATH = `${SQLITE_PATH}.ids.json`;
const SPIELTAGE = Number(process.argv[2] ?? 11);
// "r2" als dritter Parameter: Runde-2-Bilder (Tabelle mit Sport-Spalten, Showdown, Phone-Tabelle) statt der Matrix-Bilder.
const RUNDE2 = process.argv[3] === "r2";

async function baueSave(): Promise<{ saveId: string; teamId: string }> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[screenshot-matrix]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  persistence.saveSingleplayerState(
    saveId, applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  for (let i = 0; i < SPIELTAGE; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      { saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
      persistence,
    );
    if (!lauf.ok) { console.log(`[screenshot-matrix] ${matchdayId} blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence,
    );
    if (!adv.ok || !adv.applied) { console.log(`[screenshot-matrix] Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`); break; }
    console.log(`[screenshot-matrix] ${matchdayId} gespielt (${i + 1}/${SPIELTAGE})`);
  }
  return { saveId, teamId };
}

async function isServerReachable(timeoutMs: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return response.status < 500;
  } catch {
    return false;
  }
}

function startDevServer(): ChildProcessWithoutNullStreams {
  console.log("[screenshot-matrix] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT: PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return child;
}

async function dismissSeasonBriefingIfOpen(page: Page, timeoutMs: number) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  const visible = await backdrop.isVisible().catch(() => false);
  if (!visible) return;
  const doneButton = page.getByRole("button", { name: /^Erledigt$/ });
  const laterButton = page.getByRole("button", { name: /^Später$/ });
  if (await doneButton.isVisible().catch(() => false)) {
    await doneButton.click();
  } else if (await laterButton.isVisible().catch(() => false)) {
    await laterButton.click();
  }
  await backdrop.waitFor({ state: "hidden", timeout: timeoutMs }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReachable(40_000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
}

async function main() {
  let ids: { saveId: string; teamId: string } | null = null;
  if (BEHALTEN) ids = await fs.readFile(IDS_PATH, "utf8").then((t) => JSON.parse(t) as { saveId: string; teamId: string }).catch(() => null);
  if (!ids) {
    await fs.rm(SQLITE_PATH, { force: true });
    ids = await baueSave();
    if (BEHALTEN) await fs.writeFile(IDS_PATH, JSON.stringify(ids));
  }
  const { saveId, teamId } = ids;
  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(900_000);
    browser = await chromium.launch();
    const aufnehmen = async (breite: number, hoehe: number, datei: string, vorher: (p: Page) => Promise<void>, fullPage = false, clip?: string, matrix = true, dsf = 2) => {
      if (process.env.OLY_SHOT_NUR && !datei.includes(process.env.OLY_SHOT_NUR)) return;
      const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: dsf });
      const page = await ctx.newPage();
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "season-v2");
      url.searchParams.set("saveId", saveId);
      url.searchParams.set("team", teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await dismissSeasonBriefingIfOpen(page, 30_000);
      await page.getByTestId("saisonstand-modern").waitFor({ state: "visible", timeout: 90_000 });
      await page.waitForTimeout(800);
      if (matrix) {
        await page.getByText("Disziplin-Matrix", { exact: true }).first().click();
        await page.getByTestId("ssm-matrix").waitFor({ state: "visible", timeout: 30_000 });
      }
      await vorher(page);
      await page.waitForTimeout(600);
      const ziel = path.join(OUTPUT_DIR, datei);
      if (clip) await page.getByTestId(clip).screenshot({ path: ziel });
      else await page.screenshot({ path: ziel, fullPage });
      console.log(`[screenshot-matrix] ${ziel}`);
      await ctx.close();
    };
    if (RUNDE2) {
      const tab = async (p: Page) => { await p.getByTestId("ssm-zeile").first().waitFor({ state: "visible", timeout: 30_000 }); };
      const showdown = async (p: Page) => { await tab(p); await p.getByTestId("ssm-tab-showdown").click(); };
      const ansicht = async (p: Page, name: string) => { await tab(p); await p.locator(".ssm-ansichten").getByText(name, { exact: true }).click(); await p.waitForTimeout(500); };
      // Abgleich-Bilder gegen das Mockup (1600x900, 16:9)
      await aufnehmen(1600, 900, "app-r2-a1-tabelle-showdown.png", showdown, false, undefined, false);
      await aufnehmen(1600, 900, "app-r2-a2-liga1.png", async (p) => { await tab(p); await p.locator(".bc-reiter").first().click(); await p.waitForTimeout(400); }, false, undefined, false);
      await aufnehmen(1600, 900, "app-r2-a3-spieltag-ergebnisse.png", async (p) => { await ansicht(p, "Spieltage"); }, false, undefined, false);
      await aufnehmen(1600, 900, "app-r2-a4-ansetzungen.png", async (p) => { await ansicht(p, "Spieltage"); await p.getByText("Ansetzungen", { exact: true }).first().click(); await p.waitForTimeout(400); }, false, undefined, false);
      // Chris' Geraete
      await aufnehmen(1710, 1112, "app-r2-01-tabelle-1710.png", tab, false, undefined, false, 2);
      await aufnehmen(1710, 1112, "app-r2-02-showdown-1710.png", showdown, false, undefined, false, 2);
      await aufnehmen(1920, 1080, "app-r2-03-tabelle-1920.png", tab, false, undefined, false, 2);
      await aufnehmen(2560, 1440, "app-r2-04-tabelle-2560.png", tab, false, undefined, false, 1);
      await aufnehmen(2560, 1440, "app-r2-05-showdown-2560.png", showdown, false, undefined, false, 1);
      await aufnehmen(1710, 1112, "app-r2-06-gesamt-1710.png", async (p) => { await tab(p); await p.getByText("Gesamt", { exact: true }).first().click(); await p.waitForTimeout(400); }, false, undefined, false, 2);
      await aufnehmen(1710, 1112, "app-r2-07-matrix-hover-1710.png", async (p) => { await p.locator("td.ssm-zelle[data-bc-tip*='gegen']").nth(40).hover(); await p.waitForTimeout(300); }, false, undefined, true, 2);
      await aufnehmen(412, 900, "app-r2-08-phone-tabelle.png", tab, false, "saisonstand-modern", false, 2);
      await aufnehmen(412, 900, "app-r2-09-phone-showdown.png", async (p) => { await tab(p); await p.getByTestId("ssm-zeile").first().click({ force: true }); await p.getByTestId("ssm-tab-showdown").click({ force: true }); await p.waitForTimeout(500); }, false, "saisonstand-modern", false, 2);
      return;
    }
    await aufnehmen(1600, 900, "app-n-01-matrix-bereiche-stufen.png", async (p) => {
      // Gegenprobe: Pkt-Spalte gegen Summe der Zellen, keine Nachkommastellen.
      const zeilen = await p.locator('[data-testid="ssm-matrix"] tbody tr').evaluateAll((trs) =>
        trs.map((tr) => {
          const zellen = Array.from(tr.querySelectorAll("td.ssm-zelle")).map((td) => (td.textContent ?? "").trim());
          const pkt = (tr.querySelector("td.ssm-matrix__summe")?.textContent ?? "").trim();
          const summe = zellen.reduce((a, z) => a + (/^\d+$/.test(z) ? Number(z) : 0), 0);
          return { team: (tr.querySelector("th")?.textContent ?? "").trim(), pkt, summe, komma: zellen.some((z) => /[.,]/.test(z)), leer: zellen.filter((z) => z === "·").length };
        }),
      );
      for (const z of zeilen) console.log(`[matrix-check] ${z.team}: Pkt=${z.pkt} Summe=${z.summe} komma=${z.komma} leer=${z.leer}${String(z.summe) === z.pkt ? "" : "  <-- ABWEICHUNG"}`);
    });
    await aufnehmen(1600, 900, "app-n-02-matrix-kaderstaerke-stufen.png", async (p) => { await p.getByText("Kaderstärke", { exact: true }).first().click(); });
    await aufnehmen(412, 900, "app-n-03-phone-matrix-stufen.png", async () => undefined);
    await aufnehmen(1600, 900, "app-n-04-teamkarte-duellpunkte.png", async () => undefined, false, "ssm-teamkarte");
  } finally {
    await browser?.close();
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    if (!BEHALTEN) {
      await fs.rm(SQLITE_PATH, { force: true });
      await fs.rm(`${SQLITE_PATH}-wal`, { force: true });
      await fs.rm(`${SQLITE_PATH}-shm`, { force: true });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
