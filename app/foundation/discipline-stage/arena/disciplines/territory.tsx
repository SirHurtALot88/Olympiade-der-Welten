// =====================================================================================
// territory (Battlefield) — Schlachtfeld · Front & Heerlager (Squarified Treemap, 32 Reiche)
//
// Feld-Primitive: Gebietseroberung als Kriegs-Schlachtfeld. Jedes Team hält einen Sektor
// (Fläche ∝ Punkte-Summe, Score = Wahrheit, monotone Konvergenz, 15-s-Morph). Der Sektor
// ist ein Heerlager: verkratertes Terrain + Rauch, ein Truppenschwarm (Anzahl ∝ Punkte)
// und das echte Team-Logo als Feldherren-Banner (Größe ∝ Punkte, Fallback = Kürzel).
// Benachbarte Reiche beschießen sich gegenseitig über die Front (Kreuzfeuer-Dauerfeuer +
// heftige Salven bei Punktgewinn); der Gewinner drückt via Morph die Grenze rüber.
// Führer-Reich in Gold ⚑ + 🏆, Top-3 Medaillen-Ringe, Beziehungsfarben, Hover/Pause friert.
// =====================================================================================

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";

const BASE = 60;
const POW = 1.3;
const GAP = 3;
// Morph-Dauer = Runden-Glide des Hosts (TRACK_ROUND_MS = 15s). Feld + Ladder + Morph laufen synchron.
const MORPH_MS = 15000;
const M = 26;
const NS = "http://www.w3.org/2000/svg";

// Hash für deterministisch Team-Hues / Truppen-Streuung
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function weightOf(score: number): number {
  return BASE + Math.pow(Math.max(0, score), POW);
}

function worstRatio(row: { a: number }[], sum: number, side: number): number {
  let mx = 0,
    mn = Infinity;
  for (let i = 0; i < row.length; i++) {
    if (row[i].a > mx) mx = row[i].a;
    if (row[i].a < mn) mn = row[i].a;
  }
  const s2 = sum * sum;
  const d2 = side * side;
  return Math.max((d2 * mx) / s2, s2 / (d2 * mn));
}

type Rect = { x: number; y: number; w: number; h: number };

function squarify(
  items: { code: string; a: number }[],
  x: number,
  y: number,
  w: number,
  h: number
): Record<string, Rect> {
  const rects: Record<string, Rect> = {};
  let start = 0;
  while (start < items.length) {
    const side = Math.min(w, h) || 1;
    let row = [items[start]];
    let sum = items[start].a;
    let end = start + 1;
    let cur = worstRatio(row, sum, side);
    while (end < items.length) {
      const cand = row.concat([items[end]]);
      const s2 = sum + items[end].a;
      const w2 = worstRatio(cand, s2, side);
      if (w2 > cur) break;
      row = cand;
      sum = s2;
      cur = w2;
      end++;
    }
    const thick = sum / side;
    if (w >= h) {
      let yy = y;
      row.forEach((it) => {
        const hh = it.a / thick;
        rects[it.code] = { x, y: yy, w: thick, h: hh };
        yy += hh;
      });
      x += thick;
      w -= thick;
    } else {
      let xx = x;
      row.forEach((it) => {
        const ww = it.a / thick;
        rects[it.code] = { x: xx, y, w: ww, h: thick };
        xx += ww;
      });
      y += thick;
      h -= thick;
    }
    start = end;
  }
  return rects;
}

type TerritoryState = {
  code: string;
  from: Rect;
  to: Rect;
  morphT: number;
};

// Smooth Easing (Modul-Ebene, damit Render + FX-Schleife dieselbe Interpolation nutzen).
const smooth = (t: number): number => t * t * (3 - 2 * t);

export default function TerritoryField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    rt,
    sorted,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);
  // Benchmark: Hover/Pause friert Gebiets-Morph UND Schlacht-FX ein (wie überall).
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // Farbpalette (aus dem Mockup) — bestehende Konstanten, KEINE neuen Hex-Literale (Lint-Ratchet).
  const COLORS = {
    mine: "#4a9dff",
    ally: "#46c98a",
    rival: "#f0503c",
    lead: "#f6c750",
    neutral: "rgba(190,205,160,.30)",
  };

  const IX = M;
  const IY = M;
  const IW = W - 2 * M;
  const IH = H - 2 * M;

  const [territories, setTerritories] = useState<TerritoryState[]>([]);
  const stateRef = useRef<Map<string, TerritoryState>>(new Map());
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  // Nachbarschafts-Topologie (Code-Paare mit gemeinsamer Front) — für das Kreuzfeuer.
  const adjRef = useRef<[string, string][]>([]);
  const fxRef = useRef<SVGGElement | null>(null);

  // Layout berechnen
  const calcLayout = (): Record<string, Rect> => {
    const items: { code: string; w: number; a: number }[] = rt.map((t) => ({
      code: t.code,
      w: weightOf(t.displayScore || 0),
      a: 0,
    }));
    items.sort((a, b) => b.w - a.w || (a.code < b.code ? -1 : 1));
    const tot = items.reduce((s, i) => s + i.w, 0);
    items.forEach((i) => {
      i.a = (i.w / tot) * IW * IH;
    });
    return squarify(items, IX, IY, IW, IH);
  };

  // Re-Layout-Trigger: `rt` ist eine stabile, in-place mutierte Referenz — deshalb hängt die
  // Runden-Erkennung an einer Score-Signatur, sonst baut sich die Treemap nie neu.
  const scoreSig = rt.map((t) => `${t.code}:${Math.round(t.displayScore || 0)}`).join("|");

  // Initialisierung + Layout-Morph pro Runde + Nachbarschafts-Topologie neu bestimmen.
  useEffect(() => {
    const layout = calcLayout();
    const newStates: TerritoryState[] = [];
    rt.forEach((t) => {
      const r = layout[t.code];
      if (!r) return;
      let state = stateRef.current.get(t.code);
      if (!state) {
        state = { code: t.code, from: { ...r }, to: { ...r }, morphT: 1 };
        stateRef.current.set(t.code, state);
      } else {
        state.from = state.to;
        state.to = { ...r };
        state.morphT = 0;
      }
      newStates.push(state);
    });
    setTerritories(newStates);

    // Nachbarschaft aus den Ziel-Rechtecken: zwei Reiche grenzen an, wenn sie eine Kante teilen.
    const codes = Object.keys(layout);
    const eps = GAP + 2;
    const pairs: [string, string][] = [];
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const a = layout[codes[i]];
        const b = layout[codes[j]];
        const yOv = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const xOv = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const vAdj = (Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps) && yOv > 8;
        const hAdj = (Math.abs(a.y + a.h - b.y) < eps || Math.abs(b.y + b.h - a.y) < eps) && xOv > 8;
        if (vAdj || hAdj) pairs.push([codes[i], codes[j]]);
      }
    }
    adjRef.current = pairs;

    // rAF-Schleife für Morphs (dt-basiert; friert bei Hover/Pause).
    let raf = 0;
    let last = performance.now();
    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;
      const frozen = hoverRef.current != null || pausedRef.current;
      let changed = false;
      if (!frozen) {
        stateRef.current.forEach((state) => {
          if (state.morphT < 1 && !reducedRef.current) {
            state.morphT = Math.min(1, state.morphT + dt / MORPH_MS);
            changed = true;
          }
        });
      }
      if (changed) setTerritories(Array.from(stateRef.current.values()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreSig]);

  // Schlacht-FX-Schleife (imperativ, unabhängig vom React-Render): Kreuzfeuer zwischen
  // benachbarten Reichen + Einschlag-Explosionen. Liest die LIVE-interpolierten Rechtecke
  // aus stateRef, damit die Salven den morphenden Sektoren folgen. Vollgas: Dauerfeuer.
  useEffect(() => {
    const liveRect = (code: string): Rect | null => {
      const st = stateRef.current.get(code);
      if (!st) return null;
      const s = smooth(st.morphT);
      const f = st.from;
      const to = st.to;
      return { x: f.x + (to.x - f.x) * s, y: f.y + (to.y - f.y) * s, w: f.w + (to.w - f.w) * s, h: f.h + (to.h - f.h) * s };
    };
    const centerOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

    type Proj = { el: SVGLineElement; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; color: string };
    const projs: Proj[] = [];
    const prevScore = new Map<string, number>();

    const explode = (x: number, y: number, color: string) => {
      const g = fxRef.current;
      if (!g) return;
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", String(x));
      c.setAttribute("cy", String(y));
      c.setAttribute("r", "2");
      c.setAttribute("fill", "none");
      c.setAttribute("stroke", color);
      c.setAttribute("stroke-width", "2");
      const ar = document.createElementNS(NS, "animate");
      ar.setAttribute("attributeName", "r");
      ar.setAttribute("values", "2;15;2");
      ar.setAttribute("dur", "0.5s");
      const ao = document.createElementNS(NS, "animate");
      ao.setAttribute("attributeName", "opacity");
      ao.setAttribute("values", "1;0.4;0");
      ao.setAttribute("dur", "0.5s");
      c.appendChild(ar);
      c.appendChild(ao);
      g.appendChild(c);
      window.setTimeout(() => c.remove(), 560);
    };

    const tracer = (fromX: number, fromY: number, toX: number, toY: number, color: string, dur: number) => {
      const g = fxRef.current;
      if (!g || projs.length > 64) return;
      const el = document.createElementNS(NS, "line");
      el.setAttribute("stroke", color);
      el.setAttribute("stroke-width", "2.2");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("opacity", "0.9");
      g.appendChild(el);
      projs.push({ el, x0: fromX, y0: fromY, x1: toX, y1: toY, t: 0, dur, color });
    };

    // Kreuzfeuer über eine Front: BEIDE Seiten schießen zum Grenz-Mittelpunkt.
    const crossfire = (codeA: string, codeB: string, heavy: boolean) => {
      const ra = liveRect(codeA);
      const rb = liveRect(codeB);
      if (!ra || !rb) return;
      const ca = centerOf(ra);
      const cb = centerOf(rb);
      const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
      const jit = () => (Math.random() - 0.5) * (heavy ? 22 : 12);
      const salvos = heavy ? 3 : 1;
      for (let k = 0; k < salvos; k++) {
        const m1 = { x: mid.x + jit(), y: mid.y + jit() };
        const m2 = { x: mid.x + jit(), y: mid.y + jit() };
        tracer(ca.x, ca.y, m1.x, m1.y, "var(--nl-warn)", heavy ? 260 : 340);
        tracer(cb.x, cb.y, m2.x, m2.y, "var(--nl-risk)", heavy ? 260 : 340);
      }
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const pairs = adjRef.current;

      if (!frozen && !reduce) {
        // Reveal-Salven: jedes Team mit Punktgewinn eröffnet heftiges Feuer an all seinen Fronten.
        for (const t of rtRef.current) {
          const prev = prevScore.get(t.code);
          prevScore.set(t.code, t.displayScore);
          if (prev == null) continue;
          if (t.displayScore - prev > 0.4) {
            for (const [a, b] of pairs) {
              if (a === t.code || b === t.code) crossfire(a, b, true);
            }
          }
        }

        // Vollgas-Dauerfeuer: laufend zufällige Fronten befeuern.
        acc += dt;
        while (acc > 110 && pairs.length > 0) {
          acc -= 110;
          const p = pairs[Math.floor(Math.random() * pairs.length)];
          if (p) crossfire(p[0], p[1], false);
        }
      }

      // Projektile integrieren + Einschlag.
      for (let j = projs.length - 1; j >= 0; j -= 1) {
        const b = projs[j]!;
        if (!frozen) b.t += dt / b.dur;
        const u = b.t < 1 ? b.t : 1;
        const bx = b.x0 + (b.x1 - b.x0) * u;
        const by = b.y0 + (b.y1 - b.y0) * u;
        b.el.setAttribute("x1", String(bx - (b.x1 - b.x0) * 0.06));
        b.el.setAttribute("y1", String(by - (b.y1 - b.y0) * 0.06));
        b.el.setAttribute("x2", String(bx));
        b.el.setAttribute("y2", String(by));
        if (b.t >= 1) {
          if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
          projs.splice(j, 1);
          explode(b.x1, b.y1, b.color);
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const b of projs) if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
      if (fxRef.current) fxRef.current.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxScore = Math.max(1, ...rt.map((t) => t.displayScore || 0));

  return (
    <>
      <defs>
        {env ? (
          <>
            <linearGradient id="envSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={env.sky[0]} />
              <stop offset="100%" stopColor={env.sky[1]} />
            </linearGradient>
          </>
        ) : null}
        {/* Kreis-Clip für runde Logos (objectBoundingBox → passt bei jeder Banner-Größe). */}
        <clipPath id="bfCircleClip" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
        {/* Rauch-Gradient (Vollgas-Schlachtfeld). */}
        <radialGradient id="bfSmoke" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(60,66,48,.55)" />
          <stop offset="100%" stopColor="rgba(60,66,48,0)" />
        </radialGradient>
        {/* Territorium-Terrain-Gradienten (team-getönt, kriegsverwüstet). */}
        {rt.map((t) => {
          const hue = Math.floor(hash(t.code + "hue") * 360);
          return (
            <linearGradient key={`bg-${t.code}`} id={`bg-${t.code}`} x1="0" y1="0" x2="160" y2="160">
              <stop offset="0%" stopColor={`hsl(${hue},22%,17%)`} />
              <stop offset="100%" stopColor={`hsl(${hue},26%,10%)`} />
            </linearGradient>
          );
        })}
        <style>{`
          @keyframes bfBob { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-1.4px) } }
        `}</style>
      </defs>

      {/* Hintergrund + Kartenrahmen */}
      {env ? (
        <>
          <rect x={0} y={0} width={W} height={H} fill="url(#envSky)" />
          <rect x={IX - 2} y={IY - 2} width={IW + 4} height={IH + 4} fill="#10130b" stroke="#2c3018" strokeWidth={1.5} />
        </>
      ) : (
        <>
          <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" />
          <rect x={IX - 2} y={IY - 2} width={IW + 4} height={IH + 4} fill="#10130b" stroke="#2c3018" strokeWidth={1.5} />
        </>
      )}

      {/* Planquadrate A–H / 1–6 + Titel + Kompass */}
      <g>
        {Array.from({ length: 8 }).map((_, c) => {
          const x = IX + (c + 0.5) * (IW / 8);
          const col = "ABCDEFGH"[c];
          return (
            <g key={`col-${c}`}>
              <text x={x} y={17} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="#6a745c">
                {col}
              </text>
              <text x={x} y={H - 9} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="#6a745c">
                {col}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 6 }).map((_, r) => {
          const y = IY + (r + 0.5) * (IH / 6) + 3;
          return (
            <g key={`row-${r}`}>
              <text x={13} y={y} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="#6a745c">
                {r + 1}
              </text>
              <text x={W - 13} y={y} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="#6a745c">
                {r + 1}
              </text>
            </g>
          );
        })}
        <text x={IX + 2} y={17} fontFamily="ui-monospace, Menlo, monospace" fontSize={8} fontWeight={800} letterSpacing={3} fill="#c9a44a" opacity={0.75}>
          SCHLACHTFELD · GEBIETSEROBERUNG
        </text>
        <text x={W - M - 4} y={17} textAnchor="end" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="#98a488">
          N ▲
        </text>
      </g>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={env ? env.line : skinAccent} opacity={env ? 0.75 : 0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Reiche als Heerlager (Terrain + Truppen + Logo-Banner) */}
      {territories.map((terr) => {
        const t = rt.find((x) => x.code === terr.code);
        if (!t) return null;

        const s = smooth(terr.morphT);
        const x = terr.from.x + (terr.to.x - terr.from.x) * s;
        const y = terr.from.y + (terr.to.y - terr.from.y) * s;
        const w = terr.from.w + (terr.to.w - terr.from.w) * s;
        const h = terr.from.h + (terr.to.h - terr.from.h) * s;

        const rw = Math.max(4, w - GAP);
        const rh = Math.max(4, h - GAP);
        const rx = x + GAP / 2;
        const ry = y + GAP / 2;
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;

        const hue = Math.floor(hash(t.code + "hue") * 360);
        const score = t.displayScore || 0;
        const isLead = sorted[0]?.code === t.code;
        const idx = sorted.findIndex((x) => x.code === t.code);
        const inTrio = trioSet.has(t.idx);

        // Banner-Größe ∝ Punkte (weiter Bereich), aber in den Sektor eingepasst.
        const bannerR = Math.min(Math.min(rw, rh) * 0.42, 8 + (score / maxScore) * 37);
        // Truppenzahl ∝ Punkte (Vollgas), in kleinen Sektoren gedeckelt.
        const troops = Math.min(rw > 40 && rh > 40 ? 16 : 5, Math.round(3 + (score / maxScore) * 13));

        const relBorder =
          t.rel === "mine" ? COLORS.mine : t.rel === "ally" ? COLORS.ally : t.rel === "rival" ? COLORS.rival : COLORS.neutral;
        const relStroke = t.rel ? 1.5 : 1;
        const medalStroke = idx === 0 ? COLORS.lead : idx === 1 ? "var(--nl-silver)" : idx === 2 ? "var(--nl-bronze)" : null;

        return (
          <g key={t.code} data-token-code={t.code}>
            {/* Terrain */}
            <rect x={rx} y={ry} width={rw} height={rh} fill={`url(#bg-${t.code})`} stroke={inTrio ? "var(--nl-warn)" : isLead ? COLORS.lead : relBorder} strokeWidth={inTrio ? 2.5 : isLead ? 2 : relStroke} rx={4} />

            {/* Krater (Vollgas: mehr bei stärkeren Reichen) */}
            {rw > 34 && rh > 30
              ? Array.from({ length: Math.min(6, Math.round(1 + score / 220)) }).map((_, k) => {
                  const kx = rx + 8 + hash(t.code + "kx" + k) * (rw - 16);
                  const ky = ry + 8 + hash(t.code + "ky" + k) * (rh - 16);
                  const kr = 2.5 + hash(t.code + "kr" + k) * 4;
                  return <circle key={`cr-${k}`} cx={kx} cy={ky} r={kr} fill="rgba(0,0,0,.32)" stroke="rgba(40,44,30,.6)" strokeWidth={1} pointerEvents="none" />;
                })
              : null}

            {/* Rauchschwade */}
            {rw > 44 && rh > 40 ? (
              <circle cx={rx + rw * 0.7} cy={ry + rh * 0.3} r={Math.min(rw, rh) * 0.26} fill="url(#bfSmoke)" pointerEvents="none" opacity={0.5}>
                {!reducedMotion ? <animate attributeName="opacity" values="0.3;0.6;0.3" dur={`${(3 + hash(t.code) * 2).toFixed(1)}s`} repeatCount="indefinite" /> : null}
              </circle>
            ) : null}

            {/* Truppenschwarm (Anzahl ∝ Punkte) — Chevrons ums Banner, sanftes Marschier-Wippen */}
            {Array.from({ length: troops }).map((_, u) => {
              const a = hash(t.code + "ua" + u) * 6.283;
              const rr = 0.35 + hash(t.code + "ur" + u) * 0.62;
              const ux = cx + Math.cos(a) * (rw * 0.42) * rr;
              const uy = cy + Math.sin(a) * (rh * 0.42) * rr;
              if (ux < rx + 5 || ux > rx + rw - 5 || uy < ry + 5 || uy > ry + rh - 5) return null;
              return (
                <text
                  key={`u-${u}`}
                  x={ux.toFixed(1)}
                  y={uy.toFixed(1)}
                  textAnchor="middle"
                  fontSize={6.5}
                  fill={isLead ? "rgba(246,199,80,.85)" : `hsl(${hue},55%,66%)`}
                  pointerEvents="none"
                  style={reducedMotion ? undefined : { animation: `bfBob ${(1.5 + hash(t.code + "ud" + u) * 1.3).toFixed(2)}s ease-in-out infinite` }}
                >
                  ▲
                </text>
              );
            })}

            {/* Führer-Reich Gold (⚑) */}
            {isLead ? (
              <text x={rx + rw - 5} y={ry + 10} fontSize={11} fill={COLORS.lead} pointerEvents="none" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.7))" }}>
                ⚑
              </text>
            ) : null}

            {/* Banner (echtes Team-Logo, Größe ∝ Punkte; Fallback = Kürzel-Scheibe) */}
            <g transform={`translate(${cx} ${cy})`}>
              {/* Pol */}
              <line x1={0} y1={bannerR * 0.5} x2={0} y2={-(bannerR + 6)} stroke="#3a3320" strokeWidth={Math.max(1.4, bannerR * 0.12)} />
              <circle r={bannerR} fill={`hsl(${hue},42%,32%)`} stroke={isLead ? COLORS.lead : relBorder} strokeWidth={isLead ? 3 : 2} style={{ filter: "drop-shadow(0 2px 4px rgba(5,8,4,.55))" }} />
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-bannerR} y={-bannerR} width={bannerR * 2} height={bannerR * 2} clipPath="url(#bfCircleClip)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text y={bannerR * 0.34} textAnchor="middle" fontSize={Math.max(9, bannerR * 0.78)} fontFamily="ui-monospace, Menlo, monospace" fontWeight={800} letterSpacing="-0.04em" fill="#eef3e6" pointerEvents="none">
                  {t.code}
                </text>
              )}
              {/* Trio-Puls / Medaillen-Ring */}
              {inTrio ? <circle r={bannerR + 3} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 0.85s ease-in-out infinite" }} /> : medalStroke ? <circle r={bannerR + 3} fill="none" stroke={medalStroke} strokeWidth={2} opacity={0.6} /> : null}
              {/* Führer-Glow + Krone */}
              {isLead ? (
                <>
                  <circle r={bannerR + 6} fill="none" stroke={COLORS.lead} strokeWidth={2}>
                    {!reducedMotion ? <animate attributeName="opacity" values="0.25;0.8;0.25" dur="1.3s" repeatCount="indefinite" /> : null}
                  </circle>
                  <text y={-(bannerR + 10)} textAnchor="middle" fontSize={13} pointerEvents="none">
                    🏆
                  </text>
                </>
              ) : null}
            </g>

            {/* Punkte-Text (nur bei großen Sektoren) */}
            {rw > 66 && rh > 60 ? (
              <text x={rx + rw - 6} y={ry + rh - 7} textAnchor="end" fontSize={9} fontFamily="ui-monospace, Menlo, monospace" fontWeight={800} fill="rgba(238,243,230,.55)" pointerEvents="none" style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(score)} Pkt
              </text>
            ) : null}

            {/* Hover-Area */}
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill="transparent"
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            />
          </g>
        );
      })}

      {/* Schlacht-FX-Layer (Kreuzfeuer-Salven + Explosionen) — imperativ befüllt, ganz oben. */}
      <g ref={fxRef} pointerEvents="none" />
    </>
  );
}
