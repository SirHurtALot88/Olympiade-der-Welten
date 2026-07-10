import type { MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";
import type { MarketQualityProfile } from "@/lib/ai/ai-market-quality-profile-service";
import {
  buildLeagueMarketBrackets,
  getBracketBandForPickLane,
  resolveCashBufferMw,
  resolvePickLaneBracket,
  type LeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { buildPremiumFirstSlotSequence } from "@/lib/ai/market-pick-engine/slot-sequence";
import {
  buildExplicitSlotSequence,
  type ExplicitSlotSequenceInput,
} from "@/lib/ai/market-pick-engine/explicit-slot-sequence";
import { planSlotsFromBudget } from "@/lib/ai/market-pick-engine/budget-slot-allocator";
export { canAffordPremiumMix, planSlotsFromBudget, resolveTailReserveMw } from "@/lib/ai/market-pick-engine/budget-slot-allocator";

export type PlannerExplicitCounts = Pick<
  ExplicitSlotSequenceInput,
  | "superstarAllowed"
  | "starAllowed"
  | "coreNeeded"
  | "specialistNeeded"
  | "depthNeeded"
  | "backupNeeded"
  | "cheapFillNeeded"
  | "premiumCap"
>;

export type BudgetEnvelopeSlot = {
  lane: MarketPickLane;
  targetMw: number;
  floorMw: number;
  ceilingMw: number;
};

export type BudgetEnvelope = {
  slotSequence: MarketPickLane[];
  slots: BudgetEnvelopeSlot[];
  cashBufferMw: number;
  totalPlannedMw: number;
  templateId: string;
  brackets: LeagueMarketBrackets;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function slotFromLane(lane: MarketPickLane, brackets: LeagueMarketBrackets): BudgetEnvelopeSlot {
  const band = getBracketBandForPickLane(lane, brackets);
  const bracketLane = resolvePickLaneBracket(lane);
  const bracket = brackets[bracketLane];
  return {
    lane,
    targetMw: bracket.targetMw,
    floorMw: band.floorMW,
    ceilingMw: Number.isFinite(band.ceilingMW) ? band.ceilingMW : bracket.targetMw * 2,
  };
}

function reassignSlotLane(slot: BudgetEnvelopeSlot, lane: MarketPickLane, brackets: LeagueMarketBrackets) {
  const next = slotFromLane(lane, brackets);
  slot.lane = next.lane;
  slot.targetMw = next.targetMw;
  slot.floorMw = next.floorMw;
  slot.ceilingMw = next.ceilingMw;
}

/** Cap premium/core counts — unified budget allocator (S1 + S2). Uses rosterGap, not steps. */
export function capExplicitCountsByBudget(input: {
  counts: PlannerExplicitCounts;
  spendable: number;
  steps: number;
  rosterGap: number;
  brackets: LeagueMarketBrackets;
  missingToMin?: number;
  superstarCap?: number;
  /** When true, `spendable` already has MW buffer deducted upstream. */
  spendableIsNet?: boolean;
}): PlannerExplicitCounts {
  return planSlotsFromBudget({
    counts: input.counts,
    spendable: input.spendable,
    slotsToFill: Math.max(input.rosterGap, 0),
    brackets: input.brackets,
    superstarCap: input.superstarCap,
    spendableIsNet: input.spendableIsNet,
  });
}

/** Prevent cliff rosters: ensure enough depth/backup lanes and downgrade excess core. */
function enforceMidTierPyramid(input: {
  slots: BudgetEnvelopeSlot[];
  brackets: LeagueMarketBrackets;
}) {
  const total = input.slots.length;
  if (total <= 0) return;

  const isMidTier = (lane: MarketPickLane) =>
    lane === "depth" || lane === "backup" || lane === "specialist";
  const isExpensive = (lane: MarketPickLane) =>
    lane === "superstar" || lane === "star" || lane === "core";

  // Small fills (≤4) only reserve 1 mid slot so star+core stays viable.
  const minMid = Math.max(total <= 4 ? 1 : 2, Math.ceil(total * 0.3));
  let midCount = input.slots.filter((slot) => isMidTier(slot.lane)).length;
  let coreCount = input.slots.filter((slot) => slot.lane === "core").length;
  const premiumCount = input.slots.filter(
    (slot) => slot.lane === "star" || slot.lane === "superstar",
  ).length;

  // Single-slot premium upgrade (post-opt star chase) — do not demote to backup-only.
  if (total <= 1 && premiumCount > 0) return;
  if (total <= 4 && premiumCount > 0 && midCount === 0 && total - premiumCount <= 1) return;

  if (midCount >= minMid) return;

  const demoteCandidates = [
    ...input.slots.filter((slot) => slot.lane === "core"),
    ...input.slots.filter((slot) => slot.lane === "star"),
  ];
  for (const slot of demoteCandidates) {
    if (midCount >= minMid) break;
    if (!isExpensive(slot.lane) || slot.lane === "superstar") continue;
    // Keep at least one core slot so every roster can land a Core-bracket buy.
    if (slot.lane === "core" && coreCount <= 1) continue;
    const wasCore = slot.lane === "core";
    reassignSlotLane(slot, wasCore ? "depth" : "backup", input.brackets);
    if (wasCore) coreCount -= 1;
    midCount += 1;
  }
}

function reconcileBudget(input: {
  slots: BudgetEnvelopeSlot[];
  spendable: number;
  cashBufferMw: number;
  brackets: LeagueMarketBrackets;
}) {
  const budget = Math.max(0, input.spendable - input.cashBufferMw);
  const downgradeOrder: MarketPickLane[] = ["backup", "depth", "core", "star", "superstar"];

  for (let pass = 0; pass < 6; pass += 1) {
    let total = input.slots.reduce((sum, slot) => sum + slot.targetMw, 0);
    if (total <= budget + 0.01) break;

    for (const lane of downgradeOrder) {
      for (const slot of input.slots) {
        if (slot.lane !== lane) continue;
        total = input.slots.reduce((sum, entry) => sum + entry.targetMw, 0);
        if (total <= budget + 0.01) break;
        const reduction = round(Math.min(slot.targetMw - slot.floorMw, total - budget), 2);
        if (reduction <= 0) {
          slot.targetMw = slot.floorMw;
          continue;
        }
        slot.targetMw = round(Math.max(slot.floorMw, slot.targetMw - reduction), 2);
      }
    }

    let totalAfter = input.slots.reduce((sum, slot) => sum + slot.targetMw, 0);
    if (totalAfter > budget + 0.01) {
      for (let index = input.slots.length - 1; index >= 0; index -= 1) {
        if (totalAfter <= budget + 0.01) break;
        const slot = input.slots[index];
        const remainingCores = input.slots.filter((entry) => entry.lane === "core").length;
        if (slot.lane === "superstar") {
          reassignSlotLane(slot, "star", input.brackets);
        } else if (slot.lane === "star") {
          reassignSlotLane(slot, "core", input.brackets);
        } else if (slot.lane === "core" && remainingCores > 1) {
          reassignSlotLane(slot, "depth", input.brackets);
        } else if (slot.lane === "specialist") {
          reassignSlotLane(slot, "depth", input.brackets);
        }
        totalAfter = input.slots.reduce((sum, entry) => sum + entry.targetMw, 0);
      }
    }
  }

  enforceMidTierPyramid({ slots: input.slots, brackets: input.brackets });

  const upgradeOrder: MarketPickLane[] = ["depth", "core", "star"];
  let total = input.slots.reduce((sum, slot) => sum + slot.targetMw, 0);
  for (const lane of upgradeOrder) {
    if (total >= budget - 5) break;
    for (const slot of input.slots) {
      if (slot.lane !== lane) continue;
      const headroom = round(Math.min((budget - total) * 0.5, slot.ceilingMw - slot.targetMw), 2);
      if (headroom <= 0.5) continue;
      slot.targetMw = round(Math.min(slot.ceilingMw, slot.targetMw + headroom), 2);
      total = input.slots.reduce((sum, entry) => sum + entry.targetMw, 0);
    }
  }
}

export function buildBudgetEnvelope(input: {
  spendable: number;
  rosterGap: number;
  missingToMin: number;
  steps: number;
  profile: MarketQualityProfile;
  starAllowed?: number;
  superstarAllowed?: number;
  coreNeeded?: number;
  specialistNeeded?: number;
  faPrices?: Array<number | null | undefined>;
  templateId?: string;
}): BudgetEnvelope {
  const brackets = buildLeagueMarketBrackets(input.faPrices ?? []);
  const cashBufferMw = resolveCashBufferMw(input.spendable);
  let starAllowed = input.starAllowed ?? input.profile.starAllowed;
  let superstarAllowed = input.superstarAllowed ?? input.profile.superstarAllowed;
  const coreNeeded = input.coreNeeded ?? input.profile.coreNeeded;
  const specialistNeeded = input.specialistNeeded ?? 0;

  const minCoreDepthCost = brackets.core.floorMw + brackets.depth.floorMw * 2 + brackets.backup.floorMw;
  if (input.spendable + 0.01 < brackets.superstar.targetMw + minCoreDepthCost + cashBufferMw) {
    superstarAllowed = 0;
  }
  if (input.spendable + 0.01 < brackets.star.targetMw + minCoreDepthCost + cashBufferMw) {
    starAllowed = Math.min(starAllowed, input.spendable + 0.01 >= brackets.star.targetMw + brackets.depth.floorMw ? 1 : 0);
  }

  const slotSequence = buildPremiumFirstSlotSequence({
    steps: input.steps,
    missingToMin: input.missingToMin,
    rosterGap: input.rosterGap,
    superstarAllowed,
    starAllowed,
    coreNeeded,
    specialistNeeded,
    premiumFirst: input.profile.premiumFirst && input.missingToMin === 0,
    minGapLane:
      input.missingToMin > 0 && input.spendable + 0.01 < brackets.depth.floorMw ? "cheap_fill" : "depth",
  });

  const slots = slotSequence.map((lane) => slotFromLane(lane, brackets));
  reconcileBudget({ slots, spendable: input.spendable, cashBufferMw, brackets });

  const templateId =
    input.templateId ??
    (input.profile.starChaser
      ? superstarAllowed > 0
        ? "star_chaser_premium"
        : "star_chaser"
      : input.profile.premiumFirst
        ? "balanced_premium"
        : "balanced_depth");

  return {
    slotSequence: slots.map((slot) => slot.lane),
    slots,
    cashBufferMw,
    totalPlannedMw: round(slots.reduce((sum, slot) => sum + slot.targetMw, 0), 2),
    templateId,
    brackets,
  };
}

export function buildPlannerEnvelope(input: {
  spendable: number;
  rosterGap: number;
  missingToMin: number;
  steps: number;
  profile: MarketQualityProfile;
  faPrices?: Array<number | null | undefined>;
  explicitCounts?: PlannerExplicitCounts;
  starAllowed?: number;
  superstarAllowed?: number;
  coreNeeded?: number;
  specialistNeeded?: number;
  superstarCap?: number;
  templateId?: string;
  /** When true, `spendable` already reflects buy affordability (no second MW buffer). */
  spendableIsNet?: boolean;
}): BudgetEnvelope {
  if (input.explicitCounts) {
    const brackets = buildLeagueMarketBrackets(input.faPrices ?? []);
    const cashBufferMw = resolveCashBufferMw(input.spendable);
    const planSteps = Math.max(input.rosterGap, input.missingToMin, 1);
    const counts = capExplicitCountsByBudget({
      counts: input.explicitCounts,
      spendable: input.spendable,
      steps: input.steps,
      rosterGap: input.rosterGap,
      missingToMin: input.missingToMin,
      brackets,
      superstarCap: input.superstarCap ?? input.profile.superstarAllowed,
      spendableIsNet: input.spendableIsNet,
    });
    const slotSequence = buildExplicitSlotSequence({
      steps: planSteps,
      missingToMin: input.missingToMin,
      targetSlotsMissing: input.rosterGap,
      superstarAllowed: counts.superstarAllowed,
      starAllowed: counts.starAllowed,
      coreNeeded: counts.coreNeeded,
      specialistNeeded: counts.specialistNeeded,
      depthNeeded: counts.depthNeeded,
      backupNeeded: counts.backupNeeded,
      cheapFillNeeded: counts.cheapFillNeeded,
      premiumCap: counts.premiumCap,
      premiumFirst: true,
      minGapLane:
        input.missingToMin > 0 && input.spendable + 0.01 < brackets.depth.floorMw ? "cheap_fill" : "depth",
    });
    const slots = slotSequence.map((lane) => slotFromLane(lane, brackets));
    reconcileBudget({ slots, spendable: input.spendable, cashBufferMw, brackets });
    return {
      slotSequence: slots.map((slot) => slot.lane),
      slots,
      cashBufferMw,
      totalPlannedMw: round(slots.reduce((sum, slot) => sum + slot.targetMw, 0), 2),
      templateId: input.templateId ?? "s1_explicit",
      brackets,
    };
  }

  return buildBudgetEnvelope({
    spendable: input.spendable,
    rosterGap: input.rosterGap,
    missingToMin: input.missingToMin,
    steps: input.steps,
    profile: input.profile,
    starAllowed: input.starAllowed,
    superstarAllowed: input.superstarAllowed,
    coreNeeded: input.coreNeeded,
    specialistNeeded: input.specialistNeeded,
    faPrices: input.faPrices,
    templateId: input.templateId,
  });
}

export function applyOverspendReconciliation(
  slots: BudgetEnvelopeSlot[],
  fromIndex: number,
  overspendDelta: number,
  brackets?: LeagueMarketBrackets,
) {
  if (overspendDelta <= 0.01) return;
  let remaining = overspendDelta;

  for (let index = fromIndex; index < slots.length && remaining > 0.01; index += 1) {
    const slot = slots[index];
    if (slot.lane !== "backup" && slot.lane !== "depth" && slot.lane !== "cheap_fill") continue;
    const reducible = round(slot.targetMw - slot.floorMw, 2);
    if (reducible <= 0) continue;
    const cut = Math.min(reducible, remaining);
    slot.targetMw = round(slot.targetMw - cut, 2);
    slot.ceilingMw = round(Math.max(slot.floorMw, slot.ceilingMw - cut), 2);
    remaining = round(remaining - cut, 2);
  }

  if (remaining <= 0.01 || !brackets) return;

  for (let index = fromIndex; index < slots.length && remaining > 0.01; index += 1) {
    const slot = slots[index];
    if (slot.lane === "superstar") {
      reassignSlotLane(slot, "star", brackets);
      remaining = round(remaining - Math.max(0, slot.targetMw - brackets.star.targetMw), 2);
      continue;
    }
    if (slot.lane === "star" || slot.lane === "core" || slot.lane === "specialist") {
      reassignSlotLane(slot, "depth", brackets);
      remaining = round(remaining - Math.max(0, slot.targetMw - brackets.depth.targetMw), 2);
    }
  }
}
