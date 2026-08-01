/**
 * SZENARIO-RECHNUNG SPONSOR V3 vs. PREISGELD-BENCHMARK — reine Analyse, kein Produktivcode.
 *
 * Fragestellung: wo landen Top/Mid/Bottom mit dem neuen Sponsorsystem, bei Gehaltsfaktor
 * 1,2 / 1,0 / 0,8 — und wie verhaelt sich das zum Preisgeld-System?
 *
 * Gerechnet wird mit den ECHTEN Produktionsfunktionen (`buildPrizeMoneyTable`,
 * `getPrizePlacementBonus`, `buildSponsorV3TermsCore`, `sponsorV3Settle`) auf den 32 ECHTEN
 * Gehaeltern des Live-Saves (Fixture aus #291). Keine nachgebaute Formel, keine erfundenen Zahlen.
 *
 * Aufruf: npx tsx scripts/sponsor-v3-szenarien.ts
 */
import { buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";
import {
  SPONSOR_V3_CARDS,
  buildSponsorV3TermsCore,
  sponsorV3ExpectedPayout,
  sponsorV3GoalProbability,
  sponsorV3IsGoalOfferable,
  sponsorV3LadderValue,
  sponsorV3Settle,
  type SponsorV3Rarity,
} from "@/lib/sponsor/sponsor-v3-model";
import { SPONSOR_V3_FLOOR_C } from "@/lib/sponsor/sponsor-v3-offer-service";
import { SPONSOR_LIVE_SAVE_S1_TEAMS } from "../tests/_fixtures/sponsor-live-save-s1.fixture";

const SALARY_FACTORS = [1.2, 1.0, 0.8] as const;
const RARITY: SponsorV3Rarity = "magisch"; // mittlere Seltenheit — Rarity skaliert nur den Hebel
/** Sonderziel mittlerer Schwierigkeit, das fuer ALLE drei Staerkeklassen angeboten wird. */
const GOAL_KEY = "axis_ascension";

const salaries = SPONSOR_LIVE_SAVE_S1_TEAMS.map((team) => team.salary);
const salarySum = salaries.reduce((a, b) => a + b, 0);
const fmt = (value: number) => (value >= 0 ? "+" : "") + value.toFixed(1);
const pad = (text: string, width: number) => text.padEnd(width);
const padL = (text: string, width: number) => text.padStart(width);

/** Drei echte Teams des Live-Saves als Vertreter — mit ihrem ECHTEN Gehalt fuer die Netto-Sicht. */
const SPOTS = ["M-M", "V-D", "R-R"].map((code, index) => {
  const team = SPONSOR_LIVE_SAVE_S1_TEAMS.find((entry) => entry.code === code)!;
  return { label: (["TOP", "MID", "BOT"] as const)[index]!, team };
});

/** Was der Endrang wirklich wird — drei Verlaeufe je Startposition. */
const OUTCOMES = [
  { label: "wie erwartet", delta: 0 },
  { label: "5 Plaetze besser", delta: -5 },
  { label: "5 Plaetze schlechter", delta: +5 },
] as const;

const clampRank = (rank: number) => Math.min(32, Math.max(1, rank));

console.log("");
console.log(`SPONSOR V3 vs. PREISGELD-BENCHMARK — 32 echte Teams des Live-Saves, Gehaltssumme ${salarySum.toFixed(0)} C`);
console.log(`Rarity: ${RARITY} · Sonderziel: ${GOAL_KEY} · Untergrenze: ${SPONSOR_V3_FLOOR_C} C`);
console.log("");

for (const factor of SALARY_FACTORS) {
  const rows = buildPrizeMoneyTable(salaries, factor);
  const byRank = new Map(rows.map((row) => [row.rank, row.totalPrizeMoney] as const));
  const prizeCurve = Array.from({ length: 32 }, (_, index) => byRank.get(index + 1) ?? 0);

  console.log("=".repeat(126));
  console.log(
    `GEHALTSFAKTOR ${factor.toFixed(1)}  —  Benchmark-Topf gesamt ${prizeCurve.reduce((a, b) => a + b, 0).toFixed(0)} C` +
      `  (Rang 1: ${prizeCurve[0]!.toFixed(1)} C · Rang 32: ${prizeCurve[31]!.toFixed(1)} C)`,
  );
  console.log("=".repeat(126));

  for (const spot of SPOTS) {
    const startRank = spot.team.startRank;
    const terms = SPONSOR_V3_CARDS.map((card) =>
      buildSponsorV3TermsCore({
        prizeCurve,
        placementBonus: getPrizePlacementBonus,
        startRank,
        rarity: RARITY,
        card,
        goalKey: card.goal ? GOAL_KEY : null,
        salaryFactor: factor,
        floor: SPONSOR_V3_FLOOR_C,
      }),
    );
    const goalP = sponsorV3GoalProbability(GOAL_KEY, startRank);
    const offerable = sponsorV3IsGoalOfferable(GOAL_KEY, startRank);

    console.log("");
    console.log(
      `  ${spot.label}  ${spot.team.code}  Startrang ${startRank} · Gehalt ${spot.team.salary.toFixed(1)} C · ` +
        `Ziel-p ${(goalP * 100).toFixed(0)} %${offerable ? "" : " (NICHT angeboten)"}`,
    );
    console.log(
      "  " + pad("Ausgang", 22) + padL("BENCHMARK", 11) + SPONSOR_V3_CARDS.map((card) => padL(card.name, 17)).join(""),
    );

    for (const outcome of OUTCOMES) {
      const finalRank = clampRank(startRank + outcome.delta);
      // Preisgeld-Benchmark: Preisgeld am Endrang + Platzierungsbonus (Start vs. Ende).
      const benchmark = prizeCurve[finalRank - 1]! + getPrizePlacementBonus(startRank - finalRank);
      const cells = terms.map((term) => {
        // Erwartungswert am Endrang: der Kurventeil (die Sonderziel-Lotterie ist EV-neutral).
        const value = sponsorV3LadderValue(term, finalRank);
        return padL(`${value.toFixed(1)} (${fmt(value - benchmark)})`, 17);
      });
      console.log("  " + pad(`${outcome.label} (${finalRank})`, 22) + padL(benchmark.toFixed(1), 11) + cells.join(""));
    }

    // Die Sonderziel-Lotterie: was das Ziel verfehlt/erreicht am ERWARTETEN Endrang bedeutet.
    const goalCells = terms.map((term) => {
      if (term.goalSize <= 0) return padL("—", 17);
      const miss = sponsorV3Settle(term, startRank, 0);
      const hit = sponsorV3Settle(term, startRank, 1);
      return padL(`${miss.toFixed(1)} / ${hit.toFixed(1)}`, 17);
    });
    console.log("  " + pad("Ziel verfehlt / erfuellt", 22) + padL("—", 11) + goalCells.join(""));

    // Netto am Saisonende: Sponsor minus Jahresgehalt dieses Teams.
    const netCells = terms.map((term) =>
      padL(fmt(sponsorV3LadderValue(term, startRank) - spot.team.salary), 17));
    const netBenchmark = prizeCurve[startRank - 1]! - spot.team.salary;
    console.log("  " + pad("NETTO (− Gehalt)", 22) + padL(fmt(netBenchmark), 11) + netCells.join(""));

    // Erwartungswert der Karte bei Unterschrift (der eingefrorene Anker A) — identisch fuer alle Karten.
    const evs = terms.map((term) => sponsorV3ExpectedPayout(term).toFixed(1)).join(" / ");
    console.log(`  Erwartungswert bei Unterschrift (alle Karten gleich): ${evs}`);
  }
  console.log("");
}

console.log("Lesehilfe: erste Zahl = Auszahlung in C, in Klammern die Differenz zum Preisgeld-Benchmark.");
console.log("Die Karten-Spalten zeigen den Kurventeil; die Sonderziel-Lotterie steht in der eigenen Zeile.");
console.log("");
