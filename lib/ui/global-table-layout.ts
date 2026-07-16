export const GLOBAL_TABLE_LAYOUT_VERSION = 1;

export type GlobalTableId =
  | "season-standings"
  | "season-standings-v2"
  | "season-standings-v2-top-players"
  | "prize-money"
  | "transfer-market"
  | "transfer-history"
  | "teams"
  | "players"
  | "ranks"
  | "disciplines"
  | "lineup-expert"
  | "training-facilities"
  | "ai-audit"
  | "balance-team"
  | "balance-economy"
  | "balance-player"
  | "balance-gameplay";

export type GlobalTableColumnGroup = "core" | "finance" | "attributes" | "history" | "expert" | "detail" | "fit" | "health";

export type GlobalTableColumnConfig = {
  id: string;
  label: string;
  dataKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth?: number;
  defaultVisible?: boolean;
  defaultOrder?: number;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  sortable?: boolean;
  resizable?: boolean;
  draggable?: boolean;
  group?: GlobalTableColumnGroup;
};

export type GlobalTableRegistryEntry = {
  tableId: GlobalTableId;
  storageKey: string;
  label: string;
  layoutVersion: number;
  status: "connected" | "legacy";
  requiresResizableColumns: boolean;
  requiresPersistentWidths: boolean;
  defaultPinnedLeft?: string[];
  defaultPinnedRight?: string[];
};

export type GlobalTableLayoutState = {
  version?: number;
  widths?: Record<string, number>;
  hiddenColumnIds?: string[];
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  pinnedLeft?: string[];
  pinnedRight?: string[];
  activePreset?: string | null;
};

export const GLOBAL_TABLE_REGISTRY: Record<GlobalTableId, GlobalTableRegistryEntry> = {
  "season-standings": {
    tableId: "season-standings",
    storageKey: "seasonTable",
    label: "Saisonstand",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["platz", "mannschaft", "punkte"],
  },
  "season-standings-v2": {
    tableId: "season-standings-v2",
    storageKey: "seasonStandingsV2Table",
    label: "Saisonstand v2",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["rank", "team"],
  },
  "season-standings-v2-top-players": {
    tableId: "season-standings-v2-top-players",
    storageKey: "seasonStandingsV2TopPlayersTable",
    label: "Saisonstand v2 Top Player",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["rank", "player"],
  },
  "prize-money": {
    tableId: "prize-money",
    storageKey: "prizePreviewTable",
    label: "Preisgeld",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["team"],
  },
  "transfer-market": {
    tableId: "transfer-market",
    storageKey: "transferMarketTable",
    label: "Transfermarkt",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["imageUrl", "name"],
  },
  "transfer-history": {
    tableId: "transfer-history",
    storageKey: "transferHistoryTable",
    label: "Transferhistorie",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["image", "name"],
  },
  teams: {
    tableId: "teams",
    storageKey: "teamsView",
    label: "Teams",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["team", "overallRank"],
  },
  players: {
    tableId: "players",
    storageKey: "playersTable",
    label: "Spieler",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["image", "name", "team"],
  },
  ranks: {
    tableId: "ranks",
    storageKey: "disciplineRanksTable",
    label: "Ranks",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["team"],
  },
  disciplines: {
    tableId: "disciplines",
    storageKey: "disciplineConfigTable",
    label: "Diszis",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
  },
  "lineup-expert": {
    tableId: "lineup-expert",
    storageKey: "selectedRosterTable",
    label: "Einsatzliste / Expert",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["image", "name"],
  },
  "training-facilities": {
    tableId: "training-facilities",
    storageKey: "trainingFacilitiesTable",
    label: "Training & Gebäude",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "legacy",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
  },
  "ai-audit": {
    tableId: "ai-audit",
    storageKey: "aiAuditTable",
    label: "Redraft-/AI-Audit",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "legacy",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
  },
  "balance-team": {
    tableId: "balance-team",
    storageKey: "multiSeasonTeamBalanceTable",
    label: "Multi-Season Team Balance",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["team"],
  },
  "balance-economy": {
    tableId: "balance-economy",
    storageKey: "multiSeasonEconomyTable",
    label: "Multi-Season Economy Balance",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["team"],
  },
  "balance-player": {
    tableId: "balance-player",
    storageKey: "multiSeasonPlayerProgressionTable",
    label: "Multi-Season Player Progression",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["player", "team"],
  },
  "balance-gameplay": {
    tableId: "balance-gameplay",
    storageKey: "multiSeasonGameplayTable",
    label: "Multi-Season Gameplay Balance",
    layoutVersion: GLOBAL_TABLE_LAYOUT_VERSION,
    status: "connected",
    requiresResizableColumns: true,
    requiresPersistentWidths: true,
    defaultPinnedLeft: ["metric"],
  },
};

export const GLOBAL_TABLE_STORAGE_KEYS = Object.fromEntries(
  Object.values(GLOBAL_TABLE_REGISTRY).map((entry) => [entry.storageKey, entry] as const),
) as Record<string, GlobalTableRegistryEntry>;

export function clampTableColumnWidth(column: Pick<GlobalTableColumnConfig, "minWidth" | "maxWidth">, width: number) {
  const minWidth = Math.max(1, column.minWidth);
  const maxWidth = column.maxWidth ?? 420;
  return Math.min(Math.max(Math.round(width), minWidth), Math.max(minWidth, maxWidth));
}

export function getDefaultGlobalTableWidths(columns: Array<Pick<GlobalTableColumnConfig, "id" | "defaultWidth" | "minWidth" | "maxWidth">>) {
  return Object.fromEntries(columns.map((column) => [column.id, clampTableColumnWidth(column, column.defaultWidth)]));
}

export function uniqueGlobalColumnIds(columnIds: string[]) {
  return Array.from(new Set(columnIds.filter(Boolean)));
}

export function normalizeGlobalTablePreferenceEntry(entry?: GlobalTableLayoutState): Required<GlobalTableLayoutState> {
  return {
    version: entry?.version ?? GLOBAL_TABLE_LAYOUT_VERSION,
    widths: entry?.widths ?? {},
    hiddenColumnIds: entry?.hiddenColumnIds ?? [],
    columnVisibility: entry?.columnVisibility ?? {},
    columnOrder: entry?.columnOrder ?? [],
    pinnedLeft: entry?.pinnedLeft ?? [],
    pinnedRight: entry?.pinnedRight ?? [],
    activePreset: entry?.activePreset ?? null,
  };
}

export function getGlobalTablePinZone(entry: GlobalTableLayoutState | undefined, columnId: string) {
  const normalized = normalizeGlobalTablePreferenceEntry(entry);
  if (normalized.pinnedLeft.includes(columnId)) {
    return "left";
  }
  if (normalized.pinnedRight.includes(columnId)) {
    return "right";
  }
  return "middle";
}

export function reorderGlobalTableColumns(
  currentOrder: string[],
  sourceColumnId: string,
  targetColumnId: string,
) {
  if (sourceColumnId === targetColumnId) {
    return currentOrder;
  }

  const sourceIndex = currentOrder.indexOf(sourceColumnId);
  const targetIndex = currentOrder.indexOf(targetColumnId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return currentOrder;
  }

  const nextOrder = [...currentOrder];
  const [movedColumnId] = nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, movedColumnId);
  return nextOrder;
}
