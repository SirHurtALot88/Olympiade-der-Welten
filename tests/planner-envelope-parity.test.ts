import { describe, expect, it } from "vitest";

import {
  buildExplicitSlotSequence,
  buildLegacyCompareSlotPlan,
} from "@/lib/ai/market-pick-engine/explicit-slot-sequence";
import {
  buildPlannerEnvelope,
  capExplicitCountsByBudget,
} from "@/lib/ai/market-pick-engine/budget-envelope";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { MarketQualityProfile } from "@/lib/ai/ai-market-quality-profile-service";

const s1Fixture = {
  steps: 12,
  missingToMin: 0,
  targetSlotsMissing: 12,
  superstarAllowed: 1,
  starAllowed: 2,
  coreNeeded: 2,
  specialistNeeded: 1,
  depthNeeded: 4,
  backupNeeded: 2,
  cheapFillNeeded: 0,
  premiumCap: 3,
  premiumFirst: true,
};

function profile(overrides: Partial<MarketQualityProfile> = {}): MarketQualityProfile {
  return {
    playerMin: 8,
    identityPlayerOpt: 12,
    effectiveOptTarget: 12,
    comfortTarget: 12,
    optFlexSlots: 0,
    starChaser: true,
    starAllowed: 2,
    superstarAllowed: 1,
    coreNeeded: 2,
    premiumFirst: true,
    qualityFloorMw: 12,
    disableCheapLanes: false,
    pickPhase: "fill_to_opt",
    ...overrides,
  };
}

describe("planner-envelope-parity", () => {
  it("buildExplicitSlotSequence interleaves depth before all core slots are exhausted", () => {
    const explicit = buildExplicitSlotSequence(s1Fixture);
    const firstDepth = explicit.findIndex((lane) => lane === "depth");
    const lastCore = explicit.lastIndexOf("core");
    expect(firstDepth).toBeGreaterThanOrEqual(0);
    expect(firstDepth).toBeLessThan(lastCore + 2);
    expect(explicit.filter((lane) => lane === "depth" || lane === "backup").length).toBeGreaterThanOrEqual(4);
  });

  it("buildPlannerEnvelope explicit path preserves interleaved lanes and mid-tier reserve", () => {
    const envelope = buildPlannerEnvelope({
      spendable: 400,
      rosterGap: s1Fixture.targetSlotsMissing,
      missingToMin: s1Fixture.missingToMin,
      steps: s1Fixture.steps,
      profile: profile(),
      faPrices: [12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110],
      explicitCounts: {
        superstarAllowed: s1Fixture.superstarAllowed,
        starAllowed: s1Fixture.starAllowed,
        coreNeeded: s1Fixture.coreNeeded,
        specialistNeeded: s1Fixture.specialistNeeded,
        depthNeeded: s1Fixture.depthNeeded,
        backupNeeded: s1Fixture.backupNeeded,
        cheapFillNeeded: s1Fixture.cheapFillNeeded,
        premiumCap: s1Fixture.premiumCap,
      },
    });
    const midTierCount = envelope.slotSequence.filter(
      (lane) => lane === "depth" || lane === "backup" || lane === "specialist",
    ).length;
    expect(midTierCount).toBeGreaterThanOrEqual(4);
    expect(envelope.brackets.star.floorMw).toBe(45);
  });

  it("capExplicitCountsByBudget shifts excess core into depth on tight budgets", () => {
    const brackets = buildLeagueMarketBrackets([12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110]);
    const capped = capExplicitCountsByBudget({
      counts: {
        superstarAllowed: 1,
        starAllowed: 2,
        coreNeeded: 6,
        specialistNeeded: 1,
        depthNeeded: 1,
        backupNeeded: 1,
        cheapFillNeeded: 0,
        premiumCap: 3,
      },
      spendable: 180,
      steps: 10,
      rosterGap: 10,
      brackets,
    });
    expect(capped.coreNeeded).toBeLessThan(6);
    expect(capped.depthNeeded + capped.backupNeeded).toBeGreaterThanOrEqual(3);
  });
});
