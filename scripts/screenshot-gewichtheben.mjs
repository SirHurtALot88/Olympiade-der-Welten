// Kurzer visueller Rauchtest fuer das neue Gewichtheben-Buehnenbild (S2). Kein Teil der
// Abnahme-Sonden — nur zum Ansehen.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const wartenMs = Number(process.argv[2] || 3000);
const out = process.argv[3] || path.join(WURZEL, "tmp-ux-audit/gewichtheben-buehne.png");

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
await seite.click("#t2");
await seite.click("#play");
await seite.waitForTimeout(wartenMs);
const cv = await seite.$("#cv");
await cv.screenshot({ path: out });
console.log("Screenshot: " + out);
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
