"use client";

export type VeloRangeBarProps = {
  low: number | null | undefined;
  high: number | null | undefined;
  point?: number | null | undefined;
  tone?: "positive" | "negative" | "neutral" | "warning";
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
};

const DOMAIN_PADDING = 3;

/**
 * Horizontal range bar: shaded band from `low` to `high` with a marker at `point`.
 * The rendering domain is derived from the values themselves (not a fixed 0-100 scale), so a
 * wide low/high spread (e.g. Push intensity) visibly renders a wider band than a narrow spread
 * (e.g. Schonen), which is the whole point of surfacing the range at all.
 */
export function VeloRangeBar({ low, high, point = null, tone = "neutral", className = "", compact = false }: VeloRangeBarProps) {
  if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) {
    return <span className={`velo-range-bar is-empty${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true" />;
  }

  const safeLow = Math.min(low, high, point ?? low);
  const safeHigh = Math.max(low, high, point ?? high);
  const domainMin = safeLow - DOMAIN_PADDING;
  const domainMax = safeHigh + DOMAIN_PADDING;
  const domainWidth = Math.max(domainMax - domainMin, 0.01);
  const toPercent = (value: number) => Math.min(100, Math.max(0, ((value - domainMin) / domainWidth) * 100));

  const bandLeft = toPercent(Math.min(low, high));
  const bandRight = toPercent(Math.max(low, high));
  const pointPercent = point != null && Number.isFinite(point) ? toPercent(point) : null;
  const label = `Projektion ${low.toFixed(1)} bis ${high.toFixed(1)}${point != null ? `, Fokus ${point.toFixed(1)}` : ""}`;

  return (
    <span
      className={`velo-range-bar is-${tone}${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="velo-range-bar-track" />
      <span className="velo-range-bar-band" style={{ left: `${bandLeft}%`, width: `${Math.max(bandRight - bandLeft, 2)}%` }} />
      {pointPercent != null ? <span className="velo-range-bar-point" style={{ left: `${pointPercent}%` }} /> : null}
    </span>
  );
}
