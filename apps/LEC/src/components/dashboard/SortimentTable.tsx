"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { formatEuro, formatEuroCents } from "@/lib/format";

interface Props {
  rows: SortimentRow[];
}

const STATUS_PILL: Record<SortimentRow["priceStatus"], { cls: string; label: string }> = {
  unter_min: { cls: "p-crit", label: "unter MIN" },
  im_korridor: { cls: "p-good", label: "im Korridor" },
  ueber_gut: { cls: "p-mkt", label: "über Markt" },
};

type ColId = "artikel" | "velocity" | "umsatz" | "vk" | "korridor" | "klasse" | "status";

const COLS: { id: ColId; label: string; def: number; min: number; align?: "r" }[] = [
  { id: "artikel", label: "Artikel", def: 250, min: 120 },
  { id: "velocity", label: "Velocity 30·90·365", def: 178, min: 110 },
  { id: "umsatz", label: "Umsatz 365 T", def: 132, min: 90, align: "r" },
  { id: "vk", label: "VK", def: 88, min: 70, align: "r" },
  { id: "korridor", label: "Preis-Korridor", def: 182, min: 120 },
  { id: "klasse", label: "Klasse", def: 108, min: 80 },
  { id: "status", label: "Status", def: 120, min: 90 },
];

const STORAGE_KEY = "lec.sortiment.colWidths.v1";

function defaultWidths(): Record<ColId, number> {
  return Object.fromEntries(COLS.map((c) => [c.id, c.def])) as Record<ColId, number>;
}

export function SortimentTable({ rows }: Props) {
  const maxVelocity = Math.max(1, ...rows.flatMap((r) => r.velocity));

  const [widths, setWidths] = useState<Record<ColId, number>>(defaultWidths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  // Gespeicherte Breiten pro Geraet laden.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        setWidths((w) => ({ ...w, ...saved }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Record<ColId, number>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const startResize = useCallback(
    (e: React.PointerEvent, colId: ColId, minW: number) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widthsRef.current[colId];
      const handle = e.currentTarget as HTMLElement;
      handle.classList.add("active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const w = Math.max(minW, Math.round(startW + (ev.clientX - startX)));
        setWidths((prev) => ({ ...prev, [colId]: w }));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        handle.classList.remove("active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        persist(widthsRef.current);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [persist],
  );

  const resetWidths = useCallback(() => {
    const d = defaultWidths();
    setWidths(d);
    persist(d);
  }, [persist]);

  const total = COLS.reduce((sum, c) => sum + widths[c.id], 0);

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h3>
        Sortiment{" "}
        <span className="r">
          VK vs. Preis-Korridor (MIN 25 % … GUT 35 %)
          <button type="button" className="col-reset" onClick={resetWidths} title="Spaltenbreiten zurücksetzen">
            Spalten zurücksetzen
          </button>
        </span>
      </h3>
      <div className="tablewrap">
        <table className="resizable" style={{ tableLayout: "fixed", width: total, minWidth: total }}>
          <colgroup>
            {COLS.map((c) => (
              <col key={c.id} style={{ width: widths[c.id] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLS.map((c, i) => (
                <th key={c.id} className={c.align === "r" ? "r" : undefined}>
                  <span className="th-label">{c.label}</span>
                  {i < COLS.length - 1 && (
                    <span
                      className="col-resizer"
                      onPointerDown={(e) => startResize(e, c.id, c.min)}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Spaltenbreite ${c.label} anpassen`}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pill = STATUS_PILL[row.priceStatus];
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
                  <td className="r num">{row.vk > 0 ? `${formatEuroCents(row.vk)} €` : "—"}</td>
                  <td>
                    <Corridor min={row.corridor.min} good={row.corridor.good} vk={row.vk} />
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

function MicroVelocity({ values, max }: { values: [number, number, number]; max: number }) {
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

function Corridor({ min, good, vk }: { min: number; good: number; vk: number }) {
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
