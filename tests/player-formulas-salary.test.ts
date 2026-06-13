import { describe, expect, it } from "vitest";

import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";

describe("player formula salary engine", () => {
  it("loads attribute and trait salary sources from references/formulas", () => {
    const sources = loadPlayerFormulaSources();

    expect(sources.attributeSalaryModifiersStatus).toBe("ready");
    expect(sources.traitSalaryFactorsStatus).toBe("ready");
    expect(sources.rankMarketValueStatus).toBe("ready");
    expect(sources.marketValueEngineStatus).toBe("ready");
    expect(sources.salaryEngineStatus).toBe("ready_if_market_value_input_present");
    expect(sources.classEngineStatus).toBe("heuristic");
  });

  it("calculates basis salary and trait effects from salaryMarketValue, attributes and traits", () => {
    const sources = loadPlayerFormulaSources();
    const result = calculateSalaryFromMarketValue({
      salaryMarketValue: 54,
      attributes: {
        power: 86,
        health: 79,
        stamina: 74,
        intelligence: 42,
        awareness: 48,
        determination: 81,
        speed: 33,
        dexterity: 28,
        charisma: 67,
        will: 76,
        spirit: 18,
        torment: 84,
      },
      traitsPositive: ["Fearless", "Disciplined", "Cool"],
      traitsNegative: ["Cruel", "Vindictive", "Mercenary"],
      attributeSalaryModifiers: sources.attributeSalaryModifiers!,
      traitSalaryFactors: sources.traitSalaryFactors!,
    });

    expect(result.totalAttributes).toBe(716);
    expect(result.weightedAttributeSalaryBlock).toBe(3.26);
    expect(result.salaryMarketValueTerm).toBe(10.8);
    expect(result.weightedAttributeTerm).toBe(0.65);
    expect(result.totalAttributesTerm).toBe(2.15);
    expect(result.basisSalary).toBe(13.6);
    expect(result.traitPercentSum).toBe(0.235);
    expect(result.finalSalary).toBe(16.8);
    expect(result.warnings).toEqual([]);
  });

  it("warns on unknown traits without inventing a salary effect", () => {
    const sources = loadPlayerFormulaSources();
    const result = calculateSalaryFromMarketValue({
      salaryMarketValue: 20,
      attributes: {
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
      },
      traitsPositive: ["Unknown Trait"],
      traitsNegative: [],
      attributeSalaryModifiers: sources.attributeSalaryModifiers!,
      traitSalaryFactors: sources.traitSalaryFactors!,
    });

    expect(result.traitEffects[0]).toEqual({
      trait: "Unknown Trait",
      factor: null,
      effect: 0,
      known: false,
    });
    expect(result.warnings).toEqual(["unknown_trait_salary_factor:Unknown Trait"]);
  });

  it("floors negative calculated salaries and marks the floor in warnings", () => {
    const sources = loadPlayerFormulaSources();
    const result = calculateSalaryFromMarketValue({
      salaryMarketValue: 42.5,
      attributes: {
        power: 70,
        health: 55,
        stamina: 60,
        intelligence: 48,
        awareness: 62,
        determination: 51,
        speed: 66,
        dexterity: 64,
        charisma: 58,
        will: 72,
        spirit: 57,
        torment: 45,
      },
      traitsPositive: [],
      traitsNegative: Array.from({ length: 20 }, () => "Timid"),
      attributeSalaryModifiers: sources.attributeSalaryModifiers!,
      traitSalaryFactors: sources.traitSalaryFactors!,
    });

    expect(result.rawFinalSalary).toBeLessThan(0);
    expect(result.finalSalary).toBe(0);
    expect(result.warnings).toContain("salary_floor_applied");
  });
});
