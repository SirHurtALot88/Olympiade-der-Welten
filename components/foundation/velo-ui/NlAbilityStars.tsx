"use client";

/**
 * NlAbilityStars — the single shared way to show player ability/potential.
 *
 * Design language (app-wide): STARS ONLY, CA beside PO. Both metrics share ONE
 * absolute scale so a given ability value always renders the same number of
 * stars everywhere (drawer, transfermarkt, roster cards, hover previews …).
 *
 * Scale: `potentialScoreToStars` (percentile-anchored to the measured league:
 * ~p50→2.75★ … ~p99+→5★, low outliers floor at 1.5★) is used for BOTH CA and
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
 * Star fill + uncertain-overlay math is derived from the same absolute scale as
 * `lib/progression/player-potential-service.ts` (`potentialScoreToStars`). Each
 * 5-star row is rendered as a fixed "★★★★★" background layer plus 1-2 absolutely
 * positioned copies of the same glyph string clipped to a `min/max` percentage of
 * the row's width (perf: this is DOM-node-per-row, not per-star — a fractional
 * fill/uncertain boundary still lands inside the right glyph because all layers
 * share identical text/font/letter-spacing, so they stay pixel-aligned). This
 * replaces an earlier per-star (5x) element loop; same visual result, far fewer
 * nodes — the players table mounts ~288+ of these per paint, so node count here
 * multiplies directly into total page DOM weight. Styling: `.nl-ability-*` in
 * `app/globals.css`.
 */

import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import { potentialScoreToStars } from "@/lib/progression/player-potential-service";

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

const STAR_GLYPHS = "★★★★★";
const STAR_COUNT = 5;

function starPercent(stars: number): number {
  return Math.max(0, Math.min(100, (stars / STAR_COUNT) * 100));
}

/**
 * Renders the 5-star row for a star range. Instead of one DOM element per
 * star (5x wrapper + fill/uncertain layers = up to ~15-20 nodes), this draws
 * the same "★★★★★" glyph string 2-3 times, stacked absolutely and clipped to
 * a width percentage — because every layer is the identical text in the
 * identical font/letter-spacing, the layers stay pixel-aligned and a
 * fractional fill still lands inside the correct star glyph, exactly as the
 * old per-star fill math did. Solid fill only when `uncertain` is false;
 * adds the hollow amber-stroke uncertain overlay (fog-of-war) otherwise.
 */
function StarRow({ min, max, uncertain }: { min: number; max: number; uncertain: boolean }) {
  const minPct = starPercent(min);
  const maxPct = starPercent(max);
  const showUncertain = uncertain && maxPct > minPct;
  const fillPct = uncertain ? minPct : maxPct;
  return (
    <span className={`nl-ability-star-row${uncertain ? " is-range" : ""}`} aria-hidden="true">
      <span className="nl-ability-star-track">{STAR_GLYPHS}</span>
      {/* Mal-Reihenfolge wie zuvor: erst die unsichere Hollow-Fläche (0..max),
          dann der solide Fill (0..min) OBEN drauf — beide bei inset:0 auto 0 0
          verankert (siehe CSS), damit sie exakt über der Track-Ebene liegen. */}
      {showUncertain ? (
        // Fog-of-war-Oberbereich: HOLLOW-Outline-Stern (transparent + amber Stroke),
        // bewusst KEIN solider Fill, damit unsicher ≠ bestätigt (nie als ★★★★★ lesbar).
        <span
          className="nl-ability-star-uncertain nl-fog-uncertain"
          style={{
            width: `${maxPct}%`,
            color: "transparent",
            WebkitTextStroke: "1.1px rgba(255, 209, 112, 0.95)",
            textShadow: "none",
          }}
        >
          {STAR_GLYPHS}
        </span>
      ) : null}
      <span className="nl-ability-star-fill" style={{ width: `${fillPct}%` }}>
        {STAR_GLYPHS}
      </span>
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
    ariaParts.push(`Aktuell ${formatNlNumber(caStars, 1)} Sterne`);
  }
  if (poRange != null) {
    ariaParts.push(
      poUncertain
        ? `Potenzial ${formatNlNumber(poRange.min, 1)} bis ${formatNlNumber(poRange.max, 1)} Sterne (geschätzt)`
        : `Potenzial ${formatNlNumber(poRange.max, 1)} Sterne`,
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
