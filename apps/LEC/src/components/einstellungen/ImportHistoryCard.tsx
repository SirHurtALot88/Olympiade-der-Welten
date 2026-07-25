"use client";

import { useColumnWidths, type ColumnDef } from "@/components/table/useColumnWidths";
import { ResizableColgroup, ResizableThead, ResetColumnsButton } from "@/components/table/ResizableTable";

export interface ImportBatchRow {
  id: string;
  kind: string;
  window: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  fileName: string | null;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  createdAt: string;
}

type ColId = "datum" | "art" | "fenster" | "datei" | "zeilen" | "matched" | "unmatched";

const COLS: ColumnDef<ColId>[] = [
  { id: "datum", label: "Datum", def: 110, min: 90 },
  { id: "art", label: "Art", def: 110, min: 80 },
  { id: "fenster", label: "Fenster", def: 140, min: 90 },
  { id: "datei", label: "Datei", def: 220, min: 120 },
  { id: "zeilen", label: "Zeilen", def: 80, min: 60, align: "r" },
  { id: "matched", label: "Gematcht", def: 90, min: 70, align: "r" },
  { id: "unmatched", label: "Ungematcht", def: 100, min: 70, align: "r" },
];

const STORAGE_KEY = "lec.importHistory.colWidths.v1";

const KIND_LABEL: Record<string, string> = {
  billbee: "Billbee-Fenster",
  ebay: "eBay-Report",
  billbee_artikel: "Artikelstamm",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

export function ImportHistoryCard({ batches }: { batches: ImportBatchRow[] }) {
  const { widths, total, startResize, resetWidths } = useColumnWidths(COLS, STORAGE_KEY);

  return (
    <section className="card">
      <h3>
        Datenstand <span className="r">Letzte Import-Läufe</span>
        <ResetColumnsButton onClick={resetWidths} />
        <a href="/import" className="col-reset" style={{ textDecoration: "none", marginLeft: 8 }}>
          Zum Import →
        </a>
      </h3>
      <div className="tablewrap">
        <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
          <ResizableColgroup cols={COLS} widths={widths} />
          <ResizableThead cols={COLS} startResize={startResize} />
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td style={{ fontSize: 11.5 }}>{formatDate(b.createdAt)}</td>
                <td style={{ fontSize: 11.5 }}>{KIND_LABEL[b.kind] ?? b.kind}</td>
                <td style={{ fontSize: 11.5 }}>
                  {b.window ? (b.window === "all" ? "Lebenszeit" : `${b.window} T`) : "—"}
                </td>
                <td>
                  <span className="code">{b.fileName ?? "—"}</span>
                </td>
                <td className="r num">{b.rowCount}</td>
                <td className="r num">{b.matchedCount}</td>
                <td className="r num">{b.unmatchedCount}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: "18px 12px", color: "var(--faint)", textAlign: "center" }}>
                  Noch keine Import-Läufe protokolliert.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
