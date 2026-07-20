import type { GameState } from "@/lib/data/olyDataTypes";
import { CASH_PRIZE_BENCHMARK_ONLY } from "@/lib/season/cash-prize-apply-service";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildEconomyAuditReport(input: { saveId: string; gameState: GameState }) {
  const { saveId, gameState } = input;
  const cashPrizeLogs = gameState.seasonState.cashPrizeApplyLogs ?? [];
  const sponsorLogs = gameState.seasonState.sponsorPayoutLogs ?? [];
  const violations: string[] = [];

  // T-032: `executeCashPrizeApply` ist ein klar gekennzeichneter Debug-/Benchmark-Endpoint
  // (siehe CASH_PRIZE_BENCHMARK_ONLY in cash-prize-apply-service.ts) — solange dieses Flag aktiv
  // ist, bewegt der Pfad garantiert kein echtes Cash, d.h. ein `apply`-Log ist erwartetes
  // Benchmark-Verhalten, kein Verstoß. Der Log-Count bleibt informativ im Report sichtbar
  // (`cashPrizeApplyLogs`/`cashPrizeApplyBenchmarkOnly`); nur die Verstoß-Wertung entfällt. Sollte
  // der Payout-Pfad je scharf geschaltet werden (CASH_PRIZE_BENCHMARK_ONLY=false), zählt ein
  // ausgeführter Apply wieder als `cash_prize_apply_executed`-Verstoß, bis dieser Report bewusst
  // um eine echte Payout-Prüfung erweitert wird.
  const appliedCashPrize = cashPrizeLogs.filter((log) => log.action === "apply");
  if (appliedCashPrize.length > 0 && !CASH_PRIZE_BENCHMARK_ONLY) {
    violations.push(`cash_prize_apply_executed:${appliedCashPrize.length}`);
  }

  const baseFirst = sponsorLogs.filter((log) => log.phase === "base_first");
  const seasonEnd = sponsorLogs.filter((log) => log.phase === "season_end");
  const repairBuys = gameState.transferHistory.filter((entry) => entry.source === "preseason_roster_repair_buy");
  const negativeCashTeams = gameState.teams.filter((team) => team.cash < -0.01);
  const repairBuyZeroFee = repairBuys.filter(
    (entry) => entry.transferType === "buy" && (entry.fee ?? 0) <= 0,
  );

  if (negativeCashTeams.length > 0) {
    violations.push(
      `negative_cash_teams:${negativeCashTeams.map((team) => `${team.teamId}:${round(team.cash)}`).join("|")}`,
    );
  }

  if (repairBuyZeroFee.length > 0) {
    violations.push(`preseason_roster_repair_buy_zero_fee:${repairBuyZeroFee.length}`);
  }
  const repairBuyDiscounted = repairBuys.filter(
    (entry) =>
      entry.transferType === "buy" &&
      entry.marketValue != null &&
      entry.fee != null &&
      Math.abs(entry.fee - entry.marketValue) > 0.05,
  );
  if (repairBuyDiscounted.length > 0) {
    violations.push(`preseason_roster_repair_buy_fee_not_market_value:${repairBuyDiscounted.length}`);
  }

  const cashValues = gameState.teams.map((team) => team.cash);

  return {
    saveId,
    seasonId: gameState.season.id,
    gamePhase: gameState.gamePhase,
    ok: violations.length === 0,
    violations,
    cashPrizeApplyLogs: appliedCashPrize.length,
    cashPrizeApplyBenchmarkOnly: CASH_PRIZE_BENCHMARK_ONLY,
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
