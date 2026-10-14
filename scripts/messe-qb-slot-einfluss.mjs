// ===================================================================================
// SLOT-BEWUSSTE PP-SONDE FUER DEN QB-SLOT (football-kickoff-slot-plan-14-10.md Schritt 3,
// "Was Schritt 3 braucht" in docs/design/football-kicker-slot-14-10.md).
//
// messe-arena-einfluss.mjs/einflussVon() ruft M.bau() OHNE jede Lineup-Platzierung auf —
// `place` bleibt leer, jeder Spieler laeuft ueber den Rundlauf-Ruecfall mit
// slotGesetzt:false. bestimmeQB() (battle-mode.engine.js) liefert dort fuer JEDEN Spieler
// null, unabhaengig von QB_SLOT_BONUS — derselbe blinde Befund, den der Kicker/Punter-Slot
// (Schritt 2) schon hatte und haben durfte (sein Bonus ist additiv/klein, "kein No-Slot-
// Fall darf brechen" war die einzige Auflage). Fuer den QB-Slot reicht das nicht: Chris'
// Auftrag verlangt ausdruecklich eine SPUERBARE Wirkung ("genauso wie die blocker oder
// runner"), und ein bit-identisches Ergebnis waere hier kein Beweis fuer Sicherheit,
// sondern ein blinder Fleck, der die Kalibrierung verdeckt.
//
// Dieses Skript ruft stattdessen window.__arena.einflussVonMitSlot(dId, slotId, n,
// saatVersatz) — den slot-bewussten Zwilling von einflussVon() in battle-mode.engine.js
// (direkt neben einflussVonSandsackFinale, demselben Vorbild folgend): JEDER getestete
// Spieler wird fuer die Dauer seines eigenen Durchlaufs per u.slotId/u.slotGesetzt
// explizit in den QB-Slot gezwungen (NACH M.bau(), VOR M.lauf()), waehrend der Grundlauf
// (kein Attribut gehoben) niemanden slottet. Das misst das realistische
// Kalibrierungsszenario: "ein Manager hat seinen besten Passer-Kandidaten als QB
// aufgestellt — wie stark zahlt sich eine bessere Passer-Eignung jetzt aus?"
//
//   node scripts/messe-qb-slot-einfluss.mjs                      → football/quarterback, 48 Laeufe
//   node scripts/messe-qb-slot-einfluss.mjs 48 --saat-versatz=N  → zweiter, unabhaengiger Saatstrom
//
// Dieselbe Ehrlichkeitsregel wie messe-arena-einfluss.mjs: der gemessene Pfad gehoert in
// die Ausgabe.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const schalter = process.argv.slice(2).filter((a) => a.startsWith("--"));
const positionen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const schalterWert = (name) => schalter.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const SAAT_VERSATZ = Number(schalterWert("saat-versatz") ?? 0);

const DISZIPLIN = positionen[0] || "football";
const SLOT_ID = positionen[1] || "quarterback";
const laeufe = Number(positionen[2] || 48);

const pfad = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const datei = pathToFileURL(pfad).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
// KEIN AUDIOCONTEXT IM MESSLAUF — s. messe-arena-einfluss.mjs Kopfkommentar, derselbe Grund
// (Speicherleck ohne Nutzergeste in headless Chromium, bit-identische Messwerte).
await seite.addInitScript(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
});
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.einflussVonMitSlot, null, { timeout: 30000 });

const motoren = await seite.evaluate(() => window.__arena.motoren());
if (!motoren.includes(DISZIPLIN)) {
  console.error(`Fuer "${DISZIPLIN}" ist kein Motor angemeldet. Vorhanden: ${motoren.join(", ")}`);
  await browser.close();
  process.exit(1);
}

const start = Date.now();
const e = await seite.evaluate(
  ([d, slot, n, versatz]) => {
    const st = window.setTimeout;
    window.setTimeout = () => 0;
    try {
      return window.__arena.einflussVonMitSlot(d, slot, n, versatz);
    } finally {
      window.setTimeout = st;
    }
  },
  [DISZIPLIN, SLOT_ID, laeufe, SAAT_VERSATZ],
);
const dauer = ((Date.now() - start) / 1000).toFixed(0);

console.log(`Gemessene Datei: ${pfad}`);
console.log(`${e.disziplin} — Slot "${e.slotId}" erzwungen, ${e.laeufe} Laeufe, Anhebung +${e.anhebung}, ${dauer}s`
  + (SAAT_VERSATZ ? `, Saatversatz ${SAAT_VERSATZ}` : ""));
console.log(`Abweichung zur Matrix: ${e.abweichungPp} Pp\n`);
console.log("Attribut          Anteil   Matrix   Differenz");
const matrix = await seite.evaluate((d) => window.__arena.matrix(d), DISZIPLIN);
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
