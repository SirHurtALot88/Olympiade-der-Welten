import type * as React from "react";
import type { ComponentProps, ComponentType } from "react";

import type { FoundationTableColumn, FoundationTablePresetId, SortState } from "@/lib/foundation/tabs/cockpit-types";
import type { ColumnVisibilityManager as ColumnVisibilityManagerComponent, SortableHeader as SortableHeaderComponent } from "@/components/foundation/FoundationTableUi";

/**
 * Legacy-Panel entfernt: Die „Diszis"-Ansicht wird ausschließlich von
 * `FoundationDiszisNewLook` gerendert (siehe `FoundationDiszisHost`). Die frühere
 * `FoundationDiszisPanel`-Komponente war toter Code — nur noch dieser Props-Vertrag
 * (und `DisciplineCategoryFilter`) wird von NewLook/Host weiterverwendet.
 */

type ColumnVisibilityManagerProps = ComponentProps<typeof ColumnVisibilityManagerComponent>;

type SortableHeaderProps = ComponentProps<typeof SortableHeaderComponent>;

export type DisciplineCategoryFilter = "all" | "power" | "speed" | "mental" | "social";

export interface FoundationDiszisPanelProps {
  disciplineConfigTableColumns: FoundationTableColumn[];
  visibleDisciplineConfigColumns: FoundationTableColumn[];
  disciplineCategoryFilter: DisciplineCategoryFilter;
  setDisciplineCategoryFilter: (value: DisciplineCategoryFilter) => void;
  visibleDisciplineConfigRows: Array<Record<string, unknown>>;
  seasonDisciplineScheduleRows: Array<Record<string, unknown>>;
  currentMatchdayId: string;
  getTableActivePreset: (tableId: string) => FoundationTablePresetId;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  moveTableColumn: (tableId: string, columnId: string, direction: "left" | "right", columns: FoundationTableColumn[]) => void;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  adjustTableColumnWidth: (tableId: string, column: FoundationTableColumn, delta: number) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  resetTableLayout: (tableId: string, columns: FoundationTableColumn[]) => void;
  getTableHeaderDragProps: (tableId: string, column: FoundationTableColumn, columns: FoundationTableColumn[]) => Record<string, unknown>;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: React.MouseEvent<HTMLSpanElement>) => void;
  tableSorts: { disciplineConfig: SortState };
  toggleTableSort: (tableId: string, columnKey: string) => void;
  ColumnVisibilityManager: ComponentType<ColumnVisibilityManagerProps>;
  SortableHeader: ComponentType<SortableHeaderProps>;
}
