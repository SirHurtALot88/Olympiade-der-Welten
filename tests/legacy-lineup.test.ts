import { describe, expect, it } from "vitest";

import { calculateMutatorModifierForSide } from "@/lib/lineups/legacy-lineup-modifiers";
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

describe("legacy lineup score engine", () => {
  it("maps 0, 1 and 2 matching mutators to +0, +6 and +12 score while player PPs use +0.3 per hit", () => {
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
    expect(two.playerMutatorPpsBonuses["player-1"]).toBe(0.6);
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
    });

    expect(result.entries.map((entry) => entry.score)).toEqual([10, 20]);
    expect(result.baseScore).toBe(30);
    expect(result.captainBonusTotal).toBe(0);
    expect(result.totalScore).toBe(30);
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
    });

    expect(result.entries.map((entry) => entry.score)).toEqual([10, null]);
    expect(result.totalScore).toBe(10);
    expect(result.missingScores).toHaveLength(1);
    expect(result.validationWarnings.some((warning) => warning.includes("Missing discipline score"))).toBe(true);
    expect(result.modifierWarnings).toContain("Fatigue source is missing for tdm/d1.");
  });

  it("applies captain bonus to the strongest selected player when a captain is enabled", () => {
    const context = createBaseContext();
    context.entries[2] = { ...context.entries[2], isCaptain: true };

    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d2",
      entries: context.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: 2,
    });

    expect(result.baseScore).toBe(70);
    expect(result.captainBonusTotal).toBe(20);
    expect(result.totalScore).toBe(90);
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
      fatigueSourceStatus: "mapped",
      fatigueByPlayerId: {
        "player-3": { count: 1, multiplier: 0.95 },
        "player-4": { count: 2, multiplier: 0.9 },
      },
    });

    expect(result.fatigueModifier).toBe(-5.5);
    expect(result.captainBonusTotal).toBe(18);
    expect(result.totalScore).toBe(82.5);
  });

  it("applies mutator score as a team-level bonus after fatigue/current and captain, while PPs stay separate", () => {
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
      fatigueSourceStatus: "mapped",
      fatigueByPlayerId: {
        "player-1": { count: 2, multiplier: 0.5 },
        "player-2": { count: 0, multiplier: 1 },
      },
      formCardsAvailable: 2,
      formCardsSelected: 1,
      formModifier: 4,
      mutatorModifier: 12,
      mutatorBonusByPlayerId: {},
      mutatorPpsBonusByPlayerId: {
        "player-1": 0.6,
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
    expect(result.formModifier).toBe(4);
    expect(result.mutatorModifier).toBe(12);
    expect(result.entries[0]?.mutatorBonus).toBe(0);
    expect(result.entries[0]?.mutatorPpsBonus).toBe(0.6);
    expect(result.entries[0]?.finalContribution).toBe(15);
    expect(result.entries[1]?.captainBonus).toBe(8);
    expect(result.entries[1]?.finalContribution).toBe(23.9);
    expect(result.totalScore).toBe(54.9);
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
