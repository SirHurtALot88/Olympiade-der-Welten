// =====================================================================================
// bump (Spurt) — 100m-Flutlicht-Gerade mit 32 Bahnen, rAF-Glide, Fotofinish.
//
// Bewegung: pro Runde ein durchgehendes, weiches rAF-Gleiten ENTLANG der Geraden
// (X-Richtung). Score bleibt Wahrheit. Dynamischer Easing pro Token (explosives
// Ease-out, realistisches Sprint-Gefühl). Hover friert ein. reduced-motion instant.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";

type Glide = { x: number; fromX: number; toX: number; glideT: number; gamma: number; target: number };

function easedPow(t: number, gamma: number): number {
  return Math.pow(Math.max(0, Math.min(1, t)), gamma);
}

export default function BumpField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    geo,
    finalMax,
    rt,
    sorted,
    now,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;

  const glideRef = useRef<Map<number, Glide>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // Geometrie der 100m-Geraden (wie Mockup: LW=880, LH=680).
  const LW = W;
  const LH = H;
  const TR_T = (118 / 680) * LH; // Bahn-Top
  const TR_B = (566 / 680) * LH; // Bahn-Bottom
  const X0 = (118 / 880) * LW; // Startlinie
  const X1 = (792 / 880) * LW; // Ziellinie
  const LANES = 32;
  const LANE_H = (TR_B - TR_T) / LANES;

  const laneY = (i: number): number => TR_T + (i + 0.5) * LANE_H;

  // Ziel-X für einen Score.
  const fracX = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    return X0 + (0.015 + norm * 0.985) * (X1 - X0);
  };

  // Runden-Erkennung: neuer Glide wenn displayScore sich ändert.
  const syncTargets = (): void => {
    const g = glideRef.current;
    for (const t of rtRef.current) {
      const target = fracX(t.displayScore);
      let st = g.get(t.idx);
      if (!st) {
        st = { x: X0, fromX: X0, toX: target, glideT: 1, gamma: 1, target };
        g.set(t.idx, st);
      }
      if (Math.abs(target - st.target) > 0.001) {
        st.fromX = st.x;
        st.toX = target;
        st.glideT = 0;
        st.gamma = 0.4 + Math.random() * 1.2; // explosiv, Sprint-ähnlich
        st.target = target;
      }
    }
  };

  // rAF-Schleife: gleitet alle Token simultan über ROUND_MS in X-Richtung.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const ROUND_MS = 5000;
    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;
      syncTargets();
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const g = glideRef.current;
      for (const t of rtRef.current) {
        const st = g.get(t.idx);
        if (!st) continue;
        if (reduce) {
          st.x = st.toX;
          st.glideT = 1;
        } else if (!frozen && st.glideT < 1) {
          st.glideT = Math.min(1, st.glideT + dt / ROUND_MS);
          st.x = st.fromX + (st.toX - st.fromX) * easedPow(st.glideT, st.gamma);
        }
        const el = gRefs.current.get(t.idx);
        if (el) {
          const y = laneY(t.laneIdx);
          const lean = Math.max(0, (st.glideT - 0.3) / 0.7) * 12; // Neigung nach vorn beim Sprint
          el.setAttribute("transform", `translate(${st.x} ${y}) skewX(${-lean})`);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feldkunst-Helfer aus dem Mockup.
  const windPanel = (): string => {
    const WG_T = (606 / 680) * LH;
    const WG_B = (662 / 680) * LH;
    const GX0 = X0 + (40 / 880) * LW;
    const GX1 = X1 - (40 / 880) * LW;
    const WMIN = -2;
    const WMAX = 3;
    const gx = (w: number): number => GX0 + ((w - WMIN) / (WMAX - WMIN)) * (GX1 - GX0);

    let s = `<rect x="${X0 - (16 / 880) * LW}" y="${WG_T}" width="${
      (X1 - X0 + (52 / 880) * LW).toFixed(1)
    }" height="${(WG_B - WG_T).toFixed(1)}" rx="8" fill="rgba(8,15,17,.6)" stroke="#1e3a40" stroke-width="1"/>`;
    s += `<text x="${(X0 - (4 / 880) * LW).toFixed(1)}" y="${(WG_T + (15 / 680) * LH).toFixed(1)}" font-family="ui-monospace,Menlo,monospace" font-size="8" font-weight="800" letter-spacing="2" fill="#41d9e6" opacity=".9">WINDMESSER · M/S</text>`;
    s += `<path d="M ${GX0.toFixed(1)} ${(WG_T + (34 / 680) * LH).toFixed(1)} H ${GX1.toFixed(1)}" stroke="#2a4a52" stroke-width="2"/>`;

    for (let w = WMIN; w <= WMAX; w++) {
      const x = gx(w);
      s += `<path d="M ${x.toFixed(1)} ${(WG_T + (29 / 680) * LH).toFixed(1)} V ${(WG_T + (39 / 680) * LH).toFixed(1)}" stroke="${
        w === 0 ? "#e9ecf2" : "#2a4a52"
      }" stroke-width="${w === 0 ? 2 : 1.2}"/>`;
      s += `<text x="${x.toFixed(1)}" y="${(WG_T + (50 / 680) * LH).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="7" font-weight="800" fill="rgba(240,244,250,.45)">${
        w > 0 ? "+" + w : w
      }</text>`;
    }

    s += `<rect x="${(GX1 + (18 / 880) * LW).toFixed(1)}" y="${(WG_T + (14 / 680) * LH).toFixed(1)}" width="2.5" height="${(32 / 680 * LH).toFixed(1)}" fill="#39404d"/>`;
    s += `<g id="sockg"><path id="sock" d="M ${(GX1 + (20 / 880) * LW).toFixed(1)} ${(WG_T + (16 / 680) * LH).toFixed(1)} l 26 3 l 0 6 l -26 3 Z" fill="#ff8a5c" opacity=".85"/></g>`;

    return s;
  };

  return (
    <>
      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
        <linearGradient id="tartanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a3427" />
          <stop offset="50%" stopColor="#7c2d22" />
          <stop offset="100%" stopColor="#6b271e" />
        </linearGradient>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#131b30" />
          <stop offset="100%" stopColor="#33203a" />
        </linearGradient>
        <pattern id="grain" width="90" height="60" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="18" r="1" fill="rgba(255,255,255,.05)" />
          <circle cx="52" cy="40" r="1.2" fill="rgba(0,0,0,.25)" />
          <circle cx="76" cy="12" r="1" fill="rgba(255,255,255,.04)" />
          <circle cx="30" cy="52" r="1.1" fill="rgba(0,0,0,.2)" />
        </pattern>
      </defs>

      {/* Himmel + Tribüne + Flutlichter */}
      <rect x={0} y={0} width={LW} height={(104 / 680) * LH} fill="url(#skyGrad)" />
      <text
        x={LW / 2}
        y={(34 / 680) * LH}
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={(17 / 680) * LH}
        letterSpacing={(5 / 880) * LW}
        fill="#e9dcc2"
        opacity={0.38}
      >
        100 M SPRINT · FLUTLICHT-NACHT
      </text>

      {/* Flutlicht-Masten */}
      {Array.from({ length: 4 }).map((_, i) => {
        const x = (90 / 880) * LW + (i * ((LW - 180 / 880 * LW) / 3));
        return (
          <g key={`light-${i}`}>
            <rect x={x - (2 / 880) * LW} y={(16 / 680) * LH} width={(4 / 880) * LW} height={(34 / 680) * LH} fill="#39404d" />
            <rect x={x - (16 / 880) * LW} y={(10 / 680) * LH} width={(32 / 880) * LW} height={(9 / 680) * LH} rx={(3 / 880) * LW} fill="#1c222c" stroke="#4d5866" strokeWidth={1} />
            {Array.from({ length: 4 }).map((_, j) => (
              <circle
                key={`bulb-${i}-${j}`}
                cx={x - (10 / 880) * LW + j * (6.7 / 880) * LW}
                cy={(14.5 / 680) * LH}
                r={(2.1 / 680) * LH}
                fill="#fdf6d8"
                opacity={0.9}
              />
            ))}
          </g>
        );
      })}

      {/* Innenraum + Tartan */}
      <rect x={0} y={(104 / 680) * LH} width={LW} height={(TR_T - (104 / 680) * LH)} fill="#231a16" />
      <rect x={0} y={TR_T} width={LW} height={TR_B - TR_T} fill="url(#tartanGrad)" />
      <rect x={0} y={TR_T} width={LW} height={TR_B - TR_T} fill="url(#grain)" />

      {/* Bahnen + Nummern */}
      {Array.from({ length: LANES + 1 }).map((_, i) => {
        const y = TR_T + i * LANE_H;
        return (
          <path
            key={`lane-line-${i}`}
            d={`M 14 ${y.toFixed(1)} H ${(LW - 14).toFixed(1)}`}
            stroke={`rgba(240,244,250,${i % 8 === 0 ? ".34" : ".16"})`}
            strokeWidth={i % 8 === 0 ? 1.4 : 1}
          />
        );
      })}
      {Array.from({ length: LANES }).map((_, k) => (
        <g key={`lane-${k}`}>
          {k % 2 === 0 && (
            <rect x={14} y={TR_T + k * LANE_H} width={LW - 28} height={LANE_H} fill="rgba(255,255,255,.022)" />
          )}
          <text
            x={(24 / 880) * LW}
            y={(laneY(k) + (2.2 / 680) * LH).toFixed(1)}
            fontFamily="ui-monospace,Menlo,monospace"
            fontSize={(6 / 680) * LH}
            fontWeight={800}
            fill="rgba(240,244,250,.4)"
          >
            {k + 1}
          </text>
        </g>
      ))}

      {/* Startblöcke */}
      {Array.from({ length: LANES }).map((_, k) => {
        const y = laneY(k);
        return (
          <path
            key={`block-${k}`}
            d={`M ${(X0 - (13 / 880) * LW).toFixed(1)} ${(y + (3.5 / 680) * LH).toFixed(1)} L ${(X0 - (3 / 880) * LW).toFixed(1)} ${(y + (3.5 / 680) * LH).toFixed(1)} L ${(X0 - (3 / 880) * LW).toFixed(1)} ${(y - (3.5 / 680) * LH).toFixed(1)} Z`}
            fill="#1a1e26"
            stroke="#4d5866"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Startlinie + Schild */}
      <path d={`M ${X0.toFixed(1)} ${TR_T.toFixed(1)} V ${TR_B.toFixed(1)}`} stroke="#e9ecf2" strokeWidth={3} opacity={0.8} />
      <rect
        x={(X0 - (48 / 880) * LW).toFixed(1)}
        y={(TR_T - (26 / 680) * LH).toFixed(1)}
        width={(44 / 880) * LW}
        height={(16 / 680) * LH}
        rx={(3 / 880) * LW}
        fill="#2a1410"
        stroke="#f6c750"
        strokeWidth={1}
      />
      <text
        x={(X0 - (26 / 880) * LW).toFixed(1)}
        y={(TR_T - (14 / 680) * LH).toFixed(1)}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={(9.5 / 680) * LH}
        fontWeight={800}
        fill="#f6c750"
      >
        START
      </text>

      {/* Zwischenmarken (25m, 50m, 75m) */}
      {[0.25, 0.5, 0.75].map((fr, i) => {
        const x = X0 + fr * (X1 - X0);
        const labels = ["25 m", "50 m", "75 m"];
        return (
          <g key={`mark-${i}`}>
            <path d={`M ${x.toFixed(1)} ${(TR_T + 4).toFixed(1)} V ${(TR_B - 4).toFixed(1)}`} stroke="rgba(240,244,250,.13)" strokeWidth={1.5} strokeDasharray="4 8" />
            <rect
              x={(x - (17 / 880) * LW).toFixed(1)}
              y={(TR_T - (16 / 680) * LH).toFixed(1)}
              width={(34 / 880) * LW}
              height={(12 / 680) * LH}
              rx={(3 / 880) * LW}
              fill="#221514"
              stroke="#4d3a34"
              strokeWidth={1}
            />
            <text
              x={x.toFixed(1)}
              y={(TR_T - (7 / 680) * LH).toFixed(1)}
              textAnchor="middle"
              fontFamily="ui-monospace,Menlo,monospace"
              fontSize={(8 / 680) * LH}
              fontWeight={800}
              fill="rgba(240,244,250,.55)"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}

      {/* Zielkammer: karierte Linie + Häuschen */}
      {Array.from({ length: Math.ceil((TR_B - TR_T) / 8) }).map((_, i) =>
        Array.from({ length: 2 }).map((_, j) => {
          const col = (i + j) % 2 ? "#10141a" : "#e9ecf2";
          const rx = X1 + j * 8;
          const ry = TR_T + i * 8;
          const h = Math.min(8, TR_B - ry);
          return <rect key={`checker-${i}-${j}`} x={rx} y={ry} width={8} height={h} fill={col} />;
        }),
      )}

      <rect
        x={(X1 - (15 / 880) * LW).toFixed(1)}
        y={(TR_T - (30 / 680) * LH).toFixed(1)}
        width={(62 / 880) * LW}
        height={(18 / 680) * LH}
        rx={(3 / 880) * LW}
        fill="#0c2226"
        stroke="#41d9e6"
        strokeWidth={1}
      />
      <text
        x={(X1 + (16 / 880) * LW).toFixed(1)}
        y={(TR_T - (17 / 680) * LH).toFixed(1)}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={(8.5 / 680) * LH}
        fontWeight={800}
        fill="#5ee9f5"
      >
        📸 ZIEL 100M
      </text>

      {/* Rasenkante + Windmesser */}
      <rect x={0} y={TR_B} width={LW} height={(62 - (566 / 680) * LH) * LH} fill="#1c1512" />
      <g dangerouslySetInnerHTML={{ __html: windPanel() }} />

      {/* Fotofinish-Lichtschranke (Ziel-Marker) */}
      <line x1={(X1 + 2).toFixed(1)} y1={TR_T.toFixed(1)} x2={(X1 + 2).toFixed(1)} y2={TR_B.toFixed(1)} stroke="rgba(94,233,245,.5)" strokeWidth={3} opacity={0.7} style={{ animation: reducedMotion ? "none" : "pulse 2.4s ease-in-out infinite" }} />

      {/* Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Token — Position imperativ via rAF (transform), Marker per Reveal. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const hue = hueForIdx(t.idx);
          const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
          const glowing = t.glowUntil > now;
          const rc = relColor(t.rel);
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {rc ? <circle r={r + 5.5} fill="none" stroke={rc} strokeWidth={2.4} opacity={0.95} /> : null}
              {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
              )}
              <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
              {t.isOwn ? (
                <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">
                  ★ {t.code}
                </text>
              ) : null}
            </g>
          );
        })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
