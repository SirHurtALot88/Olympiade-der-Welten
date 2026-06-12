import attributeSalaryModifiersJson from "@/references/formulas/attribute-salary-modifiers.json";
import rankToDisciplineMarketValueJson from "@/references/formulas/rank-to-discipline-market-value.json";
import traitSalaryFactorsJson from "@/references/formulas/trait-salary-factors.json";

import type {
  AttributeSalaryModifiers,
  ClassFactorRow,
  PlayerFormulaSourceBundle,
  RankToDisciplineMarketValueRow,
  TraitSalaryFactors,
} from "@/lib/player-formulas/player-formula-types";

const expectedAttributeModifierKeys = [
  "Spirit",
  "Torment",
  "Awareness",
  "Charisma",
  "Intelligence",
  "Dexterity",
  "Speed",
  "Health",
  "Power",
  "Stamina",
  "Determination",
  "Will",
] as const;

const rankTableValidationSamples = [
  { rank: 1, disciplineMarketValue: 6.5 },
  { rank: 50, disciplineMarketValue: 5.0 },
  { rank: 100, disciplineMarketValue: 4.3 },
  { rank: 400, disciplineMarketValue: 2.5 },
  { rank: 1000, disciplineMarketValue: 1.55 },
  { rank: 1600, disciplineMarketValue: 1.0 },
  { rank: 3000, disciplineMarketValue: 0.1 },
  { rank: 3600, disciplineMarketValue: 0.0 },
] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateAttributeSalaryModifiers(input: unknown): AttributeSalaryModifiers | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  for (const key of expectedAttributeModifierKeys) {
    if (!isFiniteNumber(record[key])) {
      return null;
    }
  }

  return record as unknown as AttributeSalaryModifiers;
}

function validateTraitSalaryFactors(input: unknown): TraitSalaryFactors | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const invalidEntry = Object.values(record).some((value) => !isFiniteNumber(value));
  if (invalidEntry) {
    return null;
  }

  return record as TraitSalaryFactors;
}

function normalizeRankTable(input: unknown): RankToDisciplineMarketValueRow[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const rows = input
    .filter((row): row is RankToDisciplineMarketValueRow => {
      return Boolean(
        row &&
          typeof row === "object" &&
          isFiniteNumber((row as { rank?: unknown }).rank) &&
          isFiniteNumber((row as { disciplineMarketValue?: unknown }).disciplineMarketValue),
      );
    })
    .sort((left, right) => left.rank - right.rank);

  if (rows.length !== input.length) {
    return null;
  }

  return rows;
}

function isCompleteRankTable(rows: RankToDisciplineMarketValueRow[] | null) {
  if (!rows || rows.length < 3600) {
    return false;
  }

  const byRank = new Map(rows.map((row) => [row.rank, row.disciplineMarketValue] as const));
  for (let rank = 1; rank <= 3600; rank += 1) {
    if (!byRank.has(rank)) {
      return false;
    }
  }

  for (const sample of rankTableValidationSamples) {
    const value = byRank.get(sample.rank);
    if (value == null || Math.abs(value - sample.disciplineMarketValue) > 0.000001) {
      return false;
    }
  }

  return true;
}

function validateClassFactors(input: unknown): ClassFactorRow[] | null {
  if (!Array.isArray(input) || input.length === 0) {
    return null;
  }

  const rows = input.filter((row): row is ClassFactorRow => {
    if (!row || typeof row !== "object") {
      return false;
    }
    const className = (row as { className?: unknown }).className;
    const factors = (row as { factors?: unknown }).factors;
    if (typeof className !== "string" || !className.trim() || !factors || typeof factors !== "object") {
      return false;
    }
    return Object.values(factors as Record<string, unknown>).every((value) => isFiniteNumber(value));
  });

  if (rows.length !== input.length) {
    return null;
  }

  return rows;
}

type LoadPlayerFormulaSourcesOptions = {
  attributeSalaryModifiers?: unknown;
  traitSalaryFactors?: unknown;
  rankToDisciplineMarketValue?: unknown;
  classFactors?: unknown;
};

export function loadPlayerFormulaSources(options: LoadPlayerFormulaSourcesOptions = {}): PlayerFormulaSourceBundle {
  const warnings: string[] = [];
  const attributeSalaryModifiers = validateAttributeSalaryModifiers(options.attributeSalaryModifiers ?? attributeSalaryModifiersJson);
  const traitSalaryFactors = validateTraitSalaryFactors(options.traitSalaryFactors ?? traitSalaryFactorsJson);

  const rankSourceInput =
    Object.prototype.hasOwnProperty.call(options, "rankToDisciplineMarketValue")
      ? options.rankToDisciplineMarketValue
      : rankToDisciplineMarketValueJson;
  const normalizedRankTable = normalizeRankTable(rankSourceInput);
  const completeRankTable = isCompleteRankTable(normalizedRankTable) ? normalizedRankTable : null;

  const classSourceInput =
    Object.prototype.hasOwnProperty.call(options, "classFactors")
      ? options.classFactors
      : null;
  const classFactors = validateClassFactors(classSourceInput);

  const attributeSalaryModifiersStatus = attributeSalaryModifiers ? "ready" : "missing_source";
  const traitSalaryFactorsStatus = traitSalaryFactors ? "ready" : "missing_source";
  const rankMarketValueStatus =
    rankSourceInput == null
      ? "missing_source"
      : completeRankTable
        ? "ready"
        : normalizedRankTable
          ? "incomplete_source"
          : "missing_source";
  const classFactorsStatus =
    classSourceInput == null ? "missing_source" : classFactors ? "ready" : "incomplete_source";

  if (!attributeSalaryModifiers) {
    warnings.push("attribute_salary_modifiers_source_missing");
  }
  if (!traitSalaryFactors) {
    warnings.push("trait_salary_factors_source_missing");
  }
  if (rankMarketValueStatus === "missing_source") {
    warnings.push("rank_to_discipline_market_value_source_missing");
  } else if (rankMarketValueStatus === "incomplete_source") {
    warnings.push("rank_to_discipline_market_value_source_incomplete");
  }
  if (classFactorsStatus === "missing_source") {
    warnings.push("class_factors_source_missing");
  } else if (classFactorsStatus === "incomplete_source") {
    warnings.push("class_factors_source_incomplete");
  }

  const salarySourcesReady = attributeSalaryModifiersStatus === "ready" && traitSalaryFactorsStatus === "ready";

  return {
    sourceStatus: {
      attributeSalaryModifiers: attributeSalaryModifiersStatus,
      traitSalaryFactors: traitSalaryFactorsStatus,
      rankToDisciplineMarketValue: rankMarketValueStatus,
      classFactors: classFactorsStatus,
    },
    loadedTables: {
      attributeSalaryModifiers: attributeSalaryModifiersStatus === "ready",
      traitSalaryFactors: traitSalaryFactorsStatus === "ready",
      rankToDisciplineMarketValue: rankMarketValueStatus === "ready",
      classFactors: classFactorsStatus === "ready",
    },
    attributeSalaryModifiersStatus,
    traitSalaryFactorsStatus,
    rankMarketValueStatus,
    classFactorsStatus,
    marketValueEngineStatus: completeRankTable ? "ready" : "blocked_missing_rank_to_mw_source",
    salaryEngineStatus: salarySourcesReady ? "ready_if_market_value_input_present" : "blocked_missing_salary_sources",
    classEngineStatus: classFactors ? "ready" : "heuristic",
    warnings,
    attributeSalaryModifiers,
    traitSalaryFactors,
    rankToDisciplineMarketValue: completeRankTable,
    classFactors,
  };
}
