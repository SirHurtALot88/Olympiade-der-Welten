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

/**
 * MEASURED per-axis core-stat distribution (POW/SPE/MEN/SOC pooled) from the real
 * catalog data/generated/oly-player-stats.json (n=2984 players, 11936 axis values):
 *   p5≈19  p10≈24  p25≈32  p50≈42.5  p75≈52  p90≈62  p95≈68  p99≈80  max≈98  mean≈42.6
 * Both the color tier and the letter grade below are anchored to THIS distribution
 * so a median value reads neutral, a clearly-above-average one reads strong, and
 * only genuinely low (bottom decile) reads poor/red — matching the CA/PO star curve
 * in player-potential-service.ts. The old thresholds assumed a 35–99 spread, which
 * made median (~42) read "below average / F" and only the top few percent read well.
 */

/**
 * Color tier for a core-axis value (drives is-tier-* classes). Anchored to the
 * measured per-axis distribution above:
 *   high ≥58 (~p87, clearly strong / green) · good ≥46 (~p60, above average) ·
 *   mid ≥30 (~p23, neutral/amber — contains the median ~42.5) · low <30 (red).
 * So a 70 reads strong green, ~50 reads good (never red), the median reads neutral.
 */
export function getArenaAxisValueTier(value: number | null | undefined): ArenaAxisValueTier {
  if (value == null || !Number.isFinite(value)) {
    return "muted";
  }
  if (value >= 58) return "high";
  if (value >= 46) return "good";
  if (value >= 30) return "mid";
  return "low";
}

/** Absolute letter grade for core stats (POW/SPE/MEN/SOC), anchored to the MEASURED
 * per-axis distribution above (median ~42.5 → C, not F):
 * S  = 64+ (~p92, star-level / "richtig stark")
 * A  = 55+ (~p83, strong)
 * B  = 45+ (~p57, clearly above average)
 * C  = 30+ (~p23, around/below the median)
 * D  = 20+ (~p6, poor)
 * F  = below 20 (bottom ~5%, genuinely low)
 */
export type CoreStatGrade = "S" | "A" | "B" | "C" | "D" | "F";

export function getCoreStatGrade(value: number | null | undefined): CoreStatGrade {
  if (value == null || !Number.isFinite(value)) return "F";
  if (value >= 64) return "S";
  if (value >= 55) return "A";
  if (value >= 45) return "B";
  if (value >= 30) return "C";
  if (value >= 20) return "D";
  return "F";
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
