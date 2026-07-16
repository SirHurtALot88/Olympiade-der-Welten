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
import { classifyCompositionLane } from "@/lib/ai/organic-squad/composition-plan";
import { disciplineSupportFactor, marginalCoverageValue } from "@/lib/ai/organic-squad/coverage-curve";
import { computePlayerQuality } from "@/lib/ai/organic-squad/quality";
import {
  CATEGORY_TO_AXIS,
  CORE_AXES,
  SOLIDE_THRESHOLD,
  type CoreAxis,
  type DisciplineCategory,
  type DisciplineNeed,
  type OrganicPlayerView,
  type OrganicTeamState,
} from "@/lib/ai/organic-squad/types";

/** A strong player that lands on no needed discipline still has some baseline value. */
const COVERAGE_FLOOR = 0.25;

/**
 * Env flag for ANPASSUNG B1 (identity-gate on the star premium, see identityFitFactor below).
 * Default OFF ("0"/unset) — main draft behaviour is bitidentical until this is flipped to "1".
 */
const IDFIT_ENABLED = process.env.OLY_DRAFT_IDFIT === "1";

/**
 * Env flag for ANPASSUNG B2 (convex, GM-scaled price strain, see priceStrain in buyUtility below).
 * Default OFF ("0"/unset) — main draft behaviour is bitidentical until this is flipped to "1".
 */
const STRAIN_ENABLED = process.env.OLY_DRAFT_STRAIN === "1";

/**
 * Env flag for ANPASSUNG A (cash-scaled fill-quality bonus, see buyUtility). The below-opt fill value
 * is otherwise tier-blind — a cheap Reserve body earns the same rotationValue as a Depth body, so the
 * linear price term always picks the cheapest, flooding rosters with Backup/Reserve. This makes the
 * fill value quality-aware (capped at core-grade so no star inflation) and cash-scaled so it fades to a
 * no-op exactly when a team can't afford Depth-grade bodies → no below-opt risk. Default OFF.
 */
const FILLQ_A_ENABLED = process.env.OLY_DRAFT_FILLQA === "1";

/**
 * Reference effective cost of a Depth-grade body (~22-25 MW + capitalized wage). Used to gauge whether
 * a team's per-slot budget can afford Depth-grade fill (Anpassung A + B). Exported for draft-adapter B.
 */
export const DEPTH_REF_COST = 30;
/** Utility weight of the fill-quality bonus (Anpassung A). */
const FILL_QUALITY_VALUE = 30;

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
 *
 * It is ALSO the sole "why not just buy the most expensive star" governor — there is NO artificial MW
 * ceiling. A high value makes the planner weigh a player's price against the club's ACTUAL cash: given
 * the current economy a ~50 MW body is usually the most a club will justify as its "star", and only a
 * genuinely rich/star-biased club (few slots, high budget/slot) organically reaches a 60-70 MW player.
 * The ceiling emerges from each club's money, not from a fixed cap. It also self-corrects OPT-fill: a
 * club that doesn't blow its budget on a star keeps more budget-per-slot, so its remaining cheap fills
 * stay cheap and it reaches OPT.
 */
const PRICE_SLOT_SCALE = 30;

/**
 * ANPASSUNG B2 convexity coefficient (see priceStrain in buyUtility): how steeply the price penalty
 * accelerates once a pick's priceInSlots exceeds the club's own starAppetite. 0 would fall back to the
 * plain linear priceInSlots; 0.35 makes a pick at 2× appetite cost ~1.35× as much strain per slot as a
 * pick right at appetite, growing further beyond that — steep enough to steer a poor/mid club off a
 * lone superstar without materially touching a rich/star-biased club whose picks rarely cross appetite.
 */
const PRICE_STRAIN_CONVEXITY = 0.35;

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
const BELOW_OPT_FILL_FLOOR = 25;

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
 * Env flag OLY_DRAFT_COMPOSE (see draft-adapter.ts / composition-plan.ts). Nothing in THIS file reads
 * the env directly — the flag only controls whether `state.composition` is ever populated by the caller;
 * `compositionAdjustment` below is a pure no-op (returns 0) whenever it is undefined, so COMPOSE off is
 * bit-identical to before this term existed regardless of this file's code.
 */

/**
 * Soft utility bonus/malus from the EXPLICIT role-composition plan (ANPASSUNG COMPOSE, flag-gated
 * OLY_DRAFT_COMPOSE). Orthogonal to IDFIT/STRAIN/FILLQ: those shape WHICH player is best for a given
 * discipline/price; this only nudges WHICH TIER a pick should come from, so the greedy loop naturally
 * gravitates toward filling its own planned pyramid (see composition-plan.ts deriveCompositionCounts)
 * without any hard band filter, slot sequence, or stopUtility change. `state.composition` undefined
 * (COMPOSE off, or no plan for this team) ⇒ this returns 0 exactly, so buyUtility is untouched.
 */
// GENTLE nudge: the base organic economy already reaches opt, spreads within bands and keeps stars rare;
// an aggressive composition term wrecks those virtues. Keep the term small so it only lifts the cheap
// tail (Reserve → Depth/Backup) and grows Core toward Backup, WITHOUT overriding the base fill/price
// economy that gets teams to opt. The per-tier band-position fade is applied uniformly INCLUDING premium
// (superstar has no ceiling ⇒ treated as no fade) so it never makes stars relatively more attractive.
const COMPOSITION_VALUE = 20;
const COMPOSITION_OVERAGE_PENALTY = 8;
const COMPOSITION_OVERAGE_FLOOR = -16;
/** Fade of the fill bonus from band target to ceiling, so the cheaper end of a band wins (budget stretches). */
const COMPOSITION_TOPBAND_FADE = 0.5;

function compositionAdjustment(player: OrganicPlayerView, state: OrganicTeamState): number {
  const comp = state.composition;
  if (!comp) return 0;
  const lane = classifyCompositionLane(player.marketValue, comp.brackets);
  // ALL tiers (incl. Star/Superstar and Reserve) take the normal deficit path so the plan's allocation is
  // actually realized. The ~5 highest-appetite teams plan one Superstar (65+) and get nudged to buy it
  // (target 2–3, max ~5 league-wide); Stars fill more broadly; poorer teams fill their planned Reserve
  // rotation bodies; and over-plan buys in any tier are discouraged. The affordability waterfall already
  // costs the premium slots into the plan, so a marquee buy no longer starves the roster (below-opt safe).
  const deficit = comp.counts[lane] - comp.boughtTiers[lane];
  // deficit <= 0: tier already at/over target ⇒ gentle floored malus (never blocks a below-opt fill).
  if (deficit <= 0) return Math.max(COMPOSITION_OVERAGE_FLOOR, COMPOSITION_OVERAGE_PENALTY * deficit);
  // deficit > 0: fill bonus, mildly faded toward the band ceiling so the cheaper end of the band wins.
  const band = comp.brackets[lane];
  const price = Math.max(0, player.marketValue);
  if (band.ceilingMw != null && band.ceilingMw > band.targetMw) {
    const pos = clamp((price - band.targetMw) / (band.ceilingMw - band.targetMw), 0, 1);
    return COMPOSITION_VALUE * (1 - COMPOSITION_TOPBAND_FADE * pos);
  }
  return COMPOSITION_VALUE;
}

/**
 * Financial-distress SELL overrides (see sellUtility). A cash-strapped, over-salaried club must be able
 * to sell down even valuable players at a loss to raise cash + cut wages and refill cheaper — these
 * scale that behaviour and are gated by a distress factor that is ~0 when cash is healthy, so they never
 * make a solvent club fire-sale.
 */
// Bei voller Not fast die ganze Stärke-Bindung aufheben, damit ein cash-knappes/über-salariertes Team
// auch seinen TEURSTEN Star liquidiert (60 MW → 2–3 neue Spieler + Cash), statt ihn zu halten und unter
// dem Gehalt zu ersticken. Es gibt keine "Verkauf-unter-Min"-Policy — ein Verkauf drückt nur kurzfristig
// unter Min und wird sofort wieder aufgefüllt. Bei GESUNDEM Cash bleibt distress ~0 → kein Fire-Sale.
const SELL_DISTRESS_STRENGTH_DISCOUNT = 0.9; // max fraction of the strength-keeping waived at full distress
const SELL_DISTRESS_SALARY_RELIEF = 1.0; // weight on the capitalized wage relief a sale frees, under distress
/**
 * ANTICIPATION amplifier ("wenn Teams eh schon unter OPT sind und wenig Cash haben müssen sie eigentlich
 * verkaufen"): a club BELOW its OPT that is ALSO cash-tight faces a refill problem it must plan for — it
 * needs liquidity now to buy back cheaper toward OPT next window. So being under OPT lifts the distress
 * factor, but ONLY while cash is tight (cashHealth < 1). A below-OPT club with healthy cash should BUY,
 * not sell, so the amplifier is gated off there. Scales with how far below OPT the roster sits.
 */
const SELL_DISTRESS_UNDER_OPT_WEIGHT = 0.6;

// NOTE (deliberately no premium-price / MW-cap term): an earlier version subtracted a flat penalty for
// every MW above a knee, which is an artificial league-wide price ceiling — exactly what the design
// forbids (organic levers only, no hard/soft caps). Whether a star is "too expensive" must emerge from
// the club's own economy via the budget-relative PRICE_SLOT_SCALE term above, not from a fixed MW line.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * ANPASSUNG B1 — identity-gate on the star PREMIUM (root cause: at an empty S1 roster every
 * discipline's coverage-gap is 1.0, so IDENTITY_WEIGHT/GAP_WEIGHT in discipline-need.ts wash the
 * identity signal out of needWeight and the FIRST/most-expensive pick is scored near identity-blind).
 * `identityAxisWeights` is the team's own NORMALIZED playstyle emphasis (pow/spe/men/soc, sums to 1;
 * see buildIdentityAxisWeights); 0.25 is the flat-equal share across 4 axes, so an axis at exactly
 * that share is a no-op (factor 1) — an axis the identity leans hard into scores up to 1.2, a purely
 * off-axis discipline (~0.15 share) scores down to ~0.46, and undersupplied input falls back to the
 * flat share too (no-op). Only multiplies the star EXCESS (see marginalStrength) — the base body value
 * is left alone so cheap/mid picks and the bracket pyramid are unaffected. Returns 1 (no-op) unless
 * OLY_DRAFT_IDFIT=1.
 */
const IDENTITY_FIT_FLAT_SHARE = 0.25;
const IDENTITY_FIT_EXPONENT = 1.5;
const IDENTITY_FIT_MIN = 0.4;
const IDENTITY_FIT_MAX = 1.2;

function identityFitFactor(
  category: DisciplineCategory,
  identityAxisWeights: Record<CoreAxis, number> | undefined,
): number {
  if (!IDFIT_ENABLED) return 1;
  const axis = CATEGORY_TO_AXIS[category];
  const weight = identityAxisWeights?.[axis] ?? IDENTITY_FIT_FLAT_SHARE;
  return clamp(
    Math.pow(weight / IDENTITY_FIT_FLAT_SHARE, IDENTITY_FIT_EXPONENT),
    IDENTITY_FIT_MIN,
    IDENTITY_FIT_MAX,
  );
}

/**
 * ANPASSUNG B4 (flag-gated OLY_DRAFT_IDFIT) — identity-axis TILT on ΔStrength for the whole player,
 * the decisive lever for "the expensive pick fits the team's axes". identityFitFactor above only gates
 * the star PREMIUM of individual needed disciplines; but WHICH player becomes a team's marquee is driven
 * by the plain need-weighted quality AVERAGE (+ an identity-blind specialist bonus), so a superstar
 * whose mass sits on OFF-identity axes still wins. This computes an alignment ratio between the team's
 * identity emphasis and the player's OWN axis-stat distribution (both sum-normalized ⇒ 1.0 when the
 * player is flat or the team has no identity), then tilts ΔStrength toward on-identity players and away
 * from off-identity ones. Emptiness-scaled so it only bites in the draft/rebuild regime (empty→sparse
 * roster) and fades to a pure no-op by EMPTINESS_REF players — a filled follow-season roster is untouched.
 */
const IDENTITY_TILT_STRENGTH = 1.8;
const IDENTITY_TILT_EMPTINESS_REF = 8;
const IDENTITY_TILT_MIN = 0.5;
const IDENTITY_TILT_MAX = 1.75;

function identityAxisTilt(player: OrganicPlayerView, state: OrganicTeamState): number {
  if (!IDFIT_ENABLED) return 1;
  const identity = state.identityAxisWeights;
  if (!identity) return 1;
  const axisSum = CORE_AXES.reduce((sum, axis) => sum + Math.max(0, player[axis]), 0);
  if (axisSum <= 0) return 1;
  // fit = Σ identityShare · playerShare · 4 → 1.0 at neutral, >1 aligned, <1 anti-aligned.
  const fit =
    CORE_AXES.reduce((sum, axis) => sum + (identity[axis] ?? 0) * (Math.max(0, player[axis]) / axisSum), 0) *
    CORE_AXES.length;
  const emptiness = clamp((IDENTITY_TILT_EMPTINESS_REF - state.rosterSize) / IDENTITY_TILT_EMPTINESS_REF, 0, 1);
  return clamp(1 + emptiness * IDENTITY_TILT_STRENGTH * (fit - 1), IDENTITY_TILT_MIN, IDENTITY_TILT_MAX);
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
  identityAxisWeights?: Record<CoreAxis, number>,
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
      // ANPASSUNG B1 (flag-gated, see identityFitFactor): the star premium is additionally scaled by
      // how central this discipline's axis is to the team's OWN identity — 1 (no-op) unless
      // OLY_DRAFT_IDFIT=1. base·coverage (breadth) is never touched by this gate.
      const idFit = identityFitFactor(need.category, identityAxisWeights);
      // base·coverage: breadth value of another body. excess·coverage·support·idFit: the star premium,
      // only realized when the discipline already carries support — peaks as the ~3rd body (sweet spot)
      // — and (when gated) further scaled by identity fit so an off-identity star's premium fizzles too.
      acc += need.needWeight * coverage * (base + excess * support * idFit);
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
  const deltaStrength =
    marginalStrength(player, state.disciplineNeeds, state.needAxisWeights, state.identityAxisWeights) *
    fullness *
    identityAxisTilt(player, state);
  // Budget-relative cost measured in remaining-OPT-slots of budget: transfer price + capitalized wage.
  const optSlotsRemaining = Math.max(1, w.optTarget - state.rosterSize);
  const budgetPerOptSlot = Math.max(1, state.cash / optSlotsRemaining);
  const effectiveCost = Math.max(0, player.marketValue) + SALARY_CAPITALIZATION * Math.max(0, player.salary);
  const priceInSlots = effectiveCost / budgetPerOptSlot;
  // ANPASSUNG B2 (flag-gated): once a single pick eats more than the GM's own "star appetite" worth of
  // slot-budget, the strain grows superlinearly instead of linearly — a rich/star-biased club (high
  // wWin ⇒ high appetite) is barely affected (its stars rarely exceed the appetite), a poor/mid club's
  // appetite is low so a big pick crosses it fast and gets punished hard, pushing its budget toward
  // mid-market instead of one lone superstar. priceStrain === priceInSlots (no-op) unless
  // OLY_DRAFT_STRAIN=1.
  const starAppetite = clamp(0.8 + 0.5 * w.wWin, 1.0, 2.2);
  // Season-safety: the convex strain only ramps in when there are enough open OPT-slots to spread the
  // budget across — i.e. the empty-roster DRAFT/rebuild regime, where a lone-superstar starves the
  // remaining slots. In a filled follow-season roster with only 1–2 slots to fill, a 60M marquee at
  // 80 cash is a legitimate single buy, so slotSpread → 0 fully disables the convex term and behaviour
  // falls back to the plain linear thrift strain. Full protection at ≥5 open slots, off at ≤2.
  const slotSpread = clamp((optSlotsRemaining - 2) / 3, 0, 1);
  const priceStrain = STRAIN_ENABLED
    ? priceInSlots * (1 + PRICE_STRAIN_CONVEXITY * slotSpread * Math.max(0, priceInSlots - starAppetite))
    : priceInSlots;
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
  // ANPASSUNG A: cash-scaled fill-quality bonus — breaks the tier-blindness of rotationValue so a
  // Depth-grade body outranks a Reserve scrap for the same fill slot, WHEN the team can afford it.
  // Capped at SUPPORT_QUALITY_BASELINE (core-grade) so it never inflates star buys, and multiplied by
  // cashComfort (→0 when per-slot budget can't fund a Depth body) so cash-thin teams still take the
  // cheap body and reach opt — no below-opt risk. No-op unless OLY_DRAFT_FILLQA=1.
  const fillQualityBonus = FILLQ_A_ENABLED
    ? belowOpt *
      FILL_QUALITY_VALUE *
      clamp(Math.min(computePlayerQuality(player, state.needAxisWeights), SUPPORT_QUALITY_BASELINE) / SUPPORT_QUALITY_BASELINE, 0, 1) *
      clamp(state.cash / (optSlotsRemaining * DEPTH_REF_COST), 0, 1)
    : 0;
  const themeFitValue = THEME_FIT_VALUE * (player.themeFit ?? 0);
  // ANPASSUNG COMPOSE (flag-gated via state.composition, see compositionAdjustment above): soft nudge
  // toward the team's planned role pyramid. 0 whenever state.composition is undefined (COMPOSE off).
  const compositionValue = compositionAdjustment(player, state);
  // No MW-cap / premium term: "too expensive" is judged purely by wThrift·priceInSlots·PRICE_SLOT_SCALE
  // — the player's price measured against THIS club's actual budget-per-slot — so the star ceiling
  // emerges from each club's economy, not a fixed line.
  return (
    w.wWin * deltaStrength +
    rotationValue +
    fillQualityBonus -
    w.wThrift * priceStrain * PRICE_SLOT_SCALE -
    w.wSustain * wageStrain(player, state) +
    w.wAsset * potential +
    themeFitValue +
    compositionValue
  );
}

/**
 * Utility of SELLING this rostered player. High when the sale value is attractive to a thrifty team
 * and the player sits in an already-covered discipline (low ΔStrength loss), plus the patience value
 * of the freed cash.
 */
export function sellUtility(player: OrganicPlayerView, state: OrganicTeamState): number {
  const w = state.weights;
  const strengthLoss = marginalStrength(
    player,
    state.disciplineNeeds,
    state.needAxisWeights,
    state.identityAxisWeights,
  );
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
  // Financial distress ("teuer eingekauft + teure Gehälter → Cash-Druck → auch mit Verlust verkaufen um
  // wieder aufzufüllen"): ~0 when cash is comfortably above the buffer, rising toward 1 as cash falls to
  // 0 or the forecast bleeds. Under distress an over-invested club must raise liquidity and shed wages
  // even at a strength/value loss — so it (a) discounts the strength it can no longer afford to keep and
  // (b) values the freed recurring WAGE bill — instead of hoarding a squad it can't pay for. Then it
  // refills cheaper (fewer expensive bodies → more depth toward OPT). Healthy clubs (distress ~0) keep
  // the pure profit/surplus behaviour.
  const cashHealth = state.cash / Math.max(state.cashBuffer, 1);
  const bleed = Math.max(0, -state.forecast.sustainabilityMargin) / Math.max(state.cashBuffer, 1);
  // Under-OPT anticipation: a roster below its OPT that is ALSO cash-tight (cashHealth < 1) must raise
  // liquidity to refill cheaper next window — being further below OPT lifts distress. Gated off when cash
  // is healthy (a below-OPT club with cash should buy, not sell).
  const underOpt = clamp((w.optTarget - state.rosterSize) / Math.max(1, w.optTarget), 0, 1);
  const underOptPressure = cashHealth < 1 ? SELL_DISTRESS_UNDER_OPT_WEIGHT * underOpt : 0;
  const distress = clamp((2 - cashHealth) / 2 + 0.5 * bleed + underOptPressure, 0, 1);
  const salaryRelief = SALARY_CAPITALIZATION * Math.max(0, player.salary);
  const effectiveStrengthLoss = strengthLoss * (1 - SELL_DISTRESS_STRENGTH_DISCOUNT * distress);
  return (
    w.wThrift * saleValue -
    w.wWin * effectiveStrengthLoss +
    w.wPatience * Math.max(0, cashOptionGain) +
    w.wProfit * profit +
    w.wSustain * SELL_DISTRESS_SALARY_RELIEF * salaryRelief * distress
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
