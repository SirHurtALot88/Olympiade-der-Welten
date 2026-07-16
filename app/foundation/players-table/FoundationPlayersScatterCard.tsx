"use client";

/**
 * "Schnäppchen-Radar" — Streudiagramm (OVR/PPs × MW/Gehalt) für den
 * Analyse-Hub des Spieler-Verzeichnisses (additiv, "Neuer Look").
 *
 * Ein Punkt je Spieler der aktuellen Hub-Auswahl (`rows`, respektiert also
 * Umfang-/Team-/Klassen-Filter wie die übrigen Hub-Kacheln). Eigene
 * (`team.humanControlled`) Spieler sind größer und im Akzent-Ton markiert,
 * alle anderen gedämpft. Klick auf einen Punkt öffnet den Spieler-Drawer
 * (identischer Handler wie überall sonst in der Tabelle/im Hub), Hover zeigt
 * einen nativen SVG-`<title>`-Tooltip (Name · OVR · MW · Team) — dasselbe
 * Tooltip-Vokabular wie `NlBarChart` (`<title>` je Balken).
 *
 * Handgerolltes, reines SVG (keine Chart-Library, gleiche Geometrie-Schule
 * wie `NlBarChart`/`NlRadar`) — bei ~300-400 Punkten reicht das für flüssige
 * Interaktion, ohne dass pro Punkt eigener React-State existiert (Hover wird
 * rein über CSS `:hover` gelöst, nicht über `useState` je Kreis).
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-phub-scatter-*`.
 */

import { useMemo, useState } from "react";

import {
  formatPpsValue,
  formatWholeNumber,
  getPlayerDisplayMarketValue,
  getPlayerDisplaySalary,
  getRosterEntryDisplaySalary,
} from "@/app/foundation/foundation-page-client-exports";
import { formatNlMoney, formatNlNumber, NlCard } from "@/components/foundation/new-look";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

type ScatterXKey = "ovr" | "pps";
type ScatterYKey = "mw" | "salary";

const SCATTER_X_AXES: ReadonlyArray<{ key: ScatterXKey; label: string; title: string }> = [
  { key: "ovr", label: "OVR", title: "X-Achse: Overall-Rating" },
  { key: "pps", label: "PPs", title: "X-Achse: Performance-Punkte der Saison" },
];

const SCATTER_Y_AXES: ReadonlyArray<{ key: ScatterYKey; label: string; title: string }> = [
  { key: "mw", label: "MW", title: "Y-Achse: Marktwert" },
  { key: "salary", label: "Gehalt", title: "Y-Achse: Jahresgehalt" },
];

/** Rohwert einer Achse für eine Zeile — `null`, wenn nicht bekannt (keine Erfindung). */
function getRowScatterValue(row: FoundationPlayerScopeRow, key: ScatterXKey | ScatterYKey): number | null {
  switch (key) {
    case "ovr":
      return row.playerOvr;
    case "pps":
      return row.playerPps;
    case "mw":
      return getPlayerDisplayMarketValue(row.player);
    case "salary":
      return row.roster ? getRosterEntryDisplaySalary(row.roster, row.player) : getPlayerDisplaySalary(row.player);
    default:
      return null;
  }
}

function formatScatterValue(value: number | null, key: ScatterXKey | ScatterYKey): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (key === "mw" || key === "salary") {
    return formatNlMoney(value);
  }
  if (key === "pps") {
    return formatPpsValue(value);
  }
  return formatWholeNumber(value);
}

/** Median einer Zahlenliste (leer → `null`) — eine Sortierung, Basis für die Quadranten-Leitlinien. */
function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const CHART_WIDTH = 620;
const CHART_HEIGHT = 300;
const PAD_LEFT = 46;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const GRID_STEPS = 4;

export type FoundationPlayersScatterCardProps = {
  /** Dieselben (bereits Umfang-/Team-/Klassen-gefilterten) Zeilen wie der Rest des Hubs. */
  rows: FoundationPlayerScopeRow[];
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
};

export default function FoundationPlayersScatterCard({ rows, openPlayerDrawerById }: FoundationPlayersScatterCardProps) {
  const [xKey, setXKey] = useState<ScatterXKey>("ovr");
  const [yKey, setYKey] = useState<ScatterYKey>("mw");

  const points = useMemo(() => {
    return rows
      .map((row) => {
        const x = getRowScatterValue(row, xKey);
        const y = getRowScatterValue(row, yKey);
        if (x == null || !Number.isFinite(x) || y == null || !Number.isFinite(y)) {
          return null;
        }
        return { row, x, y, isOwn: row.team?.humanControlled ?? false };
      })
      .filter(
        (entry): entry is { row: FoundationPlayerScopeRow; x: number; y: number; isOwn: boolean } => entry != null,
      );
  }, [rows, xKey, yKey]);

  const geometry = useMemo(() => {
    if (points.length === 0) {
      return null;
    }
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xPad = xMax - xMin > 0 ? (xMax - xMin) * 0.06 : 1;
    const yPad = yMax - yMin > 0 ? (yMax - yMin) * 0.08 : 1;
    const domainXMin = Math.max(0, xMin - xPad);
    const domainXMax = xMax + xPad;
    const domainYMin = Math.max(0, yMin - yPad);
    const domainYMax = yMax + yPad;
    const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

    const scaleX = (value: number) =>
      domainXMax === domainXMin
        ? PAD_LEFT + innerWidth / 2
        : PAD_LEFT + ((value - domainXMin) / (domainXMax - domainXMin)) * innerWidth;
    const scaleY = (value: number) =>
      domainYMax === domainYMin
        ? PAD_TOP + innerHeight / 2
        : CHART_HEIGHT - PAD_BOTTOM - ((value - domainYMin) / (domainYMax - domainYMin)) * innerHeight;

    const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
      const value = domainYMin + (index / GRID_STEPS) * (domainYMax - domainYMin);
      return { value, y: scaleY(value) };
    });

    // Median-Leitlinien (Feature 3): teilen die Wolke in vier Quadranten, damit
    // ablesbar ist, welche Ecke "gut" ist (hoher X-Wert = stark, niedriger
    // Y-Wert = günstig ⇒ Schnäppchen rechts unten). Eine Sortierung je Achse.
    const medianX = median(xValues);
    const medianY = median(yValues);

    return { domainXMin, domainXMax, scaleX, scaleY, gridLines, medianX, medianY };
  }, [points]);

  const activeX = SCATTER_X_AXES.find((axis) => axis.key === xKey) ?? SCATTER_X_AXES[0]!;
  const activeY = SCATTER_Y_AXES.find((axis) => axis.key === yKey) ?? SCATTER_Y_AXES[0]!;
  const skippedCount = rows.length - points.length;
  // Eigene Punkte zuletzt zeichnen, damit sie nicht von der grauen Liga-Masse überdeckt werden.
  const orderedPoints = useMemo(() => [...points].sort((left, right) => Number(left.isOwn) - Number(right.isOwn)), [points]);

  return (
    <NlCard
      className="nl-phub-scatter-card"
      eyebrow="Kader-Ökonomie"
      title="Schnäppchen-Radar"
      actions={
        <div className="nl-phub-scatter-axis-switch" role="group" aria-label="Achsen wählen">
          <span className="nl-phub-scatter-axis-switch-label">X</span>
          {SCATTER_X_AXES.map((axis) => (
            <button
              key={axis.key}
              type="button"
              className={`nl-phub-scatter-axis-btn${xKey === axis.key ? " is-active" : ""}`}
              onClick={() => setXKey(axis.key)}
              aria-pressed={xKey === axis.key}
              title={axis.title}
            >
              {axis.label}
            </button>
          ))}
          <span className="nl-phub-scatter-axis-switch-label">Y</span>
          {SCATTER_Y_AXES.map((axis) => (
            <button
              key={axis.key}
              type="button"
              className={`nl-phub-scatter-axis-btn${yKey === axis.key ? " is-active" : ""}`}
              onClick={() => setYKey(axis.key)}
              aria-pressed={yKey === axis.key}
              title={axis.title}
            >
              {axis.label}
            </button>
          ))}
        </div>
      }
    >
      {!geometry ? (
        <p className="nl-phub-empty">
          Keine {activeX.label}-/{activeY.label}-Daten in der aktuellen Auswahl.
        </p>
      ) : (
        <>
          <div className="nl-phub-scatter-svg-wrap">
            <svg
              className="nl-phub-scatter-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Schnäppchen-Radar: ${activeX.label} gegen ${activeY.label}, ${formatNlNumber(points.length, 0)} Spieler, eigenes Team hervorgehoben — Punkt anklicken öffnet das Spielerprofil`}
            >
              {geometry.gridLines.map((line, index) => (
                <g key={`nl-scatter-grid-${index}`}>
                  <line x1={PAD_LEFT} x2={CHART_WIDTH - PAD_RIGHT} y1={line.y} y2={line.y} className="nl-phub-scatter-grid" />
                  <text x={PAD_LEFT - 6} y={line.y} textAnchor="end" dominantBaseline="middle" className="nl-phub-scatter-tick">
                    {formatScatterValue(line.value, yKey)}
                  </text>
                </g>
              ))}
              <line x1={PAD_LEFT} x2={PAD_LEFT} y1={PAD_TOP} y2={CHART_HEIGHT - PAD_BOTTOM} className="nl-phub-scatter-axis-line" />
              <line
                x1={PAD_LEFT}
                x2={CHART_WIDTH - PAD_RIGHT}
                y1={CHART_HEIGHT - PAD_BOTTOM}
                y2={CHART_HEIGHT - PAD_BOTTOM}
                className="nl-phub-scatter-axis-line"
              />
              <text x={PAD_LEFT} y={CHART_HEIGHT - 8} textAnchor="start" className="nl-phub-scatter-tick">
                {formatScatterValue(geometry.domainXMin, xKey)}
              </text>
              <text x={CHART_WIDTH - PAD_RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" className="nl-phub-scatter-tick">
                {formatScatterValue(geometry.domainXMax, xKey)}
              </text>
              <text x={(PAD_LEFT + CHART_WIDTH - PAD_RIGHT) / 2} y={CHART_HEIGHT - 8} textAnchor="middle" className="nl-phub-scatter-axis-label">
                {activeX.label} →
              </text>
              {/* Median-Leitlinien + Quadranten-Hinweis (Feature 3): gestrichelt (inline),
                  damit sie sich von den durchgezogenen Achsen absetzen. "Schnäppchen"
                  markiert die gute Ecke (rechts unten: viel {activeX.label} für wenig {activeY.label}). */}
              {geometry.medianX != null ? (
                <line
                  x1={geometry.scaleX(geometry.medianX)}
                  x2={geometry.scaleX(geometry.medianX)}
                  y1={PAD_TOP}
                  y2={CHART_HEIGHT - PAD_BOTTOM}
                  className="nl-phub-scatter-axis-line"
                  style={{ strokeDasharray: "5 4", opacity: 0.7 }}
                >
                  <title>Median {activeX.label}: {formatScatterValue(geometry.medianX, xKey)}</title>
                </line>
              ) : null}
              {geometry.medianY != null ? (
                <line
                  x1={PAD_LEFT}
                  x2={CHART_WIDTH - PAD_RIGHT}
                  y1={geometry.scaleY(geometry.medianY)}
                  y2={geometry.scaleY(geometry.medianY)}
                  className="nl-phub-scatter-axis-line"
                  style={{ strokeDasharray: "5 4", opacity: 0.7 }}
                >
                  <title>Median {activeY.label}: {formatScatterValue(geometry.medianY, yKey)}</title>
                </line>
              ) : null}
              {geometry.medianX != null && geometry.medianY != null ? (
                <text
                  x={CHART_WIDTH - PAD_RIGHT - 6}
                  y={CHART_HEIGHT - PAD_BOTTOM - 8}
                  textAnchor="end"
                  className="nl-phub-scatter-axis-label"
                  style={{ fill: "var(--nl-good)", opacity: 0.85 }}
                >
                  Schnäppchen ↘
                </text>
              ) : null}
              {orderedPoints.map(({ row, x, y, isOwn }) => (
                <circle
                  key={row.player.id}
                  cx={geometry.scaleX(x)}
                  cy={geometry.scaleY(y)}
                  r={isOwn ? 5 : 2.6}
                  className={`nl-phub-scatter-dot ${isOwn ? "nl-phub-scatter-dot-own" : "nl-phub-scatter-dot-other"}`}
                  onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                >
                  <title>
                    {row.player.name} · OVR {formatWholeNumber(row.playerOvr)} · MW{" "}
                    {formatNlMoney(getPlayerDisplayMarketValue(row.player))} · {row.team?.name ?? "Free Agent"}
                  </title>
                </circle>
              ))}
            </svg>
          </div>
          <div className="nl-phub-scatter-legend">
            <span className="nl-phub-scatter-legend-item">
              <span className="nl-phub-scatter-legend-swatch nl-phub-scatter-legend-swatch-own" aria-hidden="true" /> Dein Team
            </span>
            <span className="nl-phub-scatter-legend-item">
              <span className="nl-phub-scatter-legend-swatch nl-phub-scatter-legend-swatch-other" aria-hidden="true" /> Liga
            </span>
          </div>
          <p className="nl-phub-hint">
            {formatNlNumber(points.length, 0)} von {formatNlNumber(rows.length, 0)} Spielern abgebildet
            {skippedCount > 0
              ? ` (${formatNlNumber(skippedCount, 0)} ohne ${activeX.label}-/${activeY.label}-Wert ausgeblendet)`
              : ""}
            . Punkt anklicken öffnet das Spielerprofil.
          </p>
        </>
      )}
    </NlCard>
  );
}
