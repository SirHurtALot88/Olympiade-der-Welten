"use client";

import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";

type VeloPotentialStarsProps = {
  rating: number | null;
  className?: string;
};

export function VeloPotentialStars({ rating, className = "" }: VeloPotentialStarsProps) {
  if (rating == null || !Number.isFinite(rating)) {
    return <span className={`velo-potential-stars training-v2-rider-stars is-muted${className ? ` ${className}` : ""}`}>Potential —</span>;
  }
  const filled = Math.max(0, Math.min(5, Math.round(rating / 20)));
  return (
    <span
      className={`velo-potential-stars training-v2-rider-stars${className ? ` ${className}` : ""}`}
      aria-label={`Potential ${formatNlNumber(rating, 0)}`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < filled ? "is-filled" : ""} />
      ))}
      <small>{formatNlNumber(rating, 0)}</small>
    </span>
  );
}
