"use client";

/**
 * VELO-SPLIT-METER — eine Größe, in zwei Teile zerlegt.
 *
 * Gebaut für die Vertragsauflösung: der offene Rest-Buyout zerfällt in „der Spieler verzichtet"
 * und „das Team zahlt". Zwei Zahlen nebeneinander sagen das auch, aber erst der geteilte Balken
 * macht das VERHAELTNIS auf einen Blick lesbar — und genau darum geht es bei der Entscheidung.
 *
 * Bewusst zwei Segmente und nicht n: sobald es drei oder mehr werden, ist `VeloImpactStrip` die
 * bessere Antwort (Kacheln mit eigener Beschriftung statt eines Balkens, den niemand mehr liest).
 */
export type VeloSplitMeterProps = {
  /** Anteil des ERSTEN Segments, 0…1. Der Rest gehört dem zweiten. */
  share: number;
  leadLabel: string;
  leadValue: string;
  restLabel: string;
  restValue: string;
  /** Farbrolle des ersten Segments — „good" heißt: dieser Teil kommt dem Team zugute. */
  leadTone?: "good" | "warn" | "neutral";
  className?: string;
  ariaLabel?: string;
};

export function VeloSplitMeter({
  share,
  leadLabel,
  leadValue,
  restLabel,
  restValue,
  leadTone = "good",
  className = "",
  ariaLabel,
}: VeloSplitMeterProps) {
  const anteil = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0;
  // Auf zwei Nachkommastellen gerundet: sonst landen Fließkomma-Reste wie 39.999999 im Markup
  // und die Snapshot-Tests lesen jedes Mal etwas anderes.
  const prozent = Math.round(anteil * 10000) / 100;

  return (
    <div
      className={`velo-split-meter is-lead-${leadTone}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={ariaLabel ?? `${leadLabel} ${leadValue}, ${restLabel} ${restValue}`}
    >
      <span className="velo-split-meter-track">
        <span className="velo-split-meter-lead" style={{ width: `${prozent}%` }} />
      </span>
      <span className="velo-split-meter-legend nl-tnum">
        <span className="velo-split-meter-entry is-lead">
          <span className="velo-split-meter-dot" aria-hidden="true" />
          {leadLabel} <b>{leadValue}</b>
        </span>
        <span className="velo-split-meter-entry is-rest">
          <span className="velo-split-meter-dot" aria-hidden="true" />
          {restLabel} <b>{restValue}</b>
        </span>
      </span>
    </div>
  );
}
