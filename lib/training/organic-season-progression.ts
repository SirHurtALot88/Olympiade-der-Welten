import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributeName,
  PlayerGeneratorAttributes,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { getFacilityEfficiency, getFacilityLevel } from "@/lib/facilities/facility-effects";
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
  resolvePlayerPotentialRecordFromGameState,
} from "@/lib/scouting/player-attribute-ceiling-service";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
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
import { getPlayerDevelopmentBand } from "@/lib/scouting/player-potential-ceiling-service";
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { FATIGUE_LOAD_BY_MODE, TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";
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
  growthMultiplier: number;
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
  performanceSetpoints: number;
  performanceRegressionTotal: number;
  performanceRegressionPerAttribute: number;
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

const BASE_REGRESSION_PER_ATTRIBUTE = 0.12;
const TRAINING_CENTER_LEVEL_MODIFIER_PCT = [0, 10, 20, 30, 40, 50] as const;
const MARKET_VALUE_PRESSURE_RATE = 0.02;
const NEGATIVE_TRAINING_SIDE_EFFECT_SHARE = 0.14;
const PERFORMANCE_SETPOINT_CAP = 2.0;
const SEASON_NET_SOFT_GAIN_TARGET = 1.8;
const SEASON_NET_HARD_GAIN_CAP = 3.8;
const SEASON_NET_HARD_LOSS_CAP = -4.0;
const SIGNATURE_ORGANIC_GROWTH_MULTIPLIER = 1.15;
const WEAK_ORGANIC_GROWTH_MULTIPLIER = 0.8;

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

function getDisplayMarketValue(player: Player) {
  const value =
    isFiniteNumber((player as { displayMarketValue?: number | null }).displayMarketValue)
      ? (player as { displayMarketValue?: number | null }).displayMarketValue
      : player.marketValue;
  if (!isFiniteNumber(value)) return 0;
  return value > 1000 ? value / 1000 : value;
}

function getPotentialTrainingMultiplierFromRecord(gameState: GameState, player: Player) {
  const record = resolvePlayerPotentialRecordFromGameState({ gameState, playerId: player.id });
  const potential = record?.hiddenPotentialScore ?? null;
  if (potential == null) return 1;
  if (potential >= 94) return 1.18;
  if (potential >= 88) return 1.14;
  if (potential >= 80) return 1.09;
  if (potential >= 72) return 1.04;
  if (potential >= 58) return 1;
  return 0.94;
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

function getPerformanceRecords(gameState: GameState, playerId: string) {
  return (gameState.seasonState.playerDisciplinePerformances ?? []).filter((entry) => {
    if (entry.playerId !== playerId) return false;
    const result = (gameState.seasonState.matchdayResults ?? []).find((candidate) => candidate.id === entry.matchdayResultId);
    return (result?.seasonId ?? gameState.season.id) === gameState.season.id;
  });
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
  return roundValue(scoreSignal + rankSignal + contributionSignal, 3);
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

function getMarketValueMaintenanceRelief(signals: SeasonPerformanceSignals, player: Player) {
  if (signals.appearances < 4) return 0;
  const isStar = player.rating >= 72;
  const rpi = signals.relativePerformanceIndex;
  const avgBudget = signals.avgPerformanceBudget;

  if (rpi >= 1.04 && avgBudget >= 0.52) return isStar ? 0.85 : 0.45;
  if (rpi >= 0.96 && avgBudget >= 0.45) return isStar ? 0.65 : 0.25;
  if (rpi >= 0.9 && avgBudget >= 0.4 && isStar) return 0.35;
  return 0;
}

function getPerformanceRegressionPerAttribute(input: {
  signals: SeasonPerformanceSignals;
  player: Player;
}) {
  const marketValue = getDisplayMarketValue(input.player);
  const isHighValue = marketValue >= 40;
  const isStar = input.player.rating >= 72;
  const isMidTier = input.player.rating >= 40 && input.player.rating < 72;

  if (input.signals.appearances === 0) {
    if (input.signals.isRostered) return roundValue(isStar ? 0.06 : 0.04, 3);
    return 0;
  }

  const rpi = input.signals.relativePerformanceIndex;
  const avgBudget = input.signals.avgPerformanceBudget;

  if (input.signals.appearances >= 4 && rpi >= 0.94 && avgBudget >= 0.45) {
    if (isStar && rpi >= 1.02 && avgBudget >= 0.55) return -0.22;
    if (isStar && rpi >= 0.96 && avgBudget >= 0.48) return -0.08;
    return 0;
  }

  let penalty = 0;

  if (input.signals.appearances >= 4) {
    if (avgBudget < 0.15) penalty += isMidTier ? 0.18 : 0.14;
    else if (avgBudget < 0.35) penalty += isMidTier ? 0.32 : 0.2;
    else if (avgBudget < 0.5) penalty += isMidTier ? 0.1 : 0.04;
  }

  if (rpi < 0.7) penalty += isMidTier ? 0.14 : 0.1;
  else if (rpi < 0.82) penalty += isMidTier ? 0.1 : 0.05;

  if ((isHighValue || isStar) && input.signals.appearances >= 4 && rpi < 0.78) {
    penalty += isHighValue ? 0.08 : 0.05;
  }

  return roundValue(penalty, 3);
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

  if (totalBudget > PERFORMANCE_SETPOINT_CAP && totalBudget > 0) {
    const scale = PERFORMANCE_SETPOINT_CAP / totalBudget;
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      deltas[attribute] *= scale;
    }
    totalBudget = PERFORMANCE_SETPOINT_CAP;
  }

  return {
    deltas,
    totalBudget: roundValue(totalBudget, 2),
  };
}

function getPotentialGapTrainingFactor(gapStars: number) {
  return getPotentialGapXpFactor(gapStars);
}

function rebalanceOrganicSeasonNet(breakdown: OrganicProgressionAttributeBreakdown[]) {
  const currentNet = roundValue(breakdown.reduce((sum, entry) => sum + entry.delta, 0), 2);
  let targetNet = currentNet;

  if (currentNet > SEASON_NET_HARD_GAIN_CAP) {
    targetNet = SEASON_NET_HARD_GAIN_CAP;
  } else if (currentNet > SEASON_NET_SOFT_GAIN_TARGET) {
    targetNet = roundValue(
      SEASON_NET_SOFT_GAIN_TARGET + (currentNet - SEASON_NET_SOFT_GAIN_TARGET) * 0.25,
      2,
    );
  } else if (currentNet < SEASON_NET_HARD_LOSS_CAP) {
    targetNet = SEASON_NET_HARD_LOSS_CAP;
  }

  if (targetNet === currentNet) return breakdown;

  const adjustment = roundValue(targetNet - currentNet, 2);

  if (adjustment > 0) {
    const regressionTotal = breakdown.reduce((sum, entry) => sum + Math.abs(Math.min(0, entry.regression)), 0);
    if (regressionTotal <= 0) return breakdown;
    return breakdown.map((entry) => {
      if (entry.regression >= 0) return entry;
      const share = Math.abs(entry.regression) / regressionTotal;
      const regression = roundValue(entry.regression + adjustment * share, 2);
      const delta = roundValue(regression + entry.training + entry.performance, 2);
      return {
        ...entry,
        regression,
        delta,
        after: roundValue(clamp(entry.before + delta, 1, 99), 1),
      };
    });
  }

  const positiveTotal = breakdown.reduce(
    (sum, entry) => sum + Math.max(0, entry.training) + Math.max(0, entry.performance),
    0,
  );
  if (positiveTotal <= 0) return breakdown;

  const positiveScale = Math.max(0, roundValue((positiveTotal + adjustment) / positiveTotal, 4));
  return breakdown.map((entry) => {
    const training = entry.training > 0 ? roundValue(entry.training * positiveScale, 2) : entry.training;
    const performance = entry.performance > 0 ? roundValue(entry.performance * positiveScale, 2) : entry.performance;
    const delta = roundValue(entry.regression + training + performance, 2);
    return {
      ...entry,
      training,
      performance,
      delta,
      after: roundValue(clamp(entry.before + delta, 1, 99), 1),
    };
  });
}

function getValueRatioRegressionPenalty(fairValueRatio: number | null) {
  if (fairValueRatio == null || fairValueRatio <= 1.2) return 0;
  return roundValue((fairValueRatio - 1.2) * 0.35, 3);
}

function getAgeRegressionModifier(band: "youth" | "peak" | "veteran") {
  if (band === "youth") return -0.08;
  if (band === "veteran") return 0.15;
  return 0;
}

function getOrganicGrowthMultiplier(affinity: AttributeAffinityKind) {
  if (affinity === "signature") return SIGNATURE_ORGANIC_GROWTH_MULTIPLIER;
  if (affinity === "weak") return WEAK_ORGANIC_GROWTH_MULTIPLIER;
  return 1;
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
      baseRegressionPerAttribute: BASE_REGRESSION_PER_ATTRIBUTE,
      marketValuePressureTotal: 0,
      marketValuePressurePerAttribute: 0,
      marketValueMaintenanceReliefPct: 0,
      trainingSetpoints: 0,
      performanceSetpoints: 0,
      performanceRegressionTotal: 0,
      performanceRegressionPerAttribute: 0,
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
    calculateDynamicClassName(attributesBefore, input.gameState.seasonState.adminBalancingConfig);
  const secondaryTrainingClass = getSecondaryTrainingClass(input.player, input.facilities);
  const potentialRating = resolvePlayerPotentialRecordFromGameState({ gameState: input.gameState, playerId: input.player.id })?.hiddenPotentialScore ?? null;
  const starSnapshot = buildPlayerStarScoutingSnapshot({
    gameState: input.gameState,
    player: input.player,
    saveId: input.gameState.season.id,
    scoutingLevel: 5,
  });
  const potentialRecord = resolvePlayerPotentialRecordFromGameState({ gameState: input.gameState, playerId: input.player.id });
  const axisStars = buildPlayerAxisStarProfile({ gameState: input.gameState, player: input.player });
  const axisPoStars = potentialRecord?.hiddenPotentialCeilingByAxis ?? null;
  const developmentBand = getPlayerDevelopmentBand(input.player);
  const potentialGapFactor = getPotentialGapTrainingFactor(starSnapshot.potentialGap);
  const valueRatioPenalty = getValueRatioRegressionPenalty(starSnapshot.fairValueRatio);
  const ageRegressionModifier = getAgeRegressionModifier(developmentBand);
  const potentialTrainingMultiplier = getPotentialTrainingMultiplierFromRecord(input.gameState, input.player) * potentialGapFactor;
  const baseTrainingBudget = TRAINING_SETPOINTS_BY_MODE[trainingMode];
  const trainingSetpoints = roundValue(
    baseTrainingBudget * traitSignal.trainingTraitMultiplier * potentialTrainingMultiplier * (1 + facilityModifierPct / 100),
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
  const performanceRegressionPerAttribute = getPerformanceRegressionPerAttribute({
    signals: performanceSignals,
    player: input.player,
  });
  const performanceRegressionTotal = roundValue(performanceRegressionPerAttribute * PROGRESSION_ATTRIBUTE_ORDER.length, 2);
  const marketValueMaintenanceReliefPct = getMarketValueMaintenanceRelief(performanceSignals, input.player);
  const marketValuePressureTotal = roundValue(getDisplayMarketValue(input.player) * MARKET_VALUE_PRESSURE_RATE, 2);
  const marketValuePressurePerAttribute = roundValue(
    (marketValuePressureTotal / PROGRESSION_ATTRIBUTE_ORDER.length + valueRatioPenalty / PROGRESSION_ATTRIBUTE_ORDER.length) *
      (1 - marketValueMaintenanceReliefPct),
    3,
  );
  const affinityProfile = deriveAttributeAffinityProfile(input.player);
  const attributesAfter = { ...attributesBefore };
  const rawAttributeBreakdown = PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => {
    const affinity = getAttributeAffinityKind(attribute, affinityProfile);
    const organicAffinityMult = getOrganicGrowthMultiplier(affinity);
    const growthMultiplier = getCombinedAttributeTrainingMultiplier({
      player: input.player,
      attribute,
      record: potentialRecord,
      axisCaStars: axisStars,
      axisPoStars: axisPoStars ?? undefined,
      affinityGrowthMultiplier: organicAffinityMult,
    });
    const regression = -(
      BASE_REGRESSION_PER_ATTRIBUTE +
      marketValuePressurePerAttribute +
      ageRegressionModifier +
      performanceRegressionPerAttribute
    );
    const training = applyTrainingGrowthMultiplier(primaryTrainingDeltas[attribute] + secondaryTrainingDeltas[attribute], growthMultiplier);
    const performanceDelta = applyPositiveGrowthMultiplier(performance.deltas[attribute], growthMultiplier);
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
      growthMultiplier,
    };
  });
  const attributeBreakdown = rebalanceOrganicSeasonNet(rawAttributeBreakdown);
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
    fatigueLoad: roundValue(FATIGUE_LOAD_BY_MODE[trainingMode] * (1 - Math.min(getFacilityLevel(input.facilities, "recovery_center") * 0.04, 0.2)), 1),
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
    baseRegressionPerAttribute: BASE_REGRESSION_PER_ATTRIBUTE,
    marketValuePressureTotal,
    marketValuePressurePerAttribute,
    marketValueMaintenanceReliefPct: roundValue(marketValueMaintenanceReliefPct * 100, 1),
    trainingSetpoints,
    performanceSetpoints: performance.totalBudget,
    performanceRegressionTotal,
    performanceRegressionPerAttribute,
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
