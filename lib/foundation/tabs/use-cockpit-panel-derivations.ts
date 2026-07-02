import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildFeatureAuditMatrix,
  filterFeatureAuditEntries,
  type FeatureAuditFilter,
  type FeatureAuditMatrix,
} from "@/lib/foundation/feature-audit-matrix";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";
import {
  buildMultiSeasonBalanceDashboard,
  type MultiSeasonBalanceDashboard,
  type MultiSeasonBalanceEconomyRow,
  type MultiSeasonBalanceGameplayRow,
  type MultiSeasonBalancePlayerRow,
  type MultiSeasonBalanceTeamRow,
} from "@/lib/foundation/multiseason-balance-dashboard";
import type {
  FoundationResolvePreviewResponse,
  FoundationTableColumn,
  FoundationView,
  SortState,
} from "@/lib/foundation/tabs/cockpit-types";

const EMPTY_MULTI_SEASON_BALANCE_DASHBOARD: MultiSeasonBalanceDashboard = {
  generatedAt: "deferred",
  sourceSummary: {
    saveId: null,
    activeSeasonId: "deferred",
    snapshotSeasons: [],
    completedSeasonCount: 0,
    hasCurrentSeasonData: false,
    missingSeasonIds: [],
    seasonQuality: [],
  },
  summaryCards: [],
  teamRows: [],
  economyRows: [],
  playerRows: [],
  gameplayRows: [],
  warnings: [],
  exportLinks: [],
};

const EMPTY_FEATURE_AUDIT_MATRIX: FeatureAuditMatrix = {
  generatedAt: "deferred",
  entries: [],
  summary: {
    total: 0,
    statusCounts: {
      planned: 0,
      preview: 0,
      local_write: 0,
      sandbox_ready: 0,
      multiplayer_ready: 0,
      prod_ready: 0,
    },
    prodReady: 0,
    sandboxReadyOrBetter: 0,
    previewOnly: 0,
    localWrite: 0,
    multiplayerReady: 0,
    missingTests: 0,
    missingSmoke: 0,
    localWriteWithoutWriteSafety: 0,
    multiplayerMissing: 0,
    blockerCount: 0,
    topBlockers: [],
  },
};

export const COCKPIT_QUICK_LINKS: Array<{ id: FoundationView; label: string }> = [
  { id: "season", label: "Saisonstand" },
  { id: "lineup", label: "Einsatzliste" },
  { id: "marketV2", label: "Transfermarkt" },
  { id: "prize", label: "Preisgeld" },
];

export const MULTI_SEASON_TEAM_BALANCE_COLUMNS: FoundationTableColumn[] = [
  { id: "team", label: "Team", dataKey: "team", defaultWidth: 220, minWidth: 160 },
  { id: "seasons", label: "Seasons", dataKey: "seasons", defaultWidth: 90, minWidth: 76 },
  { id: "champions", label: "Titel", dataKey: "champions", defaultWidth: 86, minWidth: 72 },
  { id: "avgRank", label: "Ø Rang", dataKey: "avgRank", defaultWidth: 96, minWidth: 78 },
  { id: "bestRank", label: "Best", dataKey: "bestRank", defaultWidth: 80, minWidth: 68 },
  { id: "worstRank", label: "Worst", dataKey: "worstRank", defaultWidth: 84, minWidth: 70 },
  { id: "rankDelta", label: "Δ Rang", dataKey: "rankDelta", defaultWidth: 96, minWidth: 78 },
  { id: "avgPoints", label: "Ø Punkte", dataKey: "avgPoints", defaultWidth: 110, minWidth: 90 },
  { id: "top5", label: "Top 5", dataKey: "top5", defaultWidth: 86, minWidth: 72 },
  { id: "bottom5", label: "Bottom 5", dataKey: "bottom5", defaultWidth: 100, minWidth: 84 },
  { id: "points", label: "Punkte Verlauf", dataKey: "points", defaultWidth: 240, minWidth: 170 },
  { id: "source", label: "Source", dataKey: "source", defaultWidth: 170, minWidth: 130, visibleByDefault: false },
];

export const MULTI_SEASON_ECONOMY_COLUMNS: FoundationTableColumn[] = [
  { id: "team", label: "Team", dataKey: "team", defaultWidth: 220, minWidth: 160 },
  { id: "cash", label: "Cash", dataKey: "cash", defaultWidth: 110, minWidth: 90 },
  { id: "cashAvg", label: "Ø Cash End", dataKey: "cashAvg", defaultWidth: 120, minWidth: 100 },
  { id: "cashMax", label: "Cash Max", dataKey: "cashMax", defaultWidth: 110, minWidth: 90 },
  { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 110, minWidth: 90 },
  { id: "salaryRatio", label: "Gehalt/Cash", dataKey: "salaryRatio", defaultWidth: 120, minWidth: 100 },
  { id: "transferSpend", label: "Ausgaben", dataKey: "transferSpend", defaultWidth: 110, minWidth: 90 },
  { id: "transferIncome", label: "Einnahmen", dataKey: "transferIncome", defaultWidth: 110, minWidth: 90 },
  { id: "transferNet", label: "Transfer Net", dataKey: "transferNet", defaultWidth: 118, minWidth: 98 },
  { id: "facilityNet", label: "Facility Net", dataKey: "facilityNet", defaultWidth: 118, minWidth: 98 },
  { id: "warning", label: "Warning", dataKey: "warning", defaultWidth: 150, minWidth: 120 },
];

export const MULTI_SEASON_PLAYER_COLUMNS: FoundationTableColumn[] = [
  { id: "player", label: "Spieler", dataKey: "player", defaultWidth: 220, minWidth: 160 },
  { id: "team", label: "Team", dataKey: "team", defaultWidth: 160, minWidth: 120 },
  { id: "seasons", label: "Seasons", dataKey: "seasons", defaultWidth: 90, minWidth: 76 },
  { id: "points", label: "Punkte", dataKey: "points", defaultWidth: 100, minWidth: 82 },
  { id: "avg", label: "Ø Beitrag", dataKey: "avg", defaultWidth: 105, minWidth: 88 },
  { id: "top10", label: "Top 10", dataKey: "top10", defaultWidth: 86, minWidth: 72 },
  { id: "mvp", label: "MVP", dataKey: "mvp", defaultWidth: 78, minWidth: 66 },
  { id: "xp", label: "XP", dataKey: "xp", defaultWidth: 82, minWidth: 68 },
  { id: "attrDelta", label: "Attr Δ", dataKey: "attrDelta", defaultWidth: 88, minWidth: 74 },
  { id: "mwDelta", label: "MW Δ", dataKey: "mwDelta", defaultWidth: 96, minWidth: 80 },
  { id: "salaryDelta", label: "Salary Δ", dataKey: "salaryDelta", defaultWidth: 108, minWidth: 90 },
  { id: "value", label: "Value", dataKey: "value", defaultWidth: 96, minWidth: 80 },
];

export const MULTI_SEASON_GAMEPLAY_COLUMNS: FoundationTableColumn[] = [
  { id: "metric", label: "Metrik", dataKey: "metric", defaultWidth: 220, minWidth: 160 },
  { id: "value", label: "Wert", dataKey: "value", defaultWidth: 220, minWidth: 160 },
  { id: "signal", label: "Signal", dataKey: "signal", defaultWidth: 100, minWidth: 82 },
  { id: "warning", label: "Warning", dataKey: "warning", defaultWidth: 180, minWidth: 130 },
  { id: "source", label: "Source", dataKey: "source", defaultWidth: 260, minWidth: 180 },
];

function uniqueColumnIds(columnIds: string[]) {
  return [...new Set(columnIds.filter(Boolean))];
}

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

  const columnById = new Map(baseColumns.map((column) => [column.id, column]));
  const leftPinnedColumns = uniqueColumnIds(pinnedLeft ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const rightPinnedColumns = uniqueColumnIds(pinnedRight ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const handled = new Set([...leftPinnedColumns, ...rightPinnedColumns].map((column) => column.id));
  const middleColumns = baseColumns.filter((column) => !handled.has(column.id));

  return [...leftPinnedColumns, ...middleColumns, ...rightPinnedColumns];
}

export type UseCockpitPanelDerivationsInput = {
  gameState: GameState;
  resolvePreviewFeed: FoundationResolvePreviewResponse | null;
  featureAuditFilter: FeatureAuditFilter;
  tableColumnPreferences: Record<string, { columnOrder?: string[] } | undefined>;
  tableSorts: {
    multiSeasonTeamBalanceTable?: SortState;
    multiSeasonEconomyTable?: SortState;
    multiSeasonPlayerProgressionTable?: SortState;
    multiSeasonGameplayTable?: SortState;
  };
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
};

/**
 * Cockpit panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationCockpitHost` is mounted (`activeView === "cockpit"`).
 */
export function useCockpitPanelDerivations(input: UseCockpitPanelDerivationsInput) {
  const lineupStatusSummary = useMemo(() => {
    const rows = input.resolvePreviewFeed?.teamRows ?? [];
    const missingTeams = rows.filter((row) => row.readinessStatus === "missing_lineup").length;
    const incompleteTeams = rows.filter((row) =>
      ["underfilled_roster", "invalid_lineup", "missing_score_coverage"].includes(row.readinessStatus),
    ).length;
    const readyTeams = rows.filter((row) => row.readinessStatus === "ready").length;
    return {
      totalTeams: rows.length,
      readyTeams,
      missingTeams,
      incompleteTeams,
    };
  }, [input.resolvePreviewFeed]);

  const lineupModifierStatusSummary = useMemo(() => {
    const currentDrafts = (input.gameState.seasonState.lineupDrafts ?? []).filter(
      (draft) =>
        draft.seasonId === input.gameState.season.id &&
        draft.matchdayId === input.gameState.matchdayState.matchdayId,
    );
    const selectedFormCards = currentDrafts.reduce((sum, draft) => {
      const d1 = draft.modifiers?.d1;
      const d2 = draft.modifiers?.d2;
      return (
        sum +
        [d1?.primaryFormCardId, d1?.secondaryFormCardId, d2?.primaryFormCardId, d2?.secondaryFormCardId].filter(Boolean)
          .length
      );
    }, 0);
    const selectedMutators = currentDrafts.reduce((sum, draft) => {
      const d1 = draft.modifiers?.d1;
      const d2 = draft.modifiers?.d2;
      return sum + [d1?.mutatorTrait1, d1?.mutatorTrait2, d2?.mutatorTrait1, d2?.mutatorTrait2].filter(Boolean).length;
    }, 0);

    return {
      formCardSourceStatus: "ready" as const,
      formCardEffectStatus: "ready" as const,
      mutatorSourceStatus: "ready" as const,
      mutatorEffectStatus: "ready" as const,
      selectedFormCards,
      selectedMutators,
    };
  }, [
    input.gameState.matchdayState.matchdayId,
    input.gameState.season.id,
    input.gameState.seasonState.lineupDrafts,
  ]);

  const multiSeasonBalanceDashboard = useMemo(
    () => buildMultiSeasonBalanceDashboard(input.gameState),
    [input.gameState],
  );

  const featureAuditMatrix = useMemo(() => buildFeatureAuditMatrix(), []);

  const filteredFeatureAuditEntries = useMemo(
    () => filterFeatureAuditEntries(featureAuditMatrix.entries, input.featureAuditFilter),
    [input.featureAuditFilter, featureAuditMatrix.entries],
  );

  const visibleMultiSeasonTeamBalanceColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        MULTI_SEASON_TEAM_BALANCE_COLUMNS,
        input.tableColumnPreferences.multiSeasonTeamBalanceTable?.columnOrder,
        input.getTablePinnedLeftIds("multiSeasonTeamBalanceTable"),
        input.getTablePinnedRightIds("multiSeasonTeamBalanceTable"),
      ).filter((column) =>
        input.isTableColumnVisible("multiSeasonTeamBalanceTable", column.id, column.visibleByDefault),
      ),
    [
      input.getTablePinnedLeftIds,
      input.getTablePinnedRightIds,
      input.isTableColumnVisible,
      input.tableColumnPreferences,
    ],
  );

  const visibleMultiSeasonEconomyColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        MULTI_SEASON_ECONOMY_COLUMNS,
        input.tableColumnPreferences.multiSeasonEconomyTable?.columnOrder,
        input.getTablePinnedLeftIds("multiSeasonEconomyTable"),
        input.getTablePinnedRightIds("multiSeasonEconomyTable"),
      ).filter((column) =>
        input.isTableColumnVisible("multiSeasonEconomyTable", column.id, column.visibleByDefault),
      ),
    [
      input.getTablePinnedLeftIds,
      input.getTablePinnedRightIds,
      input.isTableColumnVisible,
      input.tableColumnPreferences,
    ],
  );

  const visibleMultiSeasonPlayerColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        MULTI_SEASON_PLAYER_COLUMNS,
        input.tableColumnPreferences.multiSeasonPlayerProgressionTable?.columnOrder,
        input.getTablePinnedLeftIds("multiSeasonPlayerProgressionTable"),
        input.getTablePinnedRightIds("multiSeasonPlayerProgressionTable"),
      ).filter((column) =>
        input.isTableColumnVisible("multiSeasonPlayerProgressionTable", column.id, column.visibleByDefault),
      ),
    [
      input.getTablePinnedLeftIds,
      input.getTablePinnedRightIds,
      input.isTableColumnVisible,
      input.tableColumnPreferences,
    ],
  );

  const visibleMultiSeasonGameplayColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        MULTI_SEASON_GAMEPLAY_COLUMNS,
        input.tableColumnPreferences.multiSeasonGameplayTable?.columnOrder,
        input.getTablePinnedLeftIds("multiSeasonGameplayTable"),
        input.getTablePinnedRightIds("multiSeasonGameplayTable"),
      ).filter((column) =>
        input.isTableColumnVisible("multiSeasonGameplayTable", column.id, column.visibleByDefault),
      ),
    [
      input.getTablePinnedLeftIds,
      input.getTablePinnedRightIds,
      input.isTableColumnVisible,
      input.tableColumnPreferences,
    ],
  );

  const sortedMultiSeasonTeamRows = useMemo(
    () =>
      sortFoundationTableRows(multiSeasonBalanceDashboard.teamRows, input.tableSorts.multiSeasonTeamBalanceTable, {
        team: (row: MultiSeasonBalanceTeamRow) => row.teamName,
        seasons: (row) => row.seasons,
        champions: (row) => row.championCount,
        avgRank: (row) => row.averageRank ?? 99,
        bestRank: (row) => row.bestRank ?? 99,
        worstRank: (row) => row.worstRank ?? 99,
        rankDelta: (row) => row.rankDelta ?? 0,
        avgPoints: (row) => row.averagePoints ?? 0,
        top5: (row) => row.top5Count,
        bottom5: (row) => row.bottom5Count,
        points: (row) => row.pointsBySeason,
        source: (row) => row.source,
      }),
    [multiSeasonBalanceDashboard.teamRows, input.tableSorts.multiSeasonTeamBalanceTable],
  );

  const sortedMultiSeasonEconomyRows = useMemo(
    () =>
      sortFoundationTableRows(multiSeasonBalanceDashboard.economyRows, input.tableSorts.multiSeasonEconomyTable, {
        team: (row: MultiSeasonBalanceEconomyRow) => row.teamName,
        cash: (row) => row.cashCurrent ?? 0,
        cashAvg: (row) => row.cashEndAverage ?? 0,
        cashMax: (row) => row.cashMax ?? 0,
        salary: (row) => row.salaryCurrent ?? 0,
        salaryRatio: (row) => row.salaryRatio ?? 0,
        transferSpend: (row) => row.transferSpend,
        transferIncome: (row) => row.transferIncome,
        transferNet: (row) => row.transferNet,
        facilityNet: (row) => row.facilityNet,
        warning: (row) => row.warning ?? "",
      }),
    [multiSeasonBalanceDashboard.economyRows, input.tableSorts.multiSeasonEconomyTable],
  );

  const sortedMultiSeasonPlayerRows = useMemo(
    () =>
      sortFoundationTableRows(
        multiSeasonBalanceDashboard.playerRows,
        input.tableSorts.multiSeasonPlayerProgressionTable,
        {
          player: (row: MultiSeasonBalancePlayerRow) => row.playerName,
          team: (row) => row.teamName ?? "",
          seasons: (row) => row.seasons,
          points: (row) => row.totalPoints ?? 0,
          avg: (row) => row.averageContribution ?? 0,
          top10: (row) => row.top10Count,
          mvp: (row) => row.mvpCount,
          xp: (row) => row.xpSpent,
          attrDelta: (row) => row.attributeDelta,
          mwDelta: (row) => row.marketValueDelta ?? 0,
          salaryDelta: (row) => row.salaryPreviewDelta ?? 0,
          value: (row) => row.valueSignal ?? 0,
        },
      ),
    [multiSeasonBalanceDashboard.playerRows, input.tableSorts.multiSeasonPlayerProgressionTable],
  );

  const sortedMultiSeasonGameplayRows = useMemo(
    () =>
      sortFoundationTableRows(multiSeasonBalanceDashboard.gameplayRows, input.tableSorts.multiSeasonGameplayTable, {
        metric: (row: MultiSeasonBalanceGameplayRow) => row.metric,
        value: (row) => row.value,
        signal: (row) => row.signal ?? 0,
        warning: (row) => row.warning ?? "",
        source: (row) => row.source,
      }),
    [multiSeasonBalanceDashboard.gameplayRows, input.tableSorts.multiSeasonGameplayTable],
  );

  return {
    cockpitQuickLinks: COCKPIT_QUICK_LINKS,
    lineupStatusSummary,
    lineupModifierStatusSummary,
    multiSeasonBalanceDashboard,
    multiSeasonTeamBalanceColumns: MULTI_SEASON_TEAM_BALANCE_COLUMNS,
    multiSeasonEconomyColumns: MULTI_SEASON_ECONOMY_COLUMNS,
    multiSeasonPlayerColumns: MULTI_SEASON_PLAYER_COLUMNS,
    multiSeasonGameplayColumns: MULTI_SEASON_GAMEPLAY_COLUMNS,
    featureAuditMatrix,
    filteredFeatureAuditEntries,
    visibleMultiSeasonTeamBalanceColumns,
    visibleMultiSeasonEconomyColumns,
    visibleMultiSeasonPlayerColumns,
    visibleMultiSeasonGameplayColumns,
    sortedMultiSeasonTeamRows,
    sortedMultiSeasonEconomyRows,
    sortedMultiSeasonPlayerRows,
    sortedMultiSeasonGameplayRows,
  };
}

export { EMPTY_FEATURE_AUDIT_MATRIX, EMPTY_MULTI_SEASON_BALANCE_DASHBOARD };
