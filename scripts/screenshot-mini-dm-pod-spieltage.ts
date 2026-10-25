// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Mini-DM-Pod-Resolve (19.10., Chris: "3 -> umbauen dass die 4er
// teams da drin sind!!!").
//
// Baut einen frischen Battle-Save (derselbe Wizard-Pfad wie scripts/screenshot-pp-budget-
// ergebnis-normierung.ts), spielt per Auto-Run bis zum ERSTEN Mini-DM-Spieltag der Saison, startet
// DANACH den lokalen Dev-Server gegen GENAU DIESE SQLite (OLY_APP_SQLITE_PATH) und screenshottet
// mit Playwright die Spieltage-Ansicht an genau diesem Spieltag -- die echte Vierergruppe (Pod),
// nicht ein 2-Team-Duell.
//
// AUFRUF: OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npx tsx scripts/screenshot-mini-dm-pod-spieltage.ts
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
import { getSeasonDisciplineSchedule, MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import { getMiniDmPodsForMatchday } from "@/lib/season/mini-dm-pod-schedule";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "mini-dm-pod-screenshots");
const SQLITE_PATH = path.join(process.cwd(), "tmp-mini-dm-pod-screenshot.sqlite");
const MAX_SPIELTAGE = Number(process.argv[2] ?? 20);

async function baueSaveBisMiniDm(): Promise<{ saveId: string; teamId: string; miniDmMatchdayId: string; miniDmMatchdayLabel: string }> {
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
    logPrefix: "[screenshot-mini-dm]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );

  const schedule = getSeasonDisciplineSchedule(persistence.getSaveById(saveId)!.gameState);
  const miniDmEntry = schedule.find(
    (entry) => entry.discipline1?.disciplineId === MINI_DM_DISCIPLINE_ID || entry.discipline2?.disciplineId === MINI_DM_DISCIPLINE_ID,
  );
  if (!miniDmEntry) {
    throw new Error("Kein Mini-DM-Spieltag im Disziplin-Rotationsplan dieser Saison gefunden.");
  }
  console.log(`[screenshot-mini-dm] Mini-DM-Spieltag: ${miniDmEntry.matchdayId} (${miniDmEntry.matchdayLabel}, Index ${miniDmEntry.matchdayIndex})`);

  let gespielt = 0;
  let erreicht = false;
  for (let i = 0; i < MAX_SPIELTAGE; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    if (matchdayId === miniDmEntry.matchdayId) {
      // GENAU DIESEN Spieltag noch spielen (fuer ein echtes, gewertetes Ergebnis), dann abbrechen --
      // die Screenshots sollen den gewerteten Mini-DM-Spieltag zeigen, nicht nur die Ankuendigung.
      const pods = getMiniDmPodsForMatchday(aktuell.gameState, matchdayId, { saveId });
      console.log(`[screenshot-mini-dm] ${pods.length} Pod(s) an ${matchdayId}: ${pods.map((p) => p.teamIds.join("/")).join(" | ")}`);
    }
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
      console.log(`[screenshot-mini-dm] ${matchdayId} autoRun blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
      break;
    }
    if (matchdayId === miniDmEntry.matchdayId) {
      erreicht = true;
    }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!adv.ok || !adv.applied) {
      console.log(`[screenshot-mini-dm] Spieltagswechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
      break;
    }
    gespielt += 1;
    if (erreicht) break;
  }
  if (!erreicht) {
    throw new Error(`Mini-DM-Spieltag ${miniDmEntry.matchdayId} wurde innerhalb von ${MAX_SPIELTAGE} Spieltagen nicht erreicht/gewertet.`);
  }
  console.log(`[screenshot-mini-dm] Save ${saveId} (Team ${teamId}) fertig, ${gespielt} Spieltage gespielt, Mini-DM an ${miniDmEntry.matchdayId} gewertet.`);
  return { saveId, teamId, miniDmMatchdayId: miniDmEntry.matchdayId, miniDmMatchdayLabel: miniDmEntry.matchdayLabel };
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
  console.log("[screenshot-mini-dm] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT: "3000", OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
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
    if (await isServerReachable(5000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { saveId, teamId, miniDmMatchdayId } = await baueSaveBisMiniDm();

  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(120_000);
    browser = await chromium.launch();
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

    const standingsUrl = new URL("/foundation", BASE_URL);
    standingsUrl.searchParams.set("view", "seasonV2");
    standingsUrl.searchParams.set("team", teamId);
    standingsUrl.searchParams.set("saveId", saveId);
    await page.goto(standingsUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await dismissSeasonBriefingIfOpen(page, 30_000);
    await page.getByTestId("nl-season-standings").waitFor({ state: "visible", timeout: 90_000 });
    await page.waitForTimeout(800);

    const spieltageTab = page.getByRole("tab", { name: "Spieltage" }).or(page.getByText("Spieltage", { exact: true }));
    await spieltageTab.first().click({ timeout: 30_000 }).catch(async () => {
      await page.locator(".nl-standings-subtabs").getByText("Spieltage", { exact: true }).click({ timeout: 30_000 });
    });
    await page.getByTestId("nl-standings-spieltage-grid").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(600);

    // Zum Mini-DM-Spieltag navigieren (das Dropdown traegt die matchdayId als value).
    const select = page.locator(".nl-standings-spieltage-select select");
    if (await select.isVisible().catch(() => false)) {
      await select.selectOption(miniDmMatchdayId).catch(async (error) => {
        console.log(`[screenshot-mini-dm] selectOption(${miniDmMatchdayId}) fehlgeschlagen: ${String(error)}`);
      });
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-spieltage-mini-dm-tag.png"), fullPage: true });

    const podCount = await page.getByTestId("nl-standings-spieltage-pod").count();
    console.log(`[screenshot-mini-dm] Pod-Karten sichtbar: ${podCount} (erwartet >= 1)`);
    const podBlock = page.getByTestId("nl-standings-spieltage-pods");
    if (await podBlock.isVisible().catch(() => false)) {
      await podBlock.screenshot({ path: path.join(OUTPUT_DIR, "02-mini-dm-pod-gruppen.png") });
    }

    console.log(`[screenshot-mini-dm] fertig -- Save ${saveId}, Team ${teamId}, Mini-DM-Spieltag ${miniDmMatchdayId}. Screenshots in ${OUTPUT_DIR}.`);
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
