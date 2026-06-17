type MarketValueSource = {
  displayMarketValue?: number | null;
  marketValue?: number | null;
};

type SalarySource = {
  displaySalary?: number | null;
  salaryDemand?: number | null;
};

// Legacy/import helper for source data only. Runtime salary views use the internal economy contract.
export function getImportedPlayerDisplayMarketValue(player: MarketValueSource) {
  return player.displayMarketValue ?? player.marketValue ?? null;
}

// Legacy/import helper for compatibility with old exports. New salary flows should use resolvePlayerEconomyContract.
export function getImportedPlayerDisplaySalary(player: SalarySource) {
  return player.displaySalary ?? player.salaryDemand ?? null;
}
