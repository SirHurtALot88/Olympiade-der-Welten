// ===================================================================================
// LIVE-CHROMIUM-AUFNAHMEN DES MARKETING-BAUS (22.11.): Seite Marketing (drei Reiter), Transfermarkt-Spalte, Finanzen/GuV.
// Arbeitet auf einer KOPIE des Live-Abbilds (Team D-P), setzt dort den Marketing-Stempel auf "an" (und, falls fehlend, Finanzen je
// Spieltag), startet den Dev-Server gegen die Kopie (Auto-Export AUS) und schreibt die Bilder nach docs/design/marketing-bau-22-11/.
//
// AUFRUF (unter Sperre, ein Browser zugleich):
//   OLY_SHOT_ABBILD=/pfad/abbild.sqlite flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-marketing-bau.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { marketingRegelFuerNeueSaison } from "@/lib/marketing/marketing-regel";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3216";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "marketing-bau-22-11");
const ABBILD = process.env.OLY_SHOT_ABBILD ?? "";
const SQLITE_PATH = path.join(os.tmpdir(), `oly-marketing-aufnahme-${process.pid}.sqlite`);
const TEAM = process.env.OLY_SHOT_TEAM ?? "D-P";

async function bereiteKopieVor(): Promise<{ saveId: string; teamId: string }> {
  if (!ABBILD) throw new Error("OLY_SHOT_ABBILD (entpacktes Live-Abbild) setzen.");
  await fs.copyFile(ABBILD, SQLITE_PATH);
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  const kandidaten = persistence.listSaves?.() ?? [];
  let gewaehlt: { saveId: string; gameState: import("@/lib/data/olyDataTypes").GameState } | null = null;
  for (const k of kandidaten as Array<{ saveId: string }>) {
    const s = persistence.getSaveById(k.saveId);
    if (s?.gameState.teams.some((t) => t.teamId === TEAM) && (s.gameState.rosters.filter((r) => r.teamId === TEAM).length > 0)) {
      if (!gewaehlt || (s.gameState.season.currentMatchday ?? 0) > (gewaehlt.gameState.season.currentMatchday ?? 0)) gewaehlt = { saveId: k.saveId, gameState: s.gameState };
    }
  }
  if (!gewaehlt) throw new Error(`Kein Spielstand mit Team ${TEAM} im Abbild.`);
  let g = gewaehlt.gameState;
  g = stempleFinanzenJeSpieltagBeimAnlegen({ ...g, seasonState: { ...g.seasonState, finanzenJeSpieltag: null } });
  g = { ...g, seasonState: { ...g.seasonState, marketingRegel: marketingRegelFuerNeueSaison(g.season.id, g.teams.map((t) => t.teamId)) } };
  persistence.saveSingleplayerState(gewaehlt.saveId, g);
  console.log(`[aufnahme] Save ${gewaehlt.saveId}, Saison ${g.season.id}, Spieltag ${g.season.currentMatchday}, Marketing an`);
  return { saveId: gewaehlt.saveId, teamId: TEAM };
}

async function erreichbar(timeoutMs: number) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: c.signal });
    clearTimeout(t);
    return r.status < 500;
  } catch {
    return false;
  }
}

function startDevServer(): ChildProcess {
  console.log("[aufnahme] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout?.on("data", (c) => process.stdout.write(`[dev] ${c}`));
  child.stderr?.on("data", (c) => process.stderr.write(`[dev] ${c}`));
  return child;
}

async function schliesseBriefing(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  if (!(await backdrop.isVisible().catch(() => false))) return;
  const erledigt = page.getByRole("button", { name: /^Erledigt$/ });
  const spaeter = page.getByRole("button", { name: /^Später$/ });
  if (await erledigt.isVisible().catch(() => false)) await erledigt.click();
  else if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
  await backdrop.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { saveId, teamId } = await bereiteKopieVor();
  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    const frist = Date.now() + 900_000;
    while (Date.now() < frist && !(await erreichbar(40_000))) await delay(2000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const aufnehmen = async (ansicht: string, breite: number, hoehe: number, datei: string, vorher: (p: Page) => Promise<void>) => {
      if (process.env.OLY_SHOT_NUR && !new RegExp(process.env.OLY_SHOT_NUR).test(datei)) return;
      for (let versuch = 1; versuch <= 3; versuch += 1) {
        try {
          const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
          const page = await ctx.newPage();
          const fehler: string[] = [];
          page.on("pageerror", (e) => fehler.push(String(e)));
          const url = new URL("/foundation", BASE_URL);
          url.searchParams.set("view", ansicht);
          url.searchParams.set("saveId", saveId);
          url.searchParams.set("team", teamId);
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
          await schliesseBriefing(page);
          await page.getByTestId("foundation-regieband").first().waitFor({ state: "visible", timeout: 120_000 });
          await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 150_000 }).catch(() => undefined);
          await page.waitForTimeout(2000);
          await schliesseBriefing(page);
          await vorher(page);
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(OUTPUT_DIR, datei) });
          const mass = await page.evaluate(() => ({
            sx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            sy: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          }));
          console.log(`[aufnahme] ${datei} Seitenscroll x=${mass.sx} y=${mass.sy} JS-Fehler=${fehler.length}${fehler.length ? ` ${fehler[0]!.slice(0, 160)}` : ""}`);
          await ctx.close();
          return;
        } catch (e) {
          console.log(`[aufnahme] ${datei} Versuch ${versuch} gescheitert: ${String(e).slice(0, 160)}`);
        }
      }
    };
    const nichts = async () => undefined;
    const reiter = (name: string) => async (p: Page) => {
      await p.getByRole("tab", { name }).first().click().catch(() => undefined);
    };
    const zeile = async (p: Page) => {
      await p.locator('[data-testid^="mk-zeile-"]').nth(1).click().catch(() => undefined);
    };
    for (const [b, h, n] of [[1920, 1080, "1920x1080"], [2560, 1440, "2560x1440"], [1710, 1112, "1710x1112"]] as Array<[number, number, string]>) {
      await aufnehmen("marketing", b, h, `app-marketing-fan-${n}.png`, nichts);
      await aufnehmen("marketing", b, h, `app-marketing-spieler-${n}.png`, zeile);
      await aufnehmen("marketing", b, h, `app-marketing-verlauf-${n}.png`, reiter("Verlauf"));
    }
    await aufnehmen("marketV2", 1920, 1080, "app-transfermarkt-marketability-1920x1080.png", nichts);
    await aufnehmen("finances", 1920, 1080, "app-finanzen-guv-1920x1080.png", reiter("GuV"));
  } finally {
    await browser?.close().catch(() => undefined);
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* Server schon weg */
    }
    await fs.rm(SQLITE_PATH, { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
