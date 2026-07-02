import { createHash, randomUUID } from "node:crypto";

import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  FACILITY_CATALOG_BY_ID,
  getFacilityLevelDefinition,
  SPECIALIST_WING_VARIANTS,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import {
  calculateFacilityIncome,
  calculateFacilityUpkeep,
  getFacilityEfficiency,
  getFacilityLevel,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import { getDevelopmentWeightedFacilityUpgradeDiscount, getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { FACILITY_CONDITION_FULL } from "@/lib/facilities/facility-condition";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type FacilityUpgradePreview = {
  ok: boolean;
  dryRun: true;
  action: FacilityUpgradeAction;
  confirmToken: string | null;
  team: { teamId: string; shortCode: string; name: string } | null;
  facility: { facilityId: FacilityId; label: string; variant: string | null } | null;
  currentLevel: number;
  nextLevel: number | null;
  currentEffect: string;
  nextEffect: string | null;
  upgradeCost: number | null;
  refundAmount: number | null;
  currentUpkeep: number;
  newUpkeep: number;
  currentIncome: number;
  newIncome: number;
  cashBefore: number | null;
  cashAfter: number | null;
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    seasonId: string;
    saveStatus: string;
  };
};

export type FacilityUpgradeApplyResult = Omit<FacilityUpgradePreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  facilityEventId: string | null;
};

export type FacilityUpgradeAction = "upgrade" | "downgrade";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildConfirmToken(input: {
  saveId: string;
  teamId: string;
  facilityId: FacilityId;
  currentLevel: number;
  nextLevel: number;
  upgradeCost: number;
  refundAmount: number;
  cashBefore: number;
  action: FacilityUpgradeAction;
  variant?: string | null;
}) {
  return createHash("sha256")
    .update(
      [
        input.saveId,
        input.teamId,
        input.facilityId,
        input.currentLevel,
        input.nextLevel,
        input.upgradeCost,
        input.refundAmount,
        input.cashBefore,
        input.action,
        input.variant ?? "none",
      ].join(":"),
    )
    .digest("hex");
}

function normalizeVariant(value?: string | null): SpecialistWingVariant | null {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(SPECIALIST_WING_VARIANTS, value)
    ? (value as SpecialistWingVariant)
    : null;
}

function buildNextFacilityState(input: {
  current: TeamFacilityCollection;
  facilityId: FacilityId;
  nextLevel: number;
  seasonId: string;
  variant?: string | null;
}) {
  const existing = input.current.facilities[input.facilityId];
  return {
    facilities: {
      ...input.current.facilities,
      [input.facilityId]: {
        ...existing,
        level: input.nextLevel,
        enabled: input.nextLevel > 0,
        conditionPct: FACILITY_CONDITION_FULL,
        activeVariant: input.variant ?? existing?.activeVariant,
        lastPaidSeasonId: input.seasonId,
        disabledReason: input.nextLevel > 0 ? undefined : "not_built",
      },
    },
  } satisfies TeamFacilityCollection;
}

function buildWarnings(input: {
  cashBefore: number | null;
  cashAfter: number | null;
  currentUpkeep: number;
  newUpkeep: number;
  currentIncome: number;
  newIncome: number;
  upgradeCost: number | null;
  isIncomeFacility: boolean;
}) {
  const warnings: string[] = [];
  if (input.cashBefore != null && input.upgradeCost != null && input.upgradeCost > input.cashBefore * 0.35) {
    warnings.push("transfer_budget_risk");
  }
  if (input.newUpkeep > input.currentUpkeep + 3 || input.newUpkeep > 8) {
    warnings.push("high_upkeep_warning");
  }
  if (input.cashAfter != null && input.cashAfter < 10) {
    warnings.push("cash_after_upgrade_low");
  }
  if (input.isIncomeFacility && input.newIncome <= input.currentIncome) {
    warnings.push("income_source_missing");
  }
  if (input.newUpkeep > input.currentUpkeep) {
    warnings.push("season_upkeep_unpaid_risk");
  }
  return warnings;
}

export function previewFacilityUpgrade(
  save: PersistedSaveGame,
  teamId: string,
  facilityId: FacilityId,
  variant?: string | null,
  action: FacilityUpgradeAction = "upgrade",
): FacilityUpgradePreview {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const facility = FACILITY_CATALOG_BY_ID[facilityId] ?? null;
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const storedLevel = Math.max(0, Math.min(5, Math.round(teamFacilities.facilities[facilityId]?.level ?? 0)));
  const currentLevel = facility ? (action === "downgrade" ? storedLevel : getFacilityLevel(teamFacilities, facilityId)) : 0;
  const nextLevel = facility
    ? action === "downgrade"
      ? Math.max(currentLevel - 1, 0)
      : Math.min(currentLevel + 1, facility.maxLevel)
    : null;
  const currentDefinition = facility ? getFacilityLevelDefinition(facilityId, currentLevel) : null;
  const nextDefinition = facility && nextLevel != null ? getFacilityLevelDefinition(facilityId, nextLevel) : null;
  const downgradeRefundSourceDefinition = action === "downgrade" && facility ? getFacilityLevelDefinition(facilityId, currentLevel) : null;
  const existingVariant = teamFacilities.facilities.specialist_wing?.activeVariant ?? null;
  const normalizedVariant =
    facilityId === "specialist_wing"
      ? currentLevel > 0
        ? normalizeVariant(existingVariant)
        : normalizeVariant(variant)
      : null;
  const nextTeamFacilities =
    facility && nextLevel != null && nextDefinition
      ? buildNextFacilityState({
          current: teamFacilities,
          facilityId,
          nextLevel,
          seasonId: gameState.season.id,
          variant: facilityId === "specialist_wing" ? normalizedVariant : undefined,
        })
      : teamFacilities;
  const currentUpkeep = calculateFacilityUpkeep(teamFacilities);
  const newUpkeep = calculateFacilityUpkeep(nextTeamFacilities);
  const currentIncome = calculateFacilityIncome(teamFacilities);
  const newIncome = calculateFacilityIncome(nextTeamFacilities);
  const rawUpgradeCost = action === "upgrade" ? nextDefinition?.upgradeCost ?? null : 0;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const profile = getTeamStrategyProfile(gameState, teamId);
  const developmentTendency =
    team != null ? getTeamDevelopmentTendency({ team, identity, profile }) : null;
  const upgradeCost =
    rawUpgradeCost != null && developmentTendency
      ? getDevelopmentWeightedFacilityUpgradeDiscount({
          baseUpgradeCost: rawUpgradeCost,
          facilityId,
          tendency: developmentTendency,
        })
      : rawUpgradeCost;
  const refundAmount =
    action === "downgrade" && downgradeRefundSourceDefinition
      ? roundValue(downgradeRefundSourceDefinition.upgradeCost * 0.25)
      : null;
  const cashBefore = team?.cash ?? null;
  const cashAfter =
    cashBefore != null && upgradeCost != null
      ? roundValue(cashBefore - upgradeCost + (refundAmount ?? 0))
      : cashBefore;
  const blockingReasons: string[] = [];

  if (save.status !== "active") blockingReasons.push("save_not_active");
  if (!team) blockingReasons.push("team_not_found");
  if (!facility) blockingReasons.push("facility_not_found");
  if (facility && action === "upgrade" && currentLevel >= facility.maxLevel) blockingReasons.push("facility_max_level");
  if (facility && action === "downgrade" && currentLevel <= 0) blockingReasons.push("facility_min_level");
  if (action === "upgrade" && teamFacilities.facilities[facilityId]?.disabledReason && currentLevel > 0) {
    blockingReasons.push("facility_disabled");
  }
  if (facilityId === "specialist_wing" && action === "upgrade" && currentLevel === 0 && !normalizedVariant) {
    blockingReasons.push("specialist_wing_variant_required");
  }
  if (facilityId === "specialist_wing" && action === "upgrade" && currentLevel > 0 && variant && variant !== existingVariant) {
    blockingReasons.push("specialist_wing_variant_switch_not_supported");
  }
  if (cashAfter != null && cashAfter < 0) blockingReasons.push("insufficient_cash");

  const confirmToken =
    blockingReasons.length === 0 && team && facility && nextLevel != null && upgradeCost != null && cashBefore != null
      ? buildConfirmToken({
          saveId: save.saveId,
          teamId,
          facilityId,
          currentLevel,
          nextLevel,
          upgradeCost,
          refundAmount: refundAmount ?? 0,
          cashBefore,
          action,
          variant: normalizedVariant,
        })
      : null;

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    action,
    confirmToken,
    team: team ? { teamId: team.teamId, shortCode: team.shortCode, name: team.name } : null,
    facility: facility ? { facilityId, label: facility.label, variant: normalizedVariant } : null,
    currentLevel,
    nextLevel,
    currentEffect: currentDefinition?.effectDescription ?? "Level 0: kein Effekt",
    nextEffect: nextDefinition?.effectDescription ?? (action === "downgrade" && nextLevel === 0 ? "Level 0: kein Effekt" : null),
    upgradeCost,
    refundAmount,
    currentUpkeep,
    newUpkeep,
    currentIncome,
    newIncome,
    cashBefore,
    cashAfter,
    warnings: buildWarnings({
      cashBefore,
      cashAfter,
      currentUpkeep,
      newUpkeep,
      currentIncome,
      newIncome,
      upgradeCost,
      isIncomeFacility: facility?.effectType === "season_income",
    }),
    blockingReasons,
    saveContext: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      saveStatus: save.status,
    },
  };
}

export function applyFacilityUpgrade(
  save: PersistedSaveGame,
  teamId: string,
  facilityId: FacilityId,
  confirmToken: string | null | undefined,
  variant?: string | null,
  actionOrPersistence: FacilityUpgradeAction | PersistenceService = "upgrade",
  persistenceOverride?: PersistenceService,
): FacilityUpgradeApplyResult {
  const action = typeof actionOrPersistence === "string" ? actionOrPersistence : "upgrade";
  const persistence = typeof actionOrPersistence === "string" ? persistenceOverride ?? createPersistenceService() : actionOrPersistence;
  const preview = previewFacilityUpgrade(save, teamId, facilityId, variant, action);
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      facilityEventId: null,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "facility_upgrade_preview_stale" : "confirm_token_required"],
    };
  }

  if (!preview.team || !preview.facility || preview.nextLevel == null || preview.upgradeCost == null) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      facilityEventId: null,
      blockingReasons: [...preview.blockingReasons, "facility_upgrade_preview_stale"],
    };
  }

  const currentFacilities = getTeamFacilityState(save.gameState, teamId);
  const nextFacilities = buildNextFacilityState({
    current: currentFacilities,
    facilityId,
    nextLevel: preview.nextLevel,
    seasonId: save.gameState.season.id,
    variant: preview.facility.variant,
  });
  const eventId = `facility-event-${randomUUID()}`;
  const nextGameState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === teamId
        ? {
            ...team,
            cash: roundValue(team.cash - preview.upgradeCost! + (preview.refundAmount ?? 0)),
          }
        : team,
    ),
    seasonState: {
      ...save.gameState.seasonState,
      teamFacilities: {
        ...(save.gameState.seasonState.teamFacilities ?? {}),
        [teamId]: nextFacilities,
      },
      facilityEvents: [
        {
          eventId,
          seasonId: save.gameState.season.id,
          teamId,
          facilityId,
          previousLevel: preview.currentLevel,
          nextLevel: preview.nextLevel,
          cost: action === "downgrade" ? -(preview.refundAmount ?? 0) : preview.upgradeCost,
          timestamp: new Date().toISOString(),
          source: action === "downgrade" ? "manual_facility_downgrade" : "manual_facility_upgrade",
          previousConditionPct: getFacilityEfficiency(currentFacilities, facilityId).conditionPct,
          nextConditionPct: FACILITY_CONDITION_FULL,
        },
        ...(save.gameState.seasonState.facilityEvents ?? []),
      ],
    },
  };

  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ...preview,
    dryRun: false,
    applied: true,
    facilityEventId: eventId,
    blockingReasons: [],
  };
}
