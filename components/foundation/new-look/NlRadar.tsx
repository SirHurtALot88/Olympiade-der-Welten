"use client";

import { useMemo } from "react";

import {
  formatNlNumber,
  NL_AXIS_LABELS,
  NL_TONE_VAR,
  type NlAxisKey,
} from "@/components/foundation/new-look/nl-tones";

export type NlRadarAxis = {
  key: NlAxisKey;
  value: number;
};

export type NlRadarProps = {
  /** Achsenwerte; fehlende Achsen werden mit 0 gezeichnet. */
  axes: NlRadarAxis[];
  max?: number;
  /** Werte an den Achsen-Labels mit anzeigen. */
  showValues?: boolean;
  "aria-label"?: string;
  className?: string;
};

const RADAR_SIZE = 220;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 66;
const RADAR_RINGS = [0.25, 0.5, 0.75, 1];
/** Feste Reihenfolge: POW oben, SPE rechts, MEN unten, SOC links. */
const RADAR_AXIS_ORDER: NlAxisKey[] = ["pow", "spe", "men", "soc"];

function radarPoint(axisIndex: number, ratio: number) {
  const angle = (axisIndex / RADAR_AXIS_ORDER.length) * Math.PI * 2 - Math.PI / 2;
  return {
    x: RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS * ratio,
    y: RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS * ratio,
  };
}

/**
 * Achsen-Radar (handgerolltes SVG) für die vier Spiel-Achsen
 * POW/SPE/MEN/SOC — Punkte und Labels tragen die Achsenfarben.
 */
export function NlRadar({ axes, max = 100, showValues = false, "aria-label": ariaLabel, className }: NlRadarProps) {
  const geometry = useMemo(() => {
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
      return { key, value, ...radarPoint(index, ratio) };
    });

    return {
      points,
      polygon: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
      labels: RADAR_AXIS_ORDER.map((key, index) => ({ key, ...radarPoint(index, 1.3) })),
    };
  }, [axes, max]);

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
            const point = radarPoint(index, ring);
            return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
          }).join(" ")}
          className="nl-radar-ring"
          fill="none"
        />
      ))}
      {RADAR_AXIS_ORDER.map((key, index) => {
        const outer = radarPoint(index, 1);
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
        return (
          <text
            key={`nl-radar-label-${label.key}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="nl-radar-label"
            fill={NL_TONE_VAR[label.key]}
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
