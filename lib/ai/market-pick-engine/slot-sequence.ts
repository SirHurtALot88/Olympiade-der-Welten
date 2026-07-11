import type { MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";

export type SlotSequenceInput = {
  steps: number;
  missingToMin: number;
  rosterGap: number;
  superstarAllowed: number;
  starAllowed: number;
  coreNeeded: number;
  specialistNeeded: number;
  premiumFirst: boolean;
  minGapLane?: "depth" | "cheap_fill";
};

function pushMany(plan: MarketPickLane[], lane: MarketPickLane, count: number, maxLength: number) {
  let remaining = count;
  while (remaining > 0 && plan.length < maxLength) {
    plan.push(lane);
    remaining -= 1;
  }
}

export function buildPremiumFirstSlotSequence(input: SlotSequenceInput): MarketPickLane[] {
  const plannedSlots = Math.max(input.rosterGap, input.missingToMin, input.steps);
  const slotPlan: MarketPickLane[] = [];

  if (input.missingToMin > 0) {
    const minLane = input.minGapLane ?? "depth";
    pushMany(slotPlan, minLane, input.missingToMin, plannedSlots);
  }

  const premiumCap = Math.min(
    input.superstarAllowed + input.starAllowed,
    Math.max(input.premiumFirst ? 1 : 0, Math.ceil(plannedSlots * 0.25)),
    3,
  );
  if (input.premiumFirst && input.missingToMin === 0) {
    if (input.starAllowed > 0 && premiumCap > 0) {
      pushMany(slotPlan, "star", Math.min(input.starAllowed, premiumCap), plannedSlots);
    }
    const premiumUsed = slotPlan.filter((lane) => lane === "superstar" || lane === "star").length;
    if (input.superstarAllowed > 0 && premiumUsed < premiumCap) {
      pushMany(slotPlan, "superstar", 1, plannedSlots);
    }
  }

  pushMany(slotPlan, "core", input.coreNeeded, plannedSlots);
  pushMany(slotPlan, "specialist", input.specialistNeeded, plannedSlots);

  const used = slotPlan.length;
  const remaining = Math.max(plannedSlots - used, 0);
  const depthNeeded = Math.max(remaining - 2, 0);
  const backupNeeded = Math.min(2, Math.max(remaining - depthNeeded, 0));

  pushMany(slotPlan, "depth", depthNeeded, plannedSlots);
  pushMany(slotPlan, "backup", backupNeeded, plannedSlots);

  if (!input.premiumFirst || input.missingToMin > 0) {
    if (input.starAllowed > 0 && slotPlan.filter((lane) => lane === "star").length < input.starAllowed) {
      pushMany(slotPlan, "star", 1, plannedSlots);
    }
    if (input.superstarAllowed > 0 && !slotPlan.includes("superstar")) {
      pushMany(slotPlan, "superstar", 1, plannedSlots);
    }
  }

  while (slotPlan.length < input.steps) {
    slotPlan.push(input.missingToMin > slotPlan.length ? "depth" : "backup");
  }

  return slotPlan.slice(0, input.steps);
}

function stableDraftHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function draftUnit(seed: string) {
  return (stableDraftHash(seed) % 10000) / 9999;
}

export function applyDraftSeedLaneVariation(input: {
  slotPlan: MarketPickLane[];
  draftSeed: string | null;
  teamCode: string;
  missingToMin: number;
}) {
  if (!input.draftSeed || input.slotPlan.length < 3) {
    return input.slotPlan;
  }
  const varied = [...input.slotPlan];
  const safeStart = Math.max(1, Math.min(input.missingToMin, varied.length - 2));
  for (let index = safeStart; index < varied.length - 1; index += 1) {
    const current = varied[index];
    const next = varied[index + 1];
    if (current === next) {
      continue;
    }
    const currentPremium = current === "superstar" || current === "star";
    const nextPremium = next === "superstar" || next === "star";
    if ((currentPremium || nextPremium) && index < safeStart + 2) {
      continue;
    }
    if (draftUnit(`${input.draftSeed}:${input.teamCode}:lane-swap:${index}`) > 0.63) {
      varied[index] = next;
      varied[index + 1] = current;
      index += 1;
    }
  }
  return varied;
}
