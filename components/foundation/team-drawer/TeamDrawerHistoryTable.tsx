"use client";

import { useMemo, useState, type ReactNode } from "react";

import { formatNlNumber, formatNlSignedNumber } from "@/components/foundation/new-look";
import type { TeamDetailDrawerHistoryRow } from "@/lib/foundation/team-detail-drawer-types";
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
  { id: "injuriesCount", label: "Verletz.", dataKey: "injuriesCount", defaultWidth: 72, minWidth: 56, align: "right", group: "health" },
  { id: "averageFatigue", label: "Ø Fatigue", dataKey: "averageFatigue", defaultWidth: 80, minWidth: 64, align: "right", group: "health" },
  { id: "topBuy", label: "Top Einkauf", dataKey: "topBuy", defaultWidth: 160, minWidth: 120, group: "detail" },
  { id: "topSell", label: "Top Verkauf", dataKey: "topSell", defaultWidth: 160, minWidth: 120, group: "detail" },
];

/**
 * Erklärtexte am Spaltenkopf — nur dort, wo die Spalte einen anderen Zeitpunkt meint, als der
 * Kopf vermuten lässt. Cash steht auf dem EINTRITTSSTAND der Folgesaison (siehe die Begründung in
 * `use-foundation-cross-tab-teams-roster.ts`), Gehalt und MW auf dem Saisonabschluss. Ohne diesen
 * Hinweis liest man die drei Spalten als einen Moment — und genau die Verwechslung hat die
 * Cash-Spalte vorher ausgelöst.
 */
const TEAM_DRAWER_HISTORY_SPALTEN_HINWEIS: Record<string, string> = {
  cash: "Kontostand zu Beginn der Folgesaison — nach Verkäufen, Käufen und Kaderfüllung. Nicht der Stand am Saisonende.",
  salary: "Gehaltssumme am Saisonende, vor dem ersten Verkauf.",
  mw: "Marktwert am Saisonende, nach dem Trainings-Apply und vor dem ersten Verkauf.",
};

/**
 * GEWÜNSCHT: „hier hätte ich auch gerne in season 2 den vergleich zu s1 dahinter also
 * POW 12,5 (+4,2) auch bei gehalt mw usw" — und auf Nachfrage: überall gleich, also auch im
 * Team-Drawer, nicht nur im Team-Profil. Deshalb sitzt die Rechnung HIER in der geteilten
 * Tabelle und nicht in einer der beiden Ansichten.
 *
 * Nur an der LIVE-Zeile. Die archivierten Saisons stehen für sich; ein Delta an jeder Zeile wäre
 * eine zweite, konkurrierende Lesart derselben Tabelle.
 *
 * `richtung` steuert allein die FARBE, nie das Vorzeichen:
 *   higher   mehr ist besser (Punkte, PPs, Achsen, Cash, MW)
 *   lower    weniger ist besser (Verletzungen, Fatigue)
 *   neutral  keine Wertung — ein größerer Gehaltsblock kann ein stärkerer Kader oder eine Last sein
 */
type VergleichsRichtung = "higher" | "lower" | "neutral";

const VORSAISON_VERGLEICH: Record<
  string,
  { lies: (row: TeamDetailDrawerHistoryRow) => number | null | undefined; digits: number; richtung: VergleichsRichtung }
> = {
  // Rang invertiert: von #20 auf #12 ist eine VERBESSERUNG um 8 Plätze, also (+8).
  rank: { lies: (row) => (row.rank == null ? null : -row.rank), digits: 0, richtung: "higher" },
  points: { lies: (row) => row.points, digits: 1, richtung: "higher" },
  pps: { lies: (row) => row.pps, digits: 1, richtung: "higher" },
  pow: { lies: (row) => row.ppPow, digits: 1, richtung: "higher" },
  spe: { lies: (row) => row.ppSpe, digits: 1, richtung: "higher" },
  men: { lies: (row) => row.ppMen, digits: 1, richtung: "higher" },
  soc: { lies: (row) => row.ppSoc, digits: 1, richtung: "higher" },
  cash: { lies: (row) => row.cash, digits: 1, richtung: "higher" },
  salary: { lies: (row) => row.salaryTotal, digits: 2, richtung: "neutral" },
  mw: { lies: (row) => row.marketValue, digits: 2, richtung: "higher" },
  injuriesCount: { lies: (row) => row.injuriesCount, digits: 0, richtung: "lower" },
  averageFatigue: { lies: (row) => row.averageFatigue, digits: 1, richtung: "lower" },
};

function istZahl(wert: number | null | undefined): wert is number {
  return typeof wert === "number" && Number.isFinite(wert);
}

function vergleichsKlasse(delta: number, richtung: VergleichsRichtung) {
  if (richtung === "neutral") {
    return "";
  }
  const gut = richtung === "higher" ? delta > 0 : delta < 0;
  return gut ? " text-positive" : " text-negative";
}

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
  /**
   * Summenzeile unter den Saisons: PPs über alle Saisons und der Rang des Teams darin.
   * Fehlt sie oder ist die Summe leer, entfaellt die Zeile — eine Zeile mit „—" traegt nichts bei.
   */
  allTime?: { pps: number | null; rank: number | null; teamCount: number | null } | null;
};

export default function TeamDrawerHistoryTable({
  rows,
  tableClassName = "team-table teams-v2-history-table",
  shellClassName = "table-shell teams-history-shell",
  axisToneVariant = "teams-v2",
  renderCell,
  getHeaderClassName,
  getRowClassName,
  allTime = null,
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

  /** Jüngste abgeschlossene Saison — Bezugspunkt für das Delta an der Live-Zeile. */
  const vorsaisonZeile = useMemo(() => rows.find((row) => !row.isLive) ?? null, [rows]);

  function renderVorsaisonDelta(columnId: string, row: TeamDetailDrawerHistoryRow) {
    if (!row.isLive || vorsaisonZeile == null || vorsaisonZeile === row) {
      return null;
    }
    const regel = VORSAISON_VERGLEICH[columnId];
    if (!regel) {
      return null;
    }
    const aktuell = regel.lies(row);
    const vorher = regel.lies(vorsaisonZeile);
    if (!istZahl(aktuell) || !istZahl(vorher)) {
      return null;
    }
    const delta = aktuell - vorher;
    // Unterhalb der angezeigten Genauigkeit waere "(+0,0)" nur Rauschen.
    if (Math.abs(delta) < (regel.digits >= 2 ? 0.005 : regel.digits === 1 ? 0.05 : 0.5)) {
      return null;
    }
    return (
      <small className={`team-history-delta${vergleichsKlasse(delta, regel.richtung)}`}>
        {` (${formatNlSignedNumber(delta, regel.digits)})`}
      </small>
    );
  }

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
                  title={TEAM_DRAWER_HISTORY_SPALTEN_HINWEIS[column.id]}
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
                  {renderVorsaisonDelta(column.id, row)}
                </td>
              ))}
            </tr>
          ))}
          {allTime != null && typeof allTime.pps === "number" && Number.isFinite(allTime.pps) ? (
            <tr className="team-history-alltime-row">
              {visibleColumns.map((column) => {
                if (column.id === "season") {
                  return (
                    <td key="alltime-season" className="team-history-alltime-label">
                      <strong>All Time</strong>
                    </td>
                  );
                }
                if (column.id === "pps") {
                  return (
                    <td key="alltime-pps" className="team-history-alltime-value">
                      <strong>{formatNlNumber(allTime.pps, 1)}</strong>
                    </td>
                  );
                }
                if (column.id === "rank" && allTime.rank != null) {
                  return (
                    <td key="alltime-rank" className="team-history-alltime-value">
                      <strong>{`#${allTime.rank}`}</strong>
                      {allTime.teamCount != null ? (
                        <small className="team-history-alltime-of">{` / ${allTime.teamCount}`}</small>
                      ) : null}
                    </td>
                  );
                }
                return <td key={`alltime-${column.id}`} />;
              })}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
