import type {
  AiManagerBudgetReservationRecord,
  AiManagerContractStrategy,
  AiManagerContractStrategyRecord,
  GameState,
} from "@/lib/data/olyDataTypes";
import {
  buildAiLeagueManagementPreview,
  type AiLeagueManagementPreview,
  type AiManagementBudgetBuckets,
  type AiManagementTrainingFocus,
  type AiManagementTrainingIntensity,
} from "@/lib/ai/ai-team-management-preview-service";
import {
  isTeamRosterBelowOpt,
  projectExpectedSalaryAtPlannerTarget,
  resolveCombinedLiquidityReserve,
  resolveTeamCashRunwayReserve,
} from "@/lib/ai/ai-team-cash-reserve-service";
import {
  PLANNER_LIQUIDITY_BUFFER_MIN,
  resolveTeamSpendableCashForPlanning,
  usesSingleCashPlanningPolicy,
} from "@/lib/ai/planner-cash-buffer-policy";
import { getTeamObjectiveAiBias } from "@/lib/board/team-season-objectives-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { previewFacilityMaintenance, applyFacilityMaintenance } from "@/lib/facilities/facility-maintenance-service";
import { previewFacilityUpgrade, applyFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { isLongRunFastProfile } from "@/lib/season/long-run-profile";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";
import { applyTeamTrainingSettings, applyPlayerTrainingModes, previewPlayerTrainingModes, previewTeamTrainingSettings, applyPlayerTrainingClasses, previewPlayerTrainingClasses } from "@/lib/training/training-settings-service";
import { applyAiTeamPlayerDemandFulfillment } from "@/lib/ai/ai-player-demand-fulfillment-service";

export type AiManagerActionType =
  | "maintain_building"
  | "upgrade_building"
  | "buy_building"
  | "downgrade_building"
  | "set_training_focus"
  | "set_training_intensity"
  | "set_player_training_modes"
  | "set_player_training_classes"
  | "reserve_transfer_budget"
  | "reserve_salary_budget"
  | "reserve_maintenance_budget"
  | "mark_contract_strategy"
  | "mark_sell_strategy";

export type AiManagerActionRisk = "low" | "medium" | "high" | "blocked";

export type AiManagerAction = {
  actionId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  actionType: AiManagerActionType;
  cost: number;
  cashBefore: number;
  cashAfter: number;
  expectedEffect: string;
  reason: string;
  risk: AiManagerActionRisk;
  sourcePlanId: string;
  canApply: boolean;
  blockers: string[];
  warnings: string[];
  facilityId?: FacilityId;
  trainingFocus?: AiManagementTrainingFocus;
  trainingIntensity?: AiManagementTrainingIntensity;
  playerId?: string;
  contractStrategy?: AiManagerContractStrategy;
  applied?: boolean;
};

export type AiManagerBudgetApplicationRow = {
  teamId: string;
  teamCode: string;
  cash: number;
  cashReserve: number;
  salaryReserve: number;
  transferBudget: number;
  buildingBudget: number;
  maintenanceBudget: number;
  emergencyBudget: number;
  marketSpendableCash: number;
  buildingSpendableCash: number;
  warnings: string[];
};

export type AiManagerApplyPreview = {
  ok: boolean;
  dryRun: boolean;
  applied: boolean;
  saveId: string;
  seasonId: string;
  generatedAt: string;
  sourcePlanId: string;
  teams: number;
  actions: AiManagerAction[];
  budgetRows: AiManagerBudgetApplicationRow[];
  blockers: string[];
  warnings: string[];
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function riskFromWarnings(blockers: string[], warnings: string[]): AiManagerActionRisk {
  if (blockers.length > 0) return "blocked";
  if (warnings.some((warning) => warning.includes("high") || warning.includes("risk") || warning.includes("low"))) return "medium";
  return "low";
}

function buildPlanId(save: PersistedSaveGame) {
  return `manager-apply-${save.saveId}-${save.gameState.season.id}`;
}

function getTeamCash(gameState: GameState, teamId: string) {
  return gameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
}

function marketSpendableCash(cash: number, buckets: AiManagementBudgetBuckets) {
  return round(
    Math.max(
      0,
      Math.min(
        buckets.transferBudget,
        cash -
          buckets.cashReserve -
          buckets.salaryReserve -
          buckets.buildingBudget -
          buckets.maintenanceBudget -
          buckets.emergencyBudget,
      ),
    ),
  );
}

function buildingSpendableCash(cash: number, buckets: AiManagementBudgetBuckets) {
  return round(
    Math.max(0, Math.min(buckets.buildingBudget + buckets.maintenanceBudget, cash - buckets.cashReserve - buckets.salaryReserve - buckets.transferBudget - buckets.emergencyBudget)),
  );
}

function actionId(parts: Array<string | number | null | undefined>) {
  return parts.filter((part) => part != null && part !== "").join(":");
}

function buildBudgetRows(preview: AiLeagueManagementPreview): AiManagerBudgetApplicationRow[] {
  return preview.teams.map((team) => {
    const buckets = team.budgetPlan.bucketsBefore;
    return {
      teamId: team.teamId,
      teamCode: team.teamCode,
      cash: team.budgetPlan.cash,
      ...buckets,
      marketSpendableCash: marketSpendableCash(team.budgetPlan.cash, buckets),
      buildingSpendableCash: buildingSpendableCash(team.budgetPlan.cash, buckets),
      warnings: team.budgetPlan.warnings,
    };
  });
}

function buildBudgetActions(input: {
  teamId: string;
  teamCode: string;
  teamName: string;
  cash: number;
  buckets: AiManagementBudgetBuckets;
  sourcePlanId: string;
}): AiManagerAction[] {
  return [
    {
      actionType: "reserve_transfer_budget" as const,
      amount: input.buckets.transferBudget,
      expectedEffect: "AI Market darf nur aus TransferBudget kaufen",
    },
    {
      actionType: "reserve_salary_budget" as const,
      amount: input.buckets.salaryReserve,
      expectedEffect: "Salary-Puffer bleibt fuer Verträge und Kaderdruck reserviert",
    },
    {
      actionType: "reserve_maintenance_budget" as const,
      amount: input.buckets.maintenanceBudget,
      expectedEffect: "Maintenance wird vor Luxus-Upgrades bezahlt",
    },
  ].map((entry) => ({
    actionId: actionId([input.sourcePlanId, input.teamId, entry.actionType]),
    teamId: input.teamId,
    teamCode: input.teamCode,
    teamName: input.teamName,
    actionType: entry.actionType,
    cost: 0,
    cashBefore: input.cash,
    cashAfter: input.cash,
    expectedEffect: entry.expectedEffect,
    reason: `Budget Bucket ${round(entry.amount)} reserviert`,
    risk: "low",
    sourcePlanId: input.sourcePlanId,
    canApply: true,
    blockers: [],
    warnings: [],
  }));
}

function buildBuildingActions(save: PersistedSaveGame, preview: AiLeagueManagementPreview, sourcePlanId: string) {
  const actions: AiManagerAction[] = [];
  const maintenanceCache = new Map<string, ReturnType<typeof previewFacilityMaintenance>>();
  const upgradeCache = new Map<string, ReturnType<typeof previewFacilityUpgrade>>();
  const getMaintenance = (teamId: string, facilityId: FacilityId) => {
    const key = `${teamId}:${facilityId}:maintain`;
    if (!maintenanceCache.has(key)) maintenanceCache.set(key, previewFacilityMaintenance(save, teamId, facilityId));
    return maintenanceCache.get(key)!;
  };
  const getUpgrade = (teamId: string, facilityId: FacilityId, variant?: string | null, action?: "upgrade" | "downgrade") => {
    const key = `${teamId}:${facilityId}:${action ?? "upgrade"}:${variant ?? ""}`;
    if (!upgradeCache.has(key)) {
      upgradeCache.set(
        key,
        previewFacilityUpgrade(save, teamId, facilityId, facilityId === "specialist_wing" ? "mind_lab" : variant, action),
      );
    }
    return upgradeCache.get(key)!;
  };
  for (const teamPlan of preview.teams) {
    const buckets = teamPlan.budgetPlan.bucketsBefore;
    let remainingMaintenanceBudget = buckets.maintenanceBudget;
    let remainingBuildingBudget = buckets.buildingBudget;
    const maintenancePlans = teamPlan.buildingPlan.filter((row) => {
      if (row.action === "downgrade_or_ignore_if_no_cash") return false;
      const maintenance = getMaintenance(row.teamId, row.buildingType);
      return maintenance.ok || (!maintenance.blockingReasons.includes("facility_not_built") && !maintenance.blockingReasons.includes("facility_condition_already_full"));
    });
    const downgradePlans = teamPlan.buildingPlan.filter((row) => row.action === "downgrade_or_ignore_if_no_cash" && row.currentLevel > 0);
    const upgradePlans = teamPlan.buildingPlan.filter((row) => row.action === "upgrade_existing" || row.action === "build_new");

    for (const row of maintenancePlans) {
      const maintenance = getMaintenance(row.teamId, row.buildingType);
      if (!maintenance.ok && maintenance.blockingReasons.includes("facility_condition_already_full")) continue;
      const cost = maintenance.maintenanceCost;
      const budgetBlockers = cost > remainingMaintenanceBudget ? ["maintenance_budget_exceeded"] : [];
      const blockers = [...maintenance.blockingReasons, ...budgetBlockers];
      const canApply = blockers.length === 0;
      if (canApply) remainingMaintenanceBudget = round(remainingMaintenanceBudget - cost);
      actions.push({
        actionId: actionId([sourcePlanId, row.teamId, "maintain", row.buildingType]),
        teamId: row.teamId,
        teamCode: row.teamCode,
        teamName: teamPlan.teamName,
        actionType: "maintain_building",
        cost,
        cashBefore: maintenance.cashBefore ?? row.cashBefore,
        cashAfter: maintenance.cashAfter ?? row.cashAfter,
        expectedEffect: `Condition ${maintenance.conditionPct} -> ${maintenance.nextConditionPct}, Effizienz ${maintenance.efficiencyPct} -> ${maintenance.nextEfficiencyPct}`,
        reason: row.reasonsPositive.join(" | ") || "Gebäudezustand sichern",
        risk: riskFromWarnings(blockers, maintenance.warnings),
        sourcePlanId,
        canApply,
        blockers,
        warnings: [...maintenance.warnings, ...row.warnings],
        facilityId: row.buildingType,
      });
    }

    for (const row of downgradePlans) {
      const downgrade = getUpgrade(row.teamId, row.buildingType, null, "downgrade");
      const refund = downgrade.refundAmount ?? Math.max(0, -row.cost);
      const blockers = downgrade.blockingReasons;
      const canApply = blockers.length === 0;
      actions.push({
        actionId: actionId([sourcePlanId, row.teamId, "downgrade", row.buildingType]),
        teamId: row.teamId,
        teamCode: row.teamCode,
        teamName: teamPlan.teamName,
        actionType: "downgrade_building",
        cost: round(-refund, 2),
        cashBefore: downgrade.cashBefore ?? row.cashBefore,
        cashAfter: downgrade.cashAfter ?? row.cashAfter,
        expectedEffect: `${downgrade.currentEffect} -> ${downgrade.nextEffect ?? row.expectedEffect}; Zustand wird auf 100% gesetzt`,
        reason: row.reasonsPositive.join(" | ") || "Unterhalt senken und Cash stabilisieren",
        risk: riskFromWarnings(blockers, [...downgrade.warnings, ...row.warnings]),
        sourcePlanId,
        canApply,
        blockers,
        warnings: [...downgrade.warnings, ...row.warnings],
        facilityId: row.buildingType,
      });
    }

    for (const row of [...upgradePlans].sort((left, right) => {
      const leftRecovery = left.buildingType === "recovery_center" && left.currentLevel === 0 ? 1 : 0;
      const rightRecovery = right.buildingType === "recovery_center" && right.currentLevel === 0 ? 1 : 0;
      if (leftRecovery !== rightRecovery) return rightRecovery - leftRecovery;
      return (right.score ?? 0) - (left.score ?? 0);
    })) {
      const upgrade = getUpgrade(row.teamId, row.buildingType, row.buildingType === "specialist_wing" ? "mind_lab" : undefined);
      const cost = upgrade.upgradeCost ?? row.cost;
      const budgetBlockers = [
        cost > remainingBuildingBudget ? "building_budget_exceeded" : null,
        teamPlan.budgetPlan.cash < 0 ? "negative_cash_blocks_luxury" : null,
        teamPlan.budgetPlan.warnings.includes("salary_and_maintenance_pressure") ? "salary_pressure_blocks_luxury" : null,
      ].filter((entry): entry is string => Boolean(entry));
      const blockers = [...upgrade.blockingReasons, ...budgetBlockers];
      const canApply = blockers.length === 0;
      if (canApply) remainingBuildingBudget = round(remainingBuildingBudget - cost);
      actions.push({
        actionId: actionId([sourcePlanId, row.teamId, row.action, row.buildingType]),
        teamId: row.teamId,
        teamCode: row.teamCode,
        teamName: teamPlan.teamName,
        actionType: row.action === "build_new" ? "buy_building" : "upgrade_building",
        cost,
        cashBefore: upgrade.cashBefore ?? row.cashBefore,
        cashAfter: upgrade.cashAfter ?? row.cashAfter,
        expectedEffect: upgrade.nextEffect ?? row.expectedEffect,
        reason: row.reasonsPositive.join(" | ") || "Manager Facility Plan",
        risk: riskFromWarnings(blockers, [...upgrade.warnings, ...row.warnings]),
        sourcePlanId,
        canApply,
        blockers,
        warnings: [...upgrade.warnings, ...row.warnings],
        facilityId: row.buildingType,
      });
    }
  }
  return actions;
}

function buildTrainingActions(save: PersistedSaveGame, preview: AiLeagueManagementPreview, sourcePlanId: string) {
  const longRunFast = isLongRunFastProfile();
  return preview.teams.flatMap((teamPlan) => {
    const training = previewTeamTrainingSettings({
      save,
      teamId: teamPlan.teamId,
      trainingFocus: teamPlan.trainingPlan.selectedTrainingFocus,
      trainingIntensity: teamPlan.trainingPlan.selectedTrainingIntensity,
    });
    const trainingWarnings = longRunFast ? [] : [...training.warnings, ...teamPlan.trainingPlan.warnings];
    const base = {
      teamId: teamPlan.teamId,
      teamCode: teamPlan.teamCode,
      teamName: teamPlan.teamName,
      cost: 0,
      cashBefore: teamPlan.budgetPlan.cash,
      cashAfter: teamPlan.budgetPlan.cash,
      sourcePlanId,
      canApply: training.ok,
      blockers: training.blockingReasons,
      warnings: trainingWarnings,
    };
    return [
      {
        ...base,
        actionId: actionId([sourcePlanId, teamPlan.teamId, "training_focus"]),
        actionType: "set_training_focus" as const,
        expectedEffect: `Fokus ${training.trainingFocus}`,
        reason: teamPlan.trainingPlan.reasons.join(" | ") || "Manager Training Plan",
        risk: riskFromWarnings(training.blockingReasons, training.warnings),
        trainingFocus: training.trainingFocus,
      },
      {
        ...base,
        actionId: actionId([sourcePlanId, teamPlan.teamId, "training_intensity"]),
        actionType: "set_training_intensity" as const,
        expectedEffect: `XP ${training.expectedXpEffect}, Recovery ${training.expectedRecoveryEffect}, InjuryRisk ${training.expectedInjuryRiskEffect}`,
        reason: teamPlan.trainingPlan.reasons.join(" | ") || "Manager Training Plan",
        risk: riskFromWarnings(training.blockingReasons, training.warnings),
        trainingIntensity: training.trainingIntensity,
      },
      {
        ...base,
        actionId: actionId([sourcePlanId, teamPlan.teamId, "player_training_modes"]),
        actionType: "set_player_training_modes" as const,
        expectedEffect: `${teamPlan.trainingPlan.playerTrainingPlans.length} individuelle Trainingsmodi`,
        reason:
          teamPlan.trainingPlan.playerTrainingPlans
            .filter((plan) => plan.selectedMode !== plan.teamBaselineMode || plan.needsLineupRest)
            .slice(0, 3)
            .map((plan) => `${plan.playerName}: ${plan.selectedMode}${plan.needsLineupRest ? " +Pause" : ""}`)
            .join(" | ") || "Per-Player Load Plan",
        risk: riskFromWarnings(
          training.blockingReasons,
          teamPlan.trainingPlan.playerTrainingPlans.some((plan) => plan.needsLineupRest)
            ? [...training.warnings, "lineup_rest_recommended"]
            : training.warnings,
        ),
      },
      {
        ...base,
        actionId: actionId([sourcePlanId, teamPlan.teamId, "player_training_classes"]),
        actionType: "set_player_training_classes" as const,
        expectedEffect: `${teamPlan.trainingPlan.playerTrainingClassPlans.length} individuelle Trainingsklassen`,
        reason:
          teamPlan.trainingPlan.playerTrainingClassPlans
            .slice(0, 3)
            .map((plan) => `${plan.playerName}: ${plan.trainingClass}`)
            .join(" | ") || "Per-Player Class Plan",
        risk: riskFromWarnings(training.blockingReasons, training.warnings),
      },
    ];
  });
}

function chooseContractStrategy(input: { role: string; salary: number; contractLength: number | null | undefined; youth: boolean }): AiManagerContractStrategy {
  if (input.role.includes("starter") || input.role.includes("core") || input.role.includes("star")) return "extend_core";
  if (input.youth) return "prospect_hold";
  if ((input.contractLength ?? 0) <= 1) return "wait_and_see";
  if (input.salary >= 14) return "market_test";
  return "salary_cap";
}

function buildContractActions(save: PersistedSaveGame, preview: AiLeagueManagementPreview, sourcePlanId: string) {
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player] as const));
  const teamPlanById = new Map(preview.teams.map((team) => [team.teamId, team] as const));
  return save.gameState.rosters.slice(0, 120).flatMap((roster) => {
    const teamPlan = teamPlanById.get(roster.teamId);
    const player = playerById.get(roster.playerId);
    if (!teamPlan || !player) return [];
    const role = String(roster.roleTag ?? "").toLowerCase();
    const strategy = chooseContractStrategy({
      role,
      salary: roster.salary ?? player.displaySalary ?? player.salaryDemand ?? 0,
      contractLength: roster.contractLength,
      youth: (player.potential ?? 0) >= 72,
    });
    const sellStrategy: AiManagerContractStrategy = strategy === "market_test" ? "sell_if_offer" : "wait_and_see";
    const cash = getTeamCash(save.gameState, roster.teamId);
    return [
      {
        actionId: actionId([sourcePlanId, roster.teamId, roster.playerId, "contract"]),
        teamId: roster.teamId,
        teamCode: teamPlan.teamCode,
        teamName: teamPlan.teamName,
        actionType: "mark_contract_strategy" as const,
        cost: 0,
        cashBefore: cash,
        cashAfter: cash,
        expectedEffect: strategy,
        reason: `${player.name}: Rolle ${roster.roleTag ?? "unbekannt"}, Vertrag ${roster.contractLength ?? "?"}`,
        risk: "low" as const,
        sourcePlanId,
        canApply: true,
        blockers: [],
        warnings: [],
        playerId: roster.playerId,
        contractStrategy: strategy,
      },
      {
        actionId: actionId([sourcePlanId, roster.teamId, roster.playerId, "sell"]),
        teamId: roster.teamId,
        teamCode: teamPlan.teamCode,
        teamName: teamPlan.teamName,
        actionType: "mark_sell_strategy" as const,
        cost: 0,
        cashBefore: cash,
        cashAfter: cash,
        expectedEffect: sellStrategy,
        reason: `${player.name}: Sell-Marker fuer Market/Renewal Preview`,
        risk: "low" as const,
        sourcePlanId,
        canApply: true,
        blockers: [],
        warnings: [],
        playerId: roster.playerId,
        contractStrategy: sellStrategy,
      },
    ];
  });
}

export function buildAiManagerApplyPreview(save: PersistedSaveGame, teamIds?: string[] | null): AiManagerApplyPreview {
  const teamIdSet = teamIds?.length ? new Set(teamIds) : null;
  const rawPlan = buildAiLeagueManagementPreview(save.gameState);
  const plan: AiLeagueManagementPreview = {
    ...rawPlan,
    teams: teamIdSet ? rawPlan.teams.filter((team) => teamIdSet.has(team.teamId)) : rawPlan.teams,
  };
  const sourcePlanId = buildPlanId(save);
  const budgetRows = buildBudgetRows(plan);
  const actions = [
    ...plan.teams.flatMap((team) =>
      buildBudgetActions({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        cash: team.budgetPlan.cash,
        buckets: team.budgetPlan.bucketsBefore,
        sourcePlanId,
      }),
    ),
    ...buildBuildingActions(save, plan, sourcePlanId),
    ...buildTrainingActions(save, plan, sourcePlanId),
    ...buildContractActions(save, plan, sourcePlanId),
  ];
  return {
    ok: actions.every((action) => action.actionType.includes("mark_") || action.actionType.includes("reserve_") || action.canApply || action.risk !== "blocked"),
    dryRun: true,
    applied: false,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    generatedAt: plan.generatedAt,
    sourcePlanId,
    teams: plan.teams.length,
    actions,
    budgetRows,
    blockers: actions.flatMap((action) => action.blockers.map((blocker) => `${action.teamCode}:${action.actionType}:${blocker}`)),
    warnings: actions.flatMap((action) => action.warnings.map((warning) => `${action.teamCode}:${action.actionType}:${warning}`)),
  };
}

function writeManagerPlanState(
  save: PersistedSaveGame,
  actions: AiManagerAction[],
  persistence: PersistenceService,
  preview: AiLeagueManagementPreview,
) {
  const now = new Date().toISOString();
  const budgetReservations: Record<string, AiManagerBudgetReservationRecord> = {
    ...(save.gameState.seasonState.aiManagerBudgetReservations ?? {}),
  };
  const contractStrategies: Record<string, AiManagerContractStrategyRecord> = {
    ...(save.gameState.seasonState.aiManagerContractStrategies ?? {}),
  };
  const sellStrategies: Record<string, AiManagerContractStrategyRecord> = {
    ...(save.gameState.seasonState.aiManagerSellStrategies ?? {}),
  };

  const grouped = new Map<string, AiManagerAction[]>();
  for (const action of actions.filter((entry) => entry.canApply)) {
    grouped.set(action.teamId, [...(grouped.get(action.teamId) ?? []), action]);
  }

  for (const [teamId, teamActions] of grouped) {
    const sourcePlanId = teamActions[0]?.sourcePlanId ?? buildPlanId(save);
    const byType = new Map(teamActions.map((action) => [action.actionType, action] as const));
    const budgetPreview = preview.teams.find((team) => team.teamId === teamId)?.budgetPlan.bucketsBefore;
    if (
      isSeasonOne(save.gameState.season.id) &&
      budgetPreview &&
      (byType.has("reserve_transfer_budget") || byType.has("reserve_salary_budget") || byType.has("reserve_maintenance_budget"))
    ) {
      budgetReservations[teamId] = {
        teamId,
        seasonId: save.gameState.season.id,
        sourcePlanId,
        ...budgetPreview,
        updatedAt: now,
      };
    }
  }

  for (const action of actions) {
    if (!action.canApply || !action.playerId || !action.contractStrategy) continue;
    const record: AiManagerContractStrategyRecord = {
      teamId: action.teamId,
      playerId: action.playerId,
      seasonId: save.gameState.season.id,
      strategy: action.contractStrategy,
      reason: action.reason,
      sourcePlanId: action.sourcePlanId,
      updatedAt: now,
    };
    if (action.actionType === "mark_contract_strategy") contractStrategies[`${action.teamId}:${action.playerId}`] = record;
    if (action.actionType === "mark_sell_strategy") sellStrategies[`${action.teamId}:${action.playerId}`] = record;
  }

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      aiManagerBudgetReservations: budgetReservations,
      aiManagerContractStrategies: contractStrategies,
      aiManagerSellStrategies: sellStrategies,
    },
  };
  return persistence.saveSingleplayerState(save.saveId, nextGameState);
}

export function applyAiManagerPlan(input: {
  save: PersistedSaveGame;
  dryRun?: boolean;
  actionTypes?: AiManagerActionType[];
  teamIds?: string[] | null;
  persistence?: PersistenceService;
  longRunFast?: boolean;
}): AiManagerApplyPreview {
  const dryRun = input.dryRun ?? true;
  const longRunFast = input.longRunFast ?? isLongRunFastProfile();
  const persistence = input.persistence ?? createPersistenceService();
  const preview = buildAiManagerApplyPreview(input.save, input.teamIds);
  const allowedTypes = input.actionTypes ? new Set(input.actionTypes) : null;
  let selectedActions = allowedTypes ? preview.actions.filter((action) => allowedTypes.has(action.actionType)) : preview.actions;
  if (longRunFast) {
    selectedActions = selectedActions.filter(
      (action) =>
        !action.warnings.some((warning) => warning === "income_source_missing" || warning.includes("income_source_missing")),
    );
  }
  if (dryRun) {
    return { ...preview, dryRun: true, actions: selectedActions };
  }

  const leaguePlanPreview = buildAiLeagueManagementPreview(input.save.gameState);
  let currentSave = writeManagerPlanState(input.save, selectedActions, persistence, leaguePlanPreview);
  const appliedIds = new Set<string>();
  const orderedFacilityActions = selectedActions.filter(
    (action) =>
      action.canApply &&
      (action.actionType === "maintain_building" ||
        action.actionType === "downgrade_building" ||
        action.actionType === "upgrade_building" ||
        action.actionType === "buy_building"),
  );
  for (const action of orderedFacilityActions) {
    if (!action.facilityId) continue;
    if (action.actionType === "maintain_building") {
      const maintenancePreview = previewFacilityMaintenance(currentSave, action.teamId, action.facilityId);
      const result = applyFacilityMaintenance(currentSave, action.teamId, action.facilityId, maintenancePreview.confirmToken, persistence);
      if (result.applied) {
        appliedIds.add(action.actionId);
        currentSave = result.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
      }
      continue;
    }
    if (action.actionType === "downgrade_building") {
      const downgradePreview = previewFacilityUpgrade(currentSave, action.teamId, action.facilityId, null, "downgrade");
      const result = applyFacilityUpgrade(
        currentSave,
        action.teamId,
        action.facilityId,
        downgradePreview.confirmToken,
        null,
        "downgrade",
        persistence,
      );
      if (result.applied) {
        appliedIds.add(action.actionId);
        currentSave = result.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
      }
      continue;
    }
    const upgradePreview = previewFacilityUpgrade(currentSave, action.teamId, action.facilityId, action.facilityId === "specialist_wing" ? "mind_lab" : undefined);
    const result = applyFacilityUpgrade(
      currentSave,
      action.teamId,
      action.facilityId,
      upgradePreview.confirmToken,
      action.facilityId === "specialist_wing" ? "mind_lab" : undefined,
      persistence,
    );
    if (result.applied) {
      appliedIds.add(action.actionId);
      currentSave = result.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
    }
  }

  const trainingByTeam = new Map<string, AiManagerAction[]>();
  for (const action of selectedActions.filter((entry) => entry.canApply && (entry.actionType === "set_training_focus" || entry.actionType === "set_training_intensity"))) {
    trainingByTeam.set(action.teamId, [...(trainingByTeam.get(action.teamId) ?? []), action]);
  }
  for (const [teamId, actions] of trainingByTeam) {
    const focus = actions.find((action) => action.trainingFocus)?.trainingFocus;
    const intensity = actions.find((action) => action.trainingIntensity)?.trainingIntensity;
    if (!focus || !intensity) continue;
    const existing = currentSave.gameState.seasonState.aiManagerTrainingSettings?.[teamId];
    if (longRunFast && existing?.trainingFocus === focus && existing?.trainingIntensity === intensity) {
      for (const action of actions) appliedIds.add(action.actionId);
      continue;
    }
    const trainingPreview = previewTeamTrainingSettings({ save: currentSave, teamId, trainingFocus: focus, trainingIntensity: intensity });
    const result = applyTeamTrainingSettings(currentSave, teamId, focus, intensity, trainingPreview.confirmToken, preview.sourcePlanId, persistence);
    if (result.applied) {
      for (const action of actions) appliedIds.add(action.actionId);
      currentSave = result.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
    }
  }

  const playerModeActions = selectedActions.filter(
    (action) => action.canApply && action.actionType === "set_player_training_modes",
  );
  for (const action of playerModeActions) {
    const teamPlan = leaguePlanPreview.teams.find((team) => team.teamId === action.teamId);
    if (!teamPlan) continue;
    const assignments = teamPlan.trainingPlan.playerTrainingPlans.map((plan) => ({
      playerId: plan.playerId,
      trainingMode: plan.selectedMode,
    }));
    const modesPreview = previewPlayerTrainingModes({
      save: currentSave,
      teamId: action.teamId,
      assignments,
    });
    const modesResult = applyPlayerTrainingModes(
      currentSave,
      action.teamId,
      assignments,
      modesPreview.confirmToken,
      persistence,
    );
    if (modesResult.applied) {
      appliedIds.add(action.actionId);
      currentSave = modesResult.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
    }
  }

  const playerClassActions = selectedActions.filter(
    (action) => action.canApply && action.actionType === "set_player_training_classes",
  );
  for (const action of playerClassActions) {
    const teamPlan = leaguePlanPreview.teams.find((team) => team.teamId === action.teamId);
    if (!teamPlan) continue;
    const assignments = teamPlan.trainingPlan.playerTrainingClassPlans.map((plan) => ({
      playerId: plan.playerId,
      trainingClass: plan.trainingClass,
    }));
    const classesPreview = previewPlayerTrainingClasses({
      save: currentSave,
      teamId: action.teamId,
      assignments,
    });
    const classesResult = applyPlayerTrainingClasses(
      currentSave,
      action.teamId,
      assignments,
      classesPreview.confirmToken,
      persistence,
    );
    if (classesResult.applied) {
      appliedIds.add(action.actionId);
      currentSave = classesResult.save ?? persistence.getSaveById(currentSave.saveId) ?? currentSave;
    }
  }

  const aiControlledTeamIds = new Set(
    leaguePlanPreview.teams
      .filter((team) => (currentSave.gameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode ?? "ai") === "ai")
      .map((team) => team.teamId),
  );
  for (const teamId of aiControlledTeamIds) {
    const demandResult = applyAiTeamPlayerDemandFulfillment({ gameState: currentSave.gameState, teamId });
    if (demandResult.fulfilledDemandIds.length > 0) {
      currentSave = persistence.saveSingleplayerState(currentSave.saveId, demandResult.gameState);
    }
  }

  return {
    ...preview,
    dryRun: false,
    applied: true,
    actions: selectedActions.map((action) => ({
      ...action,
      applied:
        action.actionType.includes("reserve_") ||
        action.actionType.includes("mark_") ||
        appliedIds.has(action.actionId),
    })),
  };
}

export function getAiManagerMarketSpendableCash(
  gameState: GameState,
  teamId: string,
  fallbackCash: number | null | undefined,
  opts?: { includeFallbackPools?: boolean },
) {
  const cash = fallbackCash ?? gameState.teams.find((team) => team.teamId === teamId)?.cash ?? null;
  if (cash == null) return null;
  const reservation = gameState.seasonState.aiManagerBudgetReservations?.[teamId];
  if (!reservation) return cash;

  if (opts?.includeFallbackPools) {
    // Rebuild/draft: transfer + building + combined liquidity reserve are spendable; only emergency
    // and maintenance stay hard-protected. Buckets are pre-sized by buildBudgetPlan with a low
    // reserveFactor for aggressive / cash-poor teams.
    const drawablePools =
      reservation.transferBudget +
      reservation.buildingBudget +
      reservation.cashReserve +
      reservation.salaryReserve;
    const availableAfterProtected = Math.max(
      0,
      cash - reservation.emergencyBudget - reservation.maintenanceBudget,
    );
    return round(clamp(Math.min(drawablePools, availableAfterProtected), 0, cash), 2);
  }

  // Outside rebuild: only the transferBudget pool is spendable. salaryReserve / maintenanceBudget /
  // emergencyBudget are protected buffers — but unspent buildingBudget/cashReserve still physically
  // sit in team.cash and must not be phantom-subtracted from the transfer pool.
  const protectedReserve = reservation.salaryReserve + reservation.maintenanceBudget + reservation.emergencyBudget;
  const availableAfterProtected = Math.max(0, cash - protectedReserve);
  return round(clamp(Math.min(reservation.transferBudget, availableAfterProtected), 0, cash), 2);
}

export function applyTransferBudgetSpend(gameState: GameState, teamId: string, fee: number): GameState {
  const reservation = gameState.seasonState.aiManagerBudgetReservations?.[teamId];
  if (!reservation || fee <= 0) return gameState;

  // Spend cascades through the buckets in priority order — transferBudget first, then the fallback
  // pools (buildingBudget, cashReserve, salaryReserve, maintenanceBudget) — so the recorded
  // reservation never drifts from the cash actually spent. emergencyBudget is never touched here.
  let remaining = fee;
  const take = (available: number) => {
    const amount = remaining > 0 ? Math.min(remaining, Math.max(0, available)) : 0;
    remaining = round(remaining - amount, 2);
    return amount;
  };
  const fromTransfer = take(reservation.transferBudget);
  const fromBuilding = take(reservation.buildingBudget);
  const fromCashReserve = take(reservation.cashReserve);
  const fromSalaryReserve = take(reservation.salaryReserve);
  const fromMaintenance = take(reservation.maintenanceBudget);

  if (fromTransfer <= 0 && fromBuilding <= 0 && fromCashReserve <= 0 && fromSalaryReserve <= 0 && fromMaintenance <= 0) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      aiManagerBudgetReservations: {
        ...(gameState.seasonState.aiManagerBudgetReservations ?? {}),
        [teamId]: {
          ...reservation,
          transferBudget: round(Math.max(0, reservation.transferBudget - fromTransfer), 2),
          buildingBudget: round(Math.max(0, reservation.buildingBudget - fromBuilding), 2),
          cashReserve: round(Math.max(0, reservation.cashReserve - fromCashReserve), 2),
          salaryReserve: round(Math.max(0, reservation.salaryReserve - fromSalaryReserve), 2),
          maintenanceBudget: round(Math.max(0, reservation.maintenanceBudget - fromMaintenance), 2),
          updatedAt: new Date().toISOString(),
        },
      },
    },
  };
}

export function resolveMarketSpendableCashForPlanner(input: {
  gameState: GameState;
  teamId: string;
  teamCash: number | null | undefined;
  rosterBelowMin: boolean;
  forceRosterFill?: boolean;
}) {
  const teamCash = input.teamCash ?? input.gameState.teams.find((entry) => entry.teamId === input.teamId)?.cash ?? 0;
  const reservation = input.gameState.seasonState.aiManagerBudgetReservations?.[input.teamId];
  const belowOpt = isTeamRosterBelowOpt(input.gameState, input.teamId);
  const rebuildMode = belowOpt || Boolean(input.forceRosterFill) || input.rosterBelowMin;

  // Hard-min fill must not be capped by stale draft-era GM buckets after season-end sells
  // inflated team cash — spend almost all current cash to reach playerMin first.
  if (input.rosterBelowMin) {
    const minPad = round(Math.max(3, Math.min(15, teamCash * 0.05)), 2);
    return round(Math.max(0, teamCash - minPad), 2);
  }

  // S2+: single cash pool — soft liquidity pad only while rebuilding toward Opt/Min.
  if (usesSingleCashPlanningPolicy(input.gameState)) {
    const minPad = round(Math.max(PLANNER_LIQUIDITY_BUFFER_MIN, Math.min(8, teamCash * 0.04)), 2);
    if (belowOpt || input.forceRosterFill || input.rosterBelowMin) {
      return round(Math.max(0, teamCash - minPad), 2);
    }
    return resolveTeamSpendableCashForPlanning(input.gameState, input.teamId, teamCash);
  }

  // S1 draft: buckets + rebuild liquidity reserves. In rebuild mode the draft may also draw on
  // buildingBudget and cashReserve as a fallback pool.
  if (reservation) {
    return (
      getAiManagerMarketSpendableCash(input.gameState, input.teamId, teamCash, {
        includeFallbackPools: rebuildMode,
      }) ?? 0
    );
  }

  if (rebuildMode) {
    const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
    const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);
    const { playerOpt } = deriveRosterTargets(team, identity);
    const expectedSalary = projectExpectedSalaryAtPlannerTarget(input.gameState, input.teamId, playerOpt);
    const objectiveBias = getTeamObjectiveAiBias(input.gameState, input.teamId);
    const liquidity = resolveCombinedLiquidityReserve({
      gameState: input.gameState,
      teamId: input.teamId,
      expectedSalaryAfterPlan: expectedSalary,
      rosterBelowOpt: true,
      buyAggression: objectiveBias?.buyAggression,
    });
    const emergencyPad = round(Math.max(5, teamCash * 0.08), 2);
    return round(Math.max(0, teamCash - liquidity.salaryReserve - liquidity.cashReserve - emergencyPad), 2);
  }

  const reserve = resolveTeamCashRunwayReserve(input.gameState, input.teamId);
  return round(Math.max(0, teamCash - reserve), 2);
}
