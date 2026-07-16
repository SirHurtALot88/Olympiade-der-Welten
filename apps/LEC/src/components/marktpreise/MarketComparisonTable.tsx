"use client";

import type { MarketComparisonRow } from "@/lib/dashboard/marketComparison";
import { formatEuroCents, formatPercent } from "@/lib/format";
import { useColumnWidths, type ColumnDef } from "@/components/table/useColumnWidths";
import { ResizableColgroup, ResizableThead, ResetColumnsButton } from "@/components/table/ResizableTable";

type ColId = "artikel" | "vk" | "ek" | "marketab" | "markettrend" | "delta" | "ampel" | "datenstand";

const COLS: ColumnDef<ColId>[] = [
  { id: "artikel", label: "Artikel", def: 240, min: 140 },
  { id: "vk", label: "Eigener VK", def: 100, min: 75, align: "r" },
  { id: "ek", label: "EK/Stk", def: 90, min: 70, align: "r" },
  { id: "marketab", label: "Markt ab", def: 90, min: 70, align: "r" },
  { id: "markettrend", label: "Markt Trend", def: 100, min: 75, align: "r" },
  { id: "delta", label: "Δ VK↔Trend", def: 100, min: 75, align: "r" },
  { id: "ampel", label: "Ampel", def: 150, min: 110 },
  { id: "datenstand", label: "Datenstand", def: 120, min: 90 },
];

const STORAGE_KEY = "lec.marktpreise.colWidths.v1";

const STATUS_PILL: Record<MarketComparisonRow["status"], { cls: string; label: string }> = {
  zu_guenstig: { cls: "p-warn", label: "zu günstig ggü. Markt" },
  im_korridor: { cls: "p-good", label: "im Korridor" },
  zu_teuer: { cls: "p-crit", label: "zu teuer ggü. Markt" },
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

interface Props {
  rows: MarketComparisonRow[];
  selectedArticleId: string | null;
  onSelectRow: (articleId: string) => void;
}

/** Vergleichstabelle (PAGES_CONCEPT §3): resizable, wie alle anderen Tabellen. */
export function MarketComparisonTable({ rows, selectedArticleId, onSelectRow }: Props) {
  const { widths, total, startResize, resetWidths } = useColumnWidths(COLS, STORAGE_KEY);

  return (
    <section className="card">
      <h3>
        Vergleich <span className="r">{rows.length} erfasste Artikel</span>
        <ResetColumnsButton onClick={resetWidths} />
      </h3>
      <div className="tablewrap">
        <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
          <ResizableColgroup cols={COLS} widths={widths} />
          <ResizableThead cols={COLS} startResize={startResize} />
          <tbody>
            {rows.map((row) => {
              const pill = STATUS_PILL[row.status];
              return (
                <tr
                  key={row.articleId}
                  onClick={() => onSelectRow(row.articleId)}
                  style={{
                    cursor: "pointer",
                    background: row.articleId === selectedArticleId ? "var(--panel2)" : undefined,
                  }}
                >
                  <td>
                    <div className="artname" style={{ maxWidth: "100%" }} title={row.nameRaw}>
                      {row.nameRaw}
                    </div>
                    {row.setCode && <div className="code">{row.setCode}</div>}
                  </td>
                  <td className="r num">{row.ownVk > 0 ? `${formatEuroCents(row.ownVk)} €` : "—"}</td>
                  <td className="r num">{row.ek > 0 ? `${formatEuroCents(row.ek)} €` : "—"}</td>
                  <td className="r num">{row.marketFrom !== null ? `${formatEuroCents(row.marketFrom)} €` : "—"}</td>
                  <td className="r num">{row.marketTrend !== null ? `${formatEuroCents(row.marketTrend)} €` : "—"}</td>
                  <td className="r num">
                    {row.deltaPercent !== null ? `${row.deltaPercent > 0 ? "+" : ""}${formatPercent(row.deltaPercent)}%` : "—"}
                  </td>
                  <td>
                    <span className={`pill ${pill.cls}`}>
                      <span className="dot" />
                      {pill.label}
                    </span>
                  </td>
                  <td>
                    <span className={row.stale ? "p-warn" : undefined} style={{ fontSize: 11.5 }}>
                      {formatDate(row.fetchedAt)}
                      {row.stale && " · veraltet"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: "20px 12px", color: "var(--faint)", textAlign: "center" }}>
                  Noch keine Marktpreise erfasst.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
