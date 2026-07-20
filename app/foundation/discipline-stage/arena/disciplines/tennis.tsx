// =====================================================================================
// tennis — BESPOKE · 1:1 aus scratchpad/tennis.html rebuildet.
//
// Turnier-Anlage von oben: konzentrische Zonen (Außenplätze → Court 2 → Court 1 →
// Center Court unter Flutlicht). Alle 32 Teams rücken simultan von außen nach innen vor,
// Nähe zum Center Court = gewonnene Punkte. Der Filzball liegt beim Führenden; pro Reveal
// jagen die Top-Mover Winner in den Center Court: ⚡ ASS (Kreidestaub + Surge), Netzroller.
// Score = Wahrheit, monoton zum Endstand.
//
// Der Host bleibt WAHRHEIT: Score/Reveal/Ladder/Ticker/Kopf-Strip/Hover/Pops kommen vom
// Host (tokenPos → Hover/Pops bleiben konsistent). Diese Datei rendert NUR die Feld-
// Kinder des <svg> + die on-Feld-FX (Ball, Kreidestaub, Winner-Shots). Score=Wahrheit,
// Endstand, Medaillen-Ringe, Champion-Krone, Setzköpfe bleiben.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

const NS = "http://www.w3.org/2000/svg";

// Tennis-Farben (aus dem Mockup)
const GRASS_A = "#1d5238";
const GRASS_B = "#245c41";
const GRASS_C = "#2b6a4b";
const GRASS_D = "#347c58";
const COURT_FILL = "#3a7cba";
const COURT_STROKE = "#f2f6f2";
const LINES = "rgba(235,240,244,.85)";
const ZONE_DASH = "rgba(235,240,244,.15)";
const ZONE_LINE_GOLDEN = "rgba(246,199,80,.4)";
const CHALK = "rgba(240,246,241,.6)";
const GLOW = "rgba(201,230,74,.08)";
const NET_STROKE = "rgba(235,240,244,.8)";
const GRASS_PERIMETER = "#3c7a5c";
const FLOODLIGHT = "rgba(246,233,160,.16)";

type Cfg = {
  cx: number;
  cy: number;
  KX: number;
  KY: number;
  R0: number;
  R1: number;
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
    layout,
    finalMax,
    tokenPos: providedTokenPos,
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

  // Center court geometry from mockup
  const cx = W / 2;
  const cy = H / 2;
  const KX = 1.15; // ellipse X scale
  const KY = 0.62; // ellipse Y scale
  const R0 = (Math.min(W, H) / 2) * 0.52; // outer ring (start position)
  const R1 = (Math.min(W, H) / 2) * 0.19; // center court radius
  const CCW = 75 * 0.5; // half center court width
  const CCH = 46 * 0.5; // half center court height

  // Zone boundaries (from mockup ratios)
  const zB = R1 + (R0 - R1) * 0.36; // Court 1 boundary
  const zA = R1 + (R0 - R1) * 0.70; // Court 2 boundary

  // ---- tokenPos: Nähe zum Center Court = Punkte (Score → Radius, Rang → Winkel) ----
  // Außenring (R0) = schwach, Center Court (R1) = stark. Der Radius kommt aus dem SCORE
  // (kontinuierlich → echter animScore-Glide + sichtbarer Ghost-Zugewinn); der Winkel aus
  // dem Live-Rang, damit sich die 32 Setzköpfe gleichmäßig um den Court verteilen (kein
  // Center-Stack). Ellipsen-Skalierung KX/KY wie die gezeichneten Zonenringe.
  const tokenPos = (t: RT, scoreVal: number): { x: number; y: number } => {
    const rankIdx = sorted.findIndex((st) => st.idx === t.idx);
    const rankPos = rankIdx >= 0 ? rankIdx : t.idx;
    const norm = finalMax > 0 ? Math.max(0, Math.min(1, scoreVal / finalMax)) : 0;
    const radius = R0 - norm * (R0 - R1);
    const ang = (rankPos / Math.max(1, N)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(ang) * radius * KX, y: cy + Math.sin(ang) * radius * KY };
  };

  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync mit Rangliste,
  // Hover/Pause friert ein). Tennis überschreibt tokenPos lokal (Rang-Spread statt
  // reiner Score-Radius) — die lokale Variante speist die Glide-Schleife, damit
  // Ghost + Token derselben Choreografie folgen. Siehe benchmark.tsx.
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos });

  // ---- Prop mirrors for rAF loop ----
  const fxRef = useRef<SVGGElement | null>(null);
  const pballRef = useRef<SVGCircleElement | null>(null);
  const cfgRef = useRef<Cfg>({ cx, cy, KX, KY, R0, R1, reduced: reducedMotion, tokenPos });
  cfgRef.current = { cx, cy, KX, KY, R0, R1, reduced: reducedMotion, tokenPos };
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // ---- rAF: Ball possession at leader + flying shots per reveal ----
  useEffect(() => {
    const prevThrown = new Map<number, number>();
    const prevScore = new Map<number, number>();
    const balls: Ball[] = [];
    const pball = { x: cx, y: cy, init: false };
    let raf = 0;
    let last = performance.now();

    const mk = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
      document.createElementNS(NS, tag);

    const dropAfter = (el: SVGElement) =>
      el.addEventListener("animationend", () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

    // Ace: chalk dust poof + surge
    const ace = (x: number, y: number, gain: number) => {
      const fx = fxRef.current;
      if (!fx) return;

      // Poof cloud
      const poof = mk("circle");
      poof.setAttribute("cx", String(x));
      poof.setAttribute("cy", String(y));
      poof.setAttribute("r", "12");
      poof.setAttribute("fill", CHALK);
      poof.setAttribute("class", "tfx-poof");
      dropAfter(poof);
      fx.appendChild(poof);

      // Ace label
      const tx = mk("text");
      tx.setAttribute("x", String(x - 12));
      tx.setAttribute("y", String(y - 16));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-family", "ui-monospace, monospace");
      tx.setAttribute("font-weight", "900");
      tx.setAttribute("font-size", "13");
      tx.setAttribute("fill", "var(--nl-warn)");
      tx.setAttribute("class", "tfx-pop");
      tx.textContent = `⚡ ASS${gain > 0 ? " +" + Math.round(gain) : ""}`;
      dropAfter(tx);
      fx.appendChild(tx);
    };

    // Net roller: ball droops before court
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

    // Fire a shot from a team to center court
    const fireShot = (c: Cfg, t: RT, gain: number, isAce: boolean, isNet: boolean) => {
      const fx = fxRef.current;
      if (!fx) return;

      const from = c.tokenPos(t, t.score);
      const dist = Math.hypot(from.x - c.cx, from.y - c.cy);

      const el = mk("circle");
      el.setAttribute("r", "4.5");
      el.setAttribute("fill", "#f0ff7a");
      el.setAttribute("stroke", "#b8d426");
      el.setAttribute("stroke-width", "0.8");
      el.setAttribute("class", "tfx-ball");
      el.setAttribute("cx", String(from.x));
      el.setAttribute("cy", String(from.y));
      el.setAttribute("opacity", "1");
      fx.appendChild(el);

      const landing = isNet
        ? { x: c.cx + (c.R1 - 8) * Math.cos(Math.atan2(from.y - c.cy, from.x - c.cx)), y: c.cy + (c.R1 - 8) * Math.sin(Math.atan2(from.y - c.cy, from.x - c.cx)) }
        : { x: c.cx + (14 + dist * 0.2) * Math.cos(Math.atan2(from.y - c.cy, from.x - c.cx)), y: c.cy + (14 + dist * 0.2) * Math.sin(Math.atan2(from.y - c.cy, from.x - c.cx)) };

      balls.push({
        el,
        startX: from.x,
        startY: from.y,
        endX: landing.x,
        endY: landing.y,
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

      // Reveal detection: when a token reveals a new slot, fire ONE shot
      for (const t of list) {
        const hadT = prevThrown.has(t.idx);
        const pT = prevThrown.get(t.idx) ?? t.thrownSlot;
        const pS = prevScore.get(t.idx) ?? t.score;
        if (hadT && t.thrownSlot > pT && t.thrownSlot >= 0 && !c.reduced) {
          // Determine if this is an ace (random but consistent per team/round)
          const hashVal = (Math.sin(t.idx * 12.9898 + t.thrownSlot * 78.233) * 43758.5453) % 1;
          const isAce = hashVal < 0.3; // 30% chance
          const isNet = !isAce && hashVal < 0.55; // 25% chance (net roller)
          fireShot(c, t, t.score - pS, isAce, isNet);
        }
        prevThrown.set(t.idx, t.thrownSlot);
        prevScore.set(t.idx, t.score);
      }

      // Ball possession: gleich zum Führenden
      let leader: RT | null = null;
      for (const t of list) if (t.rank === 1 && t.thrownSlot >= 0) leader = t;
      const pb = pballRef.current;
      if (pb) {
        if (leader && !c.reduced) {
          const lp = c.tokenPos(leader, leader.score);
          const tx = lp.x + (c.cx - lp.x) * 0.18;
          const ty = lp.y + (c.cy - lp.y) * 0.18;
          if (!pball.init) {
            pball.x = tx;
            pball.y = ty;
            pball.init = true;
          } else {
            pball.x += (tx - pball.x) * 0.12;
            pball.y += (ty - pball.y) * 0.12;
          }
          pb.setAttribute("cx", String(pball.x));
          pb.setAttribute("cy", String(pball.y));
          pb.setAttribute("opacity", "1");
        } else {
          pb.setAttribute("opacity", "0");
          pball.init = false;
        }
      }

      // Shot arcs (linear for simplicity) + landing FX
      for (let j = balls.length - 1; j >= 0; j -= 1) {
        const b = balls[j]!;
        b.t += dt / b.dur;
        if (b.t >= 1) {
          balls.splice(j, 1);
          if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
          if (b.isNet) {
            netRoller(b.endX, b.endY);
          } else if (b.isAce) {
            ace(b.endX, b.endY, b.gain);
          }
          continue;
        }
        const u = b.t;
        const bx = (1 - u) * b.startX + u * b.endX;
        const by = (1 - u) * b.startY + u * b.endY;
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

  return (
    <>
      <defs>
        <style>{`
          .tfx-poof{filter:drop-shadow(0 0 4px rgba(240,246,241,.6));animation:tfxPoof .9s ease-out forwards;}
          .tfx-ball{filter:drop-shadow(0 0 8px rgba(201,230,74,.4));animation:tfxBall .52s cubic-bezier(.35,0,.85,.55) forwards;}
          .tfx-pop{transform-box:fill-box;transform-origin:center;animation:tfxPop 1.4s ease-out forwards;}
          @keyframes tfxPoof{0%{opacity:0;transform:scale(.4)}25%{opacity:.95}100%{opacity:0;transform:scale(2)}}
          @keyframes tfxBall{0%{opacity:1}100%{opacity:.6}}
          @keyframes tfxPop{0%{opacity:0;transform:translateY(0)}18%{opacity:1;transform:translateY(-16px)}100%{opacity:0;transform:translateY(-46px)}}
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
        <linearGradient id="tCourt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COURT_FILL} />
          <stop offset="1" stopColor="#2c619b" />
        </linearGradient>
        <radialGradient id="tFlood" cx="50%" cy="42%" r="120%">
          <stop offset="0%" stopColor={GLOW} />
          <stop offset="100%" stopColor="rgba(255,255,255,.05)" />
        </radialGradient>
      </defs>

      {/* Terrain (grass with elliptical zones) */}
      <rect x={16} y={24} width={W - 32} height={H - 48} rx={16} fill={GRASS_A} stroke={GRASS_PERIMETER} strokeWidth={2} />

      {/* Concentric zone ellipses (outer to inner) */}
      <ellipse cx={cx} cy={cy} rx={R0 * KX} ry={R0 * KY} fill={GRASS_A} strokeWidth={0} />
      <ellipse cx={cx} cy={cy} rx={zA * KX} ry={zA * KY} fill={GRASS_B} strokeWidth={0} />
      <ellipse cx={cx} cy={cy} rx={zB * KX} ry={zB * KY} fill={GRASS_C} strokeWidth={0} />
      <ellipse cx={cx} cy={cy} rx={R1 * KX} ry={R1 * KY} fill={GRASS_D} strokeWidth={0} />

      {/* Zone boundary strokes */}
      <ellipse cx={cx} cy={cy} rx={R0 * KX} ry={R0 * KY} fill="none" stroke={ZONE_DASH} strokeWidth={1.5} strokeDasharray="4 8" />
      <ellipse cx={cx} cy={cy} rx={zA * KX} ry={zA * KY} fill="none" stroke={ZONE_DASH} strokeWidth={1.5} strokeDasharray="4 8" />
      <ellipse cx={cx} cy={cy} rx={zB * KX} ry={zB * KY} fill="none" stroke={ZONE_DASH} strokeWidth={1.5} strokeDasharray="4 8" />
      <ellipse cx={cx} cy={cy} rx={R1 * KX} ry={R1 * KY} fill="none" stroke={ZONE_LINE_GOLDEN} strokeWidth={1.5} strokeDasharray="5 6" />

      {/* Zone labels */}
      <text x={cx - (R0 + zA) / 2 * KX} y={cy + 3} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={7.5} fontWeight={800} letterSpacing={1} fill="rgba(242,246,242,.42)">
        AUSSEN
      </text>
      <text x={cx - (zA + zB) / 2 * KX} y={cy + 3} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={7.5} fontWeight={800} letterSpacing={1} fill="rgba(242,246,242,.42)">
        COURT 2
      </text>
      <text x={cx - (zB + R1) / 2 * KX} y={cy + 3} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={7.5} fontWeight={800} letterSpacing={1} fill="rgba(242,246,242,.42)">
        COURT 1
      </text>

      {/* Floodlight glow over center court */}
      <ellipse cx={cx} cy={cy} rx={150} ry={96} fill={GLOW} />
      <ellipse cx={cx} cy={cy - 6} rx={108} ry={66} fill="rgba(255,255,255,.05)" />

      {/* Center Court (mini tennis court with net, service boxes, baseline) */}
      <rect x={cx - CCW} y={cy - CCH} width={CCW * 2} height={CCH * 2} fill="url(#tCourt)" stroke={COURT_STROKE} strokeWidth={2} />

      {/* Baseline (top and bottom) */}
      <line x1={cx - CCW} x2={cx + CCW} y1={cy - 33} y2={cy - 33} stroke={LINES} strokeWidth={1.2} opacity={0.85} />
      <line x1={cx - CCW} x2={cx + CCW} y1={cy + 33} y2={cy + 33} stroke={LINES} strokeWidth={1.2} opacity={0.85} />

      {/* Service lines (vertical dividers) */}
      <line x1={cx - 30} x2={cx - 30} y1={cy - 33} y2={cy + 33} stroke={LINES} strokeWidth={1.2} opacity={0.85} />
      <line x1={cx + 30} x2={cx + 30} y1={cy - 33} y2={cy + 33} stroke={LINES} strokeWidth={1.2} opacity={0.85} />

      {/* Net (center line and net post markers) */}
      <line x1={cx - 30} x2={cx + 30} y1={cy} y2={cy} stroke={LINES} strokeWidth={1.1} opacity={0.85} />
      <rect x={cx - 1.5} y={cy - CCH - 6} width={3} height={CCH * 2 + 12} fill="rgba(235,240,244,.8)" />

      {/* Net posts */}
      <circle cx={cx} cy={cy - CCH - 8} r={2.6} fill="#c6ced4" stroke="#5a6a60" strokeWidth={1} />
      <circle cx={cx} cy={cy + CCH + 8} r={2.6} fill="#c6ced4" stroke="#5a6a60" strokeWidth={1} />

      {/* Floodlight poles at court corners (glow orbs) */}
      {[[cx - 96, cy - 60], [cx + 96, cy - 60], [cx - 96, cy + 60], [cx + 96, cy + 60]].map((p, i) => (
        <g key={`pole-${i}`}>
          <circle cx={p[0]} cy={p[1]} r={8} fill={FLOODLIGHT} />
          <circle cx={p[0]} cy={p[1]} r={2.6} fill="#f6e9a0" stroke="#5a6a60" strokeWidth={1} />
        </g>
      ))}

      {/* Center court caption */}
      <text x={cx} y={cy + CCH + 26} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={9} fontWeight={800} letterSpacing={3} fill="rgba(246,199,80,.8)">
        CENTER COURT · FINALE
      </text>

      {/* Tournament title watermark */}
      <text x={cx} y={24 + 27} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight={800} fontSize={15} letterSpacing={5} fill="#d9ead9" opacity={0.35}>
        OLY OPEN · TURNIER-ANLAGE · NIGHT SESSION
      </text>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Wappen. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Team wappens positioned by score (elliptical via tokenPos).
          Reversed sort so leader is on top (z-index like host). Position via rAF. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;
          const isSeed = t.rank <= 8 ? t.rank : 0;

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
              {/* Führung — dauerhaft golden umrandet (Spieler am Center Court) */}
              {t.rank === 1 && t.thrownSlot >= 0 ? (
                <circle r={r + 11} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.5} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
              ) : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Tennis trägt seine eigene Champion-Krone. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {/* Champion crown */}
              {t.rank === 1 && t.thrownSlot >= 0 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
              {/* Seeding number (golden, Setzköpfe 1-8) */}
              {isSeed > 0 ? (
                <text y={-(r + 5)} textAnchor="middle" fontSize={7} fontWeight={900} fill="var(--nl-warn)" letterSpacing="0.08em">
                  {isSeed}
                </text>
              ) : null}
            </g>
          );
        })}

      {/* Ball possession marker (tennis ball, gleicht zum Führenden) */}
      <circle ref={pballRef} r={4.5} fill="#f0ff7a" stroke="#b8d426" strokeWidth={0.8} opacity={0} className="tfx-ball" cx={cx} cy={cy} />

      {/* Shot FX layer (balls, chalk dust, labels) — imperatively filled */}
      <g ref={fxRef} />
    </>
  );
}
