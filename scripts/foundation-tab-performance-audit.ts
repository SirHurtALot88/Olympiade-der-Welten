import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { loadEnvConfig } from "@next/env";
import { chromium, type Browser, type Page, type Request, type Response } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "foundation-tab-performance-audit");
const DOCS_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v4.csv");
const DOCS_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v4.md");
const DOCS_V5_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v5.csv");
const DOCS_V5_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v5.md");
const DOCS_V6_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v6.csv");
const DOCS_V6_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v6.md");
const DOCS_V61_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v6.1.csv");
const DOCS_V61_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v6.1.md");
const DOCS_V61_COMPARISON_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v6.1-comparison.md");
const DOCS_V7_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v7.csv");
const DOCS_V7_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v7.md");
const DOCS_V8_CSV = path.join(process.cwd(), "docs", "tab-performance-hotspots-v8.csv");
const DOCS_V8_MD = path.join(process.cwd(), "docs", "tab-performance-hotspots-v8.md");

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

const TAB_STEPS: TabStep[] = [
  { navId: "homeV2", label: "Home", readySelector: '[data-testid="foundation-home-v2"]' },
  { navId: "inboxV2", label: "Inbox", readySelector: '[data-testid="foundation-inbox-v2"]' },
  { navId: "lineup", label: "Einsatzliste", readySelector: '[data-testid="foundation-lineup"]' },
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
  { navId: "diszis", label: "Diszis", readySelector: '[data-testid="foundation-diszis"]' },
  { navId: "prize", label: "Sponsoren", readySelector: '[data-testid="team-sponsor-choice"]:not(.foundation-section-hidden), [data-testid="foundation-sponsors"]:not(.foundation-section-hidden)' },
  { navId: "encyclopedia", label: "Lexikon", readySelector: '[data-testid="foundation-encyclopedia"]' },
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
    timeoutMs: Number(args.get("timeout-ms") ?? "90000"),
    noStart: args.get("no-start") === "true",
    saveId: args.get("save-id") ?? null,
    teamId: args.get("team-id") ?? null,
  };
}

function classifyStatus(durationMs: number): TabMeasurement["status"] {
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
  for (let attempt = 0; attempt < 90; attempt += 1) {
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

// The season-briefing modal auto-opens on season entry and its backdrop intercepts sidebar
// nav clicks (this is what made the Ranks->Diszis step time out in V6.1). Dismiss it before
// measuring so navigation is not blocked and the timing is not polluted by the modal.
async function dismissSeasonBriefingIfPresent(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  const visible = await backdrop.isVisible().catch(() => false);
  if (!visible) {
    return;
  }
  await page
    .getByRole("button", { name: "Später" })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await backdrop.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
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
      const lateFinishes = finished.filter((entry) => (entry.finishedAt ?? 0) > Date.now() - 50);
      return {
        apiCallsCount: finished.length,
        slowestApiMs: slowest?.durationMs ?? 0,
        slowestApiPath: slowest?.path ?? "",
        warnings: lateFinishes.length > 0 ? [`${lateFinishes.length} API responses still completing after ready`] : [],
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
    if (step.navId === "prize") {
      await page.getByTestId("foundation-subnav-sponsors").click({ timeout: timeoutMs }).catch(() => undefined);
    }
    try {
      await page.locator(step.readySelector).first().waitFor({ state: "visible", timeout: readyTimeoutMs });
    } catch (readyError) {
      if (step.navId !== "teams") {
        throw readyError;
      }
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
      if (!shellVisible) {
        throw readyError;
      }
    }
    await page.waitForTimeout(300);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    return {
      fromTab,
      toTab: step.label,
      durationMs,
      apiCallsCount: 0,
      slowestApiMs: 0,
      slowestApiPath: "",
      warnings: [error instanceof Error ? error.message : "tab_switch_failed"],
      status: "failed",
    };
  }

  const durationMs = Date.now() - startedAt;
  const api = tracker.snapshot();
  warnings.push(...api.warnings);
  if (durationMs >= 5000) {
    warnings.push("Tabwechsel >5s");
  }

  return {
    fromTab,
    toTab: step.label,
    durationMs,
    apiCallsCount: api.apiCallsCount,
    slowestApiMs: api.slowestApiMs,
    slowestApiPath: api.slowestApiPath,
    warnings,
    status: classifyStatus(durationMs),
  };
}

function buildMarkdownReport(input: {
  generatedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
  const lines = [
    "# Foundation Performance Hotspots V4",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Langsamster Tabwechsel: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms von ${slowest[0]?.fromTab ?? "—"})`,
    `- Geprüfte Tabs: ${input.measurements.length}`,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "## Messwerte V4",
    "",
    "| Von | Nach | V4 ms | API Calls | Langsamste API | Status | Befund |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...input.measurements.map((row) =>
      `| ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    "## Vergleich zu V3",
    "",
    "- V3-Fokus: paginierte Historie/Markt, Arena-Entkopplung, Recap lazy.",
    "- V4 ergänzt: **Sponsoren**-Navigation (Preisgeld-Untertab getrennt), Quick-Win `shouldLoadPrizePreviewFeed` nur auf Preisgeld-Subtab.",
    "- Monolith [`FoundationPageClient.tsx`](../app/foundation/FoundationPageClient.tsx) rendert weiterhin viele Panels per `foundation-section-hidden` statt Unmount.",
    "",
    "## Rest-Hotspots (statisch + Messung)",
    "",
    "1. Frischer Dev-Reload/Home bleibt schwer (HMR + großer Client).",
    "2. Arena-Server-Previews können nach Tabwechsel nachlaufen (V3 offen).",
    "3. Markt-Free-Agents oft 1–2s+ trotz Limit.",
    "4. Portraits/Logos feuern bei Tabellenwechseln breit.",
    "",
    "## Prioritäten",
    "",
    "| Prio | Thema | Hebel |",
    "| --- | --- | --- |",
    "| P0 | Sponsoren-Tab ohne Preisgeld-Fetch | erledigt in V4 (`prizeFinanceTab === \"prize\"`) |",
    "| P1 | FoundationPageClient entmounten / lazy routes | kleinere DOM-Fläche pro Tab |",
    "| P1 | Arena-Preview serverseitig abbrechen/cachen | weniger Nachlauf nach Tabwechsel |",
    "| P2 | Marktfilter serverseitig enger | weniger Free-Agent-Payload |",
    "",
    `CSV: [tab-performance-hotspots-v4.csv](./tab-performance-hotspots-v4.csv)`,
    "",
    `Backend-Audit: \`outputs/performance-audit.md\` via \`npm run perf:audit\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildV5MarkdownReport(input: {
  generatedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
  const lines = [
    "# Foundation Performance Hotspots V5",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Langsamster Tabwechsel: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms von ${slowest[0]?.fromTab ?? "—"})`,
    `- Geprüfte Tab-Schritte: ${input.measurements.length} (inkl. Training-Revisit)`,
    `- Save: \`${input.saveId}\`, Team: \`${input.teamId}\``,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "Siehe [V4 vs V5 Vergleich](./tab-performance-hotspots-v5-comparison.md) für Backend-Impact und Baseline-Delta.",
    "",
    "## Messwerte V5 (Rohdaten)",
    "",
    "| Von | Nach | V5 ms | API Calls | Langsamste API | Status | Befund |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...input.measurements.map((row) =>
      `| ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    `CSV: [tab-performance-hotspots-v5.csv](./tab-performance-hotspots-v5.csv)`,
    "",
    `Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via \`npm run perf:audit\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildV6MarkdownReport(input: {
  generatedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
  const lines = [
    "# Foundation Performance Hotspots V6",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Langsamster Tabwechsel: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms von ${slowest[0]?.fromTab ?? "—"})`,
    `- Geprüfte Tab-Schritte: ${input.measurements.length} (inkl. Training-Revisit)`,
    `- Save: \`${input.saveId}\`, Team: \`${input.teamId}\``,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "Siehe [V4/V5 vs V6 Vergleich](./tab-performance-hotspots-v6-comparison.md).",
    "",
    "## Messwerte V6 (Rohdaten)",
    "",
    "| Von | Nach | V6 ms | API Calls | Langsamste API | Status | Befund |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...input.measurements.map((row) =>
      `| ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    `CSV: [tab-performance-hotspots-v6.csv](./tab-performance-hotspots-v6.csv)`,
    "",
    `Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via \`npm run perf:audit\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildV61MarkdownReport(input: {
  generatedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
  const lines = [
    "# Foundation Performance Hotspots V6.1",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Langsamster Tabwechsel: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms von ${slowest[0]?.fromTab ?? "—"})`,
    `- Geprüfte Tab-Schritte: ${input.measurements.length} (inkl. Training-Revisit)`,
    `- Save: \`${input.saveId}\`, Team: \`${input.teamId}\``,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "Siehe [V6 vs V6.1 Vergleich](./tab-performance-hotspots-v6.1-comparison.md).",
    "",
    "## Messwerte V6.1 (Rohdaten)",
    "",
    "| Von | Nach | V6.1 ms | API Calls | Langsamste API | Status | Befund |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...input.measurements.map((row) =>
      `| ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    `CSV: [tab-performance-hotspots-v6.1.csv](./tab-performance-hotspots-v6.1.csv)`,
    "",
    `Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via \`npm run perf:audit\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildV7MarkdownReport(input: {
  generatedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
  const failed = input.measurements.filter((row) => row.status === "failed");
  const slowCount = input.measurements.filter((row) => row.status === "slow").length;
  const lines = [
    "# Foundation Performance Hotspots V7",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Langsamster Tabwechsel: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms von ${slowest[0]?.fromTab ?? "—"})`,
    `- Geprüfte Tab-Schritte: ${input.measurements.length} (inkl. Training-Revisit)`,
    `- Slow (>=8s): ${slowCount} · Failed: ${failed.length}`,
    `- Save: \`${input.saveId}\`, Team: \`${input.teamId}\``,
    `- Messung auf ruhiger Maschine (kein paralleler Long-Run-Sim, daher kein Version-Poll-Reload-Storm).`,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "## Messwerte V7 (Rohdaten)",
    "",
    "| Von | Nach | V7 ms | API Calls | Langsamste API | Status | Befund |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...input.measurements.map((row) =>
      `| ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    "## V7 Änderungen",
    "",
    "- Audit-Harness verwirft das Season-Briefing-Modal vor jeder Navigation (kein Backdrop-Intercept mehr -> Diszis/Sponsoren messbar).",
    "- Long-Run wird self-contained mit echtem Cash-Draft gefahren; Messung erfolgt ohne parallelen Sim, damit der 45s-Version-Poll nicht dauernd Full-Reloads triggert.",
    "",
    `CSV: [tab-performance-hotspots-v7.csv](./tab-performance-hotspots-v7.csv)`,
    "",
    `Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via \`npm run perf:audit\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildV8MarkdownReport(input: {
  generatedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  initialLoadMs: number;
  measurements: TabMeasurement[];
  browserErrors: string[];
}) {
  const slowest = [...input.measurements].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5);
  const failed = input.measurements.filter((row) => row.status === "failed");
  const slowCount = input.measurements.filter((row) => row.status === "slow").length;
  const lines = [
    "# Foundation Performance Hotspots V8",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Kurzfazit",
    "",
    `- Initialer Home-Load: **${input.initialLoadMs} ms**`,
    `- Langsamster Tabwechsel: **${slowest[0]?.toTab ?? "—"}** (${slowest[0]?.durationMs ?? 0} ms von ${slowest[0]?.fromTab ?? "—"})`,
    `- Geprüfte Tab-Schritte: ${input.measurements.length} (inkl. Training-Revisit)`,
    `- Slow (>=8s): ${slowCount} · Failed: ${failed.length}`,
    `- Save: \`${input.saveId}\`, Team: \`${input.teamId}\``,
    `- Messung auf ruhiger Maschine (kein paralleler Long-Run-Sim, daher kein Version-Poll-Reload-Storm).`,
    `- Browser-Errors: ${input.browserErrors.length === 0 ? "keine" : input.browserErrors.join("; ")}`,
    "",
    "## Messwerte V8 (Rohdaten)",
    "",
    "| Von | Nach | V8 ms | API Calls | Langsamste API | Status | Befund |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...input.measurements.map((row) =>
      `| ${row.fromTab} | ${row.toTab} | ${row.durationMs} | ${row.apiCallsCount} | ${row.slowestApiPath ? `${row.slowestApiPath} ${row.slowestApiMs}ms` : "—"} | ${row.status} | ${row.warnings.join("; ") || "—"} |`,
    ),
    "",
    "## V8 Änderungen",
    "",
    "- Top-Priority-Optimierungen: Teams, Spieler, Saisonstand, Training (siehe V8-comparison vs V7).",
    "",
    `CSV: [tab-performance-hotspots-v8.csv](./tab-performance-hotspots-v8.csv)`,
    "",
    `V7-Baseline: [tab-performance-hotspots-v8-comparison.md](./tab-performance-hotspots-v8-comparison.md)`,
    "",
    `Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via \`npm run perf:audit\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildV61ComparisonMarkdown(input: {
  generatedAt: string;
  v61Measurements: TabMeasurement[];
  initialLoadMs: number;
}) {
  const findMs = (toTab: string) => input.v61Measurements.find((row) => row.toTab === toTab)?.durationMs ?? null;
  const trainingMs = findMs("Training");
  const trainingRevisitMs = input.v61Measurements.find((row) => row.toTab.includes("Training (revisit)"))?.durationMs ?? null;
  const teamsMs = findMs("Teams");
  const marketMs = findMs("Transfermarkt");
  const sponsorsMs = findMs("Sponsoren");
  const lines = [
    "# Foundation Tab Performance — V6 vs V6.1",
    "",
    `Datum: ${input.generatedAt.slice(0, 10)}`,
    "",
    "## Delta (Browser-Audit)",
    "",
    "| Metrik | V6 gemessen | V6.1 gemessen | V6.1 Ziel |",
    "| --- | ---: | ---: | --- |",
    `| Initial Home | 10 000 ms | **${input.initialLoadMs} ms** | — |`,
    `| Spieler → Training | 89 000 ms | **${trainingMs ?? "—"} ms** | <15 000 ms |`,
    `| Training-Revisit | 25 500 ms | **${trainingRevisitMs ?? "—"} ms** | <3 000 ms |`,
    `| Teams | 37 000 ms | **${teamsMs ?? "—"} ms** | <10 000 ms |`,
    `| Transfermarkt | 12 000 ms | **${marketMs ?? "—"} ms** | warm <20 ms |`,
    `| Sponsoren-Audit | fail/timeout | **${sponsorsMs != null ? `${sponsorsMs} ms` : "—"}** | ok |`,
    "",
    "## V6.1 Änderungen",
    "",
    "- Archive-Sentinel + Snapshots-Slice-API statt Full-Reload auf Saisonstand/Diszis.",
    "- Auto-Persist + Version-Poll während Tab-Wechsel pausiert.",
    "- Training: Button-Nesting-Fix, initial Forecast-Batch 12.",
    "- Transfermarkt: Browse-Index + Lazy-Hydration für Compact-Liste.",
    "",
    `Rohdaten: [tab-performance-hotspots-v6.1.md](./tab-performance-hotspots-v6.1.md) · V6-Baseline: [tab-performance-hotspots-v6-comparison.md](./tab-performance-hotspots-v6-comparison.md)`,
    "",
  ];
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

    const measurements: TabMeasurement[] = [];
    let fromTab = "START";

    for (const step of TAB_STEPS) {
      if (step.navId === "homeV2" && fromTab === "START") {
        fromTab = step.label;
        continue;
      }
      const measurement = await measureTabSwitch(page, fromTab, step, tracker, args.timeoutMs);
      measurements.push(measurement);
      fromTab = step.label;

      if (step.navId === "teams") {
        const teamsRevisit = await measureTabSwitch(page, step.label, step, tracker, args.timeoutMs);
        measurements.push({
          ...teamsRevisit,
          fromTab: step.label,
          toTab: `${step.label} (revisit)`,
        });
      }

      if (step.navId === "trainingV2") {
        const trainingStep = TAB_STEPS.find((entry) => entry.navId === "trainingCompact");
        if (trainingStep) {
          const revisit = await measureTabSwitch(page, step.label, trainingStep, tracker, args.timeoutMs);
          measurements.push({
            ...revisit,
            fromTab: step.label,
            toTab: `${trainingStep.label} (revisit)`,
          });
        }
      }
    }

    const generatedAt = new Date().toISOString();
    const csvHeader = "fromTab,toTab,v8Ms,apiCallsCount,slowestApiMs,slowestApiPath,warnings,status";
    const csvBody = measurements
      .map((row) =>
        [
          csvEscape(row.fromTab),
          csvEscape(row.toTab),
          csvEscape(row.durationMs),
          csvEscape(row.apiCallsCount),
          csvEscape(row.slowestApiMs),
          csvEscape(row.slowestApiPath),
          csvEscape(row.warnings.join("; ")),
          csvEscape(row.status),
        ].join(","),
      )
      .join("\n");

    const csv = `${csvHeader}\n${csvBody}\nSTART,Home,${initialLoadMs},,,initial_load,,ok\n`;

    const browserErrorsTrimmed = [...new Set(browserErrors)].slice(0, 8);
    await fs.writeFile(DOCS_V8_CSV, csv, "utf8");
    await fs.writeFile(DOCS_V8_MD, buildV8MarkdownReport({
      generatedAt,
      baseUrl: args.baseUrl,
      saveId,
      teamId,
      initialLoadMs,
      measurements,
      browserErrors: browserErrorsTrimmed,
    }), "utf8");
    await fs.writeFile(path.join(OUTPUT_DIR, "latest-v8.json"), JSON.stringify({ generatedAt, saveId, teamId, initialLoadMs, measurements, browserErrors }, null, 2), "utf8");

    console.log(JSON.stringify({ ok: true, saveId, teamId, initialLoadMs, measurementCount: measurements.length, docs: { v8Md: DOCS_V8_MD, v8Csv: DOCS_V8_CSV } }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (startedServer) startedServer.kill("SIGTERM");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
