// =====================================================================================
// territory (Battlefield) — War-Room-Frontkarte · Squarified Treemap (32 Territorien)
//
// Feld-Primitive: Gebietseroberung als interaktive Kriegskarte. Jedes Territorium ist
// ein rechteckiges Gebiet mit Team-Farbe + Wappen. Die gehaltene Fläche ist proportional
// zur Punkte-Summe (Score = Wahrheit, monotone Konvergenz). Simultane 5-s-Morphs,
// Durchbruch-Flammen-FX, Planquadrate/Kompass im Kartenrahmen, Führer-Reich in Gold ⚑.
// =====================================================================================

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";

const BASE = 60;
const POW = 1.3;
const GAP = 3;
// Morph-Dauer = Runden-Glide des Hosts (TRACK_ROUND_MS = 15s). Vorher 5s → die Karte zeigte
// das Runden-Endbild nach 5s, während Feld/Ladder noch 10s weiter rampten (Sync-Bruch).
const MORPH_MS = 15000;
const M = 26;

// Hash für deterministisch Team-Hues
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

function squarify(
  items: { code: string; a: number }[],
  x: number,
  y: number,
  w: number,
  h: number
): Record<string, { x: number; y: number; w: number; h: number }> {
  const rects: Record<string, { x: number; y: number; w: number; h: number }> =
    {};
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
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number; w: number; h: number };
  morphT: number;
};

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
  // Benchmark: Hover/Pause friert den Gebiets-Morph ein (wie Feld + Rangliste überall).
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;

  // Farbpalette (aus dem Mockup)
  const COLORS = {
    mine: "#4a9dff",
    ally: "#46c98a",
    rival: "#f0503c",
    lead: "#f6c750",
    neutral: "rgba(190,205,160,.18)",
  };

  const IX = M;
  const IY = M;
  const IW = W - 2 * M;
  const IH = H - 2 * M;

  const [territories, setTerritories] = useState<TerritoryState[]>([]);
  const stateRef = useRef<Map<string, TerritoryState>>(new Map());
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;

  // Layout berechnen
  const calcLayout = () => {
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

  // Re-Layout-Trigger: `rt` ist eine stabile, in-place mutierte Referenz (Identität ändert
  // sich nie) — deshalb MUSS die Runden-Erkennung an einer Score-Signatur hängen, sonst
  // baut sich die Treemap nach dem Mount NIE neu (Flächen bleiben eingefroren).
  const scoreSig = rt.map((t) => `${t.code}:${Math.round(t.displayScore || 0)}`).join("|");

  // Initialisierung + Layout-Morph pro Runde.
  useEffect(() => {
    const layout = calcLayout();
    const newStates: TerritoryState[] = [];
    rt.forEach((t) => {
      const r = layout[t.code];
      if (!r) return;
      let state = stateRef.current.get(t.code);
      if (!state) {
        state = {
          code: t.code,
          from: { x: r.x, y: r.y, w: r.w, h: r.h },
          to: { x: r.x, y: r.y, w: r.w, h: r.h },
          morphT: 1,
        };
        stateRef.current.set(t.code, state);
      } else {
        // Neue Runde: Morph von aktuell zu neu
        state.from = state.to;
        state.to = { x: r.x, y: r.y, w: r.w, h: r.h };
        state.morphT = 0;
      }
      newStates.push(state);
    });
    setTerritories(newStates);

    // rAF-Schleife für Morphs (dt-basiert → framerate-unabhängig; friert bei Hover/Pause).
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
      if (changed) {
        setTerritories(Array.from(stateRef.current.values()));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreSig]);

  // Smooth Easing
  const smooth = (t: number) => t * t * (3 - 2 * t);

  return (
    <>
      <defs>
        {env ? (
          <>
            <linearGradient id="envSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={env.sky[0]} />
              <stop offset="100%" stopColor={env.sky[1]} />
            </linearGradient>
            <linearGradient id="envSurface" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={env.surface[0]} />
              <stop offset="55%" stopColor={env.surface[1]} />
              <stop offset="100%" stopColor={env.surface[2]} />
            </linearGradient>
          </>
        ) : null}
        {/* Territorium-Gradienten */}
        {rt.map((t) => {
          const hue = Math.floor(hash(t.code + "hue") * 360);
          return (
            <linearGradient key={`bg-${t.code}`} id={`bg-${t.code}`} x1="0" y1="0" x2="160" y2="160">
              <stop offset="0%" stopColor={`hsl(${hue},24%,19%)`} />
              <stop offset="100%" stopColor={`hsl(${hue},30%,12%)`} />
            </linearGradient>
          );
        })}
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

      {/* Planquadrate A–H / 1–6 */}
      <g>
        {Array.from({ length: 8 }).map((_, c) => {
          const x = IX + (c + 0.5) * (IW / 8);
          const col = "ABCDEFGH"[c];
          return (
            <g key={`col-${c}`}>
              <text
                x={x}
                y={17}
                textAnchor="middle"
                fontFamily="ui-monospace, Menlo, monospace"
                fontSize={9}
                fontWeight={800}
                fill="#6a745c"
              >
                {col}
              </text>
              <text
                x={x}
                y={H - 9}
                textAnchor="middle"
                fontFamily="ui-monospace, Menlo, monospace"
                fontSize={9}
                fontWeight={800}
                fill="#6a745c"
              >
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
        {/* Titel + Kompass */}
        <text x={IX + 2} y={17} fontFamily="ui-monospace, Menlo, monospace" fontSize={8} fontWeight={800} letterSpacing={3} fill="#c9a44a" opacity={0.75}>
          GEBIETSEROBERUNG
        </text>
        <text x={W - M - 4} y={17} textAnchor="end" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="#98a488">
          N ▲
        </text>
      </g>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text
          x={18}
          y={30}
          fontSize={19}
          fontWeight={800}
          letterSpacing="0.04em"
          fill={env ? env.line : skinAccent}
          opacity={env ? 0.75 : 0.95}
          style={{ textTransform: "uppercase" }}
        >
          {disciplineName}
        </text>
      ) : null}

      {/* Territorien als SVG-Gruppen (Rechtecke + Wappen) */}
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

        const hue = Math.floor(hash(t.code + "hue") * 360);
        const bgColor = `url(#bg-${t.code})`;
        const isLead = sorted[0]?.code === t.code;
        const idx = sorted.findIndex((x) => x.code === t.code);

        // Crest-Größe
        const cs = Math.max(21, Math.min(40, Math.min(rw, rh) * 0.3));
        const csTextSize = Math.round(cs * 0.3);

        // Beziehungs-Farbe
        const relBorder =
          t.rel === "mine"
            ? COLORS.mine
            : t.rel === "ally"
              ? COLORS.ally
              : t.rel === "rival"
                ? COLORS.rival
                : COLORS.neutral;
        const relStroke = t.rel ? 1.5 : 1;

        const inTrio = trioSet.has(t.idx);
        return (
          <g key={t.code} data-token-code={t.code}>
            {/* Territorium-Rechteck */}
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill={bgColor}
              stroke={inTrio ? "var(--nl-warn)" : relBorder}
              strokeWidth={inTrio ? 2.5 : relStroke}
              rx={4}
            />
            {/* Highlight-Trio (Aufholjagd): goldener Puls-Rahmen ums Gebiet. */}
            {inTrio ? (
              <rect x={rx} y={ry} width={rw} height={rh} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} rx={4} opacity={0.95} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 0.85s ease-in-out infinite" }} />
            ) : null}

            {/* Führer-Reich Gold (⚑) */}
            {isLead && (
              <>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill="none"
                  stroke={COLORS.lead}
                  strokeWidth={2}
                  rx={4}
                />
                <text
                  x={rx + rw - 5}
                  y={ry + 8}
                  fontSize={11}
                  fill={COLORS.lead}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,.7)",
                  }}
                >
                  ⚑
                </text>
              </>
            )}

            {/* Wappen-Kreis */}
            <circle cx={rx + rw / 2} cy={ry + rh / 2} r={cs / 2} fill={`hsl(${hue},40%,32%)`} stroke={relBorder} strokeWidth={relStroke} style={{ filter: "drop-shadow(0 2px 4px rgba(5,8,4,.5))" }} />

            {/* Wappen-Text */}
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 + csTextSize / 3}
              textAnchor="middle"
              fontSize={csTextSize}
              fontFamily="ui-monospace, Menlo, monospace"
              fontWeight={800}
              letterSpacing="-0.04em"
              fill="#eef3e6"
              pointerEvents="none"
            >
              {t.code}
            </text>

            {/* Medaillen-Ring (Top-3) */}
            {idx === 0 && <circle cx={rx + rw / 2} cy={ry + rh / 2} r={cs / 2 + 2} fill="none" stroke={COLORS.lead} strokeWidth={2} opacity={0.5} />}
            {idx === 1 && <circle cx={rx + rw / 2} cy={ry + rh / 2} r={cs / 2 + 2} fill="none" stroke="#c8d0dd" strokeWidth={2} opacity={0.5} />}
            {idx === 2 && <circle cx={rx + rw / 2} cy={ry + rh / 2} r={cs / 2 + 2} fill="none" stroke="#cd8a4e" strokeWidth={2} opacity={0.5} />}

            {/* Krone (Champion) */}
            {idx === 0 && (
              <text x={rx + rw / 2} y={ry - 5} textAnchor="middle" fontSize={12} pointerEvents="none">
                🏆
              </text>
            )}

            {/* Punkte-Text (nur groß genug) */}
            {rw > 66 && rh > 60 && (
              <text
                x={rx + rw / 2}
                y={ry + rh - 6}
                textAnchor="middle"
                fontSize={9}
                fontFamily="ui-monospace, Menlo, monospace"
                fontWeight={800}
                fill="rgba(238,243,230,.55)"
                pointerEvents="none"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(t.displayScore || 0)} Pkt
              </text>
            )}

            {/* Hover-Area (unsichtbar, für Events) */}
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
    </>
  );
}
