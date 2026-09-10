// N1-Beweis-Sonde (Opus-Review PR #879, Abschnitt 6): belegt, dass der Gewichtheben-
// Publikums-Loop nach dem zweiten reset() (= zweiter Kampf derselben Seitensitzung) wieder
// startet, statt fuer den Rest der Sitzung stumm zu bleiben. Instrumentiert
// AudioContext.prototype.createBufferSource VOR dem Laden der Engine (init script), zaehlt
// start()/stop() nur fuer Quellen mit loop===true (das ist exakt das Muster, das
// tonRauschen(...,true) fuer den Publikums-Loop benutzt, s. battle-mode.engine.js
// tonRauschen()) -- dieselbe Methode wie die Playwright-Sonde des Opus-Reviewers.
//
// Aufruf: node scripts/probe-n1-gewichtheben.mjs (kein Argument)
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({
  ...(existsSync(fest) ? { executablePath: fest } : {}),
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));

// Instrumentierung VOR jedem Seitenskript: patcht createBufferSource, damit jeder
// spaetere `new AudioContext()` (inkl. der Engine-eigenen tonKontext()) die gepatchte
// Version erbt.
await seite.addInitScript(() => {
  window.__loopStarts = 0;
  window.__loopStops = 0;
  const orig = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function (...args) {
    const src = orig.apply(this, args);
    const origStart = src.start.bind(src);
    const origStop = src.stop.bind(src);
    src.start = (...a) => {
      if (src.loop) window.__loopStarts++;
      return origStart(...a);
    };
    src.stop = (...a) => {
      if (src.loop) window.__loopStops++;
      return origStop(...a);
    };
    return src;
  };
});

await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.click("#t2");

// Erster "Kampf": Disziplin setzen (ruft intern reset() auf) + tatsaechlich starten, damit
// der Zeichenpfad (draw()->zeichneBuehne()->bodenHeben()) mehrfach durchlaeuft wie im echten
// Spiel, nicht nur beim initialen draw() innerhalb von reset().
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "gewichtheben");
if (gesetzt !== true) {
  console.error("setDisc fehlgeschlagen: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#play");
await seite.waitForTimeout(1500);
const nach1 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

// #reset simuliert exakt den Weg, den ein zweiter Kampf in derselben Sitzung nimmt (Klick auf
// "Zuruecksetzen", identisch zum Button, den reset() im echten Spiel bedient) -- OHNE die
// Disziplin zu wechseln, also derselbe Codepfad wie "noch ein Gewichtheben-Kampf".
await seite.click("#reset");
await seite.click("#play");
await seite.waitForTimeout(1500);
const nach2 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

// Dritter Kampf zur Absicherung -- die Reviewer-Erwartung war explizit "1, 2, 3", nicht nur "1, 2".
await seite.click("#reset");
await seite.click("#play");
await seite.waitForTimeout(1500);
const nach3 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

console.log("Nach Kampf 1 (setDisc):        gestartete Loop-Quellen = " + nach1.starts + ", gestoppte = " + nach1.stops);
console.log("Nach Kampf 2 (#reset+#play):   gestartete Loop-Quellen = " + nach2.starts + ", gestoppte = " + nach2.stops);
console.log("Nach Kampf 3 (#reset+#play):   gestartete Loop-Quellen = " + nach3.starts + ", gestoppte = " + nach3.stops);
console.log("Erwartung bei korrekter Buchfuehrung (N1 behoben): 1, 2, 3.");
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));

const ok = nach1.starts === 1 && nach2.starts === 2 && nach3.starts === 3 && fehler.length === 0;
console.log(ok ? "N1-BEWEIS: BESTANDEN (Loop kehrt bei jedem Kampf zurueck)" : "N1-BEWEIS: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
