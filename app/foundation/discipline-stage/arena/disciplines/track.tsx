// =====================================================================================
// track (Staffel) — PILOT · 1:1 aus scratchpad/staffel-oval.html rebuildet.
//
// Bewegung: pro Runde EIN durchgehendes, weiches rAF-Gleiten ENTLANG des Ovals
// (Arc-Length, folgt der Kurve statt CSS-Sehne quer übers Innenfeld). Dynamisches,
// per-Token-variierendes Easing (pow(t, gamma)) → nicht konstante Geschwindigkeit,
// etwas Renn-Spannung. Hover friert die Bewegung ein (wie im Mockup). reduced-motion
// setzt sofort auf die Zielposition.
//
// Score bleibt Wahrheit: Zielposition = displayScore/finalMax auf dem Oval (identisch
// zu host.tokenPos für track → Pops/Hovercard/Ladder bleiben konsistent). Medaillen-
// Ringe, Beziehungs-Rahmen, Führungs-Glow, Krone, Ampel, Endstand: unverändert.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import { teamPrimaryColor, floorTeamAccent } from "@/lib/foundation/team-colors";
import type { DisciplineFieldProps, RT } from "./types";

export default function TrackField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    geo,
    finalMax,
    makeOval,
    ovalPath,
    OVAL_M,
    OVAL_BAND,
    pathRef,
    rt,
    sorted,
    now,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    handoffActive,
    highlightIdxs,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // DOM-<g>-Refs (imperative Bewegung — Position folgt dem Host-animScore).
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  // „Was geht ab?"-Schicht: Ghost-Marker (wo das Team letzte Runde stand) — wird
  // imperativ an fromLen (Glide-Start) positioniert; der Abstand zum Token = Zugewinn.
  const ghostRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  // Frische Prop-Spiegel für die rAF-Schleife (ohne Neustart).
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // Zielposition (Arc-Length) für einen kumulierten Score — identisch zu host.tokenPos.
  const fracLen = (score: number, PER: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    return (0.015 + norm * 0.985) * PER;
  };

  // Punkt + Quer-Versatz auf dem Oval (gleiche Lane-Auffächerung wie der Host).
  const placeAt = (t: RT, len: number, PER: number): { x: number; y: number } => {
    const path = pathRef.current;
    if (!path || PER === 0) return { x: W / 2, y: 70 };
    const L = Math.max(0, Math.min(PER, len));
    const pt = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(PER, L + 2));
    let tx = p2.x - pt.x;
    let ty = p2.y - pt.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const lane = (t.laneIdx % 6) - 2.5;
    const off = lane * 8.5;
    return { x: pt.x + -ty * off, y: pt.y + tx * off };
  };

  // rAF-Schleife: positioniert die Token imperativ an fracLen(animScore) — animScore
  // rampt der HOST über den geteilten 5s-Zeitstrahl (roundStartScore→displayScore). So
  // laufen FELD und RANGLISTE exakt synchron (beide lesen animScore). Hover/Pause friert
  // ein (Position wird dann nicht aktualisiert). reduced-motion: Host setzt animScore
  // sofort auf displayScore → Token sitzt direkt am Ziel.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const path = pathRef.current;
      const PER = path ? path.getTotalLength() : 0;
      if (PER > 0) {
        const frozen = hoverRef.current != null || pausedRef.current;
        const reduce = reducedRef.current;
        for (const t of rtRef.current) {
          const el = gRefs.current.get(t.idx);
          if (el && !frozen) {
            const p = placeAt(t, fracLen(t.animScore, PER), PER);
            el.setAttribute("transform", `translate(${p.x} ${p.y})`);
          }
          // Ghost der Vorrunde: sitzt bei roundStartScore. Sichtbar solange das Token noch
          // ramp­t (animScore < displayScore); die Lücke Ghost→Token zeigt den Zugewinn.
          const gel = ghostRefs.current.get(t.idx);
          if (gel) {
            const span = t.displayScore - t.roundStartScore;
            const prog = span > 0.5 ? Math.max(0, Math.min(1, (t.animScore - t.roundStartScore) / span)) : 1;
            if (span > 0.5 && !reduce && prog < 0.98) {
              const gp = placeAt(t, fracLen(t.roundStartScore, PER), PER);
              const op = (t.isOwn ? 0.6 : 0.28) * (1 - prog * 0.7);
              gel.setAttribute("transform", `translate(${gp.x} ${gp.y})`);
              gel.setAttribute("opacity", String(op));
            } else {
              gel.setAttribute("opacity", "0");
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rendern (nur bei force()/Reveal): Feldkunst + Token-Marker. Position der Token
  // setzt die rAF-Schleife imperativ; die JSX-Marker (Ringe/Medaillen/Krone) ziehen
  // per Reveal nach.
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

      {env ? (
        <>
          <rect x={0} y={0} width={W} height={H} fill="url(#envSky)" />
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
            const rows = Math.max(2, Math.round(OVAL_BAND / 8));
            const sq = OVAL_BAND / rows;
            const dark = "rgba(0,0,0,0.6)";
            return (
              <g>
                {Array.from({ length: rows }).map((_, i) => (
                  <g key={i}>
                    <rect x={sx - sq} y={yTop + i * sq} width={sq} height={sq} fill={i % 2 === 0 ? env.line : dark} />
                    <rect x={sx} y={yTop + i * sq} width={sq} height={sq} fill={i % 2 === 0 ? dark : env.line} />
                  </g>
                ))}
                <rect x={sx - sq} y={yTop} width={sq * 2} height={OVAL_BAND} fill="none" stroke={env.line} strokeWidth={0.8} opacity={0.5} />
                <text x={sx} y={yTop - 7} textAnchor="middle" fontFamily="Georgia, serif" fontSize={15} fontWeight={800} letterSpacing="0.12em" fill={env.line} opacity={0.92}>
                  ZIEL
                </text>
              </g>
            );
          })()}
        </>
      ) : (
        <>
          <path d={ovalPath} fill="none" stroke="var(--nl-panel)" strokeWidth={54} />
          <path d={ovalPath} fill="none" stroke={skinAccent} opacity={0.7} strokeWidth={2} strokeDasharray="6 8" />
        </>
      )}

      {/* Mess-Pfad (unsichtbar) — Host.tokenPos + diese rAF-Schleife lesen ihn. */}
      <path ref={pathRef} d={ovalPath} fill="none" stroke="none" />

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={env ? env.line : skinAccent} opacity={env ? 0.75 : 0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost-Schicht (VOR den Token): wo jedes Team letzte Runde stand. Position +
          Opazität setzt die rAF-Schleife; die Lücke zum Token zeigt den Zugewinn. */}
      {sorted.map((t) => {
        const r = t.isOwn ? geo.rOwn : geo.r;
        const hue = hueForIdx(t.idx);
        return (
          <g
            key={`ghost-${t.code}`}
            ref={(el) => {
              ghostRefs.current.set(t.idx, el);
            }}
            opacity={0}
            style={{ pointerEvents: "none" }}
          >
            <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-accent)" : `hsl(${hue} 55% 60%)`} strokeWidth={t.isOwn ? 2 : 1.3} strokeDasharray="2 3" />
          </g>
        );
      })}

      {/* Token — Position imperativ via rAF (transform), Marker per Reveal. In Rang-
          Reihenfolge rückwärts, damit der Führende oben liegt (wie der Host). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          // Nur der Rang am Token (klar & aufgeräumt); die Rang-Änderung (▲/▼) steht in der
          // Rangliste rechts, nicht zusätzlich im Feld (sonst Unübersicht).
          const showBadge = t.isOwn || t.rank <= 3 || hoverIdx === t.idx;
          const r = t.isOwn ? geo.rOwn : geo.r;
          const hue = hueForIdx(t.idx);
          const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
          const glowing = t.glowUntil > now;
          const rc = relColor(t.rel);
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Highlight-Trio (Aufholjagd): kräftiger, pulsierender goldener Ring an den 3
                  größten Aufsteigern der Etappe — während der Zeitlupe/des Zooms leuchtet er,
                  damit man diese Token im Feld sofort findet und ihre Jagd verfolgt. */}
              {trioSet.has(t.idx) ? <circle r={r + 10} fill="none" stroke="var(--nl-warn)" strokeWidth={3.5} opacity={0.95} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 0.85s ease-in-out infinite" }} /> : null}
              {/* Eigen-Team-Anker: dauerhafter, weicher Akzent-Puls — man findet sich immer. */}
              {t.isOwn ? (
                <circle r={r + 6} fill="none" stroke="var(--nl-accent)" strokeWidth={2} opacity={0.9} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
              ) : null}
              {/* Staffelstab-Übergabe (FEATURE 1): kurzer Funke (Strich + →) auf der Vorderkante
                  des Tokens, der beim Etappen-Glide nach vorn gereicht wird. Eigenes Team heller
                  (Akzent), andere gedämpft. Token-lokal, kollidiert nicht mit dem späteren,
                  gestaffelten Spotlight/Flash. Reduced-Motion: der Host liefert handoffActive=false. */}
              {!reducedMotion && handoffActive ? (
                <g transform={`translate(${r + 3} 0)`} style={{ animation: "olyHandoff 600ms ease-out" }} opacity={t.isOwn ? 1 : 0.7}>
                  <line x1={0} y1={0} x2={9} y2={0} stroke={t.isOwn ? "var(--nl-accent)" : "var(--nl-warn)"} strokeWidth={2.6} strokeLinecap="round" />
                  <text x={13} y={0} dominantBaseline="central" fontSize={11} fontWeight={900} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-warn)"}>→</text>
                </g>
              ) : null}
              {/* Relations-Marker (Rivalen rot / Verbündete): eng am Icon (hugt den Team-
                  Rahmen), nicht mehr als abstehender Halo — sitzt direkt außen am Rahmen. */}
              {rc ? <circle r={r + 3} fill="none" stroke={rc} strokeWidth={2.6} opacity={0.95} /> : null}
              {medal ? <circle r={r + 4.6} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
              )}
              {/* Team-Farb-Rahmen (getTeamColor) — JEDES Team hat sichtbar seinen Rahmen,
                  knapp außen ums Icon. Eigenes Team zusätzlich hervorgehoben: kräftiger
                  Akzent-Rahmen + Doppelring (plus der weiche Akzent-Puls oben). */}
              {t.isOwn ? (
                <>
                  <circle r={r + 1.6} fill="none" stroke="var(--nl-accent)" strokeWidth={3} />
                  <circle r={r + 0.2} fill="none" stroke="var(--nl-ink)" strokeWidth={1.4} opacity={0.9} />
                </>
              ) : (
                <circle r={r + 1.4} fill="none" stroke={floorTeamAccent(teamPrimaryColor(t.code))} strokeWidth={2.4} opacity={1} />
              )}
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
              {/* Rang-Badge + Δ-Pfeil zur Vorrunde (eigenes Team, Podest, oder gehovert).
                  Macht die Position direkt am Token lesbar — ohne Blick zur Seitentabelle. */}
              {showBadge ? (
                <g transform={`translate(0 ${r + 13})`}>
                  <text textAnchor="middle" fontSize={11.5} fontWeight={900} fill={t.isOwn ? "var(--nl-accent)" : t.rank === 1 ? "var(--nl-warn)" : "var(--nl-ink)"}>
                    {t.isOwn ? "★ " : ""}#{t.rank}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
    </>
  );
}
