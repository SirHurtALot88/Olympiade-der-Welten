"use client";

import type { GameInboxItem, GameState, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { formatCockpitReason, formatHomeWarningLabel, getGameFlowStatusLabel } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import {
  formatTeamControlModeLabel,
  type HomeV2RosterTableRow,
} from "@/lib/foundation/tabs/home-v2-ui-helpers";
import {
  useHomeV2OverviewDerivations,
  type HomeV2NextMatchdayStatus,
} from "@/lib/foundation/tabs/use-home-v2-overview-derivations";
import type { ManagerOfficeClientProps } from "@/app/foundation/home-v2/ManagerOfficeClient";
import FoundationHomeV2Panel from "@/app/foundation/home-v2/FoundationHomeV2Panel";
import type { GameFlowStepStatus } from "@/lib/foundation/game-flow-controller";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { SeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";

type TeamObjective = {
  teamId: string;
  objectiveId: string;
  label: string;
  status: string;
  currentValue?: string | number | boolean | null;
  targetValue?: string | number | boolean | null;
};

export type FoundationHomeV2HostProps = {
  tab: "overview" | "office";
  gameState: GameState;
  seasonStandRows: TeamManagementSnapshotRow[];
  selectedRosterTableRows: HomeV2RosterTableRow[];
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  playerSeasonPerformanceMap: Map<string, PlayerSeasonPerformanceSummary | null>;
  selectedStandingRow: TeamManagementSnapshotRow | null;
  selectedTeam: Team | null;
  selectedTeamControl: TeamControlSettings | null;
  selectedTeamFacilityState: Parameters<typeof useHomeV2OverviewDerivations>[0]["selectedTeamFacilityState"];
  activeManagerTeamId: string | null;
  activeTeamDecisionInboxItems: GameInboxItem[];
  activeTeamDecisionCriticalInboxItems: GameInboxItem[];
  teamObjectives: TeamObjective[];
  activeViewContextWarning: string | null;
  activeContextMeta: { roomId?: string | null; scenarioType?: string | null } | null;
  homeNextMatchdayStatus: HomeV2NextMatchdayStatus & ManagerOfficeClientProps["homeNextMatchdayStatus"];
  activeManagerLineupSubmitted: boolean;
  enableTopPlayerForecasts?: boolean;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  currentMatchdayDisplayLabel: string;
  activeOwnerLabel: string | null;
  selectedHqGmStory: ManagerOfficeClientProps["selectedHqGmStory"];
  selectedBoardConfidence: ManagerOfficeClientProps["selectedBoardConfidence"];
  globalNextLabel: string;
  gameFlowActionStep: {
    status: GameFlowStepStatus;
    blockers: string[];
    warnings: string[];
  };
  triggerGlobalNext: () => void;
  navigateHomeTab: (tab: "overview" | "office") => void;
  onNavigateView: (view: FoundationViewId) => void;
  scrollToFoundationTarget: (target: string) => void;
  openPlayerDrawerById: (playerId: string) => void;
  office: Omit<
    ManagerOfficeClientProps,
    | "homeNextMatchdayStatus"
    | "selectedStandingRow"
    | "activeTeamOpenInboxItems"
    | "activeTeamCriticalInboxItems"
    | "selectedRosterTableRows"
    | "selectedTeam"
    | "selectedTeamControl"
    | "homeActiveTeamLogo"
    | "gameState"
    | "currentMatchdayDisplayLabel"
    | "onNavigate"
    | "onOpenTeam"
    | "onNavigateInboxItem"
    | "seasonReadinessChecklist"
  > & {
    seasonReadinessChecklist: SeasonReadinessChecklist | null;
    onNavigate: ManagerOfficeClientProps["onNavigate"];
    onOpenTeam: ManagerOfficeClientProps["onOpenTeam"];
    onNavigateInboxItem: ManagerOfficeClientProps["onNavigateInboxItem"];
  };
};

/**
 * Home V2 host (Strangler Phase 5.3). Mounts overview derivations and panel
 * wiring only while the Home V2 tab is active.
 */
export default function FoundationHomeV2Host({
  tab,
  gameState,
  seasonStandRows,
  selectedRosterTableRows,
  playerRatingsById,
  playerSeasonPerformanceMap,
  selectedStandingRow,
  selectedTeam,
  selectedTeamControl,
  selectedTeamFacilityState,
  activeManagerTeamId,
  activeTeamDecisionInboxItems,
  activeTeamDecisionCriticalInboxItems,
  teamObjectives,
  activeViewContextWarning,
  activeContextMeta,
  homeNextMatchdayStatus,
  activeManagerLineupSubmitted,
  enableTopPlayerForecasts = true,
  leaguePlayerHeatPools,
  currentMatchdayDisplayLabel,
  activeOwnerLabel,
  selectedHqGmStory,
  selectedBoardConfidence,
  globalNextLabel,
  gameFlowActionStep,
  triggerGlobalNext,
  navigateHomeTab,
  onNavigateView,
  scrollToFoundationTarget,
  openPlayerDrawerById,
  office,
}: FoundationHomeV2HostProps) {
  const overviewDerivations = useHomeV2OverviewDerivations({
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
    enableTopPlayerForecasts,
  });

  const homeActiveTeamLogo = selectedTeam ? getTeamLogoModel(selectedTeam, { variant: "thumb" }) : null;

  return (
    <FoundationHomeV2Panel
      active
      tab={tab}
      overview={{
        teamName: selectedTeam?.name ?? "Kein Team",
        teamCode: selectedTeam?.shortCode ?? "—",
        teamLogoUrl: homeActiveTeamLogo?.src ?? null,
        teamLogoInitials: homeActiveTeamLogo?.initials ?? selectedTeam?.shortCode ?? "?",
        seasonName: gameState.season.name,
        matchdayLabel: currentMatchdayDisplayLabel,
        managerLabel: activeOwnerLabel ?? "—",
        controlModeLabel: formatTeamControlModeLabel(selectedTeamControl?.controlMode),
        rank: selectedStandingRow?.rank ?? null,
        points: selectedStandingRow?.points ?? null,
        cash: selectedStandingRow?.cash ?? null,
        salaryTotal: selectedStandingRow?.salaryTotal ?? null,
        guv: selectedStandingRow?.guv ?? null,
        rosterCount: selectedRosterTableRows.length,
        gmStoryLabel: selectedHqGmStory?.label ?? null,
        gmStoryDetail: selectedHqGmStory?.detail ?? null,
        gmStoryTone: selectedHqGmStory?.tone ?? null,
        boardPressure: selectedBoardConfidence?.pressure ?? null,
        boardRating: selectedBoardConfidence?.value ?? null,
        boardObjectives: overviewDerivations.homeV2BoardObjectives,
        nextStepLabel: globalNextLabel,
        nextStepStatus: getGameFlowStatusLabel(gameFlowActionStep.status),
        nextStepDetail:
          gameFlowActionStep.blockers[0]
            ? formatCockpitReason(gameFlowActionStep.blockers[0])
            : gameFlowActionStep.warnings[0]
              ? formatCockpitReason(gameFlowActionStep.warnings[0])
              : "Flow bereit — weiter zum nächsten Schritt.",
        nextStepBlocked:
          gameFlowActionStep.blockers.length > 0 || gameFlowActionStep.warnings.length > 0,
        warnings: overviewDerivations.homeWarnings.map(formatHomeWarningLabel),
        topPlayers: overviewDerivations.homeV2TopPlayers,
        leagueHeatPools: leaguePlayerHeatPools,
        facilities: overviewDerivations.homeV2Facilities,
        scheduleItems: overviewDerivations.homeV2ScheduleItems,
        inboxItems: overviewDerivations.homeV2InboxItems,
        inboxCriticalCount: activeTeamDecisionCriticalInboxItems.length,
        todayCards: overviewDerivations.homeTodayCards,
        onContinue: triggerGlobalNext,
        onOpenTeams: () => onNavigateView("teams"),
        onOpenLineup: () => onNavigateView("lineup"),
        onOpenMarket: () => onNavigateView("marketV2"),
        onOpenTraining: () => onNavigateView("trainingCompact"),
        onOpenOffice: () => navigateHomeTab("office"),
        onOpenFacilities: () => onNavigateView("facilitiesOverviewV2"),
        onOpenSeason: () => onNavigateView("seasonV2"),
        onOpenInbox: () => onNavigateView("inboxV2"),
        onOpenBoardObjectives: () => {
          onNavigateView("teams");
          scrollToFoundationTarget("team-board-objectives");
        },
        onOpenPlayer: openPlayerDrawerById,
      }}
      office={{
        ...office,
        homeNextMatchdayStatus,
        selectedStandingRow,
        activeTeamOpenInboxItems: activeTeamDecisionInboxItems,
        activeTeamCriticalInboxItems: activeTeamDecisionCriticalInboxItems,
        selectedRosterTableRows,
        selectedTeam,
        selectedTeamControl,
        homeActiveTeamLogo,
        gameState,
        currentMatchdayDisplayLabel,
      }}
    />
  );
}
