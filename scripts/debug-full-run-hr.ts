import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const teamCode = process.env.OLY_DEBUG_TEAM ?? "H-R";
  const steps = Number(process.env.OLY_DEBUG_STEPS ?? "10");
  const reuseSaveId = process.env.OLY_DEBUG_SAVE_ID ?? null;

  let saveId: string;
  let seasonId: string;
  if (reuseSaveId) {
    const existing = persistence.getSaveById(reuseSaveId);
    if (!existing) throw new Error(`Save ${reuseSaveId} not found`);
    saveId = existing.saveId;
    seasonId = existing.gameState.season.id;
    console.log(`Reusing save: ${saveId} (rosters=${existing.gameState.rosters.length})`);
  } else {
    const fresh = persistence.createFreshSeasonOneSave({ name: `Debug full run ${Date.now()}` });
    saveId = fresh.saveId;
    seasonId = fresh.gameState.season.id;
    console.log(`Fresh save: ${saveId}`);
  }
  const draftSeed = process.env.OLY_DEBUG_SEED ?? `s1-draft-fresh-audit:${saveId}`;
  console.log(`Draft seed: ${draftSeed}`);

  const preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId,
      seasonId,
      dryRun: true,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: steps,
      runMode: "season1_optimum_execute",
      draftSeed,
    },
    persistence,
  );

  console.log(`\nGate passed: ${preview.qualityGate.passed}`);
  console.log(`Blocking reasons: ${preview.blockingReasons.join(" | ") || "none"}`);

  const hr = preview.teams.find((t) => (t.teamCode ?? "").toUpperCase() === teamCode.toUpperCase());
  if (!hr) {
    console.log(`Team ${teamCode} not found in preview.`);
    return;
  }
  const active = hr.plannedPicks.filter((p) => p.status !== "blocked");
  console.log(`\n=== ${hr.teamCode} ${hr.teamName} ===`);
  console.log(`rosterBefore=${hr.rosterBefore} rosterAfter=${hr.rosterAfter} targetMin=${hr.targetRosterMin} targetOpt=${hr.targetRosterOpt} cash=${hr.cashBefore}`);
  console.log(`active planned picks: ${active.length}`);
  console.log(`team.blockingReasons: ${JSON.stringify(hr.blockingReasons)}`);
  console.log(`planner.blockingReasons: ${JSON.stringify(hr.planner?.blockingReasons)}`);
  console.log(`planner.minimumReachable: ${hr.planner?.minimumReachable}`);
  console.log(`planner.reservedCashForMinimum: ${hr.planner?.reservedCashForMinimum}`);
  console.log(`previewSummary: ${JSON.stringify(hr.previewSummary, null, 2)}`);
  console.log(`\nAll planned picks (${hr.plannedPicks.length}):`);
  for (const p of hr.plannedPicks) {
    console.log(
      `  step=${p.step} status=${p.status} lane=${p.pickLane} ${p.playerName} mv=${p.marketValue} salary=${p.salary} minReachableAfter=${p.minimumReachableAfterPick}`,
    );
  }
  console.log(`\nSnapshots:`);
  for (const s of hr.sequentialStateSnapshots ?? []) {
    console.log(
      `  step=${s.step} phase=${s.pickPhase} lane=${s.lane} roster ${s.rosterCountBefore}->${s.rosterCountAfter} cash ${s.cashBefore}->${s.cashAfter} minSlots ${s.minimumSlotsBefore}->${s.minimumSlotsAfter} minReserveBefore=${s.minimumReserveBefore} minReachableAfter=${s.minimumReachableAfterStep}`,
    );
  }
  console.log(`\nWarnings:`);
  for (const w of hr.warnings.slice(0, 40)) console.log(`  - ${w}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
