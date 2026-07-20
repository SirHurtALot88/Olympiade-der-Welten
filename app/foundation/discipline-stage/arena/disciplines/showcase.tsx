// =====================================================================================
// Showcase (Talent-Show) — Theatrical stage with depth, performers ascending the
// fame-staircase to the podium. Higher score = closer to spotlight/podium.
//
// Violet spotlit stage with red velvet curtains, marquee, hype wall (applause meter),
// jury buzzers, footlights. Distinct from Eiskunstlauf's ice-skating stage.
//
// Returns SVG children only (React fragment). Token positioning by score.
// =====================================================================================
"use client";

import React, { type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";

export default function ShowcaseField(props: DisciplineFieldProps): ReactNode {
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
    tokenPos,
    rt,
    sorted,
    done,
    now,
    fieldNorm,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;

  // Layout: theatrical showcase stage with depth
  const floorY = layout.floorY ?? H * 0.74; // Stage floor (Y0 in mockup = 474)
  const podiumY = layout.podiumY ?? H * 0.206; // Podium top (Y1 in mockup = 132)
  const centerX = layout.centerX ?? W / 2;
  const baseHalf = layout.baseHalf ?? W * 0.36; // Stage width at floor
  const topHalf = layout.topHalf ?? W * 0.14; // Podium width at top
  const stairBands = layout.stairBands ?? 16; // Trapezoidal stair segments
  const hypeWallX0 = layout.hypeWallX0 ?? W * 0.07; // Hype wall left edge
  const hypeWallX1 = layout.hypeWallX1 ?? W * 0.93; // Hype wall right edge

  // dB scale: 60 dB (floor) to 120 dB (top of hype wall)
  const dbMin = 60;
  const dbMax = 120;
  const dbOf = (score: number): number => {
    const norm = finalMax > 0 ? Math.min(1, score / finalMax) : 0;
    return Math.round(dbMin + norm * (dbMax - dbMin));
  };

  // Position tokens based on score (higher score = higher on hype wall)
  const posTokenBy = (t: RT, score: number): { x: number; y: number } => {
    // Memoized tokenPos (host provides the calculation)
    return tokenPos(t, score);
  };

  return (
    <>
      <defs>
        {/* Spotlight gradients */}
        <radialGradient id="showcaseBeamP">
          <stop offset="0%" stopColor="rgba(255,95,168,0.13)" />
          <stop offset="100%" stopColor="rgba(255,95,168,0)" />
        </radialGradient>
        <radialGradient id="showcaseBeamC">
          <stop offset="0%" stopColor="rgba(87,230,255,0.11)" />
          <stop offset="100%" stopColor="rgba(87,230,255,0)" />
        </radialGradient>
        <radialGradient id="showcaseBeamG">
          <stop offset="0%" stopColor="rgba(246,199,80,0.11)" />
          <stop offset="100%" stopColor="rgba(246,199,80,0)" />
        </radialGradient>
        {/* Stage floor gradient */}
        <linearGradient id="showcaseStage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2214" />
          <stop offset="50%" stopColor="#2c1a10" />
          <stop offset="100%" stopColor="#1c110c" />
        </linearGradient>
        {/* Ambient & leader spotlight cones */}
        <radialGradient id="showcaseAmbientCone">
          <stop offset="0%" stopColor={env?.line ?? "rgba(255,255,255,0.1)"} stopOpacity={0.22} />
          <stop offset="100%" stopColor={env?.line ?? "rgba(255,255,255,0.1)"} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="showcaseLeaderCone">
          <stop offset="0%" stopColor={env?.line ?? "rgba(255,255,255,0.1)"} stopOpacity={0.34} />
          <stop offset="100%" stopColor={env?.line ?? "rgba(255,255,255,0.1)"} stopOpacity={0} />
        </radialGradient>
        {/* Clip paths for team logos */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`showcaseclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {/* ============================================================================
          BACKGROUND: Theatrical stage with depth, hype wall, zones, grid
          ============================================================================ */}
      {env ? (
        <>
          {/* Ambient sky fill (from env) */}
          <rect x={0} y={0} width={W} height={H} fill={env.sky?.[0] ?? "#120b16"} />

          {/* ---- LED Hype-Wall (background) with zones & pixel grid ---- */}
          {/* Horizontal grid lines (dB zones) */}
          {Array.from({ length: Math.ceil((floorY - podiumY) / 12) }).map((_, i) => {
            const y = podiumY + i * 12;
            return (
              <path
                key={`hgrid-${i}`}
                d={`M ${hypeWallX0} ${y} H ${hypeWallX1}`}
                stroke="rgba(140,110,180,0.06)"
                strokeWidth={1}
              />
            );
          })}
          {/* Vertical grid lines (lane markers) */}
          {Array.from({ length: Math.ceil((hypeWallX1 - hypeWallX0) / 24) }).map((_, i) => {
            const x = hypeWallX0 + i * 24;
            return (
              <path
                key={`vgrid-${i}`}
                d={`M ${x} ${podiumY} V ${floorY}`}
                stroke="rgba(140,110,180,0.05)"
                strokeWidth={1}
              />
            );
          })}

          {/* Hype zones (4 bands from bottom to top: WARM-UP, JUBEL, TOSENDER APPLAUS, STANDING OVATION) */}
          {Array.from({ length: 4 }).map((_, i) => {
            const zoneH = (floorY - podiumY) / 4;
            const y = floorY - (i + 1) * zoneH;
            const zoneColors = [
              { bg: "rgba(87,230,255,0.05)", line: "rgba(87,230,255,0.35)", label: "WARM-UP" },
              { bg: "rgba(84,217,130,0.06)", line: "rgba(84,217,130,0.4)", label: "JUBEL" },
              { bg: "rgba(255,95,168,0.07)", line: "rgba(255,95,168,0.45)", label: "TOSENDER APPLAUS" },
              { bg: "rgba(246,199,80,0.09)", line: "rgba(246,199,80,0.6)", label: "STANDING OVATION 🌟" },
            ];
            const zone = zoneColors[i];
            return (
              <g key={`zone-${i}`}>
                <rect x={hypeWallX0} y={y} width={hypeWallX1 - hypeWallX0} height={zoneH} fill={zone.bg} />
                <path d={`M ${hypeWallX0} ${y} H ${hypeWallX1}`} stroke={zone.line} strokeWidth={1.2} strokeDasharray="7 5" />
                <text
                  x={hypeWallX1 - 8}
                  y={y + zoneH * 0.7}
                  textAnchor="end"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontSize={8.5}
                  fontWeight={800}
                  letterSpacing={2}
                  fill={zone.line}
                >
                  {zone.label}
                </text>
              </g>
            );
          })}

          {/* dB scale (left side: 70…120 dB) */}
          {Array.from({ length: 6 }).map((_, i) => {
            const dbVal = 70 + i * 10;
            const y = floorY - ((dbVal - dbMin) / (dbMax - dbMin)) * (floorY - podiumY);
            return (
              <g key={`dbscale-${i}`}>
                <line x1={hypeWallX0 - 6} y1={y} x2={hypeWallX0} y2={y} stroke="rgba(255,95,168,0.4)" strokeWidth={1} />
                <text
                  x={hypeWallX0 - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fontSize={8.5}
                  fontWeight={800}
                  fill="rgba(255,95,168,0.5)"
                >
                  {dbVal}
                </text>
              </g>
            );
          })}
          <text
            x={hypeWallX0 - 8}
            y={podiumY - 10}
            textAnchor="end"
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize={7.5}
            fontWeight={800}
            letterSpacing={1}
            fill="rgba(255,95,168,0.55)"
          >
            dB
          </text>

          {/* ---- Red Velvet Curtains (left & right portals) ---- */}
          {[
            { x0: 8, x1: hypeWallX0 - 10 },
            { x0: hypeWallX1 + 10, x1: W - 8 },
          ].map((seg, si) => {
            const w = (seg.x1 - seg.x0) / 5;
            return (
              <g key={`curtain-${si}`}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const x = seg.x0 + i * w;
                  const cx = x + w * 0.5;
                  const depth = 300 + ((i % 2) * 40);
                  const color = i % 2 ? "#6e1628" : "#8c1f34";
                  return (
                    <path
                      key={`fold-${i}`}
                      d={`M ${x} 46 Q ${cx} ${depth} ${x} ${floorY + 52} L ${x + w} ${floorY + 52} Q ${x + w * 0.6} ${depth - 20} ${x + w} 46 Z`}
                      fill={color}
                    />
                  );
                })}
                {/* Gold trim at curtain pole */}
                <circle cx={(seg.x0 + seg.x1) / 2} cy={330} r={6} fill="#f6c750" opacity={0.7} />
                <path
                  d={`M ${seg.x0} 336 Q ${(seg.x0 + seg.x1) / 2} 356 ${seg.x1} 336`}
                  stroke="#f6c750"
                  strokeWidth={2.5}
                  fill="none"
                  opacity={0.55}
                />
              </g>
            );
          })}

          {/* ---- Marquee Header: "SHOWCASE" with lightbulbs ---- */}
          <rect
            x={W / 2 - 190}
            y={8}
            width={380}
            height={34}
            rx={17}
            fill="#1c0f26"
            stroke="#4a3760"
            strokeWidth={1.4}
          />
          {Array.from({ length: 17 }).map((_, i) => {
            const x = W / 2 - 172 + (i * 344) / 16;
            const bulbY = i % 2 ? 14 : 36;
            const col = i % 3 ? "#f6c750" : "#ffdf9c";
            const seed = `mq${i}`;
            const hash = seed.charCodeAt(0) + seed.charCodeAt(1) * 256;
            const opacity = 0.55 + ((hash >> 8) % 100) / 100 * 0.45;
            return (
              <circle
                key={`bulb-${i}`}
                cx={x}
                cy={bulbY}
                r={2.6}
                fill={col}
                opacity={opacity}
              />
            );
          })}
          <text
            x={W / 2}
            y={31}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontStyle="italic"
            fontWeight={800}
            fontSize={16}
            letterSpacing={6}
            fill="#f6c750"
          >
            SHOWCASE
          </text>

          {/* ---- Spotlight Beams (from top to stage) ---- */}
          <path
            d={`M 200 40 L 80 ${floorY + 52} L 340 ${floorY + 52} Z`}
            fill="url(#showcaseBeamP)"
          />
          <path
            d={`M 700 40 L 560 ${floorY + 52} L 820 ${floorY + 52} Z`}
            fill="url(#showcaseBeamC)"
          />
          <path
            d={`M 450 40 L 350 ${floorY + 52} L 550 ${floorY + 52} Z`}
            fill="url(#showcaseBeamG)"
          />

          {/* ---- Fame Staircase (trapezoids ascending to podium) ---- */}
          {Array.from({ length: stairBands }).map((_, i) => {
            const f0 = i / stairBands;
            const f1 = (i + 1) / stairBands;
            const y0 = floorY - f0 * (floorY - podiumY);
            const y1 = floorY - f1 * (floorY - podiumY);
            const hw0 = baseHalf + (topHalf - baseHalf) * f0;
            const hw1 = baseHalf + (topHalf - baseHalf) * f1;
            return (
              <polygon
                key={`stair-${i}`}
                points={`${centerX - hw0},${y0} ${centerX + hw0},${y0} ${centerX + hw1},${y1} ${centerX - hw1},${y1}`}
                fill={`rgba(255,255,255,${(0.02 + f0 * 0.05).toFixed(3)})`}
                stroke={env.line ?? "rgba(255,255,255,0.2)"}
                strokeWidth={1}
                opacity={0.16}
              />
            );
          })}

          {/* ---- Stage Floor (gloss) with footlights ---- */}
          <rect
            x={hypeWallX0 - 12}
            y={floorY}
            width={hypeWallX1 - hypeWallX0 + 24}
            height={52}
            rx={7}
            fill="url(#showcaseStage)"
          />
          {/* Floorboards seams */}
          {Array.from({ length: 9 }).map((_, i) => {
            const x = hypeWallX0 + 30 + (i * (hypeWallX1 - hypeWallX0 - 60)) / 8;
            return (
              <path
                key={`board-${i}`}
                d={`M ${x} ${floorY + 4} V ${floorY + 48}`}
                stroke="rgba(246,199,80,0.08)"
                strokeWidth={1}
              />
            );
          })}
          {/* Stage shine */}
          <ellipse
            cx={W / 2}
            cy={floorY + 26}
            rx={170}
            ry={14}
            fill="rgba(255,223,156,0.1)"
          />
          {/* Footlights (13 LEDs along front edge) */}
          {Array.from({ length: 13 }).map((_, j) => {
            const fx = hypeWallX0 + 8 + (j * (hypeWallX1 - hypeWallX0 - 16)) / 12;
            return (
              <g key={`footlight-${j}`}>
                <circle cx={fx} cy={floorY + 49} r={3} fill="#f6c750" opacity={0.55} />
                <path
                  d={`M ${fx - 7} ${floorY + 46} L ${fx + 7} ${floorY + 46} L ${fx + 3} ${floorY + 36} L ${fx - 3} ${floorY + 36} Z`}
                  fill="rgba(246,199,80,0.1)"
                />
              </g>
            );
          })}
          {/* Stage label */}
          <text
            x={hypeWallX0 + 2}
            y={floorY + 44}
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize={8.5}
            fontWeight={800}
            letterSpacing={2}
            fill="rgba(255,223,156,0.5)"
          >
            SHOW-BÜHNE · AUFTRITT · 60 dB
          </text>

          {/* ---- Podium (Ruhm-Podest) at top ---- */}
          <rect
            x={centerX - topHalf - 14}
            y={podiumY - 46}
            width={(topHalf + 14) * 2}
            height={60}
            rx={12}
            fill="rgba(0,0,0,0.35)"
            stroke={env.line ?? "rgba(255,255,255,0.2)"}
            strokeWidth={2}
          />
          <text
            x={centerX}
            y={podiumY - 16}
            textAnchor="middle"
            fontSize={12}
            fontWeight={800}
            fill={env.line ?? "rgba(255,255,255,0.2)"}
            letterSpacing="0.16em"
          >
            RUHM · PODEST
          </text>

          {/* ---- Jury Lights (along podium top) ---- */}
          {Array.from({ length: 12 }).map((_, b) => {
            const bx = centerX - topHalf - 6 + ((b / 11) * ((topHalf + 6) * 2));
            return (
              <circle
                key={`jury-light-${b}`}
                cx={bx}
                cy={podiumY - 52}
                r={3.4}
                fill={env.line ?? "rgba(255,255,255,0.2)"}
                opacity={0.32}
              />
            );
          })}

          {/* ---- Jury Desk at bottom ---- */}
          <ellipse
            cx={W / 2}
            cy={floorY + 56}
            rx={330}
            ry={13}
            fill="rgba(255,95,168,0.06)"
          />
          <rect
            x={W / 2 - 200}
            y={H - 34}
            width={400}
            height={42}
            rx={9}
            fill="#1e1130"
            stroke="#4a3760"
            strokeWidth={1.4}
          />
          <path
            d={`M ${W / 2 - 200} ${H - 19} h 400`}
            stroke="rgba(246,199,80,0.4)"
            strokeWidth={1}
          />
          <text
            x={W / 2}
            y={H - 1}
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize={9}
            fontWeight={800}
            letterSpacing={2.5}
            fill="rgba(255,95,168,0.6)"
          >
            JURY · BUZZER-PULT · 🌟 GOLDEN BUZZER
          </text>

          {/* ---- Ambient spotlight (always on podium) ---- */}
          <circle
            cx={centerX}
            cy={podiumY}
            r={190}
            fill="url(#showcaseAmbientCone)"
          />

          {/* ---- Leader spotlight (follows the rank-1 team) ---- */}
          {(() => {
            const leader = rt.find((t) => t.rank === 1) ?? null;
            const leaderPos = leader ? posTokenBy(leader, leader.score) : null;
            return leaderPos ? (
              <ellipse
                cx={leaderPos.x}
                cy={leaderPos.y}
                rx={70}
                ry={62}
                fill="url(#showcaseLeaderCone)"
              />
            ) : null;
          })()}

          {/* ---- Audience silhouette at bottom ---- */}
          {(() => {
            const crowdPts: string[] = [`0,${H}`];
            const cn = 22;
            for (let i = 0; i <= cn; i += 1) {
              const x = (i / cn) * W;
              const seed = `crowd-${i}`;
              const hash = seed.charCodeAt(0) + seed.charCodeAt(1) * 256;
              const h = H - 14 - ((i * 47) % 30);
              crowdPts.push(`${x},${h}`, `${x + W / cn / 2},${H - 6}`);
            }
            crowdPts.push(`${W},${H}`);
            return (
              <polygon
                points={crowdPts.join(" ")}
                fill="rgba(0,0,0,0.8)"
                opacity={0.85}
              />
            );
          })()}
        </>
      ) : (
        /* Fallback: simple dark background */
        <>
          <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" opacity={0.9} />
          {/* Simple staircase */}
          {Array.from({ length: stairBands }).map((_, i) => {
            const f0 = i / stairBands;
            const f1 = (i + 1) / stairBands;
            const y0 = floorY - f0 * (floorY - podiumY);
            const y1 = floorY - f1 * (floorY - podiumY);
            const hw0 = baseHalf + (topHalf - baseHalf) * f0;
            const hw1 = baseHalf + (topHalf - baseHalf) * f1;
            return (
              <polygon
                key={i}
                points={`${centerX - hw0},${y0} ${centerX + hw0},${y0} ${centerX + hw1},${y1} ${centerX - hw1},${y1}`}
                fill="var(--nl-panel)"
                opacity={0.35 + f0 * 0.45}
                stroke={skinAccent}
                strokeWidth={1}
                strokeOpacity={0.35}
              />
            );
          })}
          <rect
            x={centerX - topHalf - 14}
            y={podiumY - 46}
            width={(topHalf + 14) * 2}
            height={60}
            rx={12}
            fill="var(--nl-panel)"
            stroke={skinAccent}
            strokeWidth={2}
          />
          <text
            x={centerX}
            y={podiumY - 16}
            textAnchor="middle"
            fontSize={12}
            fontWeight={800}
            fill={skinAccent}
            letterSpacing="0.16em"
          >
            RUHM · PODEST
          </text>
        </>
      )}

      {/* ============================================================================
          TOKEN LOOP: 32 performers in lanes, positioned by score
          ============================================================================ */}

      {/* Token shadow (below each performer) */}
      {sorted.map((t) => {
        const pos = posTokenBy(t, t.displayScore);
        const r = t.isOwn ? geo.rOwn : geo.r;
        return (
          <ellipse
            key={`shadow-${t.code}`}
            cx={pos.x}
            cy={pos.y + r * 0.9}
            rx={r * 0.9}
            ry={r * 0.32}
            fill="rgba(0,0,0,0.4)"
          />
        );
      })}

      {/* Tokens */}
      {sorted.map((t) => {
        const pos = posTokenBy(t, t.displayScore);
        const r = t.isOwn ? geo.rOwn : geo.r;
        const hue = hueForIdx(t.idx);
        const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
        const glowing = t.glowUntil > now;
        const dur = reducedMotion ? 0 : 5000;
        const ease = "cubic-bezier(.4,0,.2,1)";

        return (
          <g
            key={t.code}
            transform={`translate(${pos.x} ${pos.y})`}
            style={{
              transition: reducedMotion ? "none" : `transform ${dur}ms ${ease}`,
              cursor: onOpenTeam && t.teamId ? "pointer" : "default",
            }}
            onMouseEnter={() => openHover(t.idx)}
            onMouseLeave={scheduleHoverClose}
            onClick={() => {
              if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
            }}
          >
            {/* Champion crown (rank 1 at end) */}
            {done && t.rank === 1 ? (
              <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                🏆
              </text>
            ) : null}

            {/* Glow pulse (special moments) */}
            {glowing ? (
              <circle
                r={r + 8}
                fill="none"
                stroke="var(--nl-warn)"
                strokeWidth={4}
                style={{
                  animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite",
                }}
              />
            ) : null}

            {/* Medal rings (top-3) */}
            {medal ? (
              <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} />
            ) : null}

            {/* Relation border (mine/ally/rival) */}
            {relColor(t.rel) ? (
              <circle
                r={r + 5.5}
                fill="none"
                stroke={relColor(t.rel)!}
                strokeWidth={2.4}
                opacity={0.95}
              />
            ) : null}

            {/* Team logo or hue circle */}
            {t.logoUrl ? (
              <image
                href={t.logoUrl}
                x={-r}
                y={-r}
                width={r * 2}
                height={r * 2}
                clipPath={`url(#showcaseclip-${t.code})`}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : (
              <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
            )}

            {/* Outer border (white for own, semi-white for others) */}
            <circle
              r={r}
              fill="none"
              stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"}
              strokeWidth={t.isOwn ? 2.5 : 1.4}
            />

            {/* Team code label */}
            {t.isOwn ? (
              <text
                y={r + 15}
                textAnchor="middle"
                fontSize={13}
                fontWeight={800}
                fill="var(--nl-accent)"
              >
                ★ {t.code}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Discipline name watermark */}
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
