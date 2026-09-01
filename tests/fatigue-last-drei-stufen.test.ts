/**
 * DIE LAST JE EINSATZ WURDE ANGEHOBEN — auf allen drei Intensitätsstufen.
 *
 * GEMELDET VON CHRIS: „ich habe das gefühl es ist zu einfach auch mit 9 spielern verletzungen zu
 * vermeiden! sonst muss ein einsatz auf allen 3 stufen etwas mehr kosten." — und danach: „last
 * bitte erhöhen auf den 3 Stufen!"
 *
 * WAS GEMESSEN WURDE (`scripts/export-injury-balance-audit.ts` gegen den echten Spielstand, 32
 * Teams, 10 Spieltage): Last 10 → 63 Verletzungen je Saison, Last 15 → 199 (der
 * Ziel-Korridor „~200" der ursprünglichen Kalibrierung), Last 16 → 236. Dass der Korridor verfehlt
 * war, lag nicht
 * an der Last, sondern an der Risikokurve: sie wurde nach jener Kalibrierung zweimal abgeflacht
 * (Schutzzone bis 25, Anker bei 50 von 10 % auf 3 %), ohne dass die Last nachzog.
 *
 * ENDSTAND nach Chris' Ansage: 16 — „weil man kann ja die gebäude zur erholung noch pimpen". Die
 * Erholung haengt am Reha-Ausbau (flacher Aufschlag 0/2/4/6/9/12 auf die Basis 20) und am
 * Trainingsmodus („leicht" × 1,2) — voll ausgebaut und schonend trainiert stehen bis zu 38,4
 * Erholung gegen 16 Last. Die Last ist damit eine Entscheidung, keine Pauschalsteuer.
 *
 * Dieser Test hält NICHT die Zahl 16 fest — die darf sich beim Nachtunen ändern. Er hält fest, was
 * an der Änderung strukturell ist: dass alle drei Stufen mitwachsen und ihr Verhältnis erhalten
 * bleibt, und dass die Last überhaupt in den Bereich reicht, in dem die Risikokurve greift.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BASE_MATCHDAY_RECOVERY,
  INTENSITY_FATIGUE_MULT,
  MATCHDAY_ACTIVE_RECOVERY,
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


  /**
   * CHRIS' EIGENE REGEL BLEIBT LÜCKENLOS — auf allen drei Stufen.
   *
   * Die Regel lautet „bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 % sein"
   * (siehe `fatigue-calibration.ts`). Sie haelt, solange die HÖCHSTE Stufe aus dem Stand unter 25
   * bleibt: 16 × 1,4 = 22,4. Ab einer Basis über 17,8 (17,8 × 1,4 = 24,9) waere das nicht mehr so —
   * dann traege ein frischer Spieler beim Pushen Risiko. Dieser Test ist die Bremse dagegen.
   */
  it("aus dem Stand bleibt JEDE Stufe risikofrei — auch Pushen", () => {
    for (const stufe of ["conserve", "normal", "push"] as const) {
      const einer = projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: 0, intensity: stufe });
      expect(einer.fatigueBeforeRoll).toBeLessThanOrEqual(SCHUTZZONE);
      expect(einer.riskPercent).toBe(0);
    }
  });

  it("Dauereinsatz wird spürbar: nach vier Einsätzen liegt echtes Risiko an", () => {
    let fatigue = 0;
    for (let i = 0; i < 4; i += 1) {
      fatigue = projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: fatigue, intensity: "normal" }).fatigueBeforeRoll;
    }
    expect(projectMatchdayInjuryRisk({ player: NEUTRAL, currentFatigue: fatigue, intensity: "normal" }).riskPercent).toBeGreaterThan(3);
  });
});

/**
 * NETTO STATT BRUTTO — was ein Spieltag den Spieler WIRKLICH kostet, sobald die aktive Erholung
 * eingeschaltet ist (Designplan B.4/B.5).
 *
 * Bisher hielt diese Datei nur die BRUTTO-Last fest. Mit `MATCHDAY_ACTIVE_RECOVERY` ist die für den
 * Spieler erlebte Größe aber die Differenz: Last minus der Erholung, die er auch beim Spielen
 * bekommt. Genau daran hängt Chris' Anforderung „von Anfang an spürbar, aber nicht schon zur
 * Halbzeit erzwungen verletzt" — deshalb steht die Reihenfolge der drei Stufen jetzt auch netto
 * unter Aufsicht.
 *
 * Absolute Zahlen stehen bewusst nicht hier (die dürfen sich beim Nachtunen ändern), sondern in
 * `tests/fatigue-aktive-erholung.test.ts` an der Tabelle aus B.4.
 */
describe("Netto pro Spieltag je Stufe — sobald die aktive Erholung greift", () => {
  const netto = (stufe: "conserve" | "normal" | "push") =>
    MATCHDAY_FATIGUE_LOAD * INTENSITY_FATIGUE_MULT[stufe] - MATCHDAY_ACTIVE_RECOVERY;

  it("die Rangfolge bleibt auch netto erhalten: schonen < normal < pushen", () => {
    expect(netto("conserve")).toBeLessThan(netto("normal"));
    expect(netto("normal")).toBeLessThan(netto("push"));
  });

  it("JEDE Stufe kostet netto noch etwas — Spielen bleibt spürbar, auch Schonen", () => {
    // Chris' erste Anforderung: „von Anfang an spürbar". Fiele eine Stufe auf 0 oder darunter,
    // wäre Dauereinsatz auf ihr gratis, und die Erschöpfung hätte keinen Zahn mehr.
    for (const stufe of ["conserve", "normal", "push"] as const) {
      expect(netto(stufe)).toBeGreaterThan(0);
    }
  });

  it("die Bank bleibt das stärkste Werkzeug — Rotation SENKT die Fatigue, statt sie zu bremsen", () => {
    // Chris' dritte Anforderung: „Rotation lohnt sich spürbar". Ein Bank-Spieltag muss deutlich
    // mehr abbauen, als ein normaler Einsatz netto aufbaut.
    expect(BASE_MATCHDAY_RECOVERY).toBeGreaterThan(netto("normal") * 4);
  });

  it("die Kappungsgrenze wird über eine ganze Saison gestreckt, nicht in ihrem ersten Drittel erreicht", () => {
    // DAS war der Befund: brutto steht ein Dauerstarter nach ⌈100/16⌉ = 7 Spieltagen an der
    // 100er-Kappung — bei 10 Spieltagen die letzten drei durchgehend im Maximalrisiko-Band.
    const bruttoSpieltage = Math.ceil(100 / MATCHDAY_FATIGUE_LOAD);
    const nettoSpieltage = Math.ceil(100 / netto("normal"));
    expect(bruttoSpieltage).toBeLessThanOrEqual(7);
    expect(nettoSpieltage).toBeGreaterThanOrEqual(bruttoSpieltage * 2);
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
