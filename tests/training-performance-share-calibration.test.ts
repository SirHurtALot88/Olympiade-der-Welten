/**
 * ZIELVORGABE VON CHRIS: „ich hatte gehofft, dass im Schnitt beim Training Performance so 50 %
 * ausmacht — bei schwächeren Spielern, die mehr trainieren, natürlich nicht, deswegen sag ich im avg."
 *
 * Gemessen waren es 34,3 % (`npm run training:source-share-audit`, Live-Save
 * new-game-1785174792968-8d7mdx, 332 Kaderspieler, 10/10 Spieltage). Erreicht wird die 50 % durch
 * ein PAAR aus zwei Konstanten, nicht durch eine einzelne:
 *
 *   ORGANIC_PERFORMANCE_SETPOINT_SCALE  1,05 → 1,53   (× 1,46)
 *   TRAINING_SETPOINTS_BY_MODE          × 0,76        (3,6/4,56/6,47 → 2,74/3,47/4,92)
 *
 * Warum als Paar: die Performance allein anzuheben haette × 1,92 gebraucht und den Liga-Ø-Netto
 * von +0,73 auf ≈ +2,9 getrieben — weit aus dem Korridor [-0,4; +0,4] aus
 * `long-run-organic-progression-audit`. Das Paar verschiebt das VERHAELTNIS und laesst die
 * Bruttosumme stehen; nachgemessen blieb der Liga-Ø-Netto bei 0,70 (vorher 0,73).
 *
 * DIESER TEST IST EINE STOLPERDRAHT-PRUEFUNG, keine Rechnung. Der echte Beleg braucht einen
 * Spielstand mit voller Saisonhistorie und laeuft deshalb nicht in der CI. Was der Test leistet:
 * wer eine der beiden Zahlen anfasst, faellt hier auf und wird daran erinnert, dass sie zusammen
 * kalibriert wurden — eine einzeln gedrehte Schraube zerlegt entweder den Anteil oder den
 * Netto-Haushalt.
 *
 * Nachmessen:
 *   OLY_APP_SQLITE_PATH=<pfad> npm run training:source-share-audit -- --save-id <id>
 */
import { describe, expect, it } from "vitest";

import { ORGANIC_PERFORMANCE_SETPOINT_SCALE } from "@/lib/training/organic-season-progression";
import { TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";

/** Stand der Kalibrierung vom 01.08.2026 — gemessen 49,9 % MAKRO / 50,4 % MIKRO. */
const CALIBRATED_PERFORMANCE_SCALE = 1.53;
const CALIBRATED_TRAINING_SETPOINTS = { leicht: 2.74, mittel: 3.47, hart: 4.92 };

describe("Performance-Anteil am Saisonzuwachs — kalibriertes Konstantenpaar", () => {
  it("die Performance-Skalierung steht auf dem gemessenen Wert", () => {
    expect(
      ORGANIC_PERFORMANCE_SETPOINT_SCALE,
      "geaendert? Dann bitte den Audit neu fahren und BEIDE Zahlen hier nachziehen",
    ).toBe(CALIBRATED_PERFORMANCE_SCALE);
  });

  it("die Trainingsbudgets stehen auf den gemessenen Werten", () => {
    expect(
      TRAINING_SETPOINTS_BY_MODE,
      "geaendert? Dann bitte den Audit neu fahren und BEIDE Zahlen hier nachziehen",
    ).toEqual(CALIBRATED_TRAINING_SETPOINTS);
  });

  it("die Reihenfolge der Trainingsmodi bleibt: leicht < mittel < hart", () => {
    // Die Senkung um 0,76 darf die Modi nicht umsortieren — sonst waere „hart" keine Entscheidung mehr.
    expect(TRAINING_SETPOINTS_BY_MODE.leicht).toBeLessThan(TRAINING_SETPOINTS_BY_MODE.mittel);
    expect(TRAINING_SETPOINTS_BY_MODE.mittel).toBeLessThan(TRAINING_SETPOINTS_BY_MODE.hart);
  });

  it("die beiden Zahlen sind gegenlaeufig kalibriert", () => {
    /**
     * Der Kern der Kalibrierung: Performance wurde ANGEHOBEN und Training GESENKT. Wer beide in
     * dieselbe Richtung dreht, veraendert die Bruttosumme — und damit den Liga-Netto-Haushalt, der
     * schon heute am oberen Korridorrand liegt.
     */
    const performanceFactor = ORGANIC_PERFORMANCE_SETPOINT_SCALE / 1.05;
    const trainingFactor = TRAINING_SETPOINTS_BY_MODE.mittel / 4.56;
    expect(performanceFactor).toBeGreaterThan(1);
    expect(trainingFactor).toBeLessThan(1);
    // Das Produkt der beiden Faktoren haelt die Bruttosumme naeherungsweise konstant.
    expect(performanceFactor * trainingFactor).toBeGreaterThan(0.9);
    expect(performanceFactor * trainingFactor).toBeLessThan(1.3);
  });
});
