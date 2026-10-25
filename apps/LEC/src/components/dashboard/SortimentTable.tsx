"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { formatEuro, formatEuroCents } from "@/lib/format";
import { RANGE_TOLERANCE } from "@/lib/pricing/costEngine";
import { useColumnWidths, type ColumnDef } from "@/components/table/useColumnWidths";
import { ResizableColgroup, ResizableThead, ResetColumnsButton } from "@/components/table/ResizableTable";

interface Props {
  rows: SortimentRow[];
  /** Optional: nur die ersten N Zeilen zeigen (Dashboard-Vorschau). */
  limit?: number;
  /** Optional: Extra-Element neben "Spalten zuruecksetzen" (z. B. "Alle ansehen"-Link). */
  headerExtra?: ReactNode;
}

export const STATUS_PILL: Record<SortimentRow["priceStatus"], { cls: string; label: string }> = {
  // Zielspanne = 25 % bis 33 % Deckungsbeitrags-Marge (Chris, 13.10.), mindestens 4,99 €.
  unter_min: { cls: "p-warn", label: "zu günstig" },
  im_korridor: { cls: "p-good", label: "im Korridor" },
  ueber_gut: { cls: "p-mkt", label: "zu teuer" },
  // FIX 1: kein Korridor-Status, sondern Kennzeichnung "wir kennen den EK nicht" --
  // bewusst NICHT gruen/rot, damit hier keine falsche Sicherheit vorgetaeuscht wird.
  kein_ek: { cls: "p-warn", label: "kein EK" },
};

type ColId = "artikel" | "velocity" | "umsatz30" | "umsatz90" | "umsatz" | "vk" | "korridor" | "klasse" | "status";

const COLS: ColumnDef<ColId>[] = [
  { id: "artikel", label: "Artikel", def: 250, min: 120 },
  { id: "velocity", label: "Velocity 30·90·365", def: 178, min: 110 },
  { id: "umsatz30", label: "Umsatz 30 T", def: 112, min: 80, align: "r" },
  { id: "umsatz90", label: "Umsatz 90 T", def: 112, min: 80, align: "r" },
  { id: "umsatz", label: "Umsatz 365 T", def: 122, min: 80, align: "r" },
  { id: "vk", label: "VK", def: 88, min: 70, align: "r" },
  { id: "korridor", label: "Preis-Korridor", def: 182, min: 120 },
  { id: "klasse", label: "Klasse", def: 108, min: 80 },
  { id: "status", label: "Status", def: 120, min: 90 },
];

const STORAGE_KEY = "lec.sortiment.colWidths.v2";

/** Alle Spalten sind sortierbar. */
const SORTABLE: ColId[] = COLS.map((c) => c.id);

const STATUS_ORDER: Record<SortimentRow["priceStatus"], number> = { unter_min: 4, ueber_gut: 3, kein_ek: 2, im_korridor: 1 };

function sortValue(row: SortimentRow, col: ColId): number | string {
  switch (col) {
    case "artikel":
      return row.nameRaw.toLowerCase();
    case "velocity":
      return row.velocity[1];
    case "umsatz30":
      return row.windows["30"]?.revenue ?? 0;
    case "umsatz90":
      return row.windows["90"]?.revenue ?? 0;
    case "umsatz":
      return row.revenue365;
    case "vk":
      return row.listingVk ?? row.avgVkRealized;
    case "korridor":
      return row.corridor.min;
    case "klasse":
      return row.classLabel;
    case "status":
      return STATUS_ORDER[row.priceStatus];
  }
}

export function SortimentTable({ rows, limit, headerExtra }: Props) {
  const [sort, setSort] = useState<{ colId: ColId | null; dir: "asc" | "desc" }>({ colId: null, dir: "desc" });
  const sorted = useMemo(() => {
    if (!sort.colId) return rows;
    const col = sort.colId;
    const copy = [...rows];
    copy.sort((a, b) => {
      const x = sortValue(a, col);
      const y = sortValue(b, col);
      const d = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y), "de") : x - y;
      return sort.dir === "asc" ? d : -d;
    });
    return copy;
  }, [rows, sort]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const maxVelocity = Math.max(1, ...shown.flatMap((r) => r.velocity));

  const columnWidths = useColumnWidths(COLS, STORAGE_KEY);
  const { widths, total, startResize, resetWidths } = columnWidths;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h3>
        Sortiment{" "}
        <span className="r">
          VK vs. Zielspanne (25–33 % Marge)
          <ResetColumnsButton onClick={resetWidths} />
          {headerExtra}
        </span>
      </h3>
      <div className="tablewrap">
        <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
          <ResizableColgroup cols={COLS} widths={widths} />
          <ResizableThead
            cols={COLS}
            startResize={startResize}
            sortableCols={SORTABLE}
            sort={{
              colId: sort.colId,
              dir: sort.dir,
              onSort: (id) => setSort((prev) => (prev.colId === id ? { colId: id, dir: prev.dir === "desc" ? "asc" : "desc" } : { colId: id, dir: id === "artikel" || id === "klasse" ? "asc" : "desc" })),
            }}
          />
          <tbody>
            {shown.map((row) => {
              const pill = STATUS_PILL[row.priceStatus];
              // Aktueller Listen-VK ist die Vergleichsbasis fuer den Korridor
              // (Fallback: realisierter Ø-VK ohne Artikelstamm-Daten), siehe
              // SortimentRow.listingVk.
              const vkForDisplay = row.listingVk ?? row.avgVkRealized;
              return (
                <tr key={row.articleId}>
                  <td>
                    <div className="artname" style={{ maxWidth: "100%" }} title={row.nameRaw}>
                      {row.nameRaw}
                    </div>
                    {row.setCode && <div className="code">{row.setCode}</div>}
                  </td>
                  <td>
                    <MicroVelocity values={row.velocity} max={maxVelocity} />
                  </td>
                  <td className="r num">{row.windows["30"] ? `€ ${formatEuro(row.windows["30"].revenue)}` : "—"}</td>
                  <td className="r num">{row.windows["90"] ? `€ ${formatEuro(row.windows["90"].revenue)}` : "—"}</td>
                  <td className="r num">€ {formatEuro(row.revenue365)}</td>
                  <td className="r num">{vkForDisplay > 0 ? `${formatEuroCents(vkForDisplay)} €` : "—"}</td>
                  <td>
                    <Corridor
                      min={row.corridor.min}
                      good={row.corridor.good}
                      contribution={row.corridor.contribution}
                      vk={vkForDisplay}
                    />
                  </td>
                  <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{row.classLabel}</td>
                  <td>
                    <span className={`pill ${pill.cls}`}>
                      <span className="dot" />
                      {pill.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MicroVelocity({ values, max }: { values: [number, number, number]; max: number }) {
  return (
    <span className="veloc">
      <span className="micro" title="Velocity 30/90/365 T (gleiche Skala)">
        {values.map((v, i) => (
          <i key={i} style={{ height: `${Math.max(2, (v / max) * 20)}px` }} />
        ))}
      </span>
      <span className="vnums">{values.join(" · ")}</span>
    </span>
  );
}

interface CorridorProps {
  min: number;
  good: number;
  vk: number;
  /** Deckungsbeitrags-Grenze: VK, unter dem jeder Verkauf schon vor Fixkosten Geld kostet (roter Marker "DB"). */
  contribution?: number;
  /** Optionaler Cardmarket-Preistrend -- rendert einen zusaetzlichen blauen Markt-Marker (PAGES_CONCEPT §3). */
  marketValue?: number | null;
}

export function Corridor({ min, good, vk, contribution, marketValue }: CorridorProps) {
  const hasContribution = contribution !== undefined && Number.isFinite(contribution) && contribution > 0;
  const rangeMin = Math.min(min, hasContribution ? contribution : min) * 0.7;
  const rangeMax = good * 1.25;
  const range = rangeMax - rangeMin || 1;
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - rangeMin) / range) * 100));
  const meColor =
    vk === 0
      ? "var(--faint)"
      : vk < min * (1 - RANGE_TOLERANCE)
        ? "var(--crit)"
        : vk > good * (1 + RANGE_TOLERANCE)
          ? "var(--market)"
          : "var(--good)";

  return (
    <div className="corridor">
      <div className="crange">
        <div
          className="band"
          style={{ left: `${pos(min)}%`, width: `${pos(good) - pos(min)}%` }}
        />
        {hasContribution && (
          <div
            className="dk"
            style={{ left: `${pos(contribution)}%` }}
            title={`Deckungsbeitrags-Grenze ${contribution.toFixed(2)} € — darunter Verlust pro Verkauf`}
          />
        )}
        <div className="mn" style={{ left: `${pos(min)}%` }} />
        <div className="gx" style={{ left: `${pos(good)}%` }} />
        {marketValue !== undefined && marketValue !== null && marketValue > 0 && (
          <div className="mk" style={{ left: `${pos(marketValue)}%` }} title={`Marktwert ${marketValue.toFixed(2)} €`} />
        )}
        {vk > 0 && <div className="me" style={{ left: `${pos(vk)}%`, background: meColor }} />}
      </div>
      <div className="clabels">
        {hasContribution && <span title="Deckungsbeitrags-Grenze">DB {contribution.toFixed(2)}</span>}
        <span title="VK für 25 % Deckungsbeitrags-Marge">25 % {min.toFixed(2)}</span>
        <span title="VK für 33 % Deckungsbeitrags-Marge">33 % {good.toFixed(2)}</span>
      </div>
    </div>
  );
}
