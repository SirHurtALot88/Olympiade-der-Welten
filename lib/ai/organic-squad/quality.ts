/**
 * Organic marginal-utility squad builder — player quality (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. PURE function, not wired into any
 * game logic yet. Quality is derived PURELY from stats (core axes + discipline skill counts) —
 * `mvs`/`ovr`/`marketValue` MUST NEVER be read as quality here.
 */

import {
  CORE_AXES,
  countDisciplinesAbove,
  SOLIDE_THRESHOLD,
  SPECIALIST_THRESHOLD,
  type CoreAxis,
  type OrganicPlayerView,
} from "./types";

/** Weight per "solide" (>SOLIDE_THRESHOLD) discipline in the specialist bonus. */
const SOLIDE_WEIGHT = 2;
/** Additional weight per "specialist" (>SPECIALIST_THRESHOLD) discipline, on top of SOLIDE_WEIGHT. */
const SPECIALIST_WEIGHT = 4;

/**
 * Deployment cap (the "you pay a superstar for 20 disciplines but only field ~a few" reality):
 * with ≤12 players deployed per matchday and fatigue/injury, a single body can only realistically
 * contribute a handful of its disciplines. So only a player's BEST few solide/specialist disciplines
 * count toward quality — this bounds the star premium organically instead of letting a 15-discipline
 * superstar out-score everyone.
 */
const DEPLOYABLE_SOLIDE = 5;
const DEPLOYABLE_SPECIALIST = 3;

/**
 * Score a player's raw quality: need-weighted core-axis strength plus a bonus for depth/peaks
 * in their discipline ratings. Roughly 0–100+ (unbounded above via the specialist bonus).
 *
 * `needAxisWeights` should sum to ~1 (a distribution over the four core axes); if it doesn't,
 * it is defensively re-normalized so the weighted core stays on the same 0–100 scale as the
 * player's raw stats.
 */
export function computePlayerQuality(
  player: OrganicPlayerView,
  needAxisWeights: Record<CoreAxis, number>,
): number {
  const weightSum = CORE_AXES.reduce((sum, axis) => sum + (needAxisWeights[axis] ?? 0), 0);
  const normalize = weightSum > 0 ? 1 / weightSum : 0;

  const needWeightedCore = CORE_AXES.reduce((sum, axis) => {
    const weight = (needAxisWeights[axis] ?? 0) * normalize;
    return sum + weight * player[axis];
  }, 0);

  // Cap counted breadth to realistic per-matchday deployment (fatigue/≤12) so a superstar's 20-discipline
  // spread doesn't translate into 20 disciplines of value.
  const solide = Math.min(countDisciplinesAbove(player.disciplineRatings, SOLIDE_THRESHOLD), DEPLOYABLE_SOLIDE);
  const specialists = Math.min(
    countDisciplinesAbove(player.disciplineRatings, SPECIALIST_THRESHOLD),
    DEPLOYABLE_SPECIALIST,
  );
  const specialistBonus = SOLIDE_WEIGHT * solide + SPECIALIST_WEIGHT * specialists;

  return needWeightedCore + specialistBonus;
}
