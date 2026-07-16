"use client";

import { formatVeloNumber } from "@/components/foundation/velo-ui/formatters";

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
      aria-label={`Potential ${formatVeloNumber(rating, 0)}`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < filled ? "is-filled" : ""} />
      ))}
      <small>{formatVeloNumber(rating, 0)}</small>
    </span>
  );
}
