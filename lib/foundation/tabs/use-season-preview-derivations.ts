import { useMemo } from "react";

import type { FoundationStandingsPreviewResponse } from "@/lib/foundation/tabs/cockpit-types";
import type { FoundationTableColumn, SortState } from "@/lib/foundation/tabs/cockpit-types";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";

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

  const pinnedLeftSet = new Set(pinnedLeft ?? []);
  const pinnedRightSet = new Set(pinnedRight ?? []);
  const leftPinned = baseColumns.filter((column) => pinnedLeftSet.has(column.id));
  const rightPinned = baseColumns.filter((column) => pinnedRightSet.has(column.id));
  const middle = baseColumns.filter((column) => !pinnedLeftSet.has(column.id) && !pinnedRightSet.has(column.id));

  return [...leftPinned, ...middle, ...rightPinned];
}

const STANDINGS_PREVIEW_COLUMNS: FoundationTableColumn[] = [
  { id: "team", label: "Team", dataKey: "team", defaultWidth: 220, minWidth: 170 },
  { id: "currentPoints", label: "Aktuelle Punkte", dataKey: "currentPoints", defaultWidth: 120, minWidth: 100 },
  { id: "matchdayScore", label: "Matchday Score", dataKey: "matchdayScore", defaultWidth: 120, minWidth: 100 },
  { id: "matchdayRank", label: "Matchday Rang", dataKey: "matchdayRank", defaultWidth: 110, minWidth: 90 },
  { id: "pointsDelta", label: "Punkte Delta", dataKey: "pointsDelta", defaultWidth: 110, minWidth: 90 },
  { id: "projectedPoints", label: "Punkte nachher", dataKey: "projectedPoints", defaultWidth: 120, minWidth: 100 },
  { id: "projectedRank", label: "Preview Rang", dataKey: "projectedRank", defaultWidth: 110, minWidth: 90 },
  { id: "currentRank", label: "Aktueller Rang", dataKey: "currentRank", defaultWidth: 110, minWidth: 90, visibleByDefault: false },
  { id: "resultStatus", label: "Result Status", dataKey: "resultStatus", defaultWidth: 140, minWidth: 120 },
  { id: "d1Score", label: "D1", dataKey: "d1Score", defaultWidth: 90, minWidth: 72, visibleByDefault: false },
  { id: "d2Score", label: "D2", dataKey: "d2Score", defaultWidth: 90, minWidth: 72, visibleByDefault: false },
  { id: "cash", label: "Cash", dataKey: "cash", defaultWidth: 110, minWidth: 90, visibleByDefault: false },
  { id: "readinessStatus", label: "Readiness", dataKey: "readinessStatus", defaultWidth: 140, minWidth: 120, visibleByDefault: false },
  { id: "warnings", label: "Warnings", dataKey: "warnings", defaultWidth: 260, minWidth: 180 },
];

export type StandingsPreviewRow = FoundationStandingsPreviewResponse["items"][number];

export interface UseSeasonPreviewDerivationsInput {
  standingsPreviewFeed: FoundationStandingsPreviewResponse | null;
  tableColumnPreferences: {
    standingsPreviewTable?: { columnOrder?: string[] };
  };
  standingsPreviewSort: SortState;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault: boolean) => boolean;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
}

/**
 * Season preview panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationSeasonPreviewShellHost` is mounted (`activeView === "seasonPreview"`).
 */
export function useSeasonPreviewDerivations(input: UseSeasonPreviewDerivationsInput) {
  const {
    standingsPreviewFeed,
    tableColumnPreferences,
    standingsPreviewSort,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
  } = input;

  const standingsPreviewColumns = STANDINGS_PREVIEW_COLUMNS;

  const visibleStandingsPreviewColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        standingsPreviewColumns,
        tableColumnPreferences.standingsPreviewTable?.columnOrder,
        getTablePinnedLeftIds("standingsPreviewTable"),
        getTablePinnedRightIds("standingsPreviewTable"),
      ).filter((column) => isTableColumnVisible("standingsPreviewTable", column.id, column.visibleByDefault !== false)),
    [getTablePinnedLeftIds, getTablePinnedRightIds, isTableColumnVisible, standingsPreviewColumns, tableColumnPreferences],
  );

  const standingsPreviewRows = useMemo(() => standingsPreviewFeed?.items ?? [], [standingsPreviewFeed]);

  const sortedStandingsPreviewRows = useMemo(
    () =>
      sortFoundationTableRows(standingsPreviewRows, standingsPreviewSort, {
        team: (row) => row.teamName,
        currentRank: (row) => row.currentRank ?? Number.POSITIVE_INFINITY,
        projectedRank: (row) => row.projectedRank ?? Number.POSITIVE_INFINITY,
        currentPoints: (row) => row.currentPoints ?? Number.NEGATIVE_INFINITY,
        matchdayScore: (row) => row.matchdayScore ?? Number.NEGATIVE_INFINITY,
        projectedPoints: (row) => row.projectedPoints ?? Number.NEGATIVE_INFINITY,
        pointsDelta: (row) => row.pointsDelta ?? Number.NEGATIVE_INFINITY,
        matchdayRank: (row) => row.matchdayRank ?? Number.POSITIVE_INFINITY,
        d1Score: (row) => row.d1Score ?? Number.NEGATIVE_INFINITY,
        d2Score: (row) => row.d2Score ?? Number.NEGATIVE_INFINITY,
        totalScore: (row) => row.totalScore ?? Number.NEGATIVE_INFINITY,
        cash: (row) => row.cash ?? Number.NEGATIVE_INFINITY,
        readinessStatus: (row) => row.readinessStatus,
        resultStatus: (row) => row.resultStatus,
        warnings: (row) => row.warnings.join(", "),
      }),
    [standingsPreviewRows, standingsPreviewSort],
  );

  return {
    standingsPreviewColumns,
    visibleStandingsPreviewColumns,
    sortedStandingsPreviewRows,
  };
}
