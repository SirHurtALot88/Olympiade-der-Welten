// ABNAHME-MESSUNG GEWICHTHEBEN (Plan Teil 6.1, Schritt S1/S3).
//
//   node scripts/miss-gewichtheben-korridor.mjs [spiele]
//
// Gemessen wird aus dem Versuchsprotokoll, nicht aus einer Endzahl: nur dort steht, WIE
// ein Versuch ausging (gueltig/ungueltig, welche Uebung, welcher Versuch).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 40);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 30000 });

const roh = await seite.evaluate((n) => {
  const A = window.__arena, spiele = [];
  for (let i = 0; i < n; i++) spiele.push(A.spiele("gewichtheben", 1337 + i * 7919).protokoll);
  return spiele;
}, SPIELE);
await browser.close();

const quote = { reissen: [[0,0],[0,0],[0,0]], stossen: [[0,0],[0,0],[0,0]] };
let heber = 0, fehlversuche = 0, null_ = 0, remis = 0, zweikaempfe = [];
const proSpieler = new Map();
for (const prot of roh) {
  const duelle = [0, 0];
  for (const u of prot) {
    heber++;
    if (u.nullwertung) null_++;
    if (u.duellGewonnen) duelle[u.seite]++;
    if (u.zweikampf > 0) zweikaempfe.push(u.zweikampf);
    for (const r of u.runden) {
      quote[r.uebung][r.versuch - 1][1]++;
      if (r.gueltig) quote[r.uebung][r.versuch - 1][0]++;
      else fehlversuche++;
    }
    const a = proSpieler.get(u.n) || { n: u.n, eig: u.eig, kg: 0, spiele: 0, siege: 0 };
    a.kg += u.zweikampf; a.siege += u.duellGewonnen ? 1 : 0; a.spiele++;
    proSpieler.set(u.n, a);
  }
  if (duelle[0] === duelle[1]) remis++;
}

const pz = (a) => (100 * a[0] / Math.max(1, a[1])).toFixed(1) + " %";
const mittel = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const zeile = (was, ist, soll) => `${was.padEnd(34)} ${String(ist).padStart(9)}   Ziel ${soll}`;

console.log(`Gewichtheben-Korridor — ${SPIELE} Spiele\n`);
console.log(zeile("Gelingen Reissen 1./2./3. Versuch",
  quote.reissen.map(pz).join(" / "), "84-90 / 71-80 / 50-63 %"));
console.log(zeile("Gelingen Stossen 1./2./3. Versuch",
  quote.stossen.map(pz).join(" / "), "84-90 / 71-80 / 50-63 %"));
console.log(zeile("Fehlversuche je Heber (von 6)", (fehlversuche / heber).toFixed(2), "1,4 bis 1,8"));
console.log(zeile("Nullwertungen je Heber", (100 * null_ / heber).toFixed(1) + " %", "hoechstens 3 %"));
console.log(zeile("Unentschiedene Duellstaende", (100 * remis / roh.length).toFixed(1) + " %", "Tiebreak faellig"));
const reissenAnteil = zweikaempfe.length ? 0 : 0;
let sumR = 0, sumG = 0;
for (const prot of roh) for (const u of prot) {
  if (u.nullwertung) continue;
  const r = Math.max(...u.runden.filter(x => x.uebung === "reissen" && x.gueltig).map(x => x.kg), 0);
  sumR += r; sumG += u.zweikampf;
}
console.log(zeile("Reissen-Anteil am Zweikampf", (100 * sumR / Math.max(1, sumG)).toFixed(1) + " %", "44-47 %"));
console.log(zeile("Zweikampf Mittel (Sinclair-kg)", mittel(zweikaempfe).toFixed(0), "—"));
console.log(zeile("Spanne bester minus schwaechster",
  (Math.max(...zweikaempfe) - Math.min(...zweikaempfe)).toFixed(0), "150-200 bei Streuung 15"));

// Rangtreue: Spearman zwischen Eignung und eigenen Sinclair-kg, je Seite gerechnet.
const reihen = [...proSpieler.values()].map(a => ({ n: a.n, eig: a.eig, kg: a.kg / a.spiele }));
const rho = (rows, k1, k2) => {
  const rang = (k) => { const s = [...rows].sort((x, y) => y[k] - x[k]); const m = new Map();
    s.forEach((v, i) => m.set(v.n, i + 1)); return m; };
  const a = rang(k1), b = rang(k2);
  const n = rows.length;
  let d2 = 0; for (const r of rows) d2 += (a.get(r.n) - b.get(r.n)) ** 2;
  return 1 - 6 * d2 / (n * (n * n - 1));
};
console.log("\n" + zeile("Rangtreue rho (Eignung vs eigene kg)", rho(reihen, "eig", "kg").toFixed(3), "mindestens 0,80"));
console.log("\nName                    Eig   Zweikampf/Sp   Duellsiege");
for (const a of [...proSpieler.values()].sort((x, y) => y.eig - x.eig))
  console.log(a.n.padEnd(22) + a.eig.toFixed(1).padStart(6)
    + (a.kg / a.spiele).toFixed(0).padStart(14) + (a.siege + "/" + a.spiele).padStart(13));
console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
