/**
 * Pure preflight need-detection for the in-season transfer engine.
 *
 * These functions are a behaviour-preserving extraction of the three inline `.filter` predicates
 * that used to live in `ai-market-plan-apply-service.ts` (the buy-need, sell-need and maintenance
 * scans). The heavy per-team lookups (roster targets, sell-runway pressure, value/upgrade-sell
 * opportunity, budget status) stay in the caller — their RESULTS are injected here — so this module
 * has no side effects and no import coupling to the preview/apply monoliths, and each decision can
 * be unit-tested in isolation. The boolean outputs are identical to the original predicates; the
 * `reasons` arrays are additive diagnostics and do not affect any downstream decision.
 */

/** Salary-to-cash pressure ratio, matching the legacy inline formula exactly. */
export function computeSalaryPressure(input: { teamCash: number; salaryTotal: number }): number {
  if (input.teamCash > 0) {
    return input.salaryTotal / Math.max(input.teamCash, 1);
  }
  return input.salaryTotal > 0 ? 99 : 0;
}

/** Board pressure derived from board confidence (0 confidence -> 10 pressure). */
export function computeBoardPressure(boardConfidence: number | null | undefined): number {
  return 10 - (boardConfidence ?? 5);
}

export type TeamBuyNeedInput = {
  rosterCount: number;
  playerMin: number;
  playerOpt: number;
  /** Roster entries whose contractLength <= 1. */
  expiringCount: number;
  /** Result of `teamNeedsPostOptUpgradeDeploy(gameState, teamId, seasonId)`. */
  needsPostOptUpgradeDeploy: boolean;
};

export function evaluateTeamBuyNeed(input: TeamBuyNeedInput): { needsBuy: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const rosterAfterExpiry = Math.max(0, input.rosterCount - input.expiringCount);

  if (input.needsPostOptUpgradeDeploy) {
    return { needsBuy: true, reasons: ["post_opt_upgrade_deploy"] };
  }

  if (input.rosterCount < input.playerOpt) reasons.push("below_opt");
  if (rosterAfterExpiry < input.playerOpt) reasons.push("below_opt_after_expiry");
  if (rosterAfterExpiry < input.playerMin) reasons.push("below_min_after_expiry");

  const needsBuy =
    input.rosterCount < input.playerOpt ||
    rosterAfterExpiry < input.playerOpt ||
    rosterAfterExpiry < input.playerMin;

  return { needsBuy, reasons };
}

export type TeamSellNeedInput = {
  rosterCount: number;
  playerOpt: number;
  teamCash: number;
  expiringCount: number;
  salaryTotal: number;
  boardConfidence: number | null | undefined;
  /** `assessTeamSellRunwayPressure(...).cashPressureScore`. */
  sellRunwayPressureScore: number;
  /** Result of `hasValueSellOpportunity(gameState, team, playerMin, playersById)`. */
  hasValueSellOpportunity: boolean;
  /** Result of `hasUpgradeSellOpportunity(gameState, teamId, seasonId, playerMin)`. */
  hasUpgradeSellOpportunity: boolean;
};

export function evaluateTeamSellNeed(input: TeamSellNeedInput): { needsSell: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const rosterAfterExpiry = Math.max(0, input.rosterCount - input.expiringCount);
  const salaryPressure = computeSalaryPressure({ teamCash: input.teamCash, salaryTotal: input.salaryTotal });
  const boardPressure = computeBoardPressure(input.boardConfidence);
  const cashIsFinite = typeof input.teamCash === "number" && Number.isFinite(input.teamCash);
  const lowCashBuffer = cashIsFinite && input.teamCash < Math.max(10, input.salaryTotal * 0.2);
  const expiryCreatesOptRisk = input.expiringCount > 0 && rosterAfterExpiry < input.playerOpt;
  const expiryNeedsDecision =
    input.expiringCount > 0 &&
    input.rosterCount > 0 &&
    (expiryCreatesOptRisk || salaryPressure > 0.6 || boardPressure >= 6 || lowCashBuffer);

  if (input.rosterCount > input.playerOpt) reasons.push("over_opt");
  if (cashIsFinite && input.teamCash < 0) reasons.push("negative_cash");
  if (expiryNeedsDecision) reasons.push("expiry_needs_decision");
  if (salaryPressure > 0.75) reasons.push("salary_pressure");
  if (boardPressure >= 6) reasons.push("board_pressure");
  if (input.sellRunwayPressureScore >= 0.45) reasons.push("sell_runway_pressure");
  if (input.hasValueSellOpportunity) reasons.push("value_sell_opportunity");
  if (input.hasUpgradeSellOpportunity) reasons.push("upgrade_sell_opportunity");

  const needsSell =
    input.rosterCount > input.playerOpt ||
    (cashIsFinite && input.teamCash < 0) ||
    expiryNeedsDecision ||
    salaryPressure > 0.75 ||
    boardPressure >= 6 ||
    input.sellRunwayPressureScore >= 0.45 ||
    input.hasValueSellOpportunity ||
    input.hasUpgradeSellOpportunity;

  return { needsSell, reasons };
}

export type TeamMaintenanceNeedInput = {
  expiringCount: number;
  salaryTotal: number;
  teamCash: number;
  /** Result of `getBudgetStatus(team, {...})`. */
  budgetStatus: string;
};

export function evaluateTeamMaintenanceNeed(
  input: TeamMaintenanceNeedInput,
): { needsMaintenance: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const salaryPressure = computeSalaryPressure({ teamCash: input.teamCash, salaryTotal: input.salaryTotal });

  if (input.expiringCount > 0) reasons.push("expiring_contracts");
  if (salaryPressure > 0.5) reasons.push("salary_pressure");
  if (input.budgetStatus !== "healthy") reasons.push("budget_not_healthy");

  const needsMaintenance = input.expiringCount > 0 || salaryPressure > 0.5 || input.budgetStatus !== "healthy";

  return { needsMaintenance, reasons };
}
