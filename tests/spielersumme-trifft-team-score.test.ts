/**
 * GEMELDET VON CHRIS: „alle boni etc sind doch auf die spieler verteilt und die summe in der
 * tabelle oben muesste 1:1 dem entsprechen was auch unten ist."
 *
 * Sie musste es, tat es aber nicht. Vier Terme kamen NACH der Spielersumme obendrauf —
 * Intensitaet, Slot-Rollen, Mutator-Rest und Team-Power. Am Live-Abbild gemessen klaffte
 * dadurch in 59 % aller 608 gewerteten Team-Zeilen eine Luecke von 5 Punkten und mehr
 * zwischen Kopf und Bahnen; im schlimmsten Fall 46,0 Punkte.
 *
 * Diese Datei haelt die Invariante fest, die das beendet: die Summe der Spieler-Scores IST
 * der Seiten-Score. Nicht ungefaehr, sondern auf die Anzeige-Genauigkeit genau.
 */
import { describe, expect, it } from "vitest";

import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";

function baueEintraege(anzahl: number): LegacyLineupEntryInput[] {
  return Array.from({ length: anzahl }, (_, index) => ({
    playerId: `p-${index}`,
    activePlayerId: `a-${index}`,
    disciplineId: "mini-dm",
    disciplineSide: "d1" as const,
    slotIndex: index,
    isCaptain: index === 0,
  }));
}

function score(overrides: Parameters<typeof scoreLegacyLineupDisciplineSide>[0] extends infer T ? Partial<T> : never) {
  const eintraege = baueEintraege(4);
  return scoreLegacyLineupDisciplineSide({
    disciplineId: "mini-dm",
    disciplineSide: "d1",
    matchdayId: "matchday-3",
    entries: eintraege,
    disciplineScores: eintraege.map((entry, index) => ({
      playerId: entry.playerId,
      disciplineId: "mini-dm",
      score: [64, 41, 27, 12][index]!,
    })),
    rosterPlayers: eintraege.map((entry, index) => ({ id: entry.playerId, name: `Spieler ${index}` })),
    requiredPlayers: 4,
    fatigueSourceStatus: "mapped",
    fatigueByPlayerId: Object.fromEntries(eintraege.map((entry) => [entry.playerId, { count: 2, multiplier: 0.94 }])),
    formCardStatus: "ready",
    formCardsAvailable: 2,
    formCardsSelected: 1,
    formModifier: 6,
    formPerPlayer: 6,
    mutatorModifier: 0,
    ...overrides,
  } as Parameters<typeof scoreLegacyLineupDisciplineSide>[0]);
}

function spielerSumme(ergebnis: ReturnType<typeof scoreLegacyLineupDisciplineSide>) {
  return Math.round(ergebnis.entries.reduce((summe, entry) => summe + (entry.finalContribution ?? 0), 0) * 10) / 10;
}

describe("Die Spielersumme IST der Team-Score", () => {
  for (const intensity of ["conserve", "normal", "push"] as const) {
    it(`trifft den Seiten-Score bei Intensitaet „${intensity}"`, () => {
      const ergebnis = score({ intensity });
      expect(spielerSumme(ergebnis)).toBe(ergebnis.totalScore);
    });
  }

  it("trifft ihn auch mit Slot-Rollen je Spieler", () => {
    const ergebnis = score({
      slotRoleModifier: -5.1,
      slotRoleModifierByPlayerId: { "p-0": 2.4, "p-1": -3.5, "p-2": -1.9, "p-3": -2.1 },
    });
    expect(spielerSumme(ergebnis)).toBe(ergebnis.totalScore);
  });

  it("trifft ihn auch mit Team-Power obendrauf", () => {
    const ergebnis = score({
      teamPowerStatus: "ready",
      teamPowerEffectType: "self_boost",
      teamPowerImpact: 12,
    });
    expect(ergebnis.teamPowerModifier).not.toBeNull();
    expect(spielerSumme(ergebnis)).toBe(ergebnis.totalScore);
  });

  it("gibt jedem Spieler SEINEN Rollen-Modifikator, nicht einen Durchschnitt", () => {
    const ergebnis = score({
      slotRoleModifier: -5.1,
      slotRoleModifierByPlayerId: { "p-0": 2.4, "p-1": -3.5, "p-2": -1.9, "p-3": -2.1 },
    });
    expect(ergebnis.entries.map((entry) => entry.slotRoleShare)).toEqual([2.4, -3.5, -1.9, -2.1]);
  });

  /**
   * Der Rundungsrest darf nicht wieder am letzten Slot haengen — genau das war der Fehler,
   * den Chris gesehen hat, nur eine Groessenordnung kleiner.
   */
  it("legt den Rest der Seiten-Effekte anteilig, nicht auf den letzten Slot", () => {
    const ergebnis = score({
      teamPowerStatus: "ready",
      teamPowerEffectType: "self_boost",
      teamPowerImpact: 12,
    });
    const anteile = ergebnis.entries.map((entry) => entry.teamPowerShare ?? 0);
    expect(anteile.every((anteil) => anteil > 0)).toBe(true);
    // Anteilig heisst: der staerkste Spieler traegt den groessten Anteil.
    expect(anteile[0]).toBeGreaterThan(anteile.at(-1)!);
  });
});
