// =====================================================================================
// breaking (Breaking Point · Survival-Cypher) — BESPOKE, ersetzt das Thermometer-Artwork.
//
// Konzept (Nutzer-Wunsch): lila Druck-Arena, in der alle Teams von außen NACH INNEN rücken.
// Wer am wenigsten „bricht" (höchster Score = am längsten UNBROKEN), steht am nächsten am
// Zentrum — dem SURVIVOR-Spotlight. Radius = Nähe zum Zentrum ∝ Score (score/finalMax →
// Vorstoß über die vollen Runden), Winkel = feste Team-Lane (Nachbarn bleiben lesbar).
// Score bleibt Wahrheit (animScore-Glide + Ghost). Druckwellen + Risse als Survival-FX.
// Benchmark-Chrome (Medaille/Team-Rahmen/Rang-Badge) wie überall.
// =====================================================================================
"use client";

import { type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export default function BreakingField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    reducedMotion,
    W,
    H,
    N,
    geo,
    finalMax,
    rt,
    sorted,
    done,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // ---- Cypher-Geometrie: außen = frisch gebrochen, Zentrum = Survivor ------------------
  const cx = W / 2;
  const cy = H / 2 + 8;
  const rOut = Math.min(W * 0.46, H * 0.44);
  const rIn = rOut * 0.14; // Survivor-Kern
  const KY = 0.82; // leichte Stauchung (Bühnen-Perspektive)

  // Fortschritt = ABSOLUT (score/finalMax) → Vorstoß nach innen zieht sich über die Runden.
  const normOf = (s: number): number => (finalMax > 0 ? clamp(s / finalMax, 0, 1) : 0);

  // lokale tokenPos: Radius = Nähe zum Zentrum ∝ Score, Winkel = feste Lane (13er-Schritt
  // gegen Klumpen), leichte y-Stauchung. Zentrum = Survivor.
  const angOf = (t: RT): number => (((t.laneIdx * 13) % Math.max(1, N)) / Math.max(1, N)) * Math.PI * 2 - Math.PI / 2;
  const tokenPos = (t: RT, score: number): { x: number; y: number } => {
    const radius = rOut - normOf(score) * (rOut - rIn);
    const a = angOf(t);
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius * KY };
  };

  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos });

  // Druck-Zonen (Ringe) von außen nach innen — pain/survival-Vokabular.
  const zones = [
    { f: 1.0, label: "GEBROCHEN" },
    { f: 0.72, label: "SCHMERZGRENZE" },
    { f: 0.46, label: "STONE FACE" },
    { f: 0.22, label: "MIND FORTRESS" },
  ];

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
        {/* Lila Bühnen-Hintergrund mit Zentrum-Glut */}
        <radialGradient id="brkBg" cx="50%" cy="52%" r="62%">
          <stop offset="0%" stopColor="hsl(275 55% 22%)" />
          <stop offset="55%" stopColor="hsl(278 50% 13%)" />
          <stop offset="100%" stopColor="hsl(280 45% 7%)" />
        </radialGradient>
        <radialGradient id="brkCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(214,150,255,.5)" />
          <stop offset="100%" stopColor="rgba(214,150,255,0)" />
        </radialGradient>
      </defs>

      {/* Bühne */}
      <rect x={0} y={0} width={W} height={H} fill="url(#brkBg)" />

      {/* Spotlight-Kegel von oben (zwei) */}
      <polygon points={`${cx - 40},0 ${cx - rOut * 0.5},${cy} ${cx + rOut * 0.2},${cy}`} fill="rgba(214,150,255,.05)" />
      <polygon points={`${cx + 40},0 ${cx - rOut * 0.2},${cy} ${cx + rOut * 0.5},${cy}`} fill="rgba(160,210,255,.045)" />

      {/* Druck-Zonen-Ringe (außen = gebrochen → innen = unbroken) */}
      {zones.map((z, i) => {
        const rr = rIn + (rOut - rIn) * z.f;
        return (
          <g key={`zone-${i}`} pointerEvents="none">
            <ellipse cx={cx} cy={cy} rx={rr} ry={rr * KY} fill="none" stroke="rgba(214,150,255,.16)" strokeWidth={1.2} strokeDasharray="4 8" />
            <text x={cx} y={cy - rr * KY - 3} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={8} fontWeight={800} letterSpacing={1.5} fill="rgba(214,170,255,.5)">
              {z.label}
            </text>
          </g>
        );
      })}

      {/* Boden-Risse (Druck) — vom Zentrum nach außen, deterministisch */}
      <g stroke="rgba(0,0,0,.35)" strokeWidth={1.4} pointerEvents="none">
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 9) * Math.PI * 2 + 0.4;
          const r1 = rIn + 6;
          const r2 = rOut * (0.6 + ((i * 37) % 40) / 100);
          const mx = cx + Math.cos(a) * (r1 + r2) * 0.5 + (((i * 53) % 20) - 10);
          const my = cy + Math.sin(a) * (r1 + r2) * 0.5 * KY;
          return <path key={`crack-${i}`} d={`M ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1 * KY} Q ${mx} ${my} ${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2 * KY}`} fill="none" />;
        })}
      </g>

      {/* Survivor-Kern (Zentrum) */}
      <ellipse cx={cx} cy={cy} rx={rIn * 2.4} ry={rIn * 2.4 * KY} fill="url(#brkCore)" pointerEvents="none" />
      <ellipse cx={cx} cy={cy} rx={rIn} ry={rIn * KY} fill="none" stroke="var(--nl-warn)" strokeWidth={1.6} strokeDasharray="6 5" pointerEvents="none">
        {!reducedMotion ? <animate attributeName="opacity" values="0.5;1;0.5" dur="1.6s" repeatCount="indefinite" /> : null}
      </ellipse>
      <text x={cx} y={cy - rIn * KY - 8} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={900} letterSpacing={2} fill="var(--nl-warn)" pointerEvents="none">
        SURVIVOR · UNBROKEN
      </text>

      {/* Druckwelle vom Zentrum (Survival-Puls) */}
      {!reducedMotion ? (
        <ellipse cx={cx} cy={cy} rx={rIn} ry={rIn * KY} fill="none" stroke="rgba(214,150,255,.5)" strokeWidth={2} pointerEvents="none">
          <animate attributeName="rx" values={`${rIn};${rOut}`} dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="ry" values={`${rIn * KY};${rOut * KY}`} dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur="2.6s" repeatCount="indefinite" />
        </ellipse>
      ) : null}

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill="hsl(275 60% 72%)" opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Token. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: Überlebende — Position via rAF (animScore). Rang-Reihenfolge rückwärts. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;
          const isLead = t.rank === 1;
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
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Führer = Survivor: lila-goldener Puls-Ring. */}
              {isLead ? <circle r={r + 7} fill="none" stroke="var(--nl-warn)" strokeWidth={2.4} opacity={0.85} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.4s ease-in-out infinite" }} /> : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Breaking trägt seine eigene Survivor-Krone. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {(isLead && done) || isLead ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  👑
                </text>
              ) : null}
            </g>
          );
        })}
    </>
  );
}
