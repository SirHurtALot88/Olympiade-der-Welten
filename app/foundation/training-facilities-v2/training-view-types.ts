import type { AdminBalancingConfigInput, ContractShape, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
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
  /**
   * Spillover-Trainingsanteil (Nebenstat-Hilfe): separat von `training`, damit die Breakdown-Anzeige
   * ihn eigenständig ausweisen kann. In `delta`/`after` ist er bereits enthalten.
   */
  spillover?: number;
  /**
   * Realer per-Attribut-Trainingsmultiplikator der Engine (Decke × Achsen-Potenzialraum × Affinität).
   * Wird von `buildTrainingClassGainRanking` genutzt, um die Pro-Klasse-Schätzung exakt an die Engine
   * anzugleichen (statt nur Decke × Affinität).
   */
  trainingGrowthMultiplier?: number;
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
  /**
   * Gehalt/Vertrag für die Steuer-Tabelle (Chris: "damit man weiß welche Spieler mit
   * langem Vertrag man entwickeln sollte"). Dieselbe Quelle wie die Kaderliste
   * (`getRosterEntryDisplaySalary` in `season-stand-render-helpers.tsx`, die intern
   * `resolvePlayerEconomyContract` nutzt) — kein zweiter Rechenweg für Gehalt/Vertrag.
   * `null`, wenn der Spieler keinen Kader-Eintrag hat (z. B. Free Agent im Forecast).
   */
  economy: {
    /** Aktuelles Saison-Gehalt (Vertragsjahr 1) — front-/back-loaded-bewusst. */
    salary: number | null;
    /** Restlaufzeit in Saisons. */
    contractLength: number | null;
    contractShape: ContractShape | null;
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
    /** Auf die Fokus-Stats angewendeter Trainingsanteil (nach Decke/Potenzialraum/Affinität). */
    appliedTrainingSetpoints?: number;
    /** Auf Nebenstats umverteilter Spillover-Anteil (getrennt ausgewiesen). */
    spilloverSetpoints?: number;
    performanceSetpoints: number;
    netSetpoints: number;
    fatigueLoad: number;
    topGains: Array<{ attribute: string; before: number; after: number; delta: number }>;
    topLosses: Array<{ attribute: string; before: number; after: number; delta: number }>;
  };
  /**
   * Was der Spieler in DIESER Saison bereits eingebracht hat — im Gegensatz zu
   * `organicForecast`, das die Projektion auf die VOLLE Saison zeigt.
   *
   * Quelle ist `buildPlayerSeasonTrainingForecast`: dieselbe Organic-Projektion,
   * aber nur mit dem bis heute gesammelten Trainings-Budget und dem
   * Performance-Fenster bis zum letzten gespielten Spieltag. Attribute werden
   * weiterhin erst am Saisonende real gebucht — das hier ist der bis jetzt
   * aufgelaufene Stand, nicht eine zweite Buchung.
   *
   * `null`, solange in dieser Saison noch kein Spieltag ins Budget eingeflossen ist.
   */
  seasonSoFar: {
    matchdaysPlayed: number;
    totalMatchdays: number;
    /** Netto (Training + Spillover + Performance − Regression). */
    netCumulative: number;
    trainingTotal: number;
    spilloverTotal: number;
    performanceTotal: number;
    regressionTotal: number;
  } | null;
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
   * Trainings-Fokusachse des Teams. Quelle ist seit S1 zuerst die Specialist-Wing-Variante
   * (power_gym→POW, agility_track→SPE, mind_lab→MEN, social_studio→SOC) und nur ohne Flügel die
   * KI-Trainingseinstellung. Treibt den Routenbonus in `estimateClassTrainingGains` /
   * `buildTrainingClassGainRanking` — null heißt: keine Achse gesetzt (Bonus überall inaktiv).
   */
  trainingFocusAxis?: "pow" | "spe" | "men" | "soc" | null;
  /**
   * Höhe des Routenbonus in Prozent (Basis 8 %, mit Specialist Wing bis 13 %). Getrennt vom Achsen-
   * Feld, damit die Anzeige denselben Wert zeigt, den die Engine rechnet.
   */
  trainingFocusBonusPct?: number;
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
