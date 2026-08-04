/**
 * SPONSOR-LIGALEITER — Sockel nach Startrang + Wertungstopf nach Endrang.
 *
 * Was hier bewiesen wird (siehe lib/sponsor/sponsor-liga-leiter.ts):
 *  1. Der Sockel ist eine reine Funktion des STARTRANGS, geklammert an 1..32, unabhaengig vom
 *     Salary Factor — er ist die planbare Absicherung, nicht der Leistungsteil.
 *  2. Die neutrale Ligaleiter ist monoton nicht-steigend im Endrang und traegt den Sockel und den
 *     Wertungstopf in genau der kalibrierten Groesse (die Kalibrierungs-Invariante).
 *  3. Die 11 Kurvenformen sind EXAKT EV-neutral (Ankernormierung): jede liefert bei Unterschrift
 *     denselben Erwartungswert wie die neutrale Leiter, verteilt ihn aber unterschiedlich.
 */
import { describe, expect, it } from "vitest";

import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import {
  SPONSOR_SOCKEL_MAX,
  SPONSOR_SOCKEL_MIN,
  SPONSOR_WERTUNGSTOPF,
  sponsorKurvenLeiter,
  sponsorLigaLeiter,
  sponsorSockelFuerStartrang,
} from "@/lib/sponsor/sponsor-liga-leiter";
import { sponsorV3AnchorWeights } from "@/lib/sponsor/sponsor-v3-model";

const SALARY_FACTORS = [0.82, 1.0, 1.24] as const;

function isNonIncreasing(ladder: readonly number[]): boolean {
  for (let index = 1; index < ladder.length; index += 1) {
    if (ladder[index]! > ladder[index - 1]! + 1e-9) return false;
  }
  return true;
}

describe("Sponsor-Ligaleiter: der Sockel", () => {
  it("reicht von 18 (Startrang 1) bis 48 (Startrang 32) und steigt monoton dazwischen", () => {
    expect(sponsorSockelFuerStartrang(1)).toBeCloseTo(SPONSOR_SOCKEL_MIN, 9);
    expect(sponsorSockelFuerStartrang(32)).toBeCloseTo(SPONSOR_SOCKEL_MAX, 9);
    let previous = sponsorSockelFuerStartrang(1);
    for (let rank = 2; rank <= 32; rank += 1) {
      const current = sponsorSockelFuerStartrang(rank);
      expect(current, `Rang ${rank}`).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("klammert ausserhalb 1..32 statt zu extrapolieren", () => {
    expect(sponsorSockelFuerStartrang(0)).toBeCloseTo(SPONSOR_SOCKEL_MIN, 9);
    expect(sponsorSockelFuerStartrang(-5)).toBeCloseTo(SPONSOR_SOCKEL_MIN, 9);
    expect(sponsorSockelFuerStartrang(99)).toBeCloseTo(SPONSOR_SOCKEL_MAX, 9);
  });

  it("ist unabhaengig vom Salary Factor — die planbare Absicherung darf nicht an der Konjunktur haengen", () => {
    // Rang 32 hat Wertungs-Gewicht exakt 0 ((32-32)/31 = 0): der letzte Endrang der neutralen Leiter
    // ist damit der Sockel selbst, ohne jeden Wertungsanteil — der sauberste Ort, das zu pruefen.
    for (const startRank of [1, 8, 16, 24, 32]) {
      const sockel = sponsorSockelFuerStartrang(startRank);
      for (const salaryFactor of SALARY_FACTORS) {
        const ladder = sponsorLigaLeiter({ startRank, salaryFactor });
        expect(ladder[31]).toBeCloseTo(sockel, 9);
      }
    }
  });
});

describe("Sponsor-Ligaleiter: die neutrale Leiter", () => {
  it("ist monoton nicht-steigend im Endrang, fuer jeden Startrang und Salary Factor", () => {
    for (let startRank = 1; startRank <= 32; startRank += 1) {
      for (const salaryFactor of SALARY_FACTORS) {
        expect(
          isNonIncreasing(sponsorLigaLeiter({ startRank, salaryFactor })),
          `Startrang ${startRank}, f=${salaryFactor}`,
        ).toBe(true);
      }
    }
  });

  it("Kalibrierungs-Invariante: Sockelsumme 1056, Wertungstopf-Summe = SPONSOR_WERTUNGSTOPF * f", () => {
    // Σ der Sockel über alle 32 Starträngen — der arithmetische Mittelwert einer linearen Folge von
    // 18 bis 48 mal 32 Glieder: 32 * (18 + 48) / 2 = 1056. Das ist der Ligahebel des Sockels: kippt
    // diese Summe, kippt die planbare Absicherung der ganzen Liga.
    let sockelSum = 0;
    for (let startRank = 1; startRank <= 32; startRank += 1) {
      sockelSum += sponsorSockelFuerStartrang(startRank);
    }
    expect(sockelSum).toBeCloseTo(1056, 6);

    // Σ des Wertungsanteils über alle 32 Endränge = SPONSOR_WERTUNGSTOPF * salaryFactor — der
    // Wertungstopf selbst haengt nicht am Startrang (die Gewichte sind auf 1 renormiert), deshalb
    // reicht ein einziger Startrang je Salary Factor.
    for (const salaryFactor of SALARY_FACTORS) {
      const sockel = sponsorSockelFuerStartrang(16);
      const ladder = sponsorLigaLeiter({ startRank: 16, salaryFactor });
      const wertungSum = ladder.reduce((sum, value) => sum + (value - sockel), 0);
      expect(wertungSum).toBeCloseTo(SPONSOR_WERTUNGSTOPF * salaryFactor, 6);
    }
  });
});

describe("Sponsor-Ligaleiter: die geshapeten Kurven (Ankernormierung)", () => {
  it("EV-Neutralitaet: jede der 11 Formen trifft exakt den Anker der neutralen Leiter", () => {
    for (const startRank of [1, 8, 16, 24, 32]) {
      const weights = sponsorV3AnchorWeights(startRank);
      for (const salaryFactor of SALARY_FACTORS) {
        const neutral = sponsorLigaLeiter({ startRank, salaryFactor });
        const neutralAnchor = neutral.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0);
        for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
          const ladder = sponsorKurvenLeiter({ shape, startRank, salaryFactor });
          const shapeAnchor = ladder.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0);
          expect(
            Math.abs(shapeAnchor - neutralAnchor),
            `${shape} @ Startrang ${startRank}, f=${salaryFactor}`,
          ).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("jede geshapete Leiter ist monoton nicht-steigend im Endrang (kein Tanking-Anreiz)", () => {
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      for (const startRank of [1, 5, 16, 27, 32]) {
        for (const salaryFactor of SALARY_FACTORS) {
          expect(
            isNonIncreasing(sponsorKurvenLeiter({ shape, startRank, salaryFactor })),
            `${shape} @ Startrang ${startRank}, f=${salaryFactor}`,
          ).toBe(true);
        }
      }
    }
  });

  it("verschiedene Formen liefern verschiedene Leitern — sonst waere die Kartenwahl wirkungslos", () => {
    const startRank = 8;
    const salaryFactor = 1.0;
    const titeljaeger = sponsorKurvenLeiter({ shape: "titeljaeger", startRank, salaryFactor });
    const klassenerhalt = sponsorKurvenLeiter({ shape: "klassenerhalt", startRank, salaryFactor });
    expect(titeljaeger[0]).not.toBeCloseTo(klassenerhalt[0]!, 1);

    // Titeljaeger konzentriert auf Platz 1, Klassenerhalt ist die flachste Form im Katalog — ihre
    // Spanne (Platz 1 minus Platz 32) muss deutlich groesser sein, sonst waere die Formwahl nur ein
    // anderes Etikett fuer dieselbe Kurve.
    const spanneTiteljaeger = titeljaeger[0]! - titeljaeger[31]!;
    const spanneKlassenerhalt = klassenerhalt[0]! - klassenerhalt[31]!;
    expect(spanneTiteljaeger).toBeGreaterThan(spanneKlassenerhalt * 1.5);
  });
});
