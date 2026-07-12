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
 * Fog of war: `known === true` renders exact SOLID stars; `known === false` renders
 * the potential star-RANGE where the uncertain upper part (min→max) is drawn as
 * HOLLOW OUTLINE stars (transparent fill + amber stroke), never as solid fill — so a
 * fogged PO can NEVER be misread as a confirmed exact/5-star value. Only the certain
 * lower part (up to `min`) is solid gold (visual uncertainty only — no numbers are
 * ever shown). Outline treatment: `.nl-fog-uncertain` (scratchpad/waveA-fog.css) plus
 * the inline text-stroke below, so it renders regardless of stylesheet wiring.
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
  /**
   * Stacks the CA row above the PO row (vertical layout) instead of the
   * default side-by-side layout — saves horizontal width in dense table
   * cells. Purely a layout switch; the star math is unaffected.
   */
  stacked?: boolean;
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

/**
 * Resolves the PO star range from whichever prop the caller supplied, then
 * clamps it so PO never renders as FEWER stars than CA — potential falling
 * below current ability is illogical (it would imply the player gets
 * worse). `caStars` is the already-resolved CA star value (same absolute
 * scale, see `resolveCaStars`); both `min` and `max` of the PO range are
 * floored at `caStars` so the whole range (exact or fog-of-war) sits at or
 * above CA. Applied here (not per-caller) so every surface that renders
 * `NlAbilityStars` — home, teams, team-profile, scouting, players-table —
 * gets the fix uniformly. Fog-of-war behavior (range vs. exact, uncertain
 * overlay) is otherwise unchanged; clamping can only narrow/raise the
 * range, never widen it artificially.
 */
function resolvePoStarRange(props: NlAbilityStarsProps, caStars: number | null): NlRange | null {
  let range: NlRange | null = null;
  if (props.poStarRange && Number.isFinite(props.poStarRange.min) && Number.isFinite(props.poStarRange.max)) {
    range = { min: props.poStarRange.min, max: props.poStarRange.max };
  } else if (props.poScoreRange && Number.isFinite(props.poScoreRange.min) && Number.isFinite(props.poScoreRange.max)) {
    range = { min: potentialScoreToStars(props.poScoreRange.min), max: potentialScoreToStars(props.poScoreRange.max) };
  } else if (isFiniteNumber(props.poScore)) {
    const single = potentialScoreToStars(props.poScore);
    range = { min: single, max: single };
  } else {
    const single = parseStarValue(props.poStars);
    range = single != null ? { min: single, max: single } : null;
  }

  if (range != null && caStars != null) {
    const min = Math.max(range.min, caStars);
    const max = Math.max(range.max, caStars, min);
    range = { min, max };
  }

  return range;
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
              // Fog-of-war upper range: HOLLOW outline star (transparent fill + amber
              // stroke). Deliberately NOT a solid fill so the uncertain part reads as
              // "possible, not confirmed" and a fogged PO is never misread as ★★★★★.
              <span
                className="nl-ability-star-uncertain nl-fog-uncertain"
                style={{
                  left: `${slot.minFill * 100}%`,
                  width: `${(slot.maxFill - slot.minFill) * 100}%`,
                  color: "transparent",
                  WebkitTextStroke: "1.1px rgba(255, 209, 112, 0.95)",
                  textShadow: "none",
                }}
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
  const { known, compact = false, stacked = false, label, tone = "gold", className = "" } = props;
  const caStars = resolveCaStars(props);
  const poRange = resolvePoStarRange(props, caStars);
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
      className={`nl-ability-stars is-${tone}${compact ? " is-compact" : ""}${stacked ? " is-stacked" : ""}${
        className ? ` ${className}` : ""
      }`}
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
