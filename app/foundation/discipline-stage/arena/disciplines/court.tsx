// =====================================================================================
// court (Basketball) — BESPOKE · 1:1 aus scratchpad/basketball.html rebuildet.
//
// Halbfeld-Wurfkarte von oben: warm angestrahltes Hartholz-Parkett in dunkler Arena,
// Korb mit Brett + Reuse oben-mittig, Zonen-Schlüssel, Freiwurfkreis, Dreierbogen und
// dezente Wurfkarten-Distanzringe um den Ring. Alle Team-Wappen stehen auf ihrem
// Wurf-Fächer: NÄHE ZUM KORB = kumulierte Punkte (Contract-tokenPos, funnel), wer führt
// steht näher am Ring. Der Ball liegt beim Führenden; pro Reveal fliegt ein Wurf im
// hohen Bogen zum Ring — Treffer swishen (🏀 KORB!/🎯 DREIER!) mit Ring-Puls + Brett-LED,
// schwächere klirren als 🧱 BRICK vom Eisen.
//
// Der Host bleibt WAHRHEIT: Score/Reveal/Ladder/Ticker/Kopf-Strip/Hover/Pops kommen vom
// Host (tokenPos → Hover/Pops bleiben konsistent). Diese Datei rendert NUR die Feld-
// Kinder des <svg> + die on-Feld-FX (Ball, Ring-Puls, KORB/BRICK). Score=Wahrheit,
// Endstand, Medaillen-Ringe, Hot-Hand, Führungs-Glow, Ampel bleiben.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

const NS = "http://www.w3.org/2000/svg";

// Warme Hartholz-Identität (aus dem Mockup) — unabhängig von env, das ist die Disziplin.
const WOOD_0 = "#c98b45";
const WOOD_1 = "#96602a";
const LINE = "#f3e7cf";
const PAINT = "rgba(150,45,30,.5)";
const PAINT_SOFT = "rgba(150,45,30,.28)";
const RIM = "#ff7a2f";
const BOARD = "#e8edf2";
const BOARD_ST = "#5a6672";
const RING_DASH = "rgba(255,244,220,.16)";
const HALL = "rgba(255,236,190,.20)";
const GRAIN = "rgba(70,36,12,.28)";
const BOWL = "#0f0b06";
const LED_OFF = "#3a1408";
const LED_ON = "#f0503c";

type Cfg = {
  cx: number;
  hoopY: number;
  baseY: number;
  baseHalf: number;
  reduced: boolean;
  courtMedian: number;
  tokenPos: (t: RT, score: number) => { x: number; y: number };
};

type Ball = {
  el: SVGCircleElement;
  fx: number;
  fy: number;
  cxp: number;
  cyp: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  make: boolean;
  drei: boolean;
  gain: number;
};

export default function CourtField(props: DisciplineFieldProps): ReactNode {
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
    tokenPos,
    rt,
    sorted,
    now,
    finalMax,
    courtMedian,
    courtMax,
    courtHotFloor,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    hoverIdx,
    highlightIdxs,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);
  const cx = Number(layout?.cx ?? W / 2);
  const hoopY = Number(layout?.hoopY ?? H * 0.15);
  const baseY = Number(layout?.baseY ?? H * 0.9);
  const baseHalf = Number(layout?.baseHalf ?? W * 0.4);

  // Halbkreis-Fächer UM DEN KORB (statt flacher Bodenreihe / Host-Funnel): jedes Team hat eine
  // feste Winkel-Lane, der RADIUS = Nähe zum Korb ∝ Punkte → der Führende steht am Ring, die
  // schwächeren weiter außen auf dem Bogen, alle nähern sich beim Punkten dem Korb. Score bleibt
  // Wahrheit (kontinuierlich → animScore-Glide + Ghost). Pops sind DOM-basiert → treffen mit.
  const arcMaxR = Math.min(baseY - hoopY, baseHalf) * 0.95;
  const localTokenPos = (t: RT, score: number): { x: number; y: number } => {
    const n = Math.max(1, rt.length);
    // Nähe zum Korb = ABSOLUTER Fortschritt (score/finalMax), NICHT courtMax (= Max der bisher
    // Geworfenen → sonst steht der Führende schon in Runde 1 am Korb). So braucht der Vorstoß
    // die vollen Runden bis zum Ring; bei Runde 1/6 sind alle noch weit außen am Bogen.
    const norm = finalMax > 0 ? Math.max(0, Math.min(1, score / finalMax)) : 0;
    const radius = arcMaxR * (0.18 + (1 - norm) * 0.82); // Führender ~0.18·R (am Ring), Letzter = R
    const laneFrac = n > 1 ? t.laneIdx / (n - 1) : 0.5;
    const ang = (laneFrac - 0.5) * (Math.PI * 0.86); // ±77° Fächer unter dem Korb
    return { x: cx + Math.sin(ang) * radius, y: hoopY + Math.cos(ang) * radius };
  };

  // Benchmark-Bewegung + Ghost: Token folgen animScore über die lokale Polar-tokenPos
  // (Frame-Sync mit Rangliste, Hover/Pause friert ein). Siehe benchmark.tsx.
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos: localTokenPos });

  const courtL = cx - baseHalf;
  const courtR = cx + baseHalf;
  const courtT = hoopY - 26;
  const courtBot = baseY + 22;
  const courtBoxH = courtBot - courtT;

  // Zone / Freiwurf / Dreier — aus den Contract-Maßen abgeleitet.
  const keyW = baseHalf * 0.2;
  const keyH = (baseY - hoopY) * 0.5;
  const ftR = keyW;
  const arcW = baseHalf * 0.9;
  const arcH = baseY - hoopY;
  const midY = (hoopY + baseY) / 2 + 26;
  const rings = [(baseY - hoopY) * 0.34, (baseY - hoopY) * 0.66, (baseY - hoopY) * 0.96];

  // ---- Frische Prop-Spiegel für die rAF-FX-Schleife (ohne Neustart) --------------------
  const fxRef = useRef<SVGGElement | null>(null);
  const pballRef = useRef<SVGCircleElement | null>(null);
  const cfgRef = useRef<Cfg>({ cx, hoopY, baseY, baseHalf, reduced: reducedMotion, courtMedian, tokenPos: localTokenPos });
  cfgRef.current = { cx, hoopY, baseY, baseHalf, reduced: reducedMotion, courtMedian, tokenPos: localTokenPos };
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;
  // Pause/Hover-Freeze für die FX-Schleife (wie rink/football/kda) — sonst laufen Ballbesitz
  // und fliegende Würfe weiter, während die Token via useTokenGlide eingefroren stehen.
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;

  // ---- rAF: Ballbesitz beim Führenden + fliegende Würfe pro Reveal ---------------------
  useEffect(() => {
    const prevThrown = new Map<number, number>();
    const prevScore = new Map<number, number>();
    const balls: Ball[] = [];
    const pball = { x: cfgRef.current.cx, y: cfgRef.current.hoopY + 40, init: false };
    let raf = 0;
    let last = performance.now();

    const mk = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
      document.createElementNS(NS, tag);

    const dropAfter = (el: SVGElement) =>
      el.addEventListener("animationend", () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

    // Treffer: Ring-Puls (gold) + Brett-LED-Flash + steigendes KORB!/DREIER!-Label.
    const korb = (c: Cfg, drei: boolean, gain: number) => {
      const fx = fxRef.current;
      if (!fx) return;
      const ring = mk("circle");
      ring.setAttribute("cx", String(c.cx));
      ring.setAttribute("cy", String(c.hoopY));
      ring.setAttribute("r", "15");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "var(--nl-warn)");
      ring.setAttribute("stroke-width", "3");
      ring.setAttribute("class", "bbfx-rimhit");
      dropAfter(ring);
      fx.appendChild(ring);

      const led = mk("rect");
      led.setAttribute("x", String(c.cx - 66));
      led.setAttribute("y", String(c.hoopY - 44));
      led.setAttribute("width", "132");
      led.setAttribute("height", "5");
      led.setAttribute("rx", "2.5");
      led.setAttribute("fill", LED_ON);
      led.setAttribute("class", "bbfx-led");
      dropAfter(led);
      fx.appendChild(led);

      const tx = mk("text");
      tx.setAttribute("x", String(c.cx));
      tx.setAttribute("y", String(c.hoopY + 40));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-family", "ui-monospace, monospace");
      tx.setAttribute("font-weight", "900");
      tx.setAttribute("font-size", drei ? "16" : "15");
      tx.setAttribute("fill", drei ? skinAccent : "var(--nl-warn)");
      tx.setAttribute("class", "bbfx-pop");
      tx.textContent = `${drei ? "🎯 DREIER!" : "🏀 KORB!"}${gain > 0 ? " +" + Math.round(gain) : ""}`;
      dropAfter(tx);
      fx.appendChild(tx);
    };

    // Fehlwurf: Ring klirrt (grau) + BRICK-Label.
    const brick = (c: Cfg) => {
      const fx = fxRef.current;
      if (!fx) return;
      const ring = mk("circle");
      ring.setAttribute("cx", String(c.cx));
      ring.setAttribute("cy", String(c.hoopY));
      ring.setAttribute("r", "13");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "var(--nl-mut)");
      ring.setAttribute("stroke-width", "3");
      ring.setAttribute("class", "bbfx-clank");
      dropAfter(ring);
      fx.appendChild(ring);

      const tx = mk("text");
      tx.setAttribute("x", String(c.cx + 40));
      tx.setAttribute("y", String(c.hoopY + 6));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-family", "ui-monospace, monospace");
      tx.setAttribute("font-weight", "800");
      tx.setAttribute("font-size", "12");
      tx.setAttribute("fill", "var(--nl-mut)");
      tx.setAttribute("class", "bbfx-pop");
      tx.textContent = "🧱 BRICK";
      dropAfter(tx);
      fx.appendChild(tx);
    };

    const fireShot = (c: Cfg, t: RT, gain: number) => {
      const fx = fxRef.current;
      if (!fx) return;
      const from = c.tokenPos(t, t.animScore);
      const dist = Math.hypot(from.x - c.cx, from.y - c.hoopY);
      const make = t.score >= c.courtMedian;
      const drei = from.y - c.hoopY > (c.baseY - c.hoopY) * 0.55;
      const el = mk("circle");
      el.setAttribute("r", "7");
      el.setAttribute("fill", "url(#bbfxBall)");
      el.setAttribute("stroke", "#7a3410");
      el.setAttribute("stroke-width", "1");
      el.setAttribute("class", "bbfx-ball");
      el.setAttribute("cx", String(from.x));
      el.setAttribute("cy", String(from.y));
      fx.appendChild(el);
      balls.push({
        el,
        fx: from.x,
        fy: from.y,
        cxp: (from.x + c.cx) / 2,
        cyp: Math.min(from.y, c.hoopY) - (70 + dist * 0.25), // hoher Wurf-Bogen
        tx: c.cx,
        ty: c.hoopY,
        t: 0,
        dur: 520 + dist * 0.7,
        make,
        drei,
        gain,
      });
    };

    const tick = (ts: number) => {
      const c = cfgRef.current;
      const dt = Math.min(64, ts - last);
      last = ts;
      const list = rtRef.current;
      const frozen = hoverRef.current != null || pausedRef.current;

      // Reveal-Erkennung: sobald ein Token einen neuen Slot enthüllt (thrownSlot steigt),
      // fliegt EIN Wurf. Beim ersten Frame nur initialisieren (kein Wurf-Sturm).
      // Bei Pause/Hover: prev-Maps NICHT fortschreiben → beim Entfrieren feuert der Reveal.
      if (!frozen) {
        for (const t of list) {
          const hadT = prevThrown.has(t.idx);
          const pT = prevThrown.get(t.idx) ?? t.thrownSlot;
          const pS = prevScore.get(t.idx) ?? t.score;
          if (hadT && t.thrownSlot > pT && t.thrownSlot >= 0 && !c.reduced) {
            fireShot(c, t, t.score - pS);
          }
          prevThrown.set(t.idx, t.thrownSlot);
          prevScore.set(t.idx, t.score);
        }
      }

      // Ballbesitz: der Ball gleitet zum Führenden (Rang 1) hin zum Ring.
      let leader: RT | null = null;
      for (const t of list) if (t.rank === 1 && t.thrownSlot >= 0) leader = t;
      const pb = pballRef.current;
      if (pb) {
        if (leader && !c.reduced && !frozen) {
          const lp = c.tokenPos(leader, leader.animScore);
          const tx = lp.x + (c.cx - lp.x) * 0.16;
          const ty = lp.y + (c.hoopY - lp.y) * 0.16;
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

      // Wurf-Bögen (Bezier) + Einschlag-FX. Bei Pause/Hover in der Luft einfrieren.
      for (let j = balls.length - 1; j >= 0; j -= 1) {
        const b = balls[j]!;
        if (!frozen) b.t += dt / b.dur;
        if (b.t >= 1) {
          balls.splice(j, 1);
          if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
          if (b.make) korb(c, b.drei, b.gain);
          else brick(c);
          continue;
        }
        const u = b.t;
        const v = 1 - u;
        const bx = v * v * b.fx + 2 * u * v * b.cxp + u * u * b.tx;
        const by = v * v * b.fy + 2 * u * v * b.cyp + u * u * b.ty;
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

  // Zuschauer-Ränge (Punkt-Reihen) rund um den Court — dunkle Hallen-Bowl.
  const crowd: ReactNode[] = [];
  const seat = (i: number) => (i % 4 === 0 ? "hsl(28 48% 42%)" : "hsl(28 30% 24%)");
  for (let row = 0; row < 3; row += 1) {
    const y = 12 + row * 15;
    for (let i = 0; i < 42; i += 1) {
      const x = 22 + i * ((W - 44) / 41);
      crowd.push(<circle key={`ct${row}-${i}`} cx={x} cy={y} r={2.3} fill={seat(i + row)} opacity={0.5} />);
    }
  }
  for (let col = 0; col < 2; col += 1) {
    for (let i = 0; i < 18; i += 1) {
      const y = 96 + i * ((baseY - 70) / 17);
      crowd.push(<circle key={`csl${col}-${i}`} cx={14 + col * 15} cy={y} r={2.3} fill={seat(i + col)} opacity={0.45} />);
      crowd.push(<circle key={`csr${col}-${i}`} cx={W - 14 - col * 15} cy={y} r={2.3} fill={seat(i + col + 1)} opacity={0.45} />);
    }
  }

  return (
    <>
      <defs>
        <style>{`
          .bbfx-ball{filter:drop-shadow(0 0 6px rgba(255,140,58,.55));}
          .bbfx-rimhit{transform-box:fill-box;transform-origin:center;animation:bbfxRimHit .6s ease-out forwards;}
          .bbfx-clank{transform-box:fill-box;transform-origin:center;animation:bbfxClank .45s ease-out forwards;}
          .bbfx-led{animation:bbfxLed .5s ease-out 2 forwards;}
          .bbfx-pop{transform-box:fill-box;transform-origin:center;animation:bbfxPop 1.3s ease-out forwards;}
          @keyframes bbfxRimHit{0%{opacity:1;transform:scale(.6)}100%{opacity:0;transform:scale(1.9)}}
          @keyframes bbfxClank{0%,60%{opacity:1}25%{transform:translateX(-3px)}50%{transform:translateX(3px)}100%{opacity:0;transform:translateX(0)}}
          @keyframes bbfxLed{0%,55%{opacity:1}100%{opacity:0}}
          @keyframes bbfxPop{0%{opacity:0;transform:translateY(0)}18%{opacity:1;transform:translateY(-16px)}100%{opacity:0;transform:translateY(-46px)}}
        `}</style>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
        <linearGradient id="bbWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={WOOD_0} />
          <stop offset="1" stopColor={WOOD_1} />
        </linearGradient>
        <radialGradient id="bbFlood" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor={HALL} />
          <stop offset="100%" stopColor="rgba(255,236,190,0)" />
        </radialGradient>
        <radialGradient id="bbfxBall" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffab5e" />
          <stop offset="55%" stopColor="#e8722a" />
          <stop offset="100%" stopColor="#b34d16" />
        </radialGradient>
        <clipPath id="bbCourtClip">
          <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtBoxH} rx={12} />
        </clipPath>
      </defs>

      {/* Dunkle Arena-Bowl + Zuschauer */}
      <rect x={0} y={0} width={W} height={H} fill={BOWL} />
      {crowd}

      {/* Parkett-Boden (Hartholz) */}
      <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtBoxH} rx={12} fill="url(#bbWood)" stroke="#1e1409" strokeWidth={6} />
      <g clipPath="url(#bbCourtClip)">
        {/* Dielen-Maserung */}
        <g stroke={GRAIN} strokeWidth={1.2} opacity={0.7}>
          {Array.from({ length: 22 }).map((_, i) => {
            const x = courtL + 14 + i * ((baseHalf * 2 - 28) / 21);
            return <line key={i} x1={x} y1={courtT + 4} x2={x} y2={courtBot - 4} />;
          })}
        </g>
        {/* Hallenlicht am Korb */}
        <ellipse cx={cx} cy={hoopY + 40} rx={baseHalf * 0.85} ry={(baseY - hoopY) * 0.5} fill={HALL} />
        <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtBoxH} fill="url(#bbFlood)" />
        {/* Wurfkarten-Distanzringe (Shot-Chart) */}
        {rings.map((r, i) => (
          <circle key={`ring-${i}`} cx={cx} cy={hoopY} r={r} fill="none" stroke={RING_DASH} strokeWidth={1.5} strokeDasharray="3 8" />
        ))}
        {/* Center-Court-Logo */}
        <circle cx={cx} cy={midY} r={keyW * 0.9} fill="none" stroke={LINE} strokeWidth={2} opacity={0.3} />
        <text x={cx} y={midY + 15} textAnchor="middle" fontSize={42} opacity={0.16}>
          🏀
        </text>
        {/* Zonen-Schlüssel (Paint) + Freiwurf */}
        <rect x={cx - keyW} y={hoopY} width={keyW * 2} height={keyH} fill={PAINT} stroke={LINE} strokeWidth={3} opacity={0.92} />
        <path d={`M ${cx - ftR} ${hoopY + keyH} A ${ftR} ${ftR} 0 0 0 ${cx + ftR} ${hoopY + keyH}`} fill={PAINT_SOFT} stroke="none" />
        <circle cx={cx} cy={hoopY + keyH} r={ftR} fill="none" stroke={LINE} strokeWidth={3} opacity={0.85} />
        {/* Dreier-Bogen + Corner-3-Verlängerungen */}
        <path d={`M ${cx - arcW} ${courtT} L ${cx - arcW} ${hoopY} A ${arcW} ${arcH} 0 0 0 ${cx + arcW} ${hoopY} L ${cx + arcW} ${courtT}`} fill="none" stroke={LINE} strokeWidth={3} opacity={0.65} />
        {/* No-Charge-Halbkreis */}
        <path d={`M ${cx - 26} ${hoopY} A 26 26 0 0 0 ${cx + 26} ${hoopY}`} fill="none" stroke={LINE} strokeWidth={2} opacity={0.55} />
      </g>

      {/* Brett + Korb + Reuse + Brett-LED-Leiste (über dem Ring) */}
      <rect x={cx - 66} y={hoopY - 44} width={132} height={5} rx={2.5} fill={LED_OFF} stroke="#55321a" strokeWidth={1} />
      <rect x={cx - 34} y={hoopY - 32} width={68} height={22} rx={2} fill={BOARD} stroke={BOARD_ST} strokeWidth={1.6} opacity={0.95} />
      <rect x={cx - 13} y={hoopY - 28} width={26} height={13} fill="none" stroke="#c2492f" strokeWidth={1.4} opacity={0.85} />
      <circle cx={cx} cy={hoopY} r={10} fill="none" stroke={RIM} strokeWidth={3.2} />
      <g stroke={LINE} strokeWidth={1} opacity={0.55} fill="none">
        {[-8, -4, 0, 4, 8].map((dx, i) => (
          <line key={i} x1={cx + dx} y1={hoopY + 2} x2={cx + dx * 0.55} y2={hoopY + 20} />
        ))}
        <line x1={cx - 8.5} y1={hoopY + 9} x2={cx + 8.5} y2={hoopY + 9} />
        <line x1={cx - 6} y1={hoopY + 16} x2={cx + 6} y2={hoopY + 16} />
      </g>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Wappen. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Team-Wappen auf dem Wurf-Fächer — Position via rAF (animScore, Benchmark-Sync).
          Rang-Reihenfolge rückwärts, damit der Führende oben liegt (wie der Host). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;
          const hot = courtMax > courtMedian && t.score > courtHotFloor;
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={tokenRef(gRefs, t, localTokenPos)}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Buzzer-Beater-Glow — Führung dauerhaft golden umrandet */}
              {t.rank === 1 && t.thrownSlot >= 0 ? (
                <circle r={r + 11} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.5} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
              ) : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Court trägt seinen eigenen 🏆 unter dem Token. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {/* Treffer (grüner Swish) / Fehlwurf (rotes X) + 🔥 Hot-Hand + 🏆 Führung */}
              {t.thrownSlot >= 0 ? (
                <g>
                  <g transform={`translate(${r + 5} ${-(r + 5)})`}>
                    {t.score >= courtMedian ? (
                      <>
                        <circle r={5} fill="hsl(140 58% 42%)" stroke="hsl(140 70% 78%)" strokeWidth={1.4} />
                        <path d="M -2.4 0 L -0.6 2 L 2.6 -2.4" fill="none" stroke="hsl(140 82% 92%)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    ) : (
                      <g stroke="hsl(2 78% 62%)" strokeWidth={2} strokeLinecap="round">
                        <line x1={-3} y1={-3} x2={3} y2={3} />
                        <line x1={3} y1={-3} x2={-3} y2={3} />
                      </g>
                    )}
                  </g>
                  {hot ? (
                    <text x={-(r + 4)} y={-(r + 1)} textAnchor="end" fontSize={13}>
                      🔥
                    </text>
                  ) : null}
                  {t.rank === 1 ? (
                    <text y={r + 27} textAnchor="middle" fontSize={16}>
                      🏆
                    </text>
                  ) : null}
                </g>
              ) : null}
            </g>
          );
        })}

      {/* Ballbesitz-Marker (Basketball, gleitet zum Führenden) — Position via rAF */}
      <circle ref={pballRef} r={7} fill="url(#bbfxBall)" stroke="#7a3410" strokeWidth={1} opacity={0} className="bbfx-ball" cx={cx} cy={hoopY + 40} />

      {/* Wurf-/Treffer-FX-Ebene (Bälle, Ring-Puls, KORB/BRICK) — imperativ befüllt */}
      <g ref={fxRef} />
    </>
  );
}
