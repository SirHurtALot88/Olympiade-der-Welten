import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  calculateFormModifierForSide,
  calculateMutatorModifierForSide,
  calculateMvpForcedMutatorModifierForSide,
  calculatePerPlayerFormModifier,
  buildMatchdayMutatorTraitsBySide,
  formatCompactFormCardLabel,
  rollMatchdayMutatorTraitsForSide,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import type { LegacyLineupContext } from "@/lib/lineups/legacy-lineup-types";

function createBaseContext(): LegacyLineupContext {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    entries: [
      {
        disciplineId: "tdm",
        disciplineSide: "d1",
        slotIndex: 0,
        playerId: "player-1",
        activePlayerId: "active-1",
      },
      {
        disciplineId: "tdm",
        disciplineSide: "d1",
        slotIndex: 1,
        playerId: "player-2",
        activePlayerId: "active-2",
      },
      {
        disciplineId: "tdm",
        disciplineSide: "d2",
        slotIndex: 0,
        playerId: "player-3",
        activePlayerId: "active-3",
      },
      {
        disciplineId: "tdm",
        disciplineSide: "d2",
        slotIndex: 1,
        playerId: "player-4",
        activePlayerId: "active-4",
      },
    ],
    disciplinePlayerCounts: {
      tdm: 2,
    },
    activePlayers: [
      { id: "active-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      { id: "active-2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-2" },
      { id: "active-3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-3" },
      { id: "active-4", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-4" },
    ],
    disciplineScores: [
      { playerId: "player-1", disciplineId: "tdm", score: 10 },
      { playerId: "player-2", disciplineId: "tdm", score: 20 },
      { playerId: "player-3", disciplineId: "tdm", score: 30 },
      { playerId: "player-4", disciplineId: "tdm", score: 40 },
    ],
  };
}

describe("legacy lineup form-card modifiers", () => {
  it("keeps matching form cards as a side total but exposes the per-player value for slot previews", () => {
    const result = calculateFormModifierForSide({
      modifiers: {
        d1: {
          primaryFormCardId: "card-8",
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: null,
          intensity: "normal",
        },
        d2: {
          primaryFormCardId: null,
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: null,
          intensity: "normal",
        },
      },
      disciplineSide: "d1",
      disciplineColor: "yellow",
      playerCount: 5,
      formCards: [
        {
          id: "card-8",
          playerId: "player-1",
          playerName: "Form Player",
          color: "yellow",
          value: 8,
          isUsed: false,
          usedByLineupId: null,
        },
      ],
    });

    expect(result.formModifier).toBe(80);
    expect(result.formCardLabel).toBe("Y+8×2");
    expect(
      calculatePerPlayerFormModifier({
        formModifier: result.formModifier,
        selectedPlayers: 5,
        requiredPlayers: 5,
      }),
    ).toBe(16);
  });

  it("uses required player count as fallback when a slot preview has no selected count yet", () => {
    expect(
      calculatePerPlayerFormModifier({
        formModifier: 80,
        selectedPlayers: 0,
        requiredPlayers: 5,
      }),
    ).toBe(16);
  });

  it("formats selected form cards as compact color codes without player names", () => {
    expect(formatCompactFormCardLabel({ color: "yellow", value: -4 })).toBe("Y-4");
    expect(formatCompactFormCardLabel({ color: "green", value: 8 }, true)).toBe("G+8×2");

    const result = calculateFormModifierForSide({
      modifiers: {
        d1: {
          primaryFormCardId: "card-neg",
          secondaryFormCardId: "card-pos",
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: null,
          intensity: "normal",
        },
        d2: {
          primaryFormCardId: null,
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: null,
          intensity: "normal",
        },
      },
      disciplineSide: "d1",
      disciplineColor: "green",
      playerCount: 4,
      formCards: [
        {
          id: "card-neg",
          playerId: "player-1",
          playerName: "Hidden Name",
          color: "yellow",
          value: -4,
          isUsed: false,
          usedByLineupId: null,
        },
        {
          id: "card-pos",
          playerId: "player-2",
          playerName: "Also Hidden",
          color: "red",
          value: 8,
          isUsed: false,
          usedByLineupId: null,
        },
      ],
    });

    expect(result.formCardLabel).toBe("Y-4 · R+8");
  });
});

describe("legacy lineup score engine", () => {
  it("laesst Score UND Player-PPs mit der Trefferzahl skalieren (0/1/2 → +0/+6/+12 bzw. 0/0,3/0,6)", () => {
    /**
     * Hiess frueher „... while player PPs are capped once per active player" und hielt genau
     * die Ungleichbehandlung fest, die inzwischen behoben ist: Der Score skalierte mit der
     * Trefferzahl (`hits * 6`), die Player-Points standen flach auf 0,3 — egal ob ein Spieler
     * einen oder beide ausgewuerfelten Traits hatte. Ein doppelter Treffer war im Score
     * sichtbar, in den PPs nicht.
     *
     * Zwei Waehrungen fuer dieselbe Bedingung duerfen nicht unterschiedlich zaehlen; die
     * Begruendung steht bei `playerMutatorPpsBonuses` in legacy-lineup-modifiers.ts.
     */
    const baseInput = {
      disciplineSide: "d1" as const,
      entries: [{ playerId: "player-1" }],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Player 1",
          traitsPositive: ["Cool", "Diligent"],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
      ],
    };

    const zero = calculateMutatorModifierForSide({
      ...baseInput,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Lazy", mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
    });
    const one = calculateMutatorModifierForSide({
      ...baseInput,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Cool", mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
    });
    const two = calculateMutatorModifierForSide({
      ...baseInput,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Cool", mutatorTrait2: "Diligent" },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
    });

    expect(zero.mutatorModifier).toBe(0);
    expect(zero.playerMutatorPpsBonuses["player-1"]).toBeUndefined();
    expect(one.mutatorModifier).toBe(6);
    expect(one.playerMutatorPpsBonuses["player-1"]).toBe(0.3);
    expect(two.mutatorModifier).toBe(12);
    // Zwei Treffer ⇒ doppelte PPs, genau wie der Score sich verdoppelt.
    expect(two.playerMutatorPpsBonuses["player-1"]).toBe(0.6);
    expect(two.mutatorSlots[0]?.playerPpsModifier).toBe(0.3);
    expect(two.mutatorSlots[1]?.playerPpsModifier).toBe(0.3);
  });

  it("counts mutator hits per selected player like Retool", () => {
    const result = calculateMutatorModifierForSide({
      disciplineSide: "d1",
      entries: [{ playerId: "player-1" }, { playerId: "player-2" }],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Player 1",
          traitsPositive: ["Cool"],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
        {
          id: "player-2",
          name: "Player 2",
          traitsPositive: ["Cool"],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
      ],
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Cool", mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
    });

    expect(result.mutatorModifier).toBe(12);
    expect(result.playerMutatorPpsBonuses["player-1"]).toBe(0.3);
    expect(result.playerMutatorPpsBonuses["player-2"]).toBe(0.3);
    expect(result.mutatorSlots[0]?.hitCount).toBe(2);
    expect(result.mutatorSlots[0]?.scoreModifier).toBe(12);
  });

  it("only counts active discipline-side entries for mutator bonuses", () => {
    const result = calculateMutatorModifierForSide({
      disciplineSide: "d1",
      entries: [{ playerId: "active-player" }, { playerId: "active-player" }],
      rosterPlayers: [
        {
          id: "active-player",
          name: "Active Player",
          traitsPositive: ["Cool"],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
        {
          id: "bench-player",
          name: "Bench Player",
          traitsPositive: ["Cool", "Diligent"],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
      ],
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Cool", mutatorTrait2: "Diligent" },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
    });

    expect(result.mutatorModifier).toBe(6);
    expect(result.playerMutatorPpsBonuses["active-player"]).toBe(0.3);
    expect(result.playerMutatorPpsBonuses["bench-player"]).toBeUndefined();
    expect(result.mutatorSlots[0]?.hitCount).toBe(1);
    expect(result.mutatorSlots[1]?.hitCount).toBe(0);
  });

  it("rolls the same matchday mutator traits for every team on a discipline side", () => {
    const scope = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      disciplineSide: "d1" as const,
      disciplineId: "football",
    };
    const sharedTraits = rollMatchdayMutatorTraitsForSide(scope);
    const rosterPlayers = [
      {
        id: "player-1",
        name: "Player 1",
        traitsPositive: [sharedTraits[0]],
        traitsNegative: [],
        coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
      },
      {
        id: "player-2",
        name: "Player 2",
        traitsPositive: [sharedTraits[1]],
        traitsNegative: [],
        coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
      },
    ];
    const modifiers = {
      d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
    };

    const teamA = calculateMutatorModifierForSide({
      disciplineSide: "d1",
      entries: [{ playerId: "player-1" }],
      rosterPlayers,
      modifiers,
      matchdayMutatorTraits: sharedTraits,
    });
    const teamB = calculateMutatorModifierForSide({
      disciplineSide: "d1",
      entries: [{ playerId: "player-2" }],
      rosterPlayers,
      modifiers,
      matchdayMutatorTraits: sharedTraits,
    });

    expect(teamA.mutatorText).toBe(teamB.mutatorText);
    expect(teamA.mutatorSlots.map((slot) => slot.label)).toEqual(teamB.mutatorSlots.map((slot) => slot.label));
    expect(teamA.mutatorModifier).toBe(6);
    expect(teamB.mutatorModifier).toBe(6);
    expect(buildMatchdayMutatorTraitsBySide({
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      matchdayId: scope.matchdayId,
      d1DisciplineId: scope.disciplineId,
      d2DisciplineId: "other",
    }).d1).toEqual(sharedTraits);
  });

  it("laesst den Spieltags-Wurf vor einer gespeicherten Auswahl gelten — gespeichert ist nur Rueckfall", () => {
    /**
     * Hiess frueher „honors a stored mutator selection over the rolled matchday traits" — und
     * beschrieb damit die Reihenfolge, die inzwischen bewusst umgedreht wurde.
     *
     * Grund (ausfuehrlich in legacy-lineup-modifiers.ts): Mutatoren sind eine Eigenschaft der
     * DISZIPLIN — zwei Traits, einmal je Spieltag und Seite ausgewuerfelt, fuer alle 32 Teams
     * dieselben. Eine gespeicherte Auswahl schreibt aber ausschliesslich der KI-Aufstellungspfad
     * (`selectBestMutatorTraitsForEntries`), und der waehlt danach aus, WAS DER KADER HAT. Jedes
     * KI-Team bekam damit garantierte Treffer, jeden Spieltag; das menschliche Team hat kein
     * solches Feld und fiel auf den blinden Wurf zurueck. Aus einem Wurf, der fuer alle gleich
     * sein sollte, war ein KI-Vorteil geworden.
     *
     * Gespeicherte Traits bleiben als RUECKFALL — fuer Vorschauen und Altspielstaende ohne Wurf.
     */
    const scope = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      disciplineSide: "d1" as const,
      disciplineId: "football",
    };
    const rolledTraits = rollMatchdayMutatorTraitsForSide(scope);
    // Der Spieler passt NICHT zu den ausgewuerfelten Traits, aber zur gespeicherten Auswahl "Cool".
    expect(rolledTraits).not.toContain("Cool");
    const rosterPlayers = [
      {
        id: "player-1",
        name: "Player 1",
        traitsPositive: ["Cool"],
        traitsNegative: [],
        coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
      },
    ];

    const mitGespeicherterAuswahl = calculateMutatorModifierForSide({
      disciplineSide: "d1",
      entries: [{ playerId: "player-1" }],
      rosterPlayers,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Cool", mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      matchdayMutatorTraits: rolledTraits,
    });

    // Der Wurf gewinnt: Die gespeicherte "Cool"-Auswahl aendert nichts, der Spieler trifft nicht.
    expect(mitGespeicherterAuswahl.mutatorText).toBe(rolledTraits.join(", "));
    expect(mitGespeicherterAuswahl.mutatorModifier).toBe(0);
    expect(mitGespeicherterAuswahl.playerMutatorPpsBonuses["player-1"]).toBeUndefined();

    // Ohne Wurf (Vorschau, Altspielstand) greift die gespeicherte Auswahl weiterhin.
    const ohneWurf = calculateMutatorModifierForSide({
      disciplineSide: "d1",
      entries: [{ playerId: "player-1" }],
      rosterPlayers,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: "Cool", mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      matchdayMutatorTraits: [],
    });
    expect(ohneWurf.mutatorText).toBe("Cool");
    expect(ohneWurf.mutatorModifier).toBe(6);
    expect(ohneWurf.playerMutatorPpsBonuses["player-1"]).toBe(0.3);
  });

  it("uses real active player traits for forced MVP mutators instead of fake labels", () => {
    const result = calculateMvpForcedMutatorModifierForSide({
      disciplineId: "tdm",
      disciplineSide: "d1",
      entries: [{ playerId: "player-1" }, { playerId: "player-2" }, { playerId: "player-3" }],
      disciplineScores: [
        { playerId: "player-1", disciplineId: "tdm", score: 50 },
        { playerId: "player-2", disciplineId: "tdm", score: 40 },
        { playerId: "player-3", disciplineId: "tdm", score: 30 },
      ],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Player 1",
          traitsPositive: ["Motivated"],
          traitsNegative: ["Diva"],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
        {
          id: "player-2",
          name: "Player 2",
          traitsPositive: ["Motivated"],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
        {
          id: "player-3",
          name: "Player 3",
          traitsPositive: [],
          traitsNegative: ["Diva"],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
      ],
    });

    expect(result.mutatorMode).toBe("mvp_forced_mutators");
    expect(result.mutatorText).toBe("Motivated, Diva");
    expect(result.mutatorSlots.map((slot) => slot.label)).toEqual(["Motivated", "Diva"]);
    expect(result.mutatorSlots.map((slot) => slot.scoreModifier)).toEqual([12, 12]);
    // Player 1 traegt BEIDE Mutator-Traits ("Motivated" und "Diva") — zwei Treffer, also
    // doppelte PPs. Player 2 und 3 haben je einen. Dieselbe Regel wie oben: Score und PPs
    // skalieren beide mit der Trefferzahl.
    expect(result.playerMutatorPpsBonuses["player-1"]).toBe(0.6);
    expect(result.playerMutatorPpsBonuses["player-2"]).toBe(0.3);
    expect(result.playerMutatorPpsBonuses["player-3"]).toBe(0.3);
    expect(result.mutatorSlots.some((slot) => slot.label.includes("MVP Force"))).toBe(false);
  });

  it("sums known discipline scores correctly", () => {
    const context = createBaseContext();

    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d1",
      entries: context.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: 2,
      captainMode: "legacy_strongest_selected",
    });

    expect(result.entries.map((entry) => entry.score)).toEqual([10, 20]);
    expect(result.baseScore).toBe(30);
    expect(result.captainBonusTotal).toBe(0);
    // Intensität trägt jetzt eine seeded Streuung bei (Normal −2..+2/Spieler) — Basis-Summe ohne den
    // Intensitäts-Term prüfen, damit der Test das Aufsummieren testet, nicht den Zufallswert.
    expect(result.totalScore - (result.intensityModifier ?? 0)).toBeCloseTo(30, 5);
  });

  it("warns when a discipline score is missing", () => {
    const context = createBaseContext();
    context.disciplineScores = context.disciplineScores.filter((entry) => entry.playerId !== "player-2");

    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d1",
      entries: context.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: 2,
      captainMode: "legacy_strongest_selected",
    });

    expect(result.entries.map((entry) => entry.score)).toEqual([10, null]);
    expect(result.totalScore - (result.intensityModifier ?? 0)).toBeCloseTo(10, 5);
    expect(result.missingScores).toHaveLength(1);
    expect(result.validationWarnings.some((warning) => warning.includes("Missing discipline score"))).toBe(true);
    expect(result.modifierWarnings).toContain("Fatigue source is missing for tdm/d1.");
  });

  it("applies captain bonus to the strongest selected player when legacy captain mode is enabled", () => {
    const context = createBaseContext();
    context.entries[2] = { ...context.entries[2], isCaptain: true };

    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d2",
      entries: context.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: 2,
      captainMode: "legacy_strongest_selected",
    });

    expect(result.baseScore).toBe(70);
    expect(result.captainBonusTotal).toBe(20);
    expect(result.totalScore - (result.intensityModifier ?? 0)).toBeCloseTo(90, 5);
    expect(result.entries[1]?.finalContribution).toBe(60);
    expect(result.validationWarnings.some((warning) => warning.includes("strongest selected player score"))).toBe(true);
  });

  it("applies fatigue multiplier when a mapped fatigue source exists", () => {
    const context = createBaseContext();
    context.entries[2] = { ...context.entries[2], isCaptain: true };

    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d2",
      entries: context.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: 2,
      captainMode: "legacy_strongest_selected",
      fatigueSourceStatus: "mapped",
      fatigueByPlayerId: {
        "player-3": { count: 1, multiplier: 0.95 },
        "player-4": { count: 2, multiplier: 0.9 },
      },
    });

    expect(result.fatigueModifier).toBe(-5.5);
    expect(result.captainBonusTotal).toBe(18);
    expect(result.totalScore - (result.intensityModifier ?? 0)).toBeCloseTo(82.5, 5);
  });

  it("applies mutator score to matching players and keeps mutator PPs as a separate breakdown", () => {
    const context = createBaseContext();
    context.entries[0] = { ...context.entries[0], isCaptain: true };
    context.disciplineScores = [
      { playerId: "player-1", disciplineId: "tdm", score: 30 },
      { playerId: "player-2", disciplineId: "tdm", score: 15.9 },
      { playerId: "player-3", disciplineId: "tdm", score: 30 },
      { playerId: "player-4", disciplineId: "tdm", score: 40 },
    ];

    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d1",
      entries: context.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: 2,
      captainMode: "legacy_strongest_selected",
      fatigueSourceStatus: "mapped",
      fatigueByPlayerId: {
        "player-1": { count: 2, multiplier: 0.5 },
        "player-2": { count: 0, multiplier: 1 },
      },
      formCardsAvailable: 2,
      formCardsSelected: 1,
      formModifier: 4,
      mutatorModifier: 12,
      mutatorBonusByPlayerId: {
        "player-1": 12,
      },
      mutatorPpsBonusByPlayerId: {
        "player-1": 0.3,
      },
      rosterPlayers: [
        {
          id: "player-1",
          name: "Player 1",
          traitsPositive: ["Cool", "Diligent"],
          traitsNegative: ["Lazy", "Mercenary"],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
        {
          id: "player-2",
          name: "Player 2",
          traitsPositive: [],
          traitsNegative: [],
          coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
        },
      ],
    });

    expect(result.baseScore).toBe(45.9);
    expect(result.fatigueModifier).toBe(-15);
    expect(result.captainBonusTotal).toBe(8);
    // Form ist jetzt PRO SPIELER (flach 2 = 4/2 + ±4-Jitter, 2 Spieler); die
    // gemeldete Form-Summe wackelt bewusst um den Nominalwert 4.
    expect(result.formModifier).toBeGreaterThanOrEqual(4 - 8);
    expect(result.formModifier).toBeLessThanOrEqual(4 + 8);
    expect(result.mutatorModifier).toBe(12);
    expect(result.entries[0]?.mutatorBonus).toBe(12);
    expect(result.entries[0]?.mutatorPpsBonus).toBe(0.3);
    // finalContribution enthält jetzt den Pro-Spieler-Form-Anteil (war 27 OHNE Form).
    expect(result.entries[0]?.finalContribution).toBeCloseTo(27 + (result.entries[0]?.formShare ?? 0), 1);
    expect(result.entries[1]?.captainBonus).toBe(8);
    expect(result.entries[1]?.finalContribution).toBeCloseTo(23.9 + (result.entries[1]?.formShare ?? 0), 1);
    // totalScore = Beiträge ohne Form (50,9) + tatsächliche Form-Summe.
    expect(result.totalScore).toBeCloseTo(50.9 + (result.formModifier ?? 0) + (result.intensityModifier ?? 0), 1);
  });
});

describe("legacy lineup validator", () => {
  it("flags duplicate players across d1 and d2", () => {
    const context = createBaseContext();
    context.entries[2] = {
      ...context.entries[2],
      playerId: "player-1",
      activePlayerId: "active-1",
    };

    const result = validateLegacyLineupContext(context);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((entry) => entry.includes("used more than once"))).toBe(true);
  });

  it("flags wrong entry counts", () => {
    const context = createBaseContext();
    context.entries = context.entries.filter((entry) => !(entry.disciplineSide === "d2" && entry.slotIndex === 1));

    const result = validateLegacyLineupContext(context);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Discipline tdm on d2 expects 2 entries, but received 1.");
  });
});

describe("legacy lineup draft ui contract", () => {
  /**
   * DER „CLASSIC"-BAUM IST WEG — ENTSCHIEDEN (Chris: „classic aufstellungsbaum brauchen wir
   * nicht mehr").
   *
   * Was hier frueher stand, war ein uebersprungener Fall, der ein Dutzend Marken des klassischen
   * Arbeitsbereichs im Quelltext suchte (`legacy-lineup-main-flow`, `legacy-lineup-captain-strip`,
   * `legacy-lineup-progress-track`, `legacy-lineup-quick-assign-row`, „Vorschlag bewusst setzen"
   * und weitere). Ein frueherer Durchgang hatte das als moeglichen Feature-Verlust eingeordnet und
   * bewusst offen gelassen.
   *
   * NACHGEMESSEN, bevor entschieden wurde: null Fundstellen fuer JEDE dieser Marken in `app/`,
   * `lib/` und `components/`. Der Baum war also nicht „unerreichbar", sondern gar nicht mehr da;
   * uebrig war ein Schalter (`uiVariant`) mit nur noch einer Stellung. Beides ist jetzt entfernt.
   *
   * Was BLEIBT, steht unten: der Formplan-Weg, den derselbe Fall mitgeprueft hat und der
   * weiterlebt. Ihn mit dem toten Rest zu streichen waere der zweite Fehler nach dem ersten.
   */
  it("haelt den Formplan-Weg im Client und im FormBoardPanel", async () => {
    const fs = await import("node:fs/promises");
    const [lineupText, formBoardText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/FormBoardPanel.tsx"), "utf8"),
    ]);

    // Der Client mountet das Formplan-Panel und traegt den Speicherweg der Formkarten.
    expect(lineupText).toContain("FormBoardPanel");
    expect(lineupText).toContain("updateFormCardSelection");
    expect(lineupText).toContain("queueFormCardPlanSave");
    expect(lineupText).toContain("renderInlineFormCardSelectors");
    expect(lineupText).toContain("scheduleHoveredCandidate");

    // Und das Panel rendert wirklich ein Formkarten-Deck, keine leere Huelle.
    expect(formBoardText).toContain("legacy-lineup-form-deck");
    expect(formBoardText).toContain("legacy-lineup-form-board-chip-picks");
    expect(formBoardText).toContain("legacy-lineup-form-board-cell-velo-strip");
  });

  it("kennt die klassische Variante nicht mehr — auch nicht als Schalter", async () => {
    const fs = await import("node:fs/promises");
    const lineupText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );

    // Der Schalter ist weg — nicht nur seine zweite Stellung. Ein `uiVariant`, das nur noch
    // „focusV2" annehmen kann, waere derselbe tote Zweig unter anderem Namen.
    expect(lineupText).not.toContain("uiVariant?:");
    expect(lineupText).not.toContain('"classic"');

    /**
     * HIER WURDE FRUEHER AUCH `lib/foundation/tabs/use-lineup-derivations.ts` GELESEN — die Datei
     * gibt es nicht mehr.
     *
     * Sie trug den Varianten-Typ und seinen Resolver; geprueft wurde, dass beide daraus
     * verschwunden sind. Inzwischen ist die ganze Datei entfernt, zusammen mit dem
     * Aufstellungs-Shell-Host und dem Router-Baustein darueber: die Kette hatte nachgezaehlt
     * keinen Aufrufer mehr, die Live-Shell rendert das Panel direkt.
     *
     * Eine geloeschte Datei ist die schaerfere Zusicherung als eine Datei ohne die beiden Namen —
     * geprueft wird deshalb jetzt ihr Nichtvorhandensein. Kaeme sie zurueck, waere das eine
     * bewusste Entscheidung und keine schleichende Rueckkehr.
     */
    const { existsSync } = await import("node:fs");
    expect(
      existsSync(path.join(process.cwd(), "lib/foundation/tabs/use-lineup-derivations.ts")),
      "use-lineup-derivations.ts ist zurueck — dann gehoert die Zusicherung neu gefasst",
    ).toBe(false);

    // Und die Marken des alten Baums kommen nicht zurueck.
    for (const marke of [
      "legacy-lineup-main-flow",
      "legacy-lineup-captain-strip",
      "legacy-lineup-progress-track",
      "legacy-lineup-quick-assign-row",
      "Vorschlag bewusst setzen",
    ]) {
      expect(lineupText, `${marke} ist zurueck`).not.toContain(marke);
    }
  });
});
