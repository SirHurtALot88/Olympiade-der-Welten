// =====================================================================================
// schach (Speed-Schach / Speed Chess) — Elo-Klassen-Wand mit Schachbrett-Thema
//
// Feld: Abgedunkelte Turnierhalle mit feinem Schachbrett-Karo, horizontale Elo-Klassen-
// Bänder (Klasse C→Grossmeister), Teams in 32 Bahnen nebeneinander, Y-Position = Elo.
// Figuren-Wasserzeichen, Elo-Achse, Super-GM-Linie golden oben, Start mit Brettern
// unten. Keine rAF-Glide; CSS transition auf Token-g transform (wie shared.tsx pattern).
// =====================================================================================
"use client";

import type { ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps } from "./types";

export default function SchachField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    N,
    geo,
    finalMax,
    rt,
    sorted,
    now,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    tokenPos,
  } = props;

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

      {/* ========================================================================== */}
      {/* TOKENS: 32 Bahnen, X = Team-Index (horizontal spread), Y = Elo-Score */}
      {/* ========================================================================== */}
      {sorted.map((t, sortedIndex) => {
        // Score → Elo über die VOLLE Klassen-Spanne skalieren (finalMax = Spitzenwert),
        // sonst landen alle Roh-Scores (~30–334) in KLASSE C. So verteilen sich die
        // Teams vertikal über alle Klassen (Spitze = Grossmeister, Keller = Klasse C).
        const eloNorm = maxTotal > 0 ? Math.max(0, Math.min(1, t.displayScore / maxTotal)) : 0;
        const elo = Math.round(BASE + eloNorm * (maxElo - BASE));
        const x = laneX(sortedIndex); // Spread horizontally by position in sorted array
        const y = yOf(elo); // Elo-basierte vertikale Position (yOf erwartet Elo)
        const r = t.isOwn ? geo.rOwn : geo.r;
        const hue = hueForIdx(t.idx);
        const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
        const relC = relColor(t.rel);
        const band = bandOf(elo);
        const isLeader = t.rank === 1;

        return (
          <g
            key={t.code}
            transform={`translate(${x} ${y})`}
            style={{ transition: reducedMotion ? "none" : "transform 5s cubic-bezier(.4,0,.2,1)", cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
            onMouseEnter={() => openHover(t.idx)}
            onMouseLeave={scheduleHoverClose}
            onClick={() => {
              if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
            }}
          >
            {/* Token-Basis (mit oder ohne Logo) */}
            {t.logoUrl ? (
              <image
                href={t.logoUrl}
                x={-r}
                y={-r}
                width={r * 2}
                height={r * 2}
                clipPath={`url(#natclip-${t.code})`}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : (
              <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
            )}

            {/* Token-Rand: Lead goldener Ring oder Beziehung (mine/ally/rival) */}
            {isLeader ? (
              <>
                <circle r={r + 5.5} fill="none" stroke="var(--nl-warn)" strokeWidth={3} opacity={0.7} />
                <circle r={r} fill="none" stroke="var(--nl-ink)" strokeWidth={2.5} />
              </>
            ) : relC ? (
              <circle r={r + 5.5} fill="none" stroke={relC} strokeWidth={2.4} opacity={0.95} />
            ) : (
              <circle r={r} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.4} />
            )}

            {/* Medaillen-Ring (Top-3) */}
            {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}

            {/* Figuren-Glyph (oben, Promotion pro Klasse) — in Farbe wenn Grossmeister */}
            <text y={-(r + 1)} textAnchor="middle" fontSize={10} fontWeight={800} fill={band[0] >= 2400 ? "var(--nl-warn)" : "#bfb397"} style={{ textShadow: "0 1px 2px rgba(8,6,2,0.8)" }}>
              {band[3]}
            </text>

            {/* Champion-Krone (nur Rang 1) */}
            {isLeader ? (
              <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                🏆
              </text>
            ) : null}

            {/* Team-Code (klein, unten für Lesbarkeit, nur eigenes Team betont) */}
            {t.isOwn ? (
              <text y={r + 10} textAnchor="middle" fontSize={9} fontWeight={800} fill="var(--nl-ink)">
                {t.code}
              </text>
            ) : null}
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
