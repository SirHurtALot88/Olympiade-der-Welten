import type { FoundationTableColumn } from "@/lib/foundation/tabs/cockpit-types";
import { saisonstandColumnContract } from "@/lib/foundation/saisonstand-column-contract";

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
