"use client";

import type { ComponentProps, ComponentType, MouseEvent } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationStandingsPreviewResponse, FoundationTableColumn, SortState } from "@/lib/foundation/tabs/cockpit-types";
import type { ColumnVisibilityManager as ColumnVisibilityManagerComponent, SortableHeader as SortableHeaderComponent } from "@/components/foundation/FoundationTableUi";
import SeasonPreviewNewLook from "@/app/foundation/season-preview-v2/SeasonPreviewNewLook";

type ColumnVisibilityManagerProps = ComponentProps<typeof ColumnVisibilityManagerComponent>;

type SortableHeaderProps = ComponentProps<typeof SortableHeaderComponent>;

export type FoundationSeasonPreviewShellHostProps = {
  activeSaveId: string;
  gameState: GameState;
  standingsPreviewFeed: FoundationStandingsPreviewResponse | null;
  tableColumnPreferences: {
    standingsPreviewTable?: { columnOrder?: string[] };
  };
  tableSorts: Record<string, SortState>;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  getTableHeaderDragProps: (
    tableId: string,
    column: FoundationTableColumn,
    visibleColumns: FoundationTableColumn[],
  ) => Record<string, unknown>;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: MouseEvent<HTMLSpanElement>) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  toggleTableSort: (tableId: string, columnKey: string) => void;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
  ColumnVisibilityManager: ComponentType<ColumnVisibilityManagerProps>;
  SortableHeader: ComponentType<SortableHeaderProps>;
  openTeamProfileById: (teamId: string) => void;
};

/**
 * Season preview shell host (Strangler Phase 5.3). Mounts standings preview panel
 * only while the seasonPreview tab is active.
 */
export default function FoundationSeasonPreviewShellHost(props: FoundationSeasonPreviewShellHostProps) {
  return <SeasonPreviewNewLook {...props} />;
}
