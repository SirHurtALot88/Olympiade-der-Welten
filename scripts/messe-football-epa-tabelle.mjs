// F1 — EPA STATT YARDS: MESSSONDE FUER DIE EP-TABELLE (docs/design/fable-ideen-feldspiel-
// 30-09.md Abschnitt 4, "die Football-Fassung von K3").
//
// Zieht eine EP-Tabelle (Expected Points), geschluesselt nach (Down, Distanzklasse,
// Feldstand in Zehnerschritten), AUS DEM EIGENEN MOTOR — dieselbe Ehrlichkeit, mit der
// `kurve.skillMittel` als gemessener Mittelwert gezogen wurde (s. scripts/miss-football-
// korridor.mjs), KEINE echte NFL-Tabelle.
//
// Methode (Standard-EPA-Methodik, "naechster Punkt im Spiel"): fuer jeden Snap wird der
// Zustand VOR dem Spielzug festgehalten (down, toGo, spot, side) — die Engine schreibt das
// bereits selbst in `fsFbLog.epaZustaende` (starteSnap(), reine Buchfuehrung, kein neuer
// rr()-Aufruf). Jeder tatsaechliche Punktgewinn (Touchdown oder Field Goal) steht in
// `fsFbLog.epaScores` als {idx, side, punkte}, wobei `idx` der Index des Snaps in
// `epaZustaende` ist, der den Punkt erzielt hat.
//
// Fuer jeden Snap i wird rueckwaerts der NAECHSTE Punktgewinn j>=i gesucht (ueber
// Seitenwechsel/Punts/Turnover-on-Downs hinweg — die Suche kennt keine "Drive"-Grenze,
// exakt die NFL-Standarddefinition von Expected Points). Der Wert ist +punkte, wenn die
// Seite, die bei i den Ball hatte, auch bei j getroffen hat, sonst -punkte. Ohne einen
// weiteren Punktgewinn bis Spielende gilt der Wert als 0 (Trunkierung, dokumentierter
// Kompromiss — kein Punktgewinn mehr heisst "neutral", nicht "unbekannt").
//
// Bucket-Schluessel: down (1..4, geklemmt), Distanzklasse (toGo<=3 "kurz", <=7 "mittel",
// sonst "lang"), Feldstand in Zehnerschritten (0..90, geklemmt). Eine zweite, groebere
// Tabelle nur nach Feldstand dient als Rueckfall fuer Zellen mit zu wenig Besuchen (siehe
// MINDESTBESUCHE unten) — v.a. 4th Down bei kurzer Distanz tief im eigenen Feld ist selten.
//
//   node scripts/messe-football-epa-tabelle.mjs [spiele]
//
// Gibt die beiden JS-Objektliterale aus, die FOOTBALL_EP_TABELLE/FOOTBALL_EP_TABELLE_GROB
// in public/mockups/battle-mode.engine.js ersetzen (Suche nach "__FOOTBALL_EP_TABELLE" bzw.
// den beiden const-Zeilen direkt davor).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 240);
const MINDESTBESUCHE = 25; // unter dieser Zahl an Snaps gilt eine Fein-Zelle als zu unsicher
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const roh = await seite.evaluate((n) => {
  const x = window.__arena.feldspielProbe("football", { n, jeSeite: 6 });
  return x.spiele.map((s) => ({
    zustaende: (s.football && s.football.epaZustaende) || [],
    scores: (s.football && s.football.epaScores) || [],
  }));
}, SPIELE);

await browser.close();

function distanzklasse(toGo) {
  return toGo <= 3 ? "kurz" : toGo <= 7 ? "mittel" : "lang";
}
function zehner(spot) {
  return Math.max(0, Math.min(90, Math.floor(spot / 10) * 10));
}

// {sum, n} je Feinzelle (down|distanzklasse|zehner) und je Grobzelle (nur zehner).
const fein = new Map();
const grob = new Map();
let gesamtSnaps = 0, gesamtScores = 0;

for (const spiel of roh) {
  const { zustaende, scores } = spiel;
  gesamtSnaps += zustaende.length;
  gesamtScores += scores.length;
  // scoreVon[i] = {side, punkte} des naechsten Punktgewinns ab Index i (rueckwaerts gefuellt).
  const scoreByIdx = new Map();
  for (const sc of scores) scoreByIdx.set(sc.idx, sc);
  let naechster = null;
  const naechsterJeIdx = new Array(zustaende.length).fill(null);
  for (let i = zustaende.length - 1; i >= 0; i--) {
    if (scoreByIdx.has(i)) naechster = scoreByIdx.get(i);
    naechsterJeIdx[i] = naechster;
  }
  for (let i = 0; i < zustaende.length; i++) {
    const z = zustaende[i];
    const sc = naechsterJeIdx[i];
    const wert = sc ? (sc.side === z.side ? sc.punkte : -sc.punkte) : 0;
    const d = Math.max(1, Math.min(4, z.down));
    const key = d + "|" + distanzklasse(z.toGo) + "|" + zehner(z.spot);
    if (!fein.has(key)) fein.set(key, { sum: 0, n: 0 });
    const f = fein.get(key); f.sum += wert; f.n++;
    const zk = zehner(z.spot);
    if (!grob.has(zk)) grob.set(zk, { sum: 0, n: 0 });
    const g = grob.get(zk); g.sum += wert; g.n++;
  }
}

const feinTabelle = {};
let feinVerworfen = 0;
for (const [key, { sum, n }] of fein) {
  if (n < MINDESTBESUCHE) { feinVerworfen++; continue; }
  feinTabelle[key] = +(sum / n).toFixed(2);
}
const grobTabelle = {};
for (const [zk, { sum, n }] of grob) grobTabelle[zk] = +(sum / n).toFixed(2);

console.log(`EPA-Tabelle — ${roh.length} Spiele, ${gesamtSnaps} Snaps, ${gesamtScores} Punktgewinne, Quelle: ${SEITE}\n`);
console.log(`Feinzellen gesamt: ${fein.size}, davon unter ${MINDESTBESUCHE} Besuchen verworfen: ${feinVerworfen}`);
console.log(`Grobzellen (Feldstand, Rueckfall): ${grob.size} (sollte 10 sein, 0..90)\n`);

console.log("const FOOTBALL_EP_TABELLE=" + JSON.stringify(feinTabelle) + ";");
console.log("const FOOTBALL_EP_TABELLE_GROB=" + JSON.stringify(grobTabelle) + ";");

console.log(`\nSeitenfehler: ${seitenfehler.length ? seitenfehler.slice(0, 3).join(" | ") : "keine"}`);
