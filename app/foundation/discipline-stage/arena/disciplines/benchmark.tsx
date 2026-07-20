"use client";

// =====================================================================================
// benchmark.tsx — die EINE geteilte Verständnis-/Bewegungs-Schicht der Staffel (track),
// als wiederverwendbare Bausteine für ALLE Disziplin-Felder (track, lamps + 17 bespoke).
//
// Ziel (User-Goal): „Alle 20 Disziplinen haben die kompletten Features aus der Staffel
// übernommen — nur die Felddarstellung weicht ab." Diese Datei kapselt genau die Features,
// die IDENTISCH sein sollen, damit jede Feld-Datei sie 1:1 erbt statt sie zu kopieren:
//
//   • useTokenGlide(props) — rAF, das jedes Token imperativ an tokenPos(animScore) setzt
//     (Frame-Sync mit der Rangliste; Hover/Pause friert Feld UND Ghost ein). Gibt gRefs +
//     ghostRefs zurück.
//   • tokenRef(gRefs, t, tokenPos) — Ref-Callback fürs Token-<g> (registriert + setzt die
//     Startposition EINMAL, danach besitzt das rAF die Position).
//   • <GhostLayer …/> — Ghost der Vorrunde (VOR den Token gerendert; rAF setzt Position +
//     Opazität; die Lücke Ghost→Token = Etappen-Zugewinn).
//   • <TokenChrome …/> — die Verständnis-Ringe: Highlight-Trio (r+10), Eigen-Anker (r+6),
//     Relations-Ring (r+3), Medaillen-Ring (r+4.6), Logo, Team-Farb-Rahmen (alle Teams;
//     eigenes Team Akzent + Ink-Doppelring) und der Rang-Badge unter dem Token.
//
// Die Feld-Datei liefert weiter ihre BESPOKE Kunst (Bahn/Turm/Court/Eis …) und ihre
// disziplin-eigenen On-Feld-FX (Ball, Swish, Krone, Ampel …). Sie wickelt jedes Token in
//   <g data-token-code={t.code} ref={tokenRef(gRefs, t, tokenPos)} onMouse…>
//      {…eigene FX vor/nach…}
//      <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx}
//                   reducedMotion={reducedMotion} />
//   </g>
// und rendert <GhostLayer …/> vor der Token-Schleife. Kein CSS-transform/-transition mehr
// am Token — die Position gehört dem rAF.
// =====================================================================================

import React, { useEffect, useRef, type RefObject } from "react";
import { hueForIdx, relColor, SCENE_PRIMS } from "../DisciplineStageNativeArena";
import { teamPrimaryColor, floorTeamAccent } from "@/lib/foundation/team-colors";
import type { DisciplineFieldProps, RT, StagePrimitive, FieldGeo, Vec2 } from "./types";

export type GlideRefs = {
  gRefs: RefObject<Map<number, SVGGElement | null>>;
  ghostRefs: RefObject<Map<number, SVGGElement | null>>;
};

// ---- rAF-Bewegung (Benchmark, 1:1 aus track.tsx) ------------------------------------
// Positioniert Token + Ghost imperativ aus dem Host-`animScore` (geteilter Zeitstrahl).
// Hover/Pause friert BEIDES an Ort und Stelle ein (kein CSS-Nachlaufen).
export function useTokenGlide(props: DisciplineFieldProps): GlideRefs {
  const { rt, tokenPos, hoverIdx, paused, reducedMotion } = props;
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const ghostRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;
  const tpRef = useRef(tokenPos);
  tpRef.current = tokenPos;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const tp = tpRef.current;
      for (const t of rtRef.current) {
        const el = gRefs.current.get(t.idx);
        if (el && !frozen) {
          const p = tp(t, t.animScore);
          el.setAttribute("transform", `translate(${p.x} ${p.y})`);
        }
        const gel = ghostRefs.current.get(t.idx);
        if (gel) {
          const span = t.displayScore - t.roundStartScore;
          const prog = span > 0.5 ? Math.max(0, Math.min(1, (t.animScore - t.roundStartScore) / span)) : 1;
          if (span > 0.5 && !reduce && prog < 0.98) {
            const gp = tp(t, t.roundStartScore);
            const op = (t.isOwn ? 0.6 : 0.28) * (1 - prog * 0.7);
            gel.setAttribute("transform", `translate(${gp.x} ${gp.y})`);
            gel.setAttribute("opacity", String(op));
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

  return { gRefs, ghostRefs };
}

// Ref-Callback fürs Token-<g>: registriert das Element in gRefs und setzt die Startposition
// EINMAL (danach besitzt das rAF die Position; ein Reveal-Rerender überschreibt sie nicht).
export function tokenRef(
  gRefs: RefObject<Map<number, SVGGElement | null>>,
  t: RT,
  tokenPos: (t: RT, score: number) => Vec2,
): (el: SVGGElement | null) => void {
  return (el) => {
    gRefs.current?.set(t.idx, el);
    if (el && !el.getAttribute("transform")) {
      const ap = tokenPos(t, t.animScore);
      el.setAttribute("transform", `translate(${ap.x} ${ap.y})`);
    }
  };
}

// ---- Ghost-Schicht (Benchmark) ------------------------------------------------------
// VOR den Token rendern. Position + Opazität setzt useTokenGlide; die Lücke zum Token
// zeigt den Etappen-Zugewinn. `order` steuert nur die Render-Reihenfolge (egal, da idx-keyed).
export function GhostLayer(props: {
  sorted: RT[];
  geo: FieldGeo;
  ghostRefs: RefObject<Map<number, SVGGElement | null>>;
}): React.ReactNode {
  const { sorted, geo, ghostRefs } = props;
  return (
    <>
      {sorted.map((t) => {
        const gr = t.isOwn ? geo.rOwn : geo.r;
        const ghue = hueForIdx(t.idx);
        return (
          <g
            key={`ghost-${t.code}`}
            ref={(el) => {
              ghostRefs.current?.set(t.idx, el);
            }}
            opacity={0}
            style={{ pointerEvents: "none" }}
          >
            <circle r={gr} fill="none" stroke={t.isOwn ? "var(--nl-accent)" : `hsl(${ghue} 55% 60%)`} strokeWidth={t.isOwn ? 2 : 1.3} strokeDasharray="2 3" />
          </g>
        );
      })}
    </>
  );
}

// ---- Verständnis-Chrome (Benchmark) -------------------------------------------------
// Die Ringe/Logo/Rahmen/Badge, die in JEDER Disziplin identisch sind. Die Feld-Datei
// wickelt das in ihr Token-<g> (mit data-token-code + tokenRef) und ergänzt ihre eigenen
// FX (Glow, Krone, Swish …) als Geschwister. `trophy` (default true) zeichnet den Pokal
// auf Rang 1 — Felder mit eigener Krone (court/kda) setzen trophy={false}.
export function TokenChrome(props: {
  t: RT;
  prim: StagePrimitive;
  geo: FieldGeo;
  trioSet: Set<number>;
  hoverIdx: number | null;
  reducedMotion: boolean;
  trophy?: boolean;
  badge?: boolean;
  // Optionaler Radius-Override für Felder mit eigener Token-Größe (z.B. duelhp-Pit,
  // barbell-Heber). Ohne Angabe: geo.rOwn / geo.r.
  radius?: number;
}): React.ReactNode {
  const { t, prim, geo, trioSet, hoverIdx, reducedMotion, trophy = true, badge = true, radius } = props;
  const r = radius ?? (t.isOwn ? geo.rOwn : geo.r);
  const hue = hueForIdx(t.idx);
  const medal = t.roundMedal === 1 ? "var(--nl-gold)" : t.roundMedal === 2 ? "var(--nl-silver)" : t.roundMedal === 3 ? "var(--nl-bronze)" : null;
  const rc = relColor(t.rel);
  const showBadge = badge && (t.isOwn || t.rank <= 3 || hoverIdx === t.idx);
  return (
    <>
      {/* Highlight-Trio (Aufholjagd): grüner Aufhol-Puls an den 3 größten Aufsteigern (Zoom).
          Bewusst GRÜN (--nl-good) statt Gold — sonst kollidiert der Ring mit der Gold-Medaille
          und dem Glow (alles war --nl-warn → „Gold-Overload"). */}
      {trioSet.has(t.idx) ? <circle r={r + 10} fill="none" stroke="var(--nl-good)" strokeWidth={3.5} opacity={0.95} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 0.85s ease-in-out infinite" }} /> : null}
      {/* Eigen-Team-Anker: dauerhafter, weicher Akzent-Puls. */}
      {t.isOwn ? <circle r={r + 6} fill="none" stroke="var(--nl-accent)" strokeWidth={2} opacity={0.9} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} /> : null}
      {/* Relations-Ring (Rivalen rot / Verbündete) — eng am Rahmen. */}
      {rc ? <circle r={r + 3} fill="none" stroke={rc} strokeWidth={2.6} opacity={0.95} /> : null}
      {/* Medaillen-Ring (Runden-Podest). */}
      {medal ? <circle r={r + 4.6} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
      {/* Logo (oder Farb-Fallback). */}
      {t.logoUrl ? (
        <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
      )}
      {/* Team-Farb-Rahmen — JEDES Team; eigenes Team Akzent + Ink-Doppelring. */}
      {t.isOwn ? (
        <>
          <circle r={r + 1.6} fill="none" stroke="var(--nl-accent)" strokeWidth={3} />
          <circle r={r + 0.2} fill="none" stroke="var(--nl-ink)" strokeWidth={1.4} opacity={0.9} />
        </>
      ) : (
        <circle r={r + 1.4} fill="none" stroke={floorTeamAccent(teamPrimaryColor(t.code))} strokeWidth={2.4} opacity={1} />
      )}
      {/* Pokal auf Rang 1 (Felder mit eigener Krone setzen trophy={false}). */}
      {trophy && t.rank === 1 ? <text y={-(r + 9)} textAnchor="middle" fontSize={14}>🏆</text> : null}
      {/* Szene-Beziehungs-Label (nur SCENE_PRIMS, fremde Anker). */}
      {!t.isOwn && t.rel && SCENE_PRIMS.has(prim) ? (
        <text y={-(r + 7)} textAnchor="middle" fontSize={10} fontWeight={800} fill={rc ?? "var(--nl-mut)"}>
          {t.code}
        </text>
      ) : null}
      {/* Rang-Badge unter dem Token: macht die Position direkt lesbar. */}
      {showBadge ? (
        <g transform={`translate(0 ${r + 13})`}>
          <text textAnchor="middle" fontSize={11.5} fontWeight={900} fill={t.isOwn ? "var(--nl-accent)" : t.rank === 1 ? "var(--nl-gold)" : "var(--nl-ink)"}>
            {t.isOwn ? "★ " : ""}#{t.rank}
          </text>
        </g>
      ) : null}
    </>
  );
}
