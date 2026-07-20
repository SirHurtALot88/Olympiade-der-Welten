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
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

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
  // GROSSE, lesbare Token (unabhängig von der Teamzahl — kein Bahn-Zwang mehr). Deutlich
  // größer als die alten Fixbahn-Winzlinge (geo.r war 8/11).
  const RB = 20;
  const RBOwn = 25;
  const BAND_TOP = 56;
  const BAND_BOT = PY1 - 18;
  const CY = (BAND_TOP + BAND_BOT) / 2;
  const CXc = W / 2; // Konvergenz-Zentrum (die „Mitte" der Salle)

  // ---- Startaufstellung (Slots): die Teams stehen breit über die ganze Planche verteilt
  // auf einem Raster — DA, wo sie „gestartet" sind. Reihenfolge stabil nach seasonRank →
  // lesbare Anfangsordnung, jeder mit Platz. Beim Fortbewegen (Punkte) orientieren sie
  // sich Richtung Mitte (siehe rAF), Kollisionen werden per Relaxation kleingehalten.
  const GRID_X0 = PX0 + 70;
  const GRID_X1 = PX1 - 60;
  const GRID_TOP = BAND_TOP + 6;
  const GRID_BOT = BAND_BOT - 6;
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
      const y = rows > 1 ? GRID_TOP + (r / (rows - 1)) * (GRID_BOT - GRID_TOP) : CY;
      m.set(t.code, { x, y });
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.length]);
  const gridOf = (t: RT): { x: number; y: number } => gridByCode.get(t.code) ?? { x: (GRID_X0 + GRID_X1) / 2, y: CY };
  // Frische Spiegel für die rAF-Schleife.
  const gridRef = useRef(gridByCode);
  gridRef.current = gridByCode;
  const finalMaxRef = useRef(finalMax);
  finalMaxRef.current = finalMax;

  // Ziel-Position eines Teams: vom Startslot Richtung Mitte, Anteil = Fortschritt
  // (score/finalMax). Bei 0 Punkten steht es auf dem Slot (breit verteilt, sichtbar);
  // der Führende zieht am weitesten zur Mitte. So bleibt die Streuung früh erhalten und
  // die Ordnung entsteht erst mit den Punkten. (Ohne Kollisions-Relaxation — die macht die rAF.)
  const idealOf = (t: RT, score: number): { x: number; y: number } => {
    const g = gridOf(t);
    const fm = finalMax > 0 ? finalMax : 1;
    const pull = Math.max(0, Math.min(1, score / fm)) * 0.9;
    return { x: g.x + (CXc - g.x) * pull, y: g.y + (CY - g.y) * pull };
  };

  // Treffer-Melder oben mittig.
  const CX = W / 2;
  const MELDER_Y = 26;
  const LAMP_R_X = CX - 66;
  const LAMP_W1_X = CX - 14;
  const LAMP_W2_X = CX + 14;
  const LAMP_G_X = CX + 66;

  // ---- Token-Refs für die imperative rAF-Positionierung -------------------------------
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      // Hover/Pause: Positionen komplett EINFRIEREN (nicht neu rechnen) → kein „Splitten"
      // der Teams beim Drüberfahren.
      const frozen = hoverRef.current != null || pausedRef.current;
      if (!frozen) {
        const grid = gridRef.current;
        const fm = finalMaxRef.current > 0 ? finalMaxRef.current : 1;
        // 1) Ideal-Ziel je Token: vom Startslot Richtung Mitte, Anteil = Fortschritt.
        const P: { t: RT; r: number; x: number; y: number }[] = [];
        for (const t of rtRef.current) {
          const g = grid.get(t.code) ?? { x: (GRID_X0 + GRID_X1) / 2, y: CY };
          const pull = Math.max(0, Math.min(1, t.animScore / fm)) * 0.9;
          P.push({ t, r: t.isOwn ? RBOwn : RB, x: g.x + (CXc - g.x) * pull, y: g.y + (CY - g.y) * pull });
        }
        // 2) Kollisions-Relaxation: Überlappungen paarweise auseinanderdrücken (deterministisch
        //    aus den Ideal-Positionen → glatt Frame-zu-Frame, kein Zittern). Wenige Iterationen.
        for (let iter = 0; iter < 7; iter += 1) {
          for (let i = 0; i < P.length; i += 1) {
            for (let j = i + 1; j < P.length; j += 1) {
              const a = P[i]!;
              const b = P[j]!;
              let dx = b.x - a.x;
              let dy = b.y - a.y;
              let d = Math.hypot(dx, dy);
              const min = a.r + b.r + 5;
              if (d === 0) {
                a.x -= 1.5;
                b.x += 1.5;
              } else if (d < min) {
                const push = (min - d) / 2;
                dx /= d;
                dy /= d;
                a.x -= dx * push;
                a.y -= dy * push;
                b.x += dx * push;
                b.y += dy * push;
              }
            }
          }
        }
        // 3) In die Planche klemmen + anwenden.
        for (const p of P) {
          const x = Math.max(PX0 + p.r + 2, Math.min(PX1 - p.r - 2, p.x));
          const y = Math.max(BAND_TOP, Math.min(BAND_BOT, p.y));
          const el = gRefs.current.get(p.t.idx);
          if (el) el.setAttribute("transform", `translate(${x} ${y})`);
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

        {/* Mitte = Ziel der Annäherung: konzentrische Ringe (Engagement-Zone). Wer am besten
            trifft, orientiert sich am weitesten zur Mitte; die Distanz zur Mitte = Rang. */}
        <g opacity={0.5}>
          <circle cx={CXc} cy={CY} r={150} fill="none" stroke="#31465c" strokeWidth={1.4} strokeDasharray="2 9" />
          <circle cx={CXc} cy={CY} r={92} fill="none" stroke="#31465c" strokeWidth={1.4} strokeDasharray="2 9" />
          <circle cx={CXc} cy={CY} r={40} fill="none" stroke="var(--nl-warn)" strokeWidth={1.6} strokeDasharray="3 6" opacity={0.7} />
          <line x1={CXc} y1={PY0 + 8} x2={CXc} y2={PY1 - 8} stroke="#31465c" strokeWidth={1.2} strokeDasharray="2 10" opacity={0.6} />
        </g>
        <text x={CXc} y={PY1 - 12} textAnchor="middle" fontFamily="Georgia, serif" fontSize={12} fontWeight={800} letterSpacing="0.14em" fill="var(--nl-warn)" opacity={0.9}>
          ◇ MITTE — TREFFER ZIEHEN NACH INNEN
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

      {/* Tokens — Fechter. Position: Startslot → Mitte (Anteil = Punkte), Kollisions-
          Relaxation in der rAF. In Rang-Reihenfolge rückwärts (Führender oben). */}
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
              className={lunging ? "f-lunge" : undefined}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
                // Initial-Position NUR einmal setzen (wenn noch kein transform da ist) →
                // kein 1-Frame-Sprung von (0,0). Danach ist die rAF alleiniger Positionsgeber;
                // würde React bei jedem force()-Render neu setzen, kämpfte es gegen die
                // relaxierte rAF-Position → das war der „2 Positionen"-Effekt.
                if (el && !el.getAttribute("transform")) {
                  const p = idealOf(t, t.animScore);
                  el.setAttribute("transform", `translate(${p.x} ${p.y})`);
                }
              }}
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
