import type { Player, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";
import type { PlayerAxisKey, PlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";

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

function getTraitPotentialModifier(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  const positives = new Set((player.traitsPositive ?? []).map((entry) => entry.toLowerCase()));
  const negatives = new Set((player.traitsNegative ?? []).map((entry) => entry.toLowerCase()));
  let modifier = 0;
  for (const trait of ["ambitious", "diligent", "motivated", "disciplined"]) {
    if (positives.has(trait)) modifier += 0.15;
  }
  for (const trait of ["lazy", "fainthearted", "diva"]) {
    if (negatives.has(trait)) modifier -= 0.2;
  }
  return modifier;
}

export function getPlayerDevelopmentBand(player: Player): "youth" | "peak" | "veteran" {
  return getDevelopmentBand(player);
}

function getDevelopmentBand(player: Player): "youth" | "peak" | "veteran" {
  const rating = isFiniteNumber(player.rating) ? player.rating : isFiniteNumber(player.ovr) ? player.ovr : 60;
  const potential = isFiniteNumber(player.potential) && player.potential > 0 ? player.potential : rating + 8;
  const gap = potential - rating;
  if (gap >= 14) return "youth";
  if (gap <= 4 || rating >= 78) return "veteran";
  return "peak";
}

function getGapRangeForBand(band: ReturnType<typeof getDevelopmentBand>, seed: number) {
  if (band === "youth") {
    return 0.5 + seed * 2;
  }
  if (band === "peak") {
    return seed * 1;
  }
  return seed * 0.5;
}

function deriveAxisCeiling(current: number, gap: number, axisSeed: number, traitMod: number) {
  const jitter = (axisSeed - 0.5) * 0.5;
  return roundHalfStar(clamp(current + gap + traitMod + jitter, current, 5));
}

export function buildPlayerPotentialCeilingProfile(input: {
  saveId: string;
  player: Player;
  currentStars: PlayerAxisStarProfile;
  existing?: PlayerPotentialRecord | null;
}): PlayerPotentialCeilingProfile {
  if (input.existing?.hiddenPotentialCeilingByAxis) {
    const axis = input.existing.hiddenPotentialCeilingByAxis;
    const overall =
      input.existing.hiddenPotentialOverallStars ??
      roundHalfStar((axis.pow + axis.spe + axis.men + axis.soc) / 4);
    return { ...axis, overall };
  }

  const band = getDevelopmentBand(input.player);
  const traitMod = getTraitPotentialModifier(input.player);
  const baseSeed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:potential-ceiling-v1`);
  const gap = getGapRangeForBand(band, baseSeed);

  const axes = ["pow", "spe", "men", "soc"] as const;
  const ceiling = {} as Record<(typeof axes)[number], number>;
  for (const axis of axes) {
    const axisSeed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:${axis}:ceiling`);
    ceiling[axis] = deriveAxisCeiling(input.currentStars[axis], gap, axisSeed, traitMod);
  }

  const overall = roundHalfStar(
    axes.reduce((sum, axis) => sum + ceiling[axis], 0) / axes.length,
  );

  return { ...ceiling, overall };
}

export function buildPotentialGap(input: {
  currentStars: PlayerAxisStarProfile;
  ceiling: PlayerPotentialCeilingProfile;
}) {
  return roundHalfStar(
    clamp(input.ceiling.overall - input.currentStars.overall, 0, 5),
  );
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
  for (const axis of ["pow", "spe", "men", "soc"] as const) {
    byAxis[axis] = {
      min: roundHalfStar(clamp(input.currentStars[axis], 0.5, input.ceiling[axis] - blur)),
      max: roundHalfStar(clamp(input.ceiling[axis] + (level >= 5 ? 0 : blur), input.currentStars[axis], 5)),
    };
  }

  return {
    overallMin,
    overallMax,
    byAxis,
    band: null,
    displayLabel: `Pot ${overallMin}–${overallMax}★`,
  };
}

export function attachPotentialCeilingToRecord(input: {
  record: PlayerPotentialRecord;
  ceiling: PlayerPotentialCeilingProfile;
}): PlayerPotentialRecord {
  return {
    ...input.record,
    hiddenPotentialCeilingByAxis: {
      pow: input.ceiling.pow,
      spe: input.ceiling.spe,
      men: input.ceiling.men,
      soc: input.ceiling.soc,
    },
    hiddenPotentialOverallStars: input.ceiling.overall,
  };
}
