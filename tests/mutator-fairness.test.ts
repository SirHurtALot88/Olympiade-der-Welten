/**
 * MUTATOREN — ZWEI GEMELDETE AUFFAELLIGKEITEN, BEIDE BESTAETIGT.
 *
 * Aus dem Spiel gemeldet: "mir kommt es komisch vor, dass JEDES Team Mutatorpunkte bekommt" und
 * "KEIN Spieler bekommt 2x Mutatorpunkte, obwohl er beide ausgewuerfelten Traits haben koennte".
 *
 * Beides war richtig beobachtet:
 *
 * 1) Die Mutatoren sind als DISZIPLIN-Eigenschaft gedacht: zwei Traits, einmal je Spieltag und
 *    Seite aus allen 36 ausgewuerfelt, fuer alle 32 Teams dieselben (so sagt es auch
 *    `getLegacyMutatorSourceSummary`). Die Wertung gab aber einer GESPEICHERTEN Auswahl Vorrang —
 *    und geschrieben wurde die ausschliesslich im KI-Aufstellungspfad, ueber
 *    `selectBestMutatorTraitsForEntries`, das die Traits danach waehlt, WAS DER KADER HAT. Jedes
 *    KI-Team bekam damit garantierte Treffer; das menschliche Team hat kein Auswahlfeld dafuer und
 *    war auf den blinden Wurf angewiesen.
 *
 * 2) Der Score skalierte mit der Trefferzahl (`hits * 6`), die Player-Points nicht — die standen
 *    flach auf 0,3. Ein Spieler mit BEIDEN Traits sah den doppelten Treffer im Score, aber nie in
 *    den PP.
 */
import { describe, expect, it } from "vitest";

import {
  calculateMutatorModifierForSide,
  createDefaultLineupDraftModifiers,
  rollMatchdayMutatorTraitsForSide,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyRosterPlayerRef } from "@/lib/lineups/legacy-lineup-types";

const ROLLED: [string, string] = ["Loyal", "Fearless"];

/** Spieler mit BEIDEN ausgewuerfelten Traits — der Fall, um den es in Punkt 2 geht. */
const doubleHit = { id: "p-double", traitsPositive: ["Loyal", "Fearless"], traitsNegative: [] } as unknown as LegacyRosterPlayerRef;
/** Spieler mit genau EINEM der ausgewuerfelten Traits. */
const singleHit = { id: "p-single", traitsPositive: ["Loyal"], traitsNegative: [] } as unknown as LegacyRosterPlayerRef;
/** Spieler ohne Treffer, aber mit Traits, die eine kadergenaue Auswahl gewaehlt haette. */
const noHit = { id: "p-none", traitsPositive: ["Sexy", "Cool"], traitsNegative: [] } as unknown as LegacyRosterPlayerRef;

function evaluate(modifiers = createDefaultLineupDraftModifiers()) {
  return calculateMutatorModifierForSide({
    modifiers,
    disciplineSide: "d1",
    entries: [{ playerId: "p-double" }, { playerId: "p-single" }, { playerId: "p-none" }],
    rosterPlayers: [doubleHit, singleHit, noHit],
    matchdayMutatorTraits: ROLLED,
  });
}

describe("Mutatoren — der Spieltags-Wurf gilt fuer alle Teams gleich", () => {
  it("der Wurf zieht blind aus dem vollen Pool, ohne jeden Teambezug", () => {
    const seen = new Set<string>();
    for (let matchday = 1; matchday <= 40; matchday += 1) {
      const [a, b] = rollMatchdayMutatorTraitsForSide({
        saveId: "s", seasonId: "season-1", matchdayId: `md-${matchday}`, disciplineSide: "d1", disciplineId: "takeshi",
      });
      expect(a).not.toBe(b); // nie zweimal derselbe Trait
      seen.add(a);
      seen.add(b);
    }
    // Ein Wurf, der sich an Kadern orientiert, traefe immer dieselbe Handvoll. Ueber 40 Spieltage
    // muss ein blinder Zug aus 36 Traits deutlich breiter streuen.
    expect(seen.size).toBeGreaterThan(12);
  });

  it("derselbe Spieltag ergibt fuer jeden Aufruf denselben Wurf (kein Team-Einfluss)", () => {
    const args = { saveId: "s", seasonId: "season-1", matchdayId: "md-3", disciplineSide: "d1" as const, disciplineId: "takeshi" };
    expect(rollMatchdayMutatorTraitsForSide(args)).toEqual(rollMatchdayMutatorTraitsForSide(args));
  });

  /**
   * DER KERN VON PUNKT 1. Eine gespeicherte, kadergenaue Auswahl darf den Wurf NICHT mehr schlagen —
   * sonst spielt die KI mit selbst gewaehlten Mutatoren gegen ein Team mit ausgewuerfelten.
   */
  it("eine gespeicherte kadergenaue Auswahl schlaegt den Wurf NICHT", () => {
    const rigged = createDefaultLineupDraftModifiers();
    rigged.d1.mutatorTrait1 = "Sexy"; // genau die Traits von p-none …
    rigged.d1.mutatorTrait2 = "Cool"; // … also der Versuch, sich Treffer zu verschaffen
    const result = evaluate(rigged);
    expect(result.playerMutatorBonuses["p-none"]).toBeUndefined();
    // Gewertet wird der Wurf: p-double und p-single treffen, p-none nicht.
    expect(result.playerMutatorBonuses["p-double"]).toBe(12);
    expect(result.playerMutatorBonuses["p-single"]).toBe(6);
  });

  it("ohne Wurf bleibt die gespeicherte Auswahl als Rueckfall gueltig (Altspielstaende)", () => {
    const stored = createDefaultLineupDraftModifiers();
    stored.d1.mutatorTrait1 = "Sexy";
    const result = calculateMutatorModifierForSide({
      modifiers: stored,
      disciplineSide: "d1",
      entries: [{ playerId: "p-none" }],
      rosterPlayers: [noHit],
      matchdayMutatorTraits: [],
    });
    expect(result.playerMutatorBonuses["p-none"]).toBe(6);
  });
});

describe("Mutatoren — Score und Player-Points zaehlen dieselbe Bedingung gleich", () => {
  it("zwei Treffer geben doppelten Score UND doppelte Player-Points", () => {
    const result = evaluate();
    expect(result.playerMutatorBonuses["p-double"]).toBe(12);
    expect(result.playerMutatorBonuses["p-single"]).toBe(6);
    // Der eigentliche Fehler: die PP standen frueher fuer BEIDE flach auf 0,3.
    expect(result.playerMutatorPpsBonuses["p-double"]).toBe(0.6);
    expect(result.playerMutatorPpsBonuses["p-single"]).toBe(0.3);
  });

  it("das Verhaeltnis Score zu PP ist fuer einen und fuer zwei Treffer dasselbe", () => {
    const result = evaluate();
    const ratio = (id: string) => result.playerMutatorBonuses[id]! / result.playerMutatorPpsBonuses[id]!;
    expect(ratio("p-double")).toBeCloseTo(ratio("p-single"), 6);
  });

  it("wer keinen der beiden Traits hat, bekommt nichts — weder Score noch PP", () => {
    const result = evaluate();
    expect(result.playerMutatorBonuses["p-none"]).toBeUndefined();
    expect(result.playerMutatorPpsBonuses["p-none"]).toBeUndefined();
  });
});
