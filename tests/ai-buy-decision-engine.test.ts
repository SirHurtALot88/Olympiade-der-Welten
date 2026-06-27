import { describe, expect, it } from "vitest";

import { evaluateAiBuyDecision } from "@/lib/ai/ai-buy-decision-engine";
import { resolveTransferDoctrineFromProfile } from "@/lib/ai/ai-transfer-doctrine-layer";
import type { ReplacementSlot } from "@/lib/ai/ai-transfer-replacement-memory";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";

function hoarderDoctrine() {
  return resolveTransferDoctrineFromProfile({
    teamId: "H-H",
    strategySummary: "Hoard cash",
    bias: {
      starPriority: 4,
      cashPriority: 8,
      sellForProfitAggression: 3,
      valuePriority: 5,
      loyaltyBias: 5,
      rosterDepthPreference: 4,
      shortContractPreference: 5,
    },
  } as TeamStrategyProfile);
}

describe("ai-buy-decision-engine", () => {
  it("blocks buys when cash is negative", () => {
    const result = evaluateAiBuyDecision({
      playerId: "fa-1",
      playerName: "Target",
      price: 10,
      marketValue: 10,
      salary: 2,
      ovr: 70,
      score: 60,
      rosterAfterSell: 6,
      playerMin: 7,
      playerOpt: 9,
      teamCash: -5,
      cashAfterSell: -5,
      plannedSellCount: 0,
      weakestSameAxisOvrRank: null,
      candidateRating: null,
      player: null,
      replacementSlots: [],
      doctrine: hoarderDoctrine(),
      coversNeedAxis: true,
      isTrashCandidate: false,
    });

    expect(result.buyIntentScore).toBe(0);
    expect(result.buyDecisionLabel).toBe("Cash blockiert");
  });

  it("prefers replacement-fit buys over generic opt upgrades", () => {
    const slot: ReplacementSlot = {
      slotId: "slot-1",
      teamId: "T-T",
      soldPlayerId: "sold-1",
      soldPlayerName: "Old Star",
      soldOvr: 80,
      soldOvrRank: 8,
      soldPpsRank: 10,
      soldAxis: "spe",
      saleProceeds: 30,
      freedSalary: 6,
      maxBuyPrice: 28,
      minOvrBand: 56,
      urgency: "high",
      slotLabel: "Nachfolger fuer Old Star",
      fulfilled: false,
    };

    const result = evaluateAiBuyDecision({
      playerId: "fa-2",
      playerName: "Successor",
      price: 22,
      marketValue: 22,
      salary: 4,
      ovr: 72,
      score: 48,
      rosterAfterSell: 8,
      playerMin: 7,
      playerOpt: 10,
      teamCash: 40,
      cashAfterSell: 70,
      plannedSellCount: 1,
      weakestSameAxisOvrRank: 40,
      candidateRating: { ovrRank: 14, ovrNormalized: 72 } as never,
      player: { coreStats: { pow: 30, spe: 55, men: 40, soc: 35 } } as never,
      replacementSlots: [slot],
      doctrine: resolveTransferDoctrineFromProfile(null),
      coversNeedAxis: false,
      isTrashCandidate: false,
    });

    expect(result.replacementFitScore).toBeGreaterThan(0);
    expect(result.buyDecisionLabel).toBe("Star-Nachfolger");
    expect(result.strategicBuyScore).toBeGreaterThan(35);
  });

  it("lets hoarder pass on optional buys despite healthy cash", () => {
    const result = evaluateAiBuyDecision({
      playerId: "fa-3",
      playerName: "Optional",
      price: 12,
      marketValue: 12,
      salary: 2,
      ovr: 62,
      score: 46,
      rosterAfterSell: 9,
      playerMin: 7,
      playerOpt: 9,
      teamCash: 80,
      cashAfterSell: 80,
      plannedSellCount: 0,
      weakestSameAxisOvrRank: null,
      candidateRating: null,
      player: null,
      replacementSlots: [],
      doctrine: hoarderDoctrine(),
      coversNeedAxis: false,
      isTrashCandidate: false,
    });

    expect(result.passIntentScore).toBeGreaterThan(result.buyIntentScore);
    expect(result.buyDecisionLabel).toMatch(/Hoarder|passen|abwaegen/);
  });
});
