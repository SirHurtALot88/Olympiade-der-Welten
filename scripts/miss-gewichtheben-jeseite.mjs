// GEWICHTHEBEN S4 — rho je Spiel bei 6, 4 UND 2 je Seite (Plan Abschnitt 8.1).
// Nutzt disziplinProbe(dId,{n,jeSeite}) direkt, dieselbe rho-Funktion wie
// miss-alle-disziplinen.mjs (Spearman mit Bindungen, je Spiel gerechnet und gemittelt).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 48);
const DISZ = process.argv[3] || "gewichtheben";
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

const rho = (paare) => {
  const n = paare.length;
  if (n < 3) return NaN;
  const rang = (key) => {
    const s = paare.map((p, i) => ({ i, v: p[key] })).sort((a, b) => b.v - a.v);
    const r = new Array(n);
    let k = 0;
    while (k < n) {
      let j = k;
      while (j + 1 < n && s[j + 1].v === s[k].v) j++;
      const mittel = (k + j) / 2 + 1;
      for (let m = k; m <= j; m++) r[s[m].i] = mittel;
      k = j + 1;
    }
    return r;
  };
  const a = rang("eig"), b = rang("wert");
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    sab += da * db; sa += da * da; sb += db * db;
  }
  return sab / Math.sqrt(sa * sb || 1);
};

console.log(`Gewichtheben — rho je Spiel bei 6/4/2 je Seite, ${SPIELE} Spiele je Groesse\n`);
console.log("jeSeite   Teiln.  rho je Spiel (Mittel)  rho Saison   Abnahme");
for (const jeSeite of [6, 4, 2]) {
  const x = await seite.evaluate(([d, n, js]) => window.__arena.disziplinProbe(d, { n, jeSeite: js }), [DISZ, SPIELE, jeSeite]);
  if (x.fehler || !x.spiele.length) { console.log(String(jeSeite).padEnd(9) + "— " + (x.fehler || "keine Spiele")); continue; }
  // je Seite gemittelt (wie CLAUDE.md D.2: "Spearman je Seite gemittelt") — hier zusaetzlich
  // gesamt (beide Seiten in einem Spiel) UND je Seite getrennt gerechnet.
  const jeSpielGesamt = x.spiele.map((s) => rho(s.teilnehmer)).filter((v) => !Number.isNaN(v));
  const jeSpielSeite = x.spiele.map((s) => {
    const s0 = s.teilnehmer.filter((t) => t.seite === 0);
    const s1 = s.teilnehmer.filter((t) => t.seite === 1);
    const r0 = rho(s0), r1 = rho(s1);
    const vals = [r0, r1].filter((v) => !Number.isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  }).filter((v) => !Number.isNaN(v));
  const agg = new Map();
  for (const s of x.spiele) for (const t of s.teilnehmer) {
    const a = agg.get(t.n) || { n: t.n, eig: 0, wert: 0, k: 0 };
    a.eig += t.eig; a.wert += t.wert; a.k++; agg.set(t.n, a);
  }
  const saison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
  const mGesamt = jeSpielGesamt.reduce((a, b) => a + b, 0) / Math.max(1, jeSpielGesamt.length);
  const mSeite = jeSpielSeite.reduce((a, b) => a + b, 0) / Math.max(1, jeSpielSeite.length);
  const ok = mSeite >= 0.80 ? "bestanden" : mSeite >= 0.70 ? "knapp" : "durchgefallen";
  console.log(String(jeSeite).padEnd(9) + String(agg.size).padStart(6)
    + ("  gesamt " + mGesamt.toFixed(3) + " / je Seite " + mSeite.toFixed(3)).padEnd(30)
    + saison.toFixed(3).padStart(10) + "   " + ok);
}
console.log("\nSchranke: rho je Seite >= 0,80 in EINEM Spiel, bei 6, 4 UND 2 je Seite (Plan 8.1).");
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
await browser.close();
