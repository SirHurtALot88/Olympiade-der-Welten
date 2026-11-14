// ===================================================================================
// POOLEN MEHRERER EINFLUSS-STROEME — die abnahmefaehige Pp-Zahl fuer verrauschte Disziplinen.
//
//   node scripts/poole-arena-einfluss.mjs strom0.json strom1e7.json strom2e7.json
//
// Eingabe sind die Dateien, die `scripts/messe-arena-einfluss.mjs ... --rohdaten=<datei>`
// schreibt (je ein Saatstrom). Gepoolt wird ueber die ROHEN Attributgewinne, nicht ueber die
// Anteile: je Attribut der nach Laufzahl gewichtete Mittelwert der Gewinne ueber alle Stroeme
// (bei gleichem n = einfacher Mittelwert), danach dieselbe Rechnung wie in einflussVon()
// (battle-mode.engine.js): negative Gewinne zaehlen als 0, Anteil = Gewinn / Summe der
// positiven Gewinne, Pp = Summe |Anteil - Matrixgewicht| ueber alle zwoelf Attribute.
//
// Warum: bei Hockey liegt der Rauschboden eines einzelnen n=48-Stroms bei 35-40 Pp, ueber der
// Schranke auch bei perfekter Mechanik; erst drei gepoolte Stroeme (n=144) bringen ihn auf ~22
// (docs/design/hockey-pp-messbasis-10-11.md Abschnitt 3 und 4). Abnahme-relevant ist dann die
// gepoolte Zahl; die Einzelzahlen werden mit ausgegeben.
//
// Zusatzspalte "ueber Matrix": die harte Obergrenze aus Chris' Rezeptregel (10.11.) — kein
// Attribut darf einen hoeheren Anteil tragen als sein Matrixgewicht. Positive Werte dort sind
// Verstoesse, aufgefuehrt mit ihrem Standardfehler aus der Streuung zwischen den Stroemen.
// ===================================================================================
import { readFileSync } from "node:fs";

const dateien = process.argv.slice(2);
if (!dateien.length) {
  console.error("Aufruf: node scripts/poole-arena-einfluss.mjs <rohdaten.json> [weitere ...]");
  process.exit(1);
}
const stroeme = dateien.map((d) => ({ datei: d, ...JSON.parse(readFileSync(d, "utf8")) }));
const disziplinen = new Set(stroeme.map((s) => s.disziplin));
if (disziplinen.size > 1) {
  console.error(`Verschiedene Disziplinen gemischt: ${[...disziplinen].join(", ")}`);
  process.exit(1);
}
const dateienGemessen = new Set(stroeme.map((s) => s.datei));
const versaetze = stroeme.map((s) => s.saatVersatz);
if (new Set(versaetze).size < versaetze.length)
  console.warn("WARNUNG: mindestens zwei Stroeme haben denselben Saatversatz — sie sind nicht unabhaengig.\n");

const matrix = stroeme[0].matrix || {};
const ATTRIBUTE = ["power", "health", "speed", "spirit", "stamina", "torment",
  "awareness", "determination", "dexterity", "will", "intelligence", "charisma"];
const gewinnVon = (s, at) => (s.reihen.find((r) => r.attribut === at) || { gewinn: 0 }).gewinn;
const nGesamt = stroeme.reduce((a, s) => a + s.laeufe, 0);

function anteileAus(gewinne) {
  const summe = Object.values(gewinne).reduce((a, g) => a + Math.max(0, g), 0) || 1;
  const anteile = {};
  for (const at of ATTRIBUTE) anteile[at] = Math.max(0, gewinne[at] || 0) / summe * 100;
  const pp = ATTRIBUTE.reduce((a, at) => a + Math.abs(anteile[at] - (matrix[at] || 0)), 0);
  return { summe, anteile, pp };
}

const gepoolt = {};
for (const at of ATTRIBUTE)
  gepoolt[at] = stroeme.reduce((a, s) => a + gewinnVon(s, at) * s.laeufe, 0) / nGesamt;
const pool = anteileAus(gepoolt);
const einzeln = stroeme.map((s) => anteileAus(Object.fromEntries(ATTRIBUTE.map((at) => [at, gewinnVon(s, at)]))));

// Standardfehler des gepoolten Anteils aus der Streuung der Einzelanteile zwischen den Stroemen
// (grob, nur bei >= 2 Stroemen sinnvoll).
const seVon = (at) => {
  if (stroeme.length < 2) return null;
  const xs = einzeln.map((e) => e.anteile[at]);
  const m = xs.reduce((a, x) => a + x, 0) / xs.length;
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v / xs.length);
};

const f = (x, d = 1) => x.toFixed(d).replace(".", ",");
console.log(`${stroeme[0].disziplin} — ${stroeme.length} Stroeme, n gesamt ${nGesamt}`);
for (const [i, s] of stroeme.entries())
  console.log(`  Strom ${i + 1}: Saatversatz ${s.saatVersatz}, n=${s.laeufe}, Pp ${f(einzeln[i].pp)}, `
    + `Summe pos. Gewinne ${f(einzeln[i].summe, 3)}, Seitenfehler ${s.seitenfehler ?? "?"}`);
if (dateienGemessen.size > 1) console.warn("WARNUNG: die Stroeme haben verschiedene Mockup-Dateien gemessen.");
console.log(`  gemessene Datei: ${[...dateienGemessen].join(" | ")}`);
console.log(`\nGEPOOLT: Abweichung zur Matrix ${f(pool.pp)} Pp (Summe pos. Gewinne ${f(pool.summe, 3)})\n`);
console.log("Attribut        Gewinn   Anteil  Matrix  Differenz  ueber Matrix   SE   " + stroeme.map((_, i) => `S${i + 1}`.padStart(6)).join(""));
const verstoesse = [];
for (const at of [...ATTRIBUTE].sort((a, b) => (matrix[b] || 0) - (matrix[a] || 0))) {
  const soll = matrix[at] || 0, ist = pool.anteile[at], diff = ist - soll, se = seVon(at);
  if (diff > 0.05) verstoesse.push({ at, diff, se });
  console.log(`${at.padEnd(15)} ${f(gepoolt[at], 3).padStart(6)}  ${f(ist).padStart(6)}  ${String(soll).padStart(6)}  `
    + `${((diff > 0 ? "+" : "") + f(diff)).padStart(9)}  ${(diff > 0.05 ? "+" + f(diff) : "").padStart(12)}  `
    + `${se == null ? "  -" : f(se).padStart(4)}  ${einzeln.map((e) => f(e.anteile[at]).padStart(6)).join("")}`);
}
console.log(verstoesse.length
  ? `\nUeber Matrixgewicht (Obergrenze verletzt): ${verstoesse.map((v) => `${v.at} +${f(v.diff)}`
    + (v.se != null ? ` (${f(v.diff / Math.max(v.se, 1e-9))} SE)` : "")).join(", ")}`
  : "\nKein Attribut ueber seinem Matrixgewicht.");
