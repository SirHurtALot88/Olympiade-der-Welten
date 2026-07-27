/**
 * KARTENRAUM-AUDIT V2 — CLI.
 *
 * Erzeugt MEHRFACH komplette Angebotssaetze (32 Teams x 5 Angebote) ueber den echten
 * Erzeugungspfad des "Neues Spiel"-Knopfes und prueft JEDE Karte auf ihre tatsaechlichen
 * Betraege gegen die sechs Kriterien A-F (Definitionen und Schwellen: sponsor-v2-card-audit-core.ts).
 *
 * Aufruf:
 *   npx tsx scripts/sponsor-v2-card-audit.ts             # 5 Saetze = 800 Karten
 *   npx tsx scripts/sponsor-v2-card-audit.ts --seeds=10  # 10 Saetze
 *   npx tsx scripts/sponsor-v2-card-audit.ts --verbose   # zusaetzlich jede Karte als Zeile
 *
 * Exit-Code 0 nur, wenn ALLE Karten ALLER Saetze alle sechs Kriterien halten.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import {
  AUDIT_CHAMPION_BAND, AUDIT_GOAL_MAX_SHARE, AUDIT_LAST_PLACE_BAND, AUDIT_MAX_MULTIPLE_RATIO,
  AUDIT_MIN_LADDER_SPREAD_C, AUDIT_MIN_MODULE_EFFECT_C,
  generateAndMeasureSeed, type CriterionFail, type SeedAuditResult,
} from "./sponsor-v2-card-audit-core";

const args = process.argv.slice(2);
const seedCount = Number(args.find((a) => a.startsWith("--seeds="))?.split("=")[1] ?? 5) || 5;
const verbose = args.includes("--verbose");

const CRITERIA: Array<{ id: CriterionFail["criterion"]; label: string }> = [
  { id: "A", label: `Rangleiter nicht flach (Spreizung >= ${AUDIT_MIN_LADDER_SPREAD_C} C)` },
  { id: "B", label: `Sonderziel <= ${Math.round(AUDIT_GOAL_MAX_SHARE * 100)} % des Kartenwerts` },
  { id: "C", label: `Kein Modul tot (Klausel- und Zielwirkung >= ${AUDIT_MIN_MODULE_EFFECT_C} C)` },
  { id: "D", label: "Auszahlung ueber die Raenge monoton nicht-fallend" },
  { id: "E", label: `Kein Vielfaches innerhalb einer Rarity (max/min <= ${AUDIT_MAX_MULTIPLE_RATIO})` },
  { id: "F", label: `Baender: Meister [${AUDIT_CHAMPION_BAND.join("-")}], Platz 32 [${AUDIT_LAST_PLACE_BAND.join("-")}], Floors 35/37/39/42, Rarity monoton` },
];

const fmt = (v: number): string => v.toFixed(1);
const results: SeedAuditResult[] = [];

for (let i = 0; i < seedCount; i += 1) {
  const res = generateAndMeasureSeed(i);
  results.push(res);
  const s = res.stats;
  const champ = s.championPayouts.length
    ? `${fmt(Math.min(...s.championPayouts))}..${fmt(Math.max(...s.championPayouts))}`
    : "—";
  const last = s.lastPlacePayouts.length
    ? `${fmt(Math.min(...s.lastPlacePayouts))}..${fmt(Math.max(...s.lastPlacePayouts))}`
    : "—";
  console.log(`\n━━ Satz ${i + 1}/${seedCount} (Seed ${res.seed}) — ${res.cards.length} Karten · Liga-K ${s.k.toFixed(3)} ━━`);
  console.log(`   Meister nominal/rarity-normiert (Spitzenteams): ${champ} C · Platz 32 nominal (Kellerteams): ${last} C`);
  console.log(`   Sonderziel-Anteil max: ${(s.goalShareMax * 100).toFixed(1)} % · kleinste Spreizung: ${fmt(s.spreadMin)} C`);
  console.log(`   Ø Kartenwert je Rarity: ${Object.entries(s.rarityMeans).map(([r, v]) => `${r} ${fmt(v)}`).join(" · ")}`);
  console.log(`   Untergrenze je Rarity (min): ${Object.entries(s.rarityFloorMin).map(([r, v]) => `${r} ${fmt(v)}`).join(" · ")}`);
  if (verbose) {
    for (const c of res.cards) {
      console.log(
        `   ${c.teamId}\tER${String(c.expectedRank).padStart(2)}\t${c.rarity}\t${c.curveName}\t${c.profileName}\t` +
        `Leiter ${fmt(c.guaranteedBottom)}..${fmt(c.guaranteedTop)} (Δ${fmt(c.spread)})\t` +
        `Klausel ${fmt(c.clauseDelta)}\tZiel ${fmt(c.goalDelta)} (${(c.goalShare * 100).toFixed(0)} %)\tWert ${fmt(c.cardValue)}`,
      );
    }
  }
}

console.log(`\n━━━━ ERGEBNIS ueber ${seedCount} Saetze = ${results.reduce((a, r) => a + r.cards.length, 0)} Karten ━━━━`);
let totalFails = 0;
for (const { id, label } of CRITERIA) {
  const fails = results.flatMap((r) => r.fails.filter((f) => f.criterion === id));
  totalFails += fails.length;
  console.log(`${fails.length === 0 ? "✔" : "✘"} ${id} ${label}: ${fails.length} Verstoesse`);
  for (const f of fails.slice(0, 8)) console.log(`    · [${results.find((r) => r.fails.includes(f))?.seed}] ${f.detail}`);
  if (fails.length > 8) console.log(`    · … und ${fails.length - 8} weitere`);
}

if (totalFails > 0) {
  console.log(`\nGESAMT: ${totalFails} Verstoesse — der Kartenraum haelt die Vorgaben NICHT.`);
  process.exit(1);
}
console.log("\nGESAMT: 0 Verstoesse — jede erzeugte Karte haelt alle sechs Kriterien.");
