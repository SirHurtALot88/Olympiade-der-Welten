import { useMemo } from "react";

import { buildTeamPlayerTrainingLoadPlanMap, type AiPlayerTrainingLoadPlan } from "@/lib/ai/ai-player-training-load-service";
import type { GameState, Team, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { applyRecoveryFacilityModifiers, applyTrainingFacilityGrowthModifiers } from "@/lib/facilities/facility-effects";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { getTeamDevelopmentTrainingBonusPct } from "@/lib/foundation/team-development-tendency";
import { buildTrainingPlayerRowView } from "@/lib/foundation/training-player-row-view";
import { BASE_MATCHDAY_RECOVERY } from "@/lib/fatigue/fatigue-injury-service";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildTrainingModeDemand } from "@/lib/training/training-mode-demand-service";
import { getAllTrainingModePresentations } from "@/lib/training/training-mode-presentation";
import { applyTrainingRecoveryImpact } from "@/lib/training/training-recovery-impact";
import { TRAINING_ATTRIBUTE_LABELS } from "@/lib/training/attribute-affinity-service";
import type { TrainingClassDraft, TrainingDevelopmentFilter, TrainingModeDraft } from "@/lib/foundation/tabs/foundation-page-types";
import { trainingModeConfigs } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { useTrainingForecastLimit } from "@/lib/foundation/tabs/use-training-forecast-limit";
import { getRosterPlayers } from "@/lib/foundation/tabs/season-stand-render-helpers";

type RosterPlayer = ReturnType<typeof getRosterPlayers>[number];

export interface UseTrainingPanelDerivationsInput {
  gameState: GameState;
  selectedTeam: Team;
  selectedTeamFacilityState: TeamFacilityCollection;
  rosterPlayers: RosterPlayer[];
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  playerSeasonPerformanceMap: Map<string, PlayerSeasonPerformanceSummary | null>;
  trainingModeDraft: Record<string, TrainingModeDraft>;
  trainingClassDraft: Record<string, TrainingClassDraft>;
  trainingDevelopmentFilter: TrainingDevelopmentFilter;
}

/**
 * Training-compact panel derivations (Foundation Perf Phase 3, strangler pattern).
 * Runs only while `FoundationTrainingCompactShellHost` is mounted (i.e. the
 * training-compact tab is active) instead of unconditionally in the parent
 * scope hook, so the whole-roster `buildOrganicSeasonProgression` pass no
 * longer runs on every render regardless of the active tab.
 */
export function useTrainingPanelDerivations(input: UseTrainingPanelDerivationsInput) {
  const teamBaseRecoveryForecast = useMemo(
    () => applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, input.selectedTeamFacilityState),
    [input.selectedTeamFacilityState],
  );

  const trainingForecastPlayerLimit = useTrainingForecastLimit({
    enabled: true,
    totalCount: input.rosterPlayers.length,
  });

  const trainingPlayerForecastRows = useMemo(() => {
    const forecastRosterPlayers = input.rosterPlayers.slice(0, trainingForecastPlayerLimit);
    if (forecastRosterPlayers.length === 0) {
      return [];
    }

    return forecastRosterPlayers.map(({ entry, player }) => {
      const playerTeamId = entry.teamId ?? input.selectedTeam.teamId;
      const mode = input.trainingModeDraft[player.id] ?? player.trainingMode ?? "mittel";
      const trainingClass = input.trainingClassDraft[player.id] ?? player.trainingClass ?? player.className;
      const trainingPlayer = {
        ...player,
        trainingMode: mode,
        trainingClass,
      };
      const modeConfig = trainingModeConfigs[mode];
      const recoveryForecast = applyTrainingRecoveryImpact(teamBaseRecoveryForecast.after, mode);
      const seasonPerformance = input.playerSeasonPerformanceMap.get(player.id) ?? null;
      const rating = input.playerRatingsById.get(player.id) ?? null;
      const forecast = buildPlayerProgressionForecast({
        gameState: input.gameState,
        player: trainingPlayer,
        playerRating: rating,
        seasonPerformance,
        trainingModeByPlayerId: { [player.id]: mode },
        currentXP: player.currentXP ?? 0,
        spentXP: player.spentXP ?? 0,
        lifetimeXP: player.lifetimeXP ?? null,
      });
      const organicProgression = buildOrganicSeasonProgression({
        gameState: input.gameState,
        player: trainingPlayer,
        facilities: input.selectedTeamFacilityState,
      });
      const currentSchedule =
        input.gameState.seasonState.disciplineSchedule?.find(
          (scheduleEntry) => scheduleEntry.matchdayId === input.gameState.matchdayState.matchdayId,
        ) ?? null;
      const trainingDemand = buildTrainingModeDemand({
        context: {
          seasonId: input.gameState.season.id,
          teamId: playerTeamId,
          matchdayIndex: currentSchedule?.matchdayIndex ?? null,
        },
        player: {
          ...trainingPlayer,
          trainingMode: mode,
        },
      });
      const appearances = seasonPerformance?.appearances ?? 0;
      const seasonPoints = seasonPerformance?.totalPoints ?? rating?.ppsSeason ?? null;

      return {
        entry,
        player: trainingPlayer,
        mode,
        trainingClass,
        modeConfig,
        forecast,
        organicProgression,
        appearances,
        seasonPoints,
        performanceXp: organicProgression.appliedPerformanceSetpoints,
        trainingXp: organicProgression.trainingSetpoints,
        totalXp: organicProgression.netSetpoints,
        fatigueWarning: forecast.fatigueStrain.warning,
        recoveryForecast,
        playerMvs: rating?.mvs ?? null,
        playerPps: rating?.ppsSeason ?? seasonPerformance?.totalPoints ?? null,
        developmentStars: {
          currentAbilityStars: forecast.currentAbilityStars,
          potentialStars: forecast.potentialStars,
          currentAbilityRating: forecast.currentAbilityRating,
          potentialRating: forecast.potentialRating,
        },
        trainingDemand,
      };
    });
  }, [
    input.gameState,
    input.playerRatingsById,
    input.playerSeasonPerformanceMap,
    input.rosterPlayers,
    input.selectedTeam.teamId,
    input.selectedTeamFacilityState,
    input.trainingClassDraft,
    input.trainingModeDraft,
    teamBaseRecoveryForecast.after,
    trainingForecastPlayerLimit,
  ]);

  const trainingForecastSummary = useMemo(() => {
    const trainingXp = trainingPlayerForecastRows.reduce((sum, row) => sum + row.trainingXp, 0);
    const performanceXp = trainingPlayerForecastRows.reduce((sum, row) => sum + row.performanceXp, 0);
    const recoveryAfterTraining =
      trainingPlayerForecastRows.length > 0
        ? trainingPlayerForecastRows.reduce((sum, row) => sum + row.recoveryForecast.after, 0) /
          trainingPlayerForecastRows.length
        : teamBaseRecoveryForecast.after;

    return {
      trainingXp,
      performanceXp,
      totalXp: trainingXp + performanceXp,
      hardModeCount: trainingPlayerForecastRows.filter((row) => row.mode === "hart").length,
      lightModeCount: trainingPlayerForecastRows.filter((row) => row.mode === "leicht").length,
      recoveryBeforeTraining: teamBaseRecoveryForecast.after,
      recoveryAfterTraining,
    };
  }, [teamBaseRecoveryForecast.after, trainingPlayerForecastRows]);

  const trainingDevelopmentSummary = useMemo(() => {
    const getTone = (row: (typeof trainingPlayerForecastRows)[number]): Exclude<TrainingDevelopmentFilter, "all"> =>
      row.organicProgression.netSetpoints < 0
        ? "regression"
        : row.organicProgression.netSetpoints >= 2
          ? "growth"
          : "stable";

    return trainingPlayerForecastRows.reduce(
      (summary, row) => {
        summary[getTone(row)] += 1;
        return summary;
      },
      {
        all: trainingPlayerForecastRows.length,
        growth: 0,
        stable: 0,
        regression: 0,
      } satisfies Record<TrainingDevelopmentFilter, number>,
    );
  }, [trainingPlayerForecastRows]);

  const filteredTrainingPlayerForecastRows = useMemo(() => {
    if (input.trainingDevelopmentFilter === "all") {
      return trainingPlayerForecastRows;
    }

    return trainingPlayerForecastRows.filter((row) => {
      const tone =
        row.organicProgression.netSetpoints < 0 || row.forecast.regressionRisk === "high"
          ? "regression"
          : row.organicProgression.netSetpoints >= 2
            ? "growth"
            : "stable";
      return tone === input.trainingDevelopmentFilter;
    });
  }, [input.trainingDevelopmentFilter, trainingPlayerForecastRows]);

  const trainingLoadPlanByPlayerId = useMemo(() => {
    const settings = input.gameState.seasonState.aiManagerTrainingSettings?.[input.selectedTeam.teamId];
    const intensity =
      settings?.trainingIntensity === "light" ? "light" : settings?.trainingIntensity === "hard" ? "hard" : "normal";
    return buildTeamPlayerTrainingLoadPlanMap({
      gameState: input.gameState,
      teamId: input.selectedTeam.teamId,
      teamBaselineIntensity: intensity,
    });
  }, [input.gameState, input.selectedTeam]);

  const trainingPlayerRowViews = useMemo(() => {
    return filteredTrainingPlayerForecastRows.map((row) => {
      const view = buildTrainingPlayerRowView(row, TRAINING_ATTRIBUTE_LABELS);
      const plan = trainingLoadPlanByPlayerId.get(row.player.id);
      if (!plan) {
        return view;
      }
      return {
        ...view,
        recommendedTrainingMode: plan.selectedMode,
        recommendedTrainingDetail: plan.reasons[0] ?? null,
        recommendedTrainingMatchesCurrent: plan.selectedMode === row.mode,
      };
    });
  }, [filteredTrainingPlayerForecastRows, trainingLoadPlanByPlayerId]);

  const trainingV2ModeOptions = useMemo(
    () =>
      getAllTrainingModePresentations().map((presentation) => ({
        value: presentation.value,
        label: presentation.label,
        note: presentation.note,
        fatigueRisk: presentation.fatigueRisk,
        baseXp: presentation.baseXp,
        recoveryDeltaPct: presentation.recoveryDeltaPct,
        trainingSetpoints: presentation.trainingSetpoints,
        fatigueLoad: presentation.fatigueLoad,
      })),
    [],
  );

  const trainingFacilityEffectPreview = useMemo(() => {
    const developmentTrainingBonusPct = getTeamDevelopmentTrainingBonusPct(input.gameState, input.selectedTeam.teamId);
    const trainingXp = applyTrainingFacilityGrowthModifiers(trainingForecastSummary.trainingXp, input.selectedTeamFacilityState, {
      developmentTrainingBonusPct,
    });

    return { trainingXp };
  }, [input.gameState, input.selectedTeam, input.selectedTeamFacilityState, trainingForecastSummary.trainingXp]);

  return {
    trainingPlayerForecastRows,
    trainingForecastSummary,
    trainingDevelopmentSummary,
    trainingPlayerRowViews,
    trainingV2ModeOptions,
    trainingFacilityEffectPreview,
  };
}

export type { AiPlayerTrainingLoadPlan };
