"use client";

import { useState } from "react";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { FoundationButton } from "@/components/foundation/FoundationButton";
import { FoundationCard } from "@/components/foundation/FoundationCard";
import { EmptyState } from "@/components/foundation/EmptyState";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { Team } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import TrainingModeComparePanel from "@/components/foundation/modern-game/TrainingModeComparePanel";
import type {
  TrainingClassOption,
  TrainingDevelopmentFilter,
  TrainingModeOption,
  TrainingPlayerRowView,
  TrainingSummaryView,
} from "@/app/foundation/training-facilities-v2/training-view-types";
import {
  formatLocaleNumber,
  formatSignedPercent,
  TrainingModeGuideDisclosure,
  TrainingPlayerLane,
} from "@/app/foundation/training-facilities-v2/training-view-shared";

type TrainingCompactClientProps = {
  selectedTeam: Team;
  selectedTeamControlMode?: string | null;
  seasonLabel: string;
  managementLocked?: boolean;
  managementLockedReason?: string | null;
  summary: TrainingSummaryView;
  developmentFilter: TrainingDevelopmentFilter;
  developmentSummary: Record<TrainingDevelopmentFilter, number>;
  onSetDevelopmentFilter: (filter: TrainingDevelopmentFilter) => void;
  trainingModeOptions: TrainingModeOption[];
  trainingClassOptions: TrainingClassOption[];
  playerRows: TrainingPlayerRowView[];
  allPlayerCount: number;
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenFacilities?: () => void;
  onOpenTeams?: () => void;
};

function getTeamLogoModel(team: Pick<Team, "teamId" | "name" | "logoPath">) {
  const src = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null, { variant: "thumb" });
  const initials =
    team.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { src, initials };
}

function formatPps(value: number | null | undefined) {
  return formatLocaleNumber(value, 1);
}

const TRAINING_FORECAST_EXPLANATION =
  "Trainingsplan zeigt die laufende Saison-Prognose aus Training, Performance und Regression. Entwicklungsziel beschreibt die Saisonende-Sicht auf Klasse, Potential und erwartete Richtung.";

export default function TrainingCompactClient({
  selectedTeam,
  selectedTeamControlMode,
  seasonLabel,
  managementLocked = false,
  managementLockedReason = null,
  summary,
  developmentFilter,
  developmentSummary,
  onSetDevelopmentFilter,
  trainingModeOptions,
  trainingClassOptions,
  playerRows,
  allPlayerCount,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
  onOpenFacilities,
  onOpenTeams,
}: TrainingCompactClientProps) {
  const teamLogo = getTeamLogoModel(selectedTeam);
  const trainingModeReadOnly = managementLocked;
  const topGrowth = [...playerRows].sort((left, right) => right.organicForecast.netSetpoints - left.organicForecast.netSetpoints)[0] ?? null;
  const topRisk =
    [...playerRows].sort(
      (left, right) =>
        right.forecast.regressionPressure - left.forecast.regressionPressure ||
        right.organicForecast.netSetpoints - left.organicForecast.netSetpoints,
    )[0] ?? null;
  const [compareActivePlayerId, setCompareActivePlayerId] = useState<string | null>(playerRows[0]?.player.id ?? null);
  const compareActiveMode = playerRows.find((row) => row.player.id === compareActivePlayerId)?.mode ?? null;

  return (
    <section
      className="training-compact-shell training-v2-shell"
      data-testid="foundation-training-compact"
      id="foundation-training-compact"
    >
      <header className="training-compact-hero training-v2-hero" id="training-compact-controls">
        <div className="training-v2-hero-main">
          <div className="training-v2-team">
            {teamLogo.src ? (
              <OptimizedMediaImage
                src={teamLogo.src}
                alt={`${selectedTeam.name} Logo`}
                width={72}
                height={72}
                className="training-v2-team-logo"
              />
            ) : (
              <div className="training-v2-team-logo training-v2-team-logo-fallback">{teamLogo.initials}</div>
            )}
            <div className="training-v2-team-copy">
              <TooltipHeading
                as="h2"
                tooltip="Trainingsmodus und Klasse pro Spieler. Forecast und Risiko in der Liste."
              >
                Training
              </TooltipHeading>
              <p>
                {selectedTeam.shortCode} · {selectedTeamControlMode ?? "manual"} · {seasonLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="training-v2-stat-strip" id="training-compact-forecast">
          <FoundationCard variant="metric" className="training-v2-stat-chip">
            <span>Regeneration</span>
            <strong>
              {formatPps(summary.recoveryBeforeTraining)} → {formatPps(summary.recoveryAfterTraining)}
            </strong>
            <small>
              Leicht {summary.lightModeCount} · Hart {summary.hardModeCount}
            </small>
          </FoundationCard>
          <FoundationCard variant="metric" className="training-v2-stat-chip">
            <span title={TRAINING_FORECAST_EXPLANATION}>Trainingsplan (laufende Saison)</span>
            <strong>{formatLocaleNumber(summary.trainingXpAfter, 1)}</strong>
            <small>Facility {formatSignedPercent(summary.trainingXpModifierPct)}</small>
          </FoundationCard>
          <FoundationCard variant="metric" className="training-v2-stat-chip">
            <span>Performance</span>
            <strong>{formatLocaleNumber(summary.performanceXp, 1)}</strong>
            <small>Netto {formatLocaleNumber(summary.totalXp, 1)} Setpoints</small>
          </FoundationCard>
          <FoundationCard variant="metric" className="training-v2-stat-chip">
            <span title={TRAINING_FORECAST_EXPLANATION}>Entwicklungsziel (Saisonende)</span>
            <strong>{developmentSummary.growth} steigt</strong>
            <small>
              {developmentSummary.stable} stabil · {developmentSummary.regression} Risiko
            </small>
          </FoundationCard>
        </div>

        <TooltipHeading as="p" className="muted" tooltip={TRAINING_FORECAST_EXPLANATION}>
          Trainingsmodus sperrt pro Saison nach dem ersten Result, Trainingsklasse bleibt waehrend der Saison weiter aenderbar.
        </TooltipHeading>

        <p className="muted training-v2-top-risk-line">
          {topGrowth || topRisk ? (
            <>
              Top Steigerer: <strong>{topGrowth?.player.name ?? "—"}</strong>
              {topGrowth ? ` (+${formatLocaleNumber(topGrowth.organicForecast.netSetpoints, 1)})` : ""} · Groesstes Risiko:{" "}
              <strong>{topRisk?.player.name ?? "—"}</strong>
              {topRisk ? ` (Rueckschritt ${formatLocaleNumber(topRisk.forecast.regressionPressure, 0)})` : ""}
            </>
          ) : (
            "Kein aktiver Kader"
          )}
        </p>

        {managementLockedReason ? <p className="muted">{managementLockedReason}</p> : null}
        <div className="training-v2-global-mode-chips" data-testid="training-global-mode-chips" aria-label="Trainingsmodus für alle Spieler">
          {trainingModeOptions.map((option) => (
            <FoundationButton
              key={`global-mode-${option.value}`}
              variant="secondary"
              className="inline-button"
              disabled={trainingModeReadOnly}
              onClick={() => {
                playerRows.forEach((row) => onSetTrainingMode(row.player.id, option.value as PlayerTrainingMode));
              }}
            >
              Alle auf {option.label}
            </FoundationButton>
          ))}
        </div>
        <TrainingModeComparePanel options={trainingModeOptions} activeMode={compareActiveMode} />
        <TrainingModeGuideDisclosure trainingModeOptions={trainingModeOptions} />
      </header>

      <section className="training-compact-workspace training-v2-lane training-v2-lane-training">
        {playerRows.length === 0 ? (
          <EmptyState
            title="Keine Trainingsdaten"
            text="Für dieses Team liegen aktuell keine Spieler oder kein passender Entwicklungsfilter vor."
            actionLabel={onOpenTeams ? "Teams öffnen" : undefined}
            onAction={onOpenTeams}
          />
        ) : (
          <TrainingPlayerLane
            playerRows={playerRows}
            allPlayerCount={allPlayerCount}
            developmentFilter={developmentFilter}
            developmentSummary={developmentSummary}
            onSetDevelopmentFilter={onSetDevelopmentFilter}
            trainingModeOptions={trainingModeOptions}
            trainingClassOptions={trainingClassOptions}
            onSetTrainingMode={onSetTrainingMode}
            onSetTrainingClass={onSetTrainingClass}
            onOpenPlayerDetails={onOpenPlayerDetails}
            trainingModeReadOnly={trainingModeReadOnly}
            onActivePlayerChange={setCompareActivePlayerId}
            activeComparePlayerId={compareActivePlayerId}
          />
        )}
      </section>
    </section>
  );
}
