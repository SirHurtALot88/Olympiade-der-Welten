import type { PlannerExplicitCounts } from "@/lib/ai/market-pick-engine/budget-envelope";
import {
  resolveCashBufferMw,
  type LeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

/** Minimum MW to finance `remainingSlots` at depth floor (prevents SS slot 1 + broke tail). */
export function resolveTailReserveMw(input: {
  remainingSlots: number;
  brackets: LeagueMarketBrackets;
}) {
  if (input.remainingSlots <= 0) return 0;
  return round(input.remainingSlots * input.brackets.depth.floorMw, 2);
}

function resolvePyramidMidReserve(input: {
  slotsToFill: number;
  premiumSlotsPlanned: number;
  brackets: LeagueMarketBrackets;
}) {
  if (input.slotsToFill <= 2 && input.premiumSlotsPlanned >= input.slotsToFill) {
    return 0;
  }
  if (input.slotsToFill <= 4) {
    const midSlots = Math.max(0, input.slotsToFill - input.premiumSlotsPlanned);
    return midSlots > 0 ? round(midSlots * input.brackets.depth.targetMw, 2) : 0;
  }
  const minMidSlots = Math.max(2, Math.ceil(input.slotsToFill * 0.35));
  return round(minMidSlots * input.brackets.depth.targetMw, 2);
}

/**
 * Unified S1/S2 slot budget allocator.
 * Premium slots only when tail reserve for remaining slots is covered.
 */
export function planSlotsFromBudget(input: {
  counts: PlannerExplicitCounts;
  spendable: number;
  slotsToFill: number;
  brackets: LeagueMarketBrackets;
  superstarCap?: number;
  /** When true, `spendable` already has MW buffer deducted upstream. */
  spendableIsNet?: boolean;
}): PlannerExplicitCounts {
  const slotsToFill = Math.max(input.slotsToFill, 0);
  const cashBufferMw = input.spendableIsNet ? 0 : resolveCashBufferMw(input.spendable);
  const budget = Math.max(0, input.spendable - cashBufferMw);
  const premiumCap = Math.max(0, input.counts.premiumCap ?? 0);
  const superstarCap = Math.max(0, input.superstarCap ?? 1);

  if (slotsToFill <= 0) {
    return {
      superstarAllowed: 0,
      starAllowed: 0,
      coreNeeded: 0,
      specialistNeeded: 0,
      depthNeeded: 0,
      backupNeeded: 0,
      cheapFillNeeded: 0,
      premiumCap: 0,
    };
  }

  let superstarAllowed = 0;
  let starAllowed = 0;
  let slotsRemaining = slotsToFill;
  let budgetRemaining = budget;

  const ssRequested = Math.min(input.counts.superstarAllowed, superstarCap, premiumCap);
  const starRequested = Math.min(input.counts.starAllowed, premiumCap);

  if (ssRequested > 0 && premiumCap > 0) {
    const tail = resolveTailReserveMw({ remainingSlots: slotsRemaining - 1, brackets: input.brackets });
    const ssCost = input.brackets.superstar.targetMw;
    if (budgetRemaining + 0.01 >= ssCost + tail) {
      superstarAllowed = 1;
      budgetRemaining = round(budgetRemaining - ssCost, 2);
      slotsRemaining -= 1;
    }
  }

  const starBudgetCap = Math.min(starRequested, premiumCap - superstarAllowed, slotsRemaining);
  for (let index = 0; index < starBudgetCap; index += 1) {
    const tail = resolveTailReserveMw({ remainingSlots: slotsRemaining - 1, brackets: input.brackets });
    if (budgetRemaining + 0.01 >= input.brackets.star.floorMw + tail) {
      starAllowed += 1;
      budgetRemaining = round(budgetRemaining - input.brackets.star.targetMw, 2);
      slotsRemaining -= 1;
    } else {
      break;
    }
  }

  const premiumPlanned = superstarAllowed + starAllowed;
  const pyramidReserve = resolvePyramidMidReserve({
    slotsToFill,
    premiumSlotsPlanned: premiumPlanned,
    brackets: input.brackets,
  });

  if (pyramidReserve > 0 && budgetRemaining + 0.01 < pyramidReserve && premiumPlanned > 0 && slotsRemaining > 0) {
    if (starAllowed > 0) {
      starAllowed -= 1;
      budgetRemaining = round(budgetRemaining + input.brackets.star.targetMw, 2);
      slotsRemaining += 1;
    } else if (superstarAllowed > 0) {
      superstarAllowed = 0;
      budgetRemaining = round(budgetRemaining + input.brackets.superstar.targetMw, 2);
      slotsRemaining += 1;
    }
  }

  let coreNeeded = input.counts.coreNeeded;
  let specialistNeeded = input.counts.specialistNeeded;
  let depthNeeded = input.counts.depthNeeded;
  let backupNeeded = input.counts.backupNeeded;
  let cheapFillNeeded = input.counts.cheapFillNeeded;

  const fillRequested =
    coreNeeded + specialistNeeded + depthNeeded + backupNeeded + cheapFillNeeded;
  if (fillRequested > slotsRemaining) {
    const scale = slotsRemaining / Math.max(fillRequested, 1);
    coreNeeded = Math.floor(coreNeeded * scale);
    specialistNeeded = Math.floor(specialistNeeded * scale);
    depthNeeded = Math.floor(depthNeeded * scale);
    backupNeeded = Math.floor(backupNeeded * scale);
    cheapFillNeeded = Math.floor(cheapFillNeeded * scale);
    let allocated = coreNeeded + specialistNeeded + depthNeeded + backupNeeded + cheapFillNeeded;
    const ranked = [
      { lane: "depth" as const, count: input.counts.depthNeeded },
      { lane: "backup" as const, count: input.counts.backupNeeded },
      { lane: "core" as const, count: input.counts.coreNeeded },
    ].sort((left, right) => right.count - left.count);
    while (allocated < slotsRemaining) {
      for (const entry of ranked) {
        if (allocated >= slotsRemaining) break;
        if (entry.lane === "depth") depthNeeded += 1;
        else if (entry.lane === "backup") backupNeeded += 1;
        else coreNeeded += 1;
        allocated += 1;
      }
      if (ranked.every((entry) => entry.count === 0)) break;
    }
  } else if (fillRequested < slotsRemaining) {
    depthNeeded += slotsRemaining - fillRequested;
  }

  const minProtectedCore =
    coreNeeded > 0 && budget + 0.01 >= input.brackets.core.floorMw ? 1 : 0;
  if (slotsToFill > 4) {
    const minDepthBackup = Math.max(2, Math.ceil(slotsToFill * 0.3));
    const currentMid = depthNeeded + backupNeeded;
    if (currentMid < minDepthBackup) {
      const deficit = minDepthBackup - currentMid;
      const coreShift = Math.min(Math.max(coreNeeded - minProtectedCore, 0), deficit);
      coreNeeded -= coreShift;
      depthNeeded += coreShift;
      backupNeeded += deficit - coreShift;
    }
  }

  return {
    superstarAllowed,
    starAllowed,
    coreNeeded,
    specialistNeeded,
    depthNeeded,
    backupNeeded,
    cheapFillNeeded,
    premiumCap: Math.min(premiumCap, superstarAllowed + starAllowed),
  };
}

export function canAffordPremiumMix(input: {
  spendable: number;
  slotsToFill: number;
  brackets: LeagueMarketBrackets;
  wantSuperstar: boolean;
  wantStar: boolean;
  premiumCap: number;
  superstarCap?: number;
}) {
  if (input.premiumCap <= 0 || input.slotsToFill <= 0) return false;
  const planned = planSlotsFromBudget({
    counts: {
      superstarAllowed: input.wantSuperstar ? 1 : 0,
      starAllowed: input.wantStar ? Math.max(input.slotsToFill - (input.wantSuperstar ? 1 : 0), 1) : 0,
      coreNeeded: 0,
      specialistNeeded: 0,
      depthNeeded: 0,
      backupNeeded: 0,
      cheapFillNeeded: 0,
      premiumCap: input.premiumCap,
    },
    spendable: input.spendable,
    slotsToFill: input.slotsToFill,
    brackets: input.brackets,
    superstarCap: input.superstarCap,
  });
  if (input.wantSuperstar && planned.superstarAllowed <= 0) return false;
  if (input.wantStar && planned.starAllowed <= 0) return false;
  return true;
}
