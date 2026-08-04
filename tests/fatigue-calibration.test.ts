import { describe, expect, it } from "vitest";

import {
  getCombinedFatigueInjuryPerformanceMultiplier,
  getFatiguePerformanceMultiplier,
  getFatiguePerformancePenaltyPercent,
  getFatigueRiskLevel,
  getInjuryPerformanceMultiplier,
  getInjuryRiskBand,
  getInjuryRiskPercent,
  INJURY_PERFORMANCE_MULTIPLIER,
  MAX_COMBINED_FATIGUE_INJURY_MULTIPLIER,
} from "@/lib/fatigue/fatigue-calibration";

describe("fatigue-calibration", () => {
  it("maps performance fatigue linearly to 25% at 80 and caps above that", () => {
    expect(getFatiguePerformancePenaltyPercent(0)).toBe(0);
    expect(getFatiguePerformancePenaltyPercent(40)).toBe(12.5);
    expect(getFatiguePerformancePenaltyPercent(80)).toBe(25);
    expect(getFatiguePerformancePenaltyPercent(100)).toBe(25);
    expect(getFatiguePerformanceMultiplier(80)).toBe(0.75);
  });

  it("applies same-day injury malus multiplicatively with fatigue", () => {
    expect(getInjuryPerformanceMultiplier(false)).toBe(1);
    expect(getInjuryPerformanceMultiplier(true)).toBe(INJURY_PERFORMANCE_MULTIPLIER);
    expect(getCombinedFatigueInjuryPerformanceMultiplier(80, true)).toBe(MAX_COMBINED_FATIGUE_INJURY_MULTIPLIER);
    expect(getCombinedFatigueInjuryPerformanceMultiplier(0, true)).toBe(INJURY_PERFORMANCE_MULTIPLIER);
  });

  it("interpolates injury risk across anchor points", () => {
    expect(getInjuryRiskPercent(0)).toBe(0);
    expect(getInjuryRiskPercent(30)).toBe(2);
    expect(getInjuryRiskPercent(50)).toBe(10);
    expect(getInjuryRiskPercent(80)).toBe(25);
    expect(getInjuryRiskPercent(100)).toBe(40);
    expect(getInjuryRiskPercent(40)).toBe(6);
    expect(getInjuryRiskPercent(65)).toBe(17.5);
  });

  /**
   * GEMELDET VON CHRIS: „bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 % sein."
   */
  it("unter und bei Fatigue 25 ist das Risiko exakt 0", () => {
    for (const fatigue of [0, 1, 7, 12.5, 20, 24, 24.99, 25]) {
      expect(getInjuryRiskPercent(fatigue), `Fatigue ${fatigue}`).toBe(0);
    }
    // Direkt darüber beginnt es — flach, nicht als Sprung.
    expect(getInjuryRiskPercent(26)).toBe(0.4);
    expect(getInjuryRiskPercent(35)).toBe(4);
  });

  it("ab Fatigue 50 bleibt die Kurve unverändert", () => {
    // Gegenprobe: die Schutzzone darf das hohe Ende nicht entschärfen. Wer verheizt, trägt weiter
    // dasselbe Risiko — sonst wäre die Fatigue als Constraint erledigt.
    expect(getInjuryRiskPercent(50)).toBe(10);
    expect(getInjuryRiskPercent(60)).toBe(15);
    expect(getInjuryRiskPercent(80)).toBe(25);
    expect(getInjuryRiskPercent(90)).toBe(32.5);
    expect(getInjuryRiskPercent(100)).toBe(40);
  });

  it("„kein Risiko“ heißt jetzt wörtlich 0 % — Anzeige und Rechnung sagen dasselbe", () => {
    // Vorher hieß 0–29 „kein Risiko", während bei 29 real 4,83 % anlagen. Das war der zweite Teil
    // von „unpredictable": das Spiel zeigte Sicherheit an und hat dann verletzt.
    for (const fatigue of [0, 10, 24]) {
      expect(getInjuryRiskBand(fatigue).label, `Fatigue ${fatigue}`).toBe("none");
      expect(getInjuryRiskBand(fatigue).riskPercent, `Fatigue ${fatigue}`).toBe(0);
    }
    expect(getInjuryRiskBand(25).label).toBe("minimal");
    expect(getInjuryRiskBand(29).label).toBe("minimal");
    expect(getInjuryRiskBand(29).riskPercent).toBe(1.6);
  });

  it("returns ui bands with live risk percent", () => {
    expect(getInjuryRiskBand(85).label).toBe("sehr_stark");
    expect(getInjuryRiskBand(85).riskPercent).toBe(28.75);
  });

  it("classifies fatigue risk levels on the 0-100 scale", () => {
    expect(getFatigueRiskLevel(20)).toBe("niedrig");
    expect(getFatigueRiskLevel(45)).toBe("mittel");
    expect(getFatigueRiskLevel(70)).toBe("hoch");
  });
});
