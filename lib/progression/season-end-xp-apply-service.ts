import { createHash, randomUUID } from "node:crypto";

import type {
  GamePhase,
  GameState,
  Player,
  PlayerProgressionEconomySnapshot,
  PlayerGeneratorAttributeName,
  PlayerGeneratorAttributes,
  PlayerProgressionSpendEventRecord,
  PlayerProgressionSpendUpgradeRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { getTeamFacilityState, applyTrainingXpFacilityModifiers } from "@/lib/facilities/facility-effects";
import { getTeamDevelopmentTrainingBonusPct } from "@/lib/foundation/team-development-tendency";
import {
  buildPlayerEconomyCompareReport,
  resolveRankTableMarketValueFromCompareRow,
} from "@/lib/foundation/player-economy-compare-service";
import {
  applyRankTableMarketValuesToGameState,
  patchSeasonProgressionEventMarketValues,
} from "@/lib/player-formulas/market-value-apply";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildPlayerDevelopmentLevelupModel, type DevelopmentRegressionEventPreview } from "@/lib/training/training-levelup-service";
import { buildOrganicSeasonProgression, type OrganicSeasonProgressionResult } from "@/lib/training/organic-season-progression";
import {
  buildCoreStatsFromDisciplineRatings,
  buildPreviewDisciplineRatingsFromAttributes,
  buildSeasonEndDisciplineDeltas,
  getProgressionRatingTier,
  getSeasonEndUpgradeCost,
  type SeasonEndProgressionDisciplineDelta,
  type SeasonEndProgressionEconomyAudit,
} from "@/lib/training/season-end-progression-preview";

export type SeasonEndXpSpendPlannedUpgradeInput = {
  playerId: string;
  attribute: PlayerGeneratorAttributeName;
  fromValue?: number | null;
  toValue?: number | null;
  cost?: number | null;
  source?: "manual_xp_spend_preview";
};

export type SeasonEndXpSpendPreviewPlayer = {
  playerId: string;
  playerName: string;
  teamId: string;
  availableXP: number;
  earnedSeasonXP: number;
  currentXPBefore: number;
  plannedXP: number;
  remainingXP: number;
  spentXPBefore: number;
  lifetimeXP: number | null;
  lifetimeXPAfter: number | null;
  plannedUpgrades: PlayerProgressionSpendUpgradeRecord[];
  attributeValuesBefore: Partial<Record<PlayerGeneratorAttributeName, number>>;
  attributeValuesAfter: Partial<Record<PlayerGeneratorAttributeName, number>>;
  disciplineDeltas: SeasonEndProgressionDisciplineDelta[];
  economyAudit: SeasonEndProgressionEconomyAudit;
  progressionSnapshotBefore: PlayerProgressionEconomySnapshot;
  progressionSnapshotAfter: PlayerProgressionEconomySnapshot & {
    marketValuePreview: number | null;
    salaryPreview: number | null;
    bracketPreview: string | null;
  };
  organicProgression: OrganicSeasonProgressionResult | null;
  blockers: string[];
  warnings: string[];
};

export type SeasonEndXpSpendPreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  team: { teamId: string; shortCode: string; name: string; humanControlled: boolean } | null;
  saveContext: {
    saveId: string;
    seasonId: string;
    gamePhase: GamePhase;
    saveStatus: string;
  };
  plannedUpgrades: PlayerProgressionSpendUpgradeRecord[];
  players: SeasonEndXpSpendPreviewPlayer[];
  totals: {
    plannedUpgradeCount: number;
    xpAvailable: number;
    xpPlanned: number;
    xpRemaining: number;
  };
  warnings: string[];
  blockingReasons: string[];
};

export type SeasonEndXpSpendApplyResult = Omit<SeasonEndXpSpendPreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  eventIds: string[];
};

export type SeasonEndXpSpendApplyOptions = {
  allowAiTeams?: boolean;
  skipAfterEconomyAudit?: boolean;
  deferLeagueWideMarketValueRecalc?: boolean;
};

export type SeasonEndXpAvailabilityPlayer = {
  playerId: string;
  availableXP: number;
  earnedSeasonXP: number;
  currentXPBefore: number;
  lifetimeXP: number | null;
  lifetimeXPAfter: number | null;
  warnings: string[];
};

export type SeasonEndXpAvailabilityPreview = {
  teamId: string;
  players: SeasonEndXpAvailabilityPlayer[];
  warnings: string[];
  blockingReasons: string[];
};

export type EconomyPreviewContext = {
  beforeReport: ReturnType<typeof buildPlayerEconomyCompareReport>;
  beforeRowsByPlayerId: Map<string, ReturnType<typeof buildPlayerEconomyCompareReport>["players"][number]>;
  beforeRatings: ReturnType<typeof buildPlayerRatingContractMap>;
  rosterByPlayerId: Map<string, GameState["rosters"][number]>;
};

/**
 * Pre-computed per-player season XP data derived from the initial (unmodified) gameState.
 * Passed through the call chain to avoid re-running expensive per-player computations
 * (buildPlayerProgressionForecast, buildOrganicSeasonProgression) on each team iteration
 * when the cloned gameState invalidates WeakMap caches.
 */
export type PreComputedSeasonXpEntry = {
  earnedSeasonXP: number;
  trainingXPAfterFacilities: number;
  performanceXP: number;
  forecast: ReturnType<typeof buildPlayerProgressionForecast> | null;
  regressionEvent: DevelopmentRegressionEventPreview | null;
  warnings: string[];
  organicProgression: OrganicSeasonProgressionResult | null;
  /** Season appearance count, pre-computed from the initial gameState to avoid per-team cache rebuilds. */
  appearances: number | null;
};

const economyPreviewContextCache = new WeakMap<GameState, EconomyPreviewContext>();
const playerRatingContextCache = new WeakMap<GameState, ReturnType<typeof buildPlayerRatingContractMap>>();

const ATTRIBUTE_KEYS: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

const APPLY_PHASES = new Set<GamePhase>([
  "season_completed",
  "season_review",
  "season_rewards",
  "player_development",
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
]);

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveGamePhase(gameState: GameState): GamePhase {
  const seasonCompleted = (gameState.season as { isCompleted?: boolean }).isCompleted === true;
  return gameState.gamePhase ?? (seasonCompleted ? "season_completed" : "season_active");
}

function normalizeAttributes(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  const values = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, stats[key]])) as Partial<Record<PlayerGeneratorAttributeName, number | null>>;
  if (!ATTRIBUTE_KEYS.every((key) => isFiniteNumber(values[key]))) {
    return null;
  }
  return values as PlayerGeneratorAttributes;
}

function getTeamFacilities(gameState: GameState, teamId: string): TeamFacilityCollection {
  return getTeamFacilityState(gameState, teamId);
}

function getPlayerRatingContext(gameState: GameState) {
  const cached = playerRatingContextCache.get(gameState);
  if (cached) return cached;
  const ratings = buildPlayerRatingContractMap(gameState);
  playerRatingContextCache.set(gameState, ratings);
  return ratings;
}

function getEconomyPreviewContext(gameState: GameState): EconomyPreviewContext {
  const cached = economyPreviewContextCache.get(gameState);
  if (cached) return cached;
  const beforeReport = buildPlayerEconomyCompareReport({ gameState });
  const context: EconomyPreviewContext = {
    beforeReport,
    beforeRowsByPlayerId: new Map(beforeReport.players.map((row) => [row.playerId, row] as const)),
    beforeRatings: getPlayerRatingContext(gameState),
    rosterByPlayerId: new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const)),
  };
  economyPreviewContextCache.set(gameState, context);
  return context;
}

export function buildEconomyPreviewContext(gameState: GameState): EconomyPreviewContext {
  return getEconomyPreviewContext(gameState);
}

/**
 * Pre-computes per-player season XP and organic progression for all rostered players
 * using the provided save's gameState. Call this ONCE before the team loop and pass the
 * resulting map into preview/apply functions to skip O(n²) re-computation caused by
 * WeakMap cache misses when the gameState is cloned on each iteration.
 */
export function buildPreComputedSeasonXpMap(save: PersistedSaveGame): Map<string, PreComputedSeasonXpEntry> {
  const gameState = save.gameState;
  const result = new Map<string, PreComputedSeasonXpEntry>();
  const playerById = new Map(gameState.players.map((p) => [p.id, p] as const));
  const facilitiesByTeamId = new Map<string, TeamFacilityCollection>();
  const ratings = getPlayerRatingContext(gameState);

  for (const rosterEntry of gameState.rosters) {
    if (result.has(rosterEntry.playerId)) continue;
    const player = playerById.get(rosterEntry.playerId);
    if (!player) continue;

    if (!facilitiesByTeamId.has(rosterEntry.teamId)) {
      facilitiesByTeamId.set(rosterEntry.teamId, getTeamFacilities(gameState, rosterEntry.teamId));
    }
    const facilities = facilitiesByTeamId.get(rosterEntry.teamId)!;

    const seasonXp = getSeasonXp({ save, player, teamId: rosterEntry.teamId, facilities, playerRating: ratings.get(player.id) ?? null });
    const organicProgression = buildOrganicSeasonProgression({ gameState, player, facilities });
    const seasonPerf = buildPlayerSeasonPerformance(gameState, player.id);

    result.set(player.id, { ...seasonXp, organicProgression, appearances: seasonPerf?.appearances ?? null });
  }

  return result;
}

function getLifetimeXPBefore(player: Player) {
  if (isFiniteNumber(player.lifetimeXP)) return Math.max(0, Math.round(player.lifetimeXP));
  const currentXP = Math.max(0, Math.round(player.currentXP ?? 0));
  const spentXP = Math.max(0, Math.round(player.spentXP ?? 0));
  if (currentXP > 0 || spentXP > 0) return currentXP + spentXP;
  return null;
}

function getSeasonXp(input: {
  save: PersistedSaveGame;
  player: Player;
  teamId: string;
  facilities: TeamFacilityCollection;
  playerRating: ReturnType<typeof buildPlayerRatingContractMap> extends Map<string, infer Row> ? Row | null : never;
}) {
  const gameState = input.save.gameState;
  const alreadyMaterialized = (gameState.playerProgressionEvents ?? []).some(
    (event) => event.seasonId === gameState.season.id && event.playerId === input.player.id,
  );
  if (alreadyMaterialized) {
    return {
      earnedSeasonXP: 0,
      trainingXPAfterFacilities: 0,
      performanceXP: 0,
      forecast: null,
      regressionEvent: null,
      warnings: ["season_xp_already_materialized"],
    };
  }

  const seasonPerformance = buildPlayerSeasonPerformance(gameState, input.player.id);
  const forecast = buildPlayerProgressionForecast({
    gameState,
    player: input.player,
    playerRating: input.playerRating,
    seasonPerformance,
    trainingModeByPlayerId: input.player.trainingMode ? { [input.player.id]: input.player.trainingMode } : null,
    currentXP: input.player.currentXP ?? 0,
    spentXP: input.player.spentXP ?? 0,
    lifetimeXP: input.player.lifetimeXP ?? null,
  });
  const trainingFacilityXp = applyTrainingXpFacilityModifiers(forecast.baseTrainingXP, input.facilities, {
    developmentTrainingBonusPct: getTeamDevelopmentTrainingBonusPct(gameState, input.teamId),
  });
  const facilityTrainingDelta = trainingFacilityXp.after - trainingFacilityXp.before;
  const earnedSeasonXP = Math.max(0, forecast.netDevelopmentXP + facilityTrainingDelta);
  const development = buildPlayerDevelopmentLevelupModel({
    gameState,
    player: input.player,
    forecast,
    potentialRecord: gameState.playerPotential?.find((entry) => entry.playerId === input.player.id) ?? null,
  });
  return {
    earnedSeasonXP,
    trainingXPAfterFacilities: trainingFacilityXp.after,
    performanceXP: forecast.performanceXP,
    forecast,
    regressionEvent: development.regressionEvent,
    warnings: forecast.audit.warnings,
  };
}

function buildEconomyAudit(input: {
  gameState: GameState;
  player: Player;
  previewPlayer: Player;
  context: EconomyPreviewContext;
  hasAttributeChanges: boolean;
}): SeasonEndProgressionEconomyAudit {
  const beforeReport = input.context.beforeReport;
  const beforeRow = input.context.beforeRowsByPlayerId.get(input.player.id) ?? null;
  const afterReport = input.hasAttributeChanges
    ? buildPlayerEconomyCompareReport({
        gameState: input.gameState,
        playerOverridesById: new Map([[input.previewPlayer.id, input.previewPlayer]]),
        playerIds: [input.previewPlayer.id],
        includeSummary: false,
      })
    : beforeReport;
  const afterRow = afterReport.players.find((entry) => entry.playerId === input.player.id) ?? null;
  const rosterEntry = input.context.rosterByPlayerId.get(input.player.id) ?? null;
  const beforeRating = input.context.beforeRatings.get(input.player.id) ?? null;
  const rankTableMarketValueBefore = resolveRankTableMarketValueFromCompareRow(beforeRow);
  const rankTableMarketValueAfter = input.hasAttributeChanges
    ? resolveRankTableMarketValueFromCompareRow(afterRow)
    : rankTableMarketValueBefore;
  const afterRating = input.hasAttributeChanges
    ? beforeRating
      ? { ...beforeRating, ovrNormalized: afterRow?.ovr ?? beforeRating.ovrNormalized ?? null }
      : null
    : beforeRating;
  const marketValueDeltaAbs =
    beforeRow?.calculatedMarketValue != null && input.player.marketValue != null
      ? roundValue(beforeRow.calculatedMarketValue - input.player.marketValue, 2)
      : null;
  const marketValueDeltaPct =
    marketValueDeltaAbs != null && input.player.marketValue ? roundValue((marketValueDeltaAbs / input.player.marketValue) * 100, 2) : null;
  const salaryDeltaAbs =
    beforeRow?.calculatedSalary != null && input.player.salaryDemand != null
      ? roundValue(beforeRow.calculatedSalary - input.player.salaryDemand, 2)
      : null;
  const salaryDeltaPct =
    salaryDeltaAbs != null && input.player.salaryDemand ? roundValue((salaryDeltaAbs / input.player.salaryDemand) * 100, 2) : null;
  const warningAbs = Math.max(Math.abs(marketValueDeltaPct ?? 0), Math.abs(salaryDeltaPct ?? 0));
  const warningLevel = warningAbs > 90 ? "gt_90_pct" : warningAbs > 50 ? "gt_50_pct" : warningAbs > 25 ? "gt_25_pct" : "none";
  const renewalSalaryPreview = afterRow?.calculatedSalary ?? beforeRow?.calculatedSalary ?? null;
  const marketValueWarnings = [
    warningLevel !== "none" ? "market_value_delta_high" : null,
    beforeRow?.calculatedMarketValue == null ? "market_value_formula_missing" : null,
    (beforeRow?.missingSources ?? []).length > 0 || (beforeRow?.economyWarnings ?? []).length > 0 ? "market_value_source_mismatch" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const renewalSalaryDeltaPct =
    renewalSalaryPreview != null && (rosterEntry?.salary ?? input.player.salaryDemand ?? null) != null && (rosterEntry?.salary ?? input.player.salaryDemand ?? 0) !== 0
      ? Math.abs(((renewalSalaryPreview - (rosterEntry?.salary ?? input.player.salaryDemand ?? 0)) / (rosterEntry?.salary ?? input.player.salaryDemand ?? 1)) * 100)
      : null;
  const salaryWarnings = [
    renewalSalaryDeltaPct != null && renewalSalaryDeltaPct > 25 ? "salary_expectation_high" : null,
    beforeRow?.calculatedSalary == null ? "salary_source_mismatch" : null,
    (beforeRow?.missingSources ?? []).length > 0 || (beforeRow?.economyWarnings ?? []).length > 0 ? "salary_source_mismatch" : null,
    "contract_salary_locked",
    "renewal_salary_preview_only",
  ].filter((entry): entry is string => Boolean(entry));
  const warnings = [
    warningLevel !== "none" ? `economy_deviation_${warningLevel}` : null,
    ...marketValueWarnings,
    ...salaryWarnings,
    ...(beforeRow?.missingSources ?? []),
    ...(beforeRow?.economyWarnings ?? []),
  ].filter((entry): entry is string => Boolean(entry));

  return {
    importedMarketValue: input.player.marketValue ?? null,
    calculatedMarketValue: rankTableMarketValueBefore ?? beforeRow?.calculatedMarketValue ?? null,
    displayedMarketValue: input.player.displayMarketValue ?? input.player.marketValue ?? null,
    previewMarketValueAfterUpgrade: rankTableMarketValueAfter ?? rankTableMarketValueBefore ?? beforeRow?.calculatedMarketValue ?? null,
    marketValueAfterUpgradePreview: rankTableMarketValueAfter ?? rankTableMarketValueBefore ?? beforeRow?.calculatedMarketValue ?? null,
    importedSalary: input.player.salaryDemand ?? null,
    calculatedSalary: beforeRow?.calculatedSalary ?? null,
    displayedSalary: input.player.displaySalary ?? input.player.salaryDemand ?? null,
    buySellModalSalary: rosterEntry?.salary ?? input.player.salaryDemand ?? null,
    previewSalaryAfterUpgrade: renewalSalaryPreview,
    currentContractSalary: rosterEntry?.salary ?? input.player.salaryDemand ?? null,
    renewalSalaryPreview,
    salaryExpectation: renewalSalaryPreview,
    ovrBefore: beforeRating?.ovrNormalized ?? input.player.ovr ?? input.player.rating ?? null,
    ovrAfterPreview: afterRating?.ovrNormalized ?? input.previewPlayer.ovr ?? input.previewPlayer.rating ?? null,
    mvsBefore: beforeRating?.mvs ?? null,
    mvsAfterPreview: beforeRating?.mvs ?? null,
    bracketBefore: input.player.bracketLabel ?? getProgressionRatingTier(beforeRating?.ovrNormalized ?? input.player.ovr ?? input.player.rating ?? null),
    bracketAfterPreview: input.player.bracketLabel ?? getProgressionRatingTier(afterRating?.ovrNormalized ?? input.previewPlayer.ovr ?? input.previewPlayer.rating ?? null),
    marketValueDeltaAbs,
    marketValueDeltaPct,
    salaryDeltaAbs,
    salaryDeltaPct,
    warningLevel,
    marketValueWarnings: [...new Set(marketValueWarnings)],
    salaryWarnings: [...new Set(salaryWarnings)],
    warnings: [...new Set(warnings)],
  };
}

function buildProgressionSnapshot(input: {
  player: Player;
  attributes: Partial<Record<PlayerGeneratorAttributeName, number>>;
  disciplineRatings: Record<string, number>;
  ovr: number | null;
  mvs: number | null;
  marketValue: number | null;
  salary: number | null;
  bracket: string | null;
}): PlayerProgressionEconomySnapshot {
  return {
    attributes: input.attributes,
    disciplineRatings: input.disciplineRatings,
    ovr: input.ovr,
    mvs: input.mvs,
    marketValue: input.marketValue,
    salary: input.salary,
    bracket: input.bracket,
  };
}

function buildConfirmToken(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  plannedUpgrades: PlayerProgressionSpendUpgradeRecord[];
  xpBeforeByPlayer: Record<string, number>;
  attributeValuesBeforeByPlayer: Record<string, Partial<Record<PlayerGeneratorAttributeName, number>>>;
}) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function summarizeOrganicProgression(progress: OrganicSeasonProgressionResult | null) {
  if (!progress) return null;
  const sorted = [...progress.attributeBreakdown].sort((left, right) => right.delta - left.delta);
  return {
    seasonId: progress.seasonId,
    classBefore: progress.classBefore,
    classAfter: progress.classAfter,
    trainingClass: progress.primaryTrainingClass,
    secondaryTrainingClass: progress.secondaryTrainingClass,
    trainingMode: progress.trainingMode,
    traitModifierPct: progress.traitModifierPct,
    facilityModifierPct: progress.facilityModifierPct,
    marketValuePressureTotal: progress.marketValuePressureTotal,
    trainingSetpoints: progress.trainingSetpoints,
    performanceSetpoints: progress.appliedPerformanceSetpoints,
    appliedPerformanceSetpoints: progress.appliedPerformanceSetpoints,
    netSetpoints: progress.netSetpoints,
    fatigueLoad: progress.fatigueLoad,
    topGains: sorted.filter((entry) => entry.delta > 0).slice(0, 3).map((entry) => ({ attribute: entry.attribute, delta: entry.delta })),
    topLosses: [...progress.attributeBreakdown]
      .filter((entry) => entry.delta < 0)
      .sort((left, right) => left.delta - right.delta)
      .slice(0, 3)
      .map((entry) => ({ attribute: entry.attribute, delta: entry.delta })),
    attributeDeltas: progress.attributeDeltas,
    createdAt: new Date().toISOString(),
  };
}

function buildPreviewPlayer(input: {
  save: PersistedSaveGame;
  teamId: string;
  player: Player;
  plannedInputs: SeasonEndXpSpendPlannedUpgradeInput[];
  facilities: TeamFacilityCollection;
  economyContext: EconomyPreviewContext;
  skipAfterEconomyAudit?: boolean;
  preComputedSeasonXp?: Map<string, PreComputedSeasonXpEntry>;
}): SeasonEndXpSpendPreviewPlayer {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const attributesBefore = normalizeAttributes(input.player);
  const attributesAfter = attributesBefore ? { ...attributesBefore } : null;
  if (!attributesBefore || !attributesAfter) {
    blockers.push(`attribute_source_missing:${input.player.id}`);
  }

  const seasonXp = input.preComputedSeasonXp?.get(input.player.id) ?? getSeasonXp({
    save: input.save,
    player: input.player,
    teamId: input.teamId,
    facilities: input.facilities,
    playerRating: input.economyContext.beforeRatings.get(input.player.id) ?? null,
  });
  warnings.push(...seasonXp.warnings.map((warning) => `${input.player.id}:${warning}`));

  const currentXPBefore = Math.max(0, Math.round(input.player.currentXP ?? 0));
  const availableXP = currentXPBefore + seasonXp.earnedSeasonXP;
  const lifetimeXPBefore = getLifetimeXPBefore(input.player);
  const lifetimeXPAfter =
    lifetimeXPBefore == null && seasonXp.earnedSeasonXP <= 0
      ? null
      : Math.max(0, Math.round(lifetimeXPBefore ?? 0) + Math.round(seasonXp.earnedSeasonXP));
  let plannedXP = 0;
  const plannedUpgrades: PlayerProgressionSpendUpgradeRecord[] = [];
  const organicProgression =
    input.plannedInputs.length === 0 && attributesAfter
      ? (input.preComputedSeasonXp?.get(input.player.id)?.organicProgression ?? buildOrganicSeasonProgression({
          gameState: input.save.gameState,
          player: input.player,
          facilities: input.facilities,
        }))
      : null;
  if (organicProgression && attributesAfter) {
    for (const attribute of ATTRIBUTE_KEYS) {
      attributesAfter[attribute] = organicProgression.attributesAfter[attribute];
    }
    plannedUpgrades.push(
      ...organicProgression.attributeBreakdown
        .filter((entry) => entry.delta !== 0)
        .map((entry) => ({
          playerId: input.player.id,
          attribute: entry.attribute,
          fromValue: entry.before,
          toValue: entry.after,
          cost: 0,
          source: "organic_season_progression" as const,
        })),
    );
    warnings.push(...organicProgression.warnings.map((warning) => `${input.player.id}:${warning}`));
    if (organicProgression.classChanged) {
      warnings.push(`${input.player.id}:class_changed:${organicProgression.classBefore}->${organicProgression.classAfter}`);
    }
  }
  const regressionEvent = seasonXp.regressionEvent;
  if (!organicProgression && input.plannedInputs.length === 0 && attributesAfter && regressionEvent?.attribute && regressionEvent.delta < 0) {
    const currentValue = attributesAfter[regressionEvent.attribute];
    if (isFiniteNumber(currentValue) && currentValue > 0) {
      const toValue = Math.max(0, currentValue + regressionEvent.delta);
      attributesAfter[regressionEvent.attribute] = toValue;
      plannedUpgrades.push({
        playerId: input.player.id,
        attribute: regressionEvent.attribute,
        fromValue: currentValue,
        toValue,
        cost: 0,
        source: "season_end_regression",
      });
      warnings.push(`${input.player.id}:regression_applied:${regressionEvent.attribute}`);
    } else {
      warnings.push(`${input.player.id}:regression_blocked_attribute_floor:${regressionEvent.attribute}`);
    }
  }

  for (const upgrade of input.plannedInputs) {
    if (!attributesAfter) {
      continue;
    }
    const currentValue = attributesAfter[upgrade.attribute];
    if (!isFiniteNumber(currentValue)) {
      blockers.push(`attribute_source_missing:${input.player.id}:${upgrade.attribute}`);
      continue;
    }
    if (currentValue >= 99) {
      blockers.push(`attribute_at_99:${input.player.id}:${upgrade.attribute}`);
      continue;
    }

    const cost = getSeasonEndUpgradeCost({
      tier: getProgressionRatingTier(currentValue),
      attribute: upgrade.attribute,
      facilities: { teamFacilities: input.facilities },
    });
    if (cost.costAfterFacility == null) {
      blockers.push(`upgrade_cost_unavailable:${input.player.id}:${upgrade.attribute}`);
      continue;
    }

    const toValue = Math.min(99, currentValue + 1);
    attributesAfter[upgrade.attribute] = toValue;
    plannedXP += cost.costAfterFacility;
    plannedUpgrades.push({
      playerId: input.player.id,
      attribute: upgrade.attribute,
      fromValue: currentValue,
      toValue,
      cost: cost.costAfterFacility,
      source: "manual_xp_spend_preview",
    });
  }

  if (plannedXP > availableXP) {
    blockers.push(`xp_insufficient:${input.player.id}`);
  }

  const previewDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
    player: input.player,
    attributesAfter,
  });
  const baselineDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
    player: input.player,
    attributesAfter: attributesBefore,
  });
  const disciplineDeltas = buildSeasonEndDisciplineDeltas({
    disciplines: input.save.gameState.disciplines,
    lastSeasonDisciplineValues: baselineDisciplineRatings,
    currentDisciplineValues: previewDisciplineRatings,
  });
  const previewPlayer: Player = {
    ...input.player,
    attributeSheetStats: attributesAfter ? { ...input.player.attributeSheetStats, ...attributesAfter } : input.player.attributeSheetStats,
    className: organicProgression?.classAfter ?? input.player.className,
    coreStats: buildCoreStatsFromDisciplineRatings({
      disciplines: input.save.gameState.disciplines,
      disciplineRatings: previewDisciplineRatings,
      fallback: input.player.coreStats,
    }),
    previousDisciplineRatings: input.player.disciplineRatings,
    disciplineRatings: previewDisciplineRatings,
  };
  const economyAudit = buildEconomyAudit({
    gameState: input.save.gameState,
    player: input.player,
    previewPlayer,
    context: input.economyContext,
    hasAttributeChanges: !input.skipAfterEconomyAudit && plannedUpgrades.length > 0,
  });
  const progressionSnapshotBefore = buildProgressionSnapshot({
    player: input.player,
    attributes: attributesBefore ?? {},
    disciplineRatings: input.player.disciplineRatings ?? {},
    ovr: economyAudit.ovrBefore,
    mvs: economyAudit.mvsBefore,
    marketValue: economyAudit.displayedMarketValue,
    salary: economyAudit.currentContractSalary ?? economyAudit.displayedSalary,
    bracket: economyAudit.bracketBefore,
  });
  const progressionSnapshotAfter = {
    ...buildProgressionSnapshot({
      player: previewPlayer,
      attributes: attributesAfter ?? {},
      disciplineRatings: previewDisciplineRatings,
      ovr: economyAudit.ovrAfterPreview,
      mvs: economyAudit.mvsAfterPreview,
      marketValue: economyAudit.marketValueAfterUpgradePreview,
      salary: economyAudit.currentContractSalary ?? economyAudit.displayedSalary,
      bracket: economyAudit.bracketAfterPreview,
    }),
    marketValuePreview: economyAudit.marketValueAfterUpgradePreview,
    salaryPreview: economyAudit.renewalSalaryPreview,
    bracketPreview: economyAudit.bracketAfterPreview,
  };

  return {
    playerId: input.player.id,
    playerName: input.player.name,
    teamId: input.teamId,
    availableXP,
    earnedSeasonXP: seasonXp.earnedSeasonXP,
    currentXPBefore,
    plannedXP,
    remainingXP: availableXP - plannedXP,
    spentXPBefore: input.player.spentXP ?? 0,
    lifetimeXP: lifetimeXPBefore,
    lifetimeXPAfter,
    plannedUpgrades,
    attributeValuesBefore: attributesBefore ?? {},
    attributeValuesAfter: attributesAfter ?? {},
    disciplineDeltas,
    economyAudit,
    progressionSnapshotBefore,
    progressionSnapshotAfter,
    organicProgression,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}

export function previewSeasonEndXpAvailability(save: PersistedSaveGame, teamId: string, cachedEconomyContext?: EconomyPreviewContext, preComputedSeasonXp?: Map<string, PreComputedSeasonXpEntry>): SeasonEndXpAvailabilityPreview {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  if (!team) blockingReasons.push("team_not_found");

  const facilities = getTeamFacilities(gameState, teamId);
  const ratings = cachedEconomyContext ? cachedEconomyContext.beforeRatings : getPlayerRatingContext(gameState);
  const baselinePlayerIds = new Set((gameState.playerBaselines ?? []).map((baseline) => baseline.playerId));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rosterPlayerIds = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => entry.playerId);
  const players: SeasonEndXpAvailabilityPlayer[] = [];

  for (const playerId of rosterPlayerIds) {
    if (!baselinePlayerIds.has(playerId)) {
      blockingReasons.push(`player_baseline_missing:${playerId}`);
      continue;
    }
    const player = playerById.get(playerId) ?? null;
    if (!player) {
      blockingReasons.push(`player_not_found:${playerId}`);
      continue;
    }
    const seasonXp = preComputedSeasonXp?.get(player.id) ?? getSeasonXp({
      save,
      player,
      teamId,
      facilities,
      playerRating: ratings.get(player.id) ?? null,
    });
    const currentXPBefore = Math.max(0, Math.round(player.currentXP ?? 0));
    const lifetimeXPBefore = getLifetimeXPBefore(player);
    const lifetimeXPAfter =
      lifetimeXPBefore == null && seasonXp.earnedSeasonXP <= 0
        ? null
        : Math.max(0, Math.round(lifetimeXPBefore ?? 0) + Math.round(seasonXp.earnedSeasonXP));
    players.push({
      playerId: player.id,
      availableXP: currentXPBefore + seasonXp.earnedSeasonXP,
      earnedSeasonXP: seasonXp.earnedSeasonXP,
      currentXPBefore,
      lifetimeXP: lifetimeXPBefore,
      lifetimeXPAfter,
      warnings: seasonXp.warnings.map((warning) => `${player.id}:${warning}`),
    });
  }

  warnings.push(...players.flatMap((player) => player.warnings));
  return {
    teamId,
    players,
    warnings: [...new Set(warnings)],
    blockingReasons: [...new Set(blockingReasons)],
  };
}

export function previewSeasonEndXpSpend(
  save: PersistedSaveGame,
  teamId: string,
  plannedUpgrades: SeasonEndXpSpendPlannedUpgradeInput[],
  cachedEconomyContext?: EconomyPreviewContext,
  options?: { skipAfterEconomyAudit?: boolean },
  preComputedSeasonXp?: Map<string, PreComputedSeasonXpEntry>,
): SeasonEndXpSpendPreview {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const gamePhase = resolveGamePhase(gameState);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (save.status !== "active") blockingReasons.push("save_not_active");
  if (!team) blockingReasons.push("team_not_found");
  if (!APPLY_PHASES.has(gamePhase)) warnings.push(`xp_spend_apply_phase_blocked:${gamePhase}`);
  if (team && team.humanControlled === false) warnings.push("ai_xp_spend_apply_not_enabled_v1");

  const rosterPlayerIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  const baselinePlayerIds = new Set((gameState.playerBaselines ?? []).map((baseline) => baseline.playerId));
  const inputsByPlayerId = new Map<string, SeasonEndXpSpendPlannedUpgradeInput[]>();
  for (const upgrade of plannedUpgrades) {
    if (!rosterPlayerIds.has(upgrade.playerId)) {
      blockingReasons.push(`player_not_on_team:${upgrade.playerId}`);
      continue;
    }
    if (!baselinePlayerIds.has(upgrade.playerId)) {
      blockingReasons.push(`player_baseline_missing:${upgrade.playerId}`);
      continue;
    }
    inputsByPlayerId.set(upgrade.playerId, [...(inputsByPlayerId.get(upgrade.playerId) ?? []), upgrade]);
  }

  if (plannedUpgrades.length === 0) {
    for (const playerId of rosterPlayerIds) {
      if (!baselinePlayerIds.has(playerId)) {
        blockingReasons.push(`player_baseline_missing:${playerId}`);
        continue;
      }
      inputsByPlayerId.set(playerId, []);
    }
  }

  if (plannedUpgrades.length === 0 && rosterPlayerIds.size > 0 && blockingReasons.length === 0) {
    const materializedPlayerIds = new Set(
      (gameState.playerProgressionEvents ?? [])
        .filter((event) => event.seasonId === gameState.season.id && rosterPlayerIds.has(event.playerId))
        .map((event) => event.playerId),
    );
    if (materializedPlayerIds.size >= rosterPlayerIds.size) {
      const hardBlockingReasons = ["season_xp_no_unmaterialized_xp"];
      return {
        ok: false,
        dryRun: true,
        confirmToken: null,
        team: team
          ? { teamId: team.teamId, shortCode: team.shortCode, name: team.name, humanControlled: team.humanControlled !== false }
          : null,
        saveContext: {
          saveId: save.saveId,
          seasonId: gameState.season.id,
          gamePhase,
          saveStatus: save.status,
        },
        plannedUpgrades: [],
        players: [],
        totals: {
          plannedUpgradeCount: 0,
          xpAvailable: 0,
          xpPlanned: 0,
          xpRemaining: 0,
        },
        warnings: [...new Set(warnings)],
        blockingReasons: hardBlockingReasons,
      };
    }
  }

  const facilities = getTeamFacilities(gameState, teamId);
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  let previewEntries = [...inputsByPlayerId.entries()];

  const economyContext = cachedEconomyContext ?? getEconomyPreviewContext(gameState);
  const players = previewEntries.map(([playerId, inputs]) => {
    const player = playerById.get(playerId) ?? null;
    if (!player) {
      blockingReasons.push(`player_not_found:${playerId}`);
      return null;
    }
    return buildPreviewPlayer({ save, teamId, player, plannedInputs: inputs, facilities, economyContext, skipAfterEconomyAudit: options?.skipAfterEconomyAudit, preComputedSeasonXp });
  }).filter((entry): entry is SeasonEndXpSpendPreviewPlayer => {
    if (!entry) return false;
    if (plannedUpgrades.length > 0) return true;
    return entry.earnedSeasonXP > 0 || (entry.organicProgression?.attributeBreakdown.length ?? 0) > 0;
  });

  if (plannedUpgrades.length === 0 && players.length === 0 && blockingReasons.length === 0) {
    blockingReasons.push("season_xp_no_unmaterialized_xp");
  }

  blockingReasons.push(...players.flatMap((player) => player.blockers));
  warnings.push(...players.flatMap((player) => player.warnings));

  const normalizedUpgrades = players.flatMap((player) => player.plannedUpgrades);
  const xpBeforeByPlayer = Object.fromEntries(players.map((player) => [player.playerId, player.availableXP]));
  const attributeValuesBeforeByPlayer = Object.fromEntries(players.map((player) => [player.playerId, player.attributeValuesBefore]));
  const hardBlockingReasons = [...new Set(blockingReasons)];
  const confirmToken =
    hardBlockingReasons.length === 0 && players.length > 0
      ? buildConfirmToken({
          saveId: save.saveId,
          seasonId: gameState.season.id,
          teamId,
          plannedUpgrades: normalizedUpgrades,
          xpBeforeByPlayer,
          attributeValuesBeforeByPlayer,
        })
      : null;

  return {
    ok: hardBlockingReasons.length === 0 && players.length > 0,
    dryRun: true,
    confirmToken,
    team: team
      ? { teamId: team.teamId, shortCode: team.shortCode, name: team.name, humanControlled: team.humanControlled !== false }
      : null,
    saveContext: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      gamePhase,
      saveStatus: save.status,
    },
    plannedUpgrades: normalizedUpgrades,
    players,
    totals: {
      plannedUpgradeCount: normalizedUpgrades.length,
      xpAvailable: players.reduce((sum, player) => sum + player.availableXP, 0),
      xpPlanned: players.reduce((sum, player) => sum + player.plannedXP, 0),
      xpRemaining: players.reduce((sum, player) => sum + player.remainingXP, 0),
    },
    warnings: [...new Set(warnings)],
    blockingReasons: hardBlockingReasons,
  };
}

export function applySeasonEndXpSpend(
  save: PersistedSaveGame,
  teamId: string,
  plannedUpgrades: SeasonEndXpSpendPlannedUpgradeInput[],
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
  options: SeasonEndXpSpendApplyOptions = {},
  cachedEconomyContext?: EconomyPreviewContext,
  preComputedPreview?: SeasonEndXpSpendPreview,
  preComputedSeasonXp?: Map<string, PreComputedSeasonXpEntry>,
): SeasonEndXpSpendApplyResult {
  // Use the pre-computed preview if it matches the confirmToken — avoids re-running all per-player work.
  const preview =
    preComputedPreview && confirmToken && confirmToken === preComputedPreview.confirmToken
      ? preComputedPreview
      : previewSeasonEndXpSpend(save, teamId, plannedUpgrades, cachedEconomyContext, options?.skipAfterEconomyAudit ? { skipAfterEconomyAudit: true } : undefined, preComputedSeasonXp);
  const applyBlockers: string[] = [];
  if (!confirmToken) applyBlockers.push("confirm_token_missing");
  if (confirmToken && confirmToken !== preview.confirmToken) applyBlockers.push("xp_spend_preview_stale");
  if (!APPLY_PHASES.has(preview.saveContext.gamePhase)) applyBlockers.push(`xp_spend_apply_phase_blocked:${preview.saveContext.gamePhase}`);
  if (preview.team?.humanControlled === false && !options.allowAiTeams) applyBlockers.push("ai_xp_spend_apply_not_enabled_v1");
  if (!preview.ok) applyBlockers.push(...preview.blockingReasons);

  if (applyBlockers.length > 0) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      eventIds: [],
      blockingReasons: [...new Set(applyBlockers)],
    };
  }

  const playersById = new Map(preview.players.map((player) => [player.playerId, player] as const));
  const eventIds: string[] = [];
  const timestamp = new Date().toISOString();
  const events: PlayerProgressionSpendEventRecord[] = preview.players.map((playerPreview) => {
    const eventId = `player-progression-${randomUUID()}`;
    eventIds.push(eventId);
    return {
      eventId,
      seasonId: save.gameState.season.id,
      teamId,
      playerId: playerPreview.playerId,
      upgrades: playerPreview.plannedUpgrades,
      xpSpent: playerPreview.plannedXP,
      xpEarned: playerPreview.earnedSeasonXP,
      currentXPBefore: playerPreview.currentXPBefore,
      currentXPAfter: playerPreview.remainingXP,
      lifetimeXPBefore: playerPreview.lifetimeXP,
      lifetimeXPAfter: playerPreview.lifetimeXPAfter,
      progressionSnapshotBefore: playerPreview.progressionSnapshotBefore,
      progressionSnapshotAfter: playerPreview.progressionSnapshotAfter,
      economyWarnings: playerPreview.economyAudit.warnings,
      timestamp,
      source: playerPreview.organicProgression ? "organic_season_progression" : "manual_season_end_xp_spend",
    };
  });

  const nextPlayers = save.gameState.players.map((player) => {
    const playerPreview = playersById.get(player.id);
    if (!playerPreview) return player;
    const attributesAfter = { ...player.attributeSheetStats, ...playerPreview.attributeValuesAfter };
    const nextDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
      player,
      attributesAfter: normalizeAttributes({ ...player, attributeSheetStats: attributesAfter } as Player),
    });
    const baselineDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
      player,
      attributesAfter: normalizeAttributes(player),
    });
    const disciplineDelta = Object.fromEntries(
      Object.entries(nextDisciplineRatings).map(([disciplineId, current]) => [
        disciplineId,
        roundValue(current - (baselineDisciplineRatings[disciplineId] ?? current), 2),
      ]),
    );
    const materializedMarketValue = options.deferLeagueWideMarketValueRecalc
      ? null
      : playerPreview.economyAudit.marketValueAfterUpgradePreview;
    const materializedSalaryExpectation = playerPreview.economyAudit.salaryExpectation;
    return {
      ...player,
      className: playerPreview.organicProgression?.classAfter ?? player.className,
      ...(materializedMarketValue != null
        ? {
            marketValue: materializedMarketValue,
            displayMarketValue: materializedMarketValue,
          }
        : {}),
      salaryDemand: materializedSalaryExpectation ?? player.salaryDemand,
      displaySalary: materializedSalaryExpectation ?? player.displaySalary,
      attributeSheetStats: attributesAfter,
      coreStats: buildCoreStatsFromDisciplineRatings({
        disciplines: save.gameState.disciplines,
        disciplineRatings: nextDisciplineRatings,
        fallback: player.coreStats,
      }),
      currentXP: Math.max(0, playerPreview.remainingXP),
      spentXP: (player.spentXP ?? 0) + playerPreview.plannedXP,
      lifetimeXP: playerPreview.lifetimeXPAfter,
      fatigue: Math.min(100, Math.max(0, roundValue((player.fatigue ?? 0) + (playerPreview.organicProgression?.fatigueLoad ?? 0), 1))),
      previousDisciplineRatings: baselineDisciplineRatings,
      lastSeasonDisciplineValues: baselineDisciplineRatings,
      currentDisciplineValues: nextDisciplineRatings,
      disciplineDelta,
      disciplineRatings: nextDisciplineRatings,
      classHistory: playerPreview.organicProgression?.classChanged
        ? [
            ...(player.classHistory ?? []),
            {
              seasonId: save.gameState.season.id,
              previousClassName: playerPreview.organicProgression.classBefore,
              className: playerPreview.organicProgression.classAfter,
              reason: "organic_progression" as const,
              createdAt: timestamp,
            },
          ]
        : player.classHistory,
      lastOrganicProgression: summarizeOrganicProgression(playerPreview.organicProgression),
      economyAfterUpgradePreview: {
        marketValuePreview: playerPreview.economyAudit.marketValueAfterUpgradePreview,
        salaryExpectation: playerPreview.economyAudit.salaryExpectation,
        renewalSalaryPreview: playerPreview.economyAudit.renewalSalaryPreview,
        currentContractSalary: playerPreview.economyAudit.currentContractSalary,
        ovrPreview: playerPreview.economyAudit.ovrAfterPreview,
        mvsUnchanged: playerPreview.economyAudit.mvsBefore,
        marketValueWarnings: playerPreview.economyAudit.marketValueWarnings,
        salaryWarnings: playerPreview.economyAudit.salaryWarnings,
        warningLevel: playerPreview.economyAudit.warningLevel,
        updatedAt: timestamp,
        source: "season_end_xp_spend_preview",
      },
    } satisfies Player;
  });

  const nextRosters = save.gameState.rosters.map((entry) => {
    const playerPreview = playersById.get(entry.playerId);
    const materializedMarketValue = options.deferLeagueWideMarketValueRecalc
      ? null
      : playerPreview?.economyAudit.marketValueAfterUpgradePreview;
    if (materializedMarketValue == null) return entry;
    return {
      ...entry,
      currentValue: materializedMarketValue,
      marketValue: materializedMarketValue,
    };
  });

  let nextGameState: GameState = {
    ...save.gameState,
    players: nextPlayers,
    rosters: nextRosters,
    playerProgressionEvents: [...events, ...(save.gameState.playerProgressionEvents ?? [])],
  };

  if (!options.deferLeagueWideMarketValueRecalc) {
    nextGameState = applyRankTableMarketValuesToGameState(nextGameState);
    nextGameState = patchSeasonProgressionEventMarketValues({
      gameState: nextGameState,
      seasonId: save.gameState.season.id,
      playerIds: preview.players.map((player) => player.playerId),
    });
  }

  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ...preview,
    ok: true,
    confirmToken: null,
    dryRun: false,
    applied: true,
    eventIds,
    blockingReasons: [],
  };
}
