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
    expect(getInjuryRiskPercent(30)).toBe(0.6);
    expect(getInjuryRiskPercent(50)).toBe(3);
    expect(getInjuryRiskPercent(80)).toBe(25);
    expect(getInjuryRiskPercent(100)).toBe(40);
    expect(getInjuryRiskPercent(40)).toBe(1.8);
    expect(getInjuryRiskPercent(65)).toBe(14);
  });

  /**
   * GEMELDET VON CHRIS: „bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 % sein."
   */
  it("unter und bei Fatigue 25 ist das Risiko exakt 0", () => {
    for (const fatigue of [0, 1, 7, 12.5, 20, 24, 24.99, 25]) {
      expect(getInjuryRiskPercent(fatigue), `Fatigue ${fatigue}`).toBe(0);
    }
    // Direkt darüber beginnt es — flach, nicht als Sprung.
    expect(getInjuryRiskPercent(26)).toBe(0.12);
    expect(getInjuryRiskPercent(35)).toBe(1.2);
  });

  /**
   * GEMELDET VON CHRIS (Nachschaerfung): „erst ab 50 fatigue soll es staerker steigen, bis dahin
   * soll es eher so bei 2-3% liegen bis 50".
   *
   * Dieser Test ersetzt einen frueheren namens „ab Fatigue 50 bleibt die Kurve unveraendert".
   * Dessen Zusicherung ist bewusst aufgehoben: der Anker bei 50 ist von 10 % auf 3 % gefallen.
   * Umbenannt statt angepasst, damit der Name nicht das Gegenteil dessen behauptet, was er prueft.
   */
  it("bis 50 bleibt es flach, danach wird es steil", () => {
    // Die ganze Zone bis 50 liegt unter 3 % — „noch harmlos" heisst jetzt auch harmlos.
    for (const fatigue of [26, 30, 35, 40, 45, 50]) {
      expect(getInjuryRiskPercent(fatigue), `Fatigue ${fatigue}`).toBeLessThanOrEqual(3);
    }
    expect(getInjuryRiskPercent(50)).toBe(3);

    // Das hohe Ende ist UNVERAENDERT teuer — die Abflachung unten darf die Fatigue nicht als
    // Constraint erledigen.
    expect(getInjuryRiskPercent(80)).toBe(25);
    expect(getInjuryRiskPercent(100)).toBe(40);

    // Und dazwischen ist die Strecke dadurch STEILER als vorher, nicht flacher: sie traegt jetzt
    // den gesamten Anstieg von 3 auf 25. Gegenprobe in Steigung pro Fatigue-Punkt.
    const steigungUnten = (getInjuryRiskPercent(50) - getInjuryRiskPercent(25)) / 25;
    const steigungOben = (getInjuryRiskPercent(80) - getInjuryRiskPercent(50)) / 30;
    expect(steigungUnten).toBeCloseTo(0.12, 5);
    expect(steigungOben).toBeGreaterThan(steigungUnten * 5);
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
    expect(getInjuryRiskBand(29).riskPercent).toBe(0.48);
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

/**
 * Diese Suite haelt die BESCHREIBUNG der Kurve fest, nicht einzelne Stuetzwerte — damit eine
 * kuenftige Rebalancierung sofort auffaellt, wenn sie die zugesagte FORM verletzt, und nicht erst,
 * wenn jemand im Spiel eine seltsame Zahl bemerkt.
 *
 * Die Zusagen stammen woertlich von Chris:
 *   „bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 % sein"
 *   „erst ab 50 fatigue soll es staerker steigen, bis dahin soll es eher so bei 2-3% liegen bis 50"
 */
describe("Verletzungskurve: die zugesagte Form", () => {
  it("ist bis 25 exakt null — keine unsichtbare Restwahrscheinlichkeit", () => {
    for (let fatigue = 0; fatigue <= 25; fatigue += 0.5) {
      expect(getInjuryRiskPercent(fatigue), `Fatigue ${fatigue}`).toBe(0);
    }
  });

  it("bleibt von 25 bis 50 unter 3 Prozent", () => {
    for (let fatigue = 25; fatigue <= 50; fatigue += 0.5) {
      expect(getInjuryRiskPercent(fatigue), `Fatigue ${fatigue}`).toBeLessThanOrEqual(3);
    }
  });

  it("steigt monoton — mehr Erschoepfung darf nie weniger Risiko bedeuten", () => {
    let vorher = -1;
    for (let fatigue = 0; fatigue <= 100; fatigue += 0.5) {
      const jetzt = getInjuryRiskPercent(fatigue);
      expect(jetzt, `Fatigue ${fatigue}`).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
  });

  it("wird oberhalb von 50 deutlich steiler als darunter", () => {
    // Der Kern der Zusage: die Kurve ist nicht gleichmaessig, sie knickt bei 50 nach oben.
    const unten = (getInjuryRiskPercent(50) - getInjuryRiskPercent(25)) / 25;
    const oben = (getInjuryRiskPercent(80) - getInjuryRiskPercent(50)) / 30;
    expect(oben).toBeGreaterThan(unten * 5);
  });

  it("laesst das hohe Ende teuer — Verheizen bleibt bestraft", () => {
    // Gegenprobe zur Abflachung unten: waere hier mitgesenkt worden, waere die Fatigue als
    // Constraint erledigt und die ganze Rotationsentscheidung bedeutungslos.
    expect(getInjuryRiskPercent(80)).toBe(25);
    expect(getInjuryRiskPercent(100)).toBe(40);
  });
});
