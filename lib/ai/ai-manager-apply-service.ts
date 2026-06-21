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
import { previewFacilityMaintenance, applyFacilityMaintenance } from "@/lib/facilities/facility-maintenance-service";
import { previewFacilityUpgrade, applyFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { applyTeamTrainingSettings, previewTeamTrainingSettings } from "@/lib/training/training-settings-service";

export type AiManagerActionType =
  | "maintain_building"
  | "upgrade_building"
  | "buy_building"
  | "downgrade_building"
  | "set_training_focus"
  | "set_training_intensity"
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
  for (const teamPlan of preview.teams) {
    const buckets = teamPlan.budgetPlan.bucketsBefore;
    let remainingMaintenanceBudget = buckets.maintenanceBudget;
    let remainingBuildingBudget = buckets.buildingBudget;
    const maintenancePlans = teamPlan.buildingPlan.filter((row) => {
      if (row.action === "downgrade_or_ignore_if_no_cash") return false;
      const maintenance = previewFacilityMaintenance(save, row.teamId, row.buildingType);
      return maintenance.ok || (!maintenance.blockingReasons.includes("facility_not_built") && !maintenance.blockingReasons.includes("facility_condition_already_full"));
    });
    const downgradePlans = teamPlan.buildingPlan.filter((row) => row.action === "downgrade_or_ignore_if_no_cash" && row.currentLevel > 0);
    const upgradePlans = teamPlan.buildingPlan.filter((row) => row.action === "upgrade_existing" || row.action === "build_new");

    for (const row of maintenancePlans) {
      const maintenance = previewFacilityMaintenance(save, row.teamId, row.buildingType);
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
      const downgrade = previewFacilityUpgrade(save, row.teamId, row.buildingType, null, "downgrade");
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

    for (const row of upgradePlans) {
      const upgrade = previewFacilityUpgrade(save, row.teamId, row.buildingType, row.buildingType === "specialist_wing" ? "mind_lab" : undefined);
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
  return preview.teams.flatMap((teamPlan) => {
    const training = previewTeamTrainingSettings({
      save,
      teamId: teamPlan.teamId,
      trainingFocus: teamPlan.trainingPlan.selectedTrainingFocus,
      trainingIntensity: teamPlan.trainingPlan.selectedTrainingIntensity,
    });
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
      warnings: [...training.warnings, ...teamPlan.trainingPlan.warnings],
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
    if (budgetPreview && (byType.has("reserve_transfer_budget") || byType.has("reserve_salary_budget") || byType.has("reserve_maintenance_budget"))) {
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
}): AiManagerApplyPreview {
  const dryRun = input.dryRun ?? true;
  const persistence = input.persistence ?? createPersistenceService();
  const preview = buildAiManagerApplyPreview(input.save, input.teamIds);
  const allowedTypes = input.actionTypes ? new Set(input.actionTypes) : null;
  const selectedActions = allowedTypes ? preview.actions.filter((action) => allowedTypes.has(action.actionType)) : preview.actions;
  if (dryRun) {
    return { ...preview, dryRun: true, actions: selectedActions };
  }

  let currentSave = writeManagerPlanState(input.save, selectedActions, persistence, buildAiLeagueManagementPreview(input.save.gameState));
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
        currentSave = persistence.getSaveById(currentSave.saveId) ?? currentSave;
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
        currentSave = persistence.getSaveById(currentSave.saveId) ?? currentSave;
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
      currentSave = persistence.getSaveById(currentSave.saveId) ?? currentSave;
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
    const trainingPreview = previewTeamTrainingSettings({ save: currentSave, teamId, trainingFocus: focus, trainingIntensity: intensity });
    const result = applyTeamTrainingSettings(currentSave, teamId, focus, intensity, trainingPreview.confirmToken, preview.sourcePlanId, persistence);
    if (result.applied) {
      for (const action of actions) appliedIds.add(action.actionId);
      currentSave = persistence.getSaveById(currentSave.saveId) ?? currentSave;
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

export function getAiManagerMarketSpendableCash(gameState: GameState, teamId: string, fallbackCash: number | null | undefined) {
  const cash = fallbackCash ?? gameState.teams.find((team) => team.teamId === teamId)?.cash ?? null;
  if (cash == null) return null;
  const reservation = gameState.seasonState.aiManagerBudgetReservations?.[teamId];
  if (!reservation) return cash;
  return round(
    clamp(
      Math.min(
        reservation.transferBudget,
        cash -
          reservation.cashReserve -
          reservation.salaryReserve -
          reservation.buildingBudget -
          reservation.maintenanceBudget -
          reservation.emergencyBudget,
      ),
      0,
      cash,
    ),
  );
}
