// ===================================================================================
// DRAFT-SEITE (18.11.): Wegwerf-Spielstand + Produktions-Server + Chromium-Aufnahmen.
//
// Zwei Phasen, damit die Aufnahme-Sperre nur kurz gehalten wird:
//   npx tsx scripts/screenshot-draft-seite.ts vorbereiten   (ohne Sperre: legt die SQLite an und fährt 12 KI-Picks)
//   flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-draft-seite.ts aufnehmen
// Voraussetzung für „aufnehmen“: `npm run build` ist gelaufen. Nie der echte Spielstand, nie data/online-saves.
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3216";
const BASE_URL = `http://localhost:${PORT}`;
const SQLITE_PATH = process.env.DRAFT_SHOT_SQLITE ?? "/tmp/oly-draft-seite-shot.sqlite";
const IDS_PATH = `${SQLITE_PATH}.ids.json`;
const OUT = path.join(process.cwd(), "docs", "design", "draft-seite-bau-18-11");
const FRANKY = "franky_remote_placeholder";

process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
process.env.OLY_AUTO_EXPORT_SAVES = "0";
process.env.OLY_AUTO_EXPORT_PUSH = "0";

type Ids = { saveId: string; chris: string; franky: string };

async function vorbereiten() {
  for (const e of ["", "-wal", "-shm", ".ids.json"]) await fs.rm(`${SQLITE_PATH}${e}`, { force: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const { starteLigaDraft, laufeKiZuege } = await import("@/lib/draft/liga-draft-dienst");
  const persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "draft-seite-aufnahme" });
  const saveId = frisch.saveId;
  const nachKasse = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0));
  const chris = nachKasse[0]!.teamId;
  const franky = nachKasse[1]!.teamId;
  const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
  settings[chris] = { ...settings[chris]!, controlMode: "manual", ownerId: "user_local" };
  settings[franky] = { ...settings[franky]!, controlMode: "manual", ownerId: FRANKY };
  persistence.saveSingleplayerState(saveId, { ...frisch.gameState, seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings } });
  starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [chris, franky] });
  laufeKiZuege({ persistence, saveId, maxPicks: 8 });
  laufeKiZuege({ persistence, saveId, maxPicks: 4 });
  await fs.writeFile(IDS_PATH, JSON.stringify({ saveId, chris, franky } satisfies Ids));
  console.log("[draft-shot] vorbereitet", saveId, chris, franky);
}

function starteServer(): ChildProcess {
  const kind = spawn("npx", ["next", "start", "-p", PORT], {
    env: { ...process.env, PORT },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stdout?.on("data", (c) => process.stdout.write(`[srv] ${c}`));
  kind.stderr?.on("data", (c) => process.stderr.write(`[srv] ${c}`));
  return kind;
}

async function warteAufServer() {
  const ende = Date.now() + 120_000;
  while (Date.now() < ende) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.status < 500) return;
    } catch {
      /* noch nicht oben */
    }
    await delay(1500);
  }
  throw new Error("Server nicht erreichbar");
}

async function aufnehmen() {
  const ids = JSON.parse(await fs.readFile(IDS_PATH, "utf8")) as Ids;
  await fs.mkdir(OUT, { recursive: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const dienst = await import("@/lib/draft/liga-draft-dienst");
  const ki = await import("@/lib/draft/liga-draft-ki");
  const persistence = createPersistenceService();
  const server = starteServer();
  let browser: Browser | null = null;
  const GROESSEN: Array<[number, number]> = [[1920, 1080], [2560, 1440]];
  const url = () => `${BASE_URL}/foundation?saveId=${encodeURIComponent(ids.saveId)}&team=${encodeURIComponent(ids.chris)}`;
  const neu = async (b: number, h: number) => {
    const ctx = await browser!.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
    await page.goto(url(), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByTestId("liga-draft-seite").waitFor({ state: "visible", timeout: 90_000 });
    await page.getByTestId("draft-laedt").waitFor({ state: "detached", timeout: 60_000 }).catch(() => undefined);
    await page.getByTestId("draft-zeile").first().waitFor({ state: "visible", timeout: 90_000 }).catch(() => undefined);
    return { ctx, page };
  };
  const foto = async (page: Page, name: string) => {
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log("[draft-shot]", name);
  };
  const pausiere = async (page: Page) => page.getByTitle("Pause").first().click().catch(() => undefined);
  const bisMensch = () => {
    for (let i = 0; i < 80; i += 1) {
      const e = dienst.laufeKiZuege({ persistence, saveId: ids.saveId, maxPicks: 8 });
      if (e.halt !== "max_picks") return e.halt;
    }
    return "max";
  };
  const billigste = (n: number) => ki.freieSpieler(persistence.getSaveById(ids.saveId)!.gameState).sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0)).slice(0, n).map((p) => p.id);
  try {
    await warteAufServer();
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    // 01 KI pickt live
    for (const [b, h] of GROESSEN) {
      const { ctx, page } = await neu(b, h);
      await pausiere(page);
      await foto(page, `01-ki-pickt-${b}.png`);
      await ctx.close();
    }
    {
      const { ctx, page } = await neu(1920, 1080);
      await page.locator(".fk.pick").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      await foto(page, "01b-pick-aufgedeckt-1920.png");
      await ctx.close();
    }
    // 02 wartet auf Franky (Franky liegt vor Chris in Runde 1)
    console.log("[draft-shot] bis Mensch:", bisMensch());
    {
      const { ctx, page } = await neu(1920, 1080);
      await foto(page, "02-wartet-auf-franky-1920.png");
      await ctx.close();
    }
    // Franky pickt, dann ist Chris dran
    const frankyWahl = (await import("@/lib/draft/liga-draft-ansicht")).baueLigaDraftAnsicht({ gameState: persistence.getSaveById(ids.saveId)!.gameState, saveId: ids.saveId, betrachterTeamId: ids.franky, vorschau: 0 })!;
    dienst.bucheMenschPick({ persistence, saveId: ids.saveId, teamId: ids.franky, playerId: frankyWahl.mein!.vorschlag[0]! });
    console.log("[draft-shot] bis Mensch:", bisMensch());
    for (const [b, h] of GROESSEN) {
      const { ctx, page } = await neu(b, h);
      await foto(page, `03-du-bist-dran-${b}.png`);
      await ctx.close();
    }
    // 04 Nebel aus
    {
      const save = persistence.getSaveById(ids.saveId)!;
      persistence.saveSingleplayerState(ids.saveId, { ...save.gameState, scenarioMeta: { ...(save.gameState.scenarioMeta ?? {}), scoutingNebelAus: true } as never });
      const { ctx, page } = await neu(1920, 1080);
      await foto(page, "04-nebel-aus-1920.png");
      await ctx.close();
      const s2 = persistence.getSaveById(ids.saveId)!;
      persistence.saveSingleplayerState(ids.saveId, { ...s2.gameState, scenarioMeta: { ...(s2.gameState.scenarioMeta ?? {}), scoutingNebelAus: false } as never });
    }
    // 05 Pick-Tafel, 06 Überspringen, 07 Nachzug, 08 Ergebnis (eine Sitzung)
    {
      const { ctx, page } = await neu(1920, 1080);
      await page.getByTestId("draft-reiter-tafel").click();
      await foto(page, "05-pick-tafel-1920.png");
      await page.getByTestId("draft-reiter-live").click();
      await page.getByTestId("draft-ueberspringen").click();
      await foto(page, "06-ueberspringen-1920.png");
      await page.getByTestId("draft-skip-a").click();
      await page.getByTestId("draft-nachzug").waitFor({ state: "visible", timeout: 120_000 });
      await page.getByTestId("draft-zeile").first().waitFor({ state: "visible", timeout: 30_000 });
      await foto(page, "07-nachzug-1920.png");
      for (const team of [ids.chris, ids.franky]) {
        let gepickt = 0;
        for (const id of billigste(60)) {
          if (gepickt >= 8) break;
          try {
            dienst.bucheMenschPick({ persistence, saveId: ids.saveId, teamId: team, playerId: id });
            gepickt += 1;
          } catch (e) {
            if (gepickt === 0) console.log("[draft-shot] pick:", String(e).slice(0, 80));
          }
        }
        try {
          dienst.bucheMenschFertig({ persistence, saveId: ids.saveId, teamId: team });
        } catch (e) {
          console.log("[draft-shot] fertig:", String(e).slice(0, 80));
        }
      }
      await page.getByTestId("draft-ergebnis").waitFor({ state: "visible", timeout: 60_000 });
      await foto(page, "08-ergebnis-1920.png");
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
(modus === "vorbereiten" ? vorbereiten() : aufnehmen()).then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
