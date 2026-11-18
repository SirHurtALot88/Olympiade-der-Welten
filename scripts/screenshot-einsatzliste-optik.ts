// ===================================================================================
// SICHTPROBE EINSATZLISTE (Optik-Runde 18.11.): Wegwerf-Battle-Save, Spieltage per Auto-Run,
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
const TMP = os.tmpdir();
const META = path.join(TMP, "optik-meta.json");
const kopiePfad = (d: string) => path.join(TMP, `optik-${d}.sqlite`);
const ENDUNGEN = ["", "-wal", "-shm"];
const VIEWPORTS: Array<[number, number]> = (process.env.VIEWPORTS ?? "2560x1440,1920x1080,1710x1112")
  .split(",").map((v) => v.split("x").map(Number) as [number, number]);

type Meta = Record<string, { saveId: string; teamId: string; seite: number }>;

async function bau() {
  const wunsch = new Set((process.argv[4] ?? "basketball,tennis,spurt").split(","));
  const arbeit = path.join(TMP, "oly-einsatzliste-optik-bau.sqlite");
  for (const e of ENDUNGEN) await fs.rm(arbeit + e, { force: true });
  process.env.OLY_APP_SQLITE_PATH = arbeit;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[optik]" });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  const besitz = (mensch: boolean) => {
    const st = persistence.getSaveById(saveId)!.gameState;
    persistence.saveSingleplayerState(saveId, applyGameModeOwnership(st, { saveMode: "solo_1", chrisTeamIds: mensch ? [teamId] : [], frankyTeamIds: [] }));
  };
  besitz(false);
  const schedule = getSeasonDisciplineSchedule(persistence.getSaveById(saveId)!.gameState);
  console.log(schedule.map((e) => `${e.matchdayId}: ${e.discipline1?.disciplineId} + ${e.discipline2?.disciplineId}`).join("\n"));
  const meta: Meta = {};
  for (let i = 0; i < 40 && wunsch.size > 0; i += 1) {
    const gs = persistence.getSaveById(saveId)!.gameState;
    const seasonId = gs.season.id;
    const matchdayId = gs.matchdayState.matchdayId;
    const eintrag = schedule.find((e) => e.matchdayId === matchdayId);
    const wahl = [eintrag?.discipline1?.disciplineId, eintrag?.discipline2?.disciplineId].find((d): d is string => !!d && wunsch.has(d));
    if (wahl) {
      wunsch.delete(wahl);
      besitz(true);
      const st = persistence.getSaveById(saveId)!.gameState;
      if (!hasPersistedTeamCaptain(st, teamId)) {
        // Spielstart-Ablauf: ein Mensch-Team ohne Saison-Kapitaen wird sonst auf „Kapitaen waehlen“ umgeleitet.
        const k = buildCaptainCandidateProfiles(st, teamId)[0] as unknown as { playerId?: string; id?: string } | undefined;
        const pid = k?.playerId ?? k?.id;
        if (pid) persistence.saveSingleplayerState(saveId, setTeamCaptain(st, teamId, pid));
      }
      for (const e of ENDUNGEN) {
        await fs.rm(kopiePfad(wahl) + e, { force: true });
        await fs.copyFile(arbeit + e, kopiePfad(wahl) + e).catch(() => undefined);
      }
      meta[wahl] = { saveId, teamId, seite: eintrag?.discipline1?.disciplineId === wahl ? 0 : 1 };
      console.log(`[optik] Kopie ${wahl} bei ${matchdayId}`);
      besitz(false);
    }
    if (wunsch.size === 0) break;
    const lauf = await runLocalMatchdayAutoRun({ saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false } }, persistence);
    if (!lauf.ok) { console.log(`blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`); break; }
    const adv = await executeMatchdayAdvance({ saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
    if (!adv.ok || !adv.applied) { console.log("Wechsel blockiert"); break; }
  }
  let alt: Meta = {};
  try { alt = JSON.parse(await fs.readFile(META, "utf8")) as Meta; } catch { /* neu */ }
  await fs.writeFile(META, JSON.stringify({ ...alt, ...meta }));
  console.log(`[optik] nicht gefunden: ${[...wunsch].join(",") || "-"}`);
  for (const e of ENDUNGEN) await fs.rm(arbeit + e, { force: true });
  process.exit(0);
}

function startDevServer(sqlite: string): ChildProcess {
  const child = spawn("npm", ["run", "dev"], {
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
  const disz = process.argv[4] ?? "basketball";
  const praefix = process.argv[5] ?? "app";
  const meta = (JSON.parse(await fs.readFile(META, "utf8")) as Meta)[disz];
  if (!meta) throw new Error(`Keine Kopie fuer ${disz}.`);
  await fs.mkdir(OUT, { recursive: true });
  const arbeit = path.join(TMP, "oly-einsatzliste-optik-foto.sqlite");
  for (const e of ENDUNGEN) { await fs.rm(arbeit + e, { force: true }); await fs.copyFile(kopiePfad(disz) + e, arbeit + e).catch(() => undefined); }
  const server = startDevServer(arbeit);
  let browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    await waitForServer(240_000);
    for (const [w, h] of VIEWPORTS) {
      for (let runde = 0; runde < 3; runde += 1) {
        try {
          if (!browser.isConnected()) browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: "dark" });
          const page = await ctx.newPage();
          const url = new URL("/foundation", BASE_URL);
          url.searchParams.set("view", "lineup-v2");
          url.searchParams.set("team", meta.teamId);
          url.searchParams.set("saveId", meta.saveId);
          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 400_000 });
          await dismiss(page);
          await page.getByTestId("elm-feld").waitFor({ state: "visible", timeout: 400_000 });
          await page.waitForTimeout(3500);
          await dismiss(page);
          const fuell = page.getByRole("button", { name: /Auffüllen/ }).first();
          if (await fuell.isEnabled().catch(() => false)) {
            await fuell.click();
            await page.mouse.move(w - 4, h - 4);
            await page.waitForTimeout(4200);
          }
          const reiter = page.locator(".bc-reiter").nth(meta.seite);
          if (await reiter.isVisible().catch(() => false)) {
            await reiter.click();
            await page.mouse.move(w - 4, h - 4);
            await page.waitForTimeout(900);
          }
          await page.screenshot({ path: path.join(OUT, `${praefix}-${disz}-${w}.png`) });
          console.log(`[optik] ${disz} ${w}x${h}`);
          const tab = page.getByRole("tab", { name: /^Gegner$/ });
          if (await tab.first().isVisible().catch(() => false)) {
            await tab.first().click();
            await page.mouse.move(w - 4, h - 4);
            await page.waitForTimeout(600);
            await page.screenshot({ path: path.join(OUT, `${praefix}-${disz}-gegner-${w}.png`) });
          }
          await ctx.close();
          break;
        } catch (fehler) {
          console.log(`[optik] ${disz} ${w}x${h} Versuch ${runde + 1} gescheitert: ${(fehler as Error).message.split("\n")[0]}`);
        }
      }
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
