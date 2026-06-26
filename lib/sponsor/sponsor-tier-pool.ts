import type { SponsorStarTier } from "@/lib/data/olyDataTypes";
import { getStarTierMilestoneMultiplier } from "@/lib/sponsor/sponsor-economy-calibration";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";

export type SponsorTierRollResult = {
  tiers: SponsorStarTier[];
  /** Bottom-table luck: one slot may use premium_elite / golden-card flavor at low tier. */
  goldenCardSlots: number[];
};

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function clampTier(tier: number, maxTier: SponsorStarTier): SponsorStarTier {
  return Math.min(maxTier, Math.max(1, Math.round(tier))) as SponsorStarTier;
}

function rollClusteredTier(input: {
  seasonId: string;
  teamId: string;
  slotIndex: number;
  targetTier: SponsorStarTier;
  maxTier: SponsorStarTier;
}): SponsorStarTier {
  const roll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-tier:${input.slotIndex}`);
  let tier = input.targetTier;
  if (roll < 0.12 && tier < input.maxTier) {
    tier = clampTier(tier + 1, input.maxTier);
  } else if (roll < 0.32 && tier > 1) {
    tier = clampTier(tier - 1, input.maxTier);
  } else if (roll < 0.42 && tier > 2) {
    tier = clampTier(tier - 1, input.maxTier);
  }
  return clampTier(tier, input.maxTier);
}

function applyTopChampionCluster(
  tiers: SponsorStarTier[],
  input: { seasonId: string; teamId: string; targetTier: SponsorStarTier; maxTier: SponsorStarTier },
): SponsorStarTier[] {
  if (input.maxTier < 5 || input.targetTier < 4) {
    return tiers;
  }
  const adjusted = [...tiers];
  for (let slotIndex = 0; slotIndex < adjusted.length; slotIndex += 1) {
    const roll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-elite:${slotIndex}`);
    if (roll < 0.72) {
      adjusted[slotIndex] = 5;
    } else if (roll < 0.94) {
      adjusted[slotIndex] = clampTier(4, input.maxTier);
    }
  }
  return adjusted.map((tier) => clampTier(tier, input.maxTier));
}

function applyBottomGoldenLuck(
  tiers: SponsorStarTier[],
  goldenCardSlots: number[],
  input: {
    seasonId: string;
    teamId: string;
    maxTier: SponsorStarTier;
    targetTier: SponsorStarTier;
  },
): { tiers: SponsorStarTier[]; goldenCardSlots: number[] } {
  if (input.maxTier > 2 || input.targetTier > 2) {
    return { tiers, goldenCardSlots };
  }
  const luckRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-card`);
  if (luckRoll >= 0.18) {
    return { tiers, goldenCardSlots };
  }
  const slotIndex = Math.floor(
    getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-slot`) * tiers.length,
  );
  const nextGolden = [...goldenCardSlots];
  if (!nextGolden.includes(slotIndex)) {
    nextGolden.push(slotIndex);
  }
  const adjusted = [...tiers];
  if (luckRoll < 0.08 && input.maxTier >= 2) {
    adjusted[slotIndex] = 2;
  }
  return { tiers: adjusted.map((tier) => clampTier(tier, input.maxTier)), goldenCardSlots: nextGolden };
}

export function rollSponsorStarTiers(input: {
  seasonId: string;
  teamId: string;
  qualityRank: SponsorTeamQualityRank;
  slotCount?: number;
}): SponsorTierRollResult {
  const slotCount = input.slotCount ?? 3;
  const maxTier = input.qualityRank.maxStarTier;
  const targetTier = clampTier(input.qualityRank.targetStarTier, maxTier);

  let tiers = Array.from({ length: slotCount }, (_, slotIndex) =>
    rollClusteredTier({
      seasonId: input.seasonId,
      teamId: input.teamId,
      slotIndex,
      targetTier,
      maxTier,
    }),
  );

  if (input.qualityRank.qualityRank <= 4 && targetTier >= 4 && maxTier >= 4) {
    tiers = applyTopChampionCluster(tiers, {
      seasonId: input.seasonId,
      teamId: input.teamId,
      targetTier,
      maxTier,
    });
  }

  return applyBottomGoldenLuck(tiers, [], {
    seasonId: input.seasonId,
    teamId: input.teamId,
    maxTier,
    targetTier,
  });
}

/** @deprecated Use rollSponsorStarTiers().tiers */
export function rollSponsorStarTierList(input: Parameters<typeof rollSponsorStarTiers>[0]): SponsorStarTier[] {
  return rollSponsorStarTiers(input).tiers;
}

export function getRewardMultiplier(starTier: SponsorStarTier) {
  return getStarTierMilestoneMultiplier(starTier);
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
