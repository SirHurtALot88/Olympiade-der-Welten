import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { evaluateAntiChurn, resolveAntiChurnOverrides } from "@/lib/ai/in-season-engine/anti-churn-guard";
import {
  RECENTLY_SOLD_SAME_PRESEASON_BLOCKER,
  RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING,
  isRecentlySoldBySameTeam,
} from "@/lib/market/anti-rebuy-guard";
import {
  SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER,
  SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING,
  isPlayerSoldThisSeason,
} from "@/lib/market/transfer-sold-cooldown";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";

// Direct imports of the reused engines, to prove the pipeline surfaces re-export the same functions.
import { evaluateAiSellDecision as directSellDecision } from "@/lib/ai/ai-sell-decision-engine";
import { computeCompositeSellScore as directComposite } from "@/lib/ai/ai-composite-sell-score";
import { scoreReplacementFitForSlots as directReplacementFit } from "@/lib/ai/ai-transfer-replacement-memory";
import { evaluateAiSellDecision, computeCompositeSellScore } from "@/lib/ai/in-season-engine/sell-scoring-pipeline";
import { scoreReplacementFitForSlots } from "@/lib/ai/in-season-engine/replacement-linkage";

function gameStateWithSale(overrides?: { phase?: string }): GameState {
  return {
    season: { id: "season-2" },
    transferHistory: [
      {
        id: "t-1",
        playerId: "p-sold",
        playerName: "Sold Star",
        transferType: "sell",
        fromTeamId: "team-a",
        toTeamId: null,
        seasonId: "season-2",
        happenedAt: "2027-01-01T00:00:00.000Z",
        source: "ai_preseason_market_sell",
        phase: overrides?.phase ?? LOCAL_TRANSFER_WINDOW_PHASE,
        fee: 20,
        marketValue: 22,
        salary: 4,
      },
    ],
  } as unknown as GameState;
}

describe("in-season anti-churn guard — unified composition", () => {
  it("blocks a season-cooldown re-buy and warns when bypassed", () => {
    const gameState = gameStateWithSale();
    // Sanity: the underlying guard agrees the player was sold this season.
    expect(isPlayerSoldThisSeason({ gameState, playerId: "p-sold" })).toBe(true);

    const blocked = evaluateAntiChurn({ gameState, teamId: "team-b", playerId: "p-sold" });
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockingReasons).toContain(SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER);

    const overridden = evaluateAntiChurn({
      gameState,
      teamId: "team-b",
      playerId: "p-sold",
      bypassSoldThisSeasonCooldown: true,
    });
    expect(overridden.blocked).toBe(false);
    expect(overridden.warnings).toContain(SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING);
  });

  it("blocks a same-team same-preseason rebuy and warns when overridden", () => {
    const gameState = gameStateWithSale();
    expect(isRecentlySoldBySameTeam({ gameState, teamId: "team-a", playerId: "p-sold" })).toBe(true);

    const blocked = evaluateAntiChurn({ gameState, teamId: "team-a", playerId: "p-sold" });
    expect(blocked.blockingReasons).toContain(RECENTLY_SOLD_SAME_PRESEASON_BLOCKER);

    const overridden = evaluateAntiChurn({
      gameState,
      teamId: "team-a",
      playerId: "p-sold",
      bypassSoldThisSeasonCooldown: true,
      allowRecentlySoldRebuyOverride: true,
    });
    expect(overridden.blocked).toBe(false);
    expect(overridden.warnings).toContain(RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING);
  });

  it("does not block an unrelated player", () => {
    const gameState = gameStateWithSale();
    const result = evaluateAntiChurn({ gameState, teamId: "team-b", playerId: "p-other" });
    expect(result.blocked).toBe(false);
    expect(result.blockingReasons).toHaveLength(0);
  });

  it("normalizes override flags", () => {
    expect(resolveAntiChurnOverrides({})).toEqual({
      bypassSoldThisSeasonCooldown: false,
      allowRecentlySoldRebuyOverride: false,
    });
    expect(resolveAntiChurnOverrides({ bypassSoldThisSeasonCooldown: true })).toEqual({
      bypassSoldThisSeasonCooldown: true,
      allowRecentlySoldRebuyOverride: false,
    });
  });
});

describe("in-season pipeline surfaces re-export the reused engines (no drift)", () => {
  it("sell-scoring-pipeline re-exports identical function references", () => {
    expect(evaluateAiSellDecision).toBe(directSellDecision);
    expect(computeCompositeSellScore).toBe(directComposite);
  });
  it("replacement-linkage re-exports identical function references", () => {
    expect(scoreReplacementFitForSlots).toBe(directReplacementFit);
  });
});
