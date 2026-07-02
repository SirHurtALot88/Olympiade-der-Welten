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

/** Cap premium/core counts so budget reserves room for depth/backup mid-tier picks. */
export function capExplicitCountsByBudget(input: {
  counts: PlannerExplicitCounts;
  spendable: number;
  steps: number;
  rosterGap: number;
  brackets: LeagueMarketBrackets;
}): PlannerExplicitCounts {
  const cashBufferMw = resolveCashBufferMw(input.spendable);
  const budget = Math.max(0, input.spendable - cashBufferMw);
  const totalSlots = Math.max(input.steps, input.rosterGap, 1);
  const minMidSlots = Math.max(2, Math.ceil(totalSlots * 0.35));
  const midTierReserve = round(minMidSlots * input.brackets.depth.targetMw, 2);

  let superstarAllowed = input.counts.superstarAllowed;
  let starAllowed = input.counts.starAllowed;
  let coreNeeded = input.counts.coreNeeded;
  let specialistNeeded = input.counts.specialistNeeded;
  let depthNeeded = input.counts.depthNeeded;
  let backupNeeded = input.counts.backupNeeded;
  let cheapFillNeeded = input.counts.cheapFillNeeded;
  let premiumCap = input.counts.premiumCap ?? 2;

  const premiumUnitCost = input.brackets.superstar.targetMw;
  const starUnitCost = input.brackets.star.targetMw;
  const coreUnitCost = input.brackets.core.targetMw;

  if (budget + 0.01 < premiumUnitCost + midTierReserve) {
    superstarAllowed = 0;
  }
  if (budget + 0.01 < starUnitCost + midTierReserve) {
    starAllowed = 0;
  }

  const maxPremiumAffordable = Math.max(
    0,
    Math.min(
      premiumCap,
      superstarAllowed > 0 && budget + 0.01 >= premiumUnitCost + midTierReserve ? 1 : 0,
      starAllowed + superstarAllowed,
    ) +
      (budget + 0.01 >= starUnitCost + midTierReserve
        ? Math.min(starAllowed, Math.max(premiumCap - (superstarAllowed > 0 ? 1 : 0), 0))
        : 0),
  );
  const currentPremium = superstarAllowed + starAllowed;
  if (currentPremium > maxPremiumAffordable) {
    const cut = currentPremium - maxPremiumAffordable;
    const starCut = Math.min(starAllowed, cut);
    starAllowed -= starCut;
    if (cut - starCut > 0 && superstarAllowed > 0) {
      superstarAllowed = 0;
    }
    depthNeeded += cut;
  }

  const maxExpensiveSlots = Math.max(
    1,
    Math.floor((budget - midTierReserve) / Math.max(coreUnitCost, input.brackets.depth.floorMw)),
  );
  let expensiveSlots = superstarAllowed + starAllowed + coreNeeded + specialistNeeded;
  if (expensiveSlots > maxExpensiveSlots) {
    let excess = expensiveSlots - maxExpensiveSlots;
    const specialistCut = Math.min(specialistNeeded, excess);
    specialistNeeded -= specialistCut;
    excess -= specialistCut;
    depthNeeded += specialistCut;

    const coreCut = Math.min(coreNeeded, excess);
    coreNeeded -= coreCut;
    excess -= coreCut;
    depthNeeded += coreCut;

    const starCut = Math.min(starAllowed, excess);
    starAllowed -= starCut;
    excess -= starCut;
    depthNeeded += starCut;

    if (excess > 0 && superstarAllowed > 0) {
      superstarAllowed = 0;
      depthNeeded += 1;
    }
  }

  const minDepthBackup = Math.max(2, Math.ceil(totalSlots * 0.3));
  const currentMid = depthNeeded + backupNeeded;
  if (currentMid < minDepthBackup) {
    const deficit = minDepthBackup - currentMid;
    const coreShift = Math.min(coreNeeded, deficit);
    coreNeeded -= coreShift;
    depthNeeded += coreShift;
    backupNeeded += deficit - coreShift;
  }

  premiumCap = Math.min(premiumCap, superstarAllowed + starAllowed);

  return {
    superstarAllowed,
    starAllowed,
    coreNeeded,
    specialistNeeded,
    depthNeeded,
    backupNeeded,
    cheapFillNeeded,
    premiumCap,
  };
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

  const minMid = Math.max(2, Math.ceil(total * 0.3));
  let midCount = input.slots.filter((slot) => isMidTier(slot.lane)).length;

  if (midCount >= minMid) return;

  for (const slot of input.slots) {
    if (midCount >= minMid) break;
    if (!isExpensive(slot.lane) || slot.lane === "superstar") continue;
    reassignSlotLane(slot, slot.lane === "core" ? "depth" : "backup", input.brackets);
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
        if (slot.lane === "superstar") {
          reassignSlotLane(slot, "star", input.brackets);
        } else if (slot.lane === "star") {
          reassignSlotLane(slot, "core", input.brackets);
        } else if (slot.lane === "core" || slot.lane === "specialist") {
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
  templateId?: string;
}): BudgetEnvelope {
  if (input.explicitCounts) {
    const brackets = buildLeagueMarketBrackets(input.faPrices ?? []);
    const cashBufferMw = resolveCashBufferMw(input.spendable);
    const counts = capExplicitCountsByBudget({
      counts: input.explicitCounts,
      spendable: input.spendable,
      steps: input.steps,
      rosterGap: input.rosterGap,
      brackets,
    });
    const slotSequence = buildExplicitSlotSequence({
      steps: input.steps,
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
