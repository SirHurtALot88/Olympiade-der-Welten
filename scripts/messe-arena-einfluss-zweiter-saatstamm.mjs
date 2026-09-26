// Zweiter, unabhaengiger Saatstamm fuer die Pp-Abnahme (CLAUDE.md: Pp <= 25 in ZWEI
// unabhaengigen Saatstroemen). `messe-arena-einfluss.mjs` ruft einflussVon(d,n) immer mit
// dem eingebauten Default (saatVersatz=0, also Formkarten-Saat 20260823 + i*104729 und
// M.bau(1337+i*7919)) auf und bietet keinen CLI-Schalter fuer den bereits vorhandenen
// vierten Parameter `saatVersatz` (s. engine.js, "Pp-Fix Time-Trial, 23.09."). Dieses
// Skript ist derselbe Aufruf, nur mit einem grossen, disjunkten Versatz, damit die
// Formkarten- UND die Bau-Saatreihe komplett von der ersten Messung unabhaengig sind.
//
//   node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs climbing 24
//   node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs climbing 24 10000000
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const disziplin = process.argv[2] || "climbing";
const laeufe = Number(process.argv[3] || 24);
const versatz = Number(process.argv[4] || 10_000_000);
const pfad = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const datei = pathToFileURL(pfad).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({ executablePath: fest });
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

const motoren = await seite.evaluate(() => window.__arena.motoren());
if (!motoren.includes(disziplin)) {
  console.error(`Fuer "${disziplin}" ist kein Motor angemeldet. Vorhanden: ${motoren.join(", ")}`);
  await browser.close();
  process.exit(1);
}

const start = Date.now();
const e = await seite.evaluate(
  ([d, n, v]) => window.__arena.einflussVon(d, n, undefined, v),
  [disziplin, laeufe, versatz],
);
const dauer = ((Date.now() - start) / 1000).toFixed(0);

console.log(`Zweiter Saatstamm — Versatz ${versatz}, gemessene Datei: ${pfad}`);
console.log(`${e.disziplin} — ${e.laeufe} Laeufe, Anhebung +${e.anhebung}, ${dauer}s`);
console.log(`Abweichung zur Matrix: ${e.abweichungPp} Pp\n`);
console.log("Attribut          Anteil   Matrix   Differenz");
const matrix = await seite.evaluate((d) => window.__arena.matrix(d), disziplin);
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
