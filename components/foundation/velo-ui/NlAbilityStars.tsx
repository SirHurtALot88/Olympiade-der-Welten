"use client";

/**
 * NlAbilityStars — the single shared way to show player ability/potential.
 *
 * Design language (app-wide): STARS ONLY, CA beside PO. Both metrics share ONE
 * absolute scale so a given ability value always renders the same number of
 * stars everywhere (drawer, transfermarkt, roster cards, hover previews …).
 *
 * Scale: `potentialScoreToStars` (score 35–99 → 2.0–5.0★) is used for BOTH CA and
 * PO. CA stars are derived from the absolute current rating (`caScore`), NOT from
 * the league-percentile axis profile — that percentile→stars mapping is what made
 * "5★ = 58" on one player and "5★ = 94" on another. Passing an absolute `caScore`
 * guarantees the same rating → the same stars on every surface.
 *
 * Fog of war: `known === true` renders exact stars; `known === false` renders the
 * potential star-RANGE with the dark uncertain overlay (visual uncertainty only —
 * no numbers are ever shown).
 *
 * No numeric CA/PO text / ranges are rendered — the legacy `caScore` (used as the
 * CA scale driver), `poScore` and `poScoreRange` props feed the star math only.
 *
 * Star fill + uncertain-overlay math is promoted from
 * `lib/progression/player-potential-service.ts` (`buildAbilityStarRangeSlots`,
 * `potentialScoreToStars`). Styling: `.nl-ability-*` in `app/globals.css`.
 */

import { formatVeloNumber } from "@/components/foundation/velo-ui/formatters";
import {
  buildAbilityStarRangeSlots,
  potentialScoreToStars,
} from "@/lib/progression/player-potential-service";

type NlRange = { min: number; max: number };

export type NlAbilityStarsProps = {
  /**
   * Absolute current rating (0..99) — the PRIMARY CA driver. Converted to stars
   * via the shared absolute scale so CA matches PO and is consistent everywhere.
   */
  caScore?: number | null;
  /** Legacy fallback CA stars (0..5, or a label like "3,5") — only used when no `caScore`. */
  caStars?: number | string | null;
  /** Single potential stars (0..5). Used when known, or when no PO range/score is supplied. */
  poStars?: number | string | null;
  /** Potential star range in star-space (0..5) — preferred when the site already has revealed min/max stars. */
  poStarRange?: NlRange | null;
  /** Exact PO score (0..99). Drives exact stars when `known`. */
  poScore?: number | null;
  /** Potential score range (0..99): drives the star range via the shared absolute scale. */
  poScoreRange?: NlRange | null;
  /** Fog-of-war flag. `true` → exact stars; `false` → PO star-range with uncertain overlay. */
  known: boolean;
  compact?: boolean;
  /** Optional group label prefix used in the accessible description. */
  label?: string;
  tone?: "gold" | "danger";
  className?: string;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseStarValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** CA stars from the absolute current rating (shared scale) with a legacy star-value fallback. */
function resolveCaStars(props: NlAbilityStarsProps): number | null {
  if (isFiniteNumber(props.caScore)) return potentialScoreToStars(props.caScore);
  return parseStarValue(props.caStars);
}

function resolvePoStarRange(props: NlAbilityStarsProps): NlRange | null {
  if (props.poStarRange && Number.isFinite(props.poStarRange.min) && Number.isFinite(props.poStarRange.max)) {
    return { min: props.poStarRange.min, max: props.poStarRange.max };
  }
  if (props.poScoreRange && Number.isFinite(props.poScoreRange.min) && Number.isFinite(props.poScoreRange.max)) {
    return { min: potentialScoreToStars(props.poScoreRange.min), max: potentialScoreToStars(props.poScoreRange.max) };
  }
  if (isFiniteNumber(props.poScore)) {
    const single = potentialScoreToStars(props.poScore);
    return { min: single, max: single };
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
  const caStars = resolveCaStars(props);
  const poRange = resolvePoStarRange(props);
  const poUncertain = !known && poRange != null && poRange.max > poRange.min;

  const ariaParts: string[] = [];
  if (label) ariaParts.push(label);
  if (caStars != null) {
    ariaParts.push(`Aktuell ${formatVeloNumber(caStars, 1)} Sterne`);
  }
  if (poRange != null) {
    ariaParts.push(
      poUncertain
        ? `Potenzial ${formatVeloNumber(poRange.min, 1)} bis ${formatVeloNumber(poRange.max, 1)} Sterne (geschätzt)`
        : `Potenzial ${formatVeloNumber(poRange.max, 1)} Sterne`,
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
      </span>
      <span className="nl-ability-metric">
        <small className="nl-ability-metric-label">PO</small>
        {poRange != null ? (
          <StarRow min={poRange.min} max={poRange.max} uncertain={poUncertain} />
        ) : (
          <span className="nl-ability-empty">—</span>
        )}
      </span>
    </span>
  );
}
