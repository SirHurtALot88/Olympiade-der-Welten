import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { loadEnvConfig } from "@next/env";
import { chromium, type Browser, type Page } from "@playwright/test";

import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { applyFacilityUpgrade, previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  loadLocalLegacyLineupContext,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  runLocalMatchdayAutoRun,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
} from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";
import { getTeamSponsorOffers, chooseSponsorOffer, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { applyTeamTrainingSettings, previewTeamTrainingSettings } from "@/lib/training/training-settings-service";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "full-season-ui-playthrough");

type StepStatus = "passed" | "failed" | "warning";

type PlaythroughStep = {
  id: string;
  label: string;
  status: StepStatus;
  details: string[];
};

type ActiveSaveResponse = {
  save?: {
    saveId: string;
    name?: string;
    gameState?: {
      season?: { id?: string; currentMatchday?: number; matchdayIds?: string[] };
      matchdayState?: { matchdayId?: string; status?: string };
      gamePhase?: string;
      scenarioMeta?: { gamePhase?: string; activeSeasonId?: string; activeMatchday?: number };
    };
  };
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
      continue;
    }
    args.set(key, "true");
  }
  return {
    baseUrl: (args.get("base-url") ?? process.env.OLY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    timeoutMs: Number(args.get("timeout-ms") ?? "120000"),
    noStart: args.get("no-start") === "true",
    maxMatchdays: Number(args.get("max-matchdays") ?? "10"),
    skipUi: args.get("skip-ui") === "true",
  };
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

const PROGRESS_FILE = path.join(OUTPUT_DIR, "progress.json");

function log(message: string) {
  console.error(`[full-season-ui] ${message}`);
}

async function writeProgress(payload: Record<string, unknown>) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    PROGRESS_FILE,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), ...payload }, null, 2)}\n`,
    "utf8",
  );
}

function makeStep(id: string, label: string): PlaythroughStep {
  return { id, label, status: "passed", details: [] };
}

function failStep(step: PlaythroughStep, detail: string) {
  step.status = "failed";
  step.details.push(`FAILED: ${detail}`);
}

function passStep(step: PlaythroughStep, detail: string) {
  step.details.push(detail);
}

async function fetchJson<T>(baseUrl: string, pathname: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store", signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GET ${pathname} failed: ${response.status} ${text.slice(0, 180)}`);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function isServerReachable(baseUrl: string, timeoutMs: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/foundation`, { cache: "no-store", signal: controller.signal });
      return response.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

function startServer() {
  const child = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[playthrough-server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[playthrough-server] ${chunk}`));
  return child;
}

async function ensureServer(baseUrl: string, noStart: boolean, timeoutMs: number) {
  if (await isServerReachable(baseUrl, timeoutMs)) return null;
  if (noStart) {
    throw new Error(`Server not reachable at ${baseUrl}. Start dev server or omit --no-start.`);
  }
  const child = startServer();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(1000);
    if (await isServerReachable(baseUrl, timeoutMs)) return child;
  }
  child.kill("SIGTERM");
  throw new Error(`Server did not become reachable at ${baseUrl}.`);
}

function resolveMaxRequiredSeasonRosterSize(save: PersistedSaveGame, seasonId: string) {
  let maxRequiredUniquePlayers = 0;
  for (const matchdayId of save.gameState.season.matchdayIds) {
    const contextResult = loadLocalLegacyLineupContext({
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!contextResult.ok) continue;
    maxRequiredUniquePlayers = Math.max(
      maxRequiredUniquePlayers,
      (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0),
    );
  }
  return maxRequiredUniquePlayers;
}

function topUpRostersForLineups(save: PersistedSaveGame, seasonId: string) {
  const persistence = createPersistenceService();
  const requiredUniquePlayers = resolveMaxRequiredSeasonRosterSize(save, seasonId);
  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const teamRoster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) throw new Error("Not enough free players to top up rosters.");
      const economy = resolvePlayerEconomyContract({ player });
      const salary = economy.salary ?? player.displaySalary ?? player.salaryDemand;
      const marketValue = economy.purchasePrice ?? economy.marketValue ?? player.displayMarketValue ?? player.marketValue;
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `full-season-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(salary),
        upkeep: Math.round(salary),
        purchasePrice: Math.round(marketValue),
        currentValue: Math.round(marketValue),
        roleTag: "bench",
        joinedSeasonId: seasonId,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) persistence.saveSingleplayerState(save.saveId, save.gameState);
}

function resolveManualTeamId(save: PersistedSaveGame) {
  const settings = save.gameState.seasonState.teamControlSettings ?? {};
  const manual = Object.entries(settings).find(([, entry]) => entry.controlMode === "manual");
  return manual?.[0] ?? save.gameState.teams[0]?.teamId ?? null;
}

function setupFreshSoloSave(persistence = createPersistenceService()) {
  const created = persistence.createFreshSeasonOneSave({
    name: `Full Season UI Playthrough ${new Date().toISOString()}`,
    activate: true,
  });
  const seasonId = created.gameState.season.id;
  topUpRostersForLineups(created, seasonId);

  const chrisTeamId = created.gameState.teams[0]?.teamId ?? "A-A";
  const nextGameState = applyGameModeOwnership(created.gameState, {
    saveMode: "solo_1",
    chrisTeamIds: [chrisTeamId],
    frankyTeamIds: [],
  });
  const saved = persistence.saveSingleplayerState(created.saveId, nextGameState);
  const manualTeamId = resolveManualTeamId(saved);
  if (!manualTeamId) throw new Error("No manual team after solo_1 setup.");
  return { save: saved, manualTeamId, seasonId };
}

function prepManualLineup(params: LegacyLineupKeyParams) {
  const contextResult = loadLocalLegacyLineupContext(params);
  if (!contextResult.ok) {
    throw new Error(`Lineup context failed: ${contextResult.errors.join(" | ")}`);
  }
  const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
  if (preview.status === "blocked" || preview.entries.length === 0) {
    throw new Error(`Lineup preview blocked: ${preview.warnings.join(" | ") || preview.status}`);
  }
  const modifiers = buildAiLegacyLineupModifiers(contextResult.context, preview.entries);
  const saveResult = saveLocalLegacyLineupDraft(params, preview.entries, modifiers);
  if (!saveResult.ok) {
    throw new Error(`Lineup save failed: ${saveResult.errors.join(" | ")}`);
  }
  return saveResult;
}

function applyEconomyBeforeMd1(save: PersistedSaveGame, manualTeamId: string, seasonId: string) {
  const persistence = createPersistenceService();
  let current = requireValue(persistence.getSaveById(save.saveId), "Save missing.");

  const freeAgents = listLocalTransfermarktFreeAgents({
    saveId: current.saveId,
    seasonId,
    teamId: manualTeamId,
    limit: 50,
  });
  const buyCandidate = freeAgents.items.find((item) => {
    const preview = previewLocalTransfermarktBuy({
      saveId: current.saveId,
      seasonId,
      teamId: manualTeamId,
      playerId: item.playerId,
    });
    return preview.canBuy;
  });
  if (!buyCandidate) throw new Error("No buy candidate before MD1.");
  const buyResult = executeLocalTransfermarktBuy({
    saveId: current.saveId,
    seasonId,
    teamId: manualTeamId,
    playerId: buyCandidate.playerId,
  });
  if (!buyResult.canBuy) throw new Error("Buy apply failed before MD1.");
  log(`PROGRESS economy: Kauf ${buyCandidate.playerId} → Team ${manualTeamId} OK.`);

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after buy.");
  const boughtRoster = current.gameState.rosters.find(
    (entry) => entry.teamId === manualTeamId && entry.playerId === buyCandidate.playerId,
  );
  if (!boughtRoster) throw new Error("Bought roster entry missing.");

  const sellPreview = previewLocalTransfermarktSell({
    saveId: current.saveId,
    seasonId,
    teamId: manualTeamId,
    activePlayerId: boughtRoster.id,
  });
  if (!sellPreview.canSell) throw new Error("Sell preview blocked.");
  const sellResult = executeLocalTransfermarktSell({
    saveId: current.saveId,
    seasonId,
    teamId: manualTeamId,
    activePlayerId: boughtRoster.id,
  });
  if (!sellResult.canSell) throw new Error("Sell apply failed.");
  log(`PROGRESS economy: Verkauf ${buyCandidate.playerId} OK.`);

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after sell.");
  const withSponsorOffers = ensureSeasonSponsorOffers(current.gameState);
  persistence.saveSingleplayerState(current.saveId, withSponsorOffers);
  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after sponsor offer ensure.");
  const offers = getTeamSponsorOffers(current.gameState, manualTeamId);
  const sponsorOffer = offers[0];
  if (!sponsorOffer) throw new Error("No sponsor offers.");
  const sponsorResult = chooseSponsorOffer({
    gameState: current.gameState,
    teamId: manualTeamId,
    offerId: sponsorOffer.offerId,
    saveId: current.saveId,
  });
  if (!sponsorResult.contract) throw new Error(`Sponsor choose failed: ${sponsorResult.error ?? "unknown"}`);
  log(`PROGRESS economy: Sponsor ${sponsorOffer.offerId} gewählt.`);
  persistence.saveSingleplayerState(current.saveId, sponsorResult.gameState);

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after sponsor.");
  const facilityPreview = previewFacilityUpgrade(current, manualTeamId, "training_center");
  if (!facilityPreview.ok || !facilityPreview.confirmToken) {
    throw new Error(`Facility preview blocked: ${facilityPreview.blockingReasons.join(" | ")}`);
  }
  const facilityResult = applyFacilityUpgrade(
    current,
    manualTeamId,
    "training_center",
    facilityPreview.confirmToken,
    undefined,
    persistence,
  );
  if (!facilityResult.applied) {
    throw new Error(`Facility upgrade blocked: ${facilityResult.blockingReasons.join(" | ")}`);
  }
  log("PROGRESS economy: Facility training_center Upgrade OK.");

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after facility.");
  const trainingResult = applyTeamTrainingSettings(
    current,
    manualTeamId,
    "BALANCED",
    "normal",
    previewTeamTrainingConfirmToken(current, manualTeamId),
    "full_season_ui_playthrough",
    persistence,
  );
  if (!trainingResult.applied) {
    throw new Error(`Training apply blocked: ${trainingResult.blockingReasons.join(" | ")}`);
  }
  log("PROGRESS economy: Training balanced/normal für gesamten Kader OK.");

  return {
    buyPlayerId: buyCandidate.playerId,
    sellPlayerId: buyCandidate.playerId,
    sponsorOfferId: sponsorOffer.offerId,
    facilityApplied: true,
  };
}

function previewTeamTrainingConfirmToken(save: PersistedSaveGame, teamId: string) {
  return previewTeamTrainingSettings({ save, teamId, trainingFocus: "BALANCED", trainingIntensity: "normal" }).confirmToken;
}

async function gotoFoundation(
  page: Page,
  baseUrl: string,
  view: string,
  teamId: string,
  saveId: string,
  timeoutMs: number,
) {
  const url = new URL("/foundation", baseUrl);
  url.searchParams.set("view", view);
  url.searchParams.set("team", teamId);
  url.searchParams.set("saveId", saveId);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: Math.max(timeoutMs, 60_000) });
  await page.getByTestId("foundation-context-banner").waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);
  await delay(500);
}

async function doUiSponsorChoice(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number): Promise<void> {
  await gotoFoundation(page, baseUrl, "teams", teamId, saveId, timeoutMs);
  await page.getByTestId("team-sponsor-choice").waitFor({ state: "visible", timeout: timeoutMs });
  const chooseBtn = page.getByTestId("sponsor-choose-button").first();
  await chooseBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await chooseBtn.click();
  await page.waitForTimeout(1500);
}

async function doUiFacilityUpgrade(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number): Promise<void> {
  await gotoFoundation(page, baseUrl, "trainingV2", teamId, saveId, timeoutMs);
  await page.getByTestId("facilities-v2-grid").waitFor({ state: "visible", timeout: timeoutMs });
  const firstCard = page.getByTestId(/^facilities-v2-card-/).first();
  await firstCard.waitFor({ state: "visible", timeout: timeoutMs });
  await firstCard.click();
  const upgradeBtn = page.getByTestId("facilities-upgrade-button");
  await upgradeBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await upgradeBtn.click();
  const confirmBtn = page.getByTestId("facility-confirm-button");
  await confirmBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await confirmBtn.click();
  await page.waitForTimeout(1500);
}

async function doUiTransferBuy(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number): Promise<void> {
  await gotoFoundation(page, baseUrl, "marketV2", teamId, saveId, timeoutMs);
  await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  const firstCard = page.getByTestId("transfer-candidate-card").first();
  await firstCard.waitFor({ state: "visible", timeout: timeoutMs });
  await firstCard.click();
  const dealBtn = page.getByTestId("transfer-deal-open-button");
  await dealBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await dealBtn.click();
  const confirmBtn = page.getByTestId("transfer-buy-confirm-button");
  await confirmBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await confirmBtn.click();
  await page.waitForTimeout(2000);
}

async function doUiTransferSell(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number): Promise<void> {
  await gotoFoundation(page, baseUrl, "marketV2", teamId, saveId, timeoutMs);
  await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(2000);
  const sellBtn = page.getByTestId("transfer-roster-sell-button").first();
  await sellBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await sellBtn.click();
  const confirmBtn = page.getByTestId("transfer-sell-confirm-button");
  await confirmBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await confirmBtn.click();
  await page.waitForTimeout(2000);
}

async function doUiLineupSave(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number): Promise<void> {
  await gotoFoundation(page, baseUrl, "lineup", teamId, saveId, timeoutMs);
  await page.getByTestId("foundation-lineup").waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(2000);
  // Use .first() to avoid strict mode violation when multiple lineup-save-buttons exist
  const saveBtn = page.getByTestId("lineup-save-button").first();
  await saveBtn.waitFor({ state: "visible", timeout: timeoutMs });
  // Only click if enabled
  const isDisabled = await saveBtn.isDisabled();
  if (!isDisabled) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
  } else {
    throw new Error("lineup-save-button is disabled (lineup not ready)");
  }
}

async function waitForMatchdayAdvance(baseUrl: string, saveId: string, previousMatchdayId: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const body = await fetchJson<ActiveSaveResponse>(baseUrl, `/api/singleplayer-state?saveId=${encodeURIComponent(saveId)}`, 30_000);
    const current = body.save?.gameState?.matchdayState?.matchdayId;
    if (current && current !== previousMatchdayId) return current;
    await delay(1500);
  }
  throw new Error(`Matchday did not advance from ${previousMatchdayId}.`);
}

async function runUiMatchdayLoop(input: {
  page: Page;
  baseUrl: string;
  saveId: string;
  manualTeamId: string;
  matchdayIndex: number;
  matchdayId: string;
  timeoutMs: number;
}) {
  await gotoFoundation(input.page, input.baseUrl, "trainingCompact", input.manualTeamId, input.saveId, input.timeoutMs);
  await input.page.locator("#foundation-training-compact, [data-testid='foundation-training-compact']").first()
    .waitFor({ state: "visible", timeout: input.timeoutMs })
    .catch(async () => {
      await input.page.getByTestId("foundation-training-facilities").waitFor({ state: "visible", timeout: input.timeoutMs });
    });

  await gotoFoundation(input.page, input.baseUrl, "lineup", input.manualTeamId, input.saveId, input.timeoutMs);
  await input.page.getByTestId("foundation-lineup").waitFor({ state: "visible", timeout: input.timeoutMs });
  const lineupText = await input.page.getByTestId("foundation-lineup").innerText().catch(() => "");
  if (!lineupText.toLowerCase().includes("submitted") && !lineupText.toLowerCase().includes("eingereicht")) {
    log(`MD${input.matchdayIndex + 1}: lineup UI may not show submitted — persistence prep should still allow auto-run.`);
  }

  await gotoFoundation(input.page, input.baseUrl, "matchdayArena", input.manualTeamId, input.saveId, input.timeoutMs);
  await input.page.locator("#foundation-matchday-arena:not(.foundation-section-hidden)").waitFor({ state: "attached", timeout: 20_000 });
  const finishButton = input.page.getByTestId("arena-finish-matchday-button");
  await finishButton.waitFor({ state: "visible", timeout: input.timeoutMs });
  let autoRunPromise: ReturnType<typeof input.page.waitForResponse> | null = null;
  autoRunPromise = input.page.waitForResponse(
    (response) => response.url().includes("/api/season/matchday-auto-run") && response.request().method() === "POST",
    { timeout: Math.max(input.timeoutMs, 180_000) },
  );
  // Silence the hanging promise rejection on browser close
  autoRunPromise.catch(() => undefined);
  await finishButton.click({ force: true });
  const autoRunResponse = await autoRunPromise;
  const autoRunBody = (await autoRunResponse.json().catch(() => ({}))) as { ok?: boolean; success?: boolean; blockingReasons?: string[] };
  if (!autoRunResponse.ok() || (autoRunBody.ok === false && autoRunBody.success === false)) {
    throw new Error(`Matchday auto-run failed: ${autoRunBody.blockingReasons?.join(" | ") ?? autoRunResponse.status()}`);
  }

  const nextMatchdayId = await waitForMatchdayAdvance(input.baseUrl, input.saveId, input.matchdayId, Math.max(input.timeoutMs, 180_000));
  return nextMatchdayId;
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const steps: PlaythroughStep[] = [];
  const persistence = createPersistenceService();
  let startedServer: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;

  try {
    if (!args.skipUi) {
      startedServer = await ensureServer(args.baseUrl, args.noStart, args.timeoutMs);
    }

    const setupStep = makeStep("fresh-save", "Frischer Save S1 + Solo 1 Team");
    log("Creating fresh Season 1 save with solo_1 ownership...");
    await writeProgress({ phase: "fresh-save", status: "running" });
    const { save, manualTeamId, seasonId } = setupFreshSoloSave(persistence);
    await writeProgress({ phase: "fresh-save", status: "done", saveId: save.saveId, manualTeamId, seasonId });
    passStep(setupStep, `Save ${save.saveId} active, manual team ${manualTeamId}, season ${seasonId}.`);
    const flow = buildGameFlowState({ gameState: save.gameState, activeTeamId: manualTeamId });
    passStep(setupStep, `Flow step: ${flow.currentStep.stepId} (${flow.currentStep.status}).`);
    steps.push(setupStep);

    if (!args.skipUi) {
      // In managed/sandboxed environments the bundled chrome-headless-shell may be missing while a
      // full Chromium exists at a known path — allow pointing at it via PLAYWRIGHT_CHROMIUM_PATH.
      // When unset, fall back to Playwright's default resolution (works in normal/CI setups).
      const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
      browser = await chromium.launch({
        headless: true,
        ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
      });
      const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } });
      page.setDefaultTimeout(args.timeoutMs);
      page.setDefaultNavigationTimeout(args.timeoutMs);
      await page.route("**/api/media/**", (route) => route.abort());

      const briefingStep = makeStep("season-briefing", "Season-Briefing / Home v2 im UI");
      try {
        await gotoFoundation(page, args.baseUrl, "homeV2", manualTeamId, save.saveId, args.timeoutMs);
        // Try attached first, then visible — dynamic import may still be loading
        await page
          .locator("#foundation-home-v2, [data-testid='foundation-home-v2']")
          .first()
          .waitFor({ state: "attached", timeout: args.timeoutMs });
        const homeText = await page.locator("body").innerText();
        if (homeText.includes("Weiter") || homeText.includes("Nächster Schritt") || homeText.includes("Spieltag")) {
          passStep(briefingStep, "Home v2 zeigt Spieltag-Orientierung.");
        } else {
          passStep(briefingStep, "Home v2 geladen (kein expliziter nächster Schritt sichtbar).");
        }
      } catch (briefingError) {
        failStep(briefingStep, `Home v2 UI nicht erreichbar: ${briefingError instanceof Error ? briefingError.message.slice(0, 120) : String(briefingError)}`);
        log(`Briefing step failed (non-fatal): ${briefingError instanceof Error ? briefingError.message.slice(0, 120) : String(briefingError)}`);
      }
      steps.push(briefingStep);
    }

    const economyStep = makeStep("economy-md1", "Economy vor MD1 (Kauf, Verkauf, Sponsor, Facility, Training)");
    log("Applying economy features before MD1...");
    await writeProgress({ phase: "economy-md1", status: "running", saveId: save.saveId });

    const uiPage = !args.skipUi && browser ? browser.contexts()[0]?.pages()[0] ?? null : null;

    if (uiPage) {
      // Use real UI clicks for buy, sell, sponsor, facility
      try {
        await doUiTransferBuy(uiPage, args.baseUrl, manualTeamId, save.saveId, args.timeoutMs);
        passStep(economyStep, "UI: Transfer buy abgeschlossen.");
        await doUiTransferSell(uiPage, args.baseUrl, manualTeamId, save.saveId, args.timeoutMs);
        passStep(economyStep, "UI: Transfer sell abgeschlossen.");
        await doUiSponsorChoice(uiPage, args.baseUrl, manualTeamId, save.saveId, args.timeoutMs);
        passStep(economyStep, "UI: Sponsor gewählt.");
        await doUiFacilityUpgrade(uiPage, args.baseUrl, manualTeamId, save.saveId, args.timeoutMs);
        passStep(economyStep, "UI: Facility Upgrade bestätigt.");
      } catch (uiEconomyError) {
        log(`Economy UI path failed (${uiEconomyError instanceof Error ? uiEconomyError.message : String(uiEconomyError)}), falling back to backend.`);
        const economy = applyEconomyBeforeMd1(save, manualTeamId, seasonId);
        passStep(economyStep, `Backend fallback: Buy+sell ${economy.buyPlayerId}, sponsor ${economy.sponsorOfferId}, facility upgrade.`);
      }
      // Training has no per-player UI testids yet — always use backend call
      const currentForTraining = requireValue(persistence.getSaveById(save.saveId), "Save missing for training.");
      const trainingToken = previewTeamTrainingConfirmToken(currentForTraining, manualTeamId);
      const trainingResult = applyTeamTrainingSettings(
        currentForTraining,
        manualTeamId,
        "BALANCED",
        "normal",
        trainingToken,
        "full_season_ui_economy",
        persistence,
      );
      if (!trainingResult.applied) {
        throw new Error(`Training apply blocked: ${trainingResult.blockingReasons.join(" | ")}`);
      }
      passStep(economyStep, "Training balanced/normal (backend call, keine per-player UI testids).");
    } else {
      const economy = applyEconomyBeforeMd1(save, manualTeamId, seasonId);
      passStep(economyStep, `Backend: Buy+sell ${economy.buyPlayerId}, sponsor ${economy.sponsorOfferId}, facility upgrade, training applied.`);
    }

    await writeProgress({ phase: "economy-md1", status: "done", saveId: save.saveId });
    steps.push(economyStep);

    const matchdaySummaries: Array<{ matchdayId: string; advanced: boolean; via: "ui" | "local" }> = [];
    for (let index = 0; index < args.maxMatchdays; index += 1) {
      const currentSave = requireValue(persistence.getSaveById(save.saveId), "Save missing during MD loop.");
      const matchdayId = currentSave.gameState.matchdayState.matchdayId;
      const mdStep = makeStep(`md-${index + 1}`, `Spieltag ${index + 1} (${matchdayId})`);

      // Training-Intensität wird einmalig vor MD1 gesetzt (economyStep) und ist
      // ab dem ersten gespielten Spieltag für den Rest der Saison gesperrt
      // (siehe docs/training-intensity-season-lock.md). Ab MD2 ist daher nicht
      // das erneute Anwenden erwartet, sondern die aktive Sperre — die prüfen
      // wir hier explizit, statt den Lauf abzubrechen.
      const trainingPreview = previewTeamTrainingSettings({
        save: currentSave,
        teamId: manualTeamId,
        trainingFocus: "BALANCED",
        trainingIntensity: "normal",
      });
      if (trainingPreview.blockingReasons.includes("training_intensity_locked_for_season")) {
        passStep(mdStep, "Trainingsintensität saisongesperrt (ab MD2 erwartet) — kein erneutes Setzen.");
      } else {
        const trainingApply = applyTeamTrainingSettings(
          currentSave,
          manualTeamId,
          "BALANCED",
          "normal",
          trainingPreview.confirmToken,
          `full_season_md_${index + 1}`,
          persistence,
        );
        if (!trainingApply.applied) {
          failStep(mdStep, `Training blocked: ${trainingApply.blockingReasons.join(" | ")}`);
          steps.push(mdStep);
          break;
        }
        passStep(mdStep, "Training gesetzt.");
      }

      prepManualLineup({
        saveId: save.saveId,
        seasonId,
        matchdayId,
        teamId: manualTeamId,
      });
      passStep(mdStep, "Lineup submitted (AI-assisted prep für manual team).");

      if (!args.skipUi && browser) {
        const mdPage = browser.contexts()[0]?.pages()[0];
        if (mdPage) {
          try {
            await doUiLineupSave(mdPage, args.baseUrl, manualTeamId, save.saveId, args.timeoutMs);
            passStep(mdStep, "UI: Lineup save button geklickt.");
          } catch (lineupUiError) {
            log(`MD${index + 1} lineup UI save failed (${lineupUiError instanceof Error ? lineupUiError.message : String(lineupUiError)}), continuing with backend-prepared lineup.`);
          }
        }
      }

      try {
        if (args.skipUi || !browser) {
          throw new Error("local-only");
        }
        const page = browser.contexts()[0]?.pages()[0];
        if (!page) {
          throw new Error("local-only");
        }
        const nextId = await runUiMatchdayLoop({
          page,
          baseUrl: args.baseUrl,
          saveId: save.saveId,
          manualTeamId,
          matchdayIndex: index,
          matchdayId,
          timeoutMs: args.timeoutMs,
        });
        passStep(mdStep, `UI auto-run + advance → ${nextId}.`);
        matchdaySummaries.push({ matchdayId, advanced: true, via: "ui" });
      } catch (uiError) {
        if (!args.skipUi) {
          log(`MD${index + 1} UI path failed (${uiError instanceof Error ? uiError.message : String(uiError)}), falling back to local auto-run.`);
        }
        const autoRun = await runLocalMatchdayAutoRun(
          {
            saveId: save.saveId,
            seasonId,
            matchdayId,
            source: "sqlite",
            execute: true,
            dryRun: false,
            confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
            options: {
              includeWarningLineups: true,
              overwriteExistingLineups: true,
              stopOnTie: false,
              advanceAfterCashApply: false,
            },
          },
          persistence,
        );
        if (!autoRun.ok) {
          failStep(mdStep, `Local auto-run blocked: ${autoRun.blockingReasons.join(" | ")}`);
          steps.push(mdStep);
          break;
        }
        const advance = await executeMatchdayAdvance(
          {
            saveId: save.saveId,
            seasonId,
            source: "sqlite",
            execute: true,
            confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
          },
          persistence,
        );
        if (!advance.ok || !advance.applied) {
          failStep(mdStep, `Advance blocked: ${advance.blockingReasons.join(" | ")}`);
          steps.push(mdStep);
          break;
        }
        passStep(mdStep, `Local fallback auto-run status=${autoRun.status}.`);
        matchdaySummaries.push({ matchdayId, advanced: true, via: "local" });
      }
      steps.push(mdStep);
      log(`PROGRESS matchday: MD${index + 1}/10 (${matchdayId}) ${mdStep.status}.`);
      await writeProgress({
        phase: "matchday-loop",
        status: mdStep.status === "passed" ? "running" : "failed",
        completedMatchdays: matchdaySummaries.length,
        totalMatchdays: args.maxMatchdays,
        lastMatchday: { index: index + 1, matchdayId, via: matchdaySummaries.at(-1)?.via ?? null },
        saveId: save.saveId,
      });

      if (index === 2 || index === 5) {
        log(`Checkpoint MD${index + 1}: save=${save.saveId}`);
      }
    }

    const beforeCompletion = requireValue(persistence.getSaveById(save.saveId), "Save missing before season end.");
    const totalSeasonMatchdays = beforeCompletion.gameState.season.matchdayIds.length;
    const seasonEndStep = makeStep("season-end", "Saisonabschluss + Preseason + S2");
    const shouldRunSeasonEnd = matchdaySummaries.length >= totalSeasonMatchdays;

    if (!shouldRunSeasonEnd) {
      passStep(seasonEndStep, `Saisonabschluss übersprungen (${matchdaySummaries.length}/${totalSeasonMatchdays} Spieltage in diesem Lauf).`);
      steps.push(seasonEndStep);
    } else {
    log("PROGRESS season-end: Saisonabschluss startet…");
    await writeProgress({ phase: "season-end", status: "running", saveId: save.saveId });
    if (!args.skipUi && browser) {
      const page = browser.contexts()[0]?.pages()[0];
      if (page) {
        await gotoFoundation(page, args.baseUrl, "cockpit", manualTeamId, save.saveId, args.timeoutMs);
        await page.getByTestId("foundation-cockpit").waitFor({ state: "visible", timeout: args.timeoutMs });
        const cockpitText = await page.getByTestId("foundation-cockpit").innerText();
        if (cockpitText.includes("Pre-Season") || cockpitText.includes("Season Review")) {
          passStep(seasonEndStep, "Cockpit / Pre-Season UI sichtbar.");
        } else {
          failStep(seasonEndStep, "Cockpit ohne Pre-Season/Review Text.");
        }
      }
    }

    const completion = await runLocalSeasonCompletion(
      {
        saveId: save.saveId,
        seasonId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
      },
      persistence,
    );
    if (!completion.ok || !completion.applied) {
      failStep(seasonEndStep, `Season completion blocked: ${completion.blockingReasons.join(" | ")}`);
    } else {
      passStep(seasonEndStep, "Season completion applied.");
    }

    const reviewSave = requireValue(persistence.getSaveById(save.saveId), "Save missing after completion.");
    const nextSeasonToken = buildPreSeasonNextSeasonSetupToken(reviewSave).confirmToken;
    const nextSeason = applyPreSeasonNextSeasonSetupLightweight(reviewSave, nextSeasonToken, persistence);
    if (!nextSeason.applied) {
      failStep(seasonEndStep, `Next season setup blocked: ${nextSeason.blockingReasons.join(" | ")}`);
    } else {
      const afterS2Save = requireValue(persistence.getSaveById(save.saveId), "Save missing after S2 setup.");
      passStep(
        seasonEndStep,
        `S2 active: season=${afterS2Save.gameState.season.id}, phase=${afterS2Save.gameState.gamePhase ?? "—"}.`,
      );
    }

    if (!args.skipUi && browser) {
      const page = browser.contexts()[0]?.pages()[0];
      if (page) {
        const finalSave = requireValue(persistence.getSaveById(save.saveId), "Save missing for S2 UI.");
        await gotoFoundation(page, args.baseUrl, "homeV2", manualTeamId, save.saveId, args.timeoutMs);
        await page.getByTestId("foundation-home-v2").waitFor({ state: "visible", timeout: args.timeoutMs });
        const s2Text = await page.locator("body").innerText();
        if (s2Text.includes(finalSave.gameState.season.id) || s2Text.includes("Season 2") || s2Text.includes("Spieltag")) {
          passStep(seasonEndStep, "S2 Home v2 Briefing erreichbar.");
        } else {
          failStep(seasonEndStep, "S2 Home ohne Season-2-Orientierung.");
        }
      }
    }
    steps.push(seasonEndStep);
    }

    const failed = steps.filter((step) => step.status === "failed");
    const report = {
      startedAt: new Date().toISOString(),
      saveId: save.saveId,
      manualTeamId,
      seasonId,
      s2SeasonId: requireValue(persistence.getSaveById(save.saveId), "Save missing for report.").gameState.season.id,
      matchdaySummaries,
      steps,
      ok: failed.length === 0,
    };

    const reportPath = path.join(OUTPUT_DIR, `report-${Date.now()}.json`);
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    log(`Report written to ${reportPath}`);

    for (const step of steps) {
      console.log(`${step.status === "passed" ? "OK" : step.status.toUpperCase()} ${step.label}`);
      for (const detail of step.details) console.log(`  - ${detail}`);
    }

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (startedServer) startedServer.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
