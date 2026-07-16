"use client";

import TrainingCompactClient from "@/app/foundation/training-compact/TrainingCompactClient";
import type { TrainingClassOption } from "@/app/foundation/training-facilities-v2/training-view-types";
import type { GameState, Team, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { TrainingClassDraft, TrainingDevelopmentFilter, TrainingModeDraft } from "@/lib/foundation/tabs/foundation-page-types";
import { getRosterPlayers } from "@/lib/foundation/tabs/season-stand-render-helpers";
import { useTrainingPanelDerivations } from "@/lib/foundation/tabs/use-training-panel-derivations";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

type RosterPlayer = ReturnType<typeof getRosterPlayers>[number];

export type FoundationTrainingCompactShellHostProps = {
  gameState: GameState;
  selectedTeam: Team;
  selectedTeamFacilityState: TeamFacilityCollection;
  rosterPlayers: RosterPlayer[];
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  playerSeasonPerformanceMap: Map<string, PlayerSeasonPerformanceSummary | null>;
  trainingModeDraft: Record<string, TrainingModeDraft>;
  trainingClassDraft: Record<string, TrainingClassDraft>;
  trainingDevelopmentFilter: TrainingDevelopmentFilter;
  onSetTrainingDevelopmentFilter: (filter: TrainingDevelopmentFilter) => void;
  selectedTeamControlMode?: string | null;
  seasonLabel: string;
  managementLocked?: boolean;
  managementLockedReason?: string | null;
  trainingClassOptions: TrainingClassOption[];
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenFacilities?: () => void;
  onOpenTeams?: () => void;
};

/**
 * Training-compact shell host (Foundation Perf Phase 3). Mounts the
 * whole-roster training-forecast derivations only while the training-compact
 * tab is active (via `FoundationTabActiveHost` + deferred mount upstream),
 * mirroring the Cockpit/Prize host pattern.
 */
export default function FoundationTrainingCompactShellHost({
  gameState,
  selectedTeam,
  selectedTeamFacilityState,
  rosterPlayers,
  playerRatingsById,
  playerSeasonPerformanceMap,
  trainingModeDraft,
  trainingClassDraft,
  trainingDevelopmentFilter,
  onSetTrainingDevelopmentFilter,
  selectedTeamControlMode,
  seasonLabel,
  managementLocked,
  managementLockedReason,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
  onOpenFacilities,
  onOpenTeams,
}: FoundationTrainingCompactShellHostProps) {
  const {
    trainingPlayerForecastRows,
    trainingForecastSummary,
    trainingDevelopmentSummary,
    trainingPlayerRowViews,
    trainingV2ModeOptions,
    trainingFacilityEffectPreview,
  } = useTrainingPanelDerivations({
    gameState,
    selectedTeam,
    selectedTeamFacilityState,
    rosterPlayers,
    playerRatingsById,
    playerSeasonPerformanceMap,
    trainingModeDraft,
    trainingClassDraft,
    trainingDevelopmentFilter,
  });

  return (
    <TrainingCompactClient
      selectedTeam={selectedTeam}
      selectedTeamControlMode={selectedTeamControlMode}
      seasonLabel={seasonLabel}
      managementLocked={managementLocked}
      managementLockedReason={managementLockedReason}
      summary={{
        recoveryBeforeTraining: trainingForecastSummary.recoveryBeforeTraining,
        recoveryAfterTraining: trainingForecastSummary.recoveryAfterTraining,
        performanceXp: trainingForecastSummary.performanceXp,
        totalXp: trainingForecastSummary.totalXp,
        lightModeCount: trainingForecastSummary.lightModeCount,
        hardModeCount: trainingForecastSummary.hardModeCount,
        trainingXpAfter: trainingFacilityEffectPreview.trainingXp.after,
        trainingXpModifierPct: trainingFacilityEffectPreview.trainingXp.modifierPct,
      }}
      developmentFilter={trainingDevelopmentFilter}
      developmentSummary={trainingDevelopmentSummary}
      onSetDevelopmentFilter={onSetTrainingDevelopmentFilter}
      trainingModeOptions={trainingV2ModeOptions}
      trainingClassOptions={trainingClassOptions}
      playerRows={trainingPlayerRowViews}
      allPlayerCount={trainingPlayerForecastRows.length}
      onSetTrainingMode={onSetTrainingMode}
      onSetTrainingClass={onSetTrainingClass}
      onOpenPlayerDetails={onOpenPlayerDetails}
      onOpenFacilities={onOpenFacilities}
      onOpenTeams={onOpenTeams}
    />
  );
}
