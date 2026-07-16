/**
 * Reproduce MD10 -> S1 sell -> S2 transition -> cash recovery, then inspect B-P's
 * buildAiMarketPlanPreview / applyAiMarketPlanLocally output BEFORE any buy cycle runs, to see
 * why it gets 0 buys live even though planUnifiedTeamPicks in isolation finds valid candidates.
 */
import path from "node:path";
import Database from "better-sqlite3";
import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applySeasonEndRosterStressLedger } from "@/lib/ai/season-roster-stress-service";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { getLongRunPlannerMaxLeagueRounds, getLongRunPlannerMaxTeamCycles } from "@/lib/season/long-run-profile";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { buildAiMarketPlanPreview } from "@/lib/ai/ai-market-plan-preview-service";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { getTeamHardMinRequired, getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";

import { PROJECT_ROOT, applyQuickSimSeasonEndStack, cloneSourceDatabase, collectTeamRows, log, setAllTeamsAi } from "./s1-s2-transfer-shared";

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const baselineDb = path.join(PROJECT_ROOT, "outputs/s1-sell-batch-md10-2026-07-06T12-25-36/baseline-md10.sqlite");
  const outputDir = path.join(PROJECT_ROOT, "outputs/tmp-bp-pre-buy-check");
  cloneSourceDatabase(baselineDb, outputDir);

  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const persistence = createPersistenceService();
  const saveIdRow = (() => {
    const db = new Database(path.join(outputDir, "balancing-run.sqlite"), { readonly: true });
    try {
      return db.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as { save_id: string };
    } finally {
      db.close();
    }
  })();
  let save = persistence.getSaveById(saveIdRow.save_id)!;
  save = setAllTeamsAi(save, persistence);

  log("S1 season_end prep…");
  save = (await applyQuickSimSeasonEndStack(save, persistence)).save;
  const contractPreview = previewSeasonEndContracts(save);
  if (contractPreview.blockingReasons.length === 0) {
    const contractApply = applySeasonEndContractTick(save, contractPreview.confirmToken, persistence, contractPreview);
    if (contractApply.applied) save = persistence.getSaveById(save.saveId) ?? save;
  }
  save = persistence.saveSingleplayerState(
    save.saveId,
    applySeasonEndRosterStressLedger(save.gameState, save.gameState.season.id),
  );

  log("S1 season_end sell…");
  await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-1",
    persistence,
    phase: "season_end",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: false,
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  });
  save = persistence.getSaveById(save.saveId)!;

  log("Transition S1 -> S2…");
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
  if (!next.applied) throw new Error(`S2 transition blocked: ${next.blockingReasons.join(" | ")}`);
  save = persistence.getSaveById(save.saveId)!;

  log("S2 preseason cash recovery…");
  await runPreseasonProactiveCashRecovery({ saveId: save.saveId, seasonId: "season-2", persistence });
  save = persistence.getSaveById(save.saveId)!;

  const bp = save.gameState.teams.find((t) => t.shortCode === "B-P")!;
  const roster = save.gameState.rosters.filter((r) => r.teamId === bp.teamId);
  console.log(`\n=== B-P state right before S2 buy cycles: roster=${roster.length} hardMin=${getTeamHardMinRequired(save.gameState, bp.teamId)} opt=${getTeamOptTarget(save.gameState, bp.teamId)} cash=${bp.cash} ===`);

  console.log("\n--- buildAiMarketPlanPreview (teamId=B-P) ---");
  const preview = await buildAiMarketPlanPreview({
    source: "sqlite",
    saveId: save.saveId,
    seasonId: "season-2",
    teamId: bp.teamId,
  });
  const bpTeam = preview.teams.find((t) => t.teamId === bp.teamId);
  console.log(`status=${bpTeam?.status} buyPlan.candidates=${bpTeam?.buyPlan.candidates.length} warnings=${JSON.stringify(bpTeam?.warnings)} blockingReasons=${JSON.stringify(bpTeam?.blockingReasons)}`);
  console.log(`buyPlan.warnings=${JSON.stringify(bpTeam?.buyPlan.warnings)}`);

  console.log("\n--- applyAiMarketPlanLocally (forceBuyScanTeamIds=[B-P], dryRun) ---");
  const apply = await applyAiMarketPlanLocally({
    source: "sqlite",
    saveId: save.saveId,
    seasonId: "season-2",
    teamId: bp.teamId,
    teamScope: "all",
    dryRun: true,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    persistence,
    options: {
      includeWarningTeams: true,
      applySellSteps: false,
      applyBuySteps: true,
      maxBuysPerTeam: null,
      applyBuyStepsInBatch: 2,
      previewBuyLimit: 112,
      previewSellLimit: 4,
      forceBuyScanTeamIds: [bp.teamId],
      progressLog: false,
      stopOnTeamFailure: false,
      returnGateRows: true,
      excludeBuyPlayerIds: [],
      convergenceIncrementalFill: true,
      transferWindowCycleMode: true,
    },
  });
  console.log(`appliedBuys=${apply?.summary?.appliedBuys} warnings=${JSON.stringify(apply?.warnings)}`);
  console.log(`buyGateRows=${JSON.stringify(apply?.buyGateRows?.slice(0, 10), null, 2)}`);
  const bpApplyTeam = apply?.teams.find((t) => t.teamId === bp.teamId);
  console.log(`team result=${bpApplyTeam?.result} plannedBuyDetails=${JSON.stringify(bpApplyTeam?.plannedBuyDetails?.slice(0, 10), null, 2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
