import { describe, expect, it } from "vitest";

import {
  buildArenaRankPoolSizes,
  getArenaFocusEntryCardTier,
  getArenaRankTier,
  resolveArenaEntryRankPools,
} from "@/lib/matchday-arena/arena-stat-visuals";

describe("arena-stat-visuals rank tiers", () => {
  it("uses slot pool size (~teams) for S# ranks", () => {
    expect(getArenaRankTier(3, 32)).toBe("elite");
    expect(getArenaRankTier(5, 32)).toBe("strong");
    expect(getArenaRankTier(18, 32)).toBe("mid");
    expect(getArenaRankTier(26, 32)).toBe("weak");
    expect(getArenaRankTier(28, 32)).toBe("poor");
  });

  it("scales total ranks with discipline size (2 vs 6 players per team)", () => {
    expect(getArenaRankTier(10, 64)).toBe("strong");
    expect(getArenaRankTier(8, 192)).toBe("elite");
    expect(getArenaRankTier(24, 64)).toBe("mid");
    expect(getArenaRankTier(40, 192)).toBe("strong");
  });

  it("builds pool sizes from live candidates", () => {
    const pools = buildArenaRankPoolSizes([
      { slotIndex: 0, baseScore: 10 },
      { slotIndex: 0, baseScore: 12 },
      { slotIndex: 1, baseScore: 8 },
    ]);
    expect(pools.totalPoolSize).toBe(3);
    expect(pools.slotPoolSizeByIndex.get(0)).toBe(2);
    expect(pools.slotPoolSizeByIndex.get(1)).toBe(1);
  });

  it("derives card tier from best normalized rank", () => {
    const pools = resolveArenaEntryRankPools(0, {
      slotPoolSizeByIndex: new Map([[0, 32]]),
      totalPoolSize: 192,
      slotPoolFallback: 32,
      totalPoolFallback: 192,
    });
    expect(
      getArenaFocusEntryCardTier(
        {
          rankInSlotBase: 10,
          rankTotalBase: 8,
          rankInSlotBoosted: null,
          rankTotalBoosted: null,
        },
        pools,
      ),
    ).toBe("elite");
  });
});
