import { describe, expect, it } from "vitest";

import type { Player, PlayerGeneratorAttributeName, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { AttributeHeadroomState } from "@/lib/scouting/player-attribute-ceiling-service";
import { estimateClassTrainingGains } from "@/lib/training/class-training-gain-estimate";

const baseAttrs: PlayerGeneratorAttributes = {
  power: 50,
  health: 50,
  stamina: 50,
  intelligence: 50,
  awareness: 50,
  determination: 50,
  speed: 50,
  dexterity: 50,
  charisma: 50,
  will: 50,
  spirit: 50,
  torment: 50,
};

function player(partial: Partial<Player> & { attributeSheetStats?: PlayerGeneratorAttributes } = {}): Player {
  return {
    id: partial.id ?? "p-1",
    name: partial.name ?? "Test Player",
    rating: partial.rating ?? 70,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 5,
    className: partial.className ?? "Charger",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: partial.attributeSheetStats ?? baseAttrs,
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 70,
    trainingMode: partial.trainingMode ?? "mittel",
    trainingClass: partial.trainingClass ?? null,
  } as Player;
}

const OPEN_CEILINGS: Partial<Record<PlayerGeneratorAttributeName, AttributeHeadroomState>> = {
  power: "open",
  health: "open",
  stamina: "open",
  intelligence: "open",
  awareness: "open",
  determination: "open",
  speed: "open",
  dexterity: "open",
  charisma: "open",
  will: "open",
  spirit: "open",
  torment: "open",
};

describe("estimateClassTrainingGains", () => {
  it("differentiates classes with different attribute distributions for a player with a clear signature/weak profile, even when no attribute is capped", () => {
    // Highest attributes -> signature (intelligence, will per deriveAttributeAffinityProfile sort);
    // lowest attribute -> weak (torment).
    const attrs: PlayerGeneratorAttributes = {
      ...baseAttrs,
      intelligence: 90,
      will: 88,
      torment: 5,
    };
    const p = player({ className: "Mage", attributeSheetStats: attrs });

    const results = estimateClassTrainingGains({
      player: p,
      currentClassName: "Mage",
      trainingSetpoints: 10,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    });

    const mage = results.find((r) => r.className === "Mage")!;
    const berserker = results.find((r) => r.className === "Berserker")!;
    expect(mage.estimatedGain).not.toBeCloseTo(berserker.estimatedGain, 5);
  });

  it("scores a class concentrating on capped attributes lower than one on fully open attributes", () => {
    const p = player({ className: "Warlord" });
    const ceilings: Partial<Record<PlayerGeneratorAttributeName, AttributeHeadroomState>> = {
      ...OPEN_CEILINGS,
      power: "capped",
      health: "capped",
      charisma: "capped",
    };

    const results = estimateClassTrainingGains({
      player: p,
      currentClassName: "Warlord",
      trainingSetpoints: 10,
      ceilingStateByAttribute: ceilings,
      adminBalancingConfig: null,
    });

    // Warlord weights heavily on power/health/charisma (all capped here); Tactician spreads
    // across intelligence/awareness/spirit/torment (all open) -> Tactician should score higher.
    const warlord = results.find((r) => r.className === "Warlord")!;
    const tactician = results.find((r) => r.className === "Tactician")!;
    expect(tactician.estimatedGain).toBeGreaterThan(warlord.estimatedGain);
  });

  it("ranks a class targeting the player's signature attributes above one targeting the weak attribute", () => {
    const attrs: PlayerGeneratorAttributes = {
      ...baseAttrs,
      intelligence: 95,
      will: 92,
      torment: 2,
    };
    const p = player({ className: "Hero", attributeSheetStats: attrs });

    const results = estimateClassTrainingGains({
      player: p,
      currentClassName: "Hero",
      trainingSetpoints: 10,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    });

    // Mage overweights intelligence/will (signature); Badass overweights torment (weak) + power.
    const mage = results.find((r) => r.className === "Mage")!;
    const badass = results.find((r) => r.className === "Badass")!;
    expect(mage.estimatedGain).toBeGreaterThan(badass.estimatedGain);
  });

  it("shifts results when a per-class route bonus applies", () => {
    const p = player({ className: "Tank" });
    // Current class is Rogue (SPE route) so the POW-route bonus below isn't divided back out of the
    // budget for Tank itself (which would otherwise self-cancel).
    const base = {
      player: p,
      currentClassName: "Rogue",
      trainingSetpoints: 10,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    } as const;

    const withoutFocus = estimateClassTrainingGains({ ...base, trainingFocusAxis: null });
    const withPowFocus = estimateClassTrainingGains({ ...base, trainingFocusAxis: "pow" });

    // Tank's route is POW; matching team training focus should bump its gain via the route bonus.
    const tankNoFocus = withoutFocus.find((r) => r.className === "Tank")!;
    const tankPowFocus = withPowFocus.find((r) => r.className === "Tank")!;
    expect(tankPowFocus.estimatedGain).toBeGreaterThan(tankNoFocus.estimatedGain);

    // A MEN-route class (e.g. Mage) should be unaffected by a POW focus.
    const mageNoFocus = withoutFocus.find((r) => r.className === "Mage")!;
    const magePowFocus = withPowFocus.find((r) => r.className === "Mage")!;
    expect(magePowFocus.estimatedGain).toBeCloseTo(mageNoFocus.estimatedGain, 5);
  });

  it("flags the current class via isCurrentClass", () => {
    const p = player({ className: "Rogue" });
    const results = estimateClassTrainingGains({
      player: p,
      currentClassName: "Rogue",
      trainingSetpoints: 10,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    });

    const flagged = results.filter((r) => r.isCurrentClass);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.className).toBe("Rogue");
  });

  it("is deterministic — same input yields same output", () => {
    const p = player({ className: "Sprinter", attributeSheetStats: { ...baseAttrs, speed: 85, dexterity: 80, health: 10 } });
    const input = {
      player: p,
      currentClassName: "Sprinter",
      trainingSetpoints: 12.5,
      ceilingStateByAttribute: OPEN_CEILINGS,
      adminBalancingConfig: null,
    } as const;

    const first = estimateClassTrainingGains(input);
    const second = estimateClassTrainingGains(input);
    expect(second).toEqual(first);
  });
});
