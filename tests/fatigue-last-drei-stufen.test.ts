/**
 * DIE LAST JE EINSATZ WURDE ANGEHOBEN — auf allen drei Intensitätsstufen.
 *
 * GEMELDET VON CHRIS: „ich habe das gefühl es ist zu einfach auch mit 9 spielern verletzungen zu
 * vermeiden! sonst muss ein einsatz auf allen 3 stufen etwas mehr kosten." — und danach: „last
 * bitte erhöhen auf den 3 Stufen!"
 *
 * WAS GEMESSEN WURDE (`scripts/export-injury-balance-audit.ts` gegen den echten Spielstand, 32
 * Teams, 10 Spieltage): Last 10 → 63 Verletzungen je Saison, Last 15 → 199 (der Ziel-Korridor
 * „~200" der ursprünglichen Kalibrierung), Last 19,5 → 367. Dass der Korridor verfehlt war, lag
 * nicht an der Last, sondern an der Risikokurve: sie wurde nach jener Kalibrierung zweimal
 * abgeflacht (Schutzzone bis 25, Anker bei 50 von 10 % auf 3 %), ohne dass die Last nachzog.
 *
 * ENDSTAND nach Chris' zweiter Ansage („gut dann erhöhe mal um 30% auf allen Stufen"): 19,5.
 *
 * Dieser Test hält NICHT die Zahl 15 fest — die darf sich beim Nachtunen ändern. Er hält fest, was
 * an der Änderung strukturell ist: dass alle drei Stufen mitwachsen und ihr Verhältnis erhalten
 * bleibt, und dass die Last überhaupt in den Bereich reicht, in dem die Risikokurve greift.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTENSITY_FATIGUE_MULT,
  MATCHDAY_FATIGUE_LOAD,
  projectMatchdayInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { FATIGUE_INJURY_RISK_ANCHORS } from "@/lib/fatigue/fatigue-calibration";

/** Ein Spieler ohne Traits — der Last-Multiplikator aus Traits ist damit neutral. */
const NEUTRAL = { traitsPositive: [], traitsNegative: [] };

/** Die Fatigue, ab der die Kurve überhaupt ein Risiko kennt (Schutzzone davor). */
const SCHUTZZONE = FATIGUE_INJURY_RISK_ANCHORS.find((a) => a.fatigue > 0 && a.riskPercent === 0)?.fatigue ?? 25;

describe("Alle drei Stufen tragen die Erhöhung mit", () => {
  it("das Verhältnis zwischen Schonen, Normal und Pushen bleibt unangetastet", () => {
    // Die 2026-07 austarierte Score-je-Fatigue-Abwägung haengt an DIESEM Verhaeltnis, nicht an der
    // absoluten Last. Wer die Basis anhebt, darf es nicht nebenbei verschieben.
    expect(INTENSITY_FATIGUE_MULT.conserve).toBe(0.75);
    expect(INTENSITY_FATIGUE_MULT.normal).toBe(1);
    expect(INTENSITY_FATIGUE_MULT.push).toBe(1.4);
  });

  it("jede Stufe kostet mehr als bei der alten Last von 10", () => {
    const alt = 10;
    for (const stufe of ["conserve", "normal", "push"] as const) {
      const neu = MATCHDAY_FATIGUE_LOAD * INTENSITY_FATIGUE_MULT[stufe];
      expect(neu).toBeGreaterThan(alt * INTENSITY_FATIGUE_MULT[stufe]);
    }
  });

  it("die Reihenfolge stimmt: schonen < normal < pushen", () => {
    const last = (stufe: "conserve" | "normal" | "push") =>
      projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: 0, intensity: stufe }).matchdayLoad;
    expect(last("conserve")).toBeLessThan(last("normal"));
    expect(last("normal")).toBeLessThan(last("push"));
  });
});

describe("Die Last reicht jetzt bis in die Risikozone", () => {
  it("zwei Einsätze am Stück heben einen frischen Spieler über die Schutzzone", () => {
    // DAS war der Kern des Befunds: mit Last 10 blieb ein Spieler nach zwei Einsätzen bei 20 und
    // damit unter der Schutzzone — sein Risiko war exakt 0. Erst darüber greift die Kurve.
    const nachZwei = MATCHDAY_FATIGUE_LOAD * 2;
    expect(nachZwei).toBeGreaterThan(SCHUTZZONE);
  });

  it("schon EIN normaler Einsatz bringt einen frischen Spieler dicht an die Schutzzone", () => {
    // Bei Last 10 lag ein Einsatz bei 10 — Lichtjahre von 25 entfernt. Jetzt zählt jeder Einsatz.
    expect(MATCHDAY_FATIGUE_LOAD).toBeGreaterThan(SCHUTZZONE * 0.7);
  });

  /**
   * DIE STELLE, AN DER DIE ERHÖHUNG CHRIS\' EIGENE REGEL BERÜHRT — bewusst und nur hier.
   *
   * Die Regel lautet „bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 % sein"
   * (siehe `fatigue-calibration.ts`). Bei Last 15 hielt sie für ALLE drei Stufen: selbst Pushen
   * kam aus dem Stand nur auf 21. Bei 19,5 sind es 27,3 — Pushen aus dem Stand trägt jetzt ein
   * kleines Risiko.
   *
   * Vertretbar, weil Pushen ausdrücklich als „bewusste, sparsame Wette" entworfen ist: eine Wette
   * ohne jedes Risiko wäre keine. Für Schonen und Normal bleibt die Regel lückenlos, und das hält
   * dieser Test fest — kippt auch das, ist es keine Nebenwirkung mehr, sondern ein Regelbruch.
   */
  it("aus dem Stand bleiben Schonen und Normal risikofrei", () => {
    for (const stufe of ["conserve", "normal"] as const) {
      const einer = projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: 0, intensity: stufe });
      expect(einer.fatigueBeforeRoll).toBeLessThanOrEqual(SCHUTZZONE);
      expect(einer.riskPercent).toBe(0);
    }
  });

  it("Pushen aus dem Stand ist die Wette, die es sein soll — kleines Risiko, nicht null", () => {
    const einer = projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: 0, intensity: "push" });
    expect(einer.riskPercent).toBeGreaterThan(0);
    // Klein bleiben muss es trotzdem: ein einzelner Push darf kein Glücksspiel sein.
    expect(einer.riskPercent).toBeLessThan(1);
  });

  it("Dauereinsatz wird spürbar: nach vier Einsätzen liegt echtes Risiko an", () => {
    let fatigue = 0;
    for (let i = 0; i < 4; i += 1) {
      fatigue = projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: fatigue, intensity: "normal" }).fatigueBeforeRoll;
    }
    expect(projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: fatigue, intensity: "normal" }).riskPercent).toBeGreaterThan(3);
  });
});

describe("Die Last bleibt ohne Code-Änderung nachstellbar", () => {
  it("die Umgebungsvariable bleibt der Tuning-Knopf", () => {
    // Der Sweep, aus dem die Zahl stammt, faehrt genau darueber:
    // OLY_FATIGUE_MATCHDAY_LOAD=<n> npx tsx scripts/export-injury-balance-audit.ts
    const quelle = readFileSync(join(process.cwd(), "lib/fatigue/fatigue-injury-service.ts"), "utf8");
    expect(quelle).toContain('envNumber("OLY_FATIGUE_MATCHDAY_LOAD"');
  });
});
