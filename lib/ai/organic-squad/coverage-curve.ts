/**
 * Organic marginal-utility squad builder — discipline coverage curve (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. PURE function, not wired into any
 * game logic yet. Encodes diminishing returns for stacking "solide" players in a single
 * discipline: a sweet spot around 3–4 players, still strong at 5–6, then a cliff from 7 on.
 */

/**
 * Anchor points: [coveredCount, marginal value of adding the (coveredCount+1)-th solide player].
 * Monotonically decreasing by construction; interpolated linearly between points.
 */
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 1.0],
  [1, 0.95],
  [2, 0.85],
  [3, 0.65],
  [4, 0.4],
  [5, 0.22],
  [6, 0.06],
  [7, 0.03],
];

/** Per-step decay applied beyond the last anchor, so the tail keeps easing toward 0. */
const TAIL_DECAY = 0.5;

/**
 * Marginal value (0–1) of adding the (currentCoveredCount + 1)-th "solide" player to a single
 * discipline. Strictly decreasing in currentCoveredCount: sweet spot at 3–4 players, still
 * meaningful at 5–6, negligible (≤0.03) from 7 on. Negative/absurd inputs are clamped.
 */
export function marginalCoverageValue(currentCoveredCount: number): number {
  if (!Number.isFinite(currentCoveredCount) || currentCoveredCount < 0) {
    return ANCHORS[0][1];
  }

  const lastAnchor = ANCHORS[ANCHORS.length - 1];
  if (currentCoveredCount >= lastAnchor[0]) {
    const stepsBeyond = currentCoveredCount - lastAnchor[0];
    const value = lastAnchor[1] * Math.pow(TAIL_DECAY, stepsBeyond);
    return clamp01(value);
  }

  for (let i = 0; i < ANCHORS.length - 1; i += 1) {
    const [n0, v0] = ANCHORS[i];
    const [n1, v1] = ANCHORS[i + 1];
    if (currentCoveredCount >= n0 && currentCoveredCount <= n1) {
      const t = (currentCoveredCount - n0) / (n1 - n0);
      return clamp01(v0 + t * (v1 - v0));
    }
  }

  // Unreachable given the loop above, but keep the function total.
  return clamp01(lastAnchor[1]);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
