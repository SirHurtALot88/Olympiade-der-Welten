import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamCashSalarySoftTarget, getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";

/** League-median salary anchor for S2+ buffer (teams with thin salary history). */
export const PLANNER_LEAGUE_SALARY_BUFFER_RATIO = 0.35;

export const PLANNER_LIQUIDITY_BUFFER_MW_RATIO = 0.1;
export const PLANNER_LIQUIDITY_BUFFER_MIN = 3;

/**
 * Counter-cyclical cash buffer (Task #8): the buffer floor can be discounted (never below
 * PLANNER_LIQUIDITY_BUFFER_MIN) by up to this fraction — a ceiling so a bad season never
 * fully empties the reserve, only makes more of it spendable.
 */
export const COUNTER_CYCLICAL_MAX_RELIEF_FRACTION = 0.5;

/** Board pressure (0–10, from missed/at-risk season objectives) below which a season isn't
 * "adverse" enough to unlock any counter-cyclical relief — a mid-table-or-better season keeps
 * the normal cautious buffer. */
export const SEASON_ADVERSITY_PRESSURE_FLOOR = 5;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Identity axes (finances/ambition/...) are authored on a 0–10 scale; normalize to 0–1. */
function normalizeIdentityAxis(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0.5;
  return clamp01(value <= 10 ? value / 10 : value / 100);
}

export function usesSingleCashPlanningPolicy(gameState: GameState): boolean {
  return !isSeasonOne(gameState.season.id);
}

/**
 * Counter-cyclical buffer relief (Task #8): how much of the buffer floor a team is willing to
 * release right now, universal and trait-driven — no team-code branches, no hard caps beyond
 * COUNTER_CYCLICAL_MAX_RELIEF_FRACTION.
 *
 * willingness = (finances trait strength) x (season adversity: board pressure from
 * below-expectation objectives/rank) x (ambition trait strength)
 *
 * A financially strong team having a bad season (high pressure) leans INTO spending its buffer
 * (lower effective floor, more cash becomes available to spend on real upgrades) — but only if it
 * is also ambitious enough to want to fix the season; a low-ambition team just sits on the cash.
 * Financially weak teams get ~0 relief regardless of season or ambition and stay cautious. This
 * never removes the buffer entirely (capped at COUNTER_CYCLICAL_MAX_RELIEF_FRACTION) and never
 * pushes spendable cash above the team's actual current cash (enforced by the max(0, cash -
 * buffer) clamp in resolveTeamSpendableCashForPlanning below) — so no team can end up negative
 * from this policy, and nothing here forces a purchase, it only raises the ceiling of what's
 * structurally available.
 *
 * Reads the already-stored board-pressure record (gameState.seasonState.boardConfidence, kept
 * current by lib/board/team-season-objectives-service.ts at season transitions) directly — an O(1)
 * lookup — rather than recomputing the full season-objective overview here; this function runs
 * inside hot per-pick planning loops, so it must stay cheap. No stored record yet (e.g. very early
 * in a save before any season transition has run) reads as "at the adversity floor" -> 0 relief,
 * i.e. the pre-existing cautious behavior, never a more aggressive one.
 */
export function resolveCounterCyclicalBufferRelief(gameState: GameState, teamId: string): number {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const financesStrength = normalizeIdentityAxis(identity?.finances);
  const ambitionStrength = normalizeIdentityAxis(identity?.ambition);
  const pressure = gameState.seasonState.boardConfidence?.[teamId]?.pressure ?? SEASON_ADVERSITY_PRESSURE_FLOOR;
  const seasonAdversity = clamp01(
    (pressure - SEASON_ADVERSITY_PRESSURE_FLOOR) / (10 - SEASON_ADVERSITY_PRESSURE_FLOOR),
  );
  const willingness = clamp01(financesStrength * seasonAdversity * ambitionStrength);
  return round(willingness * COUNTER_CYCLICAL_MAX_RELIEF_FRACTION);
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
  const baseBuffer = Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, ownBuffer, leagueAnchor);

  // Counter-cyclical relief: a financially strong, ambitious team having a below-expectation
  // season discounts its own buffer floor (never below PLANNER_LIQUIDITY_BUFFER_MIN) so it can
  // actually spend into a slump instead of hoarding. See resolveCounterCyclicalBufferRelief.
  const relief = resolveCounterCyclicalBufferRelief(gameState, teamId);
  return round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, baseBuffer * (1 - relief)));
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
