// Simuliert die Spieler-Form (lib/morale/form-moral-modifikator.ts) ueber eine Saison mit der ECHTEN
// Fortschreibungsfunktion und schreibt die Verteilung samt Moral-Verteilung des Spielstand-Abbilds
// nach data/generated/form-moral-verteilung.json (Eingabe fuer scripts/miss-form-moral-dosis.mjs).
//   npx tsx scripts/simuliere-form-verteilung.ts <morale_pool.json>
import { readFileSync, writeFileSync } from "node:fs";
import { advancePlayerForm, formToStufe } from "../lib/morale/form-moral-modifikator";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const zufall = mulberry32(20261117);
const normal = () => {
  const u = Math.max(zufall(), 1e-9);
  const v = zufall();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Residuum-Streuung: Perzentil-Differenz Leistung - Erwartung. Bei rho je Spiel ~0,78 ist
// sd ~ 0,289 * sqrt(2 * (1 - 0,78)) = 0,19.
const RESIDUUM_SD = 0.19;
const EINSATZ_ANTEIL = 0.55;
const SPIELTAGE = 32;
const SPIELER = 400;
const form: number[] = new Array(SPIELER).fill(50);
const probe: number[] = [];
for (let tag = 1; tag <= SPIELTAGE; tag++) {
  for (let i = 0; i < SPIELER; i++) {
    const spielt = zufall() < EINSATZ_ANTEIL;
    const residuum = Math.max(-1, Math.min(1, normal() * RESIDUUM_SD));
    const erschoepfung = Math.max(0, Math.min(100, 35 + 20 * normal()));
    form[i] = advancePlayerForm({
      form: form[i],
      eingesetzt: spielt,
      residuum: spielt ? residuum : null,
      erschoepfung,
      verletzt: zufall() < 0.01,
    });
    if (tag >= 6) probe.push(form[i]);
  }
}
probe.sort((a, b) => a - b);
const mittel = probe.reduce((a, b) => a + b, 0) / probe.length;
const sd = Math.sqrt(probe.reduce((a, b) => a + (b - mittel) ** 2, 0) / probe.length);
const stufen: Record<string, number> = {};
for (const f of probe) {
  const s = String(formToStufe(f));
  stufen[s] = (stufen[s] ?? 0) + 1;
}
for (const k of Object.keys(stufen)) stufen[k] = Math.round((stufen[k] / probe.length) * 1000) / 10;
const pool = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = {
  hinweis:
    "Form: Monte-Carlo ueber die echte advancePlayerForm (400 Spieler, 32 Spieltage, Einsatz 55 %, Residuum-sd 0,19, ab Spieltag 6). Moral: echte gespeicherte Werte des Abbilds.",
  form: {
    mittel: Math.round(mittel * 10) / 10,
    sd: Math.round(sd * 10) / 10,
    stufenAnteilProzent: stufen,
    werte: probe.filter((_, i) => i % 40 === 0).map((v) => Math.round(v * 10) / 10),
  },
  morale: { quelle: pool.quelle, n: pool.n, werte: pool.morale },
};
writeFileSync("data/generated/form-moral-verteilung.json", JSON.stringify(out));
console.log("Form: mittel", out.form.mittel, "sd", out.form.sd, "Stufen %", JSON.stringify(stufen), "Stichprobe", out.form.werte.length);
