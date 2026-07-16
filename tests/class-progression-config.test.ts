import { describe, expect, it } from "vitest";

import {
  calculateDynamicClassName,
  CANONICAL_NEGATIVE_TRAITS,
  CANONICAL_POSITIVE_TRAITS,
  CLASS_PROGRESSION_WEIGHTS,
  getClassTrainingSignals,
} from "@/lib/training/class-progression-config";
import type { PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";

const baseAttributes: PlayerGeneratorAttributes = {
  power: 40,
  health: 40,
  stamina: 40,
  intelligence: 40,
  awareness: 40,
  determination: 40,
  speed: 40,
  dexterity: 40,
  charisma: 40,
  will: 40,
  spirit: 40,
  torment: 40,
};

describe("class progression config", () => {
  it("uses only the canonical 18 positive and 18 negative traits", () => {
    expect(CANONICAL_POSITIVE_TRAITS).toHaveLength(18);
    expect(CANONICAL_NEGATIVE_TRAITS).toHaveLength(18);
    expect(CANONICAL_POSITIVE_TRAITS).toContain("Diligent");
    expect(CANONICAL_POSITIVE_TRAITS).toContain("Motivated");
    expect(CANONICAL_NEGATIVE_TRAITS).toContain("Lazy");
    expect([...CANONICAL_POSITIVE_TRAITS, ...CANONICAL_NEGATIVE_TRAITS]).not.toContain("InjuryProne");
  });

  it("keeps the corrected decimal factors from the class calculator", () => {
    expect(CLASS_PROGRESSION_WEIGHTS.Berserker.speed).toBe(0.625);
    expect(CLASS_PROGRESSION_WEIGHTS.Mage.awareness).toBe(0.425);
    expect(CLASS_PROGRESSION_WEIGHTS.Bard.dexterity).toBe(0.675);
    expect(CLASS_PROGRESSION_WEIGHTS.Tactician.awareness).toBe(0.825);
  });

  it("calculates the highest weighted class from attributes", () => {
    expect(calculateDynamicClassName({ ...baseAttributes, speed: 92, dexterity: 86, stamina: 78 })).toBe("Sprinter");
    expect(calculateDynamicClassName({ ...baseAttributes, power: 95, stamina: 95, speed: 75, torment: 75, charisma: 30 })).toBe("Berserker");
    expect(calculateDynamicClassName({ ...baseAttributes, intelligence: 90, awareness: 92, charisma: 80 })).toBe("Overseer");
  });

  it("exposes readable primary and risk attributes for training UI", () => {
    const charger = getClassTrainingSignals("Charger");
    expect(charger.primaryAttributes.map((entry) => entry.attribute)).toEqual(["speed", "stamina", "power"]);
    expect(charger.negativeRisks.map((entry) => entry.attribute)).toEqual(["awareness", "intelligence"]);
  });
});
