import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { parseSeasonNumber } from "@/lib/season/transfer-standings-balance";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getTeamSalarySum(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        if (!player) return sum + (entry.salary ?? 0);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.salary ?? entry.salary ?? 0);
      }, 0),
  );
}

export function getTeamCashSalaryRatio(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const cash = team?.cash ?? 0;
  const salary = getTeamSalarySum(gameState, teamId);
  if (salary <= 0) return 0;
  return round(cash / salary, 3);
}

function getSeasonHardCapBuffer(seasonId: string) {
  const seasonNumber = parseSeasonNumber(seasonId);
  if (seasonNumber <= 3) return 0;
  if (seasonNumber === 4) return 0.05;
  return 0.1;
}

/** S2–S3: planner buffer is 1× salary — hoard/deploy threshold matches that ceiling. */
function usesPlannerSalaryBufferCap(seasonId: string) {
  const seasonNumber = parseSeasonNumber(seasonId);
  return seasonNumber >= 2 && seasonNumber <= 3;
}

/** Ziel-Cash/Gehalt nach Finance: 0.25 (sparsam) bis 0.75 (finance-stark). */
export function getTeamCashSalarySoftTarget(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const finances = identity?.finances ?? 5;
  return round(clamp(0.25 + (finances / 10) * 0.5, 0.25, 0.75), 3);
}

/** Hartes Cap: S2–S3 max 1.0× salary; sonst 0.75 (Finance-Ausreißer ≥8 max 1.0 + Season-Puffer ab S4). */
export function getTeamCashSalaryHardCap(gameState: GameState, teamId: string, seasonId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const finances = identity?.finances ?? 5;
  if (usesPlannerSalaryBufferCap(seasonId)) {
    return 1.0;
  }
  const base = finances >= 8 ? 1.0 : 0.75;
  return round(base + getSeasonHardCapBuffer(seasonId), 3);
}

export function isTeamOverCashSalarySoftTarget(gameState: GameState, teamId: string, seasonId: string) {
  const ratio = getTeamCashSalaryRatio(gameState, teamId);
  if (ratio <= 0) return false;
  return ratio > getTeamCashSalarySoftTarget(gameState, teamId) + 0.01;
}

export function isTeamOverCashSalaryHardCap(gameState: GameState, teamId: string, seasonId: string) {
  const ratio = getTeamCashSalaryRatio(gameState, teamId);
  if (ratio <= 0) return false;
  return ratio > getTeamCashSalaryHardCap(gameState, teamId, seasonId) + 0.01;
}

/** Median-Hard-Cap für Audit-Labels (deprecated global cap). */
export function getSeasonHoardCashSalaryCapLabel(seasonId: string) {
  const seasonNumber = parseSeasonNumber(seasonId);
  if (seasonNumber <= 3) return 0.75;
  if (seasonNumber === 4) return 0.8;
  return 0.85;
}

export function resolveHoardTighteningMultiplier(
  gameState: GameState,
  teamId: string,
  seasonId: string,
  cashSalaryRatio: number,
) {
  const softTarget = getTeamCashSalarySoftTarget(gameState, teamId);
  const hardCap = getTeamCashSalaryHardCap(gameState, teamId, seasonId);
  if (cashSalaryRatio > hardCap) return 0.5;
  if (cashSalaryRatio > softTarget + 0.15) return 0.7;
  if (cashSalaryRatio > softTarget) return 0.85;
  return 1;
}
