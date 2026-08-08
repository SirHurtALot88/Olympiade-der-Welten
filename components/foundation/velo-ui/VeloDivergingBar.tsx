"use client";

/**
 * VELO-DIVERGING-BAR — zwei gegenläufige Größen um eine Mittelachse.
 *
 * Gebaut für die Transferhistorie: Ausgaben (links, Risiko-Ton) und Einnahmen (rechts,
 * Gut-Ton) desselben Teams wachsen von einer gemeinsamen Mittelachse nach außen. Zwei
 * Zahlen nebeneinander sagen das auch, aber erst der gespiegelte Balken macht auf einen
 * Blick lesbar, WOHIN ein Team tendiert — und mit `max` als gemeinsamer Skala werden
 * mehrere Zeilen (z. B. alle Teams eines Boards) direkt vergleichbar.
 *
 * Abgrenzung: `VeloSplitMeter` zerlegt EINE Größe in zwei Teile (Anteile einer Summe).
 * Hier sind es ZWEI unabhängige Größen, die gegeneinander stehen.
 */
export type VeloDivergingBarProps = {
  /** Linke Größe (z. B. Ausgaben). Negative/nicht-endliche Werte zählen als 0. */
  left: number;
  /** Rechte Größe (z. B. Einnahmen). Negative/nicht-endliche Werte zählen als 0. */
  right: number;
  /**
   * Gemeinsame Skala: der Wert, der eine Seite komplett füllen würde.
   * Ohne Angabe (oder ≤ 0) skaliert der Balken auf max(left, right) — dann ist er
   * nur in sich lesbar, nicht über Zeilen hinweg.
   */
  max?: number | null;
  leadLabelLeft: string;
  leadLabelRight: string;
  /** Formatierte Werte für die Legende; ohne beide bleibt die Legende Label-only. */
  leftValue?: string | null;
  rightValue?: string | null;
  /** Legende ganz unterdrücken (Wert steckt dann nur im aria-label/title). */
  showLegend?: boolean;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function VeloDivergingBar({
  left,
  right,
  max = null,
  leadLabelLeft,
  leadLabelRight,
  leftValue = null,
  rightValue = null,
  showLegend = true,
  compact = false,
  className = "",
  ariaLabel,
}: VeloDivergingBarProps) {
  const leftSafe = Number.isFinite(left) ? Math.max(0, left) : 0;
  const rightSafe = Number.isFinite(right) ? Math.max(0, right) : 0;
  const scale = max != null && Number.isFinite(max) && max > 0 ? max : Math.max(leftSafe, rightSafe);
  const isEmpty = scale <= 0;
  // Auf zwei Nachkommastellen gerundet — wie beim VeloSplitMeter: sonst landen
  // Fließkomma-Reste wie 39.999999 im Markup und Snapshots flattern.
  const toPercent = (value: number) => (isEmpty ? 0 : Math.round(Math.min(1, value / scale) * 10000) / 100);
  const leftPercent = toPercent(leftSafe);
  const rightPercent = toPercent(rightSafe);

  const label =
    ariaLabel ?? `${leadLabelLeft} ${leftValue ?? leftSafe}, ${leadLabelRight} ${rightValue ?? rightSafe}`;

  return (
    <div
      className={`velo-diverging-bar${compact ? " is-compact" : ""}${isEmpty ? " is-empty" : ""}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="velo-diverging-bar-track">
        <span className="velo-diverging-bar-side is-left">
          <span className="velo-diverging-bar-fill" style={{ width: `${leftPercent}%` }} />
        </span>
        <span className="velo-diverging-bar-axis" aria-hidden="true" />
        <span className="velo-diverging-bar-side is-right">
          <span className="velo-diverging-bar-fill" style={{ width: `${rightPercent}%` }} />
        </span>
      </span>
      {showLegend ? (
        <span className="velo-diverging-bar-legend nl-tnum">
          <span className="velo-diverging-bar-entry is-left">
            <span className="velo-diverging-bar-dot" aria-hidden="true" />
            {leadLabelLeft}
            {leftValue != null ? <b>{leftValue}</b> : null}
          </span>
          <span className="velo-diverging-bar-entry is-right">
            <span className="velo-diverging-bar-dot" aria-hidden="true" />
            {leadLabelRight}
            {rightValue != null ? <b>{rightValue}</b> : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}
