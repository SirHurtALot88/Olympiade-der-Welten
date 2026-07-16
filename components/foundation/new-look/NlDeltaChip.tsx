"use client";

import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";

export type NlDeltaChipProps = {
  /** Vorzeichenbehaftete Veränderung; 0 wird neutral dargestellt. */
  value: number;
  /** Eigenes Zahlformat (bekommt den Absolutwert-losen Rohwert). */
  format?: (n: number) => string;
  /** Kehrt die Bewertung um (z. B. Gehalt: weniger = gut). */
  invert?: boolean;
  title?: string;
  className?: string;
};

function defaultFormat(n: number): string {
  return `${n > 0 ? "+" : ""}${formatNlNumber(n)}`;
}

/**
 * Vorzeichenbehafteter Delta-Chip: ▲ für Anstieg, ▼ für Rückgang,
 * eingefärbt nach good/risk (mit `invert` umkehrbar).
 */
export function NlDeltaChip({ value, format, invert = false, title, className }: NlDeltaChipProps) {
  const isValid = typeof value === "number" && Number.isFinite(value);
  const direction = !isValid || value === 0 ? "flat" : value > 0 ? "up" : "down";
  const isGood = direction === "flat" ? null : (direction === "up") !== invert;
  const toneClass = direction === "flat" ? "is-flat" : isGood ? "is-good" : "is-risk";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "±";
  const text = isValid ? (format ?? defaultFormat)(value) : "—";

  return (
    <span className={["nl-delta-chip", "nl-tnum", toneClass, className ?? ""].filter(Boolean).join(" ")} title={title}>
      <span className="nl-delta-chip-arrow" aria-hidden="true">
        {arrow}
      </span>
      {text}
    </span>
  );
}

export default NlDeltaChip;
