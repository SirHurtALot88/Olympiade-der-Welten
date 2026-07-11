import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "tmp-ux-audit");
const SAVE = "fresh-season-1-1783267090717-real-20260705";
const BASE = `http://localhost:3000/foundation?saveId=${SAVE}`;

const AUDIT_VIEWS: Array<{ slug: string; view: string; selector: string; mobile?: boolean }> = [
  { slug: "01-home", view: "home", selector: '[data-testid="foundation-home-v2"], #foundation-home-v2' },
  { slug: "02-season", view: "season", selector: '[data-testid="season-v2-shell"], #foundation-season-v2' },
  { slug: "03-lineup", view: "lineup-v2", selector: '[data-testid="legacy-lineup-v2-board"], [data-testid="foundation-lineup-v2"]' },
  { slug: "04-arena", view: "matchday-arena-v2", selector: ".arena-v2-shell, [data-testid='arena-reveal-timeline']" },
  { slug: "05-teams", view: "teams", selector: "#foundation-teams-v2, [data-testid='foundation-teams-v2']" },
  { slug: "06-training", view: "training", selector: '[data-testid="foundation-training-compact"]' },
  { slug: "07-facilities", view: "facilitiesOverviewV2", selector: '[data-testid="foundation-facilities-v2"]' },
  { slug: "08-players", view: "players", selector: "#foundation-players-table, [data-testid='foundation-players-table']" },
  { slug: "09-market", view: "market", selector: ".market-v2-shell, [data-testid='foundation-transfermarkt-v2']" },
  { slug: "10-history", view: "history", selector: ".transfer-history-v2-shell, [data-testid='transfer-history-v2']" },
  { slug: "11-ranks", view: "ranks", selector: "#foundation-ranks, [data-testid='foundation-ranks']" },
  { slug: "12-prize", view: "prize", selector: "#prize-money, [data-testid='foundation-prize-money']" },
];

async function snap(page: import("@playwright/test").Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  const text = await page.locator("body").innerText();
  fs.writeFileSync(path.join(OUT, `${name}.txt`), text.slice(0, 12000));
}

async function auditTab(
  page: import("@playwright/test").Page,
  entry: (typeof AUDIT_VIEWS)[number],
  suffix: string,
) {
  await page.goto(`${BASE}&view=${entry.view}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(entry.selector, { timeout: 90000 }).catch(() => null);
  await page.waitForTimeout(2500);
  await snap(page, `${entry.slug}-${suffix}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });

  for (const entry of AUDIT_VIEWS) {
    await auditTab(desktop, entry, "desktop");
    if (entry.mobile !== false) {
      await auditTab(mobile, entry, "mobile");
    }
  }

  await desktop.goto(`${BASE}&view=lineup-v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await desktop.waitForSelector('[data-testid="legacy-lineup-v2-board"]', { timeout: 90000 }).catch(() => null);
  const slot = desktop.locator('[id^="lineup-slot-"]').first();
  if (await slot.isVisible().catch(() => false)) {
    await slot.click();
    await desktop.waitForTimeout(500);
    await snap(desktop, "13-lineup-slot-selected-desktop");
  }

  await desktop.goto(`${BASE}&view=matchday-arena-v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await desktop.waitForSelector(".arena-v2-shell", { timeout: 90000 }).catch(() => null);
  const playBtn = desktop.getByRole("button", { name: "Play" });
  if (await playBtn.isVisible().catch(() => false)) {
    await playBtn.click();
    await desktop.waitForTimeout(2000);
    await snap(desktop, "14-arena-playing-desktop");
  }

  await browser.close();
  console.log("done", OUT, `tabs=${AUDIT_VIEWS.length * 2}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
