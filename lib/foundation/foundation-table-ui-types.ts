import type { GlobalTableColumnConfig } from "@/lib/ui/global-table-layout";

export type SortDirection = "asc" | "desc";

export type SortState = {
  key: string;
  direction: SortDirection;
};

export type FoundationTableColumn = GlobalTableColumnConfig & {
  visibleByDefault?: boolean;
  tooltip?: string;
};

export type FoundationTablePresetId = "retool_default" | "compact" | "finance" | "performance" | "custom";

export type FoundationTablePreset = {
  id: Exclude<FoundationTablePresetId, "custom">;
  label: string;
  description: string;
  order: string[];
  visibleColumnIds: string[];
  pinnedLeft?: string[];
  pinnedRight?: string[];
};
