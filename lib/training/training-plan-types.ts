import type { PlayerScoutPotential } from "@/lib/progression/player-potential-service";

export type LegacyTraitTrainingFactorMap = Record<string, number>;

export type TrainingTraitSignalInput = {
  traitsPositive?: string[] | null;
  traitsNegative?: string[] | null;
};

export type TrainingTraitSignalBreakdownEntry = {
  trait: string;
  legacyTraitTrainingFactorPct: number | null;
  known: boolean;
};

export type TrainingTraitSignal = {
  traits: string[];
  breakdown: TrainingTraitSignalBreakdownEntry[];
  rawTraitTrainingSignalPct: number;
  compressedTraitTrainingPct: number;
  trainingTraitMultiplier: number;
  traitCapReached: boolean;
  warnings: string[];
};

export type PlayerTrainingMode = "leicht" | "mittel" | "hart";

export type PlayerProgressionXpEventType =
  | "base_training"
  | "appearance"
  | "mvs"
  | "pps_bonus"
  | "top10"
  | "rank1"
  | "highlight"
  | "trait_modifier"
  | "potential_modifier"
  | "facility_modifier";

export type PlayerProgressionXpEvent = {
  type: PlayerProgressionXpEventType;
  label: string;
  xpBeforeTraits: number;
  traitModifierPct: number;
  xpAfterTraits: number;
  sourceStatus: "ready" | "missing_source" | "future_source";
};

export type PlayerProgressionRatingTier = "F" | "E" | "D" | "C" | "B" | "A" | "S" | "S+" | "99";

export type PlayerProgressionForecast = {
  playerId: string;
  trainingMode: PlayerTrainingMode;
  currentXP: number;
  spentXP: number;
  lifetimeXP: number | null;
  seasonProjectedXP: number;
  baseTrainingXP: number;
  appearanceXP: number;
  mvsXP: number;
  ppsBonusXP: number;
  topPlayerXP: number;
  highlightXP: number;
  performanceXP: number;
  traitModifierPct: number;
  traitMultiplier: number;
  potentialTrainingMultiplier: number;
  scoutPotential: PlayerScoutPotential | null;
  xpBeforeTraits: number;
  xpAfterTraits: number;
  xpEvents: PlayerProgressionXpEvent[];
  possibleUpgradeSummary: string;
  ratingTierCosts: Record<PlayerProgressionRatingTier, number | null>;
  fatigueStrain: {
    label: "niedrig" | "mittel" | "hoch";
    score: number;
    warning: string;
  };
  sourceStatus: {
    appearances: "ready" | "missing_source";
    mvs: "ready" | "missing_source";
    pps: "ready" | "missing_source";
    highlights: "ready" | "missing_source";
    facilities: "future_source";
    writes: "preview_only";
  };
  audit: {
    mvsPpsCoupling: string;
    seasonEndOnly: true;
    productiveWrites: false;
    warnings: string[];
  };
};
