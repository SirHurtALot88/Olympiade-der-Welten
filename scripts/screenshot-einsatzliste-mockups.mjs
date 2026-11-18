// Mockup-Soll der Einsatzliste als Bilder (fuer die Abgleich-Bilder Mockup | App, 18.11.).
// AUFRUF: node scripts/screenshot-einsatzliste-mockups.mjs <ausgabeordner>
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const out = path.resolve(process.argv[2] ?? "docs/design/einsatzliste-optik-18-11");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of [[2560, 1440], [1920, 1080], [1710, 1112]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.resolve("public/mockups/form-moral-modern-17-11.html")).href);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `mockup-formmoral-${w}.png`) });
  const page2 = await ctx.newPage();
  await page2.goto(pathToFileURL(path.resolve("public/mockups/einsatzliste-modern-17-11.html")).href);
  await page2.waitForTimeout(800);
  await page2.screenshot({ path: path.join(out, `mockup-einsatzliste-${w}.png`) });
  const tab = page2.locator('[data-tab="gegner"]').first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page2.waitForTimeout(400);
    await page2.screenshot({ path: path.join(out, `mockup-einsatzliste-gegner-${w}.png`) });
  }
  await ctx.close();
}
await browser.close();
