import { describe, expect, it } from "vitest";

import { deriveCompositionCounts } from "@/lib/ai/organic-squad/composition-plan";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { LeagueMarketBrackets, MarketBracketLane } from "@/lib/ai/market-pick-engine/market-brackets";

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

/** Cheapest possible realization of the plan (every body at its band FLOOR) — a necessary lower bound on
 *  what the team must actually spend. The affordability waterfall must keep this within the budget. */
function floorCost(counts: Record<MarketBracketLane, number>, brackets: LeagueMarketBrackets): number {
  let total = counts.superstar * brackets.superstar.targetMw + counts.star * brackets.star.targetMw;
  for (const lane of ["core", "depth", "backup"] as const) total += counts[lane] * brackets[lane].floorMw;
  return total;
}

describe("deriveCompositionCounts — affordability-waterfall planning", () => {
  it.each([0.2, 0.5, 0.8, 1.0])(
    "r=%s: sum===optTarget, reserve never planned, and the plan is affordable at floor prices",
    (r) => {
      for (const optTarget of [8, 10, 12, 14]) {
        const spendableNet = r * optTarget * BRACKETS.core.targetMw;
        const counts = deriveCompositionCounts({
          optTarget,
          existingTiers: EMPTY_TIERS,
          spendableNet,
          brackets: BRACKETS,
          premiumAppetite: 0.4, // below premium thresholds ⇒ isolates the body-tier split
          premiumCap: 0,
          superstarCap: 0,
          rosterMin: 8,
        });

        // Slot count is invariant (waterfall demotions are 1:1) ⇒ the plan can never itself induce below-opt.
        expect(sumCounts(counts)).toBe(optTarget);
        // Feasibility: the plan is affordable at (at least) floor prices — no unaffordable Core air-slots.
        // (Only breaks if even an all-Backup roster exceeds budget, impossible at these r≥0.2 budgets.)
        expect(floorCost(counts, BRACKETS)).toBeLessThanOrEqual(spendableNet + 1e-6);
        // Reserve is only planned as a small rotation floor for POORER teams (low budget/slot); a team
        // that can afford Depth-grade bodies (r ≥ 0.8 ⇒ budget/slot ≥ ~29) plans none.
        if (r >= 0.8) expect(counts.reserve).toBe(0);
      }
    },
  );

  it("richer clubs plan more Core than poorer ones (budget-coupled, not budget-blind)", () => {
    const base = { optTarget: 12, existingTiers: EMPTY_TIERS, brackets: BRACKETS, premiumAppetite: 0.4, premiumCap: 0, superstarCap: 0, rosterMin: 8 };
    const poor = deriveCompositionCounts({ ...base, spendableNet: 150 });
    const rich = deriveCompositionCounts({ ...base, spendableNet: 450 });
    expect(rich.core).toBeGreaterThan(poor.core);
    // A well-funded team keeps Depth as its largest body cohort.
    expect(rich.depth).toBeGreaterThanOrEqual(rich.backup);
    expect(rich.depth).toBeGreaterThan(0);
  });

  it("rich club: high premium appetite + budget yields a Superstar and Star slot", () => {
    const counts = deriveCompositionCounts({
      optTarget: 12,
      existingTiers: EMPTY_TIERS,
      spendableNet: 500,
      brackets: BRACKETS,
      premiumAppetite: 1.5, // ≥ SUPERSTAR_APPETITE_THRESHOLD (1.45)
      premiumCap: 3,
      superstarCap: 1,
      rosterMin: 8,
    });

    expect(counts.superstar).toBeGreaterThanOrEqual(1);
    expect(counts.star).toBeGreaterThanOrEqual(1);
    expect(counts.reserve).toBe(0);
    expect(sumCounts(counts)).toBe(12);
  });

  it("poor club: no premium, affordable plan that fills every slot AND plans a few Reserve rotation bodies", () => {
    const counts = deriveCompositionCounts({
      optTarget: 10,
      existingTiers: EMPTY_TIERS,
      spendableNet: 150,
      brackets: BRACKETS,
      premiumAppetite: 0.2,
      premiumCap: 0,
      superstarCap: 0,
      rosterMin: 8,
    });

    expect(counts.superstar).toBe(0);
    expect(counts.star).toBe(0);
    expect(counts.reserve).toBeGreaterThanOrEqual(1); // poor team keeps cheap rotation bodies
    expect(sumCounts(counts)).toBe(10);
    expect(floorCost(counts, BRACKETS)).toBeLessThanOrEqual(150 + 1e-6);
  });

  it("S2+: existing tiers reduce the incremental need and cap total planned slots to optTarget", () => {
    const existingTiers: Record<MarketBracketLane, number> = { ...EMPTY_TIERS, core: 3, depth: 4 };
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

    expect(sumCounts(counts)).toBeLessThanOrEqual(10);
    expect(counts.core).toBeGreaterThanOrEqual(existingTiers.core);
    expect(counts.depth).toBeGreaterThanOrEqual(existingTiers.depth);
    expect(counts.reserve).toBe(0);
  });

  it("premiumCap=0 fully suppresses Superstar/Star even at very high premium appetite", () => {
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
