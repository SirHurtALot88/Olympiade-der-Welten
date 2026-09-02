// ===================================================================================
// DER STAND ALLER ZWANZIG DISZIPLINEN — eine Tabelle, eine Zahl je Disziplin.
//
// Chris' Frage: "welche sind quasi spielreif?" Bis hierher war das eine Meinung. Fuer das
// Feldspiel gab es eine Sonde, fuer Buehne, Bahn und Arena keine — 16 von 20 Disziplinen
// hatten ueberhaupt keine Rangtreue-Zahl.
//
// Gemessen wird die Abnahmezahl des Projekts (s. CLAUDE.md): rho zwischen der Eignung
// eines Teilnehmers und dem, was er im Spiel bewirkt. EINMAL ueber die Saison gemittelt
// (die Validitaet: belohnt die Mechanik ueberhaupt das Richtige?) und einmal je EINZELNEM
// Spiel (die Zahl, die zaehlt — pro Saison kommt jede Disziplin nur ein paar Mal dran).
//
//   node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...]
//
// Ohne Disziplinliste laufen alle zwanzig. Das dauert; mit einer Liste misst man gezielt.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const NUR = process.argv.slice(3);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

const alle = NUR.length ? NUR : await seite.evaluate(() => window.__arena.motoren());

// Spearman ueber Paare {eig, wert}. Bindungen bekommen den Durchschnittsrang, sonst
// verzerren gleiche Werte (bei Bahn-Platzierungen keine Seltenheit) das Ergebnis.
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

const zeilen = [];
for (const d of alle) {
  let x;
  try {
    x = await seite.evaluate(([d, n]) => window.__arena.disziplinProbe(d, { n }), [d, SPIELE]);
  } catch (e) { zeilen.push({ d, fehler: String(e).slice(0, 60) }); continue; }
  if (x.fehler || !x.spiele.length) { zeilen.push({ d, fehler: x.fehler || "keine Spiele" }); continue; }

  // rho JE SPIEL, dann gemittelt — das ist die Abnahmezahl (CLAUDE.md: rho in EINEM Spiel).
  const jeSpiel = x.spiele.map((s) => rho(s.teilnehmer)).filter((v) => !Number.isNaN(v));
  // rho ueber die Saison: je Teilnehmer erst mitteln, dann einmal ordnen.
  const agg = new Map();
  for (const s of x.spiele) for (const t of s.teilnehmer) {
    const a = agg.get(t.n) || { n: t.n, eig: 0, wert: 0, k: 0 };
    a.eig += t.eig; a.wert += t.wert; a.k++; agg.set(t.n, a);
  }
  const saison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
  zeilen.push({ d, chassis: x.chassis,
    spiel: jeSpiel.reduce((a, b) => a + b, 0) / Math.max(1, jeSpiel.length),
    saison, teilnehmer: agg.size });
}
await browser.close();

console.log(`Rangtreue aller Disziplinen — ${SPIELE} Spiele je Disziplin\n`);
console.log("Disziplin           Chassis     Teiln.  rho je Spiel  rho Saison   Abnahme");
for (const z of zeilen.sort((a, b) => (b.spiel || -9) - (a.spiel || -9))) {
  if (z.fehler) { console.log(z.d.padEnd(20) + "— " + z.fehler); continue; }
  const ok = z.spiel >= 0.80 ? "bestanden" : z.spiel >= 0.70 ? "knapp" : "durchgefallen";
  console.log(z.d.padEnd(20) + (z.chassis || "").padEnd(12)
    + String(z.teilnehmer).padStart(5)
    + z.spiel.toFixed(3).padStart(14) + z.saison.toFixed(3).padStart(12)
    + "   " + ok);
}
console.log("\nSchranke: rho je Spiel ueber 0,80 (CLAUDE.md, gilt fuer alle Disziplinen).");
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
