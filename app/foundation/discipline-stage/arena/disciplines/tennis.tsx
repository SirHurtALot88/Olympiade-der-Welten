// =====================================================================================
// tennis — BESPOKE · REWORK (Grand-Slam-Bahn, waagerecht).
//
// Alte konzentrische Ring-Anlage war unübersichtlich. Neu: ein klarer Rasen-Court von
// oben, WAAGERECHT wie die Staffel lesbar. Links = Aufschlag-Linie (Start), rechts =
// Championship-Netz (Ziel). x-Position = kumulierte Punkte (score/finalMax) → die Teams
// rücken über die vollen Runden nach rechts zum Netz. y = feste Team-Bahn (laneIdx),
// damit man jedes Team über die Runden verfolgen kann (kein Rang-Springen). Setzköpfe
// (Top-8) nummeriert, Führer mit 🏆 + goldenem Puls, Ballwechsel zwischen den Führenden,
// ✦-Ass-Funke bei Punktgewinn.
//
// Host bleibt WAHRHEIT: Score/Reveal/Ladder/Ticker/Hover/Pops kommen vom Host; die lokale
// tokenPos (waagerecht) speist die Benchmark-Glide-Schleife (useTokenGlide) → Ghost +
// Token + Rangliste folgen derselben Choreografie. Diese Datei rendert nur die Feldkunst
// (Court) + die on-Feld-FX (Ball, Ass-Funke). Endstand/Medaillen/Champion unverändert.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

const NS = "http://www.w3.org/2000/svg";

// Tennis-Farben (aus dem Mockup)
const GRASS_A = "#1d5238";
const GRASS_B = "#164028";
const COURT_BG = "#0d1a12";
const GRASS_PERIMETER = "#3c7a5c";
const LINES = "rgba(235,240,244,.85)";
const NET_WHITE = "rgba(233,236,242,.9)";
const BALL_FILL = "#f0ff7a";
const BALL_STROKE = "#b8d426";
const POST_FILL = "#c6ced4";
const POST_STROKE = "#5a6a60";

type Cfg = {
  X0: number;
  X1: number;
  reduced: boolean;
  tokenPos: (t: RT, score: number) => { x: number; y: number };
};

type Ball = {
  el: SVGCircleElement;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  t: number;
  dur: number;
  isAce: boolean;
  isNet: boolean;
  gain: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export default function TennisField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    reducedMotion,
    W,
    H,
    N,
    geo,
    finalMax,
    rt,
    sorted,
    now,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    hoverIdx,
    highlightIdxs,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // ---- Court-Geometrie (waagerecht) ------------------------------------------------
  const courtX0 = 70;
  const courtX1 = W - 70;
  const courtY0 = 70;
  const courtY1 = H - 70;
  const X0 = courtX0 + 80; // Aufschlag-Linie (Start)
  const X1 = courtX1 - 80; // Championship-Netz (Ziel)
  const laneTop = courtY0 + 30;
  const laneBot = courtY1 - 30;

  // feste Team-Bahn (laneIdx) → y bleibt konstant, Team über die Runden verfolgbar.
  const laneY = (t: RT): number => (N > 1 ? laneTop + (t.laneIdx / (N - 1)) * (laneBot - laneTop) : (laneTop + laneBot) / 2);

  // ---- tokenPos: x = Punkte (score/finalMax, ABSOLUT über die Runden), y = Bahn ----
  const normOf = (s: number): number => (finalMax > 0 ? clamp(s / finalMax, 0, 1) : 0);
  const tokenPos = (t: RT, scoreVal: number): { x: number; y: number } => ({
    x: X0 + (0.015 + normOf(scoreVal) * 0.985) * (X1 - X0),
    y: laneY(t),
  });

  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync mit Rangliste,
  // Hover/Pause friert ein). Lokale waagerechte tokenPos speist die Glide-Schleife.
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos });

  // ---- Prop-Spiegel für die rAF-FX-Schleife ----
  const fxRef = useRef<SVGGElement | null>(null);
  const rallyRef = useRef<SVGCircleElement | null>(null);
  const cfgRef = useRef<Cfg>({ X0, X1, reduced: reducedMotion, tokenPos });
  cfgRef.current = { X0, X1, reduced: reducedMotion, tokenPos };
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;

  // ---- rAF: Ballwechsel zwischen den Führenden + Ass-Funke pro Reveal ----
  useEffect(() => {
    const prevThrown = new Map<number, number>();
    const prevScore = new Map<number, number>();
    const balls: Ball[] = [];
    let raf = 0;
    let last = performance.now();
    let rallyT = 0; // 0..1 Ping-Pong-Phase des Ballwechsels

    const mk = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
      document.createElementNS(NS, tag);

    const dropAfter = (el: SVGElement) =>
      el.addEventListener("animationend", () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

    // Ass: Funke + Punkt-Label am Netz.
    const ace = (x: number, y: number, gain: number) => {
      const fx = fxRef.current;
      if (!fx) return;
      const poof = mk("circle");
      poof.setAttribute("cx", String(x));
      poof.setAttribute("cy", String(y));
      poof.setAttribute("r", "10");
      poof.setAttribute("fill", "rgba(240,246,241,.6)");
      poof.setAttribute("class", "tfx-poof");
      dropAfter(poof);
      fx.appendChild(poof);

      const tx = mk("text");
      tx.setAttribute("x", String(x));
      tx.setAttribute("y", String(y - 16));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-family", "ui-monospace, monospace");
      tx.setAttribute("font-weight", "900");
      tx.setAttribute("font-size", "12");
      tx.setAttribute("fill", "var(--nl-warn)");
      tx.setAttribute("class", "tfx-pop");
      tx.textContent = `✦ ASS${gain > 0 ? " +" + Math.round(gain) : ""}`;
      dropAfter(tx);
      fx.appendChild(tx);
    };

    // Netzroller: Ball bleibt im Netz hängen.
    const netRoller = (x: number, y: number) => {
      const fx = fxRef.current;
      if (!fx) return;
      const tx = mk("text");
      tx.setAttribute("x", String(x));
      tx.setAttribute("y", String(y - 14));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-family", "ui-monospace, monospace");
      tx.setAttribute("font-weight", "800");
      tx.setAttribute("font-size", "11");
      tx.setAttribute("fill", "var(--nl-risk)");
      tx.setAttribute("class", "tfx-pop");
      tx.textContent = "😬 NETZ!";
      dropAfter(tx);
      fx.appendChild(tx);
    };

    // Aufschlag: Ball fliegt vom Token WAAGERECHT zum Netz (X1) auf gleicher Bahn.
    const fireShot = (c: Cfg, t: RT, gain: number, isAce: boolean, isNet: boolean) => {
      const fx = fxRef.current;
      if (!fx) return;
      const from = c.tokenPos(t, t.animScore);
      const netX = c.X1;
      const landX = isNet ? netX - 26 : netX;

      const el = mk("circle");
      el.setAttribute("r", "4.5");
      el.setAttribute("fill", BALL_FILL);
      el.setAttribute("stroke", BALL_STROKE);
      el.setAttribute("stroke-width", "0.8");
      el.setAttribute("class", "tfx-ball");
      el.setAttribute("cx", String(from.x));
      el.setAttribute("cy", String(from.y));
      el.setAttribute("opacity", "1");
      fx.appendChild(el);

      balls.push({
        el,
        startX: from.x,
        startY: from.y,
        endX: landX,
        endY: from.y,
        t: 0,
        dur: 520,
        isAce,
        isNet,
        gain,
      });
    };

    const tick = (ts: number) => {
      const c = cfgRef.current;
      const dt = Math.min(64, ts - last);
      last = ts;
      const list = rtRef.current;
      const frozen = hoverRef.current != null || pausedRef.current;

      // Reveal-Erkennung: neuer Slot → EIN Aufschlag.
      if (!frozen) for (const t of list) {
        const hadT = prevThrown.has(t.idx);
        const pT = prevThrown.get(t.idx) ?? t.thrownSlot;
        const pS = prevScore.get(t.idx) ?? t.score;
        if (hadT && t.thrownSlot > pT && t.thrownSlot >= 0 && !c.reduced) {
          const hashVal = Math.abs((Math.sin(t.idx * 12.9898 + t.thrownSlot * 78.233) * 43758.5453) % 1);
          const isAce = hashVal < 0.3; // 30%
          const isNet = !isAce && hashVal < 0.55; // 25%
          fireShot(c, t, t.score - pS, isAce, isNet);
        }
        prevThrown.set(t.idx, t.thrownSlot);
        prevScore.set(t.idx, t.score);
      }

      // Ballwechsel: Ping-Pong zwischen Führer (#1) und Verfolger (#2), beide rechts.
      let lead: RT | null = null;
      let second: RT | null = null;
      for (const t of list) {
        if (t.thrownSlot < 0) continue;
        if (t.rank === 1) lead = t;
        else if (t.rank === 2) second = t;
      }
      const rb = rallyRef.current;
      if (rb) {
        if (lead && second && !c.reduced && !frozen) {
          rallyT += dt / 1100;
          if (rallyT > 1) rallyT -= 1;
          const ph = 0.5 - 0.5 * Math.cos(rallyT * Math.PI * 2); // 0..1..0
          const a = c.tokenPos(lead, lead.animScore);
          const b = c.tokenPos(second, second.animScore);
          const bx = a.x + (b.x - a.x) * ph;
          const by = a.y + (b.y - a.y) * ph - Math.sin(ph * Math.PI) * 14; // Bogen
          rb.setAttribute("cx", String(bx));
          rb.setAttribute("cy", String(by));
          rb.setAttribute("opacity", "1");
        } else {
          rb.setAttribute("opacity", "0");
        }
      }

      // Flugbälle (waagerecht) + Landung-FX. Bei Pause/Hover einfrieren.
      for (let j = balls.length - 1; j >= 0; j -= 1) {
        const b = balls[j]!;
        if (!frozen) b.t += dt / b.dur;
        if (b.t >= 1) {
          balls.splice(j, 1);
          if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
          if (b.isNet) netRoller(b.endX, b.endY);
          else if (b.isAce) ace(b.endX, b.endY, b.gain);
          continue;
        }
        const u = b.t;
        const bx = (1 - u) * b.startX + u * b.endX;
        const by = (1 - u) * b.startY + u * b.endY - Math.sin(u * Math.PI) * 10; // Flugbogen
        b.el.setAttribute("cx", String(bx));
        b.el.setAttribute("cy", String(by));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const b of balls) if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mähstreifen (vertikale Bänder) für den Rasen-Look.
  const stripeW = (courtX1 - courtX0) / 8;

  return (
    <>
      <defs>
        <style>{`
          .tfx-poof{filter:drop-shadow(0 0 4px rgba(240,246,241,.6));animation:tfxPoof .9s ease-out forwards;}
          .tfx-ball{filter:drop-shadow(0 0 8px rgba(201,230,74,.4));animation:tfxBall .52s cubic-bezier(.35,0,.85,.55) forwards;}
          .tfx-pop{transform-box:fill-box;transform-origin:center;animation:tfxPop 1.4s ease-out forwards;}
          @keyframes tfxPoof{0%{opacity:0;transform:scale(.4)}25%{opacity:.95}100%{opacity:0;transform:scale(2)}}
          @keyframes tfxBall{0%{opacity:1}100%{opacity:.6}}
          @keyframes tfxPop{0%{opacity:0;transform:translateY(0)}18%{opacity:1;transform:translateY(-14px)}100%{opacity:0;transform:translateY(-40px)}}
        `}</style>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
        <linearGradient id="tGrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GRASS_A} />
          <stop offset="1" stopColor={GRASS_B} />
        </linearGradient>
        <radialGradient id="tFlood" cx="70%" cy="26%" r="80%">
          <stop offset="0" stopColor="rgba(201,230,74,.10)" />
          <stop offset="1" stopColor="rgba(201,230,74,0)" />
        </radialGradient>
      </defs>

      {/* Stage-Hintergrund */}
      <rect x={0} y={0} width={W} height={H} fill={COURT_BG} />

      {/* Rasen-Court */}
      <rect x={courtX0} y={courtY0} width={courtX1 - courtX0} height={courtY1 - courtY0} rx={6} fill="url(#tGrass)" stroke={GRASS_PERIMETER} strokeWidth={2} />
      {/* Mähstreifen */}
      <g fill="rgba(255,255,255,.03)">
        {[0, 2, 4, 6].map((i) => (
          <rect key={`stripe-${i}`} x={courtX0 + i * stripeW} y={courtY0} width={stripeW} height={courtY1 - courtY0} />
        ))}
      </g>
      {/* Flutlicht-Schimmer */}
      <rect x={courtX0} y={courtY0} width={courtX1 - courtX0} height={courtY1 - courtY0} fill="url(#tFlood)" />

      {/* Court-Linien (Doppel-Außenlinie + Aufschlag-Korridore oben/unten) */}
      <g stroke={LINES} strokeWidth={2} fill="none" opacity={0.85}>
        <rect x={courtX0 + 26} y={courtY0 + 22} width={courtX1 - courtX0 - 52} height={courtY1 - courtY0 - 44} />
        <line x1={courtX0 + 26} y1={laneTop + (laneBot - laneTop) * 0.2} x2={courtX1 - 26} y2={laneTop + (laneBot - laneTop) * 0.2} />
        <line x1={courtX0 + 26} y1={laneTop + (laneBot - laneTop) * 0.8} x2={courtX1 - 26} y2={laneTop + (laneBot - laneTop) * 0.8} />
      </g>

      {/* Aufschlag-Linie (links, Start) */}
      <line x1={X0} y1={courtY0 + 10} x2={X0} y2={courtY1 - 10} stroke="rgba(138,160,176,.9)" strokeWidth={2} strokeDasharray="4 6" />
      <text x={X0} y={courtY1 + 18} textAnchor="middle" fontSize={10} fontWeight={800} letterSpacing={1} fill="rgba(122,154,134,.95)" fontFamily="Georgia, serif">
        AUFSCHLAG · START
      </text>

      {/* Championship-Netz (rechts, Ziel) */}
      <rect x={X1} y={courtY0 + 6} width={4} height={courtY1 - courtY0 - 12} fill={NET_WHITE} />
      <circle cx={X1 + 2} cy={courtY0 + 4} r={5} fill={POST_FILL} stroke={POST_STROKE} strokeWidth={1} />
      <circle cx={X1 + 2} cy={courtY1 - 4} r={5} fill={POST_FILL} stroke={POST_STROKE} strokeWidth={1} />
      <text x={X1 + 26} y={(courtY0 + courtY1) / 2} textAnchor="middle" fontSize={12} fontWeight={900} letterSpacing={3} fill="rgba(246,199,80,.9)" transform={`rotate(-90 ${X1 + 26} ${(courtY0 + courtY1) / 2})`}>
        CHAMPIONSHIP ▸
      </text>
      {/* Schiedsrichter-Stuhl */}
      <g transform={`translate(${courtX1 - 22} ${(courtY0 + courtY1) / 2 - 16})`}>
        <rect x={-7} y={0} width={14} height={30} rx={2} fill="#3a4a3e" />
        <rect x={-10} y={-9} width={20} height={11} rx={2} fill="#54636a" />
      </g>

      {/* Turnier-Titel */}
      <text x={(courtX0 + courtX1) / 2} y={courtY0 - 8} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight={800} fontSize={13} letterSpacing={4} fill="#d9ead9" opacity={0.4}>
        OLY OPEN · CENTER COURT · NIGHT SESSION
      </text>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Wappen. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Team-Wappen: x = Punkte (rAF/animScore), y = feste Bahn. Rückwärts, damit der
          Führende oben liegt (wie der Host). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;
          const isSeed = t.rank <= 8 ? t.rank : 0;
          const seedMark = "①②③④⑤⑥⑦⑧"[isSeed - 1] ?? "";

          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={tokenRef(gRefs, t, tokenPos)}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Führung — dauerhaft golden umrandet (am Netz). */}
              {t.rank === 1 && t.thrownSlot >= 0 ? (
                <circle r={r + 7} fill="none" stroke="var(--nl-warn)" strokeWidth={2.4} opacity={0.6} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
              ) : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Tennis trägt seine eigene Champion-Krone. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {/* Champion-Krone */}
              {t.rank === 1 && t.thrownSlot >= 0 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
              {/* Setzkopf-Nummer (Top-8, golden) */}
              {isSeed > 0 && t.rank !== 1 ? (
                <text y={-(r + 5)} textAnchor="middle" fontSize={9} fontWeight={900} fill="var(--nl-warn)">
                  {seedMark}
                </text>
              ) : null}
            </g>
          );
        })}

      {/* Ballwechsel-Ball (zwischen Führer und Verfolger) */}
      <circle ref={rallyRef} r={4.5} fill={BALL_FILL} stroke={BALL_STROKE} strokeWidth={0.8} opacity={0} className="tfx-ball" cx={X1} cy={(courtY0 + courtY1) / 2} />

      {/* Shot-FX-Schicht (Aufschläge, Ass-Funken) — imperativ befüllt */}
      <g ref={fxRef} />
    </>
  );
}
