// SICHTPRUEFUNG statt Zahlen. Startet eine Disziplin in der echten Arena-Oberflaeche,
// laesst sie laufen und legt zu mehreren Zeitpunkten ein Bild der Spielflaeche ab.
//
//   node scripts/zeige-feldspiel-arena.mjs [disziplin] [zielordner] [sekunden...]
//   node scripts/zeige-feldspiel-arena.mjs hockey /tmp 6 14 22 34 48
//
// Warum es das gibt: Zahlen sagen nicht, ob sich eine Mannschaft wie Eishockey bewegt.
// Formation, Torwartposition, Puckhoehe und die Frage, ob das halbe Feld leer steht,
// sieht man nur im Bild — und zwar in der laufenden Oberflaeche, nicht im Standbild des
// Bodens (dafuer gibt es renderFeldBoden).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const DISZIPLIN = process.argv[2] || "hockey";
const ZIEL = process.argv[3] || "/tmp";
const MARKEN = process.argv.slice(4).map(Number).filter((v) => v > 0);
const SEKUNDEN = MARKEN.length ? MARKEN : [6, 14, 22, 34, 48];
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1320, height: 900 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.evaluate((d) => window.__arena.setDisc(d), DISZIPLIN);
// Klick per DOM: der Startknopf ist erst sichtbar, wenn die Oberflaeche ihn einblendet —
// ein Playwright-Klick wartet darauf und laeuft sonst in den Zeitablauf.
await seite.evaluate(() => document.getElementById("play").click());

let letzte = 0;
for (const sek of SEKUNDEN) {
  await seite.waitForTimeout((sek - letzte) * 1000);
  letzte = sek;
  const stand = await seite.evaluate(() => {
    const A = window.__arena;
    return { zeit: A.zeit && A.zeit(), vorbei: A.vorbei && A.vorbei(), phase: (A.fsPhase && A.fsPhase() || {}).phase };
  });
  const daten = await seite.evaluate(() => {
    let groesste = null;
    for (const c of document.querySelectorAll("canvas"))
      if (!groesste || c.width * c.height > groesste.width * groesste.height) groesste = c;
    return groesste ? groesste.toDataURL() : null;
  });
  const datei = path.join(ZIEL, `${DISZIPLIN}-${sek}s.png`);
  if (daten) writeFileSync(datei, Buffer.from(daten.split(",")[1], "base64"));
  console.log(`${String(sek).padStart(3)} s  ${datei}  ${JSON.stringify(stand)}`);
}
console.log(`Seitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
await browser.close();
