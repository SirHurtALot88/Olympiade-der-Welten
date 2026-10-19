// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: PP-Budget rein leistungsbasiert + 0-10-Ergebnis (19.10.).
//
// Baut einen frischen Battle-Save (derselbe Wizard-Pfad wie scripts/e2e-battle-pps-duell.ts),
// spielt ein paar Spieltage per Auto-Run, startet DANACH den lokalen Dev-Server gegen GENAU DIESE
// SQLite (OLY_APP_SQLITE_PATH) und screenshottet mit Playwright:
//   1. Saisonstand, Modus "Spieltage" -- das neue W:L-Ergebnis, KEINE separate ±D-Spalte mehr.
//   2. Liga-Leaders -- die PPS-Werte (jetzt leistungsbasiert statt 2/1/0-Team-Budget-Anteil).
// Screenshots landen in outputs/pp-budget-screenshots/.
//
// AUFRUF: npx tsx scripts/screenshot-pp-budget-ergebnis-normierung.ts [spieltage=6]
// ===================================================================================
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "pp-budget-screenshots");
const SQLITE_PATH = path.join(process.cwd(), "tmp-pp-budget-screenshot.sqlite");
const SPIELTAGE = Number(process.argv[2] ?? 6);

async function baueSave(): Promise<{ saveId: string; teamId: string; matchdaysGespielt: number }> {
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
    logPrefix: "[screenshot]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  // Das erste Team bleibt menschlich steuerbar (sonst zeigt "Dein Team" nichts Sinnvolles) --
  // derselbe Pfad wie solo_1 schon vorsieht, hier nur explizit bestaetigt.
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );

  let gespielt = 0;
  for (let i = 0; i < SPIELTAGE; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
      },
      persistence,
    );
    if (!lauf.ok) {
      console.log(`[screenshot] ${matchdayId} autoRun blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
      break;
    }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!adv.ok || !adv.applied) {
      console.log(`[screenshot] Spieltagswechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
      break;
    }
    gespielt += 1;
  }
  console.log(`[screenshot] Save ${saveId} (Team ${teamId}) fertig, ${gespielt}/${SPIELTAGE} Spieltage gespielt.`);
  return { saveId, teamId, matchdaysGespielt: gespielt };
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
  console.log("[screenshot] starte Dev-Server ...");
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT: "3000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return child;
}

/** Dieselbe Saisonbriefing-Behandlung wie scripts/smoke-gameplay.ts -- ein offenes Briefing-Modal
 * wuerde sonst den eigentlichen Seiteninhalt auf dem Screenshot verdecken. */
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
    if (await isServerReachable(5000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { saveId, teamId, matchdaysGespielt } = await baueSave();

  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(120_000);
    browser = await chromium.launch();
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

    // 1) SAISONSTAND, MODUS "SPIELTAGE" -- das neue W:L-Ergebnis.
    const standingsUrl = new URL("/foundation", BASE_URL);
    standingsUrl.searchParams.set("view", "seasonV2");
    standingsUrl.searchParams.set("team", teamId);
    standingsUrl.searchParams.set("saveId", saveId);
    await page.goto(standingsUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await dismissSeasonBriefingIfOpen(page, 30_000);
    await page.getByTestId("nl-season-standings").waitFor({ state: "visible", timeout: 90_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-saisonstand-daten.png"), fullPage: false });

    const spieltageTab = page.getByRole("tab", { name: "Spieltage" }).or(page.getByText("Spieltage", { exact: true }));
    await spieltageTab.first().click({ timeout: 30_000 }).catch(async () => {
      // Fallback: Subtabs sind evtl. keine ARIA-tabs -- Klick ueber Text im Subtab-Container.
      await page.locator(".nl-standings-subtabs").getByText("Spieltage", { exact: true }).click({ timeout: 30_000 });
    });
    await page.getByTestId("nl-standings-spieltage-grid").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-saisonstand-spieltage.png"), fullPage: false });

    // BESTAETIGUNG: die alte separate ±D-Spalte/der Tooltip existiert nicht mehr.
    const altesVerhaeltnisChip = await page.locator(".nl-standings-spieltage-verhaeltnis").count();
    const ergebnisTexte = await page.locator(".nl-standings-spieltage-ergebnis").allTextContents();
    console.log(`[screenshot] alte ±D-Chips gefunden: ${altesVerhaeltnisChip} (erwartet 0)`);
    console.log(`[screenshot] Ergebnis-Texte (Spieltage-Modus, erste 10): ${ergebnisTexte.slice(0, 10).join(", ")}`);

    // 2) LIGA-LEADERS -- die PPS-Werte (jetzt leistungsbasiert).
    const leadersUrl = new URL("/foundation", BASE_URL);
    leadersUrl.searchParams.set("view", "leagueLeaders");
    leadersUrl.searchParams.set("team", teamId);
    leadersUrl.searchParams.set("saveId", saveId);
    await page.goto(leadersUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await dismissSeasonBriefingIfOpen(page, 30_000);
    await page.getByTestId("foundation-league-leaders").waitFor({ state: "visible", timeout: 90_000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-liga-leaders.png"), fullPage: false });
    const ppsCard = page.getByTestId("league-leaders-card-pps");
    if (await ppsCard.isVisible().catch(() => false)) {
      await ppsCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await ppsCard.screenshot({ path: path.join(OUTPUT_DIR, "04-liga-leaders-pps-card.png") });
    }

    console.log(
      `[screenshot] fertig -- Save ${saveId}, Team ${teamId}, ${matchdaysGespielt} Spieltage gespielt. ` +
        `Screenshots in ${OUTPUT_DIR}.`,
    );
  } finally {
    await browser?.close().catch(() => undefined);
    server.kill("SIGTERM");
    await delay(500);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
