// =====================================================================================
// lamps (Fechten · Salle d'Armes) — Lesbarkeits-Rebuild auf dem Staffel-Benchmark.
//
// FRÜHER: 30 feste Bahnen (y = laneIdx) → jede Bahn ~H/30, Logos winzig & unlesbar.
// JETZT: Archetyp ① (geteiltes Feld, Position = Wert). Die x-Position = GESAMMELTE
// Treffer (score, entstaucht gegen den Live-Führenden via finalMax=posMax). Vertikal
// werden die Fechter über die Planche GESTREUT (stabile, gleichmäßige Hash-Ordnung)
// statt in dünne Bahnen gepresst → deutlich GRÖSSERE, lesbare Token; enge Score-Cluster
// überlappen als „Pulk", statt zu schrumpfen (bewusster Trade-off: lieber groß+überlappt
// als klein+getrennt). Der Führende/eigene liegen oben.
//
// Bewegung: die Token gleiten über den GETEILTEN animScore-Zeitstrahl des Hosts (rAF liest
// t.animScore, roundStartScore→displayScore über TRACK_ROUND_MS) → Feld & Rangliste laufen
// frame-synchron, und die Highlight-Zeitlupe/der Zoom greifen automatisch. Ghost der
// Vorrunde zeigt den Zugewinn; Rang-Badge + Eigen-Anker liefern die „Was geht ab?"-Schicht.
// Landet ein Treffer (score steigt), macht der Fechter einen Ausfall (Klinge streckt sich)
// und der Treffer-Melder flammt rot/grün auf (TOUCHÉ). Score bleibt Wahrheit.
// =====================================================================================
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import { teamPrimaryColor, floorTeamAccent } from "@/lib/foundation/team-colors";
import type { DisciplineFieldProps, RT } from "./types";

// Deterministischer 0…1-Hash (FNV-1a) — Treffer-Seite (rot/grün) + vertikale Streuung.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// „Runde" Tick-Schrittweite → ~6 Meilensteine über finalMax.
function niceStep(max: number): number {
  const raw = Math.max(1, max) / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const s = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  return Math.max(1, Math.round(s));
}

type Flash = { id: number; side: "r" | "g" };

export default function LampsField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    skinAccent,
    reducedMotion,
    W,
    H,
    layout,
    finalMax,
    rt,
    sorted,
    done,
    now,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    highlightIdxs,
    started,
    round,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);
  const startedRef = useRef<boolean>(!!started);
  startedRef.current = !!started;
  const roundRef = useRef<number>(round);
  roundRef.current = round;

  // Frische Prop-Spiegel für die rAF-Schleife (ohne Neustart).
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // Planche-Geometrie: die Metall-Platte füllt die Salle.
  const PX0 = 34;
  const PX1 = W - 26;
  const PY0 = 8;
  const PY1 = H - 12;
  // Treffer-Achse (x = gesammelte Treffer). X0/X1 aus dem Host-Layout, damit Meilensteine
  // und Host-Overlays (Pops/Hovercard) deckungsgleich bleiben; Normierung gegen finalMax.
  const X0: number = layout.xStart;
  const X1: number = layout.xEnd;
  const fracX = (v: number): number => X0 + (finalMax > 0 ? Math.max(0, v / finalMax) : 0) * (X1 - X0);

  // GROSSE, lesbare Token (unabhängig von der Teamzahl — kein Bahn-Zwang mehr). Deutlich
  // größer als die alten Fixbahn-Winzlinge (geo.r war 8/11).
  const RB = 20;
  const RBOwn = 25;
  const BAND_TOP = 58;
  const BAND_BOT = PY1 - 20;
  const CY = (BAND_TOP + BAND_BOT) / 2;

  // ---- Startaufstellung (Slots): vor dem ▶ stehen die Teams BREIT über die Planche
  // verteilt auf einem gleichmäßigen Raster (Startslots), jeder mit Platz. Reihenfolge
  // stabil nach seasonRank → lesbare Anfangsordnung. Beim Start gleiten sie ins Feld.
  const GRID_X0 = PX0 + 54;
  const GRID_X1 = PX1 - 40;
  const gridByCode = useMemo(() => {
    const order = [...rt].sort((a, b) => a.seasonRank - b.seasonRank);
    const n = order.length;
    const cols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(n * 2.4))));
    const rows = Math.max(1, Math.ceil(n / cols));
    const m = new Map<string, { x: number; y: number }>();
    order.forEach((t, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = cols > 1 ? GRID_X0 + (c / (cols - 1)) * (GRID_X1 - GRID_X0) : (GRID_X0 + GRID_X1) / 2;
      const y = rows > 1 ? BAND_TOP + (r / (rows - 1)) * (BAND_BOT - BAND_TOP) : CY;
      m.set(t.code, { x, y });
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.length]);

  // ---- Beeswarm-Auffächerung: x = Treffer (Runden-Ziel), y wird kollisionsfrei um die
  // Mittellinie gepackt → jeder Token behält Platz (hoverbar/erkennbar), Einzelläufer
  // sitzen mittig, enge Score-Cluster fächern nach oben/unten auf („in die Mitte
  // zurechtfinden"). Stabil je Runde (aus displayScore) → kein Y-Zittern beim Gleiten.
  const dispSig = rt.map((t) => `${t.code}:${t.displayScore}`).join("|");
  const packByCode = useMemo(() => {
    const items = rt.map((t) => ({ code: t.code, x: fracX(t.displayScore), r: t.isOwn ? RBOwn : RB }));
    items.sort((a, b) => a.x - b.x);
    const placed: { x: number; y: number; r: number }[] = [];
    const m = new Map<string, number>();
    for (const it of items) {
      const step = it.r * 1.1;
      let y = CY;
      for (let k = 0; k < 260; k += 1) {
        const cand = CY + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * step;
        if (cand < BAND_TOP || cand > BAND_BOT) continue;
        const hit = placed.some((p) => Math.abs(p.x - it.x) < p.r + it.r + 3 && Math.abs(p.y - cand) < p.r + it.r + 3);
        y = cand;
        if (!hit) break;
      }
      y = Math.max(BAND_TOP, Math.min(BAND_BOT, y));
      placed.push({ x: it.x, y, r: it.r });
      m.set(it.code, y);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispSig, finalMax]);
  const packY = (t: RT): number => packByCode.get(t.code) ?? CY;
  const gridOf = (t: RT): { x: number; y: number } => gridByCode.get(t.code) ?? { x: (GRID_X0 + GRID_X1) / 2, y: CY };
  // Frische Spiegel für die rAF-Schleife.
  const packRef = useRef(packByCode);
  packRef.current = packByCode;
  const gridRef = useRef(gridByCode);
  gridRef.current = gridByCode;

  // Treffer-Melder oben mittig.
  const CX = W / 2;
  const MELDER_Y = 26;
  const LAMP_R_X = CX - 66;
  const LAMP_W1_X = CX - 14;
  const LAMP_W2_X = CX + 14;
  const LAMP_G_X = CX + 66;

  const step = niceStep(finalMax);
  const ticks: number[] = [];
  for (let v = step; v <= finalMax + 0.5; v += step) ticks.push(v);

  // ---- Token-Refs für die imperative rAF-Positionierung -------------------------------
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const ghostRefs = useRef<Map<number, SVGGElement | null>>(new Map());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const on = startedRef.current;
      const pack = packRef.current;
      const grid = gridRef.current;
      const firstStage = roundRef.current === 0;
      for (const t of rtRef.current) {
        const el = gRefs.current.get(t.idx);
        const g = grid.get(t.code) ?? { x: (GRID_X0 + GRID_X1) / 2, y: CY };
        const py = pack.get(t.code) ?? CY;
        // Ziel im Feld (Beeswarm) für den aktuellen animScore.
        const fx = fracX(t.animScore);
        // Vor dem Start: Startaufstellung (Slots). In Etappe 1 gleiten sie vom Slot ins
        // Feld (blend nach Runden-Fortschritt) → „breit starten, in die Mitte zurechtfinden".
        let x: number;
        let y: number;
        if (!on) {
          x = g.x;
          y = g.y;
        } else if (firstStage) {
          const span = t.displayScore - t.roundStartScore;
          const p = span > 0.5 ? Math.max(0, Math.min(1, (t.animScore - t.roundStartScore) / span)) : 1;
          const e = p * p * (3 - 2 * p); // smoothstep
          x = g.x + (fx - g.x) * e;
          y = g.y + (py - g.y) * e;
        } else {
          x = fx;
          y = py;
        }
        if (el && !frozen) el.setAttribute("transform", `translate(${x} ${y})`);
        // Ghost der Vorrunde bei roundStartScore — die Lücke Ghost→Token = Zugewinn. Erst
        // ab Etappe 2 sinnvoll (in Etappe 1 kommen die Token frisch aus der Aufstellung).
        const gel = ghostRefs.current.get(t.idx);
        if (gel) {
          const span = t.displayScore - t.roundStartScore;
          const prog = span > 0.5 ? Math.max(0, Math.min(1, (t.animScore - t.roundStartScore) / span)) : 1;
          if (on && !firstStage && span > 0.5 && !reduce && prog < 0.98) {
            gel.setAttribute("transform", `translate(${fracX(t.roundStartScore)} ${py})`);
            gel.setAttribute("opacity", String((t.isOwn ? 0.55 : 0.26) * (1 - prog * 0.7)));
          } else {
            gel.setAttribute("opacity", "0");
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Touché-FX: score-Anstieg → Lunge + Melder-Lampe (rot/grün) --------------------
  const prevScore = useRef<Record<string, number>>({});
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [lunges, setLunges] = useState<Record<string, number>>({});
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scoreSig = rt.map((t) => `${t.code}:${t.score}`).join("|");
  useEffect(() => {
    if (reducedMotion) {
      const p: Record<string, number> = {};
      for (const t of rt) p[t.code] = t.score;
      prevScore.current = p;
      return;
    }
    const addFlashes: Flash[] = [];
    const addLunges: Record<string, number> = {};
    for (const t of rt) {
      const before = prevScore.current[t.code] ?? 0;
      if (t.score > before + 0.001) {
        const id = (seq.current += 1);
        const side: "r" | "g" = hash01(`${t.code}sd${Math.round(t.score)}`) < 0.5 ? "r" : "g";
        addFlashes.push({ id, side });
        addLunges[t.code] = id;
      }
      prevScore.current[t.code] = t.score;
    }
    if (addFlashes.length) {
      setFlashes((f) => [...f, ...addFlashes]);
      setLunges((l) => ({ ...l, ...addLunges }));
      const flashIds = new Set(addFlashes.map((f) => f.id));
      const tm = setTimeout(() => {
        setFlashes((f) => f.filter((x) => !flashIds.has(x.id)));
        setLunges((l) => {
          const c = { ...l };
          for (const code of Object.keys(addLunges)) if (c[code] === addLunges[code]) delete c[code];
          return c;
        });
      }, 1150);
      timers.current.push(tm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreSig, reducedMotion]);

  useEffect(() => {
    const list = timers.current;
    return () => {
      for (const tm of list) clearTimeout(tm);
    };
  }, []);

  const activeR = flashes.some((f) => f.side === "r");
  const activeG = flashes.some((f) => f.side === "g");
  const flashKey = flashes.map((f) => f.id).join(",");

  return (
    <>
      <style>{`
        .f-lunge{animation:fLunge .6s cubic-bezier(.3,0,.2,1);}
        @keyframes fLunge{0%{filter:none;}32%{filter:brightness(1.7) drop-shadow(0 0 8px rgba(246,199,80,.75));}100%{filter:none;}}
        .f-blade{transform-box:fill-box;transform-origin:left center;}
        .f-lunge .f-blade{animation:fBlade .6s cubic-bezier(.3,0,.2,1);}
        @keyframes fBlade{0%,100%{transform:scaleX(1);}32%{transform:scaleX(1.95);}}
        .f-flash{animation:fFlash .55s ease-out 2;animation-fill-mode:forwards;}
        @keyframes fFlash{0%,60%{opacity:1;}100%{opacity:0;}}
      `}</style>

      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? RBOwn : RB} />
            </clipPath>
          ) : null,
        )}
        <linearGradient id="lampSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b7c2cf" />
          <stop offset="0.5" stopColor="#9dabbc" />
          <stop offset="1" stopColor="#8896a8" />
        </linearGradient>
        <linearGradient id="lampBlade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e6edf5" />
          <stop offset="1" stopColor="#8ea0b4" />
        </linearGradient>
        <pattern id="lampGrain" width="160" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 4 H160" stroke="rgba(255,255,255,.16)" strokeWidth="1" />
          <path d="M0 10 H160" stroke="rgba(24,36,52,.12)" strokeWidth="1" />
        </pattern>
        <pattern id="lampMesh" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M0 0 L26 26 M26 0 L0 26" stroke="rgba(38,54,74,.10)" strokeWidth="1" />
        </pattern>
        <radialGradient id="lampHall" cx="0.5" cy="0.4" r="0.75">
          <stop offset="0" stopColor="#161d28" />
          <stop offset="0.84" stopColor="#0b0d12" />
        </radialGradient>
        <radialGradient id="lampGlowR">
          <stop offset="0" stopColor="rgba(255,69,69,.6)" />
          <stop offset="1" stopColor="rgba(255,69,69,0)" />
        </radialGradient>
        <radialGradient id="lampGlowG">
          <stop offset="0" stopColor="rgba(61,220,110,.6)" />
          <stop offset="1" stopColor="rgba(61,220,110,0)" />
        </radialGradient>
        <clipPath id="lampPlancheClip">
          <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx={12} />
        </clipPath>
      </defs>

      {/* Salle d'Armes: dunkle Halle */}
      <rect x={0} y={0} width={W} height={H} fill="url(#lampHall)" />

      {/* Pisten-Rahmen + gebürstete Metall-Planche */}
      <rect x={PX0 - 8} y={PY0 - 6} width={PX1 - PX0 + 16} height={PY1 - PY0 + 12} rx={16} fill="#1a212b" />
      <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx={12} fill="url(#lampSteel)" />
      <g clipPath="url(#lampPlancheClip)">
        <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} fill="url(#lampGrain)" />
        <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} fill="url(#lampMesh)" />
        <ellipse cx={CX} cy={H * 0.42} rx={W * 0.46} ry={H * 0.5} fill="rgba(255,255,255,.28)" />

        {/* Meilenstein-Ticks: x = GESAMMELTE Treffer (wachsende Zählleiste) */}
        <line x1={X0} y1={PY0 + 6} x2={X0} y2={PY1 - 6} stroke="#f2f6fa" strokeWidth={2.5} opacity={0.7} />
        <text x={X0} y={PY0 + 18} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={11} fontWeight={700} fill="#33445a" opacity={0.9}>
          0
        </text>
        {ticks.map((v) => {
          const x = fracX(v);
          return (
            <g key={`tick-${v}`}>
              <line x1={x} y1={PY0 + 6} x2={x} y2={PY1 - 6} stroke="#31465c" strokeWidth={1.6} strokeDasharray="3 8" opacity={0.5} />
              <text x={x} y={PY0 + 18} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={11} fontWeight={700} letterSpacing="1" fill="#33445a" opacity={0.9}>
                {v}
              </text>
            </g>
          );
        })}
        <text x={X0 + 14} y={PY1 - 14} textAnchor="start" fontFamily="ui-monospace, Menlo, monospace" fontSize={11} fontWeight={700} letterSpacing="2" fill="#33445a" opacity={0.85}>
          ⚡ GESAMMELTE TREFFER →
        </text>
        {/* ZIEL-Linie = höchster (End-)Wert (finalMax → X1). Feste Normierung: der Führende
            landet am Ende genau hier; die Skala steht still, alle bewegen sich nur vorwärts. */}
        <line x1={X1} y1={PY0 + 4} x2={X1} y2={PY1 - 4} stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.85} strokeDasharray="6 5" />
        <text x={X1 - 8} y={PY0 + 18} textAnchor="end" fontFamily="Georgia, serif" fontSize={13} fontWeight={800} letterSpacing="0.12em" fill="var(--nl-warn)" opacity={0.95}>
          ZIEL
        </text>
      </g>
      <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx={12} fill="none" stroke="#5c6b7d" strokeWidth={2} />

      {/* Feld-Wasserzeichen (Disziplin-Identität) */}
      {disciplineName ? (
        <text x={PX0 + 14} y={PY0 + 22} fontSize={17} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.55} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Treffer-Melder-Apparat über der Planche (verankert, kein Overlay) */}
      <g>
        <rect x={CX - 132} y={MELDER_Y - 22} width={264} height={40} rx={9} fill="#0e141c" stroke="#37404d" strokeWidth={1.4} />
        <text x={CX} y={MELDER_Y - 11} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={8.5} fontWeight={700} letterSpacing="2.5" fill="#657286">
          TREFFER-MELDER
        </text>
        <rect x={LAMP_R_X - 9} y={MELDER_Y - 3} width={18} height={18} rx={5} fill={activeR ? "#ff4545" : "#391114"} stroke="#3d4855" strokeWidth={1.5} />
        <circle cx={LAMP_W1_X} cy={MELDER_Y + 6} r={5.5} fill="#23282f" stroke="#3d4855" strokeWidth={1.2} />
        <circle cx={LAMP_W2_X} cy={MELDER_Y + 6} r={5.5} fill="#23282f" stroke="#3d4855" strokeWidth={1.2} />
        <rect x={LAMP_G_X - 9} y={MELDER_Y - 3} width={18} height={18} rx={5} fill={activeG ? "#3ddc6e" : "#0f2e1a"} stroke="#3d4855" strokeWidth={1.5} />
        {flashes.map((f) => {
          const lx = f.side === "r" ? LAMP_R_X : LAMP_G_X;
          const col = f.side === "r" ? "#ff4545" : "#3ddc6e";
          return (
            <g key={`flash-${f.id}`} className="f-flash">
              <ellipse cx={lx} cy={MELDER_Y + 6} rx={30} ry={30} fill={`url(#lampGlow${f.side === "r" ? "R" : "G"})`} />
              <rect x={lx - 9} y={MELDER_Y - 3} width={18} height={18} rx={5} fill={col} />
            </g>
          );
        })}
      </g>

      {/* Ghost-Marker (Vorrunde) — Position setzt die rAF-Schleife imperativ. */}
      {rt.map((t) => {
        const r = t.isOwn ? RBOwn : RB;
        return (
          <g
            key={`ghost-${t.code}`}
            ref={(el) => {
              ghostRefs.current.set(t.idx, el);
            }}
            opacity={0}
          >
            <circle r={r} fill="none" stroke={floorTeamAccent(teamPrimaryColor(t.code))} strokeWidth={1.4} strokeDasharray="3 3" />
          </g>
        );
      })}

      {/* Tokens — Fechter. x = animScore (geteilter Zeitstrahl, rAF), y = stabile Streuung.
          In Rang-Reihenfolge rückwärts, damit der Führende oben liegt (wie der Host). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? RBOwn : RB;
          const hue = hueForIdx(t.idx);
          const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
          const glowing = t.glowUntil > now;
          const rc = relColor(t.rel);
          const lunging = !reducedMotion && lunges[t.code] != null;
          const showBadge = t.isOwn || t.rank <= 3 || hoverIdx === t.idx;
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              className={lunging ? "f-lunge" : undefined}
              transform={`translate(${started ? fracX(t.animScore) : gridOf(t).x} ${started ? packY(t) : gridOf(t).y})`}
              style={{
                cursor: onOpenTeam && t.teamId ? "pointer" : "default",
                opacity: hoverIdx != null && hoverIdx !== t.idx ? 0.82 : 1,
              }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Klinge nach vorn (Richtung höherer Treffer) — streckt sich beim Ausfall */}
              <rect className="f-blade" x={r - 1} y={-1.1} width={12} height={2.2} rx={1} fill="url(#lampBlade)" />

              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Highlight-Trio (Aufholjagd): pulsierender Ring an den 3 größten Aufsteigern. */}
              {trioSet.has(t.idx) ? <circle r={r + 10} fill="none" stroke="var(--nl-warn)" strokeWidth={3.5} opacity={0.95} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 0.85s ease-in-out infinite" }} /> : null}
              {/* Eigen-Team-Anker: dauerhafter, weicher Akzent-Puls. */}
              {t.isOwn ? <circle r={r + 6} fill="none" stroke="var(--nl-accent)" strokeWidth={2} opacity={0.9} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} /> : null}
              {t.rank === 1 && done ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.6} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} /> : null}
              {/* Relations-Marker (Rivalen rot / Verbündete): eng am Icon. */}
              {rc ? <circle r={r + 3} fill="none" stroke={rc} strokeWidth={2.6} opacity={0.95} /> : null}
              {medal ? <circle r={r + 4.6} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
              )}
              {/* Team-Farb-Rahmen (getTeamColor) — jedes Team sichtbar; eigenes hervorgehoben. */}
              {t.isOwn ? (
                <>
                  <circle r={r + 1.6} fill="none" stroke="var(--nl-accent)" strokeWidth={3} />
                  <circle r={r + 0.2} fill="none" stroke="var(--nl-ink)" strokeWidth={1.4} opacity={0.9} />
                </>
              ) : (
                <circle r={r + 1.4} fill="none" stroke={floorTeamAccent(teamPrimaryColor(t.code))} strokeWidth={2.4} />
              )}
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
              {/* Rang-Badge (eigenes Team / Podest / gehovert) — Position ohne Blick zur Tabelle. */}
              {showBadge ? (
                <text y={r + 15} textAnchor="middle" fontSize={11.5} fontWeight={900} fill={t.isOwn ? "var(--nl-accent)" : t.rank === 1 ? "var(--nl-warn)" : "var(--nl-ink)"}>
                  {t.isOwn ? `★ ${t.code}` : `#${t.rank}`}
                </text>
              ) : null}
            </g>
          );
        })}

      {/* stabiler Key-Anker für die Flash-Gruppe (verhindert Rest-Animationen) */}
      <g data-flash-key={flashKey} />
    </>
  );
}
