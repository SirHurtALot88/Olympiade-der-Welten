import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";
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
    const fresh = persistence.createFreshSeasonOneSave({ name: `Debug ${teamCode} draft ${Date.now()}` });
    saveId = fresh.saveId;
    seasonId = fresh.gameState.season.id;
    console.log(`Fresh save: ${saveId}`);
  }
  const draftSeed = process.env.OLY_DEBUG_SEED ?? `debug-${teamCode}:${saveId}`;
  console.log(`Draft seed: ${draftSeed}`);

  const result = await buildAiNeedsPicksCompare({
    source: "sqlite",
    saveId,
    seasonId,
    teamId: teamCode,
    teamScope: "all",
    steps,
    runMode: "season1_optimum_execute",
    draftSeed,
  });

  const team = result.teams[0];
  if (!team) {
    console.log("No team entry produced.");
    return;
  }

  console.log(`\n=== ${team.teamCode} ${team.teamName} ===`);
  console.log(`Roster state:`, JSON.stringify(team.currentRosterState, null, 2));
  console.log(`Planner blockingReasons:`, team.planner.blockingReasons);
  console.log(`Planner minimumReachable:`, team.planner.minimumReachable);
  console.log(`reservedCashForMinimum:`, team.planner.reservedCashForMinimum);
  console.log(`minimumFeasibility:`, JSON.stringify(team.minimumFeasibility, null, 2));
  console.log(`compareStatus:`, team.compareStatus);
  console.log(`candidatePoolTop count:`, team.candidatePoolTop?.length ?? 0);
  console.log(`\nPlanned picks (${team.plannedPicks.length}):`);
  for (const pick of team.plannedPicks) {
    console.log(
      `  step=${pick.step} status=${pick.status} lane=${pick.pickLane} ${pick.playerName} price=${pick.marketValue} salary=${pick.salary} minReachableAfter=${pick.minimumReachableAfterPick} reasons=${(pick.reasons ?? []).slice(0, 3).join("; ")}`,
    );
  }
  console.log(`\nSequential snapshots:`);
  for (const snap of team.sequentialStateSnapshots ?? []) {
    console.log(
      `  step=${snap.step} phase=${snap.pickPhase} lane=${snap.lane} roster ${snap.rosterCountBefore}->${snap.rosterCountAfter} cash ${snap.cashBefore}->${snap.cashAfter} minSlots ${snap.minimumSlotsBefore}->${snap.minimumSlotsAfter} minReserveBefore=${snap.minimumReserveBefore} minReachableAfter=${snap.minimumReachableAfterStep}`,
    );
  }
  console.log(`\nWarnings (${team.warnings.length}):`);
  for (const w of team.warnings.slice(0, 40)) console.log(`  - ${w}`);

  // Cheapest legal candidates that exist in pool
  const cheapest = (team.candidatePoolTop ?? [])
    .map((c) => ({ name: c.playerName, price: c.price ?? c.marketValue ?? null, finalScore: c.finalScore }))
    .filter((c) => c.price != null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    .slice(0, 15);
  console.log(`\nCheapest candidates in pool:`);
  for (const c of cheapest) console.log(`  - ${c.name} price=${c.price} score=${c.finalScore}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
