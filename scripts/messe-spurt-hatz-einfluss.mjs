// ===================================================================================
// PP-ABWEICHUNG FUER "DIE HATZ" (08.11., docs/design/spurt-format-die-hatz-08-11.md).
//
// Dieselbe Rechnung wie scripts/messe-arena-einfluss.mjs (einflussVon(), Abweichung in
// Prozentpunkten gegen die gesperrte Matrix, CLAUDE.md) -- hier auf "spurt" verdrahtet
// und VOR dem Messlauf window.__arena.bahnFlags({spurtFormat:"hatz"}) gesetzt. Laeuft mit
// zwei unabhaengigen Saatstroemen (--saat-versatz, s. messe-arena-einfluss.mjs), weil die
// Pflichtpruefung (CLAUDE.md, "Eignungsmatrix ist gesperrt") genau das verlangt.
//
//   node scripts/messe-spurt-hatz-einfluss.mjs [laeufe] [saat-versatz]
//   node scripts/messe-spurt-hatz-einfluss.mjs 192 0
//   node scripts/messe-spurt-hatz-einfluss.mjs 192 10000000
//
// WARUM 192 UND NICHT 48 (wie messe-arena-einfluss.mjs es fuer Spurt klassisch nahelegt):
// nachgemessen, nicht geraten -- bei 48 Laeufen schwankte die Abweichung je Durchlauf
// zwischen 24 und 32 Pp (dieselbe Laeufe-zu-klein-Falle wie im Kopfkommentar von
// messe-arena-einfluss.mjs beschrieben, hier staerker, weil jedes Rennen nur fuenf
// gewuerfelte Wellen hat statt hundert Ticks). Ab 96 blieb das Ergebnis Zeichen fuer
// Zeichen stabil (23,6/24,0 Pp bei n=96 vs. n=288 im Kalibrierlauf); 192 ist der Kompromiss
// zwischen Stabilitaet und Laufzeit.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const laeufe = Number(process.argv[2] || 192);
const saatVersatz = Number(process.argv[3] || 0);
const pfad = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
// KEIN AUDIOCONTEXT IM MESSLAUF -- dasselbe Leck/derselbe Fix wie messe-arena-einfluss.mjs
// (Breaking-Fund 01.10.); fuer Spurt harmlos, aber der sichere Standard fuer jeden
// einflussVon()-Lauf dieser Grossenordnung.
await seite.addInitScript(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
});
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(pathToFileURL(pfad).href, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.einflussVon && window.__arena.bahnFlags, null, { timeout: 30000 });

await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "hatz" }));

const start = Date.now();
const e = await seite.evaluate(
  ([n, versatz]) => {
    const st = window.setTimeout;
    window.setTimeout = () => 0;
    try {
      return window.__arena.einflussVon("spurt", n, undefined, versatz);
    } finally {
      window.setTimeout = st;
    }
  },
  [laeufe, saatVersatz],
);
const dauer = ((Date.now() - start) / 1000).toFixed(0);
await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "klassisch" }));

console.log(`Spurt "Die Hatz" — ${e.laeufe} Laeufe, Anhebung +${e.anhebung}, Saatversatz ${saatVersatz}, ${dauer}s`);
console.log(`Abweichung zur Matrix: ${e.abweichungPp} Pp (Ziel <= 25, CLAUDE.md)\n`);
console.log("Attribut          Anteil   Matrix   Differenz");
const matrix = await seite.evaluate((d) => window.__arena.matrix(d), "spurt");
for (const r of e.reihen) {
  const soll = matrix[r.attribut] || 0;
  const diff = r.anteil - soll;
  console.log(
    `${r.attribut.padEnd(15)} ${String(r.anteil).padStart(6)} % ${String(soll).padStart(6)}   ` +
      `${(diff > 0 ? "+" : "") + diff.toFixed(1)}`,
  );
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
await browser.close();
