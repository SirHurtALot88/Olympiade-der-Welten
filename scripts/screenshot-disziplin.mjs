// Generalisierung von scripts/screenshot-gewichtheben.mjs (PR 0, Opus-Plan Abschnitt 3.4):
// derselbe Rauchtest, aber fuer eine per Kommandozeile gewaehlte Disziplin statt fest auf
// Gewichtheben verdrahtet. Kein Teil der Abnahme-Sonden — nur zum Ansehen/Belegen (Vorher/
// Nachher-Screenshots je Ziel-PR).
//
// Aufruf: node scripts/screenshot-disziplin.mjs <disziplin> [wartenMs] [ausgabe]
//   <disziplin>  window.__arena.setDisc()-Name, z.B. "gewichtheben", "eiskunstlauf",
//                "breaking", "takeshis-castle" (genau wie in BUEHNE_ART/BAHN_ART/#dd).
//   [wartenMs]   wie lange nach #play gewartet wird, bevor der Screenshot faellt (Default 3000).
//   [ausgabe]    Zieldatei fuer das PNG (Default tmp-ux-audit/<disziplin>-buehne.png).
//
// Die drei bestehenden screenshot-*.mjs-Dateien (gewichtheben, speed-schach,
// speed-schach-sieger, schild-krolach, broadcast-hud) bleiben unangetastet — sie sind in
// PR-Beschreibungen referenziert.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const disziplin = process.argv[2];
if (!disziplin) {
  console.error("Nutzung: node scripts/screenshot-disziplin.mjs <disziplin> [wartenMs] [ausgabe]");
  process.exit(1);
}
const wartenMs = Number(process.argv[3] || 3000);
const out = process.argv[4] || path.join(WURZEL, "tmp-ux-audit", disziplin + "-buehne.png");
mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, disziplin);
if (gesetzt !== true) {
  console.error("setDisc(" + JSON.stringify(disziplin) + ") schlug fehl: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#t2");
await seite.click("#play");
await seite.waitForTimeout(wartenMs);
const cv = await seite.$("#cv");
await cv.screenshot({ path: out });
console.log("Screenshot: " + out);
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
