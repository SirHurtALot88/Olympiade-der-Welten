import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributeName,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { getFacilityEfficiency, getFacilityLevel, getRecoveryTrainingFatigueReductionPct } from "@/lib/facilities/facility-effects";
import {
  deriveAttributeAffinityProfile,
  getAttributeAffinityKind,
  type AttributeAffinityKind,
  type AttributeAffinityProfile,
} from "@/lib/training/training-levelup-service";
import {
  getCombinedAttributeTrainingMultiplier,
  getPotentialGapXpFactor,
} from "@/lib/foundation/player-potential-display-service";
import {
  getAttributeHeadroom,
  getPerformanceHeadroomGrowthMultiplier,
  resolvePlayerPotentialRecordFromGameState,
  type AttributeHeadroomState,
} from "@/lib/scouting/player-attribute-ceiling-service";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { resolvePlayerPotentialRecordForProgression } from "@/lib/scouting/player-potential-ceiling-service";
import {
  calculateDynamicClassName,
  getClassTrainingProfile,
  getClassTrainingSignals,
  normalizeProgressionClassName,
  PROGRESSION_ATTRIBUTE_ORDER,
  type ProgressionClassName,
} from "@/lib/training/class-progression-config";
import { buildTrainingTraitSignal } from "@/lib/training/trait-training-signal";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { FATIGUE_LOAD_BY_MODE, TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";
import { getDevelopmentRouteBonusMultiplier } from "@/lib/training/development-route-bonus";
import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";

export type OrganicProgressionAttributeBreakdown = {
  attribute: PlayerGeneratorAttributeName;
  before: number;
  after: number;
  delta: number;
  regression: number;
  training: number;
  performance: number;
  affinity: AttributeAffinityKind;
  trainingGrowthMultiplier: number;
  performanceGrowthMultiplier: number;
};

export type OrganicSeasonProgressionResult = {
  playerId: string;
  seasonId: string;
  classBefore: string;
  classAfter: ProgressionClassName;
  classChanged: boolean;
  primaryTrainingClass: ProgressionClassName;
  secondaryTrainingClass: ProgressionClassName | null;
  trainingMode: PlayerTrainingMode;
  fatigueLoad: number;
  potentialRating: number | null;
  potentialTrainingMultiplier: number;
  traitTrainingMultiplier: number;
  traitModifierPct: number;
  traitBreakdown: Array<{
    trait: string;
    legacyTraitTrainingFactorPct: number | null;
    known: boolean;
    tone: "positive" | "negative" | "neutral";
  }>;
  facilityModifierPct: number;
  baseRegressionPerAttribute: number;
  marketValuePressureTotal: number;
  marketValuePressurePerAttribute: number;
  marketValueMaintenanceReliefPct: number;
  trainingSetpoints: number;
  /** Sum of applied training deltas after class distribution and multipliers. */
  appliedTrainingSetpoints: number;
  /** Raw performance budget before affinity multipliers. */
  performanceSetpoints: number;
  /** Sum of applied performance deltas after affinity multipliers. */
  appliedPerformanceSetpoints: number;
  performanceRegressionTotal: number;
  performanceRegressionPerAttribute: number;
  regressionBreakdown: OrganicRegressionBreakdown;
  netSetpoints: number;
  topTrainingAttributes: Array<{ attribute: PlayerGeneratorAttributeName; weight: number }>;
  negativeTrainingRisks: Array<{ attribute: PlayerGeneratorAttributeName; weight: number }>;
  attributeAffinity: {
    signatureAttributes: AttributeAffinityProfile["signatureAttributes"];
    weakAttribute: PlayerGeneratorAttributeName;
    signatureGrowthMultiplier: number;
    weakGrowthMultiplier: number;
  };
  attributeBreakdown: OrganicProgressionAttributeBreakdown[];
  attributeDeltas: Partial<Record<PlayerGeneratorAttributeName, number>>;
  attributesBefore: PlayerGeneratorAttributes;
  attributesAfter: PlayerGeneratorAttributes;
  warnings: string[];
};

export type OrganicRegressionBreakdown = {
  /** Basis-Flat-Regression: 0,25 × 12 Attribute (negativ). */
  baseFlatTotal: number;
  /** Marktwert-Druck gesamt: Marktwert × 0,6 % × 12 Attribute (negativ). */
  marketValueTotal: number;
  /** Verwendeter Marktwert (nicht MVS/displayMarketValue). */
  marktwertBase: number;
  /** Angewandte MW-Rate in Prozent (0,6 = 0,6 % vom Marktwert pro Attribut). */
  marketValuePressureRatePct: number;
  /** Summe: regFlat + regMW. */
  combinedTotal: number;
};

/** Tunable via scripts/long-run-auto-tune-organic.ts (--apply regression scale). */
export const ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE = 0.28;
const TRAINING_CENTER_LEVEL_MODIFIER_PCT = [0, 14, 28, 42, 56, 70] as const;
/** 0,7 % vom Marktwert pro Attribut (nicht MVS). Tunable via auto-tune. */
export const ORGANIC_MARKET_VALUE_PRESSURE_RATE = 0.0102;
/**
 * Financial/value discipline (B): the market-value regression term scaled linearly and UNBOUNDED, so a
 * near-ceiling high-value star was guaranteed a large negative net — regression fired at full strength
 * while training growth was throttled to 5-45% at the cap. Two organic softeners (no removal of
 * regression for ordinary developing players):
 *  - B2: soft-knee the market value that DRIVES regression, so extreme-value stars aren't penalized
 *    without bound (above the knee, only a fraction of the excess counts).
 *  - B1: make regression HEADROOM-AWARE (mirror of the growth throttle, but gentle) — a capped/closing
 *    attribute plateaus instead of eroding at full speed. Net: a well-managed top star holds/slightly
 *    grows instead of crashing. Open (still-developing) attributes keep full regression (multiplier 1).
 */
export const ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE = 55;
export const ORGANIC_MARKET_VALUE_REGRESSION_KNEE_SLOPE = 0.35;
const ORGANIC_REGRESSION_HEADROOM_MULTIPLIER: Record<"open" | "closing" | "capped", number> = {
  open: 1,
  closing: 0.7,
  capped: 0.45,
};
function softKneeMarketValueForRegression(marktwertBase: number): number {
  if (marktwertBase <= ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE) return marktwertBase;
  return (
    ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE +
    (marktwertBase - ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE) * ORGANIC_MARKET_VALUE_REGRESSION_KNEE_SLOPE
  );
}
const NEGATIVE_TRAINING_SIDE_EFFECT_SHARE = 0.14;
/** Performance budget scale — boosts peak P90 vs league median. Tunable via auto-tune. */
export const ORGANIC_PERFORMANCE_SETPOINT_SCALE = 1.05;
const PERFORMANCE_SEASON_SOFT_KNEE = 5.5;
/**
 * 2026-07-04 design correction: growth floors must derive from the player's own
 * potential-cap gap (per the organic design principle — "weit vom Cap = schnell,
 * nah am Cap = automatisch langsamer"), NOT from a global rating>=72 "isStar" gate.
 * A rating-gated floor rewarded players who "already made it" instead of players who
 * are genuinely far from their individual attribute/axis ceiling, which is exactly why
 * high-potential-but-currently-low-rated players (e.g. many Top-20-MW prospects) fell
 * through the cracks. See progress-log.md for the before/after distribution.
 * These floors only ever apply to attributes that are NOT already "capped" per
 * getAttributeHeadroom — a genuinely maxed-out attribute never gets bailed out, no
 * matter how large the player's overall potential gap or how good their performance.
 */
const HIGH_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR = 0.78;
const MID_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR = 0.55;
const HIGH_POTENTIAL_GAP_TRAINING_GROWTH_FLOOR = 0.35;
/** Star-gap thresholds (same scale as getPotentialGapXpFactor's tiers). */
const HIGH_POTENTIAL_GAP_STARS_THRESHOLD = 1.5;
const MID_POTENTIAL_GAP_STARS_THRESHOLD = 0.75;
const SIGNATURE_ORGANIC_GROWTH_MULTIPLIER = 1.15;
const WEAK_ORGANIC_GROWTH_MULTIPLIER = 0.8;
/**
 * 2026-07-04 balancing pass: shift weight from pure training towards match performance,
 * concentrated on "mittel" (the default/most-used intensity) so solid performers — not just
 * players with a high potential-gap growth floor — see more of their good match results
 * reflected in progression. "leicht"/"hart" stay at their prior balance. Small and
 * graduated on purpose (+12%); see progress-log.md for the pre/post comparison.
 */
export const PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE: Record<PlayerTrainingMode, number> = {
  leicht: 1.0,
  mittel: 1.12,
  hart: 1.0,
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getFacilityTrainingModifierPct(
  facilities: TeamFacilityCollection | null | undefined,
  developmentTendencyScore = 0,
) {
  const level = getFacilityLevel(facilities, "training_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "training_center").efficiencyPct;
  const levelModifier = TRAINING_CENTER_LEVEL_MODIFIER_PCT[level] ?? TRAINING_CENTER_LEVEL_MODIFIER_PCT.at(-1)!;
  const developmentBonus = roundValue(developmentTendencyScore * 15, 2);
  return roundValue((levelModifier * efficiencyPct) / 100 + developmentBonus, 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeTrainingMode(value: Player["trainingMode"]): PlayerTrainingMode {
  return value === "leicht" || value === "mittel" || value === "hart" ? value : "mittel";
}

export function classNameToDevelopmentRoute(className: ProgressionClassName): PlayerDevelopmentRouteSuggestion {
  if (className === "Berserker" || className === "Warlord" || className === "Tank" || className === "Badass") return "POW";
  if (className === "Sprinter" || className === "Rogue" || className === "Charger") return "SPE";
  if (className === "Mage" || className === "Overseer" || className === "Tactician") return "MEN";
  if (className === "Bard" || className === "Hero" || className === "Templar") return "SOC";
  return "BALANCED";
}

export function resolveTeamTrainingFocusAxis(gameState: GameState, playerId: string) {
  const rosterEntry = gameState.rosters.find((entry) => entry.playerId === playerId);
  if (!rosterEntry) return null;
  const focus = gameState.seasonState.aiManagerTrainingSettings?.[rosterEntry.teamId]?.trainingFocus;
  if (focus === "POW") return "pow" as const;
  if (focus === "SPE") return "spe" as const;
  if (focus === "MEN") return "men" as const;
  if (focus === "SOC") return "soc" as const;
  return null;
}

/** Marktwert für organische Regression — bewusst ohne MVS/displayMarketValue. */
export function getMarktwertForRegression(player: Player) {
  const value = player.marketValue;
  if (!isFiniteNumber(value)) return 0;
  return value > 1000 ? value / 1000 : value;
}

function getPotentialTrainingMultiplierFromRecord(gameState: GameState, player: Player) {
  const record = resolvePlayerPotentialRecordFromGameState({ gameState, playerId: player.id });
  const potential = record?.hiddenPotentialScore ?? null;
  if (potential == null) return 1;
  // Monotonic non-decreasing in potential: high-potential players (80+) share an elevated
  // development plateau so genuine talents grow visibly, while mid/low potential develops
  // slowly (and sub-58 nets below 1.0 so the league median stays roughly flat). This band
  // structure is what widens peak-P90 vs the median instead of lifting the whole league.
  if (potential >= 94) return 2.05;
  if (potential >= 88) return 1.85;
  if (potential >= 80) return 1.6;
  if (potential >= 72) return 1.25;
  if (potential >= 58) return 0.92;
  return 0.72;
}

export function normalizePlayerAttributes(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  const attributes = Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, stats[attribute]]),
  ) as Partial<Record<PlayerGeneratorAttributeName, number | null>>;
  if (!PROGRESSION_ATTRIBUTE_ORDER.every((attribute) => isFiniteNumber(attributes[attribute]))) {
    return null;
  }
  return attributes as PlayerGeneratorAttributes;
}

function normalizeWeights(weights: Partial<Record<PlayerGeneratorAttributeName, number>>) {
  const total = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, attribute) => sum + Math.max(0, weights[attribute] ?? 0), 0);
  if (total <= 0) return Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>;
  return Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, Math.max(0, weights[attribute] ?? 0) / total]),
  ) as Record<PlayerGeneratorAttributeName, number>;
}

function distributeByClassProfile(input: {
  className: string | null | undefined;
  budget: number;
  share: number;
  adminConfig?: GameState["seasonState"]["adminBalancingConfig"];
}) {
  const profile = getClassTrainingProfile(input.className, input.adminConfig);
  const positiveWeights = normalizeWeights(profile);
  const negativeWeightTotal = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, attribute) => sum + Math.abs(Math.min(0, profile[attribute])), 0);
  const deltas = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>;

  for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
    deltas[attribute] += input.budget * input.share * positiveWeights[attribute];
  }

  if (negativeWeightTotal > 0) {
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      const negativeWeight = Math.abs(Math.min(0, profile[attribute]));
      if (negativeWeight <= 0) continue;
      deltas[attribute] -= input.budget * input.share * NEGATIVE_TRAINING_SIDE_EFFECT_SHARE * (negativeWeight / negativeWeightTotal);
    }
  }

  return deltas;
}

function getSecondaryTrainingClass(player: Player, facilities: TeamFacilityCollection | null | undefined) {
  if (getFacilityLevel(facilities, "training_center") < 4) return null;
  const explicit = (player as { secondaryTrainingClass?: string | null }).secondaryTrainingClass;
  return normalizeProgressionClassName(explicit);
}

type PerformanceIndex = {
  byPlayerId: Map<string, PlayerDisciplinePerformanceRecord[]>;
};

const performanceIndexCache = new WeakMap<GameState, PerformanceIndex>();

function getPerformanceIndex(gameState: GameState): PerformanceIndex {
  const cached = performanceIndexCache.get(gameState);
  if (cached) return cached;
  const seasonId = gameState.season.id;
  const validResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((r) => (r.seasonId ?? seasonId) === seasonId)
      .map((r) => r.id),
  );
  const byPlayerId = new Map<string, PlayerDisciplinePerformanceRecord[]>();
  for (const entry of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (!validResultIds.has(entry.matchdayResultId)) continue;
    const existing = byPlayerId.get(entry.playerId);
    if (existing) {
      existing.push(entry);
    } else {
      byPlayerId.set(entry.playerId, [entry]);
    }
  }
  const index: PerformanceIndex = { byPlayerId };
  performanceIndexCache.set(gameState, index);
  return index;
}

function getPerformanceRecords(gameState: GameState, playerId: string): PlayerDisciplinePerformanceRecord[] {
  return getPerformanceIndex(gameState).byPlayerId.get(playerId) ?? [];
}

function getDisciplineWeightDistribution(disciplineId: string) {
  if (!officialDisciplineWeightOrder.includes(disciplineId as OfficialDisciplineWeightId)) {
    return null;
  }
  const id = disciplineId as OfficialDisciplineWeightId;
  const raw = Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, officialDisciplineWeightTable[attribute][id] ?? 0]),
  ) as Record<PlayerGeneratorAttributeName, number>;
  return normalizeWeights(raw);
}

function getPerformanceSetpoints(record: PlayerDisciplinePerformanceRecord) {
  const scoreSignal = clamp((record.finalPlayerScore ?? 0) / 100, 0, 1.25) * 0.28;
  const rankSignal = record.rankInDiscipline === 1 ? 0.72 : record.isTop10 ? 0.42 : record.rankInDiscipline <= 16 ? 0.18 : 0.08;
  const contributionSignal = clamp((record.scoreContribution ?? 0) / 30, 0, 1.2) * 0.22;
  return roundValue((scoreSignal + rankSignal + contributionSignal) * ORGANIC_PERFORMANCE_SETPOINT_SCALE, 3);
}

export type SeasonPerformanceSignals = {
  appearances: number;
  avgPerformanceBudget: number;
  avgFinalScore: number;
  relativePerformanceIndex: number;
  isRostered: boolean;
};

export function buildSeasonPerformanceSignals(input: {
  gameState: GameState;
  playerId: string;
  playerRating: number;
}): SeasonPerformanceSignals {
  const records = getPerformanceRecords(input.gameState, input.playerId);
  const appearances = records.length;
  const isRostered = input.gameState.rosters.some((entry) => entry.playerId === input.playerId);
  if (appearances === 0) {
    return {
      appearances: 0,
      avgPerformanceBudget: 0,
      avgFinalScore: 0,
      relativePerformanceIndex: 0.92,
      isRostered,
    };
  }

  let totalBudget = 0;
  let totalScore = 0;
  for (const record of records) {
    totalBudget += getPerformanceSetpoints(record);
    totalScore += record.finalPlayerScore ?? 0;
  }

  const avgPerformanceBudget = roundValue(totalBudget / appearances, 3);
  const avgFinalScore = roundValue(totalScore / appearances, 1);
  const relativePerformanceIndex = roundValue(avgFinalScore / Math.max(input.playerRating, 40), 2);
  return {
    appearances,
    avgPerformanceBudget,
    avgFinalScore,
    relativePerformanceIndex,
    isRostered,
  };
}

function buildPerformanceDeltas(gameState: GameState, playerId: string) {
  const deltas = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>;
  let totalBudget = 0;

  for (const record of getPerformanceRecords(gameState, playerId)) {
    const distribution = getDisciplineWeightDistribution(record.disciplineId);
    if (!distribution) continue;
    const budget = getPerformanceSetpoints(record);
    totalBudget += budget;
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      deltas[attribute] += budget * distribution[attribute];
    }
  }

  if (totalBudget <= 0) {
    return { deltas, totalBudget: 0 };
  }

  const curvedTotal = roundValue(
    totalBudget <= PERFORMANCE_SEASON_SOFT_KNEE
      ? totalBudget
      : PERFORMANCE_SEASON_SOFT_KNEE + Math.sqrt(totalBudget - PERFORMANCE_SEASON_SOFT_KNEE) * 1.25,
    2,
  );
  if (curvedTotal < totalBudget) {
    const scale = curvedTotal / totalBudget;
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      deltas[attribute] *= scale;
    }
    totalBudget = curvedTotal;
  }

  return {
    deltas,
    totalBudget: roundValue(totalBudget, 2),
  };
}

function getPotentialGapTrainingFactor(gapStars: number) {
  return getPotentialGapXpFactor(gapStars);
}

function buildOrganicRegressionBreakdown(input: {
  marktwertBase: number;
  marketValuePressurePerAttribute: number;
}): OrganicRegressionBreakdown {
  const attributeCount = PROGRESSION_ATTRIBUTE_ORDER.length;
  const baseFlatTotal = roundValue(-ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE * attributeCount, 2);
  const marketValueTotal = roundValue(-input.marketValuePressurePerAttribute * attributeCount, 2);
  return {
    baseFlatTotal,
    marketValueTotal,
    marktwertBase: roundValue(input.marktwertBase, 2),
    marketValuePressureRatePct: roundValue(ORGANIC_MARKET_VALUE_PRESSURE_RATE * 100, 2),
    combinedTotal: roundValue(baseFlatTotal + marketValueTotal, 2),
  };
}

export function resolveOrganicRegressionCombinedTotal(input: {
  regressionCombinedTotal?: number | null;
  regressionBreakdown?: Pick<OrganicRegressionBreakdown, "combinedTotal" | "baseFlatTotal" | "marketValueTotal"> | null;
  marketValuePressureTotal?: number | null;
}) {
  if (input.regressionCombinedTotal != null && Number.isFinite(input.regressionCombinedTotal)) {
    return input.regressionCombinedTotal;
  }
  if (input.regressionBreakdown?.combinedTotal != null && Number.isFinite(input.regressionBreakdown.combinedTotal)) {
    return input.regressionBreakdown.combinedTotal;
  }
  if (
    input.regressionBreakdown?.baseFlatTotal != null &&
    input.regressionBreakdown?.marketValueTotal != null &&
    Number.isFinite(input.regressionBreakdown.baseFlatTotal) &&
    Number.isFinite(input.regressionBreakdown.marketValueTotal)
  ) {
    return roundValue(input.regressionBreakdown.baseFlatTotal + input.regressionBreakdown.marketValueTotal, 2);
  }
  if (input.marketValuePressureTotal != null && Number.isFinite(input.marketValuePressureTotal)) {
    const attributeCount = PROGRESSION_ATTRIBUTE_ORDER.length;
    return roundValue(
      -ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE * attributeCount - input.marketValuePressureTotal,
      2,
    );
  }
  return null;
}

export function getOrganicGrowthMultiplier(affinity: AttributeAffinityKind) {
  if (affinity === "signature") return SIGNATURE_ORGANIC_GROWTH_MULTIPLIER;
  if (affinity === "weak") return WEAK_ORGANIC_GROWTH_MULTIPLIER;
  return 1;
}

function getOrganicPerformanceGrowthMultiplier(input: {
  player: Player;
  attribute: PlayerGeneratorAttributeName;
  record?: PlayerPotentialRecord | null;
  affinityProfile: AttributeAffinityProfile;
  signals: SeasonPerformanceSignals;
  potentialGapStars: number;
}) {
  const affinity = getAttributeAffinityKind(input.attribute, input.affinityProfile);
  const headroom = getAttributeHeadroom({
    player: input.player,
    attribute: input.attribute,
    record: input.record,
  });
  const multiplier = getOrganicGrowthMultiplier(affinity) * getPerformanceHeadroomGrowthMultiplier(headroom.headroom);
  if (input.signals.appearances < 4) return multiplier;
  // A genuinely capped attribute never gets a bailout — the individual cap always wins.
  if (headroom.state === "capped") return multiplier;

  const avgBudget = input.signals.avgPerformanceBudget;
  const gapStars = input.potentialGapStars;

  if (gapStars >= HIGH_POTENTIAL_GAP_STARS_THRESHOLD && avgBudget >= 0.55) {
    return Math.max(multiplier, HIGH_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR);
  }
  if (gapStars >= MID_POTENTIAL_GAP_STARS_THRESHOLD && avgBudget >= 0.38) {
    return Math.max(multiplier, MID_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR);
  }
  return multiplier;
}

function getOrganicTrainingGrowthMultiplier(
  growthMultiplier: number,
  headroomState: AttributeHeadroomState,
  potentialGapStars: number,
  signals: SeasonPerformanceSignals,
) {
  if (
    headroomState === "capped" ||
    potentialGapStars < MID_POTENTIAL_GAP_STARS_THRESHOLD ||
    signals.appearances < 4 ||
    signals.avgPerformanceBudget < 0.38
  ) {
    return growthMultiplier;
  }
  return Math.max(growthMultiplier, HIGH_POTENTIAL_GAP_TRAINING_GROWTH_FLOOR);
}

function applyTrainingGrowthMultiplier(value: number, multiplier: number) {
  if (value === 0) return 0;
  return value * multiplier;
}

function applyPositiveGrowthMultiplier(value: number, multiplier: number) {
  if (value <= 0) return value;
  return value * multiplier;
}

export function buildOrganicSeasonProgression(input: {
  gameState: GameState;
  player: Player;
  facilities?: TeamFacilityCollection | null;
}): OrganicSeasonProgressionResult {
  const attributesBefore = normalizePlayerAttributes(input.player);
  if (!attributesBefore) {
    const empty = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as PlayerGeneratorAttributes;
    return {
      playerId: input.player.id,
      seasonId: input.gameState.season.id,
      classBefore: input.player.className,
      classAfter: "Hero",
      classChanged: false,
      primaryTrainingClass: "Hero",
      secondaryTrainingClass: null,
      trainingMode: normalizeTrainingMode(input.player.trainingMode),
      fatigueLoad: 0,
      potentialRating: isFiniteNumber(input.player.potential) && input.player.potential > 0 ? input.player.potential : null,
      potentialTrainingMultiplier: getPotentialTrainingMultiplierFromRecord(input.gameState, input.player),
      traitTrainingMultiplier: 1,
      traitModifierPct: 0,
      traitBreakdown: [],
      facilityModifierPct: 0,
      baseRegressionPerAttribute: ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE,
      marketValuePressureTotal: 0,
      marketValuePressurePerAttribute: 0,
      marketValueMaintenanceReliefPct: 0,
      trainingSetpoints: 0,
      appliedTrainingSetpoints: 0,
      performanceSetpoints: 0,
      appliedPerformanceSetpoints: 0,
      performanceRegressionTotal: 0,
      performanceRegressionPerAttribute: 0,
      regressionBreakdown: buildOrganicRegressionBreakdown({
        marktwertBase: 0,
        marketValuePressurePerAttribute: 0,
      }),
      netSetpoints: 0,
      topTrainingAttributes: [],
      negativeTrainingRisks: [],
      attributeAffinity: {
        signatureAttributes: ["power", "health"],
        weakAttribute: "torment",
        signatureGrowthMultiplier: SIGNATURE_ORGANIC_GROWTH_MULTIPLIER,
        weakGrowthMultiplier: WEAK_ORGANIC_GROWTH_MULTIPLIER,
      },
      attributeBreakdown: [],
      attributeDeltas: {},
      attributesBefore: empty,
      attributesAfter: empty,
      warnings: [`attribute_source_missing:${input.player.id}`],
    };
  }

  const trainingMode = normalizeTrainingMode(input.player.trainingMode);
  const traitSignal = buildTrainingTraitSignal({
    traitsPositive: input.player.traitsPositive,
    traitsNegative: input.player.traitsNegative,
    adminConfig: input.gameState.seasonState.adminBalancingConfig,
  });
  const playerTeam =
    input.gameState.teams.find((entry) =>
      input.gameState.rosters.some((roster) => roster.teamId === entry.teamId && roster.playerId === input.player.id),
    ) ?? null;
  const playerIdentity = playerTeam
    ? input.gameState.teamIdentities.find((entry) => entry.teamId === playerTeam.teamId) ?? null
    : null;
  const playerProfile = playerTeam ? getTeamStrategyProfile(input.gameState, playerTeam.teamId) : null;
  const developmentTendency = playerTeam
    ? getTeamDevelopmentTendency({ team: playerTeam, identity: playerIdentity, profile: playerProfile })
    : null;
  const facilityModifierPct = getFacilityTrainingModifierPct(input.facilities, developmentTendency?.score ?? 0);
  const primaryTrainingClass =
    normalizeProgressionClassName(input.player.trainingClass) ??
    normalizeProgressionClassName(input.player.className) ??
    calculateDynamicClassName(attributesBefore, input.gameState.seasonState.adminBalancingConfig);
  const secondaryTrainingClass = getSecondaryTrainingClass(input.player, input.facilities);
  const potentialRating = resolvePlayerPotentialRecordFromGameState({ gameState: input.gameState, playerId: input.player.id })?.hiddenPotentialScore ?? null;
  const starSnapshot = buildPlayerStarScoutingSnapshot({
    gameState: input.gameState,
    player: input.player,
    saveId: input.gameState.season.id,
    scoutingLevel: 5,
  });
  const potentialRecord = resolvePlayerPotentialRecordForProgression({
    gameState: input.gameState,
    player: input.player,
  });
  const axisStars = buildPlayerAxisStarProfile({ gameState: input.gameState, player: input.player });
  const axisPoStars = potentialRecord?.hiddenPotentialCeilingByAxis ?? null;
  const potentialGapFactor = getPotentialGapTrainingFactor(starSnapshot.potentialGap);
  const potentialTrainingMultiplier = getPotentialTrainingMultiplierFromRecord(input.gameState, input.player) * potentialGapFactor;
  const baseTrainingBudget = TRAINING_SETPOINTS_BY_MODE[trainingMode];
  const routeBonusMultiplier = getDevelopmentRouteBonusMultiplier(
    classNameToDevelopmentRoute(primaryTrainingClass),
    resolveTeamTrainingFocusAxis(input.gameState, input.player.id),
  );
  const trainingSetpoints = roundValue(
    baseTrainingBudget * traitSignal.trainingTraitMultiplier * potentialTrainingMultiplier * routeBonusMultiplier * (1 + facilityModifierPct / 100),
    2,
  );
  const primaryShare = secondaryTrainingClass ? 0.7 : 1;
  const secondaryShare = secondaryTrainingClass ? 0.3 : 0;
  const primaryTrainingDeltas = distributeByClassProfile({
    className: primaryTrainingClass,
    budget: trainingSetpoints,
    share: primaryShare,
    adminConfig: input.gameState.seasonState.adminBalancingConfig,
  });
  const secondaryTrainingDeltas = secondaryTrainingClass
    ? distributeByClassProfile({
        className: secondaryTrainingClass,
        budget: trainingSetpoints,
        share: secondaryShare,
        adminConfig: input.gameState.seasonState.adminBalancingConfig,
      })
    : (Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>);
  const performance = buildPerformanceDeltas(input.gameState, input.player.id);
  const performanceSignals = buildSeasonPerformanceSignals({
    gameState: input.gameState,
    playerId: input.player.id,
    playerRating: input.player.rating,
  });
  const marktwertBase = getMarktwertForRegression(input.player);
  // B2: soft-knee the market value driving regression so extreme-value stars aren't penalized without bound.
  const marketValuePressurePerAttribute = roundValue(
    softKneeMarketValueForRegression(marktwertBase) * ORGANIC_MARKET_VALUE_PRESSURE_RATE,
    3,
  );
  const marketValuePressureTotal = roundValue(
    marketValuePressurePerAttribute * PROGRESSION_ATTRIBUTE_ORDER.length,
    2,
  );
  const regressionBreakdown = buildOrganicRegressionBreakdown({
    marktwertBase,
    marketValuePressurePerAttribute,
  });
  const affinityProfile = deriveAttributeAffinityProfile(input.player);
  const attributesAfter = { ...attributesBefore };
  const rawAttributeBreakdown = PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => {
    const affinity = getAttributeAffinityKind(attribute, affinityProfile);
    const organicAffinityMult = getOrganicGrowthMultiplier(affinity);
    const attributeHeadroom = getAttributeHeadroom({ player: input.player, attribute, record: potentialRecord });
    const trainingGrowthMultiplier = getCombinedAttributeTrainingMultiplier({
      player: input.player,
      attribute,
      record: potentialRecord,
      axisCaStars: axisStars,
      axisPoStars: axisPoStars ?? undefined,
      affinityGrowthMultiplier: organicAffinityMult,
    });
    const trainingMultiplier = getOrganicTrainingGrowthMultiplier(
      trainingGrowthMultiplier,
      attributeHeadroom.state,
      starSnapshot.potentialGap,
      performanceSignals,
    );
    const performanceGrowthMultiplier = getOrganicPerformanceGrowthMultiplier({
      player: input.player,
      attribute,
      record: potentialRecord,
      affinityProfile,
      signals: performanceSignals,
      potentialGapStars: starSnapshot.potentialGap,
    });
    // B1: headroom-aware regression — a capped/closing attribute plateaus instead of eroding at full
    // speed (mirror of the growth throttle, but gentle). Open attributes keep full regression.
    const regressionHeadroomMultiplier = ORGANIC_REGRESSION_HEADROOM_MULTIPLIER[attributeHeadroom.state] ?? 1;
    const regression =
      -(ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE + marketValuePressurePerAttribute) * regressionHeadroomMultiplier;
    const training = applyTrainingGrowthMultiplier(primaryTrainingDeltas[attribute] + secondaryTrainingDeltas[attribute], trainingMultiplier);
    const performanceDelta =
      applyPositiveGrowthMultiplier(performance.deltas[attribute], performanceGrowthMultiplier) *
      PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE[trainingMode];
    const delta = roundValue(regression + training + performanceDelta, 2);
    const before = attributesBefore[attribute];
    const after = roundValue(clamp(before + delta, 1, 99), 1);
    return {
      attribute,
      before,
      after,
      delta: roundValue(after - before, 2),
      regression: roundValue(regression, 2),
      training: roundValue(training, 2),
      performance: roundValue(performanceDelta, 2),
      affinity,
      trainingGrowthMultiplier,
      performanceGrowthMultiplier,
    };
  });
  const attributeBreakdown = rawAttributeBreakdown;
  const regressionCombinedFromAttributes = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.regression, 0),
    2,
  );
  const regressionBreakdownAligned = {
    ...regressionBreakdown,
    combinedTotal: regressionCombinedFromAttributes,
  };
  const appliedTrainingSetpoints = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0),
    2,
  );
  const appliedPerformanceSetpoints = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.performance, 0),
    2,
  );
  for (const entry of attributeBreakdown) {
    attributesAfter[entry.attribute] = entry.after;
  }
  const attributeDeltas = Object.fromEntries(attributeBreakdown.map((entry) => [entry.attribute, entry.delta])) as Partial<Record<PlayerGeneratorAttributeName, number>>;
  const classAfter = calculateDynamicClassName(attributesAfter, input.gameState.seasonState.adminBalancingConfig);
  const classSignals = getClassTrainingSignals(primaryTrainingClass, input.gameState.seasonState.adminBalancingConfig);
  return {
    playerId: input.player.id,
    seasonId: input.gameState.season.id,
    classBefore: input.player.className,
    classAfter,
    classChanged: classAfter !== input.player.className,
    primaryTrainingClass,
    secondaryTrainingClass,
    trainingMode,
    fatigueLoad: roundValue(
      FATIGUE_LOAD_BY_MODE[trainingMode] * (1 - getRecoveryTrainingFatigueReductionPct(input.facilities) / 100),
      1,
    ),
    potentialRating,
    potentialTrainingMultiplier,
    traitTrainingMultiplier: traitSignal.trainingTraitMultiplier,
    traitModifierPct: roundValue((traitSignal.trainingTraitMultiplier - 1) * 100, 1),
    traitBreakdown: traitSignal.breakdown.map((entry) => ({
      trait: entry.trait,
      legacyTraitTrainingFactorPct: entry.legacyTraitTrainingFactorPct,
      known: entry.known,
      tone:
        (entry.legacyTraitTrainingFactorPct ?? 0) >= 8
          ? ("positive" as const)
          : (entry.legacyTraitTrainingFactorPct ?? 0) <= -8
            ? ("negative" as const)
            : ("neutral" as const),
    })),
    facilityModifierPct,
    baseRegressionPerAttribute: ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE,
    marketValuePressureTotal,
    marketValuePressurePerAttribute,
    marketValueMaintenanceReliefPct: 0,
    trainingSetpoints,
    appliedTrainingSetpoints,
    performanceSetpoints: performance.totalBudget,
    appliedPerformanceSetpoints,
    performanceRegressionTotal: 0,
    performanceRegressionPerAttribute: 0,
    regressionBreakdown: regressionBreakdownAligned,
    netSetpoints: roundValue(attributeBreakdown.reduce((sum, entry) => sum + entry.delta, 0), 2),
    topTrainingAttributes: classSignals.primaryAttributes,
    negativeTrainingRisks: classSignals.negativeRisks,
    attributeAffinity: {
      signatureAttributes: affinityProfile.signatureAttributes,
      weakAttribute: affinityProfile.weakAttribute,
      signatureGrowthMultiplier: SIGNATURE_ORGANIC_GROWTH_MULTIPLIER,
      weakGrowthMultiplier: WEAK_ORGANIC_GROWTH_MULTIPLIER,
    },
    attributeBreakdown,
    attributeDeltas,
    attributesBefore,
    attributesAfter,
    warnings: traitSignal.warnings,
  };
}
