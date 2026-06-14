import fs from "node:fs";
import path from "node:path";

import type { GameState, Player, RosterEntry, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { getImportedPlayerDisplayMarketValue, getImportedPlayerDisplaySalary } from "@/lib/data/player-economy-display";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export const CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN = "CONFIRM_CHUNKED_REDRAFT_TOPUP_V1";

export type ChunkedRedraftMode = "season1_initial_topup" | "full_clean_redraft";
export type ChunkedRedraftTarget = "playerMin" | "playerOpt" | "playerMax";
export type ChunkedRedraftPhase = "phase_a_minimum" | "phase_b_core_optimum" | "phase_c_depth_luxury";

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
  valueScore?: number;
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
  roundLimit?: number;
  teamTimeLimitMs?: number;
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

type ScoredCandidate = Candidate & {
  selectedScore: number;
  identityFit: number;
  valueScore: number;
  salaryImpact: number;
  budgetFit: number;
  potentialScore: number;
  phaseScore: number;
  classFit: number;
  teamNeed: string;
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
  boardTier: MarketBoardTier;
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

function getPlayerAxisValue(player: Player, axis: "pow" | "spe" | "men" | "soc") {
  const direct = (player as unknown as Record<string, unknown>)[axis];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  return player.ovr ?? player.rating ?? 0;
}

function getTeamTarget(gameState: GameState, teamId: string, target: ChunkedRedraftTarget) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const playerMin = Number.isFinite(identity?.playerMin) ? Math.max(0, Math.round(identity?.playerMin ?? 7)) : 7;
  const playerOpt = Number.isFinite(identity?.playerOpt) ? Math.max(playerMin, Math.round(identity?.playerOpt ?? playerMin)) : playerMin;
  const playerMax = Number.isFinite(team?.rosterLimit) ? Math.max(playerMin, Math.round(team?.rosterLimit ?? 12)) : 12;
  const requested = target === "playerMax" ? playerMax : target === "playerOpt" ? playerOpt : playerMin;
  return {
    playerMin,
    playerOpt,
    playerMax,
    targetRoster: Math.min(requested, playerMax, 12),
  };
}

function buildCandidatePool(gameState: GameState, pickedPlayerIds: Set<string>) {
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const ratingsByPlayer = buildPlayerRatingContractMap(gameState);
  return gameState.players
    .filter((player) => !rosteredPlayerIds.has(player.id) && !pickedPlayerIds.has(player.id))
    .map<Candidate | null>((player) => {
      const marketValue = getImportedPlayerDisplayMarketValue(player);
      if (marketValue == null || marketValue <= 0) return null;
      const salary = getImportedPlayerDisplaySalary(player);
      const rating = ratingsByPlayer.get(player.id);
      const quality = rating?.ovrNormalized ?? player.ovr ?? player.rating ?? 0;
      const pow = getPlayerAxisValue(player, "pow");
      const spe = getPlayerAxisValue(player, "spe");
      const men = getPlayerAxisValue(player, "men");
      const soc = getPlayerAxisValue(player, "soc");
      return {
        player,
        marketValue,
        salary,
        quality,
        pow,
        spe,
        men,
        soc,
        pickScore: roundValue(quality * 10 - marketValue, 4),
      };
    })
    .filter((entry): entry is Candidate => Boolean(entry))
    .sort((left, right) => {
      if (right.quality !== left.quality) return right.quality - left.quality;
      if (left.marketValue !== right.marketValue) return left.marketValue - right.marketValue;
      return left.player.name.localeCompare(right.player.name, "de");
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
  strategyProfile: TeamStrategyProfile | null | undefined;
  candidatePool: Candidate[];
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
  const averageQuality = avg(input.candidatePool.map((candidate) => candidate.quality)) ?? 0;
  const starBias = toBias(input.strategyProfile?.bias?.starPriority);
  const valueBias = toBias(input.strategyProfile?.bias?.valuePriority);
  const cashBias = toBias(input.strategyProfile?.bias?.cashPriority);
  const riskBias = toBias(input.strategyProfile?.bias?.riskTolerance);
  const depthBias = toBias(input.strategyProfile?.bias?.rosterDepthPreference);

  if (phase === "phase_a_minimum") {
    const spendableCash = input.teamCash * 0.98;
    return {
      phase,
      targetRoster,
      cashReservePct: 0.02,
      shortlistCap: 112,
      maxRecommendedSpend: Math.max(1, (spendableCash / remainingSlots) * 1.05),
      qualityFloor: Math.max(6, averageQuality * 0.48),
      description: "Pflicht-Minimum: breit, guenstig, brauchbar, niedrige CashReserve.",
    };
  }

  if (phase === "phase_b_core_optimum") {
    const activeSpendMultiplier = 1.25 + starBias * 0.08 + riskBias * 0.04 - cashBias * 0.025;
    const reservePct = Math.max(0.04, Math.min(0.16, 0.14 - starBias * 0.008 + cashBias * 0.006));
    const shortlistCap = Math.round(56 + starBias * 4 + valueBias * 2);
    return {
      phase,
      targetRoster,
      cashReservePct: roundValue(reservePct, 3),
      shortlistCap,
      maxRecommendedSpend: Math.max(1, ((input.teamCash * (1 - reservePct)) / remainingSlots) * activeSpendMultiplier),
      qualityFloor: Math.max(10, averageQuality * 0.68),
      description: "Core/Optimum: Teamfit, Qualitaet, Diszi-Needs und aktive Cash-Nutzung.",
    };
  }

  const reservePct = Math.max(0.14, Math.min(0.28, 0.25 + cashBias * 0.006 - depthBias * 0.01));
  return {
    phase,
    targetRoster,
    cashReservePct: roundValue(reservePct, 3),
    shortlistCap: Math.round(32 + depthBias * 3),
    maxRecommendedSpend: Math.max(1, ((input.teamCash * (1 - reservePct)) / remainingSlots) * 0.9),
    qualityFloor: Math.max(8, averageQuality * 0.55),
    description: "Depth/Luxus: Rotation, Absicherung und vorsichtigere Budgetnutzung.",
  };
}

function getIdentityFit(candidate: Candidate, identity: TeamIdentity | null | undefined) {
  if (!identity) return roundValue(candidate.quality, 2);
  const total = Math.max(1, identity.pow + identity.spe + identity.men + identity.soc);
  return roundValue(
    (candidate.pow * identity.pow + candidate.spe * identity.spe + candidate.men * identity.men + candidate.soc * identity.soc) / total,
    2,
  );
}

function getClassFit(candidate: Candidate, roster: RosterEntry[], gameState: GameState) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const sameClassCount = roster.filter((entry) => playersById.get(entry.playerId)?.className === candidate.player.className).length;
  return sameClassCount === 0 ? 8 : sameClassCount === 1 ? 3 : -4;
}

function getSeasonLegalMin(playerMin: number) {
  return Math.max(7, Math.min(playerMin, 8));
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
  const qualities = rosterPlayers.map((player) => player.ovr ?? player.rating ?? 0).sort((left, right) => right - left);
  const topPlayerQuality = avg(qualities.slice(0, 3)) ?? 0;
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
  const teamIdentityFit = avg(
    rosterPlayers.map((player) =>
      getIdentityFit(
        {
          player,
          marketValue: getImportedPlayerDisplayMarketValue(player) ?? 0,
          salary: getImportedPlayerDisplaySalary(player),
          quality: player.ovr ?? player.rating ?? 0,
          pow: getPlayerAxisValue(player, "pow"),
          spe: getPlayerAxisValue(player, "spe"),
          men: getPlayerAxisValue(player, "men"),
          soc: getPlayerAxisValue(player, "soc"),
          pickScore: 0,
        },
        input.identity,
      ),
    ),
  ) ?? 0;
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
  teamId: string;
  target: ChunkedRedraftTarget;
  strategyProfile: TeamStrategyProfile | null | undefined;
  candidatePool: Candidate[];
}): RosterTargetPlan {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const rostersByTeam = groupRostersByTeam(input.gameState.rosters);
  const roster = rostersByTeam.get(input.teamId) ?? [];
  const target = getTeamTarget(input.gameState, input.teamId, input.target);
  const seasonLegalMin = getSeasonLegalMin(target.playerMin);
  const salaryStart = getRosterSalary(roster);
  const cashStart = roundValue(team?.cash ?? 0);
  const cashPriority = toBias(input.strategyProfile?.bias?.cashPriority);
  const valuePriority = toBias(input.strategyProfile?.bias?.valuePriority);
  const starPriority = toBias(input.strategyProfile?.bias?.starPriority);
  const riskTolerance = toBias(input.strategyProfile?.bias?.riskTolerance);
  const eliteSmallRosterPreference = toBias(input.strategyProfile?.bias?.eliteSmallRosterPreference);
  const rosterDepthPreference = toBias(input.strategyProfile?.bias?.rosterDepthPreference);
  const reservePct = Math.max(0.04, Math.min(0.22, 0.14 + cashPriority * 0.006 - starPriority * 0.008));
  const reserveBudget = roundValue(cashStart * reservePct);
  const spendableBudget = roundValue(Math.max(0, cashStart - reserveBudget));
  const averageCandidateQuality = avg(input.candidatePool.map((candidate) => candidate.quality)) ?? 0;
  const strongAffordableCandidates = input.candidatePool.filter(
    (candidate) => candidate.marketValue <= spendableBudget && candidate.quality >= Math.max(55, averageCandidateQuality * 0.75),
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

  const minTarget = allowedUnderMin ? seasonLegalMin : target.playerMin;
  const maxTransferSpend = roundValue(spendableBudget / Math.max(1, desiredRosterTarget - roster.length));
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
    targetReason,
    cashStart,
    salaryStart,
    spendableBudget,
    reserveBudget,
    maxTransferSpend,
    maxSalaryIncrease: roundValue(spendableBudget * 0.18),
    qualityFloor: roundValue(Math.max(8, averageCandidateQuality * (targetMode === "cash_recovery" ? 0.48 : 0.62))),
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
  target: ChunkedRedraftTarget;
  strategyProfiles: Record<string, TeamStrategyProfile>;
  candidatePool: Candidate[];
}) {
  return new Map(
    input.gameState.teams.map((team) => [
      team.teamId,
      buildRosterTargetPlan({
        gameState: input.gameState,
        teamId: team.teamId,
        target: input.target,
        strategyProfile: input.strategyProfiles[team.teamId],
        candidatePool: input.candidatePool,
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
  const starHigh = levelHigh(bias?.starPriority) || levelHigh(input.identity?.ambition);
  const valueHigh = levelHigh(bias?.valuePriority) || levelHigh(input.identity?.finances);
  const cashHigh = levelHigh(bias?.cashPriority) || levelHigh(input.identity?.finances);
  const riskHigh = levelHigh(bias?.riskTolerance);
  const depthHigh = levelHigh(bias?.rosterDepthPreference);
  const eliteSmallHigh = levelHigh(bias?.eliteSmallRosterPreference);
  const themeHigh = (input.strategyProfile?.preferredClasses.length ?? 0) + (input.strategyProfile?.preferredRaces.length ?? 0) + (input.strategyProfile?.preferredArchetypes.length ?? 0) >= 3;

  let managerArchetype: ManagerArchetype = "rebuild";
  if (input.team.teamId === "C-C" || text.includes("cash creators") || text.includes("value") || text.includes("bank der olympiade")) {
    managerArchetype = "value_builder";
  } else if (input.team.teamId === "W-L" || text.includes("wrecking legionnaires") || text.includes("soeldner") || text.includes("mercenary")) {
    managerArchetype = "mercenary_market";
  } else if (input.team.teamId === "T-T" || text.includes("terrible teachers") || text.includes("teacher")) {
    managerArchetype = "harmony_builder";
  } else if (["M-M", "Z-H"].includes(input.team.teamId) || text.includes("topteam") || text.includes("underground")) {
    managerArchetype = input.team.teamId === "Z-H" ? "chaotic_aggressive" : "win_now";
  } else if (input.team.teamId === "B-P" || eliteSmallHigh || text.includes("kleine elite")) {
    managerArchetype = "small_elite";
  } else if (input.team.teamId === "W-W" || input.team.teamId === "R-C" || input.team.teamId === "R-R" || text.includes("royal") || text.includes("aqua") || text.includes("magier")) {
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
  const riskTolerance: ManagerRiskTolerance = managerArchetype === "chaotic_aggressive" ? "chaotic" : riskHigh ? "high" : levelLow(bias?.riskTolerance) ? "low" : "medium";
  const qualityFloor: ManagerQualityFloor = managerArchetype === "win_now" || managerArchetype === "small_elite" ? "high" : starHigh ? "high" : spendingStyle === "emergency" ? "low" : "medium";
  const underOptPolicy: UnderOptPolicy =
    managerArchetype === "win_now" || managerArchetype === "chaotic_aggressive"
      ? "never"
      : managerArchetype === "small_elite"
        ? "only_if_readiness_high"
        : managerArchetype === "value_builder" || managerArchetype === "conservative_finance"
          ? "eco_allowed"
          : "market_wait_allowed";

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
    reason: `team=${input.team.teamId};cash=${roundValue(input.team.cash)};star=${bias?.starPriority ?? ""};value=${bias?.valuePriority ?? ""};risk=${bias?.riskTolerance ?? ""};roster=${input.roster.length}`,
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
    preferredThemes: input.strategyProfile?.preferredArchetypes.join("|") ?? "",
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
    const themeFit = candidate.classFit + candidate.identityFit * 0.08;
    const boardScore = candidate.selectedScore + candidate.identityFit * 0.35 + candidate.valueScore * 6 - salaryRisk * 18 - traitRisk;
    const boardTier: MarketBoardTier =
      candidate.marketValue > input.team.cash
        ? "Avoid"
        : boardScore >= 118 || (input.profile.managerArchetype === "win_now" && candidate.quality >= 75)
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
      boardTier,
      reason: `${boardTier};need=${candidate.teamNeed};blueprint=${input.blueprint.targetMode};profile=${input.profile.managerArchetype}`,
    };
  });
}

function scoreCandidateForTeam(input: {
  candidate: Candidate;
  roster: RosterEntry[];
  gameState: GameState;
  teamIdentity: TeamIdentity | null | undefined;
  strategyProfile: TeamStrategyProfile | null | undefined;
  phase: ChunkedRedraftPhase;
  maxRecommendedSpend: number;
}): ScoredCandidate {
  const identityFit = getIdentityFit(input.candidate, input.teamIdentity);
  const classFit = getClassFit(input.candidate, input.roster, input.gameState);
  const valueScore = roundValue(input.candidate.quality / Math.max(1, input.candidate.marketValue), 4);
  const salaryImpact = roundValue(input.candidate.salary ?? 0, 2);
  const starBias = toBias(input.strategyProfile?.bias?.starPriority);
  const valueBias = toBias(input.strategyProfile?.bias?.valuePriority);
  const wageSensitivity = toBias(input.strategyProfile?.bias?.wageSensitivity);
  const depthBias = toBias(input.strategyProfile?.bias?.rosterDepthPreference);
  const potentialScore = roundValue(input.candidate.player.potential ?? 0, 2);
  const budgetFit =
    input.candidate.marketValue <= input.maxRecommendedSpend
      ? 8
      : -Math.min(input.phase === "phase_a_minimum" ? 42 : 24, (input.candidate.marketValue - input.maxRecommendedSpend) * (input.phase === "phase_a_minimum" ? 1.35 : 0.6));
  const phaseScore =
    input.phase === "phase_a_minimum"
      ? input.candidate.quality * 0.55 + valueScore * (28 + valueBias * 1.2) + classFit * 0.45 - salaryImpact * 0.45 + budgetFit * 1.75
      : input.phase === "phase_b_core_optimum"
        ? input.candidate.quality * (1.15 + starBias * 0.04) +
          identityFit * 0.75 +
          valueScore * (9 + valueBias * 0.9) +
          potentialScore * 0.12 +
          classFit -
          salaryImpact * (0.2 + wageSensitivity * 0.035) +
          budgetFit * 0.55
        : input.candidate.quality * 0.85 +
          identityFit * 0.45 +
          valueScore * (10 + valueBias) +
          potentialScore * 0.08 +
          classFit * 1.15 +
          depthBias * 0.8 -
          salaryImpact * (0.35 + wageSensitivity * 0.04) +
          budgetFit * 1.1;
  const selectedScore = roundValue(phaseScore, 4);
  const strongestAxis = [
    ["POW", input.candidate.pow],
    ["SPE", input.candidate.spe],
    ["MEN", input.candidate.men],
    ["SOC", input.candidate.soc],
  ].sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] ?? "OVR";
  return {
    ...input.candidate,
    selectedScore,
    identityFit,
    classFit,
    valueScore,
    salaryImpact,
    budgetFit: roundValue(budgetFit, 2),
    potentialScore,
    phaseScore: selectedScore,
    teamNeed: `${strongestAxis}_coverage`,
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
}) {
  if (input.rejected.marketValue > input.teamCash) return "too_expensive" as const;
  if (input.rejected.marketValue > input.teamCash * (1 - input.phasePlan.cashReservePct)) return "reserve_guard" as const;
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
      const goodAffordable = topAffordable != null && topAffordable.quality >= 55;
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
  candidatePool?: Candidate[];
  memoryRows: MemoryRow[];
  warningRows: WarningRow[];
  phaseRows: PhaseRow[];
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
      valueScore: pick.valueScore ?? "",
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
      valueScore: pick.valueScore ?? "",
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
      valueScore: pick.valueScore ?? "",
      salaryImpact: pick.salaryImpact ?? "",
      budgetFit: pick.budgetFit ?? "",
      reason: pick.reasons,
    })),
  );
  writeCsv(input.outputDir, "chunked-redraft-team-status.csv", buildTeamRows(input.finalSave, input.warningRows) as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-phase-b-team-status.csv", buildTeamRows(input.finalSave, input.warningRows) as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-memory.csv", input.memoryRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "topup-memory-by-team.csv", input.memoryRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-warnings.csv", input.warningRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-phase-b-warnings.csv", input.warningRows as unknown as Array<Record<string, unknown>>);
  writeCsv(input.outputDir, "chunked-redraft-phase-b-performance.csv", input.phaseRows as unknown as Array<Record<string, unknown>>);
}

export function runChunkedRedraftTopup(params: ChunkedRedraftTopupParams) {
  const persistence = params.persistence ?? createPersistenceService();
  const outputDir = params.outputDir ?? path.join(process.cwd(), "outputs");
  const dryRun = params.dryRun !== false;
  const target = params.target ?? "playerMin";
  const roundLimit = Math.max(1, Math.round(params.roundLimit ?? 16));
  const teamTimeLimitMs = Math.max(100, Math.round(params.teamTimeLimitMs ?? 10_000));
  const save = persistence.getSaveById(params.saveId);
  if (!save) {
    throw new Error(`chunked_redraft_save_not_found:${params.saveId}`);
  }
  if (save.gameState.season.id !== params.seasonId) {
    throw new Error(`chunked_redraft_season_mismatch:${save.gameState.season.id}:${params.seasonId}`);
  }
  if (params.mode === "season1_initial_topup" && params.seasonId !== "season-1") {
    throw new Error(`season1_autoprep_topup_forbidden_after_s1:${params.seasonId}`);
  }
  if (!dryRun && params.confirmToken !== CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN) {
    throw new Error("chunked_redraft_confirm_token_required");
  }
  if (params.mode === "full_clean_redraft" && save.gameState.rosters.length > 0) {
    throw new Error(`full_clean_redraft_requires_empty_rosters:${save.gameState.rosters.length}`);
  }

  const resumeState = params.resume ? readResumeState(outputDir, save.saveId) : null;
  const resumeTested = Boolean(resumeState);
  const initialSave = save;
  const warnings: string[] = [...(resumeState?.warnings ?? [])];
  const pickedPlayerIds = new Set<string>([
    ...(resumeState?.pickedPlayerIds ?? []),
    ...save.gameState.rosters.map((entry) => entry.playerId),
  ]);
  const picks: ChunkedRedraftPickRow[] = [];
  const rejectedRows: RejectedCandidateRow[] = [];
  const marketBoardRows: ManagerMarketBoardRow[] = [];
  const memoryRows: MemoryRow[] = [];
  const warningRows: WarningRow[] = [];
  const phaseRows: PhaseRow[] = [];
  const roundDurations: Array<{ round: number; durationMs: number; picks: number }> = [];
  const runContext = createLocalTransfermarktRunContext({ save, persistence });
  const strategyProfiles = buildTeamStrategyProfileMap(
    runContext.save.gameState.teams,
    runContext.save.gameState.teamIdentities,
    runContext.save.gameState.seasonState.teamStrategyProfiles,
  );
  const initialCandidatePool = buildCandidatePool(runContext.save.gameState, pickedPlayerIds);
  const managerProfiles = buildManagerProfiles({
    gameState: runContext.save.gameState,
    strategyProfiles,
  });
  const targetPlans = buildRosterTargetPlans({
    gameState: runContext.save.gameState,
    target,
    strategyProfiles,
    candidatePool: initialCandidatePool,
  });
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

  let round = Math.max(1, resumeState?.round ?? 1);
  let globalBlocked = false;

  while (round <= roundLimit && !globalBlocked) {
    const roundStartedAt = Date.now();
    let roundPicks = 0;
    const completedTeamsInRound: string[] = [];
    const setupStartedAt = Date.now();
    const memoryAtRoundStart = memorySnapshot();
    const candidatePool = buildCandidatePool(runContext.save.gameState, pickedPlayerIds);
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

    for (const team of runContext.save.gameState.teams) {
      const teamStartedAt = Date.now();
      const memoryBefore = memorySnapshot();
      const latestTeam = runContext.save.gameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
      const rosterCount = rostersByTeam.get(team.teamId)?.length ?? 0;
      const teamRoster = rostersByTeam.get(team.teamId) ?? [];
      const teamTarget = getTeamTarget(runContext.save.gameState, team.teamId, target);
      const teamIdentity = runContext.save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const strategyProfile = strategyProfiles[team.teamId] ?? null;
      const targetPlan = targetPlans.get(team.teamId) ?? null;
      const managerProfile = managerProfiles.get(team.teamId) ?? null;
      const seasonStrategy = seasonStrategies.get(team.teamId) ?? null;
      const rosterBlueprint = rosterBlueprints.get(team.teamId) ?? null;
      const phasePlan = buildPhasePlan({
        target,
        rosterCount,
        teamTarget,
        targetPlan,
        teamCash: latestTeam.cash,
        strategyProfile,
        candidatePool,
      });

      if (rosterCount >= phasePlan.targetRoster) {
        warningRows.push({
          round,
          teamId: team.teamId,
          reason: "team_target_reached",
          detail: `${rosterCount}/${phasePlan.targetRoster};${phasePlan.phase};mode=${targetPlan?.targetMode ?? ""}`,
        });
        continue;
      }
      if (rosterCount >= teamTarget.playerMax) {
        warningRows.push({ round, teamId: team.teamId, reason: "team_player_max_reached", detail: `${rosterCount}/${teamTarget.playerMax}` });
        continue;
      }

      const filterStartedAt = Date.now();
      const cashAffordableCandidates = candidatePool
        .filter((candidate) => !pickedPlayerIds.has(candidate.player.id))
        .filter((candidate) => latestTeam.cash * (1 - phasePlan.cashReservePct) >= candidate.marketValue);
      const qualitySafeCandidates = cashAffordableCandidates.filter((candidate) => candidate.quality >= phasePlan.qualityFloor);
      const affordableCandidates =
        phasePlan.phase === "phase_a_minimum" && qualitySafeCandidates.length < Math.min(4, cashAffordableCandidates.length)
          ? cashAffordableCandidates
          : qualitySafeCandidates;
      const budgetSafeCandidates = affordableCandidates.filter((candidate) => candidate.marketValue <= phasePlan.maxRecommendedSpend);
      const planningPool =
        phasePlan.phase === "phase_b_core_optimum"
          ? affordableCandidates
          : phasePlan.phase === "phase_a_minimum" && budgetSafeCandidates.length > 0
            ? budgetSafeCandidates
            : budgetSafeCandidates.length >= Math.min(8, affordableCandidates.length)
            ? budgetSafeCandidates
            : affordableCandidates;
      const scoredCandidates = planningPool
        .map((candidate) =>
          scoreCandidateForTeam({
            candidate,
            roster: teamRoster,
            gameState: runContext.save.gameState,
            teamIdentity,
            strategyProfile,
            phase: phasePlan.phase,
            maxRecommendedSpend: phasePlan.maxRecommendedSpend,
          }),
        )
        .sort((left, right) => {
          if (right.selectedScore !== left.selectedScore) return right.selectedScore - left.selectedScore;
          if (right.quality !== left.quality) return right.quality - left.quality;
          return left.marketValue - right.marketValue;
        });
      const shortlistCap = phasePlan.shortlistCap;
      const shortlist = scoredCandidates.slice(0, shortlistCap);
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
        note: `phase=${phasePlan.phase};${phasePlan.description};cashAffordable=${cashAffordableCandidates.length};qualitySafe=${qualitySafeCandidates.length};budgetSafe=${budgetSafeCandidates.length};maxRecommendedSpend=${roundValue(phasePlan.maxRecommendedSpend)};cashReservePct=${phasePlan.cashReservePct};qualityFloor=${roundValue(phasePlan.qualityFloor)}`,
      });

      if (shortlist.length === 0) {
        warningRows.push({ round, teamId: team.teamId, reason: "no_affordable_candidate", detail: `cash=${latestTeam.cash}` });
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
        const result = executeLocalTransfermarktBuy({
          saveId: runContext.save.saveId,
          seasonId: runContext.save.gameState.season.id,
          teamId: team.teamId,
          playerId: candidate.player.id,
          contractLength: 1,
          transferSource: "season1_autoprep_topup",
          localRunContext: runContext,
          deferPersist: true,
        });
        if (!result.canBuy) {
          warningRows.push({
            round,
            teamId: team.teamId,
            reason: "buy_blocked",
            detail: `${candidate.player.id}:${result.blockingReasons.join("|")}`,
          });
          continue;
        }
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
          whySelected: `${selectedBoardRow?.reason ?? phasePlan.description};score=${candidate.selectedScore}`,
          whyRejectedOthers: pickRejectedRows.map((row) => `${row.rejectedPlayerName}:${row.rejectionCategory}`).join("|"),
          targetProgress,
          pickScore: candidate.pickScore,
          selectedScore: candidate.selectedScore,
          teamNeed: candidate.teamNeed,
          role: candidate.player.className,
          currentRating: roundValue(candidate.quality, 2),
          potentialRange: getPotentialRange(candidate.player.potential),
          qualityTier: getQualityTier(candidate.quality),
          axisFitPow: roundValue(candidate.pow, 2),
          axisFitSpe: roundValue(candidate.spe, 2),
          axisFitMen: roundValue(candidate.men, 2),
          axisFitSoc: roundValue(candidate.soc, 2),
          classFit: candidate.classFit,
          identityFit: candidate.identityFit,
          valueScore: candidate.valueScore,
          salaryImpact: candidate.salaryImpact,
          budgetFit: candidate.budgetFit,
          topRejectedCandidates: getTopRejectedCandidates(scoredCandidates, candidate.player.id),
          ...rejectedFields,
          previewCalls,
          candidateCount: shortlist.length,
          reasons: `${phasePlan.phase};teamNeed=${candidate.teamNeed};quality=${roundValue(candidate.quality, 2)};identityFit=${candidate.identityFit};valueScore=${candidate.valueScore};potential=${candidate.potentialScore};marketValue=${candidate.marketValue};cashReservePct=${phasePlan.cashReservePct}`,
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
      flushLocalTransfermarktRunContext(runContext);
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
    const reportStartedAt = Date.now();
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
      candidatePool,
      memoryRows,
      warningRows,
      phaseRows,
    });
    phaseRows.push({
      round,
      teamId: "ALL",
      phase: "report_export",
      durationMs: Date.now() - reportStartedAt,
      itemCount: picks.length,
    });

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
    candidatePool: buildCandidatePool(finalSave.gameState, pickedPlayerIds),
    memoryRows,
    warningRows,
    phaseRows,
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
}
