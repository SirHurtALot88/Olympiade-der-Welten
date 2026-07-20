// =====================================================================================
// Eiskunstlauf (Figure Skating) — Kür auf der Ruhm-Treppe (Performance on Fame Stairs)
//
// Archetyp: Count-up stage with score = route progression. 32 skaters glide their own
// choreographed routes from the entrance (bande/boards) toward the central performance
// circle (Schluss-Pose / Final Pose at 6.0). Higher score = closer to center.
//
// Atmosphere: Ice rink from above with audience seating rings, bande with gold edge,
// jury scoring station (6.0-scale scoring paddles), spotlight cones, ice-blue surface,
// scoring rings (1.0 … 6.0), final-pose circle as goal.
//
// Props.layout (stage primitive): floorY, podiumY, centerX, baseHalf, topHalf, stairBands.
// Score is truth; endstand remains frozen (no retract).
// =====================================================================================
"use client";

import React, { type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

export default function EiskunstField(props: DisciplineFieldProps): ReactNode {
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
    finalMax,
    rt,
    sorted,
    now,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    hoverIdx,
    highlightIdxs,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // ============================================================================
  // Geometry: Ice rink from above, elliptical
  // ============================================================================
  // Mockup dimensions (LW=900, LH=660) → scale to W/H
  const LW = 900;
  const LH = 660;
  const scaleX = W / LW;
  const scaleY = H / LH;
  const scale = Math.min(scaleX, scaleY);

  // Center + ellipse radii. Zentrum = ECHTE viewBox-Mitte (nicht 450*scale) — sonst sitzt
  // die ganze Eis-Szene links, weil scale=min(W/900,H/660)≈0.97 CX auf ~436 statt 590 legt.
  const CX = W / 2;
  const CY = H / 2;
  const RX = 328 * scale;
  const RY = 222 * scale;

  // Outer/inner route radius (bande to Schluss-Pose)
  const U_OUT = 0.93;
  const U_IN = 0.13;

  // Rink boundary + bands
  const bandOuterRad = 1.325;
  const bandInnerRad = 1.045;

  // Convert cumulative score to normalized progress (0…1)
  const uOf = (score: number): number => (finalMax > 0 ? score / finalMax : 0);

  // Wertung-Skala (jury scoring 1.0…6.0)
  const wOf = (score: number): string => ((uOf(score) * 6).toFixed(1));

  // Route radius at normalized progress u (outer bande → inner Schluss-Pose)
  const rOfU = (u: number): number => U_OUT - (U_OUT - U_IN) * u;

  // Lane/Theta: distribute teams around the rink (13 stride to avoid clustering)
  const laneTh = (i: number): number => (((i * 13) % 32) / 32) * 2 * Math.PI - Math.PI / 2;

  // Choreography: each route has its own swaying pattern (Serpentinen)
  const routePos = (t: any, u: number): { x: number; y: number } => {
    const hash = (s: string): number => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0) / 4294967295;
    };

    const th =
      laneTh(t.idx) +
      0.85 * u +
      (0.03 + hash(t.code + "amp") * 0.036) *
        (1 - 0.75 * u) *
        Math.sin(
          u * 6.283 * (2 + hash(t.code + "f") * 1.4) + hash(t.code + "ph") * 6.283
        );
    const r =
      rOfU(u) +
      0.018 *
        Math.sin(
          u * 6.283 * (3 + hash(t.code + "f2") * 1.5) + hash(t.code + "p2") * 6.283
        ) *
        (1 - u * 0.75);
    return {
      x: CX + Math.cos(th) * RX * r,
      y: CY + Math.sin(th) * RY * r,
    };
  };

  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync mit Rangliste,
  // Hover/Pause friert ein). Eiskunst positioniert per bespoke Choreografie-Route
  // (routePos über normalisierten Fortschritt uOf(score)); dieser Adapter speist die
  // Glide-Schleife, damit Ghost + Token derselben Kür folgen. Siehe benchmark.tsx.
  const glidePos = (t: RT, score: number): { x: number; y: number } => routePos(t, uOf(score));
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos: glidePos });

  // ============================================================================
  // Render functions for field art (SVG children only)
  // ============================================================================

  // Helper: compute hash for deterministic randomness
  const hash = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  };

  // ============================================================================
  // Main render
  // ============================================================================
  return (
    <>
      <defs>
        {/* Ice gradient */}
        <radialGradient id="iceg" cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor="#2c4d74" />
          <stop offset="0.55" stopColor="#22405f" />
          <stop offset="1" stopColor="#182c44" />
        </radialGradient>
        {/* Schluss-Pose glow */}
        <radialGradient id="poseg" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(246,199,80,.20)" />
          <stop offset="1" stopColor="rgba(246,199,80,0)" />
        </radialGradient>
        {/* Spotlight beams */}
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(191,230,255,.13)" />
          <stop offset="1" stopColor="rgba(191,230,255,0)" />
        </linearGradient>
        <linearGradient id="beam2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(246,199,80,.10)" />
          <stop offset="1" stopColor="rgba(246,199,80,0)" />
        </linearGradient>
        {/* Logo clipping per team */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {/* === Background: Audience rings + Bande + Ice === */}

      {/* Publikumsränge (Ovalringe) + Gänge */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * bandOuterRad}
        ry={RY * bandOuterRad}
        fill="#0e1426"
        stroke="#1c2440"
        strokeWidth={1.5}
      />
      <ellipse cx={CX} cy={CY} rx={RX * 1.21} ry={RY * 1.21} fill="#111a30" />
      <ellipse cx={CX} cy={CY} rx={RX * 1.09} ry={RY * 1.09} fill="#15203a" />

      {/* Audience crowd points (scattered, deterministic) */}
      {(() => {
        const hash = (s: string): number => {
          let h = 2166136261;
          for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
          }
          return (h >>> 0) / 4294967295;
        };
        const circles: React.ReactNode[] = [];
        for (let i = 0; i < 420; i++) {
          const a = hash("ca" + i) * 6.283;
          const rr = 1.075 + hash("cr" + i) * 0.235;
          const x = CX + Math.cos(a) * RX * rr;
          const y = CY + Math.sin(a) * RY * rr;
          if (y < 26 || y > H - 8 || x < 8 || x > W - 8) continue;
          const c = hash("cc" + i);
          const col =
            c < 0.08
              ? "rgba(246,199,80,.35)"
              : c < 0.15
                ? "rgba(232,160,200,.30)"
                : `rgba(190,210,240,${(0.1 + hash("co" + i) * 0.2).toFixed(2)})`;
          circles.push(
            <circle
              key={i}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r={(1 + hash("cs" + i) * 0.9).toFixed(1)}
              fill={col}
            />
          );
        }
        return circles;
      })()}

      {/* Aisles */}
      <g stroke="rgba(8,12,24,.65)" strokeWidth={7}>
        {Array.from({ length: 8 }).map((_, k) => {
          const a = (k / 8) * 6.283 + 0.19;
          const x1 = CX + Math.cos(a) * RX * 1.06;
          const y1 = CY + Math.sin(a) * RY * 1.06;
          const x2 = CX + Math.cos(a) * RX * 1.31;
          const y2 = CY + Math.sin(a) * RY * 1.31;
          return (
            <path
              key={k}
              d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`}
            />
          );
        })}
      </g>

      {/* Bande mit Goldkante */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * bandInnerRad}
        ry={RY * bandInnerRad}
        fill="#0f1a2e"
        stroke="#c9dcec"
        strokeWidth={4}
      />
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * bandInnerRad}
        ry={RY * bandInnerRad}
        fill="none"
        stroke="rgba(246,199,80,.5)"
        strokeWidth={1.2}
      />

      {/* Show-Eis */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="url(#iceg)" />
      <ellipse
        cx={CX - 70}
        cy={CY - 58}
        rx={180}
        ry={86}
        fill="rgba(235,246,255,.06)"
      />

      {/* Spotlight beams */}
      <polygon points={`180,0 300,${CY} 480,${CY} Z`} fill="url(#beam)" />
      <polygon
        points={`720,0 430,${CY + 40} 620,${CY + 30} Z`}
        fill="url(#beam)"
      />
      <polygon
        points={`450,0 380,${CY - 40} 530,${CY - 40} Z`}
        fill="url(#beam2)"
      />

      {/* Skate traces on ice */}
      <g>
        {Array.from({ length: 9 }).map((_, i) => {
          const a = hash("t" + i) * 6.283;
          const rr = 0.25 + hash("tr" + i) * 0.6;
          const x = CX + Math.cos(a) * RX * rr;
          const y = CY + Math.sin(a) * RY * rr;
          const qy = ((hash("tq" + i) - 0.5) * 22).toFixed(1);
          return (
            <path
              key={i}
              d={`M ${(x - 34).toFixed(1)} ${y.toFixed(1)} q 34 ${qy} 68 0`}
              stroke="rgba(235,246,255,.09)"
              strokeWidth={1.1}
              fill="none"
            />
          );
        })}
      </g>

      {/* Wertungsringe (scoring rings) */}
      <g>
        {Array.from({ length: 5 }).map((_, w) => {
          const idx = w + 1;
          const r = rOfU(idx / 6);
          const rxVal = RX * r;
          const ryVal = RY * r;
          return (
            <g key={`ring-${idx}`}>
              <ellipse
                cx={CX}
                cy={CY}
                rx={rxVal}
                ry={ryVal}
                fill="none"
                stroke="rgba(246,199,80,.10)"
                strokeWidth={1}
                strokeDasharray="3 9"
              />
              <text
                x={CX}
                y={CY - ryVal - 3}
                textAnchor="middle"
                fontFamily="ui-monospace,Menlo,monospace"
                fontSize={8.5}
                fontWeight={800}
                fill="rgba(246,199,80,.38)"
              >
                {idx}.0
              </text>
            </g>
          );
        })}
      </g>

      {/* Choreography routes (faint paths per team) */}
      <g>
        {rt.map((t) => {
          let d = "";
          for (let k = 0; k <= 36; k++) {
            const p = routePos(t, k / 36);
            d += (k ? " L " : "M ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
          }
          const col =
            t.rel === "mine"
              ? "rgba(74,157,255,.30)"
              : t.rel === "ally"
                ? "rgba(70,201,138,.20)"
                : t.rel === "rival"
                  ? "rgba(240,80,60,.20)"
                  : "rgba(235,246,255,.065)";
          const sw = t.rel ? 1.4 : 1;
          return (
            <path
              key={`route-${t.code}`}
              d={d}
              fill="none"
              stroke={col}
              strokeWidth={sw}
            />
          );
        })}
      </g>

      {/* Schluss-Pose circle (final pose / goal at 6.0) */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * U_IN * 1.35}
        ry={RY * U_IN * 1.35}
        fill="url(#poseg)"
      />
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * U_IN}
        ry={RY * U_IN}
        fill="none"
        stroke="rgba(246,199,80,.55)"
        strokeWidth={1.4}
        strokeDasharray="7 6"
      />
      <text
        x={CX}
        y={CY + 4}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={9}
        fontWeight={900}
        letterSpacing="1.5px"
        fill="rgba(246,199,80,.7)"
      >
        6.0
      </text>
      <text
        x={CX}
        y={CY - RY * U_IN - 7}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={8}
        fontWeight={800}
        letterSpacing="2px"
        fill="rgba(246,199,80,.55)"
      >
        SCHLUSS-POSE
      </text>

      {/* Entrance marking at bande (0.0) */}
      <text
        x={CX}
        y={CY - RY * U_OUT + 16}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={8.5}
        fontWeight={800}
        letterSpacing="2px"
        fill="rgba(235,246,255,.4)"
      >
        EINLAUF · BANDE · 0.0
      </text>

      {/* Arena heading */}
      <text
        x={CX}
        y={20}
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontStyle="italic"
        fontWeight={800}
        fontSize={15}
        letterSpacing="5px"
        fill="#cfe0f2"
        opacity={0.4}
      >
        EISKUNSTLAUF · ARENA · KÜR
      </text>

      {/* Jury station at bottom with scoring paddles */}
      <rect
        x={CX - 185}
        y={H - 56}
        width={370}
        height={38}
        rx={9}
        fill="#10182e"
        stroke="#37415c"
        strokeWidth={1.4}
      />
      <path
        d={`M ${CX - 185} ${H - 46} h 370`}
        stroke="rgba(246,199,80,.4)"
        strokeWidth={1}
      />
      <text
        x={CX}
        y={H - 6}
        textAnchor="middle"
        fontFamily="ui-monospace,Menlo,monospace"
        fontSize={9}
        fontWeight={800}
        letterSpacing="2.5px"
        fill="rgba(191,230,255,.55)"
      >
        JURY · WERTUNG 6.0
      </text>

      {/* Audience silhouette at base */}
      {(() => {
        const pts: string[] = [`0,${H}`];
        const cn = 22;
        for (let i = 0; i <= cn; i += 1) {
          const x = (i / cn) * W;
          const h = H - 14 - ((i * 47) % 30);
          pts.push(`${x},${h}`, `${x + W / cn / 2},${H - 6}`);
        }
        pts.push(`${W},${H}`);
        return (
          <polygon
            points={pts.join(" ")}
            fill="rgba(0,0,0,0.8)"
            opacity={0.85}
          />
        );
      })()}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Skatern. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* === Tokens: 32 Skaters === Position via rAF (animScore, Benchmark-Sync). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;

          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={tokenRef(gRefs, t, glidePos)}
              style={{
                cursor: onOpenTeam && t.teamId ? "pointer" : "default",
              }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Glow ring (leader) */}
              {glowing ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={4}
                  style={{
                    animation: reducedMotion
                      ? "none"
                      : "olyGlowPulse 1.1s ease-in-out infinite",
                  }}
                />
              ) : null}

              {/* Kufen-Glanz (skate shine, decorative line below token) — SVG-Paint braucht
                  eine echte Farbe (kein CSS linear-gradient), sonst rendert die Linie nie. */}
              <line
                x1={0}
                y1={r * 0.88}
                x2={0}
                y2={r * 0.88 + 9}
                stroke="rgba(191,230,255,.5)"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.6}
              />

              {/* Pirouette / Kür-Spray: zwei rotierende Eis-Spray-Bögen um den Skater
                  (SMIL rotiert um den Token-Mittelpunkt 0,0 — unabhängig vom rAF-Translate).
                  Tempo je Team leicht variiert; der Führende dreht schneller & heller.
                  reduced-motion → kein Spin. */}
              {!reducedMotion ? (
                <g opacity={t.rank === 1 ? 0.7 : 0.42}>
                  <path
                    d={`M ${-(r + 3)} 0 A ${r + 3} ${r + 3} 0 0 1 0 ${-(r + 3)}`}
                    stroke="rgba(191,230,255,.75)"
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${r + 3} 0 A ${r + 3} ${r + 3} 0 0 1 0 ${r + 3}`}
                    stroke="rgba(246,199,80,.55)"
                    strokeWidth={1.4}
                    fill="none"
                    strokeLinecap="round"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 0 0"
                    to="360 0 0"
                    dur={`${(t.rank === 1 ? 1.1 : 1.7 + hash(t.code + "spin") * 1.3).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                </g>
              ) : null}

              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Eiskunst trägt seine eigene Champion-Krone. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />

              {/* Champion crown (rank 1) */}
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
            </g>
          );
        })}

      {/* Field watermark */}
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
    </>
  );
}
