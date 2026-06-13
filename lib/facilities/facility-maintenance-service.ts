import { createHash, randomUUID } from "node:crypto";

import type { FacilityEventRecord, GameState } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG_BY_ID, type FacilityId } from "@/lib/facilities/facility-catalog";
import {
  calculateFacilityMaintenanceCost,
  FACILITY_CONDITION_FULL,
  getFacilityConditionStatus,
} from "@/lib/facilities/facility-condition";
import { getFacilityEfficiency, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type FacilityMaintenancePreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  team: { teamId: string; shortCode: string; name: string } | null;
  facility: { facilityId: FacilityId; label: string } | null;
  level: number;
  conditionPct: number;
  nextConditionPct: number;
  efficiencyPct: number;
  nextEfficiencyPct: number;
  conditionStatus: ReturnType<typeof getFacilityConditionStatus>;
  maintenanceCost: number;
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

export type FacilityMaintenanceApplyResult = Omit<FacilityMaintenancePreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  facilityEventId: string | null;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildConfirmToken(input: {
  saveId: string;
  teamId: string;
  facilityId: FacilityId;
  conditionPct: number;
  maintenanceCost: number;
  cashBefore: number;
}) {
  return createHash("sha256")
    .update([input.saveId, input.teamId, input.facilityId, input.conditionPct, input.maintenanceCost, input.cashBefore].join(":"))
    .digest("hex");
}

export function previewFacilityMaintenance(
  save: PersistedSaveGame,
  teamId: string,
  facilityId: FacilityId,
): FacilityMaintenancePreview {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const facility = FACILITY_CATALOG_BY_ID[facilityId] ?? null;
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const record = teamFacilities.facilities[facilityId];
  const level = record?.level ?? 0;
  const efficiency = getFacilityEfficiency(teamFacilities, facilityId);
  const conditionPct = efficiency.conditionPct;
  const maintenanceCost =
    facility && level > 0
      ? calculateFacilityMaintenanceCost({
          facilityId,
          level,
          conditionPct,
        })
      : 0;
  const cashBefore = team?.cash ?? null;
  const cashAfter = cashBefore != null ? roundValue(cashBefore - maintenanceCost) : cashBefore;
  const blockingReasons: string[] = [];

  if (save.status !== "active") blockingReasons.push("save_not_active");
  if (!team) blockingReasons.push("team_not_found");
  if (!facility) blockingReasons.push("facility_not_found");
  if (level <= 0) blockingReasons.push("facility_not_built");
  if (conditionPct >= FACILITY_CONDITION_FULL) blockingReasons.push("facility_condition_already_full");
  if (cashAfter != null && cashAfter < 0) blockingReasons.push("insufficient_cash");

  const confirmToken =
    blockingReasons.length === 0 && team && facility && cashBefore != null
      ? buildConfirmToken({ saveId: save.saveId, teamId, facilityId, conditionPct, maintenanceCost, cashBefore })
      : null;

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    confirmToken,
    team: team ? { teamId: team.teamId, shortCode: team.shortCode, name: team.name } : null,
    facility: facility ? { facilityId, label: facility.label } : null,
    level,
    conditionPct,
    nextConditionPct: FACILITY_CONDITION_FULL,
    efficiencyPct: efficiency.efficiencyPct,
    nextEfficiencyPct: FACILITY_CONDITION_FULL,
    conditionStatus: getFacilityConditionStatus(conditionPct),
    maintenanceCost,
    cashBefore,
    cashAfter,
    warnings: conditionPct < 70 ? ["facility_condition_below_70"] : [],
    blockingReasons,
    saveContext: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      saveStatus: save.status,
    },
  };
}

export function applyFacilityMaintenance(
  save: PersistedSaveGame,
  teamId: string,
  facilityId: FacilityId,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): FacilityMaintenanceApplyResult {
  const preview = previewFacilityMaintenance(save, teamId, facilityId);
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      facilityEventId: null,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "facility_maintenance_preview_stale" : "confirm_token_required"],
    };
  }

  const teamFacilities = getTeamFacilityState(save.gameState, teamId);
  const previous = teamFacilities.facilities[facilityId];
  const nextFacilities = {
    facilities: {
      ...teamFacilities.facilities,
      [facilityId]: {
        ...previous,
        conditionPct: FACILITY_CONDITION_FULL,
        enabled: true,
        disabledReason: undefined,
      },
    },
  };
  const eventId = `facility-event-${randomUUID()}`;
  const event: FacilityEventRecord = {
    eventId,
    seasonId: save.gameState.season.id,
    teamId,
    facilityId,
    previousLevel: preview.level,
    nextLevel: preview.level,
    cost: preview.maintenanceCost,
    timestamp: new Date().toISOString(),
    source: "manual_facility_maintenance",
    previousConditionPct: preview.conditionPct,
    nextConditionPct: FACILITY_CONDITION_FULL,
  };
  const nextGameState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === teamId
        ? {
            ...team,
            cash: roundValue(team.cash - preview.maintenanceCost),
          }
        : team,
    ),
    seasonState: {
      ...save.gameState.seasonState,
      teamFacilities: {
        ...(save.gameState.seasonState.teamFacilities ?? {}),
        [teamId]: nextFacilities,
      },
      facilityEvents: [event, ...(save.gameState.seasonState.facilityEvents ?? [])],
    },
  };

  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ...preview,
    dryRun: false,
    applied: true,
    facilityEventId: eventId,
    nextConditionPct: FACILITY_CONDITION_FULL,
    nextEfficiencyPct: FACILITY_CONDITION_FULL,
    cashAfter: roundValue((preview.cashBefore ?? 0) - preview.maintenanceCost),
  };
}
