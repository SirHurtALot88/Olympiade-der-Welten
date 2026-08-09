"use client";

import {
  buildTrainingImpactItems,
  buildTrainingModeSegments,
  VeloImpactStrip,
  VeloIntensityRail,
} from "@/components/foundation/velo-ui";
import { formatNlNumber, formatNlSignedNumber } from "@/components/foundation/new-look/nl-tones";
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

/**
 * Wie viel der ZUWÄCHSE stammt aus echten Spieltags-Leistungen statt aus dem Trainingsplan?
 *
 * GEWÜNSCHT VON CHRIS: „ich will nur dass im tooltipp im spielerprofil bei training sichtbar ist
 * wie viel performance anteil in seinen verbesserungen steckt."
 *
 * Bezugsgröße sind bewusst nur die ZUWÄCHSE (Training + Performance), NICHT das Netto. Das Netto
 * enthält die Regression, und ein Spieler mit starkem Alterungsdruck kann netto fallen, obwohl
 * Performance kräftig beigetragen hat — ein Anteil an einer negativen Summe wäre schlicht
 * unlesbar. „Von dem, was dazukam, stammt X % aus Leistung" ist die Frage, die sich stellt.
 */
function buildPerformanceShare(row: TrainingPlayerRowView) {
  const training = row.attributeForecast.reduce((sum, entry) => sum + Math.max(0, entry.training), 0);
  const performance = row.attributeForecast.reduce((sum, entry) => sum + Math.max(0, entry.performance), 0);
  const zuwachs = training + performance;
  return {
    training,
    performance,
    // Ohne Zuwachs gibt es keinen Anteil — dann `null` statt einer erfundenen 0 %.
    sharePct: zuwachs > 0.05 ? (performance / zuwachs) * 100 : null,
  };
}

function buildStatForecastTooltip(row: TrainingPlayerRowView) {
  const appliedTraining = row.attributeForecast.reduce((sum, entry) => sum + entry.training, 0);
  const appliedPerformance = row.attributeForecast.reduce((sum, entry) => sum + entry.performance, 0);
  const appliedRegression = row.attributeForecast.reduce((sum, entry) => sum + entry.regression, 0);
  const anteil = buildPerformanceShare(row);
  return [
    "Netto = Summe aller Attribut-Deltas nach Regression, Training und Performance.",
    `Angewendet: Training ${formatNlSignedNumber(appliedTraining, 1)} · Performance ${formatNlSignedNumber(appliedPerformance, 1)} · Regression ${formatNlSignedNumber(appliedRegression, 1)}`,
    anteil.sharePct != null
      ? `Davon aus echten Spieltags-Leistungen: ${formatNlNumber(anteil.sharePct, 0)} % der Zuwächse (Regression nicht eingerechnet).`
      : "Noch keine Zuwächse — der Performance-Anteil lässt sich erst beziffern, wenn etwas dazukommt.",
    `Trainingsbudget +${formatNlNumber(row.organicForecast.trainingSetpoints, 1)} vor Affinitäts- und Potential-Multiplikatoren. Schritt-für-Schritt unten unter "Wie kommt das zustande?".`,
  ].join("\n");
}

function buildMatchdayRealityNote(row: TrainingPlayerRowView) {
  const pps = row.playerPps != null ? formatNlNumber(row.playerPps, 1) : "—";
  const mvs = row.playerMvs != null ? formatNlNumber(row.playerMvs, 1) : "—";
  return `Saison-PPs ${pps} (echter Punktebeitrag) · MVS ${mvs} (Market Value Score). Der Performance-Anteil oben wird separat aus den einzelnen Matchday-Ergebnissen berechnet, zeigt also dieselbe Spielpraxis wie PPs/MVS, nur auf die Stat-Skala übersetzt.`;
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
  const performanceShare = buildPerformanceShare(row);
  // T-009: Es gibt keinen Season-Phasen-Lock mehr für die Trainingsintensität
  // (siehe lib/foundation/game-phase-action-policy.ts,
  // isTrainingIntensityLockedForSeason() liefert dauerhaft `false`). Training
  // bleibt für das eigene Team immer einstellbar — einzige verbleibende
  // Sperre ist `readOnly` (fremdes/nicht steuerbares Team).
  const intensityRailDisabled = readOnly;
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
            {formatNlNumber(row.organicForecast.netSetpoints, 1)}
          </strong>
        </div>
        {/* Der Performance-Anteil steht bewusst HIER, am Training-Feld: die Frage „wie viel davon
            habe ich mir auf dem Platz verdient und wie viel kommt aus dem Trainingsplan?" stellt
            sich genau beim Training. Am Performance-Feld selbst waere sie tautologisch. */}
        <div
          title={
            `Trainingsbudget vor Verteilung auf 12 Attribute (Traits, Facility, Potential eingerechnet).\n` +
            (performanceShare.sharePct != null
              ? `Von den tatsaechlichen Zuwaechsen stammen ${formatNlNumber(performanceShare.sharePct, 0)} % aus echten Spieltags-Leistungen ` +
                `(+${formatNlNumber(performanceShare.performance, 1)}) und ${formatNlNumber(100 - performanceShare.sharePct, 0)} % aus dem Training ` +
                `(+${formatNlNumber(performanceShare.training, 1)}). Regression ist dabei nicht eingerechnet.\n`
              : `Noch keine Zuwaechse — der Performance-Anteil laesst sich erst beziffern, wenn etwas dazukommt.\n`) +
            `Details unter 'Wie kommt das zustande?'.`
          }
        >
          <span>Training</span>
          <strong>+{formatNlNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
          {performanceShare.sharePct != null ? (
            <small className="muted nl-tnum">{formatNlNumber(performanceShare.sharePct, 0)} % aus Leistung</small>
          ) : null}
        </div>
        <div title="Angewendeter Performance-Anteil aus echten Matchday-Ergebnissen. Sanfter Taper erst nahe Attribut-Decke — nicht wie Training. Vergleich zu Saison-PPs/MVS unten.">
          <span>Performance</span>
          <strong>+{formatNlNumber(appliedPerformanceSetpoints, 1)}</strong>
        </div>
        <div>
          <span>Fatigue</span>
          <strong>+{formatNlNumber(row.organicForecast.fatigueLoad, 1)}</strong>
        </div>
      </div>

      <p className="muted player-training-controls-reality-note" title={buildMatchdayRealityNote(row)}>
        Trainingsfleiss vs. echte Spielpraxis: Saison-PPs {row.playerPps != null ? formatNlNumber(row.playerPps, 1) : "—"} · MVS{" "}
        {row.playerMvs != null ? formatNlNumber(row.playerMvs, 1) : "—"}
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
          {formatNlNumber(row.modifiers.potentialTrainingMultiplier, 2)}
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
