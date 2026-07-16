import type {
  LegacyTraitTrainingFactorMap,
  TrainingTraitSignal,
  TrainingTraitSignalBreakdownEntry,
  TrainingTraitSignalInput,
} from "@/lib/training/training-plan-types";
import type { AdminBalancingConfigInput } from "@/lib/data/olyDataTypes";
import {
  CANONICAL_NEGATIVE_TRAITS,
  CANONICAL_POSITIVE_TRAITS,
  CANONICAL_PROGRESS_TRAITS,
} from "@/lib/training/class-progression-config";

export { CANONICAL_NEGATIVE_TRAITS, CANONICAL_POSITIVE_TRAITS, CANONICAL_PROGRESS_TRAITS };

export const LEGACY_TRAIT_TRAINING_FACTOR_PCT: LegacyTraitTrainingFactorMap = {
  Altruistic: -5,
  Ambitious: 15,
  Caring: -10,
  Cool: 7.5,
  Diligent: 25,
  Eloquent: 5,
  Fair: -5,
  FanFavorite: 10,
  FiredUp: 15,
  Flexible: 5,
  Healthy: 10,
  Loyal: 5,
  Motivated: 15,
  Relaxed: -15,
  Sexy: 10,
  Resourceful: 5,
  Fearless: -5,
  Disciplined: 15,
  Timid: -5,
  Cheater: -15,
  ColdBlooded: 5,
  Devious: 5,
  Diva: -10,
  Egomaniac: 20,
  FaintHearted: -15,
  Feisty: 10,
  Gambler: -5,
  Lazy: -20,
  Manipulative: -5,
  Mercenary: 5,
  Renegade: -5,
  Scandalous: -5,
  Cruel: -5,
  Paranoid: -15,
  Obsessive: 5,
  Vindictive: 5,
};

const TRAINING_SIGNAL_COMPRESSION_FACTOR = 0.4;
/** Effective training budget bonus/malus after compression (not raw trait sum). */
export const TRAINING_SIGNAL_MIN_PCT = -20;
export const TRAINING_SIGNAL_MAX_PCT = 25;

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function collectTraits(input: TrainingTraitSignalInput) {
  return [...(input.traitsPositive ?? []), ...(input.traitsNegative ?? [])];
}

export function normalizeProgressionTraitName(trait: string | null | undefined) {
  if (!trait) return null;
  const normalized = trait.trim().toLowerCase();
  if (!normalized || normalized === "#n/a") return null;
  return CANONICAL_PROGRESS_TRAITS.find((entry) => entry.toLowerCase() === normalized) ?? null;
}

export function buildTrainingTraitSignal(input: TrainingTraitSignalInput & { adminConfig?: AdminBalancingConfigInput | null }): TrainingTraitSignal {
  const traits = collectTraits(input);
  const traitFactors = input.adminConfig?.traitTrainingFactorsPct
    ? { ...LEGACY_TRAIT_TRAINING_FACTOR_PCT, ...input.adminConfig.traitTrainingFactorsPct }
    : LEGACY_TRAIT_TRAINING_FACTOR_PCT;
  const warnings: string[] = [];
  const breakdown: TrainingTraitSignalBreakdownEntry[] = traits.map((trait) => {
    const canonicalTrait = normalizeProgressionTraitName(trait);
    const legacyTraitTrainingFactorPct = canonicalTrait ? traitFactors[canonicalTrait] : null;
    if (typeof legacyTraitTrainingFactorPct !== "number" || !Number.isFinite(legacyTraitTrainingFactorPct)) {
      warnings.push(`unknown_trait_training_factor:${trait}`);
      return {
        trait,
        legacyTraitTrainingFactorPct: null,
        known: false,
      };
    }

    return {
      trait: canonicalTrait ?? trait,
      legacyTraitTrainingFactorPct,
      known: true,
    };
  });

  const rawTraitTrainingSignalPct = roundValue(
    breakdown.reduce((sum, entry) => sum + (entry.legacyTraitTrainingFactorPct ?? 0), 0),
    2,
  );
  const unclampedCompressedPct = rawTraitTrainingSignalPct * TRAINING_SIGNAL_COMPRESSION_FACTOR;
  const compressedTraitTrainingPct = roundValue(
    clamp(unclampedCompressedPct, TRAINING_SIGNAL_MIN_PCT, TRAINING_SIGNAL_MAX_PCT),
    2,
  );
  const traitCapReached =
    roundValue(unclampedCompressedPct, 2) !== compressedTraitTrainingPct;

  return {
    traits,
    breakdown,
    rawTraitTrainingSignalPct,
    compressedTraitTrainingPct,
    trainingTraitMultiplier: roundValue(1 + compressedTraitTrainingPct / 100, 4),
    traitCapReached,
    warnings: [...new Set(warnings)],
  };
}

export function getLegacyTraitTrainingFactorPct(trait: string) {
  const canonicalTrait = normalizeProgressionTraitName(trait);
  return canonicalTrait ? LEGACY_TRAIT_TRAINING_FACTOR_PCT[canonicalTrait] ?? null : null;
}
