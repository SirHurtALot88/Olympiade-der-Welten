// ===================================================================================
// AUFNAHMEN: gemeinsames Transferfenster + Transferbilanz (18.11.,
// docs/design/transferfenster-gemeinsam-18-11.md).
//
// Nimmt aus der ECHTEN App (Dev-Server, Auto-Export aus) auf einer WEGWERF-KOPIE auf:
//   Transfermarkt im Fenster (Saison 2 vor Spieltag 1), Saisonrueckblick (Inbox), Saisonstand,
//   Finanzen — je bei 1920x1080 und 2560x1440.
//
// AUFRUF (nur unter dem Aufnahme-Lock, CLAUDE.md):
//   flock /tmp/oly-aufnahme.lock env OLY_APP_SQLITE_PATH=/tmp/kopie.sqlite \
//     npx tsx scripts/screenshot-transferfenster-gemeinsam.ts --save <saveId> --team M-M --praefix neu
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

const PORT = process.env.SCREENSHOT_PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const SAVE = arg("save", "");
const TEAM = arg("team", "M-M");
const PRAEFIX = arg("praefix", "neu");
const NUR = arg("nur", "");
const OUTPUT_DIR = path.join(process.cwd(), "docs", "design", "transferfenster-gemeinsam-18-11");
const GROESSEN = [
  { breite: 1920, hoehe: 1080 },
  { breite: 2560, hoehe: 1440 },
];

function startServer(): ChildProcess {
  const child = spawn("npx", ["tsx", "server.ts"], {
    env: {
      ...process.env,
      PORT,
      OLY_AUTO_EXPORT_SAVES: "0",
      OLY_AUTO_EXPORT_PUSH: "0",
    },
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

function ansicht(view: string, extra: Record<string, string> = {}) {
  const url = new URL("/foundation", BASE_URL);
  url.searchParams.set("view", view);
  url.searchParams.set("saveId", SAVE);
  url.searchParams.set("team", TEAM);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url.toString();
}

async function main() {
  if (!SAVE) throw new Error("--save fehlt");
  if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Kopie!) setzen");
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  type Ansicht = { name: string; url: string; danach?: (page: Page) => Promise<void> };
  const ansichten: Ansicht[] = [
    {
      name: "transfermarkt-fenster",
      url: ansicht("marketV2"),
      danach: async (page) => {
        await page.getByText("Transfermarkt wird geladen", { exact: false }).waitFor({ state: "detached", timeout: 600_000 }).catch(() => undefined);
        await page.waitForTimeout(4000);
      },
    },
    {
      // Der Saisonrueckblick steht in der Chronik der Inbox („Berichte & Momente“).
      name: "saisonrueckblick-inbox",
      url: ansicht("inboxV2"),
      danach: async (page) => {
        await page.getByRole("button", { name: /^Chronik/ }).first().click().catch(() => undefined);
        await page.waitForTimeout(3000);
      },
    },
    {
      // Spalte „Transfers“ steht in der Vereins-Ansicht.
      name: "saisonstand",
      url: ansicht("seasonV2"),
      danach: async (page) => {
        await page.getByRole("button", { name: /^Verein$/ }).first().click().catch(() => undefined);
        await page.waitForTimeout(3000);
      },
    },
    { name: "finanzen", url: ansicht("finances") },
    { name: "transferhistorie", url: ansicht("historyV2") },
    {
      // Saison 1: Kaderaufbau statt Transferbilanz.
      name: "transferhistorie-s1",
      url: ansicht("historyV2"),
      danach: async (page) => {
        await page.locator("select").first().selectOption({ label: "Season 1" }).catch(() => undefined);
        await page.waitForTimeout(6000);
      },
    },
  ].filter((a) => !NUR || NUR.split(",").includes(a.name));
  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(300_000);
    browser = await chromium.launch();
    for (const groesse of GROESSEN) {
      const ctx = await browser.newContext({ viewport: { width: groesse.breite, height: groesse.hoehe }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      for (const a of ansichten) {
        await page.goto(a.url, { waitUntil: "domcontentloaded", timeout: 600_000 });
        await page.waitForLoadState("networkidle", { timeout: 300_000 }).catch(() => undefined);
        await page.waitForTimeout(6000);
        await schliesseBriefing(page);
        if (a.danach) await a.danach(page);
        await page.waitForTimeout(1500);
        const datei = path.join(OUTPUT_DIR, `${PRAEFIX}-${a.name}-${groesse.breite}.png`);
        await page.screenshot({ path: datei });
        console.log(`[aufnahme] ${datei}`);
      }
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
