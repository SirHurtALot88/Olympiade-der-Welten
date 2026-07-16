/**
 * Targeted regression probe for PRIO 3 / Req C: "Pick-Engine muss unabhängig vom Startzustand
 * gleich gut funktionieren." Takes a real, freshly-drafted save and artificially creates two
 * synthetic starting states for two different teams:
 *
 *   - Team A: sold down to 0 players, high cash (like a full sell-off before a rebuild).
 *   - Team B: sold down to 6 players (below hardMin=7), low cash.
 *
 * Then runs the SAME convergence engine (`runTransferWindowSession`, preseason phase) scoped to
 * just those two teams and reports whether both reliably converge towards hardMin/Opt — this is
 * the direct evidence for/against "one engine that works regardless of starting state".
 *
 * Usage:
 *   OLY_APP_SQLITE_PATH=/tmp/oly-bench/draft.sqlite node --import tsx \
 *     scripts/test-rebuild-convergence.ts --save-id <id> --team-a-id <id> --team-b-id <id>
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { getTeamHardMinRequired, getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Missing --save-id");
  const explicitTeamA = argValue("--team-a-id");
  const explicitTeamB = argValue("--team-b-id");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;
  const seasonId = gs.season.id;

  const teamAId = explicitTeamA ?? gs.teams[0].teamId;
  const teamBId = explicitTeamB ?? gs.teams[1].teamId;
  if (teamAId === teamBId) throw new Error("team-a and team-b must differ");

  const teamACode = gs.teams.find((t) => t.teamId === teamAId)?.shortCode ?? teamAId;
  const teamBCode = gs.teams.find((t) => t.teamId === teamBId)?.shortCode ?? teamBId;

  const rosterA = gs.rosters.filter((entry) => entry.teamId === teamAId);
  const rosterB = gs.rosters.filter((entry) => entry.teamId === teamBId);
  console.error(`[rebuild-test] Team A (${teamACode}): vorher roster=${rosterA.length}`);
  console.error(`[rebuild-test] Team B (${teamBCode}): vorher roster=${rosterB.length}`);

  // Team A: sell every player (roster -> 0), give it a generous cash pile (like a full
  // sell-off before a rebuild). Team B: keep only the first 6 roster entries (below hardMin=7),
  // and set cash low (like a team that spent most of its budget already).
  const keepForB = new Set(rosterB.slice(0, 6).map((entry) => entry.id));

  const nextRosters = gs.rosters.filter((entry) => {
    if (entry.teamId === teamAId) return false; // Team A -> 0 players
    if (entry.teamId === teamBId) return keepForB.has(entry.id); // Team B -> 6 players
    return true;
  });

  const nextTeams = gs.teams.map((team) => {
    if (team.teamId === teamAId) return { ...team, cash: 300 };
    if (team.teamId === teamBId) return { ...team, cash: 18 };
    return team;
  });

  const syntheticSaveId = `${saveId}-rebuild-probe`;
  persistence.saveSingleplayerState(syntheticSaveId, {
    ...gs,
    rosters: nextRosters,
    teams: nextTeams,
  });

  const hardMinA = getTeamHardMinRequired(gs, teamAId);
  const optA = getTeamOptTarget(gs, teamAId);
  const hardMinB = getTeamHardMinRequired(gs, teamBId);
  const optB = getTeamOptTarget(gs, teamBId);
  console.error(
    `[rebuild-test] Synthetic Ausgangslage: A=${teamACode} roster=0 cash=300 (hardMin=${hardMinA},Opt=${optA}) | B=${teamBCode} roster=6 cash=18 (hardMin=${hardMinB},Opt=${optB})`,
  );

  const t0 = Date.now();
  const result = await runTransferWindowSession({
    saveId: syntheticSaveId,
    seasonId,
    persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    targetTeamIds: [teamAId, teamBId],
    maxTeamCycles: 5,
    maxLeagueRounds: 3,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  const elapsedMs = Date.now() - t0;

  const after = persistence.getSaveById(syntheticSaveId);
  if (!after) throw new Error("Synthetic save disappeared");
  const rosterAfterA = after.gameState.rosters.filter((entry) => entry.teamId === teamAId).length;
  const rosterAfterB = after.gameState.rosters.filter((entry) => entry.teamId === teamBId).length;
  const cashAfterA = after.gameState.teams.find((t) => t.teamId === teamAId)?.cash ?? null;
  const cashAfterB = after.gameState.teams.find((t) => t.teamId === teamBId)?.cash ?? null;

  console.error(`[rebuild-test] DONE elapsedMs=${elapsedMs} appliedBuys=${result.appliedBuys} appliedSells=${result.appliedSells} warnings=${result.warnings.join("|")}`);
  console.error(
    `[rebuild-test] RESULT A=${teamACode}: roster 0 -> ${rosterAfterA} (hardMin=${hardMinA}, Opt=${optA}) cash 300 -> ${cashAfterA} => ${rosterAfterA >= hardMinA ? (rosterAfterA >= optA ? "OPT_REACHED" : "HARDMIN_OK") : "STILL_BELOW_HARDMIN"}`,
  );
  console.error(
    `[rebuild-test] RESULT B=${teamBCode}: roster 6 -> ${rosterAfterB} (hardMin=${hardMinB}, Opt=${optB}) cash 18 -> ${cashAfterB} => ${rosterAfterB >= hardMinB ? (rosterAfterB >= optB ? "OPT_REACHED" : "HARDMIN_OK") : "STILL_BELOW_HARDMIN"}`,
  );
  for (const team of result.perTeam) {
    console.error(`[rebuild-test] perTeam ${team.teamId} status=${team.status} buys=${team.appliedBuys} sells=${team.appliedSells} blockers=${team.blockingReasons.join("|")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
