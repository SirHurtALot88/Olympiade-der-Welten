import { describe, expect, it } from "vitest";

import { calculateTeamPowerModifierForSide, type LegacyTeamPowerOption } from "@/lib/lineups/team-powers";

function createPower(partial?: Partial<LegacyTeamPowerOption>): LegacyTeamPowerOption {
  return {
    id: partial?.id ?? "power-1",
    label: partial?.label ?? "Warpath Power Surge",
    description: partial?.description ?? "Test power",
    category: partial?.category ?? "flex",
    effectType: partial?.effectType ?? "self_boost",
    targetMode: partial?.targetMode ?? "self",
    targetLimit: partial?.targetLimit ?? 0,
    conditionalBonusPct: partial?.conditionalBonusPct ?? 0,
    conditionalTrigger: partial?.conditionalTrigger ?? null,
    conditionalDescription: partial?.conditionalDescription ?? null,
    source: partial?.source ?? "team_identity",
    sourceFacilityId: partial?.sourceFacilityId ?? null,
    modifier: partial?.modifier ?? 6,
    positiveAttributeTags: partial?.positiveAttributeTags ?? ["power", "torment"],
    negativeAttributeTag: partial?.negativeAttributeTag ?? "awareness",
    chargesTotal: partial?.chargesTotal ?? 4,
    chargesUsed: partial?.chargesUsed ?? 0,
    chargesRemaining: partial?.chargesRemaining ?? 4,
    selectedForSeason: partial?.selectedForSeason ?? true,
    isUsedUp: partial?.isUsedUp ?? false,
    isPassive: partial?.isPassive ?? false,
  };
}

describe("team powers", () => {
  it("adds a small attribute-fit bonus when power tags match the discipline weights", () => {
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "power-1" }, d2: { teamPowerId: null } },
      disciplineSide: "d1",
      disciplineId: "mini-dm",
      disciplineCategory: "power",
      teamPowers: [createPower()],
    });

    expect(result.teamPowerBasePct).toBe(6);
    expect(result.teamPowerAttributeFitPct).toBe(2);
    expect(result.teamPowerImpact).toBe(8);
    expect(result.teamPowerLabel).toContain("Power/Torment");
  });

  it("applies a small attribute-fit penalty when the friction tag dominates the discipline", () => {
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "power-1" }, d2: { teamPowerId: null } },
      disciplineSide: "d1",
      disciplineId: "speed-schach",
      disciplineCategory: "mental",
      teamPowers: [createPower()],
    });

    expect(result.teamPowerBasePct).toBe(6);
    expect(result.teamPowerAttributeFitPct).toBeLessThan(0);
    expect(result.teamPowerImpact).toBeLessThan(6);
  });

  it("treats an explicitly selected passive power as no active power (never double-applied)", () => {
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "passive-1" }, d2: { teamPowerId: null } },
      disciplineSide: "d1",
      disciplineId: "mini-dm",
      disciplineCategory: "power",
      teamPowers: [createPower({ id: "passive-1", isPassive: true })],
    });

    expect(result.teamPowerSelected).toBe(0);
    expect(result.teamPowerImpact).toBe(0);
    expect(result.teamPowerLabel).toBeNull();
  });
});
