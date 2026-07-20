// =====================================================================================
// track (Staffel) — PILOT · 1:1 aus scratchpad/staffel-oval.html rebuildet.
//
// Bewegung: pro Runde EIN durchgehendes, weiches rAF-Gleiten ENTLANG des Ovals
// (Arc-Length, folgt der Kurve statt CSS-Sehne quer übers Innenfeld). Dynamisches,
// per-Token-variierendes Easing (pow(t, gamma)) → nicht konstante Geschwindigkeit,
// etwas Renn-Spannung. Hover friert die Bewegung ein (wie im Mockup). reduced-motion
// setzt sofort auf die Zielposition.
//
// Score bleibt Wahrheit: Zielposition = displayScore/finalMax auf dem Oval (identisch
// zu host.tokenPos für track → Pops/Hovercard/Ladder bleiben konsistent). Medaillen-
// Ringe, Beziehungs-Rahmen, Führungs-Glow, Krone, Ampel, Endstand: unverändert.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";

type Glide = { len: number; fromLen: number; toLen: number; glideT: number; gamma: number; target: number };

// Deterministisch-variierendes Easing pro Token/Runde (Renn-Spannung): pow(t, gamma).
function easedPow(t: number, gamma: number): number {
  return Math.pow(Math.max(0, Math.min(1, t)), gamma);
}

export default function TrackField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    geo,
    finalMax,
    makeOval,
    ovalPath,
    OVAL_M,
    OVAL_BAND,
    pathRef,
    rt,
    sorted,
    now,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    handoffActive,
  } = props;

  // Per-Token-Gleit-Zustand (idx → Glide) und die DOM-<g>-Refs (imperative Bewegung).
  const glideRef = useRef<Map<number, Glide>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  // Frische Prop-Spiegel für die rAF-Schleife (ohne Neustart).
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // Zielposition (Arc-Length) für einen kumulierten Score — identisch zu host.tokenPos.
  const fracLen = (score: number, PER: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    return (0.015 + norm * 0.985) * PER;
  };

  // Punkt + Quer-Versatz auf dem Oval (gleiche Lane-Auffächerung wie der Host).
  const placeAt = (t: RT, len: number, PER: number): { x: number; y: number } => {
    const path = pathRef.current;
    if (!path || PER === 0) return { x: W / 2, y: 70 };
    const L = Math.max(0, Math.min(PER, len));
    const pt = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(PER, L + 2));
    let tx = p2.x - pt.x;
    let ty = p2.y - pt.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const lane = (t.laneIdx % 6) - 2.5;
    const off = lane * 8.5;
    return { x: pt.x + -ty * off, y: pt.y + tx * off };
  };

  // Runden-Erkennung: sobald sich das displayScore-Ziel eines Tokens ändert, startet
  // EIN neuer Glide über den vollen Rundenbetrag (fromLen = aktuelle Position).
  const syncTargets = (PER: number): void => {
    const g = glideRef.current;
    for (const t of rtRef.current) {
      const target = fracLen(t.displayScore, PER);
      let st = g.get(t.idx);
      if (!st) {
        // Initial: direkt an der Startlinie sitzen (kein Auf-Sprung).
        st = { len: fracLen(0, PER), fromLen: fracLen(0, PER), toLen: target, glideT: 1, gamma: 1, target };
        g.set(t.idx, st);
      }
      if (Math.abs(target - st.target) > 0.001) {
        st.fromLen = st.len;
        st.toLen = target;
        st.glideT = 0;
        st.gamma = 0.62 + Math.random() * 1.05; // dynamisches Easing je Runde/Token
        st.target = target;
      }
    }
  };

  // rAF-Schleife: gleitet alle Token simultan über ROUND_MS, positioniert die <g>
  // imperativ (kein React-Re-Render pro Frame → smooth). Hover friert ein.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const ROUND_MS = 5000;
    const tick = (ts: number) => {
      const path = pathRef.current;
      const PER = path ? path.getTotalLength() : 0;
      const dt = Math.min(64, ts - last);
      last = ts;
      if (PER > 0) {
        syncTargets(PER);
        const frozen = hoverRef.current != null || pausedRef.current;
        const reduce = reducedRef.current;
        const g = glideRef.current;
        for (const t of rtRef.current) {
          const st = g.get(t.idx);
          if (!st) continue;
          if (reduce) {
            st.len = st.toLen;
            st.glideT = 1;
          } else if (!frozen && st.glideT < 1) {
            st.glideT = Math.min(1, st.glideT + dt / ROUND_MS);
            st.len = st.fromLen + (st.toLen - st.fromLen) * easedPow(st.glideT, st.gamma);
          }
          const el = gRefs.current.get(t.idx);
          if (el) {
            const p = placeAt(t, st.len, PER);
            el.setAttribute("transform", `translate(${p.x} ${p.y})`);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rendern (nur bei force()/Reveal): Feldkunst + Token-Marker. Position der Token
  // setzt die rAF-Schleife imperativ; die JSX-Marker (Ringe/Medaillen/Krone) ziehen
  // per Reveal nach.
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
            {env.infield ? (
              <>
                <linearGradient id="envInfield" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={env.infield[0]} />
                  <stop offset="100%" stopColor={env.infield[1]} />
                </linearGradient>
                <clipPath id="envInfieldClip">
                  <path d={makeOval(OVAL_M + OVAL_BAND / 2)} />
                </clipPath>
              </>
            ) : null}
          </>
        ) : null}
      </defs>

      {env ? (
        <>
          <rect x={0} y={0} width={W} height={H} fill="url(#envSky)" />
          <path d={ovalPath} fill="none" stroke={env.stands} strokeWidth={OVAL_BAND + 30} />
          <path d={ovalPath} fill="none" stroke="url(#envSurface)" strokeWidth={OVAL_BAND} />
          <path d={makeOval(OVAL_M - 18)} fill="none" stroke={env.line} strokeWidth={1.4} opacity={0.35} />
          <path d={makeOval(OVAL_M + 18)} fill="none" stroke={env.line} strokeWidth={1.4} opacity={0.35} />
          {env.infield ? (
            <>
              <path d={makeOval(OVAL_M + OVAL_BAND / 2)} fill="url(#envInfield)" stroke="none" />
              <g clipPath="url(#envInfieldClip)">
                {Array.from({ length: Math.ceil(W / 46) }).map((_, i) => (
                  <rect key={i} x={i * 46} y={0} width={23} height={H} fill="rgba(0,0,0,0.08)" />
                ))}
              </g>
            </>
          ) : null}
          {(() => {
            const r = (H - 2 * OVAL_M) / 2;
            const sx = OVAL_M + r;
            const yTop = OVAL_M - OVAL_BAND / 2;
            const rows = Math.max(2, Math.round(OVAL_BAND / 8));
            const sq = OVAL_BAND / rows;
            const dark = "rgba(0,0,0,0.6)";
            return (
              <g>
                {Array.from({ length: rows }).map((_, i) => (
                  <g key={i}>
                    <rect x={sx - sq} y={yTop + i * sq} width={sq} height={sq} fill={i % 2 === 0 ? env.line : dark} />
                    <rect x={sx} y={yTop + i * sq} width={sq} height={sq} fill={i % 2 === 0 ? dark : env.line} />
                  </g>
                ))}
                <rect x={sx - sq} y={yTop} width={sq * 2} height={OVAL_BAND} fill="none" stroke={env.line} strokeWidth={0.8} opacity={0.5} />
                <text x={sx} y={yTop - 7} textAnchor="middle" fontFamily="Georgia, serif" fontSize={15} fontWeight={800} letterSpacing="0.12em" fill={env.line} opacity={0.92}>
                  ZIEL
                </text>
              </g>
            );
          })()}
        </>
      ) : (
        <>
          <path d={ovalPath} fill="none" stroke="var(--nl-panel)" strokeWidth={54} />
          <path d={ovalPath} fill="none" stroke={skinAccent} opacity={0.7} strokeWidth={2} strokeDasharray="6 8" />
        </>
      )}

      {/* Mess-Pfad (unsichtbar) — Host.tokenPos + diese rAF-Schleife lesen ihn. */}
      <path ref={pathRef} d={ovalPath} fill="none" stroke="none" />

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={env ? env.line : skinAccent} opacity={env ? 0.75 : 0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Token — Position imperativ via rAF (transform), Marker per Reveal. In Rang-
          Reihenfolge rückwärts, damit der Führende oben liegt (wie der Host). */}
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
              {/* Staffelstab-Übergabe (FEATURE 1): kurzer Funke (Strich + →) auf der Vorderkante
                  des Tokens, der beim Etappen-Glide nach vorn gereicht wird. Eigenes Team heller
                  (Akzent), andere gedämpft. Token-lokal, kollidiert nicht mit dem späteren,
                  gestaffelten Spotlight/Flash. Reduced-Motion: der Host liefert handoffActive=false. */}
              {!reducedMotion && handoffActive ? (
                <g transform={`translate(${r + 3} 0)`} style={{ animation: "olyHandoff 600ms ease-out" }} opacity={t.isOwn ? 1 : 0.7}>
                  <line x1={0} y1={0} x2={9} y2={0} stroke={t.isOwn ? "var(--nl-accent)" : "var(--nl-warn)"} strokeWidth={2.6} strokeLinecap="round" />
                  <text x={13} y={0} dominantBaseline="central" fontSize={11} fontWeight={900} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-warn)"}>→</text>
                </g>
              ) : null}
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
    </>
  );
}
