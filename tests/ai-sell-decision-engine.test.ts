import { describe, expect, it } from "vitest";

import { evaluateAiSellDecision, isProductiveElite } from "@/lib/ai/ai-sell-decision-engine";
import { resolveTransferDoctrineFromProfile } from "@/lib/ai/ai-transfer-doctrine-layer";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";

function churnerDoctrine() {
  return resolveTransferDoctrineFromProfile({
    teamId: "C-C",
    strategySummary: "Churn roster",
    bias: {
      starPriority: 6,
      cashPriority: 3,
      sellForProfitAggression: 8,
      valuePriority: 7,
      loyaltyBias: 2,
      rosterDepthPreference: 5,
      shortContractPreference: 7,
    },
  } as TeamStrategyProfile);
}

describe("ai-sell-decision-engine", () => {
  it("raises sell intent for negative cash and profit window", () => {
    const result = evaluateAiSellDecision({
      sellPriority: 40,
      reasonToSell: ["negatives Teamcash zum Seasonstart", "realisierbarer Gewinn von 4.0"],
      sellReasonCodes: ["negative_cash", "profit_window"],
      reasonToKeep: [],
      expectedSellValue: 22,
      marketValue: 18,
      contractLength: 2,
      teamCash: -3,
      ovrRank: 45,
      ppsSeasonRank: 50,
      underperformed: true,
    });

    expect(result.sellIntentScore).toBeGreaterThan(40);
    expect(result.strategicSellScore).toBeGreaterThanOrEqual(result.sellIntentScore - result.keepIntentScore);
    expect(result.sellDecisionLabel.length).toBeGreaterThan(0);
  });

  it("protects productive elite with keep intent", () => {
    expect(isProductiveElite({ ovrRank: 8, ppsSeasonRank: 30 })).toBe(true);

    const result = evaluateAiSellDecision({
      sellPriority: 35,
      reasonToSell: [],
      reasonToKeep: ["Star-/Core-Spieler wird nur bei echtem Finanz- oder Boarddruck bewegt", "laengerer Restvertrag"],
      keepReasonCodes: ["star_core_protection", "long_contract"],
      expectedSellValue: 15,
      marketValue: 20,
      contractLength: 5,
      teamCash: 40,
      ovrRank: 8,
      ppsSeasonRank: 18,
    });

    expect(result.keepIntentScore).toBeGreaterThan(20);
    expect(result.productiveElite).toBe(true);
  });

  it("applies doctrine multiplier without hard locks", () => {
    const base = evaluateAiSellDecision({
      sellPriority: 50,
      reasonToSell: ["Performance blieb unter Erwartung"],
      sellReasonCodes: ["underperformance"],
      reasonToKeep: [],
      expectedSellValue: 12,
      marketValue: 10,
      contractLength: 1,
      teamCash: 5,
      ovrRank: 60,
      ppsSeasonRank: 55,
      underperformed: true,
    });

    const withDoctrine = evaluateAiSellDecision({
      sellPriority: 50,
      reasonToSell: ["Performance blieb unter Erwartung"],
      sellReasonCodes: ["underperformance"],
      reasonToKeep: [],
      expectedSellValue: 12,
      marketValue: 10,
      contractLength: 1,
      teamCash: 5,
      ovrRank: 60,
      ppsSeasonRank: 55,
      underperformed: true,
      doctrine: churnerDoctrine(),
    });

    expect(withDoctrine.strategicSellScore).not.toBe(base.strategicSellScore);
  });
});

/**
 * GEHALT GEGEN UEBLICH IN DER KI.
 *
 * `overpaid_for_output` beantwortet eine andere Frage als `high_wage_burden`: nicht "koennen wir
 * ihn uns leisten" (Gehalt gegen Budget), sondern "ist er es wert" (Gehalt gegen den ueblichen
 * Preis fuer diese Leistung). Der letzte Test ist der wichtige — er haelt fest, dass die
 * Kennzahl NICHT einfach schwache Spieler abstraft: Leistung allein darf den Ausschlag nicht
 * geben, sonst verkauft die KI Spieler fuer ihre Schwaeche und nennt es Wirtschaftlichkeit.
 */
describe("ai-sell-decision-engine — Gehalt gegen ueblich", () => {
  const basis = {
    sellPriority: 40,
    reasonToSell: [] as string[],
    reasonToKeep: [] as string[],
    expectedSellValue: 20,
    marketValue: 20,
    contractLength: 3,
    teamCash: 10,
    ovrRank: 40,
    ppsSeasonRank: 40,
  };

  it("hebt die Verkaufsneigung, wenn ein Spieler mehr verdient als ueblich", () => {
    const neutral = evaluateAiSellDecision(basis);
    const teuer = evaluateAiSellDecision({ ...basis, sellReasonCodes: ["overpaid_for_output"] });
    expect(teuer.sellIntentScore).toBeGreaterThan(neutral.sellIntentScore);
    expect(teuer.strategicSellScore).toBeGreaterThan(neutral.strategicSellScore);
  });

  it("senkt sie, wenn der Vertrag guenstiger ist als ueblich", () => {
    const neutral = evaluateAiSellDecision(basis);
    const guenstig = evaluateAiSellDecision({ ...basis, keepReasonCodes: ["bargain_contract"] });
    expect(guenstig.keepIntentScore).toBeGreaterThan(neutral.keepIntentScore);
    expect(guenstig.strategicSellScore).toBeLessThan(neutral.strategicSellScore);
  });

  it("loest allein noch keinen Verkauf aus — es ist ein Argument, kein Zwang", () => {
    // Ein Wirtschaftlichkeits-Hinweis darf abwaegen helfen, aber nicht so schwer wiegen wie
    // eine echte Cash-Not. Sonst verkauft die KI reihenweise brauchbare Spieler, nur weil ihr
    // Vertrag etwas ueber der Kurve liegt.
    const teuer = evaluateAiSellDecision({ ...basis, sellReasonCodes: ["overpaid_for_output"] });
    const cashNot = evaluateAiSellDecision({ ...basis, sellReasonCodes: ["negative_cash"], teamCash: -5 });
    expect(teuer.sellIntentScore).toBeLessThan(cashNot.sellIntentScore);
  });

  it("straft Leistungsschwaeche NICHT als Kostenproblem ab", () => {
    // Zwei schwache Spieler (gleich schlechte Raenge). Nur einer ist ueber der Gehaltskurve.
    // Ohne den Marker darf sich die Verkaufsneigung nicht erhoehen — sonst waere die Schwaeche
    // selbst der Grund, und genau das soll die Kennzahl vermeiden.
    const schwachUndBillig = evaluateAiSellDecision({ ...basis, ovrRank: 78, ppsSeasonRank: 80 });
    const schwachUndTeuer = evaluateAiSellDecision({
      ...basis,
      ovrRank: 78,
      ppsSeasonRank: 80,
      sellReasonCodes: ["overpaid_for_output"],
    });
    const starkUndBillig = evaluateAiSellDecision({ ...basis, ovrRank: 3, ppsSeasonRank: 4 });

    expect(schwachUndBillig.sellIntentScore).toBe(basis.sellPriority);
    expect(schwachUndTeuer.sellIntentScore).toBeGreaterThan(schwachUndBillig.sellIntentScore);
    // Der starke Spieler wird geschuetzt (productiveElite) — der schwache aber nicht bestraft:
    // beide starten bei derselben Verkaufsneigung, sie unterscheiden sich nur im Behalten-Wert.
    expect(starkUndBillig.sellIntentScore).toBe(schwachUndBillig.sellIntentScore);
    expect(starkUndBillig.keepIntentScore).toBeGreaterThan(schwachUndBillig.keepIntentScore);
  });
});
