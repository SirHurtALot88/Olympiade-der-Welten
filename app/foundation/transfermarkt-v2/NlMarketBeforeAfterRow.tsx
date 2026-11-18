"use client";

import { NlDeltaChip } from "@/components/foundation/new-look";

/**
 * Vorher→Nachher-Zeile. Bleibt als einziger Rest der alten Markt-Seite, weil der Verkaufs-Dialog der Teams-Ansicht
 * (`FoundationMarketSellShellHost`) sie noch nutzt. Fällt weg, sobald die Teams-Seite neu gebaut ist
 * (docs/design/seiten-umbau-fahrplan-18-11.md).
 */
export function NlMarketBeforeAfterRow({
  label,
  before,
  after,
  format,
  invert = false,
  estimateNote,
}: {
  label: string;
  before: number | null;
  after: number | null;
  format: (value: number | null) => string;
  /** Kehrt die Delta-Bewertung um (Kosten: mehr = schlechter). */
  invert?: boolean;
  estimateNote?: string;
}) {
  const delta = before != null && after != null ? after - before : null;
  return (
    <div className="nl-market-deal-row" title={estimateNote}>
      <div className="nl-market-deal-row-head">
        <span className="nl-market-deal-row-label">{label}</span>
        {delta != null && delta !== 0 ? (
          <NlDeltaChip value={delta} invert={invert} format={(n) => `${n > 0 ? "+" : ""}${format(n)}`} />
        ) : (
          <span className="nl-market-deal-flat nl-tnum">±0</span>
        )}
      </div>
      <span className="nl-market-deal-row-values nl-tnum">
        {format(before)} <span className="nl-market-deal-arrow" aria-hidden="true">→</span> {format(after)}
      </span>
    </div>
  );
}
