// =====================================================================================
// peloton (Zeitfahren) — bespoke Rebuild · 1:1 aus scratchpad/timetrial.html.
//
// Punkt-zu-Punkt-Landstraße (Startrampe links → karierte Ziellinie rechts). Alle Teams
// fahren als Wappen-Fahrer im Aero-Hocker; x = kumulierte Punkte (Score = Wahrheit, via
// host.tokenPos → Pops/Hovercard/Endstand bleiben konsistent). KEINE festen Lanes: das
// Feld klumpt organisch (Windschatten), die Führungsgruppe setzt sich ab, das Hauptfeld
// pulkt dahinter. Bewegung: per-Frame rAF-Glide, LINEAR (kein Ruck/Teleport) — jeder
// Reveal startet einen weichen Glide vom aktuellen Punkt zur neuen Score-Position.
//
// FX aus dem Mockup: Windschatten-Pack (Glow + optisches Aufschließen, verschiebt NUR
// die Zeichnung, nie den Score), Wind-Streak skaliert mit Tempo, Streckenprofil-Strip
// mit Fortschritts-Marker (folgt dem Führenden), Bestzeit-Glow (host glow()/glowUntil),
// Gelbes Trikot / Medaillen-Ringe / Krone / Ampel bleiben.
// =====================================================================================
"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { GhostLayer, TokenChrome } from "./benchmark";

// Deterministischer 0…1-Hash (FNV-1a) — Feld-Deko/Fahrer-Phasen ohne Hydration-Mismatch.
function h01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Per-Token-Gleit-/Peloton-Zustand (idx → State). Nur die Zeichnung wandert; toX = Score.
type GP = {
  x: number;
  fromX: number;
  toX: number;
  glideT: number;
  target: number; // letzte bekannte Ziel-x (Score-Position) — Änderung startet neuen Glide
  y: number;
  yTo: number;
  baseOff: number; // stabiler y-Basis-Offset (aus host-Fan) — Seite/Abstand fix
  comp: number; // Peloton-Kompression (Windschatten zieht Grüppchen zur Mitte)
  draft: number;
  draftTo: number; // optisches Aufschließen im Windschatten (nie Score)
  pack: boolean;
  sw: number; // Wind-Streak-Länge (skaliert mit Tempo)
  prevDrawn: number | null;
  wPh: number; // Idle-Roll-Phase
  queue: number; // Start-Grid-Stagger
};

export default function PelotonField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    reducedMotion,
    W,
    H,
    geo,
    layout,
    tokenPos,
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

  // ---- Straßen-Geometrie (aus host-Layout abgeleitet) --------------------------------
  const X0: number = layout.padL;
  const X1: number = W - layout.padR;
  const roadC: number = layout.roadY;
  const ROAD_T = roadC - 74;
  const ROAD_B = roadC + 74;
  const laneT = ROAD_T + 20;
  const laneB = ROAD_B - 20;
  const SKY_B = ROAD_T - 22;
  const PR_T = ROAD_B + 34;
  const PR_B = H - 10;
  const KM = 41;
  const CLUMP_GAP = 40;
  const PACK_GAP = 24;

  // Frische Prop-Spiegel für die rAF-Schleife (ohne Neustart).
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;
  const tokenPosRef = useRef(tokenPos);
  tokenPosRef.current = tokenPos;
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;

  const glideRef = useRef<Map<number, GP>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const ghostRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const streakRefs = useRef<Map<number, SVGLineElement | null>>(new Map());
  const packRefs = useRef<Map<number, SVGCircleElement | null>>(new Map());
  const profmarkRef = useRef<SVGCircleElement | null>(null);

  const rOf = (t: RT): number => (t.isOwn ? geo.rOwn : geo.r);

  // ---- Streckenprofil (deterministisch, stabil über SSR/Client) ----------------------
  const PROF_N = 22;
  const profile = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= PROF_N; i += 1) {
      const x = X0 + (i / PROF_N) * (X1 - X0);
      let hh = Math.sin(i * (0.7 + h01("pw") * 0.5) + 1.7) * 0.35 + h01("pf_" + i) * 0.65;
      hh = clamp(hh * 0.5 + 0.4, 0.06, 1);
      const y = PR_B - 6 - hh * (PR_B - PR_T - 14);
      pts.push([x, y]);
    }
    const area = "M " + X0 + " " + (PR_B - 2) + pts.map((p) => " L " + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("") + " L " + X1 + " " + (PR_B - 2) + " Z";
    const line = "M " + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ");
    return { area, line };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  // ---- Straßen-Deko (Publikum, Wimpel, Absperrgitter, km-Marken) — einmalig ----------
  const roadArt = useMemo(() => {
    const cols = ["#e0b23c", "#d16a4a", "#5a9ad0", "#7ab86a", "#c47ab8", "#c9d2de"];
    const crowd: ReactNode[] = [];
    for (let i = 0; i < 170; i += 1) {
      const cx = 14 + ((i * 97) % (W - 28)) + (h01("cx" + i) - 0.5) * 9;
      const cy = SKY_B - 66 + h01("cy" + i) * 40;
      const c = cols[Math.floor(h01("cc" + i) * cols.length)];
      crowd.push(<circle key={"cr" + i} cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={(1.4 + h01("crr" + i) * 1.1).toFixed(1)} fill={c} opacity={(0.3 + h01("co" + i) * 0.35).toFixed(2)} />);
    }
    const bunting = (y: number): ReactNode[] => {
      const out: ReactNode[] = [<path key="bl" d={`M 12 ${y} H ${W - 12}`} stroke="rgba(200,210,225,.35)" strokeWidth={1} />];
      const bc = ["#e0b23c", "#d16a4a", "#5a9ad0", "#c9d2de"];
      for (let x = 18; x < W - 14; x += 24) {
        out.push(<path key={"bf" + x} d={`M ${x} ${y} l 6 9 l 6 -9 Z`} fill={bc[Math.floor(h01("b" + x) * bc.length)]} opacity={0.55} />);
      }
      return out;
    };
    const barrier = (y: number): ReactNode[] => {
      const out: ReactNode[] = [<rect key={"br" + y} x={14} y={y} width={W - 28} height={4} rx={2} fill="#8b96a4" opacity={0.8} />];
      for (let x = 22; x < W - 20; x += 34) out.push(<rect key={"bp" + y + "_" + x} x={x} y={y + 3} width={3} height={8} fill="#6b7684" opacity={0.7} />);
      return out;
    };
    const dashes = (y: number): ReactNode => <path key={"da" + y} d={`M ${X0 - 60} ${y} H ${X1 + 50}`} stroke="rgba(235,240,246,.4)" strokeWidth={3} strokeDasharray="26 30" />;
    const kmMark = (fr: number): ReactNode => {
      const x = X0 + fr * (X1 - X0);
      return (
        <g key={"km" + fr}>
          <path d={`M ${x} ${ROAD_T + 8} V ${ROAD_B - 8}`} stroke="rgba(235,240,246,.12)" strokeWidth={1.5} strokeDasharray="5 7" />
          <text x={x} y={ROAD_T + 20} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} fill="rgba(235,240,246,.5)">
            {Math.round(KM * fr)} km
          </text>
        </g>
      );
    };
    // Karo-Zielband quer über die Straße
    const checker: ReactNode[] = [];
    const rows = Math.ceil((ROAD_B - ROAD_T) / 10);
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = (i + j) % 2 ? "#10141a" : "#e9ecf2";
        checker.push(<rect key={"ck" + i + "_" + j} x={X1 - 10 + j * 10} y={ROAD_T + i * 10} width={10} height={Math.min(10, ROAD_B - (ROAD_T + i * 10))} fill={col} />);
      }
    }
    return (
      <>
        <defs>
          <linearGradient id="pelAsph" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3c424c" />
            <stop offset=".5" stopColor="#2e333c" />
            <stop offset="1" stopColor="#262b33" />
          </linearGradient>
          <linearGradient id="pelSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a2942" />
            <stop offset="1" stopColor="#3d3450" />
          </linearGradient>
        </defs>
        {/* Abendhimmel */}
        <rect x={0} y={0} width={W} height={SKY_B} fill="url(#pelSky)" />
        <text x={W / 2} y={30} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight={800} fontSize={17} letterSpacing="5" fill="#e9dcc2" opacity={0.4}>
          ZEITFAHREN · EINZELSTART
        </text>
        {bunting(40)}
        {crowd}
        {/* Grasstreifen + oberes Gitter */}
        <rect x={0} y={SKY_B} width={W} height={ROAD_T - SKY_B} fill="#26301e" />
        {barrier(ROAD_T - 12)}
        {/* Asphalt */}
        <rect x={0} y={ROAD_T} width={W} height={ROAD_B - ROAD_T} fill="url(#pelAsph)" />
        <path d={`M 0 ${ROAD_T + 3} H ${W}`} stroke="#e9ecf2" strokeWidth={2.5} opacity={0.55} />
        <path d={`M 0 ${ROAD_B - 3} H ${W}`} stroke="#e9ecf2" strokeWidth={2.5} opacity={0.55} />
        {dashes(ROAD_T + (ROAD_B - ROAD_T) * 0.28)}
        {dashes((ROAD_T + ROAD_B) / 2)}
        {dashes(ROAD_B - (ROAD_B - ROAD_T) * 0.28)}
        {[0.25, 0.5, 0.75].map((f) => kmMark(f))}
        {/* Startrampe links */}
        <rect x={X0 - 42} y={ROAD_T - 6} width={34} height={ROAD_B - ROAD_T + 12} rx={4} fill="#1d2733" stroke="#4d5866" strokeWidth={1.5} />
        <path d={`M ${X0 - 8} ${ROAD_T} L ${X0 + 16} ${ROAD_T + 16} M ${X0 - 8} ${ROAD_B} L ${X0 + 16} ${ROAD_B - 16}`} stroke="#4d5866" strokeWidth={1.5} opacity={0.7} />
        <rect x={X0 - 46} y={ROAD_T - 26} width={42} height={16} rx={3} fill="#2a2410" stroke="#f6c750" strokeWidth={1} />
        <text x={X0 - 25} y={ROAD_T - 14} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9.5} fontWeight={800} fill="#f6c750">
          START
        </text>
        {/* Ziellinie rechts: kariert + Zielbogen */}
        {checker}
        <rect x={X1 + 1} y={ROAD_T - 30} width={4} height={ROAD_B - ROAD_T + 36} fill="#3a424e" />
        <rect x={X1 + 21} y={ROAD_T - 30} width={4} height={ROAD_B - ROAD_T + 36} fill="#3a424e" />
        <rect x={X1 - 8} y={ROAD_T - 34} width={42} height={16} rx={3} fill="#2a2410" stroke="#f6c750" strokeWidth={1} />
        <text x={X1 + 13} y={ROAD_T - 22} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9.5} fontWeight={800} fill="#f6c750">
          ZIEL
        </text>
        {/* unterer Grasstreifen + Gitter */}
        <rect x={0} y={ROAD_B} width={W} height={PR_T - 14 - ROAD_B} fill="#242c1c" />
        {barrier(ROAD_B + 8)}
        {/* Streckenprofil-Strip */}
        <rect x={X0 - 14} y={PR_T - 10} width={X1 - X0 + 42} height={PR_B - PR_T + 18} rx={8} fill="rgba(10,13,10,.55)" stroke="#2c3328" strokeWidth={1} />
        <text x={X0 - 2} y={PR_T + 2} fontFamily="ui-monospace, Menlo, monospace" fontSize={8} fontWeight={800} letterSpacing="2" fill="#7a9a5c" opacity={0.9}>
          STRECKENPROFIL · {KM} KM
        </text>
        <path d={profile.area} fill="rgba(122,150,90,.22)" />
        <path d={profile.line} fill="none" stroke="#7a9a5c" strokeWidth={1.6} opacity={0.85} />
        <path d={`M ${X1} ${PR_T + 6} V ${PR_B - 2}`} stroke="#e9ecf2" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.5} />
        <circle ref={profmarkRef} cx={X0} cy={PR_B - 14} r={4.5} fill="#f6c750" stroke="#2a2410" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 5px rgba(246,199,80,.6))" }} />
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, profile]);

  // ---- rAF: linearer Glide + organische Peloton-Klumpung + Windschatten ---------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let nowT = 0;
    const g = glideRef.current;

    const drawX = (st: GP, reduce: boolean): number => {
      const prog = clamp((st.x - X0) / ((X1 - X0) || 1), 0, 1);
      const fade = Math.max(0, 1 - prog * 12); // Start-Grid löst sich anhand der weichen x-Position
      const bob = reduce ? 0 : Math.sin(nowT * 0.0016 + st.wPh) * 1.4;
      return st.x - st.queue * 10 * fade + st.draft + bob;
    };

    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;
      nowT += dt;
      const rtl = rtRef.current;
      const tp = tokenPosRef.current;
      const reduce = reducedRef.current;
      const frozen = hoverRef.current != null || pausedRef.current;

      // 1) Ziele einlesen (x = displayScore-Position via host.tokenPos); Glide bei Änderung
      //    neu starten. displayScore = Runden-Ziel für ALLE Teams gemeinsam → simultanes
      //    5s-Gleiten (GLIDE_MS = TRACK_ROUND_MS) statt sequenzieller Batch-Sprünge.
      const arr: GP[] = [];
      for (const t of rtl) {
        const tgt = tp(t, t.displayScore);
        let st = g.get(t.idx);
        if (!st) {
          st = {
            x: tgt.x, fromX: tgt.x, toX: tgt.x, glideT: 1, target: tgt.x,
            y: tgt.y, yTo: tgt.y, baseOff: tgt.y - roadC, comp: 1,
            draft: 0, draftTo: 0, pack: false, sw: 8, prevDrawn: null,
            wPh: h01(t.code + "wp") * 6.283, queue: t.laneIdx % 4,
          };
          g.set(t.idx, st);
        }
        st.baseOff = tgt.y - roadC;
        if (Math.abs(tgt.x - st.target) > 0.01) {
          st.fromX = st.x;
          st.toX = tgt.x;
          st.glideT = reduce ? 1 : 0;
          st.target = tgt.x;
        }
        if (reduce) {
          st.x = tgt.x;
          st.toX = tgt.x;
          st.glideT = 1;
        }
        arr.push(st);
      }
      if (arr.length === 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // 2) Peloton-Klumpung nach toX (KEINE Reshuffles): Cluster ≥3 → Kompression zur Mitte.
      arr.sort((a, b) => a.toX - b.toX);
      {
        let gi = 0;
        const groups: GP[][] = [[arr[0]!]];
        for (let i = 1; i < arr.length; i += 1) {
          if (arr[i]!.toX - arr[i - 1]!.toX <= CLUMP_GAP) groups[gi]!.push(arr[i]!);
          else {
            gi += 1;
            groups.push([arr[i]!]);
          }
        }
        for (const grp of groups) {
          const m = grp.length;
          const f = m >= 3 ? Math.max(0.32, Math.min(1, (m * 11) / (laneB - laneT))) : 1;
          for (const st of grp) {
            st.comp = f;
            st.yTo = clamp(roadC + st.baseOff * f, laneT, laneB);
          }
        }
      }

      // 3) Windschatten-Pack (3–10 dicht beieinander): Glow + optisches Aufschließen (nur Zeichnung).
      for (const st of arr) {
        st.pack = false;
        st.draftTo = 0;
      }
      {
        let pi = 0;
        const pg: GP[][] = [[arr[0]!]];
        for (let i = 1; i < arr.length; i += 1) {
          if (arr[i]!.toX - arr[i - 1]!.toX <= PACK_GAP) pg[pi]!.push(arr[i]!);
          else {
            pi += 1;
            pg.push([arr[i]!]);
          }
        }
        for (const grp of pg) {
          if (grp.length < 3 || grp.length > 10) continue;
          const gg = grp.slice().sort((a, b) => b.toX - a.toX);
          const head = gg[0]!.toX;
          gg.forEach((st, j) => {
            st.pack = true;
            if (j > 0) st.draftTo = clamp(head - j * 13 - st.toX, -18, 18);
          });
        }
      }

      // 4) Integration (LINEARER Glide) + weiche Umordnung/Aufschließen + Platzierung.
      let frontX = X0;
      for (const t of rtl) {
        const st = g.get(t.idx);
        if (!st) continue;
        if (!frozen) {
          // Basis-x folgt dem Host-`animScore` (Benchmark-Sync: Feld + Rangliste laufen
          // exakt synchron; Hover/Pause friert beides ein). Die Windschatten-/Pack-Offsets
          // (draft/comp/bob) verschieben nur die Zeichnung, nie die Score-Position.
          st.x = tp(t, t.animScore).x;
          st.draft += (st.draftTo - st.draft) * 0.045;
          st.y += (st.yTo - st.y) * 0.028;
        }
        const dx = drawX(st, reduce);
        const dy = st.y + (reduce ? 0 : Math.cos(nowT * 0.0013 + st.wPh * 1.7) * 1.2);
        const el = gRefs.current.get(t.idx);
        if (el) el.setAttribute("transform", `translate(${dx} ${dy})`);
        // Ghost der Vorrunde (Benchmark): bei tokenPos(roundStartScore); die Lücke = Zugewinn.
        const gel = ghostRefs.current.get(t.idx);
        if (gel) {
          const span = t.displayScore - t.roundStartScore;
          const p = span > 0.5 ? clamp((t.animScore - t.roundStartScore) / span, 0, 1) : 1;
          if (span > 0.5 && !reduce && p < 0.98) {
            const gp = tp(t, t.roundStartScore);
            gel.setAttribute("transform", `translate(${gp.x} ${clamp(roadC + st.baseOff, laneT, laneB)})`);
            gel.setAttribute("opacity", String((t.isOwn ? 0.6 : 0.28) * (1 - p * 0.7)));
          } else {
            gel.setAttribute("opacity", "0");
          }
        }
        if (st.toX > frontX) frontX = st.toX;
        // Wind-Streak: Länge/Intensität skaliert mit aktueller Geschwindigkeit.
        const v = st.prevDrawn == null ? 0 : Math.max(0, dx - st.prevDrawn);
        st.prevDrawn = dx;
        st.sw += (8 + Math.min(30, v * 140) - st.sw) * 0.12;
        const sref = streakRefs.current.get(t.idx);
        if (sref) {
          sref.setAttribute("x1", String(-(rOf(t) + st.sw)));
          sref.setAttribute("opacity", (0.22 + Math.min(0.5, v * 2.6)).toFixed(2));
        }
        const pref = packRefs.current.get(t.idx);
        if (pref) pref.style.opacity = st.pack ? "1" : "0";
      }
      // Fortschritts-Marker (Streckenprofil) folgt dem Führenden.
      if (profmarkRef.current) profmarkRef.current.setAttribute("cx", String(Math.min(X1, frontX)));

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Render: Straße + Fahrer-Tokens (Position imperativ via rAF) --------------------
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

      {roadArt}

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill="#f6c750" opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Fahrern. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Fahrer-Tokens — in Rang-Reihenfolge rückwärts, damit der Führende oben liegt. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = rOf(t);
          const glowing = t.glowUntil > now;
          const isLead = t.rank === 1;
          const roundMed = t.roundMedal === 1 ? "🥇" : t.roundMedal === 2 ? "🥈" : t.roundMedal === 3 ? "🥉" : null;
          const st = glideRef.current.get(t.idx);
          const initX = st ? st.x : X0;
          const initY = st ? st.y : roadC;
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
                // Startposition EINMAL setzen (danach besitzt das rAF die Position — kein
                // JSX-transform, das bei jedem Reveal-Rerender den rAF-Wert überschreibt).
                if (el && !el.getAttribute("transform")) {
                  el.setAttribute("transform", `translate(${initX} ${initY})`);
                }
              }}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Windschatten-Streifen nach hinten (Länge per rAF). */}
              <line
                ref={(el) => {
                  streakRefs.current.set(t.idx, el);
                }}
                x1={-(r + 8)}
                y1={0}
                x2={-r}
                y2={0}
                stroke={isLead ? "rgba(246,199,80,.85)" : "rgba(200,215,235,.85)"}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.3}
              />
              {/* Windschatten-Pack-Ring (Glow, per rAF ein/aus). */}
              <circle
                ref={(el) => {
                  packRefs.current.set(t.idx, el);
                }}
                r={r + 6}
                fill="none"
                stroke="rgba(242,161,60,.5)"
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0}
                style={{ transition: "opacity .3s" }}
              />
              {/* Bestzeit-/Impuls-Glow (host glow() → glowUntil). */}
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={3.5} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Gelbes-Trikot-Glow für den Führenden. */}
              {isLead ? <circle r={r + 7} fill="none" stroke="#f6c750" strokeWidth={2.4} opacity={0.85} style={{ filter: "drop-shadow(0 0 8px rgba(246,199,80,.6))" }} /> : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Peloton trägt seine eigene 🏆-Krone / Runden-Medaille. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {/* Champion-Krone (Endstand) bzw. Runden-Medaille. */}
              {done && isLead ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : roundMed ? (
                // Medaillen-Emoji ÜBER das Token (nicht y=r+13) — dort sitzt der TokenChrome-
                // Rang-Badge, sonst überlagern sich Emoji und „#N".
                <text y={-(r + 7)} textAnchor="middle" fontSize={11}>
                  {roundMed}
                </text>
              ) : null}
            </g>
          );
        })}
    </>
  );
}
