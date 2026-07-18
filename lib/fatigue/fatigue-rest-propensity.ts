/**
 * Fatigue-scaled "rest / spare the player" propensity.
 *
 * Shared math for the two AI fatigue countermeasures:
 *  - training intensity: probability of putting a player on LIGHT ("leicht") training,
 *  - discipline effort: probability of setting a discipline side to REST ("conserve" / Schonen).
 *
 * Design goals (owner intent):
 *  - probability rises with the player's fatigue (near 0 while fresh, high once tired),
 *  - high-value / star players lean toward resting earlier (protect the assets),
 *  - a cautious GM (low riskTolerance) rests earlier, a gambler pushes longer,
 *  - the decision is deterministic per (player, matchday) so previews are stable and testable.
 *
 * Grounding: fatigue costs performance (up to -25% at 80+) and drives injury risk
 * (up to 40% at 100) — see lib/fatigue/fatigue-calibration.ts — so resting a tired
 * high-value player is worth the small effort/score sacrifice.
 */

/** Below this fatigue the countermeasure never fires (fresh players train/play normally). */
export const FATIGUE_REST_FLOOR = 45;
/** At/above this fatigue the ramp reaches its configured ceiling. */
export const FATIGUE_REST_CEILING = 88;
/** Convex exponent: keeps probability low just above the floor, rising steeply late. */
const FATIGUE_REST_RAMP_GAMMA = 1.7;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Deterministic pseudo-random unit interval in [0, 1) from an arbitrary seed string
 * (FNV-1a). Used to turn a probability into a stable per-entity decision.
 */
export function stableRestRoll(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export type FatigueRestProbabilityInput = {
  /** Player (or side-representative) fatigue, 0..100. */
  fatigue: number;
  /**
   * Star / high-value lean in roughly [0, 0.6]: how much earlier this asset should be
   * spared. 0 = squad filler, ~0.5 = franchise player.
   */
  valueLean?: number;
  /**
   * GM caution in roughly [-1, 1]: positive = cautious (rest earlier),
   * negative = risk-tolerant gambler (push longer). Derived from GM riskTolerance bias.
   */
  caution?: number;
  /**
   * Rotation depth lean in roughly [0, 0.4]: extra willingness to rest when the squad
   * has cover. 0 = thin squad, must field the tired player.
   */
  depthLean?: number;
  /** Ceiling probability at full fatigue before leans/caution. Defaults to 0.85. */
  ceiling?: number;
};

/**
 * Probability in [0, 1] that the AI should rest / lighten this player's load.
 * Returns exactly 0 below FATIGUE_REST_FLOOR so fresh players are never touched.
 */
export function fatigueRestProbability(input: FatigueRestProbabilityInput): number {
  const fatigue = Number.isFinite(input.fatigue) ? input.fatigue : 0;
  if (fatigue <= FATIGUE_REST_FLOOR) {
    return 0;
  }
  const span = FATIGUE_REST_CEILING - FATIGUE_REST_FLOOR;
  const t = clamp01((fatigue - FATIGUE_REST_FLOOR) / span);
  const ramp = Math.pow(t, FATIGUE_REST_RAMP_GAMMA);
  const ceiling = clamp01(input.ceiling ?? 0.85);

  let p = ceiling * ramp;
  // Stars lean into resting earlier (multiplicative so filler players stay low).
  p *= 1 + Math.max(0, input.valueLean ?? 0);
  // Rotation depth and GM caution shift the curve additively.
  p += Math.max(0, input.depthLean ?? 0) * ramp;
  p += (input.caution ?? 0) * 0.15 * ramp;

  return clamp01(Math.min(0.98, p));
}

/**
 * Convenience: deterministic yes/no rest decision for a given entity + probability.
 */
export function shouldRestForFatigue(input: FatigueRestProbabilityInput & { seed: string }): {
  rest: boolean;
  probability: number;
} {
  const probability = fatigueRestProbability(input);
  if (probability <= 0) {
    return { rest: false, probability };
  }
  return { rest: stableRestRoll(input.seed) < probability, probability };
}
