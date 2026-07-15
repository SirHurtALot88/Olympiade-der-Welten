import type { Player } from "@/lib/data/olyDataTypes";

/**
 * Soft, non-scoring trait effects.
 *
 * AUDIT NOTE (see task brief): a separate "inert cosmetic trait" pool does
 * not actually exist in this codebase. `CANONICAL_POSITIVE_TRAITS` /
 * `CANONICAL_NEGATIVE_TRAITS` (lib/training/class-progression-config.ts) are
 * exactly the same 18+18 trait sets as `POSITIVE_MUTATOR_TRAITS` /
 * `NEGATIVE_MUTATOR_TRAITS` (lib/lineups/legacy-lineup-modifiers.ts), and
 * `character-import-service.ts` rejects any trait outside those canonical
 * lists. Every trait a player can actually have already grants a +6 scoring
 * mutator (when picked as an active discipline mutator) AND a training XP
 * factor (`LEGACY_TRAIT_TRAINING_FACTOR_PCT` in
 * lib/training/trait-training-signal.ts). There is no inert flavor-only
 * trait to "activate".
 *
 * To honor the spirit of the request — traits should feel alive through
 * soft, non-scoring systems — this module adds a SMALL, curated, additive
 * layer on top of a handful of existing traits via fatigue and team
 * popularity only. It never touches match scoring, and it never modifies
 * `POSITIVE_MUTATOR_TRAITS` / `NEGATIVE_MUTATOR_TRAITS`. Every trait picked
 * here is used on exactly one soft system, so nothing stacks a second bonus
 * on top of what the trait already does for scoring/training. Magnitudes
 * are intentionally tiny and centralized here for balance tuning.
 */

// ======================================================================
// BALANCE: fatigue accrual multipliers.
// Applied to the flat per-matchday fatigue load in
// lib/fatigue/fatigue-injury-service.ts (`MATCHDAY_FATIGUE_LOAD`). Multiple
// matching traits stack multiplicatively. Keep each factor within +/-10%.
// ======================================================================
export const COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS: Readonly<Record<string, number>> = {
  // Healthy = robust constitution -> slightly slower fatigue buildup (-6%).
  Healthy: 0.94,
  // FaintHearted = fragile/anxious -> slightly faster fatigue buildup (+6%).
  FaintHearted: 1.06,
};

/**
 * Multiplier applied to a player's per-matchday fatigue load based on their
 * traits. 1 = no effect. Stacks multiplicatively across all matching traits
 * (in practice a player has at most one of each flavor trait, so this is a
 * single small nudge in either direction).
 */
export function getPlayerFatigueLoadMultiplier(
  player: Pick<Player, "traitsPositive" | "traitsNegative">,
): number {
  let multiplier = 1;
  for (const trait of player.traitsPositive ?? []) {
    const effect = COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS[trait];
    if (effect != null) multiplier *= effect;
  }
  for (const trait of player.traitsNegative ?? []) {
    const effect = COSMETIC_TRAIT_FATIGUE_LOAD_MULTIPLIERS[trait];
    if (effect != null) multiplier *= effect;
  }
  return multiplier;
}

// ======================================================================
// BALANCE: team popularity (Beliebtheit) nudges.
// Applied additively to the `raw` composite score in
// lib/economy/team-beliebtheit.ts, as (trait weight * share of roster with
// that trait). `FanFavorite` already drives the dedicated fanFavorites
// sub-score, so it is intentionally excluded here to avoid double-counting.
// Keep |weight| small (<=0.03) so this never dominates the erfolg /
// fanFavorites / starpower sub-scores (each weighted 0.5 / 0.3 / 0.2).
// ======================================================================
export const COSMETIC_TRAIT_POPULARITY_WEIGHTS: Readonly<Record<string, number>> = {
  // Eloquent = media-savvy, well-spoken -> small fan-appeal nudge.
  Eloquent: 0.03,
  // Scandalous = tabloid trouble -> small popularity drag.
  Scandalous: -0.03,
};

/**
 * Small additive popularity bonus/malus for a team's roster, derived from
 * the share of players carrying a curated flavor trait. Returns 0 for an
 * empty roster or when no roster player carries a mapped trait.
 */
export function computeCosmeticTraitPopularityBonus(
  rosterPlayers: ReadonlyArray<Pick<Player, "traitsPositive" | "traitsNegative">>,
): number {
  if (rosterPlayers.length === 0) return 0;
  let bonus = 0;
  for (const [trait, weight] of Object.entries(COSMETIC_TRAIT_POPULARITY_WEIGHTS)) {
    const count = rosterPlayers.filter(
      (player) => player.traitsPositive?.includes(trait) || player.traitsNegative?.includes(trait),
    ).length;
    bonus += weight * (count / rosterPlayers.length);
  }
  return bonus;
}
