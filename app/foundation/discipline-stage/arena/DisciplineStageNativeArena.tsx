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
export type StagePrimitive = "track" | "lanes" | "towers" | "stage";
export type DisciplineStageNativeArenaProps = {
  teams: NativeStageTeam[];
  slots: string[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  onOpenTeam?: ((teamId: string) => void) | null; // Token/Ladder-Klick → Team-Drawer
  onHoverTeam?: ((teamId: string | null) => void) | null; // Ladder-Hover → Team-Vorschau
  onPreviewPlayer?: ((playerId: string | null) => void) | null; // Top-Player-Hover → Vorschau
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
};

function round1(x: number): number {
  return Math.round(x * 10) / 10;
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

export default function DisciplineStageNativeArena({ teams, slots, onOpenPlayer, onOpenTeam, onHoverTeam, onPreviewPlayer, topPlayers, primitive = "track", progressLabel, disciplineName, accent, motif, env }: DisciplineStageNativeArenaProps) {
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
    roundTopNet.current = 0;
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    force();
  }, [buildRT, clearTimers]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);
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
    if (prim === "lanes") {
      const top = 18;
      const laneH = (H - top * 2) / N;
      return { top, laneH, xStart: 84, xEnd: W - 96 };
    }
    if (prim === "towers") {
      const lPad = 40;
      const rPad = 24;
      const colW = (W - lPad - rPad) / N;
      return { lPad, rPad, colW, baseY: H - 52, topY: 44 };
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
  }, [prim, N, W, H]) as any;

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

  const tokenPos = useCallback(
    (t: RT, score: number): { x: number; y: number } => {
      const norm = finalMax > 0 ? score / finalMax : 0; // 0…1, kein Headroom
      if (prim === "lanes") {
        const y = layout.top + t.laneIdx * layout.laneH + layout.laneH / 2;
        return { x: layout.xStart + norm * (layout.xEnd - layout.xStart), y };
      }
      if (prim === "towers") {
        const x = layout.lPad + t.laneIdx * layout.colW + layout.colW / 2;
        return { x, y: layout.baseY - norm * (layout.baseY - layout.topY) };
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
    later(() => setEnded(true), 2400);
  }, [audio, fireFlash, doShake, later]);

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
    clearTimers();
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
  }, [slotCount, clearTimers, later, showPodium]);

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
  const now = Date.now();

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
              (prim === "stage"
                ? "Aufstieg zur Ruhm-Treppe = kumulierte Punkte"
                : prim === "towers"
                  ? "Höhe = kumulierte Punkte"
                  : prim === "lanes"
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
              <img src={spotlight.crest.logoUrl} alt="" width={38} height={38} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)"}` }} />
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

                {prim === "track" ? (
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
                ) : prim === "lanes" ? (
                  <>
                    {/* Horizont-Band hinter dem Feld */}
                    <rect x={0} y={0} width={W} height={layout.top} fill={env.stands} opacity={0.6} />
                    {/* Bahnflächen (alternierende Tönung aus surface[0]/[1]) */}
                    {Array.from({ length: N }).map((_, i) => (
                      <rect key={i} x={layout.xStart} y={layout.top + i * layout.laneH} width={layout.xEnd - layout.xStart} height={layout.laneH} fill={i % 2 ? env.surface[0] : env.surface[1]} opacity={0.55} />
                    ))}
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
                ) : (
                  <>
                    {/* towers: Rückwand oben + Boden ab Grundlinie */}
                    <rect x={0} y={0} width={W} height={layout.baseY} fill={env.stands} opacity={0.28} />
                    <rect x={0} y={layout.baseY} width={W} height={H - layout.baseY} fill={env.surface[2]} />
                    <rect x={0} y={layout.topY} width={W} height={layout.baseY - layout.topY} fill="url(#envSurface)" opacity={0.5} />
                  </>
                )}

                {/* Deko-Layer (hinter Tokens) — stage rendert seine Layer selbst (oben) */}
                {prim !== "stage" ? env.deco?.map((d, i) => envDeco(d, W, H, prim === "towers" ? layout.baseY : prim === "lanes" ? H - layout.top : H - OVAL_M + 30, i)) : null}
                {/* Lichtstimmung */}
                {prim !== "stage" && env.glow ? envGlow(env.glow, W, H, prim === "towers" ? layout.baseY : H * 0.82, prim === "lanes" ? layout.xEnd : W - 40) : null}
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
            {env && (prim === "track" || prim === "stage") ? null : prim === "track" ? (
              <>
                <path d={ovalPath} fill="none" stroke="var(--nl-panel)" strokeWidth={54} />
                <path ref={pathRef} d={ovalPath} fill="none" stroke={skinAccent} opacity={0.7} strokeWidth={2} strokeDasharray="6 8" />
              </>
            ) : prim === "lanes" ? (
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

            {sorted
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
                    {prim === "towers" ? (
                      <rect x={pos.x - barW / 2} y={pos.y} width={barW} height={Math.max(0, layout.baseY - pos.y)} rx={3} fill={`hsl(${t.isOwn ? 210 : hue} 55% 50%)`} opacity={t.isOwn ? 0.4 : 0.28} />
                    ) : null}
                    {prim === "lanes" ? (
                      <line x1={layout.xStart} y1={pos.y} x2={pos.x} y2={pos.y} stroke={t.isOwn ? "var(--nl-accent)" : `hsl(${hue} 55% 55%)`} strokeWidth={t.isOwn ? 3 : 2} opacity={0.5} />
                    ) : null}
                    {prim === "stage" ? (
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
                      {/* Freund/Feind-Rahmen (mine/ally/rival) — nur Rahmenfarbe, nie Füllung */}
                      {relColor(t.rel) ? <circle r={r + 5.5} fill="none" stroke={relColor(t.rel)!} strokeWidth={2.4} opacity={0.95} /> : null}
                      {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
                      {t.logoUrl ? (
                        <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
                      ) : (
                        <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
                      )}
                      <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
                      {t.isOwn && prim !== "lanes" ? (
                        <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">
                          ★ {t.code}
                        </text>
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
                        <img src={t.logoUrl} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: `hsl(${hueForIdx(t.idx)} 60% 52%)`, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{t.code.slice(0, 3)}</span>
                      )}
                      <span style={{ fontWeight: 800 }}>{t.code}</span>
                      <span style={{ fontSize: 12, color: "var(--nl-mut)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                      <span style={{ fontWeight: 800, color: ampel(t.rank) }}>#{t.rank}</span>
                    </div>
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
                        <img src={c.logoUrl} alt="" width={60} height={60} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--nl-line)", boxShadow: "0 6px 18px -6px rgba(0,0,0,.7)" }} />
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
                        <img src={row.logoUrl} alt="" width={20} height={20} style={{ width: 20, height: 20, objectFit: "cover" }} />
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
              <img src={t.logoUrl} alt="" width={16} height={16} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flex: "none" }} />
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
