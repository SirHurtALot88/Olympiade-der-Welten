"use client";

import { formatNlNumber, NL_TONE_VAR, nlToneClass, type NlTone } from "@/components/foundation/new-look/nl-tones";

export type NlGaugeProps = {
  value: number;
  max?: number;
  /** Kleines Label unter dem Wert, z. B. "CA→PO" oder "Kommerz". */
  label?: string;
  tone?: NlTone;
  format?: (value: number, max: number) => string;
  title?: string;
  className?: string;
};

const GAUGE_SIZE = 96;
const GAUGE_STROKE = 9;
const GAUGE_START_DEG = -120;
const GAUGE_SWEEP_DEG = 240;

function polarPoint(centerX: number, centerY: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: centerX + radius * Math.cos(rad), y: centerY + radius * Math.sin(rad) };
}

function arcPath(centerX: number, centerY: number, radius: number, startDeg: number, endDeg: number): string {
  const start = polarPoint(centerX, centerY, radius, startDeg);
  const end = polarPoint(centerX, centerY, radius, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * Kleines Bogen-Gauge (SVG, viewBox-basiert) für Quoten wie
 * CA→PO-Fortschritt oder Kommerz-Rating.
 */
export function NlGauge({ value, max = 100, label, tone = "accent", format, title, className }: NlGaugeProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value, safeMax)) : 0;
  const ratio = safeValue / safeMax;
  const center = GAUGE_SIZE / 2;
  const radius = center - GAUGE_STROKE;
  const endDeg = GAUGE_START_DEG + Math.max(ratio * GAUGE_SWEEP_DEG, 0.001);
  const text = format ? format(safeValue, safeMax) : formatNlNumber(safeValue, 0);

  return (
    <div
      className={["nl-gauge", nlToneClass(tone), className ?? ""].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${label ?? "Wert"}: ${text} von ${formatNlNumber(safeMax, 0)}`}
      title={title}
    >
      <svg viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE * 0.78}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path
          d={arcPath(center, center, radius, GAUGE_START_DEG, GAUGE_START_DEG + GAUGE_SWEEP_DEG)}
          className="nl-gauge-track"
          fill="none"
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
        />
        <path
          d={arcPath(center, center, radius, GAUGE_START_DEG, endDeg)}
          className="nl-gauge-fill"
          fill="none"
          stroke={NL_TONE_VAR[tone]}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
        />
      </svg>
      <div className="nl-gauge-copy">
        <span className="nl-gauge-value nl-tnum">{text}</span>
        {label ? <span className="nl-gauge-label">{label}</span> : null}
      </div>
    </div>
  );
}

export default NlGauge;
