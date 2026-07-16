"use client";

import type { TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";

type VeloScoutMetricProps = {
  rangeLabel: string | null;
  tier: TransfermarktRatingTier | string | null;
  exactValue?: number | null;
  scoutingLevel?: number | null;
  confidence?: number | null;
  className?: string;
};

export function VeloScoutMetric({
  rangeLabel,
  tier,
  exactValue = null,
  scoutingLevel = null,
  confidence = null,
  className = "",
}: VeloScoutMetricProps) {
  const showExact = scoutingLevel != null && scoutingLevel >= 5 && exactValue != null;
  const displayRange = showExact ? String(Math.round(exactValue)) : rangeLabel ?? "?";
  const displayTier = tier ?? "?";
  const lowConfidence = scoutingLevel != null && scoutingLevel < 3;

  return (
    <span
      className={`velo-scout-metric${className ? ` ${className}` : ""}${lowConfidence ? " is-low-confidence" : ""}`}
      data-testid="velo-scout-metric"
      title={confidence != null ? `Scout-Konfidenz ${confidence}%` : undefined}
    >
      <strong>{displayRange}</strong>
      <span className={`velo-scout-metric-tier is-tier-${String(displayTier).replace("+", "plus")}`}>{displayTier}</span>
      {lowConfidence ? <span className="velo-scout-metric-uncertain">?</span> : null}
    </span>
  );
}
