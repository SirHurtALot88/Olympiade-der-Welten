"use client";

import type { ReactNode } from "react";
import type { ColumnDef, UseColumnWidthsResult } from "./useColumnWidths";

interface ColgroupProps<Id extends string> {
  cols: ColumnDef<Id>[];
  widths: Record<Id, number>;
}

/** `<colgroup>` fuer `table-layout: fixed` aus den aktuellen Spaltenbreiten. */
export function ResizableColgroup<Id extends string>({ cols, widths }: ColgroupProps<Id>) {
  return (
    <colgroup>
      {cols.map((c) => (
        <col key={c.id} style={{ width: widths[c.id] }} />
      ))}
    </colgroup>
  );
}

interface TheadProps<Id extends string> {
  cols: ColumnDef<Id>[];
  startResize: UseColumnWidthsResult<Id>["startResize"];
  /** Optionaler Sortier-Handler; wenn gesetzt, werden Spaltenkoepfe klickbar (▲▼). */
  sort?: { colId: Id | null; dir: "asc" | "desc"; onSort: (colId: Id) => void };
  sortableCols?: Id[];
}

/** `<thead>` mit Pointer-Resize-Griffen je Spalte (letzte Spalte ohne Griff). */
export function ResizableThead<Id extends string>({ cols, startResize, sort, sortableCols }: TheadProps<Id>) {
  return (
    <thead>
      <tr>
        {cols.map((c, i) => {
          const sortable = sortableCols?.includes(c.id) ?? false;
          const isSorted = sort?.colId === c.id;
          return (
            <th key={c.id} className={c.align === "r" ? "r" : undefined}>
              {sortable ? (
                <button
                  type="button"
                  onClick={() => sort?.onSort(c.id)}
                  className="th-label"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: c.align === "r" ? "right" : "left",
                    background: "transparent",
                    border: 0,
                    padding: "0 10px 0 0",
                    font: "inherit",
                    fontSize: "inherit",
                    letterSpacing: "inherit",
                    textTransform: "inherit",
                    color: isSorted ? "var(--accent-ink)" : "inherit",
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`Nach ${c.label} sortieren`}
                >
                  {c.label}
                  {isSorted ? (sort?.dir === "asc" ? " ▲" : " ▼") : ""}
                </button>
              ) : (
                <span className="th-label">{c.label}</span>
              )}
              {i < cols.length - 1 && (
                <span
                  className="col-resizer"
                  onPointerDown={(e) => startResize(e, c.id, c.min)}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Spaltenbreite ${c.label} anpassen`}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** Der "Spalten zuruecksetzen"-Knopf, ueblicherweise in der Karten-Ueberschrift platziert. */
export function ResetColumnsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="col-reset" onClick={onClick} title="Spaltenbreiten zurücksetzen">
      Spalten zurücksetzen
    </button>
  );
}

interface SimpleResizableTableProps<Row, Id extends string> {
  cols: ColumnDef<Id>[];
  columnWidths: UseColumnWidthsResult<Id>;
  rows: Row[];
  rowKey: (row: Row) => string;
  renderCell: (row: Row, colId: Id) => ReactNode;
  sort?: TheadProps<Id>["sort"];
  sortableCols?: Id[];
  className?: string;
}

/**
 * Generische resizable Tabelle fuer einfache Zeilen-Layouts (Zelle-fuer-Zelle
 * gerendert ueber `renderCell`). Tabellen mit komplexerem Row-Markup (z. B.
 * mehrzeilige Artikel-Zellen) nutzen stattdessen `useColumnWidths` +
 * `ResizableColgroup`/`ResizableThead` direkt und rendern die `<tbody>` selbst.
 */
export function ResizableTable<Row, Id extends string>({
  cols,
  columnWidths,
  rows,
  rowKey,
  renderCell,
  sort,
  sortableCols,
  className,
}: SimpleResizableTableProps<Row, Id>) {
  const { widths, total, startResize } = columnWidths;
  return (
    <div className="tablewrap">
      <table
        className={`resizable${className ? ` ${className}` : ""}`}
        style={{ tableLayout: "fixed", width: total, minWidth: total }}
      >
        <ResizableColgroup cols={cols} widths={widths} />
        <ResizableThead cols={cols} startResize={startResize} sort={sort} sortableCols={sortableCols} />
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {cols.map((c) => (
                <td key={c.id} className={c.align === "r" ? "r" : undefined}>
                  {renderCell(row, c.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
