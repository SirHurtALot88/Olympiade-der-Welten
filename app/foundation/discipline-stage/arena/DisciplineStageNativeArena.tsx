"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useStageAudio } from "./useStageAudio";
import DisciplineStageResultTable, { type ResultTableRow } from "./DisciplineStageResultTable";
import DisciplineStageTopPlayersRow from "../DisciplineStageTopPlayersRow";
import type { DisciplineStageTopPlayer } from "../DisciplineStageTopPlayers";
import { fmt1, ampel } from "../stage-format";

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
};
export type StagePrimitive = "track" | "lanes" | "towers";
export type DisciplineStageNativeArenaProps = {
  teams: NativeStageTeam[];
  slots: string[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  topPlayers?: { rows: DisciplineStageTopPlayer[]; ids: (string | null)[] } | null;
  primitive?: StagePrimitive;
  progressLabel?: string; // z.B. "Position auf dem Oval = kumulierte Punkte"
  disciplineName?: string; // Feld-Wasserzeichen (Identität je Disziplin)
  accent?: string; // Akzentfarbe der Disziplin (Wasserzeichen + Feldlinien)
  motif?: StageMotif; // dezentes Hintergrund-Motiv
};

export type StageMotif = "chevrons" | "combat" | "board" | "court" | "weights" | "grid" | "ice" | "stage" | "plates" | "skyline" | "none";

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

const STAR_MIN = 80;
// viewBox + Token-Radien je Primitive. Der Rest (Engine/FX/Ticker/Podest/Tabelle)
// ist geometrieunabhängig; nur Feld-Layout + tokenPos unterscheiden sich.
const PRIM_GEO: Record<StagePrimitive, { w: number; h: number; r: number; rOwn: number }> = {
  track: { w: 1180, h: 620, r: 13, rOwn: 20 },
  lanes: { w: 1180, h: 860, r: 9, rOwn: 13 },
  towers: { w: 1180, h: 600, r: 10, rOwn: 14 },
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
  players: NativeStagePlayer[];
  seasonRank: number;
  score: number;
  thrownSlot: number;
  rank: number;
  roundStartRank: number;
  roundRankAfter: number;
  roundDelta: number;
  roundMedal: 0 | 1 | 2 | 3;
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
type TickerData = TickerReveal | TickerSummary;
type Spot = { crest: NativeStageTeam; idx: number; kick: string; name: string; sub: string; net: number; chipText: string; chipColor: string; mine: boolean } | null;
type PodCol = { place: number; code: string; name: string; pts: number; logoUrl: string | null; isOwn: boolean; idx: number; delayMs: number; loud: boolean };

export default function DisciplineStageNativeArena({ teams, slots, onOpenPlayer, topPlayers, primitive = "track", progressLabel, disciplineName, accent, motif }: DisciplineStageNativeArenaProps) {
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
      players: t.players,
      seasonRank: idx + 1,
      score: 0,
      thrownSlot: -1,
      rank: idx + 1,
      roundStartRank: idx + 1,
      roundRankAfter: idx + 1,
      roundDelta: 0,
      roundMedal: 0 as 0 | 1 | 2 | 3,
      glowUntil: 0,
    }));
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
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const timers = useRef<number[]>([]);
  const fxId = useRef(1);
  const roundBest = useRef<{ net: number } | null>(null);
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
    roundBest.current = null;
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    force();
  }, [buildRT, clearTimers]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const done = round >= slotCount;

  // ---- Feld-Geometrie ----
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  useLayoutEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [prim]);
  const ovalPath = useMemo(() => {
    const m = 70;
    const x0 = m;
    const y0 = m;
    const x1 = W - m;
    const y1 = H - m;
    const r = (y1 - y0) / 2;
    return `M ${x0 + r} ${y0} L ${x1 - r} ${y0} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} L ${x0 + r} ${y1} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
  }, [W, H]);

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
    return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [prim, N, W, H]) as any;

  const scores = rtRef.current.map((t) => t.score);
  const maxScore = Math.max(1, ...scores);
  const minScore = Math.min(0, ...scores);
  const tokenPos = useCallback(
    (t: RT, score: number): { x: number; y: number } => {
      if (prim === "lanes") {
        const idx = t.seasonRank - 1;
        const y = layout.top + idx * layout.laneH + layout.laneH / 2;
        // Headroom: Führender bei ~90 %, die Ziellinie bleibt bis zuletzt frei.
        const norm = maxScore > 0 ? (score / maxScore) * 0.9 : 0;
        return { x: layout.xStart + norm * (layout.xEnd - layout.xStart), y };
      }
      if (prim === "towers") {
        const idx = t.seasonRank - 1;
        const x = layout.lPad + idx * layout.colW + layout.colW / 2;
        const norm = maxScore > 0 ? (score / maxScore) * 0.9 : 0;
        return { x, y: layout.baseY - norm * (layout.baseY - layout.topY) };
      }
      // track (Oval) — Position entlang der Bahn + stabiler Quer-Versatz nach
      // fester Team-Position, damit sich das Feld in ~6 Bahnen auffächert statt
      // zu einem Pulk zu kollabieren.
      if (!pathRef.current || pathLen === 0) return { x: W / 2, y: 70 };
      const span = maxScore - minScore;
      const norm = span > 0 ? (score - minScore) / span : 0;
      const frac = 0.06 + norm * 0.86;
      const L = frac * pathLen;
      const pt = pathRef.current.getPointAtLength(L);
      const p2 = pathRef.current.getPointAtLength(Math.min(pathLen, L + 2));
      let tx = p2.x - pt.x;
      let ty = p2.y - pt.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const lane = ((t.seasonRank - 1) % 6) - 2.5; // -2.5 … 2.5
      const off = lane * 8.5;
      return { x: pt.x + -ty * off, y: pt.y + tx * off };
    },
    [prim, layout, pathLen, maxScore, minScore, W],
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
  function updateRoundMedals(slot: number, rt: RT[]): void {
    const withNet = rt
      .filter((t) => t.thrownSlot === slot)
      .map((t) => ({ t, net: playerNet(t.players[slot]) }))
      .sort((a, b) => b.net - a.net || a.t.seasonRank - b.t.seasonRank);
    rt.forEach((t) => (t.roundMedal = 0));
    withNet.slice(0, 3).forEach((o, i) => (o.t.roundMedal = (i + 1) as 1 | 2 | 3));
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
    updateRoundMedals(slot, rt);
    return { player: p, net };
  }
  function noteReveal(t: RT, slot: number, res: { player: NativeStagePlayer | null; net: number }, isMine: boolean, rt: RT[]): Impact {
    if (!res.player) return { tier: 0, cause: "tick", color: "gold", text: "", delta: t.roundDelta };
    const net = res.net;
    const p = res.player;
    const bonSum = p.mods.filter((m) => m.sign > 0).reduce((s, m) => s + m.amt, 0);
    const injury = p.mods.some((m) => /verletz|injury/i.test(m.k));
    const delta = t.roundDelta;
    const prevBest = roundBest.current ? roundBest.current.net : -1;
    const newBest = net > prevBest;
    if (newBest) roundBest.current = { net };
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
    } else if (newBest) {
      cause = "best";
      tier = 2;
      color = "gold";
      text = `#1 der Etappe · ${fmt1(net)}`;
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
    } else if (prevBest > 0 && net >= prevBest * 0.9) {
      cause = "strong";
      tier = 1;
      color = "gold";
      text = `stark · ${fmt1(net)}`;
    }
    if (!isMine && cause !== "injury") {
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
      best: ["var(--nl-good)", "Rundenbestwert"],
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
    setTicker((rows) => [row, ...rows].slice(0, 8));
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
    setTicker((rows) => [row, ...rows].slice(0, 8));
    jumps.forEach(({ t }) => glow(t));
  }, [glow]);

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
    roundBest.current = null;
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    if (r === 0) audio.gun(0.6);
    computeRoundStandings(r, rt);
    const order = [...rt].sort((a, b) => b.rank - a.rank); // schlechteste zuerst
    let i = 0;
    const doOne = () => {
      if (i >= order.length) {
        // Rundenende
        roundSummary(r, rt);
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
  }, [round, slotCount, audio, tokenPos, addPop, addFrags, pushTicker, showSpotlight, fireFlash, doShake, glow, roundSummary, showPodium, later, slots]);

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
          <span style={{ fontSize: 12.5, color: "var(--nl-mut)" }}>
            {progressLabel ??
              (prim === "towers"
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
            </defs>

            {/* Skin-Motiv (dezenter Hintergrund je Disziplin) */}
            {renderMotif(motif, W, H, skinAccent)}

            {/* Feld-Wasserzeichen: Disziplin-Identität */}
            {disciplineName ? (
              <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.95} style={{ textTransform: "uppercase" }}>
                {disciplineName}
              </text>
            ) : null}

            {/* Feld je Primitive */}
            {prim === "track" ? (
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
                  <text key={`ll-${t.code}`} x={layout.xStart - 8} y={layout.top + (t.seasonRank - 1) * layout.laneH + layout.laneH / 2} dominantBaseline="middle" textAnchor="end" fontSize={9.5} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut)"}>
                    {t.isOwn ? "★" : ""}
                    {t.code}
                  </text>
                ))}
              </>
            ) : (
              <>
                <line x1={layout.lPad} y1={layout.baseY} x2={W - layout.rPad} y2={layout.baseY} stroke={skinAccent} strokeWidth={2.5} />
                {[0.25, 0.5, 0.75, 1].map((f, i) => (
                  <line key={i} x1={layout.lPad} y1={layout.baseY - (layout.baseY - layout.topY) * f} x2={W - layout.rPad} y2={layout.baseY - (layout.baseY - layout.topY) * f} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="3 8" opacity={0.45} />
                ))}
                {rtRef.current.map((t) => (
                  <text key={`tl-${t.code}`} x={layout.lPad + (t.seasonRank - 1) * layout.colW + layout.colW / 2} y={layout.baseY + 13} textAnchor="middle" fontSize={8.5} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut)"}>
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
                    <g
                      transform={`translate(${pos.x} ${pos.y})`}
                      style={{ transition: reduced.current ? "none" : `transform ${dur}ms cubic-bezier(.34,1.2,.4,1)`, cursor: onOpenPlayer ? "pointer" : "default" }}
                      onMouseEnter={(e) => setHover({ idx: t.idx, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setHover({ idx: t.idx, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHover((h) => (h && h.idx === t.idx ? null : h))}
                      onClick={() => {
                        const slot = Math.max(0, Math.min(t.thrownSlot, t.players.length - 1));
                        const pid = t.players[slot]?.playerId;
                        if (onOpenPlayer && pid) onOpenPlayer(pid);
                      }}
                    >
                      {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reduced.current ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
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

        {/* Ticker */}
        <div style={{ marginTop: 12, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 6 }}>Ticker</div>
          {ticker.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Läuft, sobald die erste Etappe startet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {ticker.map((row) =>
                row.kind === "summary" ? (
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
                          · {row.code} · {row.slotLbl} · Slot-Rang <b style={{ color: ampel(row.slotRank) }}>#{row.slotRank}</b>
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

        {/* Top-Spieler-Zeile unter der Arena (nach Player-Points) */}
        {topPlayers && topPlayers.rows.length > 0 ? (
          <DisciplineStageTopPlayersRow players={topPlayers.rows} playerIdByRow={topPlayers.ids} onOpenPlayer={onOpenPlayer} limit={10} />
        ) : null}
      </div>

      {/* Live-Ladder rechts */}
      <div style={{ flex: "0 0 300px", minWidth: 260, maxHeight: "calc(100vh - 200px)", overflowY: "auto", background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10, position: "sticky", top: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}>{done ? "Endstand" : "Rundenstand — live"}</div>
        {sorted.map((t) => (
          <div key={t.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 8, fontVariantNumeric: "tabular-nums", background: t.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "transparent" }}>
            <span style={{ width: 22, textAlign: "right", fontWeight: 800, color: ampel(t.rank), fontSize: 12.5 }}>{t.rank}</span>
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" width={16} height={16} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flex: "none" }} />
            ) : (
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, flex: "none", background: `hsl(${hueForIdx(t.idx)} 60% 52%)` }} />
            )}
            <span style={{ width: 44, fontWeight: 800, color: t.isOwn ? "var(--nl-accent)" : "inherit", fontSize: 12.5 }}>{t.code}</span>
            <span style={{ flex: 1, fontSize: 11.5, color: "var(--nl-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
            <span style={{ fontWeight: 800, fontSize: 12.5 }}>{fmt1(t.score)}</span>
          </div>
        ))}
      </div>

      {/* Detail-Ergebnistabelle (volle Breite unter der Arena, nach dem Podest) */}
      {ended ? (
        <div style={{ flex: "1 1 100%", minWidth: 0 }}>
          <DisciplineStageResultTable rows={resultRows} slotLabels={slots} />
        </div>
      ) : null}

      {/* Hovercard */}
      {hover
        ? (() => {
            const t = rtRef.current[hover.idx];
            if (!t) return null;
            const pad = 16;
            const x = Math.min(hover.x + pad, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300);
            const y = Math.min(hover.y + pad, (typeof window !== "undefined" ? window.innerHeight : 800) - 220);
            return (
              <div style={{ position: "fixed", left: Math.max(4, x), top: Math.max(4, y), width: 280, zIndex: 50, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 12, padding: 10, boxShadow: "0 18px 50px -18px rgba(0,0,0,.8)", pointerEvents: "none" }}>
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
              </div>
            );
          })()
        : null}
    </div>
  );
}
