import type { MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";

export type ExplicitSlotSequenceInput = {
  steps: number;
  missingToMin: number;
  targetSlotsMissing: number;
  superstarAllowed: number;
  starAllowed: number;
  coreNeeded: number;
  specialistNeeded: number;
  depthNeeded: number;
  backupNeeded: number;
  cheapFillNeeded: number;
  premiumCap?: number;
  premiumFirst: boolean;
  minGapLane?: "depth" | "cheap_fill";
};

type LaneCounts = Record<MarketPickLane, number>;

function emptyLaneCounts(): LaneCounts {
  return {
    superstar: 0,
    star: 0,
    core: 0,
    specialist: 0,
    depth: 0,
    backup: 0,
    cheap_fill: 0,
  };
}

function pushMany(plan: MarketPickLane[], lane: MarketPickLane, count: number, maxLength: number) {
  let remaining = count;
  while (remaining > 0 && plan.length < maxLength) {
    plan.push(lane);
    remaining -= 1;
  }
}

function resolvePremiumCounts(input: ExplicitSlotSequenceInput, plannedSlots: number) {
  const counts = emptyLaneCounts();
  if (!input.premiumFirst) {
    return counts;
  }
  const slotsForPremium = Math.max(input.targetSlotsMissing, input.missingToMin, 1);
  const smallFill = slotsForPremium <= 4;
  const premiumBudget = smallFill
    ? input.superstarAllowed + input.starAllowed
    : Math.max(slotsForPremium - 7, 0);
  const premiumSlots = Math.min(
    input.superstarAllowed + input.starAllowed,
    premiumBudget,
    Math.max(input.premiumCap ?? 2, 0),
  );
  if (input.superstarAllowed > 0 && premiumSlots > 0) {
    counts.superstar = 1;
    counts.star = Math.min(input.starAllowed, Math.max(premiumSlots - 1, 0));
  } else {
    counts.star = Math.min(input.starAllowed, premiumSlots);
  }
  return counts;
}

/**
 * Budget-aware lane pyramid: interleave premium/core with depth/backup so cash is not
 * front-loaded into expensive tiers and the tail is not reserve-only filler.
 */
export function interleaveLanePyramid(counts: LaneCounts, maxLength: number): MarketPickLane[] {
  const plan: MarketPickLane[] = [];
  const remaining = { ...counts };
  const waveOrder: MarketPickLane[] = [
    "core",
    "star",
    "superstar",
    "depth",
    "backup",
    "specialist",
    "cheap_fill",
  ];
  let stagnantPasses = 0;
  while (plan.length < maxLength && stagnantPasses < 2) {
    let pushed = false;
    for (const lane of waveOrder) {
      if (remaining[lane] > 0 && plan.length < maxLength) {
        plan.push(lane);
        remaining[lane] -= 1;
        pushed = true;
      }
    }
    stagnantPasses = pushed ? 0 : stagnantPasses + 1;
  }
  return plan;
}

/** S1-style explicit slot sequence with interleaved core/depth pyramid. */
export function buildExplicitSlotSequence(input: ExplicitSlotSequenceInput): MarketPickLane[] {
  const plannedSlots = Math.max(input.targetSlotsMissing, input.missingToMin, input.steps);
  const slotPlan: MarketPickLane[] = [];
  const minLane = input.minGapLane ?? "depth";

  if (input.missingToMin > 0) {
    pushMany(slotPlan, minLane, input.missingToMin, plannedSlots);
  }

  const counts = resolvePremiumCounts(input, plannedSlots);
  counts.core = input.coreNeeded;
  counts.specialist = input.specialistNeeded;
  counts.depth = input.depthNeeded;
  counts.backup = input.backupNeeded;
  counts.cheap_fill = input.cheapFillNeeded;

  const interleaved = interleaveLanePyramid(counts, plannedSlots - slotPlan.length);
  slotPlan.push(...interleaved);

  while (slotPlan.length < input.steps && slotPlan.length < plannedSlots) {
    slotPlan.push(slotPlan.length < input.missingToMin ? minLane : "depth");
  }

  return slotPlan.slice(0, input.steps);
}

/** @deprecated Legacy compare path for parity tests only. */
export function buildLegacyCompareSlotPlan(input: ExplicitSlotSequenceInput & { season1OptimumMode?: boolean }) {
  if (input.season1OptimumMode ?? input.premiumFirst) {
    return buildExplicitSlotSequence({ ...input, premiumFirst: true });
  }

  const slotPlan: MarketPickLane[] = [];
  const pushMany = (lane: MarketPickLane, count: number) => {
    while (count > 0 && slotPlan.length < input.steps) {
      slotPlan.push(lane);
      count -= 1;
    }
  };

  if (input.superstarAllowed > 0 && input.missingToMin === 0 && input.coreNeeded === 0) {
    pushMany("superstar", input.superstarAllowed);
  }
  if (input.starAllowed > 0 && input.missingToMin === 0 && input.coreNeeded === 0) {
    pushMany("star", Math.min(1, input.starAllowed));
  }
  pushMany("core", input.coreNeeded);
  pushMany("specialist", input.specialistNeeded);
  if (input.missingToMin > 0) {
    pushMany("cheap_fill", input.cheapFillNeeded);
  }
  pushMany("depth", input.depthNeeded);
  pushMany("backup", input.backupNeeded);
  if (input.starAllowed > 0 && slotPlan.length < input.steps) {
    pushMany("star", input.starAllowed);
  }
  while (slotPlan.length < input.steps) {
    slotPlan.push(input.missingToMin > 0 ? "cheap_fill" : "depth");
  }
  return slotPlan.slice(0, input.steps);
}
