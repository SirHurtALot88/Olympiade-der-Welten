"use client";

/**
 * Kader-Ridgeline — Verteilungs-Kärtchen (Joyplot) für den Analyse-Hub des
 * Spieler-Verzeichnisses (additiv, "Neuer Look").
 *
 * Vier überlagerte, leicht versetzte Dichtekurven (POW/SPE/MEN/SOC, klassischer
 * Ridgeline-/Joyplot-Look) aus der aktuellen Hub-Auswahl (`rows`, respektiert
 * also Umfang-/Team-/Klassen-Filter wie `FoundationPlayersScatterCard`
 * daneben). Jede Achse trägt ihren bestehenden Ton (`nlToneClass`) — dieselbe
 * Farbwelt wie die Achsen-Mini-Bars in der Tabelle.
 *
 * Rein Verteilungs-Visualisierung: der 0–100-Wertebereich wird in feste
 * Buckets gruppiert (`RIDGE_BIN_COUNT`), leicht geglättet (3-Tap gleitender
 * Mittelwert) und über einen quadratischen Bezier-Pfad durch die Bucket-Mitten
 * gezeichnet — kein Punkt/Knoten pro Spieler, bleibt bei 260+ Spielern
 * konstant günstig (`O(rows · Achsen)` beim Bucketing, danach nur noch
 * `RIDGE_BIN_COUNT` Pfadpunkte je Achse).
 *
 * Handgerolltes, reines SVG (gleiche Geometrie-Schule wie
 * `FoundationPlayersScatterCard`/`NlBarChart`) — keine Chart-Library.
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-ridge-*`.
 */

import { useMemo } from "react";

import { NL_AXIS_LABELS, NL_TONE_VAR, NlCard, formatNlNumber, type NlAxisKey } from "@/components/foundation/new-look";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

const RIDGE_AXES: readonly NlAxisKey[] = ["pow", "spe", "men", "soc"];

const CHART_WIDTH = 620;
const PAD_LEFT = 54;
const PAD_RIGHT = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;
const ROW_HEIGHT = 56;
const ROW_STEP = 42;
const ROW_AMPLITUDE = ROW_HEIGHT * 0.92;
const CHART_HEIGHT = PAD_TOP + ROW_HEIGHT + (RIDGE_AXES.length - 1) * ROW_STEP + PAD_BOTTOM;
const RIDGE_BIN_COUNT = 20;
const RIDGE_BIN_WIDTH = 100 / RIDGE_BIN_COUNT;
const RIDGE_X_TICKS = [0, 25, 50, 75, 100];

type RidgePoint = { x: number; y: number };

/** Histogramm (0–100, `RIDGE_BIN_COUNT` Buckets) einer Achse über die aktuelle Auswahl — `null`-Werte fließen nicht ein. */
function buildAxisHistogram(rows: FoundationPlayerScopeRow[], axis: NlAxisKey): { counts: number[]; known: number } {
  const counts = new Array<number>(RIDGE_BIN_COUNT).fill(0);
  let known = 0;
  for (const row of rows) {
    const value = row.player.coreStats[axis];
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    known += 1;
    const clamped = Math.max(0, Math.min(100, value));
    const binIndex = Math.min(RIDGE_BIN_COUNT - 1, Math.floor(clamped / RIDGE_BIN_WIDTH));
    counts[binIndex] += 1;
  }
  return { counts, known };
}

/** Sanfte 3-Tap-Glättung, damit die Buckets als weiche Kurve statt kantiges Histogramm wirken. */
function smoothCounts(counts: number[]): number[] {
  return counts.map((value, index) => {
    const prev = counts[index - 1] ?? value;
    const next = counts[index + 1] ?? value;
    return (prev + 2 * value + next) / 4;
  });
}

/** Geschlossener, geglätteter Flächenpfad durch `points` bis zur `baselineY` (quadratische Bezier über die Bucket-Mitten). */
function buildRidgeAreaPath(points: RidgePoint[], baselineY: number): string {
  if (points.length === 0) {
    return "";
  }
  let d = `M ${points[0]!.x.toFixed(1)} ${baselineY.toFixed(1)} L ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const nextPoint = points[i + 1]!;
    const midX = (current.x + nextPoint.x) / 2;
    const midY = (current.y + nextPoint.y) / 2;
    d += ` Q ${current.x.toFixed(1)} ${current.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  return d;
}

/** Gleiche Glättung wie `buildRidgeAreaPath`, aber als offene Linie (Kontur-Stroke über der Fläche). */
function buildRidgeLinePath(points: RidgePoint[]): string {
  if (points.length === 0) {
    return "";
  }
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const nextPoint = points[i + 1]!;
    const midX = (current.x + nextPoint.x) / 2;
    const midY = (current.y + nextPoint.y) / 2;
    d += ` Q ${current.x.toFixed(1)} ${current.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  return d;
}

export type FoundationPlayersSquadRidgelineProps = {
  /** Dieselben (bereits Umfang-/Team-/Klassen-gefilterten) Zeilen wie der Rest des Hubs. */
  rows: FoundationPlayerScopeRow[];
};

export default function FoundationPlayersSquadRidgeline({ rows }: FoundationPlayersSquadRidgelineProps) {
  const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;

  const axisRows = useMemo(() => {
    const histograms = RIDGE_AXES.map((axis) => ({ axis, ...buildAxisHistogram(rows, axis) }));
    const smoothed = histograms.map((entry) => ({ ...entry, smoothed: smoothCounts(entry.counts) }));
    const globalMax = Math.max(1, ...smoothed.flatMap((entry) => entry.smoothed));

    return smoothed.map((entry, rowIndex) => {
      const baselineY = PAD_TOP + ROW_HEIGHT + rowIndex * ROW_STEP;
      const points: RidgePoint[] = entry.smoothed.map((value, binIndex) => {
        const binCenter = (binIndex + 0.5) * RIDGE_BIN_WIDTH;
        const x = PAD_LEFT + (binCenter / 100) * innerWidth;
        const y = baselineY - (value / globalMax) * ROW_AMPLITUDE;
        return { x, y };
      });
      const peakBinIndex = entry.counts.reduce(
        (bestIndex, value, index) => (value > entry.counts[bestIndex]! ? index : bestIndex),
        0,
      );
      const peakLabel =
        entry.known > 0
          ? `${formatNlNumber(peakBinIndex * RIDGE_BIN_WIDTH, 0)}–${formatNlNumber((peakBinIndex + 1) * RIDGE_BIN_WIDTH, 0)}`
          : null;
      return { axis: entry.axis, baselineY, points, known: entry.known, peakLabel };
    });
  }, [rows, innerWidth]);

  const hasAnyData = axisRows.some((entry) => entry.known > 0);

  return (
    <NlCard className="nl-ridge-card" eyebrow="Kader-Analyse" title="Kader-Profil">
      {!hasAnyData ? (
        <p className="nl-phub-empty">Keine Achsenwerte (POW/SPE/MEN/SOC) in der aktuellen Auswahl.</p>
      ) : (
        <>
          <div className="nl-ridge-svg-wrap">
            <svg
              className="nl-ridge-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Kader-Profil: Verteilung von POW, SPE, MEN und SOC über ${formatNlNumber(rows.length, 0)} Spieler der aktuellen Auswahl`}
            >
              {RIDGE_X_TICKS.map((tick) => {
                const x = PAD_LEFT + (tick / 100) * innerWidth;
                return (
                  <g key={`nl-ridge-tick-${tick}`}>
                    <line x1={x} x2={x} y1={PAD_TOP - 6} y2={CHART_HEIGHT - PAD_BOTTOM + 4} className="nl-ridge-grid" />
                    <text x={x} y={CHART_HEIGHT - 8} textAnchor="middle" className="nl-ridge-tick">
                      {tick}
                    </text>
                  </g>
                );
              })}
              <text
                x={(PAD_LEFT + CHART_WIDTH - PAD_RIGHT) / 2}
                y={CHART_HEIGHT - PAD_BOTTOM + 20}
                textAnchor="middle"
                className="nl-ridge-axis-label"
              >
                Achsenwert (0–100) →
              </text>
              {axisRows.map((entry) => {
                const tone = NL_TONE_VAR[entry.axis];
                return (
                  <g key={entry.axis}>
                    <line
                      x1={PAD_LEFT}
                      x2={CHART_WIDTH - PAD_RIGHT}
                      y1={entry.baselineY}
                      y2={entry.baselineY}
                      className="nl-ridge-baseline"
                    />
                    <text x={PAD_LEFT - 8} y={entry.baselineY - 4} textAnchor="end" className="nl-ridge-row-label">
                      {NL_AXIS_LABELS[entry.axis]}
                    </text>
                    <path className="nl-ridge-area" fill={tone} d={buildRidgeAreaPath(entry.points, entry.baselineY)}>
                      <title>
                        {NL_AXIS_LABELS[entry.axis]} · {formatNlNumber(entry.known, 0)} Spieler mit Wert
                        {entry.peakLabel ? ` · Schwerpunkt bei ${entry.peakLabel}` : ""}
                      </title>
                    </path>
                    <path className="nl-ridge-line" stroke={tone} d={buildRidgeLinePath(entry.points)} />
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="nl-ridge-legend">
            {RIDGE_AXES.map((axis) => (
              <span key={axis} className="nl-ridge-legend-item">
                <span
                  className="nl-ridge-legend-swatch"
                  style={{ background: NL_TONE_VAR[axis] }}
                  aria-hidden="true"
                />{" "}
                {NL_AXIS_LABELS[axis]}
              </span>
            ))}
          </div>
          <p className="nl-phub-hint">
            Stärkeverteilung von POW/SPE/MEN/SOC über {formatNlNumber(rows.length, 0)} Spieler der aktuellen Auswahl —
            höher heißt mehr Spieler in diesem Wertebereich.
          </p>
        </>
      )}
    </NlCard>
  );
}
