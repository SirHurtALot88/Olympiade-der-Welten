// =====================================================================================
// Gewichtheben · Kraft-Turm — Barbell-Turm mit Gewichts-Achse, Power-Rack-Rahmen,
// und der geforderten Last (goldene Latte). Alle Heber sitzen auf der Latte oder sind
// gerissen auf ihr Endgewicht.
//
// Bewegung: pro Runde Gleit-Animation über 5s (TRACK_ROUND_MS) mit CSS-Transitions
// für Token-Positionen (simultan). Eliminierte Heber zeigen roten Ring, Champion
// bekommt Krone + goldener Glow, Top-3 zeigen Medaillentinge.
// =====================================================================================
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { TRACK_ROUND_MS } from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps, RT } from "./types";
import { TokenChrome, tokenRadius } from "./benchmark";

// IWF-Scheibenfarben (25/20/15/10 kg) statt `hsl(hue…)` nach Team (4.3) — die Teamfarbe
// trägt schon der Token-Rahmen/Logo-Ring (TokenChrome), die Scheiben selbst sind bei einer
// echten Hantel immer dieselbe genormte Farbstaffel, unabhängig davon, wer sie hebt.
const IWF_PLATE_COLORS = ["#c0392b", "#2f6fd1", "#e2c23a", "#3a9450"];

type BarbellState = {
  fromY: number;
  toY: number;
  glideT: number;
};

/**
 * Startpunkt für einen NEUEN Glide: immer die aktuelle Position des Hebers.
 *
 * - Glide läuft noch (`glideT < 1`): die interpolierte Zwischenposition.
 * - Glide ist durch (`glideT >= 1`): das erreichte Ziel `toY` — NICHT das alte `fromY`.
 *
 * Der zweite Fall war der Fehler: zu Beginn jeder Runde wurde `fromY` beibehalten, wodurch
 * der Heber auf seine ursprüngliche Höhe (baseY, also 0 kg) zurücksprang und von dort erneut
 * hochglitt, statt von der bereits gestemmten Last weiterzusteigen. Die Darstellung fing
 * damit jede Runde sichtbar von vorn an.
 */
export function resolveBarbellGlideStart(state: Pick<BarbellState, "fromY" | "toY" | "glideT">): number {
  return state.glideT < 1 ? state.fromY + (state.toY - state.fromY) * state.glideT : state.toY;
}

/**
 * Geforderte Last AN RUNDE `s` (0-basiert) — dieselbe Formel, mit der der Host die Latte
 * je Runde hochzieht (DisciplineStageNativeArena.tsx, `nextBar` im `prim === "barbell"`-
 * Zweig von `advance`/`doOne`). Rein abgeleitet aus `axTop`/`kgMax`/`slotCount`, die das
 * Feld ohnehin schon bekommt — KEIN neuer Datenpfad, nur dieselbe Formel ein zweites Mal
 * gelesen, um die Drei-Versuche-Tafel (s. `barbellAttemptStatus`) für VERGANGENE Runden
 * zu rekonstruieren, die der Host selbst nicht mehr vorhält.
 */
export function barbellDemandAtRound(s: number, axTop: number, kgMax: number, slotCount: number): number {
  return s + 1 >= slotCount ? kgMax : axTop + (kgMax - axTop) * ((s + 1) / slotCount);
}

/**
 * Erste Runde (0-basiert), an der ein Team mit Endgewicht `endKg` die geforderte Last
 * NICHT mehr packt — `slotCount`, wenn es (Champion-Kandidat) nie reißt.
 */
function barbellFirstFailRound(endKg: number, axTop: number, kgMax: number, slotCount: number): number {
  for (let s = 0; s < slotCount; s += 1) {
    if (barbellDemandAtRound(s, axTop, kgMax, slotCount) > endKg) return s;
  }
  return slotCount;
}

export type BarbellAttemptMark = "pending" | "ok" | "fail" | "skip";

/**
 * Status EINES Versuchs (0-basierte Runde `s`) für ein Team — die Drei-Versuche-Tafel
 * (4.3, ○/✓/✗) ist reine Ableitung aus vorhandenen Daten (endKg, thrownSlot, axTop/kgMax/
 * slotCount), kein neuer Datenpfad und keine literale kg-Remap (die bleibt ausdrücklich
 * Folge-Ticket, s. Kopfkommentar):
 *   - "pending" — Runde noch nicht enthüllt (s > thrownSlot).
 *   - "ok"      — Last bei dieser Runde noch gepackt.
 *   - "fail"    — GENAU die Runde, in der das Team reißt (erste nicht mehr gepackte Last).
 *   - "skip"    — das Team ist schon VOR dieser Runde ausgeschieden, kein weiterer Versuch.
 */
export function barbellAttemptStatus(
  s: number,
  thrownSlot: number,
  endKg: number,
  axTop: number,
  kgMax: number,
  slotCount: number,
): BarbellAttemptMark {
  if (s > thrownSlot) return "pending";
  const failRound = barbellFirstFailRound(endKg, axTop, kgMax, slotCount);
  if (s < failRound) return "ok";
  if (s === failRound) return "fail";
  return "skip";
}

export default function BarbellField(props: DisciplineFieldProps): ReactNode {
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
    layout,
    slotCount,
    rt,
    barbellSorted,
    barbellInfo,
    barbellY,
    barbellKgOf,
    barbellEliminated,
    barbellRankMap,
    demandKg,
    done,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // Pro-Token Gleit-Zustand + DOM-Refs für imperatives Positioning
  const barbellRef = useRef<Map<number, BarbellState>>(new Map());
  const gRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  // Enthüllungs-Rechteck des Gewichts-Turms je Token. Der Turm wird bis zum ENDGEWICHT des
  // Teams gezeichnet und über dieses Rechteck beschnitten: die rAF-Schleife zieht es exakt
  // auf die animierte Token-Höhe, sodass die Platten Stück für Stück MIT dem Icon aufsteigen.
  // Vorher hingen die Platten an der Zielhöhe und sprangen sofort auf den Endwert, während
  // das Icon noch glitt — der Aufbau des Turms war dadurch nicht zu sehen.
  const towerClipRefs = useRef<Map<number, SVGRectElement | null>>(new Map());

  // Frische Prop-Spiegel für rAF-Schleife
  const hoverRef = useRef<number | null>(props.hoverIdx);
  const reducedRef = useRef<boolean>(reducedMotion);
  const rtRef = useRef<RT[]>(rt);
  const barbellSortedRef = useRef<RT[]>(barbellSorted);
  const demandKgRef = useRef<number | null>(demandKg);
  const barbellKgOfRef = useRef<(code: string) => number>(barbellKgOf);
  const barbellYRef = useRef<(kg: number) => number>(barbellY);

  hoverRef.current = props.hoverIdx;
  const pausedRef = useRef<boolean>(props.paused);
  pausedRef.current = props.paused;
  reducedRef.current = reducedMotion;
  rtRef.current = rt;
  barbellSortedRef.current = barbellSorted;
  demandKgRef.current = demandKg;
  barbellKgOfRef.current = barbellKgOf;
  barbellYRef.current = barbellY;

  // Feld-Geometrie (defensiv aus layout mit Fallbacks)
  const lPad = layout?.lPad ?? 40;
  const rPad = layout?.rPad ?? 40;
  const baseY = layout?.baseY ?? H - 40;
  const topY = layout?.topY ?? 40;
  const axX = lPad;
  const rightX = W - rPad;
  const usableW = rightX - axX;
  const colW = usableW / Math.max(1, N);

  // rAF-Schleife: gleitet alle Token über TRACK_ROUND_MS
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(64, ts - last);
      last = ts;

      const frozen = hoverRef.current != null || pausedRef.current;
      const reduce = reducedRef.current;
      const c = barbellRef.current;

      for (const t of rtRef.current) {
        let st = c.get(t.idx);
        if (!st) {
          st = { fromY: baseY, toY: baseY, glideT: 1 };
          c.set(t.idx, st);
        }

        // Zielposition: barbellKgOf(code) → y
        const targetKg = barbellKgOfRef.current(t.code);
        const targetY = barbellYRef.current(targetKg);
        if (Math.abs(targetY - st.toY) > 0.5) {
          st.fromY = resolveBarbellGlideStart(st);
          st.toY = targetY;
          st.glideT = 0;
        }

        if (reduce) {
          st.glideT = 1;
        } else if (!frozen && st.glideT < 1) {
          st.glideT = Math.min(1, st.glideT + dt / TRACK_ROUND_MS);
        }

        // Position interpolieren
        const y = st.fromY + (st.toY - st.fromY) * st.glideT;

        const el = gRefs.current.get(t.idx);
        if (el) {
          // Finde die Position in barbellSorted für die Lanen-Reihenfolge
          const laneIdx = barbellSortedRef.current.findIndex((bt) => bt.idx === t.idx);
          const x = axX + (laneIdx >= 0 ? laneIdx : 0) * colW + colW / 2;
          el.setAttribute("transform", `translate(${x} ${y})`);
        }

        // Turm auf dieselbe animierte Höhe beschneiden → Platten wachsen mit dem Icon.
        const clip = towerClipRefs.current.get(t.idx);
        if (clip) {
          clip.setAttribute("y", String(y));
          clip.setAttribute("height", String(Math.max(0, baseY - y)));
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ohne Kraft-Turm-Infos gibt es kein Feld (Guard NACH den Hooks — Rules of Hooks).
  if (!barbellInfo) {
    return null;
  }

  // Tick-Marks für die kg-Achse
  const ticks: number[] = [];
  for (let k = Math.ceil(barbellInfo.axTop / 50) * 50; k <= barbellInfo.kgMax + 5; k += 50) {
    ticks.push(k);
  }

  // Podium-Linie y-Position
  const podY = topY - 10;

  // Demanded weight line y-position (mit Smooth-Transition)
  const dLine = demandKg == null ? barbellInfo.axTop : demandKg;
  const barY = barbellY(dLine);

  // Live-Zähler: wie viele Heber sind noch im Wettkampf (nicht an der Last gescheitert).
  // Macht die Eliminations-Mechanik lesbar — „N/32 stemmen die geforderte Last noch".
  const liveCount = demandKg == null ? rt.length : rt.filter((t) => !barbellEliminated(t.code)).length;

  // REISSEN/STOSSEN ALS ZWEI BENANNTE PHASEN (4.3) — rein präsentational über den
  // vorhandenen `slotCount`/`thrownSlot`-Rahmen gelegt, KEIN neuer Datenpfad und KEINE
  // literale Zweikampf-Kilogramm-Remap (die bleibt ausdrücklich Folge-Ticket, s.
  // Kopfkommentar). `slotCount` ist bei Gewichtheben 6 (dataAdapter.ts, playerCount),
  // die erste Hälfte der Runden wird als „Reißen", die zweite als „Stoßen" gelesen — exakt
  // die IWF-Struktur (2 Übungen × 3 Versuche), ohne dass der Host je „Reißen"/„Stoßen"
  // wissen müsste. `curSlot`: höchste enthüllte Runde über alle Teams (alle Teams teilen
  // sich dieselbe Runden-Uhr, s. `t.thrownSlot = slot` im Host).
  const halbe = Math.max(1, Math.ceil(slotCount / 2));
  const curSlot = rt.length ? Math.max(-1, ...rt.map((t) => t.thrownSlot)) : -1;
  const uebungLabel = demandKg == null || curSlot < 0 ? null : curSlot < halbe ? "REISSEN" : "STOSSEN";
  const versuchNr = demandKg == null || curSlot < 0 ? null : (curSlot % halbe) + 1;
  // Welche drei Runden die Versuchstafel zeigt: die STOSSEN-Haelfte, sobald wir dort sind
  // (oder der Wettkampf fertig ist und ueberhaupt eine zweite Haelfte existiert) — sonst
  // die REISSEN-Haelfte (auch vor Wettkampfbeginn, als reine "○○○"-Vorschau).
  const phaseSlots =
    uebungLabel === "STOSSEN" || (done && slotCount > halbe)
      ? Array.from({ length: Math.max(0, slotCount - halbe) }, (_, i) => halbe + i)
      : Array.from({ length: halbe }, (_, i) => i);

  return (
    <>
      <defs>
        {/* Logo-Clipping für Teams */}
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={tokenRadius(t, geo)} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {/* === Hintergrund === */}
      {env ? (
        <>
          {/* Himmel */}
          <rect x={0} y={0} width={W} height={H} fill={env.sky[0]} opacity={0.8} />
        </>
      ) : (
        <>
          {/* Einfacher dunkler Grund mit Kraftraum-Gradient */}
          <defs>
            <linearGradient id="kraftGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#191b1f" />
              <stop offset="55%" stopColor="#101216" />
              <stop offset="100%" stopColor="#0b0d10" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill="url(#kraftGrad)" />
        </>
      )}

      {/* Vertikal-Raster (Kreidestaub-Effekt) */}
      <g stroke="rgba(143,166,192,.03)" strokeWidth={1} pointerEvents="none">
        {Array.from({ length: Math.ceil(W / 70) }).map((_, i) => (
          <line key={`grid-${i}`} x1={i * 70} y1={0} x2={i * 70} y2={H} />
        ))}
      </g>

      {/* Power-Rack-Rahmen (Ständer links/rechts + Grundlinie) */}
      <line x1={axX} y1={topY} x2={axX} y2={baseY} stroke="rgba(143,166,192,.25)" strokeWidth={2} pointerEvents="none" />
      <line x1={rightX} y1={topY} x2={rightX} y2={baseY} stroke="rgba(143,166,192,.25)" strokeWidth={2} pointerEvents="none" />
      <line x1={axX} y1={baseY} x2={rightX} y2={baseY} stroke="var(--nl-line-2)" strokeWidth={2.5} />

      {/* kg-Achse mit Tick-Marken */}
      {ticks.map((k) => {
        const y = barbellY(k);
        return (
          <g key={`ax-${k}`} pointerEvents="none">
            <line x1={axX - 6} y1={y} x2={rightX} y2={y} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="3 9" opacity={0.4} />
            <text x={axX - 9} y={y + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="var(--nl-mut-2)">
              {k}
            </text>
          </g>
        );
      })}
      <text
        x={16}
        y={(topY + baseY) / 2}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill="var(--nl-mut-2)"
        letterSpacing="0.14em"
        transform={`rotate(-90 16 ${(topY + baseY) / 2})`}
        pointerEvents="none"
      >
        kg GESTEMMT
      </text>

      {/* Podium-Linie oben mit Trophy */}
      <line x1={axX} y1={podY} x2={rightX} y2={podY} stroke="var(--nl-warn)" strokeWidth={1} strokeDasharray="5 6" opacity={0.55} pointerEvents="none" />
      <text x={rightX - 6} y={podY - 4} textAnchor="end" fontSize={13} pointerEvents="none">
        🏆
      </text>

      {/* Live-Zähler „N/Total im Wettkampf" — unter der Podium-Linie (kollidiert sonst mit 🏆). */}
      <g transform={`translate(${rightX - 6} ${podY + 18})`} pointerEvents="none">
        <rect x={-96} y={-15} width={96} height={22} rx={6} fill="var(--nl-panel)" stroke="var(--nl-line)" strokeWidth={1} opacity={0.92} />
        <text x={-88} y={1} fontSize={9.5} fontWeight={800} fontFamily="ui-monospace, monospace" fill="var(--nl-mut-2)" letterSpacing="0.06em">
          IM WETTKAMPF
        </text>
        <text x={-8} y={1} textAnchor="end" fontSize={12} fontWeight={900} fontFamily="ui-monospace, monospace" fill={liveCount <= 3 ? "var(--nl-warn)" : "var(--nl-ink)"}>
          {liveCount}/{rt.length}
        </text>
      </g>

      {/* DIE geforderte Last — der Star (mit CSS-Transition) */}
      <g style={{ transition: reducedMotion ? "none" : `transform ${TRACK_ROUND_MS}ms cubic-bezier(.45,0,.2,1)` }} transform={`translate(0 ${barY})`} pointerEvents="none">
        <line x1={axX} y1={0} x2={rightX} y2={0} stroke="var(--nl-warn)" strokeWidth={3} />
        <rect x={axX - 5} y={-11} width={9} height={22} rx={3} fill="var(--nl-mut)" />
        <rect x={rightX - 4} y={-11} width={9} height={22} rx={3} fill="var(--nl-mut)" />
        <g transform={`translate(${axX + 8} -22)`}>
          {/* REISSEN/STOSSEN + Versuch VOR der kg-Zahl (4.3) — statt der bisher namenlosen
              Last. `uebungLabel` ist null vor Wettkampfbeginn ODER nach der letzten Runde
              (`done`), dann bleibt die alte, kürzere Fassung stehen. */}
          <rect
            x={0}
            y={0}
            width={uebungLabel && !done ? 190 : demandKg != null && demandKg >= 100 ? 118 : 108}
            height={19}
            rx={5}
            fill="var(--nl-warn)"
          />
          <text x={7} y={13} fontSize={11} fontWeight={900} fontFamily="ui-monospace, monospace" fill="var(--nl-bg)">
            {demandKg == null
              ? "GEFORDERT —"
              : done
                ? `GESTEMMT ${Math.round(dLine)} kg`
                : `${uebungLabel} #${versuchNr} · GEFORDERT ${Math.round(dLine)} kg`}
          </text>
        </g>
      </g>

      {/* Team-Codes unter der Grundlinie */}
      {barbellSorted.map((t) => {
        const laneIdx = barbellSorted.indexOf(t);
        return (
          <text
            key={`bl-${t.code}`}
            x={axX + laneIdx * colW + colW / 2}
            y={baseY + 13}
            textAnchor="middle"
            fontSize={8}
            fontWeight={t.isOwn ? 800 : 600}
            fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut-2)"}
            pointerEvents="none"
          >
            {t.code}
          </text>
        );
      })}

      {/* DREI-VERSUCHE-TAFEL je Team (4.3) — ○ wartet / ✓ gepackt / ✗ gerissen / – schon
          ausgeschieden, für die drei Versuche der AKTUELLEN Übungshälfte (Reißen ODER
          Stoßen — `phaseSlots`). Reine Ableitung aus vorhandenen Daten
          (`barbellAttemptStatus`: endKg/thrownSlot/axTop/kgMax/slotCount), kein neuer
          Datenpfad — die einzige Information, die Gewichtheben von jeder anderen
          Zähldisziplin unterscheidet und die vorher komplett fehlte. */}
      {barbellSorted.map((t) => {
        const laneIdx = barbellSorted.indexOf(t);
        const x = axX + laneIdx * colW + colW / 2;
        const endKg = barbellInfo.endKgByCode.get(t.code) ?? barbellInfo.kgMax;
        return (
          <g key={`att-${t.code}`} transform={`translate(${x} ${baseY + 23})`} pointerEvents="none">
            {phaseSlots.map((s, i) => {
              const mark = barbellAttemptStatus(s, t.thrownSlot, endKg, barbellInfo.axTop, barbellInfo.kgMax, slotCount);
              const glyph = mark === "ok" ? "✓" : mark === "fail" ? "✗" : mark === "pending" ? "○" : "–";
              const color = mark === "ok" ? "var(--nl-good)" : mark === "fail" ? "var(--nl-risk)" : "var(--nl-mut-2)";
              return (
                <text key={s} x={(i - (phaseSlots.length - 1) / 2) * 10} y={0} textAnchor="middle" fontSize={8} fontWeight={800} fill={color}>
                  {glyph}
                </text>
              );
            })}
          </g>
        );
      })}

      {/* Feld-Wasserzeichen */}
      {disciplineName ? (
        <text
          x={18}
          y={30}
          fontSize={19}
          fontWeight={800}
          letterSpacing="0.04em"
          fill={env ? env.line : skinAccent}
          opacity={env ? 0.75 : 0.95}
          style={{ textTransform: "uppercase" }}
          pointerEvents="none"
        >
          {disciplineName}
        </text>
      ) : null}

      {/* === Plate-Towers + Token: Heber === */}
      {barbellSorted.map((t) => {
        const laneIdx = barbellSorted.indexOf(t);
        const laneX = axX + laneIdx * colW + colW / 2;
        const bbOut = barbellEliminated(t.code);
        // Turm bis zum ENDGEWICHT zeichnen (die höchste Last, die dieses Team je stemmt) und
        // per Clip auf die animierte Höhe beschneiden. `barbellKgOf` ist durch das Endgewicht
        // gedeckelt, der Token verlässt diesen Bereich also nie. So bleiben die Platten stabil
        // (kein Neuaufbau je Runde) und erscheinen rein über den Clip nach und nach.
        const maxKg = barbellInfo.endKgByCode.get(t.code) ?? barbellInfo.axTop;
        const maxY = barbellY(maxKg);
        const maxColH = baseY - maxY;

        return (
          <g key={`tower-${t.code}`}>
            {/* Gewichts-Turm: von baseY (unten) bis zur animierten Höhe — Stab + Platten.
                Erst NACH dem ersten Versuch (thrownSlot ≥ 0) zeichnen — vorher lagen die
                Platten von Anfang an da und überlagerten die Team-Logos. Der Turm wird VOR
                den Token gerendert → liegt ohnehin UNTER dem Logo. */}
            {maxColH > 2 && t.thrownSlot >= 0 && (
              <>
                <clipPath id={`bbtower-${t.code}`}>
                  {/* y/height setzt die rAF-Schleife auf die animierte Token-Höhe. */}
                  <rect
                    ref={(node) => {
                      towerClipRefs.current.set(t.idx, node);
                    }}
                    x={laneX - 20}
                    y={baseY}
                    width={40}
                    height={0}
                  />
                </clipPath>
                <g opacity={bbOut ? 0.42 : 1} clipPath={`url(#bbtower-${t.code})`}>
                  {/* Dünner Haupt-Stab (the bar) */}
                  <rect x={laneX - 1.5} y={maxY} width={3} height={maxColH} fill="rgba(143,166,192,.5)" />

                  {/* Gewichts-Platten als Rechtecke — mehrere Schichten je kg-Stufe */}
                  {Array.from({ length: Math.max(1, Math.ceil(maxColH / 12)) }).map((_, pIdx) => {
                    const pY = baseY - (pIdx + 1) * 12;
                    const pW = Math.min(14 + pIdx * 2, 32);
                    return pY >= maxY ? (
                      <rect
                        key={`plate-${pIdx}`}
                        x={laneX - pW / 2}
                        y={pY}
                        width={pW}
                        height={10}
                        rx={1}
                        fill={IWF_PLATE_COLORS[pIdx % IWF_PLATE_COLORS.length]}
                        opacity={0.75}
                        stroke="rgba(143,166,192,.3)"
                        strokeWidth={0.5}
                      />
                    ) : null;
                  })}
                </g>
              </>
            )}
          </g>
        );
      })}

      {/* === Token: Heber (bewegt sich mit rAF) === */}
      {barbellSorted
        .slice()
        .reverse()
        .map((t) => {
          const r = tokenRadius(t, geo);
          const bbOut = barbellEliminated(t.code);
          const bbChamp = done && (barbellRankMap[t.code] ?? 99) === 1;
          const glowing = t.glowUntil > now;

          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={(el) => {
                gRefs.current.set(t.idx, el);
              }}
              style={{
                cursor: onOpenTeam && t.teamId ? "pointer" : "default",
                opacity: bbOut ? 0.42 : 1,
                filter: bbOut ? "grayscale(.72)" : "none",
              }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Champion: goldener Glow-Ring */}
              {bbChamp ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={3.5}
                  style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.4s ease-in-out infinite" }}
                />
              ) : null}

              {/* Eliminated: roter Ring */}
              {bbOut ? <circle r={r + 3.5} fill="none" stroke="var(--nl-risk)" strokeWidth={2.4} /> : null}

              {/* KAMPFRICHTERLAMPEN — eine echte Dreier-Reihe (IWF-Geste) statt der
                  einzelnen ⚪/🔴-Emoji-Lampe. Alle drei Lampen zeigen denselben Ausgang
                  (`bbOut`) — es gibt keine drei unabhängigen Kampfrichter-Daten im Host,
                  nur EIN Gültig/Gerissen-Signal; die drei Lampen sind die IWF-typische
                  FORM dieser Anzeige, kein neu erfundener 3-Richter-Datenpfad. */}
              {demandKg != null ? (
                <g transform={`translate(${-(r + 16)} ${r + 4})`}>
                  {[-6, 0, 6].map((dx) => (
                    <circle key={dx} cx={dx} cy={0} r={2.6} fill={bbOut ? "#c0392b" : "#f2ede0"} stroke="rgba(8,10,14,.6)" strokeWidth={0.6} />
                  ))}
                </g>
              ) : null}

              {/* Champion-Krone */}
              {bbChamp ? (
                <text y={-(r + 9)} textAnchor="middle" fontSize={14}>
                  🏆
                </text>
              ) : null}

              {/* Glowing für Führenden */}
              {glowing ? (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="var(--nl-warn)"
                  strokeWidth={4}
                  style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }}
                />
              ) : null}

              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen. trophy={false}
                  — eigene Krone (oben). badge={false} — die Eliminations-Rangliste (barbellSorted,
                  Verbliebene zuerst) ist maßgeblich; ein Score-Rang-Badge würde sie spoilern. */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} trophy={false} badge={false} />
            </g>
          );
        })}
    </>
  );
}
