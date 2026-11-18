/* eslint-disable no-console */
/**
 * Rechenbeispiel fuer die Optionen in docs/design/ki-kaufverhalten-analyse-18-11.md Abschnitt 7.1:
 * Was waere, wenn die Teams nach dem Draft einen Anteil des Budgets als Cash behielten? Annahme (klar
 * als Hochrechnung): Gehalt waechst proportional zur Draft-Ausgabe (gemessen: Gehalt = 0,27 x Budget,
 * Gehalt/Marktwert = 0,277). Sponsor bleibt unveraendert (haengt am Startrang, nicht am Kader).
 *   node scripts/rechne-ruecklagenkurve-18-11.mjs   (liest data/generated/ki-kaufverhalten-auswertung-18-11.json)
 */
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("data/generated/ki-kaufverhalten-auswertung-18-11.json", "utf8"));
const kl = Object.fromEntries(d.klassen.map((r) => [`${r.liga}|${r.klasse}`, r]));
const gs = Object.fromEntries(d.gehaltVsSponsor.nachLigaKlasse.map((r) => [`${r.liga}|${r.klasse}`, r]));
const ziel = { reich: 0.2, mittel: 0.12, arm: 0.07 };
const rows = [];
for (const [k, r] of Object.entries(kl)) {
  const g = gs[k];
  const b = r.budgetMittel, c = r.draftCashMed, spend = b - c;
  const z = ziel[r.klasse], cz = b * z, f = (b - cz) / spend;
  const gn = g.gehaltMed * f;
  rows.push({ liga: r.liga, klasse: r.klasse, budget: b, cashIst: c, cashIstPct: Math.round((c / b) * 1000) / 10, gehaltIst: g.gehaltMed, sponsor: g.sponsorMed, sponsorZuGehaltIst: g.ratioMed, zielPct: z * 100, cashZiel: Math.round(cz * 10) / 10, gehaltNeu: Math.round(gn * 10) / 10, sponsorZuGehaltNeu: Math.round((g.sponsorMed / gn) * 100) / 100, cashZuGehaltNeu: Math.round((cz / gn) * 100) / 100 });
}
console.table(rows);
