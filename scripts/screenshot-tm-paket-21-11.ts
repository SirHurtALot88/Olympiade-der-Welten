// ===================================================================================
// TM-PAKET 21.11.: Hover-Bild, Spalten ziehen, großes Profil, Kaderstärke (Spieltage/Slots/Spielplan-Sortierung),
// Team-Fit-Schalter, Filter bleiben beim Reiterwechsel. Aufnahmen 1920x1080 nach docs/design/tm-paket-21-11/.
//
// VORAUSSETZUNG: Dev-Server läuft schon gegen eine KOPIE des live-save-Abbilds (CLAUDE.md), und zwar so:
//   OLY_APP_SQLITE_PATH=<kopie.sqlite> OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 PORT=3231 npm run dev
// AUFRUF: OLY_APP_SQLITE_PATH=<kopie.sqlite> SCREENSHOT_PORT=3231 npx tsx scripts/screenshot-tm-paket-21-11.ts [markt|draft]
// Der Draft-Teil legt im Abbild einen eigenen Draft-Spielstand an (Wegwerf-Kopie, nie der Server).
// ===================================================================================
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PORT = process.env.SCREENSHOT_PORT ?? "3231";
const BASE_URL = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "docs", "design", "tm-paket-21-11");
const MARKT_SAVE = process.env.TM_SAVE ?? "new-game-1795114260527-nzr0z9";
const MARKT_TEAM = process.env.TM_TEAM ?? "D-P";
const teil = process.argv[2] ?? "alles";
const FRANKY = "franky_remote_placeholder";

async function briefingSchliessen(page: Page) {
  const hintergrund = page.getByTestId("season-briefing-backdrop");
  await hintergrund.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  if (!(await hintergrund.isVisible().catch(() => false))) return;
  const erledigt = page.getByRole("button", { name: /^Erledigt$/ });
  const spaeter = page.getByRole("button", { name: /^Später$/ });
  if (await erledigt.isVisible().catch(() => false)) await erledigt.click();
  else if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
  await hintergrund.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function baueDraft(): Promise<{ saveId: string; chris: string }> {
  const { starteLigaDraft, laufeKiZuege } = await import("@/lib/draft/liga-draft-dienst");
  const persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "draft-tm-paket-aufnahme" });
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
  return { saveId, chris };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 300));
  });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, name) });
  const breite = (id: string) => page.evaluate((i) => document.querySelector<HTMLElement>(`[data-testid="spalten-griff-${i}"]`)!.parentElement!.getBoundingClientRect().width, id);
  const ziehen = async (id: string, dx: number) => {
    const g = await page.getByTestId(`spalten-griff-${id}`).boundingBox();
    await page.mouse.move(g!.x + g!.width / 2, g!.y + g!.height / 2);
    await page.mouse.down();
    await page.mouse.move(g!.x + g!.width / 2 + dx / 2, g!.y + g!.height / 2, { steps: 5 });
    await page.mouse.move(g!.x + g!.width / 2 + dx, g!.y + g!.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  try {
    if (teil === "alles" || teil === "markt") {
      const url = `${BASE_URL}/foundation?view=marketV2&saveId=${encodeURIComponent(MARKT_SAVE)}&team=${encodeURIComponent(MARKT_TEAM)}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await briefingSchliessen(page);
      await page.getByTestId("transfermarkt-modern").waitFor({ state: "visible", timeout: 180_000 });
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 180_000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.sessionStorage.clear());
      await page.reload({ waitUntil: "domcontentloaded" });
      await briefingSchliessen(page);
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 180_000 });
      await page.waitForTimeout(2500);
      await shot("01-markt-standard-fit-aus.png");
      console.log("zeilen sichtbar (Fit-Regel an):", await page.getByTestId("tm-zeile").count(), "| fit-marken:", await page.getByTestId("fit-marke").count());
      console.log("fit-schalter:", (await page.getByTestId("tm-fit-negativ").innerText()).replace(/\n/g, " "));
      // Kaderstärke: Spielplan-Sortierung
      await page.getByTestId("tm-staerke-sort-spielplan").click();
      await page.waitForTimeout(500);
      await shot("02-markt-kaderstaerke-spielplan.png");
      const ks = page.locator(".ks");
      await ks.screenshot({ path: path.join(OUT, "02b-kaderstaerke-ausschnitt.png") });
      // Fit an
      await page.getByTestId("tm-fit-negativ").click();
      await page.waitForTimeout(600);
      await shot("03-markt-fit-negativ-eingeblendet.png");
      console.log("zeilen sichtbar (Fit negativ an):", await page.getByTestId("tm-zeile").count(), "| fit-schalter:", (await page.getByTestId("tm-fit-negativ").innerText()).replace(/\n/g, " "));
      await page.getByTestId("tm-fit-negativ").click();
      // Hover
      await page.getByTestId("tm-portrait").first().hover();
      await page.waitForTimeout(700);
      await shot("04-markt-hover-bild.png");
      await page.mouse.move(5, 5);
      // Spalte ziehen
      const vor = await breite("eg");
      await ziehen("eg", 80);
      console.log("eg-Breite:", vor, "->", await breite("eg"));
      await shot("05-markt-spalte-gezogen.png");
      await page.getByTestId("tm-spalten-zuruecksetzen").click();
      // Filter setzen, Reiter wechseln, zurück
      await page.getByTestId("tm-suche").fill("a");
      await page.getByTestId("tm-achse-pow").click().catch(() => undefined);
      await page.getByTestId("tm-sort-gehalt").click().catch(() => undefined);
      await page.getByTestId("tm-fit-negativ").click();
      await page.waitForTimeout(800);
      await shot("06-markt-filter-gesetzt.png");
      const vorher = await page.evaluate(() => ({ suche: (document.querySelector('[data-testid="tm-suche"]') as HTMLInputElement).value, n: document.querySelectorAll('[data-testid="tm-zeile"]').length }));
      await page.getByTestId("tm-reiter-verkauf").click();
      await page.waitForTimeout(800);
      await page.getByTestId("tm-reiter-markt").click();
      await page.waitForTimeout(800);
      const nachher = await page.evaluate(() => ({ suche: (document.querySelector('[data-testid="tm-suche"]') as HTMLInputElement).value, n: document.querySelectorAll('[data-testid="tm-zeile"]').length }));
      console.log("Filter vor/nach Reiterwechsel:", JSON.stringify(vorher), JSON.stringify(nachher), "| fit:", (await page.getByTestId("tm-fit-negativ").innerText()).replace(/\n/g, " "));
      await shot("07-markt-filter-nach-reiterwechsel.png");
      // Reload (sessionStorage bleibt)
      await page.reload({ waitUntil: "domcontentloaded" });
      await briefingSchliessen(page);
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 180_000 });
      await page.waitForTimeout(2000);
      console.log("nach Reload Suche:", await page.getByTestId("tm-suche").inputValue());
    }
    if (teil === "alles" || teil === "profil") {
      await page.goto(`${BASE_URL}/foundation?view=marketV2&saveId=${encodeURIComponent(MARKT_SAVE)}&team=${encodeURIComponent(MARKT_TEAM)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await briefingSchliessen(page);
      await page.getByTestId("tm-zeile").first().waitFor({ state: "visible", timeout: 180_000 });
      await page.waitForTimeout(2000);
      await page.getByRole("button", { name: /^Filter zurücksetzen$/ }).click();
      await page.waitForTimeout(5000);
      await page.getByTestId("tm-zeile").nth(1).click();
      await page.getByTestId("tm-zeile").nth(1).click();
      await page.waitForTimeout(2500);
      console.log("profil sichtbar:", await page.getByTestId("tm-profil").count());
      await shot("08-markt-nach-zweitem-klick.png");
      await page.getByTestId("tm-profil").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(4000);
      await shot("08-markt-grosses-profil.png");
      await page.keyboard.press("Escape");
    }
    if (teil === "alles" || teil === "draft") {
      const draft = await baueDraft();
      console.log("draft-save", draft.saveId, draft.chris);
      await page.goto(`${BASE_URL}/foundation?saveId=${encodeURIComponent(draft.saveId)}&team=${encodeURIComponent(draft.chris)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.getByTestId("liga-draft-seite").waitFor({ state: "visible", timeout: 180_000 });
      await page.getByTestId("draft-zeile").first().waitFor({ state: "visible", timeout: 180_000 });
      await page.waitForTimeout(2000);
      await shot("10-draft-standard-fit-aus.png");
      console.log("draft zeilen (Regel an):", await page.getByTestId("draft-zeile").count(), "| fit:", (await page.getByTestId("draft-fit-negativ").innerText()).replace(/\n/g, " "));
      await page.getByTestId("draft-fit-negativ").click();
      await page.getByTestId("draft-suche").fill("a");
      await page.waitForTimeout(600);
      await shot("11-draft-fit-negativ-eingeblendet.png");
      console.log("draft zeilen (negativ an):", await page.getByTestId("draft-zeile").count());
      await page.getByTestId("draft-reiter-tafel").click();
      await page.waitForTimeout(700);
      await page.getByTestId("draft-reiter-live").click();
      await page.waitForTimeout(900);
      console.log("draft nach Reiterwechsel:", await page.getByTestId("draft-suche").inputValue(), "| fit:", (await page.getByTestId("draft-fit-negativ").innerText()).replace(/\n/g, " "));
      await shot("12-draft-filter-nach-reiterwechsel.png");
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
