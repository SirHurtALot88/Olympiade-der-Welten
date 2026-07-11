"use client";

import { formatNlNumber, nlToneClass, type NlTone } from "@/components/foundation/new-look/nl-tones";

export type NlProgressBarProps = {
  value: number;
  max?: number;
  /** Kleines Label links über der Bar. */
  label?: string;
  /**
   * Fester Ton. Ohne Angabe wird der Ton aus dem Füllgrad abgeleitet:
   * < 33 % → risk, < 66 % → warn, sonst good (mit `invert` gespiegelt,
   * z. B. für Verschleiß-/Wear-Bars, bei denen voll = schlecht).
   */
  tone?: NlTone;
  /** Kehrt die automatische Schwellen-Bewertung um. */
  invert?: boolean;
  /** Wert rechts anzeigen (Standard: an). */
  showValue?: boolean;
  format?: (value: number, max: number) => string;
  title?: string;
  className?: string;
};

function autoTone(ratio: number, invert: boolean): NlTone {
  const effective = invert ? 1 - ratio : ratio;
  if (effective < 1 / 3) {
    return "risk";
  }
  if (effective < 2 / 3) {
    return "warn";
  }
  return "good";
}

/**
 * Beschriftete Fortschritts-/Verschleiß-Bar mit Ton nach Füllgrad
 * oder festem Ton (z. B. Achsenfarbe).
 */
export function NlProgressBar({
  value,
  max = 100,
  label,
  tone,
  invert = false,
  showValue = true,
  format,
  title,
  className,
}: NlProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value, safeMax)) : 0;
  const ratio = safeValue / safeMax;
  const resolvedTone = tone ?? autoTone(ratio, invert);
  const text = format ? format(safeValue, safeMax) : `${formatNlNumber(safeValue, 0)} / ${formatNlNumber(safeMax, 0)}`;

  return (
    <div
      className={["nl-progress", nlToneClass(resolvedTone), className ?? ""].filter(Boolean).join(" ")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-label={label ?? "Fortschritt"}
      title={title}
    >
      {label || showValue ? (
        <div className="nl-progress-head">
          {label ? <span className="nl-progress-label">{label}</span> : <span />}
          {showValue ? <span className="nl-progress-value nl-tnum">{text}</span> : null}
        </div>
      ) : null}
      <div className="nl-progress-track">
        <div className="nl-progress-fill" style={{ width: `${Math.round(ratio * 1000) / 10}%` }} />
      </div>
    </div>
  );
}

export default NlProgressBar;
