import { createHash, randomUUID } from "node:crypto";

import type { FacilityEventRecord, GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  FACILITY_CATALOG,
  getFacilityLevelDefinition,
  type FacilityId,
} from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiency, getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { degradeFacilityCondition } from "@/lib/facilities/facility-condition";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type FacilitySeasonEndFinanceFacilityRow = {
  facilityId: FacilityId;
  label: string;
  level: number;
  enabled: boolean;
  upkeep: number;
  income: number;
  status: "not_built" | "enabled" | "paid" | "already_paid" | "will_disable_unpaid" | "disabled";
  warning: string | null;
};

export type FacilitySeasonEndFinancePreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  team: { teamId: string; shortCode: string; name: string } | null;
  cashBeforeFacilities: number | null;
  facilityUpkeepTotal: number;
  facilityIncomeTotal: number;
  fanShopIncome: number;
  arenaIncome: number;
  netFacilityResult: number;
  cashAfterFacilities: number | null;
  disabledFacilities: FacilitySeasonEndFinanceFacilityRow[];
  rows: FacilitySeasonEndFinanceFacilityRow[];
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    seasonId: string;
    saveStatus: string;
  };
};

export type FacilitySeasonEndFinanceApplyResult = Omit<FacilitySeasonEndFinancePreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  facilityEventIds: string[];
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildConfirmToken(input: {
  saveId: string;
  teamId: string;
  seasonId: string;
  cashBeforeFacilities: number;
  facilityUpkeepTotal: number;
  facilityIncomeTotal: number;
  disabledFacilityIds: string[];
}) {
  return createHash("sha256")
    .update(
      [
        input.saveId,
        input.teamId,
        input.seasonId,
        input.cashBeforeFacilities,
        input.facilityUpkeepTotal,
        input.facilityIncomeTotal,
        input.disabledFacilityIds.join(","),
      ].join(":"),
    )
    .digest("hex");
}

function getRawFacilityLevel(teamFacilities: TeamFacilityCollection, facilityId: FacilityId) {
  const raw = teamFacilities.facilities[facilityId]?.level ?? 0;
  return Math.max(0, Math.min(5, Math.round(raw)));
}

function buildRows(teamFacilities: TeamFacilityCollection, cashBefore: number | null, seasonId: string) {
  const enabledRows = FACILITY_CATALOG.map((facility) => {
    const state = teamFacilities.facilities[facility.facilityId];
    const rawLevel = getRawFacilityLevel(teamFacilities, facility.facilityId);
    const effectLevel = getFacilityLevel(teamFacilities, facility.facilityId);
    const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
    const definition = getFacilityLevelDefinition(facility.facilityId, effectLevel);
    const enabled = Boolean(state?.enabled) && rawLevel > 0;
    return {
      facilityId: facility.facilityId,
      label: facility.label,
      level: rawLevel,
      enabled,
      upkeep: roundValue(definition?.seasonUpkeep ?? 0),
      income: roundValue(((definition?.seasonIncome ?? 0) * efficiencyPct) / 100),
      status: rawLevel <= 0 ? "not_built" : enabled ? "enabled" : "disabled",
      warning: !enabled && rawLevel > 0 ? state?.disabledReason ?? "facility_disabled" : null,
    } satisfies FacilitySeasonEndFinanceFacilityRow;
  });
  const facilityIncomeTotal = roundValue(enabledRows.reduce((sum, row) => sum + row.income, 0));
  let cashAvailableForUpkeep = cashBefore == null ? null : roundValue(cashBefore + facilityIncomeTotal);

  return enabledRows.map((row) => {
    if (!row.enabled || row.upkeep <= 0) {
      return row;
    }
    if (teamFacilities.facilities[row.facilityId]?.lastPaidSeasonId === seasonId) {
      return {
        ...row,
        status: "already_paid",
        warning: "facility_upkeep_already_paid",
      } satisfies FacilitySeasonEndFinanceFacilityRow;
    }
    if (cashAvailableForUpkeep != null && cashAvailableForUpkeep < row.upkeep) {
      return {
        ...row,
        status: "will_disable_unpaid",
        warning: "facility_upkeep_unpaid",
      } satisfies FacilitySeasonEndFinanceFacilityRow;
    }
    if (cashAvailableForUpkeep != null) {
      cashAvailableForUpkeep = roundValue(cashAvailableForUpkeep - row.upkeep);
    }
    return {
      ...row,
      status: "paid",
    } satisfies FacilitySeasonEndFinanceFacilityRow;
  });
}

export function previewFacilitySeasonEndFinance(
  save: PersistedSaveGame,
  teamId: string,
): FacilitySeasonEndFinancePreview {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const cashBeforeFacilities = team?.cash ?? null;
  const rows = buildRows(teamFacilities, cashBeforeFacilities, gameState.season.id);
  const disabledFacilities = rows.filter((row) => row.status === "will_disable_unpaid");
  const paidUpkeepTotal = roundValue(rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.upkeep, 0));
  const facilityIncomeTotal = roundValue(rows.reduce((sum, row) => sum + row.income, 0));
  const fanShopIncome = rows.find((row) => row.facilityId === "fan_shop")?.income ?? 0;
  const arenaIncome = rows.find((row) => row.facilityId === "arena_upgrade")?.income ?? 0;
  const netFacilityResult = roundValue(facilityIncomeTotal - paidUpkeepTotal);
  const cashAfterFacilities =
    cashBeforeFacilities == null ? null : roundValue(cashBeforeFacilities + facilityIncomeTotal - paidUpkeepTotal);
  const blockingReasons: string[] = [];
  if (save.status !== "active") blockingReasons.push("save_not_active");
  if (!team) blockingReasons.push("team_not_found");
  const warnings = [
    disabledFacilities.length > 0 ? "facility_upkeep_unpaid" : null,
    fanShopIncome <= 0 ? "fan_shop_income_missing" : null,
    arenaIncome <= 0 ? "arena_income_missing" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const confirmToken =
    blockingReasons.length === 0 && team && cashBeforeFacilities != null
      ? buildConfirmToken({
          saveId: save.saveId,
          teamId,
          seasonId: gameState.season.id,
          cashBeforeFacilities,
          facilityUpkeepTotal: paidUpkeepTotal,
          facilityIncomeTotal,
          disabledFacilityIds: disabledFacilities.map((row) => row.facilityId),
        })
      : null;

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    confirmToken,
    team: team ? { teamId: team.teamId, shortCode: team.shortCode, name: team.name } : null,
    cashBeforeFacilities,
    facilityUpkeepTotal: paidUpkeepTotal,
    facilityIncomeTotal,
    fanShopIncome,
    arenaIncome,
    netFacilityResult,
    cashAfterFacilities,
    disabledFacilities,
    rows,
    warnings,
    blockingReasons,
    saveContext: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      saveStatus: save.status,
    },
  };
}

export function applyFacilitySeasonEndFinance(
  save: PersistedSaveGame,
  teamId: string,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): FacilitySeasonEndFinanceApplyResult {
  const preview = previewFacilitySeasonEndFinance(save, teamId);
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      facilityEventIds: [],
      blockingReasons: [...preview.blockingReasons, confirmToken ? "facility_season_end_preview_stale" : "confirm_token_required"],
    };
  }
  const teamFacilities = getTeamFacilityState(save.gameState, teamId);
  const eventIds: string[] = [];
  const events: FacilityEventRecord[] = [];
  const nextFacilities: TeamFacilityCollection = {
    facilities: { ...teamFacilities.facilities },
  };
  for (const row of preview.rows) {
    if (row.status !== "paid" && row.status !== "will_disable_unpaid") {
      continue;
    }
    const eventId = `facility-event-${randomUUID()}`;
    eventIds.push(eventId);
    const previous = nextFacilities.facilities[row.facilityId];
    const previousConditionPct = getFacilityEfficiency(teamFacilities, row.facilityId).conditionPct;
    const nextConditionPct = degradeFacilityCondition(previousConditionPct, row.status === "paid");
    nextFacilities.facilities[row.facilityId] = {
      ...previous,
      enabled: row.status === "paid" && nextConditionPct > 0,
      lastPaidSeasonId: row.status === "paid" ? save.gameState.season.id : previous?.lastPaidSeasonId,
      conditionPct: nextConditionPct,
      disabledReason: row.status === "paid" ? (nextConditionPct <= 0 ? "facility_condition_broken" : undefined) : "facility_upkeep_unpaid",
    };
    events.push({
      eventId,
      seasonId: save.gameState.season.id,
      teamId,
      facilityId: row.facilityId,
      previousLevel: row.level,
      nextLevel: row.level,
      cost: row.status === "paid" ? row.upkeep : 0,
      timestamp: new Date().toISOString(),
      source: row.status === "paid" ? "facility_upkeep_paid" : "facility_upkeep_unpaid",
      previousConditionPct,
      nextConditionPct,
    });
  }
  const incomeEventId = preview.facilityIncomeTotal > 0 ? `facility-event-${randomUUID()}` : null;
  if (incomeEventId) {
    eventIds.push(incomeEventId);
    events.push({
      eventId: incomeEventId,
      seasonId: save.gameState.season.id,
      teamId,
      facilityId: "fan_shop",
      previousLevel: getRawFacilityLevel(teamFacilities, "fan_shop"),
      nextLevel: getRawFacilityLevel(teamFacilities, "fan_shop"),
      cost: -preview.facilityIncomeTotal,
      timestamp: new Date().toISOString(),
      source: "facility_income_collected",
    });
  }
  const nextGameState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === teamId
        ? {
            ...team,
            cash: preview.cashAfterFacilities ?? team.cash,
          }
        : team,
    ),
    seasonState: {
      ...save.gameState.seasonState,
      teamFacilities: {
        ...(save.gameState.seasonState.teamFacilities ?? {}),
        [teamId]: nextFacilities,
      },
      facilityEvents: [...events, ...(save.gameState.seasonState.facilityEvents ?? [])],
    },
  };

  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ...previewFacilitySeasonEndFinance({ ...save, gameState: nextGameState }, teamId),
    dryRun: false,
    applied: true,
    facilityEventIds: eventIds,
    blockingReasons: [],
  };
}
