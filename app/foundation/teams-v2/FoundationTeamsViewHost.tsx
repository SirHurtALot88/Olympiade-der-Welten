"use client";

import { useMemo } from "react";

import type { TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";
import FoundationTeamsDetailPanel, {
  type FoundationTeamsDetailPanelProps,
} from "@/app/foundation/teams-v2/FoundationTeamsDetailPanel";
import FoundationTeamsNewLook, {
  type FoundationTeamsNewLookProps,
} from "@/app/foundation/teams-v2/FoundationTeamsNewLook";
import { useNewLook } from "@/lib/ui/new-look-preference";
import type { GameState, Player, RosterEntry, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
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
import { useTeamsContractDerivations } from "@/lib/foundation/tabs/use-teams-contract-derivations";
import { useTeamsExtendedPanelDerivations } from "@/lib/foundation/tabs/use-teams-extended-panel-derivations";
import { buildOrderedFoundationDisciplines, getTeamAxisRankTooltip, getTeamsViewColumnTitle } from "@/lib/foundation/tabs/teams-ui-helpers";
import {
  useTeamsRosterTableDerivations,
  type SelectedRosterTableRow,
  type TeamRosterFocusMode,
  type TeamRosterRoleFilter,
  type UseTeamsRosterTableDerivationsInput,
} from "@/lib/foundation/tabs/use-teams-roster-table-derivations";

type FoundationTeamsViewHostProps = Omit<
  FoundationTeamsDetailPanelProps,
  | "active"
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
  | "visibleSelectedRosterColumns"
  | "selectedTeamContractTable"
  | "selectedTeamContractShapeMix"
  | "selectedTeamContractPreviewRowCount"
  | "visibleSelectedTeamContractRows"
  | "freeAgents"
  | "aiPreview"
  | "selectedAiTeamId"
  | "aiMarketPreview"
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
    entry: Pick<RosterEntry, "salary">,
    player?: Player | null,
  ) => number;
  aiTeams: Team[];
  selectedTeamControl: TeamControlSettings | null | undefined;
  showTeamContractPreviewRows: boolean;
  showSelectedRosterPpsBreakdown: boolean;
  showTeamDisciplines: boolean;
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
  buildTeamDetailDrawerData,
  formatMoney,
  shouldBuildTeamContracts,
  showExtendedTeamPanels,
  selectedTeamDetailTab,
  tableSorts,
  gameState,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntrySalarySortValue,
  getRosterEntrySalaryDelta,
  rosterPlayers,
  tableColumnPreferences,
  isTableColumnVisible,
  getTablePinnedLeftIds,
  getTablePinnedRightIds,
  playerRatingsById,
  aiTeams,
  selectedTeamControl,
  showTeamContractPreviewRows,
  showSelectedRosterPpsBreakdown,
  showTeamDisciplines,
  ...panelProps
}: FoundationTeamsViewHostProps) {
  // "Neuer Look" Flag (additiv): entscheidet erst ganz unten am Return,
  // welche Ansicht gerendert wird — alle Hooks laufen unverändert.
  const [newLook] = useNewLook();

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
    // Bridges the strict RosterEntry/Player-based helper onto the looser row-shaped
    // signature this internal hook expects; the row's entry/player always carry the
    // fields the helper reads (salary, id, economy inputs) at runtime.
    getRosterEntrySalarySortValue: getRosterEntrySalarySortValue as unknown as UseTeamsRosterTableDerivationsInput["getRosterEntrySalarySortValue"],
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

  const orderedDisciplines = useMemo(
    () => buildOrderedFoundationDisciplines(gameState.disciplines),
    [gameState.disciplines],
  );

  const contractDerivations = useTeamsContractDerivations({
    enabled: Boolean(shouldBuildTeamContracts),
    gameState,
    selectedTeam,
    showTeamContractPreviewRows,
  });

  const extendedPanelDerivations = useTeamsExtendedPanelDerivations({
    enabled: Boolean(showExtendedTeamPanels),
    gameState,
    selectedTeam,
    selectedTeamControl,
    aiTeams,
    playerRatingsById,
  });

  const { starters, bench, visibleTeamsViewColumns, visibleSelectedRosterColumns } = useTeamsPanelDerivations({
    showExtendedTeamPanels: Boolean(showExtendedTeamPanels),
    rosterPlayers,
    playerRatingsById,
    getRosterEntryDisplayMarketValue:
      getRosterEntryDisplayMarketValue as UseTeamsPanelDerivationsInput["getRosterEntryDisplayMarketValue"],
    tableColumnPreferences,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    orderedDisciplines,
    showSelectedRosterPpsBreakdown,
    showTeamDisciplines,
  });

  // "Neuer Look" Gate: nur für die Sub-Tabs "roster"/"portraits" — Verträge
  // und Transfer laufen weiterhin über das bestehende Panel. Flag aus =>
  // exakt der bisherige Render-Pfad (Zeilen darunter unverändert).
  if (newLook && (selectedTeamDetailTab === "roster" || selectedTeamDetailTab === "portraits")) {
    return (
      <FoundationTeamsNewLook
        selectedTeam={selectedTeam}
        gameState={gameState}
        sortedTeamsViewRows={sortedTeamsViewRows}
        selectedTeamsHistoryData={selectedTeamsHistoryData}
        filteredSelectedRosterTableRows={
          rosterDerivations.filteredSelectedRosterTableRows as unknown as FoundationTeamsNewLookProps["filteredSelectedRosterTableRows"]
        }
        teamRosterRoleFilter={teamRosterRoleFilter}
        setTeamRosterRoleFilter={panelProps.setTeamRosterRoleFilter as FoundationTeamsNewLookProps["setTeamRosterRoleFilter"]}
        teamRosterRoleFilterOptions={
          rosterDerivations.teamRosterRoleFilterOptions as FoundationTeamsNewLookProps["teamRosterRoleFilterOptions"]
        }
        teamRosterFocusMode={teamRosterFocusMode}
        setTeamRosterFocusMode={panelProps.setTeamRosterFocusMode as FoundationTeamsNewLookProps["setTeamRosterFocusMode"]}
        teamRosterFocusOptions={
          rosterDerivations.teamRosterFocusOptions as FoundationTeamsNewLookProps["teamRosterFocusOptions"]
        }
        leaguePlayerHeatPools={panelProps.leaguePlayerHeatPools as FoundationTeamsNewLookProps["leaguePlayerHeatPools"]}
        openTeamProfileById={panelProps.openTeamProfileById as FoundationTeamsNewLookProps["openTeamProfileById"]}
        openPlayerDrawerById={panelProps.openPlayerDrawerById as FoundationTeamsNewLookProps["openPlayerDrawerById"]}
        scheduleActiveManagerTeam={
          panelProps.scheduleActiveManagerTeam as FoundationTeamsNewLookProps["scheduleActiveManagerTeam"]
        }
        getPlayerPortraitModel={panelProps.getPlayerPortraitModel as FoundationTeamsNewLookProps["getPlayerPortraitModel"]}
        getRosterEntryDisplayMarketValue={
          getRosterEntryDisplayMarketValue as FoundationTeamsNewLookProps["getRosterEntryDisplayMarketValue"]
        }
        getRosterEntryDisplaySalary={
          getRosterEntryDisplaySalary as FoundationTeamsNewLookProps["getRosterEntryDisplaySalary"]
        }
        getRosterEntryCurrentSeasonSalary={
          getRosterEntryCurrentSeasonSalary as FoundationTeamsNewLookProps["getRosterEntryCurrentSeasonSalary"]
        }
        getPlayerDisplayMarketValueDelta={
          panelProps.getPlayerDisplayMarketValueDelta as FoundationTeamsNewLookProps["getPlayerDisplayMarketValueDelta"]
        }
        getRosterEntrySalaryDelta={getRosterEntrySalaryDelta as FoundationTeamsNewLookProps["getRosterEntrySalaryDelta"]}
        formatMoney={formatMoney}
        formatDisplayMoney={panelProps.formatDisplayMoney as FoundationTeamsNewLookProps["formatDisplayMoney"]}
        selectedTeamRosterActionsAvailable={Boolean(panelProps.selectedTeamRosterActionsAvailable)}
        selectedTeamRosterActionHint={
          panelProps.selectedTeamRosterActionHint as FoundationTeamsNewLookProps["selectedTeamRosterActionHint"]
        }
        marketSellBusy={panelProps.marketSellBusy ?? false}
        contractRenewalBusy={panelProps.contractRenewalBusy as FoundationTeamsNewLookProps["contractRenewalBusy"]}
        openMarketSellModal={panelProps.openMarketSellModal as FoundationTeamsNewLookProps["openMarketSellModal"]}
        openContractRenewalNegotiation={
          panelProps.openContractRenewalNegotiation as FoundationTeamsNewLookProps["openContractRenewalNegotiation"]
        }
      />
    );
  }

  return (
    <FoundationTeamsDetailPanel
      {...panelProps}
      {...contractDerivations}
      {...extendedPanelDerivations}
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
      getRosterEntryCurrentSeasonSalary={getRosterEntryCurrentSeasonSalary}
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
      visibleSelectedRosterColumns={visibleSelectedRosterColumns}
      getTeamsViewColumnTitle={getTeamsViewColumnTitle}
      getTeamAxisRankTooltip={getTeamAxisRankTooltip}
      playerRatingsById={playerRatingsById}
      selectedTeamControl={selectedTeamControl}
      showTeamDisciplines={showTeamDisciplines}
      showSelectedRosterPpsBreakdown={showSelectedRosterPpsBreakdown}
      showTeamContractPreviewRows={showTeamContractPreviewRows}
    />
  );
}
