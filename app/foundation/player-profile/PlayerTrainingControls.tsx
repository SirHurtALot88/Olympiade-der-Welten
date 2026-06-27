"use client";

import {
  buildTrainingImpactItems,
  buildTrainingModeSegments,
  formatVeloNumber,
  VeloAttributeFocusTags,
  VeloImpactStrip,
  VeloIntensityRail,
} from "@/components/foundation/velo-ui";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import type { PlayerDemandStatus } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import { formatSignedPercent, getDevelopmentTone } from "@/app/foundation/training-facilities-v2/training-view-shared";
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
      return "erfuellt";
    case "at_risk":
      return "unter Druck";
    case "failed":
      return "ignoriert";
    default:
      return "offen";
  }
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
  const modeSegments = buildTrainingModeSegments(
    trainingModeOptions.map((option) => ({
      value: option.value,
      label: option.label,
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
        <div>
          <span>Stat Forecast</span>
          <strong className={row.organicForecast.netSetpoints >= 0 ? "text-positive" : "text-negative"}>
            {row.organicForecast.netSetpoints > 0 ? "+" : ""}
            {formatVeloNumber(row.organicForecast.netSetpoints, 1)}
          </strong>
        </div>
        <div>
          <span>Training</span>
          <strong>+{formatVeloNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
        </div>
        <div title="Matchday-Leistung. Sanfter Taper erst nahe Attribut-Decke — nicht wie Training.">
          <span>Performance</span>
          <strong>+{formatVeloNumber(row.organicForecast.performanceSetpoints, 1)}</strong>
        </div>
        <div>
          <span>Fatigue</span>
          <strong>+{formatVeloNumber(row.organicForecast.fatigueLoad, 1)}</strong>
        </div>
      </div>

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
          legacyXpPreview: row.trainingXp + row.performanceXp,
        })}
      />

      <VeloIntensityRail
        ariaLabel={`${row.player.name} Trainingsmodus`}
        segments={modeSegments}
        activeValue={row.mode}
        demandValue={row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? row.trainingDemand.preferredMode : null}
        disabled={readOnly}
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

      <VeloAttributeFocusTags primary={row.classTrainingFocus.primary} risks={row.classTrainingFocus.risks} />

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
