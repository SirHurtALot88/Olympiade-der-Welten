import { describe, expect, it } from "vitest";

import {
  buildReplacementSlotsFromHistory,
  buildReplacementSlotsFromPlannedSells,
  scoreReplacementFitForSlots,
} from "@/lib/ai/ai-transfer-replacement-memory";
import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

function makePlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 80,
    marketValue: partial?.marketValue ?? 30,
    salaryDemand: 5,
    pps: null,
    ovr: partial?.rating ?? 80,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: partial?.coreStats ?? { pow: 30, spe: 55, men: 40, soc: 35 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: null,
    currentXP: 0,
  };
}

function makeGameState(partial?: {
  transferHistory?: GameState["transferHistory"];
  players?: Player[];
}): GameState {
  return {
    season: { id: "season-1", name: "S1", year: 2026, currentMatchday: 1, matchdayIds: [] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", phase: "preseason", completedMatchIds: [] },
    teams: [],
    teamIdentities: [],
    players: partial?.players ?? [makePlayer("star-1", { name: "Old Star", rating: 82, marketValue: 32 })],
    rosters: [],
    disciplines: [],
    matchdayResults: [],
    seasonMatchdayResults: [],
    transferHistory: partial?.transferHistory ?? [],
    gamePhase: "preseason",
  } as GameState;
}

function makeSellCandidate(partial?: Partial<AiSellPreviewCandidate>): AiSellPreviewCandidate {
  return {
    activePlayerId: "ap-star-2",
    playerId: "star-2",
    playerName: "Second Star",
    className: "Mage",
    race: "Elf",
    raceName: "Elf",
    ovr: 84,
    mvs: 18,
    salary: 7,
    marketValue: 34,
    expectedSellValue: 36,
    contractLength: 1,
    rosterAfter: 8,
    salaryAfter: 20,
    cashAfter: 70,
    sportValueSummary: "Star",
    performanceSummary: "Star",
    strategyFitSummary: "Core star",
    reasonToSell: ["Verkaufsfenster"],
    reasonToKeep: ["Star bleibt Core"],
    reasonsToSell: ["Verkaufsfenster"],
    reasonsToKeep: ["Star bleibt Core"],
    warnings: [],
    boardTrustScore: 70,
    boardTrustSmiley: ":)",
    boardTrustPolicy: "open",
    boardTrustReasons: [],
    boardTrustWarnings: [],
    salaryCapMultiplier: null,
    sellPriority: 58,
    sellPriorityScore: 58,
    keepIntentScore: 60,
    productiveElite: true,
    ...partial,
  } as AiSellPreviewCandidate;
}

function makeBuyCandidate(partial?: Partial<AiTransferPreviewRecommendation>): AiTransferPreviewRecommendation {
  return {
    playerId: "fa-successor",
    playerName: "Cheap Successor",
    name: "Cheap Successor",
    className: "Runner",
    race: "Human",
    ovr: 72,
    mvs: 14,
    price: 20,
    marketValue: 20,
    salary: 4,
    contractLength: 2,
    cashAfter: 40,
    rosterAfter: 9,
    salaryAfter: 20,
    teamFit: 0.7,
    fitSummary: "fit",
    sportsSummary: "SPE heavy",
    budgetReason: [],
    warnings: [],
    overallRecommendationScore: 50,
    score: 50,
    reason: "value",
    fitNotes: [],
    riskNotes: [],
    strategyNotes: [],
    ...partial,
  };
}

describe("ai-transfer-replacement-memory", () => {
  it("creates replacement slots from star sells in transfer history", () => {
    const gameState = makeGameState({
      transferHistory: [
        {
          seasonId: "season-1",
          transferType: "sell",
          fromTeamId: "T-T",
          playerId: "star-1",
          playerName: "Old Star",
          fee: 30,
          marketValue: 32,
          salary: 6,
          source: "ai_preseason_market_sell",
        },
      ],
    });

    const slots = buildReplacementSlotsFromHistory(gameState, "T-T");
    expect(slots).toHaveLength(1);
    expect(slots[0].soldPlayerName).toBe("Old Star");
    expect(slots[0].maxBuyPrice).toBeGreaterThan(0);
  });

  it("adds planned star sells up to max 2-3 slots", () => {
    const gameState = makeGameState({
      players: [
        makePlayer("star-1"),
        makePlayer("star-2", { name: "Second Star", coreStats: { pow: 28, spe: 58, men: 42, soc: 36 } }),
        makePlayer("star-3", { name: "Third Star", coreStats: { pow: 32, spe: 52, men: 44, soc: 38 } }),
      ],
    });

    const slots = buildReplacementSlotsFromPlannedSells({
      teamId: "T-T",
      gameState,
      plannedSells: [
        makeSellCandidate({ playerId: "star-2", playerName: "Second Star" }),
        makeSellCandidate({ playerId: "star-3", playerName: "Third Star", activePlayerId: "ap-star-3" }),
      ],
      maxSlots: 3,
    });

    expect(slots.length).toBeGreaterThanOrEqual(2);
  });

  it("scores replacement fit for cheaper same-profile candidates", () => {
    const slot = buildReplacementSlotsFromPlannedSells({
      teamId: "T-T",
      gameState: makeGameState(),
      plannedSells: [makeSellCandidate()],
    })[0];

    const fit = scoreReplacementFitForSlots({
      candidate: makeBuyCandidate(),
      player: makePlayer("fa-successor", { coreStats: { pow: 28, spe: 56, men: 40, soc: 34 } }),
      rating: { ovrRank: 12, ovrNormalized: 72, ppSpeRank: 14 } as never,
      slots: [slot],
    });

    expect(fit.score).toBeGreaterThan(0);
    expect(fit.reason).toMatch(/Nachfolger/);
  });
});
