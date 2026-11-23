// ===================================================================================
// AUFNAHMEN: Training Runde 2, Plan mit Ziel-Heatmap (22.11., docs/design/training-r2-bau-22-11.md). Echte App (Dev-Server, Auto-Export aus)
// auf einer KOPIE des Live-Abbilds, auf der die Trainingsvorlieben fuer die laufende Saison gestempelt sind (Messhebel, nicht im Spiel):
//
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz | gunzip -c > /tmp/abbild.sqlite
//   flock /tmp/oly-aufnahme.lock env OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/screenshot-training-r2.ts --team D-P
//
// Optionen: --out <ordner> (Standard docs/design/training-r2-22-11), --prefix <text> (Standard "app"), --nur <name>[,<name>] (Ansichten filtern)
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

const PORT = process.env.SCREENSHOT_PORT ?? "3219";
const BASE_URL = `http://localhost:${PORT}`;
const TEAM = arg("team", "D-P");
const OUTPUT_DIR = path.resolve(arg("out", path.join(process.cwd(), "docs", "design", "training-r2-22-11")));
const PREFIX = arg("prefix", "app");
const NUR = arg("nur", "").split(",").filter(Boolean);
const GROESSEN = (arg("groessen", "1920x1080,2560x1440") as string).split(",").map((g) => {
  const [b, h] = g.split("x").map(Number);
  return { breite: b!, hoehe: h! };
});

type Ansicht = { name: string; spieler: string; mass?: "Skillpunkte" | "Eignung" | "Luft bis Decke"; aktion?: (page: Page) => Promise<void> };
const ANSICHTEN: Ansicht[] = [
  { name: "heatmap-maru", spieler: "Maru" },
  { name: "heatmap-eignung-zyra", spieler: "Zyra", mass: "Eignung" },
  { name: "heatmap-zynara-verletzt", spieler: "Zynara" },
  { name: "heatmap-luft-conan", spieler: "Conan", mass: "Luft bis Decke" },
];

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
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const save = createPersistenceService().getActiveSave();
  if (!save) throw new Error("Kein aktiver Spielstand.");
  const url = new URL("/foundation", BASE_URL);
  url.searchParams.set("view", "trainingCompact");
  url.searchParams.set("saveId", save.saveId);
  url.searchParams.set("team", TEAM);
  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(600_000);
    browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
    for (const groesse of GROESSEN) {
      const ctx = await browser.newContext({ viewport: { width: groesse.breite, height: groesse.hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const fehler: string[] = [];
      page.on("pageerror", (e) => {
        fehler.push(String(e).slice(0, 300));
        console.log("[pageerror]", String(e).slice(0, 300));
      });
      page.on("console", (m) => {
        if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
      });
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 900_000 });
      await page.waitForLoadState("networkidle", { timeout: 300_000 }).catch(() => undefined);
      await page.getByTestId("training-modern").waitFor({ state: "visible", timeout: 600_000 });
      await page.waitForTimeout(4000);
      await schliesseBriefing(page);
      await page.getByRole("tab", { name: /^Plan/ }).click();
      await page.getByTestId("training-plan").waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForTimeout(2500);
      for (const ansicht of ANSICHTEN) {
        if (NUR.length > 0 && !NUR.includes(ansicht.name)) continue;
        await page.getByTestId("training-plan-kaderzeile").filter({ hasText: ansicht.spieler }).first().click();
        await page.waitForTimeout(2500);
        const massName = ansicht.mass ?? "Skillpunkte";
        await page.getByTestId("training-heat-mass").getByRole("button", { name: massName }).click();
        await page.waitForTimeout(800);
        await page.mouse.move(2, 2);
        if (ansicht.aktion) await ansicht.aktion(page);
        const datei = path.join(OUTPUT_DIR, `${PREFIX}-${ansicht.name}-${groesse.breite}x${groesse.hoehe}.png`);
        await page.screenshot({ path: datei });
        const scroll = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, ch: window.innerHeight, w: document.documentElement.scrollWidth, cw: window.innerWidth }));
        console.log(`[aufnahme] ${ansicht.name} ${groesse.breite}x${groesse.hoehe} seitenscroll=${scroll.h > scroll.ch + 1 || scroll.w > scroll.cw + 1 ? "JA" : "nein"} (${scroll.w}x${scroll.h})`);
      }
      console.log(`[aufnahme] JS-Fehler ${groesse.breite}: ${fehler.length}`);
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

aufnehmen().catch((error) => {
  console.error(error);
  process.exit(1);
});
