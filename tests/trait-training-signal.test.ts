import { describe, expect, it } from "vitest";

import {
  buildTrainingTraitSignal,
  CANONICAL_NEGATIVE_TRAITS,
  CANONICAL_POSITIVE_TRAITS,
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

  it("confirms the canonical trait scope is 18 positive and 18 negative traits", () => {
    expect(CANONICAL_POSITIVE_TRAITS).toHaveLength(18);
    expect(CANONICAL_NEGATIVE_TRAITS).toHaveLength(18);
    expect(getLegacyTraitTrainingFactorPct("lazy")).toBe(-20);
    expect(getLegacyTraitTrainingFactorPct("InjuryProne")).toBeNull();
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

  it("caps a large positive raw signal at plus twenty-five percent effective", () => {
    const signal = buildTrainingTraitSignal({
      traitsPositive: ["Diligent", "Ambitious"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(40);
    expect(signal.compressedTraitTrainingPct).toBe(16);
    expect(signal.trainingTraitMultiplier).toBe(1.16);
    expect(signal.traitCapReached).toBe(false);
  });

  it("caps a stacked positive raw signal at plus twenty-five percent effective", () => {
    const signal = buildTrainingTraitSignal({
      traitsPositive: ["Diligent", "Ambitious", "Motivated", "FiredUp"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(70);
    expect(signal.compressedTraitTrainingPct).toBe(25);
    expect(signal.trainingTraitMultiplier).toBe(1.25);
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

  it("caps a large negative raw signal at minus twenty percent effective", () => {
    const signal = buildTrainingTraitSignal({
      traitsNegative: ["Lazy", "Diva", "Fair"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(-35);
    expect(signal.compressedTraitTrainingPct).toBe(-14);
    expect(signal.trainingTraitMultiplier).toBe(0.86);
    expect(signal.traitCapReached).toBe(false);
  });

  it("caps a stacked negative raw signal at minus twenty percent effective", () => {
    const signal = buildTrainingTraitSignal({
      traitsNegative: ["Lazy", "Diva", "Paranoid", "Relaxed"],
    });

    expect(signal.rawTraitTrainingSignalPct).toBe(-60);
    expect(signal.compressedTraitTrainingPct).toBe(-20);
    expect(signal.trainingTraitMultiplier).toBe(0.8);
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
