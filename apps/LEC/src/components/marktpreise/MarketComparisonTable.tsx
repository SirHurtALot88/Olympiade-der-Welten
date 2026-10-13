"use client";

import { useMemo, useState } from "react";
import { MARKET_FILTER_LABEL, MARKET_FILTER_ORDER, matchesMarketFilter, type MarketFilter, type MarketVerdict } from "@/lib/dashboard/marketFilter";
import type { MarketComparisonRow } from "@/lib/dashboard/marketComparison";
import { formatEuroCents, formatPercent } from "@/lib/format";
import { useColumnWidths, type ColumnDef } from "@/components/table/useColumnWidths";
import { ResizableColgroup, ResizableThead, ResetColumnsButton } from "@/components/table/ResizableTable";

type ColId = "artikel" | "vk" | "ek" | "marktwert" | "ziel" | "marge" | "ampel" | "ekhinweis" | "datenstand";

const COLS: ColumnDef<ColId>[] = [
  { id: "artikel", label: "Artikel", def: 260, min: 140 },
  { id: "vk", label: "Eigener VK", def: 96, min: 75, align: "r" },
  { id: "ek", label: "EK/Stk", def: 84, min: 65, align: "r" },
  { id: "marktwert", label: "Marktwert", def: 120, min: 85, align: "r" },
  { id: "ziel", label: "Zielspanne 25–33 %", def: 138, min: 100, align: "r" },
  { id: "marge", label: "Marge bei Nachkauf", def: 112, min: 85, align: "r" },
  { id: "ampel", label: "Ampel", def: 140, min: 110 },
  { id: "ekhinweis", label: "EK ggü. Markt", def: 130, min: 90 },
  { id: "datenstand", label: "Preisliste vom", def: 110, min: 90 },
];

const STORAGE_KEY = "lec.marktpreise.colWidths.v3";

// Dieselben Farben wie die Ampel im Sortiment: zu guenstig = Marge unter 25 % (rot), zu teuer = ueber der Spanne (blau).
export const STATUS_PILL: Record<MarketComparisonRow["status"], { cls: string; label: string }> = {
  zu_guenstig: { cls: "p-crit", label: "zu günstig" },
  im_korridor: { cls: "p-good", label: "im Rahmen" },
  zu_teuer: { cls: "p-mkt", label: "zu teuer" },
};

type Filter = "alle" | MarketFilter;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "alle", label: "alle" },
  ...MARKET_FILTER_ORDER.map((k) => ({ key: k as Filter, label: MARKET_FILTER_LABEL[k] })),
];

/** Urteil der Zeile in der gemeinsamen Filter-Sprache (siehe lib/dashboard/marketFilter.ts). */
function verdictOf(r: MarketComparisonRow): MarketVerdict {
  return { rated: r.marketValue !== null || (r.marketRange !== null && r.status !== "im_korridor"), status: r.status, ekAboveMarket: r.ekAboveMarket };
}

function matches(r: MarketComparisonRow, f: Filter): boolean {
  return f === "alle" || matchesMarketFilter(verdictOf(r), new Set([f]));
}

const eur = (v: number) => `${formatEuroCents(v)} €`;

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
  const [filter, setFilter] = useState<Filter>("alle");
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])) as Record<Filter, number>, [rows]);
  const shown = useMemo(() => rows.filter((r) => matches(r, filter)), [rows, filter]);

  return (
    <section className="card">
      <h3>
        Vergleich <span className="r">{shown.length} von {rows.length} Artikeln mit Cardmarket-Wert · Handlungsbedarf zuerst</span>
        <ResetColumnsButton onClick={resetWidths} />
      </h3>
      <div className="filterrow" style={{ padding: "0 16px 10px" }}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={`chip${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>
            {f.label} <span className="chipn">{counts[f.key]}</span>
          </button>
        ))}
      </div>
      <div className="tablewrap">
        <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
          <ResizableColgroup cols={COLS} widths={widths} />
          <ResizableThead cols={COLS} startResize={startResize} />
          <tbody>
            {shown.map((row) => {
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
                  <td className="r num" title={row.marketRange ? `${row.marketRange.variants} Varianten im Set, Seltenheit nicht zuordenbar` : "Cardmarket-Trend × Pack-Menge"}>
                    {row.marketValue !== null
                      ? eur(row.marketValue)
                      : row.marketRange
                        ? `${formatEuroCents(row.marketRange.min)}–${eur(row.marketRange.max)}`
                        : "—"}
                  </td>
                  <td className="r num" title="VK für 25 % (Minimum) bis 33 % (Optimum) Deckungsbeitrags-Marge, wenn die Karte heute zum Marktwert nachgekauft wird (inkl. Einkaufs-Versand), mindestens 4,99 €">
                    {row.targetMin !== null && row.targetOpt !== null
                      ? row.targetMin === row.targetOpt
                        ? eur(row.targetMin)
                        : `${formatEuroCents(row.targetMin)}–${eur(row.targetOpt)}`
                      : "—"}
                  </td>
                  <td className="r num" title="Deckungsbeitrags-Marge (vor Fixkosten), die dein heutiger VK bringt, wenn die Karte zum Marktwert nachgekauft wird">
                    {row.marginAtMarket !== null ? `${formatPercent(row.marginAtMarket)} %` : "—"}
                  </td>
                  <td>
                    {row.marketValue === null && !row.marketRange ? (
                      <span style={{ color: "var(--faint)", fontSize: 11.5 }}>kein Marktwert</span>
                    ) : row.marketRange && row.status === "im_korridor" ? (
                      <span style={{ color: "var(--faint)", fontSize: 11.5 }}>Seltenheit offen</span>
                    ) : (
                      <span className={`pill ${pill.cls}`}>
                        <span className="dot" />
                        {pill.label}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11.5 }}>
                    {row.ek <= 0 ? (
                      <span className="p-warn" title="Kein EK in Billbee — der Marktwert ist der beste Anhaltspunkt">
                        kein EK{row.marketValue !== null ? ` · Markt ${eur(row.marketValue)}` : ""}
                      </span>
                    ) : row.ekAboveMarket ? (
                      <span className="down">EK über Markt</span>
                    ) : row.marketValue !== null ? (
                      <span style={{ color: "var(--faint)" }}>im Rahmen</span>
                    ) : (
                      "—"
                    )}
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
            {shown.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: "20px 12px", color: "var(--faint)", textAlign: "center" }}>
                  Keine Artikel für diesen Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
