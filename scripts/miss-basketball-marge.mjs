// BASKETBALL: PUNKTE-SIEGMARGE JE PUSTE-REGEL (22.11., docs/design/basketball-puste-22-11.md Abschnitt 6).
// E1 legt die Marge-Anker (`ergebnis-skala-kalibrierung.json`, basketball.duell.knoten) auf die Verteilung der Siegmargen im Motor.
// Diese Sonde spielt je Kader-Familien-Variante (ein Motor mit eingehaengtem Kader) n Spiele ueber `feldspielProbe` und gibt je Regel
// die Quantile der Punkte-Siegmarge aus (Median, p75, p90, p97,5) sowie den Mittelwert der Gesamtpunkte.
//   OLY_FORM_MODUS=echt node scripts/miss-basketball-marge.mjs [spiele=48] [jeSeite=2,4,6]
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { baueMotorKontext, ladeMotorSkripte } from "../lib/battle/arena-node-motor.mjs";
import { ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SPIELE = Number(args[0] || 48);
const GROESSEN = String(args[1] || "2,4,6").split(",").map(Number);
const familie = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json")).familie;
const skripte = ladeMotorSkripte(path.join(WURZEL, "public/mockups"));
const q = (l, p) => { const s = [...l].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const marge = { };
for (const v of familie) {
  const kontext = baueMotorKontext();
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({ heim: v.heim, gast: v.gast, aufstellung: {}, mutatoren: [] });
  vm.runInContext("window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe; window.AudioContext = undefined;", kontext.fenster);
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  for (let i = 0; i < 2000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  const A = kontext.fenster.__arena;
  if (process.env.OLY_FORM_MODUS) A.formModusMessung(process.env.OLY_FORM_MODUS);
  for (const g of GROESSEN) for (const regel of ["alt", "neu"]) {
    A.basketballPuste(regel === "alt" ? "alt" : null);
    kontext.fenster.__olyNodeArg = JSON.stringify([SPIELE, g]);
    const spiele = JSON.parse(vm.runInContext(
      "(() => { const [n, g] = JSON.parse(window.__olyNodeArg); const r = window.__arena.feldspielProbe('basketball', { n, jeSeite: g }); return JSON.stringify(r.spiele.map((s) => s.seiten)); })()",
      kontext.fenster));
    const k = `${g}|${regel}`;
    (marge[k] ??= []).push(...spiele);
  }
  A.basketballPuste(null);
  kontext.aufraeumen();
}
for (const g of GROESSEN) {
  const zeile = (regel) => {
    const l = marge[`${g}|${regel}`];
    const sieg = l.map(([a, b]) => Math.abs(a - b)).filter((m) => m > 0);
    return { n: l.length, med: q(sieg, 0.5), p75: q(sieg, 0.75), p90: q(sieg, 0.9), p975: q(sieg, 0.975), punkte: l.reduce((s, [a, b]) => s + a + b, 0) / l.length };
  };
  const a = zeile("alt"), n = zeile("neu");
  const f = (x, y) => `${x} -> ${y}`;
  console.log(`jeSeite ${g} (${a.n} Spiele): Siegmarge Median ${f(a.med, n.med)}, p75 ${f(a.p75, n.p75)}, p90 ${f(a.p90, n.p90)}, p97,5 ${f(a.p975, n.p975)}; Punkte je Spiel ${a.punkte.toFixed(1)} -> ${n.punkte.toFixed(1)}`);
}
