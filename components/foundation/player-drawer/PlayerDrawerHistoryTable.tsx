"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { PlayerDrawerHistoryRow } from "@/lib/foundation/player-detail-drawer";
import {
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_LABELS,
  isSeasonDisciplineKey,
  type SeasonDisciplineAreaId,
} from "@/lib/season/season-discipline-area-groups";
import type { GlobalTableColumnConfig } from "@/lib/ui/global-table-layout";
import { useFoundationTableLayout } from "@/lib/ui/use-foundation-table-layout";

export const PLAYER_DRAWER_HISTORY_ABLOESE_TOOLTIP =
  "Theoretischer Verkaufswert inkl. archiviertem Sale-Faktor der Saison — nicht die Kaufablöse.";

export const PLAYER_DRAWER_HISTORY_AVERAGE_FATIGUE_TOOLTIP =
  "Durchschnittliche Erschöpfung vor dem Spieltag (0–100) über alle Einsätze mit gespeichertem Fatigue-Log.";

const PLAYER_DRAWER_HISTORY_PREFIX_COLUMNS: GlobalTableColumnConfig[] = [
  { id: "season", label: "Saison", dataKey: "season", defaultWidth: 108, minWidth: 88, draggable: false },
  { id: "team", label: "Team", dataKey: "team", defaultWidth: 72, minWidth: 56 },
  { id: "appearances", label: "Eins.", dataKey: "appearances", defaultWidth: 64, minWidth: 52, align: "right" },
  {
    id: "averageFatigue",
    label: "Ø Fatigue",
    dataKey: "averageFatigue",
    defaultWidth: 76,
    minWidth: 64,
    align: "right",
  },
  { id: "injuriesCount", label: "Verl.", dataKey: "injuriesCount", defaultWidth: 56, minWidth: 44, align: "right" },
  { id: "matchdaysMissed", label: "Ausfall", dataKey: "matchdaysMissed", defaultWidth: 64, minWidth: 52, align: "right" },
  { id: "pps", label: "PPs", dataKey: "pps", defaultWidth: 72, minWidth: 56, align: "right" },
  { id: "ovr", label: "OVR", dataKey: "ovr", defaultWidth: 72, minWidth: 56, align: "right" },
  { id: "mvs", label: "MVS", dataKey: "mvs", defaultWidth: 72, minWidth: 56, align: "right" },
];

const PLAYER_DRAWER_HISTORY_AXIS_COLUMN: Record<SeasonDisciplineAreaId, GlobalTableColumnConfig> = {
  pow: { id: "pow", label: "POW", dataKey: "pow", defaultWidth: 72, minWidth: 58, align: "right", group: "attributes" },
  spe: { id: "spe", label: "SPE", dataKey: "spe", defaultWidth: 72, minWidth: 58, align: "right", group: "attributes" },
  men: { id: "men", label: "MEN", dataKey: "men", defaultWidth: 72, minWidth: 58, align: "right", group: "attributes" },
  soc: { id: "soc", label: "SOC", dataKey: "soc", defaultWidth: 72, minWidth: 58, align: "right", group: "attributes" },
};

const PLAYER_DRAWER_HISTORY_SUFFIX_COLUMNS: GlobalTableColumnConfig[] = [
  {
    id: "abloese",
    label: "Verkaufswert",
    dataKey: "abloese",
    defaultWidth: 88,
    minWidth: 72,
    align: "right",
    group: "finance",
  },
  { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
  { id: "factor", label: "Faktor", dataKey: "factor", defaultWidth: 72, minWidth: 56, align: "right", group: "finance" },
  { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
  { id: "contractLength", label: "LZ", dataKey: "contractLength", defaultWidth: 56, minWidth: 44, align: "right" },
  { id: "bestDiscipline", label: "Beste Diszi", dataKey: "bestDiscipline", defaultWidth: 120, minWidth: 96 },
];

export const PLAYER_DRAWER_TRANSFER_HISTORY_COLUMNS: GlobalTableColumnConfig[] = [
  { id: "season", label: "Saison", dataKey: "season", defaultWidth: 88, minWidth: 72, draggable: false },
  { id: "date", label: "Datum", dataKey: "date", defaultWidth: 96, minWidth: 80 },
  { id: "type", label: "Typ", dataKey: "type", defaultWidth: 96, minWidth: 72 },
  { id: "from", label: "Von", dataKey: "from", defaultWidth: 120, minWidth: 88 },
  { id: "to", label: "Nach", dataKey: "to", defaultWidth: 120, minWidth: 88 },
  { id: "fee", label: "Ablöse", dataKey: "fee", defaultWidth: 80, minWidth: 64, align: "right", group: "finance" },
  { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
  { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
];

function getAxisToneClass(areaId: SeasonDisciplineAreaId) {
  if (areaId === "pow") return "is-power";
  if (areaId === "spe") return "is-speed";
  if (areaId === "men") return "is-mental";
  return "is-social";
}

function getColumnAxisClass(columnId: string) {
  const areaId = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.id === columnId)?.id;
  if (areaId) {
    return `player-drawer-history-axis ${getAxisToneClass(areaId)}`;
  }

  if (isSeasonDisciplineKey(columnId)) {
    const disciplineGroup = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.keys.includes(columnId));
    if (disciplineGroup) {
      return `player-drawer-history-axis ${getAxisToneClass(disciplineGroup.id)} is-discipline-child`;
    }
  }

  return undefined;
}

type PlayerDrawerHistoryTableProps = {
  rows: PlayerDrawerHistoryRow[];
  renderCell: (columnId: string, row: PlayerDrawerHistoryRow) => ReactNode;
  getHeaderTooltip?: (columnId: string) => string | undefined;
  getHeaderClassName?: (columnId: string) => string | undefined;
};

export function PlayerDrawerHistoryTable({
  rows,
  renderCell,
  getHeaderTooltip,
  getHeaderClassName,
}: PlayerDrawerHistoryTableProps) {
  const [expandedAreas, setExpandedAreas] = useState<Record<SeasonDisciplineAreaId, boolean>>({
    pow: false,
    spe: false,
    men: false,
    soc: false,
  });

  const tableColumns = useMemo(() => {
    const axisColumns = SEASON_DISCIPLINE_AREA_GROUPS.flatMap((group) => {
      const items: GlobalTableColumnConfig[] = [PLAYER_DRAWER_HISTORY_AXIS_COLUMN[group.id]];
      if (expandedAreas[group.id]) {
        items.push(
          ...group.keys.map((key) => ({
            id: key,
            label: SEASON_DISCIPLINE_LABELS[key],
            dataKey: key,
            defaultWidth: 62,
            minWidth: 52,
            align: "right" as const,
            group: "attributes" as const,
            draggable: false,
          })),
        );
      }
      return items;
    });

    return [...PLAYER_DRAWER_HISTORY_PREFIX_COLUMNS, ...axisColumns, ...PLAYER_DRAWER_HISTORY_SUFFIX_COLUMNS];
  }, [expandedAreas]);

  const tableId = "playerDrawerHistoryTable";
  const { visibleColumns, getTableColumnWidth, startTableColumnResize, resetTableColumnWidth, getTableHeaderDragProps } =
    useFoundationTableLayout(tableId, tableColumns);

  function toggleExpandedArea(areaId: SeasonDisciplineAreaId) {
    setExpandedAreas((current) => ({ ...current, [areaId]: !current[areaId] }));
  }

  function renderHeaderLabel(column: GlobalTableColumnConfig) {
    if (column.id === "pow" || column.id === "spe" || column.id === "men" || column.id === "soc") {
      const areaId = column.id as SeasonDisciplineAreaId;
      return (
        <button
          type="button"
          className={`season-v2-expand-header player-drawer-history-expand-header${expandedAreas[areaId] ? " is-expanded" : ""}`}
          onClick={() => toggleExpandedArea(areaId)}
          aria-expanded={expandedAreas[areaId]}
        >
          <span>{column.label}</span>
          <b>{expandedAreas[areaId] ? "−" : "+"}</b>
        </button>
      );
    }

    return column.label;
  }

  return (
    <div className="table-shell player-drawer-history-table-shell">
      <table className="team-table player-drawer-history-table">
        <colgroup>
          {visibleColumns.map((column) => (
            <col key={column.id} style={{ width: `${getTableColumnWidth(column)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleColumns.map((column) => {
              const axisClassName = getColumnAxisClass(column.id) ?? getHeaderClassName?.(column.id);
              const isExpandableAxis = column.id === "pow" || column.id === "spe" || column.id === "men" || column.id === "soc";

              return (
                <th
                  key={column.id}
                  {...(column.draggable === false ? {} : getTableHeaderDragProps(column))}
                  className={axisClassName ?? undefined}
                  style={{ width: `${getTableColumnWidth(column)}px`, minWidth: `${column.minWidth}px` }}
                  title={getHeaderTooltip?.(column.id)}
                >
                  <div className="table-header-cell">
                    <span>{renderHeaderLabel(column)}</span>
                    {isExpandableAxis ? null : (
                      <span
                        className="column-resizer"
                        draggable={false}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`${column.label} Breite anpassen`}
                        onMouseDown={(event) => startTableColumnResize(column, event)}
                        onDoubleClick={() => resetTableColumnWidth(column)}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.seasonId ?? row.seasonName}-${row.sourceLabel}`}>
              {visibleColumns.map((column) => (
                <td
                  key={`${row.seasonId ?? row.seasonName}-${column.id}`}
                  className={getColumnAxisClass(column.id) ?? getHeaderClassName?.(column.id) ?? undefined}
                >
                  {renderCell(column.id, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PlayerDrawerTransferHistoryTableProps = {
  rows: Array<{
    id: string;
    seasonLabel: string;
    happenedAt: string;
    transferType: "buy" | "sell" | "contract_exit";
    fromTeamName: string | null;
    toTeamName: string | null;
    fee: number | null;
    salary: number | null;
    marketValue: number | null;
  }>;
  renderCell: (columnId: string, row: PlayerDrawerTransferHistoryTableProps["rows"][number]) => ReactNode;
};

export function PlayerDrawerTransferHistoryTable({ rows, renderCell }: PlayerDrawerTransferHistoryTableProps) {
  const tableId = "playerDrawerTransferHistoryTable";
  const { visibleColumns, getTableColumnWidth, startTableColumnResize, resetTableColumnWidth, getTableHeaderDragProps } =
    useFoundationTableLayout(tableId, PLAYER_DRAWER_TRANSFER_HISTORY_COLUMNS);

  return (
    <div className="table-shell player-drawer-transfer-history-shell">
      <table className="team-table player-drawer-transfer-history-table">
        <colgroup>
          {visibleColumns.map((column) => (
            <col key={column.id} style={{ width: `${getTableColumnWidth(column)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleColumns.map((column) => (
              <th
                key={column.id}
                {...getTableHeaderDragProps(column)}
                style={{ width: `${getTableColumnWidth(column)}px`, minWidth: `${column.minWidth}px` }}
              >
                <div className="table-header-cell">
                  <span>{column.label}</span>
                  <span
                    className="column-resizer"
                    draggable={false}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${column.label} Breite anpassen`}
                    onMouseDown={(event) => startTableColumnResize(column, event)}
                    onDoubleClick={() => resetTableColumnWidth(column)}
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {visibleColumns.map((column) => (
                <td key={`${row.id}-${column.id}`}>{renderCell(column.id, row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
