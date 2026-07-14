import type { AdminBalancingConfigInput, Player, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { AttributeHeadroomState } from "@/lib/scouting/player-attribute-ceiling-service";
import { getAttributeGrowthMultiplier } from "@/lib/scouting/player-attribute-ceiling-service";
import {
  getClassTrainingProfile,
  normalizeProgressionClassName,
  PROGRESSION_ATTRIBUTE_ORDER,
  PROGRESSION_CLASS_ORDER,
  type ProgressionClassName,
} from "@/lib/training/class-progression-config";
import {
  classNameToDevelopmentRoute,
  getOrganicGrowthMultiplier,
} from "@/lib/training/organic-season-progression";
import { deriveAttributeAffinityProfile, getAttributeAffinityKind } from "@/lib/training/training-levelup-service";
import { getDevelopmentRouteBonusMultiplier } from "@/lib/training/development-route-bonus";
import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";

export type ClassTrainingGainEstimateInput = {
  /** Full player record — used to derive the signature/weak attribute affinity profile via `deriveAttributeAffinityProfile`. */
  player: Player;
  /**
   * The player's currently assigned training class (e.g. `row.trainingClass`). Used to (a) flag
   * `isCurrentClass` and (b) divide the current class's development-route bonus back out of the
   * incoming budget so every candidate class is scored with its OWN route multiplier.
   */
  currentClassName: string | null | undefined;
  /**
   * The player's real, already trait-/potential-/facility-adjusted training budget for the CURRENT
   * class (e.g. `row.organicForecast.trainingSetpoints`). This value already bakes in the current
   * class's development-route bonus, so it is divided back out before being redistributed across
   * candidate classes — see `estimateClassTrainingGains` doc comment.
   */
  trainingSetpoints: number;
  /**
   * Per-attribute potential-ceiling headroom state (e.g. `row.attributeForecast[*].ceilingState`).
   * Attributes missing from this map are treated as "open" (no headroom penalty), matching the
   * default used elsewhere in the training views when a ceiling state hasn't been resolved yet.
   */
  ceilingStateByAttribute: Partial<Record<PlayerGeneratorAttributeName, AttributeHeadroomState>>;
  /** Admin class-weight overrides (e.g. `row.adminBalancingConfig`). */
  adminBalancingConfig?: AdminBalancingConfigInput | null;
  /**
   * The player's team's current training focus axis, if any (drives `getDevelopmentRouteBonusMultiplier`).
   * Not currently exposed on `TrainingPlayerRowView` — omit/pass `null` when unavailable, which makes
   * every class's route bonus resolve to 1 (i.e. no route-based differentiation), same as the engine
   * does for players without a matching team training focus.
   */
  trainingFocusAxis?: "pow" | "spe" | "men" | "soc" | null;
};

export type ClassTrainingGainEstimate = {
  className: ProgressionClassName;
  /** Estimated Trainings-SP gain for this class, rounded to 1 decimal. Estimate, not a guarantee. */
  estimatedGain: number;
  developmentRoute: PlayerDevelopmentRouteSuggestion;
  isCurrentClass: boolean;
};

function roundTo(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Per-class estimate of training SP gain for a player, ranked descending.
 *
 * Fixes the "every class shows the same number" bug in
 * `buildTrainingClassGainRanking` (app/foundation/training-facilities-v2/training-view-shared.tsx),
 * whose formula was `budget * Σ_k (max(0,weight_k)/positiveTotal) * capacity_k`. Because the class
 * weight distribution is normalized to sum to 1 and `capacity_k` is 1 for every attribute whenever
 * nothing is near its cap (the common case), that formula collapses to `budget * 1` for EVERY class,
 * ignoring (a) the player's per-attribute training affinity (signature/weak) and (b) each candidate
 * class's own development-route bonus (it reused the CURRENT class's already-route-adjusted budget
 * for all 13 candidates).
 *
 * Formula per class `c`:
 *   weights_c     = getClassTrainingProfile(c, adminConfig)                      // CLASS_PROGRESSION_WEIGHTS[c] (+ admin overrides)
 *   positiveTotal = Σ_k max(0, weights_c[k])   over PROGRESSION_ATTRIBUTE_ORDER
 *   if positiveTotal <= 0 -> estimatedGain = 0
 *   else:
 *     routeMult_c   = getDevelopmentRouteBonusMultiplier(classNameToDevelopmentRoute(c), trainingFocusAxis)
 *     estimatedGain = budgetBase * routeMult_c * Σ_k [ (max(0,weights_c[k]) / positiveTotal) * capacity_k * affinity_k ]
 *       capacity_k = getAttributeGrowthMultiplier(ceilingState_k)   // open 1 / closing 0.45 / capped 0.05
 *       affinity_k = getOrganicGrowthMultiplier(getAttributeAffinityKind(k, affinityProfile))  // signature 1.15 / weak 0.8 / neutral 1
 *
 * `budgetBase` is made class-neutral by dividing the incoming (current-class) `trainingSetpoints` by
 * the CURRENT class's own route multiplier (`routeMult_currentClass`), undoing the route bonus that
 * `buildOrganicSeasonProgression` (organic-season-progression.ts ~628-636) already baked into it via
 * `classNameToDevelopmentRoute` + `getDevelopmentRouteBonusMultiplier`. If the current class can't be
 * resolved (unknown/missing `currentClassName`), `budgetBase` falls back to the raw `trainingSetpoints`
 * unmodified (closest fair alternative — no route bonus to divide out because none is known to have
 * been applied).
 *
 * The class-weight-distribution normalization (share sums to 1) is intentionally preserved: a class
 * distributes the SAME training budget differently across attributes; `capacity_k * affinity_k` then
 * scale each portion. The bug was the missing affinity + route + shared-budget handling, not the
 * normalization itself.
 *
 * Returns the FULL ranked list (all of `PROGRESSION_CLASS_ORDER`, descending by `estimatedGain`) —
 * callers (UI) are responsible for truncating to top-N (+ current class), this service does not.
 */
export function estimateClassTrainingGains(input: ClassTrainingGainEstimateInput): ClassTrainingGainEstimate[] {
  const currentClass = normalizeProgressionClassName(input.currentClassName);
  const trainingFocusAxis = input.trainingFocusAxis ?? null;

  const currentRouteMultiplier = currentClass
    ? getDevelopmentRouteBonusMultiplier(classNameToDevelopmentRoute(currentClass), trainingFocusAxis)
    : 1;
  const budgetBase =
    currentRouteMultiplier > 0 ? input.trainingSetpoints / currentRouteMultiplier : input.trainingSetpoints;

  const affinityProfile = deriveAttributeAffinityProfile(input.player);

  const estimates: ClassTrainingGainEstimate[] = PROGRESSION_CLASS_ORDER.map((className) => {
    const profile = getClassTrainingProfile(className, input.adminBalancingConfig);
    const positiveTotal = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, key) => sum + Math.max(0, profile[key]), 0);
    const developmentRoute = classNameToDevelopmentRoute(className);

    let estimatedGain = 0;
    if (positiveTotal > 0 && budgetBase > 0) {
      const routeMultiplier = getDevelopmentRouteBonusMultiplier(developmentRoute, trainingFocusAxis);
      const weightedSum = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, key) => {
        const weight = Math.max(0, profile[key]);
        if (weight <= 0) return sum;
        const share = weight / positiveTotal;
        const capacity = getAttributeGrowthMultiplier(input.ceilingStateByAttribute[key] ?? "open");
        const affinity = getOrganicGrowthMultiplier(getAttributeAffinityKind(key, affinityProfile));
        return sum + share * capacity * affinity;
      }, 0);
      estimatedGain = budgetBase * routeMultiplier * weightedSum;
    }

    return {
      className,
      estimatedGain: roundTo(estimatedGain, 1),
      developmentRoute,
      isCurrentClass: className === currentClass,
    };
  });

  return estimates.sort((left, right) => right.estimatedGain - left.estimatedGain);
}
