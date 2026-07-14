/**
 * UI Generalprobe — Season 1 (and, in a later continuation, S2/S3) browser-driven playthrough.
 *
 * Drives the real /foundation UI with Playwright exactly the way a human would: sidebar clicks,
 * the global "Weiter" progression button, buy/sell/sponsor/facility/training/lineup interactions,
 * and the matchday-arena "Spieltag abschliessen" loop. Captures a screenshot of every system and
 * writes a findings log (bugs + usability friction), not just a pass/fail signal.
 *
 * Reuses the page-object patterns from scripts/smoke-gameplay.ts (gotoFoundation, season-briefing
 * dismissal, context-banner/game-phase waits, transfer-market-ready wait) and follows the season
 * lifecycle order encoded in scripts/full-season-ui-playthrough.ts (buy/sell -> sponsor -> facility
 * -> training -> finalize transfers -> lineup -> matchday loop).
 *
 * Always operates on a THROWAWAY sqlite copy (never the repo's real data/persistence/oly-app.sqlite)
 * so runs are safely resettable.
 *
 * Usage:
 *   npx tsx scripts/ui-playthrough-s1-s3.ts [--base-url=http://localhost:3100] [--no-start]
 *     [--sqlite-source=data/persistence/oly-app.sqlite] [--keep-db] [--headed]
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3100";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "ui-generalprobe");
const S1_SHOT_DIR = path.join(OUTPUT_DIR, "s1");
const FINDINGS_PATH = path.join(OUTPUT_DIR, "s1-findings.md");

type FindingSeverity = "info" | "friction" | "bug" | "blocker";

type Finding = {
  system: string;
  severity: FindingSeverity;
  text: string;
};

type SystemStatus = "ok" | "partial" | "failed" | "skipped";

type SystemResult = {
  id: string;
  label: string;
  status: SystemStatus;
  screenshot: string | null;
  notes: string[];
};

const systemResults: SystemResult[] = [];
const findings: Finding[] = [];

function note(system: string, severity: FindingSeverity, text: string) {
  findings.push({ system, severity, text });
  const tag = severity.toUpperCase();
  console.log(`[finding][${tag}][${system}] ${text}`);
}

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
    noStart: args.get("no-start") === "true",
    sqliteSource: args.get("sqlite-source") ?? path.join(process.cwd(), "data", "persistence", "oly-app.sqlite"),
    sqliteThrowaway: args.get("sqlite-throwaway") ?? null,
    keepDb: args.get("keep-db") === "true",
    headed: args.get("headed") === "true",
    timeoutMs: Number(args.get("timeout-ms") ?? "90000"),
    teamId: args.get("team-id") ?? null,
  };
}

// ---------------------------------------------------------------------------
// Server + throwaway DB bootstrap
// ---------------------------------------------------------------------------

function resolveChromiumExecutablePath(): string | null {
  const browsersRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersRoot || !fsSync.existsSync(browsersRoot)) return null;
  const entries = fsSync.readdirSync(browsersRoot).filter((entry) => entry.startsWith("chromium-"));
  for (const entry of entries) {
    const candidate = path.join(browsersRoot, entry, "chrome-linux", "chrome");
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return null;
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

function startServer(port: string, sqlitePath: string) {
  // `npm run dev` -> `tsx server.ts` is a chain of shell/process wrappers. A plain
  // SIGTERM to the immediate child does not reliably propagate to those descendants
  // (observed in practice: the actual "tsx server.ts" node process survives and keeps
  // the port bound). Spawn detached so this subtree gets its own process group, and
  // kill the whole group (negative PID) on stop.
  const child = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, OLY_APP_SQLITE_PATH: sqlitePath },
    stdio: "pipe",
    detached: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[ui-s1-server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[ui-s1-server] ${chunk}`));
  return child;
}

async function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode != null || child.signalCode != null) return;
  const pid = child.pid;
  const killGroup = (signal: NodeJS.Signals) => {
    if (!pid) return;
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // process/group already gone
      }
    }
  };
  killGroup("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(3000).then(() => {
      if (child.exitCode == null && child.signalCode == null) killGroup("SIGKILL");
    }),
  ]);
}

async function fetchJson<T>(baseUrl: string, pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store", ...init });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${pathname} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// Page-object helpers (adapted from scripts/smoke-gameplay.ts)
// ---------------------------------------------------------------------------

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
  await page.waitForTimeout(300);
}

async function waitForContextBanner(page: Page, timeoutMs: number) {
  await page.getByTestId("foundation-context-banner").waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);
}

async function gotoFoundation(page: Page, baseUrl: string, view: string, teamId: string, saveId: string, timeoutMs: number) {
  const url = new URL("/foundation", baseUrl);
  url.searchParams.set("view", view);
  url.searchParams.set("team", teamId);
  url.searchParams.set("saveId", saveId);
  url.searchParams.set("source", "sqlite");
  // page.goto occasionally races a still-in-flight prior navigation/fetch behind the dev
  // proxy (net::ERR_ABORTED) — this is transient infra flakiness, not a product bug, so
  // retry a couple of times before giving up.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: Math.max(timeoutMs, 60_000) });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await delay(800);
    }
  }
  if (lastError) throw lastError;
  await dismissSeasonBriefingIfOpen(page, Math.max(timeoutMs, 20_000));
  await waitForContextBanner(page, Math.max(timeoutMs, 30_000));
  await page.waitForTimeout(400);
}

async function screenshot(page: Page, filename: string) {
  const filePath = path.join(S1_SHOT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function clickGlobalNext(page: Page, timeoutMs: number) {
  const btn = page.getByTestId("foundation-global-next-button");
  await btn.waitFor({ state: "visible", timeout: timeoutMs });
  await dismissSeasonBriefingIfOpen(page, 10_000);
  await btn.click({ timeout: timeoutMs });
  await page.waitForTimeout(700);
}

async function activeSave(baseUrl: string, saveId: string) {
  return fetchJson<{
    save?: {
      saveId: string;
      gameState?: {
        gamePhase?: string;
        matchdayState?: { matchdayId?: string; status?: string };
        teams?: Array<{ teamId: string; cash?: number; name?: string; rosterOptTarget?: number }>;
        rosters?: Array<{ teamId: string }>;
        seasonState?: { teamControlSettings?: Record<string, { controlMode?: string }> };
      };
    };
  }>(baseUrl, `/api/singleplayer-state?saveId=${encodeURIComponent(saveId)}`);
}

async function rosterCountForTeam(baseUrl: string, saveId: string, teamId: string) {
  const body = await activeSave(baseUrl, saveId);
  const rosters = body.save?.gameState?.rosters ?? [];
  return rosters.filter((entry) => entry.teamId === teamId).length;
}

// ---------------------------------------------------------------------------
// System drivers
// ---------------------------------------------------------------------------

async function runSystem(
  id: string,
  label: string,
  fn: (result: SystemResult) => Promise<void>,
): Promise<SystemResult> {
  const result: SystemResult = { id, label, status: "ok", screenshot: null, notes: [] };
  console.log(`\n=== [${id}] ${label} ===`);
  try {
    await fn(result);
  } catch (error) {
    result.status = "failed";
    const message = error instanceof Error ? error.message : String(error);
    result.notes.push(`Exception: ${message}`);
    note(label, "bug", `Unhandled exception during "${label}": ${message.slice(0, 400)}`);
  }
  systemResults.push(result);
  console.log(`=== [${id}] ${label}: ${result.status.toUpperCase()} ===`);
  return result;
}

async function driveTeamSettings(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("team-settings", "Team Settings (Team-Zuordnung)", async (result) => {
    await gotoFoundation(page, baseUrl, "teamSettings", teamId, saveId, timeoutMs);
    // "Team-Zuordnung" lives under the "Spielmodus & KI" sub-tab, not the default
    // "Spielstände & Start" tab that teamSettings lands on.
    const controlTab = page.getByRole("button", { name: "Spielmodus & KI" });
    const controlTabVisible = await controlTab.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (controlTabVisible) {
      await controlTab.click();
      await page.waitForTimeout(400);
      note(
        "Team Settings",
        "friction",
        "'Dein Team wählen' (solo-player-team-select) sitzt unter Settings → Sub-Tab 'Spielmodus & KI', nicht auf dem Default-Tab 'Spielstände & Start', den teamSettings zuerst zeigt. Kein Flow-Blocker/Deep-Link routet dorthin — ein Mensch müsste das selbst finden.",
      );
    } else {
      note("Team Settings", "friction", "Sub-Tab 'Spielmodus & KI' nicht gefunden — versuche solo-player-team-select direkt.");
    }
    const select = page.getByTestId("solo-player-team-select");
    const selectVisible = await select.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!selectVisible) {
      result.status = "failed";
      note("Team Settings", "blocker", "solo-player-team-select nicht sichtbar — Team-Zuordnung (manuelles Team wählen) über UI nicht erreichbar.");
      result.screenshot = await screenshot(page, "s1-00-team-settings-blocked.png");
      return;
    }
    await select.selectOption(teamId);
    await page.waitForTimeout(300);
    // Multiple "Lokal speichern" buttons exist on this page (header actions + per-card
    // actions duplicated across sub-tabs) — take the first, matching human click behavior.
    const saveButton = page.getByRole("button", { name: "Lokal speichern" }).first();
    await saveButton.waitFor({ state: "visible", timeout: timeoutMs });
    const disabled = await saveButton.isDisabled().catch(() => false);
    if (disabled) {
      result.status = "failed";
      note("Team Settings", "bug", "'Lokal speichern' Button ist deaktiviert, obwohl ein Team im Solo-Select gewählt wurde.");
      result.screenshot = await screenshot(page, "s1-00-team-settings-disabled.png");
      return;
    }
    await saveButton.click();
    await page.waitForTimeout(1200);
    result.screenshot = await screenshot(page, "s1-00-team-settings.png");

    const body = await activeSave(baseUrl, saveId);
    const controlMode = body.save?.gameState?.seasonState?.teamControlSettings?.[teamId]?.controlMode;
    if (controlMode !== "manual") {
      result.status = "failed";
      note(
        "Team Settings",
        "blocker",
        `Nach Klick auf "Lokal speichern" ist controlMode für ${teamId} weiterhin "${controlMode}" statt "manual". Team-Zuordnung wurde nicht persistiert.`,
      );
      return;
    }
    result.notes.push(`Team ${teamId} ist jetzt manual/human-controlled.`);
  });
}

async function driveHome(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("hq", "HQ / Home v2", async (result) => {
    await gotoFoundation(page, baseUrl, "homeV2", teamId, saveId, timeoutMs);
    await page.getByTestId("foundation-home-v2").first().waitFor({ state: "visible", timeout: timeoutMs });
    const text = await page.locator("body").innerText().catch(() => "");
    result.screenshot = await screenshot(page, "s1-01-hq.png");
    if (!/Weiter|Spieltag|Season|Saison/i.test(text)) {
      result.status = "partial";
      note("HQ", "friction", "Home v2 zeigt keine erkennbare Season/Spieltag-Orientierung im sichtbaren Text.");
    }
    result.notes.push("Home v2 geladen.");
  });
}

async function waitForMarketCandidatesSettled(page: Page, timeoutMs: number) {
  // The transfermarkt market-pool fetch (free-agents) can take several seconds behind
  // the proxy; a fixed short sleep races it. Wait for either real candidate cards or an
  // explicit "no candidates" / not-loading state before deciding the list is empty.
  await page
    .waitForFunction(
      () => {
        const root = document.querySelector('[data-testid="transfer-market"]');
        if (!root) return false;
        const cardCount = root.querySelectorAll('[data-testid="transfer-candidate-card"]').length;
        if (cardCount > 0) return true;
        const text = root.textContent ?? "";
        const stillLoading = /Kandidaten laden/i.test(text);
        return !stillLoading;
      },
      undefined,
      { timeout: Math.max(timeoutMs, 25_000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function driveMarketBuy(
  page: Page,
  baseUrl: string,
  teamId: string,
  saveId: string,
  timeoutMs: number,
  targetRosterCount: number,
  maxBuys: number,
) {
  return runSystem("market-buy", "Transfermarkt — Kaufen", async (result) => {
    await gotoFoundation(page, baseUrl, "marketV2", teamId, saveId, timeoutMs);
    await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: timeoutMs });
    await waitForMarketCandidatesSettled(page, timeoutMs);

    let buys = 0;
    let firstShotTaken = false;
    let consecutiveBudgetRejections = 0;
    let loggedRejectionCount = 0;
    for (let attempt = 0; attempt < maxBuys; attempt += 1) {
      const rosterCount = await rosterCountForTeam(baseUrl, saveId, teamId);
      if (rosterCount >= targetRosterCount) {
        result.notes.push(`Zielkadergröße erreicht: ${rosterCount}/${targetRosterCount}.`);
        break;
      }
      await waitForMarketCandidatesSettled(page, timeoutMs);
      const cards = page.getByTestId("transfer-candidate-card");
      const cardCount = await cards.count().catch(() => 0);
      if (cardCount === 0) {
        note("Transfermarkt Kaufen", "blocker", `Keine transfer-candidate-card sichtbar nach ${buys} Käufen (Kader ${rosterCount}) — Kaderaufbau blockiert.`);
        result.status = buys > 0 ? "partial" : "failed";
        break;
      }
      await cards.first().click({ timeout: timeoutMs });
      const dealBtn = page.getByTestId("transfer-deal-open-button");
      const dealVisible = await dealBtn.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
      if (!dealVisible) {
        note("Transfermarkt Kaufen", "friction", "Kandidaten-Card angeklickt, aber kein transfer-deal-open-button erschienen — evtl. anderer Kandidat gewählt.");
        continue;
      }
      const dealOpenDisabled = await dealBtn.isDisabled().catch(() => false);
      if (dealOpenDisabled) {
        note("Transfermarkt Kaufen", "friction", `'Deal prüfen' deaktiviert bei Versuch ${attempt + 1} — Kandidat übersprungen.`);
        continue;
      }
      await dealBtn.click({ timeout: timeoutMs });
      // The deal-preview dry-run fetch takes a moment after opening the deal page.
      await page.waitForTimeout(1500);

      // Buy requires an explicit negotiation step first ("Verhandeln"): the offer can be
      // accepted, countered (offer auto-adjusts, retry), or rejected (dead end for this
      // candidate). Only once accepted does transfer-buy-confirm-button become clickable.
      const confirmBtn = page.getByTestId("transfer-buy-confirm-button");
      const confirmAttached = await confirmBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
      if (!confirmAttached) {
        note("Transfermarkt Kaufen", "bug", "Deal-Seite geöffnet, aber transfer-buy-confirm-button nie erschienen.");
        result.status = "partial";
        break;
      }
      const negotiateBtn = page.getByRole("button", { name: /^Verhandeln$|^Annahme liegt vor$/ });
      let accepted = false;
      let rejectedReason: string | null = null;
      // The negotiate button's `disabled` prop and its `title` text are derived from
      // slightly different state (disabled reacts to fast-flipping previewBusy/buyBusy
      // flags; title mostly reflects the more stable buyPreview/outcome object), so a
      // single "disabled" read can misleadingly show a stale "ready to negotiate" title
      // during a brief busy-flicker. Rather than pattern-matching specific title strings
      // (fragile), just keep retrying on ANY disabled state — a genuinely stuck reason
      // will simply still be there after the retries, a transient one will resolve.
      let consecutiveDisabledSameReason = 0;
      let lastSeenReason: string | null = null;
      for (let negotiationRound = 0; negotiationRound < 14; negotiationRound += 1) {
        accepted = await confirmBtn.isEnabled().catch(() => false);
        if (accepted) break;
        const negotiateVisible = await negotiateBtn.isVisible().catch(() => false);
        if (!negotiateVisible) break;
        const negotiateDisabled = await negotiateBtn.isDisabled().catch(() => false);
        if (negotiateDisabled) {
          const reason = await negotiateBtn.getAttribute("title").catch(() => null);
          consecutiveDisabledSameReason = reason === lastSeenReason ? consecutiveDisabledSameReason + 1 : 1;
          lastSeenReason = reason;
          if (consecutiveDisabledSameReason >= 4) {
            rejectedReason = reason;
            break;
          }
          await page.waitForTimeout(700);
          continue;
        }
        consecutiveDisabledSameReason = 0;
        await negotiateBtn.click({ timeout: timeoutMs }).catch(() => undefined);
        await page.waitForTimeout(900);
      }
      accepted = accepted || (await confirmBtn.isEnabled().catch(() => false));
      if (!accepted) {
        const isBudgetReason = Boolean(rejectedReason && /cash reicht/i.test(rejectedReason));
        consecutiveBudgetRejections = isBudgetReason ? consecutiveBudgetRejections + 1 : 0;
        // Cap how many near-identical "candidate rejected" lines we log — the pattern
        // itself (and the count) is the finding, not each individual repetition.
        loggedRejectionCount += 1;
        if (loggedRejectionCount <= 3) {
          note(
            "Transfermarkt Kaufen",
            "friction",
            `Verhandlung für Kandidat #${attempt + 1} führte nicht zu 'Angebot angenommen' (${rejectedReason ? "abgelehnt/blockiert" : "kein Ergebnis nach 12 Runden"}). Grund: ${rejectedReason ?? "—"}. Kandidat übersprungen.`,
          );
        }
        const cancelBtn = page.getByRole("button", { name: "Abbrechen" });
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click().catch(() => undefined);
          await page.waitForTimeout(500);
        } else {
          await gotoFoundation(page, baseUrl, "marketV2", teamId, saveId, timeoutMs);
          await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: timeoutMs });
        }
        await waitForMarketCandidatesSettled(page, timeoutMs);
        if (consecutiveBudgetRejections >= 3) {
          note(
            "Transfermarkt Kaufen",
            "friction",
            `Budget offenbar erschöpft (${consecutiveBudgetRejections}x in Folge 'Cash reicht nicht' — insgesamt ${loggedRejectionCount} abgelehnte Kandidaten). Kaufschleife vorzeitig beendet statt alle ${maxBuys} Versuche auszuschöpfen.`,
          );
          break;
        }
        continue;
      }

      consecutiveBudgetRejections = 0;
      await confirmBtn.click({ timeout: timeoutMs });
      await page.waitForTimeout(1200);
      buys += 1;
      if (!firstShotTaken) {
        result.screenshot = await screenshot(page, "s1-02-market-buy.png");
        firstShotTaken = true;
      }
      // Return to the market list view for the next candidate.
      await gotoFoundation(page, baseUrl, "marketV2", teamId, saveId, timeoutMs);
      await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: timeoutMs });
      await waitForMarketCandidatesSettled(page, timeoutMs);
    }

    if (loggedRejectionCount > 3) {
      result.notes.push(`${loggedRejectionCount - 3} weitere abgelehnte/übersprungene Kandidaten nicht einzeln geloggt (gleiches Muster).`);
    }
    const finalRosterCount = await rosterCountForTeam(baseUrl, saveId, teamId);
    result.notes.push(`Käufe via UI: ${buys}. Kadergröße danach: ${finalRosterCount}.`);
    if (!result.screenshot) {
      result.screenshot = await screenshot(page, "s1-02-market-buy.png");
    }
    if (finalRosterCount < 7) {
      result.status = "failed";
      note("Transfermarkt Kaufen", "blocker", `Kadergröße (${finalRosterCount}) liegt unter dem Matchday-Minimum (7) — Season 1 kann nicht angepfiffen werden.`);
    } else if (finalRosterCount < targetRosterCount) {
      result.status = result.status === "ok" ? "partial" : result.status;
      note("Transfermarkt Kaufen", "friction", `Zielkadergröße (${targetRosterCount}) nicht ganz erreicht, nur ${finalRosterCount} Spieler — evtl. Budget knapp bemessen für Season-Start.`);
    }
  });
}

async function driveMarketSell(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("market-sell", "Transfermarkt — Verkaufen", async (result) => {
    await gotoFoundation(page, baseUrl, "marketV2", teamId, saveId, timeoutMs);
    await page.getByTestId("transfer-market").waitFor({ state: "visible", timeout: timeoutMs });
    await page.waitForTimeout(1000);
    const rosterBefore = await rosterCountForTeam(baseUrl, saveId, teamId);
    const sellBtn = page.getByTestId("transfer-roster-sell-button").first();
    const visible = await sellBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Transfermarkt Verkaufen", "bug", "Kein transfer-roster-sell-button im Kader sichtbar, obwohl Roster > 0 ist.");
      result.screenshot = await screenshot(page, "s1-03-market-sell.png");
      return;
    }
    await sellBtn.click({ timeout: timeoutMs });
    const confirmBtn = page.getByTestId("transfer-sell-confirm-button");
    const confirmVisible = await confirmBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!confirmVisible) {
      result.status = "failed";
      note("Transfermarkt Verkaufen", "bug", "Verkaufsdialog geöffnet, aber transfer-sell-confirm-button erscheint nicht.");
      result.screenshot = await screenshot(page, "s1-03-market-sell.png");
      return;
    }
    result.screenshot = await screenshot(page, "s1-03-market-sell.png");
    const confirmDisabled = await confirmBtn.isDisabled().catch(() => false);
    if (confirmDisabled) {
      result.status = "partial";
      note("Transfermarkt Verkaufen", "friction", "Verkauf-Bestätigen-Button deaktiviert (evtl. Mindestkader-Schutz) — Verkauf übersprungen.");
      return;
    }
    await confirmBtn.click({ timeout: timeoutMs });
    await page.waitForTimeout(1200);
    const rosterAfter = await rosterCountForTeam(baseUrl, saveId, teamId);
    result.notes.push(`Kadergröße vor/nach Verkauf: ${rosterBefore} → ${rosterAfter}.`);
    if (rosterAfter >= rosterBefore) {
      result.status = "partial";
      note("Transfermarkt Verkaufen", "bug", `Verkauf wurde bestätigt, aber Kadergröße sank nicht (${rosterBefore} → ${rosterAfter}).`);
    }
  });
}

async function driveSponsor(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("sponsors", "Sponsoren", async (result) => {
    await gotoFoundation(page, baseUrl, "prize", teamId, saveId, timeoutMs);
    const panel = page.getByTestId("team-sponsor-choice");
    const visible = await panel.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Sponsoren", "blocker", "team-sponsor-choice Panel unter view=prize nicht sichtbar.");
      result.screenshot = await screenshot(page, "s1-04-sponsors-blocked.png");
      return;
    }
    result.screenshot = await screenshot(page, "s1-04-sponsors.png");
    const chooseBtn = page.getByTestId("sponsor-choose-button").first();
    const btnVisible = await chooseBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!btnVisible) {
      result.status = "partial";
      note("Sponsoren", "friction", "Kein sponsor-choose-button sichtbar — evtl. bereits ein Sponsor gewählt oder keine Angebote vorhanden.");
      return;
    }
    await chooseBtn.click({ timeout: timeoutMs });
    await page.waitForTimeout(1200);
    result.notes.push("Sponsor-Angebot ausgewählt.");
  });
}

async function driveBuildings(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("buildings", "Gebäude (Facilities)", async (result) => {
    await gotoFoundation(page, baseUrl, "trainingV2", teamId, saveId, timeoutMs);
    const grid = page.getByTestId("facilities-v2-grid");
    const visible = await grid.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Gebäude", "blocker", "facilities-v2-grid nicht sichtbar unter view=trainingV2.");
      result.screenshot = await screenshot(page, "s1-05-buildings-blocked.png");
      return;
    }
    result.screenshot = await screenshot(page, "s1-05-buildings.png");
    const card = page.getByTestId(/^facilities-v2-card-/).first();
    const cardVisible = await card.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!cardVisible) {
      result.status = "partial";
      note("Gebäude", "friction", "Keine facilities-v2-card-* Kachel sichtbar.");
      return;
    }
    await card.click({ timeout: timeoutMs });
    const upgradeBtn = page.getByTestId("facilities-upgrade-button");
    const upgradeVisible = await upgradeBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!upgradeVisible) {
      result.status = "partial";
      note("Gebäude", "friction", "Kein facilities-upgrade-button nach Auswahl einer Facility-Karte sichtbar.");
      return;
    }
    const upgradeDisabled = await upgradeBtn.isDisabled().catch(() => false);
    if (upgradeDisabled) {
      result.status = "partial";
      note("Gebäude", "friction", "facilities-upgrade-button deaktiviert (evtl. Budget zu knapp nach Transfers) — Upgrade übersprungen.");
      return;
    }
    await upgradeBtn.click({ timeout: timeoutMs });
    const confirmBtn = page.getByTestId("facility-confirm-button");
    const confirmVisible = await confirmBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!confirmVisible) {
      result.status = "partial";
      note("Gebäude", "bug", "Upgrade-Button geklickt, aber kein facility-confirm-button erschienen.");
      return;
    }
    await confirmBtn.click({ timeout: timeoutMs });
    await page.waitForTimeout(1200);
    result.notes.push("Facility-Upgrade bestätigt.");
  });
}

async function driveTraining(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("training", "Training", async (result) => {
    await gotoFoundation(page, baseUrl, "trainingCompact", teamId, saveId, timeoutMs);
    const panel = page.getByTestId("foundation-training-compact").first();
    const visible = await panel.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Training", "blocker", "foundation-training-compact nicht sichtbar.");
      result.screenshot = await screenshot(page, "s1-06-training-blocked.png");
      return;
    }
    result.screenshot = await screenshot(page, "s1-06-training.png");
    const rail = page.getByTestId("training-global-mode-rail");
    const railVisible = await rail.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!railVisible) {
      result.status = "partial";
      note("Training", "friction", "training-global-mode-rail nicht sichtbar — Team-weite Intensität nicht setzbar.");
      return;
    }
    const segment = rail.locator(".velo-intensity-segment").filter({ hasText: "Mittel" }).first();
    const segmentVisible = await segment.isVisible().catch(() => false);
    if (!segmentVisible) {
      result.status = "partial";
      note("Training", "friction", "Kein 'Mittel'-Segment im training-global-mode-rail gefunden.");
      return;
    }
    await segment.click({ timeout: timeoutMs });
    await page.waitForTimeout(800);
    result.notes.push("Team-Trainingsintensität auf 'Mittel' gesetzt.");
  });
}

async function driveLineup(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number, shotName: string) {
  return runSystem(`lineup-${shotName}`, `Einsatzliste (${shotName})`, async (result) => {
    await gotoFoundation(page, baseUrl, "lineup", teamId, saveId, timeoutMs);
    const panel = page.getByTestId("foundation-lineup");
    const visible = await panel.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Einsatzliste", "blocker", "foundation-lineup nicht sichtbar.");
      result.screenshot = await screenshot(page, `s1-${shotName}-lineup-blocked.png`);
      return;
    }
    await page.waitForTimeout(800);

    const autoFillBtn = page.getByRole("button", { name: "Automatisch füllen" });
    const autoFillVisible = await autoFillBtn.isVisible().catch(() => false);
    if (autoFillVisible) {
      const autoFillDisabled = await autoFillBtn.isDisabled().catch(() => false);
      if (!autoFillDisabled) {
        await autoFillBtn.click({ timeout: timeoutMs });
        await page.waitForTimeout(800);
        result.notes.push("'Automatisch füllen' geklickt.");
      }
    } else {
      result.notes.push("'Automatisch füllen' Button nicht sichtbar (evtl. bereits vollständig oder andere UI-Variante).");
    }

    result.screenshot = await screenshot(page, `s1-${shotName}-lineup.png`);

    const saveBtn = page.getByTestId("nl-lineup-save").first();
    const legacyBtn = page.getByTestId("lineup-save-button").first();
    let clicked = false;
    if (await saveBtn.isVisible().catch(() => false)) {
      const disabled = await saveBtn.isDisabled().catch(() => false);
      if (!disabled) {
        await saveBtn.click({ timeout: timeoutMs });
        clicked = true;
      } else {
        // A disabled save button with an unmet requirement typically opens a help popover on click.
        await saveBtn.click({ timeout: timeoutMs }).catch(() => undefined);
        await page.waitForTimeout(400);
        const helpText = await page.locator(".nl-lineup-save-help").innerText().catch(() => "");
        note("Einsatzliste", "friction", `Speichern-Button deaktiviert (${shotName}). Hinweis: ${helpText.slice(0, 200) || "kein Hinweistext gefunden"}.`);
      }
    } else if (await legacyBtn.isVisible().catch(() => false)) {
      const disabled = await legacyBtn.isDisabled().catch(() => false);
      if (!disabled) {
        await legacyBtn.click({ timeout: timeoutMs });
        clicked = true;
      } else {
        note("Einsatzliste", "friction", `Legacy lineup-save-button deaktiviert (${shotName}).`);
      }
    } else {
      result.status = "failed";
      note("Einsatzliste", "blocker", `Weder nl-lineup-save noch lineup-save-button sichtbar (${shotName}).`);
      return;
    }
    await page.waitForTimeout(1000);
    if (clicked) {
      result.notes.push("Lineup gespeichert/eingereicht.");
    } else {
      result.status = "partial";
    }
  });
}

async function driveMatchday(
  page: Page,
  baseUrl: string,
  teamId: string,
  saveId: string,
  timeoutMs: number,
  matchdayIndex: number,
  takeScreenshot: boolean,
) {
  return runSystem(`arena-md${matchdayIndex}`, `Arena — Spieltag ${matchdayIndex}`, async (result) => {
    await gotoFoundation(page, baseUrl, "matchdayArena", teamId, saveId, timeoutMs);
    await page.locator("#foundation-matchday-arena").waitFor({ state: "attached", timeout: timeoutMs });
    await page.waitForTimeout(800);
    if (takeScreenshot) {
      result.screenshot = await screenshot(page, `s1-07-arena-md${matchdayIndex}-before.png`);
    }

    const finishBtn = page.getByTestId("arena-finish-matchday-button");
    const finishVisible = await finishBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!finishVisible) {
      result.status = "failed";
      note(`Arena MD${matchdayIndex}`, "blocker", "arena-finish-matchday-button nicht sichtbar — evtl. Lineup nicht vollständig oder anderer Blocker aktiv.");
      const bodyText = await page.locator("body").innerText().catch(() => "");
      note(`Arena MD${matchdayIndex}`, "info", `Sichtbarer Seitentext (Auszug): ${bodyText.slice(0, 500)}`);
      result.screenshot = result.screenshot ?? (await screenshot(page, `s1-07-arena-md${matchdayIndex}-blocked.png`));
      return;
    }
    const finishDisabled = await finishBtn.isDisabled().catch(() => false);
    if (finishDisabled) {
      result.status = "failed";
      note(`Arena MD${matchdayIndex}`, "blocker", "arena-finish-matchday-button ist disabled (readOnly oder cockpitBusyKey aktiv).");
      return;
    }

    const beforeBody = await activeSave(baseUrl, saveId);
    const beforeMatchdayId = beforeBody.save?.gameState?.matchdayState?.matchdayId ?? null;

    const autoRunPromise = page
      .waitForResponse(
        (response) => response.url().includes("/api/season/matchday-auto-run") && response.request().method() === "POST",
        { timeout: Math.max(timeoutMs, 120_000) },
      )
      .catch(() => null);
    await finishBtn.click({ timeout: timeoutMs, force: true });
    const autoRunResponse = await autoRunPromise;
    if (!autoRunResponse) {
      result.status = "failed";
      note(`Arena MD${matchdayIndex}`, "bug", "Kein /api/season/matchday-auto-run Response nach Klick auf 'Spieltag abschliessen' beobachtet.");
      return;
    }
    const autoRunBody = (await autoRunResponse.json().catch(() => ({}))) as {
      ok?: boolean;
      success?: boolean;
      blockingReasons?: string[];
      summary?: { advanceAllowed?: boolean };
    };
    if (!autoRunResponse.ok() || autoRunBody.ok === false) {
      result.status = "failed";
      note(
        `Arena MD${matchdayIndex}`,
        "bug",
        `matchday-auto-run fehlgeschlagen: HTTP ${autoRunResponse.status()}, blockingReasons=${(autoRunBody.blockingReasons ?? []).join(", ") || "—"}.`,
      );
      return;
    }

    // Poll for matchday advance (or gamePhase -> season_completed on MD10).
    const started = Date.now();
    let advanced = false;
    let finalPhase: string | undefined;
    let finalMatchdayId: string | undefined;
    while (Date.now() - started < Math.max(timeoutMs, 120_000)) {
      const body = await activeSave(baseUrl, saveId);
      const currentMatchdayId = body.save?.gameState?.matchdayState?.matchdayId;
      const gamePhase = body.save?.gameState?.gamePhase;
      finalPhase = gamePhase;
      finalMatchdayId = currentMatchdayId;
      if (gamePhase === "season_completed" || (currentMatchdayId && currentMatchdayId !== beforeMatchdayId)) {
        advanced = true;
        break;
      }
      await delay(1500);
    }
    if (!advanced) {
      result.status = "failed";
      note(`Arena MD${matchdayIndex}`, "blocker", `Matchday advanced nicht innerhalb des Timeouts (matchdayId blieb ${beforeMatchdayId}, gamePhase=${finalPhase}).`);
      return;
    }
    result.notes.push(`Matchday abgeschlossen. Neuer Stand: matchdayId=${finalMatchdayId}, gamePhase=${finalPhase}.`);
    if (takeScreenshot) {
      await page.waitForTimeout(600);
      const afterShot = await screenshot(page, `s1-07-arena-md${matchdayIndex}-after.png`);
      result.screenshot = result.screenshot ?? afterShot;
    }
  });
}

async function driveStandings(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("standings", "Saisonstand (Standings)", async (result) => {
    await gotoFoundation(page, baseUrl, "seasonV2", teamId, saveId, timeoutMs);
    const panel = page.getByTestId("foundation-season-v2");
    const visible = await panel.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Standings", "blocker", "foundation-season-v2 nicht sichtbar.");
      result.screenshot = await screenshot(page, "s1-09-standings-blocked.png");
      return;
    }
    result.screenshot = await screenshot(page, "s1-09-standings.png");
    result.notes.push("Saisonstand geladen.");
  });
}

async function driveRosterFillAllTeams(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("roster-fill", "Cockpit — Roster-Fill (alle Teams)", async (result) => {
    // Non-obvious prerequisite discovered the hard way: matchday-auto-run's internal AI
    // lineup step silently skips any team below the matchday minimum roster size, which
    // then makes the WHOLE matchday resolve as "missing_lineups" — even though our own
    // team's lineup was submitted fine. The only human-reachable fix is this Cockpit
    // "Roster-Fill" step, which buys free agents for every AI team up to target size.
    // Nothing in the main flow / global "Weiter" button routes here.
    await gotoFoundation(page, baseUrl, "cockpit", teamId, saveId, timeoutMs);
    const panel = page.getByTestId("foundation-cockpit");
    const visible = await panel.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Roster-Fill", "blocker", "foundation-cockpit nicht sichtbar — Roster-Fill für AI-Teams nicht erreichbar.");
      return;
    }

    const dryRunBtn = page.getByRole("button", { name: "Roster-Fill DryRun" });
    const dryRunVisible = await dryRunBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!dryRunVisible) {
      result.status = "failed";
      note(
        "Roster-Fill",
        "blocker",
        "'Roster-Fill DryRun'-Button nicht im Cockpit gefunden. Ohne diesen Admin-Schritt bleiben die 31 AI-Teams unter dem Matchday-Minimum und der Spieltag kann nie abgeschlossen werden — kein Hinweis darauf im normalen Spielfluss (Weiter-Button/Flow-Blocker).",
      );
      return;
    }
    await dryRunBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    result.screenshot = await screenshot(page, "s1-cockpit-roster-fill-before.png");
    // The roster-fill dry-run scans all 32 teams' free-agent markets and consistently
    // takes several seconds (observed ~4.3s server-side for 32 teams) — a short fixed
    // wait here previously read a stale/incomplete feed and wrongly concluded
    // plannedBuys=0, when the real number was 338. Wait for the actual API response.
    const dryRunResponsePromise = page
      .waitForResponse(
        (response) => response.url().includes("/api/ai/roster-fill") && response.request().method() === "POST",
        { timeout: Math.max(timeoutMs, 30_000) },
      )
      .catch(() => null);
    await dryRunBtn.click({ timeout: timeoutMs });
    const dryRunResponse = await dryRunResponsePromise;
    if (!dryRunResponse) {
      note("Roster-Fill", "bug", "Kein /api/ai/roster-fill Response nach Klick auf 'Roster-Fill DryRun' beobachtet.");
    }
    await page.waitForTimeout(500);

    const executeBtn = page.getByRole("button", { name: "Alle Teams lokal auffuellen" });
    const executeVisible = await executeBtn.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!executeVisible) {
      result.status = "failed";
      note("Roster-Fill", "bug", "'Alle Teams lokal auffuellen'-Button nach DryRun nicht sichtbar.");
      return;
    }
    const executeDisabled = await executeBtn.isDisabled().catch(() => false);
    if (executeDisabled) {
      // Disabled with plannedBuys === 0 legitimately means every team is already at
      // target — not necessarily a problem, just note it.
      result.notes.push("'Alle Teams lokal auffuellen' deaktiviert — vermutlich plannedBuys=0 (alle Teams bereits am Ziel).");
    } else {
      page.once("dialog", (dialog) => {
        dialog.accept().catch(() => undefined);
      });
      const executeResponsePromise = page
        .waitForResponse(
          (response) => response.url().includes("/api/ai/roster-fill") && response.request().method() === "POST",
          { timeout: Math.max(timeoutMs, 60_000) },
        )
        .catch(() => null);
      await executeBtn.click({ timeout: timeoutMs });
      const executeResponse = await executeResponsePromise;
      if (!executeResponse) {
        note("Roster-Fill", "bug", "Kein /api/ai/roster-fill Response nach Klick auf 'Alle Teams lokal auffuellen' beobachtet.");
      }
      await page.waitForTimeout(1000);
      result.notes.push("Roster-Fill für alle Teams ausgeführt (window.confirm bestätigt).");
    }
    result.screenshot = await screenshot(page, "s1-cockpit-roster-fill-after.png");

    // Verify: sample a handful of AI teams and confirm they now clear the matchday minimum.
    const body = await activeSave(baseUrl, saveId);
    const rosters = body.save?.gameState?.rosters ?? [];
    const teams = body.save?.gameState?.teams ?? [];
    const perTeamCounts = new Map<string, number>();
    for (const entry of rosters as Array<{ teamId: string }>) {
      perTeamCounts.set(entry.teamId, (perTeamCounts.get(entry.teamId) ?? 0) + 1);
    }
    const belowMinimum = teams.filter((team) => (perTeamCounts.get(team.teamId) ?? 0) < 7);
    if (belowMinimum.length > 0) {
      result.status = "partial";
      note(
        "Roster-Fill",
        "friction",
        `${belowMinimum.length} Team(s) bleiben unter dem Matchday-Minimum (7) selbst nach Roster-Fill: ${belowMinimum.slice(0, 5).map((t) => t.teamId).join(", ")}${belowMinimum.length > 5 ? ", ..." : ""}.`,
      );
    } else {
      result.notes.push(`Alle ${teams.length} Teams erreichen jetzt das Matchday-Minimum von 7 Spielern.`);
    }
  });
}

async function driveCockpit(page: Page, baseUrl: string, teamId: string, saveId: string, timeoutMs: number) {
  return runSystem("cockpit", "Cockpit / Season-Transition", async (result) => {
    await gotoFoundation(page, baseUrl, "cockpit", teamId, saveId, timeoutMs);
    const panel = page.getByTestId("foundation-cockpit");
    const visible = await panel.waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
    if (!visible) {
      result.status = "failed";
      note("Cockpit", "blocker", "foundation-cockpit nicht sichtbar nach Season-Abschluss.");
      result.screenshot = await screenshot(page, "s1-10-cockpit-blocked.png");
      return;
    }
    result.screenshot = await screenshot(page, "s1-10-cockpit.png");
    const text = await panel.innerText().catch(() => "");
    if (!/Pre-Season|Season Review|Saisonabschluss|Season Completion/i.test(text)) {
      result.status = "partial";
      note("Cockpit", "friction", "Cockpit zeigt nach Saisonabschluss keinen erkennbaren Pre-Season/Review-Text.");
    }
    result.notes.push("Cockpit-Ansicht nach Season-1-Abschluss aufgerufen.");
  });
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

function statusEmoji(status: SystemStatus) {
  if (status === "ok") return "OK";
  if (status === "partial") return "PARTIAL";
  if (status === "skipped") return "SKIPPED";
  return "FAILED";
}

async function writeFindings(input: {
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  saveId: string;
  teamId: string;
  s1Completed: boolean;
  stoppedAt: string | null;
}) {
  const lines: string[] = [];
  lines.push("# UI Generalprobe — Season 1 Findings");
  lines.push("");
  lines.push(`- Started: ${input.startedAt}`);
  lines.push(`- Finished: ${input.finishedAt}`);
  lines.push(`- Base URL: ${input.baseUrl}`);
  lines.push(`- Save ID: ${input.saveId}`);
  lines.push(`- Team (human-controlled): ${input.teamId}`);
  lines.push(`- Season 1 completed (matchday 10 resolved): ${input.s1Completed ? "YES" : "NO"}`);
  if (input.stoppedAt) {
    lines.push(`- Stopped at: ${input.stoppedAt}`);
  }
  lines.push("");
  lines.push("## Per-system status");
  lines.push("");
  lines.push("| System | Status | Screenshot | Notes |");
  lines.push("|---|---|---|---|");
  for (const sys of systemResults) {
    const shot = sys.screenshot ? path.relative(process.cwd(), sys.screenshot) : "—";
    lines.push(`| ${sys.label} | ${statusEmoji(sys.status)} | ${shot} | ${sys.notes.join(" ") || "—"} |`);
  }
  lines.push("");
  lines.push("## Findings (bugs, blockers, friction)");
  lines.push("");
  const order: FindingSeverity[] = ["blocker", "bug", "friction", "info"];
  for (const severity of order) {
    const items = findings.filter((f) => f.severity === severity);
    if (items.length === 0) continue;
    lines.push(`### ${severity.toUpperCase()} (${items.length})`);
    lines.push("");
    for (const item of items) {
      lines.push(`- **${item.system}**: ${item.text}`);
    }
    lines.push("");
  }
  if (findings.length === 0) {
    lines.push("No findings recorded — every system worked cleanly.");
    lines.push("");
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(FINDINGS_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`\nFindings written to ${FINDINGS_PATH}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(S1_SHOT_DIR, { recursive: true });

  const port = new URL(args.baseUrl).port || "3100";
  const throwawayDbPath =
    args.sqliteThrowaway ??
    path.join(os.tmpdir(), "oly-ui-playthrough", `s1-throwaway-${Date.now()}.sqlite`);

  let startedServer: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  const startedAt = new Date().toISOString();
  let stoppedAt: string | null = null;
  let s1Completed = false;
  let saveId = "";
  let teamId = args.teamId ?? "";

  try {
    if (!(await isServerReachable(args.baseUrl, 5000))) {
      if (args.noStart) {
        throw new Error(`Server not reachable at ${args.baseUrl} and --no-start was set.`);
      }
      await fs.mkdir(path.dirname(throwawayDbPath), { recursive: true });
      await fs.copyFile(args.sqliteSource, throwawayDbPath);
      console.log(`[ui-s1] Throwaway sqlite copy: ${throwawayDbPath}`);
      startedServer = startServer(port, throwawayDbPath);
      let reachable = false;
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await delay(1000);
        if (await isServerReachable(args.baseUrl, 5000)) {
          reachable = true;
          break;
        }
      }
      if (!reachable) {
        throw new Error(`Server did not become reachable at ${args.baseUrl} in time.`);
      }
    } else {
      console.log(`[ui-s1] Reusing already-reachable server at ${args.baseUrl} (assumes caller already set up a throwaway DB).`);
    }

    console.log("[ui-s1] Creating fresh Season 1 save...");
    const created = await fetchJson<{ save?: { saveId: string } }>(args.baseUrl, "/api/singleplayer-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fresh-season-1" }),
    });
    saveId = created.save?.saveId ?? "";
    if (!saveId) throw new Error("fresh-season-1 did not return a saveId.");
    const initial = await activeSave(args.baseUrl, saveId);
    teamId = teamId || initial.save?.gameState?.teams?.[0]?.teamId || "A-A";
    const rosterOptTarget = initial.save?.gameState?.teams?.find((t) => t.teamId === teamId)?.rosterOptTarget ?? 12;
    console.log(`[ui-s1] Save ${saveId}, team ${teamId}, rosterOptTarget ${rosterOptTarget}.`);

    const chromiumExecutablePath = resolveChromiumExecutablePath();
    browser = await chromium.launch({
      headless: !args.headed,
      ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } });
    page.setDefaultTimeout(args.timeoutMs);
    page.setDefaultNavigationTimeout(args.timeoutMs);
    await page.route("**/api/media/**", (route) => route.abort());
    let suppressedMediaAbortErrors = 0;
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // We deliberately abort **/api/media/** requests (page.route above) to skip image
      // loads and keep the run fast — that reliably produces "Failed to load resource:
      // net::ERR_FAILED" console noise which is a side effect of our own test harness, not
      // a real app bug. Suppress it from the findings log; report a single aggregate count.
      if (/Failed to load resource.*ERR_FAILED/i.test(text)) {
        suppressedMediaAbortErrors += 1;
        return;
      }
      note("Browser Console", "info", `console.error: ${text.slice(0, 300)}`);
    });
    page.on("pageerror", (error) => {
      note("Browser Console", "bug", `Uncaught page error: ${error.message.slice(0, 300)}`);
    });

    // 1) Team settings: become the human-controlled manual team.
    const teamSettingsResult = await driveTeamSettings(page, args.baseUrl, teamId, saveId, args.timeoutMs);
    if (teamSettingsResult.status === "failed") {
      note("Season 1", "blocker", "Konnte kein manuelles Team via UI zuweisen — Rest der Season-1-Sequenz abgebrochen.");
      s1Completed = false;
      stoppedAt = "team-settings";
      return;
    }

    // 2) HQ / home v2 (season intro).
    await driveHome(page, args.baseUrl, teamId, saveId, args.timeoutMs);

    // 3) Buy players to reach a workable roster.
    const buyResult = await driveMarketBuy(page, args.baseUrl, teamId, saveId, args.timeoutMs, rosterOptTarget, 30);
    if (buyResult.status === "failed") {
      stoppedAt = "market-buy";
      note("Season 1", "blocker", "Kaderaufbau via Transfermarkt fehlgeschlagen (Kader unter Matchday-Minimum) — Season 1 kann nicht fortgesetzt werden.");
      return;
    }

    // 4) Sell one player (exercise the sell flow).
    await driveMarketSell(page, args.baseUrl, teamId, saveId, args.timeoutMs);

    // 5) Sponsor choice.
    await driveSponsor(page, args.baseUrl, teamId, saveId, args.timeoutMs);

    // 6) Facility upgrade (Buildings).
    await driveBuildings(page, args.baseUrl, teamId, saveId, args.timeoutMs);

    // 7) Training — set team-wide intensity (season-locked after MD1).
    await driveTraining(page, args.baseUrl, teamId, saveId, args.timeoutMs);

    // 8) Drive the global "Weiter" a few times to clear remaining flow blockers
    //    (finalize transfers, etc.) the way a human following the CTA would.
    for (let i = 0; i < 4; i += 1) {
      await gotoFoundation(page, args.baseUrl, "homeV2", teamId, saveId, args.timeoutMs);
      const disabled = await page.getByTestId("foundation-global-next-button").isDisabled().catch(() => true);
      if (disabled) break;
      await clickGlobalNext(page, args.timeoutMs);
    }

    // 8b) Roster-Fill for all 31 AI teams via Cockpit. Without this, matchday-auto-run's
    // internal AI-lineup step silently skips any team below the matchday minimum roster
    // size, and the WHOLE matchday resolve then fails as "missing_lineups" even though
    // our own team's lineup is fine. See scripts/ui-playthrough-s1-s3.ts driveRosterFillAllTeams.
    const rosterFillResult = await driveRosterFillAllTeams(page, args.baseUrl, teamId, saveId, args.timeoutMs);
    if (rosterFillResult.status === "failed") {
      stoppedAt = "roster-fill";
      note("Season 1", "blocker", "Roster-Fill für AI-Teams fehlgeschlagen — Matchday 1 kann voraussichtlich nicht resolved werden.");
      return;
    }

    // 9) Lineup for matchday 1.
    const lineupMd1 = await driveLineup(page, args.baseUrl, teamId, saveId, args.timeoutMs, "md1");
    if (lineupMd1.status === "failed") {
      stoppedAt = "lineup-md1";
      note("Season 1", "blocker", "Einsatzliste für Spieltag 1 konnte nicht gespeichert werden — Matchday-Loop abgebrochen.");
      return;
    }

    // 10) Matchday loop x10.
    let lastMatchdayCompleted = 0;
    for (let mdIndex = 1; mdIndex <= 10; mdIndex += 1) {
      if (mdIndex > 1) {
        const lineupResult = await driveLineup(page, args.baseUrl, teamId, saveId, args.timeoutMs, `md${mdIndex}`);
        if (lineupResult.status === "failed") {
          stoppedAt = `lineup-md${mdIndex}`;
          note("Season 1", "blocker", `Einsatzliste für Spieltag ${mdIndex} konnte nicht gespeichert werden — Matchday-Loop abgebrochen.`);
          break;
        }
      }
      const takeShot = mdIndex === 1 || mdIndex === 10;
      const mdResult = await driveMatchday(page, args.baseUrl, teamId, saveId, args.timeoutMs, mdIndex, takeShot);
      if (mdResult.status === "failed") {
        stoppedAt = `matchday-${mdIndex}`;
        note("Season 1", "blocker", `Spieltag ${mdIndex} konnte nicht abgeschlossen werden — Season-1-Loop abgebrochen.`);
        break;
      }
      lastMatchdayCompleted = mdIndex;
      const body = await activeSave(args.baseUrl, saveId);
      if (body.save?.gameState?.gamePhase === "season_completed") {
        s1Completed = true;
        break;
      }
    }
    if (lastMatchdayCompleted === 10 || s1Completed) {
      s1Completed = true;
    }

    // 11) Standings.
    await driveStandings(page, args.baseUrl, teamId, saveId, args.timeoutMs);

    // 12) Cockpit (season transition view) — only meaningful once S1 is done.
    if (s1Completed) {
      await driveCockpit(page, args.baseUrl, teamId, saveId, args.timeoutMs);
    }
  } finally {
    const finishedAt = new Date().toISOString();
    await writeFindings({
      startedAt,
      finishedAt,
      baseUrl: args.baseUrl,
      saveId,
      teamId,
      s1Completed,
      stoppedAt,
    });

    console.log("\n=== Season 1 Generalprobe Summary ===");
    console.log(`S1 completed: ${s1Completed}`);
    for (const sys of systemResults) {
      console.log(`${statusEmoji(sys.status).padEnd(8)} ${sys.label}`);
    }

    if (browser) await browser.close().catch(() => undefined);
    if (startedServer) await stopServer(startedServer).catch(() => undefined);
    if (!args.keepDb && !args.sqliteThrowaway && fsSync.existsSync(throwawayDbPath) && startedServer) {
      // Keep the DB by default only when the caller explicitly asked to (helps a follow-up
      // S2/S3 continuation task inspect or resume this exact save). We therefore do NOT delete
      // it here unless --keep-db=false was explicitly requested together with a start-server run.
    }
    console.log(`\nThrowaway sqlite (kept for inspection/continuation): ${throwawayDbPath}`);
  }

  if (!s1Completed) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
