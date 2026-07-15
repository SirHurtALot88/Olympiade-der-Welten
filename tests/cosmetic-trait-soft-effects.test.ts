import { describe, expect, it } from "vitest";

import {
  COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS,
  COSMETIC_TRAIT_POPULARITY_WEIGHTS,
  computeCosmeticTraitPopularityBonus,
  getPlayerFatigueLoadMultiplier,
} from "@/lib/traits/cosmetic-trait-soft-effects";

function player(traitsPositive: string[] = [], traitsNegative: string[] = []) {
  return { traitsPositive, traitsNegative };
}

describe("cosmetic-trait-soft-effects: fatigue", () => {
  it("returns 1 (no effect) for a player with no mapped traits", () => {
    expect(getPlayerFatigueLoadMultiplier(player(["Ambitious"], ["Lazy"]))).toBe(1);
  });

  it("applies the Healthy multiplier for a positive-trait player", () => {
    expect(getPlayerFatigueLoadMultiplier(player(["Healthy"]))).toBe(
      COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS.Healthy,
    );
  });

  it("applies the FaintHearted multiplier for a negative-trait player", () => {
    expect(getPlayerFatigueLoadMultiplier(player([], ["FaintHearted"]))).toBe(
      COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS.FaintHearted,
    );
  });

  it("stacks multiplicatively when a player somehow carries both", () => {
    const expected =
      COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS.Healthy * COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS.FaintHearted;
    expect(getPlayerFatigueLoadMultiplier(player(["Healthy"], ["FaintHearted"]))).toBeCloseTo(expected, 10);
  });

  it("keeps magnitudes small (within +/-10%)", () => {
    for (const factor of Object.values(COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS)) {
      expect(factor).toBeGreaterThanOrEqual(0.9);
      expect(factor).toBeLessThanOrEqual(1.1);
    }
  });
});

describe("cosmetic-trait-soft-effects: popularity", () => {
  it("returns 0 for an empty roster", () => {
    expect(computeCosmeticTraitPopularityBonus([])).toBe(0);
  });

  it("returns 0 when no roster player carries a mapped trait", () => {
    const roster = [player(["Ambitious"]), player([], ["Lazy"])];
    expect(computeCosmeticTraitPopularityBonus(roster)).toBe(0);
  });

  it("adds the Eloquent weight when the whole roster carries it", () => {
    const roster = [player(["Eloquent"]), player(["Eloquent"])];
    expect(computeCosmeticTraitPopularityBonus(roster)).toBeCloseTo(
      COSMETIC_TRAIT_POPULARITY_WEIGHTS.Eloquent,
      10,
    );
  });

  it("scales by roster share for a partial match", () => {
    const roster = [player(["Eloquent"]), player(["Ambitious"])];
    expect(computeCosmeticTraitPopularityBonus(roster)).toBeCloseTo(
      COSMETIC_TRAIT_POPULARITY_WEIGHTS.Eloquent * 0.5,
      10,
    );
  });

  it("applies the negative Scandalous weight as a drag", () => {
    const roster = [player([], ["Scandalous"])];
    expect(computeCosmeticTraitPopularityBonus(roster)).toBeCloseTo(
      COSMETIC_TRAIT_POPULARITY_WEIGHTS.Scandalous,
      10,
    );
    expect(COSMETIC_TRAIT_POPULARITY_WEIGHTS.Scandalous).toBeLessThan(0);
  });

  it("excludes FanFavorite to avoid double-counting the existing fan-favorites sub-score", () => {
    expect(COSMETIC_TRAIT_POPULARITY_WEIGHTS.FanFavorite).toBeUndefined();
  });

  it("keeps magnitudes small (|weight| <= 0.03)", () => {
    for (const weight of Object.values(COSMETIC_TRAIT_POPULARITY_WEIGHTS)) {
      expect(Math.abs(weight)).toBeLessThanOrEqual(0.03);
    }
  });
});
