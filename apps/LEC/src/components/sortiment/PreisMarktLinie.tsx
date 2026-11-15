"use client";

import { useMemo } from "react";
import { buildPreisLinie, type LinienEingabe } from "@/lib/dashboard/preisLinie";

const W = 360;
const H = 110;
const PAD = { l: 34, r: 6, t: 8, b: 16 };
const eur0 = (v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Eigener VK, Marktwert und Verkaeufe der letzten 180 Tage auf einer Euro-Achse. Ohne Verlauf: nichts. */
export function PreisMarktLinie(props: Omit<LinienEingabe, "now">) {
  const l = useMemo(() => buildPreisLinie({ ...props, now: Date.now() }), [props]);
  if (!l.hasData) return null;
  const span = Math.max(l.max - l.min, l.max * 0.1, 0.5);
  const lo = Math.max(0, l.min - span * 0.15);
  const hi = l.max + span * 0.15;
  const x = (t: number) => PAD.l + ((t - l.from) / (l.to - l.from)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = (pts: { t: number; v: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <figure className="bd-pml">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Eigener VK, Marktwert und Verkäufe der letzten 180 Tage">
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="bd-pml-grid" />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="bd-pml-ax">{v.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 3} className="bd-pml-ax">vor 180 T</text>
        <text x={W - PAD.r} y={H - 3} textAnchor="end" className="bd-pml-ax">heute</text>
        {l.markt.length > 0 && <path d={path(l.markt)} className="bd-pml-mk" fill="none" />}
        {l.vk.length > 0 && <path d={path(l.vk)} className="bd-pml-vk" fill="none" />}
        {l.verkaeufe.map((s, i) => (
          <circle key={i} cx={x(s.t)} cy={y(s.v)} r={2.6} className="bd-pml-sale">
            <title>{`${new Date(s.t).toLocaleDateString("de-DE")}: ${s.qty}× ${eur0(s.v)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="bd-fig-note">
        <i className="bd-lg-me" /> dein VK <i className="bd-lg-mk" /> Marktwert (7-Tage-Schnitt) <i className="bd-pml-dot" /> Verkauf
      </figcaption>
    </figure>
  );
}
