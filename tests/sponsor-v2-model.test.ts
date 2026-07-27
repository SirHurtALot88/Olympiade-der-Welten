/**
 * P1 — die reine Rechenschicht des Sponsorsystems V2 gegen die Referenz.
 *
 * WOZU DIESE TESTS: `lib/sponsor/sponsor-v2-model.ts` haelt dieselben Zahlen wie
 * `scripts/sponsor-model-params.ts`, die Referenz, gegen die der Engine-Schattentest gelaufen ist.
 * Doppelhaltung ist noetig (Skripte sind Werkzeuge, lib ist Produktionscode — keine Seite darf von
 * der anderen importieren), und Doppelhaltung ist im Repo schon dreimal auseinandergelaufen. Diese
 * Datei ist die Klammer: sie vergleicht beide Seiten Zahl fuer Zahl statt zu hoffen.
 *
 * Dazu die zwei Eigenschaften, die das Modell tragen und aus den Zahlen allein nicht folgen:
 *   - EV-PARITAET: jede Karte eines Teams hat nach der Kalibrierung denselben Erwartungswert.
 *   - MONOTONIE: keine erzeugbare Karte zahlt fuer einen besseren Endrang weniger.
 */
import { describe, expect, it } from "vitest";

import {
  SPONSOR_V2_CLAUSES, SPONSOR_V2_CURVES, SPONSOR_V2_LIGA, SPONSOR_V2_PROFILES,
  SPONSOR_V2_RARITIES, SPONSOR_V2_SIGMA, SPONSOR_V2_BIAS_SHRINK, SPONSOR_V2_P_GOAL,
  SPONSOR_V2_FORM_AMPLITUDE, SPONSOR_V2_TARGET_EV_SHAPE, SPONSOR_V2_TIERS,
  sponsorV2Calibrate, sponsorV2CardTargets, sponsorV2CenterRank, sponsorV2ClauseArms,
  sponsorV2CurveByName, sponsorV2ExpectedValue, sponsorV2FloorAt, sponsorV2FormShape,
  sponsorV2GoalPayout, sponsorV2LockTerms, sponsorV2LadderFromTerms, sponsorV2ParamsOf,
  sponsorV2ProfileByName, sponsorV2RankDistribution, sponsorV2RankPart, sponsorV2RawPayout,
  sponsorV2ScaleWithK, sponsorV2SettleFromTerms, sponsorV2SolveLeagueK, sponsorV2TierOf,
  type SponsorV2Card, type SponsorV2Rarity,
} from "@/lib/sponsor/sponsor-v2-model";

import {
  CLAUSES as REF_CLAUSES, LIGA as REF_LIGA, PROFILES as REF_PROFILES, RARITY_ORDER as REF_RARITY_ORDER,
  SIGMA as REF_SIGMA, BIAS_SHRINK as REF_BIAS_SHRINK, P_GOAL as REF_P_GOAL,
  FORM_AMPLITUDE as REF_FORM_AMPLITUDE, TARGET_EV_SHAPE as REF_TARGET_EV_SHAPE,
  TIERS as REF_TIERS, tierOf as refTierOf, floorAt as refFloorAt, dist as refDist,
  formShape as refFormShape, cardTargets as refCardTargets, goalPayout as refGoalPayout,
  rel as refRel, clauseBonus as refClauseBonus, clauseMalus as refClauseMalus, centerRank as refCenterRank,
} from "../scripts/sponsor-model-params";

/** Kurvenformeln stehen im Referenzlauf in sponsor-model-proposal.ts (ein Report, nicht importierbar). */
const REF_CURVES: Record<string, (d: number) => number> = {
  Sockel: (d) => (d <= 0 ? 6 : 6 + d),
  Halten: (d) => (d === 0 ? 12 : d > 0 ? 12 - 3 * d : 12 + 6 * d),
  Linear: refRel,
  Gipfel: (d) => (d >= 2 ? 14 + 10 * (d - 2) : d === 1 ? 2 : -6 + 3 * d),
  Steil: (d) => (d < 0 ? 5 * d : 7 * d),
  Flach: (d) => (d <= 0 ? 2 : 2 + 2 * d),
};

const CLOSE = 1e-9;

describe("sponsor v2 model — identisch zur Referenz in scripts/", () => {
  it("Skalare stimmen ueberein", () => {
    expect(SPONSOR_V2_SIGMA).toBe(REF_SIGMA);
    expect(SPONSOR_V2_BIAS_SHRINK).toBe(REF_BIAS_SHRINK);
    expect(SPONSOR_V2_P_GOAL).toBe(REF_P_GOAL);
    expect(SPONSOR_V2_FORM_AMPLITUDE).toBe(REF_FORM_AMPLITUDE);
    expect([...SPONSOR_V2_LIGA]).toEqual([...REF_LIGA]);
    expect(SPONSOR_V2_TIERS.length).toBe(REF_TIERS.length);
    SPONSOR_V2_TARGET_EV_SHAPE.forEach((v, i) => expect(v).toBeCloseTo(REF_TARGET_EV_SHAPE[i]!, 9));
  });

  it("Stufenzuordnung und Untergrenze stimmen ueber alle Raenge und Ligajahre", () => {
    for (let r = 1; r <= 32; r += 1) expect(sponsorV2TierOf(r)).toBe(refTierOf(r));
    for (const rarity of SPONSOR_V2_RARITIES) {
      for (const sf of [0.7, 0.8, 0.95, 1.0, 1.2, 1.5]) {
        expect(sponsorV2FloorAt(rarity, sf)).toBeCloseTo(refFloorAt(rarity, sf), 9);
      }
    }
    expect([...SPONSOR_V2_RARITIES]).toEqual(REF_RARITY_ORDER);
  });

  it("Kurven stimmen ueber den gesamten Bereich d in [-8, +8]", () => {
    for (const c of SPONSOR_V2_CURVES) {
      for (let d = -8; d <= 8; d += 1) expect(c.rel(d)).toBeCloseTo(REF_CURVES[c.name]!(d), 9);
    }
  });

  it("Klauselkatalog ist Eintrag fuer Eintrag derselbe", () => {
    expect(SPONSOR_V2_CLAUSES.length).toBe(REF_CLAUSES.length);
    for (const ref of REF_CLAUSES) {
      const own = SPONSOR_V2_CLAUSES.find((c) => c.name === ref.name);
      expect(own, `Klausel ${ref.name} fehlt in lib/`).toBeDefined();
      expect(own!.p).toBe(ref.p);
      expect(own!.s).toBe(ref.s);
      expect(own!.evaluable).toBe(ref.evaluable);
      expect(own!.direction).toBe(ref.direction);
    }
    // Die fuenf nach dem Engine-Schattentest gestrichenen Klauseln duerfen nicht zurueckkehren.
    for (const gone of ["Charakterarbeit", "Kapitänstreue", "Hartes Training", "XP-Disziplin", "Beliebtheit"]) {
      expect(SPONSOR_V2_CLAUSES.some((c) => c.name === gone), `${gone} ist gestrichen`).toBe(false);
    }
    expect(sponsorV2ClauseArms(sponsorV2ClauseByNameLocal("Schuldenfrei")).bonus)
      .toBeCloseTo(refClauseBonus(8, 0.85), 9);
    expect(sponsorV2ClauseArms(sponsorV2ClauseByNameLocal("Schuldenfrei")).malus)
      .toBeCloseTo(refClauseMalus(8, 0.85), 9);
  });

  it("Profile, Formkomponente und Kartenziele stimmen ueberein", () => {
    expect(SPONSOR_V2_PROFILES.map((p) => p.name)).toEqual(REF_PROFILES.map((p) => p.name));
    for (const prof of SPONSOR_V2_PROFILES) {
      const ref = REF_PROFILES.find((p) => p.name === prof.name)!;
      expect(prof.specialShare).toBe(ref.specialShare);
      expect(prof.stepWeights).toEqual(ref.stepWeights);
      // stepWeights muessen nicht-negativ sein und auf 1 summieren — das traegt die Monotonie.
      expect(prof.stepWeights.every((w) => w >= 0)).toBe(true);
      expect(prof.stepWeights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      for (const e of [1, 3, 8, 16, 24, 32]) {
        for (let t = 0; t < 9; t += 1) {
          expect(sponsorV2FormShape(prof, e, t)).toBeCloseTo(refFormShape(ref, e, t), 8);
        }
      }
      for (const rarity of SPONSOR_V2_RARITIES) {
        for (let t = 0; t < 9; t += 1) {
          const own = sponsorV2CardTargets(rarity, prof, t);
          const ref2 = refCardTargets(rarity, ref, t);
          expect(own.ladder).toBeCloseTo(ref2.ladder, 9);
          expect(own.special).toBeCloseTo(ref2.special, 9);
          expect(own.total).toBeCloseTo(ref2.total, 9);
        }
      }
    }
  });

  it("Ergebnisverteilung inklusive Rueckschritt zur Mitte stimmt ueberein", () => {
    for (const e of [1, 5, 12, 16, 20, 27, 32]) {
      expect(sponsorV2CenterRank(e)).toBeCloseTo(refCenterRank(e), 9);
      const own = sponsorV2RankDistribution(e);
      const ref = refDist(e);
      own.forEach((v, i) => expect(v).toBeCloseTo(ref[i]!, 12));
      expect(own.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    }
    // Richtung des gemessenen Bias: starke Teams fallen zurueck, schwache steigen auf.
    expect(sponsorV2CenterRank(3)).toBeGreaterThan(3);
    expect(sponsorV2CenterRank(30)).toBeLessThan(30);
    expect(sponsorV2CenterRank(16.5)).toBeCloseTo(16.5, 9);
  });

  it("Sonderziel-Lotterie stimmt ueberein", () => {
    for (const ev of [4, 6, 11, 21, 40]) {
      expect(sponsorV2GoalPayout(ev)).toBeCloseTo(refGoalPayout(ev), 9);
    }
    // Deckel greift: bei sehr kleinem p zahlt das Ziel hoechstens das Vierfache seines EV.
    expect(sponsorV2GoalPayout(10, 0.05)).toBeCloseTo(40, 9);
  });

  it("Rangteil einer konkreten Karte stimmt zeichengleich mit der Referenzformel", { timeout: 60_000 }, () => {
    for (const curve of SPONSOR_V2_CURVES) {
      for (const prof of SPONSOR_V2_PROFILES) {
        const refProf = REF_PROFILES.find((p) => p.name === prof.name)!;
        for (const e of [2, 10, 18, 30]) {
          for (const r of [1, 7, 16, 25, 32]) {
            const own = sponsorV2RankPart({ rarity: "magisch", profile: prof, curve, clause: SPONSOR_V2_CLAUSES[0]! }, e, r, 3.5);
            const ref = REF_LIGA[refTierOf(r)]! + REF_CURVES[curve.name]!(refTierOf(e) - refTierOf(r))
              + refFormShape(refProf, e, refTierOf(r)) + 3.5;
            expect(own).toBeCloseTo(ref, 8);
          }
        }
      }
    }
  });
});

describe("sponsor v2 model — die zwei tragenden Eigenschaften", () => {
  const allCards = (): SponsorV2Card[] => {
    const out: SponsorV2Card[] = [];
    for (const rarity of SPONSOR_V2_RARITIES) {
      for (const profile of SPONSOR_V2_PROFILES) {
        for (const curve of SPONSOR_V2_CURVES) {
          for (const clause of SPONSOR_V2_CLAUSES) out.push({ rarity, profile, curve, clause });
        }
      }
    }
    return out;
  };

  it("EV-PARITAET: jede Karte trifft nach der Kalibrierung ihr Ziel-EV", { timeout: 120_000 }, () => {
    for (const rarity of SPONSOR_V2_RARITIES) {
      for (const profile of SPONSOR_V2_PROFILES) {
        for (const curve of SPONSOR_V2_CURVES) {
          for (const clause of [SPONSOR_V2_CLAUSES[0]!, SPONSOR_V2_CLAUSES[6]!, SPONSOR_V2_CLAUSES[9]!]) {
            const card: SponsorV2Card = { rarity, profile, curve, clause };
            for (const e of [1, 9, 18, 27, 32]) {
              const params = sponsorV2ParamsOf(card);
              const cal = sponsorV2Calibrate(card, e, params);
              const target = sponsorV2CardTargets(rarity, profile, sponsorV2TierOf(e)).total;
              expect(sponsorV2ExpectedValue(card, e, cal, params)).toBeCloseTo(target, 4);
            }
          }
        }
      }
    }
  });

  it("MONOTONIE: keine erzeugbare Karte zahlt fuer einen besseren Endrang weniger", { timeout: 120_000 }, () => {
    // Der Rangteil traegt den Beweis: Offset, Klauselarme und Sonderziel sind rangUNABHAENGIG,
    // Untergrenze und K-Skalierung sind monotone Abbildungen. Trotzdem wird hier die VOLLE
    // Auszahlung geprueft, in allen vier Zustaenden, damit der Beweis nicht nur behauptet ist.
    let checked = 0;
    const violations: string[] = [];
    for (const rarity of SPONSOR_V2_RARITIES) {
      for (const profile of SPONSOR_V2_PROFILES) {
        for (const curve of SPONSOR_V2_CURVES) {
          const card: SponsorV2Card = { rarity, profile, curve, clause: SPONSOR_V2_CLAUSES[9]! };
          const params = sponsorV2ParamsOf(card);
          for (let e = 1; e <= 32; e += 1) {
            const cal = sponsorV2Calibrate(card, e, params);
            for (const sf of [0.8, 1.0, 1.2]) {
              for (const k of [0.6, 1.0, 1.6]) {
                for (const clauseMet of [true, false]) {
                  for (const goalMet of [true, false]) {
                    const ladder = Array.from({ length: 32 }, (_, i) => sponsorV2ScaleWithK(
                      sponsorV2RawPayout(card, e, i + 1, cal, params, clauseMet, goalMet), rarity, sf, k));
                    checked += 1;
                    for (let r = 1; r < 32; r += 1) {
                      if (ladder[r]! > ladder[r - 1]! + 1e-9) {
                        violations.push(`${rarity}/${curve.name}/${profile.name} E${e} sf${sf} K${k}: Rang ${r + 1} zahlt ${ladder[r]!.toFixed(2)}, Rang ${r} nur ${ladder[r - 1]!.toFixed(2)}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(10000);
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it("der Kartenraum ist vollstaendig erzeugbar und kein Eintrag faellt aus", () => {
    expect(allCards().length).toBe(4 * 5 * 6 * 15);
  });
});

describe("sponsor v2 model — eingefrorene Konditionen", () => {
  const card: SponsorV2Card = {
    rarity: "magisch",
    profile: sponsorV2ProfileByName("ausgewogen"),
    curve: sponsorV2CurveByName("Linear"),
    clause: SPONSOR_V2_CLAUSES.find((c) => c.name === "Kaderruhe")!,
  };

  it("Settlement aus eingefrorenen Konditionen ist zeichengleich mit dem Modell", { timeout: 60_000 }, () => {
    const params = sponsorV2ParamsOf(card);
    for (const e of [2, 11, 20, 31]) {
      const cal = sponsorV2Calibrate(card, e, params);
      for (const sf of [0.85, 1.0, 1.25]) {
        const k = 1.13;
        const terms = sponsorV2LockTerms(card, e, cal, sf, k, params);
        for (let r = 1; r <= 32; r += 1) {
          for (const clauseMet of [true, false]) {
            for (const goalMet of [true, false]) {
              const viaTerms = sponsorV2SettleFromTerms(terms, r, clauseMet, goalMet);
              const viaModel = sponsorV2ScaleWithK(
                sponsorV2RawPayout(card, e, r, cal, params, clauseMet, goalMet), card.rarity, sf, k);
              expect(viaTerms).toBeCloseTo(viaModel, 9);
            }
          }
        }
      }
    }
  });

  it("die Anzeigeleiter ist genau die Settlement-Leiter (Invariante Anzeige == Settlement)", () => {
    const params = sponsorV2ParamsOf(card);
    const cal = sponsorV2Calibrate(card, 14, params);
    const terms = sponsorV2LockTerms(card, 14, cal, 1.0, 1.0, params);
    const shown = sponsorV2LadderFromTerms(terms, false, false);
    for (let r = 1; r <= 32; r += 1) {
      expect(shown[r - 1]!).toBeCloseTo(sponsorV2SettleFromTerms(terms, r, false, false), CLOSE);
    }
    // Rang ausserhalb 1..32 wird geklemmt statt zu NaN.
    expect(Number.isFinite(sponsorV2SettleFromTerms(terms, 0, false, false))).toBe(true);
    expect(Number.isFinite(sponsorV2SettleFromTerms(terms, 99, false, false))).toBe(true);
  });

  it("Liga-K wird EX ANTE geloest und trifft die Zielsumme", { timeout: 60_000 }, () => {
    const entries = Array.from({ length: 32 }, (_, i) => {
      const c: SponsorV2Card = {
        rarity: "magisch",
        profile: SPONSOR_V2_PROFILES[i % SPONSOR_V2_PROFILES.length]!,
        curve: SPONSOR_V2_CURVES[i % SPONSOR_V2_CURVES.length]!,
        clause: SPONSOR_V2_CLAUSES[i % SPONSOR_V2_CLAUSES.length]!,
      };
      const e = i + 1;
      return { card: c, expectedRank: e, cal: sponsorV2Calibrate(c, e, sponsorV2ParamsOf(c)) };
    });
    const target = 2078;
    const k = sponsorV2SolveLeagueK(entries, 1.0, target);
    const sum = entries.reduce((a, e) => a + sponsorV2ExpectedPaidAtKLocal(e, 1.0, k), 0);
    expect(sum).toBeCloseTo(target, 2);
    expect(k).toBeGreaterThan(0);
    // Ein schwaecheres Ligajahr muss weniger ausschuetten.
    const kWeak = sponsorV2SolveLeagueK(entries, 0.8, target * 0.8);
    expect(kWeak).toBeLessThan(k);
  });
});

// Kleine lokale Helfer, damit die Tests nicht an Namensdetails des Moduls kleben.
function sponsorV2ClauseByNameLocal(name: string) {
  return SPONSOR_V2_CLAUSES.find((c) => c.name === name)!;
}
function sponsorV2ExpectedPaidAtKLocal(
  entry: { card: SponsorV2Card; expectedRank: number; cal: number }, sf: number, k: number,
): number {
  const params = sponsorV2ParamsOf(entry.card);
  const w = sponsorV2RankDistribution(entry.expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    for (const clauseMet of [true, false]) {
      for (const goalMet of [true, false]) {
        const p = (clauseMet ? params.pClause : 1 - params.pClause) * (goalMet ? params.pGoal : 1 - params.pGoal);
        acc += w[r - 1]! * p * sponsorV2ScaleWithK(
          sponsorV2RawPayout(entry.card, entry.expectedRank, r, entry.cal, params, clauseMet, goalMet),
          entry.card.rarity, sf, k);
      }
    }
  }
  return acc;
}
