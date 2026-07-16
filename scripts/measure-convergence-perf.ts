import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { readPersistPerfStats } from "@/lib/persistence/save-repository";
import { getTeamsNeedingConvergence } from "@/lib/ai/ai-market-plan-convergence-service";
import { snapshotTransferWindowProfile } from "@/lib/ai/transfer-window-profiler";

async function main() {
  const saveId = process.env.MEASURE_SAVE_ID ?? "fresh-season-1-1783097218467";
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`save ${saveId} not found`);
  const seasonId = save.gameState.season.id;
  const needing = getTeamsNeedingConvergence(save.gameState);
  console.error(
    `[measure] save=${saveId} season=${seasonId} teamsNeedingConvergence=${needing.length} defer=${process.env.OLY_TW_DEFER_FLUSH !== "0"}`,
  );

  const t0 = Date.now();
  const result = await runTransferWindowSession({
    saveId,
    seasonId,
    persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: 2,
    maxLeagueRounds: 1,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  });
  const elapsedMs = Date.now() - t0;
  const stats = readPersistPerfStats();
  console.error(
    `[measure] DONE elapsedMs=${elapsedMs} (${(elapsedMs / 1000).toFixed(1)}s) appliedBuys=${result.appliedBuys} appliedSells=${result.appliedSells} teamCycles=${result.teamCycles} rounds=${result.leagueRounds}`,
  );
  console.error(
    `[measure] persist writes=${stats?.writes ?? 0} writeMs=${stats?.writeMs ?? 0} readMiss=${stats?.readMiss ?? 0} readMissMs=${stats?.readMissMs ?? 0} readHit=${stats?.readHit ?? 0}`,
  );
  const profile = snapshotTransferWindowProfile();
  if (profile.enabled) {
    console.error(
      `[measure] profile buyPreview=${profile.buyPreviewCalls}calls/${profile.buyPreviewMs}ms sellPreview=${profile.sellPreviewCalls}calls/${profile.sellPreviewMs}ms freeAgentBuilds=${profile.freeAgentFeedBuilds}/${profile.freeAgentFeedBuildMs}ms freeAgentHits=${profile.freeAgentFeedHits}`,
    );
    const stages = Object.entries(profile.stageMs).sort((a, b) => b[1] - a[1]);
    for (const [name, ms] of stages) {
      console.error(`[measure]   stage ${name} = ${Math.round(ms)}ms`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
