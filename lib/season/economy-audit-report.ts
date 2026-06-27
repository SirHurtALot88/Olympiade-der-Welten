import type { GameState } from "@/lib/data/olyDataTypes";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildEconomyAuditReport(input: { saveId: string; gameState: GameState }) {
  const { saveId, gameState } = input;
  const cashPrizeLogs = gameState.seasonState.cashPrizeApplyLogs ?? [];
  const sponsorLogs = gameState.seasonState.sponsorPayoutLogs ?? [];
  const violations: string[] = [];

  const appliedCashPrize = cashPrizeLogs.filter((log) => log.action === "apply");
  if (appliedCashPrize.length > 0) {
    violations.push(`cash_prize_apply_executed:${appliedCashPrize.length}`);
  }

  const baseFirst = sponsorLogs.filter((log) => log.phase === "base_first");
  const seasonEnd = sponsorLogs.filter((log) => log.phase === "season_end");
  const repairBuys = gameState.transferHistory.filter((entry) => entry.transferSource === "preseason_roster_repair_buy");
  const negativeCashTeams = gameState.teams.filter((team) => team.cash < -0.01);
  const repairBuyZeroFee = repairBuys.filter((entry) => entry.kind === "buy" && (entry.fee ?? 0) <= 0);

  if (negativeCashTeams.length > 0) {
    violations.push(
      `negative_cash_teams:${negativeCashTeams.map((team) => `${team.teamId}:${round(team.cash)}`).join("|")}`,
    );
  }

  if (repairBuyZeroFee.length > 0) {
    violations.push(`preseason_roster_repair_buy_zero_fee:${repairBuyZeroFee.length}`);
  }

  const cashValues = gameState.teams.map((team) => team.cash);

  return {
    saveId,
    seasonId: gameState.season.id,
    gamePhase: gameState.gamePhase,
    ok: violations.length === 0,
    violations,
    cashPrizeApplyLogs: appliedCashPrize.length,
    sponsorBaseFirstLogs: baseFirst.length,
    sponsorSeasonEndLogs: seasonEnd.length,
    seasonsWithSponsorEndSettlement: [...new Set(seasonEnd.map((log) => log.seasonId))].sort(),
    preseasonRepairBuyCount: repairBuys.length,
    leagueCash: {
      min: Math.min(...cashValues),
      max: Math.max(...cashValues),
      avg: round(cashValues.reduce((sum, value) => sum + value, 0) / cashValues.length),
    },
  };
}
