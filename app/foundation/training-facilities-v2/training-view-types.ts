import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { ProgressionClassName } from "@/lib/training/class-progression-config";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import type { TrainingModeDemandView } from "@/lib/training/training-mode-demand-service";

export type TrainingModeOption = {
  value: PlayerTrainingMode;
  label: string;
  note: string;
  fatigueRisk: "niedrig" | "mittel" | "hoch";
  baseXp: number;
  recoveryDeltaPct: number;
  trainingSetpoints: number;
  fatigueLoad: number;
};

export type TrainingAttributeForecastEntry = {
  attribute: string;
  before: number;
  after: number;
  delta: number;
  training: number;
  performance: number;
  regression: number;
  affinity: "signature" | "weak" | "neutral";
};

export type TrainingPlayerRowView = {
  entryId: string;
  roleTag: string | null;
  player: {
    id: string;
    name: string;
    className: string;
    portraitUrl?: string | null;
    portraitPath?: string | null;
    coreStats: {
      pow: number;
      spe: number;
      men: number;
      soc: number;
    };
  };
  mode: PlayerTrainingMode;
  trainingClass: string;
  modeConfig: {
    label: string;
    note: string;
    fatigueRisk: "niedrig" | "mittel" | "hoch";
  };
  appearances: number;
  playerMvs: number | null;
  playerPps: number | null;
  trainingXp: number;
  performanceXp: number;
  totalXp: number;
  upgradeEstimate: string;
  fatigueWarning: string;
  recoveryForecast: {
    before: number;
    after: number;
    modifierPct: number;
  };
  classTrainingFocus: {
    primary: Array<{ attribute: string; weight: number }>;
    risks: Array<{ attribute: string; weight: number }>;
  };
  attributeForecast: TrainingAttributeForecastEntry[];
  modifiers: {
    traitModifierPct: number;
    facilityModifierPct: number;
    potentialTrainingMultiplier: number;
    signatureAttributes: string[];
    weakAttribute: string | null;
  };
  developmentStars: {
    currentAbilityStars: string | null;
    potentialStars: string | null;
    currentAbilityRating: number | null;
    potentialRating: number | null;
  };
  traitBoosts: Array<{
    trait: string;
    pct: number;
    tone: "positive" | "negative" | "neutral";
  }>;
  trainingDemand: TrainingModeDemandView | null;
  organicForecast: {
    classBefore: string;
    classAfter: string;
    potentialRating: number | null;
    potentialTrainingMultiplier: number;
    trainingSetpoints: number;
    performanceSetpoints: number;
    netSetpoints: number;
    fatigueLoad: number;
    topGains: Array<{ attribute: string; before: number; after: number; delta: number }>;
    topLosses: Array<{ attribute: string; before: number; after: number; delta: number }>;
  };
  forecast: {
    netDevelopmentXP: number;
    trainingFormTier: string;
    regressionRisk: string | null;
    regressionPressure: number;
    appearanceXP: number;
    mvsXP: number;
    ppsBonusXP: number;
    topPlayerXP: number;
    highlightXP: number;
    traitModifierPct: number;
    fatigueStrain: {
      label: "niedrig" | "mittel" | "hoch";
    };
  };
};

export type TrainingDevelopmentFilter = "all" | "growth" | "stable" | "regression";

export type TrainingClassOption = {
  value: ProgressionClassName;
  label: string;
};

export type TrainingSummaryView = {
  recoveryBeforeTraining: number;
  recoveryAfterTraining: number;
  performanceXp: number;
  totalXp: number;
  lightModeCount: number;
  hardModeCount: number;
  trainingXpAfter: number;
  trainingXpModifierPct: number;
};
