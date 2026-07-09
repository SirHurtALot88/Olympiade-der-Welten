import fs from "node:fs";
import path from "node:path";

import type { GameState, Player, RosterEntry, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { deriveRosterTargets, GAMEPLAY_HARD_ROSTER_MIN } from "@/lib/foundation/roster-limits";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { buildTeamStrategyScores } from "@/lib/foundation/team-strategy-score-service";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
import {
  buildTeamThemeCompositionAudit,
  calculateThemeCompositionScore,
  classifyIdentityQuotaRole,
  derivePlayerThemeTags,
  getTeamThemeCompositionTarget,
  isQuotaScopedTarget,
  type TeamThemeCompositionTarget,
  type TeamThemeCompositionScore,
} from "@/lib/ai/team-theme-composition-service";
import {
  buildRetoolAi2BudgetPlan,
  buildTeamNeedState,
  scoreFitPenalty,
  scoreFormColorStackPenalty,
  scoreInAxisHoleCompletion,
  scoreMarginalNeedGain,
  scoreOffAxisDetourPenalty,
  scoreOverpayPenalty,
  scoreRoleMismatchPenalty,
  type RetoolAi2BudgetPlan,
  type TeamNeedState,
} from "@/lib/ai/retool-ai2-pick-engine";
import { resolveMarketSpendableCashForPlanner } from "@/lib/ai/ai-manager-apply-service";
import {
  recordCashBufferDipIfNeeded,
  resolveTransferAffordableBudget,
  teamHasCashBufferRebuildFocus,
} from "@/lib/ai/ai-team-cash-reserve-service";
import {
  resolveCashSalaryDraftPickGuidance,
} from "@/lib/ai/season1-draft-cash-planner";
import {
  shouldBlockEmergencyPathAtOpt,
  strategicPoolHasReserveLaneCandidates,
} from "@/lib/ai/planner-opt-buy-policy";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { calculateTransfermarktFit, hasMercenaryTrait } from "@/lib/market/transfermarkt-fit";
import { recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export const CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN = "CONFIRM_CHUNKED_REDRAFT_TOPUP_V1";

export type ChunkedRedraftMode = "season1_initial_topup" | "preseason_roster_repair" | "full_clean_redraft";
export type ChunkedRedraftTarget = "playerMin" | "playerOpt" | "playerMax";
export type ChunkedRedraftPhase = "phase_a_minimum" | "phase_b_core_optimum" | "phase_c_depth_luxury";

const REDRAFT_FUTURE_MIN_BASE_PENALTY = 1_200;
const REDRAFT_FUTURE_MIN_GAP_PENALTY = 80;
const REDRAFT_FUTURE_MIN_UNKNOWN_PENALTY = 4_000;
const REDRAFT_PLANNED_DEPTH_BASE_PENALTY = 650;
const REDRAFT_PLANNED_DEPTH_GAP_PENALTY = 45;
const REDRAFT_PLANNED_DEPTH_UNKNOWN_PENALTY = 1_200;
const REDRAFT_USEFUL_MIN_FUTURE_PENALTY = 2_500;
const REDRAFT_USEFUL_DEPTH_FUTURE_PENALTY = 1_250;
const REDRAFT_MINIMUM_FALLBACK_PENALTY = 2_500;

function getCalculatedPlayerSalary(player: Player) {
  return resolvePlayerEconomyContract({ player }).salary;
}

/** Preseason repair may only fill with affordable free agents — cap scales with team cash. */
export const PRESEASON_REPAIR_MARKET_VALUE_CAP = 15;

export function resolvePreseasonRepairMarketValueCap(teamCash: number) {
  return Math.max(PRESEASON_REPAIR_MARKET_VALUE_CAP, Math.min(40, Math.round(teamCash * 0.25 * 10) / 10));
}

export function getPreseasonRepairMarketValueCap(teamCash?: number) {
  return teamCash != null ? resolvePreseasonRepairMarketValueCap(teamCash) : PRESEASON_REPAIR_MARKET_VALUE_CAP;
}

export function isPreseasonRepairCandidateEligible(input: { marketValue: number | null; teamCash: number }) {
  const marketValue = input.marketValue;
  const cap = resolvePreseasonRepairMarketValueCap(input.teamCash);
  if (marketValue == null || marketValue <= 0) {
    return false;
  }
  if (marketValue > cap + 0.01) {
    return false;
  }
  return input.teamCash >= marketValue - 0.01;
}

export type ChunkedRedraftState = {
  saveId: string;
  seasonId: string;
  round: number;
  completedTeamsInRound: string[];
  pickedPlayerIds: string[];
  remainingFreeAgentIds: string[];
  teamRosterCounts: Record<string, number>;
  teamCash: Record<string, number>;
  teamSalary: Record<string, number>;
  warnings: string[];
};

export type ChunkedRedraftPickRow = {
  round: number;
  teamId: string;
  playerId: string;
  playerName: string;
  marketValue: number | null;
  salary: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number;
  rosterAfter: number;
  transferHistoryId: string | null;
  phase?: ChunkedRedraftPhase;
  managerArchetype?: ManagerArchetype;
  seasonStrategy?: SeasonStrategy;
  roleFilled?: string;
  blueprintNeed?: string;
  marketBoardTier?: MarketBoardTier;
  whySelected?: string;
  whyRejectedOthers?: string;
  targetProgress?: string;
  pickScore: number;
  selectedScore?: number;
  draftVariance?: number;
  teamNeed?: string;
  role?: string;
  currentRating?: number;
  potentialRange?: string;
  qualityTier?: string;
  axisFitPow?: number;
  axisFitSpe?: number;
  axisFitMen?: number;
  axisFitSoc?: number;
  classFit?: number;
  identityFit?: number;
  premiumAxisFit?: number;
  axisFocusStrength?: number;
  valueScore?: number;
  themeCompositionScore?: number;
  themeTier?: string;
  themeTags?: string;
  themeReason?: string;
  needImpactScore?: number;
  salaryImpact?: number;
  budgetFit?: number;
  topRejectedCandidates?: string;
  topRejectedCandidate1?: string;
  topRejectedCandidate1Score?: number;
  topRejectedCandidate1Reason?: string;
  topRejectedCandidate2?: string;
  topRejectedCandidate2Score?: number;
  topRejectedCandidate2Reason?: string;
  topRejectedCandidate3?: string;
  topRejectedCandidate3Score?: number;
  topRejectedCandidate3Reason?: string;
  topRejectedCandidate4?: string;
  topRejectedCandidate4Score?: number;
  topRejectedCandidate4Reason?: string;
  topRejectedCandidate5?: string;
  topRejectedCandidate5Score?: number;
  topRejectedCandidate5Reason?: string;
  previewCalls?: number;
  candidateCount?: number;
  reasons: string;
  durationMs: number;
};

export type ChunkedRedraftSummary = {
  draftValid: boolean;
  invalidReasons: string[];
  startWasEmpty: boolean;
  teamCount: number;
  playerPool: number;
  freeAgentPoolStart: number;
  picksTotal: number;
  transferHistoryTotal: number;
  transferHistoryMismatch: boolean;
  picksMissingScores: Array<{ round: number; teamId: string; playerId: string }>;
  duplicatePlayers: Array<{ playerId: string; count: number }>;
  teamsBelowMin: Array<{ teamId: string; rosterCount: number; playerMin: number }>;
  cashLeftWhileBelowMin: Array<{ teamId: string; rosterCount: number; playerMin: number; cash: number }>;
  teamsAtOpt: Array<{ teamId: string; rosterCount: number; playerOpt: number }>;
  teamsAboveMax: Array<{ teamId: string; rosterCount: number; playerMax: number }>;
  negativeCashTeams: Array<{ teamId: string; cash: number }>;
  memoryPeakMb: number;
  roundDurations: Array<{ round: number; durationMs: number; picks: number }>;
  slowestPick: ChunkedRedraftPickRow | null;
  skipReasonTop10: Array<{ reason: string; count: number }>;
  resumeTested: boolean;
};

export type ChunkedRedraftTopupParams = {
  saveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
  mode: ChunkedRedraftMode;
  resume?: boolean;
  target?: ChunkedRedraftTarget;
  minimumRosterTargetOverride?: number;
  roundLimit?: number;
  teamTimeLimitMs?: number;
  maxTeams?: number;
  targetTeamIds?: string[];
  watchdogMs?: number;
  reportMode?: "full" | "light";
  outputDir?: string;
  persistence?: PersistenceService;
};

type Candidate = {
  player: Player;
  marketValue: number;
  salary: number | null;
  quality: number;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  pickScore: number;
};

function getTopupPlayerMarketValue(player: Player) {
  return resolvePlayerEconomyContract({ player }).marketValue;
}

type ScoredCandidate = Candidate & {
  selectedScore: number;
  identityFit: number;
  premiumAxisFit: number;
  axisFocusStrength: number;
  needImpactScore: number;
  valueScore: number;
  themeCompositionScore: number;
  themeTier: TeamThemeCompositionScore["themeTier"];
  themeTags: string[];
  themeReason: string;
  salaryImpact: number;
  budgetFit: number;
  potentialScore: number;
  phaseScore: number;
  classFit: number;
  teamNeed: string;
  draftVariance: number;
  areaDiversityScore: number;
  traitAlignmentScore: number;
  minimumFutureFeasible?: boolean;
  minimumFutureCost?: number | null;
  minimumFutureCashAfter?: number;
  minimumFutureFallbackUsed?: boolean;
};

type TeamStatusRow = {
  teamId: string;
  teamName: string;
  rosterCount: number;
  playerMin: number;
  playerOpt: number;
  playerMax: number;
  cash: number;
  salarySum: number;
  status: string;
  warning: string;
};

type MemoryRow = {
  round: number;
  teamId: string;
  phase: string;
  heapUsedMb: number;
  rssMb: number;
  durationMs: number;
  itemCount: number;
};

type WarningRow = {
  round: number;
  teamId: string;
  reason: string;
  detail: string;
};

type PhaseRow = {
  round: number;
  teamId: string;
  phase: string;
  durationMs: number;
  itemCount: number;
  freeAgentsRemaining?: number;
  teamsRemaining?: number;
  memoryBeforeMb?: number;
  memoryAfterMb?: number;
  cheapFilterCount?: number;
  shortlistCount?: number;
  hardBlockersCount?: number;
  previewCalls?: number;
  selectedCandidate?: string | null;
  note?: string | null;
};

type ProgressLogRow = {
  timestamp: string;
  elapsedMs: number;
  phase: string;
  round?: number | null;
  teamId?: string | null;
  rosterCount?: number | null;
  freeAgentCount?: number | null;
  candidateCount?: number | null;
  shortlistCount?: number | null;
  previewCount?: number | null;
  memoryMb: number;
  warning?: string | null;
  blocker?: string | null;
};

type RedraftCandidateCounters = {
  teamsTotal: number;
  freeAgentsStart: number;
  activeRostersStart: number;
  candidateScans: number;
  themeScoreCalls: number;
  marketValueLookups: number;
  salaryLookups: number;
  buyPreviewCalls: number;
  negotiationPreviewCalls: number;
  fullPreviewCalls: number;
  rejectedByAlreadyPicked: number;
  rejectedByCash: number;
  rejectedByRosterMax: number;
  rejectedByThemeHardAvoid: number;
  rejectedByHardNoGo: number;
  rejectedBySalary: number;
  selectedCandidates: number;
  successfulBuys: number;
  failedBuys: number;
  saveFlushes: number;
};

type PhasePlan = {
  phase: ChunkedRedraftPhase;
  targetRoster: number;
  cashReservePct: number;
  shortlistCap: number;
  maxRecommendedSpend: number;
  qualityFloor: number;
  description: string;
};

type RejectedCandidateRow = {
  round: number;
  phase: ChunkedRedraftPhase;
  teamId: string;
  selectedPlayerId: string;
  selectedPlayerName: string;
  rejectedRank: number;
  rejectedPlayerId: string;
  rejectedPlayerName: string;
  rejectedScore: number;
  rejectedMarketValue: number;
  rejectedSalary: number | null;
  rejectedCurrentRating: number;
  rejectedFit: number;
  rejectedReason: string;
  rejectionCategory:
    | "too_expensive"
    | "salary_too_high"
    | "worse_fit"
    | "lower_need_match"
    | "hard_no_go"
    | "roster_role_duplication"
    | "shortlist_cut"
    | "reserve_guard"
    | "lower_value";
};

type TargetMode =
  | "fill_to_optimum"
  | "fill_to_min_then_quality"
  | "small_elite_roster"
  | "eco_round"
  | "cash_recovery"
  | "win_now_push"
  | "rebuild_prospect"
  | "market_wait";

type ManagerArchetype =
  | "win_now"
  | "small_elite"
  | "value_builder"
  | "rebuild"
  | "chaotic_aggressive"
  | "conservative_finance"
  | "harmony_builder"
  | "mercenary_market"
  | "theme_collector";

type SpendingStyle = "aggressive" | "balanced" | "value" | "conservative" | "emergency";
type ManagerRosterStyle = "star_heavy" | "small_elite" | "balanced_core" | "wide_depth" | "prospect_pool" | "budget_squad";
type ManagerRiskTolerance = "low" | "medium" | "high" | "chaotic";
type ManagerQualityFloor = "low" | "medium" | "high" | "elite";
type UnderOptPolicy = "never" | "only_if_readiness_high" | "eco_allowed" | "market_wait_allowed";
type ProspectPolicy = "avoid" | "limited" | "normal" | "high";
type SalaryDiscipline = "loose" | "normal" | "strict";
type StrictnessLevel = "low" | "medium" | "high";
type DraftDoctrine =
  | "all_in_star_push"
  | "star_core"
  | "theme_specialist"
  | "salary_value"
  | "pure_value"
  | "rebuild_value"
  | "depth_rotation"
  | "balanced";
type SeasonStrategy =
  | "win_now_push"
  | "balanced_growth"
  | "rebuild_prospect"
  | "cash_recovery"
  | "eco_round"
  | "small_elite_roster"
  | "roster_repair"
  | "facility_push"
  | "market_wait"
  | "salary_control";
type MarketBoardTier = "S Target" | "A Strong Fit" | "B Solid Fit" | "C Depth/Emergency" | "Avoid";
type StopSeverity = "green" | "yellow" | "red";
type DraftPickRole = "star" | "core" | "starter" | "value" | "prospect" | "depth" | "theme";

type TeamManagerProfile = {
  teamId: string;
  teamName: string;
  managerArchetype: ManagerArchetype;
  spendingStyle: SpendingStyle;
  rosterStyle: ManagerRosterStyle;
  riskTolerance: ManagerRiskTolerance;
  qualityFloor: ManagerQualityFloor;
  underOptPolicy: UnderOptPolicy;
  prospectPolicy: ProspectPolicy;
  salaryDiscipline: SalaryDiscipline;
  identityStrictness: StrictnessLevel;
  themeStrictness: StrictnessLevel;
  draftDoctrine: DraftDoctrine;
  reason: string;
};

type SeasonStrategyPlan = {
  teamId: string;
  teamName: string;
  seasonStrategy: SeasonStrategy;
  strategyReason: string;
  primaryGoals: string;
  secondaryGoals: string;
  whatThisTeamWillAvoid: string;
};

type TeamReadinessScore = {
  teamId: string;
  rosterCountScore: number;
  topPlayerQuality: number;
  disciplineCoverage: number;
  axisCoveragePow: number;
  axisCoverageSpe: number;
  axisCoverageMen: number;
  axisCoverageSoc: number;
  injuryDepth: number;
  salarySustainability: number;
  teamIdentityFit: number;
  lineupRisk: number;
  boardPressureRisk: number;
  teamReadinessScore: number;
  canStopBelowOpt: boolean;
  canStopBelowMin: boolean;
  stopEarlyReason: string;
};

type RosterTargetPlan = {
  teamId: string;
  teamName: string;
  strategyProfile: string;
  playerMin: number;
  playerOpt: number;
  playerMax: number;
  seasonLegalMin: number;
  desiredRosterTarget: number;
  minTarget: number;
  targetMode: TargetMode;
  targetReason: string;
  cashStart: number;
  salaryStart: number;
  spendableBudget: number;
  reserveBudget: number;
  reservePolicy: RetoolAi2BudgetPlan["reservePolicy"];
  budgetCaution01: number;
  budgetAggression01: number;
  budgetPostureScore: number;
  salaryBurdenRatio: number;
  cashRunwayRatio: number;
  salaryFactorCurrent: number;
  sponsorSupportForecast5: number[];
  spendWindowFloor: number;
  spendWindowBase: number;
  spendWindowCeiling: number;
  softSlotBudget: number;
  maxTransferSpend: number;
  maxSalaryIncrease: number;
  qualityFloor: number;
  requiredRoles: string;
  preferredAxes: string;
  requiredClassBias: string;
  identityFitPriority: number;
  potentialPriority: number;
  currentRatingPriority: number;
  valuePriority: number;
  riskTolerance: number;
  allowedUnderOpt: boolean;
  allowedUnderMin: boolean;
  ecoRound: boolean;
  expectedWeaknessIfStopEarly: string;
  readiness: TeamReadinessScore;
  whyEco?: string;
  nextMarketPlan?: string;
};

type RosterBlueprintPlan = {
  teamId: string;
  teamName: string;
  desiredRosterTarget: number;
  targetMode: TargetMode;
  minStars: number;
  minCore: number;
  minStarter: number;
  minDepth: number;
  maxProspects: number;
  requiredRoles: string;
  requiredAxisCoverage: string;
  requiredClassCoverage: string;
  requiredDisciplineCoverage: string;
  preferredThemes: string;
  preferredRaces: string;
  preferredClasses: string;
  preferredSubclasses: string;
  qualityFloor: ManagerQualityFloor;
  maxSalaryIncrease: number;
  transferBudget: number;
  salaryBudget: number;
  reserveBudget: number;
  allowedUnderOpt: boolean;
  allowedUnderMin: boolean;
  stopEarlyRules: string;
};

type ManagerMarketBoardRow = {
  teamId: string;
  teamName: string;
  playerId: string;
  name: string;
  currentRating: number;
  potentialRange: string;
  marketValue: number;
  salary: number | null;
  teamFit: number;
  identityFit: number;
  classFit: number;
  roleFit: number;
  needFit: number;
  valueScore: number;
  salaryRisk: number;
  traitRisk: number;
  themeFit: number;
  themeCompositionScore: number;
  themeTier: string;
  boardTier: MarketBoardTier;
  reason: string;
};

type DraftRoleBoardRow = {
  round: number;
  teamId: string;
  teamName: string;
  desiredRole: DraftPickRole;
  rank: number;
  playerId: string;
  playerName: string;
  roleScore: number;
  baseScore: number;
  quality: number;
  marketValue: number;
  salary: number | null;
  themeTier: string;
  themeCompositionScore: number;
  reason: string;
};

type ManagerStopReasonRow = {
  teamId: string;
  teamName: string;
  rosterCount: number;
  desiredRosterTarget: number;
  playerMin: number;
  cash: number;
  stopSeverity: StopSeverity;
  stopReason: string;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function normalizeProfileToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function avg(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function ensureOutputDir(outputDir: string) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(outputDir: string, fileName: string, rows: Array<Record<string, unknown>>, preferredHeaders: string[] = []) {
  ensureOutputDir(outputDir);
  const headers = preferredHeaders.length ? preferredHeaders : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  fs.writeFileSync(
    path.join(outputDir, fileName),
    `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function writeJson(outputDir: string, fileName: string, payload: unknown) {
  ensureOutputDir(outputDir);
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdown(outputDir: string, fileName: string, content: string) {
  ensureOutputDir(outputDir);
  fs.writeFileSync(path.join(outputDir, fileName), content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function memorySnapshot() {
  const usage = process.memoryUsage();
  return {
    heapUsedMb: roundValue(usage.heapUsed / 1024 / 1024, 2),
    rssMb: roundValue(usage.rss / 1024 / 1024, 2),
  };
}

function createRedraftCounters(): RedraftCandidateCounters {
  return {
    teamsTotal: 0,
    freeAgentsStart: 0,
    activeRostersStart: 0,
    candidateScans: 0,
    themeScoreCalls: 0,
    marketValueLookups: 0,
    salaryLookups: 0,
    buyPreviewCalls: 0,
    negotiationPreviewCalls: 0,
    fullPreviewCalls: 0,
    rejectedByAlreadyPicked: 0,
    rejectedByCash: 0,
    rejectedByRosterMax: 0,
    rejectedByThemeHardAvoid: 0,
    rejectedByHardNoGo: 0,
    rejectedBySalary: 0,
    selectedCandidates: 0,
    successfulBuys: 0,
    failedBuys: 0,
    saveFlushes: 0,
  };
}

class RedraftWatchdogError extends Error {
  constructor(
    message: string,
    readonly row: ProgressLogRow,
  ) {
    super(message);
    this.name = "RedraftWatchdogError";
  }
}

class RedraftProfiler {
  readonly rows: ProgressLogRow[] = [];
  private readonly runStartedAt = Date.now();

  constructor(
    private readonly outputDir: string,
    private readonly watchdogMs = 30_000,
  ) {}

  log(phase: string, details: Partial<Omit<ProgressLogRow, "timestamp" | "elapsedMs" | "phase" | "memoryMb">> = {}) {
    const row: ProgressLogRow = {
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - this.runStartedAt,
      phase,
      round: details.round ?? null,
      teamId: details.teamId ?? null,
      rosterCount: details.rosterCount ?? null,
      freeAgentCount: details.freeAgentCount ?? null,
      candidateCount: details.candidateCount ?? null,
      shortlistCount: details.shortlistCount ?? null,
      previewCount: details.previewCount ?? null,
      memoryMb: memorySnapshot().heapUsedMb,
      warning: details.warning ?? null,
      blocker: details.blocker ?? null,
    };
    this.rows.push(row);
    return row;
  }

  start(phase: string, details: Partial<Omit<ProgressLogRow, "timestamp" | "elapsedMs" | "phase" | "memoryMb">> = {}) {
    this.log(`${phase}_start`, details);
    return Date.now();
  }

  end(
    phase: string,
    startedAt: number,
    details: Partial<Omit<ProgressLogRow, "timestamp" | "elapsedMs" | "phase" | "memoryMb">> = {},
  ) {
    const durationMs = Date.now() - startedAt;
    const row = this.log(`${phase}_end`, details);
    if (this.watchdogMs <= 0 || durationMs > this.watchdogMs) {
      const blocker = `phase_watchdog_timeout:${phase}:${durationMs}ms`;
      row.blocker = blocker;
      this.writeBlocker(blocker, row);
      throw new RedraftWatchdogError(blocker, row);
    }
    return durationMs;
  }

  writeBlocker(blocker: string, row: ProgressLogRow) {
    writeMarkdown(
      this.outputDir,
      "redraft-first-pick-blocker.md",
      [
        "# Redraft First-Pick Blocker",
        "",
        `- Blocker: ${blocker}`,
        `- Phase: ${row.phase}`,
        `- Elapsed: ${row.elapsedMs}ms`,
        `- Round: ${row.round ?? ""}`,
        `- Team: ${row.teamId ?? ""}`,
        `- RosterCount: ${row.rosterCount ?? ""}`,
        `- FreeAgents: ${row.freeAgentCount ?? ""}`,
        `- Candidates: ${row.candidateCount ?? ""}`,
        `- Shortlist: ${row.shortlistCount ?? ""}`,
        `- Memory: ${row.memoryMb} MB`,
      ].join("\n"),
    );
  }
}

function groupRostersByTeam(rosters: RosterEntry[]) {
  const map = new Map<string, RosterEntry[]>();
  for (const roster of rosters) {
    const bucket = map.get(roster.teamId) ?? [];
    bucket.push(roster);
    map.set(roster.teamId, bucket);
  }
  return map;
}

function getRosterSalary(roster: RosterEntry[]) {
  return roundValue(roster.reduce((sum, entry) => sum + (entry.salary ?? 0), 0), 2);
}

export function getPlayerAxisValue(player: Player, axis: "pow" | "spe" | "men" | "soc") {
  const coreValue = player.coreStats?.[axis];
  if (typeof coreValue === "number" && Number.isFinite(coreValue)) return coreValue;
  const direct = (player as unknown as Record<string, unknown>)[axis];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  return 50;
}

function getTeamTarget(gameState: GameState, teamId: string, target: ChunkedRedraftTarget) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerMin, playerOpt, playerMax } = deriveRosterTargets(team, identity);
  const requested = target === "playerMax" ? playerMax : target === "playerOpt" ? playerOpt : playerMin;
  return {
    playerMin,
    playerOpt,
    playerMax,
    targetRoster: Math.min(requested, playerMax),
  };
}

function buildCandidatePool(gameState: GameState, pickedPlayerIds: Set<string>, counters?: RedraftCandidateCounters) {
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  if (counters) {
    counters.candidateScans += 1;
    counters.rejectedByAlreadyPicked += gameState.players.filter((player) => rosteredPlayerIds.has(player.id) || pickedPlayerIds.has(player.id)).length;
  }
  return gameState.players
    .filter((player) => !rosteredPlayerIds.has(player.id) && !pickedPlayerIds.has(player.id))
    .map<Candidate | null>((player) => {
      if (counters) counters.marketValueLookups += 1;
      const marketValue = getTopupPlayerMarketValue(player);
      if (marketValue == null || marketValue <= 0) return null;
      if (counters) counters.salaryLookups += 1;
      const salary = getCalculatedPlayerSalary(player);
      const pow = getPlayerAxisValue(player, "pow");
      const spe = getPlayerAxisValue(player, "spe");
      const men = getPlayerAxisValue(player, "men");
      const soc = getPlayerAxisValue(player, "soc");
      const quality = roundValue((pow + spe + men + soc) / 4, 2);
      return {
        player,
        marketValue,
        salary,
        quality,
        pow,
        spe,
        men,
        soc,
        pickScore: 0,
      };
    })
    .filter((entry): entry is Candidate => Boolean(entry))
    .sort((left, right) => {
      return compareByDeterministicPlayerTie(left.player.id, right.player.id, "candidate_pool");
    });
}

function toBias(value: number | null | undefined, fallback = 5) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(10, value)) : fallback;
}

function getPhaseForRoster(rosterCount: number, target: { playerMin: number; playerOpt: number }): ChunkedRedraftPhase {
  if (rosterCount < target.playerMin) return "phase_a_minimum";
  if (rosterCount < target.playerOpt) return "phase_b_core_optimum";
  return "phase_c_depth_luxury";
}

function getPlannedPhaseForRoster(rosterCount: number, plan: Pick<RosterTargetPlan, "minTarget" | "desiredRosterTarget">): ChunkedRedraftPhase {
  if (rosterCount < plan.minTarget) return "phase_a_minimum";
  if (rosterCount < plan.desiredRosterTarget) return "phase_b_core_optimum";
  return "phase_c_depth_luxury";
}

function buildPhasePlan(input: {
  target: ChunkedRedraftTarget;
  rosterCount: number;
  teamTarget: ReturnType<typeof getTeamTarget>;
  targetPlan?: RosterTargetPlan | null;
  teamCash: number;
  teamSalarySum?: number;
  teamFinances?: number | null;
  strategyProfile: TeamStrategyProfile | null | undefined;
  candidatePool: Candidate[];
  rebuildFocusActive?: boolean;
}): PhasePlan {
  const phase = input.targetPlan ? getPlannedPhaseForRoster(input.rosterCount, input.targetPlan) : getPhaseForRoster(input.rosterCount, input.teamTarget);
  const targetRoster =
    input.targetPlan?.desiredRosterTarget ??
    (input.target === "playerMax"
      ? input.teamTarget.playerMax
      : input.target === "playerOpt"
        ? input.teamTarget.playerOpt
        : input.teamTarget.playerMin);
  const remainingSlots = Math.max(1, targetRoster - input.rosterCount);
  const starBias = toBias(input.strategyProfile?.bias?.starPriority);
  const valueBias = toBias(input.strategyProfile?.bias?.valuePriority);
  const cashBias = toBias(input.strategyProfile?.bias?.cashPriority);
  const riskBias = toBias(input.strategyProfile?.bias?.riskTolerance);
  const depthBias = toBias(input.strategyProfile?.bias?.rosterDepthPreference);
  const plannedReservePct =
    input.targetPlan && input.teamCash > 0 ? Math.max(0, Math.min(0.5, input.targetPlan.reserveBudget / input.teamCash)) : null;
  const plannedSpendableCash = Math.max(0, input.teamCash - (input.targetPlan?.reserveBudget ?? 0));
  const plannedSoftSlotBudget =
    input.targetPlan?.softSlotBudget && input.targetPlan.softSlotBudget > 0
      ? input.targetPlan.softSlotBudget
      : plannedSpendableCash / remainingSlots;
  const cashSalaryGuide =
    input.teamSalarySum != null && input.teamSalarySum > 0
      ? resolveCashSalaryDraftPickGuidance({
          cash: input.teamCash,
          salaryTotal: input.teamSalarySum,
          finances: input.teamFinances,
          remainingSlots,
          rosterAtOrAboveMin: input.rosterCount >= input.teamTarget.playerMin,
          avgPickPrice: plannedSoftSlotBudget,
        })
      : null;

  if (phase === "phase_a_minimum") {
    let reservePct = Math.min(0.13, plannedReservePct ?? 0.07);
    if (input.rebuildFocusActive) {
      reservePct = Math.min(reservePct, 0.04);
    }
    const spendableCash = input.teamCash * (1 - reservePct);
    return {
      phase,
      targetRoster,
      cashReservePct: roundValue(reservePct, 3),
      shortlistCap: 112,
      maxRecommendedSpend: Math.max(1, (spendableCash / remainingSlots) * 1.05),
      qualityFloor: 0,
      description: "Pflicht-Minimum: breit, guenstig, brauchbar, Retool-Reserve nur weich.",
    };
  }

  if (phase === "phase_b_core_optimum") {
    const activeSpendMultiplier = 1.25 + starBias * 0.08 + riskBias * 0.04 - cashBias * 0.025;
    const fallbackReservePct = Math.max(0.04, Math.min(0.16, 0.14 - starBias * 0.008 + cashBias * 0.006));
    let reservePct = roundValue(Math.max(0.02, Math.min(0.32, plannedReservePct ?? fallbackReservePct)), 3);
    if (input.rebuildFocusActive) {
      reservePct = roundValue(Math.max(0.02, reservePct * 0.45), 3);
    }
    if (cashSalaryGuide?.maxCashReservePct != null) {
      reservePct = roundValue(Math.min(reservePct, cashSalaryGuide.maxCashReservePct), 3);
    }
    const shortlistCap = Math.round(56 + starBias * 4 + valueBias * 2);
    let maxRecommendedSpend = Math.max(1, plannedSoftSlotBudget * activeSpendMultiplier);
    if (cashSalaryGuide != null && cashSalaryGuide.minSpendPerPick > 0) {
      maxRecommendedSpend = Math.max(maxRecommendedSpend, cashSalaryGuide.minSpendPerPick * 1.12);
    }
    return {
      phase,
      targetRoster,
      cashReservePct: reservePct,
      shortlistCap,
      maxRecommendedSpend,
      qualityFloor: 0,
      description: `Core/Optimum: Retool-Budget ${input.targetPlan?.reservePolicy ?? "fallback"}; cash/salary=${cashSalaryGuide?.cashSalaryRatio ?? "?"}; Teamfit, Qualitaet und Needs.`,
    };
  }

  const fallbackReservePct = Math.max(0.14, Math.min(0.28, 0.25 + cashBias * 0.006 - depthBias * 0.01));
  let reservePct = roundValue(Math.max(0.08, Math.min(0.42, plannedReservePct ?? fallbackReservePct)), 3);
  if (cashSalaryGuide?.maxCashReservePct != null) {
    reservePct = roundValue(Math.min(reservePct, cashSalaryGuide.maxCashReservePct), 3);
  }
  let maxRecommendedSpend = Math.max(1, plannedSoftSlotBudget * 0.9);
  if (cashSalaryGuide != null && cashSalaryGuide.minSpendPerPick > 0) {
    maxRecommendedSpend = Math.max(maxRecommendedSpend, cashSalaryGuide.minSpendPerPick);
  }
  return {
    phase,
    targetRoster,
    cashReservePct: reservePct,
    shortlistCap: Math.round(32 + depthBias * 3),
    maxRecommendedSpend,
    qualityFloor: 0,
    description: `Depth/Luxus: Retool-Budget ${input.targetPlan?.reservePolicy ?? "fallback"}; cash/salary=${cashSalaryGuide?.cashSalaryRatio ?? "?"}; Rotation und Cash-Absicherung.`,
  };
}

function getIdentityFit(candidate: Candidate, identity: TeamIdentity | null | undefined) {
  if (!identity) return roundValue((candidate.pow + candidate.spe + candidate.men + candidate.soc) / 4, 2);
  const total = Math.max(1, identity.pow + identity.spe + identity.men + identity.soc);
  return roundValue(
    (candidate.pow * identity.pow + candidate.spe * identity.spe + candidate.men * identity.men + candidate.soc * identity.soc) / total,
    2,
  );
}

function getPreferredAxisRows(identity: TeamIdentity | null | undefined) {
  if (!identity) return [];
  return [
    ["pow", identity.pow] as const,
    ["spe", identity.spe] as const,
    ["men", identity.men] as const,
    ["soc", identity.soc] as const,
  ]
    .filter(([, weight]) => Number.isFinite(weight) && weight > 0)
    .sort((left, right) => right[1] - left[1]);
}

export function computePreferredAxisFit(
  candidate: Pick<Candidate, "pow" | "spe" | "men" | "soc">,
  identity: TeamIdentity | null | undefined,
) {
  const preferredAxes = getPreferredAxisRows(identity).slice(0, 2);
  if (preferredAxes.length === 0) return roundValue((candidate.pow + candidate.spe + candidate.men + candidate.soc) / 4, 2);
  const total = preferredAxes.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return roundValue((candidate.pow + candidate.spe + candidate.men + candidate.soc) / 4, 2);
  return roundValue(
    preferredAxes.reduce((sum, [axis, weight]) => sum + candidate[axis] * weight, 0) / total,
    2,
  );
}

function getAxisFocusStrength(identity: TeamIdentity | null | undefined) {
  const preferredAxes = getPreferredAxisRows(identity);
  if (preferredAxes.length === 0) return 0;
  const total = preferredAxes.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return 0;
  return roundValue(preferredAxes.slice(0, 2).reduce((sum, [, weight]) => sum + weight, 0) / total, 4);
}

function getClassFit(candidate: Candidate, roster: RosterEntry[], gameState: GameState) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const sameClassCount = roster.filter((entry) => playersById.get(entry.playerId)?.className === candidate.player.className).length;
  return sameClassCount === 0 ? 8 : sameClassCount === 1 ? 3 : -4;
}

function buildRosterClassCounts(gameState: GameState, roster: RosterEntry[]) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const counts = new Map<string, number>();
  for (const entry of roster) {
    const className = playersById.get(entry.playerId)?.className;
    if (!className) continue;
    counts.set(className, (counts.get(className) ?? 0) + 1);
  }
  return counts;
}

function getClassFitFromCounts(candidate: Candidate, classCounts: Map<string, number>) {
  const sameClassCount = classCounts.get(candidate.player.className) ?? 0;
  return sameClassCount === 0 ? 8 : sameClassCount === 1 ? 3 : -4;
}

function getCheapThemePriority(candidate: Candidate, target: TeamThemeCompositionTarget | null) {
  if (!target) return 0;
  const tags = new Set(derivePlayerThemeTags(candidate.player).playerThemeTags);
  if (target.avoidTags.some((tag) => tags.has(tag))) return -10;
  if (target.primaryThemeTags.some((tag) => tags.has(tag))) return 4;
  if (target.secondaryThemeTags.some((tag) => tags.has(tag))) return 3;
  if (target.softPreferredTags.some((tag) => tags.has(tag))) return 2;
  if (target.allowedOutsiderTags.some((tag) => tags.has(tag))) return 1;
  return 0;
}

function selectScoringPool(input: {
  planningPool: Candidate[];
  cap: number;
  themeTarget: TeamThemeCompositionTarget | null;
  phase: ChunkedRedraftPhase;
  identity: TeamIdentity | null | undefined;
}) {
  if (input.planningPool.length <= input.cap) return input.planningPool;
  const indexed = input.planningPool.map((candidate, index) => ({
    candidate,
    index,
    themePriority: getCheapThemePriority(candidate, input.themeTarget),
    identityFit: getIdentityFit(candidate, input.identity),
    premiumAxisFit: computePreferredAxisFit(candidate, input.identity),
    salary: candidate.salary ?? 0,
  }));
  const baseShare = input.themeTarget && input.phase !== "phase_c_depth_luxury" ? 0.68 : 0.82;
  const baseLimit = Math.max(80, Math.floor(input.cap * baseShare));
  const selected = new Map<string, Candidate>();
  const fitRows = [...indexed].sort((left, right) => {
    const leftScore = left.premiumAxisFit * 0.50 + left.identityFit * 0.45 + left.themePriority * 8 - left.salary * 0.4;
    const rightScore = right.premiumAxisFit * 0.50 + right.identityFit * 0.45 + right.themePriority * 8 - right.salary * 0.4;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return compareByDeterministicPlayerTie(left.candidate.player.id, right.candidate.player.id, "fit_pool");
  });
  for (const row of fitRows.slice(0, baseLimit)) {
    selected.set(row.candidate.player.id, row.candidate);
  }
  const themedRows = indexed
    .filter((row) => row.themePriority > 0)
    .sort((left, right) => {
      if (right.themePriority !== left.themePriority) return right.themePriority - left.themePriority;
      if (right.premiumAxisFit !== left.premiumAxisFit) return right.premiumAxisFit - left.premiumAxisFit;
      if (right.identityFit !== left.identityFit) return right.identityFit - left.identityFit;
      return left.index - right.index;
    });
  for (const row of themedRows) {
    if (selected.size >= input.cap) break;
    selected.set(row.candidate.player.id, row.candidate);
  }
  for (const row of indexed) {
    if (selected.size >= input.cap) break;
    selected.set(row.candidate.player.id, row.candidate);
  }
  return [...selected.values()];
}

function getRoleMarketCeiling(input: {
  role: DraftPickRole;
  phasePlan: PhasePlan;
  targetPlan: RosterTargetPlan;
  teamCash: number;
  rosterCount: number;
  desiredRosterTarget: number;
}) {
  const remainingSlots = Math.max(1, input.desiredRosterTarget - input.rosterCount);
  const budgetPerSlot = Math.max(1, (input.teamCash - input.targetPlan.reserveBudget) / remainingSlots);
  const softSlot = Math.max(1, input.targetPlan.softSlotBudget || input.phasePlan.maxRecommendedSpend || budgetPerSlot);
  const financeCaution = input.targetPlan.budgetCaution01 ?? 0.5;
  const roleMultiplier =
    input.role === "star"
      ? 3.2
      : input.role === "core"
        ? 2.35
        : input.role === "starter"
          ? 1.7
          : input.role === "theme"
            ? 1.55
            : input.role === "prospect"
              ? 1.25
              : input.role === "value"
                ? 1.15
                : 1.0;
  const cashShare =
    input.role === "star"
      ? 0.72
      : input.role === "core"
        ? 0.48
        : input.role === "starter"
          ? 0.34
          : input.role === "theme"
            ? 0.3
            : input.role === "prospect"
              ? 0.22
              : input.role === "value"
                ? 0.2
                : 0.16;
  const cautionCut = 1 - Math.max(0, Math.min(0.28, financeCaution * 0.18));
  const cashAwareCeiling = Math.max(softSlot * roleMultiplier, input.teamCash * cashShare) * cautionCut;
  return Math.max(1, Math.min(input.teamCash, cashAwareCeiling));
}

function getCandidateNeedAxisValue(candidate: Candidate, needState: TeamNeedState | null | undefined) {
  if (!needState) return Math.max(candidate.pow, candidate.spe, candidate.men, candidate.soc);
  return Math.max(
    candidate[needState.topAxis] ?? 0,
    (candidate[needState.secondAxis] ?? 0) * 0.92,
    (candidate[needState.thirdAxis] ?? 0) * 0.78,
  );
}

function getCandidateDominantAxis(candidate: Pick<Candidate, "pow" | "spe" | "men" | "soc">): "pow" | "spe" | "men" | "soc" {
  return ([
    ["pow", candidate.pow],
    ["spe", candidate.spe],
    ["men", candidate.men],
    ["soc", candidate.soc],
  ] as Array<["pow" | "spe" | "men" | "soc", number]>).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "pow";
}

function scoreRosterAreaDiversity(input: {
  candidate: Candidate;
  roster: RosterEntry[];
  gameState: GameState;
  phase: ChunkedRedraftPhase;
  targetRosterSize: number;
}) {
  const rosterPlayerById = new Map(input.gameState.players.map((player) => [player.id, player]));
  const counts: Record<"pow" | "spe" | "men" | "soc", number> = { pow: 0, spe: 0, men: 0, soc: 0 };
  for (const rosterEntry of input.roster) {
    const player = rosterPlayerById.get(rosterEntry.playerId);
    if (!player) continue;
    const axis = getCandidateDominantAxis({
      pow: getPlayerAxisValue(player, "pow"),
      spe: getPlayerAxisValue(player, "spe"),
      men: getPlayerAxisValue(player, "men"),
      soc: getPlayerAxisValue(player, "soc"),
    });
    counts[axis] += 1;
  }
  const candidateAxis = getCandidateDominantAxis(input.candidate);
  const coveredAxes = Object.values(counts).filter((count) => count > 0).length;
  const candidateAxisCount = counts[candidateAxis];
  const plannedRosterAfterPick = input.roster.length + 1;
  const phaseMultiplier = input.phase === "phase_a_minimum" ? 0.65 : input.phase === "phase_b_core_optimum" ? 1 : 0.75;
  const missingAxisBonus =
    candidateAxisCount === 0 && plannedRosterAfterPick >= 4
      ? (42 + Math.max(0, 4 - coveredAxes) * 8) * phaseMultiplier
      : 0;
  const overloadLimit = Math.max(3, Math.ceil(Math.min(input.targetRosterSize, 12) * 0.45));
  const monoAxisPenalty =
    coveredAxes <= 1 && candidateAxisCount > 0 && plannedRosterAfterPick >= 5
      ? Math.min(150, 55 + candidateAxisCount * 18) * phaseMultiplier
      : 0;
  const overloadPenalty =
    candidateAxisCount >= overloadLimit && coveredAxes <= 2
      ? Math.min(70, (candidateAxisCount - overloadLimit + 1) * 14) * phaseMultiplier
      : 0;
  return roundValue(missingAxisBonus - monoAxisPenalty - overloadPenalty, 4);
}

function scoreStrategyTraitAlignment(player: Player, profile: TeamStrategyProfile | null | undefined) {
  if (!profile) return 0;
  const positiveTraits = new Set((player.traitsPositive ?? []).map(normalizeProfileToken));
  const negativeTraits = new Set((player.traitsNegative ?? []).map(normalizeProfileToken));
  const allTraits = new Set([...positiveTraits, ...negativeTraits]);
  const preferredHits = (profile.preferredTraits ?? []).filter((trait) => allTraits.has(normalizeProfileToken(trait))).length;
  const dislikedHits = (profile.dislikedTraits ?? []).filter((trait) => allTraits.has(normalizeProfileToken(trait))).length;
  const positivePreferredHits = (profile.preferredTraits ?? []).filter((trait) => positiveTraits.has(normalizeProfileToken(trait))).length;
  const negativeDislikedHits = (profile.dislikedTraits ?? []).filter((trait) => negativeTraits.has(normalizeProfileToken(trait))).length;
  const genericRiskPenalty = Math.max(0, negativeTraits.size - 1) * 2.2;
  return roundValue(preferredHits * 14 + positivePreferredHits * 8 - dislikedHits * 12 - negativeDislikedHits * 5 - genericRiskPenalty, 4);
}

function getCheapMarketLaneScore(input: {
  candidate: Candidate;
  role: DraftPickRole;
  identity: TeamIdentity | null | undefined;
  themeTarget: TeamThemeCompositionTarget | null;
  needState: TeamNeedState | null | undefined;
}) {
  const identityFit = getIdentityFit(input.candidate, input.identity);
  const premiumAxisFit = computePreferredAxisFit(input.candidate, input.identity);
  const needAxis = getCandidateNeedAxisValue(input.candidate, input.needState);
  const themePriority = getCheapThemePriority(input.candidate, input.themeTarget);
  const salary = Math.max(1, input.candidate.salary ?? 1);
  const marketValueSalaryRatio = input.candidate.marketValue / salary;
  const roleValue =
    input.role === "star" || input.role === "core"
      ? needAxis * 0.62 + premiumAxisFit * 0.82 + identityFit * 0.52 + marketValueSalaryRatio * 2 + themePriority * 9
      : input.role === "value"
        ? marketValueSalaryRatio * 8 + needAxis * 0.65 + identityFit * 0.35 + premiumAxisFit * 0.35 + themePriority * 7
        : input.role === "prospect"
          ? (input.candidate.player.potential ?? 0) * 0.75 + needAxis * 0.4 + identityFit * 0.35 + themePriority * 8 - salary * 0.4
          : input.role === "theme"
            ? themePriority * 22 + identityFit * 0.45 + premiumAxisFit * 0.32 + needAxis * 0.25
            : needAxis * 0.75 + marketValueSalaryRatio * 4 + identityFit * 0.35 + premiumAxisFit * 0.28 + themePriority * 6 - salary * 0.25;
  return roundValue(roleValue, 4);
}

function buildStrategicScoutingPool(input: {
  planningPool: Candidate[];
  role: DraftPickRole;
  phasePlan: PhasePlan;
  targetPlan: RosterTargetPlan;
  teamCash: number;
  rosterCount: number;
  desiredRosterTarget: number;
  identity: TeamIdentity | null | undefined;
  themeTarget: TeamThemeCompositionTarget | null;
  needState: TeamNeedState | null | undefined;
}) {
  if (input.planningPool.length === 0) {
    return { pool: [] as Candidate[], lane: "empty", scanned: 0, matched: 0, deepLimit: 0 };
  }

  const ceiling = getRoleMarketCeiling(input);
  const salaryValueThreshold =
    input.role === "value" ? 2.15 : input.role === "depth" ? 1.55 : input.role === "prospect" ? 1.25 : 0.9;
  const needAxisThreshold =
    input.role === "star" ? 64 : input.role === "core" ? 58 : input.role === "starter" ? 54 : input.role === "theme" ? 48 : 50;
  const rows = input.planningPool.map((candidate) => {
    const needAxis = getCandidateNeedAxisValue(candidate, input.needState);
    const identityFit = getIdentityFit(candidate, input.identity);
    const premiumAxisFit = computePreferredAxisFit(candidate, input.identity);
    const themePriority = getCheapThemePriority(candidate, input.themeTarget);
    const salaryRatio = candidate.marketValue / Math.max(1, candidate.salary ?? 1);
    const priceOk = candidate.marketValue <= ceiling;
    const roleOk =
      input.role === "star" || input.role === "core"
        ? candidate.quality >= (input.role === "star" ? 64 : 56) || premiumAxisFit >= (input.role === "star" ? 68 : 60)
        : input.role === "theme"
          ? themePriority > 0 || identityFit >= 56 || needAxis >= needAxisThreshold
          : needAxis >= needAxisThreshold || salaryRatio >= salaryValueThreshold || identityFit >= 56 || premiumAxisFit >= 56;
    return {
      candidate,
      priceOk,
      roleOk,
      themePriority,
      needAxis,
      identityFit,
      premiumAxisFit,
      salaryRatio,
    };
  });

  const primaryLane = rows.filter((row) => row.priceOk && row.roleOk);
  const priceOnlyLane = rows.filter((row) => row.priceOk);
  const roleOnlyLane = rows.filter((row) => row.roleOk);
  const selectedLane =
    primaryLane.length > 0
      ? primaryLane
      : priceOnlyLane.length > 0
        ? priceOnlyLane
        : roleOnlyLane.length > 0
          ? roleOnlyLane
          : rows;
  const lane =
    primaryLane.length > 0
      ? "role_budget_need"
      : priceOnlyLane.length > 0
        ? "budget_fallback"
        : roleOnlyLane.length > 0
          ? "role_fallback"
          : "full_fallback";
  const scoredLane = selectedLane.map((row) => ({
    ...row,
    score: getCheapMarketLaneScore({
      candidate: row.candidate,
      role: input.role,
      identity: input.identity,
      themeTarget: input.themeTarget,
      needState: input.needState,
    }),
  }));
  const sorted = scoredLane.sort((left, right) => {
    if (right.themePriority !== left.themePriority && input.role === "theme") return right.themePriority - left.themePriority;
    if (right.score !== left.score) return right.score - left.score;
    return compareByDeterministicPlayerTie(left.candidate.player.id, right.candidate.player.id, `strategic_scouting:${input.role}`);
  });
  const deepLimit =
    selectedLane.length <= 640
      ? selectedLane.length
      : input.role === "star" || input.role === "core"
        ? 760
        : input.role === "theme"
          ? 700
          : 640;
  return {
    pool: sorted.slice(0, deepLimit).map((row) => row.candidate),
    lane,
    scanned: input.planningPool.length,
    matched: selectedLane.length,
    deepLimit,
  };
}

function getRosterPlayers(gameState: GameState, roster: RosterEntry[]) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return roster.map((entry) => playersById.get(entry.playerId)).filter((player): player is Player => Boolean(player));
}

function getCandidateTeamFit(input: {
  gameState: GameState;
  team: GameState["teams"][number];
  roster: RosterEntry[];
  candidate: Candidate;
}) {
  return getCandidateTeamFitFromRosterPlayers({
    team: input.team,
    rosterPlayers: getRosterPlayers(input.gameState, input.roster),
    candidate: input.candidate,
  });
}

function getCandidateTeamFitFromRosterPlayers(input: {
  team: GameState["teams"][number];
  rosterPlayers: Player[];
  candidate: Candidate;
}) {
  return calculateTransfermarktFit(input.candidate.player, input.rosterPlayers, {
    teamId: input.team.teamId,
  }).teamFit ?? 0;
}

function isAllowedByStandardFit(input: {
  gameState: GameState;
  team: GameState["teams"][number];
  roster: RosterEntry[];
  candidate: Candidate;
}) {
  const teamFit = getCandidateTeamFit(input);
  const mercenary = hasMercenaryTrait(input.candidate.player);
  return {
    allowed: teamFit >= 0 || mercenary,
    teamFit,
    mercenary,
  };
}

function isMercenaryMarketTeam(team: GameState["teams"][number]) {
  return team.teamId === "W-L" || team.shortCode === "W-L" || /wrecking legionnaires/i.test(team.name ?? "");
}

function selectFitLegalCandidates(input: {
  team: GameState["teams"][number];
  positiveFitCandidates: Candidate[];
  mercenaryFallbackCandidates: Candidate[];
}) {
  if (isMercenaryMarketTeam(input.team)) {
    return [...input.positiveFitCandidates, ...input.mercenaryFallbackCandidates];
  }
  return input.positiveFitCandidates.length > 0 ? input.positiveFitCandidates : input.mercenaryFallbackCandidates;
}

function estimateCheapestFutureCost<T extends Candidate>(input: {
  sortedCandidates: T[];
  excludedPlayerId: string;
  neededCount: number;
}) {
  if (input.neededCount <= 0) return 0;
  let total = 0;
  let count = 0;
  for (const candidate of input.sortedCandidates) {
    if (candidate.player.id === input.excludedPlayerId) continue;
    total += candidate.marketValue;
    count += 1;
    if (count >= input.neededCount) break;
  }
  return count >= input.neededCount ? roundValue(total, 2) : Number.POSITIVE_INFINITY;
}

function isUsefulFutureCandidate(candidate: ScoredCandidate, phase: ChunkedRedraftPhase) {
  const usefulAxis =
    candidate.premiumAxisFit >= (phase === "phase_a_minimum" ? 56 : 60) ||
    candidate.identityFit >= (phase === "phase_a_minimum" ? 54 : 58);
  const usefulDisciplineProxy = candidate.quality >= (phase === "phase_a_minimum" ? 54 : 60);
  const usefulTheme =
    candidate.themeCompositionScore > 0 ||
    candidate.themeTier === "core_theme" ||
    candidate.themeTier === "secondary_theme" ||
    candidate.themeTier === "soft_theme";
  const usefulValue = candidate.valueScore >= (phase === "phase_a_minimum" ? 4.5 : 5.2);
  return usefulAxis || usefulDisciplineProxy || usefulTheme || usefulValue;
}

function estimateUsefulFutureCost(input: {
  sortedCandidates: ScoredCandidate[];
  fallbackSortedCandidates: ScoredCandidate[];
  excludedPlayerId: string;
  neededCount: number;
  phase: ChunkedRedraftPhase;
}) {
  if (input.neededCount <= 0) return { cost: 0, usefulCountEnough: true };
  const usefulCandidates = input.sortedCandidates.filter((candidate) => isUsefulFutureCandidate(candidate, input.phase));
  const usefulCost = estimateCheapestFutureCost({
    sortedCandidates: usefulCandidates,
    excludedPlayerId: input.excludedPlayerId,
    neededCount: input.neededCount,
  });
  if (Number.isFinite(usefulCost)) {
    return { cost: usefulCost, usefulCountEnough: true };
  }
  return {
    cost: estimateCheapestFutureCost({
      sortedCandidates: input.fallbackSortedCandidates,
      excludedPlayerId: input.excludedPlayerId,
      neededCount: input.neededCount,
    }),
    usefulCountEnough: false,
  };
}

function buildDraftRoleSequence(input: {
  profile: TeamManagerProfile | null | undefined;
  blueprint: RosterBlueprintPlan | null | undefined;
  targetPlan: RosterTargetPlan | null | undefined;
}) {
  const targetSize = input.blueprint?.desiredRosterTarget ?? input.targetPlan?.desiredRosterTarget ?? 10;
  const fill = (roles: DraftPickRole[]) => {
    const sequence: DraftPickRole[] = [];
    while (sequence.length < targetSize) sequence.push(...roles);
    return sequence.slice(0, targetSize);
  };
  switch (input.profile?.draftDoctrine) {
    case "all_in_star_push":
      return fill(["star", "star", "core", "star", "theme", "starter", "core", "depth", "star", "value"]);
    case "star_core":
      return fill(["star", "core", "core", "starter", "theme", "star", "depth", "value"]);
    case "theme_specialist":
      return fill(["theme", "theme", "core", "theme", "starter", "theme", "value", "depth"]);
    case "salary_value":
      return fill(["theme", "value", "theme", "star", "theme", "value", "theme", "core", "depth", "value"]);
    case "pure_value":
      return fill(["value", "value", "core", "prospect", "value", "starter", "depth"]);
    case "rebuild_value":
      return fill(["prospect", "value", "prospect", "core", "starter", "value", "depth"]);
    case "depth_rotation":
      return fill(["core", "starter", "depth", "starter", "value", "depth", "theme"]);
    case "balanced":
    case undefined:
      break;
  }
  if (input.profile?.managerArchetype === "theme_collector") {
    return fill(["theme", "theme", "core", "theme", "starter", "theme", "value", "depth"]);
  }
  switch (input.profile?.rosterStyle) {
    case "star_heavy":
      return fill(["star", "star", "core", "theme", "starter", "core", "depth", "value"]);
    case "small_elite":
      return fill(["star", "core", "core", "theme", "starter", "value", "depth"]);
    case "budget_squad":
      return fill(["value", "core", "value", "prospect", "starter", "value", "depth"]);
    case "prospect_pool":
      return fill(["prospect", "value", "core", "prospect", "starter", "theme", "depth"]);
    case "wide_depth":
      return fill(["core", "starter", "depth", "starter", "value", "depth", "theme"]);
    default:
      return fill(["core", "starter", "value", "theme", "depth", "prospect"]);
  }
}

function getPrimaryThemeShareForRoster(input: {
  gameState: GameState;
  roster: RosterEntry[];
  target: TeamThemeCompositionTarget | null;
}): { primaryCount: number; denom: number } {
  if (!input.target || input.roster.length === 0) return { primaryCount: 0, denom: input.roster.length };
  const target = input.target;
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const quotaScoped = isQuotaScopedTarget(target);
  let primaryCount = 0;
  let denom = 0;
  for (const entry of input.roster) {
    const player = playerById.get(entry.playerId);
    if (!player) continue;
    if (quotaScoped) {
      // Exempt (Pets/Tiere) und none zaehlen weder in Zaehler noch Nenner der Mindestquote.
      const role = classifyIdentityQuotaRole(player, target);
      if (role === "exempt" || role === "none") continue;
      denom += 1;
      if (role === "counts") primaryCount += 1;
    } else {
      denom += 1;
      const tags = new Set(derivePlayerThemeTags(player).playerThemeTags);
      if (target.primaryThemeTags.some((tag) => tags.has(tag))) primaryCount += 1;
    }
  }
  return { primaryCount, denom };
}

function needsThemePickToProtectMinimum(input: {
  gameState: GameState;
  roster: RosterEntry[];
  target: TeamThemeCompositionTarget | null;
  phase: ChunkedRedraftPhase;
}) {
  const target = input.target;
  if (!target || input.phase === "phase_c_depth_luxury") return false;
  if (target.strictness !== "hard" && target.strictness !== "strong") return false;
  const { primaryCount, denom } = getPrimaryThemeShareForRoster({ gameState: input.gameState, roster: input.roster, target });
  const currentShare = denom > 0 ? primaryCount / denom : 0;
  // Projektion: ein zusaetzlicher Nicht-Quoten-Spieler vergroessert nur den Nenner.
  const projectedNonThemeShare = primaryCount / Math.max(1, denom + 1);
  return currentShare < target.minimumShare || projectedNonThemeShare < target.minimumShare;
}

function getDesiredDraftRole(input: {
  rosterCount: number;
  roster: RosterEntry[];
  gameState: GameState;
  phase: ChunkedRedraftPhase;
  profile: TeamManagerProfile | null | undefined;
  blueprint: RosterBlueprintPlan | null | undefined;
  targetPlan: RosterTargetPlan | null | undefined;
  themeTarget: TeamThemeCompositionTarget | null;
}) {
  if (
    needsThemePickToProtectMinimum({
      gameState: input.gameState,
      roster: input.roster,
      target: input.themeTarget,
      phase: input.phase,
    })
  ) {
    return "theme" satisfies DraftPickRole;
  }
  if (input.phase === "phase_c_depth_luxury") return "depth" satisfies DraftPickRole;
  const minimumGap = Math.max(0, (input.targetPlan?.minTarget ?? input.targetPlan?.playerMin ?? 0) - input.rosterCount);
  if (
    input.phase === "phase_a_minimum" &&
    minimumGap > 0 &&
    minimumGap <= 2 &&
    input.profile?.managerArchetype !== "win_now" &&
    input.profile?.managerArchetype !== "chaotic_aggressive" &&
    input.profile?.managerArchetype !== "small_elite"
  ) {
    return "value" satisfies DraftPickRole;
  }
  const sequence = buildDraftRoleSequence(input);
  return sequence[Math.min(input.rosterCount, sequence.length - 1)] ?? "core";
}

function scoreCandidateForDraftRole(candidate: ScoredCandidate, role: DraftPickRole) {
  const salary = candidate.salaryImpact ?? 0;
  const theme = candidate.themeCompositionScore ?? 0;
  const potential = candidate.potentialScore ?? 0;
  const salaryValueRatio = (candidate.identityFit + candidate.premiumAxisFit + Math.max(0, theme)) / Math.max(1, salary * 5);
  const focusedAxisPick = candidate.axisFocusStrength >= 0.65;
  const premiumAxisPenalty = focusedAxisPick ? Math.max(0, 68 - candidate.premiumAxisFit) * 2.35 : 0;
  const premiumAxisBonus = candidate.premiumAxisFit * (focusedAxisPick ? 1.15 : 0.35);
  const themeTierBonus =
    candidate.themeTier === "core_theme"
      ? 120
      : candidate.themeTier === "secondary_theme"
        ? 42
        : candidate.themeTier === "soft_theme"
          ? 12
          : candidate.themeTier === "outsider_exception"
            ? -65
            : candidate.themeTier === "outsider"
              ? -120
              : candidate.themeTier === "avoid"
                ? -180
                : 0;
  const base =
    role === "star"
      ? candidate.identityFit * 0.8 +
        premiumAxisBonus +
        candidate.classFit * 0.8 +
        theme * 0.55 +
        themeTierBonus * 0.35 -
        salary * 0.08 -
        premiumAxisPenalty
      : role === "core"
        ? candidate.identityFit * 0.9 +
          candidate.premiumAxisFit * (focusedAxisPick ? 0.45 : 0.18) +
          theme * 0.8 +
          candidate.classFit * 1.15 +
          themeTierBonus * 0.25 +
          salary * -0.25
        : role === "starter"
          ? candidate.classFit * 1.4 +
            candidate.identityFit * 0.48 +
            candidate.premiumAxisFit * (focusedAxisPick ? 0.32 : 0.12) +
            theme * 0.65 +
            salary * -0.28
          : role === "value"
            ? salaryValueRatio * 22 + candidate.identityFit * 0.42 + candidate.premiumAxisFit * 0.35 + theme * 0.35 - salary * 0.75
            : role === "prospect"
              ? potential * 0.75 + candidate.identityFit * 0.35 + candidate.premiumAxisFit * 0.25 + theme * 0.5 - salary * 0.25
              : role === "theme"
                ? theme * 2.8 + themeTierBonus + candidate.identityFit * 0.35 + candidate.premiumAxisFit * 0.2 + candidate.classFit * 0.35 - salary * 0.15
                : candidate.classFit * 3 + candidate.identityFit * 0.35 + candidate.premiumAxisFit * 0.25 + theme * 0.4 - salary * 0.35;
  return roundValue(base, 4);
}

function isPremiumDraftRole(role: DraftPickRole) {
  return role === "star" || role === "core";
}

function passesPremiumDraftRoleGate(candidate: ScoredCandidate, role: DraftPickRole) {
  if (!isPremiumDraftRole(role)) {
    return true;
  }
  if (candidate.themeTier === "avoid" || candidate.themeTier === "outsider") {
    return false;
  }

  const focusedAxisPick = candidate.axisFocusStrength >= 0.65;
  const minPremiumAxis = role === "star" ? 66 : 61;
  const minIdentityFit = role === "star" ? 60 : 56;
  const axisFit = focusedAxisPick ? candidate.premiumAxisFit >= minPremiumAxis : true;
  const identityFit = candidate.identityFit >= (focusedAxisPick ? minIdentityFit : minIdentityFit + 4);
  if (!axisFit || !identityFit) {
    return false;
  }

  if (role === "star") {
    return candidate.themeTier === "core_theme" || candidate.themeTier === "secondary_theme" || candidate.themeTier === "soft_theme";
  }

  if (candidate.themeTier === "outsider_exception") {
    return candidate.premiumAxisFit >= minPremiumAxis + 6 && candidate.identityFit >= minIdentityFit + 6;
  }

  return true;
}

function applyPremiumDraftRoleGate<T extends ScoredCandidate & { roleScore?: number; desiredDraftRole?: DraftPickRole }>(
  candidates: T[],
  role: DraftPickRole,
) {
  if (!isPremiumDraftRole(role)) {
    return { candidates, blockedCount: 0, usedFallback: false };
  }
  const gated = candidates.filter((candidate) => passesPremiumDraftRoleGate(candidate, role));
  return gated.length > 0
    ? { candidates: gated, blockedCount: candidates.length - gated.length, usedFallback: false }
    : { candidates, blockedCount: candidates.length, usedFallback: true };
}

function hashStringToUnitInterval(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function compareByDeterministicPlayerTie(leftPlayerId: string, rightPlayerId: string, salt: string) {
  const leftTie = hashStringToUnitInterval(`${salt}:${leftPlayerId}`);
  const rightTie = hashStringToUnitInterval(`${salt}:${rightPlayerId}`);
  if (rightTie !== leftTie) return rightTie - leftTie;
  return leftPlayerId.localeCompare(rightPlayerId, "en");
}

function compareScoredCandidateTie(left: ScoredCandidate, right: ScoredCandidate, salt: string) {
  if (right.premiumAxisFit !== left.premiumAxisFit) return right.premiumAxisFit - left.premiumAxisFit;
  if (right.identityFit !== left.identityFit) return right.identityFit - left.identityFit;
  if (right.draftVariance !== left.draftVariance) return right.draftVariance - left.draftVariance;
  return compareByDeterministicPlayerTie(left.player.id, right.player.id, salt);
}

export function computeRedraftScoreVariance(input: {
  draftSalt: string;
  teamId: string;
  playerId: string;
  phase: ChunkedRedraftPhase;
}) {
  const unit = hashStringToUnitInterval(`${input.draftSalt}:${input.teamId}:${input.playerId}:${input.phase}`);
  const phaseMagnitude =
    input.phase === "phase_a_minimum" ? 5 : input.phase === "phase_b_core_optimum" ? 11 : 7;
  return roundValue((unit * 2 - 1) * phaseMagnitude, 4);
}

function applyDraftRoleIntent(candidates: ScoredCandidate[], role: DraftPickRole) {
  return candidates
    .map((candidate) => {
      const roleScore = scoreCandidateForDraftRole(candidate, role);
      const baseWeight = role === "theme" ? 0.2 : 0.52;
      const roleWeight = role === "theme" ? 0.8 : 0.48;
      return {
        ...candidate,
        selectedScore: roundValue(candidate.selectedScore * baseWeight + roleScore * roleWeight, 4),
        roleScore,
        desiredDraftRole: role,
      };
    })
    .sort((left, right) => {
      if (right.selectedScore !== left.selectedScore) return right.selectedScore - left.selectedScore;
      if (right.roleScore !== left.roleScore) return right.roleScore - left.roleScore;
      return compareScoredCandidateTie(left, right, `draft_role:${role}`);
    });
}

function buildDraftRoleBoardRows(input: {
  round: number;
  team: GameState["teams"][number];
  desiredRole: DraftPickRole;
  candidates: Array<ScoredCandidate & { roleScore?: number; desiredDraftRole?: DraftPickRole }>;
  limit?: number;
}): DraftRoleBoardRow[] {
  return input.candidates.slice(0, input.limit ?? 20).map((candidate, index) => ({
    round: input.round,
    teamId: input.team.teamId,
    teamName: input.team.name,
    desiredRole: input.desiredRole,
    rank: index + 1,
    playerId: candidate.player.id,
    playerName: candidate.player.name,
    roleScore: roundValue(candidate.roleScore ?? scoreCandidateForDraftRole(candidate, input.desiredRole), 4),
    baseScore: candidate.selectedScore,
    quality: roundValue(candidate.quality, 2),
    marketValue: candidate.marketValue,
    salary: candidate.salary,
    themeTier: candidate.themeTier,
    themeCompositionScore: candidate.themeCompositionScore,
    reason: `role=${input.desiredRole};theme=${candidate.themeTier};quality=${roundValue(candidate.quality, 2)};value=${candidate.valueScore};identity=${candidate.identityFit};premiumAxisFit=${candidate.premiumAxisFit}`,
  }));
}

function getSeasonLegalMin(playerMin: number) {
  return Math.max(GAMEPLAY_HARD_ROSTER_MIN, playerMin);
}

function getPreferredAxes(identity: TeamIdentity | null | undefined) {
  if (!identity) return "BALANCED";
  return [
    ["POW", identity.pow],
    ["SPE", identity.spe],
    ["MEN", identity.men],
    ["SOC", identity.soc],
  ]
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 2)
    .map(([axis]) => axis)
    .join("|");
}

function buildTeamReadinessScore(input: {
  gameState: GameState;
  teamId: string;
  target: ReturnType<typeof getTeamTarget>;
  roster: RosterEntry[];
  identity: TeamIdentity | null | undefined;
  strategyProfile: TeamStrategyProfile | null | undefined;
}): TeamReadinessScore {
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const rosterPlayers = input.roster.map((entry) => playersById.get(entry.playerId)).filter((player): player is Player => Boolean(player));
  const allDisciplineIds = new Set(input.gameState.disciplines.map((discipline) => discipline.id));
  const coveredDisciplineIds = new Set(rosterPlayers.flatMap((player) => player.preferredDisciplineIds ?? []));
  const disciplineCoverage = allDisciplineIds.size > 0 ? (coveredDisciplineIds.size / allDisciplineIds.size) * 100 : 0;
  const axisAverage = (axis: "pow" | "spe" | "men" | "soc") => avg(rosterPlayers.map((player) => getPlayerAxisValue(player, axis))) ?? 0;
  const salarySum = getRosterSalary(input.roster);
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  const cash = team?.cash ?? 0;
  const rosterCountScore = Math.min(100, (input.roster.length / Math.max(1, input.target.playerOpt)) * 100);
  const injuryDepth = Math.min(100, Math.max(0, input.roster.length - input.target.playerMin + 2) * 20);
  const salarySustainability = Math.max(0, Math.min(100, 100 - (salarySum / Math.max(1, cash + salarySum)) * 100));
  const rosterCandidateShapes = rosterPlayers
    .map((player) => ({
      player,
      marketValue: getTopupPlayerMarketValue(player) ?? 0,
      salary: getCalculatedPlayerSalary(player),
      pow: getPlayerAxisValue(player, "pow"),
      spe: getPlayerAxisValue(player, "spe"),
      men: getPlayerAxisValue(player, "men"),
      soc: getPlayerAxisValue(player, "soc"),
      pickScore: 0,
    }))
    .map((candidate) => ({
      ...candidate,
      quality: roundValue((candidate.pow + candidate.spe + candidate.men + candidate.soc) / 4, 2),
    }));
  const topPlayerQuality =
    avg(
      rosterCandidateShapes
        .map((candidate) => computePreferredAxisFit(candidate, input.identity))
        .sort((left, right) => right - left)
        .slice(0, 3),
    ) ?? 0;
  const teamIdentityFit = avg(rosterCandidateShapes.map((candidate) => getIdentityFit(candidate, input.identity))) ?? 0;
  const boardPressureRisk = Math.max(0, 100 - toBias(input.identity?.boardConfidence, 5) * 10);
  const lineupRisk = input.roster.length < input.target.playerMin ? 85 : input.roster.length < input.target.playerOpt ? 45 : 15;
  const teamReadinessScore = roundValue(
    rosterCountScore * 0.16 +
      topPlayerQuality * 0.18 +
      disciplineCoverage * 0.12 +
      axisAverage("pow") * 0.08 +
      axisAverage("spe") * 0.08 +
      axisAverage("men") * 0.08 +
      axisAverage("soc") * 0.08 +
      injuryDepth * 0.08 +
      salarySustainability * 0.06 +
      teamIdentityFit * 0.08 -
      lineupRisk * 0.08 -
      boardPressureRisk * 0.04,
    2,
  );
  const canStopBelowOpt =
    input.roster.length >= getSeasonLegalMin(input.target.playerMin) &&
    input.roster.length >= input.target.playerMin &&
    teamReadinessScore >= 62 &&
    topPlayerQuality >= 62 &&
    lineupRisk < 60;
  return {
    teamId: input.teamId,
    rosterCountScore: roundValue(rosterCountScore),
    topPlayerQuality: roundValue(topPlayerQuality),
    disciplineCoverage: roundValue(disciplineCoverage),
    axisCoveragePow: roundValue(axisAverage("pow")),
    axisCoverageSpe: roundValue(axisAverage("spe")),
    axisCoverageMen: roundValue(axisAverage("men")),
    axisCoverageSoc: roundValue(axisAverage("soc")),
    injuryDepth: roundValue(injuryDepth),
    salarySustainability: roundValue(salarySustainability),
    teamIdentityFit: roundValue(teamIdentityFit),
    lineupRisk: roundValue(lineupRisk),
    boardPressureRisk: roundValue(boardPressureRisk),
    teamReadinessScore,
    canStopBelowOpt,
    canStopBelowMin: false,
    stopEarlyReason: canStopBelowOpt ? "readiness_allows_controlled_under_opt" : "readiness_requires_optimum_or_minimum",
  };
}

function buildRosterTargetPlan(input: {
  gameState: GameState;
  saveId?: string;
  teamId: string;
  target: ChunkedRedraftTarget;
  strategyProfile: TeamStrategyProfile | null | undefined;
  candidatePool: Candidate[];
  requirePlayerOptTarget?: boolean;
  minimumRosterTargetOverride?: number;
}): RosterTargetPlan {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const rostersByTeam = groupRostersByTeam(input.gameState.rosters);
  const roster = rostersByTeam.get(input.teamId) ?? [];
  const target = getTeamTarget(input.gameState, input.teamId, input.target);
  const requirePlayerOptTarget = input.requirePlayerOptTarget ?? input.target === "playerOpt";
  const minimumRosterTargetOverride =
    input.minimumRosterTargetOverride != null && Number.isFinite(input.minimumRosterTargetOverride)
      ? Math.max(0, Math.round(input.minimumRosterTargetOverride))
      : null;
  const coverageMinTarget = Math.min(
    target.playerMax,
    Math.max(target.playerMin, minimumRosterTargetOverride ?? target.playerMin),
  );
  const seasonLegalMin = getSeasonLegalMin(target.playerMin);
  const salaryStart = getRosterSalary(roster);
  const cashStart = roundValue(team?.cash ?? 0);
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player]));
  const rosterPlayers = roster.map((entry) => playerById.get(entry.playerId)).filter((player): player is Player => Boolean(player));
  const rosterMarketValue = roundValue(rosterPlayers.reduce((sum, player) => sum + (getTopupPlayerMarketValue(player) ?? 0), 0), 2);
  const standing = input.gameState.seasonState.standings[input.teamId];
  const cashPriority = toBias(input.strategyProfile?.bias?.cashPriority);
  const valuePriority = toBias(input.strategyProfile?.bias?.valuePriority);
  const starPriority = toBias(input.strategyProfile?.bias?.starPriority);
  const riskTolerance = toBias(input.strategyProfile?.bias?.riskTolerance);
  const eliteSmallRosterPreference = toBias(input.strategyProfile?.bias?.eliteSmallRosterPreference);
  const rosterDepthPreference = toBias(input.strategyProfile?.bias?.rosterDepthPreference);
  const budgetPlan = buildRetoolAi2BudgetPlan({
    team: { teamId: input.teamId, cash: cashStart },
    teamIdentity: identity,
    strategyProfile: input.strategyProfile ?? null,
    rosterSize: roster.length,
    rosterSalaryKnown: salaryStart,
    rosterMarketValue,
    playerMin: target.playerMin,
    optimum: target.playerOpt,
    currentRank: standing?.rank ?? standing?.startplatz ?? 32,
    previousRank: standing?.startplatz ?? standing?.rank ?? 32,
    sponsorSupport: standing?.sponsorTotal ?? standing?.sponsorSeason ?? standing?.sponsorBasis ?? null,
    salaryFactors5: getSeasonEconomyFactorWindow({
      saveId: input.saveId ?? input.gameState.season.id,
      seasonId: input.gameState.season.id,
      seasonState: input.gameState.seasonState,
    }).map((entry) => entry.factor),
  });
  const reserveBudget = budgetPlan.reserveTarget;
  const managerBucketCap = resolveMarketSpendableCashForPlanner({
    gameState: input.gameState,
    teamId: input.teamId,
    teamCash: cashStart,
    rosterBelowMin: roster.length < coverageMinTarget,
    forceRosterFill: input.target !== "playerOpt",
  });
  const spendableBudget = Math.min(budgetPlan.allowedBudgetForSearch, managerBucketCap);
  const strongAffordableCandidates = input.candidatePool.filter(
    (candidate) =>
      candidate.marketValue <= spendableBudget &&
      getIdentityFit(candidate, identity) >= 55 &&
      computePreferredAxisFit(candidate, identity) >= 55,
  );
  const readiness = buildTeamReadinessScore({
    gameState: input.gameState,
    teamId: input.teamId,
    target,
    roster,
    identity,
    strategyProfile: input.strategyProfile,
  });

  let targetMode: TargetMode = "fill_to_optimum";
  let desiredRosterTarget = target.playerOpt;
  let allowedUnderOpt = false;
  let allowedUnderMin = false;
  let targetReason = "default_playerOpt";
  let ecoRound = false;

  const winNow = starPriority >= 8 || (identity?.ambition ?? 0) >= 8 || ["M-M", "Z-H"].includes(input.teamId);
  const smallEliteCandidate = eliteSmallRosterPreference >= 8 && rosterDepthPreference <= 5 && input.teamId === "B-P";
  const cashRecovery = cashStart < target.playerMin * 12 || salaryStart > cashStart * 0.6;
  const ecoConditions = [
    (identity?.finances ?? 0) >= 8,
    (identity?.boardConfidence ?? 5) >= 5,
    cashPriority >= 8,
    strongAffordableCandidates.length < Math.max(2, target.playerOpt - roster.length),
    readiness.canStopBelowOpt,
  ].filter(Boolean).length;

  if (winNow) {
    targetMode = input.target === "playerMax" ? "win_now_push" : "fill_to_optimum";
    desiredRosterTarget = input.target === "playerMax" ? target.playerMax : target.playerOpt;
    targetReason = "win_now_or_high_ambition_uses_cash";
  } else if (cashRecovery) {
    targetMode = "cash_recovery";
    desiredRosterTarget = target.playerMin;
    allowedUnderOpt = true;
    targetReason = "cash_or_salary_pressure_limits_optimum_push";
  } else if (smallEliteCandidate && readiness.canStopBelowOpt) {
    targetMode = "small_elite_roster";
    desiredRosterTarget = Math.max(target.playerMin, target.playerOpt - 1);
    allowedUnderOpt = true;
    targetReason = "small_elite_identity_with_sufficient_readiness";
  } else if (ecoConditions >= 2 && !winNow && roster.length >= target.playerMin) {
    targetMode = "eco_round";
    desiredRosterTarget = Math.max(target.playerMin, Math.min(target.playerOpt, roster.length));
    allowedUnderOpt = true;
    ecoRound = true;
    targetReason = "eco_round_conditions_met";
  } else if (valuePriority >= 8 && starPriority <= 5) {
    targetMode = "rebuild_prospect";
    targetReason = "value_or_rebuild_profile_targets_opt_with_value_bias";
  }

  if (requirePlayerOptTarget && input.target === "playerOpt") {
    desiredRosterTarget = target.playerOpt;
    allowedUnderOpt = false;
    ecoRound = false;
    targetMode = winNow ? "win_now_push" : targetMode === "small_elite_roster" || targetMode === "eco_round" || targetMode === "cash_recovery"
      ? "fill_to_optimum"
      : targetMode;
    targetReason = `${targetReason}+full_clean_redraft_requires_playerOpt`;
  }

  desiredRosterTarget = Math.max(desiredRosterTarget, coverageMinTarget);
  const minTarget = allowedUnderMin ? Math.max(seasonLegalMin, coverageMinTarget) : coverageMinTarget;
  const maxTransferSpend = roundValue(budgetPlan.softSlotBudget || spendableBudget / Math.max(1, desiredRosterTarget - roster.length));
  const requiredRoles = roster.length < minTarget ? "season_legal_core" : targetMode === "small_elite_roster" ? "elite_core" : "coverage_depth";
  return {
    teamId: input.teamId,
    teamName: team?.name ?? input.teamId,
    strategyProfile: input.strategyProfile?.strategySummary ?? "default",
    playerMin: target.playerMin,
    playerOpt: target.playerOpt,
    playerMax: target.playerMax,
    seasonLegalMin,
    desiredRosterTarget: Math.min(desiredRosterTarget, target.playerMax),
    minTarget,
    targetMode,
    targetReason: minimumRosterTargetOverride != null && coverageMinTarget > target.playerMin
      ? `${targetReason}+coverage_min_${coverageMinTarget}`
      : targetReason,
    cashStart,
    salaryStart,
    spendableBudget,
    reserveBudget,
    reservePolicy: budgetPlan.reservePolicy,
    budgetCaution01: budgetPlan.caution01,
    budgetAggression01: budgetPlan.aggression01,
    budgetPostureScore: budgetPlan.spendPostureScore,
    salaryBurdenRatio: budgetPlan.salaryBurdenRatio,
    cashRunwayRatio: budgetPlan.cashRunwayRatio,
    salaryFactorCurrent: budgetPlan.salaryFactorCurrent,
    sponsorSupportForecast5: budgetPlan.sponsorSupportForecast5,
    spendWindowFloor: budgetPlan.spendWindowFloor,
    spendWindowBase: budgetPlan.spendWindowBase,
    spendWindowCeiling: budgetPlan.spendWindowCeiling,
    softSlotBudget: budgetPlan.softSlotBudget,
    maxTransferSpend,
    maxSalaryIncrease: roundValue(spendableBudget * 0.18),
    qualityFloor: 0,
    requiredRoles,
    preferredAxes: getPreferredAxes(identity),
    requiredClassBias: input.strategyProfile?.preferredClasses?.slice(0, 3).join("|") ?? "",
    identityFitPriority: roundValue(starPriority >= 8 ? 8 : 6),
    potentialPriority: roundValue(targetMode === "rebuild_prospect" ? 9 : valuePriority >= 8 ? 7 : 5),
    currentRatingPriority: roundValue(winNow ? 9 : 7),
    valuePriority,
    riskTolerance,
    allowedUnderOpt,
    allowedUnderMin,
    ecoRound,
    expectedWeaknessIfStopEarly: allowedUnderOpt ? "reduced_depth_or_open_opt_gap" : "",
    readiness,
    whyEco: ecoRound ? `conditions=${ecoConditions};cashPriority=${cashPriority};finances=${identity?.finances ?? ""}` : "",
    nextMarketPlan: ecoRound ? "hold_cash_for_better_fit_or_facility_window" : "continue_toward_desired_target",
  };
}

function buildRosterTargetPlans(input: {
  gameState: GameState;
  saveId?: string;
  target: ChunkedRedraftTarget;
  strategyProfiles: Record<string, TeamStrategyProfile>;
  candidatePool: Candidate[];
  requirePlayerOptTarget?: boolean;
  minimumRosterTargetOverride?: number;
}) {
  return new Map(
    input.gameState.teams.map((team) => [
      team.teamId,
      buildRosterTargetPlan({
        gameState: input.gameState,
        saveId: input.saveId,
        teamId: team.teamId,
        target: input.target,
        strategyProfile: input.strategyProfiles[team.teamId],
        candidatePool: input.candidatePool,
        requirePlayerOptTarget: input.requirePlayerOptTarget,
        minimumRosterTargetOverride: input.minimumRosterTargetOverride,
      }),
    ]),
  );
}

function levelHigh(value: number | null | undefined) {
  return typeof value === "number" && value >= 8;
}

function levelLow(value: number | null | undefined) {
  return typeof value === "number" && value <= 3;
}

function compileTeamManagerProfile(input: {
  gameState: GameState;
  team: GameState["teams"][number];
  identity: TeamIdentity | null | undefined;
  strategyProfile: TeamStrategyProfile | null | undefined;
  roster: RosterEntry[];
}): TeamManagerProfile {
  const text = `${input.team.teamId} ${input.team.name} ${input.strategyProfile?.strategySummary ?? ""} ${input.strategyProfile?.buyStyle ?? ""}`.toLowerCase();
  const bias = input.strategyProfile?.bias;
  const strategyScores = buildTeamStrategyScores({ identity: input.identity, profile: input.strategyProfile });
  const starHigh = strategyScores.starHunting >= 75 || levelHigh(bias?.starPriority) || levelHigh(input.identity?.ambition);
  const valueHigh = strategyScores.valueDiscipline >= 75 || levelHigh(bias?.valuePriority) || levelHigh(input.identity?.finances);
  const cashHigh = strategyScores.cashReserveDiscipline >= 75 || levelHigh(bias?.cashPriority) || levelHigh(input.identity?.finances);
  const riskHigh = strategyScores.riskAppetite >= 75 || levelHigh(bias?.riskTolerance);
  const depthHigh = strategyScores.depthPreference >= 75 || levelHigh(bias?.rosterDepthPreference);
  const eliteSmallHigh = strategyScores.smallElitePreference >= 75 || levelHigh(bias?.eliteSmallRosterPreference);
  const themeHigh =
    strategyScores.themeCommitment >= 75 ||
    (input.strategyProfile?.preferredClasses.length ?? 0) + (input.strategyProfile?.preferredRaces.length ?? 0) + (input.strategyProfile?.preferredArchetypes.length ?? 0) >= 3;

  let managerArchetype: ManagerArchetype = "rebuild";
  if (strategyScores.archetype === "all_in_contender") {
    managerArchetype = "win_now";
  } else if (strategyScores.archetype === "opportunistic_risk_taker") {
    managerArchetype = "chaotic_aggressive";
  } else if (strategyScores.archetype === "small_elite") {
    managerArchetype = "small_elite";
  } else if (strategyScores.archetype === "profit_flipper" || strategyScores.archetype === "salary_value_trader") {
    managerArchetype = "value_builder";
  } else if (strategyScores.archetype === "harmony_builder") {
    managerArchetype = "harmony_builder";
  } else if (strategyScores.archetype === "theme_guardian") {
    managerArchetype = "theme_collector";
  }

  if (input.team.teamId === "R-R") {
    managerArchetype = "value_builder";
  } else if (input.team.teamId === "C-C" || text.includes("cash creators") || text.includes("value") || text.includes("bank der olympiade")) {
    managerArchetype = "value_builder";
  } else if (input.team.teamId === "W-L" || text.includes("wrecking legionnaires") || text.includes("soeldner") || text.includes("mercenary")) {
    managerArchetype = "mercenary_market";
  } else if (input.team.teamId === "T-T" || text.includes("terrible teachers") || text.includes("teacher")) {
    managerArchetype = "harmony_builder";
  } else if (["M-M", "Z-H"].includes(input.team.teamId) || text.includes("topteam") || text.includes("underground")) {
    managerArchetype = input.team.teamId === "Z-H" ? "chaotic_aggressive" : "win_now";
  } else if (input.team.teamId === "B-P" || eliteSmallHigh || text.includes("kleine elite")) {
    managerArchetype = "small_elite";
  } else if (getTeamThemeCompositionTarget(input.team) || text.includes("royal") || text.includes("aqua") || text.includes("magier")) {
    managerArchetype = "theme_collector";
  } else if (levelHigh(input.identity?.harmony) || text.includes("harmony") || text.includes("teacher")) {
    managerArchetype = "harmony_builder";
  } else if (cashHigh && levelLow(bias?.riskTolerance)) {
    managerArchetype = "conservative_finance";
  }

  const spendingStyle: SpendingStyle =
    input.team.cash < 20 ? "emergency" : managerArchetype === "win_now" || managerArchetype === "chaotic_aggressive" ? "aggressive" : managerArchetype === "value_builder" ? "value" : managerArchetype === "conservative_finance" ? "conservative" : "balanced";
  const rosterStyle: ManagerRosterStyle =
    managerArchetype === "win_now" || managerArchetype === "chaotic_aggressive"
      ? "star_heavy"
      : managerArchetype === "small_elite"
        ? "small_elite"
      : managerArchetype === "value_builder"
        ? "budget_squad"
        : managerArchetype === "harmony_builder" && input.team.teamId === "T-T"
          ? "wide_depth"
          : depthHigh || input.team.teamId === "T-T"
            ? "wide_depth"
            : valueHigh
              ? "prospect_pool"
              : "balanced_core";
  const riskTolerance: ManagerRiskTolerance = managerArchetype === "chaotic_aggressive" ? "chaotic" : riskHigh ? "high" : strategyScores.riskAppetite <= 35 || levelLow(bias?.riskTolerance) ? "low" : "medium";
  const qualityFloor: ManagerQualityFloor = managerArchetype === "win_now" || managerArchetype === "small_elite" ? "high" : starHigh ? "high" : spendingStyle === "emergency" ? "low" : "medium";
  const underOptPolicy: UnderOptPolicy =
    managerArchetype === "win_now" || managerArchetype === "chaotic_aggressive"
      ? "never"
      : managerArchetype === "small_elite"
        ? "only_if_readiness_high"
        : managerArchetype === "value_builder" || managerArchetype === "conservative_finance"
          ? "eco_allowed"
          : "market_wait_allowed";
  const draftDoctrine: DraftDoctrine =
    input.team.teamId === "R-R"
      ? "salary_value"
      : managerArchetype === "win_now" || managerArchetype === "chaotic_aggressive"
        ? "all_in_star_push"
        : managerArchetype === "small_elite"
          ? "star_core"
          : managerArchetype === "theme_collector"
            ? "theme_specialist"
            : managerArchetype === "value_builder" || managerArchetype === "conservative_finance"
              ? "pure_value"
              : managerArchetype === "harmony_builder" || rosterStyle === "wide_depth"
                ? "depth_rotation"
                : valueHigh || (input.identity?.ambition ?? 5) <= 4
                  ? "rebuild_value"
                  : "balanced";

  return {
    teamId: input.team.teamId,
    teamName: input.team.name,
    managerArchetype,
    spendingStyle,
    rosterStyle,
    riskTolerance,
    qualityFloor,
    underOptPolicy,
    prospectPolicy: managerArchetype === "rebuild" || managerArchetype === "value_builder" ? "high" : managerArchetype === "win_now" ? "limited" : "normal",
    salaryDiscipline: spendingStyle === "aggressive" ? "loose" : spendingStyle === "value" || spendingStyle === "conservative" ? "strict" : "normal",
    identityStrictness: themeHigh || managerArchetype === "theme_collector" ? "high" : managerArchetype === "value_builder" ? "medium" : "low",
    themeStrictness: themeHigh || managerArchetype === "theme_collector" ? "high" : "medium",
    draftDoctrine,
    reason: `team=${input.team.teamId};cash=${roundValue(input.team.cash)};scores=${strategyScores.archetype};star=${strategyScores.starHunting};value=${strategyScores.valueDiscipline};risk=${strategyScores.riskAppetite};theme=${strategyScores.themeCommitment};doctrine=${draftDoctrine};roster=${input.roster.length}`,
  };
}

function buildManagerProfiles(input: {
  gameState: GameState;
  strategyProfiles: Record<string, TeamStrategyProfile>;
}) {
  const rostersByTeam = groupRostersByTeam(input.gameState.rosters);
  return new Map(
    input.gameState.teams.map((team) => [
      team.teamId,
      compileTeamManagerProfile({
        gameState: input.gameState,
        team,
        identity: input.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId),
        strategyProfile: input.strategyProfiles[team.teamId],
        roster: rostersByTeam.get(team.teamId) ?? [],
      }),
    ]),
  );
}

function buildSeasonStrategyPlan(input: {
  team: GameState["teams"][number];
  profile: TeamManagerProfile;
  targetPlan: RosterTargetPlan;
}): SeasonStrategyPlan {
  const strategy: SeasonStrategy =
    input.team.cash < 20
      ? "cash_recovery"
      : input.profile.managerArchetype === "win_now" || input.profile.managerArchetype === "chaotic_aggressive"
        ? "win_now_push"
        : input.profile.managerArchetype === "small_elite"
          ? "small_elite_roster"
          : input.profile.managerArchetype === "value_builder"
            ? "balanced_growth"
            : input.profile.salaryDiscipline === "strict"
              ? "salary_control"
              : "balanced_growth";
  return {
    teamId: input.team.teamId,
    teamName: input.team.name,
    seasonStrategy: strategy,
    strategyReason: `${input.profile.managerArchetype};${input.targetPlan.targetReason}`,
    primaryGoals:
      strategy === "win_now_push"
        ? "Core/Star kaufen, Opt erreichen, Cash aktiv nutzen"
        : strategy === "small_elite_roster"
          ? "wenige starke vielseitige Spieler, Readiness statt Masse"
          : strategy === "balanced_growth"
            ? "Value und spielbaren Core verbinden"
            : "Cash/Salary stabilisieren",
    secondaryGoals: input.profile.prospectPolicy === "high" ? "Prospects mit echtem Value aufnehmen" : "Depth nur mit klarer Rolle",
    whatThisTeamWillAvoid:
      input.profile.salaryDiscipline === "strict" ? "teure Bench-Vertraege und C-Picks ohne Value" : "Low-Impact-Filler ohne Rollenbeitrag",
  };
}

function buildRosterBlueprint(input: {
  team: GameState["teams"][number];
  targetPlan: RosterTargetPlan;
  profile: TeamManagerProfile;
  strategyProfile: TeamStrategyProfile | null | undefined;
}): RosterBlueprintPlan {
  const target = input.targetPlan;
  const targetSize = target.desiredRosterTarget;
  const themeTarget = getTeamThemeCompositionTarget(input.team);
  return {
    teamId: input.team.teamId,
    teamName: input.team.name,
    desiredRosterTarget: targetSize,
    targetMode: target.targetMode,
    minStars: input.profile.rosterStyle === "star_heavy" ? 2 : input.profile.rosterStyle === "small_elite" ? 1 : 0,
    minCore: input.profile.rosterStyle === "budget_squad" ? 2 : 3,
    minStarter: Math.max(2, Math.min(targetSize, target.playerMin)),
    minDepth: Math.max(0, targetSize - target.playerMin),
    maxProspects: input.profile.prospectPolicy === "high" ? 4 : input.profile.prospectPolicy === "limited" ? 1 : 2,
    requiredRoles: target.requiredRoles,
    requiredAxisCoverage: target.preferredAxes,
    requiredClassCoverage: target.requiredClassBias,
    requiredDisciplineCoverage: "top_matchday_needs",
    preferredThemes: themeTarget
      ? `${themeTarget.primaryThemeTags.join("|")};target=${themeTarget.targetShare};min=${themeTarget.minimumShare}`
      : input.strategyProfile?.preferredArchetypes.join("|") ?? "",
    preferredRaces: input.strategyProfile?.preferredRaces.join("|") ?? "",
    preferredClasses: input.strategyProfile?.preferredClasses.join("|") ?? "",
    preferredSubclasses: input.strategyProfile?.secondaryArchetypes?.join("|") ?? "",
    qualityFloor: input.profile.qualityFloor,
    maxSalaryIncrease: target.maxSalaryIncrease,
    transferBudget: target.spendableBudget,
    salaryBudget: target.maxSalaryIncrease,
    reserveBudget: target.reserveBudget,
    allowedUnderOpt: target.allowedUnderOpt,
    allowedUnderMin: target.allowedUnderMin,
    stopEarlyRules: `${input.profile.underOptPolicy};min=${target.playerMin};desired=${target.desiredRosterTarget}`,
  };
}

function buildManagerMarketBoard(input: {
  team: GameState["teams"][number];
  teamName: string;
  candidates: ScoredCandidate[];
  blueprint: RosterBlueprintPlan;
  profile: TeamManagerProfile;
  limit?: number;
}): ManagerMarketBoardRow[] {
  return input.candidates.slice(0, input.limit ?? 24).map((candidate) => {
    const needFit = candidate.teamNeed.includes("POW") ? candidate.pow : candidate.teamNeed.includes("SPE") ? candidate.spe : candidate.teamNeed.includes("MEN") ? candidate.men : candidate.soc;
    const salaryRisk = candidate.salary == null ? 0 : roundValue(candidate.salary / Math.max(1, input.team.cash), 4);
    const traitRisk = (candidate.player.traitsNegative?.length ?? 0) * 4;
    const themeFit = candidate.classFit + candidate.identityFit * 0.08 + candidate.themeCompositionScore;
    const boardScore = candidate.selectedScore + candidate.identityFit * 0.35 + candidate.valueScore * 6 + candidate.themeCompositionScore * 0.8 - salaryRisk * 18 - traitRisk;
    const boardTier: MarketBoardTier =
      candidate.marketValue > input.team.cash
        ? "Avoid"
        : boardScore >= 118 ||
            (input.profile.managerArchetype === "win_now" && candidate.premiumAxisFit >= 72 && candidate.identityFit >= 68)
          ? "S Target"
          : boardScore >= 92
            ? "A Strong Fit"
            : boardScore >= 62
              ? "B Solid Fit"
              : boardScore >= 35
                ? "C Depth/Emergency"
                : "Avoid";
    return {
      teamId: input.team.teamId,
      teamName: input.teamName,
      playerId: candidate.player.id,
      name: candidate.player.name,
      currentRating: roundValue(candidate.quality, 2),
      potentialRange: getPotentialRange(candidate.player.potential),
      marketValue: candidate.marketValue,
      salary: candidate.salary,
      teamFit: roundValue(candidate.identityFit + candidate.classFit, 2),
      identityFit: candidate.identityFit,
      classFit: candidate.classFit,
      roleFit: candidate.classFit,
      needFit: roundValue(needFit, 2),
      valueScore: candidate.valueScore,
      salaryRisk,
      traitRisk,
      themeFit: roundValue(themeFit, 2),
      themeCompositionScore: candidate.themeCompositionScore,
      themeTier: candidate.themeTier,
      boardTier,
      reason: `${boardTier};need=${candidate.teamNeed};theme=${candidate.themeTier};blueprint=${input.blueprint.targetMode};profile=${input.profile.managerArchetype}`,
    };
  });
}

function scoreCandidateForTeam(input: {
  candidate: Candidate;
  roster: RosterEntry[];
  gameState: GameState;
  teamIdentity: TeamIdentity | null | undefined;
  strategyProfile: TeamStrategyProfile | null | undefined;
  team: GameState["teams"][number];
  phase: ChunkedRedraftPhase;
  maxRecommendedSpend: number;
  draftSalt: string;
  teamNeedState?: TeamNeedState | null;
  rosterClassCounts?: Map<string, number>;
  counters?: RedraftCandidateCounters;
  cashSalarySpendBoost?: number;
}): ScoredCandidate {
  const identityFit = getIdentityFit(input.candidate, input.teamIdentity);
  const premiumAxisFit = computePreferredAxisFit(input.candidate, input.teamIdentity);
  const axisFocusStrength = getAxisFocusStrength(input.teamIdentity);
  const classFit = input.rosterClassCounts
    ? getClassFitFromCounts(input.candidate, input.rosterClassCounts)
    : getClassFit(input.candidate, input.roster, input.gameState);
  const salaryImpact = roundValue(input.candidate.salary ?? 0, 2);
  const starBias = toBias(input.strategyProfile?.bias?.starPriority);
  const valueBias = toBias(input.strategyProfile?.bias?.valuePriority);
  const wageSensitivity = toBias(input.strategyProfile?.bias?.wageSensitivity);
  const depthBias = toBias(input.strategyProfile?.bias?.rosterDepthPreference);
  const potentialScore = roundValue(input.candidate.player.potential ?? 0, 2);
  if (input.counters) input.counters.themeScoreCalls += 1;
  const themeScore = calculateThemeCompositionScore({
    gameState: input.gameState,
    team: input.team,
    player: input.candidate.player,
    candidateQuality: Math.max(identityFit, premiumAxisFit),
    candidateRoleFit: classFit,
    currentTeamNeeds: [],
    phase: input.phase,
  });
  const themeWeight = input.phase === "phase_a_minimum" ? 0.45 : input.phase === "phase_b_core_optimum" ? 0.95 : 1.1;
  const valueScore = roundValue(
    (identityFit * 0.45 + premiumAxisFit * 0.35 + Math.max(0, themeScore.themeCompositionScore) * 0.2) /
      Math.max(1, salaryImpact + 5),
    4,
  );
  const marginalNeedGain = input.teamNeedState
    ? scoreMarginalNeedGain({ needState: input.teamNeedState, candidate: input.candidate.player })
    : null;
  const needImpactScore = roundValue(marginalNeedGain?.needScoreApplied ?? 0, 4);
  const areaDiversityScore = scoreRosterAreaDiversity({
    candidate: input.candidate,
    roster: input.roster,
    gameState: input.gameState,
    phase: input.phase,
    targetRosterSize: input.teamNeedState?.targetRosterSize ?? Math.max(input.roster.length + 1, 10),
  });
  const traitAlignmentScore = scoreStrategyTraitAlignment(input.candidate.player, input.strategyProfile);
  const needScoreWeight =
    input.phase === "phase_a_minimum" ? 0.85 : input.phase === "phase_b_core_optimum" ? 1.22 : 0.72;
  const budgetFit = 0;
  const focusedPremiumAxisPenalty =
    axisFocusStrength >= 0.65 && input.phase === "phase_b_core_optimum" && starBias >= 8
      ? Math.max(0, 64 - premiumAxisFit) * 0.85
      : 0;
  const phaseScore =
    input.phase === "phase_a_minimum"
      ? identityFit * 0.35 +
        premiumAxisFit * 0.45 +
        valueScore * (18 + valueBias * 0.8) +
        needImpactScore * needScoreWeight +
        areaDiversityScore +
        traitAlignmentScore +
        classFit * 0.65 +
        themeScore.themeCompositionScore * themeWeight -
        salaryImpact * 0.45
      : input.phase === "phase_b_core_optimum"
        ? identityFit * 0.95 +
          premiumAxisFit * (starBias >= 8 && axisFocusStrength >= 0.65 ? 0.55 : 0.18) +
          valueScore * (8 + valueBias * 0.7) +
          needImpactScore * needScoreWeight +
          areaDiversityScore +
          traitAlignmentScore +
          potentialScore * 0.12 +
          themeScore.themeCompositionScore * themeWeight +
          classFit -
          salaryImpact * (0.2 + wageSensitivity * 0.035) -
          focusedPremiumAxisPenalty
        : identityFit * 0.55 +
          premiumAxisFit * (axisFocusStrength >= 0.65 ? 0.28 : 0.1) +
          valueScore * (8 + valueBias * 0.6) +
          needImpactScore * needScoreWeight +
          areaDiversityScore +
          traitAlignmentScore +
          potentialScore * 0.08 +
          themeScore.themeCompositionScore * themeWeight +
          classFit * 1.15 +
          depthBias * 0.8 -
          salaryImpact * (0.35 + wageSensitivity * 0.04);
  const draftVariance = computeRedraftScoreVariance({
    draftSalt: input.draftSalt,
    teamId: input.team.teamId,
    playerId: input.candidate.player.id,
    phase: input.phase,
  });
  const cashSalarySpendBoost = input.cashSalarySpendBoost ?? 0;
  const selectedScore = roundValue(phaseScore + draftVariance + cashSalarySpendBoost, 4);
  const strongestAxis = marginalNeedGain?.bestAxis?.toUpperCase() ?? [
    ["POW", input.candidate.pow],
    ["SPE", input.candidate.spe],
    ["MEN", input.candidate.men],
    ["SOC", input.candidate.soc],
  ].sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] ?? "OVR";
  const formColorNeedLabel =
    marginalNeedGain && marginalNeedGain.formColorNeedScore >= 3 && marginalNeedGain.formColor
      ? `FORM_${marginalNeedGain.formColor.toUpperCase()}`
      : null;
  return {
    ...input.candidate,
    selectedScore,
    identityFit,
    premiumAxisFit,
    axisFocusStrength,
    needImpactScore,
    classFit,
    valueScore,
    themeCompositionScore: themeScore.themeCompositionScore,
    themeTier: themeScore.themeTier,
    themeTags: themeScore.playerThemeTags,
    themeReason: themeScore.reason,
    salaryImpact,
    budgetFit: roundValue(budgetFit, 2),
    potentialScore,
    phaseScore: roundValue(phaseScore, 4),
    draftVariance,
    teamNeed: formColorNeedLabel ?? (marginalNeedGain?.bestDisciplineName ? `${strongestAxis}_${marginalNeedGain.bestDisciplineName}` : `${strongestAxis}_coverage`),
    areaDiversityScore,
    traitAlignmentScore,
  };
}

function getTopRejectedCandidates(candidates: ScoredCandidate[], selectedPlayerId: string) {
  return candidates
    .filter((candidate) => candidate.player.id !== selectedPlayerId)
    .slice(0, 5)
    .map((candidate) => `${candidate.player.name}:${candidate.selectedScore}`)
    .join("|");
}

function getQualityTier(quality: number) {
  if (quality >= 85) return "star";
  if (quality >= 70) return "core";
  if (quality >= 55) return "rotation";
  if (quality >= 40) return "depth";
  return "minimum";
}

function getPotentialRange(potential: number | null | undefined) {
  const value = typeof potential === "number" && Number.isFinite(potential) ? potential : 0;
  if (value >= 85) return "elite";
  if (value >= 70) return "high";
  if (value >= 50) return "medium";
  if (value > 0) return "low";
  return "unknown";
}


function classifyRejectedCandidate(input: {
  rejected: ScoredCandidate;
  selected: ScoredCandidate;
  phasePlan: PhasePlan;
  teamCash: number;
  spendableBudget?: number | null;
  gameState?: GameState;
  teamId?: string;
}) {
  if (input.rejected.marketValue > input.teamCash) return "too_expensive" as const;
  const affordableBudget = resolveTransferAffordableBudget({
    teamCash: input.teamCash,
    cashReservePct: input.phasePlan.cashReservePct,
    spendableBudget: input.spendableBudget,
    gameState: input.gameState,
    teamId: input.teamId,
  });
  if (input.rejected.marketValue > affordableBudget + 0.01) return "reserve_guard" as const;
  if ((input.rejected.salary ?? 0) > (input.selected.salary ?? 0) * 1.8 && input.rejected.selectedScore <= input.selected.selectedScore) {
    return "salary_too_high" as const;
  }
  if (input.rejected.classFit < input.selected.classFit - 4) return "roster_role_duplication" as const;
  if (input.rejected.identityFit < input.selected.identityFit - 8) return "worse_fit" as const;
  if (input.rejected.teamNeed !== input.selected.teamNeed && input.rejected.selectedScore < input.selected.selectedScore) {
    return "lower_need_match" as const;
  }
  if (input.rejected.valueScore < input.selected.valueScore * 0.75) return "lower_value" as const;
  return "shortlist_cut" as const;
}

function buildRejectedCandidateRows(input: {
  round: number;
  teamId: string;
  selected: ScoredCandidate;
  candidates: ScoredCandidate[];
  phasePlan: PhasePlan;
  teamCash: number;
}): RejectedCandidateRow[] {
  return input.candidates
    .filter((candidate) => candidate.player.id !== input.selected.player.id)
    .slice(0, 5)
    .map((candidate, index) => {
      const category = classifyRejectedCandidate({
        rejected: candidate,
        selected: input.selected,
        phasePlan: input.phasePlan,
        teamCash: input.teamCash,
      });
      return {
        round: input.round,
        phase: input.phasePlan.phase,
        teamId: input.teamId,
        selectedPlayerId: input.selected.player.id,
        selectedPlayerName: input.selected.player.name,
        rejectedRank: index + 1,
        rejectedPlayerId: candidate.player.id,
        rejectedPlayerName: candidate.player.name,
        rejectedScore: candidate.selectedScore,
        rejectedMarketValue: candidate.marketValue,
        rejectedSalary: candidate.salary,
        rejectedCurrentRating: roundValue(candidate.quality, 2),
        rejectedFit: candidate.identityFit,
        rejectedReason: `${category};scoreDelta=${roundValue(input.selected.selectedScore - candidate.selectedScore, 2)};selectedFit=${input.selected.identityFit};rejectedFit=${candidate.identityFit}`,
        rejectionCategory: category,
      };
    });
}

function rejectedSummaryFields(rows: RejectedCandidateRow[]) {
  const fields: Partial<ChunkedRedraftPickRow> = {};
  rows.slice(0, 5).forEach((row, index) => {
    const slot = index + 1;
    (fields as Record<string, unknown>)[`topRejectedCandidate${slot}`] = row.rejectedPlayerName;
    (fields as Record<string, unknown>)[`topRejectedCandidate${slot}Score`] = row.rejectedScore;
    (fields as Record<string, unknown>)[`topRejectedCandidate${slot}Reason`] = row.rejectionCategory;
  });
  return fields;
}

function buildState(
  save: PersistedSaveGame,
  pickedPlayerIds: Set<string>,
  round: number,
  warnings: string[],
  completedTeamsInRound: string[] = [],
): ChunkedRedraftState {
  const rostersByTeam = groupRostersByTeam(save.gameState.rosters);
  const teamRosterCounts: Record<string, number> = {};
  const teamCash: Record<string, number> = {};
  const teamSalary: Record<string, number> = {};
  for (const team of save.gameState.teams) {
    const roster = rostersByTeam.get(team.teamId) ?? [];
    teamRosterCounts[team.teamId] = roster.length;
    teamCash[team.teamId] = roundValue(team.cash);
    teamSalary[team.teamId] = getRosterSalary(roster);
  }
  const remainingFreeAgentIds = buildCandidatePool(save.gameState, pickedPlayerIds).map((candidate) => candidate.player.id);
  return {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    round,
    completedTeamsInRound,
    pickedPlayerIds: [...pickedPlayerIds],
    remainingFreeAgentIds,
    teamRosterCounts,
    teamCash,
    teamSalary,
    warnings,
  };
}

function readResumeState(outputDir: string, saveId: string): ChunkedRedraftState | null {
  const filePath = path.join(outputDir, "chunked-redraft-state.json");
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ChunkedRedraftState;
  return parsed.saveId === saveId ? parsed : null;
}

function countDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([playerId, count]) => ({ playerId, count }));
}

function topReasons(rows: WarningRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function buildSummary(input: {
  initialSave: PersistedSaveGame;
  finalSave: PersistedSaveGame;
  picks: ChunkedRedraftPickRow[];
  memoryRows: MemoryRow[];
  warningRows: WarningRow[];
  roundDurations: Array<{ round: number; durationMs: number; picks: number }>;
  resumeTested: boolean;
}): ChunkedRedraftSummary {
  const finalState = input.finalSave.gameState;
  const rostersByTeam = groupRostersByTeam(finalState.rosters);
  const teamsBelowMin = finalState.teams
    .map((team) => {
      const target = getTeamTarget(finalState, team.teamId, "playerMin");
      return { teamId: team.teamId, rosterCount: rostersByTeam.get(team.teamId)?.length ?? 0, playerMin: target.playerMin };
    })
    .filter((row) => row.rosterCount < row.playerMin);
  const cashLeftWhileBelowMin = teamsBelowMin
    .map((row) => {
      const team = finalState.teams.find((entry) => entry.teamId === row.teamId);
      return { ...row, cash: roundValue(team?.cash ?? 0) };
    })
    .filter((row) => row.cash > 0);
  const duplicatePlayers = countDuplicates(finalState.rosters.map((entry) => entry.playerId));
  const negativeCashTeams = finalState.teams.filter((team) => team.cash < 0).map((team) => ({ teamId: team.teamId, cash: roundValue(team.cash) }));
  const picksMissingScores = input.picks
    .filter((pick) => !Number.isFinite(pick.selectedScore ?? pick.pickScore))
    .map((pick) => ({ round: pick.round, teamId: pick.teamId, playerId: pick.playerId }));
  const transferHistoryMismatch = finalState.transferHistory.length < input.picks.length;
  const invalidReasons = [
    input.initialSave.gameState.rosters.length === 0 ? null : "start_roster_not_empty",
    teamsBelowMin.length > 0 ? "teams_below_player_min" : null,
    cashLeftWhileBelowMin.length > 0 ? "cash_left_while_below_min" : null,
    duplicatePlayers.length > 0 ? "duplicate_players" : null,
    negativeCashTeams.length > 0 ? "negative_cash" : null,
    picksMissingScores.length > 0 ? "missing_pick_scores" : null,
    transferHistoryMismatch ? "transferhistory_incomplete" : null,
  ].filter((entry): entry is string => Boolean(entry));
  return {
    draftValid: invalidReasons.length === 0,
    invalidReasons,
    startWasEmpty: input.initialSave.gameState.rosters.length === 0,
    teamCount: finalState.teams.length,
    playerPool: finalState.players.length,
    freeAgentPoolStart: buildCandidatePool(input.initialSave.gameState, new Set()).length,
    picksTotal: input.picks.length,
    transferHistoryTotal: finalState.transferHistory.length,
    transferHistoryMismatch,
    picksMissingScores,
    duplicatePlayers,
    teamsBelowMin,
    cashLeftWhileBelowMin,
    teamsAtOpt: finalState.teams
      .map((team) => {
        const target = getTeamTarget(finalState, team.teamId, "playerOpt");
        return { teamId: team.teamId, rosterCount: rostersByTeam.get(team.teamId)?.length ?? 0, playerOpt: target.playerOpt };
      })
      .filter((row) => row.rosterCount >= row.playerOpt),
    teamsAboveMax: finalState.teams
      .map((team) => {
        const target = getTeamTarget(finalState, team.teamId, "playerOpt");
        return { teamId: team.teamId, rosterCount: rostersByTeam.get(team.teamId)?.length ?? 0, playerMax: target.playerMax };
      })
      .filter((row) => row.rosterCount > row.playerMax),
    negativeCashTeams,
    memoryPeakMb: input.memoryRows.reduce((peak, row) => Math.max(peak, row.heapUsedMb), 0),
    roundDurations: input.roundDurations,
    slowestPick: input.picks.reduce<ChunkedRedraftPickRow | null>((slowest, row) => (!slowest || row.durationMs > slowest.durationMs ? row : slowest), null),
    skipReasonTop10: topReasons(input.warningRows),
    resumeTested: input.resumeTested,
  };
}

function buildTeamRows(save: PersistedSaveGame, warningRows: WarningRow[]): TeamStatusRow[] {
  const rostersByTeam = groupRostersByTeam(save.gameState.rosters);
  const latestWarningByTeam = new Map<string, string>();
  for (const warning of warningRows) {
    latestWarningByTeam.set(warning.teamId, warning.reason);
  }
  return save.gameState.teams.map((team) => {
    const roster = rostersByTeam.get(team.teamId) ?? [];
    const target = getTeamTarget(save.gameState, team.teamId, "playerOpt");
    const rosterCount = roster.length;
    return {
      teamId: team.teamId,
      teamName: team.name,
      rosterCount,
      playerMin: target.playerMin,
      playerOpt: target.playerOpt,
      playerMax: target.playerMax,
      cash: roundValue(team.cash),
      salarySum: getRosterSalary(roster),
      status: rosterCount < target.playerMin ? "below_min" : rosterCount >= target.playerOpt ? "at_opt" : "above_min_below_opt",
      warning: latestWarningByTeam.get(team.teamId) ?? "",
    };
  });
}

function buildPhaseBCashAudit(input: {
  initialSave: PersistedSaveGame;
  finalSave: PersistedSaveGame;
  picks: ChunkedRedraftPickRow[];
  warningRows: WarningRow[];
  targetPlans?: Map<string, RosterTargetPlan>;
}) {
  const initialRosterByTeam = groupRostersByTeam(input.initialSave.gameState.rosters);
  const finalRosterByTeam = groupRostersByTeam(input.finalSave.gameState.rosters);
  return input.finalSave.gameState.teams.map((team) => {
    const initialTeam = input.initialSave.gameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
    const target = getTeamTarget(input.finalSave.gameState, team.teamId, "playerOpt");
    const plan = input.targetPlans?.get(team.teamId) ?? null;
    const teamPicks = input.picks.filter((pick) => pick.teamId === team.teamId);
    const phaseAPicks = teamPicks.filter((pick) => pick.phase === "phase_a_minimum");
    const phaseBPicks = teamPicks.filter((pick) => pick.phase === "phase_b_core_optimum");
    const rosterBefore = initialRosterByTeam.get(team.teamId)?.length ?? 0;
    const rosterAfter = finalRosterByTeam.get(team.teamId)?.length ?? 0;
    const cashAfterPhaseA = phaseAPicks.length > 0 ? phaseAPicks[phaseAPicks.length - 1]?.cashAfter ?? null : initialTeam.cash;
    const playerOptGapBefore = Math.max(0, target.playerOpt - rosterBefore);
    const playerOptGapAfter = Math.max(0, target.playerOpt - rosterAfter);
    const phaseBSpend = phaseBPicks.reduce((total, pick) => total + (pick.marketValue ?? 0), 0);
    const spendableCash = Math.max(0, (cashAfterPhaseA ?? team.cash) * 0.9);
    const cashLeftWhileBelowMin = rosterAfter < target.playerMin && team.cash > 0;
    const teamWarnings = input.warningRows.filter((row) => row.teamId === team.teamId).map((row) => row.reason);
    const whyStopped =
      rosterAfter >= target.playerOpt
        ? "playerOpt_reached"
        : rosterAfter >= target.playerMax
          ? "playerMax_reached"
          : teamWarnings.at(-1) ?? "round_limit_or_no_progress";
    const openNeeds = playerOptGapAfter > 0 ? `playerOpt_gap:${playerOptGapAfter}` : "";
    const hardFail =
      playerOptGapAfter > 0 &&
      !plan?.allowedUnderOpt &&
      team.cash > spendableCash * 0.35 &&
      !["no_affordable_candidate", "team_player_max_reached"].includes(whyStopped);
    return {
      teamId: team.teamId,
      teamName: team.name,
      cashStart: roundValue(initialTeam.cash),
      cashAfterPhaseA: roundValue(cashAfterPhaseA ?? team.cash),
      cashAfterPhaseB: roundValue(team.cash),
      cashUnused: roundValue(team.cash),
      reservedCash: roundValue((cashAfterPhaseA ?? team.cash) - spendableCash),
      spendableCash: roundValue(spendableCash),
      phaseBSpend: roundValue(phaseBSpend),
      playerMin: target.playerMin,
      playerMinGapAfter: Math.max(0, target.playerMin - rosterAfter),
      playerOptGapBefore,
      playerOptGapAfter,
      cashLeftWhileBelowMin,
      openNeeds,
      whyStopped,
      targetMode: plan?.targetMode ?? "",
      targetReason: plan?.targetReason ?? "",
      wasStopIntentional: playerOptGapAfter === 0 || Boolean(plan?.allowedUnderOpt),
      hardFail,
      warnings: teamWarnings.join("|"),
    };
  });
}

function buildManagerStopReasons(input: {
  finalSave: PersistedSaveGame;
  targetPlans: Map<string, RosterTargetPlan>;
  managerProfiles: Map<string, TeamManagerProfile>;
  warningRows: WarningRow[];
  marketBoardRows: ManagerMarketBoardRow[];
}): ManagerStopReasonRow[] {
  const rostersByTeam = groupRostersByTeam(input.finalSave.gameState.rosters);
  return input.finalSave.gameState.teams.map((team) => {
    const target = input.targetPlans.get(team.teamId) ?? buildRosterTargetPlan({
      gameState: input.finalSave.gameState,
      teamId: team.teamId,
      target: "playerOpt",
      strategyProfile: null,
      candidatePool: [],
      minimumRosterTargetOverride: input.targetPlans.get(team.teamId)?.minTarget,
    });
    const profile = input.managerProfiles.get(team.teamId);
    const rosterCount = rostersByTeam.get(team.teamId)?.length ?? 0;
    const latestWarning = input.warningRows.filter((row) => row.teamId === team.teamId).at(-1);
    const goodCandidateExists = input.marketBoardRows.some(
      (row) => row.teamId === team.teamId && (row.boardTier === "S Target" || row.boardTier === "A Strong Fit") && row.marketValue <= team.cash,
    );
    const belowMin = rosterCount < target.playerMin;
    const underOpt = rosterCount < target.desiredRosterTarget;
    const muchCashLeft = team.cash > Math.max(40, target.maxTransferSpend * 2);
    const red =
      belowMin ||
      (underOpt && muchCashLeft && goodCandidateExists) ||
      ((profile?.managerArchetype === "win_now" || profile?.managerArchetype === "chaotic_aggressive") && underOpt && muchCashLeft && goodCandidateExists);
    const yellow = !red && underOpt;
    return {
      teamId: team.teamId,
      teamName: team.name,
      rosterCount,
      desiredRosterTarget: target.desiredRosterTarget,
      playerMin: target.playerMin,
      cash: roundValue(team.cash),
      stopSeverity: red ? "red" : yellow ? "yellow" : "green",
      stopReason: red
        ? belowMin
          ? "below_player_min"
          : "under_target_with_cash_and_good_candidates"
        : yellow
          ? latestWarning?.reason ?? "under_target_but_season_legal"
          : "desired_target_reached_or_intentional",
    };
  });
}

function planToCsvRow(plan: RosterTargetPlan) {
  return {
    teamId: plan.teamId,
    teamName: plan.teamName,
    strategyProfile: plan.strategyProfile,
    playerMin: plan.playerMin,
    playerOpt: plan.playerOpt,
    playerMax: plan.playerMax,
    seasonLegalMin: plan.seasonLegalMin,
    desiredRosterTarget: plan.desiredRosterTarget,
    targetMode: plan.targetMode,
    targetReason: plan.targetReason,
    cashStart: plan.cashStart,
    salaryStart: plan.salaryStart,
    spendableBudget: plan.spendableBudget,
    reserveBudget: plan.reserveBudget,
    reservePolicy: plan.reservePolicy,
    budgetCaution01: plan.budgetCaution01,
    budgetAggression01: plan.budgetAggression01,
    budgetPostureScore: plan.budgetPostureScore,
    salaryBurdenRatio: plan.salaryBurdenRatio,
    cashRunwayRatio: plan.cashRunwayRatio,
    salaryFactorCurrent: plan.salaryFactorCurrent,
    sponsorSupportForecast5: plan.sponsorSupportForecast5.join("|"),
    spendWindowFloor: plan.spendWindowFloor,
    spendWindowBase: plan.spendWindowBase,
    spendWindowCeiling: plan.spendWindowCeiling,
    softSlotBudget: plan.softSlotBudget,
    maxTransferSpend: plan.maxTransferSpend,
    maxSalaryIncrease: plan.maxSalaryIncrease,
    qualityFloor: plan.qualityFloor,
    requiredRoles: plan.requiredRoles,
    preferredAxes: plan.preferredAxes,
    requiredClassBias: plan.requiredClassBias,
    identityFitPriority: plan.identityFitPriority,
    potentialPriority: plan.potentialPriority,
    currentRatingPriority: plan.currentRatingPriority,
    valuePriority: plan.valuePriority,
    riskTolerance: plan.riskTolerance,
    allowedUnderOpt: plan.allowedUnderOpt,
    allowedUnderMin: plan.allowedUnderMin,
    ecoRound: plan.ecoRound,
    expectedWeaknessIfStopEarly: plan.expectedWeaknessIfStopEarly,
    teamReadinessScore: plan.readiness.teamReadinessScore,
    canStopBelowOpt: plan.readiness.canStopBelowOpt,
    canStopBelowMin: plan.readiness.canStopBelowMin,
    stopEarlyReason: plan.readiness.stopEarlyReason,
  };
}

function buildUnderOptStopAudit(input: {
  finalSave: PersistedSaveGame;
  targetPlans: Map<string, RosterTargetPlan>;
  candidatePool: Candidate[];
  warningRows: WarningRow[];
}) {
  const rostersByTeam = groupRostersByTeam(input.finalSave.gameState.rosters);
  return input.finalSave.gameState.teams
    .map((team) => {
      const plan = input.targetPlans.get(team.teamId);
      const rosterCount = rostersByTeam.get(team.teamId)?.length ?? 0;
      const topAvailable = input.candidatePool[0] ?? null;
      const topAffordable = input.candidatePool.find((candidate) => candidate.marketValue <= team.cash) ?? null;
      const topFit = input.candidatePool
        .map((candidate) => ({ candidate, fit: getIdentityFit(candidate, input.finalSave.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId)) }))
        .sort((left, right) => right.fit - left.fit)[0] ?? null;
      const opt = plan?.playerOpt ?? getTeamTarget(input.finalSave.gameState, team.teamId, "playerOpt").playerOpt;
      const underOpt = rosterCount < opt;
      const latestWarning = input.warningRows.filter((row) => row.teamId === team.teamId).at(-1);
      const wasStopIntentional = !underOpt || Boolean(plan?.allowedUnderOpt);
      const identity = input.finalSave.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const goodAffordable =
        topAffordable != null &&
        getIdentityFit(topAffordable, identity) >= 55 &&
        computePreferredAxisFit(topAffordable, identity) >= 55;
      const hardFail = underOpt && !wasStopIntentional && team.cash > 40 && goodAffordable;
      return {
        teamId: team.teamId,
        teamName: team.name,
        rosterCount,
        playerOpt: opt,
        cashLeft: roundValue(team.cash),
        salaryLeft: getRosterSalary(rostersByTeam.get(team.teamId) ?? []),
        targetMode: plan?.targetMode ?? "",
        stopReason: latestWarning?.reason ?? (underOpt ? "unknown_underopt_stop" : "playerOpt_reached"),
        topAvailableCandidate: topAvailable ? `${topAvailable.player.name}:${roundValue(topAvailable.quality)}:${topAvailable.marketValue}` : "",
        topAffordableCandidate: topAffordable ? `${topAffordable.player.name}:${roundValue(topAffordable.quality)}:${topAffordable.marketValue}` : "",
        topFitCandidate: topFit ? `${topFit.candidate.player.name}:${topFit.fit}:${topFit.candidate.marketValue}` : "",
        whyNotBought: underOpt ? latestWarning?.reason ?? "not_logged" : "target_reached",
        wasStopIntentional,
        draftValidity: hardFail ? "red" : underOpt ? "yellow" : "green",
      };
    })
    .filter((row) => row.rosterCount < row.playerOpt);
}

function writeRedraftInstrumentationArtifacts(input: {
  outputDir: string;
  progressRows: ProgressLogRow[];
  counters: RedraftCandidateCounters;
  memoryRows?: MemoryRow[];
  phaseRows?: PhaseRow[];
  picks?: ChunkedRedraftPickRow[];
  warningRows?: WarningRow[];
}) {
  writeCsv(input.outputDir, "redraft-progress-log.csv", input.progressRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "redraft-candidate-counters.csv", [input.counters] as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "redraft-memory-trace.csv", (input.memoryRows ?? []) as unknown as Array<Record<string, unknown>>);
  writeJson(input.outputDir, "redraft-first-team-trace.json", {
    rows: input.progressRows.filter((row) => row.teamId && row.teamId !== "ALL").slice(0, 240),
    phaseRows: (input.phaseRows ?? []).filter((row) => row.teamId && row.teamId !== "ALL").slice(0, 120),
    picks: (input.picks ?? []).slice(0, 10),
    warnings: (input.warningRows ?? []).slice(0, 40),
  });
  writeMarkdown(
    input.outputDir,
    "redraft-first-pick-debug.md",
    [
      "# Redraft First Pick Debug",
      "",
      `- Progress rows: ${input.progressRows.length}`,
      `- Candidate scans: ${input.counters.candidateScans}`,
      `- Theme score calls: ${input.counters.themeScoreCalls}`,
      `- Buy preview calls: ${input.counters.buyPreviewCalls}`,
      `- Successful buys: ${input.counters.successfulBuys}`,
      `- Failed buys: ${input.counters.failedBuys}`,
      `- Save flushes: ${input.counters.saveFlushes}`,
      `- Last phase: ${input.progressRows.at(-1)?.phase ?? "n/a"}`,
      `- Last blocker: ${input.progressRows.findLast((row) => row.blocker)?.blocker ?? "none"}`,
    ].join("\n"),
  );
}

function writeReports(input: {
  outputDir: string;
  summary: ChunkedRedraftSummary;
  state: ChunkedRedraftState;
  initialSave: PersistedSaveGame;
  finalSave: PersistedSaveGame;
  picks: ChunkedRedraftPickRow[];
  rejectedRows: RejectedCandidateRow[];
  targetPlans?: Map<string, RosterTargetPlan>;
  managerProfiles?: Map<string, TeamManagerProfile>;
  seasonStrategies?: Map<string, SeasonStrategyPlan>;
  rosterBlueprints?: Map<string, RosterBlueprintPlan>;
  marketBoardRows?: ManagerMarketBoardRow[];
  draftRoleBoardRows?: DraftRoleBoardRow[];
  candidatePool?: Candidate[];
  memoryRows: MemoryRow[];
  warningRows: WarningRow[];
  phaseRows: PhaseRow[];
  progressRows?: ProgressLogRow[];
  counters?: RedraftCandidateCounters;
  reportMode?: "full" | "light";
}) {
  writeJson(input.outputDir, "chunked-redraft-state.json", input.state);
  writeJson(input.outputDir, "chunked-redraft-summary.json", input.summary);
  writeJson(input.outputDir, "topup-memory-audit.json", {
    summary: input.summary,
    rounds: input.summary.roundDurations,
    memoryRows: input.memoryRows,
    phaseRows: input.phaseRows,
  });
  writeMarkdown(
    input.outputDir,
    "chunked-redraft-summary.md",
    [
      "# Chunked Redraft / Topup Summary",
      "",
      `- DRAFT_VALID: ${input.summary.draftValid ? "true" : "false"}`,
      `- Invalid Gruende: ${input.summary.invalidReasons.length ? input.summary.invalidReasons.join(", ") : "keine"}`,
      `- Start war leer: ${input.summary.startWasEmpty ? "ja" : "nein"}`,
      `- Teams: ${input.summary.teamCount}`,
      `- Spielerpool: ${input.summary.playerPool}`,
      `- Free-Agent-Pool Start: ${input.summary.freeAgentPoolStart}`,
      `- Picks total: ${input.summary.picksTotal}`,
      `- Transferhistory total: ${input.summary.transferHistoryTotal}`,
      `- Teams unter Min: ${input.summary.teamsBelowMin.length}`,
      `- Cash uebrig trotz unter Min: ${input.summary.cashLeftWhileBelowMin.length}`,
      `- Fehlende Pick-Scores: ${input.summary.picksMissingScores.length}`,
      `- Teams bei Opt: ${input.summary.teamsAtOpt.length}`,
      `- Doppelte Spieler: ${input.summary.duplicatePlayers.length}`,
      `- Negative Cash Teams: ${input.summary.negativeCashTeams.length}`,
      `- Memory Peak: ${input.summary.memoryPeakMb} MB`,
      `- Resume getestet: ${input.summary.resumeTested ? "ja" : "nein"}`,
      "",
      "## Top Skip-Gruende",
      ...input.summary.skipReasonTop10.map((row) => `- ${row.reason}: ${row.count}`),
    ].join("\n"),
  );
  writeMarkdown(
    input.outputDir,
    "topup-memory-audit.md",
    [
      "# Topup Memory Audit",
      "",
      `- Memory Peak: ${input.summary.memoryPeakMb} MB`,
      `- Runden: ${input.summary.roundDurations.length}`,
      `- Picks: ${input.summary.picksTotal}`,
      `- Langsamster Pick: ${input.summary.slowestPick ? `${input.summary.slowestPick.teamId}/${input.summary.slowestPick.playerId} ${input.summary.slowestPick.durationMs}ms` : "n/a"}`,
    ].join("\n"),
  );
  if (input.reportMode === "light") {
    const targetPlanRows = [...(input.targetPlans?.values() ?? [])].map(planToCsvRow);
    const managerProfileRows = [...(input.managerProfiles?.values() ?? [])];
    const seasonStrategyRows = [...(input.seasonStrategies?.values() ?? [])];
    const rosterBlueprintRows = [...(input.rosterBlueprints?.values() ?? [])];
    const marketBoardRows = input.marketBoardRows ?? [];
    const draftRoleBoardRows = input.draftRoleBoardRows ?? [];
    const managerStopRows = input.targetPlans && input.managerProfiles
      ? buildManagerStopReasons({
          finalSave: input.finalSave,
          targetPlans: input.targetPlans,
          managerProfiles: input.managerProfiles,
          warningRows: input.warningRows,
          marketBoardRows,
        })
      : [];
    writeJson(input.outputDir, "roster-target-plan.json", [...(input.targetPlans?.values() ?? [])]);
    writeCsv(input.outputDir, "team-manager-profile-preview.csv", managerProfileRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "manager-ai-profile-preview.csv", managerProfileRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "season-strategy-plan.csv", seasonStrategyRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "roster-blueprint-plan.csv", rosterBlueprintRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "market-board-preview.csv", marketBoardRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "draft-role-board-preview.csv", draftRoleBoardRows as unknown as Array<Record<string, unknown>>);
    writeCsv(
      input.outputDir,
      "manager-pick-audit.csv",
      input.picks.map((pick) => ({
        round: pick.round,
        teamId: pick.teamId,
        playerId: pick.playerId,
        selectedPlayer: pick.playerName,
        selectedScore: pick.selectedScore ?? pick.pickScore,
        roleFilled: pick.roleFilled ?? pick.role ?? "",
        blueprintNeed: pick.blueprintNeed ?? pick.teamNeed ?? "",
        marketBoardTier: pick.marketBoardTier ?? "",
        topRejectedCandidates: pick.topRejectedCandidates ?? "",
        whySelected: pick.whySelected ?? pick.reasons,
        whyRejectedOthers: pick.whyRejectedOthers ?? "",
        cashBefore: pick.cashBefore,
        cashAfter: pick.cashAfter,
        salaryAfter: pick.salary,
        rosterBefore: pick.rosterBefore,
        rosterAfter: pick.rosterAfter,
        targetProgress: pick.targetProgress ?? "",
      })),
    );
    writeCsv(input.outputDir, "manager-stop-reasons.csv", managerStopRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "roster-target-plan.csv", targetPlanRows);
    writeMarkdown(
      input.outputDir,
      "manager-ai-redraft-summary.md",
      [
        "# Manager AI Redraft Summary",
        "",
        `- DRAFT_VALID: ${input.summary.draftValid ? "true" : "false"}`,
        `- Teams unter Min: ${input.summary.teamsBelowMin.length}`,
        `- Picks: ${input.summary.picksTotal}`,
        `- Report Mode: light`,
      ].join("\n"),
    );
    writeCsv(input.outputDir, "chunked-redraft-picks.csv", input.picks as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "redraft-phase-timings.csv", input.phaseRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "chunked-redraft-team-status.csv", buildTeamRows(input.finalSave, input.warningRows) as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "chunked-redraft-memory.csv", input.memoryRows as unknown as Array<Record<string, unknown>>);
    writeCsv(input.outputDir, "chunked-redraft-warnings.csv", input.warningRows as unknown as Array<Record<string, unknown>>);
    if (input.progressRows && input.counters) {
      writeRedraftInstrumentationArtifacts({
        outputDir: input.outputDir,
        progressRows: input.progressRows,
        counters: input.counters,
        memoryRows: input.memoryRows,
        phaseRows: input.phaseRows,
        picks: input.picks,
        warningRows: input.warningRows,
      });
    }
    return;
  }
  const phaseBCashAudit = buildPhaseBCashAudit({
    initialSave: input.initialSave,
    finalSave: input.finalSave,
    picks: input.picks,
    warningRows: input.warningRows,
    targetPlans: input.targetPlans,
  });
  const phaseBPicks = input.picks.filter((pick) => pick.phase === "phase_b_core_optimum");
  const phaseBHardFails = phaseBCashAudit.filter((row) => row.hardFail);
  const targetPlanRows = [...(input.targetPlans?.values() ?? [])].map(planToCsvRow);
  const managerProfileRows = [...(input.managerProfiles?.values() ?? [])];
  const seasonStrategyRows = [...(input.seasonStrategies?.values() ?? [])];
  const rosterBlueprintRows = [...(input.rosterBlueprints?.values() ?? [])];
  const marketBoardRows = input.marketBoardRows ?? [];
  const draftRoleBoardRows = input.draftRoleBoardRows ?? [];
  const managerStopRows = input.targetPlans && input.managerProfiles
    ? buildManagerStopReasons({
        finalSave: input.finalSave,
        targetPlans: input.targetPlans,
        managerProfiles: input.managerProfiles,
        warningRows: input.warningRows,
        marketBoardRows,
      })
    : [];
  const readinessRows = [...(input.targetPlans?.values() ?? [])].map((plan) => ({
    teamName: plan.teamName,
    ...plan.readiness,
  }));
  const underOptStopAudit = input.targetPlans
    ? buildUnderOptStopAudit({
        finalSave: input.finalSave,
        targetPlans: input.targetPlans,
        candidatePool: input.candidatePool ?? [],
        warningRows: input.warningRows,
      })
    : [];
  const ecoRows = [...(input.targetPlans?.values() ?? [])]
    .filter((plan) => plan.ecoRound)
    .map((plan) => ({
      teamId: plan.teamId,
      teamName: plan.teamName,
      whyEco: plan.whyEco ?? "",
      savedCash: plan.reserveBudget,
      opportunityCost: plan.expectedWeaknessIfStopEarly,
      skippedCandidates: "see_underopt_stop_audit",
      expectedPerformanceRisk: plan.expectedWeaknessIfStopEarly,
      boardAcceptance: plan.readiness.boardPressureRisk < 60 ? "accepted" : "risky",
      nextMarketPlan: plan.nextMarketPlan ?? "",
    }));
  writeJson(input.outputDir, "roster-target-plan.json", [...(input.targetPlans?.values() ?? [])]);
  writeCsv(input.outputDir, "team-manager-profile-preview.csv", managerProfileRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "manager-ai-profile-preview.csv", managerProfileRows as unknown as Array<Record<string, unknown>>);
  writeMarkdown(
    input.outputDir,
    "team-manager-profile-preview.md",
    [
      "# Team Manager Profile Preview",
      "",
      ...managerProfileRows.map((row) => `- ${row.teamId} ${row.teamName}: ${row.managerArchetype}, ${row.spendingStyle}, ${row.rosterStyle}, floor ${row.qualityFloor}`),
    ].join("\n"),
  );
  writeMarkdown(
    input.outputDir,
    "manager-ai-profile-preview.md",
    [
      "# Manager AI Profile Preview",
      "",
      ...managerProfileRows.map((row) => `- ${row.teamId}: ${row.managerArchetype} · spend ${row.spendingStyle} · roster ${row.rosterStyle} · underOpt ${row.underOptPolicy}`),
    ].join("\n"),
  );
  writeCsv(input.outputDir, "season-strategy-plan.csv", seasonStrategyRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "roster-blueprint-plan.csv", rosterBlueprintRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "market-board-preview.csv", marketBoardRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "draft-role-board-preview.csv", draftRoleBoardRows as unknown as Array<Record<string, unknown>>);
  writeCsv(
    input.outputDir,
    "manager-pick-audit.csv",
    input.picks.map((pick) => ({
      round: pick.round,
      teamId: pick.teamId,
      playerId: pick.playerId,
      selectedPlayer: pick.playerName,
      selectedScore: pick.selectedScore ?? pick.pickScore,
      roleFilled: pick.roleFilled ?? pick.role ?? "",
      blueprintNeed: pick.blueprintNeed ?? pick.teamNeed ?? "",
      marketBoardTier: pick.marketBoardTier ?? "",
      topRejectedCandidates: pick.topRejectedCandidates ?? "",
      whySelected: pick.whySelected ?? pick.reasons,
      whyRejectedOthers: pick.whyRejectedOthers ?? "",
      cashBefore: pick.cashBefore,
      cashAfter: pick.cashAfter,
      salaryBefore: "",
      salaryAfter: pick.salary,
      rosterBefore: pick.rosterBefore,
      rosterAfter: pick.rosterAfter,
      targetProgress: pick.targetProgress ?? "",
    })),
  );
  writeCsv(input.outputDir, "manager-stop-reasons.csv", managerStopRows as unknown as Array<Record<string, unknown>>);
  writeCsv(
    input.outputDir,
    "manager-team-summary.csv",
    buildTeamRows(input.finalSave, input.warningRows).map((row) => ({
      ...row,
      managerArchetype: input.managerProfiles?.get(row.teamId)?.managerArchetype ?? "",
      seasonStrategy: input.seasonStrategies?.get(row.teamId)?.seasonStrategy ?? "",
      desiredRosterTarget: input.rosterBlueprints?.get(row.teamId)?.desiredRosterTarget ?? "",
      stopSeverity: managerStopRows.find((entry) => entry.teamId === row.teamId)?.stopSeverity ?? "",
    })) as unknown as Array<Record<string, unknown>>,
  );
  writeMarkdown(
    input.outputDir,
    "manager-ai-redraft-summary.md",
    [
      "# Manager AI Redraft Summary",
      "",
      `- DRAFT_VALID: ${input.summary.draftValid ? "true" : "false"}`,
      `- Teams unter Min: ${input.summary.teamsBelowMin.length}`,
      `- Picks: ${input.summary.picksTotal}`,
      `- Stop Red: ${managerStopRows.filter((row) => row.stopSeverity === "red").length}`,
      `- Stop Yellow: ${managerStopRows.filter((row) => row.stopSeverity === "yellow").length}`,
      "",
      "## Fokus Teams",
      ...["M-M", "B-P", "C-C", "W-W", "Z-H", "T-T"].map((teamId) => {
        const profile = input.managerProfiles?.get(teamId);
        const stop = managerStopRows.find((row) => row.teamId === teamId);
        const blueprint = input.rosterBlueprints?.get(teamId);
        return `- ${teamId}: ${profile?.managerArchetype ?? "?"}, target ${blueprint?.desiredRosterTarget ?? "?"}, stop ${stop?.stopSeverity ?? "?"}/${stop?.stopReason ?? "?"}`;
      }),
    ].join("\n"),
  );
  writeCsv(input.outputDir, "roster-target-plan.csv", targetPlanRows);
  writeCsv(input.outputDir, "redraft-target-mode-audit.csv", targetPlanRows);
  writeCsv(input.outputDir, "underopt-stop-audit.csv", underOptStopAudit);
  writeCsv(input.outputDir, "eco-round-audit.csv", ecoRows);
  writeCsv(input.outputDir, "team-readiness-score.csv", readinessRows);
  writeMarkdown(
    input.outputDir,
    "roster-target-plan.md",
    [
      "# Roster Target Plan",
      "",
      `- Teams geplant: ${targetPlanRows.length}`,
      `- Default fill_to_optimum: ${targetPlanRows.filter((row) => row.targetMode === "fill_to_optimum").length}`,
      `- Win-now Push: ${targetPlanRows.filter((row) => row.targetMode === "win_now_push").length}`,
      `- Eco-Rounds: ${targetPlanRows.filter((row) => row.ecoRound).length}`,
      `- UnderOpt erlaubt: ${targetPlanRows.filter((row) => row.allowedUnderOpt).length}`,
      "",
      "## Teams",
      ...targetPlanRows.map((row) => `- ${row.teamId}: ${row.targetMode} -> ${row.desiredRosterTarget}/${row.playerOpt} (${row.targetReason})`),
    ].join("\n"),
  );
  writeMarkdown(
    input.outputDir,
    "redraft-validity-after-targeting.md",
    [
      "# Redraft Validity After Targeting",
      "",
      `- UnderOpt Stopps: ${underOptStopAudit.length}`,
      `- Red: ${underOptStopAudit.filter((row) => row.draftValidity === "red").length}`,
      `- Yellow: ${underOptStopAudit.filter((row) => row.draftValidity === "yellow").length}`,
      `- Green: ${underOptStopAudit.filter((row) => row.draftValidity === "green").length}`,
      "",
      "## Red Flags",
      ...underOptStopAudit
        .filter((row) => row.draftValidity === "red")
        .map((row) => `- ${row.teamId}: cash ${row.cashLeft}, top affordable ${row.topAffordableCandidate}, reason ${row.stopReason}`),
    ].join("\n"),
  );
  writeJson(input.outputDir, "chunked-redraft-phase-b-summary.json", {
    draftValid: input.summary.draftValid,
    invalidReasons: input.summary.invalidReasons,
    picksTotal: input.summary.picksTotal,
    phaseBPicks: phaseBPicks.length,
    teamsBelowMin: input.summary.teamsBelowMin,
    cashLeftWhileBelowMin: input.summary.cashLeftWhileBelowMin,
    picksMissingScores: input.summary.picksMissingScores,
    transferHistoryMismatch: input.summary.transferHistoryMismatch,
    teamsAtOpt: input.summary.teamsAtOpt,
    teamsAboveMax: input.summary.teamsAboveMax,
    duplicatePlayers: input.summary.duplicatePlayers,
    negativeCashTeams: input.summary.negativeCashTeams,
    memoryPeakMb: input.summary.memoryPeakMb,
    slowestPick: input.summary.slowestPick,
    phaseBHardFails,
    underOptStopAuditRed: underOptStopAudit.filter((row) => row.draftValidity === "red"),
  });
  writeMarkdown(
    input.outputDir,
    "chunked-redraft-phase-b-summary.md",
    [
      "# Chunked Redraft Phase B Summary",
      "",
      `- DRAFT_VALID: ${input.summary.draftValid ? "true" : "false"}`,
      `- Invalid Gruende: ${input.summary.invalidReasons.length ? input.summary.invalidReasons.join(", ") : "keine"}`,
      `- Picks total: ${input.summary.picksTotal}`,
      `- Phase-B Picks: ${phaseBPicks.length}`,
      `- Teams unter Min: ${input.summary.teamsBelowMin.length}`,
      `- Teams bei Opt: ${input.summary.teamsAtOpt.length}`,
      `- Doppelte Spieler: ${input.summary.duplicatePlayers.length}`,
      `- Negative Cash Teams: ${input.summary.negativeCashTeams.length}`,
      `- Memory Peak: ${input.summary.memoryPeakMb} MB`,
      `- Hard-Fail Cash/Opt Audits: ${phaseBHardFails.length}`,
      "",
      "## Fokus",
      ...["M-M", "Z-H", "B-P", "C-C", "W-W", "T-T"].map((teamId) => {
        const row = phaseBCashAudit.find((entry) => entry.teamId === teamId);
        return row
          ? `- ${teamId}: OptGap ${row.playerOptGapAfter}, Cash ${row.cashAfterPhaseB}, Stop ${row.whyStopped}`
          : `- ${teamId}: nicht gefunden`;
      }),
    ].join("\n"),
  );
  writeCsv(input.outputDir, "chunked-redraft-picks.csv", input.picks as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "topup-pick-performance.csv", input.picks as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "redraft-pick-timings.csv", input.picks as unknown as Array<Record<string, unknown>>);
  writeCsv(
    input.outputDir,
    "redraft-slowest-picks.csv",
    [...input.picks].sort((left, right) => right.durationMs - left.durationMs).slice(0, 20) as unknown as Array<Record<string, unknown>>,
  );
  writeCsv(input.outputDir, "redraft-phase-timings.csv", input.phaseRows as unknown as Array<Record<string, unknown>>);
  if (input.progressRows && input.counters) {
    writeRedraftInstrumentationArtifacts({
      outputDir: input.outputDir,
      progressRows: input.progressRows,
      counters: input.counters,
      memoryRows: input.memoryRows,
      phaseRows: input.phaseRows,
      picks: input.picks,
      warningRows: input.warningRows,
    });
  }
  writeCsv(
    input.outputDir,
    "redraft-pick-quality.csv",
    input.picks.map((pick) => ({
      round: pick.round,
      teamId: pick.teamId,
      phase: pick.phase ?? "",
      playerId: pick.playerId,
      playerName: pick.playerName,
      selectedScore: pick.selectedScore ?? pick.pickScore,
      role: pick.role ?? "",
      currentRating: pick.currentRating ?? "",
      potentialRange: pick.potentialRange ?? "",
      qualityTier: pick.qualityTier ?? "",
      axisFitPow: pick.axisFitPow ?? "",
      axisFitSpe: pick.axisFitSpe ?? "",
      axisFitMen: pick.axisFitMen ?? "",
      axisFitSoc: pick.axisFitSoc ?? "",
      teamNeed: pick.teamNeed ?? "",
      classFit: pick.classFit ?? "",
      identityFit: pick.identityFit ?? "",
      premiumAxisFit: pick.premiumAxisFit ?? "",
      axisFocusStrength: pick.axisFocusStrength ?? "",
      valueScore: pick.valueScore ?? "",
      themeCompositionScore: pick.themeCompositionScore ?? "",
      themeTier: pick.themeTier ?? "",
      themeTags: pick.themeTags ?? "",
      themeReason: pick.themeReason ?? "",
      salaryImpact: pick.salaryImpact ?? "",
      budgetFit: (pick as ChunkedRedraftPickRow & { budgetFit?: number }).budgetFit ?? "",
      topRejectedCandidates: pick.topRejectedCandidates ?? "",
      reason: pick.reasons,
    })),
  );
  writeCsv(
    input.outputDir,
    "chunked-redraft-phase-b-picks.csv",
    phaseBPicks.map((pick) => ({
      round: pick.round,
      phase: "playerOpt",
      teamId: pick.teamId,
      playerId: pick.playerId,
      playerName: pick.playerName,
      selectedScore: pick.selectedScore ?? pick.pickScore,
      marketValue: pick.marketValue,
      salary: pick.salary,
      cashBefore: pick.cashBefore,
      cashAfter: pick.cashAfter,
      rosterBefore: pick.rosterBefore,
      rosterAfter: pick.rosterAfter,
      teamNeed: pick.teamNeed ?? "",
      role: pick.role ?? "",
      currentRating: pick.currentRating ?? "",
      potentialRange: pick.potentialRange ?? "",
      axisFitPOW: pick.axisFitPow ?? "",
      axisFitSPE: pick.axisFitSpe ?? "",
      axisFitMEN: pick.axisFitMen ?? "",
      axisFitSOC: pick.axisFitSoc ?? "",
      classFit: pick.classFit ?? "",
      identityFit: pick.identityFit ?? "",
      premiumAxisFit: pick.premiumAxisFit ?? "",
      axisFocusStrength: pick.axisFocusStrength ?? "",
      valueScore: pick.valueScore ?? "",
      themeCompositionScore: pick.themeCompositionScore ?? "",
      themeTier: pick.themeTier ?? "",
      themeTags: pick.themeTags ?? "",
      salaryImpact: pick.salaryImpact ?? "",
      qualityTier: pick.qualityTier ?? "",
      reason: pick.reasons,
      topRejectedCandidate1: pick.topRejectedCandidate1 ?? "",
      topRejectedCandidate1Score: pick.topRejectedCandidate1Score ?? "",
      topRejectedCandidate1Reason: pick.topRejectedCandidate1Reason ?? "",
      topRejectedCandidate2: pick.topRejectedCandidate2 ?? "",
      topRejectedCandidate2Score: pick.topRejectedCandidate2Score ?? "",
      topRejectedCandidate2Reason: pick.topRejectedCandidate2Reason ?? "",
      topRejectedCandidate3: pick.topRejectedCandidate3 ?? "",
      topRejectedCandidate3Score: pick.topRejectedCandidate3Score ?? "",
      topRejectedCandidate3Reason: pick.topRejectedCandidate3Reason ?? "",
      topRejectedCandidate4: pick.topRejectedCandidate4 ?? "",
      topRejectedCandidate4Score: pick.topRejectedCandidate4Score ?? "",
      topRejectedCandidate4Reason: pick.topRejectedCandidate4Reason ?? "",
      topRejectedCandidate5: pick.topRejectedCandidate5 ?? "",
      topRejectedCandidate5Score: pick.topRejectedCandidate5Score ?? "",
      topRejectedCandidate5Reason: pick.topRejectedCandidate5Reason ?? "",
    })),
  );
  writeCsv(
    input.outputDir,
    "chunked-redraft-phase-b-rejected-candidates.csv",
    input.rejectedRows.filter((row) => row.phase === "phase_b_core_optimum") as unknown as Array<Record<string, unknown>>,
  );
  writeCsv(input.outputDir, "chunked-redraft-phase-b-cash-audit.csv", phaseBCashAudit);
  writeCsv(
    input.outputDir,
    "chunked-redraft-phase-b-pick-quality.csv",
    phaseBPicks.map((pick) => ({
      round: pick.round,
      teamId: pick.teamId,
      playerId: pick.playerId,
      playerName: pick.playerName,
      selectedScore: pick.selectedScore ?? pick.pickScore,
      role: pick.role ?? "",
      currentRating: pick.currentRating ?? "",
      potentialRange: pick.potentialRange ?? "",
      qualityTier: pick.qualityTier ?? "",
      teamNeed: pick.teamNeed ?? "",
      classFit: pick.classFit ?? "",
      identityFit: pick.identityFit ?? "",
      premiumAxisFit: pick.premiumAxisFit ?? "",
      axisFocusStrength: pick.axisFocusStrength ?? "",
      valueScore: pick.valueScore ?? "",
      themeCompositionScore: pick.themeCompositionScore ?? "",
      themeTier: pick.themeTier ?? "",
      themeTags: pick.themeTags ?? "",
      salaryImpact: pick.salaryImpact ?? "",
      budgetFit: pick.budgetFit ?? "",
      reason: pick.reasons,
    })),
  );
  writeCsv(input.outputDir, "chunked-redraft-team-status.csv", buildTeamRows(input.finalSave, input.warningRows) as unknown as Array<Record<string, unknown>>);
  writeCsv(
    input.outputDir,
    "team-theme-composition-audit.csv",
    buildTeamThemeCompositionAudit(input.finalSave.gameState, { candidateMissLimit: 300 }) as unknown as Array<Record<string, unknown>>,
  );
  writeCsv(input.outputDir, "chunked-redraft-phase-b-team-status.csv", buildTeamRows(input.finalSave, input.warningRows) as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-memory.csv", input.memoryRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "topup-memory-by-team.csv", input.memoryRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-warnings.csv", input.warningRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-phase-b-warnings.csv", input.warningRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-phase-b-performance.csv", input.phaseRows as unknown as Array<Record<string, unknown>>);
}

function writeRedraftAbortArtifacts(input: {
  outputDir: string;
  profiler: RedraftProfiler;
  counters: RedraftCandidateCounters;
  error: unknown;
  memoryRows?: MemoryRow[];
  phaseRows?: PhaseRow[];
  picks?: ChunkedRedraftPickRow[];
  warningRows?: WarningRow[];
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const existingBlocker = input.profiler.rows.findLast((row) => row.blocker);
  const row = existingBlocker ?? input.profiler.log("runner_abort", { blocker: message });
  if (!row.blocker) row.blocker = message;
  input.profiler.writeBlocker(message, row);
  writeRedraftInstrumentationArtifacts({
    outputDir: input.outputDir,
    progressRows: input.profiler.rows,
    counters: input.counters,
    memoryRows: input.memoryRows,
    phaseRows: input.phaseRows,
    picks: input.picks,
    warningRows: input.warningRows,
  });
}

export function runChunkedRedraftTopup(params: ChunkedRedraftTopupParams) {
  const persistence = params.persistence ?? createPersistenceService();
  const outputDir = params.outputDir ?? path.join(process.cwd(), "outputs");
  const dryRun = params.dryRun !== false;
  const target = params.target ?? "playerMin";
  const roundLimit = Math.max(1, Math.round(params.roundLimit ?? 16));
  const teamTimeLimitMs = Math.max(100, Math.round(params.teamTimeLimitMs ?? 10_000));
  const watchdogMs = Number.isFinite(params.watchdogMs) ? Math.round(params.watchdogMs ?? 30_000) : 30_000;
  const profiler = new RedraftProfiler(outputDir, watchdogMs);
  const counters = createRedraftCounters();
  const maxTeams = params.maxTeams != null && Number.isFinite(params.maxTeams) ? Math.max(1, Math.round(params.maxTeams)) : null;
  const reportMode = params.reportMode ?? (dryRun && maxTeams ? "light" : "full");
  profiler.log("runner_start", { warning: dryRun ? "dryRun" : null });
  const loadSaveStartedAt = profiler.start("load_save");
  const save = persistence.getSaveById(params.saveId);
  profiler.end("load_save", loadSaveStartedAt, { warning: save ? null : "save_missing" });
  if (!save) {
    writeRedraftAbortArtifacts({ outputDir, profiler, counters, error: new Error(`chunked_redraft_save_not_found:${params.saveId}`) });
    throw new Error(`chunked_redraft_save_not_found:${params.saveId}`);
  }
  if (save.gameState.season.id !== params.seasonId) {
    throw new Error(`chunked_redraft_season_mismatch:${save.gameState.season.id}:${params.seasonId}`);
  }
  if (params.mode === "season1_initial_topup" && params.seasonId !== "season-1") {
    throw new Error(`season1_autoprep_topup_forbidden_after_s1:${params.seasonId}`);
  }
  // Note (2026-07-04 phase-separation fix): preseason_roster_repair used to be forbidden in
  // season-1, but that contradicted the already-established policy in transfer-season-policy.ts
  // ("S1 buys are NOT forbidden... a team that sells down below hardMin/Opt in S1 must be able
  // to (re)buy in the very same season, exactly like any later season"). With sell/buy phase
  // separation, season-end sell-only passes can legitimately leave S1 teams below hardMin, and
  // they must be repairable at the following preseason start like any other season.
  if (!dryRun && params.confirmToken !== CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN) {
    throw new Error("chunked_redraft_confirm_token_required");
  }
  if (params.mode === "full_clean_redraft" && save.gameState.rosters.length > 0) {
    throw new Error(`full_clean_redraft_requires_empty_rosters:${save.gameState.rosters.length}`);
  }

  const resumeState = params.resume ? readResumeState(outputDir, save.saveId) : null;
  const resumeTested = Boolean(resumeState);
  const initialSave = save;
  const transferSource =
    params.mode === "full_clean_redraft"
      ? "full_churn_redraft_buy"
      : params.mode === "preseason_roster_repair"
        ? "preseason_roster_repair_buy"
        : "season1_autoprep_topup";
  const warnings: string[] = [...(resumeState?.warnings ?? [])];
  const pickedPlayerIds = new Set<string>([
    ...(resumeState?.pickedPlayerIds ?? []),
    ...save.gameState.rosters.map((entry) => entry.playerId),
  ]);
  const picks: ChunkedRedraftPickRow[] = [];
  const rejectedRows: RejectedCandidateRow[] = [];
  const marketBoardRows: ManagerMarketBoardRow[] = [];
  const draftRoleBoardRows: DraftRoleBoardRow[] = [];
  const memoryRows: MemoryRow[] = [];
  const warningRows: WarningRow[] = [];
  const phaseRows: PhaseRow[] = [];
  const roundDurations: Array<{ round: number; durationMs: number; picks: number }> = [];
  try {
  const contextStartedAt = profiler.start("build_game_state_context");
  const runContext = createLocalTransfermarktRunContext({ save, persistence });
  profiler.end("build_game_state_context", contextStartedAt, {
    rosterCount: runContext.save.gameState.rosters.length,
    freeAgentCount: runContext.save.gameState.players.length - runContext.save.gameState.rosters.length,
  });
  counters.teamsTotal = runContext.save.gameState.teams.length;
  counters.activeRostersStart = runContext.save.gameState.rosters.length;
  const teamMapsStartedAt = profiler.start("build_team_maps");
  const strategyProfiles = buildTeamStrategyProfileMap(
    runContext.save.gameState.teams,
    runContext.save.gameState.teamIdentities,
    runContext.save.gameState.seasonState.teamStrategyProfiles,
  );
  profiler.end("build_team_maps", teamMapsStartedAt, { candidateCount: Object.keys(strategyProfiles).length });
  const rosterMapsStartedAt = profiler.start("build_roster_maps");
  groupRostersByTeam(runContext.save.gameState.rosters);
  profiler.end("build_roster_maps", rosterMapsStartedAt, { rosterCount: runContext.save.gameState.rosters.length });
  const poolStartedAt = profiler.start("build_free_agent_pool");
  const initialCandidatePool = buildCandidatePool(runContext.save.gameState, pickedPlayerIds, counters);
  counters.freeAgentsStart = initialCandidatePool.length;
  profiler.end("build_free_agent_pool", poolStartedAt, { freeAgentCount: initialCandidatePool.length, candidateCount: initialCandidatePool.length });
  const marketCacheStartedAt = profiler.start("build_market_value_cache", { candidateCount: initialCandidatePool.length });
  profiler.end("build_market_value_cache", marketCacheStartedAt, { candidateCount: initialCandidatePool.length });
  const salaryCacheStartedAt = profiler.start("build_salary_cache", { candidateCount: initialCandidatePool.length });
  profiler.end("build_salary_cache", salaryCacheStartedAt, { candidateCount: initialCandidatePool.length });
  const themeTargetsStartedAt = profiler.start("build_theme_targets");
  const themeTargetCount = runContext.save.gameState.teams.filter((team) => getTeamThemeCompositionTarget(team.teamId)).length;
  profiler.end("build_theme_targets", themeTargetsStartedAt, { candidateCount: themeTargetCount });
  const managerProfilesStartedAt = profiler.start("build_manager_profiles");
  const managerProfiles = buildManagerProfiles({
    gameState: runContext.save.gameState,
    strategyProfiles,
  });
  profiler.end("build_manager_profiles", managerProfilesStartedAt, { candidateCount: managerProfiles.size });
  const targetPlansStartedAt = profiler.start("build_roster_target_plans", { candidateCount: initialCandidatePool.length });
  const requirePlayerOptTarget = target === "playerOpt";
  const targetPlans = buildRosterTargetPlans({
    gameState: runContext.save.gameState,
    saveId: runContext.save.saveId,
    target,
    strategyProfiles,
    candidatePool: initialCandidatePool,
    requirePlayerOptTarget,
    minimumRosterTargetOverride: params.minimumRosterTargetOverride,
  });
  profiler.end("build_roster_target_plans", targetPlansStartedAt, { candidateCount: targetPlans.size });
  const marketBoardsStartedAt = profiler.start("build_market_boards");
  profiler.end("build_market_boards", marketBoardsStartedAt, { candidateCount: 0 });
  const seasonStrategies = new Map(
    runContext.save.gameState.teams.map((team) => [
      team.teamId,
      buildSeasonStrategyPlan({
        team,
        profile: managerProfiles.get(team.teamId)!,
        targetPlan: targetPlans.get(team.teamId)!,
      }),
    ]),
  );
  const rosterBlueprints = new Map(
    runContext.save.gameState.teams.map((team) => [
      team.teamId,
      buildRosterBlueprint({
        team,
        targetPlan: targetPlans.get(team.teamId)!,
        profile: managerProfiles.get(team.teamId)!,
        strategyProfile: strategyProfiles[team.teamId],
      }),
    ]),
  );

  if (params.mode === "full_clean_redraft") {
    const sequentialStartedAt = Date.now();
    const candidatePool = initialCandidatePool;
    const targetTeamIdSet = new Set((params.targetTeamIds ?? []).filter(Boolean));
    const sortedTeamsForRun = targetTeamIdSet.size > 0
      ? runContext.save.gameState.teams.filter((team) => targetTeamIdSet.has(team.teamId))
      : [...runContext.save.gameState.teams].sort((teamA, teamB) => {
          const targetA = getTeamTarget(runContext.save.gameState, teamA.teamId, target);
          const targetB = getTeamTarget(runContext.save.gameState, teamB.teamId, target);
          const pressureA = teamA.cash / Math.max(1, targetA.targetRoster);
          const pressureB = teamB.cash / Math.max(1, targetB.targetRoster);
          if (pressureA !== pressureB) return pressureA - pressureB;
          return teamA.teamId.localeCompare(teamB.teamId, "de");
        });
    const teamsForRun = maxTeams ? sortedTeamsForRun.slice(0, maxTeams) : sortedTeamsForRun;
    const sequentialTeamRows: Array<Record<string, unknown>> = [];
    const sequentialPickRows: Array<Record<string, unknown>> = [];
    const sequentialIdentityRows: Array<Record<string, unknown>> = [];
    let globalPickIndex = 0;

    profiler.log("team_sequence_draft_start", {
      round: 1,
      teamId: "ALL",
      rosterCount: runContext.save.gameState.rosters.length,
      freeAgentCount: candidatePool.length,
      candidateCount: candidatePool.length,
    });

    for (const team of teamsForRun) {
      const teamStartedAt = Date.now();
      let teamPicks = 0;
      let teamErrors = 0;
      const teamWarnings: string[] = [];
      const scoredCandidateCache = new Map<string, ScoredCandidate>();
      const teamTarget = getTeamTarget(runContext.save.gameState, team.teamId, target);
      const teamTimeLimit = Math.max(teamTimeLimitMs, 60_000, teamTarget.targetRoster * 8_500);
      const minimumRosterTimeLimit = Math.max(teamTimeLimit, 180_000);
      const teamIdentity = runContext.save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const strategyProfile = strategyProfiles[team.teamId] ?? null;
      const targetPlan =
        targetPlans.get(team.teamId) ??
        buildRosterTargetPlan({
          gameState: runContext.save.gameState,
          teamId: team.teamId,
          target,
          strategyProfile,
          candidatePool,
          requirePlayerOptTarget,
          minimumRosterTargetOverride: params.minimumRosterTargetOverride,
        });
      const managerProfile = managerProfiles.get(team.teamId) ?? null;
      const seasonStrategy = seasonStrategies.get(team.teamId) ?? null;
      const rosterBlueprint = rosterBlueprints.get(team.teamId) ?? null;
      const themeTarget = getTeamThemeCompositionTarget(team);
      const desiredRosterTarget = Math.min(
        targetPlan?.desiredRosterTarget ?? teamTarget.targetRoster,
        teamTarget.playerMax,
      );
      const minTarget = Math.min(targetPlan?.minTarget ?? teamTarget.playerMin, teamTarget.playerMax);
      const maxTeamPicks =
        dryRun && maxTeams === 1 && roundLimit === 1
          ? 1
          : Math.max(0, desiredRosterTarget - runContext.save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length);

      profiler.log("team_sequence_start", {
        round: 1,
        teamId: team.teamId,
        rosterCount: runContext.save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
        freeAgentCount: candidatePool.length - pickedPlayerIds.size,
        candidateCount: candidatePool.length,
      });
      console.error(`[redraft] team_sequence_start ${team.teamId} target=${desiredRosterTarget} cash=${roundValue(team.cash)}`);

      while (true) {
        const latestTeam = runContext.save.gameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
        const teamRoster = runContext.save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
        const teamRosterPlayers = getRosterPlayers(runContext.save.gameState, teamRoster);
        const teamRosterClassCounts = buildRosterClassCounts(runContext.save.gameState, teamRoster);
        const rosterCount = teamRoster.length;
        if (rosterCount >= desiredRosterTarget || rosterCount >= teamTarget.playerMax || teamPicks >= maxTeamPicks) {
          break;
        }
        const elapsedTeamMs = Date.now() - teamStartedAt;
        if (elapsedTeamMs > teamTimeLimit) {
          if (rosterCount < minTarget && elapsedTeamMs <= minimumRosterTimeLimit) {
            if (!teamWarnings.includes("team_sequence_minimum_time_guard_extended")) {
              teamWarnings.push("team_sequence_minimum_time_guard_extended");
              warningRows.push({
                round: teamPicks + 1,
                teamId: team.teamId,
                reason: "team_sequence_minimum_time_guard_extended",
                detail: `${elapsedTeamMs}ms>${teamTimeLimit}ms;min=${rosterCount}/${minTarget}`,
              });
            }
          } else {
            teamWarnings.push("team_sequence_time_limit_reached");
            warningRows.push({ round: teamPicks + 1, teamId: team.teamId, reason: "team_sequence_time_limit_reached", detail: `${teamTimeLimit}ms` });
            break;
          }
        }

        const pickStartedAt = Date.now();
        const phasePlan = buildPhasePlan({
          target,
          rosterCount,
          teamTarget,
          targetPlan,
          teamCash: latestTeam.cash,
          strategyProfile,
          candidatePool,
          rebuildFocusActive: teamHasCashBufferRebuildFocus(runContext.save.gameState, team.teamId),
        });
        const stage0StartedAt = profiler.start("candidate_stage0", {
          round: teamPicks + 1,
          teamId: team.teamId,
          rosterCount,
          freeAgentCount: candidatePool.length - pickedPlayerIds.size,
        });
        const unpickedCandidates = candidatePool.filter((candidate) => !pickedPlayerIds.has(candidate.player.id));
        const cashReachableCandidates = unpickedCandidates.filter((candidate) => candidate.marketValue <= latestTeam.cash);
        const fitChecked = cashReachableCandidates.map((candidate) => {
          const teamFit = getCandidateTeamFitFromRosterPlayers({
            team: latestTeam,
            rosterPlayers: teamRosterPlayers,
            candidate,
          });
          const mercenary = hasMercenaryTrait(candidate.player);
          return {
            candidate,
            fit: {
              allowed: teamFit >= 0 || mercenary,
              teamFit,
              mercenary,
            },
          };
        });
        const fitByPlayerId = new Map(fitChecked.map((entry) => [entry.candidate.player.id, entry.fit] as const));
        const positiveFitCandidates = fitChecked.filter((entry) => entry.fit.teamFit >= 0).map((entry) => entry.candidate);
        const mercenaryFallbackCandidates = fitChecked
          .filter((entry) => entry.fit.teamFit < 0 && entry.fit.mercenary)
          .map((entry) => entry.candidate);
        const cashLegalCandidates = selectFitLegalCandidates({
          team: latestTeam,
          positiveFitCandidates,
          mercenaryFallbackCandidates,
        });
        const negativeFitBlocked = fitChecked.length - cashLegalCandidates.length;
        const cashBlocked = unpickedCandidates.length - cashReachableCandidates.length;
        profiler.end("candidate_stage0", stage0StartedAt, {
          round: teamPicks + 1,
          teamId: team.teamId,
          rosterCount,
          candidateCount: cashLegalCandidates.length,
          warning: `negativeFitBlocked=${negativeFitBlocked};cashBlocked=${cashBlocked};mercenaryFallback=${mercenaryFallbackCandidates.length}`,
        });

        profiler.log("team_sequence_need_eval", {
          round: teamPicks + 1,
          teamId: team.teamId,
          rosterCount,
          freeAgentCount: unpickedCandidates.length,
          candidateCount: cashLegalCandidates.length,
          warning: `negativeFitBlocked=${negativeFitBlocked};cashBlocked=${cashBlocked};mercenaryFallback=${mercenaryFallbackCandidates.length}`,
        });

        if (cashLegalCandidates.length === 0) {
          teamErrors += 1;
          teamWarnings.push("no_cash_legal_candidate");
          warningRows.push({ round: teamPicks + 1, teamId: team.teamId, reason: "no_cash_legal_candidate", detail: `cash=${latestTeam.cash};fitLegal=${cashLegalCandidates.length}` });
          break;
        }

        const stage1StartedAt = profiler.start("candidate_stage1", {
          round: teamPicks + 1,
          teamId: team.teamId,
          rosterCount,
          candidateCount: cashLegalCandidates.length,
        });
        const protectThemeMinimum = needsThemePickToProtectMinimum({
          gameState: runContext.save.gameState,
          roster: teamRoster,
          target: themeTarget,
          phase: phasePlan.phase,
        });
        const desiredDraftRole = protectThemeMinimum
          ? "theme"
          : getDesiredDraftRole({
              rosterCount,
              roster: teamRoster,
              gameState: runContext.save.gameState,
              phase: phasePlan.phase,
              profile: managerProfile,
              blueprint: rosterBlueprint,
              targetPlan,
              themeTarget,
            });
        const teamNeedState = buildTeamNeedState({
          gameState: runContext.save.gameState,
          team: latestTeam,
          teamIdentity,
          rosterPlayers: teamRosterPlayers,
          targetRosterSize: desiredRosterTarget,
          plannedPicksRemaining: Math.max(1, desiredRosterTarget - rosterCount),
        });
        const strategicPool = buildStrategicScoutingPool({
          planningPool: cashLegalCandidates,
          role: desiredDraftRole,
          phasePlan,
          targetPlan,
          teamCash: latestTeam.cash,
          rosterCount,
          desiredRosterTarget,
          identity: teamIdentity,
          themeTarget,
          needState: teamNeedState,
        });
        const scoredBase = strategicPool.pool
          .map((candidate) => {
            const classFit = getClassFitFromCounts(candidate, teamRosterClassCounts);
            const cacheKey = `${team.teamId}:${candidate.player.id}:${phasePlan.phase}:classFit=${classFit}:needs=${teamRoster.length}`;
            const cached = scoredCandidateCache.get(cacheKey);
            if (cached) return cached;
            const scored = scoreCandidateForTeam({
              candidate,
              roster: teamRoster,
              gameState: runContext.save.gameState,
              teamIdentity,
              strategyProfile,
              team: latestTeam,
              phase: phasePlan.phase,
              maxRecommendedSpend: phasePlan.maxRecommendedSpend,
              draftSalt: `${save.saveId}:${params.mode}:team_sequence:${team.teamId}`,
              teamNeedState,
              rosterClassCounts: teamRosterClassCounts,
              counters,
            });
            scoredCandidateCache.set(cacheKey, scored);
            return scored;
          });
        const strategicPlayerIds = new Set(scoredBase.map((candidate) => candidate.player.id));
        const emergencyPoolLimit =
          rosterCount < minTarget
            ? Math.min(140, Math.max(36, Math.ceil(cashLegalCandidates.length * 0.14)))
            : Math.min(64, Math.max(18, Math.ceil(cashLegalCandidates.length * 0.06)));
        const skipEmergencyForReserveLane = strategicPoolHasReserveLaneCandidates({
          candidates: scoredBase.map((entry) => ({
            marketValue: entry.marketValue,
            price: entry.marketValue,
          })),
          teamCash: latestTeam.cash,
          rosterBelowHardMin: rosterCount < minTarget,
        });
        const emergencyFallbackBase =
          rosterCount < desiredRosterTarget &&
          !shouldBlockEmergencyPathAtOpt(rosterCount, teamTarget.playerOpt) &&
          !skipEmergencyForReserveLane
            ? cashLegalCandidates
                .filter((candidate) => !strategicPlayerIds.has(candidate.player.id))
                .sort((left, right) => {
                  const leftPrice = Number(left["marketValue"]);
                  const rightPrice = Number(right["marketValue"]);
                  const leftNeed = getCandidateNeedAxisValue(left, teamNeedState);
                  const rightNeed = getCandidateNeedAxisValue(right, teamNeedState);
                  const leftValue = leftPrice / Math.max(1, left.salary ?? 1);
                  const rightValue = rightPrice / Math.max(1, right.salary ?? 1);
                  const leftScore = leftNeed * 0.65 + leftValue * 5 - leftPrice / 5.56;
                  const rightScore = rightNeed * 0.65 + rightValue * 5 - rightPrice / 5.56;
                  if (rightScore !== leftScore) return rightScore - leftScore;
                  return leftPrice - rightPrice;
                })
                .slice(0, emergencyPoolLimit)
                .map((candidate) => {
                  const classFit = getClassFitFromCounts(candidate, teamRosterClassCounts);
                  const cacheKey = `${team.teamId}:${candidate.player.id}:${phasePlan.phase}:classFit=${classFit}:needs=${teamRoster.length}:emergency`;
                  const cached = scoredCandidateCache.get(cacheKey);
                  if (cached) return cached;
                  const scored = scoreCandidateForTeam({
                    candidate,
                    roster: teamRoster,
                    gameState: runContext.save.gameState,
                    teamIdentity,
                    strategyProfile,
                    team: latestTeam,
                    phase: phasePlan.phase,
                    maxRecommendedSpend: phasePlan.maxRecommendedSpend,
                    draftSalt: `${save.saveId}:${params.mode}:team_sequence_emergency:${team.teamId}`,
                    teamNeedState,
                    rosterClassCounts: teamRosterClassCounts,
                    counters,
                  });
                  const softened = {
                    ...scored,
                    selectedScore: roundValue(scored.selectedScore - (rosterCount < minTarget ? 45 : 95), 4),
                    budgetFit: roundValue((scored.budgetFit ?? 0) - (rosterCount < minTarget ? 45 : 95), 2),
                    teamNeed: `fallback_${scored.teamNeed}`,
                  };
                  scoredCandidateCache.set(cacheKey, softened);
                  return softened;
                })
            : [];
        const roleRankedCandidates = applyDraftRoleIntent([...scoredBase, ...emergencyFallbackBase], desiredDraftRole);
        const futureSortedCandidates = [...roleRankedCandidates]
          .sort((candidateA, candidateB) => candidateA.marketValue - candidateB.marketValue);
        const remainingMinAfterPick = Math.max(0, minTarget - (rosterCount + 1));
        const remainingPlannedAfterPick = Math.max(0, desiredRosterTarget - (rosterCount + 1));
        const evaluatedCandidatePool = roleRankedCandidates.map((candidate) => {
            const cashAfter = latestTeam.cash - candidate.marketValue;
            const minimumFuture = estimateUsefulFutureCost({
              sortedCandidates: futureSortedCandidates,
              fallbackSortedCandidates: futureSortedCandidates,
              excludedPlayerId: candidate.player.id,
              neededCount: remainingMinAfterPick,
              phase: phasePlan.phase,
            });
            const plannedFuture = estimateUsefulFutureCost({
              sortedCandidates: futureSortedCandidates,
              fallbackSortedCandidates: futureSortedCandidates,
              excludedPlayerId: candidate.player.id,
              neededCount: remainingPlannedAfterPick,
              phase: phasePlan.phase,
            });
            const cheapestFutureCost = minimumFuture.cost;
            const cheapestPlannedCost = plannedFuture.cost;
            const futureGap = remainingMinAfterPick > 0 ? cheapestFutureCost - cashAfter : 0;
            const minimumFutureFeasible =
              remainingMinAfterPick <= 0 ||
              (Number.isFinite(cheapestFutureCost) && cheapestFutureCost <= cashAfter + 0.0001);
            const futurePenalty =
              Number.isFinite(futureGap) && futureGap > 0
                ? REDRAFT_FUTURE_MIN_BASE_PENALTY + futureGap * REDRAFT_FUTURE_MIN_GAP_PENALTY
                : !Number.isFinite(cheapestFutureCost)
                  ? REDRAFT_FUTURE_MIN_UNKNOWN_PENALTY
                  : 0;
            const plannedGap = remainingPlannedAfterPick > 0 ? cheapestPlannedCost - cashAfter : 0;
            const plannedDepthPenalty =
              Number.isFinite(plannedGap) && plannedGap > 0
                ? REDRAFT_PLANNED_DEPTH_BASE_PENALTY + plannedGap * REDRAFT_PLANNED_DEPTH_GAP_PENALTY
                : !Number.isFinite(cheapestPlannedCost) && remainingPlannedAfterPick > 0
                  ? REDRAFT_PLANNED_DEPTH_UNKNOWN_PENALTY
                  : 0;
            const usefulFuturePenalty =
              (remainingMinAfterPick > 0 && !minimumFuture.usefulCountEnough ? REDRAFT_USEFUL_MIN_FUTURE_PENALTY : 0) +
              (remainingPlannedAfterPick > 0 && !plannedFuture.usefulCountEnough ? REDRAFT_USEFUL_DEPTH_FUTURE_PENALTY : 0);
            const minRosterUrgency = rosterCount < minTarget ? (minTarget - rosterCount) * 3 : 0;
            const valueSafetyBonus = rosterCount < minTarget ? candidate.valueScore * 18 - (candidate.salary ?? 0) * 0.35 : 0;
            const teamFit = fitByPlayerId.get(candidate.player.id)?.teamFit ?? 0;
            const mercenary = fitByPlayerId.get(candidate.player.id)?.mercenary ?? hasMercenaryTrait(candidate.player);
            const marginalNeedGain = scoreMarginalNeedGain({ needState: teamNeedState, candidate: candidate.player });
            const inAxisHoleCompletionBonus = scoreInAxisHoleCompletion({ needState: teamNeedState, marginalGain: marginalNeedGain });
            const offAxisDetourPenalty = scoreOffAxisDetourPenalty({ needState: teamNeedState, marginalGain: marginalNeedGain });
            const formColorStackPenalty = scoreFormColorStackPenalty({ needState: teamNeedState, candidate: candidate.player, marginalGain: marginalNeedGain });
            const plannedBudgetRemaining = Math.max(0, latestTeam.cash - targetPlan.reserveBudget);
            const budgetForOverpay = Math.max(1, plannedBudgetRemaining || Math.min(latestTeam.cash, targetPlan.spendWindowFloor || latestTeam.cash));
            const overpayPenalty = scoreOverpayPenalty({
              candidateMarketValue: candidate.marketValue,
              candidateSalary: candidate.salary,
              remainingBudget: budgetForOverpay,
              plannedPicksRemaining: Math.max(1, desiredRosterTarget - rosterCount),
              needScoreApplied: marginalNeedGain.needScoreApplied,
              financePressure01: targetPlan.budgetCaution01,
            });
            const roleMismatchPenalty = scoreRoleMismatchPenalty({
              plannedRole: desiredDraftRole,
              candidateQuality: candidate.quality,
              needScoreApplied: marginalNeedGain.needScoreApplied,
              themeTier: candidate.themeTier,
              classFit: candidate.classFit,
            });
            const fitPenalty = scoreFitPenalty({ teamFit, mercenary });
            const sequenceFitBonus =
              candidate.identityFit * 0.28 +
              candidate.premiumAxisFit * 0.36 +
              Math.max(0, teamFit) * 1.15 +
              marginalNeedGain.needScoreApplied * 1.8;
            const candidatePrice = candidate.marketValue;
            const plannedSlotsIncludingPick = Math.max(1, desiredRosterTarget - rosterCount);
            const budgetPerPlannedSlot = Math.max(1, budgetForOverpay / plannedSlotsIncludingPick);
            const excellenceScore =
              candidate.identityFit * 0.36 +
              candidate.premiumAxisFit * 0.36 +
              Math.max(0, teamFit) * 0.18 +
              Math.max(0, candidate.themeCompositionScore) * 0.1;
            const overspendAllowance =
              rosterCount === 0
                ? 1.85
                : rosterCount < Math.min(3, minTarget)
                  ? 1.55
                  : rosterCount < minTarget
                    ? 1.32
                    : 1.18;
            const excellenceRelief = Math.max(0, excellenceScore - 72) * 0.018;
            const pacingLimit = Math.max(1, budgetPerPlannedSlot * (overspendAllowance + excellenceRelief));
            const pacingOverspend = Math.max(0, candidatePrice - pacingLimit);
            const rosterPacingPenalty =
              remainingPlannedAfterPick > 0
                ? pacingOverspend * (rosterCount < minTarget ? 180 : 95) * (excellenceScore >= 86 ? 0.35 : excellenceScore >= 78 ? 0.62 : 1)
                : 0;
            const infeasibleMinimumFallback =
              remainingMinAfterPick > 0 && (!Number.isFinite(cheapestFutureCost) || futureGap > 0)
                ? -candidatePrice * 70 - (candidate.salary ?? 0) * 18 + candidate.valueScore * 30 + sequenceFitBonus
                : 0;
            const starBudgetShockPenalty = 0;
            const anchorPick = rosterCount < Math.min(4, desiredRosterTarget);
            const anchorThemePenalty =
              anchorPick && themeTarget && (candidate.themeTier === "avoid" || candidate.themeTier === "outsider")
                ? candidate.themeTier === "avoid"
                  ? 140
                  : 55
                : 0;
            return {
              ...candidate,
              selectedScore: roundValue(
                candidate.selectedScore +
                  sequenceFitBonus +
                  inAxisHoleCompletionBonus +
                  valueSafetyBonus +
                  minRosterUrgency +
                  infeasibleMinimumFallback -
                  futurePenalty -
                  plannedDepthPenalty -
                  usefulFuturePenalty -
                  rosterPacingPenalty -
                  starBudgetShockPenalty -
                  offAxisDetourPenalty -
                  formColorStackPenalty -
                  overpayPenalty -
                  roleMismatchPenalty -
                  fitPenalty -
                  anchorThemePenalty,
                4,
              ),
              needImpactScore: marginalNeedGain.needScoreApplied,
              teamNeed: marginalNeedGain.formColorNeedScore >= 3 && marginalNeedGain.formColor
                ? `FORM_${marginalNeedGain.formColor.toUpperCase()}`
                : marginalNeedGain.bestDisciplineName
                ? `${marginalNeedGain.bestAxis.toUpperCase()}_${marginalNeedGain.bestDisciplineName}`
                : candidate.teamNeed,
              budgetFit: roundValue(
                -(
                  futurePenalty +
                  plannedDepthPenalty +
                  usefulFuturePenalty +
                  rosterPacingPenalty +
                  starBudgetShockPenalty +
                  offAxisDetourPenalty +
                  formColorStackPenalty +
                  overpayPenalty +
                  roleMismatchPenalty +
                  fitPenalty +
                  anchorThemePenalty
                ),
                2,
              ),
              minimumFutureFeasible,
              minimumFutureCost: Number.isFinite(cheapestFutureCost) ? roundValue(cheapestFutureCost, 2) : null,
              minimumFutureCashAfter: roundValue(cashAfter, 2),
            };
          });
        let evaluatedCandidates =
          remainingMinAfterPick <= 0
            ? evaluatedCandidatePool
            : evaluatedCandidatePool.filter((candidate) => Boolean(candidate.minimumFutureFeasible));
        const bestMinimumCandidateScore = evaluatedCandidates.reduce(
          (best, candidate) => Math.max(best, candidate.selectedScore),
          Number.NEGATIVE_INFINITY,
        );
        const shouldUseSurvivalBudgetFallback =
          evaluatedCandidatePool.length > 0 &&
          (
            (remainingMinAfterPick > 0 && (evaluatedCandidates.length === 0 || bestMinimumCandidateScore < 0)) ||
            (remainingMinAfterPick <= 0 && remainingPlannedAfterPick > 0 && bestMinimumCandidateScore < 0)
          );
        if (
          shouldUseSurvivalBudgetFallback
        ) {
          const survivalCandidatePool = fitChecked
            .filter((entry) => entry.fit.teamFit >= -12 || entry.fit.mercenary)
            .map((entry) => entry.candidate);
          const cheapestLegalFuture = [...survivalCandidatePool].sort((left, right) => {
            if (left.marketValue !== right.marketValue) return left.marketValue - right.marketValue;
            return (left.salary ?? 0) - (right.salary ?? 0);
          });
          const survivalBudgetRows = survivalCandidatePool.map((candidate) => {
            const cashAfter = latestTeam.cash - candidate.marketValue;
            const futureCost = estimateCheapestFutureCost({
              sortedCandidates: cheapestLegalFuture,
              excludedPlayerId: candidate.player.id,
              neededCount: remainingMinAfterPick,
            });
            const futureFeasible = Number.isFinite(futureCost) && futureCost <= cashAfter + 0.0001;
            const needAxis = getCandidateNeedAxisValue(candidate, teamNeedState);
            const classFit = getClassFitFromCounts(candidate, teamRosterClassCounts);
            const valueRatio = candidate.marketValue / Math.max(1, candidate.salary ?? 1);
            const teamFit = fitByPlayerId.get(candidate.player.id)?.teamFit ?? 0;
            const survivalScore =
              needAxis * 0.72 +
              candidate.quality * 0.18 +
              classFit * 1.4 +
              Math.max(0, teamFit) * 0.75 +
              valueRatio * 4.5 -
              candidate.marketValue * 1.65 -
              (candidate.salary ?? 0) * 2.4;
            return { candidate, futureCost, futureFeasible, survivalScore };
          });
          const futureSafeRows = survivalBudgetRows.filter((row) => row.futureFeasible);
          const fallbackSource = futureSafeRows.length > 0 ? futureSafeRows : survivalBudgetRows;
          const fallbackLimit = Math.min(96, Math.max(24, Math.ceil(fallbackSource.length * 0.22)));
          const survivalFallbackCandidates = fallbackSource
            .sort((left, right) => {
              if (right.survivalScore !== left.survivalScore) return right.survivalScore - left.survivalScore;
              if (left.candidate.marketValue !== right.candidate.marketValue) return left.candidate.marketValue - right.candidate.marketValue;
              return compareByDeterministicPlayerTie(left.candidate.player.id, right.candidate.player.id, `minimum_survival:${team.teamId}:${teamPicks}`);
            })
            .slice(0, fallbackLimit)
            .map((row) => {
              const candidate = row.candidate;
              const classFit = getClassFitFromCounts(candidate, teamRosterClassCounts);
              const cacheKey = `${team.teamId}:${candidate.player.id}:${phasePlan.phase}:classFit=${classFit}:needs=${teamRoster.length}:survival`;
              const cached = scoredCandidateCache.get(cacheKey);
              const scored =
                cached ??
                scoreCandidateForTeam({
                  candidate,
                  roster: teamRoster,
                  gameState: runContext.save.gameState,
                  teamIdentity,
                  strategyProfile,
                  team: latestTeam,
                  phase: phasePlan.phase,
                  maxRecommendedSpend: phasePlan.maxRecommendedSpend,
                  draftSalt: `${save.saveId}:${params.mode}:team_sequence_survival:${team.teamId}`,
                  teamNeedState,
                  rosterClassCounts: teamRosterClassCounts,
                  counters,
                });
              const teamFit = fitByPlayerId.get(candidate.player.id)?.teamFit ?? 0;
              const needAxis = getCandidateNeedAxisValue(candidate, teamNeedState);
              const valueRatio = candidate.marketValue / Math.max(1, candidate.salary ?? 1);
              const futureGap = Number.isFinite(row.futureCost)
                ? Math.max(0, row.futureCost - (latestTeam.cash - candidate.marketValue))
                : 0;
              const survivalScore =
                needAxis * 1.1 +
                scored.valueScore * 20 +
                Math.max(0, teamFit) * 1.2 +
                classFit * 2.2 +
                valueRatio * 5 -
                candidate.marketValue * 0.75 -
                (candidate.salary ?? 0) * 1.4 -
                futureGap * 35;
              const roleScore = scoreCandidateForDraftRole(scored, desiredDraftRole);
              const softened = {
                ...scored,
                selectedScore: roundValue(survivalScore, 4),
                roleScore,
                desiredDraftRole,
                budgetFit: roundValue(row.futureFeasible ? 120 - candidate.marketValue : -futureGap * 35, 2),
                teamNeed: `survival_${scored.teamNeed}`,
                minimumFutureFeasible: row.futureFeasible,
                minimumFutureCost: Number.isFinite(row.futureCost) ? roundValue(row.futureCost, 2) : null,
                minimumFutureCashAfter: roundValue(latestTeam.cash - candidate.marketValue, 2),
                minimumFutureFallbackUsed: true,
              };
              scoredCandidateCache.set(cacheKey, softened);
              return softened;
            });
          evaluatedCandidates = survivalFallbackCandidates.length > 0
            ? survivalFallbackCandidates
            : [...evaluatedCandidatePool]
                .sort((left, right) => {
                  if (left.marketValue !== right.marketValue) return left.marketValue - right.marketValue;
                  return compareScoredCandidateTie(left, right, `minimum_guard_fallback:${team.teamId}:${teamPicks}`);
                })
                .slice(0, Math.min(24, evaluatedCandidatePool.length))
                .map((candidate) => ({
                  ...candidate,
                  selectedScore: roundValue(candidate.selectedScore - REDRAFT_MINIMUM_FALLBACK_PENALTY, 4),
                  budgetFit: roundValue((candidate.budgetFit ?? 0) - REDRAFT_MINIMUM_FALLBACK_PENALTY, 2),
                  minimumFutureFallbackUsed: true,
                }));
          teamWarnings.push(`minimum_survival_budget_fallback:${evaluatedCandidates.length}/${survivalCandidatePool.length}`);
          warningRows.push({
            round: teamPicks + 1,
            teamId: team.teamId,
            reason: "minimum_survival_budget_fallback",
            detail: `fallback=${evaluatedCandidates.length};futureSafe=${futureSafeRows.length};pool=${survivalCandidatePool.length};remainingMinAfterPick=${remainingMinAfterPick};remainingPlannedAfterPick=${remainingPlannedAfterPick};bestScore=${roundValue(bestMinimumCandidateScore)};cash=${roundValue(latestTeam.cash)}`,
          });
        }
        if (remainingMinAfterPick > 0 && evaluatedCandidates.length < roleRankedCandidates.length) {
          const blockedCount = roleRankedCandidates.length - evaluatedCandidates.length;
          teamWarnings.push(`minimum_feasibility_guard_blocked:${blockedCount}`);
          warningRows.push({
            round: teamPicks + 1,
            teamId: team.teamId,
            reason: "minimum_feasibility_guard_blocked",
            detail: `blocked=${blockedCount};remainingMinAfterPick=${remainingMinAfterPick};cash=${roundValue(latestTeam.cash)}`,
          });
        }
        const scoredCandidates = evaluatedCandidates
          .sort((left, right) => {
            if (right.selectedScore !== left.selectedScore) return right.selectedScore - left.selectedScore;
            return compareScoredCandidateTie(left, right, `team_sequence:${team.teamId}:${teamPicks}`);
          });
        profiler.end("candidate_stage1", stage1StartedAt, {
          round: teamPicks + 1,
          teamId: team.teamId,
          rosterCount,
          candidateCount: scoredCandidates.length,
          warning: `role=${desiredDraftRole};lane=${strategicPool.lane};scanned=${strategicPool.scanned};matched=${strategicPool.matched};deep=${strategicPool.pool.length}`,
        });

        draftRoleBoardRows.push(
          ...buildDraftRoleBoardRows({
            round: teamPicks + 1,
            team: latestTeam,
            desiredRole: desiredDraftRole,
            candidates: scoredCandidates,
            limit: 20,
          }),
        );

        const teamMarketBoardRows = rosterBlueprint && managerProfile
          ? buildManagerMarketBoard({
              team: latestTeam,
              teamName: team.name,
              candidates: scoredCandidates,
              blueprint: rosterBlueprint,
              profile: managerProfile,
              limit: 24,
            })
          : [];
        marketBoardRows.push(...teamMarketBoardRows.map((row) => ({ ...row, reason: `team_sequence_pick=${teamPicks + 1};${row.reason}` })));

        phaseRows.push({
          round: teamPicks + 1,
          teamId: team.teamId,
          phase: "team_sequence_need_eval",
          durationMs: Date.now() - pickStartedAt,
          itemCount: unpickedCandidates.length,
          freeAgentsRemaining: unpickedCandidates.length,
          cheapFilterCount: cashLegalCandidates.length,
          shortlistCount: scoredCandidates.length,
          hardBlockersCount: negativeFitBlocked + cashBlocked,
          note: `teamSequence=true;scoutingLane=${strategicPool.lane};scanned=${strategicPool.scanned};matched=${strategicPool.matched};deepScored=${strategicPool.pool.length};hardFilters=positive_fit_first,mercenary_fallback_for_wl,cash_non_negative;role=${desiredDraftRole};phaseLabel=${phasePlan.phase};minTarget=${minTarget};desiredTarget=${desiredRosterTarget};cash=${roundValue(latestTeam.cash)}`,
        });

        let picked = false;
        let previewCalls = 0;
        for (const candidate of scoredCandidates) {
          const contractOffer = recommendContractOfferForPlayer({
            player: candidate.player,
            teamStrategyProfile: strategyProfiles[team.teamId] ?? null,
            teamIdentity,
            teamCash: latestTeam.cash,
            marketValue: candidate.marketValue,
            teamFit: fitByPlayerId.get(candidate.player.id)?.teamFit ?? null,
            currentTeamSalary: teamRosterPlayers.reduce((sum, player) => sum + (getCalculatedPlayerSalary(player) ?? 0), 0),
            dealRole: desiredDraftRole,
            rosterCountBefore: rosterCount,
            teamRosterMin: minTarget,
            teamRosterOpt: desiredRosterTarget,
            isFirstSeason: runContext.save.gameState.season.id === "season-1",
          });
          previewCalls += 1;
          counters.buyPreviewCalls += 1;
          counters.fullPreviewCalls += 1;
          const result = executeLocalTransfermarktBuy({
            saveId: runContext.save.saveId,
            seasonId: runContext.save.gameState.season.id,
            teamId: team.teamId,
            playerId: candidate.player.id,
            contractLength: contractOffer.contractLength,
            contractShape: contractOffer.contractShape,
            transferSource,
            fastLocalBatch: true,
            localRunContext: runContext,
            deferPersist: true,
          });
          if (!result.canBuy) {
            counters.failedBuys += 1;
            warningRows.push({
              round: teamPicks + 1,
              teamId: team.teamId,
              reason: "team_sequence_buy_blocked",
              detail: `${candidate.player.id}:${result.blockingReasons.join("|")}`,
            });
            continue;
          }
          if (typeof result.cashAfter === "number" && result.cashAfter < -0.0001) {
            throw new Error(`negative_cash_after_pick:${team.teamId}:${roundValue(result.cashAfter)}`);
          }

          counters.successfulBuys += 1;
          counters.selectedCandidates += 1;
          pickedPlayerIds.add(candidate.player.id);
          globalPickIndex += 1;
          teamPicks += 1;
          picked = true;
          const pickRejectedRows = buildRejectedCandidateRows({
            round: teamPicks,
            teamId: team.teamId,
            selected: candidate,
            candidates: scoredCandidates,
            phasePlan,
            teamCash: latestTeam.cash,
          });
          rejectedRows.push(...pickRejectedRows);
          const rejectedFields = rejectedSummaryFields(pickRejectedRows);
          const selectedBoardRow = teamMarketBoardRows.find((row) => row.playerId === candidate.player.id) ?? null;
          const targetProgress = rosterBlueprint
            ? `${result.rosterAfter ?? rosterCount + 1}/${rosterBlueprint.desiredRosterTarget}`
            : `${result.rosterAfter ?? rosterCount + 1}/${desiredRosterTarget}`;
          const fitInfo = fitByPlayerId.get(candidate.player.id) ?? {
            allowed: true,
            teamFit: 0,
            mercenary: hasMercenaryTrait(candidate.player),
          };
          picks.push({
            round: teamPicks,
            teamId: team.teamId,
            playerId: candidate.player.id,
            playerName: candidate.player.name,
            marketValue: result.purchasePrice,
            salary: result.offeredSalary ?? result.salary,
            cashBefore: latestTeam.cash,
            cashAfter: result.cashAfter,
            rosterBefore: result.rosterBefore ?? rosterCount,
            rosterAfter: result.rosterAfter ?? rosterCount + 1,
            transferHistoryId: result.transferId,
            phase: phasePlan.phase,
            managerArchetype: managerProfile?.managerArchetype,
            seasonStrategy: seasonStrategy?.seasonStrategy,
            roleFilled: candidate.player.className,
            blueprintNeed: rosterBlueprint?.requiredAxisCoverage || candidate.teamNeed,
            marketBoardTier: selectedBoardRow?.boardTier ?? "B Solid Fit",
            whySelected: `${selectedBoardRow?.reason ?? "team_sequence"};draftRole=${desiredDraftRole};score=${candidate.selectedScore};fit=${fitInfo.teamFit};mercenary=${fitInfo.mercenary}`,
            whyRejectedOthers: pickRejectedRows.map((row) => `${row.rejectedPlayerName}:${row.rejectionCategory}`).join("|"),
            targetProgress,
            pickScore: candidate.pickScore,
            selectedScore: candidate.selectedScore,
            draftVariance: candidate.draftVariance,
            teamNeed: candidate.teamNeed,
            role: desiredDraftRole,
            currentRating: roundValue(candidate.quality, 2),
            potentialRange: getPotentialRange(candidate.player.potential),
            qualityTier: getQualityTier(candidate.quality),
            axisFitPow: roundValue(candidate.pow, 2),
            axisFitSpe: roundValue(candidate.spe, 2),
            axisFitMen: roundValue(candidate.men, 2),
            axisFitSoc: roundValue(candidate.soc, 2),
            classFit: candidate.classFit,
            identityFit: candidate.identityFit,
            premiumAxisFit: candidate.premiumAxisFit,
            axisFocusStrength: candidate.axisFocusStrength,
            valueScore: candidate.valueScore,
            themeCompositionScore: candidate.themeCompositionScore,
            themeTier: candidate.themeTier,
            themeTags: candidate.themeTags.join("|"),
            themeReason: candidate.themeReason,
            needImpactScore: candidate.needImpactScore,
            salaryImpact: candidate.salaryImpact,
            budgetFit: candidate.budgetFit,
            topRejectedCandidates: getTopRejectedCandidates(scoredCandidates, candidate.player.id),
            ...rejectedFields,
            previewCalls,
            candidateCount: scoredCandidates.length,
            reasons: `team_sequence;pick=${teamPicks};globalPick=${globalPickIndex};role=${desiredDraftRole};teamNeed=${candidate.teamNeed};needImpact=${candidate.needImpactScore};quality=${roundValue(candidate.quality, 2)};identityFit=${candidate.identityFit};premiumAxisFit=${candidate.premiumAxisFit};axisFocus=${candidate.axisFocusStrength};theme=${candidate.themeTier}:${candidate.themeCompositionScore};valueScore=${candidate.valueScore};potential=${candidate.potentialScore};marketValue=${candidate.marketValue};fit=${fitInfo.teamFit};mercenary=${fitInfo.mercenary}`,
            durationMs: Date.now() - pickStartedAt,
          });
          sequentialPickRows.push({
            globalPick: globalPickIndex,
            teamPick: teamPicks,
            teamId: team.teamId,
            playerId: candidate.player.id,
            playerName: candidate.player.name,
            role: desiredDraftRole,
            teamNeed: candidate.teamNeed,
            fit: fitInfo.teamFit,
            mercenary: fitInfo.mercenary,
            selectedScore: candidate.selectedScore,
            identityFit: candidate.identityFit,
            premiumAxisFit: candidate.premiumAxisFit,
            pow: candidate.pow,
            spe: candidate.spe,
            men: candidate.men,
            soc: candidate.soc,
            cashBefore: latestTeam.cash,
            cashAfter: result.cashAfter,
            allPlayersScored: scoredCandidates.length,
            negativeFitBlocked,
            cashBlocked,
            durationMs: Date.now() - pickStartedAt,
          });
          profiler.log("team_sequence_pick_selected", {
            round: teamPicks,
            teamId: team.teamId,
            rosterCount: result.rosterAfter ?? rosterCount + 1,
            freeAgentCount: candidatePool.length - pickedPlayerIds.size,
            candidateCount: scoredCandidates.length,
            previewCount: previewCalls,
          });
          profiler.log("pick_selected", {
            round: teamPicks,
            teamId: team.teamId,
            rosterCount: result.rosterAfter ?? rosterCount + 1,
            freeAgentCount: candidatePool.length - pickedPlayerIds.size,
            candidateCount: scoredCandidates.length,
            previewCount: previewCalls,
          });
          console.error(
            `[redraft] pick ${team.teamId} #${teamPicks}/${desiredRosterTarget} ${candidate.player.name} score=${candidate.selectedScore} candidates=${scoredCandidates.length}`,
          );
          break;
        }

        if (!picked) {
          teamErrors += 1;
          teamWarnings.push("no_legal_candidate_after_preview");
          warningRows.push({ round: teamPicks + 1, teamId: team.teamId, reason: "no_legal_candidate_after_preview", detail: `candidates=${scoredCandidates.length}` });
          break;
        }
      }

      if (!dryRun && runContext.deferredWrites > 0) {
        const flushStartedAt = Date.now();
        flushLocalTransfermarktRunContext(runContext);
        counters.saveFlushes += 1;
        phaseRows.push({
          round: teamPicks,
          teamId: team.teamId,
          phase: "team_sequence_save_flush",
          durationMs: Date.now() - flushStartedAt,
          itemCount: runContext.save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
          memoryAfterMb: memorySnapshot().heapUsedMb,
        });
      }

      const finalRoster = runContext.save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const finalTeam = runContext.save.gameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
      const pickedRows = picks.filter((pick) => pick.teamId === team.teamId);
      const anchorPickedRows = pickedRows.slice(0, Math.min(2, pickedRows.length));
      const corePickedRows = pickedRows.slice(0, Math.min(4, pickedRows.length));
      const avgIdentityFit = avg(pickedRows.map((pick) => pick.identityFit ?? 0)) ?? 0;
      const avgPremiumAxisFit = avg(pickedRows.map((pick) => pick.premiumAxisFit ?? 0)) ?? 0;
      const avgThemeScore = avg(pickedRows.map((pick) => pick.themeCompositionScore ?? 0)) ?? 0;
      const anchorIdentityFit = avg(anchorPickedRows.map((pick) => pick.identityFit ?? 0)) ?? 0;
      const anchorPremiumAxisFit = avg(anchorPickedRows.map((pick) => pick.premiumAxisFit ?? 0)) ?? 0;
      const coreIdentityFit = avg(corePickedRows.map((pick) => pick.identityFit ?? 0)) ?? 0;
      const corePremiumAxisFit = avg(corePickedRows.map((pick) => pick.premiumAxisFit ?? 0)) ?? 0;
      const coreThemeScore = avg(corePickedRows.map((pick) => pick.themeCompositionScore ?? 0)) ?? 0;
      const avgPow = avg(pickedRows.map((pick) => pick.axisFitPow ?? 0)) ?? 0;
      const avgSpe = avg(pickedRows.map((pick) => pick.axisFitSpe ?? 0)) ?? 0;
      const avgMen = avg(pickedRows.map((pick) => pick.axisFitMen ?? 0)) ?? 0;
      const avgSoc = avg(pickedRows.map((pick) => pick.axisFitSoc ?? 0)) ?? 0;
      const status =
        finalRoster.length < minTarget
          ? "red_under_min"
          : anchorIdentityFit < 48 || anchorPremiumAxisFit < 48
            ? "yellow_identity_watch"
            : coreIdentityFit < 55 || corePremiumAxisFit < 55 || avgIdentityFit < 35 || avgPremiumAxisFit < 35
              ? "yellow_fit_watch"
              : "green_plausible";
      sequentialIdentityRows.push({
        teamId: team.teamId,
        teamName: team.name,
        status,
        rosterCount: finalRoster.length,
        minTarget,
        desiredRosterTarget,
        playerMax: teamTarget.playerMax,
        cashAfter: roundValue(finalTeam.cash),
        picks: teamPicks,
        avgIdentityFit: roundValue(avgIdentityFit, 2),
        avgPremiumAxisFit: roundValue(avgPremiumAxisFit, 2),
        avgThemeScore: roundValue(avgThemeScore, 2),
        anchorIdentityFit: roundValue(anchorIdentityFit, 2),
        anchorPremiumAxisFit: roundValue(anchorPremiumAxisFit, 2),
        coreIdentityFit: roundValue(coreIdentityFit, 2),
        corePremiumAxisFit: roundValue(corePremiumAxisFit, 2),
        coreThemeScore: roundValue(coreThemeScore, 2),
        avgPow: roundValue(avgPow, 2),
        avgSpe: roundValue(avgSpe, 2),
        avgMen: roundValue(avgMen, 2),
        avgSoc: roundValue(avgSoc, 2),
        managerArchetype: managerProfile?.managerArchetype ?? "",
        strategy: seasonStrategy?.seasonStrategy ?? "",
        warnings: teamWarnings.join("|"),
      });
      sequentialTeamRows.push({
        teamId: team.teamId,
        teamName: team.name,
        picks: teamPicks,
        rosterCount: finalRoster.length,
        minTarget,
        desiredRosterTarget,
        cashAfter: roundValue(finalTeam.cash),
        errors: teamErrors,
        warnings: teamWarnings.join("|"),
        durationMs: Date.now() - teamStartedAt,
      });
      memoryRows.push({
        round: 1,
        teamId: team.teamId,
        phase: "team_sequence",
        heapUsedMb: memorySnapshot().heapUsedMb,
        rssMb: memorySnapshot().rssMb,
        durationMs: Date.now() - teamStartedAt,
        itemCount: finalRoster.length,
      });
      profiler.log("team_sequence_end", {
        round: 1,
        teamId: team.teamId,
        rosterCount: finalRoster.length,
        freeAgentCount: candidatePool.length - pickedPlayerIds.size,
        candidateCount: teamPicks,
        warning: teamWarnings.join("|") || null,
      });
      console.error(
        `[redraft] team_sequence_done ${team.teamId} picks=${teamPicks} roster=${finalRoster.length} status=${status} durationMs=${Date.now() - teamStartedAt}`,
      );
    }

    const finalSave = dryRun ? initialSave : persistence.getSaveById(save.saveId) ?? runContext.save;
    const finalState = buildState(finalSave, pickedPlayerIds, 1, warnings);
    const finalSummary = buildSummary({
      initialSave,
      finalSave,
      picks,
      memoryRows,
      warningRows,
      roundDurations: [{ round: 1, durationMs: Date.now() - sequentialStartedAt, picks: globalPickIndex }],
      resumeTested,
    });
    profiler.log("team_sequence_draft_complete", {
      round: 1,
      teamId: "ALL",
      rosterCount: finalSave.gameState.rosters.length,
      freeAgentCount: Math.max(0, finalSave.gameState.players.length - finalSave.gameState.rosters.length),
      candidateCount: picks.length,
    });
    writeReports({
      outputDir,
      summary: finalSummary,
      state: finalState,
      initialSave,
      finalSave,
      picks,
      rejectedRows,
      targetPlans,
      managerProfiles,
      seasonStrategies,
      rosterBlueprints,
      marketBoardRows,
      draftRoleBoardRows,
      candidatePool: buildCandidatePool(finalSave.gameState, pickedPlayerIds),
      memoryRows,
      warningRows,
      phaseRows,
      progressRows: profiler.rows,
      counters,
      reportMode,
    });
    writeCsv(outputDir, "team-sequential-draft-teams.csv", sequentialTeamRows);
    writeCsv(outputDir, "team-sequential-draft-picks.csv", sequentialPickRows);
    writeCsv(outputDir, "team-sequential-identity-audit.csv", sequentialIdentityRows);
    writeMarkdown(
      outputDir,
      "team-sequential-draft-summary.md",
      [
        "# Team Sequential Draft Summary",
        "",
        `- Save: ${finalSave.saveId}`,
        `- Draft valid: ${finalSummary.draftValid ? "true" : "false"}`,
        `- Picks: ${picks.length}`,
        `- Teams under min: ${finalSummary.teamsBelowMin.length}`,
        `- Negative cash teams: ${finalSummary.negativeCashTeams.length}`,
        `- Identity red teams: ${sequentialIdentityRows.filter((row) => String(row.status).startsWith("red")).length}`,
        `- Duration ms: ${Date.now() - sequentialStartedAt}`,
        "",
        "Hard filters: negative team fit except mercenaries, and cash must not go below 0.",
      ].join("\n"),
    );

    return {
      dryRun,
      executed: !dryRun,
      status: finalSummary.teamsBelowMin.length === 0 ? "ready" : "warning",
      summary: finalSummary,
      state: finalState,
      picks,
      warnings,
      outputDir,
    };
  }

  let round = Math.max(1, resumeState?.round ?? 1);
  let globalBlocked = false;

  while (round <= roundLimit && !globalBlocked) {
    const roundStartedAt = Date.now();
    let roundPicks = 0;
    const completedTeamsInRound: string[] = [];
    profiler.log("round_start", { round, rosterCount: runContext.save.gameState.rosters.length });
    const setupStartedAt = Date.now();
    const memoryAtRoundStart = memorySnapshot();
    counters.candidateScans += 1;
    const candidatePool = initialCandidatePool.filter((candidate) => !pickedPlayerIds.has(candidate.player.id));
    counters.rejectedByAlreadyPicked += Math.max(0, initialCandidatePool.length - candidatePool.length);
    phaseRows.push({
      round,
      teamId: "ALL",
      phase: "candidate_pool_build",
      durationMs: Date.now() - setupStartedAt,
      itemCount: candidatePool.length,
      freeAgentsRemaining: candidatePool.length,
      memoryBeforeMb: memoryAtRoundStart.heapUsedMb,
      memoryAfterMb: memorySnapshot().heapUsedMb,
    });
    const rostersByTeam = groupRostersByTeam(runContext.save.gameState.rosters);

    if (candidatePool.length === 0) {
      warnings.push("candidate_pool_empty");
      break;
    }

    const targetTeamIdSet = new Set((params.targetTeamIds ?? []).filter(Boolean));
    const roundTeams =
      targetTeamIdSet.size > 0
        ? runContext.save.gameState.teams.filter((team) => targetTeamIdSet.has(team.teamId))
        : runContext.save.gameState.teams;
    const teamsForRound = maxTeams ? roundTeams.slice(0, maxTeams) : roundTeams;
    for (const team of teamsForRound) {
      const teamStartedAt = Date.now();
      const memoryBefore = memorySnapshot();
      const latestTeam = runContext.save.gameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
      const rosterCount = rostersByTeam.get(team.teamId)?.length ?? 0;
      profiler.log("team_planning_start", {
        round,
        teamId: team.teamId,
        rosterCount,
        freeAgentCount: candidatePool.length,
      });
      const teamRoster = rostersByTeam.get(team.teamId) ?? [];
      const teamTarget = getTeamTarget(runContext.save.gameState, team.teamId, target);
      if (params.mode === "preseason_roster_repair" && shouldBlockEmergencyPathAtOpt(rosterCount, teamTarget.playerOpt)) {
        warningRows.push({
          round,
          teamId: team.teamId,
          reason: "emergency_repair_blocked_at_opt",
          detail: `${rosterCount}/${teamTarget.playerOpt}`,
        });
        profiler.log("team_planning_end", {
          round,
          teamId: team.teamId,
          rosterCount,
          freeAgentCount: candidatePool.length,
          warning: "emergency_repair_blocked_at_opt",
        });
        continue;
      }
      const teamIdentity = runContext.save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const strategyProfile = strategyProfiles[team.teamId] ?? null;
      const targetPlan =
        targetPlans.get(team.teamId) ??
        buildRosterTargetPlan({
          gameState: runContext.save.gameState,
          teamId: team.teamId,
          target,
          strategyProfile,
          candidatePool,
          requirePlayerOptTarget,
          minimumRosterTargetOverride: params.minimumRosterTargetOverride,
        });
      const managerProfile = managerProfiles.get(team.teamId) ?? null;
      const seasonStrategy = seasonStrategies.get(team.teamId) ?? null;
      const rosterBlueprint = rosterBlueprints.get(team.teamId) ?? null;
      const teamSalarySum = getRosterSalary(teamRoster);
      const cashSalaryGuide = resolveCashSalaryDraftPickGuidance({
        cash: latestTeam.cash,
        salaryTotal: teamSalarySum,
        finances: teamIdentity?.finances,
        remainingSlots: Math.max(1, teamTarget.playerOpt - rosterCount),
        rosterAtOrAboveMin: rosterCount >= teamTarget.playerMin,
      });
      const phasePlan = buildPhasePlan({
        target,
        rosterCount,
        teamTarget,
        targetPlan,
        teamCash: latestTeam.cash,
        teamSalarySum,
        teamFinances: teamIdentity?.finances,
        strategyProfile,
        candidatePool,
        rebuildFocusActive: teamHasCashBufferRebuildFocus(runContext.save.gameState, team.teamId),
      });
      let effectiveTargetRoster = phasePlan.targetRoster;
      if (
        rosterCount >= effectiveTargetRoster &&
        (cashSalaryGuide.needsSpendDown || cashSalaryGuide.mustSpendDown) &&
        rosterCount < teamTarget.playerMax
      ) {
        effectiveTargetRoster = Math.min(
          teamTarget.playerMax,
          rosterCount + cashSalaryGuide.extraRosterSlotsForSpendDown,
        );
      }

      if (rosterCount >= effectiveTargetRoster) {
        warningRows.push({
          round,
          teamId: team.teamId,
          reason: "team_target_reached",
          detail: `${rosterCount}/${phasePlan.targetRoster};${phasePlan.phase};mode=${targetPlan?.targetMode ?? ""}`,
        });
        profiler.log("team_planning_end", {
          round,
          teamId: team.teamId,
          rosterCount,
          freeAgentCount: candidatePool.length,
          warning: "team_target_reached",
        });
        continue;
      }
      if (rosterCount >= teamTarget.playerMax) {
        warningRows.push({ round, teamId: team.teamId, reason: "team_player_max_reached", detail: `${rosterCount}/${teamTarget.playerMax}` });
        counters.rejectedByRosterMax += candidatePool.length;
        profiler.log("team_planning_end", {
          round,
          teamId: team.teamId,
          rosterCount,
          freeAgentCount: candidatePool.length,
          warning: "team_player_max_reached",
        });
        continue;
      }

      const filterStartedAt = Date.now();
      const stage0StartedAt = profiler.start("candidate_stage0", {
        round,
        teamId: team.teamId,
        rosterCount,
        freeAgentCount: candidatePool.length,
      });
      const minimumRosterGap = Math.max(0, (targetPlan?.minTarget ?? teamTarget.playerMin) - rosterCount);
      const phaseAMinimumGuard = phasePlan.phase === "phase_a_minimum" && minimumRosterGap > 0;
      const repairMode =
        phaseAMinimumGuard &&
        (params.mode === "preseason_roster_repair" || params.mode === "season1_initial_topup");
      const getCandidateCashCost = (candidate: Candidate) => candidate.marketValue;
      const cashAffordableCandidates = candidatePool
        .filter((candidate) => !pickedPlayerIds.has(candidate.player.id))
        .filter((candidate) => {
          const cashCost = getCandidateCashCost(candidate);
          if (cashCost == null || cashCost <= 0) {
            return false;
          }
          if (repairMode) {
            // Root-cause fix (2026-07-04, W-W chronically stuck below hardMin — see
            // outputs/real-engine-s1s5-final/progress-log.md): repairMode already enforces the
            // correct, narrow affordability check for this genuinely last-resort case (cash must
            // cover the candidate's price, full stop). The generic `cashReservePct` "soft retool
            // reserve" below is meant to keep some budget aside for a *later* pick in a normal
            // phase_a_minimum pass — that tradeoff is actively harmful here: for a team whose cash
            // barely covers the single cheapest candidate (e.g. cash 6.12 vs. price 6.00), even the
            // fallback 7% reserve wipes out the entire affordable pool, permanently stranding the
            // team below hardMin with no candidate ever passing. A team below its absolute minimum
            // has no "later pick" to save for — every remaining slot is equally urgent.
            return isPreseasonRepairCandidateEligible({ marketValue: cashCost, teamCash: latestTeam.cash });
          }
          const affordableBudget = resolveTransferAffordableBudget({
            teamCash: latestTeam.cash,
            cashReservePct: phasePlan.cashReservePct,
            spendableBudget: targetPlan?.spendableBudget,
            gameState: runContext.save.gameState,
            teamId: team.teamId,
            rosterBelowOpt: rosterCount < phasePlan.targetRoster,
          });
          return affordableBudget >= cashCost;
        });
      counters.rejectedByCash += Math.max(0, candidatePool.length - cashAffordableCandidates.length);
      const teamRosterPlayers = getRosterPlayers(runContext.save.gameState, teamRoster);
      const fitChecked = cashAffordableCandidates.map((candidate) => {
        const teamFit = getCandidateTeamFitFromRosterPlayers({
          team: latestTeam,
          rosterPlayers: teamRosterPlayers,
          candidate,
        });
        const mercenary = hasMercenaryTrait(candidate.player);
        return {
          candidate,
          fit: {
            allowed: teamFit >= 0 || mercenary,
            teamFit,
            mercenary,
          },
        };
      });
      const positiveFitCandidates = fitChecked.filter((entry) => entry.fit.teamFit >= 0).map((entry) => entry.candidate);
      const mercenaryFallbackCandidates = fitChecked
        .filter((entry) => entry.fit.teamFit < 0 && entry.fit.mercenary)
        .map((entry) => entry.candidate);
      const fitLegalCandidates = selectFitLegalCandidates({
        team: latestTeam,
        positiveFitCandidates,
        mercenaryFallbackCandidates,
      });
      const fitByPlayerId = new Map(fitChecked.map((entry) => [entry.candidate.player.id, entry.fit] as const));
      profiler.end("candidate_stage0", stage0StartedAt, {
        round,
        teamId: team.teamId,
        rosterCount,
        freeAgentCount: candidatePool.length,
        candidateCount: fitLegalCandidates.length,
        warning: `cashAffordable=${cashAffordableCandidates.length};positiveFit=${positiveFitCandidates.length};mercenaryFallback=${mercenaryFallbackCandidates.length}`,
      });
      const stage1StartedAt = profiler.start("candidate_stage1", {
        round,
        teamId: team.teamId,
        rosterCount,
        candidateCount: fitLegalCandidates.length,
      });
      const affordableCandidates = fitLegalCandidates;
      const qualitySafeCandidates = affordableCandidates;
      const budgetSafeCandidates = affordableCandidates.filter((candidate) => getCandidateCashCost(candidate) <= phasePlan.maxRecommendedSpend);
      const usingPhaseAMinimumFallback = phaseAMinimumGuard && budgetSafeCandidates.length > 0;
      const planningPool = usingPhaseAMinimumFallback ? budgetSafeCandidates : affordableCandidates;
      const themeTarget = getTeamThemeCompositionTarget(latestTeam);
      const protectThemeMinimum = needsThemePickToProtectMinimum({
        gameState: runContext.save.gameState,
        roster: teamRoster,
        target: themeTarget,
        phase: phasePlan.phase,
      });
      const desiredDraftRole = protectThemeMinimum
        ? "theme"
        : usingPhaseAMinimumFallback
          ? "value"
          : getDesiredDraftRole({
            rosterCount,
            roster: teamRoster,
            gameState: runContext.save.gameState,
            phase: phasePlan.phase,
            profile: managerProfile,
            blueprint: rosterBlueprint,
            targetPlan,
            themeTarget,
          });
      const teamNeedState = buildTeamNeedState({
        gameState: runContext.save.gameState,
        team: latestTeam,
        teamIdentity,
        rosterPlayers: teamRosterPlayers,
        targetRosterSize: phasePlan.targetRoster,
        plannedPicksRemaining: Math.max(1, phasePlan.targetRoster - rosterCount),
      });
      const strategicPool = buildStrategicScoutingPool({
        planningPool,
        role: desiredDraftRole,
        phasePlan,
        targetPlan,
        teamCash: latestTeam.cash,
        rosterCount,
        desiredRosterTarget: phasePlan.targetRoster,
        identity: teamIdentity,
        themeTarget,
        needState: teamNeedState,
      });
      const baseScoredCandidates = strategicPool.pool
        .map((candidate) => {
          const price = candidate.marketValue ?? 0;
          const spendBoost =
            cashSalaryGuide.minSpendPerPick > 0 && price >= cashSalaryGuide.minSpendPerPick * 0.82
              ? Math.min(28, (price / Math.max(cashSalaryGuide.minSpendPerPick, 1)) * 8)
              : cashSalaryGuide.needsSpendDown && price + 0.01 < cashSalaryGuide.minSpendPerPick * 0.55
                ? -Math.min(18, cashSalaryGuide.minSpendPerPick - price)
                : 0;
          return scoreCandidateForTeam({
            candidate,
            roster: teamRoster,
            gameState: runContext.save.gameState,
            teamIdentity,
            strategyProfile,
            team: latestTeam,
            phase: phasePlan.phase,
            maxRecommendedSpend: phasePlan.maxRecommendedSpend,
            draftSalt: `${save.saveId}:${params.mode}`,
            teamNeedState,
            counters,
            cashSalarySpendBoost: spendBoost,
          });
        })
        .sort((left, right) => {
          if (right.selectedScore !== left.selectedScore) return right.selectedScore - left.selectedScore;
          return compareScoredCandidateTie(left, right, `round:${round}:${team.teamId}`);
        });
      const roleRankedCandidates = applyDraftRoleIntent(baseScoredCandidates, desiredDraftRole);
      const premiumRoleGate = applyPremiumDraftRoleGate(roleRankedCandidates, desiredDraftRole);
      const scoredCandidates = premiumRoleGate.candidates;
      draftRoleBoardRows.push(
        ...buildDraftRoleBoardRows({
          round,
          team: latestTeam,
          desiredRole: desiredDraftRole,
          candidates: scoredCandidates,
          limit: 20,
        }),
      );
      profiler.end("candidate_stage1", stage1StartedAt, {
        round,
        teamId: team.teamId,
        rosterCount,
        candidateCount: scoredCandidates.length,
        warning: `role=${desiredDraftRole};lane=${strategicPool.lane};scanned=${strategicPool.scanned};matched=${strategicPool.matched};deep=${strategicPool.pool.length};fallback=${usingPhaseAMinimumFallback};premiumGateBlocked=${premiumRoleGate.blockedCount};premiumGateFallback=${premiumRoleGate.usedFallback}`,
      });
      const shortlistStartedAt = profiler.start("candidate_shortlist", {
        round,
        teamId: team.teamId,
        rosterCount,
        candidateCount: scoredCandidates.length,
      });
      const shortlistCap = phasePlan.shortlistCap;
      const shortlist = scoredCandidates.slice(0, shortlistCap);
      profiler.end("candidate_shortlist", shortlistStartedAt, {
        round,
        teamId: team.teamId,
        rosterCount,
        candidateCount: scoredCandidates.length,
        shortlistCount: shortlist.length,
      });
      const teamMarketBoardRows = rosterBlueprint && managerProfile
        ? buildManagerMarketBoard({
            team: latestTeam,
            teamName: team.name,
            candidates: scoredCandidates,
            blueprint: rosterBlueprint,
            profile: managerProfile,
            limit: 24,
          })
        : [];
      marketBoardRows.push(...teamMarketBoardRows.map((row) => ({ ...row, reason: `round=${round};${row.reason}` })));
      phaseRows.push({
        round,
        teamId: team.teamId,
        phase: "candidate_filtering_and_scoring",
        durationMs: Date.now() - filterStartedAt,
        itemCount: candidatePool.length,
        cheapFilterCount: affordableCandidates.length,
        shortlistCount: shortlist.length,
        hardBlockersCount: candidatePool.length - cashAffordableCandidates.length,
        freeAgentsRemaining: candidatePool.length,
        note: `phase=${phasePlan.phase};${phasePlan.description};cashAffordable=${cashAffordableCandidates.length};positiveFit=${positiveFitCandidates.length};mercenaryFallback=${mercenaryFallbackCandidates.length};qualitySafe=not_used_for_pick;budgetSafe=${budgetSafeCandidates.length};phaseAMinimumGuard=${phaseAMinimumGuard};scoutingLane=${strategicPool.lane};scanned=${strategicPool.scanned};matched=${strategicPool.matched};deepScored=${strategicPool.pool.length};role=${desiredDraftRole};premiumGateBlocked=${premiumRoleGate.blockedCount};premiumGateFallback=${premiumRoleGate.usedFallback};maxRecommendedSpend=${roundValue(phasePlan.maxRecommendedSpend)};cashReservePct=${phasePlan.cashReservePct};reservePolicy=${targetPlan.reservePolicy};allowedBudget=${targetPlan.spendableBudget};reserveBudget=${targetPlan.reserveBudget};budgetCaution=${targetPlan.budgetCaution01};softSlotBudget=${targetPlan.softSlotBudget};qualityFloor=not_used_for_pick`,
      });

      if (shortlist.length === 0) {
        warningRows.push({ round, teamId: team.teamId, reason: "no_affordable_candidate", detail: `cash=${latestTeam.cash}` });
        profiler.log("team_planning_end", {
          round,
          teamId: team.teamId,
          rosterCount,
          freeAgentCount: candidatePool.length,
          candidateCount: scoredCandidates.length,
          shortlistCount: 0,
          warning: "no_affordable_candidate",
        });
        continue;
      }

      let picked = false;
      let previewCalls = 0;
      for (const candidate of shortlist) {
        if (Date.now() - teamStartedAt > teamTimeLimitMs) {
          warningRows.push({ round, teamId: team.teamId, reason: "team_time_limit_reached", detail: `${teamTimeLimitMs}ms` });
          break;
        }
        const pickStartedAt = Date.now();
        const cashBefore = latestTeam.cash;
        previewCalls += 1;
        counters.buyPreviewCalls += 1;
        counters.fullPreviewCalls += 1;
        const buyPreviewStartedAt = profiler.start("buy_preview", {
          round,
          teamId: team.teamId,
          rosterCount,
          shortlistCount: shortlist.length,
          previewCount: previewCalls,
        });
        const buyExecuteStartedAt = profiler.start("buy_execute", {
          round,
          teamId: team.teamId,
          rosterCount,
          shortlistCount: shortlist.length,
          previewCount: previewCalls,
        });
        const contractOffer = recommendContractOfferForPlayer({
          player: candidate.player,
          teamStrategyProfile: strategyProfiles[team.teamId] ?? null,
          teamIdentity,
          teamCash: latestTeam.cash,
          marketValue: candidate.marketValue,
          teamFit: fitByPlayerId.get(candidate.player.id)?.teamFit ?? null,
          currentTeamSalary: teamRosterPlayers.reduce((sum, player) => sum + (getCalculatedPlayerSalary(player) ?? 0), 0),
          dealRole: desiredDraftRole,
          rosterCountBefore: rosterCount,
          teamRosterMin: teamTarget.playerMin,
          teamRosterOpt: targetPlan.desiredRosterTarget,
          isFirstSeason: runContext.save.gameState.season.id === "season-1",
        });
        const result = executeLocalTransfermarktBuy({
          saveId: runContext.save.saveId,
          seasonId: runContext.save.gameState.season.id,
          teamId: team.teamId,
          playerId: candidate.player.id,
          contractLength: contractOffer.contractLength,
          contractShape: contractOffer.contractShape,
          transferSource,
          // Root-cause fix (2026-07-04, W-W chronically stuck below hardMin — see
          // outputs/real-engine-s1s5-final/progress-log.md): only bypass the season-wide
          // sold-cooldown for the narrow, genuinely last-resort case this repair pass exists for —
          // a team still below its absolute roster minimum. A team that has already reached
          // hardMin (topping up further towards Opt) keeps the normal protection.
          bypassSoldThisSeasonCooldown: rosterCount < teamTarget.playerMin,
          fastLocalBatch: true,
          localRunContext: runContext,
          deferPersist: true,
        });
        profiler.end("buy_execute", buyExecuteStartedAt, {
          round,
          teamId: team.teamId,
          rosterCount: result.rosterAfter ?? rosterCount,
          shortlistCount: shortlist.length,
          previewCount: previewCalls,
          warning: result.canBuy ? null : result.blockingReasons.join("|"),
        });
        profiler.end("buy_preview", buyPreviewStartedAt, {
          round,
          teamId: team.teamId,
          rosterCount: result.rosterAfter ?? rosterCount,
          shortlistCount: shortlist.length,
          previewCount: previewCalls,
          warning: result.canBuy ? null : result.blockingReasons.join("|"),
        });
        if (!result.canBuy) {
          counters.failedBuys += 1;
          warningRows.push({
            round,
            teamId: team.teamId,
            reason: "buy_blocked",
            detail: `${candidate.player.id}:${result.blockingReasons.join("|")}`,
          });
          continue;
        }
        counters.successfulBuys += 1;
        counters.selectedCandidates += 1;
        runContext.save.gameState = recordCashBufferDipIfNeeded(
          runContext.save.gameState,
          team.teamId,
          runContext.save.gameState.season.id,
        );
        pickedPlayerIds.add(candidate.player.id);
        roundPicks += 1;
        picked = true;
        const pickRejectedRows = buildRejectedCandidateRows({
          round,
          teamId: team.teamId,
          selected: candidate,
          candidates: scoredCandidates,
          phasePlan,
          teamCash: cashBefore,
        });
        rejectedRows.push(...pickRejectedRows);
        const rejectedFields = rejectedSummaryFields(pickRejectedRows);
        const selectedBoardRow = teamMarketBoardRows.find((row) => row.playerId === candidate.player.id) ?? null;
        const targetProgress = rosterBlueprint
          ? `${result.rosterAfter ?? rosterCount + 1}/${rosterBlueprint.desiredRosterTarget}`
          : `${result.rosterAfter ?? rosterCount + 1}/${phasePlan.targetRoster}`;
        picks.push({
          round,
          teamId: team.teamId,
          playerId: candidate.player.id,
          playerName: candidate.player.name,
          marketValue: result.purchasePrice,
          salary: result.offeredSalary ?? result.salary,
          cashBefore,
          cashAfter: result.cashAfter,
          rosterBefore: result.rosterBefore ?? rosterCount,
          rosterAfter: result.rosterAfter ?? rosterCount + 1,
          transferHistoryId: result.transferId,
          phase: phasePlan.phase,
          managerArchetype: managerProfile?.managerArchetype,
          seasonStrategy: seasonStrategy?.seasonStrategy,
          roleFilled: candidate.player.className,
          blueprintNeed: rosterBlueprint?.requiredAxisCoverage || candidate.teamNeed,
          marketBoardTier: selectedBoardRow?.boardTier ?? "B Solid Fit",
          whySelected: `${selectedBoardRow?.reason ?? phasePlan.description};draftRole=${desiredDraftRole};score=${candidate.selectedScore}`,
          whyRejectedOthers: pickRejectedRows.map((row) => `${row.rejectedPlayerName}:${row.rejectionCategory}`).join("|"),
          targetProgress,
          pickScore: candidate.pickScore,
          selectedScore: candidate.selectedScore,
          draftVariance: candidate.draftVariance,
          teamNeed: candidate.teamNeed,
          role: desiredDraftRole,
          currentRating: roundValue(candidate.quality, 2),
          potentialRange: getPotentialRange(candidate.player.potential),
          qualityTier: getQualityTier(candidate.quality),
          axisFitPow: roundValue(candidate.pow, 2),
          axisFitSpe: roundValue(candidate.spe, 2),
          axisFitMen: roundValue(candidate.men, 2),
          axisFitSoc: roundValue(candidate.soc, 2),
          classFit: candidate.classFit,
          identityFit: candidate.identityFit,
          premiumAxisFit: candidate.premiumAxisFit,
          axisFocusStrength: candidate.axisFocusStrength,
          valueScore: candidate.valueScore,
          themeCompositionScore: candidate.themeCompositionScore,
          themeTier: candidate.themeTier,
          themeTags: candidate.themeTags.join("|"),
          themeReason: candidate.themeReason,
          salaryImpact: candidate.salaryImpact,
          budgetFit: candidate.budgetFit,
          topRejectedCandidates: getTopRejectedCandidates(scoredCandidates, candidate.player.id),
          ...rejectedFields,
          previewCalls,
          candidateCount: shortlist.length,
          reasons: `${phasePlan.phase};draftRole=${desiredDraftRole};teamNeed=${candidate.teamNeed};quality=${roundValue(candidate.quality, 2)};identityFit=${candidate.identityFit};premiumAxisFit=${candidate.premiumAxisFit};axisFocus=${candidate.axisFocusStrength};theme=${candidate.themeTier}:${candidate.themeCompositionScore};valueScore=${candidate.valueScore};potential=${candidate.potentialScore};marketValue=${candidate.marketValue};cashReservePct=${phasePlan.cashReservePct};draftVariance=${candidate.draftVariance}`,
          durationMs: Date.now() - pickStartedAt,
        });
        phaseRows.push({
          round,
          teamId: team.teamId,
          phase: "buy_preview_apply",
          durationMs: Date.now() - pickStartedAt,
          itemCount: 1,
          previewCalls,
          selectedCandidate: candidate.player.id,
          shortlistCount: shortlist.length,
          note: phasePlan.phase,
        });
        profiler.log("pick_selected", {
          round,
          teamId: team.teamId,
          rosterCount: result.rosterAfter ?? rosterCount + 1,
          freeAgentCount: Math.max(0, candidatePool.length - 1),
          candidateCount: scoredCandidates.length,
          shortlistCount: shortlist.length,
          previewCount: previewCalls,
        });
        break;
      }

      if (!picked) {
        warningRows.push({ round, teamId: team.teamId, reason: "no_legal_candidate_after_preview", detail: `shortlist=${shortlist.length}` });
      }
      completedTeamsInRound.push(team.teamId);

      const memoryAfter = memorySnapshot();
      memoryRows.push({
        round,
        teamId: team.teamId,
        phase: "team_round",
        heapUsedMb: memoryAfter.heapUsedMb,
        rssMb: memoryAfter.rssMb,
        durationMs: Date.now() - teamStartedAt,
        itemCount: shortlist.length,
      });
      phaseRows.push({
        round,
        teamId: team.teamId,
        phase: "team_planning_total",
        durationMs: Date.now() - teamStartedAt,
        itemCount: shortlist.length,
        memoryBeforeMb: memoryBefore.heapUsedMb,
        memoryAfterMb: memoryAfter.heapUsedMb,
        previewCalls,
        shortlistCount: shortlist.length,
        selectedCandidate: picked ? picks[picks.length - 1]?.playerId ?? null : null,
        note: phasePlan.phase,
      });
      profiler.log("team_planning_end", {
        round,
        teamId: team.teamId,
        rosterCount: picked ? (picks[picks.length - 1]?.rosterAfter ?? rosterCount + 1) : rosterCount,
        freeAgentCount: candidatePool.length,
        candidateCount: scoredCandidates.length,
        shortlistCount: shortlist.length,
        previewCount: previewCalls,
        warning: picked ? null : "no_legal_candidate_after_preview",
      });
      if (memoryAfter.heapUsedMb - memoryBefore.heapUsedMb > 100) {
        warningRows.push({
          round,
          teamId: team.teamId,
          reason: "large_team_memory_delta",
          detail: `${roundValue(memoryAfter.heapUsedMb - memoryBefore.heapUsedMb, 2)}mb`,
        });
      }
    }

    if (!dryRun && runContext.deferredWrites > 0) {
      const flushStartedAt = Date.now();
      const flushPhaseStartedAt = profiler.start("round_flush", {
        round,
        teamId: "ALL",
        rosterCount: runContext.save.gameState.rosters.length,
        freeAgentCount: candidatePool.length,
      });
      flushLocalTransfermarktRunContext(runContext);
      counters.saveFlushes += 1;
      profiler.end("round_flush", flushPhaseStartedAt, {
        round,
        teamId: "ALL",
        rosterCount: runContext.save.gameState.rosters.length,
        freeAgentCount: candidatePool.length,
      });
      phaseRows.push({
        round,
        teamId: "ALL",
        phase: "save_flush",
        durationMs: Date.now() - flushStartedAt,
        itemCount: runContext.save.gameState.rosters.length,
        memoryAfterMb: memorySnapshot().heapUsedMb,
      });
    }
    (globalThis as typeof globalThis & { gc?: () => void }).gc?.();
    roundDurations.push({ round, durationMs: Date.now() - roundStartedAt, picks: roundPicks });
    const state = buildState(runContext.save, pickedPlayerIds, round + 1, warnings, completedTeamsInRound);
    const summary = buildSummary({
      initialSave,
      finalSave: runContext.save,
      picks,
      memoryRows,
      warningRows,
      roundDurations,
      resumeTested,
    });
    const shouldWriteRoundReport = reportMode === "full";
    if (shouldWriteRoundReport) {
      const reportStartedAt = Date.now();
      const reportPhaseStartedAt = profiler.start("report_export", {
        round,
        teamId: "ALL",
        rosterCount: runContext.save.gameState.rosters.length,
        freeAgentCount: candidatePool.length,
        candidateCount: picks.length,
      });
      writeReports({
        outputDir,
        summary,
        state,
        initialSave,
        finalSave: runContext.save,
        picks,
        rejectedRows,
        targetPlans,
        managerProfiles,
        seasonStrategies,
        rosterBlueprints,
        marketBoardRows,
        draftRoleBoardRows,
        candidatePool,
        memoryRows,
        warningRows,
        phaseRows,
        progressRows: profiler.rows,
        counters,
        reportMode,
      });
      profiler.end("report_export", reportPhaseStartedAt, {
        round,
        teamId: "ALL",
        rosterCount: runContext.save.gameState.rosters.length,
        freeAgentCount: candidatePool.length,
        candidateCount: picks.length,
      });
      phaseRows.push({
        round,
        teamId: "ALL",
        phase: "report_export",
        durationMs: Date.now() - reportStartedAt,
        itemCount: picks.length,
      });
    } else {
      phaseRows.push({
        round,
        teamId: "ALL",
        phase: "round_report_skipped_light_mode",
        durationMs: 0,
        itemCount: picks.length,
      });
    }

    const rostersByTeamAfterRound = groupRostersByTeam(runContext.save.gameState.rosters);
    if (
      runContext.save.gameState.teams.every((team) => {
        const plan = targetPlans.get(team.teamId);
        const rosterCount = rostersByTeamAfterRound.get(team.teamId)?.length ?? 0;
        return plan ? rosterCount >= plan.desiredRosterTarget : rosterCount >= getTeamTarget(runContext.save.gameState, team.teamId, target).targetRoster;
      })
    ) {
      break;
    }
    if (roundPicks === 0) {
      warnings.push("no_progress_in_round");
      globalBlocked = true;
      break;
    }
    round += 1;
  }

  if (dryRun) {
    runContext.save = initialSave;
  }

  const finalSave = dryRun ? initialSave : persistence.getSaveById(save.saveId) ?? runContext.save;
  const finalState = buildState(finalSave, pickedPlayerIds, round, warnings);
  const finalSummary = buildSummary({
    initialSave,
    finalSave,
    picks,
    memoryRows,
    warningRows,
    roundDurations,
    resumeTested,
  });
  profiler.log("runner_complete", {
    round,
    rosterCount: finalSave.gameState.rosters.length,
    freeAgentCount: Math.max(0, finalSave.gameState.players.length - finalSave.gameState.rosters.length),
    candidateCount: picks.length,
  });
  writeReports({
    outputDir,
    summary: finalSummary,
    state: finalState,
    initialSave,
    finalSave,
    picks,
    rejectedRows,
    targetPlans,
    managerProfiles,
    seasonStrategies,
    rosterBlueprints,
    marketBoardRows,
    draftRoleBoardRows,
    candidatePool: buildCandidatePool(finalSave.gameState, pickedPlayerIds),
    memoryRows,
    warningRows,
    phaseRows,
    progressRows: profiler.rows,
    counters,
    reportMode,
  });

  return {
    dryRun,
    executed: !dryRun,
    status: finalSummary.teamsBelowMin.length === 0 ? "ready" : "warning",
    summary: finalSummary,
    state: finalState,
    picks,
    warnings,
    outputDir,
  };
  } catch (error) {
    writeRedraftAbortArtifacts({
      outputDir,
      profiler,
      counters,
      error,
      memoryRows,
      phaseRows,
      picks,
      warningRows,
    });
    throw error;
  }
}
