"use client";

import ScoutGradeRing from "@/app/foundation/scouting-center-v2/ScoutGradeRing";
import { VeloAxisRail, type VeloAxisRailEntry } from "@/components/foundation/velo-ui/VeloAxisRail";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import type { ScoutVerdict, ScoutVerdictTone } from "@/lib/scouting/scout-verdict-service";

/**
 * Der „kleine Bericht vom Scout" (Konzept Abschnitt 3): erst das Urteil, dann das Warum, dann die
 * Einordnung POW/SPE/MEN/SOC im Transfermarkt-Muster (Wert-Meter mit Team-Top-6-Ø als Marke,
 * Rang im eigenen Kader).
 *
 * Eine Komponente, zwei Orte: aufgeklappt unter einer Warteschlangenzeile (`compact`) und als erste
 * Karte im Reiter „Scouting Report".
 */

const AXIS_LABEL: Record<string, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

const TONE_MARK: Record<ScoutVerdictTone, string> = {
  positive: "+",
  neutral: "•",
  negative: "−",
};

export default function ScoutVerdictReport({
  verdict,
  playerName,
  compact = false,
  onClose,
}: {
  verdict: ScoutVerdict;
  playerName: string;
  compact?: boolean;
  onClose?: () => void;
}) {
  const railEntries: VeloAxisRailEntry[] = verdict.axisComparison.flatMap((row) =>
    row.value != null ? [{ axis: row.axis, value: row.value, reference: row.teamTopAverage }] : [],
  );
  const hasRanks = verdict.axisComparison.some((row) => row.rankLabel != null);

  return (
    <section
      className={`scout-verdict-report${compact ? " is-compact" : ""}`}
      data-testid="scout-verdict-report"
      aria-label={`Scout-Bericht ${playerName}`}
    >
      <header className="scout-verdict-head">
        <ScoutGradeRing verdict={verdict} size="md" showLabel />
        <div className="scout-verdict-head-copy">
          <span className="eyebrow">Scout-Bericht · {playerName}</span>
          <p className="scout-verdict-summary" data-testid="scout-verdict-summary">
            „{verdict.summary}"
          </p>
        </div>
        {onClose ? (
          <button type="button" className="ghost-button inline-button scout-verdict-close" onClick={onClose} aria-label="Scout-Bericht schließen">
            ✕
          </button>
        ) : null}
      </header>

      <ul className="scout-verdict-criteria" aria-label="Begründung des Scouts">
        {verdict.criteria.map((criterion) => (
          <li key={criterion.id} className={`scout-verdict-criterion is-${criterion.tone}`} data-testid={`scout-verdict-criterion-${criterion.id}`}>
            <span className="scout-verdict-criterion-mark" aria-hidden="true">
              {TONE_MARK[criterion.tone]}
            </span>
            <strong>{criterion.label}</strong>
            <span>{criterion.text}</span>
          </li>
        ))}
      </ul>

      <div className="scout-verdict-axes" data-testid="scout-verdict-axes">
        <span className="eyebrow">Einordnung im Kader · POW / SPE / MEN / SOC</span>
        {railEntries.length > 0 ? (
          <VeloAxisRail entries={railEntries} max={100} referenceLabel="Team Top-6 Ø" aria-label="Achsen gegen Team Top-6 Ø" />
        ) : null}
        {hasRanks ? (
          <div className="scout-verdict-axis-ranks">
            {verdict.axisComparison.map((row) => (
              <span key={row.axis} className={`scout-verdict-axis-rank nl-tone-${row.axis}`}>
                <b>{AXIS_LABEL[row.axis]}</b>
                <small>
                  {row.rankLabel ? `Rang ${row.rankLabel}` : "—"}
                  {row.teamTopAverage != null ? ` · Team-Ø ${formatNlNumber(row.teamTopAverage, 1)}` : ""}
                </small>
              </span>
            ))}
          </div>
        ) : (
          <p className="muted scout-verdict-axes-hidden">
            {verdict.visibility === "unknown"
              ? "Noch nicht genug gesehen — die Einordnung erscheint ab 25 % Scouting."
              : "Noch kein eigener Kader zum Vergleichen."}
          </p>
        )}
      </div>
    </section>
  );
}
