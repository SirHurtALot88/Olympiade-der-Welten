import type {
  GameState,
  Team,
  TeamBoardConfidenceRecord,
  TeamIdentity,
  TeamSeasonObjectiveCategory,
  TeamSeasonObjectiveRecord,
  TeamSeasonObjectiveStatus,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows, type TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

export type TeamObjectiveAiBias = {
  teamId: string;
  pressure: number;
  transferAggression: number;
  buyAggression: number;
  sellAggression: number;
  budgetConservatism: number;
  facilityPriority: number;
  developmentPriority: number;
  rosterUrgency: number;
  warnings: string[];
};

export type TeamObjectiveOverview = {
  seasonId: string;
  objectives: TeamSeasonObjectiveRecord[];
  boardConfidence: Record<string, TeamBoardConfidenceRecord>;
  aiBiasByTeamId: Record<string, TeamObjectiveAiBias>;
  warnings: string[];
};

type ObjectiveDraft = {
  objectiveId: string;
  category: TeamSeasonObjectiveCategory;
  label: string;
  targetValue: number | string | boolean | null;
  currentValue: number | string | boolean | null;
  status: TeamSeasonObjectiveStatus;
  rewardCash?: number;
  penaltyCash?: number;
  boardConfidenceDelta?: number;
  source?: string;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBoardConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5;
  if (value > 10) return clamp(value / 10, 1, 10);
  return clamp(value, 1, 10);
}

function statusForRank(rank: number | null, targetRank: number) {
  if (rank == null) return "open" satisfies TeamSeasonObjectiveStatus;
  if (rank <= targetRank) return "completed" satisfies TeamSeasonObjectiveStatus;
  if (rank <= targetRank + 4) return "at_risk" satisfies TeamSeasonObjectiveStatus;
  return "failed" satisfies TeamSeasonObjectiveStatus;
}

function statusForMin(value: number | null, target: number) {
  if (value == null) return "open" satisfies TeamSeasonObjectiveStatus;
  if (value >= target) return "completed" satisfies TeamSeasonObjectiveStatus;
  if (value >= target * 0.85) return "at_risk" satisfies TeamSeasonObjectiveStatus;
  return "failed" satisfies TeamSeasonObjectiveStatus;
}

function statusForMax(value: number | null, target: number) {
  if (value == null) return "open" satisfies TeamSeasonObjectiveStatus;
  if (value <= target) return "completed" satisfies TeamSeasonObjectiveStatus;
  if (value <= target * 1.15) return "at_risk" satisfies TeamSeasonObjectiveStatus;
  return "failed" satisfies TeamSeasonObjectiveStatus;
}

function getSportTarget(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}) {
  const code = input.team.shortCode;
  const starPriority = input.profile?.bias.starPriority ?? 5;
  const ambition = input.identity?.ambition ?? 5;
  if (code === "M-M") return { rank: 3, label: "Top 3 / Titelkampf erreichen" };
  if (starPriority >= 8 || ambition >= 8) return { rank: 4, label: "Top 4 erreichen" };
  if (code === "A-A") return { rank: 27, label: "Survival: nicht Bottom 5" };
  return { rank: 10, label: "Top 10 angreifen" };
}

function getPreferredAxisObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  row: TeamManagementSnapshotRow;
}): ObjectiveDraft {
  const values = [
    { key: "pow", label: "POW", value: input.row.ppsPow, bias: input.profile?.powBias ?? input.identity?.pow ?? 0 },
    { key: "spe", label: "SPE", value: input.row.ppsSpe, bias: input.profile?.speBias ?? input.identity?.spe ?? 0 },
    { key: "men", label: "MEN", value: input.row.ppsMen, bias: input.profile?.menBias ?? input.identity?.men ?? 0 },
    { key: "soc", label: "SOC", value: input.row.ppsSoc, bias: input.profile?.socBias ?? input.identity?.soc ?? 0 },
  ].sort((left, right) => right.bias - left.bias);
  const top = values[0] ?? { key: "pow", label: "POW", value: input.row.ppsPow, bias: 0 };
  const target = 28;
  return {
    objectiveId: `sport-axis-${top.key}`,
    category: "sport",
    label: `${top.label}-Achse stark abschliessen`,
    targetValue: `>= ${target} PPs`,
    currentValue: roundValue(top.value ?? 0, 1),
    status: statusForMin(top.value ?? null, target),
    rewardCash: 4,
    boardConfidenceDelta: statusForMin(top.value ?? null, target) === "completed" ? 0.4 : -0.3,
    source: "team_profile_axis_bias",
  };
}

function getRosterTarget(row: TeamManagementSnapshotRow) {
  const target = row.playerOpt ?? row.playerMin ?? 10;
  const current = row.rosterCount;
  return {
    objectiveId: "roster-optimum",
    category: "roster" as const,
    label: "Kaderziel erreichen",
    targetValue: target,
    currentValue: current,
    status: current >= (row.playerMin ?? 7) && current <= target ? "completed" as const : current >= (row.playerMin ?? 7) ? "at_risk" as const : "failed" as const,
    boardConfidenceDelta: current >= (row.playerMin ?? 7) ? 0.2 : -0.8,
    source: "team_identity_player_min_opt",
  };
}

function getFacilityObjective(gameState: GameState, team: Team, profile: TeamStrategyProfile | null): ObjectiveDraft {
  const facilities = gameState.seasonState.teamFacilities?.[team.teamId]?.facilities ?? {};
  const wantsRecovery = (profile?.strategySummary ?? "").toLowerCase().includes("risk") || team.shortCode === "C-S";
  const facilityId = wantsRecovery ? "recovery_center" : "training_center";
  const level = facilities[facilityId]?.level ?? 0;
  return {
    objectiveId: `facility-${facilityId}`,
    category: "facility",
    label: wantsRecovery ? "Recovery Center aufbauen" : "Trainingszentrum aufbauen",
    targetValue: "Level >= 1",
    currentValue: level,
    status: level >= 1 ? "completed" : "open",
    rewardCash: 3,
    boardConfidenceDelta: level >= 1 ? 0.3 : 0,
    source: "facility_strategy_profile",
  };
}

function getDevelopmentObjective(gameState: GameState, row: TeamManagementSnapshotRow, team: Team): ObjectiveDraft {
  const xpSpent = (gameState.playerProgressionEvents ?? [])
    .filter((event) => event.teamId === team.teamId && event.seasonId === gameState.season.id)
    .reduce((sum, event) => sum + (event.xpSpent ?? 0), 0);
  const target = Math.max(80, row.rosterCount * 20);
  return {
    objectiveId: "development-xp-spend",
    category: "development",
    label: "XP sinnvoll investieren",
    targetValue: target,
    currentValue: xpSpent,
    status: xpSpent >= target ? "completed" : xpSpent >= target * 0.5 ? "at_risk" : "open",
    rewardCash: 2,
    boardConfidenceDelta: xpSpent >= target ? 0.3 : 0,
    source: "player_progression_events",
  };
}

function getFormColorObjective(gameState: GameState, team: Team): ObjectiveDraft {
  const colors = new Set(
    (gameState.seasonState.formCards ?? [])
      .filter((card) => card.seasonId === gameState.season.id && card.teamId === team.teamId)
      .map((card) => card.cardColor),
  );
  const target = 3;
  return {
    objectiveId: "roster-form-color-cover",
    category: "roster",
    label: "Formfarben abdecken",
    targetValue: `${target}+ Farben`,
    currentValue: colors.size,
    status: colors.size >= target ? "completed" : colors.size >= 2 ? "at_risk" : "open",
    boardConfidenceDelta: colors.size >= target ? 0.2 : 0,
    source: "season_formcards",
  };
}

function getNextMatchdayTop10Objective(gameState: GameState, team: Team): ObjectiveDraft {
  const matchdayId = gameState.matchdayState.matchdayId;
  const result = (gameState.seasonState.matchdayResults ?? []).find(
    (entry) => entry.seasonId === gameState.season.id && entry.matchdayId === matchdayId && entry.status === "preview_applied",
  );
  const resultRanks = result
    ? (gameState.seasonState.disciplineResults ?? [])
        .filter((entry) => entry.matchdayResultId === result.id && entry.teamId === team.teamId)
        .map((entry) => entry.rank)
    : [];
  const bestRank = resultRanks.length ? Math.min(...resultRanks) : null;
  const schedule = (gameState.seasonState.disciplineSchedule ?? []).find((entry) => entry.matchdayId === matchdayId);
  const label =
    schedule?.discipline1?.displayName && schedule?.discipline2?.displayName
      ? `Nächster Spieltag: Top 10 in ${schedule.discipline1.displayName}/${schedule.discipline2.displayName}`
      : "Nächster Spieltag: Top 10 in D1/D2";

  return {
    objectiveId: "sport-next-matchday-top10",
    category: "sport",
    label,
    targetValue: "Top 10",
    currentValue: bestRank == null ? "offen" : bestRank,
    status: bestRank == null ? "open" : bestRank <= 10 ? "completed" : bestRank <= 14 ? "at_risk" : "failed",
    rewardCash: 2,
    boardConfidenceDelta: bestRank != null && bestRank <= 10 ? 0.25 : bestRank != null && bestRank > 14 ? -0.25 : 0,
    source: result ? "discipline_results_current_matchday" : "season_discipline_schedule",
  };
}

function buildTeamObjectives(input: {
  gameState: GameState;
  team: Team;
  row: TeamManagementSnapshotRow;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): TeamSeasonObjectiveRecord[] {
  const { gameState, team, row, identity, profile } = input;
  const sportTarget = getSportTarget({ team, identity, profile });
  const salaryRatio = row.salaryTotal > 0 && row.cash != null ? row.salaryTotal / Math.max(1, row.cash + row.salaryTotal) : null;
  const transferProfitTarget = team.shortCode === "C-C" || (profile?.bias.sellForProfitAggression ?? 0) >= 8 ? 10 : 0;
  const objectiveDrafts: ObjectiveDraft[] = [
    {
      objectiveId: `sport-rank-${sportTarget.rank}`,
      category: "sport",
      label: sportTarget.label,
      targetValue: sportTarget.rank,
      currentValue: row.rank,
      status: statusForRank(row.rank, sportTarget.rank),
      rewardCash: sportTarget.rank <= 4 ? 12 : 6,
      penaltyCash: sportTarget.rank <= 4 ? 4 : 1,
      boardConfidenceDelta: statusForRank(row.rank, sportTarget.rank) === "completed" ? 0.8 : -0.6,
      source: "team_identity_ambition",
    },
    getPreferredAxisObjective({ team, identity, profile, row }),
    {
      objectiveId: "finance-cash-positive",
      category: "finance",
      label: "Cash positiv halten",
      targetValue: "> 0",
      currentValue: row.cash,
      status: (row.cash ?? 0) >= 0 ? "completed" : "failed",
      penaltyCash: (row.cash ?? 0) < 0 ? 3 : undefined,
      boardConfidenceDelta: (row.cash ?? 0) >= 0 ? 0.4 : -1,
      source: "active_local_team_cash",
    },
    {
      objectiveId: "finance-salary-ratio",
      category: "finance",
      label: "Gehaltsdruck kontrollieren",
      targetValue: "<= 45%",
      currentValue: salaryRatio == null ? null : `${roundValue(salaryRatio * 100, 1)}%`,
      status: statusForMax(salaryRatio, 0.45),
      penaltyCash: salaryRatio != null && salaryRatio > 0.55 ? 4 : undefined,
      boardConfidenceDelta: salaryRatio != null && salaryRatio <= 0.45 ? 0.3 : -0.4,
      source: "roster_salary_active_cash",
    },
    {
      objectiveId: "transfer-profit",
      category: "transfer",
      label: transferProfitTarget > 0 ? "Transfergewinn erzielen" : "Transferbilanz stabil halten",
      targetValue: transferProfitTarget,
      currentValue: row.transferNet,
      status: statusForMin(row.transferNet, transferProfitTarget),
      rewardCash: transferProfitTarget > 0 ? 5 : undefined,
      boardConfidenceDelta: (row.transferNet ?? 0) >= transferProfitTarget ? 0.25 : -0.25,
      source: "local_transfer_history",
    },
    getRosterTarget(row),
    getFormColorObjective(gameState, team),
    getNextMatchdayTop10Objective(gameState, team),
    getFacilityObjective(gameState, team, profile),
    getDevelopmentObjective(gameState, row, team),
  ];

  return objectiveDrafts.map((objective) => ({
    seasonId: gameState.season.id,
    teamId: team.teamId,
    source: objective.source ?? "board_objective_generator_v1",
    ...objective,
  }));
}

function mergeStoredTeamObjectives(input: {
  gameState: GameState;
  teamId: string;
  generated: TeamSeasonObjectiveRecord[];
}) {
  const stored = (input.gameState.seasonState.teamSeasonObjectives ?? []).filter(
    (objective) => objective.seasonId === input.gameState.season.id && objective.teamId === input.teamId,
  );
  if (stored.length === 0) {
    return input.generated;
  }

  const generatedById = new Map(input.generated.map((objective) => [objective.objectiveId, objective] as const));
  const merged = stored.map((storedObjective) => {
    const generatedObjective = generatedById.get(storedObjective.objectiveId);
    if (!generatedObjective) {
      return storedObjective;
    }

    return {
      ...storedObjective,
      currentValue: generatedObjective.currentValue,
      status: generatedObjective.status,
      boardConfidenceDelta: generatedObjective.boardConfidenceDelta,
      source: `${storedObjective.source}+status_refresh`,
    } satisfies TeamSeasonObjectiveRecord;
  });
  const storedIds = new Set(stored.map((objective) => objective.objectiveId));
  return [...merged, ...input.generated.filter((objective) => !storedIds.has(objective.objectiveId))];
}

function calculateBoardConfidence(input: {
  teamId: string;
  identity: TeamIdentity | null;
  objectives: TeamSeasonObjectiveRecord[];
  storedBoard?: TeamBoardConfidenceRecord | null;
}): TeamBoardConfidenceRecord {
  const base = normalizeBoardConfidence(input.storedBoard?.value ?? input.identity?.boardConfidence ?? null);
  const delta = input.objectives.reduce((sum, objective) => sum + (objective.boardConfidenceDelta ?? 0), 0);
  const failed = input.objectives.filter((objective) => objective.status === "failed").length;
  const atRisk = input.objectives.filter((objective) => objective.status === "at_risk").length;
  const value = roundValue(clamp(base + delta, 1, 10), 1);
  const pressure = roundValue(clamp(11 - value + failed * 0.8 + atRisk * 0.35, 1, 10), 1);
  const warnings = [
    input.storedBoard ? "board_confidence_source_saved_state" : null,
    failed > 0 ? "board_objectives_failed" : null,
    atRisk > 0 ? "board_objectives_at_risk" : null,
    pressure >= 8 ? "high_board_pressure" : null,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    teamId: input.teamId,
    value,
    pressure,
    warnings,
  };
}

function buildAiBias(input: {
  teamId: string;
  objectives: TeamSeasonObjectiveRecord[];
  board: TeamBoardConfidenceRecord;
}): TeamObjectiveAiBias {
  const hasFinanceRisk = input.objectives.some((objective) => objective.category === "finance" && objective.status !== "completed");
  const hasRosterRisk = input.objectives.some((objective) => objective.category === "roster" && objective.status !== "completed");
  const hasFacilityOpen = input.objectives.some((objective) => objective.category === "facility" && objective.status === "open");
  const hasDevelopmentOpen = input.objectives.some((objective) => objective.category === "development" && objective.status !== "completed");
  const pressureFactor = input.board.pressure / 10;
  const budgetConservatism = clamp((hasFinanceRisk ? 0.65 : 0.35) + pressureFactor * 0.15, 0, 1);
  const sellAggression = clamp((hasFinanceRisk ? 0.7 : 0.35) + pressureFactor * 0.25, 0, 1);
  const buyAggression = clamp((hasRosterRisk ? 0.72 : 0.42) + pressureFactor * 0.12 - (hasFinanceRisk ? 0.18 : 0), 0, 1);

  return {
    teamId: input.teamId,
    pressure: input.board.pressure,
    transferAggression: roundValue((sellAggression + buyAggression) / 2, 2),
    buyAggression: roundValue(buyAggression, 2),
    sellAggression: roundValue(sellAggression, 2),
    budgetConservatism: roundValue(budgetConservatism, 2),
    facilityPriority: hasFacilityOpen ? 0.75 : 0.25,
    developmentPriority: hasDevelopmentOpen ? 0.7 : 0.3,
    rosterUrgency: hasRosterRisk ? 0.8 : 0.25,
    warnings: [
      hasFinanceRisk ? "objective_bias_finance_caution" : null,
      hasRosterRisk ? "objective_bias_roster_topup" : null,
      input.board.pressure >= 8 ? "objective_bias_high_pressure_aggression" : null,
    ].filter((warning): warning is string => Boolean(warning)),
  };
}

export function buildTeamObjectiveOverview(gameState: GameState): TeamObjectiveOverview {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const rowsByTeamId = new Map(rows.map((row) => [row.teamId, row] as const));
  const objectives: TeamSeasonObjectiveRecord[] = [];
  const boardConfidence: Record<string, TeamBoardConfidenceRecord> = {};
  const aiBiasByTeamId: Record<string, TeamObjectiveAiBias> = {};
  const warnings = ["sponsor_objective_source_missing"];

  for (const team of gameState.teams) {
    const row = rowsByTeamId.get(team.teamId);
    if (!row) {
      warnings.push(`${team.teamId}:objective_row_missing`);
      continue;
    }

    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const profile = getTeamStrategyProfile(gameState, team.teamId);
    const generatedObjectives = buildTeamObjectives({ gameState, team, row, identity, profile });
    const teamObjectives = mergeStoredTeamObjectives({ gameState, teamId: team.teamId, generated: generatedObjectives });
    objectives.push(...teamObjectives);
    const storedBoard = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
    const board = calculateBoardConfidence({ teamId: team.teamId, identity, objectives: teamObjectives, storedBoard });
    boardConfidence[team.teamId] = board;
    aiBiasByTeamId[team.teamId] = buildAiBias({ teamId: team.teamId, objectives: teamObjectives, board });
  }

  return {
    seasonId: gameState.season.id,
    objectives,
    boardConfidence,
    aiBiasByTeamId,
    warnings: Array.from(new Set(warnings)),
  };
}

export function getTeamObjectives(gameState: GameState, teamId: string) {
  return buildTeamObjectiveOverview(gameState).objectives.filter((objective) => objective.teamId === teamId);
}

export function getTeamObjectiveAiBias(gameState: GameState, teamId: string) {
  return buildTeamObjectiveOverview(gameState).aiBiasByTeamId[teamId] ?? null;
}
