import { useMemo } from "react";

import { buildTeamPlayerTrainingLoadPlanMap, type AiPlayerTrainingLoadPlan } from "@/lib/ai/ai-player-training-load-service";
import type { GameState, Team, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { calculateFacilityMaintenanceCost, getFacilityConditionStatus } from "@/lib/facilities/facility-condition";
import {
  applyRecoveryFacilityModifiers,
  applyTrainingXpFacilityModifiers,
  applyUpgradeCostFacilityModifiers,
  calculateFacilityIncome,
  calculateFacilityUpkeep,
  getAnalyticsForecastQuality,
  getFacilityEfficiency,
  getFacilityLevel,
  getScoutingConfidence,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import { getTeamDevelopmentTrainingBonusPct } from "@/lib/foundation/team-development-tendency";
import { buildTrainingPlayerRowView } from "@/lib/foundation/training-player-row-view";
import { BASE_MATCHDAY_RECOVERY } from "@/lib/fatigue/fatigue-injury-service";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import { buildPlayerProgressionForecast, PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import { buildTrainingModeDemand } from "@/lib/training/training-mode-demand-service";
import { getAllTrainingModePresentations } from "@/lib/training/training-mode-presentation";
import { applyTrainingRecoveryImpact } from "@/lib/training/training-recovery-impact";
import { TRAINING_ATTRIBUTE_LABELS } from "@/lib/training/training-levelup-service";
import {
  buildSeasonEndProgressionPreview,
  type SeasonEndFacilityPreviewInput,
} from "@/lib/training/season-end-progression-preview";
import type {
  FoundationReadMeta,
  TrainingClassDraft,
  TrainingDevelopmentFilter,
  TrainingModeDraft,
} from "@/lib/foundation/tabs/foundation-page-types";
import { EMPTY_SEASON_END_PROGRESSION_PREVIEW } from "@/lib/foundation/tabs/foundation-page-types";
import { trainingModeConfigs } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { useTrainingForecastLimit } from "@/lib/foundation/tabs/use-training-forecast-limit";
import { getRosterPlayers } from "@/lib/foundation/tabs/season-stand-render-helpers";

type RosterPlayer = ReturnType<typeof getRosterPlayers>[number];

export function shouldBuildFoundationTrainingForecastDerivations(input: {
  shouldBuildTrainingView: boolean;
  shouldBuildPlayerProfileTrainingRow: boolean;
}): boolean {
  return input.shouldBuildTrainingView || input.shouldBuildPlayerProfileTrainingRow;
}

export function shouldBuildFoundationTrainingCompactDerivations(shouldBuildTrainingCompactView: boolean): boolean {
  return shouldBuildTrainingCompactView;
}

export function shouldBuildFoundationTrainingFacilitiesDerivations(shouldBuildTrainingFacilitiesView: boolean): boolean {
  return shouldBuildTrainingFacilitiesView;
}

export function useFoundationCrossTabTraining(input: {
  shouldBuildTrainingView: boolean;
  shouldBuildTrainingCompactView: boolean;
  shouldBuildTrainingFacilitiesView: boolean;
  shouldBuildPlayerProfileTrainingRow: boolean;
  gameState: GameState;
  selectedTeam: Team;
  selectedTeamFacilityState: TeamFacilityCollection;
  rosterPlayers: RosterPlayer[];
  playerRatingsById: Map<string, { mvs?: number | null; ppsSeason?: number | null; ovrNormalized?: number | null }>;
  playerSeasonPerformanceMap: Map<string, { appearances?: number; totalPoints?: number | null } | null>;
  trainingModeDraft: Record<string, TrainingModeDraft>;
  trainingClassDraft: Record<string, TrainingClassDraft>;
  trainingDevelopmentFilter: TrainingDevelopmentFilter;
  trainingFacilityPreviewId: string | null;
  playerProfileData: { playerId: string } | null;
  readMeta: FoundationReadMeta;
  plannedXpUpgradesLength: number;
  seasonEndAttributeDraft: Record<string, string>;
}) {
  const shouldBuildTrainingForecastDerivations = shouldBuildFoundationTrainingForecastDerivations({
    shouldBuildTrainingView: input.shouldBuildTrainingView,
    shouldBuildPlayerProfileTrainingRow: input.shouldBuildPlayerProfileTrainingRow,
  });
  const shouldBuildTrainingCompactDerivations = shouldBuildFoundationTrainingCompactDerivations(
    input.shouldBuildTrainingCompactView,
  );
  const shouldBuildTrainingFacilitiesDerivations = shouldBuildFoundationTrainingFacilitiesDerivations(
    input.shouldBuildTrainingFacilitiesView,
  );

  const teamBaseRecoveryForecast = useMemo(
    () => applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, input.selectedTeamFacilityState),
    [input.selectedTeamFacilityState],
  );

  const trainingForecastPlayerLimit = useTrainingForecastLimit({
    enabled: input.shouldBuildTrainingView,
    totalCount: input.rosterPlayers.length,
  });

  const trainingPlayerForecastRows = useMemo(() => {
    if (!shouldBuildTrainingForecastDerivations) {
      return [];
    }

    const profilePlayerId = input.shouldBuildPlayerProfileTrainingRow ? input.playerProfileData?.playerId ?? null : null;
    let forecastRosterPlayers = profilePlayerId
      ? input.rosterPlayers.filter(({ player }) => player.id === profilePlayerId)
      : input.shouldBuildTrainingView
        ? input.rosterPlayers.slice(0, trainingForecastPlayerLimit)
        : input.rosterPlayers;

    if (profilePlayerId && forecastRosterPlayers.length === 0) {
      const profilePlayer = input.gameState.players.find((candidate) => candidate.id === profilePlayerId) ?? null;
      const profileRosterEntry = input.gameState.rosters?.find((entry) => entry.playerId === profilePlayerId) ?? null;
      if (profilePlayer && profileRosterEntry) {
        forecastRosterPlayers = [{ entry: profileRosterEntry, player: profilePlayer }];
      }
    }

    if (forecastRosterPlayers.length === 0) {
      return [];
    }

    return forecastRosterPlayers.map(({ entry, player }) => {
      const playerTeamId = entry.teamId ?? input.selectedTeam.teamId;
      const playerFacilityState = getTeamFacilityState(input.gameState, playerTeamId);
      const playerBaseRecoveryForecast = applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, playerFacilityState);
      const facilitiesForForecast = profilePlayerId ? playerFacilityState : input.selectedTeamFacilityState;
      const baseRecoveryForForecast = profilePlayerId
        ? playerBaseRecoveryForecast.after
        : teamBaseRecoveryForecast.after;
      const mode = input.trainingModeDraft[player.id] ?? player.trainingMode ?? "mittel";
      const trainingClass = input.trainingClassDraft[player.id] ?? player.trainingClass ?? player.className;
      const trainingPlayer = {
        ...player,
        trainingMode: mode,
        trainingClass,
      };
      const modeConfig = trainingModeConfigs[mode];
      const recoveryForecast = applyTrainingRecoveryImpact(baseRecoveryForForecast, mode);
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
        facilities: facilitiesForForecast,
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
        upgradeEstimate: forecast.possibleUpgradeSummary,
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
    input.playerProfileData,
    input.playerRatingsById,
    input.playerSeasonPerformanceMap,
    input.rosterPlayers,
    input.selectedTeam.teamId,
    input.selectedTeamFacilityState,
    input.shouldBuildPlayerProfileTrainingRow,
    input.shouldBuildTrainingView,
    input.trainingClassDraft,
    input.trainingModeDraft,
    shouldBuildTrainingForecastDerivations,
    teamBaseRecoveryForecast.after,
    trainingForecastPlayerLimit,
  ]);

  const trainingForecastSummary = useMemo(() => {
    if (!shouldBuildTrainingCompactDerivations) {
      return {
        trainingXp: 0,
        performanceXp: 0,
        totalXp: 0,
        hardModeCount: 0,
        lightModeCount: 0,
        recoveryBeforeTraining: teamBaseRecoveryForecast.after,
        recoveryAfterTraining: teamBaseRecoveryForecast.after,
      };
    }
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
  }, [shouldBuildTrainingCompactDerivations, teamBaseRecoveryForecast.after, trainingPlayerForecastRows]);

  const trainingDevelopmentSummary = useMemo(() => {
    if (!shouldBuildTrainingCompactDerivations) {
      return { all: 0, growth: 0, stable: 0, regression: 0 } satisfies Record<TrainingDevelopmentFilter, number>;
    }
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
  }, [shouldBuildTrainingCompactDerivations, trainingPlayerForecastRows]);

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
    if (!input.selectedTeam || !shouldBuildTrainingCompactDerivations) {
      return new Map<string, AiPlayerTrainingLoadPlan>();
    }
    const settings = input.gameState.seasonState.aiManagerTrainingSettings?.[input.selectedTeam.teamId];
    const intensity =
      settings?.trainingIntensity === "light" ? "light" : settings?.trainingIntensity === "hard" ? "hard" : "normal";
    return buildTeamPlayerTrainingLoadPlanMap({
      gameState: input.gameState,
      teamId: input.selectedTeam.teamId,
      teamBaselineIntensity: intensity,
    });
  }, [input.gameState, input.selectedTeam, shouldBuildTrainingCompactDerivations]);

  const trainingPlayerRowViews = useMemo(() => {
    if (!shouldBuildTrainingCompactDerivations) {
      return [];
    }
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
  }, [filteredTrainingPlayerForecastRows, shouldBuildTrainingCompactDerivations, trainingLoadPlanByPlayerId]);

  const playerProfileTrainingRow = useMemo(() => {
    if (!input.playerProfileData) {
      return null;
    }
    const row = trainingPlayerForecastRows.find((entry) => entry.player.id === input.playerProfileData?.playerId);
    return row ? buildTrainingPlayerRowView(row, TRAINING_ATTRIBUTE_LABELS) : null;
  }, [input.playerProfileData, trainingPlayerForecastRows]);

  const trainingFacilityRows = useMemo(() => {
    if (!shouldBuildTrainingFacilitiesDerivations) {
      return [];
    }

    return FACILITY_CATALOG.map((facility) => {
      const level = getFacilityLevel(input.selectedTeamFacilityState, facility.facilityId);
      const currentLevel = facility.levels.find((entry) => entry.level === level) ?? null;
      const nextLevel = Math.min(level + 1, facility.maxLevel);
      const nextLevelDefinition = facility.levels.find((entry) => entry.level === nextLevel) ?? null;
      const state = input.selectedTeamFacilityState.facilities[facility.facilityId];
      const efficiency = getFacilityEfficiency(input.selectedTeamFacilityState, facility.facilityId);
      const conditionStatus = getFacilityConditionStatus(efficiency.conditionPct);

      return {
        id: facility.facilityId,
        name: facility.label,
        description: facility.description,
        effect: facility.effectDescription,
        level,
        nextLevel,
        upgradeCost: level >= facility.maxLevel ? null : nextLevelDefinition?.upgradeCost ?? null,
        currentUpkeep: currentLevel?.seasonUpkeep ?? 0,
        nextUpkeep: nextLevelDefinition?.seasonUpkeep ?? currentLevel?.seasonUpkeep ?? 0,
        currentIncome: currentLevel?.seasonIncome ?? 0,
        nextIncome: nextLevelDefinition?.seasonIncome ?? currentLevel?.seasonIncome ?? 0,
        conditionPct: efficiency.conditionPct,
        efficiencyPct: efficiency.efficiencyPct,
        conditionStatus,
        maintenanceCost: calculateFacilityMaintenanceCost({
          facilityId: facility.facilityId,
          level,
          conditionPct: efficiency.conditionPct,
        }),
        status:
          input.readMeta.source === "sqlite" && !input.readMeta.readOnly
            ? ("ready" as const)
            : ("preview_only" as const),
        sourceStatus: state?.disabledReason ?? (level > 0 ? "save_state" : "not_built"),
        currentEffect: currentLevel?.effectDescription ?? "Level 0: kein Effekt",
        nextLevelEffect: nextLevelDefinition?.effectDescription ?? "Max Level erreicht",
      };
    });
  }, [input.readMeta.readOnly, input.readMeta.source, input.selectedTeamFacilityState, shouldBuildTrainingFacilitiesDerivations]);

  const selectedTrainingFacilityPreview = useMemo(
    () => trainingFacilityRows.find((facility) => facility.id === input.trainingFacilityPreviewId) ?? null,
    [input.trainingFacilityPreviewId, trainingFacilityRows],
  );

  const trainingFacilityForecast = useMemo(() => {
    const upgradeCost = selectedTrainingFacilityPreview?.upgradeCost ?? null;
    const currentUpkeep = calculateFacilityUpkeep(input.selectedTeamFacilityState);
    const currentIncome = calculateFacilityIncome(input.selectedTeamFacilityState);
    const nextUpkeep = selectedTrainingFacilityPreview
      ? currentUpkeep - selectedTrainingFacilityPreview.currentUpkeep + selectedTrainingFacilityPreview.nextUpkeep
      : currentUpkeep;
    const nextIncome = selectedTrainingFacilityPreview
      ? currentIncome - selectedTrainingFacilityPreview.currentIncome + selectedTrainingFacilityPreview.nextIncome
      : currentIncome;
    const projectedCash = upgradeCost != null ? input.selectedTeam.cash - upgradeCost : null;

    return {
      upgradeCost,
      currentUpkeep,
      nextUpkeep,
      currentIncome,
      nextIncome,
      projectedCash,
    };
  }, [input.selectedTeam.cash, input.selectedTeamFacilityState, selectedTrainingFacilityPreview]);

  const trainingFacilitySeasonEndFinance = useMemo(() => {
    if (!shouldBuildTrainingFacilitiesDerivations) {
      return {
        rows: [],
        incomeTotal: 0,
        upkeepTotal: 0,
        netFacilityResult: 0,
        cashBeforeFacilities: input.selectedTeam.cash,
        cashAfterFacilities: input.selectedTeam.cash,
        fanShopIncome: 0,
        arenaIncome: 0,
        disabledFacilities: [],
      };
    }

    const rows = trainingFacilityRows.map((facility) => ({
      ...facility,
      net: facility.currentIncome - facility.currentUpkeep,
      upkeepPaid:
        facility.level <= 0
          ? "not_built"
          : facility.sourceStatus === "facility_upkeep_unpaid" || facility.sourceStatus === "facility_disabled"
            ? "disabled"
            : "due",
    }));
    const incomeTotal = calculateFacilityIncome(input.selectedTeamFacilityState);
    const upkeepTotal = calculateFacilityUpkeep(input.selectedTeamFacilityState);
    const netFacilityResult = incomeTotal - upkeepTotal;
    const cashAfterFacilities = input.selectedTeam.cash + incomeTotal - upkeepTotal;
    const disabledFacilities = rows.filter((row) => row.upkeepPaid === "disabled");

    return {
      rows,
      incomeTotal,
      upkeepTotal,
      netFacilityResult,
      cashBeforeFacilities: input.selectedTeam.cash,
      cashAfterFacilities,
      fanShopIncome: rows.find((row) => row.id === "fan_shop")?.currentIncome ?? 0,
      arenaIncome: rows.find((row) => row.id === "arena_upgrade")?.currentIncome ?? 0,
      disabledFacilities,
    };
  }, [
    input.selectedTeam.cash,
    input.selectedTeamFacilityState,
    shouldBuildTrainingFacilitiesDerivations,
    trainingFacilityRows,
  ]);

  const trainingFacilityEffectPreview = useMemo(() => {
    const developmentTrainingBonusPct = input.selectedTeam
      ? getTeamDevelopmentTrainingBonusPct(input.gameState, input.selectedTeam.teamId)
      : 0;
    const trainingXp = applyTrainingXpFacilityModifiers(
      trainingForecastSummary.trainingXp,
      input.selectedTeamFacilityState,
      {
        developmentTrainingBonusPct,
      },
    );
    const recovery = applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, input.selectedTeamFacilityState);
    const academyLowTier = applyUpgradeCostFacilityModifiers(
      "power",
      "D",
      PLAYER_PROGRESSION_XP_CONSTANTS.ratingTierUpgradeCost.D,
      input.selectedTeamFacilityState,
    );
    const specialistPower = applyUpgradeCostFacilityModifiers(
      "power",
      "B",
      PLAYER_PROGRESSION_XP_CONSTANTS.ratingTierUpgradeCost.B,
      input.selectedTeamFacilityState,
    );
    const specialistSpeed = applyUpgradeCostFacilityModifiers(
      "speed",
      "B",
      PLAYER_PROGRESSION_XP_CONSTANTS.ratingTierUpgradeCost.B,
      input.selectedTeamFacilityState,
    );
    const scouting = getScoutingConfidence(input.selectedTeamFacilityState);
    const analytics = getAnalyticsForecastQuality(input.selectedTeamFacilityState);

    return {
      trainingXp,
      recovery,
      recoveryAfterTraining: trainingForecastSummary.recoveryAfterTraining,
      academyLowTier,
      specialistPower,
      specialistSpeed,
      scouting,
      analytics,
      warnings: [
        scouting.level > 0 ? "potential_source_missing" : null,
        analytics.level > 0 ? "forecast_uncertainty_reduced_no_fake_values" : null,
      ].filter((entry): entry is string => Boolean(entry)),
    };
  }, [
    input.gameState,
    input.selectedTeam,
    input.selectedTeamFacilityState,
    trainingForecastSummary.recoveryAfterTraining,
    trainingForecastSummary.trainingXp,
  ]);

  const seasonEndFacilityInput = useMemo<SeasonEndFacilityPreviewInput>(
    () => ({
      teamFacilities: {
        facilities: {
          ...input.selectedTeamFacilityState.facilities,
          ...(input.trainingFacilityPreviewId
            ? {
                [input.trainingFacilityPreviewId]: {
                  ...input.selectedTeamFacilityState.facilities[input.trainingFacilityPreviewId],
                  level: Math.min(
                    (input.selectedTeamFacilityState.facilities[input.trainingFacilityPreviewId]?.level ?? 0) + 1,
                    5,
                  ),
                  enabled: true,
                  activeVariant:
                    input.trainingFacilityPreviewId === "specialist_wing"
                      ? input.selectedTeamFacilityState.facilities.specialist_wing?.activeVariant ?? "power_gym"
                      : input.selectedTeamFacilityState.facilities[input.trainingFacilityPreviewId]?.activeVariant,
                },
              }
            : {}),
        },
      },
    }),
    [input.selectedTeamFacilityState, input.trainingFacilityPreviewId],
  );

  const seasonEndProgressionPreview = useMemo(() => {
    if (!shouldBuildTrainingFacilitiesDerivations || input.plannedXpUpgradesLength === 0) {
      return EMPTY_SEASON_END_PROGRESSION_PREVIEW;
    }

    const forecastsByPlayerId = new Map(
      trainingPlayerForecastRows.map((row) => [row.player.id, row.forecast] as const),
    );
    const organicByPlayerId = new Map(
      trainingPlayerForecastRows.map((row) => [row.player.id, row.organicProgression] as const),
    );
    return buildSeasonEndProgressionPreview({
      gameState: input.gameState,
      teamId: input.selectedTeam.teamId,
      forecastsByPlayerId,
      organicByPlayerId,
      upgradeRequests: input.rosterPlayers.map(({ player }) => ({
        playerId: player.id,
        attribute: input.seasonEndAttributeDraft[player.id] ?? "power",
      })),
      facilities: seasonEndFacilityInput,
    });
  }, [
    input.gameState,
    input.plannedXpUpgradesLength,
    input.rosterPlayers,
    input.seasonEndAttributeDraft,
    input.selectedTeam.teamId,
    seasonEndFacilityInput,
    shouldBuildTrainingFacilitiesDerivations,
    trainingPlayerForecastRows,
  ]);

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

  return {
    trainingPlayerForecastRows,
    trainingForecastSummary,
    trainingDevelopmentSummary,
    filteredTrainingPlayerForecastRows,
    trainingLoadPlanByPlayerId,
    trainingPlayerRowViews,
    playerProfileTrainingRow,
    trainingFacilityRows,
    selectedTrainingFacilityPreview,
    trainingFacilityForecast,
    trainingFacilitySeasonEndFinance,
    trainingFacilityEffectPreview,
    seasonEndFacilityInput,
    seasonEndProgressionPreview,
    trainingV2ModeOptions,
  };
}
