import type {
  AdminBalancingConfig,
  AdminBalancingConfigInput,
  PlayerGeneratorAttributeName,
} from "@/lib/data/olyDataTypes";
import {
  CLASS_PROGRESSION_WEIGHTS,
  PROGRESSION_ATTRIBUTE_ORDER,
  PROGRESSION_CLASS_ORDER,
} from "@/lib/training/class-progression-config";
import { LEGACY_TRAIT_TRAINING_FACTOR_PCT } from "@/lib/training/trait-training-signal";

export const DEFAULT_PRIZE_MONEY_PERCENTS = [
  7.67, 7.29, 6.9, 6.52, 6.13, 5.75, 5.37, 4.98, 4.6, 4.22, 3.99, 3.76, 3.53, 3.3, 3.07, 2.84,
  2.61, 2.38, 2.15, 1.92, 1.76, 1.61, 1.46, 1.3, 1.15, 1, 0.84, 0.69, 0.54, 0.38, 0.23, 0.08,
] as const;

export const ADMIN_BALANCING_CONFIG_VERSION = 1;

function roundValue(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getDefaultAdminBalancingConfig(): AdminBalancingConfig {
  return {
    version: ADMIN_BALANCING_CONFIG_VERSION,
    classProgressionWeights: Object.fromEntries(
      PROGRESSION_CLASS_ORDER.map((className) => [
        className,
        Object.fromEntries(
          PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [
            attribute,
            CLASS_PROGRESSION_WEIGHTS[className][attribute],
          ]),
        ) as Record<PlayerGeneratorAttributeName, number>,
      ]),
    ) as AdminBalancingConfig["classProgressionWeights"],
    traitTrainingFactorsPct: { ...LEGACY_TRAIT_TRAINING_FACTOR_PCT },
    prizeMoneyPercents: [...DEFAULT_PRIZE_MONEY_PERCENTS],
    updatedAt: null,
  };
}

export function resolveAdminBalancingConfig(input?: AdminBalancingConfigInput | null): AdminBalancingConfig {
  const defaults = getDefaultAdminBalancingConfig();
  const classProgressionWeights = Object.fromEntries(
    PROGRESSION_CLASS_ORDER.map((className) => {
      const inputRow = input?.classProgressionWeights?.[className] ?? {};
      return [
        className,
        Object.fromEntries(
          PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [
            attribute,
            roundValue(toFiniteNumber(inputRow[attribute], defaults.classProgressionWeights[className][attribute])),
          ]),
        ) as Record<PlayerGeneratorAttributeName, number>,
      ];
    }),
  ) as AdminBalancingConfig["classProgressionWeights"];

  const traitTrainingFactorsPct = Object.fromEntries(
    Object.entries(defaults.traitTrainingFactorsPct).map(([trait, defaultValue]) => [
      trait,
      roundValue(toFiniteNumber(input?.traitTrainingFactorsPct?.[trait], defaultValue), 2),
    ]),
  ) as AdminBalancingConfig["traitTrainingFactorsPct"];

  const prizeMoneyPercents = defaults.prizeMoneyPercents.map((defaultValue, index) =>
    roundValue(Math.max(0, toFiniteNumber(input?.prizeMoneyPercents?.[index], defaultValue)), 2),
  );

  return {
    version: ADMIN_BALANCING_CONFIG_VERSION,
    classProgressionWeights,
    traitTrainingFactorsPct,
    prizeMoneyPercents,
    updatedAt: input?.updatedAt ?? null,
  };
}

