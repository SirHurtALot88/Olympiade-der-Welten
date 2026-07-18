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
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  buildPlayerEconomyCompareReport,
  resolveRankTableMarketValueFromCompareRow,
} from "@/lib/foundation/player-economy-compare-service";
import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import { ensureLeagueMarketValueSnapshot } from "@/lib/player-formulas/market-value-apply";
import {
  applyRankTableMarketValuesToGameState,
  patchSeasonProgressionEventMarketValues,
  syncRosterMarketValuesWithPlayerEconomy,
} from "@/lib/player-formulas/market-value-apply";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  buildOrganicSeasonProgression,
  resolveSeasonTrainingAccumulatorInputs,
  type OrganicSeasonProgressionResult,
} from "@/lib/training/organic-season-progression";
import { reconcilePlayerPotentialRecordsForGameState } from "@/lib/scouting/player-potential-ceiling-service";
import {
  buildCoreStatsFromDisciplineRatings,
  buildPreviewDisciplineRatingsFromAttributes,
  buildSeasonEndDisciplineDeltas,
  getProgressionRatingTier,
  type SeasonEndProgressionDisciplineDelta,
  type SeasonEndProgressionEconomyAudit,
} from "@/lib/training/season-end-progression-preview";
import { buildLeagueDisciplineRatingsWithAttributeOverrides } from "@/lib/player-formulas/discipline-rating-engine";

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
  /** Long-run batch: rank discipline stats on roster players only (~400), not full FA universe (~3000). */
  fastDisciplineLeague?: boolean;
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
  /** Unique rostered players — used for fast discipline league reranks in long-run batch. */
  rosterLeaguePlayers: Player[];
};

/**
 * Pre-computed per-player season XP data derived from the initial (unmodified) gameState.
 * Passed through the call chain to avoid re-running expensive per-player computations
 * (buildPlayerProgressionForecast, buildOrganicSeasonProgression) on each team iteration
 * when the cloned gameState invalidates WeakMap caches.
 */
export type PreComputedSeasonXpEntry = {
  /** @deprecated XP-System abgeschafft — immer 0. Reale Entwicklung läuft organisch. */
  earnedSeasonXP: number;
  /** @deprecated XP-System abgeschafft — immer 0. */
  trainingXPAfterFacilities: number;
  /** @deprecated XP-System abgeschafft — immer 0. */
  performanceXP: number;
  /** @deprecated XP-System abgeschafft — immer null. */
  forecast: null;
  /** @deprecated XP-System abgeschafft — immer null. */
  regressionEvent: null;
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

function buildRosterLeaguePlayers(gameState: GameState): Player[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const seen = new Set<string>();
  const rosterPlayers: Player[] = [];
  for (const entry of gameState.rosters) {
    if (seen.has(entry.playerId)) continue;
    const player = playerById.get(entry.playerId);
    if (!player) continue;
    seen.add(entry.playerId);
    rosterPlayers.push(player);
  }
  return rosterPlayers;
}

function getEconomyPreviewContext(gameState: GameState): EconomyPreviewContext {
  const cached = economyPreviewContextCache.get(gameState);
  if (cached) return cached;
  const warmedGameState = ensureLeagueMarketValueSnapshot(gameState);
  const beforeReport = buildPlayerEconomyCompareReport({ gameState: warmedGameState });
  const context: EconomyPreviewContext = {
    beforeReport,
    beforeRowsByPlayerId: new Map(beforeReport.players.map((row) => [row.playerId, row] as const)),
    beforeRatings: getPlayerRatingContext(gameState),
    rosterByPlayerId: new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const)),
    rosterLeaguePlayers: buildRosterLeaguePlayers(warmedGameState),
  };
  economyPreviewContextCache.set(gameState, context);
  return context;
}

export function buildEconomyPreviewContext(gameState: GameState): EconomyPreviewContext {
  return getEconomyPreviewContext(gameState);
}

function resolveSeasonTotalMatchdays(gameState: GameState): number {
  const declared = gameState.season.totalMatchdays;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > 0) return Math.floor(declared);
  const fromIds = gameState.season.matchdayIds?.length ?? 0;
  return fromIds > 0 ? fromIds : 10;
}

/**
 * Anti-cheese (Teil B, B.1/B.2): resolves the per-matchday-accumulator overrides for
 * `buildOrganicSeasonProgression`. Spread into the call — when there is no usable accumulator the
 * result is `{}`, so both params stay undefined and the organic module falls back to mode-at-season-end.
 */
function accumulatorProgressionOverrides(gameState: GameState, player: Player) {
  return (
    resolveSeasonTrainingAccumulatorInputs({
      accumulator: player.seasonTrainingAccumulator,
      seasonId: gameState.season.id,
      totalMatchdays: resolveSeasonTotalMatchdays(gameState),
    }) ?? {}
  );
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
    const organicProgression = buildOrganicSeasonProgression({
      gameState,
      player,
      facilities,
      ...accumulatorProgressionOverrides(gameState, player),
    });
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

// XP-System abgeschafft: Das Saison-Ende erzeugt keine XP mehr. Die reale
// Entwicklung läuft ausschließlich organisch (buildOrganicSeasonProgression,
// cost 0) und ist von dieser Funktion unabhängig. `earnedSeasonXP` war im
// organischen Regelbetrieb ohnehin immer 0 (siehe buildPreviewPlayer:
// `organicProgression ? 0 : …`) — die Forecast-/Levelup-XP-Berechnung lief nur
// noch in den toten Legacy-Pfad. Diese Funktion liefert daher nur noch die
// Materialisierungs-Warnung; alle XP-Kennzahlen sind konstant 0/null.
// Die Signatur bleibt (teamId/facilities/playerRating werden nicht mehr
// gelesen), damit die bestehenden Aufrufstellen unverändert bleiben.
function getSeasonXp(input: {
  save: PersistedSaveGame;
  player: Player;
  teamId: string;
  facilities: TeamFacilityCollection;
  playerRating: ReturnType<typeof buildPlayerRatingContractMap> extends Map<string, infer Row> ? Row | null : never;
}): Omit<PreComputedSeasonXpEntry, "organicProgression" | "appearances"> {
  const gameState = input.save.gameState;
  const alreadyMaterialized = (gameState.playerProgressionEvents ?? []).some(
    (event) => event.seasonId === gameState.season.id && event.playerId === input.player.id,
  );
  return {
    earnedSeasonXP: 0,
    trainingXPAfterFacilities: 0,
    performanceXP: 0,
    forecast: null,
    regressionEvent: null,
    warnings: alreadyMaterialized ? ["season_xp_already_materialized"] : [],
  };
}

function buildEconomyAudit(input: {
  gameState: GameState;
  player: Player;
  baselinePlayer?: Player;
  previewPlayer: Player;
  context: EconomyPreviewContext;
  hasAttributeChanges: boolean;
}): SeasonEndProgressionEconomyAudit {
  const cachedBeforeRow = input.context.beforeRowsByPlayerId.get(input.player.id) ?? null;
  const beforeRow =
    input.hasAttributeChanges && input.baselinePlayer
      ? (buildPlayerEconomyCompareReport({
          gameState: input.gameState,
          playerOverridesById: new Map([[input.baselinePlayer.id, input.baselinePlayer]]),
          playerIds: [input.baselinePlayer.id],
          includeSummary: false,
        }).players.find((entry) => entry.playerId === input.baselinePlayer!.id) ?? cachedBeforeRow)
      : cachedBeforeRow;
  const afterReport = input.hasAttributeChanges
    ? buildPlayerEconomyCompareReport({
        gameState: input.gameState,
        playerOverridesById: new Map([[input.previewPlayer.id, input.previewPlayer]]),
        playerIds: [input.previewPlayer.id],
        includeSummary: false,
      })
    : input.context.beforeReport;
  const afterRow = afterReport.players.find((entry) => entry.playerId === input.player.id) ?? null;
  const rosterEntry = input.context.rosterByPlayerId.get(input.player.id) ?? null;
  const baselineGameState =
    input.hasAttributeChanges && input.baselinePlayer
      ? {
          ...input.gameState,
          players: input.gameState.players.map((entry) => (entry.id === input.baselinePlayer!.id ? input.baselinePlayer! : entry)),
        }
      : null;
  // Freeze-Bypass: Der Progression-Audit muss die Before/After-OVR LIVE aus den getauschten
  // Spielern rechnen. Ohne `ignoreFreeze` liefert die Map nach MD10 die eingefrorenen Rows
  // (playerId-keyed) → beforeRating === afterRating → Development-Delta strukturell 0.
  const beforeRating = baselineGameState
    ? buildPlayerRatingContractMap(baselineGameState, undefined, { ignoreFreeze: true }).get(input.player.id) ?? input.context.beforeRatings.get(input.player.id) ?? null
    : input.context.beforeRatings.get(input.player.id) ?? null;
  const rankTableMarketValueBefore = resolveRankTableMarketValueFromCompareRow(beforeRow);
  const rankTableMarketValueAfter = input.hasAttributeChanges
    ? resolveRankTableMarketValueFromCompareRow(afterRow)
    : rankTableMarketValueBefore;
  const afterGameState = input.hasAttributeChanges
    ? {
        ...input.gameState,
        players: input.gameState.players.map((entry) => (entry.id === input.previewPlayer.id ? input.previewPlayer : entry)),
      }
    : null;
  const afterRating = afterGameState
    ? buildPlayerRatingContractMap(afterGameState, undefined, { ignoreFreeze: true }).get(input.player.id) ?? null
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
    mvsAfterPreview: afterRating?.mvs ?? beforeRating?.mvs ?? null,
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
    appliedTrainingSetpoints: progress.appliedTrainingSetpoints,
    performanceSetpoints: progress.appliedPerformanceSetpoints,
    appliedPerformanceSetpoints: progress.appliedPerformanceSetpoints,
    regressionCombinedTotal: progress.regressionBreakdown.combinedTotal,
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
  facilities: TeamFacilityCollection;
  economyContext: EconomyPreviewContext;
  skipAfterEconomyAudit?: boolean;
  fastDisciplineLeague?: boolean;
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

  const plannedXP = 0;
  const plannedUpgrades: PlayerProgressionSpendUpgradeRecord[] = [];
  const organicProgression = attributesAfter
    ? (input.preComputedSeasonXp?.get(input.player.id)?.organicProgression ?? buildOrganicSeasonProgression({
        gameState: input.save.gameState,
        player: input.player,
        facilities: input.facilities,
        ...accumulatorProgressionOverrides(input.save.gameState, input.player),
      }))
    : null;
  const currentXPBefore = Math.max(0, Math.round(input.player.currentXP ?? 0));
  // XP-System abgeschafft: Am Saison-Ende wird keine XP mehr verdient. Attribute
  // werden ausschließlich organisch gesetzt (unten via organicProgression, cost 0).
  const earnedSeasonXP = 0;
  const availableXP = currentXPBefore + earnedSeasonXP;
  const lifetimeXPBefore = getLifetimeXPBefore(input.player);
  const lifetimeXPAfter =
    organicProgression
      ? lifetimeXPBefore
      : lifetimeXPBefore == null && earnedSeasonXP <= 0
        ? null
        : Math.max(0, Math.round(lifetimeXPBefore ?? 0) + Math.round(earnedSeasonXP));
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
  // Legacy-Regression-Zweig entfernt: Er lief nur bei `!organicProgression`, was
  // impliziert `attributesAfter == null` (organicProgression ist genau dann null,
  // wenn attributesAfter null ist → attribute_source_missing-Blocker). Die Bedingung
  // `!organicProgression && attributesAfter` war damit strukturell nie erfüllt —
  // toter Code. Regression läuft im Regelbetrieb über organicProgression (oben).

  const leaguePlayers = input.fastDisciplineLeague
    ? input.economyContext.rosterLeaguePlayers
    : input.save.gameState.players;
  const previewDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
    player: input.player,
    attributesAfter,
    leaguePlayers,
  });
  const baselineDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
    player: input.player,
    attributesAfter: attributesBefore,
    leaguePlayers,
  });
  const disciplineDeltas = buildSeasonEndDisciplineDeltas({
    disciplines: input.save.gameState.disciplines,
    lastSeasonDisciplineValues: baselineDisciplineRatings,
    currentDisciplineValues: previewDisciplineRatings,
  });
  const baselinePreviewPlayer: Player = {
    ...input.player,
    attributeSheetStats: attributesBefore ? { ...input.player.attributeSheetStats, ...attributesBefore } : input.player.attributeSheetStats,
    disciplineRatings: baselineDisciplineRatings,
    coreStats: buildCoreStatsFromDisciplineRatings({
      disciplines: input.save.gameState.disciplines,
      disciplineRatings: baselineDisciplineRatings,
      fallback: input.player.coreStats,
    }),
  };
  const previewPlayer: Player = {
    ...input.player,
    attributeSheetStats: attributesAfter ? { ...input.player.attributeSheetStats, ...attributesAfter } : input.player.attributeSheetStats,
    className: organicProgression?.classAfter ?? input.player.className,
    coreStats: buildCoreStatsFromDisciplineRatings({
      disciplines: input.save.gameState.disciplines,
      disciplineRatings: previewDisciplineRatings,
      fallback: input.player.coreStats,
    }),
    previousDisciplineRatings: baselineDisciplineRatings,
    disciplineRatings: previewDisciplineRatings,
  };
  const economyAudit = buildEconomyAudit({
    gameState: input.save.gameState,
    player: input.player,
    baselinePlayer: baselinePreviewPlayer,
    previewPlayer,
    context: input.economyContext,
    hasAttributeChanges: !input.skipAfterEconomyAudit && plannedUpgrades.length > 0,
  });
  const progressionSnapshotBefore = buildProgressionSnapshot({
    player: input.player,
    attributes: attributesBefore ?? {},
    disciplineRatings: baselineDisciplineRatings,
    ovr: economyAudit.ovrBefore,
    mvs: economyAudit.mvsBefore,
    marketValue: economyAudit.calculatedMarketValue ?? economyAudit.displayedMarketValue,
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
    earnedSeasonXP,
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
  cachedEconomyContext?: EconomyPreviewContext,
  options?: { skipAfterEconomyAudit?: boolean; fastDisciplineLeague?: boolean },
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
  const materializedPlayerIds = new Set(
    (gameState.playerProgressionEvents ?? [])
      .filter((event) => event.seasonId === gameState.season.id && rosterPlayerIds.has(event.playerId))
      .map((event) => event.playerId),
  );
  const baselinePlayerIds = new Set((gameState.playerBaselines ?? []).map((baseline) => baseline.playerId));
  const eligiblePlayerIds: string[] = [];
  for (const playerId of rosterPlayerIds) {
    if (materializedPlayerIds.has(playerId)) continue;
    if (!baselinePlayerIds.has(playerId)) {
      blockingReasons.push(`player_baseline_missing:${playerId}`);
      continue;
    }
    eligiblePlayerIds.push(playerId);
  }

  if (rosterPlayerIds.size > 0 && blockingReasons.length === 0) {
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

  const economyContext = cachedEconomyContext ?? getEconomyPreviewContext(gameState);
  const players = eligiblePlayerIds.map((playerId) => {
    const player = playerById.get(playerId) ?? null;
    if (!player) {
      blockingReasons.push(`player_not_found:${playerId}`);
      return null;
    }
    return buildPreviewPlayer({
      save,
      teamId,
      player,
      facilities,
      economyContext,
      skipAfterEconomyAudit: options?.skipAfterEconomyAudit,
      fastDisciplineLeague: options?.fastDisciplineLeague,
      preComputedSeasonXp,
    });
  }).filter((entry): entry is SeasonEndXpSpendPreviewPlayer => {
    if (!entry) return false;
    return entry.earnedSeasonXP > 0 || (entry.organicProgression?.attributeBreakdown.length ?? 0) > 0;
  });

  if (players.length === 0 && blockingReasons.length === 0) {
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
      : previewSeasonEndXpSpend(
          save,
          teamId,
          cachedEconomyContext,
          {
            skipAfterEconomyAudit: options.skipAfterEconomyAudit,
            fastDisciplineLeague: options.fastDisciplineLeague,
          },
          preComputedSeasonXp,
        );
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
      xpEarned: playerPreview.organicProgression ? 0 : playerPreview.earnedSeasonXP,
      currentXPBefore: playerPreview.currentXPBefore,
      currentXPAfter: playerPreview.remainingXP,
      lifetimeXPBefore: playerPreview.lifetimeXP,
      lifetimeXPAfter: playerPreview.lifetimeXPAfter,
      progressionSnapshotBefore: playerPreview.progressionSnapshotBefore,
      progressionSnapshotAfter: playerPreview.progressionSnapshotAfter,
      economyWarnings: playerPreview.economyAudit.warnings,
      timestamp,
      source: playerPreview.organicProgression ? "organic_season_progression" : "manual_season_end_xp_spend",
      organicMeta: playerPreview.organicProgression
        ? {
            trainingClass: playerPreview.organicProgression.primaryTrainingClass,
            secondaryTrainingClass: playerPreview.organicProgression.secondaryTrainingClass,
            trainingMode: playerPreview.organicProgression.trainingMode,
            classBefore: playerPreview.organicProgression.classBefore,
            classAfter: playerPreview.organicProgression.classAfter,
            netSetpoints: playerPreview.organicProgression.netSetpoints,
            trainingSetpoints: playerPreview.organicProgression.trainingSetpoints,
            performanceSetpoints: playerPreview.organicProgression.appliedPerformanceSetpoints,
            traitModifierPct: playerPreview.organicProgression.traitModifierPct,
          }
        : undefined,
    };
  });

  const attributeOverridesAfter: Record<string, PlayerGeneratorAttributes> = {};
  const attributeOverridesBefore: Record<string, PlayerGeneratorAttributes> = {};
  for (const [playerId, playerPreview] of playersById.entries()) {
    const player = save.gameState.players.find((entry) => entry.id === playerId);
    if (!player) continue;
    const attributesAfter = { ...player.attributeSheetStats, ...playerPreview.attributeValuesAfter };
    const normalizedAfter = normalizeAttributes({ ...player, attributeSheetStats: attributesAfter } as Player);
    const normalizedBefore = normalizeAttributes(player);
    if (normalizedAfter) {
      attributeOverridesAfter[playerId] = normalizedAfter;
    }
    if (normalizedBefore) {
      attributeOverridesBefore[playerId] = normalizedBefore;
    }
  }
  let disciplineRatingsAfterByPlayerId: Map<string, Record<string, number>>;
  let disciplineRatingsBeforeByPlayerId: Map<string, Record<string, number>>;
  if (options.deferLeagueWideMarketValueRecalc) {
    disciplineRatingsAfterByPlayerId = new Map();
    disciplineRatingsBeforeByPlayerId = new Map();
    for (const playerPreview of preview.players) {
      disciplineRatingsAfterByPlayerId.set(
        playerPreview.playerId,
        playerPreview.progressionSnapshotAfter.disciplineRatings,
      );
      disciplineRatingsBeforeByPlayerId.set(
        playerPreview.playerId,
        playerPreview.progressionSnapshotBefore.disciplineRatings,
      );
    }
  } else {
    disciplineRatingsAfterByPlayerId = buildLeagueDisciplineRatingsWithAttributeOverrides(
      save.gameState.players,
      attributeOverridesAfter,
    );
    disciplineRatingsBeforeByPlayerId = buildLeagueDisciplineRatingsWithAttributeOverrides(
      save.gameState.players,
      attributeOverridesBefore,
    );
  }

  const affectedPlayerIds = new Set(playersById.keys());
  const nextPlayers = save.gameState.players.map((player) => {
    const playerPreview = playersById.get(player.id);
    if (!playerPreview || !affectedPlayerIds.has(player.id)) return player;
    const attributesAfter = { ...player.attributeSheetStats, ...playerPreview.attributeValuesAfter };
    const nextDisciplineRatings = disciplineRatingsAfterByPlayerId.get(player.id) ?? player.disciplineRatings ?? {};
    const baselineDisciplineRatings = disciplineRatingsBeforeByPlayerId.get(player.id) ?? player.disciplineRatings ?? {};
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
      // Anti-cheese Teil B (B.3): training fatigue is accumulated per matchday (see
      // `accumulateMatchdayTrainingProgress`), NOT booked in a lump at season end. `organicProgression
      // .fatigueLoad` remains a forecast/preview field only. Fatigue carries as-is into the reset.
      fatigue: Math.min(100, Math.max(0, roundValue(player.fatigue ?? 0, 1))),
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
    playerPotential: reconcilePlayerPotentialRecordsForGameState({
      gameState: {
        ...save.gameState,
        players: nextPlayers,
        rosters: nextRosters,
        playerProgressionEvents: [...events, ...(save.gameState.playerProgressionEvents ?? [])],
      },
      playerIds: preview.players.map((player) => player.playerId),
    }),
  };

  if (!options.deferLeagueWideMarketValueRecalc) {
    nextGameState = applyRankTableMarketValuesToGameState(nextGameState);
    nextGameState = patchSeasonProgressionEventMarketValues({
      gameState: nextGameState,
      seasonId: save.gameState.season.id,
      playerIds: preview.players.map((player) => player.playerId),
    });
    nextGameState = withPersistedSeasonDerivations(nextGameState);
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

export type SeasonEndProgressionTeamApply = {
  teamId: string;
  preview: SeasonEndXpSpendPreview;
};

export type SeasonEndProgressionMutationsResult = {
  gameState: GameState;
  eventIds: string[];
  progressedPlayerIds: string[];
  disciplineBaselinesBefore: Map<string, Record<string, number>>;
};

function buildSeasonEndProgressionSpendEvent(input: {
  eventId: string;
  seasonId: string;
  teamId: string;
  playerPreview: SeasonEndXpSpendPreviewPlayer;
  timestamp: string;
}): PlayerProgressionSpendEventRecord {
  return {
    eventId: input.eventId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    playerId: input.playerPreview.playerId,
    upgrades: input.playerPreview.plannedUpgrades,
    xpSpent: input.playerPreview.plannedXP,
    xpEarned: input.playerPreview.organicProgression ? 0 : input.playerPreview.earnedSeasonXP,
    currentXPBefore: input.playerPreview.currentXPBefore,
    currentXPAfter: input.playerPreview.remainingXP,
    lifetimeXPBefore: input.playerPreview.lifetimeXP,
    lifetimeXPAfter: input.playerPreview.lifetimeXPAfter,
    progressionSnapshotBefore: input.playerPreview.progressionSnapshotBefore,
    progressionSnapshotAfter: input.playerPreview.progressionSnapshotAfter,
    economyWarnings: input.playerPreview.economyAudit.warnings,
    timestamp: input.timestamp,
    source: input.playerPreview.organicProgression ? "organic_season_progression" : "manual_season_end_xp_spend",
    organicMeta: input.playerPreview.organicProgression
      ? {
          trainingClass: input.playerPreview.organicProgression.primaryTrainingClass,
          secondaryTrainingClass: input.playerPreview.organicProgression.secondaryTrainingClass,
          trainingMode: input.playerPreview.organicProgression.trainingMode,
          classBefore: input.playerPreview.organicProgression.classBefore,
          classAfter: input.playerPreview.organicProgression.classAfter,
          netSetpoints: input.playerPreview.organicProgression.netSetpoints,
          trainingSetpoints: input.playerPreview.organicProgression.trainingSetpoints,
          performanceSetpoints: input.playerPreview.organicProgression.appliedPerformanceSetpoints,
          traitModifierPct: input.playerPreview.organicProgression.traitModifierPct,
        }
      : undefined,
  };
}

/** Apply all team progression previews in one pass — no per-team discipline or market-value recalc. */
export function applySeasonEndProgressionMutations(input: {
  gameState: GameState;
  teamApplies: SeasonEndProgressionTeamApply[];
}): SeasonEndProgressionMutationsResult {
  const playerPreviewById = new Map<string, SeasonEndXpSpendPreviewPlayer>();
  for (const { preview } of input.teamApplies) {
    for (const playerPreview of preview.players) {
      playerPreviewById.set(playerPreview.playerId, playerPreview);
    }
  }

  const timestamp = new Date().toISOString();
  const seasonId = input.gameState.season.id;
  const eventIds: string[] = [];
  const events: PlayerProgressionSpendEventRecord[] = [];
  for (const { teamId, preview } of input.teamApplies) {
    for (const playerPreview of preview.players) {
      const eventId = `player-progression-${randomUUID()}`;
      eventIds.push(eventId);
      events.push(
        buildSeasonEndProgressionSpendEvent({
          eventId,
          seasonId,
          teamId,
          playerPreview,
          timestamp,
        }),
      );
    }
  }

  const disciplineBaselinesBefore = new Map<string, Record<string, number>>();
  const progressedPlayerIds: string[] = [];

  const nextPlayers = input.gameState.players.map((player) => {
    const playerPreview = playerPreviewById.get(player.id);
    if (!playerPreview) return player;

    progressedPlayerIds.push(player.id);
    disciplineBaselinesBefore.set(player.id, { ...(player.disciplineRatings ?? {}) });

    const attributesAfter = { ...player.attributeSheetStats, ...playerPreview.attributeValuesAfter };
    const materializedSalaryExpectation = playerPreview.economyAudit.salaryExpectation;

    return {
      ...player,
      className: playerPreview.organicProgression?.classAfter ?? player.className,
      salaryDemand: materializedSalaryExpectation ?? player.salaryDemand,
      displaySalary: materializedSalaryExpectation ?? player.displaySalary,
      attributeSheetStats: attributesAfter,
      currentXP: Math.max(0, playerPreview.remainingXP),
      spentXP: (player.spentXP ?? 0) + playerPreview.plannedXP,
      lifetimeXP: playerPreview.lifetimeXPAfter,
      // Anti-cheese Teil B (B.3): training fatigue accumulates per matchday, not at season end.
      fatigue: Math.min(100, Math.max(0, roundValue(player.fatigue ?? 0, 1))),
      classHistory: playerPreview.organicProgression?.classChanged
        ? [
            ...(player.classHistory ?? []),
            {
              seasonId,
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

  const nextGameState: GameState = {
    ...input.gameState,
    players: nextPlayers,
    playerProgressionEvents: [...events, ...(input.gameState.playerProgressionEvents ?? [])],
    playerPotential: reconcilePlayerPotentialRecordsForGameState({
      gameState: {
        ...input.gameState,
        players: nextPlayers,
        playerProgressionEvents: [...events, ...(input.gameState.playerProgressionEvents ?? [])],
      },
      playerIds: progressedPlayerIds,
    }),
  };

  return {
    gameState: nextGameState,
    eventIds,
    progressedPlayerIds,
    disciplineBaselinesBefore,
  };
}

/** One league-wide discipline + market-value pass after all progression mutations are merged. */
export function finalizeSeasonEndProgressionLeagueEconomy(input: {
  gameState: GameState;
  seasonId: string;
  progressedPlayerIds: Iterable<string>;
  disciplineBaselinesBefore?: Map<string, Record<string, number>>;
}): GameState {
  const progressedSet = new Set(input.progressedPlayerIds);
  const disciplineRatingsByPlayerId = buildLeagueDisciplineRatingsWithAttributeOverrides(input.gameState.players, {});

  const nextPlayers = input.gameState.players.map((player) => {
    const nextDisciplineRatings = disciplineRatingsByPlayerId.get(player.id) ?? player.disciplineRatings ?? {};
    const nextCoreStats = buildCoreStatsFromDisciplineRatings({
      disciplines: input.gameState.disciplines,
      disciplineRatings: nextDisciplineRatings,
      fallback: player.coreStats,
    });

    if (!progressedSet.has(player.id)) {
      return {
        ...player,
        disciplineRatings: nextDisciplineRatings,
        coreStats: nextCoreStats,
        currentDisciplineValues: nextDisciplineRatings,
      };
    }

    const baselineDisciplineRatings =
      input.disciplineBaselinesBefore?.get(player.id) ?? player.previousDisciplineRatings ?? player.disciplineRatings ?? {};
    const disciplineDelta = Object.fromEntries(
      Object.entries(nextDisciplineRatings).map(([disciplineId, current]) => [
        disciplineId,
        roundValue(current - (baselineDisciplineRatings[disciplineId] ?? current), 2),
      ]),
    );

    return {
      ...player,
      disciplineRatings: nextDisciplineRatings,
      coreStats: nextCoreStats,
      previousDisciplineRatings: baselineDisciplineRatings,
      lastSeasonDisciplineValues: baselineDisciplineRatings,
      currentDisciplineValues: nextDisciplineRatings,
      disciplineDelta,
    } satisfies Player;
  });

  let nextGameState: GameState = {
    ...input.gameState,
    players: nextPlayers,
  };
  nextGameState = applyRankTableMarketValuesToGameState(nextGameState);
  nextGameState = patchSeasonProgressionEventMarketValues({
    gameState: nextGameState,
    seasonId: input.seasonId,
    playerIds: [...progressedSet],
  });
  nextGameState = syncRosterMarketValuesWithPlayerEconomy(nextGameState);
  return withPersistedSeasonDerivations(nextGameState);
}
