import { getImportedPlayerDisplayMarketValue, getImportedPlayerDisplaySalary } from "@/lib/data/player-economy-display";
import type { Player, PlayerGeneratorAttributes, RosterEntry } from "@/lib/data/olyDataTypes";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import {
  calculateMarketValueBonuses,
  deriveBaseMarketValueFromFinal,
} from "@/lib/player-formulas/market-value-engine";
import {
  calculateSalaryFromMarketValue,
  deriveSalaryMarketValueFromFinalSalary,
} from "@/lib/player-formulas/salary-engine";

type EconomyPlayer = {
  id?: string | null;
  marketValue?: number | null;
  salaryDemand?: number | null;
  displayMarketValue?: number | null;
  displaySalary?: number | null;
};

type EconomyRosterEntry = {
  salary?: number | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  contractLength?: number | null;
};

export type PlayerEconomyMarketValueSource =
  | "imported_display"
  | "imported_raw"
  | "calculated_preview"
  | "active_current_value"
  | "active_purchase_price"
  | "missing_source";

export type PlayerEconomySalarySource =
  | "imported_display"
  | "imported_raw"
  | "calculated_preview"
  | "active_contract"
  | "missing_source";

export type PlayerEconomyPurchasePriceSource =
  | "imported_display"
  | "imported_raw"
  | "active_purchase_price"
  | "active_current_value"
  | "missing_source";

export type PlayerEconomyContractLengthSource = "active_contract" | "missing_source";

export type PlayerEconomyStatus =
  | "imported_ready"
  | "missing_market_value"
  | "missing_salary"
  | "generator_missing_engine"
  | "manual_draft_required";

export type PlayerEconomyContract = {
  playerId: string | null;
  marketValue: number | null;
  marketValueSource: PlayerEconomyMarketValueSource;
  salary: number | null;
  salarySource: PlayerEconomySalarySource;
  purchasePrice: number | null;
  purchasePriceSource: PlayerEconomyPurchasePriceSource;
  contractLength: number | null;
  contractLengthSource: PlayerEconomyContractLengthSource;
  baseMarketValue: number | null;
  salaryMarketValue: number | null;
  allrounderBonus: number | null;
  specialistBonus: number | null;
  expectedSalary: number | null;
  salaryBase: number | null;
  traitPercentSum: number | null;
  isImportedEconomy: boolean;
  economyStatus: PlayerEconomyStatus;
};

type ImportedMarketValueSource = Extract<PlayerEconomyMarketValueSource, "imported_display" | "imported_raw">;
type ImportedSalarySource = Extract<PlayerEconomySalarySource, "imported_display" | "imported_raw">;
type ImportedPurchasePriceSource = Extract<PlayerEconomyPurchasePriceSource, "imported_display" | "imported_raw">;

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveImportedMarketValueSource(player?: EconomyPlayer | null): ImportedMarketValueSource {
  if (toFiniteNumber(player?.displayMarketValue) != null) {
    return "imported_display";
  }
  if (toFiniteNumber(player?.marketValue) != null) {
    return "imported_raw";
  }
  return "imported_raw";
}

function resolveImportedSalarySource(player?: EconomyPlayer | null): ImportedSalarySource {
  if (toFiniteNumber(player?.displaySalary) != null) {
    return "imported_display";
  }
  if (toFiniteNumber(player?.salaryDemand) != null) {
    return "imported_raw";
  }
  return "imported_raw";
}

function isGeneratorDraftPlayer(playerId: string | null, player?: EconomyPlayer | null) {
  return Boolean(
    (playerId && playerId.startsWith("draft-")) ||
      (player?.id && player.id.startsWith("draft-")),
  );
}

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function toGeneratorAttributes(player?: Player | EconomyPlayer | null) {
  const attributeStats = (player as Player | null)?.attributeSheetStats;
  if (!attributeStats) {
    return null;
  }
  const normalized = {
    power: toFiniteNumber(attributeStats.power),
    health: toFiniteNumber(attributeStats.health),
    stamina: toFiniteNumber(attributeStats.stamina),
    intelligence: toFiniteNumber(attributeStats.intelligence),
    awareness: toFiniteNumber(attributeStats.awareness),
    determination: toFiniteNumber(attributeStats.determination),
    speed: toFiniteNumber(attributeStats.speed),
    dexterity: toFiniteNumber(attributeStats.dexterity),
    charisma: toFiniteNumber(attributeStats.charisma),
    will: toFiniteNumber(attributeStats.will),
    spirit: toFiniteNumber(attributeStats.spirit),
    torment: toFiniteNumber(attributeStats.torment),
  };
  return Object.values(normalized).every((value) => value != null)
    ? (normalized as PlayerGeneratorAttributes)
    : null;
}

export function resolvePlayerEconomyContract(input: {
  playerId?: string | null;
  player?: EconomyPlayer | null;
  rosterEntry?: EconomyRosterEntry | null;
  baseMarketValueOverride?: number | null;
  salaryMarketValueOverride?: number | null;
}): PlayerEconomyContract {
  const player = input.player ?? null;
  const rosterEntry = input.rosterEntry ?? null;
  const playerId = input.playerId ?? player?.id ?? null;

  const importedMarketValue = player ? getImportedPlayerDisplayMarketValue(player) : null;
  const importedSalary = player ? getImportedPlayerDisplaySalary(player) : null;
  const rosterPurchasePrice = toFiniteNumber(rosterEntry?.purchasePrice);
  const rosterSalary = toFiniteNumber(rosterEntry?.salary);
  const contractLength = toFiniteNumber(rosterEntry?.contractLength);
  const playerEntity = player as Player | null;
  const formulaSources = loadPlayerFormulaSources();
  const generatorAttributes = toGeneratorAttributes(playerEntity);
  const salaryMarketValue =
    input.salaryMarketValueOverride != null
      ? input.salaryMarketValueOverride
      : importedSalary != null &&
    generatorAttributes &&
    formulaSources.attributeSalaryModifiers &&
    formulaSources.traitSalaryFactors
      ? deriveSalaryMarketValueFromFinalSalary({
          finalSalary: importedSalary,
          attributes: generatorAttributes,
          traitsPositive: playerEntity?.traitsPositive ?? [],
          traitsNegative: playerEntity?.traitsNegative ?? [],
          traitSalaryFactors: formulaSources.traitSalaryFactors,
          attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
        })
      : null;
  const visibleFinalMarketValue = importedMarketValue ?? null;
  const baseMarketValue =
    input.baseMarketValueOverride ??
    salaryMarketValue ??
    (visibleFinalMarketValue != null
      ? deriveBaseMarketValueFromFinal({
          finalMarketValue: visibleFinalMarketValue,
          coreStats: playerEntity?.coreStats,
          disciplineRatings: playerEntity?.disciplineRatings,
        })
      : null);
  const marketValueBonuses =
    baseMarketValue != null
      ? calculateMarketValueBonuses({
          baseMarketValue,
          coreStats: playerEntity?.coreStats,
          disciplineRatings: playerEntity?.disciplineRatings,
        })
      : null;
  const calculatedFinalMarketValue =
    baseMarketValue != null
      ? roundTo2(
          baseMarketValue +
            (marketValueBonuses?.allrounderBonus ?? 0) +
            (marketValueBonuses?.specialistBonus ?? 0),
        )
      : null;
  const salaryBreakdown =
    salaryMarketValue != null &&
    generatorAttributes &&
    formulaSources.attributeSalaryModifiers &&
    formulaSources.traitSalaryFactors
      ? calculateSalaryFromMarketValue({
          salaryMarketValue,
          attributes: generatorAttributes,
          traitsPositive: playerEntity?.traitsPositive ?? [],
          traitsNegative: playerEntity?.traitsNegative ?? [],
          traitSalaryFactors: formulaSources.traitSalaryFactors,
          attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
        })
      : null;

  const marketValue =
    importedMarketValue ??
    calculatedFinalMarketValue ??
    rosterPurchasePrice ??
    null;
  const marketValueSource =
    importedMarketValue != null
      ? resolveImportedMarketValueSource(player)
      : calculatedFinalMarketValue != null
        ? "calculated_preview"
      : rosterPurchasePrice != null
        ? "active_purchase_price"
        : "missing_source";

  const salary =
    rosterSalary ??
    importedSalary ??
    salaryBreakdown?.finalSalary ??
    null;
  const salarySource =
    rosterSalary != null
        ? "active_contract"
        : importedSalary != null
          ? resolveImportedSalarySource(player)
          : salaryBreakdown?.finalSalary != null
            ? "calculated_preview"
            : "missing_source";

  const purchasePrice =
    visibleFinalMarketValue ??
    rosterPurchasePrice ??
    null;
  const purchasePriceSource =
    visibleFinalMarketValue != null
      ? resolveImportedMarketValueSource(player)
      : rosterPurchasePrice != null
        ? "active_purchase_price"
        : "missing_source";

  const contractLengthSource = contractLength != null ? "active_contract" : "missing_source";
  const isImportedEconomy =
    marketValueSource === "imported_display" ||
    marketValueSource === "imported_raw" ||
    salarySource === "imported_display" ||
    salarySource === "imported_raw" ||
    purchasePriceSource === "imported_display" ||
    purchasePriceSource === "imported_raw";

  let economyStatus: PlayerEconomyStatus = "imported_ready";
  if (marketValue == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_market_value";
  } else if ((importedSalary ?? rosterSalary ?? salaryBreakdown?.finalSalary) == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_salary";
  } else if (!player && !rosterEntry) {
    economyStatus = "manual_draft_required";
  }

  return {
    playerId,
    marketValue: marketValue != null ? roundTo2(marketValue) : null,
    marketValueSource,
    salary: salary != null ? roundTo2(salary) : null,
    salarySource,
    purchasePrice: purchasePrice != null ? roundTo2(purchasePrice) : null,
    purchasePriceSource,
    contractLength,
    contractLengthSource,
    baseMarketValue: baseMarketValue != null ? roundTo2(baseMarketValue) : null,
    salaryMarketValue: salaryMarketValue != null ? roundTo2(salaryMarketValue) : null,
    allrounderBonus: marketValueBonuses?.allrounderBonus ?? null,
    specialistBonus: marketValueBonuses?.specialistBonus ?? null,
    expectedSalary: salaryBreakdown?.finalSalary ?? importedSalary ?? null,
    salaryBase: salaryBreakdown?.basisSalary ?? null,
    traitPercentSum: salaryBreakdown?.traitPercentSum ?? null,
    isImportedEconomy,
    economyStatus,
  };
}
