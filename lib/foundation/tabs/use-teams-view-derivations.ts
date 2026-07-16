import { useEffect, useMemo, useState } from "react";

import type { Team } from "@/lib/data/olyDataTypes";
import type { FoundationTableSortState } from "@/lib/foundation/foundation-table-sort";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import {
  buildSelectedHqAxisSummary,
  buildSortedTeamsViewRows,
  buildTeamHistoryPointRankMaps,
  buildTeamHistorySeasonPointColumns,
  buildTeamsViewRows,
  buildTeamsViewSummary,
  EMPTY_TEAM_HISTORY_COLUMNS,
  EMPTY_TEAM_HISTORY_POINT_RANK_MAPS,
  EMPTY_TEAMS_VIEW_ROWS,
  resolveCurrentAreaRanksByTeamId,
  resolveShouldBuildTeamsOverviewTable,
  resolveShouldBuildTeamsPlayerRatings,
  shouldBuildTeamsView,
  type DisciplineRankRowInput,
  type SelectedHqAxisSummary,
  type TeamHistoryPointRankMaps,
  type TeamHistorySeasonPointColumn,
  type TeamsViewRow,
  type TeamsViewSummary,
} from "@/lib/foundation/tabs/teams-view-derivations";

export {
  resolveCurrentAreaRanksByTeamId,
  resolveShouldBuildTeamsOverviewTable,
  resolveShouldBuildTeamsPlayerRatings,
  resolveShouldBuildTeamsPortraitsTab,
  resolveShouldBuildTeamsRosterDerivations,
  resolveShouldBuildTeamsScopedRatings,
  shouldBuildTeamsView,
} from "@/lib/foundation/tabs/teams-view-derivations";

export type UseTeamsHydrationPhaseInput = {
  activeView: string;
  selectedTeamId: string | null;
  selectedTeamDetailTab: "roster" | "contracts" | "portraits";
  shouldBuildTeamContracts: boolean;
  shouldBuildExtendedTeamPanels: boolean;
};

export type UseTeamsHydrationPhaseResult = {
  shouldBuildTeamsView: boolean;
  shouldBuildTeamsOverviewTable: boolean;
  shouldBuildTeamsPlayerRatings: boolean;
  teamsHydrationPhase: "shell" | "full";
};

export function useTeamsHydrationPhase(input: UseTeamsHydrationPhaseInput): UseTeamsHydrationPhaseResult {
  const enabled = shouldBuildTeamsView(input.activeView);
  const shouldBuildTeamsOverviewTable = resolveShouldBuildTeamsOverviewTable(
    input.activeView,
    input.selectedTeamDetailTab,
  );
  const [teamsHydrationPhase, setTeamsHydrationPhase] = useState<"shell" | "full">("shell");

  useEffect(() => {
    if (!enabled) {
      setTeamsHydrationPhase("shell");
      return;
    }
    if (input.selectedTeamDetailTab !== "roster") {
      setTeamsHydrationPhase("full");
      return;
    }
    setTeamsHydrationPhase("shell");
    let cancelled = false;
    const finish = () => {
      if (!cancelled) {
        setTeamsHydrationPhase("full");
      }
    };
    if (typeof globalThis.requestIdleCallback === "function") {
      const idleId = globalThis.requestIdleCallback(finish, { timeout: 600 });
      return () => {
        cancelled = true;
        globalThis.cancelIdleCallback?.(idleId);
      };
    }
    const timerId = globalThis.setTimeout(finish, 600);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timerId);
    };
  }, [enabled, input.selectedTeamDetailTab, input.selectedTeamId]);

  const shouldBuildTeamsPlayerRatings = resolveShouldBuildTeamsPlayerRatings({
    activeView: input.activeView,
    teamsHydrationPhase,
    selectedTeamDetailTab: input.selectedTeamDetailTab,
    shouldBuildTeamContracts: input.shouldBuildTeamContracts,
    shouldBuildExtendedTeamPanels: input.shouldBuildExtendedTeamPanels,
  });

  return {
    shouldBuildTeamsView: enabled,
    shouldBuildTeamsOverviewTable,
    shouldBuildTeamsPlayerRatings,
    teamsHydrationPhase,
  };
}

export type UseTeamsViewRowDerivationsInput = {
  enabled: boolean;
  /** Shell phase mounts the panel first; defer 33-team row derivations until full hydration. */
  teamsHydrationPhase?: "shell" | "full";
  shouldBuildTeamsOverviewTable: boolean;
  selectedTeam: Team | null;
  seasonStandRows: TeamManagementSnapshotRow[];
  currentAreaRanksByTeamId: Map<
    string,
    {
      pow: number | null;
      spe: number | null;
      men: number | null;
      soc: number | null;
    }
  >;
  teamsViewSort: FoundationTableSortState | undefined;
};

export type UseTeamsViewRowDerivationsResult = {
  teamsViewRows: TeamsViewRow[];
  sortedTeamsViewRows: TeamsViewRow[];
  teamHistorySeasonPointColumns: TeamHistorySeasonPointColumn[];
  teamHistoryPointRankMaps: TeamHistoryPointRankMaps;
  teamsViewSummary: TeamsViewSummary | null;
  selectedHqAxisSummary: SelectedHqAxisSummary | null;
};

export function useTeamsViewRowDerivations(
  input: UseTeamsViewRowDerivationsInput,
): UseTeamsViewRowDerivationsResult {
  const buildHeavyRows =
    input.enabled && (input.teamsHydrationPhase == null || input.teamsHydrationPhase === "full");

  const teamsViewRows = useMemo(() => {
    if (!buildHeavyRows) {
      return EMPTY_TEAMS_VIEW_ROWS;
    }
    return buildTeamsViewRows({
      seasonStandRows: input.seasonStandRows,
      currentAreaRanksByTeamId: input.currentAreaRanksByTeamId,
    });
  }, [
    buildHeavyRows,
    buildHeavyRows ? input.currentAreaRanksByTeamId : null,
    buildHeavyRows ? input.seasonStandRows : null,
  ]);

  const sortedTeamsViewRows = useMemo(() => {
    if (!buildHeavyRows) {
      return EMPTY_TEAMS_VIEW_ROWS;
    }
    return buildSortedTeamsViewRows(teamsViewRows, input.teamsViewSort);
  }, [buildHeavyRows, buildHeavyRows ? input.teamsViewSort : null, teamsViewRows]);

  const teamHistorySeasonPointColumns = useMemo(() => {
    if (!buildHeavyRows || !input.shouldBuildTeamsOverviewTable) {
      return EMPTY_TEAM_HISTORY_COLUMNS;
    }
    return buildTeamHistorySeasonPointColumns(teamsViewRows);
  }, [buildHeavyRows, input.shouldBuildTeamsOverviewTable, buildHeavyRows ? teamsViewRows : null]);

  const teamHistoryPointRankMaps = useMemo(() => {
    if (!buildHeavyRows || !input.shouldBuildTeamsOverviewTable) {
      return EMPTY_TEAM_HISTORY_POINT_RANK_MAPS;
    }
    return buildTeamHistoryPointRankMaps(teamsViewRows, teamHistorySeasonPointColumns);
  }, [
    buildHeavyRows,
    input.shouldBuildTeamsOverviewTable,
    buildHeavyRows ? teamHistorySeasonPointColumns : null,
    buildHeavyRows ? teamsViewRows : null,
  ]);

  const teamsViewSummary = useMemo(() => {
    if (!buildHeavyRows) {
      return null;
    }
    return buildTeamsViewSummary({
      selectedTeam: input.selectedTeam,
      teamsViewRows,
      currentAreaRanksByTeamId: input.currentAreaRanksByTeamId,
    });
  }, [buildHeavyRows, input.currentAreaRanksByTeamId, input.selectedTeam, teamsViewRows]);

  const selectedHqAxisSummary = useMemo(
    () => (buildHeavyRows ? buildSelectedHqAxisSummary(teamsViewSummary) : null),
    [buildHeavyRows, teamsViewSummary],
  );

  return {
    teamsViewRows,
    sortedTeamsViewRows,
    teamHistorySeasonPointColumns,
    teamHistoryPointRankMaps,
    teamsViewSummary,
    selectedHqAxisSummary,
  };
}

export function useTeamsViewDerivations(
  input: UseTeamsHydrationPhaseInput &
    Omit<
      UseTeamsViewRowDerivationsInput,
      "enabled" | "shouldBuildTeamsOverviewTable" | "currentAreaRanksByTeamId"
    > & {
      activeView: string;
      shouldBuildDisciplineRanks: boolean;
      disciplineRankRows: DisciplineRankRowInput[];
      currentAreaRanksByTeamId: UseTeamsViewRowDerivationsInput["currentAreaRanksByTeamId"];
    },
) {
  const hydration = useTeamsHydrationPhase(input);
  const rows = useTeamsViewRowDerivations({
    enabled: hydration.shouldBuildTeamsView,
    teamsHydrationPhase: hydration.teamsHydrationPhase,
    shouldBuildTeamsOverviewTable: hydration.shouldBuildTeamsOverviewTable,
    selectedTeam: input.selectedTeam,
    seasonStandRows: input.seasonStandRows,
    currentAreaRanksByTeamId: input.currentAreaRanksByTeamId,
    teamsViewSort: input.teamsViewSort,
  });

  return {
    ...hydration,
    ...rows,
  };
}
