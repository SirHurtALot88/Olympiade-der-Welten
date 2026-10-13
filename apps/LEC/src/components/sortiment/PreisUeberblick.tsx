"use client";

import { useMemo } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { boardVk } from "@/lib/dashboard/board";
import { formatEuro, formatEuroCents } from "@/lib/format";

/**
 * Ueberblick ueber das Preis-Board: zwei Grafiken, die zeigen, WO die Preisfehler liegen.
 * 1. Streudiagramm Marktwert (x) gegen dein VK (y), beide logarithmisch. Das gruene Band ist die
 *    Zielspanne (25-33 % Deckungsbeitrag, teure Karten bis 1,5-fach); ein Punkt unter dem Band ist
 *    zu guenstig, darueber zu teuer. Die gestrichelte Linie ist "VK = Marktwert".
 * 2. Verteilung des Urteils je Marktwert-Klasse — zeigt, ob die Fehler bei Billigkarten oder bei
 *    den teuren Stuecken liegen.
 * Beide folgen den aktiven Filtern.
 */

export interface BandPoint {
  m: number;
  min: number;
  opt: number;
}

const COLORS = { zu_guenstig: "var(--warn)", im_korridor: "var(--good)", zu_teuer: "var(--market)" } as const;

const W = 520;
const H = 330;
const PAD = { l: 46, r: 14, t: 12, b: 38 };
const LO = 0.3;
const HI = 700;
const TICKS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

const lx = (v: number) => PAD.l + ((Math.log(Math.max(LO, Math.min(HI, v))) - Math.log(LO)) / (Math.log(HI) - Math.log(LO))) * (W - PAD.l - PAD.r);
const ly = (v: number) => H - PAD.b - ((Math.log(Math.max(LO, Math.min(HI, v))) - Math.log(LO)) / (Math.log(HI) - Math.log(LO))) * (H - PAD.t - PAD.b);
const tick = (v: number) => (v < 1 ? formatEuroCents(v) : formatEuro(v));

const CLASSES: { label: string; lo: number; hi: number }[] = [
  { label: "bis 2 €", lo: 0, hi: 2 },
  { label: "2–5 €", lo: 2, hi: 5 },
  { label: "5–20 €", lo: 5, hi: 20 },
  { label: "20–50 €", lo: 20, hi: 50 },
  { label: "ab 50 €", lo: 50, hi: Infinity },
];

export function PreisUeberblick({ rows, band }: { rows: SortimentRow[]; band: BandPoint[] }) {
  const points = useMemo(
    () =>
      rows
        .filter((r) => r.market?.rated && r.market.value !== null && boardVk(r) > 0)
        .map((r) => ({ id: r.articleId, x: r.market!.value as number, y: boardVk(r), v: r.market!.status })),
    [rows]
  );

  const classes = useMemo(
    () =>
      CLASSES.map((c) => {
        const inClass = points.filter((p) => p.x >= c.lo && p.x < c.hi);
        const n = (v: string) => inClass.filter((p) => p.v === v).length;
        return { ...c, total: inClass.length, low: n("zu_guenstig"), ok: n("im_korridor"), high: n("zu_teuer") };
      }),
    [points]
  );

  const median = useMemo(() => {
    const ratios = points.map((p) => p.y / p.x).sort((a, b) => a - b);
    return ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  }, [points]);

  const bandPath = useMemo(() => {
    if (band.length < 2) return "";
    const upper = band.map((b) => `${lx(b.m).toFixed(1)},${ly(b.opt).toFixed(1)}`);
    const lower = [...band].reverse().map((b) => `${lx(b.m).toFixed(1)},${ly(b.min).toFixed(1)}`);
    return `M${upper.join("L")}L${lower.join("L")}Z`;
  }, [band]);

  if (points.length === 0) {
    return <div className="bd-over-empty">Für diese Auswahl gibt es keine Artikel mit Marktwert und Urteil.</div>;
  }

  return (
    <div className="bd-over-grid">
      <figure className="bd-fig">
        <figcaption>
          <b>Dein VK gegen den Marktwert</b>
          <span>{points.length.toLocaleString("de-DE")} Artikel · beide Achsen logarithmisch{median ? ` · Median: dein VK ist das ${median.toFixed(1).replace(".", ",")}-fache des Marktwerts` : ""}</span>
        </figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Streudiagramm: Marktwert gegen eigenen VK mit Zielspanne" className="bd-svg">
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={lx(t)} x2={lx(t)} y1={PAD.t} y2={H - PAD.b} className="bd-grid" />
              <line x1={PAD.l} x2={W - PAD.r} y1={ly(t)} y2={ly(t)} className="bd-grid" />
              <text x={lx(t)} y={H - PAD.b + 15} textAnchor="middle" className="bd-ax">
                {tick(t)}
              </text>
              <text x={PAD.l - 7} y={ly(t) + 3.5} textAnchor="end" className="bd-ax">
                {tick(t)}
              </text>
            </g>
          ))}
          {bandPath && <path d={bandPath} className="bd-bandfill" />}
          <line x1={lx(LO)} y1={ly(LO)} x2={lx(HI)} y2={ly(HI)} className="bd-diag" />
          {points.map((p) => (
            <circle key={p.id} cx={lx(p.x)} cy={ly(p.y)} r={2.6} fill={COLORS[p.v]} fillOpacity={0.72} />
          ))}
          <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 4} textAnchor="middle" className="bd-axt">
            Marktwert (Cardmarket, €)
          </text>
          <text transform={`translate(11 ${PAD.t + (H - PAD.t - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" className="bd-axt">
            Dein VK (€)
          </text>
        </svg>
        <div className="bd-fig-legend">
          <span><i style={{ background: COLORS.zu_guenstig }} /> zu günstig (unter dem Band)</span>
          <span><i style={{ background: COLORS.im_korridor }} /> im Rahmen</span>
          <span><i style={{ background: COLORS.zu_teuer }} /> zu teuer (über dem Band)</span>
          <span><i className="bd-lg-band" /> Zielspanne</span>
        </div>
      </figure>

      <figure className="bd-fig">
        <figcaption>
          <b>Wo liegen die Preisfehler?</b>
          <span>Urteil je Marktwert-Klasse der Karte</span>
        </figcaption>
        <div className="bd-bars">
          {classes.map((c) => (
            <div className="bd-bar-row" key={c.label} title={`${c.label}: ${c.low} zu günstig · ${c.ok} im Rahmen · ${c.high} zu teuer`}>
              <span className="bd-bar-label">{c.label}</span>
              <span className="bd-bar">
                {c.total > 0 && (
                  <>
                    <i style={{ width: `${(c.low / c.total) * 100}%`, background: COLORS.zu_guenstig }} />
                    <i style={{ width: `${(c.ok / c.total) * 100}%`, background: COLORS.im_korridor }} />
                    <i style={{ width: `${(c.high / c.total) * 100}%`, background: COLORS.zu_teuer }} />
                  </>
                )}
              </span>
              <span className="bd-bar-n">
                {c.total.toLocaleString("de-DE")}
                {c.total > 0 && <small>{Math.round((c.low / c.total) * 100)} % günstig</small>}
              </span>
            </div>
          ))}
        </div>
        <p className="bd-fig-note">
          Bis 5 € Marktwert gilt die Margenregel (25–33 % Deckungsbeitrag). Ab 40 € begrenzt der Marktdeckel die Spanne auf das
          1,5-fache des Marktwerts, weil teure Karten selten mehr bringen.
        </p>
      </figure>
    </div>
  );
}
