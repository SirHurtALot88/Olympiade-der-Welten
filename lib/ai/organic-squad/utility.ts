/**
 * Organic marginal-utility squad builder — the composing utility (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md §3. This composes the leaf functions into
 * the three action utilities the greedy builder chooses between each step: buy / sell / stop. PURE —
 * nothing is wired into the game/AI yet. Term SCALING/CALIBRATION is deliberately left simple here and
 * tuned in P3 against the dispersion metrics; P1 only fixes the STRUCTURE and its directional behaviour.
 *
 *   U_buy(p)  =  wWin·ΔStrength(p)  − wThrift·price(p)  − wSustain·wageStrain(p)  + wAsset·potential(p)
 *   U_sell(q) =  wThrift·saleValue(q)  − wWin·ΔStrength(q)  + wPatience·cashOptionGain
 *   U_stop    =  wPatience·cashOptionValue(state)
 *
 * ΔStrength is the KEY term: stat-derived quality damped by the per-discipline coverage curve, so a
 * player filling an UNDER-covered needed discipline is worth far more than one duplicating a covered
 * one — this is what stops "all stars" without any hard cap.
 */

import { cashOptionValue } from "@/lib/ai/organic-squad/cash-option-value";
import { marginalCoverageValue } from "@/lib/ai/organic-squad/coverage-curve";
import { computePlayerQuality } from "@/lib/ai/organic-squad/quality";
import {
  SOLIDE_THRESHOLD,
  type CoreAxis,
  type DisciplineNeed,
  type OrganicPlayerView,
  type OrganicTeamState,
} from "@/lib/ai/organic-squad/types";

/** A strong player that lands on no needed discipline still has some baseline value. */
const COVERAGE_FLOOR = 0.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Marginal squad strength a player adds: stat quality × how much its "solide" disciplines are still
 * needed AND under-covered (via the coverage curve). Weighted average over the player's covered
 * needed disciplines; falls back to COVERAGE_FLOOR when the player covers no needed discipline.
 * When used for a SELL this is the strength that would be LOST by removing the player.
 */
export function marginalStrength(
  player: OrganicPlayerView,
  disciplineNeeds: DisciplineNeed[],
  needAxisWeights: Record<CoreAxis, number>,
): number {
  const quality = computePlayerQuality(player, needAxisWeights);
  let acc = 0;
  let weightSum = 0;
  for (const need of disciplineNeeds) {
    if ((player.disciplineRatings[need.disciplineId] ?? 0) > SOLIDE_THRESHOLD) {
      acc += need.needWeight * marginalCoverageValue(need.coveredCount);
      weightSum += need.needWeight;
    }
  }
  const coverageMultiplier = weightSum > 0 ? acc / weightSum : COVERAGE_FLOOR;
  return quality * coverageMultiplier;
}

/** Salary hurts more when the team is already bleeding cash (negative sustainability margin). */
function wageStrain(player: OrganicPlayerView, state: OrganicTeamState): number {
  const bleed = Math.max(0, -state.forecast.sustainabilityMargin);
  const bleedFactor = clamp(bleed / Math.max(state.cashBuffer, 1), 0, 1);
  return Math.max(0, player.salary) * (1 + bleedFactor);
}

/**
 * Utility of BUYING this free agent. Market value is used as PRICE only; budget-relativity comes
 * through wThrift (which rises for poorer teams), not from reading marketValue as quality.
 */
export function buyUtility(player: OrganicPlayerView, state: OrganicTeamState): number {
  const w = state.weights;
  const deltaStrength = marginalStrength(player, state.disciplineNeeds, state.needAxisWeights);
  const price = Math.max(0, player.marketValue);
  const potential = Math.max(0, player.potential ?? 0);
  return (
    w.wWin * deltaStrength -
    w.wThrift * price -
    w.wSustain * wageStrain(player, state) +
    w.wAsset * potential
  );
}

/**
 * Utility of SELLING this rostered player. High when the sale value is attractive to a thrifty team
 * and the player sits in an already-covered discipline (low ΔStrength loss), plus the patience value
 * of the freed cash.
 */
export function sellUtility(player: OrganicPlayerView, state: OrganicTeamState): number {
  const w = state.weights;
  const strengthLoss = marginalStrength(player, state.disciplineNeeds, state.needAxisWeights);
  const saleValue = Math.max(0, player.marketValue);
  const cashOptionGain =
    cashOptionValue({
      cash: state.cash + saleValue,
      cashBuffer: state.cashBuffer,
      forecast: state.forecast,
      boardRisk: state.boardRisk,
      rosterSize: Math.max(0, state.rosterSize - 1),
      optTarget: w.optTarget,
    }) - stopCashOptionValue(state);
  return w.wThrift * saleValue - w.wWin * strengthLoss + w.wPatience * Math.max(0, cashOptionGain);
}

/** Shared cash-option-value evaluation at the current state (used by stop + sell delta). */
function stopCashOptionValue(state: OrganicTeamState): number {
  return cashOptionValue({
    cash: state.cash,
    cashBuffer: state.cashBuffer,
    forecast: state.forecast,
    boardRisk: state.boardRisk,
    rosterSize: state.rosterSize,
    optTarget: state.weights.optTarget,
  });
}

/**
 * Utility of STOPPING / banking cash this step. Grows as cash gets scarce, the forecast bleeds, board
 * risk rises, or the roster approaches its (GM-modulated) OPT — the organic saving + soft-OPT brake.
 */
export function stopUtility(state: OrganicTeamState): number {
  return state.weights.wPatience * stopCashOptionValue(state);
}
