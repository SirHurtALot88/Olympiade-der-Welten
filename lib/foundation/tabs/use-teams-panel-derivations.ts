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

  return {
    starters,
    bench,
    visibleTeamsViewColumns,
  };
}
