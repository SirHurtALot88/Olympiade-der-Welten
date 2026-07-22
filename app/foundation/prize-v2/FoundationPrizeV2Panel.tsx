"use client";

import type * as React from "react";

import FoundationPrizeV2NewLook from "@/app/foundation/prize-v2/FoundationPrizeV2NewLook";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type {
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
  FoundationTableColumn,
  SortState,
} from "@/lib/foundation/tabs/cockpit-types";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { CockpitStepStatus } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import type { PrizeV2Row } from "@/lib/foundation/tabs/use-prize-v2-panel-model";

export interface FoundationPrizeV2PanelProps {
  gameState: GameState;
  activeContextMeta: Parameters<typeof import("@/lib/foundation/tabs/foundation-format-render-helpers").getViewSourceBadgeLabel>[1];
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
  prizePreviewHardBlocked: string[];
  prizePreviewGlobalWarnings: string[];
  prizeApplyState: { status: CockpitStepStatus; label: string };
  seasonEndChampionRow: TeamManagementSnapshotRow | null;
  selectedTeam: Team | null;
  prizeForecastRank: number;
  setPrizeForecastRank: (value: number) => void;
  prizeForecastRankRow: FoundationPrizePreviewItem | null;
  prizeForecastRows: Array<{
    label: string;
    factor: number | null;
    prizeMoney: number | null;
    sponsorCash: number | null;
    facilityIncome: number | null;
    salaryTotal: number | null;
    loanInstallment: number | null;
    guv: number | null;
    cashAfter: number | null;
  }>;
  prizePreviewTableColumns: FoundationTableColumn[];
  visiblePrizePreviewColumns: FoundationTableColumn[];
  displayPrizePreviewRows: FoundationPrizePreviewItem[];
  prizeV2Summary: {
    calculableTeams: number;
    totalTeams: number;
  };
  prizeV2LeaderRow: PrizeV2Row | null;
  prizeV2TopSponsorRow: PrizeV2Row | null;
  prizeV2TotalSponsorCash: number;
  prizeV2SelectedTeamSummary: ReturnType<typeof Object> | null;
  prizeV2SwingRow: PrizeV2Row | null;
  prizeV2RiskRow: PrizeV2Row | null;
  prizeV2FactorRows: Array<{ seasonLabel: string; factor: number | null }>;
  tableSorts: { prizePreview: SortState };
  formatLocalePoints: (value: number | null | undefined, maximumFractionDigits?: number) => string;
  formatNullableMoney: (value: number | null | undefined) => string;
  formatSignedDisplayMoney: (value: number | null | undefined) => string;
  getViewSourceBadgeLabel: (view: string, meta: FoundationPrizeV2PanelProps["activeContextMeta"]) => string;
  setFoundationView: (view: string, setActiveView: (view: string) => void) => void;
  setActiveView: (view: string) => void;
  openTeamProfileById: (teamId: string) => void;
  getTableActivePreset: (tableId: string) => string | null;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  moveTableColumn: (tableId: string, columnId: string, direction: "left" | "right", columns: FoundationTableColumn[]) => void;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  adjustTableColumnWidth: (tableId: string, column: FoundationTableColumn, delta: number) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  resetTableLayout: (tableId: string, columns: FoundationTableColumn[]) => void;
  getTableHeaderDragProps: (
    tableId: string,
    column: FoundationTableColumn,
    columns: FoundationTableColumn[],
  ) => Record<string, unknown>;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: React.MouseEvent<HTMLSpanElement>) => void;
  toggleTableSort: (tableId: string, columnKey: string) => void;
  ColumnVisibilityManager: React.ComponentType<{
    title: string;
    columns: FoundationTableColumn[];
    activePreset?: string | null;
    isVisible: (columnId: string, visibleByDefault?: boolean) => boolean;
    onToggle: (columnId: string, nextVisible: boolean) => void;
    onMove?: (columnId: string, direction: "left" | "right") => void;
    getWidth?: (column: FoundationTableColumn) => number;
    onStepWidth?: (column: FoundationTableColumn, delta: number) => void;
    onResetWidth?: (column: FoundationTableColumn) => void;
    onResetToDefault?: () => void;
  }>;
  SortableHeader: React.ComponentType<{
    label: string;
    tableId: string;
    columnKey: string;
    sortState?: SortState;
    onToggle: (tableId: string, columnKey: string) => void;
  }>;
}

export default function FoundationPrizeV2Panel(props: FoundationPrizeV2PanelProps) {
  return <FoundationPrizeV2NewLook {...props} />;
}
