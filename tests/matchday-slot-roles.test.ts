import { describe, expect, it } from "vitest";

import {
  calculateMatchdayProjectedPreview,
  getMatchdayIntensityConfig,
  resolveSlotRolesForDiscipline,
} from "@/lib/lineups/matchday-slot-roles";

describe("matchday slot roles", () => {
  it("loads the expected roles for Fechten", () => {
    const roles = resolveSlotRolesForDiscipline("fechten", "Fechten", 5);

    expect(roles).toHaveLength(5);
    expect(roles.map((role) => role.label)).toEqual([
      "Duelist",
      "Aggressor",
      "Defender",
      "Technician",
      "Flex",
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
    expect(role.strainAttribute).toBe("stamina");
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
      currentFatigueCount: 1,
      intensity: "normal",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(projected.roleModifier).toBe(4);
    expect(projected.intensityModifier).toBe(0);
    expect(projected.fatiguePenaltyPercent).toBe(0.5);
    expect(projected.totalProjected).toBe(68.7);
    expect(projected.rangeLow).toBe(64.3);
    expect(projected.rangeHigh).toBe(73.1);
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

    expect(push.intensityModifier).toBe(2);
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
      currentFatigueCount: 3,
      intensity: "push",
      knownModifierBonus: 0,
      revealVariance: 2,
    });

    expect(projected.fatigueRisk).toBe("hoch");
    expect(projected.warnings).toContain("Push bei stark belastetem Spieler");
  });

  it("maps fatigue 10 to -5 percent performance", () => {
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
      currentFatigueCount: 10,
      intensity: "normal",
    });

    expect(projected.fatiguePenaltyPercent).toBe(5);
  });

  it("maps fatigue 20 to -10 percent performance", () => {
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
      currentFatigueCount: 20,
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
      currentFatigueCount: 10,
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
      currentFatigueCount: 10,
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
    expect(getMatchdayIntensityConfig("push").scoreModifier).toBe(2);
  });
});
