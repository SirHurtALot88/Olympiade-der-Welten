import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]) {
  return round(values.reduce((total, value) => total + value, 0));
}

export type TransferPipelineSeasonGuv = {
  seasonId: string;
  sponsorInflow: number;
  contractExits: number;
  exitCash: number;
  exitRate: number | null;
  renewCount: number;
  exitPL: number;
  marketSells: number;
  marketSellFees: number;
  marketBuys: number;
  marketBuyFees: number;
  salaryOutflow: number;
  facilityIncome: number;
  facilityUpkeep: number;
  facilityInvest: number;
  inflow: number;
  operatingOutflow: number;
  operating: number;
  netTransfer: number;
};

export function collectSeasonTransferPipelineGuv(gameState: GameState, seasonId: string): TransferPipelineSeasonGuv {
  const contractEvents = (gameState.seasonState.contractEvents ?? []).filter((event) => event.seasonId === seasonId);
  const transferHistory = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const facilityEvents = (gameState.seasonState.facilityEvents ?? []).filter((event) => event.seasonId === seasonId);

  const contractExitEvents = contractEvents.filter((event) => event.eventType === "contract_expired_exit");
  const renewCount = contractEvents.filter((event) => event.eventType === "contract_renewed").length;
  const exitCash = sum(contractExitEvents.map((event) => event.exitValue ?? 0));
  const exitPL = sum(contractExitEvents.map((event) => event.profitLoss ?? 0));

  // `TransferHistoryEntry.transferType` is "buy" | "sell" | "contract_exit" — there is no
  // separate "market_sell"/"market_buy" variant (and no `purchasePrice` field; `fee` is the
  // transfer amount for both directions).
  const marketSells = transferHistory.filter((entry) => entry.transferType === "sell");
  const marketBuys = transferHistory.filter((entry) => entry.transferType === "buy");
  const marketSellFees = sum(marketSells.map((entry) => entry.fee ?? 0));
  const marketBuyFees = sum(marketBuys.map((entry) => entry.fee ?? 0));

  const sponsorInflow = sum(
    (gameState.seasonState.sponsorPayoutLogs ?? [])
      .filter(
        (log) =>
          log.seasonId === seasonId &&
          log.componentId !== "salary_deduct" &&
          (log.cashDelta ?? 0) > 0,
      )
      .map((log) => log.cashDelta ?? 0),
  );

  const facilityIncome = sum(
    facilityEvents.filter((event) => event.source === "facility_income_collected").map((event) => Math.abs(event.cost ?? 0)),
  );
  const facilityUpkeep = sum(
    facilityEvents.filter((event) => event.source === "facility_upkeep_paid").map((event) => event.cost ?? 0),
  );
  // `FacilityEventRecord.source` has no "ai_facility_upgrade"/"facility_build" variants —
  // both AI-driven and initial-build upgrades are logged as "manual_facility_upgrade".
  const facilityInvest = sum(
    facilityEvents.filter((event) => event.source === "manual_facility_upgrade").map((event) => event.cost ?? 0),
  );

  const salaryOutflow = sum(gameState.teams.map((team) => getTeamSalarySum(gameState, team.teamId)));

  const inflow = round(sponsorInflow + exitCash + marketSellFees);
  const operatingOutflow = round(salaryOutflow + facilityUpkeep + facilityInvest);
  const operating = round(inflow - salaryOutflow - facilityUpkeep - facilityInvest);
  const netTransfer = round(operating - marketBuyFees + marketSellFees);

  const expiringCandidates = contractExitEvents.length + renewCount;
  const exitRate = expiringCandidates > 0 ? round(contractExitEvents.length / expiringCandidates) : null;

  return {
    seasonId,
    sponsorInflow,
    contractExits: contractExitEvents.length,
    exitCash,
    exitRate,
    renewCount,
    exitPL,
    marketSells: marketSells.length,
    marketSellFees,
    marketBuys: marketBuys.length,
    marketBuyFees,
    salaryOutflow,
    facilityIncome,
    facilityUpkeep,
    facilityInvest,
    inflow,
    operatingOutflow,
    operating,
    netTransfer,
  };
}

export function formatTransferPipelineGuvMarkdown(rows: TransferPipelineSeasonGuv[]): string {
  const lines = [
    "## Operating GuV (pro Season)",
    "",
    "| Season | Zufluss | Exits | Exit-Cash | Exit-Rate | Renews | Exit P/L | Markt-Sells | Gehalt | Gebäude | Operating | Käufe | Netto |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.seasonId} | ${row.inflow} | ${row.contractExits} | ${row.exitCash} | ${row.exitRate == null ? "—" : `${Math.round(row.exitRate * 100)}%`} | ${row.renewCount} | ${row.exitPL} | ${row.marketSells} | ${row.salaryOutflow} | ${round(row.facilityUpkeep + row.facilityInvest)} | ${row.operating} | ${row.marketBuyFees} | ${row.netTransfer} |`,
    );
  }
  return lines.join("\n");
}
