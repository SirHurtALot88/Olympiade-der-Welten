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
} from "@/lib/lineups/legacy-lineup-modifiers";

const CARDS: LegacyFormCardOption[] = [
  { id: "card-plus", playerId: "p1", playerName: "p1", color: "blue", value: 8, isUsed: false, usedByLineupId: null },
  { id: "card-minus", playerId: "p2", playerName: "p2", color: "blue", value: -4, isUsed: false, usedByLineupId: null },
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
   * BEKANNTER DEFEKT — bewusst als `fails` festgehalten, damit er dokumentiert ist und der Tag
   * auffliegt, an dem jemand ihn behebt (dann wird dieser Test unerwartet gruen).
   *
   * `formModifier` wird mit `playerCount` MULTIPLIZIERT (Aufrufer: die Zahl der besetzten Slots der
   * Seite) und in der Verteilung durch die Zahl der tatsaechlich BEWERTETEN Spieler geteilt. Beide
   * Zahlen sollen gleich sein — dann heben sich Mal und Geteilt auf und jeder Spieler bekommt genau
   * den Kartenwert. Laufen sie auseinander (unvollstaendige Aufstellung, Spieler ohne Score),
   * schrumpft der flache Anteil unter den Jitter von +-4 und das VORZEICHEN kippt: eine positive
   * Karte erzeugt dann ein "Formtief" von bis zu -4.
   *
   * Die saubere Behebung ist, den Wert PRO SPIELER durchzureichen statt ihn zu multiplizieren und
   * gleich wieder zu teilen. Das aendert die Form-Balance im ganzen Spiel und gehoert deshalb nicht
   * nebenbei in einen Diagnose-Commit.
   */
  it.fails("DEFEKT: abweichende Spielerzahlen kippen das Vorzeichen der Formkarte", () => {
    const { result } = sharesFor("d1", 1); // Modifier fuer 1 Spieler gebildet …
    const seeds = Array.from({ length: 7 }, (_, i) => `p-${i}|d1|md-3`); // … auf 7 verteilt
    const shares = distributePerPlayerFormShares({ formModifier: result.formModifier, seeds });
    expect(shares.filter((share) => share < 0)).toEqual([]);
  });
});
