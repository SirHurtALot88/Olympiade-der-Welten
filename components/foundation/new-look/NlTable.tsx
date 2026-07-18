"use client";

import { Fragment, type ReactNode } from "react";

export type NlTableAlign = "left" | "right" | "center";

export type NlTableColumn<Row> = {
  key: string;
  label: ReactNode;
  align?: NlTableAlign;
  /** CSS-Breite der Spalte, z. B. "80px" oder "12%". */
  width?: string | number;
  sortable?: boolean;
  tooltip?: string;
  className?: string;
};

export type NlTableSortDirection = "asc" | "desc";

export type NlTableSortState = {
  key: string;
  direction: NlTableSortDirection;
};

export type NlTableProps<Row> = {
  columns: NlTableColumn<Row>[];
  rows: Row[];
  /** React-Key je Zeile — ohne Angabe wird der Zeilenindex genutzt. */
  rowKey?: (row: Row, index: number) => string | number;
  /**
   * Optionale CSS-Klasse(n) je Zeile — für Zustands-Tints (z. B. aktive/
   * ausgewählte/auslaufende Zeile), die das dünne Grundgerüst sonst nicht
   * abbildet. Rückgabe `undefined`/leer = keine Zusatzklasse.
   */
  rowClassName?: (row: Row, index: number) => string | undefined;
  /** Zellinhalt je Zeile/Spalte. Ohne Angabe wird `row[column.key]` gelesen. */
  renderCell?: (row: Row, column: NlTableColumn<Row>) => ReactNode;
  sortState?: NlTableSortState | null;
  onSort?: (key: string) => void;
  /**
   * Optional aufklappbare Detailzeile je Datenzeile (additiv). Ist
   * `isRowExpanded(row)` wahr, wird direkt unter der Zeile eine zusätzliche
   * `<tr class="nl-table-expanded-row">` mit `colSpan` über alle Spalten
   * gerendert, deren Inhalt aus `renderExpandedRow(row)` stammt. Ohne beide
   * Props verhält sich die Tabelle exakt wie bisher (kein Mehr-Markup).
   */
  renderExpandedRow?: (row: Row, index: number) => ReactNode;
  isRowExpanded?: (row: Row, index: number) => boolean;
  /**
   * Optionaler Zeilen-Klick (z. B. "Team-/Spielerprofil öffnen"). Macht die
   * gesamte Zeile klick-/tastaturbedienbar (Enter/Space), ohne dass jede
   * Zelle einen eigenen Button braucht. Klicks auf verschachtelte
   * interaktive Elemente (Buttons/Links) innerhalb einer Zelle lösen die
   * Zeile NICHT zusätzlich aus (Guard über `event.target`).
   */
  onRowClick?: (row: Row, index: number) => void;
  /** Zebra-Streifen (Standard: an). */
  zebra?: boolean;
  /** Hover-Hervorhebung der Zeile (Standard: an). */
  hoverable?: boolean;
  /** Sticky Tabellenkopf (Standard: an). */
  stickyHeader?: boolean;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

function defaultRenderCell<Row>(row: Row, column: NlTableColumn<Row>): ReactNode {
  const value = (row as Record<string, unknown>)[column.key];
  if (value == null) {
    return "—";
  }
  return String(value);
}

function alignClass(align: NlTableAlign | undefined): string {
  if (align === "right") return "is-align-right";
  if (align === "center") return "is-align-center";
  return "";
}

/**
 * Dünne Tabellen-Grundlage des neuen Looks — ersetzt handgerollte
 * `<table>`s (Kredite, Historie, Team-Settings, Prize, Team-Profil,
 * Season-Preview, …) durch EIN token-gestyltes Gerüst: sticky Kopf,
 * Zebra/Hover, `nl-tnum`-Zahlen, gemeinsames sortierbares-Header-Muster
 * (gleiche Optik/Verhalten wie die bisherigen bespoke Sort-Header in
 * `season-v2`/`players-table`: Button mit Pfeil ↑/↓/↕, `aria-sort` je
 * Spalte).
 */
export function NlTable<Row>({
  columns,
  rows,
  rowKey,
  rowClassName,
  renderCell = defaultRenderCell,
  sortState,
  onSort,
  renderExpandedRow,
  isRowExpanded,
  onRowClick,
  zebra = true,
  hoverable = true,
  stickyHeader = true,
  className,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: NlTableProps<Row>) {
  const classes = [
    "nl-table",
    "nl-tnum",
    zebra ? "is-zebra" : "",
    hoverable ? "is-hoverable" : "",
    stickyHeader ? "is-sticky-head" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  function ariaSortFor(column: NlTableColumn<Row>): "ascending" | "descending" | "none" | undefined {
    if (!column.sortable) {
      return undefined;
    }
    if (sortState?.key !== column.key) {
      return "none";
    }
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  return (
    <div className="nl-table-shell">
      <table className={classes} aria-label={ariaLabel} data-testid={dataTestId}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isActive = column.sortable && sortState?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={[alignClass(column.align), column.className ?? ""].filter(Boolean).join(" ")}
                  style={column.width != null ? { width: column.width } : undefined}
                  aria-sort={ariaSortFor(column)}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={`nl-table-sort-th${isActive ? " is-active" : ""}`}
                      onClick={() => onSort?.(column.key)}
                      title={column.tooltip}
                    >
                      <span>{column.label}</span>
                      <b aria-hidden="true">{!isActive ? "↕" : sortState?.direction === "asc" ? "↑" : "↓"}</b>
                    </button>
                  ) : (
                    <span title={column.tooltip}>{column.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const rowExtra = rowClassName?.(row, rowIndex);
            const rowClasses = [rowExtra ?? "", onRowClick ? "is-clickable" : ""].filter(Boolean).join(" ");
            const expanded = Boolean(renderExpandedRow && isRowExpanded?.(row, rowIndex));
            return (
            <Fragment key={rowKey ? rowKey(row, rowIndex) : rowIndex}>
            <tr
              className={rowClasses || undefined}
              onClick={
                onRowClick
                  ? (event) => {
                      // Verschachtelte interaktive Elemente (z. B. ein Team-Link in einer
                      // Zelle) sollen ihre eigene Aktion auslösen, nicht zusätzlich den
                      // Zeilen-Klick — Klicks, die von einem <button>/<a> aufsteigen, werden
                      // ignoriert.
                      if ((event.target as HTMLElement).closest("button, a")) {
                        return;
                      }
                      onRowClick(row, rowIndex);
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        if (event.key === " ") {
                          event.preventDefault();
                        }
                        onRowClick(row, rowIndex);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[alignClass(column.align), column.className ?? ""].filter(Boolean).join(" ")}
                >
                  {renderCell(row, column)}
                </td>
              ))}
            </tr>
            {expanded ? (
              <tr className="nl-table-expanded-row">
                <td colSpan={columns.length}>{renderExpandedRow?.(row, rowIndex)}</td>
              </tr>
            ) : null}
            </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default NlTable;
