// ===================================================================================
// VORAB-SONDE FUER DEN TAUZIEHEN-PROTOTYP (08.11.) — KEINE ABNAHME.
//
// Misst die Prototyp-Mechanik aus public/mockups/tauziehen-prototyp.sim.js mit denselben zwei
// Groessen, die CLAUDE.md fuer jede Disziplin verlangt:
//   * rho je EINZELNEM Spiel (Eignung vs. Spielerwert, Spearman, Median ueber die Spiele) und
//     die Validitaet (rho ueber den Spielerwert, gemittelt ueber alle Spiele einer Paarung),
//   * Pp-Abweichung nach der Budget-Methode von einflussVon() (battle-mode.engine.js): je
//     Teilnehmer je Attribut +15, Gewinn im eigenen Spielerwert, Anteile gegen die Matrix.
//
// WARUM DAS NUR EINE VORAB-SONDE IST: die Pflichtmessung (scripts/miss-alle-disziplinen.mjs,
// scripts/messe-arena-einfluss.mjs) laeuft im echten Motor MIT Slot-Aufschlag, Trait-Mutatoren,
// Formkarten und Kaderfamilie. Der Prototyp kennt nur die nackten Attribute. Die Zahlen hier
// sagen, ob die MECHANIK die Matrix grundsaetzlich durchreicht — nicht, ob das fertige Feature
// die Abnahme besteht.
//
//   node scripts/miss-tauziehen-prototyp.mjs [spiele=48] [--saat-versatz=N]
// ===================================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const T = require(resolve(wurzel, "public/mockups/tauziehen-prototyp.sim.js"));
// Kalibrier-Hilfe: TAUZ_K='{"lastExp":1.1}' ueberschreibt einzelne Konstanten nur fuer diesen Lauf.
if (process.env.TAUZ_K) Object.assign(T.K, JSON.parse(process.env.TAUZ_K));

const args = process.argv.slice(2);
const N = Number(args.find((a) => !a.startsWith("--")) ?? 48);
const VERSATZ = Number((args.find((a) => a.startsWith("--saat-versatz=")) ?? "=0").split("=")[1]);

const familie = JSON.parse(readFileSync(resolve(wurzel, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const kader = (liste) => liste.slice(0, 6).map((p) => ({ n: p.n, a: p.a, eig: p.d.gewichtheben }));

function spearman(x, y) {
  const rang = (v) => {
    const idx = v.map((w, i) => [w, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const rx = rang(x), ry = rang(y), n = x.length;
  const mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy || 1);
}
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const saat = (i) => 1337 + VERSATZ + i * 7919;

// ---------------------------------------------------------------- rho je Spiel / Validitaet
const zeilen = [];
let alleEinzel = [], stern1 = 0, stern2 = 0, sternN = 0;
for (const v of familie) {
  const heim = kader(v.heim), gast = kader(v.gast);
  const einzel = [], summe = new Map();
  for (let i = 0; i < N; i++) {
    const e = T.spiele(heim, gast, saat(i));
    const z = e.teilnehmer;
    einzel.push(spearman(z.map((u) => u.eig), z.map((u) => u.wert)));
    for (const u of z) summe.set(u.n, (summe.get(u.n) ?? 0) + u.wert / N);
    // Star-Kennzahl wie in CLAUDE.md: der Eignungsbeste auf Rang 1 / in den ersten zwei.
    const stern = [...z].sort((a, b) => b.eig - a.eig)[0];
    const platz = [...z].sort((a, b) => b.wert - a.wert).findIndex((u) => u === stern);
    if (platz === 0) stern1++; if (platz <= 1) stern2++; sternN++;
  }
  const z = [...heim, ...gast];
  const validitaet = spearman(z.map((p) => p.eig), z.map((p) => summe.get(p.n)));
  zeilen.push({ paarung: v.label, rhoJeSpiel: median(einzel), validitaet });
  alleEinzel = alleEinzel.concat(einzel);
}

// ---------------------------------------------------------------- Pp nach einflussVon()
function einfluss(heim, gast) {
  const plus = 15;
  const lauf = (wer, attr) => {
    const w = new Map();
    for (let i = 0; i < N; i++) {
      const hebe = (l) => l.map((p) => p.n === wer ? { ...p, a: { ...p.a, [attr]: Math.min(100, (p.a[attr] ?? 0) + plus) } } : p);
      const e = T.spiele(hebe(heim), hebe(gast), saat(i));
      for (const u of e.teilnehmer) w.set(u.n, (w.get(u.n) ?? 0) + u.wert / N);
    }
    return w;
  };
  const grund = lauf(null, null);
  const namen = [...heim, ...gast].map((p) => p.n);
  return T.ATTRIBUTE.map((at) => {
    let s = 0;
    for (const n of namen) s += lauf(n, at).get(n) - grund.get(n);
    return { at, gewinn: s / namen.length };
  });
}
const gesamt = new Map();
for (const v of familie) for (const r of einfluss(kader(v.heim), kader(v.gast))) gesamt.set(r.at, (gesamt.get(r.at) ?? 0) + r.gewinn);
const pos = [...gesamt.values()].reduce((s, g) => s + Math.max(0, g), 0) || 1;
const anteile = T.ATTRIBUTE.map((at) => ({ at, anteil: (100 * Math.max(0, gesamt.get(at))) / pos, matrix: T.MATRIX[at] }));
const pp = anteile.reduce((s, r) => s + Math.abs(r.anteil - r.matrix), 0);

console.log(`Tauziehen-Prototyp, Vorab-Sonde — ${N} Spiele je Paarung, Saatversatz ${VERSATZ}`);
console.log("paarung                      rho/Spiel  Validitaet");
for (const z of zeilen) console.log(`${z.paarung.padEnd(28)} ${z.rhoJeSpiel.toFixed(3).padStart(9)}  ${z.validitaet.toFixed(3).padStart(10)}`);
console.log(`MEDIAN rho je Spiel ueber alle ${alleEinzel.length} Spiele: ${median(alleEinzel).toFixed(3)}  (Ziel > 0,80)`);
console.log(`Star auf Rang 1: ${(100 * stern1 / sternN).toFixed(0)} %, in den ersten zwei: ${(100 * stern2 / sternN).toFixed(0)} %`);
console.log("\nattribut        Anteil  Matrix  Diff");
for (const r of anteile.sort((a, b) => b.matrix - a.matrix || b.anteil - a.anteil))
  console.log(`${r.at.padEnd(14)} ${r.anteil.toFixed(1).padStart(7)} ${String(r.matrix).padStart(7)} ${(r.anteil - r.matrix).toFixed(1).padStart(6)}`);
console.log(`Pp-Abweichung: ${pp.toFixed(1)}  (Ziel <= 25)`);
