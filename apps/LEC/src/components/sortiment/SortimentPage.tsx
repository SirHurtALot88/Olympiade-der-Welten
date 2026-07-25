"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import type { ArticleClass } from "@/lib/pricing/classification";
import type { PriceStatus } from "@/lib/pricing/costEngine";
import type { SaleWindowKey } from "@/lib/parsing/date";
import { LABELS_DE } from "@/lib/dashboard/viewModel";
import { normalizedNameKey } from "@/lib/parsing/name";
import { formatEuro, formatEuroCents, formatPercent } from "@/lib/format";
import { AppShell } from "@/components/shell/AppShell";
import { useColumnWidths, type ColumnDef } from "@/components/table/useColumnWidths";
import { ResizableColgroup, ResizableThead, ResetColumnsButton } from "@/components/table/ResizableTable";
import { MicroVelocity, Corridor, STATUS_PILL } from "@/components/dashboard/SortimentTable";

const WINDOW_ORDER: { key: SaleWindowKey; label: string }[] = [
  { key: "30", label: "30 T" },
  { key: "90", label: "90 T" },
  { key: "365", label: "365 T" },
  { key: "all", label: "Lebenszeit" },
];

const CLASS_ORDER: ArticleClass[] = ["champion", "solide", "beobachten", "faellt_ab", "low_runner", "ladenhueter"];
const STATUS_ORDER: PriceStatus[] = ["unter_min", "im_korridor", "ueber_gut"];

type ColId =
  | "artikel"
  | "rank"
  | "verkaeufe"
  | "umsatz"
  | "avgpreis"
  | "avgvk"
  | "listingvk"
  | "ek"
  | "dbI"
  | "dbII"
  | "dbIIpct"
  | "klasse"
  | "status"
  | "stock"
  | "potvk"
  | "stockcover"
  | "trend";

const COLS: ColumnDef<ColId>[] = [
  { id: "artikel", label: "Artikel", def: 240, min: 140 },
  { id: "rank", label: "Rank", def: 62, min: 50, align: "r" },
  { id: "verkaeufe", label: "Verkäufe", def: 84, min: 60, align: "r" },
  { id: "umsatz", label: "Umsatz", def: 96, min: 70, align: "r" },
  { id: "avgpreis", label: "Ø Preis", def: 84, min: 65, align: "r" },
  { id: "avgvk", label: "Ø-VK (real.)", def: 96, min: 70, align: "r" },
  { id: "listingvk", label: "Akt. VK (Liste)", def: 104, min: 80, align: "r" },
  { id: "ek", label: "Preis EK", def: 82, min: 65, align: "r" },
  { id: "dbI", label: "DB I/Stk", def: 84, min: 65, align: "r" },
  { id: "dbII", label: "DB II/Stk", def: 88, min: 65, align: "r" },
  { id: "dbIIpct", label: "DB II %", def: 76, min: 60, align: "r" },
  { id: "klasse", label: "Klasse", def: 100, min: 80 },
  { id: "status", label: "Status", def: 116, min: 90 },
  { id: "stock", label: "Stk", def: 62, min: 50, align: "r" },
  { id: "potvk", label: "pot. VK€", def: 90, min: 70, align: "r" },
  { id: "stockcover", label: "Stk > VK", def: 90, min: 70, align: "r" },
  { id: "trend", label: "Preistendenz", def: 100, min: 80, align: "r" },
];

const SORTABLE_COLS: ColId[] = [
  "rank",
  "verkaeufe",
  "umsatz",
  "avgpreis",
  "avgvk",
  "listingvk",
  "ek",
  "dbI",
  "dbII",
  "dbIIpct",
  "stock",
  "potvk",
  "stockcover",
  "trend",
];

const STORAGE_KEY = "lec.sortimentPage.colWidths.v1";
const PAGE_SIZE = 100;

interface Props {
  rows: SortimentRow[];
  totalCount: number;
  activeCount: number;
  discontinuedCount: number;
  ladenhueterCount: number;
}

function sortValue(row: SortimentRow, colId: ColId, window: SaleWindowKey): number {
  const w = row.windows[window];
  switch (colId) {
    case "rank":
      return w?.rank ?? Number.POSITIVE_INFINITY;
    case "verkaeufe":
      return w?.qty ?? 0;
    case "umsatz":
      return w?.revenue ?? 0;
    case "avgpreis":
      return w?.avgPrice ?? 0;
    case "avgvk":
      return row.avgVkRealized;
    case "listingvk":
      return row.listingVk ?? -1;
    case "ek":
      return row.ek;
    case "dbI":
      return row.dbIPerUnit;
    case "dbII":
      return row.dbIIPerUnit;
    case "dbIIpct":
      return row.dbIIPercent;
    case "stock":
      return row.stock;
    case "potvk":
      return row.potentialRevenue ?? -1;
    case "stockcover":
      return row.stockMonthsCover ?? -1;
    case "trend":
      return row.priceTrend ?? -1;
    default:
      return 0;
  }
}

export function SortimentPage({ rows, totalCount, activeCount, discontinuedCount, ladenhueterCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedWindow, setSelectedWindow] = useState<SaleWindowKey>(
    (searchParams.get("fenster") as SaleWindowKey | null) ?? "90"
  );
  const [classFilter, setClassFilter] = useState<Set<ArticleClass>>(() => {
    const raw = searchParams.get("klasse");
    return raw ? new Set(raw.split(",").filter((c): c is ArticleClass => CLASS_ORDER.includes(c as ArticleClass))) : new Set();
  });
  const [statusFilter, setStatusFilter] = useState<Set<PriceStatus>>(new Set());
  const [onlyLadenhueter, setOnlyLadenhueter] = useState(false);
  // Standardmaessig nur AKTIVE Artikel zeigen (Billbee-Artikelstamm-Katalog);
  // ausgelaufene (nur in der Verkaufshistorie bekannte) Artikel sind ein
  // expliziter Opt-in, sonst dominieren tote Alt-Artikel die Liste.
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<{ colId: ColId; dir: "asc" | "desc" }>({ colId: "verkaeufe", dir: "desc" });

  const columnWidths = useColumnWidths(COLS, STORAGE_KEY);

  // URL-Query-Sync (q/fenster/klasse), so dass Links von Top/Flop und
  // Empfehlungen (?q=…, ?klasse=ladenhueter) die Filter vorbelegen koennen.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedWindow !== "90") params.set("fenster", selectedWindow);
    if (classFilter.size > 0) params.set("klasse", Array.from(classFilter).join(","));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedWindow, classFilter]);

  function toggleClass(cls: ArticleClass) {
    setClassFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  function toggleStatus(status: PriceStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  function handleSort(colId: ColId) {
    setSort((prev) =>
      prev.colId === colId ? { colId, dir: prev.dir === "desc" ? "asc" : "desc" } : { colId, dir: "desc" }
    );
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().length > 0 ? normalizedNameKey(query) : "";
    const upperQuery = query.trim().toUpperCase();
    let result = rows;

    if (normalizedQuery) {
      result = result.filter(
        (r) =>
          normalizedNameKey(r.nameRaw).includes(normalizedQuery) ||
          (r.setCode ? r.setCode.toUpperCase().includes(upperQuery) : false)
      );
    }
    if (classFilter.size > 0) {
      result = result.filter((r) => classFilter.has(r.articleClass));
    }
    if (statusFilter.size > 0) {
      result = result.filter((r) => statusFilter.has(r.priceStatus));
    }
    if (onlyLadenhueter) {
      result = result.filter((r) => r.articleClass === "ladenhueter");
    }
    if (!showDiscontinued) {
      result = result.filter((r) => r.active);
    }
    return result;
  }, [rows, query, classFilter, statusFilter, onlyLadenhueter, showDiscontinued]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const diff = sortValue(a, sort.colId, selectedWindow) - sortValue(b, sort.colId, selectedWindow);
      return sort.dir === "asc" ? diff : -diff;
    });
    return copy;
  }, [filtered, sort, selectedWindow]);

  const visible = sorted.slice(0, visibleCount);
  const maxVelocity = Math.max(1, ...visible.flatMap((r) => r.velocity));
  const { widths, total, startResize, resetWidths } = columnWidths;

  return (
    <AppShell
      title="Sortiment"
      subtitle={`${activeCount} aktiv · ${discontinuedCount} ausgelaufen · ${ladenhueterCount} Ladenhüter`}
      topbarRight={
        <>
          <div className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Name oder Set-Code …"
            />
          </div>
          <div className="seg">
            {WINDOW_ORDER.map((w) => (
              <button
                key={w.key}
                type="button"
                className={selectedWindow === w.key ? "on" : undefined}
                onClick={() => setSelectedWindow(w.key)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </>
      }
      footer={<span>Alle Zahlen serverseitig berechnet · Filter/Sortierung laufen clientseitig.</span>}
    >
      <div className="filterrow">
        {CLASS_ORDER.map((cls) => (
          <button
            key={cls}
            type="button"
            className={`chip${classFilter.has(cls) ? " on" : ""}`}
            onClick={() => toggleClass(cls)}
          >
            {LABELS_DE[cls]}
          </button>
        ))}
        <span className="fsep" />
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            className={`chip${statusFilter.has(status) ? " on" : ""}`}
            onClick={() => toggleStatus(status)}
          >
            {STATUS_PILL[status].label}
          </button>
        ))}
        <span className="fsep" />
        <button
          type="button"
          className={`chip${onlyLadenhueter ? " on" : ""}`}
          onClick={() => {
            setOnlyLadenhueter((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
        >
          nur Ladenhüter
        </button>
        <button
          type="button"
          className={`chip${showDiscontinued ? " on" : ""}`}
          onClick={() => {
            setShowDiscontinued((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          title="Artikel zeigen, die nur in der Verkaufshistorie stehen (nicht im aktuellen Billbee-Artikelstamm)"
        >
          auch ausgelaufene zeigen
        </button>
        <span className="count">
          {filtered.length} von {totalCount}
        </span>
      </div>

      <section className="card">
        <h3>
          Alle Artikel <span className="r">Fenster: {WINDOW_ORDER.find((w) => w.key === selectedWindow)?.label}</span>
          <ResetColumnsButton onClick={resetWidths} />
        </h3>
        <div className="tablewrap">
          <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
            <ResizableColgroup cols={COLS} widths={widths} />
            <ResizableThead
              cols={COLS}
              startResize={startResize}
              sort={{ colId: sort.colId, dir: sort.dir, onSort: (id) => handleSort(id) }}
              sortableCols={SORTABLE_COLS}
            />
            <tbody>
              {visible.map((row) => {
                const pill = STATUS_PILL[row.priceStatus];
                const w = row.windows[selectedWindow];
                return (
                  <tr key={row.articleId}>
                    <td>
                      <div className="artname" style={{ maxWidth: "100%" }} title={row.nameRaw}>
                        {row.nameRaw}
                        {!row.active && (
                          <span className="rank-badge" title="Nur in der Verkaufshistorie, nicht mehr im aktuellen Artikelstamm">
                            ausgelaufen
                          </span>
                        )}
                      </div>
                      {row.setCode && <div className="code">{row.setCode}</div>}
                    </td>
                    <td className="r num">{w?.rank ?? "—"}</td>
                    <td className="r">
                      <MicroVelocity values={row.velocity} max={maxVelocity} />
                    </td>
                    <td className="r num">€ {formatEuro(w?.revenue ?? 0)}</td>
                    <td className="r num">{w && w.qty > 0 ? `${formatEuroCents(w.avgPrice)} €` : "—"}</td>
                    <td className="r num">{row.avgVkRealized > 0 ? `${formatEuroCents(row.avgVkRealized)} €` : "—"}</td>
                    <td className="r num">
                      {row.listingVk !== null ? `${formatEuroCents(row.listingVk)} €` : <span className="p-muted">—</span>}
                    </td>
                    <td className="r num">{row.ek > 0 ? `${formatEuroCents(row.ek)} €` : "—"}</td>
                    <td className="r num">{formatEuroCents(row.dbIPerUnit)} €</td>
                    <td className="r num">{formatEuroCents(row.dbIIPerUnit)} €</td>
                    <td className="r num">{formatPercent(row.dbIIPercent)}%</td>
                    <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{row.classLabel}</td>
                    <td>
                      <span className={`pill ${pill.cls}`}>
                        <span className="dot" />
                        {pill.label}
                      </span>
                    </td>
                    <td className="r num">{row.stock > 0 ? row.stock : <span className="p-muted" title="Bestand nicht importiert">—</span>}</td>
                    <td className="r num">
                      {row.potentialRevenue !== null ? `€ ${formatEuro(row.potentialRevenue)}` : <span className="p-muted">—</span>}
                    </td>
                    <td className="r num">
                      {row.stockMonthsCover !== null ? `${row.stockMonthsCover.toFixed(1)} Mon.` : <span className="p-muted">—</span>}
                    </td>
                    <td className="r num">
                      {row.priceTrend !== null ? `${formatEuroCents(row.priceTrend)} €` : <span className="p-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} style={{ padding: "20px 12px", color: "var(--faint)", textAlign: "center" }}>
                    Keine Artikel für diesen Filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleCount < sorted.length && (
          <div className="loadmore">
            <button type="button" className="chip" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Mehr laden ({sorted.length - visibleCount} weitere)
            </button>
          </div>
        )}
      </section>
    </AppShell>
  );
}
