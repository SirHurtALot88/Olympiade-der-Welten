"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { TeamDetailDrawerHistoryRow } from "@/app/foundation/TeamDetailDrawer";
import {
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_LABELS,
  isSeasonDisciplineKey,
  type SeasonDisciplineAreaId,
} from "@/lib/season/season-discipline-area-groups";
import type { GlobalTableColumnConfig } from "@/lib/ui/global-table-layout";
import { useFoundationTableLayout } from "@/lib/ui/use-foundation-table-layout";

const TEAM_DRAWER_HISTORY_PREFIX_COLUMNS: GlobalTableColumnConfig[] = [
  { id: "season", label: "Saison", dataKey: "season", defaultWidth: 108, minWidth: 88, draggable: false },
  { id: "rank", label: "Platz", dataKey: "rank", defaultWidth: 72, minWidth: 56, align: "right" },
  { id: "points", label: "Punkte", dataKey: "points", defaultWidth: 80, minWidth: 64, align: "right" },
  { id: "pps", label: "PPs", dataKey: "pps", defaultWidth: 72, minWidth: 56, align: "right" },
];

const TEAM_DRAWER_HISTORY_AXIS_COLUMN: Record<SeasonDisciplineAreaId, GlobalTableColumnConfig> = {
  pow: { id: "pow", label: "POW", dataKey: "pow", defaultWidth: 64, minWidth: 52, align: "right", group: "attributes" },
  spe: { id: "spe", label: "SPE", dataKey: "spe", defaultWidth: 64, minWidth: 52, align: "right", group: "attributes" },
  men: { id: "men", label: "MEN", dataKey: "men", defaultWidth: 64, minWidth: 52, align: "right", group: "attributes" },
  soc: { id: "soc", label: "SOC", dataKey: "soc", defaultWidth: 64, minWidth: 52, align: "right", group: "attributes" },
};

const TEAM_DRAWER_HISTORY_SUFFIX_COLUMNS: GlobalTableColumnConfig[] = [
  { id: "cash", label: "Cash", dataKey: "cash", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
  { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 80, minWidth: 64, align: "right", group: "finance" },
  { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
  { id: "guv", label: "GuV", dataKey: "guv", defaultWidth: 76, minWidth: 60, align: "right", group: "finance" },
  { id: "topBuy", label: "Top Einkauf", dataKey: "topBuy", defaultWidth: 160, minWidth: 120, group: "detail" },
  { id: "topSell", label: "Top Verkauf", dataKey: "topSell", defaultWidth: 160, minWidth: 120, group: "detail" },
];

type TeamHistoryAxisToneVariant = "drawer" | "teams-v2";

function getAxisToneClass(areaId: SeasonDisciplineAreaId, variant: TeamHistoryAxisToneVariant) {
  if (variant === "teams-v2") {
    if (areaId === "pow") return "is-pow";
    if (areaId === "spe") return "is-spe";
    if (areaId === "men") return "is-men";
    return "is-soc";
  }

  if (areaId === "pow") return "is-power";
  if (areaId === "spe") return "is-speed";
  if (areaId === "men") return "is-mental";
  return "is-social";
}

function getColumnAxisClass(columnId: string, variant: TeamHistoryAxisToneVariant) {
  const baseClass = variant === "teams-v2" ? "teams-v2-area-cell" : "team-drawer-history-area";
  const areaId = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.id === columnId)?.id;
  if (areaId) {
    return `${baseClass} ${getAxisToneClass(areaId, variant)}`;
  }

  if (isSeasonDisciplineKey(columnId)) {
    const disciplineGroup = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.keys.includes(columnId));
    if (disciplineGroup) {
      return `${baseClass} ${getAxisToneClass(disciplineGroup.id, variant)} is-discipline-child`;
    }
  }

  return undefined;
}

type TeamDrawerHistoryTableProps = {
  rows: TeamDetailDrawerHistoryRow[];
  tableClassName?: string;
  shellClassName?: string;
  axisToneVariant?: TeamHistoryAxisToneVariant;
  renderCell: (columnId: string, row: TeamDetailDrawerHistoryRow) => ReactNode;
  getHeaderClassName?: (columnId: string) => string | undefined;
  getRowClassName?: (row: TeamDetailDrawerHistoryRow) => string | undefined;
};

export default function TeamDrawerHistoryTable({
  rows,
  tableClassName = "team-table teams-v2-history-table",
  shellClassName = "table-shell teams-history-shell",
  axisToneVariant = "teams-v2",
  renderCell,
  getHeaderClassName,
  getRowClassName,
}: TeamDrawerHistoryTableProps) {
  const [expandedAreas, setExpandedAreas] = useState<Record<SeasonDisciplineAreaId, boolean>>({
    pow: false,
    spe: false,
    men: false,
    soc: false,
  });

  const tableColumns = useMemo(() => {
    const axisColumns = SEASON_DISCIPLINE_AREA_GROUPS.flatMap((group) => {
      const items: GlobalTableColumnConfig[] = [TEAM_DRAWER_HISTORY_AXIS_COLUMN[group.id]];
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

    return [...TEAM_DRAWER_HISTORY_PREFIX_COLUMNS, ...axisColumns, ...TEAM_DRAWER_HISTORY_SUFFIX_COLUMNS];
  }, [expandedAreas]);

  const tableId = "teamDrawerHistoryTable";
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
          className={`season-v2-expand-header team-drawer-history-expand-header${expandedAreas[areaId] ? " is-expanded" : ""}`}
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
    <div className={shellClassName}>
      <table className={tableClassName}>
        <colgroup>
          {visibleColumns.map((column) => (
            <col key={column.id} style={{ width: `${getTableColumnWidth(column)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleColumns.map((column) => {
              const axisClassName = getColumnAxisClass(column.id, axisToneVariant) ?? getHeaderClassName?.(column.id);
              const isExpandableAxis = column.id === "pow" || column.id === "spe" || column.id === "men" || column.id === "soc";

              return (
                <th
                  key={column.id}
                  {...(column.draggable === false ? {} : getTableHeaderDragProps(column))}
                  className={axisClassName ?? undefined}
                  style={{ width: `${getTableColumnWidth(column)}px`, minWidth: `${column.minWidth}px` }}
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
            <tr key={`team-history-${row.seasonId}`} className={getRowClassName?.(row) ?? undefined}>
              {visibleColumns.map((column) => (
                <td
                  key={`${row.seasonId}-${column.id}`}
                  className={getColumnAxisClass(column.id, axisToneVariant) ?? getHeaderClassName?.(column.id) ?? undefined}
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
