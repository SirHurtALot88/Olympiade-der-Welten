import type { GameState } from "@/lib/data/olyDataTypes";
import {
  getSeasonHoardCashSalaryCapLabel,
  getTeamCashSalaryHardCap,
  getTeamCashSalaryRatio,
  getTeamCashSalarySoftTarget,
  getTeamSalarySum,
  isTeamOverCashSalaryHardCap,
  isTeamOverCashSalarySoftTarget,
} from "@/lib/ai/ai-cash-salary-target-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import {
  getLeagueMarketAnchorsForState,
  resolveMarketQualityProfile,
} from "@/lib/ai/ai-market-quality-profile-service";
import {
  getTeamPlannerRosterTarget,
  projectExpectedSalaryAtPlannerTarget,
  resolveTeamCashRunwayReserve,
} from "@/lib/ai/ai-team-cash-reserve-service";
import { resolvePostOptUpgradeMandate } from "@/lib/ai/planner-post-opt-upgrade-policy";

export {
  getTeamCashSalaryHardCap,
  getTeamCashSalaryRatio,
  getTeamCashSalarySoftTarget,
  isTeamOverCashSalaryHardCap,
  isTeamOverCashSalarySoftTarget,
} from "@/lib/ai/ai-cash-salary-target-service";

function getRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

const DEPLOY_MIN_TRANSFER_BUDGET = 6;

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

/** Median-Hard-Cap für Audit-Labels. Pro Team: getTeamCashSalaryHardCap. */
export function getSeasonHoardCashSalaryCap(seasonId: string) {
  return getSeasonHoardCashSalaryCapLabel(seasonId);
}

export function isCashHoardingTeam(gameState: GameState, teamId: string, seasonId: string) {
  if (isStrategicHoardTeam(gameState, teamId)) return false;
  return isTeamOverCashSalaryHardCap(gameState, teamId, seasonId);
}

export function getTeamSpendableCash(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const cash = team?.cash ?? 0;
  const reserve = resolveTeamCashRunwayReserve(gameState, teamId);
  return round(Math.max(0, cash - reserve), 2);
}

export function isStrategicHoardTeam(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const cash = team?.cash ?? 0;
  if (cash <= 0) return false;
  const profile = gameState.seasonState.aiManagerBudgetReservations?.[teamId];
  if (!profile) return false;
  return (profile.transferBudget ?? 0) <= 0 && (profile.buildingBudget ?? 0) <= 0;
}

export function teamNeedsCashRecoveryMarketAction(gameState: GameState, teamId: string) {
  const rosterCount = getRosterCount(gameState, teamId);
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (rosterCount <= 0) return false;

  const strategy = buildSeasonStrategyState(gameState)[teamId]?.seasonStrategy ?? "balanced_growth";
  const cash = team?.cash ?? 0;
  const salary = getTeamSalarySum(gameState, teamId);
  const salaryPressure = cash > 0 ? salary / Math.max(cash, 1) : salary > 0 ? 99 : 0;
  if (strategy === "cash_recovery" || strategy === "salary_control") return true;
  if (cash < 0) return true;
  if (salaryPressure > 1.25) return true;
  return false;
}

export function getTeamsNeedingCashRecoveryMarketAction(gameState: GameState) {
  return gameState.teams
    .filter((team) => teamNeedsCashRecoveryMarketAction(gameState, team.teamId))
    .map((team) => team.teamId);
}

export function getTeamMarketValueSum(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        if (!player) return sum;
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.marketValue ?? player.displayMarketValue ?? player.marketValue ?? 0);
      }, 0),
  );
}

export function getPreseasonTransferSpend(gameState: GameState, seasonId: string, teamId: string) {
  return round(
    gameState.transferHistory
      .filter(
        (entry) =>
          entry.seasonId === seasonId &&
          entry.toTeamId === teamId &&
          entry.transferType === "buy" &&
          (entry.source === "ai_preseason_market_buy" ||
            entry.source === "preseason_roster_repair_buy" ||
            entry.source === "ai_preseason_market_apply" ||
            entry.source === "ai_roster_fill"),
      )
      .reduce((sum, entry) => sum + (entry.fee ?? 0), 0),
  );
}

export function estimateUpgradeBuyFloorMw(gameState: GameState, teamId: string) {
  const rosterCount = Math.max(getRosterCount(gameState, teamId), 1);
  const teamMw = getTeamMarketValueSum(gameState, teamId);
  const avgMw = teamMw / rosterCount;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const ambition = identity?.ambition ?? 5;
  const profile = resolveMarketQualityProfile({ gameState, teamId, rosterCount });
  const anchors = getLeagueMarketAnchorsForState(gameState);
  const baseFloor = round(Math.max(avgMw * 1.35, 22), 2);
  let floor = baseFloor;
  if (ambition >= 7) floor = round(Math.max(baseFloor, 32), 2);
  else if (ambition >= 5.5) floor = round(Math.max(baseFloor, 26), 2);
  return floor;
}

export function syncPreseasonTransferBudgets(gameState: GameState, seasonId: string): GameState {
  const reservations = { ...(gameState.seasonState.aiManagerBudgetReservations ?? {}) };
  let changed = false;
  for (const team of gameState.teams) {
    if (isStrategicHoardTeam(gameState, team.teamId)) continue;
    const spendable = getTeamSpendableCash(gameState, team.teamId);
    const salary = getTeamSalarySum(gameState, team.teamId);
    const hardCap = getTeamCashSalaryHardCap(gameState, team.teamId, seasonId);
    const deployTarget = round(Math.max(0, (team.cash ?? 0) - Math.max(salary * hardCap, resolveTeamCashRunwayReserve(gameState, team.teamId))), 2);
    const nextTransferBudget = round(Math.max(spendable, deployTarget, DEPLOY_MIN_TRANSFER_BUDGET), 2);
    const existing = reservations[team.teamId];
    if (!existing) continue;
    if (Math.abs((existing.transferBudget ?? 0) - nextTransferBudget) < 0.05) continue;
    reservations[team.teamId] = { ...existing, transferBudget: nextTransferBudget, updatedAt: new Date().toISOString() };
    changed = true;
  }
  if (!changed) return gameState;
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      aiManagerBudgetReservations: reservations,
    },
  };
}

export function hasUpgradeSellOpportunity(gameState: GameState, teamId: string, seasonId: string, _playerMin: number) {
  const rosterCount = getRosterCount(gameState, teamId);
  if (rosterCount === 0) return false;
  return teamNeedsPostOptUpgradeDeploy(gameState, teamId, seasonId);
}

export function teamNeedsPostOptUpgradeDeploy(gameState: GameState, teamId: string, _seasonId: string) {
  if (isStrategicHoardTeam(gameState, teamId)) return false;
  return resolvePostOptUpgradeMandate(gameState, teamId).active;
}

export function teamNeedsTransferBudgetDeploy(gameState: GameState, teamId: string, seasonId: string) {
  if (isStrategicHoardTeam(gameState, teamId)) return false;

  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const cash = team?.cash ?? 0;
  const salary = getTeamSalarySum(gameState, teamId);
  const plannerTarget = getTeamPlannerRosterTarget(gameState, teamId);
  const expectedSalary = projectExpectedSalaryAtPlannerTarget(gameState, teamId, plannerTarget);
  const reserve = resolveTeamCashRunwayReserve(gameState, teamId, { expectedSalaryAfterPlan: expectedSalary });
  const spendable = round(Math.max(0, cash - reserve), 2);
  const hardCap = getTeamCashSalaryHardCap(gameState, teamId, seasonId);
  const softTarget = getTeamCashSalarySoftTarget(gameState, teamId);
  const targetCashCeiling = round(Math.max(reserve, salary * hardCap), 2);
  const softCashCeiling = round(Math.max(reserve, salary * softTarget), 2);

  if (cash <= softCashCeiling + DEPLOY_MIN_TRANSFER_BUDGET && !isTeamOverCashSalaryHardCap(gameState, teamId, seasonId)) {
    return false;
  }
  if (cash <= targetCashCeiling + DEPLOY_MIN_TRANSFER_BUDGET) return false;
  if (spendable < DEPLOY_MIN_TRANSFER_BUDGET) return false;

  const rosterCount = getRosterCount(gameState, teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  const cashSalaryRatio = salary > 0 ? cash / salary : 0;
  if (rosterCount < playerOpt && cashSalaryRatio + 0.01 < 1.15) return false;
  if (teamNeedsPostOptUpgradeDeploy(gameState, teamId, seasonId)) return true;
  const optTarget = getTeamOptTarget(gameState, teamId);
  const teamMw = getTeamMarketValueSum(gameState, teamId);
  const cashToMw = teamMw > 0 ? cash / teamMw : 0;

  if (cashToMw >= 0.75 && rosterCount <= playerOpt + 1 && spendable >= DEPLOY_MIN_TRANSFER_BUDGET * 2) return true;

  const fatigued = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .filter((player) => (player.fatigue ?? 0) >= 65).length;
  if (fatigued >= 2 && rosterCount <= optTarget + 1 && spendable >= DEPLOY_MIN_TRANSFER_BUDGET * 2) return true;

  if (isTeamOverCashSalarySoftTarget(gameState, teamId, seasonId)) return true;

  return isCashHoardingTeam(gameState, teamId, seasonId);
}

export function getTeamsNeedingTransferBudgetDeploy(gameState: GameState, seasonId: string) {
  return gameState.teams
    .filter((team) => teamNeedsTransferBudgetDeploy(gameState, team.teamId, seasonId))
    .map((team) => team.teamId);
}

export function getTeamsNeedingPostOptUpgradeDeploy(gameState: GameState, seasonId: string) {
  return gameState.teams
    .filter((team) => teamNeedsPostOptUpgradeDeploy(gameState, team.teamId, seasonId))
    .map((team) => team.teamId);
}

export function summarizeBudgetDeploy(gameState: GameState, seasonId: string) {
  return gameState.teams.map((team) => {
    const spent = getPreseasonTransferSpend(gameState, seasonId, team.teamId);
    const plannerTarget = getTeamPlannerRosterTarget(gameState, team.teamId);
    const expectedSalary = projectExpectedSalaryAtPlannerTarget(gameState, team.teamId, plannerTarget);
    const cashReserve = resolveTeamCashRunwayReserve(gameState, team.teamId, {
      expectedSalaryAfterPlan: expectedSalary,
    });
    const salary = getTeamSalarySum(gameState, team.teamId);
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      transferSpent: spent,
      needsDeploy: teamNeedsTransferBudgetDeploy(gameState, team.teamId, seasonId),
      needsUpgradeDeploy: teamNeedsPostOptUpgradeDeploy(gameState, team.teamId, seasonId),
      strategicHoard: isStrategicHoardTeam(gameState, team.teamId),
      cashHoarding: isCashHoardingTeam(gameState, team.teamId, seasonId),
      cashSalaryRatio: getTeamCashSalaryRatio(gameState, team.teamId),
      softTarget: getTeamCashSalarySoftTarget(gameState, team.teamId),
      hoardCap: getTeamCashSalaryHardCap(gameState, team.teamId, seasonId),
      spendable: getTeamSpendableCash(gameState, team.teamId),
      cashRunwayReserve: cashReserve,
      upgradeBuyFloorMw: estimateUpgradeBuyFloorMw(gameState, team.teamId),
      cashToMw:
        getTeamMarketValueSum(gameState, team.teamId) > 0
          ? round((team.cash ?? 0) / getTeamMarketValueSum(gameState, team.teamId), 2)
          : null,
      salary,
    };
  });
}
