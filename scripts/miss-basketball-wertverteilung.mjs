// BASKETBALL: VERTEILUNG DES ROHEN BOXSCORE-WERTS JE REGEL (22.11., docs/design/basketball-puste-22-11.md).
// Die PP-Referenz (data/generated/basketball-pps-referenz.json) haengt an Median (`iMittel`) und 99,5.-Perzentil (`iKrass`) des
// rohen Boxscore-Werts je Feldgroesse. Dieses Skript vergleicht beide Groessen zwischen alter und neuer Puste-Regel auf der
// Kader-Familie (Node-Motor), plus die mittlere Tor-/Punktzahl je Spiel und den mittleren Punkteabstand.
//   OLY_FORM_MODUS=echt node scripts/miss-basketball-wertverteilung.mjs [spiele=48] [jeSeite=2,3,4,5,6]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SPIELE = Number(args[0] || 48);
const GROESSEN = String(args[1] || "2,3,4,5,6").split(",").map(Number);
const kader = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"));
const seite = await oeffneNodeSeite(path.join(WURZEL, "public/mockups"));
if (process.env.OLY_FORM_MODUS) await seite.evaluate((m) => window.__arena.formModusMessung(m), process.env.OLY_FORM_MODUS);

const q = (l, p) => { const s = [...l].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const js of GROESSEN) {
  const aus = {};
  for (const regel of ["alt", "neu"]) {
    await seite.evaluate((r) => window.__arena.basketballPuste(r), regel === "alt" ? "alt" : null);
    const x = await seite.evaluate(([n, fam, j]) => window.__arena.disziplinProbe("basketball", { n, kaderFamilie: fam, jeSeite: j }), [SPIELE, kader.familie, js]);
    const w = []; const abstand = []; const summe = [];
    for (const v of x.varianten) for (const s of v.spiele) {
      for (const t of s.teilnehmer) w.push(t.wert);
      const sp = [0, 1].map((side) => s.teilnehmer.filter((t) => t.seite === side).reduce((a, t) => a + t.wert, 0));
      abstand.push(Math.abs(sp[0] - sp[1])); summe.push(sp[0] + sp[1]);
    }
    aus[regel] = { n: w.length, median: q(w, 0.5), p995: q(w, 0.995), p90: q(w, 0.9), abstandMed: q(abstand, 0.5), wertSumme: summe.reduce((a, b) => a + b, 0) / summe.length };
  }
  const f = (v) => v.toFixed(2);
  console.log(`jeSeite ${js}: Median ${f(aus.alt.median)} -> ${f(aus.neu.median)} (${((aus.neu.median / aus.alt.median - 1) * 100).toFixed(1)} %), p90 ${f(aus.alt.p90)} -> ${f(aus.neu.p90)}, p99,5 ${f(aus.alt.p995)} -> ${f(aus.neu.p995)} (${((aus.neu.p995 / aus.alt.p995 - 1) * 100).toFixed(1)} %), Team-Wertabstand (Median) ${f(aus.alt.abstandMed)} -> ${f(aus.neu.abstandMed)}, Wertsumme je Spiel ${f(aus.alt.wertSumme)} -> ${f(aus.neu.wertSumme)}  (n=${aus.alt.n})`);
}
seite.schliessen();
