// =====================================================================================
// Climbing (Sportklettern) — Kletterwand-Archetyp mit Höhe = Punkte, geschwungene
// Griff-Linen pro Route, Überhang-Crux, Gipfel-Sims mit Top-Out-Glocke.
//
// Zahlen-Pops NUR bei besonderen Leistungen: ⚡ Dyno (beste Runde), ⭐ Star (Star-Team),
// 😰 Wackler (Show). Medaillen-Ringe um Top-3-Icons. Score = Wahrheit, Endstand bleibt.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT, Vec2 } from "./types";

type ClimbState = {
  fromY: number;
  toY: number;
  glideT: number;
  dip: number;
};

export default function ClimbingField(props: DisciplineFieldProps): ReactNode {
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
    tokenPos,
    rt,
    sorted,
    round,
    now,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;

  // Pro-Token Gleit-Zustand + DOM-Refs für imperatives Positioning
  const climbRef = useRef<Map<number, ClimbState>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());

  // Frische Prop-Spiegel für rAF-Schleife
  const hoverRef = useRef<number | null>(null);
  const reducedRef = useRef<boolean>(reducedMotion);
  const rtRef = useRef<RT[]>(rt);
  const sortedRef = useRef<RT[]>(sorted);

  hoverRef.current = props.hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  reducedRef.current = reducedMotion;
  rtRef.current = rt;
  sortedRef.current = sorted;

  // Wandgeometrie: vertikal, Score-normiert zu y-Position
  const wallTop = Math.max(60, H * 0.15); // Gipfel oben
  const wallBottom = Math.max(wallTop + 100, H * 0.85); // Einstieg unten
  const wallLeft = Math.max(40, W * 0.1);
  const wallRight = Math.max(wallLeft + 100, W * 0.9);

  // y-Position für einen kumulierten Score (normaliert 0…finalMax)
  const yOf = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    return wallBottom - norm * (wallBottom - wallTop);
  };

  // x-Position: Lane-Index → gleichmäßig über die Wand verteilt
  const xOf = (laneIdx: number): number => {
    return wallLeft + ((laneIdx % N) + 0.5) * ((wallRight - wallLeft) / Math.max(1, N));
  };

  // Griff-Linie: jede Route schwingt leicht horizontal (keine Sehne, folgt der Route)
  const swayOf = (teamCode: string, y: number): number => {
    const hash = teamCode.charCodeAt(0) + teamCode.charCodeAt(1 || 0) * 256;
    const amplitude = 3 + (hash % 6);
    const freq = 0.014 + ((hash >> 8) % 8) * 0.002;
    const phase = ((hash >> 16) % 63) * 0.1;
    return amplitude * Math.sin(y * freq + phase);
  };

  // rAF-Schleife: gleitet alle Token 5s pro Runde
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const ROUND_MS = 5000;

    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;

      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const c = climbRef.current;

      for (const t of rtRef.current) {
        let st = c.get(t.idx);
        if (!st) {
          st = { fromY: wallBottom, toY: wallBottom, glideT: 1, dip: 0 };
          c.set(t.idx, st);
        }

        // Zielposition: Score → y
        const targetY = yOf(t.displayScore ?? t.score);
        if (Math.abs(targetY - st.toY) > 0.5) {
          st.fromY = st.glideT < 1 ? st.fromY + (st.toY - st.fromY) * st.glideT : st.fromY;
          st.toY = targetY;
          st.glideT = 0;
          st.dip = 0;
        }

        if (reduce) {
          st.glideT = 1;
          st.dip = 0;
        } else if (!frozen && st.glideT < 1) {
          st.glideT = Math.min(1, st.glideT + dt / ROUND_MS);
        }

        // Position + Wackler-Dip
        const dipAmount = st.dip && st.glideT < 0.45 ? st.dip * Math.sin(Math.PI * Math.min(1, st.glideT / 0.45)) : 0;
        const y = st.fromY + (st.toY - st.fromY) * st.glideT + dipAmount;

        const el = gRefs.current.get(t.idx);
        if (el) {
          // Stabile, dichte Bahn 0…N-1 direkt aus dem RT (nicht via Closure-findIndex,
          // das bei Idx-Mismatch −1 lieferte → alle Kletterer klebten links am Rand).
          const laneIdx = t.laneIdx;
          const x = xOf(laneIdx) + swayOf(t.code, y);
          el.setAttribute("transform", `translate(${x} ${y})`);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SVG Renderer: Wandkunst + Token
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

      {/* === Kletterwand-Hintergrund === */}
      {env ? (
        <>
          {/* Himmel */}
          <rect x={0} y={0} width={W} height={H} fill={env.sky[0]} opacity={0.8} />
        </>
      ) : (
        <>
          {/* Einfacher dunkler Grund */}
          <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" opacity={0.95} />
        </>
      )}

      {/* Wand-Körper Gradient */}
      <defs>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(51, 43, 62)" />
          <stop offset="45%" stopColor="rgb(42, 36, 49)" />
          <stop offset="100%" stopColor="rgb(33, 28, 39)" />
        </linearGradient>
      </defs>

      {/* Wand-Fläche */}
      <rect x={wallLeft} y={wallTop} width={wallRight - wallLeft} height={wallBottom - wallTop} fill="url(#wallGrad)" />

      {/* Wand-Gitter (T-Nut-Raster) */}
      <g stroke="rgba(200, 210, 225, 0.04)" strokeWidth={1} opacity={0.5}>
        {Array.from({ length: Math.ceil((wallRight - wallLeft) / 140) + 1 }).map((_, i) => (
          <line key={`v-${i}`} x1={wallLeft + i * 140} y1={wallTop} x2={wallLeft + i * 140} y2={wallBottom} />
        ))}
        {Array.from({ length: Math.ceil((wallBottom - wallTop) / 110) + 1 }).map((_, i) => (
          <line key={`h-${i}`} x1={wallLeft} y1={wallTop + i * 110} x2={wallRight} y2={wallTop + i * 110} />
        ))}
      </g>

      {/* Höhen-Markierungen (Meter-Skala) */}
      <g>
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const y = wallBottom - f * (wallBottom - wallTop);
          const meters = Math.round(f * 45);
          return (
            <g key={`meter-${f}`}>
              <line x1={wallLeft - 12} y1={y} x2={wallLeft - 2} y2={y} stroke="var(--nl-accent)" strokeWidth={1.2} opacity={0.6} />
              <text x={wallLeft - 16} y={y + 3} textAnchor="end" fontSize={9} fontWeight={800} fill="rgba(240, 243, 248, 0.34)" fontFamily="ui-monospace, monospace">
                {meters}m
              </text>
            </g>
          );
        })}
      </g>

      {/* Routen-Griffe (deterministisch pro Team) */}
      <g opacity={0.75}>
        {rt.map((t) => {
          const laneIdx = rt.indexOf(t);
          const cx = xOf(laneIdx);
          const routeColors = ["#e05c6e", "#4a9dff", "#3ddc9d", "#f2a13c", "#c77dff", "#5cd0e0"];
          const routeColor = routeColors[laneIdx % routeColors.length];

          // Griffe als Kreis/Rechteck/Dreieck in der Route
          const holds: number[] = [];
          for (let y = wallBottom - 14; y > wallTop + 6; y -= 26 + ((laneIdx * 7) % 14)) {
            holds.push(y);
          }

          return (
            <g key={`route-${t.code}`}>
              {holds.map((y, i) => {
                const x = cx + swayOf(t.code, y);
                const r = 2 + ((laneIdx * 11 + i) % 2);
                const holdType = (laneIdx + i) % 3;

                if (holdType === 0) {
                  // Jug
                  return <circle key={i} cx={x} cy={y} r={r} fill={routeColor} opacity={0.72} />;
                } else if (holdType === 1) {
                  // Crimp
                  return <rect key={i} x={x - r} y={y - r * 0.62} width={r * 2} height={r * 1.24} rx={r * 0.5} fill={routeColor} opacity={0.72} />;
                } else {
                  // Sloper
                  return (
                    <path key={i} d={`M ${x - r} ${y + r * 0.7} L ${x} ${y - r} L ${x + r} ${y + r * 0.7} Z`} fill={routeColor} opacity={0.72} />
                  );
                }
              })}
            </g>
          );
        })}
      </g>

      {/* Überhang-Band (Crux) auf halber Höhe */}
      <defs>
        <linearGradient id="ovgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(20, 16, 25)" />
          <stop offset="100%" stopColor="rgb(29, 23, 34)" />
        </linearGradient>
        <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 14 L14 0" stroke="rgba(255, 110, 160, 0.08)" strokeWidth={1} />
        </pattern>
      </defs>

      {(() => {
        const ovY1 = wallBottom - 0.4 * (wallBottom - wallTop);
        const ovY2 = wallBottom - 0.55 * (wallBottom - wallTop);
        return (
          <g>
            <path d={`M ${wallLeft} ${ovY1} L ${wallRight} ${ovY1 - 14} L ${wallRight} ${ovY2 - 14} L ${wallLeft} ${ovY2} Z`} fill="url(#ovgrad)" stroke="rgba(70, 58, 82, 0.9)" strokeWidth={1.5} />
            <path d={`M ${wallLeft} ${ovY1} L ${wallRight} ${ovY1 - 14} L ${wallRight} ${ovY2 - 14} L ${wallLeft} ${ovY2} Z`} fill="url(#hatch)" />
            <text x={wallLeft + 10} y={ovY2 + 16} fontSize={9} fontWeight={800} fill="var(--nl-accent)" letterSpacing="2.5px" opacity={0.8} fontFamily="ui-monospace, monospace">
              ÜBERHANG · CRUX
            </text>
          </g>
        );
      })()}

      {/* Gipfel-Sims + Top-Out-Glocke oben */}
      <rect x={wallLeft - 8} y={wallTop - 20} width={wallRight - wallLeft + 16} height={20} rx={5} fill="rgb(59, 50, 68)" stroke="rgb(91, 79, 102)" strokeWidth={1.5} />
      <text x={wallLeft + 10} y={wallTop - 27} fontSize={9} fontWeight={800} fill="var(--nl-warn)" letterSpacing="2.5px" opacity={0.85} fontFamily="ui-monospace, monospace">
        GIPFEL · TOP-OUT 45 M
      </text>
      <text x={wallRight - 14} y={wallTop - 6} fontSize={13}>
        🔔
      </text>

      {/* Einstieg + Crashpads unten */}
      <line x1={wallLeft} y1={wallBottom} x2={wallRight} y2={wallBottom} stroke="rgba(240, 243, 248, 0.2)" strokeWidth={1.5} />
      <text x={wallLeft + 10} y={wallBottom + 14} fontSize={8.5} fontWeight={800} fill="rgba(240, 243, 248, 0.4)" letterSpacing="2px" fontFamily="ui-monospace, monospace">
        EINSTIEG · 0 M
      </text>

      {(() => {
        const padColors = ["#27436b", "#1f3355", "#2c4a76"];
        const padCount = Math.ceil((wallRight - wallLeft) / 88);
        return (
          <g>
            {Array.from({ length: padCount }).map((_, i) => {
              const x = wallLeft + i * 88;
              const w = Math.min(88, wallRight - x);
              return (
                <g key={i}>
                  <rect x={x} y={wallBottom + 18} width={w - 5} height={34} rx={7} fill={padColors[i % 3]} />
                  <rect x={x} y={wallBottom + 18} width={w - 5} height={9} rx={4} fill="rgba(255, 255, 255, 0.08)" />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* === Token: Kletterer === */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const hue = hueForIdx(t.idx);
          const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205, 127, 50)" : null;
          const glowing = t.glowUntil > now;
          const rc = relColor(t.rel);

          // Defensive Startposition (falls die rAF-Schleife noch nicht getickt hat):
          // dichte Bahn horizontal, Score → Höhe. Die rAF gleitet danach weiter.
          const x0 = xOf(t.laneIdx) + swayOf(t.code, yOf(t.displayScore ?? t.score));
          const y0 = yOf(t.displayScore ?? t.score);
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              transform={`translate(${x0} ${y0})`}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Glow-Ring beim Führenden */}
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}

              {/* Beziehungs-Rahmen (mine/ally/rival) */}
              {rc ? <circle r={r + 5.5} fill="none" stroke={rc} strokeWidth={2.4} opacity={0.95} /> : null}

              {/* Medaillen-Ringe (Top-3) */}
              {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}

              {/* Seil nach unten (visuell) */}
              <line x1={0} y1={r} x2={0} y2={r + 11} stroke="rgba(230, 236, 244, 0.3)" strokeWidth={1.5} opacity={0.6} />

              {/* Logo oder Farb-Kreis */}
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
              )}

              {/* Kreis-Rahmen */}
              <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255, 255, 255, 0.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />

              {/* Krone (Champion) */}
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}

              {/* Team-Code label (nur eigenes Team) */}
              {t.isOwn ? (
                <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">
                  ★ {t.code}
                </text>
              ) : null}
            </g>
          );
        })}

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={env ? env.line : skinAccent} opacity={env ? 0.75 : 0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}
    </>
  );
}
