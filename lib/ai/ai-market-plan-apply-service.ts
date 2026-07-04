import { randomUUID } from "node:crypto";

import {
  buildAiMarketPlanPreview,
  type AiMarketPlanBuyPlan,
  type AiMarketPlanCurrentState,
  type AiMarketPlanPreviewParams,
  type AiMarketPlanPreviewStatus,
  type AiMarketPlanProjectedState,
  type AiMarketPlanSellPlan,
  type AiMarketPlanTeamEntry,
} from "@/lib/ai/ai-market-plan-preview-service";
import { resolveMarketSpendableCashForPlanner } from "@/lib/ai/ai-manager-apply-service";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";
import { getBudgetStatus } from "@/lib/ai/ai-transfermarkt-preview-service";
import { assessTeamSellRunwayPressure } from "@/lib/ai/team-sell-runway-pressure";
import {
  estimateUpgradeBuyFloorMw,
  hasUpgradeSellOpportunity,
  isTeamOverCashSalarySoftTarget,
  teamNeedsPostOptUpgradeDeploy,
} from "@/lib/ai/ai-budget-deploy-service";
import type {
  GameLogEntry,
  GameState,
  Player,
  TeamControlMode,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { isTransferActionAllowed } from "@/lib/season/transfer-season-policy";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getScoutingWatchlistForTeam } from "@/lib/scouting/scouting-watchlist-service";
import { getPlayerScoutCertainty } from "@/lib/scouting/facility-scout-pipeline-service";
import { previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { isExplicitLocalTransferWindowPhase, type LocalTransferWindowPhase } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { recordPhase } from "@/lib/ai/transfer-window-profiler";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type AiMarketPlanApplyResultStatus =
  | "hold"
  | "planned"
  | "applied"
  | "skipped_manual"
  | "skipped_passive"
  | "skipped_disabled"
  | "skipped_warning"
  | "blocked"
  | "failed_sell"
  | "failed_buy";

export type AiMarketPlanApplyStepStatus = "planned" | "applied" | "skipped" | "blocked";

export type AiMarketPhaseId =
  | "ai_market_preflight"
  | "ai_sell_scan"
  | "ai_sell_apply"
  | "ai_renewal_scan"
  | "ai_renewal_apply"
  | "ai_buy_need_scan"
  | "ai_buy_candidate_scan"
  | "ai_buy_apply"
  | "ai_market_summary";

export type AiMarketPhaseAuditStatus = "ready" | "planned" | "applied" | "skipped" | "blocked" | "warning";

export type AiMarketPhaseAudit = {
  phaseId: AiMarketPhaseId;
  status: AiMarketPhaseAuditStatus;
  elapsedMs: number;
  teamsScanned: number;
  candidatesScanned: number;
  scanLimit: number | null;
  warnings: string[];
  blockingReasons: string[];
};

export type AiMarketPlanApplyStepResult = {
  stepType: "sell" | "buy";
  playerId: string;
  activePlayerId?: string | null;
  playerName: string;
  amount: number | null;
  salaryImpact: number | null;
  rosterImpact: number;
  status: AiMarketPlanApplyStepStatus;
  reason: string;
};

export type AiMarketPlanApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  aiEligible: boolean;
  previewStatus: AiMarketPlanPreviewStatus;
  result: AiMarketPlanApplyResultStatus;
  plannedSells: number;
  plannedBuys: number;
  executedSells: number;
  executedBuys: number;
  currentCash: number | null;
  projectedCash: number | null;
  currentRoster: number | null;
  projectedRoster: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  plannedSellDetails: AiMarketPlanApplyStepResult[];
  plannedBuyDetails: AiMarketPlanApplyStepResult[];
  appliedSellDetails: AiMarketPlanApplyStepResult[];
  appliedBuyDetails: AiMarketPlanApplyStepResult[];
  skippedSteps: AiMarketPlanApplyStepResult[];
  warnings: string[];
  blockingReasons: string[];
};

export type AiMarketPlanApplySummary = {
  totalTeams: number;
  eligibleAiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  plannedSells: number;
  plannedBuys: number;
  blockedSells: number;
  blockedBuys: number;
  appliedSells: number;
  appliedBuys: number;
  warningTeams: number;
  blockedTeams: number;
  holdTeams: number;
  existingHistoryWrites: number;
  plannedWrites: number;
  projectedCash: Record<string, number | null>;
  projectedRoster: Record<string, number | null>;
};

export type AiMarketPlanApplyResult = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied" | "partial_blocked";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: "ai" | "all";
  };
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string;
    requestedSeasonId: string | null;
    resolvedSeasonId: string;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: AiMarketPlanApplySummary;
  teams: AiMarketPlanApplyTeamResult[];
  results: AiMarketPlanApplyTeamResult[];
  warnings: string[];
  blockingReasons: string[];
  phaseAudit: AiMarketPhaseAudit[];
  plannedWrites: Array<{ teamId: string; stepType: "sell" | "buy"; playerId: string; playerName: string }>;
  appliedAudits: string[];
  buyGateRows?: Array<Record<string, unknown>>;
  auditLogId: string | null;
};

export type AiMarketPlanApplyParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  teamId?: string | null;
  teamScope?: "ai" | "all";
  dryRun?: boolean;
  includeWarningTeams?: boolean;
  confirmToken?: string | null;
  transferPhase?: LocalTransferWindowPhase | string | null;
  persistence?: PersistenceService;
  localRunContext?: ReturnType<typeof createLocalTransfermarktRunContext> | null;
  options?: {
    includeWarningTeams?: boolean;
    applySellSteps?: boolean;
    applyBuySteps?: boolean;
    maxBuysPerTeam?: number | null;
    maxSellsPerTeam?: number | null;
    previewBuyLimit?: number | null;
    previewSellLimit?: number | null;
    performanceBudgetMs?: number | null;
    maxApplyMs?: number | null;
    progressLog?: boolean;
    stopOnTeamFailure?: boolean;
    applyBuyStepsInBatch?: number | null;
    forceBuyScanTeamIds?: string[] | null;
    returnGateRows?: boolean;
    excludeBuyPlayerIds?: string[] | null;
    excludeSellPlayerIds?: string[] | null;
    convergenceIncrementalFill?: boolean;
    transferWindowCycleMode?: boolean;
    postOptUpgradeDeploy?: boolean;
    minUpgradeBuyPrice?: number | null;
    /**
     * When a caller owns the shared localRunContext across many applies (e.g. a whole transfer
     * window session), it can set this to keep the deferred writes buffered in the context and
     * persist them itself once per round/phase instead of forcing a full GameState save on every
     * single apply. Avoids the per-apply full-save (~1.2s on a large save) that dominated runtime.
     */
    deferContextFlush?: boolean;
  };
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function getProfileTokens(player: Player) {
  return [
    player.className,
    player.race,
    ...player.subclasses,
    ...player.traitsPositive,
    ...player.traitsNegative,
  ]
    .map(normalizeTransfermarktToken)
    .filter(Boolean);
}

function matchesHardNoGo(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile || profile.hardNoGos.length === 0) {
    return false;
  }

  const tokens = getProfileTokens(player);
  const normalizedRace = normalizeTransfermarktToken(player.race);
  return profile.hardNoGos.some((entry) => {
    const normalized = normalizeTransfermarktToken(entry);
    const condensed = normalized.replace(/_/g, "");
    if (!normalized) {
      return false;
    }
    if (normalized.includes("non_human") || condensed.includes("nonhuman")) {
      return normalizedRace !== "human";
    }
    if ((normalized.includes("human") || condensed.includes("human")) && normalized.includes("anti")) {
      return normalizedRace === "human";
    }
    const parts = normalized
      .split("_")
      .map((part) => part.trim())
      .filter((part) => part.length > 2 && !["core", "signing", "player", "players"].includes(part));
    return parts.some((part) => tokens.some((token) => token === part || token.includes(part) || part.includes(token)));
  });
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = persistence.getSaveById(saveId);
  if (!requestedSave) {
    throw new Error(`Requested save ${saveId} could not be resolved for AI market apply.`);
  }

  const save = requestedSave ?? persistence.getActiveSave() ?? bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for AI market apply.");
  }

  return save;
}

function buildHardNoGoBuyReasons(
  gameState: GameState,
  team: AiMarketPlanTeamEntry,
  candidates: AiMarketPlanBuyPlan["candidates"],
  playersById = new Map(gameState.players.map((player) => [player.id, player] as const)),
  skipForCoverageFallback = false,
) {
  if (skipForCoverageFallback) {
    return [];
  }
  const profile = getTeamStrategyProfile(gameState, team.teamId);
  if (!profile || profile.hardNoGos.length === 0) {
    return [];
  }

  return unique(
    candidates.map((candidate) => {
      const player = playersById.get(candidate.playerId);
      if (!player || !matchesHardNoGo(profile, player)) {
        return null;
      }

      return `buy_candidate_hard_no_go:${candidate.playerId}`;
    }),
  );
}

function buildBaseTeamResult(team: AiMarketPlanTeamEntry): AiMarketPlanApplyTeamResult {
  return {
    teamId: team.teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    controlMode: team.controlMode,
    aiEligible: false,
    previewStatus: team.status,
    result: "blocked",
    plannedSells: team.sellPlan.candidates.length,
    plannedBuys: team.buyPlan.candidates.length,
    executedSells: 0,
    executedBuys: 0,
    currentCash: team.currentState.cash,
    projectedCash: team.projectedState.cashAfterPlan,
    currentRoster: team.currentState.rosterCount,
    projectedRoster: team.projectedState.rosterAfterPlan,
    cashBefore: team.currentState.cash,
    cashAfter: team.projectedState.cashAfterPlan,
    rosterBefore: team.currentState.rosterCount,
    rosterAfter: team.projectedState.rosterAfterPlan,
    salaryBefore: team.currentState.salaryTotal,
    salaryAfter: team.projectedState.salaryAfterPlan,
    marketValueBefore: team.currentState.marketValueTotal,
    marketValueAfter: team.projectedState.marketValueAfterPlan,
    plannedSellDetails: [],
    plannedBuyDetails: [],
    appliedSellDetails: [],
    appliedBuyDetails: [],
    skippedSteps: [],
    warnings: [...team.warnings],
    blockingReasons: [...team.blockingReasons],
  };
}

function rollbackTeamState(persistence: PersistenceService, saveId: string, snapshot: GameState) {
  return persistence.saveSingleplayerState(saveId, snapshot);
}

function writeAuditLog(
  persistence: PersistenceService,
  scope: AiMarketPlanApplyResult["scope"],
  summary: AiMarketPlanApplySummary,
) {
  const save = resolveLocalSave(persistence, scope.saveId);
  const auditLogId = `ai-market-apply__${scope.saveId}__${scope.seasonId}__${randomUUID()}`;
  const log: GameLogEntry = {
    id: auditLogId,
    type: "ai",
    message: `AI-Marktplan lokal ausgefuehrt: ${summary.appliedSells} Verkaeufe, ${summary.appliedBuys} Kaeufe, ${summary.eligibleAiTeams} AI-Teams im Scope.`,
    createdAt: new Date().toISOString(),
  };

  persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    logs: [log, ...(save.gameState.logs ?? [])],
  });

  return auditLogId;
}

function buildOverallStatus(input: {
  dryRun: boolean;
  summary: AiMarketPlanApplySummary;
  warnings: string[];
  blockingReasons: string[];
}) {
  if (!input.dryRun) {
    if (input.summary.blockedTeams > 0 && input.summary.appliedBuys + input.summary.appliedSells > 0) {
      return "partial_blocked" as const;
    }
    if (input.blockingReasons.length > 0 && input.summary.appliedBuys + input.summary.appliedSells === 0) {
      return "blocked" as const;
    }
    if (input.warnings.length > 0 || input.blockingReasons.length > 0) {
      return "warning" as const;
    }
    return "applied" as const;
  }

  if (input.blockingReasons.length > 0) {
    return "blocked" as const;
  }
  if (input.warnings.length > 0) {
    return "warning" as const;
  }
  return "ready" as const;
}

function clampPositiveInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function getEffectiveOptions(input: AiMarketPlanApplyParams) {
  return {
    includeWarningTeams: input.options?.includeWarningTeams ?? input.includeWarningTeams ?? false,
    applySellSteps: input.options?.applySellSteps ?? true,
    applyBuySteps: input.options?.applyBuySteps ?? true,
    maxBuysPerTeam: clampPositiveInteger(input.options?.maxBuysPerTeam),
    maxSellsPerTeam: clampPositiveInteger(input.options?.maxSellsPerTeam),
    previewBuyLimit: clampPositiveInteger(input.options?.previewBuyLimit) ?? 120,
    previewSellLimit: clampPositiveInteger(input.options?.previewSellLimit) ?? 6,
    performanceBudgetMs: clampPositiveInteger(input.options?.performanceBudgetMs) ?? 15_000,
    maxApplyMs: clampPositiveInteger(input.options?.maxApplyMs),
    progressLog: input.options?.progressLog ?? false,
    stopOnTeamFailure: input.options?.stopOnTeamFailure ?? true,
    applyBuyStepsInBatch: clampPositiveInteger(input.options?.applyBuyStepsInBatch),
    forceBuyScanTeamIds: input.options?.forceBuyScanTeamIds ?? null,
    returnGateRows: input.options?.returnGateRows ?? false,
    excludeBuyPlayerIds: unique((input.options?.excludeBuyPlayerIds ?? []).filter(Boolean)),
    excludeSellPlayerIds: unique((input.options?.excludeSellPlayerIds ?? []).filter(Boolean)),
    convergenceIncrementalFill: input.options?.convergenceIncrementalFill ?? false,
    transferWindowCycleMode: input.options?.transferWindowCycleMode ?? false,
    postOptUpgradeDeploy: input.options?.postOptUpgradeDeploy ?? false,
    minUpgradeBuyPrice: input.options?.minUpgradeBuyPrice ?? null,
    deferContextFlush: input.options?.deferContextFlush ?? false,
  };
}

function buildPhaseAudit(input: {
  phaseId: AiMarketPhaseId;
  status: AiMarketPhaseAuditStatus;
  startedAt: number;
  teamsScanned?: number;
  candidatesScanned?: number;
  scanLimit?: number | null;
  warnings?: string[];
  blockingReasons?: string[];
}): AiMarketPhaseAudit {
  return {
    phaseId: input.phaseId,
    status: input.status,
    elapsedMs: Math.max(0, Date.now() - input.startedAt),
    teamsScanned: input.teamsScanned ?? 0,
    candidatesScanned: input.candidatesScanned ?? 0,
    scanLimit: input.scanLimit ?? null,
    warnings: unique(input.warnings ?? []),
    blockingReasons: unique(input.blockingReasons ?? []),
  };
}

function buildAiRenewalScanPhaseAudit(input: {
  save: PersistedSaveGame;
  startedAt: number;
  teamId?: string | null;
}) {
  const preview = previewSeasonEndContracts(input.save);
  const rows = preview.rows.filter((row) => row.controlMode === "ai" && (!input.teamId || row.teamId === input.teamId));
  const renewalCandidates = rows.filter((row) => row.recommendedAction === "renew");
  const releaseCandidates = rows.filter((row) => row.recommendedAction === "release");
  const warnings = [
    ...preview.warnings,
    renewalCandidates.length > 0 ? `ai_renewal_candidates:${renewalCandidates.length}` : null,
    releaseCandidates.length > 0 ? `ai_release_candidates:${releaseCandidates.length}` : null,
  ].filter((warning): warning is string => Boolean(warning));
  return buildPhaseAudit({
    phaseId: "ai_renewal_scan",
    status: renewalCandidates.length > 0 || releaseCandidates.length > 0 ? "ready" : "skipped",
    startedAt: input.startedAt,
    teamsScanned: new Set(rows.map((row) => row.teamId)).size,
    candidatesScanned: renewalCandidates.length + releaseCandidates.length,
    warnings,
    blockingReasons: preview.blockingReasons,
  });
}

function sumNullable(values: Array<number | null | undefined>) {
  if (values.some((value) => value == null || !Number.isFinite(value))) {
    return null;
  }

  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function limitItems<T>(items: T[], maxItems: number | null) {
  if (maxItems == null) {
    return items;
  }

  return items.slice(0, maxItems);
}

function getRosterNeedGap(team: AiMarketPlanTeamEntry) {
  const rosterCount = team.currentState.rosterCount ?? 0;
  const playerMin = team.currentState.playerMin ?? 0;
  const playerOpt = team.currentState.playerOpt ?? playerMin;
  const expiringCount = team.sellPlan.candidates.filter((candidate) => (candidate.contractLength ?? 99) <= 1).length;
  const rosterAfterExpiry = Math.max(0, rosterCount - expiringCount);

  if (rosterAfterExpiry < playerMin) {
    return playerMin - rosterAfterExpiry + 10;
  }
  if (rosterAfterExpiry < playerOpt) {
    return playerOpt - rosterAfterExpiry;
  }
  return 0;
}

function getSeasonMaxSlotNeed(gameState: GameState) {
  const counts = (gameState.seasonState.disciplineSchedule ?? [])
    .filter((entry) => entry.seasonId === gameState.season.id || !entry.seasonId)
    .flatMap((entry) => [entry.discipline1?.playerCount ?? 0, entry.discipline2?.playerCount ?? 0])
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (counts.length === 0) return 0;
  return Math.max(7, Math.max(...counts) * 2);
}

function getTeamCashBuffer(gameState: GameState, teamId: string, coverageFallback: boolean) {
  if (coverageFallback) return 0;
  return resolveTeamCashRunwayReserve(gameState, teamId);
}

function buildFinalBuyGate(input: {
  gameState: GameState;
  team: AiMarketPlanTeamEntry;
  candidates: AiMarketPlanBuyPlan["candidates"];
  allowedBuyCount: number;
  rosterBase: number | null;
  maxBuysPerTeam: number | null;
  claimedPlayerIds: Set<string>;
  playersById: Map<string, Player>;
  convergenceIncrementalFill?: boolean;
  minUpgradeBuyPrice?: number | null;
}) {
  const rows: Array<Record<string, unknown>> = [];
  const picked: AiMarketPlanBuyPlan["candidates"] = [];
  if (input.allowedBuyCount <= 0) {
    return { candidates: picked, rows };
  }

  const slotNeed = getSeasonMaxSlotNeed(input.gameState);
  const rosterBase = input.rosterBase ?? input.team.currentState.rosterCount ?? 0;
  const minRoster = Math.max(input.team.currentState.playerMin ?? 0, 7);
  const playerOpt = input.team.currentState.playerOpt ?? minRoster;
  const atOrAboveOpt = rosterBase >= playerOpt;
  const autoUpgradeFloor =
    atOrAboveOpt && isTeamOverCashSalarySoftTarget(input.gameState, input.team.teamId, input.gameState.season.id)
      ? estimateUpgradeBuyFloorMw(input.gameState, input.team.teamId)
      : null;
  const effectiveMinUpgradeBuyPrice =
    input.minUpgradeBuyPrice != null && input.minUpgradeBuyPrice > 0
      ? input.minUpgradeBuyPrice
      : autoUpgradeFloor;
  const targetRoster = input.convergenceIncrementalFill
    ? Math.max(minRoster, playerOpt)
    : Math.max(minRoster, slotNeed);
  const coverageFallback = rosterBase < targetRoster;
  const convergenceCoverageFill = Boolean(input.convergenceIncrementalFill && coverageFallback);
  const profile = getTeamStrategyProfile(input.gameState, input.team.teamId);
  let cashRemaining =
    convergenceCoverageFill
      ? resolveMarketSpendableCashForPlanner({
          gameState: input.gameState,
          teamId: input.team.teamId,
          teamCash: input.team.currentState.cash,
          rosterBelowMin: true,
          forceRosterFill: true,
        }) ?? input.team.currentState.cash
      : input.team.currentState.cash ?? null;
  const classCounts = buildRosterTokenCounts({
    gameState: input.gameState,
    teamId: input.team.teamId,
    playersById: input.playersById,
    field: "className",
  });
  const raceCounts = buildRosterTokenCounts({
    gameState: input.gameState,
    teamId: input.team.teamId,
    playersById: input.playersById,
    field: "race",
  });
  const watchPlayerIds = buildScoutingWatchPlayerIds(input.gameState, input.team.teamId);
  const blockedCandidateIds = new Set<string>();

  while (picked.length < input.allowedBuyCount) {
    const sorted = rankFinalBuyCandidates({
      gameState: input.gameState,
      teamId: input.team.teamId,
      candidates: input.candidates.filter((candidate) => !blockedCandidateIds.has(candidate.playerId) && !picked.some((entry) => entry.playerId === candidate.playerId)),
      playersById: input.playersById,
      classCounts,
      raceCounts,
      coverageFallback,
      pickedCount: picked.length,
      watchPlayerIds,
    });
    const candidate = sorted[0];
    if (!candidate) break;
    if (picked.length >= input.allowedBuyCount) break;
    const player = input.playersById.get(candidate.playerId) ?? null;
    const hardNoGo = Boolean(profile && player && matchesHardNoGo(profile, player));
    const price = candidate.price ?? candidate.marketValue ?? null;
    const belowUpgradeFloor =
      effectiveMinUpgradeBuyPrice != null &&
      effectiveMinUpgradeBuyPrice > 0 &&
      price != null &&
      price + 0.01 < effectiveMinUpgradeBuyPrice;
    const cashAfter = cashRemaining != null && price != null ? cashRemaining - price : candidate.cashAfter;
    const rosterAfter = rosterBase + picked.length + 1;
    const buffer = getTeamCashBuffer(input.gameState, input.team.teamId, coverageFallback);
    const duplicateClaim = input.claimedPlayerIds.has(candidate.playerId);
    const cashBlocked = cashAfter == null || cashAfter < buffer;
    const reasons = [
      duplicateClaim ? "candidate_already_claimed" : null,
      hardNoGo && !convergenceCoverageFill ? "team_hard_no_go" : null,
      belowUpgradeFloor ? `below_upgrade_floor:${price}<${effectiveMinUpgradeBuyPrice}` : null,
      cashBlocked ? `cash_buffer_failed:${Math.round((cashAfter ?? -999) * 100) / 100}<${Math.round(buffer * 100) / 100}` : null,
    ].filter((entry): entry is string => Boolean(entry));
    const accepted = reasons.length === 0;
    rows.push({
      teamId: input.team.teamId,
      teamName: input.team.teamName,
      playerId: candidate.playerId,
      playerName: candidate.playerName ?? candidate.name,
      rosterBefore: rosterBase,
      rosterAfter,
      targetRoster,
      slotNeed,
      coverageFallback,
      diversityAdjustedScore: getDiversityAdjustedBuyScore({
        candidate,
        gameState: input.gameState,
        teamId: input.team.teamId,
        playersById: input.playersById,
        classCounts,
        raceCounts,
        coverageFallback,
        watchPlayerIds,
      }),
      cashBefore: cashRemaining,
      price,
      cashAfter,
      cashBuffer: buffer,
      score: candidate.overallRecommendationScore ?? candidate.score ?? null,
      status: accepted ? "accepted" : "blocked",
      reasons: reasons.join("|") || "passed",
    });
    if (!accepted) {
      blockedCandidateIds.add(candidate.playerId);
      continue;
    }
    picked.push(candidate);
    input.claimedPlayerIds.add(candidate.playerId);
    const classToken = getCandidateToken(candidate, input.playersById, "className");
    const raceToken = getCandidateToken(candidate, input.playersById, "race");
    if (classToken) classCounts.set(classToken, (classCounts.get(classToken) ?? 0) + 1);
    if (raceToken) raceCounts.set(raceToken, (raceCounts.get(raceToken) ?? 0) + 1);
    if (cashAfter != null) cashRemaining = cashAfter;
  }

  return { candidates: picked, rows };
}

function getAllowedBuyCount(
  team: AiMarketPlanTeamEntry,
  rosterBase: number | null,
  maxBuysPerTeam: number | null,
  opts?: { postOptUpgradeDeploy?: boolean; minUpgradeBuyPrice?: number | null },
) {
  const optionLimit = maxBuysPerTeam ?? Number.POSITIVE_INFINITY;
  const currentRoster = rosterBase ?? team.currentState.rosterCount ?? null;
  const playerMin = team.currentState.playerMin ?? 0;
  const playerOpt = team.currentState.playerOpt ?? playerMin;
  const expiringCount = team.sellPlan.candidates.filter((candidate) => (candidate.contractLength ?? 99) <= 1).length;
  const plannedExpiryNeed = currentRoster == null ? 0 : Math.max(0, playerOpt - Math.max(0, currentRoster - expiringCount));

  if (currentRoster == null) {
    return optionLimit;
  }

  if (currentRoster < playerOpt) {
    return Math.min(Math.max(playerOpt - currentRoster, plannedExpiryNeed, 0), optionLimit);
  }
  if (plannedExpiryNeed > 0) {
    return Math.min(Math.max(plannedExpiryNeed, 1), optionLimit);
  }

  if (currentRoster >= playerOpt && !opts?.postOptUpgradeDeploy) {
    return 0;
  }

  const hasAggressiveOpportunity = team.buyPlan.candidates.length > 0 && getTopBuyCandidateScore(team) >= 65;
  const plannedSellCount = team.sellPlan.candidates.length;
  if (opts?.postOptUpgradeDeploy) {
    const minPrice = opts.minUpgradeBuyPrice ?? 0;
    const upgradeCandidate = team.buyPlan.candidates.find((candidate) => {
      const price = candidate.price ?? candidate.marketValue ?? 0;
      return price + 0.01 >= minPrice;
    });
    if (upgradeCandidate && (plannedSellCount >= 1 || hasAggressiveOpportunity)) {
      return Math.min(1, optionLimit);
    }
  }
  if (plannedSellCount >= 2 && getTopBuyCandidateScore(team) >= 58) {
    return Math.min(2, optionLimit);
  }
  if (plannedSellCount >= 1 && getTopBuyCandidateScore(team) >= 52) {
    return Math.min(1, optionLimit);
  }
  return hasAggressiveOpportunity ? Math.min(1, optionLimit) : 0;
}

function hasValueSellOpportunity(
  gameState: GameState,
  team: GameState["teams"][number],
  _playerMin: number,
  playersById = new Map(gameState.players.map((player) => [player.id, player] as const)),
) {
  const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
  if (roster.length === 0) {
    return false;
  }

  return roster.some((entry) => {
    const player = playersById.get(entry.playerId) ?? null;
    const sale = buildTransfermarktSaleFactorBreakdown(gameState, player, entry);
    const baseValue = sale.baseMarketValue;
    const salePrice = sale.salePrice;
    if (baseValue == null || salePrice == null || baseValue <= 0) {
      return false;
    }

    const profit = salePrice - baseValue;
    const profitRatio = profit / baseValue;
    return profit >= 3 && profitRatio >= 0.1;
  });
}

function getTopBuyCandidateScore(team: AiMarketPlanTeamEntry) {
  return team.buyPlan.candidates[0]?.overallRecommendationScore ?? team.buyPlan.candidates[0]?.score ?? 0;
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function getCandidateToken(candidate: AiMarketPlanBuyPlan["candidates"][number], playersById: Map<string, Player>, field: "className" | "race") {
  const player = playersById.get(candidate.playerId) ?? null;
  const direct = field === "className" ? candidate.className : candidate.race;
  return normalizeTransfermarktToken(direct ?? player?.[field] ?? "");
}

function buildRosterTokenCounts(input: {
  gameState: GameState;
  teamId: string;
  playersById: Map<string, Player>;
  field: "className" | "race";
}) {
  const counts = new Map<string, number>();
  for (const rosterEntry of input.gameState.rosters) {
    if (rosterEntry.teamId !== input.teamId) continue;
    const player = input.playersById.get(rosterEntry.playerId) ?? null;
    const token = normalizeTransfermarktToken(player?.[input.field] ?? "");
    if (!token) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function buildScoutingWatchPlayerIds(gameState: GameState, teamId: string) {
  const watchlistIds = getScoutingWatchlistForTeam(gameState, teamId).map((entry) => entry.playerId);
  const wishlistIds = (gameState.seasonState.transferWishlist ?? [])
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => entry.playerId);
  return new Set([...watchlistIds, ...wishlistIds]);
}

function getDiversityAdjustedBuyScore(input: {
  candidate: AiMarketPlanBuyPlan["candidates"][number];
  gameState: GameState;
  teamId: string;
  playersById: Map<string, Player>;
  classCounts: Map<string, number>;
  raceCounts: Map<string, number>;
  coverageFallback: boolean;
  watchPlayerIds: Set<string>;
}) {
  const baseScore = input.candidate.overallRecommendationScore ?? input.candidate.score ?? 0;
  const classToken = getCandidateToken(input.candidate, input.playersById, "className");
  const raceToken = getCandidateToken(input.candidate, input.playersById, "race");
  const classCount = classToken ? input.classCounts.get(classToken) ?? 0 : 0;
  const raceCount = raceToken ? input.raceCounts.get(raceToken) ?? 0 : 0;
  const noveltyBonus = (classToken && classCount === 0 ? 2.4 : 0) + (raceToken && raceCount === 0 ? 1.1 : 0);
  const repeatPenalty =
    Math.max(0, classCount - 1) * 0.9 +
    Math.max(0, raceCount - 2) * 0.45 +
    (classCount >= 3 ? 2.2 : 0);
  const stableJitter = (getStableUnitHash(`${input.gameState.season.id}:${input.teamId}:${input.candidate.playerId}:buy-window-v2`) - 0.5) * 1.6;
  const coverageValueNudge = input.coverageFallback ? Math.min(1.5, Math.max(0, 6 - (input.candidate.salary ?? 6)) * 0.18) : 0;
  const scoutingWatchBonus = input.watchPlayerIds.has(input.candidate.playerId) ? 5 : 0;
  const intelBonus = getPlayerScoutCertainty(input.gameState, input.teamId, input.candidate.playerId) / 20;
  return baseScore + noveltyBonus + stableJitter + coverageValueNudge + scoutingWatchBonus + intelBonus - repeatPenalty;
}

function rankFinalBuyCandidates(input: {
  gameState: GameState;
  teamId: string;
  candidates: AiMarketPlanBuyPlan["candidates"];
  playersById: Map<string, Player>;
  classCounts: Map<string, number>;
  raceCounts: Map<string, number>;
  coverageFallback: boolean;
  pickedCount: number;
  watchPlayerIds: Set<string>;
}) {
  return [...input.candidates].sort((left, right) => {
    const leftStrategic = left.strategicBuyScore ?? null;
    const rightStrategic = right.strategicBuyScore ?? null;
    if (leftStrategic != null || rightStrategic != null) {
      const leftScore = leftStrategic ?? left.overallRecommendationScore ?? left.score ?? 0;
      const rightScore = rightStrategic ?? right.overallRecommendationScore ?? right.score ?? 0;
      if (rightScore !== leftScore) return rightScore - leftScore;
    }

    const leftBase = left.overallRecommendationScore ?? left.score ?? 0;
    const rightBase = right.overallRecommendationScore ?? right.score ?? 0;
    if (input.pickedCount === 0 && rightBase !== leftBase) return rightBase - leftBase;
    const leftAdjusted = getDiversityAdjustedBuyScore({ ...input, candidate: left });
    const rightAdjusted = getDiversityAdjustedBuyScore({ ...input, candidate: right });
    if (rightAdjusted !== leftAdjusted) return rightAdjusted - leftAdjusted;
    if (input.coverageFallback) {
      const leftPrice = left.price ?? left.marketValue ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.price ?? right.marketValue ?? Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    }
    return left.playerName.localeCompare(right.playerName, "de");
  });
}

function buildResolvedBuyCandidateMap(
  gameState: GameState,
  teams: AiMarketPlanTeamEntry[],
  applyBuySteps: boolean,
  maxBuysPerTeam: number | null,
  playersById = new Map(gameState.players.map((player) => [player.id, player] as const)),
  convergenceIncrementalFill = false,
  buyGateOpts?: { postOptUpgradeDeploy?: boolean; minUpgradeBuyPrice?: number | null },
) {
  const resolved = new Map<string, AiMarketPlanBuyPlan["candidates"]>();
  const gateRows: Array<Record<string, unknown>> = [];
  if (!applyBuySteps) {
    return { resolved, gateRows };
  }

  const claimedPlayerIds = new Set<string>();
  const teamPriority = [...teams].sort((left, right) => {
    const needDelta = getRosterNeedGap(right) - getRosterNeedGap(left);
    if (needDelta !== 0) {
      return needDelta;
    }
    const scoreDelta = getTopBuyCandidateScore(right) - getTopBuyCandidateScore(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  for (const team of teamPriority) {
    const allowedBuyCount = getAllowedBuyCount(
      team,
      team.sellPlan.rosterAfterSell ?? team.currentState.rosterCount,
      maxBuysPerTeam,
      buyGateOpts,
    );
    if (allowedBuyCount <= 0) {
      resolved.set(team.teamId, []);
      continue;
    }
    const gate = buildFinalBuyGate({
      gameState,
      team,
      candidates: team.buyPlan.candidates,
      allowedBuyCount,
      rosterBase: team.sellPlan.rosterAfterSell ?? team.currentState.rosterCount,
      maxBuysPerTeam,
      claimedPlayerIds,
      playersById,
      convergenceIncrementalFill,
      minUpgradeBuyPrice: buyGateOpts?.minUpgradeBuyPrice ?? null,
    });
    gateRows.push(...gate.rows);
    resolved.set(team.teamId, gate.candidates);
  }

  return { resolved, gateRows };
}

function buildEffectiveSellPlan(
  team: AiMarketPlanTeamEntry,
  applySellSteps: boolean,
  maxSellsPerTeam: number | null,
  excludeSellPlayerIds?: string[],
): AiMarketPlanSellPlan {
  const excludeSet = new Set(excludeSellPlayerIds ?? []);
  const candidates = applySellSteps
    ? limitItems(
        team.sellPlan.candidates.filter((candidate) => !excludeSet.has(candidate.playerId)),
        maxSellsPerTeam,
      )
    : [];

  return {
    candidates,
    totalExpectedSellValue: sumNullable(candidates.map((candidate) => candidate.expectedSellValue)),
    salaryFreed: sumNullable(candidates.map((candidate) => candidate.salary)),
    expectedSellValue: sumNullable(candidates.map((candidate) => candidate.expectedSellValue)),
    rosterAfterSell:
      team.currentState.rosterCount != null ? Math.max(0, team.currentState.rosterCount - candidates.length) : null,
    warnings: applySellSteps ? [...team.sellPlan.warnings] : [],
  };
}

function buildEffectiveBuyPlan(
  team: AiMarketPlanTeamEntry,
  applyBuySteps: boolean,
  maxBuysPerTeam: number | null,
  rosterBase: number | null,
  buyCandidateOverride?: AiMarketPlanBuyPlan["candidates"],
  applyBuyStepsInBatch?: number | null,
  excludeBuyPlayerIds?: string[],
  buyGateOpts?: { postOptUpgradeDeploy?: boolean; minUpgradeBuyPrice?: number | null },
): AiMarketPlanBuyPlan {
  const allowedBuyCount = getAllowedBuyCount(team, rosterBase, maxBuysPerTeam, buyGateOpts);
  const batchCap = applyBuyStepsInBatch != null ? Math.min(allowedBuyCount, applyBuyStepsInBatch) : allowedBuyCount;
  const excludeSet = new Set(excludeBuyPlayerIds ?? []);
  const minUpgradeBuyPrice = buyGateOpts?.minUpgradeBuyPrice ?? null;
  const sourceCandidates = (buyCandidateOverride ?? team.buyPlan.candidates).filter(
    (candidate) =>
      !excludeSet.has(candidate.playerId) &&
      (minUpgradeBuyPrice == null ||
        minUpgradeBuyPrice <= 0 ||
        (candidate.price ?? candidate.marketValue ?? 0) + 0.01 >= minUpgradeBuyPrice),
  );
  const candidates = applyBuySteps
    ? limitItems(sourceCandidates, batchCap > 0 ? batchCap : allowedBuyCount)
    : [];

  return {
    candidates,
    plannedSpend: sumNullable(candidates.map((candidate) => candidate.price ?? candidate.marketValue ?? null)),
    plannedSalaryAdded: sumNullable(candidates.map((candidate) => candidate.salary)),
    rosterAfterBuy: rosterBase != null ? rosterBase + candidates.length : null,
    warnings: applyBuySteps ? [...team.buyPlan.warnings] : [],
  };
}

function buildEffectiveProjectedState(currentState: AiMarketPlanCurrentState, sellPlan: AiMarketPlanSellPlan, buyPlan: AiMarketPlanBuyPlan): AiMarketPlanProjectedState {
  return {
    cashAfterPlan:
      currentState.cash != null && buyPlan.plannedSpend != null && (sellPlan.candidates.length === 0 || sellPlan.expectedSellValue != null)
        ? currentState.cash + (sellPlan.expectedSellValue ?? 0) - buyPlan.plannedSpend
        : null,
    rosterAfterPlan:
      currentState.rosterCount != null ? currentState.rosterCount - sellPlan.candidates.length + buyPlan.candidates.length : null,
    salaryAfterPlan:
      currentState.salaryTotal != null && buyPlan.plannedSalaryAdded != null && (sellPlan.candidates.length === 0 || sellPlan.salaryFreed != null)
        ? currentState.salaryTotal - (sellPlan.salaryFreed ?? 0) + buyPlan.plannedSalaryAdded
        : null,
    marketValueAfterPlan:
      currentState.marketValueTotal != null && buyPlan.plannedSpend != null && (sellPlan.candidates.length === 0 || sellPlan.expectedSellValue != null)
        ? currentState.marketValueTotal - (sellPlan.expectedSellValue ?? 0) + buyPlan.plannedSpend
        : null,
  };
}

function buildMarketStateBlockingReasons(input: {
  projectedState: AiMarketPlanProjectedState;
  playerMin: number | null;
  hasMarketActions: boolean;
  enforceRosterMinAfterPlan?: boolean;
  cashReason?: string;
  rosterReason?: string;
}) {
  const reasons: string[] = [];
  if (input.projectedState.cashAfterPlan != null && input.projectedState.cashAfterPlan <= 0) {
    reasons.push(input.cashReason ?? "cash_after_market_plan_not_positive");
  } else if (input.hasMarketActions && input.projectedState.cashAfterPlan == null) {
    reasons.push("cash_after_market_plan_unknown");
  }

  if (
    (input.enforceRosterMinAfterPlan ?? true) &&
    input.playerMin != null &&
    input.projectedState.rosterAfterPlan != null &&
    input.projectedState.rosterAfterPlan < input.playerMin
  ) {
    reasons.push(input.rosterReason ?? "roster_after_market_plan_below_player_min");
  } else if (input.hasMarketActions && input.playerMin != null && input.projectedState.rosterAfterPlan == null) {
    reasons.push("roster_after_market_plan_unknown");
  }

  return reasons;
}

function buildActualMarketStateBlockingReasons(input: {
  cash: number | null;
  roster: number | null;
  playerMin: number | null;
  enforceRosterMinAfterPlan?: boolean;
}) {
  return buildMarketStateBlockingReasons({
    projectedState: {
      cashAfterPlan: input.cash,
      rosterAfterPlan: input.roster,
      salaryAfterPlan: null,
      marketValueAfterPlan: null,
    },
    playerMin: input.playerMin,
    hasMarketActions: true,
    enforceRosterMinAfterPlan: input.enforceRosterMinAfterPlan ?? false,
    cashReason: "post_market_cash_not_positive",
    rosterReason: "post_market_roster_below_player_min",
  });
}

function buildPlannedSellDetails(candidates: AiMarketPlanSellPlan["candidates"]): AiMarketPlanApplyStepResult[] {
  return candidates.map((candidate) => ({
    stepType: "sell",
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    playerName: candidate.playerName,
    amount: candidate.expectedSellValue,
    salaryImpact: candidate.salary,
    rosterImpact: -1,
    status: "planned",
    reason: candidate.reasonToSell.join(" · ") || "Sell-Schritt aus geprueftem AI-Marktplan.",
  }));
}

function buildPlannedBuyDetails(candidates: AiMarketPlanBuyPlan["candidates"]): AiMarketPlanApplyStepResult[] {
  return candidates.map((candidate) => ({
    stepType: "buy",
    playerId: candidate.playerId,
    playerName: candidate.playerName ?? candidate.name,
    amount: candidate.price ?? candidate.marketValue ?? null,
    salaryImpact: candidate.salary,
    rosterImpact: 1,
    status: "planned",
    reason: candidate.reason || candidate.strategyNotes.join(" · ") || "Buy-Schritt aus geprueftem AI-Marktplan.",
  }));
}

function getTeamStateSnapshot(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const roster = gameState.rosters.filter((entry) => entry.teamId === teamId);
  return {
    cash: team?.cash ?? null,
    roster: roster.length,
    salary: roster.reduce((sum, entry) => sum + entry.salary, 0),
    marketValue: roster.reduce((sum, entry) => sum + (entry.currentValue ?? entry.purchasePrice ?? 0), 0),
  };
}

function buildPreflightTeamResult(gameState: GameState, team: GameState["teams"][number]): AiMarketPlanApplyTeamResult {
  const snapshot = getTeamStateSnapshot(gameState, team.teamId);
  const controlMode = getTeamControlSettings(gameState, team.teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
  return {
    teamId: team.teamId,
    teamCode: team.shortCode ?? team.teamId,
    teamName: team.name ?? team.teamId,
    controlMode,
    aiEligible: controlMode === "ai",
    previewStatus: "hold",
    result: controlMode === "manual" ? "skipped_manual" : controlMode === "passive" ? "skipped_passive" : "hold",
    plannedSells: 0,
    plannedBuys: 0,
    executedSells: 0,
    executedBuys: 0,
    currentCash: snapshot.cash,
    projectedCash: snapshot.cash,
    currentRoster: snapshot.roster,
    projectedRoster: snapshot.roster,
    cashBefore: snapshot.cash,
    cashAfter: snapshot.cash,
    rosterBefore: snapshot.roster,
    rosterAfter: snapshot.roster,
    salaryBefore: snapshot.salary,
    salaryAfter: snapshot.salary,
    marketValueBefore: snapshot.marketValue,
    marketValueAfter: snapshot.marketValue,
    plannedSellDetails: [],
    plannedBuyDetails: [],
    appliedSellDetails: [],
    appliedBuyDetails: [],
    skippedSteps: [],
    warnings: [],
    blockingReasons: [],
  };
}

export async function applyAiMarketPlanLocally(input: AiMarketPlanApplyParams): Promise<AiMarketPlanApplyResult> {
  if (input.source === "prisma") {
    throw new Error("Prisma/Supabase mode is read-only in this build.");
  }

  const totalStartedAt = Date.now();
  const dryRun = input.dryRun ?? true;
  if (!dryRun && !isExplicitLocalTransferWindowPhase(input.transferPhase)) {
    throw new Error("AI market apply requires an explicit local transfer window phase.");
  }
  let options = getEffectiveOptions(input);
  const preseasonMarketBuysAllowed = isTransferActionAllowed(input.seasonId, "preseason_market_buy");
  const seasonEndMarketBuysAllowed = isTransferActionAllowed(input.seasonId, "season_end_market_buy");
  const marketBuysAllowed = preseasonMarketBuysAllowed || seasonEndMarketBuysAllowed;
  const executeBuySteps = options.applyBuySteps && marketBuysAllowed;
  const policyWarnings: string[] =
    options.applyBuySteps && !marketBuysAllowed ? ["season_market_buy_forbidden"] : [];
  const includeWarningTeams = options.includeWarningTeams;
  const phaseAudit: AiMarketPhaseAudit[] = [];
  const persistence = input.persistence ?? createPersistenceService();
  const preflightStartedAt = Date.now();
  const preflightSave = input.localRunContext?.save ?? resolveLocalSave(persistence, input.saveId);
  const preflightGameState = preflightSave.gameState;
  const preflightPlayersById = new Map(preflightGameState.players.map((player) => [player.id, player] as const));
  const preflightIdentityByTeamId = new Map(preflightGameState.teamIdentities.map((entry) => [entry.teamId, entry] as const));
  const aiTeamIds = new Set(
    preflightGameState.teams
      .filter((team) => getTeamControlSettings(preflightGameState, team.teamId)?.controlMode === "ai")
      .map((team) => team.teamId),
  );
  const preflightRosterCounts = new Map<string, number>();
  for (const rosterEntry of preflightGameState.rosters) {
    preflightRosterCounts.set(rosterEntry.teamId, (preflightRosterCounts.get(rosterEntry.teamId) ?? 0) + 1);
  }
  const preflightBuyNeedTeamIds = preflightGameState.teams
    .filter((team) => aiTeamIds.has(team.teamId))
    .filter((team) => {
      const identity = preflightIdentityByTeamId.get(team.teamId) ?? null;
      const rosterCount = preflightRosterCounts.get(team.teamId) ?? 0;
      const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
      const expiringCount = preflightGameState.rosters.filter((entry) => entry.teamId === team.teamId && (entry.contractLength ?? 99) <= 1).length;
      const rosterAfterExpiry = Math.max(0, rosterCount - expiringCount);
      if (teamNeedsPostOptUpgradeDeploy(preflightGameState, team.teamId, input.seasonId)) return true;
      return rosterCount < playerOpt || rosterAfterExpiry < playerOpt || rosterAfterExpiry < playerMin;
    })
    .map((team) => team.teamId);
  const preflightSellNeedTeamIds = preflightGameState.teams
    .filter((team) => aiTeamIds.has(team.teamId))
    .filter((team) => {
      const identity = preflightIdentityByTeamId.get(team.teamId) ?? null;
      const rosterCount = preflightRosterCounts.get(team.teamId) ?? 0;
      const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
      const rosterEntries = preflightGameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const expiringCount = rosterEntries.filter((entry) => (entry.contractLength ?? 99) <= 1).length;
      const rosterAfterExpiry = Math.max(0, rosterCount - expiringCount);
      const expiryCreatesOptRisk = expiringCount > 0 && rosterAfterExpiry < playerOpt;
      const salaryTotal = rosterEntries.reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
      const salaryPressure = team.cash > 0 ? salaryTotal / Math.max(team.cash, 1) : salaryTotal > 0 ? 99 : 0;
      const boardPressure = 10 - (preflightIdentityByTeamId.get(team.teamId)?.boardConfidence ?? 5);
      const lowCashBuffer =
        typeof team.cash === "number" && Number.isFinite(team.cash) && team.cash < Math.max(10, salaryTotal * 0.2);
      const expiryNeedsDecision =
        expiringCount > 0 &&
        rosterCount > 0 &&
        (expiryCreatesOptRisk || salaryPressure > 0.6 || boardPressure >= 6 || lowCashBuffer);
      const sellRunway = assessTeamSellRunwayPressure({
        gameState: preflightGameState,
        team,
        salaryTotal,
      });
      return (
        rosterCount > playerOpt ||
        (typeof team.cash === "number" && Number.isFinite(team.cash) && team.cash < 0) ||
        expiryNeedsDecision ||
        salaryPressure > 0.75 ||
        boardPressure >= 6 ||
        sellRunway.cashPressureScore >= 0.45 ||
        hasValueSellOpportunity(preflightGameState, team, playerMin, preflightPlayersById) ||
        hasUpgradeSellOpportunity(preflightGameState, team.teamId, input.seasonId, playerMin)
      );
    })
    .map((team) => team.teamId);
  const preflightMaintenanceTeamIds = preflightGameState.teams
    .filter((team) => aiTeamIds.has(team.teamId))
    .filter((team) => {
      const identity = preflightIdentityByTeamId.get(team.teamId) ?? null;
      const rosterEntries = preflightGameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const expiringCount = rosterEntries.filter((entry) => (entry.contractLength ?? 99) <= 1).length;
      const salaryTotal = rosterEntries.reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
      const salaryPressure = team.cash > 0 ? salaryTotal / Math.max(team.cash, 1) : salaryTotal > 0 ? 99 : 0;
      const budgetStatus = getBudgetStatus(team, {
        salaryTotal,
        identityFinances: identity?.finances ?? null,
        marketSpendableCash: resolveMarketSpendableCashForPlanner({
          gameState: preflightGameState,
          teamId: team.teamId,
          teamCash: team.cash,
          rosterBelowMin: false,
          forceRosterFill: false,
        }),
      });
      return expiringCount > 0 || salaryPressure > 0.5 || budgetStatus !== "healthy";
    })
    .map((team) => team.teamId);
  phaseAudit.push(
    buildPhaseAudit({
      phaseId: "ai_market_preflight",
      status: aiTeamIds.size > 0 ? "ready" : "warning",
      startedAt: preflightStartedAt,
      teamsScanned: preflightGameState.teams.length,
      candidatesScanned: preflightGameState.players.length,
      warnings: aiTeamIds.size > 0 ? [] : ["ai_market_no_ai_teams_in_scope"],
    }),
  );
  // Apply audits the full team set so manual/passive teams stay visible as skipped instead of disappearing.
  const teamScope = "all" as const;
  const season2PlusNeedGate = !/^season-?1$/i.test(input.seasonId);
  const buyLimit = options.applyBuySteps && (!season2PlusNeedGate || preflightBuyNeedTeamIds.length > 0 || preflightMaintenanceTeamIds.length > 0) ? options.previewBuyLimit : 0;
  const sellLimit = options.applySellSteps && (!season2PlusNeedGate || preflightSellNeedTeamIds.length > 0 || preflightMaintenanceTeamIds.length > 0) ? options.previewSellLimit : 0;
  if (season2PlusNeedGate && buyLimit === 0 && sellLimit === 0) {
    const results = preflightGameState.teams.map((team) => buildPreflightTeamResult(preflightGameState, team));
    const summary: AiMarketPlanApplySummary = {
      totalTeams: results.length,
      eligibleAiTeams: results.filter((entry) => entry.aiEligible).length,
      skippedManual: results.filter((entry) => entry.result === "skipped_manual").length,
      skippedPassive: results.filter((entry) => entry.result === "skipped_passive").length,
      skippedDisabled: 0,
      plannedSells: 0,
      plannedBuys: 0,
      blockedSells: 0,
      blockedBuys: 0,
      appliedSells: 0,
      appliedBuys: 0,
      warningTeams: 0,
      blockedTeams: 0,
      holdTeams: results.filter((entry) => entry.result === "hold").length,
      existingHistoryWrites: 0,
      plannedWrites: 0,
      projectedCash: Object.fromEntries(results.map((entry) => [entry.teamId, entry.projectedCash])),
      projectedRoster: Object.fromEntries(results.map((entry) => [entry.teamId, entry.projectedRoster])),
    };
    phaseAudit.push(
      buildPhaseAudit({ phaseId: "ai_sell_scan", status: "skipped", startedAt: totalStartedAt, teamsScanned: 0, candidatesScanned: 0, scanLimit: sellLimit }),
      buildAiRenewalScanPhaseAudit({ save: preflightSave, startedAt: totalStartedAt, teamId: input.teamId }),
      buildPhaseAudit({ phaseId: "ai_buy_need_scan", status: "ready", startedAt: totalStartedAt, teamsScanned: preflightGameState.teams.length, candidatesScanned: 0 }),
      buildPhaseAudit({ phaseId: "ai_buy_candidate_scan", status: "skipped", startedAt: totalStartedAt, teamsScanned: 0, candidatesScanned: 0, scanLimit: buyLimit }),
      buildPhaseAudit({ phaseId: "ai_sell_apply", status: "skipped", startedAt: totalStartedAt }),
      buildPhaseAudit({ phaseId: "ai_renewal_apply", status: "skipped", startedAt: totalStartedAt, warnings: ["renewals_apply_in_contract_tick"] }),
      buildPhaseAudit({ phaseId: "ai_buy_apply", status: "skipped", startedAt: totalStartedAt }),
      buildPhaseAudit({ phaseId: "ai_market_summary", status: "ready", startedAt: totalStartedAt, teamsScanned: results.length, candidatesScanned: 0 }),
    );
    return {
      source: "sqlite",
      readOnly: dryRun,
      dryRun,
      executed: !dryRun,
      status: dryRun ? "ready" : "applied",
      scope: {
        saveId: preflightSave.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId ?? null,
        teamScope,
      },
      saveContext: {
        source: "sqlite",
        requestedSaveId: input.saveId ?? null,
        resolvedSaveId: preflightSave.saveId,
        requestedSeasonId: input.seasonId ?? null,
        resolvedSeasonId: input.seasonId,
        saveName: preflightSave.name ?? null,
        saveStatus: preflightSave.status ?? null,
        scopeWarning: null,
      },
      summary,
      teams: results,
      results,
      warnings: [],
      blockingReasons: [],
      phaseAudit,
      plannedWrites: [],
      appliedAudits: [],
      auditLogId: null,
    };
  }
  const targetedNeedTeamIds = unique([...preflightBuyNeedTeamIds, ...preflightSellNeedTeamIds]);
  const previewTeamId = input.teamId ?? (season2PlusNeedGate && targetedNeedTeamIds.length === 1 ? targetedNeedTeamIds[0] ?? null : null);
  const previewParams: AiMarketPlanPreviewParams = {
    source: "sqlite",
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: previewTeamId,
    teamScope,
    buyLimit,
    sellLimit,
    fullScoringLimit: buyLimit > 0 ? Math.min(48, Math.max(24, buyLimit)) : null,
    buyNeedOnly: true,
    forceBuyScanTeamIds: unique([
      ...(options.forceBuyScanTeamIds ?? []),
      ...preflightSellNeedTeamIds,
      ...preflightBuyNeedTeamIds,
    ]),
  };
  recordPhase("preflight", Date.now() - totalStartedAt);
  const scanStartedAt = Date.now();
  const preview = await buildAiMarketPlanPreview({
    ...previewParams,
    localRunContext: input.localRunContext ?? undefined,
    gameState: preflightGameState,
  });
  recordPhase("marketPlanPreview", Date.now() - scanStartedAt);
  const baselineCloneStartedAt = Date.now();
  const baselineGameState = dryRun
    ? preflightGameState
    : options.transferWindowCycleMode && input.localRunContext
      ? input.localRunContext.save.gameState
      : structuredClone(resolveLocalSave(persistence, preview.scope.saveId).gameState);
  recordPhase("baselineClone", Date.now() - baselineCloneStartedAt);
  const baselinePlayersById = dryRun
    ? preflightPlayersById
    : new Map(baselineGameState.players.map((player) => [player.id, player] as const));
  const sellCandidateCount = preview.teams.reduce((sum, team) => sum + team.sellPlan.candidates.length, 0);
  const buyNeedTeams = preview.teams.filter((team) => getRosterNeedGap(team) > 0 || team.buyPlan.candidates.length > 0);
  const buyCandidateCount = preview.teams.reduce((sum, team) => sum + team.buyPlan.candidates.length, 0);
  const scanElapsed = Date.now() - scanStartedAt;
  const renewalScanStartedAt = Date.now();
  // The renewal scan is informational only (renewals apply in the season-end contract tick, not here).
  // Inside a transfer-window cycle this previewSeasonEndContracts() pass is recomputed on every team
  // cycle and dominates runtime, so skip it in cycle mode and emit a lightweight skipped audit.
  const renewalScanPhaseAudit = options.transferWindowCycleMode && process.env.OLY_TW_DISABLE_RENEWAL_SKIP !== "1"
    ? buildPhaseAudit({
        phaseId: "ai_renewal_scan",
        status: "skipped",
        startedAt: scanStartedAt,
        warnings: ["renewals_apply_in_contract_tick"],
      })
    : buildAiRenewalScanPhaseAudit({ save: preflightSave, startedAt: scanStartedAt, teamId: previewTeamId });
  recordPhase("renewalScan", Date.now() - renewalScanStartedAt);
  phaseAudit.push(
    buildPhaseAudit({
      phaseId: "ai_sell_scan",
      status: options.applySellSteps ? "ready" : "skipped",
      startedAt: scanStartedAt,
      teamsScanned: preview.teams.length,
      candidatesScanned: sellCandidateCount,
      scanLimit: previewParams.sellLimit ?? null,
    }),
    renewalScanPhaseAudit,
    buildPhaseAudit({
      phaseId: "ai_buy_need_scan",
      status: options.applyBuySteps ? "ready" : "skipped",
      startedAt: scanStartedAt,
      teamsScanned: preview.teams.length,
      candidatesScanned: preflightBuyNeedTeamIds.length,
    }),
    buildPhaseAudit({
      phaseId: "ai_buy_candidate_scan",
      status: previewParams.buyLimit === 0 ? "skipped" : scanElapsed > options.performanceBudgetMs ? "warning" : options.applyBuySteps ? "ready" : "skipped",
      startedAt: scanStartedAt,
      teamsScanned: previewParams.buyLimit === 0 ? 0 : buyNeedTeams.length,
      candidatesScanned: buyCandidateCount,
      scanLimit: previewParams.buyLimit ?? null,
      warnings: scanElapsed > options.performanceBudgetMs ? ["ai_market_candidate_scan_over_budget"] : [],
    }),
  );
  const buyGateStartedAt = Date.now();
  const finalBuyGate = buildResolvedBuyCandidateMap(
    baselineGameState,
    preview.teams,
    options.applyBuySteps,
    options.maxBuysPerTeam,
    baselinePlayersById,
    options.convergenceIncrementalFill,
    {
      postOptUpgradeDeploy: options.postOptUpgradeDeploy,
      minUpgradeBuyPrice: options.minUpgradeBuyPrice,
    },
  );
  recordPhase("buildResolvedBuyCandidateMap", Date.now() - buyGateStartedAt);
  const resolvedBuyCandidateMap = finalBuyGate.resolved;
  const results: AiMarketPlanApplyTeamResult[] = [];
  const plannedWrites: AiMarketPlanApplyResult["plannedWrites"] = [];
  const appliedAudits: string[] = [];
  let abortedAfterFailure = false;
  let abortedByTeamId: string | null = null;
  const applyStartedAt = Date.now();
  const transferRunContext = dryRun
    ? null
    : (input.localRunContext ??
      createLocalTransfermarktRunContext({
        persistence,
        save: resolveLocalSave(persistence, preview.scope.saveId),
      }));

  for (const [teamIndex, team] of preview.teams.entries()) {
    const nextResult = buildBaseTeamResult(team);
    const applyElapsedAtTeamStartMs = Date.now() - applyStartedAt;
    if (options.maxApplyMs != null && applyElapsedAtTeamStartMs > options.maxApplyMs) {
      nextResult.result = "hold";
      nextResult.plannedSellDetails = [];
      nextResult.plannedBuyDetails = [];
      nextResult.plannedSells = 0;
      nextResult.plannedBuys = 0;
      nextResult.projectedCash = nextResult.cashBefore;
      nextResult.projectedRoster = nextResult.rosterBefore;
      nextResult.cashAfter = nextResult.cashBefore;
      nextResult.rosterAfter = nextResult.rosterBefore;
      nextResult.salaryAfter = nextResult.salaryBefore;
      nextResult.marketValueAfter = nextResult.marketValueBefore;
      nextResult.warnings = unique([
        ...nextResult.warnings,
        `AI-Markt Apply-Zeitbudget nach ${applyElapsedAtTeamStartMs}ms erreicht; Team bleibt fuer Resume/Repair unveraendert.`,
        "ai_market_apply_budget_soft_stop",
      ]);
      results.push(nextResult);
      continue;
    }
    const effectiveSellPlan = buildEffectiveSellPlan(
      team,
      options.applySellSteps,
      options.maxSellsPerTeam,
      options.excludeSellPlayerIds,
    );
    const effectiveBuyPlan = buildEffectiveBuyPlan(
      team,
      options.applyBuySteps,
      options.maxBuysPerTeam,
      effectiveSellPlan.rosterAfterSell ?? team.currentState.rosterCount,
      resolvedBuyCandidateMap.get(team.teamId),
      options.applyBuyStepsInBatch,
      options.excludeBuyPlayerIds,
      {
        postOptUpgradeDeploy: options.postOptUpgradeDeploy,
        minUpgradeBuyPrice: options.minUpgradeBuyPrice,
      },
    );
    const effectiveProjectedState = buildEffectiveProjectedState(team.currentState, effectiveSellPlan, effectiveBuyPlan);
    nextResult.plannedSellDetails = buildPlannedSellDetails(effectiveSellPlan.candidates);
    nextResult.plannedBuyDetails = buildPlannedBuyDetails(effectiveBuyPlan.candidates);
    nextResult.plannedSells = nextResult.plannedSellDetails.length;
    nextResult.plannedBuys = nextResult.plannedBuyDetails.length;
    if (effectiveSellPlan.warnings.length > 0) {
      nextResult.warnings = unique([...nextResult.warnings, ...effectiveSellPlan.warnings]);
    }
    if (effectiveBuyPlan.warnings.length > 0) {
      nextResult.warnings = unique([...nextResult.warnings, ...effectiveBuyPlan.warnings]);
    }
    const teamGateRows = finalBuyGate.gateRows.filter((row) => row.teamId === team.teamId);
    const blockedGateRows = teamGateRows.filter((row) => row.status === "blocked");
    if (blockedGateRows.length > 0) {
      nextResult.warnings = unique([
        ...nextResult.warnings,
        `planner_final_gate_blocked_candidates:${blockedGateRows.length}`,
      ]);
      const cashGateBlocked = blockedGateRows.some((row) => String(row.reasons ?? "").includes("cash_buffer_failed"));
      if (effectiveBuyPlan.candidates.length === 0 && team.buyPlan.candidates.length > 0 && cashGateBlocked) {
        nextResult.blockingReasons = unique([...nextResult.blockingReasons, "cash_after_market_plan_not_positive"]);
      }
    }
    nextResult.projectedCash = effectiveProjectedState.cashAfterPlan;
    nextResult.projectedRoster = effectiveProjectedState.rosterAfterPlan;
    nextResult.cashAfter = effectiveProjectedState.cashAfterPlan;
    nextResult.rosterAfter = effectiveProjectedState.rosterAfterPlan;
    nextResult.salaryAfter = effectiveProjectedState.salaryAfterPlan;
    nextResult.marketValueAfter = effectiveProjectedState.marketValueAfterPlan;
    const rosterBaseForCoverage = effectiveSellPlan.rosterAfterSell ?? team.currentState.rosterCount ?? 0;
    const slotNeedForCoverage = getSeasonMaxSlotNeed(baselineGameState);
    const identityPlayerMin =
      baselineGameState.teamIdentities.find((entry) => entry.teamId === team.teamId)?.playerMin ??
      team.currentState.playerMin ??
      7;
    const identityPlayerOpt = team.currentState.playerOpt ?? identityPlayerMin;
    const coverageTargetRoster = options.convergenceIncrementalFill
      ? Math.max(identityPlayerMin, 7, identityPlayerOpt)
      : Math.max(identityPlayerMin, 7, slotNeedForCoverage);
    const coverageFallback = rosterBaseForCoverage < coverageTargetRoster;
    const convergenceCoverageFill = options.convergenceIncrementalFill && coverageFallback;
    const hardNoGoBuyReasons = buildHardNoGoBuyReasons(
      baselineGameState,
      team,
      effectiveBuyPlan.candidates,
      baselinePlayersById,
      convergenceCoverageFill,
    );
    const rawHardNoGoBuyReasons = buildHardNoGoBuyReasons(
      baselineGameState,
      team,
      team.buyPlan.candidates,
      baselinePlayersById,
      convergenceCoverageFill,
    );
    const missingSellValue = effectiveSellPlan.candidates.some((candidate) => candidate.expectedSellValue == null);
    const hasMarketActions = effectiveSellPlan.candidates.length + effectiveBuyPlan.candidates.length > 0;
    const enforcementPlayerMin =
      options.convergenceIncrementalFill && coverageFallback ? identityPlayerMin : team.currentState.playerMin;
    const preApplyStateBlockingReasons = buildMarketStateBlockingReasons({
      projectedState: effectiveProjectedState,
      playerMin: enforcementPlayerMin,
      hasMarketActions,
      enforceRosterMinAfterPlan: executeBuySteps && effectiveBuyPlan.candidates.length > 0,
    });
    const partialNegativeCashRepair =
      team.currentState.cash != null &&
      team.currentState.cash < 0 &&
      effectiveSellPlan.candidates.length > 0 &&
      effectiveProjectedState.cashAfterPlan != null &&
      effectiveProjectedState.cashAfterPlan > team.currentState.cash &&
      (team.currentState.playerMin == null ||
        effectiveProjectedState.rosterAfterPlan == null ||
        effectiveProjectedState.rosterAfterPlan >= team.currentState.playerMin);
    const effectivePreApplyStateBlockingReasons = partialNegativeCashRepair
      ? preApplyStateBlockingReasons.filter((reason) => reason !== "cash_after_market_plan_not_positive")
      : preApplyStateBlockingReasons;
    if (partialNegativeCashRepair && preApplyStateBlockingReasons.includes("cash_after_market_plan_not_positive")) {
      nextResult.blockingReasons = nextResult.blockingReasons.filter(
        (reason) =>
          reason !== "cash_after_market_plan_not_positive" &&
          reason !== "negative_cash_unresolved_after_safe_sells",
      );
      nextResult.warnings = unique([
        ...nextResult.warnings,
        "negative_cash_partial_repair_applied",
        "Teamcash bleibt nach sicheren Verkaeufen ggf. negativ, aber der Marktplan verbessert die Lage und wird nicht hart blockiert.",
      ]);
    }
    const duplicateBuysAvoided = team.buyPlan.candidates.length - effectiveBuyPlan.candidates.length;
    if (duplicateBuysAvoided > 0) {
      nextResult.warnings = unique([
        ...nextResult.warnings,
        `${duplicateBuysAvoided} kollidierende AI-Kaufziele wurden fuer diesen Save uebersprungen.`,
      ]);
    }
    const applyElapsedMs = Date.now() - applyStartedAt;
    if (options.progressLog) {
      console.error(
        `[ai-market] apply ${preview.scope.seasonId}: ${teamIndex + 1}/${preview.teams.length} ${team.teamCode} sells=${effectiveSellPlan.candidates.length} buys=${effectiveBuyPlan.candidates.length} elapsed=${applyElapsedMs}ms`,
      );
    }

    if (options.maxApplyMs != null && applyElapsedMs > options.maxApplyMs) {
      nextResult.result = "hold";
      nextResult.plannedSellDetails = [];
      nextResult.plannedBuyDetails = [];
      nextResult.plannedSells = 0;
      nextResult.plannedBuys = 0;
      nextResult.projectedCash = nextResult.cashBefore;
      nextResult.projectedRoster = nextResult.rosterBefore;
      nextResult.cashAfter = nextResult.cashBefore;
      nextResult.rosterAfter = nextResult.rosterBefore;
      nextResult.salaryAfter = nextResult.salaryBefore;
      nextResult.marketValueAfter = nextResult.marketValueBefore;
      nextResult.warnings = unique([
        ...nextResult.warnings,
        `AI-Markt Apply-Zeitbudget nach ${applyElapsedMs}ms erreicht; Team bleibt fuer Resume/Repair unveraendert.`,
        "ai_market_apply_budget_soft_stop",
      ]);
      results.push(nextResult);
      continue;
    }

    if (abortedAfterFailure) {
      nextResult.result = "blocked";
      nextResult.blockingReasons = unique([...nextResult.blockingReasons, "execution_aborted_after_team_failure"]);
      nextResult.warnings = unique([
        ...nextResult.warnings,
        abortedByTeamId ? `Voriger Team-Fehler bei ${abortedByTeamId} hat den Rest des Applies gestoppt.` : "Voriger Team-Fehler hat den Rest des Applies gestoppt.",
      ]);
      results.push(nextResult);
      continue;
    }

    if (team.controlMode === "manual") {
      nextResult.result = "skipped_manual";
      nextResult.blockingReasons = ["team_control_mode_manual"];
      nextResult.warnings = [];
      nextResult.plannedSellDetails = [];
      nextResult.plannedBuyDetails = [];
      nextResult.plannedSells = 0;
      nextResult.plannedBuys = 0;
      nextResult.projectedCash = nextResult.cashBefore;
      nextResult.projectedRoster = nextResult.rosterBefore;
      nextResult.cashAfter = nextResult.cashBefore;
      nextResult.rosterAfter = nextResult.rosterBefore;
      nextResult.salaryAfter = nextResult.salaryBefore;
      nextResult.marketValueAfter = nextResult.marketValueBefore;
      results.push(nextResult);
      continue;
    }

    if (team.controlMode === "passive") {
      nextResult.result = "skipped_passive";
      nextResult.blockingReasons = ["team_control_mode_passive"];
      nextResult.warnings = [];
      nextResult.plannedSellDetails = [];
      nextResult.plannedBuyDetails = [];
      nextResult.plannedSells = 0;
      nextResult.plannedBuys = 0;
      nextResult.projectedCash = nextResult.cashBefore;
      nextResult.projectedRoster = nextResult.rosterBefore;
      nextResult.cashAfter = nextResult.cashBefore;
      nextResult.rosterAfter = nextResult.rosterBefore;
      nextResult.salaryAfter = nextResult.salaryBefore;
      nextResult.marketValueAfter = nextResult.marketValueBefore;
      results.push(nextResult);
      continue;
    }

    nextResult.aiEligible = team.aiTransferPreviewEnabled && team.aiSellPreviewEnabled;
    if (!nextResult.aiEligible) {
      nextResult.result = "skipped_disabled";
      nextResult.blockingReasons = unique([
        !team.aiTransferPreviewEnabled ? "ai_transfer_preview_disabled" : null,
        !team.aiSellPreviewEnabled ? "ai_sell_preview_disabled" : null,
      ]);
      results.push(nextResult);
      continue;
    }

    if (hardNoGoBuyReasons.length > 0) {
      nextResult.result = "hold";
      nextResult.plannedBuyDetails = [];
      nextResult.plannedBuys = 0;
      nextResult.projectedCash = effectiveProjectedState.cashAfterPlan ?? team.currentState.cash;
      nextResult.projectedRoster = effectiveSellPlan.rosterAfterSell ?? team.currentState.rosterCount;
      nextResult.cashAfter = nextResult.projectedCash;
      nextResult.rosterAfter = nextResult.projectedRoster;
      nextResult.warnings = unique([
        ...nextResult.warnings,
        ...hardNoGoBuyReasons,
        "Teamprofil blockiert geplante Kaufziele; Team kauft in diesem Schritt nicht.",
      ]);
      results.push(nextResult);
      continue;
    }

    if (effectiveBuyPlan.candidates.length === 0 && rawHardNoGoBuyReasons.length > 0 && team.buyPlan.candidates.length > 0) {
      nextResult.result = "hold";
      nextResult.warnings = unique([
        ...nextResult.warnings,
        ...rawHardNoGoBuyReasons,
        "Teamprofil blockiert alle Kaufziele; Team kauft in diesem Schritt nicht.",
      ]);
      results.push(nextResult);
      continue;
    }

    if (missingSellValue) {
      nextResult.result = "blocked";
      nextResult.blockingReasons = unique([
        ...nextResult.blockingReasons,
        "sell_plan_missing_expected_value",
      ]);
      results.push(nextResult);
      continue;
    }

    if (effectivePreApplyStateBlockingReasons.length > 0) {
      nextResult.result = "blocked";
      nextResult.blockingReasons = unique([
        ...nextResult.blockingReasons,
        ...effectivePreApplyStateBlockingReasons,
      ]);
      results.push(nextResult);
      continue;
    }

    if (team.status === "blocked" || team.blockingReasons.length > 0) {
      const resolvedByEffectivePlan = effectivePreApplyStateBlockingReasons.length === 0 && hasMarketActions;
      if (!resolvedByEffectivePlan) {
        nextResult.result = "blocked";
        results.push(nextResult);
        continue;
      }
      nextResult.warnings = unique([
        ...nextResult.warnings,
        "preview_block_resolved_by_effective_market_plan",
        ...team.blockingReasons.map((reason) => `preview_block:${reason}`),
      ]);
    }

    if (team.status === "warning" && !includeWarningTeams) {
      nextResult.result = "skipped_warning";
      results.push(nextResult);
      continue;
    }

    if (dryRun) {
      plannedWrites.push(
        ...nextResult.plannedSellDetails.map((step) => ({
          teamId: team.teamId,
          stepType: step.stepType,
          playerId: step.playerId,
          playerName: step.playerName,
        })),
        ...nextResult.plannedBuyDetails.map((step) => ({
          teamId: team.teamId,
          stepType: step.stepType,
          playerId: step.playerId,
          playerName: step.playerName,
        })),
      );
      nextResult.result =
        nextResult.plannedSells + nextResult.plannedBuys > 0
          ? "planned"
          : "hold";
      results.push(nextResult);
      continue;
    }

    const resetTransferRunContext = (snapshot: GameState) => {
      if (!transferRunContext) {
        rollbackTeamState(persistence, preview.scope.saveId, snapshot);
        return;
      }
      transferRunContext.save = {
        ...transferRunContext.save,
        gameState: snapshot,
      };
    };
    const beforeTeamRunCloneStartedAt = Date.now();
    const beforeTeamRun = structuredClone((transferRunContext?.save.gameState ?? resolveLocalSave(persistence, preview.scope.saveId).gameState));
    recordPhase("beforeTeamRunClone", Date.now() - beforeTeamRunCloneStartedAt);
    let teamFailed = false;

    for (const candidate of effectiveSellPlan.candidates) {
      const sellPreview = previewLocalTransfermarktSell({
        saveId: preview.scope.saveId,
        seasonId: preview.scope.seasonId,
        teamId: team.teamId,
        activePlayerId: candidate.activePlayerId,
        transferSource: "ai_preseason_market_sell",
        localRunContext: transferRunContext,
      });

      if (!sellPreview.canSell || sellPreview.salePrice == null) {
        resetTransferRunContext(beforeTeamRun);
        nextResult.result = "failed_sell";
        nextResult.blockingReasons = unique([
          ...nextResult.blockingReasons,
          ...sellPreview.blockingReasons,
          sellPreview.salePrice == null ? "sell_preview_missing_sale_price" : null,
        ]);
        nextResult.skippedSteps.push({
          stepType: "sell",
          playerId: candidate.playerId,
          activePlayerId: candidate.activePlayerId,
          playerName: candidate.playerName,
          amount: candidate.expectedSellValue,
          salaryImpact: candidate.salary,
          rosterImpact: -1,
          status: "blocked",
          reason: "Sell-Preview blockiert oder ohne echten Verkaufswert.",
        });
        teamFailed = true;
        break;
      }

      const sellResult = executeLocalTransfermarktSell({
        saveId: preview.scope.saveId,
        seasonId: preview.scope.seasonId,
        teamId: team.teamId,
        activePlayerId: candidate.activePlayerId,
        transferSource: "ai_preseason_market_sell",
        localRunContext: transferRunContext,
        deferPersist: Boolean(transferRunContext),
      });

      if (!sellResult.canSell || !sellResult.transferCreated) {
        resetTransferRunContext(beforeTeamRun);
        nextResult.result = "failed_sell";
        nextResult.blockingReasons = unique([
          ...nextResult.blockingReasons,
          ...sellResult.blockingReasons,
          "sell_execute_failed",
        ]);
        nextResult.skippedSteps.push({
          stepType: "sell",
          playerId: candidate.playerId,
          activePlayerId: candidate.activePlayerId,
          playerName: candidate.playerName,
          amount: candidate.expectedSellValue,
          salaryImpact: candidate.salary,
          rosterImpact: -1,
          status: "blocked",
          reason: "Lokaler Sell-Service konnte den Schritt nicht schreiben.",
        });
        teamFailed = true;
        break;
      }

      nextResult.executedSells += 1;
      nextResult.appliedSellDetails.push({
        stepType: "sell",
        playerId: candidate.playerId,
        activePlayerId: candidate.activePlayerId,
        playerName: candidate.playerName,
        amount: sellResult.salePrice,
        salaryImpact: candidate.salary,
        rosterImpact: -1,
        status: "applied",
        reason: "Verkauf lokal ausgefuehrt.",
      });
    }

    if (teamFailed) {
      if (options.stopOnTeamFailure) {
        resetTransferRunContext(baselineGameState);
        abortedAfterFailure = true;
        abortedByTeamId = team.teamId;
        for (const previous of results) {
          if (previous.result === "applied") {
            previous.result = "blocked";
            previous.executedSells = 0;
            previous.executedBuys = 0;
            previous.appliedSellDetails = [];
            previous.appliedBuyDetails = [];
            previous.cashAfter = previous.cashBefore;
            previous.rosterAfter = previous.rosterBefore;
            previous.salaryAfter = previous.salaryBefore;
            previous.marketValueAfter = previous.marketValueBefore;
            previous.blockingReasons = unique([...previous.blockingReasons, "execution_rolled_back_after_team_failure"]);
            previous.warnings = unique([...previous.warnings, `Rollback nach Team-Fehler bei ${team.teamName}.`]);
          }
        }
      }
      results.push(nextResult);
      if (options.stopOnTeamFailure) {
        break;
      }
      continue;
    }

    for (const candidate of executeBuySteps ? effectiveBuyPlan.candidates : []) {
      const candidatePlayer = preflightGameState.players.find((player) => player.id === candidate.playerId) ?? null;
      const contractOffer = recommendContractOfferForPlayer({
        player: candidatePlayer,
        teamStrategyProfile: getTeamStrategyProfile(preflightGameState, team.teamId),
        teamIdentity: preflightIdentityByTeamId.get(team.teamId) ?? null,
        teamCash: nextResult.cashAfter ?? nextResult.cashBefore ?? team.currentState.cash,
        marketValue: candidate.price ?? candidate.marketValue,
        teamFit: candidate.teamFit ?? null,
        currentTeamSalary: nextResult.salaryAfter ?? nextResult.salaryBefore ?? team.currentState.salaryTotal,
        dealRole: candidate.reason ?? candidate.needMatchLabel ?? null,
        rosterCountBefore: nextResult.rosterAfter ?? nextResult.rosterBefore ?? team.currentState.rosterCount,
        teamRosterMin: team.currentState.playerMin,
        teamRosterOpt: team.currentState.playerOpt,
        isFirstSeason: preview.scope.seasonId === "season-1",
      });
      const buyPreview = previewLocalTransfermarktBuy({
        saveId: preview.scope.saveId,
        seasonId: preview.scope.seasonId,
        teamId: team.teamId,
        playerId: candidate.playerId,
        contractLength: contractOffer.contractLength,
        contractShape: contractOffer.contractShape,
        transferSource: "ai_preseason_market_buy",
        localRunContext: transferRunContext,
      });

      if (!buyPreview.canBuy) {
        if (!(options.transferWindowCycleMode && nextResult.executedSells > 0)) {
          resetTransferRunContext(beforeTeamRun);
        }
        nextResult.result = options.transferWindowCycleMode && nextResult.executedSells > 0 ? "applied" : "failed_buy";
        nextResult.blockingReasons = unique([
          ...nextResult.blockingReasons,
          ...buyPreview.blockingReasons,
          "buy_preview_blocked",
        ]);
        nextResult.skippedSteps.push({
          stepType: "buy",
          playerId: candidate.playerId,
          playerName: candidate.playerName ?? candidate.name,
          amount: candidate.price ?? candidate.marketValue ?? null,
          salaryImpact: candidate.salary,
          rosterImpact: 1,
          status: "blocked",
          reason: "Buy-Preview blockiert den Schritt.",
        });
        teamFailed = true;
        break;
      }

      const buyResult = executeLocalTransfermarktBuy({
        saveId: preview.scope.saveId,
        seasonId: preview.scope.seasonId,
        teamId: team.teamId,
        playerId: candidate.playerId,
        contractLength: contractOffer.contractLength,
        contractShape: contractOffer.contractShape,
        transferSource: "ai_preseason_market_buy",
        localRunContext: transferRunContext,
        deferPersist: Boolean(transferRunContext),
        fastLocalBatch: Boolean(transferRunContext),
      });

      if (!buyResult.canBuy || !buyResult.transferCreated) {
        if (!(options.transferWindowCycleMode && nextResult.executedSells > 0)) {
          resetTransferRunContext(beforeTeamRun);
        }
        nextResult.result = options.transferWindowCycleMode && nextResult.executedSells > 0 ? "applied" : "failed_buy";
        nextResult.blockingReasons = unique([
          ...nextResult.blockingReasons,
          ...buyResult.blockingReasons,
          "buy_execute_failed",
        ]);
        nextResult.skippedSteps.push({
          stepType: "buy",
          playerId: candidate.playerId,
          playerName: candidate.playerName ?? candidate.name,
          amount: candidate.price ?? candidate.marketValue ?? null,
          salaryImpact: candidate.salary,
          rosterImpact: 1,
          status: "blocked",
          reason: "Lokaler Buy-Service konnte den Schritt nicht schreiben.",
        });
        teamFailed = true;
        break;
      }

      nextResult.executedBuys += 1;
      nextResult.appliedBuyDetails.push({
        stepType: "buy",
        playerId: candidate.playerId,
        playerName: candidate.playerName ?? candidate.name,
        amount: buyResult.purchasePrice,
        salaryImpact: candidate.salary,
        rosterImpact: 1,
        status: "applied",
        reason: "Kauf lokal ausgefuehrt.",
      });
    }

    if (teamFailed) {
      if (options.stopOnTeamFailure) {
        resetTransferRunContext(baselineGameState);
        abortedAfterFailure = true;
        abortedByTeamId = team.teamId;
        for (const previous of results) {
          if (previous.result === "applied") {
            previous.result = "blocked";
            previous.executedSells = 0;
            previous.executedBuys = 0;
            previous.appliedSellDetails = [];
            previous.appliedBuyDetails = [];
            previous.cashAfter = previous.cashBefore;
            previous.rosterAfter = previous.rosterBefore;
            previous.salaryAfter = previous.salaryBefore;
            previous.marketValueAfter = previous.marketValueBefore;
            previous.blockingReasons = unique([...previous.blockingReasons, "execution_rolled_back_after_team_failure"]);
            previous.warnings = unique([...previous.warnings, `Rollback nach Team-Fehler bei ${team.teamName}.`]);
          }
        }
      }
      results.push(nextResult);
      if (options.stopOnTeamFailure) {
        break;
      }
      continue;
    }

    const currentGameState = transferRunContext?.save.gameState ?? resolveLocalSave(persistence, preview.scope.saveId).gameState;
    const snapshotAfterTeam = getTeamStateSnapshot(currentGameState, team.teamId);
    nextResult.cashAfter = snapshotAfterTeam.cash;
    nextResult.rosterAfter = snapshotAfterTeam.roster;
    nextResult.salaryAfter = snapshotAfterTeam.salary;
    nextResult.marketValueAfter = snapshotAfterTeam.marketValue;
    const postApplyStateBlockingReasons = buildActualMarketStateBlockingReasons({
      cash: snapshotAfterTeam.cash,
      roster: snapshotAfterTeam.roster,
      playerMin: enforcementPlayerMin,
      enforceRosterMinAfterPlan: nextResult.executedBuys > 0,
    });
    const postApplyPartialNegativeCashRepair =
      partialNegativeCashRepair &&
      snapshotAfterTeam.cash != null &&
      team.currentState.cash != null &&
      snapshotAfterTeam.cash > team.currentState.cash &&
      (team.currentState.playerMin == null ||
        snapshotAfterTeam.roster == null ||
        snapshotAfterTeam.roster >= team.currentState.playerMin);
    const effectivePostApplyStateBlockingReasons = postApplyPartialNegativeCashRepair
      ? postApplyStateBlockingReasons.filter((reason) => reason !== "post_market_cash_not_positive")
      : postApplyStateBlockingReasons;
    if (postApplyPartialNegativeCashRepair && postApplyStateBlockingReasons.includes("post_market_cash_not_positive")) {
      nextResult.warnings = unique([
        ...nextResult.warnings,
        "post_market_cash_still_negative_after_partial_repair",
        "Sichere Verkaeufe wurden behalten, obwohl der Cashstand noch nicht positiv ist; weiterer Repair folgt im naechsten Marktlauf.",
      ]);
    }
    if (effectivePostApplyStateBlockingReasons.length > 0) {
      const keepPartialCycle =
        options.transferWindowCycleMode &&
        ( !executeBuySteps || (nextResult.executedSells > 0 && nextResult.executedBuys === 0));
      if (!keepPartialCycle) {
        resetTransferRunContext(beforeTeamRun);
        nextResult.result = "blocked";
        nextResult.blockingReasons = unique([
          ...nextResult.blockingReasons,
          ...effectivePostApplyStateBlockingReasons,
        ]);
        nextResult.warnings = unique([
          ...nextResult.warnings,
          "Teamlauf wurde zurueckgedreht, weil Cash/Kader nach Transfers nicht regelkonform war.",
        ]);
        nextResult.executedSells = 0;
        nextResult.executedBuys = 0;
        nextResult.appliedSellDetails = [];
        nextResult.appliedBuyDetails = [];
        nextResult.cashAfter = nextResult.cashBefore;
        nextResult.rosterAfter = nextResult.rosterBefore;
        nextResult.salaryAfter = nextResult.salaryBefore;
        nextResult.marketValueAfter = nextResult.marketValueBefore;

        if (options.stopOnTeamFailure) {
          resetTransferRunContext(baselineGameState);
          abortedAfterFailure = true;
          abortedByTeamId = team.teamId;
          for (const previous of results) {
            if (previous.result === "applied") {
              previous.result = "blocked";
              previous.executedSells = 0;
              previous.executedBuys = 0;
              previous.appliedSellDetails = [];
              previous.appliedBuyDetails = [];
              previous.cashAfter = previous.cashBefore;
              previous.rosterAfter = previous.rosterBefore;
              previous.salaryAfter = previous.salaryBefore;
              previous.marketValueAfter = previous.marketValueBefore;
              previous.blockingReasons = unique([...previous.blockingReasons, "execution_rolled_back_after_team_failure"]);
              previous.warnings = unique([...previous.warnings, `Rollback nach Team-Fehler bei ${team.teamName}.`]);
            }
          }
        }
        results.push(nextResult);
        if (options.stopOnTeamFailure) {
          break;
        }
        continue;
      }

      nextResult.result = nextResult.executedSells + nextResult.executedBuys > 0 ? "applied" : "blocked";
      nextResult.blockingReasons = unique([
        ...nextResult.blockingReasons,
        ...effectivePostApplyStateBlockingReasons,
      ]);
      nextResult.warnings = unique([
        ...nextResult.warnings,
        "transfer_window_cycle_partial_apply_kept",
        "Teiltransfers im Fenster-Zyklus behalten; naechster Preview/Buy-Schritt folgt.",
      ]);
      const currentGameStatePartial = transferRunContext?.save.gameState ?? resolveLocalSave(persistence, preview.scope.saveId).gameState;
      const snapshotPartial = getTeamStateSnapshot(currentGameStatePartial, team.teamId);
      nextResult.cashAfter = snapshotPartial.cash;
      nextResult.rosterAfter = snapshotPartial.roster;
      nextResult.salaryAfter = snapshotPartial.salary;
      nextResult.marketValueAfter = snapshotPartial.marketValue;
      results.push(nextResult);
      continue;
    }
    plannedWrites.push(
      ...nextResult.appliedSellDetails.map((step) => ({
        teamId: team.teamId,
        stepType: step.stepType,
        playerId: step.playerId,
        playerName: step.playerName,
      })),
      ...nextResult.appliedBuyDetails.map((step) => ({
        teamId: team.teamId,
        stepType: step.stepType,
        playerId: step.playerId,
        playerName: step.playerName,
      })),
    );
    nextResult.result =
      nextResult.executedSells + nextResult.executedBuys > 0
        ? "applied"
        : "hold";
    results.push(nextResult);
  }

  recordPhase("applyLoop", Date.now() - applyStartedAt);
  const flushStartedAt = Date.now();
  // When the caller owns the shared run context across a whole session (deferContextFlush) we keep
  // the writes buffered in-memory (context.save.gameState is already mutated and correct for reads)
  // and let the caller persist once per round/phase. Only force a full save here when we either own
  // the context ourselves or the caller did not opt into deferring.
  const callerOwnsRunContext = Boolean(input.localRunContext);
  const shouldDeferFlush = options.deferContextFlush && callerOwnsRunContext;
  if (transferRunContext && transferRunContext.deferredWrites > 0 && !abortedAfterFailure && !shouldDeferFlush) {
    flushLocalTransfermarktRunContext(transferRunContext);
  }
  recordPhase("flush", Date.now() - flushStartedAt);

  if (abortedAfterFailure) {
    const remainingTeams = preview.teams.filter((team) => !results.some((entry) => entry.teamId === team.teamId));
    for (const team of remainingTeams) {
      const nextResult = buildBaseTeamResult(team);
      nextResult.result = "blocked";
      nextResult.blockingReasons = unique([...nextResult.blockingReasons, "execution_aborted_after_team_failure"]);
      nextResult.warnings = unique([
        ...nextResult.warnings,
        abortedByTeamId ? `Apply wurde nach Team-Fehler bei ${abortedByTeamId} fuer restliche Teams gestoppt.` : "Apply wurde nach Team-Fehler gestoppt.",
      ]);
      results.push(nextResult);
    }
  }
  const resultTeamIds = new Set(results.map((entry) => entry.teamId));
  for (const team of preflightGameState.teams) {
    if (!resultTeamIds.has(team.teamId)) {
      results.push(buildPreflightTeamResult(preflightGameState, team));
    }
  }

  const summary: AiMarketPlanApplySummary = {
    totalTeams: results.length,
    eligibleAiTeams: results.filter((entry) => entry.aiEligible).length,
    skippedManual: results.filter((entry) => entry.result === "skipped_manual").length,
    skippedPassive: results.filter((entry) => entry.result === "skipped_passive").length,
    skippedDisabled: results.filter((entry) => entry.result === "skipped_disabled").length,
    plannedSells: results.reduce((sum, entry) => sum + entry.plannedSells, 0),
    plannedBuys: results.reduce((sum, entry) => sum + entry.plannedBuys, 0),
    blockedSells: results.reduce((sum, entry) => sum + (entry.result === "blocked" || entry.result === "failed_sell" ? entry.plannedSells - entry.executedSells : 0), 0),
    blockedBuys: results.reduce((sum, entry) => sum + (entry.result === "blocked" || entry.result === "failed_buy" ? entry.plannedBuys - entry.executedBuys : 0), 0),
    appliedSells: results.reduce((sum, entry) => sum + entry.executedSells, 0),
    appliedBuys: results.reduce((sum, entry) => sum + entry.executedBuys, 0),
    warningTeams: results.filter((entry) => entry.result === "skipped_warning").length,
    blockedTeams: results.filter((entry) => entry.result === "blocked" || entry.result === "failed_sell" || entry.result === "failed_buy").length,
    holdTeams: results.filter((entry) => entry.result === "hold").length,
    existingHistoryWrites: results.reduce((sum, entry) => sum + entry.executedSells + entry.executedBuys, 0),
    plannedWrites: dryRun
      ? results.reduce((sum, entry) => sum + (entry.result === "planned" ? entry.plannedSells + entry.plannedBuys : 0), 0)
      : results.reduce((sum, entry) => sum + entry.executedSells + entry.executedBuys, 0),
    projectedCash: Object.fromEntries(
      results.map((entry) => [entry.teamId, entry.projectedCash]),
    ),
    projectedRoster: Object.fromEntries(
      results.map((entry) => [entry.teamId, entry.projectedRoster]),
    ),
  };

  const warnings = unique([...policyWarnings, ...results.flatMap((entry) => entry.warnings)]);
  const nonBlockingSkipReasons = new Set([
    "team_control_mode_manual",
    "team_control_mode_passive",
    "ai_transfer_preview_disabled",
    "ai_sell_preview_disabled",
  ]);
  const blockingReasons = unique(
    results.flatMap((entry) => entry.blockingReasons).filter((reason) => !nonBlockingSkipReasons.has(reason)),
  );
  const appliedSellCount = results.reduce((sum, entry) => sum + entry.executedSells, 0);
  const appliedBuyCount = results.reduce((sum, entry) => sum + entry.executedBuys, 0);
  phaseAudit.push(
    buildPhaseAudit({
      phaseId: "ai_sell_apply",
      status: dryRun ? (summary.plannedSells > 0 ? "planned" : "skipped") : appliedSellCount > 0 ? "applied" : "skipped",
      startedAt: totalStartedAt,
      teamsScanned: results.filter((entry) => entry.plannedSells > 0 || entry.executedSells > 0).length,
      candidatesScanned: dryRun ? summary.plannedSells : appliedSellCount,
      blockingReasons: results.flatMap((entry) =>
        entry.result === "failed_sell" || entry.result === "blocked"
          ? entry.blockingReasons.filter((reason) => reason.includes("sell") || reason.includes("execution"))
          : [],
      ),
    }),
    buildPhaseAudit({
      phaseId: "ai_renewal_apply",
      status: "skipped",
      startedAt: totalStartedAt,
      warnings: ["renewals_apply_in_contract_tick"],
    }),
    buildPhaseAudit({
      phaseId: "ai_buy_apply",
      status: dryRun ? (summary.plannedBuys > 0 ? "planned" : "skipped") : appliedBuyCount > 0 ? "applied" : "skipped",
      startedAt: totalStartedAt,
      teamsScanned: results.filter((entry) => entry.plannedBuys > 0 || entry.executedBuys > 0).length,
      candidatesScanned: dryRun ? summary.plannedBuys : appliedBuyCount,
      blockingReasons: results.flatMap((entry) =>
        entry.result === "failed_buy" || entry.result === "blocked"
          ? entry.blockingReasons.filter((reason) => reason.includes("buy") || reason.includes("cash") || reason.includes("execution"))
          : [],
      ),
    }),
    buildPhaseAudit({
      phaseId: "ai_market_summary",
      status: blockingReasons.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : dryRun ? "ready" : "applied",
      startedAt: totalStartedAt,
      teamsScanned: results.length,
      candidatesScanned: summary.plannedSells + summary.plannedBuys,
      warnings,
      blockingReasons,
    }),
  );
  const scope = {
    saveId: preview.scope.saveId,
    seasonId: preview.scope.seasonId,
    teamId: preview.scope.teamId ?? null,
    teamScope: preview.scope.teamScope,
  } as const;
  const resolvedSave = resolveLocalSave(persistence, preview.scope.saveId);
  // writeAuditLog does a *second* full GameState save (re-read + rewrite of the whole ~3k-player
  // state) purely to prepend one informational log line. Inside a session-owned cycle (deferContextFlush)
  // that is called hundreds of times, doubling the per-apply persistence cost. Skip it there — the
  // session already logs a compact per-team/summary line, and no functional state depends on this log.
  const skipAuditLogSave = options.deferContextFlush && Boolean(input.localRunContext);
  const auditLogId = !dryRun && !abortedAfterFailure && !skipAuditLogSave ? writeAuditLog(persistence, scope, summary) : null;
  if (auditLogId) {
    appliedAudits.push(auditLogId);
  }
  recordPhase("applyTotal", Date.now() - totalStartedAt);

  return {
    source: "sqlite",
    readOnly: dryRun,
    dryRun,
    executed: !dryRun,
    status: abortedAfterFailure
      ? "blocked"
      : buildOverallStatus({
          dryRun,
          summary,
          warnings,
          blockingReasons,
        }),
    scope,
    saveContext: {
      source: "sqlite",
      requestedSaveId: input.saveId ?? null,
      resolvedSaveId: resolvedSave.saveId,
      requestedSeasonId: input.seasonId ?? null,
      resolvedSeasonId: preview.scope.seasonId,
      saveName: resolvedSave.name ?? null,
      saveStatus: resolvedSave.status ?? null,
      scopeWarning: null,
    },
    summary,
    teams: results,
    results,
    warnings,
    blockingReasons,
    phaseAudit,
    plannedWrites,
    appliedAudits,
    auditLogId,
    buyGateRows: options.returnGateRows ? finalBuyGate.gateRows : undefined,
  };
}
