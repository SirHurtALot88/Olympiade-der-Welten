"use client";

/**
 * NlAbilityStars — the single shared way to show player ability/potential.
 *
 * Design language (app-wide): STARS everywhere, PLUS the exact CA/PO number when the
 * value is KNOWN (own team / scouted-exact / build phase), and a STAR-RANGE (+ number
 * range "72–80") with an uncertain overlay when it is UNKNOWN (fog of war).
 *
 * Star fill + uncertain-overlay math is NOT reinvented here — it is promoted from
 * `lib/progression/player-potential-service.ts` (`buildAbilityStarRangeSlots`,
 * `potentialScoreToStars`), the same source the drawer range renderer uses.
 *
 * Styling: `.nl-ability-stars*` in `app/globals.css`, reusing the existing gold star
 * visuals (shared with `.velo-star-*` / `.player-drawer-star-*`). Rendered only from
 * new-look surfaces; the classes are global (like `.velo-*`) so a caller that also
 * lives in a flag-off code path stays visually intact.
 */

import { formatVeloNumber } from "@/components/foundation/velo-ui/formatters";
import {
  buildAbilityStarRangeSlots,
  potentialScoreToStars,
} from "@/lib/progression/player-potential-service";

type NlRange = { min: number; max: number };

export type NlAbilityStarsProps = {
  /** Current-ability stars (0..5). A display label ("3.5", "3,5 ★") is parsed too. */
  caStars: number | string | null | undefined;
  /** Exact CA number (developmentInsight.currentRating). Appended only when `known`. */
  caScore?: number | null;
  /** Single potential stars (0..5). Used when known, or when no PO range is supplied. */
  poStars?: number | string | null;
  /** Potential star range in star-space (0..5) — preferred when the site already has revealed min/max stars. */
  poStarRange?: NlRange | null;
  /** Exact PO number. Appended only when `known`. */
  poScore?: number | null;
  /** Potential score range (0..100): drives the "72–80" text and, absent `poStarRange`, the star range. */
  poScoreRange?: NlRange | null;
  /** Fog-of-war flag. Exact numbers appended only when true; range + uncertain overlay when false. */
  known: boolean;
  compact?: boolean;
  /** Optional group label prefix used in the accessible description. */
  label?: string;
  tone?: "gold" | "danger";
  className?: string;
};

function parseStarValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolvePoStarRange(props: NlAbilityStarsProps): NlRange | null {
  if (props.poStarRange && Number.isFinite(props.poStarRange.min) && Number.isFinite(props.poStarRange.max)) {
    return { min: props.poStarRange.min, max: props.poStarRange.max };
  }
  if (props.poScoreRange && Number.isFinite(props.poScoreRange.min) && Number.isFinite(props.poScoreRange.max)) {
    return { min: potentialScoreToStars(props.poScoreRange.min), max: potentialScoreToStars(props.poScoreRange.max) };
  }
  const single = parseStarValue(props.poStars);
  return single != null ? { min: single, max: single } : null;
}

/** Renders the 5-star row for a star range. Solid fill when `uncertain` is false; adds the dark uncertain overlay otherwise. */
function StarRow({ min, max, uncertain }: { min: number; max: number; uncertain: boolean }) {
  const slots = buildAbilityStarRangeSlots(min, max);
  return (
    <span className={`nl-ability-star-row${uncertain ? " is-range" : ""}`} aria-hidden="true">
      {slots.map((slot) => {
        if (uncertain && slot.maxFill <= 0) {
          return (
            <span key={slot.index} className="nl-ability-star is-inactive">
              <span className="nl-ability-star-empty">★</span>
            </span>
          );
        }
        return (
          <span key={slot.index} className={`nl-ability-star${slot.showUncertain ? " has-uncertain" : ""}`}>
            <span className="nl-ability-star-empty">★</span>
            {slot.minFill > 0 || !uncertain ? (
              <span
                className="nl-ability-star-fill"
                style={{ width: `${(uncertain ? slot.minFill : slot.maxFill) * 100}%` }}
              >
                ★
              </span>
            ) : null}
            {uncertain && slot.showUncertain ? (
              <span
                className="nl-ability-star-uncertain"
                style={{ left: `${slot.minFill * 100}%`, width: `${(slot.maxFill - slot.minFill) * 100}%` }}
              >
                ★
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function NlAbilityStars(props: NlAbilityStarsProps) {
  const { known, compact = false, label, tone = "gold", className = "" } = props;
  const caStars = parseStarValue(props.caStars);
  const poRange = resolvePoStarRange(props);
  const poUncertain = !known && poRange != null && poRange.max > poRange.min;

  const caNumber = known && props.caScore != null && Number.isFinite(props.caScore) ? formatVeloNumber(props.caScore, 0) : null;
  const poNumber = (() => {
    if (known) {
      if (props.poScore != null && Number.isFinite(props.poScore)) return formatVeloNumber(props.poScore, 0);
      if (props.poScoreRange) {
        const { min, max } = props.poScoreRange;
        return min === max ? formatVeloNumber(min, 0) : `${formatVeloNumber(min, 0)}–${formatVeloNumber(max, 0)}`;
      }
      return null;
    }
    if (props.poScoreRange) {
      const { min, max } = props.poScoreRange;
      return min === max ? formatVeloNumber(min, 0) : `${formatVeloNumber(min, 0)}–${formatVeloNumber(max, 0)}`;
    }
    return null;
  })();

  const ariaParts: string[] = [];
  if (label) ariaParts.push(label);
  if (caStars != null) {
    ariaParts.push(`Aktuell ${formatVeloNumber(caStars, 1)} Sterne${caNumber ? ` (${caNumber})` : ""}`);
  }
  if (poRange != null) {
    ariaParts.push(
      poUncertain
        ? `Potenzial ${formatVeloNumber(poRange.min, 1)} bis ${formatVeloNumber(poRange.max, 1)} Sterne (unsicher${poNumber ? `, ${poNumber}` : ""})`
        : `Potenzial ${formatVeloNumber(poRange.max, 1)} Sterne${poNumber ? ` (${poNumber})` : ""}`,
    );
  }
  ariaParts.push(known ? "bekannt" : "geschätzt");

  return (
    <span
      className={`nl-ability-stars is-${tone}${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      data-known={known ? "true" : "false"}
      role="img"
      aria-label={ariaParts.join(", ")}
    >
      <span className="nl-ability-metric">
        <small className="nl-ability-metric-label">CA</small>
        {caStars != null ? (
          <StarRow min={caStars} max={caStars} uncertain={false} />
        ) : (
          <span className="nl-ability-empty">—</span>
        )}
        {caNumber ? <span className="nl-ability-num nl-tnum">{caNumber}</span> : null}
      </span>
      <span className="nl-ability-metric">
        <small className="nl-ability-metric-label">PO</small>
        {poRange != null ? (
          <StarRow min={poRange.min} max={poRange.max} uncertain={poUncertain} />
        ) : (
          <span className="nl-ability-empty">—</span>
        )}
        {poNumber ? <span className="nl-ability-num nl-tnum">{poNumber}</span> : null}
      </span>
    </span>
  );
}
