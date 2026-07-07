import type { FoundationTableColumn } from "@/lib/foundation/tabs/cockpit-types";
import {
  getSaisonstandExpertContractColumns,
  saisonstandColumnContract,
} from "@/lib/foundation/saisonstand-column-contract";

export function buildFoundationSeasonTableColumns(): FoundationTableColumn[] {
  const contractColumns = saisonstandColumnContract.columns.map((column) => ({
    id: column.normalizedKey,
    label: column.displayLabel,
    dataKey: column.normalizedKey,
    defaultWidth: Math.max(Math.round(column.columnSize ?? 96), 52),
    minWidth: column.normalizedKey === "mannschaft" ? 150 : 52,
    visibleByDefault: column.compactVisible,
    tooltip:
      column.normalizedKey === "bonuspunkte"
        ? `${column.sourceDescription} ${column.transformNote ?? ""}`.trim()
        : undefined,
  }));

  return [
    ...contractColumns,
    { id: "actions", label: "Aktion", dataKey: "actions", defaultWidth: 120, minWidth: 100, visibleByDefault: true },
  ];
}

const SEASON_TABLE_PINNED_COLUMN_IDS = new Set(["platz", "mannschaft", "punkte"]);

export function buildSeasonModeColumns(seasonTableColumns: FoundationTableColumn[]): FoundationTableColumn[] {
  const contractColumns = getSaisonstandExpertContractColumns();
  const columnById = new Map(seasonTableColumns.map((column) => [column.id, column]));
  return contractColumns
    .map((column) => columnById.get(column.normalizedKey))
    .filter((column): column is FoundationTableColumn => Boolean(column));
}

export function buildSeasonTablePinnedOffsets(
  visibleSeasonTableColumns: FoundationTableColumn[],
  getSeasonTableColumnWidth: (column: FoundationTableColumn) => number,
): Map<string, number> {
  let currentLeft = 0;
  const offsets = new Map<string, number>();
  for (const column of visibleSeasonTableColumns) {
    if (!SEASON_TABLE_PINNED_COLUMN_IDS.has(column.id)) {
      continue;
    }
    offsets.set(column.id, currentLeft);
    currentLeft += getSeasonTableColumnWidth(column);
  }
  return offsets;
}

export function scrollSeasonTableToColumn(
  shell: HTMLDivElement | null,
  visibleSeasonTableColumns: FoundationTableColumn[],
  columnId: string,
  getSeasonTableColumnWidth: (column: FoundationTableColumn) => number,
) {
  if (!shell) {
    return;
  }

  const targetIndex = visibleSeasonTableColumns.findIndex((column) => column.id === columnId);
  if (targetIndex < 0) {
    return;
  }

  const left = visibleSeasonTableColumns
    .slice(0, targetIndex)
    .reduce((sum, column) => sum + getSeasonTableColumnWidth(column), 0);

  shell.scrollTo({
    left: Math.max(left - 18, 0),
    behavior: "smooth",
  });
}
