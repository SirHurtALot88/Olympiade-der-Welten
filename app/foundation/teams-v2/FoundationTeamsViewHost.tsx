"use client";

import { useLayoutEffect, useMemo } from "react";

import type { TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";
import FoundationTeamsDetailPanel, {
  type FoundationTeamsDetailPanelProps,
} from "@/app/foundation/teams-v2/FoundationTeamsDetailPanel";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { FoundationTableSortState } from "@/lib/foundation/foundation-table-sort";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { DisciplineRankRowInput } from "@/lib/foundation/tabs/teams-view-derivations";
import {
  resolveCurrentAreaRanksByTeamId,
  useTeamsHydrationPhase,
  useTeamsViewRowDerivations,
} from "@/lib/foundation/tabs/use-teams-view-derivations";
import {
  useTeamsPanelDerivations,
  type TeamsRosterPlayerPair,
  type UseTeamsPanelDerivationsInput,
} from "@/lib/foundation/tabs/use-teams-panel-derivations";
import { getTeamAxisRankTooltip, getTeamsViewColumnTitle } from "@/lib/foundation/tabs/teams-ui-helpers";
import {
  useTeamsRosterTableDerivations,
  type SelectedRosterTableRow,
  type TeamRosterFocusMode,
  type TeamRosterRoleFilter,
  type UseTeamsRosterTableDerivationsInput,
} from "@/lib/foundation/tabs/use-teams-roster-table-derivations";

type FoundationTeamsViewHostProps = Omit<
  FoundationTeamsDetailPanelProps,
  | "teamsHydrationPhase"
  | "sortedTeamsViewRows"
  | "teamHistoryPointRankMaps"
  | "sortedSelectedRosterTableRows"
  | "filteredSelectedRosterTableRows"
  | "teamRosterFocusOptions"
  | "teamRosterRoleFilterOptions"
  | "selectedTeamsHistoryData"
  | "teamEconomyTiles"
  | "gameState"
  | "tableSorts"
  | "starters"
  | "bench"
  | "visibleTeamsViewColumns"
  | "getTeamsViewColumnTitle"
  | "getTeamAxisRankTooltip"
> & {
  activeView: string;
  selectedTeamId: string | null;
  selectedTeam: Team;
  gameState: GameState;
  tableSorts: Record<string, FoundationTableSortState | undefined> & {
    selectedRoster?: FoundationTableSortState;
  };
  seasonStandRows: TeamManagementSnapshotRow[];
  shouldBuildDisciplineRanks: boolean;
  disciplineRankRows: DisciplineRankRowInput[];
  teamsViewSort: FoundationTableSortState | undefined;
  teamRosterFocusMode: TeamRosterFocusMode;
  teamRosterRoleFilter: TeamRosterRoleFilter;
  onHydrationPhaseChange: (phase: "shell" | "full") => void;
  rosterPlayers: TeamsRosterPlayerPair[];
  tableColumnPreferences: UseTeamsPanelDerivationsInput["tableColumnPreferences"];
  isTableColumnVisible: UseTeamsPanelDerivationsInput["isTableColumnVisible"];
  getTablePinnedLeftIds: UseTeamsPanelDerivationsInput["getTablePinnedLeftIds"];
  getTablePinnedRightIds: UseTeamsPanelDerivationsInput["getTablePinnedRightIds"];
  buildTeamDetailDrawerData: (
    resolvedTeamId: string | null,
    scope?: "full" | "history-summary",
    areaRanksByTeamId?: ReturnType<typeof resolveCurrentAreaRanksByTeamId>,
  ) => TeamDetailDrawerData | null;
  formatMoney: (value: number) => string;
  getRosterEntrySalarySortValue: (
    entry: { salary?: number | null },
    player?: unknown,
  ) => number | null;
};

export type { FoundationTeamsViewHostProps };

export default function FoundationTeamsViewHost({
  activeView,
  selectedTeamId,
  selectedTeam,
  seasonStandRows,
  shouldBuildDisciplineRanks,
  disciplineRankRows,
  teamsViewSort,
  selectedRosterTableRows,
  teamRosterFocusMode,
  teamRosterRoleFilter,
  onHydrationPhaseChange,
  buildTeamDetailDrawerData,
  formatMoney,
  shouldBuildTeamContracts,
  showExtendedTeamPanels,
  selectedTeamDetailTab,
  tableSorts,
  gameState,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntrySalarySortValue,
  getRosterEntrySalaryDelta,
  rosterPlayers,
  tableColumnPreferences,
  isTableColumnVisible,
  getTablePinnedLeftIds,
  getTablePinnedRightIds,
  playerRatingsById,
  ...panelProps
}: FoundationTeamsViewHostProps) {
  const {
    shouldBuildTeamsOverviewTable,
    teamsHydrationPhase,
  } = useTeamsHydrationPhase({
    activeView,
    selectedTeamId,
    selectedTeamDetailTab: selectedTeamDetailTab as "roster" | "contracts" | "portraits",
    shouldBuildTeamContracts: Boolean(shouldBuildTeamContracts),
    shouldBuildExtendedTeamPanels: Boolean(showExtendedTeamPanels),
  });

  useLayoutEffect(() => {
    onHydrationPhaseChange(teamsHydrationPhase);
  }, [onHydrationPhaseChange, teamsHydrationPhase]);

  const shouldBuildTeamsAreaRanks = teamsHydrationPhase === "full";
  const currentAreaRanksByTeamId = useMemo(
    () =>
      resolveCurrentAreaRanksByTeamId({
        activeView,
        shouldBuildTeamsView: shouldBuildTeamsAreaRanks,
        shouldBuildDisciplineRanks,
        disciplineRankRows,
        seasonStandRows,
      }),
    [activeView, disciplineRankRows, seasonStandRows, shouldBuildDisciplineRanks, shouldBuildTeamsAreaRanks],
  );

  const {
    sortedTeamsViewRows,
    teamHistoryPointRankMaps,
  } = useTeamsViewRowDerivations({
    enabled: true,
    teamsHydrationPhase,
    shouldBuildTeamsOverviewTable,
    selectedTeam,
    seasonStandRows,
    currentAreaRanksByTeamId,
    teamsViewSort,
  });

  const rosterDerivations = useTeamsRosterTableDerivations({
    selectedRosterTableRows: selectedRosterTableRows as SelectedRosterTableRow[],
    selectedRosterSort: tableSorts?.selectedRoster,
    disciplines: gameState.disciplines,
    gameState,
    teamRosterFocusMode,
    teamRosterRoleFilter,
    getRosterEntryDisplayMarketValue:
      getRosterEntryDisplayMarketValue as UseTeamsRosterTableDerivationsInput["getRosterEntryDisplayMarketValue"],
    getRosterEntryDisplaySalary:
      getRosterEntryDisplaySalary as UseTeamsRosterTableDerivationsInput["getRosterEntryDisplaySalary"],
    getRosterEntrySalarySortValue:
      getRosterEntrySalarySortValue as UseTeamsRosterTableDerivationsInput["getRosterEntrySalarySortValue"],
    getRosterEntrySalaryDelta:
      getRosterEntrySalaryDelta as UseTeamsRosterTableDerivationsInput["getRosterEntrySalaryDelta"],
  });

  const selectedTeamsHistoryData = useMemo<TeamDetailDrawerData | null>(() => {
    if (teamsHydrationPhase !== "full") {
      return null;
    }
    if (!shouldBuildTeamsOverviewTable && !showExtendedTeamPanels) {
      return null;
    }
    return buildTeamDetailDrawerData(selectedTeam.teamId, "history-summary", currentAreaRanksByTeamId);
  }, [
    buildTeamDetailDrawerData,
    currentAreaRanksByTeamId,
    selectedTeam.teamId,
    shouldBuildTeamsOverviewTable,
    showExtendedTeamPanels,
    teamsHydrationPhase,
  ]);

  const teamEconomyTiles = useMemo(() => {
    const data = selectedTeamsHistoryData;
    if (!data) {
      return [];
    }
    return [
      {
        label: "Gehalt",
        value: data.salaryTotal != null ? formatMoney(data.salaryTotal) : "—",
        note: `${data.rosterSize} Spieler`,
        detail: "Gesamtgehaltsblock des aktiven Kaders",
        tone: "salary" as const,
      },
      {
        label: "Marktwert",
        value: data.marketValueTotal != null ? formatMoney(data.marketValueTotal) : "—",
        note: data.cash != null ? `Cash ${formatMoney(data.cash)}` : "—",
        detail: "Team-Marktwert und Liquidität",
        tone: "value" as const,
      },
    ];
  }, [formatMoney, selectedTeamsHistoryData]);

  const { starters, bench, visibleTeamsViewColumns } = useTeamsPanelDerivations({
    showExtendedTeamPanels: Boolean(showExtendedTeamPanels),
    rosterPlayers,
    playerRatingsById,
    getRosterEntryDisplayMarketValue:
      getRosterEntryDisplayMarketValue as UseTeamsPanelDerivationsInput["getRosterEntryDisplayMarketValue"],
    tableColumnPreferences,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
  });

  return (
    <FoundationTeamsDetailPanel
      {...panelProps}
      active
      gameState={gameState}
      selectedTeam={selectedTeam}
      shouldBuildTeamContracts={shouldBuildTeamContracts}
      showExtendedTeamPanels={showExtendedTeamPanels}
      selectedTeamDetailTab={selectedTeamDetailTab}
      tableSorts={tableSorts}
      selectedRosterTableRows={selectedRosterTableRows}
      teamRosterFocusMode={teamRosterFocusMode}
      teamRosterRoleFilter={teamRosterRoleFilter}
      getRosterEntryDisplayMarketValue={getRosterEntryDisplayMarketValue}
      getRosterEntryDisplaySalary={getRosterEntryDisplaySalary}
      getRosterEntrySalaryDelta={getRosterEntrySalaryDelta}
      formatMoney={formatMoney}
      teamsHydrationPhase={teamsHydrationPhase}
      sortedTeamsViewRows={sortedTeamsViewRows}
      teamHistoryPointRankMaps={teamHistoryPointRankMaps}
      sortedSelectedRosterTableRows={rosterDerivations.sortedSelectedRosterTableRows}
      filteredSelectedRosterTableRows={rosterDerivations.filteredSelectedRosterTableRows}
      teamRosterFocusOptions={rosterDerivations.teamRosterFocusOptions}
      teamRosterRoleFilterOptions={rosterDerivations.teamRosterRoleFilterOptions}
      selectedTeamsHistoryData={selectedTeamsHistoryData}
      teamEconomyTiles={teamEconomyTiles}
      starters={starters}
      bench={bench}
      visibleTeamsViewColumns={visibleTeamsViewColumns}
      getTeamsViewColumnTitle={getTeamsViewColumnTitle}
      getTeamAxisRankTooltip={getTeamAxisRankTooltip}
    />
  );
}
