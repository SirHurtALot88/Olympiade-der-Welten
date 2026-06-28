import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type {
  AiLifecyclePhase,
  AiLifecyclePhaseRunRecord,
  AiLifecyclePhaseStatus,
  AiManagerMemoryRecord,
  GameState,
  TeamControlMode,
} from "@/lib/data/olyDataTypes";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildSeasonReview } from "@/lib/season/season-review-service";

export type AiLifecycleAllowedAction =
  | "read_state"
  | "plan_strategy"
  | "prepare_market_board"
  | "execute_ai_market"
  | "apply_facility_service"
  | "apply_training_service"
  | "plan_ai_lineup"
  | "apply_lineup_service"
  | "apply_matchday_result"
  | "apply_standings"
  | "write_manager_memory"
  | "season_transition_service";

export type AiLifecyclePhaseDefinition = {
  phase: AiLifecyclePhase;
  label: string;
  timing: "setup" | "preseason" | "matchday" | "midseason" | "season_end" | "postseason" | "transition";
  writeMode: "read_only" | "official_services_only";
  sourceOfTruth: string[];
  inputs: string[];
  outputs: string[];
  caches: string[];
  reports: string[];
  allowedActions: AiLifecycleAllowedAction[];
  blockedActions: string[];
  requiredInputs: string[];
  producedOutputs: string[];
  performanceBudget: {
    targetMs: number;
    hardCapMs: number;
    targetAvgPickMs?: number;
    hardCapAvgPickMs?: number;
    singleTeamTargetMs?: number;
  };
  resumePossible: boolean;
  degradedAllowed: boolean;
};

export type AiLifecycleTriggerRule = {
  triggerId: string;
  phase: AiLifecyclePhase;
  category: "training" | "building" | "market" | "strategy";
  condition: string;
  action: string;
  writeAllowed: boolean;
};

export type AiLifecycleStatus = {
  saveId: string;
  seasonId: string;
  matchdayId: string | null;
  currentPhase: AiLifecyclePhase;
  pending: AiLifecyclePhase[];
  running: AiLifecyclePhase[];
  completed: AiLifecyclePhase[];
  failed: AiLifecyclePhase[];
  blocked: AiLifecyclePhase[];
  skipped: AiLifecyclePhase[];
  degraded: AiLifecyclePhase[];
  lastRun: AiLifecyclePhaseRunRecord | null;
  warnings: string[];
};

export type AiLifecyclePhaseRunOptions = {
  dryRun?: boolean;
  outputDir?: string | null;
  persistStatus?: boolean;
};

export type AiLifecyclePhaseRunResult = {
  readOnly: true;
  productiveWrites: false;
  phase: AiLifecyclePhase;
  status: AiLifecyclePhaseStatus;
  run: AiLifecyclePhaseRunRecord;
  phaseDefinition: AiLifecyclePhaseDefinition;
  managerMemoryPreview?: Record<string, AiManagerMemoryRecord>;
  warnings: string[];
  blockers: string[];
};

const PHASE_ORDER: AiLifecyclePhase[] = [
  "new_game_setup",
  "preseason_review",
  "preseason_strategy",
  "preseason_market",
  "preseason_facilities",
  "preseason_training_setup",
  "matchday_preparation",
  "matchday_resolve",
  "matchday_review",
  "midseason_check",
  "season_end_review",
  "postseason_management",
  "season_transition",
];

const PERFORMANCE_BUDGETS: Record<AiLifecyclePhase, AiLifecyclePhaseDefinition["performanceBudget"]> = {
  new_game_setup: { targetMs: 5_000, hardCapMs: 30_000 },
  preseason_review: { targetMs: 10_000, hardCapMs: 60_000 },
  preseason_strategy: { targetMs: 10_000, hardCapMs: 60_000 },
  preseason_market: { targetMs: 300_000, hardCapMs: 600_000, targetAvgPickMs: 500, hardCapAvgPickMs: 1_000 },
  preseason_facilities: { targetMs: 10_000, hardCapMs: 60_000 },
  preseason_training_setup: { targetMs: 5_000, hardCapMs: 30_000 },
  matchday_preparation: { targetMs: 5_000, hardCapMs: 30_000, singleTeamTargetMs: 250 },
  matchday_resolve: { targetMs: 30_000, hardCapMs: 60_000 },
  matchday_review: { targetMs: 30_000, hardCapMs: 120_000 },
  midseason_check: { targetMs: 15_000, hardCapMs: 60_000 },
  season_end_review: { targetMs: 120_000, hardCapMs: 300_000 },
  postseason_management: { targetMs: 120_000, hardCapMs: 300_000 },
  season_transition: { targetMs: 30_000, hardCapMs: 120_000 },
};

export const AI_LIFECYCLE_PHASE_DEFINITIONS: AiLifecyclePhaseDefinition[] = [
  {
    phase: "new_game_setup",
    label: "New Game Setup",
    timing: "setup",
    writeMode: "read_only",
    sourceOfTruth: ["new-game-setup-service"],
    inputs: ["seed teams", "start cash", "empty rosters"],
    outputs: ["baseline save check"],
    caches: [],
    reports: ["new-game setup audit"],
    allowedActions: ["read_state"],
    blockedActions: ["ai planning", "market apply", "lineup apply"],
    requiredInputs: ["teams", "team identities", "season"],
    producedOutputs: ["save baseline"],
    performanceBudget: PERFORMANCE_BUDGETS.new_game_setup,
    resumePossible: false,
    degradedAllowed: false,
  },
  {
    phase: "preseason_review",
    label: "Preseason Review",
    timing: "preseason",
    writeMode: "read_only",
    sourceOfTruth: ["season-review-service", "board/team-season-objectives-service"],
    inputs: ["last season snapshot", "cash", "salaries", "rosters", "facilities", "morale"],
    outputs: ["review findings", "manager profile refresh candidates"],
    caches: ["teamById", "rosterByTeam", "salaryByTeam", "facilityByTeam"],
    reports: ["preseason-review.md"],
    allowedActions: ["read_state"],
    blockedActions: ["transfer writes", "training writes", "facility writes"],
    requiredInputs: ["seasonState", "teams", "rosters"],
    producedOutputs: ["preseason review warnings"],
    performanceBudget: PERFORMANCE_BUDGETS.preseason_review,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "preseason_strategy",
    label: "Preseason Strategy",
    timing: "preseason",
    writeMode: "read_only",
    sourceOfTruth: ["manager-ai planner", "team-strategy-profiles"],
    inputs: ["manager memory", "team identity", "board pressure", "roster status"],
    outputs: ["roster blueprint", "budget buckets", "market board plan", "facility/training goals"],
    caches: ["playerById", "teamById", "rosterByTeam", "marketBoardByTeam"],
    reports: ["strategy-plan.json", "market-board-cache.csv"],
    allowedActions: ["read_state", "plan_strategy", "prepare_market_board"],
    blockedActions: ["buy", "sell", "lineup save", "facility apply", "training apply"],
    requiredInputs: ["aiManagerMemory", "teamStrategyProfiles", "teamControlSettings"],
    producedOutputs: ["manager plan", "budget buckets", "market board"],
    performanceBudget: PERFORMANCE_BUDGETS.preseason_strategy,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "preseason_market",
    label: "Preseason Market",
    timing: "preseason",
    writeMode: "official_services_only",
    sourceOfTruth: ["chunked-redraft-topup-service", "transfermarkt-local-service"],
    inputs: ["market board", "budget buckets", "roster blueprint", "free agents"],
    outputs: ["AI transfers", "transfer history", "round checkpoints"],
    caches: ["freeAgentPool", "playerById", "teamById", "rosterByTeam", "salaryByPlayer", "marketValueByPlayer"],
    reports: ["chunked-redraft-picks.csv", "chunked-redraft-memory.csv"],
    allowedActions: ["read_state", "execute_ai_market"],
    blockedActions: ["human team apply", "remote team apply", "direct roster insert", "season2 topup"],
    requiredInputs: ["market board", "budget buckets", "control modes"],
    producedOutputs: ["transferHistory", "round checkpoints"],
    performanceBudget: PERFORMANCE_BUDGETS.preseason_market,
    resumePossible: true,
    degradedAllowed: false,
  },
  {
    phase: "preseason_facilities",
    label: "Preseason Facilities",
    timing: "preseason",
    writeMode: "official_services_only",
    sourceOfTruth: ["facility-maintenance-service", "facility-upgrade-service"],
    inputs: ["facility plan", "maintenance budget", "cash reserve"],
    outputs: ["facility actions via service", "facility warnings"],
    caches: ["facilityByTeam", "budgetByTeam"],
    reports: ["facility-actions.csv"],
    allowedActions: ["read_state", "apply_facility_service"],
    blockedActions: ["transfer budget override", "direct facility mutation"],
    requiredInputs: ["teamFacilities", "budget buckets"],
    producedOutputs: ["facilityEvents"],
    performanceBudget: PERFORMANCE_BUDGETS.preseason_facilities,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "preseason_training_setup",
    label: "Preseason Training Setup",
    timing: "preseason",
    writeMode: "official_services_only",
    sourceOfTruth: ["training-settings-service"],
    inputs: ["training plan", "fatigue", "injury risk", "facility efficiency"],
    outputs: ["training focus/intensity via service", "per-player training modes via service"],
    caches: ["availabilityByPlayer", "facilityByTeam"],
    reports: ["training-actions.csv"],
    allowedActions: ["read_state", "apply_training_service"],
    blockedActions: ["manual team training apply", "remote team training apply"],
    requiredInputs: ["training plan", "teamControlSettings"],
    producedOutputs: ["aiManagerTrainingSettings", "playerTrainingMode overrides"],
    performanceBudget: PERFORMANCE_BUDGETS.preseason_training_setup,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "matchday_preparation",
    label: "Matchday Preparation",
    timing: "matchday",
    writeMode: "official_services_only",
    sourceOfTruth: ["legacy-lineup-local-service", "lineup validator"],
    inputs: ["discipline schedule", "fatigue", "injury", "form cards", "mutators"],
    outputs: ["AI lineup plans", "lineup validation"],
    caches: ["playerDisciplineScores", "bestSlotsByPlayer", "bestPlayersBySlot", "availabilityByPlayer"],
    reports: ["lineup-preview.csv"],
    allowedActions: ["read_state", "plan_ai_lineup", "apply_lineup_service"],
    blockedActions: ["human lineup overwrite", "remote lineup overwrite", "validator bypass"],
    requiredInputs: ["matchday schedule", "control modes"],
    producedOutputs: ["lineupDrafts"],
    performanceBudget: PERFORMANCE_BUDGETS.matchday_preparation,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "matchday_resolve",
    label: "Matchday Resolve",
    timing: "matchday",
    writeMode: "official_services_only",
    sourceOfTruth: ["legacy-matchday-result-apply-service", "standings-apply-service"],
    inputs: ["locked lineups", "discipline schedule"],
    outputs: ["results", "standings", "history"],
    caches: ["lineupsByTeam", "disciplineById"],
    reports: ["matchday-result-audit.csv"],
    allowedActions: ["read_state", "apply_matchday_result", "apply_standings"],
    blockedActions: ["market planning", "strategy replanning", "human/remote result apply bypass", "direct standings mutation"],
    requiredInputs: ["valid lineups"],
    producedOutputs: ["matchdayResults", "disciplineResults", "standingsApplyLogs"],
    performanceBudget: PERFORMANCE_BUDGETS.matchday_resolve,
    resumePossible: false,
    degradedAllowed: false,
  },
  {
    phase: "matchday_review",
    label: "Matchday Review",
    timing: "matchday",
    writeMode: "read_only",
    sourceOfTruth: ["playerDisciplinePerformances", "manager memory preview"],
    inputs: ["matchday performance", "injury/fatigue", "lineup problems"],
    outputs: ["review notes", "manager memory deltas"],
    caches: ["performanceByTeamPlayer"],
    reports: ["matchday-review.csv"],
    allowedActions: ["read_state"],
    blockedActions: ["market apply", "lineup apply"],
    requiredInputs: ["matchdayResults", "playerDisciplinePerformances"],
    producedOutputs: ["manager memory preview"],
    performanceBudget: PERFORMANCE_BUDGETS.matchday_review,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "midseason_check",
    label: "Midseason Check",
    timing: "midseason",
    writeMode: "read_only",
    sourceOfTruth: ["trigger map", "manager plan"],
    inputs: ["fatigue clusters", "injuries", "cash", "board trust", "contracts"],
    outputs: ["triggered adjustment previews"],
    caches: ["teamRiskById"],
    reports: ["midseason-trigger-check.csv"],
    allowedActions: ["read_state"],
    blockedActions: ["large market action unless transfer window allows"],
    requiredInputs: ["trigger map"],
    producedOutputs: ["adjustment preview"],
    performanceBudget: PERFORMANCE_BUDGETS.midseason_check,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "season_end_review",
    label: "Season-End Review",
    timing: "season_end",
    writeMode: "read_only",
    sourceOfTruth: ["season-review-service", "player performance", "standings"],
    inputs: ["final standings", "performance", "transfers", "facilities", "training"],
    outputs: ["team review", "player review", "manager memory"],
    caches: ["performanceByTeamPlayer", "transfersByTeam"],
    reports: ["season-review-team-summary.csv", "season-review-player-summary.csv", "season-review-board-report.md"],
    allowedActions: ["read_state", "write_manager_memory"],
    blockedActions: ["contract apply", "market apply", "season transition apply"],
    requiredInputs: ["final standings"],
    producedOutputs: ["aiManagerMemory"],
    performanceBudget: PERFORMANCE_BUDGETS.season_end_review,
    resumePossible: true,
    degradedAllowed: false,
  },
  {
    phase: "postseason_management",
    label: "Postseason Management",
    timing: "postseason",
    writeMode: "official_services_only",
    sourceOfTruth: ["contract-renewal-service", "facility-season-end-service", "market previews"],
    inputs: ["manager memory", "renewal strategy", "sell strategy", "facility decay"],
    outputs: ["postseason actions via official services"],
    caches: ["contractsByTeam", "facilityByTeam", "budgetByTeam"],
    reports: ["postseason-management-preview.csv"],
    allowedActions: ["read_state"],
    blockedActions: ["direct contract mutation", "direct facility mutation"],
    requiredInputs: ["aiManagerMemory"],
    producedOutputs: ["renewal/sell/facility previews"],
    performanceBudget: PERFORMANCE_BUDGETS.postseason_management,
    resumePossible: true,
    degradedAllowed: true,
  },
  {
    phase: "season_transition",
    label: "Season Transition",
    timing: "transition",
    writeMode: "official_services_only",
    sourceOfTruth: ["preseason-workflow-service", "season-transition-service"],
    inputs: ["season snapshot", "manager memory", "next schedule"],
    outputs: ["next season", "carried manager memory"],
    caches: ["seasonSnapshot"],
    reports: ["season-transition-report.md"],
    allowedActions: ["read_state", "season_transition_service"],
    blockedActions: ["season1_autoprep_topup after season 1", "direct save reset"],
    requiredInputs: ["season snapshot", "aiManagerMemory"],
    producedOutputs: ["next season state"],
    performanceBudget: PERFORMANCE_BUDGETS.season_transition,
    resumePossible: true,
    degradedAllowed: false,
  },
];

export const AI_LIFECYCLE_TRIGGER_RULES: AiLifecycleTriggerRule[] = [
  { triggerId: "training_injury_cluster", phase: "midseason_check", category: "training", condition: "injuryCount high", action: "preview recovery/light training", writeAllowed: false },
  { triggerId: "training_fatigue_70_cluster", phase: "midseason_check", category: "training", condition: "many players fatigue >= 70", action: "preview light/recovery training", writeAllowed: false },
  { triggerId: "training_upcoming_key_discipline", phase: "matchday_preparation", category: "training", condition: "important upcoming disciplines", action: "read training fit only", writeAllowed: false },
  { triggerId: "building_condition_below_70", phase: "preseason_facilities", category: "building", condition: "conditionPct < 70", action: "maintenance via facility service", writeAllowed: true },
  { triggerId: "building_effect_loss", phase: "preseason_facilities", category: "building", condition: "facility effect strongly declining", action: "maintenance/upgrade preview", writeAllowed: true },
  { triggerId: "market_roster_under_min", phase: "preseason_market", category: "market", condition: "roster < playerMin", action: "chunked topup via buy service", writeAllowed: true },
  { triggerId: "market_core_injury", phase: "midseason_check", category: "market", condition: "core player long-term unavailable", action: "emergency market preview", writeAllowed: false },
  { triggerId: "strategy_season_end", phase: "season_end_review", category: "strategy", condition: "season ended", action: "write manager memory preview", writeAllowed: false },
  { triggerId: "strategy_board_trust_drop", phase: "midseason_check", category: "strategy", condition: "board trust strongly falls", action: "strategy re-evaluation preview", writeAllowed: false },
  { triggerId: "strategy_negative_cash", phase: "midseason_check", category: "strategy", condition: "cash negative", action: "risk plan preview", writeAllowed: false },
];

function nowIso() {
  return new Date().toISOString();
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getSeasonNumber(gameState: GameState) {
  return Number(gameState.season.id.match(/(\d+)$/)?.[1] ?? gameState.season.name.match(/(\d+)$/)?.[1] ?? 1) || 1;
}

function getTeamControlMode(gameState: GameState, teamId: string): TeamControlMode {
  const settings = getTeamControlSettings(gameState, teamId);
  if (settings?.controlMode) return settings.controlMode;
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team?.humanControlled ? "manual" : "ai";
}

function getWritableAiTeamIds(gameState: GameState) {
  return gameState.teams.filter((team) => getTeamControlMode(gameState, team.teamId) === "ai").map((team) => team.teamId);
}

function phaseDefinition(phase: AiLifecyclePhase) {
  const definition = AI_LIFECYCLE_PHASE_DEFINITIONS.find((entry) => entry.phase === phase);
  if (!definition) {
    throw new Error(`Unknown AI lifecycle phase ${phase}`);
  }
  return definition;
}

function resolveCurrentLifecyclePhase(gameState: GameState): AiLifecyclePhase {
  if (gameState.gamePhase === "season_completed" || gameState.gamePhase === "season_review") return "season_end_review";
  if (gameState.gamePhase === "season_rewards" || gameState.gamePhase === "player_development") return "postseason_management";
  if (gameState.gamePhase === "preseason_management") return "preseason_strategy";
  if (gameState.gamePhase === "transfer_sell_phase" || gameState.gamePhase === "transfer_buy_phase") return "preseason_market";
  if (gameState.gamePhase === "lineup_setup") return "matchday_preparation";
  if (gameState.gamePhase === "next_season_ready") return "season_transition";
  return gameState.matchdayState.status === "resolved" ? "matchday_review" : "matchday_preparation";
}

function buildMemoryForTeam(gameState: GameState, teamId: string, generatedAt: string): AiManagerMemoryRecord {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const standing = gameState.seasonState.standings?.[teamId];
  const rosters = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const performances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((entry) => entry.teamId === teamId);
  const transferRows = (gameState.transferHistory ?? []).filter(
    (entry) => entry.seasonId === gameState.season.id && (entry.fromTeamId === teamId || entry.toTeamId === teamId),
  );
  const averagePerformance = performances.length > 0
    ? performances.reduce((sum, entry) => sum + entry.finalPlayerScore, 0) / performances.length
    : null;
  const playerPerformance = rosters
    .map((roster) => {
      const player = playersById.get(roster.playerId);
      const rows = performances.filter((entry) => entry.playerId === roster.playerId);
      const average = rows.length > 0 ? rows.reduce((sum, entry) => sum + entry.finalPlayerScore, 0) / rows.length : null;
      return { playerId: roster.playerId, playerName: player?.name ?? roster.playerId, average };
    })
    .filter((entry) => entry.average != null)
    .sort((left, right) => (right.average ?? 0) - (left.average ?? 0));
  const injuries = (gameState.seasonState.playerAvailabilityState ?? []).filter((entry) => entry.teamId === teamId && entry.injuryStatus === "injured");
  const highFatiguePlayers = rosters
    .map((roster) => playersById.get(roster.playerId))
    .filter((player): player is GameState["players"][number] => player != null && (player.fatigue ?? 0) >= 70);
  const nextSeasonHints = [
    rosters.length < (team?.rosterMinTarget ?? 0) ? "Kader unter Minimum priorisieren." : null,
    injuries.length > 0 ? "Recovery/Injury-Risiko in Planung einpreisen." : null,
    highFatiguePlayers.length > 0 ? "Fatigue-Cluster vor Training/Lineup pruefen." : null,
    averagePerformance != null && averagePerformance < 45 ? "Performancekrise triggert Strategie-Review." : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    teamId,
    seasonId: gameState.season.id,
    lastSeasonRank: standing?.rank ?? null,
    lastSeasonPoints: standing?.points ?? null,
    prizeMoney: null,
    cashTrend: "unknown",
    salaryTrend: "unknown",
    rosterSizeTrend: "unknown",
    playerPerformanceNotes: averagePerformance == null ? ["Keine belastbaren Performance-Daten."] : [`Ø Performance ${round(averagePerformance, 1)}.`],
    underperformingPlayers: playerPerformance.filter((entry) => (entry.average ?? 0) < 42).slice(0, 5).map((entry) => entry.playerName),
    breakoutPlayers: playerPerformance.filter((entry) => (entry.average ?? 0) >= 70).slice(0, 5).map((entry) => entry.playerName),
    injuryProblems: injuries.slice(0, 5).map((entry) => entry.playerId),
    fatigueProblems: highFatiguePlayers.slice(0, 5).map((entry) => entry.name),
    disciplineWeaknesses: [],
    disciplineStrengths: [],
    boardTrustTrend: "unknown",
    moraleTrend: "unknown",
    transferMistakes: transferRows.filter((entry) => entry.transferType === "buy" && entry.fee > (entry.marketValue ?? entry.fee)).slice(0, 5).map((entry) => entry.playerId),
    goodTransfers: transferRows.filter((entry) => entry.transferType === "buy" && entry.fee <= (entry.marketValue ?? entry.fee)).slice(0, 5).map((entry) => entry.playerId),
    facilityNeeds: [],
    trainingEffectiveness: [],
    nextSeasonHints,
    source: "ai_lifecycle_season_review",
    generatedAt,
  };
}

export function buildAiManagerMemoryPreview(gameState: GameState): Record<string, AiManagerMemoryRecord> {
  const generatedAt = nowIso();
  return Object.fromEntries(gameState.teams.map((team) => [team.teamId, buildMemoryForTeam(gameState, team.teamId, generatedAt)]));
}

export function getAiLifecyclePhaseDefinition(phase: AiLifecyclePhase) {
  return phaseDefinition(phase);
}

export function getAiLifecycleStatus(saveId: string): AiLifecycleStatus {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId) ?? persistence.getActiveSave();
  if (!save) {
    throw new Error(`Save ${saveId} could not be resolved.`);
  }
  const runs = save.gameState.seasonState.aiLifecyclePhaseRuns ?? [];
  const byStatus = (status: AiLifecyclePhaseStatus) => runs.filter((run) => run.status === status).map((run) => run.phase);
  return {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.matchdayState.matchdayId ?? null,
    currentPhase: resolveCurrentLifecyclePhase(save.gameState),
    pending: PHASE_ORDER.filter((phase) => !runs.some((run) => run.phase === phase)),
    running: byStatus("running"),
    completed: byStatus("completed"),
    failed: byStatus("failed"),
    blocked: byStatus("blocked"),
    skipped: byStatus("skipped"),
    degraded: byStatus("degraded"),
    lastRun: runs[runs.length - 1] ?? null,
    warnings: runs.flatMap((run) => run.warnings).slice(-20),
  };
}

export async function runAiLifecyclePhase(
  saveId: string,
  phase: AiLifecyclePhase,
  options: AiLifecyclePhaseRunOptions = {},
): Promise<AiLifecyclePhaseRunResult> {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId) ?? persistence.getActiveSave();
  if (!save) {
    throw new Error(`Save ${saveId} could not be resolved.`);
  }

  const startedAt = performance.now();
  const startedAtIso = nowIso();
  const definition = phaseDefinition(phase);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const affectedTeams = definition.writeMode === "official_services_only" ? getWritableAiTeamIds(save.gameState) : [];
  const affectedPlayers: string[] = [];
  let managerMemoryPreview: Record<string, AiManagerMemoryRecord> | undefined;

  if (phase === "preseason_market" && getSeasonNumber(save.gameState) > 1) {
    warnings.push("season1_autoprep_topup_blocked_after_season_1");
  }
  if (phase === "preseason_market" && affectedTeams.length === 0) {
    blockers.push("no_ai_teams_available_for_market_phase");
  }
  if (phase === "season_end_review") {
    buildSeasonReview(save.gameState);
    managerMemoryPreview = buildAiManagerMemoryPreview(save.gameState);
  }
  if (definition.writeMode === "official_services_only") {
    warnings.push("writes_must_use_official_services_only");
  }
  if (options.persistStatus) {
    warnings.push("persistStatus_not_enabled_in_v1_read_only_runner");
  }

  const durationMs = round(performance.now() - startedAt, 2);
  if (durationMs > definition.performanceBudget.targetMs) {
    warnings.push(`performance_budget_target_exceeded:${durationMs}>${definition.performanceBudget.targetMs}`);
  }
  if (durationMs > definition.performanceBudget.hardCapMs) {
    blockers.push(`performance_budget_hard_cap_exceeded:${durationMs}>${definition.performanceBudget.hardCapMs}`);
  }

  const status: AiLifecyclePhaseStatus = blockers.length > 0 ? "blocked" : warnings.some((warning) => warning.startsWith("performance_budget")) ? "degraded" : "completed";
  const run: AiLifecyclePhaseRunRecord = {
    runId: `ai-lifecycle-${phase}-${randomUUID()}`,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.matchdayState.matchdayId ?? null,
    phase,
    status,
    startedAt: startedAtIso,
    completedAt: nowIso(),
    durationMs,
    memoryPeakMb: round(process.memoryUsage().heapUsed / 1024 / 1024, 2),
    warnings,
    blockers,
    affectedTeams,
    affectedPlayers,
    outputFiles: definition.reports,
    canResume: definition.resumePossible,
  };

  return {
    readOnly: true,
    productiveWrites: false,
    phase,
    status,
    run,
    phaseDefinition: definition,
    managerMemoryPreview,
    warnings,
    blockers,
  };
}

export function resumeAiLifecyclePhase(saveId: string, phase: AiLifecyclePhase) {
  return runAiLifecyclePhase(saveId, phase, { dryRun: true });
}

export function cancelAiLifecyclePhase(saveId: string, phase: AiLifecyclePhase): AiLifecyclePhaseRunRecord {
  const now = nowIso();
  return {
    runId: `ai-lifecycle-cancel-${phase}-${randomUUID()}`,
    saveId,
    seasonId: "unknown",
    matchdayId: null,
    phase,
    status: "blocked",
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    memoryPeakMb: null,
    warnings: ["cancel_requested_no_external_queue_in_v1"],
    blockers: ["phase_cancelled"],
    affectedTeams: [],
    affectedPlayers: [],
    outputFiles: [],
    canResume: true,
  };
}

export function exportAiLifecycleReport(saveId: string) {
  const status = getAiLifecycleStatus(saveId);
  return {
    status,
    phaseMap: AI_LIFECYCLE_PHASE_DEFINITIONS,
    triggerRules: AI_LIFECYCLE_TRIGGER_RULES,
  };
}
