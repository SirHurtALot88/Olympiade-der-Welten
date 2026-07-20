// =====================================================================================
// takeshi (Takeshi's Castle) — Hindernnis-Parcours · Serpentinen-Kurs
//
// Bewegung: pro Runde ein durchgehendes, weiches rAF-Gleiten ENTLANG des Serpentinen-
// Pfads (Arc-Length, folgt der Kurve). Score bleibt Wahrheit. Dynamisches Easing pro
// Token. Hover friert ein. reduced-motion instant.
//
// Rendering: Helle Game-Show-Wiese (statt Abendarena), Schlammgrube, rollende Stämme,
// Drehteller, Sturmangriff (rote Kugeln), Takeshis Burg als Ziel. Alle 32 Teams rennen
// simultan den Parcours entlang — Fortschritt auf dem Pfad = Punkte.
// =====================================================================================
"use client";

import { useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT, Vec2 } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

export default function TakeshiField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    reducedMotion,
    W,
    H,
    geo,
    finalMax,
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

  // Band-Path (der GEZEICHNETE Burg-Parcours) — die Token laufen GENAU hier entlang.
  const bandD = "M 70 545 H 760 A 85 85 0 0 0 760 375 H 140 A 85 85 0 0 1 140 205 H 800";
  // Lokaler tokenPos: Fortschritt ENTLANG des gezeichneten Bandes (Bogenlänge) = Score.
  // Der Host-parcours-tokenPos nutzt einen anderen Wegpunkt-Pfad → Läufer verließen die
  // gezeichnete Strecke. Ein unsichtbarer Mess-Pfad (pathRef) liefert getPointAtLength.
  const pathRef = useRef<SVGPathElement | null>(null);
  const localTokenPos = (t: RT, score: number): Vec2 => {
    const path = pathRef.current;
    if (!path) return { x: 70, y: 545 };
    const PER = path.getTotalLength();
    const norm = finalMax > 0 ? Math.max(0, Math.min(1, score / finalMax)) : 0;
    const L = (0.02 + norm * 0.96) * PER;
    const pt = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(PER, L + 2));
    let tx = p2.x - pt.x;
    let ty = p2.y - pt.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const lane = (t.laneIdx % 5) - 2; // Quer-Versatz für Auffächerung (kein Stapel)
    return { x: pt.x + -ty * lane * 9, y: pt.y + tx * lane * 9 };
  };
  // Benchmark-Bewegung + Ghost: Token folgen animScore ENTLANG des Bandes (Hover/Pause friert ein).
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos: localTokenPos });

  // Hilfsfunktionen für Course-Artwork
  const crowd = (): string => {
    const cols = ["#e0b23c", "#d16a4a", "#4a76c8", "#7ab86a", "#c47ab8", "#f0ece0"];
    const hash = (s: string): number => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) / 4294967295);
    };
    let s = "";
    for (let i = 0; i < 180; i++) {
      const x = 14 + ((i * 89) % (W - 28)) + (hash("cx" + i) - 0.5) * 9;
      const y = 64 + hash("cy" + i) * 34;
      const c = cols[Math.floor(hash("cc" + i) * cols.length)];
      const o = 0.4 + hash("co" + i) * 0.4;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 + hash("cr" + i) * 1.2).toFixed(1)}" fill="${c}" opacity="${o.toFixed(2)}"/>`;
    }
    return s;
  };

  const bunting = (y: number): string => {
    const cols = ["#e03c30", "#f6c750", "#4a76c8", "#f0ece0"];
    const hash = (s: string): number => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) / 4294967295);
    };
    let s = `<path d="M 12 ${y} H ${W - 12}" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>`;
    for (let x = 18; x < W - 14; x += 24) {
      const c = cols[Math.floor(hash("b" + x) * cols.length)];
      s += `<path d="M ${x} ${y} l 6 9 l 6 -9 Z" fill="${c}" opacity=".75"/>`;
    }
    return s;
  };

  const logs = (): string => {
    let s = "";
    const xs = [540, 610];
    xs.forEach((x, i) => {
      const rot = i ? -8 : 7;
      s += `<g transform="rotate(${rot} ${x} 375)">`;
      s += `<rect x="${x - 8}" y="343" width="16" height="64" rx="8" fill="#8a5a30" stroke="#5e3c1c" stroke-width="1.5"/>`;
      s += `<path d="M ${x - 8} 355 h 16 M ${x - 8} 369 h 16 M ${x - 8} 383 h 16" stroke="#5e3c1c" stroke-width="1" opacity=".6"/>`;
      s += `<circle cx="${x}" cy="343" r="8" fill="#c89a5e" stroke="#5e3c1c" stroke-width="1.5"/>`;
      s += `</g>`;
    });
    return s;
  };

  const castle = (): string => {
    let s = "";
    s += `<rect x="806" y="152" width="86" height="100" rx="4" fill="#9aa3ad" stroke="#5c6674" stroke-width="1.5"/>`;
    for (let x = 808; x < 890; x += 12)
      s += `<rect x="${x}" y="146" width="8" height="10" fill="#9aa3ad" stroke="#5c6674" stroke-width="1"/>`;
    s += `<rect x="812" y="120" width="20" height="42" fill="#8a939e" stroke="#5c6674" stroke-width="1.5"/>`;
    s += `<path d="M 806 122 L 822 100 L 838 122 Z" fill="#c0392b" stroke="#7c1810" stroke-width="1.5"/>`;
    s += `<rect x="866" y="120" width="20" height="42" fill="#8a939e" stroke="#5c6674" stroke-width="1.5"/>`;
    s += `<path d="M 860 122 L 876 100 L 892 122 Z" fill="#c0392b" stroke="#7c1810" stroke-width="1.5"/>`;
    s += `<path d="M 800 154 L 849 128 L 898 154 Z" fill="#c0392b" stroke="#7c1810" stroke-width="1.5"/>`;
    s += `<path d="M 834 252 V 214 A 15 15 0 0 1 864 214 V 252 Z" fill="#2a2027" stroke="#5c6674" stroke-width="1.5"/>`;
    s += `<text x="849" y="176" text-anchor="middle" font-size="14">🏯</text>`;
    s += `<text x="849" y="266" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="8.5" font-weight="800" letter-spacing="1.5" fill="#3c2f14">TAKESHIS BURG</text>`;
    return s;
  };

  return (
    <>
      {/* Background: sky, grass, atmosphere */}
      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f9fd8" />
          <stop offset="100%" stopColor="#a8dcf5" />
        </linearGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5aa050" />
          <stop offset="100%" stopColor="#437e3e" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x={0} y={0} width={W} height={118} fill="url(#sky)" />
      <circle cx={88} cy={34} r={16} fill="#ffe9a0" opacity={0.9} />
      <ellipse cx={300} cy={36} rx={34} ry={10} fill="rgba(255,255,255,.75)" />
      <ellipse cx={560} cy={26} rx={26} ry={8} fill="rgba(255,255,255,.65)" />
      <text x={W / 2} y={30} textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontWeight={800} fontSize={17} letterSpacing={5} fill="#14324a" opacity={0.55}>
        TAKESHI'S CASTLE · STURM AUF DIE BURG
      </text>
      <g dangerouslySetInnerHTML={{ __html: bunting(44) }} />
      <g dangerouslySetInnerHTML={{ __html: crowd() }} />

      {/* Grass field */}
      <rect x={0} y={118} width={W} height={H - 118} fill="url(#grass)" />

      {/* Mess-Pfad (unsichtbar) — localTokenPos liest getPointAtLength für die Bewegung. */}
      <path ref={pathRef} d={bandD} fill="none" stroke="none" />

      {/* Serpentinen-Band: Erdweg mit heller Lauffläche + gestrichelter Mittellinie */}
      <path d={bandD} fill="none" stroke="#a97c46" strokeWidth={58} strokeLinecap="round" />
      <path d={bandD} fill="none" stroke="#d8b078" strokeWidth={46} strokeLinecap="round" />
      <path d={bandD} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth={2} strokeDasharray="10 14" />

      {/* Schlammgrube (Etappe 1) */}
      <ellipse cx={380} cy={545} rx={88} ry={22} fill="#6b4426" />
      <ellipse cx={352} cy={541} rx={26} ry={8} fill="#7a5230" opacity={0.9} />
      <ellipse cx={412} cy={550} rx={30} ry={9} fill="#553318" opacity={0.9} />
      <circle cx={340} cy={551} r={3} fill="#8a6a42" opacity={0.8} />
      <circle cx={398} cy={538} r={2.5} fill="#8a6a42" opacity={0.8} />
      <circle cx={428} cy={547} r={3} fill="#8a6a42" opacity={0.8} />
      <text x={380} y={552} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9} fontWeight={800} letterSpacing={2} fill="#3c2f14">
        SCHLAMMGRUBE
      </text>

      {/* Rollende Stämme (Etappe 2) */}
      <g dangerouslySetInnerHTML={{ __html: logs() }} />
      <text x={575} y={336} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9} fontWeight={800} letterSpacing={2} fill="#3c2f14">
        ROLLENDE STÄMME
      </text>

      {/* Drehteller-Zone Label */}
      <text x={300} y={336} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9} fontWeight={800} letterSpacing={2} fill="#3c2f14">
        DREHTELLER
      </text>

      {/* Sturmangriff-Zone: Warnstreifen */}
      {[0, 1].map((group) => {
        const gx = group ? 648 : 410;
        return (
          <g key={`warn-${group}`}>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={gx + i * 8} y={175} width={4} height={60} fill={i % 2 ? "#f0ece0" : "#e03c30"} transform={`rotate(12 ${gx} 205)`} />
            ))}
          </g>
        );
      })}
      <text x={530} y={172} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9} fontWeight={800} letterSpacing={2} fill="#7c1810">
        ⚠ STURMANGRIFF · ROLLENDE KUGELN
      </text>

      {/* Start: kariertes Band + rote Fahne */}
      <rect x={64} y={517} width={12} height={56} fill="#f0ece0" />
      <rect x={64} y={517} width={12} height={14} fill="#181a20" />
      <rect x={64} y={545} width={12} height={14} fill="#181a20" />
      <circle cx={70} cy={506} r={4} fill="#e03c30" />
      <path d="M 70 506 V 486 l 14 5 l -14 5" fill="#e03c30" stroke="#7c1810" strokeWidth={1} />
      <text x={70} y={552} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9.5} fontWeight={800} letterSpacing={2} fill="#3c2f14">
        START
      </text>

      {/* Takeshis Burg */}
      <g dangerouslySetInnerHTML={{ __html: castle() }} />

      {/* Disziplin-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Läufern. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: 32 Läufer auf dem Pfad — Position via rAF (animScore, Benchmark-Sync). */}
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
              ref={tokenRef(gRefs, t, localTokenPos)}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Führungs-/Glow-Puls (bespoke FX) */}
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge + 🏆. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} />
            </g>
          );
        })}
    </>
  );
}
