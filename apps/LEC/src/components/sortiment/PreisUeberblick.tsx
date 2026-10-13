"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { boardVk, cleanTitle } from "@/lib/dashboard/board";
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
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;
const tick = (v: number) => (v < 1 ? formatEuroCents(v) : formatEuro(v));

/** Sichtfenster in Log-Koordinaten (ln €). */
interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const FULL: View = { x0: Math.log(LO), x1: Math.log(HI), y0: Math.log(LO), y1: Math.log(HI) };

/** 1-2-5-Teilung innerhalb des Sichtfensters. */
function ticksFor(a: number, b: number): number[] {
  const lo = Math.exp(a);
  const hi = Math.exp(b);
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  return out.length > 9 ? out.filter((_, i) => i % 2 === 0) : out;
}

const CLASSES: { label: string; lo: number; hi: number }[] = [
  { label: "bis 2 €", lo: 0, hi: 2 },
  { label: "2–5 €", lo: 2, hi: 5 },
  { label: "5–20 €", lo: 5, hi: 20 },
  { label: "20–50 €", lo: 20, hi: 50 },
  { label: "ab 50 €", lo: 50, hi: Infinity },
];

export interface ClassPick {
  lo: number;
  hi: number;
  label: string;
  verdict: "zu_guenstig" | "im_korridor" | "zu_teuer";
}

interface Props {
  rows: SortimentRow[];
  band: BandPoint[];
  /** Klick auf einen Punkt: Artikel oeffnen. */
  onOpen: (articleId: string) => void;
  /** Klick auf einen Balkenabschnitt: Liste auf Klasse + Urteil eingrenzen. */
  onPick: (pick: ClassPick) => void;
}

export function PreisUeberblick({ rows, band, onOpen, onPick }: Props) {
  const points = useMemo(
    () =>
      rows
        .filter((r) => r.market?.rated && r.market.value !== null && boardVk(r) > 0)
        .map((r) => ({
          id: r.articleId,
          name: cleanTitle(r.nameRaw).name || r.nameRaw,
          code: r.setCode,
          x: r.market!.value as number,
          y: boardVk(r),
          v: r.market!.status,
        })),
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

  const [view, setView] = useState<View>(FULL);
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const lx = (v: number) => PAD.l + ((Math.log(v) - view.x0) / (view.x1 - view.x0)) * PW;
  const ly = (v: number) => H - PAD.b - ((Math.log(v) - view.y0) / (view.y1 - view.y0)) * PH;

  /** Mausposition in SVG-Koordinaten. */
  function svgPoint(e: { clientX: number; clientY: number }) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, w: r.width, h: r.height, left: r.left, top: r.top };
  }

  function zoomAt(factor: number, sx: number, sy: number) {
    setView((v) => {
      const fx = Math.min(1, Math.max(0, (sx - PAD.l) / PW));
      const fy = Math.min(1, Math.max(0, (H - PAD.b - sy) / PH));
      const wx = (v.x1 - v.x0) * factor;
      const wy = (v.y1 - v.y0) * factor;
      if (wx > FULL.x1 - FULL.x0 || wy > FULL.y1 - FULL.y0) return FULL;
      if (wx < 0.05 || wy < 0.05) return v; // nicht weiter als etwa 5 % Spreizung
      const cx = v.x0 + fx * (v.x1 - v.x0);
      const cy = v.y0 + fy * (v.y1 - v.y0);
      return { x0: cx - fx * wx, x1: cx + (1 - fx) * wx, y0: cy - fy * wy, y1: cy + (1 - fy) * wy };
    });
  }

  // Mausrad: nicht passiv registrieren, damit die Seite nicht mitscrollt.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 0.78 : 1 / 0.78, ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function nearest(sx: number, sy: number): number {
    let best = -1;
    let bestD = 11 * 11;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = lx(p.x) - sx;
      const dy = ly(p.y) - sy;
      const d = dx * dx + dy * dy;
      if (d < bestD && lx(p.x) >= PAD.l && lx(p.x) <= W - PAD.r && ly(p.y) >= PAD.t && ly(p.y) <= H - PAD.b) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  const bandPath = useMemo(() => {
    if (band.length < 2) return "";
    const px = (v: number) => PAD.l + ((Math.log(v) - view.x0) / (view.x1 - view.x0)) * PW;
    const py = (v: number) => H - PAD.b - ((Math.log(v) - view.y0) / (view.y1 - view.y0)) * PH;
    const upper = band.map((b) => `${px(b.m).toFixed(1)},${py(b.opt).toFixed(1)}`);
    const lower = [...band].reverse().map((b) => `${px(b.m).toFixed(1)},${py(b.min).toFixed(1)}`);
    return `M${upper.join("L")}L${lower.join("L")}Z`;
  }, [band, view]);

  if (points.length === 0) {
    return <div className="bd-over-empty">Für diese Auswahl gibt es keine Artikel mit Marktwert und Urteil.</div>;
  }

  const zoomed = view !== FULL;
  const hp = hover ? points[hover.i] : null;

  return (
    <div className="bd-over-grid">
      <figure className="bd-fig">
        <figcaption>
          <b>Dein VK gegen den Marktwert</b>
          <span>{points.length.toLocaleString("de-DE")} Artikel · beide Achsen logarithmisch{median ? ` · Median: dein VK ist das ${median.toFixed(1).replace(".", ",")}-fache des Marktwerts` : ""}</span>
        </figcaption>
        <div className="bd-fig-tools">
          <button type="button" onClick={() => zoomAt(0.6, PAD.l + PW / 2, PAD.t + PH / 2)} aria-label="Hineinzoomen">＋</button>
          <button type="button" onClick={() => zoomAt(1 / 0.6, PAD.l + PW / 2, PAD.t + PH / 2)} aria-label="Herauszoomen">－</button>
          <button type="button" onClick={() => setView(FULL)} disabled={!zoomed}>Alles zeigen</button>
          <span>Mausrad = zoomen · ziehen = verschieben · Punkt anklicken = Artikel öffnen</span>
        </div>
        <div className="bd-plot">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Streudiagramm: Marktwert gegen eigenen VK mit Zielspanne"
            className={`bd-svg${dragging ? " is-drag" : ""}${hover && !dragging ? " is-hit" : ""}`}
            onPointerDown={(e) => {
              const pt = svgPoint(e);
              drag.current = { x: pt.x, y: pt.y, view: viewRef.current, moved: false };
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const pt = svgPoint(e);
              const d = drag.current;
              if (d) {
                if (!d.moved && Math.hypot(pt.x - d.x, pt.y - d.y) > 4) {
                  d.moved = true;
                  setDragging(true);
                }
                if (d.moved) {
                  const dx = ((pt.x - d.x) / PW) * (d.view.x1 - d.view.x0);
                  const dy = ((pt.y - d.y) / PH) * (d.view.y1 - d.view.y0);
                  setHover(null);
                  setView({ x0: d.view.x0 - dx, x1: d.view.x1 - dx, y0: d.view.y0 + dy, y1: d.view.y1 + dy });
                  return;
                }
              }
              const i = nearest(pt.x, pt.y);
              setHover(i >= 0 ? { i, px: (pt.x / W) * pt.w, py: (pt.y / H) * pt.h } : null);
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              setDragging(false);
              if (d && !d.moved) {
                const pt = svgPoint(e);
                const i = nearest(pt.x, pt.y);
                if (i >= 0) onOpen(points[i].id);
              }
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <clipPath id="bd-plotclip">
                <rect x={PAD.l} y={PAD.t} width={PW} height={PH} />
              </clipPath>
            </defs>
            {ticksFor(view.x0, view.x1).map((t) => (
              <g key={`x${t}`}>
                <line x1={lx(t)} x2={lx(t)} y1={PAD.t} y2={H - PAD.b} className="bd-grid" />
                <text x={lx(t)} y={H - PAD.b + 15} textAnchor="middle" className="bd-ax">
                  {tick(t)}
                </text>
              </g>
            ))}
            {ticksFor(view.y0, view.y1).map((t) => (
              <g key={`y${t}`}>
                <line x1={PAD.l} x2={W - PAD.r} y1={ly(t)} y2={ly(t)} className="bd-grid" />
                <text x={PAD.l - 7} y={ly(t) + 3.5} textAnchor="end" className="bd-ax">
                  {tick(t)}
                </text>
              </g>
            ))}
            <g clipPath="url(#bd-plotclip)">
              {bandPath && <path d={bandPath} className="bd-bandfill" />}
              <line x1={lx(LO)} y1={ly(LO)} x2={lx(HI)} y2={ly(HI)} className="bd-diag" />
              {points.map((p) => (
                <circle key={p.id} cx={lx(p.x)} cy={ly(p.y)} r={zoomed ? 3.6 : 2.6} fill={COLORS[p.v]} fillOpacity={0.72} />
              ))}
              {hp && <circle cx={lx(hp.x)} cy={ly(hp.y)} r={6} fill="none" stroke="var(--text, #fff)" strokeWidth={1.5} />}
            </g>
            <text x={PAD.l + PW / 2} y={H - 4} textAnchor="middle" className="bd-axt">
              Marktwert (Cardmarket, €)
            </text>
            <text transform={`translate(11 ${PAD.t + PH / 2}) rotate(-90)`} textAnchor="middle" className="bd-axt">
              Dein VK (€)
            </text>
          </svg>
          {hp && hover && (
            <div className="bd-tip" style={{ left: Math.min(hover.px + 14, 260), top: Math.max(4, hover.py - 52) }}>
              <b>{hp.name}</b>
              {hp.code && <span>{hp.code} · </span>}
              dein VK {formatEuroCents(hp.y)} € · Markt {formatEuroCents(hp.x)} €
            </div>
          )}
        </div>
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
          <span>Urteil je Marktwert-Klasse · Abschnitt anklicken = Liste darauf eingrenzen</span>
        </figcaption>
        <div className="bd-bars">
          {classes.map((c) => (
            <div className="bd-bar-row" key={c.label}>
              <span className="bd-bar-label">{c.label}</span>
              <span className="bd-bar">
                {c.total > 0 &&
                  (
                    [
                      ["zu_guenstig", c.low, "zu günstig"],
                      ["im_korridor", c.ok, "im Rahmen"],
                      ["zu_teuer", c.high, "zu teuer"],
                    ] as const
                  ).map(([v, n, name]) =>
                    n > 0 ? (
                      <button
                        type="button"
                        key={v}
                        className="bd-bar-seg"
                        style={{ width: `${(n / c.total) * 100}%`, background: COLORS[v] }}
                        title={`${c.label}: ${n} ${name} — anklicken zum Eingrenzen`}
                        onClick={() => onPick({ lo: c.lo, hi: c.hi, label: c.label, verdict: v })}
                      />
                    ) : null
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
