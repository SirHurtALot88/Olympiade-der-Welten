// =====================================================================================
// spybar (I-Spy · Späh-Zentrale) — Nachtsicht-Späh-Zentrale 1:1 aus ispy.html
//
// Feld: dunkler Sektor mit Radar-Ringen, rotierendem Scan-Sweep, Späher als Scope-Blips,
// Sichtkegel je Token, versteckte Ziele, „Nebel des Unbekannten" der zurückweicht,
// Späh-Balken hinter jedem Token, Fund-🔍-FX, Bewegung → Score (kumuliert).
//
// Contract: rt, sorted, tokenPos, round, done, now + FX-Hooks (addPop, fireFlash, doShake).
// Interaktion: openHover, hoverIdx friert Bewegung ein.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT, Vec2 } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

// Geometry constants für I-Spy (im Sektor skaliert)
const FIELD_W = 900;
const FIELD_H = 640;
const X_START = 96; // Spahposten-Linie (0%)
const X_END = 846; // Zielkartei (100%)
const TOP_LANE = 110;
const BOT_LANE = 592;
const CENTER_X = FIELD_W / 2;
const CENTER_Y = (TOP_LANE + BOT_LANE) / 2;
const TARGET_N = 40; // Ziele im Sektor
const ROUND_MS = 5000;
// Deutlich größere, lesbare Späher-Token (Host-geo.r war zu klein). Eigenes Team etwas größer.
const R_BASE = 18;
const R_OWN = 22;

// Phosphor-grüne Farb-Palette (aus mockup)
const COLORS = {
  bg: "#070b09",
  panel: "#101613",
  line: "#22302a",
  ink: "#edf5f0",
  acc: "#3fe08b", // Phosphor-grün
  mine: "#4a9dff",
  ally: "#46c98a",
  rival: "#f0503c",
  lead: "#f6c750",
};

export default function SpybarField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    geo,
    finalMax,
    rt,
    sorted,
    round,
    done,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;

  const trioSet = new Set(highlightIdxs ?? []);

  // Lokaler tokenPos in der GEZEICHNETEN Sektor-Geometrie (X_START…X_END, Lane = t.idx),
  // damit Token, Späh-Balken und Ziele exakt übereinanderliegen. Der Host-tokenPos nutzt
  // eine andere ROW_FAMILY-Geometrie (volle Breite, andere Lane-Höhe) → wäre versetzt.
  // Speist Glide + Ghost, damit beide der Sektor-Choreografie folgen.
  const localTokenPos = (t: RT, score: number): Vec2 => {
    const norm = finalMax > 0 ? Math.min(1, Math.max(0, score / finalMax)) : 0;
    const pitch = (BOT_LANE - TOP_LANE) / Math.max(1, rt.length - 1);
    return { x: X_START + (X_END - X_START) * norm, y: TOP_LANE + pitch * t.idx };
  };
  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync, Hover/Pause friert ein).
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos: localTokenPos });

  // Späh-Balken (bespoke rAF, unten) — folgen dem Token via animScore.
  const beamGRefs = useRef<Map<number, SVGLineElement | null>>(new Map());

  // Frische Prop-Spiegel für rAF
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<typeof rt>(rt);
  rtRef.current = rt;
  const finalMaxRef = useRef<number>(finalMax);
  finalMaxRef.current = finalMax;

  // Zielposition X für einen Score
  const xOfScore = (score: number): number => {
    const fm = finalMaxRef.current;
    // Non-finiter Score (z.B. displayScore vor dem ersten Reveal = undefined)
    // MUSS abgefangen werden — sonst propagiert NaN durch die Glide-State und
    // erzeugt `translate(NaN …)` / `<line> x2: NaN` in jedem Frame.
    // fm (finalMax) MUSS ebenfalls finit geprüft werden: bei fm = NaN wäre
    // `fm <= 0` false → score/NaN = NaN würde durchrutschen (Mock ohne finalMax).
    if (!Number.isFinite(score) || !Number.isFinite(fm) || fm <= 0) return X_START;
    const norm = Math.min(1, Math.max(0, score / fm));
    return X_START + (X_END - X_START) * norm;
  };

  // Y-Position für Lane i
  const yOfLane = (i: number): number => {
    const pitch = (BOT_LANE - TOP_LANE) / Math.max(1, rtRef.current.length - 1);
    return TOP_LANE + pitch * i;
  };

  // rAF-Schleife (Benchmark-Sync): der Späh-Balken folgt dem Token — Länge = animScore-
  // Position minus Start. Token selbst positioniert useTokenGlide (gleiche localTokenPos);
  // Hover/Pause friert beides ein.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frozen = hoverRef.current != null || pausedRef.current;
      if (!frozen) {
        for (const t of rtRef.current) {
          const beam = beamGRefs.current.get(t.idx);
          if (beam) {
            const y = yOfLane(t.idx);
            // Nur ein KURZER Kometenschweif hinter dem Token (nicht die volle Linie ab der
            // Startlinie) → liest sich als Bewegung, nicht als vorgezeichnete Bahn/Spoiler.
            const tx = xOfScore(t.animScore);
            const TAIL = 62;
            beam.setAttribute("x1", `${Math.max(X_START, tx - TAIL)}`);
            beam.setAttribute("y1", `${y}`);
            beam.setAttribute("x2", `${tx}`);
            beam.setAttribute("y2", `${y}`);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Berechne Nebel-Position (weicht mit bestem Späher zurück)
  let maxX = X_START;
  for (const t of rt) {
    const x = xOfScore(t.displayScore);
    if (x > maxX) maxX = x;
  }
  const fogX = Math.min(X_END - 40, maxX + 30);

  // Die Sektor-Szene ist für FIELD_W×FIELD_H (900×640) gezeichnet, die echte viewBox ist
  // aber 1180×640 → ohne Korrektur sitzt alles links, „100%" bei 72% Breite, Titel nicht
  // zentriert. Uniform skalieren (Radar bleibt rund) + horizontal zentrieren.
  const sceneS = Math.min(W / FIELD_W, H / FIELD_H);
  const sceneTX = (W - FIELD_W * sceneS) / 2;
  const sceneTY = (H - FIELD_H * sceneS) / 2;

  return (
    <g transform={`translate(${sceneTX} ${sceneTY}) scale(${sceneS})`}>
      {/* Defs: Gradienten, Pattern, Clip-Paths */}
      <defs>
        {/* Team-Logos clipPath */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? R_OWN : R_BASE} />
            </clipPath>
          ) : null,
        )}

        {/* Scan-Pattern (Gitter-Overlay) */}
        <pattern id="scanl" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 0 H4" stroke="rgba(63,224,139,.028)" strokeWidth="1" />
        </pattern>

        {/* Umgebungs-Gradienten (falls env vorhanden) */}
        {env ? (
          <>
            <linearGradient id="envSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={env.sky[0]} />
              <stop offset="100%" stopColor={env.sky[1]} />
            </linearGradient>
          </>
        ) : null}
      </defs>

      {/* Hintergrund — VOLL die echte viewBox decken (die Gruppe ist verschoben/skaliert,
          also die Deck-Box in Szenen-Koordinaten zurückrechnen, sonst bleiben Ränder leer). */}
      {(() => {
        const bx = -sceneTX / sceneS;
        const by = -sceneTY / sceneS;
        const bw = W / sceneS;
        const bh = H / sceneS;
        return env ? (
          <rect x={bx} y={by} width={bw} height={bh} fill="url(#envSky)" />
        ) : (
          <rect x={bx} y={by} width={bw} height={bh} fill={COLORS.bg} />
        );
      })()}

      {/* Titel + Status-Text */}
      <text
        x={FIELD_W / 2}
        y={26}
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={17}
        letterSpacing={5}
        fill="#bfe3cd"
        opacity={0.38}
      >
        I-SPY · SPÄH-ZENTRALE · SEKTOR 07
      </text>
      <text
        x={FIELD_W / 2}
        y={44}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={8.5}
        letterSpacing={3}
        fill="rgba(63,224,139,.4)"
      >
        ● NACHTSICHT AKTIV · SIGNAL STABIL
      </text>

      {/* Scan-Gitter-Overlay */}
      <rect
        x={X_START - 8}
        y={TOP_LANE - 14}
        width={X_END - X_START + 16}
        height={BOT_LANE - TOP_LANE + 28}
        fill="url(#scanl)"
      />

      {/* Radar-Ringe (konzentrische Kreise) */}
      {[90, 170, 250, 330].map((r) => (
        <circle
          key={`ring-${r}`}
          cx={CENTER_X}
          cy={CENTER_Y}
          r={r}
          fill="none"
          stroke="rgba(63,224,139,.055)"
          strokeWidth={1}
        />
      ))}

      {/* Radar-Kreuzachsen */}
      <path
        d={`M ${CENTER_X - 340} ${CENTER_Y} H ${CENTER_X + 340}`}
        stroke="rgba(63,224,139,.05)"
        strokeWidth={1}
      />
      <path
        d={`M ${CENTER_X} ${CENTER_Y - 260} V ${CENTER_Y + 260}`}
        stroke="rgba(63,224,139,.05)"
        strokeWidth={1}
      />
      <circle cx={CENTER_X} cy={CENTER_Y} r={2.5} fill="rgba(63,224,139,.25)" />

      {/* Prozent-Raster (10% bis 90%) */}
      {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => {
        const x = X_START + ((X_END - X_START) * p) / 100;
        return (
          <g key={`grid-${p}`}>
            <path
              d={`M ${x.toFixed(1)} ${TOP_LANE - 16} V ${BOT_LANE + 14}`}
              stroke="rgba(63,224,139,.07)"
              strokeWidth={1}
              strokeDasharray="3 9"
            />
            <text
              x={x.toFixed(1)}
              y={TOP_LANE - 22}
              textAnchor="middle"
              fontFamily="ui-monospace,Menlo,monospace"
              fontSize={8.5}
              fontWeight={800}
              fill="rgba(237,245,240,.30)"
            >
              {p}%
            </text>
          </g>
        );
      })}

      {/* Spahposten-Linie (links, 0%) */}
      <path
        d={`M ${X_START} ${TOP_LANE - 16} V ${BOT_LANE + 14}`}
        stroke="rgba(237,245,240,.22)"
        strokeWidth={1.5}
      />

      {/* Spahposten-Marker (Pfosten-Icons links) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const y = TOP_LANE + 8 + (i * (BOT_LANE - TOP_LANE - 16)) / 7;
        return (
          <g key={`post-${i}`}>
            <path
              d={`M ${(X_START - 30).toFixed(1)} ${(y + 6).toFixed(1)} L ${(X_START - 24).toFixed(1)} ${(y - 7).toFixed(1)} L ${(X_START - 18).toFixed(1)} ${(y + 6).toFixed(1)} Z`}
              fill="rgba(147,165,155,.16)"
            />
            <circle
              cx={X_START - 24}
              cy={(y - 9).toFixed(1)}
              r={1.5}
              fill="rgba(63,224,139,.35)"
            />
          </g>
        );
      })}

      {/* Zielkartei-Linie (rechts, 100%) */}
      <path
        d={`M ${X_END} ${TOP_LANE - 16} V ${BOT_LANE + 14}`}
        stroke={COLORS.lead}
        strokeWidth={2}
        opacity={0.7}
        strokeDasharray="10 7"
      />

      {/* Zielkartei-Dossiers (rechts, Gold-Deko) */}
      {[0, 1, 2].map((i) => {
        const y = CENTER_Y - 56 + i * 40;
        return (
          <g key={`dossier-${i}`}>
            <rect
              x={X_END + 16}
              y={y}
              width={34}
              height={26}
              rx={3}
              fill="rgba(246,199,80,.06)"
              stroke="rgba(246,199,80,.22)"
              strokeWidth={1}
            />
            <rect
              x={X_END + 16}
              y={y - 5}
              width={14}
              height={6}
              rx={2}
              fill="rgba(246,199,80,.14)"
            />
            <path
              d={`M ${X_END + 21} ${y + 9} h 24 M ${X_END + 21} ${y + 15} h 18`}
              stroke="rgba(246,199,80,.20)"
              strokeWidth={1.5}
            />
          </g>
        );
      })}

      {/* Zielkartei Label + Funk-Statusband */}
      <text
        x={X_END + 40}
        y={66}
        textAnchor="end"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={9}
        fontWeight={800}
        letterSpacing={2}
        fill={COLORS.lead}
        opacity={0.85}
      >
        ZIELKARTEI · 100% 🗂
      </text>
      <text
        x={X_START}
        y={BOT_LANE + 30}
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={8.5}
        fontWeight={800}
        letterSpacing={2}
        fill="rgba(147,165,155,.4)"
      >
        FUNK ▮▮▮ VERSCHLÜSSELT · KANAL 04 · ZIELE IM SEKTOR: {TARGET_N}
      </text>
      <text
        x={X_END}
        y={BOT_LANE + 30}
        textAnchor="end"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={8.5}
        fontWeight={800}
        letterSpacing={2}
        fill="rgba(255,93,93,.35)"
      >
        ■■ STRENG GEHEIM
      </text>

      {/* Radar-Sweep (rotierende conic-gradient Animation) */}
      <g style={{ animation: reducedMotion ? "none" : "spySweep 9s linear infinite" }}>
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={300}
          fill="none"
          stroke="rgba(63,224,139,.15)"
          strokeWidth={1}
          opacity={0.5}
          strokeDasharray="1,9"
          style={{ filter: "drop-shadow(0 0 12px rgba(63,224,139,.12))" }}
        />
      </g>

      {/* Späh-Balken (hinter jedem Token) — SVG-Lines */}
      {rt.map((t) => {
        const className = t.rel ? `beam b-${t.rel}` : "beam";
        const strokeColor =
          t.rel === "mine"
            ? "rgba(74,157,255,.5)"
            : t.rel === "ally"
              ? "rgba(70,201,138,.5)"
              : t.rel === "rival"
                ? "rgba(240,80,60,.5)"
                : "rgba(63,224,139,.34)";
        const isLead = sorted && sorted[0] && sorted[0].idx === t.idx;
        return (
          <line
            key={`beam-${t.code}`}
            ref={(el) => {
              beamGRefs.current.set(t.idx, el);
            }}
            x1={X_START}
            y1={yOfLane(t.idx)}
            x2={X_START}
            y2={yOfLane(t.idx)}
            stroke={isLead ? "rgba(246,199,80,.55)" : strokeColor}
            strokeWidth={isLead ? 3 : 2.5}
            strokeLinecap="round"
            opacity={0.8}
            pointerEvents="none"
          />
        );
      })}

      {/* Versteckte Ziele (Diamanten) */}
      {rt.map((t, teamIdx) => {
        return Array.from({ length: 4 }).map((_, targetIdx) => {
          // Hash-basierte x-Position (deterministisch)
          const seed = `${t.code}tg${targetIdx}`;
          let hash = 0;
          for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
          }
          hash = Math.abs(hash);
          const norm = (hash % 10000) / 10000;
          const x = X_START + 46 + norm * (X_END - X_START - 76);

          // Späher bewegt sich nach rechts → Ziel wird beim Erreichen des Runden-Ziels aufgeklärt.
          const tokenX = xOfScore(t.displayScore);
          const isHit = tokenX >= x - 4;

          return (
            <g
              key={`target-${t.code}-${targetIdx}`}
              transform={`translate(${x.toFixed(1)} ${yOfLane(teamIdx).toFixed(1)})`}
              opacity={isHit ? 1 : 0.8}
              style={{
                animation: isHit ? "targetFound 0.6s ease-out" : "none",
              }}
            >
              <rect
                x={-4}
                y={-4}
                width={8}
                height={8}
                fill={isHit ? COLORS.acc : "rgba(255,255,255,.03)"}
                stroke={isHit ? COLORS.acc : "rgba(200,216,206,.26)"}
                strokeWidth={1}
                rx={1.5}
                style={{
                  transform: "rotate(45deg)",
                  boxShadow: isHit ? `0 0 8px rgba(63,224,139,.75)` : "none",
                }}
              />
            </g>
          );
        });
      })}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Späher-Tokens. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens (Späher als Scope-Blips mit Sichtkegel) — Position via rAF (animScore) */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? R_OWN : R_BASE;
          const glowing = t.glowUntil > now;

          return (
            <g
              key={`token-${t.code}`}
              data-token-code={t.code}
              ref={tokenRef(gRefs, t, localTokenPos)}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Glow-Puls (Führender, bespoke) */}
              {glowing ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke={COLORS.lead}
                  strokeWidth={4}
                  style={{
                    animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite",
                  }}
                />
              ) : null}

              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} radius={r} />

              {/* Sichtkegel (::after im Mockup — Dreieck nach rechts, bespoke) */}
              <polygon
                points={`${r} 0, ${r + 12} -5, ${r + 12} 5`}
                fill={
                  t.rel === "mine"
                    ? "rgba(74,157,255,.17)"
                    : t.rel === "ally"
                      ? "rgba(70,201,138,.17)"
                      : t.rel === "rival"
                        ? "rgba(240,80,60,.17)"
                        : "rgba(63,224,139,.17)"
                }
              />
            </g>
          );
        })}

      {/* Nebel des Unbekannten (weicht mit bestem Späher zurück) */}
      <defs>
        <linearGradient id="fogGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="30%" stopColor="rgba(4,9,7,.5)" />
          <stop offset="80%" stopColor="rgba(4,9,7,.82)" />
        </linearGradient>
      </defs>
      <rect
        x={fogX}
        y={TOP_LANE - 16}
        width={X_END - fogX + 100}
        height={BOT_LANE - TOP_LANE + 30}
        fill="url(#fogGradient)"
        pointerEvents="none"
        style={{
          transition: "x 4.9s linear",
        }}
      />

      {/* Animations-Styles (inline für Simplizität) */}
      <style>{`
        @keyframes spySweep {
          from {
            transform: rotate(0deg);
            transform-origin: ${CENTER_X}px ${CENTER_Y}px;
          }
          to {
            transform: rotate(360deg);
            transform-origin: ${CENTER_X}px ${CENTER_Y}px;
          }
        }
        @keyframes targetFound {
          0% {
            transform: rotate(45deg) scale(2.3);
            opacity: 0;
          }
          100% {
            transform: rotate(45deg) scale(1);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes spySweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(0deg); }
          }
        }
      `}</style>
    </g>
  );
}
