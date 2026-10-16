// ===================================================================================
// FORMKARTEN-KOPPLUNG — Punkt 30 (chris-feedback-breite-runde-13-10.md Zeile ~315-358,
// docs/design/formkarten-kopplung-messrunde-15-10.md). Reine Diagnose, KEINE
// Mechanik-Aenderung: misst fuer eine Liste von Disziplinen, wie viele Eignungspunkte
// effektiv aus einer +4-Formkarte entstehen, auf zwei Ebenen:
//
//   (A) ATTRIBUT-KANAL (formAttrEigSonde): bewegt sich die MATRIX-GEWICHTETE Eignung
//       (gewichtet(a,BASIS_JE_DISC[d])) durch genau den Kanal, den die Formkarte in
//       Feldspiel/Buehne/Zeitfahren/Climbing/Spurt nimmt (mitAufschlag/betroffeneAttribute,
//       "breit"), um den erwarteten Kartenwert? Rein rechnerisch, ohne Spielsimulation.
//
//   (B) SPIELWERTUNG (formEinflussVon, bereits vorhanden seit der E9-Pruefung 13.10.):
//       wie stark bewegt sich die TATSAECHLICHE M.wert()-Spielwertung (und der Rang) eines
//       isolierten Spielers (+4 Form, alle anderen unveraendert), gepaart ueber dieselben
//       Saaten wie der Grundlauf?
//
// Beide Sonden sind reine, lesende Messfunktionen in battle-mode.engine.js (window.__arena),
// unveraendert gegenueber dem Hauptspiel. Dieses Skript ruft sie nur auf und druckt sie.
//
//   node scripts/messe-formkarten-kopplung.mjs basketball tennis time-trial climbing spurt tdm
//   node scripts/messe-formkarten-kopplung.mjs staffel 144
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const disziplinen = args.filter((a) => Number.isNaN(Number(a)));
const laeufeVorgabe = { staffel: 144 };
const laeufeArg = args.find((a) => !Number.isNaN(Number(a)) && a !== "");
const pfad = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const datei = pathToFileURL(pfad).href;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
await seite.addInitScript(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
});
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

console.log(`Gemessene Datei: ${pfad}`);
for (const d of disziplinen) {
  const n = Number(laeufeArg || laeufeVorgabe[d] || 48);
  const startA = Date.now();
  const a = await seite.evaluate((dd) => window.__arena.formAttrEigSonde(dd, 4), d);
  const durA = ((Date.now() - startA) / 1000).toFixed(1);
  console.log(`\n=== ${d} ===`);
  if (a.fehler) {
    console.log(`  (A) Attribut-Kanal: ${a.fehler}`);
  } else {
    console.log(`  (A) Attribut-Kanal, +4 Form -> Delta auf gewichtet(a,Matrix): mean ${a.meanDelta}, min ${a.minDelta}, max ${a.maxDelta} (${durA}s, ${a.reihen.length} Spieler)`);
  }
  const startB = Date.now();
  // KEIN SETTIMEOUT WAEHREND DES SYNCHRONEN AUFRUFS (derselbe Fix wie messe-arena-
  // einfluss.mjs, s. dessen Kopfkommentar "ZWEITE HAELFTE DESSELBEN LECKS"): formEinflussVon
  // laeuft ueber viele gekoppelte Kaempfe/Rennen in EINEM synchronen evaluate()-Aufruf; ohne
  // diesen Schalter stapeln sich die von der Anzeige-Schicht je Ereignis gesetzten Timer
  // (Toene, Ausblenden) ungebremst und degradieren den Hauptthread zunehmend, je laenger der
  // Aufruf laeuft -- bei TDM/Arena (volle Kampf-Ereignisdichte) deutlich staerker als bei
  // Feldspiel/Bahn. Fuer die Messwerte ist das folgenlos: setTimeout wird fuer GENAU diesen
  // Aufruf zum No-Op und danach wiederhergestellt, nichts davon fliesst in M.wert()/rr() ein.
  const b = await seite.evaluate(
    ([dd, nn]) => {
      const st = window.setTimeout;
      window.setTimeout = () => 0;
      try {
        return window.__arena.formEinflussVon(dd, nn, 4, 0);
      } finally {
        window.setTimeout = st;
      }
    },
    [d, n],
  );
  const durB = ((Date.now() - startB) / 1000).toFixed(0);
  if (b.fehler) {
    console.log(`  (B) Spielwertung: ${b.fehler}`);
  } else {
    console.log(`  (B) Spielwertung (${n} Laeufe, ${durB}s): meanDelta(wert) ${b.meanDelta}, meanRangDelta ${b.meanRangDelta}`);
  }
}
if (fehler.length) console.log("\nFEHLER:", fehler);
await browser.close();
