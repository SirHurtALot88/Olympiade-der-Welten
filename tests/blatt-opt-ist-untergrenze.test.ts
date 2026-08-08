/**
 * GEMELDET: „wenn c-c gerne 13 leute hätte wären 11 auch noch ok aber auf minimum zu gehen ist
 * scheiße" — und spaeter, als Teams mit vollem Konto nicht mehr kauften: „die teams müssen lernen
 * nicht so viel geld aufzunehmen und wenn dann soll es auch investiert werden!"
 *
 * BEFUND, am Spielstand gemessen: es gab DREI Kaderziele fuer dasselbe Team. Der kaufende Planer
 * rechnete mit `deriveUtilityWeights` (Blatt-Opt plus GM-Nudge), Sitzung und Kreditpruefung mit
 * `resolvePlannerRosterTargets` (Blatt-Opt plus Kaderstress). Der Nudge wirkte in BEIDE Richtungen
 * und zog das Ziel unter das Blatt:
 *
 *     B-P  Blatt 9  -> Planer 8      Cash 37.8, kaufte nichts mehr
 *     H-R  Blatt 11 -> Planer 9      Cash 30.4
 *     M-S  Blatt 13 -> Planer 12     Cash 20.4
 *
 * Ab Kader >= Planer-Ziel springt der Kaufpuffer vom Notwert 5 auf den vollen Betrag (bei B-P 26.2)
 * und der Rotationsnutzen faellt auf 0 — das Team gilt als fertig. Die Sitzung sah dieselbe Lage als
 * Luecke und lieh dafuer sogar Geld: fuenf der sieben Kredite stammten aus dem zweiten Durchgang,
 * der gegen das hoehere Ziel mass.
 *
 * GEMESSEN, jeweils ab demselben Zustand nach dem Saisonwechsel (32 Teams, Kader 234):
 *
 *   heute                       Kader 337, investiert 2711.4, liegengeblieben 134.7, stark 44
 *   Ziel nach UNTEN vereint     Kader 335, investiert 2692.2, liegengeblieben 153.9, stark 44
 *   Blatt-Opt als Untergrenze   Kader 337, investiert 2757.4, liegengeblieben  87.9, stark 47
 *
 * Die erste Richtung war meine und war falsch: einigt man sich auf die kleinere Zahl, hoeren die
 * Teams noch frueher auf. Richtig ist das Blatt als Untergrenze — die Persoenlichkeit darf
 * daraufsatteln, aber nicht darunter.
 */
import { describe, expect, it } from "vitest";

import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";

const NEUTRALER_GM = {
  rosterDepthPreference: 5,
  eliteSmallRosterPreference: 5,
  cashPriority: 5,
  riskTolerance: 5,
  wageSensitivity: 5,
  starPriority: 5,
  valuePriority: 5,
  sellForProfitAggression: 5,
  shortContractPreference: 5,
  longContractPreference: 5,
  loyaltyBias: 5,
  harmonyStrictness: 5,
};

const identitaet = (playerOpt: number) => ({
  playerOpt,
  playerMin: 8,
  playerMax: 14,
  ambition: 5,
  finances: 5,
  harmony: 5,
  boardConfidence: 5,
});

const ziel = (playerOpt: number, gm: Partial<typeof NEUTRALER_GM> = {}) =>
  deriveUtilityWeights(identitaet(playerOpt) as never, { ...NEUTRALER_GM, ...gm } as never, null).optTarget;

describe("Das Blatt-Opt ist die Untergrenze des Kaderziels", () => {
  it("ein Elite-GM darf nicht unter das Blatt ziehen", () => {
    // Genau der gemessene Fall H-R: Blatt 11, Planer landete bei 9.
    expect(ziel(11, { eliteSmallRosterPreference: 9, rosterDepthPreference: 1 })).toBeGreaterThanOrEqual(11);
  });

  it("auch bei maximalem Elite-Bias nicht", () => {
    expect(ziel(9, { eliteSmallRosterPreference: 10, rosterDepthPreference: 0 })).toBeGreaterThanOrEqual(9);
  });

  it("ein Tiefen-GM darf weiterhin DARUEBER liegen", () => {
    // Die Persoenlichkeit bleibt wirksam — sie sattelt nur auf, statt abzuziehen.
    expect(ziel(9, { rosterDepthPreference: 9, eliteSmallRosterPreference: 1 })).toBeGreaterThan(9);
  });

  it("ein neutraler GM landet genau auf dem Blatt", () => {
    // Ohne Ausschlag in eine Richtung soll schlicht das stehen, was im Blatt steht.
    expect(ziel(12)).toBe(12);
  });

  it("gilt ueber die ganze Spanne der Blattwerte", () => {
    for (const blatt of [8, 9, 10, 11, 12, 13, 14]) {
      expect(ziel(blatt, { eliteSmallRosterPreference: 10, rosterDepthPreference: 0 })).toBeGreaterThanOrEqual(blatt);
    }
  });
});
