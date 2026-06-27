import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { getTeamHardMinRequired, getTeamOptTarget, getTeamsBelowHardMin, getTeamsNeedingConvergence, runEmergencyRosterRepairForTeams, runMarketPlanConvergence } from "@/lib/ai/ai-market-plan-convergence-service";
import { bootstrapSaveToSeasonStart } from "@/lib/debug/bootstrap-save-to-season-start";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function log(message: string) {
  console.error(`[debug-planner-convergence] ${message}`);
}

function resolveTeamIds(gameState: { teams: Array<{ teamId: string; shortCode: string }> }, codes: string[]) {
  const normalized = codes.map((entry) => entry.trim().toUpperCase()).filter(Boolean);
  return normalized.map((code) => {
    const team = gameState.teams.find((entry) => entry.shortCode.toUpperCase() === code);
    if (!team) throw new Error(`Unknown team short code: ${code}`);
    return team.teamId;
  });
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const cloneFrom = argValue("--clone-from");
  const saveIdArg = argValue("--save-id");
  const teamCodes = (argValue("--teams") ?? "D-P,N-N,S-C,B-P,W-L").split(",");
  const passes = Number(argValue("--passes") ?? "2");
  const rounds = Number(argValue("--rounds") ?? "4");
  const allowEmergency = argValue("--allow-emergency") === "true";
  const advanceTo = argValue("--advance-to");

  const persistence = createPersistenceService();
  let saveId = saveIdArg;
  if (!saveId && cloneFrom) {
    const clone = persistence.cloneSave(cloneFrom, `Debug Planner Convergence ${Date.now()}`);
    saveId = clone.saveId;
    log(`Cloned ${cloneFrom} → ${saveId}`);
  }
  if (!saveId) {
    throw new Error("Provide --save-id or --clone-from SAVE_ID");
  }

  let bootstrap: Awaited<ReturnType<typeof bootstrapSaveToSeasonStart>> | null = null;
  if (advanceTo) {
    log(`Bootstrapping save to ${advanceTo}…`);
    bootstrap = await bootstrapSaveToSeasonStart({
      saveId,
      targetSeasonId: advanceTo,
      persistence,
      ensureAllTeamsAi: true,
      progressLog: true,
    });
    if (!bootstrap.ok) {
      throw new Error(`Bootstrap failed: ${bootstrap.blockers.join(" | ")}`);
    }
    log(
      `Bootstrap done: ${bootstrap.fromSeasonId} → ${bootstrap.toSeasonId} · ${bootstrap.matchdaysCompleted} MDs · ${bootstrap.seasonsAdvanced} season(s)`,
    );
  }

  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const seasonId = save.gameState.season.id;
  const targetTeamIds = resolveTeamIds(save.gameState, teamCodes);

  const outputDir = path.join(PROJECT_ROOT, "outputs", "debug-planner-convergence", `${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const beforeRows = targetTeamIds.map((teamId) => {
    const team = save.gameState.teams.find((entry) => entry.teamId === teamId)!;
    const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    const hardMin = getTeamHardMinRequired(save.gameState, teamId);
    const optTarget = getTeamOptTarget(save.gameState, teamId);
    const doctrineStrategy = buildSeasonStrategyState(save.gameState)[teamId]?.seasonStrategy ?? "balanced_growth";
    return {
      teamId,
      shortCode: team.shortCode,
      rosterCount,
      hardMin,
      optTarget,
      doctrineStrategy,
      cash: team.cash,
    };
  });

  log(`Save ${saveId} · season ${seasonId} · teams ${beforeRows.map((row) => row.shortCode).join(", ")}`);
  for (const row of beforeRows) {
    log(`  before ${row.shortCode}: roster ${row.rosterCount}/${row.optTarget} (min ${row.hardMin}) · ${row.doctrineStrategy} · cash ${row.cash.toFixed(1)}`);
  }

  const convergence = await runMarketPlanConvergence({
    saveId,
    seasonId,
    persistence,
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    targetTeamIds,
    maxPasses: passes,
    maxRoundsPerPass: rounds,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });

  const afterSave = persistence.getSaveById(saveId);
  if (!afterSave) throw new Error("Save missing after convergence");

  const afterRows = targetTeamIds.map((teamId) => {
    const team = afterSave.gameState.teams.find((entry) => entry.teamId === teamId)!;
    const rosterCount = afterSave.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    const teamResult = convergence.perTeam.find((entry) => entry.teamId === teamId);
    const hardMin = getTeamHardMinRequired(afterSave.gameState, teamId);
    const optTarget = getTeamOptTarget(afterSave.gameState, teamId);
    return {
      teamId,
      shortCode: team.shortCode,
      rosterCount,
      hardMin,
      optTarget,
      cash: team.cash,
      status: teamResult?.status ?? "unknown",
      doctrineStrategy: teamResult?.doctrineStrategy ?? buildSeasonStrategyState(afterSave.gameState)[teamId]?.seasonStrategy,
      appliedBuys: teamResult?.appliedBuys ?? 0,
      appliedSells: teamResult?.appliedSells ?? 0,
      blockingReasons: teamResult?.blockingReasons ?? [],
      warnings: teamResult?.warnings ?? [],
    };
  });

  let emergency: Awaited<ReturnType<typeof runEmergencyRosterRepairForTeams>> | null = null;
  if (allowEmergency && convergence.emergencyRepairTeams.length > 0) {
    log(`Emergency repair for ${convergence.emergencyRepairTeams.length} team(s)`);
    emergency = runEmergencyRosterRepairForTeams({
      saveId,
      seasonId,
      teamIds: convergence.emergencyRepairTeams,
      persistence,
      outputDir,
    });
  }

  const finalSave = persistence.getSaveById(saveId)!;
  const finalRows = targetTeamIds.map((teamId) => {
    const team = finalSave.gameState.teams.find((entry) => entry.teamId === teamId)!;
    const rosterCount = finalSave.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    const hardMin = getTeamHardMinRequired(finalSave.gameState, teamId);
    const optTarget = getTeamOptTarget(finalSave.gameState, teamId);
    return {
      shortCode: team.shortCode,
      rosterCount,
      hardMin,
      optTarget,
      cash: team.cash,
      ok: rosterCount >= hardMin,
      atOpt: rosterCount >= optTarget,
    };
  });

  const report = {
    saveId,
    seasonId,
    bootstrap,
    targetTeamIds,
    passes: convergence.passes,
    rounds: convergence.rounds,
    appliedBuys: convergence.appliedBuys,
    appliedSells: convergence.appliedSells,
    beforeRows,
    afterRows,
    finalRows,
    emergencyRepairTeams: convergence.emergencyRepairTeams,
    emergency,
    roundHistory: convergence.roundHistory,
    warnings: convergence.warnings,
    blockingReasons: convergence.blockingReasons,
    leagueBelowHardMinAfter: getTeamsBelowHardMin(finalSave.gameState).length,
    leagueNeedingConvergenceAfter: getTeamsNeedingConvergence(finalSave.gameState).length,
  };

  const reportPath = path.join(outputDir, "debug-planner-convergence-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\n=== DEBUG PLANNER CONVERGENCE ===");
  console.log(`saveId: ${saveId}`);
  console.log(`season: ${seasonId}${isSeasonOne(seasonId) ? " (S1: buys disabled by policy)" : ""}`);
  console.log(`rounds: ${convergence.rounds} · passes: ${convergence.passes} · buys: ${convergence.appliedBuys} · sells: ${convergence.appliedSells}`);
  for (const row of finalRows) {
    console.log(`${row.shortCode}: ${row.rosterCount}/${row.optTarget} (min ${row.hardMin}) · ${row.atOpt ? "AT OPT" : row.ok ? "OK" : "BELOW MIN"} · cash ${row.cash.toFixed(1)}`);
  }
  console.log(`emergency teams: ${convergence.emergencyRepairTeams.length}`);
  console.log(`report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
