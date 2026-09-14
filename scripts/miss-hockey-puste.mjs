// ABNAHME UND KALIBRIERUNG DER PUSTE (Eishockey).
//
// Chris, 13.09., auf die Frage, wie leer die Leiste am Spielende sein soll:
//   „haengt ab von den Spieler-Stats, manche laufen aus und muessen kurz regenerieren,
//    manche schaffen den kompletten Spieltag"
//
// Genau das misst dieses Skript. Es gibt KEINE Zielzahl fuer den Endstand — die Zielgroesse
// ist die STREUUNG: wie weit liegen der zaeheste und der schwaechste Spieler auseinander,
// wie viele laufen wirklich einmal leer, und haengt beides an AUSDAUER statt am Zufall.
//
//   node scripts/miss-hockey-puste.mjs [spiele]
//
// Die Rangtreue selbst steht NICHT hier — dafuer ist scripts/miss-alle-disziplinen.mjs die
// eine Bank (kaderfest, fuenf Kader-Varianten). Dieses Skript misst den Puste-Haushalt auf
// dem Einzelkader und ist damit das Werkzeug fuer die Konstanten in
// FELDSPIEL_ART.hockey.puste, nicht fuer die Abnahme.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const w = await seite.evaluate(
  (n) => window.__arena.feldspielProbe("hockey", { n, jeSeite: 6 }),
  SPIELE,
);
await browser.close();

const zahl = (v, k = 1) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",") : "—");
const med = (a) => {
  const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : NaN;
};
const mit = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
// Spearman, dieselbe Rechnung wie in scripts/lib/rangtreue-messung.mjs — hier nur fuer die
// eine Frage „haengt der Endstand an AUSDAUER?", deshalb bewusst lokal und knapp.
const spearman = (xs, ys) => {
  const rang = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const mittel = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = mittel;
      i = j + 1;
    }
    return r;
  };
  const a = rang(xs), b = rang(ys), n = xs.length;
  const ma = mit(a), mb = mit(b);
  let zae = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    zae += (a[i] - ma) * (b[i] - mb);
    sa += (a[i] - ma) ** 2;
    sb += (b[i] - mb) ** 2;
  }
  return zae / Math.sqrt(sa * sb || 1);
};

const feld = [];
for (const s of w.spiele) for (const p of s.spieler) if (!p.torwart) feld.push(p);
const tw = [];
for (const s of w.spiele) for (const p of s.spieler) if (p.torwart) tw.push(p);

if (!feld.length || !feld[0].pusteMax) {
  console.log("Kein Puste-Rezept aktiv (FELDSPIEL_ART.hockey.puste fehlt) — nichts zu messen.");
  process.exit(0);
}

const anteil = (p) => p.puste / p.pusteMax;
const tief = (p) => p.pusteMin / p.pusteMax;
const leerGelaufen = feld.filter((p) => p.pusteMin <= 0.001).length;
const knappGelaufen = feld.filter((p) => tief(p) < 0.2).length;
const durch = feld.filter((p) => tief(p) >= 0.5).length;

console.log(`PUSTE-HAUSHALT EISHOCKEY — ${w.spiele.length} Spiele, 6 je Seite\n`);
console.log(`Feldspieler-Zeilen                      ${feld.length}`);
console.log(`Vorrat (pusteMax)   min ${Math.min(...feld.map((p) => p.pusteMax))} / Median ${med(feld.map((p) => p.pusteMax))} / max ${Math.max(...feld.map((p) => p.pusteMax))}`);
console.log(`gelaufene Strecke   Median ${Math.round(med(feld.map((p) => p.weg)))} px / Mittel ${Math.round(mit(feld.map((p) => p.weg)))} px je Spiel`);
console.log("");
console.log(`Puste am Spielende  Median ${zahl(100 * med(feld.map(anteil)))} %  (min ${zahl(100 * Math.min(...feld.map(anteil)))} / max ${zahl(100 * Math.max(...feld.map(anteil)))})`);
console.log(`tiefster Stand      Median ${zahl(100 * med(feld.map(tief)))} %  (min ${zahl(100 * Math.min(...feld.map(tief)))} / max ${zahl(100 * Math.max(...feld.map(tief)))})`);
console.log("");
console.log("DIE ZAHL, AUF DIE ES ANKOMMT — die Spannweite zwischen den Spielertypen:");
console.log(`  einmal vollstaendig leer gewesen      ${leerGelaufen} von ${feld.length} = ${zahl((100 * leerGelaufen) / feld.length)} %`);
console.log(`  zeitweise unter einem Fuenftel        ${knappGelaufen} von ${feld.length} = ${zahl((100 * knappGelaufen) / feld.length)} %`);
console.log(`  nie unter die Haelfte gefallen        ${durch} von ${feld.length} = ${zahl((100 * durch) / feld.length)} %`);
console.log("");
console.log(`rho(AUSDAUER, tiefster Stand)           ${zahl(spearman(feld.map((p) => p.AUSDAUER), feld.map(tief)), 3)}   (soll deutlich positiv sein — sonst haengt die Puste am Zufall statt am Spieler)`);
console.log(`rho(LAUFTEMPO, gelaufene Strecke)       ${zahl(spearman(feld.map((p) => p.LAUFTEMPO), feld.map((p) => p.weg)), 3)}`);
console.log(`rho(Checks kassiert…)                   — nicht erhoben, der Boxscore zaehlt nur ausgeteilte Checks`);
if (tw.length) {
  console.log("");
  console.log(`Torwart: Puste am Ende Median ${zahl(100 * med(tw.map(anteil)))} %, tiefster Stand Median ${zahl(100 * med(tw.map(tief)))} % — er laeuft kaum, also soll hier nahe 100 stehen.`);
}
console.log(`\nSeitenfehler: ${seitenfehler.length ? seitenfehler.slice(0, 3).join(" | ") : "keine"}`);
