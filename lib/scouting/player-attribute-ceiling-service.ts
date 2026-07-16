import type {
  Player,
  GameState,
  PlayerGeneratorAttributeName,
  PlayerPotentialRecord,
} from "@/lib/data/olyDataTypes";
import type { PlayerAxisKey, PlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import type { PlayerPotentialCeilingProfile } from "@/lib/scouting/player-potential-ceiling-service";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";

// Per-gameState index so repeated lookups for different players are O(1) not O(n).
const potentialRecordIndexCache = new WeakMap<object, Map<string, PlayerPotentialRecord>>();

export type AttributeHeadroomState = "open" | "closing" | "capped";
export type AxisRouteState = "open" | "closing" | "capped";

const ATTRIBUTE_PRIMARY_AXIS: Record<PlayerGeneratorAttributeName, PlayerAxisKey> = {
  power: "pow",
  health: "pow",
  stamina: "pow",
  speed: "spe",
  dexterity: "spe",
  awareness: "spe",
  intelligence: "men",
  will: "men",
  charisma: "soc",
  spirit: "soc",
  determination: "soc",
  torment: "pow",
};

const AXIS_ATTRIBUTES: Record<PlayerAxisKey, PlayerGeneratorAttributeName[]> = {
  pow: ["power", "health", "stamina", "torment"],
  spe: ["speed", "dexterity", "awareness"],
  men: ["intelligence", "will", "awareness"],
  soc: ["charisma", "spirit", "determination"],
};

const CLOSING_HEADROOM_THRESHOLD = 5;
const CAPPED_HEADROOM_THRESHOLD = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getPlayerSeedValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function getPlayerAttributeValue(player: Player, attribute: PlayerGeneratorAttributeName): number | null {
  const value = player.attributeSheetStats?.[attribute];
  return isFiniteNumber(value) ? value : null;
}

/** Maps axis PO stars to a hidden numeric ceiling baseline. */
export function mapAxisPoStarsToNumericCeiling(poStars: number) {
  return clamp(Math.round(35 + (clamp(poStars, 0.5, 5) / 5) * 55), 35, 99);
}

function roundHalfStar(value: number) {
  return clamp(Math.round(value * 2) / 2, 0.5, 5);
}

/** Inverse of {@link mapAxisPoStarsToNumericCeiling}. */
export function mapNumericCeilingToAxisPoStars(numericCeiling: number) {
  return roundHalfStar(clamp(0.5 + ((clamp(numericCeiling, 35, 99) - 35) / 55) * 4.5, 0.5, 5));
}

const CLASS_AXIS_AFFINITY: Record<PlayerAxisKey, string[]> = {
  pow: ["charger", "warrior", "tank", "berserker", "power", "warlord", "badass"],
  spe: ["runner", "scout", "speed", "rogue", "ranger", "sprinter"],
  men: ["teacher", "scholar", "tactician", "monk", "sage", "mage"],
  soc: ["bard", "charmer", "diplomat", "leader", "captain"],
};

function getTalentTraitCeilingModifier(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  const positives = new Set((player.traitsPositive ?? []).map((entry) => entry.toLowerCase()));
  const negatives = new Set((player.traitsNegative ?? []).map((entry) => entry.toLowerCase()));
  let modifier = 0;
  for (const trait of ["prodigy", "gifted", "natural", "talented", "late bloomer", "wonder kid"]) {
    if (positives.has(trait)) modifier += 0.75;
  }
  for (const trait of ["limited ceiling", "plateaued", "slow developer", "ceiling limited", "stagnant"]) {
    if (negatives.has(trait)) modifier -= 0.5;
  }
  return clamp(modifier, -1, 1.5);
}

function getClassAxisAffinity(className: string | null | undefined, axis: PlayerAxisKey) {
  const normalized = (className ?? "").toLowerCase();
  const keywords = CLASS_AXIS_AFFINITY[axis];
  if (keywords.some((keyword) => normalized.includes(keyword))) {
    return 1.35;
  }
  return 1;
}

function mapHiddenScoreToUpsideBudget(score: number) {
  const normalized = clamp(score, 35, 99);
  return 0.5 + ((normalized - 35) / 64) * 3.5;
}

function computeOverallFromAxisStars(values: Record<PlayerAxisKey, number>) {
  const sorted = (["pow", "spe", "men", "soc"] as const)
    .map((axis) => values[axis])
    .sort((left, right) => right - left) as [number, number, number, number];
  return roundHalfStar(sorted[0] * 0.45 + sorted[1] * 0.3 + sorted[2] * 0.15 + sorted[3] * 0.1);
}

function getAttributesByPrimaryAxis(axis: PlayerAxisKey) {
  return playerGeneratorAttributeKeys.filter((attribute) => ATTRIBUTE_PRIMARY_AXIS[attribute] === axis);
}

function getStrongestAttributeValueOnAxis(player: Player, axis: PlayerAxisKey) {
  const values = getAttributesByPrimaryAxis(axis)
    .map((attribute) => getPlayerAttributeValue(player, attribute))
    .filter(isFiniteNumber);
  return values.length > 0 ? Math.max(...values) : null;
}

/** Primary source of truth: per-attribute numeric ceilings from global upside budget. */
export function buildHiddenAttributeCeilingsFromPotentialScore(input: {
  saveId: string;
  player: Player;
  currentStars: PlayerAxisStarProfile;
  hiddenPotentialScore?: number | null;
}): Partial<Record<PlayerGeneratorAttributeName, number>> {
  const hiddenPotentialScore = clamp(
    input.hiddenPotentialScore ??
      getPlayerSeedValue(`${input.saveId}:${input.player.id}:potential-v3`) * 64 +
        35,
    35,
    99,
  );
  const traitModifier = getTalentTraitCeilingModifier(input.player);
  const budget = mapHiddenScoreToUpsideBudget(hiddenPotentialScore);
  const ceilings = {} as Partial<Record<PlayerGeneratorAttributeName, number>>;

  for (const attribute of playerGeneratorAttributeKeys) {
    const axis = ATTRIBUTE_PRIMARY_AXIS[attribute];
    const current = getPlayerAttributeValue(input.player, attribute) ?? 35;
    const currentAttrStars = mapNumericCeilingToAxisPoStars(current);
    const attributeSeed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:${attribute}:attr-ceiling-v2`);
    const skew = 0.25 + attributeSeed * 1.65;
    let upside = budget * skew;

    const strongestOnAxis = getStrongestAttributeValueOnAxis(input.player, axis);
    if (strongestOnAxis != null && current >= strongestOnAxis - 0.01) {
      upside += 0.75 + attributeSeed * 1.25;
    } else if (attributeSeed > 0.72) {
      upside += attributeSeed * 0.75;
    }

    upside *= getClassAxisAffinity(input.player.trainingClass ?? input.player.className, axis);
    upside += traitModifier * (0.35 + attributeSeed * 0.4);

    const attributePoStars = roundHalfStar(clamp(currentAttrStars + upside, currentAttrStars, 5));
    const baseNumeric = mapAxisPoStarsToNumericCeiling(attributePoStars);
    const spread = 4 + attributeSeed * 6;
    const direction = attributeSeed > 0.5 ? 1 : -1;
    const rawCeiling = baseNumeric + direction * spread;
    ceilings[attribute] = clamp(Math.max(current, Math.round(rawCeiling)), 1, 99);
  }

  return ceilings;
}

/** Derives axis PO stars from stored per-attribute ceilings (max PO per primary axis). */
export function deriveAxisPoStarsFromAttributeCeilings(
  attributeCeilings: Partial<Record<PlayerGeneratorAttributeName, number>>,
): Record<PlayerAxisKey, number> {
  const axisStars = {} as Record<PlayerAxisKey, number>;
  for (const axis of ["pow", "spe", "men", "soc"] as const) {
    const stars = getAttributesByPrimaryAxis(axis)
      .map((attribute) => attributeCeilings[attribute])
      .filter(isFiniteNumber)
      .map((value) => mapNumericCeilingToAxisPoStars(value));
    axisStars[axis] = stars.length > 0 ? roundHalfStar(Math.max(...stars)) : 0.5;
  }
  return axisStars;
}

export function derivePlayerPotentialCeilingProfileFromAttributeCeilings(input: {
  attributeCeilings: Partial<Record<PlayerGeneratorAttributeName, number>>;
  currentStars: PlayerAxisStarProfile;
}): PlayerPotentialCeilingProfile {
  const axisStars = deriveAxisPoStarsFromAttributeCeilings(input.attributeCeilings);
  const clampedAxis = {} as Record<PlayerAxisKey, number>;
  for (const axis of ["pow", "spe", "men", "soc"] as const) {
    clampedAxis[axis] = roundHalfStar(Math.max(axisStars[axis], input.currentStars[axis]));
  }
  return {
    ...clampedAxis,
    overall: computeOverallFromAxisStars(clampedAxis),
  };
}

export function applyAttributeCeilingSeasonDrift(input: {
  attributeCeilings: Partial<Record<PlayerGeneratorAttributeName, number>>;
  saveId: string;
  playerId: string;
  seasonId: string;
  growthOutlook: "breakout" | "growth" | "stable" | "stagnation" | "regression_risk";
}): Partial<Record<PlayerGeneratorAttributeName, number>> {
  const drifted = {} as Partial<Record<PlayerGeneratorAttributeName, number>>;
  for (const attribute of playerGeneratorAttributeKeys) {
    const current = input.attributeCeilings[attribute];
    if (!isFiniteNumber(current)) continue;
    const seed = getPlayerSeedValue(`${input.saveId}:${input.playerId}:${input.seasonId}:${attribute}:attr-drift-v1`);
    let delta = seed < 0.34 ? -2 : seed > 0.66 ? 2 : 0;
    if (input.growthOutlook === "breakout") delta = Math.max(delta, 2);
    else if (input.growthOutlook === "growth" && delta < 0) delta = 0;
    else if (input.growthOutlook === "stagnation" && delta > 0) delta = 0;
    else if (input.growthOutlook === "regression_risk") delta = Math.min(delta, -2);
    drifted[attribute] = clamp(Math.round(current + delta), 1, 99);
  }
  return drifted;
}

/** Legacy axis-first path — prefer {@link buildHiddenAttributeCeilingsFromPotentialScore}. */
export function buildHiddenAttributeCeilings(input: {
  saveId: string;
  player: Player;
  axisCeiling: PlayerPotentialCeilingProfile;
}): Partial<Record<PlayerGeneratorAttributeName, number>> {
  const ceilings = {} as Partial<Record<PlayerGeneratorAttributeName, number>>;

  for (const attribute of playerGeneratorAttributeKeys) {
    const axis = ATTRIBUTE_PRIMARY_AXIS[attribute];
    const axisBase = mapAxisPoStarsToNumericCeiling(input.axisCeiling[axis]);
    const attributeSeed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:${attribute}:attr-ceiling-v1`);
    const spread = 8 + attributeSeed * 10;
    const direction = attributeSeed > 0.5 ? 1 : -1;
    const current = getPlayerAttributeValue(input.player, attribute);
    const rawCeiling = axisBase + direction * spread;
    ceilings[attribute] = clamp(
      Math.max(current ?? 35, Math.round(rawCeiling)),
      1,
      99,
    );
  }

  return ceilings;
}

export function getAttributeHeadroom(input: {
  player: Player;
  attribute: PlayerGeneratorAttributeName;
  record?: PlayerPotentialRecord | null;
}) {
  const current = getPlayerAttributeValue(input.player, input.attribute);
  const ceiling = input.record?.hiddenAttributeCeiling?.[input.attribute] ?? null;
  if (!isFiniteNumber(current) || !isFiniteNumber(ceiling)) {
    return {
      current,
      ceiling,
      headroom: null as number | null,
      state: "open" as AttributeHeadroomState,
    };
  }
  const headroom = ceiling - current;
  if (headroom < 0) {
    return {
      current,
      ceiling: current + 2,
      headroom: 2,
      state: "open" as AttributeHeadroomState,
    };
  }
  let state: AttributeHeadroomState = "open";
  if (headroom <= CAPPED_HEADROOM_THRESHOLD) state = "capped";
  else if (headroom <= CLOSING_HEADROOM_THRESHOLD) state = "closing";
  return { current, ceiling, headroom, state };
}

export function getAttributeGrowthMultiplier(state: AttributeHeadroomState) {
  if (state === "capped") return 0.05;
  if (state === "closing") return 0.45;
  return 1;
}

/**
 * Soft late taper for matchday performance — full credit until close to PO max,
 * then gradual reduction (never as harsh as training headroom).
 */
export function getPerformanceHeadroomGrowthMultiplier(headroom: number | null) {
  if (headroom == null || !Number.isFinite(headroom)) return 1;
  if (headroom > 5) return 1;
  if (headroom > 3) return 0.88 + ((headroom - 3) / 2) * 0.12;
  if (headroom > 1) return 0.72 + ((headroom - 1) / 2) * 0.16;
  return clamp(0.55 + headroom * 0.17, 0.55, 0.72);
}

export function getAxisRouteState(input: {
  caStars: number;
  poStars: number;
}): AxisRouteState {
  const gap = input.poStars - input.caStars;
  if (gap <= 0.25) return "capped";
  if (gap <= 0.75) return "closing";
  return "open";
}

export function getAxisRouteTrainingMultiplier(state: AxisRouteState) {
  if (state === "capped") return 0.1;
  if (state === "closing") return 0.55;
  return 1;
}

export function getAxisRouteLabel(state: AxisRouteState, gapStars: number) {
  if (state === "capped") return "Limit erreicht";
  if (state === "closing") return `+${gapStars.toFixed(1)}★ Luft (eng)`;
  return `+${gapStars.toFixed(1)}★ Luft`;
}

export function getHeadroomLabel(state: AttributeHeadroomState, headroom: number | null) {
  if (state === "capped") return "am Limit";
  if (state === "closing") return headroom != null ? `noch ~${Math.max(1, Math.round(headroom))}` : "eng";
  return headroom != null ? `noch ~${Math.max(1, Math.round(headroom))}` : "offen";
}

export function getAttributesForAxis(axis: PlayerAxisKey) {
  return AXIS_ATTRIBUTES[axis];
}

export function getPrimaryAxisForAttribute(attribute: PlayerGeneratorAttributeName) {
  return ATTRIBUTE_PRIMARY_AXIS[attribute];
}

export function resolvePlayerPotentialRecordFromGameState(input: {
  gameState?: { playerPotential?: PlayerPotentialRecord[] } | null;
  playerId: string;
}): PlayerPotentialRecord | null {
  const gs = input.gameState;
  if (!gs) return null;
  // Build or reuse a per-gameState index to turn O(n) .find() into O(1) lookup.
  let index = potentialRecordIndexCache.get(gs);
  if (!index) {
    index = new Map((gs.playerPotential ?? []).map((entry) => [entry.playerId, entry] as const));
    potentialRecordIndexCache.set(gs, index);
  }
  return index.get(input.playerId) ?? null;
}
