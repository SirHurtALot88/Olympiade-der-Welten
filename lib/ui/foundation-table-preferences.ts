import {
  GLOBAL_TABLE_LAYOUT_VERSION,
  normalizeGlobalTablePreferenceEntry,
  uniqueGlobalColumnIds,
  type GlobalTableColumnConfig,
  type GlobalTableLayoutState,
} from "@/lib/ui/global-table-layout";

export const FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY = "foundation-table-preferences-v1";

export type FoundationTablePreferenceEntry = GlobalTableLayoutState & {
  activePreset?: "retool_default" | "compact" | "finance" | "performance" | "custom" | null;
};

export type FoundationTablePreferences = Record<string, FoundationTablePreferenceEntry>;

export function loadFoundationTablePreferences(): FoundationTablePreferences {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as FoundationTablePreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveFoundationTablePreferences(preferences: FoundationTablePreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function normalizeFoundationTablePreferenceEntry(entry?: FoundationTablePreferenceEntry): FoundationTablePreferenceEntry {
  const normalized = normalizeGlobalTablePreferenceEntry(entry);
  const activePreset =
    normalized.activePreset === "retool_default" ||
    normalized.activePreset === "compact" ||
    normalized.activePreset === "finance" ||
    normalized.activePreset === "performance" ||
    normalized.activePreset === "custom"
      ? normalized.activePreset
      : null;

  return {
    ...normalized,
    activePreset,
  };
}

export function applyStoredGlobalColumnOrder(
  columns: GlobalTableColumnConfig[],
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
  const leftPinnedColumns = uniqueGlobalColumnIds(pinnedLeft ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is GlobalTableColumnConfig => Boolean(column));
  const rightPinnedColumns = uniqueGlobalColumnIds(pinnedRight ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is GlobalTableColumnConfig => Boolean(column));
  const handled = new Set([...leftPinnedColumns, ...rightPinnedColumns].map((column) => column.id));
  const middleColumns = baseColumns.filter((column) => !handled.has(column.id));

  return [...leftPinnedColumns, ...middleColumns, ...rightPinnedColumns];
}

export function markFoundationTableAsCustom(entry: FoundationTablePreferenceEntry | undefined): FoundationTablePreferenceEntry {
  return {
    version: GLOBAL_TABLE_LAYOUT_VERSION,
    widths: entry?.widths ?? {},
    hiddenColumnIds: entry?.hiddenColumnIds ?? [],
    columnVisibility: entry?.columnVisibility ?? {},
    columnOrder: entry?.columnOrder ?? [],
    pinnedLeft: entry?.pinnedLeft ?? [],
    pinnedRight: entry?.pinnedRight ?? [],
    activePreset: "custom",
  };
}
