import { describe, expect, it } from "vitest";

import {
  canAffordPremiumMix,
  planSlotsFromBudget,
  resolveTailReserveMw,
} from "@/lib/ai/market-pick-engine/budget-slot-allocator";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";

const fa = [12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110];
const brackets = buildLeagueMarketBrackets(fa);

describe("budget-slot-allocator", () => {
  it("plans superstar + star for 150 MW and 2 slots with high premium cap", () => {
    const planned = planSlotsFromBudget({
      counts: {
        superstarAllowed: 1,
        starAllowed: 2,
        coreNeeded: 0,
        specialistNeeded: 0,
        depthNeeded: 0,
        backupNeeded: 0,
        cheapFillNeeded: 0,
        premiumCap: 2,
      },
      spendable: 150,
      slotsToFill: 2,
      brackets,
      superstarCap: 1,
    });
    expect(planned.superstarAllowed).toBe(1);
    expect(planned.starAllowed).toBe(1);
    expect(planned.depthNeeded).toBe(0);
  });

  it("blocks superstar for low premium cap even with budget", () => {
    const planned = planSlotsFromBudget({
      counts: {
        superstarAllowed: 1,
        starAllowed: 1,
        coreNeeded: 2,
        specialistNeeded: 0,
        depthNeeded: 3,
        backupNeeded: 2,
        cheapFillNeeded: 0,
        premiumCap: 0,
      },
      spendable: 150,
      slotsToFill: 8,
      brackets,
      superstarCap: 1,
    });
    expect(planned.superstarAllowed).toBe(0);
    expect(planned.starAllowed).toBe(0);
  });

  it("requires tail reserve before superstar on large gaps with tight budget", () => {
    const planned = planSlotsFromBudget({
      counts: {
        superstarAllowed: 1,
        starAllowed: 1,
        coreNeeded: 2,
        specialistNeeded: 0,
        depthNeeded: 4,
        backupNeeded: 2,
        cheapFillNeeded: 0,
        premiumCap: 2,
      },
      spendable: 100,
      slotsToFill: 8,
      brackets,
      superstarCap: 1,
    });
    expect(planned.superstarAllowed).toBe(0);
  });

  it("canAffordPremiumMix returns true for 150/2 premium team", () => {
    expect(
      canAffordPremiumMix({
        spendable: 150,
        slotsToFill: 2,
        brackets,
        wantSuperstar: true,
        wantStar: true,
        premiumCap: 2,
        superstarCap: 1,
      }),
    ).toBe(true);
  });

  it("resolveTailReserveMw scales with remaining slots", () => {
    expect(resolveTailReserveMw({ remainingSlots: 3, brackets })).toBe(60);
  });
});
