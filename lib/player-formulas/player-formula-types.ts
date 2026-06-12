import type {
  PlayerGeneratorAttributes,
  PlayerGeneratorClassEngineStatus,
  PlayerGeneratorFormulaSourceStatus,
  PlayerGeneratorMarketValueEngineStatus,
  PlayerGeneratorSalaryEngineStatus,
} from "@/lib/data/olyDataTypes";

export type AttributeSalaryModifierName =
  | "Spirit"
  | "Torment"
  | "Awareness"
  | "Charisma"
  | "Intelligence"
  | "Dexterity"
  | "Speed"
  | "Health"
  | "Power"
  | "Stamina"
  | "Determination"
  | "Will";

export type AttributeSalaryModifiers = Record<AttributeSalaryModifierName, number>;

export type TraitSalaryFactors = Record<string, number>;

export type RankToDisciplineMarketValueRow = {
  rank: number;
  disciplineMarketValue: number;
};

export type ClassFactorRow = {
  className: string;
  factors: Record<string, number>;
};

export type PlayerFormulaLoadedTables = {
  attributeSalaryModifiers: boolean;
  traitSalaryFactors: boolean;
  rankToDisciplineMarketValue: boolean;
  classFactors: boolean;
};

export type PlayerFormulaSourceStatusMap = {
  attributeSalaryModifiers: PlayerGeneratorFormulaSourceStatus;
  traitSalaryFactors: PlayerGeneratorFormulaSourceStatus;
  rankToDisciplineMarketValue: PlayerGeneratorFormulaSourceStatus;
  classFactors: PlayerGeneratorFormulaSourceStatus;
};

export type PlayerFormulaStatusSnapshot = {
  attributeSalaryModifiersStatus: PlayerGeneratorFormulaSourceStatus;
  traitSalaryFactorsStatus: PlayerGeneratorFormulaSourceStatus;
  rankMarketValueStatus: PlayerGeneratorFormulaSourceStatus;
  classFactorsStatus: PlayerGeneratorFormulaSourceStatus;
  marketValueEngineStatus: PlayerGeneratorMarketValueEngineStatus;
  salaryEngineStatus: PlayerGeneratorSalaryEngineStatus;
  classEngineStatus: PlayerGeneratorClassEngineStatus;
  warnings: string[];
};

export type PlayerFormulaSourceBundle = PlayerFormulaStatusSnapshot & {
  sourceStatus: PlayerFormulaSourceStatusMap;
  loadedTables: PlayerFormulaLoadedTables;
  attributeSalaryModifiers: AttributeSalaryModifiers | null;
  traitSalaryFactors: TraitSalaryFactors | null;
  rankToDisciplineMarketValue: RankToDisciplineMarketValueRow[] | null;
  classFactors: ClassFactorRow[] | null;
};

export type SalaryEngineInput = {
  marketValueNew: number;
  attributes: PlayerGeneratorAttributes;
  traitsPositive?: string[];
  traitsNegative?: string[];
  traitSalaryFactors: TraitSalaryFactors;
  attributeSalaryModifiers: AttributeSalaryModifiers;
};

export type SalaryEngineBreakdown = {
  totalAttributes: number;
  weightedAttributeSalaryBlock: number;
  basisSalary: number;
  rawFinalSalary: number;
  traitEffects: Array<{
    trait: string;
    factor: number | null;
    effect: number;
    known: boolean;
  }>;
  finalSalary: number;
  warnings: string[];
};

export type MarketValueDisciplineInput = {
  playerId: string;
  scores: Record<string, number>;
  mwChangeFix?: number;
};

export type MarketValueFixtureResult = {
  playerId: string;
  disciplineRanks: Record<string, number>;
  disciplineMarketValues: Record<string, number>;
  rawDisciplineMarketValueSum: number;
  adjustedRaw: number;
  protectedRaw: number;
  marketValueBaseOffset: number;
  calcWithoutBaseOffset: number;
  marketValueNew: number;
};

export type MarketValueEngineResult =
  | {
      status: "ready";
      players: MarketValueFixtureResult[];
      warnings: string[];
    }
  | {
      status: "blocked_missing_rank_to_mw_source";
      players: [];
      warnings: string[];
    };
