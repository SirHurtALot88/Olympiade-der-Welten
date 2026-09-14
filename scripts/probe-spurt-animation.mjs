// ===================================================================================
// SPURT-ANIMATIONS-PROBE (Produktionsanbindung 14.09., Teil B) — misst empirisch, ob die
// Laeufer-Sprites bei Spurt jetzt eine eigene Bewegungspose haben, statt es zu behaupten.
// Analog zu scripts/probe-zeitfahren-anzeige.mjs Abschnitt (A), aber fuer Spurt: dieselbe
// `window.__arena.zeitfahrenVizProbe()` liest generisch `LAEUFER` (kein zeitfahren-
// spezifischer Code darin) und funktioniert deshalb unveraendert, wenn die aktive Disziplin
// per `setDisc("spurt")` auf Spurt steht.
//
// GEPRUEFT WIRD:
//   (A) die globale Sprite-Uhr `t` — bleibt auf der Bahn immer 0/eingefroren (stepSim()
//       springt fuer jede Bahn-Disziplin vor der `t+=dt`-Zeile hinaus, s. Kommentar an
//       stepHuerden in battle-mode.engine.js). Das ist ERWARTET und kein Fehler mehr, seit
//       der Bildindex fuer Spurt aus `u.vizSchritt` kommt statt aus `t`.
//   (B) `u.vizSchritt` je Laeufer — muss VOR dieser PR konstant bleiben (kein Schreiber) und
//       NACH dieser PR mit der Zeit wachsen (stepHuerden schreibt es, skaliert mit u.v).
//   (C) zwei Screenshots derselben Bahn zu unterschiedlichen Zeitpunkten — Sichtbeleg, dass
//       sich die Beinstellung der Figuren (nicht nur ihre Position) veraendert hat.
//
// Aufruf:  node scripts/probe-spurt-animation.mjs [sekunden]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MAX_S = Number(process.argv[2] || 20);

const browser = await chromium.launch({ ...(existsSync(fest) ? { executablePath: fest } : {}) });
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));

await seite.goto(SEITE, { waitUntil: "domcontentloaded", timeout: 180000 });
await seite.waitForFunction(() => window.__arena && window.__arena.zeitfahrenVizProbe, null, { timeout: 90000 });
await seite.click("#t2");
await seite.evaluate(() => window.__arena.setDisc("spurt"));
await seite.click("#play");

const proben = [];
const start = Date.now();
let shotFrueh = null;
for (let i = 0; i < MAX_S; i++) {
  await seite.waitForTimeout(1000);
  const p = await seite.evaluate(() => ({
    d: window.__arena.zeitfahrenVizProbe(),
    phase: document.getElementById("phase")?.textContent,
  }));
  p.real = (Date.now() - start) / 1000;
  proben.push(p);
  if (i === 1) shotFrueh = await seite.locator("#cv").screenshot();
  if (p.phase === "beendet") break;
}
const shotSpaet = await seite.locator("#cv").screenshot();
writeFileSync(path.join(WURZEL, "tmp-spurt-anim-frueh.png"), shotFrueh);
writeFileSync(path.join(WURZEL, "tmp-spurt-anim-spaet.png"), shotSpaet);

const letzte = proben[proben.length - 1];
console.log("SPURT-ANIMATIONS-PROBE — " + proben.length + " Messpunkte");

// ---- (A) GLOBALE UHR -------------------------------------------------------------
const aniTs = [...new Set(proben.map((p) => p.d.aniT))];
console.log("\n(A) GLOBALE SPRITE-UHR t");
console.log("    " + (aniTs.length === 1
  ? "steht bei " + aniTs[0] + " (erwartet auf der Bahn, s. stepSim) — Zeichenpfad haengt NICHT hieran"
  : "laeuft (" + aniTs.length + " verschiedene Werte) — unerwartet auf der Bahn"));

// ---- (B) EIGENE SCHRITTPHASE ------------------------------------------------------
const schritte = proben.map((p) => p.d.reihe.map((u) => u.vizSchritt ?? null));
const alleGesetzt = schritte[0].every((v) => v != null);
const schrittWaechst = schritte.length > 2 && schritte[schritte.length - 1].some(
  (v, i) => v != null && schritte[1][i] != null && v > schritte[1][i] + 0.3);
console.log("\n(B) EIGENE SCHRITTPHASE (u.vizSchritt, von stepHuerden geschrieben)");
console.log("    je Laeufer gesetzt:      " + (alleGesetzt ? "ja" : "NEIN — stepHuerden laeuft nicht"));
console.log("    waechst mit der Zeit:    " + (schrittWaechst
  ? "ja — die Animation laeuft"
  : "NEIN — eingefroren (das waere der Fehler vor dieser PR)"));
console.log("    Werte am Ende (je Laeufer): " + JSON.stringify(schritte[schritte.length - 1]));

console.log("\nScreenshots: tmp-spurt-anim-frueh.png (t=~1s) / tmp-spurt-anim-spaet.png (t=~" + letzte.real.toFixed(0) + "s)");
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();

if (!schrittWaechst || fehler.length) process.exit(1);
