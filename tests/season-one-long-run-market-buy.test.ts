import { describe, expect, it } from "vitest";

import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { countSeasonBuyTransfers } from "@/lib/season/transfer-season-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { executeLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { SEASON_ONE_MARKET_BUY_BLOCKER } from "@/lib/season/transfer-season-policy";

// Course correction (2026-07-04): S1 buys are NOT forbidden — the draft is just the first
// ordinary application of the same acquisition engine to empty rosters with starting budget. A
// team that sells down (or organically drops) below hardMin/Opt in S1 must be able to rebuy in
// the same season via the Unified-backed convergence/apply path, exactly like any later season.
// This test used to assert the opposite (S1 market buys hard-blocked); it now asserts the new,
// intended behaviour.
describe("season-one long-run market buy (course-corrected)", () => {
  it("permits a S1 market buy through applyAiMarketPlanLocally and direct execute", async () => {
    const persistence = createPersistenceService();
    const fresh = persistence.createFreshSeasonOneSave({
      name: `S1 market buy regression ${Date.now()}`,
    });
    const seasonId = fresh.gameState.season.id;
    const teamId = fresh.gameState.teams[0]?.teamId;
    const playerId = fresh.gameState.players.find((player) =>
      !fresh.gameState.rosters.some((entry) => entry.playerId === player.id),
    )?.id;
    expect(teamId).toBeTruthy();
    expect(playerId).toBeTruthy();

    const directBuy = executeLocalTransfermarktBuy({
      saveId: fresh.saveId,
      seasonId,
      teamId: teamId!,
      playerId: playerId!,
      transferSource: "ai_preseason_market_buy",
    });
    expect(directBuy.blockingReasons).not.toContain(SEASON_ONE_MARKET_BUY_BLOCKER);
    expect(directBuy.transferCreated).toBe(true);

    const after = persistence.getSaveById(fresh.saveId);
    expect(after).toBeTruthy();
    const counts = countSeasonBuyTransfers(after!.gameState.transferHistory, seasonId);
    expect(counts.marketBuyCount).toBe(1);
  }, 60_000);

  it("no longer forbids S1 market buys in applyAiMarketPlanLocally's marketBuysAllowed gate", async () => {
    const persistence = createPersistenceService();
    const fresh = persistence.createFreshSeasonOneSave({
      name: `S1 market apply regression ${Date.now()}`,
    });
    const seasonId = fresh.gameState.season.id;

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

    expect(marketApply.warnings).not.toContain("season_market_buy_forbidden");
  }, 60_000);
});
