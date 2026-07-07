import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamCashSalarySoftTarget, getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";

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
  const softRatio = getTeamCashSalarySoftTarget(gameState, teamId);
  const ownBuffer = salary * softRatio;
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
