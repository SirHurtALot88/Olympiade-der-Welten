// ===================================================================================
// LIVE-CHROMIUM-SCREENSHOTS: Spielerprofil NEU und Kurzprofil (Drawer), Wegwerf-Battle-Save mitten in der Saison.
// Baut eine Wegwerf-SQLite, spielt N Spieltage per Auto-Run, setzt einen Spieler des eigenen Teams auf „verletzt“,
// startet den Dev-Server (Auto-Export AUS) gegen genau diese Datei und schreibt die Bilder nach
// docs/design/spielerprofil-attribute-19-11/. Die Wegwerf-Datei wird am Ende gelöscht (OLY_SHOT_BEHALTEN=1 behält sie).
//
// AUFRUF: npx tsx scripts/screenshot-spielerprofil-attribute.ts [spieltage=7]
// ===================================================================================
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";

const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "spielerprofil-attribute-19-11");
const BEHALTEN = process.env.OLY_SHOT_BEHALTEN === "1";
const SQLITE_PATH = path.join(os.tmpdir(), BEHALTEN ? "oly-spielerprofil-attr-behalten.sqlite" : `oly-spielerprofil-attr-${process.pid}.sqlite`);
const IDS_PATH = `${SQLITE_PATH}.ids.json`;
const SPIELTAGE = Number(process.argv[2] ?? 7);

type Ids = { saveId: string; teamId: string; starId: string; verletztId: string; fremdId: string; freiId: string; ohneFigurId: string; namen: Record<string, string> };

function waehle(gameState: GameState, teamId: string): Omit<Ids, "saveId" | "teamId"> {
  const namen: Record<string, string> = Object.fromEntries(gameState.players.map((player) => [player.id, player.name]));
  const eigene = gameState.rosters.filter((eintrag) => eintrag.teamId === teamId).map((eintrag) => eintrag.playerId);
  const spieler = new Map(gameState.players.map((player) => [player.id, player] as const));
  const mitFigur = eigene.filter((id) => getFigurSpriteForPlayer(id));
  const ohneFigur = eigene.filter((id) => !getFigurSpriteForPlayer(id));
  const staerke = (id: string) => {
    const werte = Object.values(spieler.get(id)?.currentDisciplineValues ?? {}) as number[];
    return werte.length ? Math.max(...werte) : 0;
  };
  const nachStaerke = (ids: string[]) => [...ids].sort((a, b) => staerke(b) - staerke(a));
  const star = nachStaerke(mitFigur)[0] ?? nachStaerke(eigene)[0]!;
  const verletzt = nachStaerke(eigene.filter((id) => id !== star))[0]!;
  const fremd = gameState.rosters.find((eintrag) => eintrag.teamId !== teamId)?.playerId ?? star;
  const vergeben = new Set(gameState.rosters.map((eintrag) => eintrag.playerId));
  const frei = [...gameState.players].filter((player) => !vergeben.has(player.id)).sort((a, b) => staerke(b.id) - staerke(a.id))[0]?.id ?? star;
  return { starId: star, verletztId: verletzt, fremdId: fremd, freiId: frei, ohneFigurId: nachStaerke(ohneFigur)[0] ?? verletzt, namen };
}

async function baueSave(): Promise<Ids> {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[screenshot-profil]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  persistence.saveSingleplayerState(
    saveId, applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  for (let i = 0; i < SPIELTAGE; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      { saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } },
      persistence,
    );
    if (!lauf.ok) { console.log(`[screenshot-profil] ${matchdayId} blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence,
    );
    if (!adv.ok || !adv.applied) { console.log(`[screenshot-profil] Wechsel blockiert: ${adv.blockingReasons.join(" | ")}`); break; }
    console.log(`[screenshot-profil] ${matchdayId} gespielt (${i + 1}/${SPIELTAGE})`);
  }
  // Verletzung setzen: im Spieltag davor verletzt, gesperrt bis zum übernächsten.
  const stand = persistence.getSaveById(saveId)!.gameState;
  const auswahl = waehle(stand, teamId);
  const ids = stand.season.matchdayIds;
  const jetzt = ids.indexOf(stand.matchdayState.matchdayId);
  const verletztAm = ids[Math.max(0, jetzt - 1)]!;
  const bis = ids[Math.min(ids.length - 1, jetzt + 1)]!;
  const verfuegbar = (stand.seasonState.playerAvailabilityState ?? []).filter((e) => e.playerId !== auswahl.verletztId);
  verfuegbar.push({
    playerId: auswahl.verletztId, teamId, fatigue: 55, injuryStatus: "injured", injuryUntilMatchday: bis,
    injuredAtSeasonId: stand.season.id, injuredAtMatchdayId: verletztAm, injuryReason: "Screenshot-Verletzung",
  });
  const ereignisse = [...(stand.seasonState.injuryEvents ?? [])];
  ereignisse.push({
    eventId: "shot-injury-1", seasonId: stand.season.id, matchdayId: verletztAm, teamId, playerId: auswahl.verletztId,
    fatigueBefore: 60, riskPercent: 12, roll: 3, result: "injured", unavailableForMatchdays: 1, unavailableUntil: bis,
    injuryRecovery: 1, timestamp: new Date().toISOString(),
  });
  persistence.saveSingleplayerState(saveId, {
    ...stand,
    seasonState: { ...stand.seasonState, playerAvailabilityState: verfuegbar, injuryEvents: ereignisse },
  });
  return { saveId, teamId, ...auswahl };
}

async function istErreichbar(timeoutMs: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const antwort = await fetch(`${BASE_URL}/foundation`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return antwort.status < 500;
  } catch {
    return false;
  }
}

function starteDevServer(): ChildProcessWithoutNullStreams {
  const env: NodeJS.ProcessEnv = { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" };
  // `--use-openssl-ca` in NODE_OPTIONS lässt „Collecting page data“ des Builds scheitern.
  delete env.NODE_OPTIONS;
  if (process.env.OLY_SHOT_PROD === "1") {
    // Produktionsbuild statt Dev-Server (spart Speicher): erst bauen, dann starten. `.next` räumt der Aufrufer danach weg.
    console.log("[screenshot-profil] baue Produktionsbuild (npm run build) ...");
    const bau = spawnSync("npm", ["run", "build"], { env, stdio: "inherit" });
    if (bau.status !== 0) throw new Error(`Build fehlgeschlagen (Status ${bau.status}).`);
    console.log("[screenshot-profil] starte Produktionsserver (npm run start) ...");
    const kind = spawn("npm", ["run", "start"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    kind.stdout.on("data", (stueck) => process.stdout.write(`[srv] ${stueck}`));
    kind.stderr.on("data", (stueck) => process.stderr.write(`[srv] ${stueck}`));
    return kind;
  }
  console.log("[screenshot-profil] starte Dev-Server (OLY_AUTO_EXPORT_SAVES=0, OLY_AUTO_EXPORT_PUSH=0) ...");
  const kind = spawn("npm", ["run", "dev"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  kind.stdout.on("data", (stueck) => process.stdout.write(`[dev] ${stueck}`));
  kind.stderr.on("data", (stueck) => process.stderr.write(`[dev] ${stueck}`));
  return kind;
}

async function briefingZu(page: Page) {
  const hintergrund = page.getByTestId("season-briefing-backdrop");
  if (!(await hintergrund.isVisible().catch(() => false))) return;
  const fertig = page.getByRole("button", { name: /^Erledigt$/ });
  const spaeter = page.getByRole("button", { name: /^Später$/ });
  if (await fertig.isVisible().catch(() => false)) await fertig.click();
  else if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
  await hintergrund.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function warteAufServer(timeoutMs: number) {
  const ende = Date.now() + timeoutMs;
  while (Date.now() < ende) {
    if (await istErreichbar(40_000)) return;
    await delay(2000);
  }
  throw new Error("Dev-Server wurde nicht rechtzeitig erreichbar.");
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  let ids: Ids | null = null;
  if (BEHALTEN) ids = await fs.readFile(IDS_PATH, "utf8").then((t) => JSON.parse(t) as Ids).catch(() => null);
  if (!ids) {
    await fs.rm(SQLITE_PATH, { force: true });
    ids = await baueSave();
    if (BEHALTEN) await fs.writeFile(IDS_PATH, JSON.stringify(ids));
  }
  if (!ids.namen) {
    process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
    const persistence = createPersistenceService();
    const stand = persistence.getSaveById(ids.saveId)!.gameState;
    ids = { ...ids, namen: Object.fromEntries(stand.players.map((player) => [player.id, player.name])) };
  }
  // Das Team des Profils ist in der Aufnahme das eigene (steuerbar), damit Verlängern/Verkaufen aktiv zu sehen sind.
  {
    process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
    const persistence = createPersistenceService();
    const stand = persistence.getSaveById(ids.saveId)!.gameState;
    persistence.saveSingleplayerState(
      ids.saveId, applyGameModeOwnership(stand, { saveMode: "solo_1", chrisTeamIds: [ids.teamId], frankyTeamIds: [] }),
    );
  }
  if (process.env.OLY_SHOT_NUR_SAVE === "1") {
    console.log("[screenshot-profil] Save fertig, Abbruch wie gewünscht (OLY_SHOT_NUR_SAVE=1).");
    return;
  }
  const gewaehlt = ids;
  console.log(`[screenshot-profil] Star ${gewaehlt.starId}, verletzt ${gewaehlt.verletztId}, fremd ${gewaehlt.fremdId}, frei ${gewaehlt.freiId}, ohne Figur ${gewaehlt.ohneFigurId}`);
  const server = starteDevServer();
  let browser: Browser | null = null;
  try {
    await warteAufServer(900_000);
    browser = await chromium.launch();
    const nur = process.env.OLY_SHOT_NUR;
    const aufnehmen = async (
      breite: number,
      hoehe: number,
      datei: string,
      spielerId: string,
      reiter: string,
      vorher?: (p: Page) => Promise<void>,
      dsf = 1,
    ) => {
      if (nur && !datei.includes(nur)) return;
      if (process.env.OLY_SHOT_VORHANDENE_UEBERSPRINGEN === "1" && (await fs.stat(path.join(OUTPUT_DIR, datei)).then(() => true, () => false))) return;
      const ctx = await browser!.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: dsf });
      const page = await ctx.newPage();
      const fehler: string[] = [];
      page.on("pageerror", (e) => fehler.push(String(e)));
      const url = new URL("/foundation", BASE_URL);
      url.searchParams.set("view", "player-profile");
      url.searchParams.set("playerId", spielerId);
      url.searchParams.set("tab", reiter);
      url.searchParams.set("saveId", gewaehlt.saveId);
      url.searchParams.set("team", gewaehlt.teamId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await briefingZu(page);
      await page.getByTestId("spielerprofil-seite").waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForTimeout(1200);
      if (vorher) await vorher(page);
      await page.waitForTimeout(500);
      const ziel = path.join(OUTPUT_DIR, datei);
      await page.screenshot({ path: ziel });
      // Messung: scrollt die Seite, läuft etwas aus einer Tafel?
      const mass = await page.evaluate(() => {
        const wurzel = document.querySelector('[data-testid="spielerprofil-seite"]') as HTMLElement | null;
        const doc = document.documentElement;
        const ueber: string[] = [];
        wurzel?.querySelectorAll<HTMLElement>(".spr-pan, .spr-zk, .spr-fb").forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) ueber.push(`${el.className.split(" ")[0]} ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`);
        });
        return { seiteScrollt: doc.scrollHeight > window.innerHeight + 2 || doc.scrollWidth > window.innerWidth + 2, dokumentH: doc.scrollHeight, fenster: window.innerHeight, wurzelH: wurzel?.getBoundingClientRect().height ?? 0, ueber };
      });
      console.log(`[screenshot-profil] ${datei} mass=${JSON.stringify(mass)} fehler=${fehler.length}`);
      await ctx.close();
    };
    const geraete: Array<[number, number, string]> = [[2560, 1440, "2560x1440"], [1920, 1080, "1920x1080"], [1710, 1112, "1710x1112"]];
    for (const [b, h, name] of geraete) {
      await aufnehmen(b, h, `01-star-mit-team-${name}.png`, gewaehlt.starId, "overview");
      if (name === "2560x1440") continue;
      await aufnehmen(b, h, `02-verletzt-rollenspieler-${name}.png`, gewaehlt.verletztId, "overview");
      await aufnehmen(b, h, `03-vertragslos-${name}.png`, gewaehlt.freiId, "overview");
      await aufnehmen(b, h, `04-nebel-fremder-spieler-${name}.png`, gewaehlt.fremdId, "overview");
    }
  } finally {
    await browser?.close();
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    if (!BEHALTEN) {
      await fs.rm(SQLITE_PATH, { force: true });
      await fs.rm(`${SQLITE_PATH}-wal`, { force: true });
      await fs.rm(`${SQLITE_PATH}-shm`, { force: true });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
