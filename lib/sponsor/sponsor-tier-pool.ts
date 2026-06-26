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

export function getMaxStarTierForStandingRank(rank: number | null | undefined): SponsorStarTier {
  if (rank == null || !Number.isFinite(rank)) {
    return 3;
  }
  if (rank >= 28) {
    return 1;
  }
  if (rank >= 22) {
    return 2;
  }
  if (rank >= 16) {
    return 3;
  }
  if (rank >= 9) {
    return 4;
  }
  return 5;
}

export function getMaxStarTierForCommercialRating(commercialRating: number): SponsorStarTier {
  if (commercialRating >= 86) {
    return 5;
  }
  if (commercialRating >= 66) {
    return 4;
  }
  if (commercialRating >= 46) {
    return 3;
  }
  if (commercialRating >= 26) {
    return 2;
  }
  return 1;
}

function clampTierToCap(tier: SponsorStarTier, maxTier: SponsorStarTier): SponsorStarTier {
  return Math.min(Math.max(1, tier), maxTier) as SponsorStarTier;
}

function adjustTiers(tiers: SponsorStarTier[], maxTier: SponsorStarTier): SponsorStarTier[] {
  const adjusted = tiers.map((tier) => clampTierToCap(tier, maxTier));
  if (new Set(adjusted).size === 1 && adjusted.length === 3 && maxTier >= 2) {
    const base = adjusted[0]!;
    if (base === maxTier) {
      adjusted[1] = clampTierToCap((base - 1) as SponsorStarTier, maxTier);
      adjusted[2] = clampTierToCap((base - 2) as SponsorStarTier, maxTier);
    } else if (base === 1) {
      adjusted[1] = clampTierToCap(2, maxTier);
      adjusted[2] = clampTierToCap(Math.min(3, maxTier) as SponsorStarTier, maxTier);
    } else {
      adjusted[1] = clampTierToCap((base + 1) as SponsorStarTier, maxTier);
      adjusted[2] = clampTierToCap((base - 1) as SponsorStarTier, maxTier);
    }
  }
  return adjusted.map((tier) => clampTierToCap(tier, maxTier));
}

function applyChampionLuckRoll(
  tiers: SponsorStarTier[],
  input: { seasonId: string; teamId: string; commercialRating: number },
  maxTier: SponsorStarTier,
): SponsorStarTier[] {
  if (input.commercialRating < 80 || maxTier < 5) {
    return tiers;
  }
  const luckRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-luck`);
  if (luckRoll < 0.88) {
    return tiers;
  }
  const adjusted = [...tiers];
  const luckySlot = Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-lucky-slot`) * adjusted.length);
  adjusted[luckySlot] = 5;
  return adjusted.map((tier) => clampTierToCap(tier, maxTier));
}

function clampTier(tier: SponsorStarTier): SponsorStarTier {
  return Math.min(5, Math.max(1, tier)) as SponsorStarTier;
}

export function rollSponsorStarTiers(input: {
  seasonId: string;
  teamId: string;
  commercialRating: number;
  standingRank?: number | null;
  slotCount?: number;
}): SponsorStarTier[] {
  const slotCount = input.slotCount ?? 3;
  const maxTier = Math.min(
    getMaxStarTierForCommercialRating(input.commercialRating),
    getMaxStarTierForStandingRank(input.standingRank),
  ) as SponsorStarTier;
  const weights = TIER_WEIGHTS[getWeightBucket(input.commercialRating)]!;
  const tiers = Array.from({ length: slotCount }, (_, slotIndex) =>
    clampTierToCap(
      pickTierFromWeights(weights, `${input.seasonId}:${input.teamId}:sponsor-tier:${slotIndex}`),
      maxTier,
    ),
  );
  return applyChampionLuckRoll(adjustTiers(tiers, maxTier), input, maxTier);
}

export function getRewardMultiplier(starTier: SponsorStarTier) {
  return 0.95 + starTier * 0.05;
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
