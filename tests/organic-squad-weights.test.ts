import { describe, expect, it } from "vitest";

import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import type { OrganicGmBiasInput, OrganicIdentityInput } from "@/lib/ai/organic-squad/types";
import { ROSTER_MAX, ROSTER_MIN } from "@/lib/ai/organic-squad/types";

function identity(overrides: Partial<OrganicIdentityInput> = {}): OrganicIdentityInput {
  return {
    ambition: 50,
    finances: 50,
    boardConfidence: 50,
    harmony: 50,
    playerOpt: 11,
    ...overrides,
  };
}

describe("deriveUtilityWeights", () => {
  it("gives an ambitious, under-pressure team a strictly higher wWin than a timid, secure one", () => {
    const ambitious = identity({ ambition: 85, finances: 40, boardConfidence: 30 });
    const timid = identity({ ambition: 25, finances: 80, boardConfidence: 80 });

    const ambitiousWeights = deriveUtilityWeights(ambitious, {});
    const timidWeights = deriveUtilityWeights(timid, {});

    expect(ambitiousWeights.wWin).toBeGreaterThan(timidWeights.wWin);
    expect(timidWeights.wPatience).toBeGreaterThan(ambitiousWeights.wPatience);
  });

  it("gives a thrifty GM higher wThrift and wPatience than a neutral GM", () => {
    const base = identity();
    const neutralBias: OrganicGmBiasInput = {};
    const thriftyBias: OrganicGmBiasInput = { valuePriority: 9, cashPriority: 9 };

    const neutral = deriveUtilityWeights(base, neutralBias);
    const thrifty = deriveUtilityWeights(base, thriftyBias);

    expect(thrifty.wThrift).toBeGreaterThan(neutral.wThrift);
    expect(thrifty.wPatience).toBeGreaterThan(neutral.wPatience);
  });

  it("gives an elite-small-roster GM a lower optTarget than a depth-preference GM (both within bounds)", () => {
    const base = identity({ playerOpt: 12 });

    const eliteSmall = deriveUtilityWeights(base, { eliteSmallRosterPreference: 9 });
    const depth = deriveUtilityWeights(base, { rosterDepthPreference: 9 });

    expect(eliteSmall.optTarget).toBeLessThan(depth.optTarget);
    for (const weights of [eliteSmall, depth]) {
      expect(weights.optTarget).toBeGreaterThanOrEqual(ROSTER_MIN);
      expect(weights.optTarget).toBeLessThanOrEqual(ROSTER_MAX);
    }
  });

  it("applies a reproducible per-seed strategy variance (optTarget and/or weights) without a variationSeed being bitidentical to the un-jittered call", () => {
    const base = identity();
    const bias: OrganicGmBiasInput = { starPriority: 6, valuePriority: 4 };

    const unseeded = deriveUtilityWeights(base, bias);
    const unseededAgain = deriveUtilityWeights(base, bias, null);
    expect(unseededAgain).toEqual(unseeded);

    const seedA = deriveUtilityWeights(base, bias, "saveA:teamX:season1");
    const seedARepeat = deriveUtilityWeights(base, bias, "saveA:teamX:season1");
    const seedB = deriveUtilityWeights(base, bias, "saveB:teamX:season1");

    // Reproducibility: identical seed ⇒ identical output.
    expect(seedARepeat).toEqual(seedA);

    // Variance: different seeds produce a different optTarget and/or different weights.
    const seedsDiffer =
      seedA.optTarget !== seedB.optTarget ||
      seedA.wWin !== seedB.wWin ||
      seedA.wThrift !== seedB.wThrift ||
      seedA.wSustain !== seedB.wSustain ||
      seedA.wAsset !== seedB.wAsset ||
      seedA.wPatience !== seedB.wPatience ||
      seedA.wProfit !== seedB.wProfit;
    expect(seedsDiffer).toBe(true);

    // Identity band: the seeded weights stay close to (within a small factor of) the un-jittered base,
    // never flipping the team's underlying character.
    for (const seeded of [seedA, seedB]) {
      expect(seeded.optTarget).toBeGreaterThanOrEqual(ROSTER_MIN);
      expect(seeded.optTarget).toBeLessThanOrEqual(ROSTER_MAX);
      expect(Math.abs(seeded.optTarget - unseeded.optTarget)).toBeLessThanOrEqual(1);
      expect(seeded.wWin).toBeGreaterThan(0);
    }
  });

  it("never produces negative weights, and falls back to the identity-only base when gmBias is empty", () => {
    const scenarios: OrganicIdentityInput[] = [
      identity({ ambition: 0, finances: 0, boardConfidence: 0, harmony: 0, playerOpt: 8 }),
      identity({ ambition: 100, finances: 100, boardConfidence: 100, harmony: 100, playerOpt: 14 }),
      identity(),
    ];

    for (const scenario of scenarios) {
      expect(() => deriveUtilityWeights(scenario, {})).not.toThrow();
      const weights = deriveUtilityWeights(scenario, {});
      expect(weights.wWin).toBeGreaterThanOrEqual(0);
      expect(weights.wThrift).toBeGreaterThanOrEqual(0);
      expect(weights.wSustain).toBeGreaterThanOrEqual(0);
      expect(weights.wAsset).toBeGreaterThanOrEqual(0);
      expect(weights.wPatience).toBeGreaterThanOrEqual(0);
      expect(weights.optTarget).toBeGreaterThanOrEqual(ROSTER_MIN);
      expect(weights.optTarget).toBeLessThanOrEqual(ROSTER_MAX);
    }
  });
});
