/**
 * MESSUNG FUER CHRIS' FRAGE: „was ist da das aktuelle? 40%? Könnte man zb auf 33 runter setzen"
 *
 * Gemessen an den ECHTEN Wuerfen des Live-Spielstands (`seasonState.injuryEvents`), nicht an der
 * Kurve allein. Die Kurve sagt nur, was bei welcher Ermuedung anliegt; erst die Verteilung sagt,
 * wie oft das ueberhaupt vorkommt.
 *
 * Zwei Bauarten eines Deckels stehen gegeneinander:
 *   A) Anker bei 100 von 40 auf 33 senken — die ganze Strecke 80..100 wird flacher.
 *   B) harter Deckel `min(33, kurve)` — unterhalb Ermuedung ~91,4 aendert sich NICHTS.
 */
import { createRequire } from "node:module";

import { getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";

const require_ = createRequire(import.meta.url);
const Database = require_("better-sqlite3");

const pfad = process.env.OLY_APP_SQLITE_PATH;
if (!pfad) throw new Error("OLY_APP_SQLITE_PATH fehlt");

const db = new Database(pfad, { readonly: true });

type Wurf = { fatigueBefore: number; riskPercent: number; result: string };

const zeilen = db
  .prepare(
    `SELECT s.save_id AS saveId, s.updated_at AS updatedAt, ss.payload_json AS payload
       FROM saves s JOIN season_states ss ON ss.save_id = s.save_id
      ORDER BY s.updated_at DESC`,
  )
  .all() as Array<{ saveId: string; updatedAt: string; payload: string }>;

let gewaehlt: { saveId: string; updatedAt: string; wuerfe: Wurf[] } | null = null;
for (const zeile of zeilen) {
  let d: any;
  try {
    d = JSON.parse(zeile.payload);
  } catch {
    continue;
  }
  const wuerfe: Wurf[] = (d?.injuryEvents ?? []).filter(
    (e: any) => typeof e?.fatigueBefore === "number" && typeof e?.riskPercent === "number",
  );
  // NUR ein Spielstand mit der HEUTIGEN Kurve taugt: aeltere tragen Risiken aus der Zeit vor der
  // Schutzzone (bei Ermuedung 9,4 standen dort 1,57 %). Sie zu mitteln hiesse, zwei verschiedene
  // Spiele in eine Zahl zu ruehren.
  const heutigeKurve = wuerfe.every(
    (w) => Math.abs(w.riskPercent - getInjuryRiskPercent(w.fatigueBefore)) < 0.05,
  );
  if (wuerfe.length > 0 && heutigeKurve && wuerfe.length > (gewaehlt?.wuerfe.length ?? 0)) {
    gewaehlt = { saveId: zeile.saveId, updatedAt: zeile.updatedAt, wuerfe };
  }
}

if (!gewaehlt) {
  console.log("Kein Spielstand mit der heutigen Risikokurve gefunden.");
  process.exit(0);
}

const { saveId, updatedAt, wuerfe } = gewaehlt;
console.log(`Spielstand ${saveId} (zuletzt ${updatedAt}) — ${wuerfe.length} aufbewahrte Wuerfe\n`);

/** A) Anker 100: 40 -> 33. Linear zwischen 80 (25 %) und 100 (33 %). */
function variantenA(f: number): number {
  const g = Math.max(0, Math.min(100, f));
  if (g <= 80) return getInjuryRiskPercent(g);
  return Number((25 + (33 - 25) * ((g - 80) / 20)).toFixed(2));
}

/** B) harter Deckel. */
function variantenB(f: number): number {
  return Math.min(33, getInjuryRiskPercent(f));
}

const summe = (f: (x: number) => number) =>
  wuerfe.reduce((s, w) => s + f(w.fatigueBefore), 0);

const heute = summe(getInjuryRiskPercent);
const a = summe(variantenA);
const b = summe(variantenB);
const echt = wuerfe.filter((w) => w.result === "injured").length;

console.log("ERWARTETE Verletzungen (Summe der Einzelrisiken / 100):");
console.log(`  heute (Anker 40)          ${(heute / 100).toFixed(1)}`);
console.log(`  A) Anker 33               ${(a / 100).toFixed(1)}   (${(((a - heute) / heute) * 100).toFixed(1)} %)`);
console.log(`  B) harter Deckel bei 33   ${(b / 100).toFixed(1)}   (${(((b - heute) / heute) * 100).toFixed(1)} %)`);
console.log(`  tatsaechlich eingetreten  ${echt}\n`);

console.log("WO STEHEN DIE WUERFE? (Ermuedung vor dem Spieltag)");
const stufen = [0, 25, 50, 65, 80, 85, 90, 95, 100.01];
for (let i = 0; i < stufen.length - 1; i += 1) {
  const von = stufen[i];
  const bis = stufen[i + 1];
  const menge = wuerfe.filter((w) => w.fatigueBefore >= von && w.fatigueBefore < bis);
  if (menge.length === 0) continue;
  const anteil = ((menge.length / wuerfe.length) * 100).toFixed(1);
  const verletzt = menge.filter((w) => w.result === "injured").length;
  const m = (f: (x: number) => number) => menge.reduce((s, w) => s + f(w.fatigueBefore), 0) / menge.length;
  console.log(
    `  ${String(von).padStart(3)}–${String(Math.floor(bis)).padStart(3)}  ${String(menge.length).padStart(5)} Wuerfe (${anteil.padStart(5)} %)  ` +
      `Risiko heute ${m(getInjuryRiskPercent).toFixed(2).padStart(5)} %  A ${m(variantenA).toFixed(2).padStart(5)} %  ` +
      `B ${m(variantenB).toFixed(2).padStart(5)} %  · ${verletzt} verletzt`,
  );
}

const hoechste = Math.max(...wuerfe.map((w) => w.fatigueBefore));
const grenze = 91.44;
const ueber = wuerfe.filter((w) => w.fatigueBefore > grenze).length;
console.log(`\nHoechste je gewuerfelte Ermuedung: ${hoechste.toFixed(1)}`);
console.log(
  `Wuerfe oberhalb der Stelle, an der die Kurve heute 33 % erreicht (Ermuedung ${grenze}): ` +
    `${ueber} von ${wuerfe.length} (${((ueber / wuerfe.length) * 100).toFixed(2)} %)`,
);
console.log(
  `Kurve heute: 50 -> ${getInjuryRiskPercent(50)} %, 65 -> ${getInjuryRiskPercent(65)} %, ` +
    `80 -> ${getInjuryRiskPercent(80)} %, 90 -> ${getInjuryRiskPercent(90)} %, 100 -> ${getInjuryRiskPercent(100)} %`,
);
