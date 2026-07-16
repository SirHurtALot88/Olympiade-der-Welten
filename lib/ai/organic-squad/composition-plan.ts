/**
 * Organic marginal-utility squad builder — explicit role-composition PLANNING (soft utility term).
 *
 * See draft-adapter.ts (COMPOSE_ENABLED) and utility.ts (buyUtility's compositionValue term). This
 * module is PURE and reads NO env — the flag gate lives entirely at the call site (draft-adapter.ts),
 * matching the IDFIT_ENABLED pattern in utility.ts:38. When the caller never builds a `composition`
 * input (flag off), nothing here is ever invoked and the draft stays bit-identical.
 *
 * The idea: instead of hard slot quotas or band filters, derive a target ROLE PYRAMID (how many
 * Superstar/Star/Core/Depth/Backup players a team should end up with, given its budget and premium
 * appetite) and hand it to the greedy loop as a soft nudge — each pick earns a bonus while its tier is
 * still under target, and a malus once its tier is full/over. Composition still EMERGES pick by pick;
 * this only shapes which of several similarly-attractive picks gets chosen.
 *
 * Tier bands are the fixed MW brackets from market-brackets.ts (classifyMarketBracket /
 * buildLeagueMarketBrackets): Superstar≥65, Star 45–65, Core 30–45, Depth 20–30, Backup 12–20,
 * Reserve<12. The target pyramid is Depth-heaviest, Core≈Backup, few Star, very few Superstar, and
 * Reserve is NEVER planned (a squad may still end up owning Reserve-tier bodies from its starting
 * roster, but the plan never adds MORE of them).
 */

import { planSlotsFromBudget } from "@/lib/ai/market-pick-engine/budget-slot-allocator";
import type { PlannerExplicitCounts } from "@/lib/ai/market-pick-engine/budget-envelope";
import {
  classifyMarketBracket,
  type LeagueMarketBrackets,
  type MarketBracketLane,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";

const LANES: readonly MarketBracketLane[] = ["superstar", "star", "core", "depth", "backup", "reserve"];

const TIER_LABEL_TO_LANE: Record<MarketBracketTierLabel, MarketBracketLane> = {
  Superstar: "superstar",
  Star: "star",
  Core: "core",
  Depth: "depth",
  Backup: "backup",
  Reserve: "reserve",
};

/**
 * classifyMarketBracket returns a capitalized MarketBracketTierLabel ("Superstar", ...); the composition
 * plan (and its counts/boughtTiers bookkeeping) is keyed by the lowercase MarketBracketLane instead — this
 * is the single shared mapping, reused by draft-adapter.ts (existingTiers), draft-builder.ts (boughtTiers)
 * and utility.ts (per-pick tier lookup) so the label↔lane convention never drifts between call sites.
 */
export function classifyCompositionLane(
  marketValue: number | null,
  brackets: LeagueMarketBrackets,
): MarketBracketLane {
  return TIER_LABEL_TO_LANE[classifyMarketBracket(marketValue, brackets)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** premiumAppetite at/above which a team is even considered for a planned Superstar slot. Only the very
 *  most premium clubs plan a Superstar (target ≤1 league-wide). */
const SUPERSTAR_APPETITE_THRESHOLD = 1.45;
/** premiumAppetite at/above which a team plans one Star slot. Raised so Stars stay rare (planning a Star
 *  for most teams drained their budget on a 45-65 body → below-opt spiked and Star count inflated). */
const STAR_APPETITE_THRESHOLD = 0.95;
/** premiumAppetite at/above which (with a large-enough roster) a team plans a SECOND Star slot. */
const STAR_DOUBLE_APPETITE_THRESHOLD = 1.55;
/** optTarget at/above which the second Star slot is allowed (a small roster can't spare two premium slots). */
const STAR_DOUBLE_OPT_TARGET_MIN = 10;

/** coreShare = CORE_SHARE_BASE + CORE_SHARE_SLOPE·r — 0.27 (arm) → 0.33 (reich). Aimed high because
 *  realized Core lags the plan (30-45MW bodies cost more, poor teams degrade to Depth). */
const CORE_SHARE_BASE = 0.27;
const CORE_SHARE_SLOPE = 0.06;
/** backupShare = BACKUP_SHARE_BASE − BACKUP_SHARE_SLOPE·r — 0.27 (arm) → 0.23 (reich). Core≈Backup; Depth
 *  is the residual (~0.44–0.46 of F) so it stays the largest cohort without running away. */
const BACKUP_SHARE_BASE = 0.27;
const BACKUP_SHARE_SLOPE = 0.04;

/** Order in which excess planned need is trimmed back to `slotsToFill` — Premium (superstar/star) is never touched. */
const EXCESS_TRIM_ORDER: readonly MarketBracketLane[] = ["depth", "backup", "core"];

/**
 * Largest-remainder rounding of three non-negative shares that already sum (as floats) to `total`, so
 * the rounded integers ALSO sum to `total` exactly (no drift from independent per-lane rounding).
 */
function roundTripleToTotal(
  raw: { core: number; backup: number; depth: number },
  total: number,
): { core: number; backup: number; depth: number } {
  const totalInt = Math.round(total);
  const floors = {
    core: Math.floor(raw.core),
    backup: Math.floor(raw.backup),
    depth: Math.floor(raw.depth),
  };
  const flooredSum = floors.core + floors.backup + floors.depth;
  let remainder = totalInt - flooredSum;
  const order = (["core", "backup", "depth"] as const)
    .map((lane) => ({ lane, frac: raw[lane] - floors[lane] }))
    .sort((a, b) => b.frac - a.frac);
  const result = { ...floors };
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    result[order[i].lane] += 1;
    remainder -= 1;
  }
  return result;
}

export type CompositionCountsInput = {
  /** The team's (GM-modulated) soft roster-size target. */
  optTarget: number;
  /** Tier counts already on the roster (classifyMarketBracket over the starting squad). */
  existingTiers: Record<MarketBracketLane, number>;
  /** Cash actually spendable toward the draft (already net of the club's cash buffer). */
  spendableNet: number;
  /** League MW brackets (buildLeagueMarketBrackets over the candidate pool). */
  brackets: LeagueMarketBrackets;
  /** Continuous premium-appetite score (Season1LanePhilosophy.premiumAppetite, post GM-bias tilt). */
  premiumAppetite: number;
  /** Max premium (Superstar+Star) slots allowed (deriveLaneCapsFromAppetite.premiumCap). */
  premiumCap: number;
  /** Max Superstar slots allowed (deriveLaneCapsFromAppetite.superstarCap, 0 or 1). */
  superstarCap: number;
  /** Hard roster minimum (defensive floor for optTarget; ROSTER_MIN in practice). */
  rosterMin: number;
};

/**
 * Derives the target role-composition pyramid (TOTAL desired tier counts across the whole roster,
 * i.e. existing + planned) for one team. Pure function, no env reads.
 *
 * Steps (see module doc + PR description for the full rationale):
 *  1. r = budget-richness ratio (0 poor .. 1 rich), spendableNet relative to optTarget·core.targetMw.
 *  2. Premium slot count (Superstar 0/1, Star 0/1/2) from premiumAppetite, capped by premiumCap/superstarCap
 *     and gated by whether the club can actually afford a Superstar AND still fund the rest at Depth-floor.
 *  3. The remaining (non-premium) slots F split into core/backup/depth by budget-scaled shares — Depth is
 *     always the largest cohort by construction (its share is the residual ≈48–52% of F). Reserve is never
 *     planned (0).
 *  4. S2+ complement: subtract existingTiers to get the incremental need, then deterministically cap the
 *     total need down to the slots actually still open (optTarget − currently-owned), trimming excess from
 *     Depth first, then Backup, then Core — Premium (Superstar/Star) is never trimmed here.
 *  5. Budget-feasibility pass via planSlotsFromBudget (may further demote/reshuffle the capped need — e.g.
 *     drop a Superstar the club can't actually afford once slot-by-slot tail reserves are considered).
 *
 * Returns TOTAL target counts per lane (existingTiers + the budget-feasible planned need), because the
 * caller compares live `boughtTiers` (which itself starts at existingTiers) against this same total — see
 * utility.ts buyUtility's compositionValue term.
 */
export function deriveCompositionCounts(input: CompositionCountsInput): Record<MarketBracketLane, number> {
  // Defensive floor: optTarget is GM-derived and already clamped to [ROSTER_MIN, ROSTER_MAX] upstream, so
  // this is normally a no-op — it only guards against a degenerate caller passing optTarget < rosterMin.
  const optTarget = Math.max(input.optTarget, input.rosterMin);
  const coreTargetMw = Math.max(1, input.brackets.core.targetMw);

  // 1. Budget-richness ratio.
  const r = clamp(input.spendableNet / (optTarget * coreTargetMw), 0, 1);

  // 2. Premium slot count.
  const superstarAffordable =
    input.spendableNet >= input.brackets.superstar.targetMw + (optTarget - 1) * input.brackets.depth.floorMw;
  const superstar =
    input.premiumAppetite >= SUPERSTAR_APPETITE_THRESHOLD && input.superstarCap >= 1 && superstarAffordable ? 1 : 0;
  let star = input.premiumAppetite >= STAR_APPETITE_THRESHOLD ? 1 : 0;
  if (input.premiumAppetite >= STAR_DOUBLE_APPETITE_THRESHOLD && optTarget >= STAR_DOUBLE_OPT_TARGET_MIN) {
    star = 2;
  }
  star = clamp(star, 0, Math.max(0, input.premiumCap - superstar));

  // 3. Rest-slot pyramid (core/backup/depth), largest-remainder rounded so it sums exactly to F.
  const F = Math.max(0, optTarget - superstar - star);
  const coreShare = CORE_SHARE_BASE + CORE_SHARE_SLOPE * r;
  const backupShare = BACKUP_SHARE_BASE - BACKUP_SHARE_SLOPE * r;
  const rawCore = coreShare * F;
  const rawBackup = backupShare * F;
  const rawDepth = F - rawCore - rawBackup;
  const { core, backup, depth } = roundTripleToTotal({ core: rawCore, backup: rawBackup, depth: rawDepth }, F);

  const target: Record<MarketBracketLane, number> = { superstar, star, core, depth, backup, reserve: 0 };

  // 4. S2+ complement: incremental need over what's already owned, capped to the slots actually still open.
  const existingOf = (lane: MarketBracketLane) => Math.max(0, input.existingTiers[lane] ?? 0);
  const existingTotal = LANES.reduce((sum, lane) => sum + existingOf(lane), 0);
  const slotsToFill = Math.max(0, optTarget - existingTotal);

  const need: Record<MarketBracketLane, number> = { superstar: 0, star: 0, core: 0, depth: 0, backup: 0, reserve: 0 };
  for (const lane of LANES) {
    need[lane] = Math.max(0, target[lane] - existingOf(lane));
  }
  let needTotal = LANES.reduce((sum, lane) => sum + need[lane], 0);
  let excess = needTotal - slotsToFill;
  for (const lane of EXCESS_TRIM_ORDER) {
    if (excess <= 0) break;
    const take = Math.min(need[lane], excess);
    need[lane] -= take;
    excess -= take;
  }

  // 5. Budget-feasibility pass. premiumCap MUST be set on the counts input — planSlotsFromBudget zeroes
  // every premium slot otherwise (see budget-slot-allocator.ts:52,73-76).
  const counts: PlannerExplicitCounts = {
    superstarAllowed: need.superstar,
    starAllowed: need.star,
    coreNeeded: need.core,
    specialistNeeded: 0,
    depthNeeded: need.depth,
    backupNeeded: need.backup,
    cheapFillNeeded: 0,
    premiumCap: input.premiumCap,
  };
  const allocated = planSlotsFromBudget({
    counts,
    spendable: input.spendableNet,
    spendableIsNet: true,
    slotsToFill,
    brackets: input.brackets,
    superstarCap: input.superstarCap,
  });

  return {
    superstar: existingOf("superstar") + allocated.superstarAllowed,
    star: existingOf("star") + allocated.starAllowed,
    // specialistNeeded/cheapFillNeeded are always fed as 0 above and planSlotsFromBudget never grows a
    // 0-requested lane on its own (its scaling only shrinks, and its top-up only grows depthNeeded) — folded
    // in defensively so a future allocator change can't silently drop counts.
    core: existingOf("core") + allocated.coreNeeded + allocated.specialistNeeded,
    depth: existingOf("depth") + allocated.depthNeeded + allocated.cheapFillNeeded,
    backup: existingOf("backup") + allocated.backupNeeded,
    // Reserve is never planned — a team keeps only whatever Reserve-tier bodies it already owns.
    reserve: existingOf("reserve"),
  };
}
