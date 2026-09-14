// ===================================================================================
// BAHN-ANIMATIONS-PROBE (14.09., Bahn-Animation Staffel/Climbing/Takeshi) — misst
// direkt, ob die Sprite-Laufanimation einer beliebigen Bahn-Disziplin steht oder laeuft,
// statt es an Screenshots zu erraten. Analog zu scripts/probe-zeitfahren-anzeige.mjs (Teil
// A dort), aber disziplin-generisch ueber window.__arena.bahnVizProbe() statt fest auf
// Time-Trial verdrahtet.
//
// GEPRUEFT WIRD GENAU DAS, WAS zeichneSprite() tatsaechlich fuer den Bildindex liest:
//   zyklus = (u.vizAniPhase!=null) ? u.vizAniPhase*n : (t*7+u.id)
// `t` ist die globale Sprite-Uhr — auf der Bahn wird sie NIE hochgezaehlt (s. Kommentar
// bei stepZeitfahren/bahnBewegung). Ohne eine eigene, aus dem Tempo gespeiste Phase
// (`u.vizSchritt`, an zeichneSpurt() als `vizAniPhase` durchgereicht) bleibt der
// Bildindex je Laeufer eine Konstante — ein STEHENDES Einzelbild, das ueber die Bahn
// gleitet.
//
// Aufruf: node scripts/probe-bahn-animation.mjs <disziplin> [sekunden]
//   <disziplin>  window.__arena.setDisc()-Name: staffel, climbing, takeshis-castle,
//                time-trial, spurt.
//   [sekunden]   wie viele Ein-Sekunden-Messpunkte genommen werden (Default 8).
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const disziplin = process.argv[2];
if (!disziplin) {
  console.error("Nutzung: node scripts/probe-bahn-animation.mjs <disziplin> [sekunden]");
  process.exit(1);
}
const SEK = Number(process.argv[3] || 8);

const browser = await chromium.launch({ ...(existsSync(fest) ? { executablePath: fest } : {}) });
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));

await seite.goto(SEITE, { waitUntil: "domcontentloaded", timeout: 180000 });
await seite.waitForFunction(() => window.__arena && window.__arena.bahnVizProbe, null, { timeout: 90000 });
await seite.click("#t2");
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, disziplin);
if (gesetzt !== true) {
  console.error("setDisc(" + JSON.stringify(disziplin) + ") schlug fehl: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#play");

const proben = [];
for (let i = 0; i < SEK; i++) {
  await seite.waitForTimeout(1000);
  proben.push(await seite.evaluate(() => window.__arena.bahnVizProbe()));
}

const aniTs = [...new Set(proben.map((p) => p.aniT))];
const ids = proben[0]?.reihe.map((u) => u.id) || [];
const laufendeIds = new Set();
for (const p of proben) for (const u of p.reihe) if (!u.fertig && !u.raus) laufendeIds.add(u.id);

console.log("BAHN-ANIMATIONS-PROBE (" + disziplin + ") — " + proben.length + " Messpunkte");
console.log("disc laut Engine: " + proben[0]?.disc);
console.log("globale Uhr t:    " + (aniTs.length === 1
  ? "STEHT STILL bei " + aniTs[0] + "  <- Sprite-Laufzyklus waere ohne vizSchritt eingefroren"
  : "laeuft (" + aniTs.length + " verschiedene Werte)"));

let irgendGewachsen = false;
for (const id of ids) {
  const reihe = proben.map((p) => p.reihe.find((u) => u.id === id)).filter(Boolean);
  const erste = reihe[0], letzte = reihe[reihe.length - 1];
  if (erste == null || letzte == null || erste.vizSchritt == null) continue;
  const wuchs = letzte.vizSchritt - erste.vizSchritt;
  const warLaufend = laufendeIds.has(id);
  if (warLaufend && wuchs > 0.3) irgendGewachsen = true;
  console.log("  Laeufer " + String(id).padStart(2) + " (" + erste.n.padEnd(14) + ")"
    + "  vizSchritt " + erste.vizSchritt.toFixed(2) + " -> " + letzte.vizSchritt.toFixed(2)
    + "  (Δ " + wuchs.toFixed(2) + ")"
    + (warLaufend ? "" : "  [nicht durchgehend aktiv/fertig]"));
}

console.log("\nERGEBNIS: " + (irgendGewachsen
  ? "vizSchritt WAECHST fuer mindestens einen laufenden Teilnehmer -> Animation laeuft."
  : "vizSchritt bleibt fuer alle laufenden Teilnehmer FLACH -> Animation eingefroren."));
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
process.exit(irgendGewachsen ? 0 : 2);
