"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";

import {
  applyStoredGlobalColumnOrder,
  loadFoundationTablePreferences,
  markFoundationTableAsCustom,
  normalizeFoundationTablePreferenceEntry,
  saveFoundationTablePreferences,
  type FoundationTablePreferences,
} from "@/lib/ui/foundation-table-preferences";
import {
  clampTableColumnWidth,
  reorderGlobalTableColumns,
  type GlobalTableColumnConfig,
} from "@/lib/ui/global-table-layout";

export { FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY } from "@/lib/ui/foundation-table-preferences";

export function useFoundationTableLayout(tableId: string, columns: GlobalTableColumnConfig[]) {
  const [preferences, setPreferences] = useState<FoundationTablePreferences>(() =>
    Object.fromEntries(
      Object.entries(loadFoundationTablePreferences()).map(([key, entry]) => [
        key,
        normalizeFoundationTablePreferenceEntry(entry),
      ]),
    ),
  );
  const tableResizeState = useRef<{
    tableId: string;
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth?: number;
  } | null>(null);
  const tableDragState = useRef<{ tableId: string; columnId: string } | null>(null);

  useEffect(() => {
    saveFoundationTablePreferences(preferences);
  }, [preferences]);

  const getTableColumnWidth = useCallback(
    (column: GlobalTableColumnConfig) =>
      clampTableColumnWidth(column, preferences[tableId]?.widths?.[column.id] ?? column.defaultWidth),
    [preferences, tableId],
  );

  const visibleColumns = useMemo(
    () =>
      applyStoredGlobalColumnOrder(
        columns.filter((column) => {
          const explicit = preferences[tableId]?.columnVisibility?.[column.id];
          if (typeof explicit === "boolean") {
            return explicit;
          }
          return !preferences[tableId]?.hiddenColumnIds?.includes(column.id) && column.defaultVisible !== false;
        }),
        preferences[tableId]?.columnOrder,
        preferences[tableId]?.pinnedLeft,
        preferences[tableId]?.pinnedRight,
      ),
    [columns, preferences, tableId],
  );

  const startTableColumnResize = useCallback(
    (column: GlobalTableColumnConfig, event: MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      tableResizeState.current = {
        tableId,
        columnId: column.id,
        startX: event.clientX,
        startWidth: getTableColumnWidth(column),
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
      };

      const handlePointerMove = (moveEvent: MouseEvent) => {
        const resizeState = tableResizeState.current;
        if (!resizeState) {
          return;
        }

        const nextWidth = Math.round(resizeState.startWidth + (moveEvent.clientX - resizeState.startX));
        setPreferences((current) => ({
          ...current,
          [tableId]: {
            ...markFoundationTableAsCustom(current[tableId]),
            widths: {
              ...(current[tableId]?.widths ?? {}),
              [resizeState.columnId]: clampTableColumnWidth(resizeState, nextWidth),
            },
          },
        }));
      };

      const handlePointerUp = () => {
        tableResizeState.current = null;
        window.removeEventListener("mousemove", handlePointerMove as never);
        window.removeEventListener("mouseup", handlePointerUp);
      };

      window.addEventListener("mousemove", handlePointerMove as never);
      window.addEventListener("mouseup", handlePointerUp);
    },
    [getTableColumnWidth, tableId],
  );

  const resetTableColumnWidth = useCallback(
    (column: GlobalTableColumnConfig) => {
      setPreferences((current) => ({
        ...current,
        [tableId]: {
          ...markFoundationTableAsCustom(current[tableId]),
          widths: {
            ...(current[tableId]?.widths ?? {}),
            [column.id]: clampTableColumnWidth(column, column.defaultWidth),
          },
        },
      }));
    },
    [tableId],
  );

  const moveTableColumnTo = useCallback(
    (sourceColumnId: string, targetColumnId: string) => {
      setPreferences((current) => {
        const entry = current[tableId];
        const baseOrder = applyStoredGlobalColumnOrder(columns, entry?.columnOrder).map((column) => column.id);
        const nextOrder = reorderGlobalTableColumns(baseOrder, sourceColumnId, targetColumnId);
        if (nextOrder.join("|") === baseOrder.join("|")) {
          return current;
        }

        return {
          ...current,
          [tableId]: {
            ...markFoundationTableAsCustom(entry),
            columnOrder: nextOrder,
          },
        };
      });
    },
    [columns, tableId],
  );

  const getTableHeaderDragProps = useCallback(
    (column: GlobalTableColumnConfig) => {
      const disabled = column.draggable === false;
      return {
        draggable: !disabled,
        onDragStart: (event: DragEvent<HTMLTableCellElement>) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          tableDragState.current = { tableId, columnId: column.id };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", `${tableId}:${column.id}`);
        },
        onDragOver: (event: DragEvent<HTMLTableCellElement>) => {
          const dragState = tableDragState.current;
          if (!dragState || dragState.tableId !== tableId || dragState.columnId === column.id) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        },
        onDrop: (event: DragEvent<HTMLTableCellElement>) => {
          const dragState = tableDragState.current;
          tableDragState.current = null;
          if (!dragState || dragState.tableId !== tableId) {
            return;
          }
          event.preventDefault();
          moveTableColumnTo(dragState.columnId, column.id);
        },
        onDragEnd: () => {
          tableDragState.current = null;
        },
      };
    },
    [moveTableColumnTo, tableId],
  );

  return {
    visibleColumns,
    getTableColumnWidth,
    startTableColumnResize,
    resetTableColumnWidth,
    getTableHeaderDragProps,
  };
}
