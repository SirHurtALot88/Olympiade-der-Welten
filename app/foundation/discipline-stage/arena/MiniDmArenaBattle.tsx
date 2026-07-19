"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TeamRelationshipKind } from "@/lib/foundation/team-relationship";
import { teamPrimaryColor } from "@/lib/foundation/team-colors";

// Mini-DM · Arena-Schlacht (Auto-Battler) — nativer React-Nachbau des
// abgenommenen Mockups. 32 Team-Tokens kämpfen live im Dojo-Pit, prallen beim
// Scoren aufeinander, DMG-Zahlen steigen auf, der größte Move einer Runde wird
// als gelbe CRIT-Zahl + Portrait-Spotlight hervorgehoben. Die Wertung entwickelt
// sich dynamisch (Aufholjagd), koppelt aber an die Reveal-Choreografie: der
// Fortschritt p kommt aus den aufgedeckten kumulierten Scores (revealFrac), und
// am Ende (done) steht die Tabelle EXAKT in der Score-Rangliste. Alle Farben als
// hsl()/rgba()/CSS-Token — kein Hex (Design-Token-Lint bleibt sauber).

export type DuelTeamMeta = {
  idx: number;
  code: string;
  name: string;
  isOwn: boolean;
  rel: TeamRelationshipKind | null;
  seasonRank: number;
  teamId: string | null; // Klick auf Token/Zeile → Team-Ansicht
  logoUrl: string | null; // Team-Logo; Fallback = Team-Markenfarbe + Code
  target: number; // Ziel-Schaden (aus dem Endscore abgeleitet) — monoton im Score
  gamma: number; // Aufhol-Kurven-Exponent (klein = Frühstarter/Underdog)
};

// Live-Steckbrief-Daten je Team (Score-Wahrheit) für Hovercard/Callbacks.
export type DuelLiveInfo = {
  rank: number; // echter Live-Rang (Score)
  score: number; // kumulierte Punkte
  deficit: number; // Rückstand auf den Führenden
  topName: string | null; // Top-Beitragender (aufgedeckt)
  topId: string | null;
};

type Props = {
  meta: DuelTeamMeta[];
  info: DuelLiveInfo[]; // indexiert nach team idx — Hover-Steckbrief + Rang/Punkte
  sumFinal: number; // Summe aller Endscores (Nenner für den Fortschritt p)
  revealFrac: number; // 0…1 — aufgedeckter Fortschritt aus der Reveal-Engine
  acesByTeam: string[][]; // je Team die AUFGEDECKTEN Kader-Namen (Top-Beitrag zuerst)
  done: boolean; // Reveal komplett → Fortschritt = 1, Endstand = Score-Rangliste
  reduced: boolean; // prefers-reduced-motion → statischer Fallback ohne rAF
  disciplineName?: string;
  leadCode?: string | null; // Feld-Führender (Score-Wahrheit) für die Kopfleiste
  myCode?: string | null;
  myRank?: number | null;
  onCrit?: ((loud: boolean) => void) | null; // optionaler Sound-Hook
  onOpenTeam?: ((teamId: string) => void) | null;
  onHoverTeam?: ((teamId: string | null) => void) | null;
  onOpenPlayer?: ((playerId: string) => void) | null;
};

const REL_VAR: Record<TeamRelationshipKind, string> = {
  mine: "var(--nl-mine)",
  ally: "var(--nl-ally)",
  rival: "var(--nl-rival)",
};

// Tausenderpunkte ohne toLocaleString/Intl (Design-Token-Lint verbietet beides).
function grp(n: number): string {
  return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
// FNV-1a → 0…1, deterministisch (SSR-stabil, keine Zufalls-Hydration).
function h01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

type PhysNode = {
  idx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sz: number;
  lungeT: number;
  rally: boolean;
};

const ROUND_MS = 5000; // eine Kampfrunde (~5 s, langsam/folgbar) — gemeinsames Reveal-Pacing mit track
const STEP_MS = 16;
const VIS = 15; // sichtbare Board-Zeilen
const ROW_H = 23;

export default function MiniDmArenaBattle({
  meta,
  info,
  sumFinal,
  revealFrac,
  acesByTeam,
  done,
  reduced,
  disciplineName,
  leadCode,
  myCode,
  myRank,
  onCrit,
  onOpenTeam,
  onHoverTeam,
  onOpenPlayer,
}: Props) {
  const N = meta.length;

  // Live-Snapshot der Reveal-gekoppelten Props — die rAF-Schleife liest immer den
  // aktuellsten Stand, ohne dass ein Parent-Render die Schleife neu aufsetzt.
  const snap = useRef({ revealFrac, acesByTeam, done });
  snap.current = { revealFrac, acesByTeam, done };

  const onCritRef = useRef(onCrit);
  onCritRef.current = onCrit;

  // Hover-Steckbrief + Bewegungs-Freeze: solange ein Token/eine Zeile gehovert
  // wird, hält die Physik an, damit man bewegte Tokens sauber treffen/lesen kann.
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const onHoverTeamRef = useRef(onHoverTeam);
  onHoverTeamRef.current = onHoverTeam;
  const clearHoverTimer = () => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };
  const enterTeam = (i: number, teamId: string | null, fromToken: boolean) => {
    hoverIdxRef.current = i;
    const n = nodesRef.current?.[i];
    setHover({ idx: i, x: fromToken && n ? n.x : dimRef.current.W - 8, y: fromToken && n ? n.y : 8 });
    if (teamId && onHoverTeamRef.current) {
      clearHoverTimer();
      hoverTimerRef.current = window.setTimeout(() => onHoverTeamRef.current!(teamId), 300);
    }
  };
  const leaveTeam = () => {
    hoverIdxRef.current = null;
    setHover(null);
    clearHoverTimer();
    onHoverTeamRef.current?.(null);
  };
  useEffect(() => () => clearHoverTimer(), []);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const fxRef = useRef<HTMLDivElement | null>(null);
  const crestRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const nodesRef = useRef<PhysNode[] | null>(null);
  const dimRef = useRef({ W: 760, H: 430 });
  const displayedRef = useRef<number[]>(meta.map(() => 0));
  const koRef = useRef<number[]>(meta.map(() => 0));
  const cycleRef = useRef<number[]>(meta.map(() => 0));
  const pEffRef = useRef(0);
  const prevLeaderRef = useRef<number | null>(null);
  const fxIdRef = useRef(1);

  // Beziehungs- und Ziel-Lookups (stabil)
  const relOf = useMemo(() => meta.map((m) => m.rel), [meta]);
  const targetOf = useMemo(() => meta.map((m) => m.target), [meta]);
  const gammaOf = useMemo(() => meta.map((m) => m.gamma), [meta]);
  const seasonOf = useMemo(() => meta.map((m) => m.seasonRank), [meta]);

  const initialOrder = useMemo(
    () => meta.map((m) => m.idx).sort((a, b) => targetOf[b] - targetOf[a] || seasonOf[a] - seasonOf[b]),
    [meta, targetOf, seasonOf],
  );

  const [board, setBoard] = useState<{ order: number[]; disp: number[]; ko: number[]; leader: number }>({
    order: initialOrder,
    disp: meta.map(() => 0),
    ko: meta.map(() => 0),
    leader: initialOrder[0] ?? 0,
  });
  const [spot, setSpot] = useState<{ idx: number; name: string; victim: string; dmg: number } | null>(null);
  const [spotPop, setSpotPop] = useState(0);
  const [tick, setTick] = useState<{ id: number; kind: "crit" | "lead"; a: string; b: string; dmg?: number; idx: number }[]>([]);

  // ---- Initiale Token-Positionen (deterministisch, hash-basiert) ----
  const initPos = useMemo(
    () =>
      meta.map((m) => {
        const ang = h01(m.code) * 6.283;
        const rad = Math.sqrt(h01(m.code + "r")) * 0.82;
        return { fx: 0.5 + Math.cos(ang) * rad * 0.47, fy: 0.5 + Math.sin(ang) * rad * 0.46 };
      }),
    [meta],
  );

  const buildNodes = (W: number, H: number): PhysNode[] => {
    const cx = W / 2;
    const cy = H / 2;
    return meta.map((m, i) => {
      const p = initPos[i];
      const sp = 0.3 + h01(m.code + "s") * 0.5;
      const va = h01(m.code + "v") * 6.283;
      return {
        idx: m.idx,
        x: p.fx * W,
        y: p.fy * H,
        vx: Math.cos(va) * sp,
        vy: Math.sin(va) * sp,
        sz: m.isOwn ? 34 : 30,
        lungeT: 0,
        rally: false,
      };
    });
  };

  const placeAll = () => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    const leader = board.leader;
    for (let i = 0; i < nodes.length; i += 1) {
      const el = crestRefs.current[i];
      if (!el) continue;
      const n = nodes[i]!;
      const sz = n.idx === leader ? 36 : n.sz;
      el.style.left = `${n.x - sz / 2}px`;
      el.style.top = `${n.y - sz / 2}px`;
    }
  };

  // ---- Größe messen ----
  useLayoutEffect(() => {
    const el = arenaRef.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth || 760;
      const H = el.clientHeight || 430;
      dimRef.current = { W, H };
      if (!nodesRef.current) {
        nodesRef.current = buildNodes(W, H);
      } else {
        // Bei Resize Tokens in die neue Ellipse klemmen (keine Neuverteilung).
        const cx = W / 2;
        const cy = H / 2;
        const rx = W * 0.47;
        const ry = H * 0.46;
        for (const n of nodesRef.current) {
          const ex = (n.x - cx) / rx;
          const ey = (n.y - cy) / ry;
          const e = ex * ex + ey * ey;
          if (e > 1) {
            const s = Math.sqrt(e);
            n.x = cx + (ex / s) * rx * 0.98;
            n.y = cy + (ey / s) * ry * 0.98;
          }
        }
      }
      placeAll();
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- FX: aufsteigende DMG-Zahl + Funken (imperatives DOM, kein React-Churn) ----
  const spawnFx = (x: number, y: number, dmg: number, crit: boolean) => {
    const layer = fxRef.current;
    if (!layer) return;
    const cls = crit ? "crit" : dmg < 120 ? "sm" : "norm";
    const d = document.createElement("div");
    d.className = `mdmb-dmg ${cls}`;
    d.innerHTML = crit ? `<b>CRIT</b>${grp(dmg)}` : grp(dmg);
    d.style.left = `${x}px`;
    d.style.top = `${y - 14}px`;
    layer.appendChild(d);
    d.addEventListener("animationend", () => d.remove());
    const s = document.createElement("div");
    s.className = "mdmb-spark";
    s.textContent = "✦";
    s.style.left = `${x - 8}px`;
    s.style.top = `${y - 8}px`;
    layer.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  };

  const nearestTo = (i: number): number => {
    const nodes = nodesRef.current;
    if (!nodes) return -1;
    const self = nodes[i]!;
    let best = -1;
    let bd = 1e9;
    for (let j = 0; j < nodes.length; j += 1) {
      if (j === i) continue;
      const m = nodes[j]!;
      const dd = Math.hypot(m.x - self.x, m.y - self.y);
      if (dd < bd) {
        bd = dd;
        best = j;
      }
    }
    return best;
  };

  const aceName = (idx: number): string => {
    const list = snap.current.acesByTeam[idx];
    if (!list || list.length === 0) return meta[idx]?.code ?? "—";
    return list[cycleRef.current[idx]! % list.length]!;
  };

  // ---- eine Kampfrunde: Fortschritt einholen, Schaden verteilen, größter Move = Crit ----
  const runRound = () => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    const { W, H } = dimRef.current;
    // pEff ease TOWARDS revealFrac (nie darüber → kein Spoiler; monoton, da
    // revealFrac monoton wächst und wir von unten annähern).
    const targetP = snap.current.done ? 1 : snap.current.revealFrac;
    pEffRef.current += (targetP - pEffRef.current) * 0.5;
    if (targetP - pEffRef.current < 0.002) pEffRef.current = targetP;
    const p = pEffRef.current;

    const disp = displayedRef.current;
    const deltas: { i: number; d: number }[] = [];
    for (let i = 0; i < N; i += 1) {
      let nd = targetOf[i]! * Math.pow(p, gammaOf[i]!);
      if (nd < disp[i]!) nd = disp[i]!; // monoton steigend (Schaden fällt nie)
      const d = nd - disp[i]!;
      disp[i] = nd;
      deltas.push({ i, d });
    }
    // Spieler-Cycling: der „aktive" Kämpfer wandert je Runde weiter.
    for (let i = 0; i < N; i += 1) cycleRef.current[i] = (cycleRef.current[i]! + 1) % 1000;

    deltas.sort((a, b) => b.d - a.d);
    const scorers = deltas.filter((x) => x.d > 1).slice(0, 5);
    scorers.forEach((s, rank) => {
      const crit = rank === 0; // größter Move der Runde = Crit (früh evtl. Underdog)
      const node = nodes[s.i]!;
      const tgt = nearestTo(s.i);
      let ix = node.x;
      let iy = node.y;
      if (tgt >= 0) {
        const tn = nodes[tgt]!;
        const dx = tn.x - node.x;
        const dy = tn.y - node.y;
        const dl = Math.hypot(dx, dy) || 1;
        node.vx += (dx / dl) * 1.9; // Lunge → echtes Aufprallen
        node.vy += (dy / dl) * 1.9;
        node.lungeT = 280;
        ix = (node.x + tn.x) / 2;
        iy = (node.y + tn.y) / 2;
      }
      spawnFx(ix, iy - 4, Math.round(s.d), crit);
      const el = crestRefs.current[s.i];
      if (el) {
        el.classList.remove("hit");
        void el.offsetWidth;
        el.classList.add("hit");
      }
      if (crit) {
        koRef.current[s.i] = (koRef.current[s.i]! + 1);
        const attName = aceName(s.i);
        const vicName = tgt >= 0 ? aceName(nodes[tgt]!.idx) : "—";
        setSpot({ idx: s.i, name: attName, victim: vicName, dmg: Math.round(s.d) });
        setSpotPop((v) => v + 1);
        setTick((rows) => [{ id: fxIdRef.current++, kind: "crit" as const, a: attName, b: vicName, dmg: Math.round(s.d), idx: s.i }, ...rows].slice(0, 10));
        onCritRef.current?.(Math.round(s.d) >= 400);
      }
    });

    // Board: sortieren (Score-Wahrheit via target bei p=1), leader-Wechsel tickern.
    const order = meta
      .map((m) => m.idx)
      .sort((a, b) => disp[b]! - disp[a]! || seasonOf[a]! - seasonOf[b]!);
    const leader = order[0]!;
    if (prevLeaderRef.current != null && leader !== prevLeaderRef.current) {
      const lc = meta[leader]!.code;
      const pc = meta[prevLeaderRef.current]!.code;
      setTick((rows) => [{ id: fxIdRef.current++, kind: "lead" as const, a: lc, b: pc, idx: leader }, ...rows].slice(0, 10));
    }
    prevLeaderRef.current = leader;
    setBoard({ order, disp: disp.slice(), ko: koRef.current.slice(), leader });
  };

  // ---- Bewegungsschritt (Separation + Rally-Puls + Wander + Ellipsen-Rand) ----
  const rallyRef = useRef({ x: 0, y: 0, t: 0, on: false });
  const step = () => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    // Hover friert die Bewegung ein (Tokens bleiben greif-/lesbar); Positionen
    // werden weiter geschrieben, damit der Leader-Token/Rahmen aktuell bleibt.
    if (hoverIdxRef.current != null) {
      placeAll();
      return;
    }
    const { W, H } = dimRef.current;
    const cx = W / 2;
    const cy = H / 2;
    const rx = W * 0.47;
    const ry = H * 0.46;
    const R = rallyRef.current;
    R.t -= STEP_MS;
    if (R.t <= 0) {
      R.on = !R.on;
      R.t = R.on ? 1000 + Math.random() * 700 : 2400 + Math.random() * 1700;
      if (R.on) {
        const ra = Math.random() * 6.283;
        const rr = 0.25 + Math.random() * 0.5;
        R.x = cx + Math.cos(ra) * rr * rx;
        R.y = cy + Math.sin(ra) * rr * ry;
        const arr = nodes.slice().sort((a, b) => Math.hypot(a.x - R.x, a.y - R.y) - Math.hypot(b.x - R.x, b.y - R.y));
        for (const n of nodes) n.rally = false;
        for (let q = 0; q < 9 && q < arr.length; q += 1) arr[q]!.rally = true;
      }
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!;
      let sepx = 0;
      let sepy = 0;
      for (let j = 0; j < nodes.length; j += 1) {
        if (j === i) continue;
        const m = nodes[j]!;
        const ddx = n.x - m.x;
        const ddy = n.y - m.y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 < 6400) {
          const dd = Math.sqrt(d2) || 1;
          if (dd < 38) {
            sepx += (ddx / dd) * (1 - dd / 38);
            sepy += (ddy / dd) * (1 - dd / 38);
          } else {
            sepx += (ddx / dd) * (1 - dd / 80) * 0.16;
            sepy += (ddy / dd) * (1 - dd / 80) * 0.16;
          }
        }
      }
      n.vx += sepx * 0.11;
      n.vy += sepy * 0.11;
      if (R.on && n.rally) {
        n.vx += (R.x - n.x) * 0.0006;
        n.vy += (R.y - n.y) * 0.0006;
      }
      n.vx += (Math.random() - 0.5) * 0.11;
      n.vy += (Math.random() - 0.5) * 0.11;
      if (n.lungeT > 0) n.lungeT -= STEP_MS;
      const sp = Math.hypot(n.vx, n.vy);
      const cap = n.lungeT > 0 ? 2.7 : 1.02;
      if (sp > cap) {
        n.vx *= cap / sp;
        n.vy *= cap / sp;
      }
      if (sp < 0.12) {
        const a = Math.random() * 6.283;
        n.vx += Math.cos(a) * 0.18;
        n.vy += Math.sin(a) * 0.18;
      }
      n.x += n.vx;
      n.y += n.vy;
      const ex = (n.x - cx) / rx;
      const ey = (n.y - cy) / ry;
      const e = ex * ex + ey * ey;
      if (e > 1) {
        const s2 = Math.sqrt(e);
        n.x = cx + (ex / s2) * rx * 0.99;
        n.y = cy + (ey / s2) * ry * 0.99;
        const nx = ex / s2;
        const ny = ey / s2;
        const dot = n.vx * nx + n.vy * ny;
        n.vx -= 2 * dot * nx;
        n.vy -= 2 * dot * ny;
        n.vx *= 0.7;
        n.vy *= 0.7;
      }
    }
    // Kollisionen: nur Abprall (keine Zahlen)
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const A = nodes[a]!;
        const B = nodes[b]!;
        const dx = A.x - B.x;
        const dy = A.y - B.y;
        const d = Math.hypot(dx, dy);
        const mind = (A.sz + B.sz) / 2 - 3;
        if (d < mind) {
          const ov = mind - d || 1;
          const ux = dx / (d || 1);
          const uy = dy / (d || 1);
          A.x += ux * ov * 0.5;
          A.y += uy * ov * 0.5;
          B.x -= ux * ov * 0.5;
          B.y -= uy * ov * 0.5;
          A.vx += ux * 0.18;
          A.vy += uy * 0.18;
          B.vx -= ux * 0.18;
          B.vy -= uy * 0.18;
        }
      }
    }
    placeAll();
  };

  // ---- rAF-Schleife (nur ohne reduced-motion) ----
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      step();
      acc += dt;
      if (acc >= ROUND_MS) {
        acc -= ROUND_MS;
        runRound();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // ---- Reduced-Motion: statischer Fallback (kein rAF) ----
  useEffect(() => {
    if (!reduced) return;
    const p = done ? 1 : revealFrac;
    const disp = displayedRef.current;
    for (let i = 0; i < N; i += 1) {
      const nd = targetOf[i]! * Math.pow(p, gammaOf[i]!);
      if (nd > disp[i]!) disp[i] = nd;
    }
    const order = meta.map((m) => m.idx).sort((a, b) => disp[b]! - disp[a]! || seasonOf[a]! - seasonOf[b]!);
    const leader = order[0]!;
    setBoard({ order, disp: disp.slice(), ko: koRef.current.slice(), leader });
    // ein statisches Sample-Spotlight (echter Top-Beitragender), keine Animation
    if (p > 0 && order.length > 1) {
      const top = order[0]!;
      setSpot({ idx: top, name: aceName(top), victim: aceName(order[order.length - 1]!), dmg: Math.round(disp[top]! * 0.14) });
    }
    if (!nodesRef.current) nodesRef.current = buildNodes(dimRef.current.W, dimRef.current.H);
    placeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, revealFrac, done]);

  const maxDisp = Math.max(1, ...board.disp);
  const rankPos = useMemo(() => {
    const pos: number[] = new Array(N).fill(0);
    board.order.forEach((idx, i) => {
      pos[idx] = i;
    });
    return pos;
  }, [board.order, N]);

  const spotRel = spot ? relOf[spot.idx] : null;
  const spotChip = spotRel ? REL_VAR[spotRel] : "hsl(45 90% 62%)";

  return (
    <div className="mdmb-root">
      <style>{`
        .mdmb-root{--gold:hsl(45 88% 64%);--dmg:hsl(45 100% 64%);--crit:hsl(4 92% 62%);}
        .mdmb-stage{position:relative;border:1px solid var(--nl-line);border-radius:14px;overflow:hidden;background:var(--nl-bg);}
        .mdmb-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 15px;border-bottom:1px solid color-mix(in srgb,var(--gold) 26%,var(--nl-line));background:linear-gradient(90deg,hsl(24 40% 12%),hsl(20 30% 8%));}
        .mdmb-tt{font-size:14px;font-weight:800;letter-spacing:.03em;display:flex;align-items:center;gap:7px;color:var(--nl-ink);}
        .mdmb-chip{font-family:ui-monospace,monospace;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;border:1px solid;}
        .mdmb-live{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;color:var(--nl-mut);display:flex;align-items:center;gap:6px;}
        .mdmb-dot{width:7px;height:7px;border-radius:50%;background:var(--crit);box-shadow:0 0 8px var(--crit);animation:mdmbBlink 1.4s infinite;}
        @keyframes mdmbBlink{50%{opacity:.3}}

        .mdmb-ticker{overflow:hidden;background:hsl(22 30% 7%);border-bottom:1px solid var(--nl-line);padding:5px 0;white-space:nowrap;}
        .mdmb-tmove{display:inline-block;padding-left:100%;animation:mdmbTick 26s linear infinite;}
        @keyframes mdmbTick{from{transform:translateX(0)}to{transform:translateX(-100%)}}
        .mdmb-te{display:inline-block;padding:0 18px;font-family:ui-monospace,monospace;font-size:11px;color:var(--nl-mut);}
        .mdmb-te b{color:var(--nl-ink);}
        .mdmb-te .cr{color:var(--dmg);font-weight:800;}
        .mdmb-te .up{color:var(--nl-good);font-weight:700;}
        .mdmb-te .dead{color:var(--nl-mut);}

        .mdmb-body{position:relative;display:grid;grid-template-columns:1fr 262px;gap:0;}
        @media(max-width:840px){.mdmb-body{grid-template-columns:1fr;}}

        .mdmb-arena{position:relative;height:430px;border-right:1px solid var(--nl-line);overflow:hidden;
          background:radial-gradient(120% 96% at 50% 42%,hsl(340 30% 22%) 0%,hsl(20 24% 11%) 46%,hsl(20 20% 6%) 78%);}
        .mdmb-arena::before{content:"";position:absolute;inset:0;pointer-events:none;
          background:repeating-linear-gradient(115deg,hsl(45 88% 64% / .02),hsl(45 88% 64% / .02) 2px,transparent 2px,transparent 10px);}
        .mdmb-crowd{position:absolute;inset:0;pointer-events:none;background:radial-gradient(closest-side at 50% -8%,hsl(45 88% 64% / .06),transparent 70%);}
        .mdmb-pit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:95%;height:93%;border-radius:50%;pointer-events:none;
          border:1px solid hsl(45 88% 64% / .22);box-shadow:0 0 60px hsl(45 88% 64% / .06) inset,0 0 0 6px hsl(0 0% 100% / .012) inset;}
        .mdmb-pit::after{content:"⚔";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:130px;color:var(--gold);opacity:.05;}

        .mdmb-crest{position:absolute;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
          font-family:ui-monospace,monospace;font-size:9px;font-weight:800;color:var(--nl-ink);letter-spacing:-.02em;z-index:2;will-change:left,top;
          background:linear-gradient(180deg,hsl(265 24% 16%),hsl(262 26% 10%));border:1px solid var(--nl-line-2,var(--nl-line));box-shadow:0 2px 5px hsl(0 0% 0% / .5);}
        .mdmb-crest.mine{border-color:var(--nl-mine);box-shadow:0 0 0 1.5px var(--nl-mine),0 2px 5px hsl(0 0% 0% / .5);z-index:3;}
        .mdmb-crest.ally{border-color:var(--nl-ally);box-shadow:0 0 0 1.5px var(--nl-ally),0 2px 5px hsl(0 0% 0% / .5);z-index:3;}
        .mdmb-crest.rival{border-color:var(--nl-rival);box-shadow:0 0 0 1.5px var(--nl-rival),0 2px 5px hsl(0 0% 0% / .5);z-index:3;}
        .mdmb-crest.lead{width:36px;height:36px;font-size:10px;border-color:var(--gold);z-index:4;
          background:linear-gradient(180deg,hsl(40 60% 22%),hsl(38 70% 12%));box-shadow:0 0 16px hsl(45 88% 64% / .55);}
        .mdmb-crest.hit{animation:mdmbRecoil .26s ease-out;}
        @keyframes mdmbRecoil{0%{filter:brightness(2.4) drop-shadow(0 0 6px var(--dmg));}100%{filter:none;}}
        .mdmb-crown{position:absolute;top:-13px;left:50%;transform:translateX(-50%);font-size:12px;pointer-events:none;}

        .mdmb-fx{position:absolute;inset:0;pointer-events:none;z-index:6;}
        .mdmb-dmg{position:absolute;font-family:ui-monospace,monospace;font-weight:900;pointer-events:none;
          text-shadow:0 1px 0 hsl(0 0% 0%),0 0 8px hsl(0 0% 0% / .7);animation:mdmbFloat 1.7s ease-out forwards;}
        .mdmb-dmg.sm{color:hsl(45 80% 60% / .72);font-size:11px;font-weight:700;}
        .mdmb-dmg.norm{color:var(--dmg);font-size:15px;}
        .mdmb-dmg.crit{color:var(--dmg);font-size:23px;text-shadow:0 1px 0 hsl(0 0% 0%),0 0 12px hsl(45 88% 64% / .6);}
        .mdmb-dmg.crit b{color:var(--crit);font-style:italic;display:block;font-size:9px;letter-spacing:.14em;text-align:center;}
        @keyframes mdmbFloat{0%{opacity:0;transform:translateY(4px) scale(.7)}14%{opacity:1;transform:translateY(-12px) scale(1.05)}70%{opacity:1;transform:translateY(-30px) scale(1)}100%{opacity:0;transform:translateY(-46px) scale(1)}}
        .mdmb-spark{position:absolute;pointer-events:none;font-size:16px;filter:drop-shadow(0 0 6px hsl(45 100% 64% / .95));animation:mdmbSpark .34s ease-out forwards;}
        @keyframes mdmbSpark{0%{opacity:0;transform:scale(.4)}40%{opacity:1;transform:scale(1.25)}100%{opacity:0;transform:scale(1.5)}}

        .mdmb-spot{position:absolute;left:14px;bottom:14px;z-index:7;display:flex;align-items:center;gap:11px;max-width:290px;
          background:linear-gradient(180deg,hsl(340 24% 14% / .94),hsl(20 20% 9% / .94));border:1px solid var(--crit);border-radius:12px;padding:10px 13px 10px 10px;
          box-shadow:0 8px 26px hsl(0 0% 0% / .55),0 0 22px hsl(4 92% 62% / .18);}
        .mdmb-spot.pop{animation:mdmbPop .3s ease-out;}
        @keyframes mdmbPop{0%{transform:scale(.9)}45%{transform:scale(1.04)}100%{transform:scale(1)}}
        .mdmb-port{position:relative;width:52px;height:52px;border-radius:10px;flex:none;overflow:hidden;border:1px solid var(--nl-line-2,var(--nl-line));
          background:radial-gradient(120% 120% at 50% 22%,hsl(265 30% 30%),hsl(262 30% 12%));display:flex;align-items:flex-end;justify-content:center;}
        .mdmb-port svg{width:44px;height:44px;}
        .mdmb-ptag{position:absolute;top:-1px;left:-1px;font-family:ui-monospace,monospace;font-size:8px;font-weight:800;color:hsl(20 20% 6%);padding:1px 5px;border-bottom-right-radius:6px;}
        .mdmb-scrit{font-family:ui-monospace,monospace;font-size:9px;font-weight:900;letter-spacing:.16em;color:var(--crit);}
        .mdmb-sname{font-size:14px;font-weight:800;line-height:1.15;color:var(--nl-ink);}
        .mdmb-sname b{color:var(--gold);}
        .mdmb-sdmg{font-family:ui-monospace,monospace;font-size:11px;color:var(--nl-mut);margin-top:1px;}
        .mdmb-sdmg b{color:var(--nl-ink);font-size:15px;}
        .mdmb-cap{position:absolute;top:9px;right:12px;z-index:7;font-family:ui-monospace,monospace;font-size:9px;color:var(--nl-mut);
          background:hsl(20 20% 6% / .72);padding:3px 8px;border-radius:6px;border:1px solid var(--nl-line);}
        .mdmb-hcard{position:absolute;z-index:8;min-width:150px;max-width:190px;pointer-events:auto;
          background:linear-gradient(180deg,hsl(258 24% 13% / .97),hsl(258 22% 9% / .97));border:1px solid var(--nl-line-2,var(--nl-line));border-radius:10px;
          padding:7px 10px;box-shadow:0 8px 22px hsl(0 0% 0% / .55);}
        .mdmb-hc-t{font-size:12px;font-weight:800;color:var(--nl-ink);line-height:1.2;}
        .mdmb-hc-t b{color:var(--nl-ink);}
        .mdmb-hc-r{font-size:11px;color:var(--nl-mut);margin-top:2px;font-variant-numeric:tabular-nums;}
        .mdmb-hc-r b{color:var(--nl-ink);}
        .mdmb-hc-p{font-size:11px;color:var(--nl-mut);margin-top:2px;}.mdmb-hc-p b{color:var(--gold);}
        .mdmb-hc-p.lnk{cursor:pointer;}.mdmb-hc-p.lnk:hover b{text-decoration:underline;}

        .mdmb-side{padding:11px;background:hsl(20 20% 10% / .55);}
        .mdmb-sh{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;}
        .mdmb-lhead,.mdmb-lrow{display:grid;grid-template-columns:20px 30px 44px 1fr 26px;gap:6px;align-items:center;}
        .mdmb-lhead{font-family:ui-monospace,monospace;font-size:8px;font-weight:800;letter-spacing:.04em;color:var(--nl-mut);text-transform:uppercase;padding:0 4px 5px;}
        .mdmb-board{position:relative;overflow:hidden;}
        .mdmb-lrow{position:absolute;left:0;right:0;height:${ROW_H}px;padding:0 4px;border-radius:5px;border-left:3px solid transparent;
          transition:transform .95s cubic-bezier(.45,0,.2,1),background .3s;}
        .mdmb-lrow.mine{border-left-color:var(--nl-mine);background:color-mix(in srgb,var(--nl-mine) 12%,transparent);}
        .mdmb-lrow.ally{border-left-color:var(--nl-ally);background:color-mix(in srgb,var(--nl-ally) 12%,transparent);}
        .mdmb-lrow.rival{border-left-color:var(--nl-rival);background:color-mix(in srgb,var(--nl-rival) 12%,transparent);}
        .mdmb-lrow.champ{background:linear-gradient(90deg,color-mix(in srgb,var(--gold) 20%,transparent),transparent);}
        .mdmb-lrk{font-family:ui-monospace,monospace;font-size:9px;font-weight:700;text-align:right;color:var(--nl-mut);}
        .mdmb-lcr{height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;font-size:7.5px;font-weight:800;background:hsl(265 24% 16%);border:1px solid var(--nl-line-2,var(--nl-line));}
        .mdmb-lcd{font-family:ui-monospace,monospace;font-size:10.5px;font-weight:800;color:var(--nl-ink);}
        .mdmb-lcd.mine{color:var(--nl-mine);}.mdmb-lcd.ally{color:var(--nl-ally);}.mdmb-lcd.rival{color:var(--nl-rival);}
        .mdmb-ldmg{display:flex;flex-direction:column;gap:2px;}
        .mdmb-ldn{font-family:ui-monospace,monospace;font-size:9.5px;font-weight:800;color:var(--dmg);font-variant-numeric:tabular-nums;}
        .mdmb-ldb{height:5px;border-radius:3px;background:hsl(20 20% 6%);border:1px solid hsl(0 0% 0%);overflow:hidden;}
        .mdmb-ldb i{display:block;height:100%;background:linear-gradient(90deg,hsl(40 50% 30%),var(--dmg));transition:width .5s;}
        .mdmb-lko{font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:var(--crit);text-align:center;}
        .mdmb-foot{margin-top:9px;font-size:10px;color:var(--nl-mut);border-top:1px solid var(--nl-line);padding-top:8px;}
        @media(prefers-reduced-motion:reduce){.mdmb-tmove{animation:none;padding-left:0;}.mdmb-dmg,.mdmb-spark,.mdmb-crest.hit,.mdmb-spot.pop{animation:none;}.mdmb-lrow{transition:none;}}
      `}</style>

      <div className="mdmb-stage">
        <div className="mdmb-top">
          <span className="mdmb-tt">⚔️ {disciplineName ?? "Mini-DM"} · Arena</span>
          {leadCode ? (
            <span className="mdmb-chip" style={{ color: "var(--gold)", borderColor: "var(--gold)" }}>🏆 Führt: {leadCode}</span>
          ) : null}
          {myCode ? (
            <span className="mdmb-chip" style={{ color: "var(--nl-mine)", borderColor: "var(--nl-mine)" }}>
              Dein Team: {myCode}{myRank ? ` · Platz ${myRank}` : ""}
            </span>
          ) : null}
          <span className="mdmb-live"><span className="mdmb-dot" />LIVE</span>
        </div>

        <div className="mdmb-ticker">
          <span className="mdmb-tmove">
            {tick.length === 0 ? (
              <span className="mdmb-te">⚔ Arena-Schlacht — Kampf beginnt, sobald die erste Runde gewertet wird …</span>
            ) : (
              tick.map((e) =>
                e.kind === "crit" ? (
                  <span key={e.id} className="mdmb-te">☠ <b>{e.a}</b> <span className="cr">CRIT {grp(e.dmg ?? 0)}</span> an <span className="dead">{e.b}</span></span>
                ) : (
                  <span key={e.id} className="mdmb-te"><span className="up">↑ {e.a} übernimmt die Führung</span> vor {e.b}</span>
                ),
              )
            )}
          </span>
        </div>

        <div className="mdmb-body">
          <div className="mdmb-arena" ref={arenaRef}>
            <div className="mdmb-crowd" />
            <div className="mdmb-pit" />
            <div className="mdmb-cap">Bewegung live · Rang = Score (Tabelle rechts)</div>
            {meta.map((m, i) => {
              const relCls = m.rel ?? "";
              const isLead = board.leader === m.idx;
              const p = initPos[i];
              const clickable = Boolean(onOpenTeam && m.teamId);
              return (
                <span
                  key={m.code}
                  ref={(el) => {
                    crestRefs.current[i] = el;
                  }}
                  className={`mdmb-crest ${relCls} ${isLead ? "lead" : ""}`}
                  style={{ left: `${p.fx * 760 - 15}px`, top: `${p.fy * 430 - 15}px`, cursor: clickable ? "pointer" : "default", background: m.logoUrl || isLead ? undefined : teamPrimaryColor(m.code) }}
                  title={m.name}
                  onMouseEnter={() => enterTeam(i, m.teamId, true)}
                  onMouseLeave={leaveTeam}
                  onClick={clickable ? () => onOpenTeam!(m.teamId!) : undefined}
                >
                  {m.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.logoUrl} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                  ) : (
                    m.code
                  )}
                  {isLead ? <span className="mdmb-crown">🏆</span> : null}
                </span>
              );
            })}
            {/* Hover-Steckbrief (Team · Rang · Punkte · Rückstand · Top-Spieler) */}
            {hover ? (() => {
              const m = meta[hover.idx]!;
              const inf = info[hover.idx];
              const left = Math.max(6, Math.min(dimRef.current.W - 176, hover.x + 20));
              const top = Math.max(6, Math.min(dimRef.current.H - 96, hover.y - 20));
              return (
                <div className="mdmb-hcard" style={{ left, top }}>
                  <div className="mdmb-hc-t">
                    <b>{m.isOwn ? "★ " : ""}{m.code}</b> · {m.name}
                  </div>
                  {inf ? (
                    <>
                      <div className="mdmb-hc-r">
                        Rang <b>{inf.rank}</b> · <b>{grp(inf.score)}</b> Pkt{inf.deficit > 0 ? ` · −${grp(inf.deficit)} auf Spitze` : " · Spitze"}
                      </div>
                      {inf.topName ? (
                        <div
                          className={`mdmb-hc-p${inf.topId && onOpenPlayer ? " lnk" : ""}`}
                          onClick={inf.topId && onOpenPlayer ? (e) => { e.stopPropagation(); onOpenPlayer(inf.topId!); } : undefined}
                        >
                          Top: <b>{inf.topName}</b>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="mdmb-hc-r">noch nicht angetreten</div>
                  )}
                </div>
              );
            })() : null}
            <div className="mdmb-fx" ref={fxRef} />
            {spot ? (
              <div className={`mdmb-spot ${spotPop % 2 === 0 ? "pop" : "pop"}`} key={spotPop}>
                <div className="mdmb-port">
                  <span className="mdmb-ptag" style={{ background: spotChip }}>{meta[spot.idx]?.code}</span>
                  <svg viewBox="0 0 44 44" aria-hidden="true">
                    <circle cx="22" cy="16" r="8.5" fill="hsl(280 45% 76%)" />
                    <path d="M6 44c0-9 7.2-15 16-15s16 6 16 15z" fill="hsl(270 30% 55%)" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="mdmb-scrit">✦ CRITICAL HIT</div>
                  <div className="mdmb-sname"><b>{spot.name}</b> trifft hart</div>
                  <div className="mdmb-sdmg">an {spot.victim} · <b>{grp(spot.dmg)}</b> DMG</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mdmb-side">
            <div className="mdmb-sh">📊 Scoring-Tabelle</div>
            <div className="mdmb-lhead"><span>#</span><span>LOGO</span><span>TEAM</span><span>SCHADEN</span><span>KO</span></div>
            <div className="mdmb-board" style={{ height: VIS * ROW_H }}>
              {meta.map((m, i) => {
                const pos = rankPos[m.idx]!;
                const relCls = m.rel ?? "";
                const champ = pos === 0;
                const d = board.disp[m.idx] ?? 0;
                const ko = board.ko[m.idx] ?? 0;
                const rk = pos === 0 ? "🏆" : pos === 1 ? "🥈" : pos === 2 ? "🥉" : String(pos + 1);
                const clickable = Boolean(onOpenTeam && m.teamId);
                return (
                  <div
                    key={m.code}
                    className={`mdmb-lrow ${relCls} ${champ ? "champ" : ""}`}
                    style={{ transform: `translateY(${pos * ROW_H}px)`, cursor: clickable ? "pointer" : "default" }}
                    title={clickable ? "Team-Karte öffnen" : m.name}
                    onMouseEnter={() => enterTeam(i, m.teamId, false)}
                    onMouseLeave={leaveTeam}
                    onClick={clickable ? () => onOpenTeam!(m.teamId!) : undefined}
                  >
                    <span className="mdmb-lrk">{rk}</span>
                    <span className="mdmb-lcr" style={{ background: m.logoUrl ? undefined : teamPrimaryColor(m.code), overflow: "hidden", padding: 0 }}>
                      {m.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.logoUrl} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        m.code
                      )}
                    </span>
                    <span className={`mdmb-lcd ${relCls}`}>{m.code}</span>
                    <span className="mdmb-ldmg">
                      <span className="mdmb-ldn">{grp(d)}</span>
                      <span className="mdmb-ldb"><i style={{ width: `${Math.round((d / maxDisp) * 100)}%` }} /></span>
                    </span>
                    <span className="mdmb-lko">{ko || 0}</span>
                  </div>
                );
              })}
            </div>
            <div className="mdmb-foot">Schaden &amp; KO sind aus dem <b style={{ color: "var(--nl-mut)" }}>einen Score</b> abgeleitet — Deko fürs Gefühl. Der Score bleibt die Wahrheit und bestimmt den Rang.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
