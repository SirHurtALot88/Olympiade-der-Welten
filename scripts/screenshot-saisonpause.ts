// ===================================================================================
// SICHTPROBE SAISONPAUSE (21.11.), abgeleitet von screenshot-einsatzliste-optik.ts: Wegwerf-Battle-Save, Spieltage per Auto-Run,
// je gewuenschter Disziplin die Aufstellung bei 2560x1440 / 1920x1080 / 1710x1112 plus Reiter Gegner.
//
// Zwei Phasen, damit nie Save-Bau (grosser Speicher) und Dev-Server + Chromium zugleich laufen
// (der Speicher-Deckel der Sitzung hat sonst den Server abgeschossen):
//   1. bau  <ordner> <disz,disz,...>   spielt Spieltage, legt je Disziplin eine SQLite-Kopie ab (/tmp/optik-<disz>.sqlite)
//   2. foto <ordner> <disz> [praefix]  startet Dev-Server auf der Kopie und fotografiert
//
// AUFRUF: SCREENSHOT_PORT=3211 npx tsx scripts/screenshot-einsatzliste-optik.ts bau docs/design/einsatzliste-optik-18-11 basketball,tennis
//         SCREENSHOT_PORT=3211 npx tsx scripts/screenshot-einsatzliste-optik.ts foto docs/design/einsatzliste-optik-18-11 basketball app
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { setTeamCaptain, buildCaptainCandidateProfiles, hasPersistedTeamCaptain } from "@/lib/morale/team-captain-service";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

const PORT = process.env.SCREENSHOT_PORT ?? "3211";
const BASE_URL = `http://localhost:${PORT}`;
const MODUS = process.argv[2] ?? "bau";
const OUT = path.resolve(process.argv[3] ?? "docs/design/einsatzliste-optik-18-11");
const TMP = process.env.OPTIK_TMP ?? os.tmpdir();
const META = path.join(TMP, "pause-meta.json");
const kopiePfad = (d: string) => path.join(TMP, `pause-${d}.sqlite`);
const ENDUNGEN = ["", "-wal", "-shm"];
const VIEWPORTS: Array<[number, number]> = (process.env.VIEWPORTS ?? "2560x1440,1920x1080,1710x1112")
  .split(",").map((v) => v.split("x").map(Number) as [number, number]);

type Meta = Record<string, { saveId: string; teamId: string; seite: number }>;

async function bau() {
  const arbeit = path.join(TMP, "oly-saisonpause-bau.sqlite");
  for (const e of ENDUNGEN) await fs.rm(arbeit + e, { force: true });
  process.env.OLY_APP_SQLITE_PATH = arbeit;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[pause]" });
  const teamId = persistence.getSaveById(saveId)!.gameState.teams[0]!.teamId;
  const besitz = (mensch: boolean) => {
    const st = persistence.getSaveById(saveId)!.gameState;
    persistence.saveSingleplayerState(saveId, applyGameModeOwnership(st, { saveMode: "solo_1", chrisTeamIds: mensch ? [teamId] : [], frankyTeamIds: [] }));
  };
  besitz(false);
  const stempel = persistence.getSaveById(saveId)!.gameState.seasonState.belastungsRegel;
  console.log(`[pause] Stempel: ${JSON.stringify(stempel)} Spieltage ${persistence.getSaveById(saveId)!.gameState.season.matchdayIds.length}`);
  for (let i = 0; i < 10; i += 1) {
    const gs = persistence.getSaveById(saveId)!.gameState;
    const seasonId = gs.season.id;
    const matchdayId = gs.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun({ saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } }, persistence);
    if (!lauf.ok) { console.log(`blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance({ saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
    if (!adv.ok || !adv.applied) { console.log("Wechsel blockiert"); break; }
    console.log(`[pause] ${matchdayId} gespielt`);
  }
  besitz(true);
  const st = persistence.getSaveById(saveId)!.gameState;
  if (!hasPersistedTeamCaptain(st, teamId)) {
    const k = buildCaptainCandidateProfiles(st, teamId)[0] as unknown as { playerId?: string; id?: string } | undefined;
    const pid = k?.playerId ?? k?.id;
    if (pid) persistence.saveSingleplayerState(saveId, setTeamCaptain(st, teamId, pid));
  }
  const nach = persistence.getSaveById(saveId)!.gameState;
  console.log(`[pause] Pause gebucht: ${Boolean(nach.seasonState.belastungsPause)} Eintraege ${nach.seasonState.belastungsPause?.eintraege.length ?? 0} aktueller Spieltag ${nach.matchdayState.matchdayId}`);
  for (const e of ENDUNGEN) {
    await fs.rm(kopiePfad("pause") + e, { force: true });
    await fs.copyFile(arbeit + e, kopiePfad("pause") + e).catch(() => undefined);
  }
  await fs.writeFile(META, JSON.stringify({ pause: { saveId, teamId, seite: 0 } }));
  for (const e of ENDUNGEN) await fs.rm(arbeit + e, { force: true });
  process.exit(0);
}

function startDevServer(sqlite: string): ChildProcess {
  // OLY_SERVER=start: fertigen Produktions-Build (next build) starten statt Dev-Server (Dev-Cache waechst auf Gigabytes).
  const [befehl, args]: [string, string[]] = process.env.OLY_SERVER === "start" ? ["npx", ["next", "start", "-p", PORT]] : ["npm", ["run", "dev"]];
  const child = spawn(befehl, args, {
    env: { ...process.env, OLY_APP_SQLITE_PATH: sqlite, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  child.stdout?.on("data", () => undefined);
  child.stderr?.on("data", () => undefined);
  return child;
}
async function waitForServer(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store" }); if (r.status < 500) return; } catch { /* warten */ }
    await delay(2000);
  }
  throw new Error("Dev-Server nicht erreichbar.");
}
async function dismiss(page: Page) {
  for (const name of [/^Erledigt$/, /^Später$/, /^Schließen$/]) {
    const b = page.getByRole("button", { name });
    if (await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => undefined);
  }
  await page.waitForTimeout(300);
}

async function foto() {
  const meta = (JSON.parse(await fs.readFile(META, "utf8")) as Meta)["pause"]!;
  await fs.mkdir(OUT, { recursive: true });
  const arbeit = path.join(TMP, "oly-saisonpause-foto.sqlite");
  for (const e of ENDUNGEN) { await fs.rm(arbeit + e, { force: true }); await fs.copyFile(kopiePfad("pause") + e, arbeit + e).catch(() => undefined); }
  const server = startDevServer(arbeit);
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    await waitForServer(240_000);
    for (const [w, h] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: "dark" });
      const page = await ctx.newPage();
      const oeffne = async (view: string) => {
        const url = new URL("/foundation", BASE_URL);
        url.searchParams.set("view", view);
        url.searchParams.set("team", meta.teamId);
        url.searchParams.set("saveId", meta.saveId);
        await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 400_000 });
        await dismiss(page);
      };
      try {
        await oeffne("season-v2");
        await page.getByTestId("saisonstand-modern").waitFor({ state: "visible", timeout: 200_000 });
        await page.locator(".ssm-ansichten").getByText("Spieltage", { exact: true }).click();
        await page.getByTestId("ssm-pause").waitFor({ state: "visible", timeout: 60_000 });
        await page.mouse.move(w - 4, h - 4);
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, `app-spielplan-pause-${w}.png`) });
        console.log(`[pause] spielplan ${w} ok`);
      } catch (f) { console.log(`[pause] spielplan ${w}: ${(f as Error).message.split("\n")[0]}`); }
      try {
        await oeffne("inbox-v2");
        await page.waitForTimeout(5000);
        await dismiss(page);
        const treffer = page.getByText("Saisonpause: alle Spieler erholen sich").first();
        await treffer.waitFor({ state: "visible", timeout: 60_000 });
        await page.mouse.move(w - 4, h - 4);
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, `app-postfach-pause-${w}.png`) });
        console.log(`[pause] postfach ${w} ok`);
      } catch (f) { console.log(`[pause] postfach ${w}: ${(f as Error).message.split("\n")[0]}`); }
      try {
        await oeffne("lineup-v2");
        await page.getByTestId("elm-pause").waitFor({ state: "visible", timeout: 200_000 });
        await page.mouse.move(w - 4, h - 4);
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, `app-einsatzliste-pause-${w}.png`) });
        console.log(`[pause] einsatzliste ${w} ok`);
      } catch (f) { console.log(`[pause] einsatzliste ${w}: ${(f as Error).message.split("\n")[0]}`); }
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => undefined);
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    await delay(800);
    for (const e of ENDUNGEN) await fs.rm(arbeit + e, { force: true });
  }
  process.exit(0);
}

void (MODUS === "foto" ? foto() : bau()).catch((e) => { console.error(e); process.exit(1); });
