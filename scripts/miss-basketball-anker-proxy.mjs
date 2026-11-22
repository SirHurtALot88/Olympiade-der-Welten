// BASKETBALL: ANKER-NAEHERUNG JE PUSTE-REGEL (22.11., docs/design/basketball-puste-22-11.md Abschnitt 6).
// Die vollstaendige Nachmessung der C2-/E1-Anker laeuft ueber sechs frische Battle-Saves (miss-pp-skala.ts, Stunden); Basketball steht
// aber nur zweimal je Saison im Plan (20 Zellen im Bestand, rTop je Feldgroesse 5,1 bis 8,1 -- das Rauschen des Bestands liegt weit
// ueber jeder Regel-Verschiebung). Diese Sonde rechnet deshalb dieselbe Groesse direkt am Motor nach: Spieltage aus 16 Duellen der
// Kader-Familie, je Einsatz der rohe PP-Wert (Referenz p50/p99,5 wie im Spiel, Modus "roh"), je Tag der Beste, Median ueber die Tage.
// Ausgabe je Feldgroesse und Regel: rTop (Median der Tagesbesten), rMed (Median aller Einsaetze), Median der Punkte-Siegmarge.
// Aufruf: OLY_FORM_MODUS=echt node scripts/miss-basketball-anker-proxy.mjs [spieleJeVariante=96] [tage=400]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SPIELE = Number(args[0] || 96);
const TAGE = Number(args[1] || 400);
const GROESSEN = String(args[2] || "2,3,4,5,6").split(",").map(Number);
const ref = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/basketball-pps-referenz.json"), "utf8")).feldgroessen;
const kader = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"));
const seite = await oeffneNodeSeite(path.join(WURZEL, "public/mockups"));
if (process.env.OLY_FORM_MODUS) await seite.evaluate((m) => window.__arena.formModusMessung(m), process.env.OLY_FORM_MODUS);

// Die Kurve aus lib/resolve/pp-skala.ts (ppAusKurveSkaliert, Modus "roh"): max * (wert/p995)^gamma, gamma = ln(anteilMitte)/ln(p50/p995).
const quelle = readFileSync(path.join(WURZEL, "lib/resolve/pp-skala.ts"), "utf8");
const lies = (name) => Number(new RegExp(`${name}\\s*=\\s*([0-9.]+)`).exec(quelle)?.[1]);
const MAX = lies("PP_SKALA_ALT_MAX"), ANTEIL = lies("PP_SKALA_ALT_ANTEIL_MITTE");
if (!(MAX > 0) || !(ANTEIL > 0)) throw new Error("PP_SKALA_ALT_MAX/ANTEIL_MITTE nicht gefunden");
const pp = (wert, g) => { const r = ref[String(g)]; const gamma = Math.log(ANTEIL) / Math.log(r.iMittel / r.iKrass); return wert <= 0 ? 0 : MAX * Math.pow(wert / r.iKrass, gamma); };
const med = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
// Deterministischer Zufall fuer die Tagesbildung.
let z = 12345; const rnd = () => { z = (z * 1664525 + 1013904223) >>> 0; return z / 4294967296; };

console.log(`PP_SKALA_ALT_MAX=${MAX} ANTEIL_MITTE=${ANTEIL}; ${SPIELE} Spiele je Kader-Variante, ${TAGE} Tage zu 16 Duellen`);
for (const g of GROESSEN) {
  const aus = {};
  for (const regel of ["alt", "neu"]) {
    await seite.evaluate((r) => window.__arena.basketballPuste(r), regel === "alt" ? "alt" : null);
    const x = await seite.evaluate(([n, fam, j]) => window.__arena.disziplinProbe("basketball", { n, kaderFamilie: fam, jeSeite: j }), [SPIELE, kader.familie, g]);
    const spiele = [];
    for (const v of x.varianten) for (const s of v.spiele) spiele.push(s.teilnehmer.map((t) => pp(t.wert, g)));
    z = 12345 + g;
    const tagesbeste = [], alle = [];
    for (const s of spiele) for (const w of s) alle.push(w);
    for (let t = 0; t < TAGE; t += 1) {
      let best = 0;
      for (let i = 0; i < 16; i += 1) for (const w of spiele[Math.floor(rnd() * spiele.length)]) if (w > best) best = w;
      tagesbeste.push(best);
    }
    aus[regel] = { rTop: med(tagesbeste), rMed: med(alle), n: spiele.length };
  }
  const r = (a, b) => `${a.toFixed(2)} -> ${b.toFixed(2)} (${((b / a - 1) * 100).toFixed(1)} %)`;
  console.log(`jeSeite ${g}: rTop ${r(aus.alt.rTop, aus.neu.rTop)}   rMed ${r(aus.alt.rMed, aus.neu.rMed)}   (${aus.alt.n} Spiele)`);
}
seite.schliessen();
