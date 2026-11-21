// ===================================================================================
// NAVIGATION + FLOW (21.11.): Wegwerf-SQLite, Dev-Server (Auto-Export AUS), Chromium.
//   npx tsx scripts/screenshot-navigation-flow.ts nachher   Draft -> Profil -> Zurueck/Vor, Leertaste, Saison-Info
//   npx tsx scripts/screenshot-navigation-flow.ts vorher    nur Saison-Info (mit dem Stand von main in der Shell)
// Bilder: docs/design/navigation-flow-21-11/
// ===================================================================================
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Page } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3218";
const BASE_URL = `http://localhost:${PORT}`;
const MODUS = process.argv[2] ?? "nachher";
const OUT = path.join(process.cwd(), "docs", "design", "navigation-flow-21-11");
const SQLITE = process.env.NAV_SQLITE ?? path.join(os.tmpdir(), "oly-navigation-flow.sqlite");
const IDS = `${SQLITE}.ids.json`;

process.env.OLY_APP_SQLITE_PATH = SQLITE;
process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
process.env.OLY_AUTO_EXPORT_SAVES = "0";
process.env.OLY_AUTO_EXPORT_PUSH = "0";

type Ids = { draftSave: string; draftTeam: string; infoSave: string; infoTeam: string };

async function vorbereiten(): Promise<Ids> {
  if (MODUS === "vorher") {
    try {
      return JSON.parse(await fs.readFile(IDS, "utf8")) as Ids;
    } catch {
      /* neu bauen */
    }
  }
  for (const e of ["", "-wal", "-shm", ".ids.json"]) await fs.rm(`${SQLITE}${e}`, { force: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const { starteLigaDraft, laufeKiZuege } = await import("@/lib/draft/liga-draft-dienst");
  const persistence = createPersistenceService();
  const baue = (name: string) => {
    const frisch = persistence.createFreshSeasonOneSave({ name });
    const teamId = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!.teamId;
    const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
    settings[teamId] = { ...settings[teamId]!, controlMode: "manual", ownerId: "user_local" };
    persistence.saveSingleplayerState(frisch.saveId, {
      ...frisch.gameState,
      seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings },
    });
    return { saveId: frisch.saveId, teamId };
  };
  const d = baue("nav-draft");
  starteLigaDraft({ persistence, saveId: d.saveId, selbstPickendeTeamIds: [d.teamId] });
  for (let i = 0; i < 30; i += 1) {
    const e = laufeKiZuege({ persistence, saveId: d.saveId, maxPicks: 8 });
    if (e.halt !== "max_picks") break;
  }
  const info = baue("nav-info");
  const ids = { draftSave: d.saveId, draftTeam: d.teamId, infoSave: info.saveId, infoTeam: info.teamId };
  await fs.writeFile(IDS, JSON.stringify(ids));
  return ids;
}

function starteServer(): ChildProcess {
  const kind = spawn("npm", ["run", "dev"], { env: { ...process.env, PORT }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  kind.stdout?.on("data", () => undefined);
  kind.stderr?.on("data", () => undefined);
  return kind;
}

async function warte() {
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

const ok = (name: string, wert: boolean, extra = "") => console.log(`[nav] ${wert ? "OK  " : "FEHL"} ${name}${extra ? ` · ${extra}` : ""}`);

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const ids = await vorbereiten();
  const server = starteServer();
  try {
    await warte();
    const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    const seite = async (b: number, h: number, url: string) => {
      const ctx = await browser.newContext({ viewport: { width: b, height: h } });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      return { ctx, page };
    };
    const infoUrl = `${BASE_URL}/foundation?view=homeV2&panel=briefing&saveId=${encodeURIComponent(ids.infoSave)}&team=${encodeURIComponent(ids.infoTeam)}`;
    const foto = async (page: Page, name: string) => {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, name) });
      console.log("[nav] Bild", name);
    };

    for (const [b, h] of [[1920, 1080], [2560, 1440]] as Array<[number, number]>) {
      const { ctx, page } = await seite(b, h, infoUrl);
      await page.getByTestId("season-briefing-page").waitFor({ state: "visible", timeout: 120_000 }).catch(() => undefined);
      await page.getByTestId("season-briefing-loading").waitFor({ state: "detached", timeout: 60_000 }).catch(() => undefined);
      await foto(page, `saisoninfo-${MODUS}-${b}.png`);
      await ctx.close();
    }
    if (MODUS === "vorher") {
      await browser.close();
      return;
    }

    // Draft: Profil oeffnen, Zurueck/Vor
    const draftUrl = `${BASE_URL}/foundation?saveId=${encodeURIComponent(ids.draftSave)}&team=${encodeURIComponent(ids.draftTeam)}`;
    const { ctx, page } = await seite(1920, 1080, draftUrl);
    await page.getByTestId("liga-draft-seite").waitFor({ state: "visible", timeout: 120_000 });
    await page.getByTestId("draft-zeile").first().waitFor({ state: "visible", timeout: 90_000 });
    const sichtbar = async (id: string) => page.getByTestId(id).first().isVisible().catch(() => false);
    const laenge0 = await page.evaluate(() => window.history.length);
    const pickZeile = page.getByTestId("draft-pick-zeile").first();
    if (await pickZeile.count()) await pickZeile.click({ timeout: 15_000 });
    else await page.getByTestId("draft-profil-link").first().click({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    const laenge1 = await page.evaluate(() => window.history.length);
    ok("Profil-Klick legt genau einen History-Eintrag an", laenge1 === laenge0 + 1, `${laenge0} -> ${laenge1}`);
    ok("Profilblatt ist offen", await sichtbar("draft-profil"));
    await foto(page, "draft-profil-offen-1920.png");
    await page.goBack();
    await page.waitForTimeout(1200);
    ok("Zurueck: Draft-Seite bleibt sichtbar", await sichtbar("liga-draft-seite"));
    ok("Zurueck: Profilblatt ist zu", !(await sichtbar("draft-profil")));
    await foto(page, "draft-nach-zurueck-1920.png");
    await page.goForward();
    await page.waitForTimeout(1200);
    await foto(page, "draft-nach-vor-1920.png");
    ok("Vor: Profilblatt wieder offen", await sichtbar("draft-profil"));
    await page.goBack();
    await page.waitForTimeout(800);

    // Reiter
    const reiter = page.getByTestId("draft-reiter-tafel");
    if (await reiter.count()) {
      await reiter.click();
      await page.waitForTimeout(600);
      await page.goBack();
      await page.waitForTimeout(800);
      ok("Reiter: Zurueck fuehrt zu Live, Draft bleibt", await sichtbar("liga-draft-seite"));
    }

    // Leertaste im Draft: der Knopf oben rechts
    const statusText = async () => (await page.getByTestId("foundation-takt-status").first().innerText().catch(() => "")).replace(/\s+/g, " ");
    console.log("[nav] Takt-Status im Draft:", await statusText());
    ok("Takt zeigt nicht „Aktion laeuft“", !/Aktion läuft/i.test(await statusText()));
    const knopf = async () => (await page.getByTestId("foundation-global-next-button").first().innerText().catch(() => "")).replace(/\s+/g, " ");
    const vorher = await knopf();
    const url0 = page.url();
    await page.keyboard.press("Space");
    await page.waitForTimeout(2500);
    const nachher = await knopf();
    const ablauf = await page.getByTestId("foundation-takt-ablauf").first().getAttribute("class");
    console.log("[nav] Knopf vorher:", vorher, "| nachher:", nachher);
    ok("Leertaste im Draft loest die Draft-Aktion aus (Knopf aendert sich oder Ablauf erklaert) und bleibt auf der Draft-Seite", (vorher !== nachher || /is-offen/.test(ablauf ?? "")) && (await sichtbar("liga-draft-seite")) && page.url().split("?")[0] === url0.split("?")[0]);
    await foto(page, "draft-leertaste-1920.png");
    await ctx.close();
    await browser.close();
  } finally {
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* schon beendet */
    }
  }
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
