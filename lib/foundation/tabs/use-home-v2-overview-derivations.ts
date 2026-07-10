import { useMemo } from "react";

import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel } from "@/lib/facilities/facility-effects";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { buildPlayerDevelopmentInsight } from "@/lib/progression/player-potential-service";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import {
  buildHomePlayerCardsFromRoster,
  formatLocalePoints,
  HOME_V2_FACILITY_IDS,
  type HomeV2RosterTableRow,
} from "@/lib/foundation/tabs/home-v2-ui-helpers";
import type {
  HomeV2BoardObjective,
  HomeV2FacilitySnapshot,
  HomeV2InboxItem,
  HomeV2ScheduleItem,
  HomeV2TodayCard,
  HomeV2TopPlayerCard,
} from "@/app/foundation/home-v2/home-v2-types";
import { sortTodayCardsByUrgency } from "@/lib/foundation/player-identity-meta";

type TeamObjective = {
  teamId: string;
  objectiveId: string;
  label: string;
  status: string;
  currentValue?: string | number | boolean | null;
  targetValue?: string | number | boolean | null;
};

export type HomeV2NextMatchdayStatus = {
  openSlots: number;
  resultAvailable: boolean;
  hasFormCardPool: boolean;
  hasFormCards: boolean;
};

export interface UseHomeV2OverviewDerivationsInput {
  gameState: GameState;
  seasonStandRows: TeamManagementSnapshotRow[];
  selectedRosterTableRows: HomeV2RosterTableRow[];
  playerRatingsById: Map<
    string,
    {
      ppPow?: number | null;
      ppSpe?: number | null;
      ppMen?: number | null;
      ppSoc?: number | null;
      ratingPps?: number | null;
      ppsSeason?: number | null;
    }
  >;
  playerSeasonPerformanceMap: Map<
    string,
    { pointsByArea: { pow?: number | null; spe?: number | null; men?: number | null; soc?: number | null } }
  >;
  selectedStandingRow: { rank?: number | null; points?: number | null } | null;
  selectedTeam: { teamId: string } | null;
  selectedTeamFacilityState: Parameters<typeof getFacilityLevel>[0];
  activeManagerTeamId: string | null;
  activeTeamDecisionInboxItems: GameInboxItem[];
  teamObjectives: TeamObjective[];
  activeViewContextWarning: string | null;
  activeContextMeta: { roomId?: string | null; scenarioType?: string | null } | null;
  homeNextMatchdayStatus: HomeV2NextMatchdayStatus;
  activeManagerLineupSubmitted: boolean;
  enableTopPlayerForecasts?: boolean;
}

/**
 * Home V2 overview derivations (Strangler Phase 5.3). Runs only while
 * `FoundationHomeV2Host` is mounted (`activeView === "homeV2"`).
 */
export function useHomeV2OverviewDerivations(input: UseHomeV2OverviewDerivationsInput) {
  const {
    gameState,
    seasonStandRows,
    selectedRosterTableRows,
    playerRatingsById,
    playerSeasonPerformanceMap,
    selectedStandingRow,
    selectedTeam,
    selectedTeamFacilityState,
    activeManagerTeamId,
    activeTeamDecisionInboxItems,
    teamObjectives,
    activeViewContextWarning,
    activeContextMeta,
    homeNextMatchdayStatus,
    activeManagerLineupSubmitted,
    enableTopPlayerForecasts = true,
  } = input;

  const hasSeasonResultsForHome = useMemo(
    () =>
      seasonStandRows.some((row) => (row.points ?? 0) > 0) ||
      (gameState.seasonState.matchdayResults ?? []).some((result) => result.seasonId === gameState.season.id),
    [gameState.season.id, gameState.seasonState.matchdayResults, seasonStandRows],
  );

  const homeWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!selectedTeam) warnings.push("no_active_team");
    if (!hasSeasonResultsForHome) warnings.push("season_started_no_results");
    if (activeViewContextWarning?.includes("keine abgeschlossenen")) warnings.push("no_final_standings");
    if (homeNextMatchdayStatus.openSlots > 0) warnings.push("missing_lineups");
    if (
      homeNextMatchdayStatus.openSlots === 0 &&
      !homeNextMatchdayStatus.resultAvailable &&
      !activeManagerLineupSubmitted
    ) {
      warnings.push("lineup_not_submitted");
    }
    if (homeNextMatchdayStatus.openSlots > 0 && !homeNextMatchdayStatus.hasFormCardPool) {
      warnings.push("formcard_pool_missing");
    } else if (
      homeNextMatchdayStatus.openSlots === 0 &&
      homeNextMatchdayStatus.hasFormCardPool &&
      !homeNextMatchdayStatus.hasFormCards &&
      !homeNextMatchdayStatus.resultAvailable
    ) {
      warnings.push("formcards_assignment_optional");
    }
    if (activeManagerTeamId) {
      const formCardAudit = buildFormCardSeasonUsageAudit(gameState, gameState.season.id).rows.find(
        (row) => row.teamId === activeManagerTeamId,
      );
      if ((formCardAudit?.unusedNegativeCards ?? 0) > 0) {
        warnings.push("unused_negative_formcards");
      }
    }
    if (
      (gameState.scenarioMeta?.scenarioType ?? activeContextMeta?.scenarioType ?? "").includes("manager_multiplayer") &&
      !activeContextMeta?.roomId
    ) {
      warnings.push("room_not_connected");
    }
    return Array.from(new Set(warnings));
  }, [
    activeContextMeta?.roomId,
    activeContextMeta?.scenarioType,
    activeManagerTeamId,
    activeViewContextWarning,
    gameState,
    gameState.scenarioMeta?.scenarioType,
    gameState.season.id,
    hasSeasonResultsForHome,
    homeNextMatchdayStatus.hasFormCardPool,
    homeNextMatchdayStatus.hasFormCards,
    homeNextMatchdayStatus.openSlots,
    activeManagerLineupSubmitted,
    selectedTeam,
  ]);

  const homePlayerCards = useMemo(
    () =>
      buildHomePlayerCardsFromRoster({
        gameState,
        selectedRosterTableRows,
        playerRatingsById,
        playerSeasonPerformanceMap,
      }),
    [gameState, playerRatingsById, playerSeasonPerformanceMap, selectedRosterTableRows],
  );

  const homeTasks = useMemo(() => {
    const severityOrder: Record<GameInboxItem["severity"], number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    return [...activeTeamDecisionInboxItems]
      .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
      .slice(0, 5);
  }, [activeTeamDecisionInboxItems]);

  const homeTodayCards = useMemo<HomeV2TodayCard[]>(
    () =>
      sortTodayCardsByUrgency([
        {
          key: "lineup",
          kicker: "Matchday",
          title: homeNextMatchdayStatus.openSlots > 0 ? `${homeNextMatchdayStatus.openSlots} Slots offen` : "Einsatz bereit",
          detail: homeNextMatchdayStatus.openSlots > 0 ? "Zuerst Einsatzliste füllen" : "Direkt in die Arena",
          tone: homeNextMatchdayStatus.openSlots > 0 ? "warning" : "ready",
        },
        {
          key: "tasks",
          kicker: "Entscheidungen",
          title: homeTasks.length > 0 ? `${homeTasks.length} offen` : "Alles erledigt",
          detail: homeTasks[0]?.title ?? "Bereit für den nächsten Zug",
          tone: homeTasks.some((task) => task.severity === "critical")
            ? "warning"
            : homeTasks.length > 0
              ? "info"
              : "ready",
        },
        {
          key: "team",
          kicker: "Saison",
          title: selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "Team prüfen",
          detail: selectedStandingRow?.points != null ? `${formatLocalePoints(selectedStandingRow.points, 1)} Punkte` : "Kader & Finanzen",
          tone: "info",
        },
      ]),
    [homeNextMatchdayStatus.openSlots, homeTasks, selectedStandingRow?.points, selectedStandingRow?.rank],
  );

  const homeV2Facilities = useMemo((): HomeV2FacilitySnapshot[] => {
    return HOME_V2_FACILITY_IDS.map((facilityId) => {
      const catalogEntry = FACILITY_CATALOG.find((entry) => entry.facilityId === facilityId);
      const level = getFacilityLevel(selectedTeamFacilityState, facilityId);
      return {
        facilityId,
        label: catalogEntry?.label ?? facilityId,
        level,
        maxLevel: catalogEntry?.maxLevel ?? 5,
      };
    });
  }, [selectedTeamFacilityState]);

  const homeV2TopPlayers = useMemo((): HomeV2TopPlayerCard[] => {
    return homePlayerCards.slice(0, 6).map((row, index) => {
      const rating = playerRatingsById.get(row.player.id) ?? null;
      const seasonPerformance = playerSeasonPerformanceMap.get(row.player.id) ?? null;
      const forecast = enableTopPlayerForecasts
        ? buildPlayerProgressionForecast({
            gameState,
            player: row.player,
            playerRating: rating,
            seasonPerformance,
            currentXP: row.player.currentXP ?? 0,
            spentXP: row.player.spentXP ?? 0,
            lifetimeXP: row.player.lifetimeXP ?? null,
          })
        : null;
      const developmentInsight = enableTopPlayerForecasts
        ? buildPlayerDevelopmentInsight({
            gameState,
            player: row.player,
            currentRating: forecast?.currentAbilityRating ?? rating?.ratingPps ?? rating?.ppsSeason ?? null,
            performanceRating: rating?.ratingPps ?? rating?.ppsSeason ?? null,
            scoutingLevel: 5,
            scoutPotential: forecast?.scoutPotential ?? null,
          })
        : null;
      return {
        playerId: row.player.id,
        name: row.player.name,
        portraitUrl: row.portrait.src,
        portraitPlaceholderUrl: row.portrait.previewSrc ?? row.portrait.thumbSrc,
        portraitInitials: row.portrait.initials,
        rosterRank: index + 1,
        playerOvr: row.playerOvr,
        playerPps: row.playerPps,
        playerMvs: row.playerMvs,
        pow: row.player.coreStats.pow,
        spe: row.player.coreStats.spe,
        men: row.player.coreStats.men,
        soc: row.player.coreStats.soc,
        contractLength: row.entry.contractLength ?? null,
        marketValue: row.marketValue,
        highlight: index === 0 ? ("top" as const) : null,
        ovrRank: rating?.ovrRank ?? null,
        mvsRank: rating?.mvsRank ?? null,
        ppsRank: rating?.ppsSeasonRank ?? null,
        caRating: developmentInsight?.currentRating ?? null,
        poRangeMin: developmentInsight?.potentialRangeDisplay?.min ?? null,
        poRangeMax: developmentInsight?.potentialRangeDisplay?.max ?? null,
      };
    });
  }, [enableTopPlayerForecasts, gameState, homePlayerCards, playerRatingsById, playerSeasonPerformanceMap]);

  const homeV2ScheduleItems = useMemo((): HomeV2ScheduleItem[] => {
    const currentIndex = gameState.season.matchdayIds.indexOf(gameState.matchdayState.matchdayId);
    return gameState.season.matchdayIds.slice(Math.max(0, currentIndex), currentIndex + 4).map((matchdayId, offset) => ({
      matchdayId,
      label: matchdayId,
      isCurrent: offset === 0,
      isPast: currentIndex >= 0 && gameState.season.matchdayIds.indexOf(matchdayId) < currentIndex,
    }));
  }, [gameState.matchdayState.matchdayId, gameState.season.matchdayIds]);

  const homeV2BoardObjectives = useMemo((): HomeV2BoardObjective[] => {
    if (!activeManagerTeamId) {
      return [];
    }
    return teamObjectives
      .filter((objective) => objective.teamId === activeManagerTeamId && objective.status !== "completed")
      .slice(0, 4)
      .map((objective) => ({
        objectiveId: objective.objectiveId,
        label: objective.label,
        status: objective.status,
        currentValue: objective.currentValue ?? null,
        targetValue: objective.targetValue ?? null,
      }));
  }, [activeManagerTeamId, teamObjectives]);

  const homeV2InboxItems = useMemo((): HomeV2InboxItem[] => {
    return homeTasks.map((item) => ({
      id: item.itemId,
      title: item.title,
      detail: item.description,
      severity: item.severity,
    }));
  }, [homeTasks]);

  return {
    homeWarnings,
    homeV2TopPlayers,
    homeV2Facilities,
    homeV2ScheduleItems,
    homeV2BoardObjectives,
    homeV2InboxItems,
    homeTodayCards,
  };
}
