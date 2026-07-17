import type { AdminBalancingConfigInput, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { AttributeHeadroomState } from "@/lib/scouting/player-attribute-ceiling-service";
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
  attributeKey: PlayerGeneratorAttributeName;
  attribute: string;
  before: number;
  after: number;
  delta: number;
  training: number;
  performance: number;
  regression: number;
  affinity: "signature" | "weak" | "neutral";
  ceilingState?: AttributeHeadroomState;
  headroomLabel?: string | null;
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
    /** Current in-season fatigue (0–100), including per-matchday accumulated training fatigue. */
    fatigue: number;
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
  /**
   * Anti-cheese Teil B (B.6): per-matchday training accumulation forecast. `accumulatedBudget` is the
   * base training budget already locked in from the matchdays played so far; `forecastBudget` projects
   * the season-end base budget if the remaining matchdays are trained at the currently-drafted `mode`
   * (`accumulatedBudget + (totalMatchdays - matchdaysCounted) * share(currentMode)`). Null before the
   * first matchday of the season (nothing accumulated yet).
   */
  trainingAccumulatorForecast?: {
    matchdaysCounted: number;
    totalMatchdays: number;
    accumulatedBudget: number;
    forecastBudget: number;
    currentMode: PlayerTrainingMode;
  } | null;
  recommendedTrainingMode?: PlayerTrainingMode | null;
  recommendedTrainingDetail?: string | null;
  recommendedTrainingMatchesCurrent?: boolean;
  adminBalancingConfig?: AdminBalancingConfigInput | null;
  /**
   * The player's team's current training focus axis (AI manager training settings), if any.
   * Drives the development-route ×1.08 bonus in `estimateClassTrainingGains` /
   * `buildTrainingClassGainRanking` — null means no focus is set (bonus dormant everywhere).
   */
  trainingFocusAxis?: "pow" | "spe" | "men" | "soc" | null;
  /**
   * True once the team's training intensity is sealed for the current season
   * (preseason setup window closed / first matchday result recorded). See
   * `evaluateGamePhaseAction(gameState, "set_training")` and
   * docs/training-intensity-season-lock.md.
   */
  trainingIntensityLocked?: boolean;
  /**
   * True during the short early-season grace window before the first result is
   * recorded. Training mode can still be changed now, but the lock will snap
   * shut as soon as the first matchday result exists.
   */
  trainingIntensityLockWarning?: boolean;
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
