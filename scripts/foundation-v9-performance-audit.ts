/**
 * Foundation V9 — full nav + drilldown performance audit.
 * Run: npm run perf:foundation-v9 -- --no-start --timeout-ms 120000
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { loadEnvConfig } from "@next/env";
import { chromium, type Browser, type Page, type Request, type Response } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { PLAYER_PROFILE_TAB_ANCHORS, type PlayerProfileTabId } from "@/lib/foundation/player-profile-service";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "foundation-tab-performance-audit");
const DOCS_V9_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v9.csv");
const DOCS_V9_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v9.md");
const DOCS_V9_COMPARISON_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v9-comparison.md");
const DOCS_V8_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v8.csv");
const TEAMS_READY_FALLBACK_MS = 30_000;

type AuditMode = "chain" | "home_direct" | "drilldown" | "warmup";

type TabStep = {
  navId: string;
  label: string;
  readySelector: string;
  prizeSubnav?: boolean;
};

type TabMeasurement = {
  mode: AuditMode;
  fromTab: string;
  toTab: string;
  durationMs: number;
  apiCallsCount: number;
  slowestApiMs: number;
  slowestApiPath: string;
  warnings: string[];
  status: "ok" | "slow" | "failed";
  mainThreadHint: boolean;
};

const NAV_TAB_STEPS: TabStep[] = [
  { navId: "homeV2", label: "Home", readySelector: '[data-testid="foundation-home-v2"]' },
  { navId: "inboxV2", label: "Inbox", readySelector: '[data-testid="foundation-inbox-v2"]' },
  { navId: "lineup", label: "Einsatzliste", readySelector: '[data-testid="foundation-lineup"]' },
  { navId: "lineupV2", label: "Einsatzliste v2", readySelector: '[data-testid="foundation-lineup-v2"]' },
  { navId: "matchdayArena", label: "Arena", readySelector: "#foundation-matchday-arena:not(.foundation-section-hidden)" },
  { navId: "seasonV2", label: "Saisonstand", readySelector: '[data-testid="foundation-season-v2"]' },
  { navId: "teams", label: "Teams", readySelector: '[data-testid="foundation-teams-view"]' },
  { navId: "players", label: "Spieler", readySelector: "#players-table:not(.foundation-section-hidden)" },
  { navId: "trainingCompact", label: "Training", readySelector: '[data-testid="foundation-training-compact"]' },
  { navId: "trainingV2", label: "Gebäude", readySelector: '[data-testid="foundation-facilities-v2"]' },
  { navId: "marketV2", label: "Transfermarkt", readySelector: '[data-testid="transfer-market"]' },
  { navId: "scoutingCenterV2", label: "Scouting", readySelector: '[data-testid="foundation-scouting-hub-v2"]' },
  { navId: "historyV2", label: "Historie", readySelector: ".transfer-history-v2-shell" },
  { navId: "ranks", label: "Ranks", readySelector: "#discipline-ranks:not(.foundation-section-hidden)" },
  { navId: "diszis", label: "Diszis", readySelector: "#discipline-config:not(.foundation-section-hidden)" },
  { navId: "prize", label: "Sponsoren", readySelector: '[data-testid="team-sponsor-choice"]:not(.foundation-section-hidden), [data-testid="foundation-sponsors"]:not(.foundation-section-hidden)', prizeSubnav: true },
  { navId: "encyclopedia", label: "Lexikon", readySelector: '[data-testid="foundation-encyclopedia"]' },
  { navId: "cockpit", label: "Cockpit", readySelector: '[data-testid="foundation-cockpit"]' },
  { navId: "generator", label: "Generator", readySelector: '[data-testid="foundation-generator"]' },
  { navId: "teamSettings", label: "Settings", readySelector: '[data-testid="foundation-team-settings"]' },
  { navId: "admin", label: "Admin", readySelector: '[data-testid="foundation-admin"]' },
];

const PLAYER_PROFILE_TABS: PlayerProfileTabId[] = ["overview", "details", "contract", "training", "report", "career"];
const TEAM_DETAIL_TABS = [
  { id: "portraits", label: "Portraits", readySelector: '[data-testid="team-portraits-grid"]' },
  { id: "roster", label: "Kader", readySelector: '[data-testid="foundation-teams-view"][data-team-tab="roster"]' },
  { id: "contracts", label: "Verträge", readySelector: '[data-testid="foundation-teams-view"][data-team-tab="contracts"]' },
];

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
    saveId: args.get("save-id") ?? null,
    teamId: args.get("team-id") ?? null,
    skipWarmup: args.get("skip-warmup") === "true",
    skipHomeDirect: args.get("skip-home-direct") === "true",
  };
}

function classifyStatus(durationMs: number, failed: boolean): TabMeasurement["status"] {
  if (failed) return "failed";
  if (durationMs >= 8000) return "slow";
  return "ok";
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
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
  const logPath = path.join(OUTPUT_DIR, "dev-server.log");
  const logStream = createWriteStream(logPath, { flags: "a" });
  const child = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
  child.stdout.on("data", (chunk) => logStream.write(chunk));
  child.stderr.on("data", (chunk) => logStream.write(chunk));
  child.on("close", () => logStream.end());
  return child;
}

async function ensureServer(baseUrl: string, noStart: boolean, timeoutMs: number) {
  if (await isServerReachable(baseUrl, timeoutMs)) return null;
  if (noStart) {
    throw new Error(`Server not reachable at ${baseUrl}. Start dev server or omit --no-start.`);
  }
  const child = startServer();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await delay(1000);
    if (await isServerReachable(baseUrl, timeoutMs)) return child;
  }
  child.kill("SIGTERM");
  throw new Error(`Server did not become reachable at ${baseUrl}.`);
}

async function gotoFoundation(page: Page, baseUrl: string, view: string, teamId: string, saveId: string, timeoutMs: number) {
  const url = new URL("/foundation", baseUrl);
  url.searchParams.set("view", view);
  url.searchParams.set("team", teamId);
  url.searchParams.set("saveId", saveId);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: Math.max(timeoutMs, 60_000) });
  await page.getByTestId("foundation-context-banner").waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);
}

async function dismissSeasonBriefingIfPresent(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  const visible = await backdrop.isVisible().catch(() => false);
  if (!visible) return;
  await page.getByRole("button", { name: "Später" }).first().click({ timeout: 5_000 }).catch(() => undefined);
  await backdrop.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
}

async function goHome(
  page: Page,
  baseUrl: string,
  teamId: string,
  saveId: string,
  timeoutMs: number,
) {
  await dismissSeasonBriefingIfPresent(page);
  try {
    await page.getByTestId("foundation-nav-homeV2").click({ timeout: 15_000 });
    await page.locator('[data-testid="foundation-home-v2"]').first().waitFor({ state: "visible", timeout: Math.min(timeoutMs, 30_000) });
  } catch {
    await gotoFoundation(page, baseUrl, "homeV2", teamId, saveId, timeoutMs);
    await page.locator('[data-testid="foundation-home-v2"]').first().waitFor({ state: "visible", timeout: timeoutMs });
  }
}

type TrackedRequest = {
  path: string;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
};

function trackApiRequests(page: Page) {
  const requests = new Map<Request, TrackedRequest>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return;
    requests.set(request, { path: url.pathname, startedAt: Date.now(), finishedAt: null, durationMs: null });
  });

  page.on("response", (response: Response) => {
    const request = response.request();
    const tracked = requests.get(request);
    if (!tracked) return;
    tracked.finishedAt = Date.now();
    tracked.durationMs = tracked.finishedAt - tracked.startedAt;
  });

  return {
    reset() {
      requests.clear();
    },
    snapshot() {
      const finished = [...requests.values()].filter((entry) => entry.durationMs != null);
      const slowest = finished.reduce<TrackedRequest | null>((best, entry) => {
        if (!best || (entry.durationMs ?? 0) > (best.durationMs ?? 0)) return entry;
        return best;
      }, null);
      return {
        apiCallsCount: finished.length,
        slowestApiMs: slowest?.durationMs ?? 0,
        slowestApiPath: slowest?.path ?? "",
      };
    },
  };
}

function buildMeasurement(input: {
  mode: AuditMode;
  fromTab: string;
  toTab: string;
  durationMs: number;
  apiCallsCount: number;
  slowestApiMs: number;
  slowestApiPath: string;
  warnings: string[];
  failed?: boolean;
}): TabMeasurement {
  const warnings = [...input.warnings];
  if (input.durationMs >= 5000) warnings.push("Tabwechsel >5s");
  const mainThreadHint = input.apiCallsCount === 0 && input.durationMs >= 5000;
  if (mainThreadHint) warnings.push("main_thread_heavy");
  return {
    mode: input.mode,
    fromTab: input.fromTab,
    toTab: input.toTab,
    durationMs: input.durationMs,
    apiCallsCount: input.apiCallsCount,
    slowestApiMs: input.slowestApiMs,
    slowestApiPath: input.slowestApiPath,
    warnings,
    status: classifyStatus(input.durationMs, input.failed ?? false),
    mainThreadHint,
  };
}

async function clickNavTab(page: Page, step: TabStep, timeoutMs: number) {
  await page.getByTestId(`foundation-nav-${step.navId}`).click({ timeout: timeoutMs });
  if (step.prizeSubnav) {
    await page.getByTestId("foundation-subnav-sponsors").click({ timeout: timeoutMs }).catch(() => undefined);
  }
}

async function waitForReady(page: Page, step: TabStep, timeoutMs: number, warnings: string[]) {
  const readyTimeoutMs = step.navId === "teams" ? Math.min(TEAMS_READY_FALLBACK_MS, timeoutMs) : timeoutMs;
  try {
    await page.locator(step.readySelector).first().waitFor({ state: "visible", timeout: readyTimeoutMs });
  } catch (readyError) {
    if (step.navId !== "teams") throw readyError;
    const shellVisible = await page
      .locator('[data-testid="foundation-teams-view"], [data-testid="foundation-shell"]')
      .first()
      .isVisible()
      .catch(() => false);
    warnings.push(
      shellVisible
        ? `teams_ready_fallback_after_${readyTimeoutMs}ms`
        : readyError instanceof Error
          ? readyError.message
          : "teams_ready_timeout",
    );
    if (!shellVisible) throw readyError;
  }
}

async function measureNavSwitch(
  page: Page,
  mode: AuditMode,
  fromTab: string,
  step: TabStep,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
): Promise<TabMeasurement> {
  await dismissSeasonBriefingIfPresent(page);
  tracker.reset();
  const startedAt = Date.now();
  const warnings: string[] = [];
  try {
    await clickNavTab(page, step, timeoutMs);
    await waitForReady(page, step, timeoutMs, warnings);
    await page.waitForTimeout(300);
  } catch (error) {
    return buildMeasurement({
      mode,
      fromTab,
      toTab: step.label,
      durationMs: Date.now() - startedAt,
      apiCallsCount: 0,
      slowestApiMs: 0,
      slowestApiPath: "",
      warnings: [error instanceof Error ? error.message : "nav_switch_failed"],
      failed: true,
    });
  }
  const api = tracker.snapshot();
  return buildMeasurement({
    mode,
    fromTab,
    toTab: step.label,
    durationMs: Date.now() - startedAt,
    ...api,
    warnings,
  });
}

async function warmupNavTabs(
  page: Page,
  baseUrl: string,
  teamId: string,
  saveId: string,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
) {
  for (const step of NAV_TAB_STEPS) {
    if (step.navId === "homeV2") continue;
    await measureNavSwitch(page, "warmup", "Warmup", step, tracker, timeoutMs);
    await goHome(page, baseUrl, teamId, saveId, timeoutMs);
  }
}

async function measureSequentialChain(
  page: Page,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
): Promise<TabMeasurement[]> {
  const measurements: TabMeasurement[] = [];
  let fromTab = "START";
  for (const step of NAV_TAB_STEPS) {
    if (step.navId === "homeV2" && fromTab === "START") {
      fromTab = step.label;
      continue;
    }
    const measurement = await measureNavSwitch(page, "chain", fromTab, step, tracker, timeoutMs);
    measurements.push(measurement);
    fromTab = step.label;

    if (step.navId === "teams") {
      const revisit = await measureNavSwitch(page, "chain", step.label, step, tracker, timeoutMs);
      measurements.push({ ...revisit, fromTab: step.label, toTab: `${step.label} (revisit)` });
    }
    if (step.navId === "trainingV2") {
      const trainingStep = NAV_TAB_STEPS.find((entry) => entry.navId === "trainingCompact");
      if (trainingStep) {
        const revisit = await measureNavSwitch(page, "chain", step.label, trainingStep, tracker, timeoutMs);
        measurements.push({ ...revisit, fromTab: step.label, toTab: `${trainingStep.label} (revisit)` });
      }
    }
  }
  return measurements;
}

async function measureHomeDirectTabs(
  page: Page,
  baseUrl: string,
  teamId: string,
  saveId: string,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
): Promise<TabMeasurement[]> {
  const measurements: TabMeasurement[] = [];
  for (const step of NAV_TAB_STEPS) {
    if (step.navId === "homeV2") continue;
    await goHome(page, baseUrl, teamId, saveId, timeoutMs);
    const cold = await measureNavSwitch(page, "home_direct", "Home", step, tracker, timeoutMs);
    measurements.push({ ...cold, toTab: `${step.label} (cold)` });
    await goHome(page, baseUrl, teamId, saveId, timeoutMs);
    const warm = await measureNavSwitch(page, "home_direct", "Home", step, tracker, timeoutMs);
    measurements.push({ ...warm, toTab: `${step.label} (warm)` });
  }
  return measurements;
}

async function measureGenericInteraction(
  page: Page,
  mode: AuditMode,
  fromTab: string,
  toTab: string,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
  action: () => Promise<void>,
  ready: () => Promise<void>,
): Promise<TabMeasurement> {
  await dismissSeasonBriefingIfPresent(page);
  tracker.reset();
  const startedAt = Date.now();
  const warnings: string[] = [];
  try {
    await action();
    await ready();
    await page.waitForTimeout(300);
  } catch (error) {
    return buildMeasurement({
      mode,
      fromTab,
      toTab,
      durationMs: Date.now() - startedAt,
      apiCallsCount: 0,
      slowestApiMs: 0,
      slowestApiPath: "",
      warnings: [error instanceof Error ? error.message : "interaction_failed"],
      failed: true,
    });
  }
  const api = tracker.snapshot();
  return buildMeasurement({ mode, fromTab, toTab, durationMs: Date.now() - startedAt, ...api, warnings });
}

async function measureDrilldowns(
  page: Page,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
  baseUrl: string,
  teamId: string,
  saveId: string,
): Promise<TabMeasurement[]> {
  const measurements: TabMeasurement[] = [];

  // Spieler → Profil (cold)
  await goHome(page, baseUrl, teamId, saveId, timeoutMs);
  const playersStep = NAV_TAB_STEPS.find((entry) => entry.navId === "players")!;
  await measureNavSwitch(page, "warmup", "Home", playersStep, tracker, timeoutMs);

  measurements.push(
    await measureGenericInteraction(
      page,
      "drilldown",
      "Spieler",
      "Spielerprofil (cold)",
      tracker,
      timeoutMs,
      async () => {
        await page.locator("#players-table tbody tr").first().click({ timeout: timeoutMs });
      },
      async () => {
        await page.locator('[data-testid="foundation-player-profile-loading"]').waitFor({ state: "hidden", timeout: timeoutMs }).catch(() => undefined);
        await page.locator('[data-testid="foundation-player-profile"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      },
    ),
  );

  // Spieler → Profil (warm)
  measurements.push(
    await measureGenericInteraction(
      page,
      "drilldown",
      "Spielerprofil",
      "Spielerprofil (warm)",
      tracker,
      timeoutMs,
      async () => {
        await page.getByRole("button", { name: "Zurück" }).first().click({ timeout: 5000 }).catch(async () => {
          await page.getByTestId("foundation-nav-players").click({ timeout: timeoutMs });
        });
        await page.locator("#players-table tbody tr").first().click({ timeout: timeoutMs });
      },
      async () => {
        await page.locator('[data-testid="foundation-player-profile"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      },
    ),
  );

  // Spieler-Untertabs
  for (const tabId of PLAYER_PROFILE_TABS) {
    const anchor = PLAYER_PROFILE_TAB_ANCHORS[tabId];
    measurements.push(
      await measureGenericInteraction(
        page,
        "drilldown",
        "Spielerprofil",
        `Spieler-Tab ${tabId}`,
        tracker,
        timeoutMs,
        async () => {
          await page.getByTestId(`foundation-subnav-${tabId}`).click({ timeout: timeoutMs });
        },
        async () => {
          await page.locator(`#${anchor}`).first().waitFor({ state: "visible", timeout: timeoutMs });
        },
      ),
    );
  }

  // Teams → Teamprofil
  await goHome(page, baseUrl, teamId, saveId, timeoutMs);
  const teamsStep = NAV_TAB_STEPS.find((entry) => entry.navId === "teams")!;
  await measureNavSwitch(page, "warmup", "Home", teamsStep, tracker, timeoutMs);

  measurements.push(
    await measureGenericInteraction(
      page,
      "drilldown",
      "Teams",
      "Teamprofil (cold)",
      tracker,
      timeoutMs,
      async () => {
        await page.getByRole("button", { name: "Teamprofil" }).first().click({ timeout: timeoutMs });
      },
      async () => {
        await page.locator('[data-testid="foundation-team-profile"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      },
    ),
  );

  measurements.push(
    await measureGenericInteraction(
      page,
      "drilldown",
      "Teamprofil",
      "Teamprofil (warm)",
      tracker,
      timeoutMs,
      async () => {
        await page.getByRole("button", { name: "Schließen" }).first().click({ timeout: timeoutMs }).catch(async () => {
          await page.getByRole("button", { name: "Zurück" }).first().click({ timeout: 5000 }).catch(() => undefined);
        });
        await page.getByRole("button", { name: "Teamprofil" }).first().click({ timeout: timeoutMs });
      },
      async () => {
        await page.locator('[data-testid="foundation-team-profile"]').first().waitFor({ state: "visible", timeout: timeoutMs });
      },
    ),
  );

  // Teams-Untertabs (close team profile first)
  await page.getByRole("button", { name: "Schließen" }).first().click({ timeout: 5000 }).catch(() => undefined);
  await page.getByTestId("foundation-nav-teams").click({ timeout: timeoutMs }).catch(() => undefined);
  await page.locator('[data-testid="foundation-teams-view"]').first().waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);

  for (const tab of TEAM_DETAIL_TABS) {
    measurements.push(
      await measureGenericInteraction(
        page,
        "drilldown",
        "Teams",
        `Teams-Tab ${tab.label}`,
        tracker,
        timeoutMs,
        async () => {
          await page.getByTestId(`foundation-subnav-${tab.id}`).click({ timeout: timeoutMs });
        },
        async () => {
          await page.locator(tab.readySelector).first().waitFor({ state: "visible", timeout: timeoutMs });
        },
      ),
    );
  }

  // Deep-link Spielerprofil (playerId from URL after profile open)
  const playerId = await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("playerId");
  });
  if (playerId) {
    measurements.push(
      await measureGenericInteraction(
        page,
        "drilldown",
        "URL",
        "Spielerprofil Deep-Link",
        tracker,
        timeoutMs,
        async () => {
          const url = new URL("/foundation", baseUrl);
          url.searchParams.set("view", "playerProfile");
          url.searchParams.set("playerId", playerId);
          url.searchParams.set("team", teamId);
          url.searchParams.set("saveId", saveId);
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs });
        },
        async () => {
          await page.locator('[data-testid="foundation-player-profile"]').first().waitFor({ state: "visible", timeout: timeoutMs });
        },
      ),
    );
  }

  return measurements;
}

function buildV9MarkdownReport(input: {
  generatedAt: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 10);
  const failed = input.measurements.filter((row) => row.status === "failed");
  const slowCount = input.measurements.filter((row) => row.status === "slow").length;
  const mainThread = input.measurements.filter((row) => row.mainThreadHint);

  const lines = [
    "# Foundation Performance Hotspots V9",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Mess-Schritte gesamt: **${input.measurements.length}** (Chain + Home-direct + Drilldowns)`,
    `- Slow (>=8s): ${slowCount} · Failed: ${failed.length} · Main-Thread-Hinweise: ${mainThread.length}`,
    `- Save: \`${input.saveId}\`, Team: \`${input.teamId}\``,
    `- Langsamster Schritt: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms, Modus ${slowest[0]?.mode ?? "—"})`,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "## Messwerte V9",
    "",
    "| Modus | Von | Nach | ms | API | Langsamste API | Main-Thread | Status | Befund |",
    "| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |",
    ...input.measurements.map(
      (row) =>
        `| ${row.mode} | ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.mainThreadHint ? "ja" : "nein"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    "## Top-5 Hotspots",
    "",
    ...slowest.slice(0, 5).map((row, index) => `${index + 1}. **${row.toTab}** (${row.mode}): ${row.durationMs} ms — ${row.mainThreadHint ? "Main-Thread" : row.slowestApiPath || "—"}`),
    "",
    `CSV: [tab-performance-hotspots-v9.csv](./tab-performance-hotspots-v9.csv)`,
    "",
    `V8-Vergleich: [tab-performance-hotspots-v9-comparison.md](./tab-performance-hotspots-v9-comparison.md)`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function loadV8Baseline(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const csv = await fs.readFile(DOCS_V8_CSV, "utf8");
    for (const line of csv.split("\n").slice(1)) {
      if (!line.trim()) continue;
      const [fromTab, toTab, v8Ms] = line.split(",");
      if (fromTab && toTab && v8Ms) map.set(`${fromTab}->${toTab}`, Number(v8Ms));
    }
  } catch {
    // no v8 baseline
  }
  return map;
}

function buildV9ComparisonMarkdown(input: {
  generatedAt: string;
  measurements: TabMeasurement[];
  v8Baseline: Map<string, number>;
}) {
  const chainRows = input.measurements.filter((row) => row.mode === "chain");
  const lines = [
    "# Foundation Tab Performance — V8 vs V9",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Sequenzielle Chain (V8-vergleichbar)",
    "",
    "| Von | Nach | V8 ms | V9 ms | Δ | Status V9 |",
    "| --- | --- | ---: | ---: | ---: | --- |",
  ];

  for (const row of chainRows) {
    const key = `${row.fromTab}->${row.toTab}`;
    const v8 = input.v8Baseline.get(key);
    const delta = v8 != null ? row.durationMs - v8 : null;
    lines.push(
      `| ${row.fromTab} | ${row.toTab} | ${v8 ?? "—"} | **${row.durationMs}** | ${delta != null ? (delta > 0 ? `+${delta}` : delta) : "—"} | ${row.status} |`,
    );
  }

  lines.push(
    "",
    "## Neue V9-Abdeckung",
    "",
    "- **Home-direct cold/warm** pro Nav-Tab (20 Tabs)",
    "- **Drilldowns:** Spielerprofil cold/warm, 6 Untertabs, Teamprofil cold/warm, 3 Teams-Untertabs, Deep-Link",
    "- **Admin-Gruppe:** Cockpit, Generator, Settings, Admin",
    "",
    "## Optimierungs-Backlog (Hypothesen → im Lauf verifiziert)",
    "",
    "Siehe Abschnitt Top-5 in [tab-performance-hotspots-v9.md](./tab-performance-hotspots-v9.md).",
    "",
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const persistence = createPersistenceService();
  const activeSave = args.saveId ? persistence.getSaveById(args.saveId) : persistence.getActiveSave();
  if (!activeSave) {
    throw new Error("No active save found. Pass --save-id or bootstrap a save first.");
  }

  const saveId = activeSave.saveId;
  const teamId =
    args.teamId ??
    activeSave.gameState.seasonState.newGameFlow?.selectedTeamId ??
    activeSave.gameState.teams.find((team) => team.humanControlled)?.teamId ??
    activeSave.gameState.teams[0]?.teamId;

  if (!teamId) {
    throw new Error("Could not resolve team id for tab audit.");
  }

  let startedServer: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  const browserErrors: string[] = [];

  try {
    startedServer = await ensureServer(args.baseUrl, args.noStart, args.timeoutMs);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } });
    page.setDefaultTimeout(args.timeoutMs);
    page.setDefaultNavigationTimeout(args.timeoutMs);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    const tracker = trackApiRequests(page);
    const initialStartedAt = Date.now();
    await gotoFoundation(page, args.baseUrl, "homeV2", teamId, saveId, args.timeoutMs);
    await page.locator('[data-testid="foundation-home-v2"]').first().waitFor({ state: "visible", timeout: args.timeoutMs });
    const initialLoadMs = Date.now() - initialStartedAt;
    await dismissSeasonBriefingIfPresent(page);

    if (!args.skipWarmup) {
      console.log("V9 warmup: visiting all nav tabs from Home …");
      await warmupNavTabs(page, args.baseUrl, teamId, saveId, tracker, args.timeoutMs);
      await goHome(page, args.baseUrl, teamId, saveId, args.timeoutMs);
    }

    const measurements: TabMeasurement[] = [];
    measurements.push(
      buildMeasurement({
        mode: "chain",
        fromTab: "START",
        toTab: "Home",
        durationMs: initialLoadMs,
        apiCallsCount: 0,
        slowestApiMs: 0,
        slowestApiPath: "",
        warnings: ["initial_load"],
      }),
    );

    console.log("V9 chain audit …");
    measurements.push(...(await measureSequentialChain(page, tracker, args.timeoutMs)));

    if (!args.skipHomeDirect) {
      console.log("V9 home-direct audit …");
      try {
        measurements.push(...(await measureHomeDirectTabs(page, args.baseUrl, teamId, saveId, tracker, args.timeoutMs)));
      } catch (error) {
        browserErrors.push(error instanceof Error ? error.message : "home_direct_failed");
      }
    }

    console.log("V9 drilldown audit …");
    try {
      measurements.push(...(await measureDrilldowns(page, tracker, args.timeoutMs, args.baseUrl, teamId, saveId)));
    } catch (error) {
      browserErrors.push(error instanceof Error ? error.message : "drilldown_failed");
    }

    const generatedAt = new Date().toISOString();
    const v8Baseline = await loadV8Baseline();
    const csvHeader =
      "mode,fromTab,toTab,durationMs,apiCallsCount,slowestApiMs,slowestApiPath,mainThreadHint,warnings,status";
    const csvBody = measurements
      .map((row) =>
        [
          csvEscape(row.mode),
          csvEscape(row.fromTab),
          csvEscape(row.toTab),
          csvEscape(row.durationMs),
          csvEscape(row.apiCallsCount),
          csvEscape(row.slowestApiMs),
          csvEscape(row.slowestApiPath),
          csvEscape(row.mainThreadHint ? "yes" : "no"),
          csvEscape(row.warnings.join("; ")),
          csvEscape(row.status),
        ].join(","),
      )
      .join("\n");

    const browserErrorsTrimmed = [...new Set(browserErrors)].slice(0, 12);
    await fs.writeFile(DOCS_V9_CSV, `${csvHeader}\n${csvBody}\n`, "utf8");
    await fs.writeFile(
      DOCS_V9_MD,
      buildV9MarkdownReport({
        generatedAt,
        saveId,
        teamId,
        initialLoadMs,
        measurements,
        browserErrors: browserErrorsTrimmed,
      }),
      "utf8",
    );
    await fs.writeFile(
      DOCS_V9_COMPARISON_MD,
      buildV9ComparisonMarkdown({ generatedAt, measurements, v8Baseline }),
      "utf8",
    );
    await fs.writeFile(
      path.join(OUTPUT_DIR, "latest-v9.json"),
      JSON.stringify({ generatedAt, saveId, teamId, initialLoadMs, measurements, browserErrors: browserErrorsTrimmed }, null, 2),
      "utf8",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          saveId,
          teamId,
          initialLoadMs,
          measurementCount: measurements.length,
          docs: { v9Md: DOCS_V9_MD, v9Csv: DOCS_V9_CSV, comparison: DOCS_V9_COMPARISON_MD },
        },
        null,
        2,
      ),
    );
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (startedServer) startedServer.kill("SIGTERM");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
