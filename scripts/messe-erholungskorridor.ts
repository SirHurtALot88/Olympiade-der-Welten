/**
 * DER ERHOLUNGSKORRIDOR — Fatigue-Plan PR2 (`docs/design/fatigue-saisonlaenge-plan.md` Teil D,
 * B.6, E.1): Verletzungen je Saison für 10 UND 20 Spieltage, jeweils OHNE und MIT aktiver
 * Erholung, über die ECHTE Produktionsfunktion.
 *
 * WAS GEMESSEN WIRD. Dieselbe Basisfall-Liga wie `tests/injury-basisfall-korridor.test.ts`
 * (32 Kader mit den am Live-Spielstand gemessenen Größen 8–14, keine Gebäude, keine Traits,
 * Intensität „normal", Rotation „niedrigste Fatigue zuerst"), aber
 *
 *   - die Slot-Anforderungen je Spieltag kommen aus dem ECHTEN Spielplan-Generator
 *     (`buildSeasonSeededDisciplineSchedule`, `repeat: 1` = 10 Spieltage, `repeat: 2` = 20
 *     Spieltage mit Derangement der Kadergrößen) über mehrere Saaten — statt einer einzigen,
 *     getippten 10er-Liste. Die getippte Liste des Korridor-Tests läuft als eigene Zeile mit, damit
 *     die Zahlen an den Test anschließen;
 *   - jeder Spieltag läuft über `applyFatigueAndInjuryAfterMatchday` (Last, Erholung, Wurf — exakt
 *     der Spielpfad) und optional über `accumulateMatchdayTrainingProgress` (die Trainingsschicht,
 *     Modus „mittel"; sie skaliert über `matchdayIds.length` und ist damit je Saison gleich groß).
 *
 * Die aktive Erholung wird über den Schalter `OLY_FATIGUE_ACTIVE_RECOVERY` (explizit „0"/„1") je
 * Szenario umgelegt — der Schalter wird je Aufruf gelesen, beide Welten laufen im selben Prozess.
 * Die ZAHLEN (Last, Erholung, aktiver Anteil) sind Modulkonstanten; wer sie sweepen will, startet
 * das Skript je Wert neu, z. B.
 *
 *   OLY_FATIGUE_ACTIVE_RECOVERY_VALUE=8 npx tsx scripts/messe-erholungskorridor.ts
 *
 * Optionen:
 *   --saaten=N            Spielplan-Saaten je Saisonlänge (Default 8)
 *   --training            zusätzlich die Trainingsschicht (Modus „mittel") mitrechnen
 *   --stamm=A|B|…         Saatstamm (Default A) — zwei Stämme = zwei unabhängige Ziehungen
 *   --json=<pfad>         Rohdaten als JSON schreiben
 */
import fs from "node:fs";

import {
  BASE_MATCHDAY_RECOVERY,
  MATCHDAY_ACTIVE_RECOVERY,
  MATCHDAY_FATIGUE_LOAD,
} from "@/lib/fatigue/fatigue-injury-service";
import {
  dauerstarter,
  KORRIDOR_TEST_SLOTS,
  runKorridorSeason,
  slotsFromRealSchedule,
  type Slots,
} from "@/lib/fatigue/erholungskorridor-simulation";

const args = process.argv.slice(2);
const argValue = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const SAATEN = Math.max(1, Number(argValue("saaten") ?? 8));
const MIT_TRAINING = args.includes("--training");
const JSON_PFAD = argValue("json");
/** Saatstamm: zwei unabhängige Stämme (Default „A"), wie bei den Pp-Abnahmen des Projekts. */
const STAMM = argValue("stamm") ?? "A";

function withFlag<T>(on: boolean, run: () => T): T {
  const previous = process.env.OLY_FATIGUE_ACTIVE_RECOVERY;
  process.env.OLY_FATIGUE_ACTIVE_RECOVERY = on ? "1" : "0";
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.OLY_FATIGUE_ACTIVE_RECOVERY;
    else process.env.OLY_FATIGUE_ACTIVE_RECOVERY = previous;
  }
}

const fmt = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

console.log("═══ Stellschrauben (wie im Code, ENV-tunebar) ═══");
console.log(`  Last je Einsatz (normal)        ${MATCHDAY_FATIGUE_LOAD}`);
console.log(`  Erholung Bank/verletzt          ${BASE_MATCHDAY_RECOVERY}`);
console.log(`  davon aktiv (auch für Einsatz)  ${MATCHDAY_ACTIVE_RECOVERY}`);
console.log(`  Netto je Einsatz, Schalter AN   +${fmt(MATCHDAY_FATIGUE_LOAD - MATCHDAY_ACTIVE_RECOVERY)}`);
console.log(`  Saaten je Saisonlänge           ${SAATEN} (Stamm ${STAMM})`);
console.log(`  Trainingsschicht „mittel"       ${MIT_TRAINING ? "JA" : "nein (Basisfall wie im Korridor-Test)"}\n`);

console.log(`═══ Dauerstarter (analytisch, jeder Spieltag „normal", ohne Ausfall) ═══`);
console.log("Spieltage  Schalter  Spieltage ≥80  erste Kappung  erw. Verletzungen");
for (const matchdays of [10, 20]) {
  for (const on of [false, true]) {
    const d = dauerstarter(matchdays, on ? MATCHDAY_ACTIVE_RECOVERY : 0);
    console.log(
      `${String(matchdays).padStart(9)}  ${(on ? "AN" : "AUS").padEnd(8)}  ${`${d.maxRiskDays} von ${matchdays}`.padStart(13)}  ${String(d.firstCapDay ?? "—").padStart(13)}  ${fmt(d.expectedInjuries, 2).padStart(17)}`,
    );
  }
}
console.log("");

type Scenario = { label: string; matchdays: number; on: boolean; plans: Array<{ seed: string; slots: Slots }> };

// Spielplan-Saat und Wurf-Saat (saveId) kommen aus demselben Stamm; Stamm B teilt mit Stamm A
// keine einzige Saat. 10 und 20 Spieltage nutzen dieselben Saaten — gepaarter Vergleich.
const saat = (i: number) => (STAMM === "A" ? `korridor-saat-${i + 1}` : `korridor-${STAMM}-saat-${i + 1}`);
const plans10 = Array.from({ length: SAATEN }, (_, i) => ({ seed: saat(i), slots: slotsFromRealSchedule(saat(i), 1) }));
const plans20 = Array.from({ length: SAATEN }, (_, i) => ({ seed: saat(i), slots: slotsFromRealSchedule(saat(i), 2) }));
const planKorridorTest = [1, 2, 3, 4, 5].map((i) => ({ seed: `seed-${i}`, slots: KORRIDOR_TEST_SLOTS }));

const scenarios: Scenario[] = [
  { label: "Korridor-Test-Slots", matchdays: 10, on: false, plans: planKorridorTest },
  { label: "Korridor-Test-Slots", matchdays: 10, on: true, plans: planKorridorTest },
  { label: "echter Spielplan", matchdays: 10, on: false, plans: plans10 },
  { label: "echter Spielplan", matchdays: 10, on: true, plans: plans10 },
  { label: "echter Spielplan", matchdays: 20, on: false, plans: plans20 },
  { label: "echter Spielplan", matchdays: 20, on: true, plans: plans20 },
];

console.log("═══ Basisfall-Liga (32 Teams, Rotation niedrigste Fatigue zuerst) ═══");
console.log(
  "Slots                 MD  Schalter  Verletzungen/Saison (Ø · min–max)   1. Hälfte  2. Hälfte  Würfe ≥80  Ø-Fatigue Mitte/Ende  Teams Engpass",
);
const raw: Array<Record<string, unknown>> = [];
for (const scenario of scenarios) {
  const results = withFlag(scenario.on, () => scenario.plans.map((plan) => runKorridorSeason(plan.seed, plan.slots, { mitTraining: MIT_TRAINING })));
  const totals = results.map((r) => r.injuries);
  const half = Math.floor(scenario.matchdays / 2);
  const firstHalf = mean(results.map((r) => r.injuriesByMatchday.slice(0, half).reduce((s, v) => s + v, 0)));
  const secondHalf = mean(results.map((r) => r.injuriesByMatchday.slice(half).reduce((s, v) => s + v, 0)));
  const share80 = mean(results.map((r) => r.rollsAt80Plus / Math.max(1, r.rolls))) * 100;
  console.log(
    `${scenario.label.padEnd(20)}  ${String(scenario.matchdays).padStart(2)}  ${(scenario.on ? "AN" : "AUS").padEnd(8)}  ${`${fmt(mean(totals))} · ${Math.min(...totals)}–${Math.max(...totals)}`.padStart(33)}  ${fmt(firstHalf).padStart(9)}  ${fmt(secondHalf).padStart(9)}  ${`${fmt(share80)} %`.padStart(9)}  ${`${fmt(mean(results.map((r) => r.avgFatigueMid)))} / ${fmt(mean(results.map((r) => r.avgFatigueEnd)))}`.padStart(20)}  ${fmt(mean(results.map((r) => r.teamsWithLineupShortfall))).padStart(13)}`,
  );
  raw.push({
    label: scenario.label,
    matchdays: scenario.matchdays,
    activeRecovery: scenario.on,
    totals,
    meanTotal: mean(totals),
    firstHalf,
    secondHalf,
    shareRollsAt80PlusPct: share80,
    avgFatigueMid: mean(results.map((r) => r.avgFatigueMid)),
    avgFatigueEnd: mean(results.map((r) => r.avgFatigueEnd)),
    injuriesByMatchday: results.map((r) => r.injuriesByMatchday),
  });
}

if (JSON_PFAD) {
  fs.writeFileSync(
    JSON_PFAD,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        config: {
          load: MATCHDAY_FATIGUE_LOAD,
          recovery: BASE_MATCHDAY_RECOVERY,
          activeRecovery: MATCHDAY_ACTIVE_RECOVERY,
          seeds: SAATEN,
          stamm: STAMM,
          training: MIT_TRAINING,
        },
        scenarios: raw,
      },
      null,
      2,
    ),
  );
  console.log(`\nRohdaten: ${JSON_PFAD}`);
}
