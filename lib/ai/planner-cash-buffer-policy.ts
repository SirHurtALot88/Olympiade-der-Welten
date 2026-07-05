import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";

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

/** S2+ liquidity buffer: at most 1× team salary (min 3). Forces excess cash into transfer budget. */
export function resolveTeamLiquidityBufferTarget(gameState: GameState, teamId: string): number {
  const rosterMw = resolveTeamRosterMarketValue(gameState, teamId);
  const mwBuffer = round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, rosterMw * PLANNER_LIQUIDITY_BUFFER_MW_RATIO));
  if (!usesSingleCashPlanningPolicy(gameState)) {
    return mwBuffer;
  }
  const salary = getTeamSalarySum(gameState, teamId);
  if (salary <= 0) {
    return mwBuffer;
  }
  return round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, salary));
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
