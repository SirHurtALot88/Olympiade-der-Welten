import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `diag-wl-${Date.now()}`);
  ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  const persistence = createPersistenceService();
  const created = persistence.createFreshSeasonOneSave({ name: "wl-diag" });
  await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  const save = persistence.getSaveById(created.saveId)!;
  const preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 16,
      runMode: "season1_optimum_execute",
      draftSeed: `${save.saveId}:season-1:long-run`,
    },
    persistence,
  );
  const wl = preview.teams.find((team) => team.teamCode === "W-L");
  console.log(
    JSON.stringify(
      {
        executed: preview.executed,
        globalBlockers: preview.blockingReasons.filter((reason) => reason.includes("W-L")),
        partialWarnings: preview.warnings.filter(
          (warning) => warning.includes("partial") || warning.includes("fallback") || warning.includes("W-L"),
        ),
        wl: wl
          ? {
              rosterBefore: wl.rosterBefore,
              rosterAfter: wl.rosterAfter,
              teamBlocking: wl.blockingReasons,
              teamWarnings: wl.warnings,
              planned: wl.plannedPicks.filter((pick) => pick.status !== "blocked").length,
              applied: wl.plannedPicks.filter((pick) => pick.status === "applied").length,
              picks: wl.plannedPicks.map((pick) => ({
                status: pick.status,
                name: pick.playerName,
                mv: pick.marketValue,
                minReach: pick.minimumReachableAfterPick,
              })),
              cashAfter: wl.previewSummary.cashAfterPlannedBuys,
              startingCash: wl.previewSummary.startingCash,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
