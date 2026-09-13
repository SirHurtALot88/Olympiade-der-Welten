// ===================================================================================
// BEKOMMT JEDE FIGUR EINE HANTEL? (13.09.) — die Regressionsprobe zu Chris' Befund
// "dann hat nur einer eine hantel". Vor dem 13.09. bekamen 5 von 17 Figuren des
// Beispielkaders in KEINER Phase eine Hantel, weil der b.vollbild- und der
// b.reiherMech-Zweig in zeichneSprite() vor dem Hantel-Block zurueckkehren
// (docs/design/gewichtheben-hantel-recherche-13-09.md, Abschnitt 3).
//
// Wer kuenftig einen weiteren Zeichenpfad mit eigenem `return` einzieht (oder ein neues
// b.vollbild-Blatt registriert, das VOLLBILD_SCHLAEGER nicht kennt), soll das hier sehen,
// statt es im Screenshot zu entdecken.
//
// METHODE wie scripts/messe-heben-geometrie.mjs: Alpha-Differenz zweier renderProbe-
// Renderings, BEIDE mit feldspiel=true und in derselben "shoot"-Pose — einmal unter
// disc="gewichtheben" (Koerper + Hantel), einmal unter disc="basketball" (derselbe Koerper,
// keine Requisite). NICHT feldspiel=false als Gegenbild nehmen: dieser Parameter schaltet
// zusaetzlich die Bogen-/Feuerwaffen-Overlays um, die Differenz enthaelt dann den BOGEN.
//
// Aufruf: node scripts/pruefe-heben-hantel-vollzaehlig.mjs [zielordner-fuer-rohdaten]
// ===================================================================================
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = process.argv[2];
const L = 256, DIR = 3;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("ERR", String(e)));
await p.goto("file://" + join(REPO, "public/mockups/battle-mode.html"), { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const px = (durl) => p.evaluate(async ([d, gr]) => {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = d; });
  const c = document.createElement("canvas"); c.width = gr; c.height = gr;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  return Array.from(x.getImageData(0, 0, gr, gr).data);
}, [durl, L]);
const probe = (n, ph) => p.evaluate(([nn, d, gr, pp]) => window.__arena.renderProbe(nn, "shoot", true, d, 0.1, gr, pp), [n, DIR, L, ph]);

const namen = await p.evaluate(() => [...window.__arena.kader(), ...window.__arena.opp()].map((x) => x.n));
await p.evaluate(() => window.__arena.setDisc("basketball"));
const ohne = {}, koerper = {};
for (const n of namen) {
  ohne[n] = await px(await probe(n, null));
  let o = null, u2 = null;
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) if (ohne[n][(y * L + x) * 4 + 3] > 40) { if (o === null) o = y; u2 = y; break; }
  koerper[n] = { scheitel: o, sohle: u2 };
}
await p.evaluate(() => window.__arena.setDisc("gewichtheben"));
const kasten = (mit, o) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4;
    if (mit[i + 3] > 40 && !(o[i + 3] > 40)) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return n ? { x0, y0, x1, y1, n, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 } : null;
};
const out = [];
for (const n of namen) {
  const kb = kasten(await px(await probe(n, "boden")), ohne[n]);
  const kh = kasten(await px(await probe(n, "hoch")), ohne[n]);
  const k = koerper[n];
  out.push({ n, ...k, boden: kb, hoch: kh });
  const sichtbar = kb || kh ? "JA " : "NEIN";
  // Positive Zahlen heissen hier "hoeher als die Landmarke" (Leinwand-y waechst nach unten).
  const ueberSohle = kb ? (k.sohle - kb.my).toFixed(1) : "—";
  const ueberScheitel = kh ? (k.scheitel - kh.my).toFixed(1) : "—";
  const mittig = kb ? (kb.mx - 32).toFixed(1) : "—";
  console.log(`${n.padEnd(22)} Hantel ${sichtbar} · Koerper y ${k.scheitel}..${k.sohle} · boden-Mitte ${kb ? kb.my.toFixed(1) : "—"} (${ueberSohle} ueber Sohle, x-Versatz ${mittig}) · hoch-Mitte ${kh ? kh.my.toFixed(1) : "ausserhalb"} (${ueberScheitel} ueber Scheitel)`);
}
if (ZIEL) writeFileSync(join(ZIEL, "_hantel-gegenprobe.json"), JSON.stringify(out, null, 1));
await b.close();

// Die eigentliche Zusage dieses Skripts: KEINE Figur ohne Hantel. Exit-Code 1, damit es
// sich in eine Pruefkette haengen laesst.
const ohneHantel = out.filter((r) => !r.boden && !r.hoch).map((r) => r.n);
if (ohneHantel.length) {
  console.log(`\nFEHLER: ${ohneHantel.length} von ${out.length} Figuren ohne Hantel — ${ohneHantel.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`\nAlle ${out.length} Figuren zeichnen eine Hantel.`);
}
