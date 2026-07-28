/**
 * REPRODUKTION EINER MELDUNG AUS DEM SPIEL: auf d1 lag eine POSITIVE Formkarte (+8, Farbe passend
 * zur Disziplin, also x2), auf d2 eine NEGATIVE — und die Spieltagstabelle zeigte fuer die
 * d1-Spieler ein "Formtief", also einen NEGATIVEN Formanteil.
 *
 * Das ist rechnerisch unmoeglich, wenn d1 wirklich die positive Karte bekommt:
 *   Anteil je Spieler = effektiver Kartenwert + Jitter(-4 .. +4)
 * Bei +8 mit passender Farbe ist der effektive Wert +16, der schlechteste Fall also +12.
 * Ein negativer Anteil auf d1 kann deshalb nur entstehen, wenn die Seiten-Zuordnung der
 * Kartenauswahl verrutscht — wenn d1 die Karte von d2 liest.
 *
 * Der Test prueft genau diese Zuordnung an der Funktion, die beide Seiten beliefert.
 */
import { describe, expect, it } from "vitest";

import type { LegacyFormCardOption } from "@/lib/lineups/legacy-lineup-types";

import {
  calculateFormModifierForSide,
  distributePerPlayerFormShares,
  resolveEffectiveLineupModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { FormCardPlanRecord } from "@/lib/data/olyDataTypes";

const CARDS: LegacyFormCardOption[] = [
  { id: "card-plus", playerId: "p1", playerName: "p1", color: "blue", value: 8, isUsed: false, usedByLineupId: null },
  { id: "card-minus", playerId: "p2", playerName: "p2", color: "blue", value: -4, isUsed: false, usedByLineupId: null },
  // Die gemeldete d2-Karte: -4,0 POW auf einer MEN-Disziplin — Farbe passt NICHT, also kein x2.
  { id: "card-minus-fremd", playerId: "p3", playerName: "p3", color: "red", value: -4, isUsed: false, usedByLineupId: null },
];

/** d1 traegt die positive Karte, d2 die negative — exakt die gemeldete Aufstellung. */
const MODIFIERS = {
  d1: { primaryFormCardId: "card-plus", secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null,
        intensity: "normal" as const, teamPowerId: null },
  d2: { primaryFormCardId: "card-minus", secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null,
        intensity: "normal" as const, teamPowerId: null },
};

function sharesFor(side: "d1" | "d2", playerCount: number) {
  const result = calculateFormModifierForSide({
    modifiers: MODIFIERS,
    disciplineSide: side,
    // Farbe der Disziplin == Farbe der Karte → der x2-Fall, den der Spieler hatte.
    disciplineColor: "blue",
    playerCount,
    formCards: CARDS,
  });
  const seeds = Array.from({ length: playerCount }, (_, i) => `p-${i}|disc-${side}|md-3`);
  return { result, shares: distributePerPlayerFormShares({ formModifier: result.formModifier, seeds }) };
}

describe("Formkarten — Seiten-Zuordnung d1/d2", () => {
  it("d1 bekommt die POSITIVE Karte: kein Spieler darf ein Formtief haben", () => {
    const { result, shares } = sharesFor("d1", 6);
    // +8 x2 = +16 je Spieler, x 6 Spieler = +96 fuer die Disziplin.
    expect(result.formModifier).toBe(96);
    expect(
      shares.filter((share) => share < 0),
      `d1 traegt die +8-Karte, trotzdem negative Anteile: ${shares.join(", ")}`,
    ).toEqual([]);
    // Schaerfer als "nicht negativ": der schlechteste Fall ist +16 - 4 = +12.
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(12);
  });

  it("d2 bekommt die NEGATIVE Karte: dort ist das Formtief korrekt", () => {
    const { result, shares } = sharesFor("d2", 6);
    expect(result.formModifier).toBe(-48);
    expect(shares.every((share) => share < 0)).toBe(true);
  });

  it("die Seiten werden nicht vertauscht — d1 und d2 haben verschiedene Vorzeichen", () => {
    const d1 = sharesFor("d1", 6);
    const d2 = sharesFor("d2", 6);
    expect(Math.sign(d1.result.formModifier)).toBe(1);
    expect(Math.sign(d2.result.formModifier)).toBe(-1);
  });

  /**
   * Die Anzahl der aufgestellten Spieler war im gemeldeten Fall NICHT vollstaendig (9/10 bereit,
   * ein Slot offen). Der Modifier wird mit `playerCount` gebildet, die Verteilung teilt danach
   * durch die tatsaechlich bewerteten Spieler — laufen die auseinander, aendert sich der Betrag.
   * Das Vorzeichen darf davon unter keinen Umstaenden abhaengen.
   */
  it("bei gleicher Spielerzahl haelt das Vorzeichen", () => {
    for (const count of [1, 5, 6, 7]) {
      const { result } = sharesFor("d1", count);
      const seeds = Array.from({ length: count }, (_, i) => `p-${i}|d1|md-3`);
      const shares = distributePerPlayerFormShares({ formModifier: result.formModifier, seeds });
      expect(shares.filter((share) => share < 0), `count=${count}`).toEqual([]);
    }
  });

  /**
   * DER BEHOBENE DEFEKT. Frueher wurde `formModifier` (= Kartenwert x playerCount) durch die Zahl
   * der tatsaechlich BEWERTETEN Spieler geteilt. Liefen die beiden Zahlen auseinander —
   * unvollstaendige Aufstellung, Spieler ohne Score — schrumpfte der flache Anteil unter den Jitter
   * von +-4 und das VORZEICHEN kippte: eine positive Formkarte erzeugte ein "Formtief".
   *
   * Jetzt reicht `formPerPlayer` den Kartenwert direkt durch. Der flache Anteil haengt an keiner
   * Spielerzahl mehr, also kann keine Zahlen-Kombination das Vorzeichen drehen.
   */
  it("abweichende Spielerzahlen kippen das Vorzeichen NICHT mehr", () => {
    for (const declared of [1, 2, 5, 6, 7, 14]) {
      for (const actual of [1, 2, 5, 6, 7, 14]) {
        const { result } = sharesFor("d1", declared);
        const seeds = Array.from({ length: actual }, (_, i) => `p-${i}|d1|md-3`);
        const shares = distributePerPlayerFormShares({
          formPerPlayer: result.formPerPlayer,
          formModifier: result.formModifier,
          seeds,
        });
        expect(
          shares.filter((share) => share < 0),
          `declared=${declared} actual=${actual} erzeugt ein Formtief trotz positiver Karte`,
        ).toEqual([]);
        // Der Anteil ist jetzt UNABHAENGIG von beiden Zahlen: immer Kartenwert +- Jitter.
        expect(Math.min(...shares)).toBeGreaterThanOrEqual(12);
        expect(Math.max(...shares)).toBeLessThanOrEqual(20);
      }
    }
  });

  /** Ohne `formPerPlayer` bleibt der alte Rueckfallweg erhalten — sonst braeche jeder Altaufrufer. */
  it("ohne den Wert je Spieler rechnet der Rueckfallweg weiter wie bisher", () => {
    const shares = distributePerPlayerFormShares({
      formModifier: 96,
      seeds: Array.from({ length: 6 }, (_, i) => `p-${i}|d1|md-3`),
    });
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(12);
  });
});

/**
 * DER GEMELDETE FALL, EINS ZU EINS. Im Auswahlfeld stand auf d1 "+8,0 MEN x2" und auf d2
 * "-4,0 POW". Gerechnet wurde auf d1 mit -4 — dem Wert der d2-Karte: die Spieler zeigten
 * -6,9 / -6,9 / -2,0, also flacher Anteil -4 plus Jitter, statt der zugesagten +12 bis +20.
 *
 * Ursache: die Auswahl liegt an zwei Stellen. Das Auswahlfeld persistiert nach
 * `seasonState.formCardPlans` (und zeigt von dort an), die Score-Engine las `draft.modifiers` —
 * die nur beim SPEICHERN des Entwurfs gefuellt werden. Wer danach eine Karte tauschte, aenderte
 * die Anzeige, nicht die Rechnung.
 */
describe("Formkarten — der Plan ist massgeblich, nicht der Entwurf", () => {
  const plan = (side: "d1" | "d2", cardId: string | null): FormCardPlanRecord => ({
    id: `plan:${side}`, saveId: "s", seasonId: "season-1", teamId: "C-C", matchdayId: "md-3",
    disciplineSide: side, disciplineId: null, primaryFormCardId: cardId, secondaryFormCardId: null,
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
  const scope = { seasonId: "season-1", teamId: "C-C", matchdayId: "md-3" };
  /** Der Entwurf traegt die VERTAUSCHTE Belegung — genau der gemeldete Zustand. */
  const STALE_DRAFT = {
    d1: { ...MODIFIERS.d1, primaryFormCardId: "card-minus-fremd" },
    d2: { ...MODIFIERS.d2, primaryFormCardId: "card-plus" },
  };

  it("der Plan setzt sich gegen einen veralteten Entwurf durch", () => {
    const effective = resolveEffectiveLineupModifiers({
      modifiers: STALE_DRAFT,
      formCardPlans: [plan("d1", "card-plus"), plan("d2", "card-minus-fremd")],
      ...scope,
    });
    expect(effective.d1.primaryFormCardId).toBe("card-plus");
    expect(effective.d2.primaryFormCardId).toBe("card-minus-fremd");
  });

  it("und damit rechnet d1 wieder positiv statt mit der d2-Karte", () => {
    const effective = resolveEffectiveLineupModifiers({
      modifiers: STALE_DRAFT,
      formCardPlans: [plan("d1", "card-plus"), plan("d2", "card-minus-fremd")],
      ...scope,
    });
    const result = calculateFormModifierForSide({
      modifiers: effective, disciplineSide: "d1", disciplineColor: "blue", playerCount: 6, formCards: CARDS,
    });
    expect(result.formPerPlayer).toBe(16);
    const shares = distributePerPlayerFormShares({
      formPerPlayer: result.formPerPlayer,
      seeds: Array.from({ length: 6 }, (_, i) => `p-${i}|d1|md-3`),
    });
    expect(shares.filter((share) => share < 0), `gerechnet: ${shares.join(", ")}`).toEqual([]);
  });

  it("ohne den Fix haette der Entwurf gewonnen — die Gegenprobe", () => {
    const result = calculateFormModifierForSide({
      modifiers: STALE_DRAFT, disciplineSide: "d1", disciplineColor: "blue", playerCount: 6, formCards: CARDS,
    });
    // -4 POW auf einer blauen Disziplin: keine Farbgleichheit, also kein x2 → -4 je Spieler.
    expect(result.formPerPlayer).toBe(-4);
    const shares = distributePerPlayerFormShares({
      formPerPlayer: result.formPerPlayer,
      seeds: Array.from({ length: 6 }, (_, i) => `p-${i}|d1|md-3`),
    });
    // Genau das Fenster, in dem die gemeldeten -6,9 / -6,9 / -2,0 liegen.
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(-8);
    expect(Math.max(...shares)).toBeLessThanOrEqual(0);
  });

  it("eine geleerte Auswahl im Plan loescht die Karte auch in der Rechnung", () => {
    const effective = resolveEffectiveLineupModifiers({
      modifiers: STALE_DRAFT,
      formCardPlans: [plan("d1", null)],
      ...scope,
    });
    expect(effective.d1.primaryFormCardId).toBeNull();
    // Ohne Plan fuer d2 bleibt der Entwurf gueltig — Altspielstaende rechnen unveraendert weiter.
    expect(effective.d2.primaryFormCardId).toBe("card-plus");
  });

  it("ein Plan eines ANDEREN Spieltags greift nicht", () => {
    const foreign = { ...plan("d1", "card-plus"), matchdayId: "md-9" };
    const effective = resolveEffectiveLineupModifiers({ modifiers: STALE_DRAFT, formCardPlans: [foreign], ...scope });
    expect(effective.d1.primaryFormCardId).toBe("card-minus-fremd");
  });
});
