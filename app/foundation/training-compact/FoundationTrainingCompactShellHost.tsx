"use client";

import { useMemo } from "react";

import TrainingCompactClient from "@/app/foundation/training-compact/TrainingCompactClient";
import TrainingModern from "@/app/foundation/training-modern/TrainingModern";
import { useTrainingLook } from "@/lib/training/training-look";
import type { TrainingClassOption } from "@/app/foundation/training-facilities-v2/training-view-types";
import type { GameState, Team, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { TrainingClassDraft, TrainingDevelopmentFilter, TrainingModeDraft } from "@/lib/foundation/tabs/foundation-page-types";
import { buildSaisonSpotlight } from "@/lib/foundation/saison-spotlight";
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
  /** Ziel-Disziplin + Weg gesammelt setzen (Entwicklung, Plan-Editor); `null` = zurück an den KI-Vorschlag. */
  onSetTrainingsZiele?: (
    aenderungen: Array<{
      playerId: string;
      ziel: { disziplinId: string; weg: number } | null;
    }>,
  ) => void;
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
  onSetTrainingsZiele,
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

  // Saison-Spotlight (`5hcq2p`): rein abgeleitet aus dem Spielstand, deshalb hier im Host und
  // nicht im Client. Ohne Vorsaison liefert der Aufbau `null` und die Karte rendert nichts.
  const saisonSpotlight = useMemo(() => buildSaisonSpotlight({ gameState, teamId: selectedTeam.teamId }), [gameState, selectedTeam.teamId]);

  const [look, setzeLook] = useTrainingLook();
  const gemeinsam = {
    selectedTeam,
    selectedTeamControlMode,
    seasonLabel,
    managementLocked,
    managementLockedReason,
    summary: {
      recoveryBeforeTraining: trainingForecastSummary.recoveryBeforeTraining,
      recoveryAfterTraining: trainingForecastSummary.recoveryAfterTraining,
      performanceXp: trainingForecastSummary.performanceXp,
      totalXp: trainingForecastSummary.totalXp,
      lightModeCount: trainingForecastSummary.lightModeCount,
      hardModeCount: trainingForecastSummary.hardModeCount,
      trainingXpAfter: trainingFacilityEffectPreview.trainingXp.after,
      trainingXpModifierPct: trainingFacilityEffectPreview.trainingXp.modifierPct,
    },
    developmentFilter: trainingDevelopmentFilter,
    developmentSummary: trainingDevelopmentSummary,
    onSetDevelopmentFilter: onSetTrainingDevelopmentFilter,
    trainingModeOptions: trainingV2ModeOptions,
    trainingClassOptions,
    playerRows: trainingPlayerRowViews,
    allPlayerCount: trainingPlayerForecastRows.length,
    onSetTrainingMode,
    onSetTrainingClass,
    onOpenPlayerDetails,
    onOpenFacilities,
    onOpenTeams,
  };

  if (look === "modern") {
    return (
      <TrainingModern
        {...gemeinsam}
        saisonSpotlight={saisonSpotlight}
        gameState={gameState}
        onSetTrainingsZiele={onSetTrainingsZiele}
        onZurKlassik={() => setzeLook("klassisch")}
      />
    );
  }

  return (
    <>
      <div className="saisonstand-look-schalter" data-testid="training-look-schalter">
        <button type="button" className="saisonstand-look-schalter__knopf" onClick={() => setzeLook("modern")}>
          Zur modernen Ansicht
        </button>
      </div>
      <TrainingCompactClient
        saisonSpotlight={saisonSpotlight}
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
    </>
  );
}
