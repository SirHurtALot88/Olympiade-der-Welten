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
import { disciplineSupportFactor, marginalCoverageValue } from "@/lib/ai/organic-squad/coverage-curve";
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

/**
 * Quality of a solid, rotation-grade CORE body — the line above which quality is a genuine "star
 * premium". Quality up to this is the BASE (every core/depth body provides it, valued by the breadth
 * coverage curve, UNGATED); only quality ABOVE this — the star/superstar premium — is gated by how
 * SUPPORTED its discipline is (disciplineSupportFactor). Set a notch above SOLIDE_THRESHOLD so the
 * mid-tier bulk (core/depth) is unaffected and the gate bites ONLY on stars/superstars: that is how
 * "a star needs 3–4 in its discipline or its effect fizzles" enters the model without suppressing the
 * whole draft — a lone star keeps full base body value but loses most of its premium.
 */
const SUPPORT_QUALITY_BASELINE = 68;

/**
 * Converts the budget-relative "price in slots" into a penalty comparable to ΔStrength (~0..90).
 * A player costing one whole remaining-OPT-slot of budget costs PRICE_SLOT_SCALE utility before wThrift.
 * This is the "Preis / Budget-Skala": a star is cheap to a rich/elite club (few slots, high budget/slot)
 * and expensive to a depth club (many slots, low budget/slot) — the driver of roster-SIZE variety.
 */
const PRICE_SLOT_SCALE = 18;

/**
 * Baseline value of a body for rotation/fatigue depth (≤12 deploy per matchday, fatigue), independent
 * of discipline coverage. Fades from full at an empty squad to 0 at optTarget, so teams fill toward
 * their (GM-modulated) OPT even once their needed disciplines are covered. Reaching OPT is a goal for
 * EVERY club (rotation) — the roster-SIZE variety comes from the differing optTarget itself (a flipper
 * like C-C wants ~14 bodies, an elite-small club ~9), NOT from some clubs under-filling. So this is set
 * strong enough to dominate the per-slot price of a cheap depth body, and weighted flat (not by wWin),
 * so even a low-ambition club reliably fills its bench toward its own OPT instead of hoarding cash.
 */
const ROTATION_VALUE = 92;

/**
 * Flat depth pull applied to EVERY buy while the roster is strictly below optTarget (drops to 0 at
 * opt). On top of the fading rotation term, this guarantees the last slots up to opt stay worth
 * filling with a cheap body even when its marginal strength is small — encoding "reach OPT is the
 * default, weaker individual players are acceptable". Big enough to clear a cheap filler's price/wage
 * and the (low, cash-comfortable) STOP value, but it vanishes exactly at opt so nobody overfills.
 */
const BELOW_OPT_FILL_FLOOR = 45;

/**
 * A player's real cost is the transfer price PLUS the recurring wage bill over its expected tenure.
 * Capitalizing ~this many seasons of salary into the effective cost is what makes the model weigh
 * "kann ich mir das Gehalt leisten" — an expensive-wage superstar costs far more than its fee, so a
 * club can't grab three of them without regard to affordability.
 */
const SALARY_CAPITALIZATION = 2;

/**
 * Modest additive nudge toward team-theme/identity fit (OrganicPlayerView.themeFit, 0..1, from
 * team-theme-composition-service via draft-adapter.computeThemeFit). Deliberately small relative to
 * ROTATION_VALUE (50) and typical wWin·ΔStrength magnitudes: theme should make identity VISIBLE in
 * the picks (tilt ties, nudge close calls toward the themed candidate) but never override
 * affordability (wThrift·price) or discipline need (ΔStrength). themeFit undefined ⇒ no term added.
 */
const THEME_FIT_VALUE = 12;

/**
 * Soft premium-price aversion (product wish: "in S1 no player should cost >70 MW" — a WISH, not a
 * hard cap). Above the knee the penalty grows linearly, so a ~65-70 MW top star is fine but an
 * 85-113 MW superstar becomes not worth it versus a star + core for the same money — which also frees
 * budget to fill toward OPT. Flat (applies to every club) so the effective ceiling emerges league-wide;
 * a genuinely exceptional player can still clear it, so it never hard-blocks.
 */
const PREMIUM_PRICE_KNEE = 60;
const PREMIUM_PRICE_SLOPE = 2.5;

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
  // Split quality into a plain-body BASE (valued by breadth) and a star PREMIUM (excess, gated by
  // how supported its discipline is — a lone star's premium fizzles). See SUPPORT_QUALITY_BASELINE.
  const base = Math.min(quality, SUPPORT_QUALITY_BASELINE);
  const excess = Math.max(0, quality - SUPPORT_QUALITY_BASELINE);
  let acc = 0;
  let weightSum = 0;
  for (const need of disciplineNeeds) {
    if ((player.disciplineRatings[need.disciplineId] ?? 0) > SOLIDE_THRESHOLD) {
      const coverage = marginalCoverageValue(need.coveredCount);
      const support = disciplineSupportFactor(need.coveredCount);
      // base·coverage: breadth value of another body. excess·coverage·support: the star premium,
      // only realized when the discipline already carries support — peaks as the ~3rd body (sweet spot).
      acc += need.needWeight * coverage * (base + excess * support);
      weightSum += need.needWeight;
    }
  }
  // No needed discipline covered: only the base body value survives (the premium is fully wasted
  // off-need — a star in a discipline you don't need is pointless), heavily damped by the floor.
  return weightSum > 0 ? acc / weightSum : base * COVERAGE_FLOOR;
}

/**
 * Soft OPT brake: the marginal player's strength is damped as the roster approaches and passes the
 * (GM-modulated) optTarget — a squad-level diminishing return on top of the per-discipline one. This
 * is the roster-SIZE governor: below opt it's ~1 (buy freely), around opt it halves, a couple slots
 * past opt it collapses so STOP wins. Elite-small teams (low opt) stop earlier, depth teams later.
 */
function rosterFullnessFactor(rosterSize: number, optTarget: number): number {
  const over = rosterSize - optTarget;
  return clamp(1 / (1 + Math.exp(1.6 * (over - 0.5))), 0, 1);
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
  const fullness = rosterFullnessFactor(state.rosterSize, w.optTarget);
  const deltaStrength = marginalStrength(player, state.disciplineNeeds, state.needAxisWeights) * fullness;
  // Budget-relative cost measured in remaining-OPT-slots of budget: transfer price + capitalized wage.
  const optSlotsRemaining = Math.max(1, w.optTarget - state.rosterSize);
  const budgetPerOptSlot = Math.max(1, state.cash / optSlotsRemaining);
  const effectiveCost = Math.max(0, player.marketValue) + SALARY_CAPITALIZATION * Math.max(0, player.salary);
  const priceInSlots = effectiveCost / budgetPerOptSlot;
  const potential = Math.max(0, player.potential ?? 0);
  // Rotation/depth baseline: a fading part (full at an empty squad, 0 at optTarget) PLUS a flat
  // BELOW_OPT_FILL_FLOOR that holds as long as the roster is strictly under opt, then vanishes at opt.
  // The flat floor is what makes "reach OPT even with weaker individual players" the DEFAULT: near opt
  // the fading part is tiny, so without the floor a cheap depth body's small strength was cancelled by
  // its price and the club stopped 1–2 short; the floor keeps that last fill worthwhile. Going UNDER
  // opt for a stronger average is then an exception driven by the GM (elite/star bias lowers optTarget
  // itself), not the default.
  const belowOptFraction = Math.max(0, (w.optTarget - state.rosterSize) / Math.max(1, w.optTarget));
  const belowOpt = state.rosterSize < w.optTarget ? 1 : 0;
  const rotationValue = ROTATION_VALUE * belowOptFraction + BELOW_OPT_FILL_FLOOR * belowOpt;
  const themeFitValue = THEME_FIT_VALUE * (player.themeFit ?? 0);
  // Soft premium-price aversion: makes 65+ MW superstars rare (only the few clubs that value them
  // enough clear it) and >70 MW essentially not worth it in S1 — a wish, not a hard cap.
  const premiumAversion = PREMIUM_PRICE_SLOPE * Math.max(0, Math.max(0, player.marketValue) - PREMIUM_PRICE_KNEE);
  return (
    w.wWin * deltaStrength +
    rotationValue -
    w.wThrift * priceInSlots * PRICE_SLOT_SCALE -
    w.wSustain * wageStrain(player, state) +
    w.wAsset * potential +
    themeFitValue -
    premiumAversion
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
  // Profit-flip term: unrealized gain over the club's own cost basis. A trader club (high wProfit)
  // actively sheds players it can flip at a gain — this can flip an otherwise-negative sell (a
  // needed but cheaply-bought, now-valuable body) into a sale; a loyal club (wProfit ~0) ignores it.
  // Undefined purchasePrice ⇒ unknown cost basis ⇒ no profit signal (draft/buy views are unaffected).
  const profit = player.purchasePrice != null ? Math.max(0, saleValue - player.purchasePrice) : 0;
  return (
    w.wThrift * saleValue -
    w.wWin * strengthLoss +
    w.wPatience * Math.max(0, cashOptionGain) +
    w.wProfit * profit
  );
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
