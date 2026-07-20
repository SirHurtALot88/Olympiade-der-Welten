// =====================================================================================
// Gewichtheben · Kraft-Turm — Barbell-Turm mit Gewichts-Achse, Power-Rack-Rahmen,
// und der geforderten Last (goldene Latte). Alle Heber sitzen auf der Latte oder sind
// gerissen auf ihr Endgewicht.
//
// Bewegung: pro Runde Gleit-Animation über 5s (TRACK_ROUND_MS) mit CSS-Transitions
// für Token-Positionen (simultan). Eliminierte Heber zeigen roten Ring, Champion
// bekommt Krone + goldener Glow, Top-3 zeigen Medaillentinge.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, TRACK_ROUND_MS } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";
import { TokenChrome } from "./benchmark";

type BarbellState = {
  fromY: number;
  toY: number;
  glideT: number;
};

export default function BarbellField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    N,
    geo,
    layout,
    rt,
    barbellSorted,
    barbellInfo,
    barbellY,
    barbellKgOf,
    barbellEliminated,
    barbellRankMap,
    demandKg,
    done,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // Pro-Token Gleit-Zustand + DOM-Refs für imperatives Positioning
  const barbellRef = useRef<Map<number, BarbellState>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());

  // Frische Prop-Spiegel für rAF-Schleife
  const hoverRef = useRef<number | null>(props.hoverIdx);
  const reducedRef = useRef<boolean>(reducedMotion);
  const rtRef = useRef<RT[]>(rt);
  const barbellSortedRef = useRef<RT[]>(barbellSorted);
  const demandKgRef = useRef<number | null>(demandKg);
  const barbellKgOfRef = useRef<(idx: number) => number>(barbellKgOf);
  const barbellYRef = useRef<(kg: number) => number>(barbellY);

  hoverRef.current = props.hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  reducedRef.current = reducedMotion;
  rtRef.current = rt;
  barbellSortedRef.current = barbellSorted;
  demandKgRef.current = demandKg;
  barbellKgOfRef.current = barbellKgOf;
  barbellYRef.current = barbellY;

  // Feld-Geometrie (defensiv aus layout mit Fallbacks)
  const lPad = layout?.lPad ?? 40;
  const rPad = layout?.rPad ?? 40;
  const baseY = layout?.baseY ?? H - 40;
  const topY = layout?.topY ?? 40;
  const axX = lPad;
  const rightX = W - rPad;
  const usableW = rightX - axX;
  const colW = usableW / Math.max(1, N);

  // rAF-Schleife: gleitet alle Token über TRACK_ROUND_MS
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;

      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const c = barbellRef.current;

      for (const t of rtRef.current) {
        let st = c.get(t.idx);
        if (!st) {
          st = { fromY: baseY, toY: baseY, glideT: 1 };
          c.set(t.idx, st);
        }

        // Zielposition: barbellKgOf(idx) → y
        const targetKg = barbellKgOfRef.current(t.idx);
        const targetY = barbellYRef.current(targetKg);
        if (Math.abs(targetY - st.toY) > 0.5) {
          st.fromY = st.glideT < 1 ? st.fromY + (st.toY - st.fromY) * st.glideT : st.fromY;
          st.toY = targetY;
          st.glideT = 0;
        }

        if (reduce) {
          st.glideT = 1;
        } else if (!frozen && st.glideT < 1) {
          st.glideT = Math.min(1, st.glideT + dt / TRACK_ROUND_MS);
        }

        // Position interpolieren
        const y = st.fromY + (st.toY - st.fromY) * st.glideT;

        const el = gRefs.current.get(t.idx);
        if (el) {
          // Finde die Position in barbellSorted für die Lanen-Reihenfolge
          const laneIdx = barbellSortedRef.current.findIndex((bt) => bt.idx === t.idx);
          const x = axX + (laneIdx >= 0 ? laneIdx : 0) * colW + colW / 2;
          el.setAttribute("transform", `translate(${x} ${y})`);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ohne Kraft-Turm-Infos gibt es kein Feld (Guard NACH den Hooks — Rules of Hooks).
  if (!barbellInfo) {
    return null;
  }

  // Tick-Marks für die kg-Achse
  const ticks: number[] = [];
  for (let k = Math.ceil(barbellInfo.axTop / 50) * 50; k <= barbellInfo.kgMax + 5; k += 50) {
    ticks.push(k);
  }

  // Podium-Linie y-Position
  const podY = topY - 10;

  // Demanded weight line y-position (mit Smooth-Transition)
  const dLine = demandKg == null ? barbellInfo.axTop : demandKg;
  const barY = barbellY(dLine);

  // Live-Zähler: wie viele Heber sind noch im Wettkampf (nicht an der Last gescheitert).
  // Macht die Eliminations-Mechanik lesbar — „N/32 stemmen die geforderte Last noch".
  const liveCount = demandKg == null ? rt.length : rt.filter((t) => !barbellEliminated(t.idx)).length;

  return (
    <>
      <defs>
        {/* Logo-Clipping für Teams */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {/* === Hintergrund === */}
      {env ? (
        <>
          {/* Himmel */}
          <rect x={0} y={0} width={W} height={H} fill={env.sky[0]} opacity={0.8} />
        </>
      ) : (
        <>
          {/* Einfacher dunkler Grund mit Kraftraum-Gradient */}
          <defs>
            <linearGradient id="kraftGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#191b1f" />
              <stop offset="55%" stopColor="#101216" />
              <stop offset="100%" stopColor="#0b0d10" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill="url(#kraftGrad)" />
        </>
      )}

      {/* Vertikal-Raster (Kreidestaub-Effekt) */}
      <g stroke="rgba(143,166,192,.03)" strokeWidth={1} pointerEvents="none">
        {Array.from({ length: Math.ceil(W / 70) }).map((_, i) => (
          <line key={`grid-${i}`} x1={i * 70} y1={0} x2={i * 70} y2={H} />
        ))}
      </g>

      {/* Power-Rack-Rahmen (Ständer links/rechts + Grundlinie) */}
      <line x1={axX} y1={topY} x2={axX} y2={baseY} stroke="rgba(143,166,192,.25)" strokeWidth={2} pointerEvents="none" />
      <line x1={rightX} y1={topY} x2={rightX} y2={baseY} stroke="rgba(143,166,192,.25)" strokeWidth={2} pointerEvents="none" />
      <line x1={axX} y1={baseY} x2={rightX} y2={baseY} stroke="var(--nl-line-2)" strokeWidth={2.5} />

      {/* kg-Achse mit Tick-Marken */}
      {ticks.map((k) => {
        const y = barbellY(k);
        return (
          <g key={`ax-${k}`} pointerEvents="none">
            <line x1={axX - 6} y1={y} x2={rightX} y2={y} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="3 9" opacity={0.4} />
            <text x={axX - 9} y={y + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="var(--nl-mut-2)">
              {k}
            </text>
          </g>
        );
      })}
      <text
        x={16}
        y={(topY + baseY) / 2}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill="var(--nl-mut-2)"
        letterSpacing="0.14em"
        transform={`rotate(-90 16 ${(topY + baseY) / 2})`}
        pointerEvents="none"
      >
        kg GESTEMMT
      </text>

      {/* Podium-Linie oben mit Trophy */}
      <line x1={axX} y1={podY} x2={rightX} y2={podY} stroke="var(--nl-warn)" strokeWidth={1} strokeDasharray="5 6" opacity={0.55} pointerEvents="none" />
      <text x={rightX - 6} y={podY - 4} textAnchor="end" fontSize={13} pointerEvents="none">
        🏆
      </text>

      {/* Live-Zähler „N/Total im Wettkampf" — zeigt die laufende Elimination (oben rechts). */}
      <g transform={`translate(${rightX - 6} 26)`} pointerEvents="none">
        <rect x={-96} y={-15} width={96} height={22} rx={6} fill="var(--nl-panel)" stroke="var(--nl-line)" strokeWidth={1} opacity={0.92} />
        <text x={-88} y={1} fontSize={9.5} fontWeight={800} fontFamily="ui-monospace, monospace" fill="var(--nl-mut-2)" letterSpacing="0.06em">
          IM WETTKAMPF
        </text>
        <text x={-8} y={1} textAnchor="end" fontSize={12} fontWeight={900} fontFamily="ui-monospace, monospace" fill={liveCount <= 3 ? "var(--nl-warn)" : "var(--nl-ink)"}>
          {liveCount}/{rt.length}
        </text>
      </g>

      {/* DIE geforderte Last — der Star (mit CSS-Transition) */}
      <g style={{ transition: reducedMotion ? "none" : `transform ${TRACK_ROUND_MS}ms cubic-bezier(.45,0,.2,1)` }} transform={`translate(0 ${barY})`} pointerEvents="none">
        <line x1={axX} y1={0} x2={rightX} y2={0} stroke="var(--nl-warn)" strokeWidth={3} />
        <rect x={axX - 5} y={-11} width={9} height={22} rx={3} fill="var(--nl-mut)" />
        <rect x={rightX - 4} y={-11} width={9} height={22} rx={3} fill="var(--nl-mut)" />
        <g transform={`translate(${axX + 8} -22)`}>
          <rect x={0} y={0} width={demandKg != null && demandKg >= 100 ? 118 : 108} height={19} rx={5} fill="var(--nl-warn)" />
          <text x={7} y={13} fontSize={11} fontWeight={900} fontFamily="ui-monospace, monospace" fill="var(--nl-bg)">
            {demandKg == null ? "GEFORDERT —" : done ? `GESTEMMT ${Math.round(dLine)} kg` : `GEFORDERT ${Math.round(dLine)} kg`}
          </text>
        </g>
      </g>

      {/* Team-Codes unter der Grundlinie */}
      {barbellSorted.map((t) => {
        const laneIdx = barbellSorted.indexOf(t);
        return (
          <text
            key={`bl-${t.code}`}
            x={axX + laneIdx * colW + colW / 2}
            y={baseY + 13}
            textAnchor="middle"
            fontSize={8}
            fontWeight={t.isOwn ? 800 : 600}
            fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut-2)"}
            pointerEvents="none"
          >
            {t.code}
          </text>
        );
      })}

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
          pointerEvents="none"
        >
          {disciplineName}
        </text>
      ) : null}

      {/* === Plate-Towers + Token: Heber === */}
      {barbellSorted.map((t) => {
        const laneIdx = barbellSorted.indexOf(t);
        const laneX = axX + laneIdx * colW + colW / 2;
        const kg = barbellKgOf(t.idx);
        const y = barbellY(kg);
        const hue = hueForIdx(t.idx);
        const bbOut = barbellEliminated(t.idx);
        const colH = baseY - y; // Höhe der Säule

        return (
          <g key={`tower-${t.code}`}>
            {/* Gewichts-Turm: von baseY (unten) bis y (oben) — Stäbe + Platten */}
            {colH > 2 && (
              <g opacity={bbOut ? 0.42 : 1} style={{ transition: reducedMotion ? "none" : `transform ${TRACK_ROUND_MS}ms cubic-bezier(.45,0,.2,1)` }}>
                {/* Dünner Haupt-Stab (the bar) */}
                <rect x={laneX - 1.5} y={y} width={3} height={colH} fill="rgba(143,166,192,.5)" />

                {/* Gewichts-Platten als Rechtecke — mehrere Schichten je kg-Stufe */}
                {Array.from({ length: Math.max(1, Math.ceil(colH / 12)) }).map((_, pIdx) => {
                  const pY = baseY - (pIdx + 1) * 12;
                  const pW = Math.min(14 + pIdx * 2, 32);
                  return pY >= y ? (
                    <rect
                      key={`plate-${pIdx}`}
                      x={laneX - pW / 2}
                      y={pY}
                      width={pW}
                      height={10}
                      rx={1}
                      fill={`hsl(${hue} 40% ${50 + pIdx * 3}%)`}
                      opacity={0.75}
                      stroke="rgba(143,166,192,.3)"
                      strokeWidth={0.5}
                    />
                  ) : null;
                })}
              </g>
            )}
          </g>
        );
      })}

      {/* === Token: Heber (bewegt sich mit rAF) === */}
      {barbellSorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const bbOut = barbellEliminated(t.idx);
          const bbChamp = done && (barbellRankMap[t.code] ?? 99) === 1;
          const glowing = t.glowUntil > now;

          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              style={{
                cursor: onOpenTeam && t.teamId ? "pointer" : "default",
                opacity: bbOut ? 0.42 : 1,
                filter: bbOut ? "grayscale(.72)" : "none",
              }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Champion: goldener Glow-Ring */}
              {bbChamp ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={3.5}
                  style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.4s ease-in-out infinite" }}
                />
              ) : null}

              {/* Eliminated: roter Ring */}
              {bbOut ? <circle r={r + 3.5} fill="none" stroke="var(--nl-risk)" strokeWidth={2.4} /> : null}

              {/* Kampfrichter-Lampe (Gültig/Gerissen) */}
              {demandKg != null ? (
                <text x={-(r + 1)} y={r + 4} textAnchor="end" fontSize={11}>
                  {bbOut ? "🔴" : "⚪"}
                </text>
              ) : null}

              {/* Champion-Krone */}
              {bbChamp ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}

              {/* Glowing für Führenden */}
              {glowing ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={4}
                  style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }}
                />
              ) : null}

              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen. trophy={false}
                  — eigene Krone (oben). badge={false} — die Eliminations-Rangliste (barbellSorted,
                  Verbliebene zuerst) ist maßgeblich; ein Score-Rang-Badge würde sie spoilern. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} badge={false} />
            </g>
          );
        })}
    </>
  );
}
