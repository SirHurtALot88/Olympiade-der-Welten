// Aufnahme der Arena-Vorstellung aus der laufenden App (22.11.). Voraussetzung: Kopien aus
// scripts/screenshot-arena-vorstellung-bau.ts (vorst-<disz>.sqlite + vorst-meta.json in OPTIK_TMP) und ein
// Produktions-Build (OLY_SERVER=start). Aufruf: OLY_SERVER=start SCREENSHOT_PORT=3211 OPTIK_TMP=<ordner>
//   npx tsx scripts/screenshot-arena-vorstellung-app.ts <ausgabeOrdner> <disziplin> [viewports]
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Page } from "@playwright/test";

const PORT = process.env.SCREENSHOT_PORT ?? "3211";
const BASE = `http://localhost:${PORT}`;
const TMP = process.env.OPTIK_TMP!;
const OUT = path.resolve(process.argv[2] ?? "docs/design/arena-vorstellung-rework-22-11/app");
const DISZ = process.argv[3] ?? "hockey";
const VPS = (process.argv[4] ?? "1920x1080,2560x1440,1710x1112").split(",").map((v) => v.split("x").map(Number) as [number, number]);
const E = ["", "-wal", "-shm"];

async function dismiss(page: Page) {
  for (const name of [/^Erledigt$/, /^Später$/, /^Schließen$/]) {
    const b = page.getByRole("button", { name });
    if (await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => undefined);
  }
}

async function main() {
  const meta = JSON.parse(await fs.readFile(path.join(TMP, "vorst-meta.json"), "utf8"))[DISZ];
  await fs.mkdir(OUT, { recursive: true });
  const arbeit = path.join(TMP, "oly-vorst-foto.sqlite");
  for (const e of E) { await fs.rm(arbeit + e, { force: true }); await fs.copyFile(path.join(TMP, `vorst-${DISZ}.sqlite`) + e, arbeit + e).catch(() => undefined); }
  const server = spawn("npx", ["next", "start", "-p", PORT], { env: { ...process.env, OLY_APP_SQLITE_PATH: arbeit, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  server.stdout?.on("data", () => undefined); server.stderr?.on("data", () => undefined);
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    for (let i = 0; i < 60; i += 1) { try { const r = await fetch(`${BASE}/foundation`); if (r.status < 500) break; } catch { /* warten */ } await delay(2000); }
    for (const [w, h] of VPS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: "dark" });
      const page = await ctx.newPage();
      const fehler: string[] = [];
      page.on("pageerror", (e) => fehler.push(`pageerror: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") fehler.push(`console: ${m.text().slice(0, 200)}`); });
      const url = new URL("/foundation", BASE);
      url.searchParams.set("view", "matchday-arena"); url.searchParams.set("team", meta.teamId); url.searchParams.set("saveId", meta.saveId);
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 300_000 });
      await dismiss(page);
      page.on("response", (r) => { if (r.status() === 404) fehler.push(`404: ${r.url().slice(0, 150)}`); });
      await page.screenshot({ path: path.join(OUT, `vorraum-${DISZ}-${w}.png`) }).catch(() => undefined);
      const zur = page.getByText(/Zur Battle Arena/).first();
      await zur.waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
      await zur.click().catch(() => undefined);
      const vst = page.getByTestId("arena-vorstellung");
      await page.screenshot({ path: path.join(OUT, `roh-${DISZ}-${w}.png`) }).catch(() => undefined);
      await vst.waitFor({ state: "visible", timeout: 90_000 }).catch(async () => {
        await page.screenshot({ path: path.join(OUT, `timeout-${DISZ}-${w}.png`) });
        console.log("[vorst] TIMEOUT Text:", (await page.locator("body").innerText()).slice(0, 600).replace(/\n+/g, " | "), JSON.stringify(fehler.slice(0, 6)));
        throw new Error("Vorstellung nicht sichtbar");
      });
      await page.waitForTimeout(2500);
      if (process.env.TAB2) {
        const tabs = await page.evaluate(() => Array.from(document.querySelectorAll("button,[role=tab],a")).filter((e) => /^Disziplin\s*2/.test((e.textContent ?? "").trim())).map((e) => `${e.tagName}.${(e as HTMLElement).className}|disabled=${(e as HTMLButtonElement).disabled}|${JSON.stringify((e as HTMLElement).getBoundingClientRect())}`));
        console.log("[vorst] Tabs:", JSON.stringify(tabs));
        await page.getByTestId("arena-discipline-select").selectOption({ index: 1 }, { force: true }).catch((e) => console.log("[vorst] select:", String(e).split("\n")[0]));
        await page.waitForTimeout(1500);
        await vst.waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(OUT, `d2-${DISZ}-${w}.png`) });
        console.log("[vorst] D2 Vorstellung sichtbar:", await vst.isVisible().catch(() => false), (await page.getByTestId("arena-vorstellung-zeile").count()));
      }
      await page.mouse.move(w - 4, h - 4);
      await page.screenshot({ path: path.join(OUT, `vorstellung-${DISZ}-${w}.png`) });
      const mass = await page.evaluate(() => {
        const d = document.scrollingElement!;
        const abg = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="arena-vorstellung"] *')).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" && getComputedStyle(e).textOverflow === "ellipsis" && e.clientWidth > 0).slice(0, 8).map((e) => (e.textContent ?? "").trim().slice(0, 30));
        const h = document.querySelector<HTMLElement>('[data-testid="arena-vorstellung"]')!.getBoundingClientRect();
        return { scrollH: d.scrollHeight, innerH: window.innerHeight, scrollW: d.scrollWidth, innerW: window.innerWidth, huelle: [Math.round(h.left), Math.round(h.top), Math.round(h.right), Math.round(h.bottom)], gekuerzt: abg,
          zeilen: document.querySelectorAll('[data-testid="arena-vorstellung-zeile"]').length, spieler: document.querySelectorAll('[data-testid="arena-vorstellung-spieler"]').length };
      });
      console.log(`[vorst] ${DISZ} ${w}x${h}`, JSON.stringify(mass));
      if (w === VPS[0]![0]) {
        const z = page.getByTestId("arena-vorstellung-zeile").nth(1);
        await z.click();
        await page.mouse.move(w - 4, h - 4); await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT, `vorstellung-${DISZ}-zeile-${w}.png`) });
        if (process.env.AKTION === "quicksim") {
          await page.getByTestId("arena-vorstellung-quicksim").click();
          await page.getByText(/Spiel zu Ende/).first().waitFor({ state: "visible", timeout: 120_000 }).catch(() => console.log("[vorst] Quick-Sim: kein 'Spiel zu Ende'"));
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(OUT, `quicksim-${DISZ}-${w}.png`) });
          console.log(`[vorst] nach Quick-Sim: Vorstellung sichtbar=${await vst.isVisible().catch(() => false)} Text=${(await page.locator("body").innerText()).includes("Spiel zu Ende")}`);
          console.log(`[vorst] Fehler ${w}:`, JSON.stringify(fehler.slice(0, 8)));
          await ctx.close();
          continue;
        }
        await page.getByTestId("arena-vorstellung-start").click();
        await page.waitForTimeout(8000);
        await page.screenshot({ path: path.join(OUT, `arena-${DISZ}-${w}.png`) });
        console.log(`[vorst] nach Zur Arena: Vorstellung sichtbar=${await vst.isVisible().catch(() => false)} canvas=${await page.locator("canvas").count()}`);
      }
      console.log(`[vorst] Fehler ${w}:`, JSON.stringify(fehler.slice(0, 8)));
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => undefined);
    try { process.kill(-server.pid!, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    await delay(800);
    for (const e of E) await fs.rm(arbeit + e, { force: true });
  }
  process.exit(0);
}
void main().catch((e) => { console.error(e); process.exit(1); });
