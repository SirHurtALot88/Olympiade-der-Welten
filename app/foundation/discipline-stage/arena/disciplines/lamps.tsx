// =====================================================================================
// lamps (Fechten · Salle d'Armes) — bespoke Feld, 1:1 aus scratchpad/fechten.html.
//
// Archetyp ① (Rennen), aber KEIN Wettlauf zu einer Linie: Fechten ist dauerhaftes
// Zustoßen über die ganze Disziplin. Eine große leitende Metall-Planche füllt die
// dunkle Salle. Die x-Position eines Tokens = GESAMMELTE Treffer (Touch-Tally) —
// Meilenstein-Ticks (60 · 120 · 180 …), keine Ziel-/Renn-Linie, die Zählleiste wächst
// einfach weiter. Jedes Team hat eine eigene Bahn (y = laneIdx). Landet ein Team einen
// Rundengewinn (score steigt), macht sein Fechter einen Ausfall (Lunge, Klinge streckt
// sich) und der Treffer-Melder über der Planche flammt rot bzw. grün auf (TOUCHÉ).
//
// Score bleibt Wahrheit: x = score/finalMax (identisch zu host.tokenPos für ROW_FAMILY →
// Score-Pops/Hovercard/Ladder bleiben konsistent). Endstand = Score-Reihenfolge, Runden-
// Medaillen-Ringe der Top-3, Führungs-Glow + Krone (done), Beziehungs-Rahmen, Own-Team-
// Stern: unverändert. Geteiltes Chrome (Topbar/Strip/Rangliste/Ticker/Overlays) kommt
// vom Host — hier wird NUR das Feld gerendert.
// =====================================================================================
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps } from "./types";

// Deterministischer 0…1-Hash (FNV-1a) — Treffer-Seite (rot/grün) reproduzierbar.
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
    tokenPos,
    rt,
    sorted,
    done,
    now,
    geo,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;

  // Planche-Geometrie: die Metall-Platte füllt die Salle, deckt alle Bahnen ab.
  const PX0 = 34;
  const PX1 = W - 26;
  const PY0 = 8;
  const PY1 = H - 12;
  // Treffer-Achse aus dem HOST-Layout (identisch zu tokenPos für ROW_FAMILY) — so
  // sitzen Meilensteine, Tokens und Host-Overlays exakt deckungsgleich.
  const X0: number = layout.xStart; // gesammelte Treffer = 0
  const X1: number = layout.xEnd; // = finalMax (Normierungsbasis)
  const axisX = (v: number): number => X0 + (finalMax > 0 ? v / finalMax : 0) * (X1 - X0);

  // Treffer-Melder oben mittig (mounted apparatus).
  const CX = W / 2;
  const MELDER_Y = 26;
  const LAMP_R_X = CX - 66;
  const LAMP_W1_X = CX - 14;
  const LAMP_W2_X = CX + 14;
  const LAMP_G_X = CX + 66;

  const step = niceStep(finalMax);
  const ticks: number[] = [];
  for (let v = step; v <= finalMax + 0.5; v += step) ticks.push(v);

  // ---- Touché-FX: score-Anstieg → Lunge + Melder-Lampe (rot/grün) --------------------
  const prevScore = useRef<Record<string, number>>({});
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [lunges, setLunges] = useState<Record<string, number>>({});
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scoreSig = rt.map((t) => `${t.code}:${t.score}`).join("|");
  useEffect(() => {
    // prev synchronisieren + Anstiege erkennen.
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

  // Timer-Aufräumen bei Unmount.
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
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
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

        {/* Meilenstein-Ticks: x = GESAMMELTE Treffer (keine Ziel-Linie, wachsende Zählleiste) */}
        <line x1={X0} y1={PY0 + 6} x2={X0} y2={PY1 - 6} stroke="#f2f6fa" strokeWidth={2.5} opacity={0.7} />
        <text x={X0} y={PY0 + 18} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={11} fontWeight={700} fill="#33445a" opacity={0.9}>
          0
        </text>
        {ticks.map((v) => {
          const x = axisX(v);
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
        {/* Basis-Lampen: groß rot · 2× weiß (Passé) · groß grün */}
        <rect x={LAMP_R_X - 9} y={MELDER_Y - 3} width={18} height={18} rx={5} fill={activeR ? "#ff4545" : "#391114"} stroke="#3d4855" strokeWidth={1.5} />
        <circle cx={LAMP_W1_X} cy={MELDER_Y + 6} r={5.5} fill="#23282f" stroke="#3d4855" strokeWidth={1.2} />
        <circle cx={LAMP_W2_X} cy={MELDER_Y + 6} r={5.5} fill="#23282f" stroke="#3d4855" strokeWidth={1.2} />
        <rect x={LAMP_G_X - 9} y={MELDER_Y - 3} width={18} height={18} rx={5} fill={activeG ? "#3ddc6e" : "#0f2e1a"} stroke="#3d4855" strokeWidth={1.5} />

        {/* Aufflammen (rot/grün) — Glow + heller Lampenkörper, spielt 2× und verschwindet */}
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

      {/* Tokens — Fechter je Bahn (y = laneIdx). x = gesammelte Treffer via host.tokenPos.
          In Rang-Reihenfolge rückwärts, damit der Führende oben liegt (wie der Host). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const pos = tokenPos(t, t.score);
          const r = t.isOwn ? geo.rOwn : geo.r;
          const hue = hueForIdx(t.idx);
          const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
          const glowing = t.glowUntil > now;
          const rc = relColor(t.rel);
          const lunging = !reducedMotion && lunges[t.code] != null;
          const dur = t.isOwn ? 1200 : 800;
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              className={lunging ? "f-lunge" : undefined}
              transform={`translate(${pos.x} ${pos.y})`}
              style={{
                transition: reducedMotion ? "none" : `transform ${dur}ms cubic-bezier(.4,0,.2,1)`,
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
              {t.rank === 1 && done ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.6} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} /> : null}
              {rc ? <circle r={r + 5.5} fill="none" stroke={rc} strokeWidth={2.4} opacity={0.95} /> : null}
              {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
              )}
              <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
              {t.isOwn ? (
                <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">
                  ★ {t.code}
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
