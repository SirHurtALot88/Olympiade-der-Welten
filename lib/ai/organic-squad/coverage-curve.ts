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
 * PEAKED support factor for a strong player's "excess" quality (the star premium above a plain solid
 * body). Encodes the product insight "wenn man einen star kauft aber das nicht supporten kann bringt
 * der nichts" from BOTH sides, anchored by EXISTING coverage (before this player is added):
 *  - unsupported (0–1 bodies): a lone star extracts little of its premium — no one to support it;
 *  - sweet spot (2–3 bodies): the star joins a supported discipline as the ~3rd/4th body → premium
 *    fully realized (peak);
 *  - over-stuffed (5+): only ~3–4 per discipline can be fielded per matchday (≤12 deploy, fatigue),
 *    so a redundant star's premium can't be used and decays back toward 0.
 * Combined with the (monotone-declining) breadth curve on the BASE body value, this makes a star's
 * total marginal value peak in the 3–4 sweet spot: valuable enough that supported stars exist, weak
 * enough that a lone star + trash and a 6th-in-a-discipline star are both poor buys.
 */
const SUPPORT_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.45],
  [1, 0.7],
  [2, 1.0],
  [3, 0.85],
  [4, 0.55],
  [5, 0.3],
  [6, 0.12],
];

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

/**
 * PEAKED support factor (0..1) for a strong player's EXCESS quality (star premium), given the number
 * of solide bodies ALREADY in the discipline: ~0.45 when unsupported (lone star), peaking at 1.0
 * around 2 existing bodies (star joins as the 3rd — sweet spot), then decaying past 4–5 as the
 * discipline over-stuffs beyond what can be fielded. Interpolated linearly between anchors, easing
 * toward 0 beyond the last. This is what makes "ambition must be covered team-wide": a star bought
 * into an empty discipline realizes little premium (so poor-but-ambitious teams build support first,
 * or land a supported mid-tier discipline, instead of a lone star + trash), and a redundant star in
 * an already-deep discipline is a poor buy too.
 */
export function disciplineSupportFactor(existingCoveredCount: number): number {
  if (!Number.isFinite(existingCoveredCount) || existingCoveredCount <= 0) {
    return SUPPORT_ANCHORS[0][1];
  }
  const last = SUPPORT_ANCHORS[SUPPORT_ANCHORS.length - 1];
  if (existingCoveredCount >= last[0]) {
    const stepsBeyond = existingCoveredCount - last[0];
    return clamp01(last[1] * Math.pow(TAIL_DECAY, stepsBeyond));
  }
  for (let i = 0; i < SUPPORT_ANCHORS.length - 1; i += 1) {
    const [n0, v0] = SUPPORT_ANCHORS[i];
    const [n1, v1] = SUPPORT_ANCHORS[i + 1];
    if (existingCoveredCount >= n0 && existingCoveredCount <= n1) {
      const t = (existingCoveredCount - n0) / (n1 - n0);
      return clamp01(v0 + t * (v1 - v0));
    }
  }
  return clamp01(last[1]);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
