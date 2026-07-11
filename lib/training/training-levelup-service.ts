import type { GameState, Player, PlayerGeneratorAttributeName, PlayerPotentialRecord, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  getAttributeGrowthMultiplier,
  getAttributeHeadroom,
  type AttributeHeadroomState,
} from "@/lib/scouting/player-attribute-ceiling-service";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  playerGeneratorAttributeKeys,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";
import {
  DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON,
  DEVELOPMENT_POINTS_PER_LEVEL,
  getDevelopmentLevelProgress,
  getDevelopmentLevelUpsFromXp,
  getDevelopmentXpForLevel,
} from "@/lib/training/development-level-curve";
import type { PlayerDevelopmentRoute, PlayerProgressionForecast, PlayerRegressionRisk } from "@/lib/training/training-plan-types";

export { DEVELOPMENT_POINTS_PER_LEVEL };
export const DEVELOPMENT_XP_PER_LEVEL = getDevelopmentXpForLevel(1);
export const DEVELOPMENT_MAX_ATTRIBUTE_VALUE = 99;

export const TRAINING_ATTRIBUTE_LABELS: Record<PlayerGeneratorAttributeName, string> = {
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

export type AttributeAffinityKind = "signature" | "weak" | "neutral";

export type AttributeAffinityProfile = {
  playerId: string;
  signatureAttributes: [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  weakAttribute: PlayerGeneratorAttributeName;
  reasons: string[];
};

export type TrainingPointCost = {
  attribute: PlayerGeneratorAttributeName;
  value: number | null;
  baseCost: number | null;
  modifier: -1 | 0 | 1;
  finalCost: number | null;
  affinity: AttributeAffinityKind;
  reason: string;
  blocked: boolean;
  blockReason: string | null;
};

export type DevelopmentDisciplineDelta = {
  disciplineId: OfficialDisciplineWeightId;
  label: string;
  delta: number;
};

export type DevelopmentAttributePreview = TrainingPointCost & {
  label: string;
  currentValue: number | null;
  nextValue: number | null;
  trainingPointsBefore: number;
  trainingPointsAfter: number | null;
  attributeDelta: number;
  topDisciplineDeltas: DevelopmentDisciplineDelta[];
  currentRatingDelta: number;
  marketValuePreviewDelta: number | null;
  expectedSalaryPreviewDelta: number | null;
  contractSalaryStable: true;
  ceilingState?: AttributeHeadroomState;
  headroomPoints?: number | null;
  growthMultiplier?: number;
};

export type DevelopmentLevelSummary = {
  playerId: string;
  developmentLevel: number;
  progressXp: number;
  progressPct: number;
  xpForCurrentLevel: number;
  xpToNextLevel: number;
  rawLevelUpsAvailable: number;
  levelUpsAvailable: number;
  seasonLevelUpCap: number;
  trainingPointsAvailable: number;
  lifetimeDevelopmentXp: number;
  netDevelopmentXP: number;
  regressionDebt: number;
  regressionRisk: PlayerRegressionRisk | "unknown";
  trainingForm: string;
  developmentRoute: PlayerDevelopmentRoute | "unknown";
  lastTrend: "growth" | "stable" | "stagnation" | "regression";
};

export type SignatureShiftPreview = {
  playerId: string;
  canShift: boolean;
  oldSignatureAttributes: [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  newSignatureAttributes: [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  oldWeakAttribute: PlayerGeneratorAttributeName;
  newWeakAttribute: PlayerGeneratorAttributeName;
  reason: string;
  notification: string | null;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getSeasonalRouteAttributeCandidates(route?: PlayerDevelopmentRoute | null): PlayerGeneratorAttributeName[] {
  if (route === "star_growth") {
    return ["determination", "charisma", "stamina", "awareness", "power"];
  }
  if (route === "core_growth") {
    return ["awareness", "stamina", "will", "dexterity", "health", "intelligence"];
  }
  if (route === "prospect_growth") {
    return ["stamina", "determination", "speed", "health", "awareness"];
  }
  if (route === "depth_growth") {
    return ["spirit", "health", "dexterity", "will", "stamina"];
  }
  if (route === "maintenance" || route === "stagnation_watch") {
    return ["health", "stamina", "spirit", "awareness"];
  }
  return [];
}

function chooseSeasonalRouteAttribute(input: {
  playerId: string;
  seasonId?: string | null;
  route?: PlayerDevelopmentRoute | null;
  currentProfile: AttributeAffinityProfile;
}) {
  const candidates = getSeasonalRouteAttributeCandidates(input.route).filter(
    (attribute) => attribute !== input.currentProfile.signatureAttributes[0],
  );
  if (candidates.length === 0) {
    return null;
  }
  const seed = `${input.playerId}:${input.seasonId ?? "no-season"}:${input.route ?? "no-route"}`;
  const start = hashString(seed) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length];
    if (candidate && candidate !== input.currentProfile.signatureAttributes[0]) {
      return candidate;
    }
  }
  return null;
}

export type AiTrainingPointAllocation = {
  playerId: string;
  teamId: string | null;
  recommendedAttributes: PlayerGeneratorAttributeName[];
  spendPlan: Array<{
    attribute: PlayerGeneratorAttributeName;
    cost: number;
    reason: string;
  }>;
  pointsSpent: number;
  pointsRemaining: number;
  reasons: string[];
};

export type DevelopmentRegressionEventPreview = {
  playerId: string;
  attribute: PlayerGeneratorAttributeName | null;
  delta: 0 | -1;
  risk: PlayerRegressionRisk | "unknown";
  reason: string;
  visible: boolean;
};

export type PlayerDevelopmentLevelupModel = {
  playerId: string;
  playerName: string;
  level: DevelopmentLevelSummary;
  affinity: AttributeAffinityProfile;
  costs: TrainingPointCost[];
  upgradePreview: DevelopmentAttributePreview[];
  regressionEvent: DevelopmentRegressionEventPreview;
  signatureShift: SignatureShiftPreview;
  aiAllocation: AiTrainingPointAllocation;
  notifications: string[];
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getAttributeTrainingPointBaseCost(value: number | null | undefined): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value >= DEVELOPMENT_MAX_ATTRIBUTE_VALUE) return null;
  if (value <= 30) return 1;
  if (value <= 60) return 2;
  if (value <= 85) return 3;
  return 4;
}

function getPlayerAttributeValue(player: Player, attribute: PlayerGeneratorAttributeName): number | null {
  const value = player.attributeSheetStats?.[attribute];
  return isFiniteNumber(value) ? value : null;
}

function hasTrait(player: Player, values: string[]) {
  const tokens = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? []), player.className, player.race, ...player.subclasses].join(" ").toLowerCase();
  return values.some((value) => tokens.includes(value.toLowerCase()));
}

function pushUnique<T>(target: T[], value: T) {
  if (!target.includes(value)) target.push(value);
}

function stableTrainingAllocationHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deriveAttributeAffinityProfile(player: Player): AttributeAffinityProfile {
  const signatureCandidates: PlayerGeneratorAttributeName[] = [];
  const weakCandidates: PlayerGeneratorAttributeName[] = [];
  const reasons: string[] = [];

  const className = player.className.toLowerCase();
  if (className.includes("mage") || hasTrait(player, ["wizard", "scholar", "oracle"])) {
    pushUnique(signatureCandidates, "intelligence");
    pushUnique(signatureCandidates, "will");
    reasons.push("mental_class_or_subclass");
  }
  if (className.includes("tank") || hasTrait(player, ["guardian", "warrior", "brute"])) {
    pushUnique(signatureCandidates, "health");
    pushUnique(signatureCandidates, "stamina");
    reasons.push("durable_role");
  }
  if (className.includes("charger") || className.includes("rogue") || hasTrait(player, ["runner", "assassin", "swift"])) {
    pushUnique(signatureCandidates, "speed");
    pushUnique(signatureCandidates, "dexterity");
    reasons.push("speed_role");
  }
  if (className.includes("hero") || className.includes("warlord") || hasTrait(player, ["leader", "loyal", "ambitious"])) {
    pushUnique(signatureCandidates, "determination");
    pushUnique(signatureCandidates, "charisma");
    reasons.push("leader_role");
  }
  if (className.includes("badass") || hasTrait(player, ["fearless", "chaos", "demon"])) {
    pushUnique(signatureCandidates, "power");
    pushUnique(signatureCandidates, "torment");
    reasons.push("high_impact_role");
  }
  if (hasTrait(player, ["diligent", "disciplined", "motivated"])) {
    pushUnique(signatureCandidates, "determination");
    pushUnique(signatureCandidates, "stamina");
    reasons.push("positive_training_traits");
  }
  if (hasTrait(player, ["diva", "lazy", "fainthearted"])) {
    pushUnique(weakCandidates, "determination");
    pushUnique(weakCandidates, "stamina");
    reasons.push("negative_training_traits");
  }
  if (hasTrait(player, ["obsessive", "paranoid"])) {
    pushUnique(weakCandidates, "spirit");
    reasons.push("volatile_trait_pressure");
  }

  const sortedAttributes = [...playerGeneratorAttributeKeys]
    .map((attribute) => ({ attribute: attribute as PlayerGeneratorAttributeName, value: getPlayerAttributeValue(player, attribute as PlayerGeneratorAttributeName) ?? -1 }))
    .sort((left, right) => right.value - left.value);
  for (const entry of sortedAttributes) {
    pushUnique(signatureCandidates, entry.attribute);
    if (signatureCandidates.length >= 4) break;
  }

  const lowToHigh = [...sortedAttributes].sort((left, right) => left.value - right.value);
  for (const entry of lowToHigh) {
    pushUnique(weakCandidates, entry.attribute);
    if (weakCandidates.length >= 3) break;
  }

  const signatureAttributes = signatureCandidates
    .filter((attribute, index, list) => list.indexOf(attribute) === index)
    .slice(0, 2) as [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  while (signatureAttributes.length < 2) {
    signatureAttributes.push(playerGeneratorAttributeKeys[signatureAttributes.length] as PlayerGeneratorAttributeName);
  }
  const weakAttribute =
    weakCandidates.find((attribute) => !signatureAttributes.includes(attribute)) ??
    lowToHigh.find((entry) => !signatureAttributes.includes(entry.attribute))?.attribute ??
    "torment";

  return {
    playerId: player.id,
    signatureAttributes,
    weakAttribute,
    reasons: reasons.length > 0 ? reasons : ["attribute_profile_fallback"],
  };
}

export function getAttributeAffinityKind(attribute: PlayerGeneratorAttributeName, profile: AttributeAffinityProfile): AttributeAffinityKind {
  if (profile.signatureAttributes.includes(attribute)) return "signature";
  if (profile.weakAttribute === attribute) return "weak";
  return "neutral";
}

export function getAttributeTrainingPointCost(input: {
  value: number | null | undefined;
  attribute: PlayerGeneratorAttributeName;
  affinity: AttributeAffinityProfile;
  player?: Player;
  potentialRecord?: PlayerPotentialRecord | null;
}): TrainingPointCost {
  const baseCost = getAttributeTrainingPointBaseCost(input.value);
  const affinity = getAttributeAffinityKind(input.attribute, input.affinity);
  const modifier = affinity === "signature" ? -1 : affinity === "weak" ? 1 : 0;
  let blocked = !isFiniteNumber(input.value) || input.value >= DEVELOPMENT_MAX_ATTRIBUTE_VALUE;
  let blockReason: string | null = blocked
    ? isFiniteNumber(input.value) && input.value >= DEVELOPMENT_MAX_ATTRIBUTE_VALUE
      ? "attribute_at_99"
      : "attribute_value_missing"
    : null;
  if (input.player) {
    const headroom = getAttributeHeadroom({
      player: input.player,
      attribute: input.attribute,
      record: input.potentialRecord,
    });
    if (headroom.state === "capped") {
      blocked = true;
      blockReason = "potential_ceiling_reached";
    }
  }
  const finalCost = baseCost == null || blocked ? null : Math.max(1, baseCost + modifier);
  return {
    attribute: input.attribute,
    value: isFiniteNumber(input.value) ? input.value : null,
    baseCost,
    modifier,
    finalCost,
    affinity,
    reason:
      blockReason === "potential_ceiling_reached"
        ? "Route-/Attribut-Decke erreicht — kaum noch Entwicklung moeglich."
        : affinity === "signature"
          ? "Signature: Dieses Attribut entwickelt sich bei diesem Spieler guenstiger."
          : affinity === "weak"
            ? "Weak Development: Dieses Attribut ist fuer diesen Spieler schwerer zu steigern."
            : "Neutral: normale Attributkosten.",
    blocked,
    blockReason,
  };
}

export function buildDevelopmentLevelSummary(input: {
  player: Player;
  forecast?: PlayerProgressionForecast | null;
  currentXP?: number | null;
  spentXP?: number | null;
  lifetimeXP?: number | null;
}): DevelopmentLevelSummary {
  const netDevelopmentXP = input.forecast?.netDevelopmentXP ?? 0;
  const currentXP = input.currentXP ?? input.forecast?.currentXP ?? input.player.currentXP ?? 0;
  const spentXP = input.spentXP ?? input.forecast?.spentXP ?? input.player.spentXP ?? 0;
  const lifetimeDevelopmentXp = Math.max(0, input.lifetimeXP ?? input.player.lifetimeXP ?? currentXP + spentXP + Math.max(0, netDevelopmentXP));
  const levelProgress = getDevelopmentLevelProgress(lifetimeDevelopmentXp);
  const seasonalLevelXp = Math.max(0, input.forecast ? netDevelopmentXP : currentXP);
  const rawLevelUpsAvailable = getDevelopmentLevelUpsFromXp({
    startLevel: levelProgress.developmentLevel,
    availableXp: seasonalLevelXp,
  }).levelUps;
  const levelUpsAvailable = getDevelopmentLevelUpsFromXp({
    startLevel: levelProgress.developmentLevel,
    availableXp: seasonalLevelXp,
    maxLevelUps: DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON,
  }).levelUps;
  const regressionDebt = Math.max(0, -netDevelopmentXP);
  const lastTrend =
    netDevelopmentXP >= levelProgress.xpForCurrentLevel * 0.45 ? "growth" : netDevelopmentXP > 20 ? "stable" : netDevelopmentXP < -25 ? "regression" : "stagnation";
  return {
    playerId: input.player.id,
    developmentLevel: levelProgress.developmentLevel,
    progressXp: levelProgress.progressXp,
    progressPct: levelProgress.progressPct,
    xpForCurrentLevel: levelProgress.xpForCurrentLevel,
    xpToNextLevel: levelProgress.xpToNextLevel,
    rawLevelUpsAvailable,
    levelUpsAvailable,
    seasonLevelUpCap: DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON,
    trainingPointsAvailable: levelUpsAvailable * DEVELOPMENT_POINTS_PER_LEVEL,
    lifetimeDevelopmentXp,
    netDevelopmentXP,
    regressionDebt,
    regressionRisk: input.forecast?.regressionRisk ?? "unknown",
    trainingForm: input.forecast?.trainingFormTier ?? "unknown",
    developmentRoute: input.forecast?.developmentRoute ?? "unknown",
    lastTrend,
  };
}

function getTopDisciplineDeltas(attribute: PlayerGeneratorAttributeName, steps: number): DevelopmentDisciplineDelta[] {
  return officialDisciplineWeightOrder
    .map((disciplineId) => ({
      disciplineId,
      label: officialDisciplineWeightLabels[disciplineId],
      delta: round((officialDisciplineWeightTable[attribute][disciplineId] / 100) * steps, 2),
    }))
    .filter((entry) => entry.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 5);
}

function estimateRatingDelta(attribute: PlayerGeneratorAttributeName, steps: number) {
  const coreWeight: Partial<Record<PlayerGeneratorAttributeName, number>> = {
    power: 0.26,
    health: 0.18,
    stamina: 0.2,
    speed: 0.26,
    dexterity: 0.22,
    intelligence: 0.26,
    awareness: 0.22,
    determination: 0.18,
    charisma: 0.24,
    will: 0.2,
    spirit: 0.2,
    torment: 0.16,
  };
  return round((coreWeight[attribute] ?? 0.18) * steps, 2);
}

export function buildUpgradePreview(input: {
  player: Player;
  level: DevelopmentLevelSummary;
  affinity: AttributeAffinityProfile;
  economy?: ReturnType<typeof resolvePlayerEconomyContract> | null;
  potentialRecord?: PlayerPotentialRecord | null;
}): DevelopmentAttributePreview[] {
  const economy = input.economy ?? resolvePlayerEconomyContract({ playerId: input.player.id, player: input.player, rosterEntry: null });
  return playerGeneratorAttributeKeys.map((attributeKey) => {
    const attribute = attributeKey as PlayerGeneratorAttributeName;
    const currentValue = getPlayerAttributeValue(input.player, attribute);
    const headroom = getAttributeHeadroom({
      player: input.player,
      attribute,
      record: input.potentialRecord,
    });
    const cost = getAttributeTrainingPointCost({
      value: currentValue,
      attribute,
      affinity: input.affinity,
      player: input.player,
      potentialRecord: input.potentialRecord,
    });
    const canAfford = cost.finalCost != null && input.level.trainingPointsAvailable >= cost.finalCost;
    const nextValue = isFiniteNumber(currentValue) && !cost.blocked && canAfford ? Math.min(DEVELOPMENT_MAX_ATTRIBUTE_VALUE, currentValue + 1) : currentValue;
    const currentRatingDelta = cost.finalCost != null && canAfford ? estimateRatingDelta(attribute, 1) : 0;
    const marketValuePreviewDelta = economy.marketValue != null ? round(economy.marketValue * currentRatingDelta * 0.012, 2) : null;
    const expectedSalaryPreviewDelta = economy.salary != null ? round(economy.salary * currentRatingDelta * 0.01, 2) : null;
    return {
      ...cost,
      label: TRAINING_ATTRIBUTE_LABELS[attribute],
      currentValue,
      nextValue,
      trainingPointsBefore: input.level.trainingPointsAvailable,
      trainingPointsAfter: cost.finalCost != null && canAfford ? input.level.trainingPointsAvailable - cost.finalCost : null,
      attributeDelta: nextValue != null && currentValue != null ? nextValue - currentValue : 0,
      topDisciplineDeltas: getTopDisciplineDeltas(attribute, nextValue != null && currentValue != null ? nextValue - currentValue : 0),
      currentRatingDelta,
      marketValuePreviewDelta,
      expectedSalaryPreviewDelta,
      contractSalaryStable: true,
      ceilingState: headroom.state,
      headroomPoints: headroom.headroom,
      growthMultiplier: getAttributeGrowthMultiplier(headroom.state),
    };
  });
}

export function buildRegressionEventPreview(input: {
  player: Player;
  level: DevelopmentLevelSummary;
  forecast?: PlayerProgressionForecast | null;
  affinity: AttributeAffinityProfile;
}): DevelopmentRegressionEventPreview {
  const severeRisk = input.level.regressionRisk === "high";
  const shouldLoseAttribute = input.level.regressionDebt >= input.level.xpForCurrentLevel * 0.75 && severeRisk;
  if (!shouldLoseAttribute) {
    return {
      playerId: input.player.id,
      attribute: null,
      delta: 0,
      risk: input.level.regressionRisk,
      reason: input.level.regressionDebt > 0 ? "regression_debt_visible_no_attribute_loss" : "no_regression_debt",
      visible: input.level.regressionDebt > 0,
    };
  }
  return {
    playerId: input.player.id,
    attribute: input.affinity.weakAttribute,
    delta: -1,
    risk: input.level.regressionRisk,
    reason: "high_regression_debt_hits_weak_development_attribute",
    visible: true,
  };
}

export function buildSignatureShiftPreview(input: {
  player: Player;
  currentProfile: AttributeAffinityProfile;
  route?: PlayerDevelopmentRoute | null;
  seasonId?: string | null;
  seasonShiftAlreadyUsed?: boolean;
}): SignatureShiftPreview {
  if (input.seasonShiftAlreadyUsed) {
    return {
      playerId: input.player.id,
      canShift: false,
      oldSignatureAttributes: input.currentProfile.signatureAttributes,
      newSignatureAttributes: input.currentProfile.signatureAttributes,
      oldWeakAttribute: input.currentProfile.weakAttribute,
      newWeakAttribute: input.currentProfile.weakAttribute,
      reason: "signature_shift_limit_reached",
      notification: null,
    };
  }
  const route = input.route ?? null;
  const routeAttribute = chooseSeasonalRouteAttribute({
    playerId: input.player.id,
    seasonId: input.seasonId ?? null,
    route,
    currentProfile: input.currentProfile,
  });
  if (!routeAttribute || input.currentProfile.signatureAttributes.includes(routeAttribute)) {
    return {
      playerId: input.player.id,
      canShift: false,
      oldSignatureAttributes: input.currentProfile.signatureAttributes,
      newSignatureAttributes: input.currentProfile.signatureAttributes,
      oldWeakAttribute: input.currentProfile.weakAttribute,
      newWeakAttribute: input.currentProfile.weakAttribute,
      reason: "no_route_shift_needed",
      notification: null,
    };
  }
  const newSignatureAttributes = [input.currentProfile.signatureAttributes[0], routeAttribute] as [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  return {
    playerId: input.player.id,
    canShift: true,
    oldSignatureAttributes: input.currentProfile.signatureAttributes,
    newSignatureAttributes,
    oldWeakAttribute: input.currentProfile.weakAttribute,
    newWeakAttribute: input.currentProfile.weakAttribute,
    reason: `seasonal_development_route_shift:${route ?? "unknown"}:${input.seasonId ?? "no-season"}`,
    notification: `Development Shift: ${input.player.name} behaelt ${TRAINING_ATTRIBUTE_LABELS[newSignatureAttributes[0]]} als Signature, aber ${TRAINING_ATTRIBUTE_LABELS[input.currentProfile.signatureAttributes[1]]} wurde durch ${TRAINING_ATTRIBUTE_LABELS[routeAttribute]} ersetzt. Grund: ${route ?? "Season-Fokus"}.`,
  };
}

function getTeamStrategyAttributeBias(profile?: TeamStrategyProfile | null): PlayerGeneratorAttributeName[] {
  const result: PlayerGeneratorAttributeName[] = [];
  const axisAttributeBiasSource: Array<{
    axis: "pow" | "spe" | "men" | "soc";
    value: number;
    attributes: PlayerGeneratorAttributeName[];
  }> = [
    { axis: "pow", value: profile?.powBias ?? 0, attributes: ["power", "health", "stamina"] },
    { axis: "spe", value: profile?.speBias ?? 0, attributes: ["speed", "dexterity", "awareness"] },
    { axis: "men", value: profile?.menBias ?? 0, attributes: ["intelligence", "will", "awareness"] },
    { axis: "soc", value: profile?.socBias ?? 0, attributes: ["charisma", "spirit", "determination"] },
  ];
  const axisAttributeBias = axisAttributeBiasSource
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((left, right) => right.value - left.value);
  const selectedAxes = axisAttributeBias.filter((entry, index) => index < 2 || entry.value >= 30);
  for (const entry of selectedAxes) {
    result.push(...entry.attributes);
  }
  if (profile?.strategySummary?.toLowerCase().includes("rebuild")) result.push("determination", "stamina");
  if (profile?.teamName?.toLowerCase().includes("wicked wizard")) result.push("intelligence", "will");
  if (profile?.teamName?.toLowerCase().includes("blazing beast")) result.push("power", "speed");
  return result.filter((attribute, index) => result.indexOf(attribute) === index);
}

export function buildAiTrainingPointAllocation(input: {
  player: Player;
  teamId?: string | null;
  profile?: TeamStrategyProfile | null;
  level: DevelopmentLevelSummary;
  affinity: AttributeAffinityProfile;
  preview: DevelopmentAttributePreview[];
}): AiTrainingPointAllocation {
  const preferred = [
    ...getTeamStrategyAttributeBias(input.profile),
    ...input.affinity.signatureAttributes,
    ...(input.level.developmentRoute === "star_growth"
      ? ["determination", "charisma", "power"]
      : input.level.developmentRoute === "core_growth"
        ? ["awareness", "stamina", "will"]
        : input.level.developmentRoute === "prospect_growth"
          ? ["stamina", "determination", "speed"]
          : input.level.developmentRoute === "depth_growth"
            ? ["spirit", "health", "dexterity"]
            : []),
  ] as PlayerGeneratorAttributeName[];
  const uniquePreferred = preferred.filter((attribute, index) => preferred.indexOf(attribute) === index);
  const signatureBoost =
    stableTrainingAllocationHash(`${input.player.id}:ai-training-points`) % 100 < 38 ? 2.5 : 1;
  const ranked = [...input.preview].sort((left, right) => {
    const leftPreferred = uniquePreferred.includes(left.attribute) ? 1 : 0;
    const rightPreferred = uniquePreferred.includes(right.attribute) ? 1 : 0;
    const leftSignatureBoost = left.affinity === "signature" ? signatureBoost : 0;
    const rightSignatureBoost = right.affinity === "signature" ? signatureBoost : 0;
    const leftWeakPenalty = left.affinity === "weak" ? -0.8 : 0;
    const rightWeakPenalty = right.affinity === "weak" ? -0.8 : 0;
    const leftScore =
      leftPreferred * 5 + leftSignatureBoost + left.currentRatingDelta * 3 - (left.finalCost ?? 99) + leftWeakPenalty;
    const rightScore =
      rightPreferred * 5 + rightSignatureBoost + right.currentRatingDelta * 3 - (right.finalCost ?? 99) + rightWeakPenalty;
    return rightScore - leftScore;
  });
  let remaining = input.level.trainingPointsAvailable;
  const spendPlan: AiTrainingPointAllocation["spendPlan"] = [];
  for (const row of ranked) {
    if (row.finalCost == null || row.blocked || row.finalCost > remaining) continue;
    spendPlan.push({
      attribute: row.attribute,
      cost: row.finalCost,
      reason: `${row.affinity}_route_${input.level.developmentRoute}`,
    });
    remaining -= row.finalCost;
    if (remaining <= 0 || spendPlan.length >= 10) break;
  }
  return {
    playerId: input.player.id,
    teamId: input.teamId ?? null,
    recommendedAttributes: uniquePreferred.slice(0, 6),
    spendPlan,
    pointsSpent: input.level.trainingPointsAvailable - remaining,
    pointsRemaining: remaining,
    reasons: [
      `route:${input.level.developmentRoute}`,
      `training_form:${input.level.trainingForm}`,
      `strategy:${input.profile?.strategySummary ?? "none"}`,
      `signature:${input.affinity.signatureAttributes.join("|")}`,
    ],
  };
}

export function buildPlayerDevelopmentLevelupModel(input: {
  gameState?: GameState | null;
  player: Player;
  forecast?: PlayerProgressionForecast | null;
  teamId?: string | null;
  profile?: TeamStrategyProfile | null;
  potentialRecord?: PlayerPotentialRecord | null;
}): PlayerDevelopmentLevelupModel {
  const baseAffinity = deriveAttributeAffinityProfile(input.player);
  const level = buildDevelopmentLevelSummary({
    player: input.player,
    forecast: input.forecast,
    currentXP: input.player.currentXP ?? input.forecast?.currentXP ?? 0,
    spentXP: input.player.spentXP ?? input.forecast?.spentXP ?? 0,
    lifetimeXP: input.player.lifetimeXP ?? null,
  });
  const signatureShift = buildSignatureShiftPreview({
    player: input.player,
    currentProfile: baseAffinity,
    route: input.forecast?.developmentRoute ?? null,
    seasonId: input.gameState?.season.id ?? null,
  });
  const affinity: AttributeAffinityProfile = signatureShift.canShift
    ? {
        ...baseAffinity,
        signatureAttributes: signatureShift.newSignatureAttributes,
        weakAttribute: signatureShift.newWeakAttribute,
        reasons: [...baseAffinity.reasons, signatureShift.reason],
      }
    : baseAffinity;
  const costs = playerGeneratorAttributeKeys.map((attribute) =>
    getAttributeTrainingPointCost({
      value: getPlayerAttributeValue(input.player, attribute as PlayerGeneratorAttributeName),
      attribute: attribute as PlayerGeneratorAttributeName,
      affinity,
      player: input.player,
      potentialRecord: input.potentialRecord,
    }),
  );
  const economy = resolvePlayerEconomyContract({
    playerId: input.player.id,
    player: input.player,
    rosterEntry: input.gameState?.rosters.find((entry) => entry.playerId === input.player.id) ?? null,
  });
  const upgradePreview = buildUpgradePreview({
    player: input.player,
    level,
    affinity,
    economy,
    potentialRecord: input.potentialRecord,
  });
  const regressionEvent = buildRegressionEventPreview({ player: input.player, level, forecast: input.forecast, affinity });
  const aiAllocation = buildAiTrainingPointAllocation({
    player: input.player,
    teamId: input.teamId ?? null,
    profile: input.profile ?? null,
    level,
    affinity,
    preview: upgradePreview,
  });
  const notifications = [
    level.trainingPointsAvailable > 0 ? `${input.player.name}: ${level.trainingPointsAvailable} Trainingspunkte offen.` : null,
    regressionEvent.visible ? `${input.player.name}: Regression Risk ${regressionEvent.risk}. ${regressionEvent.reason}.` : null,
    signatureShift.notification,
    level.lastTrend === "growth" ? `${input.player.name} entwickelt sich stark.` : null,
    level.lastTrend === "stagnation" ? `${input.player.name} stagniert.` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    playerId: input.player.id,
    playerName: input.player.name,
    level,
    affinity,
    costs,
    upgradePreview,
    regressionEvent,
    signatureShift,
    aiAllocation,
    notifications,
  };
}
