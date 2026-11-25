// ===================================================================================
// VERLAENGERUNG MITTEN IN DER SAISON (21.11.): Wegwerf-Spielstand + Dev-Server + Chromium-Aufnahmen.
//
//   npx tsx scripts/screenshot-verlaengerung-in-saison.ts vorbereiten
//   flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-verlaengerung-in-saison.ts aufnehmen
//
// Der Spielstand liegt in einer eigenen SQLite (SHOT_SQLITE), nie der echte, nie data/online-saves.
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const SQLITE_PATH = process.env.SHOT_SQLITE ?? "/tmp/oly-verlaengerung-shot.sqlite";
const IDS_PATH = `${SQLITE_PATH}.ids.json`;
const OUT = path.join(process.cwd(), "docs", "design", "verlaengerung-in-saison-21-11");
const GEPLAYED = 5;

process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
process.env.OLY_AUTO_EXPORT_SAVES = "0";
process.env.OLY_AUTO_EXPORT_PUSH = "0";

type Ids = { saveId: string; team: string; playerId: string; playerName: string };

async function vorbereiten() {
  for (const e of ["", "-wal", "-shm", ".ids.json"]) await fs.rm(`${SQLITE_PATH}${e}`, { force: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "verlaengerung-in-saison-aufnahme" });
  const { fuehreLigaSetupDraftAus } = await import("@/lib/game/league-setup-draft-service");
  await fuehreLigaSetupDraftAus({ persistence, saveId: frisch.saveId, seasonId: frisch.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[verl]" });
  const gs = persistence.getSaveById(frisch.saveId)!.gameState;
  const team = [...gs.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!.teamId;
  const settings = { ...(gs.seasonState.teamControlSettings ?? {}) };
  settings[team] = { ...settings[team]!, controlMode: "manual", ownerId: "user_local" };
  const kader = gs.rosters.filter((r) => r.teamId === team);
  const ziel = kader.sort((a, b) => b.salary - a.salary)[0]!;
  const spieler = gs.players.find((p) => p.id === ziel.playerId)!;
  const ids = gs.season.matchdayIds;
  const rosters = gs.rosters.map((r) =>
    r.id === ziel.id ? { ...r, contractLength: 1, contractEndSeasonNumber: 1, contractStatus: "expiring" as const } : r,
  );
  const next = {
    ...gs,
    gamePhase: "season_active" as const,
    rosters,
    season: { ...gs.season, currentMatchday: GEPLAYED + 1 },
    matchdayState: { ...gs.matchdayState, matchdayId: ids[GEPLAYED]!, status: "ready" as const },
    seasonState: {
      ...gs.seasonState,
      teamControlSettings: settings,
      matchdayResults: ids.slice(0, GEPLAYED).map((matchdayId, i) => ({
        id: `result-${i}`,
        saveId: frisch.saveId,
        seasonId: gs.season.id,
        matchdayId,
        status: "preview_applied" as const,
        sourceVersion: "aufnahme",
        teamsTotal: gs.teams.length,
        teamsReady: gs.teams.length,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "",
        updatedAt: "",
      })),
    },
  };
  persistence.saveSingleplayerState(frisch.saveId, next as never);
  await fs.writeFile(IDS_PATH, JSON.stringify({ saveId: frisch.saveId, team, playerId: ziel.playerId, playerName: spieler.name } satisfies Ids));
  console.log("[verl-shot] vorbereitet", frisch.saveId, team, spieler.name, "Spieltage", ids.length);
}

function starteServer(): ChildProcess {
  const kind = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stdout?.on("data", (c) => process.stdout.write(`[srv] ${c}`));
  kind.stderr?.on("data", (c) => process.stderr.write(`[srv] ${c}`));
  return kind;
}

async function warteAufServer() {
  const ende = Date.now() + 240_000;
  while (Date.now() < ende) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.status < 500) return;
    } catch {
      /* noch nicht oben */
    }
    await delay(2000);
  }
  throw new Error("Server nicht erreichbar");
}

async function aufnehmen() {
  const ids = JSON.parse(await fs.readFile(IDS_PATH, "utf8")) as Ids;
  await fs.mkdir(OUT, { recursive: true });
  const server = starteServer();
  let browser: Browser | null = null;
  try {
    await warteAufServer();
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    for (const [b, h] of [[1920, 1080], [2560, 1440]] as Array<[number, number]>) {
      const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      await page.goto(
        `${BASE_URL}/foundation?view=teams&saveId=${encodeURIComponent(ids.saveId)}&team=${encodeURIComponent(ids.team)}`,
        { waitUntil: "domcontentloaded", timeout: 240_000 },
      );
      await page.getByRole("button", { name: /Liste & Verträge/ }).first().click({ timeout: 240_000 });
      const knopf = page.locator("tr", { hasText: ids.playerName }).getByRole("button", { name: /verlängern/ }).first();
      await knopf.waitFor({ state: "visible", timeout: 120_000 }).catch(async (e) => {
        await page.screenshot({ path: "/tmp/claude-0/verl-debug.png", fullPage: true });
        throw e;
      });
      await knopf.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `01-kader-${b}.png`) });
      console.log("[verl-shot] knopf aktiv:", await knopf.isEnabled());
      await knopf.click();
      await page.getByTestId("contract-renewal-negotiation").waitFor({ state: "visible", timeout: 60_000 }).catch(async (e) => {
        await page.screenshot({ path: "/tmp/claude-0/verl-debug2.png" });
        throw e;
      });
      await page.getByTestId("negotiation-in-season").waitFor({ state: "visible", timeout: 60_000 }).catch(() => console.log("[verl-shot] kein In-Saison-Block"));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `02-dialog-${b}.png`) });
      await ctx.close();
    }
  } finally {
    await browser?.close().catch(() => undefined);
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* schon beendet */
    }
  }
}

const modus = process.argv[2];
(modus === "aufnehmen" ? aufnehmen() : vorbereiten()).then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
