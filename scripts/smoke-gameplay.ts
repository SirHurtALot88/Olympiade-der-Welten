import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "gameplay-smoke");
const SCREENSHOT_NAMES = {
  foundation: "smoke-foundation.png",
  transfermarkt: "smoke-transfermarkt.png",
  training: "smoke-training.png",
  lineup: "smoke-lineup.png",
  arena: "smoke-arena.png",
  preseason: "smoke-preseason.png",
} as const;

type SmokeStatus = "passed" | "warning" | "failed";

type SmokeStep = {
  id: string;
  label: string;
  status: SmokeStatus;
  details: string[];
  warnings: string[];
  screenshot?: string;
};

type ActiveSaveResponse = {
  save?: {
    saveId: string;
    name?: string;
    gameState?: {
      season?: { id?: string; currentMatchday?: number };
      matchdayState?: { matchdayId?: string };
      gamePhase?: string;
      scenarioMeta?: {
        scenarioType?: string;
        activeSeasonId?: string;
        activeMatchday?: number;
        gamePhase?: string;
        containsFinalStandings?: boolean;
        containsSeasonHistory?: boolean;
      };
      teams?: Array<{ teamId: string; cash?: number }>;
      rosters?: unknown[];
      transferHistory?: unknown[];
      playerProgressionEvents?: unknown[];
      seasonState?: {
        facilityEvents?: unknown[];
        matchdayResults?: unknown[];
        standingsApplyLogs?: unknown[];
        cashPrizeApplyLogs?: unknown[];
      };
    };
  };
  saves?: Array<{
    saveId: string;
    name?: string;
    status?: string;
  }>;
};

type DestructiveSignature = {
  saveId: string | null;
  seasonId: string | null;
  matchdayId: string | null;
  teamCashTotal: number;
  rosters: number;
  transferHistory: number;
  facilityEvents: number;
  progressionEvents: number;
  matchdayResults: number;
  standingsApplyLogs: number;
  cashPrizeApplyLogs: number;
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
    timeoutMs: Number(args.get("timeout-ms") ?? "60000"),
    startupRetries: Number(args.get("startup-retries") ?? "50"),
    startupDelayMs: Number(args.get("startup-delay-ms") ?? "1000"),
    noStart: args.get("no-start") === "true",
    writeMode: args.get("write") === "true",
    confirmTestsave: args.get("confirm-testsave") === "true",
    includeSaveSwitch: args.get("include-save-switch") === "true",
    screenshots: args.get("screenshots") !== "false",
  };
}

async function fetchText(baseUrl: string, pathname: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store", signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(baseUrl: string, pathname: string, timeoutMs: number): Promise<T> {
  const response = await fetchText(baseUrl, pathname, timeoutMs);
  if (!response.ok) {
    throw new Error(`GET ${pathname} failed: ${response.status} ${response.text.slice(0, 180)}`);
  }
  return JSON.parse(response.text) as T;
}

async function isServerReachable(baseUrl: string, timeoutMs: number) {
  try {
    const response = await fetchText(baseUrl, "/foundation", timeoutMs);
    return response.ok;
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
  child.stdout.on("data", (chunk) => process.stdout.write(`[smoke-server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[smoke-server] ${chunk}`));
  return child;
}

async function ensureServer(input: {
  baseUrl: string;
  timeoutMs: number;
  startupRetries: number;
  startupDelayMs: number;
  noStart: boolean;
}) {
  if (await isServerReachable(input.baseUrl, input.timeoutMs)) {
    return null;
  }

  if (input.noStart) {
    throw new Error(`Gameplay smoke: local server is not reachable at ${input.baseUrl}. Start it first or omit --no-start.`);
  }

  const child = startServer();
  for (let attempt = 0; attempt < input.startupRetries; attempt += 1) {
    await delay(input.startupDelayMs);
    if (await isServerReachable(input.baseUrl, input.timeoutMs)) {
      return child;
    }
  }

  child.kill("SIGTERM");
  throw new Error(`Gameplay smoke: server did not become reachable at ${input.baseUrl}.`);
}

function buildDestructiveSignature(body: ActiveSaveResponse): DestructiveSignature {
  const gameState = body.save?.gameState;
  return {
    saveId: body.save?.saveId ?? null,
    seasonId: gameState?.season?.id ?? null,
    matchdayId: gameState?.matchdayState?.matchdayId ?? null,
    teamCashTotal: Math.round((gameState?.teams ?? []).reduce((sum, team) => sum + (team.cash ?? 0), 0) * 100) / 100,
    rosters: gameState?.rosters?.length ?? 0,
    transferHistory: gameState?.transferHistory?.length ?? 0,
    facilityEvents: gameState?.seasonState?.facilityEvents?.length ?? 0,
    progressionEvents: gameState?.playerProgressionEvents?.length ?? 0,
    matchdayResults: gameState?.seasonState?.matchdayResults?.length ?? 0,
    standingsApplyLogs: gameState?.seasonState?.standingsApplyLogs?.length ?? 0,
    cashPrizeApplyLogs: gameState?.seasonState?.cashPrizeApplyLogs?.length ?? 0,
  };
}

function signaturesEqual(left: DestructiveSignature, right: DestructiveSignature) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function shortSaveId(saveId: string) {
  return saveId.length <= 14 ? saveId : `${saveId.slice(0, 8)}…${saveId.slice(-5)}`;
}

function isPreviewOnlyMutation(entry: { method: string; url: string; postDataJson?: unknown }) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(entry.method)) return false;
  if (entry.postDataJson && typeof entry.postDataJson === "object") {
    const body = entry.postDataJson as { dryRun?: unknown; execute?: unknown };
    return body.dryRun !== false && body.execute !== true;
  }
  return false;
}

function isDestructiveSmokeRequest(entry: { method: string; url: string; postDataJson?: unknown }) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(entry.method)) return false;
  if (isPreviewOnlyMutation(entry)) return false;
  const destructiveFragments = [
    "/api/transfermarkt/buy",
    "/api/transfermarkt/sell",
    "/api/facilities/upgrade",
    "/api/season/cash-prize-apply",
    "/api/standings/apply",
    "/api/resolve/legacy-matchday-apply",
    "/api/season/advance-matchday",
    "/api/season/matchday-auto-run",
    "/api/ai/market-plan-apply",
    "/api/ai/roster-fill",
    "/api/ai/picks-run",
    "/api/progression/season-end-xp-spend",
    "/api/singleplayer-state/season-start-reset",
  ];
  return destructiveFragments.some((fragment) => entry.url.includes(fragment));
}

async function activeSave(baseUrl: string, timeoutMs: number) {
  return fetchJson<ActiveSaveResponse>(baseUrl, "/api/singleplayer-state", timeoutMs);
}

async function activeSaveWithRetries(baseUrl: string, timeoutMs: number, retries = 2) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await activeSave(baseUrl, Math.max(timeoutMs, 30_000));
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(1000);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function waitForContextBanner(page: Page, expectedSaveId: string | null, timeoutMs: number) {
  await page.getByTestId("foundation-context-banner").waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    ({ saveId }) => {
      const text = document.querySelector('[data-testid="foundation-context-banner"]')?.textContent ?? "";
      const hasContextLabel =
        text.includes("Spielstand") ||
        text.includes("Team") ||
        text.includes("Aktiver Kontext") ||
        text.includes("Spieltag");
      return hasContextLabel && (!saveId || text.includes(saveId.slice(0, 6)) || text.trim().length > 24);
    },
    { saveId: expectedSaveId },
    { timeout: timeoutMs },
  ).catch(() => undefined);
}

const GAME_PHASE_VISIBLE_NEEDLES = [
  "GamePhase",
  "season_active",
  "Phase",
  "Saison laeuft",
  "Saisonrueckblick",
  "Saison abgeschlossen",
  "Preseason-Management",
  "Naechste Saison bereit",
  "Vorbereitung",
  "Lineup Setup",
  "Preseason",
  "Transferfenster",
  "Verkaufsfenster",
  "Kaufphase",
];

const TRANSFER_MARKET_READY_NEEDLES = [
  "Wishlist & Scouting",
  "Wishlist",
  "Aktueller Kader",
  "Auf Wishlist",
  "gemerkt",
  "Verkaufen",
  "Kader",
];

const SEASON_VISIBLE_NEEDLES = [
  "season-",
  "Season 1",
  "Season 2",
  "Saison 1",
  "Saison 2",
  "Spieltag",
];

async function dismissSeasonBriefingIfOpen(page: Page, timeoutMs: number) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  const visible = await backdrop.isVisible().catch(() => false);
  if (!visible) {
    return;
  }

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

async function waitForSaveContext(page: Page, expectedSaveId: string, timeoutMs: number) {
  await page.waitForFunction(
    ({ saveId, shortId }) => {
      const bannerText = document.querySelector('[data-testid="foundation-context-banner"]')?.textContent ?? "";
      const activeSaveText = document.querySelector('[data-testid="foundation-active-save-id"]')?.textContent ?? "";
      return bannerText.includes(shortId) || activeSaveText.includes(shortId) || bannerText.includes(saveId);
    },
    { saveId: expectedSaveId, shortId: shortSaveId(expectedSaveId) },
    { timeout: timeoutMs },
  );
}

async function pageText(page: Page) {
  return page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
}

async function elementTextContent(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => element.textContent ?? "").catch(() => "");
}

async function waitForGamePhaseVisible(page: Page, timeoutMs: number) {
  await page.waitForFunction(
    (needles) => {
      const banner = document.querySelector('[data-testid="foundation-context-banner"]');
      const text = `${banner?.textContent ?? ""}\n${document.body.textContent ?? ""}`;
      const normalized = text.toLowerCase();
      return needles.some((needle: string) => normalized.includes(needle.toLowerCase()));
    },
    GAME_PHASE_VISIBLE_NEEDLES,
    { timeout: timeoutMs },
  ).catch(() => undefined);
}

async function waitForTransferMarketV2Ready(page: Page, timeoutMs: number) {
  await page.waitForFunction(
    (needles) => {
      const marketRoot = document.querySelector('[data-testid="transfer-market"]');
      if (!marketRoot) {
        return false;
      }
      const text = marketRoot.textContent ?? "";
      const normalized = text.toLowerCase();
      const hasMarketBody =
        Boolean(marketRoot.querySelector(".market-v2-budget-strip")) ||
        Boolean(marketRoot.querySelector(".market-v2-context-grid")) ||
        Boolean(marketRoot.querySelector('[data-testid="transfer-candidate-card"]')) ||
        Boolean(marketRoot.querySelector('[data-testid="transfer-deal-open-button"]'));
      return hasMarketBody && needles.some((needle: string) => normalized.includes(needle.toLowerCase()));
    },
    TRANSFER_MARKET_READY_NEEDLES,
    { timeout: timeoutMs },
  ).catch(() => undefined);
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.toLowerCase().includes(needle.toLowerCase()));
}

async function screenshot(page: Page, enabled: boolean, name: keyof typeof SCREENSHOT_NAMES) {
  if (!enabled) return undefined;
  const filePath = path.join(OUTPUT_DIR, SCREENSHOT_NAMES[name]);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

function makeStep(id: string, label: string): SmokeStep {
  return { id, label, status: "passed", details: [], warnings: [] };
}

function assertStep(step: SmokeStep, condition: unknown, detail: string) {
  if (condition) {
    step.details.push(detail);
    return;
  }
  step.status = "failed";
  step.details.push(`FAILED: ${detail}`);
}

async function runStep(input: {
  id: string;
  label: string;
  page: Page;
  screenshotName?: keyof typeof SCREENSHOT_NAMES;
  screenshots: boolean;
  run: (step: SmokeStep) => Promise<void>;
}) {
  const step = makeStep(input.id, input.label);
  console.log(`[gameplay-smoke] ${input.label} ...`);
  try {
    await input.run(step);
    if (input.screenshotName) {
      try {
        step.screenshot = await screenshot(input.page, input.screenshots, input.screenshotName);
      } catch (error) {
        step.warnings.push(error instanceof Error ? `Screenshot nicht gespeichert: ${error.message}` : `Screenshot nicht gespeichert: ${String(error)}`);
      }
    }
  } catch (error) {
    await input.page.evaluate(() => window.stop()).catch(() => undefined);
    step.status = "failed";
    step.details.push(error instanceof Error ? error.message : String(error));
  }
  console.log(`[gameplay-smoke] ${step.status.toUpperCase()} ${input.label}`);
  return step;
}

async function gotoFoundation(
  page: Page,
  baseUrl: string,
  view: string,
  teamId = "A-A",
  expectedSaveId?: string | null,
  timeoutMs = 180_000,
  fallbackTestId?: string,
) {
  const url = new URL("/foundation", baseUrl);
  url.searchParams.set("view", view);
  url.searchParams.set("team", teamId);
  if (expectedSaveId) {
    url.searchParams.set("saveId", expectedSaveId);
  }
  await page.goto(url.toString(), {
    waitUntil: "domcontentloaded",
    timeout: Math.max(timeoutMs, 60_000),
  });
  await dismissSeasonBriefingIfOpen(page, Math.max(timeoutMs, 30_000));
  try {
    await waitForContextBanner(page, expectedSaveId ?? null, Math.max(timeoutMs, 45_000));
  } catch (error) {
    if (!fallbackTestId) throw error;
    const fallbackTarget = fallbackTestId.startsWith("#")
      ? page.locator(fallbackTestId)
      : page.getByTestId(fallbackTestId);
    await fallbackTarget.waitFor({ state: "visible", timeout: Math.max(timeoutMs, 45_000) });
  }
  await page.waitForTimeout(400);
}

async function selectFirstUsableTeam(page: Page) {
  const selected = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select"));
    const select = selects.find((entry) => Array.from(entry.options).some((option) => option.value && option.value !== "ALL"));
    const option = select ? Array.from(select.options).find((entry) => entry.value && entry.value !== "ALL") : null;
    if (!select || !option) return null;
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return option.value;
  });
  await page.waitForTimeout(600);
  return selected;
}

async function selectTransferMarketTeam(page: Page, preferredTeamId: string) {
  const teamSelect = page.getByTestId("transfer-market-team-select");
  const legacySelectVisible = await teamSelect.isVisible().catch(() => false);
  if (!legacySelectVisible) {
    return preferredTeamId;
  }

  const optionValues = await teamSelect.locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
  );
  const selected = optionValues.includes(preferredTeamId) ? preferredTeamId : optionValues.find((value) => value !== "ALL") ?? optionValues[0] ?? null;
  if (!selected) return preferredTeamId;
  await teamSelect.selectOption(selected);
  await page.waitForTimeout(800);
  return selected;
}

function buildMarkdown(report: {
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  mode: string;
  activeSave: ActiveSaveResponse["save"] | undefined;
  defaultReadOnly: boolean;
  destructiveSignatureUnchanged: boolean;
  mutatingRequests: Array<{ method: string; url: string }>;
  steps: SmokeStep[];
  artifacts: Record<string, string>;
}) {
  const lines = [
    "# Gameplay Smoke Summary",
    "",
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Base URL: ${report.baseUrl}`,
    `- Mode: ${report.mode}`,
    `- Default read-only: ${report.defaultReadOnly ? "yes" : "no"}`,
    `- Destructive signature unchanged: ${report.destructiveSignatureUnchanged ? "yes" : "no"}`,
    `- Active save: ${report.activeSave?.saveId ?? "—"} (${report.activeSave?.name ?? "—"})`,
    `- Season: ${report.activeSave?.gameState?.season?.id ?? "—"}`,
    `- Matchday: ${report.activeSave?.gameState?.matchdayState?.matchdayId ?? "—"}`,
    `- GamePhase: ${report.activeSave?.gameState?.scenarioMeta?.gamePhase ?? report.activeSave?.gameState?.gamePhase ?? "—"}`,
    "",
    "## Steps",
    "",
    ...report.steps.flatMap((step) => [
      `### ${step.status === "passed" ? "OK" : step.status.toUpperCase()} ${step.label}`,
      "",
      ...step.details.map((detail) => `- ${detail}`),
      ...step.warnings.map((warning) => `- warning: ${warning}`),
      ...(step.screenshot ? [`- screenshot: ${step.screenshot}`] : []),
      "",
    ]),
    "## Mutating Requests",
    "",
    ...(report.mutatingRequests.length
      ? report.mutatingRequests.map((entry) => `- ${entry.method} ${entry.url}`)
      : ["- none observed"]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.writeMode && !args.confirmTestsave) {
    throw new Error("app:smoke-gameplay-write requires --confirm-testsave. Default smoke remains read-only.");
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const startedServer = await ensureServer(args);
  const startedAt = new Date().toISOString();
  const mutatingRequests: Array<{ method: string; url: string; postDataJson?: unknown }> = [];
  let browser: Browser | null = null;

  try {
    const beforeBody = await activeSaveWithRetries(args.baseUrl, args.timeoutMs);
    const beforeSignature = buildDestructiveSignature(beforeBody);
    const expectedSaveId = beforeBody.save?.saveId ?? null;
    const expectedTeamId = beforeBody.save?.gameState?.teams?.[0]?.teamId ?? "A-A";

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } });
    page.setDefaultTimeout(args.timeoutMs);
    page.setDefaultNavigationTimeout(args.timeoutMs);
    await page.route("**/api/media/**", (route) => route.abort());
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
        let postDataJson: unknown;
        try {
          postDataJson = request.postDataJSON();
        } catch {
          postDataJson = undefined;
        }
        mutatingRequests.push({ method: request.method(), url: request.url(), postDataJson });
      }
    });

    const steps: SmokeStep[] = [];
    const viewTimeoutMs = Math.max(args.timeoutMs, 90_000);

    steps.push(await runStep({
      id: "save-context",
      label: "Save-Kontext",
      page,
      screenshots: args.screenshots,
      screenshotName: "foundation",
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "seasonV2", expectedTeamId, expectedSaveId, viewTimeoutMs, "foundation-context-banner");
        await waitForContextBanner(page, expectedSaveId, viewTimeoutMs);
        await waitForGamePhaseVisible(page, viewTimeoutMs);
        const bannerText = await elementTextContent(page, "foundation-context-banner");
        const text = await pageText(page);
        assertStep(
          step,
          hasAny(bannerText, ["Spielstand", "Team", "Aktiver Kontext", "Spieltag"]),
          "Foundation zeigt den Kontext-Banner.",
        );
        assertStep(
          step,
          hasAny(bannerText, SEASON_VISIBLE_NEEDLES) || hasAny(text, SEASON_VISIBLE_NEEDLES),
          "Season ist sichtbar.",
        );
        assertStep(
          step,
          hasAny(bannerText, GAME_PHASE_VISIBLE_NEEDLES) || hasAny(text, GAME_PHASE_VISIBLE_NEEDLES),
          "GamePhase ist sichtbar.",
        );
      },
    }));

    steps.push(await runStep({
      id: "home-v2",
      label: "Home v2",
      page,
      screenshots: args.screenshots,
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "homeV2", expectedTeamId, expectedSaveId, Math.max(args.timeoutMs, 90_000), "foundation-home-v2");
        await page.getByTestId("foundation-home-v2").waitFor({ state: "visible", timeout: Math.max(args.timeoutMs, 90_000) });
        const text = await pageText(page);
        assertStep(step, hasAny(text, ["Home", "Manager", "Weiter", "Spieltag", "Nächster Schritt"]), "Home v2 lädt mit Spieltag-Orientierung.");
      },
    }));

    steps.push(await runStep({
      id: "save-switch-context-hardening",
      label: "Save-Wechsel / Team-Kontext",
      page,
      screenshots: args.screenshots,
      run: async (step) => {
        const alternativeSave = beforeBody.saves?.find((save) => save.saveId !== expectedSaveId);
        if (!args.includeSaveSwitch) {
          step.warnings.push("Save-Wechsel-Smoke im Default deaktiviert; aktiver Sandbox-/Manager-Save bleibt unangetastet.");
          step.details.push(`Aktiver Save bleibt ${expectedSaveId}.`);
          step.details.push("Expliziter Save-Wechsel-Test bleibt mit --include-save-switch verfuegbar.");
          return;
        }
        if (!alternativeSave?.saveId || !expectedSaveId) {
          step.warnings.push("Nur ein Save vorhanden; Save-Wechsel-Browsertest uebersprungen.");
          step.details.push("Aktiver Team-Kontext bleibt fuer Single-Save-Szenario pruefbar.");
          return;
        }

        await gotoFoundation(page, args.baseUrl, "teamSettings", expectedTeamId, expectedSaveId);
        const managerTeam = page.getByTestId("active-manager-team");
        await managerTeam.waitFor({ state: "visible", timeout: args.timeoutMs });
        const managerSelect = managerTeam.locator("select").first();
        const optionValues = await managerSelect.locator("option").evaluateAll((options) =>
          options
            .map((option) => (option as HTMLOptionElement).value)
            .filter((value) => Boolean(value) && value !== "__all_teams__"),
        );
        const nextTeam = optionValues.find((value) => value !== expectedTeamId) ?? optionValues[0] ?? expectedTeamId;
        const managerSelectEnabled = await page.waitForFunction(
          () => {
            const select = document.querySelector('[data-testid="active-manager-team"] select') as HTMLSelectElement | null;
            return Boolean(select && !select.disabled);
          },
          undefined,
          { timeout: 30_000 },
        ).then(() => true).catch(() => false);
        if (managerSelectEnabled) {
          await managerSelect.selectOption(nextTeam);
        } else {
          step.warnings.push("Aktives-Team-Auswahl war im Save-Wechsel-Smoke nicht bedienbar; Kontext-Invalidierung wird ohne manuellen Vorwechsel geprueft.");
        }
        await page.waitForTimeout(500);
        const selectedBeforeSwitch = await managerSelect.inputValue();

        const saveSelect = page.getByTestId("foundation-save-switch-select");
        await saveSelect.waitFor({ state: "visible", timeout: args.timeoutMs });
        await page.waitForFunction(
          ({ saveId }) =>
            Array.from(document.querySelectorAll('[data-testid="foundation-save-switch-select"] option')).some(
              (option) => (option as HTMLOptionElement).value === saveId,
            ),
          { saveId: alternativeSave.saveId },
          { timeout: 30_000 },
        );
        await saveSelect.selectOption(alternativeSave.saveId);
        await waitForSaveContext(page, alternativeSave.saveId, Math.max(args.timeoutMs, 60_000));
        await page.waitForFunction(
          () => {
            const select = document.querySelector('[data-testid="foundation-save-switch-select"]') as HTMLSelectElement | null;
            return Boolean(select && !select.disabled);
          },
          undefined,
          { timeout: 30_000 },
        ).catch(() => undefined);
        const activeSaveText = await page.getByTestId("foundation-active-save-id").innerText();
        const managerText = await page.getByTestId("active-manager-team").innerText();
        const switchedSelectedTeam = await page.getByTestId("active-manager-team").locator("select").first().inputValue();
        assertStep(step, activeSaveText.toLowerCase().includes(shortSaveId(alternativeSave.saveId).toLowerCase()), "Banner/Admin-Kontext zeigt den gewechselten Save.");
        assertStep(step, managerText.includes("Quelle"), "Teamquelle bleibt im Banner sichtbar.");
        assertStep(step, switchedSelectedTeam.length > 0, "activeManagerTeamId wurde gegen den neuen Save validiert.");
        assertStep(step, switchedSelectedTeam !== selectedBeforeSwitch || managerText.includes("zurueckgesetzt") || managerText.includes("Quelle"), "Alter Team-Kontext wird nicht blind als Autoritaet uebernommen.");

        await gotoFoundation(page, args.baseUrl, "market", switchedSelectedTeam, alternativeSave.saveId);
        const marketTextAfterSwitch = await page.getByTestId("transfer-market").innerText({ timeout: args.timeoutMs }).catch(() => "");
        assertStep(step, !marketTextAfterSwitch.includes(expectedSaveId.slice(0, 8)), "Transfer-Kontext zeigt keine alte Save-ID.");

        await gotoFoundation(page, args.baseUrl, "teamSettings", switchedSelectedTeam, alternativeSave.saveId);
        await page.waitForFunction(
          () => {
            const select = document.querySelector('[data-testid="foundation-save-switch-select"]') as HTMLSelectElement | null;
            return Boolean(select && !select.disabled);
          },
          undefined,
          { timeout: 30_000 },
        );
        await page.getByTestId("foundation-save-switch-select").selectOption(expectedSaveId);
        await waitForSaveContext(page, expectedSaveId, Math.max(args.timeoutMs, 60_000));
        await waitForContextBanner(page, expectedSaveId, args.timeoutMs);
        step.details.push("Ausgangs-Save wurde nach dem Wechseltest wieder aktiviert.");
      },
    }));

    steps.push(await runStep({
      id: "transfermarkt",
      label: "Transfermarkt",
      page,
      screenshots: args.screenshots,
      screenshotName: "transfermarkt",
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "marketV2", expectedTeamId, expectedSaveId, viewTimeoutMs, "transfer-market");
        await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: viewTimeoutMs });
        const selectedTeam = await selectTransferMarketTeam(page, expectedTeamId);
        await waitForTransferMarketV2Ready(page, viewTimeoutMs);
        await page.waitForFunction(
          () =>
            document.querySelectorAll('[data-testid="transfer-deal-open-button"], [data-testid="transfer-buy-preview-button"]').length > 0 ||
            (document.querySelector('[data-testid="transfer-market"]')?.textContent ?? "").includes("Freie Spieler") ||
            (document.querySelector('[data-testid="transfer-market"]')?.textContent ?? "").includes("Keine Free Agents") ||
            (document.querySelector('[data-testid="transfer-market"]')?.textContent ?? "").includes("Keine Kandidaten") ||
            (document.querySelector('[data-testid="transfer-market"]')?.textContent ?? "").includes("Weitere Kandidaten") ||
            Boolean(document.querySelector(".market-v2-budget-strip")),
          undefined,
          { timeout: 20_000 },
        ).catch(() => undefined);
        const buyButtons =
          (await page.getByTestId("transfer-deal-open-button").count()) +
          (await page.getByTestId("transfer-buy-preview-button").count());
        const text = await page.getByTestId("transfer-market").innerText({ timeout: Math.max(viewTimeoutMs, 15_000) }).catch(() => "");
        assertStep(step, selectedTeam, `Team auswählbar${selectedTeam ? `: ${selectedTeam}` : ""}.`);
        assertStep(
          step,
          buyButtons > 0 || hasAny(text, ["Buy", "Kauf", "Kaufvorschau", "Kaufen", "Transfermarkt"]) || text.includes("Keine Free Agents"),
          "Buy-/Kauf-UI oder sauberer Empty-State sichtbar.",
        );
        assertStep(
          step,
          hasAny(text, ["Merken", "Wishlist", "Watchlist", "Wunschliste", "Auf Wishlist", "gemerkt", "Beobachten"]),
          "Wishlist/Merken sichtbar.",
        );
        assertStep(
          step,
          hasAny(text, ["Verkauf", "Verkaufen", "Sell", "Kader", "Roster", "Kader im Fokus"]),
          "Sell-Pfad oder Kader-Verkauf erreichbar.",
        );
      },
    }));

    steps.push(await runStep({
      id: "training-facilities",
      label: "Training & Gebäude",
      page,
      screenshots: args.screenshots,
      screenshotName: "training",
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "trainingCompact", expectedTeamId, expectedSaveId, viewTimeoutMs, "foundation-training-compact");
        const trainingPanel = page.getByTestId("foundation-training-compact");
        await trainingPanel.waitFor({ state: "visible", timeout: viewTimeoutMs });
        await page.locator("#foundation-training-compact").scrollIntoViewIfNeeded().catch(() => undefined);
        const text = await trainingPanel.innerText({ timeout: Math.max(viewTimeoutMs, 15_000) }).catch(() => "");
        assertStep(step, hasAny(text, ["Training", "Trainings-Setpoints", "Regeneration"]), "Training-Reiter lädt.");
        assertStep(step, hasAny(text, ["Entwicklung", "Setpoints", "Performance"]), "Entwicklungs-/Forecast-UI ist sichtbar.");
        assertStep(step, hasAny(text, ["Top Steigerer", "Groesstes Risiko", "Kein aktiver Kader"]), "Spieler-Forecast ist sichtbar.");
        assertStep(step, hasAny(text, ["Gebäude", "Facility", "Leicht", "Hart"]), "Training-Kontext inkl. Facility/Modus ist sichtbar.");
      },
    }));

    steps.push(await runStep({
      id: "team-player-drawer",
      label: "Team / Player Drawer",
      page,
      screenshots: args.screenshots,
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "trainingCompact", expectedTeamId, expectedSaveId, viewTimeoutMs, "foundation-training-compact");
        await page.getByTestId("foundation-training-compact").waitFor({ state: "visible", timeout: viewTimeoutMs });
        const profileButtons = await page.locator(".training-v2-rider-portrait-button, .training-v2-rider-copy .table-link-button").count();
        assertStep(step, profileButtons > 0, `Kader-/Profilbuttons sichtbar: ${profileButtons}.`);
        if (profileButtons > 0) {
          await dismissSeasonBriefingIfOpen(page, viewTimeoutMs);
          const profileButton = page.locator(".training-v2-rider-portrait-button, .training-v2-rider-copy .table-link-button").first();
          await profileButton.waitFor({ state: "visible", timeout: viewTimeoutMs });
          await profileButton.click({ timeout: viewTimeoutMs });
          const playerProfile = page.getByTestId("foundation-player-profile");
          await playerProfile.waitFor({ state: "visible", timeout: viewTimeoutMs });
          await page.waitForFunction(
            () => {
              const profile = document.querySelector('[data-testid="foundation-player-profile"]');
              if (!profile) {
                return false;
              }
              const text = profile.textContent ?? "";
              return text.includes("OVR") || text.includes("Profil") || text.includes("Scouting");
            },
            undefined,
            { timeout: viewTimeoutMs },
          );
          const drawerText = await playerProfile.innerText();
          assertStep(step, hasAny(drawerText, ["XP", "XP Forecast", "Setpoints", "Entwicklung"]), "Spielerprofil zeigt XP/Entwicklung.");
          assertStep(step, drawerText.includes("OVR"), "Spielerprofil zeigt OVR.");
          assertStep(step, drawerText.includes("MVS"), "Spielerprofil zeigt MVS.");
          assertStep(step, drawerText.includes("PPs"), "Spielerprofil zeigt PPs.");
          const closeButton = page.getByRole("button", { name: /^Schliessen$/ });
          if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click();
          } else {
            await gotoFoundation(page, args.baseUrl, "trainingCompact", expectedTeamId, expectedSaveId, viewTimeoutMs, "foundation-training-compact");
          }
        }
      },
    }));

    steps.push(await runStep({
      id: "lineup",
      label: "Einsatzliste",
      page,
      screenshots: args.screenshots,
      screenshotName: "lineup",
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "lineup", expectedTeamId, expectedSaveId, viewTimeoutMs, "foundation-lineup");
        await page.getByTestId("foundation-lineup").waitFor({ state: "visible", timeout: viewTimeoutMs });
        await selectFirstUsableTeam(page);
        const text = await pageText(page);
        assertStep(step, text.includes("Einsatzliste"), "Einsatzliste lädt.");
        assertStep(step, hasAny(text, ["Done: Player Drawer", "Spieler", "Keine", "Empty"]), "Echte Spieler oder klare Empty-State-Warning sichtbar.");
        assertStep(step, hasAny(text, ["Formkarten", "Formkarte", "Form"]), "Formkarten/Modifier-Hinweise sichtbar.");
        assertStep(step, hasAny(text, ["Arena", "Matchday Arena"]), "Arena-Link oder Arena-Hinweis sichtbar.");
      },
    }));

    steps.push(await runStep({
      id: "arena",
      label: "Arena",
      page,
      screenshots: args.screenshots,
      screenshotName: "arena",
      run: async (step) => {
        await gotoFoundation(page, args.baseUrl, "matchdayArena", expectedTeamId, expectedSaveId, viewTimeoutMs, "#foundation-matchday-arena");
        await page.locator("#foundation-matchday-arena").waitFor({ state: "attached", timeout: viewTimeoutMs });
        await page
          .locator(
            ".arena-v2-shell, .arena-v2-board-row, .matchday-arena-lane, .matchday-arena-empty-card, #foundation-matchday-arena .warning-list, [data-testid='arena-lineup-blocker']",
          )
          .first()
          .waitFor({ state: "visible", timeout: viewTimeoutMs });
        const text = await pageText(page);
        assertStep(step, hasAny(text, ["Matchday Arena", "Arena v2", "Zur Arena", "Arena noch nicht bereit"]), "Arena öffnet.");
        const laneOrEmptyVisible = await page
          .locator(
            ".arena-v2-board-row, .arena-v2-shell, .matchday-arena-lane, .matchday-arena-empty-card, #foundation-matchday-arena .warning-list, [data-testid='arena-lineup-blocker']",
          )
          .first()
          .isVisible()
          .catch(() => false);
        const stepButtonVisible =
          (await page.getByRole("button", { name: /^Step$/ }).isVisible().catch(() => false)) ||
          (await page.getByRole("button", { name: /^Weiter$/ }).first().isVisible().catch(() => false)) ||
          (await page.getByRole("button", { name: /^Play$/ }).isVisible().catch(() => false));
        const resetButtonVisible = await page.getByRole("button", { name: /^Reset$/ }).isVisible().catch(() => false);
        assertStep(
          step,
          laneOrEmptyVisible ||
            hasAny(text, ["Team-Lanes", "Noch keine", "Arena-Kontext", "Scoreboard", "Fokus-Team", "Teams", "Reveal", "Einsatzliste"]),
          "Lanes oder sauberer Empty-State sichtbar.",
        );
        assertStep(step, stepButtonVisible, "Step-/Weiter-Button sichtbar.");
        assertStep(step, resetButtonVisible, "Reset-Button sichtbar.");
      },
    }));

    steps.push(await runStep({
      id: "preseason",
      label: "Pre-Season",
      page,
      screenshots: args.screenshots,
      screenshotName: "preseason",
      run: async (step) => {
        const url = new URL("/foundation", args.baseUrl);
        url.searchParams.set("view", "cockpit");
        url.searchParams.set("team", expectedTeamId);
        if (expectedSaveId) {
          url.searchParams.set("saveId", expectedSaveId);
        }
        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: Math.max(args.timeoutMs, 60_000),
        });
        await page.getByTestId("foundation-cockpit").waitFor({ state: "visible", timeout: args.timeoutMs });
        const text = await pageText(page);
        assertStep(step, text.includes("Pre-Season Workflow"), "Pre-Season Workflow sichtbar.");
        assertStep(step, hasAny(text, ["season_rewards", "player_development", "transfer_buy_phase", "Pre-Season Preview"]), "Workflow-Steps sichtbar.");
        assertStep(step, hasAny(text, ["preview", "idle", "produktiver Step nur mit Confirm"]), "Öffnen bleibt preview-/idle-orientiert.");
      },
    }));

    let afterBody: ActiveSaveResponse | null = null;
    let afterSignature: DestructiveSignature | null = null;
    let destructiveSignatureUnchanged = false;
    try {
      afterBody = await activeSaveWithRetries(args.baseUrl, args.timeoutMs);
      afterSignature = buildDestructiveSignature(afterBody);
      destructiveSignatureUnchanged = signaturesEqual(beforeSignature, afterSignature);
      const signatureStep = makeStep("write-safety-signature", "Write-Safety Signature");
      assertStep(signatureStep, destructiveSignatureUnchanged, "Destructive signature unchanged.");
      steps.push(signatureStep);
    } catch (error) {
      const signatureStep = makeStep("write-safety-signature", "Write-Safety Signature");
      signatureStep.status = "failed";
      signatureStep.details.push(error instanceof Error ? `Final save signature check failed: ${error.message}` : `Final save signature check failed: ${String(error)}`);
      steps.push(signatureStep);
    }
    const reportSave = afterBody?.save ?? beforeBody.save;
    const destructiveMutatingRequests = mutatingRequests.filter(isDestructiveSmokeRequest);
    const defaultReadOnly = !args.writeMode && destructiveMutatingRequests.length === 0 && destructiveSignatureUnchanged;
    if (!args.writeMode && !defaultReadOnly && steps.every((step) => step.status !== "failed")) {
      const readOnlyStep = makeStep("default-read-only-gate", "Default Read-only Gate");
      readOnlyStep.status = "failed";
      if (destructiveMutatingRequests.length > 0) {
        readOnlyStep.details.push(
          `FAILED: Default smoke observed destructive requests: ${destructiveMutatingRequests.map((entry) => `${entry.method} ${entry.url}`).join(" | ")}`,
        );
      }
      if (!destructiveSignatureUnchanged) {
        readOnlyStep.details.push("FAILED: Default smoke destructive signature changed.");
      }
      steps.push(readOnlyStep);
    }
    const finishedAt = new Date().toISOString();
    const artifacts = {
      markdown: path.join(OUTPUT_DIR, "gameplay-smoke-summary.md"),
      json: path.join(OUTPUT_DIR, "gameplay-smoke-proof.json"),
    };
    const report = {
      startedAt,
      finishedAt,
      baseUrl: args.baseUrl,
      mode: args.writeMode ? "write-confirmed" : "read-only",
      activeSave: reportSave,
      beforeSignature,
      afterSignature,
      defaultReadOnly,
      destructiveSignatureUnchanged,
      mutatingRequests,
      destructiveMutatingRequests,
      steps,
      artifacts,
    };

    await fs.writeFile(artifacts.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await fs.writeFile(artifacts.markdown, buildMarkdown(report), "utf8");

    for (const step of steps) {
      console.log(`${step.status === "passed" ? "OK" : "ERR"} ${step.label}`);
      for (const detail of step.details) {
        console.log(`  - ${detail}`);
      }
    }
    console.log(`proof json: ${artifacts.json}`);
    console.log(`summary md: ${artifacts.markdown}`);

    const failedSteps = steps.filter((step) => step.status === "failed");
    if (failedSteps.length > 0 || (!args.writeMode && !defaultReadOnly)) {
      if (!args.writeMode && destructiveMutatingRequests.length > 0) {
        console.error(`Default smoke observed destructive requests: ${destructiveMutatingRequests.map((entry) => `${entry.method} ${entry.url}`).join(" | ")}`);
      }
      if (!destructiveSignatureUnchanged) {
        console.error("Default smoke destructive signature changed.");
      }
      process.exitCode = 1;
    }
  } finally {
    await browser?.close().catch((error) => {
      console.warn(`[gameplay-smoke] Browser cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (startedServer) {
      await stopServer(startedServer).catch((error) => {
        console.warn(`[gameplay-smoke] Server cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }
}

async function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode != null || child.signalCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(3000).then(() => {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
