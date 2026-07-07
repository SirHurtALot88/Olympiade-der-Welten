import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { getTransfermarktAdvancedColumns } from "@/lib/market/transfermarkt-column-contract";
import { saisonstandExpertPresetWidths } from "@/lib/foundation/saisonstand-column-contract";
import {
  applyStoredColumnOrder,
  getDefaultTableWidths,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
import type {
  FoundationTableColumn,
  FoundationTablePreset,
  PersistedFoundationTablePreferenceEntry,
  PersistedFoundationTablePreferences,
  SeasonTableMode,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  GLOBAL_TABLE_LAYOUT_VERSION,
  GLOBAL_TABLE_STORAGE_KEYS,
  clampTableColumnWidth,
  getGlobalTablePinZone,
  reorderGlobalTableColumns,
} from "@/lib/ui/global-table-layout";

export type FoundationTablePreferencesActions = {
  getSeasonTableDefaultColumnWidth: (column: FoundationTableColumn) => number;
  getSeasonTableColumnWidth: (column: FoundationTableColumn) => number;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  getTableActivePreset: (tableId: string) => "retool_default" | "compact" | "finance" | "performance" | "custom";
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
  startTableColumnResize: (
    tableId: string,
    column: FoundationTableColumn,
    event: React.MouseEvent<HTMLSpanElement>,
  ) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  setTransferMarketAdvancedColumnsVisible: (nextVisible: boolean) => void;
  adjustTableColumnWidth: (tableId: string, column: FoundationTableColumn, delta: number) => void;
  moveTableColumn: (
    tableId: string,
    columnId: string,
    direction: "left" | "right",
    columns: FoundationTableColumn[],
  ) => void;
  moveTableColumnTo: (
    tableId: string,
    sourceColumnId: string,
    targetColumnId: string,
    columns: FoundationTableColumn[],
  ) => void;
  getTableHeaderDragProps: (
    tableId: string,
    column: FoundationTableColumn,
    columns: FoundationTableColumn[],
  ) => {
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLTableCellElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLTableCellElement>) => void;
    onDrop: (event: React.DragEvent<HTMLTableCellElement>) => void;
    onDragEnd: () => void;
  };
  applyTablePreset: (tableId: string, preset: FoundationTablePreset, columns: FoundationTableColumn[]) => void;
  resetTableLayout: (tableId: string, columns: FoundationTableColumn[], preset?: FoundationTablePreset) => void;
};

function markTableAsCustom(entry: PersistedFoundationTablePreferenceEntry | undefined) {
  return {
    version: GLOBAL_TABLE_LAYOUT_VERSION,
    widths: entry?.widths ?? {},
    hiddenColumnIds: entry?.hiddenColumnIds ?? [],
    columnVisibility: entry?.columnVisibility ?? {},
    columnOrder: entry?.columnOrder ?? [],
    pinnedLeft: entry?.pinnedLeft ?? [],
    pinnedRight: entry?.pinnedRight ?? [],
    activePreset: "custom" as const,
  };
}

function getVisibleColumnIdsForPreset(columns: FoundationTableColumn[], visibleColumnIds: string[]) {
  const visibleSet = new Set(visibleColumnIds);
  return Object.fromEntries(columns.map((column) => [column.id, visibleSet.has(column.id)]));
}

export function useFoundationTablePreferences(input: {
  tableColumnPreferences: PersistedFoundationTablePreferences;
  setTableColumnPreferences: Dispatch<SetStateAction<PersistedFoundationTablePreferences>>;
  seasonTableMode: SeasonTableMode;
  marketShowAdvancedColumns: boolean;
  setMarketShowAdvancedColumns: Dispatch<SetStateAction<boolean>>;
}): FoundationTablePreferencesActions {
  const { tableColumnPreferences, setTableColumnPreferences, seasonTableMode, setMarketShowAdvancedColumns } = input;

  const tableResizeState = useRef<{
    tableId: string;
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth?: number;
  } | null>(null);
  const tableDragState = useRef<{ tableId: string; columnId: string } | null>(null);

  const getSeasonTableDefaultColumnWidth = (column: FoundationTableColumn) =>
    seasonTableMode === "expert" ? (saisonstandExpertPresetWidths[column.id] ?? column.defaultWidth) : column.defaultWidth;

  const getSeasonTableColumnWidth = (column: FoundationTableColumn) =>
    clampTableColumnWidth(
      column,
      tableColumnPreferences.seasonTable?.widths?.[column.id] ?? getSeasonTableDefaultColumnWidth(column),
    );

  const getTableColumnWidth = (tableId: string, column: FoundationTableColumn) =>
    clampTableColumnWidth(column, tableColumnPreferences[tableId]?.widths?.[column.id] ?? column.defaultWidth);

  const getTableActivePreset = (tableId: string) =>
    tableColumnPreferences[tableId]?.activePreset ?? ("retool_default" as const);

  const isTableColumnVisible = (tableId: string, columnId: string, visibleByDefault = true) => {
    const explicit = tableColumnPreferences[tableId]?.columnVisibility?.[columnId];
    if (typeof explicit === "boolean") {
      return explicit;
    }

    return !tableColumnPreferences[tableId]?.hiddenColumnIds?.includes(columnId) && visibleByDefault;
  };

  const getTablePinnedLeftIds = (tableId: string) =>
    (tableColumnPreferences[tableId]?.pinnedLeft?.length
      ? tableColumnPreferences[tableId]?.pinnedLeft
      : GLOBAL_TABLE_STORAGE_KEYS[tableId]?.defaultPinnedLeft) ?? [];

  const getTablePinnedRightIds = (tableId: string) =>
    (tableColumnPreferences[tableId]?.pinnedRight?.length
      ? tableColumnPreferences[tableId]?.pinnedRight
      : GLOBAL_TABLE_STORAGE_KEYS[tableId]?.defaultPinnedRight) ?? [];

  const startTableColumnResize = (
    tableId: string,
    column: FoundationTableColumn,
    event: React.MouseEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    tableResizeState.current = {
      tableId,
      columnId: column.id,
      startX: event.clientX,
      startWidth: tableId === "seasonTable" ? getSeasonTableColumnWidth(column) : getTableColumnWidth(tableId, column),
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
    };

    const handlePointerMove = (moveEvent: MouseEvent) => {
      const resizeState = tableResizeState.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = Math.round(resizeState.startWidth + (moveEvent.clientX - resizeState.startX));
      setTableColumnPreferences((current) => ({
        ...current,
        [resizeState.tableId]: {
          ...markTableAsCustom(current[resizeState.tableId]),
          widths: {
            ...(current[resizeState.tableId]?.widths ?? {}),
            [resizeState.columnId]: clampTableColumnWidth(resizeState, nextWidth),
          },
        },
      }));
    };

    const handlePointerUp = () => {
      tableResizeState.current = null;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
  };

  const resetTableColumnWidth = (tableId: string, column: FoundationTableColumn) => {
    setTableColumnPreferences((current) => ({
      ...current,
      [tableId]: {
        ...markTableAsCustom(current[tableId]),
        widths: {
          ...(current[tableId]?.widths ?? {}),
          [column.id]: clampTableColumnWidth(
            column,
            tableId === "seasonTable" ? getSeasonTableDefaultColumnWidth(column) : column.defaultWidth,
          ),
        },
      },
    }));
  };

  const setTableColumnVisible = (tableId: string, columnId: string, nextVisible: boolean) => {
    setTableColumnPreferences((current) => {
      const hidden = new Set(current[tableId]?.hiddenColumnIds ?? []);
      if (nextVisible) {
        hidden.delete(columnId);
      } else {
        hidden.add(columnId);
      }

      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(current[tableId]),
          widths: current[tableId]?.widths ?? {},
          hiddenColumnIds: Array.from(hidden),
          columnVisibility: {
            ...(current[tableId]?.columnVisibility ?? {}),
            [columnId]: nextVisible,
          },
        },
      };
    });
  };

  const setTransferMarketAdvancedColumnsVisible = (nextVisible: boolean) => {
    setMarketShowAdvancedColumns(nextVisible);
    setTableColumnPreferences((current) => {
      const advancedIds = getTransfermarktAdvancedColumns().map((column) => column.id);
      const hidden = new Set(current.transferMarketTable?.hiddenColumnIds ?? []);
      const columnVisibility = { ...(current.transferMarketTable?.columnVisibility ?? {}) };

      for (const columnId of advancedIds) {
        if (nextVisible) {
          hidden.delete(columnId);
        } else {
          hidden.add(columnId);
        }
        columnVisibility[columnId] = nextVisible;
      }

      return {
        ...current,
        transferMarketTable: {
          ...markTableAsCustom(current.transferMarketTable),
          widths: current.transferMarketTable?.widths ?? {},
          hiddenColumnIds: Array.from(hidden),
          columnVisibility,
        },
      };
    });
  };

  const adjustTableColumnWidth = (tableId: string, column: FoundationTableColumn, delta: number) => {
    setTableColumnPreferences((current) => {
      const currentWidth =
        tableId === "seasonTable" ? getSeasonTableColumnWidth(column) : getTableColumnWidth(tableId, column);
      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(current[tableId]),
          widths: {
            ...(current[tableId]?.widths ?? {}),
            [column.id]: clampTableColumnWidth(column, currentWidth + delta),
          },
        },
      };
    });
  };

  const moveTableColumn = (
    tableId: string,
    columnId: string,
    direction: "left" | "right",
    columns: FoundationTableColumn[],
  ) => {
    setTableColumnPreferences((current) => {
      const baseOrder = applyStoredColumnOrder(
        columns,
        current[tableId]?.columnOrder,
        current[tableId]?.pinnedLeft,
        current[tableId]?.pinnedRight,
      ).map((column) => column.id);
      const currentIndex = baseOrder.indexOf(columnId);
      if (currentIndex === -1) {
        return current;
      }

      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= baseOrder.length) {
        return current;
      }

      const nextOrder = [...baseOrder];
      const [movedColumnId] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, movedColumnId);

      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(current[tableId]),
          columnOrder: nextOrder,
        },
      };
    });
  };

  const moveTableColumnTo = (
    tableId: string,
    sourceColumnId: string,
    targetColumnId: string,
    columns: FoundationTableColumn[],
  ) => {
    if (sourceColumnId === targetColumnId) {
      return;
    }

    setTableColumnPreferences((current) => {
      const entry = current[tableId];
      const entryWithPinnedDefaults = {
        ...entry,
        pinnedLeft: getTablePinnedLeftIds(tableId),
        pinnedRight: getTablePinnedRightIds(tableId),
      };
      const sourceZone = getGlobalTablePinZone(entryWithPinnedDefaults, sourceColumnId);
      const targetZone = getGlobalTablePinZone(entryWithPinnedDefaults, targetColumnId);
      if (sourceZone !== targetZone) {
        return current;
      }

      const baseOrder = applyStoredColumnOrder(
        columns,
        entry?.columnOrder,
        getTablePinnedLeftIds(tableId),
        getTablePinnedRightIds(tableId),
      ).map((column) => column.id);
      const nextOrder = reorderGlobalTableColumns(baseOrder, sourceColumnId, targetColumnId);
      if (nextOrder === baseOrder || nextOrder.join("|") === baseOrder.join("|")) {
        return current;
      }

      return {
        ...current,
        [tableId]: {
          ...markTableAsCustom(entry),
          columnOrder: nextOrder,
        },
      };
    });
  };

  const getTableHeaderDragProps = (tableId: string, column: FoundationTableColumn, columns: FoundationTableColumn[]) => {
    const disabled = column.draggable === false;
    return {
      draggable: !disabled,
      onDragStart: (event: React.DragEvent<HTMLTableCellElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        tableDragState.current = { tableId, columnId: column.id };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${tableId}:${column.id}`);
      },
      onDragOver: (event: React.DragEvent<HTMLTableCellElement>) => {
        const dragState = tableDragState.current;
        if (!dragState || dragState.tableId !== tableId || dragState.columnId === column.id) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDrop: (event: React.DragEvent<HTMLTableCellElement>) => {
        const dragState = tableDragState.current;
        tableDragState.current = null;
        if (!dragState || dragState.tableId !== tableId) {
          return;
        }
        event.preventDefault();
        moveTableColumnTo(tableId, dragState.columnId, column.id, columns);
      },
      onDragEnd: () => {
        tableDragState.current = null;
      },
    };
  };

  const applyTablePreset = (tableId: string, preset: FoundationTablePreset, columns: FoundationTableColumn[]) => {
    setTableColumnPreferences((current) => ({
      ...current,
      [tableId]: {
        version: GLOBAL_TABLE_LAYOUT_VERSION,
        widths: getDefaultTableWidths(columns),
        hiddenColumnIds: columns
          .filter((column) => !preset.visibleColumnIds.includes(column.id))
          .map((column) => column.id),
        columnVisibility: getVisibleColumnIdsForPreset(columns, preset.visibleColumnIds),
        columnOrder: [...preset.order],
        pinnedLeft: [...(preset.pinnedLeft ?? [])],
        pinnedRight: [...(preset.pinnedRight ?? [])],
        activePreset: preset.id,
      },
    }));
  };

  const resetTableLayout = (tableId: string, columns: FoundationTableColumn[], preset?: FoundationTablePreset) => {
    if (preset) {
      applyTablePreset(tableId, preset, columns);
      return;
    }

    setTableColumnPreferences((current) => {
      const next = { ...current };
      delete next[tableId];
      return next;
    });
  };

  return {
    getSeasonTableDefaultColumnWidth,
    getSeasonTableColumnWidth,
    getTableColumnWidth,
    getTableActivePreset,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    startTableColumnResize,
    resetTableColumnWidth,
    setTableColumnVisible,
    setTransferMarketAdvancedColumnsVisible,
    adjustTableColumnWidth,
    moveTableColumn,
    moveTableColumnTo,
    getTableHeaderDragProps,
    applyTablePreset,
    resetTableLayout,
  };
}
