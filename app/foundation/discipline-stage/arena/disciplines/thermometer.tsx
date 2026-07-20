// =====================================================================================
// thermometer (Schmerz-Thermometer) — vertical heat scale from cool green (low score)
// to glowing red (high score). Teams positioned by score, smooth CSS transitions.
// =====================================================================================
"use client";

import { type ReactNode } from "react";
import type { DisciplineFieldProps } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

export default function ThermometerField(props: DisciplineFieldProps): ReactNode {
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
    finalMax,
    tokenPos,
    rt,
    sorted,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;

  const trioSet = new Set(highlightIdxs ?? []);
  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync, Hover/Pause friert ein).
  const { gRefs, ghostRefs } = useTokenGlide(props);

  // Thermometer geometry: vertical scale
  const padTop = Math.max(60, H * 0.12);
  const padBottom = Math.max(padTop + 80, H * 0.88);
  const bulbRadius = Math.max(20, W * 0.08);
  const thermX = W / 2;
  const thermTop = padTop;
  const thermBottom = padBottom - bulbRadius;

  // y-position for a score (normalized 0..finalMax)
  const yOf = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    const clamped = Math.max(0, Math.min(1, norm));
    return thermBottom - clamped * (thermBottom - thermTop);
  };

  // Heat color: green (120°) at bottom → red (0°) at top
  const heatHue = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    const clamped = Math.max(0, Math.min(1, norm));
    return 120 - clamped * 120;
  };

  // Heat label at the top (which end is hotter)
  const heatLabel = (hue: number): string => {
    if (hue > 100) return "COOL";
    if (hue > 60) return "WARM";
    if (hue > 20) return "HOT";
    return "🔥 BURNING";
  };

  return (
    <>
      <defs>
        {/* Logo clipping for teams */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}

        {/* Thermometer gradient: green → red */}
        <linearGradient id="thermGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(0 82% 56%)" />
          <stop offset="25%" stopColor="hsl(20 78% 54%)" />
          <stop offset="50%" stopColor="hsl(60 75% 50%)" />
          <stop offset="75%" stopColor="hsl(90 70% 48%)" />
          <stop offset="100%" stopColor="hsl(120 72% 48%)" />
        </linearGradient>

        {/* Glow gradient for hot zone */}
        <radialGradient id="thermGlow" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="rgba(255, 79, 200, 0.35)" />
          <stop offset="100%" stopColor="rgba(255, 79, 200, 0)" />
        </radialGradient>
      </defs>

      {/* Background */}
      {env ? (
        <rect x={0} y={0} width={W} height={H} fill={env.sky[0]} opacity={0.8} />
      ) : (
        <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" opacity={0.95} />
      )}

      {/* Thermometer tube + scale */}
      <g>
        {/* Outer tube frame */}
        <rect
          x={thermX - bulbRadius * 0.4}
          y={thermTop}
          width={bulbRadius * 0.8}
          height={thermBottom - thermTop}
          rx={bulbRadius * 0.4}
          fill="var(--nl-panel)"
          stroke={skinAccent}
          strokeWidth={1.5}
          opacity={0.85}
        />

        {/* Heat gradient fill (inside tube) */}
        <rect
          x={thermX - bulbRadius * 0.35}
          y={thermTop}
          width={bulbRadius * 0.7}
          height={thermBottom - thermTop}
          rx={bulbRadius * 0.35}
          fill="url(#thermGrad)"
          opacity={0.72}
        />

        {/* Bulb at bottom (mercury reservoir) */}
        <circle cx={thermX} cy={padBottom} r={bulbRadius} fill="url(#thermGrad)" opacity={0.72} />
        <circle
          cx={thermX}
          cy={padBottom}
          r={bulbRadius}
          fill="none"
          stroke={skinAccent}
          strokeWidth={1.5}
          opacity={0.85}
        />

        {/* Scale tick marks + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = thermBottom - f * (thermBottom - thermTop);
          const score = f * finalMax;
          const temp = Math.round(score);
          const hue = 120 - f * 120;
          const col = `hsl(${hue} 72% 48%)`;

          return (
            <g key={`tick-${i}`}>
              <line
                x1={thermX - bulbRadius * 0.5}
                y1={y}
                x2={thermX - bulbRadius * 0.8}
                y2={y}
                stroke={skinAccent}
                strokeWidth={i % 2 === 0 ? 2.2 : 1.2}
                opacity={0.7}
              />
              <text
                x={thermX - bulbRadius * 1.05}
                y={y + 3.5}
                textAnchor="end"
                fontSize={i % 2 === 0 ? 10 : 8}
                fontWeight={i % 2 === 0 ? 800 : 600}
                fontFamily="ui-monospace, Menlo, monospace"
                fill={skinAccent}
                opacity={0.8}
              >
                {temp}
              </text>

              {/* Temperature label on right side for key points */}
              {i > 0 && (
                <text
                  x={thermX + bulbRadius * 1.2}
                  y={y + 3.5}
                  textAnchor="start"
                  fontSize={8}
                  fontWeight={600}
                  fontFamily="ui-monospace, Menlo, monospace"
                  fill={col}
                  opacity={0.65}
                >
                  {["COOL", "WARM", "HOT", "VERY HOT", "🔥"][i]}
                </text>
              )}
            </g>
          );
        })}

        {/* Hot zone glow at top */}
        <ellipse
          cx={thermX}
          cy={thermTop - 30}
          rx={bulbRadius * 1.8}
          ry={bulbRadius * 0.9}
          fill="url(#thermGlow)"
        />
      </g>

      {/* Discipline watermark */}
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

      {/* Ghost der Vorrunde (Benchmark) — VOR den Token. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: positioned by score (rAF/animScore), with heat-colored aura */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const heatHueVal = heatHue(t.displayScore);
          const glowing = t.glowUntil > now;

          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={tokenRef(gRefs, t, tokenPos)}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Heat bar: red glow at high temps (bespoke) */}
              {heatHueVal < 30 ? (
                <circle
                  r={r + 10}
                  fill="none"
                  stroke={`hsl(${heatHueVal} 82% 60%)`}
                  strokeWidth={5}
                  opacity={0.4}
                  style={{
                    animation: reducedMotion
                      ? "none"
                      : "olyGlowPulse 1.1s ease-in-out infinite",
                  }}
                />
              ) : null}

              {/* Glowing aura for leader (bespoke) */}
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

              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} />
            </g>
          );
        })}
    </>
  );
}
