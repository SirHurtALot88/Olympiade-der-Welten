"use client";

import { useMemo } from "react";

import {
  formatNlNumber,
  NL_AXIS_LABELS,
  NL_TONE_VAR,
  nlToneClass,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look/nl-tones";

export type NlRadarAxis = {
  key: NlAxisKey;
  value: number;
};

/** Generische Achsen-Definition — beliebige Achsenzahl/-beschriftung, nicht auf POW/SPE/MEN/SOC beschränkt. */
export type NlRadarAxisDef = {
  key: string;
  label: string;
};

/**
 * Eine überlagerte Serie im generischen Mehrachsen-/Mehrserien-Modus
 * (`axisDefs` + `series`). Jede Serie trägt Farbe (Ton) UND Linienstil
 * (durchgezogen/gestrichelt via `dashed`) — Serien dürfen sich laut
 * Accessibility-Vorgabe nicht ausschließlich über Farbe unterscheiden.
 */
export type NlRadarSeries = {
  id: string;
  label?: string;
  tone?: NlTone;
  dashed?: boolean;
  /** Werte je Achsen-Key aus `axisDefs`; fehlende Achsen werden mit 0 gezeichnet. */
  values: Record<string, number | null | undefined>;
};

export type NlRadarProps = {
  /** Achsenwerte für den klassischen 4-Achsen-Modus (POW/SPE/MEN/SOC); fehlende Achsen werden mit 0 gezeichnet. */
  axes?: NlRadarAxis[];
  max?: number;
  /** Werte an den Achsen-Labels mit anzeigen (nur klassischer 4-Achsen-Modus). */
  showValues?: boolean;
  /**
   * Optionales Vergleichs-Polygon (z. B. Vorsaison) hinter dem Haupt-Radar.
   * Wird nur gezeichnet, wenn alle vier Achsen endliche Werte tragen —
   * ein Teil-Ghost mit 0-Achsen wäre irreführend. Nur klassischer Modus.
   */
  ghostAxes?: NlRadarAxis[];
  /** Beschriftung des Ghost-Polygons für Tooltip/Screenreader, z. B. "Saison 1". */
  ghostLabel?: string;
  /** Macht die Achsen-Labels zu Portalen (Klick/Enter auf POW/SPE/MEN/SOC). Nur klassischer Modus. */
  onAxisClick?: (key: NlAxisKey) => void;
  "aria-label"?: string;
  className?: string;
  /**
   * Generischer Modus: beliebige Achsen (N Labels) + mehrere überlagerte
   * Serien. Sobald `series` (nicht-leer) gesetzt ist, ersetzt dieser Modus
   * den klassischen `axes`/`ghostAxes`-Modus vollständig — bestehende
   * Aufrufer, die nur `axes` übergeben, sind davon unberührt (Vorrang nur
   * bei explizit gesetztem `series`).
   */
  axisDefs?: NlRadarAxisDef[];
  series?: NlRadarSeries[];
};

const RADAR_SIZE = 220;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 66;
const RADAR_RINGS = [0.25, 0.5, 0.75, 1];
const RADAR_LABEL_RATIO = 1.3;
/** Feste Reihenfolge: POW oben, SPE rechts, MEN unten, SOC links (klassischer Modus). */
const RADAR_AXIS_ORDER: NlAxisKey[] = ["pow", "spe", "men", "soc"];

function radarPoint(axisIndex: number, axisCount: number, ratio: number) {
  const angle = (axisIndex / axisCount) * Math.PI * 2 - Math.PI / 2;
  return {
    x: RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS * ratio,
    y: RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS * ratio,
  };
}

function polygonAttr(points: ReadonlyArray<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

/**
 * Achsen-Radar (handgerolltes SVG). Klassischer Modus: die vier
 * Spiel-Achsen POW/SPE/MEN/SOC (Punkte/Labels tragen die Achsenfarben).
 * Generischer Modus (`axisDefs`/`series`): beliebige Achsenzahl + mehrere
 * überlagerte Serien (je Serie Ton + solid/dashed).
 */
export function NlRadar({
  axes,
  max = 100,
  showValues = false,
  ghostAxes,
  ghostLabel,
  onAxisClick,
  "aria-label": ariaLabel,
  className,
  axisDefs,
  series,
}: NlRadarProps) {
  const isGeneric = (series?.length ?? 0) > 0;

  const genericGeometry = useMemo(() => {
    if (!isGeneric) {
      return null;
    }
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const defs =
      axisDefs && axisDefs.length > 0
        ? axisDefs
        : Array.from(new Set(series!.flatMap((entry) => Object.keys(entry.values)))).map((key) => ({
            key,
            label: key,
          }));
    if (defs.length === 0) {
      return null;
    }
    const axisCount = defs.length;

    const seriesGeometry = series!.map((entry) => {
      const points = defs.map((def, index) => {
        const raw = entry.values[def.key];
        const value = raw != null && Number.isFinite(raw) ? raw : 0;
        const ratio = Math.max(0, Math.min(value / safeMax, 1));
        return { key: def.key, label: def.label, value: raw ?? null, ...radarPoint(index, axisCount, ratio) };
      });
      return {
        id: entry.id,
        label: entry.label ?? entry.id,
        tone: entry.tone ?? ("accent" as NlTone),
        dashed: !!entry.dashed,
        points,
        polygon: polygonAttr(points),
      };
    });

    return {
      defs,
      axisCount,
      seriesGeometry,
      rings: RADAR_RINGS.map((ring) => polygonAttr(defs.map((_, index) => radarPoint(index, axisCount, ring)))),
      spokes: defs.map((def, index) => ({ key: def.key, ...radarPoint(index, axisCount, 1) })),
      labels: defs.map((def, index) => ({ ...def, ...radarPoint(index, axisCount, RADAR_LABEL_RATIO) })),
    };
  }, [isGeneric, axisDefs, series, max]);

  const geometry = useMemo(() => {
    if (isGeneric) {
      return null;
    }
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const valueByKey = new Map<NlAxisKey, number>();
    for (const axis of axes ?? []) {
      if (axis && Number.isFinite(axis.value)) {
        valueByKey.set(axis.key, axis.value);
      }
    }
    if (valueByKey.size === 0) {
      return null;
    }

    const points = RADAR_AXIS_ORDER.map((key, index) => {
      const value = valueByKey.get(key) ?? 0;
      const ratio = Math.max(0, Math.min(value / safeMax, 1));
      return { key, value, ...radarPoint(index, RADAR_AXIS_ORDER.length, ratio) };
    });

    // Ghost-Polygon (Vorsaison-Vergleich): nur zeichnen, wenn ALLE vier
    // Achsen reale endliche Werte tragen — keine 0-Auffüllung erfinden.
    const ghostValueByKey = new Map<NlAxisKey, number>();
    for (const axis of ghostAxes ?? []) {
      if (axis && Number.isFinite(axis.value)) {
        ghostValueByKey.set(axis.key, axis.value);
      }
    }
    const ghostComplete = RADAR_AXIS_ORDER.every((key) => ghostValueByKey.has(key));
    const ghostPoints = ghostComplete
      ? RADAR_AXIS_ORDER.map((key, index) => {
          const value = ghostValueByKey.get(key) ?? 0;
          const ratio = Math.max(0, Math.min(value / safeMax, 1));
          return { key, value, ...radarPoint(index, RADAR_AXIS_ORDER.length, ratio) };
        })
      : null;

    return {
      points,
      polygon: polygonAttr(points),
      ghostPoints,
      ghostPolygon: ghostPoints ? polygonAttr(ghostPoints) : null,
      labels: RADAR_AXIS_ORDER.map((key, index) => ({ key, ...radarPoint(index, RADAR_AXIS_ORDER.length, RADAR_LABEL_RATIO) })),
    };
  }, [isGeneric, axes, ghostAxes, max]);

  if (isGeneric) {
    if (!genericGeometry) {
      return <p className={["nl-radar", "is-empty", className ?? ""].filter(Boolean).join(" ")}>Keine Achsen-Daten.</p>;
    }
    const defaultAriaLabel = `Mehrachsen-Radar: ${genericGeometry.seriesGeometry
      .map(
        (entry) =>
          `${entry.label} — ${entry.points.map((point) => `${point.label} ${formatNlNumber(point.value)}`).join(", ")}`,
      )
      .join(" · ")}`;

    return (
      <svg
        className={["nl-radar", className ?? ""].filter(Boolean).join(" ")}
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel ?? defaultAriaLabel}
      >
        {genericGeometry.rings.map((ring, index) => (
          <polygon key={`nl-radar-ring-${index}`} points={ring} className="nl-radar-ring" fill="none" />
        ))}
        {genericGeometry.spokes.map((spoke) => (
          <line
            key={`nl-radar-spoke-${spoke.key}`}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={spoke.x}
            y2={spoke.y}
            className="nl-radar-spoke"
          />
        ))}
        {genericGeometry.seriesGeometry.map((entry) => (
          <polygon
            key={entry.id}
            points={entry.polygon}
            className={`nl-radar-shape nl-radar-shape-series ${nlToneClass(entry.tone)}${entry.dashed ? " is-dashed" : ""}`}
          >
            <title>
              {entry.label}: {entry.points.map((point) => `${point.label} ${formatNlNumber(point.value)}`).join(", ")}
            </title>
          </polygon>
        ))}
        {genericGeometry.seriesGeometry.map((entry) =>
          entry.points.map((point) => (
            <circle
              key={`${entry.id}-${point.key}`}
              cx={point.x}
              cy={point.y}
              r={3}
              className={`nl-radar-dot-series ${nlToneClass(entry.tone)}`}
            >
              <title>
                {entry.label} · {point.label}: {formatNlNumber(point.value)}
              </title>
            </circle>
          )),
        )}
        {genericGeometry.labels.map((label) => (
          <text
            key={`nl-radar-label-${label.key}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="nl-radar-label"
            fill="var(--nl-mut, #93a3bd)"
          >
            <tspan x={label.x} className="nl-radar-label-name">
              {label.label}
            </tspan>
          </text>
        ))}
      </svg>
    );
  }

  if (!geometry) {
    return <p className={["nl-radar", "is-empty", className ?? ""].filter(Boolean).join(" ")}>Keine Achsen-Daten.</p>;
  }

  return (
    <svg
      className={["nl-radar", className ?? ""].filter(Boolean).join(" ")}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        ariaLabel ??
        `Achsen-Radar: ${geometry.points.map((point) => `${NL_AXIS_LABELS[point.key]} ${formatNlNumber(point.value)}`).join(", ")}`
      }
    >
      {RADAR_RINGS.map((ring) => (
        <polygon
          key={`nl-radar-ring-${ring}`}
          points={RADAR_AXIS_ORDER.map((_, index) => {
            const point = radarPoint(index, RADAR_AXIS_ORDER.length, ring);
            return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
          }).join(" ")}
          className="nl-radar-ring"
          fill="none"
        />
      ))}
      {RADAR_AXIS_ORDER.map((key, index) => {
        const outer = radarPoint(index, RADAR_AXIS_ORDER.length, 1);
        return (
          <line
            key={`nl-radar-spoke-${key}`}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={outer.x}
            y2={outer.y}
            className="nl-radar-spoke"
          />
        );
      })}
      {geometry.ghostPoints && geometry.ghostPolygon ? (
        <polygon points={geometry.ghostPolygon} className="nl-radar-ghost">
          <title>
            {ghostLabel
              ? `${ghostLabel}: ${geometry.ghostPoints
                  .map((point) => `${NL_AXIS_LABELS[point.key]} ${formatNlNumber(point.value)}`)
                  .join(", ")}`
              : "Vergleichswerte"}
          </title>
        </polygon>
      ) : null}
      <polygon points={geometry.polygon} className="nl-radar-shape" />
      {geometry.points.map((point) => (
        <circle key={`nl-radar-dot-${point.key}`} cx={point.x} cy={point.y} r={3.5} fill={NL_TONE_VAR[point.key]}>
          <title>
            {NL_AXIS_LABELS[point.key]}: {formatNlNumber(point.value)}
          </title>
        </circle>
      ))}
      {geometry.labels.map((label) => {
        const value = geometry.points.find((point) => point.key === label.key)?.value ?? 0;
        const handleAxisClick = onAxisClick ? () => onAxisClick(label.key) : undefined;
        return (
          <text
            key={`nl-radar-label-${label.key}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`nl-radar-label${handleAxisClick ? " is-clickable" : ""}`}
            fill={NL_TONE_VAR[label.key]}
            role={handleAxisClick ? "button" : undefined}
            tabIndex={handleAxisClick ? 0 : undefined}
            aria-label={
              handleAxisClick
                ? `${NL_AXIS_LABELS[label.key]} ${formatNlNumber(value)} — Liga-Leaders öffnen`
                : undefined
            }
            onClick={handleAxisClick}
            onKeyDown={
              handleAxisClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleAxisClick();
                    }
                  }
                : undefined
            }
          >
            <tspan x={label.x} dy={showValues ? "-0.35em" : "0"} className="nl-radar-label-name">
              {NL_AXIS_LABELS[label.key]}
            </tspan>
            {showValues ? (
              <tspan x={label.x} dy="1.15em" className="nl-radar-label-value">
                {formatNlNumber(value, 0)}
              </tspan>
            ) : null}
          </text>
        );
      })}
    </svg>
  );
}

export default NlRadar;
