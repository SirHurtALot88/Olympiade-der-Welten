#!/usr/bin/env node
/**
 * Standbilder (`poster`) fuer Pixel-Szenen: oeffnet die selbstlaufende Szene im Browser
 * (Viewport 1440 px wie das iframe in DisciplinePixelScene), laesst sie kurz laufen und
 * fotografiert das groesste Canvas-/Bild-Element — dieselbe Ausschnittsregel, mit der die
 * Szene im Spiel eingepasst wird.
 *
 *   node scripts/baue-szenen-poster.mjs <diszi>/<variante> [...] [--sek 2.5] [--auch <ordner>]
 *
 * Schreibt public/szenen/<diszi>/<variante>.jpg. Mit `--auch <ordner>` zusaetzlich je ein PNG
 * dorthin (Belegbilder).
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
let sek = 2.5;
let auch = null;
const ziele = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--sek") sek = Number(args[++i]);
  else if (args[i] === "--auch") auch = args[++i];
  else ziele.push(args[i]);
}
if (!ziele.length) {
  console.error("Aufruf: node scripts/baue-szenen-poster.mjs <diszi>/<variante> [...]");
  process.exit(1);
}
if (auch) mkdirSync(auch, { recursive: true });

// Fester Chromium der Agenten-Umgebung, sonst der von Playwright (wie baue-rangtreue-basislinie.mjs)
const fest = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
for (const ziel of ziele) {
  const html = path.join(ROOT, "public", "szenen", `${ziel}.html`);
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(sek * 1000);
  const handle = await page.evaluateHandle(() => {
    const media = [...document.querySelectorAll("canvas, img, svg, video")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((o) => o.r.width >= 240 && o.r.height >= 120)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    return media[0].el;
  });
  const out = path.join(ROOT, "public", "szenen", `${ziel}.jpg`);
  await handle.asElement().screenshot({ path: out, type: "jpeg", quality: 88 });
  console.log("Standbild:", path.relative(ROOT, out));
  if (auch) {
    const png = path.join(auch, `${ziel.replace("/", "-")}.png`);
    await handle.asElement().screenshot({ path: png });
    console.log("Beleg:", png);
  }
}
await browser.close();
