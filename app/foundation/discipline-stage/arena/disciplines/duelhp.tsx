// =====================================================================================
// duelhp (Mini-DM) — 1:1 aus scratchpad/minidm-arena.html rebuildet.
//
// Arena-„Pit" von oben: alle 32 Team-Logos kämpfen live im Rund und prallen beim
// Scoren aufeinander. Bewegung = weiche Kohäsion (Grüppchen) + Rally-Puls + Wander,
// Abprall am Ellipsen-Rand. Score bleibt Wahrheit: sobald die Reveal-Engine den
// kumulierten Score eines Teams erhöht, stürmt sein Logo auf den nächsten Gegner zu
// (Lunge/Aufprall), eine aufsteigende SCHADENS-Zahl (dmg, aus dem Score abgeleitet)
// erscheint — der größte Move einer Runde als gelbe Crit-Zahl mit ✦-Funken. Rang = 1
// ist das größte, goldene Logo (Krone), Top-3 tragen Medaillen-Ringe, Freund/Feind
// als Rahmen. reduced-motion → statischer Endstand mit Sample-Treffern.
//
// Das geteilte Chrome liefert automatisch: MyTracker/Kopf-Strip, 32er-Ladder (Rang =
// Score, Ampel, Medaillen), Feed-Ticker, Hover-Steckbrief, Podest, Endstand.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hueForIdx, relColor } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";

const SVGNS = "http://www.w3.org/2000/svg";

// Deterministischer FNV-Hash → 0…1 (SSR-stabil, wie im Mockup).
function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

type Node = {
  idx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sz: number; // Kollisions-Durchmesser (Führender größer)
  rally: boolean;
  lungeT: number; // ms verbleibende Lunge (kurz schneller)
};

export default function DuelhpField(props: DisciplineFieldProps): ReactNode {
  const {
    disciplineName,
    W,
    H,
    reducedMotion,
    finalMax,
    fieldNorm,
    rt,
    sorted,
    now,
    hoverIdx,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
    onHoverTeam,
    fireFlash,
    glow,
  } = props;

  // Pit-Geometrie (Ellipse, nutzt fast die volle Arena).
  const cx = W / 2;
  const cy = H * 0.52;
  const rx = W * 0.47;
  const ry = H * 0.44;
  const D = Math.round(H * 0.062); // Basis-Token-Durchmesser
  const DL = Math.round(D * 1.24); // Führender

  // Aus dem einen Score abgeleiteter „Gesamt-Schaden" (Deko fürs Gefühl, monoton,
  // Bereich wie im Mockup: 800 … 7800). Der Score bleibt die Wahrheit.
  const dmgOf = (score: number): number => 800 + fieldNorm(score) * 7000;

  // Imperative Refs (Bewegung + FX ohne React-Re-Render pro Frame — wie track.tsx).
  const nodesRef = useRef<Map<number, Node>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const fxLayerRef = useRef<SVGGElement | null>(null);
  const lastDmgRef = useRef<Map<number, number>>(new Map());
  const initedRef = useRef(false);

  // Frische Prop-Spiegel für die rAF-Schleife / FX-Effekte.
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  // Node-Initialisierung (deterministisch gestreut im Pit).
  const ensureNode = (t: RT): Node => {
    const m = nodesRef.current;
    let n = m.get(t.idx);
    if (!n) {
      const ang = hash01(t.code) * 6.283;
      const rad = Math.sqrt(hash01(t.code + "r")) * 0.82;
      const va = hash01(t.code + "v") * 6.283;
      const sp = (0.3 + hash01(t.code + "s") * 0.55) * 1.5;
      n = {
        idx: t.idx,
        x: cx + Math.cos(ang) * rad * rx,
        y: cy + Math.sin(ang) * rad * ry,
        vx: Math.cos(va) * sp,
        vy: Math.sin(va) * sp,
        sz: t.rank === 1 ? DL : D,
        rally: false,
        lungeT: 0,
      };
      m.set(t.idx, n);
    }
    return n;
  };

  const nearest = (n: Node): Node | null => {
    let best: Node | null = null;
    let bd = 1e9;
    for (const m of nodesRef.current.values()) {
      if (m === n) continue;
      const d = Math.hypot(m.x - n.x, m.y - n.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  };

  // Ein Schadens-Ereignis am Pit: ✦-Funke + aufsteigende dmg-Zahl (sm/norm/crit).
  const spawnHit = (x: number, y: number, dmg: number, kind: "sm" | "norm" | "crit"): void => {
    const layer = fxLayerRef.current;
    if (!layer) return;
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("transform", `translate(${x} ${y})`);
    // Funke
    const spark = document.createElementNS(SVGNS, "text");
    spark.setAttribute("class", "mdmg-spark");
    spark.setAttribute("text-anchor", "middle");
    spark.textContent = "✦";
    g.appendChild(spark);
    // Zahl
    const num = document.createElementNS(SVGNS, "text");
    num.setAttribute("class", `mdmg-num ${kind}`);
    num.setAttribute("text-anchor", "middle");
    if (kind === "crit") {
      const lbl = document.createElementNS(SVGNS, "tspan");
      lbl.setAttribute("class", "mdmg-crit-lbl");
      lbl.setAttribute("x", "0");
      lbl.setAttribute("dy", "-14");
      lbl.textContent = "CRIT";
      const val = document.createElementNS(SVGNS, "tspan");
      val.setAttribute("x", "0");
      val.setAttribute("dy", "22");
      val.textContent = dmg.toLocaleString("de-DE");
      num.appendChild(lbl);
      num.appendChild(val);
    } else {
      num.textContent = dmg.toLocaleString("de-DE");
    }
    g.appendChild(num);
    layer.appendChild(g);
    const cleanup = () => g.remove();
    num.addEventListener("animationend", cleanup);
    window.setTimeout(cleanup, 2100); // Fallback (reduced-motion: keine animationend)
  };

  // Treffer-Recoil am Token (kurzes Aufblitzen) — imperativ, damit React nicht stört.
  const recoil = (idx: number): void => {
    const el = gRefs.current.get(idx);
    if (!el) return;
    el.classList.remove("mdmg-hit");
    void el.getBoundingClientRect(); // Reflow-Anstoß → Animation startet neu
    el.classList.add("mdmg-hit");
    window.setTimeout(() => el.classList.remove("mdmg-hit"), 300);
  };

  // Score-getriebene Kampf-FX: bei jedem Render den abgeleiteten Schaden je Team mit
  // dem letzten Stand vergleichen. Gestiegene Teams „scoren" (Lunge + dmg-Zahl); der
  // größte Move dieses Reveals ist die Crit. Erster Lauf/Reset nur Baseline setzen.
  useEffect(() => {
    const last = lastDmgRef.current;
    const changes: { idx: number; delta: number }[] = [];
    for (const t of rtRef.current) {
      ensureNode(t);
      const cur = dmgOf(t.score);
      const prev = last.get(t.idx);
      if (prev != null && cur - prev > 1) changes.push({ idx: t.idx, delta: cur - prev });
      last.set(t.idx, cur);
    }
    if (!initedRef.current) {
      initedRef.current = true;
      return; // Baseline (Mount/SSR-Hydration) — keine FX
    }
    if (changes.length === 0 || reducedRef.current) return;
    changes.sort((a, b) => b.delta - a.delta);
    changes.forEach((c, i) => {
      const n = nodesRef.current.get(c.idx);
      if (!n) return;
      const tgt = nearest(n);
      if (tgt) {
        const dx = tgt.x - n.x;
        const dy = tgt.y - n.y;
        const dl = Math.hypot(dx, dy) || 1;
        n.vx += (dx / dl) * 2.6;
        n.vy += (dy / dl) * 2.6;
        n.lungeT = 280;
      }
      const ix = tgt ? (n.x + tgt.x) / 2 : n.x;
      const iy = tgt ? (n.y + tgt.y) / 2 : n.y;
      const dmg = Math.round(c.delta);
      const crit = i === 0; // größter Move der Runde = Crit
      const kind: "sm" | "norm" | "crit" = crit ? "crit" : dmg < 120 ? "sm" : "norm";
      spawnHit(ix, iy - 6, dmg, kind);
      recoil(c.idx);
      if (crit) {
        fireFlash("gold");
        const t = rtRef.current.find((x) => x.idx === c.idx);
        if (t) glow(t);
      }
    });
  });

  // Bewegungs-Engine (rAF): Kohäsion/Separation/Rally/Wander + Ellipsen-Abprall +
  // Token-Kollisionen. Positioniert die Token-<g> imperativ. Hover friert ein.
  useEffect(() => {
    if (reducedMotion) {
      // Statischer Fallback: Token einmalig platzieren, ein paar Sample-Treffer.
      for (const t of rtRef.current) {
        const n = ensureNode(t);
        const el = gRefs.current.get(t.idx);
        if (el) el.setAttribute("transform", `translate(${n.x} ${n.y})`);
      }
      const arr = rtRef.current;
      for (let k = 0; k < 5; k += 1) {
        const t = arr[k * 3];
        if (!t) continue;
        const n = nodesRef.current.get(t.idx);
        if (n) spawnHit(n.x, n.y - 6, Math.round(200 + fieldNorm(t.score) * 900), k === 0 ? "crit" : "norm");
      }
      return;
    }

    let raf = 0;
    let lastTs = performance.now();
    let rallyX = cx;
    let rallyY = cy;
    let rallyT = 0;
    let rallyOn = false;

    const tick = (ts: number): void => {
      const dt = Math.min(48, ts - lastTs);
      lastTs = ts;
      const frozen = hoverRef.current != null;
      const nodes = Array.from(nodesRef.current.values());

      // Führenden-Größe live nachführen.
      const rankByIdx = new Map<number, number>();
      for (const t of rtRef.current) rankByIdx.set(t.idx, t.rank);
      for (const n of nodes) n.sz = rankByIdx.get(n.idx) === 1 ? DL : D;

      if (!frozen && nodes.length > 0) {
        // Rally-Puls an/aus: mal bildet sich ein Grüppchen, dann löst es sich.
        rallyT -= dt;
        if (rallyT <= 0) {
          rallyOn = !rallyOn;
          rallyT = rallyOn ? 1000 + Math.random() * 700 : 2400 + Math.random() * 1700;
          if (rallyOn) {
            const ra = Math.random() * 6.283;
            const rr = 0.25 + Math.random() * 0.5;
            rallyX = cx + Math.cos(ra) * rr * rx;
            rallyY = cy + Math.sin(ra) * rr * ry;
            const sortedByDist = nodes
              .slice()
              .sort((a, b) => Math.hypot(a.x - rallyX, a.y - rallyY) - Math.hypot(b.x - rallyX, b.y - rallyY));
            for (const n of nodes) n.rally = false;
            for (let q = 0; q < 9 && q < sortedByDist.length; q += 1) sortedByDist[q]!.rally = true;
          }
        }

        const f = dt / 16; // Frame-normierter Faktor
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]!;
          // Separation: kurz stark (kein Überlappen) + mittel schwach → verteilt sich.
          let sepx = 0;
          let sepy = 0;
          for (let j = 0; j < nodes.length; j += 1) {
            if (j === i) continue;
            const m = nodes[j]!;
            const ddx = n.x - m.x;
            const ddy = n.y - m.y;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < 14400) {
              const dd = Math.sqrt(d2) || 1;
              if (dd < 58) {
                sepx += (ddx / dd) * (1 - dd / 58);
                sepy += (ddy / dd) * (1 - dd / 58);
              } else {
                sepx += (ddx / dd) * (1 - dd / 120) * 0.16;
                sepy += (ddy / dd) * (1 - dd / 120) * 0.16;
              }
            }
          }
          n.vx += sepx * 0.11 * f;
          n.vy += sepy * 0.11 * f;
          if (rallyOn && n.rally) {
            n.vx += (rallyX - n.x) * 0.0006 * f;
            n.vy += (rallyY - n.y) * 0.0006 * f;
          }
          n.vx += (Math.random() - 0.5) * 0.16 * f;
          n.vy += (Math.random() - 0.5) * 0.16 * f;
          if (n.lungeT > 0) n.lungeT -= dt;
          const sp = Math.hypot(n.vx, n.vy);
          const cap = (n.lungeT > 0 ? 4.0 : 1.5) * (f || 1);
          if (sp > cap) {
            n.vx *= cap / sp;
            n.vy *= cap / sp;
          }
          if (sp < 0.18) {
            const a = Math.random() * 6.283;
            n.vx += Math.cos(a) * 0.26;
            n.vy += Math.sin(a) * 0.26;
          }
          n.x += n.vx * f;
          n.y += n.vy * f;
          // Ellipsen-Rand → Reflexion.
          const ex = (n.x - cx) / rx;
          const ey = (n.y - cy) / ry;
          const e = ex * ex + ey * ey;
          if (e > 1) {
            const s2 = Math.sqrt(e);
            n.x = cx + (ex / s2) * rx * 0.99;
            n.y = cy + (ey / s2) * ry * 0.99;
            const nx = ex / s2;
            const ny = ey / s2;
            const dot = n.vx * nx + n.vy * ny;
            n.vx -= 2 * dot * nx;
            n.vy -= 2 * dot * ny;
            n.vx *= 0.7;
            n.vy *= 0.7;
          }
        }

        // Token-Kollisionen: nur Abprall + seltener winziger Funke, KEINE Zahlen.
        for (let a = 0; a < nodes.length; a += 1) {
          for (let b = a + 1; b < nodes.length; b += 1) {
            const A = nodes[a]!;
            const B = nodes[b]!;
            const dx = A.x - B.x;
            const dy = A.y - B.y;
            const d = Math.hypot(dx, dy);
            const mind = (A.sz + B.sz) / 2 - 4;
            if (d < mind) {
              const ov = mind - d || 1;
              const ux = dx / (d || 1);
              const uy = dy / (d || 1);
              A.x += ux * ov * 0.5;
              A.y += uy * ov * 0.5;
              B.x -= ux * ov * 0.5;
              B.y -= uy * ov * 0.5;
              A.vx += ux * 0.18;
              A.vy += uy * 0.18;
              B.vx -= ux * 0.18;
              B.vy -= uy * 0.18;
            }
          }
        }
      }

      // Positionen imperativ setzen (auch im eingefrorenen Zustand → stabil).
      for (const n of nodes) {
        const el = gRefs.current.get(n.idx);
        if (el) el.setAttribute("transform", `translate(${n.x} ${n.y})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // Token-Radius (Halb-Durchmesser) — Führender/eigenes Team etwas größer.
  const tokenR = (t: RT): number => (t.rank === 1 ? DL / 2 : t.isOwn ? D / 2 + 1 : D / 2);

  return (
    <>
      <style>{`
        .mdmg-num{font-family:ui-monospace,monospace;font-weight:900;paint-order:stroke;stroke:#000;stroke-width:2.4px;animation:mdmgFloat 1.7s ease-out forwards;}
        .mdmg-num.sm{fill:var(--nl-warn);opacity:.78;font-size:15px;}
        .mdmg-num.norm{fill:var(--nl-warn);font-size:21px;}
        .mdmg-num.crit{fill:var(--nl-warn);font-size:31px;}
        .mdmg-crit-lbl{fill:var(--nl-risk);font-size:11px;letter-spacing:.16em;font-style:italic;stroke-width:1.6px;}
        .mdmg-spark{fill:var(--nl-warn);font-size:24px;transform-box:fill-box;transform-origin:center;animation:mdmgSpark .36s ease-out forwards;}
        .mdmg-hit{animation:mdmgRecoil .28s ease-out;}
        @keyframes mdmgFloat{0%{opacity:0;transform:translateY(6px) scale(.7)}14%{opacity:1;transform:translateY(-16px) scale(1.04)}68%{opacity:1;transform:translateY(-40px) scale(1)}100%{opacity:0;transform:translateY(-62px) scale(1)}}
        @keyframes mdmgSpark{0%{opacity:0;transform:scale(.4)}40%{opacity:1;transform:scale(1.25)}100%{opacity:0;transform:scale(1.6)}}
        @keyframes mdmgRecoil{0%{filter:brightness(2.4) drop-shadow(0 0 6px var(--nl-warn))}100%{filter:none}}
        @media (prefers-reduced-motion: reduce){.mdmg-num,.mdmg-spark,.mdmg-hit{animation:none!important;opacity:1}}
      `}</style>

      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={tokenR(t)} />
            </clipPath>
          ) : null,
        )}
        <radialGradient id="mdmgPit" cx="50%" cy="42%" r="72%">
          <stop offset="0%" stopColor="var(--nl-warn)" stopOpacity={0.14} />
          <stop offset="46%" stopColor="var(--nl-panel)" stopOpacity={0.6} />
          <stop offset="100%" stopColor="var(--nl-bg)" stopOpacity={0.95} />
        </radialGradient>
      </defs>

      {/* Arena-Boden + Pit-Rund */}
      <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" />
      <rect x={0} y={0} width={W} height={H} fill="url(#mdmgPit)" />
      {/* Zuschauer-Glow oben */}
      <ellipse cx={cx} cy={cy - ry} rx={rx * 0.9} ry={ry * 0.5} fill="var(--nl-warn)" opacity={0.05} />
      {/* Pit-Ring (Gold, dezent) + ⚔-Wasserzeichen */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--nl-warn)" strokeWidth={1.5} opacity={0.28} />
      <ellipse cx={cx} cy={cy} rx={rx - 7} ry={ry - 7} fill="none" stroke="var(--nl-warn)" strokeWidth={1} opacity={0.1} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.round(H * 0.32)} fill="var(--nl-warn)" opacity={0.045}>
        ⚔
      </text>

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill="var(--nl-warn)" opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ephemere Kampf-FX (dmg-Zahlen + Funken) — imperativ befüllt */}
      <g ref={fxLayerRef} style={{ pointerEvents: "none" }} />

      {/* Team-Tokens — Position imperativ via rAF (transform). In Rang-Reihenfolge
          rückwärts, damit der Führende oben liegt. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = tokenR(t);
          const hue = hueForIdx(t.idx);
          const lead = t.rank === 1;
          const medal =
            t.rank === 1 ? "var(--nl-warn)" : t.rank === 2 ? "var(--nl-mut)" : t.rank === 3 ? "rgb(205,127,50)" : null;
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
              onMouseEnter={() => {
                openHover(t.idx);
                if (onHoverTeam && t.teamId) onHoverTeam(t.teamId);
              }}
              onMouseLeave={() => {
                scheduleHoverClose();
                if (onHoverTeam) onHoverTeam(null);
              }}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Führungs-Glow (goldener Puls) */}
              {lead ? (
                <circle r={r + 9} fill="none" stroke="var(--nl-warn)" strokeWidth={3.5} opacity={0.7} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.4s ease-in-out infinite" }} />
              ) : null}
              {glowing ? (
                <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} />
              ) : null}
              {/* Freund/Feind-Rahmen */}
              {rc ? <circle r={r + 5.5} fill="none" stroke={rc} strokeWidth={2.4} opacity={0.95} /> : null}
              {/* Medaillen-Ring der Top-3 */}
              {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={lead || t.isOwn ? 4 : 3} /> : null}
              {/* Logo (echte Team-Optik) bzw. Farb-Kreis */}
              {t.logoUrl ? (
                <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
              )}
              <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
              {/* Krone (Führender) */}
              {lead ? (
                <text y={-(r + 8)} textAnchor="middle" fontSize={15}>
                  🏆
                </text>
              ) : null}
              {/* Eigenes Team markieren */}
              {t.isOwn ? (
                <text y={r + 15} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="var(--nl-accent)">
                  ★ {t.code}
                </text>
              ) : null}
            </g>
          );
        })}
    </>
  );
}
