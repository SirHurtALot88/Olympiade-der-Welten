/**
 * MEHRJAHRESVERTRAG ROLLT (Umsetzungsplan D) — direkte, funktionale Tests fuer
 * `rerollSponsorV3TermsForNewSeason` (sponsor-v3-offer-service.ts). Ergaenzt die End-to-End-Tests in
 * sponsor-v26.test.ts um die drei harten Zusicherungen aus dem Plan:
 *
 *   1. Der Sockel friert wirklich ein (haengt nur am Startrang, nicht am Salary Factor).
 *   2. Die Kopplung an den Salary Factor greift: ein bei f=1.24 unterschriebener Vertrag darf
 *      nach dem Rollen auf f=0.85 NICHT mehr auf 1.24-Niveau zahlen.
 *   3. Die Rendite-Erosion hat Zaehne: der Erwartungswert eines Dreijahresvertrags ueber drei
 *      Saisons liegt UNTER dem dreier aufeinanderfolgender Einjahresvertraege — ueber jede
 *      Reihenfolge der drei Salary-Factor-Grenzwerte hinweg.
 */
import { describe, expect, it } from "vitest";

import type { SponsorCurveShape } from "@/lib/data/olyDataTypes";
import { SPONSOR_BODEN, sponsorKurvenLeiter, sponsorSockelFuerStartrang } from "@/lib/sponsor/sponsor-liga-leiter";
import { getSponsorTermMultiplier } from "@/lib/sponsor/sponsor-negotiation";
import { buildSponsorV3TermsCore, sponsorV3CardByKey, type SponsorV3ContractTerms } from "@/lib/sponsor/sponsor-v3-model";
import { rerollSponsorV3TermsForNewSeason } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Baut eingefrorene V3-Konditionen wie `buildSponsorV3Terms`, aber ohne GameState — reine Funktion. */
function buildTerms(startRank: number, shape: SponsorCurveShape, salaryFactor: number): SponsorV3ContractTerms {
  const card = sponsorV3CardByKey("basis");
  const baseLadder = sponsorKurvenLeiter({ shape, startRank, salaryFactor });
  return buildSponsorV3TermsCore({
    baseLadder,
    startRank,
    rarity: "magisch",
    card,
    goalKey: null,
    curveShape: shape,
    salaryFactor,
    floor: SPONSOR_BODEN,
  });
}

const SHAPE: SponsorCurveShape = "titeljaeger";
const START_RANK = 9;

describe("rerollSponsorV3TermsForNewSeason — Sockel friert ein", () => {
  it("die neu gebaute Leiter folgt exakt sockel + multiplier*(rawNeueLeiter - sockel)", () => {
    const signed = buildTerms(START_RANK, SHAPE, 1.24);
    const newFactor = 0.85;
    const contractYear = 2;
    const rolled = rerollSponsorV3TermsForNewSeason(signed, { newSalaryFactor: newFactor, contractYear });

    const sockel = sponsorSockelFuerStartrang(START_RANK);
    const rawNew = sponsorKurvenLeiter({ shape: SHAPE, startRank: START_RANK, salaryFactor: newFactor });
    const multiplier = getSponsorTermMultiplier(contractYear);
    rolled.baseLadder.forEach((value, index) => {
      const expected = sockel + multiplier * (rawNew[index]! - sockel);
      expect(value, `Rang ${index + 1}`).toBeCloseTo(expected, 6);
    });
  });

  it("der Sockel selbst ist unabhaengig vom Salary Factor — bei Faktor 0 faellt JEDER Rang exakt auf den Sockel zurueck", () => {
    // sponsorLigaLeiter: neutral[i] = sockel + topf*gewicht[i]/summe, topf = WERTUNGSTOPF*salaryFactor.
    // Bei salaryFactor 0 ist topf 0, der Anspruch A faellt auf den Sockel, und die Kurvenform-Skalierung
    // c = (A-sockel)/refAnker wird 0 — die geshapete Leiter kollabiert exakt auf den Sockel.
    const sockel = sponsorSockelFuerStartrang(START_RANK);
    const zeroFactorLadder = sponsorKurvenLeiter({ shape: SHAPE, startRank: START_RANK, salaryFactor: 0 });
    for (const value of zeroFactorLadder) {
      expect(value).toBeCloseTo(sockel, 6);
    }
  });

  it("Startrang bleibt beim Rollen unangetastet (die eigentliche Sockel-Determinante)", () => {
    const signed = buildTerms(START_RANK, SHAPE, 1.1);
    const rolled = rerollSponsorV3TermsForNewSeason(signed, { newSalaryFactor: 0.9, contractYear: 2 });
    expect(rolled.startRank).toBe(START_RANK);
  });
});

describe("rerollSponsorV3TermsForNewSeason — Konjunktur-Kopplung (Nutzervorgabe)", () => {
  it("ein bei f=1.24 unterschriebener Vertrag zahlt nach dem Rollen auf f=0.85 NICHT mehr auf 1.24-Niveau", () => {
    const signedAtBoom = buildTerms(START_RANK, SHAPE, 1.24);
    const rolledIntoBust = rerollSponsorV3TermsForNewSeason(signedAtBoom, { newSalaryFactor: 0.85, contractYear: 2 });

    const sockel = sponsorSockelFuerStartrang(START_RANK);
    const wertungsanteilBoom = signedAtBoom.anchor - sockel;
    const wertungsanteilBust = rolledIntoBust.anchor - sockel;

    expect(rolledIntoBust.anchor).toBeLessThan(signedAtBoom.anchor);
    // Nicht nur ein numerisches Rauschen: der Wertungsanteil muss SPUERBAR — mindestens um den reinen
    // Faktor-Quotienten 0.85/1.24 — fallen, nicht nur um die (Jahr-2-)Erosion.
    expect(wertungsanteilBust).toBeLessThan(wertungsanteilBoom * (0.85 / 1.24) + 0.001);
  });

  it("umgekehrt: ein bei f=0.82 unterschriebener Vertrag zahlt nach dem Rollen auf f=1.24 auch tatsaechlich mehr", () => {
    const signedAtBust = buildTerms(START_RANK, SHAPE, 0.82);
    const rolledIntoBoom = rerollSponsorV3TermsForNewSeason(signedAtBust, { newSalaryFactor: 1.24, contractYear: 2 });
    expect(rolledIntoBoom.anchor).toBeGreaterThan(signedAtBust.anchor);
  });
});

describe("rerollSponsorV3TermsForNewSeason — Altvertraege", () => {
  it("ein Vertrag ohne curveShape wird unveraendert weitergerollt (kein Wurf, kein Absturz)", () => {
    const terms = buildTerms(START_RANK, SHAPE, 1.0);
    const { curveShape: _curveShape, ...withoutShape } = terms;
    const result = rerollSponsorV3TermsForNewSeason(withoutShape as SponsorV3ContractTerms, {
      newSalaryFactor: 0.5,
      contractYear: 3,
    });
    expect(result).toEqual(withoutShape);
  });
});

describe("Rendite-Erosion hat Zaehne (Umsetzungsplan D, Messpunkt 3)", () => {
  const FACTORS = [1.24, 1.0, 0.82] as const;
  function permutations<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) return [items.slice()];
    const result: T[][] = [];
    items.forEach((item, index) => {
      const rest = [...items.slice(0, index), ...items.slice(index + 1)];
      for (const perm of permutations(rest)) {
        result.push([item, ...perm]);
      }
    });
    return result;
  }

  it("EV eines Dreijahresvertrags ueber drei Saisons liegt UNTER dem dreier aufeinanderfolgender Einjahresvertraege — fuer JEDE Reihenfolge der drei Grenz-Faktoren", () => {
    const evGaps: number[] = [];
    for (const perm of permutations(FACTORS)) {
      const [f1, f2, f3] = perm;

      const signed = buildTerms(START_RANK, SHAPE, f1);
      const year2 = rerollSponsorV3TermsForNewSeason(signed, { newSalaryFactor: f2, contractYear: 2 });
      const year3 = rerollSponsorV3TermsForNewSeason(year2, { newSalaryFactor: f3, contractYear: 3 });
      const ev3yr = signed.anchor + year2.anchor + year3.anchor;

      const ev1yrEach = perm.reduce((sum, f) => sum + buildTerms(START_RANK, SHAPE, f).anchor, 0);

      expect(ev3yr, `Reihenfolge ${perm.join(",")}`).toBeLessThan(ev1yrEach);
      evGaps.push((1 - ev3yr / ev1yrEach) * 100);
    }
    // Die Erosion darf nicht verschwindend klein sein — sonst waere sie eine kosmetische Zahl statt
    // eines echten Kompromisses (siehe TERM_MULTIPLIERS-Kommentar). Bei {1: 1.0, 2: 0.94, 3: 0.87}
    // liegt die gemessene Luecke ueber alle 6 Reihenfolgen zwischen ~2 % und ~5 % des 1-Jahres-EV.
    for (const gapPercent of evGaps) {
      expect(gapPercent).toBeGreaterThan(1);
    }
  });

  it("ein Zweijahresvertrag ist NICHT mehr strikt besser als zwei aufeinanderfolgende Einjahresvertraege (die urspruenglich gemeldete Luecke)", () => {
    const f1 = 1.1;
    const f2 = 0.95;
    const signed = buildTerms(START_RANK, SHAPE, f1);
    const year2 = rerollSponsorV3TermsForNewSeason(signed, { newSalaryFactor: f2, contractYear: 2 });
    const ev2yr = signed.anchor + year2.anchor;
    const ev1yrEach = buildTerms(START_RANK, SHAPE, f1).anchor + buildTerms(START_RANK, SHAPE, f2).anchor;
    expect(ev2yr).toBeLessThan(ev1yrEach);
  });
});
