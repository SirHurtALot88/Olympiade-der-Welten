/**
 * Organic marginal-utility squad builder — discipline need derivation (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. PURE functions, not wired into any
 * game logic yet. Blends team identity (which axes the team cares about) with roster-gap
 * pressure (how under-covered a discipline currently is) into a 0–1 need weight per discipline,
 * then aggregates those up to the four core axes for quality weighting.
 */

import { marginalCoverageValue } from "./coverage-curve";
import {
  CATEGORY_TO_AXIS,
  CORE_AXES,
  SOLIDE_THRESHOLD,
  type CoreAxis,
  type DisciplineNeed,
  type OrganicDiscipline,
  type OrganicPlayerView,
} from "./types";

/** Weight given to the identity term vs. the roster-gap term in the needWeight blend. */
const IDENTITY_WEIGHT = 0.5;
const GAP_WEIGHT = 0.5;

/**
 * Compute a per-discipline need for a squad: how covered it already is, and a 0–1 needWeight
 * blending team identity (axis weight) with the roster gap (fewer covered players → higher
 * need, via the coverage curve's marginal value).
 */
export function computeDisciplineNeeds(
  squad: OrganicPlayerView[],
  identityAxisWeights: Record<CoreAxis, number>,
  disciplines: OrganicDiscipline[],
): DisciplineNeed[] {
  return disciplines.map((discipline) => {
    const coveredCount = squad.reduce((count, player) => {
      const rating = player.disciplineRatings[discipline.id] ?? 0;
      return rating > SOLIDE_THRESHOLD ? count + 1 : count;
    }, 0);

    const axis = CATEGORY_TO_AXIS[discipline.category];
    const identityWeight = identityAxisWeights[axis] ?? 0;
    const gapTerm = marginalCoverageValue(coveredCount);
    const needWeight = clamp01(IDENTITY_WEIGHT * identityWeight + GAP_WEIGHT * gapTerm);

    return {
      disciplineId: discipline.id,
      category: discipline.category,
      needWeight,
      coveredCount,
    };
  });
}

/**
 * Aggregate per-discipline needWeights up to the four core axes (summing each discipline's
 * needWeight into its CATEGORY_TO_AXIS axis), then normalize so the four axis weights sum to 1.
 * Falls back to a flat 0.25 per axis if every aggregate is zero.
 */
export function deriveNeedAxisWeights(needs: DisciplineNeed[]): Record<CoreAxis, number> {
  const totals: Record<CoreAxis, number> = { pow: 0, spe: 0, men: 0, soc: 0 };

  for (const need of needs) {
    const axis = CATEGORY_TO_AXIS[need.category];
    totals[axis] += need.needWeight;
  }

  const sum = CORE_AXES.reduce((acc, axis) => acc + totals[axis], 0);
  if (sum <= 0) {
    return { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };
  }

  const normalized: Record<CoreAxis, number> = { pow: 0, spe: 0, men: 0, soc: 0 };
  for (const axis of CORE_AXES) {
    normalized[axis] = totals[axis] / sum;
  }
  return normalized;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
