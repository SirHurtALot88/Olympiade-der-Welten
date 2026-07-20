// =====================================================================================
// kda (Team Deathmatch) — BESPOKE · „Frontline-Push-Map" (Top-down-Taktik-Minimap).
//
// Konzept (Fable-Empfehlung, contract-treu): 32 Teams rücken über 15s von der SPAWN-Zone
// (links) zur FRAG-ZONE (rechts) vor — x = Vorstoß ∝ Score (Staffel-Lesbarkeit, monoton,
// friert am Endstand ein). ECHTE Team-Interaktion ohne Score-Lüge: bei jedem realen Score-
// Fortschritt feuert ein Team einen Tracer auf das nächstliegende zurückliegende Team
// (Mündungsblitz + Hit-Marker ✕), aber Position/Score bleiben unberührt — Frags sind die
// VISUALISIERUNG realer Punkt-Ticks, nie Skript. Killfeed oben rechts, MVP/Krone/Medaillen.
// Stats (K/D/A/HS%) NUR im Hover-Steckbrief (Host-Hovercard) → keine „überbügelnden Balken".
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

const NS = "http://www.w3.org/2000/svg";

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Deterministischer 0…1-Hash (Deckungs-Deko ohne Hydration-Mismatch).
function h01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export default function KdaField(props: DisciplineFieldProps): ReactNode {
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
    fieldNorm,
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

  // ---- Karten-Geometrie: SPAWN links → FRAG-ZONE rechts ------------------------------
  const spawnX = W * 0.11;
  const fragX = W * 0.88;
  const laneTop = 58;
  const laneBot = H - 44;
  const laneOf = (li: number): number => laneTop + ((li + 0.5) / Math.max(1, N)) * (laneBot - laneTop);
  // Vorstoß = ABSOLUTER Fortschritt (score/finalMax), NICHT fieldNorm (= relatives Min-Max →
  // sonst steht der Führende jede Runde schon in der Frag-Zone). So braucht der Push die vollen
  // Runden bis rechts; bei Runde 1 stehen alle noch nah an der Spawn-Zone.
  const normOf = (s: number): number => (finalMax > 0 ? clamp(s / finalMax, 0, 1) : 0);

  // ---- lokale tokenPos: x = Vorstoß ∝ Score, y = feste Team-Bahn ----------------------
  const tokenPos = (t: RT, score: number): { x: number; y: number } => ({
    x: spawnX + normOf(score) * (fragX - spawnX),
    y: laneOf(t.laneIdx),
  });

  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync mit Rangliste,
  // Hover/Pause friert ein). Siehe benchmark.tsx.
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos });

  // ---- Prop-Spiegel für die FX-Schleife ---------------------------------------------
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const fxRef = useRef<SVGGElement | null>(null);
  const feedRef = useRef<SVGGElement | null>(null);

  // ---- rAF: Tracer-Frags zwischen Teams + Killfeed (imperativ) -----------------------
  useEffect(() => {
    const STEP = Math.max(1, finalMax / 52); // Frag-Tick-Auflösung: ~52 Ticks über die volle Distanz
    const prevTick = new Map<number, number>();
    const cooldown = new Map<number, number>();
    type Tr = { line: SVGLineElement; x0: number; y0: number; x1: number; y1: number; vx: number; vy: number; t: number; dur: number; scode: string; vcode: string; done: boolean };
    const trs: Tr[] = [];
    const feed: { g: SVGGElement; born: number }[] = [];
    let raf = 0;
    let last = performance.now();

    const posOf = (t: RT): { x: number; y: number } => ({ x: spawnX + normOf(t.animScore) * (fragX - spawnX), y: laneOf(t.laneIdx) });

    const muzzle = (x: number, y: number) => {
      const g = fxRef.current;
      if (!g) return;
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", String(x));
      c.setAttribute("cy", String(y));
      c.setAttribute("r", "1.5");
      c.setAttribute("fill", "rgba(255,224,140,.95)");
      const ar = document.createElementNS(NS, "animate");
      ar.setAttribute("attributeName", "r");
      ar.setAttribute("values", "1.5;5;1");
      ar.setAttribute("dur", "0.22s");
      const ao = document.createElementNS(NS, "animate");
      ao.setAttribute("attributeName", "opacity");
      ao.setAttribute("values", "1;0");
      ao.setAttribute("dur", "0.22s");
      c.appendChild(ar);
      c.appendChild(ao);
      g.appendChild(c);
      window.setTimeout(() => c.remove(), 260);
    };

    const hitMarker = (x: number, y: number) => {
      const g = fxRef.current;
      if (!g) return;
      const tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", String(x));
      tx.setAttribute("y", String(y + 3));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-size", "11");
      tx.setAttribute("font-weight", "900");
      tx.setAttribute("fill", "var(--nl-risk)");
      tx.textContent = "✕";
      const ao = document.createElementNS(NS, "animate");
      ao.setAttribute("attributeName", "opacity");
      ao.setAttribute("values", "0;1;1;0");
      ao.setAttribute("dur", "0.5s");
      const asc = document.createElementNS(NS, "animateTransform");
      asc.setAttribute("attributeName", "transform");
      asc.setAttribute("type", "scale");
      asc.setAttribute("values", "0.6;1.4;1");
      asc.setAttribute("dur", "0.5s");
      asc.setAttribute("additive", "sum");
      tx.appendChild(ao);
      g.appendChild(tx);
      window.setTimeout(() => tx.remove(), 560);
    };

    const addKill = (shooter: string, victim: string) => {
      const g = feedRef.current;
      if (!g) return;
      const row = document.createElementNS(NS, "g");
      const t1 = document.createElementNS(NS, "text");
      t1.setAttribute("x", "0");
      t1.setAttribute("text-anchor", "end");
      t1.setAttribute("font-family", "ui-monospace, Menlo, monospace");
      t1.setAttribute("font-size", "10");
      t1.setAttribute("font-weight", "800");
      t1.innerHTML = `<tspan fill="var(--nl-good)">${shooter}</tspan><tspan fill="var(--nl-mut)"> ⟶ </tspan><tspan fill="var(--nl-risk)">${victim}</tspan>`;
      row.appendChild(t1);
      g.appendChild(row);
      feed.unshift({ g: row, born: performance.now() });
      // Reflow: neueste oben, ältere nach unten; auf 5 kappen.
      while (feed.length > 5) {
        const old = feed.pop();
        old?.g.remove();
      }
      feed.forEach((f, i) => f.g.setAttribute("transform", `translate(0 ${i * 15})`));
    };

    const fire = (shooter: RT) => {
      const list = rtRef.current;
      const sp = posOf(shooter);
      // Ziel: nächstliegendes Team mit SCHLECHTEREM Rang (das man „fragt").
      let best: RT | null = null;
      let bestD = Infinity;
      for (const v of list) {
        if (v.idx === shooter.idx || v.rank <= shooter.rank) continue;
        const vp = posOf(v);
        const d = (vp.x - sp.x) ** 2 + (vp.y - sp.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      if (!best) return;
      const g = fxRef.current;
      if (!g || trs.length > 5) return;
      const vp = posOf(best);
      const line = document.createElementNS(NS, "line");
      line.setAttribute("stroke", shooter.isOwn ? "hsl(210 82% 66%)" : "rgba(255,214,120,.9)");
      line.setAttribute("stroke-width", "1.8");
      line.setAttribute("stroke-linecap", "round");
      g.appendChild(line);
      trs.push({ line, x0: sp.x, y0: sp.y, x1: vp.x, y1: vp.y, vx: vp.x, vy: vp.y, t: 0, dur: 200, scode: shooter.code, vcode: best.code, done: false });
      muzzle(sp.x, sp.y);
    };

    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;

      if (!frozen && !reduce) {
        for (const t of rtRef.current) {
          const th = Math.floor(t.animScore / STEP);
          const prev = prevTick.get(t.idx);
          prevTick.set(t.idx, th);
          if (prev == null) continue;
          const cd = cooldown.get(t.idx) ?? 0;
          if (th > prev && ts > cd && t.rank < N) {
            cooldown.set(t.idx, ts + 850); // Cooldown gegen Tracer-Spam
            fire(t);
          }
        }
      }

      // Tracer integrieren; bei Ankunft Hit-Marker + Killfeed.
      for (let j = trs.length - 1; j >= 0; j -= 1) {
        const b = trs[j]!;
        if (!frozen) b.t += dt / b.dur;
        const u = b.t < 1 ? b.t : 1;
        const hx = b.x0 + (b.x1 - b.x0) * u;
        const hy = b.y0 + (b.y1 - b.y0) * u;
        // Tracer als kurzes Segment am „Geschoss"-Kopf.
        b.line.setAttribute("x1", String(b.x0 + (b.x1 - b.x0) * Math.max(0, u - 0.22)));
        b.line.setAttribute("y1", String(b.y0 + (b.y1 - b.y0) * Math.max(0, u - 0.22)));
        b.line.setAttribute("x2", String(hx));
        b.line.setAttribute("y2", String(hy));
        b.line.setAttribute("opacity", String(0.85 * (1 - u * 0.4)));
        if (b.t >= 1 && !b.done) {
          b.done = true;
          if (b.line.parentNode) b.line.parentNode.removeChild(b.line);
          trs.splice(j, 1);
          hitMarker(b.vx, b.vy);
          addKill(b.scode, b.vcode);
        }
      }

      // Killfeed-Einträge nach ~4,5s ausblenden/entfernen.
      for (let i = feed.length - 1; i >= 0; i -= 1) {
        const age = ts - feed[i]!.born;
        if (age > 4500) {
          feed[i]!.g.remove();
          feed.splice(i, 1);
        } else if (age > 3500) {
          feed[i]!.g.setAttribute("opacity", String(1 - (age - 3500) / 1000));
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (fxRef.current) fxRef.current.replaceChildren();
      if (feedRef.current) feedRef.current.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Deckungs-Deko (einmalig, deterministisch) ------------------------------------
  const cover = Array.from({ length: 7 }).map((_, i) => {
    const cx = spawnX + 60 + h01("cx" + i) * (fragX - spawnX - 120);
    const cy = laneTop + 20 + h01("cy" + i) * (laneBot - laneTop - 40);
    const cw = 20 + h01("cw" + i) * 34;
    const ch = 12 + h01("ch" + i) * 20;
    return { key: i, x: cx, y: cy, w: cw, h: ch };
  });

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
        <pattern id="kdaSpawn" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(120,150,200,.16)" strokeWidth="3" />
        </pattern>
      </defs>

      {/* Taktik-Boden + Grid */}
      <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" />
      <rect x={0} y={0} width={W} height={H} fill="rgba(10,14,20,.55)" />
      <g stroke="rgba(140,160,190,.05)" strokeWidth={1}>
        {Array.from({ length: Math.ceil(W / 46) }).map((_, i) => (
          <line key={`gx${i}`} x1={i * 46} y1={laneTop - 8} x2={i * 46} y2={laneBot + 8} />
        ))}
        {Array.from({ length: Math.ceil(H / 46) }).map((_, i) => (
          <line key={`gy${i}`} x1={0} y1={i * 46} x2={W} y2={i * 46} />
        ))}
      </g>

      {/* SPAWN-Zone links */}
      <rect x={spawnX - 34} y={laneTop - 8} width={44} height={laneBot - laneTop + 16} fill="url(#kdaSpawn)" />
      <line x1={spawnX + 10} y1={laneTop - 8} x2={spawnX + 10} y2={laneBot + 8} stroke="rgba(120,150,200,.5)" strokeWidth={1.5} strokeDasharray="4 5" />
      <text x={spawnX - 12} y={(laneTop + laneBot) / 2} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={10} fontWeight={800} letterSpacing={2} fill="rgba(140,170,210,.6)" transform={`rotate(-90 ${spawnX - 12} ${(laneTop + laneBot) / 2})`}>
        SPAWN
      </text>

      {/* FRAG-ZONE rechts + Fadenkreuz-Ziel */}
      <rect x={fragX} y={laneTop - 8} width={W - fragX - 8} height={laneBot - laneTop + 16} fill="rgba(240,80,60,.06)" />
      <line x1={fragX} y1={laneTop - 8} x2={fragX} y2={laneBot + 8} stroke="rgba(240,90,70,.5)" strokeWidth={1.5} strokeDasharray="4 5" />
      {(() => {
        const tx = (fragX + W - 8) / 2;
        const ty = (laneTop + laneBot) / 2;
        return (
          <g stroke="rgba(240,90,70,.45)" strokeWidth={1.4} fill="none">
            <circle cx={tx} cy={ty} r={16} />
            <circle cx={tx} cy={ty} r={7} />
            <line x1={tx - 22} y1={ty} x2={tx + 22} y2={ty} />
            <line x1={tx} y1={ty - 22} x2={tx} y2={ty + 22} />
          </g>
        );
      })()}
      <text x={(fragX + W - 8) / 2} y={laneBot + 6} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={800} letterSpacing={2} fill="rgba(240,120,100,.6)">
        FRAG-ZONE
      </text>

      {/* Deckungs-Objekte (Kisten) */}
      {cover.map((c) => (
        <g key={c.key}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={2} fill="rgba(60,66,54,.5)" stroke="rgba(150,160,140,.22)" strokeWidth={1} />
          <line x1={c.x} y1={c.y + c.h / 2} x2={c.x + c.w} y2={c.y + c.h / 2} stroke="rgba(0,0,0,.3)" strokeWidth={1} />
        </g>
      ))}

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Token. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: Squads — Position via rAF (animScore, Benchmark-Sync). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;
          const isLead = t.rank === 1;
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
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — TDM trägt eigene Krone + MVP-Tag. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {/* Champion-Krone + MVP-Tag (Rang 1) */}
              {isLead ? (
                <>
                  <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                    🏆
                  </text>
                  {done ? (
                    <g transform={`translate(0 ${r + 12})`}>
                      <rect x={-16} y={-7} width={32} height={13} rx={3} fill="var(--nl-warn)" />
                      <text y={3} textAnchor="middle" fontSize={8} fontWeight={900} fontFamily="ui-monospace, Menlo, monospace" fill="var(--nl-bg)">
                        MVP
                      </text>
                    </g>
                  ) : null}
                </>
              ) : null}
            </g>
          );
        })}

      {/* Tracer/Frag-FX-Layer — imperativ. */}
      <g ref={fxRef} pointerEvents="none" />

      {/* Killfeed oben rechts — imperativ befüllt. */}
      <g ref={feedRef} transform={`translate(${W - 16} 46)`} pointerEvents="none" />
      <text x={W - 16} y={34} textAnchor="end" fontFamily="ui-monospace, Menlo, monospace" fontSize={8} fontWeight={800} letterSpacing={2} fill="var(--nl-mut-2)" pointerEvents="none">
        KILLFEED
      </text>
    </>
  );
}
