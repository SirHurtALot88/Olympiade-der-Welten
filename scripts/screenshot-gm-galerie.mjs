// Aufnahme der GM-Galerie (public/mockups/gm-galerie-22-11.html) als Datei, ohne Dev-Server.
//   flock /tmp/oly-aufnahme.lock node scripts/screenshot-gm-galerie.mjs
// Ergebnis: docs/design/gm-portraets-22-11/galerie-<breite>.png
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const wurzel = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seite = pathToFileURL(path.join(wurzel, "public/mockups/gm-galerie-22-11.html")).href;
const ziel = path.join(wurzel, "docs/design/gm-portraets-22-11");
const browser = await chromium.launch();
for (const [w, h] of [[1920, 1080], [2560, 1440], [1710, 1112]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(seite);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const kaputt = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth);
  console.log(w, h, "fehlende Bilder:", kaputt.length, "Seitenscroll:", scroll);
  await page.screenshot({ path: path.join(ziel, `galerie-${w}.png`) });
  await page.close();
}
await browser.close();
