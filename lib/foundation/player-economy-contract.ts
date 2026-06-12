import { getImportedPlayerDisplayMarketValue, getImportedPlayerDisplaySalary } from "@/lib/data/player-economy-display";
import type { Player, RosterEntry } from "@/lib/data/olyDataTypes";

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
  | "active_current_value"
  | "active_purchase_price"
  | "missing_source";

export type PlayerEconomySalarySource =
  | "imported_display"
  | "imported_raw"
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
  isImportedEconomy: boolean;
  economyStatus: PlayerEconomyStatus;
};

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveImportedMarketValueSource(player?: EconomyPlayer | null): PlayerEconomyMarketValueSource {
  if (toFiniteNumber(player?.displayMarketValue) != null) {
    return "imported_display";
  }
  if (toFiniteNumber(player?.marketValue) != null) {
    return "imported_raw";
  }
  return "missing_source";
}

function resolveImportedSalarySource(player?: EconomyPlayer | null): PlayerEconomySalarySource {
  if (toFiniteNumber(player?.displaySalary) != null) {
    return "imported_display";
  }
  if (toFiniteNumber(player?.salaryDemand) != null) {
    return "imported_raw";
  }
  return "missing_source";
}

function isGeneratorDraftPlayer(playerId: string | null, player?: EconomyPlayer | null) {
  return Boolean(
    (playerId && playerId.startsWith("draft-")) ||
      (player?.id && player.id.startsWith("draft-")),
  );
}

export function resolvePlayerEconomyContract(input: {
  playerId?: string | null;
  player?: EconomyPlayer | null;
  rosterEntry?: EconomyRosterEntry | null;
}): PlayerEconomyContract {
  const player = input.player ?? null;
  const rosterEntry = input.rosterEntry ?? null;
  const playerId = input.playerId ?? player?.id ?? null;

  const importedMarketValue = player ? getImportedPlayerDisplayMarketValue(player) : null;
  const importedSalary = player ? getImportedPlayerDisplaySalary(player) : null;
  const rosterCurrentValue = toFiniteNumber(rosterEntry?.currentValue);
  const rosterPurchasePrice = toFiniteNumber(rosterEntry?.purchasePrice);
  const rosterSalary = toFiniteNumber(rosterEntry?.salary);
  const contractLength = toFiniteNumber(rosterEntry?.contractLength);

  const marketValue =
    importedMarketValue ??
    rosterCurrentValue ??
    rosterPurchasePrice ??
    null;
  const marketValueSource =
    importedMarketValue != null
      ? resolveImportedMarketValueSource(player)
      : rosterCurrentValue != null
        ? "active_current_value"
        : rosterPurchasePrice != null
          ? "active_purchase_price"
          : "missing_source";

  const salary =
    importedSalary ??
    rosterSalary ??
    null;
  const salarySource =
    importedSalary != null
      ? resolveImportedSalarySource(player)
      : rosterSalary != null
        ? "active_contract"
        : "missing_source";

  const purchasePrice =
    importedMarketValue ??
    rosterPurchasePrice ??
    rosterCurrentValue ??
    null;
  const purchasePriceSource =
    importedMarketValue != null
      ? resolveImportedMarketValueSource(player)
      : rosterPurchasePrice != null
        ? "active_purchase_price"
        : rosterCurrentValue != null
          ? "active_current_value"
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
  } else if (salary == null) {
    economyStatus = isGeneratorDraftPlayer(playerId, player) ? "generator_missing_engine" : "missing_salary";
  } else if (!player && !rosterEntry) {
    economyStatus = "manual_draft_required";
  }

  return {
    playerId,
    marketValue,
    marketValueSource,
    salary,
    salarySource,
    purchasePrice,
    purchasePriceSource,
    contractLength,
    contractLengthSource,
    isImportedEconomy,
    economyStatus,
  };
}
