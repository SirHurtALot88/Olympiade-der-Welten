// =====================================================================================
// football (American Football) — 100-Yard Gridiron-Arena mit 32 Bahnen, rAF-Glide.
//
// Bewegung: pro Runde ein durchgehendes, weiches rAF-Gleiten entlang der Geraden
// (X-Richtung vom Start zur End Zone). Score bleibt Wahrheit. Dynamischer Easing pro
// Token (explosives Ease-out, Renn-Spannung). Hover friert ein. reduced-motion instant.
//
// Feld: Flutlicht-Nacht-Stadion, 100-Yard-Gridiron mit Yard-Linien, Hash-Marks,
// zwei End Zones, Goalposts, Pylonen, Flutlicht-Masten + Lichtkegel.
// Jedes Token trägt seinen eigenen Ball in der Hand (kein fliegendes Projektil).
// Touchdown: Surge-Animation + End-Zone-Flash + Stadion-Roar (via Host-FX).
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";

type Glide = { x: number; fromX: number; toX: number; glideT: number; gamma: number; target: number };

function easedPow(t: number, gamma: number): number {
  return Math.pow(Math.max(0, Math.min(1, t)), gamma);
}

export default function FootballField(props: DisciplineFieldProps): ReactNode {
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

  // Geometrie der 100-Yard-Geraden (Mockup: LW=840, LH=540).
  const LW = W;
  const LH = H;
  const PY0 = (34 / 540) * LH; // Bahn-Top
  const PY1 = (506 / 540) * LH; // Bahn-Bottom
  const CY = (PY0 + PY1) / 2; // Mittellinie (Y)
  const EZL0 = (30 / 840) * LW; // End Zone Links (Start)
  const GL0 = (90 / 840) * LW; // Goal Line 0 (Start)
  const GL100 = (730 / 840) * LW; // Goal Line 100 (Ende/Ziel)
  const EZR1 = (790 / 840) * LW; // End Zone Rechts (Ende)
  const LANES = 32;
  const LANE_H = (PY1 - PY0) / LANES;

  const laneY = (i: number): number => PY0 + (i + 0.5) * LANE_H;

  // Ziel-X für einen Score (Start nahe Goal Line 0, Ziel in der End Zone Rechts).
  const fracX = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    // 0.015 bis 0.985 normalisiert; X0 nahe GL0, X1 nahe GL100 (in der Zone)
    const X0 = GL0 + (40 / 840) * LW;
    const X1 = GL100 + (30 / 840) * LW;
    return X0 + (0.015 + norm * 0.985) * (X1 - X0);
  };

  // Runden-Erkennung: neuer Glide wenn displayScore sich ändert.
  const syncTargets = (): void => {
    const g = glideRef.current;
    const X0 = GL0 + (40 / 840) * LW;
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
          el.setAttribute("transform", `translate(${st.x} ${y})`);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SVG-Feldkunst: Flutlicht-Gridiron mit Yard-Linien, Zahlen, Hash-Marks, Pylonen, Goalposts.
  const renderFieldArt = (): string => {
    let s = "";

    // Nacht-Hintergrund + Radial-Gradient für Flutlicht-Effekt
    s += `<rect x="0" y="0" width="${LW}" height="${LH}" fill="#081009"/>`;
    s += `<defs>`;
    s += `<radialGradient id="flood" cx="50%" cy="42%" r="75%">
      <stop offset="0" stop-color="rgba(255,255,240,.16)"/>
      <stop offset=".6" stop-color="rgba(255,255,240,.05)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>`;
    s += `<pattern id="ezd" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 14 L14 0" stroke="rgba(255,255,255,.09)" stroke-width="3"/>
    </pattern>`;
    s += `</defs>`;

    // End Zones (links dunkelblau, rechts dunkelrot)
    s += `<rect x="${EZL0}" y="${PY0}" width="${GL0 - EZL0}" height="${PY1 - PY0}" fill="#16305e"/>`;
    s += `<rect x="${GL100}" y="${PY0}" width="${EZR1 - GL100}" height="${PY1 - PY0}" fill="#5e1622"/>`;
    // Diagonale Pattern über End Zones
    s += `<rect x="${EZL0}" y="${PY0}" width="${GL0 - EZL0}" height="${PY1 - PY0}" fill="url(#ezd)"/>`;
    s += `<rect x="${GL100}" y="${PY0}" width="${EZR1 - GL100}" height="${PY1 - PY0}" fill="url(#ezd)"/>`;

    // Mährasen-Bänder (10-Yard-Streifen, alternierend grün)
    const YPX = (GL100 - GL0) / 100;
    for (let k = 0; k < 10; k++) {
      const x = GL0 + k * 10 * YPX;
      const color = k % 2 ? "#228544" : "#186833";
      s += `<rect x="${x}" y="${PY0}" width="${10 * YPX}" height="${PY1 - PY0}" fill="${color}"/>`;
    }

    // Yard-Linien (alle 5 Yards; alle 10 kräftig) + Hash-Marks
    for (let y5 = 5; y5 < 100; y5 += 5) {
      const big = y5 % 10 === 0;
      const x = GL0 + y5 * YPX;
      const sw = big ? 2 : 1.2;
      const op = big ? 0.8 : 0.4;
      s += `<line x1="${x}" y1="${PY0}" x2="${x}" y2="${PY1}" stroke="rgba(244,250,246,${op})" stroke-width="${sw}"/>`;
    }

    // Hash-Marks (2-Yard-Intervalle)
    for (let hy = 2; hy < 100; hy += 2) {
      const hx = GL0 + hy * YPX;
      const hashTop = CY - 74 * (LH / 540);
      const hashBot = CY - 66 * (LH / 540);
      const hashBot2 = CY + 66 * (LH / 540);
      const hashTop2 = CY + 74 * (LH / 540);
      s += `<line x1="${hx}" y1="${hashTop}" x2="${hx}" y2="${hashBot}" stroke="rgba(244,250,246,.35)" stroke-width="1.2"/>`;
      s += `<line x1="${hx}" y1="${hashBot2}" x2="${hx}" y2="${hashTop2}" stroke="rgba(244,250,246,.35)" stroke-width="1.2"/>`;
    }

    // Yard-Zahlen (10-50-10) oben und unten
    for (const yd of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
      const lbl = yd <= 50 ? yd : 100 - yd;
      const x = GL0 + yd * YPX;
      const yTop = PY0 + 30 * (LH / 540);
      const yBot = PY1 - 16 * (LH / 540);
      s += `<text x="${x}" y="${yTop}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="15" font-weight="800" fill="rgba(244,250,246,.5)">${lbl}</text>`;
      s += `<text x="${x}" y="${yBot}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="15" font-weight="800" fill="rgba(244,250,246,.5)">${lbl}</text>`;
    }

    // Flutlicht-Teppich (Radial-Gradient über dem Feld)
    s += `<rect x="${EZL0}" y="${PY0}" width="${EZR1 - EZL0}" height="${PY1 - PY0}" fill="url(#flood)"/>`;

    // Außenlinien
    s += `<g stroke="rgba(244,250,246,.9)" stroke-width="2.4" fill="none">`;
    s += `<rect x="${EZL0}" y="${PY0}" width="${EZR1 - EZL0}" height="${PY1 - PY0}"/>`;
    // Goal Lines
    s += `<line x1="${GL0}" y1="${PY0}" x2="${GL0}" y2="${PY1}"/>`;
    s += `<line x1="${GL100}" y1="${PY0}" x2="${GL100}" y2="${PY1}"/>`;
    s += `</g>`;

    // Pylonen an Goal Lines und End Zone Ecken
    const pylonRadius = 2.5 * (LW / 840);
    const pylon = (x: number, y: number): string =>
      `<rect x="${x - pylonRadius}" y="${y - pylonRadius}" width="${pylonRadius * 2}" height="${pylonRadius * 2}" rx="1" fill="#f2812e"/>`;
    s += pylon(GL0, PY0);
    s += pylon(GL0, PY1);
    s += pylon(GL100, PY0);
    s += pylon(GL100, PY1);
    s += pylon(EZL0, PY0);
    s += pylon(EZL0, PY1);
    s += pylon(EZR1, PY0);
    s += pylon(EZR1, PY1);

    // H-förmige Goalposts (links und rechts der End Zones)
    const goalpostLeft = GL0 - 4 * (LW / 840);
    const goalpostRight = GL100 + 4 * (LW / 840);
    const u1 = CY - 34 * (LH / 540);
    const u2 = CY + 34 * (LH / 540);
    const cb = CY;
    const gpWidth = 10 * (LW / 840);
    const gpHeight = 26 * (LW / 840);

    s += `<g stroke="#f2c14d" stroke-width="4" fill="none" stroke-linecap="round">`;
    // Links
    s += `<line x1="${goalpostLeft}" y1="${cb}" x2="${goalpostLeft - gpWidth}" y2="${cb}"/>`;
    s += `<line x1="${goalpostLeft - gpWidth}" y1="${u1}" x2="${goalpostLeft - gpWidth}" y2="${u2}"/>`;
    s += `<line x1="${goalpostLeft - gpWidth}" y1="${u1}" x2="${goalpostLeft - gpWidth - gpHeight}" y2="${u1}"/>`;
    s += `<line x1="${goalpostLeft - gpWidth}" y1="${u2}" x2="${goalpostLeft - gpWidth - gpHeight}" y2="${u2}"/>`;
    // Rechts
    s += `<line x1="${goalpostRight}" y1="${cb}" x2="${goalpostRight + gpWidth}" y2="${cb}"/>`;
    s += `<line x1="${goalpostRight + gpWidth}" y1="${u1}" x2="${goalpostRight + gpWidth}" y2="${u2}"/>`;
    s += `<line x1="${goalpostRight + gpWidth}" y1="${u1}" x2="${goalpostRight + gpWidth + gpHeight}" y2="${u1}"/>`;
    s += `<line x1="${goalpostRight + gpWidth}" y1="${u2}" x2="${goalpostRight + gpWidth + gpHeight}" y2="${u2}"/>`;
    s += `</g>`;

    // Flutlicht-Masten + Lichtkegel (4 Ecken)
    const mastX1 = 16 * (LW / 840);
    const mastX2 = LW - 16 * (LW / 840);
    const mastY1 = 30 * (LH / 540);
    const mastY2 = LH - 8 * (LH / 540);
    const mastLightY1 = 14 * (LH / 540);
    const mastLightY2 = LH - 24 * (LH / 540);

    const mast = (x: number, y: number, tx: number, ty: number): string => {
      let m = `<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="#3a4a3e" stroke-width="3"/>`;
      m += `<g fill="#f4f0d6">`;
      m += `<circle cx="${tx - 5}" cy="${ty}" r="2.4"/>`;
      m += `<circle cx="${tx}" cy="${ty - 2}" r="2.4"/>`;
      m += `<circle cx="${tx + 5}" cy="${ty}" r="2.4"/>`;
      m += `</g>`;
      m += `<circle cx="${tx}" cy="${ty - 1}" r="9" fill="rgba(244,240,214,.28)"/>`;
      return m;
    };

    s += mast(mastX1, mastY1, mastX1, mastLightY1);
    s += mast(mastX2, mastY1, mastX2, mastLightY1);
    s += mast(mastX1, mastY2, mastX1, mastLightY2);
    s += mast(mastX2, mastY2, mastX2, mastLightY2);

    // Lichtkegel (Polygone) von den Masten
    const beam = (x1: number, y1: number, x2a: number, y2a: number, x2b: number, y2b: number): string =>
      `<polygon points="${x1},${y1} ${x2a},${y2a} ${x2b},${y2b}" fill="rgba(240,244,220,.05)"/>`;

    const beamX1L = 300 * (LW / 840);
    const beamX1R = 80 * (LW / 840);
    const beamX2L = LW - 300 * (LW / 840);
    const beamX2R = LW - 80 * (LW / 840);
    const beamYT = PY0 + 40 * (LH / 540);
    const beamYB = PY1 - 40 * (LH / 540);

    s += beam(mastX1, mastLightY1, beamX1L, beamYT, beamX1R, CY);
    s += beam(mastX2, mastLightY1, beamX2L, beamYT, beamX2R, CY);
    s += beam(mastX1, mastLightY2, beamX1L, beamYB, beamX1R, CY);
    s += beam(mastX2, mastLightY2, beamX2L, beamYB, beamX2R, CY);

    // END ZONE Beschriftung (groß, vertikal)
    s += `<text x="${GL100 + 30 * (LW / 840)}" y="${CY}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="17" font-weight="900" fill="rgba(255,255,255,.5)" transform="rotate(-90 ${GL100 + 30 * (LW / 840)} ${CY})" letter-spacing="4">END ZONE</text>`;

    return s;
  };

  return (
    <>
      {/* Feldkunst: Gridiron mit Yard-Linien, Goalposts, Flutlichter */}
      <g dangerouslySetInnerHTML={{ __html: renderFieldArt() }} />

      {/* Tokens: Helm-Stil mit Ball in der Hand, medaillen-umrandet, mit Hover + Click */}
      {sorted.map((t) => {
        const st = glideRef.current.get(t.idx);
        const x = st?.x ?? GL0;
        const y = laneY(t.laneIdx);
        const r = t.isOwn ? geo.rOwn : geo.r;
        const hue = hueForIdx(t.idx);
        const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
        const relC = relColor(t.rel);
        const isLeader = t.rank === 1;

        return (
          <g
            key={t.code}
            ref={(el) => {
              if (el) gRefs.current.set(t.idx, el);
            }}
            transform={`translate(${x} ${y})`}
            style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default", opacity: 1 }}
            onMouseEnter={() => openHover(t.idx)}
            onMouseLeave={scheduleHoverClose}
            onClick={() => {
              if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
            }}
          >
            {/* Helm-Basis (mit oder ohne Logo) */}
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

            {/* Helm-Rand (Beziehung oder Lead) */}
            {isLeader ? (
              <>
                {/* Lead: goldener Ring + größerer Helm */}
                <circle r={r + 5.5} fill="none" stroke="var(--nl-warn)" strokeWidth={3} opacity={0.7} />
                <circle r={r} fill="none" stroke="var(--nl-ink)" strokeWidth={2.5} />
              </>
            ) : relC ? (
              <circle r={r + 5.5} fill="none" stroke={relC} strokeWidth={2.4} opacity={0.95} />
            ) : (
              <circle r={r} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={1.4} />
            )}

            {/* Medaillen-Ring (Top-3) */}
            {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}

            {/* Team-Code (klein, unten rechts für Lesbarkeit) */}
            {t.isOwn ? (
              <text y={r + 10} textAnchor="middle" fontSize={9} fontWeight={800} fill="var(--nl-ink)">
                {t.code}
              </text>
            ) : null}

            {/* Ball in der Hand (kleines Oval, rechts-unten auf dem Helm) */}
            <ellipse cx={r - 3} cy={r - 3} rx={5.5} ry={3.5} fill="url(#ballGrad)" stroke="#4f2809" strokeWidth={1} />

            {/* Führungs-Krone (nur für Rang 1) */}
            {isLeader ? <text y={-(r + 8)} textAnchor="middle" fontSize={13}>👑</text> : null}
          </g>
        );
      })}

      {/* SVG-Defs für Ball-Gradient */}
      <defs>
        <radialGradient id="ballGrad" cx="38%" cy="30%">
          <stop offset="0%" stopColor="#d68f45" />
          <stop offset="100%" stopColor="#7a3d12" />
        </radialGradient>
      </defs>
    </>
  );
}
