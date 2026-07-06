import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import {
  getTeamHardMinRequired,
  getTeamOptTarget,
  getTeamsNeedingConvergence,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
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
}): Promise<PreseasonBatchPickRebuildResult> {
  const save = input.persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing before preseason batch pick rebuild.");

  const scoped =
    input.teamIds && input.teamIds.length > 0
      ? unique(input.teamIds)
      : getTeamsNeedingConvergence(save.gameState).map((entry) => entry.teamId);

  const batchTeamIds = scoped.filter((teamId) => {
    const roster = rosterCount(save.gameState, teamId);
    const optTarget = getTeamOptTarget(save.gameState, teamId);
    return roster < optTarget;
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
  const maxTopupPasses = 3;
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

  return {
    appliedPicks: result.globalExecution.appliedPickCount,
    batchTeamIds,
    topupAppliedPicks,
    warnings,
    blockingReasons,
  };
}
