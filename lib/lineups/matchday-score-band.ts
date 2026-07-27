import { INTENSITY_SCORE_RANGE, type LegacyIntensityStage } from "@/lib/lineups/legacy-lineup-modifiers";

/** Structurally identical to legacy-lineup-modifiers.ts's LegacyIntensityStage and to
 *  matchday-slot-roles.ts's own MatchdayIntensityStage — kept as its own alias here only so this
 *  module has no import-time dependency on matchday-slot-roles.ts (avoids a cycle risk). */
export type MatchdayIntensityStage = LegacyIntensityStage;

/**
 * SINGLE SOURCE OF TRUTH for "what range can a player's intensity contribution actually take at
 * resolve time": INTENSITY_SCORE_RANGE in legacy-lineup-modifiers.ts, the exact same constant
 * `scoreLegacyLineupDisciplineSide` draws from via `seededIntensityShare`. Do not fork these
 * numbers into a second literal anywhere — that produced the actual bug this module fixes: the
 * lineup UI showed a *percentage-of-score* band (matchday-slot-roles.ts's old
 * rangeLowPercent/rangeHighPercent) while the real resolve drew from a completely different
 * *absolute-points* range, so the "range" on screen was never the set of values the resolve could
 * actually produce (same bug class as PR #191's two diverging readiness implementations).
 *
 * `intensityMean` is the expectation used as the flat "erwartete Punkte" point-estimate in the
 * preview (matchday-slot-roles.ts INTENSITY_CONFIG.scoreModifier) — derived here, not hardcoded,
 * so it can never silently drift from INTENSITY_SCORE_RANGE again (that range is itself
 * ENV-tunable for balancing via OLY_INTENSITY_*_MIN/MAX).
 */
export function getIntensityScoreRange(intensity: MatchdayIntensityStage) {
  return INTENSITY_SCORE_RANGE[intensity];
}

export function getIntensityMean(intensity: MatchdayIntensityStage): number {
  const range = INTENSITY_SCORE_RANGE[intensity];
  return Number((((range.min + range.max) / 2)).toFixed(1));
}

/**
 * Band formula shared by the UI projection and the real resolve outcome. `baseRangeAnchor` is the
 * player's/side's score BEFORE the intensity contribution (role/fatigue/known-modifiers already
 * applied) — the resolve's actual score for that anchor is `baseRangeAnchor + seededIntensityShare`,
 * which always lands in `[baseRangeAnchor + range.min, baseRangeAnchor + range.max]`. That is the
 * band returned here (before any additional, intensity-UNRELATED spread terms below).
 *
 * `rangeRiskSpread`/`rivalrySpread`/`revealVariance` are kept as optional, purely additive
 * widening terms for the lineup lab's pre-existing "known unknowns" display (fatigue-risk /
 * rivalry-pressure / not-yet-revealed-modifier uncertainty) — they do NOT correspond to any real
 * resolve-time randomness (fatigue risk and rivalry pressure affect the resolved score
 * deterministically elsewhere, never as an additional random range), so they are intentionally
 * NOT part of the "same source as the outcome" guarantee. Pass them as 0 (the default) for a band
 * that is an exact mirror of what the resolve can produce.
 */
export function computeProjectedScoreBand(input: {
  baseRangeAnchor: number;
  intensity: MatchdayIntensityStage;
  rangeRiskSpread?: number | null;
  rivalrySpread?: number | null;
  revealVariance?: number | null;
}): { rangeLow: number; rangeHigh: number } {
  const range = getIntensityScoreRange(input.intensity);
  const rangeRiskSpread = input.rangeRiskSpread ?? 0;
  const rivalrySpread = input.rivalrySpread ?? 0;
  const revealVariance = Math.max(input.revealVariance ?? 0, 0);

  const rangeLow = Number(
    (input.baseRangeAnchor + range.min - rangeRiskSpread - rivalrySpread - revealVariance * 0.5).toFixed(1),
  );
  const rangeHigh = Number(
    (input.baseRangeAnchor + range.max + rangeRiskSpread + rivalrySpread + revealVariance * 0.5).toFixed(1),
  );

  return { rangeLow, rangeHigh };
}
