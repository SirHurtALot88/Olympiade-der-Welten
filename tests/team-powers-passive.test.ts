import { describe, expect, it } from "vitest";

import { calculatePassiveTeamPowerBonus, type LegacyTeamPowerOption } from "@/lib/lineups/team-powers";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";

function createPower(partial?: Partial<LegacyTeamPowerOption>): LegacyTeamPowerOption {
  return {
    id: partial?.id ?? "power-1",
    label: partial?.label ?? "Identität: Power Surge",
    description: partial?.description ?? "Test passive power",
    category: partial?.category ?? "power",
    effectType: partial?.effectType ?? "self_boost",
    targetMode: partial?.targetMode ?? "self",
    targetLimit: partial?.targetLimit ?? 0,
    conditionalBonusPct: partial?.conditionalBonusPct ?? 0,
    conditionalTrigger: partial?.conditionalTrigger ?? null,
    conditionalDescription: partial?.conditionalDescription ?? null,
    source: partial?.source ?? "team_identity",
    sourceFacilityId: partial?.sourceFacilityId ?? null,
    modifier: partial?.modifier ?? 3,
    positiveAttributeTags: partial?.positiveAttributeTags ?? ["power", "health"],
    negativeAttributeTag: partial?.negativeAttributeTag ?? "speed",
    chargesTotal: partial?.chargesTotal ?? 0,
    chargesUsed: partial?.chargesUsed ?? 0,
    chargesRemaining: partial?.chargesRemaining ?? 0,
    selectedForSeason: partial?.selectedForSeason ?? true,
    isUsedUp: partial?.isUsedUp ?? false,
    isPassive: partial?.isPassive ?? false,
  };
}

describe("calculatePassiveTeamPowerBonus", () => {
  it("returns the passive modifier at full value when the discipline category matches", () => {
    const bonus = calculatePassiveTeamPowerBonus(
      [createPower({ isPassive: true, category: "power", modifier: 3 })],
      "power",
    );
    expect(bonus).toBe(3);
  });

  it("returns the passive modifier at full value for flex category regardless of discipline", () => {
    const bonus = calculatePassiveTeamPowerBonus(
      [createPower({ isPassive: true, category: "flex", modifier: 2 })],
      "mental",
    );
    expect(bonus).toBe(2);
  });

  it("scales the passive modifier by 0.6 when the discipline category does not match", () => {
    const bonus = calculatePassiveTeamPowerBonus(
      [createPower({ isPassive: true, category: "power", modifier: 3 })],
      "mental",
    );
    expect(bonus).toBe(1.8);
  });

  it("returns 0 when no passive power is present", () => {
    const bonus = calculatePassiveTeamPowerBonus(
      [createPower({ isPassive: false, category: "power", modifier: 3 })],
      "power",
    );
    expect(bonus).toBe(0);
  });

  it("returns 0 for an empty team powers list", () => {
    const bonus = calculatePassiveTeamPowerBonus([], "power");
    expect(bonus).toBe(0);
  });

  it("clamps the bonus to a maximum of 3 even if the stored modifier is higher", () => {
    const bonus = calculatePassiveTeamPowerBonus(
      [createPower({ isPassive: true, category: "flex", modifier: 8 })],
      "power",
    );
    expect(bonus).toBe(3);
  });
});

describe("passive team power score wiring", () => {
  const baseInput = {
    disciplineId: "fechten",
    disciplineSide: "d1" as const,
    entries: [{ playerId: "p-1", slotIndex: 0, disciplineId: "fechten", disciplineSide: "d1" as const, activePlayerId: "a-1" }],
    disciplineScores: [{ playerId: "p-1", disciplineId: "fechten", score: 100 }],
    rosterPlayers: [
      {
        id: "p-1",
        attributeStats: {
          power: 60, health: 60, stamina: 60, intelligence: 60, awareness: 60, determination: 60,
          speed: 60, dexterity: 60, charisma: 60, will: 60, spirit: 60, torment: 60,
        },
      },
    ],
    requiredPlayers: 1,
    fatigueSourceStatus: "mapped" as const,
    fatigueByPlayerId: { "p-1": { count: 0, multiplier: 1 } },
    formCardStatus: "ready" as const,
    formCardsAvailable: 0,
    formCardsSelected: 0,
    formModifier: 0,
    mutatorModifier: 0,
    mutatorBonusByPlayerId: {},
    captainStatus: "mapped" as const,
  };

  it("applies the passive to the total score even when no team power is selected", () => {
    const withoutPassive = scoreLegacyLineupDisciplineSide({
      ...baseInput,
      teamPowerStatus: "ready",
      teamPowerEffectType: null,
      teamPowerImpact: 0,
      passiveTeamPowerImpactPct: 0,
    });
    const withPassive = scoreLegacyLineupDisciplineSide({
      ...baseInput,
      teamPowerStatus: "ready",
      teamPowerEffectType: null,
      teamPowerImpact: 0,
      passiveTeamPowerImpactPct: 3,
    });

    // Passive is applied as a percentage of the pre-power score, so the total must rise even though
    // no power is manually selected (effectType null → the selected-power gate is off).
    expect(withPassive.totalScore).toBeGreaterThan(withoutPassive.totalScore);
    expect(withPassive.teamPowerModifier ?? 0).toBeGreaterThan(0);
  });

  it("stacks the passive on top of a selected self_boost power", () => {
    const selectedOnly = scoreLegacyLineupDisciplineSide({
      ...baseInput,
      teamPowerStatus: "ready",
      teamPowerEffectType: "self_boost",
      teamPowerImpact: 5,
      passiveTeamPowerImpactPct: 0,
    });
    const selectedPlusPassive = scoreLegacyLineupDisciplineSide({
      ...baseInput,
      teamPowerStatus: "ready",
      teamPowerEffectType: "self_boost",
      teamPowerImpact: 5,
      passiveTeamPowerImpactPct: 3,
    });

    expect(selectedPlusPassive.totalScore).toBeGreaterThan(selectedOnly.totalScore);
  });
});
