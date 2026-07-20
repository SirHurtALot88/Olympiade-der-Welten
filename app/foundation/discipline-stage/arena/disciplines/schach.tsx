// =====================================================================================
// schach (Speed-Schach / Speed Chess) — Elo-Klassen-Wand mit Schachbrett-Thema
//
// Feld: Abgedunkelte Turnierhalle mit feinem Schachbrett-Karo, horizontale Elo-Klassen-
// Bänder (Klasse C→Grossmeister), Teams in 32 Bahnen nebeneinander, Y-Position = Elo.
// Figuren-Wasserzeichen, Elo-Achse, Super-GM-Linie golden oben, Start mit Brettern
// unten. Keine rAF-Glide; CSS transition auf Token-g transform (wie shared.tsx pattern).
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { GhostLayer, TokenChrome } from "./benchmark";

export default function SchachField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    reducedMotion,
    W,
    H,
    N,
    geo,
    finalMax,
    rt,
    sorted,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  const LW = W;
  const LH = H;

  // Elo-Basis und Normalisierung (aus Mockup: BASE=1000, maxElo=2600)
  const BASE = 1000;
  const maxElo = 2600;
  const maxTotal = finalMax; // Team-Punkte → Elo

  // Geometrie (aus Mockup: LW=900, LH=620, Y0=540 bottom start, Y1=92 top)
  // Skaliert auf tatsächliche ViewBox
  const Y0 = (540 / 620) * LH; // Start/Einstieg (Elo 1000)
  const Y1 = (92 / 620) * LH;  // Top (Super-GM 2600)

  // 32 Bahnen horizontal
  const WX0 = (58 / 900) * LW;  // Wall-left
  const WX1 = (892 / 900) * LW; // Wall-right
  const LANES = N;
  const pitch = (WX1 - WX0) / (LANES - 1);

  const laneCX = (i: number): number => (LANES > 1 ? WX0 + (i / (LANES - 1)) * (WX1 - WX0) : (WX0 + WX1) / 2);

  // Elo → Y position
  const yOf = (elo: number): number => {
    if (maxElo <= BASE) return Y0; // fallback
    return Y0 - ((elo - BASE) / (maxElo - BASE)) * (Y0 - Y1);
  };

  // Elo-Klassen (Primitive: klassen) — Band, Name, Figur-Glyph (Promotion)
  type KlasseInfo = [number, number, string, string];
  const KLASSEN: KlasseInfo[] = [
    [1000, 1400, "KLASSE C", "♟"],
    [1400, 1700, "KLASSE B", "♞"],
    [1700, 2000, "KLASSE A", "♝"],
    [2000, 2200, "KANDIDAT", "♜"],
    [2200, 2400, "MEISTER", "♛"],
    [2400, 2600, "GROSSMEISTER", "♚"],
  ];

  const bandOf = (elo: number): KlasseInfo => {
    for (let i = KLASSEN.length - 1; i >= 0; i -= 1) {
      if (elo >= KLASSEN[i]![0]) return KLASSEN[i]!;
    }
    return KLASSEN[0]!;
  };

  // 32 Bahnen horizontal: X-position per team index, Y-position per Elo-score
  const lPad = 48;
  const rPad = 48;
  const colW = (WX1 - WX0 - lPad - rPad) / N;
  const laneX = (i: number): number => WX0 + lPad + i * colW + colW / 2;

  // Score → Elo (volle Klassen-Spanne).
  const eloOf = (score: number): number => {
    const n = maxTotal > 0 ? Math.max(0, Math.min(1, score / maxTotal)) : 0;
    return BASE + n * (maxElo - BASE);
  };

  // ---- Benchmark-Bewegung: Position folgt dem Host-`animScore` (rAF, Frame-Sync mit der
  // Rangliste; Hover/Pause friert ein). X = Live-Rang-Spalte (Bump-Umsortierung), Y = Elo. ----
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const ghostRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const list = rtRef.current;
      // Live-Ordnung nach animScore → weiche Bump-Umsortierung der Spalten.
      const order = [...list].sort((a, b) => b.animScore - a.animScore || a.seasonRank - b.seasonRank);
      const liveIdx = new Map<number, number>();
      order.forEach((t, i) => liveIdx.set(t.idx, i));
      for (const t of list) {
        const el = gRefs.current.get(t.idx);
        if (el && !frozen) {
          el.setAttribute("transform", `translate(${laneX(liveIdx.get(t.idx) ?? 0)} ${yOf(eloOf(t.animScore))})`);
        }
        const gel = ghostRefs.current.get(t.idx);
        if (gel) {
          const span = t.displayScore - t.roundStartScore;
          const p = span > 0.5 ? Math.max(0, Math.min(1, (t.animScore - t.roundStartScore) / span)) : 1;
          if (span > 0.5 && !reduce && p < 0.98) {
            gel.setAttribute("transform", `translate(${laneX(Math.max(0, (t.roundStartRank ?? 1) - 1))} ${yOf(eloOf(t.roundStartScore))})`);
            gel.setAttribute("opacity", String((t.isOwn ? 0.6 : 0.28) * (1 - p * 0.7)));
          } else {
            gel.setAttribute("opacity", "0");
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* ========================================================================== */}
      {/* FIELD ART: Real JSX elements (no dangerouslySetInnerHTML) */}
      {/* ========================================================================== */}

      {/* Header-Text */}
      <text
        x={LW / 2}
        y={26}
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={17}
        letterSpacing={5}
        fill="#e0d2ab"
        opacity={0.4}
      >
        SPEED-SCHACH · BLITZ 3+2 · TEAM-BLITZ AN 4 BRETTERN
      </text>

      {/* Lamps (Lichter) */}
      {[LW * 0.2, LW * 0.5, LW * 0.8].map((x, i) => (
        <g key={`lamp-${i}`}>
          <path
            d={`M ${x - 14} 40 L ${x + 14} 40 L ${x + 64} ${Y0 - 40} L ${x - 64} ${Y0 - 40} Z`}
            fill="rgba(246,222,150,0.022)"
          />
          <circle cx={x} cy={38} r={5} fill="rgba(246,222,150,0.25)" />
        </g>
      ))}

      {/* Wandkörper mit Karo + Klassen-Bändern */}
      <rect
        x={WX0}
        y={Y1}
        width={WX1 - WX0}
        height={Y0 - Y1 + 18}
        fill="rgba(38,31,20,0.5)"
      />

      {/* Wasserzeichen: große Figuren-Silhouetten */}
      <text
        x={LW * 0.25}
        y={Y0 - 70}
        textAnchor="middle"
        fontSize={230}
        fill="rgba(232,221,194,0.03)"
      >
        ♞
      </text>
      <text
        x={LW * 0.75}
        y={Y0 - 110}
        textAnchor="middle"
        fontSize={200}
        fill="rgba(232,221,194,0.028)"
      >
        ♛
      </text>

      {/* Schachbrett-Karo (feines Muster) */}
      {(() => {
        const q = 44;
        const squares: React.ReactNode[] = [];
        for (let y = Y1; y < Y0; y += q) {
          for (let x = WX0; x < WX1; x += q) {
            const ry = Math.floor((y - Y1) / q);
            const rx = Math.floor((x - WX0) / q);
            if ((rx + ry) % 2) continue;
            const w = Math.min(q, WX1 - x);
            const h = Math.min(q, Y0 - y);
            squares.push(
              <rect
                key={`checker-${rx}-${ry}`}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="rgba(232,221,194,0.026)"
              />
            );
          }
        }
        return squares;
      })()}

      {/* Elo-Klassen-Bänder (horizontale Streifen) */}
      {KLASSEN.map((k, i) => {
        const yb = yOf(k[0]);
        const yt = yOf(Math.min(k[1], maxElo));
        const tint =
          i >= 5
            ? "rgba(246,199,80,0.05)"
            : i >= 4
              ? "rgba(232,221,194,0.028)"
              : `rgba(232,221,194,${(0.006 + i * 0.005).toFixed(3)})`;
        return (
          <g key={`band-${i}`}>
            <rect
              x={WX0}
              y={yt}
              width={WX1 - WX0}
              height={yb - yt}
              fill={tint}
            />
            {i > 0 && (
              <path
                d={`M ${WX0} ${yb} H ${WX1}`}
                stroke="rgba(226,211,172,0.14)"
                strokeWidth={1}
                strokeDasharray="4 8"
              />
            )}
            <text
              x={WX1 - 12}
              y={yb - 7}
              textAnchor="end"
              fontFamily="ui-monospace,Menlo,monospace"
              fontSize={9.5}
              fontWeight={800}
              letterSpacing={2.5}
              fill={`rgba(226,211,172,${i >= 4 ? 0.5 : 0.3})`}
            >
              {k[3]} {k[2]}
            </text>
          </g>
        );
      })}

      {/* Y-Achse mit Elo-Werten */}
      {Array.from({ length: 8 }).map((_, i) => {
        const e = 1200 + i * 200;
        const y = yOf(e);
        return (
          <text
            key={`elo-${e}`}
            x={WX0 - 8}
            y={y + 3}
            textAnchor="end"
            fontFamily="ui-monospace,Menlo,monospace"
            fontSize={9}
            fontWeight={800}
            fill="rgba(242,238,227,0.34)"
          >
            {e}
          </text>
        );
      })}

      {/* Super-GM-Linie 2600 (goldene Krone der Wand) */}
      <path
        d={`M ${WX0} ${yOf(2600)} H ${WX1}`}
        stroke="#f6c750"
        strokeWidth={2}
        opacity={0.75}
        strokeDasharray="10 7"
      />
      <text
        x={WX0 + 10}
        y={yOf(2600) - 8}
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={9}
        fontWeight={800}
        letterSpacing={2.5}
        fill="#f6c750"
        opacity={0.85}
      >
        SUPER-GM · WELTKLASSE 2600
      </text>
      <text
        x={WX1 - 14}
        y={yOf(2600) - 6}
        textAnchor="end"
        fontSize={14}
        fill="#f6c750"
        opacity={0.9}
      >
        ♔
      </text>

      {/* Einstieg-Linie */}
      <path
        d={`M ${WX0} ${Y0} H ${WX1}`}
        stroke="rgba(242,238,227,0.2)"
        strokeWidth={1.5}
      />
      <text
        x={WX0 + 10}
        y={Y0 + 14}
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={8.5}
        fontWeight={800}
        letterSpacing={2}
        fill="rgba(242,238,227,0.4)"
      >
        START · ELO 1000 · DIE UHREN LAUFEN
      </text>

      {/* Simultan-Tische mit Brettern am Einstieg (unten) */}
      {(() => {
        const tables: React.ReactNode[] = [];
        for (let i = 0, x = WX0; x < WX1; i += 1, x += 88) {
          const w = Math.min(88, WX1 - x) - 6;
          if (w < 30) break;
          tables.push(
            <g key={`table-${i}`}>
              <rect
                x={x}
                y={Y0 + 20}
                width={w}
                height={30}
                rx={5}
                fill={i % 2 ? "#2a2114" : "#241c11"}
                stroke="#3d3222"
                strokeWidth={1}
              />
              {Array.from({ length: 8 }).map((_, b) => {
                const xb = x + 7 + (b * (w - 14)) / 8;
                const wb = (w - 14) / 8;
                return (
                  <rect
                    key={`board-${i}-${b}`}
                    x={xb}
                    y={Y0 + 25}
                    width={wb}
                    height={7}
                    fill={b % 2 ? "rgba(232,221,194,0.18)" : "rgba(20,15,8,0.6)"}
                  />
                );
              })}
              <circle
                cx={x + w * 0.3}
                cy={Y0 + 41}
                r={2.5}
                fill="rgba(232,221,194,0.12)"
              />
              <circle
                cx={x + w * 0.7}
                cy={Y0 + 41}
                r={2.5}
                fill="rgba(232,221,194,0.12)"
              />
            </g>
          );
        }
        return tables;
      })()}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Token. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* ========================================================================== */}
      {/* TOKENS: X = Live-Rang-Spalte (Bump), Y = Elo-Score — Position via rAF (animScore) */}
      {/* ========================================================================== */}
      {sorted.map((t, i) => {
        const r = t.isOwn ? geo.rOwn : geo.r;
        // Figuren-Glyph (Promotion) aus dem aktuellen Runden-Elo.
        const band = bandOf(Math.round(eloOf(t.displayScore)));

        return (
          <g
            key={t.code}
            data-token-code={t.code}
            ref={(el) => {
              gRefs.current.set(t.idx, el);
              if (el && !el.getAttribute("transform")) {
                el.setAttribute("transform", `translate(${laneX(i)} ${yOf(eloOf(t.animScore))})`);
              }
            }}
            style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
            onMouseEnter={() => openHover(t.idx)}
            onMouseLeave={scheduleHoverClose}
            onClick={() => {
              if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
            }}
          >
            {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/🏆/Rang-Badge. */}
            <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} />

            {/* Figuren-Glyph (oben, Promotion pro Klasse) — in Farbe wenn Grossmeister */}
            <text y={-(r + 1)} textAnchor="middle" fontSize={10} fontWeight={800} fill={band[0] >= 2400 ? "var(--nl-warn)" : "#bfb397"} style={{ textShadow: "0 1px 2px rgba(8,6,2,0.8)" }}>
              {band[3]}
            </text>
          </g>
        );
      })}

      {/* SVG-Defs für Logos */}
      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {/* Discipline name watermark */}
      {disciplineName ? (
        <text
          x={18}
          y={30}
          fontSize={19}
          fontWeight={800}
          letterSpacing="0.04em"
          fill={skinAccent}
          opacity={0.95}
          style={{ textTransform: "uppercase" }}
        >
          {disciplineName}
        </text>
      ) : null}
    </>
  );
}
