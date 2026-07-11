import { describe, expect, it } from "vitest";

import {
  calculateMatchdayProjectedPreview,
  calculateSideSlotRoleModifierTotal,
  getMatchdayIntensityConfig,
  resolveSlotRolesForDiscipline,
} from "@/lib/lineups/matchday-slot-roles";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";

describe("matchday slot roles", () => {
  it("loads the expected roles for Fechten", () => {
    const roles = resolveSlotRolesForDiscipline("fechten", "Fechten", 5);

    expect(roles).toHaveLength(5);
    expect(roles.map((role) => role.label)).toEqual([
      "Duelist",
      "Aggressor",
      "Defender",
      "Technician",
      "Counter Tempo",
    ]);
  });

  it("loads the expected roles for Mini DM", () => {
    const roles = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2);

    expect(roles).toHaveLength(2);
    expect(roles.map((role) => role.label)).toEqual(["Frontliner", "Finisher"]);
  });

  it("defines two positive attributes and one strain attribute per role", () => {
    const role = resolveSlotRolesForDiscipline("fechten", "Fechten", 5)[0];

    expect(role.majorPositiveAttribute).toBe("dexterity");
    expect(role.minorPositiveAttribute).toBe("speed");
    expect(role.strainAttribute).toBe("speed");
  });

  it("builds projected range from base, role, intensity and fatigue", () => {
    const role = resolveSlotRolesForDiscipline("fechten", "Fechten", 5)[0];
    const projected = calculateMatchdayProjectedPreview({
      baseScore: 65,
      role,
      attributeStats: {
        power: 55,
        health: 58,
        stamina: 48,
        intelligence: 40,
        awareness: 50,
        determination: 52,
        speed: 72,
        dexterity: 80,
        charisma: 44,
        will: 41,
        spirit: 39,
        torment: 47,
      },
      currentFatigueCount: 16,
      intensity: "normal",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(projected.roleModifier).toBe(5.3);
    expect(projected.intensityModifier).toBe(0);
    expect(projected.fatiguePenaltyPercent).toBe(5);
    expect(projected.totalProjected).toBe(66.8);
    expect(projected.rangeLow).toBe(62.5);
    expect(projected.rangeHigh).toBe(71.1);
  });

  it("push raises score and fatigue while conserve lowers both", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const shared = {
      baseScore: 60,
      role,
      attributeStats: {
        power: 70,
        health: 78,
        stamina: 44,
        intelligence: 40,
        awareness: 45,
        determination: 51,
        speed: 38,
        dexterity: 42,
        charisma: 30,
        will: 35,
        spirit: 32,
        torment: 50,
      },
      currentFatigueCount: 2,
      knownModifierBonus: 0,
      revealVariance: 2,
    } as const;

    const conserve = calculateMatchdayProjectedPreview({ ...shared, intensity: "conserve" });
    const normal = calculateMatchdayProjectedPreview({ ...shared, intensity: "normal" });
    const push = calculateMatchdayProjectedPreview({ ...shared, intensity: "push" });

    expect(push.intensityModifier).toBe(3);
    expect(push.totalProjected ?? 0).toBeGreaterThan(normal.totalProjected ?? 0);
    expect(push.rangeHigh ?? 0).toBeGreaterThan(conserve.rangeHigh ?? 0);
    expect(push.additionalFatigue).toBeGreaterThan(conserve.additionalFatigue);
  });

  it("warns for high fatigue push situations", () => {
    const role = resolveSlotRolesForDiscipline("fechten", "Fechten", 5)[1];
    const projected = calculateMatchdayProjectedPreview({
      baseScore: 58,
      role,
      attributeStats: {
        power: 68,
        health: 52,
        stamina: 42,
        intelligence: 41,
        awareness: 37,
        determination: 46,
        speed: 57,
        dexterity: 63,
        charisma: 33,
        will: 38,
        spirit: 30,
        torment: 74,
      },
      currentFatigueCount: 70,
      intensity: "push",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(projected.fatigueRisk).toBe("hoch");
    expect(projected.warnings).toContain("Push bei stark belastetem Spieler");
  });

  it("warns when this matchday's own fatigue load crosses the injury-risk threshold (7c)", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const attributeStats = {
      power: 70,
      health: 78,
      stamina: 44,
      intelligence: 40,
      awareness: 45,
      determination: 51,
      speed: 38,
      dexterity: 42,
      charisma: 30,
      will: 35,
      spirit: 32,
      torment: 50,
    } as const;

    // Fresh-ish (28) but pushing hard adds enough additional fatigue to cross the 30
    // threshold this very matchday -- that's the newly-active-risk moment we want flagged.
    const crossing = calculateMatchdayProjectedPreview({
      baseScore: 60,
      role,
      attributeStats,
      currentFatigueCount: 28,
      intensity: "push",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(crossing.projectedFatigueAfterMatchday).toBeGreaterThan(30);
    expect(crossing.crossesInjuryRiskThreshold).toBe(true);
    expect(crossing.warnings.some((warning) => warning.includes("Verletzungsrisiko wird aktiv"))).toBe(true);

    // Already well past the threshold before this matchday -- risk was already active, so
    // this isn't a new "crossing" moment.
    const alreadyAtRisk = calculateMatchdayProjectedPreview({
      baseScore: 60,
      role,
      attributeStats,
      currentFatigueCount: 45,
      intensity: "push",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(alreadyAtRisk.crossesInjuryRiskThreshold).toBe(false);

    // Conserve intensity with low starting fatigue stays comfortably under the threshold.
    const staysSafe = calculateMatchdayProjectedPreview({
      baseScore: 60,
      role,
      attributeStats,
      currentFatigueCount: 5,
      intensity: "conserve",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(staysSafe.projectedFatigueAfterMatchday).toBeLessThanOrEqual(30);
    expect(staysSafe.crossesInjuryRiskThreshold).toBe(false);
  });

  it("maps fatigue 16 to -5 percent performance", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const projected = calculateMatchdayProjectedPreview({
      baseScore: 80,
      role,
      attributeStats: {
        power: 75,
        health: 82,
        stamina: 70,
        intelligence: 40,
        awareness: 49,
        determination: 52,
        speed: 38,
        dexterity: 42,
        charisma: 30,
        will: 35,
        spirit: 32,
        torment: 50,
      },
      currentFatigueCount: 16,
      intensity: "normal",
    });

    expect(projected.fatiguePenaltyPercent).toBe(5);
  });

  it("maps fatigue 32 to -10 percent performance", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const projected = calculateMatchdayProjectedPreview({
      baseScore: 80,
      role,
      attributeStats: {
        power: 75,
        health: 82,
        stamina: 70,
        intelligence: 40,
        awareness: 49,
        determination: 52,
        speed: 38,
        dexterity: 42,
        charisma: 30,
        will: 35,
        spirit: 32,
        torment: 50,
      },
      currentFatigueCount: 32,
      intensity: "normal",
    });

    expect(projected.fatiguePenaltyPercent).toBe(10);
  });

  it("safe lowers output and fatigue versus normal", () => {
    const role = resolveSlotRolesForDiscipline("fechten", "Fechten", 5)[3];
    const shared = {
      baseScore: 64,
      role,
      attributeStats: {
        power: 47,
        health: 55,
        stamina: 62,
        intelligence: 50,
        awareness: 77,
        determination: 51,
        speed: 60,
        dexterity: 68,
        charisma: 30,
        will: 48,
        spirit: 41,
        torment: 36,
      },
      currentFatigueCount: 8,
    } as const;

    const safe = calculateMatchdayProjectedPreview({ ...shared, intensity: "conserve" });
    const normal = calculateMatchdayProjectedPreview({ ...shared, intensity: "normal" });

    expect((safe.totalProjected ?? 0)).toBeLessThan(normal.totalProjected ?? 0);
    expect(safe.additionalFatigue).toBeLessThan(normal.additionalFatigue);
    expect((safe.rangeHigh ?? 0) - (safe.rangeLow ?? 0)).toBeLessThan((normal.rangeHigh ?? 0) - (normal.rangeLow ?? 0));
  });

  it("low strain attribute increases fatigue warning pressure", () => {
    const role = resolveSlotRolesForDiscipline("fechten", "Fechten", 5)[1];
    const lowStrain = calculateMatchdayProjectedPreview({
      baseScore: 58,
      role,
      attributeStats: {
        power: 68,
        health: 52,
        stamina: 42,
        intelligence: 41,
        awareness: 30,
        determination: 46,
        speed: 57,
        dexterity: 63,
        charisma: 33,
        will: 38,
        spirit: 30,
        torment: 74,
      },
      currentFatigueCount: 0,
      intensity: "normal",
    });
    const highStrain = calculateMatchdayProjectedPreview({
      baseScore: 58,
      role,
      attributeStats: {
        power: 68,
        health: 52,
        stamina: 42,
        intelligence: 41,
        awareness: 82,
        determination: 46,
        speed: 57,
        dexterity: 63,
        charisma: 33,
        will: 38,
        spirit: 30,
        torment: 74,
      },
      currentFatigueCount: 0,
      intensity: "normal",
    });

    expect(lowStrain.additionalFatigue).toBeGreaterThan(highStrain.additionalFatigue);
    expect(lowStrain.warnings.some((warning) => warning.includes("Strain-Risiko"))).toBe(true);
  });

  it("role fatigue profile changes fatigue gain", () => {
    const frontliner = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const technician = resolveSlotRolesForDiscipline("fechten", "Fechten", 5)[3];
    const attributeStats = {
      power: 65,
      health: 65,
      stamina: 65,
      intelligence: 50,
      awareness: 65,
      determination: 50,
      speed: 65,
      dexterity: 65,
      charisma: 40,
      will: 50,
      spirit: 40,
      torment: 65,
    };

    const highLoad = calculateMatchdayProjectedPreview({
      baseScore: 65,
      role: frontliner,
      attributeStats,
      currentFatigueCount: 5,
      intensity: "normal",
    });
    const lowLoad = calculateMatchdayProjectedPreview({
      baseScore: 65,
      role: technician,
      attributeStats,
      currentFatigueCount: 5,
      intensity: "normal",
    });

    expect(highLoad.additionalFatigue).toBeGreaterThan(lowLoad.additionalFatigue);
    expect(highLoad.slotStrainLoad).toBe("hoch");
    expect(lowLoad.slotStrainLoad).toBe("niedrig");
  });

  it("exposes the three intensity stages", () => {
    expect(getMatchdayIntensityConfig("conserve").scoreModifier).toBe(-2);
    expect(getMatchdayIntensityConfig("normal").scoreModifier).toBe(0);
    expect(getMatchdayIntensityConfig("push").scoreModifier).toBe(3);
  });

  it("makes push more expensive on large disciplines than on small ones", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const shared = {
      baseScore: 66,
      role,
      attributeStats: {
        power: 70,
        health: 70,
        stamina: 56,
        intelligence: 45,
        awareness: 45,
        determination: 48,
        speed: 42,
        dexterity: 44,
        charisma: 36,
        will: 40,
        spirit: 39,
        torment: 66,
      },
      currentFatigueCount: 4,
      intensity: "push" as const,
    };

    const smallDiscipline = calculateMatchdayProjectedPreview({ ...shared, requiredPlayers: 2 });
    const largeDiscipline = calculateMatchdayProjectedPreview({ ...shared, requiredPlayers: 6 });

    expect(largeDiscipline.additionalFatigue).toBeGreaterThan(smallDiscipline.additionalFatigue);
    expect(largeDiscipline.totalProjected).toBe(smallDiscipline.totalProjected);
  });

  it("caps per-player fatigue gain so push remains usable on large disciplines", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const projected = calculateMatchdayProjectedPreview({
      baseScore: 66,
      role,
      attributeStats: {
        power: 70,
        health: 70,
        stamina: 20,
        intelligence: 45,
        awareness: 45,
        determination: 48,
        speed: 42,
        dexterity: 44,
        charisma: 36,
        will: 40,
        spirit: 39,
        torment: 66,
      },
      currentFatigueCount: 70,
      intensity: "push",
      requiredPlayers: 6,
      rivalryPressure: 2,
    });

    expect(projected.additionalFatigue).toBeLessThanOrEqual(12);
    expect(projected.fatigueRisk).toBe("hoch");
  });

  it("makes rivalry pressure visible as extra push variance and strain", () => {
    const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 2)[0];
    const shared = {
      baseScore: 65,
      role,
      attributeStats: {
        power: 70,
        health: 70,
        stamina: 50,
        intelligence: 45,
        awareness: 45,
        determination: 45,
        speed: 45,
        dexterity: 45,
        charisma: 45,
        will: 45,
        spirit: 45,
        torment: 70,
      },
      currentFatigueCount: 5,
      rivalryPressure: 1.5,
    };

    const normal = calculateMatchdayProjectedPreview({ ...shared, intensity: "normal" });
    const push = calculateMatchdayProjectedPreview({ ...shared, intensity: "push" });

    expect(normal.rivalryPressureModifier).toBe(0);
    expect(push.rivalryPressureModifier).toBe(1.5);
    expect(push.additionalFatigue).toBeGreaterThan(normal.additionalFatigue);
    expect(push.warnings).toContain("Rivalitaetsdruck: Push-Streuung +1.5");
  });

  it("feeds resolve scoring with the same slot role modifier total used in preview", () => {
    const entries = [{ playerId: "p-1", slotIndex: 0 }];
    const rosterPlayers = [
      {
        id: "p-1",
        attributeStats: {
          power: 80,
          health: 70,
          stamina: 55,
          intelligence: 45,
          awareness: 45,
          determination: 45,
          speed: 45,
          dexterity: 45,
          charisma: 45,
          will: 45,
          spirit: 45,
          torment: 70,
        },
      },
    ];
    const disciplineScores = [{ playerId: "p-1", disciplineId: "mini-dm", score: 65 }];
    const slotRoleModifier = calculateSideSlotRoleModifierTotal({
      disciplineId: "fechten",
      disciplineSide: "d1",
      entries,
      rosterPlayers,
      disciplineScores: [{ playerId: "p-1", disciplineId: "fechten", score: 65 }],
      intensity: "normal",
      requiredPlayers: 1,
    });
    const score = scoreLegacyLineupDisciplineSide({
      disciplineId: "fechten",
      disciplineSide: "d1",
      entries: entries.map((entry) => ({ ...entry, disciplineId: "fechten", disciplineSide: "d1", activePlayerId: "a-1" })),
      disciplineScores: [{ playerId: "p-1", disciplineId: "fechten", score: 65 }],
      rosterPlayers,
      requiredPlayers: 1,
      fatigueSourceStatus: "mapped",
      fatigueByPlayerId: { "p-1": { count: 0, multiplier: 1 } },
      slotRoleModifier,
      formCardStatus: "ready",
      formCardsAvailable: 0,
      formCardsSelected: 0,
      formModifier: 0,
      mutatorModifier: 0,
      mutatorBonusByPlayerId: {},
      teamPowerStatus: "ready",
      teamPowerModifier: 0,
      captainStatus: "mapped",
    });

    expect(score.slotRoleModifier).toBe(slotRoleModifier);
  });
});
