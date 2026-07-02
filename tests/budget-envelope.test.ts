import { describe, expect, it } from "vitest";

import { buildBudgetEnvelope } from "@/lib/ai/market-pick-engine/budget-envelope";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { MarketQualityProfile } from "@/lib/ai/ai-market-quality-profile-service";

const brackets = buildLeagueMarketBrackets([12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110]);

function profile(overrides: Partial<MarketQualityProfile> = {}): MarketQualityProfile {
  return {
    playerMin: 8,
    identityPlayerOpt: 12,
    effectiveOptTarget: 12,
    comfortTarget: 12,
    optFlexSlots: 1,
    starChaser: true,
    starAllowed: 1,
    superstarAllowed: 0,
    coreNeeded: 1,
    premiumFirst: true,
    qualityFloorMw: 12,
    disableCheapLanes: false,
    pickPhase: "fill_to_opt",
    ...overrides,
  };
}

describe("budget-envelope", () => {
  it("plans star slot for star chaser within spendable budget", () => {
    const envelope = buildBudgetEnvelope({
      spendable: 120,
      rosterGap: 3,
      missingToMin: 0,
      steps: 3,
      profile: profile(),
      faPrices: [12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110],
    });
    expect(envelope.slotSequence.some((lane) => lane === "star" || lane === "superstar")).toBe(true);
    expect(envelope.totalPlannedMw + envelope.cashBufferMw).toBeLessThanOrEqual(120 + 0.02);
  });

  it("places premium lanes before depth in sequence when budget allows", () => {
    const envelope = buildBudgetEnvelope({
      spendable: 250,
      rosterGap: 6,
      missingToMin: 0,
      steps: 6,
      profile: profile({ starAllowed: 1, superstarAllowed: 1 }),
      faPrices: [12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110],
    });
    const firstStarIndex = envelope.slotSequence.findIndex((lane) => lane === "star" || lane === "superstar");
    const firstDepthIndex = envelope.slotSequence.findIndex((lane) => lane === "depth");
    expect(firstStarIndex).toBeGreaterThanOrEqual(0);
    if (firstDepthIndex >= 0) {
      expect(firstStarIndex).toBeLessThan(firstDepthIndex);
    }
  });

  it("uses bracket targets aligned with absolute floors", () => {
    const envelope = buildBudgetEnvelope({
      spendable: 90,
      rosterGap: 2,
      missingToMin: 0,
      steps: 2,
      profile: profile({ starAllowed: 1, superstarAllowed: 0 }),
      faPrices: [12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110],
    });
    const starSlot = envelope.slots.find((slot) => slot.lane === "star");
    if (starSlot) {
      expect(starSlot.floorMw).toBeGreaterThanOrEqual(brackets.star.floorMw);
    }
  });
});
