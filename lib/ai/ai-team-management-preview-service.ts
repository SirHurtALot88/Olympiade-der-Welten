import type {
  DisciplineCategory,
  GameState,
  Player,
  PlayerGeneratorAttributes,
  Team,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";
import { getTeamObjectiveAiBias, type TeamObjectiveAiBias } from "@/lib/board/team-season-objectives-service";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { FACILITY_CATALOG, getFacilityLevelDefinition, type FacilityId } from "@/lib/facilities/facility-catalog";
import { calculateFacilityMaintenanceCost, FACILITY_CONDITION_FULL } from "@/lib/facilities/facility-condition";
import { applyRecoveryFacilityModifiers, applyTrainingXpFacilityModifiers, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { countTeamInjuredPlayers, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-injury-service";
import { assessPlayerMorale, type PlayerMoraleAssessment } from "@/lib/morale/player-morale-service";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import {
  ensureLeagueMarketValueSnapshot,
  resolveLeagueMarketValueMap,
} from "@/lib/player-formulas/market-value-apply";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";
import { buildPlayerScoutPotentialFromGameState } from "@/lib/progression/player-potential-service";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { applyTrainingRecoveryImpact } from "@/lib/training/training-recovery-impact";
import { PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import {
  buildTeamPlayerTrainingLoadPlans,
  countTeamHardTrainingDemandPressure,
  type AiPlayerTrainingLoadPlan,
} from "@/lib/ai/ai-player-training-load-service";
import {
  buildTeamPlayerTrainingClassPlans,
  type AiPlayerTrainingClassPlan,
} from "@/lib/ai/ai-player-training-class-service";
import {
  projectExpectedSalaryAtPlannerTarget,
  resolveCombinedLiquidityReserve,
} from "@/lib/ai/ai-team-cash-reserve-service";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";

export type AiManagementStrategicIntent =
  | "win_now"
  | "balanced_growth"
  | "rebuild"
  | "cash_recovery"
  | "roster_repair"
  | "injury_recovery"
  | "youth_development"
  | "salary_control"
  | "facility_push"
  | "conservative_hold";

export type AiManagementRiskProfile = "low" | "medium" | "high" | "critical";

export type AiManagementBuildingAction =
  | "build_new"
  | "upgrade_existing"
  | "maintain"
  | "skip"
  | "downgrade_or_ignore_if_no_cash";

export type AiManagementTrainingFocus = "POW" | "SPE" | "MEN" | "SOC" | "BALANCED" | "RECOVERY";
export type AiManagementTrainingIntensity = "light" | "normal" | "hard";

export type AiManagementBudgetBuckets = {
  cashReserve: number;
  salaryReserve: number;
  transferBudget: number;
  buildingBudget: number;
  maintenanceBudget: number;
  emergencyBudget: number;
};

export type AiTeamManagementProfile = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  strategicIntent: AiManagementStrategicIntent;
  riskProfile: AiManagementRiskProfile;
  boardPressure: number;
  youthShare: number;
  injuryPressure: number;
  fatiguePressure: number;
  moralePressure: number;
  boardTrustPressure: number;
  rosterPressure: number;
  salaryPressure: number;
  facilityOpportunity: number;
  warnings: string[];
};

export type AiTeamBudgetPlanPreview = {
  teamId: string;
  cash: number;
  calculatedMarketValueSum: number;
  expectedSalarySum: number;
  salarySumRaw: number;
  salarySumBudget: number;
  salarySum: number;
  salaryUnitScale: number;
  freeCashAfterReserves: number;
  bucketsBefore: AiManagementBudgetBuckets;
  bucketsAfterPlan: AiManagementBudgetBuckets;
  spendPlan: {
    maintenance: number;
    buildings: number;
    transfers: number;
  };
  warnings: string[];
};

export type AiTeamBuildingPlanRow = {
  teamId: string;
  teamCode: string;
  buildingType: FacilityId;
  buildingLabel: string;
  currentLevel: number;
  action: AiManagementBuildingAction;
  cost: number;
  maintenanceCost: number;
  expectedEffect: string;
  score: number;
  reasonsPositive: string[];
  reasonsNegative: string[];
  warnings: string[];
  cashBefore: number;
  cashAfter: number;
};

export type AiTeamTrainingPlanPreview = {
  teamId: string;
  teamCode: string;
  selectedTrainingFocus: AiManagementTrainingFocus;
  selectedTrainingIntensity: AiManagementTrainingIntensity;
  expectedXpEffect: number;
  expectedRecoveryEffect: number;
  expectedInjuryRiskEffect: number;
  reasons: string[];
  warnings: string[];
  playerTrainingPlans: AiPlayerTrainingLoadPlan[];
  playerTrainingClassPlans: AiPlayerTrainingClassPlan[];
};

export type AiTeamManagementPreview = {
  teamId: string;
  teamCode: string;
  teamName: string;
  profile: AiTeamManagementProfile;
  budgetPlan: AiTeamBudgetPlanPreview;
  buildingPlan: AiTeamBuildingPlanRow[];
  trainingPlan: AiTeamTrainingPlanPreview;
  warnings: string[];
};

export type AiLeagueManagementPreview = {
  generatedAt: string;
  teams: AiTeamManagementPreview[];
};

type TeamContext = {
  team: Team;
  identity: TeamIdentity;
  players: Player[];
  morale: PlayerMoraleAssessment[];
  salarySumRaw: number;
  salarySumBudget: number;
  calculatedMarketValueSum: number;
  salarySum: number;
  expectedSalarySum: number;
  fatigueAvg: number;
  fatigueHighCount: number;
  fatigueCriticalCount: number;
  injuryCount: number;
  injuryRiskHighCount: number;
  injuryRiskCriticalCount: number;
  projectedHardTrainingRiskCount: number;
  moraleAvg: number;
  lowMoraleCount: number;
  lowBoardTrustCount: number;
  youthCount: number;
  rosterCount: number;
  contractExitCount: number;
  lastSeasonRank: number | null;
  lastSeasonPrizeMoney: number;
  upcomingCategoryCounts: Record<DisciplineCategory, number>;
  objectiveAiBias: TeamObjectiveAiBias | null;
  prevSeasonInjuryCount: number;
  prevSeasonAvgMatchdayFatigue: number;
  chronicInjuryPlayerCount: number;
  gmArchetype: string | null;
};

type CalculatedPlayerEconomy = {
  marketValue: number | null;
  salary: number | null;
  source: "calculated" | "fallback";
  warnings: string[];
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0;
}

const RAW_SALARY_TO_BUDGET_UNIT = 1000;

function identitySignal(value: number) {
  return value <= 10 ? value * 10 : value;
}

const REBUILD_BUILDING_BOTTOM_TIER = 8;
const REBUILD_BUILDING_BOTTOM_MIN = 0;
const REBUILD_BUILDING_BOTTOM_MAX = 5;
const REBUILD_BUILDING_TOP_MAX = 25;
const REBUILD_BUILDING_BOTTOM_CEILING = 10;
const REBUILD_BUILDING_SEASON_GROWTH = 0.04;

function parseSeasonNumber(seasonId: string | null | undefined) {
  const match = (seasonId ?? "season-1").match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

/** Rebuild-phase facility cap by cash rank — bottom ~8 teams land in a soft 0–5 corridor (≤10). */
function resolveRebuildBuildingCap(gameState: GameState, teamId: string) {
  const ranked = gameState.teams
    .map((team) => ({ teamId: team.teamId, cash: team.cash ?? 0 }))
    .sort((left, right) => left.cash - right.cash || left.teamId.localeCompare(right.teamId));
  const rank = ranked.findIndex((entry) => entry.teamId === teamId);
  if (rank < 0) return 0;

  const seasonFactor = 1 + (Math.max(1, parseSeasonNumber(gameState.season?.id)) - 1) * REBUILD_BUILDING_SEASON_GROWTH;
  let baseCap = 0;
  if (rank < REBUILD_BUILDING_BOTTOM_TIER) {
    const tierSpan = Math.max(1, REBUILD_BUILDING_BOTTOM_TIER - 1);
    const tierProgress = rank / tierSpan;
    baseCap = REBUILD_BUILDING_BOTTOM_MIN + tierProgress * (REBUILD_BUILDING_BOTTOM_MAX - REBUILD_BUILDING_BOTTOM_MIN);
    return round(Math.min(baseCap * seasonFactor, REBUILD_BUILDING_BOTTOM_CEILING * seasonFactor), 2);
  }

  const upperStart = REBUILD_BUILDING_BOTTOM_TIER;
  const upperSpan = Math.max(1, ranked.length - upperStart - 1);
  const upperProgress = (rank - upperStart) / upperSpan;
  baseCap = REBUILD_BUILDING_BOTTOM_MAX + upperProgress * (REBUILD_BUILDING_TOP_MAX - REBUILD_BUILDING_BOTTOM_MAX);
  return round(Math.min(baseCap * seasonFactor, REBUILD_BUILDING_TOP_MAX * seasonFactor), 2);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toGeneratorAttributes(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  const values = {
    power: stats.power,
    health: stats.health,
    stamina: stats.stamina,
    intelligence: stats.intelligence,
    awareness: stats.awareness,
    determination: stats.determination,
    speed: stats.speed,
    dexterity: stats.dexterity,
    charisma: stats.charisma,
    will: stats.will,
    spirit: stats.spirit,
    torment: stats.torment,
  };
  return Object.values(values).every((value) => isFiniteNumber(value))
    ? (values as PlayerGeneratorAttributes)
    : null;
}

function getPlayerMwChangeFix(player: Player) {
  const value = (player as Player & { mwChangeFix?: number | null }).mwChangeFix;
  return isFiniteNumber(value) ? value : null;
}

function buildCalculatedEconomyByPlayer(gameState: GameState) {
  const formulaSources = loadPlayerFormulaSources();
  const snapshotGameState = ensureLeagueMarketValueSnapshot(gameState);
  const marketValueByPlayerId = resolveLeagueMarketValueMap(snapshotGameState);

  return new Map(
    gameState.players.map((player) => {
      const warnings: string[] = [];
      const calculatedMarketValue = marketValueByPlayerId.get(player.id) ?? null;
      if (calculatedMarketValue == null) warnings.push("calculated_market_value_missing");
      const attributes = toGeneratorAttributes(player);
      if (!attributes) warnings.push("attribute_sheet_stats_missing");
      const canCalculateSalary = Boolean(
        calculatedMarketValue != null &&
          attributes &&
          formulaSources.attributeSalaryModifiers &&
          formulaSources.traitSalaryFactors,
      );
      const salaryBreakdown = canCalculateSalary
        ? calculateSalaryFromMarketValue({
            salaryMarketValue: calculatedMarketValue!,
            attributes: attributes!,
            traitsPositive: player.traitsPositive,
            traitsNegative: player.traitsNegative,
            attributeSalaryModifiers: formulaSources.attributeSalaryModifiers!,
            traitSalaryFactors: formulaSources.traitSalaryFactors!,
          })
        : null;
      if (!salaryBreakdown) warnings.push("calculated_salary_missing");
      const fallbackMarketValue = player.displayMarketValue ?? player.marketValue ?? null;
      const fallbackSalary = player.displaySalary ?? player.salaryDemand ?? null;
      return [
        player.id,
        {
          marketValue: calculatedMarketValue ?? fallbackMarketValue,
          salary: salaryBreakdown?.finalSalary ?? fallbackSalary,
          source: calculatedMarketValue != null && salaryBreakdown ? "calculated" : "fallback",
          warnings,
        } satisfies CalculatedPlayerEconomy,
      ] as const;
    }),
  );
}

function ratio(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

function normalizeMode(mode: AiManagementTrainingIntensity): PlayerTrainingMode {
  return mode === "light" ? "leicht" : mode === "hard" ? "hart" : "mittel";
}

function getControlMode(gameState: GameState, teamId: string) {
  return gameState.seasonState.teamControlSettings?.[teamId]?.controlMode ?? "ai";
}

function getPreviousSeasonId(gameState: GameState) {
  const snapshots = gameState.seasonState.seasonSnapshots ?? [];
  if (snapshots.length > 0) {
    return snapshots.at(-1)?.seasonId ?? null;
  }
  const match = gameState.season.id.match(/season-(\d+)/);
  if (!match) return null;
  const seasonNumber = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(seasonNumber) && seasonNumber > 1 ? `season-${seasonNumber - 1}` : null;
}

function buildPrevSeasonHealthMetrics(gameState: GameState, teamId: string, players: Player[]) {
  const prevSeasonId = getPreviousSeasonId(gameState);
  if (!prevSeasonId) {
    return { prevSeasonInjuryCount: 0, prevSeasonAvgMatchdayFatigue: 0, chronicInjuryPlayerCount: 0 };
  }
  let prevSeasonInjuryCount = 0;
  let chronicInjuryPlayerCount = 0;
  const fatigueSamples: number[] = [];
  for (const player of players) {
    const prevEvents = (player.injuryHistory ?? []).filter(
      (entry) => entry.teamId === teamId && entry.seasonId === prevSeasonId,
    );
    prevSeasonInjuryCount += prevEvents.length;
    if (prevEvents.length >= 2) chronicInjuryPlayerCount += 1;
    for (const event of prevEvents) {
      if (Number.isFinite(event.fatigueBefore)) fatigueSamples.push(event.fatigueBefore);
    }
  }
  for (const event of gameState.seasonState.injuryEvents ?? []) {
    if (event.teamId !== teamId || event.seasonId !== prevSeasonId || event.result !== "injured") continue;
    if (Number.isFinite(event.fatigueBefore)) fatigueSamples.push(event.fatigueBefore);
  }
  const prevSeasonAvgMatchdayFatigue = fatigueSamples.length > 0 ? round(average(fatigueSamples), 2) : 0;
  return { prevSeasonInjuryCount, prevSeasonAvgMatchdayFatigue, chronicInjuryPlayerCount };
}

function isPrevSeasonHealthStressed(context: TeamContext) {
  return (
    context.prevSeasonAvgMatchdayFatigue >= 55 ||
    context.prevSeasonInjuryCount >= 10 ||
    context.chronicInjuryPlayerCount >= 2
  );
}

function buildTeamContext(
  gameState: GameState,
  teamId: string,
  calculatedEconomyByPlayerId = buildCalculatedEconomyByPlayer(gameState),
): TeamContext | null {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  if (!team || !identity) {
    return null;
  }
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const players = rosterEntries
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId) ?? null)
    .filter((entry): entry is Player => Boolean(entry));
  const morale = players
    .map((player) => assessPlayerMorale({ gameState, playerId: player.id, teamId }))
    .filter((entry): entry is PlayerMoraleAssessment => Boolean(entry));
  const salarySumRaw = round(sum(rosterEntries.map((entry) => entry.salary ?? 0)), 2);
  const calculatedRosterEconomy = players.map((player) => calculatedEconomyByPlayerId.get(player.id) ?? null);
  const calculatedMarketValueSum = round(sum(calculatedRosterEconomy.map((entry) => entry?.marketValue ?? 0)), 2);
  const expectedSalarySum = round(sum(calculatedRosterEconomy.map((entry) => entry?.salary ?? 0)), 2);
  const salarySumBudget = expectedSalarySum;
  const fatigueValues = players.map((player) => player.fatigue ?? 0);
  const fatigueAvg = round(average(fatigueValues), 2);
  const fatigueHighCount = players.filter((player) => (player.fatigue ?? 0) >= 70).length;
  const fatigueCriticalCount = players.filter((player) => (player.fatigue ?? 0) >= 85).length;
  const injuryCount = countTeamInjuredPlayers(gameState, teamId);
  const injuryRiskHighCount = players.filter((player) => getInjuryRiskPercent(player.fatigue ?? 0) >= 12).length;
  const injuryRiskCriticalCount = players.filter((player) => getInjuryRiskPercent(player.fatigue ?? 0) >= 25).length;
  const projectedHardTrainingRiskCount = players.filter(
    (player) => getInjuryRiskPercent((player.fatigue ?? 0) + FATIGUE_LOAD_BY_MODE.hart) >= 18,
  ).length;
  const moraleAvg = round(average(morale.map((entry) => entry.morale)), 2);
  const lowMoraleCount = morale.filter((entry) => entry.morale < 45).length;
  const lowBoardTrustCount = morale.filter((entry) => (entry.moraleRenewalRisk ?? 0) >= 60).length;
  const youthCount = players.filter((player) => {
    const potential = buildPlayerScoutPotentialFromGameState({ gameState, player });
    return (potential?.scoutRating ?? 0) >= 70 || (player.potential ?? 0) >= 70;
  }).length;
  const contractExitCount = rosterEntries.filter((entry) => (entry.contractLength ?? 0) <= 1).length;
  const snapshots = gameState.seasonState.seasonSnapshots ?? [];
  const lastSeasonRank =
    snapshots.at(-1)?.finalStandings.find((entry) => entry.teamId === teamId)?.rank ??
    gameState.seasonState.standings?.[teamId]?.rank ??
    null;
  const lastSeasonPrizeMoney =
    gameState.seasonState.standings?.[teamId]?.sponsorSeason ??
    gameState.seasonState.standings?.[teamId]?.sponsorTotal ??
    0;
  const upcomingCategoryCounts: Record<DisciplineCategory, number> = {
    power: 0,
    speed: 0,
    mental: 0,
    social: 0,
  };
  const disciplinesById = new Map(gameState.disciplines.map((entry) => [entry.id, entry] as const));
  for (const entry of gameState.seasonState.disciplineSchedule ?? []) {
    for (const slot of [entry.discipline1, entry.discipline2]) {
      const category = slot?.category ?? disciplinesById.get(slot?.disciplineId ?? "")?.category ?? null;
      if (category) {
        upcomingCategoryCounts[category] += 1;
      }
    }
  }
  const prevSeasonHealth = buildPrevSeasonHealthMetrics(gameState, teamId, players);
  return {
    team,
    identity,
    players,
    morale,
    salarySumRaw,
    salarySumBudget,
    calculatedMarketValueSum,
    salarySum: salarySumBudget,
    expectedSalarySum,
    fatigueAvg,
    fatigueHighCount,
    fatigueCriticalCount,
    injuryCount,
    injuryRiskHighCount,
    injuryRiskCriticalCount,
    projectedHardTrainingRiskCount,
    moraleAvg,
    lowMoraleCount,
    lowBoardTrustCount,
    youthCount,
    rosterCount: rosterEntries.length,
    contractExitCount,
    lastSeasonRank,
    lastSeasonPrizeMoney,
    upcomingCategoryCounts,
    objectiveAiBias: getTeamObjectiveAiBias(gameState, teamId),
    gmArchetype: getTeamGeneralManager(gameState, teamId)?.profile?.archetype ?? null,
    ...prevSeasonHealth,
  };
}

function deriveStrategicIntent(context: TeamContext) {
  const ambition = identitySignal(context.identity.ambition);
  const finances = identitySignal(context.identity.finances);
  const salaryPressure = context.salarySum > 0 ? context.expectedSalarySum / Math.max(context.salarySum, 1) : 1;
  const rosterGap = Math.max(0, context.identity.playerMin - context.rosterCount);
  if (context.team.cash < 0) return "cash_recovery" as const;
  if (rosterGap > 0 || context.rosterCount < context.identity.playerMin) return "roster_repair" as const;
  if ((context.objectiveAiBias?.rosterUrgency ?? 0) >= 0.78 && context.rosterCount < context.identity.playerOpt) return "roster_repair" as const;
  if (context.injuryCount >= 1 || context.fatigueCriticalCount >= 1 || context.injuryRiskHighCount >= 2) {
    return "injury_recovery" as const;
  }
  if (salaryPressure >= 1.18 && finances <= 45) return "salary_control" as const;
  if ((context.objectiveAiBias?.budgetConservatism ?? 0) >= 0.7 && context.team.cash <= 25) return "conservative_hold" as const;
  if ((context.objectiveAiBias?.facilityPriority ?? 0) >= 0.7 && context.team.cash >= 35) return "facility_push" as const;
  if (ratio(context.youthCount, context.rosterCount) >= 0.35) return "youth_development" as const;
  if (context.team.cash >= 80 && ambition >= 70 && finances >= 55) return "facility_push" as const;
  if ((context.lastSeasonRank ?? 99) <= 6 && ambition >= 68) return "win_now" as const;
  if (context.team.cash <= 12 && finances >= 60) return "conservative_hold" as const;
  if ((context.lastSeasonRank ?? 99) >= 20 && ambition <= 55) return "rebuild" as const;
  return "balanced_growth" as const;
}

function deriveRiskProfile(context: TeamContext) {
  const score =
    (context.team.cash < 0 ? 40 : context.team.cash < 10 ? 25 : context.team.cash < 20 ? 10 : 0) +
    context.injuryCount * 8 +
    context.fatigueCriticalCount * 8 +
    context.lowMoraleCount * 4 +
    context.lowBoardTrustCount * 4 +
    Math.max(0, context.identity.playerMin - context.rosterCount) * 12;
  if (score >= 55) return "critical";
  if (score >= 35) return "high";
  if (score >= 18) return "medium";
  return "low";
}

function buildProfile(gameState: GameState, context: TeamContext): AiTeamManagementProfile {
  const strategicIntent = deriveStrategicIntent(context);
  const riskProfile = deriveRiskProfile(context);
  const ambition = identitySignal(context.identity.ambition);
  const finances = identitySignal(context.identity.finances);
  const boardConfidence = identitySignal(context.identity.boardConfidence);
  const objectiveBias = context.objectiveAiBias;
  const rosterPressure = Math.max(
    clamp(((context.identity.playerOpt - context.rosterCount) / Math.max(context.identity.playerOpt, 1)) * 100, 0, 100),
    (objectiveBias?.rosterUrgency ?? 0) * 100,
  );
  const salaryPressure = clamp((context.expectedSalarySum / Math.max(context.team.cash + context.salarySum, 1)) * 100, 0, 100);
  const warnings: string[] = [];
  if (context.team.cash < 10) warnings.push("cash_low");
  if (context.injuryCount > 0) warnings.push("injury_load");
  if (context.fatigueCriticalCount > 0) warnings.push("fatigue_critical");
  if (context.injuryRiskHighCount >= 2) warnings.push("injury_risk_cluster");
  if (context.lowMoraleCount >= 2) warnings.push("morale_cluster_low");
  if (context.contractExitCount >= 2) warnings.push("contract_exit_wave");
  warnings.push(...(objectiveBias?.warnings ?? []).map((warning) => `board_objective:${warning}`));
  return {
    teamId: context.team.teamId,
    teamCode: context.team.shortCode,
    teamName: context.team.name,
    controlMode: getControlMode(gameState, context.team.teamId),
    strategicIntent,
    riskProfile,
    boardPressure: Math.max(clamp(100 - boardConfidence, 0, 100), (objectiveBias?.pressure ?? 0) * 10),
    youthShare: round(ratio(context.youthCount, context.rosterCount) * 100, 2),
    injuryPressure: clamp(
      context.injuryCount * 22 +
        context.fatigueCriticalCount * 12 +
        context.injuryRiskHighCount * 8 +
        context.injuryRiskCriticalCount * 10,
      0,
      100,
    ),
    fatiguePressure: clamp(context.fatigueAvg + context.fatigueHighCount * 5, 0, 100),
    moralePressure: clamp((100 - context.moraleAvg) + context.lowMoraleCount * 8, 0, 100),
    boardTrustPressure: clamp(context.lowBoardTrustCount * 18 + (100 - boardConfidence) * 0.35, 0, 100),
    rosterPressure: round(rosterPressure, 2),
    salaryPressure: round(salaryPressure, 2),
    facilityOpportunity: clamp(context.team.cash * 0.8 + finances * 0.4 + ambition * 0.35, 0, 100),
    warnings,
  };
}

function resolveTeamSeasonSponsorSurplus(gameState: GameState, teamId: string, seasonId: string) {
  return round(
    (gameState.seasonState.sponsorPayoutLogs ?? [])
      .filter(
        (log) =>
          log.teamId === teamId &&
          log.seasonId === seasonId &&
          log.componentId !== "salary_deduct" &&
          (log.cashDelta ?? 0) > 0,
      )
      .reduce((sum, log) => sum + (log.cashDelta ?? 0), 0),
    2,
  );
}

function buildBudgetPlan(gameState: GameState, context: TeamContext): AiTeamBudgetPlanPreview {
  const facilityPreview = previewFacilitySeasonEndFinance({
    saveId: "preview",
    name: "AI Management Preview",
    status: "active",
    createdAt: "",
    updatedAt: "",
    gameState,
  }, context.team.teamId);
  const teamFacilities = getTeamFacilityState(gameState, context.team.teamId);
  const facilityMaintenanceCost = round(
    sum(
      FACILITY_CATALOG.map((facility) => {
        const record = teamFacilities.facilities[facility.facilityId];
        const level = record?.level ?? 0;
        const conditionPct = record?.conditionPct ?? FACILITY_CONDITION_FULL;
        return level > 0 && conditionPct < FACILITY_CONDITION_FULL
          ? calculateFacilityMaintenanceCost({ facilityId: facility.facilityId, level, conditionPct })
          : 0;
      }),
    ),
    2,
  );
  const cash = context.team.cash ?? 0;
  const ambition = identitySignal(context.identity.ambition);
  const finances = identitySignal(context.identity.finances);
  const objectiveBias = context.objectiveAiBias;
  // While rebuilding (roster below identity Opt — e.g. Season 1 draft), the player draft always
  // wins over facility spend: buckets must not lock cash into buildings before the roster exists.
  const rosterBelowOpt = context.rosterCount < context.identity.playerOpt;
  const expectedSalaryAtPlan = projectExpectedSalaryAtPlannerTarget(
    gameState,
    context.team.teamId,
    context.identity.playerOpt ?? undefined,
  );
  const liquidityReserve = resolveCombinedLiquidityReserve({
    gameState,
    teamId: context.team.teamId,
    expectedSalaryAfterPlan: Math.max(context.expectedSalarySum, expectedSalaryAtPlan),
    rosterBelowOpt,
    buyAggression: objectiveBias?.buyAggression,
  });
  const salaryReserve = liquidityReserve.salaryReserve;
  const maintenanceBudget = round(Math.max(facilityPreview.facilityUpkeepTotal, facilityMaintenanceCost, 0), 2);
  const emergencyBudget = round(Math.max(5, cash * (context.injuryCount > 0 ? 0.14 : 0.08)), 2);
  const cashReserve = liquidityReserve.cashReserve;
  const rawFreeCash = Math.max(0, cash - salaryReserve - maintenanceBudget - emergencyBudget - cashReserve);
  const recoveryBuildingNeed =
    context.injuryCount > 0 || context.fatigueHighCount >= 2 || context.fatigueAvg >= 60 ? 0.12 : 0;
  const recoveryBudgetReserve =
    context.fatigueAvg >= 60 ||
    context.prevSeasonAvgMatchdayFatigue >= 55 ||
    context.injuryCount >= 3 ||
    context.prevSeasonInjuryCount >= 8
      ? round(Math.min(14, Math.max(8, rawFreeCash * 0.12)), 2)
      : 0;
  const buildingBias =
    0.31 +
    (ambition >= 65 ? 0.08 : 0) +
    (finances >= 70 ? 0.04 : 0) +
    (context.youthCount >= 2 ? 0.04 : 0) +
    recoveryBuildingNeed +
    (objectiveBias?.facilityPriority ?? 0) * 0.09 +
    // Facility architect: direct archetype hook so the build-budget share structurally leads.
    (context.gmArchetype === "facility_architect" ? 0.12 : 0);
  const transferBias =
    0.28 +
    (context.rosterCount < context.identity.playerMin ? 0.24 : context.rosterCount < context.identity.playerOpt ? 0.14 : 0) +
    (ambition >= 70 ? 0.05 : 0) +
    (finances >= 65 ? 0.03 : 0) +
    (objectiveBias?.buyAggression ?? 0) * 0.12 -
    (objectiveBias?.budgetConservatism ?? 0) * 0.05;
  // Salary / emergency / cash reserves are the only liquidity buffers — do not haircut again.
  const investableCash = Math.max(0, rawFreeCash - recoveryBudgetReserve);
  const totalBias = Math.max(0.01, buildingBias + transferBias);
  // During rebuild, cap facility spend by cash rank — bottom ~8 teams in a soft 0–5 corridor (≤10),
  // richer teams up to 25; grows ~4 % per season so the band can rise over time.
  const rebuildBuildingCap = resolveRebuildBuildingCap(gameState, context.team.teamId);
  let buildingBudget = rosterBelowOpt
    ? round(Math.min(rebuildBuildingCap, investableCash), 2)
    : round(investableCash * (buildingBias / totalBias), 2);
  const sponsorSurplus = resolveTeamSeasonSponsorSurplus(gameState, context.team.teamId, gameState.season.id);
  if (!rosterBelowOpt && sponsorSurplus > 0) {
    buildingBudget = round(Math.min(buildingBudget, sponsorSurplus), 2);
  }
  const transferBudget = round(Math.max(0, investableCash - buildingBudget), 2);
  const warnings: string[] = [];
  if (maintenanceBudget > 0 && maintenanceBudget > buildingBudget && rawFreeCash < maintenanceBudget + 5) {
    warnings.push("maintenance_priority_over_upgrades");
  }
  const salaryAndMaintenanceLoad = salaryReserve + maintenanceBudget;
  if (salaryAndMaintenanceLoad > 0 && (cash < salaryAndMaintenanceLoad || salaryAndMaintenanceLoad > cash * 0.7)) {
    warnings.push("salary_and_maintenance_pressure");
  }
  const bucketsBefore = {
    cashReserve,
    salaryReserve,
    transferBudget,
    buildingBudget,
    maintenanceBudget,
    emergencyBudget,
  };
  const spendPlan = {
    maintenance: maintenanceBudget,
    buildings: Math.min(buildingBudget, Math.max(0, cash - cashReserve - salaryReserve - emergencyBudget - maintenanceBudget)),
    transfers: Math.min(transferBudget, Math.max(0, cash - cashReserve - salaryReserve - emergencyBudget - maintenanceBudget - buildingBudget)),
  };
  const bucketsAfterPlan = {
    cashReserve,
    salaryReserve,
    maintenanceBudget: round(Math.max(0, maintenanceBudget - spendPlan.maintenance), 2),
    buildingBudget: round(Math.max(0, buildingBudget - spendPlan.buildings), 2),
    transferBudget: round(Math.max(0, transferBudget - spendPlan.transfers), 2),
    emergencyBudget,
  };
  return {
    teamId: context.team.teamId,
    cash,
    calculatedMarketValueSum: context.calculatedMarketValueSum,
    expectedSalarySum: context.expectedSalarySum,
    salarySumRaw: context.salarySumRaw,
    salarySumBudget: context.salarySumBudget,
    salarySum: context.salarySumBudget,
    salaryUnitScale: context.salarySumRaw >= RAW_SALARY_TO_BUDGET_UNIT ? RAW_SALARY_TO_BUDGET_UNIT : 1,
    freeCashAfterReserves: round(rawFreeCash, 2),
    bucketsBefore,
    bucketsAfterPlan,
    spendPlan,
    warnings,
  };
}

function getFacilityExpectedEffect(facilityId: FacilityId, nextLevel: number) {
  return getFacilityLevelDefinition(facilityId, nextLevel)?.effectDescription ?? "kein Zusatzeffekt";
}

function buildBuildingPlan(gameState: GameState, context: TeamContext, budgetPlan: AiTeamBudgetPlanPreview, profile: AiTeamManagementProfile) {
  const teamFacilities = getTeamFacilityState(gameState, context.team.teamId);
  const cashStart = context.team.cash ?? 0;
  const ambition = identitySignal(context.identity.ambition);
  const finances = identitySignal(context.identity.finances);
  const objectiveBias = context.objectiveAiBias;
  // Organische Identitäts-Signale (kein harter Team-/Quoten-Gate):
  // - developmentTendency: 0–1, Entwickler-/Mentor-Prägung (Teacher/Leader/Talent-Builder etc.). Zieht
  //   Trainings-/Development-Infrastruktur nach vorne, damit ein nährendes Team (z. B. "T-T") früh statt
  //   erst in S4 in ein Trainingszentrum investiert.
  // - commercialAppetite: 0–1, wie stark ein Team von Fan-/Kommerz-Einnahmen profitiert (Finanzen,
  //   Beliebtheit → Arena skaliert mit Beliebtheit, Cash-Fokus).
  // - surplusSignal: 0–1, wie viel freies Cash über den Reserven idle liegt → produktiver Sink für
  //   Income-Gebäude statt Horten.
  const strategyProfile = getTeamStrategyProfile(gameState, context.team.teamId);
  const developmentTendency = getTeamDevelopmentTendency({
    team: context.team,
    identity: context.identity,
    profile: strategyProfile,
    gmArchetype: context.gmArchetype,
  });
  const popularity = identitySignal(context.identity.popularity ?? 50);
  const cashPriorityBias = strategyProfile?.bias.cashPriority ?? 5;
  const commercialAppetite = clamp(
    ((finances - 50) / 50) * 0.5 +
      ((popularity - 50) / 50) * 0.35 +
      ((cashPriorityBias - 5) / 5) * 0.15,
    0,
    1,
  );
  const surplusSignal = clamp((budgetPlan.freeCashAfterReserves ?? 0) / 40, 0, 1);
  let spendCursor = 0;
  return FACILITY_CATALOG.map((facility) => {
    const currentLevel = teamFacilities.facilities[facility.facilityId]?.level ?? 0;
    const nextLevel = Math.min(facility.maxLevel, currentLevel + 1);
    const downgradeLevel = Math.max(0, currentLevel - 1);
    const currentDefinition = getFacilityLevelDefinition(facility.facilityId, currentLevel);
    const nextDefinition = getFacilityLevelDefinition(facility.facilityId, nextLevel);
    const maintenanceCost = currentDefinition?.seasonUpkeep ?? 0;
    const currentIncome = currentDefinition?.seasonIncome ?? 0;
    const upgradeCost = nextDefinition?.upgradeCost ?? 0;
    const positive: string[] = [];
    const negative: string[] = [];
    let score = 0;

    if (facility.facilityId === "training_center") {
      score += context.youthCount * 10 + (profile.strategicIntent === "youth_development" ? 18 : 0) + (objectiveBias?.developmentPriority ?? 0) * 6;
      // Entwickler-/Mentor-Identität zieht Trainings-Infrastruktur nach vorne, auch wenn der Kader (noch)
      // nicht youth-lastig ist — sonst baut ein nährendes, star-getragenes Team (z. B. "T-T") sein
      // Trainingszentrum erst spät. Additiv, organisch über die 0–1-Tendenz skaliert (kein Team-Gate):
      // eine ausgeprägte Entwickler-Prägung (score ~0.6+) trägt zusammen mit der abgesenkten Bau-Schwelle
      // schon ohne Youth-Überhang über die Bauschwelle, mit Prospects entsprechend früher.
      score += round(developmentTendency.score * 48, 2);
      if (context.injuryCount > 0) score -= 8;
      positive.push("junge/entwickelbare Spieler profitieren");
      if (developmentTendency.score >= 0.3) positive.push("Entwickler-/Mentor-Identität priorisiert Trainings-Infrastruktur");
      if (context.injuryCount > 0) negative.push("Verletzungen machen XP-Push riskanter");
    } else if (facility.facilityId === "recovery_center") {
      score += context.injuryCount * 18 + context.fatigueCriticalCount * 14 + context.fatigueHighCount * 6;
      score += countTeamHardTrainingDemandPressure(gameState, context.team.teamId) * 8;
      if (context.injuryCount >= 3) score += 22;
      if (context.prevSeasonInjuryCount >= 8) score += 20;
      if (context.prevSeasonAvgMatchdayFatigue >= 55) score += 18;
      if (context.fatigueAvg >= 60) score += 12;
      if (context.chronicInjuryPlayerCount >= 2) score += 10;
      if (context.rosterCount >= context.identity.playerOpt + 2) score -= 6;
      positive.push("Fatigue/Injury-Druck ist hoch");
      if (context.rosterCount >= context.identity.playerOpt + 2) negative.push("große Rotation mildert den Druck");
    } else if (facility.facilityId === "scouting_office" || facility.facilityId === "analytics_room") {
      score += Math.max(0, context.identity.playerOpt - context.rosterCount) * 10 + context.contractExitCount * 6 + (objectiveBias?.rosterUrgency ?? 0) * 7;
      if (context.team.cash < 15) score -= 10;
      positive.push("Kaderlücken und Vertragswellen erhöhen den Informationswert");
      if (context.team.cash < 15) negative.push("Cash ist für Scouts/Forecasts knapp");
    } else if (facility.facilityId === "fan_shop" || facility.facilityId === "arena_upgrade") {
      score += finances * 0.25 + (context.team.cash < 20 ? 8 : 0);
      // Decaying level bonus: reliably clears the build threshold for the first level (0->1) and
      // the first upgrade (1->2), then falls off so teams don't keep pouring cash into L4/L5 with
      // shrinking payback. fan_shop stays slightly preferred over arena_upgrade (cheaper, faster
      // payback), mirroring the level-0 differential the old flat bonus used (24 vs 16).
      const incomeFacilityBonusBase = facility.facilityId === "fan_shop" ? 55 : 47;
      const incomeFacilityLevelBonus = Math.max(0, incomeFacilityBonusBase - currentLevel * 15);
      score += incomeFacilityLevelBonus;
      // Facility architect weighs income buildings on NET cashflow: keep building/upgrading as long as
      // the next level's season income beats its upkeep (avoids the upkeep trap while still expanding).
      if (context.gmArchetype === "facility_architect") {
        const nextIncome = nextDefinition?.seasonIncome ?? 0;
        const nextUpkeep = nextDefinition?.seasonUpkeep ?? 0;
        const netCashflow = nextIncome - nextUpkeep;
        if (netCashflow > 0) {
          score += 18 + Math.min(20, netCashflow * 1.5);
          positive.push("Facility Architect: Netto-Cashflow des Income-Gebäudes ist positiv");
        }
      }
      // Kommerz-/Fan-Kultur + Cash-Überschuss: ein kommerziell veranlagtes, cash-reiches Team lenkt
      // idle Cash in Income-Infrastruktur (produktiver Sink statt Horten) — aber nur, solange der nächste
      // Level netto-positiv ist (Einnahmen > Unterhalt), damit der Unterhalt tragbar bleibt. Organisch
      // über commercialAppetite (Finanzen/Beliebtheit/Cash-Fokus) und surplusSignal skaliert.
      {
        const nextIncome = nextDefinition?.seasonIncome ?? 0;
        const nextUpkeep = nextDefinition?.seasonUpkeep ?? 0;
        if (nextIncome - nextUpkeep > 0) {
          const incomeInvestBoost = round(clamp(commercialAppetite * 14 + surplusSignal * 16, 0, 26), 2);
          if (incomeInvestBoost > 0) {
            score += incomeInvestBoost;
            if (commercialAppetite >= 0.4) positive.push("Kommerz-/Fan-Identität profitiert von Income-Gebäuden");
            if (surplusSignal >= 0.4) positive.push("Cash-Überschuss wird in tragbare Income-Infrastruktur gelenkt");
          }
        }
      }
      if (currentLevel === 0) {
        positive.push("Income-Gebäude fehlt komplett");
      }
      if (profile.strategicIntent === "roster_repair") score -= 10;
      positive.push("langfristiger Cashflow hilft Reserven");
      if (profile.strategicIntent === "roster_repair") negative.push("akute Kaderbaustellen sind wichtiger");
    } else if (facility.facilityId === "academy" || facility.facilityId === "specialist_wing") {
      score += context.youthCount * 7 + ambition * 0.12 + (objectiveBias?.developmentPriority ?? 0) * 8;
      // Entwickler-/Mentor-Identität wertet die Development-Gebäude (Academy/Spezialisten) mit auf.
      score += round(developmentTendency.score * 18, 2);
      if (context.team.cash < 18) score -= 8;
      positive.push("Development-/Upgrade-Plan profitiert");
      if (context.team.cash < 18) negative.push("wenig freies Cash für Spezial-Investments");
    }

    // Facility architect: general build bonus across all facilities — the archetype leads on
    // infrastructure structurally rather than through the diluted blended facility bias.
    if (context.gmArchetype === "facility_architect") {
      score += 12;
    }
    score = round(clamp(score, 0, 100), 2);
    const canSpend = spendCursor + upgradeCost <= budgetPlan.bucketsBefore.buildingBudget;
    const hasCashPressure =
      budgetPlan.freeCashAfterReserves <= 0 ||
      budgetPlan.warnings.includes("salary_and_maintenance_pressure") ||
      budgetPlan.cash < budgetPlan.bucketsBefore.maintenanceBudget + budgetPlan.bucketsBefore.cashReserve;
    const lowStrategicValue =
      score < 42 ||
      ((profile.strategicIntent === "cash_recovery" || profile.strategicIntent === "salary_control") && score < 58);
    const isNetPositiveIncomeFacility = currentIncome > maintenanceCost;
    const shouldDowngrade =
      currentLevel > 0 &&
      hasCashPressure &&
      lowStrategicValue &&
      !isNetPositiveIncomeFacility;
    const baseBuildScoreThreshold =
      facility.facilityId === "recovery_center" &&
      (context.fatigueAvg >= 60 ||
        context.fatigueHighCount >= 2 ||
        context.injuryCount >= 3 ||
        context.prevSeasonAvgMatchdayFatigue >= 55 ||
        context.prevSeasonInjuryCount >= 8)
        ? 28
        : 45;
    // Facility architect builds more readily: a lower build threshold across facilities.
    let buildScoreThreshold =
      context.gmArchetype === "facility_architect"
        ? Math.min(baseBuildScoreThreshold, 30)
        : baseBuildScoreThreshold;
    // Entwickler-/Mentor-Identität senkt die Bau-Schwelle fürs Trainingszentrum (bis ~−20 bei maximaler
    // Tendenz), damit ein nährendes Team früh investiert statt erst nach Jahren genug Youth anzuhäufen.
    if (facility.facilityId === "training_center" && developmentTendency.score > 0) {
      buildScoreThreshold = Math.min(buildScoreThreshold, round(45 - developmentTendency.score * 24, 2));
    }
    const wantsBuildOrUpgrade =
      score >= buildScoreThreshold && currentLevel < facility.maxLevel && canSpend;
    const action: AiManagementBuildingAction = shouldDowngrade
      ? "downgrade_or_ignore_if_no_cash"
      : wantsBuildOrUpgrade
        ? currentLevel === 0
          ? "build_new"
          : "upgrade_existing"
        : maintenanceCost > 0 &&
            currentLevel > 0 &&
            budgetPlan.bucketsBefore.maintenanceBudget >= maintenanceCost
          ? "maintain"
          : "skip";
    if (action === "upgrade_existing" || action === "build_new") {
      spendCursor += upgradeCost;
    }
    const warnings = [
      !canSpend && (action === "upgrade_existing" || action === "build_new") ? "building_budget_exceeded" : null,
      budgetPlan.warnings.includes("maintenance_priority_over_upgrades") && (action === "upgrade_existing" || action === "build_new")
        ? "maintenance_first"
        : null,
      action === "downgrade_or_ignore_if_no_cash" ? "downgrade_to_cut_upkeep" : null,
    ].filter((entry): entry is string => Boolean(entry));
    const refund = action === "downgrade_or_ignore_if_no_cash" && currentDefinition ? round(currentDefinition.upgradeCost * 0.25, 2) : 0;
    const cost = action === "upgrade_existing" || action === "build_new" ? upgradeCost : action === "downgrade_or_ignore_if_no_cash" ? -refund : 0;
    const cashBefore = round(cashStart - (action === "upgrade_existing" || action === "build_new" ? spendCursor - cost : spendCursor), 2);
    const cashAfter = round(cashBefore - cost, 2);
    if (action === "downgrade_or_ignore_if_no_cash") {
      positive.push("Unterhalt senken und Cash durch 25% Erstattung stabilisieren");
      negative.push("Gebaeude-Effekt faellt ein Level niedriger aus");
    }
    return {
      teamId: context.team.teamId,
      teamCode: context.team.shortCode,
      buildingType: facility.facilityId,
      buildingLabel: facility.label,
      currentLevel,
      action,
      cost: round(cost, 2),
      maintenanceCost: round(maintenanceCost, 2),
      expectedEffect: getFacilityExpectedEffect(
        facility.facilityId,
        action === "upgrade_existing" || action === "build_new" ? nextLevel : action === "downgrade_or_ignore_if_no_cash" ? downgradeLevel : currentLevel,
      ),
      score,
      reasonsPositive: positive,
      reasonsNegative: negative,
      warnings,
      cashBefore,
      cashAfter,
    } satisfies AiTeamBuildingPlanRow;
  });
}

function isTeamHealthStressed(context: TeamContext, profile: AiTeamManagementProfile) {
  return (
    isPrevSeasonHealthStressed(context) ||
    context.injuryCount >= 1 ||
    context.fatigueCriticalCount >= 1 ||
    context.fatigueHighCount >= 3 ||
    context.fatigueAvg >= 68 ||
    context.injuryRiskHighCount >= 2 ||
    context.injuryRiskCriticalCount >= 1 ||
    context.projectedHardTrainingRiskCount >= 3 ||
    profile.injuryPressure >= 45 ||
    profile.fatiguePressure >= 62
  );
}

function buildTrainingPlan(gameState: GameState, context: TeamContext, profile: AiTeamManagementProfile) {
  const ambition = identitySignal(context.identity.ambition);
  const harmony = identitySignal(context.identity.harmony);
  const cooperation = identitySignal(context.identity.cooperation);
  const objectiveBias = context.objectiveAiBias;
  const axisPriority: Array<{ key: AiManagementTrainingFocus; score: number }> = [
    {
      key: "POW",
      score: identitySignal(context.identity.pow) + context.upcomingCategoryCounts.power * 6 + (objectiveBias?.axisPriorities?.pow ?? 0) * 18,
    },
    {
      key: "SPE",
      score: identitySignal(context.identity.spe) + context.upcomingCategoryCounts.speed * 6 + (objectiveBias?.axisPriorities?.spe ?? 0) * 18,
    },
    {
      key: "MEN",
      score: identitySignal(context.identity.men) + context.upcomingCategoryCounts.mental * 6 + (objectiveBias?.axisPriorities?.men ?? 0) * 18,
    },
    {
      key: "SOC",
      score: identitySignal(context.identity.soc) + context.upcomingCategoryCounts.social * 6 + (objectiveBias?.axisPriorities?.soc ?? 0) * 18,
    },
  ];
  axisPriority.sort((left, right) => right.score - left.score);
  const topAxis = axisPriority[0]?.key ?? "BALANCED";
  const healthStress = isTeamHealthStressed(context, profile);
  const prevSeasonStress = isPrevSeasonHealthStressed(context);
  const selectedTrainingFocus: AiManagementTrainingFocus = healthStress
    ? "RECOVERY"
    : axisPriority.length >= 2 && Math.abs((axisPriority[0]?.score ?? 0) - (axisPriority[1]?.score ?? 0)) <= 6
      ? "BALANCED"
      : topAxis;
  const identityTrainingDrive = clamp(
    ambition * 0.45 +
      harmony * 0.18 +
      cooperation * 0.16 +
      (profile.strategicIntent === "youth_development" ? 18 : 0) +
      (profile.strategicIntent === "win_now" ? 12 : 0) -
      profile.injuryPressure * 0.65 -
      profile.fatiguePressure * 0.28 -
      Math.max(0, context.identity.playerMin + 1 - context.rosterCount) * 10 +
      (objectiveBias?.developmentPriority ?? 0) * 8 -
      (objectiveBias?.moralePriority ?? 0) * 3,
    0,
    100,
  );
  const selectedTrainingIntensity: AiManagementTrainingIntensity = healthStress
    ? "light"
    : prevSeasonStress
      ? "normal"
      : identityTrainingDrive >= 54 &&
          context.fatigueHighCount === 0 &&
          context.injuryRiskHighCount === 0 &&
          context.projectedHardTrainingRiskCount === 0
        ? "hard"
        : context.rosterCount <= context.identity.playerMin && identityTrainingDrive < 45
          ? "light"
          : "normal";
  const mode = normalizeMode(selectedTrainingIntensity);
  const baseXp = PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode[mode];
  const facilities = getTeamFacilityState(gameState, context.team.teamId);
  const facilityXp = applyTrainingXpFacilityModifiers(baseXp, facilities);
  const recoveryBase = applyRecoveryFacilityModifiers(100, facilities);
  const recoveryAdjusted = applyTrainingRecoveryImpact(recoveryBase.after, mode);
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (selectedTrainingFocus === "RECOVERY") reasons.push("Verletzungen/Fatigue/Injury-Risiko priorisieren Erholung");
  else if (prevSeasonStress) reasons.push("Vorsaison-Belastung → kein Hard-Training");
  else if (selectedTrainingFocus === "BALANCED") reasons.push("keine klare Einzelachse, gemischte Needs");
  else reasons.push(`Team-Identity und kommende Disziplinen ziehen Richtung ${selectedTrainingFocus}`);
  const selectedAxisKey =
    selectedTrainingFocus === "POW"
      ? "pow"
      : selectedTrainingFocus === "SPE"
        ? "spe"
        : selectedTrainingFocus === "MEN"
          ? "men"
          : selectedTrainingFocus === "SOC"
            ? "soc"
            : null;
  if (selectedAxisKey && (objectiveBias?.axisPriorities?.[selectedAxisKey] ?? 0) >= 0.5) {
    reasons.push("Board-Achsenziel erhoeht Trainingsprioritaet");
  }
  if (selectedTrainingIntensity === "hard") reasons.push("großer oder stabiler Kader erlaubt härteres Training");
  if (selectedTrainingIntensity === "light") reasons.push("kleiner Kader, Verletzungen oder hohes Injury-Risiko brauchen Schonung");
  if (identityTrainingDrive >= 54) reasons.push("Team-Identity spricht fuer aktiveres Training");
  if (selectedTrainingIntensity === "hard") warnings.push("Recovery sinkt, Rotation wichtiger");
  if (selectedTrainingIntensity === "light") warnings.push("weniger XP als Normal/Hart");
  if (context.injuryRiskHighCount >= 2) warnings.push("mehrere Spieler mit erhoehtem Verletzungsrisiko");
  const avgInjuryRisk = round(average(context.players.map((player) => getInjuryRiskPercent(player.fatigue ?? 0))), 2);
  const projectedAvgInjuryRisk = round(
    average(
      context.players.map((player) =>
        getInjuryRiskPercent((player.fatigue ?? 0) + FATIGUE_LOAD_BY_MODE[mode]),
      ),
    ),
    2,
  );
  return {
    teamId: context.team.teamId,
    teamCode: context.team.shortCode,
    selectedTrainingFocus,
    selectedTrainingIntensity,
    expectedXpEffect: round(facilityXp.after),
    expectedRecoveryEffect: round(recoveryAdjusted.after),
    expectedInjuryRiskEffect: round(projectedAvgInjuryRisk - avgInjuryRisk, 2),
    reasons,
    warnings,
    playerTrainingPlans: buildTeamPlayerTrainingLoadPlans({
      gameState,
      teamId: context.team.teamId,
      teamBaselineIntensity: selectedTrainingIntensity,
      prevSeasonStress,
    }),
    playerTrainingClassPlans: buildTeamPlayerTrainingClassPlans({
      gameState,
      teamId: context.team.teamId,
      trainingFocus: selectedTrainingFocus,
    }),
  } satisfies AiTeamTrainingPlanPreview;
}

export function buildAiTeamManagementPreview(gameState: GameState, teamId: string): AiTeamManagementPreview | null {
  const context = buildTeamContext(gameState, teamId);
  if (!context) return null;
  const profile = buildProfile(gameState, context);
  const budgetPlan = buildBudgetPlan(gameState, context);
  const buildingPlan = buildBuildingPlan(gameState, context, budgetPlan, profile);
  const trainingPlan = buildTrainingPlan(gameState, context, profile);
  return {
    teamId: context.team.teamId,
    teamCode: context.team.shortCode,
    teamName: context.team.name,
    profile,
    budgetPlan,
    buildingPlan,
    trainingPlan,
    warnings: Array.from(new Set([...profile.warnings, ...budgetPlan.warnings, ...trainingPlan.warnings, ...buildingPlan.flatMap((row) => row.warnings)])),
  };
}

export function buildAiLeagueManagementPreview(gameState: GameState): AiLeagueManagementPreview {
  const calculatedEconomyByPlayerId = buildCalculatedEconomyByPlayer(gameState);
  return {
    generatedAt: new Date().toISOString(),
    teams: gameState.teams
      .map((team) => {
        const context = buildTeamContext(gameState, team.teamId, calculatedEconomyByPlayerId);
        if (!context) return null;
        const profile = buildProfile(gameState, context);
        const budgetPlan = buildBudgetPlan(gameState, context);
        const buildingPlan = buildBuildingPlan(gameState, context, budgetPlan, profile);
        const trainingPlan = buildTrainingPlan(gameState, context, profile);
        return {
          teamId: context.team.teamId,
          teamCode: context.team.shortCode,
          teamName: context.team.name,
          profile,
          budgetPlan,
          buildingPlan,
          trainingPlan,
          warnings: Array.from(new Set([...profile.warnings, ...budgetPlan.warnings, ...trainingPlan.warnings, ...buildingPlan.flatMap((row) => row.warnings)])),
        } satisfies AiTeamManagementPreview;
      })
      .filter((entry): entry is AiTeamManagementPreview => Boolean(entry)),
  };
}

export function buildAiBuildingPlanPreview(gameState: GameState, teamId: string) {
  return buildAiTeamManagementPreview(gameState, teamId)?.buildingPlan ?? [];
}

export function buildAiTrainingPlanPreview(gameState: GameState, teamId: string) {
  return buildAiTeamManagementPreview(gameState, teamId)?.trainingPlan ?? null;
}

export function buildAiBudgetPlanPreview(gameState: GameState, teamId: string) {
  return buildAiTeamManagementPreview(gameState, teamId)?.budgetPlan ?? null;
}
