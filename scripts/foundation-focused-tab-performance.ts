import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { loadEnvConfig } from "@next/env";
import { chromium, type Browser, type Page, type Request, type Response } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_PATH = path.join(process.cwd(), "outputs", "foundation-tab-performance-audit", "focused-latest.json");
const TEAMS_READY_FALLBACK_MS = 30_000;

type TabStep = {
  navId: string;
  label: string;
  readySelector: string;
};

type TabMeasurement = {
  fromTab: string;
  toTab: string;
  durationMs: number;
  apiCallsCount: number;
  slowestApiMs: number;
  slowestApiPath: string;
  warnings: string[];
  status: "ok" | "slow" | "failed";
};

const FOCUSED_STEPS: TabStep[] = [
  { navId: "matchdayArena", label: "Arena", readySelector: "#foundation-matchday-arena:not(.foundation-section-hidden)" },
  { navId: "seasonV2", label: "Saisonstand", readySelector: '[data-testid="foundation-season-v2"]' },
  { navId: "teams", label: "Teams", readySelector: '[data-testid="foundation-teams-view"]' },
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
  };
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
  const logPath = path.join(process.cwd(), "outputs", "foundation-tab-performance-audit", "dev-server-focused.log");
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

function trackApiRequests(page: Page) {
  const requests = new Map<Request, { path: string; startedAt: number; finishedAt: number | null; durationMs: number | null }>();

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
      const slowest = finished.reduce<(typeof finished)[number] | null>((best, entry) => {
        if (!best || (entry.durationMs ?? 0) > (best.durationMs ?? 0)) return entry;
        return best;
      }, null);
      return {
        apiCallsCount: finished.length,
        slowestApiMs: slowest?.durationMs ?? 0,
        slowestApiPath: slowest?.path ?? "",
        warnings: [] as string[],
      };
    },
  };
}

async function measureTabSwitch(
  page: Page,
  fromTab: string,
  step: TabStep,
  tracker: ReturnType<typeof trackApiRequests>,
  timeoutMs: number,
): Promise<TabMeasurement> {
  await dismissSeasonBriefingIfPresent(page);
  tracker.reset();
  const startedAt = Date.now();
  const warnings: string[] = [];
  const readyTimeoutMs = step.navId === "teams" ? Math.min(TEAMS_READY_FALLBACK_MS, timeoutMs) : timeoutMs;

  try {
    await page.getByTestId(`foundation-nav-${step.navId}`).click({ timeout: timeoutMs });
    await page.locator(step.readySelector).first().waitFor({ state: "visible", timeout: readyTimeoutMs });
    await page.waitForTimeout(300);
  } catch (error) {
    return {
      fromTab,
      toTab: step.label,
      durationMs: Date.now() - startedAt,
      apiCallsCount: 0,
      slowestApiMs: 0,
      slowestApiPath: "",
      warnings: [error instanceof Error ? error.message : "tab_switch_failed"],
      status: "failed",
    };
  }

  const durationMs = Date.now() - startedAt;
  const api = tracker.snapshot();
  return {
    fromTab,
    toTab: step.label,
    durationMs,
    apiCallsCount: api.apiCallsCount,
    slowestApiMs: api.slowestApiMs,
    slowestApiPath: api.slowestApiPath,
    warnings,
    status: durationMs >= 8000 ? "slow" : "ok",
  };
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  const persistence = createPersistenceService();
  const activeSave = args.saveId ? persistence.getSaveById(args.saveId) : persistence.getActiveSave();
  if (!activeSave) {
    throw new Error("No active save found.");
  }

  const saveId = activeSave.saveId;
  const teamId =
    args.teamId ??
    activeSave.gameState.seasonState.newGameFlow?.selectedTeamId ??
    activeSave.gameState.teams.find((team) => team.humanControlled)?.teamId ??
    activeSave.gameState.teams[0]?.teamId;

  if (!teamId) {
    throw new Error("Could not resolve team id.");
  }

  let startedServer: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;

  try {
    startedServer = await ensureServer(args.baseUrl, args.noStart, args.timeoutMs);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } });
    page.setDefaultTimeout(args.timeoutMs);

    const tracker = trackApiRequests(page);
    const warmStartedAt = Date.now();
    await gotoFoundation(page, args.baseUrl, "matchdayArena", teamId, saveId, args.timeoutMs);
    await page.locator("#foundation-matchday-arena:not(.foundation-section-hidden)").first().waitFor({ state: "visible", timeout: args.timeoutMs });
    await dismissSeasonBriefingIfPresent(page);
    const warmLoadMs = Date.now() - warmStartedAt;

    const measurements: TabMeasurement[] = [];
    let fromTab = "Arena";

    for (const step of FOCUSED_STEPS.slice(1)) {
      measurements.push(await measureTabSwitch(page, fromTab, step, tracker, args.timeoutMs));
      fromTab = step.label;
    }

    const teamsStep = FOCUSED_STEPS[2];
    measurements.push({
      ...(await measureTabSwitch(page, teamsStep.label, teamsStep, tracker, args.timeoutMs)),
      fromTab: teamsStep.label,
      toTab: `${teamsStep.label} (revisit)`,
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      saveId,
      teamId,
      warmLoadMs,
      measurements,
    };
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (startedServer) startedServer.kill("SIGTERM");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
