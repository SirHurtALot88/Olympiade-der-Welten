/**
 * Isolated check: MD10 baseline -> S1 season_end sell -> S2 preseason buy, with the S2 buy
 * planner now running in "season1_optimum_execute" mode (same engine as the S1 draft). Prints
 * before/after roster + cash + pick-composition stats and flags any insufficient_cash warnings.
 *
 * Usage: npx tsx scripts/tmp-s2-unified-mode-check.ts
 */
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applySeasonEndRosterStressLedger } from "@/lib/ai/season-roster-stress-service";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { getLongRunPlannerMaxLeagueRounds, getLongRunPlannerMaxTeamCycles } from "@/lib/season/long-run-profile";

import {
  PROJECT_ROOT,
  applyQuickSimSeasonEndStack,
  cloneSourceDatabase,
  collectTeamRows,
  log,
  round,
  setAllTeamsAi,
} from "./s1-s2-transfer-shared";

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const baselineDb = path.join(PROJECT_ROOT, "outputs/s1-sell-batch-md10-2026-07-06T12-25-36/baseline-md10.sqlite");
  const outputDir = path.join(PROJECT_ROOT, "outputs/tmp-s2-unified-mode-check");
  cloneSourceDatabase(baselineDb, outputDir);

  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const persistence = createPersistenceService();
  const saveIdRow = (() => {
    const Database = require("better-sqlite3");
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
  const s1Sell = await runTransferWindowSession({
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
    progressLog: true,
  });
  save = persistence.getSaveById(save.saveId)!;
  const afterSellRows = collectTeamRows(save.gameState);
  console.log(
    `\n=== S1 sell done: ${s1Sell.appliedSells} sells | belowMin=${afterSellRows.filter((r) => !r.atMin).length}/${afterSellRows.length} | avgCash=${round(afterSellRows.reduce((s, r) => s + r.cash, 0) / afterSellRows.length)} ===`,
  );

  log("Transition S1 -> S2…");
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
  if (!next.applied) throw new Error(`S2 transition blocked: ${next.blockingReasons.join(" | ")}`);
  save = persistence.getSaveById(save.saveId)!;

  log("S2 preseason cash recovery…");
  await runPreseasonProactiveCashRecovery({ saveId: save.saveId, seasonId: "season-2", persistence });

  log("S2 preseason buy (now season1_optimum_execute mode)…");
  const s2Buy = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-2",
    persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  save = persistence.getSaveById(save.saveId)!;
  const afterBuyRows = collectTeamRows(save.gameState);

  console.log(
    `\n=== S2 preseason buy done: buys=${s2Buy.appliedBuys} sells=${s2Buy.appliedSells} | atMin=${afterBuyRows.filter((r) => r.atMin).length}/${afterBuyRows.length} | atOpt=${afterBuyRows.filter((r) => r.atOpt).length}/${afterBuyRows.length} | avgCash=${round(afterBuyRows.reduce((s, r) => s + r.cash, 0) / afterBuyRows.length)} ===`,
  );

  const insufficientCashWarnings = s2Buy.warnings.filter((w) => w.toLowerCase().includes("insufficient_cash"));
  console.log(`insufficient_cash warnings: ${insufficientCashWarnings.length}`);
  if (insufficientCashWarnings.length > 0) {
    console.log(insufficientCashWarnings.slice(0, 10));
  }
  console.log(`other warnings (first 15): ${JSON.stringify(s2Buy.warnings.filter((w) => !w.toLowerCase().includes("insufficient_cash")).slice(0, 15), null, 2)}`);

  const belowMinAfter = afterBuyRows.filter((r) => !r.atMin).map((r) => `${r.teamCode}:${r.roster}/${r.playerMin}`);
  console.log(`still below min after S2 preseason: ${belowMinAfter.length} -> ${JSON.stringify(belowMinAfter)}`);

  // Buy composition: check star/superstar counts among the newly bought transfer-history entries.
  const boughtPlayerIds = save.gameState.transferHistory
    .filter((entry) => entry.seasonId === "season-2" && entry.transferType === "buy")
    .map((entry) => entry.playerId);
  const playerById = new Map(save.gameState.players.map((p) => [p.id, p]));
  const roleCounts = new Map<string, number>();
  for (const playerId of boughtPlayerIds) {
    const player = playerById.get(playerId);
    const role = (player as { role?: string } | undefined)?.role ?? "unknown";
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }
  console.log(`S2 buy composition by role: ${JSON.stringify(Object.fromEntries(roleCounts))}`);

  closeDatabaseForMaintenance();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
