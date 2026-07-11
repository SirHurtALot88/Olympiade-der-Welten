"use client";

import { joinClassNames } from "@/lib/foundation/tabs/foundation-page-module-helpers";

type RanksRankCellProps = {
  rank: number;
  delta?: number | null;
  className?: string;
};

export function RanksRankCell({ rank, delta, className }: RanksRankCellProps) {
  const deltaTone =
    delta == null || delta === 0 ? null : delta > 0 ? "is-improved" : "is-declined";
  const deltaLabel =
    delta == null || delta === 0 ? null : delta > 0 ? `(+${delta})` : `(${delta})`;

  return (
    <span className={joinClassNames("ranks-rank-cell", className)}>
      <span className="ranks-rank-value">{rank}</span>
      {deltaLabel ? (
        <span className={joinClassNames("ranks-rank-delta", deltaTone)} aria-label={`Platzänderung ${deltaLabel}`}>
          {deltaLabel}
        </span>
      ) : null}
    </span>
  );
}
