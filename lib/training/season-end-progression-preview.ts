import type { GameState, Player, PlayerGeneratorAttributeName, PlayerGeneratorAttributes, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  applyTrainingXpFacilityModifiers,
  applyUpgradeCostFacilityModifiers,
  getAnalyticsForecastQuality,
  getFacilityLevel,
  getScoutingConfidence,
} from "@/lib/facilities/facility-effects";
import { getTeamDevelopmentTrainingBonusPct } from "@/lib/foundation/team-development-tendency";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerEconomyCompareReport } from "@/lib/foundation/player-economy-compare-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import type { OrganicSeasonProgressionResult } from "@/lib/training/organic-season-progression";
import type { PlayerProgressionForecast, PlayerProgressionRatingTier } from "@/lib/training/training-plan-types";
import { PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";

export type SeasonEndFacilityPreviewLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type SeasonEndFacilityPreviewInput = {
  teamFacilities?: TeamFacilityCollection;
  trainingCenterLevel?: SeasonEndFacilityPreviewLevel;
  academyLevel?: SeasonEndFacilityPreviewLevel;
  specialistWingLevel?: SeasonEndFacilityPreviewLevel;
  specialistWingVariant?: string | null;
  analyticsRoomLevel?: SeasonEndFacilityPreviewLevel;
  scoutingOfficeLevel?: SeasonEndFacilityPreviewLevel;
  recoveryCenterLevel?: SeasonEndFacilityPreviewLevel;
};

export type SeasonEndProgressionUpgradeRequest = {
  playerId: string;
  attribute: PlayerGeneratorAttributeName;
  steps?: number;
};

export type SeasonEndProgressionDisciplineDelta = {
  disciplineId: string;
  label: string;
  lastSeasonDisciplineValues: number | null;
  currentDisciplineValues: number | null;
  disciplineDelta: number | null;
};

export type SeasonEndProgressionEconomyAudit = {
  importedMarketValue: number | null;
  calculatedMarketValue: number | null;
  displayedMarketValue: number | null;
  previewMarketValueAfterUpgrade: number | null;
  marketValueAfterUpgradePreview: number | null;
  importedSalary: number | null;
  calculatedSalary: number | null;
  displayedSalary: number | null;
  buySellModalSalary: number | null;
  previewSalaryAfterUpgrade: number | null;
  currentContractSalary: number | null;
  renewalSalaryPreview: number | null;
  salaryExpectation: number | null;
  ovrBefore: number | null;
  ovrAfterPreview: number | null;
  mvsBefore: number | null;
  mvsAfterPreview: number | null;
  bracketBefore: string | null;
  bracketAfterPreview: string | null;
  marketValueDeltaAbs: number | null;
  marketValueDeltaPct: number | null;
  salaryDeltaAbs: number | null;
  salaryDeltaPct: number | null;
  warningLevel: "none" | "gt_25_pct" | "gt_50_pct" | "gt_90_pct";
  marketValueWarnings: string[];
  salaryWarnings: string[];
  warnings: string[];
};

export type SeasonEndProgressionPreviewRow = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamCode: string | null;
  availableXP: number;
  /** Legacy manual-upgrade pool from XP forecast — not organic setpoints. */
  legacyAvailableXP: number;
  organicNetSetpoints: number;
  organicTrainingSetpoints: number;
  organicPerformanceSetpoints: number;
  organicMarketValuePressureTotal: number;
  trainingXP: number;
  performanceXP: number;
  traitModifierPct: number;
  facilityEffects: {
    xpBeforeFacility: number;
    facilityModifierPct: number;
    xpAfterFacility: number;
    costBeforeFacility: number | null;
    facilityDiscountPct: number;
    costAfterFacility: number | null;
    appliedEffects: string[];
  };
  selectedAttribute: PlayerGeneratorAttributeName;
  attributeBefore: number | null;
  attributeAfter: number | null;
  ratingTierBefore: PlayerProgressionRatingTier;
  ratingTierAfter: PlayerProgressionRatingTier;
  upgradeCost: number | null;
  remainingXP: number;
  status: "planned" | "blocked";
  blockReason: string | null;
  disciplineDeltas: SeasonEndProgressionDisciplineDelta[];
  economyAudit: SeasonEndProgressionEconomyAudit;
  confirmContract: {
    action: "season_end_progression_apply";
    playerId: string;
    attribute: PlayerGeneratorAttributeName;
    cost: number | null;
    productiveWrites: false;
    writesPrepared: Array<"xp" | "attributes" | "discipline_snapshot" | "market_value" | "salary">;
    requiredConfirmToken: "SEASON_END_PROGRESSION_APPLY_CONFIRM";
  };
};

export type SeasonEndProgressionPreview = {
  status: "ready" | "warning";
  productiveWrites: false;
  rows: SeasonEndProgressionPreviewRow[];
  warnings: string[];
};

type EconomyPreviewContext = {
  beforeReport: ReturnType<typeof buildPlayerEconomyCompareReport>;
  beforeRowsByPlayerId: Map<string, ReturnType<typeof buildPlayerEconomyCompareReport>["players"][number]>;
  beforeRatings: ReturnType<typeof buildPlayerRatingContractMap>;
  rosterByPlayerId: Map<string, GameState["rosters"][number]>;
  salaryMarketValueOverridesByPlayerId: Map<string, number>;
  baseMarketValueOverridesByPlayerId: Map<string, number>;
};

const ATTRIBUTE_LABELS: Record<PlayerGeneratorAttributeName, string> = {
  power: "Power",
  health: "Health",
  stamina: "Stamina",
  intelligence: "Intelligence",
  awareness: "Awareness",
  determination: "Determination",
  speed: "Speed",
  dexterity: "Dexterity",
  charisma: "Charisma",
  will: "Will",
  spirit: "Spirit",
  torment: "Torment",
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAttributeValue(player: Player, attribute: PlayerGeneratorAttributeName) {
  const value = player.attributeSheetStats?.[attribute];
  return isFiniteNumber(value) ? value : null;
}

export function getProgressionRatingTier(value: number | null): PlayerProgressionRatingTier {
  if (!isFiniteNumber(value)) return "F";
  if (value >= 99) return "99";
  if (value >= 90) return "S+";
  if (value >= 80) return "S";
  if (value >= 70) return "A";
  if (value >= 60) return "B";
  if (value >= 45) return "C";
  if (value >= 30) return "D";
  if (value >= 15) return "E";
  return "F";
}

function normalizePreviewFacilities(facilities: SeasonEndFacilityPreviewInput): TeamFacilityCollection {
  if (facilities.teamFacilities) {
    return facilities.teamFacilities;
  }

  return {
    facilities: {
      training_center: {
        level: facilities.trainingCenterLevel ?? 0,
        enabled: (facilities.trainingCenterLevel ?? 0) > 0,
      },
      recovery_center: {
        level: facilities.recoveryCenterLevel ?? 0,
        enabled: (facilities.recoveryCenterLevel ?? 0) > 0,
      },
      scouting_office: {
        level: facilities.scoutingOfficeLevel ?? 0,
        enabled: (facilities.scoutingOfficeLevel ?? 0) > 0,
      },
      analytics_room: {
        level: facilities.analyticsRoomLevel ?? 0,
        enabled: (facilities.analyticsRoomLevel ?? 0) > 0,
      },
      fan_shop: { level: 0, enabled: false },
      arena_upgrade: { level: 0, enabled: false },
      academy: {
        level: facilities.academyLevel ?? 0,
        enabled: (facilities.academyLevel ?? 0) > 0,
      },
      specialist_wing: {
        level: facilities.specialistWingLevel ?? 0,
        enabled: (facilities.specialistWingLevel ?? 0) > 0,
        activeVariant: facilities.specialistWingVariant ?? "power_gym",
      },
    },
  };
}

export function getSeasonEndUpgradeCost(input: {
  tier: PlayerProgressionRatingTier;
  attribute: PlayerGeneratorAttributeName;
  facilities: SeasonEndFacilityPreviewInput;
}) {
  const baseCost = PLAYER_PROGRESSION_XP_CONSTANTS.ratingTierUpgradeCost[input.tier];
  if (baseCost == null) {
    return {
      costBeforeFacility: null,
      costAfterFacility: null,
      facilityDiscountPct: 0,
      appliedEffects: ["attribute_at_99_blocks_cost"],
    };
  }

  const modified = applyUpgradeCostFacilityModifiers(input.attribute, input.tier, baseCost, normalizePreviewFacilities(input.facilities));

  return {
    costBeforeFacility: baseCost,
    costAfterFacility: modified.costAfterFacility,
    facilityDiscountPct: modified.facilityDiscountPct,
    appliedEffects: modified.appliedEffects,
  };
}

function toGeneratorAttributes(player: Player, override?: { attribute: PlayerGeneratorAttributeName; value: number }): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  const attributes = {
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
  if (!Object.values(attributes).every((value) => isFiniteNumber(value))) {
    return null;
  }
  const normalized = attributes as PlayerGeneratorAttributes;
  if (override) {
    normalized[override.attribute] = override.value;
  }
  return normalized;
}

function calculateDisciplineValueFromAttributes(attributes: PlayerGeneratorAttributes, disciplineId: OfficialDisciplineWeightId) {
  const weighted = Object.entries(officialDisciplineWeightTable).reduce((sum, [attribute, weights]) => {
    return sum + attributes[attribute as PlayerGeneratorAttributeName] * weights[disciplineId];
  }, 0);
  const weightSum = Object.values(officialDisciplineWeightTable).reduce((sum, weights) => sum + weights[disciplineId], 0);
  return weightSum > 0 ? roundValue(clamp(weighted / weightSum, 1, 99), 2) : null;
}

export function buildPreviewDisciplineRatingsFromAttributes(input: {
  player: Player;
  attributesAfter: PlayerGeneratorAttributes | null;
}) {
  if (!input.attributesAfter) {
    return input.player.disciplineRatings ?? {};
  }

  const nextRatings = { ...(input.player.disciplineRatings ?? {}) };
  for (const disciplineId of officialDisciplineWeightOrder) {
    const next = calculateDisciplineValueFromAttributes(input.attributesAfter, disciplineId);
    if (next != null && Object.prototype.hasOwnProperty.call(nextRatings, disciplineId)) {
      nextRatings[disciplineId] = next;
    }
  }
  return nextRatings;
}

export function buildPreviewDisciplineRatings(input: {
  player: Player;
  attribute: PlayerGeneratorAttributeName;
  attributeAfter: number | null;
}) {
  const attributesAfter =
    input.attributeAfter == null ? null : toGeneratorAttributes(input.player, { attribute: input.attribute, value: input.attributeAfter });
  return buildPreviewDisciplineRatingsFromAttributes({ player: input.player, attributesAfter });
}

export function buildSeasonEndDisciplineDeltas(input: {
  disciplines: GameState["disciplines"];
  lastSeasonDisciplineValues?: Record<string, number> | null;
  currentDisciplineValues?: Record<string, number> | null;
}) {
  const last = input.lastSeasonDisciplineValues ?? {};
  const current = input.currentDisciplineValues ?? {};
  const disciplineIds = [...new Set([...input.disciplines.map((entry) => entry.id), ...Object.keys(last), ...Object.keys(current)])];
  return disciplineIds
    .map((disciplineId) => {
      const before = last[disciplineId] ?? null;
      const after = current[disciplineId] ?? null;
      return {
        disciplineId,
        label:
          input.disciplines.find((entry) => entry.id === disciplineId)?.name ??
          officialDisciplineWeightLabels[disciplineId as OfficialDisciplineWeightId] ??
          disciplineId,
        lastSeasonDisciplineValues: before,
        currentDisciplineValues: after,
        disciplineDelta: before != null && after != null ? Math.max(0, roundValue(after - before, 2)) : null,
      } satisfies SeasonEndProgressionDisciplineDelta;
    })
    .sort((left, right) => (right.disciplineDelta ?? 0) - (left.disciplineDelta ?? 0) || left.label.localeCompare(right.label, "de"));
}

export function buildCoreStatsFromDisciplineRatings(input: {
  disciplines: GameState["disciplines"];
  disciplineRatings: Record<string, number>;
  fallback: Player["coreStats"];
}): Player["coreStats"] {
  const axisByCategory = {
    power: "pow",
    speed: "spe",
    mental: "men",
    social: "soc",
  } as const;
  const next = { ...input.fallback };
  for (const [category, axis] of Object.entries(axisByCategory) as Array<[keyof typeof axisByCategory, (typeof axisByCategory)[keyof typeof axisByCategory]]>) {
    const values = input.disciplines
      .filter((discipline) => discipline.category === category)
      .map((discipline) => input.disciplineRatings[discipline.id])
      .filter(isFiniteNumber);
    if (values.length > 0) {
      next[axis] = roundValue(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
    }
  }
  return next;
}

function getWarningLevel(deltaPct: number | null) {
  const abs = Math.abs(deltaPct ?? 0);
  if (abs > 90) return "gt_90_pct";
  if (abs > 50) return "gt_50_pct";
  if (abs > 25) return "gt_25_pct";
  return "none";
}

function maxWarningLevel(left: SeasonEndProgressionEconomyAudit["warningLevel"], right: SeasonEndProgressionEconomyAudit["warningLevel"]) {
  const order = ["none", "gt_25_pct", "gt_50_pct", "gt_90_pct"];
  return order.indexOf(right) > order.indexOf(left) ? right : left;
}

function buildProgressionBracket(value: number | null | undefined, fallback?: string | null) {
  if (fallback) return fallback;
  return isFiniteNumber(value) ? getProgressionRatingTier(value) : null;
}

function buildEconomyWarningGroups(input: {
  warningLevel: SeasonEndProgressionEconomyAudit["warningLevel"];
  beforeRow: ReturnType<typeof buildPlayerEconomyCompareReport>["players"][number] | null;
  renewalSalaryPreview: number | null;
  currentSalary: number | null;
}) {
  const marketValueWarnings = [
    input.warningLevel !== "none" ? "market_value_delta_high" : null,
    input.beforeRow?.calculatedMarketValue == null ? "market_value_formula_missing" : null,
    (input.beforeRow?.missingSources ?? []).length > 0 || (input.beforeRow?.economyWarnings ?? []).length > 0 ? "market_value_source_mismatch" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const renewalSalaryDeltaPct =
    input.renewalSalaryPreview != null && input.currentSalary != null && input.currentSalary !== 0
      ? Math.abs(((input.renewalSalaryPreview - input.currentSalary) / input.currentSalary) * 100)
      : null;
  const salaryWarnings = [
    renewalSalaryDeltaPct != null && renewalSalaryDeltaPct > 25 ? "salary_expectation_high" : null,
    input.beforeRow?.calculatedSalary == null ? "salary_source_mismatch" : null,
    (input.beforeRow?.missingSources ?? []).length > 0 || (input.beforeRow?.economyWarnings ?? []).length > 0 ? "salary_source_mismatch" : null,
    "contract_salary_locked",
    "renewal_salary_preview_only",
  ].filter((entry): entry is string => Boolean(entry));

  return {
    marketValueWarnings: [...new Set(marketValueWarnings)],
    salaryWarnings: [...new Set(salaryWarnings)],
  };
}

function buildEconomyAudit(input: {
  gameState: GameState;
  player: Player;
  previewPlayer: Player;
  context: EconomyPreviewContext;
  shouldBuildAfterPreview: boolean;
}) {
  const rosterEntry = input.context.rosterByPlayerId.get(input.player.id) ?? null;
  const economy = resolvePlayerEconomyContract({ playerId: input.player.id, player: input.player, rosterEntry });
  const beforeRow = input.context.beforeRowsByPlayerId.get(input.player.id) ?? null;
  const previewGameState: GameState | null = input.shouldBuildAfterPreview
    ? {
        ...input.gameState,
        players: input.gameState.players.map((entry) => (entry.id === input.player.id ? input.previewPlayer : entry)),
      }
    : null;
  const afterReport = previewGameState
    ? buildPlayerEconomyCompareReport({
        gameState: previewGameState,
        salaryMarketValueOverridesByPlayerId: input.context.salaryMarketValueOverridesByPlayerId,
        baseMarketValueOverridesByPlayerId: input.context.baseMarketValueOverridesByPlayerId,
      })
    : input.context.beforeReport;
  const afterRow = previewGameState ? afterReport.players.find((entry) => entry.playerId === input.player.id) ?? null : beforeRow;
  const beforeRating = input.context.beforeRatings.get(input.player.id) ?? null;
  const afterRating = previewGameState ? buildPlayerRatingContractMap(previewGameState).get(input.player.id) ?? null : beforeRating;
  const marketValueDeltaAbs =
    beforeRow?.calculatedMarketValue != null && economy.marketValue != null ? roundValue(beforeRow.calculatedMarketValue - economy.marketValue, 2) : null;
  const marketValueDeltaPct =
    marketValueDeltaAbs != null && economy.marketValue != null && economy.marketValue !== 0
      ? roundValue((marketValueDeltaAbs / economy.marketValue) * 100, 2)
      : null;
  const salaryDeltaAbs =
    beforeRow?.calculatedSalary != null && economy.salary != null ? roundValue(beforeRow.calculatedSalary - economy.salary, 2) : null;
  const salaryDeltaPct =
    salaryDeltaAbs != null && economy.salary != null && economy.salary !== 0 ? roundValue((salaryDeltaAbs / economy.salary) * 100, 2) : null;
  const warningLevel = maxWarningLevel(getWarningLevel(marketValueDeltaPct), getWarningLevel(salaryDeltaPct));
  const renewalSalaryPreview = afterRow?.calculatedSalary ?? beforeRow?.calculatedSalary ?? null;
  const warningGroups = buildEconomyWarningGroups({
    warningLevel,
    beforeRow,
    renewalSalaryPreview,
    currentSalary: rosterEntry?.salary ?? economy.salary,
  });
  const warnings = [
    warningLevel !== "none" ? `economy_deviation_${warningLevel}` : null,
    ...warningGroups.marketValueWarnings,
    ...warningGroups.salaryWarnings,
    ...(beforeRow?.missingSources ?? []),
    ...(beforeRow?.economyWarnings ?? []),
  ].filter((entry): entry is string => Boolean(entry));

  return {
    importedMarketValue: input.player.marketValue ?? null,
    calculatedMarketValue: beforeRow?.calculatedMarketValue ?? null,
    displayedMarketValue: economy.marketValue,
    previewMarketValueAfterUpgrade: afterRow?.calculatedMarketValue ?? beforeRow?.calculatedMarketValue ?? null,
    marketValueAfterUpgradePreview: afterRow?.calculatedMarketValue ?? beforeRow?.calculatedMarketValue ?? null,
    importedSalary: input.player.salaryDemand ?? null,
    calculatedSalary: beforeRow?.calculatedSalary ?? null,
    displayedSalary: economy.salary,
    buySellModalSalary: rosterEntry?.salary ?? economy.salary,
    previewSalaryAfterUpgrade: renewalSalaryPreview,
    currentContractSalary: rosterEntry?.salary ?? economy.salary,
    renewalSalaryPreview,
    salaryExpectation: renewalSalaryPreview,
    ovrBefore: beforeRating?.ovrNormalized ?? input.player.ovr ?? input.player.rating ?? null,
    ovrAfterPreview: afterRating?.ovrNormalized ?? input.previewPlayer.ovr ?? input.previewPlayer.rating ?? null,
    mvsBefore: beforeRating?.mvs ?? null,
    mvsAfterPreview: beforeRating?.mvs ?? null,
    bracketBefore: buildProgressionBracket(beforeRating?.ovrNormalized ?? input.player.ovr ?? input.player.rating ?? null, input.player.bracketLabel),
    bracketAfterPreview: buildProgressionBracket(afterRating?.ovrNormalized ?? input.previewPlayer.ovr ?? input.previewPlayer.rating ?? null, input.player.bracketLabel),
    marketValueDeltaAbs,
    marketValueDeltaPct,
    salaryDeltaAbs,
    salaryDeltaPct,
    warningLevel,
    marketValueWarnings: warningGroups.marketValueWarnings,
    salaryWarnings: warningGroups.salaryWarnings,
    warnings: [...new Set(warnings)],
  } satisfies SeasonEndProgressionEconomyAudit;
}

export function buildSeasonEndProgressionPreview(input: {
  gameState: GameState;
  teamId?: string | null;
  forecastsByPlayerId: Map<string, PlayerProgressionForecast>;
  organicByPlayerId?: Map<string, OrganicSeasonProgressionResult>;
  upgradeRequests?: SeasonEndProgressionUpgradeRequest[];
  facilities?: SeasonEndFacilityPreviewInput;
}) {
  const facilities = input.facilities ?? {};
  const normalizedFacilities = normalizePreviewFacilities(facilities);
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team] as const));
  const beforeReport = buildPlayerEconomyCompareReport({ gameState: input.gameState });
  const economyContext: EconomyPreviewContext = {
    beforeReport,
    beforeRowsByPlayerId: new Map(beforeReport.players.map((row) => [row.playerId, row] as const)),
    beforeRatings: buildPlayerRatingContractMap(input.gameState),
    rosterByPlayerId: new Map(input.gameState.rosters.map((entry) => [entry.playerId, entry] as const)),
    salaryMarketValueOverridesByPlayerId: new Map(
      beforeReport.players
        .filter((row) => row.calculationBreakdown.salaryMarketValue != null)
        .map((row) => [row.playerId, row.calculationBreakdown.salaryMarketValue as number] as const),
    ),
    baseMarketValueOverridesByPlayerId: new Map(
      beforeReport.players
        .filter((row) => row.calculationBreakdown.baseMarketValue != null)
        .map((row) => [row.playerId, row.calculationBreakdown.baseMarketValue as number] as const),
    ),
  };
  const rosterRows = input.gameState.rosters
    .filter((entry) => (input.teamId ? entry.teamId === input.teamId : true))
    .map((entry) => ({
      rosterEntry: entry,
      player: playerById.get(entry.playerId) ?? null,
      team: teamById.get(entry.teamId) ?? null,
    }))
    .filter((entry): entry is { rosterEntry: GameState["rosters"][number]; player: Player; team: GameState["teams"][number] | null } =>
      Boolean(entry.player),
    );
  const requestByPlayerId = new Map((input.upgradeRequests ?? []).map((request) => [request.playerId, request] as const));
  const rows: SeasonEndProgressionPreviewRow[] = rosterRows.map(({ player, team }) => {
    const forecast = input.forecastsByPlayerId.get(player.id);
    const organic = input.organicByPlayerId?.get(player.id) ?? null;
    const request = requestByPlayerId.get(player.id);
    const selectedAttribute = request?.attribute ?? "power";
    const attributeBefore = getAttributeValue(player, selectedAttribute);
    const tierBefore = getProgressionRatingTier(attributeBefore);
    const steps = Math.max(1, Math.round(request?.steps ?? 1));
    const attributeAfter = attributeBefore == null ? null : clamp(attributeBefore + steps, 1, 99);
    const tierAfter = getProgressionRatingTier(attributeAfter);
    const baseTrainingXP = forecast?.baseTrainingXP ?? 0;
    const performanceXP = forecast?.performanceXP ?? 0;
    const trainingFacilityXp = applyTrainingXpFacilityModifiers(baseTrainingXP, normalizedFacilities, {
      developmentTrainingBonusPct: team ? getTeamDevelopmentTrainingBonusPct(input.gameState, team.teamId) : 0,
    });
    const facilityTrainingDelta = trainingFacilityXp.after - trainingFacilityXp.before;
    const spendableDevelopmentXP = Math.max(0, (forecast?.netDevelopmentXP ?? 0) + facilityTrainingDelta);
    const cost = getSeasonEndUpgradeCost({ tier: tierBefore, attribute: selectedAttribute, facilities });
    const legacyAvailableXP = spendableDevelopmentXP;
    const availableXP = legacyAvailableXP;
    const blockReason =
      attributeBefore == null
        ? "attribute_source_missing"
        : attributeBefore >= 99
          ? "attribute_at_99"
          : cost.costAfterFacility == null
            ? "upgrade_cost_unavailable"
            : availableXP < cost.costAfterFacility
              ? "xp_insufficient"
              : null;
    const shouldBuildAfterPreview = blockReason == null;
    const baselineAttributes = toGeneratorAttributes(player);
    const baselineDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
      player,
      attributesAfter: baselineAttributes,
    });
    const previewDisciplineRatings = buildPreviewDisciplineRatings({ player, attribute: selectedAttribute, attributeAfter });
    const disciplineDeltas = buildSeasonEndDisciplineDeltas({
      disciplines: input.gameState.disciplines,
      lastSeasonDisciplineValues: baselineDisciplineRatings,
      currentDisciplineValues: previewDisciplineRatings,
    });
    const previewPlayer: Player = {
      ...player,
      attributeSheetStats: player.attributeSheetStats
        ? {
            ...player.attributeSheetStats,
            [selectedAttribute]: attributeAfter ?? player.attributeSheetStats[selectedAttribute],
          }
        : player.attributeSheetStats,
      coreStats: buildCoreStatsFromDisciplineRatings({
        disciplines: input.gameState.disciplines,
        disciplineRatings: previewDisciplineRatings,
        fallback: player.coreStats,
      }),
      previousDisciplineRatings: baselineDisciplineRatings,
      disciplineRatings: previewDisciplineRatings,
    };
    const economyAudit = buildEconomyAudit({
      gameState: input.gameState,
      player,
      previewPlayer,
      context: economyContext,
      shouldBuildAfterPreview,
    });

    return {
      playerId: player.id,
      playerName: player.name,
      teamId: team?.teamId ?? null,
      teamCode: team?.shortCode ?? null,
      availableXP,
      legacyAvailableXP,
      organicNetSetpoints: organic?.netSetpoints ?? 0,
      organicTrainingSetpoints: organic?.trainingSetpoints ?? 0,
      organicPerformanceSetpoints: organic?.appliedPerformanceSetpoints ?? 0,
      organicMarketValuePressureTotal: organic?.marketValuePressureTotal ?? 0,
      trainingXP: forecast?.baseTrainingXP ?? 0,
      performanceXP,
      traitModifierPct: forecast?.traitModifierPct ?? 0,
      facilityEffects: {
        xpBeforeFacility: trainingFacilityXp.before,
        facilityModifierPct: trainingFacilityXp.modifierPct,
        xpAfterFacility: trainingFacilityXp.after,
        costBeforeFacility: cost.costBeforeFacility,
        facilityDiscountPct: cost.facilityDiscountPct,
        costAfterFacility: cost.costAfterFacility,
        appliedEffects: [
          ...cost.appliedEffects,
          trainingFacilityXp.modifierPct > 0 ? `training_center_base_xp:${trainingFacilityXp.modifierPct}pct` : null,
          getAnalyticsForecastQuality(normalizedFacilities).level > 0 ? "analytics_room_forecast_accuracy_visible:no_fake_values" : null,
          getScoutingConfidence(normalizedFacilities).level > 0 ? "scouting_office_potential_info_visible:potential_source_missing" : null,
          getFacilityLevel(normalizedFacilities, "recovery_center") > 0
            ? "recovery_center_fatigue_only_no_cost_discount"
            : null,
        ].filter((entry): entry is string => Boolean(entry)),
      },
      selectedAttribute,
      attributeBefore,
      attributeAfter,
      ratingTierBefore: tierBefore,
      ratingTierAfter: tierAfter,
      upgradeCost: cost.costAfterFacility,
      remainingXP: cost.costAfterFacility == null ? availableXP : availableXP - cost.costAfterFacility,
      status: blockReason == null ? "planned" : "blocked",
      blockReason,
      disciplineDeltas,
      economyAudit,
      confirmContract: {
        action: "season_end_progression_apply",
        playerId: player.id,
        attribute: selectedAttribute,
        cost: cost.costAfterFacility,
        productiveWrites: false,
        writesPrepared: ["xp", "attributes", "discipline_snapshot", "market_value", "salary"],
        requiredConfirmToken: "SEASON_END_PROGRESSION_APPLY_CONFIRM",
      },
    };
  });
  const warnings = rows.flatMap((row) => [
    row.status === "blocked" ? `upgrade_blocked:${row.playerId}:${row.blockReason}` : null,
    row.facilityEffects.appliedEffects.some((effect) => effect.includes("potential_source_missing"))
      ? `facility_forecast:${row.playerId}:potential_source_missing`
      : null,
    row.facilityEffects.appliedEffects.some((effect) => effect.includes("no_fake_values"))
      ? `facility_forecast:${row.playerId}:no_fake_values`
      : null,
    ...row.economyAudit.warnings.map((warning) => `economy_audit:${row.playerId}:${warning}`),
  ]).filter((entry): entry is string => Boolean(entry));

  return {
    status: warnings.length > 0 ? "warning" : "ready",
    productiveWrites: false,
    rows,
    warnings: [...new Set(warnings)],
  } satisfies SeasonEndProgressionPreview;
}

export function formatSeasonEndProgressionDisciplineValue(value: number | null, delta: number | null) {
  if (value == null) {
    return "—";
  }
  return delta != null && delta > 0 ? `${value} (+${delta})` : String(value);
}

export { ATTRIBUTE_LABELS as SEASON_END_ATTRIBUTE_LABELS };
