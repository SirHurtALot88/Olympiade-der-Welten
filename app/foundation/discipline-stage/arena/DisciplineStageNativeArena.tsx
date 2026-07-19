"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useStageAudio } from "./useStageAudio";
import DisciplineStageResultTable, { type ResultTableRow } from "./DisciplineStageResultTable";
import DisciplineStageTopPlayersRow from "../DisciplineStageTopPlayersRow";
import type { DisciplineStageTopPlayer } from "../DisciplineStageTopPlayers";
import { fmt1, ampel } from "../stage-format";
import type { TeamRelationshipKind } from "@/lib/foundation/team-relationship";

// Freund/Feind-Rahmenfarbe (mine=blau, ally=grün, rival=rot) über die globalen
// --nl-* Tokens (Light/Dark ziehen automatisch mit). Marker = Rahmen, nie Füllung.
function relColor(rel: TeamRelationshipKind | null | undefined): string | null {
  if (!rel) return null;
  return `var(--nl-${rel})`;
}
const REL_GLYPH: Record<TeamRelationshipKind, string> = { mine: "★", ally: "🤝", rival: "⚔" };

// Nativer Track-Nachbau der Staffel-Arena — voller Feature-Stand der iframe-Szene:
// SVG/viewBox (pixelscharf), Bewegungsanimation (Token gleitet, eigenes Team Slow-Mo),
// Sounds (WebAudio), Highlights (Flash/Shake/Spotlight/Glow/Score-Pop/Splitter),
// Runden-Medaillen, Ticker, Hovercard, Podest + Detail-Ergebnistabelle.
// Position auf dem Oval = kumulierte Punkte. Reveal Slot für Slot, worst-first.

export type NativeStageMod = { k: string; sign: 1 | -1; amt: number };
export type NativeStagePlayer = {
  playerId: string | null;
  val: number;
  name: string;
  portraitUrl: string | null;
  mods: NativeStageMod[];
  pointsAwarded: number | null;
};
export type NativeStageTeam = {
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  players: NativeStagePlayer[];
  seasonRank?: number; // echter Season-Tabellenrang → Bahn-/Turm-Reihenfolge
  teamId?: string; // für Team-Drawer
  rel?: TeamRelationshipKind | null; // Freund/Feind (mine/ally/rival) → Rahmen-Marker
};
export type StagePrimitive =
  | "track"
  | "lanes"
  | "towers"
  | "stage"
  // Row-Familie (eine Reihe je Team, x = Fortschritt, eigenes Reihen-Motiv):
  | "platter" // Wettessen — leergegessene Teller + 🍴
  | "lamps" // Fechten — Treffer-Lampen (rot/grün)
  | "spybar" // I Spy — Späh-/Sichtfeld-Balken, 🔍 an der Scan-Kante
  | "kda" // TDM — K/D/A-Scoreboard (aus Score abgeleitet) + KDA-Balken
  | "duelhp" // Mini-DM — Fighting-Game-Lebensbalken (skewX) + K.O.-Warnung
  // Turm-Familie (Säule je Team, Höhe = Punkte):
  | "barbell" // Gewichtheben — Hantel-Säulen mit Scheiben
  | "sparkbar" // universeller Fallback — schlanke Spark-Säulen
  | "thermometer" // Breaking — Schmerz-Thermometer (grün → glühend rot)
  // Szenen (atmosphärisches Feld, Score = Position):
  | "peloton" // Zeitfahren — Straße mit Ausreißer/Feld
  | "parcours" // Takeshi — Schlangen-Parcours
  | "bump" // Spurt — Slalom/Bump: Rang-über-Etappen-Linien (nutzt rankHistory)
  | "mountain" // Climbing — Gipfelsturm (Berg-Serpentine)
  | "court" // Basketball — Wurfkarte (Halbfeld)
  | "rink" // Hockey — Eisrink von oben
  // Voll-Feld-Sonderlayouts (kein Token-auf-Feld, aus ALLEN Scores berechnet):
  | "klassen" // Schach/Tennis — Liga-Klassen-Bänder nach Punkt-Lücken
  | "territory"; // Battlefield — Squarified Treemap, Fläche ∝ Score, %-Label + 🚩

// Familien mit geteilter Geometrie: Row-Familie rechnet wie "lanes",
// Turm-Familie wie "towers". Nur der Hintergrund/Overlay unterscheidet sie.
const ROW_FAMILY = new Set<StagePrimitive>(["lanes", "platter", "lamps", "spybar", "kda", "duelhp"]);
const TOWER_FAMILY = new Set<StagePrimitive>(["towers", "barbell", "sparkbar", "thermometer"]);
// Szenen-Primitive: eigenes atmosphärisches Feld (Straße/Berg/Court/Rink/Parcours).
const SCENE_PRIMS = new Set<StagePrimitive>(["peloton", "mountain", "court", "rink", "parcours", "bump"]);
// Voll-Feld-Sonderlayouts: eigener Render-Zweig aus ALLEN Scores (kein gleitendes
// Token, keine Bahn/Turm/Szene-Geometrie). deco/glow + Token-Schleife entfallen.
const FIELD_CUSTOM = new Set<StagePrimitive>(["klassen", "territory"]);
export type DisciplineStageNativeArenaProps = {
  teams: NativeStageTeam[];
  slots: string[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  onOpenTeam?: ((teamId: string) => void) | null; // Token/Ladder-Klick → Team-Drawer
  onHoverTeam?: ((teamId: string | null) => void) | null; // Ladder-Hover → Team-Vorschau
  onPreviewPlayer?: ((playerId: string | null) => void) | null; // Top-Player-Hover → Vorschau
  onEnded?: (() => void) | null; // feuert einmal, sobald das Podest/Endstand erreicht ist (Spoiler-Gate)
  topPlayers?: { rows: DisciplineStageTopPlayer[]; ids: (string | null)[] } | null;
  primitive?: StagePrimitive;
  progressLabel?: string; // z.B. "Position auf dem Oval = kumulierte Punkte"
  disciplineName?: string; // Feld-Wasserzeichen (Identität je Disziplin)
  accent?: string; // Akzentfarbe der Disziplin (Wasserzeichen + Feldlinien)
  motif?: StageMotif; // dezentes Hintergrund-Motiv
  env?: StageEnv; // atmosphärische Umgebung (Stadion o.ä.) — überschreibt die schlichte Optik
};

export type StageMotif = "chevrons" | "combat" | "board" | "court" | "weights" | "grid" | "ice" | "stage" | "plates" | "skyline" | "none";

// Atmosphärische Umgebung je Primitive (Fable-Konzept): Farbschichten +
// Lichtstimmung + 0-2 Deko-Layer. Alle Werte hsl()/rgb() (kein Hex → Lint).
export type StageEnv = {
  sky: [string, string]; // Hintergrund-Verlauf (oben, unten) — alle Primitive
  stands: string; // Rückwand: track=Tribünenring, lanes/towers=Horizontband
  surface: [string, string, string]; // track=Bahnring; lanes=Bahnfläche; towers=Boden
  line: string; // Markierungen / Ziel / Grundlinie
  infield?: [string, string]; // nur track (Rasen)
  glow?: { color: string; kind: "spot" | "finish" | "floor" | "flood" };
  deco?: StageDeco[]; // hinter den Tokens
};

export type StageDeco =
  | { kind: "skyline"; back: string; front: string; windows: string }
  | { kind: "spotlights"; color: string; count: number }
  | { kind: "lanterns"; color: string; halo: string }
  | { kind: "banners"; cloth: string; trim: string }
  | { kind: "checker"; light: string; dark: string }
  | { kind: "grid"; color: string }
  | { kind: "holds"; colors: string[] }
  | { kind: "sheen"; color: string }
  | { kind: "silhouette"; color: string };

// Dezentes Feld-Motiv je Disziplin (Skin). Bewusst leise (niedrige Deckkraft),
// die Akzentfarbe kommt aus der Disziplin. Kein DOM-Overhead: wenige SVG-Formen.
function renderMotif(motif: StageMotif | undefined, W: number, H: number, accent: string): React.ReactNode {
  if (!motif || motif === "none") return null;
  const c = accent;
  const op = 0.5;
  if (motif === "chevrons") {
    return (
      <g opacity={op} fill="none" stroke={c} strokeWidth={3}>
        {Array.from({ length: 6 }).map((_, i) => {
          const x = W * (0.12 + i * 0.13);
          return <polyline key={i} points={`${x},${H * 0.3} ${x + 26},${H * 0.5} ${x},${H * 0.7}`} />;
        })}
      </g>
    );
  }
  if (motif === "combat") {
    return (
      <g opacity={op} stroke={c} strokeWidth={2.5}>
        {Array.from({ length: 8 }).map((_, i) => {
          const x = W * (0.1 + i * 0.11);
          return (
            <g key={i}>
              <line x1={x} y1={H * 0.34} x2={x + 40} y2={H * 0.66} />
              <line x1={x + 40} y1={H * 0.34} x2={x} y2={H * 0.66} />
            </g>
          );
        })}
      </g>
    );
  }
  if (motif === "board") {
    return (
      <g opacity={op * 0.7} fill={c}>
        {Array.from({ length: 8 }).map((_, r) =>
          Array.from({ length: 8 }).map((_, col) =>
            (r + col) % 2 === 0 ? <rect key={`${r}-${col}`} x={W - 220 + col * 26} y={H / 2 - 104 + r * 26} width={26} height={26} /> : null,
          ),
        )}
      </g>
    );
  }
  if (motif === "court") {
    return (
      <g opacity={op} fill="none" stroke={c} strokeWidth={2.5}>
        <line x1={W / 2} y1={H * 0.12} x2={W / 2} y2={H * 0.88} />
        <circle cx={W / 2} cy={H / 2} r={70} />
      </g>
    );
  }
  if (motif === "weights") {
    return (
      <g opacity={op} fill={c}>
        <rect x={W / 2 - 130} y={H / 2 - 6} width={260} height={12} rx={6} />
        {[-150, -120, 120, 150].map((dx, i) => (
          <rect key={i} x={W / 2 + dx - 6} y={H / 2 - 44} width={12} height={88} rx={4} />
        ))}
      </g>
    );
  }
  if (motif === "grid") {
    return (
      <g opacity={op * 0.8} fill={c}>
        {Array.from({ length: 7 }).map((_, r) =>
          Array.from({ length: 12 }).map((_, col) => <circle key={`${r}-${col}`} cx={W * (0.1 + col * 0.072)} cy={H * (0.16 + r * 0.11)} r={4} />),
        )}
      </g>
    );
  }
  if (motif === "ice") {
    return (
      <g opacity={op} stroke={c} strokeWidth={2}>
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={i} x1={W * 0.08} y1={H * (0.2 + i * 0.1)} x2={W * 0.92} y2={H * (0.2 + i * 0.1)} strokeDasharray="30 22" />
        ))}
      </g>
    );
  }
  if (motif === "stage") {
    return (
      <g opacity={op * 0.8} fill={c}>
        <polygon points={`${W * 0.28},0 ${W * 0.4},0 ${W * 0.5},${H} ${W * 0.34},${H}`} />
        <polygon points={`${W * 0.62},0 ${W * 0.74},0 ${W * 0.66},${H} ${W * 0.5},${H}`} />
      </g>
    );
  }
  if (motif === "plates") {
    return (
      <g opacity={op} fill="none" stroke={c} strokeWidth={2.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <circle key={i} cx={W * (0.18 + i * 0.16)} cy={H / 2} r={44} />
        ))}
      </g>
    );
  }
  // skyline
  return (
    <g opacity={op} fill={c}>
      {Array.from({ length: 14 }).map((_, i) => {
        const bw = W / 16;
        const bh = H * (0.18 + ((i * 37) % 40) / 100);
        return <rect key={i} x={W * 0.06 + i * bw} y={H - bh - 4} width={bw - 6} height={bh} />;
      })}
    </g>
  );
}

// Lichtstimmung (ein Layer, per kind positioniert). groundY = Boden/Grundlinie.
function envGlow(glow: NonNullable<StageEnv["glow"]>, W: number, H: number, groundY: number, finishX: number): React.ReactNode {
  const c = glow.color;
  if (glow.kind === "spot") {
    return <ellipse cx={W / 2} cy={groundY - 90} rx={210} ry={72} fill={c} opacity={0.16} />;
  }
  if (glow.kind === "floor") {
    return <rect x={0} y={groundY - 26} width={W} height={30} fill={c} opacity={0.13} />;
  }
  if (glow.kind === "finish") {
    return (
      <g>
        <rect x={finishX - 16} y={0} width={32} height={H} fill={c} opacity={0.12} />
        <rect x={finishX - 2} y={0} width={4} height={H} fill={c} opacity={0.55} />
      </g>
    );
  }
  // flood — zwei Lichtkegel von oben
  return (
    <g fill={c} opacity={0.1}>
      <polygon points={`${W * 0.3},0 ${W * 0.42},0 ${W * 0.52},${H} ${W * 0.36},${H}`} />
      <polygon points={`${W * 0.58},0 ${W * 0.7},0 ${W * 0.64},${H} ${W * 0.48},${H}`} />
    </g>
  );
}

// Deko-Layer (Daten → SVG). groundY = Boden für skyline/silhouette.
function envDeco(deco: StageDeco, W: number, H: number, groundY: number, key: number): React.ReactNode {
  if (deco.kind === "skyline") {
    return (
      <g key={key}>
        <g fill={deco.back} opacity={0.9}>
          {Array.from({ length: 11 }).map((_, i) => {
            const bw = W / 11;
            const bh = H * (0.16 + ((i * 53) % 34) / 100);
            return <rect key={i} x={i * bw} y={groundY - bh} width={bw + 1} height={bh} />;
          })}
        </g>
        <g fill={deco.front}>
          {Array.from({ length: 8 }).map((_, i) => {
            const bw = W / 8;
            const bh = H * (0.1 + ((i * 71) % 26) / 100);
            return <rect key={i} x={i * bw + 12} y={groundY - bh} width={bw - 24} height={bh} />;
          })}
        </g>
        <g fill={deco.windows} opacity={0.85}>
          {Array.from({ length: 8 }).flatMap((_, i) =>
            Array.from({ length: 4 }).map((__, r) => {
              const on = (i * 7 + r * 13) % 3 === 0;
              return on ? <rect key={`${i}-${r}`} x={i * (W / 8) + 24 + (r % 2) * 14} y={groundY - 34 - r * 16} width={5} height={7} /> : null;
            }),
          )}
        </g>
      </g>
    );
  }
  if (deco.kind === "spotlights") {
    return (
      <g key={key} fill={deco.color} opacity={0.16}>
        {Array.from({ length: deco.count }).map((_, i) => {
          const cx = W * (0.5 + (i - (deco.count - 1) / 2) * 0.22);
          return <polygon key={i} points={`${cx - 12},0 ${cx + 12},0 ${cx + 90},${H} ${cx - 90},${H}`} />;
        })}
      </g>
    );
  }
  if (deco.kind === "lanterns") {
    return (
      <g key={key}>
        {Array.from({ length: 6 }).map((_, i) => {
          const cx = W * (0.12 + i * 0.152);
          return (
            <g key={i}>
              <circle cx={cx} cy={44} r={16} fill={deco.halo} opacity={0.3} />
              <circle cx={cx} cy={44} r={7} fill={deco.color} />
            </g>
          );
        })}
      </g>
    );
  }
  if (deco.kind === "banners") {
    return (
      <g key={key}>
        {Array.from({ length: 3 }).map((_, i) => {
          const cx = W * (0.24 + i * 0.26);
          return (
            <g key={i}>
              <rect x={cx - 16} y={40} width={32} height={72} fill={deco.cloth} opacity={0.85} />
              <polygon points={`${cx - 16},112 ${cx + 16},112 ${cx},130`} fill={deco.cloth} opacity={0.85} />
              <rect x={cx - 16} y={40} width={32} height={6} fill={deco.trim} />
            </g>
          );
        })}
      </g>
    );
  }
  if (deco.kind === "checker") {
    return (
      <g key={key} opacity={0.1}>
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 16 }).map((__, col) =>
            (r + col) % 2 === 0 ? <rect key={`${r}-${col}`} x={col * (W / 16)} y={H * 0.4 + r * 24} width={W / 16} height={24} fill={deco.light} /> : <rect key={`${r}-${col}`} x={col * (W / 16)} y={H * 0.4 + r * 24} width={W / 16} height={24} fill={deco.dark} />,
          ),
        )}
      </g>
    );
  }
  if (deco.kind === "grid") {
    return (
      <g key={key} stroke={deco.color} strokeWidth={1.4} opacity={0.15} fill="none">
        {[0.55, 0.68, 0.8, 0.92].map((f, i) => (
          <line key={i} x1={0} y1={H * f} x2={W} y2={H * f} />
        ))}
        {Array.from({ length: 13 }).map((_, i) => {
          const x = (i / 12) * W;
          return <line key={i} x1={x} y1={H * 0.55} x2={W / 2 + (x - W / 2) * 2.2} y2={H} />;
        })}
      </g>
    );
  }
  if (deco.kind === "holds") {
    return (
      <g key={key} opacity={0.5}>
        {Array.from({ length: 26 }).map((_, i) => {
          const x = ((i * 137.5) % 96) / 100;
          const y = ((i * 71) % 80) / 100;
          const col = deco.colors[i % deco.colors.length];
          return <circle key={i} cx={W * (0.03 + x * 0.94)} cy={H * (0.08 + y)} r={i % 3 === 0 ? 7 : 5} fill={col} />;
        })}
      </g>
    );
  }
  if (deco.kind === "sheen") {
    return <polygon key={key} points={`${W * 0.1},0 ${W * 0.28},0 ${W * 0.6},${H} ${W * 0.42},${H}`} fill={deco.color} opacity={0.12} />;
  }
  // silhouette — gezackter Horizont (Palisade/Bäume)
  const pts: string[] = [`0,${groundY}`];
  const n = 20;
  for (let i = 0; i <= n; i += 1) {
    const x = (i / n) * W;
    const h = groundY - 26 - ((i * 47) % 34);
    pts.push(`${x},${h}`, `${x + W / n / 2},${groundY - 14}`);
  }
  pts.push(`${W},${groundY}`);
  return <polygon key={key} points={pts.join(" ")} fill={deco.color} opacity={0.9} />;
}

// Wegpunkt-Pfad als SVG-d (für Serpentine/Parcours-Route).
function wpPath(wp: [number, number][]): string {
  return wp.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
}

// Atmosphärisches Feld für die Szenen-Primitive. Alle Layer HINTER den Tokens,
// Farben aus env (hsl/rgba/CSS-Token, kein Hex → Design-Token-Lint bleibt sauber).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSceneEnvBg(prim: StagePrimitive, env: StageEnv, layout: any, W: number, H: number): React.ReactNode {
  if (prim === "peloton") {
    const { roadY, padL, padR } = layout;
    return (
      <>
        <rect x={0} y={roadY + 46} width={W} height={H - roadY - 46} fill={env.surface[2]} opacity={0.5} />
        <line x1={padL} y1={roadY} x2={W - padR} y2={roadY} stroke={env.stands} strokeWidth={78} strokeLinecap="round" />
        <line x1={padL} y1={roadY} x2={W - padR} y2={roadY} stroke="url(#envSurface)" strokeWidth={64} strokeLinecap="round" />
        <line x1={padL} y1={roadY} x2={W - padR} y2={roadY} stroke={env.line} strokeWidth={2} strokeDasharray="6 24" opacity={0.5} />
        <rect x={W - padR - 10} y={roadY - 40} width={5} height={80} fill={env.line} opacity={0.85} />
        <text x={W - padR - 18} y={roadY - 48} textAnchor="end" fontSize={16} fontWeight={800} fill={env.line} opacity={0.9}>🏁 Ziel</text>
      </>
    );
  }
  if (prim === "mountain") {
    const wp: [number, number][] = layout.wp;
    return (
      <>
        <circle cx={W * 0.5} cy={H * 0.1} r={W * 0.11} fill={env.glow?.color ?? env.line} opacity={0.22} />
        {/* Bergprofil */}
        <polygon
          points={`0,${H} ${W * 0.2},${H * 0.62} ${W * 0.37},${H * 0.74} ${W * 0.5},${H * 0.12} ${W * 0.63},${H * 0.46} ${W * 0.83},${H * 0.27} ${W},${H * 0.56} ${W},${H}`}
          fill={env.surface[2]}
          stroke={env.stands}
          strokeWidth={1.5}
        />
        {/* Schneegipfel */}
        <polygon points={`${W * 0.46},${H * 0.2} ${W * 0.5},${H * 0.12} ${W * 0.54},${H * 0.22} ${W * 0.51},${H * 0.24} ${W * 0.5},${H * 0.2} ${W * 0.485},${H * 0.24}`} fill={env.line} opacity={0.85} />
        {/* Serpentinen-Route */}
        <path d={wpPath(wp)} fill="none" stroke={env.stands} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
        <path d={wpPath(wp)} fill="none" stroke={env.line} strokeWidth={2} strokeDasharray="3 12" opacity={0.55} />
        <text x={W * 0.5} y={H * 0.09} textAnchor="middle" fontSize={20}>🚩</text>
      </>
    );
  }
  if (prim === "parcours") {
    const wp: [number, number][] = layout.wp;
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill="url(#envSurface)" opacity={0.35} />
        <path d={wpPath(wp)} fill="none" stroke={env.stands} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <path d={wpPath(wp)} fill="none" stroke={env.surface[0]} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
        <path d={wpPath(wp)} fill="none" stroke={env.line} strokeWidth={2} strokeDasharray="2 12" opacity={0.5} />
        <circle cx={wp[0]![0]} cy={wp[0]![1]} r={9} fill="none" stroke={env.line} strokeWidth={2.5} />
        <text x={wp[0]![0]} y={wp[0]![1] - 14} textAnchor="middle" fontSize={12} fontWeight={800} fill={env.line}>START</text>
        <text x={wp[wp.length - 1]![0]} y={wp[wp.length - 1]![1] + 22} textAnchor="middle" fontSize={16}>🏁</text>
      </>
    );
  }
  if (prim === "bump") {
    const { pL, pR, top, bot } = layout;
    const stages: number = Math.max(1, layout.stagesTotal ?? 1);
    const innerW = W - pL - pR;
    const rows = 6;
    return (
      <>
        <rect x={pL - 20} y={top - 20} width={innerW + 40} height={bot - top + 44} rx={12} fill="url(#envSurface)" opacity={0.35} />
        {/* Rang-Führungslinien (oben = Spitze) */}
        {Array.from({ length: rows }).map((_, i) => {
          const y = top + (i / (rows - 1)) * (bot - top);
          return <line key={i} x1={pL} y1={y} x2={W - pR} y2={y} stroke={env.line} strokeWidth={1} strokeDasharray="2 10" opacity={0.22} />;
        })}
        {/* Etappen-Spalten + Labels */}
        {Array.from({ length: stages }).map((_, s) => {
          const x = pL + (stages > 1 ? s / (stages - 1) : 0.5) * innerW;
          return (
            <g key={s}>
              <line x1={x} y1={top} x2={x} y2={bot} stroke={env.stands} strokeWidth={1.4} opacity={0.5} />
              <text x={x} y={bot + 22} textAnchor="middle" fontSize={12} fontWeight={700} fill={env.line} opacity={0.75}>
                {`E${s + 1}`}
              </text>
            </g>
          );
        })}
        <text x={pL - 24} y={top + 4} textAnchor="end" fontSize={11} fontWeight={800} fill={env.line} opacity={0.8}>🏁</text>
        <text x={pL - 6} y={top - 6} textAnchor="start" fontSize={11} fontWeight={800} fill={env.line} opacity={0.7} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Spitze</text>
      </>
    );
  }
  if (prim === "kda") {
    // TDM — taktisches Deathmatch-HUD als Overlay über die Bahn-Reihen (Board):
    // Neon-rote Scoreboard-Kante, CRT-Scanlines, Fadenkreuz-Wasserzeichen (⌖),
    // angedeutete Spaltenkanten. Kein 3D-Feld, alles hsl()/rgba().
    const { top, xStart, xEnd } = layout;
    const red = "hsl(2 78% 60%)";
    const lines = Math.floor(H / 3);
    return (
      <>
        {/* neon-rote Trennkante unter dem Scoreboard-Kopf */}
        <rect x={0} y={top - 2} width={W} height={2} fill={red} opacity={0.5} />
        {/* CRT-Scanlines übers ganze HUD (statisch) */}
        <g style={{ pointerEvents: "none" }}>
          {Array.from({ length: lines }).map((_, i) => (
            <line key={i} x1={0} y1={i * 3} x2={W} y2={i * 3} stroke={red} strokeWidth={1} opacity={0.035} />
          ))}
        </g>
        {/* Fadenkreuz-Wasserzeichen (⌖) — HUD-Identität */}
        <text x={W / 2} y={H / 2 + 8} textAnchor="middle" dominantBaseline="central" fontSize={H * 0.62} fill={red} opacity={0.05} style={{ pointerEvents: "none" }}>
          ⌖
        </text>
        {/* angedeutete Board-Spaltenkanten links/rechts */}
        <line x1={xStart - 8} y1={top} x2={xStart - 8} y2={H - top + 8} stroke={red} strokeWidth={1} opacity={0.22} />
        <line x1={xEnd + 8} y1={top} x2={xEnd + 8} y2={H - top + 8} stroke={red} strokeWidth={1} opacity={0.22} />
      </>
    );
  }
  if (prim === "court") {
    const { cx, hoopY, baseY, baseHalf } = layout;
    const keyW = baseHalf * 0.42;
    const keyH = (baseY - hoopY) * 0.5;
    const courtL = cx - baseHalf;
    const courtT = hoopY - 20;
    const courtBot = baseY + 20;
    const courtH = courtBot - courtT;
    const midY = (hoopY + baseY) / 2 + 26;
    const floodC = env.glow?.color ?? env.line;
    // Hallen-Bowl: dunkler Rand + Zuschauer-Ränge (Punkt-Reihen) rund um den Court.
    const seatFill = (i: number) => (i % 4 === 0 ? "hsl(28 48% 42%)" : env.stands);
    const crowd: React.ReactNode[] = [];
    for (let row = 0; row < 3; row += 1) {
      const y = 12 + row * 15;
      for (let i = 0; i < 42; i += 1) {
        const x = 22 + i * ((W - 44) / 41);
        crowd.push(<circle key={`ct${row}-${i}`} cx={x} cy={y} r={2.3} fill={seatFill(i + row)} opacity={0.5} />);
      }
    }
    for (let col = 0; col < 2; col += 1) {
      for (let i = 0; i < 18; i += 1) {
        const y = 96 + i * ((baseY - 70) / 17);
        crowd.push(<circle key={`csl${col}-${i}`} cx={14 + col * 15} cy={y} r={2.3} fill={seatFill(i + col)} opacity={0.45} />);
        crowd.push(<circle key={`csr${col}-${i}`} cx={W - 14 - col * 15} cy={y} r={2.3} fill={seatFill(i + col + 1)} opacity={0.45} />);
      }
    }
    return (
      <>
        {/* dunkler Arena-Rand (Bowl) */}
        <rect x={0} y={0} width={W} height={H} fill={env.sky[1]} opacity={0.55} />
        {crowd}
        {/* Parkett-Boden */}
        <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtH} rx={12} fill="url(#envSurface)" stroke={env.stands} strokeWidth={6} />
        {/* Parkett-Maserung (Dielen) */}
        <g stroke="hsl(26 46% 26%)" strokeWidth={1.2} opacity={0.32}>
          {Array.from({ length: 20 }).map((_, i) => {
            const x = courtL + 14 + i * ((baseHalf * 2 - 28) / 19);
            return <line key={i} x1={x} y1={courtT + 5} x2={x} y2={courtBot - 5} />;
          })}
        </g>
        {/* Flutlicht — radialer Aufheller von oben */}
        <defs>
          <radialGradient id="courtFlood" cx="50%" cy="0%" r="64%">
            <stop offset="0%" stopColor={floodC} stopOpacity={0.26} />
            <stop offset="100%" stopColor={floodC} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtH} rx={12} fill="url(#courtFlood)" />
        {/* Center-Court-Logo */}
        <circle cx={cx} cy={midY} r={keyW * 0.78} fill="none" stroke={env.line} strokeWidth={2} opacity={0.34} />
        <circle cx={cx} cy={midY} r={keyW * 0.5} fill="none" stroke={env.line} strokeWidth={1.4} opacity={0.26} />
        <text x={cx} y={midY + 15} textAnchor="middle" fontSize={42} opacity={0.15}>🏀</text>
        {/* Zonen-Schlüssel */}
        <rect x={cx - keyW} y={hoopY} width={keyW * 2} height={keyH} fill="none" stroke={env.line} strokeWidth={2.5} opacity={0.7} />
        <circle cx={cx} cy={hoopY + keyH} r={keyW} fill="none" stroke={env.line} strokeWidth={2.5} opacity={0.7} />
        {/* Drei-Punkte-Bogen */}
        <path d={`M ${cx - baseHalf * 0.9} ${hoopY} A ${baseHalf * 0.9} ${baseY - hoopY} 0 0 0 ${cx + baseHalf * 0.9} ${hoopY}`} fill="none" stroke={env.line} strokeWidth={2.5} opacity={0.6} />
        {/* Backboard + Korb + Netz */}
        <rect x={cx - 34} y={hoopY - 32} width={68} height={22} rx={2} fill={env.stands} stroke={env.line} strokeWidth={2} opacity={0.92} />
        <rect x={cx - 13} y={hoopY - 28} width={26} height={13} fill="none" stroke={env.line} strokeWidth={1.6} opacity={0.7} />
        <line x1={cx - 22} y1={hoopY - 8} x2={cx + 22} y2={hoopY - 8} stroke={floodC} strokeWidth={4} />
        <circle cx={cx} cy={hoopY} r={9} fill="none" stroke={floodC} strokeWidth={3} />
        <g stroke={env.line} strokeWidth={1} opacity={0.55} fill="none">
          {[-8, -4, 0, 4, 8].map((dx, i) => (
            <line key={i} x1={cx + dx} y1={hoopY + 2} x2={cx + dx * 0.55} y2={hoopY + 20} />
          ))}
          <line x1={cx - 8.5} y1={hoopY + 9} x2={cx + 8.5} y2={hoopY + 9} />
          <line x1={cx - 6} y1={hoopY + 16} x2={cx + 6} y2={hoopY + 16} />
        </g>
      </>
    );
  }
  // rink
  const { x0, y0, w, hh } = layout;
  const midX = x0 + w / 2;
  return (
    <>
      <rect x={x0} y={y0} width={w} height={hh} rx={44} fill="url(#envSurface)" stroke={env.stands} strokeWidth={4} />
      <ellipse cx={midX} cy={y0 + hh * 0.3} rx={w * 0.42} ry={hh * 0.18} fill={env.glow?.color ?? env.line} opacity={0.12} />
      {/* Blaue Linien (vertikal) + rote Mittellinie */}
      <line x1={x0 + w * 0.32} y1={y0} x2={x0 + w * 0.32} y2={y0 + hh} stroke={env.line} strokeWidth={3} opacity={0.7} />
      <line x1={x0 + w * 0.68} y1={y0} x2={x0 + w * 0.68} y2={y0 + hh} stroke={env.line} strokeWidth={3} opacity={0.7} />
      <line x1={midX} y1={y0} x2={midX} y2={y0 + hh} stroke="hsl(2 70% 55%)" strokeWidth={2.5} opacity={0.8} />
      <circle cx={midX} cy={y0 + hh / 2} r={hh * 0.14} fill="none" stroke={env.line} strokeWidth={1.6} opacity={0.5} />
      {/* Tore: rechts = Angriff */}
      <rect x={x0 + w - 8} y={y0 + hh / 2 - 26} width={12} height={52} rx={3} fill="hsl(41 80% 55%)" opacity={0.85} />
      <rect x={x0 - 4} y={y0 + hh / 2 - 26} width={12} height={52} rx={3} fill={env.stands} opacity={0.85} />
      <text x={x0 + w - 20} y={y0 + 22} textAnchor="end" fontSize={14} fill={env.line} opacity={0.8}>🥅 Angriff →</text>
      <text x={midX} y={y0 + hh / 2 + 8} textAnchor="middle" fontSize={40} opacity={0.14}>🏒</text>
    </>
  );
}

// Liga-Klassen-Bänder (Schach/Tennis): Teams per Score-Lücken in Klassen gruppiert
// (adaptiver Schwellwert ≈ 2.2× mittlere Lücke → splittet an echten Clustern), je
// Band ein Chip-Feld mit Code + Score, Beziehungs-Rahmen, Podest-Medaillen. Voll-
// flächig aus ALLEN aktuellen Scores berechnet (kein Token-auf-Feld). Alle Farben
// hsl()/CSS-Token → Design-Token-Lint bleibt sauber.
const KLASSEN_NAMES = ["Meister", "Anwärter", "Oberhaus", "Mittelfeld", "Abstieg", "Keller"];
const KLASSEN_MEDALS = ["🥇", "🥈", "🥉"];
function renderKlassenBands(sorted: RT[], W: number, H: number, env: StageEnv): React.ReactNode {
  const n = sorted.length;
  if (n === 0) return null;
  const max = sorted[0]!.score;
  const min = sorted[n - 1]!.score;
  const avgGap = n > 1 ? (max - min) / (n - 1) : 0;
  const th = Math.max(0.5, avgGap * 2.2);
  const groups: RT[][] = [[sorted[0]!]];
  for (let i = 1; i < n; i += 1) {
    if (sorted[i - 1]!.score - sorted[i]!.score > th) groups.push([sorted[i]!]);
    else groups[groups.length - 1]!.push(sorted[i]!);
  }
  const padX = 40;
  const padTop = 46;
  const padBot = 20;
  const innerW = W - padX * 2;
  const chipW = 92;
  const gapX = 8;
  const gapY = 7;
  const headH = 22;
  const bandPadTop = 6;
  const bandGap = 12;
  const perRow = Math.max(1, Math.floor((innerW + gapX) / (chipW + gapX)));
  const bandRows = groups.map((g) => Math.ceil(g.length / perRow));
  const rowsTotal = bandRows.reduce((s, r) => s + r, 0);
  const headerBlock = headH + bandPadTop + 8;
  const availH = H - padTop - padBot;
  const availForRows = availH - groups.length * headerBlock - bandGap * (groups.length - 1);
  const rowUnit = Math.max(16, Math.min(26 + gapY, availForRows / Math.max(1, rowsTotal)));
  const chipH = Math.max(14, rowUnit - gapY);
  let y = padTop;
  const nodes: React.ReactNode[] = [];
  groups.forEach((g, gi) => {
    const rows = bandRows[gi]!;
    const bandH = headH + bandPadTop + rows * chipH + (rows - 1) * gapY + 8;
    const hi = Math.max(...g.map((t) => t.score));
    const lo = Math.min(...g.map((t) => t.score));
    const youBand = g.some((t) => t.isOwn);
    nodes.push(
      <g key={`band-${gi}`}>
        <rect x={padX - 12} y={y} width={innerW + 24} height={bandH} rx={12} fill={env.stands} opacity={0.3} stroke={youBand ? "var(--nl-accent)" : env.line} strokeWidth={youBand ? 2 : 1} strokeOpacity={youBand ? 0.9 : 0.22} />
        <text x={padX} y={y + 15} fontSize={13} fontWeight={800} fill={env.line} style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {KLASSEN_NAMES[gi] ?? `Klasse ${gi + 1}`}
        </text>
        <text x={padX + innerW} y={y + 15} textAnchor="end" fontSize={11} fontWeight={700} fill={env.line} opacity={0.7}>
          {`${g.length} · ${fmt1(lo)}–${fmt1(hi)}`}
        </text>
        {g.map((t, ci) => {
          const rr = Math.floor(ci / perRow);
          const cc = ci % perRow;
          const cx = padX + cc * (chipW + gapX);
          const cy = y + headH + bandPadTop + rr * (chipH + gapY);
          const rc = relColor(t.rel);
          const med = t.rank <= 3 ? KLASSEN_MEDALS[t.rank - 1] : "";
          return (
            <g key={t.code}>
              <rect x={cx} y={cy} width={chipW} height={chipH} rx={7} fill={t.isOwn ? "color-mix(in srgb, var(--nl-accent) 22%, transparent)" : "var(--nl-panel)"} stroke={rc ?? (t.isOwn ? "var(--nl-accent)" : env.line)} strokeWidth={rc || t.isOwn ? 2 : 1} strokeOpacity={rc || t.isOwn ? 0.95 : 0.3} />
              <text x={cx + 8} y={cy + chipH / 2 + 4} fontSize={11.5} fontWeight={800} fill={t.isOwn ? "var(--nl-accent)" : env.line}>
                {med}
                {t.code}
              </text>
              <text x={cx + chipW - 8} y={cy + chipH / 2 + 4} textAnchor="end" fontSize={10.5} fontWeight={700} fill={env.line} opacity={0.78}>
                {fmt1(t.score)}
              </text>
            </g>
          );
        })}
      </g>,
    );
    y += bandH + bandGap;
  });
  return <>{nodes}</>;
}

// Squarified Treemap (Battlefield-Gebietseroberung): ganzes Feld = 100 %, Zellen-
// Fläche ∝ Score. Port des klassischen Squarify-Algorithmus (Bruls et al.). Teams
// ohne Punkte haben noch kein Gebiet erobert und erscheinen nicht. %-Label je Zone,
// 🚩 auf die größte, Beziehungs-Rahmen. Alle Farben hsl()/rgb()/Token → Lint-sauber.
type TreemapCell = { t: RT; x: number; y: number; w: number; h: number };
function squarifyTreemap(items: { v: number; t: RT }[], W: number, H: number): TreemapCell[] {
  let total = 0;
  for (const it of items) total += it.v;
  if (total <= 0) return [];
  const scale = (W * H) / total;
  const vals = items.map((it) => ({ it, a: it.v * scale }));
  const out: TreemapCell[] = [];
  let x = 0;
  let y = 0;
  let w = W;
  let h = H;
  let i0 = 0;
  const worst = (row: { a: number }[], side: number): number => {
    let s = 0;
    let mx = -Infinity;
    let mn = Infinity;
    for (const rr of row) {
      s += rr.a;
      if (rr.a > mx) mx = rr.a;
      if (rr.a < mn) mn = rr.a;
    }
    if (s <= 0) return Infinity;
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (i0 < vals.length) {
    const side = Math.min(w, h);
    const row = [vals[i0]!];
    let j = i0 + 1;
    while (j < vals.length) {
      const cur = worst(row, side);
      row.push(vals[j]!);
      const nx = worst(row, side);
      if (nx > cur) {
        row.pop();
        break;
      }
      j += 1;
    }
    let s = 0;
    for (const rr of row) s += rr.a;
    if (w >= h) {
      const rw = s / h;
      let cy = y;
      for (const rr of row) {
        const rh = rr.a / rw;
        out.push({ t: rr.it.t, x, y: cy, w: rw, h: rh });
        cy += rh;
      }
      x += rw;
      w -= rw;
    } else {
      const rh2 = s / w;
      let cx = x;
      for (const rr of row) {
        const rw2 = rr.a / rh2;
        out.push({ t: rr.it.t, x: cx, y, w: rw2, h: rh2 });
        cx += rw2;
      }
      y += rh2;
      h -= rh2;
    }
    i0 = j;
  }
  return out;
}
function renderTerritory(sorted: RT[], W: number, H: number, env: StageEnv): React.ReactNode {
  const items = sorted.filter((t) => t.score > 0).map((t) => ({ v: t.score, t }));
  if (items.length === 0) {
    return (
      <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={18} fontWeight={800} fill={env.line} opacity={0.6}>
        Gebiet noch unerobert — erste Wertung startet gleich
      </text>
    );
  }
  const total = items.reduce((s, it) => s + it.v, 0);
  const cells = squarifyTreemap(items, W, H);
  const max = sorted[0]!.score;
  const min = sorted[sorted.length - 1]!.score;
  const span = max - min;
  const topCode = sorted[0]!.code;
  const INK = "hsl(210 30% 96%)";
  return (
    <>
      {cells.map((c) => {
        const t = c.t;
        const nm = span > 0 ? Math.max(0, Math.min(1, (t.score - min) / span)) : 1;
        const rc = relColor(t.rel);
        const med = t.rank === 1 ? "var(--nl-warn)" : t.rank === 2 ? "var(--nl-mut)" : t.rank === 3 ? "rgb(205,127,50)" : null;
        const fill = rc ?? med ?? "hsl(80 40% 42%)";
        const pv = (t.score / total) * 100;
        const x = c.x + 1;
        const y = c.y + 1;
        const w = Math.max(0, c.w - 2);
        const h = Math.max(0, c.h - 2);
        const big = w > 54 && h > 40;
        const mid = w > 34 && h > 18;
        return (
          <g key={t.code}>
            <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} fillOpacity={0.4 + nm * 0.5} stroke={rc ?? "rgba(0,0,0,0.55)"} strokeWidth={rc ? 2.4 : 1} />
            {big ? (
              <>
                <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontSize={w > 90 ? 14 : 11} fontWeight={800} fill={INK}>
                  {t.code}
                </text>
                <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fontSize={10} fill={INK} opacity={0.85}>
                  {pv.toFixed(1)}%
                </text>
              </>
            ) : mid ? (
              <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={INK}>
                {t.code}
              </text>
            ) : null}
            {t.code === topCode && w > 24 && h > 20 ? (
              <text x={x + w - 4} y={y + 16} textAnchor="end" fontSize={15}>
                🚩
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

const STAR_MIN = 80;
// viewBox + Token-Radien je Primitive. Der Rest (Engine/FX/Ticker/Podest/Tabelle)
// ist geometrieunabhängig; nur Feld-Layout + tokenPos unterscheiden sich.
const PRIM_GEO: Record<StagePrimitive, { w: number; h: number; r: number; rOwn: number }> = {
  track: { w: 1180, h: 620, r: 13, rOwn: 20 },
  // Kompakt: 32 Bahnen passen in einen normalen Viewport (~640px hoch bei voller Breite).
  lanes: { w: 1180, h: 640, r: 8, rOwn: 11 },
  towers: { w: 1180, h: 600, r: 10, rOwn: 14 },
  // stage — Showcase-Bühne mit Tiefe: perspektivische Ruhm-Treppe zum Podest.
  stage: { w: 1180, h: 640, r: 10, rOwn: 15 },
  // Row-Familie (wie lanes)
  platter: { w: 1180, h: 640, r: 8, rOwn: 11 },
  lamps: { w: 1180, h: 640, r: 8, rOwn: 11 },
  spybar: { w: 1180, h: 640, r: 8, rOwn: 11 },
  kda: { w: 1180, h: 640, r: 8, rOwn: 11 },
  duelhp: { w: 1180, h: 640, r: 8, rOwn: 11 },
  // Turm-Familie (wie towers)
  barbell: { w: 1180, h: 600, r: 10, rOwn: 14 },
  sparkbar: { w: 1180, h: 600, r: 9, rOwn: 13 },
  thermometer: { w: 1180, h: 600, r: 9, rOwn: 13 },
  // Szenen
  peloton: { w: 1180, h: 460, r: 11, rOwn: 16 },
  parcours: { w: 1180, h: 560, r: 12, rOwn: 17 },
  bump: { w: 1180, h: 560, r: 7, rOwn: 10 },
  mountain: { w: 1180, h: 620, r: 11, rOwn: 16 },
  court: { w: 1180, h: 620, r: 11, rOwn: 16 },
  rink: { w: 1180, h: 560, r: 11, rOwn: 15 },
  klassen: { w: 1180, h: 640, r: 8, rOwn: 11 },
  territory: { w: 1180, h: 640, r: 8, rOwn: 11 },
};

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
// Piecewise-lineare Interpolation entlang eines Wegpunkt-Pfads (Serpentine/
// Parcours): f ∈ 0…1 → {x,y}. Für mountain/parcours (Token folgt dem Weg).
function interpAlong(wp: [number, number][], f: number): { x: number; y: number } {
  if (wp.length === 0) return { x: 0, y: 0 };
  if (wp.length === 1) return { x: wp[0]![0], y: wp[0]![1] };
  let total = 0;
  const acc: number[] = [0];
  for (let i = 1; i < wp.length; i += 1) {
    total += Math.hypot(wp[i]![0] - wp[i - 1]![0], wp[i]![1] - wp[i - 1]![1]);
    acc.push(total);
  }
  const d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < wp.length; i += 1) {
    if (d <= acc[i]! || i === wp.length - 1) {
      const segLen = acc[i]! - acc[i - 1]!;
      const tt = segLen > 0 ? (d - acc[i - 1]!) / segLen : 0;
      return {
        x: wp[i - 1]![0] + (wp[i]![0] - wp[i - 1]![0]) * tt,
        y: wp[i - 1]![1] + (wp[i]![1] - wp[i - 1]![1]) * tt,
      };
    }
  }
  return { x: wp[wp.length - 1]![0], y: wp[wp.length - 1]![1] };
}
function modSum(mods: NativeStageMod[]): number {
  return mods.reduce((s, m) => s + m.sign * m.amt, 0);
}
function playerNet(p: NativeStagePlayer | null | undefined): number {
  if (!p) return 0;
  return Math.max(0, round1(p.val + modSum(p.mods)));
}
// Golden-Angle-Farbverteilung nach fester Team-Position → maximale Spreizung,
// keine Hash-Kollisionen (früher hueFor über den Code → viele fast gleiche Grüns).
function hueForIdx(idx: number): number {
  return Math.round((idx * 137.508) % 360);
}
function calcString(p: NativeStagePlayer): string {
  let s = `${fmt1(p.val)}`;
  p.mods.forEach((m) => {
    s += m.sign < 0 ? ` − ${fmt1(m.amt)} ${m.k}` : ` + ${fmt1(m.amt)} ${m.k}`;
  });
  return `${s} = ${fmt1(playerNet(p))}`;
}

const FLASH_COLOR: Record<string, string> = {
  gold: "255,214,110",
  red: "217,80,63",
  violet: "160,110,232",
  cyan: "80,200,210",
};

type RT = {
  idx: number;
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  teamId: string | null; // für Team-Drawer
  rel: TeamRelationshipKind | null; // Freund/Feind → Rahmen-Marker
  players: NativeStagePlayer[];
  seasonRank: number;
  laneIdx: number; // dichte 0…N-1 Bahn-/Turm-Reihenfolge nach seasonRank (keine Lücken)
  score: number;
  thrownSlot: number;
  rank: number;
  rankHistory: number[]; // Rang nach jeder gewerteten Etappe (für Bump/Verlauf)
  roundStartRank: number;
  roundRankAfter: number;
  roundDelta: number;
  roundMedal: 0 | 1 | 2 | 3;
  roundSlotRank: number; // vorab bestimmter Rang im aktuellen Slot (1…N) — kein Spoiler
  glowUntil: number;
};

type Impact = { tier: 0 | 1 | 2; cause: string; color: string; text: string; delta: number };
type Pop = { id: number; xPct: number; yPct: number; net: number; mine: boolean };
type Frag = { id: number; xPct: number; yPct: number; text: string; sign: 1 | -1 };
type TickerReveal = {
  kind: "reveal";
  id: string;
  code: string;
  idx: number;
  isOwn: boolean;
  logoUrl: string | null;
  star: boolean;
  playerName: string;
  slotLbl: string;
  slotRank: number;
  badge: [string, string] | null;
  calc: string;
  net: number;
  rankAfter: number;
  delta: number;
  slot: number;
};
type TickerSummary = { kind: "summary"; id: string; text: string };
type TickerHeader = { kind: "header"; id: string; text: string };
type TickerData = TickerReveal | TickerSummary | TickerHeader;

const TICKER_MAX = 40;
type Spot = { crest: NativeStageTeam; idx: number; kick: string; name: string; sub: string; net: number; chipText: string; chipColor: string; mine: boolean } | null;
type PodCol = { place: number; code: string; name: string; pts: number; logoUrl: string | null; isOwn: boolean; idx: number; delayMs: number; loud: boolean };

export default function DisciplineStageNativeArena({ teams, slots, onOpenPlayer, onOpenTeam, onHoverTeam, onPreviewPlayer, onEnded, topPlayers, primitive = "track", progressLabel, disciplineName, accent, motif, env }: DisciplineStageNativeArenaProps) {
  const skinAccent = accent ?? "var(--nl-line-2, var(--nl-line))";
  const slotCount = Math.max(1, slots.length);
  const prim = primitive;
  const geo = PRIM_GEO[prim];
  const W = geo.w;
  const H = geo.h;
  const N = Math.max(1, teams.length);
  const audio = useStageAudio();
  const [, force] = useReducer((x: number) => x + 1, 0);

  const reduced = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches;
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ---- Laufzeit-Teams (mutabel im Cascade, Re-Render via force()) ----
  const rtRef = useRef<RT[]>([]);
  const buildRT = useCallback((): RT[] => {
    const rt = teams.map((t, idx) => ({
      idx,
      code: t.code,
      name: t.name,
      logoUrl: t.logoUrl,
      isOwn: t.isOwn,
      teamId: t.teamId ?? null,
      rel: t.rel ?? null,
      players: t.players,
      seasonRank: t.seasonRank ?? idx + 1,
      laneIdx: idx,
      score: 0,
      thrownSlot: -1,
      rank: idx + 1,
      rankHistory: [],
      roundStartRank: idx + 1,
      roundRankAfter: idx + 1,
      roundDelta: 0,
      roundMedal: 0 as 0 | 1 | 2 | 3,
      roundSlotRank: 0,
      glowUntil: 0,
    }));
    // Bahn-/Turm-Reihenfolge nach echtem Season-Rang, aber DICHT durchnummeriert
    // (Season-Ränge können Lücken haben → niemals seasonRank-1 als Array-Index).
    [...rt]
      .sort((a, b) => a.seasonRank - b.seasonRank || a.idx - b.idx)
      .forEach((t, i) => {
        t.laneIdx = i;
      });
    recomputeRanks(rt);
    return rt;
  }, [teams]);

  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [spotlight, setSpotlight] = useState<Spot>(null);
  const [flash, setFlash] = useState<{ color: string; id: number } | null>(null);
  const [shake, setShake] = useState<"none" | "hard" | "soft">("none");
  const [pops, setPops] = useState<Pop[]>([]);
  const [frags, setFrags] = useState<Frag[]>([]);
  const [ticker, setTicker] = useState<TickerData[]>([]);
  const [podium, setPodium] = useState<PodCol[] | null>(null);
  const [hover, setHover] = useState<{ idx: number } | null>(null);
  const hoverCloseTimer = useRef<number | null>(null);
  const ladderHoverTimer = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const fxId = useRef(1);
  const roundTopNet = useRef(0); // Netto des Etappensiegers der laufenden Runde (vorab bestimmt)
  const tier2Budget = useRef(2);
  const tier1Budget = useRef(4);
  const busyRef = useRef(false);
  const endedFiredRef = useRef(false); // onEnded feuert genau einmal je Lauf (Spoiler-Gate)

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, reduced.current ? 0 : ms);
    timers.current.push(id);
    return id;
  }, []);

  // Token-Hovercard: eigener Schließ-Timer (unabhängig von der Reveal-Cascade),
  // damit die Karte beim Rüberfahren nicht flackert.
  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimer.current != null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);
  const openHover = useCallback(
    (idx: number) => {
      cancelHoverClose();
      setHover({ idx });
    },
    [cancelHoverClose],
  );
  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimer.current = window.setTimeout(() => setHover(null), 120);
  }, [cancelHoverClose]);
  // Ladder-Hover → Team-Vorschau im Host (300ms Verzögerung wie die Top-Player-Row).
  const clearLadderHoverTimer = useCallback(() => {
    if (ladderHoverTimer.current != null) {
      window.clearTimeout(ladderHoverTimer.current);
      ladderHoverTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    rtRef.current = buildRT();
    setRound(0);
    setBusy(false);
    busyRef.current = false;
    setEnded(false);
    setSpotlight(null);
    setFlash(null);
    setShake("none");
    setPops([]);
    setFrags([]);
    setTicker([]);
    setPodium(null);
    setHover(null);
    endedFiredRef.current = false;
    roundTopNet.current = 0;
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    force();
  }, [buildRT, clearTimers]);

  // Nur beim Mount zurücksetzen: der Host remountet die Arena bereits vollständig
  // via key={`${disciplineId}-${mode}-${seed}`}. Ein Reset bei jeder teams-Identität
  // würde die laufende Sim bei unbeteiligtem Parent-Render (Drawer/Hover) auf Runde 0
  // zurückwerfen (B1). reset ist ein useCallback — Mount-only ist gewollt.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      clearTimers();
      cancelHoverClose();
      clearLadderHoverTimer();
    },
    [clearTimers, cancelHoverClose, clearLadderHoverTimer],
  );

  const done = round >= slotCount;

  // ---- Feld-Geometrie ----
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  useLayoutEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [prim]);
  // Stadion-Oval bei beliebigem Rand-Margin (für Bahn-Mittellinie, Bahnlinien
  // und Innenfeld-Kante). Kleinerer Margin = größeres Oval.
  const makeOval = useCallback(
    (m: number): string => {
      const x0 = m;
      const y0 = m;
      const x1 = W - m;
      const y1 = H - m;
      const r = (y1 - y0) / 2;
      return `M ${x0 + r} ${y0} L ${x1 - r} ${y0} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} L ${x0 + r} ${y1} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
    },
    [W, H],
  );
  const OVAL_M = 70;
  const OVAL_BAND = 54;
  const ovalPath = useMemo(() => makeOval(OVAL_M), [makeOval]);

  // Layout-Koordinaten je Primitive
  const layout = useMemo(() => {
    if (ROW_FAMILY.has(prim)) {
      const top = 18;
      const laneH = (H - top * 2) / N;
      // Row-Motive brauchen etwas mehr Platz links (Kürzel) und rechts (Wert).
      return { top, laneH, xStart: 96, xEnd: W - 150 };
    }
    if (TOWER_FAMILY.has(prim)) {
      const lPad = 40;
      const rPad = 24;
      const colW = (W - lPad - rPad) / N;
      return { lPad, rPad, colW, baseY: H - 52, topY: 44 };
    }
    if (prim === "peloton") {
      return { roadY: H * 0.54, padL: W * 0.045, padR: W * 0.045, fan: 15 };
    }
    if (prim === "mountain") {
      const wp: [number, number][] = [
        [W * 0.11, H * 0.92],
        [W * 0.86, H * 0.83],
        [W * 0.2, H * 0.66],
        [W * 0.84, H * 0.5],
        [W * 0.28, H * 0.37],
        [W * 0.73, H * 0.25],
        [W * 0.5, H * 0.12],
      ];
      return { wp };
    }
    if (prim === "parcours") {
      const rows = 4;
      const padX = W * 0.05;
      const padY = H * 0.14;
      const rowH = (H - 2 * padY) / (rows - 1);
      const wp: [number, number][] = [];
      for (let r = 0; r < rows; r += 1) {
        const y = padY + r * rowH;
        const leftFirst = r % 2 === 0;
        wp.push([leftFirst ? padX : W - padX, y]);
        wp.push([leftFirst ? W - padX : padX, y]);
      }
      return { wp };
    }
    if (prim === "bump") {
      // Slalom/Bump-Diagramm: x = Etappe, y = Rang (oben = Spitze). stagesTotal
      // aus der Slot-Zahl; die Linien liest der Renderer aus RT.rankHistory.
      return { pL: 88, pR: 66, top: 42, bot: H - 46, stagesTotal: slotCount };
    }
    if (prim === "court") {
      return { cx: W / 2, hoopY: H * 0.15, baseY: H * 0.9, baseHalf: W * 0.4 };
    }
    if (prim === "rink") {
      const x0 = W * 0.03;
      const y0 = H * 0.07;
      const w = W * 0.94;
      const hh = H * 0.8;
      return { x0, y0, w, hh, margin: 44 };
    }
    if (prim === "stage") {
      // Perspektivische Ruhm-Treppe (Port von showcase-v2 drawStageBG, auf viewBox
      // skaliert): Score 0 steht am Boden, das Ruhm-Podest oben ist das Ziel; die
      // Treppe verjüngt sich zum Podest → Teilnehmer laufen in die Tiefe zusammen.
      return {
        floorY: H - 84,
        podiumY: 118,
        centerX: W / 2,
        baseHalf: W / 2 - 46,
        topHalf: 86,
        stairBands: 16,
      };
    }
    return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [prim, N, W, H, slotCount]) as any;

  // Normierungsbasis = größte erreichbare Team-Summe (statisch, aus den Slot-Werten).
  // So endet das beste Team exakt auf der Ziellinie und Tokens rutschen beim Reveal
  // NICHT kollektiv nach — nur das gerade aufgedeckte Team bewegt sich.
  const finalMax = useMemo(() => {
    let mx = 0;
    for (const t of teams) {
      let s = 0;
      for (const p of t.players) s += playerNet(p);
      if (s > mx) mx = s;
    }
    return Math.max(1, mx);
  }, [teams]);

  // Feld-Minimum der End-Summen — Normierungs-Untergrenze für abgeleitete Stats
  // (KDA / Duell-HP): n = (score − min) / (max − min), clamped. So klettern die
  // Werte während des Reveals von der Feld-Untergrenze bis zum Endwert.
  const finalMin = useMemo(() => {
    let mn = Infinity;
    for (const t of teams) {
      let s = 0;
      for (const p of t.players) s += playerNet(p);
      if (s < mn) mn = s;
    }
    return Number.isFinite(mn) ? mn : 0;
  }, [teams]);
  const fieldNorm = useCallback(
    (score: number): number => {
      const span = finalMax - finalMin;
      if (span <= 0) return score > 0 ? 1 : 0;
      return Math.max(0, Math.min(1, (score - finalMin) / span));
    },
    [finalMax, finalMin],
  );

  const tokenPos = useCallback(
    (t: RT, score: number): { x: number; y: number } => {
      const norm = finalMax > 0 ? score / finalMax : 0; // 0…1, kein Headroom
      // Voll-Feld-Sonderlayouts haben kein gleitendes Token — Score-Pops landen
      // mittig (die Feld-Optik rechnet selbst aus allen Scores).
      if (FIELD_CUSTOM.has(prim)) return { x: W / 2, y: H / 2 };
      if (ROW_FAMILY.has(prim)) {
        const y = layout.top + t.laneIdx * layout.laneH + layout.laneH / 2;
        return { x: layout.xStart + norm * (layout.xEnd - layout.xStart), y };
      }
      if (TOWER_FAMILY.has(prim)) {
        const x = layout.lPad + t.laneIdx * layout.colW + layout.colW / 2;
        return { x, y: layout.baseY - norm * (layout.baseY - layout.topY) };
      }
      if (prim === "peloton") {
        // Straße: x = Fortschritt, Feld fächert vertikal um die Mittellinie auf.
        const x = layout.padL + norm * (W - layout.padL - layout.padR);
        const lane = (t.laneIdx % 7) - 3; // -3…3
        return { x, y: layout.roadY - lane * layout.fan };
      }
      if (prim === "mountain") {
        return interpAlong(layout.wp, norm);
      }
      if (prim === "parcours") {
        return interpAlong(layout.wp, norm);
      }
      if (prim === "bump") {
        // Token = aktueller Rang an der laufenden Etappe. rankHistory hält die
        // Ränge nach jeder gewerteten Etappe; die Live-Etappe ist hist.length.
        const stages: number = Math.max(1, layout.stagesTotal ?? 1);
        const hist = t.rankHistory;
        const s = Math.min(stages - 1, hist.length);
        const x = layout.pL + (stages > 1 ? s / (stages - 1) : 0.5) * (W - layout.pL - layout.pR);
        const y = layout.top + (N > 1 ? (t.rank - 1) / (N - 1) : 0.5) * (layout.bot - layout.top);
        return { x, y };
      }
      if (prim === "court") {
        // Wurfkarte: höherer Score → näher an den Korb (oben, Mitte). Das Feld
        // verjüngt sich zur Zone, Teams fächern nach fester Position auf.
        const f = Math.max(0, Math.min(1, norm));
        const y = layout.baseY - f * (layout.baseY - layout.hoopY);
        const spread = layout.baseHalf * (1 - f * 0.62);
        const x = layout.cx + ((t.laneIdx - (N - 1) / 2) / Math.max(1, N)) * spread * 2;
        return { x, y };
      }
      if (prim === "rink") {
        // Eisrink von oben: x = Vorstoß in die Angriffszone (rechts = Tor),
        // y = feste Zeile je Team, damit sich das Feld nicht überlappt.
        const x = layout.x0 + layout.margin + norm * (layout.w - 2 * layout.margin);
        const y = layout.y0 + layout.margin + (N > 1 ? t.laneIdx / (N - 1) : 0.5) * (layout.hh - 2 * layout.margin);
        return { x, y };
      }
      if (prim === "stage") {
        // Port von stairPos mit finalMax-Normierung: bester Score endet exakt am
        // Ruhm-Podest, die Treppe verjüngt sich (halfW), die Bahnen laufen zur
        // Mitte zusammen — so klettern die Teilnehmer perspektivisch in die Tiefe.
        const f = Math.max(0, Math.min(1, norm));
        const y = layout.floorY - f * (layout.floorY - layout.podiumY);
        const halfW = layout.baseHalf + (layout.topHalf - layout.baseHalf) * f;
        const x = layout.centerX + (t.laneIdx - (N - 1) / 2) * ((halfW * 2) / N);
        return { x, y };
      }
      // track (Oval, im Uhrzeigersinn) — monoton wachsende frac ⇒ nie rückwärts;
      // Sieger landet nach einer Runde wieder exakt an der ZIEL-Linie. Stabiler
      // Quer-Versatz nach fester Team-Position, damit sich das Feld auffächert.
      if (!pathRef.current || pathLen === 0) return { x: W / 2, y: 70 };
      const frac = 0.015 + norm * 0.985;
      const L = frac * pathLen;
      const pt = pathRef.current.getPointAtLength(L);
      const p2 = pathRef.current.getPointAtLength(Math.min(pathLen, L + 2));
      let tx = p2.x - pt.x;
      let ty = p2.y - pt.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const lane = (t.laneIdx % 6) - 2.5; // -2.5 … 2.5
      const off = lane * 8.5;
      return { x: pt.x + -ty * off, y: pt.y + tx * off };
    },
    [prim, layout, pathLen, finalMax, W, N],
  );

  // ---- Rang-/Slot-Mathematik (Port der Szene) ----
  function recomputeRanks(rt: RT[]): void {
    const order = [...rt].sort((a, b) => b.score - a.score || a.seasonRank - b.seasonRank);
    order.forEach((t, i) => {
      t.rank = i + 1;
    });
  }
  function slotRankOf(slot: number, team: RT, rt: RT[]): number {
    const my = playerNet(team.players[slot]);
    let better = 0;
    rt.forEach((o) => {
      const p = o.players[slot];
      if (p && playerNet(p) > my) better += 1;
    });
    return better + 1;
  }
  function computeRoundStandings(rnd: number, rt: RT[]): void {
    const after = rt.map((t) => {
      let s = 0;
      for (let k = 0; k <= rnd; k += 1) {
        const p = t.players[k];
        if (p) s += playerNet(p);
      }
      return { t, after: s };
    });
    after
      .slice()
      .sort((a, b) => b.after - a.after || a.t.seasonRank - b.t.seasonRank)
      .forEach((o, i) => (o.t.roundRankAfter = i + 1));
    rt.forEach((t) => {
      t.roundDelta = t.roundStartRank - t.roundRankAfter;
    });
  }
  function applyReveal(t: RT, slot: number, rt: RT[]): { player: NativeStagePlayer | null; net: number } {
    const p = t.players[slot] ?? null;
    const net = playerNet(p);
    t.score = round1(t.score + net);
    t.thrownSlot = slot;
    recomputeRanks(rt);
    // Medaille erscheint erst mit dem Auftritt (gate über thrownSlot === slot),
    // ist aber sofort final: sie folgt dem vorab bestimmten roundSlotRank und
    // wandert nicht mehr weiter. Kein Spoiler vor Reveal.
    if (p && t.roundSlotRank >= 1 && t.roundSlotRank <= 3) {
      t.roundMedal = t.roundSlotRank as 1 | 2 | 3;
    }
    return { player: p, net };
  }
  function noteReveal(t: RT, slot: number, res: { player: NativeStagePlayer | null; net: number }, isMine: boolean, rt: RT[]): Impact {
    if (!res.player) return { tier: 0, cause: "tick", color: "gold", text: "", delta: t.roundDelta };
    const net = res.net;
    const p = res.player;
    const bonSum = p.mods.filter((m) => m.sign > 0).reduce((s, m) => s + m.amt, 0);
    const injury = p.mods.some((m) => /verletz|injury/i.test(m.k));
    const delta = t.roundDelta;
    const topNet = roundTopNet.current; // vorab bestimmter Etappensieger-Wert (kein prevBest)
    const slotRank = t.roundSlotRank; // vorab bestimmter Rang in dieser Etappe (1…N)
    const leaderBefore = rt.find((x) => x.roundStartRank === 1);
    const leaderChange = t.roundRankAfter === 1 && !!leaderBefore && leaderBefore.code !== t.code;
    const top3jump = t.roundStartRank >= 6 && t.roundRankAfter <= 3;

    let cause = "tick";
    let tier: 0 | 1 | 2 = 0;
    let color = "gold";
    let text = "";
    const malSum = p.mods.filter((m) => m.sign < 0).reduce((s, m) => s + m.amt, 0);
    if (injury) {
      cause = "injury";
      tier = 2;
      color = "red";
      text = `−${fmt1(malSum)} Verletzung`;
    } else if (p.val >= STAR_MIN) {
      cause = "star";
      tier = 2;
      color = "gold";
      text = `⭐ Star · Wert ${fmt1(p.val)}`;
    } else if (leaderChange) {
      cause = "leader";
      tier = 2;
      color = "gold";
      text = "neue Spitze · #1";
    } else if (top3jump) {
      cause = "top3";
      tier = 2;
      color = "violet";
      text = `P${t.roundStartRank} → P${t.roundRankAfter}`;
    } else if (slotRank === 1) {
      // echter Etappensieger (vorab bestimmt): Tier 2, umgeht Drosselung
      cause = "best";
      tier = 2;
      color = "gold";
      text = `Etappensieger · ${fmt1(net)}`;
    } else if (slotRank === 2 || slotRank === 3) {
      // echte Runden-Silber/Bronze: mind. Tier 1 (Ping + Glow) + Medaillenring
      cause = slotRank === 2 ? "silver" : "bronze";
      tier = 1;
      color = "gold";
      text = slotRank === 2 ? "Runden-Silber" : "Runden-Bronze";
    } else if (bonSum >= 13 && net > p.val) {
      cause = "push";
      tier = 1;
      color = "cyan";
      text = `+${fmt1(bonSum)} Push`;
    } else if (delta >= 3) {
      cause = "climb";
      tier = 1;
      color = "violet";
      text = `▲${delta} Plätze`;
    } else if (topNet > 0 && net >= topNet * 0.9) {
      cause = "strong";
      tier = 1;
      color = "gold";
      text = `stark · ${fmt1(net)}`;
    }
    // Budgets drosseln nur die Zusatz-Causes fremder Teams (leader/top3jump/push/
    // climb/strong). Die echten Top-3 (best/silver/bronze) sowie injury/star sind
    // ausgenommen und erscheinen immer in voller Tier-Stärke.
    const exemptFromBudget = cause === "injury" || cause === "star" || cause === "best" || cause === "silver" || cause === "bronze";
    if (!isMine && !exemptFromBudget) {
      if (tier === 2) {
        if (tier2Budget.current > 0) tier2Budget.current -= 1;
        else tier = 1;
      }
      if (tier === 1) {
        if (tier1Budget.current > 0) tier1Budget.current -= 1;
        else tier = 0;
      }
    }
    return { tier, cause, color, text, delta };
  }

  // ---- FX ----
  const fireFlash = useCallback(
    (color: string) => {
      if (reduced.current) return;
      const id = fxId.current++;
      setFlash({ color, id });
      later(() => setFlash((f) => (f && f.id === id ? null : f)), 520);
    },
    [later],
  );
  const doShake = useCallback(
    (soft: boolean) => {
      if (reduced.current) return;
      setShake(soft ? "soft" : "hard");
      later(() => setShake("none"), soft ? 320 : 440);
    },
    [later],
  );
  const addPop = useCallback(
    (net: number, mine: boolean, pos: { x: number; y: number }) => {
      if (reduced.current) return;
      const id = fxId.current++;
      setPops((ps) => [...ps, { id, xPct: (pos.x / W) * 100 + (Math.random() * 3 - 1.5), yPct: (pos.y / H) * 100 - (Math.random() * 3 + 1), net, mine }]);
      later(() => setPops((ps) => ps.filter((p) => p.id !== id)), 950);
    },
    [later, W, H],
  );
  const addFrags = useCallback(
    (p: NativeStagePlayer, pos: { x: number; y: number }) => {
      if (reduced.current) return;
      const items = p.mods.filter((m) => Math.abs(m.amt) >= 0.05).slice(0, 4);
      const created: Frag[] = items.map((m) => ({
        id: fxId.current++,
        xPct: (pos.x / W) * 100 + (Math.random() * 4 - 2),
        yPct: (pos.y / H) * 100 - 2,
        text: `${m.sign < 0 ? "−" : "+"}${fmt1(m.amt)} ${m.k}`,
        sign: m.sign,
      }));
      if (created.length === 0) return;
      setFrags((fs) => [...fs, ...created]);
      const ids = new Set(created.map((c) => c.id));
      later(() => setFrags((fs) => fs.filter((f) => !ids.has(f.id))), 900);
    },
    [later, W, H],
  );
  const glow = useCallback(
    (t: RT) => {
      t.glowUntil = Date.now() + 1500;
      // Re-Render nach Ablauf, sonst pulsieren die letzten Ringe einer Runde
      // ewig weiter (nichts rendert mehr nach dem letzten Reveal).
      later(() => force(), 1550);
    },
    [later],
  );

  const showSpotlight = useCallback(
    (o: NonNullable<Spot>, holdMs = 1500) => {
      setSpotlight(o);
      later(() => setSpotlight((s) => (s === o ? null : s)), holdMs);
    },
    [later],
  );

  const pushTicker = useCallback((t: RT, slot: number, res: { player: NativeStagePlayer; net: number }, impact: Impact, rt: RT[]) => {
    const p = res.player;
    const sr = slotRankOf(slot, t, rt);
    const delta = t.roundDelta;
    const badgeMap: Record<string, [string, string]> = {
      star: ["var(--nl-warn)", "⭐ Star"],
      injury: ["var(--nl-risk)", "Verletzung"],
      leader: ["var(--nl-good)", "Neue Spitze"],
      top3: ["var(--nl-good)", "Sprung Top 3"],
      best: ["var(--nl-good)", "Etappensieger"],
      silver: ["var(--nl-mut)", "Runden-Silber"],
      bronze: ["rgb(205,127,50)", "Runden-Bronze"],
      push: ["var(--nl-accent)", "Hart gepusht"],
      climb: ["var(--nl-accent)", "Aufholjagd"],
      strong: ["var(--nl-good)", "Stark"],
    };
    const badge = badgeMap[impact.cause] ?? null;
    const row: TickerReveal = {
      kind: "reveal",
      id: `${slot}-${t.code}-${fxId.current++}`,
      code: t.code,
      idx: t.idx,
      isOwn: t.isOwn,
      logoUrl: t.logoUrl,
      star: p.val >= STAR_MIN,
      playerName: p.name,
      slotLbl: slots[slot] ?? `Etappe ${slot + 1}`,
      slotRank: sr,
      badge,
      calc: calcString(p),
      net: res.net,
      rankAfter: t.roundRankAfter,
      delta,
      slot,
    };
    setTicker((rows) => [row, ...rows].slice(0, TICKER_MAX));
  }, [slots]);

  const roundSummary = useCallback((rnd: number, rt: RT[]) => {
    const jumps = rt
      .map((t) => ({ t, d: t.roundStartRank - t.rank }))
      .filter((x) => x.d > 0)
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    const parts = jumps.map(({ t, d }) => {
      const p = t.players[rnd];
      return `${t.code} ▲${d} · ${p?.name ?? ""} ${p ? fmt1(playerNet(p)) : ""}`;
    });
    const row: TickerSummary = {
      kind: "summary",
      id: `sum-${rnd}-${fxId.current++}`,
      text: jumps.length ? `Runde ${rnd + 1} — Größte Sprünge: ${parts.join(" · ")}` : `Runde ${rnd + 1} — keine Rangsprünge`,
    };
    setTicker((rows) => [row, ...rows].slice(0, TICKER_MAX));
    jumps.forEach(({ t }) => glow(t));
  }, [glow]);

  // Runden-Kopfzeile (einmal je Runde) — ersetzt das wiederholte Slot-Label in jeder Reveal-Zeile.
  const pushRoundHeader = useCallback((rnd: number) => {
    const row: TickerHeader = {
      kind: "header",
      id: `hdr-${rnd}-${fxId.current++}`,
      text: `Runde ${rnd + 1} · ${slots[rnd] ?? `Etappe ${rnd + 1}`}`,
    };
    setTicker((rows) => [row, ...rows].slice(0, TICKER_MAX));
  }, [slots]);

  // ---- Podest ----
  const showPodium = useCallback(() => {
    const rt = rtRef.current;
    const top3 = [...rt].sort((a, b) => b.score - a.score || a.seasonRank - b.seasonRank).slice(0, 3);
    if (top3.length === 0) return;
    // visuelle Reihenfolge [P2, P1, P3]; Aufstieg P3→P2→P1
    const visual: (RT | undefined)[] = [top3[1], top3[0], top3[2]];
    const place = [2, 1, 3];
    const delayByVisual = [740, 1180, 300];
    const cols: PodCol[] = [];
    visual.forEach((t, i) => {
      if (!t) return;
      cols.push({ place: place[i], code: t.code, name: t.name, pts: t.score, logoUrl: t.logoUrl, isOwn: t.isOwn, idx: t.idx, delayMs: delayByVisual[i], loud: place[i] === 1 });
    });
    setPodium(cols);
    fireFlash("gold");
    cols.forEach((c) => later(() => { audio.wumms(c.loud ? 1.15 : 0.7); if (c.loud) doShake(false); }, c.delayMs));
    later(() => {
      setEnded(true);
      // Endstand erreicht → Host darf den Real-Modus-Endscreen zeigen (Spoiler-Gate A1).
      if (!endedFiredRef.current) {
        endedFiredRef.current = true;
        onEnded?.();
      }
    }, 2400);
  }, [audio, fireFlash, doShake, later, onEnded]);

  // ---- Reveal-Cascade ----
  const advance = useCallback(() => {
    if (busyRef.current || round >= slotCount) return;
    busyRef.current = true;
    setBusy(true);
    const r = round;
    const rt = rtRef.current;
    rt.forEach((t) => {
      t.roundStartRank = t.rank;
      t.roundMedal = 0;
    });
    // Runden-Slot-Ränge VORAB bestimmen (kein Spoiler: nur gespeichert, erscheint
    // erst mit dem Auftritt): alle Teams nach playerNet(players[r]) absteigend,
    // Tiebreak seasonRank. Liefert echte Top-Performer für Medaillen/Highlights.
    const slotOrder = rt
      .map((t) => ({ t, net: playerNet(t.players[r]), has: !!t.players[r] }))
      .sort((a, b) => b.net - a.net || a.t.seasonRank - b.t.seasonRank);
    slotOrder.forEach((o, i) => {
      o.t.roundSlotRank = i + 1;
    });
    // Etappensieger-Netto = bester Wert eines Teams, das in diesem Slot antritt.
    roundTopNet.current = slotOrder.find((o) => o.has)?.net ?? 0;
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    if (r === 0) audio.gun(0.6);
    pushRoundHeader(r);
    computeRoundStandings(r, rt);
    const order = [...rt].sort((a, b) => b.rank - a.rank); // schlechteste zuerst
    let i = 0;
    const doOne = () => {
      if (i >= order.length) {
        // Rundenende
        roundSummary(r, rt);
        rt.forEach((t) => t.rankHistory.push(t.rank)); // Rang-Verlauf je Etappe
        const nextRound = r + 1;
        setRound(nextRound);
        later(() => {
          busyRef.current = false;
          setBusy(false);
        }, 200);
        if (nextRound >= slotCount) later(showPodium, 900);
        force();
        return;
      }
      const t = order[i++];
      const isMine = t.isOwn;
      const res = applyReveal(t, r, rt);
      const impact = noteReveal(t, r, res, isMine, rt);
      const pos = tokenPos(t, t.score);
      // Bewegung: Token gleitet (CSS-Transition); eigenes Team langsamer (Slow-Mo).
      force();
      // Leerer Slot (Team mit weniger Spielern): nur weiterrücken, keine FX.
      if (!res.player) {
        later(doOne, 90);
        return;
      }
      addPop(res.net, isMine, pos);
      addFrags(res.player, pos);
      pushTicker(t, r, { player: res.player, net: res.net }, impact, rt);
      // Sounds/Highlights nach Tier
      if (impact.tier === 2) {
        showSpotlight({
          crest: { code: t.code, name: t.name, logoUrl: t.logoUrl, isOwn: t.isOwn, players: t.players },
          idx: t.idx,
          kick: causeKick(impact.cause, isMine),
          name: (isMine ? "★ " : "") + res.player.name,
          sub: `${t.code} · ${t.name}${slots[r] ? " · " + slots[r] : ""}`,
          net: res.net,
          chipText: impact.text,
          chipColor: impact.color,
          mine: isMine,
        });
        fireFlash(impact.color);
        doShake(impact.cause === "injury" ? true : !isMine);
        if (impact.cause === "injury") audio.stumbleThud(isMine ? 0.5 : 0.4);
        else if (impact.cause === "star") {
          audio.star();
          later(() => audio.wumms(isMine ? 1.25 : 1.1), 300);
        } else {
          audio.riser();
          later(() => audio.wumms(isMine ? 1.1 : 0.92), 260);
        }
        glow(t);
      } else if (impact.tier === 1) {
        audio.risingPing(res.net);
        glow(t);
      } else if (!isMine) {
        audio.crowdSwell(0.14, 0.28);
      }
      if (isMine && impact.tier < 2) {
        showSpotlight(
          {
            crest: { code: t.code, name: t.name, logoUrl: t.logoUrl, isOwn: true, players: t.players },
            idx: t.idx,
            kick: "DEIN LÄUFER",
            name: "★ " + res.player.name,
            sub: `${t.code} · ${t.name}${slots[r] ? " · " + slots[r] : ""}`,
            net: res.net,
            chipText: `+${fmt1(res.net)}`,
            chipColor: "gold",
            mine: true,
          },
          900,
        );
        glow(t);
      }
      const delay = impact.tier === 2 ? 1550 : isMine ? 750 : impact.tier === 1 ? 240 : 130;
      later(doOne, delay);
    };
    doOne();
  }, [round, slotCount, audio, tokenPos, addPop, addFrags, pushTicker, pushRoundHeader, showSpotlight, fireFlash, doShake, glow, roundSummary, showPodium, later, slots]);

  const quickSim = useCallback(() => {
    if (busyRef.current) return; // Busy-Guard: keine Doppel-Auslösung während einer Cascade.
    clearTimers();
    // Frischer Aufbau: NICHT auf bestehende Scores addieren (sonst Doppel-Zählung
    // nach manuellen Etappen oder erneutem Quick-Sim → z.B. 420 statt 210). (B2)
    rtRef.current = buildRT();
    const rt = rtRef.current;
    for (let r = 0; r < slotCount; r += 1) {
      rt.forEach((t) => {
        const p = t.players[r];
        if (p) {
          t.score = round1(t.score + playerNet(p));
          t.thrownSlot = r;
        }
      });
    }
    recomputeRanks(rt);
    rt.forEach((t) => {
      t.rankHistory = Array.from({ length: slotCount }, () => t.rank);
    });
    setRound(slotCount);
    setBusy(false);
    busyRef.current = false;
    setSpotlight(null);
    setPops([]);
    setFrags([]);
    setTicker([]);
    force();
    later(showPodium, 200);
  }, [slotCount, clearTimers, buildRT, later, showPodium]);

  function causeKick(cause: string, mine: boolean): string {
    const own = mine ? "DEIN LÄUFER · " : "";
    switch (cause) {
      case "leader":
        return own + "Neue Spitze";
      case "top3":
        return own + "Sprung in die Top 3";
      case "best":
        return own + "Bestwert der Etappe";
      case "injury":
        return own + "Verletzung";
      case "star":
        return (mine ? "DEIN STAR · " : "⭐ ") + "Star-Moment";
      default:
        return own + "Standout";
    }
  }

  // ---- Detail-Ergebnis (nach Podest) ----
  const resultRows = useMemo<ResultTableRow[]>(() => {
    if (!ended) return [];
    const rt = rtRef.current;
    // Slot-Bestwerte je Spalte
    const bestNet: number[] = [];
    for (let s = 0; s < slotCount; s += 1) {
      bestNet[s] = Math.max(0, ...rt.map((t) => (t.players[s] ? playerNet(t.players[s]) : 0)));
    }
    return [...rt]
      .sort((a, b) => a.rank - b.rank)
      .map((t) => ({
        rank: t.rank,
        code: t.code,
        name: t.name,
        logoUrl: t.logoUrl,
        isOwn: t.isOwn,
        total: t.score,
        slots: Array.from({ length: slotCount }, (_, s) => {
          const p = t.players[s];
          const net = p ? playerNet(p) : 0;
          return {
            playerName: p?.name ?? "—",
            playerId: p?.playerId ?? null,
            net,
            slotRank: p ? slotRankOf(s, t, rt) : rt.length,
            boniMali: p ? modSum(p.mods) : 0,
            isBest: p ? Math.abs(net - bestNet[s]) < 0.05 && net > 0 : false,
            calc: p ? calcString(p) : "—",
          };
        }),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, slotCount, round]);

  // ---- Live-Ladder ----
  // Bewusst NICHT memoisiert: jeder Reveal mutiert rtRef + force() re-rendert; die
  // Rangfolge muss dann live neu sortiert werden (32 Einträge, günstig).
  const sorted = [...rtRef.current].sort((a, b) => a.rank - b.rank);
  const me = rtRef.current.find((t) => t.isOwn) ?? null;
  const leader = sorted[0] ?? null;
  const now = Date.now();

  // Basketball-Court: Treffer/Fehlwurf-Schwelle = Feld-Median der bereits geworfenen
  // Scores; Hot-Hand = deutlich über dem Median. Nur für prim === "court" berechnet.
  const courtThrown = prim === "court" ? rtRef.current.filter((t) => t.thrownSlot >= 0).map((t) => t.score).sort((a, b) => a - b) : [];
  const courtMedian = courtThrown.length ? courtThrown[Math.floor((courtThrown.length - 1) / 2)]! : 0;
  const courtMax = courtThrown.length ? courtThrown[courtThrown.length - 1]! : 0;
  const courtHotFloor = courtMedian + (courtMax - courtMedian) * 0.5;

  // TDM — Kill-Feed mit ECHTEN Spielernamen: je Team der Top-Fragger (bereits
  // aufgedeckter Spieler mit höchstem Netto-Beitrag), starke Teams fraggen
  // schwächere (Rang oben ⚔ Rang unten). Namen aus dem Kader, keine Fakes.
  const kdaTopFrag = (t: RT): NativeStagePlayer | null => {
    let top: NativeStagePlayer | null = null;
    for (let s = 0; s <= t.thrownSlot; s += 1) {
      const p = t.players[s];
      if (p && (!top || playerNet(p) > playerNet(top))) top = p;
    }
    return top;
  };
  const kdaFeed =
    prim === "kda"
      ? (() => {
          const live = sorted.filter((t) => t.thrownSlot >= 0);
          const out: { killer: string; victim: string }[] = [];
          for (let i = 0; i < Math.min(live.length, 6); i += 1) {
            const killer = live[i]!;
            const victim = live[live.length - 1 - i];
            if (!victim || victim.code === killer.code) continue;
            const kp = kdaTopFrag(killer);
            const vp = kdaTopFrag(victim);
            if (!kp || !vp) continue;
            out.push({ killer: kp.name, victim: vp.name });
          }
          return out;
        })()
      : [];

  // Top-Spieler-Zeile: NUR bereits aufgedeckte Spieler (kein Spoiler). Set aller
  // playerIds bis einschließlich thrownSlot je Team; die statische Host-Liste wird
  // darauf gefiltert (Reihenfolge bleibt, Ränge neu 1…k). Vor dem ersten Reveal leer.
  const revealedPlayerIds = new Set<string>();
  for (const t of rtRef.current) {
    for (let s = 0; s <= t.thrownSlot; s += 1) {
      const pid = t.players[s]?.playerId;
      if (pid) revealedPlayerIds.add(pid);
    }
  }
  const revealedTopPlayers = topPlayers
    ? (() => {
        const rows: DisciplineStageTopPlayer[] = [];
        const ids: (string | null)[] = [];
        topPlayers.rows.forEach((row, i) => {
          const id = topPlayers.ids[i];
          if (id && revealedPlayerIds.has(id)) {
            rows.push({ ...row, rank: rows.length + 1 });
            ids.push(id);
          }
        });
        return { rows, ids };
      })()
    : null;

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <style>{`
        @keyframes olyFlash{0%{opacity:0}18%{opacity:1}100%{opacity:0}}
        @keyframes olyShakeHard{0%,100%{transform:translate(0,0)}15%{transform:translate(-5px,3px)}30%{transform:translate(4px,-4px)}45%{transform:translate(-4px,2px)}60%{transform:translate(3px,-2px)}80%{transform:translate(-2px,1px)}}
        @keyframes olyShakeSoft{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,1px)}}
        @keyframes olyPop{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-150%) scale(1.3)}}
        @keyframes olyFrag{from{opacity:1;transform:translate(-50%,-50%)}to{opacity:0;transform:translate(-50%,-260%)}}
        @keyframes olySpot{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}10%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}88%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
        @keyframes olyPodRise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes olyGlowPulse{0%,100%{opacity:.35}50%{opacity:.9}}
        @media (prefers-reduced-motion: reduce){.oly-anim{animation:none!important;opacity:1!important}}
      `}</style>

      {/* Hauptspalte: Controls · MyTracker · Oval · Ticker */}
      <div style={{ flex: "1 1 620px", minWidth: 0 }}>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={advance} disabled={done || busy} style={{ padding: "9px 18px", fontWeight: 800, fontSize: 13, border: 0, borderRadius: 10, cursor: done || busy ? "default" : "pointer", color: "var(--nl-ink)", background: done ? "var(--nl-line)" : "var(--nl-accent)", opacity: busy && !done ? 0.7 : 1 }}>
            {done ? "✔ Disziplin gewertet" : `▶ Etappe ${round + 1} / ${slotCount} — ${slots[round] ?? ""}`}
          </button>
          <button type="button" onClick={quickSim} style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}>
            ⏩ Quick-Sim
          </button>
          <button type="button" onClick={reset} style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}>
            ↻ Neu
          </button>
          <button type="button" onClick={audio.toggleMute} title="Sound an/aus" style={{ padding: "9px 12px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}>
            {audio.muted ? "🔇 Stumm" : "🔊 Sound"}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audio.volume}
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            title="Lautstärke"
            aria-label="Lautstärke"
            style={{ width: 90, accentColor: "var(--nl-accent)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12.5, color: "var(--nl-mut)" }}>
            {progressLabel ??
              (prim === "kda"
                ? "K/D/A aus der Feld-Wertung abgeleitet · KDA = (K+A)/D"
                : prim === "duelhp"
                ? "Lebensbalken = kumulierte Punkte (100 % = Feldbester)"
                : prim === "bump"
                ? "Linien = Rang nach jeder Etappe (oben = Spitze)"
                : prim === "klassen"
                ? "Liga-Klassen nach Punkt-Lücken (Meister → Keller)"
                : prim === "territory"
                ? "Fläche = eroberter Gebietsanteil (Score als % des Feldes)"
                : prim === "stage"
                ? "Aufstieg zur Ruhm-Treppe = kumulierte Punkte"
                : prim === "mountain"
                  ? "Höhe am Berg = kumulierte Punkte"
                  : prim === "court"
                    ? "Nähe zum Korb = kumulierte Punkte"
                    : prim === "rink"
                      ? "Vorstoß in die Angriffszone = kumulierte Punkte"
                      : prim === "peloton" || prim === "parcours"
                        ? "Position auf der Strecke = kumulierte Punkte"
                        : TOWER_FAMILY.has(prim)
                          ? "Höhe = kumulierte Punkte"
                          : ROW_FAMILY.has(prim)
                            ? "Fortschritt = kumulierte Punkte"
                            : "Position auf dem Oval = kumulierte Punkte")}
          </span>
        </div>

        {/* MyTracker */}
        {me ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", marginBottom: 10, borderRadius: 12, border: "1px solid var(--nl-accent)", background: "color-mix(in srgb, var(--nl-accent) 10%, transparent)" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: "var(--nl-accent)" }}>Dein Team · {me.code}</span>
            <span style={{ fontWeight: 800 }}>Rang {me.rank}</span>
            {round > 0 ? (
              (() => {
                const d = me.roundStartRank - me.rank;
                return (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: d > 0 ? "var(--nl-good)" : d < 0 ? "var(--nl-risk)" : "var(--nl-mut)" }}>
                    {d > 0 ? `▲ ${d} seit Vorrunde` : d < 0 ? `▼ ${-d} seit Vorrunde` : "gehalten"}
                  </span>
                );
              })()
            ) : (
              <span style={{ fontSize: 12.5, color: "var(--nl-mut)" }}>Runde 1 …</span>
            )}
            <span style={{ marginLeft: "auto", fontWeight: 800, color: "var(--nl-accent)" }}>{fmt1(me.score)} Pkt</span>
          </div>
        ) : null}

        {/* Spotlight-Banner */}
        {spotlight ? (
          <div className="oly-anim" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", marginBottom: 10, borderRadius: 12, border: `1.5px solid ${spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)"}`, background: `color-mix(in srgb, ${spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)"} 12%, transparent)` }}>
            {spotlight.crest.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spotlight.crest.logoUrl} alt="" width={38} height={38} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)"}` }} />
            ) : (
              <span aria-hidden style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: `hsl(${hueForIdx(spotlight.idx)} 60% 52%)`, fontWeight: 800, fontSize: 12 }}>{spotlight.crest.code.slice(0, 3)}</span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)" }}>{spotlight.kick}</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{spotlight.name}</div>
              <div style={{ fontSize: 12, color: "var(--nl-mut)" }}>{spotlight.sub}</div>
            </div>
            {spotlight.chipText ? (
              <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-bg)", background: `rgb(${FLASH_COLOR[spotlight.chipColor] ?? FLASH_COLOR.gold})` }}>{spotlight.chipText}</span>
            ) : null}
            <div style={{ fontWeight: 800, fontSize: 30, color: "var(--nl-warn)", flex: "none" }}>+{fmt1(spotlight.net)}</div>
          </div>
        ) : null}

        {/* Jumbotron (nur Court/Basketball): Führender + dein Team + Etappen-Uhr */}
        {prim === "court" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", marginBottom: 10, borderRadius: 12, border: "1px solid var(--nl-line)", background: "linear-gradient(90deg, color-mix(in srgb, var(--nl-panel) 88%, transparent), var(--nl-panel))", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.02em" }}>🏀 {disciplineName ?? "Basketball"}</span>
            {round > 0 && leader ? (
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-warn)", border: "1px solid var(--nl-warn)" }}>
                🏆 Führt: {leader.code} · {fmt1(leader.score)}
              </span>
            ) : null}
            {me ? (
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-accent)", border: "1px solid var(--nl-accent)" }}>
                Dein Team: {me.code} · Platz {me.rank}
              </span>
            ) : null}
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12.5, fontWeight: 700, color: "var(--nl-warn)", background: "var(--nl-bg)", border: "1px solid var(--nl-line)", borderRadius: 7, padding: "3px 10px" }}>
              ⏱ Etappe {Math.min(round, slotCount)}/{slotCount}
            </span>
          </div>
        ) : null}

        {/* Jumbotron (nur TDM): ACE-Banner + dein Team + Kill-Feed-Ticker (echte Namen) */}
        {prim === "kda" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 10, borderRadius: 12, border: "1px solid color-mix(in srgb, var(--nl-accent) 40%, var(--nl-line))", background: "linear-gradient(90deg, color-mix(in srgb, var(--nl-accent) 12%, var(--nl-panel)), var(--nl-panel))", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.03em" }}>🎯 {disciplineName ?? "TDM"}</span>
            {round > 0 && leader ? (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 6, color: "var(--nl-bg)", background: "var(--nl-accent)", letterSpacing: "0.06em" }}>
                ⚡ ACE: {leader.code}
              </span>
            ) : null}
            {me ? (
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-mine)", border: "1px solid var(--nl-mine)" }}>
                Dein Team: {me.code} · Platz {me.rank}
              </span>
            ) : null}
            {kdaFeed.length ? (
              <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--nl-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
                <span style={{ color: "var(--nl-accent)", fontWeight: 800 }}>LIVE </span>
                {kdaFeed.slice(0, 3).map((f, i) => (
                  <span key={i}>
                    {i ? "   ·   " : ""}
                    <b style={{ color: "var(--nl-ink)" }}>{f.killer}</b> ⚔ {f.victim}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Oval-Track + Overlays */}
        <div className={shake !== "none" ? "oly-anim" : undefined} style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--nl-line)", background: "var(--nl-bg)", animation: shake === "hard" ? "olyShakeHard .44s ease" : shake === "soft" ? "olyShakeSoft .3s ease" : undefined }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            <defs>
              {rtRef.current.map((t) =>
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

            {/* Hintergrund: atmosphärische Umgebung (env) ODER dezentes Motiv */}
            {env ? (
              <>
                {/* Himmel / Ambient — alle Primitive */}
                <rect x={0} y={0} width={W} height={H} fill="url(#envSky)" />

                {prim === "klassen" ? (
                  renderKlassenBands(sorted, W, H, env)
                ) : prim === "territory" ? (
                  renderTerritory(sorted, W, H, env)
                ) : prim === "track" ? (
                  <>
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
                      const steps = Math.round(OVAL_BAND / 8);
                      return (
                        <g>
                          {Array.from({ length: steps }).map((_, i) => (
                            <rect key={i} x={sx - 3} y={yTop + i * 8} width={6} height={8} fill={i % 2 === 0 ? env.line : "rgba(0,0,0,0.55)"} />
                          ))}
                          <text x={sx - 16} y={OVAL_M} transform={`rotate(-90 ${sx - 16} ${OVAL_M})`} textAnchor="middle" fontFamily="Georgia, serif" fontSize={17} fontWeight={800} fill={env.line} opacity={0.9}>
                            ZIEL
                          </text>
                        </g>
                      );
                    })()}
                    <path ref={pathRef} d={ovalPath} fill="none" stroke="none" />
                  </>
                ) : ROW_FAMILY.has(prim) ? (
                  <>
                    {/* Horizont-Band hinter dem Feld */}
                    <rect x={0} y={0} width={W} height={layout.top} fill={env.stands} opacity={0.6} />
                    {/* Bahnflächen (alternierende Tönung aus surface[0]/[1]) */}
                    {Array.from({ length: N }).map((_, i) => (
                      <rect key={i} x={layout.xStart} y={layout.top + i * layout.laneH} width={layout.xEnd - layout.xStart} height={layout.laneH} fill={i % 2 ? env.surface[0] : env.surface[1]} opacity={0.55} />
                    ))}
                    {/* TDM: taktisches HUD-Overlay (Scanlines, Fadenkreuz, Scoreboard-Kante) */}
                    {prim === "kda" ? renderSceneEnvBg(prim, env, layout, W, H) : null}
                  </>
                ) : prim === "stage" ? (
                  (() => {
                    // Showcase-Bühne mit Tiefe (Port von showcase-v2 drawStageBG).
                    // Alle Layer HINTER den Tokens, Farben aus env (hsl/rgba, kein Hex).
                    const floorY = layout.floorY;
                    const podiumY = layout.podiumY;
                    const cx = layout.centerX;
                    const baseHalf = layout.baseHalf;
                    const topHalf = layout.topHalf;
                    const bands: number = layout.stairBands;
                    const silhouette = env.deco?.find((d) => d.kind === "silhouette") as { kind: "silhouette"; color: string } | undefined;
                    const crowdColor = silhouette?.color ?? "rgba(0,0,0,0.8)";
                    // b. Publikums-Silhouette am Fuß (deterministische Zacken, keine Animation)
                    const crowdPts: string[] = [`0,${H}`];
                    const cn = 22;
                    for (let i = 0; i <= cn; i += 1) {
                      const x = (i / cn) * W;
                      const h = H - 14 - ((i * 47) % 30);
                      crowdPts.push(`${x},${h}`, `${x + W / cn / 2},${H - 6}`);
                    }
                    crowdPts.push(`${W},${H}`);
                    // g. Spotlight-Kegel auf dem Führenden (wandert automatisch mit)
                    const leader = rtRef.current.find((t) => t.rank === 1) ?? null;
                    const leaderPos = leader ? tokenPos(leader, leader.score) : null;
                    return (
                      <>
                        {/* a. dezenter Rahmen (Himmel-Verlauf liegt bereits als envSky-Rect) */}
                        <rect x={24} y={24} width={W - 48} height={H - 48} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
                        {/* b. Showtreppe — 16 Trapez-Bänder, verjüngen sich zum Podest */}
                        <g>
                          {Array.from({ length: bands }).map((_, i) => {
                            const f0 = i / bands;
                            const f1 = (i + 1) / bands;
                            const y0 = floorY - f0 * (floorY - podiumY);
                            const y1 = floorY - f1 * (floorY - podiumY);
                            const hw0 = baseHalf + (topHalf - baseHalf) * f0;
                            const hw1 = baseHalf + (topHalf - baseHalf) * f1;
                            return (
                              <polygon
                                key={i}
                                points={`${cx - hw0},${y0} ${cx + hw0},${y0} ${cx + hw1},${y1} ${cx - hw1},${y1}`}
                                fill={`rgba(255,255,255,${(0.02 + f0 * 0.05).toFixed(3)})`}
                                stroke={env.line}
                                strokeWidth={1}
                                opacity={0.16}
                              />
                            );
                          })}
                        </g>
                        {/* f. Publikums-Silhouette am Fuß der Treppe */}
                        <polygon points={crowdPts.join(" ")} fill={crowdColor} opacity={0.85} />
                        {/* c. Ruhm-Podest oben — das Ziel */}
                        <rect x={cx - topHalf - 14} y={podiumY - 46} width={(topHalf + 14) * 2} height={60} rx={12} fill="rgba(0,0,0,0.35)" stroke={env.line} strokeWidth={2} />
                        <text x={cx} y={podiumY - 16} textAnchor="middle" fontSize={12} fontWeight={800} fill={env.line} letterSpacing="0.16em">
                          RUHM · PODEST
                        </text>
                        {/* d. Jury-Lichter entlang der Podest-Oberkante (statisch, gedimmt) */}
                        <g fill={env.line} opacity={0.32}>
                          {Array.from({ length: 12 }).map((_, b) => {
                            const bx = cx - topHalf - 6 + (b / 11) * ((topHalf + 6) * 2);
                            return <circle key={b} cx={bx} cy={podiumY - 52} r={3.4} />;
                          })}
                        </g>
                        {/* e. Footlights entlang der Vorderkante */}
                        <g fill={env.line} opacity={0.85}>
                          {Array.from({ length: Math.floor((W - 100) / 54) + 1 }).map((_, i) => (
                            <circle key={i} cx={60 + i * 54} cy={H - 24} r={4} />
                          ))}
                        </g>
                        {/* g. statischer Ambient-Kegel überm Podest + Spotlight auf den Führenden */}
                        <defs>
                          <radialGradient id="stageAmbientCone">
                            <stop offset="0%" stopColor={env.line} stopOpacity={0.22} />
                            <stop offset="100%" stopColor={env.line} stopOpacity={0} />
                          </radialGradient>
                          <radialGradient id="stageLeaderCone">
                            <stop offset="0%" stopColor={env.line} stopOpacity={0.34} />
                            <stop offset="100%" stopColor={env.line} stopOpacity={0} />
                          </radialGradient>
                        </defs>
                        <circle cx={cx} cy={podiumY} r={190} fill="url(#stageAmbientCone)" />
                        {leaderPos ? <ellipse cx={leaderPos.x} cy={leaderPos.y} rx={70} ry={62} fill="url(#stageLeaderCone)" /> : null}
                      </>
                    );
                  })()
                ) : TOWER_FAMILY.has(prim) ? (
                  <>
                    {/* towers: Rückwand oben + Boden ab Grundlinie */}
                    <rect x={0} y={0} width={W} height={layout.baseY} fill={env.stands} opacity={0.28} />
                    <rect x={0} y={layout.baseY} width={W} height={H - layout.baseY} fill={env.surface[2]} />
                    <rect x={0} y={layout.topY} width={W} height={layout.baseY - layout.topY} fill="url(#envSurface)" opacity={0.5} />
                  </>
                ) : (
                  renderSceneEnvBg(prim, env, layout, W, H)
                )}

                {/* Deko-Layer (hinter Tokens) — stage/Szenen rendern ihre Layer selbst */}
                {prim !== "stage" && !SCENE_PRIMS.has(prim) && !FIELD_CUSTOM.has(prim) ? env.deco?.map((d, i) => envDeco(d, W, H, TOWER_FAMILY.has(prim) ? layout.baseY : ROW_FAMILY.has(prim) ? H - layout.top : H - OVAL_M + 30, i)) : null}
                {/* Lichtstimmung */}
                {prim !== "stage" && !SCENE_PRIMS.has(prim) && !FIELD_CUSTOM.has(prim) && env.glow ? envGlow(env.glow, W, H, TOWER_FAMILY.has(prim) ? layout.baseY : H * 0.82, ROW_FAMILY.has(prim) ? layout.xEnd : W - 40) : null}
              </>
            ) : (
              <>{renderMotif(motif, W, H, skinAccent)}</>
            )}

            {/* Feld-Wasserzeichen: Disziplin-Identität */}
            {disciplineName ? (
              <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={env ? env.line : skinAccent} opacity={env ? 0.75 : 0.95} style={{ textTransform: "uppercase" }}>
                {disciplineName}
              </text>
            ) : null}

            {/* Feld je Primitive (schlichte Optik, wenn keine env-Umgebung) */}
            {(env && (prim === "track" || prim === "stage")) || SCENE_PRIMS.has(prim) || FIELD_CUSTOM.has(prim) ? null : prim === "track" ? (
              <>
                <path d={ovalPath} fill="none" stroke="var(--nl-panel)" strokeWidth={54} />
                <path ref={pathRef} d={ovalPath} fill="none" stroke={skinAccent} opacity={0.7} strokeWidth={2} strokeDasharray="6 8" />
              </>
            ) : ROW_FAMILY.has(prim) ? (
              <>
                {Array.from({ length: N }).map((_, i) => {
                  const y = layout.top + i * layout.laneH + layout.laneH / 2;
                  return <line key={i} x1={layout.xStart} y1={y} x2={layout.xEnd} y2={y} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="4 7" opacity={0.5} />;
                })}
                <line x1={layout.xStart} y1={layout.top} x2={layout.xStart} y2={H - layout.top} stroke={skinAccent} strokeWidth={2.5} />
                {Array.from({ length: Math.ceil((H - 2 * layout.top) / 12) }).map((_, i) => (
                  <rect key={i} x={layout.xEnd} y={layout.top + i * 12} width={6} height={6} fill={i % 2 ? "var(--nl-ink)" : "var(--nl-mut)"} opacity={0.7} />
                ))}
                {rtRef.current.map((t) => (
                  <text key={`ll-${t.code}`} x={layout.xStart - 8} y={layout.top + t.laneIdx * layout.laneH + layout.laneH / 2} dominantBaseline="middle" textAnchor="end" fontSize={9.5} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut)"}>
                    {t.isOwn ? "★" : ""}
                    {t.code}
                  </text>
                ))}
              </>
            ) : prim === "stage" ? (
              // Schlichter Fallback (kein env): dunkler Grund + Treppe in --nl-* Tönen.
              (() => {
                const floorY = layout.floorY;
                const podiumY = layout.podiumY;
                const cx = layout.centerX;
                const baseHalf = layout.baseHalf;
                const topHalf = layout.topHalf;
                const bands: number = layout.stairBands;
                return (
                  <>
                    <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" opacity={0.9} />
                    <g>
                      {Array.from({ length: bands }).map((_, i) => {
                        const f0 = i / bands;
                        const f1 = (i + 1) / bands;
                        const y0 = floorY - f0 * (floorY - podiumY);
                        const y1 = floorY - f1 * (floorY - podiumY);
                        const hw0 = baseHalf + (topHalf - baseHalf) * f0;
                        const hw1 = baseHalf + (topHalf - baseHalf) * f1;
                        return (
                          <polygon
                            key={i}
                            points={`${cx - hw0},${y0} ${cx + hw0},${y0} ${cx + hw1},${y1} ${cx - hw1},${y1}`}
                            fill="var(--nl-panel)"
                            opacity={0.35 + f0 * 0.45}
                            stroke={skinAccent}
                            strokeWidth={1}
                            strokeOpacity={0.35}
                          />
                        );
                      })}
                    </g>
                    <rect x={cx - topHalf - 14} y={podiumY - 46} width={(topHalf + 14) * 2} height={60} rx={12} fill="var(--nl-panel)" stroke={skinAccent} strokeWidth={2} />
                    <text x={cx} y={podiumY - 16} textAnchor="middle" fontSize={12} fontWeight={800} fill={skinAccent} letterSpacing="0.16em">
                      RUHM · PODEST
                    </text>
                  </>
                );
              })()
            ) : (
              <>
                <line x1={layout.lPad} y1={layout.baseY} x2={W - layout.rPad} y2={layout.baseY} stroke={skinAccent} strokeWidth={2.5} />
                {[0.25, 0.5, 0.75, 1].map((f, i) => (
                  <line key={i} x1={layout.lPad} y1={layout.baseY - (layout.baseY - layout.topY) * f} x2={W - layout.rPad} y2={layout.baseY - (layout.baseY - layout.topY) * f} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="3 8" opacity={0.45} />
                ))}
                {rtRef.current.map((t) => (
                  <text key={`tl-${t.code}`} x={layout.lPad + t.laneIdx * layout.colW + layout.colW / 2} y={layout.baseY + 13} textAnchor="middle" fontSize={8.5} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut)"}>
                    {t.code}
                  </text>
                ))}
              </>
            )}

            {FIELD_CUSTOM.has(prim) ? null : sorted
              .slice()
              .reverse()
              .map((t) => {
                const pos = tokenPos(t, t.score);
                const r = t.isOwn ? geo.rOwn : geo.r;
                const hue = hueForIdx(t.idx);
                const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
                const dur = t.isOwn ? 1300 : 520;
                const glowing = t.glowUntil > now;
                // Primitive-spezifische Spur/Balken (absolute Koordinaten, hinter dem Token)
                const barW = Math.min(18, (layout.colW ?? 24) * 0.5);
                return (
                  <g key={t.code}>
                    {TOWER_FAMILY.has(prim) ? (() => {
                      const bh = Math.max(0, (layout.baseY ?? pos.y) - pos.y);
                      const nf = Math.min(1, t.score / finalMax);
                      const bw2 = prim === "sparkbar" ? Math.min(11, barW) : barW;
                      const barFill = prim === "thermometer" ? `hsl(${Math.round(120 - nf * 120)} 72% 48%)` : `hsl(${t.isOwn ? 210 : hue} 55% 50%)`;
                      return (
                        <g>
                          <rect x={pos.x - bw2 / 2} y={pos.y} width={bw2} height={bh} rx={3} fill={barFill} opacity={prim === "thermometer" ? 0.72 : t.isOwn ? 0.55 : 0.3} />
                          {prim === "barbell"
                            ? Array.from({ length: Math.floor(bh / 12) }).map((_, k) => (
                                <line key={k} x1={pos.x - bw2 / 2} y1={pos.y + 6 + k * 12} x2={pos.x + bw2 / 2} y2={pos.y + 6 + k * 12} stroke="rgba(0,0,0,0.45)" strokeWidth={1.4} />
                              ))
                            : null}
                        </g>
                      );
                    })() : null}
                    {ROW_FAMILY.has(prim) ? (() => {
                      const laneH = layout.laneH;
                      const x0 = layout.xStart;
                      const x1 = layout.xEnd;
                      const yy = pos.y;
                      const nf = Math.min(1, t.score / finalMax);
                      const fillCol = relColor(t.rel) ?? (t.isOwn ? "var(--nl-accent)" : `hsl(${hue} 55% 55%)`);
                      if (prim === "platter") {
                        const plates = Math.min(16, Math.max(1, Math.round(nf * 16)));
                        const step = Math.max(1, (pos.x - x0) / plates);
                        return (
                          <g opacity={0.75}>
                            {Array.from({ length: plates }).map((_, k) => (
                              <ellipse key={k} cx={x0 + step * (k + 0.5)} cy={yy} rx={Math.min(7, step * 0.42)} ry={4} fill="none" stroke={fillCol} strokeWidth={1.6} />
                            ))}
                          </g>
                        );
                      }
                      if (prim === "lamps") {
                        const lamps = 10;
                        const lit = Math.round(nf * lamps);
                        const step = (x1 - x0) / lamps;
                        return (
                          <g>
                            {Array.from({ length: lamps }).map((_, k) => {
                              const on = k < lit;
                              const col = on ? (k % 2 ? "hsl(140 60% 50%)" : "hsl(2 75% 56%)") : "var(--nl-line)";
                              return <rect key={k} x={x0 + step * k + step * 0.2} y={yy - laneH * 0.28} width={step * 0.6} height={laneH * 0.56} rx={2} fill={col} opacity={on ? 0.9 : 0.32} />;
                            })}
                          </g>
                        );
                      }
                      if (prim === "kda") {
                        // TDM — K/D/A deterministisch aus dem Feld-normierten Score
                        // ableiten (n = (score−min)/(max−min)). K grün · D rot ·
                        // A blau + KDA-Balken (Fortschritt) + Ratio rechts.
                        const n = fieldNorm(t.score);
                        const kills = Math.round(6 + n * 26);
                        const deaths = Math.round(4 + (1 - n) * 16);
                        const assists = Math.round(4 + n * 16);
                        const kdaRatio = ((kills + assists) / Math.max(1, deaths)).toFixed(1);
                        const barH = Math.min(11, laneH * 0.62);
                        const fs = Math.min(9.5, Math.max(7, laneH * 0.62));
                        return (
                          <g style={{ fontVariantNumeric: "tabular-nums" }}>
                            <rect x={x0} y={yy - barH / 2} width={x1 - x0} height={barH} rx={3} fill="var(--nl-line)" opacity={0.16} />
                            <rect x={x0} y={yy - barH / 2} width={Math.max(0, pos.x - x0)} height={barH} rx={3} fill={fillCol} opacity={0.34} />
                            <text x={x0 + 7} y={yy} dominantBaseline="middle" fontSize={fs} fontWeight={800}>
                              <tspan fill="hsl(140 62% 56%)">{kills}</tspan>
                              <tspan fill="var(--nl-mut)"> / </tspan>
                              <tspan fill="hsl(2 78% 62%)">{deaths}</tspan>
                              <tspan fill="var(--nl-mut)"> / </tspan>
                              <tspan fill="hsl(210 82% 64%)">{assists}</tspan>
                            </text>
                            <text x={x1 - 6} y={yy} dominantBaseline="middle" textAnchor="end" fontSize={fs} fontWeight={800} fill="var(--nl-ink)">
                              {kdaRatio}
                            </text>
                          </g>
                        );
                      }
                      if (prim === "duelhp") {
                        // Mini-DM — 1v1-Lebensbalken im Fighting-Game-Look: skewX-
                        // Slant, Segment-Ticks, HP-Zahl rechts. Farbe hp>60 grün /
                        // >30 gelb / sonst rot. „K.O.?" unter 25 %. Klar anders als kda.
                        const n = fieldNorm(t.score);
                        const hp = Math.round(n * 100);
                        const col = hp > 60 ? "hsl(140 60% 48%)" : hp > 30 ? "hsl(41 85% 55%)" : "hsl(2 78% 56%)";
                        const barH = Math.min(13, laneH * 0.72);
                        const barW = x1 - x0;
                        const fs = Math.min(10, Math.max(7, laneH * 0.66));
                        return (
                          <g>
                            <g transform={`translate(0 ${yy}) skewX(-14)`}>
                              <rect x={x0} y={-barH / 2} width={barW} height={barH} rx={2} fill="var(--nl-line)" opacity={0.22} />
                              <rect x={x0} y={-barH / 2} width={Math.max(0, (hp / 100) * barW)} height={barH} rx={2} fill={col} opacity={0.9} />
                              {Array.from({ length: 9 }).map((_, k) => (
                                <line key={k} x1={x0 + ((k + 1) / 10) * barW} y1={-barH / 2} x2={x0 + ((k + 1) / 10) * barW} y2={barH / 2} stroke="var(--nl-bg)" strokeWidth={0.9} opacity={0.5} />
                              ))}
                            </g>
                            {hp < 25 ? (
                              <text x={x0 + 12} y={yy} dominantBaseline="middle" fontSize={fs} fontWeight={900} fill="hsl(2 88% 64%)" style={{ letterSpacing: "0.08em" }}>
                                K.O.?
                              </text>
                            ) : null}
                            <text x={x1 - 6} y={yy} dominantBaseline="middle" textAnchor="end" fontSize={fs + 1} fontWeight={900} fill={col}>
                              {hp}
                            </text>
                          </g>
                        );
                      }
                      // spybar — Sichtfeld-Balken + entdeckte Objekte
                      const found = Math.max(1, Math.round(nf * 6) + 1);
                      const glyphs = ["⭐", "🔑", "🧩", "🍀", "💎"];
                      return (
                        <g>
                          <rect x={x0} y={yy - 5} width={x1 - x0} height={10} rx={3} fill="var(--nl-line)" opacity={0.22} />
                          <rect x={x0} y={yy - 5} width={Math.max(0, pos.x - x0)} height={10} rx={3} fill={fillCol} opacity={0.38} />
                          {Array.from({ length: found }).map((_, k) => (
                            <text key={k} x={x0 + ((k + 1) / (found + 1)) * (pos.x - x0)} y={yy + 4} textAnchor="middle" fontSize={11}>{glyphs[k % 5]}</text>
                          ))}
                        </g>
                      );
                    })() : null}
                    {prim === "bump" ? (() => {
                      // Rang-über-Etappen-Linie aus RT.rankHistory (kein Score=Position).
                      // Feld grau/leise, Anker (rel oder Top-3) farbig + Endpunkt-Label.
                      const stages = Math.max(1, layout.stagesTotal ?? 1);
                      const hist = t.rankHistory;
                      const xStage = (s: number) => layout.pL + (stages > 1 ? s / (stages - 1) : 0.5) * (W - layout.pL - layout.pR);
                      const yRank = (rk: number) => layout.top + (N > 1 ? (rk - 1) / (N - 1) : 0.5) * (layout.bot - layout.top);
                      const pts: [number, number][] = hist.map((rk, s) => [xStage(s), yRank(rk)]);
                      // Live-Punkt an der laufenden Etappe (aktueller Rang) → Linie zieht mit.
                      const liveStage = Math.min(stages - 1, hist.length);
                      pts.push([xStage(liveStage), yRank(t.rank)]);
                      const anchor = t.rel != null || t.rank <= 3;
                      const rankMed = t.rank === 1 ? "var(--nl-warn)" : t.rank === 2 ? "var(--nl-mut)" : t.rank === 3 ? "rgb(205,127,50)" : null;
                      const col = relColor(t.rel) ?? rankMed ?? "var(--nl-mut)";
                      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
                      const end = pts[pts.length - 1]!;
                      return (
                        <g>
                          <path d={d} fill="none" stroke={anchor ? col : "var(--nl-mut)"} strokeWidth={anchor ? (t.rel ? 2.6 : 1.9) : 1} strokeLinejoin="round" strokeLinecap="round" opacity={anchor ? 0.95 : 0.14} />
                          {anchor ? <text x={end[0] + 11} y={end[1] + 3} fontSize={9.5} fontWeight={800} fill={col}>{t.code}</text> : null}
                        </g>
                      );
                    })() : null}
                    {prim === "stage" || SCENE_PRIMS.has(prim) ? (
                      <ellipse cx={pos.x} cy={pos.y + r * 0.9} rx={r * 0.9} ry={r * 0.32} fill="rgba(0,0,0,0.4)" />
                    ) : null}
                    <g
                      transform={`translate(${pos.x} ${pos.y})`}
                      style={{ transition: reduced.current ? "none" : `transform ${dur}ms cubic-bezier(.34,1.2,.4,1)`, cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
                      onMouseEnter={() => openHover(t.idx)}
                      onMouseLeave={scheduleHoverClose}
                      onClick={() => {
                        if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
                      }}
                    >
                      {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reduced.current ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
                      {/* Buzzer-Beater-Glow — Führung auf dem Court dauerhaft golden umrandet */}
                      {prim === "court" && t.rank === 1 && t.thrownSlot >= 0 ? (
                        <circle r={r + 11} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.5} style={{ animation: reduced.current ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
                      ) : null}
                      {/* TDM: MVP — Rang 1 dauerhaft golden umrandet (Krone unten im Marker-Block) */}
                      {prim === "kda" && t.rank === 1 && t.thrownSlot >= 0 ? (
                        <circle r={r + 9} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.6} style={{ animation: reduced.current ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
                      ) : null}
                      {/* Freund/Feind-Rahmen (mine/ally/rival) — nur Rahmenfarbe, nie Füllung */}
                      {relColor(t.rel) ? <circle r={r + 5.5} fill="none" stroke={relColor(t.rel)!} strokeWidth={2.4} opacity={0.95} /> : null}
                      {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
                      {t.logoUrl ? (
                        <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
                      ) : (
                        <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
                      )}
                      <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
                      {t.isOwn && !ROW_FAMILY.has(prim) ? (
                        <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">
                          ★ {t.code}
                        </text>
                      ) : t.rel && SCENE_PRIMS.has(prim) ? (
                        <text y={-(r + 7)} textAnchor="middle" fontSize={10} fontWeight={800} fill={relColor(t.rel)!}>
                          {t.code}
                        </text>
                      ) : null}
                      {/* Court: Treffer (grüner Swish) / Fehlwurf (rotes X) + 🔥 Hot-Hand + 🏆 Führung */}
                      {prim === "court" && t.thrownSlot >= 0 ? (
                        <g>
                          <g transform={`translate(${r + 5} ${-(r + 5)})`}>
                            {t.score >= courtMedian ? (
                              <>
                                <circle r={5} fill="hsl(140 58% 42%)" stroke="hsl(140 70% 78%)" strokeWidth={1.4} />
                                <path d="M -2.4 0 L -0.6 2 L 2.6 -2.4" fill="none" stroke="hsl(140 82% 92%)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                              </>
                            ) : (
                              <g stroke="hsl(2 78% 62%)" strokeWidth={2} strokeLinecap="round">
                                <line x1={-3} y1={-3} x2={3} y2={3} />
                                <line x1={3} y1={-3} x2={-3} y2={3} />
                              </g>
                            )}
                          </g>
                          {courtMax > courtMedian && t.score > courtHotFloor ? (
                            <text x={-(r + 4)} y={-(r + 1)} textAnchor="end" fontSize={13}>🔥</text>
                          ) : null}
                          {t.rank === 1 ? (
                            <text y={r + 27} textAnchor="middle" fontSize={16}>🏆</text>
                          ) : null}
                        </g>
                      ) : null}
                      {/* TDM: MVP-Krone auf Rang 1 */}
                      {prim === "kda" && t.rank === 1 && t.thrownSlot >= 0 ? (
                        <text y={-(r + 5)} textAnchor="middle" fontSize={15}>👑</text>
                      ) : null}
                    </g>
                  </g>
                );
              })}
          </svg>

          {/* Score-Pops */}
          {pops.map((p) => (
            <div key={p.id} className="oly-anim" style={{ position: "absolute", left: `${p.xPct}%`, top: `${p.yPct}%`, fontWeight: 800, fontSize: 22, color: p.mine ? "var(--nl-accent)" : "var(--nl-warn)", textShadow: "0 2px 8px rgba(0,0,0,.6)", pointerEvents: "none", animation: "olyPop .9s ease forwards" }}>
              +{fmt1(p.net)}
            </div>
          ))}
          {/* Splitter (Boni grün / Mali rot) */}
          {frags.map((f) => (
            <div key={f.id} className="oly-anim" style={{ position: "absolute", left: `${f.xPct}%`, top: `${f.yPct}%`, fontWeight: 800, fontSize: 12, color: f.sign < 0 ? "var(--nl-risk)" : "var(--nl-good)", pointerEvents: "none", whiteSpace: "nowrap", animation: "olyFrag .85s ease forwards" }}>
              {f.text}
            </div>
          ))}
          {/* Flash */}
          {flash ? (
            <div key={flash.id} style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(circle at 50% 46%, rgba(${FLASH_COLOR[flash.color] ?? FLASH_COLOR.gold},.5), transparent 62%)`, animation: reduced.current ? "none" : "olyFlash .5s ease" }} />
          ) : null}

          {/* Team-Hovercard — absolute IM Shake-Container (Fix: kein position:fixed
              mehr, das durch das Shake-transform verschoben wurde). Position aus
              tokenPos → % des Containers; Flip-Logik statt Fenster-Clamping. */}
          {hover && !podium
            ? (() => {
                const t = rtRef.current[hover.idx];
                if (!t) return null;
                const pos = tokenPos(t, t.score);
                const xPct = (pos.x / W) * 100;
                const yPct = (pos.y / H) * 100;
                const flipX = xPct > 60; // Karte nach links, wenn Token rechts sitzt
                const below = yPct < 35; // Karte unterhalb, wenn Token oben sitzt
                const teamClickable = Boolean(onOpenTeam && t.teamId);
                return (
                  <div
                    onMouseEnter={cancelHoverClose}
                    onMouseLeave={scheduleHoverClose}
                    onClick={teamClickable ? () => onOpenTeam!(t.teamId!) : undefined}
                    style={{
                      position: "absolute",
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: `translate(${flipX ? "calc(-100% - 14px)" : "14px"}, ${below ? "14px" : "calc(-100% - 14px)"})`,
                      width: 280,
                      maxWidth: "72%",
                      zIndex: 4,
                      background: "var(--nl-panel)",
                      border: "1px solid var(--nl-line)",
                      borderRadius: 12,
                      padding: 10,
                      boxShadow: "0 18px 50px -18px rgba(0,0,0,.8)",
                      pointerEvents: "auto",
                      cursor: teamClickable ? "pointer" : "default",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {t.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logoUrl} alt="" width={26} height={26} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: `hsl(${hueForIdx(t.idx)} 60% 52%)`, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{t.code.slice(0, 3)}</span>
                      )}
                      <span style={{ fontWeight: 800 }}>{t.code}</span>
                      <span style={{ fontSize: 12, color: "var(--nl-mut)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                      <span style={{ fontWeight: 800, color: ampel(t.rank) }}>#{t.rank}</span>
                    </div>
                    {/* Court: abgeleitete Box-Score (PTS/REB/AST aus der Feld-Wertung) +
                        echter Top-Beitragender aus dem Kader. Score bleibt Wahrheit/Rang. */}
                    {prim === "court" && t.thrownSlot >= 0
                      ? (() => {
                          const n = fieldNorm(t.score);
                          const pts = Math.round(72 + n * 50);
                          const reb = Math.round(30 + n * 24);
                          const ast = Math.round(14 + n * 18);
                          let top: NativeStagePlayer | null = null;
                          for (let s = 0; s <= t.thrownSlot; s += 1) {
                            const p = t.players[s];
                            if (p && (!top || playerNet(p) > playerNet(top))) top = p;
                          }
                          const hot = courtMax > courtMedian && t.score > courtHotFloor;
                          return (
                            <div style={{ margin: "0 0 7px", padding: "6px 9px", borderRadius: 9, background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }}>
                              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 3 }}>
                                Box-Score · abgeleitet{hot ? " · 🔥 Hot Hand" : ""}
                              </div>
                              <div style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                                <span style={{ color: "var(--nl-accent)" }}>PTS {pts}</span>
                                <span style={{ color: "var(--nl-mut)" }}> · </span>REB {reb}
                                <span style={{ color: "var(--nl-mut)" }}> · </span>AST {ast}
                              </div>
                              {top ? (
                                <div style={{ fontSize: 11.5, color: "var(--nl-mut)", marginTop: 2 }}>
                                  Top-Beitrag: <b style={{ color: "var(--nl-ink)" }}>{top.name}</b> · {fmt1(playerNet(top))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
                    {t.thrownSlot < 0 ? (
                      <div style={{ fontSize: 12, color: "var(--nl-mut)", fontStyle: "italic" }}>noch nicht angetreten</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {Array.from({ length: t.thrownSlot + 1 }, (_, s) => {
                          const p = t.players[s];
                          if (!p) return null;
                          return (
                            <div key={s} style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                              <div style={{ fontWeight: 700 }}>
                                {p.val >= STAR_MIN ? "⭐ " : ""}
                                {p.name} <span style={{ color: "var(--nl-mut)", fontWeight: 600 }}>· {slots[s]}</span>
                              </div>
                              <div style={{ color: "var(--nl-mut)" }}>{calcString(p)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {teamClickable ? (
                      <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--nl-mut)", fontWeight: 700 }}>Klicken für Team-Karte</div>
                    ) : null}
                  </div>
                );
              })()
            : null}

          {/* Podest */}
          {podium ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 24, background: "color-mix(in srgb, var(--nl-bg) 72%, transparent)", backdropFilter: "blur(3px)", zIndex: 5 }}>
              <button type="button" onClick={() => setPodium(null)} title="Podest ausblenden" style={{ position: "absolute", top: 10, right: 12, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--nl-line)", background: "var(--nl-panel)", color: "var(--nl-mut)", cursor: "pointer", fontWeight: 800 }}>×</button>
              <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 14 }}>Endstand · Podest</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                {podium.map((c) => {
                  const h = c.place === 1 ? 132 : c.place === 2 ? 100 : 76;
                  const grad = c.place === 1 ? "linear-gradient(180deg, color-mix(in srgb, var(--nl-warn) 85%, white), var(--nl-warn))" : c.place === 2 ? "linear-gradient(180deg, color-mix(in srgb, var(--nl-mut) 60%, white), var(--nl-mut))" : "linear-gradient(180deg, rgb(224,167,101), rgb(205,127,50))";
                  return (
                    <div key={c.code} className="oly-anim" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: reduced.current ? "none" : `olyPodRise .6s cubic-bezier(.2,1.1,.3,1) ${c.delayMs}ms both` }}>
                      {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt="" width={60} height={60} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--nl-line)", boxShadow: "0 6px 18px -6px rgba(0,0,0,.7)" }} />
                      ) : (
                        <span aria-hidden style={{ width: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", background: `hsl(${hueForIdx(c.idx)} 60% 52%)`, fontWeight: 800, boxShadow: "0 6px 18px -6px rgba(0,0,0,.7)" }}>{c.code.slice(0, 3)}</span>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 800, textAlign: "center", maxWidth: 120, lineHeight: 1.15, color: c.isOwn ? "var(--nl-accent)" : "inherit" }}>{c.isOwn ? "★ " : ""}{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--nl-mut)", fontVariantNumeric: "tabular-nums" }}>{fmt1(c.pts)} Punkte</div>
                      <div style={{ width: 104, height: h, borderRadius: "10px 10px 0 0", background: grad, display: "grid", placeItems: "start center", paddingTop: 8, outline: c.isOwn ? "2px solid var(--nl-accent)" : undefined, outlineOffset: 2 }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: "var(--nl-bg)" }}>{c.place}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {me && me.rank > 3 ? (
                <div style={{ marginTop: 16, fontSize: 13.5, fontWeight: 800, color: "var(--nl-accent)" }}>
                  Dein Team {me.code}: Rang {me.rank} / {N} · {fmt1(me.score)} Punkte
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Top-Spieler-Zeile unter der Arena, ÜBER dem Ticker (nur bereits aufgedeckte Spieler) */}
        {revealedTopPlayers && revealedTopPlayers.rows.length > 0 ? (
          <DisciplineStageTopPlayersRow
            players={revealedTopPlayers.rows}
            playerIdByRow={revealedTopPlayers.ids}
            onOpenPlayer={onOpenPlayer}
            onPreviewPlayer={onPreviewPlayer}
            limit={10}
          />
        ) : null}

        {/* Ticker */}
        <div style={{ marginTop: 12, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 6 }}>Ticker</div>
          {ticker.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Läuft, sobald die erste Etappe startet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto", overscrollBehaviorY: "contain" }}>
              {ticker.map((row) =>
                row.kind === "header" ? (
                  <div key={row.id} style={{ padding: "5px 9px", borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-ink)", background: "color-mix(in srgb, var(--nl-accent) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--nl-accent) 45%, transparent)" }}>
                    {row.text}
                  </div>
                ) : row.kind === "summary" ? (
                  <div key={row.id} style={{ padding: "6px 9px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "var(--nl-warn)", background: "color-mix(in srgb, var(--nl-warn) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--nl-warn) 40%, transparent)" }}>
                    {row.text}
                  </div>
                ) : (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, background: row.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "transparent", fontVariantNumeric: "tabular-nums" }}>
                    <span aria-hidden style={{ width: 20, height: 20, borderRadius: "50%", flex: "none", overflow: "hidden", background: row.logoUrl ? "transparent" : `hsl(${hueForIdx(row.idx)} 60% 52%)`, display: "grid", placeItems: "center" }}>
                      {row.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.logoUrl} alt="" width={20} height={20} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 20, height: 20, objectFit: "cover" }} />
                      ) : null}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.isOwn ? "★ " : ""}
                        {row.star ? "⭐ " : ""}
                        {row.playerName}
                        <span style={{ color: "var(--nl-mut)", fontWeight: 600 }}>
                          {" "}
                          · {row.code} · Slot-Rang <b style={{ color: ampel(row.slotRank) }}>#{row.slotRank}</b>
                        </span>
                        {row.badge ? (
                          <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 99, color: row.badge[0], border: `1px solid ${row.badge[0]}`, background: `color-mix(in srgb, ${row.badge[0]} 14%, transparent)` }}>{row.badge[1]}</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--nl-mut)" }} title={row.calc}>
                        {row.calc}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div style={{ fontWeight: 800, color: "var(--nl-accent)", fontSize: 13 }}>+{fmt1(row.net)}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: row.delta > 0 ? "var(--nl-good)" : row.delta < 0 ? "var(--nl-risk)" : "var(--nl-mut)" }}>
                        <span style={{ color: ampel(row.rankAfter) }}>#{row.rankAfter}</span>
                        {row.slot > 0 && row.delta !== 0 ? ` (${row.delta > 0 ? "▲" : "▼"}${Math.abs(row.delta)})` : ""}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

      </div>

      {/* Live-Ladder rechts */}
      <div style={{ flex: "0 0 300px", minWidth: 260, maxHeight: "calc(100vh - 200px)", overflowY: "auto", background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10, position: "sticky", top: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}>{done ? "Endstand" : "Rundenstand — live"}</div>
        {sorted.map((t) => {
          const teamClickable = Boolean(onOpenTeam && t.teamId);
          const teamHoverable = Boolean(onHoverTeam && t.teamId);
          const rc = relColor(t.rel);
          return (
          <div
            key={t.code}
            onClick={teamClickable ? () => onOpenTeam!(t.teamId!) : undefined}
            onMouseEnter={
              teamHoverable
                ? () => {
                    clearLadderHoverTimer();
                    ladderHoverTimer.current = window.setTimeout(() => onHoverTeam!(t.teamId), 300);
                  }
                : undefined
            }
            onMouseLeave={
              teamHoverable
                ? () => {
                    clearLadderHoverTimer();
                    onHoverTeam!(null);
                  }
                : undefined
            }
            title={teamClickable ? "Team-Karte öffnen" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 8, fontVariantNumeric: "tabular-nums", cursor: teamClickable ? "pointer" : "default", background: t.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : rc ? `color-mix(in srgb, ${rc} 9%, transparent)` : "transparent", boxShadow: rc ? `inset 3px 0 0 ${rc}` : undefined }}>
            <span style={{ width: 22, textAlign: "right", fontWeight: 800, color: ampel(t.rank), fontSize: 12.5 }}>{t.rank}</span>
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" width={16} height={16} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flex: "none" }} />
            ) : (
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, flex: "none", background: `hsl(${hueForIdx(t.idx)} 60% 52%)` }} />
            )}
            <span style={{ width: 44, fontWeight: 800, color: t.isOwn ? "var(--nl-accent)" : "inherit", fontSize: 12.5 }}>{t.code}</span>
            {t.rel && !t.isOwn ? (
              <span title={t.rel === "ally" ? "Verbündet" : t.rel === "rival" ? "Rivale" : "Dein Team"} aria-hidden style={{ fontSize: 11, flex: "none", color: rc ?? undefined }}>{REL_GLYPH[t.rel]}</span>
            ) : null}
            <span style={{ flex: 1, fontSize: 11.5, color: "var(--nl-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
            <span style={{ fontWeight: 800, fontSize: 12.5 }}>{fmt1(t.score)}</span>
          </div>
          );
        })}
      </div>

      {/* Detail-Ergebnistabelle (volle Breite unter der Arena, nach dem Podest) */}
      {ended ? (
        <div style={{ flex: "1 1 100%", minWidth: 0 }}>
          <DisciplineStageResultTable rows={resultRows} slotLabels={slots} onOpenPlayer={onOpenPlayer} />
        </div>
      ) : null}
    </div>
  );
}
