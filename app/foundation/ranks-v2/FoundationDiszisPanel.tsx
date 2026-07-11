"use client";

import type * as React from "react";
import type { ComponentProps, ComponentType } from "react";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { FoundationTableColumn, FoundationTablePresetId, SortState } from "@/lib/foundation/tabs/cockpit-types";
import type { ColumnVisibilityManager as ColumnVisibilityManagerComponent, SortableHeader as SortableHeaderComponent } from "@/components/foundation/FoundationTableUi";

type ColumnVisibilityManagerProps = ComponentProps<typeof ColumnVisibilityManagerComponent>;

type SortableHeaderProps = ComponentProps<typeof SortableHeaderComponent>;

export type DisciplineCategoryFilter = "all" | "power" | "speed" | "mental" | "social";

export interface FoundationDiszisPanelProps {
  disciplineConfigTableColumns: FoundationTableColumn[];
  visibleDisciplineConfigColumns: FoundationTableColumn[];
  disciplineCategoryFilter: DisciplineCategoryFilter;
  setDisciplineCategoryFilter: (value: DisciplineCategoryFilter) => void;
  visibleDisciplineConfigRows: Array<Record<string, unknown>>;
  seasonDisciplineScheduleRows: Array<Record<string, unknown>>;
  currentMatchdayId: string;
  getTableActivePreset: (tableId: string) => FoundationTablePresetId;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  setTableColumnVisible: (tableId: string, columnId: string, nextVisible: boolean) => void;
  moveTableColumn: (tableId: string, columnId: string, direction: "left" | "right", columns: FoundationTableColumn[]) => void;
  getTableColumnWidth: (tableId: string, column: FoundationTableColumn) => number;
  adjustTableColumnWidth: (tableId: string, column: FoundationTableColumn, delta: number) => void;
  resetTableColumnWidth: (tableId: string, column: FoundationTableColumn) => void;
  resetTableLayout: (tableId: string, columns: FoundationTableColumn[]) => void;
  getTableHeaderDragProps: (tableId: string, column: FoundationTableColumn, columns: FoundationTableColumn[]) => Record<string, unknown>;
  startTableColumnResize: (tableId: string, column: FoundationTableColumn, event: React.MouseEvent<HTMLSpanElement>) => void;
  tableSorts: { disciplineConfig: SortState };
  toggleTableSort: (tableId: string, columnKey: string) => void;
  ColumnVisibilityManager: ComponentType<ColumnVisibilityManagerProps>;
  SortableHeader: ComponentType<SortableHeaderProps>;
}

export default function FoundationDiszisPanel(props: FoundationDiszisPanelProps) {
  const {
    visibleDisciplineConfigColumns,
    disciplineCategoryFilter,
    setDisciplineCategoryFilter,
    visibleDisciplineConfigRows,
    seasonDisciplineScheduleRows,
    currentMatchdayId,
    getTableActivePreset,
    isTableColumnVisible,
    setTableColumnVisible,
    moveTableColumn,
    getTableColumnWidth,
    adjustTableColumnWidth,
    resetTableColumnWidth,
    resetTableLayout,
    getTableHeaderDragProps,
    startTableColumnResize,
    tableSorts,
    toggleTableSort,
    ColumnVisibilityManager,
    SortableHeader,
    disciplineConfigTableColumns,
  } = props;

  return (
    <section className="panel foundation-diszis-panel" data-testid="foundation-diszis" id="foundation-diszis">
      <div className="panel-header">
        <TooltipHeading
          as="h2"
          tooltip="Diese Ansicht bildet den Diszis-Reiter aus dem Draftboard nach: originale Reihenfolge, neue Reihenfolge, Spieleranzahl und vorbereitete Mutator-Slots pro Disziplin."
        >
          Disziplin-Konfiguration
        </TooltipHeading>
        <ColumnVisibilityManager
          title="Spalten"
          columns={disciplineConfigTableColumns}
          activePreset={getTableActivePreset("disciplineConfigTable")}
          isVisible={(columnId, visibleByDefault) =>
            isTableColumnVisible("disciplineConfigTable", columnId, visibleByDefault)
          }
          onToggle={(columnId, nextVisible) => setTableColumnVisible("disciplineConfigTable", columnId, nextVisible)}
          onMove={(columnId, direction) => moveTableColumn("disciplineConfigTable", columnId, direction, disciplineConfigTableColumns)}
          getWidth={(column) => getTableColumnWidth("disciplineConfigTable", column)}
          onStepWidth={(column, delta) => adjustTableColumnWidth("disciplineConfigTable", column, delta)}
          onResetWidth={(column) => resetTableColumnWidth("disciplineConfigTable", column)}
          onResetToDefault={() => resetTableLayout("disciplineConfigTable", disciplineConfigTableColumns)}
        />
      </div>
      <div className="discipline-category-filterbar" aria-label="Disziplin-Kategorien">
        {(
          [
            { id: "all", label: "Alle" },
            { id: "power", label: "POW" },
            { id: "speed", label: "SPE" },
            { id: "mental", label: "MEN" },
            { id: "social", label: "SOC" },
          ] as Array<{ id: DisciplineCategoryFilter; label: string }>
        ).map((filter) => (
          <button
            key={`discipline-category-filter-${filter.id}`}
            className={`secondary-button inline-button${disciplineCategoryFilter === filter.id ? " is-selected" : ""}`}
            type="button"
            onClick={() => setDisciplineCategoryFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
        <span>{visibleDisciplineConfigRows.length} Diszis</span>
      </div>
      <div className="table-shell">
        <table className="team-table discipline-config-table">
          <colgroup>
            {visibleDisciplineConfigColumns.map((column) => (
              <col key={column.id} style={{ width: `${getTableColumnWidth("disciplineConfigTable", column)}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleDisciplineConfigColumns.map((column) => (
                <th
                  key={column.id}
                  {...getTableHeaderDragProps("disciplineConfigTable", column, visibleDisciplineConfigColumns)}
                  style={{ width: `${getTableColumnWidth("disciplineConfigTable", column)}px`, minWidth: `${column.minWidth}px` }}
                >
                  <div className="resizable-header-cell">
                    <SortableHeader label={column.label} tableId="disciplineConfig" columnKey={column.dataKey} sortState={tableSorts.disciplineConfig} onToggle={toggleTableSort} />
                    <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("disciplineConfigTable", column, event)} onDoubleClick={() => resetTableColumnWidth("disciplineConfigTable", column)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleDisciplineConfigRows.map((discipline) => (
              <tr key={String(discipline.id)}>
                {visibleDisciplineConfigColumns.map((column) => {
                  if (column.id === "originalOrder") return <td key={column.id} className={`discipline-order-cell is-${discipline.category}`}>{discipline.originalOrder as React.ReactNode}</td>;
                  if (column.id === "displayOrder") return <td key={column.id}>{discipline.displayOrder as React.ReactNode}</td>;
                  if (column.id === "name") {
                    return (
                      <td key={column.id}>
                        <div className="table-player-cell">
                          <strong>{discipline.name as React.ReactNode}</strong>
                          <span>{discipline.category as React.ReactNode}</span>
                        </div>
                      </td>
                    );
                  }
                  if (column.id === "playerCount") return <td key={column.id}>{discipline.playerCount as React.ReactNode}</td>;
                  if (column.id === "mutator1") return <td key={column.id}>{(discipline.mutator1 as string) || "-"}</td>;
                  return <td key={column.id}>{(discipline.mutator2 as string) || "-"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel inset-panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div className="stack">
            <TooltipHeading
              as="h3"
              tooltip="Einsatzliste, Cockpit, Matchday Auto-Run und Whole Season DryRun lesen denselben lokalen Plan."
            >
              Saison-Matchday-Plan
            </TooltipHeading>
          </div>
          <span className="pill">
            {(seasonDisciplineScheduleRows[0]?.sourceStatus as string | undefined) ?? "legacy_seed"}
          </span>
        </div>
        <div className="table-shell">
          <table className="team-table discipline-config-table">
            <thead>
              <tr>
                <th>Spieltag</th>
                <th>D1</th>
                <th>D1 Spieler</th>
                <th>D2</th>
                <th>D2 Spieler</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {seasonDisciplineScheduleRows.map((entry) => (
                <tr key={String(entry.matchdayId)}>
                  <td className={entry.matchdayId === currentMatchdayId ? "is-current-matchday" : undefined}>
                    {entry.matchdayLabel as React.ReactNode}
                  </td>
                  <td>{(entry.discipline1 as { displayName?: string } | undefined)?.displayName ?? "—"}</td>
                  <td>{(entry.discipline1 as { playerCount?: number } | undefined)?.playerCount ?? "—"}</td>
                  <td>{(entry.discipline2 as { displayName?: string } | undefined)?.displayName ?? "—"}</td>
                  <td>{(entry.discipline2 as { playerCount?: number } | undefined)?.playerCount ?? "—"}</td>
                  <td>{entry.sourceStatus as React.ReactNode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {seasonDisciplineScheduleRows[0]?.sourceNote ? (
          <p className="muted" style={{ marginTop: 10 }}>
            {seasonDisciplineScheduleRows[0].sourceNote as React.ReactNode}
          </p>
        ) : null}
      </div>
    </section>
  );
}
