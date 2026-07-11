"use client";

import { formatVeloNumber } from "@/components/foundation/velo-ui/formatters";

function parseStarValue(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

type VeloStarRatingProps = {
  value: string | number | null | undefined;
  label?: string;
  compact?: boolean;
  tone?: "gold" | "danger";
  className?: string;
};

export function VeloStarRating({
  value,
  label,
  compact = false,
  tone = "gold",
  className = "",
}: VeloStarRatingProps) {
  const rating = parseStarValue(value);
  if (rating == null) {
    return <span className={`velo-star-rating is-empty${className ? ` ${className}` : ""}`}>—</span>;
  }

  return (
    <span
      className={`velo-star-rating is-${tone}${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      aria-label={`${label ? `${label}: ` : ""}${formatVeloNumber(rating, 1)} von 5 Sternen`}
      title={`${label ? `${label}: ` : ""}${formatVeloNumber(rating, 1)} / 5`}
    >
      {label ? <span className="velo-star-label">{label}</span> : null}
      <span className="velo-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => {
          const fillPct = Math.max(0, Math.min(100, (rating - index) * 100));
          return (
            <span key={`star-${index}`} className="velo-star">
              <span className="velo-star-empty">★</span>
              <span className="velo-star-fill" style={{ width: `${fillPct}%` }}>
                ★
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function parseVeloStarRating(value: string | number | null | undefined) {
  return parseStarValue(value);
}
