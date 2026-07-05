"use client";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { Team } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import { TrainingModeGuideDisclosure, TrainingPlayerLane, formatLocaleNumber, formatSignedPercent } from "@/app/foundation/training-facilities-v2/training-view-shared";
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
          <article className="training-v2-stat-chip">
            <span>Regeneration</span>
            <strong>
              {formatPps(summary.recoveryBeforeTraining)} → {formatPps(summary.recoveryAfterTraining)}
            </strong>
            <small>
              Leicht {summary.lightModeCount} · Hart {summary.hardModeCount}
            </small>
          </article>
          <article className="training-v2-stat-chip">
            <span>Trainingsbudget</span>
            <strong>{formatLocaleNumber(summary.trainingXpAfter, 1)}</strong>
            <small>Facility {formatSignedPercent(summary.trainingXpModifierPct)}</small>
          </article>
          <article className="training-v2-stat-chip">
            <span>Performance</span>
            <strong>{formatLocaleNumber(summary.performanceXp, 1)}</strong>
            <small>Netto {formatLocaleNumber(summary.totalXp, 1)} Setpoints</small>
          </article>
          <article className="training-v2-stat-chip">
            <span>Entwicklung</span>
            <strong>{developmentSummary.growth} steigt</strong>
            <small>
              {developmentSummary.stable} stabil · {developmentSummary.regression} Risiko
            </small>
          </article>
        </div>

        <p className="muted training-v2-top-risk-line">
          Top: <strong>{topGrowth?.player.name ?? "—"}</strong>
          {topGrowth ? ` (+${formatLocaleNumber(topGrowth.organicForecast.netSetpoints, 1)})` : ""} · Risiko:{" "}
          <strong>{topRisk?.player.name ?? "—"}</strong>
          {topRisk ? ` (Rueckschritt ${formatLocaleNumber(topRisk.forecast.regressionPressure, 0)})` : ""}
        </p>

        {managementLockedReason ? <p className="muted">{managementLockedReason}</p> : null}
        <TrainingModeGuideDisclosure trainingModeOptions={trainingModeOptions} />
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
