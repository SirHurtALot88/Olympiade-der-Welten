// ===================================================================================
// STIMMT DIE ANGEZEIGTE GROESSE? — Chris' Groessen-Sheet gegen das, was am Bildschirm
// wirklich zu sehen ist.
//
// Jede Figur hat eine `groesse` von 1 bis 10; `groesseFaktor` macht daraus einen
// Zeichenfaktor zwischen 0,80 und 1,30. Das allein sagt aber nicht, ob eine grosse Figur
// auch GROSS AUSSIEHT: die Sprite-Blaetter selbst sind unterschiedlich hoch gezeichnet
// (Krone, Hoerner, Haar, Fluegel), und diese Unterschiede sind aehnlich gross wie der
// Faktor. Wer nur den Faktor prueft, hat nichts geprueft.
//
//   node scripts/miss-figurgroessen.mjs [anzahl]
//
// Gemessen wird die Hoehe des Sprite-Inhalts (nicht der Leinwand) bei Faktor 1 — also die
// reine Blatt-Hoehe — und daraus die Bildschirmhoehe hochgerechnet. Direkt bei echtem
// Faktor zu messen geht nicht: eine grosse Figur laeuft oben aus der 64-Pixel-Sonde
// heraus und waere abgeschnitten.
//
// Ausgegeben wird am Ende die Rangkorrelation zwischen eingestellter Groesse und
// tatsaechlicher Bildschirmhoehe. 1,00 hiesse: wer groesser eingestellt ist, ist auch
// groesser zu sehen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const ANZAHL = Number(process.argv[2] || 24);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const roh = await seite.evaluate(async (anzahl) => {
  const A = window.__arena;
  const aus = [];
  for (const s of A.kader().slice(0, anzahl)) {
    const d = await A.renderProbe(s.n, "walk", false, 2, null, 128);
    if (!d) continue;
    const im = new Image();
    im.src = d;
    await new Promise((res) => { im.onload = res; });
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    const cx = c.getContext("2d");
    cx.drawImage(im, 0, 0);
    const px = cx.getImageData(0, 0, c.width, c.height).data;
    let oben = null, unten = null;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (px[(y * c.width + x) * 4 + 3] > 16) { if (oben == null) oben = y; unten = y; break; }
    aus.push({ n: s.n, groesse: s.groesse, blatt: oben == null ? 0 : unten - oben + 1,
      angeschnitten: oben === 0 });
  }
  return aus;
}, ANZAHL);
await browser.close();

const faktor = (g) => (typeof g === "number" && Number.isFinite(g) ? 0.8 + ((g - 1) / 9) * 0.5 : 1);
// Die Sonde zeichnet MIT Faktor; die reine Blatt-Hoehe ist die gemessene geteilt durch ihn.
const zeilen = roh.map((x) => {
  const f = faktor(x.groesse);
  const blattRein = x.blatt / f;
  return { ...x, faktor: f, blattRein, schirm: blattRein * f };
}).sort((a, b) => b.schirm - a.schirm);

const rho = (rows, a, b) => {
  const n = rows.length;
  const rang = (k) => { const s = [...rows].sort((x, y) => y[k] - x[k]); const m = new Map(); s.forEach((v, i) => m.set(v.n, i + 1)); return m; };
  const ra = rang(a), rb = rang(b);
  let d2 = 0;
  for (const x of rows) { const d = ra.get(x.n) - rb.get(x.n); d2 += d * d; }
  return 1 - (6 * d2) / (n * (n * n - 1));
};

console.log(`Figurgroessen — ${zeilen.length} Figuren, Quelle: ${SEITE}\n`);
console.log("Name                  groesse  Faktor  Blatt-Hoehe  Bildschirm  angeschnitten");
for (const x of zeilen)
  console.log(`${x.n.padEnd(21)}${String(x.groesse ?? "—").padStart(8)}${x.faktor.toFixed(2).padStart(8)}` +
    `${x.blattRein.toFixed(1).padStart(13)}${x.schirm.toFixed(1).padStart(12)}   ${x.angeschnitten ? "ja" : ""}`);
// ANGESCHNITTENE FIGUREN ZAEHLEN NICHT MIT. Wer oben aus der 64-Pixel-Sonde herauslaeuft,
// wurde zu KLEIN gemessen — seine Zeile ist eine Untergrenze, kein Messwert. Sie in die
// Rangkorrelation zu nehmen hiesse, einen Messfehler als Befund auszugeben.
const messbar = zeilen.filter((x) => typeof x.groesse === "number");
const sauber = messbar.filter((x) => !x.angeschnitten);
console.log(`\nRangkorrelation eingestellte Groesse gegen Bildschirmhoehe: ${rho(sauber, "groesse", "schirm").toFixed(3)}`
  + `  (${sauber.length} von ${messbar.length} Figuren; ${messbar.length - sauber.length} oben angeschnitten und deshalb nicht gewertet)`);
console.log(`Spanne der Blatt-Hoehen: ${Math.min(...messbar.map(x=>x.blattRein)).toFixed(0)} bis ${Math.max(...messbar.map(x=>x.blattRein)).toFixed(0)} px ` +
  `(Verhaeltnis ${(Math.max(...messbar.map(x=>x.blattRein))/Math.min(...messbar.map(x=>x.blattRein))).toFixed(2)})`);
console.log(`Spanne der Faktoren: ${Math.min(...messbar.map(x=>x.faktor)).toFixed(2)} bis ${Math.max(...messbar.map(x=>x.faktor)).toFixed(2)} ` +
  `(Verhaeltnis ${(Math.max(...messbar.map(x=>x.faktor))/Math.min(...messbar.map(x=>x.faktor))).toFixed(2)})`);
console.log(`\nSeitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
