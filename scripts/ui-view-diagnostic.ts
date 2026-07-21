/* eslint-disable no-console */
// Focused UI diagnostic: loads each foundation view for a given save and records
// console errors, uncaught page errors, and whether the view rendered. NOT a product file —
// throwaway session tool for the human-playthrough triage.
import { chromium, type ConsoleMessage, type Page } from "playwright";

const BASE = process.env.DIAG_BASE ?? "http://127.0.0.1:3000";
const SAVE = process.env.DIAG_SAVE ?? "fresh-season-1-1784617810967";
const TEAM = process.env.DIAG_TEAM ?? "A-A";
const PER_VIEW_MS = Number(process.env.DIAG_TIMEOUT ?? "30000");
// Only override the browser binary when explicitly pointed at one (managed sandbox). Otherwise
// use Playwright's default resolution so this works in normal/CI setups too.
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH;

// [viewId, primary root testid to confirm render]
const VIEWS: Array<[string, string]> = [
  ["homeV2", "foundation-home-v2"],
  ["inboxV2", "foundation-inbox-v2"],
  ["lineup", "foundation-lineup"],
  ["matchdayArena", "foundation-matchday-arena"],
  ["seasonV2", "foundation-season-v2"],
  ["teams", "foundation-teams-view"],
  ["players", "nl-players-hub"],
  ["trainingCompact", "foundation-training-compact"],
  ["trainingV2", "facilities-v2-grid"],
  ["allTimeTable", "foundation-all-time-table"],
  ["marketV2", "transfer-market"],
  ["scoutingCenterV2", "foundation-scouting-hub-v2"],
  ["historyV2", ".nl-thist"],
  ["credits", "foundation-credits"],
  ["finances", "foundation-finances"],
  ["ranks", "foundation-ranks"],
  ["diszis", "foundation-diszis"],
  ["leagueLeaders", "foundation-league-leaders"],
  ["prize", "foundation-sponsors"],
  ["encyclopedia", "foundation-encyclopedia"],
  ["generator", "foundation-generator"],
  ["teamSettings", "foundation-team-settings"],
];

type ViewResult = {
  view: string;
  banner: boolean;
  rootTestid: string;
  rootRendered: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  bodySample: string;
};

function isNoiseError(text: string): boolean {
  return (
    // media aborts / generic resource load failures are not product bugs here
    text.includes("Failed to load resource") ||
    text.includes("net::ERR_FAILED") ||
    text.includes("net::ERR_ABORTED") ||
    text.includes("favicon") ||
    text.includes("Download the React DevTools")
  );
}

async function checkView(page: Page, view: string, rootTestid: string): Promise<ViewResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!isNoiseError(t)) consoleErrors.push(t.slice(0, 300));
    }
  };
  const onPageError = (err: Error) => pageErrors.push(`${err.name}: ${err.message}`.slice(0, 400));
  const onRequestFailed = (req: import("playwright").Request) => {
    const u = req.url();
    if (u.includes("/api/media/")) return;
    const errText = req.failure()?.errorText ?? "?";
    // ERR_ABORTED here is caused by our own navigation cancelling in-flight fetches, not a bug.
    if (errText.includes("ERR_ABORTED")) return;
    failedRequests.push(`${req.method()} ${u.replace(BASE, "")} — ${errText}`.slice(0, 200));
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  const url = new URL("/foundation", BASE);
  url.searchParams.set("view", view);
  url.searchParams.set("team", TEAM);
  url.searchParams.set("saveId", SAVE);

  let banner = false;
  let rootRendered = false;
  let bodySample = "";
  try {
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: PER_VIEW_MS });
    banner = await page
      .getByTestId("foundation-context-banner")
      .first()
      .waitFor({ state: "visible", timeout: PER_VIEW_MS })
      .then(() => true)
      .catch(() => false);
    const rootLocator = rootTestid.startsWith(".") || rootTestid.startsWith("#")
      ? page.locator(rootTestid)
      : page.getByTestId(rootTestid);
    rootRendered = await rootLocator
      .first()
      .waitFor({ state: "attached", timeout: PER_VIEW_MS })
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(1200); // let effects/fetches settle so late console errors surface
    bodySample = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 220);
  } catch (e) {
    pageErrors.push(`NAV: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
  }

  return { view, banner, rootTestid, rootRendered, consoleErrors, pageErrors, failedRequests, bodySample };
}

async function main() {
  const browser = await chromium.launch({ headless: true, ...(EXEC ? { executablePath: EXEC } : {}) });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1150 } });
  page.setDefaultTimeout(PER_VIEW_MS);
  await page.route("**/api/media/**", (route) => route.abort());

  const results: ViewResult[] = [];
  for (const [view, testid] of VIEWS) {
    const r = await checkView(page, view, testid);
    results.push(r);
    const flags: string[] = [];
    if (!r.banner) flags.push("NO-BANNER");
    if (!r.rootRendered) flags.push("NO-ROOT");
    if (r.pageErrors.length) flags.push(`PAGEERR×${r.pageErrors.length}`);
    if (r.consoleErrors.length) flags.push(`CONSOLE×${r.consoleErrors.length}`);
    if (r.failedRequests.length) flags.push(`REQFAIL×${r.failedRequests.length}`);
    console.log(`\n=== ${view} [${testid}] ${flags.length ? flags.join(" ") : "OK"}`);
    for (const p of r.pageErrors) console.log(`   PAGEERR: ${p}`);
    for (const c of r.consoleErrors) console.log(`   CONSOLE: ${c}`);
    for (const f of r.failedRequests) console.log(`   REQFAIL: ${f}`);
    if (!r.rootRendered) console.log(`   body: ${r.bodySample}`);
  }

  await browser.close();

  const problems = results.filter(
    (r) => !r.rootRendered || r.pageErrors.length || r.consoleErrors.length || r.failedRequests.length,
  );
  console.log(`\n\n===== SUMMARY: ${problems.length}/${results.length} views with issues =====`);
  for (const r of problems) {
    const parts: string[] = [];
    if (!r.rootRendered) parts.push("no-root");
    if (!r.banner) parts.push("no-banner");
    if (r.pageErrors.length) parts.push(`${r.pageErrors.length} pageerr`);
    if (r.consoleErrors.length) parts.push(`${r.consoleErrors.length} console`);
    if (r.failedRequests.length) parts.push(`${r.failedRequests.length} reqfail`);
    console.log(`  ${r.view}: ${parts.join(", ")}`);
  }
  console.log("===== END =====");
}

main().catch((e) => {
  console.error("DIAGNOSTIC FAILED:", e);
  process.exit(1);
});
