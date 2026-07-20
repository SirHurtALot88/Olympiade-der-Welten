// =====================================================================================
// platter (Wettessen) — Schlemmer-Bankett Feld-Komponente.
//
// Banquet-Tafel frontal: Esser-Tokens (Team-Wappen mit Latz-Serviette) sitzen in Reihen
// und futtern sich von links nach rechts. x-Position = geleerte Teller (Score),
// Tellerstapel wächst unter jedem Esser. Magen-Meter unten mit Gabel-Marker des Führenden.
// 🍴 Schlinger-Pop (Host-FX) + 😵 Food-Koma-Animation bei schwachen Zügen (Host-getrieben).
// =====================================================================================
"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { relColor, hueForIdx } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";

export default function PlatterField(props: DisciplineFieldProps): ReactNode {
  const {
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
  } = props;

  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const stackRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const gorgeRef = useRef<SVGRectElement | null>(null);
  const forkRef = useRef<SVGTextElement | null>(null);

  // Banquet-Geometrie: Tisch-Bereich (oben/unten), Magen-Meter (unten)
  const top = layout.top ?? 18;
  const laneH = layout.laneH ?? (H - top * 2) / N;
  const xStart = layout.xStart ?? 96;
  const xEnd = layout.xEnd ?? W - 150;
  const fieldW = xEnd - xStart;
  const tableMidY = top + (H - 2 * top) / 2;
  const stomachY = H - 48; // Magen-Meter

  // Position eines Tokens auf dem x-Feld für einen gegebenen Score
  const xOfScore = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    return xStart + norm * fieldW;
  };

  // Effekte: Stack wächst mit Score (visuell synchron)
  const updateStackHeight = (t: RT, stackEl: SVGGElement | null) => {
    if (!stackEl) return;
    const norm = finalMax > 0 ? t.displayScore / finalMax : 0;
    // Stapel: max 13 Teller, Höhe 0–13px (1px pro Teller)
    const plateCount = Math.max(0, Math.min(13, Math.round(norm * 13)));
    // Entfernen alter Teller und neu zeichnen
    while (stackEl.firstChild) {
      stackEl.removeChild(stackEl.firstChild);
    }
    // Neue Teller-Ellipsen (übereinander gestapelt)
    for (let i = 0; i < plateCount; i++) {
      const plate = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      plate.setAttribute("cx", "0");
      plate.setAttribute("cy", `${i * 1.3}`);
      plate.setAttribute("rx", "3.5");
      plate.setAttribute("ry", "1.3");
      plate.setAttribute("fill", "#f2ede2");
      plate.setAttribute("stroke", "#b9ae9c");
      plate.setAttribute("stroke-width", "0.6");
      plate.setAttribute("opacity", `${0.7 + i * 0.02}`);
      stackEl.appendChild(plate);
    }
  };

  // Render-Update: Token-Positionen und Stacks aktualisieren (imperativ)
  useEffect(() => {
    rt.forEach((t) => {
      const gEl = gRefs.current.get(t.idx);
      if (gEl) {
        const xPos = xOfScore(t.displayScore);
        const yPos = top + t.laneIdx * laneH + laneH / 2;
        gEl.setAttribute("transform", `translate(${xPos} ${yPos})`);
      }
      const stackEl = stackRefs.current.get(t.idx);
      if (stackEl) {
        updateStackHeight(t, stackEl);
      }
    });

    // Gabel-Marker und Gorge-Meter (Führender) aktualisieren
    const leader = rt.find((t) => t.rank === 1);
    if (leader && gorgeRef.current && forkRef.current) {
      const leaderX = xOfScore(leader.displayScore);
      const gorgeW = Math.max(0, Math.min(fieldW, leaderX - xStart));
      gorgeRef.current.setAttribute("width", gorgeW.toString());
      forkRef.current.setAttribute("x", leaderX.toString());
    }
  }, [rt, top, laneH, xStart, finalMax, fieldW]);

  // Feld-Kunst: Banquet-Tisch mit rot-weiß Karierung, Neon-Schild, Dekoration
  const renderBanquetArt = (): React.ReactNode => {
    if (!env) {
      // Schlichte Variante (kein env)
      return (
        <>
          {/* Karierte Tafel */}
          {Array.from({ length: 24 }).map((_, i) =>
            Array.from({ length: 16 }).map((_, j) =>
              (i + j) % 2 === 0 ? (
                <rect
                  key={`check-${i}-${j}`}
                  x={xStart + (j * fieldW) / 16}
                  y={top + (i * (H - 2 * top)) / 24}
                  width={fieldW / 16}
                  height={(H - 2 * top) / 24}
                  fill="#4a2818"
                />
              ) : (
                <rect
                  key={`check-${i}-${j}`}
                  x={xStart + (j * fieldW) / 16}
                  y={top + (i * (H - 2 * top)) / 24}
                  width={fieldW / 16}
                  height={(H - 2 * top) / 24}
                  fill="#6a3420"
                />
              ),
            ),
          )}
          {/* Feldlinien */}
          <line x1={xStart} y1={top} x2={xStart} y2={H - top} stroke={skinAccent} strokeWidth={2} />
          <line x1={xEnd} y1={top} x2={xEnd} y2={H - top} stroke={skinAccent} strokeWidth={1.5} opacity={0.5} />
        </>
      );
    }

    // Mit Umgebung: atmosphärischer Banquet-Look
    return (
      <>
        {/* Karierte Tafel (ausgefeilter) */}
        {Array.from({ length: 28 }).map((_, i) =>
          Array.from({ length: 20 }).map((_, j) => {
            const dark = (i + j) % 2 === 0;
            return (
              <rect
                key={`band-${i}-${j}`}
                x={xStart + (j * fieldW) / 20}
                y={top + (i * (H - 2 * top)) / 28}
                width={fieldW / 20}
                height={(H - 2 * top) / 28}
                fill={dark ? "#5a2a1a" : "#8a4a3a"}
                opacity={0.8}
              />
            );
          }),
        )}
        {/* Neon-Schild: "WETTESSEN" oben */}
        <g>
          <rect
            x={W / 2 - 140}
            y={2}
            width={280}
            height={32}
            rx={6}
            fill="rgba(16, 9, 6, .75)"
            stroke={env.line}
            strokeWidth={1}
          />
          <text
            x={W / 2}
            y={22}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize={16}
            fontWeight={800}
            letterSpacing={4}
            fill={env.line}
            opacity={0.9}
          >
            WETTESSEN
          </text>
        </g>
        {/* Wimpel-Band */}
        {Array.from({ length: Math.floor(fieldW / 20) }).map((_, i) => (
          <g key={`banner-${i}`}>
            <line
              x1={xStart + (i * fieldW) / Math.floor(fieldW / 20)}
              y1={top - 6}
              x2={xStart + (i * fieldW) / Math.floor(fieldW / 20) + 10}
              y2={top + 8}
              stroke="rgba(230, 210, 180, .3)"
              strokeWidth={1}
            />
          </g>
        ))}
        {/* Buffet-Turm (Start) */}
        <g>
          <circle cx={xStart - 28} cy={tableMidY} r={12} fill={env.surface[0]} opacity={0.7} />
          <circle cx={xStart - 28} cy={tableMidY - 8} r={11} fill={env.surface[1]} opacity={0.6} />
          <text x={xStart - 28} y={tableMidY + 4} textAnchor="middle" fontSize={14}>
            🍖
          </text>
        </g>
        {/* Champion-Gürtel (Ziel) */}
        <g>
          <rect x={xEnd + 8} y={tableMidY - 12} width={30} height={24} rx={3} fill={env.line} opacity={0.3} />
          <text x={xEnd + 23} y={tableMidY + 2} textAnchor="middle" fontSize={16}>
            🏆
          </text>
        </g>
        {/* Ketchup- und Senf-Flaschen */}
        {[
          { x: xStart + fieldW * 0.15, color: "#e6432e" },
          { x: xStart + fieldW * 0.25, color: "#f2c14e" },
          { x: xEnd - fieldW * 0.22, color: "#e6432e" },
          { x: xEnd - fieldW * 0.12, color: "#f2c14e" },
        ].map((bottle, i) => (
          <g key={`bottle-${i}`}>
            <rect
              x={bottle.x - 2.5}
              y={top - 20}
              width={5}
              height={18}
              rx={2}
              fill={bottle.color}
              opacity={0.6}
            />
            <rect x={bottle.x - 1.5} y={top - 26} width={3} height={6} rx={1} fill={bottle.color} opacity={0.7} />
          </g>
        ))}
      </>
    );
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
      </defs>

      {/* Feldkunst */}
      {renderBanquetArt()}

      {/* Magen-Meter-Strip (unten) */}
      <g>
        <rect
          x={xStart - 14}
          y={stomachY - 12}
          width={fieldW + 28}
          height={28}
          rx={6}
          fill="rgba(16, 9, 6, .5)"
          stroke={env?.line ?? skinAccent}
          strokeWidth={0.8}
          opacity={0.6}
        />
        <text
          x={xStart - 4}
          y={stomachY - 2}
          fontSize={8}
          fontWeight={800}
          letterSpacing={1.5}
          fill={env?.line ?? skinAccent}
          opacity={0.7}
        >
          MAGEN-METER
        </text>
        {/* Meter-Bar (grau Hintergrund) */}
        <rect
          x={xStart}
          y={stomachY + 4}
          width={fieldW}
          height={8}
          rx={4}
          fill="rgba(0, 0, 0, .6)"
          stroke={env?.line ?? skinAccent}
          strokeWidth={0.6}
          opacity={0.4}
        />
        {/* Milestone-Marker (3 Phasen: 🍽 · 🍽🍽 · 🍽🍽🍽) */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <text
            key={`meter-${i}`}
            x={xStart + f * fieldW}
            y={stomachY + 24}
            textAnchor="middle"
            fontSize={9}
            opacity={0.5}
          >
            {["🍽", "🍽🍽", "🍽🍽🍽"][i]}
          </text>
        ))}
        <text x={xEnd + 6} y={stomachY + 24} textAnchor="middle" fontSize={9}>
          💥
        </text>
      </g>

      {/* Gabel-Marker (Führender) */}
      <g key="fork-marker">
        {/* Satt-Meter: gefüllte Portion des Meter-Bar */}
        <rect
          ref={gorgeRef}
          x={xStart}
          y={stomachY + 4}
          width={0}
          height={8}
          rx={4}
          fill="rgba(242, 193, 78, .35)"
          opacity={0.7}
          style={{ transition: reducedMotion ? "none" : "width 4.9s linear" }}
        />
        {/* Gabel emoji */}
        <text
          ref={forkRef}
          x={xStart}
          y={stomachY + 14}
          textAnchor="middle"
          fontSize={10}
          opacity={0.8}
          style={{
            transition: reducedMotion ? "none" : "x 4.9s linear",
            filter: "drop-shadow(0 0 4px rgba(242,193,78,.6))",
          }}
          pointerEvents="none"
        >
          🍴
        </text>
      </g>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text
          x={18}
          y={30}
          fontSize={18}
          fontWeight={800}
          letterSpacing="0.04em"
          fill={env ? env.line : skinAccent}
          opacity={env ? 0.6 : 0.85}
          style={{ textTransform: "uppercase" }}
        >
          {disciplineName}
        </text>
      ) : null}

      {/* Tokens: Esser mit Latz-Serviette + Tellerstapel */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const hue = hueForIdx(t.idx);
          const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
          const glowing = t.glowUntil > now;
          const rc = relColor(t.rel);
          const yPos = top + t.laneIdx * laneH + laneH / 2;
          // Position via displayScore direkt im JSX-transform (React setzt es bei jedem
          // Render → CSS-Transition gleitet 5s zum Runden-Ziel; unabhängig vom useEffect).
          const xPos = xOfScore(t.displayScore);

          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              transform={`translate(${xPos} ${yPos})`}
              style={{
                transition: reducedMotion ? "none" : "transform 5s cubic-bezier(.4,0,.2,1)",
                cursor: onOpenTeam && t.teamId ? "pointer" : "default",
              }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Tellerstapel (wächst unter dem Esser) */}
              <g
                ref={(el) => {
                  stackRefs.current.set(t.idx, el);
                }}
                transform={`translate(0 ${r + 2})`}
              >
                {/* Stapel-Balken: repeating-linear-gradient als rect mit Pattern */}
                <rect
                  data-stack-bar
                  x={-Math.min(4, r * 0.4)}
                  y={0}
                  width={Math.min(8, r * 0.8)}
                  height={0}
                  rx={1.5}
                  fill="url(#plateFill)"
                  opacity={0.85}
                />
              </g>

              {/* Medaillen-Ringe (Top-3) */}
              {medal ? (
                <circle r={r + 3} fill="none" stroke={medal} strokeWidth={t.isOwn ? 3.5 : 2.5} opacity={0.9} />
              ) : null}

              {/* Freund/Feind-Rahmen */}
              {rc ? <circle r={r + 5} fill="none" stroke={rc} strokeWidth={2} opacity={0.9} /> : null}

              {/* Glow (aktive Runde) */}
              {glowing ? (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={2.5}
                  opacity={0.7}
                  style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }}
                />
              ) : null}

              {/* Esser-Token (Wappen oder Farbe) */}
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

              {/* Token-Rand */}
              <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2 : 1.2} />

              {/* Latz-Serviette mit rot-weiß Streifen (oben) */}
              <g transform={`translate(0 ${-r - 2.5})`}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <rect
                    key={`serv-${t.code}-${i}`}
                    x={-r * 0.5 + (i % 2) * (r / 4)}
                    y={-3}
                    width={r / 4}
                    height={2.5}
                    fill={i % 2 === 0 ? "#f2ede2" : "#e6432e"}
                    rx={0.5}
                    opacity={0.9}
                  />
                ))}
              </g>

              {/* Krone (Rang 1) */}
              {t.rank === 1 ? (
                <text y={-(r + 7)} textAnchor="middle" fontSize={12}>
                  🏆
                </text>
              ) : null}

              {/* Eigenes Team: Stern + Code */}
              {t.isOwn ? (
                <text y={r + 12} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--nl-accent)">
                  ★ {t.code}
                </text>
              ) : null}
            </g>
          );
        })}

      {/* SVG-Defs: Teller-Stapel-Fill-Pattern */}
      <defs>
        <linearGradient id="plateFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2ede2" />
          <stop offset="50%" stopColor="#b9ae9c" />
          <stop offset="100%" stopColor="#f2ede2" />
        </linearGradient>
      </defs>
    </>
  );
}
