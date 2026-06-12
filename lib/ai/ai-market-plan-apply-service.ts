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
import type {
  GameLogEntry,
  GameState,
  Player,
  TeamControlMode,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { isExplicitLocalTransferWindowPhase, type LocalTransferWindowPhase } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";

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
  options?: {
    includeWarningTeams?: boolean;
    applySellSteps?: boolean;
    applyBuySteps?: boolean;
    maxBuysPerTeam?: number | null;
    maxSellsPerTeam?: number | null;
    previewBuyLimit?: number | null;
    previewSellLimit?: number | null;
    performanceBudgetMs?: number | null;
    stopOnTeamFailure?: boolean;
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
) {
  const profile = getTeamStrategyProfile(gameState, team.teamId);
  if (!profile || profile.hardNoGos.length === 0) {
    return [];
  }

  return unique(
    candidates.map((candidate) => {
      const player = gameState.players.find((entry) => entry.id === candidate.playerId);
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
  persistence.saveSingleplayerState(saveId, snapshot);
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
    stopOnTeamFailure: input.options?.stopOnTeamFailure ?? true,
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

  if (rosterCount < playerMin) {
    return playerMin - rosterCount + 10;
  }
  if (rosterCount < playerOpt) {
    return playerOpt - rosterCount;
  }
  return 0;
}

function getAllowedBuyCount(team: AiMarketPlanTeamEntry, rosterBase: number | null, maxBuysPerTeam: number | null) {
  const optionLimit = maxBuysPerTeam ?? Number.POSITIVE_INFINITY;
  const currentRoster = rosterBase ?? team.currentState.rosterCount ?? null;
  const playerMin = team.currentState.playerMin ?? 0;
  const playerOpt = team.currentState.playerOpt ?? playerMin;

  if (currentRoster == null) {
    return optionLimit;
  }

  if (currentRoster < playerOpt) {
    return Math.min(Math.max(playerOpt - currentRoster, 0), optionLimit);
  }

  const hasAggressiveOpportunity = team.buyPlan.candidates.length > 0 && getTopBuyCandidateScore(team) >= 65;
  const plannedSellCount = team.sellPlan.candidates.length;
  if (plannedSellCount >= 2 && getTopBuyCandidateScore(team) >= 58) {
    return Math.min(2, optionLimit);
  }
  if (plannedSellCount >= 1 && getTopBuyCandidateScore(team) >= 52) {
    return Math.min(1, optionLimit);
  }
  return hasAggressiveOpportunity ? Math.min(1, optionLimit) : 0;
}

function hasValueSellOpportunity(gameState: GameState, team: GameState["teams"][number], playerMin: number) {
  const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
  if (roster.length - 1 < playerMin) {
    return false;
  }

  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
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

function buildResolvedBuyCandidateMap(
  gameState: GameState,
  teams: AiMarketPlanTeamEntry[],
  applyBuySteps: boolean,
  maxBuysPerTeam: number | null,
) {
  const resolved = new Map<string, AiMarketPlanBuyPlan["candidates"]>();
  if (!applyBuySteps) {
    return resolved;
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
    const allowedBuyCount = getAllowedBuyCount(team, team.sellPlan.rosterAfterSell ?? team.currentState.rosterCount, maxBuysPerTeam);
    if (allowedBuyCount <= 0) {
      resolved.set(team.teamId, []);
      continue;
    }
    const profile = getTeamStrategyProfile(gameState, team.teamId);
    const uniqueCandidates: AiMarketPlanBuyPlan["candidates"] = [];
    for (const candidate of team.buyPlan.candidates) {
      const player = gameState.players.find((entry) => entry.id === candidate.playerId) ?? null;
      if (profile && player && matchesHardNoGo(profile, player)) {
        continue;
      }
      if (claimedPlayerIds.has(candidate.playerId)) {
        continue;
      }
      claimedPlayerIds.add(candidate.playerId);
      uniqueCandidates.push(candidate);
      if (uniqueCandidates.length >= allowedBuyCount) {
        break;
      }
    }
    resolved.set(team.teamId, uniqueCandidates);
  }

  return resolved;
}

function buildEffectiveSellPlan(team: AiMarketPlanTeamEntry, applySellSteps: boolean, maxSellsPerTeam: number | null): AiMarketPlanSellPlan {
  const candidates = applySellSteps ? limitItems(team.sellPlan.candidates, maxSellsPerTeam) : [];

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
): AiMarketPlanBuyPlan {
  const allowedBuyCount = getAllowedBuyCount(team, rosterBase, maxBuysPerTeam);
  const candidates = applyBuySteps
    ? buyCandidateOverride ?? limitItems(team.buyPlan.candidates, allowedBuyCount)
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
  const controlMode = ((team.controlMode ?? "ai") as TeamControlMode);
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
  const options = getEffectiveOptions(input);
  const includeWarningTeams = options.includeWarningTeams;
  const phaseAudit: AiMarketPhaseAudit[] = [];
  const persistence = createPersistenceService();
  const preflightStartedAt = Date.now();
  const preflightSave = resolveLocalSave(persistence, input.saveId);
  const preflightGameState = preflightSave.gameState;
  const aiTeamIds = new Set(
    preflightGameState.teams
      .filter((team) => (team.controlMode ?? "ai") === "ai")
      .map((team) => team.teamId),
  );
  const preflightRosterCounts = new Map<string, number>();
  for (const rosterEntry of preflightGameState.rosters) {
    preflightRosterCounts.set(rosterEntry.teamId, (preflightRosterCounts.get(rosterEntry.teamId) ?? 0) + 1);
  }
  const preflightBuyNeedTeamIds = preflightGameState.teams
    .filter((team) => aiTeamIds.has(team.teamId))
    .filter((team) => {
      const identity = preflightGameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const rosterCount = preflightRosterCounts.get(team.teamId) ?? 0;
      const identityOpt = identity?.playerOpt != null && Number.isFinite(identity.playerOpt) ? Math.round(identity.playerOpt) : null;
      const identityMin = identity?.playerMin != null && Number.isFinite(identity.playerMin) ? Math.round(identity.playerMin) : null;
      const rosterLimit =
        typeof team.rosterLimit === "number" && Number.isFinite(team.rosterLimit)
          ? Math.min(Math.max(team.rosterLimit, identityOpt ?? 0, identityMin ?? 0), 12)
          : 12;
      const playerMin = Math.min(identity?.playerMin ?? 7, rosterLimit);
      const playerOpt = Math.min(Math.max(identity?.playerOpt ?? 10, playerMin), rosterLimit);
      return rosterCount < playerOpt;
    })
    .map((team) => team.teamId);
  const preflightSellNeedTeamIds = preflightGameState.teams
    .filter((team) => aiTeamIds.has(team.teamId))
    .filter((team) => {
      const identity = preflightGameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const rosterCount = preflightRosterCounts.get(team.teamId) ?? 0;
      const identityOpt = identity?.playerOpt != null && Number.isFinite(identity.playerOpt) ? Math.round(identity.playerOpt) : null;
      const identityMin = identity?.playerMin != null && Number.isFinite(identity.playerMin) ? Math.round(identity.playerMin) : null;
      const rosterLimit =
        typeof team.rosterLimit === "number" && Number.isFinite(team.rosterLimit)
          ? Math.min(Math.max(team.rosterLimit, identityOpt ?? 0, identityMin ?? 0), 12)
          : 12;
      const playerMin = Math.min(identity?.playerMin ?? 7, rosterLimit);
      const playerOpt = Math.min(Math.max(identity?.playerOpt ?? 10, playerMin), rosterLimit);
      return (
        rosterCount > playerOpt ||
        (typeof team.cash === "number" && Number.isFinite(team.cash) && team.cash < 0) ||
        hasValueSellOpportunity(preflightGameState, team, playerMin)
      );
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
  const buyLimit = options.applyBuySteps && (!season2PlusNeedGate || preflightBuyNeedTeamIds.length > 0) ? options.previewBuyLimit : 0;
  const sellLimit = options.applySellSteps && (!season2PlusNeedGate || preflightSellNeedTeamIds.length > 0) ? options.previewSellLimit : 0;
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
      buildPhaseAudit({ phaseId: "ai_renewal_scan", status: "skipped", startedAt: totalStartedAt, warnings: ["ai_renewal_scan_not_implemented_yet"] }),
      buildPhaseAudit({ phaseId: "ai_buy_need_scan", status: "ready", startedAt: totalStartedAt, teamsScanned: preflightGameState.teams.length, candidatesScanned: 0 }),
      buildPhaseAudit({ phaseId: "ai_buy_candidate_scan", status: "skipped", startedAt: totalStartedAt, teamsScanned: 0, candidatesScanned: 0, scanLimit: buyLimit }),
      buildPhaseAudit({ phaseId: "ai_sell_apply", status: "skipped", startedAt: totalStartedAt }),
      buildPhaseAudit({ phaseId: "ai_renewal_apply", status: "skipped", startedAt: totalStartedAt, warnings: ["ai_renewal_apply_not_implemented_yet"] }),
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
    buyNeedOnly: true,
    forceBuyScanTeamIds: preflightSellNeedTeamIds,
  };
  const scanStartedAt = Date.now();
  const preview = await buildAiMarketPlanPreview(previewParams);
  const baselineGameState = structuredClone(resolveLocalSave(persistence, preview.scope.saveId).gameState);
  const sellCandidateCount = preview.teams.reduce((sum, team) => sum + team.sellPlan.candidates.length, 0);
  const buyNeedTeams = preview.teams.filter((team) => getRosterNeedGap(team) > 0 || team.buyPlan.candidates.length > 0);
  const buyCandidateCount = preview.teams.reduce((sum, team) => sum + team.buyPlan.candidates.length, 0);
  const scanElapsed = Date.now() - scanStartedAt;
  phaseAudit.push(
    buildPhaseAudit({
      phaseId: "ai_sell_scan",
      status: options.applySellSteps ? "ready" : "skipped",
      startedAt: scanStartedAt,
      teamsScanned: preview.teams.length,
      candidatesScanned: sellCandidateCount,
      scanLimit: previewParams.sellLimit ?? null,
    }),
    buildPhaseAudit({
      phaseId: "ai_renewal_scan",
      status: "skipped",
      startedAt: scanStartedAt,
      teamsScanned: preview.teams.length,
      candidatesScanned: 0,
      warnings: ["ai_renewal_scan_not_implemented_yet"],
    }),
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
  const resolvedBuyCandidateMap = buildResolvedBuyCandidateMap(
    baselineGameState,
    preview.teams,
    options.applyBuySteps,
    options.maxBuysPerTeam,
  );
  const results: AiMarketPlanApplyTeamResult[] = [];
  const plannedWrites: AiMarketPlanApplyResult["plannedWrites"] = [];
  const appliedAudits: string[] = [];
  let abortedAfterFailure = false;
  let abortedByTeamId: string | null = null;

  for (const team of preview.teams) {
    const nextResult = buildBaseTeamResult(team);
    const effectiveSellPlan = buildEffectiveSellPlan(team, options.applySellSteps, options.maxSellsPerTeam);
    const effectiveBuyPlan = buildEffectiveBuyPlan(
      team,
      options.applyBuySteps,
      options.maxBuysPerTeam,
      effectiveSellPlan.rosterAfterSell ?? team.currentState.rosterCount,
      resolvedBuyCandidateMap.get(team.teamId),
    );
    const effectiveProjectedState = buildEffectiveProjectedState(team.currentState, effectiveSellPlan, effectiveBuyPlan);
    nextResult.plannedSellDetails = buildPlannedSellDetails(effectiveSellPlan.candidates);
    nextResult.plannedBuyDetails = buildPlannedBuyDetails(effectiveBuyPlan.candidates);
    nextResult.plannedSells = nextResult.plannedSellDetails.length;
    nextResult.plannedBuys = nextResult.plannedBuyDetails.length;
    nextResult.projectedCash = effectiveProjectedState.cashAfterPlan;
    nextResult.projectedRoster = effectiveProjectedState.rosterAfterPlan;
    nextResult.cashAfter = effectiveProjectedState.cashAfterPlan;
    nextResult.rosterAfter = effectiveProjectedState.rosterAfterPlan;
    nextResult.salaryAfter = effectiveProjectedState.salaryAfterPlan;
    nextResult.marketValueAfter = effectiveProjectedState.marketValueAfterPlan;
    const hardNoGoBuyReasons = buildHardNoGoBuyReasons(
      baselineGameState,
      team,
      effectiveBuyPlan.candidates,
    );
    const rawHardNoGoBuyReasons = buildHardNoGoBuyReasons(
      baselineGameState,
      team,
      team.buyPlan.candidates,
    );
    const missingSellValue = effectiveSellPlan.candidates.some((candidate) => candidate.expectedSellValue == null);
    const duplicateBuysAvoided = team.buyPlan.candidates.length - effectiveBuyPlan.candidates.length;
    if (duplicateBuysAvoided > 0) {
      nextResult.warnings = unique([
        ...nextResult.warnings,
        `${duplicateBuysAvoided} kollidierende AI-Kaufziele wurden fuer diesen Save uebersprungen.`,
      ]);
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
      nextResult.projectedCash = effectiveSellPlan.cashAfterSell ?? team.currentState.cash;
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

    if (team.status === "blocked" || team.blockingReasons.length > 0) {
      nextResult.result = "blocked";
      results.push(nextResult);
      continue;
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

    const beforeTeamRun = structuredClone(resolveLocalSave(persistence, preview.scope.saveId).gameState);
    let teamFailed = false;

    for (const candidate of effectiveSellPlan.candidates) {
      const sellPreview = previewLocalTransfermarktSell({
        saveId: preview.scope.saveId,
        seasonId: preview.scope.seasonId,
        teamId: team.teamId,
        activePlayerId: candidate.activePlayerId,
        transferSource: "ai_preseason_market_sell",
      });

      if (!sellPreview.canSell || sellPreview.salePrice == null) {
        rollbackTeamState(persistence, preview.scope.saveId, beforeTeamRun);
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
      });

      if (!sellResult.canSell || !sellResult.transferCreated) {
        rollbackTeamState(persistence, preview.scope.saveId, beforeTeamRun);
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
        rollbackTeamState(persistence, preview.scope.saveId, baselineGameState);
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

    for (const candidate of effectiveBuyPlan.candidates) {
      const buyPreview = previewLocalTransfermarktBuy({
        saveId: preview.scope.saveId,
        seasonId: preview.scope.seasonId,
        teamId: team.teamId,
        playerId: candidate.playerId,
        transferSource: "ai_preseason_market_buy",
      });

      if (!buyPreview.canBuy) {
        rollbackTeamState(persistence, preview.scope.saveId, beforeTeamRun);
        nextResult.result = "failed_buy";
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
        transferSource: "ai_preseason_market_buy",
      });

      if (!buyResult.canBuy || !buyResult.transferCreated) {
        rollbackTeamState(persistence, preview.scope.saveId, beforeTeamRun);
        nextResult.result = "failed_buy";
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
        rollbackTeamState(persistence, preview.scope.saveId, baselineGameState);
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

    const currentGameState = resolveLocalSave(persistence, preview.scope.saveId).gameState;
    const snapshotAfterTeam = getTeamStateSnapshot(currentGameState, team.teamId);
    nextResult.cashAfter = snapshotAfterTeam.cash;
    nextResult.rosterAfter = snapshotAfterTeam.roster;
    nextResult.salaryAfter = snapshotAfterTeam.salary;
    nextResult.marketValueAfter = snapshotAfterTeam.marketValue;
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

  const warnings = unique(results.flatMap((entry) => entry.warnings));
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
      warnings: ["ai_renewal_apply_not_implemented_yet"],
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
  const auditLogId = !dryRun && !abortedAfterFailure ? writeAuditLog(persistence, scope, summary) : null;
  if (auditLogId) {
    appliedAudits.push(auditLogId);
  }

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
  };
}
