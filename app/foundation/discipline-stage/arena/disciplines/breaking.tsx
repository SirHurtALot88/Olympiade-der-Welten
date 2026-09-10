// =====================================================================================
// breaking (Breaking Point · Survival-Cypher) — BESPOKE, ersetzt das Thermometer-Artwork.
//
// Konzept (Nutzer-Wunsch): lila Druck-Arena, in der alle Teams von außen NACH INNEN rücken.
// Wer am wenigsten „bricht" (höchster Score = am längsten UNBROKEN), steht am nächsten am
// Zentrum — dem SURVIVOR-Spotlight. Radius = Nähe zum Zentrum ∝ Score (score/finalMax →
// Vorstoß über die vollen Runden), Winkel = feste Team-Lane (Nachbarn bleiben lesbar).
// Score bleibt Wahrheit (animScore-Glide + Ghost). Druckwellen + Risse als Survival-FX.
// Benchmark-Chrome (Medaille/Team-Rahmen/Rang-Badge) wie überall.
//
// ZIEL 4 (Opus-Plan "opus-plan-feinschliff-vier-disziplinen-09-10.md" Abschnitt 7.3, A1
// 20→30): vier Ergänzungen, alle rein dekorativ — keine Änderung an `tokenPos`/`angOf`
// (die Positions-/Score-Logik ist unverändert die Wahrheit des Hosts):
//   1. Cypher-Boden: ein Linoleum-Kreis mit Nahtlinien statt eines reinen Verlaufs.
//   2. DJ-Pult/Boombox/Lautsprecher am Rand — die Kulisse, die die Disziplin benennt.
//   3. Battle-Bracket-Leiste oben ("wer gegen wen, welche Runde") — Breaking ist ein
//      K.-o.-Format, das bis hierhin nirgends sichtbar war. Paart benachbarte Ränge aus
//      `sorted` (derselben Ladder-Reihenfolge, die der Host ohnehin führt) — eine
//      Näherung an eine echte Turnierklammer ohne neue Datenquelle.
//   4. Beat-Puls auf ein festes BPM-Raster (BREAKING_BPM, dieselbe Zahl wie
//      battle-mode.engine.js's stepCypher()/zeichneBreaking() — s. Kommentar dort) statt
//      einer frei gewählten Sekundenzahl.
//   5. Etiketten-Kollision (Sicht-QA 10.09.: die vier Zonen-Etiketten standen mittig über
//      dem Ring und kollidierten mit Tokens, weil `angOf`s 13er-Schritt auch exakt auf die
//      12-Uhr-Achse fallen kann): Zonen-Etiketten jetzt NUR bei Hover über den Ring sichtbar
//      statt dauerhaft eingeblendet — die Ringe selbst (Kontur) bleiben immer da.
//
// Host bleibt WAHRHEIT: Score/Reveal/Ladder/Ticker/Hover/Pops kommen vom Host; diese Datei
// rendert nur die Feldkunst + on-Feld-FX.
// =====================================================================================
"use client";

import { useState, type ReactNode } from "react";
import type { DisciplineFieldProps, RT } from "./types";
import { clamp } from "@/lib/foundation/foundation-number-utils";
import { teamPrimaryColor } from "@/lib/foundation/team-colors";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome, tokenRadius } from "./benchmark";

// BREAKING_BPM (s. battle-mode.engine.js, direkt vor BUEHNE_ART): EINE Zahl, aus der
// Bewegung (Motor-Wippen), Bild-Puls (hier UND der Motor-Kern-Puls) und Ton (TON_KATALOG.
// breaking) dieselbe Zeitbasis ziehen. Zwei getrennte Laufzeiten (React hier, Canvas dort)
// können dieselbe Konstante nur SPIEGELN, nicht TEILEN — deshalb hier noch einmal explizit
// benannt statt eines "irgendwie ähnlichen" Werts.
const BREAKING_BPM = 100;
const BEAT_S = 60 / BREAKING_BPM;
// Druckwelle: eine 4-Schlag-Phrase (bei 100 BPM = 2,4s, vorher frei gewählte 2,6s).
const PULSE_DUR = `${(BEAT_S * 4).toFixed(2)}s`;
// Survivor-Kern-Ring: ein 2-Schlag-Atem (1,2s, vorher frei gewählte 1,6s).
const CORE_BREATH_DUR = `${(BEAT_S * 2).toFixed(2)}s`;

export default function BreakingField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    reducedMotion,
    W,
    H,
    N,
    geo,
    finalMax,
    rt,
    sorted,
    round,
    slotCount,
    done,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);
  // Zonen-Etiketten nur bei Hover ueber den Ring (Plan 7.3, Punkt 5) -- die Ringkontur
  // selbst bleibt immer sichtbar, nur der TEXT (der mit Tokens kollidierte) blendet sich
  // ein/aus. Ein einzelner Hover-Zustand statt vier (pro Zone) reicht: die vier Zonen
  // gehoeren optisch zusammen, es geht um "zeig mir, was die Ringe bedeuten", nicht um
  // eine pro-Ring-Erklaerung.
  const [zonenHover, setZonenHover] = useState(false);

  // ---- Cypher-Geometrie: außen = frisch gebrochen, Zentrum = Survivor ------------------
  const cx = W / 2;
  const cy = H / 2 + 8;
  const rOut = Math.min(W * 0.46, H * 0.44);
  const rIn = rOut * 0.14; // Survivor-Kern
  const KY = 0.82; // leichte Stauchung (Bühnen-Perspektive)

  // Fortschritt = ABSOLUT (score/finalMax) → Vorstoß nach innen zieht sich über die Runden.
  const normOf = (s: number): number => (finalMax > 0 ? clamp(s / finalMax, 0, 1) : 0);

  // lokale tokenPos: Radius = Nähe zum Zentrum ∝ Score, Winkel = feste Lane (13er-Schritt
  // gegen Klumpen), leichte y-Stauchung. Zentrum = Survivor. UNVERAENDERT (Ziel 4 fasst die
  // Positionslogik nicht an, s. Funktionskopf).
  const angOf = (t: RT): number => (((t.laneIdx * 13) % Math.max(1, N)) / Math.max(1, N)) * Math.PI * 2 - Math.PI / 2;
  const tokenPos = (t: RT, score: number): { x: number; y: number } => {
    const radius = rOut - normOf(score) * (rOut - rIn);
    const a = angOf(t);
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius * KY };
  };

  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos });

  // Druck-Zonen (Ringe) von außen nach innen — pain/survival-Vokabular.
  const zones = [
    { f: 1.0, label: "GEBROCHEN" },
    { f: 0.72, label: "SCHMERZGRENZE" },
    { f: 0.46, label: "STONE FACE" },
    { f: 0.22, label: "MIND FORTRESS" },
  ];

  // Battle-Bracket (Plan 7.3, Punkt 3): benachbarte Ränge aus `sorted` gepaart — Rang 1
  // gegen Rang 2, Rang 3 gegen Rang 4, usw. Auf vier Paare begrenzt (grosse Felder blieben
  // sonst unlesbar); ungerade Restgrösse (kein Partner mehr) wird einfach ausgelassen.
  const bracketPaare: Array<[RT, RT]> = [];
  for (let i = 0; i + 1 < sorted.length && bracketPaare.length < 4; i += 2) {
    bracketPaare.push([sorted[i]!, sorted[i + 1]!]);
  }
  const rundeAnzeige = typeof round === "number" && typeof slotCount === "number" && slotCount > 0 ? `RUNDE ${Math.min(round + 1, slotCount)}/${slotCount}` : null;

  return (
    <>
      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={tokenRadius(t, geo)} />
            </clipPath>
          ) : null,
        )}
        {/* Lila Bühnen-Hintergrund mit Zentrum-Glut */}
        <radialGradient id="brkBg" cx="50%" cy="52%" r="62%">
          <stop offset="0%" stopColor="hsl(275 55% 22%)" />
          <stop offset="55%" stopColor="hsl(278 50% 13%)" />
          <stop offset="100%" stopColor="hsl(280 45% 7%)" />
        </radialGradient>
        <radialGradient id="brkCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(214,150,255,.5)" />
          <stop offset="100%" stopColor="rgba(214,150,255,0)" />
        </radialGradient>
        {/* Linoleum-Bodenverlauf fuer den Cypher-Kreis (Plan 7.3, Punkt 1) -- ein Hauch
            heller/waermer als der Buehnen-Hintergrund, damit der Ring als eigene Flaeche
            (ein Tanzboden) lesbar wird statt nur als weiterer Farbverlauf. */}
        <radialGradient id="brkFloor" cx="50%" cy="46%" r="58%">
          <stop offset="0%" stopColor="hsl(276 32% 19%)" />
          <stop offset="70%" stopColor="hsl(277 34% 15%)" />
          <stop offset="100%" stopColor="hsl(278 38% 11%)" />
        </radialGradient>
      </defs>

      {/* Bühne */}
      <rect x={0} y={0} width={W} height={H} fill="url(#brkBg)" />

      {/* Spotlight-Kegel von oben (zwei) */}
      <polygon points={`${cx - 40},0 ${cx - rOut * 0.5},${cy} ${cx + rOut * 0.2},${cy}`} fill="rgba(214,150,255,.05)" />
      <polygon points={`${cx + 40},0 ${cx - rOut * 0.2},${cy} ${cx + rOut * 0.5},${cy}`} fill="rgba(160,210,255,.045)" />

      {/* CYPHER-BODEN (Plan 7.3, Punkt 1): Linoleum-Kreis mit Nahtlinien statt reinem
          Verlauf -- ein echter Tanzboden, kein bloss eingefaerbter Ausschnitt des
          Buehnenhintergrunds. Nahtlinien = sechs Sehnen ueber den ganzen Kreis (wie echte
          Bahnen-/Plattenstoesse), plus eine Aussenkontur. Rein dekorativ, unter den
          Druck-Ringen/Rissen/Tokens gezeichnet. */}
      <ellipse cx={cx} cy={cy} rx={rOut} ry={rOut * KY} fill="url(#brkFloor)" opacity={0.9} pointerEvents="none" />
      <ellipse cx={cx} cy={cy} rx={rOut} ry={rOut * KY} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={2} pointerEvents="none" />
      <g stroke="rgba(0,0,0,.22)" strokeWidth={1} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI;
          const x1 = cx + Math.cos(a) * rOut,
            y1 = cy + Math.sin(a) * rOut * KY;
          const x2 = cx - Math.cos(a) * rOut,
            y2 = cy - Math.sin(a) * rOut * KY;
          return <line key={`naht-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      {/* Druck-Zonen-Ringe (außen = gebrochen → innen = unbroken). Kontur immer sichtbar;
          die TEXT-Etiketten (Kollisionsquelle im Sicht-QA) nur bei Hover ueber den Ring --
          eine unsichtbare Hover-Flaeche pro Zone deckt genau den Ring ab. */}
      {zones.map((z, i) => {
        const rr = rIn + (rOut - rIn) * z.f;
        const rrInner = i + 1 < zones.length ? rIn + (rOut - rIn) * zones[i + 1]!.f : 0;
        return (
          <g key={`zone-${i}`}>
            <ellipse cx={cx} cy={cy} rx={rr} ry={rr * KY} fill="none" stroke="rgba(214,150,255,.16)" strokeWidth={1.2} strokeDasharray="4 8" pointerEvents="none" />
            {/* Hover-Ring: transparenter, KY-gestauchter Ellipsenring zwischen dieser und
                der naechst-inneren Zone (dieselbe Stauchung wie die sichtbare Zone selbst
                -- ein Kreis wuerde am Rand deutlich neben dem tatsaechlichen Ring liegen),
                real interaktiv (sonst laesst sich der Ring gar nicht anvisieren). */}
            <ellipse
              cx={cx}
              cy={cy}
              rx={(rr + rrInner) / 2}
              ry={((rr + rrInner) / 2) * KY}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(8, rr - rrInner)}
              style={{ cursor: "default" }}
              onMouseEnter={() => setZonenHover(true)}
              onMouseLeave={() => setZonenHover(false)}
            />
            <text
              x={cx}
              y={cy - rr * KY - 3}
              textAnchor="middle"
              fontFamily="ui-monospace, Menlo, monospace"
              fontSize={8}
              fontWeight={800}
              letterSpacing={1.5}
              fill="rgba(214,170,255,.5)"
              opacity={zonenHover ? 1 : 0}
              style={{ transition: "opacity .15s ease", pointerEvents: "none" }}
            >
              {z.label}
            </text>
          </g>
        );
      })}

      {/* Boden-Risse (Druck) — vom Zentrum nach außen, deterministisch */}
      <g stroke="rgba(0,0,0,.35)" strokeWidth={1.4} pointerEvents="none">
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 9) * Math.PI * 2 + 0.4;
          const r1 = rIn + 6;
          const r2 = rOut * (0.6 + ((i * 37) % 40) / 100);
          const mx = cx + Math.cos(a) * (r1 + r2) * 0.5 + (((i * 53) % 20) - 10);
          const my = cy + Math.sin(a) * (r1 + r2) * 0.5 * KY;
          return <path key={`crack-${i}`} d={`M ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1 * KY} Q ${mx} ${my} ${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2 * KY}`} fill="none" />;
        })}
      </g>

      {/* Survivor-Kern (Zentrum) */}
      <ellipse cx={cx} cy={cy} rx={rIn * 2.4} ry={rIn * 2.4 * KY} fill="url(#brkCore)" pointerEvents="none" />
      <ellipse cx={cx} cy={cy} rx={rIn} ry={rIn * KY} fill="none" stroke="var(--nl-warn)" strokeWidth={1.6} strokeDasharray="6 5" pointerEvents="none">
        {!reducedMotion ? <animate attributeName="opacity" values="0.5;1;0.5" dur={CORE_BREATH_DUR} repeatCount="indefinite" /> : null}
      </ellipse>
      <text x={cx} y={cy - rIn * KY - 8} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} fontWeight={900} letterSpacing={2} fill="var(--nl-warn)" pointerEvents="none">
        SURVIVOR · UNBROKEN
      </text>

      {/* Druckwelle vom Zentrum (Survival-Puls) — Plan 7.3, Punkt 4: auf BREAKING_BPM
          gerastert (4-Schlag-Phrase) statt einer frei gewaehlten Sekundenzahl. */}
      {!reducedMotion ? (
        <ellipse cx={cx} cy={cy} rx={rIn} ry={rIn * KY} fill="none" stroke="rgba(214,150,255,.5)" strokeWidth={2} pointerEvents="none">
          <animate attributeName="rx" values={`${rIn};${rOut}`} dur={PULSE_DUR} repeatCount="indefinite" />
          <animate attributeName="ry" values={`${rIn * KY};${rOut * KY}`} dur={PULSE_DUR} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur={PULSE_DUR} repeatCount="indefinite" />
        </ellipse>
      ) : null}

      {/* DJ-PULT / BOOMBOX / LAUTSPRECHER (Plan 7.3, Punkt 2) -- die Kulisse, die die
          Disziplin benennt. Unten mittig (im Abstand unter dem Ring, W=1180/H=600 lassen
          dort ~76px Luft), zwei Lautsprechertuerme symmetrisch daneben. Rein dekorativ,
          keine Interaktion. */}
      <g pointerEvents="none" opacity={0.92}>
        {/* DJ-Pult: Tisch + zwei Plattenteller + Mixer-Steg */}
        <rect x={cx - 46} y={H - 54} width={92} height={30} rx={4} fill="#241a30" stroke="rgba(214,170,255,.35)" strokeWidth={1.2} />
        <circle cx={cx - 24} cy={H - 39} r={10} fill="#120c18" stroke="rgba(214,170,255,.5)" strokeWidth={1.4} />
        <circle cx={cx - 24} cy={H - 39} r={3} fill="#f2d75a" />
        <circle cx={cx + 24} cy={H - 39} r={10} fill="#120c18" stroke="rgba(214,170,255,.5)" strokeWidth={1.4} />
        <circle cx={cx + 24} cy={H - 39} r={3} fill="#f2d75a" />
        <rect x={cx - 7} y={H - 46} width={14} height={16} rx={2} fill="#1a1220" stroke="rgba(214,170,255,.4)" strokeWidth={1} />
        {/* Boombox obenauf, mittig */}
        <rect x={cx - 17} y={H - 68} width={34} height={16} rx={3} fill="#2c2136" stroke="rgba(214,170,255,.4)" strokeWidth={1} />
        <circle cx={cx - 9} cy={H - 60} r={4.5} fill="#120c18" />
        <circle cx={cx + 9} cy={H - 60} r={4.5} fill="#120c18" />
        {/* Lautsprechertuerme links/rechts */}
        {[cx - 150, cx + 150].map((sx, i) => (
          <g key={`speaker-${i}`}>
            <rect x={sx - 15} y={H - 74} width={30} height={54} rx={3} fill="#241a30" stroke="rgba(214,170,255,.35)" strokeWidth={1.2} />
            <circle cx={sx} cy={H - 58} r={9} fill="#120c18" stroke="rgba(214,170,255,.4)" strokeWidth={1} />
            <circle cx={sx} cy={H - 34} r={6} fill="#120c18" stroke="rgba(214,170,255,.4)" strokeWidth={1} />
          </g>
        ))}
      </g>

      {/* BATTLE-BRACKET-LEISTE (Plan 7.3, Punkt 3): "wer gegen wen, welche Runde" — Breaking
          ist K.-o.-Format, das war bis hierhin nirgends sichtbar. Oben, ueber den Zonen. */}
      {rundeAnzeige || bracketPaare.length ? (
        <g pointerEvents="none">
          {rundeAnzeige ? (
            <text x={cx} y={16} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={10} fontWeight={800} letterSpacing={1} fill="var(--nl-warn)">
              {rundeAnzeige}
            </text>
          ) : null}
          {bracketPaare.length ? (
            <text x={cx} y={30} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} letterSpacing={0.3}>
              {bracketPaare.map(([a, b], i) => (
                <tspan key={`${a.code}-${b.code}`}>
                  {i > 0 ? <tspan fill="rgba(214,170,255,.35)"> · </tspan> : null}
                  <tspan fill={teamPrimaryColor(a.code)}>{a.code}</tspan>
                  <tspan fill="rgba(214,170,255,.5)">–</tspan>
                  <tspan fill={teamPrimaryColor(b.code)}>{b.code}</tspan>
                </tspan>
              ))}
            </text>
          ) : null}
        </g>
      ) : null}

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill="hsl(275 60% 72%)" opacity={0.9} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost der Vorrunde (Benchmark) — VOR den Token. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: Überlebende — Position via rAF (animScore). Rang-Reihenfolge rückwärts. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = tokenRadius(t, geo);
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
              {/* Führer = Survivor: lila-goldener Puls-Ring. */}
              {isLead ? <circle r={r + 7} fill="none" stroke="var(--nl-warn)" strokeWidth={2.4} opacity={0.85} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.4s ease-in-out infinite" }} /> : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge.
                  trophy={false} — Breaking trägt seine eigene Survivor-Krone. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} />
              {(isLead && done) || isLead ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  👑
                </text>
              ) : null}
            </g>
          );
        })}
    </>
  );
}
