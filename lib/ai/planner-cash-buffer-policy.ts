import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamCashSalarySoftTarget, getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";

/** League-median salary anchor for S2+ buffer (teams with thin salary history). */
export const PLANNER_LEAGUE_SALARY_BUFFER_RATIO = 0.35;

export const PLANNER_LIQUIDITY_BUFFER_MW_RATIO = 0.1;
export const PLANNER_LIQUIDITY_BUFFER_MIN = 3;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function usesSingleCashPlanningPolicy(gameState: GameState): boolean {
  return !isSeasonOne(gameState.season.id);
}

export function resolveTeamRosterMarketValue(gameState: GameState, teamId: string): number {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.marketValue ?? 0);
      }, 0),
  );
}

export function getLeagueMedianTeamSalary(gameState: GameState): number {
  const salaries = gameState.teams
    .map((team) => getTeamSalarySum(gameState, team.teamId))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  if (salaries.length === 0) return 0;
  const mid = Math.floor(salaries.length / 2);
  return salaries.length % 2 === 1
    ? salaries[mid]!
    : round((salaries[mid - 1]! + salaries[mid]!) / 2);
}

/**
 * S2+ liquidity buffer: finance-scaled cash/salary target (0.25–0.75× own salary),
 * floored by league-median salary anchor. Excess cash above this buffer is spendable.
 */
export function resolveTeamLiquidityBufferTarget(gameState: GameState, teamId: string): number {
  const rosterMw = resolveTeamRosterMarketValue(gameState, teamId);
  const mwBuffer = round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, rosterMw * PLANNER_LIQUIDITY_BUFFER_MW_RATIO));
  if (!usesSingleCashPlanningPolicy(gameState)) {
    return mwBuffer;
  }
  const salary = getTeamSalarySum(gameState, teamId);
  if (salary <= 0) {
    const leagueMedian = getLeagueMedianTeamSalary(gameState);
    if (leagueMedian <= 0) return mwBuffer;
    return round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, leagueMedian * PLANNER_LEAGUE_SALARY_BUFFER_RATIO));
  }
  const teamCash = gameState.teams.find((entry) => entry.teamId === teamId)?.cash ?? 0;
  const baseSoftRatio = getTeamCashSalarySoftTarget(gameState, teamId);

  // Hysteresis: build buffer up to `high`, but once above it, lower the effective buffer target
  // back down toward `low` so cash is deterministically spendable again (no infinite hoarding).
  const factorWindow = getSeasonEconomyFactorWindow({
    saveId: gameState.season.id,
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  }).map((entry) => entry.factor);
  const next2Min = Math.min(factorWindow[0] ?? 1, factorWindow[1] ?? 1, factorWindow[2] ?? 1);
  const next2Max = Math.max(factorWindow[0] ?? 1, factorWindow[1] ?? 1, factorWindow[2] ?? 1);

  // If upcoming salary factors look worse (<1), be a bit more cautious; if clearly better (>1),
  // allow a bit more risk (smaller buffer).
  const cautionBump =
    next2Min < 1 ? (1 - next2Min) * 0.35 + (next2Min < 0.85 ? 0.06 : 0) : 0;
  const riskRelief = next2Max > 1.05 ? (next2Max - 1.05) * 0.12 : 0;
  const lowRatio = Math.max(0.18, Math.min(0.95, baseSoftRatio + cautionBump - riskRelief));
  const highRatio = Math.max(lowRatio + 0.08, Math.min(1.0, lowRatio + 0.18));

  const cashRatio = salary > 0 ? teamCash / salary : 0;
  const ownBuffer = salary * (cashRatio + 0.01 >= highRatio ? lowRatio : highRatio);
  const leagueMedian = getLeagueMedianTeamSalary(gameState);
  const leagueAnchor = leagueMedian > 0 ? leagueMedian * PLANNER_LEAGUE_SALARY_BUFFER_RATIO : 0;
  return round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, ownBuffer, leagueAnchor));
}

export function resolveTeamSpendableCashForPlanning(
  gameState: GameState,
  teamId: string,
  teamCash: number,
): number {
  const buffer = resolveTeamLiquidityBufferTarget(gameState, teamId);
  return round(Math.max(0, teamCash - buffer));
}

export function resolveTeamCashHeadroom(gameState: GameState, teamId: string, teamCash?: number): number {
  const cash = teamCash ?? gameState.teams.find((entry) => entry.teamId === teamId)?.cash ?? 0;
  return resolveTeamSpendableCashForPlanning(gameState, teamId, cash);
}
