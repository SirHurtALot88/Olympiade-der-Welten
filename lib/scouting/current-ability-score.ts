/**
 * Absolute (league-independent) Current Ability score.
 *
 * CA and OVR must not be conflated: OVR (`ovrNormalized`) is a LEAGUE-RELATIVE
 * rank/percentile value that only exists for active players, so a league's #1
 * player always reads as OVR 100 even when his raw axis values are mediocre.
 * CA instead has to be a pure function of the player's own POW/SPE/MEN/SOC —
 * it must work identically for free agents (no OVR at all) and must not shift
 * when other players in the league change.
 *
 * A flat 4-axis average would also be wrong: it drowns out specialists who
 * carry a single very strong axis (>60, sometimes >80) but are otherwise
 * average — those players provide real value that a plain mean erases. So the
 * axis values are sorted descending and combined with front-loaded weights
 * that let the strongest axis dominate while still crediting depth:
 *   1st (peak) 50% · 2nd 27% · 3rd 15% · 4th 8%
 * If an axis is missing, the remaining weights are renormalized so the score
 * stays on the 0–100 scale.
 *
 * Worked examples:
 *   - specialist 85/40/40/40  → 0.5·85 + 0.27·40 + 0.15·40 + 0.08·40 = 62.5
 *   - generalist 60/60/60/60  → 60
 */

const CA_PEAK_WEIGHTS = [0.5, 0.27, 0.15, 0.08] as const;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

export type CurrentAbilityCoreStats = {
  pow?: number | null;
  spe?: number | null;
  men?: number | null;
  soc?: number | null;
};

/**
 * Computes the absolute, peak-weighted Current Ability score (0–100) from raw
 * core axis values. Never touches league rank/percentile/OVR — free agents
 * and active players are scored identically. Returns null when no axis value
 * is available.
 */
export function computeCurrentAbilityScore(coreStats: CurrentAbilityCoreStats | null | undefined): number | null {
  if (!coreStats) return null;
  const sortedValues = [coreStats.pow, coreStats.spe, coreStats.men, coreStats.soc]
    .filter(isFiniteNumber)
    .sort((left, right) => right - left);
  if (sortedValues.length === 0) return null;

  const weights = CA_PEAK_WEIGHTS.slice(0, sortedValues.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const score = sortedValues.reduce((sum, value, index) => sum + value * (weights[index]! / weightSum), 0);

  return roundValue(clamp(score, 0, 100), 1);
}
