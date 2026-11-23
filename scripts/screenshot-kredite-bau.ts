// ===================================================================================
// LIVE-CHROMIUM-AUFNAHMEN DES KREDITE-BAUS (22.11.): Reiter Kredite der Finanzseite (Beispiel mit zwei Krediten, leer, gesperrt, Register).
// Arbeitet auf einer KOPIE des Live-Abbilds (Team D-P), stempelt Finanzen je Spieltag und die Kredit-Regel "raten", bucht die gespielten
// Spieltage ins Ledger, legt fuer das Beispiel zwei Kredite (Bank 10 C / 3 Saisons, Wrecking Legionnaires 5 C / 2 Saisons) ueber den echten
// Kern (`originateLoan`) an und startet den Dev-Server gegen die Kopie (Auto-Export AUS). Bilder nach docs/design/kredite-modern-22-11/.
//
// AUFRUF (unter Sperre, ein Browser zugleich):
//   OLY_SHOT_ABBILD=/pfad/abbild.sqlite flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-kredite-bau.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import type { GameState } from "@/lib/data/olyDataTypes";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { stempleKreditRegelBeimAnlegen } from "@/lib/finance/kredit-raten";
import { buildLoanOffers, originateLoan } from "@/lib/finance/loan-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "kredite-modern-22-11");
const ABBILD = process.env.OLY_SHOT_ABBILD ?? "";
const SQLITE_PATH = path.join(os.tmpdir(), `oly-kredite-aufnahme-${process.pid}.sqlite`);
const TEAM = process.env.OLY_SHOT_TEAM ?? "D-P";

type Zustand = "beispiel" | "leer" | "gesperrt" | "offen";

async function bereiteKopieVor() {
  if (!ABBILD) throw new Error("OLY_SHOT_ABBILD (entpacktes Live-Abbild) setzen.");
  await fs.copyFile(ABBILD, SQLITE_PATH);
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  const kandidaten = (persistence.listSaves?.() ?? []) as Array<{ saveId: string }>;
  let gewaehlt: { saveId: string; gameState: GameState } | null = null;
  for (const k of kandidaten) {
    const s = persistence.getSaveById(k.saveId);
    if (s?.gameState.teams.some((t) => t.teamId === TEAM) && s.gameState.rosters.filter((r) => r.teamId === TEAM).length > 0) {
      if (!gewaehlt || (s.gameState.season.currentMatchday ?? 0) > (gewaehlt.gameState.season.currentMatchday ?? 0)) gewaehlt = { saveId: k.saveId, gameState: s.gameState };
    }
  }
  if (!gewaehlt) throw new Error(`Kein Spielstand mit Team ${TEAM} im Abbild.`);
  const basis = gewaehlt.gameState;
  const gespielt = Math.max(0, (basis.season.currentMatchday ?? 1) - 1);
  console.log(`[aufnahme] Save ${gewaehlt.saveId}, Saison ${basis.season.id}, vor Spieltag ${gespielt + 1}`);

  const bauen = (zustand: Zustand): GameState => {
    let g: GameState = stempleKreditRegelBeimAnlegen(
      stempleFinanzenJeSpieltagBeimAnlegen({ ...basis, seasonState: { ...basis.seasonState, finanzenJeSpieltag: null, spieltagFinanzen: [], loans: [], kreditRegel: null } }),
    );
    const ids = g.season.matchdayIds;
    // "offen": Vorsaison vor Spieltag 1 (Aufnehmen und Abloesen erlaubt), kein Spieltag gebucht.
    const gespieltJetzt = zustand === "offen" ? 0 : gespielt;
    const vorKredit = Math.max(0, gespieltJetzt - 4);
    for (const id of ids.slice(0, vorKredit)) g = bucheSpieltagFinanzen(g, id);
    if (zustand === "beispiel" || zustand === "offen") {
      const wl = g.teams.find((t) => /Wrecking/i.test(t.name)) ?? g.teams.find((t) => t.teamId !== TEAM && buildLoanOffers(g, TEAM, 5, 2).some((o) => o.lenderTeamId === t.teamId));
      const bank = originateLoan(g, { borrowerTeamId: TEAM, principal: 10, termSeasons: 3 }, { execute: true, emergency: true });
      g = bank.gameState;
      if (wl) {
        const team = originateLoan(g, { borrowerTeamId: TEAM, principal: 5, termSeasons: 2, lenderType: "team", lenderTeamId: wl.teamId }, { execute: true, emergency: true });
        g = team.gameState;
      }
    }
    for (const id of ids.slice(vorKredit, gespieltJetzt)) g = bucheSpieltagFinanzen(g, id);
    // Aufnehmen und Abloesen sind nur in der Vorsaison erlaubt: fuer die Bilder mit aktivem Knopf die Kauffenster-Phase setzen.
    if (zustand === "offen") {
      return {
        ...g,
        gamePhase: "season_active",
        season: { ...g.season, currentMatchday: 1 },
        matchdayState: { ...g.matchdayState, matchdayId: ids[0]!, status: "open" },
        seasonState: { ...g.seasonState, matchdayResults: [] },
      };
    }
    return { ...g, gamePhase: "season_active" };
  };
  const setze = (zustand: Zustand) => {
    persistence.saveSingleplayerState(gewaehlt!.saveId, bauen(zustand));
    console.log(`[aufnahme] Zustand ${zustand} geschrieben`);
  };
  return { saveId: gewaehlt.saveId, teamId: TEAM, setze };
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
  const { saveId, teamId, setze } = await bereiteKopieVor();
  setze("offen");
  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    const frist = Date.now() + 900_000;
    while (Date.now() < frist && !(await erreichbar(40_000))) await delay(2000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const aufnehmen = async (breite: number, hoehe: number, datei: string, vorher: (p: Page) => Promise<void>) => {
      if (process.env.OLY_SHOT_NUR && !new RegExp(process.env.OLY_SHOT_NUR).test(datei)) return;
      for (let versuch = 1; versuch <= 3; versuch += 1) {
        try {
          const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
          const page = await ctx.newPage();
          const fehler: string[] = [];
          page.on("pageerror", (e) => fehler.push(String(e)));
          const url = new URL("/foundation", BASE_URL);
          url.searchParams.set("view", "credits");
          url.searchParams.set("saveId", saveId);
          url.searchParams.set("team", teamId);
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
          await schliesseBriefing(page);
          await page.getByTestId("foundation-regieband").first().waitFor({ state: "visible", timeout: 120_000 });
          await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 150_000 }).catch(() => undefined);
          await page.getByTestId("finanzen-kredite").waitFor({ state: "visible", timeout: 60_000 });
          await page.waitForTimeout(1500);
          await schliesseBriefing(page);
          await vorher(page);
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(OUTPUT_DIR, datei) });
          const mass = await page.evaluate(() => {
            const wurzel = document.querySelector<HTMLElement>('[data-testid="finanzen-kredite"]');
            const ueber = wurzel
              ? [...wurzel.querySelectorAll<HTMLElement>("*")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.children.length === 0 && e.textContent && e.textContent.length > 1).length
              : -1;
            return {
              sx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              sy: document.documentElement.scrollHeight - document.documentElement.clientHeight,
              ueber,
            };
          });
          console.log(`[aufnahme] ${datei} Seitenscroll x=${mass.sx} y=${mass.sy} Textueberlauf=${mass.ueber} JS-Fehler=${fehler.length}${fehler.length ? ` ${fehler[0]!.slice(0, 160)}` : ""}`);
          await ctx.close();
          return;
        } catch (e) {
          console.log(`[aufnahme] ${datei} Versuch ${versuch} gescheitert: ${String(e).slice(0, 160)}`);
        }
      }
    };
    const nichts = async () => undefined;
    const register = async (p: Page) => {
      await p.getByRole("button", { name: /^Register$/ }).first().click().catch(() => undefined);
    };
    for (const [b, h, n] of [[1920, 1080, "1920x1080"], [2560, 1440, "2560x1440"], [1710, 1112, "1710x1112"]] as Array<[number, number, string]>) {
      await aufnehmen(b, h, `app-kredite-offen-${n}.png`, nichts);
    }
    await aufnehmen(1920, 1080, "app-kredite-register-1920x1080.png", register);
    setze("beispiel");
    await aufnehmen(1920, 1080, "app-kredite-beispiel-1920x1080.png", nichts);
    await aufnehmen(2560, 1440, "app-kredite-beispiel-2560x1440.png", nichts);
    setze("leer");
    await aufnehmen(1920, 1080, "app-kredite-leer-1920x1080.png", nichts);
    await aufnehmen(2560, 1440, "app-kredite-leer-2560x1440.png", nichts);
    setze("gesperrt");
    await aufnehmen(1920, 1080, "app-kredite-gesperrt-1920x1080.png", nichts);
  } finally {
    await browser?.close().catch(() => undefined);
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch {
      /* schon beendet */
    }
    await fs.rm(SQLITE_PATH, { force: true });
    await fs.rm(`${SQLITE_PATH}-wal`, { force: true });
    await fs.rm(`${SQLITE_PATH}-shm`, { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
