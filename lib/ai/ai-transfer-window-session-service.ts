import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import {
  getTeamHardMinRequired,
  getTeamOptTarget,
  getTeamsBelowHardMin,
  getTeamsNeedingConvergence,
  resolveActiveConvergencePickEngine,
  resolveTeamStatus,
  teamNeedsMarketConvergence,
  type ConvergencePickEngine,
  type ConvergenceTeamResult,
  type MarketPlanConvergenceResult,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import {
  createLocalTransfermarktRunContext,
  flushLocalTransfermarktRunContext,
  type LocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
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

// Escape hatch for A/B perf measurement only: set OLY_TW_DEFER_FLUSH=0 to restore the old
// flush-and-audit-save-per-apply behaviour. Defaults to the batched (fast) path.
function isDeferContextFlushEnabled() {
  return process.env.OLY_TW_DEFER_FLUSH !== "0";
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
  let applyResult: string | undefined;

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
        deferContextFlush: isDeferContextFlushEnabled(),
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
        deferContextFlush: isDeferContextFlushEnabled(),
      },
    });
    if (!buyApply?.summary) {
      warnings.push("transfer_window_buy_apply_missing");
      return { appliedSells, appliedBuys, warnings };
    }
    appliedBuys += buyApply.summary.appliedBuys;
    warnings.push(...buyApply.warnings.slice(0, 4));
    applyResult = buyApply.teams.find((team) => team.teamId === input.teamId)?.result ?? applyResult;
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
      `[transfer-window] ${input.seasonId} ${input.teamId} round=${input.leagueRound} cycle=${input.cycleIndex} engine=${resolveActiveConvergencePickEngine()} sells=${appliedSells} buys=${appliedBuys}`,
    );
  }

  return { appliedSells, appliedBuys, warnings, applyResult: applyResult ?? undefined };
}

export async function runTransferWindowSession(input: TransferWindowSessionInput): Promise<TransferWindowSessionResult> {
  const persistence = input.persistence ?? createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing for transfer window session.");
  const sessionRunContext: LocalTransfermarktRunContext | null =
    input.dryRun === true ? null : createLocalTransfermarktRunContext({ persistence, save });

  const readLiveSave = (): PersistedSaveGame | null =>
    sessionRunContext?.save ?? persistence.getSaveById(input.saveId) ?? null;

  const maxTeamCycles = Math.max(1, input.maxTeamCycles ?? 5);
  const maxLeagueRounds = Math.max(1, input.maxLeagueRounds ?? 3);
  // S1 buys are permitted (course correction 2026-07-04: draft is just the first ordinary buy
  // pass; a team that sells down below hardMin/Opt in S1 must be able to rebuy in the same
  // season). Only the explicit caller-supplied `allowBuys` flag can disable buys now.
  const allowBuys = input.allowBuys ?? true;
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
  // A single sell-without-a-matching-buy cycle is a normal, bounded part of convergence (e.g. a
  // deliberate cash-recovery liquidation step) and must NOT be treated as a hard failure — see the
  // "valid_sell_only_below_min" status. But left unchecked across many cycles/rounds, a team whose
  // buy candidates keep failing to land (lane/cash/archetype mismatch) gets sold down cycle after
  // cycle with nothing to show for it, eventually reaching 0 players — a direct violation of the
  // no-sell-floor rebuild guarantee (.cursor/rules/balancing-no-sell-floor-full-rebuild.mdc). Track
  // consecutive net-negative cycles per team across the whole session (reset on any net-positive
  // cycle) and hard-stop that team once it happens twice without recovering in between.
  const netNegativeStrikes = new Map<string, number>();
  const sellSpiralHaltedTeamIds = new Set<string>();

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
      // Once a team's sell/buy pairing has repeatedly failed to land (see netNegativeStrikes below),
      // don't re-enter it in a later round — getTeamsNeedingConvergence will keep returning it (it's
      // still short of Opt), but retrying just repeats the same failed pairing and erodes the roster
      // further. This is intentionally narrower than "any exhausted team": teams that stall out with a
      // clean net-zero swap (sell 1, buy 1 better replacement) are expected to keep getting fresh
      // chances each round — only sell-without-buy spirals get hard-stopped across rounds.
      if (sellSpiralHaltedTeamIds.has(teamId)) continue;
      for (let cycle = 1; cycle <= maxTeamCycles; cycle += 1) {
        const midSave = readLiveSave();
        if (!midSave || !teamNeedsMarketConvergence(midSave.gameState, teamId)) break;
        const rosterBeforeCycle = rosterCount(midSave.gameState, teamId);
        // Rebuild-mode (course correction 2026-07-04, req C): a team below hardMin needs pure
        // acquisition, not sell-first-churn. Selling first here was a root cause of a net-zero
        // churn trap for badly depleted teams (sell 1 low-value bench player, buy 1 similar-value
        // replacement, roster count never grows) — see engine-architecture-ist.md / R-R case
        // study. Gate on hardMin (not Opt): teams between hardMin and Opt may legitimately still
        // sell a poor-fit player as part of roster-quality management (existing behaviour,
        // covered by tests/ai-market-plan-convergence.test.ts's "sell-only below Opt but above
        // hardMin" cases) — only a team that hasn't even reached hardMin yet is forced into
        // buy-only mode.
        const teamHardMinForCycle = getTeamHardMinRequired(midSave.gameState, teamId);
        const allowSellsForCycle = rosterBeforeCycle >= teamHardMinForCycle;

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
          allowSells: allowSellsForCycle,
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
        } else if (effectiveRosterAfter < rosterBeforeCycle) {
          const strikes = (netNegativeStrikes.get(teamId) ?? 0) + 1;
          netNegativeStrikes.set(teamId, strikes);
          if (strikes >= 2) {
            exhaustedTeamIds.add(teamId);
            sellSpiralHaltedTeamIds.add(teamId);
            warnings.push(`transfer_window_sell_without_matching_buy_halted:${teamId}:round:${leagueRound}:cycle:${cycle}`);
          } else {
            warnings.push(`transfer_window_sell_without_matching_buy:${teamId}:round:${leagueRound}:cycle:${cycle}`);
          }
        } else {
          netNegativeStrikes.set(teamId, 0);
        }

        const previous = perTeamMap.get(teamId);
        const status = resolveTeamStatus({
          team: {
            result: cycleResult.applyResult ?? (cycleResult.appliedBuys + cycleResult.appliedSells > 0 ? "applied" : "hold"),
            executedBuys: (previous?.appliedBuys ?? 0) + cycleResult.appliedBuys,
            executedSells: (previous?.appliedSells ?? 0) + cycleResult.appliedSells,
          },
          rosterAfter: rosterCount(afterSave.gameState, teamId),
          hardMin,
          optTarget,
          needsConvergence,
          exhausted: exhaustedTeamIds.has(teamId),
        });
        perTeamMap.set(teamId, {
          teamId,
          teamName: afterSave.gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId,
          status,
          pickEngine: resolveActiveConvergencePickEngine(),
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
          lastApplyResult: cycleResult.applyResult ?? previous?.lastApplyResult,
        });

        if (cycleResult.appliedBuys + cycleResult.appliedSells === 0) break;
        if (exhaustedTeamIds.has(teamId)) break;
      }
    }

    leagueRoundsCompleted = leagueRound;
    // Each apply now buffers its writes in the shared sessionRunContext (deferContextFlush) instead
    // of forcing a full ~1.2s GameState save per apply. Persist once per completed round so a killed
    // process only loses at most one round of transfer work, while cutting per-season saves from
    // O(teams × cycles × applies) down to O(rounds).
    if (sessionRunContext && sessionRunContext.deferredWrites > 0) {
      flushLocalTransfermarktRunContext(sessionRunContext);
    }
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

  // Opt-gap rescue (2026-07-04): teams above hardMin but still stuck well below Opt (gap>=3) at
  // this point never get a second look — the emergency repair engine further below only fires for
  // hardMin violations, and a team can end up here simply because it hit the 2-strike sell-spiral
  // halt (see netNegativeStrikes above) partway through the main rounds, even though a pure
  // buy-only attempt against the pool as it stands after every other team's activity this session
  // was never retried. This pass is buy-only (sells fully disabled) so it cannot add further
  // net-negative strikes or reduce roster size, reuses the same fit-aware pick engine (no lowered
  // standards / no emergency filler), and is bounded to the small subset of teams still gapped —
  // see outputs/real-engine-s1s5-final/progress-log.md for the S1 case study (R-C) that surfaced this.
  const OPT_GAP_RESCUE_THRESHOLD = 3;
  const OPT_GAP_RESCUE_MAX_CYCLES = 2;
  const rescueSave = readLiveSave();
  if (rescueSave) {
    const rescueCandidates = scopeTeam(
      rescueSave.gameState.teams
        .map((team) => team.teamId)
        .filter((teamId) => {
          const rosterAfter = rosterCount(rescueSave.gameState, teamId);
          const hardMin = getTeamHardMinRequired(rescueSave.gameState, teamId);
          const optTarget = getTeamOptTarget(rescueSave.gameState, teamId);
          return rosterAfter >= hardMin && optTarget - rosterAfter >= OPT_GAP_RESCUE_THRESHOLD;
        }),
    );
    for (const teamId of rescueCandidates) {
      for (let rescueCycle = 1; rescueCycle <= OPT_GAP_RESCUE_MAX_CYCLES; rescueCycle += 1) {
        const midSave = readLiveSave();
        if (!midSave || !teamNeedsMarketConvergence(midSave.gameState, teamId)) break;
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
          allowBuys: true,
          allowSells: false,
          cycleIndex: rescueCycle,
          leagueRound: leagueRoundsCompleted + 1,
          excludeBuyPlayerIds,
          excludeSellPlayerIds,
          progressLog,
        });
        totalTeamCycles += 1;
        totalAppliedBuys += cycleResult.appliedBuys;
        const afterRescueSave = readLiveSave();
        const rosterAfter = afterRescueSave ? rosterCount(afterRescueSave.gameState, teamId) : undefined;
        const previous = perTeamMap.get(teamId);
        if (previous) {
          perTeamMap.set(teamId, {
            ...previous,
            appliedBuys: previous.appliedBuys + cycleResult.appliedBuys,
            rosterAfter: rosterAfter ?? previous.rosterAfter,
            warnings: unique([...previous.warnings, ...cycleResult.warnings, `opt_gap_rescue_pass:${teamId}:cycle:${rescueCycle}`]),
          });
        } else {
          warnings.push(`opt_gap_rescue_pass:${teamId}:cycle:${rescueCycle}`);
        }
        if (cycleResult.appliedBuys === 0) break;
      }
    }
    if (sessionRunContext && sessionRunContext.deferredWrites > 0) {
      flushLocalTransfermarktRunContext(sessionRunContext);
    }
  }

  // Safety net: persist any writes buffered after the last round completed but before a break, so the
  // DB is authoritative before callers re-read the save via a fresh getSaveById.
  if (sessionRunContext && sessionRunContext.deferredWrites > 0) {
    flushLocalTransfermarktRunContext(sessionRunContext);
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
      team: {
        executedBuys: result.appliedBuys,
        executedSells: result.appliedSells,
        result: result.lastApplyResult ?? result.status,
      },
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
      .filter((teamId) => {
        const perTeam = perTeamMap.get(teamId);
        if (perTeam?.status === "valid_sell_only_below_min") return false;
        const rosterAfter = finalRosterCounts.get(teamId) ?? rosterCount(finalSave.gameState, teamId);
        const hardMin = getTeamHardMinRequired(finalSave.gameState, teamId);
        if (rosterAfter >= hardMin) return false;
        return exhaustedTeamIds.has(teamId) || perTeam?.status === "convergence_exhausted";
      }),
  );
  const repairableStillNeeding = stillNeedingConvergence.filter((teamId) => {
    const perTeam = perTeamMap.get(teamId);
    if (perTeam?.status === "valid_sell_only_below_min" || perTeam?.status === "converged") return false;
    const rosterAfter = finalRosterCounts.get(teamId) ?? rosterCount(finalSave.gameState, teamId);
    const hardMin = getTeamHardMinRequired(finalSave.gameState, teamId);
    return rosterAfter < hardMin;
  });
  const emergencyRepairTeams = unique([
    ...belowMinExhausted,
    ...(leagueRoundsCompleted >= maxLeagueRounds ? repairableStillNeeding : []),
  ]);
  const activeEngine = resolveActiveConvergencePickEngine();
  for (const [teamId, result] of perTeamMap) {
    result.pickEngine = emergencyRepairTeams.includes(teamId) ? "repair" : activeEngine;
  }
  for (const teamId of emergencyRepairTeams) {
    if (!perTeamMap.has(teamId)) {
      perTeamMap.set(teamId, {
        teamId,
        teamName: finalSave.gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId,
        status: "convergence_exhausted",
        pickEngine: "repair",
        passes: leagueRoundsCompleted,
        rounds: totalTeamCycles,
        appliedBuys: 0,
        appliedSells: 0,
        rosterAfter: rosterCount(finalSave.gameState, teamId),
        hardMin: getTeamHardMinRequired(finalSave.gameState, teamId),
        optTarget: getTeamOptTarget(finalSave.gameState, teamId),
        minRequired: getTeamHardMinRequired(finalSave.gameState, teamId),
        doctrineStrategy: buildSeasonStrategyState(finalSave.gameState)[teamId]?.seasonStrategy ?? "balanced_growth",
        blockingReasons: [],
        warnings: [],
        roundHistory: [],
      });
    }
  }

  if (input.progressLog && emergencyRepairTeams.length > 0) {
    const engineCounts = [...perTeamMap.values()].reduce(
      (counts, entry) => {
        counts[entry.pickEngine] = (counts[entry.pickEngine] ?? 0) + 1;
        return counts;
      },
      {} as Record<ConvergencePickEngine, number>,
    );
    console.error(
      `[transfer-window] ${input.seasonId} summary engine unified=${engineCounts.unified ?? 0} legacy=${engineCounts.legacy ?? 0} repair=${engineCounts.repair ?? 0}`,
    );
  }

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
