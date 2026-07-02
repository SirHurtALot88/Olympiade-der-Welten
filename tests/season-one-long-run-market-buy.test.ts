import { describe, expect, it } from "vitest";

import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { countSeasonBuyTransfers } from "@/lib/season/transfer-season-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { executeLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { SEASON_ONE_MARKET_BUY_BLOCKER } from "@/lib/season/transfer-season-policy";

describe("season-one long-run market buy regression", () => {
  it("keeps S1 market apply at zero buys and blocks direct market execute", async () => {
    const persistence = createPersistenceService();
    const fresh = persistence.createFreshSeasonOneSave({
      name: `S1 market guard regression ${Date.now()}`,
    });
    const seasonId = fresh.gameState.season.id;
    const teamId = fresh.gameState.teams[0]?.teamId;
    const playerId = fresh.gameState.players.find((player) =>
      !fresh.gameState.rosters.some((entry) => entry.playerId === player.id),
    )?.id;
    expect(teamId).toBeTruthy();
    expect(playerId).toBeTruthy();

    const marketApply = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId,
      dryRun: false,
      transferPhase: "manual_transfer_window",
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      options: {
        applyBuySteps: true,
        applySellSteps: false,
      },
    });

    expect(marketApply.summary.appliedBuys).toBe(0);
    expect(marketApply.warnings).toContain("season_market_buy_forbidden");

    const blockedBuy = executeLocalTransfermarktBuy({
      saveId: fresh.saveId,
      seasonId,
      teamId: teamId!,
      playerId: playerId!,
      transferSource: "ai_preseason_market_buy",
    });
    expect(blockedBuy.transferCreated).toBe(false);
    expect(blockedBuy.blockingReasons).toContain(SEASON_ONE_MARKET_BUY_BLOCKER);

    const after = persistence.getSaveById(fresh.saveId);
    expect(after).toBeTruthy();
    const counts = countSeasonBuyTransfers(after!.gameState.transferHistory, seasonId);
    expect(counts.marketBuyCount).toBe(0);
  }, 60_000);
});
