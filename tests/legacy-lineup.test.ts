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
  it("maps 0, 1 and 2 matching mutators to +0, +6 and +12 score while player PPs are capped once per active player", () => {
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
    expect(two.playerMutatorPpsBonuses["player-1"]).toBe(0.3);
    expect(two.mutatorSlots[0]?.playerPpsModifier).toBe(0.3);
    expect(two.mutatorSlots[1]?.playerPpsModifier).toBe(0);
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
    expect(result.playerMutatorPpsBonuses["player-1"]).toBe(0.3);
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
      captainMode: "legacy_strongest_selected",
    });

    expect(result.entries.map((entry) => entry.score)).toEqual([10, null]);
    expect(result.totalScore).toBe(10);
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
      captainMode: "legacy_strongest_selected",
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
    expect(result.formModifier).toBe(4);
    expect(result.mutatorModifier).toBe(12);
    expect(result.entries[0]?.mutatorBonus).toBe(12);
    expect(result.entries[0]?.mutatorPpsBonus).toBe(0.3);
    expect(result.entries[0]?.finalContribution).toBe(27);
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

describe("legacy lineup draft ui contract", () => {
  it("keeps draft workspace as primary with captain strip, progress and quick assign", async () => {
    const fs = await import("node:fs/promises");
    const lineupPath = path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");
    const cssPath = path.join(process.cwd(), "app/globals.css");
    const [lineupText, cssText] = await Promise.all([fs.readFile(lineupPath, "utf8"), fs.readFile(cssPath, "utf8")]);

    expect(lineupText).toContain("SHOW_DRAFT_LINEUP_WORKSPACE = true");
    expect(lineupText).toContain("{showExpertBackupPanels ? (");
    expect(lineupText).toContain('className="legacy-lineup-main-flow"');
    expect(lineupText).toContain("legacy-lineup-captain-strip");
    expect(lineupText).toContain("Vorschlag bewusst setzen");
    expect(lineupText).toContain("legacy-lineup-progress-track");
    expect(lineupText).toContain("updateFormCardSelection");
    expect(lineupText).toContain("renderInlineFormCardSelectors");
    expect(lineupText).toContain("queueFormCardPlanSave");
    expect(lineupText).toContain("LegacyLineupSlotMicroSteps");
    expect(lineupText).toContain("legacy-lineup-quick-assign-row");
    expect(lineupText).toContain("LegacyLineupCandidateReasonChips");
    expect(lineupText).toContain("legacy-lineup-draft-flow-chip");
    expect(lineupText).toContain("Spieltag wird geladen");
    expect(lineupText).toContain('role="tablist"');
    expect(lineupText).toContain("Formplan");
    const formBoardText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/FormBoardPanel.tsx"),
      "utf8",
    );
    expect(formBoardText).toContain("legacy-lineup-form-deck");
    expect(formBoardText).toContain("legacy-lineup-form-board-chip-picks");
    expect(lineupText).not.toContain("Im Formplan bearbeiten");
    expect(lineupText).not.toContain("legacy-lineup-draft-tactics-form-readonly");
    expect(lineupText).toContain("legacy-lineup-draft-tactics-form");
    expect(lineupText).toContain("legacy-lineup-team-tactics-form");
    expect(lineupText).toContain("FormBoardPanel");
    expect(lineupText).toContain("DraftWorkspace");
    expect(lineupText).toContain("LineupExpertPanels");
    expect(lineupText).not.toContain("legacy-lineup-team-tactics-form-readonly");
    expect(lineupText).toContain("scheduleHoveredCandidate");
    expect(formBoardText).toContain("legacy-lineup-form-board-cell-velo-strip");
    expect(cssText).not.toContain(".legacy-lineup-draft-intensity-preview");
    expect(cssText).toContain(".legacy-lineup-draft-flow-chip");
  });
});
