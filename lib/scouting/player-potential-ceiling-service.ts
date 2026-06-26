import type { Player, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";
import type { PlayerAxisKey, PlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildHiddenAttributeCeilings } from "@/lib/scouting/player-attribute-ceiling-service";

export type PlayerPotentialCeilingProfile = {
  pow: number;
  spe: number;
  men: number;
  soc: number;
  overall: number;
};

export type RevealedPotentialStars = {
  overallMin: number | null;
  overallMax: number | null;
  byAxis: Partial<Record<PlayerAxisKey, { min: number; max: number }>> | null;
  band: "low" | "medium" | "high" | "elite" | null;
  displayLabel: string;
};

const AXIS_KEYS: PlayerAxisKey[] = ["pow", "spe", "men", "soc"];

const CLASS_AXIS_AFFINITY: Record<PlayerAxisKey, string[]> = {
  pow: ["charger", "warrior", "tank", "berserker", "power"],
  spe: ["runner", "scout", "speed", "rogue", "ranger"],
  men: ["teacher", "scholar", "tactician", "monk", "sage"],
  soc: ["bard", "charmer", "diplomat", "leader", "captain"],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundHalfStar(value: number) {
  return clamp(Math.round(value * 2) / 2, 0.5, 5);
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

function getAxisRawValue(player: Player, axis: PlayerAxisKey) {
  const value = player.coreStats?.[axis];
  return isFiniteNumber(value) ? value : null;
}

function mapHiddenScoreToUpsideBudget(score: number) {
  const normalized = clamp(score, 35, 99);
  return 0.5 + ((normalized - 35) / 64) * 3.5;
}

function computeOverallFromAxisStars(values: Record<PlayerAxisKey, number>) {
  const sorted = AXIS_KEYS.map((axis) => values[axis]).sort((left, right) => right - left) as [
    number,
    number,
    number,
    number,
  ];
  return roundHalfStar(
    sorted[0] * 0.45 +
      sorted[1] * 0.30 +
      sorted[2] * 0.15 +
      sorted[3] * 0.10 +
      sorted[3] * 0.10,
  );
}

function deriveAxisCeiling(input: {
  axis: PlayerAxisKey;
  currentStars: number;
  hiddenPotentialScore: number;
  axisSeed: number;
  isStrongestRawAxis: boolean;
  classAffinity: number;
  traitModifier: number;
}) {
  const budget = mapHiddenScoreToUpsideBudget(input.hiddenPotentialScore);
  const skew = 0.25 + input.axisSeed * 1.65;
  let upside = budget * skew;

  if (input.isStrongestRawAxis) {
    upside += 0.75 + input.axisSeed * 1.25;
  } else if (input.axisSeed > 0.72) {
    upside += input.axisSeed * 0.75;
  }

  upside *= input.classAffinity;
  upside += input.traitModifier * (0.35 + input.axisSeed * 0.4);

  return roundHalfStar(clamp(input.currentStars + upside, input.currentStars, 5));
}

export function getPlayerDevelopmentBand(player: Player): "youth" | "peak" | "veteran" {
  const rating = isFiniteNumber(player.rating) ? player.rating : isFiniteNumber(player.ovr) ? player.ovr : 60;
  const coreValues = Object.values(player.coreStats ?? {}).filter(isFiniteNumber);
  const bestAxis = coreValues.length > 0 ? Math.max(...coreValues) : rating;
  if (bestAxis <= 42 || rating <= 45) return "youth";
  if (rating >= 78 || bestAxis >= 82) return "veteran";
  return "peak";
}

export function buildPlayerPotentialCeilingProfile(input: {
  saveId: string;
  player: Player;
  currentStars: PlayerAxisStarProfile;
  hiddenPotentialScore?: number | null;
  existing?: PlayerPotentialRecord | null;
}): PlayerPotentialCeilingProfile {
  const hiddenPotentialScore = clamp(
    input.hiddenPotentialScore ??
      input.existing?.hiddenPotentialScore ??
      getPlayerSeedValue(`${input.saveId}:${input.player.id}:potential-v3`) * 64 +
        35,
    35,
    99,
  );

  const rawValues = AXIS_KEYS.map((axis) => ({
    axis,
    value: getAxisRawValue(input.player, axis) ?? 0,
  }));
  const maxRaw = Math.max(...rawValues.map((entry) => entry.value), 0);
  const traitModifier = getTalentTraitCeilingModifier(input.player);

  const ceiling = {} as Record<PlayerAxisKey, number>;
  for (const axis of AXIS_KEYS) {
    const axisSeed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:${axis}:ceiling-v2`);
    const rawValue = getAxisRawValue(input.player, axis) ?? 0;
    ceiling[axis] = deriveAxisCeiling({
      axis,
      currentStars: input.currentStars[axis],
      hiddenPotentialScore,
      axisSeed,
      isStrongestRawAxis: maxRaw > 0 && rawValue >= maxRaw - 0.01,
      classAffinity: getClassAxisAffinity(input.player.className, axis),
      traitModifier,
    });
  }

  return {
    ...ceiling,
    overall: computeOverallFromAxisStars(ceiling),
  };
}

export function buildPotentialGap(input: {
  currentStars: PlayerAxisStarProfile;
  ceiling: PlayerPotentialCeilingProfile;
}) {
  return roundHalfStar(clamp(input.ceiling.overall - input.currentStars.overall, 0, 5));
}

export function revealPotentialStars(input: {
  ceiling: PlayerPotentialCeilingProfile;
  currentStars: PlayerAxisStarProfile;
  scoutingLevel: number;
}): RevealedPotentialStars {
  const level = clamp(Math.round(input.scoutingLevel), 0, 5);
  const gap = buildPotentialGap({ currentStars: input.currentStars, ceiling: input.ceiling });

  if (level <= 2) {
    const band =
      gap >= 2 ? "elite" : gap >= 1.5 ? "high" : gap >= 0.75 ? "medium" : "low";
    return {
      overallMin: null,
      overallMax: null,
      byAxis: null,
      band,
      displayLabel:
        band === "elite"
          ? "Potenzial: elite"
          : band === "high"
            ? "Potenzial: hoch"
            : band === "medium"
              ? "Potenzial: mittel"
              : "Potenzial: niedrig",
    };
  }

  const blur = level >= 5 ? 0.25 : level >= 4 ? 0.5 : 1;
  const overallMin = roundHalfStar(clamp(input.currentStars.overall, 0.5, input.ceiling.overall - blur));
  const overallMax = roundHalfStar(clamp(input.ceiling.overall + blur, overallMin, 5));

  if (level <= 3) {
    return {
      overallMin,
      overallMax,
      byAxis: null,
      band: null,
      displayLabel: `Pot ${overallMin}–${overallMax}★`,
    };
  }

  const byAxis: RevealedPotentialStars["byAxis"] = {};
  for (const axis of AXIS_KEYS) {
    byAxis[axis] = {
      min: roundHalfStar(clamp(input.currentStars[axis], 0.5, input.ceiling[axis] - blur)),
      max: roundHalfStar(
        clamp(input.ceiling[axis] + (level >= 5 ? 0 : blur), input.currentStars[axis], 5),
      ),
    };
  }

  const axisLabels = AXIS_KEYS.map((axis) => {
    const range = byAxis[axis];
    if (!range) return null;
    const label = axis === "pow" ? "P" : axis === "spe" ? "S" : axis === "men" ? "M" : "So";
    return `${label}${range.max}★`;
  })
    .filter(Boolean)
    .join(" · ");

  return {
    overallMin,
    overallMax,
    byAxis,
    band: null,
    displayLabel: axisLabels ? `Pot ${overallMin}–${overallMax}★ (${axisLabels})` : `Pot ${overallMin}–${overallMax}★`,
  };
}

export function attachPotentialCeilingToRecord(input: {
  record: PlayerPotentialRecord;
  ceiling: PlayerPotentialCeilingProfile;
  player?: Player;
  saveId?: string;
}): PlayerPotentialRecord {
  const attributeCeiling =
    input.player && input.saveId
      ? buildHiddenAttributeCeilings({
          saveId: input.saveId,
          player: input.player,
          axisCeiling: input.ceiling,
        })
      : input.record.hiddenAttributeCeiling;

  return {
    ...input.record,
    hiddenPotentialCeilingByAxis: {
      pow: input.ceiling.pow,
      spe: input.ceiling.spe,
      men: input.ceiling.men,
      soc: input.ceiling.soc,
    },
    hiddenPotentialOverallStars: input.ceiling.overall,
    hiddenAttributeCeiling: attributeCeiling,
  };
}

export function buildPotentialRecordWithCeilings(input: {
  saveId: string;
  player: Player;
  record: PlayerPotentialRecord;
  currentStars: PlayerAxisStarProfile;
  axisCeilingOverride?: PlayerPotentialCeilingProfile | null;
}): PlayerPotentialRecord {
  const ceiling =
    input.axisCeilingOverride ??
    buildPlayerPotentialCeilingProfile({
      saveId: input.saveId,
      player: input.player,
      currentStars: input.currentStars,
      hiddenPotentialScore: input.record.hiddenPotentialScore,
    });
  return attachPotentialCeilingToRecord({
    record: input.record,
    ceiling,
    player: input.player,
    saveId: input.saveId,
  });
}

export function applyAxisCeilingSeasonDrift(input: {
  ceiling: PlayerPotentialCeilingProfile;
  saveId: string;
  playerId: string;
  seasonId: string;
  growthOutlook: "breakout" | "growth" | "stable" | "stagnation" | "regression_risk";
}): PlayerPotentialCeilingProfile {
  const drifted = {} as Record<PlayerAxisKey, number>;
  for (const axis of AXIS_KEYS) {
    const seed = getPlayerSeedValue(`${input.saveId}:${input.playerId}:${input.seasonId}:${axis}:axis-drift-v1`);
    let delta = seed < 0.34 ? -0.5 : seed > 0.66 ? 0.5 : 0;
    if (input.growthOutlook === "breakout") delta = Math.max(delta, 0.5);
    else if (input.growthOutlook === "growth" && delta < 0) delta = 0;
    else if (input.growthOutlook === "stagnation" && delta > 0) delta = 0;
    else if (input.growthOutlook === "regression_risk") delta = Math.min(delta, -0.5);
    drifted[axis] = roundHalfStar(clamp(input.ceiling[axis] + delta, 0.5, 5));
  }
  return {
    ...drifted,
    overall: computeOverallFromAxisStars(drifted),
  };
}
