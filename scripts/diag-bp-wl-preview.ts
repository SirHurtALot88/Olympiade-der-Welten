/**
 * Dry-run S1 preview focused on B-P / W-L quality-gate and cash-strategy diagnostics.
 */
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FOCUS = new Set(["B-P", "W-L"]);
const CASH_BONUS = Number(process.argv[2] ?? "50") || 0;

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `diag-bp-wl-${Date.now()}`);
  const isolation = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  const persistence = createPersistenceService();

  const created = persistence.createFreshSeasonOneSave({ name: `diag B-P W-L ${new Date().toISOString()}` });
  await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });

  let save = persistence.getSaveById(created.saveId) ?? created;
  if (CASH_BONUS > 0) {
    save = persistence.saveSingleplayerState(save.saveId, {
      ...save.gameState,
      teams: save.gameState.teams.map((team) => {
        const cash = Number((team.cash ?? 0) + CASH_BONUS);
        const budget = Number((team.budget ?? 0) + CASH_BONUS);
        return { ...team, cash, budget };
      }),
    });
  }

  const preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      dryRun: true,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 16,
      runMode: "season1_optimum_execute",
      draftSeed: `${save.saveId}:diag`,
    },
    persistence,
  );

  console.log(JSON.stringify({
    cashBonus: CASH_BONUS,
    executed: preview.executed,
    globalBlockers: preview.blockingReasons.filter((r) => FOCUS.has(r.split(":")[1] ?? "") || r.includes("B-P") || r.includes("W-L")),
    allGlobalBlockers: preview.blockingReasons,
    partialWarnings: preview.warnings.filter((w) => w.includes("partial")),
    teams: preview.teams
      .filter((t) => FOCUS.has(t.teamCode))
      .map((t) => ({
        teamCode: t.teamCode,
        rosterBefore: t.rosterBefore,
        rosterAfter: t.rosterAfter,
        plannedRoster: t.previewSummary.plannedRosterCount,
        startingCash: t.previewSummary.startingCash,
        plannedSpend: t.previewSummary.plannedSpendTotal,
        cashAfter: t.previewSummary.cashAfterPlannedBuys,
        spendMinPct: t.cashStrategy?.season1SpendMinPct,
        spendTargetPct: t.cashStrategy?.season1SpendTargetPct,
        targetCashLeft: t.cashStrategy?.season1TargetCashLeft,
        targetRosterSize: t.targetRosterSize,
        playerOpt: t.targetRosterOpt,
        blockingReasons: t.blockingReasons,
        warnings: t.warnings.filter((w) =>
          w.includes("spend") ||
          w.includes("quality_floor") ||
          w.includes("opt") ||
          w.includes("reserve") ||
          w.includes("partial"),
        ),
        plannedPickCount: t.plannedPicks.filter((p) => p.status !== "blocked").length,
        blockedPickCount: t.plannedPicks.filter((p) => p.status === "blocked").length,
        lastPicks: t.plannedPicks.slice(-3).map((p) => ({
          playerId: p.playerId,
          price: p.marketValue,
          status: p.status,
          lane: p.pickLane,
          cashAfter: p.expectedCashAfter,
        })),
      })),
  }, null, 2));

  console.error(`isolated db: ${isolation.sqlitePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
