type MarketValueSource = {
  displayMarketValue?: number | null;
  marketValue?: number | null;
};

type SalarySource = {
  displaySalary?: number | null;
  salaryDemand?: number | null;
};

// Transition policy: while the new MW/salary balancing is still work in progress,
// visible management values stay on the imported display fields.
export function getImportedPlayerDisplayMarketValue(player: MarketValueSource) {
  return player.displayMarketValue ?? player.marketValue ?? null;
}

// Transition policy: while the new MW/salary balancing is still work in progress,
// visible management values stay on the imported display fields.
export function getImportedPlayerDisplaySalary(player: SalarySource) {
  return player.displaySalary ?? player.salaryDemand ?? null;
}
