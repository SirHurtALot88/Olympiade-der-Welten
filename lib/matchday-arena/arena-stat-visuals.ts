export type ArenaRankTier = "elite" | "strong" | "mid" | "weak" | "poor" | "unknown";
export type ArenaAxisValueTier = "high" | "good" | "mid" | "low" | "muted";

/** Top-share cutoffs — intentionally wide so colors track relative strength, not fixed ranks. */
export const ARENA_RANK_TIER_TOP_SHARE = {
  elite: 0.125,
  strong: 0.325,
  mid: 0.575,
  weak: 0.825,
} as const;

export type ArenaRankPoolContext = {
  slotPoolSize: number;
  totalPoolSize: number;
};

export type ArenaRankPoolState = {
  slotPoolSizeByIndex: Map<number, number>;
  totalPoolSize: number;
  slotPoolFallback: number;
  totalPoolFallback: number;
};

export function getArenaRankPercentile(rank: number, poolSize: number) {
  const pool = Math.max(poolSize, 1);
  return rank / pool;
}

export function getArenaRankTierFromPercentile(percentile: number): ArenaRankTier {
  if (!Number.isFinite(percentile) || percentile <= 0) {
    return "unknown";
  }
  if (percentile <= ARENA_RANK_TIER_TOP_SHARE.elite) return "elite";
  if (percentile <= ARENA_RANK_TIER_TOP_SHARE.strong) return "strong";
  if (percentile <= ARENA_RANK_TIER_TOP_SHARE.mid) return "mid";
  if (percentile <= ARENA_RANK_TIER_TOP_SHARE.weak) return "weak";
  return "poor";
}

export function getArenaRankTier(
  rank: number | null | undefined,
  poolSize: number | null | undefined,
): ArenaRankTier {
  if (rank == null || !Number.isFinite(rank) || rank <= 0) {
    return "unknown";
  }
  const pool = poolSize != null && Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 32;
  return getArenaRankTierFromPercentile(getArenaRankPercentile(rank, pool));
}

export function resolveArenaRankPoolSize(
  actualCount: number | null | undefined,
  configuredFallback: number,
): number {
  if (actualCount != null && Number.isFinite(actualCount) && actualCount > 0) {
    return actualCount;
  }
  return Math.max(configuredFallback, 1);
}

export function buildArenaRankPoolSizes(
  candidates: Array<{ slotIndex: number; baseScore: number | null }>,
): Pick<ArenaRankPoolState, "slotPoolSizeByIndex" | "totalPoolSize"> {
  const valid = candidates.filter(
    (candidate) => candidate.baseScore != null && Number.isFinite(candidate.baseScore),
  );
  const slotPoolSizeByIndex = new Map<number, number>();
  for (const slotIndex of new Set(valid.map((candidate) => candidate.slotIndex))) {
    slotPoolSizeByIndex.set(
      slotIndex,
      valid.filter((candidate) => candidate.slotIndex === slotIndex).length,
    );
  }
  return {
    slotPoolSizeByIndex,
    totalPoolSize: valid.length,
  };
}

export function resolveArenaEntryRankPools(
  slotIndex: number,
  state: ArenaRankPoolState,
): ArenaRankPoolContext {
  return {
    slotPoolSize: resolveArenaRankPoolSize(state.slotPoolSizeByIndex.get(slotIndex), state.slotPoolFallback),
    totalPoolSize: resolveArenaRankPoolSize(state.totalPoolSize, state.totalPoolFallback),
  };
}

export function getArenaAxisValueTier(value: number | null | undefined): ArenaAxisValueTier {
  if (value == null || !Number.isFinite(value)) {
    return "muted";
  }
  if (value >= 55) return "high";
  if (value >= 40) return "good";
  if (value >= 28) return "mid";
  return "low";
}

export type ArenaRankFields = {
  rankInSlotBase: number | null;
  rankTotalBase: number | null;
  rankInSlotBoosted: number | null;
  rankTotalBoosted: number | null;
};

export function getArenaFocusEntryCardTier(
  entry: ArenaRankFields,
  pools: ArenaRankPoolContext,
): ArenaRankTier {
  const percentiles: number[] = [];
  if (entry.rankInSlotBoosted != null && Number.isFinite(entry.rankInSlotBoosted) && entry.rankInSlotBoosted > 0) {
    percentiles.push(getArenaRankPercentile(entry.rankInSlotBoosted, pools.slotPoolSize));
  }
  if (entry.rankTotalBoosted != null && Number.isFinite(entry.rankTotalBoosted) && entry.rankTotalBoosted > 0) {
    percentiles.push(getArenaRankPercentile(entry.rankTotalBoosted, pools.totalPoolSize));
  }
  if (entry.rankInSlotBase != null && Number.isFinite(entry.rankInSlotBase) && entry.rankInSlotBase > 0) {
    percentiles.push(getArenaRankPercentile(entry.rankInSlotBase, pools.slotPoolSize));
  }
  if (entry.rankTotalBase != null && Number.isFinite(entry.rankTotalBase) && entry.rankTotalBase > 0) {
    percentiles.push(getArenaRankPercentile(entry.rankTotalBase, pools.totalPoolSize));
  }
  if (percentiles.length === 0) {
    return "unknown";
  }
  return getArenaRankTierFromPercentile(Math.min(...percentiles));
}
