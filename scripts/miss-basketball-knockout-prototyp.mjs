// ===================================================================================
// VORAB-SONDE FUER DEN BASKETBALL-KNOCKOUT-PROTOTYP (08.11.) — KEINE ABNAHME.
//
// Gleiche Methode wie scripts/miss-tauziehen-prototyp.mjs (Branch claude/format-varianten-
// prototyp-0811): rho je EINZELNEM Spiel (Spearman Eignung vs. Spielerwert, Median), Validitaet
// (Spielerwert ueber alle Spiele einer Paarung gemittelt), Star-Kennzahl, und Pp nach der
// Budget-Methode von einflussVon() (je Teilnehmer je Attribut +15, Gewinn im eigenen Spielerwert,
// Anteile gegen die Matrix). Kader: die fuenf Paarungen aus data/generated/kaderfamilie-live-save.json
// (je Seite die ersten sechs), Eignung = d.basketball.
//
// Kein Slot-, Trait- oder Formkanal: die Zahlen sagen, ob die MECHANIK die Matrix grundsaetzlich
// durchreicht und ob das Ausscheide-Format eine Einzelspiel-Rangfolge traegt — nicht, ob ein
// fertiges Feature die Pflichtabnahme besteht.
//
//   node scripts/miss-basketball-knockout-prototyp.mjs [spiele=48] [--saat-versatz=N]
//        [--leben=3] [--losen=fest|start|umlauf] [--durchgaenge=N]
//        [--wert=platz|marge|mix|konto|tempo] [--zeit=S] [--ohne-pp]
//   Standard = empfohlene Fassung (3 Leben, umlauf, marge). Fables Original:
//   --leben=1 --losen=fest --wert=platz
//   KO_K='{"ftK":0.012}' ueberschreibt Konstanten fuer einen Lauf (Kalibrier-Hilfe).
// ===================================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const T = require(resolve(wurzel, "public/mockups/basketball-knockout-prototyp.sim.js"));
if (process.env.KO_K) Object.assign(T.K, JSON.parse(process.env.KO_K));
const opt = (name, def) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1] : def; };
const OPT = { leben: Number(opt("leben", 3)), losen: opt("losen", "umlauf"), durchgaenge: Number(opt("durchgaenge", 1)), wert: opt("wert", "marge"), zeitLimit: Number(opt("zeit", 0)) };
const FORMAT = `leben=${OPT.leben} losen=${OPT.losen} durchgaenge=${OPT.durchgaenge} wert=${OPT.wert}${OPT.zeitLimit ? ` zeit=${OPT.zeitLimit}s` : ""}`;
const OHNE_PP = process.argv.includes("--ohne-pp");
const spiele = (h, g, s) => T.spiele(h, g, s, OPT);

const args = process.argv.slice(2);
const N = Number(args.find((a) => !a.startsWith("--")) ?? 48);
const VERSATZ = Number((args.find((a) => a.startsWith("--saat-versatz=")) ?? "=0").split("=")[1]);

const familie = JSON.parse(readFileSync(resolve(wurzel, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const kader = (liste) => liste.slice(0, 6).map((p) => ({ n: p.n, a: p.a, eig: p.d.basketball }));

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
    const e = spiele(heim, gast, saat(i));
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
      const e = spiele(hebe(heim), hebe(gast), saat(i));
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
let versuche = 0, treffer = 0, dauer = 0, spieleN = 0;
for (const v of familie) for (let i = 0; i < 8; i++) { const e = spiele(kader(v.heim), kader(v.gast), saat(i)); spieleN++; dauer += e.dauer;
  for (const u of e.teilnehmer) { versuche += u.versuche; treffer += u.treffer; } }
console.log(`Knockout-Prototyp (${FORMAT}) — ${N} Spiele je Paarung, Saatversatz ${VERSATZ}`);
console.log(`Wuerfe je Spiel ~${(versuche / spieleN).toFixed(0)}, Trefferquote ${(100 * treffer / versuche).toFixed(0)} %, Spielzeit ~${(dauer / spieleN).toFixed(0)} s`);
if (OHNE_PP) { ausgabeRho(); process.exit(0); }
const gesamt = new Map();
for (const v of familie) for (const r of einfluss(kader(v.heim), kader(v.gast))) gesamt.set(r.at, (gesamt.get(r.at) ?? 0) + r.gewinn);
const pos = [...gesamt.values()].reduce((s, g) => s + Math.max(0, g), 0) || 1;
const anteile = T.ATTRIBUTE.map((at) => ({ at, anteil: (100 * Math.max(0, gesamt.get(at))) / pos, matrix: T.MATRIX[at] }));
const pp = anteile.reduce((s, r) => s + Math.abs(r.anteil - r.matrix), 0);

ausgabeRho();
function ausgabeRho() {
console.log("paarung                      rho/Spiel  Validitaet");
for (const z of zeilen) console.log(`${z.paarung.padEnd(28)} ${z.rhoJeSpiel.toFixed(3).padStart(9)}  ${z.validitaet.toFixed(3).padStart(10)}`);
console.log(`MEDIAN rho je Spiel ueber alle ${alleEinzel.length} Spiele: ${median(alleEinzel).toFixed(3)}  (Ziel > 0,80)`);
console.log(`Star auf Rang 1: ${(100 * stern1 / sternN).toFixed(0)} %, in den ersten zwei: ${(100 * stern2 / sternN).toFixed(0)} %`);
}
console.log("\nattribut        Anteil  Matrix  Diff");
for (const r of anteile.sort((a, b) => b.matrix - a.matrix || b.anteil - a.anteil))
  console.log(`${r.at.padEnd(14)} ${r.anteil.toFixed(1).padStart(7)} ${String(r.matrix).padStart(7)} ${(r.anteil - r.matrix).toFixed(1).padStart(6)}`);
console.log(`Pp-Abweichung: ${pp.toFixed(1)}  (Ziel <= 25)`);
