import { describe, expect, it } from "vitest";

import { chooseSwapAwarePackages } from "@/lib/ai/ai-transfer-plan-enrichment";
import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";

function sell(name: string, score: number, ovr: number): AiSellPreviewCandidate & { strategicSellScore: number } {
  return {
    activePlayerId: `ap-${name}`,
    playerId: `p-${name}`,
    playerName: name,
    className: "Runner",
    race: "Human",
    raceName: "Human",
    ovr,
    mvs: 10,
    salary: 4,
    marketValue: 20,
    expectedSellValue: 22,
    contractLength: 1,
    rosterAfter: 8,
    salaryAfter: 10,
    cashAfter: 50,
    sportValueSummary: "",
    performanceSummary: "",
    strategyFitSummary: "Profit window",
    reasonToSell: ["Verkaufsfenster"],
    reasonToKeep: [],
    reasonsToSell: ["Verkaufsfenster"],
    reasonsToKeep: [],
    warnings: [],
    boardTrustScore: 50,
    boardTrustSmiley: ":|",
    boardTrustPolicy: "open",
    boardTrustReasons: [],
    boardTrustWarnings: [],
    salaryCapMultiplier: null,
    sellPriority: score,
    sellPriorityScore: score,
    strategicSellScore: score,
  };
}

function buy(name: string, score: number, replacementFit = 0): AiTransferPreviewRecommendation & {
  strategicBuyScore: number;
  replacementFitScore: number;
  reasonToBuy: string[];
} {
  return {
    playerId: `fa-${name}`,
    playerName: name,
    name,
    className: "Runner",
    race: "Human",
    ovr: 74,
    mvs: 12,
    price: 18,
    marketValue: 18,
    salary: 3,
    contractLength: 2,
    cashAfter: 40,
    rosterAfter: 9,
    salaryAfter: 15,
    teamFit: 0.8,
    fitSummary: "fit",
    sportsSummary: "",
    budgetReason: [],
    warnings: [],
    overallRecommendationScore: score - 5,
    score: score - 5,
    reason: "upgrade",
    fitNotes: [],
    riskNotes: [],
    strategyNotes: [],
    strategicBuyScore: score,
    replacementFitScore: replacementFit,
    reasonToBuy: replacementFit > 0 ? ["Nachfolger fuer verkauften Star"] : ["OPT-Upgrade"],
  };
}

describe("chooseSwapAwarePackages", () => {
  it("prefers a replacement swap package over isolated buy selection", () => {
    const sellCandidates = [sell("Profit Guy", 55, 68), sell("Depth", 30, 60)];
    const buyCandidates = [buy("Generic", 42), buy("Successor", 46, 22)];
    const chosenSells = [sellCandidates[0]];
    const chosenBuys = [buyCandidates[0]];

    const result = chooseSwapAwarePackages({
      sellCandidates,
      buyCandidates,
      chosenSells,
      chosenBuys,
      replacementSlots: [],
      rosterNetQualityLoss: () => 0,
    });

    expect(result.buys[0]?.playerName).toBe("Successor");
    expect(result.swapReason).toMatch(/Tausch:/);
  });
});
