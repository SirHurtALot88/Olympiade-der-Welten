"use client";

import type { ScoutRecommendationTone, ScoutVerdict } from "@/lib/scouting/scout-verdict-service";

/**
 * FM27-artiger Bewertungskreis (Konzept: docs/design/scouting-ausbau-konzept-11-11.md, Abschnitt 2).
 *
 * - Ring-Füllung = Scouting-% (Uhrzeigersinn ab 12 Uhr) — Fortschritt, NICHT die Note.
 * - Mitte = Scout-Note 1+ bis 6 (unter Nebel „?", „2–3" oder „≈2"), darunter klein das %.
 * - Ringfarbe und Label = Ton der Empfehlung.
 *
 * Ist `onClick` gesetzt, ist der Kreis ein Button (öffnet den Scout-Bericht).
 */

export type ScoutGradeRingSize = "sm" | "md";

const RING_PX: Record<ScoutGradeRingSize, { size: number; stroke: number }> = {
  sm: { size: 40, stroke: 4 },
  md: { size: 72, stroke: 6 },
};

const TONE_COLOR: Record<ScoutRecommendationTone, string> = {
  elite: "var(--nl-elite, #5b9bff)",
  good: "var(--nl-good, #4cc56b)",
  neutral: "var(--nl-mut, #93a3bd)",
  warn: "var(--nl-warn, #e0a53a)",
  risk: "var(--nl-risk, #e5615a)",
};

export function getScoutGradeRingAriaLabel(verdict: Pick<ScoutVerdict, "gradeDisplay" | "recommendation" | "scoutingPercent">) {
  const grade = verdict.gradeDisplay === "?" ? "noch keine Note" : `Note ${verdict.gradeDisplay}`;
  return `Scout-Urteil: ${grade}, ${verdict.recommendation}, ${verdict.scoutingPercent} % gescoutet`;
}

export default function ScoutGradeRing({
  verdict,
  size = "sm",
  showLabel = false,
  expanded,
  onClick,
  className = "",
}: {
  verdict: ScoutVerdict;
  size?: ScoutGradeRingSize;
  /** Empfehlungstext unter dem Kreis (im Report-Kopf an, in der Warteschlangenzeile aus). */
  showLabel?: boolean;
  /** Für aria-expanded, wenn der Kreis einen Bericht auf-/zuklappt. */
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const { size: px, stroke } = RING_PX[size];
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.max(0, Math.min(100, verdict.scoutingPercent));
  const dash = (percent / 100) * circumference;
  const color = TONE_COLOR[verdict.displayWholeGrade == null ? "neutral" : verdict.recommendationTone];
  const ariaLabel = getScoutGradeRingAriaLabel(verdict);

  const ring = (
    <span className="scout-grade-ring-disc" style={{ width: px, height: px }}>
      <svg viewBox={`0 0 ${px} ${px}`} width={px} height={px} aria-hidden="true">
        <circle className="scout-grade-ring-track" cx={px / 2} cy={px / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="scout-grade-ring-fill"
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${circumference.toFixed(2)}`}
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
          data-testid="scout-grade-ring-progress"
          data-percent={percent}
        />
      </svg>
      <span className="scout-grade-ring-copy">
        <strong className="scout-grade-ring-grade nl-tnum" style={{ color }} data-testid="scout-grade-ring-grade">
          {verdict.gradeDisplay}
        </strong>
        <small className="scout-grade-ring-percent nl-tnum">{percent}%</small>
      </span>
    </span>
  );

  const label = showLabel ? (
    <span className="scout-grade-ring-label" style={{ color }} data-testid="scout-grade-ring-recommendation">
      {verdict.recommendation}
    </span>
  ) : null;

  const classes = `scout-grade-ring is-${size} is-tone-${verdict.displayWholeGrade == null ? "unknown" : verdict.recommendationTone}${
    className ? ` ${className}` : ""
  }`;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${classes} is-clickable`}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        aria-label={`${ariaLabel} — Scout-Bericht ${expanded ? "schließen" : "öffnen"}`}
        aria-expanded={expanded}
        title={`${verdict.recommendation} — Scout-Bericht öffnen`}
        data-testid="scout-grade-ring"
      >
        {ring}
        {label}
      </button>
    );
  }
  return (
    <span className={classes} role="img" aria-label={ariaLabel} title={verdict.recommendation} data-testid="scout-grade-ring">
      {ring}
      {label}
    </span>
  );
}
