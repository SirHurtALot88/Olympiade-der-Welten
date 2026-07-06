import { useMemo } from "react";

import type { Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type { FoundationTableColumn } from "@/lib/foundation/tabs/cockpit-types";
import { compareTeamRosterPlayersByOvrOrMarketValue } from "@/lib/foundation/team-roster-player-sort";
import { TEAMS_VIEW_COLUMNS } from "@/lib/foundation/tabs/teams-ui-helpers";

function uniqueColumnIds(columnIds: string[]) {
  return [...new Set(columnIds.filter(Boolean))];
}

function applyStoredColumnOrder(
  columns: FoundationTableColumn[],
  columnOrder?: string[],
  pinnedLeft?: string[],
  pinnedRight?: string[],
) {
  const orderIndex = new Map((columnOrder ?? []).map((columnId, index) => [columnId, index]));
  const baseColumns = [...columns].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex == null && rightIndex == null) {
      return columns.findIndex((column) => column.id === left.id) - columns.findIndex((column) => column.id === right.id);
    }
    if (leftIndex == null) {
      return 1;
    }
    if (rightIndex == null) {
      return -1;
    }
    return leftIndex - rightIndex;
  });

  const columnById = new Map(baseColumns.map((column) => [column.id, column]));
  const leftPinnedColumns = uniqueColumnIds(pinnedLeft ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const rightPinnedColumns = uniqueColumnIds(pinnedRight ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const handled = new Set([...leftPinnedColumns, ...rightPinnedColumns].map((column) => column.id));
  const middleColumns = baseColumns.filter((column) => !handled.has(column.id));

  return [...leftPinnedColumns, ...middleColumns, ...rightPinnedColumns];
}

export type TeamsRosterPlayerPair = {
  entry: RosterEntry;
  player: Player;
};

export type UseTeamsPanelDerivationsInput = {
  showExtendedTeamPanels: boolean;
  rosterPlayers: TeamsRosterPlayerPair[];
  playerRatingsById: Map<
    string,
    {
      ovrNormalized?: number | null;
      mvs?: number | null;
    }
  >;
  getRosterEntryDisplayMarketValue: (entry: RosterEntry, player: Player) => number | null;
  tableColumnPreferences: Record<string, { columnOrder?: string[] } | undefined>;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
  orderedDisciplines?: Array<{ id: string; name: string }>;
  showSelectedRosterPpsBreakdown?: boolean;
  showTeamDisciplines?: boolean;
};

/**
 * Teams panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationTeamsViewHost` is mounted (`activeView === "teams"`).
 */
export function useTeamsPanelDerivations(input: UseTeamsPanelDerivationsInput) {
  const rosterPlayersByOvr = useMemo(
    () =>
      [...input.rosterPlayers].sort((left, right) => {
        const leftRating = input.playerRatingsById.get(left.player.id);
        const rightRating = input.playerRatingsById.get(right.player.id);
        return compareTeamRosterPlayersByOvrOrMarketValue({
          left: {
            ovr: leftRating?.ovrNormalized,
            marketValue: input.getRosterEntryDisplayMarketValue(left.entry, left.player),
            mvs: leftRating?.mvs,
            name: left.player.name,
          },
          right: {
            ovr: rightRating?.ovrNormalized,
            marketValue: input.getRosterEntryDisplayMarketValue(right.entry, right.player),
            mvs: rightRating?.mvs,
            name: right.player.name,
          },
        });
      }),
    [input.getRosterEntryDisplayMarketValue, input.playerRatingsById, input.rosterPlayers],
  );

  const starters = useMemo(
    () =>
      input.showExtendedTeamPanels
        ? rosterPlayersByOvr.filter((item) => item.entry.roleTag === "starter")
        : [],
    [input.showExtendedTeamPanels, rosterPlayersByOvr],
  );

  const bench = useMemo(
    () =>
      input.showExtendedTeamPanels
        ? rosterPlayersByOvr.filter((item) => item.entry.roleTag !== "starter")
        : [],
    [input.showExtendedTeamPanels, rosterPlayersByOvr],
  );

  const visibleTeamsViewColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        TEAMS_VIEW_COLUMNS,
        input.tableColumnPreferences.teamsView?.columnOrder,
        input.getTablePinnedLeftIds("teamsView"),
        input.getTablePinnedRightIds("teamsView"),
      ).filter((column) => input.isTableColumnVisible("teamsView", column.id, column.visibleByDefault)),
    [
      input.getTablePinnedLeftIds,
      input.getTablePinnedRightIds,
      input.isTableColumnVisible,
      input.tableColumnPreferences,
    ],
  );

  const selectedRosterColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "image", label: "Bild", dataKey: "image", defaultWidth: 96, minWidth: 80 },
      { id: "name", label: "Name", dataKey: "name", defaultWidth: 220, minWidth: 170 },
      { id: "class", label: "Klasse", dataKey: "class", defaultWidth: 130, minWidth: 110 },
      { id: "race", label: "Rasse", dataKey: "race", defaultWidth: 120, minWidth: 96 },
      { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 110, minWidth: 90 },
      { id: "salePrice", label: "VK", dataKey: "salePrice", defaultWidth: 104, minWidth: 86 },
      { id: "saleFactor", label: "Faktor", dataKey: "saleFactor", defaultWidth: 84, minWidth: 72 },
      { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 110, minWidth: 90 },
      { id: "value", label: "Value", dataKey: "value", defaultWidth: 96, minWidth: 78 },
      { id: "contract", label: "LZ", dataKey: "contract", defaultWidth: 76, minWidth: 64 },
      { id: "ovr", label: "OVR", dataKey: "ovr", defaultWidth: 90, minWidth: 72 },
      { id: "mvs", label: "MVS", dataKey: "mvs", defaultWidth: 90, minWidth: 72 },
      { id: "pps", label: "PPs", dataKey: "pps", defaultWidth: 90, minWidth: 72 },
      ...(input.showSelectedRosterPpsBreakdown
        ? [
            { id: "ppPow", label: "PP POW", dataKey: "ppPow", defaultWidth: 78, minWidth: 66 },
            { id: "ppSpe", label: "PP SPE", dataKey: "ppSpe", defaultWidth: 78, minWidth: 66 },
            { id: "ppMen", label: "PP MEN", dataKey: "ppMen", defaultWidth: 78, minWidth: 66 },
            { id: "ppSoc", label: "PP SOC", dataKey: "ppSoc", defaultWidth: 78, minWidth: 66 },
          ]
        : []),
      { id: "pow", label: "POW", dataKey: "pow", defaultWidth: 74, minWidth: 60 },
      { id: "spe", label: "SPE", dataKey: "spe", defaultWidth: 74, minWidth: 60 },
      { id: "men", label: "MEN", dataKey: "men", defaultWidth: 74, minWidth: 60 },
      { id: "soc", label: "SOC", dataKey: "soc", defaultWidth: 74, minWidth: 60 },
      ...(input.showTeamDisciplines
        ? (input.orderedDisciplines ?? []).map((discipline) => ({
            id: discipline.id,
            label: discipline.name.slice(0, 3).toUpperCase(),
            dataKey: discipline.id,
            defaultWidth: 82,
            minWidth: 68,
          }))
        : []),
    ],
    [input.orderedDisciplines, input.showSelectedRosterPpsBreakdown, input.showTeamDisciplines],
  );

  const visibleSelectedRosterColumns = useMemo(
    () => {
      const orderedColumns = applyStoredColumnOrder(
        selectedRosterColumns,
        input.tableColumnPreferences.selectedRosterTable?.columnOrder,
        input.getTablePinnedLeftIds("selectedRosterTable"),
        input.getTablePinnedRightIds("selectedRosterTable"),
      ).filter((column) =>
        input.isTableColumnVisible("selectedRosterTable", column.id, column.visibleByDefault),
      );
      const breakdownColumnIds = new Set(["ppPow", "ppSpe", "ppMen", "ppSoc"]);
      const breakdownColumns = orderedColumns.filter((column) => breakdownColumnIds.has(column.id));
      if (breakdownColumns.length === 0) {
        return orderedColumns;
      }
      const baseColumns = orderedColumns.filter((column) => !breakdownColumnIds.has(column.id));
      const ppsIndex = baseColumns.findIndex((column) => column.id === "pps");
      if (ppsIndex === -1) {
        return orderedColumns;
      }
      return [
        ...baseColumns.slice(0, ppsIndex + 1),
        ...breakdownColumns,
        ...baseColumns.slice(ppsIndex + 1),
      ];
    },
    [
      input.getTablePinnedLeftIds,
      input.getTablePinnedRightIds,
      input.isTableColumnVisible,
      input.tableColumnPreferences,
      selectedRosterColumns,
    ],
  );

  return {
    starters,
    bench,
    visibleTeamsViewColumns,
    visibleSelectedRosterColumns,
  };
}
