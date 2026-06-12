import { describe, expect, it } from "vitest";

import {
  buildTrainingTraitSignal,
  getLegacyTraitTrainingFactorPct,
  LEGACY_TRAIT_TRAINING_FACTOR_PCT,
} from "@/lib/training/trait-training-signal";

describe("trait training signal", () => {
  it("exposes the documented legacy factor table", () => {
    expect(LEGACY_TRAIT_TRAINING_FACTOR_PCT.Ambitious).toBe(15);
    expect(LEGACY_TRAIT_TRAINING_FACTOR_PCT.Diligent).toBe(25);
    expect(LEGACY_TRAIT_TRAINING_FACTOR_PCT.Lazy).toBe(-20);
    expect(LEGACY_TRAIT_TRAINING_FACTOR_PCT.Fearless).toBe(-5);
    expect(getLegacyTraitTrainingFactorPct("Obsessive")).toBe(5);
  });

  it("compresses a normal positive raw signal into a moderate bonus", () => {
    const signal = buildTrainingTraitSignal({
      traitsPositive: ["Diligent"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(25);
    expect(signal.compressedTraitTrainingPct).toBe(10);
    expect(signal.trainingTraitMultiplier).toBe(1.1);
    expect(signal.traitCapReached).toBe(false);
  });

  it("caps a large positive raw signal at plus twelve percent", () => {
    const signal = buildTrainingTraitSignal({
      traitsPositive: ["Diligent", "Ambitious"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(40);
    expect(signal.compressedTraitTrainingPct).toBe(12);
    expect(signal.trainingTraitMultiplier).toBe(1.12);
    expect(signal.traitCapReached).toBe(true);
  });

  it("compresses a normal negative raw signal into a moderate malus", () => {
    const signal = buildTrainingTraitSignal({
      traitsNegative: ["Lazy"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(-20);
    expect(signal.compressedTraitTrainingPct).toBe(-8);
    expect(signal.trainingTraitMultiplier).toBe(0.92);
    expect(signal.traitCapReached).toBe(false);
  });

  it("caps a large negative raw signal at minus twelve percent", () => {
    const signal = buildTrainingTraitSignal({
      traitsNegative: ["Lazy", "Diva", "Fair"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(-35);
    expect(signal.compressedTraitTrainingPct).toBe(-12);
    expect(signal.trainingTraitMultiplier).toBe(0.88);
    expect(signal.traitCapReached).toBe(true);
  });

  it("warns on unknown traits without inventing a factor", () => {
    const signal = buildTrainingTraitSignal({
      traitsPositive: ["Ambitious", "Unknown Trait"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(15);
    expect(signal.warnings).toEqual(["unknown_trait_training_factor:Unknown Trait"]);
    expect(signal.breakdown.find((entry) => entry.trait === "Unknown Trait")).toEqual({
      trait: "Unknown Trait",
      legacyTraitTrainingFactorPct: null,
      known: false,
    });
  });
});

