"use client";

import {
  buildTrainingImpactItems,
  buildTrainingModeSegments,
  formatVeloNumber,
  formatVeloSignedNumber,
  VeloImpactStrip,
  VeloIntensityRail,
} from "@/components/foundation/velo-ui";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import type { PlayerDemandStatus } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import {
  formatSignedPercent,
  getDevelopmentTone,
  TrainingAttributeForecastGrid,
  TrainingBudgetBreakdownDisclosure,
} from "@/app/foundation/training-facilities-v2/training-view-shared";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type {
  TrainingClassOption,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";

type PlayerTrainingControlsProps = {
  row: TrainingPlayerRowView;
  trainingModeOptions: TrainingModeOption[];
  trainingClassOptions: TrainingClassOption[];
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  readOnly?: boolean;
};

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

function buildStatForecastTooltip(row: TrainingPlayerRowView) {
  const appliedTraining = row.attributeForecast.reduce((sum, entry) => sum + entry.training, 0);
  const appliedPerformance = row.attributeForecast.reduce((sum, entry) => sum + entry.performance, 0);
  const appliedRegression = row.attributeForecast.reduce((sum, entry) => sum + entry.regression, 0);
  return [
    "Netto = Summe aller Attribut-Deltas nach Regression, Training und Performance.",
    `Angewendet: Training ${formatVeloSignedNumber(appliedTraining, 1)} · Performance ${formatVeloSignedNumber(appliedPerformance, 1)} · Regression ${formatVeloSignedNumber(appliedRegression, 1)}`,
    `Trainingsbudget +${formatVeloNumber(row.organicForecast.trainingSetpoints, 1)} vor Affinitäts- und Potential-Multiplikatoren. Schritt-für-Schritt unten unter "Wie kommt das zustande?".`,
  ].join("\n");
}

function buildMatchdayRealityNote(row: TrainingPlayerRowView) {
  const pps = row.playerPps != null ? formatVeloNumber(row.playerPps, 1) : "—";
  const mvs = row.playerMvs != null ? formatVeloNumber(row.playerMvs, 1) : "—";
  return `Saison-PPs ${pps} (echter Punktebeitrag) · MVS ${mvs} (Matchday Value Score). Der Performance-Anteil oben wird separat aus den einzelnen Matchday-Ergebnissen berechnet, zeigt also dieselbe Spielpraxis wie PPs/MVS, nur auf die Stat-Skala übersetzt.`;
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

export default function PlayerTrainingControls({
  row,
  trainingModeOptions,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  readOnly = false,
}: PlayerTrainingControlsProps) {
  const tone = getDevelopmentTone(row);
  const appliedPerformanceSetpoints = row.organicForecast.performanceSetpoints;
  const statForecastTooltip = buildStatForecastTooltip(row);
  const trainingIntensityLocked = Boolean(row.trainingIntensityLocked);
  const intensityRailDisabled = readOnly || trainingIntensityLocked;
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

  return (
    <div className="player-training-controls" data-testid="player-training-controls">
      <div className="player-training-controls-head">
        <span className={`training-v2-badge is-${tone}`}>
          {tone === "growth" ? "steigt" : tone === "regression" ? "kann fallen" : "stabil"}
        </span>
        <p className="muted">
          Klasse {row.organicForecast.classBefore} → {row.organicForecast.classAfter}
        </p>
      </div>

      <TrainingModeDemandBanner row={row} />

      <div className="training-v2-rider-forecast-row player-training-controls-forecast">
        <div title={statForecastTooltip}>
          <TooltipHeading
            as="span"
            tooltip="Trainingsplan zeigt die laufende Saison-Prognose aus Training, Performance und Regression. Das Entwicklungsziel bleibt die Saisonende-Sicht auf Attribute, Klasse und Potential."
          >
            Trainingsplan (laufende Saison)
          </TooltipHeading>
          <strong className={row.organicForecast.netSetpoints >= 0 ? "text-positive" : "text-negative"}>
            {row.organicForecast.netSetpoints > 0 ? "+" : ""}
            {formatVeloNumber(row.organicForecast.netSetpoints, 1)}
          </strong>
        </div>
        <div title="Trainingsbudget vor Verteilung auf 12 Attribute (Traits, Facility, Potential eingerechnet). Details unter 'Wie kommt das zustande?'.">
          <span>Training</span>
          <strong>+{formatVeloNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
        </div>
        <div title="Angewendeter Performance-Anteil aus echten Matchday-Ergebnissen. Sanfter Taper erst nahe Attribut-Decke — nicht wie Training. Vergleich zu Saison-PPs/MVS unten.">
          <span>Performance</span>
          <strong>+{formatVeloNumber(appliedPerformanceSetpoints, 1)}</strong>
        </div>
        <div>
          <span>Fatigue</span>
          <strong>+{formatVeloNumber(row.organicForecast.fatigueLoad, 1)}</strong>
        </div>
      </div>

      <p className="muted player-training-controls-reality-note" title={buildMatchdayRealityNote(row)}>
        Trainingsfleiss vs. echte Spielpraxis: Saison-PPs {row.playerPps != null ? formatVeloNumber(row.playerPps, 1) : "—"} · MVS{" "}
        {row.playerMvs != null ? formatVeloNumber(row.playerMvs, 1) : "—"}
      </p>

      <VeloImpactStrip
        flashKey={row.mode}
        items={buildTrainingImpactItems({
          trainingSetpoints: row.organicForecast.trainingSetpoints,
          performanceSetpoints: appliedPerformanceSetpoints,
          netSetpoints: row.organicForecast.netSetpoints,
          recoveryBefore: row.recoveryForecast.before,
          recoveryAfter: row.recoveryForecast.after,
          recoveryDeltaPct: row.recoveryForecast.modifierPct,
          regressionRisk: row.forecast.regressionRisk,
        })}
      />

      <TrainingBudgetBreakdownDisclosure row={row} />

      {row.trainingIntensityLockWarning && !trainingIntensityLocked && !readOnly ? (
        <p className="muted training-v2-intensity-lock-note" role="status">
          Vorsaisonfenster läuft noch: Trainingsmodus bleibt bis zum ersten Result offen und sperrt danach für den Rest der Saison.
          Trainingsklasse bleibt weiter anpassbar.
        </p>
      ) : null}

      {trainingIntensityLocked && !readOnly ? (
        <p className="muted training-v2-intensity-lock-note" role="status">
          Trainingsmodus für diese Season festgelegt — Änderung erst zum nächsten Saisonstart möglich. Trainingsklasse bleibt weiter anpassbar.
        </p>
      ) : null}

      <VeloIntensityRail
        ariaLabel={`${row.player.name} Trainingsmodus`}
        segments={modeSegments}
        activeValue={row.mode}
        demandValue={row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? row.trainingDemand.preferredMode : null}
        disabled={intensityRailDisabled}
        onSelect={(value) => onSetTrainingMode(row.player.id, value as PlayerTrainingMode)}
      />

      <div className="training-v2-plan-controls">
        <label className="filter-field training-v2-class-select">
          <span>Trainingsklasse</span>
          <select
            className="input"
            value={row.trainingClass}
            disabled={readOnly}
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

      <TrainingAttributeForecastGrid row={row} />

      <div className="training-v2-player-foot training-v2-modifier-row">
        <small>
          Traits {formatSignedPercent(row.modifiers.traitModifierPct)} · Facility {formatSignedPercent(row.modifiers.facilityModifierPct)} · Potential x
          {formatVeloNumber(row.modifiers.potentialTrainingMultiplier, 2)}
        </small>
        {row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? (
          <small className={`training-v2-mode-demand-foot is-${row.trainingDemand.status}`}>
            Wunsch {getTrainingModePresentation(row.trainingDemand.preferredMode).label} · aktuell{" "}
            {getTrainingModePresentation(row.mode).label}
          </small>
        ) : null}
        <small>{row.modeConfig.note}</small>
      </div>
    </div>
  );
}
