import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { isEmergencyRosterRepairEnabled } from "@/lib/ai/emergency-repair-policy";
import { isTeamOverCashSalarySoftTarget } from "@/lib/ai/ai-cash-salary-target-service";
import { teamNeedsTransferBudgetDeploy } from "@/lib/ai/ai-budget-deploy-service";
import {
  getTeamHardMinRequired,
  getTeamOptTarget,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import fs from "node:fs";
import path from "node:path";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import type { PersistenceService } from "@/lib/persistence/types";

export type PreseasonBatchPickRebuildResult = {
  appliedPicks: number;
  batchTeamIds: string[];
  topupAppliedPicks: number;
  warnings: string[];
  blockingReasons: string[];
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function rosterCount(gameState: { rosters: Array<{ teamId: string }> }, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

/**
 * S2+ preseason buy = S1 draft batch execute (season1_optimum_execute + fast batch apply).
 * Only difference from S1: starting cash is team.cash (post season-end sells), and the roster
 * is partially filled — the compare engine accounts for existing players when planning lanes.
 */
export async function runPreseasonBatchPickRebuild(input: {
  saveId: string;
  seasonId: string;
  teamIds?: string[] | null;
  persistence: PersistenceService;
  stepsPerTeam?: number;
  draftSeedSuffix?: string;
  /** Optional: write plan-vs-execute diagnostics into this directory. */
  outputDir?: string;
}): Promise<PreseasonBatchPickRebuildResult> {
  const save = input.persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing before preseason batch pick rebuild.");

  const candidateTeamIds =
    input.teamIds && input.teamIds.length > 0
      ? unique(input.teamIds)
      : save.gameState.teams.map((team) => team.teamId);

  const batchTeamIds = candidateTeamIds.filter((teamId) => {
    const roster = rosterCount(save.gameState, teamId);
    const optTarget = getTeamOptTarget(save.gameState, teamId);
    if (roster < optTarget) return true;

    const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
    const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === teamId);
    const { playerMax } = deriveRosterTargets(team, identity);
    if (roster >= playerMax) return false;

    return (
      isTeamOverCashSalarySoftTarget(save.gameState, teamId, input.seasonId) ||
      teamNeedsTransferBudgetDeploy(save.gameState, teamId, input.seasonId)
    );
  });

  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  if (batchTeamIds.length === 0) {
    return { appliedPicks: 0, batchTeamIds: [], topupAppliedPicks: 0, warnings, blockingReasons };
  }

  const stepsPerTeam = Math.max(1, Math.min(Math.round(input.stepsPerTeam ?? 16), 20));
  const draftSeed =
    input.draftSeedSuffix != null
      ? `${input.saveId}:${input.seasonId}:${input.draftSeedSuffix}`
      : `${input.saveId}:${input.seasonId}:preseason-batch`;

  const result = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: input.saveId,
      seasonId: input.seasonId,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      teamIds: batchTeamIds,
      stepsPerTeam,
      runMode: "season1_optimum_execute",
      draftSeed,
    },
    input.persistence,
  );

  warnings.push(...result.warnings.slice(0, 12));
  blockingReasons.push(...result.blockingReasons.slice(0, 12));
  for (const team of result.teams) {
    if (team.blockingReasons.length > 0) {
      blockingReasons.push(`preseason_batch_team:${team.teamCode}:${team.blockingReasons.join(",")}`);
    }
  }

  let topupAppliedPicks = 0;
  const skipRepairTopup = !isEmergencyRosterRepairEnabled();
  const maxTopupPasses = skipRepairTopup ? 0 : 3;
  for (let pass = 0; pass < maxTopupPasses; pass += 1) {
    const latest = input.persistence.getSaveById(input.saveId);
    if (!latest) break;
    const belowMin = batchTeamIds.filter(
      (teamId) => rosterCount(latest.gameState, teamId) < getTeamHardMinRequired(latest.gameState, teamId),
    );
    if (belowMin.length === 0) break;

    const topup = runChunkedRedraftTopup({
      persistence: input.persistence,
      saveId: input.saveId,
      seasonId: input.seasonId,
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "preseason_roster_repair",
      target: "playerMin",
      targetTeamIds: belowMin,
      roundLimit: 8,
      teamTimeLimitMs: 30_000,
      watchdogMs: 60_000,
    });
    topupAppliedPicks += topup.picks.length;
    warnings.push(...topup.warnings.slice(0, 6));
    if (topup.picks.length === 0) break;
  }

  // Mandatory min-fill safety net (independent of OLY_ENABLE_EMERGENCY_REPAIR).
  for (let pass = 0; pass < 4; pass += 1) {
    const latest = input.persistence.getSaveById(input.saveId);
    if (!latest) break;
    const belowMin = latest.gameState.teams
      .map((team) => team.teamId)
      .filter((teamId) => rosterCount(latest.gameState, teamId) < getTeamHardMinRequired(latest.gameState, teamId));
    if (belowMin.length === 0) break;

    const minFill = runChunkedRedraftTopup({
      persistence: input.persistence,
      saveId: input.saveId,
      seasonId: input.seasonId,
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "preseason_roster_repair",
      target: "playerMin",
      targetTeamIds: belowMin,
      roundLimit: 6,
      teamTimeLimitMs: 25_000,
      watchdogMs: 45_000,
    });
    topupAppliedPicks += minFill.picks.length;
    warnings.push(...minFill.warnings.slice(0, 4));
    if (minFill.picks.length === 0) break;
  }

  if (input.outputDir) {
    try {
      const outPath = path.join(input.outputDir, `preseason-batch-plan-vs-execute-${input.seasonId}.json`);
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          {
            seasonId: input.seasonId,
            generatedAt: new Date().toISOString(),
            teamCount: result.teams.length,
            globalPreview: result.globalPreview,
            globalExecution: result.globalExecution,
            teams: result.teams.map((team) => ({
              teamId: team.teamId,
              teamCode: team.teamCode,
              rosterBefore: team.rosterBefore,
              rosterAfter: team.rosterAfter,
              cashBefore: team.cashBefore,
              cashAfter: team.cashAfter,
              planner: team.planner,
              cashStrategy: team.cashStrategy,
              budgetLanes: team.budgetLanes,
              plannedPicks: team.plannedPicks,
              warnings: team.warnings,
              blockingReasons: team.blockingReasons,
            })),
          },
          null,
          2,
        ),
      );
      warnings.push(`preseason_batch_diag_written:${path.basename(outPath)}`);
    } catch {
      warnings.push("preseason_batch_diag_write_failed");
    }
  }

  return {
    appliedPicks: result.globalExecution.appliedPickCount,
    batchTeamIds,
    topupAppliedPicks,
    warnings,
    blockingReasons,
  };
}
