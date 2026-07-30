import { describe, expect, it } from "vitest";

import { buildTrainingIntensityProjection } from "@/app/foundation/training-facilities-v2/training-view-shared";
import type { TrainingPlayerRowView } from "@/app/foundation/training-facilities-v2/training-view-types";
import { TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

const MODE_OPTIONS = (["leicht", "mittel", "hart"] as const).map((value) => ({
  value,
  label: value,
  trainingSetpoints: TRAINING_SETPOINTS_BY_MODE[value],
  fatigueLoad: 0,
  recoveryDeltaPct: 0,
})) as unknown as Parameters<typeof buildTrainingIntensityProjection>[1];

/**
 * Baut eine Zeile so, wie die Engine sie bei `mode` liefern WUERDE.
 *
 * Kern der Nachstellung: die Engine friert gespielte Spieltage auf ihrem damaligen
 * Modus ein und legt den gewaehlten Modus nur auf den Rest
 * (`buildProjectedSeasonTrainingAccumulatorOverrides`). Das Trainingsbudget ist
 * also `accumulatedBudget + Rest × Setpoint(mode) / Spieltage`, mal einem
 * spielerspezifischen Multiplikator — NICHT proportional zum rohen Setpoint.
 */
function buildRow(input: {
  mode: PlayerTrainingMode;
  matchdaysCounted: number;
  totalMatchdays: number;
  /** Basisbudget, das die bereits gespielten Spieltage eingebracht haben. */
  accumulatedBudget: number;
  /** Spielerspezifischer Faktor (Potential, Traits, Facility) auf dem Basisbudget. */
  playerMultiplier: number;
}): TrainingPlayerRowView {
  const remaining = input.totalMatchdays - input.matchdaysCounted;
  const base =
    input.accumulatedBudget + (remaining * TRAINING_SETPOINTS_BY_MODE[input.mode]) / input.totalMatchdays;
  const trainingSetpoints = base * input.playerMultiplier;
  return {
    mode: input.mode,
    attributeForecast: [{ training: trainingSetpoints, regression: -4.4 }],
    organicForecast: {
      trainingSetpoints,
      performanceSetpoints: 2.1,
      netSetpoints: trainingSetpoints + 2.1 - 4.4,
    },
    trainingAccumulatorForecast: {
      matchdaysCounted: input.matchdaysCounted,
      totalMatchdays: input.totalMatchdays,
      accumulatedBudget: input.accumulatedBudget,
      forecastBudget: base,
      currentMode: input.mode,
    },
  } as unknown as TrainingPlayerRowView;
}

/**
 * "Es gibt noch einen Anzeigefehler für die SP, wenn ich verschiedene Stufen
 * auswaehle — hier zb mal Bumblecrank mit Leicht oder mit Hart, Stand zum MD7."
 *
 * Gemeldet: derselbe Spieler zeigte fuer "Leicht" +10,6 Training, solange Leicht
 * aktiv war, und +6,8, sobald Hart aktiv war. Die Leiter haengt also davon ab,
 * wo man gerade steht — obwohl sie beantworten soll, was die ANDEREN Stufen
 * braechten.
 */
describe("Trainings-Intensitäts-Prognose: unabhängig vom aktuell gewählten Modus", () => {
  const seasonSetup = { matchdaysCounted: 7, totalMatchdays: 10, accumulatedBudget: 7.5, playerMultiplier: 1.71 };

  it("liefert für jede Stufe denselben Wert, egal welcher Modus gerade aktiv ist", () => {
    const fromLeicht = buildTrainingIntensityProjection(buildRow({ ...seasonSetup, mode: "leicht" }), MODE_OPTIONS);
    const fromHart = buildTrainingIntensityProjection(buildRow({ ...seasonSetup, mode: "hart" }), MODE_OPTIONS);

    for (const mode of ["leicht", "mittel", "hart"] as const) {
      const a = fromLeicht.find((entry) => entry.mode === mode)!;
      const b = fromHart.find((entry) => entry.mode === mode)!;
      expect(a.trainingGain, `${mode}: Training`).toBeCloseTo(b.trainingGain, 1);
      expect(a.net, `${mode}: Netto`).toBeCloseTo(b.net, 1);
    }
  });

  it("trifft für die AKTIVE Stufe exakt den echten Engine-Wert", () => {
    // Die aktive Zeile darf nie umgerechnet werden — sie ist der Anker.
    for (const mode of ["leicht", "mittel", "hart"] as const) {
      const row = buildRow({ ...seasonSetup, mode });
      const projection = buildTrainingIntensityProjection(row, MODE_OPTIONS);
      const active = projection.find((entry) => entry.isCurrent)!;
      expect(active.mode).toBe(mode);
      expect(active.trainingGain).toBeCloseTo(row.organicForecast.trainingSetpoints, 1);
    }
  });

  it("spreizt spät in der Saison deutlich weniger als am Saisonanfang", () => {
    // Kern der Sache: an MD7 von 10 aendert ein Moduswechsel nur noch 3/10 der
    // Saison. Vorher rechnete die Projektion so, als waere die ganze Saison
    // betroffen — daraus kamen die zu grossen Spruenge.
    const late = buildTrainingIntensityProjection(buildRow({ ...seasonSetup, mode: "leicht" }), MODE_OPTIONS);
    const early = buildTrainingIntensityProjection(
      buildRow({ mode: "leicht", matchdaysCounted: 0, totalMatchdays: 10, accumulatedBudget: 0, playerMultiplier: 1.71 }),
      MODE_OPTIONS,
    );
    const spread = (entries: typeof late) =>
      entries.find((entry) => entry.mode === "hart")!.trainingGain /
      entries.find((entry) => entry.mode === "leicht")!.trainingGain;

    expect(spread(late)).toBeLessThan(spread(early));
    // Am Saisonanfang (nichts aufgelaufen) MUSS die alte, reine Setpoint-Spreizung
    // herauskommen — dort war die Rechnung ja korrekt.
    // Precision 1, weil `trainingGain` fuer die Anzeige auf eine Nachkommastelle
    // gerundet wird — das Verhaeltnis erbt diese Rundung (1,79 statt 1,797).
    expect(spread(early)).toBeCloseTo(TRAINING_SETPOINTS_BY_MODE.hart / TRAINING_SETPOINTS_BY_MODE.leicht, 1);
  });

  it("bewegt nach dem letzten Spieltag gar nichts mehr", () => {
    // Rest = 0 → jede Stufe liefert denselben Wert; eine Umstellung kann nichts
    // mehr aendern, und die Karte darf keine Wahl vorgaukeln.
    const done = buildTrainingIntensityProjection(
      buildRow({ mode: "leicht", matchdaysCounted: 10, totalMatchdays: 10, accumulatedBudget: 11, playerMultiplier: 1.71 }),
      MODE_OPTIONS,
    );
    const values = done.map((entry) => entry.trainingGain);
    expect(new Set(values).size).toBe(1);
  });

  it("faellt ohne Accumulator auf die reine Setpoint-Skalierung zurueck", () => {
    // Vor dem ersten Spieltag gibt es keinen Accumulator — dann ist Rest = ganze
    // Saison und das alte Verhalten ist das richtige.
    const row = buildRow({ mode: "mittel", matchdaysCounted: 0, totalMatchdays: 10, accumulatedBudget: 0, playerMultiplier: 1.71 });
    const withoutAccumulator = { ...row, trainingAccumulatorForecast: null } as TrainingPlayerRowView;
    const projection = buildTrainingIntensityProjection(withoutAccumulator, MODE_OPTIONS);
    const leicht = projection.find((entry) => entry.mode === "leicht")!;
    const hart = projection.find((entry) => entry.mode === "hart")!;
    expect(hart.trainingGain / leicht.trainingGain).toBeCloseTo(
      TRAINING_SETPOINTS_BY_MODE.hart / TRAINING_SETPOINTS_BY_MODE.leicht,
      1,
    );
  });
});
