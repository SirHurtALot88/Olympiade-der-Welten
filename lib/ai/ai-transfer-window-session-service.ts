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
  teamSkipsPreseasonMarketBuys,
  type ConvergencePickEngine,
  type ConvergenceTeamResult,
  type MarketPlanConvergenceResult,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { getTeamsNeedingPostOptUpgradeDeploy, teamNeedsPostOptUpgradeDeploy } from "@/lib/ai/ai-budget-deploy-service";
import { resolvePostOptUpgradeMandate } from "@/lib/ai/planner-post-opt-upgrade-policy";
import { runPreseasonBatchPickRebuild } from "@/lib/ai/preseason-batch-pick-rebuild-service";
import { isUnifiedPickEnabledForMarket } from "@/lib/ai/unified-pick-planner-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
  listLocalTransfermarktFreeAgents,
  type LocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import {
  planOrganicDraftForTeam,
  planOrganicSellsForTeam,
  resolveOrganicRenewalContractLength,
} from "@/lib/ai/organic-squad/draft-adapter";
import { applyContractRenewalAction, previewContractRenewalAction } from "@/lib/contracts/contract-renewal-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { ContractStatus, GameState, Player } from "@/lib/data/olyDataTypes";
import { resolvePlannerRosterTargets } from "@/lib/foundation/roster-limits";
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
  /** Optional: scripts can pass their run outputDir for extra debug files. */
  outputDir?: string;
  /**
   * Preseason buy orchestration. Production/default: same path as the S1 draft (batch plan + apply).
   * `convergence_loop` keeps the legacy incremental applyAiMarketPlanLocally cycles — only for
   * unit tests / diagnostics that mock the market apply layer.
   */
  preseasonBuyMode?: "s1_draft_batch" | "convergence_loop";
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

/** Buy cycles cannot exceed roster headroom — if the planner plans 10 picks, 10 rounds suffice. */
const MAX_PRESEASON_BUY_CYCLES_PER_TEAM = 14;

function resolvePreseasonBuyCycleCap(
  gameState: GameState,
  teamId: string,
  configuredMax: number,
): number {
  const roster = rosterCount(gameState, teamId);
  const targets = resolvePlannerRosterTargets(gameState, teamId);
  const optGap = Math.max(getTeamOptTarget(gameState, teamId) - roster, 0);
  const headroom = Math.max(targets.playerMax - roster, 0);
  const meaningfulGap = Math.max(optGap, headroom, 1);
  return Math.max(1, Math.min(configuredMax, meaningfulGap, MAX_PRESEASON_BUY_CYCLES_PER_TEAM));
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
  const mandate = resolvePostOptUpgradeMandate(liveSave.gameState, input.teamId);

  async function runSellPass(sellMandate: ReturnType<typeof resolvePostOptUpgradeMandate>) {
    const sellSave = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
    if (!sellSave || rosterCount(sellSave.gameState, input.teamId) <= 0) return;
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
      return;
    }
    appliedSells += sellApply.summary.appliedSells;
    warnings.push(...sellApply.warnings.slice(0, 4));
    for (const team of sellApply.teams) {
      for (const step of [...team.appliedSellDetails, ...team.plannedSellDetails]) {
        if (step.stepType === "sell") input.excludeSellPlayerIds.add(step.playerId);
      }
    }
  }

  async function runBuyPass(buyMandate: ReturnType<typeof resolvePostOptUpgradeMandate> | null) {
    const afterSave = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
    if (!afterSave) return;
    const needsConvergence = teamNeedsMarketConvergence(afterSave.gameState, input.teamId);
    const needsUpgradeDeploy = teamNeedsPostOptUpgradeDeploy(afterSave.gameState, input.teamId, input.seasonId);
    const skipPreseasonBuys = teamSkipsPreseasonMarketBuys(afterSave.gameState, input.teamId);
    if (!(needsConvergence || needsUpgradeDeploy) || (skipPreseasonBuys && !needsUpgradeDeploy)) {
      return;
    }
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
        maxBuysPerTeam: buyMandate?.active ? buyMandate.maxBuys : null,
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
        postOptUpgradeDeploy: buyMandate?.postOptUpgradeDeploy ?? false,
        minUpgradeBuyPrice: buyMandate?.minUpgradeBuyPrice ?? null,
      },
    });
    if (!buyApply?.summary) {
      warnings.push("transfer_window_buy_apply_missing");
      return;
    }
    appliedBuys += buyApply.summary.appliedBuys;
    warnings.push(...buyApply.warnings.slice(0, 4));
    applyResult = buyApply.teams.find((team) => team.teamId === input.teamId)?.result ?? applyResult;
    for (const row of buyApply.buyGateRows ?? []) {
      if (row.status !== "accepted") continue;
      const playerId = typeof row.playerId === "string" ? row.playerId : null;
      if (playerId) input.excludeBuyPlayerIds.add(playerId);
    }
    for (const team of buyApply.teams) {
      for (const step of [...team.appliedBuyDetails, ...team.plannedBuyDetails]) {
        if (step.stepType === "buy") input.excludeBuyPlayerIds.add(step.playerId);
      }
    }
  }

  // Organic-squad-builder cycle (flag: OLY_ORGANIC_SQUAD_BUILDER, default OFF). Same per-team unit as
  // runSellPass/runBuyPass — it returns via the same closure accumulators (appliedSells/appliedBuys/
  // applyResult/warnings) and mutates the same exclusion sets, so the outer-loop bookkeeping is
  // unchanged. Respects the hard phase separation: input.allowSells (season_end) ⇒ organic SELLS only,
  // input.allowBuys (preseason) ⇒ organic BUYS only. The outer loop never sets both in one cycle.
  function organicRosterEntries(gameState: GameState, teamId: string) {
    // Trivial replica of ai-picks-run-service.getTeamRosterPlayers (not exported): each roster entry
    // paired with its domain Player, so the sell call has the roster entry `id` (activePlayerId). Also
    // carries the entry's cost basis (purchasePrice → profit-flip term) and contract state (whether the
    // player is expiring, i.e. renewal-eligible) for the season-end renew→sell decision.
    const playersById = new Map<string, Player>(gameState.players.map((player) => [player.id, player]));
    const entries: Array<{
      activePlayerId: string;
      player: Player;
      purchasePrice: number | null;
      contractLength: number;
      contractStatus?: ContractStatus;
    }> = [];
    for (const entry of gameState.rosters) {
      if (entry.teamId !== teamId) continue;
      const player = playersById.get(entry.playerId);
      if (player) {
        entries.push({
          activePlayerId: entry.id,
          player,
          purchasePrice: entry.purchasePrice ?? null,
          contractLength: entry.contractLength,
          contractStatus: entry.contractStatus,
        });
      }
    }
    return entries;
  }

  async function runOrganicSellCycle() {
    const save = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
    if (!save) return;
    const gameState = save.gameState;
    const team = gameState.teams.find((entry) => entry.teamId === input.teamId);
    if (!team) return;
    const entries = organicRosterEntries(gameState, input.teamId).filter(
      (entry) => !input.excludeSellPlayerIds.has(entry.player.id),
    );
    if (entries.length === 0) return;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);

    // Organic season-end economic flow: score every held player with the organic sell model (profit +
    // coverage + patience). High-sellUtility bodies are the SELLABLE surplus/profit-flips; everyone
    // else is a KEEPER. purchasePrice (cost basis) feeds the profit-flip term so a trader sheds gains.
    const purchasePriceByPlayerId: Record<string, number> = {};
    for (const entry of entries) {
      if (typeof entry.purchasePrice === "number" && Number.isFinite(entry.purchasePrice)) {
        purchasePriceByPlayerId[entry.player.id] = entry.purchasePrice;
      }
    }
    const plan = planOrganicSellsForTeam({
      gameState,
      team,
      identity,
      roster: entries.map((entry) => entry.player),
      purchasePriceByPlayerId,
      // Season-end sell cycle: allow shedding below ROSTER_MIN (empty is fine — preseason rebuilds),
      // so profit/surplus sells fire even when the draft left the team exactly at min.
      allowBelowMin: true,
    });
    warnings.push(`organic_squad_builder_sell:decisions=${plan.decisions.length}`);
    const sellPlayerIds = new Set(plan.decisions.map((decision) => decision.playerId));

    // (1) RENEW keepers BEFORE selling (product intent "renew before sell"): for each non-sold player
    // whose contract is already expiring (length 0 / renewal-eligible — the per-season −1 decrement and
    // exit are existing engine behaviour we do NOT re-apply here), extend it via the existing
    // contract-renewal service at the identity/GM-derived length. Non-eligible players (still under
    // contract) need no action; keepers the renewal gate rejects (not affordable/valid) fall through to
    // the existing contract-exit machinery. Reuses previewContractRenewalAction for the confirm token
    // and affordability/validity gate, then applyContractRenewalAction to write.
    const renewLength = resolveOrganicRenewalContractLength({ gameState, team, identity });
    let renewed = 0;
    for (const entry of entries) {
      if (sellPlayerIds.has(entry.player.id)) continue; // surplus/profit-flip → sold below, not renewed
      const renewalEligible =
        entry.contractLength <= 0 ||
        entry.contractStatus === "renewal_pending" ||
        entry.contractStatus === "out_of_contract";
      if (!renewalEligible) continue; // still under contract → stays without action
      const renewSave = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
      if (!renewSave) break;
      const preview = previewContractRenewalAction({
        save: renewSave,
        teamId: input.teamId,
        playerId: entry.player.id,
        action: "renew",
        contractLength: renewLength,
      });
      if (!preview.ok) continue; // not affordable/eligible/blocked → let contract-exit handle it
      const applied = applyContractRenewalAction({
        save: renewSave,
        teamId: input.teamId,
        playerId: entry.player.id,
        action: "renew",
        confirmToken: preview.confirmToken,
        persistence: input.persistence,
        contractLength: renewLength,
        source: "ai_contract_renewal",
      });
      if (!applied.applied) continue;
      renewed += 1;
      // applyContractRenewalAction persists the full derived gameState directly (bypassing the deferred
      // run-context buffer). Re-sync the run context to that persisted state so subsequent sells build
      // on the renewed roster and the session's final flush does not clobber the renewal.
      if (input.sessionRunContext) {
        const reloaded = input.persistence.getSaveById(input.saveId);
        if (reloaded) input.sessionRunContext.save = reloaded;
      }
    }
    if (renewed > 0) warnings.push(`organic_squad_builder_renew:renewed=${renewed}:length=${renewLength}`);

    // (2) SELL the sellable surplus/profit-flips (unchanged execute path; ROSTER_MIN respected upstream
    // by planOrganicSellsForTeam). The remaining non-renewed, non-sold players are left to contract-exit.
    const activePlayerIdByPlayerId = new Map(entries.map((entry) => [entry.player.id, entry.activePlayerId]));
    for (const decision of plan.decisions) {
      const activePlayerId = activePlayerIdByPlayerId.get(decision.playerId);
      if (!activePlayerId) continue;
      const sellResult = executeLocalTransfermarktSell({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        activePlayerId,
        transferSource: "ai_organic_squad_sell",
        localRunContext: input.sessionRunContext,
        deferPersist: true,
      });
      if (!sellResult.transferCreated) {
        warnings.push(...sellResult.blockingReasons.slice(0, 2));
        continue;
      }
      appliedSells += 1;
      input.excludeSellPlayerIds.add(decision.playerId);
    }
  }

  function runOrganicBuyCycle() {
    const save = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
    if (!save) return;
    const gameState = save.gameState;
    const team = gameState.teams.find((entry) => entry.teamId === input.teamId);
    if (!team) return;
    const rosterPlayerIds = new Set(organicRosterEntries(gameState, input.teamId).map((entry) => entry.player.id));
    const startingSquad = organicRosterEntries(gameState, input.teamId).map((entry) => entry.player);
    const freeAgentItems = listLocalTransfermarktFreeAgents({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      mode: "ai_preview",
      localRunContext: input.sessionRunContext,
      fullPool: true,
    }).items;
    const playersById = new Map<string, Player>(gameState.players.map((player) => [player.id, player]));
    const candidates: Player[] = [];
    for (const item of freeAgentItems) {
      if (input.excludeBuyPlayerIds.has(item.playerId) || rosterPlayerIds.has(item.playerId)) continue;
      const player = playersById.get(item.playerId);
      if (player) candidates.push(player);
    }
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);
    // Preseason buys reuse the draft planner with the CURRENT roster as the startingSquad.
    const plan = planOrganicDraftForTeam({ gameState, team, identity, startingSquad, candidates });
    warnings.push(`organic_squad_builder_buy:decisions=${plan.decisions.length}`);
    if (plan.stoppedBelowMin) warnings.push("organic_squad_builder_stopped_below_min");
    for (const decision of plan.decisions) {
      if (input.excludeBuyPlayerIds.has(decision.playerId)) continue;
      const buyResult = executeLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        playerId: decision.playerId,
        transferSource: "ai_organic_squad_buy",
        localRunContext: input.sessionRunContext,
        deferPersist: true,
      });
      if (!buyResult.transferCreated || !buyResult.transferId) {
        warnings.push(...buyResult.blockingReasons.slice(0, 2));
        applyResult = "hold";
        break;
      }
      appliedBuys += 1;
      applyResult = "applied";
      input.excludeBuyPlayerIds.add(decision.playerId);
    }
  }

  async function runOrganicTeamCycle() {
    if (input.allowSells) await runOrganicSellCycle();
    if (input.allowBuys) runOrganicBuyCycle();
  }

  const useOrganic = process.env.OLY_ORGANIC_SQUAD_BUILDER === "1";

  // Strict phase separation: season_end cycles sell-only, preseason cycles buy-only.
  // Replace-mode floor sells belong in the S1 season_end pass, not paired inside S2 buy cycles.
  if (useOrganic) {
    await runOrganicTeamCycle();
  } else {
    if (input.allowSells) {
      await runSellPass(mandate);
    }
    const afterSellSave = input.sessionRunContext?.save ?? input.persistence.getSaveById(input.saveId);
    const postSellMandate =
      afterSellSave != null ? resolvePostOptUpgradeMandate(afterSellSave.gameState, input.teamId) : null;
    if (input.allowBuys) {
      await runBuyPass(postSellMandate);
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
  // Design correction (2026-07-04): sell and buy are now strictly phase-separated (see
  // isSeasonEndSellPhase/isPreseasonBuyPhase below) — a team's main-loop cycles in a season_end
  // session only ever sell, and its cycles in a preseason session only ever buy. The old
  // "netNegativeStrikes"/sell-spiral-halt mechanism below existed solely to defend against the
  // previous coupled sell-then-buy-in-the-same-cycle design (a team whose buy kept failing got sold
  // down cycle after cycle with nothing to show for it). That failure mode is now structurally
  // impossible: a season_end cycle never attempts a buy, so "sell without a matching buy" is the
  // expected shape of every cycle there, not an anomaly — and a preseason cycle never attempts a
  // sell, so the roster can never shrink there. Keeping the old strike/halt logic active would
  // therefore misfire on every single season_end sell cycle and artificially cap a team at ~2 sells
  // regardless of how many legitimate sell candidates (profit/contract-end/roster-cleanup) it has —
  // an unintended intensity change, not a reordering. The mechanism is intentionally removed from
  // this loop; each team's own sell/buy preview scoring (unchanged) is the only thing that decides
  // how much it sells or buys, which naturally produces a heterogeneous per-team result. No new
  // roster floor is introduced — see .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc.
  const isSeasonEndSellPhase = input.phase === "season_end";
  const isPreseasonBuyPhase = input.phase === "preseason";

  // Sell-cap mechanism removed entirely (2026-07-04, explicit user correction — see
  // .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc and
  // outputs/real-engine-s1s5-final/progress-log.md): the previous
  // SEASON_END_BELOW_OPT_QUALITY_SELL_CAP (originally 1, later raised to 3) and the hardMin
  // "Rebuild-mode" sell gate below it were both, on reflection, a mistaken design: the Opt target is
  // a checkpoint for the state *after* the preseason buy phase, not a gate on how much a team may
  // sell at season end. A team with 12 players is free to sell all 12 and start next preseason at 0,
  // exactly like every team starts Season 1 at 0 and rebuilds with its full cash budget via the same
  // Unified Pick Engine convergence used here — there is no conceptual difference between "team sold
  // itself down to 0 at season end" and "team enters the S1 draft at 0"; both must be fully rebuildable
  // by the buy-side engine in the following preseason pass. Capping/gating sells was treating the
  // wrong side of the pipeline as the problem. The actual, still-real question the original S3
  // incident raised — was repeated selling itself harmful, or was the real bug that the *subsequent
  // preseason buy phase* didn't reliably rebuild a heavily-sold-down team back to Opt — is now
  // re-diagnosed as the latter and tracked separately (see the progress log entry for this session);
  // fixing that properly belongs in the preseason buy convergence path, not as a sell-side limiter.

  const preseasonBuyMode = input.preseasonBuyMode ?? "s1_draft_batch";
  const usePreseasonS1DraftBatch =
    isPreseasonBuyPhase && allowBuys && isUnifiedPickEnabledForMarket() && preseasonBuyMode === "s1_draft_batch";

  if (usePreseasonS1DraftBatch) {
    const batchSave = readLiveSave();
    if (batchSave) {
      // Feed all teams into batch; the batch planner decides who buys (below Opt OR cash-deploy).
      // This avoids excluding cash hoarders that already sit at Opt.
      const batchTeamIds = scopeTeam(batchSave.gameState.teams.map((team) => team.teamId));
      if (batchTeamIds.length > 0) {
        if (input.progressLog) {
          console.error(
            `[transfer-window] ${input.seasonId} preseason s1-draft-batch teams=${batchTeamIds.length}`,
          );
        }
        const batchResult = await runPreseasonBatchPickRebuild({
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamIds: batchTeamIds,
          persistence,
          stepsPerTeam: 14,
          draftSeedSuffix: "preseason-batch",
          outputDir: input.outputDir,
        });
        totalAppliedBuys += batchResult.appliedPicks + batchResult.topupAppliedPicks;
        leagueRoundsCompleted = 1;
        warnings.push(
          `preseason_s1_draft_batch:teams:${batchResult.batchTeamIds.length}:picks:${batchResult.appliedPicks}:topup:${batchResult.topupAppliedPicks}`,
          ...batchResult.warnings.slice(0, 8),
        );
        blockingReasons.push(...batchResult.blockingReasons.slice(0, 8));
        const afterBatchSave = readLiveSave();
        if (afterBatchSave) {
          for (const teamId of batchTeamIds) {
            const team = afterBatchSave.gameState.teams.find((entry) => entry.teamId === teamId);
            const rosterAfter = rosterCount(afterBatchSave.gameState, teamId);
            const hardMin = getTeamHardMinRequired(afterBatchSave.gameState, teamId);
            const optTarget = getTeamOptTarget(afterBatchSave.gameState, teamId);
            const needsConvergence = teamNeedsMarketConvergence(afterBatchSave.gameState, teamId);
            perTeamMap.set(teamId, {
              teamId,
              teamName: team?.name ?? teamId,
              status: resolveTeamStatus({
                team: { executedBuys: 0, executedSells: 0, result: "applied" },
                rosterAfter,
                hardMin,
                optTarget,
                needsConvergence,
                exhausted: false,
              }),
              pickEngine: "unified",
              passes: 1,
              rounds: 1,
              appliedBuys: 0,
              appliedSells: 0,
              rosterAfter,
              hardMin,
              optTarget,
              minRequired: hardMin,
              doctrineStrategy:
                buildSeasonStrategyState(afterBatchSave.gameState)[teamId]?.seasonStrategy ?? "balanced_growth",
              blockingReasons: [],
              warnings: ["preseason_s1_draft_batch"],
              roundHistory: [],
            });
          }
        }
        if (sessionRunContext && sessionRunContext.deferredWrites > 0) {
          flushLocalTransfermarktRunContext(sessionRunContext);
        }
      }
    }
  }

  if (!usePreseasonS1DraftBatch) for (let leagueRound = 1; leagueRound <= maxLeagueRounds; leagueRound += 1) {
    const latestSave = readLiveSave();
    if (!latestSave) throw new Error("Save missing during transfer window.");
    const coverageRiskBefore = getTeamsNeedingConvergence(latestSave.gameState).length;
    // Season-end sell eligibility (2026-07-04, see the sell-cap-removal note above): the buy-phase
    // "needing convergence" gate (rosterCount >= Opt -> excluded) is correct for buys — a team that
    // has already reached Opt has no need to keep buying — but is the wrong gate for sells. A team
    // at or above Opt must still be allowed into the season_end sell session; whether it actually
    // sells anything is left entirely to its own sell-preview (poor fit / profit / contract-end
    // candidates), not to a pre-filter on roster size vs. Opt. Every scoped team with at least one
    // player is therefore eligible to be considered each round; a team with nothing worth selling
    // simply nets 0 actions on its first cycle and is marked exhausted (see below), so this does not
    // meaningfully add cost for teams that have no reason to sell.
    const needing = isSeasonEndSellPhase
      ? scopeTeam(latestSave.gameState.teams.map((team) => team.teamId)).filter(
          (teamId) => rosterCount(latestSave.gameState, teamId) > 0 && !exhaustedTeamIds.has(teamId),
        )
      : unique([
          ...scopeTeam(getTeamsNeedingConvergence(latestSave.gameState).map((entry) => entry.teamId)),
          ...scopeTeam(getTeamsNeedingPostOptUpgradeDeploy(latestSave.gameState, input.seasonId)),
        ]);
    if (needing.length === 0) {
      leagueRoundsCompleted = leagueRound;
      break;
    }

    let roundProgress = false;
    let roundAppliedBuys = 0;
    let roundAppliedSells = 0;
    // Strict phase separation (2026-07-04 design correction): "Verkauf findet separat statt und vor
    // allem VOR dem Kaufen" — a season_end session's main-loop cycles only ever sell (the Sell-Engine
    // pass, run at season end); a preseason session's main-loop cycles only ever buy (the Buy-Engine
    // pass, run at season start, spending cash incl. the previous phase's sell proceeds). This is the
    // direct fix for the "round=N cycle=1 engine=unified sells=1 buys=1" lateral-swap pattern (228+
    // occurrences in outputs/real-engine-s1s5-final-run2/run.log) — sell and buy no longer coexist in
    // the same cycle for either phase. The narrow "acute cash need during the buy phase" exception
    // from the task brief is handled by a separate, pre-existing mechanism upstream of this session
    // (recoverNegativeCashBeforeSeasonStart / runPreseasonProactiveCashRecovery in
    // scripts/long-run-sandbox-s1-s6.ts, which runs before the preseason buy convergence and is
    // itself sell-only) — it is intentionally not reintroduced here as a per-cycle reflex.
    for (const teamId of needing) {
      const cycleSave = readLiveSave();
      if (!cycleSave) break;
      const teamCycleCap = isPreseasonBuyPhase
        ? resolvePreseasonBuyCycleCap(cycleSave.gameState, teamId, maxTeamCycles)
        : maxTeamCycles;
      for (let cycle = 1; cycle <= teamCycleCap; cycle += 1) {
        const midSave = readLiveSave();
        // Season-end continuation check is phase-specific (2026-07-04, sell-cap removal): buy-phase
        // cycles still stop as soon as the team no longer needs convergence (unchanged). Sell-phase
        // cycles must NOT stop on that condition — teamNeedsMarketConvergence is false for any team
        // at/above Opt, which used to end a healthy team's sell attempt before it even got one cycle.
        // A sell-phase cycle only stops once the roster is empty (nothing left to sell); running out
        // of worthwhile candidates is handled by the natural "0 net actions -> exhausted" break below.
        if (!midSave) break;
        if (isSeasonEndSellPhase) {
          if (rosterCount(midSave.gameState, teamId) <= 0) break;
        } else if (
          !teamNeedsMarketConvergence(midSave.gameState, teamId) &&
          !teamNeedsPostOptUpgradeDeploy(midSave.gameState, teamId, input.seasonId)
        ) {
          break;
        }
        const rosterBeforeCycle = rosterCount(midSave.gameState, teamId);
        const allowSellsForCycle = isSeasonEndSellPhase;
        const allowBuysForCycle = isPreseasonBuyPhase && allowBuys;

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
          allowBuys: allowBuysForCycle,
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
        } else if (!isSeasonEndSellPhase && effectiveRosterAfter === rosterBeforeCycle) {
          // Only meaningful in the buy phase: a buy cycle that applied nothing net (e.g. a blocked
          // candidate) made no forward progress. In the sell phase a shrinking roster is the expected
          // outcome of a successful sell cycle, not a stall — see the phase-separation note above.
          exhaustedTeamIds.add(teamId);
          warnings.push(`transfer_window_roster_stalled:${teamId}:round:${leagueRound}:cycle:${cycle}`);
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
  // hardMin violations, and a team can end up here simply because a pure buy-only attempt against
  // the pool as it stands after every other team's activity this session was never retried. This
  // pass is buy-only (sells fully disabled), reuses the same fit-aware pick engine (no lowered
  // standards / no emergency filler), and is bounded to the small subset of teams still gapped —
  // see outputs/real-engine-s1s5-final/progress-log.md for the S1 case study (R-C) that surfaced
  // this. It is a buying mechanism, so under the strict phase separation (2026-07-04 design
  // correction — "Käufe gehören an den SAISON-START") it only runs for the preseason/buy phase; a
  // season_end session is sell-only end to end and must not perform any buy, rescue or otherwise.
  const OPT_GAP_RESCUE_THRESHOLD = 1;
  const OPT_GAP_RESCUE_MAX_CYCLES = 2;
  const rescueSave = isPreseasonBuyPhase && !usePreseasonS1DraftBatch ? readLiveSave() : null;
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
