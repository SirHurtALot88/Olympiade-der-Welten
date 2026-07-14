import type { GameState, Player, Team, TeamControlMode, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { deriveRosterTargets, deriveSeason1TargetRosterSize } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  previewLocalTransfermarktBuy,
  executeLocalTransfermarktBuy,
  listLocalTransfermarktFreeAgents,
  createLocalTransfermarktRunContext,
  flushLocalTransfermarktRunContext,
  warmLocalTransfermarktFreeAgentBrowseIndex,
  type LocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { ensureLeagueMarketValueSnapshot } from "@/lib/player-formulas/market-value-apply";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { resolveAiLoanDecision } from "@/lib/ai/ai-loan-decision-service";
import { buildLoanOffers, originateLoan } from "@/lib/finance/loan-service";

import { isAiPickResettableSource } from "@/lib/ai/ai-pick-audit-reset-contract";
import {
  buildAiNeedsPicksCompare,
  resolveExpectedAiPickCostBandFromLane,
  normalizeAiNeedsPickLaneFamily,
  isSeason1SpendDownRequired,
  DRAFT_MAX_STEPS_CAP,
  type AiNeedsPicksRunMode,
  type AiNeedsPicksCompareTeamEntry,
} from "@/lib/ai/ai-needs-picks-compare-service";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { resolveSeason1BonusDraftSteps } from "@/lib/ai/season1-draft-cash-planner";
import type { Season1DraftSpendPlan } from "@/lib/ai/season1-draft-cash-planner";
import { MARKET_BRACKET_DEFINITIONS, buildLeagueMarketBrackets, type LeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";
import {
  resolveExecuteAffordabilityCash,
  canExecuteAffordPick,
  listExecuteFreeAgentsForSlot,
  resolveExecuteLivePickForSlot,
  resolveSlotLaneFromPick,
  type ExecuteLivePickCandidate,
} from "@/lib/ai/market-pick-engine/execute-live-pick";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { isLongRunContext } from "@/lib/season/long-run-profile";
import { planOrganicDraftForTeam } from "@/lib/ai/organic-squad/draft-adapter";

const LEGAL_MINIMUM_ROSTER_SIZE = 7;
const AI_CHEAP_FILL_MARKET_VALUE_CAP = 15;

export type AiPicksRunParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
  teamScope?: "ai" | "all";
  teamIds?: string[] | null;
  allowSetupAllTeams?: boolean;
  stepsPerTeam?: number | null;
  runMode?: AiNeedsPicksRunMode | null;
  draftSeed?: string | null;
};

type TeamTargetSource =
  | "team_identity_player_opt"
  | "strategy_profile_roster_opt"
  | "target_roster_size_missing";

type AiPickRunStatus = "ready" | "warning" | "blocked" | "applied" | "partial_applied";

type AiPickNeedRef = {
  axis: string;
  label: string;
  importance: number;
  reason: string;
};

type AiPickLaneRef = {
  lane: string;
  spendCap: number | null;
  priceCap: number | null;
  salaryCap: number | null;
  maxCashShare: number | null;
  minNeedScore: number;
  minTeamFitScore: number;
  allowedWhenUnderMinimum: boolean;
  cheaperAlternativeCheck: boolean;
  reason: string;
  plannedSlots: number;
  remainingSlots: number;
  spendUsed: number;
  active: boolean;
};

type AiPickCashStrategyRef = {
  strategySource: "retool_reference" | "local_inferred" | "missing_source";
  sourceStatus: "ready" | "partial" | "missing_source";
  startingCash: number | null;
  currentCash: number | null;
  targetRoster: number | null;
  minimumRoster: number | null;
  currentRoster: number | null;
  missingMinimumSlots: number;
  missingTargetSlots: number;
  expectedMinimumSlotCost: number | null;
  reservedCashForMinimum: number | null;
  reservedCashForDepth: number | null;
  availableCashForCurrentPick: number | null;
  maxSpendPerPick: number | null;
  maxSpendByLane: Record<string, number | null>;
  cashAggression: number;
  cashDiscipline: number;
  overspendTolerance: number;
  shouldSaveCash: boolean;
  canBuyStar: boolean;
  canBuySuperstar: boolean;
  financePosture:
    | "conservative"
    | "balanced"
    | "aggressive"
    | "desperate"
    | "value_hunter"
    | "cash_rich_but_cautious"
    | "cash_poor_forced_fill";
  spendFactor: number | null;
  allowedBudgetForSearch: number | null;
  attackPressure: number;
  savingsBias: number;
  minCashBuffer: number | null;
  season1SpendTargetPct: number | null;
  season1SpendMinPct: number | null;
  season1SpendMaxPct: number | null;
  season1SpendArchetype: string | null;
  season1SpendPlan: Season1DraftSpendPlan | null;
  rosterPressure: number;
  needPressure: number;
  spendArchitecture: {
    allowed_budget_for_search: number | null;
    maxSpendTotalThisWindow: number | null;
    maxSpendPerPick: number | null;
    maxSpendByLane: Record<string, number | null>;
    premiumSlotCount: number;
    starSlotCount: number;
    coreSlotCount: number;
    specialistSlotCount: number;
    depthSlotCount: number;
    fillSlotCount: number;
    reserveSlotCount: number;
    minCashBuffer: number | null;
    season1SpendTargetPct: number | null;
    season1SpendMinPct: number | null;
    season1SpendMaxPct: number | null;
    season1SpendArchetype: string | null;
    reservedCashForMinimum: number | null;
    reservedCashForDepth: number | null;
    attackPressure: number;
    savingsBias: number;
    rosterPressure: number;
    needPressure: number;
    financePosture: string;
    spendFactor: number | null;
    reason: string;
  };
  expectedPrizeSignal: {
    expectedPrizeCurrentSeason: number | null;
    expectedPrizeNextSeason1: number | null;
    expectedPrizeNextSeason2: number | null;
    expectedPrizeNextSeason3: number | null;
    expectedPrizeNextSeason4: number | null;
    expectedPrizeFiveSeasonSum: number | null;
    expectedGuvCurrentSeason?: number | null;
    expectedGuvFiveSeasonSum?: number | null;
    expectedProjectedCashAfterFiveSeasons?: number | null;
    expectedPrizeTrend: "up" | "down" | "flat" | "volatile" | "unknown";
    prizeConfidence: "ready" | "partial" | "missing_source";
    prizeSourceStatus: "ready" | "partial" | "missing_source";
    flowPolicy: "season_end_only" | "missing_source";
    warnings: string[];
  };
  financesValue: number;
  ambitionValue: number;
  boardPressureValue: number;
  harmonyValue: number;
  warnings: string[];
};

type AiPickPlannerRef = {
  plannerSource: "retool_reference" | "local_inferred";
  slotPlan: string[];
  superstarAllowed: number;
  starAllowed: number;
  minimumSlotsMissing: number;
  optimumSlotsMissing: number;
  coreNeeded: number;
  specialistNeeded: number;
  depthNeeded: number;
  cheapFillNeeded: number;
  backupNeeded: number;
  reservedCashForMinimum: number | null;
  minimumCandidateFloorPrice: number | null;
  minimumReachable: boolean;
  laneGatePassed: boolean;
  blockingReasons: string[];
  warnings: string[];
};

type AiPickScoreBreakdown = {
  playerQualityScore: number;
  needMatchScore: number;
  disciplineCoverageScore: number;
  teamAxisFitScore: number;
  teamThemeFitScore: number;
  classFitScore: number;
  raceOrArchetypeFitScore: number;
  teamIdentityScore: number;
  formColorCoverageScore: number;
  formColorFlexScore: number;
  classDisciplineFitScore: number;
  rosterBalanceScore: number;
  budgetFitScore: number;
  laneFitScore: number;
  valueScore: number;
  harmonyFitScore: number;
  harmonyPenalty: number;
  riskPenalty: number;
  duplicateProfilePenalty: number;
  offThemePenalty: number;
  classSpamPenalty: number;
  colorspamPenalty: number;
  evenSpreadPenalty: number;
  mercenaryNegativeFitPenalty: number;
};

export type AiPicksRunPick = {
  step: number;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  marketValue: number | null;
  salary: number | null;
  ovr: number | null;
  mvs: number | null;
  budgetLane: string;
  pickLane: string;
  plannedLane: string;
  laneReason: string;
  laneBudgetLimit: number | null;
  laneBudgetUsed: number | null;
  effectiveLaneCap: number | null;
  phaseCap: number | null;
  capExceeded: boolean;
  capOverrideReason: string | null;
  budgetStretchApplied: boolean;
  budgetStretchReason: string | null;
  budgetStretchPhaseAllowed: boolean;
  budgetStretchBlockedReason: string | null;
  isSuperstar: boolean;
  isStar: boolean;
  starPressureWarning: string | null;
  cheaperAlternativeAvailable: boolean;
  cheaperMinimumSafeAlternativeAvailable: boolean;
  specialistNeedFilled: boolean;
  coreNeedFilled: boolean;
  depthNeedFilled: boolean;
  minimumReachableAfterPick: boolean;
  remainingMinimumReserve: number | null;
  needLabel: string | null;
  primaryReason: string | null;
  secondaryReason: string | null;
  bestNeedDisciplineId: string | null;
  aiScore: number;
  pickScore: number;
  teamFit: number | null;
  budgetFit: number | null;
  rosterRole: string | null;
  pickPhase: string;
  teamCashTier: string | null;
  minimumSecured: boolean;
  reserveSecured: boolean;
  mustFeelRightScore: number | null;
  mustFeelRightWarning: string | null;
  draftSeed: string | null;
  baseScore: number | null;
  tieBreakJitter: number | null;
  scoreWithSeed: number | null;
  tieBreakBand: string | null;
  strategicExceptionReason: string | null;
  pickedForFormColor: boolean;
  formColorReason: string | null;
  formColorCoverageBefore?: Record<string, number> | null;
  formColorCoverageAfter?: Record<string, number> | null;
  formColorDoubleBoostPotential?: boolean;
  scoreBreakdown: AiPickScoreBreakdown;
  reasons: string[];
  warnings: string[];
  expectedCashAfter: number | null;
  expectedSalaryAfter: number | null;
  expectedRosterAfter: number | null;
  transferHistoryId: string | null;
  status: "planned" | "applied" | "blocked";
  plannedAxisNeed: string | null;
  actualPlayerPrimaryAxis: "pow" | "spe" | "men" | "soc" | null;
  costBandExpected: string | null;
  costBandActual: string | null;
  laneMatch: boolean;
  axisMatch: boolean;
  costBandMatch: boolean;
  cheapestCandidateSeen: number | null;
  cheapestCandidateSameAxis: number | null;
  cheapestCandidateSameTeamFitBand: number | null;
  cheapestCandidateSameClassFamily: number | null;
  priceDeltaVsCheapest: number | null;
  valueJustification: string[];
  rejectedCheaperAlternatives: Array<{
    playerId: string;
    playerName: string;
    className: string;
    price: number | null;
    finalScore: number;
  }>;
  auditWarnings: string[];
};

export type AiPicksRunPreflightCheck = {
  key:
    | "save_scope"
    | "rosters_empty"
    | "transfer_history_empty"
    | "cash_consistent"
    | "free_agents_affordable"
    | "candidate_pool_matches_market";
  status: "ok" | "warning" | "blocked";
  detail: string;
};

export type AiPicksRunTeamPreviewSummary = {
  startingCash: number | null;
  plannedSpendTotal: number | null;
  cashAfterPlannedBuys: number | null;
  availableCashAfterRequiredBuffer: number | null;
  plannedRosterCount: number | null;
  expectedMinimumReached: boolean | null;
  plannedAverageMarketValue: number | null;
  plannedMedianMarketValue: number | null;
  cheapestCandidateSeen: number | null;
  cheapestBoughtPlayer: number | null;
  mostExpensiveBoughtPlayer: number | null;
  lanesPlannedVsActual: Array<{
    step: number;
    plannedLane: string | null;
    actualPickLane: string | null;
    plannedAxisNeed: string | null;
    actualPlayerPrimaryAxis: string | null;
    costBandExpected: string | null;
    costBandActual: string | null;
    laneMatch: boolean;
    axisMatch: boolean;
    costBandMatch: boolean;
  }>;
  teamIdentityScore: number | null;
  offThemeWarnings: string[];
  hardBlockers: string[];
};

export type AiPicksRunTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  targetRosterMin: number | null;
  targetRosterOpt: number | null;
  targetRosterSize: number | null;
  targetSource: TeamTargetSource;
  rosterBefore: number;
  rosterAfter: number;
  missingBefore: number | null;
  missingAfter: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  existingAutoTransfers: number;
  resetState: "already_clean" | "auto_transfers_present";
  planner: AiPickPlannerRef | null;
  cashStrategy: AiPickCashStrategyRef | null;
  openNeeds: AiPickNeedRef[];
  budgetLanes: AiPickLaneRef[];
  plannedPicks: AiPicksRunPick[];
  transferHistoryIds: string[];
  previewSummary: AiPicksRunTeamPreviewSummary;
  warnings: string[];
  blockingReasons: string[];
};

type GlobalPickRow = AiPicksRunPick & {
  teamId: string;
  teamName: string;
  controlMode: TeamControlMode;
};

export type AiPicksRunGlobalSummary = {
  plannedPickCount: number;
  appliedPickCount: number;
  totalSpend: number | null;
  totalSalary: number | null;
  laneDistribution: Array<{ label: string; count: number }>;
  classDistribution: Array<{ label: string; count: number }>;
  raceDistribution: Array<{ label: string; count: number }>;
  berserkerCount: number;
  warlordCount: number;
  berserkerWarlordSharePct: number | null;
  superstarCount: number;
  starCount: number;
  criticalPicks: Array<{
    teamId: string;
    teamName: string;
    playerId: string;
    playerName: string;
    className: string;
    aiScore: number;
    offThemePenalty: number;
    classSpamPenalty: number;
    reason: string;
  }>;
  strongestNeedFits: Array<{
    teamId: string;
    teamName: string;
    playerId: string;
    playerName: string;
    className: string;
    needLabel: string | null;
    aiScore: number;
    needMatchScore: number;
    disciplineCoverageScore: number;
  }>;
  bestTeamFitPicks: Array<{
    teamId: string;
    teamName: string;
    playerId: string;
    playerName: string;
    className: string;
    teamIdentityScore: number;
    aiScore: number;
  }>;
};

export type AiPicksRunQualityGate = {
  passed: boolean;
  blockingReasons: string[];
  warnings: string[];
  metrics: {
    plannedPickCount: number;
    berserkerWarlordSharePct: number | null;
    offThemeSharePct: number | null;
    classSpamSharePct: number | null;
    superstarSharePct: number | null;
    starSharePct: number | null;
  };
};

export type AiPicksRunResult = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: AiPickRunStatus;
  scope: {
    saveId: string;
    seasonId: string;
    teamScope: "ai" | "all";
    allowSetupAllTeams: boolean;
  };
  saveContext: {
    source: "sqlite";
    requestedSaveId: string;
    resolvedSaveId: string;
    requestedSeasonId: string;
    resolvedSeasonId: string;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  preflight: {
    activeSaveName: string | null;
    existingAutoTransfers: number;
    manualTransfersProtected: number;
    resetStatus: "already_clean" | "auto_transfers_present";
    checks: AiPicksRunPreflightCheck[];
  };
  qualityGate: AiPicksRunQualityGate;
  globalPreview: AiPicksRunGlobalSummary;
  globalExecution: AiPicksRunGlobalSummary;
  traceParity: {
    dryRunExecuteTraceMatch: boolean;
    dryRunPickCount: number;
    executePickCount: number;
    sameTeams: boolean;
    samePlayers: boolean;
    sameOrder: boolean;
    sameLanes: boolean;
    sameCosts: boolean;
    traceDifferences: Array<{
      teamId: string;
      teamName: string;
      step: number;
      field: "team" | "player" | "order" | "lane" | "cost";
      dryRunValue: string | number | null;
      executeValue: string | number | null;
      reason: string;
    }>;
  };
  teams: AiPicksRunTeamResult[];
  performance: {
    totalMs: number;
    previewMs: number;
    executeMs: number;
    teamTimings: Array<{
      teamId: string;
      teamCode: string;
      teamName: string;
      previewMs: number;
      executeMs: number;
      totalMs: number;
      plannedPicks: number;
      appliedPicks: number;
    }>;
  };
  historyCheck: {
    allAppliedBuysVisible: boolean;
    missingTransferIds: string[];
    visibleTransferIds: string[];
  };
  warnings: string[];
  blockingReasons: string[];
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function getSeason1SpendTargetPctForTeamCode(teamCode: string | null | undefined) {
  const code = String(teamCode ?? "").trim().toUpperCase();
  if (["M-M", "H-R", "R-R", "V-V"].includes(code)) return 0.975;
  if (["C-C", "T-T", "N-W", "R-C"].includes(code)) return 0.88;
  return 0.93;
}

function isColdSteelThemeBreaker(playerClass: string | null | undefined, race: string | null | undefined) {
  const tokens = [normalizeToken(playerClass), normalizeToken(race)];
  return tokens.some((token) => token === "demon" || token === "monster" || token === "chaos" || token === "undead");
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function sortCountEntries(map: Map<string, number>) {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0], "de");
    })
    .map(([label, count]) => ({ label, count }));
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundValue((sorted[middle - 1] + sorted[middle]) / 2, 2);
  }
  return roundValue(sorted[middle], 2);
}

function resolvePrimaryAxisFromPlayer(player: Player | null | undefined): "pow" | "spe" | "men" | "soc" | null {
  if (!player) {
    return null;
  }
  const entries: Array<["pow" | "spe" | "men" | "soc", number]> = [
    ["pow", player.coreStats.pow],
    ["spe", player.coreStats.spe],
    ["men", player.coreStats.men],
    ["soc", player.coreStats.soc],
  ];
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] ?? null;
}

function normalizeAxisNeed(axis: string | null | undefined): "pow" | "spe" | "men" | "soc" | null {
  const normalized = normalizeToken(axis);
  if (normalized === "pow" || normalized === "power") return "pow";
  if (normalized === "spe" || normalized === "speed") return "spe";
  if (normalized === "men" || normalized === "mental") return "men";
  if (normalized === "soc" || normalized === "social") return "soc";
  return null;
}

const FOCUS_TEAM_CODES = new Set(["C-C", "W-W", "T-T", "A-A", "N-W", "C-S", "R-R", "M-M", "H-R", "G-G"]);

function isFocusTeam(teamCode: string) {
  return FOCUS_TEAM_CODES.has(teamCode);
}

function classifyActualPickLaneFromMarketValue(marketValue: number | null) {
  const mv = marketValue ?? 0;
  if (mv + 0.01 >= 65) return { pickLane: "superstar_pick", isSuperstar: true, isStar: true };
  if (mv + 0.01 >= 45) return { pickLane: "star_pick", isSuperstar: false, isStar: true };
  if (mv + 0.01 >= 30) return { pickLane: "core_investment", isSuperstar: false, isStar: false };
  if (mv + 0.01 >= 20) return { pickLane: "depth_value", isSuperstar: false, isStar: false };
  if (mv + 0.01 >= 12) return { pickLane: "backup", isSuperstar: false, isStar: false };
  return { pickLane: "cheap_fill", isSuperstar: false, isStar: false };
}

function normalizeActualPickLane(lane: string | null | undefined) {
  const normalized = normalizeToken(lane);
  if (normalized === "core_investment") return "core";
  if (normalized === "specialist_investment") return "specialist";
  if (normalized === "depth_value") return "depth";
  if (normalized === "star_pick") return "star";
  if (normalized === "superstar_pick") return "superstar";
  if (normalized === "expensive_minimum_fill" || normalized === "budget_risk_pick") return "cheap_fill";
  return normalized || null;
}

function buildPickAuditWarnings(input: {
  plannedLane: string | null | undefined;
  actualPickLane: string | null | undefined;
  plannedAxisNeed: string | null;
  actualPlayerPrimaryAxis: string | null;
  costBandExpected: string | null;
  costBandActual: string | null;
}) {
  const warnings: string[] = [];
  if (normalizeToken(input.plannedLane) !== normalizeActualPickLane(input.actualPickLane)) {
    warnings.push("lane_mismatch");
  }
  if (normalizeToken(input.plannedAxisNeed) !== normalizeToken(input.actualPlayerPrimaryAxis)) {
    warnings.push("axis_mismatch");
  }
  if (normalizeToken(input.costBandExpected) !== normalizeToken(input.costBandActual)) {
    warnings.push("cost_band_mismatch");
  }
  if (normalizeAiNeedsPickLaneFamily(input.actualPickLane) === "cheap_fill" && ["star", "superstar"].includes(normalizeToken(input.costBandActual))) {
    warnings.push("star_bought_for_depth_slot");
  }
  if (input.plannedAxisNeed && input.actualPlayerPrimaryAxis && input.plannedAxisNeed !== input.actualPlayerPrimaryAxis) {
    warnings.push("wrong_axis_for_need");
  }
  return warnings;
}

function resolveStrictLocalSave(persistence: PersistenceService, saveId: string) {
  const requestedSave = persistence.getSaveById(saveId);
  if (!requestedSave) {
    throw new Error(`Requested save ${saveId} could not be resolved for AI picks run.`);
  }

  return requestedSave;
}

function getTeamRosterPlayers(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: GameState["rosters"][number]; player: GameState["players"][number] } => Boolean(item.player));
}

function buildTeamEconomySnapshot(gameState: GameState, team: Team) {
  const rosterPlayers = getTeamRosterPlayers(gameState, team.teamId);
  return {
    rosterCount: rosterPlayers.length,
    cash: team.cash ?? null,
    salaryTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
        0,
      ),
      2,
    ),
  };
}

function resolveTargetRoster(team: Team, gameState: GameState, runMode?: AiNeedsPicksRunMode | null) {
  const teamIdentity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  if (teamIdentity && Number.isFinite(teamIdentity.playerOpt) && teamIdentity.playerOpt > 0) {
    const targets = deriveRosterTargets(team, teamIdentity);
    const targetRosterSize =
      runMode === "season1_optimum_execute"
        ? deriveSeason1TargetRosterSize(targets.playerOpt, targets.playerMax)
        : targets.playerOpt;
    return {
      targetRosterSize,
      targetSource: "team_identity_player_opt" as const,
      playerOpt: targets.playerOpt,
      playerMax: targets.playerMax,
    };
  }

  const strategyProfile = getTeamStrategyProfile(gameState, team.teamId);
  if (strategyProfile?.rosterOptTarget != null && Number.isFinite(strategyProfile.rosterOptTarget) && strategyProfile.rosterOptTarget > 0) {
    const playerOpt = Math.round(strategyProfile.rosterOptTarget);
    const playerMax = team.rosterLimit ?? playerOpt;
    const targetRosterSize =
      runMode === "season1_optimum_execute" ? deriveSeason1TargetRosterSize(playerOpt, playerMax) : playerOpt;
    return {
      targetRosterSize,
      targetSource: "strategy_profile_roster_opt" as const,
      playerOpt,
      playerMax,
    };
  }

  return {
    targetRosterSize: null,
    targetSource: "target_roster_size_missing" as const,
    playerOpt: null,
    playerMax: null,
  };
}

function resolveExecuteSubstituteMaxPrice(input: {
  pick: AiPicksRunPick;
  rosterCount: number;
  targetRosterMin: number | null;
  affordabilityCash: number;
}) {
  if (input.targetRosterMin != null && input.rosterCount < input.targetRosterMin) {
    return input.affordabilityCash;
  }
  const pick = input.pick;
  const lane = normalizeToken(pick.plannedLane || pick.pickLane || pick.budgetLane);
  const bracketFloor =
    lane === "superstar"
      ? (MARKET_BRACKET_DEFINITIONS.find((definition) => definition.lane === "superstar")?.minMw ?? 65)
      : lane === "star"
        ? (MARKET_BRACKET_DEFINITIONS.find((definition) => definition.lane === "star")?.minMw ?? 45)
        : null;
  if (bracketFloor != null) {
    return Math.max(
      pick.marketValue ?? 0,
      pick.phaseCap ?? 0,
      pick.laneBudgetLimit ?? 0,
      pick.effectiveLaneCap ?? 0,
      bracketFloor,
    );
  }
  return pick.marketValue ?? pick.remainingMinimumReserve ?? null;
}

function resolveExecuteSlotPriceCeiling(input: {
  frozenPick: AiPicksRunPick;
  rosterCount: number;
  targetRosterMin: number | null;
  affordabilityCash: number;
}) {
  if (input.targetRosterMin != null && input.rosterCount < input.targetRosterMin) {
    return input.affordabilityCash;
  }
  return input.frozenPick.effectiveLaneCap ?? input.frozenPick.phaseCap ?? input.frozenPick.laneBudgetLimit;
}

function pushExecuteSlotBlockers(blockingReasons: string[]) {
  blockingReasons.push("execute_slot_unfilled", "preview_execute_drift_blocked");
}

function resolveSeason1ExecuteSpendDownRequired(
  previewTeam: AiPicksRunTeamResult,
  remainingCash: number | null,
  remainingSalary: number | null,
) {
  const cashStrategy = previewTeam.cashStrategy;
  if (!cashStrategy || remainingCash == null) {
    return false;
  }
  return isSeason1SpendDownRequired({
    remainingCash,
    remainingSalary,
    cashStrategy: {
      startingCash: cashStrategy.startingCash,
      season1SpendMinPct: cashStrategy.season1SpendMinPct,
      season1SpendTargetPct: cashStrategy.season1SpendTargetPct,
      season1SpendPlan: cashStrategy.season1SpendPlan ?? null,
    },
  });
}

function shouldStopSeason1ExecutePick(input: {
  rosterCount: number;
  targetRosterSize: number;
  playerMax: number | null;
  spendDownRequired: boolean;
}) {
  if (input.playerMax != null && input.rosterCount >= input.playerMax) {
    return true;
  }
  return input.rosterCount >= input.targetRosterSize && !input.spendDownRequired;
}

function shouldStopTeamExecuteLoop(input: {
  runMode: AiNeedsPicksRunMode;
  rosterCount: number;
  targetRosterSize: number | null;
  playerMax: number | null;
  previewTeam: AiPicksRunTeamResult;
  remainingCash: number | null;
  remainingSalary: number | null;
}) {
  if (input.targetRosterSize == null) {
    return false;
  }
  if (input.runMode === "season1_optimum_execute") {
    return shouldStopSeason1ExecutePick({
      rosterCount: input.rosterCount,
      targetRosterSize: input.targetRosterSize,
      playerMax: input.playerMax,
      spendDownRequired: resolveSeason1ExecuteSpendDownRequired(
        input.previewTeam,
        input.remainingCash,
        input.remainingSalary,
      ),
    });
  }
  return input.rosterCount >= input.targetRosterSize;
}

function getExistingAutoTransfers(gameState: GameState, teamId: string) {
  return gameState.transferHistory.filter(
    (entry) => entry.transferType === "buy" && entry.toTeamId === teamId && isAiPickResettableSource(entry.source),
  );
}

function mapNeedRefs(entry: AiNeedsPicksCompareTeamEntry) {
  return entry.openNeeds.map((need) => ({
    axis: need.axis,
    label: need.label,
    importance: need.importance,
    reason: need.reason,
  }));
}

function mapBudgetRefs(entry: AiNeedsPicksCompareTeamEntry) {
  return entry.budgetLanes.map((lane) => ({
    lane: lane.lane,
    spendCap: lane.spendCap,
    priceCap: lane.priceCap,
    salaryCap: lane.salaryCap,
    maxCashShare: lane.maxCashShare,
    minNeedScore: lane.minNeedScore,
    minTeamFitScore: lane.minTeamFitScore,
    allowedWhenUnderMinimum: lane.allowedWhenUnderMinimum,
    cheaperAlternativeCheck: lane.cheaperAlternativeCheck,
    reason: lane.reason,
    plannedSlots: lane.plannedSlots,
    remainingSlots: lane.remainingSlots,
    spendUsed: lane.spendUsed,
    active: lane.active,
  }));
}

function mapCashStrategyRef(entry: AiNeedsPicksCompareTeamEntry): AiPickCashStrategyRef {
  return {
    strategySource: entry.cashStrategy.strategySource,
    sourceStatus: entry.cashStrategy.sourceStatus,
    startingCash: entry.cashStrategy.startingCash,
    currentCash: entry.cashStrategy.currentCash,
    targetRoster: entry.cashStrategy.targetRoster,
    minimumRoster: entry.cashStrategy.minimumRoster,
    currentRoster: entry.cashStrategy.currentRoster,
    missingMinimumSlots: entry.cashStrategy.missingMinimumSlots,
    missingTargetSlots: entry.cashStrategy.missingTargetSlots,
    expectedMinimumSlotCost: entry.cashStrategy.expectedMinimumSlotCost,
    reservedCashForMinimum: entry.cashStrategy.reservedCashForMinimum,
    reservedCashForDepth: entry.cashStrategy.reservedCashForDepth,
    availableCashForCurrentPick: entry.cashStrategy.availableCashForCurrentPick,
    maxSpendPerPick: entry.cashStrategy.maxSpendPerPick,
    maxSpendByLane: { ...entry.cashStrategy.maxSpendByLane },
    cashAggression: entry.cashStrategy.cashAggression,
    cashDiscipline: entry.cashStrategy.cashDiscipline,
    overspendTolerance: entry.cashStrategy.overspendTolerance,
    shouldSaveCash: entry.cashStrategy.shouldSaveCash,
    canBuyStar: entry.cashStrategy.canBuyStar,
    canBuySuperstar: entry.cashStrategy.canBuySuperstar,
    financePosture: entry.cashStrategy.financePosture,
    spendFactor: entry.cashStrategy.spendFactor,
    allowedBudgetForSearch: entry.cashStrategy.allowedBudgetForSearch,
    attackPressure: entry.cashStrategy.attackPressure,
    savingsBias: entry.cashStrategy.savingsBias,
    minCashBuffer: entry.cashStrategy.minCashBuffer,
    season1SpendTargetPct: entry.cashStrategy.season1SpendTargetPct,
    season1SpendMinPct: entry.cashStrategy.season1SpendMinPct,
    season1SpendMaxPct: entry.cashStrategy.season1SpendMaxPct,
    season1SpendArchetype: entry.cashStrategy.season1SpendArchetype,
    season1SpendPlan: entry.cashStrategy.season1SpendPlan,
    rosterPressure: entry.cashStrategy.rosterPressure,
    needPressure: entry.cashStrategy.needPressure,
    spendArchitecture: {
      ...entry.cashStrategy.spendArchitecture,
      maxSpendByLane: { ...entry.cashStrategy.spendArchitecture.maxSpendByLane },
    },
    expectedPrizeSignal: {
      ...entry.cashStrategy.expectedPrizeSignal,
      warnings: [...entry.cashStrategy.expectedPrizeSignal.warnings],
    },
    financesValue: entry.cashStrategy.financesValue,
    ambitionValue: entry.cashStrategy.ambitionValue,
    boardPressureValue: entry.cashStrategy.boardPressureValue,
    harmonyValue: entry.cashStrategy.harmonyValue,
    warnings: [...entry.cashStrategy.warnings],
  };
}

function mapPlannerRef(entry: AiNeedsPicksCompareTeamEntry): AiPickPlannerRef {
  return {
    plannerSource: entry.planner.plannerSource,
    slotPlan: [...entry.planner.slotPlan],
    superstarAllowed: entry.planner.superstarAllowed,
    starAllowed: entry.planner.starAllowed,
    minimumSlotsMissing: entry.planner.minimumSlotsMissing,
    optimumSlotsMissing: entry.planner.optimumSlotsMissing,
    coreNeeded: entry.planner.coreNeeded,
    specialistNeeded: entry.planner.specialistNeeded,
    depthNeeded: entry.planner.depthNeeded,
    cheapFillNeeded: entry.planner.cheapFillNeeded,
    backupNeeded: entry.planner.backupNeeded,
    reservedCashForMinimum: entry.planner.reservedCashForMinimum,
    minimumCandidateFloorPrice: entry.planner.minimumCandidateFloorPrice,
    minimumReachable: entry.planner.minimumReachable,
    laneGatePassed: entry.planner.laneGatePassed,
    blockingReasons: [...entry.planner.blockingReasons],
    warnings: [...entry.planner.warnings],
  };
}

function toNeedLabel(compareEntry: AiNeedsPicksCompareTeamEntry, pick: AiNeedsRunComparePick) {
  if (pick.bestNeedDisciplineId) {
    const disciplineNeed = compareEntry.openNeeds.find((entry) => entry.reason.includes(pick.bestNeedDisciplineId!));
    if (disciplineNeed) {
      return disciplineNeed.label;
    }
  }
  const axisNeed = compareEntry.openNeeds.find(
    (entry) => entry.axis === pick.candidateAxis || entry.axis === pick.lane,
  );
  return axisNeed?.label ?? compareEntry.openNeeds[0]?.label ?? null;
}

type AiNeedsRunComparePick = Pick<
  AiNeedsPicksCompareTeamEntry["plannedPicks"][number],
  "lane" | "candidateAxis" | "bestNeedDisciplineId"
>;
function mapPlannedPicks(compareEntry: AiNeedsPicksCompareTeamEntry) {
  return compareEntry.plannedPicks.map((pick, index) => {
    const snapshot = compareEntry.sequentialStateSnapshots[index] ?? null;
    const identityScore = pick.scoreBreakdown.teamIdentityScore ?? 0;
    const themeScore = pick.scoreBreakdown.teamThemeFitScore ?? 0;
    const classScore = pick.scoreBreakdown.classFitScore ?? 0;
    const raceScore = pick.scoreBreakdown.raceOrArchetypeFitScore ?? 0;
    const offThemePenalty = pick.scoreBreakdown.offThemePenalty ?? 0;
    const classSpamPenalty = pick.scoreBreakdown.classSpamPenalty ?? 0;
    const mustFeelRightScore =
      identityScore +
      themeScore +
      classScore +
      raceScore +
      offThemePenalty +
      classSpamPenalty;
    const mustFeelRightWarning =
      pick.mustFeelRightStatus === "warning" || pick.mustFeelRightStatus === "risky_but_allowed"
        ? pick.reasons[0] ?? "must_feel_right_warning"
        : null;
    const rosterRole =
      pick.isSuperstar
        ? "Superstar"
        : pick.isStar
          ? "Star"
          : pick.pickLane === "core"
            ? "Core"
            : pick.pickLane === "specialist"
              ? "Specialist"
              : pick.pickLane === "depth"
                ? "Depth"
                : pick.pickLane === "backup"
                  ? "Backup"
                  : pick.pickLane === "cheap_fill"
                    ? "Prospect"
                    : "Reserve";
    const pickPhase = pick.pickPhase;
    const plannedAxisNeed = normalizeAxisNeed(pick.candidateAxis);
    const actualPlayerPrimaryAxis = plannedAxisNeed;
    const costBandExpected = pick.expectedCostBand ?? resolveExpectedAiPickCostBandFromLane(pick.pickLane);
    const costBandActual = pick.actualCostBand ?? null;
    const laneMatch = normalizeToken(pick.lane) === normalizeActualPickLane(pick.pickLane);
    const axisMatch = plannedAxisNeed == null || actualPlayerPrimaryAxis == null || plannedAxisNeed === actualPlayerPrimaryAxis;
    const costBandMatch = costBandExpected == null || costBandActual == null || costBandExpected === costBandActual;
    const auditWarnings = buildPickAuditWarnings({
      plannedLane: pick.lane,
      actualPickLane: pick.pickLane,
      plannedAxisNeed,
      actualPlayerPrimaryAxis,
      costBandExpected,
      costBandActual,
    });
    return {
      step: pick.step,
      playerId: pick.playerId,
      playerName: pick.playerName,
      className: pick.className,
      race: pick.race,
      marketValue: pick.price,
      salary: pick.salary,
      ovr: pick.ovr,
      mvs: pick.mvs,
      budgetLane: pick.lane,
      pickLane: pick.pickLane,
      plannedLane: pick.plannedLane ?? pick.lane,
      laneReason: pick.laneReason,
      laneBudgetLimit: pick.laneBudgetLimit,
      laneBudgetUsed: pick.laneBudgetUsed,
      effectiveLaneCap: pick.effectiveLaneCap ?? pick.laneBudgetLimit ?? null,
      phaseCap: pick.phaseCap ?? null,
      capExceeded: Boolean(pick.capExceeded),
      capOverrideReason: pick.capOverrideReason ?? null,
      budgetStretchApplied: pick.budgetStretchApplied,
      budgetStretchReason: pick.budgetStretchReason ?? null,
      budgetStretchPhaseAllowed: Boolean(pick.budgetStretchPhaseAllowed),
      budgetStretchBlockedReason: pick.budgetStretchBlockedReason ?? null,
      isSuperstar: pick.isSuperstar,
      isStar: pick.isStar,
      starPressureWarning: pick.starPressureWarning,
      cheaperAlternativeAvailable: pick.cheaperAlternativeAvailable,
      cheaperMinimumSafeAlternativeAvailable: pick.cheaperMinimumSafeAlternativeAvailable,
      specialistNeedFilled: pick.specialistNeedFilled,
      coreNeedFilled: pick.coreNeedFilled,
      depthNeedFilled: pick.depthNeedFilled,
      minimumReachableAfterPick: pick.minimumReachableAfterPick,
      remainingMinimumReserve: pick.remainingMinimumReserve,
      needLabel: toNeedLabel(compareEntry, pick),
      primaryReason: pick.reasons[0] ?? null,
      secondaryReason: pick.reasons[1] ?? null,
      bestNeedDisciplineId: pick.bestNeedDisciplineId,
      aiScore: pick.finalScore,
      pickScore: pick.finalScore,
      teamFit: pick.scoreBreakdown.teamIdentityScore,
      budgetFit: pick.scoreBreakdown.budgetFitScore,
      rosterRole,
      pickPhase,
      teamCashTier: pick.teamCashTier ?? null,
      minimumSecured: Boolean(pick.minimumSecured),
      reserveSecured: Boolean(pick.reserveSecured),
      mustFeelRightScore: roundValue(mustFeelRightScore, 2),
      mustFeelRightWarning,
      draftSeed: pick.draftSeed ?? null,
      baseScore: pick.baseScore ?? pick.finalScore,
      tieBreakJitter: pick.tieBreakJitter ?? 0,
      scoreWithSeed: pick.scoreWithSeed ?? pick.finalScore,
      tieBreakBand: pick.tieBreakBand ?? null,
      strategicExceptionReason: pick.strategicExceptionReason,
      pickedForFormColor: Boolean(pick.pickedForFormColor),
      formColorReason: pick.formColorReason ?? null,
      formColorCoverageBefore: pick.formColorCoverageBefore ?? null,
      formColorCoverageAfter: pick.formColorCoverageAfter ?? null,
      formColorDoubleBoostPotential: Boolean(pick.formColorDoubleBoostPotential),
      scoreBreakdown: pick.scoreBreakdown,
      reasons: [...pick.reasons],
      warnings: [],
      expectedCashAfter: snapshot?.cashAfter ?? null,
      expectedSalaryAfter: snapshot?.salaryAfter ?? null,
      expectedRosterAfter: snapshot?.rosterCountAfter ?? null,
      transferHistoryId: null,
      status: "planned" as const,
      plannedAxisNeed,
      actualPlayerPrimaryAxis,
      costBandExpected,
      costBandActual,
      laneMatch,
      axisMatch,
      costBandMatch,
      cheapestCandidateSeen: pick.cheapestCandidateSeen ?? null,
      cheapestCandidateSameAxis: pick.cheapestCandidateSameAxis ?? null,
      cheapestCandidateSameTeamFitBand: pick.cheapestCandidateSameTeamFitBand ?? null,
      cheapestCandidateSameClassFamily: pick.cheapestCandidateSameClassFamily ?? null,
      priceDeltaVsCheapest: pick.priceDeltaVsCheapest ?? null,
      valueJustification: pick.valueJustification ?? [],
      rejectedCheaperAlternatives: pick.rejectedCheaperAlternatives ?? [],
      auditWarnings,
    } satisfies AiPicksRunPick;
  });
}

function buildRunPreviewPicks(compareEntry: AiNeedsPicksCompareTeamEntry, gameState: GameState) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return mapPlannedPicks(compareEntry).map((pick) => {
    const player = playersById.get(pick.playerId) ?? null;
    const actualPlayerPrimaryAxis = resolvePrimaryAxisFromPlayer(player);
    const axisMatch =
      pick.plannedAxisNeed == null || actualPlayerPrimaryAxis == null || pick.plannedAxisNeed === actualPlayerPrimaryAxis;
    const auditWarnings = buildPickAuditWarnings({
      plannedLane: pick.budgetLane,
      actualPickLane: pick.pickLane,
      plannedAxisNeed: pick.plannedAxisNeed,
      actualPlayerPrimaryAxis,
      costBandExpected: pick.costBandExpected,
      costBandActual: pick.costBandActual,
    });
    return {
      ...pick,
      actualPlayerPrimaryAxis,
      axisMatch,
      auditWarnings,
    };
  });
}

function buildTeamPreviewSummary(
  team: AiPicksRunTeamResult,
  compareEntry?: AiNeedsPicksCompareTeamEntry | null,
): AiPicksRunTeamPreviewSummary {
  const activePicks = team.plannedPicks.filter((pick) => pick.status !== "blocked");
  const pickValues = activePicks
    .map((pick) => pick.marketValue)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const plannedSpendTotal = pickValues.length > 0 ? roundValue(pickValues.reduce((sum, value) => sum + value, 0), 2) : 0;
  const plannedRosterCount = team.rosterBefore + activePicks.length;
  const availableCashAfterRequiredBuffer =
    team.cashStrategy?.currentCash != null
      ? roundValue(team.cashStrategy.currentCash - (team.cashStrategy.reservedCashForMinimum ?? 0), 2)
      : null;
  const cashAfterPlannedBuys =
    team.cashStrategy?.currentCash != null ? roundValue(team.cashStrategy.currentCash - plannedSpendTotal, 2) : null;
  const offThemeWarnings = activePicks
    .filter((pick) => pick.scoreBreakdown.offThemePenalty <= -4 || pick.mustFeelRightWarning != null)
    .map((pick) => `${pick.playerName}:${pick.mustFeelRightWarning ?? "off_theme"}`);
  const candidatePrices =
    compareEntry?.candidatePoolTop
      .map((candidate) => candidate.price)
      .filter((value): value is number => value != null && Number.isFinite(value)) ?? [];
  const cheapestCandidateSeen =
    candidatePrices.length > 0
      ? roundValue(Math.min(...candidatePrices), 2)
      : team.plannedPicks.reduce<number | null>((lowest, pick) => {
          if (pick.marketValue == null) return lowest;
          return lowest == null ? pick.marketValue : Math.min(lowest, pick.marketValue);
        }, null);
  const hardBlockers = unique([
    ...team.blockingReasons,
    ...activePicks.flatMap((pick) => pick.auditWarnings),
  ]);

  return {
    startingCash: team.cashStrategy?.startingCash ?? team.cashBefore ?? null,
    plannedSpendTotal,
    cashAfterPlannedBuys,
    availableCashAfterRequiredBuffer,
    plannedRosterCount,
    expectedMinimumReached: team.targetRosterMin != null ? plannedRosterCount >= team.targetRosterMin : null,
    plannedAverageMarketValue: pickValues.length > 0 ? roundValue(plannedSpendTotal / pickValues.length, 2) : null,
    plannedMedianMarketValue: median(pickValues),
    cheapestCandidateSeen,
    cheapestBoughtPlayer: pickValues.length > 0 ? roundValue(Math.min(...pickValues), 2) : null,
    mostExpensiveBoughtPlayer: pickValues.length > 0 ? roundValue(Math.max(...pickValues), 2) : null,
    lanesPlannedVsActual: team.plannedPicks.map((pick) => ({
      step: pick.step,
      plannedLane: pick.budgetLane,
      actualPickLane: pick.pickLane,
      plannedAxisNeed: pick.plannedAxisNeed,
      actualPlayerPrimaryAxis: pick.actualPlayerPrimaryAxis,
      costBandExpected: pick.costBandExpected,
      costBandActual: pick.costBandActual,
      laneMatch: pick.laneMatch,
      axisMatch: pick.axisMatch,
      costBandMatch: pick.costBandMatch,
    })),
    teamIdentityScore:
      activePicks.length > 0
        ? roundValue(
            activePicks.reduce((sum, pick) => sum + (pick.teamFit ?? 0), 0) / activePicks.length,
            2,
          )
        : null,
    offThemeWarnings,
    hardBlockers,
  };
}

function buildGlobalSummary(picks: GlobalPickRow[]): AiPicksRunGlobalSummary {
  const classCounts = new Map<string, number>();
  const raceCounts = new Map<string, number>();
  const laneCounts = new Map<string, number>();
  let totalSpend = 0;
  let totalSalary = 0;
  let spendKnown = false;
  let salaryKnown = false;

  for (const pick of picks) {
    classCounts.set(pick.className, (classCounts.get(pick.className) ?? 0) + 1);
    raceCounts.set(pick.race, (raceCounts.get(pick.race) ?? 0) + 1);
    laneCounts.set(pick.pickLane, (laneCounts.get(pick.pickLane) ?? 0) + 1);
    if (pick.marketValue != null) {
      totalSpend += pick.marketValue;
      spendKnown = true;
    }
    if (pick.salary != null) {
      totalSalary += pick.salary;
      salaryKnown = true;
    }
  }

  const berserkerCount = picks.filter((pick) => normalizeToken(pick.className) === "berserker").length;
  const warlordCount = picks.filter((pick) => normalizeToken(pick.className) === "warlord").length;
  const superstarCount = picks.filter((pick) => pick.isSuperstar).length;
  const starCount = picks.filter((pick) => pick.isStar && !pick.isSuperstar).length;
  const berserkerWarlordSharePct =
    picks.length > 0 ? roundValue(((berserkerCount + warlordCount) / picks.length) * 100, 1) : null;

  const criticalPicks = [...picks]
    .sort((left, right) => {
      const leftCritical = left.scoreBreakdown.offThemePenalty + left.scoreBreakdown.classSpamPenalty + left.scoreBreakdown.duplicateProfilePenalty;
      const rightCritical = right.scoreBreakdown.offThemePenalty + right.scoreBreakdown.classSpamPenalty + right.scoreBreakdown.duplicateProfilePenalty;
      return leftCritical - rightCritical;
    })
    .slice(0, 20)
    .map((pick) => ({
      teamId: pick.teamId,
      teamName: pick.teamName,
      playerId: pick.playerId,
      playerName: pick.playerName,
      className: pick.className,
      aiScore: pick.aiScore,
      offThemePenalty: pick.scoreBreakdown.offThemePenalty,
      classSpamPenalty: pick.scoreBreakdown.classSpamPenalty,
      reason: pick.reasons[0] ?? "Kein Hauptgrund.",
    }));

  const strongestNeedFits = [...picks]
    .sort((left, right) => {
      if (right.scoreBreakdown.needMatchScore !== left.scoreBreakdown.needMatchScore) {
        return right.scoreBreakdown.needMatchScore - left.scoreBreakdown.needMatchScore;
      }
      return right.aiScore - left.aiScore;
    })
    .slice(0, 20)
    .map((pick) => ({
      teamId: pick.teamId,
      teamName: pick.teamName,
      playerId: pick.playerId,
      playerName: pick.playerName,
      className: pick.className,
      needLabel: pick.needLabel,
      aiScore: pick.aiScore,
      needMatchScore: pick.scoreBreakdown.needMatchScore,
      disciplineCoverageScore: pick.scoreBreakdown.disciplineCoverageScore,
    }));

  const bestTeamFitPicks = [...picks]
    .sort((left, right) => {
      if (right.scoreBreakdown.teamIdentityScore !== left.scoreBreakdown.teamIdentityScore) {
        return right.scoreBreakdown.teamIdentityScore - left.scoreBreakdown.teamIdentityScore;
      }
      return right.aiScore - left.aiScore;
    })
    .slice(0, 20)
    .map((pick) => ({
      teamId: pick.teamId,
      teamName: pick.teamName,
      playerId: pick.playerId,
      playerName: pick.playerName,
      className: pick.className,
      teamIdentityScore: pick.scoreBreakdown.teamIdentityScore,
      aiScore: pick.aiScore,
    }));

  return {
    plannedPickCount: picks.filter((pick) => pick.status === "planned").length,
    appliedPickCount: picks.filter((pick) => pick.status === "applied").length,
    totalSpend: spendKnown ? roundValue(totalSpend, 2) : null,
    totalSalary: salaryKnown ? roundValue(totalSalary, 2) : null,
    laneDistribution: sortCountEntries(laneCounts),
    classDistribution: sortCountEntries(classCounts),
    raceDistribution: sortCountEntries(raceCounts),
    berserkerCount,
    warlordCount,
    berserkerWarlordSharePct,
    superstarCount,
    starCount,
    criticalPicks,
    strongestNeedFits,
    bestTeamFitPicks,
  };
}

function buildQualityGate(
  teams: AiPicksRunTeamResult[],
  picks: GlobalPickRow[],
  options: { runMode?: AiNeedsPicksRunMode | null; seasonId?: string | null } = {},
): AiPicksRunQualityGate {
  const season1OptimumMode = options.runMode === "season1_optimum_execute";
  const planned = picks.filter((pick) => pick.status === "planned");
  const pickIsMinimumSkeleton = (pick: GlobalPickRow) => normalizeToken(pick.pickPhase) === "minimum_skeleton";
  const teamPlannedRosterCount = (team: AiPicksRunTeamResult) =>
    team.previewSummary.plannedRosterCount ??
    team.rosterBefore + team.plannedPicks.filter((pick) => pick.status !== "blocked").length;
  const teamExpectedMinimumReached = (team: AiPicksRunTeamResult) => {
    if (team.targetRosterMin == null) {
      return true;
    }
    const previewReached = team.previewSummary.expectedMinimumReached;
    if (previewReached != null) {
      return previewReached;
    }
    return teamPlannedRosterCount(team) >= team.targetRosterMin;
  };
  const teamTargetGap = (team: AiPicksRunTeamResult) => {
    const targetRoster = team.targetRosterSize ?? team.targetRosterOpt;
    if (targetRoster == null) {
      return null;
    }
    return Math.max(targetRoster - teamPlannedRosterCount(team), 0);
  };
  const teamStoppedOnQualityFloor = (team: AiPicksRunTeamResult) =>
    [...team.warnings, ...team.blockingReasons, ...team.previewSummary.hardBlockers].some(
      (reason) =>
        reason.includes("target_not_reachable_quality_floor") ||
        reason.includes("target_spend_not_reachable_no_quality_upgrade") ||
        reason.includes("no_legal_candidates_after_hard_filters") ||
        reason.includes("team_identity_pool_limited"),
    );
  const teamHasCleanPostMinimumQuality = (team: AiPicksRunTeamResult) => {
    if (!teamExpectedMinimumReached(team)) {
      return false;
    }
    const activePicks = team.plannedPicks.filter((pick) => pick.status !== "blocked");
    return activePicks.every(
      (pick) =>
        pick.aiScore >= 0 &&
        ((pick.scoreBreakdown.teamIdentityScore ?? 0) >= 0 || (pick.scoreBreakdown.mercenaryNegativeFitPenalty ?? 0) < 0) &&
        pick.strategicExceptionReason !== "value_pick_despite_theme_risk" &&
        pick.costBandMatch &&
        pickKeepsCashPositive({ ...pick, teamId: team.teamId, teamName: team.teamName, controlMode: team.controlMode }),
    );
  };
  const teamMayKeepCashForQuality = (team: AiPicksRunTeamResult) => {
    const gap = teamTargetGap(team);
    return teamHasCleanPostMinimumQuality(team) && (gap == null || gap <= 2 || teamStoppedOnQualityFloor(team));
  };
  const teamHasMinimumIntegrityBlocker = (team: AiPicksRunTeamResult) => {
    const hardBlockers = [
      ...team.previewSummary.hardBlockers,
      ...team.blockingReasons,
      ...(team.planner?.blockingReasons ?? []),
    ];
    if (hardBlockers.some((reason) => reason.startsWith("minimum_unreachable_"))) {
      return true;
    }
    return !teamExpectedMinimumReached(team);
  };
  const pickKeepsCashPositive = (pick: GlobalPickRow) => pick.expectedCashAfter == null || pick.expectedCashAfter >= -0.01;
  const pickHasIdentityOrNeedJustification = (pick: GlobalPickRow) =>
    pick.strategicExceptionReason != null ||
    pick.scoreBreakdown.needMatchScore >= 5 ||
    pick.scoreBreakdown.teamIdentityScore >= 5 ||
    pick.scoreBreakdown.valueScore >= 5;
  const pickHasMeaningfullyCheaperAlternative = (pick: GlobalPickRow) =>
    (pick.rejectedCheaperAlternatives?.length ?? 0) > 0 &&
    pick.priceDeltaVsCheapest != null &&
    pick.priceDeltaVsCheapest >= (pickIsMinimumSkeleton(pick) ? 6 : 8);
  const pickCanBeSoftenedInMinimumRun = (pick: GlobalPickRow) =>
    pickIsMinimumSkeleton(pick) && pick.minimumReachableAfterPick && pickKeepsCashPositive(pick) && pickHasIdentityOrNeedJustification(pick);
  const teamIsMinimumIntegrityOnly = (team: AiPicksRunTeamResult) => {
    if (team.targetRosterMin == null) {
      return false;
    }
    return teamPlannedRosterCount(team) <= team.targetRosterMin;
  };
  const plannedPickCount = planned.length;
  const berserkerWarlordCount = planned.filter((pick) => {
    const className = normalizeToken(pick.className);
    return className === "berserker" || className === "warlord";
  }).length;
  const superstarCount = planned.filter((pick) => pick.isSuperstar).length;
  const starCount = planned.filter((pick) => pick.isStar && !pick.isSuperstar).length;
  const offThemeCount = planned.filter(
    (pick) => pick.scoreBreakdown.offThemePenalty <= -4 || pick.scoreBreakdown.teamIdentityScore <= -5,
  ).length;
  const starPressureCount = planned.filter((pick) => pick.starPressureWarning != null).length;
  const classSpamCount = planned.filter((pick) => pick.scoreBreakdown.classSpamPenalty <= -4 || pick.scoreBreakdown.duplicateProfilePenalty <= -4).length;
  const berserkerWarlordSharePct =
    plannedPickCount > 0 ? roundValue((berserkerWarlordCount / plannedPickCount) * 100, 1) : null;
  const offThemeSharePct = plannedPickCount > 0 ? roundValue((offThemeCount / plannedPickCount) * 100, 1) : null;
  const classSpamSharePct = plannedPickCount > 0 ? roundValue((classSpamCount / plannedPickCount) * 100, 1) : null;
  const superstarSharePct = plannedPickCount > 0 ? roundValue((superstarCount / plannedPickCount) * 100, 1) : null;
  const starSharePct = plannedPickCount > 0 ? roundValue(((superstarCount + starCount) / plannedPickCount) * 100, 1) : null;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const plannerBlockingReasons = teams.flatMap((team) => team.planner?.blockingReasons ?? []);
  const minimumRosterFailedTeams = teams.filter((team) => {
    if (team.targetRosterMin == null) {
      return false;
    }
    const plannedCountForTeam = team.plannedPicks.filter((pick) => pick.status !== "blocked").length;
    return team.rosterBefore + plannedCountForTeam < team.targetRosterMin;
  });
  const cheapFillMisclassified = planned.filter(
    (pick) =>
      pick.pickLane === "cheap_fill" &&
      (pick.isStar ||
        pick.isSuperstar ||
        ["star", "superstar"].includes(normalizeToken(pick.costBandActual)) ||
        pickHasMeaningfullyCheaperAlternative(pick)),
  );
  const cheapFillIgnoredAffordableCandidates = planned.filter(
    (pick) =>
      pick.pickLane === "cheap_fill" &&
      !cheapFillMisclassified.includes(pick) &&
      (pick.rejectedCheaperAlternatives?.length ?? 0) > 0 &&
      pick.priceDeltaVsCheapest != null &&
      pick.priceDeltaVsCheapest >= 4,
  );
  const budgetReserveFailurePicks = planned.filter((pick) => !pick.minimumReachableAfterPick);
  const budgetReserveHardBlocks: GlobalPickRow[] = [];
  const budgetReserveWarnings: GlobalPickRow[] = [];
  for (const pick of budgetReserveFailurePicks) {
    const team = teams.find((entry) => entry.teamId === pick.teamId);
    if (!team || team.targetRosterMin == null) {
      budgetReserveHardBlocks.push(pick);
      continue;
    }
    const passingCount = team.plannedPicks.filter(
      (entry) => entry.status !== "blocked" && entry.minimumReachableAfterPick,
    ).length;
    const neededForMin = Math.max(team.targetRosterMin - team.rosterBefore, 0);
    if (passingCount >= neededForMin) {
      budgetReserveWarnings.push(pick);
    } else {
      budgetReserveHardBlocks.push(pick);
    }
  }
  const laneBudgetFailures = planned.filter(
    (pick) =>
      pick.laneBudgetLimit != null &&
      pick.laneBudgetUsed != null &&
      pick.laneBudgetUsed > pick.laneBudgetLimit + 0.01,
  );
  const missingCashStrategyTeams = teams.filter((team) => team.cashStrategy?.sourceStatus === "missing_source" || team.cashStrategy == null);
  const missingSpendArchitectureTeams = teams.filter(
    (team) =>
      team.cashStrategy == null ||
      team.cashStrategy.spendArchitecture == null ||
      team.cashStrategy.spendArchitecture.allowed_budget_for_search == null,
  );
  const missingFinancePostureTeams = teams.filter(
    (team) => team.cashStrategy == null || !team.cashStrategy.financePosture,
  );
  const missingSpendFactorTeams = teams.filter(
    (team) => team.cashStrategy != null && team.cashStrategy.spendFactor == null,
  );
  const missingAllowedBudgetTeams = teams.filter(
    (team) => team.cashStrategy != null && team.cashStrategy.allowedBudgetForSearch == null,
  );
  const fakePrizeRiskTeams = teams.filter(
    (team) =>
      team.cashStrategy != null &&
      team.cashStrategy.expectedPrizeSignal.prizeSourceStatus === "missing_source" &&
      team.cashStrategy.spendFactor != null &&
      team.cashStrategy.spendFactor > 1.2,
  );
  const shouldSaveCashViolations = teams.flatMap((team) =>
    team.cashStrategy?.shouldSaveCash
      ? team.plannedPicks
          .filter(
            (pick) =>
              pick.status !== "blocked" &&
              (pick.isStar ||
                pick.isSuperstar ||
                (pick.marketValue != null && pick.laneBudgetLimit != null && pick.marketValue > pick.laneBudgetLimit * 1.02)) &&
              (pick.scoreBreakdown.needMatchScore < 4 || pick.scoreBreakdown.teamIdentityScore < 3),
          )
          .map((pick) => ({
            teamId: team.teamId,
            playerId: pick.playerId,
          }))
      : [],
  );
  const pickAuthorizedLaneBudgetLimit = (pick: GlobalPickRow) => {
    const limits = [pick.laneBudgetLimit, pick.effectiveLaneCap, pick.phaseCap].filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
    );
    return limits.length > 0 ? Math.max(...limits) : pick.laneBudgetLimit;
  };
  const overspendWithoutNeed = planned.filter((pick) => {
    if (pick.marketValue == null) {
      return false;
    }
    const laneBudgetLimit = season1OptimumMode ? pickAuthorizedLaneBudgetLimit(pick) : pick.laneBudgetLimit;
    if (laneBudgetLimit == null) {
      return false;
    }
    if (season1OptimumMode && pick.capExceeded) {
      return false;
    }
    return (
      pick.marketValue > laneBudgetLimit * 1.04 &&
      pick.scoreBreakdown.needMatchScore < 4 &&
      pick.scoreBreakdown.teamIdentityScore < 3
    );
  });
  const superstarOverflowTeams = teams.filter((team) => {
    const allowed = team.planner?.superstarAllowed ?? 0;
    const plannedSuperstars = team.plannedPicks.filter((pick) => pick.status !== "blocked" && pick.isSuperstar).length;
    const permittedOverflow = team.targetRosterMin != null && team.rosterBefore >= team.targetRosterMin ? 1 : 0;
    return plannedSuperstars > Math.max(allowed, permittedOverflow);
  });
  const starOverflowTeams = teams.filter((team) => {
    const allowed = team.planner?.starAllowed ?? 0;
    const plannedStars = team.plannedPicks.filter((pick) => pick.status !== "blocked" && pick.isStar && !pick.isSuperstar).length;
    return plannedStars > allowed;
  });
  const laneMismatchPicks = planned.filter((pick) => !pick.laneMatch);
  const laneMismatchHardBlocks = laneMismatchPicks.filter((pick) => {
    if (pickCanBeSoftenedInMinimumRun(pick)) {
      return false;
    }
    if (
      season1OptimumMode &&
      pick.costBandMatch &&
      !["cheap_fill", "expensive_minimum_fill", "budget_risk_pick"].includes(normalizeToken(pick.pickLane)) &&
      ((pick.teamFit ?? 0) >= 3 || pick.scoreBreakdown.needMatchScore >= 4 || pick.scoreBreakdown.disciplineCoverageScore >= 5)
    ) {
      return false;
    }
    return true;
  });
  const laneMismatchWarningOnly = laneMismatchPicks.filter((pick) => !laneMismatchHardBlocks.includes(pick));
  const axisMismatchPicks = planned.filter((pick) => !pick.axisMatch);
  const costBandMismatchPicks = planned.filter((pick) => !pick.costBandMatch);
  const teamsOverspendingStartCash = teams.filter((team) => {
    const startingCash = team.previewSummary.startingCash;
    const plannedSpendTotal = team.previewSummary.plannedSpendTotal;
    return startingCash != null && plannedSpendTotal != null && plannedSpendTotal > startingCash + 0.01;
  });
  const teamsNegativeCashAfterPlan = teams.filter((team) => {
    const cashAfter = team.previewSummary.cashAfterPlannedBuys;
    return cashAfter != null && cashAfter < -0.01;
  });
  const teamsExceedingRequiredBuffer = teams.filter((team) => {
    const plannedSpendTotal = team.previewSummary.plannedSpendTotal;
    const availableBudget = team.previewSummary.availableCashAfterRequiredBuffer;
    return plannedSpendTotal != null && availableBudget != null && plannedSpendTotal > availableBudget + 0.01;
  });
  const teamsExceedingRequiredBufferHardBlock = teamsExceedingRequiredBuffer.filter(
    (team) =>
      !teamIsMinimumIntegrityOnly(team) &&
      (teamHasMinimumIntegrityBlocker(team) || (team.previewSummary.cashAfterPlannedBuys != null && team.previewSummary.cashAfterPlannedBuys < -0.01)),
  );
  const teamsExceedingRequiredBufferWarningOnly = teamsExceedingRequiredBuffer.filter(
    (team) => !teamsExceedingRequiredBufferHardBlock.includes(team),
  );
  const teamsOverNormalSeasonStartBudget = teams.filter((team) => {
    const plannedSpendTotal = team.previewSummary.plannedSpendTotal;
    const startingCash = team.previewSummary.startingCash;
    return plannedSpendTotal != null && startingCash != null && startingCash <= 400 && plannedSpendTotal >= 400;
  });
  const teamsIgnoringCheapCandidates = teams.filter((team) => {
    const cheapestCandidateSeen = team.previewSummary.cheapestCandidateSeen;
    const cheapestBoughtPlayer = team.previewSummary.cheapestBoughtPlayer;
    return (
      cheapestCandidateSeen != null &&
      cheapestBoughtPlayer != null &&
      cheapestCandidateSeen <= 20 &&
      cheapestBoughtPlayer - cheapestCandidateSeen >= 15
    );
  });
  const teamsWithTooExpensiveAverage = teams.filter((team) => {
    const avg = team.previewSummary.plannedAverageMarketValue;
    const cheapest = team.previewSummary.cheapestCandidateSeen;
    const startingCash = team.previewSummary.startingCash;
    if (avg == null || cheapest == null || startingCash == null) {
      return false;
    }
    if (startingCash <= 150) {
      return avg > Math.max(cheapest * 1.9, 24);
    }
    return avg > Math.max(cheapest * 2.2, 28);
  });
  const teamsWithGlobalMinimumBug = teams.filter((team) => {
    const minimum = team.targetRosterMin;
    const plannedRoster = team.previewSummary.plannedRosterCount;
    if (minimum == null || plannedRoster == null) {
      return false;
    }
    if (plannedRoster >= minimum) {
      return false;
    }
    return team.blockingReasons.every((reason) => !reason.startsWith("minimum_unreachable_"));
  });
  const teamsUnderMinimumWithoutReason = teams.filter((team) => {
    const minimum = team.targetRosterMin;
    const plannedRoster = team.previewSummary.plannedRosterCount;
    if (minimum == null || plannedRoster == null || plannedRoster >= minimum) {
      return false;
    }
    return !team.previewSummary.hardBlockers.some((reason) => reason.startsWith("minimum_unreachable_"));
  });
  const focusTeams = teams.filter((team) => isFocusTeam(team.teamCode));
  const earlyPhaseCapExceeded = planned.filter(
    (pick) =>
      pick.capExceeded &&
      ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase)),
  );
  const cheapFillHardBlocks = cheapFillMisclassified.filter(
    (pick) =>
      (pick.cheaperMinimumSafeAlternativeAvailable ||
        (pickHasMeaningfullyCheaperAlternative(pick) &&
          !pickHasIdentityOrNeedJustification(pick))) &&
      pickKeepsCashPositive(pick) &&
      pick.minimumReachableAfterPick,
  );
  const cheapFillWarningOnly = cheapFillMisclassified.filter((pick) => !cheapFillHardBlocks.includes(pick));
  const earlyPhaseCapHardBlocks = earlyPhaseCapExceeded.filter((pick) => {
    const severeOvercap =
      pick.marketValue != null &&
      pick.phaseCap != null &&
      pick.phaseCap > 0 &&
      pick.marketValue > pick.phaseCap * 1.35;
    const cheaperAlternativeExists =
      pick.cheaperAlternativeAvailable || (pick.rejectedCheaperAlternatives?.length ?? 0) > 0;
    return (
      !pickHasIdentityOrNeedJustification(pick) &&
      cheaperAlternativeExists &&
      pickKeepsCashPositive(pick) &&
      pick.minimumReachableAfterPick &&
      (severeOvercap || !pick.minimumSecured)
    );
  });
  const earlyPhaseCapWarningOnly = earlyPhaseCapExceeded.filter((pick) => !earlyPhaseCapHardBlocks.includes(pick));
  const focusTeamOffTheme = focusTeams.filter((team) =>
    team.plannedPicks.some(
      (pick) => pick.status !== "blocked" && (pick.scoreBreakdown.offThemePenalty <= -4 || (pick.teamFit ?? 0) < 1.5),
    ),
  );
  const focusTeamIdentityTooLow = focusTeams.filter((team) => {
    const identity = team.previewSummary.teamIdentityScore;
    return identity != null && identity < 2.5;
  });
  const focusTeamLaneMismatch = focusTeams.filter((team) =>
    team.plannedPicks.some(
      (pick) =>
        pick.status !== "blocked" &&
        !pick.laneMatch &&
        !(
          season1OptimumMode &&
          pick.costBandMatch &&
          ((pick.teamFit ?? 0) >= 4 || pick.scoreBreakdown.needMatchScore >= 4 || pick.scoreBreakdown.disciplineCoverageScore >= 5)
        ) &&
        !pickCanBeSoftenedInMinimumRun({ ...pick, teamId: team.teamId, teamName: team.teamName, controlMode: team.controlMode }),
    ),
  );
  const focusTeamWrongAxis = focusTeams.filter((team) =>
    team.plannedPicks.some((pick) => pick.status !== "blocked" && !pick.axisMatch),
  );
  const focusTeamTooExpensive = focusTeams.filter((team) => {
    if (season1OptimumMode) {
      return false;
    }
    const expensivePickCount = team.plannedPicks.filter(
      (pick) =>
        pick.status !== "blocked" &&
        (((pick.marketValue ?? 0) >= 30 && ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase))) ||
          (pick.capExceeded && ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase))) ||
          pick.isStar ||
          pick.isSuperstar),
    ).length;
    if (expensivePickCount < 3) {
      return false;
    }
    return team.plannedPicks.some(
      (pick) =>
        pick.status !== "blocked" &&
        (((pick.marketValue ?? 0) >= 30 && ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase))) ||
          (pick.capExceeded && ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase))) ||
          pick.isStar ||
          pick.isSuperstar) &&
        !pickCanBeSoftenedInMinimumRun({ ...pick, teamId: team.teamId, teamName: team.teamName, controlMode: team.controlMode }),
    );
  });
  const focusTeamTooExpensiveWarningOnly = focusTeams.filter(
    (team) =>
      !focusTeamTooExpensive.includes(team) &&
      team.plannedPicks.some(
        (pick) =>
          pick.status !== "blocked" &&
          (((pick.marketValue ?? 0) >= 30 && ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase))) ||
            (pick.capExceeded && ["minimum_skeleton", "early_core", "specialist_fill"].includes(normalizeToken(pick.pickPhase))) ||
            pick.isStar ||
            pick.isSuperstar),
      ),
  );
  const focusTeamNoCoreIdentity = focusTeams.filter((team) => {
    const activePicks = team.plannedPicks.filter((pick) => pick.status !== "blocked");
    if (activePicks.length === 0) {
      return false;
    }
    if (
      season1OptimumMode &&
      activePicks.filter((pick) => (pick.teamFit ?? 0) >= 4 || pick.scoreBreakdown.teamIdentityScore >= 4).length >=
        Math.min(4, activePicks.length)
    ) {
      return false;
    }
    return !activePicks.some(
      (pick) =>
        ["core", "core_investment", "specialist", "specialist_investment"].includes(normalizeToken(pick.pickLane)) &&
        (pick.teamFit ?? 0) >= 3,
    );
  });
  const mayhemUnderinvested = season1OptimumMode
    ? teams.filter((team) => {
        if (team.teamCode !== "M-M") {
          return false;
        }
        const cashAfter = team.previewSummary.cashAfterPlannedBuys;
        const plannedRoster = team.previewSummary.plannedRosterCount ?? team.rosterAfter;
        const targetOpt = team.targetRosterOpt ?? team.targetRosterSize;
        const impactPicks = team.plannedPicks.filter(
          (pick) =>
            pick.status !== "blocked" &&
            ((pick.marketValue ?? 0) >= 25 ||
              ["core_investment", "specialist_investment", "star_pick", "superstar_pick"].includes(normalizeToken(pick.pickLane))) &&
            ((pick.teamFit ?? 0) >= 4 || pick.scoreBreakdown.needMatchScore >= 4),
        ).length;
        return (
          cashAfter != null &&
          cashAfter > 50 &&
          (targetOpt == null || plannedRoster < targetOpt || impactPicks < 2)
        );
      })
    : [];
  const coldSteelIdentityBreak = season1OptimumMode
    ? teams.filter((team) => {
        if (team.teamCode !== "C-S") {
          return false;
        }
        const themeBreakers = team.plannedPicks.filter(
          (pick) => pick.status !== "blocked" && isColdSteelThemeBreaker(pick.className, pick.race),
        );
        return themeBreakers.length > 1;
      })
    : [];
  const season1UnderSpendTeams = season1OptimumMode
    ? teams.filter((team) => {
        const startingCash = team.previewSummary.startingCash;
        const cashAfter = team.previewSummary.cashAfterPlannedBuys;
        const plannedRoster = team.previewSummary.plannedRosterCount ?? team.rosterAfter;
        if (startingCash == null || cashAfter == null || startingCash <= 0) {
          return false;
        }
        if (team.targetRosterMin != null && plannedRoster < team.targetRosterMin) {
          return false;
        }
        const spendFloorPct = team.cashStrategy?.season1SpendMinPct ?? getSeason1SpendTargetPctForTeamCode(team.teamCode);
        const targetCashLeft = startingCash * (1 - spendFloorPct);
        const allowedSlack = Math.max(8, startingCash * 0.03);
        return cashAfter > targetCashLeft + allowedSlack;
      })
    : [];
  const teamsIgnoringCheapCandidatesWarningOnly = season1OptimumMode
    ? teamsIgnoringCheapCandidates.filter((team) => teamMayKeepCashForQuality(team))
    : [];
  const teamsIgnoringCheapCandidatesHardBlock = teamsIgnoringCheapCandidates.filter(
    (team) => !teamsIgnoringCheapCandidatesWarningOnly.includes(team),
  );
  const season1UnderSpendWarningOnly = season1OptimumMode
    ? season1UnderSpendTeams.filter((team) => {
        const plannedRoster = team.previewSummary.plannedRosterCount ?? team.rosterAfter;
        if (team.targetRosterMin != null && plannedRoster >= team.targetRosterMin) {
          return true;
        }
        return teamMayKeepCashForQuality(team);
      })
    : [];
  const season1UnderSpendHardBlock = season1UnderSpendTeams.filter(
    (team) => !season1UnderSpendWarningOnly.includes(team),
  );
  const formatSeason1SpendFloorMiss = (team: AiPicksRunTeamResult) => {
    const startingCash = team.previewSummary.startingCash ?? 0;
    const spendFloorPct = team.cashStrategy?.season1SpendMinPct ?? getSeason1SpendTargetPctForTeamCode(team.teamCode);
    const targetCashLeft = startingCash * (1 - spendFloorPct);
    return `${team.teamCode}:cash_after=${team.previewSummary.cashAfterPlannedBuys != null ? roundValue(team.previewSummary.cashAfterPlannedBuys, 2) : "na"}:floor_left=${roundValue(targetCashLeft, 2)}:archetype=${team.cashStrategy?.season1SpendArchetype ?? "unknown"}:target_gap=${teamTargetGap(team) ?? "na"}`;
  };

  if (plannedPickCount === 0) {
    blockingReasons.push("ai_pick_quality_gate_failed:no_planned_picks");
  }
  if (plannerBlockingReasons.length > 0) {
    blockingReasons.push(...plannerBlockingReasons.map((entry) => `ai_pick_lane_gate_failed:${entry}`));
  }
  if (missingCashStrategyTeams.length > 0) {
    blockingReasons.push(...missingCashStrategyTeams.map((team) => `cash_strategy_missing:${team.teamCode}`));
  }
  if (missingSpendArchitectureTeams.length > 0) {
    blockingReasons.push(...missingSpendArchitectureTeams.map((team) => `spend_architecture_missing:${team.teamCode}`));
  }
  if (missingFinancePostureTeams.length > 0) {
    blockingReasons.push(...missingFinancePostureTeams.map((team) => `finance_posture_missing:${team.teamCode}`));
  }
  if (missingSpendFactorTeams.length > 0) {
    blockingReasons.push(...missingSpendFactorTeams.map((team) => `spend_factor_missing:${team.teamCode}`));
  }
  if (missingAllowedBudgetTeams.length > 0) {
    blockingReasons.push(...missingAllowedBudgetTeams.map((team) => `allowed_budget_for_search_missing:${team.teamCode}`));
  }
  if (fakePrizeRiskTeams.length > 0) {
    warnings.push(...fakePrizeRiskTeams.map((team) => `expected_prize_source_missing:${team.teamCode}`));
  }
  if ((berserkerWarlordSharePct ?? 0) > 40) {
    blockingReasons.push("ai_pick_quality_gate_failed:berserker_warlord_share_too_high");
  }
  if ((superstarSharePct ?? 0) > 18 && plannedPickCount >= 6) {
    blockingReasons.push("ai_pick_quality_gate_failed:superstar_share_too_high");
  }
  if ((starSharePct ?? 0) > 42 && plannedPickCount >= 4) {
    blockingReasons.push("ai_pick_quality_gate_failed:star_share_too_high");
  }
  if ((classSpamSharePct ?? 0) > 35) {
    warnings.push(
      "Mehrere Picks tragen Classspam-Malus — Duplikate ab dem 4. Spieler derselben Klasse werden im Scoring automatisch abgewertet.",
    );
  }
  if (starPressureCount > 0) {
    warnings.push(`AI-Picks mit Star-Druck gefunden: ${starPressureCount}`);
  }
  if (plannedPickCount >= 8 && starPressureCount / plannedPickCount > 0.33) {
    blockingReasons.push("ai_pick_lane_gate_failed:star_pick_before_core_depth_needs");
  }
  if (minimumRosterFailedTeams.length > 0) {
    blockingReasons.push(
      ...minimumRosterFailedTeams.map(
        (team) =>
          `minimum_roster_gate_failed:${team.teamCode}:${team.rosterBefore + team.plannedPicks.filter((pick) => pick.status !== "blocked").length}/${team.targetRosterMin}`,
      ),
    );
  }
  if (teamsOverspendingStartCash.length > 0) {
    blockingReasons.push(
      ...teamsOverspendingStartCash.map((team) => `planned_spend_exceeds_starting_cash:${team.teamCode}`),
    );
  }
  if (teamsNegativeCashAfterPlan.length > 0) {
    blockingReasons.push(
      ...teamsNegativeCashAfterPlan.map((team) => `cash_after_planned_buys_below_zero:${team.teamCode}`),
    );
  }
  if (teamsExceedingRequiredBufferHardBlock.length > 0) {
    blockingReasons.push(
      ...teamsExceedingRequiredBufferHardBlock.map((team) => `planned_spend_exceeds_required_buffer:${team.teamCode}`),
    );
  }
  if (teamsExceedingRequiredBuffer.length > 0) {
    warnings.push(
      ...teamsExceedingRequiredBuffer.map((team) => {
        const biggest = [...team.plannedPicks]
          .filter((pick) => pick.status !== "blocked")
          .sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0))[0];
        const prefix = teamsExceedingRequiredBufferWarningOnly.includes(team)
          ? "planned_spend_exceeds_required_buffer_warning"
          : "buffer_debug";
        return `${prefix}:${team.teamCode}:start=${team.previewSummary.startingCash ?? "na"}:spend=${team.previewSummary.plannedSpendTotal ?? "na"}:reserve=${team.cashStrategy?.reservedCashForMinimum ?? "na"}:after=${team.previewSummary.cashAfterPlannedBuys ?? "na"}:pick=${biggest?.playerName ?? "none"}:phase=${biggest?.pickPhase ?? "na"}:lane=${biggest?.pickLane ?? "na"}:cap=${biggest?.phaseCap ?? biggest?.laneBudgetLimit ?? "na"}`;
      }),
    );
  }
  if (teamsOverNormalSeasonStartBudget.length > 0) {
    blockingReasons.push(
      ...teamsOverNormalSeasonStartBudget.map((team) => `normal_budget_window_exceeded:${team.teamCode}`),
    );
  }
  if (teamsWithGlobalMinimumBug.length > 0) {
    blockingReasons.push(...teamsWithGlobalMinimumBug.map((team) => `global_minimum_phase_bug:${team.teamCode}`));
  }
  if (teamsUnderMinimumWithoutReason.length > 0) {
    blockingReasons.push(
      ...teamsUnderMinimumWithoutReason.map((team) => `minimum_unreachable_reason_missing:${team.teamCode}`),
    );
  }
  if (cheapFillHardBlocks.length > 0) {
    blockingReasons.push(
      ...cheapFillHardBlocks.map(
        (pick) =>
          `cheap_fill_classification_failed:${pick.teamId}:${pick.playerId}:${pick.marketValue != null ? roundValue(pick.marketValue, 2) : "missing_price"}`,
      ),
    );
  }
  if (cheapFillWarningOnly.length > 0) {
    warnings.push(
      ...cheapFillWarningOnly.map(
        (pick) =>
          `cheap_fill_classification_warning:${pick.teamId}:${pick.playerId}:${pick.marketValue != null ? roundValue(pick.marketValue, 2) : "missing_price"}`,
      ),
    );
  }
  if (earlyPhaseCapHardBlocks.length > 0) {
    blockingReasons.push(
      ...earlyPhaseCapHardBlocks.map(
        (pick) =>
          `early_phase_cap_exceeded:${pick.teamId}:${pick.playerId}:${pick.pickPhase}:${pick.marketValue != null ? roundValue(pick.marketValue, 2) : "missing_price"}>${pick.phaseCap != null ? roundValue(pick.phaseCap, 2) : "missing_cap"}`,
      ),
    );
  }
  if (earlyPhaseCapWarningOnly.length > 0) {
    warnings.push(
      ...earlyPhaseCapWarningOnly.map(
        (pick) =>
          `early_phase_cap_warning:${pick.teamId}:${pick.playerId}:${pick.pickPhase}:identity_fit=${roundValue(pick.scoreBreakdown.teamIdentityScore ?? 0, 2)}:budget_after=${pick.expectedCashAfter != null ? roundValue(pick.expectedCashAfter, 2) : "na"}:why_allowed=${normalizeToken(pick.strategicExceptionReason) || "need_or_identity"}`,
      ),
    );
  }
  if (budgetReserveHardBlocks.length > 0) {
    blockingReasons.push(
      ...budgetReserveHardBlocks.map(
        (pick) =>
          `cash_reserve_gate_failed:${pick.teamId}:${pick.playerId}:${pick.remainingMinimumReserve != null ? roundValue(pick.remainingMinimumReserve, 2) : "missing_reserve"}`,
      ),
    );
  }
  if (budgetReserveWarnings.length > 0) {
    warnings.push(
      ...budgetReserveWarnings.map(
        (pick) =>
          `cash_reserve_gate_failed_warning:${pick.teamId}:${pick.playerId}:${pick.remainingMinimumReserve != null ? roundValue(pick.remainingMinimumReserve, 2) : "missing_reserve"}`,
      ),
    );
  }
  if (laneBudgetFailures.length > 0) {
    warnings.push(
      ...laneBudgetFailures.map(
        (pick) =>
          `budget_lane_exceeded:${pick.teamId}:${pick.playerId}:${roundValue((pick.laneBudgetUsed ?? 0) - (pick.laneBudgetLimit ?? 0), 2)}`,
      ),
    );
  }
  if (shouldSaveCashViolations.length > 0) {
    blockingReasons.push(
      ...shouldSaveCashViolations.map((pick) => `should_save_cash_instead:${pick.teamId}:${pick.playerId}`),
    );
  }
  if (overspendWithoutNeed.length > 0) {
    blockingReasons.push(
      ...overspendWithoutNeed.map((pick) => `overspend_without_need:${pick.teamId}:${pick.playerId}`),
    );
  }
  if (superstarOverflowTeams.length > 0) {
    blockingReasons.push(
      ...superstarOverflowTeams.map((team) => `ai_pick_lane_gate_failed:superstar_lane_overflow:${team.teamCode}`),
    );
  }
  if (starOverflowTeams.length > 0) {
    blockingReasons.push(...starOverflowTeams.map((team) => `ai_pick_lane_gate_failed:star_lane_overflow:${team.teamCode}`));
  }
  if (laneMismatchHardBlocks.length > 0) {
    blockingReasons.push(...laneMismatchHardBlocks.map((pick) => `lane_mismatch:${pick.teamId}:${pick.playerId}`));
  }
  if (laneMismatchWarningOnly.length > 0) {
    warnings.push(...laneMismatchWarningOnly.map((pick) => `lane_mismatch_warning:${pick.teamId}:${pick.playerId}`));
  }
  if (axisMismatchPicks.length > 0) {
    warnings.push(...axisMismatchPicks.map((pick) => `axis_mismatch:${pick.teamId}:${pick.playerId}`));
  }
  if (costBandMismatchPicks.length > 0) {
    warnings.push(...costBandMismatchPicks.map((pick) => `cost_band_mismatch:${pick.teamId}:${pick.playerId}`));
  }
  if (cheapFillIgnoredAffordableCandidates.length > 0) {
    warnings.push(
      ...cheapFillIgnoredAffordableCandidates.map(
        (pick) =>
          `cheap_fill_ignored_affordable_candidate:${pick.teamId}:${pick.playerId}:${pick.priceDeltaVsCheapest != null ? roundValue(pick.priceDeltaVsCheapest, 2) : "missing_delta"}`,
      ),
    );
  }
  if (teamsIgnoringCheapCandidatesHardBlock.length > 0) {
    blockingReasons.push(
      ...teamsIgnoringCheapCandidatesHardBlock.map((team) => `cheap_players_visible_but_ignored:${team.teamCode}`),
    );
  }
  if (teamsIgnoringCheapCandidatesWarningOnly.length > 0) {
    warnings.push(
      ...teamsIgnoringCheapCandidatesWarningOnly.map((team) => `cheap_players_visible_but_ignored_warning:${team.teamCode}`),
    );
  }
  if (teamsWithTooExpensiveAverage.length > 0) {
    warnings.push(...teamsWithTooExpensiveAverage.map((team) => `planned_average_market_value_high:${team.teamCode}`));
  }
  if (focusTeamOffTheme.length > 0) {
    warnings.push(...focusTeamOffTheme.map((team) => `focus_team_off_theme_warning:${team.teamCode}`));
  }
  if (focusTeamIdentityTooLow.length > 0) {
    blockingReasons.push(...focusTeamIdentityTooLow.map((team) => `focus_team_identity_too_low:${team.teamCode}`));
  }
  if (focusTeamLaneMismatch.length > 0) {
    blockingReasons.push(...focusTeamLaneMismatch.map((team) => `focus_team_lane_plan_mismatch:${team.teamCode}`));
  }
  if (focusTeamWrongAxis.length > 0) {
    blockingReasons.push(...focusTeamWrongAxis.map((team) => `focus_team_wrong_axis_pick:${team.teamCode}`));
  }
  if (focusTeamTooExpensive.length > 0) {
    blockingReasons.push(...focusTeamTooExpensive.map((team) => `focus_team_too_many_expensive_picks:${team.teamCode}`));
  }
  if (focusTeamTooExpensiveWarningOnly.length > 0) {
    warnings.push(...focusTeamTooExpensiveWarningOnly.map((team) => `focus_team_expensive_pick_warning:${team.teamCode}`));
  }
  if (focusTeamNoCoreIdentity.length > 0) {
    blockingReasons.push(...focusTeamNoCoreIdentity.map((team) => `focus_team_no_core_identity_built:${team.teamCode}`));
  }
  if (mayhemUnderinvested.length > 0) {
    blockingReasons.push(...mayhemUnderinvested.map((team) => `top_team_underinvested:${team.teamCode}`));
  }
  if (coldSteelIdentityBreak.length > 0) {
    blockingReasons.push(...coldSteelIdentityBreak.map((team) => `cold_steel_identity_break:${team.teamCode}`));
  }
  if (season1UnderSpendHardBlock.length > 0) {
    blockingReasons.push(
      ...season1UnderSpendHardBlock.map((team) => `season1_spend_floor_missed:${formatSeason1SpendFloorMiss(team)}`),
    );
  }
  if (season1UnderSpendWarningOnly.length > 0) {
    warnings.push(
      ...season1UnderSpendWarningOnly.map((team) => `season1_spend_floor_missed_warning:${formatSeason1SpendFloorMiss(team)}`),
    );
  }
  if ((berserkerWarlordSharePct ?? 0) > 28 && (berserkerWarlordSharePct ?? 0) <= 40) {
    warnings.push("Berserker/Warlord-Anteil ist noch merklich hoch.");
  }
  if ((starSharePct ?? 0) > 25 && ((starSharePct ?? 0) <= 42 || plannedPickCount < 4)) {
    warnings.push("Star-Lanes nehmen noch einen spuerbaren Teil des Pick-Budgets ein.");
  }
  if ((offThemeSharePct ?? 0) > 35) {
    warnings.push("Viele Picks weichen sichtbar vom Kernthema ab, bleiben aber als strategische Ausnahmen erlaubt.");
  } else if ((offThemeSharePct ?? 0) > 20) {
    warnings.push("Mehrere Picks tragen noch einen deutlichen Off-Theme-Malus.");
  }
  if ((offThemeSharePct ?? 0) > 20 && planned.some((pick) => pick.scoreBreakdown.needMatchScore >= 5 || pick.scoreBreakdown.disciplineCoverageScore >= 5)) {
    warnings.push("Off-Theme-Picks bleiben aktiv, weil Need-, Diszi- oder Kaderbalance-Signale sie strategisch tragen.");
  }
  if (laneBudgetFailures.length > 0) {
    warnings.push("Mindestens ein Pick liegt ueber dem geplanten Lane-Budget.");
  }
  if (budgetReserveFailurePicks.length > 0) {
    warnings.push("Mindestens ein Pick gefaehrdet die Cash-Reserve fuer den Mindestkader.");
  }
  if (shouldSaveCashViolations.length > 0) {
    warnings.push("Mindestens ein Team sollte laut Cash-Strategie eher sparen als teuer weiterkaufen.");
  }
  if (earlyPhaseCapExceeded.length > 0) {
    warnings.push("Fruehe Core-/Specialist-Phasen enthalten noch zu teure Picks oberhalb des Phasen-Caps.");
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    metrics: {
      plannedPickCount,
      berserkerWarlordSharePct,
      offThemeSharePct,
      classSpamSharePct,
      superstarSharePct,
      starSharePct,
    },
  };
}

async function buildTeamPreviewEntry(input: {
  saveId: string;
  seasonId: string;
  team: Team;
  gameState: GameState;
  teamScope: "ai" | "all";
  stepsPerTeam: number;
  runMode: AiNeedsPicksRunMode;
  excludedPlayerIds?: string[];
  candidateLimit?: number;
  candidateFullScoringLimit?: number;
  candidateScopeMode?: "strategic" | "budget_wide";
  draftSeed?: string | null;
  localRunContext?: LocalTransfermarktRunContext | null;
}) {
  const compare = await buildAiNeedsPicksCompare({
    source: "sqlite",
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.team.teamId,
    teamScope: "all",
    steps: input.stepsPerTeam,
    limit: input.candidateLimit ?? 120,
    fullScoringLimit: input.candidateFullScoringLimit ?? null,
    candidateScopeMode: input.candidateScopeMode ?? "budget_wide",
    excludedPlayerIds: input.excludedPlayerIds ?? [],
    runMode: input.runMode,
    draftSeed: input.draftSeed ?? null,
    gameState: input.gameState,
    localRunContext: input.localRunContext ?? null,
  });
  const compareEntry = compare.teams[0] ?? null;
  const snapshot = buildTeamEconomySnapshot(input.gameState, input.team);
  const targetInfo = resolveTargetRoster(input.team, input.gameState, input.runMode);
  const existingAutoTransfers = getExistingAutoTransfers(input.gameState, input.team.teamId);
  const controlMode =
    getTeamControlSettings(input.gameState, input.team.teamId)?.controlMode ??
    (input.team.humanControlled ? "manual" : "ai");

  const emptyEntry: AiPicksRunTeamResult = {
    teamId: input.team.teamId,
    teamCode: input.team.shortCode,
    teamName: input.team.name,
    controlMode,
    targetRosterMin: compareEntry?.currentRosterState.targetRosterMin ?? null,
    targetRosterOpt: compareEntry?.currentRosterState.targetRosterOpt ?? targetInfo.targetRosterSize,
    targetRosterSize: targetInfo.targetRosterSize,
    targetSource: targetInfo.targetSource,
    rosterBefore: snapshot.rosterCount,
    rosterAfter: snapshot.rosterCount,
    missingBefore: targetInfo.targetRosterSize != null ? Math.max(targetInfo.targetRosterSize - snapshot.rosterCount, 0) : null,
    missingAfter: targetInfo.targetRosterSize != null ? Math.max(targetInfo.targetRosterSize - snapshot.rosterCount, 0) : null,
    cashBefore: snapshot.cash,
    cashAfter: snapshot.cash,
    salaryBefore: snapshot.salaryTotal,
    salaryAfter: snapshot.salaryTotal,
    existingAutoTransfers: existingAutoTransfers.length,
    resetState: existingAutoTransfers.length > 0 ? "auto_transfers_present" : "already_clean",
    planner: compareEntry ? mapPlannerRef(compareEntry) : null,
    cashStrategy: compareEntry ? mapCashStrategyRef(compareEntry) : null,
    openNeeds: compareEntry ? mapNeedRefs(compareEntry) : [],
    budgetLanes: compareEntry ? mapBudgetRefs(compareEntry) : [],
    plannedPicks:
      targetInfo.targetRosterSize != null && snapshot.rosterCount >= targetInfo.targetRosterSize
        ? []
        : compareEntry
          ? buildRunPreviewPicks(compareEntry, input.gameState)
          : [],
    transferHistoryIds: [],
    previewSummary: {
      startingCash: snapshot.cash,
      plannedSpendTotal: 0,
      cashAfterPlannedBuys: snapshot.cash,
      availableCashAfterRequiredBuffer: null,
      plannedRosterCount: snapshot.rosterCount,
      expectedMinimumReached: compareEntry?.currentRosterState.targetRosterMin != null ? snapshot.rosterCount >= compareEntry.currentRosterState.targetRosterMin : null,
      plannedAverageMarketValue: null,
      plannedMedianMarketValue: null,
      cheapestCandidateSeen: null,
      cheapestBoughtPlayer: null,
      mostExpensiveBoughtPlayer: null,
      lanesPlannedVsActual: [],
      teamIdentityScore: null,
      offThemeWarnings: [],
      hardBlockers: [],
    },
    warnings: unique([
      ...(compareEntry?.warnings ?? []),
      ...(compareEntry?.planner.warnings ?? []),
      ...(compareEntry?.cashStrategy.warnings ?? []),
      targetInfo.targetRosterSize != null && snapshot.rosterCount >= targetInfo.targetRosterSize
        ? "target_roster_already_reached_no_pick"
        : null,
    ].filter((entry): entry is string => Boolean(entry))),
    blockingReasons: compareEntry ? [...compareEntry.planner.blockingReasons] : ["compare_entry_missing"],
  };

  emptyEntry.previewSummary = buildTeamPreviewSummary(emptyEntry, compareEntry);
  emptyEntry.rosterAfter = emptyEntry.previewSummary.plannedRosterCount ?? emptyEntry.rosterBefore;
  emptyEntry.missingAfter =
    emptyEntry.targetRosterSize != null
      ? Math.max(emptyEntry.targetRosterSize - emptyEntry.rosterAfter, 0)
      : null;
  emptyEntry.cashAfter = emptyEntry.previewSummary.cashAfterPlannedBuys ?? emptyEntry.cashBefore;
  emptyEntry.salaryAfter =
    compareEntry?.currentRosterState.salaryTotal ??
    emptyEntry.plannedPicks.reduce((sum, pick) => sum + (pick.salary ?? 0), emptyEntry.salaryBefore ?? 0);

  return emptyEntry;
}

async function buildTeamPreviewEntryWithDraftState(input: {
  saveId: string;
  seasonId: string;
  team: Team;
  gameState: GameState;
  teamScope: "ai" | "all";
  stepsPerTeam: number;
  runMode: AiNeedsPicksRunMode;
  excludedPlayerIds: string[];
  draftSeed?: string | null;
  localRunContext?: LocalTransfermarktRunContext | null;
}) {
  const fullFreeAgentPoolSize = getFreeAgentPoolSize(input.gameState);
  const teamCode = input.team.shortCode || input.team.teamId;
  const focusFullScoring = teamCode === "H-R";
  const liveSetupMode = input.runMode === "season1_optimum_execute";
  const rosterCount = getTeamRosterPlayers(input.gameState, input.team.teamId).length;
  const targetRosterMin =
    input.team.rosterMinTarget != null && Number.isFinite(input.team.rosterMinTarget)
      ? Math.round(input.team.rosterMinTarget)
      : null;
  const underMinimumRoster = targetRosterMin != null && rosterCount < targetRosterMin;
  const fullScoringWindow = focusFullScoring
    ? Math.min(fullFreeAgentPoolSize, liveSetupMode ? 320 : 960)
    : Math.min(
        fullFreeAgentPoolSize,
        liveSetupMode ? (underMinimumRoster ? 320 : 200) : 480,
      );
  const candidateWindow = liveSetupMode
    ? Math.min(fullFreeAgentPoolSize, Math.max(fullScoringWindow * 2, 480))
    : fullFreeAgentPoolSize;
  const previewTeam = await buildTeamPreviewEntry({
    ...input,
    candidateLimit: Math.max(10, candidateWindow),
    candidateFullScoringLimit: fullScoringWindow,
    candidateScopeMode: "budget_wide",
    localRunContext: input.localRunContext ?? null,
  });

  previewTeam.warnings = unique([
    ...previewTeam.warnings,
    `free_agent_pool_available:${fullFreeAgentPoolSize}`,
    `ai_candidate_scope:budget_wide`,
    liveSetupMode ? `ai_lane_scoped_execute:${candidateWindow}` : `ai_budget_affordable_scan:${candidateWindow}`,
    underMinimumRoster ? `minimum_rescue_candidate_window:${teamCode}:${rosterCount}/${targetRosterMin}` : null,
    focusFullScoring ? `focus_team_buy_preview_window:${teamCode}:${fullScoringWindow}` : `buy_preview_shortlist:${fullScoringWindow}_plus_cheap_coverage`,
    input.excludedPlayerIds.length > 0 ? `global_reserved_players:${input.excludedPlayerIds.length}` : null,
  ].filter((entry): entry is string => Boolean(entry)));

  if (previewTeam.blockingReasons.includes("minimum_unreachable_no_legal_candidates")) {
    previewTeam.blockingReasons = previewTeam.blockingReasons.map((reason) =>
      reason === "minimum_unreachable_no_legal_candidates" ? "no_legal_candidates_after_hard_filters" : reason,
    );
  }

  const targetRoster = previewTeam.targetRosterSize ?? previewTeam.targetRosterOpt ?? null;
  const plannedRoster = previewTeam.previewSummary.plannedRosterCount ?? previewTeam.rosterBefore;
  const cashAfter = previewTeam.previewSummary.cashAfterPlannedBuys;
  const startingCash = previewTeam.previewSummary.startingCash;
  if (
    input.runMode === "season1_optimum_execute" &&
    targetRoster != null &&
    plannedRoster < targetRoster &&
    cashAfter != null &&
    startingCash != null &&
    cashAfter > Math.max(24, startingCash * 0.12)
  ) {
    previewTeam.warnings = unique([
      ...previewTeam.warnings,
      "target_spend_not_reachable_no_quality_upgrade",
    ]);
  }

  return previewTeam;
}

function buildRunPreflight(input: {
  saveId: string;
  seasonId: string;
  gameState: GameState;
  teamScope: "ai" | "all";
  allowSetupAllTeams: boolean;
  previewTeams: AiPicksRunTeamResult[];
  localRunContext?: unknown;
}) {
  const freeAgentFeed = listLocalTransfermarktFreeAgents({
    saveId: input.saveId,
    seasonId: input.seasonId,
    mode: "ai_preview",
    limit: 1,
    localRunContext: input.localRunContext,
  });
  const cheapestVisible = freeAgentFeed.poolAudit.cheapestVisiblePlayer?.marketValue ?? null;
  const cheapestCandidate = input.previewTeams.reduce<number | null>((lowest, team) => {
    const current = team.previewSummary.cheapestCandidateSeen;
    if (current == null) return lowest;
    return lowest == null ? current : Math.min(lowest, current);
  }, null);
  const rostersEmpty = input.gameState.rosters.length === 0;
  const historyEmpty = input.gameState.transferHistory.length === 0;
  const cashConsistent = input.gameState.teams.every((team) => Number.isFinite(team.cash));
  const freeAgentsAffordable =
    cheapestCandidate != null ? cheapestCandidate <= 20 : cheapestVisible != null && cheapestVisible <= 20;
  const previewMinimumSecured = input.previewTeams.every((team) => team.previewSummary.expectedMinimumReached !== false);
  const candidatePoolMatchesMarket =
    cheapestVisible == null || cheapestCandidate == null ? false : cheapestCandidate <= cheapestVisible + 5;

  const checks: AiPicksRunPreflightCheck[] = [
    {
      key: "save_scope",
      status: "ok",
      detail: `Save ${input.saveId} / ${input.seasonId} lokal aufgeloest.`,
    },
    {
      key: "rosters_empty",
      status: rostersEmpty ? "ok" : "warning",
      detail: rostersEmpty ? "Alle aktiven Kader sind leer." : `Es existieren noch ${input.gameState.rosters.length} aktive Roster-Eintraege.`,
    },
    {
      key: "transfer_history_empty",
      status: historyEmpty ? "ok" : "warning",
      detail: historyEmpty ? "Transferhistorie ist auf Season-Start-Null." : `Es existieren noch ${input.gameState.transferHistory.length} Transfereintraege.`,
    },
    {
      key: "cash_consistent",
      status: cashConsistent ? "ok" : "blocked",
      detail: cashConsistent ? "Team-Cash ist im aktuellen GameState fuer alle Teams verfuegbar." : "Mindestens ein Team hat keinen gueltigen Cash-Wert.",
    },
    {
      key: "free_agents_affordable",
      status: freeAgentsAffordable ? "ok" : previewMinimumSecured ? "warning" : "blocked",
      detail:
        cheapestCandidate != null
          ? `Guenstigster AI-Full-Pool-Kandidat liegt bei ${roundValue(cheapestCandidate, 2)}.`
          : cheapestVisible != null
            ? `Guenstigster sichtbarer Free Agent liegt bei ${roundValue(cheapestVisible, 2)}.`
          : "Keine sichtbaren Free Agents vorhanden.",
    },
    {
      key: "candidate_pool_matches_market",
      status: candidatePoolMatchesMarket ? "ok" : "warning",
      detail:
        cheapestVisible != null || cheapestCandidate != null
          ? `Diagnose: sichtbarer Markt-Slice ${cheapestVisible ?? "—"} vs. AI-Full-Pool ${cheapestCandidate ?? "—"}.`
          : "Kein belastbarer Vergleich zwischen Markt und AI-Kandidatenpool moeglich.",
    },
  ];

  return {
    checks,
    freeAgentFeed,
  };
}

function flattenGlobalPicks(teams: AiPicksRunTeamResult[]): GlobalPickRow[] {
  return teams.flatMap((team) =>
    team.plannedPicks.map((pick) => ({
      ...pick,
      teamId: team.teamId,
      teamName: team.teamName,
      controlMode: team.controlMode,
    })),
  );
}

function buildTraceParity(input: {
  previewTeams: AiPicksRunTeamResult[];
  executedTeams: AiPicksRunTeamResult[];
}) {
  const previewRows = flattenGlobalPicks(input.previewTeams)
    .filter((pick) => pick.status !== "blocked")
    .sort((left, right) => left.teamId.localeCompare(right.teamId, "de") || left.step - right.step);
  const executedRows = flattenGlobalPicks(input.executedTeams)
    .filter((pick) => pick.status === "applied")
    .sort((left, right) => left.teamId.localeCompare(right.teamId, "de") || left.step - right.step);

  const previewKeys = previewRows.map((row) => `${row.teamId}:${row.step}`);
  const executeKeys = executedRows.map((row) => `${row.teamId}:${row.step}`);
  const sameTeams =
    unique(previewRows.map((row) => row.teamId)).join("|") === unique(executedRows.map((row) => row.teamId)).join("|");
  const sameOrder = previewKeys.join("|") === executeKeys.join("|");
  const differences: AiPicksRunResult["traceParity"]["traceDifferences"] = [];

  const allKeys = unique([...previewKeys, ...executeKeys]);
  for (const key of allKeys) {
    const preview = previewRows.find((row) => `${row.teamId}:${row.step}` === key) ?? null;
    const executed = executedRows.find((row) => `${row.teamId}:${row.step}` === key) ?? null;
    const [teamId, rawStep] = key.split(":");
    const step = Number(rawStep);
    const teamName = preview?.teamName ?? executed?.teamName ?? teamId;

    if (!preview || !executed) {
      differences.push({
        teamId,
        teamName,
        step,
        field: !preview || !executed ? "team" : "order",
        dryRunValue: preview?.playerName ?? null,
        executeValue: executed?.playerName ?? null,
        reason: "Team oder Pick fehlt zwischen DryRun und Execute.",
      });
      continue;
    }

    if (preview.playerId !== executed.playerId) {
      differences.push({
        teamId,
        teamName,
        step,
        field: "player",
        dryRunValue: preview.playerName,
        executeValue: executed.playerName,
        reason: "Execute hat einen anderen Spieler gekauft als der DryRun geplant hat.",
      });
    }
    if (preview.pickLane !== executed.pickLane) {
      differences.push({
        teamId,
        teamName,
        step,
        field: "lane",
        dryRunValue: preview.pickLane,
        executeValue: executed.pickLane,
        reason: "Lane oder Roster-Rolle ist zwischen DryRun und Execute verschoben.",
      });
    }
    const previewCost = preview.marketValue ?? null;
    const executeCost = executed.marketValue ?? null;
    if (previewCost !== executeCost) {
      differences.push({
        teamId,
        teamName,
        step,
        field: "cost",
        dryRunValue: previewCost,
        executeValue: executeCost,
        reason: "Ablöse oder Preisbasis ist zwischen DryRun und Execute abgewichen.",
      });
    }
  }

  const samePlayers = !differences.some((entry) => entry.field === "player");
  const sameLanes = !differences.some((entry) => entry.field === "lane");
  const sameCosts = !differences.some((entry) => entry.field === "cost");
  const dryRunExecuteTraceMatch =
    previewRows.length === executedRows.length &&
    sameTeams &&
    sameOrder &&
    samePlayers &&
    sameLanes &&
    sameCosts;

  return {
    dryRunExecuteTraceMatch,
    dryRunPickCount: previewRows.length,
    executePickCount: executedRows.length,
    sameTeams,
    samePlayers,
    sameOrder,
    sameLanes,
    sameCosts,
    traceDifferences: differences,
  };
}

function chooseTeams(gameState: GameState, teamScope: "ai" | "all", allowSetupAllTeams: boolean, teamIds?: string[] | null) {
  const requestedTeamIds = new Set((teamIds ?? []).map((teamId) => teamId.trim()).filter(Boolean));
  return gameState.teams.filter((team) => {
    if (requestedTeamIds.size > 0 && !requestedTeamIds.has(team.teamId)) {
      return false;
    }
    const controlMode = getTeamControlSettings(gameState, team.teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
    if (teamScope === "all" && allowSetupAllTeams) {
      return true;
    }
    return controlMode === "ai";
  });
}

function getFreeAgentPoolSize(gameState: GameState) {
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  return gameState.players.filter((player) => !rosterPlayerIds.has(player.id)).length;
}

function getDraftOrderRank(gameState: GameState, team: Team) {
  const rank = gameState.seasonState.standings[team.teamId]?.rank;
  return typeof rank === "number" && Number.isFinite(rank) ? rank : null;
}

function orderTeamsForDraft(gameState: GameState, teams: Team[]) {
  return [...teams].sort((left, right) => {
    const leftRank = getDraftOrderRank(gameState, left);
    const rightRank = getDraftOrderRank(gameState, right);
    if (leftRank != null && rightRank != null && leftRank !== rightRank) {
      return rightRank - leftRank;
    }
    if (leftRank != null && rightRank == null) return -1;
    if (leftRank == null && rightRank != null) return 1;
    return teams.indexOf(left) - teams.indexOf(right);
  });
}

function getActiveControlMode(gameState: GameState, teamId: string): TeamControlMode {
  return getTeamControlSettings(gameState, teamId)?.controlMode ?? (gameState.teams.find((team) => team.teamId === teamId)?.humanControlled ? "manual" : "ai");
}

/** Builds the `${teamId}:${playerId}` key used to track pick-level exclusions. */
function buildPickExclusionKey(teamId: string, playerId: string) {
  return `${teamId}:${playerId}`;
}

function isSeason1HardMinTeamExecutionBlocker(team: AiPicksRunTeamResult) {
  if (team.blockingReasons.some((reason) => reason.startsWith("minimum_unreachable_"))) {
    return true;
  }
  if (team.targetRosterMin == null) {
    return false;
  }
  const plannedCount = team.plannedPicks.filter((pick) => pick.status !== "blocked").length;
  return team.rosterBefore + plannedCount < team.targetRosterMin;
}

function shouldContinueExecuteAfterPickDrift(input: {
  runMode: AiNeedsPicksRunMode;
  rosterCount: number;
  rosterMinTarget: number | null;
}) {
  return (
    input.runMode === "season1_optimum_execute" &&
    input.rosterMinTarget != null &&
    input.rosterCount < input.rosterMinTarget
  );
}

type Season1LiveSubstituteCandidate = {
  playerId: string;
  name: string;
  className: string | null;
  race: string | null;
  marketValue: number | null;
  salary: number | null;
  ovr: number | null;
  mvs: number | null;
};

function resolveSeason1ExecuteLiveSubstitute(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamRunContext: LocalTransfermarktRunContext;
  liveTakenPlayerIds: Set<string>;
  excludedPlayerIds: Set<string>;
  useFastBatchExecute: boolean;
  maxPrice?: number | null;
  slotLane?: MarketPickLane;
  bestNeedDisciplineId?: string | null;
  brackets?: LeagueMarketBrackets;
  freeAgents?: TransfermarktFreeAgentItem[];
  teamCash?: number;
  affordabilityCash?: number;
}): Season1LiveSubstituteCandidate | null {
  const unavailable = new Set<string>([...input.liveTakenPlayerIds, ...input.excludedPlayerIds]);
  const affordabilityCash =
    input.affordabilityCash ??
    (input.teamCash != null
      ? input.teamCash
      : resolveExecuteAffordabilityCash({
          teamRunContext: input.teamRunContext,
          teamId: input.teamId,
        }));
  if (
    input.slotLane &&
    input.brackets &&
    input.freeAgents &&
    affordabilityCash != null
  ) {
    const live = resolveExecuteLivePickForSlot({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      teamRunContext: input.teamRunContext,
      slotLane: input.slotLane,
      bestNeedDisciplineId: input.bestNeedDisciplineId ?? null,
      affordabilityCash,
      unavailablePlayerIds: unavailable,
      brackets: input.brackets,
      slotPriceCeiling: input.maxPrice ?? null,
      freeAgents: input.freeAgents,
      useFastBatchExecute: input.useFastBatchExecute,
      allowMinFillFallback: true,
    });
    if (live) {
      return live;
    }
  }
  const freeAgents =
    input.freeAgents ??
    listExecuteFreeAgentsForSlot({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      teamRunContext: input.teamRunContext,
      slotLane: input.slotLane ?? "depth",
      brackets: input.brackets ?? buildLeagueMarketBrackets([]),
      slotPriceCeiling: input.maxPrice ?? null,
      affordabilityCash,
      includeCheapFillFallback: true,
    });
  const candidates = freeAgents
    .filter((item) => !unavailable.has(item.playerId))
    .filter((item) => item.marketValue != null && item.marketValue > 0)
    .filter(
      (item) =>
        input.maxPrice == null ||
        !Number.isFinite(input.maxPrice) ||
        (item.marketValue ?? Number.MAX_SAFE_INTEGER) <= input.maxPrice + 0.01,
    )
    .sort(
      (left, right) =>
        (left.marketValue ?? Number.MAX_SAFE_INTEGER) - (right.marketValue ?? Number.MAX_SAFE_INTEGER),
    );
  for (const candidate of candidates) {
    if (!input.useFastBatchExecute) {
      const buyPreview = previewLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        playerId: candidate.playerId,
        transferSource: "ai_roster_fill",
        localRunContext: input.teamRunContext,
      });
      if (!buyPreview.canBuy) {
        continue;
      }
    }
    return {
      playerId: candidate.playerId,
      name: candidate.name,
      className: candidate.className ?? null,
      race: candidate.race ?? null,
      marketValue: candidate.marketValue ?? null,
      salary: candidate.salary ?? null,
      ovr: candidate.ovr ?? null,
      mvs: candidate.mvs ?? null,
    };
  }
  return null;
}

function buildExecuteLivePick(
  slotTemplate: AiPicksRunPick,
  live: ExecuteLivePickCandidate,
  sourceLabel = "execute_live_lane_pick",
): AiPicksRunPick {
  const actualLane = classifyActualPickLaneFromMarketValue(live.marketValue ?? slotTemplate.marketValue);
  return {
    ...slotTemplate,
    playerId: live.playerId,
    playerName: live.name,
    className: live.className ?? slotTemplate.className,
    race: live.race ?? slotTemplate.race,
    marketValue: live.marketValue ?? slotTemplate.marketValue,
    salary: live.salary ?? slotTemplate.salary,
    ovr: live.ovr ?? slotTemplate.ovr,
    mvs: live.mvs ?? slotTemplate.mvs,
    pickLane: slotTemplate.plannedLane || slotTemplate.pickLane || slotTemplate.budgetLane,
    isSuperstar: actualLane.isSuperstar,
    isStar: actualLane.isStar,
    primaryReason: sourceLabel,
    laneReason: `${sourceLabel}:${slotTemplate.plannedLane || slotTemplate.budgetLane}:${live.playerId}`,
    reasons: unique([
      ...slotTemplate.reasons,
      `${sourceLabel}:${slotTemplate.step}:${live.playerId}:needRank=${live.needRankScore.toFixed(1)}`,
    ]),
    warnings: unique([
      ...slotTemplate.warnings,
      slotTemplate.playerId !== live.playerId
        ? `${sourceLabel}_replaced_planned:${slotTemplate.playerId}→${live.playerId}`
        : `${sourceLabel}_confirmed:${live.playerId}`,
      normalizeToken(slotTemplate.pickLane) !== normalizeToken(actualLane.pickLane)
        ? `${sourceLabel}_mw_band:${slotTemplate.pickLane}→${actualLane.pickLane}`
        : null,
    ]),
  };
}

function buildSeason1ExecuteSubstitutePick(
  frozenPick: AiPicksRunPick,
  substitute: Season1LiveSubstituteCandidate,
  originalPlayerId: string,
): AiPicksRunPick {
  return buildExecuteLivePick(
    frozenPick,
    {
      playerId: substitute.playerId,
      name: substitute.name,
      className: substitute.className,
      race: substitute.race,
      marketValue: substitute.marketValue,
      salary: substitute.salary,
      ovr: substitute.ovr,
      mvs: substitute.mvs,
      needRankScore: 0,
    },
    `season1_execute_live_substitute:${originalPlayerId}`,
  );
}

function runSeason1ExecuteEmergencyMinFill(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamName: string;
  teamCode: string;
  controlMode: TeamControlMode;
  rosterMinTarget: number;
  teamRunContext: LocalTransfermarktRunContext;
  useFastBatchExecute: boolean;
  executedPicks: AiPicksRunPick[];
  executedGlobalRows: GlobalPickRow[];
  transferHistoryIds: string[];
  visibleTransferIds: string[];
  excludedPlayerIds: Set<string>;
  liveTakenPlayerIds: Set<string>;
  startingStep: number;
}) {
  let emergencyFillCount = 0;
  const maxEmergencyAttempts = 24;
  for (let attempt = 0; attempt < maxEmergencyAttempts; attempt += 1) {
    const currentTeam =
      input.teamRunContext.save.gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
    if (!currentTeam) {
      break;
    }
    const rosterCount = buildTeamEconomySnapshot(input.teamRunContext.save.gameState, currentTeam).rosterCount;
    if (rosterCount >= input.rosterMinTarget) {
      break;
    }
    const affordabilityCash = resolveExecuteAffordabilityCash({
      teamRunContext: input.teamRunContext,
      teamId: input.teamId,
    });
    const freeAgents = listExecuteFreeAgentsForSlot({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      teamRunContext: input.teamRunContext,
      slotLane: "cheap_fill",
      brackets: buildLeagueMarketBrackets(
        input.teamRunContext.save.gameState.players.map(
          (player) => player.marketValue ?? player.displayMarketValue ?? null,
        ),
      ),
      affordabilityCash,
      includeCheapFillFallback: true,
    });
    const candidates = freeAgents
      .filter((item) => !input.excludedPlayerIds.has(item.playerId) && !input.liveTakenPlayerIds.has(item.playerId))
      .filter((item) => item.marketValue != null && item.marketValue > 0)
      .filter((item) => canExecuteAffordPick(item.marketValue, affordabilityCash))
      .sort((left, right) => (left.marketValue ?? Number.MAX_SAFE_INTEGER) - (right.marketValue ?? Number.MAX_SAFE_INTEGER));
    let bought = false;
    for (const candidate of candidates) {
      if (!input.useFastBatchExecute) {
        const buyPreview = previewLocalTransfermarktBuy({
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamId: input.teamId,
          playerId: candidate.playerId,
          transferSource: "ai_roster_fill",
          localRunContext: input.teamRunContext,
        });
        if (!buyPreview.canBuy) {
          continue;
        }
      }
      const buyResult = executeLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        playerId: candidate.playerId,
        transferSource: "ai_roster_fill",
        fastLocalBatch: input.useFastBatchExecute,
        localRunContext: input.teamRunContext,
        deferPersist: true,
      });
      if (!buyResult.transferCreated || !buyResult.transferId) {
        continue;
      }
      const appliedPick: AiPicksRunPick = {
        step: input.startingStep + emergencyFillCount + 1,
        playerId: candidate.playerId,
        playerName: candidate.name,
        className: candidate.className,
        race: candidate.race,
        marketValue: buyResult.purchasePrice ?? candidate.marketValue,
        salary: buyResult.salary ?? null,
        ovr: candidate.ovr,
        mvs: candidate.mvs,
        budgetLane: "cheap_fill",
        pickLane: "cheap_fill",
        plannedLane: "cheap_fill",
        laneReason: "season1_execute_emergency_min_fill",
        laneBudgetLimit: null,
        laneBudgetUsed: null,
        effectiveLaneCap: null,
        phaseCap: null,
        capExceeded: false,
        capOverrideReason: null,
        budgetStretchApplied: false,
        budgetStretchReason: null,
        budgetStretchPhaseAllowed: false,
        budgetStretchBlockedReason: null,
        isSuperstar: false,
        isStar: false,
        starPressureWarning: null,
        cheaperAlternativeAvailable: false,
        cheaperMinimumSafeAlternativeAvailable: false,
        specialistNeedFilled: false,
        coreNeedFilled: false,
        depthNeedFilled: true,
        minimumReachableAfterPick: true,
        remainingMinimumReserve: null,
        needLabel: null,
        primaryReason: "season1_execute_emergency_min_fill",
        secondaryReason: null,
        bestNeedDisciplineId: null,
        aiScore: 0,
        pickScore: 0,
        teamFit: null,
        budgetFit: null,
        rosterRole: null,
        pickPhase: "minimum_skeleton",
        teamCashTier: null,
        minimumSecured: true,
        reserveSecured: true,
        mustFeelRightScore: null,
        mustFeelRightWarning: null,
        draftSeed: null,
        baseScore: null,
        tieBreakJitter: null,
        scoreWithSeed: null,
        tieBreakBand: null,
        strategicExceptionReason: "season1_execute_emergency_min_fill",
        pickedForFormColor: false,
        formColorReason: null,
        scoreBreakdown: {
          playerQualityScore: 0,
          needMatchScore: 0,
          disciplineCoverageScore: 0,
          teamAxisFitScore: 0,
          teamThemeFitScore: 0,
          classFitScore: 0,
          raceOrArchetypeFitScore: 0,
          teamIdentityScore: 0,
          formColorCoverageScore: 0,
          formColorFlexScore: 0,
          classDisciplineFitScore: 0,
          rosterBalanceScore: 0,
          budgetFitScore: 0,
          laneFitScore: 0,
          valueScore: 0,
          harmonyFitScore: 0,
          harmonyPenalty: 0,
          riskPenalty: 0,
          duplicateProfilePenalty: 0,
          offThemePenalty: 0,
          classSpamPenalty: 0,
          colorspamPenalty: 0,
          evenSpreadPenalty: 0,
          mercenaryNegativeFitPenalty: 0,
        },
        reasons: ["season1_execute_emergency_min_fill"],
        warnings: [...buyResult.warnings, "season1_execute_emergency_min_fill"],
        expectedCashAfter: buyResult.cashAfter ?? null,
        expectedSalaryAfter: buyResult.salaryAfter ?? null,
        expectedRosterAfter: buyResult.rosterAfter ?? null,
        transferHistoryId: buyResult.transferId,
        status: "applied",
        plannedAxisNeed: null,
        actualPlayerPrimaryAxis: null,
        costBandExpected: "cheap_fill",
        costBandActual: "cheap_fill",
        laneMatch: true,
        axisMatch: true,
        costBandMatch: true,
        cheapestCandidateSeen: candidate.marketValue,
        cheapestCandidateSameAxis: null,
        cheapestCandidateSameTeamFitBand: null,
        cheapestCandidateSameClassFamily: null,
        priceDeltaVsCheapest: null,
        valueJustification: [],
        rejectedCheaperAlternatives: [],
        auditWarnings: [],
      };
      input.executedPicks.push(appliedPick);
      input.transferHistoryIds.push(buyResult.transferId);
      input.visibleTransferIds.push(buyResult.transferId);
      input.excludedPlayerIds.add(candidate.playerId);
      input.liveTakenPlayerIds.add(candidate.playerId);
      input.executedGlobalRows.push({
        ...appliedPick,
        teamId: input.teamId,
        teamName: input.teamName,
        controlMode: input.controlMode,
      });
      emergencyFillCount += 1;
      bought = true;
      break;
    }
    if (!bought) {
      break;
    }
  }
  return emergencyFillCount;
}

/**
 * Organic-squad-builder execute path for ONE team (flag: OLY_ORGANIC_SQUAD_BUILDER, default OFF).
 *
 * SELF-CONTAINED: replaces the entire per-team execute body (frozenTrace loop + spend-down/emergency
 * fills + team-end flush + result push) when the flag is on, so the flag-off default path stays
 * byte-identical. It reuses the same buy primitive (`executeLocalTransfermarktBuy`, deferPersist),
 * the same result collections (executedPicks/transferHistoryIds/visibleTransferIds/executedGlobalRows),
 * the same taken-id tracking (liveTakenPlayerIds) and the same per-team flush + AiPicksRunTeamResult
 * shape as the default path — only the buy SELECTION comes from the organic builder instead of the
 * frozen preview trace.
 */
function runOrganicTeamDraftExecute(input: {
  saveId: string;
  seasonId: string;
  persistence: PersistenceService;
  teamRunContext: LocalTransfermarktRunContext;
  latestTeam: Team;
  previewTeam: AiPicksRunTeamResult;
  activeControlMode: TeamControlMode;
  targetInfo: ReturnType<typeof resolveTargetRoster>;
  beforeSnapshot: ReturnType<typeof buildTeamEconomySnapshot>;
  useFastBatchExecute: boolean;
  executedPicks: AiPicksRunPick[];
  transferHistoryIds: string[];
  visibleTransferIds: string[];
  missingTransferIds: string[];
  executedGlobalRows: GlobalPickRow[];
  executedTeams: AiPicksRunTeamResult[];
  liveTakenPlayerIds: Set<string>;
  teamTimings: Map<string, {
    teamId: string;
    teamCode: string;
    teamName: string;
    previewMs: number;
    executeMs: number;
    totalMs: number;
    plannedPicks: number;
    appliedPicks: number;
  }>;
  teamExecuteStartedAt: number;
  teamWarnings: string[];
  teamBlockingReasons: string[];
}) {
  const {
    saveId,
    seasonId,
    persistence,
    teamRunContext,
    latestTeam,
    previewTeam,
    activeControlMode,
    targetInfo,
    beforeSnapshot,
    useFastBatchExecute,
    executedPicks,
    transferHistoryIds,
    visibleTransferIds,
    missingTransferIds,
    executedGlobalRows,
    executedTeams,
    liveTakenPlayerIds,
    teamTimings,
    teamExecuteStartedAt,
    teamWarnings,
    teamBlockingReasons,
  } = input;

  const gameState = teamRunContext.save.gameState;
  const teamId = latestTeam.teamId;

  // 2. startingSquad = the team's current roster as domain Players (their disciplines feed coverage).
  const rosterPlayerIds = new Set(getTeamRosterPlayers(gameState, teamId).map((item) => item.player.id));
  const startingSquad = getTeamRosterPlayers(gameState, teamId).map((item) => item.player);

  // 1. candidates = currently-available free agents mapped to domain Players (real coreStats /
  //    disciplineRatings, not the market items), excluding taken + already-rostered players.
  const freeAgentItems = listLocalTransfermarktFreeAgents({
    saveId,
    seasonId,
    teamId,
    mode: "ai_preview",
    localRunContext: teamRunContext,
    fullPool: true,
  }).items;
  const freeAgentItemsById = new Map<string, TransfermarktFreeAgentItem>(
    freeAgentItems.map((item) => [item.playerId, item]),
  );
  const playersById = new Map<string, Player>(gameState.players.map((player) => [player.id, player]));
  const candidates: Player[] = [];
  for (const item of freeAgentItems) {
    if (liveTakenPlayerIds.has(item.playerId) || rosterPlayerIds.has(item.playerId)) continue;
    const player = playersById.get(item.playerId);
    if (player) candidates.push(player);
  }

  // 3. Run the organic plan for this team.
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const plan = planOrganicDraftForTeam({
    gameState,
    team: latestTeam,
    identity,
    startingSquad,
    candidates,
    draftSeed: `${saveId}:${teamId}`,
  });
  teamWarnings.push(`organic_squad_builder:decisions=${plan.decisions.length}`);
  if (plan.stoppedBelowMin) {
    teamWarnings.push("organic_squad_builder_stopped_below_min");
  }

  // 4. Execute each decision in order via the shared buy primitive. The plan is a RANKED wishlist,
  //    so a single unbuyable pick (raced/taken between plan and apply, or a transient price/validation
  //    edge) must NOT abort the whole team — skip it and try the next decision. Each buy is validated
  //    against live cash independently, so continuing can only ever fill MORE of the roster, never
  //    overspend. This is the clean "don't hang the draft" behaviour (no emergency repair): a team
  //    whose top pick fell through still drafts the rest of its ranked plan instead of ending empty.
  let appliedCount = 0;
  for (const decision of plan.decisions) {
    if (liveTakenPlayerIds.has(decision.playerId)) continue;
    const buyResult = executeLocalTransfermarktBuy({
      saveId,
      seasonId,
      teamId,
      playerId: decision.playerId,
      transferSource: "ai_roster_fill",
      fastLocalBatch: useFastBatchExecute,
      localRunContext: teamRunContext,
      deferPersist: true,
    });
    if (!buyResult.transferCreated || !buyResult.transferId) {
      teamBlockingReasons.push(...buyResult.blockingReasons, "organic_squad_builder_buy_skipped");
      continue;
    }
    const item = freeAgentItemsById.get(decision.playerId) ?? null;
    const player = playersById.get(decision.playerId) ?? null;
    const appliedPick: AiPicksRunPick = {
      step: appliedCount + 1,
      playerId: decision.playerId,
      playerName: item?.name ?? player?.name ?? decision.playerId,
      className: item?.className ?? player?.className ?? "",
      race: item?.race ?? player?.race ?? "",
      marketValue: buyResult.purchasePrice ?? item?.marketValue ?? null,
      salary: buyResult.salary ?? item?.salary ?? null,
      ovr: item?.ovr ?? null,
      mvs: item?.mvs ?? null,
      budgetLane: "organic_fill",
      pickLane: "organic_fill",
      plannedLane: "organic_fill",
      laneReason: "organic_squad_builder",
      laneBudgetLimit: null,
      laneBudgetUsed: null,
      effectiveLaneCap: null,
      phaseCap: null,
      capExceeded: false,
      capOverrideReason: null,
      budgetStretchApplied: false,
      budgetStretchReason: null,
      budgetStretchPhaseAllowed: false,
      budgetStretchBlockedReason: null,
      isSuperstar: false,
      isStar: false,
      starPressureWarning: null,
      cheaperAlternativeAvailable: false,
      cheaperMinimumSafeAlternativeAvailable: false,
      specialistNeedFilled: false,
      coreNeedFilled: false,
      depthNeedFilled: true,
      minimumReachableAfterPick: true,
      remainingMinimumReserve: null,
      needLabel: null,
      primaryReason: "organic_squad_builder",
      secondaryReason: null,
      bestNeedDisciplineId: null,
      aiScore: decision.utility,
      pickScore: decision.utility,
      teamFit: null,
      budgetFit: null,
      rosterRole: null,
      pickPhase: "organic_squad_builder",
      teamCashTier: null,
      minimumSecured: true,
      reserveSecured: true,
      mustFeelRightScore: null,
      mustFeelRightWarning: null,
      draftSeed: null,
      baseScore: null,
      tieBreakJitter: null,
      scoreWithSeed: null,
      tieBreakBand: null,
      strategicExceptionReason: "organic_squad_builder",
      pickedForFormColor: false,
      formColorReason: null,
      scoreBreakdown: {
        playerQualityScore: 0,
        needMatchScore: 0,
        disciplineCoverageScore: 0,
        teamAxisFitScore: 0,
        teamThemeFitScore: 0,
        classFitScore: 0,
        raceOrArchetypeFitScore: 0,
        teamIdentityScore: 0,
        formColorCoverageScore: 0,
        formColorFlexScore: 0,
        classDisciplineFitScore: 0,
        rosterBalanceScore: 0,
        budgetFitScore: 0,
        laneFitScore: 0,
        valueScore: 0,
        harmonyFitScore: 0,
        harmonyPenalty: 0,
        riskPenalty: 0,
        duplicateProfilePenalty: 0,
        offThemePenalty: 0,
        classSpamPenalty: 0,
        colorspamPenalty: 0,
        evenSpreadPenalty: 0,
        mercenaryNegativeFitPenalty: 0,
      },
      reasons: ["organic_squad_builder"],
      warnings: [...buyResult.warnings],
      expectedCashAfter: buyResult.cashAfter ?? null,
      expectedSalaryAfter: buyResult.salaryAfter ?? null,
      expectedRosterAfter: buyResult.rosterAfter ?? null,
      transferHistoryId: buyResult.transferId,
      status: "applied",
      plannedAxisNeed: null,
      actualPlayerPrimaryAxis: null,
      costBandExpected: null,
      costBandActual: null,
      laneMatch: true,
      axisMatch: true,
      costBandMatch: true,
      cheapestCandidateSeen: item?.marketValue ?? null,
      cheapestCandidateSameAxis: null,
      cheapestCandidateSameTeamFitBand: null,
      cheapestCandidateSameClassFamily: null,
      priceDeltaVsCheapest: null,
      valueJustification: [],
      rejectedCheaperAlternatives: [],
      auditWarnings: [],
    };
    executedPicks.push(appliedPick);
    transferHistoryIds.push(buyResult.transferId);
    visibleTransferIds.push(buyResult.transferId);
    liveTakenPlayerIds.add(decision.playerId);
    executedGlobalRows.push({
      ...appliedPick,
      teamId: previewTeam.teamId,
      teamName: previewTeam.teamName,
      controlMode: activeControlMode,
    });
    appliedCount += 1;
  }

  // Team-end flush + result push + timing (mirrors the default path's per-team tail).
  const afterSave = teamRunContext.deferredWrites > 0
    ? flushLocalTransfermarktRunContext(teamRunContext)
    : resolveStrictLocalSave(persistence, saveId);
  const afterTeam = afterSave.gameState.teams.find((entry) => entry.teamId === teamId) ?? latestTeam;
  for (const transferId of transferHistoryIds) {
    if (!afterSave.gameState.transferHistory.some((entry) => entry.id === transferId)) {
      missingTransferIds.push(transferId);
    }
  }
  const afterSnapshot = buildTeamEconomySnapshot(afterSave.gameState, afterTeam);
  const executedTeam: AiPicksRunTeamResult = {
    ...previewTeam,
    controlMode: activeControlMode,
    targetRosterSize: targetInfo.targetRosterSize,
    targetSource: targetInfo.targetSource,
    rosterBefore: beforeSnapshot.rosterCount,
    rosterAfter: afterSnapshot.rosterCount,
    missingBefore: targetInfo.targetRosterSize != null ? Math.max(targetInfo.targetRosterSize - beforeSnapshot.rosterCount, 0) : null,
    missingAfter: targetInfo.targetRosterSize != null ? Math.max(targetInfo.targetRosterSize - afterSnapshot.rosterCount, 0) : null,
    cashBefore: beforeSnapshot.cash,
    cashAfter: afterSnapshot.cash,
    salaryBefore: beforeSnapshot.salaryTotal,
    salaryAfter: afterSnapshot.salaryTotal,
    plannedPicks: executedPicks,
    transferHistoryIds,
    warnings: unique(teamWarnings),
    blockingReasons: unique(teamBlockingReasons),
    previewSummary: previewTeam.previewSummary,
  };
  executedTeam.previewSummary = buildTeamPreviewSummary(executedTeam);
  executedTeams.push(executedTeam);
  const timing = teamTimings.get(previewTeam.teamId);
  const executeMs = Date.now() - teamExecuteStartedAt;
  if (timing) {
    timing.executeMs = executeMs;
    timing.totalMs = timing.previewMs + executeMs;
    timing.appliedPicks = executedPicks.filter((pick) => pick.status === "applied").length;
  }
}

function runSeason1ExecuteSpendDownTopUp(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamName: string;
  teamCode: string;
  controlMode: TeamControlMode;
  playerMax: number | null;
  previewTeam: AiPicksRunTeamResult;
  teamRunContext: LocalTransfermarktRunContext;
  useFastBatchExecute: boolean;
  executedPicks: AiPicksRunPick[];
  executedGlobalRows: GlobalPickRow[];
  transferHistoryIds: string[];
  visibleTransferIds: string[];
  excludedPlayerIds: Set<string>;
  liveTakenPlayerIds: Set<string>;
  startingStep: number;
}) {
  let spendDownFillCount = 0;
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentTeam =
      input.teamRunContext.save.gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
    if (!currentTeam) {
      break;
    }
    const snapshot = buildTeamEconomySnapshot(input.teamRunContext.save.gameState, currentTeam);
    if (input.playerMax != null && snapshot.rosterCount >= input.playerMax) {
      break;
    }
    if (
      !resolveSeason1ExecuteSpendDownRequired(input.previewTeam, snapshot.cash, snapshot.salaryTotal)
    ) {
      break;
    }
    const affordabilityCash = resolveExecuteAffordabilityCash({
      teamRunContext: input.teamRunContext,
      teamId: input.teamId,
    });
    const freeAgents = listLocalTransfermarktFreeAgents({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      mode: "ai_preview",
      minMarketValue: AI_CHEAP_FILL_MARKET_VALUE_CAP,
      maxMarketValue: affordabilityCash,
      localRunContext: input.teamRunContext,
    });
    const candidates = freeAgents.items
      .filter((item) => !input.excludedPlayerIds.has(item.playerId) && !input.liveTakenPlayerIds.has(item.playerId))
      .filter((item) => item.marketValue != null && item.marketValue >= AI_CHEAP_FILL_MARKET_VALUE_CAP)
      .sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0));
    let bought = false;
    for (const candidate of candidates) {
      if (!input.useFastBatchExecute) {
        const buyPreview = previewLocalTransfermarktBuy({
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamId: input.teamId,
          playerId: candidate.playerId,
          transferSource: "ai_roster_fill",
          localRunContext: input.teamRunContext,
        });
        if (!buyPreview.canBuy) {
          continue;
        }
      }
      const buyResult = executeLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        playerId: candidate.playerId,
        transferSource: "ai_roster_fill",
        fastLocalBatch: input.useFastBatchExecute,
        localRunContext: input.teamRunContext,
        deferPersist: true,
      });
      if (!buyResult.transferCreated || !buyResult.transferId) {
        continue;
      }
      const appliedPick: AiPicksRunPick = {
        step: input.startingStep + spendDownFillCount + 1,
        playerId: candidate.playerId,
        playerName: candidate.name,
        className: candidate.className,
        race: candidate.race,
        marketValue: buyResult.purchasePrice ?? candidate.marketValue,
        salary: buyResult.salary ?? null,
        ovr: candidate.ovr,
        mvs: candidate.mvs,
        budgetLane: "depth",
        pickLane: "depth",
        plannedLane: "depth",
        laneReason: "season1_execute_spend_down_topup",
        laneBudgetLimit: null,
        laneBudgetUsed: null,
        effectiveLaneCap: null,
        phaseCap: null,
        capExceeded: false,
        capOverrideReason: null,
        budgetStretchApplied: false,
        budgetStretchReason: null,
        budgetStretchPhaseAllowed: false,
        budgetStretchBlockedReason: null,
        isSuperstar: false,
        isStar: false,
        starPressureWarning: null,
        cheaperAlternativeAvailable: false,
        cheaperMinimumSafeAlternativeAvailable: false,
        specialistNeedFilled: false,
        coreNeedFilled: false,
        depthNeedFilled: true,
        minimumReachableAfterPick: true,
        remainingMinimumReserve: null,
        needLabel: null,
        primaryReason: "season1_execute_spend_down_topup",
        secondaryReason: null,
        bestNeedDisciplineId: null,
        aiScore: 0,
        pickScore: 0,
        teamFit: null,
        budgetFit: null,
        rosterRole: null,
        pickPhase: "late_core_investment",
        teamCashTier: null,
        minimumSecured: true,
        reserveSecured: true,
        mustFeelRightScore: null,
        mustFeelRightWarning: null,
        draftSeed: null,
        baseScore: null,
        tieBreakJitter: null,
        scoreWithSeed: null,
        tieBreakBand: null,
        strategicExceptionReason: "season1_execute_spend_down_topup",
        pickedForFormColor: false,
        formColorReason: null,
        scoreBreakdown: {
          playerQualityScore: 0,
          needMatchScore: 0,
          disciplineCoverageScore: 0,
          teamAxisFitScore: 0,
          teamThemeFitScore: 0,
          classFitScore: 0,
          raceOrArchetypeFitScore: 0,
          teamIdentityScore: 0,
          formColorCoverageScore: 0,
          formColorFlexScore: 0,
          classDisciplineFitScore: 0,
          rosterBalanceScore: 0,
          budgetFitScore: 0,
          laneFitScore: 0,
          valueScore: 0,
          harmonyFitScore: 0,
          harmonyPenalty: 0,
          riskPenalty: 0,
          duplicateProfilePenalty: 0,
          offThemePenalty: 0,
          classSpamPenalty: 0,
          colorspamPenalty: 0,
          evenSpreadPenalty: 0,
          mercenaryNegativeFitPenalty: 0,
        },
        reasons: ["season1_execute_spend_down_topup"],
        warnings: [...buyResult.warnings, "season1_execute_spend_down_topup"],
        expectedCashAfter: buyResult.cashAfter ?? null,
        expectedSalaryAfter: buyResult.salaryAfter ?? null,
        expectedRosterAfter: buyResult.rosterAfter ?? null,
        transferHistoryId: buyResult.transferId,
        status: "applied",
        plannedAxisNeed: null,
        actualPlayerPrimaryAxis: null,
        costBandExpected: "depth",
        costBandActual: "depth",
        laneMatch: true,
        axisMatch: true,
        costBandMatch: true,
        cheapestCandidateSeen: candidate.marketValue,
        cheapestCandidateSameAxis: null,
        cheapestCandidateSameTeamFitBand: null,
        cheapestCandidateSameClassFamily: null,
        priceDeltaVsCheapest: null,
        valueJustification: [],
        rejectedCheaperAlternatives: [],
        auditWarnings: [],
      };
      input.executedPicks.push(appliedPick);
      input.transferHistoryIds.push(buyResult.transferId);
      input.visibleTransferIds.push(buyResult.transferId);
      input.excludedPlayerIds.add(candidate.playerId);
      input.liveTakenPlayerIds.add(candidate.playerId);
      input.executedGlobalRows.push({
        ...appliedPick,
        teamId: input.teamId,
        teamName: input.teamName,
        controlMode: input.controlMode,
      });
      spendDownFillCount += 1;
      bought = true;
      break;
    }
    if (!bought) {
      break;
    }
  }
  return spendDownFillCount;
}

/**
 * Best-effort attribution of a `qualityGate.blockingReasons` string to the specific team (and,
 * where possible, the specific planned pick) it concerns. Reasons are formatted as
 * `check_name:identifier:...` where identifier is either a teamId or teamCode; many per-pick
 * checks (e.g. `cash_reserve_gate_failed`, `lane_mismatch`) additionally carry the offending
 * playerId right after the team identifier. When that next segment matches one of the team's own
 * planned playerIds, the reason is pick-attributable; otherwise it's treated as team-wide.
 * Returns null when no known team identifier is found anywhere in the reason, which marks it as
 * "global" (not safe to attribute to a single team or pick).
 */
function attributeBlockingReasonToPick(
  reason: string,
  teams: AiPicksRunTeamResult[],
): { teamId: string; playerId: string | null } | null {
  const segments = reason.split(":");
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const team = teams.find((entry) => entry.teamId === segment || entry.teamCode === segment);
    if (!team) continue;
    const nextSegment = segments[index + 1];
    const matchesPlannedPick =
      nextSegment != null && team.plannedPicks.some((pick) => pick.playerId === nextSegment);
    return { teamId: team.teamId, playerId: matchesPlannedPick ? nextSegment : null };
  }
  return null;
}

/**
 * Season-1 draft only: one team narrowly missing a per-team quality check (e.g. spend floor by a
 * few cash) — or even just one bad pick within an otherwise-clean team (e.g. a single mismatched
 * lane pick) — must not wipe every other team's, or that team's own other picks', draft to zero.
 * This computes which teams must be fully excluded from execution, and which individual picks can
 * be dropped from an otherwise-clean team's frozen trace, while letting everything else proceed.
 * Returns null when partial execution is not safe (a league-wide/unattributable blocker exists, or
 * every team would end up excluded anyway) — in that case the caller keeps the all-or-nothing
 * behaviour.
 */
function resolveSeason1PartialExecutionPlan(input: {
  runMode?: AiNeedsPicksRunMode | null;
  previewTeams: AiPicksRunTeamResult[];
  qualityGateBlockingReasons: string[];
  preflightBlockingReasonsCount: number;
}): { blockedTeamIds: Set<string>; blockedPickKeys: Set<string> } | null {
  if (input.runMode !== "season1_optimum_execute" || input.preflightBlockingReasonsCount > 0) {
    return null;
  }
  const blockedTeamIds = new Set<string>();
  const blockedPickKeys = new Set<string>();

  for (const team of input.previewTeams) {
    if (isSeason1HardMinTeamExecutionBlocker(team)) {
      blockedTeamIds.add(team.teamId);
    }
  }
  for (const reason of input.qualityGateBlockingReasons) {
    if (reason.startsWith("season1_spend_floor_missed:")) {
      continue;
    }
    if (reason.startsWith("cash_reserve_gate_failed_warning:")) {
      continue;
    }
    if (reason.startsWith("cash_reserve_gate_failed:")) {
      continue;
    }
    const attribution = attributeBlockingReasonToPick(reason, input.previewTeams);
    if (!attribution) {
      const teamsWithReason = input.previewTeams.filter((team) =>
        team.blockingReasons.some(
          (teamReason) => reason === teamReason || reason.endsWith(`:${teamReason}`) || reason.includes(`:${team.teamCode}:`),
        ),
      );
      if (teamsWithReason.length > 0 && teamsWithReason.length < input.previewTeams.length) {
        teamsWithReason.forEach((team) => blockedTeamIds.add(team.teamId));
        continue;
      }
      // Reason can't be tied to one team — treat as league-wide, keep the safe full block.
      return null;
    }
    if (attribution.playerId) {
      blockedPickKeys.add(buildPickExclusionKey(attribution.teamId, attribution.playerId));
    } else {
      blockedTeamIds.add(attribution.teamId);
    }
  }
  if (blockedTeamIds.size >= input.previewTeams.length) {
    return null;
  }
  if (blockedTeamIds.size === 0 && blockedPickKeys.size === 0) {
    return null;
  }
  return { blockedTeamIds, blockedPickKeys };
}

export async function runAiPicksExecutePreview(
  params: AiPicksRunParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<AiPicksRunResult> {
  const runStartedAt = Date.now();
  if ((params.source ?? "sqlite") === "prisma") {
    throw new Error("Prisma/Supabase mode is read-only in this build.");
  }

  const dryRun = params.dryRun ?? true;
  if (!dryRun && params.confirmToken !== AI_PICKS_RUN_CONFIRM_TOKEN) {
    throw new Error("AI picks execute requires explicit confirm token.");
  }

  const teamScope = params.teamScope === "all" ? "all" : "ai";
  const allowSetupAllTeams = Boolean(params.allowSetupAllTeams);
  const runMode: AiNeedsPicksRunMode = params.runMode === "season1_optimum_execute" ? "season1_optimum_execute" : "default";
  const defaultStepsPerTeam = runMode === "season1_optimum_execute" ? 14 : 5;
  const baseStepsPerTeam = Math.max(1, Math.min(Math.round(params.stepsPerTeam ?? defaultStepsPerTeam), DRAFT_MAX_STEPS_CAP));
  const save = resolveStrictLocalSave(persistence, params.saveId);
  const draftSeed = params.draftSeed?.trim() || `${save.saveId}:draft`;
  const seasonId = params.seasonId?.trim() || save.gameState.season.id;
  if (seasonId !== save.gameState.season.id) {
    throw new Error(`Requested season ${seasonId} is not available in save ${save.saveId}.`);
  }

  const currentGameState = ensureLeagueMarketValueSnapshot(
    resolveStrictLocalSave(persistence, save.saveId).gameState,
  );
  const previewRunContext = createLocalTransfermarktRunContext({
    persistence,
    save: { ...save, gameState: currentGameState },
  });
  if (isLongRunContext()) {
    warmLocalTransfermarktFreeAgentBrowseIndex({ saveId: save.saveId, seasonId });
    listLocalTransfermarktFreeAgents({
      saveId: save.saveId,
      seasonId,
      mode: "ai_preview",
      limit: 1,
      localRunContext: previewRunContext,
    });
  }
  const localRunContext = previewRunContext;
  const selectedTeams = orderTeamsForDraft(
    currentGameState,
    chooseTeams(currentGameState, teamScope, allowSetupAllTeams, params.teamIds),
  );
  const bonusDraftSteps =
    runMode === "season1_optimum_execute"
      ? selectedTeams.reduce((max, team) => Math.max(max, resolveSeason1BonusDraftSteps(team)), 0)
      : 0;
  const stepsPerTeam = Math.max(1, Math.min(baseStepsPerTeam + bonusDraftSteps, DRAFT_MAX_STEPS_CAP));
  const previewTeams: AiPicksRunTeamResult[] = [];
  const previewStartedAt = Date.now();
  const teamTimings = new Map<string, {
    teamId: string;
    teamCode: string;
    teamName: string;
    previewMs: number;
    executeMs: number;
    totalMs: number;
    plannedPicks: number;
    appliedPicks: number;
  }>();
  const globallyReservedPlayerIds = new Set<string>();
  for (const team of selectedTeams) {
    const teamPreviewStartedAt = Date.now();
    const previewTeam = await buildTeamPreviewEntryWithDraftState({
      saveId: save.saveId,
      seasonId,
      team,
      gameState: currentGameState,
      teamScope,
      stepsPerTeam,
      runMode,
      excludedPlayerIds: [...globallyReservedPlayerIds],
      draftSeed,
      localRunContext,
    });
    const previewMs = Date.now() - teamPreviewStartedAt;
    teamTimings.set(team.teamId, {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      previewMs,
      executeMs: 0,
      totalMs: previewMs,
      plannedPicks: previewTeam.plannedPicks.filter((pick) => pick.status !== "blocked").length,
      appliedPicks: 0,
    });
    previewTeams.push(previewTeam);
    previewTeam.plannedPicks
      .filter((pick) => pick.status !== "blocked")
      .forEach((pick) => globallyReservedPlayerIds.add(pick.playerId));
  }

  const previewGlobalRows = flattenGlobalPicks(previewTeams);
  const previewMs = Date.now() - previewStartedAt;
  const globalPreview = buildGlobalSummary(previewGlobalRows);
  const preflightAudit = buildRunPreflight({
    saveId: save.saveId,
    seasonId,
    gameState: currentGameState,
    teamScope,
    allowSetupAllTeams,
    previewTeams,
    localRunContext,
  });
  const qualityGate = buildQualityGate(previewTeams, previewGlobalRows, { runMode, seasonId });
  const preflightBlockingReasons = preflightAudit.checks
    .filter((check) => check.status === "blocked")
    .map((check) => `preflight_blocked:${check.key}`);
  const preflightWarnings = preflightAudit.checks
    .filter((check) => check.status === "warning")
    .map((check) => `preflight_warning:${check.key}`);

  if (teamScope === "all" && !allowSetupAllTeams) {
    qualityGate.passed = false;
    qualityGate.blockingReasons.push("setup_all_teams_not_confirmed");
  }

  const warnings = unique([
    ...previewTeams.flatMap((team) => team.warnings),
    ...qualityGate.warnings,
    ...preflightWarnings,
    ...(dryRun && (qualityGate.blockingReasons.length > 0 || preflightBlockingReasons.length > 0) ? ["ai_preview_blocked"] : []),
  ]);
  const blockingReasons = unique([
    ...previewTeams.flatMap((team) => team.blockingReasons),
    ...qualityGate.blockingReasons,
    ...preflightBlockingReasons,
  ]);

  const partialExecutionPlan = resolveSeason1PartialExecutionPlan({
    runMode,
    previewTeams,
    qualityGateBlockingReasons: qualityGate.blockingReasons,
    preflightBlockingReasonsCount: preflightBlockingReasons.length,
  });
  if (partialExecutionPlan) {
    if (partialExecutionPlan.blockedTeamIds.size > 0) {
      warnings.push(
        `season1_partial_execute_blocked_teams:${[...partialExecutionPlan.blockedTeamIds]
          .map((teamId) => previewTeams.find((team) => team.teamId === teamId)?.teamCode ?? teamId)
          .join(",")}`,
      );
    }
    if (partialExecutionPlan.blockedPickKeys.size > 0) {
      warnings.push(`season1_partial_execute_blocked_picks:${partialExecutionPlan.blockedPickKeys.size}`);
    }
  }

  const preflightAutoTransfers = currentGameState.transferHistory.filter((entry) => isAiPickResettableSource(entry.source));
  const protectedTransfers = currentGameState.transferHistory.filter((entry) => !isAiPickResettableSource(entry.source));

  const result: AiPicksRunResult = {
    source: "sqlite",
    readOnly: dryRun,
    dryRun,
    executed: false,
    status: blockingReasons.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    scope: {
      saveId: save.saveId,
      seasonId,
      teamScope,
      allowSetupAllTeams,
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId: params.saveId,
      resolvedSaveId: save.saveId,
      requestedSeasonId: params.seasonId,
      resolvedSeasonId: seasonId,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
    preflight: {
      activeSaveName: save.name ?? null,
      existingAutoTransfers: preflightAutoTransfers.length,
      manualTransfersProtected: protectedTransfers.length,
      resetStatus: preflightAutoTransfers.length > 0 ? "auto_transfers_present" : "already_clean",
      checks: preflightAudit.checks,
    },
    qualityGate,
    globalPreview,
    globalExecution: buildGlobalSummary([]),
    traceParity: {
      dryRunExecuteTraceMatch: true,
      dryRunPickCount: previewGlobalRows.filter((pick) => pick.status !== "blocked").length,
      executePickCount: 0,
      sameTeams: true,
      samePlayers: true,
      sameOrder: true,
      sameLanes: true,
      sameCosts: true,
      traceDifferences: [],
    },
    teams: previewTeams,
    performance: {
      totalMs: Date.now() - runStartedAt,
      previewMs,
      executeMs: 0,
      teamTimings: [...teamTimings.values()],
    },
    historyCheck: {
      allAppliedBuysVisible: true,
      missingTransferIds: [],
      visibleTransferIds: [],
    },
    warnings,
    blockingReasons,
  };

  if (
    dryRun ||
    preflightBlockingReasons.length > 0 ||
    (blockingReasons.length > 0 && !partialExecutionPlan)
  ) {
    return result;
  }

  const visibleTransferIds: string[] = [];
  const missingTransferIds: string[] = [];
  const executedTeams: AiPicksRunTeamResult[] = [];
  const executedGlobalRows: GlobalPickRow[] = [];
  const executeStartedAt = Date.now();
  const liveTakenPlayerIds = new Set<string>();
  // Organic squad builder ist jetzt DEFAULT-ON (Cutover): jedes Team pickt live bei seinem Zug aus dem
  // Restpool, statt über den Legacy-partialExecutionPlan vorab eingefroren/ausgeschlossen zu werden (der
  // Bug, bei dem das zuletzt gedraftete Team mit 0 Spielern endete). Opt-out nur noch explizit mit
  // OLY_ORGANIC_SQUAD_BUILDER=0 (Legacy-Pfad für A/B-Vergleiche).
  const useOrganicSquadBuilder = process.env.OLY_ORGANIC_SQUAD_BUILDER !== "0";

  for (const previewTeam of previewTeams) {
    const teamExecuteStartedAt = Date.now();
    // The partial-execution plan is derived from the NON-organic preview planner. When the organic
    // squad builder owns the execute (flag on), it recomputes its OWN min-feasible plan from the live
    // free-agent pool and never touches the preview's picks — so a preview-side team veto (e.g. the
    // unified planner failing to reach hard-min for this team) must NOT exclude it here, or the team
    // ends up with an empty roster despite the organic builder being able to draft it cleanly.
    if (!useOrganicSquadBuilder && partialExecutionPlan?.blockedTeamIds.has(previewTeam.teamId)) {
      // Season-1 partial execution: this team's own narrow blocker keeps it excluded, but must
      // not prevent every other clean team from being applied (see resolveSeason1PartialExecutionPlan).
      executedTeams.push({
        ...previewTeam,
        warnings: unique([...previewTeam.warnings, "season1_partial_execute_team_excluded"]),
      });
      continue;
    }
    const latestSave = resolveStrictLocalSave(persistence, save.saveId);
    const latestTeam = latestSave.gameState.teams.find((entry) => entry.teamId === previewTeam.teamId);
    if (!latestTeam) {
      executedTeams.push({
        ...previewTeam,
        warnings: unique([...previewTeam.warnings, "Team konnte im aktuellen Save nicht mehr geladen werden."]),
        blockingReasons: unique([...previewTeam.blockingReasons, "team_not_found_in_execute"]),
      });
      continue;
    }

    const activeControlMode = getActiveControlMode(latestSave.gameState, latestTeam.teamId);
    if (activeControlMode !== "ai" && !(teamScope === "all" && allowSetupAllTeams)) {
      executedTeams.push({
        ...previewTeam,
        controlMode: activeControlMode,
        warnings: unique([...previewTeam.warnings, "Team bleibt wegen Control-Mode im Execute geschuetzt."]),
        blockingReasons: unique([...previewTeam.blockingReasons, "control_mode_protected"]),
      });
      continue;
    }

    const beforeSnapshot = buildTeamEconomySnapshot(latestSave.gameState, latestTeam);
    const targetInfo = resolveTargetRoster(latestTeam, latestSave.gameState, runMode);

    // Phase 2 KI-Anbindung (docs/design/kredit-system.md, "KI-Anbindung"): bedarfsgetriebene
    // Kreditaufnahme unmittelbar vor der Kaufphase, damit die KI ihren Kader trotz knapper Kasse
    // aufs Optimum auffüllen kann. Cash muss VOR teamRunContext credited & persistiert werden,
    // damit die Kaufschleife das erhöhte Cash sieht. Schlägt die Aufnahme fehl, läuft die
    // Kaufphase unverändert ohne Kredit weiter (kein Throw).
    let preseasonLoanSave = latestSave;
    const loanDecision = resolveAiLoanDecision(latestSave.gameState, latestTeam.teamId);
    if (loanDecision.shouldBorrow) {
      // Phase 3 (docs/design/kredit-system.md, "Team-zu-Team-Kredite"): die KI leiht sich gegen
      // das guenstigste verfuegbare Angebot (Bank oder Team) statt immer nur bei der Bank -
      // buildLoanOffers ist bereits aufsteigend nach Zinssatz sortiert, die Bank ist immer
      // enthalten, daher gibt es hier immer mindestens ein Angebot.
      const offers = buildLoanOffers(latestSave.gameState, latestTeam.teamId, loanDecision.loanAmount, loanDecision.termSeasons);
      const bestOffer = offers[0] ?? null;
      const loanResult = originateLoan(
        latestSave.gameState,
        {
          borrowerTeamId: latestTeam.teamId,
          principal: loanDecision.loanAmount,
          termSeasons: loanDecision.termSeasons,
          lenderType: bestOffer?.lenderType ?? "bank",
          lenderTeamId: bestOffer?.lenderTeamId ?? undefined,
        },
        { execute: true },
      );
      if (loanResult.ok) {
        preseasonLoanSave = persistence.saveSingleplayerState(latestSave.saveId, loanResult.gameState);
      }
    }

    const teamRunContext = createLocalTransfermarktRunContext({ save: preseasonLoanSave, persistence });
    const useFastBatchExecute = runMode === "season1_optimum_execute";
    const executedPicks: AiPicksRunPick[] = [];
    const transferHistoryIds: string[] = [];
    const teamWarnings = [...previewTeam.warnings];
    const teamBlockingReasons = [...previewTeam.blockingReasons];
    let executedStepCount = 0;
    const teamExcludedPickPlayerIds = previewTeam.plannedPicks
      .filter((pick) => partialExecutionPlan?.blockedPickKeys.has(buildPickExclusionKey(previewTeam.teamId, pick.playerId)))
      .map((pick) => pick.playerId);
    if (teamExcludedPickPlayerIds.length > 0) {
      teamWarnings.push(`season1_partial_execute_picks_excluded:${teamExcludedPickPlayerIds.join(",")}`);
    }

    if (targetInfo.targetRosterSize == null) {
      executedTeams.push({
        ...previewTeam,
        controlMode: activeControlMode,
        warnings: unique(teamWarnings),
        blockingReasons: unique([...teamBlockingReasons, "target_roster_size_missing"]),
      });
      continue;
    }

    if (useOrganicSquadBuilder) {
      // Flag-gated organic-squad-builder execute path. Self-contained: it does its own buying,
      // per-team flush and result push, then skips the entire default frozenTrace execute body
      // below. When the flag is OFF this branch is never entered and the default path is unchanged.
      runOrganicTeamDraftExecute({
        saveId: save.saveId,
        seasonId,
        persistence,
        teamRunContext,
        latestTeam,
        previewTeam,
        activeControlMode,
        targetInfo,
        beforeSnapshot,
        useFastBatchExecute,
        executedPicks,
        transferHistoryIds,
        visibleTransferIds,
        missingTransferIds,
        executedGlobalRows,
        executedTeams,
        liveTakenPlayerIds,
        teamTimings,
        teamExecuteStartedAt,
        teamWarnings,
        teamBlockingReasons,
      });
      continue;
    }

    const previewNonBlockedPicks = previewTeam.plannedPicks.filter((pick) => pick.status !== "blocked");
    let frozenTrace = previewNonBlockedPicks
      .filter((pick) => teamExcludedPickPlayerIds.length === 0 || !teamExcludedPickPlayerIds.includes(pick.playerId))
      .slice(0, stepsPerTeam);
    if (frozenTrace.length === 0 && previewNonBlockedPicks.length > 0) {
      const rosterBefore = beforeSnapshot.rosterCount;
      const playerMin = previewTeam.targetRosterMin;
      const maxFallbackPicks =
        playerMin != null ? Math.max(playerMin - rosterBefore, 1) : Math.min(previewNonBlockedPicks.length, stepsPerTeam);
      const minimumSafeFallback = previewNonBlockedPicks
        .filter((pick) => pick.minimumReachableAfterPick)
        .sort(
          (left, right) =>
            (left.marketValue ?? Number.MAX_SAFE_INTEGER) - (right.marketValue ?? Number.MAX_SAFE_INTEGER),
        )
        .slice(0, Math.min(maxFallbackPicks, stepsPerTeam));
      if (minimumSafeFallback.length > 0) {
        frozenTrace = minimumSafeFallback;
        teamWarnings.push("season1_execute_minimum_fallback_after_pick_exclusion");
      }
    }
    if (
      previewTeam.targetRosterMin != null &&
      beforeSnapshot.rosterCount + frozenTrace.length < previewTeam.targetRosterMin &&
      previewNonBlockedPicks.length > frozenTrace.length
    ) {
      const existingPickIds = new Set(frozenTrace.map((pick) => pick.playerId));
      const slotsStillNeeded = previewTeam.targetRosterMin - beforeSnapshot.rosterCount - frozenTrace.length;
      const broadenedFallback = previewNonBlockedPicks
        .filter((pick) => !existingPickIds.has(pick.playerId))
        .sort(
          (left, right) =>
            (left.marketValue ?? Number.MAX_SAFE_INTEGER) - (right.marketValue ?? Number.MAX_SAFE_INTEGER),
        )
        .slice(0, Math.max(slotsStillNeeded, 0));
      if (broadenedFallback.length > 0) {
        frozenTrace = [...frozenTrace, ...broadenedFallback];
        teamWarnings.push("season1_execute_minimum_fallback_broadened_after_pick_exclusion");
      }
    }
    const executeBrackets = buildLeagueMarketBrackets(
      teamRunContext.save.gameState.players.map(
        (player) => player.marketValue ?? player.displayMarketValue ?? null,
      ),
    );
    // Build the team's league free-agent feed once for this execute loop instead of re-deriving it
    // per pick. `listExecuteFreeAgentsForSlot` otherwise re-enters `listLocalTransfermarktFreeAgents`
    // on every pick, and because the market-context cache key includes rosters/transferHistory counts
    // (which grow with each applied pick), that call rebuilds the whole ~league-wide base feed every
    // time. The pick-selection fields (marketValue/mvs/ovr/salary/core stats/preferredDisciplineIds)
    // are roster-invariant during the draft, so the loop-start feed is reused with an availability
    // filter (`unavailablePlayerIds`) applied per pick — behaviour-preserving, ~O(teams) rebuilds
    // instead of O(picks).
    const executeBaseFreeAgents = listLocalTransfermarktFreeAgents({
      saveId: save.saveId,
      seasonId,
      teamId: latestTeam.teamId,
      mode: "ai_preview",
      localRunContext: teamRunContext,
      fullPool: true,
    }).items;
    for (const frozenPick of frozenTrace) {
      const currentTeam = teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam;
      const loopSnapshot = buildTeamEconomySnapshot(teamRunContext.save.gameState, currentTeam);
      if (
        shouldStopSeason1ExecutePick({
          rosterCount: loopSnapshot.rosterCount,
          targetRosterSize: targetInfo.targetRosterSize,
          playerMax: targetInfo.playerMax,
          spendDownRequired: resolveSeason1ExecuteSpendDownRequired(
            previewTeam,
            loopSnapshot.cash,
            loopSnapshot.salaryTotal,
          ),
        })
      ) {
        break;
      }

      const teamExcludedPlayerIds = new Set(executedPicks.map((pick) => pick.playerId));
      const unavailablePlayerIds = new Set<string>([...liveTakenPlayerIds, ...teamExcludedPlayerIds]);
      const slotLane = resolveSlotLaneFromPick(frozenPick);
      const affordabilityCash = resolveExecuteAffordabilityCash({
        teamRunContext,
        teamId: latestTeam.teamId,
        rosterBefore: loopSnapshot.rosterCount,
      });
      const slotPriceCeiling = resolveExecuteSlotPriceCeiling({
        frozenPick,
        rosterCount: loopSnapshot.rosterCount,
        targetRosterMin: previewTeam.targetRosterMin,
        affordabilityCash,
      });
      const underMinExecute = previewTeam.targetRosterMin != null && loopSnapshot.rosterCount < previewTeam.targetRosterMin;
      const effectiveSlotLane = underMinExecute ? "cheap_fill" : slotLane;
      const availableBaseFreeAgents = executeBaseFreeAgents.filter(
        (item) => !unavailablePlayerIds.has(item.playerId),
      );
      const executeFreeAgents = listExecuteFreeAgentsForSlot({
        saveId: save.saveId,
        seasonId,
        teamId: latestTeam.teamId,
        teamRunContext,
        slotLane: effectiveSlotLane,
        brackets: executeBrackets,
        slotPriceCeiling,
        affordabilityCash,
        includeCheapFillFallback: !underMinExecute,
        // Availability-filtered loop-start feed → in-memory MW-band filtering (no per-pick league
        // rebuild). The pool already excludes taken players, so no bounds-keyed pool cache is used
        // (it would not reflect availability and could serve a stale pool).
        precomputedFreeAgents: availableBaseFreeAgents,
      });
      const livePick = resolveExecuteLivePickForSlot({
        saveId: save.saveId,
        seasonId,
        teamId: latestTeam.teamId,
        teamRunContext,
        slotLane: effectiveSlotLane,
        bestNeedDisciplineId: frozenPick.bestNeedDisciplineId,
        affordabilityCash,
        unavailablePlayerIds,
        brackets: executeBrackets,
        slotPriceCeiling,
        freeAgents: executeFreeAgents,
        useFastBatchExecute,
        allowMinFillFallback: true,
      });
      let nextPick = livePick ? buildExecuteLivePick(frozenPick, livePick) : null;
      let substituteWarning: string | null = null;

      if (!nextPick) {
        const substitute = resolveSeason1ExecuteLiveSubstitute({
          saveId: save.saveId,
          seasonId,
          teamId: latestTeam.teamId,
          teamRunContext,
          liveTakenPlayerIds,
          excludedPlayerIds: teamExcludedPlayerIds,
          useFastBatchExecute,
          maxPrice: resolveExecuteSubstituteMaxPrice({
            pick: frozenPick,
            rosterCount: loopSnapshot.rosterCount,
            targetRosterMin: previewTeam.targetRosterMin,
            affordabilityCash,
          }),
          slotLane,
          bestNeedDisciplineId: frozenPick.bestNeedDisciplineId,
          brackets: executeBrackets,
          freeAgents: executeFreeAgents,
          affordabilityCash,
        });
        if (substitute) {
          nextPick = buildSeason1ExecuteSubstitutePick(frozenPick, substitute, frozenPick.playerId);
          substituteWarning = nextPick.warnings.find((entry) => entry.startsWith("season1_execute_live_substitute:")) ?? null;
        } else {
          executedPicks.push({
            ...frozenPick,
            warnings: unique([...frozenPick.warnings, "execute_live_lane_pool_unavailable"]),
            transferHistoryId: null,
            status: "blocked",
          });
          teamBlockingReasons.push("execute_live_lane_pool_unavailable");
          pushExecuteSlotBlockers(teamBlockingReasons);
          if (
            shouldContinueExecuteAfterPickDrift({
              runMode,
              rosterCount: loopSnapshot.rosterCount,
              rosterMinTarget: previewTeam.targetRosterMin,
            })
          ) {
            const driftFill = runSeason1ExecuteEmergencyMinFill({
              saveId: save.saveId,
              seasonId,
              teamId: latestTeam.teamId,
              teamName: previewTeam.teamName,
              teamCode: previewTeam.teamCode,
              controlMode: activeControlMode,
              rosterMinTarget: previewTeam.targetRosterMin!,
              teamRunContext,
              useFastBatchExecute,
              executedPicks,
              executedGlobalRows,
              transferHistoryIds,
              visibleTransferIds,
              excludedPlayerIds: teamExcludedPlayerIds,
              liveTakenPlayerIds,
              startingStep: executedStepCount,
            });
            if (driftFill > 0) {
              executedStepCount += driftFill;
              teamWarnings.push(`season1_execute_drift_min_fill:${driftFill}`);
              continue;
            }
            teamWarnings.push("season1_execute_pick_drift_skipped_below_min");
            continue;
          }
          break;
        }
      }

      if (!livePick && liveTakenPlayerIds.has(frozenPick.playerId)) {
        const substitute = resolveSeason1ExecuteLiveSubstitute({
          saveId: save.saveId,
          seasonId,
          teamId: latestTeam.teamId,
          teamRunContext,
          liveTakenPlayerIds,
          excludedPlayerIds: teamExcludedPlayerIds,
          useFastBatchExecute,
          maxPrice: resolveExecuteSubstituteMaxPrice({
            pick: nextPick ?? frozenPick,
            rosterCount: loopSnapshot.rosterCount,
            targetRosterMin: previewTeam.targetRosterMin,
            affordabilityCash,
          }),
          slotLane,
          bestNeedDisciplineId: frozenPick.bestNeedDisciplineId,
          brackets: executeBrackets,
          freeAgents: executeFreeAgents,
          affordabilityCash,
        });
        if (substitute) {
          nextPick = buildSeason1ExecuteSubstitutePick(frozenPick, substitute, frozenPick.playerId);
          substituteWarning = nextPick.warnings.find((entry) => entry.startsWith("season1_execute_live_substitute:")) ?? null;
        }
      }

      if (!useFastBatchExecute) {
        const buyPreview = previewLocalTransfermarktBuy({
          saveId: save.saveId,
          seasonId,
          teamId: latestTeam.teamId,
          playerId: nextPick.playerId,
          transferSource: "ai_roster_fill",
          localRunContext: teamRunContext,
        });

        if (!buyPreview.canBuy) {
          const substitute = resolveSeason1ExecuteLiveSubstitute({
            saveId: save.saveId,
            seasonId,
            teamId: latestTeam.teamId,
            teamRunContext,
            liveTakenPlayerIds,
            excludedPlayerIds: teamExcludedPlayerIds,
            useFastBatchExecute,
            maxPrice: resolveExecuteSubstituteMaxPrice({
              pick: nextPick ?? frozenPick,
              rosterCount: loopSnapshot.rosterCount,
              targetRosterMin: previewTeam.targetRosterMin,
              affordabilityCash,
            }),
            affordabilityCash,
          });
          if (substitute) {
            nextPick = buildSeason1ExecuteSubstitutePick(frozenPick, substitute, frozenPick.playerId);
            substituteWarning = nextPick.warnings.find((entry) => entry.startsWith("season1_execute_live_substitute:")) ?? null;
            teamWarnings.push(substituteWarning ?? "season1_execute_live_substitute");
            const retryPreview = previewLocalTransfermarktBuy({
              saveId: save.saveId,
              seasonId,
              teamId: latestTeam.teamId,
              playerId: nextPick.playerId,
              transferSource: "ai_roster_fill",
              localRunContext: teamRunContext,
            });
            if (!retryPreview.canBuy) {
              executedPicks.push({
                ...nextPick,
                warnings: unique([...retryPreview.warnings, "preview_pick_invalidated", "season1_execute_live_pool_unavailable"]),
                transferHistoryId: null,
                status: "blocked",
              });
              teamBlockingReasons.push(...retryPreview.blockingReasons, "season1_execute_live_pool_unavailable");
              pushExecuteSlotBlockers(teamBlockingReasons);
              const rosterCountAfterDrift = buildTeamEconomySnapshot(
                teamRunContext.save.gameState,
                teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam,
              ).rosterCount;
              if (
                shouldContinueExecuteAfterPickDrift({
                  runMode,
                  rosterCount: rosterCountAfterDrift,
                  rosterMinTarget: previewTeam.targetRosterMin,
                })
              ) {
                teamWarnings.push("season1_execute_pick_drift_skipped_below_min");
                continue;
              }
              break;
            }
          } else {
            executedPicks.push({
              ...nextPick,
              warnings: unique([...buyPreview.warnings, "preview_pick_invalidated", "season1_execute_live_pool_unavailable"]),
              transferHistoryId: null,
              status: "blocked",
            });
            teamBlockingReasons.push(...buyPreview.blockingReasons, "preview_pick_invalidated");
            pushExecuteSlotBlockers(teamBlockingReasons);
            const rosterCountAfterDrift = buildTeamEconomySnapshot(
              teamRunContext.save.gameState,
              teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam,
            ).rosterCount;
            if (
              shouldContinueExecuteAfterPickDrift({
                runMode,
                rosterCount: rosterCountAfterDrift,
                rosterMinTarget: previewTeam.targetRosterMin,
              })
            ) {
              teamWarnings.push("season1_execute_pick_drift_skipped_below_min");
              continue;
            }
            break;
          }
        }
      } else if (substituteWarning) {
        teamWarnings.push(substituteWarning);
      }

      const buyResult = executeLocalTransfermarktBuy({
        saveId: save.saveId,
        seasonId,
        teamId: latestTeam.teamId,
        playerId: nextPick.playerId,
        transferSource: "ai_roster_fill",
        fastLocalBatch: useFastBatchExecute,
        localRunContext: teamRunContext,
        deferPersist: true,
      });

      if (!buyResult.transferCreated || !buyResult.transferId) {
        const substitute = resolveSeason1ExecuteLiveSubstitute({
          saveId: save.saveId,
          seasonId,
          teamId: latestTeam.teamId,
          teamRunContext,
          liveTakenPlayerIds,
          excludedPlayerIds: teamExcludedPlayerIds,
          useFastBatchExecute,
          maxPrice: resolveExecuteSubstituteMaxPrice({
            pick: nextPick ?? frozenPick,
            rosterCount: loopSnapshot.rosterCount,
            targetRosterMin: previewTeam.targetRosterMin,
            affordabilityCash,
          }),
          slotLane,
          bestNeedDisciplineId: frozenPick.bestNeedDisciplineId,
          brackets: executeBrackets,
          freeAgents: executeFreeAgents,
          affordabilityCash,
        });
        if (substitute && substitute.playerId !== nextPick.playerId) {
          nextPick = buildSeason1ExecuteSubstitutePick(frozenPick, substitute, frozenPick.playerId);
          teamWarnings.push(
            nextPick.warnings.find((entry) => entry.startsWith("season1_execute_live_substitute:")) ??
              "season1_execute_reserve_gate_substitute",
          );
          const retryResult = executeLocalTransfermarktBuy({
            saveId: save.saveId,
            seasonId,
            teamId: latestTeam.teamId,
            playerId: nextPick.playerId,
            transferSource: "ai_roster_fill",
            fastLocalBatch: useFastBatchExecute,
            localRunContext: teamRunContext,
            deferPersist: true,
          });
          if (retryResult.transferCreated && retryResult.transferId) {
            const appliedPick: AiPicksRunPick = {
              ...nextPick,
              marketValue: retryResult.purchasePrice ?? nextPick.marketValue,
              salary: retryResult.salary ?? nextPick.salary,
              expectedCashAfter: retryResult.cashAfter ?? nextPick.expectedCashAfter,
              expectedSalaryAfter: retryResult.salaryAfter ?? nextPick.expectedSalaryAfter,
              expectedRosterAfter: retryResult.rosterAfter ?? nextPick.expectedRosterAfter,
              transferHistoryId: retryResult.transferId,
              warnings: unique([...nextPick.warnings, ...retryResult.warnings]),
              status: "applied",
            };
            executedPicks.push(appliedPick);
            executedStepCount += 1;
            transferHistoryIds.push(retryResult.transferId);
            visibleTransferIds.push(retryResult.transferId);
            liveTakenPlayerIds.add(nextPick.playerId);
            executedGlobalRows.push({
              ...appliedPick,
              teamId: previewTeam.teamId,
              teamName: previewTeam.teamName,
              controlMode: activeControlMode,
            });
            const refreshedTeam =
              teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam;
            const latestSnapshot = buildTeamEconomySnapshot(teamRunContext.save.gameState, refreshedTeam);
            if (
              shouldStopSeason1ExecutePick({
                rosterCount: latestSnapshot.rosterCount,
                targetRosterSize: targetInfo.targetRosterSize,
                playerMax: targetInfo.playerMax,
                spendDownRequired: resolveSeason1ExecuteSpendDownRequired(
                  previewTeam,
                  latestSnapshot.cash,
                  latestSnapshot.salaryTotal,
                ),
              })
            ) {
              break;
            }
            continue;
          }
        }
        executedPicks.push({
          ...nextPick,
          warnings: unique([...buyResult.warnings, "season1_execute_live_pool_unavailable"]),
          transferHistoryId: buyResult.transferId,
          status: "blocked",
        });
        teamBlockingReasons.push(...buyResult.blockingReasons);
        pushExecuteSlotBlockers(teamBlockingReasons);
        const rosterCountAfterDrift = buildTeamEconomySnapshot(
          teamRunContext.save.gameState,
          teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam,
        ).rosterCount;
        if (
          shouldContinueExecuteAfterPickDrift({
            runMode,
            rosterCount: rosterCountAfterDrift,
            rosterMinTarget: previewTeam.targetRosterMin,
          })
        ) {
          teamWarnings.push("season1_execute_pick_drift_skipped_below_min");
          continue;
        }
        break;
      }

      const appliedPick: AiPicksRunPick = {
        ...nextPick,
        marketValue: buyResult.purchasePrice ?? nextPick.marketValue,
        salary: buyResult.salary ?? nextPick.salary,
        expectedCashAfter: buyResult.cashAfter ?? nextPick.expectedCashAfter,
        expectedSalaryAfter: buyResult.salaryAfter ?? nextPick.expectedSalaryAfter,
        expectedRosterAfter: buyResult.rosterAfter ?? nextPick.expectedRosterAfter,
        transferHistoryId: buyResult.transferId,
        warnings: unique([...nextPick.warnings, ...buyResult.warnings]),
        status: "applied",
      };
      executedPicks.push(appliedPick);
      executedStepCount += 1;
      transferHistoryIds.push(buyResult.transferId);
      visibleTransferIds.push(buyResult.transferId);
      liveTakenPlayerIds.add(nextPick.playerId);
      executedGlobalRows.push({
        ...appliedPick,
        teamId: previewTeam.teamId,
        teamName: previewTeam.teamName,
        controlMode: activeControlMode,
      });

      const refreshedTeam = teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam;
      const latestSnapshot = buildTeamEconomySnapshot(teamRunContext.save.gameState, refreshedTeam);
      if (
        shouldStopSeason1ExecutePick({
          rosterCount: latestSnapshot.rosterCount,
          targetRosterSize: targetInfo.targetRosterSize,
          playerMax: targetInfo.playerMax,
          spendDownRequired: resolveSeason1ExecuteSpendDownRequired(
            previewTeam,
            latestSnapshot.cash,
            latestSnapshot.salaryTotal,
          ),
        })
      ) {
        break;
      }
    }

    if (runMode === "season1_optimum_execute") {
      const spendDownFillCount = runSeason1ExecuteSpendDownTopUp({
        saveId: save.saveId,
        seasonId,
        teamId: latestTeam.teamId,
        teamName: previewTeam.teamName,
        teamCode: previewTeam.teamCode,
        controlMode: activeControlMode,
        playerMax: targetInfo.playerMax,
        previewTeam,
        teamRunContext,
        useFastBatchExecute,
        executedPicks,
        executedGlobalRows,
        transferHistoryIds,
        visibleTransferIds,
        excludedPlayerIds: new Set([
          ...previewTeam.plannedPicks.map((pick) => pick.playerId),
          ...executedPicks.map((pick) => pick.playerId),
        ]),
        liveTakenPlayerIds,
        startingStep: executedStepCount,
      });
      if (spendDownFillCount > 0) {
        executedStepCount += spendDownFillCount;
        teamWarnings.push(`season1_execute_spend_down_topup:${spendDownFillCount}`);
      }
    }

    if (
      runMode === "season1_optimum_execute" &&
      previewTeam.targetRosterMin != null
    ) {
      const rosterBeforeEmergency = buildTeamEconomySnapshot(
        teamRunContext.save.gameState,
        teamRunContext.save.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam,
      ).rosterCount;
      if (rosterBeforeEmergency < previewTeam.targetRosterMin) {
        const excludedPlayerIds = new Set([
          ...previewTeam.plannedPicks.map((pick) => pick.playerId),
          ...executedPicks.map((pick) => pick.playerId),
        ]);
        const emergencyFillCount = runSeason1ExecuteEmergencyMinFill({
          saveId: save.saveId,
          seasonId,
          teamId: latestTeam.teamId,
          teamName: previewTeam.teamName,
          teamCode: previewTeam.teamCode,
          controlMode: activeControlMode,
          rosterMinTarget: previewTeam.targetRosterMin,
          teamRunContext,
          useFastBatchExecute,
          executedPicks,
          executedGlobalRows,
          transferHistoryIds,
          visibleTransferIds,
          excludedPlayerIds,
          liveTakenPlayerIds,
          startingStep: executedStepCount,
        });
        if (emergencyFillCount > 0) {
          executedStepCount += emergencyFillCount;
          teamWarnings.push(`season1_execute_emergency_min_fill:${emergencyFillCount}`);
        }
      }
    }

    const afterSave = teamRunContext.deferredWrites > 0
      ? flushLocalTransfermarktRunContext(teamRunContext)
      : resolveStrictLocalSave(persistence, save.saveId);
    const afterTeam = afterSave.gameState.teams.find((entry) => entry.teamId === latestTeam.teamId) ?? latestTeam;
    for (const transferId of transferHistoryIds) {
      if (!afterSave.gameState.transferHistory.some((entry) => entry.id === transferId)) {
        missingTransferIds.push(transferId);
      }
    }
    const afterSnapshot = buildTeamEconomySnapshot(afterSave.gameState, afterTeam);
    const executedTeam: AiPicksRunTeamResult = {
      ...previewTeam,
      controlMode: activeControlMode,
      targetRosterSize: targetInfo.targetRosterSize,
      targetSource: targetInfo.targetSource,
      rosterBefore: beforeSnapshot.rosterCount,
      rosterAfter: afterSnapshot.rosterCount,
      missingBefore: Math.max(targetInfo.targetRosterSize - beforeSnapshot.rosterCount, 0),
      missingAfter: Math.max(targetInfo.targetRosterSize - afterSnapshot.rosterCount, 0),
      cashBefore: beforeSnapshot.cash,
      cashAfter: afterSnapshot.cash,
      salaryBefore: beforeSnapshot.salaryTotal,
      salaryAfter: afterSnapshot.salaryTotal,
      plannedPicks: executedPicks,
      transferHistoryIds,
      warnings: unique(teamWarnings),
      blockingReasons: unique(teamBlockingReasons),
      previewSummary: previewTeam.previewSummary,
    };
    executedTeam.previewSummary = buildTeamPreviewSummary(executedTeam);
    executedTeams.push(executedTeam);
    const timing = teamTimings.get(previewTeam.teamId);
    const executeMs = Date.now() - teamExecuteStartedAt;
    if (timing) {
      timing.executeMs = executeMs;
      timing.totalMs = timing.previewMs + executeMs;
      timing.appliedPicks = executedPicks.filter((pick) => pick.status === "applied").length;
    }
  }

  const executeMs = Date.now() - executeStartedAt;
  result.readOnly = false;
  result.executed = true;
  result.globalExecution = buildGlobalSummary(executedGlobalRows);
  result.traceParity = buildTraceParity({
    previewTeams,
    executedTeams,
  });
  result.teams = executedTeams;
  result.performance = {
    totalMs: Date.now() - runStartedAt,
    previewMs,
    executeMs,
    teamTimings: [...teamTimings.values()],
  };
  result.historyCheck = {
    allAppliedBuysVisible: missingTransferIds.length === 0,
    missingTransferIds: unique(missingTransferIds),
    visibleTransferIds: unique(visibleTransferIds),
  };
  result.warnings = unique([
    ...executedTeams.flatMap((team) => team.warnings),
    ...(result.historyCheck.allAppliedBuysVisible ? [] : ["Mindestens ein AI-Kauf fehlt in der Transferhistorie des gleichen Saves."]),
  ]);
  result.blockingReasons = unique([
    ...executedTeams.flatMap((team) => team.blockingReasons),
    ...(result.historyCheck.allAppliedBuysVisible ? [] : ["transfer_history_visibility_mismatch"]),
  ]);
  result.status =
    result.blockingReasons.length > 0
      ? executedTeams.some((team) => team.plannedPicks.some((pick) => pick.status === "applied"))
        ? "partial_applied"
        : "blocked"
      : "applied";

  return result;
}
