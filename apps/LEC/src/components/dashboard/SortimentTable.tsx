"use client";

import type { ReactNode } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { formatEuro, formatEuroCents } from "@/lib/format";
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
  unter_min: { cls: "p-crit", label: "unter MIN" },
  im_korridor: { cls: "p-good", label: "im Korridor" },
  ueber_gut: { cls: "p-mkt", label: "über Markt" },
};

type ColId = "artikel" | "velocity" | "umsatz" | "vk" | "korridor" | "klasse" | "status";

const COLS: ColumnDef<ColId>[] = [
  { id: "artikel", label: "Artikel", def: 250, min: 120 },
  { id: "velocity", label: "Velocity 30·90·365", def: 178, min: 110 },
  { id: "umsatz", label: "Umsatz 365 T", def: 132, min: 90, align: "r" },
  { id: "vk", label: "VK", def: 88, min: 70, align: "r" },
  { id: "korridor", label: "Preis-Korridor", def: 182, min: 120 },
  { id: "klasse", label: "Klasse", def: 108, min: 80 },
  { id: "status", label: "Status", def: 120, min: 90 },
];

const STORAGE_KEY = "lec.sortiment.colWidths.v1";

export function SortimentTable({ rows, limit, headerExtra }: Props) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const maxVelocity = Math.max(1, ...shown.flatMap((r) => r.velocity));

  const columnWidths = useColumnWidths(COLS, STORAGE_KEY);
  const { widths, total, startResize, resetWidths } = columnWidths;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h3>
        Sortiment{" "}
        <span className="r">
          VK vs. Preis-Korridor (MIN 25 % … GUT 35 %)
          <ResetColumnsButton onClick={resetWidths} />
          {headerExtra}
        </span>
      </h3>
      <div className="tablewrap">
        <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
          <ResizableColgroup cols={COLS} widths={widths} />
          <ResizableThead cols={COLS} startResize={startResize} />
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
                  <td className="r num">€ {formatEuro(row.revenue365)}</td>
                  <td className="r num">{vkForDisplay > 0 ? `${formatEuroCents(vkForDisplay)} €` : "—"}</td>
                  <td>
                    <Corridor min={row.corridor.min} good={row.corridor.good} vk={vkForDisplay} />
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

export function Corridor({ min, good, vk }: { min: number; good: number; vk: number }) {
  const rangeMin = min * 0.7;
  const rangeMax = good * 1.25;
  const range = rangeMax - rangeMin || 1;
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - rangeMin) / range) * 100));
  const meColor = vk === 0 ? "var(--faint)" : vk < min ? "var(--crit)" : vk > good ? "var(--market)" : "var(--good)";

  return (
    <div className="corridor">
      <div className="crange">
        <div
          className="band"
          style={{ left: `${pos(min)}%`, width: `${pos(good) - pos(min)}%` }}
        />
        <div className="mn" style={{ left: `${pos(min)}%` }} />
        <div className="gx" style={{ left: `${pos(good)}%` }} />
        {vk > 0 && <div className="me" style={{ left: `${pos(vk)}%`, background: meColor }} />}
      </div>
      <div className="clabels">
        <span>MIN {min.toFixed(2)}</span>
        <span>GUT {good.toFixed(2)}</span>
      </div>
    </div>
  );
}
