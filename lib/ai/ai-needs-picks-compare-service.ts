import { access } from "node:fs/promises";

import { buildAiTransfermarktPreview, type AiTransferPreviewParams, type AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";
import { RETOOL_AI_PACKAGE_SCORING_CONFIG } from "@/lib/ai/golden-master/package-scoring-config";
import { RETOOL_TEAM_IDENTITY_OVERRIDES } from "@/lib/ai/golden-master/team-identity-overrides";
import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import type { FormCardColor, GameState, Player, Team, TeamControlMode, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { getTeamControlSettings, withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import { getTeamStrategyProfile, withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getPlayerClassColor } from "@/lib/lineups/legacy-lineup-modifiers";
import {
  MERCENARY_NEGATIVE_FIT_PENALTY_REASON,
  applyMercenaryNegativeFitPenaltyToFinalPickScore,
  calculateTransfermarktFit,
  getMercenaryNegativeFitPenalty,
  hasMercenaryTrait,
} from "@/lib/market/transfermarkt-fit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPrizeMoneyPreview, type PrizeMoneyPreviewItem } from "@/lib/season/prize-money-preview";
import { buildRetoolParityMatrix, type RetoolParityRow } from "@/lib/ai/retool-parity-matrix";

export type AiNeedsPicksCompareSource = "sqlite" | "prisma";
export type AiNeedsPicksCompareTeamScope = "ai" | "all";
export type AiNeedsPicksCompareStatus = "matched" | "partial" | "deviated" | "retool_pick_source_missing" | "blocked";
export type AiNeedsPickLane = "superstar" | "star" | "core" | "specialist" | "depth" | "cheap_fill" | "backup";
export type AiNeedsPickCostBand = "cheap_fill" | "backup" | "depth" | "core" | "star" | "superstar";
export type AiNeedsPicksRunMode = "default" | "season1_optimum_execute";

const AI_CHEAP_FILL_MARKET_VALUE_CAP = 15;
const AI_RESERVE_MARKET_VALUE_CAP = 20;
const AI_EXPENSIVE_EARLY_SCAN_CAP = 60;

export type AiNeedsPicksCompareParams = {
  source?: AiNeedsPicksCompareSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  teamScope?: AiNeedsPicksCompareTeamScope;
  teamIds?: string[] | null;
  excludedPlayerIds?: string[] | null;
  limit?: number | null;
  fullScoringLimit?: number | null;
  steps?: number | null;
  runMode?: AiNeedsPicksRunMode | null;
  draftSeed?: string | null;
};

export type AiNeedsPicksOpenNeed = {
  axis: "pow" | "spe" | "men" | "soc" | "roster" | "star" | "core" | "depth" | "specialist" | "backup";
  label: string;
  importance: number;
  reason: string;
  sourceStatus: "mapped" | "partial" | "missing_source";
};

export type AiNeedsPicksBudgetLane = {
  lane: AiNeedsPickLane;
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
  sourceStatus: "retool_reference" | "local_inferred" | "missing_source";
};

export type AiNeedsPicksCashStrategy = {
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
  maxSpendByLane: Record<AiNeedsPickLane, number | null>;
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
  rosterPressure: number;
  needPressure: number;
  spendArchitecture: {
    allowed_budget_for_search: number | null;
    maxSpendTotalThisWindow: number | null;
    maxSpendPerPick: number | null;
    maxSpendByLane: Record<AiNeedsPickLane, number | null>;
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
    financePosture:
      | "conservative"
      | "balanced"
      | "aggressive"
      | "desperate"
      | "value_hunter"
      | "cash_rich_but_cautious"
      | "cash_poor_forced_fill";
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
    expectedGuvCurrentSeason: number | null;
    expectedGuvFiveSeasonSum: number | null;
    expectedProjectedCashAfterFiveSeasons: number | null;
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

export type AiNeedsPicksPlanner = {
  plannerSource: "retool_reference" | "local_inferred";
  slotPlan: AiNeedsPickLane[];
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

export type AiNeedsPicksSeasonStrategy = {
  primaryAxisPlan: "pow" | "spe" | "men" | "soc" | null;
  secondaryAxisPlan: "pow" | "spe" | "men" | "soc" | null;
  disciplineFocus: string[];
  rosterTarget: number | null;
  minimumRoster: number;
  optimumRoster: number | null;
  starCoreDepthFillArchitecture: {
    star: number;
    core: number;
    specialist: number;
    depth: number;
    fill: number;
    backup: number;
  };
  expectedWeaknesses: string[];
  neededSlotTypes: string[];
  formCardColorPlan: {
    primaryFormColors: FormCardColor[];
    secondaryFormColors: FormCardColor[];
    existingFormColors: FormCardColor[];
    missingFormColors: FormCardColor[];
    desiredClassColor: FormCardColor | null;
    formColorCoverageScore: number;
    formColorFlexScore: number;
  };
  financePosture:
    | "conservative"
    | "balanced"
    | "aggressive"
    | "desperate"
    | "value_hunter"
    | "cash_rich_but_cautious"
    | "cash_poor_forced_fill";
  spendArchitecture: string;
  savingsBias: number;
  attackPressure: number;
  seasonRiskTolerance: number;
};

export type AiNeedsPicksCoverage = {
  coreThemeCoverage: number;
  primaryAxisCoverage: number;
  secondaryAxisCoverage: number;
  disciplineCoverage: number;
  formColorCoverage: number;
  rosterLaneCoverage: number;
  starCoreCoverage: number;
  depthCoverage: number;
  specialistCoverage: number;
};

export type AiNeedsPicksCandidateScore = {
  candidateId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  price: number | null;
  salary: number | null;
  ovr: number | null;
  mvs: number | null;
  candidateAxis: "pow" | "spe" | "men" | "soc" | null;
  bestNeedDisciplineId: string | null;
  formColor: FormCardColor | null;
  pickedForFormColor: boolean;
  formColorReason: string | null;
  formColorCoverageBefore?: Record<FormCardColor, number>;
  formColorCoverageAfter?: Record<FormCardColor, number>;
  formColorDoubleBoostPotential?: boolean;
  strategicException: boolean;
  strategicExceptionReason: string | null;
  minimumReachableAfterPick?: boolean;
  mustFeelRightStatus: "strong_fit" | "on_plan" | "warning" | "risky_but_allowed";
  focusTeamStatus?: "ok" | "warning" | "blocked";
  focusTeamReason?: string | null;
  focusTeamFitScore?: number | null;
  focusTeamMetrics?: Record<string, number>;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  teamCashTier: "cash_poor" | "tight" | "stable" | "healthy" | "rich";
  budgetStretchApplied: boolean;
  budgetStretchReason: string | null;
  budgetStretchPhaseAllowed: boolean;
  budgetStretchBlockedReason: string | null;
  effectiveLanePriceCap: number | null;
  effectiveLaneSpendCap: number | null;
  phaseCap: number | null;
  capExceeded: boolean;
  capOverrideReason: string | null;
  draftSeed?: string | null;
  baseScore?: number | null;
  tieBreakJitter?: number | null;
  scoreWithSeed?: number | null;
  tieBreakBand?: string | null;
  finalScore: number;
  scoreBreakdown: {
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
    mercenaryNegativeFitPenalty: number;
  };
  reasons: string[];
};

type AiNeedsPickPhase = AiNeedsPicksCandidateScore["pickPhase"];

export type AiNeedsPicksPlannedPick = {
  step: number;
  lane: AiNeedsPickLane;
  pickLane: string;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  teamCashTier: "cash_poor" | "tight" | "stable" | "healthy" | "rich";
  minimumSecured: boolean;
  reserveSecured: boolean;
  plannedLane: AiNeedsPickLane;
  effectiveLaneCap: number | null;
  phaseCap: number | null;
  capExceeded: boolean;
  capOverrideReason: string | null;
  laneReason: string;
  laneBudgetLimit: number | null;
  laneBudgetUsed: number | null;
  budgetStretchApplied: boolean;
  budgetStretchReason: string | null;
  budgetStretchPhaseAllowed: boolean;
  budgetStretchBlockedReason: string | null;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  price: number | null;
  salary: number | null;
  ovr: number | null;
  mvs: number | null;
  formColor: FormCardColor | null;
  pickedForFormColor: boolean;
  formColorReason: string | null;
  formColorCoverageBefore?: Record<FormCardColor, number>;
  formColorCoverageAfter?: Record<FormCardColor, number>;
  formColorDoubleBoostPotential?: boolean;
  strategicException: boolean;
  strategicExceptionReason: string | null;
  mustFeelRightStatus: "strong_fit" | "on_plan" | "warning" | "risky_but_allowed";
  focusTeamStatus?: "ok" | "warning" | "blocked";
  focusTeamReason?: string | null;
  focusTeamFitScore?: number | null;
  focusTeamMetrics?: Record<string, number>;
  candidateAxis: "pow" | "spe" | "men" | "soc" | null;
  bestNeedDisciplineId: string | null;
  expectedCostBand?: AiNeedsPickCostBand | null;
  actualCostBand?: AiNeedsPickCostBand | null;
  cheapestCandidateSeen?: number | null;
  cheapestCandidateSameAxis?: number | null;
  cheapestCandidateSameTeamFitBand?: number | null;
  cheapestCandidateSameClassFamily?: number | null;
  priceDeltaVsCheapest?: number | null;
  valueJustification?: string[];
  rejectedCheaperAlternatives?: Array<{
    playerId: string;
    playerName: string;
    className: string;
    price: number | null;
    finalScore: number;
  }>;
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
  draftSeed?: string | null;
  baseScore?: number | null;
  tieBreakJitter?: number | null;
  scoreWithSeed?: number | null;
  tieBreakBand?: string | null;
  finalScore: number;
  scoreBreakdown: AiNeedsPicksCandidateScore["scoreBreakdown"];
  reasons: string[];
};

export type AiNeedsPicksSequentialStateSnapshot = {
  step: number;
  lane: AiNeedsPickLane;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  teamCashTier: "cash_poor" | "tight" | "stable" | "healthy" | "rich";
  minimumSecured: boolean;
  reserveSecured: boolean;
  phaseCap: number | null;
  rosterCountBefore: number | null;
  rosterCountAfter: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  minimumSlotsBefore: number;
  minimumSlotsAfter: number;
  minimumReserveBefore: number | null;
  minimumReserveAfter: number | null;
  minimumReachableAfterStep: boolean;
  laneBudgetUsed: number | null;
  laneBudgetRemaining: number | null;
  laneSlotsRemaining: number;
  remainingOpenNeedAxes: string[];
  pickedPlayerIds: string[];
};

export type AiNeedsPicksRetoolReference = {
  rank: number;
  playerName: string;
  sourceFile: string;
  note: string;
};

export type AiNeedsPicksCompareTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  currentRosterState: {
    cash: number | null;
    salaryTotal: number | null;
    rosterCount: number | null;
    targetRosterMin: number | null;
    targetRosterOpt: number | null;
    targetRosterSize: number | null;
    targetRosterGap: number | null;
    budgetStatus: "healthy" | "tight" | "critical" | "unknown";
  };
  openNeeds: AiNeedsPicksOpenNeed[];
  planner: AiNeedsPicksPlanner;
  cashStrategy: AiNeedsPicksCashStrategy;
  seasonStrategy: AiNeedsPicksSeasonStrategy;
  coverage: AiNeedsPicksCoverage;
  budgetLanes: AiNeedsPicksBudgetLane[];
  minimumFeasibility: {
    plannedPickIndex: number | null;
    remainingMinimumSlots: number;
    cheapestLegalCandidate: number | null;
    projectedCashAfterPick: number | null;
    reserveForMinimum: number | null;
    minimumFeasible: boolean;
    blockerReason: string | null;
    candidatePoolSource: "legal_candidate_pool" | "top_targets" | "recommended_buys";
    candidatePoolSize: number;
  };
  candidatePoolTop: AiNeedsPicksCandidateScore[];
  plannedPicks: AiNeedsPicksPlannedPick[];
  sequentialStateSnapshots: AiNeedsPicksSequentialStateSnapshot[];
  compareStatus: AiNeedsPicksCompareStatus;
  focusTeamDiagnostics?: {
    status: "ok" | "warning" | "blocked";
    primaryIssue: string | null;
    badPickExample: string | null;
    pickPhase: string | null;
    currentReason: string | null;
    betterCandidateExamples: string[];
    recommendedFix: string | null;
    cCFirstSeven?: Array<{
      playerName: string;
      price: number | null;
      lane: string;
      valueScore: number;
      luxuryBusinessShowFit: number | null;
      betterAlternatives: string[];
    }>;
    mMEliteCore?: Array<{
      playerName: string;
      lane: string;
      aggroFit: number | null;
      eliteFit: number | null;
      championFit: number | null;
      offTheme: boolean;
      betterAlternatives: string[];
    }>;
    nNCapDiagnosis?: {
      status: "phase_cap_correct" | "phase_cap_too_strict" | "identity_exception_allowed" | "better_alternative_available";
      playerName: string | null;
      reason: string | null;
    } | null;
  };
  retoolTopPicksStatus: "available" | "retool_pick_source_missing";
  retoolTopPicks: AiNeedsPicksRetoolReference[];
  retoolReferenceFiles: string[];
  matches: string[];
  deviations: Array<{
    step: number;
    expectedPlayerName: string | null;
    actualPlayerName: string | null;
    reason: string;
  }>;
  deviationReasons: string[];
  warnings: string[];
};

export type AiNeedsPicksCompareResult = {
  readOnly: true;
  source: AiNeedsPicksCompareSource;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: AiNeedsPicksCompareTeamScope;
    compareSet: string[];
  };
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  comparedTeams: number;
  matchedTeams: number;
  partialTeams: number;
  deviatedTeams: number;
  missingRetoolTeams: number;
  blockedTeams: number;
  teams: AiNeedsPicksCompareTeamEntry[];
  retoolParityMatrix: RetoolParityRow[];
};

type ResolvedCompareContext = {
  source: AiNeedsPicksCompareSource;
  saveId: string;
  seasonId: string;
  gameState: GameState;
};

type ComparePrizeSignal = AiNeedsPicksCashStrategy["expectedPrizeSignal"];

const DEFAULT_COMPARE_SET = ["C-C", "W-W", "T-T", "A-A"];
const RETOOL_REFERENCE_FILES = [
  "references/retool-ai-golden-master/aiTeamNeedsQuery.js",
  "references/retool-ai-golden-master/aiPlannedPicks.txt",
  "references/retool-ai-golden-master/AI2_06_SimulatePicks.js",
  "references/retool-ai-golden-master/aiSNP_pickStep.js",
  "references/retool-ai-golden-master/finalPicksScore100_v2_withWant.js",
  "references/retool-ai-golden-master/aiPackageScoringConfig.state.js",
  "references/retool-ai-golden-master/cashCreatorPackageScoringConfig.state.js",
  "references/retool-ai-golden-master/aiPickSeasonPlan.js",
  "references/retool-ai-golden-master/aiPickSeasonPreview.js",
  "references/retool-ai-golden-master/aiSequentialNeedsPreview.js",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function canAffordWithoutNegativeCash(price: number | null | undefined, cash: number | null | undefined) {
  if (price == null || cash == null) {
    return true;
  }
  return roundValue(cash - price, 2) >= 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function formatLaneReserve(value: number | null) {
  return value == null ? "—" : roundValue(value, 2).toFixed(2);
}

function quantile(values: Array<number | null | undefined>, q: number) {
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (normalized.length === 0) {
    return 0;
  }
  if (normalized.length === 1) {
    return normalized[0]!;
  }
  const position = clamp(q, 0, 1) * (normalized.length - 1);
  const base = Math.floor(position);
  const rest = position - base;
  const current = normalized[base]!;
  const next = normalized[Math.min(base + 1, normalized.length - 1)]!;
  return current + (next - current) * rest;
}

type LaneMarketAnchors = {
  q25Price: number;
  q50Price: number;
  q75Price: number;
  q85Price: number;
  q90Price: number;
  q95Price: number;
};

function buildLaneMarketAnchors(candidates: AiTransferPreviewRecommendation[]): LaneMarketAnchors {
  return {
    q25Price: quantile(
      candidates.map((entry) => entry.price ?? entry.marketValue ?? null),
      0.25,
    ),
    q50Price: quantile(
      candidates.map((entry) => entry.price ?? entry.marketValue ?? null),
      0.5,
    ),
    q75Price: quantile(
      candidates.map((entry) => entry.price ?? entry.marketValue ?? null),
      0.75,
    ),
    q85Price: quantile(
      candidates.map((entry) => entry.price ?? entry.marketValue ?? null),
      0.85,
    ),
    q90Price: quantile(
      candidates.map((entry) => entry.price ?? entry.marketValue ?? null),
      0.9,
    ),
    q95Price: quantile(
      candidates.map((entry) => entry.price ?? entry.marketValue ?? null),
      0.95,
    ),
  };
}

function classifyCandidateTier(input: {
  price: number | null;
  anchors: LaneMarketAnchors;
}) {
  const price = input.price ?? 0;
  const isSuperstar = price > 0 && price >= Math.max(input.anchors.q95Price, input.anchors.q85Price * 1.2);
  const isStar =
    isSuperstar ||
    (price > 0 && price >= Math.max(input.anchors.q85Price, input.anchors.q75Price * 1.15));
  return {
    isSuperstar,
    isStar,
  };
}

function minFinite(values: Array<number | null | undefined>) {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  return Math.min(...finite);
}

export function normalizeAiNeedsPickLaneFamily(lane: string | null | undefined): AiNeedsPickCostBand | null {
  const normalized = normalizeToken(lane);
  if (normalized === "cheap_fill" || normalized === "minimum_safe_fill" || normalized === "expensive_minimum_fill" || normalized === "budget_risk_pick") return "cheap_fill";
  if (normalized === "backup" || normalized === "reserve") return "backup";
  if (normalized === "depth" || normalized === "depth_value") return "depth";
  if (normalized === "core" || normalized === "core_investment" || normalized === "specialist" || normalized === "specialist_investment")
    return "core";
  if (normalized === "star" || normalized === "star_pick") return "star";
  if (normalized === "superstar" || normalized === "superstar_pick") return "superstar";
  return null;
}

export function resolveExpectedAiPickCostBandFromLane(lane: string | null | undefined) {
  return normalizeAiNeedsPickLaneFamily(lane);
}

function buildAiNeedsCostBandCaps(input: {
  anchors: LaneMarketAnchors;
  expectedMinimumSlotCost?: number | null;
  currentCash?: number | null;
  minimumSlotsMissing?: number;
}) {
  const minimumSlotsMissing = Math.max(input.minimumSlotsMissing ?? 0, 0);
  const expectedMinimumSlotCost =
    input.expectedMinimumSlotCost && input.expectedMinimumSlotCost > 0
      ? input.expectedMinimumSlotCost
      : input.anchors.q25Price > 0
        ? input.anchors.q25Price
        : input.anchors.q50Price > 0
          ? input.anchors.q50Price * 0.7
          : 12;
  const minimumAverageBudget =
    input.currentCash != null && minimumSlotsMissing > 0
      ? roundValue(Math.max(input.currentCash / minimumSlotsMissing, expectedMinimumSlotCost), 2)
      : null;
  const cheapFillCap = roundValue(
    Math.min(
      AI_CHEAP_FILL_MARKET_VALUE_CAP,
      Math.max(
        1,
        minFinite([
          expectedMinimumSlotCost,
          input.anchors.q50Price > 0 ? input.anchors.q50Price * 0.86 : null,
          input.anchors.q25Price > 0 ? input.anchors.q25Price * 1.45 : null,
          minimumAverageBudget != null ? minimumAverageBudget * 0.95 : null,
          AI_CHEAP_FILL_MARKET_VALUE_CAP,
        ]) ?? AI_CHEAP_FILL_MARKET_VALUE_CAP,
      ),
    ),
    2,
  );
  const backupCap = roundValue(
    Math.min(
      AI_RESERVE_MARKET_VALUE_CAP,
      Math.max(
        cheapFillCap + 1.5,
        minFinite([
          input.anchors.q50Price > 0 ? input.anchors.q50Price * 1.02 : null,
          input.anchors.q75Price > 0 ? input.anchors.q75Price * 0.8 : null,
          minimumAverageBudget != null ? minimumAverageBudget * 1.2 : null,
          AI_RESERVE_MARKET_VALUE_CAP,
        ]) ?? AI_RESERVE_MARKET_VALUE_CAP,
      ),
    ),
    2,
  );
  const depthCap = roundValue(
    Math.min(
      AI_RESERVE_MARKET_VALUE_CAP,
      Math.max(
        backupCap + 1,
        minFinite([
          input.anchors.q75Price > 0 ? input.anchors.q75Price : null,
          input.anchors.q85Price > 0 ? input.anchors.q85Price * 0.88 : null,
          minimumAverageBudget != null ? minimumAverageBudget * (minimumSlotsMissing > 0 ? 1.45 : 1.75) : null,
          AI_RESERVE_MARKET_VALUE_CAP,
        ]) ?? AI_RESERVE_MARKET_VALUE_CAP,
      ),
    ),
    2,
  );
  const coreCap = roundValue(
    Math.max(
      depthCap + 2,
      minFinite([
        input.anchors.q85Price > 0 ? input.anchors.q85Price : null,
        input.anchors.q90Price > 0 ? input.anchors.q90Price * 0.9 : null,
        minimumAverageBudget != null ? minimumAverageBudget * (minimumSlotsMissing > 0 ? 1.8 : 2.25) : null,
      ]) ?? depthCap + 8,
    ),
    2,
  );
  const starCap = roundValue(Math.max(coreCap + 4, input.anchors.q90Price > 0 ? input.anchors.q90Price : coreCap + 10), 2);
  const superstarCap = roundValue(
    Math.max(starCap + 6, input.anchors.q95Price > 0 ? input.anchors.q95Price : starCap + 12),
    2,
  );
  return {
    cheap_fill: cheapFillCap,
    backup: backupCap,
    depth: depthCap,
    core: coreCap,
    star: starCap,
    superstar: superstarCap,
  } satisfies Record<AiNeedsPickCostBand, number>;
}

function resolveActualAiPickCostBand(input: {
  price: number | null;
  salary: number | null;
  anchors: LaneMarketAnchors;
  expectedMinimumSlotCost?: number | null;
  currentCash?: number | null;
  minimumSlotsMissing?: number;
}) {
  if (input.price == null || !Number.isFinite(input.price) || input.price <= 0) {
    return null;
  }
  const caps = buildAiNeedsCostBandCaps({
    anchors: input.anchors,
    expectedMinimumSlotCost: input.expectedMinimumSlotCost,
    currentCash: input.currentCash,
    minimumSlotsMissing: input.minimumSlotsMissing,
  });
  if (
    isCheapFillCandidate({
      price: input.price,
      salary: input.salary,
      anchors: input.anchors,
      expectedMinimumSlotCost: input.expectedMinimumSlotCost,
      currentCash: input.currentCash,
      minimumSlotsMissing: input.minimumSlotsMissing,
    })
  ) {
    return "cheap_fill" as const;
  }
  if (input.price <= caps.backup + 0.01) return "backup";
  if (input.price <= caps.depth + 0.01) return "depth";
  if (input.price <= caps.core + 0.01) return "core";
  if (input.price <= caps.star + 0.01) return "star";
  return "superstar";
}

function isCheapFillCandidate(input: {
  price: number | null;
  salary: number | null;
  anchors: LaneMarketAnchors;
  expectedMinimumSlotCost?: number | null;
  currentCash?: number | null;
  minimumSlotsMissing?: number;
}) {
  const tier = classifyCandidateTier({
    price: input.price,
    anchors: input.anchors,
  });
  if (tier.isStar || tier.isSuperstar) {
    return false;
  }
  const price = input.price ?? 0;
  const salary = input.salary ?? 0;
  const caps = buildAiNeedsCostBandCaps({
    anchors: input.anchors,
    expectedMinimumSlotCost: input.expectedMinimumSlotCost,
    currentCash: input.currentCash,
    minimumSlotsMissing: input.minimumSlotsMissing,
  });
  const cheapPriceCap = Math.min(caps.cheap_fill, AI_CHEAP_FILL_MARKET_VALUE_CAP);
  const cheapSalaryCap = roundValue(Math.max(4.5, Math.min(8.5, cheapPriceCap * 0.21)), 2);
  return price > 0 && price <= cheapPriceCap && salary <= cheapSalaryCap;
}

function getMinimumReserve(input: {
  candidates: AiTransferPreviewRecommendation[];
  missingSlots: number;
  excludedPlayerIds?: string[];
  anchors: LaneMarketAnchors;
}) {
  if (input.missingSlots <= 0) {
    return {
      reservedCash: 0,
      floorPrice: 0,
      usedExpensiveFallback: false,
      reachable: true,
      missingReason: null as string | null,
    };
  }

  const excluded = new Set(input.excludedPlayerIds ?? []);
  const normalized = input.candidates
    .filter((entry) => !excluded.has(entry.playerId))
    .map((entry) => ({
      playerId: entry.playerId,
      price: entry.price ?? entry.marketValue ?? null,
      salary: entry.salary ?? null,
      cheapEligible: isCheapFillCandidate({
        price: entry.price ?? entry.marketValue ?? null,
        salary: entry.salary ?? null,
        anchors: input.anchors,
      }),
    }))
    .filter((entry) => entry.price != null && entry.price > 0)
    .sort((left, right) => (left.price ?? 0) - (right.price ?? 0));

  if (normalized.length < input.missingSlots) {
    return {
      reservedCash: null,
      floorPrice: null,
      usedExpensiveFallback: false,
      reachable: false,
      missingReason: "minimum_unreachable_no_legal_candidates",
    };
  }

  const cheapOnly = normalized.filter((entry) => entry.cheapEligible);
  const cheapestPool = (cheapOnly.length >= input.missingSlots ? cheapOnly : normalized).slice(0, input.missingSlots);
  if (cheapestPool.length < input.missingSlots) {
    return {
      reservedCash: null,
      floorPrice: null,
      usedExpensiveFallback: false,
      reachable: false,
      missingReason: "minimum_unreachable_no_legal_candidates",
    };
  }

  const reservedCash = roundValue(
    cheapestPool.reduce((sum, entry) => sum + (entry.price ?? 0), 0),
    2,
  );
  const floorPrice = roundValue(Math.max(...cheapestPool.map((entry) => entry.price ?? 0)), 2);
  return {
    reservedCash,
    floorPrice,
    usedExpensiveFallback: cheapOnly.length < input.missingSlots,
    reachable: true,
    missingReason: cheapOnly.length < input.missingSlots ? "blocked_minimum_no_cheap_candidate" : null,
  };
}

type MinimumReservePool = {
  normalized: Array<{
    playerId: string;
    price: number;
    cheapEligible: boolean;
  }>;
  cheapOnly: Array<{
    playerId: string;
    price: number;
    cheapEligible: boolean;
  }>;
};

function buildMinimumReservePool(candidates: AiTransferPreviewRecommendation[], anchors: LaneMarketAnchors): MinimumReservePool {
  const normalized = candidates
    .map((entry) => {
      const price = entry.price ?? entry.marketValue ?? null;
      return {
        playerId: entry.playerId,
        price,
        cheapEligible: isCheapFillCandidate({
          price,
          salary: entry.salary ?? null,
          anchors,
        }),
      };
    })
    .filter((entry): entry is { playerId: string; price: number; cheapEligible: boolean } => entry.price != null && entry.price > 0)
    .sort((left, right) => left.price - right.price);

  return {
    normalized,
    cheapOnly: normalized.filter((entry) => entry.cheapEligible),
  };
}

function getMinimumReserveFromPool(input: {
  pool: MinimumReservePool;
  missingSlots: number;
  excludedPlayerIds?: readonly string[];
  additionalExcludedPlayerId?: string | null;
}) {
  if (input.missingSlots <= 0) {
    return {
      reservedCash: 0,
      floorPrice: 0,
      usedExpensiveFallback: false,
      reachable: true,
      missingReason: null as string | null,
    };
  }

  const excluded = new Set(input.excludedPlayerIds ?? []);
  const isExcluded = (playerId: string) => excluded.has(playerId) || playerId === input.additionalExcludedPlayerId;
  const pickCheapest = (pool: MinimumReservePool["normalized"]) => {
    const picked: MinimumReservePool["normalized"] = [];
    for (const entry of pool) {
      if (isExcluded(entry.playerId)) {
        continue;
      }
      picked.push(entry);
      if (picked.length >= input.missingSlots) {
        break;
      }
    }
    return picked;
  };

  const cheapPicked = pickCheapest(input.pool.cheapOnly);
  const cheapestPool = cheapPicked.length >= input.missingSlots ? cheapPicked : pickCheapest(input.pool.normalized);
  if (cheapestPool.length < input.missingSlots) {
    return {
      reservedCash: null,
      floorPrice: null,
      usedExpensiveFallback: false,
      reachable: false,
      missingReason: "minimum_unreachable_no_legal_candidates",
    };
  }

  const reservedCash = roundValue(
    cheapestPool.reduce((sum, entry) => sum + entry.price, 0),
    2,
  );
  const floorPrice = roundValue(Math.max(...cheapestPool.map((entry) => entry.price)), 2);
  return {
    reservedCash,
    floorPrice,
    usedExpensiveFallback: cheapPicked.length < input.missingSlots,
    reachable: true,
    missingReason: cheapPicked.length < input.missingSlots ? "blocked_minimum_no_cheap_candidate" : null,
  };
}

function getTargetReserveFromPool(input: {
  pool: MinimumReservePool;
  missingSlots: number;
  excludedPlayerIds?: readonly string[];
  additionalExcludedPlayerId?: string | null;
}) {
  if (input.missingSlots <= 0) {
    return {
      reservedCash: 0,
      floorPrice: 0,
      reachable: true,
      missingReason: null as string | null,
    };
  }

  const excluded = new Set(input.excludedPlayerIds ?? []);
  const picked: MinimumReservePool["normalized"] = [];
  for (const entry of input.pool.normalized) {
    if (excluded.has(entry.playerId) || entry.playerId === input.additionalExcludedPlayerId) {
      continue;
    }
    picked.push(entry);
    if (picked.length >= input.missingSlots) {
      break;
    }
  }

  if (picked.length < input.missingSlots) {
    return {
      reservedCash: null,
      floorPrice: null,
      reachable: false,
      missingReason: "target_unreachable_no_legal_candidates_after_global_reservation",
    };
  }

  return {
    reservedCash: roundValue(
      picked.reduce((sum, entry) => sum + entry.price, 0),
      2,
    ),
    floorPrice: roundValue(Math.max(...picked.map((entry) => entry.price)), 2),
    reachable: true,
    missingReason: null,
  };
}

function buildDiverseCandidatePool<T extends { className: string }>(entries: T[], limit: number, perClassCap = 2) {
  const selected: T[] = [];
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const classToken = normalizeToken(entry.className);
    const current = counts.get(classToken) ?? 0;
    if (current >= perClassCap) {
      continue;
    }
    selected.push(entry);
    counts.set(classToken, current + 1);
    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const entry of entries) {
    if (selected.includes(entry)) {
      continue;
    }
    selected.push(entry);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeManagementValue(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  const normalized = Number(value);
  if (normalized <= 10) {
    return clamp(normalized / 10, 0, 1);
  }
  return clamp(normalized / 100, 0, 1);
}

const CLASS_COLOR_BY_CLASS: Record<string, "red" | "green" | "blue" | "yellow"> = {
  berserker: "red",
  warlord: "red",
  tank: "red",
  sprinter: "green",
  rogue: "green",
  charger: "green",
  mage: "blue",
  overseer: "blue",
  templar: "blue",
  bard: "yellow",
  hero: "yellow",
  badass: "yellow",
  tactician: "yellow",
};

const CLASS_AXIS_BY_COLOR: Record<"red" | "green" | "blue" | "yellow", "pow" | "spe" | "men" | "soc"> = {
  red: "pow",
  green: "spe",
  blue: "men",
  yellow: "soc",
};

function getSemanticTokens(value: string) {
  const normalized = normalizeToken(value);
  const semantic = new Set<string>();
  if (!normalized) {
    return semantic;
  }

  semantic.add(normalized);
  const mappedColor = CLASS_COLOR_BY_CLASS[normalized];
  if (mappedColor) {
    semantic.add(mappedColor);
    semantic.add(CLASS_AXIS_BY_COLOR[mappedColor]);
  }

  if (["wizard", "warlock", "summoner", "arcane", "spell", "mage", "magic"].some((entry) => normalized.includes(entry))) {
    semantic.add("blue");
    semantic.add("men");
    semantic.add("mage");
    semantic.add("magic");
  }
  if (["teacher", "leader", "captain", "mentor", "bard", "hero", "tactician", "charisma", "social"].some((entry) => normalized.includes(entry))) {
    semantic.add("yellow");
    semantic.add("soc");
    semantic.add("leader");
    semantic.add("mentor");
  }
  if (["assassin", "ninja", "rogue", "sprinter", "charger", "agile", "speed", "scout"].some((entry) => normalized.includes(entry))) {
    semantic.add("green");
    semantic.add("spe");
    semantic.add("agile");
    semantic.add("speed");
  }
  if (["berserker", "warlord", "tank", "bruiser", "guardian", "frontline", "power"].some((entry) => normalized.includes(entry))) {
    semantic.add("red");
    semantic.add("pow");
    semantic.add("bruiser");
    semantic.add("frontline");
  }

  return semantic;
}

function hasSemanticMatch(values: string[], candidateTokens: string[]) {
  const candidateSet = new Set<string>();
  for (const token of candidateTokens) {
    for (const semantic of getSemanticTokens(token)) {
      candidateSet.add(semantic);
    }
  }

  return values.some((value) => {
    const semanticTokens = [...getSemanticTokens(value)];
    return semanticTokens.some(
      (semantic) =>
        candidateSet.has(semantic) || [...candidateSet].some((candidate) => candidate.includes(semantic) || semantic.includes(candidate)),
    );
  });
}

function countSemanticMatches(values: string[], candidateTokens: string[]) {
  const candidateSet = new Set<string>();
  for (const token of candidateTokens) {
    for (const semantic of getSemanticTokens(token)) {
      candidateSet.add(semantic);
    }
  }

  return values.filter((value) => {
    const semanticTokens = [...getSemanticTokens(value)];
    return semanticTokens.some(
      (semantic) =>
        candidateSet.has(semantic) ||
        [...candidateSet].some((candidate) => candidate.includes(semantic) || semantic.includes(candidate)),
    );
  }).length;
}

function getTeamIdentityRow(gameState: GameState, teamId: string) {
  return gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
}

function getRetoolIdentityOverride(team: Team) {
  return (
    RETOOL_TEAM_IDENTITY_OVERRIDES[team.teamId as keyof typeof RETOOL_TEAM_IDENTITY_OVERRIDES] ??
    RETOOL_TEAM_IDENTITY_OVERRIDES[team.shortCode as keyof typeof RETOOL_TEAM_IDENTITY_OVERRIDES] ??
    RETOOL_TEAM_IDENTITY_OVERRIDES[team.name as keyof typeof RETOOL_TEAM_IDENTITY_OVERRIDES] ??
    null
  );
}

function tokenizeThemeText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
}

function buildPlayerThemeTokens(player: Player) {
  return [
    player.name,
    player.className,
    player.referenceClass ?? "",
    player.race,
    player.gender ?? "",
    ...player.subclasses,
    ...player.traitsPositive,
    ...player.traitsNegative,
  ].filter((entry) => entry.trim().length > 0);
}

const STRICT_IDENTITY_FOCUS_TEAM_CODES = new Set([
  "C-C",
  "W-W",
  "T-T",
  "A-A",
  "N-W",
  "C-S",
  "M-M",
  "G-G",
  "N-N",
  "D-P",
  "H-R",
  "T-G",
  "V-D",
  "P-C",
]);

type V4FocusTeamProfile = {
  code: string;
  preferredAxes: Array<"pow" | "spe" | "men" | "soc">;
  primaryTokens: string[];
  secondaryTokens: string[];
  avoidTokens: string[];
  namedMetricKeys: string[];
};

const V4_FOCUS_TEAM_PROFILES: Record<string, V4FocusTeamProfile> = {
  "M-M": {
    code: "M-M",
    preferredAxes: ["pow", "spe"],
    primaryTokens: ["berserker", "assassin", "rogue", "champion", "gladiator", "hunter", "charger", "mercenary"],
    secondaryTokens: ["hero", "sprinter", "warlord", "duelist", "warrior"],
    avoidTokens: ["teacher", "cleric", "bard", "social", "charmer", "noble", "royal", "court", "merchant", "broker"],
    namedMetricKeys: ["aggroFit", "eliteFit", "championFit"],
  },
  "C-C": {
    code: "C-C",
    preferredAxes: ["spe", "soc"],
    primaryTokens: ["trader", "merchant", "noble", "bard", "boss", "king", "charmer", "broker"],
    secondaryTokens: ["mercenary", "sprinter", "rogue", "hero", "divine"],
    avoidTokens: [],
    namedMetricKeys: ["luxuryBusinessShowFit", "valueMoneyballFit"],
  },
  "C-S": {
    code: "C-S",
    preferredAxes: ["spe", "pow"],
    primaryTokens: ["duelist", "samurai", "knight", "swordsman", "rogue", "sprinter", "charger"],
    secondaryTokens: ["hero", "warrior", "guardian"],
    avoidTokens: ["ooze", "plant", "demon", "monster", "chaos", "undead"],
    namedMetricKeys: ["precisionSteelFit", "duelistFit"],
  },
  "G-G": {
    code: "G-G",
    preferredAxes: ["pow", "soc"],
    primaryTokens: ["paladin", "angel", "cleric", "hero", "guardian", "knight", "divine"],
    secondaryTokens: ["gladiator", "warrior", "healer"],
    avoidTokens: ["demon", "undead", "necromancer"],
    namedMetricKeys: ["orderFit", "holyWarriorFit"],
  },
  "A-A": {
    code: "A-A",
    preferredAxes: ["pow", "spe"],
    primaryTokens: ["berserker", "hunter", "rogue", "ranger", "survivor", "charger", "construct"],
    secondaryTokens: ["mercenary", "tank", "warrior", "assassin"],
    avoidTokens: ["angel", "paladin", "bard"],
    namedMetricKeys: ["survivalFit", "aftermathFit"],
  },
  "N-W": {
    code: "N-W",
    preferredAxes: ["spe", "soc"],
    primaryTokens: ["druid", "beast", "animal", "plant", "elf", "healer", "ranger"],
    secondaryTokens: ["hero", "sprinter", "guardian", "mage"],
    avoidTokens: ["construct", "cyber", "mech", "robot"],
    namedMetricKeys: ["natureFit", "balanceFit"],
  },
  "N-N": {
    code: "N-N",
    preferredAxes: ["spe", "pow"],
    primaryTokens: ["rogue", "assassin", "ninja", "duelist", "sprinter", "monk", "ranger"],
    secondaryTokens: ["hero", "charger", "warrior"],
    avoidTokens: ["berserker", "warlord", "tank"],
    namedMetricKeys: ["ninjaFit", "precisionFit"],
  },
  "W-W": {
    code: "W-W",
    preferredAxes: ["men", "soc"],
    primaryTokens: ["mage", "wizard", "spirit", "scholar", "seer"],
    secondaryTokens: ["bard", "teacher", "divine"],
    avoidTokens: ["berserker", "warlord"],
    namedMetricKeys: ["arcaneFit", "mentalFit"],
  },
  "T-T": {
    code: "T-T",
    preferredAxes: ["men", "soc"],
    primaryTokens: ["teacher", "scholar", "mentor", "leader", "hero", "bard"],
    secondaryTokens: ["cleric", "sage", "human"],
    avoidTokens: ["demon", "berserker"],
    namedMetricKeys: ["academyFit", "leaderFit"],
  },
  "D-P": {
    code: "D-P",
    preferredAxes: ["soc", "men"],
    primaryTokens: ["female", "woman", "lady", "queen", "witch", "succubus", "demon", "dark", "shadow", "temptress"],
    secondaryTokens: ["hell", "infernal", "vampire", "rogue", "bard", "mage"],
    avoidTokens: ["construct", "robot", "holy", "paladin", "angel"],
    namedMetricKeys: ["darkFemaleFit", "demonCourtFit"],
  },
  "H-R": {
    code: "H-R",
    preferredAxes: ["pow", "soc"],
    primaryTokens: ["demon", "hell", "infernal", "devil", "fiend", "prime", "evil", "succubus", "incubus"],
    secondaryTokens: ["berserker", "warlord", "dark", "fire", "shadow"],
    avoidTokens: ["angel", "paladin", "divine", "elf", "construct"],
    namedMetricKeys: ["hellFit", "demonCoreFit"],
  },
  "T-G": {
    code: "T-G",
    preferredAxes: ["pow", "soc"],
    primaryTokens: ["giant", "titan", "colossus", "tall", "huge", "prime"],
    secondaryTokens: ["tank", "warlord", "guardian", "beast", "ogre"],
    avoidTokens: ["tiny", "small", "pixie", "goblin", "imp"],
    namedMetricKeys: ["heightFit", "giantFit"],
  },
  "V-D": {
    code: "V-D",
    preferredAxes: ["soc", "spe"],
    primaryTokens: ["female", "woman", "lady", "queen", "princess", "witch", "succubus", "animal", "pet", "beast"],
    secondaryTokens: ["bard", "hero", "elf", "aqua", "cat", "dog"],
    avoidTokens: ["male", "man", "lord", "king", "warrior"],
    namedMetricKeys: ["femalePetFit", "viciousDeliciousFit"],
  },
  "P-C": {
    code: "P-C",
    preferredAxes: ["spe", "soc"],
    primaryTokens: ["pirate", "swashbuckler", "wayfarer", "corsair", "sailor", "captain"],
    secondaryTokens: ["rogue", "bard", "aqua", "ocean", "sea", "water"],
    avoidTokens: ["paladin", "angel", "teacher", "construct"],
    namedMetricKeys: ["pirateCrewFit", "seaFit"],
  },
  "L-K": {
    code: "L-K",
    preferredAxes: ["men", "soc"],
    primaryTokens: ["undead", "vampire", "skeleton", "ghoul", "lich", "zombie", "ghost", "wraith", "revenant"],
    secondaryTokens: ["necromancer", "death", "dead", "mummy", "dark", "shadow"],
    avoidTokens: ["angel", "paladin", "divine", "plant", "elf"],
    namedMetricKeys: ["undeadKingdomFit", "lostKingdomFit"],
  },
};

function buildNormalizedPlayerTokenSet(player: Player) {
  return new Set(buildPlayerThemeTokens(player).flatMap((entry) => tokenizeThemeText(entry)));
}

function playerHasAnyThemeToken(player: Player, values: string[]) {
  const tokens = buildNormalizedPlayerTokenSet(player);
  return values.some((value) => {
    const normalizedValue = tokenizeThemeText(value)[0] ?? String(value).toLowerCase();
    return tokens.has(normalizedValue) || [...tokens].some((token) => token.includes(normalizedValue) || normalizedValue.includes(token));
  });
}

function isFemaleThemePlayer(player: Player) {
  const gender = String(player.gender ?? "").trim().toLowerCase();
  return gender === "female" || gender === "weiblich" || gender === "w" || playerHasAnyThemeToken(player, ["female", "woman", "girl", "lady", "madame", "queen", "princess", "witch", "succubus"]);
}

function isPetThemePlayer(player: Player) {
  return String(player.race ?? "").trim().toLowerCase() === "animal" || playerHasAnyThemeToken(player, ["animal", "pet", "beast", "cat", "dog"]);
}

function isDemonHellThemePlayer(player: Player) {
  return playerHasAnyThemeToken(player, ["demon", "hell", "fiend", "prime evil", "succubus", "incubus", "infernal", "devil"]);
}

function getPlayerHeightValue(player: Player) {
  const raw = (player as { height?: unknown }).height;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTallThemePlayer(player: Player) {
  return (
    getPlayerHeightValue(player) >= 5 ||
    playerHasAnyThemeToken(player, ["giant", "titan", "colossus", "tall", "huge", "ogre", "troll", "behemoth", "goliath", "hulk", "massive"])
  );
}

function getHardFocusRuleFailure(code: string, player: Player) {
  if (code === "H-R" && !isDemonHellThemePlayer(player)) return "hard_focus_h-r_requires_demon_hell";
  if (code === "D-P" && !isFemaleThemePlayer(player)) return "hard_focus_d-p_requires_female";
  if (code === "T-G" && !isTallThemePlayer(player)) return "hard_focus_t-g_requires_height_5_or_size_theme";
  if (code === "V-D" && !isFemaleThemePlayer(player) && !isPetThemePlayer(player)) return "hard_focus_v-d_requires_female_or_pet";
  return null;
}

function isStrictIdentityFocusTeam(team: Team) {
  return (
    STRICT_IDENTITY_FOCUS_TEAM_CODES.has(normalizeTeamCode(team.teamId)) ||
    STRICT_IDENTITY_FOCUS_TEAM_CODES.has(normalizeTeamCode(team.shortCode))
  );
}

function getV4FocusTeamProfile(team: Team) {
  const normalizedTeamId = normalizeTeamCode(team.teamId);
  const normalizedShortCode = normalizeTeamCode(team.shortCode);
  return V4_FOCUS_TEAM_PROFILES[normalizedTeamId] ?? V4_FOCUS_TEAM_PROFILES[normalizedShortCode] ?? null;
}

function isSeason1OptimumImpactTeam(team: Team) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  return code === "M-M" || code === "H-R" || code === "R-R";
}

function getSeason1LanePhilosophy(team: Team) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  if (code === "C-C") {
    return {
      premiumCap: 1,
      superstarCap: 0,
      coreBias: 0.34,
      specialistBias: 0.14,
      depthBias: 0.34,
      backupBias: 0.18,
      preferDepthOverStars: true,
      label: "value_buffer",
    } as const;
  }
  if (code === "A-A") {
    return {
      premiumCap: 1,
      superstarCap: 0,
      coreBias: 0.32,
      specialistBias: 0.12,
      depthBias: 0.36,
      backupBias: 0.2,
      preferDepthOverStars: true,
      label: "cash_poor_survival",
    } as const;
  }
  if (code === "T-T") {
    return {
      premiumCap: 2,
      superstarCap: 1,
      coreBias: 0.24,
      specialistBias: 0.12,
      depthBias: 0.2,
      backupBias: 0.12,
      preferDepthOverStars: false,
      label: "leaders_plus_students",
    } as const;
  }
  if (code === "B-P") {
    return {
      premiumCap: 2,
      superstarCap: 1,
      coreBias: 0.3,
      specialistBias: 0.14,
      depthBias: 0.14,
      backupBias: 0.08,
      preferDepthOverStars: false,
      label: "small_elite",
    } as const;
  }
  if (code === "M-M") {
    return {
      premiumCap: 3,
      superstarCap: 1,
      coreBias: 0.42,
      specialistBias: 0.16,
      depthBias: 0.1,
      backupBias: 0.04,
      preferDepthOverStars: false,
      label: "aggressive_top",
    } as const;
  }
  if (code === "C-S") {
    return {
      premiumCap: 1,
      superstarCap: 0,
      coreBias: 0.34,
      specialistBias: 0.18,
      depthBias: 0.22,
      backupBias: 0.1,
      preferDepthOverStars: false,
      label: "precise_honorable",
    } as const;
  }
  return {
    premiumCap: 2,
    superstarCap: 1,
    coreBias: 0.32,
    specialistBias: 0.16,
    depthBias: 0.22,
    backupBias: 0.1,
    preferDepthOverStars: false,
    label: "balanced",
  } as const;
}

function getSeason1OptimumSpendTargetPct(team: Team, identity: ReturnType<typeof getTeamIdentityRow>) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  let targetPct = 0.93;
  if (["M-M", "H-R", "R-R", "V-V"].includes(code)) {
    targetPct = 0.975;
  } else if (["C-C", "T-T", "N-W", "R-C"].includes(code)) {
    targetPct = 0.88;
  }
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  const finances = normalizeManagementValue(identity?.finances ?? 55);
  if (!["M-M", "H-R", "R-R", "V-V", "C-C", "T-T", "N-W", "R-C"].includes(code)) {
    if (ambition >= 0.72 && finances < 0.68) {
      targetPct = 0.96;
    } else if (finances >= 0.72 && ambition < 0.58) {
      targetPct = 0.88;
    }
  }
  return targetPct;
}

function getSeason1SpendCorridor(
  team: Team,
  identity: ReturnType<typeof getTeamIdentityRow>,
  expectedPrizeSignal: ComparePrizeSignal,
) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  const finances = normalizeManagementValue(identity?.finances ?? 55);
  const harmony = normalizeManagementValue(identity?.harmony ?? 50);
  const philosophy = getSeason1LanePhilosophy(team);
  let archetype = "normal";
  let minPct = 0.9;
  let maxPct = 0.95;

  if (code === "C-C") {
    archetype = "value_buffer";
    minPct = 0.85;
    maxPct = 0.92;
  } else if (code === "B-P") {
    archetype = "small_elite_top";
    minPct = 0.94;
    maxPct = 0.985;
  } else if (code === "A-A" || (team.budget != null && team.budget <= 180)) {
    archetype = "cash_poor_pragmatic";
    minPct = 0.85;
    maxPct = 0.95;
  } else if (code === "C-S") {
    archetype = "disciplined_precision";
    minPct = 0.88;
    maxPct = 0.93;
  } else if (code === "T-T") {
    archetype = "leaders_then_fill";
    minPct = 0.88;
    maxPct = 0.94;
  } else if (["M-M", "H-R", "R-R", "V-V", "D-L"].includes(code) || ambition >= 0.78) {
    archetype = "aggressive_top";
    minPct = 0.95;
    maxPct = 1;
  } else if (finances >= 0.72 || harmony >= 0.74 || ["T-T", "N-W", "R-C"].includes(code)) {
    archetype = "cautious_or_value";
    minPct = 0.85;
    maxPct = 0.9;
  }

  const prizeAdjustment = getPrizeTrendSpendAdjustment(expectedPrizeSignal, identity);
  if (prizeAdjustment < 0) {
    minPct = Math.max(0.82, minPct + prizeAdjustment * 0.45);
    maxPct = Math.max(minPct + 0.03, maxPct + prizeAdjustment * 0.75);
  } else if (prizeAdjustment > 0) {
    minPct = Math.min(0.96, minPct + prizeAdjustment * 0.25);
    maxPct = Math.min(1, maxPct + prizeAdjustment * 0.5);
  }

  if (philosophy.preferDepthOverStars) {
    maxPct = Math.min(maxPct, code === "A-A" ? 0.95 : 0.92);
  }

  return {
    archetype,
    minPct: roundValue(minPct, 3),
    maxPct: roundValue(maxPct, 3),
  };
}

function getPrizeTrendSpendAdjustment(signal: ComparePrizeSignal, identity: ReturnType<typeof getTeamIdentityRow>) {
  if (signal.prizeSourceStatus === "missing_source" || signal.expectedPrizeTrend === "unknown") {
    return 0;
  }
  const ambition = normalizeManagementValue(identity?.ambition ?? 50);
  const finances = normalizeManagementValue(identity?.finances ?? 55);
  const partialFactor = signal.expectedPrizeFiveSeasonSum == null ? 0.75 : 1;
  if (signal.expectedPrizeTrend === "up") {
    return roundValue(((ambition >= 0.65 || finances < 0.55) ? 0.018 : 0.008) * partialFactor, 3);
  }
  if (signal.expectedPrizeTrend === "down") {
    const reduction = finances >= 0.68 ? -0.045 : ambition >= 0.72 ? -0.012 : -0.025;
    return roundValue(reduction * partialFactor, 3);
  }
  if (signal.expectedPrizeTrend === "volatile") {
    const reduction = finances >= 0.68 ? -0.03 : -0.015;
    return roundValue(reduction * partialFactor, 3);
  }
  return 0;
}

function getAdjustedSeason1OptimumSpendTargetPct(
  team: Team,
  identity: ReturnType<typeof getTeamIdentityRow>,
  expectedPrizeSignal: ComparePrizeSignal,
) {
  const base = getSeason1OptimumSpendTargetPct(team, identity);
  const corridor = getSeason1SpendCorridor(team, identity, expectedPrizeSignal);
  return roundValue(clamp(base + getPrizeTrendSpendAdjustment(expectedPrizeSignal, identity), corridor.minPct, corridor.maxPct), 3);
}

function isColdSteelThemeBreaker(playerClass: string | null | undefined, race: string | null | undefined) {
  const tokens = [playerClass, race].map(normalizeToken);
  return tokens.some((token) => token === "demon" || token === "monster" || token === "chaos" || token === "undead");
}

function findSeason1OptimumImpactCandidate(input: {
  team: Team;
  candidates: AiNeedsPicksCandidateScore[];
  current: AiNeedsPicksCandidateScore | null;
  remainingCash: number | null;
  minimumSlotsBefore: number;
  targetRosterSize: number | null;
  simulatedRosterCount: number | null;
}) {
  if (!isSeason1OptimumImpactTeam(input.team)) {
    return null;
  }
  const remainingCash = input.remainingCash;
  if (remainingCash == null || remainingCash <= 50) {
    return null;
  }
  if (input.simulatedRosterCount != null && input.targetRosterSize != null && input.simulatedRosterCount >= input.targetRosterSize) {
    return null;
  }
  const remainingTargetSlotsBefore =
    input.targetRosterSize != null && input.simulatedRosterCount != null
      ? Math.max(input.targetRosterSize - input.simulatedRosterCount, 1)
      : 1;
  const targetAwareSlotBudget = remainingCash / remainingTargetSlotsBefore;
  const maxTargetAwareImpactPrice = targetAwareSlotBudget * (input.minimumSlotsBefore > 0 ? 1.9 : 2.35);
  const minFit = normalizeTeamCode(input.team.shortCode || input.team.teamId) === "M-M" ? 6 : 4;
  const affordable = input.candidates.filter((candidate) => {
    if (candidate.price == null || !canAffordWithoutNegativeCash(candidate.price, remainingCash)) {
      return false;
    }
    if (candidate.price > maxTargetAwareImpactPrice + 0.01) {
      return false;
    }
    if (candidate.focusTeamStatus === "blocked") {
      return false;
    }
    if (input.minimumSlotsBefore > 0 && candidate.price > remainingCash * 0.42) {
      return false;
    }
    return (
      candidate.scoreBreakdown.teamIdentityScore >= minFit ||
      candidate.scoreBreakdown.needMatchScore >= 5 ||
      candidate.scoreBreakdown.disciplineCoverageScore >= 6
    );
  });
  if (affordable.length === 0) {
    return null;
  }
  const currentPrice = input.current?.price ?? 0;
  const currentScore = input.current?.finalScore ?? -999;
  const desiredMinPrice = input.minimumSlotsBefore > 0 ? 18 : 24;
  const impact = [...affordable]
    .filter((candidate) => (candidate.price ?? 0) >= desiredMinPrice)
    .sort((left, right) => {
      const leftImpact =
        left.scoreBreakdown.teamIdentityScore * 1.6 +
        left.scoreBreakdown.needMatchScore * 1.1 +
        left.scoreBreakdown.playerQualityScore * 0.9 +
        Math.min(left.price ?? 0, 65) * 0.28 +
        left.scoreBreakdown.disciplineCoverageScore * 0.6;
      const rightImpact =
        right.scoreBreakdown.teamIdentityScore * 1.6 +
        right.scoreBreakdown.needMatchScore * 1.1 +
        right.scoreBreakdown.playerQualityScore * 0.9 +
        Math.min(right.price ?? 0, 65) * 0.28 +
        right.scoreBreakdown.disciplineCoverageScore * 0.6;
      return rightImpact - leftImpact;
    })[0] ?? null;
  if (!impact) {
    return null;
  }
  if (impact.playerId === input.current?.playerId) {
    return null;
  }
  if ((impact.price ?? 0) <= currentPrice + 6 && impact.finalScore < currentScore - 10) {
    return null;
  }
  return impact;
}

function findSeason1OptimumSpendCandidate(input: {
  team: Team;
  identity: ReturnType<typeof getTeamIdentityRow>;
  expectedPrizeSignal: ComparePrizeSignal;
  candidates: AiNeedsPicksCandidateScore[];
  current: AiNeedsPicksCandidateScore | null;
  remainingCash: number | null;
  startingCash: number | null;
  minimumSlotsBefore: number;
  targetRosterSize: number | null;
  simulatedRosterCount: number | null;
}) {
  const remainingCash = input.remainingCash;
  const startingCash = input.startingCash;
  if (remainingCash == null || startingCash == null || startingCash <= 0) {
    return null;
  }
  if (input.simulatedRosterCount != null && input.targetRosterSize != null && input.simulatedRosterCount >= input.targetRosterSize) {
    return null;
  }
  const spendTargetPct = getAdjustedSeason1OptimumSpendTargetPct(input.team, input.identity, input.expectedPrizeSignal);
  const targetCashLeft = roundValue(startingCash * (1 - spendTargetPct), 2);
  if (remainingCash <= targetCashLeft + 18) {
    return null;
  }
  const remainingTargetSlotsBefore =
    input.targetRosterSize != null && input.simulatedRosterCount != null
      ? Math.max(input.targetRosterSize - input.simulatedRosterCount, 1)
      : Math.max(input.minimumSlotsBefore, 1);
  const targetAwareSlotBudget = Math.max((remainingCash - targetCashLeft) / remainingTargetSlotsBefore, 0);
  const maxTargetAwarePrice = targetAwareSlotBudget * (input.minimumSlotsBefore > 0 ? 1.65 : 2.15);
  const current = input.current;
  const currentPrice = current?.price ?? 0;
  const currentScore = current?.finalScore ?? -999;
  const code = normalizeTeamCode(input.team.shortCode || input.team.teamId);
  const minIdentity = code === "C-C" || code === "C-S" || code === "G-G" || code === "N-W" ? 2 : 0;
  const desiredMinPrice =
    input.minimumSlotsBefore > 0
      ? Math.min(Math.max(18, remainingCash * 0.14), 42)
      : Math.min(Math.max(24, remainingCash * 0.18), 58);
  const maxPriceShare = input.minimumSlotsBefore > 0 ? 0.58 : 0.82;
  const remainingMinimumSlotsAfterPick = Math.max(input.minimumSlotsBefore - 1, 0);
  const reservePerFutureMinimumPick = clamp(startingCash * 0.045, 10, 18);
  const maxMinimumSafePrice =
    input.minimumSlotsBefore > 0
      ? Math.max(0, remainingCash - remainingMinimumSlotsAfterPick * reservePerFutureMinimumPick - targetCashLeft)
      : null;
  const affordable = input.candidates
    .filter((candidate) => {
      if (candidate.price == null || !canAffordWithoutNegativeCash(candidate.price, remainingCash)) {
        return false;
      }
      if (candidate.price > maxTargetAwarePrice + 0.01) {
        return false;
      }
      if (maxMinimumSafePrice != null && candidate.price > maxMinimumSafePrice + 0.01) {
        return false;
      }
      if (candidate.focusTeamStatus === "blocked") {
        return false;
      }
      if (candidate.price <= currentPrice + 7) {
        return false;
      }
      if (candidate.price > remainingCash * maxPriceShare && candidate.finalScore < currentScore + 4) {
        return false;
      }
      return (
        candidate.scoreBreakdown.teamIdentityScore >= minIdentity ||
        candidate.scoreBreakdown.needMatchScore >= 4 ||
        candidate.scoreBreakdown.disciplineCoverageScore >= 5 ||
        candidate.scoreBreakdown.valueScore >= 3
      );
    })
    .sort((left, right) => {
      const leftScore =
        left.finalScore +
        Math.min(left.price ?? 0, 75) * 0.22 +
        left.scoreBreakdown.teamIdentityScore * 1.4 +
        left.scoreBreakdown.needMatchScore * 0.9 +
        left.scoreBreakdown.formColorCoverageScore * 1.15 +
        left.scoreBreakdown.formColorFlexScore * 0.55 -
        Math.max((left.price ?? 0) - desiredMinPrice, 0) * 0.03;
      const rightScore =
        right.finalScore +
        Math.min(right.price ?? 0, 75) * 0.22 +
        right.scoreBreakdown.teamIdentityScore * 1.4 +
        right.scoreBreakdown.needMatchScore * 0.9 +
        right.scoreBreakdown.formColorCoverageScore * 1.15 +
        right.scoreBreakdown.formColorFlexScore * 0.55 -
        Math.max((right.price ?? 0) - desiredMinPrice, 0) * 0.03;
      return rightScore - leftScore;
    });
  const candidate = affordable[0] ?? null;
  if (!candidate) {
    return null;
  }
  if ((candidate.price ?? 0) < desiredMinPrice && remainingCash > targetCashLeft + 45) {
    return null;
  }
  if (candidate.finalScore < currentScore - 32 && candidate.scoreBreakdown.teamIdentityScore < 3 && candidate.scoreBreakdown.needMatchScore < 4) {
    return null;
  }
  return candidate;
}

function getPostMinimumStrongReason(candidate: AiNeedsPicksCandidateScore) {
  const breakdown = candidate.scoreBreakdown;
  if (candidate.strategicExceptionReason && candidate.strategicExceptionReason !== "value_pick_despite_theme_risk") {
    return candidate.strategicExceptionReason;
  }
  if (candidate.finalScore >= 12 && breakdown.valueScore >= 10 && breakdown.teamIdentityScore >= 2 && breakdown.offThemePenalty > -4) {
    return "extreme_value";
  }
  if (breakdown.needMatchScore >= 7) {
    return "hard_need";
  }
  if (breakdown.disciplineCoverageScore >= 7) {
    return "hard_discipline_need";
  }
  if (breakdown.formColorCoverageScore >= 4) {
    return "form_color_gap";
  }
  if (breakdown.valueScore >= 9 && breakdown.teamIdentityScore >= 1 && breakdown.offThemePenalty > -6) {
    return "exceptional_value_with_fit";
  }
  return null;
}

function isPostMinimumQualityAcceptable(candidate: AiNeedsPicksCandidateScore) {
  if (candidate.focusTeamStatus === "blocked") {
    return false;
  }
  const breakdown = candidate.scoreBreakdown;
  const strongReason = getPostMinimumStrongReason(candidate);
  if (candidate.finalScore < 0) {
    return false;
  }
  if (breakdown.teamIdentityScore < 0) {
    return false;
  }
  if (breakdown.offThemePenalty <= -6) {
    return false;
  }
  if (candidate.strategicExceptionReason === "value_pick_despite_theme_risk") {
    return false;
  }
  if (breakdown.offThemePenalty <= -4 && strongReason == null) {
    return false;
  }
  if (breakdown.teamIdentityScore < 1 && breakdown.needMatchScore < 5 && breakdown.disciplineCoverageScore < 5 && strongReason == null) {
    return false;
  }
  return true;
}

function isIdentityProtectedSeason1Team(team: Team) {
  const code = normalizeTeamCode(team.shortCode || team.teamId);
  return code === "B-P" || code === "P-C" || code === "C-S" || code === "M-M";
}

function isSeason1MinimumIdentityAcceptable(_team: Team, candidate: AiNeedsPicksCandidateScore) {
  if (candidate.focusTeamStatus === "blocked") {
    return false;
  }
  return isRelativeMarketFitLegal(candidate);
}

function isRelativeMarketFitLegal(candidate: AiNeedsPicksCandidateScore) {
  if (candidate.focusTeamStatus === "blocked") {
    return false;
  }
  if (candidate.scoreBreakdown.teamIdentityScore >= 0) {
    return true;
  }
  return candidate.scoreBreakdown.mercenaryNegativeFitPenalty < 0;
}

function isSeason1MinimumDepthAcceptable(team: Team, candidate: AiNeedsPicksCandidateScore) {
  if (candidate.focusTeamStatus === "blocked") {
    return false;
  }
  const breakdown = candidate.scoreBreakdown;
  const protectedTeam = isIdentityProtectedSeason1Team(team);
  const relativeFitLegal = isRelativeMarketFitLegal(candidate);
  const usefulNeedSignal =
    breakdown.needMatchScore >= 2 ||
    breakdown.disciplineCoverageScore >= 2 ||
    breakdown.formColorCoverageScore >= 2 ||
    breakdown.rosterBalanceScore >= 2 ||
    candidate.strategicException;
  if (breakdown.teamIdentityScore < 0 && !relativeFitLegal) {
    return false;
  }
  if (protectedTeam && breakdown.teamIdentityScore < -3 && !usefulNeedSignal && !relativeFitLegal) {
    return false;
  }
  if (breakdown.offThemePenalty <= -10 && !usefulNeedSignal) {
    return false;
  }
  return candidate.finalScore > -35;
}

function getSeason1OptimumDepthPressureBonus(input: {
  candidate: AiNeedsPicksCandidateScore;
  targetSlotsBefore: number;
  mustContinueTowardOptimum: boolean;
}) {
  if (!input.mustContinueTowardOptimum || input.candidate.focusTeamStatus === "blocked") {
    return 0;
  }
  const breakdown = input.candidate.scoreBreakdown;
  if (!isRelativeMarketFitLegal(input.candidate)) {
    return 0;
  }
  const usefulNeedSignal =
    breakdown.needMatchScore >= 2 ||
    breakdown.disciplineCoverageScore >= 2 ||
    breakdown.formColorCoverageScore >= 2 ||
    breakdown.rosterBalanceScore >= 2 ||
    input.candidate.strategicException;
  if (!usefulNeedSignal && breakdown.teamIdentityScore < -2) {
    return 0;
  }
  const pressure = Math.max(0, input.targetSlotsBefore - 2);
  const cheapDepthBoost = input.candidate.price != null ? clamp((32 - input.candidate.price) / 4, 0, 8) : 3;
  const fitPenaltySoftener = Math.max(0, Math.min(6, breakdown.teamIdentityScore < 0 ? Math.abs(breakdown.teamIdentityScore) * 0.6 : 0));
  return roundValue(8 + pressure * 4 + cheapDepthBoost + fitPenaltySoftener, 2);
}

function isWithinSeason1SpendCorridor(input: {
  candidate: AiNeedsPicksCandidateScore;
  cashStrategy: AiNeedsPicksCashStrategy;
  remainingCash: number | null;
  targetSlotsBefore?: number;
}) {
  const startingCash = input.cashStrategy.startingCash;
  const maxPct = input.cashStrategy.season1SpendMaxPct;
  const price = input.candidate.price;
  if (startingCash == null || startingCash <= 0 || maxPct == null || input.remainingCash == null || price == null) {
    return true;
  }
  const projectedSpendPct = clamp((startingCash - (input.remainingCash - price)) / startingCash, 0, 1);
  const targetCompletionTolerance =
    input.targetSlotsBefore != null && input.targetSlotsBefore > 2
      ? input.cashStrategy.season1SpendArchetype === "leaders_then_fill"
        ? 0.03
        : input.cashStrategy.season1SpendArchetype === "cautious_or_value"
          ? 0.035
          : input.cashStrategy.season1SpendArchetype === "normal"
            ? 0.025
            : input.cashStrategy.season1SpendArchetype === "cash_poor_pragmatic"
              ? 0.02
              : input.cashStrategy.season1SpendArchetype === "value_buffer"
                ? 0.015
                : 0
      : 0;
  const tolerance =
    input.cashStrategy.season1SpendArchetype === "aggressive_top"
      ? 0.006
      : input.cashStrategy.season1SpendArchetype === "cash_poor_pragmatic"
        ? 0.004
        : 0.002;
  return projectedSpendPct <= maxPct + Math.max(tolerance, targetCompletionTolerance);
}

function canRelaxSeason1SpendCorridorForTarget(input: {
  candidate: AiNeedsPicksCandidateScore;
  cashStrategy: AiNeedsPicksCashStrategy;
  remainingCash: number | null;
  targetSlotsBefore: number;
}) {
  const startingCash = input.cashStrategy.startingCash;
  const maxPct = input.cashStrategy.season1SpendMaxPct;
  const price = input.candidate.price;
  if (input.targetSlotsBefore <= 1 || startingCash == null || startingCash <= 0 || maxPct == null || input.remainingCash == null || price == null) {
    return false;
  }
  const strongReason = getPostMinimumStrongReason(input.candidate);
  if (input.targetSlotsBefore <= 2 && strongReason == null) {
    return false;
  }
  const projectedSpendPct = clamp((startingCash - (input.remainingCash - price)) / startingCash, 0, 1);
  const targetPressureTolerance =
    input.cashStrategy.season1SpendArchetype === "aggressive_top"
      ? 0.06
      : input.cashStrategy.season1SpendArchetype === "leaders_then_fill"
        ? 0.05
        : input.cashStrategy.season1SpendArchetype === "normal"
          ? 0.04
          : input.cashStrategy.season1SpendArchetype === "cash_poor_pragmatic"
            ? 0.035
            : input.cashStrategy.season1SpendArchetype === "cautious_or_value"
              ? 0.03
              : input.cashStrategy.season1SpendArchetype === "value_buffer"
                ? 0.025
                : 0.03;
  return projectedSpendPct <= maxPct + targetPressureTolerance;
}

function getSeason1ProjectedSpendPct(input: {
  candidate: AiNeedsPicksCandidateScore;
  cashStrategy: AiNeedsPicksCashStrategy;
  remainingCash: number | null;
}) {
  const startingCash = input.cashStrategy.startingCash;
  const price = input.candidate.price;
  if (startingCash == null || startingCash <= 0 || input.remainingCash == null || price == null) {
    return null;
  }
  return roundValue(clamp((startingCash - (input.remainingCash - price)) / startingCash, 0, 1) * 100, 1);
}

function getSeason1MinimumTargetAwareCandidates(input: {
  candidates: AiNeedsPicksCandidateScore[];
  cashStrategy: AiNeedsPicksCashStrategy;
  remainingCash: number | null;
  simulatedRosterCount: number | null;
  targetRosterSize: number | null;
  minimumSlotsBefore: number;
}) {
  const startingCash = input.cashStrategy.startingCash;
  const maxPct = input.cashStrategy.season1SpendMaxPct;
  if (
    input.minimumSlotsBefore <= 0 ||
    startingCash == null ||
    startingCash <= 0 ||
    maxPct == null ||
    input.remainingCash == null ||
    input.candidates.length === 0
  ) {
    return input.candidates;
  }
  const spendSoFar = Math.max(startingCash - input.remainingCash, 0);
  const maxTotalSpend = startingCash * maxPct;
  const remainingSpendToMax = Math.max(maxTotalSpend - spendSoFar, 0);
  const remainingTargetSlots =
    input.targetRosterSize != null && input.simulatedRosterCount != null
      ? Math.max(input.targetRosterSize - input.simulatedRosterCount, input.minimumSlotsBefore, 1)
      : Math.max(input.minimumSlotsBefore, 1);
  const targetAwareSlotBudget = remainingSpendToMax / remainingTargetSlots;
  const archetype = input.cashStrategy.season1SpendArchetype;
  const priceMultiplier =
    archetype === "aggressive_top"
      ? 2.35
      : archetype === "cash_poor_pragmatic"
        ? 1.75
        : archetype === "value_buffer"
          ? 1.38
          : archetype === "cautious_or_value"
            ? 1.48
            : 1.7;
  const hardPriceLimit = Math.max(targetAwareSlotBudget * priceMultiplier, 8);
  const strategicPriceLimit = Math.max(targetAwareSlotBudget * (priceMultiplier + 0.38), hardPriceLimit + 5);
  const filtered = input.candidates.filter((candidate) => {
    if (candidate.price == null) {
      return false;
    }
    if (candidate.price <= hardPriceLimit + 0.01) {
      return true;
    }
    const strongReason = getPostMinimumStrongReason(candidate);
    if (
      strongReason &&
      candidate.price <= strategicPriceLimit + 0.01 &&
      candidate.scoreBreakdown.teamIdentityScore >= 1 &&
      candidate.scoreBreakdown.offThemePenalty > -6
    ) {
      return true;
    }
    return false;
  });
  return filtered.length > 0 ? filtered : input.candidates;
}

function scoreV4FocusTeamFit(input: {
  team: Team;
  player: Player;
  candidateAxis: "pow" | "spe" | "men" | "soc" | null;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  budgetLane: AiNeedsPicksBudgetLane;
  price: number | null;
  laneCap: number | null;
  needMatchScore: number;
  teamIdentityScore: number;
  strategicException: boolean;
}): {
  fitScore: number;
  status: "ok" | "warning" | "blocked";
  reason: string | null;
  metrics: Record<string, number>;
  reasons: string[];
} {
  const profile = getV4FocusTeamProfile(input.team);
  if (!profile) {
    return { fitScore: 0, status: "ok", reason: null, metrics: {}, reasons: [] };
  }

  const hardRuleFailure = getHardFocusRuleFailure(profile.code, input.player);
  if (hardRuleFailure) {
    return {
      fitScore: -18,
      status: "blocked",
      reason: hardRuleFailure,
      metrics: Object.fromEntries(profile.namedMetricKeys.map((key) => [key, -10])),
      reasons: ["Harte Team-Identity-Regel blockiert diesen Pick."],
    };
  }

  const candidateTokens = buildPlayerThemeTokens(input.player);
  const tokenPool = [input.player.race, ...candidateTokens];
  const majorHits = countSemanticMatches(profile.primaryTokens, tokenPool);
  const minorHits = countSemanticMatches(profile.secondaryTokens, tokenPool);
  const avoidHits = countSemanticMatches(profile.avoidTokens, tokenPool);
  const axisHit = input.candidateAxis != null && profile.preferredAxes.includes(input.candidateAxis) ? 1 : 0;
  const earlyPhase =
    input.pickPhase === "minimum_skeleton" ||
    input.pickPhase === "early_core" ||
    input.pickPhase === "identity_core" ||
    input.pickPhase === "specialist_fill";
  const lanePremium =
    input.budgetLane.lane === "star" || input.budgetLane.lane === "superstar" || input.budgetLane.lane === "core";
  const capPressure =
    input.price != null && input.laneCap != null && input.price > input.laneCap + 0.01 ? 1 : 0;
  const fitScore = roundValue(
    clamp(
      majorHits * 4 +
        minorHits * 1.75 +
        axisHit * 2.5 +
        (lanePremium && input.teamIdentityScore >= 6 ? 1.5 : 0) +
        (input.needMatchScore >= input.budgetLane.minNeedScore + 1 ? 1 : 0) -
        avoidHits * 5 -
        (earlyPhase && majorHits === 0 && axisHit === 0 ? 3.5 : 0) -
        (capPressure && earlyPhase ? 2.5 : 0),
      -14,
      14,
    ),
    1,
  );

  const metrics: Record<string, number> = {};
  const namedValues =
    profile.code === "M-M"
      ? {
          aggroFit: roundValue(majorHits * 2 + axisHit * 2 + (lanePremium ? 2 : 0), 1),
          eliteFit: roundValue((input.teamIdentityScore >= 6 ? 3 : 0) + (lanePremium ? 2 : 0) + minorHits, 1),
          championFit: roundValue((lanePremium ? 2 : 0) + (input.needMatchScore >= 4 ? 2 : 0) + majorHits, 1),
        }
      : profile.code === "C-C"
        ? {
            luxuryBusinessShowFit: roundValue(majorHits * 2 + minorHits + axisHit, 1),
            valueMoneyballFit: roundValue((input.needMatchScore >= 4 ? 2 : 0) + (input.price != null && input.laneCap != null && input.price <= input.laneCap ? 2 : 0) + minorHits, 1),
          }
        : profile.code === "N-N"
          ? {
              ninjaFit: roundValue(majorHits * 2 + axisHit * 2 - avoidHits * 2, 1),
              precisionFit: roundValue(minorHits + axisHit * 2 + (input.needMatchScore >= 4 ? 1.5 : 0), 1),
            }
          : profile.code === "G-G"
            ? {
                orderFit: roundValue(majorHits * 2 + minorHits - avoidHits * 2, 1),
                holyWarriorFit: roundValue(majorHits * 2 + (lanePremium ? 1.5 : 0), 1),
              }
            : profile.code === "C-S"
              ? {
                  precisionSteelFit: roundValue(majorHits * 2 + axisHit * 2, 1),
                  duelistFit: roundValue(majorHits * 1.5 + minorHits + (input.needMatchScore >= 4 ? 1 : 0), 1),
                }
              : profile.code === "A-A"
                ? {
                    survivalFit: roundValue(majorHits * 2 + axisHit * 1.5, 1),
                    aftermathFit: roundValue(majorHits + minorHits + (lanePremium ? 1 : 0) - avoidHits * 2, 1),
                  }
                : profile.code === "N-W"
                  ? {
                      natureFit: roundValue(majorHits * 2 + minorHits * 1.5 - avoidHits * 2, 1),
                      balanceFit: roundValue(axisHit * 2 + minorHits, 1),
                    }
                  : profile.code === "W-W"
                    ? {
                        arcaneFit: roundValue(majorHits * 2 + minorHits, 1),
                        mentalFit: roundValue(axisHit * 2 + (input.needMatchScore >= 4 ? 1.5 : 0), 1),
                      }
                    : profile.code === "T-T"
                      ? {
                          academyFit: roundValue(majorHits * 2 + minorHits, 1),
                          leaderFit: roundValue(axisHit * 1.5 + (lanePremium ? 1 : 0), 1),
                        }
                      : {};
  Object.assign(metrics, namedValues);

  let status: "ok" | "warning" | "blocked" = "ok";
  let reason: string | null = null;
  if (earlyPhase && fitScore <= -4 && !input.strategicException) {
    status = "warning";
    reason = "focus_team_early_phase_off_theme";
  } else if (fitScore <= 1) {
    status = "warning";
    reason = capPressure && profile.code === "N-N" ? "early_phase_cap_exceeded" : "focus_team_soft_warning";
  }

  const reasons: string[] = [];
  if (majorHits > 0) reasons.push("Fokus-Team-Identity trifft Kernprofil.");
  if (minorHits > 0 && majorHits === 0) reasons.push("Fokus-Team-Identity trifft Nebenprofil.");
  if (axisHit > 0) reasons.push("Spieler passt zu den priorisierten Teamachsen.");
  if (avoidHits > 0) reasons.push("Spieler wirkt fuer das Fokus-Team off-theme.");
  if (status === "warning" && reason === "early_phase_cap_exceeded") reasons.push("Fruehphase prueft dieses Team besonders streng gegen teure Ausreisser.");
  if (status === "warning" && reason === "focus_team_early_phase_off_theme") reasons.push("Fruehphase markiert off-theme Picks, laesst sie aber fuer harte Kader-Needs im Pool.");

  return { fitScore, status, reason, metrics, reasons };
}

function hasBetterFocusAlternative(input: {
  entries: Array<{ candidate: AiNeedsPicksCandidateScore; eligibility: CandidateIdentityEligibility }>;
  current: AiNeedsPicksCandidateScore;
}) {
  return input.entries.some((entry) => {
    if (entry.candidate.playerId === input.current.playerId) {
      return false;
    }
    if (entry.eligibility.status !== "eligible") {
      return false;
    }
    const currentPrice = input.current.price;
    const alternativePrice = entry.candidate.price;
    const similarBand =
      currentPrice == null ||
      alternativePrice == null ||
      alternativePrice <= currentPrice * 1.15 ||
      (input.current.effectiveLanePriceCap != null &&
        alternativePrice <= input.current.effectiveLanePriceCap + 0.01);
    if (!similarBand) {
      return false;
    }
    return (
      (entry.candidate.focusTeamFitScore ?? 0) >= (input.current.focusTeamFitScore ?? 0) + 2 &&
      entry.candidate.finalScore >= input.current.finalScore - 8
    );
  });
}

function buildFocusTeamDiagnostics(input: {
  team: Team;
  candidatePoolTop: AiNeedsPicksCandidateScore[];
  plannedPicks: AiNeedsPicksPlannedPick[];
}) {
  const profile = getV4FocusTeamProfile(input.team);
  if (!profile) {
    return undefined;
  }

  const firstConcern =
    input.plannedPicks.find((pick) => pick.focusTeamStatus === "blocked" || pick.focusTeamStatus === "warning") ?? null;
  const betterCandidateExamples = input.candidatePoolTop
    .filter(
      (candidate) =>
        candidate.playerId !== firstConcern?.playerId &&
        (candidate.focusTeamStatus ?? "ok") === "ok" &&
        (firstConcern?.price == null || candidate.price == null || candidate.price <= firstConcern.price * 1.15),
    )
    .slice(0, 3)
    .map((candidate) => candidate.playerName);

  const diagnostics: NonNullable<AiNeedsPicksCompareTeamEntry["focusTeamDiagnostics"]> = {
    status:
      input.plannedPicks.some((pick) => pick.focusTeamStatus === "blocked")
        ? "blocked"
        : input.plannedPicks.some((pick) => pick.focusTeamStatus === "warning")
          ? "warning"
          : "ok",
    primaryIssue: firstConcern?.focusTeamReason ?? null,
    badPickExample: firstConcern?.playerName ?? null,
    pickPhase: firstConcern?.pickPhase ?? null,
    currentReason: firstConcern?.reasons[0] ?? null,
    betterCandidateExamples,
    recommendedFix:
      firstConcern == null
        ? null
        : betterCandidateExamples.length > 0
          ? "Fruehphase staerker auf on-theme Alternativen im selben Kostenband ziehen."
          : "Strategische Ausnahme nur halten, wenn Need oder Value den Off-Theme-Fall wirklich traegt.",
  };

  if (profile.code === "C-C") {
    diagnostics.cCFirstSeven = input.plannedPicks.slice(0, 7).map((pick) => ({
      playerName: pick.playerName,
      price: pick.price,
      lane: pick.pickLane,
      valueScore: pick.scoreBreakdown.valueScore,
      luxuryBusinessShowFit: pick.focusTeamMetrics?.luxuryBusinessShowFit ?? pick.focusTeamFitScore ?? null,
      betterAlternatives: input.candidatePoolTop
        .filter(
          (candidate) =>
            candidate.playerId !== pick.playerId &&
            (candidate.focusTeamMetrics?.luxuryBusinessShowFit ?? candidate.focusTeamFitScore ?? 0) >
              (pick.focusTeamMetrics?.luxuryBusinessShowFit ?? pick.focusTeamFitScore ?? 0) + 1 &&
            (pick.price == null || candidate.price == null || candidate.price <= pick.price * 1.15),
        )
        .slice(0, 2)
        .map((candidate) => candidate.playerName),
    }));
  }

  if (profile.code === "M-M") {
    diagnostics.mMEliteCore = input.plannedPicks
      .filter((pick) => pick.pickLane === "core" || pick.pickLane === "star_pick" || pick.pickLane === "superstar_pick")
      .slice(0, 7)
      .map((pick) => ({
        playerName: pick.playerName,
        lane: pick.pickLane,
        aggroFit: pick.focusTeamMetrics?.aggroFit ?? pick.focusTeamFitScore ?? null,
        eliteFit: pick.focusTeamMetrics?.eliteFit ?? pick.focusTeamFitScore ?? null,
        championFit: pick.focusTeamMetrics?.championFit ?? pick.focusTeamFitScore ?? null,
        offTheme: (pick.focusTeamStatus ?? "ok") !== "ok",
        betterAlternatives: input.candidatePoolTop
          .filter(
            (candidate) =>
              candidate.playerId !== pick.playerId &&
              (candidate.focusTeamMetrics?.championFit ?? candidate.focusTeamFitScore ?? 0) >
                (pick.focusTeamMetrics?.championFit ?? pick.focusTeamFitScore ?? 0) + 1 &&
              (pick.price == null || candidate.price == null || candidate.price <= pick.price * 1.15),
          )
          .slice(0, 2)
          .map((candidate) => candidate.playerName),
      }));
  }

  if (profile.code === "N-N") {
    const capPick = input.plannedPicks.find((pick) => pick.focusTeamReason === "early_phase_cap_exceeded") ?? null;
    diagnostics.nNCapDiagnosis = capPick
      ? {
          status:
            capPick.focusTeamStatus === "blocked"
              ? betterCandidateExamples.length > 0
                ? "better_alternative_available"
                : "phase_cap_correct"
              : capPick.strategicException
                ? "identity_exception_allowed"
                : "phase_cap_too_strict",
          playerName: capPick.playerName,
          reason: capPick.focusTeamReason ?? capPick.capOverrideReason ?? null,
        }
      : null;
  }

  return diagnostics;
}

function normalizeGameState(gameState: GameState) {
  return withNormalizedTeamStrategyProfiles(withNormalizedTeamControlSettings(gameState));
}

function normalizeTeamCode(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function getBudgetStatus(team: Team) {
  if (!Number.isFinite(team.cash) || !Number.isFinite(team.budget) || team.budget <= 0) {
    return "unknown" as const;
  }

  const ratio = team.cash / team.budget;
  if (ratio <= 0.18) return "critical" as const;
  if (ratio <= 0.4) return "tight" as const;
  return "healthy" as const;
}

function getRosterEntriesForTeam(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId);
}

const playerLookupByGameState = new WeakMap<GameState, Map<string, Player>>();

function getPlayerById(gameState: GameState, playerId: string) {
  let lookup = playerLookupByGameState.get(gameState) ?? null;
  if (!lookup) {
    lookup = new Map(gameState.players.map((entry) => [entry.id, entry]));
    playerLookupByGameState.set(gameState, lookup);
  }
  return lookup.get(playerId) ?? null;
}

function getPlayerAxis(player: Player): "pow" | "spe" | "men" | "soc" | null {
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

function getPlayerPrimaryDiscipline(player: Player) {
  const top = Object.entries(player.disciplineRatings ?? {})
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0))[0];
  return top ? { disciplineId: top[0], score: Number(top[1] ?? 0) } : null;
}

function getPlayerSportsQuality(player: Player, candidateAxis: "pow" | "spe" | "men" | "soc" | null) {
  const coreValues = Object.values(player.coreStats ?? {}).filter((value): value is number => Number.isFinite(value));
  const disciplineValues = Object.values(player.disciplineRatings ?? {}).filter((value): value is number => Number.isFinite(value));
  const axisValue = candidateAxis != null ? player.coreStats[candidateAxis] ?? null : null;
  const topDiscipline = disciplineValues.length > 0 ? Math.max(...disciplineValues) : null;
  const topCore = coreValues.length > 0 ? Math.max(...coreValues) : null;
  const coreAverage = coreValues.length > 0 ? coreValues.reduce((sum, value) => sum + value, 0) / coreValues.length : null;
  const quality = Math.max(axisValue ?? 0, topDiscipline ?? 0, topCore ?? 0, coreAverage ?? 0);
  return {
    quality: roundValue(quality, 1),
    topDiscipline: topDiscipline ?? 0,
    topCore: topCore ?? 0,
    strongDisciplineCount: disciplineValues.filter((value) => value >= 60).length,
    eliteDisciplineCount: disciplineValues.filter((value) => value >= 80).length,
  };
}

function getPlayerRoleTag(player: Player, candidateAxis: "pow" | "spe" | "men" | "soc" | null): "superstar" | "star" | "core" | "depth" | "specialist" | "backup" {
  const sportsQuality = getPlayerSportsQuality(player, candidateAxis);
  if (sportsQuality.topDiscipline >= 90 && sportsQuality.topCore >= 76) return "superstar";
  if (sportsQuality.topDiscipline >= 82 || sportsQuality.topCore >= 76) return "star";
  if (candidateAxis && sportsQuality.strongDisciplineCount >= 3) return "specialist";
  if (sportsQuality.quality >= 64 || sportsQuality.strongDisciplineCount >= 2) return "core";
  if (sportsQuality.quality >= 48) return "depth";
  return "backup";
}

function buildRosterComposition(gameState: GameState, teamId: string) {
  const rosterEntries = getRosterEntriesForTeam(gameState, teamId);
  const rosterPlayers = rosterEntries
    .map((entry) => getPlayerById(gameState, entry.playerId))
    .filter((player): player is Player => player != null);

  const axisCounts = { pow: 0, spe: 0, men: 0, soc: 0 };
  const classCounts = new Map<string, number>();
  const raceCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const disciplinePeak = new Map<string, number>();

  for (const player of rosterPlayers) {
    const axis = getPlayerAxis(player);
    if (axis) {
      axisCounts[axis] += 1;
    }
    const normalizedClass = normalizeToken(player.className);
    const normalizedRace = normalizeToken(player.race);
    if (normalizedClass) {
      classCounts.set(normalizedClass, (classCounts.get(normalizedClass) ?? 0) + 1);
    }
    if (normalizedRace) {
      raceCounts.set(normalizedRace, (raceCounts.get(normalizedRace) ?? 0) + 1);
    }
    const roleTag = getPlayerRoleTag(player, axis);
    roleCounts.set(roleTag, (roleCounts.get(roleTag) ?? 0) + 1);
    for (const [disciplineId, rawScore] of Object.entries(player.disciplineRatings ?? {})) {
      const score = Number(rawScore ?? 0);
      const current = disciplinePeak.get(disciplineId) ?? 0;
      if (score > current) {
        disciplinePeak.set(disciplineId, score);
      }
    }
  }

  return {
    rosterPlayers,
    axisCounts,
    classCounts,
    raceCounts,
    roleCounts,
    disciplinePeak,
  };
}

function axisToFormColor(axis: "pow" | "spe" | "men" | "soc" | null): FormCardColor | null {
  if (axis === "pow") return "red";
  if (axis === "spe") return "green";
  if (axis === "men") return "blue";
  if (axis === "soc") return "yellow";
  return null;
}

function uniqueFormColors(values: Array<FormCardColor | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is FormCardColor => value != null)));
}

function buildFormColorCounts(input: {
  rosterPlayers: Player[];
  classCounts?: Map<string, number>;
}) {
  const counts: Record<FormCardColor, number> = {
    red: 0,
    green: 0,
    blue: 0,
    yellow: 0,
  };

  for (const player of input.rosterPlayers) {
    const color = getPlayerClassColor(player);
    if (color) {
      counts[color] += 1;
    }
  }

  if (input.classCounts && input.rosterPlayers.length === 0) {
    for (const [classToken, count] of input.classCounts.entries()) {
      const color = CLASS_COLOR_BY_CLASS[classToken];
      if (!color) {
        continue;
      }
      counts[color] += count;
    }
  }

  return counts;
}

function getFullFreeAgentPoolSize(gameState: GameState) {
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  return gameState.players.filter((player) => !rosterPlayerIds.has(player.id)).length;
}

function addFormColorCount(
  counts: Record<FormCardColor, number>,
  color: FormCardColor | null | undefined,
) {
  const next = { ...counts };
  if (color) {
    next[color] += 1;
  }
  return next;
}

function hasFormColorDoubleBoostPotential(input: {
  color: FormCardColor | null;
  seasonStrategy: AiNeedsPicksSeasonStrategy;
}) {
  if (!input.color) return false;
  return (
    input.seasonStrategy.formCardColorPlan.primaryFormColors.includes(input.color) ||
    input.seasonStrategy.formCardColorPlan.missingFormColors.includes(input.color)
  );
}

function getSortedAxisPlan(input: {
  profile: TeamStrategyProfile | null;
  identity: ReturnType<typeof getTeamIdentityRow>;
  openNeeds: AiNeedsPicksOpenNeed[];
}) {
  const axisWeights = deriveTeamIdentityAxisWeightMap(input.identity);
  const needWeight = {
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  };
  for (const entry of input.openNeeds) {
    if (entry.axis === "pow" || entry.axis === "spe" || entry.axis === "men" || entry.axis === "soc") {
      needWeight[entry.axis] += entry.importance * 8;
    }
  }

  const profileBias = {
    pow: input.profile?.powBias ?? 0,
    spe: input.profile?.speBias ?? 0,
    men: input.profile?.menBias ?? 0,
    soc: input.profile?.socBias ?? 0,
  };

  return (Object.keys(axisWeights) as Array<"pow" | "spe" | "men" | "soc">)
    .map((axis) => ({
      axis,
      weight: axisWeights[axis] * 10 + needWeight[axis] + profileBias[axis] * 0.08,
    }))
    .sort((left, right) => right.weight - left.weight);
}

function buildTeamSeasonStrategy(input: {
  gameState: GameState;
  team: Team;
  profile: TeamStrategyProfile | null;
  identity: ReturnType<typeof getTeamIdentityRow>;
  rosterComposition: ReturnType<typeof buildRosterComposition>;
  openNeeds: AiNeedsPicksOpenNeed[];
  planner: AiNeedsPicksPlanner;
  cashStrategy: AiNeedsPicksCashStrategy;
  targetRosterSize: number | null;
  playerMin: number;
  topNeedDisciplineIds: string[];
}) {
  const sortedAxes = getSortedAxisPlan({
    profile: input.profile,
    identity: input.identity,
    openNeeds: input.openNeeds,
  });
  const primaryAxisPlan = sortedAxes[0]?.axis ?? null;
  const secondaryAxisPlan = sortedAxes[1]?.axis ?? null;
  const rosterPlayers = input.rosterComposition.rosterPlayers;
  const currentColorCounts = buildFormColorCounts({ rosterPlayers });
  const desiredColors = uniqueFormColors([
    ...(input.profile?.preferredClasses ?? []).map((entry) => CLASS_COLOR_BY_CLASS[normalizeToken(entry)] ?? null),
    axisToFormColor(primaryAxisPlan),
    axisToFormColor(secondaryAxisPlan),
  ]);
  const existingFormColors = (Object.entries(currentColorCounts) as Array<[FormCardColor, number]>)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([color]) => color);
  const primaryFormColors = desiredColors.slice(0, 2);
  const secondaryFormColors = desiredColors.slice(2, 4);
  const missingFormColors = desiredColors.filter((color) => currentColorCounts[color] <= 0);
  const desiredCoveredCount = desiredColors.filter((color) => currentColorCounts[color] > 0).length;
  const formColorCoverageScore =
    desiredColors.length > 0 ? roundValue(clamp(desiredCoveredCount / desiredColors.length, 0, 1), 2) : 0;
  const presentColorCount = existingFormColors.length;
  const formColorFlexScore = roundValue(clamp(presentColorCount / 3, 0, 1), 2);
  const expectedWeaknesses = input.openNeeds
    .filter((entry) => entry.importance >= 0.2)
    .slice(0, 4)
    .map((entry) => entry.label);
  const neededSlotTypes = unique([
    ...input.openNeeds
      .filter((entry) => ["star", "core", "depth", "specialist", "backup"].includes(entry.axis))
      .map((entry) => entry.axis),
    ...missingFormColors.map((color) => `form_${color}`),
  ]);

  const starCoreSlots = input.planner.superstarAllowed + input.planner.starAllowed + input.planner.coreNeeded;
  const rosterLaneTarget = Math.max(input.targetRosterSize ?? input.playerMin, input.playerMin);
  const starCoreCoverage = roundValue(
    clamp(
      ((input.rosterComposition.roleCounts.get("superstar") ?? 0) +
        (input.rosterComposition.roleCounts.get("star") ?? 0) +
        (input.rosterComposition.roleCounts.get("core") ?? 0)) /
        Math.max(starCoreSlots || 1, 1),
      0,
      1,
    ),
    2,
  );
  const depthCoverage = roundValue(
    clamp(
      ((input.rosterComposition.roleCounts.get("depth") ?? 0) + (input.rosterComposition.roleCounts.get("backup") ?? 0)) /
        Math.max(input.planner.depthNeeded + input.planner.backupNeeded || 1, 1),
      0,
      1,
    ),
    2,
  );
  const specialistCoverage = roundValue(
    clamp(
      (input.rosterComposition.roleCounts.get("specialist") ?? 0) / Math.max(input.planner.specialistNeeded || 1, 1),
      0,
      1,
    ),
    2,
  );
  const primaryAxisCoverage = roundValue(
    clamp(primaryAxisPlan ? (input.rosterComposition.axisCounts[primaryAxisPlan] ?? 0) / 3 : 0, 0, 1),
    2,
  );
  const secondaryAxisCoverage = roundValue(
    clamp(secondaryAxisPlan ? (input.rosterComposition.axisCounts[secondaryAxisPlan] ?? 0) / 2 : 0, 0, 1),
    2,
  );
  const disciplineCoverage = roundValue(
    clamp(
      input.topNeedDisciplineIds.length > 0
        ? input.topNeedDisciplineIds.filter((disciplineId) => (input.rosterComposition.disciplinePeak.get(disciplineId) ?? 0) >= 72).length /
            input.topNeedDisciplineIds.length
        : 0.5,
      0,
      1,
    ),
    2,
  );
  const rosterLaneCoverage = roundValue(
    clamp(rosterPlayers.length / Math.max(rosterLaneTarget, 1), 0, 1),
    2,
  );
  const coreThemeCoverage = roundValue(
    clamp((primaryAxisCoverage * 0.45) + (secondaryAxisCoverage * 0.2) + (formColorCoverageScore * 0.2) + (starCoreCoverage * 0.15), 0, 1),
    2,
  );

  return {
    seasonStrategy: {
      primaryAxisPlan,
      secondaryAxisPlan,
      disciplineFocus: input.topNeedDisciplineIds.slice(0, 4),
      rosterTarget: input.targetRosterSize,
      minimumRoster: input.playerMin,
      optimumRoster: input.targetRosterSize,
      starCoreDepthFillArchitecture: {
        star: input.planner.superstarAllowed + input.planner.starAllowed,
        core: input.planner.coreNeeded,
        specialist: input.planner.specialistNeeded,
        depth: input.planner.depthNeeded,
        fill: input.planner.cheapFillNeeded,
        backup: input.planner.backupNeeded,
      },
      expectedWeaknesses,
      neededSlotTypes,
      formCardColorPlan: {
        primaryFormColors,
        secondaryFormColors,
        existingFormColors,
        missingFormColors,
        desiredClassColor: primaryFormColors[0] ?? null,
        formColorCoverageScore,
        formColorFlexScore,
      },
      financePosture: input.cashStrategy.financePosture,
      spendArchitecture: input.cashStrategy.spendArchitecture.reason,
      savingsBias: input.cashStrategy.savingsBias,
      attackPressure: input.cashStrategy.attackPressure,
      seasonRiskTolerance: roundValue(normalizeManagementValue(input.profile?.bias.riskTolerance) * 10, 1),
    } satisfies AiNeedsPicksSeasonStrategy,
    coverage: {
      coreThemeCoverage,
      primaryAxisCoverage,
      secondaryAxisCoverage,
      disciplineCoverage,
      formColorCoverage: formColorCoverageScore,
      rosterLaneCoverage,
      starCoreCoverage,
      depthCoverage,
      specialistCoverage,
    } satisfies AiNeedsPicksCoverage,
  };
}

function getStrategyMatchScore(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile) {
    return { score: 0, reasons: ["Kein Teamprofil geladen."] };
  }

  const reasons: string[] = [];
  let score = 0;
  const normalizedClass = normalizeToken(player.className);
  const normalizedRace = normalizeToken(player.race);
  const classTokens = [
    normalizedClass,
    normalizeToken(player.referenceClass),
    ...player.subclasses.map((entry) => normalizeToken(entry)),
  ].filter((entry) => entry.length > 0);
  const traitTokens = [...player.traitsPositive, ...player.traitsNegative].map((entry) => normalizeToken(entry));
  const candidateThemeTokens = [...classTokens, normalizedRace, ...traitTokens];
  const preferredClassMatch = hasSemanticMatch(profile.preferredClasses, candidateThemeTokens);
  const preferredRaceMatch = profile.preferredRaces.some((entry) => normalizeToken(entry) === normalizedRace);
  const avoidedClassMatch = hasSemanticMatch(profile.avoidedClasses, candidateThemeTokens);
  const avoidedRaceMatch = profile.avoidedRaces.some((entry) => normalizeToken(entry) === normalizedRace);
  const dislikedClassMatch = hasSemanticMatch(profile.dislikedClasses ?? [], candidateThemeTokens);
  const dislikedRaceMatch = (profile.dislikedRaces ?? []).some((entry) => normalizeToken(entry) === normalizedRace);
  const preferredArchetypeHits = (profile.preferredArchetypes ?? []).filter((entry) => {
    const token = normalizeToken(entry);
    return token.length > 0 && [...classTokens, normalizedRace, ...traitTokens].some((candidate) => candidate.includes(token) || token.includes(candidate));
  }).length;
  const avoidedArchetypeHits = (profile.avoidedArchetypes ?? []).filter((entry) => {
    const token = normalizeToken(entry);
    return token.length > 0 && [...classTokens, normalizedRace, ...traitTokens].some((candidate) => candidate.includes(token) || token.includes(candidate));
  }).length;
  const preferredTraitHits = (profile.preferredTraits ?? []).filter((entry) => traitTokens.includes(normalizeToken(entry))).length;
  const avoidedTraitHits = (profile.dislikedTraits ?? []).filter((entry) => traitTokens.includes(normalizeToken(entry))).length;
  const hardNoGoHits = (profile.hardNoGos ?? []).filter((entry) => {
    const token = normalizeToken(entry);
    return token.length > 0 && [...classTokens, normalizedRace, ...traitTokens].some((candidate) => candidate.includes(token) || token.includes(candidate));
  }).length;

  if (preferredClassMatch) {
    score += 1.3;
    reasons.push("bevorzugte Klasse");
  } else if (profile.preferredClasses.length > 0) {
    score -= 2.1;
    reasons.push("keine bevorzugte Klasse");
  }
  if (preferredRaceMatch) {
    score += 1;
    reasons.push("bevorzugte Rasse");
  } else if (profile.preferredRaces.length > 0) {
    score -= 0.8;
    reasons.push("keine bevorzugte Rasse");
  }
  if (preferredArchetypeHits > 0) {
    score += preferredArchetypeHits * 0.6;
    reasons.push(`Archetyp-Fit ${preferredArchetypeHits}`);
  } else if ((profile.preferredArchetypes?.length ?? 0) > 0) {
    score -= 1.4;
    reasons.push("kein bevorzugter Archetyp");
  }
  if (preferredTraitHits > 0) {
    score += preferredTraitHits * 0.35;
    reasons.push(`positive Traits ${preferredTraitHits}`);
  }
  if (avoidedClassMatch) {
    score -= 1.2;
    reasons.push("vermeidete Klasse");
  }
  if (avoidedRaceMatch) {
    score -= 1;
    reasons.push("vermeidete Rasse");
  }
  if (dislikedClassMatch) {
    score -= 0.8;
    reasons.push("unerwuenschte Klasse");
  }
  if (dislikedRaceMatch) {
    score -= 0.8;
    reasons.push("unerwuenschte Rasse");
  }
  if (avoidedArchetypeHits > 0) {
    score -= avoidedArchetypeHits * 0.6;
    reasons.push(`unerwuenschter Archetyp ${avoidedArchetypeHits}`);
  }
  if (avoidedTraitHits > 0) {
    score -= avoidedTraitHits * 0.35;
    reasons.push(`kritische Traits ${avoidedTraitHits}`);
  }
  if (hardNoGoHits > 0) {
    score -= hardNoGoHits * 1.8;
    reasons.push(`Hard-No-Go ${hardNoGoHits}`);
  }

  return {
    score,
    reasons: reasons.length > 0 ? reasons : ["Profil neutral."],
  };
}

function scoreTeamIdentityComponents(input: {
  gameState: GameState;
  team: Team;
  profile: TeamStrategyProfile | null;
  player: Player;
  candidateAxis: "pow" | "spe" | "men" | "soc" | null;
  playerRole: "superstar" | "star" | "core" | "depth" | "specialist" | "backup";
  strategyFitResult: ReturnType<typeof getStrategyMatchScore>;
  openNeeds: AiNeedsPicksOpenNeed[];
  budgetLane: AiNeedsPicksBudgetLane;
}) {
  const identity = getTeamIdentityRow(input.gameState, input.team.teamId);
  const override = getRetoolIdentityOverride(input.team);
  const axisWeights = deriveTeamIdentityAxisWeightMap(identity);
  const candidateTokens = buildPlayerThemeTokens(input.player);
  const harmonyFactor = normalizeManagementValue(identity?.harmony);
  const financesFactor = normalizeManagementValue(identity?.finances);
  const ambitionFactor = normalizeManagementValue(identity?.ambition);
  const preferredClassHits = countSemanticMatches(input.profile?.preferredClasses ?? [], candidateTokens);
  const avoidedClassHits = countSemanticMatches(input.profile?.avoidedClasses ?? [], candidateTokens);
  const dislikedClassHits = countSemanticMatches(input.profile?.dislikedClasses ?? [], candidateTokens);
  const preferredRaceHits = countSemanticMatches(input.profile?.preferredRaces ?? [], [input.player.race, ...candidateTokens]);
  const avoidedRaceHits = countSemanticMatches(input.profile?.avoidedRaces ?? [], [input.player.race, ...candidateTokens]);
  const dislikedRaceHits = countSemanticMatches(input.profile?.dislikedRaces ?? [], [input.player.race, ...candidateTokens]);
  const preferredArchetypeHits = countSemanticMatches(input.profile?.preferredArchetypes ?? [], candidateTokens);
  const avoidedArchetypeHits = countSemanticMatches(input.profile?.avoidedArchetypes ?? [], candidateTokens);
  const dislikedArchetypeHits = countSemanticMatches(input.profile?.dislikedArchetypes ?? [], candidateTokens);
  const overrideTraitPreferences = override && "traitPreferences" in override ? override.traitPreferences : undefined;
  const overrideRequiredTraits =
    overrideTraitPreferences && "requiredPrimary" in overrideTraitPreferences ? [...overrideTraitPreferences.requiredPrimary] : [];
  const overridePreferredTraits =
    overrideTraitPreferences && "preferred" in overrideTraitPreferences ? [...overrideTraitPreferences.preferred] : [];
  const requiredTraitHits = countSemanticMatches(overrideRequiredTraits, candidateTokens);
  const preferredOverrideTraitHits = countSemanticMatches(overridePreferredTraits, candidateTokens);
  const explicitThemeTokens = [
    ...(input.profile?.preferredArchetypes ?? []),
    ...(input.profile?.secondaryArchetypes ?? []),
    ...tokenizeThemeText(input.profile?.fantasyTheme),
    ...tokenizeThemeText(input.profile?.loreTheme),
    ...tokenizeThemeText(override?.archetype),
  ];
  const themeHits = countSemanticMatches(explicitThemeTokens, candidateTokens);
  const needsThisAxis = input.openNeeds.some((entry) => entry.axis === input.candidateAxis);
  const candidateAxisStrength =
    input.candidateAxis != null ? clamp((input.player.coreStats[input.candidateAxis] ?? 0) / 100, 0, 1) : 0.4;
  const axisWeight =
    input.candidateAxis != null ? axisWeights[input.candidateAxis] : Math.max(axisWeights.pow, axisWeights.spe, axisWeights.men, axisWeights.soc) || 0.25;

  const teamAxisFitScore = roundValue(
    clamp(axisWeight * 10 + candidateAxisStrength * 5 + (needsThisAxis ? 2.5 : 0) - 3, -6, 12),
    1,
  );
  const teamThemeFitScore = roundValue(
    clamp(
      themeHits * 2.2 +
        preferredOverrideTraitHits * 1.5 +
        (requiredTraitHits > 0 ? 2.4 : 0) -
        ((explicitThemeTokens.length > 0 && themeHits === 0) ? 3.5 : 0),
      -8,
      10,
    ),
    1,
  );
  const classFitScore = roundValue(
    clamp(
      preferredClassHits * 4.8 -
        avoidedClassHits * 4.4 -
        dislikedClassHits * 3.2 -
        ((input.profile?.preferredClasses.length ?? 0) > 0 && preferredClassHits === 0 ? 4.2 : 0),
      -12,
      12,
    ),
    1,
  );
  const raceOrArchetypeFitScore = roundValue(
    clamp(
      preferredRaceHits * 2.6 +
        preferredArchetypeHits * 3.2 +
        requiredTraitHits * 2 -
        avoidedRaceHits * 3.1 -
        dislikedRaceHits * 2.4 -
        avoidedArchetypeHits * 3.4 -
        dislikedArchetypeHits * 2.1,
      -12,
      12,
    ),
    1,
  );

  const negativeSignals =
    avoidedClassHits +
    dislikedClassHits +
    avoidedRaceHits +
    dislikedRaceHits +
    avoidedArchetypeHits +
    dislikedArchetypeHits +
    (((input.profile?.preferredClasses.length ?? 0) > 0 && preferredClassHits === 0) ? 1 : 0) +
    (((input.profile?.preferredArchetypes.length ?? 0) > 0 && preferredArchetypeHits === 0) ? 1 : 0) +
    (overrideRequiredTraits.length > 0 && requiredTraitHits === 0 ? 2 : 0);

  const harmonyPenalty = roundValue(-clamp(negativeSignals * (1 + harmonyFactor * 1.8), 0, 14), 1);

  const ambitionLaneBias = roundValue(
    clamp(
      input.budgetLane.lane === "star" || input.budgetLane.lane === "superstar"
        ? (ambitionFactor - 0.5) * 8
        : input.budgetLane.lane === "cheap_fill" || input.budgetLane.lane === "backup"
          ? (0.55 - ambitionFactor) * 4
          : 0,
      -4,
      4,
    ),
    1,
  );
  const financeLaneBias = roundValue(
    clamp(
      input.budgetLane.lane === "cheap_fill" || input.budgetLane.lane === "depth" || input.budgetLane.lane === "backup"
        ? (financesFactor - 0.5) * 6
        : input.budgetLane.lane === "star" || input.budgetLane.lane === "superstar"
          ? (0.45 - financesFactor) * 5
          : (financesFactor - 0.5) * 2,
      -4,
      4,
    ),
    1,
  );

  const teamIdentityScore = roundValue(
    teamAxisFitScore + teamThemeFitScore + classFitScore + raceOrArchetypeFitScore + harmonyPenalty,
    1,
  );

  const reasons = [...input.strategyFitResult.reasons];
  if (teamAxisFitScore >= 6) reasons.push("passt zu den Teamachsen");
  if (teamThemeFitScore >= 4) reasons.push("passt deutlich zum Teamthema");
  if (classFitScore >= 4) reasons.push("starker Klassenfit");
  if (raceOrArchetypeFitScore >= 4) reasons.push("Rasse/Archetyp trifft Teamprofil");
  if (harmonyPenalty <= -5) reasons.push("Harmony straft den Pick spuerbar ab");

  return {
    teamAxisFitScore,
    teamThemeFitScore,
    classFitScore,
    raceOrArchetypeFitScore,
    harmonyPenalty,
    ambitionLaneBias,
    financeLaneBias,
    teamIdentityScore,
    reasons: Array.from(new Set(reasons)),
  };
}

type CandidateIdentityEligibility = {
  status: "eligible" | "warning" | "risky_but_allowed" | "blocked_technical";
  reason: string | null;
};

function evaluateIdentityEligibility(input: {
  team: Team;
  profile: TeamStrategyProfile | null;
  player: Player | null;
  candidate: AiNeedsPicksCandidateScore;
  scoreBreakdown: AiNeedsPicksCandidateScore["scoreBreakdown"];
}) : CandidateIdentityEligibility {
  if (!input.player) {
    return { status: "eligible", reason: null };
  }

  if (input.candidate.focusTeamStatus === "blocked") {
    return { status: "blocked_technical", reason: input.candidate.focusTeamReason ?? "focus_team_early_phase_off_theme" };
  }

  const profile = input.profile;
  const override = getRetoolIdentityOverride(input.team);
  const candidateTokens = buildPlayerThemeTokens(input.player);
  const raceAwareTokens = [input.player.race, ...candidateTokens];
  const preferredSignals = [
    ...(profile?.preferredClasses ?? []),
    ...(profile?.preferredArchetypes ?? []),
    ...(profile?.secondaryArchetypes ?? []),
    ...(profile?.preferredRaces ?? []),
    ...tokenizeThemeText(profile?.fantasyTheme),
    ...tokenizeThemeText(profile?.loreTheme),
    ...tokenizeThemeText(override?.archetype),
    ...((override &&
      "traitPreferences" in override &&
      override.traitPreferences &&
      "requiredPrimary" in override.traitPreferences &&
      override.traitPreferences.requiredPrimary)
      ? [...override.traitPreferences.requiredPrimary]
      : []),
    ...((override &&
      "traitPreferences" in override &&
      override.traitPreferences &&
      "preferred" in override.traitPreferences &&
      override.traitPreferences.preferred)
      ? [...override.traitPreferences.preferred]
      : []),
  ].filter((entry) => String(entry ?? "").trim().length > 0);
  const positiveSignalCount = countSemanticMatches(preferredSignals, raceAwareTokens);
  const hardNoGoHits = countSemanticMatches(profile?.hardNoGos ?? [], raceAwareTokens);
  const strictIdentityTeam =
    isStrictIdentityFocusTeam(input.team) ||
    preferredSignals.length > 0 ||
    (profile?.hardNoGos.length ?? 0) > 0;
  const semanticClassPreference = hasSemanticMatch(
    [...(profile?.preferredClasses ?? []), ...(profile?.preferredArchetypes ?? []), ...(profile?.secondaryArchetypes ?? [])],
    candidateTokens,
  );
  const normalizedClass = normalizeToken(input.player.className);
  const isBruiserClass = normalizedClass === "berserker" || normalizedClass === "warlord";
  const obviousOffTheme =
    input.scoreBreakdown.offThemePenalty <= -4 ||
    input.scoreBreakdown.teamIdentityScore < 0 ||
    input.scoreBreakdown.classFitScore <= -4 ||
    input.scoreBreakdown.teamThemeFitScore <= -4 ||
    input.scoreBreakdown.raceOrArchetypeFitScore <= -4;
  if (!strictIdentityTeam) {
    return { status: "eligible", reason: null };
  }

  const visibleIdentitySignals = [
    input.scoreBreakdown.teamIdentityScore >= 6,
    input.scoreBreakdown.classFitScore >= 4,
    input.scoreBreakdown.teamThemeFitScore >= 3,
    input.scoreBreakdown.raceOrArchetypeFitScore >= 3,
    positiveSignalCount > 0,
  ].filter(Boolean).length;

  if (input.candidate.focusTeamStatus === "warning") {
    return {
      status: obviousOffTheme ? "risky_but_allowed" : "warning",
      reason: input.candidate.focusTeamReason ?? "focus_team_soft_warning",
    };
  }

  if (positiveSignalCount === 0 && visibleIdentitySignals === 0 && obviousOffTheme) {
    return {
      status: hardNoGoHits > 0 ? "risky_but_allowed" : "warning",
      reason: hardNoGoHits > 0 ? "identity_strategic_exception_despite_no_go_signal" : "identity_must_feel_right",
    };
  }

  if (isBruiserClass && !semanticClassPreference && obviousOffTheme && input.scoreBreakdown.teamIdentityScore < 6) {
    return { status: "risky_but_allowed", reason: "off_theme_bruiser_or_warlord" };
  }

  if (hardNoGoHits > 0) {
    return { status: "risky_but_allowed", reason: "identity_soft_no_go_signal" };
  }

  return { status: "eligible", reason: null };
}

function filterIdentityEligibleCandidates(input: {
  gameState: GameState;
  team: Team;
  profile: TeamStrategyProfile | null;
  candidates: AiNeedsPicksCandidateScore[];
  preserveMinimumPool?: boolean;
}) {
  const evaluated = input.candidates.map((candidate) => ({
      candidate,
      eligibility: evaluateIdentityEligibility({
        team: input.team,
        profile: input.profile,
        player: getPlayerById(input.gameState, candidate.playerId),
        candidate,
        scoreBreakdown: candidate.scoreBreakdown,
      }),
  }));
  const statusPriority: Record<CandidateIdentityEligibility["status"], number> = {
    eligible: 3,
    warning: 2,
    risky_but_allowed: 1,
    blocked_technical: 0,
  };
  const ordered = [...evaluated]
    .sort((left, right) => {
      const priorityDelta = statusPriority[right.eligibility.status] - statusPriority[left.eligibility.status];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return right.candidate.finalScore - left.candidate.finalScore;
    })
    .filter((entry) => entry.eligibility.status !== "blocked_technical")
    .filter((entry) => {
      if (!isStrictIdentityFocusTeam(input.team)) {
        return true;
      }
      const earlyPhase =
        entry.candidate.pickPhase === "minimum_skeleton" ||
        entry.candidate.pickPhase === "early_core" ||
        entry.candidate.pickPhase === "identity_core" ||
        entry.candidate.pickPhase === "specialist_fill";
      if (!earlyPhase) {
        return true;
      }
      if (entry.eligibility.status === "eligible") {
        return true;
      }
      if (input.preserveMinimumPool) {
        return true;
      }
      return !hasBetterFocusAlternative({
        entries: evaluated,
        current: entry.candidate,
      });
    });

  return {
    candidates: ordered.map((entry) => entry.candidate),
    usedFallback: ordered.some((entry) => entry.eligibility.status !== "eligible"),
    fallbackReason: ordered.find((entry) => entry.eligibility.status !== "eligible")?.eligibility.reason ?? null,
    blockedCount: evaluated.filter((entry) => entry.eligibility.status === "blocked_technical").length,
  };
}

function shouldPreferMinimumSkeletonAlternative(input: {
  top: AiNeedsPicksCandidateScore;
  alternative: AiNeedsPicksCandidateScore;
  plannedLane: string;
  minimumSlotsBefore: number;
}) {
  if (input.minimumSlotsBefore <= 0) {
    return false;
  }
  if (input.alternative.playerId === input.top.playerId) {
    return false;
  }
  if (input.top.price == null || input.alternative.price == null) {
    return false;
  }
  const normalizedLane = normalizeToken(input.plannedLane);
  const topIsPremium = ["star", "superstar"].includes(normalizedLane) || input.top.price >= 30;
  const alternativeIsSkeletonFriendly =
    input.alternative.price <= input.top.price * 0.78 &&
    input.alternative.finalScore >= input.top.finalScore - 6 &&
    input.alternative.scoreBreakdown.teamIdentityScore >= Math.max(input.top.scoreBreakdown.teamIdentityScore - 4, 1.5) &&
    input.alternative.scoreBreakdown.needMatchScore >= Math.max(input.top.scoreBreakdown.needMatchScore - 3, 1.5);

  if (normalizedLane === "cheap_fill") {
    return alternativeIsSkeletonFriendly;
  }

  return topIsPremium && alternativeIsSkeletonFriendly;
}

function getBestNeedDisciplineId(player: Player, needDisciplineIds: string[]) {
  if (needDisciplineIds.length === 0) {
    return null;
  }

  const ranked = needDisciplineIds
    .map((disciplineId) => ({
      disciplineId,
      value: player.disciplineRatings[disciplineId] ?? 0,
    }))
    .sort((left, right) => right.value - left.value);
  return ranked[0]?.disciplineId ?? null;
}

function buildOpenNeeds(input: {
  rosterGap: number;
  baseAxisDeficits: Record<"pow" | "spe" | "men" | "soc", number>;
  coveredAxisHits: Record<"pow" | "spe" | "men" | "soc", number>;
  roleCounts: Map<string, number>;
  disciplinePeak: Map<string, number>;
  topNeedDisciplineIds: string[];
}) {
  const rows: AiNeedsPicksOpenNeed[] = [];

  if (input.rosterGap > 0) {
    rows.push({
      axis: "roster",
      label: "Kader auffuellen",
      importance: clamp(input.rosterGap / 3, 0, 1),
      reason: "Team liegt noch unter seinem Zielkader.",
      sourceStatus: "mapped",
    });
  }

  const starCount = (input.roleCounts.get("star") ?? 0) + (input.roleCounts.get("superstar") ?? 0);
  const coreCount = input.roleCounts.get("core") ?? 0;
  const depthCount = input.roleCounts.get("depth") ?? 0;
  const specialistCount = input.roleCounts.get("specialist") ?? 0;
  const backupCount = input.roleCounts.get("backup") ?? 0;

  if (starCount === 0) {
    rows.push({
      axis: "star",
      label: "Star-Bedarf",
      importance: 0.72,
      reason: "Dem Team fehlt ein klarer Star-Anker.",
      sourceStatus: "mapped",
    });
  }
  if (coreCount < 3) {
    rows.push({
      axis: "core",
      label: "Core-Bedarf",
      importance: clamp((3 - coreCount) * 0.22, 0, 0.66),
      reason: "Der Kern ist noch zu duenn fuer einen stabilen Saisonbau.",
      sourceStatus: "mapped",
    });
  }
  if (depthCount + backupCount < 3 && input.rosterGap > 0) {
    rows.push({
      axis: "depth",
      label: "Depth-Bedarf",
      importance: clamp((3 - (depthCount + backupCount)) * 0.18 + input.rosterGap * 0.06, 0, 0.62),
      reason: "Rotations- und Fallback-Slots fehlen noch.",
      sourceStatus: "mapped",
    });
  }
  if (specialistCount < 2 && input.topNeedDisciplineIds.length > 0) {
    rows.push({
      axis: "specialist",
      label: "Specialist-Bedarf",
      importance: clamp((2 - specialistCount) * 0.18, 0, 0.44),
      reason: "Mindestens eine Diszi-Luecke braucht einen klaren Specialist.",
      sourceStatus: "mapped",
    });
  }
  if (backupCount === 0 && input.rosterGap > 1) {
    rows.push({
      axis: "backup",
      label: "Backup-Bedarf",
      importance: 0.26,
      reason: "Es fehlt ein guenstiger Backup fuer spaetere Slots.",
      sourceStatus: "mapped",
    });
  }

  (Object.entries(input.baseAxisDeficits) as Array<["pow" | "spe" | "men" | "soc", number]>).forEach(([axis, baseValue]) => {
    const reducedValue = clamp(baseValue - input.coveredAxisHits[axis] * 0.28, 0, 1);
    if (reducedValue <= 0.04) {
      return;
    }

    rows.push({
      axis,
      label: `${axis.toUpperCase()}-Bedarf`,
      importance: roundValue(reducedValue, 3),
      reason:
        input.coveredAxisHits[axis] > 0
          ? `${axis.toUpperCase()} wurde schon teilweise adressiert, bleibt aber offen.`
          : `${axis.toUpperCase()} ist eine offene Teamachse.`,
      sourceStatus: "mapped",
    });
  });

  for (const disciplineId of input.topNeedDisciplineIds) {
    const peak = input.disciplinePeak.get(disciplineId) ?? 0;
    if (peak >= 75) {
      continue;
    }
    rows.push({
      axis: "specialist",
      label: `Diszi-Luecke ${disciplineId}`,
      importance: clamp((75 - peak) / 100, 0.08, 0.42),
      reason: `Die aktuelle Diszi-Spitze in ${disciplineId} ist noch zu flach.`,
      sourceStatus: "mapped",
    });
  }

  return rows.sort((left, right) => right.importance - left.importance);
}

function countLaneTargets(slotPlan: AiNeedsPickLane[]) {
  const counts: Record<AiNeedsPickLane, number> = {
    superstar: 0,
    star: 0,
    core: 0,
    specialist: 0,
    depth: 0,
    cheap_fill: 0,
    backup: 0,
  };
  for (const lane of slotPlan) {
    counts[lane] += 1;
  }
  return counts;
}

function roleTierScore(lane: AiNeedsPickLane) {
  switch (lane) {
    case "superstar":
      return 6;
    case "star":
      return 5;
    case "core":
      return 4;
    case "specialist":
      return 3;
    case "depth":
      return 2;
    case "cheap_fill":
      return 1;
    case "backup":
      return 0;
  }
}

function downgradeLane(lane: AiNeedsPickLane): AiNeedsPickLane {
  switch (lane) {
    case "superstar":
      return "star";
    case "star":
      return "core";
    case "core":
      return "depth";
    case "specialist":
      return "depth";
    case "depth":
      return "backup";
    case "cheap_fill":
      return "backup";
    case "backup":
      return "backup";
  }
}

function buildSlotPlan(input: {
  steps: number;
  missingToMin: number;
  targetSlotsMissing: number;
  coreNeeded: number;
  specialistNeeded: number;
  depthNeeded: number;
  cheapFillNeeded: number;
  backupNeeded: number;
  starAllowed: number;
  superstarAllowed: number;
  premiumCap?: number;
  season1OptimumMode?: boolean;
}) {
  const slotPlan: AiNeedsPickLane[] = [];
  const pushMany = (lane: AiNeedsPickLane, count: number) => {
    while (count > 0 && slotPlan.length < input.steps) {
      slotPlan.push(lane);
      count -= 1;
    }
  };

  if (input.season1OptimumMode) {
    const plannedSlots = Math.max(input.targetSlotsMissing, input.missingToMin);
    const premiumSlots = Math.min(
      input.superstarAllowed + input.starAllowed,
      Math.max(plannedSlots - 7, 0),
      Math.max(input.premiumCap ?? 2, 0),
    );
    if (input.superstarAllowed > 0 && premiumSlots > 0) {
      pushMany("superstar", 1);
    }
    if (input.starAllowed > 0 && slotPlan.filter((lane) => lane === "superstar" || lane === "star").length < premiumSlots) {
      pushMany("star", premiumSlots - slotPlan.filter((lane) => lane === "superstar" || lane === "star").length);
    }
    pushMany("core", input.coreNeeded);
    pushMany("specialist", input.specialistNeeded);
    pushMany("depth", input.depthNeeded);
    pushMany("backup", input.backupNeeded);
    pushMany("cheap_fill", input.cheapFillNeeded);
    while (slotPlan.length < input.steps && slotPlan.length < plannedSlots) {
      slotPlan.push(slotPlan.length < input.missingToMin ? "depth" : "backup");
    }
    return slotPlan.slice(0, input.steps);
  }

  if (input.superstarAllowed > 0 && input.missingToMin === 0 && input.coreNeeded === 0) {
    pushMany("superstar", input.superstarAllowed);
  }
  if (input.starAllowed > 0 && input.missingToMin === 0 && input.coreNeeded === 0) {
    pushMany("star", Math.min(1, input.starAllowed));
  }
  pushMany("core", input.coreNeeded);
  pushMany("specialist", input.specialistNeeded);
  if (input.missingToMin > 0) {
    pushMany("cheap_fill", input.cheapFillNeeded);
  }
  pushMany("depth", input.depthNeeded);
  pushMany("backup", input.backupNeeded);
  if (input.starAllowed > 0 && slotPlan.length < input.steps) {
    pushMany("star", input.starAllowed);
  }
  while (slotPlan.length < input.steps) {
    slotPlan.push(input.missingToMin > 0 ? "cheap_fill" : "depth");
  }
  return slotPlan.slice(0, input.steps);
}

function stableDraftHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function draftUnit(seed: string) {
  return (stableDraftHash(seed) % 10000) / 9999;
}

function draftCentered(seed: string) {
  return draftUnit(seed) * 2 - 1;
}

function getDraftVarianceConfig(teamCode: string) {
  const normalized = normalizeTeamCode(teamCode);
  if (["M-M", "H-R", "R-R", "V-V"].includes(normalized)) {
    return { laneBias: 0.075, maxJitter: 3.2, nearTieBand: 4.5 };
  }
  if (["W-W", "P-C", "T-G", "V-D", "D-P", "C-S", "L-K"].includes(normalized)) {
    return { laneBias: 0.045, maxJitter: 1.6, nearTieBand: 3.2 };
  }
  return { laneBias: 0.06, maxJitter: 2.2, nearTieBand: 3.8 };
}

function applyDraftSeedLaneVariation(input: {
  slotPlan: AiNeedsPickLane[];
  draftSeed: string | null;
  teamCode: string;
  missingToMin: number;
}) {
  if (!input.draftSeed || input.slotPlan.length < 3) {
    return input.slotPlan;
  }
  const varied = [...input.slotPlan];
  const safeStart = Math.max(1, Math.min(input.missingToMin, varied.length - 2));
  for (let index = safeStart; index < varied.length - 1; index += 1) {
    const current = varied[index];
    const next = varied[index + 1];
    if (current === next) {
      continue;
    }
    const currentPremium = current === "superstar" || current === "star";
    const nextPremium = next === "superstar" || next === "star";
    if ((currentPremium || nextPremium) && index < safeStart + 2) {
      continue;
    }
    if (draftUnit(`${input.draftSeed}:${input.teamCode}:lane-swap:${index}`) > 0.63) {
      varied[index] = next;
      varied[index + 1] = current;
      index += 1;
    }
  }
  return varied;
}

function applyDraftSeedCandidateVariation(input: {
  candidates: AiNeedsPicksCandidateScore[];
  draftSeed: string | null;
  teamCode: string;
  stepIndex: number;
}) {
  if (!input.draftSeed || input.candidates.length <= 1) {
    return input.candidates.sort((left, right) => right.finalScore - left.finalScore);
  }
  const config = getDraftVarianceConfig(input.teamCode);
  const bestBaseScore = Math.max(...input.candidates.map((candidate) => candidate.finalScore));
  return input.candidates
    .map((candidate) => {
      const baseScore = candidate.baseScore ?? candidate.finalScore;
      const inBand = bestBaseScore - candidate.finalScore <= config.nearTieBand;
      const hardBlocked = candidate.focusTeamStatus === "blocked" || candidate.capExceeded;
      if (!inBand || hardBlocked) {
        return {
          ...candidate,
          draftSeed: input.draftSeed,
          baseScore,
          tieBreakJitter: 0,
          scoreWithSeed: candidate.finalScore,
          tieBreakBand: inBand ? `near_tie_${config.nearTieBand}` : null,
        };
      }
      const jitter = roundValue(
        draftCentered(`${input.draftSeed}:${input.teamCode}:${input.stepIndex}:${candidate.playerId}`) * config.maxJitter,
        2,
      );
      const scoreWithSeed = roundValue(candidate.finalScore + jitter, 2);
      return {
        ...candidate,
        draftSeed: input.draftSeed,
        baseScore,
        tieBreakJitter: jitter,
        scoreWithSeed,
        tieBreakBand: `near_tie_${config.nearTieBand}`,
        finalScore: scoreWithSeed,
        reasons: jitter !== 0 ? [...candidate.reasons, `draft_seed_near_tie:${jitter}`] : candidate.reasons,
      };
    })
    .sort((left, right) => right.finalScore - left.finalScore);
}

function buildPickPlanner(input: {
  gameState: GameState;
  team: Team;
  rosterCount: number;
  targetRosterSize: number | null;
  playerMin: number;
  roleCounts: Map<string, number>;
  openNeeds: AiNeedsPicksOpenNeed[];
  compareCandidates: AiTransferPreviewRecommendation[];
  steps: number;
  runMode?: AiNeedsPicksRunMode | null;
  draftSeed?: string | null;
}): AiNeedsPicksPlanner {
  const identity = getTeamIdentityRow(input.gameState, input.team.teamId);
  const teamCode = normalizeTeamCode(input.team.shortCode || input.team.teamId);
  const season1OptimumMode = input.runMode === "season1_optimum_execute";
  const cash = input.team.cash;
  const rosterGap = input.targetRosterSize != null ? Math.max(input.targetRosterSize - input.rosterCount, 0) : 0;
  const missingToMin = Math.max(input.playerMin - input.rosterCount, 0);
  const lanePhilosophy = getSeason1LanePhilosophy(input.team);
  const draftSeed = input.draftSeed?.trim() || null;
  const variance = getDraftVarianceConfig(teamCode);
  const seededLaneBias = (key: string) => (draftSeed ? draftCentered(`${draftSeed}:${teamCode}:planner:${key}`) * variance.laneBias : 0);
  const coreBias = clamp(lanePhilosophy.coreBias + seededLaneBias("core"), 0.18, 0.45);
  const specialistBias = clamp(lanePhilosophy.specialistBias + seededLaneBias("specialist"), 0.04, 0.25);
  const depthBias = clamp(lanePhilosophy.depthBias + seededLaneBias("depth"), 0.18, 0.48);
  const backupBias = clamp(lanePhilosophy.backupBias + seededLaneBias("backup"), 0.04, 0.32);
  const existingStars = (input.roleCounts.get("star") ?? 0) + (input.roleCounts.get("superstar") ?? 0);
  const existingCores = input.roleCounts.get("core") ?? 0;
  const existingDepth = (input.roleCounts.get("depth") ?? 0) + (input.roleCounts.get("backup") ?? 0);
  const ambition = normalizeManagementValue(identity?.ambition ?? ((input.team.budget ?? 0) > 0 ? 55 : 50));
  const finances = normalizeManagementValue(identity?.finances ?? 55);
  const harmony = normalizeManagementValue(identity?.harmony ?? 50);
  const boardPressure = 1 - normalizeManagementValue(identity?.boardConfidence ?? 50);
  const anchors = buildLaneMarketAnchors(input.compareCandidates);
  const minimumReserve = getMinimumReserve({
    candidates: input.compareCandidates,
    missingSlots: missingToMin,
    anchors,
  });

  const q25 = anchors.q25Price > 0 ? anchors.q25Price : anchors.q50Price > 0 ? anchors.q50Price * 0.75 : 14;
  const canAffordPremiumSkeleton =
    Number.isFinite(cash) &&
    cash > 0 &&
    rosterGap > 0 &&
    cash >= anchors.q90Price + Math.max(rosterGap - 1, 0) * q25;
  const season1PremiumTeam =
    ["M-M", "H-R", "R-R", "V-V"].includes(teamCode) ||
    (ambition >= 0.72 && finances <= 0.68) ||
    teamCode === "T-T";

  const superstarAllowed =
    season1OptimumMode
      ? canAffordPremiumSkeleton &&
        existingStars === 0 &&
        rosterGap >= 8 &&
        (teamCode === "T-T" || (season1PremiumTeam && ambition >= 0.68)) &&
        cash >= anchors.q95Price + Math.max(rosterGap - 1, 0) * q25
        ? 1
        : 0
      : Number.isFinite(cash) &&
          cash > 0 &&
          rosterGap <= 1 &&
          missingToMin === 0 &&
          existingStars === 0 &&
          ambition >= 0.72 &&
          finances <= 0.58
        ? 1
        : 0;
  const limitedSuperstarAllowed = season1OptimumMode ? Math.min(superstarAllowed, lanePhilosophy.superstarCap) : superstarAllowed;

  const starAllowanceRaw =
    season1OptimumMode
      ? (canAffordPremiumSkeleton ? 1 : 0) +
        (season1PremiumTeam ? 1 : 0) +
        (boardPressure >= 0.52 ? 1 : 0) +
        (rosterGap >= 10 ? 1 : 0) -
        (finances >= 0.8 && teamCode !== "T-T" ? 1 : 0)
      : (ambition >= 0.64 ? 1 : 0) +
        (boardPressure >= 0.52 ? 1 : 0) +
        (rosterGap <= 1 ? 1 : 0) -
        (missingToMin > 0 ? 1 : 0) -
        (finances >= 0.76 ? 1 : 0);
  const starAllowedBase = clamp(starAllowanceRaw, 0, season1OptimumMode ? (teamCode === "T-T" ? 3 : 2) : 2);
  const starAllowed = season1OptimumMode
    ? Math.min(starAllowedBase, Math.max(lanePhilosophy.premiumCap - limitedSuperstarAllowed, 0))
    : starAllowedBase;
  const specialistNeeded = input.openNeeds.some((entry) => entry.axis === "specialist") ? 1 : 0;
  const premiumPlanned = season1OptimumMode
    ? Math.min(
        limitedSuperstarAllowed + starAllowed,
        Math.max(rosterGap - 7, 0),
        teamCode === "T-T" ? 3 : lanePhilosophy.premiumCap,
      )
    : 0;
  const remainingSlotsAfterPremium = Math.max(rosterGap - premiumPlanned, 0);
  const coreNeeded = season1OptimumMode
    ? Math.min(
        Math.max(existingCores === 0 ? 2 : 1, Math.ceil(remainingSlotsAfterPremium * coreBias)),
        remainingSlotsAfterPremium,
      )
    : Math.max(existingCores === 0 ? 1 : 0, rosterGap > 0 ? 1 : 0);
  const specialistSlots = season1OptimumMode
    ? Math.min(
        Math.max(specialistNeeded, Math.ceil(remainingSlotsAfterPremium * specialistBias)),
        Math.max(rosterGap - premiumPlanned - coreNeeded, 0),
      )
    : specialistNeeded;
  const cheapFillNeeded = season1OptimumMode ? 0 : clamp(missingToMin - Math.min(coreNeeded, missingToMin), 0, input.steps);
  const remainingAfterPremiumCore =
    season1OptimumMode
      ? Math.max(rosterGap - premiumPlanned - coreNeeded - specialistSlots, 0)
      : Math.max(rosterGap - coreNeeded - cheapFillNeeded, 0);
  const depthNeeded = season1OptimumMode
    ? Math.min(Math.max(Math.ceil(remainingSlotsAfterPremium * depthBias), 1), remainingAfterPremiumCore)
    : Math.min(
        Math.max(existingDepth < 2 ? 2 - existingDepth : 0, remainingAfterPremiumCore > 0 ? 1 : 0),
        Math.max(remainingAfterPremiumCore, 0),
      );
  const backupNeeded = season1OptimumMode
    ? Math.max(
        Math.max(Math.ceil(remainingSlotsAfterPremium * backupBias), 0),
        rosterGap - premiumPlanned - coreNeeded - specialistSlots - depthNeeded,
      )
    : Math.max(Math.min(rosterGap - coreNeeded - cheapFillNeeded - depthNeeded - specialistSlots, 1), 0);

  const slotPlan = applyDraftSeedLaneVariation({
    slotPlan: buildSlotPlan({
    steps: input.steps,
    missingToMin,
    targetSlotsMissing: rosterGap,
    coreNeeded,
    specialistNeeded: specialistSlots,
    depthNeeded,
    cheapFillNeeded,
    backupNeeded,
    starAllowed,
    superstarAllowed: limitedSuperstarAllowed,
    premiumCap: lanePhilosophy.premiumCap,
    season1OptimumMode,
    }),
    draftSeed,
    teamCode,
    missingToMin,
  });

  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  if (!minimumReserve.reachable) {
    blockingReasons.push(minimumReserve.missingReason ?? "minimum_unreachable_no_legal_candidates");
  } else if (cash != null && minimumReserve.reservedCash != null && cash < minimumReserve.reservedCash) {
    blockingReasons.push("minimum_unreachable_no_cash");
  }
  if (!season1OptimumMode && (limitedSuperstarAllowed > 0 || starAllowed > 0) && (coreNeeded > 0 || depthNeeded > 0 || missingToMin > 0)) {
    warnings.push("High-End-Lanes bleiben gedeckelt, solange Core/Depth oder Mindestkader noch offen sind.");
  }
  if (draftSeed) {
    warnings.push(`draft_seed_planner_variation:${draftSeed}`);
  }
  const firstHighEndIndex = slotPlan.findIndex((lane) => lane === "superstar" || lane === "star");
  if (firstHighEndIndex >= 0) {
    const lanesBeforeHighEnd = slotPlan.slice(0, firstHighEndIndex);
    const rosterAddsBeforeHighEnd = lanesBeforeHighEnd.filter((lane) => lane !== "superstar" && lane !== "star").length;
    if (!season1OptimumMode && missingToMin > 0 && rosterAddsBeforeHighEnd < missingToMin) {
      blockingReasons.push("lane_plan_star_before_minimum_roster");
    }
    if (!season1OptimumMode && coreNeeded > 0 && existingCores === 0 && !lanesBeforeHighEnd.includes("core")) {
      blockingReasons.push("lane_plan_star_before_core");
    }
  }
  if (limitedSuperstarAllowed > 0 && (!Number.isFinite(cash) || cash < Math.max(anchors.q95Price, anchors.q90Price))) {
    blockingReasons.push("lane_plan_superstar_without_budget_headroom");
  }
  if (starAllowed >= 2 && harmony >= 0.75) {
    warnings.push("Hohe Harmony drueckt eigentlich auf Value/Core. Doppel-Star bleibt nur Vorschlag, kein Automatismus.");
  }
  if (minimumReserve.usedExpensiveFallback) {
    warnings.push("Minimum-Reserve fand nicht genug echte Cheap-Fill-Kandidaten. Es bleiben nur teurere Mindestkader-Optionen.");
  }

  return {
    plannerSource: "retool_reference",
    slotPlan,
    superstarAllowed: limitedSuperstarAllowed,
    starAllowed,
    minimumSlotsMissing: missingToMin,
    optimumSlotsMissing: rosterGap,
    coreNeeded,
    specialistNeeded,
    depthNeeded,
    cheapFillNeeded,
    backupNeeded,
    reservedCashForMinimum: minimumReserve.reservedCash,
    minimumCandidateFloorPrice: minimumReserve.floorPrice,
    minimumReachable:
      minimumReserve.reachable && (cash == null || minimumReserve.reservedCash == null ? true : cash >= minimumReserve.reservedCash),
    laneGatePassed: blockingReasons.length === 0,
    blockingReasons,
    warnings: [
      ...warnings,
      anchors.q75Price > 0
        ? `Lane-Preisspannen werden am lokalen Kandidatenpool ausgerichtet (Q75 ${roundValue(anchors.q75Price, 2)} / Q90 ${roundValue(anchors.q90Price, 2)} / Q95 ${roundValue(anchors.q95Price, 2)}).`
        : "Kein belastbarer Preisanker fuer Q75/Q90/Q95.",
    ],
  };
}

function buildCashStrategy(input: {
  team: Team;
  identity: ReturnType<typeof getTeamIdentityRow>;
  profile: TeamStrategyProfile | null;
  planner: AiNeedsPicksPlanner;
  anchors: LaneMarketAnchors;
  rosterCount: number;
  targetRosterSize: number | null;
  playerMin: number;
  expectedPrizeSignal: ComparePrizeSignal;
  runMode?: AiNeedsPicksRunMode | null;
}) : AiNeedsPicksCashStrategy {
  const financeConfig = RETOOL_AI_PACKAGE_SCORING_CONFIG.financePosture;
  const currentCash = Number.isFinite(input.team.cash) ? input.team.cash : null;
  const startingCash = Number.isFinite(input.team.budget) && input.team.budget > 0 ? input.team.budget : currentCash;
  const missingMinimumSlots = Math.max(input.playerMin - input.rosterCount, 0);
  const missingTargetSlots = input.targetRosterSize != null ? Math.max(input.targetRosterSize - input.rosterCount, 0) : 0;
  const expectedMinimumSlotCost =
    input.planner.minimumCandidateFloorPrice && input.planner.minimumCandidateFloorPrice > 0
      ? input.planner.minimumCandidateFloorPrice
      : input.anchors.q50Price > 0
        ? roundValue(input.anchors.q50Price, 2)
        : null;
  const financesValue = normalizeManagementValue(input.identity?.finances ?? 55);
  const ambitionValue = normalizeManagementValue(input.identity?.ambition ?? 50);
  const harmonyValue = normalizeManagementValue(input.identity?.harmony ?? 50);
  const boardPressureValue = 1 - normalizeManagementValue(input.identity?.boardConfidence ?? 50);
  const rosterPressure = roundValue(
    clamp(
      (missingMinimumSlots * 0.7 + Math.max(missingTargetSlots - missingMinimumSlots, 0) * 0.3) /
        Math.max(input.targetRosterSize ?? input.playerMin, 1),
      0,
      1,
    ),
    3,
  );
  const needPressure = roundValue(
    clamp(
      input.planner.minimumSlotsMissing * 0.18 +
        input.planner.coreNeeded * 0.12 +
        input.planner.specialistNeeded * 0.1 +
        input.planner.depthNeeded * 0.08 +
        input.planner.backupNeeded * 0.05 +
        input.planner.cheapFillNeeded * 0.04 +
        input.planner.starAllowed * 0.08 +
        input.planner.superstarAllowed * 0.06,
      0,
      1,
    ),
    3,
  );
  const cashDiscipline = roundValue(
    clamp(0.55 * financesValue + 0.3 * harmonyValue + 0.15 * (1 - boardPressureValue), 0, 1),
    3,
  );
  const cashAggression = roundValue(
    clamp(0.45 * ambitionValue + 0.35 * boardPressureValue + 0.2 * (1 - financesValue), 0, 1),
    3,
  );
  const overspendTolerance = roundValue(
    clamp(0.03 + cashAggression * 0.12 - cashDiscipline * 0.04, 0.02, 0.16),
    3,
  );
  const reservedCashForMinimum = input.planner.reservedCashForMinimum ?? null;
  const season1OptimumMode = input.runMode === "season1_optimum_execute";
  const season1SpendCorridor = season1OptimumMode
    ? getSeason1SpendCorridor(input.team, input.identity, input.expectedPrizeSignal)
    : null;
  const season1SpendTargetPct = season1OptimumMode
    ? getAdjustedSeason1OptimumSpendTargetPct(input.team, input.identity, input.expectedPrizeSignal)
    : null;
  const season1TargetCashLeft =
    season1SpendTargetPct != null && startingCash != null && startingCash > 0
      ? roundValue(startingCash * (1 - season1SpendTargetPct), 2)
      : null;
  const depthSlots = Math.max(
    input.planner.depthNeeded + input.planner.backupNeeded + input.planner.specialistNeeded,
    Math.max(missingTargetSlots - missingMinimumSlots, 0),
  );
  const expectedDepthSlotCost = input.anchors.q50Price > 0 ? input.anchors.q50Price : expectedMinimumSlotCost ?? 0;
  const reservedCashForDepth =
    season1OptimumMode
      ? 0
      : depthSlots > 0
      ? roundValue(expectedDepthSlotCost * Math.min(depthSlots, 3) * clamp(0.45 + financesValue * 0.35 + harmonyValue * 0.15, 0.35, 0.95), 2)
      : 0;
  const availableCashForCurrentPick =
    currentCash == null
      ? null
      : season1OptimumMode
        ? roundValue(Math.max(currentCash, 0), 2)
        : roundValue(Math.max(currentCash - (reservedCashForMinimum ?? 0) - reservedCashForDepth, 0), 2);
  const currentCashRatio =
    currentCash != null && startingCash != null && startingCash > 0 ? currentCash / startingCash : financesValue;
  const prizeTrendBias =
    input.expectedPrizeSignal.prizeSourceStatus === "missing_source"
      ? 0
      : input.expectedPrizeSignal.expectedPrizeTrend === "up"
        ? 0.06
        : input.expectedPrizeSignal.expectedPrizeTrend === "down"
          ? -0.08
          : input.expectedPrizeSignal.expectedPrizeTrend === "volatile"
            ? -0.03
            : 0;
  const reserveTargetRatio = clamp(
    financeConfig.cashTargetBase +
      financesValue * financeConfig.cashTargetFinanceRange +
      boardPressureValue * financeConfig.cashTargetBoardBoost +
      Math.max(0, 0.5 - ambitionValue) * financeConfig.cashTargetAmbitionBoost +
      prizeTrendBias,
    financeConfig.cashTargetMin,
    financeConfig.cashTargetMax,
  );
  const reserveTargetBase =
    startingCash != null && startingCash > 0
      ? startingCash * reserveTargetRatio
      : currentCash != null
        ? currentCash * reserveTargetRatio
        : null;
  const minCashBuffer =
    season1OptimumMode
      ? season1TargetCashLeft
      : reserveTargetBase == null
        ? reservedCashForMinimum
        : roundValue(
            Math.max(
              reservedCashForMinimum ?? 0,
              reserveTargetBase,
              (reservedCashForMinimum ?? 0) + (reservedCashForDepth ?? 0) * 0.35,
            ),
            2,
          );
  const shouldSaveCash =
    !season1OptimumMode &&
    missingMinimumSlots === 0 &&
    missingTargetSlots > 0 &&
    (financesValue >= 0.68 || harmonyValue >= 0.68) &&
    boardPressureValue <= 0.58;
  const attackPressure = roundValue(
    clamp(
      0.35 * ambitionValue +
        0.2 * boardPressureValue +
        0.25 * rosterPressure +
        0.2 * needPressure +
        Math.max(prizeTrendBias, 0),
      0,
      1,
    ),
    3,
  );
  const savingsBias = roundValue(
    clamp(
      0.4 * financesValue +
        0.2 * harmonyValue +
        0.15 * Math.max((minCashBuffer ?? 0) > 0 && currentCash != null ? (minCashBuffer! - currentCash) / minCashBuffer! : 0, 0) +
        0.15 * (1 - attackPressure) +
        Math.max(-prizeTrendBias, 0),
      0,
      1,
    ),
    3,
  );
  const spendFactor =
    currentCash == null
      ? null
      : roundValue(
          season1OptimumMode
            ? clamp(1.08 + cashAggression * 0.22 + ambitionValue * 0.12 - financesValue * 0.06, 1.02, 1.42)
            : clamp(
                1 +
                  (attackPressure - 0.5) * 0.38 -
                  (savingsBias - 0.5) * 0.34 +
                  rosterPressure * 0.18 +
                  needPressure * 0.16,
                0.55,
                1.45,
              ),
          3,
        );
  const maxSpendTotalThisWindow =
    currentCash == null
      ? null
      : roundValue(Math.max(currentCash - (minCashBuffer ?? 0), 0), 2);
  const allowedBudgetForSearch =
    maxSpendTotalThisWindow == null
      ? null
      : roundValue(
          Math.max(
            0,
            Math.min(
              maxSpendTotalThisWindow,
              maxSpendTotalThisWindow * (spendFactor ?? 1),
            ),
          ),
          2,
        );
  const maxSpendPerPick =
    availableCashForCurrentPick == null || allowedBudgetForSearch == null
      ? null
      : roundValue(
          Math.max(
            input.anchors.q50Price,
            Math.min(availableCashForCurrentPick, allowedBudgetForSearch) *
              clamp(
                shouldSaveCash
                  ? 0.16 + ambitionValue * 0.08 - cashDiscipline * 0.03
                  : 0.22 + cashAggression * 0.16 - cashDiscipline * 0.04,
                0.12,
                0.58,
              ),
          ),
          2,
        );
  const canBuyStar =
    input.planner.starAllowed > 0 &&
    availableCashForCurrentPick != null &&
    availableCashForCurrentPick >= input.anchors.q90Price * Math.max(1 - overspendTolerance, 0.82);
  const canBuySuperstar =
    input.planner.superstarAllowed > 0 &&
    availableCashForCurrentPick != null &&
    availableCashForCurrentPick >= input.anchors.q95Price * Math.max(1 - overspendTolerance, 0.84);
  const financePosture = buildFinancePosture({
    currentCash,
    startingCash,
    financesValue01: financesValue,
    ambitionValue01: ambitionValue,
    boardPressureValue01: boardPressureValue,
    harmonyValue01: harmonyValue,
    rosterPressure,
    needPressure,
    minCashBuffer,
    allowedBudgetForSearch,
    expectedPrizeSignal: input.expectedPrizeSignal,
  });
  const spendArchitectureReason =
    financePosture === "cash_poor_forced_fill"
      ? "Budget bleibt knapp: Minimum sichern, teure Spitzen vermeiden."
      : financePosture === "desperate"
        ? "Roster-/Need-Druck zwingt zu aggressiverem Fuellen trotz knapper Sicherheit."
        : financePosture === "aggressive"
          ? "Ambition, Druck und Need-Fenster erlauben offensivere Investitionen."
          : financePosture === "value_hunter"
            ? "Team sucht bewusst Preis-Leistung statt Prestige."
            : financePosture === "cash_rich_but_cautious"
              ? "Viel Cash vorhanden, aber Ruecklagen und Harmonie halten das Team vorsichtig."
              : financePosture === "conservative"
                ? "Ruecklagen und Stabilitaet haben Vorrang."
                : "Ausgewogene Investitionslinie zwischen Reserve und Need-Druck.";
  const warnings: string[] = [];
  if (currentCash == null) {
    warnings.push("cash_strategy_missing");
  }
  if (shouldSaveCash) {
    warnings.push("saved_cash_by_strategy");
  }
  if (reservedCashForMinimum != null && currentCash != null && currentCash < reservedCashForMinimum) {
    warnings.push("cash_reserve_gate_failed");
  }
  if (input.expectedPrizeSignal.prizeSourceStatus === "missing_source") {
    warnings.push("expected_prize_source_missing");
  }
  if (season1SpendTargetPct != null) {
    warnings.push(`season1_spend_target:${roundValue(season1SpendTargetPct * 100, 1)}pct`);
    if (season1SpendCorridor) {
      warnings.push(
        `season1_spend_corridor:${season1SpendCorridor.archetype}:${roundValue(season1SpendCorridor.minPct * 100, 1)}-${roundValue(season1SpendCorridor.maxPct * 100, 1)}pct`,
      );
    }
    const prizeTrendSpendAdjustment = getPrizeTrendSpendAdjustment(input.expectedPrizeSignal, input.identity);
    if (prizeTrendSpendAdjustment !== 0) {
      warnings.push(`prize_trend_spend_adjustment:${roundValue(prizeTrendSpendAdjustment * 100, 1)}pct`);
    }
  }

  return {
    strategySource: "retool_reference",
    sourceStatus:
      currentCash == null
        ? "missing_source"
        : input.expectedPrizeSignal.prizeSourceStatus === "ready"
          ? "ready"
          : "partial",
    startingCash,
    currentCash,
    targetRoster: input.targetRosterSize,
    minimumRoster: input.playerMin,
    currentRoster: input.rosterCount,
    missingMinimumSlots,
    missingTargetSlots,
    expectedMinimumSlotCost,
    reservedCashForMinimum,
    reservedCashForDepth,
    availableCashForCurrentPick,
    maxSpendPerPick,
    maxSpendByLane: {
      cheap_fill: null,
      backup: null,
      depth: null,
      specialist: null,
      core: null,
      star: null,
      superstar: null,
    },
    cashAggression,
    cashDiscipline,
    overspendTolerance,
    shouldSaveCash,
    canBuyStar,
    canBuySuperstar,
    financePosture,
    spendFactor,
    allowedBudgetForSearch,
    attackPressure,
    savingsBias,
    minCashBuffer,
    season1SpendTargetPct,
    season1SpendMinPct: season1SpendCorridor?.minPct ?? null,
    season1SpendMaxPct: season1SpendCorridor?.maxPct ?? null,
    season1SpendArchetype: season1SpendCorridor?.archetype ?? null,
    rosterPressure,
    needPressure,
    spendArchitecture: {
      allowed_budget_for_search: allowedBudgetForSearch,
      maxSpendTotalThisWindow,
      maxSpendPerPick,
      maxSpendByLane: {
        cheap_fill: null,
        backup: null,
        depth: null,
        specialist: null,
        core: null,
        star: null,
        superstar: null,
      },
      premiumSlotCount: input.planner.superstarAllowed + input.planner.starAllowed,
      starSlotCount: input.planner.starAllowed,
      coreSlotCount: input.planner.coreNeeded,
      specialistSlotCount: input.planner.specialistNeeded,
      depthSlotCount: input.planner.depthNeeded,
      fillSlotCount: input.planner.cheapFillNeeded,
      reserveSlotCount: input.planner.backupNeeded,
      minCashBuffer,
      season1SpendTargetPct,
      season1SpendMinPct: season1SpendCorridor?.minPct ?? null,
      season1SpendMaxPct: season1SpendCorridor?.maxPct ?? null,
      season1SpendArchetype: season1SpendCorridor?.archetype ?? null,
      reservedCashForMinimum,
      reservedCashForDepth,
      attackPressure,
      savingsBias,
      rosterPressure,
      needPressure,
      financePosture,
      spendFactor,
      reason: spendArchitectureReason,
    },
    expectedPrizeSignal: input.expectedPrizeSignal,
    financesValue: roundValue(financesValue * 100, 0),
    ambitionValue: roundValue(ambitionValue * 100, 0),
    boardPressureValue: roundValue(boardPressureValue * 100, 0),
    harmonyValue: roundValue(harmonyValue * 100, 0),
    warnings,
  };
}

function buildBudgetLanes(input: {
  cash: number | null;
  planner: AiNeedsPicksPlanner;
  cashStrategy: AiNeedsPicksCashStrategy;
  profile: TeamStrategyProfile | null;
  rosterGap: number;
  anchors: LaneMarketAnchors;
  runMode?: AiNeedsPicksRunMode | null;
}): AiNeedsPicksBudgetLane[] {
  const cash = input.cash;
  const counts = countLaneTargets(input.planner.slotPlan);
  const season1OptimumMode = input.runMode === "season1_optimum_execute";
  if (!Number.isFinite(cash) || cash == null || cash <= 0) {
    return (["cheap_fill", "backup", "depth", "specialist", "core", "star", "superstar"] as AiNeedsPickLane[]).map((lane) => ({
      lane,
      spendCap: null,
      priceCap: null,
      salaryCap: null,
      maxCashShare: null,
      minNeedScore: 0,
      minTeamFitScore: 0,
      allowedWhenUnderMinimum: lane === "cheap_fill" || lane === "backup" || lane === "depth",
      cheaperAlternativeCheck: true,
      reason: "Kein belastbarer Cash-Wert fuer Lane-Budgets.",
      plannedSlots: counts[lane],
      remainingSlots: counts[lane],
      spendUsed: 0,
      active: counts[lane] > 0,
      sourceStatus: "missing_source",
    }));
  }

  const starBias = (input.profile?.bias.starPriority ?? 5) / 10;
  const valueBias = (input.profile?.bias.valuePriority ?? 5) / 10;
  const depthBias = (input.profile?.bias.rosterDepthPreference ?? 5) / 10;
  const rosterGapPressure = clamp(input.rosterGap / 4, 0, 1);
  const spendableCash = Math.max(
    input.cashStrategy.allowedBudgetForSearch ??
      input.cashStrategy.availableCashForCurrentPick ??
      Math.max(cash, 0),
    0,
  );
  const laneShareBase: Record<AiNeedsPickLane, number> = {
    cheap_fill: clamp(0.05 + rosterGapPressure * 0.03 + valueBias * 0.02 + input.cashStrategy.cashDiscipline * 0.02, 0.04, 0.14),
    backup: clamp(0.08 + depthBias * 0.04 + input.cashStrategy.cashDiscipline * 0.03, 0.06, 0.18),
    depth: clamp(0.14 + depthBias * 0.08 + rosterGapPressure * 0.04 + input.cashStrategy.cashDiscipline * 0.02, 0.1, 0.3),
    specialist: clamp(0.18 + starBias * 0.04 + valueBias * 0.03 + input.cashStrategy.cashAggression * 0.02, 0.14, 0.34),
    core: clamp(0.22 + valueBias * 0.06 + input.cashStrategy.cashAggression * 0.03, 0.16, 0.4),
    star: clamp(0.28 + starBias * 0.1 + input.cashStrategy.cashAggression * 0.08 - input.cashStrategy.cashDiscipline * 0.04, 0.18, 0.52),
    superstar: clamp(0.4 + starBias * 0.12 + input.cashStrategy.cashAggression * 0.1 - input.cashStrategy.cashDiscipline * 0.05, 0.28, 0.68),
  };
  const laneShares: Record<AiNeedsPickLane, number> = {
    ...laneShareBase,
    star:
      input.planner.minimumSlotsMissing > 0 && !season1OptimumMode
        ? Math.min(laneShareBase.star, 0.18)
        : laneShareBase.star,
    superstar:
      input.planner.minimumSlotsMissing > 0 && !season1OptimumMode
        ? Math.min(laneShareBase.superstar, 0.18)
        : laneShareBase.superstar,
  };
  const sharedCostBandCaps = buildAiNeedsCostBandCaps({
    anchors: input.anchors,
    expectedMinimumSlotCost: input.cashStrategy.expectedMinimumSlotCost,
    currentCash: cash,
    minimumSlotsMissing: input.planner.minimumSlotsMissing,
  });
  const caps: Record<AiNeedsPickLane, number> = {
    cheap_fill: roundValue(Math.max(sharedCostBandCaps.cheap_fill, spendableCash * laneShares.cheap_fill), 2),
    backup: roundValue(Math.max(sharedCostBandCaps.backup, spendableCash * laneShares.backup), 2),
    depth: roundValue(Math.max(sharedCostBandCaps.depth, spendableCash * laneShares.depth), 2),
    specialist: roundValue(Math.max(input.anchors.q75Price, spendableCash * laneShares.specialist), 2),
    core: roundValue(Math.max(sharedCostBandCaps.core, spendableCash * laneShares.core), 2),
    star: roundValue(Math.max(input.anchors.q90Price, spendableCash * laneShares.star), 2),
    superstar: roundValue(Math.max(input.anchors.q95Price, spendableCash * laneShares.superstar), 2),
  };
  const priceCaps: Record<AiNeedsPickLane, number> = {
    cheap_fill: roundValue(Math.min(caps.cheap_fill, sharedCostBandCaps.cheap_fill), 2),
    backup: roundValue(Math.min(caps.backup, sharedCostBandCaps.backup), 2),
    depth: roundValue(Math.min(caps.depth, sharedCostBandCaps.depth), 2),
    specialist: roundValue(Math.min(caps.specialist, Math.max(input.anchors.q85Price, input.anchors.q75Price * 1.05)), 2),
    core: roundValue(Math.min(caps.core, sharedCostBandCaps.core), 2),
    star: roundValue(Math.max(caps.star, input.anchors.q90Price), 2),
    superstar: roundValue(Math.max(caps.superstar, input.anchors.q95Price), 2),
  };
  const salaryCaps: Record<AiNeedsPickLane, number> = {
    cheap_fill: roundValue(Math.max(5, priceCaps.cheap_fill * 0.22), 2),
    backup: roundValue(Math.max(6, priceCaps.backup * 0.22), 2),
    depth: roundValue(Math.max(8, priceCaps.depth * 0.22), 2),
    specialist: roundValue(Math.max(9, priceCaps.specialist * 0.24), 2),
    core: roundValue(Math.max(10, priceCaps.core * 0.24), 2),
    star: roundValue(Math.max(14, priceCaps.star * 0.26), 2),
    superstar: roundValue(Math.max(18, priceCaps.superstar * 0.28), 2),
  };
  const reasons: Record<AiNeedsPickLane, string> = {
    cheap_fill: "Nur guenstige Setup-Slots, um das Minimum ohne Luxus und ohne teure Stars zu erreichen.",
    backup: "Late-Bench und Sicherheitsnetz fuer spaetere Slots.",
    depth: "Kaderbreite mit noch brauchbarem Teamfit.",
    specialist: "Gezielte Diszi- oder Farblacke statt blindem Allround-Buy.",
    core: "Stabile Stammrotation mit Teamfit und Preis-Leistung.",
    star: "Nur fuer echten Impact-Slot mit Budgetfenster.",
    superstar: "Extrem teuerer Ausnahme-Slot nur bei Ambition, Bedarf und Cash-Headroom.",
  };
  const minNeedScores: Record<AiNeedsPickLane, number> = {
    cheap_fill: 1.2,
    backup: 1.2,
    depth: 1.6,
    specialist: 2.8,
    core: 2.4,
    star: 3.4,
    superstar: 4.2,
  };
  const minTeamFitScores: Record<AiNeedsPickLane, number> = {
    cheap_fill: -6,
    backup: -3,
    depth: -1,
    specialist: 0,
    core: 1.5,
    star: 3.5,
    superstar: 5,
  };
  const underMinimumAllowed: Record<AiNeedsPickLane, boolean> = {
    cheap_fill: true,
    backup: true,
    depth: true,
    specialist: season1OptimumMode,
    core: true,
    star: season1OptimumMode,
    superstar: season1OptimumMode,
  };
  const cheaperAlternativeCheck: Record<AiNeedsPickLane, boolean> = {
    cheap_fill: true,
    backup: true,
    depth: true,
    specialist: true,
    core: true,
    star: true,
    superstar: false,
  };

  return (["cheap_fill", "backup", "depth", "specialist", "core", "star", "superstar"] as AiNeedsPickLane[]).map((lane) => ({
    lane,
    spendCap: roundValue(caps[lane] * Math.max(counts[lane], 1), 2),
    priceCap: priceCaps[lane],
    salaryCap: salaryCaps[lane],
    maxCashShare: roundValue(laneShares[lane], 3),
    minNeedScore: minNeedScores[lane],
    minTeamFitScore: minTeamFitScores[lane],
    allowedWhenUnderMinimum: underMinimumAllowed[lane],
    cheaperAlternativeCheck: cheaperAlternativeCheck[lane],
    reason:
      lane === "cheap_fill" && input.planner.minimumSlotsMissing > 0
        ? `${reasons[lane]} Reserve fuer Minimum: ${formatLaneReserve(input.planner.reservedCashForMinimum)}.`
        : reasons[lane],
    plannedSlots: counts[lane],
    remainingSlots: counts[lane],
    spendUsed: 0,
    active: counts[lane] > 0,
    sourceStatus: "local_inferred",
  }));
}

function chooseLane(input: {
  step: number;
  planner: AiNeedsPicksPlanner;
  budgetLanes: AiNeedsPicksBudgetLane[];
  minimumSlotsBefore: number;
  openNeeds: AiNeedsPicksOpenNeed[];
}) {
  let plannedLane = input.planner.slotPlan[input.step] ?? input.planner.slotPlan.at(-1) ?? "depth";
  if (plannedLane === "cheap_fill" && input.minimumSlotsBefore <= 0) {
    const openNeedAxes = new Set(input.openNeeds.map((need) => need.axis));
    const rerouteOrder: AiNeedsPickLane[] = openNeedAxes.has("core")
      ? ["core", "specialist", "depth", "backup"]
      : openNeedAxes.has("specialist")
        ? ["specialist", "core", "depth", "backup"]
        : openNeedAxes.has("depth") || openNeedAxes.has("backup") || openNeedAxes.has("roster")
          ? ["depth", "backup", "specialist", "core"]
          : ["backup", "depth", "specialist", "core"];
    const reroutedLane = rerouteOrder.find((lane) => {
      const laneEntry = input.budgetLanes.find((entry) => entry.lane === lane);
      return Boolean(laneEntry && laneEntry.remainingSlots > 0);
    });
    if (reroutedLane) {
      plannedLane = reroutedLane;
    }
  }
  const targetLane = input.budgetLanes.find((entry) => entry.lane === plannedLane);
  if (targetLane && targetLane.remainingSlots > 0) {
    return plannedLane;
  }
  let fallback = plannedLane;
  while (targetLane == null || roleTierScore(fallback) >= 0) {
    fallback = downgradeLane(fallback);
    const laneEntry = input.budgetLanes.find((entry) => entry.lane === fallback);
    if (laneEntry && laneEntry.remainingSlots > 0) {
      return fallback;
    }
    if (fallback === "backup") {
      break;
    }
  }
  return "backup" as const;
}

function resolveTeamCashTier(
  cashStrategy: AiNeedsPicksCashStrategy,
): "cash_poor" | "tight" | "stable" | "healthy" | "rich" {
  const currentCash = cashStrategy.currentCash ?? 0;
  const startingCash = cashStrategy.startingCash ?? currentCash;
  const ratio = startingCash > 0 ? currentCash / startingCash : 0;
  if (currentCash < 45 || ratio < 0.32) return "cash_poor";
  if (currentCash < 75 || ratio < 0.52) return "tight";
  if (currentCash < 120 || ratio < 0.78) return "stable";
  if (currentCash < 180 || ratio < 1.08) return "healthy";
  return "rich";
}

function resolvePickPhase(input: {
  lane: AiNeedsPickLane;
  step: number;
  minimumSlotsBefore: number;
  reserveSecured: boolean;
  rosterCount: number | null;
  targetRosterSize: number | null;
}) {
  if (input.minimumSlotsBefore > 0) {
    return "minimum_skeleton" as const;
  }
  if (input.lane === "star" || input.lane === "superstar") {
    return "star_investment" as const;
  }
  if (input.lane === "specialist") {
    return "specialist_fill" as const;
  }
  if (input.lane === "core") {
    return input.reserveSecured ? ("identity_core" as const) : ("early_core" as const);
  }
  const rosterRatio =
    input.rosterCount != null && input.targetRosterSize != null && input.targetRosterSize > 0
      ? input.rosterCount / input.targetRosterSize
      : 0;
  if (input.reserveSecured && (input.step >= 3 || rosterRatio >= 0.72)) {
    return "late_core_investment" as const;
  }
  return "specialist_fill" as const;
}

function resolvePhaseCap(input: {
  lane: AiNeedsPickLane;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  lanePriceCap: number | null;
  cashStrategy: AiNeedsPicksCashStrategy;
  teamCashTier: "cash_poor" | "tight" | "stable" | "healthy" | "rich";
  teamIdentityScore?: number;
  needMatchScore?: number;
}) {
  const lanePriceCap = input.lanePriceCap;
  if (lanePriceCap == null) {
    return null;
  }
  const teamIdentityScore = input.teamIdentityScore ?? 0;
  const needMatchScore = input.needMatchScore ?? 0;
  const multipliers: Record<typeof input.teamCashTier, number> = {
    cash_poor: 0.72,
    tight: 0.82,
    stable: 0.92,
    healthy: 1,
    rich: 1.08,
  };
  const cashTierFactor = multipliers[input.teamCashTier];
  const baseCapByPhase: Record<typeof input.pickPhase, number> = {
    minimum_skeleton: input.lane === "cheap_fill" || input.lane === "backup" ? 0.88 : 0.72,
    early_core: input.lane === "core" ? 0.86 : 0.78,
    identity_core: 0.96,
    specialist_fill: 0.84,
    late_core_investment: 1.04,
    star_investment: 1.12,
  };
  const fitBonus =
    input.pickPhase === "identity_core" && teamIdentityScore >= 6 && needMatchScore >= 4
      ? 0.08
      : input.pickPhase === "star_investment" && teamIdentityScore >= 7 && needMatchScore >= 5
        ? 0.05
        : 0;
  const conservativeClamp = input.cashStrategy.shouldSaveCash ? -0.05 : 0;
  const reservedMinimumPenalty =
    input.cashStrategy.reservedCashForMinimum != null &&
    input.cashStrategy.currentCash != null &&
    input.cashStrategy.currentCash <= input.cashStrategy.reservedCashForMinimum * 1.1
      ? -0.08
      : 0;
  return roundValue(
    lanePriceCap *
      clamp(baseCapByPhase[input.pickPhase] * cashTierFactor + fitBonus + conservativeClamp + reservedMinimumPenalty, 0.58, 1.16),
    2,
  );
}

function getBudgetStretchEnvelope(input: {
  lane: AiNeedsPickLane;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  price: number | null;
  lanePriceCap: number | null;
  laneSpendCap: number | null;
  remainingCash: number | null;
  cashStrategy: AiNeedsPicksCashStrategy;
  teamIdentityScore: number;
  needMatchScore: number;
  minimumSlotsMissing: number;
}) {
  const price = input.price;
  const lanePriceCap = input.lanePriceCap;
  const laneSpendCap = input.laneSpendCap;
  if (price == null || lanePriceCap == null || laneSpendCap == null) {
    return {
      budgetStretchApplied: false,
      effectiveLanePriceCap: lanePriceCap,
      effectiveLaneSpendCap: laneSpendCap,
      stretchPct: 0,
      budgetStretchReason: null,
      budgetStretchPhaseAllowed: false,
      budgetStretchBlockedReason: "missing_lane_cap",
    };
  }
  if (price <= lanePriceCap) {
    return {
      budgetStretchApplied: false,
      effectiveLanePriceCap: lanePriceCap,
      effectiveLaneSpendCap: laneSpendCap,
      stretchPct: 0,
      budgetStretchReason: null,
      budgetStretchPhaseAllowed: false,
      budgetStretchBlockedReason: null,
    };
  }
  if (input.minimumSlotsMissing > 0 && (input.lane === "cheap_fill" || input.lane === "backup")) {
    return {
      budgetStretchApplied: false,
      effectiveLanePriceCap: lanePriceCap,
      effectiveLaneSpendCap: laneSpendCap,
      stretchPct: 0,
      budgetStretchReason: null,
      budgetStretchPhaseAllowed: false,
      budgetStretchBlockedReason: "minimum_skeleton_no_stretch",
    };
  }
  if (!canAffordWithoutNegativeCash(price, input.remainingCash)) {
    return {
      budgetStretchApplied: false,
      effectiveLanePriceCap: lanePriceCap,
      effectiveLaneSpendCap: laneSpendCap,
      stretchPct: 0,
      budgetStretchReason: null,
      budgetStretchPhaseAllowed: false,
      budgetStretchBlockedReason: "cash_below_price",
    };
  }
  const posture = input.cashStrategy.financePosture;
  const aggressivePosture = posture === "aggressive" || posture === "desperate";
  const balancedAttack =
    posture === "balanced" &&
    (input.cashStrategy.spendFactor ?? 1) >= 1.05 &&
    input.cashStrategy.attackPressure >= 0.56;
  const cashRichAttack =
    posture === "cash_rich_but_cautious" &&
    (input.cashStrategy.spendFactor ?? 1) >= 1.04 &&
    input.cashStrategy.attackPressure >= 0.6;
  const highFit =
    input.teamIdentityScore >= 6 ||
    input.needMatchScore >= 5.5 ||
    (input.teamIdentityScore >= 4.5 && input.needMatchScore >= 4.5);
  const eliteFit = input.teamIdentityScore >= 7 && input.needMatchScore >= 5;
  const canStretch =
    highFit &&
    (aggressivePosture || balancedAttack || cashRichAttack) &&
    (input.pickPhase === "identity_core" || input.pickPhase === "late_core_investment" || input.pickPhase === "star_investment");
  if (!canStretch) {
    return {
      budgetStretchApplied: false,
      effectiveLanePriceCap: lanePriceCap,
      effectiveLaneSpendCap: laneSpendCap,
      stretchPct: 0,
      budgetStretchReason: null,
      budgetStretchPhaseAllowed: false,
      budgetStretchBlockedReason:
        input.pickPhase === "minimum_skeleton" || input.pickPhase === "early_core" || input.pickPhase === "specialist_fill"
          ? "phase_blocks_stretch"
          : "fit_or_finance_missing",
    };
  }

  const extraStretchBase = aggressivePosture ? 0.12 : cashRichAttack ? 0.08 : 0.06;
  const fitStretchBonus = eliteFit ? 0.04 : 0.02;
  const stretchFloor = input.minimumSlotsMissing > 0 ? Math.min(input.cashStrategy.overspendTolerance, 0.06) : input.cashStrategy.overspendTolerance;
  const stretchCeiling = input.minimumSlotsMissing > 0 ? 0.12 : 0.24;
  const stretchPct = clamp(stretchFloor + extraStretchBase + fitStretchBonus, stretchFloor, stretchCeiling);
  const effectiveLanePriceCap = roundValue(lanePriceCap * (1 + stretchPct), 2);
  const effectiveLaneSpendCap = roundValue(laneSpendCap * (1 + stretchPct), 2);
  return {
    budgetStretchApplied: price <= effectiveLanePriceCap + 0.01,
    effectiveLanePriceCap,
    effectiveLaneSpendCap,
    stretchPct,
    budgetStretchReason: `stretch_${input.pickPhase}_${aggressivePosture ? "aggressive" : cashRichAttack ? "cash_rich" : "balanced"}`,
    budgetStretchPhaseAllowed: true,
    budgetStretchBlockedReason: price <= effectiveLanePriceCap + 0.01 ? null : "phase_cap_still_exceeded",
  };
}

function isAiPlannerCandidateEligible(input: {
  team: Team;
  recommendation: AiTransferPreviewRecommendation;
  player: Player | null;
  rosterPlayers: Player[];
  openNeeds: AiNeedsPicksOpenNeed[];
  budgetLane: AiNeedsPicksBudgetLane;
  pickPhase: AiNeedsPickPhase;
  price: number | null;
  remainingCash: number | null;
  minimumSlotsBefore: number;
  minimumReachableAfterPick: boolean;
  targetSlotsBefore: number;
  targetReachableAfterPick: boolean;
  topNeedDisciplineIds: string[];
  classCounts: Map<string, number>;
  profile: TeamStrategyProfile | null;
}) {
  const price = input.price;
  const lane = input.budgetLane.lane;
  if (price != null && input.remainingCash != null && price > input.remainingCash + 0.01) {
    return false;
  }
  if (input.minimumSlotsBefore > 0 && !input.minimumReachableAfterPick) {
    return false;
  }
  if (input.targetSlotsBefore > 1 && !input.targetReachableAfterPick && lane !== "star" && lane !== "superstar") {
    return false;
  }

  if (price != null) {
    const hardLaneCap =
      lane === "cheap_fill"
        ? AI_CHEAP_FILL_MARKET_VALUE_CAP
        : lane === "backup"
          ? AI_RESERVE_MARKET_VALUE_CAP
          : lane === "depth"
            ? Math.min(Math.max(input.budgetLane.priceCap ?? AI_RESERVE_MARKET_VALUE_CAP, AI_RESERVE_MARKET_VALUE_CAP), 40)
            : lane === "specialist" || lane === "core"
              ? input.budgetLane.priceCap != null
                ? input.budgetLane.priceCap * 1.18
                : null
              : null;
    if (hardLaneCap != null && price > hardLaneCap + 0.01) {
      return false;
    }
    if ((lane === "cheap_fill" || lane === "backup" || lane === "depth") && price > AI_EXPENSIVE_EARLY_SCAN_CAP) {
      return false;
    }
  }

  const player = input.player;
  if (!player) {
    return true;
  }

  const candidateAxis = getPlayerAxis(player);
  const playerRole = getPlayerRoleTag(player, candidateAxis);
  const sportsQuality = getPlayerSportsQuality(player, candidateAxis);
  const needAxes = new Set(
    input.openNeeds
      .map((entry) => entry.axis)
      .filter((axis): axis is "pow" | "spe" | "men" | "soc" => axis === "pow" || axis === "spe" || axis === "men" || axis === "soc"),
  );
  const axisHitsNeed = candidateAxis != null && needAxes.has(candidateAxis);
  const bestNeedDisciplineScore =
    input.topNeedDisciplineIds.length > 0
      ? Math.max(...input.topNeedDisciplineIds.map((disciplineId) => player.disciplineRatings?.[disciplineId] ?? 0), 0)
      : 0;
  const topNeedDisciplineHit = bestNeedDisciplineScore >= (lane === "specialist" ? 54 : 48);
  const cheapEmergency =
    input.minimumSlotsBefore > 0 &&
    (lane === "cheap_fill" || lane === "backup") &&
    price != null &&
    price <= (lane === "cheap_fill" ? AI_CHEAP_FILL_MARKET_VALUE_CAP : AI_RESERVE_MARKET_VALUE_CAP);
  const isMercenary = hasMercenaryTrait({
    traitsPositive: player.traitsPositive ?? [],
    traitsNegative: player.traitsNegative ?? [],
  });
  const teamFit = calculateTransfermarktFit(player, input.rosterPlayers, { teamId: input.team.teamId }).teamFit ?? 0;
  const plannerAllowsThemeBreaker =
    (lane === "star" || lane === "superstar") &&
    (bestNeedDisciplineScore >= 76 || sportsQuality.topCore >= 76 || sportsQuality.topDiscipline >= 84);
  if (teamFit < 0 && !isMercenary && !cheapEmergency && !plannerAllowsThemeBreaker) {
    return false;
  }

  const laneNeedsAxis =
    lane === "depth" ||
    lane === "specialist" ||
    (lane === "core" && input.pickPhase !== "late_core_investment");
  if (
    laneNeedsAxis &&
    needAxes.size > 0 &&
    !axisHitsNeed &&
    !topNeedDisciplineHit &&
    playerRole !== "star" &&
    playerRole !== "superstar"
  ) {
    return false;
  }

  const classToken = normalizeToken(player.className ?? input.recommendation.className);
  const classCount = input.classCounts.get(classToken) ?? 0;
  const profileWantsClass = Boolean(input.profile?.preferredClasses.some((entry) => normalizeToken(entry) === classToken));
  const clearlyDifferentOrBetter =
    profileWantsClass ||
    axisHitsNeed ||
    topNeedDisciplineHit ||
    sportsQuality.strongDisciplineCount >= 2 ||
    sportsQuality.topDiscipline >= 70 ||
    playerRole === "star" ||
    playerRole === "superstar";
  if (classCount >= 3 && !clearlyDifferentOrBetter) {
    return false;
  }

  return true;
}

function scoreCandidate(input: {
  gameState: GameState;
  team: Team;
  recommendation: AiTransferPreviewRecommendation;
  player: Player | null;
  openNeeds: AiNeedsPicksOpenNeed[];
  budgetLane: AiNeedsPicksBudgetLane;
  profile: TeamStrategyProfile | null;
  topNeedDisciplineIds: string[];
  remainingCash: number | null;
  minimumSlotsMissing: number;
  minimumReserveAfterPick: number | null;
  minimumReachableAfterPick: boolean;
  cheaperMinimumSafeAlternativeAvailable: boolean;
  anchors: LaneMarketAnchors;
  coveredAxisHits: Record<"pow" | "spe" | "men" | "soc", number>;
  classCounts: Map<string, number>;
  roleCounts: Map<string, number>;
  disciplinePeak: Map<string, number>;
  cashStrategy: AiNeedsPicksCashStrategy;
  seasonStrategy: AiNeedsPicksSeasonStrategy;
  pickPhase:
    | "minimum_skeleton"
    | "early_core"
    | "identity_core"
    | "specialist_fill"
    | "late_core_investment"
    | "star_investment";
  teamCashTier: "cash_poor" | "tight" | "stable" | "healthy" | "rich";
}) {
  const player = input.player;
  const candidateAxis = player ? getPlayerAxis(player) : null;
  const normalizedClass = normalizeToken(player?.className ?? input.recommendation.className);
  const normalizedRace = normalizeToken(player?.race ?? input.recommendation.race);
  const playerRole = player ? getPlayerRoleTag(player, candidateAxis) : "depth";
  const rawTier = classifyCandidateTier({
    price: input.recommendation.price ?? input.recommendation.marketValue ?? null,
    anchors: input.anchors,
  });
  const cheapFillEligible = isCheapFillCandidate({
    price: input.recommendation.price ?? input.recommendation.marketValue ?? null,
    salary: input.recommendation.salary ?? null,
    anchors: input.anchors,
  });
  const bestDisciplineEntry = player ? getPlayerPrimaryDiscipline(player) : null;
  const sportsQuality = player ? getPlayerSportsQuality(player, candidateAxis) : null;
  const playerQualityScore = roundValue(
    clamp(((sportsQuality?.quality ?? 0) / 100) * 24 + ((sportsQuality?.strongDisciplineCount ?? 0) / 5) * 8, 0, 32),
    1,
  );
  const needEntries = input.openNeeds.filter(
    (entry) =>
      entry.axis === candidateAxis ||
      entry.axis === playerRole ||
      (entry.axis === "roster" && input.budgetLane.lane !== "star" && input.budgetLane.lane !== "superstar"),
  );
  const needMatchScore = roundValue(needEntries.reduce((sum, entry) => sum + entry.importance * 12, 0), 1);
  const bestNeedDisciplineId = player ? getBestNeedDisciplineId(player, input.topNeedDisciplineIds) : null;
  const disciplineCoverageScore = roundValue(
    player && bestNeedDisciplineId
      ? ((player.disciplineRatings[bestNeedDisciplineId] ?? 0) / 100) * 12 + clamp((70 - (input.disciplinePeak.get(bestNeedDisciplineId) ?? 0)) / 10, 0, 6)
      : 0,
    1,
  );
  const strategyFitResult = player ? getStrategyMatchScore(input.profile, player) : { score: 0, reasons: ["Keine Spielerdaten."] };
  const identityBreakdown =
    player != null
      ? scoreTeamIdentityComponents({
          gameState: input.gameState,
          team: input.team,
          profile: input.profile,
          player,
          candidateAxis,
          playerRole,
          strategyFitResult,
          openNeeds: input.openNeeds,
          budgetLane: input.budgetLane,
        })
      : {
          teamAxisFitScore: 0,
          teamThemeFitScore: 0,
          classFitScore: 0,
          raceOrArchetypeFitScore: 0,
          harmonyPenalty: 0,
          ambitionLaneBias: 0,
          financeLaneBias: 0,
          teamIdentityScore: 0,
          reasons: ["Keine Spielerdaten."],
        };
  const teamIdentityScore = identityBreakdown.teamIdentityScore;
  const playerFormColor = player ? getPlayerClassColor(player) : CLASS_COLOR_BY_CLASS[normalizedClass] ?? null;
  const primaryColorHit = playerFormColor != null && input.seasonStrategy.formCardColorPlan.primaryFormColors.includes(playerFormColor);
  const secondaryColorHit = playerFormColor != null && input.seasonStrategy.formCardColorPlan.secondaryFormColors.includes(playerFormColor);
  const missingColorHit = playerFormColor != null && input.seasonStrategy.formCardColorPlan.missingFormColors.includes(playerFormColor);
  const formColorReason =
    missingColorHit
      ? `Fehlende Formkartenfarbe ${playerFormColor} wird geschlossen.`
      : primaryColorHit
        ? `Primäre Formkartenfarbe ${playerFormColor} wird gestärkt.`
        : secondaryColorHit
          ? `Sekundäre Formkartenfarbe ${playerFormColor} bringt Flexibilität.`
          : null;
  const pickedForFormColor = Boolean(formColorReason && (missingColorHit || input.seasonStrategy.formCardColorPlan.formColorFlexScore < 0.67));
  const formColorCoverageScore = roundValue(
    clamp(
      (missingColorHit ? 4.8 : 0) +
        (primaryColorHit ? 2.8 : 0) +
        (secondaryColorHit ? 1.6 : 0) +
        (playerFormColor != null &&
        input.seasonStrategy.formCardColorPlan.existingFormColors.length < 3 &&
        !input.seasonStrategy.formCardColorPlan.existingFormColors.includes(playerFormColor)
          ? 1.4
          : 0) -
        (playerFormColor == null && input.seasonStrategy.formCardColorPlan.missingFormColors.length > 0 ? 1 : 0),
      -2,
      8,
    ),
    1,
  );
  const formColorFlexScore = roundValue(
    clamp(
      input.seasonStrategy.formCardColorPlan.formColorFlexScore * 4 +
        (playerFormColor != null &&
        !input.seasonStrategy.formCardColorPlan.existingFormColors.includes(playerFormColor)
          ? 1.2
          : 0),
      0,
      6,
    ),
    1,
  );
  const classDisciplineFitScore = roundValue(
    candidateAxis && bestNeedDisciplineId && bestDisciplineEntry
      ? clamp(((player?.disciplineRatings?.[bestNeedDisciplineId] ?? 0) - (bestDisciplineEntry.score - 12)) / 8, -2, 5)
      : 0,
    1,
  );
  const axisCount = candidateAxis ? input.coveredAxisHits[candidateAxis] : 0;
  const classCount = input.classCounts.get(normalizedClass) ?? 0;
  const rosterBalanceScore = roundValue(
    candidateAxis
      ? clamp((2 - axisCount) * 2.4 + ((input.roleCounts.get(playerRole) ?? 0) === 0 ? 2.5 : 0), -4, 8)
      : 0,
    1,
  );
  const laneCap = input.budgetLane.spendCap;
  const price = input.recommendation.price ?? input.recommendation.marketValue ?? null;
  const phaseCap = resolvePhaseCap({
    lane: input.budgetLane.lane,
    pickPhase: input.pickPhase,
    lanePriceCap: input.budgetLane.priceCap,
    cashStrategy: input.cashStrategy,
    teamCashTier: input.teamCashTier,
    teamIdentityScore,
    needMatchScore,
  });
  const budgetStretch = getBudgetStretchEnvelope({
    lane: input.budgetLane.lane,
    pickPhase: input.pickPhase,
    price,
    lanePriceCap: phaseCap ?? input.budgetLane.priceCap,
    laneSpendCap: laneCap,
    remainingCash: input.remainingCash,
    cashStrategy: input.cashStrategy,
    teamIdentityScore,
    needMatchScore,
    minimumSlotsMissing: input.minimumSlotsMissing,
  });
  const capExceeded = price != null && phaseCap != null ? price > phaseCap + 0.01 : false;
  const capOverrideReason =
    capExceeded && budgetStretch.budgetStretchApplied
      ? budgetStretch.budgetStretchReason
      : capExceeded
        ? input.pickPhase === "identity_core" && teamIdentityScore >= 6
          ? "identity_fit_not_enough_for_cap"
          : input.pickPhase === "star_investment" && needMatchScore >= 5
            ? "star_window_still_too_expensive"
            : "phase_cap_exceeded"
        : null;
  const budgetFitScore =
    price != null && laneCap != null
      ? price <= laneCap
        ? 10 - clamp(price / Math.max(laneCap, 1), 0, 1) * 5
        : budgetStretch.budgetStretchApplied && budgetStretch.effectiveLaneSpendCap != null
          ? roundValue(
              -clamp(
                ((price - laneCap) / Math.max(budgetStretch.effectiveLaneSpendCap - laneCap, 1)) * 4 + 0.5,
                0.5,
                4.5,
              ),
              1,
            )
          : -14
      : 0;
  const laneNeedGatePenalty =
    needMatchScore < input.budgetLane.minNeedScore && !["cheap_fill", "backup", "depth"].includes(input.budgetLane.lane)
      ? -8
      : 0;
  const laneThemeGatePenalty =
    teamIdentityScore < input.budgetLane.minTeamFitScore && !["cheap_fill", "backup"].includes(input.budgetLane.lane)
      ? -10
      : 0;
  const phaseCapPenalty =
    capExceeded && !budgetStretch.budgetStretchApplied
      ? input.pickPhase === "minimum_skeleton"
        ? -22
        : input.pickPhase === "early_core" || input.pickPhase === "specialist_fill"
          ? -16
          : -10
      : 0;
  const valueScore =
    price != null && price > 0
      ? roundValue(
          clamp(
            (Math.max(0, needMatchScore) * 0.45 +
              Math.max(0, disciplineCoverageScore) * 0.75 +
              Math.max(0, teamIdentityScore) * 0.55 +
              Math.max(0, rosterBalanceScore) * 0.35) /
              Math.max(1, price * 0.22 + (input.recommendation.salary ?? 0) * 0.65),
            0,
            12,
          ),
          1,
        )
      : 0;
  const laneFitScore = roundValue(
    clamp(
      input.budgetLane.lane === "superstar"
        ? playerQualityScore * 0.32 + disciplineCoverageScore * 0.12 + (price != null && laneCap != null && price >= laneCap * 0.72 ? 4 : -3)
        : input.budgetLane.lane === "star"
          ? playerQualityScore * 0.22 + disciplineCoverageScore * 0.08 + (price != null && laneCap != null && price <= laneCap ? 2 : -2)
          : input.budgetLane.lane === "core"
            ? needMatchScore * 0.18 + rosterBalanceScore * 0.42 + valueScore * 0.24
            : input.budgetLane.lane === "specialist"
              ? disciplineCoverageScore * 0.55 + needMatchScore * 0.18 + teamIdentityScore * 0.08
              : input.budgetLane.lane === "cheap_fill"
                ? valueScore * 0.55 +
                  (cheapFillEligible ? 4 : -14) +
                  (input.minimumSlotsMissing > 0 && input.minimumReachableAfterPick ? 2 : 0) +
                  (input.cheaperMinimumSafeAlternativeAvailable ? -6 : 0)
                : input.budgetLane.lane === "backup"
                  ? valueScore * 0.24 + rosterBalanceScore * 0.18 + (price != null && laneCap != null && price <= laneCap ? 2 : -2)
                  : valueScore * 0.18 + rosterBalanceScore * 0.2,
      -8,
      12,
    ),
    1,
  );
  const remainingCash = input.remainingCash;
  const hardBudgetPenalty = price != null && remainingCash != null && price > remainingCash ? -30 : 0;
  const minimumReservePenalty =
    input.minimumSlotsMissing > 0 && !input.minimumReachableAfterPick
      ? -40
      : input.minimumSlotsMissing > 0 && input.cheaperMinimumSafeAlternativeAvailable
        ? -10
        : 0;
  const averageSkeletonBudget =
    input.minimumSlotsMissing > 0 && input.remainingCash != null
      ? roundValue(input.remainingCash / Math.max(input.minimumSlotsMissing, 1), 2)
      : null;
  const earlySkeletonCostPenalty =
    input.minimumSlotsMissing > 0 && price != null && averageSkeletonBudget != null
      ? input.budgetLane.lane === "cheap_fill" || input.budgetLane.lane === "backup"
        ? -clamp(((price / Math.max(averageSkeletonBudget, 1)) - 1) * 14, 0, 18)
        : input.budgetLane.lane === "core" || input.budgetLane.lane === "specialist"
          ? -clamp(((price / Math.max(averageSkeletonBudget * 1.5, 1)) - 1) * 8, 0, 12)
          : 0
      : 0;
  const harmonyFitScore = identityBreakdown.harmonyPenalty;
  const riskPenalty = roundValue(
    -clamp(
      (input.recommendation.riskNotes?.length ?? 0) * 2 +
        (price != null && remainingCash != null && price > remainingCash * 0.7 ? 2 : 0) +
        (input.budgetLane.lane === "cheap_fill" && rawTier.isStar ? 3 : 0),
      0,
      10,
    ),
    1,
  );
  const duplicateProfilePenalty = roundValue(-clamp(axisCount * 2.8 + classCount * 1.5, 0, 17), 1);
  const offThemePenalty = roundValue(
    -clamp(
      strategyFitResult.reasons.filter((entry) => entry.includes("vermeidete") || entry.includes("unerwuenschte") || entry.includes("Hard-No-Go")).length * 4 +
        (identityBreakdown.teamThemeFitScore <= -3 ? 3 : 0) +
        (identityBreakdown.classFitScore <= -3 ? 3 : 0) +
        (identityBreakdown.raceOrArchetypeFitScore <= -3 ? 3 : 0),
      0,
      18,
    ),
    1,
  );
  const spamSensitiveClass = normalizedClass === "berserker" || normalizedClass === "warlord";
  const profileExplicitlyWantsClass = Boolean(
    input.profile?.preferredClasses.some((entry) => normalizeToken(entry) === normalizedClass),
  );
  const classSpamPenalty = roundValue(
    -clamp(
      classCount >= 1
        ? classCount * (spamSensitiveClass && !profileExplicitlyWantsClass ? 9 : 5)
        : 0,
      0,
      28,
    ),
    1,
  );

  const reasons = [
    input.recommendation.reason,
    ...needEntries.slice(0, 2).map((entry) => `${entry.label} wird adressiert.`),
    ...identityBreakdown.reasons,
    formColorReason ?? "",
    input.recommendation.fitSummary,
    input.budgetLane.reason,
    input.minimumSlotsMissing > 0
      ? input.minimumReachableAfterPick
        ? `Minimum bleibt nach dem Pick erreichbar (${formatLaneReserve(input.minimumReserveAfterPick)} Reserve bleibt offen).`
        : "Dieser Pick wuerde das Minimum-Roster gefaehrden."
      : "",
    budgetStretch.budgetStretchApplied && price != null && laneCap != null
      ? `Leichter Budget-Stretch erlaubt: ${roundValue(price - laneCap, 2)} ueber Lane-Budget, aber Cash bleibt positiv und Teamfit ist stark.`
      : "",
  ].filter((entry) => entry && entry.trim().length > 0);

  const strategicException =
    offThemePenalty <= -4 &&
    (needMatchScore >= input.budgetLane.minNeedScore + 1 ||
      disciplineCoverageScore >= 5.5 ||
      formColorCoverageScore >= 3 ||
      rosterBalanceScore >= 4);
  const strategicExceptionReason = strategicException
    ? formColorCoverageScore >= 3
      ? "picked_for_form_color_flex"
      : disciplineCoverageScore >= 5.5
        ? "specialist_need_overrides_theme_softly"
        : needMatchScore >= input.budgetLane.minNeedScore + 1
          ? "hard_need_overrides_theme_softly"
          : rosterBalanceScore >= 4
            ? "picked_for_roster_balance"
            : "value_pick_despite_theme_risk"
    : null;
  const focusTeamFit =
    player != null
      ? scoreV4FocusTeamFit({
          team: input.team,
          player,
          candidateAxis,
          pickPhase: input.pickPhase,
          budgetLane: input.budgetLane,
          price,
          laneCap,
          needMatchScore,
          teamIdentityScore,
          strategicException,
        })
      : { fitScore: 0, status: "ok" as const, reason: null, metrics: {}, reasons: [] };
  const adjustedTeamIdentityScore = roundValue(teamIdentityScore + focusTeamFit.fitScore, 1);
  const mercenaryNegativeFitPenalty = getMercenaryNegativeFitPenalty({
    teamId: input.team.teamId,
    teamName: input.team.name,
    isMercenary:
      player != null
        ? hasMercenaryTrait({
            traitsPositive: player.traitsPositive ?? [],
            traitsNegative: player.traitsNegative ?? [],
          })
        : false,
    teamFit: adjustedTeamIdentityScore,
  });
  const mustFeelRightStatus: AiNeedsPicksCandidateScore["mustFeelRightStatus"] =
    adjustedTeamIdentityScore >= 8
      ? "strong_fit"
      : adjustedTeamIdentityScore >= 2 || strategicException
        ? "on_plan"
        : offThemePenalty <= -4
          ? "risky_but_allowed"
          : "warning";
  if (strategicException && strategicExceptionReason) {
    reasons.push(strategicExceptionReason);
  }
  reasons.push(...focusTeamFit.reasons);
  if (mercenaryNegativeFitPenalty < 0) {
    reasons.push(MERCENARY_NEGATIVE_FIT_PENALTY_REASON);
  }

  const finalScoreBeforeMercenaryPenalty =
    playerQualityScore +
    needMatchScore +
    disciplineCoverageScore +
    adjustedTeamIdentityScore +
    formColorCoverageScore +
    formColorFlexScore +
    classDisciplineFitScore +
    rosterBalanceScore +
    budgetFitScore +
    laneFitScore +
    identityBreakdown.ambitionLaneBias +
    identityBreakdown.financeLaneBias +
    valueScore +
    harmonyFitScore +
    hardBudgetPenalty +
    minimumReservePenalty +
    laneNeedGatePenalty +
    laneThemeGatePenalty +
    phaseCapPenalty +
    riskPenalty +
    earlySkeletonCostPenalty +
    duplicateProfilePenalty +
    offThemePenalty +
    classSpamPenalty;
  const finalScore = applyMercenaryNegativeFitPenaltyToFinalPickScore({
    finalPickScoreBeforePenalty: finalScoreBeforeMercenaryPenalty,
    mercenaryNegativeFitPenalty,
  });

  return {
    candidateId: input.recommendation.playerId,
    playerId: input.recommendation.playerId,
    playerName: input.recommendation.playerName,
    className: input.recommendation.className,
    race: input.recommendation.race,
    price,
    salary: input.recommendation.salary ?? null,
    ovr: input.recommendation.ovr ?? null,
    mvs: input.recommendation.mvs ?? null,
    candidateAxis,
    bestNeedDisciplineId,
    formColor: playerFormColor,
    pickedForFormColor,
    formColorReason,
    strategicException,
    strategicExceptionReason,
    minimumReachableAfterPick: input.minimumReachableAfterPick,
    mustFeelRightStatus,
    focusTeamStatus: focusTeamFit.status,
    focusTeamReason: focusTeamFit.reason,
    focusTeamFitScore: focusTeamFit.fitScore,
    focusTeamMetrics: focusTeamFit.metrics,
    budgetStretchApplied: budgetStretch.budgetStretchApplied,
    effectiveLanePriceCap: budgetStretch.effectiveLanePriceCap,
    effectiveLaneSpendCap: budgetStretch.effectiveLaneSpendCap,
    pickPhase: input.pickPhase,
    teamCashTier: input.teamCashTier,
    phaseCap,
    capExceeded,
    capOverrideReason,
    budgetStretchReason: budgetStretch.budgetStretchReason,
    budgetStretchPhaseAllowed: budgetStretch.budgetStretchPhaseAllowed,
    budgetStretchBlockedReason: budgetStretch.budgetStretchBlockedReason,
    finalScore,
    scoreBreakdown: {
      playerQualityScore,
      needMatchScore,
      disciplineCoverageScore,
      teamAxisFitScore: identityBreakdown.teamAxisFitScore,
      teamThemeFitScore: identityBreakdown.teamThemeFitScore,
      classFitScore: identityBreakdown.classFitScore,
      raceOrArchetypeFitScore: identityBreakdown.raceOrArchetypeFitScore,
      teamIdentityScore: adjustedTeamIdentityScore,
      formColorCoverageScore,
      formColorFlexScore,
      classDisciplineFitScore,
      rosterBalanceScore,
      budgetFitScore: roundValue(
        budgetFitScore +
          identityBreakdown.ambitionLaneBias +
          identityBreakdown.financeLaneBias +
          hardBudgetPenalty +
          minimumReservePenalty +
          earlySkeletonCostPenalty +
          laneNeedGatePenalty +
          laneThemeGatePenalty,
        1,
      ),
      laneFitScore,
      valueScore,
      harmonyFitScore,
      harmonyPenalty: identityBreakdown.harmonyPenalty,
      riskPenalty,
      duplicateProfilePenalty,
      offThemePenalty,
      classSpamPenalty,
      mercenaryNegativeFitPenalty,
    },
    reasons: Array.from(new Set(reasons)),
  } satisfies AiNeedsPicksCandidateScore;
}

function getTeamFitBand(score: number) {
  if (score >= 8) return "strong";
  if (score >= 3) return "good";
  if (score >= -1) return "acceptable";
  return "risky";
}

function isSameClassFamily(leftClass: string | null | undefined, rightClass: string | null | undefined) {
  const leftColor = CLASS_COLOR_BY_CLASS[normalizeToken(leftClass)];
  const rightColor = CLASS_COLOR_BY_CLASS[normalizeToken(rightClass)];
  return leftColor != null && rightColor != null && leftColor === rightColor;
}

async function resolveCompareContext(params: AiNeedsPicksCompareParams): Promise<ResolvedCompareContext> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";

  if (source === "prisma") {
    const snapshot = await loadFoundationSnapshotFromPrisma(params.saveId ?? undefined);
    if (!snapshot) {
      throw new Error("Prisma foundation snapshot could not be loaded.");
    }

    const projected = projectFoundationStateFromPrisma(snapshot);
    return {
      source,
      saveId: projected.save.saveId,
      seasonId: projected.save.gameState.season.id,
      gameState: normalizeGameState(projected.save.gameState),
    };
  }

  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = params.saveId ? persistence.getSaveById(params.saveId) : null;
  if (params.saveId && !requestedSave) {
    throw new Error(`Requested save ${params.saveId} could not be resolved for AI needs/picks compare.`);
  }
  const save = requestedSave ?? persistence.getActiveSave() ?? bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return {
    source,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    gameState: normalizeGameState(save.gameState),
  };
}

async function getRetoolReferenceStatus() {
  const foundFiles: string[] = [];
  for (const file of RETOOL_REFERENCE_FILES) {
    try {
      await access(file);
      foundFiles.push(file);
    } catch {
      // keep missing silent, the team-level warning explains it
    }
  }

  return {
    sourceFiles: foundFiles,
    topPicksAvailable: false,
    warnings:
      foundFiles.length > 0
        ? [
            "Retool-Logikdateien sind vorhanden, aber es gibt keine eingefrorenen teambezogenen Top-Pick-Zeilen fuer den aktuellen Save.",
          ]
        : ["Retool-Golden-Master-Dateien konnten nicht belastbar gelesen werden."],
  };
}

async function getPrizeSignalByTeamId(context: ResolvedCompareContext) {
  try {
    const preview = await buildPrizeMoneyPreview(
      {
        saveId: context.saveId,
        seasonId: context.seasonId,
        source: "sqlite",
        phase: "season_end",
      },
      createPersistenceService(),
    );
    const map = new Map<string, ComparePrizeSignal>();
    for (const item of preview.items) {
      map.set(item.teamId, toComparePrizeSignal(item, preview.flowPolicy));
    }
    return map;
  } catch {
    return new Map<string, ComparePrizeSignal>();
  }
}

function toComparePrizeSignal(
  item: PrizeMoneyPreviewItem | null,
  flowPolicy: "season_end_only" | "missing_source" = "season_end_only",
): ComparePrizeSignal {
  if (!item) {
    return {
      expectedPrizeCurrentSeason: null,
      expectedPrizeNextSeason1: null,
      expectedPrizeNextSeason2: null,
      expectedPrizeNextSeason3: null,
      expectedPrizeNextSeason4: null,
      expectedPrizeFiveSeasonSum: null,
      expectedGuvCurrentSeason: null,
      expectedGuvFiveSeasonSum: null,
      expectedProjectedCashAfterFiveSeasons: null,
      expectedPrizeTrend: "unknown",
      prizeConfidence: "missing_source",
      prizeSourceStatus: "missing_source",
      flowPolicy: "missing_source",
      warnings: ["expected_prize_source_missing"],
    };
  }

  const future = item.futureSeasons.slice(0, 4);
  const futureValues = future.map((entry) => entry.prizeMoney);
  const currentGuv =
    item.prizeMoney != null && item.salaryTotal != null ? roundValue(item.prizeMoney - item.salaryTotal, 2) : null;
  const futureGuvValues = future.map((entry) => entry.guv);
  const guvValues = [currentGuv, ...futureGuvValues].filter((value): value is number => value != null);
  const expectedProjectedCashAfterFiveSeasons =
    item.currentCash != null && guvValues.length > 0
      ? roundValue(item.currentCash + guvValues.reduce((sum, value) => sum + value, 0), 2)
      : item.projectedCash ?? future.map((entry) => entry.projectedCash).find((value) => value != null) ?? null;
  const firstKnown = futureValues.find((value) => value != null) ?? item.prizeMoney;
  const lastKnown = [...futureValues].reverse().find((value) => value != null) ?? item.prizeMoney;
  const comparableValues = [item.prizeMoney, ...futureValues].filter((value): value is number => value != null);
  const delta = firstKnown != null && lastKnown != null ? lastKnown - firstKnown : null;
  let expectedPrizeTrend: ComparePrizeSignal["expectedPrizeTrend"] = "unknown";
  if (delta != null) {
    if (Math.abs(delta) <= 2.5) {
      expectedPrizeTrend = "flat";
    } else if (delta > 0) {
      expectedPrizeTrend = "up";
    } else {
      expectedPrizeTrend = "down";
    }
  }
  if (futureValues.filter((value) => value != null).length >= 3) {
    const numeric = futureValues.filter((value): value is number => value != null);
    const max = Math.max(...numeric);
    const min = Math.min(...numeric);
    if (max - min > 12) {
      expectedPrizeTrend = "volatile";
    }
  }

  const expectedPrizeFiveSeasonSum =
    comparableValues.length > 0 ? roundValue(comparableValues.reduce((sum, value) => sum + value, 0), 2) : null;
  const expectedGuvFiveSeasonSum = guvValues.length > 0 ? roundValue(guvValues.reduce((sum, value) => sum + value, 0), 2) : null;
  const hasCurrent = item.prizeMoney != null;
  const futureKnown = futureValues.filter((value) => value != null).length;
  const prizeSourceStatus: ComparePrizeSignal["prizeSourceStatus"] =
    hasCurrent && futureKnown >= 4 ? "ready" : hasCurrent || futureKnown > 0 ? "partial" : "missing_source";

  return {
    expectedPrizeCurrentSeason: item.prizeMoney,
    expectedPrizeNextSeason1: future[0]?.prizeMoney ?? null,
    expectedPrizeNextSeason2: future[1]?.prizeMoney ?? null,
    expectedPrizeNextSeason3: future[2]?.prizeMoney ?? null,
    expectedPrizeNextSeason4: future[3]?.prizeMoney ?? null,
    expectedPrizeFiveSeasonSum,
    expectedGuvCurrentSeason: currentGuv,
    expectedGuvFiveSeasonSum,
    expectedProjectedCashAfterFiveSeasons,
    expectedPrizeTrend,
    prizeConfidence: prizeSourceStatus,
    prizeSourceStatus,
    flowPolicy,
    warnings:
      prizeSourceStatus === "missing_source"
        ? ["expected_prize_source_missing"]
        : item.warnings.filter((warning) => warning.startsWith("missing_")),
  };
}

function buildFinancePosture(input: {
  currentCash: number | null;
  startingCash: number | null;
  financesValue01: number;
  ambitionValue01: number;
  boardPressureValue01: number;
  harmonyValue01: number;
  rosterPressure: number;
  needPressure: number;
  minCashBuffer: number | null;
  allowedBudgetForSearch: number | null;
  expectedPrizeSignal: ComparePrizeSignal;
}) {
  const cashRatio =
    input.currentCash != null && input.startingCash != null && input.startingCash > 0
      ? input.currentCash / input.startingCash
      : null;
  const bufferStress =
    input.currentCash != null && input.minCashBuffer != null && input.minCashBuffer > 0
      ? clamp((input.minCashBuffer - input.currentCash) / input.minCashBuffer, 0, 1)
      : 0;
  const prizeSupport =
    input.expectedPrizeSignal.prizeSourceStatus === "ready" || input.expectedPrizeSignal.prizeSourceStatus === "partial"
      ? input.expectedPrizeSignal.expectedPrizeTrend === "up"
        ? 0.12
        : input.expectedPrizeSignal.expectedPrizeTrend === "down"
          ? -0.12
          : input.expectedPrizeSignal.expectedPrizeTrend === "volatile"
            ? -0.04
            : 0
      : 0;
  const cautionScore = 0.4 * input.financesValue01 + 0.25 * input.harmonyValue01 + 0.2 * bufferStress + 0.15 * Math.max(-(prizeSupport ?? 0), 0);
  const attackScore = 0.36 * input.ambitionValue01 + 0.24 * input.boardPressureValue01 + 0.24 * input.rosterPressure + 0.16 * input.needPressure + Math.max(prizeSupport, 0);

  if (input.currentCash != null && input.minCashBuffer != null && input.currentCash < input.minCashBuffer && input.rosterPressure >= 0.45) {
    return "cash_poor_forced_fill" as const;
  }
  if (input.rosterPressure >= 0.72 || bufferStress >= 0.68) {
    return "desperate" as const;
  }
  if ((cashRatio ?? 0) >= 0.78 && cautionScore >= attackScore + 0.08) {
    return "cash_rich_but_cautious" as const;
  }
  if (input.needPressure <= 0.34 && input.financesValue01 >= 0.62 && input.allowedBudgetForSearch != null && input.allowedBudgetForSearch <= 0.8 * (input.currentCash ?? input.allowedBudgetForSearch)) {
    return "value_hunter" as const;
  }
  if (attackScore >= cautionScore + 0.12) {
    return "aggressive" as const;
  }
  if (cautionScore >= attackScore + 0.12) {
    return "conservative" as const;
  }
  return "balanced" as const;
}

function buildTeamEntry(input: {
  context: ResolvedCompareContext;
  previewTeam: Awaited<ReturnType<typeof buildAiTransfermarktPreview>>["teams"][number];
  steps: number;
  retoolReferenceStatus: Awaited<ReturnType<typeof getRetoolReferenceStatus>>;
  prizeSignalByTeamId: Map<string, ComparePrizeSignal>;
  excludedPlayerIds?: string[];
  runMode: AiNeedsPicksRunMode;
  draftSeed?: string | null;
}): AiNeedsPicksCompareTeamEntry | null {
  const team = input.context.gameState.teams.find((entry) => entry.teamId === input.previewTeam.teamId) ?? null;
  if (!team) {
    return null;
  }
  const season1OptimumMode = input.runMode === "season1_optimum_execute";

  const profile = getTeamStrategyProfile(input.context.gameState, team.teamId);
  const identity = getTeamIdentityRow(input.context.gameState, team.teamId);
  const rosterTargets = deriveRosterTargets(team, identity);
  const needs = evaluateAiNeeds(input.context.gameState, team.teamId);
  const rosterComposition = buildRosterComposition(input.context.gameState, team.teamId);
  const rosterEntries = getRosterEntriesForTeam(input.context.gameState, team.teamId);
  const rosterCount = input.previewTeam.rosterCount ?? input.previewTeam.rosterSize ?? rosterEntries.length ?? null;
  const targetRosterSize = rosterTargets.playerOpt;
  const playerMin = rosterTargets.playerMin;
  const targetRosterGap =
    rosterCount != null && targetRosterSize != null ? Math.max(targetRosterSize - rosterCount, 0) : null;
  const baseAxisDeficits = {
    pow: needs.axisDeficits.pow,
    spe: needs.axisDeficits.spe,
    men: needs.axisDeficits.men,
    soc: needs.axisDeficits.soc,
  };
  const warnings = [...input.retoolReferenceStatus.warnings];
  const coveredAxisHits = { pow: 0, spe: 0, men: 0, soc: 0 };
  const simulatedClassCounts = new Map(rosterComposition.classCounts);
  const simulatedRoleCounts = new Map(rosterComposition.roleCounts);
  const simulatedDisciplinePeak = new Map(rosterComposition.disciplinePeak);
  const simulatedRosterPlayers = [...rosterComposition.rosterPlayers];
  const pickedPlayerIds: string[] = [];
  const plannedPicks: AiNeedsPicksPlannedPick[] = [];
  const sequentialStateSnapshots: AiNeedsPicksSequentialStateSnapshot[] = [];
  let remainingCash = input.previewTeam.cash ?? team.cash ?? null;
  let remainingSalary = input.previewTeam.salaryTotal ?? input.previewTeam.salary ?? null;
  let simulatedRosterCount: number | null = rosterCount ?? null;

  const initialOpenNeeds = buildOpenNeeds({
    rosterGap: targetRosterGap ?? 0,
    baseAxisDeficits,
    coveredAxisHits,
    roleCounts: rosterComposition.roleCounts,
    disciplinePeak: rosterComposition.disciplinePeak,
    topNeedDisciplineIds: needs.topNeedDisciplineIds,
  });

  const candidatePoolSource =
    input.previewTeam.legalCandidatePool && input.previewTeam.legalCandidatePool.length > 0
      ? ("legal_candidate_pool" as const)
      : input.previewTeam.topTargets.length > 0
        ? ("top_targets" as const)
        : ("recommended_buys" as const);
  const compareCandidatesRaw =
    candidatePoolSource === "legal_candidate_pool"
      ? input.previewTeam.legalCandidatePool ?? []
      : candidatePoolSource === "top_targets"
        ? input.previewTeam.topTargets
        : input.previewTeam.recommendedBuys;
  const globallyExcluded = new Set(input.excludedPlayerIds ?? []);
  const compareCandidates = compareCandidatesRaw.filter((entry) => {
    const price = entry.price ?? entry.marketValue ?? null;
    return !globallyExcluded.has(entry.playerId) && (price == null || price >= 0);
  });
  const anchors = buildLaneMarketAnchors(compareCandidates);
  const minimumReservePool = buildMinimumReservePool(compareCandidates, anchors);

  const maxSteps = Math.min(
    Math.max(input.steps, 1),
    Math.max(compareCandidates.length, 1),
    Math.max(targetRosterGap ?? 1, 1),
    16,
  );
  const planner = buildPickPlanner({
    gameState: input.context.gameState,
    team,
    rosterCount: rosterCount ?? rosterEntries.length,
    targetRosterSize,
    playerMin,
    roleCounts: rosterComposition.roleCounts,
    openNeeds: initialOpenNeeds,
    compareCandidates,
    steps: maxSteps,
    runMode: input.runMode,
    draftSeed: input.draftSeed ?? null,
  });
  const expectedPrizeSignal =
    input.prizeSignalByTeamId.get(team.teamId) ??
    toComparePrizeSignal(null, "missing_source");
  const cashStrategy = buildCashStrategy({
    team,
    identity,
    profile,
    planner,
    anchors,
    rosterCount: rosterCount ?? rosterEntries.length,
    targetRosterSize,
    playerMin,
    expectedPrizeSignal,
    runMode: input.runMode,
  });
  const budgetLanes = buildBudgetLanes({
    cash: input.previewTeam.cash ?? team.cash ?? null,
    planner,
    cashStrategy,
    profile,
    rosterGap: targetRosterGap ?? 0,
    anchors,
    runMode: input.runMode,
  });
  const cashStrategyWithLanes: AiNeedsPicksCashStrategy = {
    ...cashStrategy,
    maxSpendByLane: budgetLanes.reduce(
      (acc, lane) => {
        acc[lane.lane] = lane.priceCap;
        return acc;
      },
      {
        cheap_fill: null,
        backup: null,
        depth: null,
        specialist: null,
        core: null,
        star: null,
        superstar: null,
      } as Record<AiNeedsPickLane, number | null>,
    ),
    spendArchitecture: {
      ...cashStrategy.spendArchitecture,
      maxSpendByLane: budgetLanes.reduce(
        (acc, lane) => {
          acc[lane.lane] = lane.priceCap;
          return acc;
        },
        {
          cheap_fill: null,
          backup: null,
          depth: null,
          specialist: null,
          core: null,
          star: null,
          superstar: null,
        } as Record<AiNeedsPickLane, number | null>,
      ),
    },
  };
  const teamCashTier = resolveTeamCashTier(cashStrategyWithLanes);
  warnings.push(...planner.warnings, ...cashStrategyWithLanes.warnings);
  let seasonPlanning = buildTeamSeasonStrategy({
    gameState: input.context.gameState,
    team,
    profile,
    identity,
    rosterComposition,
    openNeeds: initialOpenNeeds,
    planner,
    cashStrategy: cashStrategyWithLanes,
    targetRosterSize,
    playerMin,
    topNeedDisciplineIds: needs.topNeedDisciplineIds,
  });

  const initiallyScoredCandidates = compareCandidates
    .map((entry) =>
      scoreCandidate({
        recommendation: entry,
        gameState: input.context.gameState,
        team,
        player: getPlayerById(input.context.gameState, entry.playerId),
        openNeeds: initialOpenNeeds,
        budgetLane: budgetLanes.find((lane) => lane.lane === "core") ?? budgetLanes[0],
        profile,
        topNeedDisciplineIds: needs.topNeedDisciplineIds,
        remainingCash,
        minimumSlotsMissing: Math.max(playerMin - (rosterCount ?? rosterEntries.length), 0),
        minimumReserveAfterPick: planner.reservedCashForMinimum,
        minimumReachableAfterPick: planner.minimumReachable,
        cheaperMinimumSafeAlternativeAvailable: false,
        anchors,
          coveredAxisHits,
          classCounts: rosterComposition.classCounts,
          roleCounts: rosterComposition.roleCounts,
          disciplinePeak: rosterComposition.disciplinePeak,
          cashStrategy: cashStrategyWithLanes,
          seasonStrategy: seasonPlanning.seasonStrategy,
          pickPhase: "minimum_skeleton",
          teamCashTier,
        }),
      )
      .sort((left, right) => right.finalScore - left.finalScore);
  const initialIdentityFilter = filterIdentityEligibleCandidates({
    gameState: input.context.gameState,
    team,
    profile,
    candidates: initiallyScoredCandidates,
    preserveMinimumPool: true,
  });
  if (initialIdentityFilter.usedFallback) {
    warnings.push(
      `Identity-Fallback im Kandidatenpool aktiv (${initialIdentityFilter.fallbackReason ?? "identity_fallback"}).`,
    );
  }
  const topCandidatePool = buildDiverseCandidatePool(
    initialIdentityFilter.candidates.sort((left, right) => right.finalScore - left.finalScore),
    16,
    2,
  );
  const laneState = new Map<AiNeedsPickLane, { spendUsed: number; remainingSlots: number }>(
    budgetLanes.map((lane) => [lane.lane, { spendUsed: 0, remainingSlots: lane.remainingSlots }]),
  );

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const rosterGap = targetRosterSize != null && simulatedRosterCount != null ? Math.max(targetRosterSize - simulatedRosterCount, 0) : 0;
    const openNeeds = buildOpenNeeds({
      rosterGap,
      baseAxisDeficits,
      coveredAxisHits,
      roleCounts: simulatedRoleCounts,
      disciplinePeak: rosterComposition.disciplinePeak,
      topNeedDisciplineIds: needs.topNeedDisciplineIds,
    });
    const minimumSlotsBefore = Math.max(playerMin - (simulatedRosterCount ?? 0), 0);
    const minimumSecured = minimumSlotsBefore <= 0;
    const reserveSecured =
      cashStrategyWithLanes.minCashBuffer == null ||
      remainingCash == null ||
      remainingCash >= cashStrategyWithLanes.minCashBuffer - 0.01;
    seasonPlanning = buildTeamSeasonStrategy({
      gameState: input.context.gameState,
      team,
      profile,
      identity,
      rosterComposition: {
        rosterPlayers: simulatedRosterPlayers,
        axisCounts: {
          pow: rosterComposition.axisCounts.pow + coveredAxisHits.pow,
          spe: rosterComposition.axisCounts.spe + coveredAxisHits.spe,
          men: rosterComposition.axisCounts.men + coveredAxisHits.men,
          soc: rosterComposition.axisCounts.soc + coveredAxisHits.soc,
        },
        classCounts: simulatedClassCounts,
        raceCounts: rosterComposition.raceCounts,
        roleCounts: simulatedRoleCounts,
        disciplinePeak: simulatedDisciplinePeak,
      },
      openNeeds,
      planner,
      cashStrategy: cashStrategyWithLanes,
      targetRosterSize,
      playerMin,
      topNeedDisciplineIds: needs.topNeedDisciplineIds,
    });
    const laneName = chooseLane({
      step: stepIndex,
      planner,
      budgetLanes,
      minimumSlotsBefore,
      openNeeds,
    });
    const lane = budgetLanes.find((entry) => entry.lane === laneName) ?? budgetLanes[0];
    const pickPhase = resolvePickPhase({
      lane: lane.lane,
      step: stepIndex,
      minimumSlotsBefore,
      reserveSecured,
      rosterCount: simulatedRosterCount,
      targetRosterSize,
    });
    const minimumReserveBefore = getMinimumReserveFromPool({
      pool: minimumReservePool,
      missingSlots: minimumSlotsBefore,
      excludedPlayerIds: pickedPlayerIds,
    });
    const targetSlotsBefore =
      season1OptimumMode && targetRosterSize != null && simulatedRosterCount != null
        ? Math.max(targetRosterSize - simulatedRosterCount, 0)
        : 0;
    const minimumAcceptedRosterTarget =
      season1OptimumMode && targetRosterSize != null
        ? Math.max(playerMin, targetRosterSize - 2)
        : playerMin;
    const mustContinueTowardOptimum =
      season1OptimumMode &&
      minimumSecured &&
      simulatedRosterCount != null &&
      simulatedRosterCount < minimumAcceptedRosterTarget;
    const candidateEvaluations = compareCandidates
      .filter((entry) => !pickedPlayerIds.includes(entry.playerId))
      .map((entry) => {
        const player = getPlayerById(input.context.gameState, entry.playerId);
        const price = entry.price ?? entry.marketValue ?? null;
        const cashAfter = remainingCash != null && price != null ? roundValue(remainingCash - price, 2) : remainingCash;
        const minimumSlotsAfter = Math.max(playerMin - ((simulatedRosterCount ?? 0) + 1), 0);
        const targetSlotsAfter =
          season1OptimumMode && targetRosterSize != null && simulatedRosterCount != null
            ? Math.max(targetRosterSize - (simulatedRosterCount + 1), 0)
            : 0;
        const reserveAfter = getMinimumReserveFromPool({
          pool: minimumReservePool,
          missingSlots: minimumSlotsAfter,
          excludedPlayerIds: pickedPlayerIds,
          additionalExcludedPlayerId: entry.playerId,
        });
        const targetReserveAfter = getTargetReserveFromPool({
          pool: minimumReservePool,
          missingSlots: targetSlotsAfter,
          excludedPlayerIds: pickedPlayerIds,
          additionalExcludedPlayerId: entry.playerId,
        });
        const minimumReachableAfterPick =
          minimumSlotsAfter <= 0
            ? true
            : reserveAfter.reachable &&
              reserveAfter.reservedCash != null &&
              cashAfter != null &&
              cashAfter >= reserveAfter.reservedCash;
        const targetReachableAfterPick =
          targetSlotsAfter <= 0
            ? true
            : targetReserveAfter.reachable &&
              targetReserveAfter.reservedCash != null &&
              cashAfter != null &&
              cashAfter >= targetReserveAfter.reservedCash;
        return {
          entry,
          player,
          price,
          minimumSlotsAfter,
          reserveAfter,
          targetSlotsAfter,
          targetReserveAfter,
          minimumReachableAfterPick,
          targetReachableAfterPick,
        };
      });
    const minimumSafeCandidateEvaluations =
      season1OptimumMode && minimumSlotsBefore > 0
        ? candidateEvaluations.filter((entry) => entry.minimumReachableAfterPick)
        : candidateEvaluations;
    if (season1OptimumMode && minimumSlotsBefore > 0 && candidateEvaluations.length > 0 && minimumSafeCandidateEvaluations.length === 0) {
      warnings.push(`Schritt ${stepIndex + 1}: minimum_future_cash_guard_no_safe_candidate`);
    }
    const targetSafeCandidateEvaluations =
      season1OptimumMode && targetSlotsBefore > 1 && minimumSafeCandidateEvaluations.some((entry) => entry.targetReachableAfterPick)
        ? minimumSafeCandidateEvaluations.filter((entry) => entry.targetReachableAfterPick)
        : minimumSafeCandidateEvaluations;
    if (
      season1OptimumMode &&
      targetSlotsBefore > 1 &&
      minimumSafeCandidateEvaluations.length > 0 &&
      !minimumSafeCandidateEvaluations.some((entry) => entry.targetReachableAfterPick)
    ) {
      warnings.push(`Schritt ${stepIndex + 1}: Target-Kader nicht mehr sauber finanzierbar, fallback auf Minimum-Sicherheit.`);
    }
    const safeCandidateEvaluations = targetSafeCandidateEvaluations;
    const affordableCandidateEvaluations = safeCandidateEvaluations.filter(
      (evaluation) => canAffordWithoutNegativeCash(evaluation.price, remainingCash),
    );
    const gatedCandidateEvaluations =
      remainingCash == null
        ? safeCandidateEvaluations
        : affordableCandidateEvaluations.length > 0
          ? affordableCandidateEvaluations
          : [];
    const plannerEligibleCandidateEvaluations = gatedCandidateEvaluations.filter((evaluation) =>
      isAiPlannerCandidateEligible({
        team,
        recommendation: evaluation.entry,
        player: evaluation.player,
        rosterPlayers: simulatedRosterPlayers,
        openNeeds,
        budgetLane: lane,
        pickPhase,
        price: evaluation.price,
        remainingCash,
        minimumSlotsBefore,
        minimumReachableAfterPick: evaluation.minimumReachableAfterPick,
        targetSlotsBefore,
        targetReachableAfterPick: evaluation.targetReachableAfterPick,
        topNeedDisciplineIds: needs.topNeedDisciplineIds,
        classCounts: simulatedClassCounts,
        profile,
      }),
    );
    const scoreCandidateEvaluations =
      plannerEligibleCandidateEvaluations.length > 0
        ? plannerEligibleCandidateEvaluations
        : gatedCandidateEvaluations;
    const scoredBase = scoreCandidateEvaluations
      .map((evaluation) =>
        {
          const scoredCandidate = scoreCandidate({
          recommendation: evaluation.entry,
          gameState: input.context.gameState,
          team,
          player: evaluation.player,
          openNeeds,
          budgetLane: lane,
          profile,
          topNeedDisciplineIds: needs.topNeedDisciplineIds,
          remainingCash,
          minimumSlotsMissing: minimumSlotsBefore,
          minimumReserveAfterPick: evaluation.reserveAfter.reservedCash,
          minimumReachableAfterPick: evaluation.minimumReachableAfterPick,
          cheaperMinimumSafeAlternativeAvailable: false,
          anchors,
          coveredAxisHits,
          classCounts: simulatedClassCounts,
          roleCounts: simulatedRoleCounts,
          disciplinePeak: simulatedDisciplinePeak,
          cashStrategy: cashStrategyWithLanes,
          seasonStrategy: seasonPlanning.seasonStrategy,
          pickPhase,
          teamCashTier,
          });
          const optimumDepthBonus = getSeason1OptimumDepthPressureBonus({
            candidate: scoredCandidate,
            targetSlotsBefore,
            mustContinueTowardOptimum,
          });
          return optimumDepthBonus > 0
            ? {
                ...scoredCandidate,
                finalScore: roundValue(scoredCandidate.finalScore + optimumDepthBonus, 2),
                reasons: [...scoredCandidate.reasons, `optimum_depth_pressure:+${optimumDepthBonus}`],
              }
            : scoredCandidate;
        },
      )
      .sort((left, right) => right.finalScore - left.finalScore);
    const scored = applyDraftSeedCandidateVariation({
      candidates: scoredBase,
      draftSeed: input.draftSeed ?? null,
      teamCode: normalizeTeamCode(team.shortCode || team.teamId),
      stepIndex,
    });
    const identityFiltered = filterIdentityEligibleCandidates({
      gameState: input.context.gameState,
      team,
      profile,
      candidates: scored,
      preserveMinimumPool: minimumSlotsBefore > 0,
    });
    const rankedScoredCandidates = identityFiltered.candidates.sort((left, right) => right.finalScore - left.finalScore);
    const earlyPhaseStrict =
      pickPhase === "minimum_skeleton" || pickPhase === "early_core" || pickPhase === "specialist_fill";
    const phaseCapEligibleCandidates = rankedScoredCandidates.filter(
      (entry) => !entry.capExceeded || entry.budgetStretchApplied,
    );
    const rankedPhaseCandidates =
      earlyPhaseStrict && phaseCapEligibleCandidates.length > 0 ? phaseCapEligibleCandidates : rankedScoredCandidates;
    const rankedTargetAwareCandidatesRaw =
      season1OptimumMode && minimumSlotsBefore > 0
        ? getSeason1MinimumTargetAwareCandidates({
            candidates: rankedPhaseCandidates,
            cashStrategy: cashStrategyWithLanes,
            remainingCash,
            simulatedRosterCount,
            targetRosterSize,
            minimumSlotsBefore,
          })
        : rankedPhaseCandidates;
    const rankedTargetAwareCandidates =
      season1OptimumMode && minimumSlotsBefore > 0
        ? rankedTargetAwareCandidatesRaw.filter((candidate) =>
            isSeason1MinimumIdentityAcceptable(team, candidate) ||
            isSeason1MinimumDepthAcceptable(team, candidate),
          )
        : rankedTargetAwareCandidatesRaw;
    const postMinimumQualityCandidates =
      minimumSecured ? rankedTargetAwareCandidates.filter(isPostMinimumQualityAcceptable) : rankedTargetAwareCandidates;
    const rankedQualityCandidates = minimumSecured ? postMinimumQualityCandidates : postMinimumQualityCandidates;
    const postMinimumCorridorCandidates =
      season1OptimumMode && minimumSecured
        ? rankedQualityCandidates.filter((candidate) =>
            isWithinSeason1SpendCorridor({
              candidate,
              cashStrategy: cashStrategyWithLanes,
              remainingCash,
              targetSlotsBefore,
            }),
          )
        : rankedQualityCandidates;
    const postMinimumTargetPressureCandidates =
      season1OptimumMode && minimumSecured && postMinimumCorridorCandidates.length === 0 && targetSlotsBefore > 1
        ? rankedQualityCandidates.filter((candidate) =>
            canRelaxSeason1SpendCorridorForTarget({
              candidate,
              cashStrategy: cashStrategyWithLanes,
              remainingCash,
              targetSlotsBefore,
            }),
          )
        : [];
    const rankedSelectionCandidates =
      season1OptimumMode && minimumSecured
        ? postMinimumCorridorCandidates.length > 0
          ? postMinimumCorridorCandidates
          : postMinimumTargetPressureCandidates
        : rankedQualityCandidates;
    const relaxedRelativeCandidates = rankedTargetAwareCandidates.filter(isRelativeMarketFitLegal);
    const phaseRelativeCandidates = rankedPhaseCandidates.filter(isRelativeMarketFitLegal);
    const relativeMarketCandidates =
      rankedSelectionCandidates.length > 0
        ? rankedSelectionCandidates
        : rankedQualityCandidates.length > 0
          ? rankedQualityCandidates
          : relaxedRelativeCandidates.length > 0
            ? relaxedRelativeCandidates
            : phaseRelativeCandidates;
    if (identityFiltered.usedFallback) {
      warnings.push(
        `Schritt ${stepIndex + 1}: Identity-Fallback aktiv (${identityFiltered.fallbackReason ?? "identity_fallback"}).`,
      );
    }

    if (season1OptimumMode && minimumSecured && rankedQualityCandidates.length === 0) {
      if (relativeMarketCandidates.length > 0) {
        warnings.push(
          `Schritt ${stepIndex + 1}: quality_floor_empty_relative_market_pick${mustContinueTowardOptimum ? "_under_optimum_pressure" : ""}`,
        );
      } else {
        warnings.push(`Schritt ${stepIndex + 1}: target_not_reachable_quality_floor`);
        break;
      }
    }

    if (season1OptimumMode && minimumSecured && rankedQualityCandidates.length > 0 && rankedSelectionCandidates.length === 0) {
      const projectedSpend = getSeason1ProjectedSpendPct({
        candidate: rankedQualityCandidates[0],
        cashStrategy: cashStrategyWithLanes,
        remainingCash,
      });
      warnings.push(
        `Schritt ${stepIndex + 1}: spend_corridor_empty_relative_market_pick${projectedSpend != null ? `:${projectedSpend}pct` : ""}`,
      );
    }
    if (season1OptimumMode && minimumSecured && postMinimumCorridorCandidates.length === 0 && postMinimumTargetPressureCandidates.length > 0) {
      warnings.push(
        `Schritt ${stepIndex + 1}: season1_spend_corridor_relaxed_for_target_gap:${targetSlotsBefore}`,
      );
    }

    let top = relativeMarketCandidates[0] ?? null;
    if (mustContinueTowardOptimum && top && rankedSelectionCandidates.length === 0) {
      warnings.push(`Schritt ${stepIndex + 1}: optimum_minus_2_depth_pick`);
    }
    if (!top && minimumSlotsBefore > 0) {
      const emergencyMinimumCandidate = scored.find(
        (entry) =>
          entry.minimumReachableAfterPick &&
          isSeason1MinimumDepthAcceptable(team, entry) &&
          canAffordWithoutNegativeCash(entry.price, remainingCash),
      );
      if (emergencyMinimumCandidate) {
        top = emergencyMinimumCandidate;
        warnings.push(`Schritt ${stepIndex + 1}: minimum_roster_emergency_depth_pick`);
      }
    }
    if (minimumSecured && top && !isPostMinimumQualityAcceptable(top)) {
      warnings.push(`Schritt ${stepIndex + 1}: post_minimum_quality_floor_warning_relative_pick`);
    }
    if (top && minimumSlotsBefore > 0 && !season1OptimumMode) {
      const cheaperAlternative = rankedPhaseCandidates.find(
        (entry) =>
          entry.playerId !== top?.playerId &&
          entry.price != null &&
          top?.price != null &&
          entry.price <= top.price * 0.82 &&
          entry.finalScore >= top.finalScore - 4,
      );
      if (
        cheaperAlternative &&
        shouldPreferMinimumSkeletonAlternative({
          top,
          alternative: cheaperAlternative,
          plannedLane: lane.lane,
          minimumSlotsBefore,
        })
      ) {
        top = cheaperAlternative;
        warnings.push(`Schritt ${stepIndex + 1}: Minimum-Skeleton bevorzugt guenstigeren Pick vor ${lane.lane}.`);
      }
    }
    if (top && cashStrategy.shouldSaveCash && minimumSlotsBefore <= 0) {
      const conservativeAlternative = rankedSelectionCandidates.find(
        (entry) =>
          entry.playerId !== top?.playerId &&
          entry.price != null &&
          top?.price != null &&
          entry.price <= top.price * 0.78 &&
          entry.finalScore >= top.finalScore - 4 &&
          entry.scoreBreakdown.teamIdentityScore >= lane.minTeamFitScore,
      );
      if (
        conservativeAlternative &&
        top.price != null &&
        lane.priceCap != null &&
        (top.price > lane.priceCap * (1 + cashStrategy.overspendTolerance) ||
          top.scoreBreakdown.needMatchScore < lane.minNeedScore ||
          top.scoreBreakdown.teamIdentityScore < lane.minTeamFitScore)
      ) {
        top = conservativeAlternative;
      }
    }
    if (season1OptimumMode) {
      const spendCandidate = findSeason1OptimumSpendCandidate({
        team,
        identity,
        expectedPrizeSignal: cashStrategyWithLanes.expectedPrizeSignal,
        candidates: minimumSecured ? relativeMarketCandidates : rankedTargetAwareCandidates,
        current: top,
        remainingCash,
        startingCash: cashStrategyWithLanes.startingCash,
        minimumSlotsBefore,
        targetRosterSize,
        simulatedRosterCount,
      });
      if (spendCandidate) {
        top = spendCandidate;
        warnings.push(`Schritt ${stepIndex + 1}: Season-1-Spend-Ziel hebt staerkeren Pick gegen zu hohen Restcash hoch.`);
      }

      const impactCandidate = findSeason1OptimumImpactCandidate({
        team,
        candidates: minimumSecured ? relativeMarketCandidates : rankedTargetAwareCandidates,
        current: top,
        remainingCash,
        minimumSlotsBefore,
        targetRosterSize,
        simulatedRosterCount,
      });
      if (impactCandidate) {
        top = impactCandidate;
        warnings.push(`Schritt ${stepIndex + 1}: Season-1-Optimum bevorzugt Impact/Core vor Cash-Puffer.`);
      }

      if (top && normalizeTeamCode(team.shortCode || team.teamId) === "C-S" && isColdSteelThemeBreaker(top.className, top.race)) {
        const existingThemeBreakers = plannedPicks.filter((pick) => isColdSteelThemeBreaker(pick.className, pick.race)).length;
        const cleanAlternative = rankedSelectionCandidates.find(
          (entry) =>
            entry.playerId !== top?.playerId &&
            !isColdSteelThemeBreaker(entry.className, entry.race) &&
            entry.focusTeamStatus !== "blocked" &&
            (entry.price == null || top?.price == null || entry.price <= top.price * 1.45 || entry.price <= (top.price ?? 0) + 12) &&
            entry.finalScore >= top.finalScore - (existingThemeBreakers > 0 ? 16 : 10) &&
            (entry.scoreBreakdown.teamIdentityScore >= 2 || entry.scoreBreakdown.needMatchScore >= 4),
        );
        if (cleanAlternative && (existingThemeBreakers > 0 || cleanAlternative.finalScore >= top.finalScore - 6)) {
          top = cleanAlternative;
          warnings.push(`Schritt ${stepIndex + 1}: Cold-Steel-Optimum ersetzt Theme-Breaker durch praezisere Alternative.`);
        }
      }

      if (top && (lane.lane === "star" || lane.lane === "superstar")) {
        const spendTargetPct = getAdjustedSeason1OptimumSpendTargetPct(team, identity, cashStrategyWithLanes.expectedPrizeSignal);
        const targetCashLeft =
          cashStrategyWithLanes.startingCash != null && cashStrategyWithLanes.startingCash > 0
            ? roundValue(cashStrategyWithLanes.startingCash * (1 - spendTargetPct), 2)
            : 0;
        const remainingTargetSlots =
          targetRosterSize != null && simulatedRosterCount != null
            ? Math.max(targetRosterSize - simulatedRosterCount, 1)
            : Math.max(maxSteps - stepIndex, 1);
        const averageTargetSlotBudget =
          remainingCash != null ? Math.max((remainingCash - targetCashLeft) / remainingTargetSlots, 0) : 0;
        const premiumFloor =
          lane.lane === "superstar"
            ? Math.max(28, averageTargetSlotBudget * 1.85, anchors.q75Price)
            : Math.max(18, averageTargetSlotBudget * 1.35, anchors.q50Price, anchors.q75Price * 0.82);
        const premiumReplacement = rankedSelectionCandidates.find(
          (entry) =>
            entry.playerId !== top?.playerId &&
            entry.price != null &&
            entry.price >= premiumFloor &&
            canAffordWithoutNegativeCash(entry.price, remainingCash) &&
            entry.focusTeamStatus !== "blocked" &&
            entry.scoreBreakdown.teamIdentityScore >= lane.minTeamFitScore &&
            (entry.scoreBreakdown.needMatchScore >= lane.minNeedScore ||
              entry.scoreBreakdown.disciplineCoverageScore >= 5 ||
              entry.scoreBreakdown.formColorCoverageScore >= 3) &&
            entry.finalScore >= top.finalScore - (lane.lane === "superstar" ? 45 : 34),
        );
        if (premiumReplacement && ((top.price ?? 0) < premiumFloor || top.finalScore < premiumReplacement.finalScore - 12)) {
          top = premiumReplacement;
          warnings.push(
            `Schritt ${stepIndex + 1}: ${lane.lane}-Lane erzwingt echten Impact-Pick statt billigem Zielspieler.`,
          );
        }
      }
    }
    if (
      season1OptimumMode &&
      top &&
      minimumSlotsBefore > 1 &&
      minimumSlotsBefore <= 3 &&
      remainingCash != null &&
      top.price != null
    ) {
      const minimumSlotBudget = remainingCash / minimumSlotsBefore;
      if (top.price > minimumSlotBudget * 1.12) {
        const minimumSafeAlternative = rankedTargetAwareCandidates.find(
          (entry) =>
            entry.playerId !== top?.playerId &&
            entry.price != null &&
            entry.price <= minimumSlotBudget * 1.08 &&
            entry.minimumReachableAfterPick &&
            canAffordWithoutNegativeCash(entry.price, remainingCash) &&
            isSeason1MinimumDepthAcceptable(team, entry),
        );
        if (minimumSafeAlternative) {
          top = minimumSafeAlternative;
          warnings.push(
            `Schritt ${stepIndex + 1}: Minimum-Sicherung ersetzt zu teuren Pick durch guenstigeren legalen Depth-Pick.`,
          );
        }
      }
    }
    if (!top) {
      warnings.push("Kein weiterer belastbarer Kandidat fuer die sequentielle Vorschau.");
      if (minimumSlotsBefore > 0) {
        warnings.push("Minimum-Roster konnte im Planner-Schritt nicht weiter abgesichert werden.");
      } else if (remainingCash != null && candidateEvaluations.length > 0 && affordableCandidateEvaluations.length === 0) {
        warnings.push("cash_window_exhausted");
      } else if (season1OptimumMode && minimumSecured) {
        warnings.push(`Schritt ${stepIndex + 1}: target_not_reachable_quality_floor`);
      }
      break;
    }
    if (
      season1OptimumMode &&
      minimumSecured &&
      top &&
      !isWithinSeason1SpendCorridor({
        candidate: top,
        cashStrategy: cashStrategyWithLanes,
        remainingCash,
        targetSlotsBefore,
      })
    ) {
      if (
        canRelaxSeason1SpendCorridorForTarget({
          candidate: top,
          cashStrategy: cashStrategyWithLanes,
          remainingCash,
          targetSlotsBefore,
        })
      ) {
        warnings.push(
          `Schritt ${stepIndex + 1}: season1_spend_corridor_relaxed_for_target_gap:${targetSlotsBefore}`,
        );
      } else {
      const projectedSpend = getSeason1ProjectedSpendPct({
        candidate: top,
        cashStrategy: cashStrategyWithLanes,
        remainingCash,
      });
      warnings.push(
        `Schritt ${stepIndex + 1}: season1_spend_corridor_stop${projectedSpend != null ? `:${projectedSpend}pct` : ""}`,
      );
      break;
      }
    }
    if (
      cashStrategy.shouldSaveCash &&
      minimumSlotsBefore <= 0 &&
      top.price != null &&
      lane.priceCap != null &&
      top.price > lane.priceCap * (1 + cashStrategy.overspendTolerance) &&
      top.scoreBreakdown.needMatchScore < Math.max(lane.minNeedScore, 3) &&
      top.scoreBreakdown.teamIdentityScore < Math.max(lane.minTeamFitScore, 2)
    ) {
      warnings.push("saved_cash_by_strategy");
      warnings.push("wait_for_better_market");
      break;
    }
    const topEvaluation =
      gatedCandidateEvaluations.find((entry) => entry.entry.playerId === top?.playerId) ??
      safeCandidateEvaluations.find((entry) => entry.entry.playerId === top?.playerId) ??
      candidateEvaluations.find((entry) => entry.entry.playerId === top?.playerId) ??
      null;

    const isSuperstar = lane.lane === "superstar";
    const isStar = isSuperstar || lane.lane === "star";
    const cheaperAlternativeAvailable = rankedScoredCandidates.some(
      (entry) =>
        entry.playerId !== top.playerId &&
        entry.price != null &&
        top.price != null &&
        entry.price <= top.price * 0.82 &&
        entry.finalScore >= top.finalScore - 4,
    );
    const cheaperMinimumSafeAlternativeAvailable =
      minimumSlotsBefore > 0 &&
      rankedScoredCandidates.some(
        (entry) =>
          entry.playerId !== top.playerId &&
          entry.price != null &&
          top.price != null &&
          entry.price <= top.price * 0.82 &&
          entry.finalScore >= top.finalScore - 4,
      );
    const specialistNeedFilled = openNeeds.some(
      (entry) =>
        entry.axis === "specialist" &&
        (top.bestNeedDisciplineId != null || (top.candidateAxis != null && entry.reason.toLowerCase().includes(top.candidateAxis))),
    );
    const coreNeedFilled = openNeeds.some((entry) => entry.axis === "core") && (top.scoreBreakdown.rosterBalanceScore >= 2 || top.scoreBreakdown.needMatchScore >= 4);
    const depthNeedFilled = openNeeds.some((entry) => entry.axis === "depth" || entry.axis === "backup") && (top.scoreBreakdown.valueScore >= 2 || top.scoreBreakdown.rosterBalanceScore >= 1.5);
    const starPressureWarning =
      (isSuperstar || isStar) &&
      (rosterGap > 1 || openNeeds.some((entry) => entry.axis === "core" || entry.axis === "depth" || entry.axis === "backup"))
        ? "High-End-Pick trotz offener Core-/Depth-Luecken."
        : null;
    const cheapFillEligibleByCost = isCheapFillCandidate({
      price: top.price,
      salary: top.salary,
      anchors,
      expectedMinimumSlotCost: cashStrategyWithLanes.expectedMinimumSlotCost,
      currentCash: remainingCash,
      minimumSlotsMissing: minimumSlotsBefore,
    });
    let expectedCostBand = resolveExpectedAiPickCostBandFromLane(lane.lane);
    const actualCostBand = resolveActualAiPickCostBand({
      price: top.price,
      salary: top.salary,
      anchors,
      expectedMinimumSlotCost: cashStrategyWithLanes.expectedMinimumSlotCost,
      currentCash: remainingCash,
      minimumSlotsMissing: minimumSlotsBefore,
    });
    const reclassifyCostBand =
      actualCostBand != null &&
      expectedCostBand != null &&
      actualCostBand !== expectedCostBand &&
      (top.scoreBreakdown.teamIdentityScore >= 4 ||
        top.scoreBreakdown.needMatchScore >= 4 ||
        top.scoreBreakdown.disciplineCoverageScore >= 5 ||
        top.scoreBreakdown.formColorCoverageScore >= 3 ||
        getPostMinimumStrongReason(top) != null);
    if (reclassifyCostBand) {
      expectedCostBand = actualCostBand;
    }
    const cheaperAlternatives = rankedScoredCandidates
      .filter(
        (entry) =>
          entry.playerId !== top.playerId &&
          entry.price != null &&
          top.price != null &&
          entry.price < top.price &&
          entry.finalScore >= top.finalScore - 6,
      )
      .slice(0, 3);
    const cheapestCandidateSeen = minFinite(rankedScoredCandidates.map((entry) => entry.price ?? null));
    const cheapestCandidateSameAxis = minFinite(
      rankedScoredCandidates
        .filter((entry) => entry.candidateAxis != null && entry.candidateAxis === top.candidateAxis)
        .map((entry) => entry.price ?? null),
    );
    const topFitBand = getTeamFitBand(top.scoreBreakdown.teamIdentityScore);
    const cheapestCandidateSameTeamFitBand = minFinite(
      rankedScoredCandidates
        .filter((entry) => getTeamFitBand(entry.scoreBreakdown.teamIdentityScore) === topFitBand)
        .map((entry) => entry.price ?? null),
    );
    const cheapestCandidateSameClassFamily = minFinite(
      rankedScoredCandidates
        .filter((entry) => isSameClassFamily(entry.className, top.className))
        .map((entry) => entry.price ?? null),
    );
    const cheapFillShouldReclassify =
      lane.lane === "cheap_fill" &&
      minimumSlotsBefore > 0 &&
      cheapFillEligibleByCost &&
      cheaperAlternatives.some(
        (entry) =>
          entry.price != null &&
          top.price != null &&
          entry.price <= top.price * 0.9 &&
          entry.finalScore >= top.finalScore - 5,
      );
    const cheapFillEligible = cheapFillEligibleByCost && !cheapFillShouldReclassify;
    const valueJustification = [
      top.scoreBreakdown.needMatchScore >= 5 ? "need_impact" : null,
      top.scoreBreakdown.teamIdentityScore >= 6 ? "team_identity_fit" : null,
      top.scoreBreakdown.valueScore >= 5 ? "value_for_price" : null,
      top.pickedForFormColor ? "form_color_fit" : null,
      top.strategicExceptionReason ?? null,
    ].filter((entry): entry is string => Boolean(entry));
    const minimumSafeFillEligible =
      !cheapFillEligible &&
      minimumSlotsBefore > 0 &&
      (topEvaluation?.minimumReachableAfterPick ?? false) &&
      !cheaperMinimumSafeAlternativeAvailable &&
      (top.strategicExceptionReason != null ||
        top.scoreBreakdown.needMatchScore >= 4 ||
        top.scoreBreakdown.teamIdentityScore >= 4);

    const preserveIntentPickLane =
      season1OptimumMode &&
      normalizeTeamCode(team.shortCode || team.teamId) === "C-S" &&
      (lane.lane === "core" || lane.lane === "specialist") &&
      top.scoreBreakdown.teamIdentityScore >= 3 &&
      (top.scoreBreakdown.needMatchScore >= 4 || top.scoreBreakdown.disciplineCoverageScore >= 4);
    const reclassifiedPickLane =
      reclassifyCostBand && !preserveIntentPickLane && actualCostBand === "superstar"
        ? "superstar_pick"
        : reclassifyCostBand && !preserveIntentPickLane && actualCostBand === "star"
          ? "star_pick"
          : reclassifyCostBand && !preserveIntentPickLane && actualCostBand === "core"
            ? "core_investment"
            : reclassifyCostBand && !preserveIntentPickLane && actualCostBand === "depth"
              ? "depth_value"
              : null;
    const pickLane =
      reclassifiedPickLane ??
      (lane.lane === "superstar"
        ? "superstar_pick"
        : lane.lane === "star"
          ? "star_pick"
          : lane.lane === "core"
            ? "core_investment"
            : lane.lane === "specialist"
              ? "specialist_investment"
              : lane.lane === "cheap_fill"
                ? cheapFillEligible
                  ? "cheap_fill"
                  : minimumSlotsBefore > 0
                    ? minimumSafeFillEligible
                      ? "minimum_safe_fill"
                      : "expensive_minimum_fill"
                    : "budget_risk_pick"
                : lane.lane === "depth"
                ? "depth_value"
                  : lane.lane);

    const rosterCountBefore = simulatedRosterCount;
    const cashBefore = remainingCash;
    const salaryBefore = remainingSalary;
    const formColorCoverageBefore = buildFormColorCounts({
      rosterPlayers: simulatedRosterPlayers,
      classCounts: simulatedClassCounts,
    });
    const formColorCoverageAfter = addFormColorCount(formColorCoverageBefore, top.formColor);
    const formColorDoubleBoostPotential = hasFormColorDoubleBoostPotential({
      color: top.formColor,
      seasonStrategy: seasonPlanning.seasonStrategy,
    });
    pickedPlayerIds.push(top.playerId);
    if (top.candidateAxis) {
      coveredAxisHits[top.candidateAxis] += 1;
    }
    const normalizedClass = normalizeToken(top.className);
    if (normalizedClass) {
      simulatedClassCounts.set(normalizedClass, (simulatedClassCounts.get(normalizedClass) ?? 0) + 1);
    }
    const pickedPlayer = getPlayerById(input.context.gameState, top.playerId);
    const pickedRole = pickedPlayer ? getPlayerRoleTag(pickedPlayer, top.candidateAxis) : "depth";
    simulatedRoleCounts.set(pickedRole, (simulatedRoleCounts.get(pickedRole) ?? 0) + 1);
    if (pickedPlayer) {
      simulatedRosterPlayers.push(pickedPlayer);
      for (const [disciplineId, rawScore] of Object.entries(pickedPlayer.disciplineRatings ?? {})) {
        const score = Number(rawScore ?? 0);
        const current = simulatedDisciplinePeak.get(disciplineId) ?? 0;
        if (score > current) {
          simulatedDisciplinePeak.set(disciplineId, score);
        }
      }
    }
    simulatedRosterCount = simulatedRosterCount != null ? simulatedRosterCount + 1 : null;
    remainingCash = cashBefore != null && top.price != null ? roundValue(cashBefore - top.price, 2) : remainingCash;
    remainingSalary = salaryBefore != null && top.salary != null ? roundValue(salaryBefore + top.salary, 2) : remainingSalary;
    const laneTracker = laneState.get(lane.lane) ?? { spendUsed: 0, remainingSlots: 0 };
    laneTracker.spendUsed = roundValue(laneTracker.spendUsed + (top.price ?? 0), 2);
    laneTracker.remainingSlots = Math.max(laneTracker.remainingSlots - 1, 0);
    laneState.set(lane.lane, laneTracker);
    lane.spendUsed = laneTracker.spendUsed;
    lane.remainingSlots = laneTracker.remainingSlots;

    plannedPicks.push({
      step: stepIndex + 1,
      lane: lane.lane,
      plannedLane: lane.lane,
      pickLane,
      pickPhase,
      teamCashTier,
      minimumSecured,
      reserveSecured,
      effectiveLaneCap: top.effectiveLanePriceCap,
      phaseCap: top.phaseCap,
      capExceeded: top.capExceeded,
      capOverrideReason: top.capOverrideReason,
      laneReason:
        pickLane === "cheap_fill"
          ? "Guenstiger Mindest- oder Rotationsslot."
          : pickLane === "minimum_safe_fill"
            ? "Minimum-Slot bleibt finanzierbar, obwohl der Pick nicht mehr als klassischer Cheap-Fill gilt."
          : pickLane === "expensive_minimum_fill"
            ? "Teurer Mindestkader-Slot mangels echter Cheap-Fill-Alternative."
            : pickLane === "depth_value"
              ? "Value-Pick fuer Kaderbreite."
              : pickLane === "core_investment"
                ? "Gezielte Kernrotation mit Preis-Leistung."
                : pickLane === "specialist_investment"
                  ? "Konkrete Spezialistenluecke wird geschlossen."
                  : pickLane === "star_pick"
                    ? "Star-Slot mit Impact und Budgetfenster."
                    : pickLane === "superstar_pick"
                      ? "Ausnahme-Pick fuer echten Top-Slot."
                    : lane.reason,
      laneBudgetLimit: top.effectiveLaneSpendCap,
      laneBudgetUsed: lane.spendUsed,
      budgetStretchApplied: top.budgetStretchApplied,
      budgetStretchReason: top.budgetStretchReason,
      budgetStretchPhaseAllowed: top.budgetStretchPhaseAllowed,
      budgetStretchBlockedReason: top.budgetStretchBlockedReason,
      playerId: top.playerId,
      playerName: top.playerName,
      className: top.className,
      race: top.race,
      price: top.price,
      salary: top.salary,
      ovr: top.ovr,
      mvs: top.mvs,
      expectedCostBand,
      actualCostBand,
      cheapestCandidateSeen,
      cheapestCandidateSameAxis,
      cheapestCandidateSameTeamFitBand,
      cheapestCandidateSameClassFamily,
      priceDeltaVsCheapest:
        top.price != null && cheapestCandidateSeen != null ? roundValue(top.price - cheapestCandidateSeen, 2) : null,
      valueJustification,
      rejectedCheaperAlternatives: cheaperAlternatives.map((entry) => ({
        playerId: entry.playerId,
        playerName: entry.playerName,
        className: entry.className,
        price: entry.price,
        finalScore: entry.finalScore,
      })),
      formColor: top.formColor,
      pickedForFormColor: top.pickedForFormColor,
      formColorReason: top.formColorReason,
      formColorCoverageBefore,
      formColorCoverageAfter,
      formColorDoubleBoostPotential,
      strategicException: top.strategicException,
      strategicExceptionReason: top.strategicExceptionReason,
      mustFeelRightStatus: top.mustFeelRightStatus,
      focusTeamStatus: top.focusTeamStatus,
      focusTeamReason: top.focusTeamReason,
      focusTeamFitScore: top.focusTeamFitScore,
      focusTeamMetrics: top.focusTeamMetrics,
      candidateAxis: top.candidateAxis,
      bestNeedDisciplineId: top.bestNeedDisciplineId,
      isSuperstar,
      isStar,
      starPressureWarning,
      cheaperAlternativeAvailable,
      cheaperMinimumSafeAlternativeAvailable,
      specialistNeedFilled,
      coreNeedFilled,
      depthNeedFilled,
      minimumReachableAfterPick: topEvaluation?.minimumReachableAfterPick ?? true,
      remainingMinimumReserve: topEvaluation?.reserveAfter.reservedCash ?? null,
      draftSeed: top.draftSeed ?? input.draftSeed ?? null,
      baseScore: top.baseScore ?? top.finalScore,
      tieBreakJitter: top.tieBreakJitter ?? 0,
      scoreWithSeed: top.scoreWithSeed ?? top.finalScore,
      tieBreakBand: top.tieBreakBand ?? null,
      finalScore: top.finalScore,
      scoreBreakdown: top.scoreBreakdown,
      reasons: top.reasons,
    });

    const remainingOpenNeedAxes = buildOpenNeeds({
      rosterGap: targetRosterSize != null && simulatedRosterCount != null ? Math.max(targetRosterSize - simulatedRosterCount, 0) : 0,
      baseAxisDeficits,
      coveredAxisHits,
      roleCounts: simulatedRoleCounts,
      disciplinePeak: rosterComposition.disciplinePeak,
      topNeedDisciplineIds: needs.topNeedDisciplineIds,
    }).map((entry) => entry.axis.toUpperCase());
    const minimumSlotsAfter = Math.max(playerMin - (simulatedRosterCount ?? 0), 0);

    sequentialStateSnapshots.push({
      step: stepIndex + 1,
      lane: lane.lane,
      pickPhase,
      teamCashTier,
      minimumSecured,
      reserveSecured,
      phaseCap: top.phaseCap,
      rosterCountBefore,
      rosterCountAfter: simulatedRosterCount,
      cashBefore,
      cashAfter: remainingCash,
      salaryBefore,
      salaryAfter: remainingSalary,
      minimumSlotsBefore,
      minimumSlotsAfter,
      minimumReserveBefore: minimumReserveBefore.reservedCash,
      minimumReserveAfter: topEvaluation?.reserveAfter.reservedCash ?? null,
      minimumReachableAfterStep: topEvaluation?.minimumReachableAfterPick ?? true,
      laneBudgetUsed: lane.spendUsed,
      laneBudgetRemaining:
        (top.effectiveLaneSpendCap ?? lane.spendCap) != null
          ? roundValue(Math.max((top.effectiveLaneSpendCap ?? lane.spendCap ?? 0) - lane.spendUsed, 0), 2)
          : null,
      laneSlotsRemaining: lane.remainingSlots,
      remainingOpenNeedAxes,
      pickedPlayerIds: [...pickedPlayerIds],
    });
  }

  const finalMissingToMin = Math.max(playerMin - (simulatedRosterCount ?? 0), 0);
  if (planner.minimumReachable && finalMissingToMin > 0) {
    planner.blockingReasons.push("minimum_failed_due_to_previous_expensive_pick");
  }
  if (cashStrategyWithLanes.sourceStatus === "missing_source") {
    planner.blockingReasons.push("cash_strategy_missing");
  }
  if (plannedPicks.some((entry) => entry.pickLane === "cheap_fill" && (entry.isStar || entry.isSuperstar))) {
    planner.warnings.push("cheap_fill_classification_failed");
  }
  planner.laneGatePassed = planner.blockingReasons.length === 0;

  const compareStatus: AiNeedsPicksCompareStatus =
    !planner.laneGatePassed
      ? "blocked"
      : compareCandidates.length === 0
      ? "blocked"
      : input.retoolReferenceStatus.topPicksAvailable
        ? "partial"
        : "retool_pick_source_missing";

  if (!planner.laneGatePassed) {
    warnings.push(...planner.blockingReasons.map((entry) => `Planner blockiert: ${entry}`));
  }

  if (!input.retoolReferenceStatus.topPicksAvailable) {
    warnings.push("Retool-Top-Picks fehlen als eingefrorene Teamquelle. Der Abgleich bleibt deshalb logisch, nicht 1:1 spielerbezogen.");
  }

  const focusTeamDiagnostics = buildFocusTeamDiagnostics({
    team,
    candidatePoolTop: topCandidatePool,
    plannedPicks,
  });
  if (focusTeamDiagnostics?.status === "warning") {
    warnings.push(`Fokus-Team-Diagnose warnt: ${focusTeamDiagnostics.primaryIssue ?? "identity_soft_warning"}.`);
  }
  if (focusTeamDiagnostics?.status === "blocked") {
    warnings.push(`Fokus-Team-Diagnose blockiert Fruehphase: ${focusTeamDiagnostics.primaryIssue ?? "focus_team_early_phase_off_theme"}.`);
    planner.blockingReasons.push(`focus_team_diagnostic_blocked:${team.shortCode ?? team.teamId}`);
  }

  const firstPlannedPick = plannedPicks[0] ?? null;
  const plannedPickIndex = firstPlannedPick?.step ?? null;
  const remainingMinimumSlots = Math.max(playerMin - (rosterCount ?? rosterEntries.length), 0);
  const cheapestLegalCandidate =
    compareCandidates
      .map((entry) => entry.price ?? entry.marketValue ?? null)
      .filter((entry): entry is number => entry != null && entry > 0)
      .sort((left, right) => left - right)[0] ?? null;
  const projectedCashAfterPick =
    firstPlannedPick?.price != null && remainingCash != null
      ? roundValue(remainingCash - firstPlannedPick.price, 2)
      : firstPlannedPick?.price == null
        ? remainingCash
        : null;
  const blockerReason =
    planner.blockingReasons[0] ??
    (remainingMinimumSlots > 0 && planner.reservedCashForMinimum == null
      ? "minimum_reserve_calculation_bug"
      : null);

  return {
    teamId: input.previewTeam.teamId,
    teamCode: input.previewTeam.teamCode,
    teamName: input.previewTeam.teamName,
    controlMode: input.previewTeam.controlMode,
    currentRosterState: {
      cash: input.previewTeam.cash ?? team.cash ?? null,
      salaryTotal: input.previewTeam.salaryTotal ?? input.previewTeam.salary ?? null,
      rosterCount,
      targetRosterMin: playerMin,
      targetRosterOpt: targetRosterSize,
      targetRosterSize,
      targetRosterGap,
      budgetStatus: input.previewTeam.budgetStatus,
    },
    openNeeds: initialOpenNeeds,
    planner,
    cashStrategy: cashStrategyWithLanes,
    seasonStrategy: seasonPlanning.seasonStrategy,
    coverage: seasonPlanning.coverage,
    budgetLanes,
    minimumFeasibility: {
      plannedPickIndex,
      remainingMinimumSlots,
      cheapestLegalCandidate,
      projectedCashAfterPick,
      reserveForMinimum: planner.reservedCashForMinimum,
      minimumFeasible: planner.minimumReachable,
      blockerReason,
      candidatePoolSource,
      candidatePoolSize: compareCandidates.length,
    },
    candidatePoolTop: topCandidatePool,
    plannedPicks,
    sequentialStateSnapshots,
    compareStatus,
    focusTeamDiagnostics,
    retoolTopPicksStatus: input.retoolReferenceStatus.topPicksAvailable ? "available" : "retool_pick_source_missing",
    retoolTopPicks: [],
    retoolReferenceFiles: input.retoolReferenceStatus.sourceFiles,
    matches: [],
    deviations: [],
    deviationReasons:
      input.retoolReferenceStatus.topPicksAvailable
        ? []
        : ["Retool-Repo enthaelt hier nur Logikdateien, aber keine eingefrorenen teambezogenen Pick-Outputs fuer den aktuellen Save."],
    warnings: Array.from(new Set(warnings)),
  } satisfies AiNeedsPicksCompareTeamEntry;
}

export async function buildAiNeedsPicksCompare(
  params: AiNeedsPicksCompareParams = {},
): Promise<AiNeedsPicksCompareResult> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";
  const context = await resolveCompareContext(params);
  const retoolReferenceStatus = await getRetoolReferenceStatus();
  const retoolParityMatrix = await buildRetoolParityMatrix();
  const prizeSignalByTeamId = await getPrizeSignalByTeamId(context);
  const explicitTeamIds = (params.teamIds ?? []).map(normalizeTeamCode).filter(Boolean);
  const compareSet = params.teamId
    ? [normalizeTeamCode(params.teamId)]
    : explicitTeamIds.length > 0
      ? explicitTeamIds
      : DEFAULT_COMPARE_SET;
  const requestedTeams = context.gameState.teams.filter(
    (team) =>
      compareSet.includes(normalizeTeamCode(team.teamId)) ||
      compareSet.includes(normalizeTeamCode(team.shortCode)),
  );
  const fullFreeAgentPoolSize = getFullFreeAgentPoolSize(context.gameState);

  const previews = await Promise.all(
    requestedTeams.map((team) =>
      buildAiTransfermarktPreview({
        source,
        saveId: context.saveId,
        seasonId: context.seasonId,
        teamId: team.teamId,
        teamScope: "all",
        excludedPlayerIds: params.excludedPlayerIds ?? [],
        limit: params.limit ?? fullFreeAgentPoolSize,
        fullScoringLimit: params.fullScoringLimit ?? null,
      } satisfies AiTransferPreviewParams),
    ),
  );

  const previewTeams = previews
    .map((preview) => preview.teams[0] ?? null)
    .filter((entry): entry is NonNullable<(typeof previews)[number]["teams"][number]> => entry !== null);

  const teamEntries = previewTeams
    .map((entry) =>
      buildTeamEntry({
        context,
        previewTeam: entry,
        steps: params.steps ?? 3,
        retoolReferenceStatus,
        prizeSignalByTeamId,
        excludedPlayerIds: params.excludedPlayerIds ?? undefined,
        runMode: params.runMode ?? "default",
        draftSeed: params.draftSeed ?? null,
      }),
    );

  const teams: AiNeedsPicksCompareTeamEntry[] = teamEntries.filter(
    (entry): entry is AiNeedsPicksCompareTeamEntry => entry !== null,
  );

  const matchedTeams = teams.filter((entry) => entry.compareStatus === "matched").length;
  const partialTeams = teams.filter((entry) => entry.compareStatus === "partial").length;
  const deviatedTeams = teams.filter((entry) => entry.compareStatus === "deviated").length;
  const missingRetoolTeams = teams.filter((entry) => entry.compareStatus === "retool_pick_source_missing").length;
  const blockedTeams = teams.filter((entry) => entry.compareStatus === "blocked").length;

  return {
    readOnly: true,
    source,
    scope: {
      saveId: context.saveId,
      seasonId: context.seasonId,
      teamId: params.teamId ?? null,
      teamScope: params.teamScope ?? "ai",
      compareSet,
    },
    totalTeams: requestedTeams.length,
    aiTeams: requestedTeams.filter((team) => getTeamControlSettings(context.gameState, team.teamId)?.controlMode === "ai").length,
    skippedManual: requestedTeams.filter((team) => getTeamControlSettings(context.gameState, team.teamId)?.controlMode === "manual").length,
    skippedPassive: requestedTeams.filter((team) => getTeamControlSettings(context.gameState, team.teamId)?.controlMode === "passive").length,
    skippedDisabled: requestedTeams.filter((team) => {
      const settings = getTeamControlSettings(context.gameState, team.teamId);
      return settings?.controlMode === "ai" && !settings.aiTransferPreviewEnabled;
    }).length,
    comparedTeams: teams.length,
    matchedTeams,
    partialTeams,
    deviatedTeams,
    missingRetoolTeams,
    blockedTeams,
    teams,
    retoolParityMatrix,
  };
}
