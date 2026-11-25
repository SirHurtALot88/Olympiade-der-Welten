// ===================================================================================
// VERTRAGSWERT (25.11.): Aufnahmen des Verhandlungstischs (Erwartung im Nebel, Formkarte, Jahresplan, „Ausstieg kostet“, 5 Jahre).
// Wegwerf-SQLite (Neues Spiel, Liga-Setup-Draft), ein Spieler voll gescoutet, einer beobachtet, Dev-Server mit Auto-Export AUS.
//
// AUFRUF: flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-vertragswert.ts
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3218";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "vertragswert-25-11");
const SQLITE_PATH = process.env.SHOT_SQLITE ?? path.join(os.tmpdir(), `oly-vertragswert-${process.pid}.sqlite`);

async function baueSave(): Promise<{ saveId: string; teamId: string; gescoutet: string; beobachtet: string; unbekannt: string }> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[shot-vw]" });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  let zustand = applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [teamId], frankyTeamIds: [] });
  const imKader = new Set(zustand.rosters.map((r) => r.playerId));
  const frei = zustand.players
    .filter((p) => !imKader.has(p.id) && (p.marketValue ?? 0) > 0)
    .sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0));
  const gescoutet = frei[Math.floor(frei.length * 0.4)]!.id;
  const beobachtet = frei[Math.floor(frei.length * 0.3)]!.id;
  const unbekannt = frei[Math.floor(frei.length * 0.2)]!.id;
  const jetzt = new Date().toISOString();
  const intel = (playerId: string, certainty: number) => ({ playerId, teamId, seasonId: zustand.season.id, source: "watchlist", certainty, startedAt: jetzt, lastTickAt: jetzt, ticksCompleted: 4 });
  zustand = {
    ...zustand,
    teams: zustand.teams.map((t) => (t.teamId === teamId ? { ...t, cash: 400, budget: Math.max(t.budget, 400) } : t)),
    seasonState: {
      ...zustand.seasonState,
      scoutIntelByTeamId: { ...(zustand.seasonState.scoutIntelByTeamId ?? {}), [teamId]: [intel(gescoutet, 100), intel(beobachtet, 60)] as never },
    },
  };
  persistence.saveSingleplayerState(saveId, zustand);
  return { saveId, teamId, gescoutet, beobachtet, unbekannt };
}

function starteDevServer(): ChildProcess {
  const kind = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stderr?.on("data", (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return kind;
}

async function warteAufServer(timeoutMs: number) {
  const ende = Date.now() + timeoutMs;
  while (Date.now() < ende) {
    try {
      const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store" });
      if (r.status < 500) return;
    } catch {
      /* noch nicht oben */
    }
    await delay(3000);
  }
  throw new Error("Dev-Server nicht erreichbar");
}

async function briefingSchliessen(page: Page) {
  const hintergrund = page.getByTestId("season-briefing-backdrop");
  await hintergrund.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  if (!(await hintergrund.isVisible().catch(() => false))) return;
  for (const name of [/^Erledigt$/, /^Später$/]) {
    const k = page.getByRole("button", { name });
    if (await k.isVisible().catch(() => false)) {
      await k.click();
      break;
    }
  }
  await hintergrund.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const idsPfad = `${SQLITE_PATH}.ids.json`;
  const vorhanden = await fs.readFile(idsPfad, "utf8").catch(() => null);
  const ids = vorhanden ? (JSON.parse(vorhanden) as Awaited<ReturnType<typeof baueSave>>) : await baueSave();
  await fs.writeFile(idsPfad, JSON.stringify(ids));
  console.log("[shot-vw]", JSON.stringify(ids));
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const stand = createPersistenceService().getSaveById(ids.saveId)!.gameState;
  const namen = new Map(stand.players.map((p) => [p.id, p.name] as const));
  const server = starteDevServer();
  let browser: Browser | null = null;
  try {
    await warteAufServer(900_000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    for (const [b, h] of [[1920, 1080], [2560, 1440]] as Array<[number, number]>) {
      const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "marketV2");
      url.searchParams.set("saveId", ids.saveId);
      url.searchParams.set("team", ids.teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 240_000 });
      await briefingSchliessen(page);
      await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 120_000 }).catch(async () => {
        await page.getByTestId("foundation-nav-marketV2").click({ timeout: 120_000 });
      });
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 900_000 }).catch(async (e) => {
        await page.screenshot({ path: path.join(OUTPUT_DIR, `debug-${b}.png`) });
        throw e;
      });
      for (const [art, playerId] of [["gescoutet", ids.gescoutet], ["beobachtet", ids.beobachtet], ["unbekannt", ids.unbekannt]] as const) {
        // Zeile über den Namen suchen (auch Spieler mit negativem Fit einblenden).
        const name = namen.get(playerId) ?? playerId;
        await page.getByTestId("tm-suche").fill(name);
        await page.waitForTimeout(800);
        const zeile = page.locator(`[data-testid="tm-zeile"][data-player-id="${playerId}"]`);
        if (!(await zeile.count())) {
          await page.getByTestId("tm-fit-negativ").click();
          await page.waitForTimeout(800);
        }
        await zeile.first().click();
        if ((await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0) await page.keyboard.press("Escape");
        await page.getByTestId("tm-verhandeln-oeffnen").click();
        await page.getByTestId("tm-tisch").waitFor({ state: "visible", timeout: 60_000 });
        await page.waitForTimeout(2500);
        if (art === "gescoutet") {
          // Vier Jahre, front-loaded: Jahresplan und „Ausstieg kostet“ sichtbar.
          await page.locator('[data-testid="tm-tisch"] .seg button', { hasText: /^4/ }).first().click();
          await page.locator('[data-testid="tm-tisch"] .seg button', { hasText: /front/i }).first().click().catch(() => undefined);
          await page.waitForTimeout(2500);
        }
        await page.screenshot({ path: path.join(OUTPUT_DIR, `tisch-${art}-${b}.png`) });
        const mass = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight, sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        console.log(`[shot-vw] ${art} ${b}: ${JSON.stringify(mass)} erwartung=${await page.getByTestId("tisch-erwartung").innerText().catch(() => "-")}`);
        await page.getByLabel("Schließen").first().click();
        await page.getByTestId("tm-tisch").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
      }
      await ctx.close();
    }
  } finally {
    await browser?.close().catch(() => undefined);
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* schon beendet */
    }
    if (!process.env.SHOT_SQLITE) for (const e of ["", "-wal", "-shm", ".ids.json"]) await fs.rm(`${SQLITE_PATH}${e}`, { force: true });
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
