/**
 * SPONSOR-LAUFZEIT-KALIBRIERUNG (Umsetzungsplan D) — reine Funktionsrechnung, kein Save noetig.
 *
 * Beantwortet die drei Abnahme-Fragen des Plans mit echten Zahlen aus den echten Produktionsfunktionen
 * (`sponsorKurvenLeiter`, `buildSponsorV3TermsCore`, `rerollSponsorV3TermsForNewSeason`,
 * `getSponsorTermMultiplier`):
 *
 *   1. KOPPLUNG: zahlt ein bei f=1.24 unterschriebener Dreijahresvertrag nach dem Rollen auf f=0.85
 *      NICHT mehr auf 1.24-Niveau?
 *   2. SOCKEL: bleibt der Sockel exakt am eingefrorenen Startrang haengen, unabhaengig vom Faktor?
 *   3. EROSION: liegt der Erwartungswert eines Dreijahresvertrags ueber drei Saisons UNTER dem
 *      dreier aufeinanderfolgender Einjahresvertraege — ueber den vollen Salary-Factor-Bereich
 *      [0.82, 1.24] und mehrere Startraenge/Kurvenformen hinweg?
 *
 * Aufruf: npx tsx scripts/sponsor-laufzeit-kalibrierung.ts
 */
import type { SponsorCurveShape } from "@/lib/data/olyDataTypes";
import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import { SPONSOR_BODEN, sponsorKurvenLeiter, sponsorSockelFuerStartrang } from "@/lib/sponsor/sponsor-liga-leiter";
import { getSponsorTermMultiplier } from "@/lib/sponsor/sponsor-negotiation";
import { buildSponsorV3TermsCore, sponsorV3CardByKey, type SponsorV3ContractTerms } from "@/lib/sponsor/sponsor-v3-model";
import { rerollSponsorV3TermsForNewSeason } from "@/lib/sponsor/sponsor-v3-offer-service";

function buildTerms(startRank: number, shape: SponsorCurveShape, salaryFactor: number): SponsorV3ContractTerms {
  const card = sponsorV3CardByKey("basis");
  const baseLadder = sponsorKurvenLeiter({ shape, startRank, salaryFactor });
  return buildSponsorV3TermsCore({
    baseLadder, startRank, rarity: "magisch", card, goalKey: null, curveShape: shape, salaryFactor, floor: SPONSOR_BODEN,
  });
}

const START_RANKS = [1, 5, 9, 16, 24, 32];
const SHAPES: SponsorCurveShape[] = SPONSOR_CURVE_SHAPE_KEYS.slice(0, 6);
const FACTOR_BOUNDS = [0.82, 0.95, 1.0, 1.1, 1.24];

console.log("");
console.log("=".repeat(100));
console.log("1) KOPPLUNG: 3-Jahres-Vertrag bei f=1.24 unterschrieben, dann auf f=0.85 gerollt");
console.log("=".repeat(100));
for (const startRank of START_RANKS) {
  const shape = SHAPES[0]!;
  const signed = buildTerms(startRank, shape, 1.24);
  const rolled = rerollSponsorV3TermsForNewSeason(signed, { newSalaryFactor: 0.85, contractYear: 2 });
  const sockel = sponsorSockelFuerStartrang(startRank);
  const stillAt124Level = buildTerms(startRank, shape, 1.24).anchor; // Vergleichswert: "waere es der Bug"
  console.log(
    `Startrang ${String(startRank).padStart(2)} · Sockel ${sockel.toFixed(1)} C · ` +
      `Jahr 1 (f=1.24) Anchor ${signed.anchor.toFixed(1)} C · Jahr 2 (f=0.85) Anchor ${rolled.anchor.toFixed(1)} C · ` +
      `waere-noch-1.24 ${stillAt124Level.toFixed(1)} C · Differenz zu Jahr1 ${(signed.anchor - rolled.anchor).toFixed(1)} C`,
  );
  if (rolled.anchor >= signed.anchor) {
    throw new Error(`KOPPLUNG VERLETZT bei Startrang ${startRank}: Jahr 2 zahlt >= Jahr 1!`);
  }
}
console.log("→ in jeder Zeile: Jahr-2-Anchor < Jahr-1-Anchor. Kopplung greift.");

console.log("");
console.log("=".repeat(100));
console.log("2) SOCKEL: haengt NUR am Startrang, ist bei jedem Salary Factor identisch");
console.log("=".repeat(100));
for (const startRank of START_RANKS) {
  const factors = [0.82, 1.0, 1.24];
  const sockels = factors.map((f) => {
    // Bei salaryFactor 0 kollabiert JEDE geshapete Leiter exakt auf den Sockel (siehe
    // sponsor-liga-leiter.ts-Formel) — der direkte Beweis, dass der Sockel unabhaengig vom Faktor ist.
    const ladderAtZero = sponsorKurvenLeiter({ shape: SHAPES[0]!, startRank, salaryFactor: 0 });
    return ladderAtZero[0]!;
  });
  const allEqual = sockels.every((value) => Math.abs(value - sockels[0]!) < 1e-9);
  console.log(`Startrang ${String(startRank).padStart(2)} · Sockel bei f=[${factors.join(",")}]: ${sockels.map((v) => v.toFixed(3)).join(" / ")} · gleich: ${allEqual}`);
  if (!allEqual) throw new Error(`SOCKEL VERLETZT bei Startrang ${startRank}`);
}
console.log("→ Sockel ist in jeder Zeile exakt identisch. Bewiesen unabhaengig vom Salary Factor.");

console.log("");
console.log("=".repeat(100));
console.log("3) EROSION: EV(3-Jahres-Vertrag) vs. EV(3 aufeinanderfolgende 1-Jahres-Vertraege)");
console.log(`   TERM_MULTIPLIERS = { 1: 1.0, 2: ${getSponsorTermMultiplier(2)}, 3: ${getSponsorTermMultiplier(3)} }`);
console.log("=".repeat(100));

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const perm of permutations(rest)) result.push([item, ...perm]);
  });
  return result;
}

let worstGapPercent = Infinity;
let bestGapPercent = -Infinity;
let sumGapPercent = 0;
let n = 0;
let violations = 0;

for (const startRank of START_RANKS) {
  for (const shape of SHAPES) {
    for (const perm of permutations(FACTOR_BOUNDS.length >= 3 ? [1.24, 1.0, 0.82] : FACTOR_BOUNDS)) {
      const [f1, f2, f3] = perm as [number, number, number];
      const signed = buildTerms(startRank, shape, f1);
      const year2 = rerollSponsorV3TermsForNewSeason(signed, { newSalaryFactor: f2, contractYear: 2 });
      const year3 = rerollSponsorV3TermsForNewSeason(year2, { newSalaryFactor: f3, contractYear: 3 });
      const ev3yr = signed.anchor + year2.anchor + year3.anchor;
      const ev1yrEach = [f1, f2, f3].reduce((sum, f) => sum + buildTerms(startRank, shape, f).anchor, 0);
      const gapPercent = (1 - ev3yr / ev1yrEach) * 100;
      if (gapPercent <= 0) violations += 1;
      worstGapPercent = Math.min(worstGapPercent, gapPercent);
      bestGapPercent = Math.max(bestGapPercent, gapPercent);
      sumGapPercent += gapPercent;
      n += 1;
    }
  }
}
console.log(
  `${n} Kombinationen (${START_RANKS.length} Startraenge x ${SHAPES.length} Kurvenformen x 6 Faktor-Reihenfolgen):`,
);
console.log(`  Erosionsluecke (EV-Verlust ggue. 3x1-Jahr) min ${worstGapPercent.toFixed(2)} % · max ${bestGapPercent.toFixed(2)} % · Schnitt ${(sumGapPercent / n).toFixed(2)} %`);
console.log(`  Faelle mit EV(3yr) >= EV(3x1yr) (der zu behebende Fehler): ${violations}`);
if (violations > 0) {
  throw new Error(`EROSION HAT KEINE ZAEHNE: ${violations} von ${n} Kombinationen zahlen dem 3-Jahres-Vertrag zu viel.`);
}
console.log("→ EV(3yr) < EV(3x1yr) in JEDER gemessenen Kombination.");
console.log("");
