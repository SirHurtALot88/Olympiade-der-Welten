type MarketValueSource = {
  displayMarketValue?: number | null;
  marketValue?: number | null;
};

type SalarySource = {
  displaySalary?: number | null;
  salaryDemand?: number | null;
};

// Legacy/import helper for source data only. Catalog load materializes calculated economy first.
export function getImportedPlayerDisplayMarketValue(player: MarketValueSource) {
  return player.displayMarketValue ?? player.marketValue ?? null;
}

// Legacy/import helper for compatibility with old exports. Catalog load materializes calculated economy first.
export function getImportedPlayerDisplaySalary(player: SalarySource) {
  return player.displaySalary ?? player.salaryDemand ?? null;
}
