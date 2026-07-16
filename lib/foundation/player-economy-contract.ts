import type { ContractYearSalary, Player, PlayerGeneratorAttributes, RosterEntry } from "@/lib/data/olyDataTypes";
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
  contractShape?: "balanced" | "front_loaded" | "back_loaded" | null;
  yearlySalarySchedule?: ContractYearSalary[] | null;
};

export type RosterContractSalaries = {
  /** Cash obligation for the current contract year (schedule year 1). */
  currentSeasonSalary: number | null;
  /** Negotiated annual benchmark used for roster tables and market comparison. */
  annualSalary: number | null;
};

export function resolveRosterContractSalaries(
  rosterEntry: EconomyRosterEntry | null | undefined,
): RosterContractSalaries {
  if (!rosterEntry) {
    return { currentSeasonSalary: null, annualSalary: null };
  }

  const storedSalary = normalizeStoredEconomyValue(toFiniteNumber(rosterEntry.salary));
  const schedule = rosterEntry.yearlySalarySchedule ?? [];
  if (schedule.length === 0) {
    return { currentSeasonSalary: storedSalary, annualSalary: storedSalary };
  }

  const currentSeasonSalary =
    normalizeStoredEconomyValue(toFiniteNumber(schedule[0]?.salary)) ?? storedSalary;
  const scheduleTotal = schedule.reduce(
    (sum, row) => sum + (normalizeStoredEconomyValue(toFiniteNumber(row.salary)) ?? 0),
    0,
  );
  const scheduleAverage = schedule.length > 0 ? roundTo2(scheduleTotal / schedule.length) : null;
  const contractShape = rosterEntry.contractShape ?? "balanced";

  if (contractShape === "front_loaded" || contractShape === "back_loaded") {
    return {
      currentSeasonSalary,
      annualSalary: storedSalary ?? scheduleAverage ?? currentSeasonSalary,
    };
  }

  return {
    currentSeasonSalary,
    annualSalary: currentSeasonSalary ?? storedSalary ?? scheduleAverage,
  };
}

export type PlayerEconomyMarketValueSource =
  | "calculated_stored"
  | "imported_display"
  | "imported_raw"
  | "calculated_preview"
  | "active_current_value"
  | "active_purchase_price"
  | "missing_source";

export type PlayerEconomySalarySource =
  | "calculated_stored"
  | "imported_display"
  | "imported_raw"
  | "calculated_preview"
  | "active_contract"
  | "missing_source";

export type PlayerEconomyPurchasePriceSource =
  | "calculated_stored"
  | "calculated_preview"
  | "imported_display"
  | "imported_raw"
  | "active_purchase_price"
  | "active_current_value"
  | "missing_source";

export type PlayerEconomyContractLengthSource = "active_contract" | "missing_source";

export type PlayerEconomyStatus =
  | "calculated_ready"
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
  /** Negotiated annual salary for display; differs from salary on shaped contracts. */
  annualSalary: number | null;
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

function normalizeStoredEconomyValue(value: number | null | undefined) {
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) {
    return null;
  }
  if (numericValue > 1000) {
    return roundTo2(numericValue / 100);
  }

  return numericValue;
}

/** Display-scale economy value (raw roster cents → game cash units). */
export function normalizeEconomyMoney(value: number | null | undefined): number | null {
  return normalizeStoredEconomyValue(value);
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

  const storedCalculatedMarketValue = normalizeStoredEconomyValue(player?.marketValue);
  const storedCalculatedSalary = normalizeStoredEconomyValue(player?.salaryDemand);
  const legacyDisplayMarketValue = normalizeStoredEconomyValue(player?.displayMarketValue);
  const legacyDisplaySalary = normalizeStoredEconomyValue(player?.displaySalary);
  const rosterPurchasePrice = normalizeStoredEconomyValue(toFiniteNumber(rosterEntry?.purchasePrice));
  const rosterCurrentValue = normalizeStoredEconomyValue(toFiniteNumber(rosterEntry?.currentValue));
  const rosterContractSalaries = resolveRosterContractSalaries(rosterEntry);
  const rosterSalary = rosterContractSalaries.currentSeasonSalary;
  const contractLength = toFiniteNumber(rosterEntry?.contractLength);
  const playerEntity = player as Player | null;
  const formulaSources = loadPlayerFormulaSources();
  const generatorAttributes = toGeneratorAttributes(playerEntity);
  const salaryMarketValueOverride = toFiniteNumber(input.salaryMarketValueOverride);
  const visibleFinalMarketValue = legacyDisplayMarketValue ?? storedCalculatedMarketValue ?? null;
  const baseMarketValue =
    input.baseMarketValueOverride ??
    (visibleFinalMarketValue != null
      ? deriveBaseMarketValueFromFinal({
          finalMarketValue: visibleFinalMarketValue,
          coreStats: playerEntity?.coreStats,
          disciplineRatings: playerEntity?.disciplineRatings,
        })
      : null);
  const fallbackFinalSalary = legacyDisplaySalary ?? storedCalculatedSalary;
  const salaryMarketValueFromLegacySalary =
    salaryMarketValueOverride == null &&
    baseMarketValue == null &&
    fallbackFinalSalary != null &&
    generatorAttributes &&
    formulaSources.attributeSalaryModifiers &&
    formulaSources.traitSalaryFactors
      ? deriveSalaryMarketValueFromFinalSalary({
          finalSalary: fallbackFinalSalary,
          attributes: generatorAttributes,
          traitsPositive: playerEntity?.traitsPositive ?? [],
          traitsNegative: playerEntity?.traitsNegative ?? [],
          traitSalaryFactors: formulaSources.traitSalaryFactors,
          attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
        })
      : null;
  const salaryMarketValue = salaryMarketValueOverride ?? visibleFinalMarketValue ?? baseMarketValue ?? salaryMarketValueFromLegacySalary;
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
    calculatedFinalMarketValue ??
    storedCalculatedMarketValue ??
    legacyDisplayMarketValue ??
    rosterPurchasePrice ??
    null;
  const marketValueSource =
    calculatedFinalMarketValue != null
      ? "calculated_preview"
      : storedCalculatedMarketValue != null
        ? "calculated_stored"
        : legacyDisplayMarketValue != null
          ? resolveImportedMarketValueSource(player)
          : rosterPurchasePrice != null
            ? "active_purchase_price"
            : "missing_source";

  const salary =
    rosterSalary ??
    salaryBreakdown?.finalSalary ??
    storedCalculatedSalary ??
    legacyDisplaySalary ??
    null;
  const salarySource =
    rosterSalary != null
        ? "active_contract"
        : salaryBreakdown?.finalSalary != null
            ? "calculated_preview"
            : storedCalculatedSalary != null
              ? "calculated_stored"
              : legacyDisplaySalary != null
                ? resolveImportedSalarySource(player)
                : "missing_source";

  const purchasePrice =
    calculatedFinalMarketValue ??
    storedCalculatedMarketValue ??
    rosterPurchasePrice ??
    legacyDisplayMarketValue ??
    null;
  const purchasePriceSource =
    calculatedFinalMarketValue != null
      ? "calculated_preview"
      : storedCalculatedMarketValue != null
        ? "calculated_stored"
        : rosterPurchasePrice != null
        ? "active_purchase_price"
        : legacyDisplayMarketValue != null
          ? resolveImportedMarketValueSource(player)
          : "missing_source";

  const contractLengthSource = contractLength != null ? "active_contract" : "missing_source";
  const isImportedEconomy =
    marketValueSource === "imported_display" ||
    marketValueSource === "imported_raw" ||
    salarySource === "imported_display" ||
    salarySource === "imported_raw" ||
    purchasePriceSource === "imported_display" ||
    purchasePriceSource === "imported_raw";

  let economyStatus: PlayerEconomyStatus = isImportedEconomy ? "imported_ready" : "calculated_ready";
  if (marketValue == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_market_value";
  } else if ((storedCalculatedSalary ?? rosterSalary ?? salaryBreakdown?.finalSalary ?? legacyDisplaySalary) == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_salary";
  } else if (!player && !rosterEntry) {
    economyStatus = "manual_draft_required";
  }

  return {
    playerId,
    marketValue: marketValue != null ? roundTo2(marketValue) : null,
    marketValueSource,
    salary: salary != null ? roundTo2(salary) : null,
    annualSalary:
      rosterContractSalaries.annualSalary != null ? roundTo2(rosterContractSalaries.annualSalary) : salary != null ? roundTo2(salary) : null,
    salarySource,
    purchasePrice: purchasePrice != null ? roundTo2(purchasePrice) : null,
    purchasePriceSource,
    contractLength,
    contractLengthSource,
    baseMarketValue: baseMarketValue != null ? roundTo2(baseMarketValue) : null,
    salaryMarketValue: salaryMarketValue != null ? roundTo2(salaryMarketValue) : null,
    allrounderBonus: marketValueBonuses?.allrounderBonus ?? null,
    specialistBonus: marketValueBonuses?.specialistBonus ?? null,
    expectedSalary: salaryBreakdown?.finalSalary ?? storedCalculatedSalary ?? legacyDisplaySalary ?? null,
    salaryBase: salaryBreakdown?.basisSalary ?? null,
    traitPercentSum: salaryBreakdown?.traitPercentSum ?? null,
    isImportedEconomy,
    economyStatus,
  };
}

export function formatContractShapeShortLabel(
  shape: EconomyRosterEntry["contractShape"] | null | undefined,
): string | null {
  if (shape === "front_loaded") {
    return "FL";
  }
  if (shape === "back_loaded") {
    return "BL";
  }
  return null;
}

export function formatContractShapeLabel(
  shape: EconomyRosterEntry["contractShape"] | null | undefined,
): string {
  if (shape === "front_loaded") {
    return "Vorne schwer";
  }
  if (shape === "back_loaded") {
    return "Hinten schwer";
  }
  if (shape === "balanced") {
    return "Ausgeglichen";
  }
  return "—";
}

export function rosterSalariesDifferForDisplay(
  currentSeasonSalary: number | null | undefined,
  annualSalary: number | null | undefined,
): boolean {
  if (currentSeasonSalary == null || annualSalary == null) {
    return false;
  }
  return Math.abs(currentSeasonSalary - annualSalary) >= 0.01;
}
