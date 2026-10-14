"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SortimentRow, SortimentMarket } from "@/lib/dashboard/viewModel";
import type { ArticleClass } from "@/lib/pricing/classification";
import type { SaleWindowKey } from "@/lib/parsing/date";
import { LABELS_DE } from "@/lib/dashboard/viewModel";
import { normalizedNameKey } from "@/lib/parsing/name";
import {
  MARKET_FILTER_HINT,
  MARKET_FILTER_LABEL,
  MARKET_FILTER_ORDER,
  countMarketFilters,
  matchesMarketFilter,
  type MarketFilter,
} from "@/lib/dashboard/marketFilter";
import { formatEuro, formatEuroCents, formatPercent } from "@/lib/format";
import { AppShell } from "@/components/shell/AppShell";
import { PreisBoard } from "./PreisBoard";
import { ArtikelDetail } from "./ArtikelDetail";
import { PreisUeberblick, type BandPoint, type ClassPick } from "./PreisUeberblick";
import { BOARD_SORT_LABEL, sortBoard, type BoardSortKey } from "@/lib/dashboard/board";
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
/** SortimentRow.priceStatus statt costEngine.PriceStatus (FIX 1): enthaelt zusaetzlich
 * "kein_ek" fuer Artikel ohne jeden EK-Anhaltspunkt. */
type RowPriceStatus = SortimentRow["priceStatus"];
const STATUS_ORDER: RowPriceStatus[] = ["unter_min", "im_korridor", "ueber_gut", "kein_ek"];

const MARKET_PILL: Record<SortimentMarket["status"], { cls: string; label: string }> = {
  zu_guenstig: { cls: "p-warn", label: "zu günstig" },
  im_korridor: { cls: "p-good", label: "im Rahmen" },
  zu_teuer: { cls: "p-mkt", label: "zu teuer" },
};

function marketHow(m: SortimentMarket): string {
  if (m.range) return `${m.range.variants} Varianten im Set, die Seltenheit lässt sich nicht eindeutig zuordnen — Spanne statt Einzelwert`;
  if (m.how === "seltenheit") return "Cardmarket-7-Tage-Schnitt der Variante mit der Seltenheit aus deinem Titel";
  if (m.how === "einzige_variante") return "Cardmarket-7-Tage-Schnitt (die Karte hat im Set nur eine Variante)";
  return "Cardmarket-7-Tage-Schnitt";
}

type ColId =
  | "artikel"
  | "rank"
  | "verkaeufe"
  | "umsatz"
  | "avgpreis"
  | "avgvk"
  | "listingvk"
  | "marktwert"
  | "zielspanne"
  | "marktampel"
  | "marktmarge"
  | "korridor"
  | "ek"
  | "dbI"
  | "dbII"
  | "dbIII"
  | "dbIIpct"
  | "dbIIIpct"
  | "klasse"
  | "status"
  | "stock"
  | "potvk"
  | "stockcover";

const COLS: ColumnDef<ColId>[] = [
  { id: "artikel", label: "Artikel", def: 276, min: 170 },
  { id: "rank", label: "Rank", def: 62, min: 50, align: "r" },
  { id: "verkaeufe", label: "Verkäufe", def: 84, min: 60, align: "r" },
  { id: "umsatz", label: "Umsatz", def: 96, min: 70, align: "r" },
  { id: "avgpreis", label: "Ø Preis", def: 84, min: 65, align: "r" },
  { id: "avgvk", label: "Ø-VK (real.)", def: 96, min: 70, align: "r" },
  // Aktueller VK = Angebotspreis aus dem eBay-Shop (live, alle 6 Stunden), sonst Billbee-Artikelstamm.
  { id: "listingvk", label: "Akt. VK (eBay)", def: 104, min: 80, align: "r" },
  // Cardmarket-Block: was kostet die Karte heute (Marktwert), wo sollte der VK stehen (25-33 %
  // Deckungsbeitrag bei Nachkauf zum Marktwert), und stimmt dein VK damit ueberein.
  { id: "marktwert", label: "Marktwert", def: 112, min: 80, align: "r" },
  { id: "zielspanne", label: "Empf. VK 25–33 %", def: 140, min: 100, align: "r" },
  { id: "marktampel", label: "VK vs. Markt", def: 108, min: 85 },
  { id: "marktmarge", label: "Marge bei Nachkauf", def: 100, min: 80, align: "r" },
  // Direkt neben dem Listen-VK: der Marker IM Korridor IST dieser VK -- nebeneinander
  // liest man "Preis" und "wo steht er im Korridor" in einem Blick (PAGES_CONCEPT §3).
  { id: "korridor", label: "Preis-Korridor", def: 182, min: 120 },
  { id: "ek", label: "Preis EK", def: 82, min: 65, align: "r" },
  { id: "dbI", label: "DB I/Stk", def: 84, min: 65, align: "r" },
  { id: "dbII", label: "DB II/Stk", def: 88, min: 65, align: "r" },
  // DB III = DB II abzueglich Fixkostenanteil. DB II sagt "lohnt der einzelne
  // Verkauf", DB III sagt "traegt der Artikel seinen Anteil an Shop, Billbee,
  // Lexoffice, Raumkosten und Lizenzen". Bei Billigkarten liegen beide weit
  // auseinander -- genau dort faellt die Sortimentsentscheidung.
  { id: "dbIII", label: "DB III/Stk", def: 92, min: 65, align: "r" },
  { id: "dbIIpct", label: "DB II %", def: 76, min: 60, align: "r" },
  { id: "dbIIIpct", label: "DB III %", def: 80, min: 60, align: "r" },
  { id: "klasse", label: "Klasse", def: 100, min: 80 },
  { id: "status", label: "Status", def: 116, min: 90 },
  { id: "stock", label: "Stk", def: 62, min: 50, align: "r" },
  { id: "potvk", label: "pot. VK€", def: 90, min: 70, align: "r" },
  { id: "stockcover", label: "Stk > VK", def: 90, min: 70, align: "r" },
];

const SORTABLE_COLS: ColId[] = [
  "rank",
  "verkaeufe",
  "umsatz",
  "avgpreis",
  "avgvk",
  "listingvk",
  "marktwert",
  "zielspanne",
  "marktampel",
  "marktmarge",
  "ek",
  "dbI",
  "dbII",
  "dbIII",
  "dbIIpct",
  "dbIIIpct",
  "stock",
  "potvk",
  "stockcover",
];

const STORAGE_KEY = "lec.sortimentPage.colWidths.v2";
const PAGE_SIZE = 100;

interface Props {
  rows: SortimentRow[];
  totalCount: number;
  activeCount: number;
  discontinuedCount: number;
  ladenhueterCount: number;
  /** articleId -> Bildkennung; fehlt ein Artikel, gibt es (noch) kein Bild. */
  imageVersions: Record<string, string>;
  /** Zielband (25–33 %) an log-verteilten Marktwerten, fuer die Grafik. */
  band: BandPoint[];
}

function imageSrc(articleId: string, version: string): string {
  return `/api/article-image/${encodeURIComponent(articleId)}?v=${encodeURIComponent(version)}`;
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
    case "dbIII":
      return row.dbIIIPerUnit;
    case "dbIIpct":
      return row.dbIIPercent;
    case "dbIIIpct":
      return row.dbIIIPercent;
    case "stock":
      return row.stock;
    case "potvk":
      return row.potentialRevenue ?? -1;
    case "stockcover":
      return row.stockMonthsCover ?? -1;
    case "marktwert":
      return row.market?.value ?? row.market?.range?.max ?? -1;
    case "zielspanne":
      return row.market?.targetMin ?? -1;
    case "marktmarge":
      return row.market?.margin ?? -9;
    case "marktampel":
      // zu guenstig oben (liegengelassenes Geld), dann zu teuer, dann im Rahmen, ohne Urteil unten
      return !row.market || !row.market.rated ? -1 : row.market.status === "zu_guenstig" ? 3 : row.market.status === "zu_teuer" ? 2 : 1;
    default:
      return 0;
  }
}

export function SortimentPage({ rows, totalCount, activeCount, discontinuedCount, ladenhueterCount, imageVersions, band }: Props) {
  const [preview, setPreview] = useState<{ src: string; x: number; y: number } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailRow = useMemo(() => (detailId ? rows.find((r) => r.articleId === detailId) ?? null : null), [detailId, rows]);
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
  const [statusFilter, setStatusFilter] = useState<Set<RowPriceStatus>>(new Set());
  const [marketFilter, setMarketFilter] = useState<Set<MarketFilter>>(() => {
    const raw = searchParams.get("markt");
    return raw ? new Set(raw.split(",").filter((m): m is MarketFilter => MARKET_FILTER_ORDER.includes(m as MarketFilter))) : new Set();
  });
  // Eingrenzung aus dem Balkendiagramm: Marktwert-Klasse.
  const [valueRange, setValueRange] = useState<{ lo: number; hi: number; label: string } | null>(null);
  const [onlyLadenhueter, setOnlyLadenhueter] = useState(false);
  const [onlyNameCheck, setOnlyNameCheck] = useState(false);
  // Ansicht: "kompakt" = Preis-Board (eine Frage je Zeile), "alles" = alle Spalten wie bisher.
  const [view, setView] = useState<"kompakt" | "alles">(searchParams.get("ansicht") === "alles" ? "alles" : "kompakt");
  const [boardSort, setBoardSort] = useState<BoardSortKey>("abweichung");
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
    if (marketFilter.size > 0) params.set("markt", Array.from(marketFilter).join(","));
    if (view === "alles") params.set("ansicht", "alles");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedWindow, classFilter, marketFilter, view]);

  function toggleClass(cls: ArticleClass) {
    setClassFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  function toggleStatus(status: RowPriceStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  function toggleMarket(f: MarketFilter) {
    setMarketFilter((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  function pickClass(p: ClassPick) {
    setValueRange({ lo: p.lo, hi: p.hi, label: p.label });
    setMarketFilter(new Set([p.verdict]));
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
    if (marketFilter.size > 0) {
      result = result.filter((r) => matchesMarketFilter(r.market, marketFilter));
    }
    if (valueRange) {
      result = result.filter((r) => {
        const v = r.market?.value;
        return v != null && v >= valueRange.lo && v < valueRange.hi;
      });
    }
    if (onlyNameCheck) {
      result = result.filter((r) => r.codeName?.mismatch);
    }
    if (onlyLadenhueter) {
      result = result.filter((r) => r.articleClass === "ladenhueter");
    }
    if (!showDiscontinued) {
      result = result.filter((r) => r.active);
    }
    return result;
  }, [rows, query, classFilter, statusFilter, marketFilter, valueRange, onlyNameCheck, onlyLadenhueter, showDiscontinued]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const diff = sortValue(a, sort.colId, selectedWindow) - sortValue(b, sort.colId, selectedWindow);
      return sort.dir === "asc" ? diff : -diff;
    });
    return copy;
  }, [filtered, sort, selectedWindow]);

  // Zaehler je Markt-Filter ueber die aktiven Artikel (ohne die anderen Filter), damit man sieht, wie viele es sind.
  const marketCounts = useMemo(() => countMarketFilters(rows.filter((r) => r.active).map((r) => r.market)), [rows]);

  const visible = sorted.slice(0, visibleCount);
  const boardRows = useMemo(() => sortBoard(filtered, boardSort).slice(0, visibleCount), [filtered, boardSort, visibleCount]);
  const extraFiltersActive = onlyNameCheck || classFilter.size > 0 || statusFilter.size > 0 || onlyLadenhueter || showDiscontinued || marketFilter.has("ek_ueber");
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
          <div className="seg" title="Kompakt: nur der Preis-Vergleich. Alle Spalten: Verkäufe, Deckungsbeiträge, Klassen.">
            <button type="button" className={view === "kompakt" ? "on" : undefined} onClick={() => setView("kompakt")}>
              Kompakt
            </button>
            <button type="button" className={view === "alles" ? "on" : undefined} onClick={() => setView("alles")}>
              Alle Spalten
            </button>
          </div>
          {view === "alles" && (
            <div className="seg">
              {WINDOW_ORDER.map((w) => (
                <button key={w.key} type="button" className={selectedWindow === w.key ? "on" : undefined} onClick={() => setSelectedWindow(w.key)}>
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </>
      }
      footer={<span>Alle Zahlen serverseitig berechnet · Filter/Sortierung laufen clientseitig.</span>}
    >
      <div className="bd-cards" role="group" aria-label="VK gegen Marktwert">
        {(
          [
            { f: "zu_guenstig", tone: "low", hint: "VK unter der Zielspanne — hier liegt Geld auf dem Tisch" },
            { f: "im_korridor", tone: "ok", hint: "VK in der Zielspanne (25–33 % Marge, teure Karten bis 1,5× Markt)" },
            { f: "zu_teuer", tone: "high", hint: "VK über der Zielspanne — verkauft sich vermutlich nicht" },
            { f: "offen", tone: "none", hint: "Kein Marktwert oder Seltenheit nicht eindeutig" },
          ] as const
        ).map(({ f, tone, hint }) => (
          <button
            key={f}
            type="button"
            className={`bd-card bd-card-${tone}${marketFilter.has(f) ? " on" : ""}`}
            title={MARKET_FILTER_HINT[f]}
            aria-pressed={marketFilter.has(f)}
            onClick={() => toggleMarket(f)}
          >
            <span className="bd-card-label">{MARKET_FILTER_LABEL[f]}</span>
            <span className="bd-card-n">{marketCounts[f].toLocaleString("de-DE")}</span>
            <span className="bd-card-hint">{hint}</span>
          </button>
        ))}
      </div>
      <details className="bd-more" open={extraFiltersActive}>
        <summary>
          Weitere Filter{extraFiltersActive ? " · aktiv" : ""}
          <span className="count">
            {filtered.length.toLocaleString("de-DE")} von {totalCount.toLocaleString("de-DE")} Artikeln
          </span>
        </summary>
        <div className="filterrow" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`chip${marketFilter.has("ek_ueber") ? " on" : ""}`}
            title={MARKET_FILTER_HINT.ek_ueber}
            onClick={() => toggleMarket("ek_ueber")}
          >
            {MARKET_FILTER_LABEL.ek_ueber} <span className="chipn">{marketCounts.ek_ueber}</span>
          </button>
        </div>
      <div className="filterrow">
        <span className="flabel">Klasse</span>
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
        <span className="flabel" title="Korridor mit deinem eigenen EK (Billbee); „kein EK“ = ohne Einkaufspreis keine Rechnung möglich">
          eigener EK
        </span>
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
          className={`chip${onlyNameCheck ? " on" : ""}`}
          onClick={() => {
            setOnlyNameCheck((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          title="Artikel, bei denen Name und Set-Code im Titel nicht zusammenpassen (eines von beiden ist falsch)"
        >
          Name ≠ Code
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
      </div>
      </details>

      {view === "kompakt" ? (
        <section className="bd-card-list">
          <details className="bd-over">
            <summary>Überblick: Grafiken zur Auswahl</summary>
            <PreisUeberblick rows={filtered} band={band} onOpen={setDetailId} onPick={pickClass} />
          </details>
          {valueRange && (
            <span className="bd-rangechip">
              Marktwert {valueRange.label}
              <button type="button" onClick={() => setValueRange(null)} aria-label="Eingrenzung aufheben">×</button>
            </span>
          )}
          <div className="bd-toolbar">
            <label>
              Sortierung
              <select value={boardSort} onChange={(e) => setBoardSort(e.target.value as BoardSortKey)}>
                {(Object.keys(BOARD_SORT_LABEL) as BoardSortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {BOARD_SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <span className="bd-legend">
              <i className="bd-lg-band" /> Zielspanne<i className="bd-lg-me" /> dein VK<i className="bd-lg-mk" /> Marktwert
            </span>
          </div>
          <PreisBoard rows={boardRows} imageVersions={imageVersions} imageSrc={imageSrc} onPreview={setPreview} onOpen={setDetailId} />
          {detailRow && (
            <ArtikelDetail
              row={detailRow}
              imageSrc={imageVersions[detailRow.articleId] ? imageSrc(detailRow.articleId, imageVersions[detailRow.articleId]) : null}
              onClose={() => setDetailId(null)}
            />
          )}
          {filtered.length > boardRows.length && (
            <div className="bd-more-rows">
              <button type="button" className="chip" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Weitere {Math.min(PAGE_SIZE, filtered.length - boardRows.length)} anzeigen · {(filtered.length - boardRows.length).toLocaleString("de-DE")} übrig
              </button>
            </div>
          )}
        </section>
      ) : (
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
                // Gleiche Vergleichsbasis wie der Ampel-Status: aktueller Listen-VK,
                // Fallback realisierter Ø-VK, wenn kein Artikelstamm-Preis vorliegt.
                const vkForCorridor = row.listingVk ?? row.avgVkRealized;
                return (
                  <tr key={row.articleId}>
                    <td>
                      <div className="artcell">
                        {imageVersions[row.articleId] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="cardthumb"
                            src={imageSrc(row.articleId, imageVersions[row.articleId])}
                            alt=""
                            loading="lazy"
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              const y = Math.max(8, Math.min(r.top - 60, window.innerHeight - 390));
                              setPreview({ src: e.currentTarget.src, x: r.right + 12, y });
                            }}
                            onMouseLeave={() => setPreview(null)}
                          />
                        ) : (
                          <span className="cardthumb none" title="Kein Bild gefunden" />
                        )}
                        <div className="arttext">
                          <div className="artname" style={{ maxWidth: "100%" }} title={row.nameRaw}>
                            {row.nameRaw}
                            {!row.active && (
                              <span className="rank-badge" title="Nur in der Verkaufshistorie, nicht mehr im aktuellen Artikelstamm">
                                ausgelaufen
                              </span>
                            )}
                          </div>
                          {row.setCode && <div className="code">{row.setCode}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="r num">{w?.rank ?? "—"}</td>
                    <td className="r">
                      <MicroVelocity values={row.velocity} max={maxVelocity} />
                    </td>
                    <td className="r num">€ {formatEuro(w?.revenue ?? 0)}</td>
                    <td className="r num">{w && w.qty > 0 ? `${formatEuroCents(w.avgPrice)} €` : "—"}</td>
                    <td className="r num">{row.avgVkRealized > 0 ? `${formatEuroCents(row.avgVkRealized)} €` : "—"}</td>
                    <td
                      className="r num"
                      title={
                        row.listingVkSource === "ebay"
                          ? `Aktueller Angebotspreis aus deinem eBay-Shop${row.listingVkAt ? ` (Stand ${new Date(row.listingVkAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})` : ""}`
                          : row.listingVkSource === "billbee"
                            ? "Aus dem Billbee-Artikelstamm (bei eBay gerade nicht gelistet)"
                            : undefined
                      }
                    >
                      {row.listingVk !== null ? (
                        <>
                          {formatEuroCents(row.listingVk)} €
                          {row.listingVkSource === "ebay" && <span className="vksrc" />}
                        </>
                      ) : (
                        <span className="p-muted">—</span>
                      )}
                    </td>
                    <td className="r num" title={row.market ? marketHow(row.market) : "Kein Cardmarket-Marktwert (kein Set-Code oder Karte unbekannt)"}>
                      {row.market?.value != null ? (
                        `${formatEuroCents(row.market.value)} €`
                      ) : row.market?.range ? (
                        `${formatEuroCents(row.market.range.min)}–${formatEuroCents(row.market.range.max)} €`
                      ) : (
                        <span className="p-muted">—</span>
                      )}
                    </td>
                    <td className="r num" title="VK für 25 % (Minimum) bis 33 % (Optimum) Deckungsbeitrags-Marge bei Nachkauf zum Marktwert inkl. Einkaufs-Versand, mindestens 4,99 €">
                      {row.market?.targetMin != null && row.market.targetOpt != null ? (
                        row.market.targetMin === row.market.targetOpt ? (
                          `${formatEuroCents(row.market.targetMin)} €`
                        ) : (
                          `${formatEuroCents(row.market.targetMin)}–${formatEuroCents(row.market.targetOpt)} €`
                        )
                      ) : (
                        <span className="p-muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.market && row.market.rated ? (
                        <span className={`pill ${MARKET_PILL[row.market.status].cls}`}>
                          <span className="dot" />
                          {MARKET_PILL[row.market.status].label}
                        </span>
                      ) : (
                        <span className="p-muted" style={{ fontSize: 11.5 }}>
                          {row.market?.range ? "Seltenheit offen" : "kein Marktwert"}
                        </span>
                      )}
                      {row.market?.ekAboveMarket && (
                        <div className="down" style={{ fontSize: 10.5 }} title={MARKET_FILTER_HINT.ek_ueber}>
                          EK über Markt
                        </div>
                      )}
                    </td>
                    <td
                      className="r num"
                      style={{ color: row.market?.margin == null ? undefined : row.market.margin < 0 ? "var(--crit)" : row.market.margin < 0.25 ? "var(--warn)" : "var(--good)" }}
                      title="Deckungsbeitrags-Marge (vor Fixkosten), die dein heutiger VK bringt, wenn du die Karte jetzt zum Marktwert nachkaufst"
                    >
                      {row.market?.margin != null ? `${formatPercent(row.market.margin)}%` : <span className="p-muted">—</span>}
                    </td>
                    <td>
                      <Corridor
                        min={row.corridor.min}
                        good={row.corridor.good}
                        contribution={row.corridor.contribution}
                        vk={vkForCorridor}
                        marketValue={row.priceTrend}
                      />
                    </td>
                    <td className="r num">{row.ek > 0 ? `${formatEuroCents(row.ek)} €` : "—"}</td>
                    <td className="r num">{formatEuroCents(row.dbIPerUnit)} €</td>
                    <td className="r num">{formatEuroCents(row.dbIIPerUnit)} €</td>
                    <td className="r num" style={{ color: row.dbIIIPerUnit < 0 ? "var(--crit)" : undefined }}>
                      {formatEuroCents(row.dbIIIPerUnit)} €
                    </td>
                    <td className="r num">{formatPercent(row.dbIIPercent)}%</td>
                    <td className="r num" style={{ color: row.dbIIIPercent < 0 ? "var(--crit)" : undefined }}>
                      {formatPercent(row.dbIIIPercent)}%
                    </td>
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
      )}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cardpreview" src={preview.src} alt="" style={{ left: preview.x, top: preview.y }} />
      )}
    </AppShell>
  );
}
