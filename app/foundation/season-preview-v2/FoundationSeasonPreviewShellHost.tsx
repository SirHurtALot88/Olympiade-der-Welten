"use client";

import type { ComponentType, MouseEvent } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationStandingsPreviewResponse, FoundationTableColumn, SortState } from "@/lib/foundation/tabs/cockpit-types";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { useSeasonPreviewDerivations } from "@/lib/foundation/tabs/use-season-preview-derivations";

type ColumnVisibilityManagerProps = {
  title: string;
  columns: FoundationTableColumn[];
  isVisible: (columnId: string, visibleByDefault?: boolean) => boolean;
  onToggle: (columnId: string, nextVisible: boolean) => void;
};

type SortableHeaderProps = {
  label: string;
  tableId: string;
  columnKey: string;
  sortState: SortState;
  onToggle: (tableId: string, columnKey: string) => void;
};

export type FoundationSeasonPreviewShellHostProps = {
  activeSaveId: string;
  gameState: GameState;
  standingsPreviewFeed: FoundationStandingsPreviewResponse | null;
  tableColumnPreferences: {
    standingsPreviewTable?: { columnOrder?: string[] };
  };
  tableSorts: { standingsPreview: SortState };
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault: boolean) => boolean;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  getTableHeaderDragProps: (
    tableId: string,
    column: FoundationTableColumn,
    visibleColumns: FoundationTableColumn[],
  ) => Record<string, unknown>;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: MouseEvent<HTMLSpanElement>) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  toggleTableSort: (tableId: string, columnKey: string) => void;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
  ColumnVisibilityManager: ComponentType<ColumnVisibilityManagerProps>;
  SortableHeader: ComponentType<SortableHeaderProps>;
  openTeamProfileById: (teamId: string) => void;
};

/**
 * Season preview shell host (Strangler Phase 5.3). Mounts standings preview panel
 * only while the seasonPreview tab is active.
 */
export default function FoundationSeasonPreviewShellHost({
  activeSaveId,
  gameState,
  standingsPreviewFeed,
  tableColumnPreferences,
  tableSorts,
  isTableColumnVisible,
  setTableColumnVisible,
  getTableColumnWidth,
  getTableHeaderDragProps,
  startTableColumnResize,
  resetTableColumnWidth,
  toggleTableSort,
  getTablePinnedLeftIds,
  getTablePinnedRightIds,
  ColumnVisibilityManager,
  SortableHeader,
  openTeamProfileById,
}: FoundationSeasonPreviewShellHostProps) {
  const { standingsPreviewColumns, visibleStandingsPreviewColumns, sortedStandingsPreviewRows } =
    useSeasonPreviewDerivations({
      standingsPreviewFeed,
      tableColumnPreferences,
      standingsPreviewSort: tableSorts.standingsPreview,
      isTableColumnVisible,
      getTablePinnedLeftIds,
      getTablePinnedRightIds,
    });

  return (
    <section className="panel" id="standings-preview">
      <div className="panel-header">
        <h2>Preview aus gespeicherten Results</h2>
        <ColumnVisibilityManager
          title="Spalten"
          columns={standingsPreviewColumns}
          isVisible={(columnId, visibleByDefault) =>
            isTableColumnVisible("standingsPreviewTable", columnId, visibleByDefault ?? false)
          }
          onToggle={(columnId, nextVisible) => setTableColumnVisible("standingsPreviewTable", columnId, nextVisible)}
        />
      </div>
      <p className="muted">
        Scope: {standingsPreviewFeed?.scope?.saveId ?? activeSaveId} / {standingsPreviewFeed?.scope?.seasonId ?? gameState.season.id} /{" "}
        {standingsPreviewFeed?.scope?.matchdayId ?? gameState.matchdayState.matchdayId} · Teams: {standingsPreviewFeed?.summary.totalTeams ?? 0}
      </p>
      <p className="muted">
        Diese Version nutzt globales Gesamtscoring aller Teams; keine Fame-/Draw-/Allianzlogik.
      </p>
      <p className="muted">
        Read-only. Diese Vorschau liest lokale gespeicherte Spieltagsergebnisse, berechnet Punkte-Delta und projected Rank, aber schreibt keine Standings-, Cash- oder Preisgeldwerte.
      </p>
      {standingsPreviewFeed?.blockedRules?.length ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <strong>Globales Gesamtranking aller Teams, ohne Fame-, Draw- oder Allianzlogik.</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            Die Preview kombiniert gespeicherte Matchday-Results mit dem aktuellen lokalen Punktestand und der Rank-to-Points-Tabelle.
            Offene Blocker betreffen nur fehlende Punkte-Mappings oder echte Tie-Breaker-Faelle.
          </p>
          <ul className="warning-list">
            {standingsPreviewFeed.blockedRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {standingsPreviewFeed.blockedRules.includes("global_score_tie_breaker_missing") &&
          (standingsPreviewFeed.tieGroups?.length ?? 0) > 0 ? (
            <div style={{ marginTop: 12 }}>
              <strong>Gleichstand erkannt: Tie-Breaker-Regel fehlt. Apply bleibt blockiert.</strong>
              <ul className="warning-list">
                {standingsPreviewFeed.tieGroups.map((group, index) => (
                  <li key={`${group.type}-${group.value}-${index}`}>
                    {group.type} {formatLocalePoints(group.value, 2)}:{" "}
                    {group.affectedTeams.map((team) => `${team.teamName} (${team.teamId})`).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="teams-summary-grid history-summary-grid">
        <article className="metric-card">
          <span>Stored Result</span>
          <strong>{standingsPreviewFeed?.summary.matchdayResultFound ? "gefunden" : "fehlend"}</strong>
        </article>
        <article className="metric-card">
          <span>Ready Teams</span>
          <strong>{standingsPreviewFeed?.summary.readyTeams ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Blocked Rules</span>
          <strong>{standingsPreviewFeed?.blockedRules.length ?? 0}</strong>
        </article>
      </div>
      <div className="table-shell">
        <table className="team-table">
          <colgroup>
            {visibleStandingsPreviewColumns.map((column) => (
              <col key={column.id} style={{ width: `${getTableColumnWidth("standingsPreviewTable", column)}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleStandingsPreviewColumns.map((column) => (
                <th
                  key={column.id}
                  {...getTableHeaderDragProps("standingsPreviewTable", column, visibleStandingsPreviewColumns)}
                  style={{ width: `${getTableColumnWidth("standingsPreviewTable", column)}px`, minWidth: `${column.minWidth}px` }}
                >
                  <div className="resizable-header-cell">
                    <SortableHeader
                      label={column.label}
                      tableId="standingsPreview"
                      columnKey={column.dataKey}
                      sortState={tableSorts.standingsPreview}
                      onToggle={toggleTableSort}
                    />
                    <span
                      className="column-resizer"
                      draggable={false}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`${column.label} Breite anpassen`}
                      onMouseDown={(event) => startTableColumnResize("standingsPreviewTable", column, event)}
                      onDoubleClick={() => resetTableColumnWidth("standingsPreviewTable", column)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStandingsPreviewRows.map((row) => (
              <tr key={row.teamId} onClick={() => openTeamProfileById(row.teamId)}>
                {visibleStandingsPreviewColumns.map((column) => {
                  if (column.id === "team") return <td key={column.id}><div className="table-team-cell"><strong>{row.teamName}</strong><span>{row.teamId}</span></div></td>;
                  if (column.id === "warnings") return <td key={column.id}>{row.warnings.join(", ") || "—"}</td>;
                  if (column.id === "readinessStatus") return <td key={column.id}>{row.readinessStatus}</td>;
                  if (column.id === "resultStatus") return <td key={column.id}>{row.resultStatus}</td>;
                  if (column.id === "currentRank") return <td key={column.id}>{row.currentRank ?? "—"}</td>;
                  if (column.id === "projectedRank") return <td key={column.id}>{row.projectedRank ?? "—"}</td>;
                  if (column.id === "currentPoints") return <td key={column.id}>{row.currentPoints ?? "BLOCKED"}</td>;
                  if (column.id === "projectedPoints") return <td key={column.id}>{row.projectedPoints ?? "—"}</td>;
                  if (column.id === "pointsDelta") return <td key={column.id}>{row.pointsDelta ?? "—"}</td>;
                  if (column.id === "matchdayRank") return <td key={column.id}>{row.matchdayRank ?? "—"}</td>;
                  if (column.id === "matchdayScore") return <td key={column.id}>{row.matchdayScore != null ? formatLocalePoints(row.matchdayScore, 2) : "—"}</td>;
                  if (column.id === "d1Score") return <td key={column.id}>{row.d1Score != null ? formatLocalePoints(row.d1Score) : "—"}</td>;
                  if (column.id === "d2Score") return <td key={column.id}>{row.d2Score != null ? formatLocalePoints(row.d2Score) : "—"}</td>;
                  if (column.id === "cash") return <td key={column.id}>{row.cash != null ? formatTransfermarktCurrency(row.cash) : "—"}</td>;
                  return <td key={column.id}>{row.totalScore != null ? formatLocalePoints(row.totalScore) : "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
