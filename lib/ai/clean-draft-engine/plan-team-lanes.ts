import type { LeagueMarketBrackets, MarketBracketBand } from "@/lib/ai/market-pick-engine/market-brackets";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";

import { CLEAN_LANE_ORDER, type CleanLane, type CleanLanePlan, type CleanLanePlanSlot, type PlanTeamLanesInput } from "./types";

const EPS = 0.01;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Management identity axes (ambition, finances, ...) are 0-10 in the runtime data
 * (data/source/team-identities.json; the repo convention — see normalizeManagementValue,
 * ai-transfer-doctrine-layer.ts:84). Map to 0..1 by dividing by 10; a missing axis takes the
 * neutral midpoint (5 -> 0.5).
 */
export function normalizeIdentityAxis(value: number | null | undefined, fallback = 5) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp(raw / 10, 0, 1);
}

/** strategy bias axes are 1-10 (see clampBias in team-strategy-profiles). */
function normalizeBias(value: number | null | undefined, fallback: number) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp((raw - 1) / 9, 0, 1);
}

export type CleanTeamTraits = {
  ambition: number; // 0..1
  finances: number; // 0..1
  starPriority: number; // 0..1
  valuePriority: number; // 0..1
  rosterDepthPreference: number; // 0..1
  cashPriority: number; // 0..1
  /** Trait-derived lean toward developing potential over current ability (value/depth, low ambition). */
  developmentBias: number; // 0..1
};

export function resolveCleanTeamTraits(input: Pick<PlanTeamLanesInput, "identity" | "strategy">): CleanTeamTraits {
  const ambition = normalizeIdentityAxis(input.identity?.ambition, 5);
  const valuePriority = normalizeBias(input.strategy?.bias?.valuePriority, 5);
  const rosterDepthPreference = normalizeBias(input.strategy?.bias?.rosterDepthPreference, 5);
  const developmentBias = clamp(0.5 * valuePriority + 0.3 * rosterDepthPreference - 0.3 * ambition + 0.15, 0, 1);
  return {
    ambition,
    finances: normalizeIdentityAxis(input.identity?.finances, 5),
    starPriority: normalizeBias(input.strategy?.bias?.starPriority, 5),
    valuePriority,
    rosterDepthPreference,
    cashPriority: normalizeBias(input.strategy?.bias?.cashPriority, 5),
    developmentBias,
  };
}

function bandFor(brackets: LeagueMarketBrackets, lane: CleanLane): MarketBracketBand {
  return brackets[lane];
}

/** Finite spend ceiling for a lane (superstar has an open bracket ceiling). */
function laneSpendCeiling(brackets: LeagueMarketBrackets, lane: CleanLane): number {
  const band = bandFor(brackets, lane);
  if (band.ceilingMw != null && Number.isFinite(band.ceilingMw)) return band.ceilingMw;
  // superstar: open bracket — allow paying up to ~1.3x the superstar target.
  return Math.max(band.floorMw, band.targetMw * 1.3);
}

/**
 * Trait-driven cash retention buffer. This is slack the plan intentionally does NOT allocate against
 * lane means; the executor holds it back so picks that come in ABOVE their lane mean draw from the
 * buffer instead of dropping slots. Finance-rich / cash-priority teams keep more; ambitious teams
 * keep less. Mirrors the intent of the (dead) season-1 spend corridor without hard per-tier caps.
 */
export function resolveCashRetentionPct(traits: CleanTeamTraits): number {
  const keep = 0.06 + traits.finances * 0.07 + traits.cashPriority * 0.06 - traits.ambition * 0.05;
  return clamp(keep, 0.05, 0.2);
}

/**
 * Highest lane the team's traits WANT to reach (premium desire, NOT affordability). Driven by ambition
 * / star-priority; finances only mildly enable it. A rich but low-ambition VALUE team (e.g. C-C) can
 * afford stars but chooses breadth/value, so finances must not by itself pull the reach up to premium.
 */
function resolveReachLaneIndex(traits: CleanTeamTraits): number {
  const reach = Math.max(traits.ambition, traits.starPriority, traits.finances * 0.5) - traits.valuePriority * 0.15;
  if (reach >= 0.62) return 0; // superstar
  if (reach >= 0.45) return 1; // star
  if (reach >= 0.28) return 2; // core
  return 3; // depth
}

/** Quality-focus (0..1): ambition/star-led, value-priority pulls it down. */
function resolveQualityFocus(traits: CleanTeamTraits): number {
  return clamp(0.5 * traits.ambition + 0.3 * traits.starPriority + 0.2 * (1 - traits.valuePriority), 0, 1);
}

/**
 * Elite-quality lean = quality-focus minus depth-preference. Above the threshold the team behaves as a
 * "small elite": it plans a shorter squad and REFUSES Backup/Reserve filler (drops the slot instead),
 * running fewer real Depth/Core players. Below it, the team keeps a broad body and may take reserve
 * gems. Shared by the planner (trim / reserve-flex) and the executor (no sub-tier downgrade).
 */
export const ELITE_QUALITY_LEAN_THRESHOLD = 0.2;
export function resolveEliteQualityLean(traits: CleanTeamTraits): number {
  return resolveQualityFocus(traits) - traits.rosterDepthPreference;
}

/**
 * Trait-driven squad size around the SOFT opt target. A "small elite" (high quality-focus, low
 * depth-preference — e.g. B-P) plans FEWER slots so the per-slot budget rises into Core; a depth-led
 * team fills toward opt/max with more bodies. This is the difference between "12 slots × ~15 MW =
 * Backup wall" and "9 slots × ~30 MW = real Core body" on the SAME budget.
 */
function resolveTargetSquadSize(traits: CleanTeamTraits, opt: number, playerMin: number, playerMax: number): number {
  const eliteLean = clamp(resolveEliteQualityLean(traits), -1, 1); // >0 smaller elite, <0 broader
  const target =
    eliteLean >= 0 ? opt - eliteLean * (opt - playerMin) : opt - eliteLean * (playerMax - opt);
  return clamp(Math.round(target), playerMin, playerMax);
}

/**
 * Trait-gated count of premium (Superstar/Star) SPIKES. NOT a hard team cap — it scales with
 * ambition/star-priority/finances, so a genuinely rich & ambitious team can spike several premium
 * slots (and, with more cash later, as many as it can afford), while a modest team spikes 0-1. The
 * budget is the real limiter; this only shapes how much of the surplus goes to a few high picks vs a
 * broader body. Zero when the team's reach is not premium (reachIdx > star).
 */
function resolvePremiumSpikeCap(traits: CleanTeamTraits, reachIdx: number, openSlots: number): number {
  if (reachIdx > 1) return 0; // reach is core/depth — no Superstar/Star desire
  // Ambition/star-priority drive premium; value-priority suppresses it (a value team spends on breadth,
  // not marquee names) and finances only lightly enable it.
  const premiumFactor = clamp(
    0.5 * traits.ambition + 0.3 * traits.starPriority + 0.15 * traits.finances - 0.35 * traits.valuePriority,
    0,
    1,
  );
  return clamp(Math.round(premiumFactor * openSlots * 0.4), 0, openSlots);
}

/** Per-slot allowed spend cap: around the lane mean, with headroom the buffer can cover. */
function laneSlotCap(brackets: LeagueMarketBrackets, lane: CleanLane): number {
  const band = bandFor(brackets, lane);
  return round2(clamp(band.targetMw * 1.25, band.floorMw, laneSpendCeiling(brackets, lane)));
}

/**
 * Budget-fitted lane mix (per the user's design). Two ideas prevent the "1-2 Superstars + a wall of
 * Backup" barbell the old planner built in on purpose:
 *
 *  1. SQUAD SIZE flexes by identity: a small-elite team plans fewer slots (higher per-slot budget →
 *     a real Core body); a depth team fills toward opt/max.
 *  2. BODY-FLOOR + capped premium SPIKES: every slot is guaranteed the highest tier the team can
 *     afford for the WHOLE squad (the body floor B0 — a real Depth/Core body, never Backup). Premium
 *     (Superstar/Star) is funded ONLY from the surplus ABOVE that floor and limited to a trait-gated
 *     number of spikes. The rest of the surplus BROADENS the body toward Core. So a rich, ambitious
 *     team gets a few premium spikes on top of a Core body; a modest team gets a broad Depth/Core
 *     body with 0-1 spikes; nobody gets a Backup wall. Leftover cash stays as a buffer (intended).
 *
 * NO hard team caps — the budget is the real limiter; traits only shape the premium-vs-breadth split.
 */
export function planTeamLanes(input: PlanTeamLanesInput): CleanLanePlan {
  const traits = resolveCleanTeamTraits(input);
  const { playerMin, playerOpt, playerMax } = deriveRosterTargets(undefined, input.identity ?? undefined);
  const currentCount = Math.max(0, input.currentRosterCount);
  const opt = clamp(Math.round(playerOpt), playerMin, playerMax);

  // OPT is a SOFT target. Squad size flexes by identity (small elite -> fewer, better slots; depth
  // team -> more bodies), then the budget can still trim it a touch if genuinely too tight.
  const targetSize = resolveTargetSquadSize(traits, opt, playerMin, playerMax);
  const centerN = Math.max(0, targetSize - currentCount);
  const minN = Math.max(0, playerMin - currentCount); // mandatory floor to reach the hard minimum
  const highN = Math.max(centerN, Math.min(centerN + 1, playerMax - currentCount));

  const retentionPct = resolveCashRetentionPct(traits);
  const spendable = Math.max(0, input.spendableCash) * (1 - retentionPct);

  const means = CLEAN_LANE_ORDER.map((lane) => bandFor(input.brackets, lane).targetMw);
  const coreIdx = CLEAN_LANE_ORDER.indexOf("core"); // 2 — the body ceiling for broadening
  const depthIdx = CLEAN_LANE_ORDER.indexOf("depth");

  // BUDGET-AWARE body-tier floor (the user's "budget/slots = the tier you build" model): shrink the
  // squad — down to the hard minimum — until the per-slot budget reaches the team's AIMED body tier,
  // so the body is a real Depth/Core tier instead of a Backup/Reserve wall. The aim is identity-scaled:
  // quality/elite teams aim at ~Core (fewer, better slots — B-P's "kleine Elite"); depth/value teams
  // aim at ~Backup-Depth (more bodies). Holds at 175 AND 325 cash.
  const qualityFocus = resolveQualityFocus(traits);
  const bodyAimT = clamp(0.5 + 0.6 * (qualityFocus - traits.rosterDepthPreference), 0, 1);
  // Aim the per-slot budget within the Depth band — a touch below Depth for value/depth teams (keep
  // more bodies), a touch above for quality/elite teams (fewer, better slots) — WITHOUT demanding a
  // full Core body per slot (that over-shrinks ambitious teams toward the minimum). Premium spikes and
  // pass-2 broadening still lift the best slots into Core on top of this body.
  const bodyAimMean = means[depthIdx]! * (0.72 + 0.5 * bodyAimT);
  let openSlots = centerN;
  while (openSlots > minN && spendable / Math.max(1, openSlots) + EPS < bodyAimMean) {
    openSlots -= 1;
  }
  openSlots = Math.max(openSlots, minN);

  const perSlotBudget = openSlots > 0 ? spendable / openSlots : 0;
  if (openSlots === 0) {
    return { spendable: round2(spendable), perSlotBudget: round2(perSlotBudget), targetRosterSize: currentCount, slots: [] };
  }

  const reachIdx = resolveReachLaneIndex(traits);

  // BODY FLOOR B0 = highest tier whose MEAN the team can afford for EVERY slot (Σ mean <= spendable).
  // Every slot sits at least here, so the body is always a real tier — never a Backup wall.
  let baseIdx = CLEAN_LANE_ORDER.length - 1; // reserve
  for (let idx = 0; idx < CLEAN_LANE_ORDER.length; idx += 1) {
    if (means[idx]! * openSlots <= spendable + EPS) {
      baseIdx = idx;
      break;
    }
  }

  // Start every slot at the body floor; premium spikes and broadening spend only the surplus above it.
  const laneOf: number[] = new Array(openSlots).fill(baseIdx);
  let budgetLeft = spendable - openSlots * means[baseIdx]!;

  const upgradeSlot = (slotIdx: number, toLane: number) => {
    const cost = means[toLane]! - means[laneOf[slotIdx]!]!;
    if (cost > budgetLeft + EPS) return false;
    budgetLeft -= cost;
    laneOf[slotIdx] = toLane;
    return true;
  };

  // PASS 1 — premium spikes (concentrate behaviour): promote up to `premiumCap` body slots toward the
  // team's premium reach (SS/St), each as high as the surplus affords. Funded purely from surplus, so
  // the remaining slots never drop below the body floor. Zero for teams whose reach is not premium.
  // No premium spikes on a sub-Depth body: if the team can only afford a Backup/Reserve body, a
  // Superstar on top of it is exactly the barbell we are killing. Such a team spends its surplus
  // broadening the body toward Depth/Core instead (pass 2). Premium only when the body is Depth+.
  const premiumCap = baseIdx <= depthIdx ? resolvePremiumSpikeCap(traits, reachIdx, openSlots) : 0;
  for (let spike = 0; spike < premiumCap; spike += 1) {
    // Consolidate the spike into a single slot: pick the highest-tier body slot still above reach.
    let slotToPromote = -1;
    let bestLane = CLEAN_LANE_ORDER.length;
    for (let s = 0; s < openSlots; s += 1) {
      if (laneOf[s]! > reachIdx && laneOf[s]! < bestLane) {
        bestLane = laneOf[s]!;
        slotToPromote = s;
      }
    }
    if (slotToPromote < 0) break;
    let promotedAny = false;
    while (laneOf[slotToPromote]! > reachIdx) {
      if (!upgradeSlot(slotToPromote, laneOf[slotToPromote]! - 1)) break;
      promotedAny = true;
    }
    if (!promotedAny) break; // could not afford any further promotion — stop spiking
  }

  // PASS 2 — broaden the body: lift the currently-lowest body slot one tier at a time toward Core with
  // whatever surplus remains. Never creates premium (bodyCeil = Core), so extra cash thickens the
  // Core/Depth body rather than spiking more Superstars. A pure-depth team keeps a broad Depth body.
  const bodyCeil = coreIdx;
  const maxSteps = openSlots * CLEAN_LANE_ORDER.length + 4;
  for (let step = 0; step < maxSteps; step += 1) {
    let targetSlot = -1;
    let worstLane = -1;
    for (let s = 0; s < openSlots; s += 1) {
      if (laneOf[s]! > bodyCeil && laneOf[s]! > worstLane) {
        worstLane = laneOf[s]!;
        targetSlot = s;
      }
    }
    if (targetSlot < 0) break;
    if (!upgradeSlot(targetSlot, laneOf[targetSlot]! - 1)) break;
  }

  // Soft-flex UP: a spare budget (leftover still covers a real-tier player) adds ONE extra body slot
  // at the best Depth/Core tier the leftover affords — a rich team lands slightly above target with an
  // extra real player, not a lone Superstar + filler.
  if (openSlots < highN && budgetLeft + EPS >= means[depthIdx]!) {
    let addLane = depthIdx;
    for (let idx = coreIdx; idx <= depthIdx; idx += 1) {
      if (means[idx]! <= budgetLeft + EPS) {
        addLane = idx;
        break;
      }
    }
    if (means[addLane]! <= budgetLeft + EPS) {
      budgetLeft -= means[addLane]!;
      laneOf.push(addLane);
      openSlots += 1;
    }
  }

  // Emit slots premium-first (ascending lane index).
  laneOf.sort((left, right) => left - right);
  const slots: CleanLanePlanSlot[] = laneOf.map((idx) => {
    const lane = CLEAN_LANE_ORDER[idx]!;
    return {
      lane,
      priceFloor: bandFor(input.brackets, lane).floorMw,
      priceCap: laneSlotCap(input.brackets, lane),
    };
  });

  // ELITE-QUALITY TRIM: a clearly quality-over-depth team (e.g. B-P's "kleine Elite") would rather run
  // a SHORTER squad of real Depth/Core players than pad it with Backup/Reserve. Drop trailing sub-Depth
  // slots (they sort last) down to the hard minimum — fewer players, but no Backup/Reserve tail. Value/
  // depth teams (below the threshold) skip this and keep their broad bodies / reserve gems.
  const eliteQualityLean = resolveEliteQualityLean(traits);
  if (eliteQualityLean >= ELITE_QUALITY_LEAN_THRESHOLD) {
    while (slots.length > minN) {
      const last = slots[slots.length - 1]!;
      if (last.lane !== "backup" && last.lane !== "reserve") break;
      slots.pop();
    }
  }

  // OPPORTUNISTIC RESERVE: a value/development-leaning team keeps its 1-2 cheapest slots OPEN to the
  // reserve tier (floor dropped to 0). Reserve is never planned as a wall, but a sub-bracket player can
  // be a smart pickup — a cheap salary alternative or a high-potential prospect — and the scorer's
  // value/potential terms will take one only when it genuinely out-scores a backup. So Reserve stays
  // low but not forced to exactly zero. Trait-gated: no reserve flex for star/ambition-led teams.
  const reserveFlexAppetite = Math.max(traits.developmentBias, traits.valuePriority);
  if (eliteQualityLean < ELITE_QUALITY_LEAN_THRESHOLD && reserveFlexAppetite >= 0.55 && slots.length > 0) {
    const flexCount = clamp(Math.round(reserveFlexAppetite * 2), 1, 2);
    for (let k = 0; k < flexCount && k < slots.length; k += 1) {
      const slot = slots[slots.length - 1 - k]!;
      // Only open body slots (Depth/Backup) down to reserve — never the premium/Core anchors.
      if (slot.lane === "depth" || slot.lane === "backup") slot.priceFloor = 0;
    }
  }

  return {
    spendable: round2(spendable),
    perSlotBudget: round2(perSlotBudget),
    targetRosterSize: currentCount + slots.length,
    slots,
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
