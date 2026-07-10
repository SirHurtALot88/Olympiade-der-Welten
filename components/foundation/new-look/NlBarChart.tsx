"use client";

import { useMemo } from "react";

import { formatNlNumber, NL_TONE_VAR, type NlTone } from "@/components/foundation/new-look/nl-tones";

export type NlBarChartBar = {
  label: string;
  value: number;
  tone?: NlTone;
};

export type NlBarChartProps = {
  bars: NlBarChartBar[];
  /** Fester Maximalwert; sonst Maximum der Daten. */
  max?: number;
  format?: (value: number) => string;
  "aria-label"?: string;
  className?: string;
};

const BAR_HEIGHT = 148;
const BAR_PADDING_TOP = 16;
const BAR_PADDING_BOTTOM = 30;
const BAR_SLOT_WIDTH = 46;
const BAR_PADDING_X = 8;

/**
 * Kleines Balken-Chart (handgerolltes SVG, gleiche Geometrie-Schule
 * wie PlayerAttributeProgressChart): Wert über dem Balken, Label darunter.
 */
export function NlBarChart({ bars, max, format, "aria-label": ariaLabel, className }: NlBarChartProps) {
  const geometry = useMemo(() => {
    const entries = (bars ?? []).filter((bar) => bar != null);
    if (entries.length === 0) {
      return null;
    }

    const width = BAR_PADDING_X * 2 + entries.length * BAR_SLOT_WIDTH;
    const innerHeight = BAR_HEIGHT - BAR_PADDING_TOP - BAR_PADDING_BOTTOM;
    const values = entries.map((bar) => (Number.isFinite(bar.value) ? bar.value : 0));
    const maxValue = Math.max(max != null && Number.isFinite(max) && max > 0 ? max : 0, ...values, 1e-9);
    const barWidth = Math.min(20, BAR_SLOT_WIDTH * 0.52);

    const items = entries.map((bar, index) => {
      const hasValue = Number.isFinite(bar.value);
      const clamped = hasValue ? Math.max(0, Math.min(bar.value, maxValue)) : 0;
      const barHeight = (clamped / maxValue) * innerHeight;
      const centerX = BAR_PADDING_X + index * BAR_SLOT_WIDTH + BAR_SLOT_WIDTH / 2;
      return {
        bar,
        value: hasValue ? bar.value : null,
        centerX,
        x: centerX - barWidth / 2,
        y: BAR_PADDING_TOP + innerHeight - barHeight,
        width: barWidth,
        height: barHeight,
      };
    });

    return { width, innerHeight, items };
  }, [bars, max]);

  if (!geometry) {
    return (
      <p className={["nl-barchart", "is-empty", className ?? ""].filter(Boolean).join(" ")}>Keine Daten vorhanden.</p>
    );
  }

  const formatValue = format ?? ((value: number) => formatNlNumber(value));

  return (
    <svg
      className={["nl-barchart", className ?? ""].filter(Boolean).join(" ")}
      viewBox={`0 0 ${geometry.width} ${BAR_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel ?? "Balkendiagramm"}
    >
      <line
        x1={BAR_PADDING_X}
        y1={BAR_HEIGHT - BAR_PADDING_BOTTOM}
        x2={geometry.width - BAR_PADDING_X}
        y2={BAR_HEIGHT - BAR_PADDING_BOTTOM}
        className="nl-barchart-axis"
      />
      {geometry.items.map((item, index) => {
        const fill = NL_TONE_VAR[item.bar.tone ?? "accent"];
        return (
          <g key={`nl-bar-${item.bar.label}-${index}`}>
            {item.height > 0 ? (
              <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={3} fill={fill} className="nl-barchart-bar">
                <title>
                  {item.bar.label}: {item.value != null ? formatValue(item.value) : "—"}
                </title>
              </rect>
            ) : null}
            <text
              x={item.centerX}
              y={item.height > 0 ? item.y - 5 : BAR_PADDING_TOP + geometry.innerHeight / 2}
              textAnchor="middle"
              className="nl-barchart-value"
            >
              {item.value != null ? formatValue(item.value) : "—"}
            </text>
            <text x={item.centerX} y={BAR_HEIGHT - 10} textAnchor="middle" className="nl-barchart-label">
              {item.bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default NlBarChart;
