// Mockup-Aufnahmen fuer den Abgleich (23.11.): marketing-werbeklausel-aushaengeschild-23-11.html bei 1920x1080 und 2560x1440.
// AUFRUF: flock /tmp/oly-aufnahme.lock npx tsx scripts/screenshot-werbeklausel-mockup.ts
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const OUT = path.join(process.cwd(), "docs", "design", "werbeklausel-aushaengeschild-23-11");
const HTML = pathToFileURL(path.join(process.cwd(), "public", "mockups", "marketing-werbeklausel-aushaengeschild-23-11.html")).toString();

async function main() {
  const browser = await chromium.launch({ args: ["--disable-gpu"] });
  for (const [b, h, n] of [[1920, 1080, "1920x1080"], [2560, 1440, "2560x1440"]] as Array<[number, number, string]>) {
    const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const [view, datei] of [["verh", "mockup-verhandlung"], ["verl", "mockup-verlaengerung"], ["aush", "mockup-aushaengeschild-offen"]] as const) {
      await page.goto(`${HTML}?view=${view}`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `${datei}-${n}.png`) });
    }
    await page.locator("[data-sel]").nth(2).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `mockup-aushaengeschild-vorschau-${n}.png`) });
    await page.locator("[data-bestaetigen]").first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `mockup-aushaengeschild-gesperrt-${n}.png`) });
    await ctx.close();
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
