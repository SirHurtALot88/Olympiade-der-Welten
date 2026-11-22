// ===================================================================================
// AUFNAHMEN: Finanzen je Spieltag (22.11., docs/design/finanzen-je-spieltag-22-11.md).
//
// Nimmt die Finanzseite aus der ECHTEN App (Dev-Server, Auto-Export aus) auf einer WEGWERF-KOPIE auf:
// Uebersicht (Kassenverlauf mit gebuchten und erwarteten Spieltagen) und Kontoauszug mit den Spieltagszeilen,
// je bei 1920x1080 und 2560x1440.
//
//   1) Kopie eines Spielstands nach dem Draft (stamp "je Spieltag" aktiv), z. B. aus
//      `scripts/miss-teamfinanzen-saison.ts --stop-after draft --keep`:
//        cp basis.sqlite /tmp/finanzen-shot.sqlite
//   2) Spieltage spielen:
//        env OLY_APP_SQLITE_PATH=/tmp/finanzen-shot.sqlite npx tsx scripts/screenshot-finanzen-je-spieltag.ts spielen --save <saveId> --spieltage 8
//   3) Aufnehmen, nur unter dem Aufnahme-Lock (CLAUDE.md):
//        flock /tmp/oly-aufnahme.lock env OLY_APP_SQLITE_PATH=/tmp/finanzen-shot.sqlite \
//          npx tsx scripts/screenshot-finanzen-je-spieltag.ts aufnehmen --save <saveId> --team H-R
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const MODUS = process.argv[2] ?? "";
const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const SAVE = arg("save", "");
const TEAM = arg("team", "H-R");
const SPIELTAGE = Number(arg("spieltage", "8"));
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "finanzen-je-spieltag-22-11");
const GROESSEN = [
  { breite: 1920, hoehe: 1080 },
  { breite: 2560, hoehe: 1440 },
];

async function spielen() {
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } = await import("@/lib/season/matchday-auto-run-service");
  const { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } = await import("@/lib/season/matchday-progress-service");
  const persistence = createPersistenceService();
  const get = () => persistence.getSaveById(SAVE)!;
  const sid = get().gameState.season.id;
  for (let i = 0; i < SPIELTAGE; i += 1) {
    const matchdayId = get().gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId: SAVE, seasonId: sid, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
      },
      persistence,
    );
    if (!lauf.ok) throw new Error(`${matchdayId} blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
    const adv = await executeMatchdayAdvance({ saveId: SAVE, seasonId: sid, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
    if (!adv.ok || !adv.applied) throw new Error(`Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
    console.log(`[finanzen-shot] Spieltag ${i + 1}/${SPIELTAGE} gebucht`);
  }
  const g = get().gameState;
  console.log("[finanzen-shot] Ledger-Zeilen", g.seasonState.spieltagFinanzen?.length ?? 0, "Stempel", JSON.stringify(g.seasonState.finanzenJeSpieltag));
}

function startServer(): ChildProcess {
  const child = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(`[srv] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[srv] ${chunk}`));
  return child;
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, { cache: "no-store" });
      if (response.status < 500) return;
    } catch {
      // noch nicht oben
    }
    await delay(2000);
  }
  throw new Error("Server wurde nicht rechtzeitig erreichbar.");
}

async function schliesseBriefing(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const backdrop = page.getByTestId("season-briefing-backdrop");
    if (!(await backdrop.isVisible().catch(() => false))) return;
    const knopf = page.getByRole("button", { name: /^(Erledigt|Später)$/ }).first();
    if (await knopf.isVisible().catch(() => false)) await knopf.click();
    await page.waitForTimeout(500);
  }
}

async function aufnehmen() {
  if (!SAVE) throw new Error("--save fehlt");
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const url = new URL("/foundation", BASE_URL);
  url.searchParams.set("view", "finances");
  url.searchParams.set("saveId", SAVE);
  url.searchParams.set("team", TEAM);
  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(300_000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    for (const groesse of GROESSEN) {
      const ctx = await browser.newContext({ viewport: { width: groesse.breite, height: groesse.hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 600_000 });
      await page.waitForLoadState("networkidle", { timeout: 300_000 }).catch(() => undefined);
      await page.getByTestId("finanzen-modern").waitFor({ state: "visible", timeout: 300_000 });
      await page.waitForTimeout(4000);
      await schliesseBriefing(page);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `01-uebersicht-${groesse.breite}.png`) });
      console.log(`[aufnahme] uebersicht ${groesse.breite}`);
      // Eine gebuchte Station anklicken: ihre Zeilen (Gehalt, Sponsor-Basis, Gebaeude) stehen im Kontext.
      const station = page.locator('[data-testid="fin-kassenverlauf"] button, [data-testid="fin-bewegung"] button').nth(2);
      if (await station.isVisible().catch(() => false)) {
        await station.click().catch(() => undefined);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(OUTPUT_DIR, `02-station-${groesse.breite}.png`) });
      }
      await page.getByRole("button", { name: /^Kontoauszug$/ }).first().click();
      await page.getByTestId("fin-kontoauszug").waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `03-kontoauszug-${groesse.breite}.png`) });
      console.log(`[aufnahme] kontoauszug ${groesse.breite}`);
      await ctx.close();
    }
  } finally {
    await browser?.close();
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

(MODUS === "spielen" ? spielen() : MODUS === "aufnehmen" ? aufnehmen() : Promise.reject(new Error("Modus: spielen | aufnehmen"))).catch((error) => {
  console.error(error);
  process.exit(1);
});
