import { describe, expect, it } from "vitest";

import { deriveCompositionCounts } from "@/lib/ai/organic-squad/composition-plan";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { MarketBracketLane } from "@/lib/ai/market-pick-engine/market-brackets";

const BRACKETS = buildLeagueMarketBrackets([]); // default definition-derived targets (no price sample)
const EMPTY_TIERS: Record<MarketBracketLane, number> = {
  superstar: 0,
  star: 0,
  core: 0,
  depth: 0,
  backup: 0,
  reserve: 0,
};

function sumCounts(counts: Record<MarketBracketLane, number>): number {
  return counts.superstar + counts.star + counts.core + counts.depth + counts.backup + counts.reserve;
}

describe("deriveCompositionCounts — role-pyramid planning", () => {
  it.each([0.2, 0.5, 0.8, 1.0])(
    "r=%s: for every optTarget, Depth is the strictly largest cohort, core≈backup, sums to optTarget, reserve=0",
    (r) => {
      for (const optTarget of [8, 10, 12, 14]) {
        const spendableNet = r * optTarget * BRACKETS.core.targetMw;
        const counts = deriveCompositionCounts({
          optTarget,
          existingTiers: EMPTY_TIERS,
          spendableNet,
          brackets: BRACKETS,
          // Below both premium thresholds so this isolates the core/backup/depth split from the
          // premium-slot logic (covered separately by the reference cases below).
          premiumAppetite: 0.4,
          premiumCap: 0,
          superstarCap: 0,
          rosterMin: 8,
        });

        expect(counts.reserve).toBe(0);
        expect(sumCounts(counts)).toBe(optTarget);
        expect(counts.depth).toBeGreaterThan(counts.core);
        expect(counts.depth).toBeGreaterThan(counts.backup);
        expect(Math.abs(counts.core - counts.backup)).toBeLessThanOrEqual(2);
      }
    },
  );

  it("rich club: premium appetite + budget yields a Superstar and Star slots, Depth still the largest cohort", () => {
    const counts = deriveCompositionCounts({
      optTarget: 12,
      existingTiers: EMPTY_TIERS,
      spendableNet: 500,
      brackets: BRACKETS,
      premiumAppetite: 1.3,
      premiumCap: 3,
      superstarCap: 1,
      rosterMin: 8,
    });

    expect(counts.superstar).toBeGreaterThanOrEqual(1);
    expect(counts.star).toBeGreaterThanOrEqual(1);
    expect(counts.reserve).toBe(0);
    expect(counts.depth).toBeGreaterThan(counts.core);
    expect(counts.depth).toBeGreaterThan(counts.backup);
    expect(sumCounts(counts)).toBe(12);
  });

  it("poor club: no premium appetite/cap ⇒ zero Superstar/Star, Depth-heavy pyramid", () => {
    const counts = deriveCompositionCounts({
      optTarget: 10,
      existingTiers: EMPTY_TIERS,
      spendableNet: 100,
      brackets: BRACKETS,
      premiumAppetite: 0.2,
      premiumCap: 0,
      superstarCap: 0,
      rosterMin: 8,
    });

    expect(counts.superstar).toBe(0);
    expect(counts.star).toBe(0);
    expect(counts.reserve).toBe(0);
    expect(counts.depth).toBeGreaterThan(counts.core);
    expect(counts.depth).toBeGreaterThan(counts.backup);
    expect(sumCounts(counts)).toBe(10);
  });

  it("S2+: existing tiers reduce the incremental need and cap total planned slots to optTarget", () => {
    const existingTiers: Record<MarketBracketLane, number> = {
      ...EMPTY_TIERS,
      core: 3,
      depth: 4,
    };
    const counts = deriveCompositionCounts({
      optTarget: 10,
      existingTiers,
      spendableNet: 300,
      brackets: BRACKETS,
      premiumAppetite: 1.3,
      premiumCap: 3,
      superstarCap: 1,
      rosterMin: 8,
    });

    // Total target must never exceed optTarget (already-owned + planned), and never go below what's
    // already owned in any lane (the plan only ever ADDS on top of existingTiers).
    expect(sumCounts(counts)).toBeLessThanOrEqual(10);
    expect(counts.core).toBeGreaterThanOrEqual(existingTiers.core);
    expect(counts.depth).toBeGreaterThanOrEqual(existingTiers.depth);
    expect(counts.reserve).toBe(0);
  });

  it("premiumCap=0 fully suppresses Superstar/Star even at very high premium appetite (allocator no-null guard)", () => {
    const counts = deriveCompositionCounts({
      optTarget: 10,
      existingTiers: EMPTY_TIERS,
      spendableNet: 1000,
      brackets: BRACKETS,
      premiumAppetite: 1.6,
      premiumCap: 0,
      superstarCap: 1,
      rosterMin: 8,
    });
    expect(counts.superstar).toBe(0);
    expect(counts.star).toBe(0);
    expect(sumCounts(counts)).toBe(10);
  });
});
