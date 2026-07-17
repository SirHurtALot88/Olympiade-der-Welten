"use client";

import { useMemo, useState } from "react";

import { FoundationButton } from "@/components/foundation/FoundationButton";
import { FoundationCard } from "@/components/foundation/FoundationCard";
import { EmptyState } from "@/components/foundation/EmptyState";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import {
  buildTrainingImpactItems,
  buildTrainingModeSegments,
  VeloAttributeFocusTags,
  VeloImpactStrip,
  VeloIntensityRail,
} from "@/components/foundation/velo-ui";
import { formatNlNumber, formatNlSignedNumber, formatNlSignedPercent } from "@/components/foundation/new-look/nl-tones";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { getTrainingModePresentation, TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";
import { PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE } from "@/lib/training/organic-season-progression";
import {
  getClassTrainingProfile,
  normalizeProgressionClassName,
  PROGRESSION_ATTRIBUTE_ORDER,
  PROGRESSION_CLASS_ORDER,
  type ProgressionClassName,
} from "@/lib/training/class-progression-config";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import type { Player, PlayerDemandStatus } from "@/lib/data/olyDataTypes";
import { estimateClassTrainingGains } from "@/lib/training/class-training-gain-estimate";
import { getDevelopmentRouteBonusMultiplier } from "@/lib/training/development-route-bonus";
import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";

import type {
  TrainingClassOption,
  TrainingDevelopmentFilter,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";
import { sortTrainingAttributeForecastByClassProfile } from "@/lib/training/training-forecast-display";

export function formatLocaleNumber(value: number | null | undefined, digits = 0) {
  return formatNlNumber(value, digits);
}

export function formatSignedPercent(value: number | null | undefined) {
  return formatNlSignedPercent(value);
}

const TRAINING_FOCUS_AXIS_LABEL: Record<"pow" | "spe" | "men" | "soc", string> = {
  pow: "Power",
  spe: "Speed",
  men: "Mental",
  soc: "Social",
};

export function getDevelopmentTone(row: TrainingPlayerRowView) {
  if (row.organicForecast.netSetpoints < 0 || row.forecast.regressionRisk === "high") {
    return "regression";
  }
  if (row.organicForecast.netSetpoints >= 2) {
    return "growth";
  }
  return "stable";
}

function roundTo(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export type TrainingIntensityProjectionEntry = {
  mode: PlayerTrainingMode;
  label: string;
  /** "durch Training" — Trainingsbudget für diese Intensität (potentialgetrieben, pro Spieler). */
  trainingGain: number;
  /** Angewendeter Performance-Anteil bei dieser Intensität. */
  performanceGain: number;
  /** Regressions-Drag (negativ), intensitätsunabhängig. */
  regression: number;
  /** Projizierter Netto-Forecast, wenn diese Intensität gewählt würde. */
  net: number;
  isCurrent: boolean;
  fatigueLoad: number;
  /** Regenerations-Delta dieser Intensität in % (echtes Feld aus `trainingModeOptions`, z. B. Recovery/Verletzungsschutz-Trade-off). */
  recoveryDeltaPct: number;
};

/**
 * Per-Spieler, per-Intensität (leicht/mittel/hart) Trainings-Prognose.
 *
 * Reine Ableitung aus real vorhandenen Row-Feldern, KEINE neue Balance-Formel:
 * Die Engine (`buildOrganicSeasonProgression`, organic-season-progression.ts:628-636)
 * berechnet `trainingSetpoints = TRAINING_SETPOINTS_BY_MODE[mode] * traitMult *
 * potentialTrainingMultiplier * routeBonus * facility`. Nur die Modus-Basis ist
 * modusabhängig → das Budget skaliert exakt linear mit `TRAINING_SETPOINTS_BY_MODE`,
 * und der `potentialTrainingMultiplier` steckt schon im Budget des aktuellen Modus.
 * Dadurch fällt die Prognose PRO SPIELER unterschiedlich aus: höheres Potential →
 * größeres `organicForecast.trainingSetpoints` → größerer Zuwachs über alle Intensitäten.
 *
 * Angewendetes Training skaliert ebenfalls linear (die Attribut-Multiplikatoren sind
 * modusunabhängig), daher wird der Netto-Wert exakt gegenüber dem echten aktuellen
 * `netSetpoints` verschoben: Δtraining (angewendet) + Δperformance (Modus-Gewicht
 * PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE).
 */
export function buildTrainingIntensityProjection(
  row: TrainingPlayerRowView,
  trainingModeOptions: TrainingModeOption[],
): TrainingIntensityProjectionEntry[] {
  const currentBudgetBase = TRAINING_SETPOINTS_BY_MODE[row.mode] ?? TRAINING_SETPOINTS_BY_MODE.mittel;
  const currentTrainingBudget = row.organicForecast.trainingSetpoints;
  const appliedTrainingCurrent = row.attributeForecast.reduce((sum, entry) => sum + entry.training, 0);
  const appliedPerformanceCurrent = row.organicForecast.performanceSetpoints;
  const regressionTotal = row.attributeForecast.reduce((sum, entry) => sum + entry.regression, 0);
  const currentNet = row.organicForecast.netSetpoints;
  const currentPerfWeight = PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE[row.mode] ?? 1;

  return trainingModeOptions.map((option) => {
    const budgetBase = TRAINING_SETPOINTS_BY_MODE[option.value] ?? option.trainingSetpoints;
    const budgetScale = currentBudgetBase > 0 ? budgetBase / currentBudgetBase : 1;
    const trainingGain = currentTrainingBudget * budgetScale;
    const appliedTraining = appliedTrainingCurrent * budgetScale;
    const perfWeight = PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE[option.value] ?? 1;
    const performanceGain = appliedPerformanceCurrent * (currentPerfWeight > 0 ? perfWeight / currentPerfWeight : 1);
    const net = currentNet + (appliedTraining - appliedTrainingCurrent) + (performanceGain - appliedPerformanceCurrent);
    return {
      mode: option.value,
      label: option.label,
      trainingGain: roundTo(trainingGain, 1),
      performanceGain: roundTo(performanceGain, 1),
      regression: roundTo(regressionTotal, 1),
      net: roundTo(net, 1),
      isCurrent: option.value === row.mode,
      fatigueLoad: option.fatigueLoad,
      recoveryDeltaPct: option.recoveryDeltaPct,
    };
  });
}

export type TrainingClassSuggestion = {
  className: ProgressionClassName;
  label: string;
  attributes: string[];
};

/**
 * D3 — Klassen-Vorschlag aus den zwei Signature-Attributen (die ein Spieler am
 * besten trainiert). Nutzt die ECHTE Klassen→Attribut-Gewichtung aus
 * `CLASS_PROGRESSION_WEIGHTS` (class-progression-config.ts) via
 * `getClassTrainingProfile`. Vorgeschlagen wird nur, wenn eine andere Klasse als
 * die aktuelle beide Signature-Attribute deutlich stärker gewichtet — sonst `null`.
 */
export function buildTrainingClassSuggestion(
  row: TrainingPlayerRowView,
  trainingClassOptions: TrainingClassOption[],
): TrainingClassSuggestion | null {
  const signatureEntries = row.attributeForecast
    .filter((entry) => entry.affinity === "signature")
    .sort((left, right) => right.training - left.training);
  if (signatureEntries.length < 2) return null;
  const [first, second] = signatureEntries;
  const keyA = first.attributeKey;
  const keyB = second.attributeKey;

  const combinedWeight = (className: ProgressionClassName) => {
    const profile = getClassTrainingProfile(className, row.adminBalancingConfig);
    const positiveTotal = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, key) => sum + Math.max(0, profile[key]), 0);
    if (positiveTotal <= 0) return { normalized: 0, weightA: profile[keyA], weightB: profile[keyB] };
    return {
      normalized: (Math.max(0, profile[keyA]) + Math.max(0, profile[keyB])) / positiveTotal,
      weightA: profile[keyA],
      weightB: profile[keyB],
    };
  };

  const currentClass = normalizeProgressionClassName(row.trainingClass);
  const currentCombined = currentClass ? combinedWeight(currentClass).normalized : 0;

  let best: { className: ProgressionClassName; normalized: number; weightA: number; weightB: number } | null = null;
  for (const className of PROGRESSION_CLASS_ORDER) {
    const scored = combinedWeight(className);
    if (best == null || scored.normalized > best.normalized) {
      best = { className, ...scored };
    }
  }
  if (best == null) return null;
  // Nur echte Signale: andere Klasse, beide Signature-Attribute positiv gewichtet,
  // und spürbar besserer Fit als die aktuelle Klasse.
  if (best.className === currentClass) return null;
  if (best.weightA <= 0 || best.weightB <= 0) return null;
  if (best.normalized < currentCombined + 0.05) return null;

  const label = trainingClassOptions.find((option) => option.value === best!.className)?.label ?? best.className;
  return {
    className: best.className,
    label,
    attributes: [first.attribute, second.attribute],
  };
}

export type TrainingClassGainEstimate = {
  className: ProgressionClassName;
  label: string;
  /** Geschätzter Trainings-SP-Zugewinn für diese Klasse (siehe Doku unten) — Schätzung, keine Garantie. */
  estimatedGain: number;
  isCurrent: boolean;
  /** 1-basierte Position in der vollständigen Gain-Rangliste (auch wenn außerhalb der Top-N gezeigt). */
  rank: number;
  /** Development-Route dieser Klasse (POW/SPE/MEN/SOC/BALANCED/RECOVERY), siehe `classNameToDevelopmentRoute`. */
  developmentRoute: PlayerDevelopmentRouteSuggestion;
  /**
   * True wenn diese Klasse den Trainingsfokus-Route-Bonus (×1.08) tatsächlich erhalten hat, d.h. ihre
   * Development-Route-Achse deckt sich mit dem aktuellen Team-Trainingsfokus (`trainingFocusAxis`).
   * Immer false wenn kein Fokus gesetzt ist.
   */
  hasFocusRouteBonus: boolean;
};

/**
 * #53 — Top-N Klassen nach geschätztem Trainings-SP-Zugewinn.
 *
 * Thin UI-Adapter: Die eigentliche Schätzung kommt aus `estimateClassTrainingGains`
 * (lib/training/class-training-gain-estimate.ts), die je Klasse Signature-/Weak-
 * Affinität und den klassen-eigenen Development-Route-Bonus berücksichtigt. Dieser
 * Wrapper übernimmt nur Sortierung, Rang-Nummerierung, Top-N-Truncation und das
 * "aktuelle Klasse immer sichtbar halten"-Fallback für `NlTrainingClassRanking`.
 * (Vorherige, hier veraltete Inline-Formel: siehe Doku-Kommentar in
 * `estimateClassTrainingGains` für den Bug, den sie hatte.)
 */
export function buildTrainingClassGainRanking(
  row: TrainingPlayerRowView,
  trainingClassOptions: TrainingClassOption[],
  options?: { limit?: number; includeCurrent?: boolean; trainingFocusAxis?: "pow" | "spe" | "men" | "soc" | null },
): TrainingClassGainEstimate[] {
  const limit = options?.limit ?? 3;
  const includeCurrent = options?.includeCurrent ?? false;
  const budget = row.organicForecast.trainingSetpoints;
  if (!(budget > 0)) return [];
  const currentClass = normalizeProgressionClassName(row.trainingClass);
  const ceilingStateByAttribute = Object.fromEntries(
    row.attributeForecast.map((entry) => [entry.attributeKey, entry.ceilingState ?? "open"]),
  );
  const trainingFocusAxis = options?.trainingFocusAxis ?? row.trainingFocusAxis ?? null;

  // `row.player` is the same underlying `Player` record threaded through by
  // `buildOrganicSeasonProgression`/`buildTrainingPlayerRowView` — it is only
  // typed down to the slim `TrainingPlayerRowView["player"]` shape for display
  // purposes. Same cast precedent as `mapAttributeForecast` in
  // lib/foundation/training-player-row-view.ts.
  const gains = estimateClassTrainingGains({
    player: row.player as unknown as Player,
    currentClassName: row.trainingClass,
    trainingSetpoints: budget,
    ceilingStateByAttribute,
    adminBalancingConfig: row.adminBalancingConfig,
    trainingFocusAxis,
  });
  const gainByClassName = new Map(gains.map((entry) => [entry.className, entry]));

  const estimates = PROGRESSION_CLASS_ORDER.map((className) => {
    const label = trainingClassOptions.find((option) => option.value === className)?.label ?? className;
    const gain = gainByClassName.get(className);
    const developmentRoute = gain?.developmentRoute ?? "BALANCED";
    return {
      className,
      label,
      estimatedGain: gain?.estimatedGain ?? 0,
      isCurrent: className === currentClass,
      developmentRoute,
      hasFocusRouteBonus: getDevelopmentRouteBonusMultiplier(developmentRoute, trainingFocusAxis) > 1,
    };
  });

  const sorted = estimates
    .sort((left, right) => right.estimatedGain - left.estimatedGain)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const top = sorted.slice(0, Math.max(0, limit));
  // Aktuelle Klasse immer zum Vergleich sichtbar halten, auch wenn außerhalb der Top-N.
  if (includeCurrent && !top.some((entry) => entry.isCurrent)) {
    const current = sorted.find((entry) => entry.isCurrent);
    if (current) top.push(current);
  }
  return top;
}

export type TrainingBudgetBreakdownStep = {
  key: string;
  operator: "base" | "add" | "subtract" | "result";
  label: string;
  value: string;
  detail?: string;
};

/**
 * Stepped Basis -> Modifikatoren -> Netto chain for the training/performance forecast.
 * Pure presentation layer: reuses fields already computed by `buildOrganicSeasonProgression`
 * (via `TrainingPlayerRowView`), no new balancing math. See docs/training-forecast-breakdown.md.
 */
export function buildTrainingBudgetBreakdown(row: TrainingPlayerRowView): TrainingBudgetBreakdownStep[] {
  const modePresentation = getTrainingModePresentation(row.mode);
  const baseBudget = modePresentation.trainingSetpoints;
  const appliedTraining = row.attributeForecast.reduce((sum, entry) => sum + entry.training, 0);
  const appliedPerformance = row.attributeForecast.reduce((sum, entry) => sum + entry.performance, 0);
  const appliedRegression = row.attributeForecast.reduce((sum, entry) => sum + entry.regression, 0);

  const knownMultiplier =
    (1 + row.modifiers.traitModifierPct / 100) *
    row.modifiers.potentialTrainingMultiplier *
    (1 + row.modifiers.facilityModifierPct / 100);
  const totalMultiplier = baseBudget > 0 ? row.organicForecast.trainingSetpoints / baseBudget : 1;
  const otherBonusPct = knownMultiplier > 0 ? Math.round((totalMultiplier / knownMultiplier - 1) * 1000) / 10 : 0;

  const steps: TrainingBudgetBreakdownStep[] = [
    {
      key: "base",
      operator: "base",
      label: `Basis-Training (${modePresentation.label})`,
      value: `+${formatNlNumber(baseBudget, 2)}`,
      detail: "Fixer Startwert je Trainingsintensität, noch ohne Boni.",
    },
    {
      key: "trait",
      operator: "add",
      label: "Trait-Bonus",
      value: formatSignedPercent(row.modifiers.traitModifierPct),
      detail: "Charaktereigenschaften wie Diligent (+) oder Lazy (-).",
    },
    {
      key: "potential",
      operator: "add",
      label: "Potential-Multiplikator",
      value: `x${formatNlNumber(row.modifiers.potentialTrainingMultiplier, 2)}`,
      detail: "Wie viel Luft zum gescouteten Potential noch nach oben offen ist.",
    },
    {
      key: "facility",
      operator: "add",
      label: "Facility-Bonus",
      value: formatSignedPercent(row.modifiers.facilityModifierPct),
      detail: "Trainingscenter-Level, Zustand und Team-Entwicklungsfokus.",
    },
  ];

  if (Math.abs(otherBonusPct) >= 0.5) {
    steps.push({
      key: "other",
      operator: "add",
      label: "Weitere Boni (Rolle/Fokus)",
      value: formatSignedPercent(otherBonusPct),
      detail: "Rest aus Rollen- und Trainingsfokus-Bonus, nicht einzeln aufgeschlüsselt.",
    });
  }

  if (row.trainingFocusAxis) {
    const axisLabel = TRAINING_FOCUS_AXIS_LABEL[row.trainingFocusAxis];
    steps.push({
      key: "route-focus",
      operator: "add",
      label: "Trainingsfokus-Route-Bonus",
      value: "+8%",
      detail: `Team-Trainingsfokus aktuell: ${axisLabel}. Klassen auf dieser Achse (siehe "Beste Klassen"-Rangliste oben) erhalten +8% auf ihren geschätzten SP-Zugewinn.`,
    });
  }

  steps.push(
    {
      key: "budget",
      operator: "result",
      label: "= Trainingsbudget",
      value: `+${formatNlNumber(row.organicForecast.trainingSetpoints, 2)}`,
      detail: "Gesamtbudget, das über alle 12 Attribute verteilt wird (Klassenprofil + Affinität).",
    },
    {
      key: "applied-training",
      operator: "add",
      label: "Angewendet auf Stats",
      value: `+${formatNlNumber(appliedTraining, 2)}`,
      detail: "Nach Verteilung auf Klassenprofil, Signature/Weak-Affinität und Attribut-Decke.",
    },
    {
      key: "performance",
      operator: "add",
      label: "+ Performance-Anteil",
      value: `+${formatNlNumber(appliedPerformance, 2)}`,
      detail: `Aus echten Matchday-Ergebnissen (Score, Rang, Beitrag). Zum Vergleich: Saison-PPs ${
        row.playerPps != null ? formatNlNumber(row.playerPps, 1) : "—"
      } · MVS ${row.playerMvs != null ? formatNlNumber(row.playerMvs, 1) : "—"}.`,
    },
    {
      key: "regression",
      operator: "subtract",
      label: "− Regression",
      value: formatNlNumber(appliedRegression, 2),
      detail: "Laufende Basis-Abnutzung plus zusätzlicher Marktwert-Druck bei teuren Spielern.",
    },
    {
      key: "net",
      operator: "result",
      label: "= Netto-Forecast",
      value: formatNlSignedNumber(row.organicForecast.netSetpoints, 2),
      detail: "Summe aller 12 Attribut-Deltas: Training + Performance − Regression.",
    },
  );

  return steps;
}

const BREAKDOWN_OPERATOR_SYMBOL: Record<TrainingBudgetBreakdownStep["operator"], string> = {
  base: "Basis",
  add: "+",
  subtract: "−",
  result: "=",
};

export function TrainingBudgetBreakdownDisclosure({ row }: { row: TrainingPlayerRowView }) {
  const [expanded, setExpanded] = useState(false);
  const steps = useMemo(() => buildTrainingBudgetBreakdown(row), [row]);

  return (
    <div className="training-budget-breakdown-disclosure">
      <div className="training-budget-breakdown-head">
        <button
          className="secondary-button inline-button"
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Berechnung ausblenden" : "Wie kommt das zustande?"}
        </button>
        <small
          className="training-budget-breakdown-forecast-hint"
          title="Diese Werte sind eine laufende Prognose auf Basis des Saisonend-Batch-Modells. Sie werden nicht pro Spieltag verbucht, sondern erst als ein Schritt beim Saisonwechsel final auf den Spieler angewendet."
        >
          Forecast · wird erst am Saisonende final angewendet
        </small>
      </div>
      {expanded ? (
        <div className="training-budget-breakdown" aria-label="Trainings- und Performance-Berechnung Schritt für Schritt">
          {steps.map((step) => (
            <div className={`training-budget-breakdown-step is-${step.operator}`} key={step.key} title={step.detail}>
              <span className="training-budget-breakdown-operator">{BREAKDOWN_OPERATOR_SYMBOL[step.operator]}</span>
              <span className="training-budget-breakdown-label">{step.label}</span>
              <strong className="training-budget-breakdown-value">{step.value}</strong>
              {step.detail ? <small className="training-budget-breakdown-detail">{step.detail}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getPortraitModel(player: TrainingPlayerRowView["player"]) {
  const src = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath);
  const initials =
    player.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { src, initials };
}

function getDevelopmentBadgeLabel(tone: ReturnType<typeof getDevelopmentTone>) {
  if (tone === "growth") return "steigt";
  if (tone === "regression") return "kann fallen";
  return "stabil";
}

function getDemandStatusLabel(status: PlayerDemandStatus) {
  switch (status) {
    case "fulfilled":
      return "erfüllt";
    case "at_risk":
      return "unter Druck";
    case "failed":
      return "ignoriert";
    default:
      return "offen";
  }
}

function getTrainingStartStateLabel(row: TrainingPlayerRowView) {
  if ((row.playerPps ?? 0) <= 0 && (row.playerMvs ?? 0) <= 0) {
    return "Startzustand · erste Saisonwerte bauen sich noch auf";
  }
  return null;
}

function TrainingTraitBoostRow({ row }: { row: TrainingPlayerRowView }) {
  if (row.traitBoosts.length === 0 && row.modifiers.traitModifierPct === 0) {
    return null;
  }

  return (
    <div className="training-v2-trait-boost-row" aria-label="Trait Training Boosts">
      <div className="training-v2-trait-boost-summary">
        <span>Trait Boost</span>
        <strong className={row.modifiers.traitModifierPct >= 0 ? "text-positive" : "text-negative"}>
          {formatSignedPercent(row.modifiers.traitModifierPct)}
        </strong>
      </div>
      <div className="training-v2-trait-boost-chips">
        {row.traitBoosts.slice(0, 4).map((entry) => (
          <span
            key={`${row.player.id}-${entry.trait}`}
            className={`training-v2-trait-chip is-${entry.tone}`}
            title={`${entry.trait}: ${entry.pct >= 0 ? "+" : ""}${formatNlNumber(entry.pct, 1)}% Legacy Training Signal`}
          >
            {entry.tone === "positive" ? "★" : entry.tone === "negative" ? "▼" : "•"} {entry.trait} {entry.pct >= 0 ? "+" : ""}
            {formatNlNumber(entry.pct, 1)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function TrainingModeDemandBanner({ row }: { row: TrainingPlayerRowView }) {
  const demand = row.trainingDemand;
  if (!demand || demand.status === "fulfilled") {
    return null;
  }

  const preferred = getTrainingModePresentation(demand.preferredMode);
  return (
    <div className={`training-v2-mode-demand is-${demand.status}`} aria-label="Trainingswunsch">
      <div className="training-v2-mode-demand-copy">
        <strong>{demand.label}</strong>
        <span>
          {getDemandStatusLabel(demand.status)} · will {preferred.label} · Moral {demand.moraleReward >= 0 ? "+" : ""}
          {demand.moraleReward}/{demand.moralePenalty}
        </span>
      </div>
      <small>{demand.detail}</small>
    </div>
  );
}

/**
 * Small always-visible pill row below the portrait card — KI-Empfehlung,
 * Trait-Boost und Trainingswunsch als kompakte Chips mit Tooltip statt
 * grosser Banner-Boxen. Voller Text bleibt in TrainingCardDetails/Drawer.
 */
function TrainingCardCompactBadges({ row }: { row: TrainingPlayerRowView }) {
  const recommendedMode = row.recommendedTrainingMode ?? null;
  const recommendedPresentation = recommendedMode ? getTrainingModePresentation(recommendedMode) : null;
  const showRecommendation =
    recommendedMode != null && recommendedMode !== row.mode && row.recommendedTrainingMatchesCurrent === false;
  const demand = row.trainingDemand;
  const hasDemand = demand != null && demand.status !== "fulfilled";
  const hasTraitBoost = row.traitBoosts.length > 0 || row.modifiers.traitModifierPct !== 0;

  if (!showRecommendation && !hasDemand && !hasTraitBoost) {
    return null;
  }

  return (
    <div className="training-v2-card-compact-badges" aria-label="Trainings-Hinweise">
      {showRecommendation && recommendedPresentation ? (
        <span
          className="training-v2-card-badge is-recommendation"
          data-testid="training-ai-recommendation"
          title={`Empfohlen: ${recommendedPresentation.label}${row.recommendedTrainingDetail ? ` — ${row.recommendedTrainingDetail}` : ""}`}
        >
          💡 {recommendedPresentation.label}
        </span>
      ) : null}
      {hasTraitBoost ? (
        <span
          className={`training-v2-card-badge is-trait${row.modifiers.traitModifierPct >= 0 ? " is-positive" : " is-negative"}`}
          title={
            row.traitBoosts
              .map((entry) => `${entry.trait} ${entry.pct >= 0 ? "+" : ""}${formatNlNumber(entry.pct, 1)}%`)
              .join(" · ") || "Trait Training Boost"
          }
        >
          ★ {formatSignedPercent(row.modifiers.traitModifierPct)}
        </span>
      ) : null}
      {hasDemand && demand ? (
        <span
          className={`training-v2-card-badge is-demand is-${demand.status}`}
          title={`${demand.label} · ${getDemandStatusLabel(demand.status)} · Moral ${demand.moraleReward >= 0 ? "+" : ""}${demand.moraleReward}/${demand.moralePenalty} — ${demand.detail}`}
        >
          ⚑ will {getTrainingModePresentation(demand.preferredMode).label}
        </span>
      ) : null}
    </div>
  );
}

// XP-System abgeschafft: TrainingAttributeUpgradeStrip (dekorativer „+1 · ~40 SP"-Streifen)
// entfernt — er suggerierte manuelle XP-/SP-Attribut-Upgrades, die es nicht mehr gibt.

function TrainingWhyDisclosure({ row }: { row: TrainingPlayerRowView }) {
  const reasons = [
    row.organicForecast.netSetpoints >= 0 ? "Training/Performance überwiegen" : "Regression oder Fatigue drücken",
    row.forecast.regressionRisk !== "low" ? `Rückschritt-Risiko: ${row.forecast.regressionRisk}` : "Regression aktuell ruhig",
    row.modifiers.signatureAttributes.length > 0 ? `★ Signature: ${row.modifiers.signatureAttributes.join(", ")}` : null,
  ].filter(Boolean);
  return (
    <details className="training-v2-why-disclosure">
      <summary>Warum?</summary>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Full analysis for a single player card — same blocks as before the
 * compaction (trait boosts, demand banner, forecast row, PPs/MVS, impact
 * strip, budget breakdown, focus tags, attribute grid, modifier footer),
 * just collapsed behind a toggle instead of always rendered. Identical
 * content/order to `PlayerTrainingControls` in the player drawer.
 */
function TrainingCardDetails({ row }: { row: TrainingPlayerRowView }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="training-v2-card-details-wrapper">
      <button
        type="button"
        className="secondary-button inline-button training-v2-card-details-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        {expanded ? "Analyse ausblenden" : "Analyse anzeigen"}
      </button>
      {expanded ? (
        <div className="training-v2-card-details">
          <TrainingTraitBoostRow row={row} />
          <TrainingModeDemandBanner row={row} />

          <div className="training-v2-rider-forecast-row">
            <div>
              <span>Stat Forecast</span>
              <strong className={row.organicForecast.netSetpoints >= 0 ? "text-positive" : "text-negative"}>
                {row.organicForecast.netSetpoints > 0 ? "+" : ""}
                {formatNlNumber(row.organicForecast.netSetpoints, 1)}
              </strong>
            </div>
            <div>
              <span>Training</span>
              <strong>+{formatNlNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
            </div>
            <div title="Angewendeter Performance-Anteil aus echten Matchday-Ergebnissen. Sanfter Taper erst nahe Attribut-Decke — nicht wie Training.">
              <span>Performance</span>
              <strong>+{formatNlNumber(row.organicForecast.performanceSetpoints, 1)}</strong>
            </div>
            <div>
              <span>Fatigue</span>
              <strong>+{formatNlNumber(row.organicForecast.fatigueLoad, 1)}</strong>
            </div>
          </div>

          {row.trainingAccumulatorForecast ? (
            <p
              className="muted training-v2-accumulator-forecast"
              title="Anti-Cheese: Das Saison-End-Trainingsbudget akkumuliert pro Spieltag aus dem jeweils aktiven Modus. Bisher = bereits gesammelt; Rest projiziert die verbleibenden Spieltage im aktuell gewaehlten Modus."
            >
              Bisher {formatNlNumber(row.trainingAccumulatorForecast.accumulatedBudget, 2)} SP (
              {row.trainingAccumulatorForecast.matchdaysCounted} Spieltage) · Rest bei{" "}
              {getTrainingModePresentation(row.mode).label} →{" "}
              {formatNlNumber(row.trainingAccumulatorForecast.forecastBudget, 2)} SP
            </p>
          ) : null}

          <p className="muted training-v2-fatigue-current" title="Aktuelle Ermüdung inkl. pro Spieltag akkumulierter Trainings-Fatigue.">
            Aktuell {formatNlNumber(row.player.fatigue, 0)}/100 Fatigue
          </p>

          <p
            className="muted training-v2-reality-note"
            title="Der Performance-Anteil wird separat aus den einzelnen Matchday-Ergebnissen berechnet und spiegelt dieselbe Spielpraxis wie PPs/MVS, nur auf die Stat-Skala übersetzt."
          >
            Saison-PPs {row.playerPps != null ? formatNlNumber(row.playerPps, 1) : "—"} · MVS{" "}
            {row.playerMvs != null ? formatNlNumber(row.playerMvs, 1) : "—"}
          </p>

          <VeloImpactStrip
            flashKey={row.mode}
            items={buildTrainingImpactItems({
              trainingSetpoints: row.organicForecast.trainingSetpoints,
              performanceSetpoints: row.organicForecast.performanceSetpoints,
              netSetpoints: row.organicForecast.netSetpoints,
              recoveryBefore: row.recoveryForecast.before,
              recoveryAfter: row.recoveryForecast.after,
              recoveryDeltaPct: row.recoveryForecast.modifierPct,
              regressionRisk: row.forecast.regressionRisk,
            })}
          />

          <TrainingBudgetBreakdownDisclosure row={row} />
          <TrainingWhyDisclosure row={row} />

          <VeloAttributeFocusTags primary={row.classTrainingFocus.primary} risks={row.classTrainingFocus.risks} />

          <TrainingAttributeForecastGrid row={row} />

          <div className="training-v2-player-foot training-v2-modifier-row">
            <small>
              Traits {formatSignedPercent(row.modifiers.traitModifierPct)} · Facility{" "}
              {formatSignedPercent(row.modifiers.facilityModifierPct)} · Potential x
              {formatNlNumber(row.modifiers.potentialTrainingMultiplier, 2)}
            </small>
            {row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? (
              <small className={`training-v2-mode-demand-foot is-${row.trainingDemand.status}`}>
                Wunsch {getTrainingModePresentation(row.trainingDemand.preferredMode).label} · aktuell{" "}
                {getTrainingModePresentation(row.mode).label}
              </small>
            ) : null}
            <small>
              {row.modifiers.signatureAttributes.length > 0 ? `★ ${row.modifiers.signatureAttributes.join(" / ")}` : "★ —"}
              {row.modifiers.weakAttribute ? ` · ◆ Weak ${row.modifiers.weakAttribute}` : ""}
            </small>
            <small>{row.modeConfig.note}</small>
            <small>
              Risiko {row.forecast.fatigueStrain.label} · {row.fatigueWarning}
            </small>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TrainingAttributeForecastGrid({ row }: { row: TrainingPlayerRowView }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(
    () =>
      sortTrainingAttributeForecastByClassProfile(
        row.attributeForecast,
        row.trainingClass,
        row.adminBalancingConfig,
      ),
    [row.adminBalancingConfig, row.attributeForecast, row.trainingClass],
  );
  const visible = expanded ? sorted : sorted.slice(0, 5);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="training-v2-attribute-forecast">
      <div className="training-v2-attribute-forecast-head">
        <TooltipHeading
          as="strong"
          tooltip="Trainingsplan zeigt die laufende Saison-Prognose aus Training, Performance und Regression. Das Entwicklungsziel darunter bleibt die Saisonende-Sicht auf Attribute und Klassen."
        >
          Trainingsplan (laufende Saison)
        </TooltipHeading>
        {sorted.length > 5 ? (
          <button className="secondary-button inline-button" type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Weniger" : `Alle ${sorted.length} Stats`}
          </button>
        ) : null}
      </div>
      <div className="training-v2-attribute-forecast-grid">
        {visible.map((entry) => (
          <article
            className={`training-v2-attribute-forecast-card${entry.delta < 0 ? " is-risk" : entry.delta > 0 ? " is-gain" : ""}${entry.affinity === "signature" ? " is-signature" : entry.affinity === "weak" ? " is-weak" : ""}${entry.ceilingState === "capped" ? " is-ceiling-capped" : entry.ceilingState === "closing" ? " is-ceiling-closing" : ""}`}
            key={`${row.player.id}-${entry.attributeKey}`}
          >
            <div className="training-v2-attribute-forecast-title">
              <small>{entry.attribute}</small>
              {entry.affinity === "signature" ? <span className="training-v2-affinity-mark is-signature">★</span> : null}
              {entry.affinity === "weak" ? <span className="training-v2-affinity-mark is-weak">◆</span> : null}
              {entry.ceilingState === "capped" ? (
                <span
                  className="training-v2-ceiling-mark is-capped"
                  title="Potential erreicht — kaum noch Trainingswachstum möglich"
                >
                  Limit
                </span>
              ) : entry.ceilingState === "closing" ? (
                <span
                  className="training-v2-ceiling-mark is-closing"
                  title={`Potential fast erreicht — ${entry.headroomLabel ?? "eng"}`}
                >
                  {entry.headroomLabel ?? "eng"}
                </span>
              ) : null}
            </div>
            <strong>
              {formatNlNumber(entry.before, 1)} → {formatNlNumber(entry.after, 1)}
            </strong>
            <em>{formatNlSignedNumber(entry.delta, 1)}</em>
            <div className="training-v2-attribute-forecast-split">
              <span>T {formatNlSignedNumber(entry.training, 1)}</span>
              <span>P {formatNlSignedNumber(entry.performance, 1)}</span>
              <span>R {formatNlSignedNumber(entry.regression, 1)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

type TrainingModeGuideProps = {
  trainingModeOptions: TrainingModeOption[];
};

export function TrainingModeGuide({ trainingModeOptions }: TrainingModeGuideProps) {
  return (
    <div className="training-v2-mode-guide velo-mode-guide" aria-label="Trainingslast Erklärung">
      {trainingModeOptions.map((option) => (
        <article
          className={`training-v2-mode-guide-card velo-mode-guide-card is-${option.fatigueRisk === "niedrig" ? "growth" : option.fatigueRisk === "hoch" ? "regression" : "stable"}`}
          key={`mode-guide-${option.value}`}
          title={`Trainingsbudget vor Trait-, Potential- und Facility-Boni. Separat fliessen +${formatNlNumber(option.baseXp, 0)} Entwicklungs-XP automatisch in Formkurve und Regressionsschutz ein — kein manuelles Ausgeben.`}
        >
          <span>{option.label}</span>
          <strong>+{formatNlNumber(option.trainingSetpoints, 1)} Trainingsbudget · Fatigue {formatNlNumber(option.fatigueLoad, 0)}</strong>
          <small>
            {option.recoveryDeltaPct > 0 ? `+${option.recoveryDeltaPct}% Reg` : option.recoveryDeltaPct < 0 ? `${option.recoveryDeltaPct}% Reg` : "±0 Reg"} · {option.note}
          </small>
        </article>
      ))}
    </div>
  );
}

/**
 * Wraps `TrainingModeGuide` behind a collapsed-by-default toggle so the
 * always-open Leicht/Mittel/Hart explainer cards don't push the roster
 * below the fold. Same disclosure pattern as `TrainingBudgetBreakdownDisclosure`.
 */
export function TrainingModeGuideDisclosure({ trainingModeOptions }: TrainingModeGuideProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="training-v2-mode-guide-disclosure">
      <button
        type="button"
        className="secondary-button inline-button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        {expanded ? "Trainings-Erklärung ausblenden" : "Wie funktioniert Training?"}
      </button>
      {expanded ? <TrainingModeGuide trainingModeOptions={trainingModeOptions} /> : null}
    </div>
  );
}

type TrainingPlayerLaneProps = {
  playerRows: TrainingPlayerRowView[];
  allPlayerCount: number;
  developmentFilter: TrainingDevelopmentFilter;
  developmentSummary: Record<TrainingDevelopmentFilter, number>;
  onSetDevelopmentFilter: (filter: TrainingDevelopmentFilter) => void;
  trainingModeOptions: TrainingModeOption[];
  trainingClassOptions: TrainingClassOption[];
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  trainingModeReadOnly?: boolean;
  showIntensityRail?: boolean;
  onActivePlayerChange?: (playerId: string) => void;
  activeComparePlayerId?: string | null;
};

export function TrainingPlayerLane({
  playerRows,
  allPlayerCount,
  developmentFilter,
  developmentSummary,
  onSetDevelopmentFilter,
  trainingModeOptions,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
  trainingModeReadOnly = false,
  showIntensityRail = true,
  onActivePlayerChange,
  activeComparePlayerId = null,
}: TrainingPlayerLaneProps) {
  const modeSegments = buildTrainingModeSegments(
    trainingModeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      trainingSetpoints: option.trainingSetpoints,
      baseXp: option.baseXp,
      recoveryDeltaPct: option.recoveryDeltaPct,
      fatigueLoad: option.fatigueLoad,
      note: option.note,
    })),
  );

  const teamModeCounts = useMemo(
    () =>
      playerRows.reduce(
        (counts, row) => {
          counts[row.mode] += 1;
          return counts;
        },
        { leicht: 0, mittel: 0, hart: 0 },
      ),
    [playerRows],
  );

  return (
    <>
      <div className="training-v2-section-head">
        <div>
          <TooltipHeading as="h3" tooltip="Modus und Klasse pro Spieler. Filter nach Entwicklung und Risiko.">
            Kader
          </TooltipHeading>
        </div>
        <span className="pill">
          {playerRows.length}/{allPlayerCount}
        </span>
      </div>

      <div className="training-v2-team-mode-strip" aria-label="Team-Trainingsmodus">
        <span>Team-Modus</span>
        <strong>
          Leicht {teamModeCounts.leicht} · Mittel {teamModeCounts.mittel} · Hart {teamModeCounts.hart}
        </strong>
      </div>

      <div className="training-v2-filter-row">
        {([
          { id: "growth" as const, label: "Upgrade bereit" },
          { id: "regression" as const, label: "Risiko" },
          { id: "stable" as const, label: "Stabil" },
          { id: "all" as const, label: "Alle" },
        ]).map((filter) => (
          <FoundationCard
            key={filter.id}
            as="div"
            variant="metric"
            className={`training-v2-filter-card${developmentFilter === filter.id ? " is-active" : ""}`}
          >
            <span>{filter.label}</span>
            <strong>{developmentSummary[filter.id]}</strong>
            <FoundationButton variant="secondary" className="inline-button" onClick={() => onSetDevelopmentFilter(filter.id)}>
              {developmentFilter === filter.id ? "Aktiv" : "Filtern"}
            </FoundationButton>
          </FoundationCard>
        ))}
      </div>

      <div className="training-v2-player-list training-v2-rider-grid team-portraits-grid">
        {playerRows.map((row) => {
          const portrait = getPortraitModel(row.player);
          const tone = getDevelopmentTone(row);
          const isHighRisk = row.forecast.regressionRisk === "high";
          const modePresentation = getTrainingModePresentation(row.mode);
          return (
            <article className={`training-v2-rider-card velo-rider-card is-${tone}${isHighRisk ? " is-high-risk" : ""}${activeComparePlayerId === row.player.id ? " is-compare-active" : ""}`} id={`training-player-${row.player.id}`} key={row.entryId}>
              <FoundationPlayerPortraitCard
                playerId={row.player.id}
                name={row.player.name}
                portraitUrl={portrait.src}
                portraitInitials={portrait.initials}
                playerOvr={row.developmentStars.currentAbilityRating}
                playerMvs={row.playerMvs}
                playerPps={row.playerPps}
                pow={row.player.coreStats.pow}
                spe={row.player.coreStats.spe}
                men={row.player.coreStats.men}
                soc={row.player.coreStats.soc}
                leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
                variant="team"
                context="training"
                density="full"
                interactive={false}
                highlight={getDevelopmentBadgeLabel(tone)}
                subMeta={
                  row.organicForecast.classBefore === row.organicForecast.classAfter
                    ? row.player.className
                    : `${row.organicForecast.classBefore} → ${row.organicForecast.classAfter}`
                }
                contextData={{
                  training: {
                    caRating: row.developmentStars.currentAbilityRating,
                    poDisplay: row.developmentStars.potentialStars ?? formatNlNumber(row.developmentStars.potentialRating, 0),
                    netSetpoints: row.organicForecast.netSetpoints,
                    regressionRisk: row.forecast.regressionRisk,
                    trainingModeLabel: modePresentation.label,
                    traitModifierPct: row.modifiers.traitModifierPct,
                  },
                }}
                title={`${row.player.name} Profil öffnen`}
                testId="training-player-portrait-card"
                onOpen={() => onActivePlayerChange?.(row.player.id)}
                footerSlot={
                  <>
                    {getTrainingStartStateLabel(row) ? (
                      <small className="muted training-v2-start-state">{getTrainingStartStateLabel(row)}</small>
                    ) : null}
                    {onOpenPlayerDetails ? (
                      <button
                        type="button"
                        className="table-link-button training-v2-open-profile training-v2-rider-portrait-button"
                        onClick={() => onOpenPlayerDetails({ playerId: row.player.id, activePlayerId: row.entryId })}
                      >
                        Profil öffnen
                      </button>
                    ) : null}
                    {showIntensityRail ? (
                      <VeloIntensityRail
                        ariaLabel={`${row.player.name} Trainingsmodus`}
                        segments={modeSegments}
                        activeValue={row.mode}
                        demandValue={
                          row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? row.trainingDemand.preferredMode : null
                        }
                        disabled={trainingModeReadOnly}
                        onSelect={(value) => onSetTrainingMode(row.player.id, value as PlayerTrainingMode)}
                      />
                    ) : null}
                    <div className="training-v2-plan-controls">
                      <label className="filter-field training-v2-class-select">
                        <span>Trainingsklasse</span>
                        <select
                          className="input"
                          value={row.trainingClass}
                          disabled={trainingModeReadOnly}
                          onChange={(event) => onSetTrainingClass(row.player.id, event.target.value)}
                        >
                          {trainingClassOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </>
                }
              />

              <TrainingCardCompactBadges row={row} />
              {tone === "regression" ? (
                <FoundationCard variant="decision" className="training-v2-regression-callout">
                  <span className="eyebrow">Rückschritt sichtbar</span>
                  <strong>
                    {row.organicForecast.netSetpoints < 0
                      ? `Forecast ${formatNlSignedNumber(row.organicForecast.netSetpoints, 1)}`
                      : `Risiko ${row.forecast.regressionRisk}`}
                  </strong>
                  <p className="muted">
                    {row.fatigueWarning} · Marktwert-Druck {formatNlNumber(row.forecast.regressionPressure, 0)}
                  </p>
                </FoundationCard>
              ) : null}
              <TrainingCardDetails row={row} />
            </article>
          );
        })}
        {playerRows.length === 0 ? (
          <EmptyState title="Keine Spieler im aktuellen Filter" text="Wechsle den Entwicklungsfokus oder wähle ein anderes Team." />
        ) : null}
      </div>
    </>
  );
}
