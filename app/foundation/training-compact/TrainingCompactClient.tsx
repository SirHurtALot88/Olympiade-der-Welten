"use client";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { Team } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import { TrainingModeGuide, TrainingPlayerLane, formatLocaleNumber, formatSignedPercent } from "@/app/foundation/training-facilities-v2/training-view-shared";
import type {
  TrainingClassOption,
  TrainingDevelopmentFilter,
  TrainingModeOption,
  TrainingPlayerRowView,
  TrainingSummaryView,
} from "@/app/foundation/training-facilities-v2/training-view-types";

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
  const src = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null);
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
  const topGrowth = [...playerRows].sort((left, right) => right.forecast.netDevelopmentXP - left.forecast.netDevelopmentXP)[0] ?? null;
  const topRisk =
    [...playerRows].sort(
      (left, right) =>
        right.forecast.regressionPressure - left.forecast.regressionPressure || right.totalXp - left.totalXp,
    )[0] ?? null;

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

        <div className="training-compact-summary-grid training-v2-summary-grid">
          <article className="training-v2-summary-card">
            <span>Regeneration</span>
            <strong>
              {formatPps(summary.recoveryBeforeTraining)} → {formatPps(summary.recoveryAfterTraining)}
            </strong>
            <small>
              Leicht {summary.lightModeCount} · Hart {summary.hardModeCount}
            </small>
          </article>
          <article className="training-v2-summary-card">
            <span>Trainingsertrag</span>
            <strong>{formatLocaleNumber(summary.trainingXpAfter, 0)}</strong>
            <small>Facility {formatSignedPercent(summary.trainingXpModifierPct)}</small>
          </article>
          <article className="training-v2-summary-card">
            <span>Performance XP</span>
            <strong>{formatLocaleNumber(summary.performanceXp, 0)}</strong>
            <small>Gesamt {formatLocaleNumber(summary.totalXp, 0)}</small>
          </article>
          <article className="training-v2-summary-card">
            <span>Entwicklung</span>
            <strong>{developmentSummary.growth}</strong>
            <small>
              {developmentSummary.regression} Risiko · {developmentSummary.stable} stabil
            </small>
          </article>
        </div>

        <div className="training-compact-story-grid training-v2-story-grid" id="training-compact-forecast">
          <article className="training-v2-story-card is-growth">
            <span>Top Steigerer</span>
            <strong>{topGrowth?.player.name ?? "—"}</strong>
            <small>
              {topGrowth
                ? `+${formatLocaleNumber(topGrowth.forecast.netDevelopmentXP, 0)} Wachstum · ${topGrowth.modeConfig.label}`
                : "Kein aktiver Kader"}
            </small>
          </article>
          <article className="training-v2-story-card is-risk">
            <span>Groesstes Risiko</span>
            <strong>{topRisk?.player.name ?? "—"}</strong>
            <small>
              {topRisk ? `Rueckschritt ${formatLocaleNumber(topRisk.forecast.regressionPressure, 0)}` : "Keine Risikodaten"}
            </small>
          </article>
        </div>

        {managementLockedReason ? <p className="muted">{managementLockedReason}</p> : null}
        <TrainingModeGuide trainingModeOptions={trainingModeOptions} />
      </header>

      <section className="training-compact-workspace training-v2-lane training-v2-lane-training">
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
        />
      </section>
    </section>
  );
}
