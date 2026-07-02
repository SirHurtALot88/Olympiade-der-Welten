import type { GameState } from "@/lib/data/olyDataTypes";
import {
  resolveHoardTighteningMultiplier,
} from "@/lib/ai/ai-cash-salary-target-service";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { countTeamInjuredPlayers } from "@/lib/fatigue/fatigue-injury-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTeamRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

function getTeamRosterSalarySum(gameState: GameState, teamId: string) {
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

export function projectExpectedSalaryAtPlannerTarget(
  gameState: GameState,
  teamId: string,
  plannerTarget?: number,
) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  const target = plannerTarget ?? playerOpt;
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const currentSalary = getTeamRosterSalarySum(gameState, teamId);
  const finances = identity?.finances ?? 5;
  const salaryFloor = target * (3.6 + finances * 0.1);
  if (rosterCount <= 0) return round(Math.max(salaryFloor, currentSalary), 2);
  const avgSalary = currentSalary / rosterCount;
  const missing = Math.max(0, target - rosterCount);
  return round(Math.max(currentSalary + avgSalary * missing, salaryFloor), 2);
}

export function resolveHoardMultiplier(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const profile = getTeamStrategyProfile(gameState, teamId);
  const cashPriority = profile.bias.cashPriority ?? 5;
  const finances = identity?.finances ?? 5;
  const financeCap = clamp(0.35 + (finances / 10) * 0.35, 0.35, 0.7);
  return clamp(0.25 + (cashPriority / 10) * 0.25 + (finances / 10) * 0.3, 0.25, financeCap);
}

export function resolveTeamCashRunwayReserve(
  gameState: GameState,
  teamId: string,
  opts?: { expectedSalaryAfterPlan?: number },
) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  const expectedSalary =
    opts?.expectedSalaryAfterPlan ?? projectExpectedSalaryAtPlannerTarget(gameState, teamId, playerOpt);
  const hoardMultiplier = resolveHoardMultiplier(gameState, teamId);
  const cashSalaryRatio =
    expectedSalary > 0 ? (team?.cash ?? 0) / expectedSalary : 0;
  const hoardTightening = resolveHoardTighteningMultiplier(
    gameState,
    teamId,
    gameState.season.id,
    cashSalaryRatio,
  );
  const facilityPreview = previewFacilitySeasonEndFinance(
    {
      saveId: "reserve-preview",
      name: "Cash Reserve Preview",
      status: "active",
      createdAt: "",
      updatedAt: "",
      gameState,
    },
    teamId,
  );
  const maintenancePad = round(Math.max(5, (facilityPreview.facilityUpkeepTotal ?? 0) * 0.5), 2);
  let reserve = round(expectedSalary * hoardMultiplier * hoardTightening + maintenancePad, 2);
  const rosterCount = getTeamRosterCount(gameState, teamId);
  if (rosterCount < playerOpt) {
    reserve = round(Math.max(5, Math.min(reserve * 0.45, reserve - 10)), 2);
  }
  return reserve;
}

function countTeamFatigueStress(gameState: GameState, teamId: string) {
  const players = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const fatigued = players.filter((player) => (player.fatigue ?? 0) >= 65).length;
  const injured = countTeamInjuredPlayers(gameState, teamId);
  return { fatigued, injured };
}

export function getTeamPlannerRosterTarget(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerMin, playerOpt, playerMax } = deriveRosterTargets(team, identity);
  const rosterCount = getTeamRosterCount(gameState, teamId);
  const strategy = buildSeasonStrategyState(gameState)[teamId]?.seasonStrategy ?? "balanced_growth";
  const cash = team?.cash ?? 0;

  if (strategy === "cash_recovery" && cash < 0) {
    return playerMin;
  }

  let target = playerOpt;
  const { fatigued, injured } = countTeamFatigueStress(gameState, teamId);
  if (fatigued >= 2 || injured >= 2) {
    target = Math.min(playerMax, target + 1);
  }

  const expectedSalary = projectExpectedSalaryAtPlannerTarget(gameState, teamId, playerOpt);
  const reserve = resolveTeamCashRunwayReserve(gameState, teamId, { expectedSalaryAfterPlan: expectedSalary });
  const transferBudget = gameState.seasonState.aiManagerBudgetReservations?.[teamId]?.transferBudget ?? 0;
  const spendable = round(Math.max(0, cash - reserve), 2);
  const cashTight = cash < reserve || (transferBudget > 0 && transferBudget < 6);
  if (rosterCount < playerOpt) {
    return Math.max(playerMin, Math.min(playerMax, playerOpt));
  }
  if (cashTight && rosterCount >= playerMin && spendable < 6) {
    target = Math.max(playerMin, target - 1);
  }

  return Math.max(playerMin, Math.min(playerMax, target));
}
