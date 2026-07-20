// =====================================================================================
// rink (Hockey · Eisrink) — 1:1 aus dem Mockup: Eisfläche von oben, 32 Spieler-Bahnen,
// Puck beim Führenden, Torlichter + Spieler-Tokens mit Medaillen/Beziehungen.
//
// Bewegung: CSS-Transitions (wie bump) auf SVG <g> transform.
// Score bleibt Wahrheit: X-Position ∝ Score, Lane-Index ∝ Team-Index.
// Puck folgt dem Führenden. Top-3 bekommen Medaillen-Ringe. Beziehungen: Rahmen.
// Nur SVG-Elemente, kein HTML, kein dangerouslySetInnerHTML.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome } from "./benchmark";

export default function RinkField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    env,
    reducedMotion,
    W,
    H,
    N,
    geo,
    finalMax,
    rt,
    sorted,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // Geometrie: das Rink ist im Mockup-Raum 820×520 gezeichnet, die echte viewBox ist 1180×560.
  // Die ganze Szene wird uniform skaliert (Kreise bleiben rund) + zentriert in eine Gruppe
  // gewickelt — sonst quetscht sich das Feld in die linken ~70% und rechts bleibt totes Eis
  // (die früher berechneten scaleX/scaleY/scale wurden NIE angewandt → toter Code).
  const LW = 820;
  const LH = 520;
  const sceneS = Math.min(W / LW, H / LH);
  const sceneTX = (W - LW * sceneS) / 2;
  const sceneTY = (H - LH * sceneS) / 2;

  // Rink-Koordinaten im Mockup-Space (820×520)
  const topLane = 46;
  const botLane = 474;
  const pitch = (botLane - topLane) / 31; // 32 Bahnen
  const X0 = 100; // Startlinie / links
  const X1 = 698; // Torraum / rechts
  const CX = 410; // Mittelpunkt X
  const CY = 260; // Mittelpunkt Y (Center-Circle Mitte)
  const GL = 86; // Goalie-Linie links (Goals)
  const GR = LW - 86; // Goalie-Linie rechts
  const BLa = 292; // Blaue Linie links
  const BLb = LW - 292; // Blaue Linie rechts

  // Hilfsfunktionen
  const laneY = (i: number): number => topLane + (i + 0.5) * pitch;
  const fracX = (score: number): number => {
    const norm = finalMax > 0 ? score / finalMax : 0;
    return X0 + norm * (X1 - X0);
  };

  // Puck folgt dem Führenden — Position via rAF aus animScore (Benchmark-Sync mit Feld +
  // Rangliste; Hover/Pause friert auch den Puck ein). Kein CSS-transform mehr.
  const leader = sorted.length > 0 ? sorted[0] : null;
  const puckRef = useRef<SVGEllipseElement | null>(null);
  const fxRef = useRef<SVGGElement | null>(null);
  const goalLightRef = useRef<SVGCircleElement | null>(null);
  const goalieRef = useRef<SVGGElement | null>(null);
  const hoverRef = useRef<number | null>(hoverIdx);
  hoverRef.current = hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  const reducedRef = useRef<boolean>(reducedMotion);
  reducedRef.current = reducedMotion;
  const sortedRef = useRef<RT[]>(sorted);
  sortedRef.current = sorted;
  const rtRef = useRef<RT[]>(rt);
  rtRef.current = rt;

  const NS = "http://www.w3.org/2000/svg";
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const prevScore = new Map<number, number>();
    // Fliegende Pucks (Schuss → Torraum) — nur Zeichnung, nie Score. outcome = Tor oder Save.
    const shots: { x: number; y: number; tx: number; ty: number; t: number; g: SVGGElement; outcome: "goal" | "save" }[] = [];
    let lightUntil = 0; // Torlicht-Flash bis-Zeitpunkt
    let saveUntil = 0; // Goalie-Fanghandschuh-Flash bis-Zeitpunkt
    let shotAcc = 0; // Rhythmus-Akku fürs LAUFENDE Schießen (nicht nur bei Reveals)
    let goalieY = CY; // Goalie-Sollposition (folgt dem Führenden weich)
    let goalieCur = CY;

    // Einen Schuss vom Team t Richtung rechtes Tor abfeuern (outcome vorab bestimmt).
    const fireShot = (t: RT, outcome: "goal" | "save") => {
      const g = document.createElementNS(NS, "g");
      const p = document.createElementNS(NS, "ellipse");
      p.setAttribute("rx", "5");
      p.setAttribute("ry", "3.2");
      p.setAttribute("fill", "#0c0e11");
      p.setAttribute("stroke", "#39434f");
      p.setAttribute("stroke-width", "1");
      const trail = document.createElementNS(NS, "line");
      trail.setAttribute("stroke", t.isOwn ? "rgba(87,177,255,.8)" : "rgba(200,215,235,.6)");
      trail.setAttribute("stroke-width", "2.4");
      trail.setAttribute("stroke-linecap", "round");
      g.appendChild(trail);
      g.appendChild(p);
      if (fxRef.current) fxRef.current.appendChild(g);
      shots.push({
        x: fracX(t.animScore) + (t.isOwn ? geo.rOwn : geo.r) + 6,
        y: laneY(t.idx),
        // Save → der Puck landet knapp VOR dem Torraum (Goalie pariert); Tor → in den Kasten.
        tx: outcome === "goal" ? GR + 6 : GR - 10,
        ty: CY + (outcome === "save" ? (Math.random() - 0.5) * 30 : 0),
        t: 0,
        g,
        outcome,
      });
    };

    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;
      const nowMs = ts;
      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const rtl = rtRef.current;
      const lead = sortedRef.current[0];

      // Puck beim Führenden (Nose + 5).
      const el = puckRef.current;
      if (el && lead && !frozen) {
        el.setAttribute("cx", String(fracX(lead.animScore) + (lead.isOwn ? geo.rOwn : geo.r) + 5));
        el.setAttribute("cy", String(laneY(lead.idx)));
      }

      if (!frozen && !reduce && fxRef.current && shots.length < 6) {
        // LAUFENDES Schießen (nicht nur bei Reveals): im Rhythmus feuert ein Team auf das Tor,
        // Ausgang Tor/Save zufällig — stärkere (weiter rechts) treffen etwas häufiger. So gibt es
        // ständig Action: Schuss → Save oder Tor. Reveals feuern zusätzlich einen Extra-Schuss.
        shotAcc += dt;
        if (shotAcc > 620 && rtl.length > 0) {
          shotAcc = 0;
          const shooter = rtl[Math.floor(Math.random() * rtl.length)]!;
          const chance = 0.4 + 0.4 * (finalMax > 0 ? Math.min(1, shooter.animScore / finalMax) : 0);
          fireShot(shooter, Math.random() < chance ? "goal" : "save");
        }
        for (const t of rtl) {
          const prev = prevScore.get(t.idx);
          prevScore.set(t.idx, t.displayScore);
          if (prev == null) continue;
          if (t.displayScore - prev > 0.4) fireShot(t, "goal"); // Reveal-Zugewinn = sicherer Treffer
        }
      } else {
        for (const t of rtl) prevScore.set(t.idx, t.displayScore);
      }

      // Fliegende Pucks integrieren + Einschlag (Tor → Torlicht, Save → Fanghandschuh).
      for (let i = shots.length - 1; i >= 0; i -= 1) {
        const s = shots[i]!;
        if (!frozen) s.t += dt / 320; // ~320ms Flugzeit
        const k = s.t < 1 ? s.t : 1;
        const cx = s.x + (s.tx - s.x) * k;
        const cy = s.y + (s.ty - s.y) * k - Math.sin(k * Math.PI) * 26; // leichter Bogen
        const ell = s.g.lastChild as SVGEllipseElement | null;
        const ln = s.g.firstChild as SVGLineElement | null;
        if (ell) {
          ell.setAttribute("cx", String(cx));
          ell.setAttribute("cy", String(cy));
        }
        if (ln) {
          ln.setAttribute("x1", String(cx - (s.tx - s.x) * 0.05));
          ln.setAttribute("y1", String(cy));
          ln.setAttribute("x2", String(cx));
          ln.setAttribute("y2", String(cy));
        }
        if (s.t >= 1) {
          if (s.g.parentNode) s.g.parentNode.removeChild(s.g);
          shots.splice(i, 1);
          if (s.outcome === "goal") lightUntil = nowMs + 620; // TOR → Torlicht an
          else saveUntil = nowMs + 300; // SAVE → Goalie-Fanghandschuh
        }
      }

      // Torlicht-Flash (Tor).
      const gl = goalLightRef.current;
      if (gl) {
        if (nowMs < lightUntil) {
          const pulse = 0.55 + 0.45 * Math.abs(Math.sin(nowMs * 0.02));
          gl.setAttribute("fill", "#ff3b3b");
          gl.style.filter = `drop-shadow(0 0 ${(6 + pulse * 8).toFixed(1)}px rgba(255,60,60,${pulse.toFixed(2)}))`;
        } else {
          gl.setAttribute("fill", "#4d1717");
          gl.style.filter = "none";
        }
      }

      // Beweglicher Goalie: folgt dem Führenden weich, bleibt vor dem rechten Tor.
      const targetGoalieY = lead && !frozen ? laneY(lead.idx) : goalieY;
      goalieY += (targetGoalieY - goalieY) * 0.02;
      goalieCur += (goalieY - goalieCur) * 0.12;
      const gk = goalieRef.current;
      if (gk) {
        const clampedY = Math.max(228, Math.min(292, goalieCur));
        // Save-Reaktion: kurzer Fanghandschuh-Pop (heller + leichter Ausfall zur Seite).
        const saving = nowMs < saveUntil;
        gk.setAttribute("transform", `translate(${GR + 27} ${clampedY})${saving ? " scale(1.18)" : ""}`);
        gk.style.filter = saving ? "drop-shadow(0 0 5px rgba(220,235,255,.9))" : "none";
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const s of shots) if (s.g.parentNode) s.g.parentNode.removeChild(s.g);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Benchmark-Bewegung + Ghost: Token folgen animScore (Frame-Sync mit Rangliste,
  // Hover/Pause friert ein). Lokale tokenPos bildet das Rink-Layout (x = Vorstoß ∝ Score,
  // y = feste Bahn je Team) im Mockup-Raum ab — so bleibt das Eis-Feld-Bild unverändert
  // und Ghost + Token teilen dieselbe Choreografie. Siehe benchmark.tsx.
  const tokenPos = (t: RT, score: number): { x: number; y: number } => ({ x: fracX(score), y: laneY(t.idx) });
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos });

  return (
    <g transform={`translate(${sceneTX} ${sceneTY}) scale(${sceneS})`}>
      {/* Voll-Bleed-Hallenhintergrund über die ECHTE viewBox (Ecken außerhalb des Rinks). */}
      <rect x={-sceneTX / sceneS} y={-sceneTY / sceneS} width={W / sceneS} height={H / sceneS} fill="#0d1219" />
      {/* Defs für Eis-Gradient, Kratzer-Pattern, Clippath, und Team-Clippath */}
      <defs>
        <linearGradient id="iceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f9fd" />
          <stop offset="100%" stopColor="#d3e2ef" />
        </linearGradient>
        <pattern id="scratches" width="150" height="96" patternUnits="userSpaceOnUse">
          <path d="M10 88 L60 8" stroke="rgba(110,145,180,.10)" strokeWidth="1" />
          <path d="M76 92 L138 20" stroke="rgba(110,145,180,.07)" strokeWidth="1" />
          <path d="M28 30 L128 66" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
        </pattern>
        <clipPath id="rc">
          <rect x="10" y="12" width="800" height="496" rx="92" />
        </clipPath>
        {/* Team logo clippath circles */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {/* Boards (outside frame) — dark background */}
      <rect x="2" y="4" width="816" height="512" rx="99" fill="#1b242f" />

      {/* Ice surface */}
      <rect x="10" y="12" width="800" height="496" rx="92" fill="url(#iceGrad)" />

      {/* Scratches + light inside the ice (clipped) */}
      <g clipPath="url(#rc)">
        <rect x="10" y="12" width="800" height="496" fill="url(#scratches)" />
        <ellipse cx={CX} cy="236" rx="360" ry="200" fill="rgba(255,255,255,.38)" />

        {/* Blue lines */}
        <rect x={BLa - 5} y="12" width="10" height="496" fill="#2f6fc0" opacity=".72" />
        <rect x={BLb - 5} y="12" width="10" height="496" fill="#2f6fc0" opacity=".72" />

        {/* Center line (red) */}
        <rect x={CX - 3} y="12" width="6" height="496" fill="#d8404a" opacity=".78" />

        {/* Goal lines */}
        <rect x={GL - 1.5} y="12" width="3" height="496" fill="#d8404a" opacity=".6" />
        <rect x={GR - 1.5} y="12" width="3" height="496" fill="#d8404a" opacity=".6" />

        {/* Center circle */}
        <circle cx={CX} cy={CY} r="58" fill="none" stroke="#2f6fc0" strokeWidth="2.4" opacity=".8" />
        <circle cx={CX} cy={CY} r="5" fill="#2f6fc0" opacity=".85" />

        {/* Face-off circles (4 circles) */}
        {[
          { cx: 178, cy: 140 },
          { cx: 178, cy: 380 },
          { cx: LW - 178, cy: 140 },
          { cx: LW - 178, cy: 380 },
        ].map((foc, i) => (
          <g key={`foc-${i}`}>
            <circle cx={foc.cx} cy={foc.cy} r="44" fill="none" stroke="#d8404a" strokeWidth="1.6" opacity=".65" />
            <circle cx={foc.cx} cy={foc.cy} r="4" fill="#d8404a" opacity=".75" />
          </g>
        ))}

        {/* Goal creases (D-shaped) */}
        <path d={`M ${GL} 224 A 36 36 0 0 1 ${GL} 296 Z`} fill="rgba(47,111,192,.16)" stroke="#d8404a" strokeWidth="1.5" />
        <path d={`M ${GR} 224 A 36 36 0 0 0 ${GR} 296 Z`} fill="rgba(47,111,192,.16)" stroke="#d8404a" strokeWidth="1.5" />
      </g>

      {/* Goal nets (outside clipped area so they're visible) */}
      <rect x={GL - 24} y="236" width="22" height="48" rx="4" fill="#141b24" stroke="#8fa3b8" strokeWidth="1.5" />
      <path
        d={`M ${GL - 17} 238 V 282 M ${GL - 10} 238 V 282 M ${GL - 22} 251 H ${GL - 2} M ${GL - 22} 266 H ${GL - 2}`}
        stroke="rgba(160,180,200,.4)"
        strokeWidth="1"
      />
      <rect x={GR + 2} y="236" width="22" height="48" rx="4" fill="#141b24" stroke="#8fa3b8" strokeWidth="1.5" />
      <path
        d={`M ${GR + 9} 238 V 282 M ${GR + 16} 238 V 282 M ${GR + 4} 251 H ${GR + 24} M ${GR + 4} 266 H ${GR + 24}`}
        stroke="rgba(160,180,200,.4)"
        strokeWidth="1"
      />

      {/* Boards frame */}
      <rect x="10" y="12" width="800" height="496" rx="92" fill="none" stroke="#93a9bd" strokeWidth="2.5" />

      {/* Kick-line (golden) */}
      <rect x="14" y="16" width="792" height="488" rx="88" fill="none" stroke="rgba(240,205,90,.38)" strokeWidth="3" />

      {/* Goal Light (top-right corner) — flasht via rAF bei jedem Treffer (Torlicht). */}
      <circle ref={goalLightRef} cx={GR + 27} cy="204" r="6.5" fill="#4d1717" stroke="#2c3a49" strokeWidth="2" pointerEvents="none" />

      {/* Goalie — folgt via rAF weich der Bahn des Führenden (beweglich, kein Statist). */}
      <g ref={goalieRef} transform={`translate(${GR + 27} 260)`}>
        <rect x="-10" y="-15" width="20" height="30" rx="7" ry="5" fill="#e9eef4" stroke="#55636f" strokeWidth="1.5" />
        <circle cx="0" cy="-17" r="6" fill="#39434f" />
        <rect x="-3" y="8" width="6" height="15" rx="3" fill="#8fa3b8" stroke="#55636f" strokeWidth="1" />
      </g>

      {/* Discipline Watermark */}
      {disciplineName ? (
        <text x="18" y="30" fontSize="19" fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity="0.95" style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Tokens. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: SVG groups — Position via rAF (animScore, Benchmark-Sync). */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = t.isOwn ? geo.rOwn : geo.r;
          const glowing = t.glowUntil > now;

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
              {/* Glow (if glowing) */}
              {glowing ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={4}
                  style={{
                    animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite",
                  }}
                />
              ) : null}

              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Rink trägt seine eigene 🏆-Krone. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />

              {/* Champion crown */}
              {t.rank === 1 ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}
            </g>
          );
        })}

      {/* Puck (folgt dem Führenden) — NACH den Tokens (z-Order, sonst unter dem Icon) und
          neben ihm platziert; Position via rAF (animScore), friert bei Hover/Pause ein. */}
      <ellipse
        ref={puckRef}
        cx={leader ? fracX(leader.animScore) + (leader.isOwn ? geo.rOwn : geo.r) + 5 : CX}
        cy={leader ? laneY(leader.idx) : CY}
        rx="5.5"
        ry="3.5"
        fill="#0c0e11"
        stroke="#39434f"
        strokeWidth="1"
        style={{
          pointerEvents: "none",
          filter: "drop-shadow(0 1px 2px rgba(8,16,30,.5)) drop-shadow(0 0 7px rgba(87,177,255,.35))",
        }}
      />

      {/* Fliegende Schuss-Pucks (Reveal-Treffer → Torraum) — imperativ via rAF befüllt. */}
      <g ref={fxRef} pointerEvents="none" />

      <style>{`
        @keyframes olyGlowPulse {
          0%, 100% {
            opacity: 0.6;
            filter: drop-shadow(0 0 4px currentColor);
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 8px currentColor);
          }
        }
      `}</style>
    </g>
  );
}
