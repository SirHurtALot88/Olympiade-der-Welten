import type { SponsorStarTier } from "@/lib/data/olyDataTypes";

const TIER_WEIGHTS: Record<string, [number, number, number, number, number]> = {
  low: [35, 40, 20, 5, 0],
  midLow: [15, 35, 35, 13, 2],
  mid: [5, 20, 40, 28, 7],
  midHigh: [2, 10, 28, 40, 20],
  high: [0, 5, 20, 35, 40],
};

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getWeightBucket(commercialRating: number): keyof typeof TIER_WEIGHTS {
  if (commercialRating >= 86) return "high";
  if (commercialRating >= 71) return "midHigh";
  if (commercialRating >= 51) return "mid";
  if (commercialRating >= 26) return "midLow";
  return "low";
}

function pickTierFromWeights(weights: [number, number, number, number, number], seed: string): SponsorStarTier {
  const roll = getStableUnitHash(seed);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = roll * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index]!;
    if (cursor <= 0) {
      return (index + 1) as SponsorStarTier;
    }
  }
  return 1;
}

function adjustTiers(tiers: SponsorStarTier[]): SponsorStarTier[] {
  const adjusted = [...tiers];
  const unique = new Set(adjusted);
  if (unique.size === 1 && adjusted.length === 3) {
    adjusted[1] = clampTier((adjusted[1]! + 1) as SponsorStarTier);
    adjusted[2] = clampTier((adjusted[2]! - 1) as SponsorStarTier);
  }
  return adjusted;
}

function applyChampionLuckRoll(
  tiers: SponsorStarTier[],
  input: { seasonId: string; teamId: string; commercialRating: number },
): SponsorStarTier[] {
  if (input.commercialRating < 80) {
    return tiers;
  }
  const luckRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-luck`);
  if (luckRoll < 0.88) {
    return tiers;
  }
  const adjusted = [...tiers];
  const luckySlot = Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-lucky-slot`) * adjusted.length);
  adjusted[luckySlot] = 5;
  return adjusted;
}

function clampTier(tier: SponsorStarTier): SponsorStarTier {
  return Math.min(5, Math.max(1, tier)) as SponsorStarTier;
}

export function rollSponsorStarTiers(input: {
  seasonId: string;
  teamId: string;
  commercialRating: number;
  slotCount?: number;
}): SponsorStarTier[] {
  const slotCount = input.slotCount ?? 3;
  const weights = TIER_WEIGHTS[getWeightBucket(input.commercialRating)]!;
  const tiers = Array.from({ length: slotCount }, (_, slotIndex) =>
    pickTierFromWeights(weights, `${input.seasonId}:${input.teamId}:sponsor-tier:${slotIndex}`),
  );
  return applyChampionLuckRoll(adjustTiers(tiers), input);
}

export function getRewardMultiplier(starTier: SponsorStarTier) {
  return 0.75 + starTier * 0.25;
}

export function getDemandMultiplier(starTier: SponsorStarTier) {
  return 0.85 + starTier * 0.08;
}

export function getDemandProfile(starTier: SponsorStarTier): "safe" | "balanced" | "ambitious" | "elite" {
  if (starTier >= 5) return "elite";
  if (starTier >= 4) return "ambitious";
  if (starTier >= 2) return "balanced";
  return "safe";
}
