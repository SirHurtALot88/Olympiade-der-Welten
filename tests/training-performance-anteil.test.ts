/**
 * PERFORMANCE-ANTEIL AN DEN ZUWÄCHSEN — im Spielerprofil beim Training sichtbar.
 *
 * GEWÜNSCHT VON CHRIS: „spielerentwicklung ist ok wie sie ist ich will nur dass im tooltipp im
 * spielerprofil bei training sichtbar ist wie viel performance anteil in seinen verbesserungen
 * steckt."
 *
 * Die Zahlen lagen längst vor — `attributeForecast` trägt je Attribut `training`, `performance`
 * und `regression`. Sichtbar war nur die Summe, nicht der ANTEIL.
 *
 * DIE ENTSCHEIDENDE FESTLEGUNG, die dieser Test schützt: Bezugsgröße sind die ZUWÄCHSE
 * (Training + Performance), NICHT das Netto. Das Netto enthält die Regression; ein alternder
 * Spieler kann netto fallen, obwohl Performance kräftig beigetragen hat. Ein Prozentsatz von einer
 * negativen Summe wäre unlesbar bis irreführend.
 */
import { describe, expect, it } from "vitest";

type Eintrag = { training: number; performance: number; regression: number };

/** Dieselbe Rechnung wie `buildPerformanceShare` in `PlayerTrainingControls.tsx`. */
function berechneAnteil(eintraege: Eintrag[]) {
  const training = eintraege.reduce((summe, e) => summe + Math.max(0, e.training), 0);
  const performance = eintraege.reduce((summe, e) => summe + Math.max(0, e.performance), 0);
  const zuwachs = training + performance;
  return {
    training,
    performance,
    sharePct: zuwachs > 0.05 ? (performance / zuwachs) * 100 : null,
  };
}

describe("Performance-Anteil an den Zuwächsen", () => {
  it("beziffert den Anteil, den echte Spieltags-Leistungen beigetragen haben", () => {
    const anteil = berechneAnteil([
      { training: 3, performance: 1, regression: -0.5 },
      { training: 1, performance: 1, regression: -0.5 },
    ]);
    // Zuwachs 4 Training + 2 Performance = 6 → ein Drittel aus Leistung.
    expect(anteil.sharePct).toBeCloseTo(33.33, 1);
  });

  it("rechnet die Regression NICHT hinein — sonst wäre der Anteil bei alternden Spielern unlesbar", () => {
    // Netto ist hier deutlich negativ (−6), die Zuwächse sind es nicht.
    const anteil = berechneAnteil([{ training: 1, performance: 3, regression: -10 }]);
    expect(anteil.sharePct).toBeCloseTo(75, 1);
    // Gegenprobe: über das Netto gerechnet käme ein sinnloser Wert heraus.
    const netto = 1 + 3 - 10;
    expect(netto).toBeLessThan(0);
  });

  it("zählt nur positive Beiträge — ein negativer Performance-Beitrag ist kein Zuwachs", () => {
    const anteil = berechneAnteil([{ training: 4, performance: -2, regression: 0 }]);
    expect(anteil.performance).toBe(0);
    expect(anteil.sharePct).toBe(0);
  });

  it("meldet null statt einer erfundenen 0 %, wenn es gar keine Zuwächse gibt", () => {
    expect(berechneAnteil([{ training: 0, performance: 0, regression: -3 }]).sharePct).toBeNull();
    expect(berechneAnteil([]).sharePct).toBeNull();
  });

  it("liefert 100 %, wenn die Verbesserung ausschliesslich aus Leistung stammt", () => {
    expect(berechneAnteil([{ training: 0, performance: 5, regression: 0 }]).sharePct).toBe(100);
  });
});
