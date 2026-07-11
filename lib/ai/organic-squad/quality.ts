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

  const solide = countDisciplinesAbove(player.disciplineRatings, SOLIDE_THRESHOLD);
  const specialists = countDisciplinesAbove(player.disciplineRatings, SPECIALIST_THRESHOLD);
  const specialistBonus = SOLIDE_WEIGHT * solide + SPECIALIST_WEIGHT * specialists;

  return needWeightedCore + specialistBonus;
}
