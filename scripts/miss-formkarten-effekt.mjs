// ===================================================================================
// E9 — WIRKT SICH DIE FORMKARTE SPUERBAR AUS? (Fable-Feedback 13.10., Abschnitt 9, E9).
// Chris woertlich: "und funktioniert das mit der form sauber? wirkt es sich spuerbar aus?
// Konntest du das schon messen?"
//
// Dieses Skript ruft window.__arena.formEinflussVon(dId, n, formPlus, saatVersatz) —
// dieselbe gepaarte Messtechnik wie einflussVon() (s. battle-mode.engine.js, Kommentar an
// formEinflussVon): ein benannter Spieler bekommt in der Haelfte der Laeufe die Formkarte
// 0 (neutral) erzwungen, in der anderen Haelfte +formPlus (stark), bei SONST identischer
// Saat (gleicher Mutatoren-/Gegnerwurf je Lauf-Index i). Der Unterschied im Ergebnis ist
// deshalb ausschliesslich der Formkarte zuzuschreiben.
//
//   node scripts/miss-formkarten-effekt.mjs hockey 200
//   node scripts/miss-formkarten-effekt.mjs basketball 200 8
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const disziplin = process.argv[2] || "hockey";
const laeufe = Number(process.argv[3] || 200);
const formPlus = Number(process.argv[4] || 8);

const pfad = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const datei = pathToFileURL(pfad).href;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const seite = await browser.newPage();
await seite.addInitScript(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
});
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

const start = Date.now();
const e = await seite.evaluate(
  ([d, n, plus]) => {
    const st = window.setTimeout;
    window.setTimeout = () => 0;
    try {
      return window.__arena.formEinflussVon(d, n, plus);
    } finally {
      window.setTimeout = st;
    }
  },
  [disziplin, laeufe, formPlus],
);
const dauer = ((Date.now() - start) / 1000).toFixed(0);

if (e.fehler) {
  console.error(`${e.disziplin}: ${e.fehler}`);
  await browser.close();
  process.exit(1);
}

console.log(`Gemessene Datei: ${pfad}`);
console.log(`${e.disziplin} — ${e.laeufe} Laeufe je Spieler, Formkarte neutral=0 vs. stark=+${e.formPlus}, ${dauer}s`);
console.log(`\nMittlere Verschiebung ueber alle Spieler: wert() ${e.meanDelta >= 0 ? "+" : ""}${e.meanDelta} (Prozentpunkte bzw. Punkte, je Motor), Rang ${e.meanRangDelta >= 0 ? "+" : ""}${e.meanRangDelta} Plaetze (negativ = besser)\n`);
console.log("Spieler".padEnd(16) + "wert neutral".padEnd(14) + "wert stark".padEnd(14) + "delta".padEnd(10) + "Rang neutral".padEnd(14) + "Rang stark".padEnd(12) + "Rang-Delta");
for (const s of e.spieler) {
  console.log(
    s.spieler.padEnd(16) +
      String(s.wertNeutral).padEnd(14) +
      String(s.wertStark).padEnd(14) +
      `${s.delta >= 0 ? "+" : ""}${s.delta}`.padEnd(10) +
      String(s.rangNeutral).padEnd(14) +
      String(s.rangStark).padEnd(12) +
      `${s.rangDelta >= 0 ? "+" : ""}${s.rangDelta}`,
  );
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
await browser.close();
