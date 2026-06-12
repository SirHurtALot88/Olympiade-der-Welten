import type { PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type {
  AttributeSalaryModifierName,
  AttributeSalaryModifiers,
  SalaryEngineBreakdown,
  SalaryEngineInput,
  TraitSalaryFactors,
} from "@/lib/player-formulas/player-formula-types";

const attributeKeyMap: Record<AttributeSalaryModifierName, keyof PlayerGeneratorAttributes> = {
  Spirit: "spirit",
  Torment: "torment",
  Awareness: "awareness",
  Charisma: "charisma",
  Intelligence: "intelligence",
  Dexterity: "dexterity",
  Speed: "speed",
  Health: "health",
  Power: "power",
  Stamina: "stamina",
  Determination: "determination",
  Will: "will",
};

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function collectTraitEffects(traits: string[], basisSalary: number, traitSalaryFactors: TraitSalaryFactors) {
  const warnings: string[] = [];
  const effects = traits.map((trait) => {
    const factor = traitSalaryFactors[trait];
    if (typeof factor !== "number" || !Number.isFinite(factor)) {
      warnings.push(`unknown_trait_salary_factor:${trait}`);
      return {
        trait,
        factor: null,
        effect: 0,
        known: false,
      };
    }

    return {
      trait,
      factor,
      effect: roundTo2(basisSalary * factor),
      known: true,
    };
  });

  return { effects, warnings };
}

export function calculateSalaryFromMarketValue(input: SalaryEngineInput): SalaryEngineBreakdown {
  const totalAttributes = Object.values(input.attributes).reduce((sum, value) => sum + value, 0);
  const weightedAttributeSalaryBlock = roundTo2(
    (Object.entries(attributeKeyMap) as Array<[AttributeSalaryModifierName, keyof PlayerGeneratorAttributes]>).reduce((sum, [modifierName, attributeKey]) => {
      return sum + input.attributes[attributeKey] * input.attributeSalaryModifiers[modifierName];
    }, 0),
  );
  const basisSalary = roundTo2(
    (input.marketValueNew / 5) * (weightedAttributeSalaryBlock / 5) * ((totalAttributes / 1000) * 3),
  );
  const traitInputs = [...(input.traitsPositive ?? []), ...(input.traitsNegative ?? [])];
  const traitBreakdown = collectTraitEffects(traitInputs, basisSalary, input.traitSalaryFactors);
  const rawFinalSalary = roundTo2(
    basisSalary + traitBreakdown.effects.reduce((sum, effect) => sum + effect.effect, 0),
  );
  const finalSalary = roundTo2(Math.max(0, rawFinalSalary));
  const warnings = [...traitBreakdown.warnings];
  if (rawFinalSalary < 0) {
    warnings.push("salary_floor_applied");
  }

  return {
    totalAttributes,
    weightedAttributeSalaryBlock,
    basisSalary,
    rawFinalSalary,
    traitEffects: traitBreakdown.effects,
    finalSalary,
    warnings,
  };
}
