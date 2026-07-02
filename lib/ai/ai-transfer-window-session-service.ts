import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import {
  getTeamHardMinRequired,
  getTeamOptTarget,
  getTeamsBelowHardMin,
  getTeamsNeedingConvergence,
  resolveTeamStatus,
  teamNeedsMarketConvergence,
  type ConvergenceTeamResult,
  type MarketPlanConvergenceResult,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { createLocalTransfermarktRunContext, type LocalTransfermarktRunContext } from "@/lib/market/transfermarkt-local-service";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { LocalTransferWindowPhase } from "@/lib/market/transfer-window-policy";

export type TransferWindowPhase = "preseason" | "season_end";

export type TransferWindowSessionInput = {
  saveId: string;
  seasonId: string;
  persistence?: PersistenceService;
  phase: TransferWindowPhase;
  dryRun?: boolean;
  confirmToken?: string | null;
  transferPhase?: LocalTransferWindowPhase | string;
  teamScope?: "ai" | "all";
  targetTeamIds?: string[];
  maxTeamCycles?: number;
  maxLeagueRounds?: number;
  allowBuys?: boolean;
  skipIfExistingMarketTransfers?: boolean;
  progressLog?: boolean;
};

export type TransferWindowSessionResult = MarketPlanConvergenceResult & {
  phase: TransferWindowPhase;
  leagueRounds: number;
  teamCycles: number;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getExistingMarketTransfers(
  gameState: { transferHistory: Array<{ seasonId?: string | null; source?: string | null }> },
  seasonId: string,
) {
  return gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      (entry.source === "ai_preseason_market_buy" ||
        entry.source === "ai_preseason_market_sell" ||
        entry.source === "manual_transfer_window"),
  );
}

function rosterCount(gameState: { rosters: Array<{ teamId: string }> }, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

function rosterCountsByTeam(gameState: GameState) {
  const counts = new Map<string, number>();
  for (const entry of gameState.rosters) {
    counts.set(entry.teamId, (counts.get(entry.teamId) ?? 0) + 1);
  }
  return counts;
}

async function runTeamCycle(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  persistence: PersistenceService;
  sessionRunContext: LocalTransfermarktRunContext | null;
  dryRun: boolean;
  confirmToken: string;
  transferPhase: string;
  teamScope: "ai" | "all";
  allowBuys: boolean;
  allowSells: boolean;
  cycleIndex: number;
  leagueRound: number;
  excludeBuyPlayerIds: Set<string>;
  excludeSellPlayerIds: Set<string>;
  progressLog: boolean;
}) {
  let appliedSells = 0;
  let appliedBuys = 0;
  const warnings: string[] = [];

  const liveSave = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
  if (!liveSave) throw new Error("Save missing before team cycle.");
  const currentRoster = rosterCount(liveSave.gameState, input.teamId);

  const canSell = input.allowSells && currentRoster > 0;
  if (canSell) {
    const sellApply = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      teamScope: input.teamScope,
      dryRun: input.dryRun,
      confirmToken: input.confirmToken,
      transferPhase: input.transferPhase,
      persistence: input.persistence,
      localRunContext: input.sessionRunContext,
      options: {
        includeWarningTeams: true,
        applySellSteps: true,
        applyBuySteps: false,
        maxSellsPerTeam: 1,
        maxBuysPerTeam: 0,
        previewSellLimit: 12,
        previewBuyLimit: 4,
        progressLog: input.progressLog,
        stopOnTeamFailure: false,
        returnGateRows: true,
        excludeSellPlayerIds: [...input.excludeSellPlayerIds],
        convergenceIncrementalFill: true,
        transferWindowCycleMode: true,
      },
    });
    if (!sellApply?.summary) {
      warnings.push("transfer_window_sell_apply_missing");
      return { appliedSells, appliedBuys, warnings };
    }
    appliedSells += sellApply.summary.appliedSells;
    warnings.push(...sellApply.warnings.slice(0, 4));
    for (const team of sellApply.teams) {
      for (const step of [...team.appliedSellDetails, ...team.plannedSellDetails]) {
        if (step.stepType === "sell") input.excludeSellPlayerIds.add(step.playerId);
      }
    }
  }

  const afterSellSave = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
  if (input.allowBuys && afterSellSave && teamNeedsMarketConvergence(afterSellSave.gameState, input.teamId)) {
    const buyApply = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      teamScope: input.teamScope,
      dryRun: input.dryRun,
      confirmToken: input.confirmToken,
      transferPhase: input.transferPhase,
      persistence: input.persistence,
      localRunContext: input.sessionRunContext,
      options: {
        includeWarningTeams: true,
        applySellSteps: false,
        applyBuySteps: true,
        maxSellsPerTeam: 0,
        maxBuysPerTeam: null,
        applyBuyStepsInBatch: input.leagueRound > 1 ? 3 : 2,
        previewBuyLimit: input.leagueRound > 1 ? 144 : 112,
        previewSellLimit: 4,
        forceBuyScanTeamIds: [input.teamId],
        progressLog: input.progressLog,
        stopOnTeamFailure: false,
        returnGateRows: true,
        excludeBuyPlayerIds: [...input.excludeBuyPlayerIds],
        convergenceIncrementalFill: true,
        transferWindowCycleMode: true,
      },
    });
    if (!buyApply?.summary) {
      warnings.push("transfer_window_buy_apply_missing");
      return { appliedSells, appliedBuys, warnings };
    }
    appliedBuys += buyApply.summary.appliedBuys;
    warnings.push(...buyApply.warnings.slice(0, 4));
    for (const row of buyApply.buyGateRows ?? []) {
      const playerId = typeof row.playerId === "string" ? row.playerId : null;
      if (playerId) input.excludeBuyPlayerIds.add(playerId);
    }
    for (const team of buyApply.teams) {
      for (const step of [...team.appliedBuyDetails, ...team.plannedBuyDetails, ...team.skippedSteps]) {
        if (step.stepType === "buy") input.excludeBuyPlayerIds.add(step.playerId);
      }
    }
  }

  if (input.progressLog && (appliedSells > 0 || appliedBuys > 0)) {
    console.error(
      `[transfer-window] ${input.seasonId} ${input.teamId} round=${input.leagueRound} cycle=${input.cycleIndex} sells=${appliedSells} buys=${appliedBuys}`,
    );
  }

  return { appliedSells, appliedBuys, warnings };
}

export async function runTransferWindowSession(input: TransferWindowSessionInput): Promise<TransferWindowSessionResult> {
  const persistence = input.persistence ?? createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing for transfer window session.");
  const sessionRunContext: LocalTransfermarktRunContext | null =
    input.dryRun === true ? null : createLocalTransfermarktRunContext({ persistence, save });

  const readLiveSave = (): PersistedSaveGame | null => sessionRunContext?.save ?? persistence.getSaveById(input.saveId);

  const maxTeamCycles = Math.max(1, input.maxTeamCycles ?? 5);
  const maxLeagueRounds = Math.max(1, input.maxLeagueRounds ?? 3);
  const allowBuys = (input.allowBuys ?? true) && !isSeasonOne(input.seasonId);
  const teamScope = input.teamScope ?? "all";
  const confirmToken = input.confirmToken ?? AI_MARKET_APPLY_CONFIRM_TOKEN;
  const transferPhase = input.transferPhase ?? "manual_transfer_window";
  const progressLog = input.progressLog ?? false;

  if (input.skipIfExistingMarketTransfers !== false && input.phase === "preseason") {
    const existing = getExistingMarketTransfers(save.gameState, input.seasonId);
    if (existing.length > 0) {
      return {
        phase: input.phase,
        leagueRounds: 0,
        teamCycles: 0,
        passes: 0,
        rounds: 0,
        perTeam: [],
        emergencyRepairTeams: [],
        appliedBuys: 0,
        appliedSells: 0,
        warnings: [`transfer_window_skipped_existing_market_transfers:${existing.length}`],
        blockingReasons: [],
        skipped: true,
        roundHistory: [],
      };
    }
  }

  const scopedTeamIds = unique(input.targetTeamIds ?? []);
  const scopeTeam = (teamIds: string[]) =>
    scopedTeamIds.length > 0 ? teamIds.filter((teamId) => scopedTeamIds.includes(teamId)) : teamIds;

  const excludeBuyPlayerIds = new Set<string>();
  const excludeSellPlayerIds = new Set<string>();
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  let totalAppliedBuys = 0;
  let totalAppliedSells = 0;
  let totalTeamCycles = 0;
  let leagueRoundsCompleted = 0;
  const perTeamMap = new Map<string, ConvergenceTeamResult>();
  const exhaustedTeamIds = new Set<string>();

  for (let leagueRound = 1; leagueRound <= maxLeagueRounds; leagueRound += 1) {
    const latestSave = readLiveSave();
    if (!latestSave) throw new Error("Save missing during transfer window.");
    const coverageRiskBefore = getTeamsNeedingConvergence(latestSave.gameState).length;
    const needing = scopeTeam(getTeamsNeedingConvergence(latestSave.gameState).map((entry) => entry.teamId));
    if (needing.length === 0) {
      leagueRoundsCompleted = leagueRound;
      break;
    }

    let roundProgress = false;
    let roundAppliedBuys = 0;
    let roundAppliedSells = 0;
    for (const teamId of needing) {
      for (let cycle = 1; cycle <= maxTeamCycles; cycle += 1) {
        const midSave = readLiveSave();
        if (!midSave || !teamNeedsMarketConvergence(midSave.gameState, teamId)) break;
        const rosterBeforeCycle = rosterCount(midSave.gameState, teamId);

        const cycleResult = await runTeamCycle({
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamId,
          persistence,
          sessionRunContext,
          dryRun: input.dryRun ?? false,
          confirmToken,
          transferPhase,
          teamScope,
          allowBuys,
          allowSells: true,
          cycleIndex: cycle,
          leagueRound,
          excludeBuyPlayerIds,
          excludeSellPlayerIds,
          progressLog,
        });
        totalTeamCycles += 1;
        totalAppliedBuys += cycleResult.appliedBuys;
        totalAppliedSells += cycleResult.appliedSells;
        roundAppliedBuys += cycleResult.appliedBuys;
        roundAppliedSells += cycleResult.appliedSells;
        warnings.push(...cycleResult.warnings);
        if (cycleResult.appliedBuys + cycleResult.appliedSells > 0) roundProgress = true;

        const afterSave = readLiveSave();
        if (!afterSave) break;
        const rosterAfter = rosterCount(afterSave.gameState, teamId);
        const effectiveRosterAfter = rosterBeforeCycle + cycleResult.appliedBuys - cycleResult.appliedSells;
        const hardMin = getTeamHardMinRequired(afterSave.gameState, teamId);
        const optTarget = getTeamOptTarget(afterSave.gameState, teamId);
        const needsConvergence = teamNeedsMarketConvergence(afterSave.gameState, teamId);
        const doctrineStrategy = buildSeasonStrategyState(afterSave.gameState)[teamId]?.seasonStrategy ?? "balanced_growth";

        if (cycleResult.appliedBuys + cycleResult.appliedSells === 0) {
          exhaustedTeamIds.add(teamId);
        } else if (effectiveRosterAfter === rosterBeforeCycle) {
          exhaustedTeamIds.add(teamId);
          warnings.push(`transfer_window_roster_stalled:${teamId}:round:${leagueRound}:cycle:${cycle}`);
        }

        const previous = perTeamMap.get(teamId);
        const status = resolveTeamStatus({
          team: {
            result: cycleResult.appliedBuys + cycleResult.appliedSells > 0 ? "applied" : "hold",
            executedBuys: cycleResult.appliedBuys,
            executedSells: cycleResult.appliedSells,
          },
          rosterAfter: effectiveRosterAfter,
          hardMin,
          optTarget,
          needsConvergence,
          exhausted: exhaustedTeamIds.has(teamId),
        });
        perTeamMap.set(teamId, {
          teamId,
          teamName: afterSave.gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId,
          status,
          passes: Math.max(previous?.passes ?? 0, leagueRound),
          rounds: Math.max(previous?.rounds ?? 0, cycle),
          appliedBuys: (previous?.appliedBuys ?? 0) + cycleResult.appliedBuys,
          appliedSells: (previous?.appliedSells ?? 0) + cycleResult.appliedSells,
          rosterAfter,
          hardMin,
          optTarget,
          minRequired: hardMin,
          doctrineStrategy,
          blockingReasons: previous?.blockingReasons ?? [],
          warnings: unique([...(previous?.warnings ?? []), ...cycleResult.warnings]),
          roundHistory: previous?.roundHistory ?? [],
        });

        if (cycleResult.appliedBuys + cycleResult.appliedSells === 0) break;
        if (exhaustedTeamIds.has(teamId)) break;
      }
    }

    leagueRoundsCompleted = leagueRound;
    const afterRoundSave = readLiveSave();
    const coverageRiskAfter = afterRoundSave ? getTeamsNeedingConvergence(afterRoundSave.gameState).length : coverageRiskBefore;
    const stalledWithUnchangedCoverage =
      roundAppliedBuys === 0 && roundAppliedSells === 0 && coverageRiskBefore === coverageRiskAfter;
    if (stalledWithUnchangedCoverage) {
      warnings.push(
        `transfer_window_stalled_coverage_risk_unchanged:round:${leagueRound}:count:${coverageRiskAfter}`,
      );
      for (const teamId of needing) exhaustedTeamIds.add(teamId);
      break;
    }
    if (!roundProgress) {
      warnings.push(`transfer_window_stalled:round:${leagueRound}`);
      for (const teamId of needing) exhaustedTeamIds.add(teamId);
      break;
    }
  }

  const finalSave = readLiveSave();
  if (!finalSave) throw new Error("Save missing after transfer window session.");
  const finalRosterCounts = rosterCountsByTeam(finalSave.gameState);

  for (const [teamId, result] of perTeamMap) {
    const rosterAfter = finalRosterCounts.get(teamId) ?? rosterCount(finalSave.gameState, teamId);
    const hardMin = getTeamHardMinRequired(finalSave.gameState, teamId);
    const optTarget = getTeamOptTarget(finalSave.gameState, teamId);
    const needsConvergence = teamNeedsMarketConvergence(finalSave.gameState, teamId);
    result.status = resolveTeamStatus({
      team: { executedBuys: result.appliedBuys, executedSells: result.appliedSells, result: result.status },
      rosterAfter,
      hardMin,
      optTarget,
      needsConvergence,
      exhausted: exhaustedTeamIds.has(teamId),
    });
    result.rosterAfter = rosterAfter;
  }

  const stillNeedingConvergence = scopeTeam(
    getTeamsNeedingConvergence(finalSave.gameState).map((entry) => entry.teamId),
  );
  const belowMinExhausted = scopeTeam(
    getTeamsBelowHardMin(finalSave.gameState)
      .map((entry) => entry.teamId)
      .filter((teamId) => exhaustedTeamIds.has(teamId) || perTeamMap.get(teamId)?.status === "convergence_exhausted"),
  );
  const emergencyRepairTeams = unique([
    ...belowMinExhausted,
    ...(leagueRoundsCompleted >= maxLeagueRounds ? stillNeedingConvergence : []),
  ]);

  return {
    phase: input.phase,
    leagueRounds: leagueRoundsCompleted,
    teamCycles: totalTeamCycles,
    passes: leagueRoundsCompleted,
    rounds: totalTeamCycles,
    perTeam: [...perTeamMap.values()],
    emergencyRepairTeams,
    appliedBuys: totalAppliedBuys,
    appliedSells: totalAppliedSells,
    warnings: unique(warnings),
    blockingReasons: unique(blockingReasons),
    skipped: false,
    roundHistory: [],
  };
}
