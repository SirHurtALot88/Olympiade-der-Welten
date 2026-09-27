// =====================================================================================
// breaking (Breaking Point · Gauntlet) — BESPOKE, ersetzt das Thermometer-Artwork.
//
// WICHTIG (s. CLAUDE.md "Breaking ist Folter, nicht Breakdance — nicht mehr nachfragen"):
// Breaking ist ein Folter-/Survival-Zweikampf (Slap-Fighting/Kendo-Kachinuki-Vokabular),
// KEIN Breakdance-Battle. Chris am 13.09., woertlich: „breaking NICHT breakdance ist sondern
// ein foltern!!!! […] einer schmerz zufuegt der andere muss es aushalten dann ist wieder der
// andere dran bis einer aufgibt." Diese Datei trug bis zum 27.09. trotzdem DJ-Pult, Boombox,
// Lautsprechertuerme, eine "Battle-Bracket"-Leiste und den Titel "Survival-Cypher" — reine
// Breakdance-Ikonografie, die der Motor (battle-mode.engine.js, zeichneBreaking()/
// stepCypher()) nie hatte. Der Motor spricht seit dem Gauntlet-Umbau (22.09.) von PEINIGT/
// ERTRAeGT, einer FOLTERBANK mit zehn eskalierenden Geraeten (FOLTER_GERAETE/folterStufe())
// und nennt das Format schlicht "Gauntlet" (s. dortiger UI-Text "Gauntlet, X gegen X"). Der
// 27.09.-Fix entfernt die Breakdance-Requisiten aus dieser Datei und uebernimmt stattdessen
// den Motor-Wortschatz, statt eine eigene, abweichende Bildsprache zu erfinden.
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
//   1. Druck-Boden: ein Beton-Kreis mit Nahtlinien statt eines reinen Verlaufs.
//   2. [27.09. ENTFERNT] DJ-Pult/Boombox/Lautsprecher am Rand — Breakdance-Requisite ohne
//      Entsprechung im Motor. Ersetzt durch dieselbe FOLTERBANK-Sprache wie
//      battle-mode.engine.js's zeichneBreaking(): eine kleine Geraete-/Stufen-Anzeige.
//   3. [27.09. UMBENANNT] "Battle-Bracket-Leiste" (Paarung benachbarter Raenge, K.-o.-Format-
//      Framing) → GAUNTLET-Stufenanzeige oben: zeigt "GAUNTLET" + "STUFE n/m" (dieselbe
//      Eskalations-Idee wie folterStufe() im Motor), keine erfundene Turnierklammer mehr.
//   4. [27.09. UMBENANNT] Druck-Puls auf ein festes Zeitraster (BREAKING_BPM, dieselbe Zahl
//      wie battle-mode.engine.js's stepCypher()/zeichneBreaking() — s. Kommentar dort). Der
//      Name BREAKING_BPM bleibt (Motor-Parität, s. dortiger Kommentar), gemeint ist aber ein
//      Druck-/Belastungs-Puls, keine Musik — die alte Prosa sprach faelschlich von einem
//      "Beat", das ist hier bewusst korrigiert.
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
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome, tokenRadius } from "./benchmark";

// BREAKING_BPM (s. battle-mode.engine.js, direkt vor BUEHNE_ART): EINE Zahl, aus der
// Bewegung (Motor-Wippen), Bild-Puls (hier UND der Motor-Kern-Puls) und Ton (TON_KATALOG.
// breaking, reine Kampf-SFX — kein Musikstueck) dieselbe Zeitbasis ziehen. Zwei getrennte
// Laufzeiten (React hier, Canvas dort) können dieselbe Konstante nur SPIEGELN, nicht TEILEN
// — deshalb hier noch einmal explizit benannt statt eines "irgendwie ähnlichen" Werts. Der
// Name BPM ist Motor-Parität (battle-mode.engine.js nennt die Konstante identisch), gemeint
// ist ein Druck-/Belastungs-Puls wie ein beschleunigter Herzschlag unter Folter, kein
// Tanz-Beat.
const BREAKING_BPM = 100;
const PULS_S = 60 / BREAKING_BPM;
// Druckwelle: eine 4-Takt-Phase (bei BREAKING_BPM=100 = 2,4s, vorher frei gewählte 2,6s).
const PULSE_DUR = `${(PULS_S * 4).toFixed(2)}s`;
// Survivor-Kern-Ring: eine 2-Takt-Atem-Phase (1,2s, vorher frei gewählte 1,6s).
const CORE_BREATH_DUR = `${(PULS_S * 2).toFixed(2)}s`;

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

  // ---- Gauntlet-Geometrie: außen = frisch gebrochen, Zentrum = Survivor ------------------
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

  // GAUNTLET-Stufenanzeige (27.09., ersetzt die Battle-Bracket-Paarung): kein erfundenes
  // K.-o.-Klammer-Framing mehr, sondern dieselbe Eskalations-Idee wie battle-mode.engine.js's
  // folterStufe() — Runde/Gesamtrunden → eine Stufenzahl, die mit fortschreitendem Spiel
  // steigt. Der Motor selbst nennt das Format "Gauntlet" (s. dortiger UI-Text "Gauntlet, X
  // gegen X"), deshalb hier derselbe Titel statt eines neu erfundenen Namens.
  const stufenAnzeige = typeof round === "number" && typeof slotCount === "number" && slotCount > 0 ? `STUFE ${Math.min(round + 1, slotCount)}/${slotCount}` : null;

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
        {/* Beton-Bodenverlauf fuer den Druck-Kreis (Plan 7.3, Punkt 1) -- ein Hauch
            heller/waermer als der Buehnen-Hintergrund, damit der Ring als eigene Flaeche
            (der Arena-Boden, auf dem der Druck lastet) lesbar wird statt nur als weiterer
            Farbverlauf. */}
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

      {/* DRUCK-BODEN (Plan 7.3, Punkt 1): Beton-Kreis mit Nahtlinien statt reinem
          Verlauf -- eine echte Arena-Flaeche, kein bloss eingefaerbter Ausschnitt des
          Buehnenhintergrunds. Nahtlinien = sechs Sehnen ueber den ganzen Kreis (wie echte
          Beton-/Plattenfugen), plus eine Aussenkontur. Rein dekorativ, unter den
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
          gerastert (4-Takt-Phase) statt einer frei gewaehlten Sekundenzahl. Ein Belastungs-
          Puls, kein Musik-Beat -- s. Funktionskopf. */}
      {!reducedMotion ? (
        <ellipse cx={cx} cy={cy} rx={rIn} ry={rIn * KY} fill="none" stroke="rgba(214,150,255,.5)" strokeWidth={2} pointerEvents="none">
          <animate attributeName="rx" values={`${rIn};${rOut}`} dur={PULSE_DUR} repeatCount="indefinite" />
          <animate attributeName="ry" values={`${rIn * KY};${rOut * KY}`} dur={PULSE_DUR} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur={PULSE_DUR} repeatCount="indefinite" />
        </ellipse>
      ) : null}

      {/* FOLTERBANK-SILHOUETTE (27.09., ersetzt DJ-Pult/Boombox/Lautsprecher, s.
          Funktionskopf): dieselbe Rand-Kulisse wie zuvor, aber aus dem Motor-Wortschatz
          (FOLTER_GERAETE/FOLTERBANK in battle-mode.engine.js's zeichneBreaking()) statt aus
          einem DJ-Setup. Eine schlichte Bank mit zwei Fessel-Ringen unten mittig, ein
          Gluteisen darueber (FOLTER_GLUT-Farbe), zwei Feuerschalen symmetrisch daneben statt
          Lautsprechertuermen. Rein dekorativ, keine Interaktion. */}
      <g pointerEvents="none" opacity={0.92}>
        {/* Folterbank: Tischplatte + Stuetzbeine + zwei Fessel-Ringe */}
        <rect x={cx - 46} y={H - 46} width={92} height={14} rx={3} fill="#241a1a" stroke="rgba(255,140,110,.35)" strokeWidth={1.2} />
        <rect x={cx - 40} y={H - 32} width={6} height={22} fill="#241a1a" />
        <rect x={cx + 34} y={H - 32} width={6} height={22} fill="#241a1a" />
        <circle cx={cx - 24} cy={H - 39} r={6} fill="none" stroke="#aab4c4" strokeWidth={2.2} />
        <circle cx={cx + 24} cy={H - 39} r={6} fill="none" stroke="#aab4c4" strokeWidth={2.2} />
        {/* Gluteisen mittig ueber der Bank */}
        <rect x={cx - 3} y={H - 62} width={6} height={17} rx={2} fill="#ff6a2a" opacity={0.85} />
        {/* Feuerschalen links/rechts statt Lautsprechertuermen */}
        {[cx - 150, cx + 150].map((sx, i) => (
          <g key={`brazier-${i}`}>
            <rect x={sx - 3} y={H - 40} width={6} height={20} fill="#3a2a1e" />
            <ellipse cx={sx} cy={H - 44} rx={9} ry={5} fill="#3a2a1e" stroke="rgba(255,140,110,.4)" strokeWidth={1} />
            <ellipse cx={sx} cy={H - 47} rx={5} ry={4} fill="#ff6a2a" opacity={0.75} />
          </g>
        ))}
      </g>

      {/* GAUNTLET-STUFENANZEIGE (27.09., ersetzt die Battle-Bracket-Leiste, s.
          Funktionskopf): Titel + Eskalationsstufe statt einer erfundenen Turnierklammer.
          "Gauntlet" ist der Name, den der Motor selbst fuer dieses Format benutzt
          (battle-mode.engine.js, UI-Text "Gauntlet, X gegen X"). Oben, ueber den Zonen. */}
      {stufenAnzeige ? (
        <g pointerEvents="none">
          <text x={cx} y={16} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={10} fontWeight={800} letterSpacing={1.5} fill="var(--nl-warn)">
            GAUNTLET
          </text>
          <text x={cx} y={29} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize={9} letterSpacing={0.6} fill="rgba(214,170,255,.6)">
            {stufenAnzeige}
          </text>
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
