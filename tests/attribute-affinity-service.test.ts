import { describe, expect, it } from "vitest";

import type { Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { DEVELOPMENT_MAX_ATTRIBUTE_VALUE, deriveAttributeAffinityProfile } from "@/lib/training/attribute-affinity-service";

function attributes(overrides: Partial<PlayerGeneratorAttributes> = {}): PlayerGeneratorAttributes {
  return {
    power: 55,
    health: 40,
    stamina: 45,
    intelligence: 62,
    awareness: 50,
    determination: 28,
    speed: 73,
    dexterity: 68,
    charisma: 31,
    will: 58,
    spirit: 36,
    torment: 87,
    ...overrides,
  };
}

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-test",
    name: "Test Hero",
    rating: 55,
    marketValue: 30,
    salaryDemand: 6,
    className: "Hero",
    race: "Human",
    alignment: "Good",
    gender: "unknown",
    subclasses: ["Knight"],
    traitsPositive: ["Diligent", "Ambitious"],
    traitsNegative: [],
    coreStats: { pow: 55, spe: 70, men: 60, soc: 50 },
    attributeSheetStats: attributes(),
    attributeSheetRatings: {},
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 60,
    potential: 70,
    ...overrides,
  };
}

describe("attribute-affinity-service", () => {
  it("erzeugt genau 2 Signatures plus 1 Weak, auch wenn ein Attribut bei 99 gedeckelt ist", () => {
    const testPlayer = player({ attributeSheetStats: attributes({ power: DEVELOPMENT_MAX_ATTRIBUTE_VALUE }) });
    const affinity = deriveAttributeAffinityProfile(testPlayer);

    expect(affinity.signatureAttributes).toHaveLength(2);
    expect(affinity.weakAttribute).toBeTruthy();
  });

  it("Signature muss nicht das aktuell hoechste Attribut sein", () => {
    const testPlayer = player({
      className: "Mage",
      attributeSheetStats: attributes({ power: 95, intelligence: 40, will: 42 }),
      traitsPositive: [],
    });
    const affinity = deriveAttributeAffinityProfile(testPlayer);

    expect(affinity.signatureAttributes).toContain("intelligence");
    expect(affinity.signatureAttributes).toContain("will");
  });
});
