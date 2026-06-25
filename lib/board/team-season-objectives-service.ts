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
import { getPrimaryTeamRivalry } from "@/lib/rivalries/team-rivalries";

export type TeamObjectiveAiBias = {
  teamId: string;
  pressure: number;
  transferAggression: number;
  buyAggression: number;
  sellAggression: number;
  budgetConservatism: number;
  facilityPriority: number;
  developmentPriority: number;
  moralePriority: number;
  rosterUrgency: number;
  axisPriorities: Partial<Record<AxisKey, number>>;
  warnings: string[];
};

export type TeamObjectiveOverview = {
  seasonId: string;
  objectives: TeamSeasonObjectiveRecord[];
  boardConfidence: Record<string, TeamBoardConfidenceRecord>;
  aiBiasByTeamId: Record<string, TeamObjectiveAiBias>;
  warnings: string[];
};

export type TeamSeasonObjectiveSettlementRow = {
  teamId: string;
  teamName: string;
  objectiveId: string;
  label: string;
  category: TeamSeasonObjectiveCategory;
  status: TeamSeasonObjectiveStatus;
  cashDelta: number;
  boardConfidenceDelta: number;
  visibleResult: "plus" | "minus" | "neutral";
  reason: string;
};

export type TeamSeasonObjectiveSettlement = {
  seasonId: string;
  rows: TeamSeasonObjectiveSettlementRow[];
  byTeamId: Record<
    string,
    {
      teamId: string;
      teamName: string;
      completed: number;
      failed: number;
      atRisk: number;
      open: number;
      cashDelta: number;
      boardConfidenceDelta: number;
      resultLabel: string;
    }
  >;
  totals: {
    cashDelta: number;
    boardConfidenceDelta: number;
    completed: number;
    failed: number;
  };
};

type ObjectiveDraft = {
  objectiveId: string;
  category: TeamSeasonObjectiveCategory;
  label: string;
  detail?: string | null;
  actionHint?: string | null;
  targetValue: number | string | boolean | null;
  currentValue: number | string | boolean | null;
  status: TeamSeasonObjectiveStatus;
  rewardCash?: number;
  penaltyCash?: number;
  boardConfidenceDelta?: number;
  source?: string;
};

type AxisKey = "pow" | "spe" | "men" | "soc";

const DEFAULT_BOARD_RATING = 5;
const TEAM_OBJECTIVE_OVERVIEW_CACHE = new WeakMap<GameState, TeamObjectiveOverview>();
const TEAM_OBJECTIVE_AI_BIAS_CACHE = new WeakMap<GameState, Record<string, TeamObjectiveAiBias>>();

const AXIS_OBJECTIVE_META: Record<
  AxisKey,
  {
    label: string;
    fullLabel: string;
    rowKey: keyof Pick<TeamManagementSnapshotRow, "ppsPow" | "ppsSpe" | "ppsMen" | "ppsSoc">;
    identityKey: keyof Pick<TeamIdentity, "pow" | "spe" | "men" | "soc">;
    profileKey: keyof Pick<TeamStrategyProfile, "powBias" | "speBias" | "menBias" | "socBias">;
  }
> = {
  pow: { label: "POW", fullLabel: "Power", rowKey: "ppsPow", identityKey: "pow", profileKey: "powBias" },
  spe: { label: "SPE", fullLabel: "Speed", rowKey: "ppsSpe", identityKey: "spe", profileKey: "speBias" },
  men: { label: "MEN", fullLabel: "Mental", rowKey: "ppsMen", identityKey: "men", profileKey: "menBias" },
  soc: { label: "SOC", fullLabel: "Social", rowKey: "ppsSoc", identityKey: "soc", profileKey: "socBias" },
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBoardConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return DEFAULT_BOARD_RATING;
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

function getTeamObjectiveToken(team: Team) {
  return `${team.teamId} ${team.shortCode ?? ""} ${team.name}`.toLowerCase();
}

function getAxisRows(rowsByTeamId: Map<string, TeamManagementSnapshotRow>, axis: AxisKey) {
  const rowKey = AXIS_OBJECTIVE_META[axis].rowKey;
  return [...rowsByTeamId.values()]
    .map((row) => ({ teamId: row.teamId, value: Number(row[rowKey] ?? 0) }))
    .sort((left, right) => right.value - left.value);
}

function getAxisRank(input: {
  teamId: string;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  axis: AxisKey;
}) {
  const rows = getAxisRows(input.rowsByTeamId, input.axis);
  if (!rows.some((row) => row.value > 0)) {
    return { rank: null as number | null, teamCount: rows.length, value: null as number | null };
  }
  const index = rows.findIndex((row) => row.teamId === input.teamId);
  if (index < 0) return { rank: null as number | null, teamCount: rows.length, value: null as number | null };
  return { rank: index + 1, teamCount: rows.length, value: rows[index]?.value ?? null };
}

function getAxisBias(input: {
  axis: AxisKey;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}) {
  const meta = AXIS_OBJECTIVE_META[input.axis];
  return Number(input.profile?.[meta.profileKey] ?? input.identity?.[meta.identityKey] ?? 0);
}

function getPrimaryAxis(input: { team: Team; identity: TeamIdentity | null; profile: TeamStrategyProfile | null }) {
  const teamToken = getTeamObjectiveToken(input.team);
  if (teamToken.includes("giants") || teamToken.includes("t-g")) return "pow" satisfies AxisKey;
  if (teamToken.includes("wizards") || teamToken.includes("w-w")) return "men" satisfies AxisKey;

  return (Object.keys(AXIS_OBJECTIVE_META) as AxisKey[])
    .map((axis) => ({ axis, bias: getAxisBias({ axis, identity: input.identity, profile: input.profile }) }))
    .sort((left, right) => right.bias - left.bias)[0]?.axis ?? "pow";
}

function statusForMax(value: number | null, target: number) {
  if (value == null) return "open" satisfies TeamSeasonObjectiveStatus;
  if (value <= target) return "completed" satisfies TeamSeasonObjectiveStatus;
  if (value <= target * 1.15) return "at_risk" satisfies TeamSeasonObjectiveStatus;
  return "failed" satisfies TeamSeasonObjectiveStatus;
}

function formatObjectiveMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

function getRelativeMetricRank(input: {
  teamId: string;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  metric: keyof Pick<TeamManagementSnapshotRow, "ppsTotal" | "marketValueTotal" | "salaryTotal" | "cash">;
}) {
  const ranked = [...input.rowsByTeamId.values()]
    .map((row) => ({
      teamId: row.teamId,
      value: Number(row[input.metric] ?? Number.NEGATIVE_INFINITY),
    }))
    .sort((left, right) => right.value - left.value);
  const index = ranked.findIndex((entry) => entry.teamId === input.teamId);
  return {
    rank: index >= 0 ? index + 1 : ranked.length,
    teamCount: ranked.length,
  };
}

function buildSalaryPressureObjective(input: {
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}): ObjectiveDraft {
  const targetRatio = 0.45;
  const salaryTotal = input.row.salaryTotal ?? 0;
  const cash = input.row.cash ?? null;
  const salaryRatio = salaryTotal > 0 && cash != null ? salaryTotal / Math.max(1, cash + salaryTotal) : null;
  const targetSalaryAtCurrentCash = cash != null && cash > 0 ? roundValue((targetRatio / (1 - targetRatio)) * cash, 1) : 0;
  const reductionNeeded = salaryRatio != null ? roundValue(Math.max(0, salaryTotal - targetSalaryAtCurrentCash), 1) : null;
  const salaryRankCheap = [...input.rowsByTeamId.values()]
    .sort((left, right) => (left.salaryTotal ?? Number.POSITIVE_INFINITY) - (right.salaryTotal ?? Number.POSITIVE_INFINITY))
    .findIndex((row) => row.teamId === input.row.teamId) + 1;
  const teamCount = input.rowsByTeamId.size;
  const currentPercent = salaryRatio == null ? null : roundValue(salaryRatio * 100, 1);
  const targetPercent = roundValue(targetRatio * 100, 0);
  const detail =
    salaryRatio == null
      ? "Formel: Gehalt / (Cash + Gehalt). Es fehlen Cash- oder Gehaltsdaten."
      : `Formel: Gehalt / (Cash + Gehalt). Aktuell ${currentPercent}% bei ${formatObjectiveMoney(salaryTotal)} Gehalt und ${formatObjectiveMoney(cash)} Cash. Ziel ${targetPercent}% bedeutet bei aktuellem Cash max. ${formatObjectiveMoney(targetSalaryAtCurrentCash)} Gehalt.`;
  const actionHint =
    reductionNeeded != null && reductionNeeded > 0
      ? `Du musst ca. ${formatObjectiveMoney(reductionNeeded)} Gehalt freimachen: teure Spieler verkaufen, auslaufende Verträge günstiger verlängern oder nur Spieler mit starkem MW/Gehalt-Ratio kaufen. Gehaltsrang: #${salaryRankCheap}/${teamCount} von billig nach teuer.`
      : `Erfüllt. Weiter auf günstige Verlängerungen und gute MW/Gehalt-Ratios achten. Gehaltsrang: #${salaryRankCheap}/${teamCount} von billig nach teuer.`;

  return {
    objectiveId: "finance-salary-ratio",
    category: "finance",
    label: "Gehaltsdruck auf 45% senken",
    detail,
    actionHint,
    targetValue: `<= ${targetPercent}%`,
    currentValue: salaryRatio == null ? null : `${currentPercent}%`,
    status: statusForMax(salaryRatio, targetRatio),
    penaltyCash: salaryRatio != null && salaryRatio > 0.55 ? 4 : undefined,
    boardConfidenceDelta: salaryRatio != null && salaryRatio <= targetRatio ? 0.3 : -0.4,
    source: "roster_salary_active_cash",
  };
}

function getCurrentSeasonMatchdayResults(gameState: GameState) {
  return (gameState.seasonState.matchdayResults ?? []).filter((entry) => entry.seasonId === gameState.season.id);
}

function getCurrentSeasonMatchdayResultIds(gameState: GameState) {
  return new Set(getCurrentSeasonMatchdayResults(gameState).map((entry) => entry.id));
}

function getRemainingMatchdays(gameState: GameState) {
  const playedMatchdayIds = new Set(getCurrentSeasonMatchdayResults(gameState).map((entry) => entry.matchdayId).filter(Boolean));
  const scheduledMatchdays = gameState.season.matchdayIds?.length ?? 0;
  return Math.max(0, scheduledMatchdays - playedMatchdayIds.size);
}

function statusForSeasonCount(input: { current: number; target: number; remaining: number; played: number; total: number }) {
  if (input.current >= input.target) return "completed" satisfies TeamSeasonObjectiveStatus;
  if (input.remaining === 0 || input.current + input.remaining < input.target) return "failed" satisfies TeamSeasonObjectiveStatus;
  if (input.current + input.remaining === input.target) return "at_risk" satisfies TeamSeasonObjectiveStatus;
  if (input.total > 0 && input.played >= Math.ceil(input.total * 0.6) && input.current < input.target) {
    return "at_risk" satisfies TeamSeasonObjectiveStatus;
  }
  return "open" satisfies TeamSeasonObjectiveStatus;
}

function getTeamMatchdayMedalSummary(gameState: GameState, teamId: string) {
  const resultIds = getCurrentSeasonMatchdayResultIds(gameState);
  const scoresByResultId = new Map<string, Map<string, number>>();
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    if (!resultIds.has(result.matchdayResultId)) continue;
    const teamScores = scoresByResultId.get(result.matchdayResultId) ?? new Map<string, number>();
    teamScores.set(result.teamId, (teamScores.get(result.teamId) ?? 0) + (result.totalScore ?? 0));
    scoresByResultId.set(result.matchdayResultId, teamScores);
  }

  let medals = 0;
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let bestRank: number | null = null;
  for (const teamScores of scoresByResultId.values()) {
    const ranked = [...teamScores.entries()].sort((left, right) => right[1] - left[1]);
    let previousScore: number | null = null;
    let currentRank = 0;
    ranked.forEach(([rankedTeamId, score], index) => {
      if (previousScore == null || score < previousScore) {
        currentRank = index + 1;
        previousScore = score;
      }
      if (rankedTeamId !== teamId) return;
      bestRank = bestRank == null ? currentRank : Math.min(bestRank, currentRank);
      if (currentRank <= 3) medals += 1;
      if (currentRank === 1) gold += 1;
      if (currentRank === 2) silver += 1;
      if (currentRank === 3) bronze += 1;
    });
  }

  return {
    medals,
    gold,
    silver,
    bronze,
    bestRank,
    matchdaysWithScores: scoresByResultId.size,
  };
}

function getPlayerPeakSummary(gameState: GameState, teamId: string) {
  const rosterIds = new Set(getRosterPlayerIds(gameState, teamId));
  const resultIds = getCurrentSeasonMatchdayResultIds(gameState);
  const top20ByPlayer = new Map<string, number>();
  const top50ByPlayer = new Map<string, number>();
  let top20Count = 0;
  let top50Count = 0;
  let bestRank: number | null = null;

  for (const entry of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (entry.teamId !== teamId) continue;
    if (!rosterIds.has(entry.playerId)) continue;
    if (resultIds.size > 0 && !resultIds.has(entry.matchdayResultId)) continue;
    if (!Number.isFinite(entry.rankInDiscipline)) continue;

    bestRank = bestRank == null ? entry.rankInDiscipline : Math.min(bestRank, entry.rankInDiscipline);
    if (entry.rankInDiscipline <= 20) {
      top20Count += 1;
      top20ByPlayer.set(entry.playerId, (top20ByPlayer.get(entry.playerId) ?? 0) + 1);
    }
    if (entry.rankInDiscipline <= 50) {
      top50Count += 1;
      top50ByPlayer.set(entry.playerId, (top50ByPlayer.get(entry.playerId) ?? 0) + 1);
    }
  }

  return {
    bestRank,
    top20Count,
    top50Count,
    uniqueTop20Players: top20ByPlayer.size,
    uniqueTop50Players: top50ByPlayer.size,
    maxTop20ByPlayer: Math.max(0, ...top20ByPlayer.values()),
    maxTop50ByPlayer: Math.max(0, ...top50ByPlayer.values()),
  };
}

function getSportTarget(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}) {
  const code = input.team.shortCode;
  const starPriority = input.profile?.bias.starPriority ?? 5;
  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const sellPriority = input.profile?.bias.sellForProfitAggression ?? 5;
  const depthPriority = input.profile?.bias.rosterDepthPreference ?? 5;
  const ambition = input.identity?.ambition ?? 5;
  const currentRank = input.row.rank ?? null;
  const rosterCount = input.row.rosterCount ?? 0;
  const playerMin = input.row.playerMin ?? input.identity?.playerMin ?? 7;
  const playerOpt = input.row.playerOpt ?? input.identity?.playerOpt ?? Math.max(playerMin, 10);
  const rosterReady = rosterCount >= Math.max(playerMin, Math.floor(playerOpt * 0.9));
  const ppsTotal = input.row.ppsTotal ?? 0;
  const marketValueTotal = input.row.marketValueTotal ?? 0;
  const strengthReady = ppsTotal >= 95 || marketValueTotal >= Math.max(170, playerOpt * 18);
  const ppsRank = getRelativeMetricRank({
    teamId: input.team.teamId,
    rowsByTeamId: input.rowsByTeamId,
    metric: "ppsTotal",
  }).rank;
  const marketValueRank = getRelativeMetricRank({
    teamId: input.team.teamId,
    rowsByTeamId: input.rowsByTeamId,
    metric: "marketValueTotal",
  }).rank;
  const compositeStrengthRank = Math.round((ppsRank * 2 + marketValueRank) / 3);
  const bottomThird = compositeStrengthRank >= 22;
  const weakMiddle = compositeStrengthRank >= 16;
  const topThird = compositeStrengthRank <= 10;
  const titleTier = compositeStrengthRank <= 6;

  if (currentRank != null) {
    if (currentRank >= 29) return { rank: 27, label: "Survival: nicht Bottom 5" };
    if (currentRank >= 25) {
      return weakMiddle || !strengthReady
        ? { rank: 24, label: "Bottom 8 vermeiden" }
        : { rank: 20, label: "Top-20-Anschluss finden" };
    }
    if (currentRank >= 21) {
      return weakMiddle || !strengthReady
        ? { rank: 24, label: "Rebuild ohne Absturz" }
        : { rank: 20, label: "Top-20-Anschluss finden" };
    }
    if (currentRank >= 17) {
      return weakMiddle && !strengthReady
        ? { rank: 18, label: "Mittelfeldkontakt herstellen" }
        : { rank: 16, label: "Mittelfeld erreichen" };
    }
    if (currentRank >= 13) {
      return topThird && strengthReady
        ? { rank: 12, label: "Breite Playoff-Zone erreichen" }
        : { rank: 16, label: "Mittelfeld erreichen" };
    }
  }

  if (code === "M-M") {
    return currentRank != null && currentRank > 6
      ? { rank: 6, label: "Top 6 erreichen" }
      : { rank: 3, label: "Top 3 / Titelkampf erreichen" };
  }
  if (!rosterReady) {
    return rosterCount < playerMin
      ? { rank: 24, label: "Kader stabilisieren" }
      : { rank: 20, label: "Kaderbreite in Punkte verwandeln" };
  }
  if (bottomThird) {
    return ambition >= 8 && !strengthReady
      ? { rank: 20, label: "Top-20-Anschluss finden" }
      : { rank: 24, label: "Rebuild ohne Absturz" };
  }
  if (!strengthReady && ambition < 9) {
    return ambition <= 4
      ? { rank: 24, label: "Rebuild ohne Absturz" }
      : { rank: 18, label: "Mittelfeldkontakt herstellen" };
  }
  if (starPriority >= 8 || ambition >= 8) {
    if (titleTier && strengthReady) return { rank: 6, label: "Top 6 erreichen" };
    if (topThird && strengthReady) return { rank: 10, label: "Top 10 angreifen" };
    if (weakMiddle) return { rank: 16, label: "Mittelfeld erreichen" };
    return strengthReady ? { rank: 12, label: "Top-12 Anschluss suchen" } : { rank: 16, label: "Mittelfeldkontakt herstellen" };
  }
  if (code === "A-A") return { rank: 27, label: "Survival: nicht Bottom 5" };
  if (cashPriority >= 9 && ambition <= 6) return { rank: 16, label: "Value-Saison ohne Cash-Risiko" };
  if (sellPriority >= 8 && starPriority <= 6) return { rank: 18, label: "Positive Bilanz ohne Absturz" };
  if (ambition <= 4) return { rank: 20, label: "Rebuild: konkurrenzfaehig bleiben" };
  if (depthPriority >= 8) return { rank: 12, label: "Breite Playoff-Zone erreichen" };
  return strengthReady ? { rank: 12, label: "Breite Playoff-Zone erreichen" } : { rank: 16, label: "Mittelfeld erreichen" };
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

function getAxisRankObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}): ObjectiveDraft | null {
  const axis = getPrimaryAxis(input);
  const teamToken = getTeamObjectiveToken(input.team);
  const bias = getAxisBias({ axis, identity: input.identity, profile: input.profile });
  const ambition = input.profile?.bias.starPriority ?? input.identity?.ambition ?? 5;
  const explicitPowerChase = teamToken.includes("giants") || teamToken.includes("t-g");
  const explicitMentalChase = teamToken.includes("wizards") || teamToken.includes("w-w");
  const shouldCreate = explicitPowerChase || explicitMentalChase || bias >= 8 || ambition >= 8;
  if (!shouldCreate) return null;

  const targetRank = explicitPowerChase || explicitMentalChase || bias >= 9 || ambition >= 8 ? 5 : 8;
  const meta = AXIS_OBJECTIVE_META[axis];
  const rank = getAxisRank({ teamId: input.team.teamId, rowsByTeamId: input.rowsByTeamId, axis });
  const status = statusForRank(rank.rank, targetRank);

  return {
    objectiveId: `sport-axis-rank-${axis}-top-${targetRank}`,
    category: "sport",
    label: `${meta.fullLabel} Top ${targetRank}`,
    detail:
      rank.rank == null
        ? `${meta.label}-Ligarang noch offen.`
        : `${meta.label}-Rang #${rank.rank}/${rank.teamCount} mit ${roundValue(rank.value ?? 0, 1)} PPs.`,
    actionHint: `${meta.label}-Spezialisten, passende Klassen/Farben und Training fuer diese Achse priorisieren.`,
    targetValue: `Top ${targetRank}`,
    currentValue: rank.rank == null ? "offen" : `#${rank.rank}`,
    status,
    rewardCash: targetRank <= 5 ? 6 : 4,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.55 : status === "at_risk" ? -0.15 : -0.45,
    source: explicitPowerChase || explicitMentalChase ? "team_signature_axis_rank_goal" : "team_profile_axis_rank_goal",
  };
}

function getAllRoundAxisObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}): ObjectiveDraft | null {
  const teamToken = getTeamObjectiveToken(input.team);
  const biases = (Object.keys(AXIS_OBJECTIVE_META) as AxisKey[]).map((axis) =>
    getAxisBias({ axis, identity: input.identity, profile: input.profile }),
  );
  const maxBias = Math.max(...biases);
  const minBias = Math.min(...biases);
  const isAllRounder = teamToken.includes("teachers") || teamToken.includes("t-t") || maxBias - minBias <= 3;
  if (!isAllRounder) return null;

  const ranks = (Object.keys(AXIS_OBJECTIVE_META) as AxisKey[]).map((axis) => ({
    axis,
    ...getAxisRank({ teamId: input.team.teamId, rowsByTeamId: input.rowsByTeamId, axis }),
  }));
  const teamCount = ranks[0]?.teamCount ?? input.rowsByTeamId.size;
  const targetRank = Math.ceil(Math.max(teamCount, 1) / 2);
  const inTopHalf = ranks.filter((rank) => rank.rank != null && rank.rank <= targetRank).length;
  const worstRank = Math.max(...ranks.map((rank) => rank.rank ?? teamCount));
  const status: TeamSeasonObjectiveStatus =
    inTopHalf >= 4 ? "completed" : inTopHalf >= 3 || worstRank <= targetRank + 2 ? "at_risk" : "failed";
  const current = ranks
    .map((rank) => `${AXIS_OBJECTIVE_META[rank.axis].label} #${rank.rank ?? "-"}`)
    .join(" / ");

  return {
    objectiveId: "sport-axis-allround-tophalf",
    category: "sport",
    label: "Alle Achsen obere Haelfte",
    detail: `Ziel: POW/SPE/MEN/SOC jeweils Top ${targetRank}. Aktuell ${current}.`,
    actionHint: "Keine Achse komplett fallen lassen: Kader, Training und Powers breit absichern.",
    targetValue: `4/4 Achsen Top ${targetRank}`,
    currentValue: `${inTopHalf}/4`,
    status,
    rewardCash: 5,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.5 : status === "at_risk" ? -0.1 : -0.45,
    source: "team_profile_allround_axis_goal",
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

function getRosterPlayerIds(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
}

function getTeamMoraleObjective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): ObjectiveDraft {
  const playerIds = getRosterPlayerIds(input.gameState, input.team.teamId);
  const storedMoraleByPlayerId = new Map(
    (input.gameState.playerMoraleState ?? [])
      .filter((entry) => entry.teamId === input.team.teamId)
      .map((entry) => [entry.playerId, entry.morale] as const),
  );
  const moraleValues = playerIds.map((playerId) => storedMoraleByPlayerId.get(playerId) ?? 60);
  const target = (input.profile?.bias.harmonyStrictness ?? input.identity?.harmony ?? 5) >= 8 ? 68 : 60;
  const averageMorale = moraleValues.length
    ? roundValue(moraleValues.reduce((sum, morale) => sum + morale, 0) / moraleValues.length, 1)
    : null;
  const status = statusForMin(averageMorale, target);

  return {
    objectiveId: "morale-team-average",
    category: "morale",
    label: target >= 68 ? "Team-Moral hoch halten" : "Kabine stabil halten",
    targetValue: `>= ${target}`,
    currentValue: averageMorale == null ? "offen" : averageMorale,
    status,
    rewardCash: status === "completed" ? 2 : undefined,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.45 : status === "failed" ? -0.7 : status === "at_risk" ? -0.15 : 0,
    source: moraleValues.length ? "stored_player_morale_average" : "player_morale_pending",
  };
}

function getTopPlayerObjective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): ObjectiveDraft | null {
  const starPriority = input.profile?.bias.starPriority ?? input.identity?.ambition ?? 5;
  const elitePriority = input.profile?.bias.eliteSmallRosterPreference ?? 5;
  if (starPriority < 7 && elitePriority < 7) return null;

  const rosterIds = new Set(getRosterPlayerIds(input.gameState, input.team.teamId));
  const currentSeasonResultIds = new Set(
    (input.gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === input.gameState.season.id)
      .map((entry) => entry.id),
  );
  const ranks = (input.gameState.seasonState.playerDisciplinePerformances ?? [])
    .filter((entry) => entry.teamId === input.team.teamId)
    .filter((entry) => rosterIds.has(entry.playerId))
    .filter((entry) => currentSeasonResultIds.size === 0 || currentSeasonResultIds.has(entry.matchdayResultId))
    .map((entry) => entry.rankInDiscipline)
    .filter((rank) => Number.isFinite(rank));
  const bestRank = ranks.length ? Math.min(...ranks) : null;
  const status = bestRank == null ? "open" : bestRank <= 5 ? "completed" : bestRank <= 10 ? "at_risk" : "failed";

  return {
    objectiveId: "player-top5-discipline-star",
    category: "player",
    label: "Top-5 Diszi-Spieler stellen",
    targetValue: "Top 5",
    currentValue: bestRank == null ? "offen" : bestRank,
    status,
    rewardCash: status === "completed" ? 4 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.55 : status === "failed" ? -0.35 : status === "at_risk" ? 0.1 : 0,
    source: ranks.length ? "player_discipline_performance_rank" : "player_performance_pending",
  };
}

function getMatchdayMedalObjective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): ObjectiveDraft | null {
  const ambition = input.identity?.ambition ?? 5;
  const starPriority = input.profile?.bias.starPriority ?? ambition;
  const scheduled = input.gameState.season.matchdayIds?.length ?? 0;
  if (scheduled < 1 || (ambition < 6 && starPriority < 7)) return null;
  const target = input.team.shortCode === "M-M" || input.team.shortCode === "Z-H" || ambition >= 9 || starPriority >= 9 ? 2 : 1;
  const summary = getTeamMatchdayMedalSummary(input.gameState, input.team.teamId);
  const remaining = getRemainingMatchdays(input.gameState);
  const status = statusForSeasonCount({
    current: summary.medals,
    target,
    remaining,
    played: summary.matchdaysWithScores,
    total: scheduled,
  });

  return {
    objectiveId: "sport-matchday-medals",
    category: "sport",
    label: target >= 2 ? `${target} Spieltagsmedaillen holen` : "Spieltagsmedaille holen",
    targetValue: target,
    currentValue:
      summary.medals > 0
        ? `${summary.medals} (${summary.gold}/${summary.silver}/${summary.bronze})`
        : summary.matchdaysWithScores > 0
          ? `0, bestes Team-Rank #${summary.bestRank ?? "-"}`
          : "offen",
    status,
    rewardCash: status === "completed" ? (target >= 2 ? 7 : 4) : undefined,
    penaltyCash: status === "failed" ? (target >= 2 ? 3 : 1) : undefined,
    boardConfidenceDelta: status === "completed" ? 0.65 : status === "failed" ? -0.65 : status === "at_risk" ? -0.2 : 0,
    source: "matchday_team_score_rank",
  };
}

function getPlayerTop50Objective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): ObjectiveDraft | null {
  const ambition = input.identity?.ambition ?? 5;
  const starPriority = input.profile?.bias.starPriority ?? ambition;
  if (ambition < 5 && starPriority < 5) return null;

  const summary = getPlayerPeakSummary(input.gameState, input.team.teamId);
  const remaining = getRemainingMatchdays(input.gameState);
  const played = getCurrentSeasonMatchdayResults(input.gameState).length;
  const status = statusForSeasonCount({
    current: summary.top50Count > 0 ? 1 : 0,
    target: 1,
    remaining,
    played,
    total: input.gameState.season.matchdayIds?.length ?? 0,
  });

  return {
    objectiveId: "player-top50-season",
    category: "player",
    label: "Top-50-Spieler stellen",
    targetValue: "Top 50",
    currentValue: summary.bestRank == null ? "offen" : `#${summary.bestRank}`,
    status,
    rewardCash: status === "completed" ? 2 : undefined,
    penaltyCash: status === "failed" ? 1 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.35 : status === "failed" ? -0.3 : status === "at_risk" ? -0.1 : 0,
    source: summary.bestRank == null ? "player_performance_pending" : "player_discipline_performance_rank",
  };
}

function getPlayerTop20Objective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): ObjectiveDraft {
  const ambition = input.identity?.ambition ?? 5;
  const starPriority = input.profile?.bias.starPriority ?? ambition;
  const wantsRepeatPeak = ambition >= 7 || starPriority >= 7;
  const target = wantsRepeatPeak ? 3 : 1;
  const summary = getPlayerPeakSummary(input.gameState, input.team.teamId);
  const current = wantsRepeatPeak ? summary.maxTop20ByPlayer : summary.top20Count > 0 ? 1 : 0;
  const remaining = getRemainingMatchdays(input.gameState);
  const played = getCurrentSeasonMatchdayResults(input.gameState).length;
  const status = statusForSeasonCount({
    current,
    target,
    remaining,
    played,
    total: input.gameState.season.matchdayIds?.length ?? 0,
  });

  return {
    objectiveId: wantsRepeatPeak ? "player-top20-repeat" : "player-top20-breakthrough",
    category: "player",
    label: wantsRepeatPeak ? "Ein Spieler 3x Top 20" : "Top-20-Durchbruch schaffen",
    targetValue: wantsRepeatPeak ? "3x Top 20 mit einem Spieler" : "1x Top 20",
    currentValue:
      summary.bestRank == null
        ? "offen"
        : wantsRepeatPeak
          ? `${summary.maxTop20ByPlayer}/${target}, bestes Rank #${summary.bestRank}`
          : summary.top20Count > 0
            ? `erfuellt, bestes Rank #${summary.bestRank}`
            : `bestes Rank #${summary.bestRank}`,
    status,
    rewardCash: status === "completed" ? (wantsRepeatPeak ? 5 : 3) : undefined,
    penaltyCash: status === "failed" ? (wantsRepeatPeak ? 2 : 1) : undefined,
    boardConfidenceDelta: status === "completed" ? (wantsRepeatPeak ? 0.55 : 0.35) : status === "failed" ? -0.5 : status === "at_risk" ? -0.15 : 0,
    source: summary.bestRank == null ? "player_performance_pending" : "player_discipline_performance_rank",
  };
}

function getRebuildCashObjective(input: {
  team: Team;
  row: TeamManagementSnapshotRow;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): ObjectiveDraft | null {
  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const ambition = input.identity?.ambition ?? 5;
  if (cashPriority < 8 && ambition > 4) return null;
  const target = roundValue(Math.max(0, input.team.budget * 0.65), 1);
  const status = statusForMin(input.row.cash, target);

  return {
    objectiveId: "finance-rebuild-cash-buffer",
    category: "finance",
    label: cashPriority >= 8 ? "Cashpuffer halten" : "Rebuild-Kosten klein halten",
    targetValue: `>= ${target}`,
    currentValue: input.row.cash,
    status,
    rewardCash: status === "completed" ? 3 : undefined,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.35 : status === "failed" ? -0.45 : -0.1,
    source: "team_identity_finance_rebuild",
  };
}

function getRivalryObjective(input: {
  gameState: GameState;
  team: Team;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}): ObjectiveDraft | null {
  const rivalry = getPrimaryTeamRivalry(input.gameState, input.team.teamId);
  if (!rivalry) return null;
  const rivalTeamId = rivalry.teamAId === input.team.teamId ? rivalry.teamBId : rivalry.teamAId;
  const rivalRow = input.rowsByTeamId.get(rivalTeamId) ?? null;
  const rivalTeam = input.gameState.teams.find((team) => team.teamId === rivalTeamId) ?? null;
  if (!rivalRow || !rivalTeam) return null;

  const axisKey =
    rivalry.theme === "power"
      ? "ppsPow"
      : rivalry.theme === "speed"
        ? "ppsSpe"
        : rivalry.theme === "mental"
          ? "ppsMen"
          : rivalry.theme === "social"
            ? "ppsSoc"
            : null;
  if (axisKey) {
    const ownValue = input.row[axisKey] ?? 0;
    const rivalValue = rivalRow[axisKey] ?? 0;
    const status =
      ownValue > rivalValue ? "completed" : ownValue >= rivalValue * 0.92 ? "at_risk" : "failed";
    const axisLabel = rivalry.theme === "power" ? "POW" : rivalry.theme === "speed" ? "SPE" : rivalry.theme === "mental" ? "MEN" : "SOC";
    return {
      objectiveId: `rivalry-${rivalTeamId}-${rivalry.theme}`,
      category: "sport",
      label: `${axisLabel}-Rivalen ${rivalTeam.shortCode} schlagen`,
      targetValue: `> ${rivalTeam.shortCode}`,
      currentValue: `${roundValue(ownValue, 1)} / ${roundValue(rivalValue, 1)}`,
      status,
      rewardCash: status === "completed" ? 5 : undefined,
      penaltyCash: status === "failed" ? 2 : undefined,
      boardConfidenceDelta: status === "completed" ? 0.55 : status === "at_risk" ? -0.1 : -0.55,
      source: `team_rivalry_matrix:${rivalry.rivalryId}`,
    };
  }

  const ownRank = input.row.rank;
  const rivalRank = rivalRow.rank;
  const status =
    ownRank == null || rivalRank == null
      ? "open"
      : ownRank < rivalRank
        ? "completed"
        : ownRank <= rivalRank + 3
          ? "at_risk"
          : "failed";
  return {
    objectiveId: `rivalry-${rivalTeamId}-overall`,
    category: "sport",
    label: `Vor Rivalen ${rivalTeam.shortCode} landen`,
    targetValue: `Rang vor ${rivalTeam.shortCode}`,
    currentValue: ownRank == null || rivalRank == null ? "offen" : `#${ownRank} / #${rivalRank}`,
    status,
    rewardCash: status === "completed" ? 5 : undefined,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.5 : status === "at_risk" ? -0.1 : -0.5,
    source: `team_rivalry_matrix:${rivalry.rivalryId}`,
  };
}

function getSeasonNumber(gameState: GameState) {
  const fromId = /season-(\d+)/i.exec(gameState.season.id)?.[1];
  const fromName = /season\s+(\d+)/i.exec(gameState.season.name)?.[1];
  const parsed = Number(fromId ?? fromName);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstObjective(
  objectives: ObjectiveDraft[],
  predicate: (objective: ObjectiveDraft) => boolean,
) {
  return objectives.find(predicate) ?? null;
}

function pickUrgentObjective(objectives: ObjectiveDraft[], category: TeamSeasonObjectiveCategory) {
  return (
    objectives.find((objective) => objective.category === category && objective.status === "failed") ??
    objectives.find((objective) => objective.category === category && objective.status === "at_risk") ??
    objectives.find((objective) => objective.category === category && objective.status === "open") ??
    objectives.find((objective) => objective.category === category) ??
    null
  );
}

function selectBoardObjectiveDrafts(input: {
  objectives: ObjectiveDraft[];
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
}) {
  const picked: ObjectiveDraft[] = [];
  const add = (objective: ObjectiveDraft | null) => {
    if (!objective || picked.some((entry) => entry.objectiveId === objective.objectiveId)) return;
    if (picked.length < 4) picked.push(objective);
  };

  add(pickFirstObjective(input.objectives, (objective) => objective.objectiveId.startsWith("sport-rank-")));

  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const urgentEconomy =
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-cash-positive" && objective.status === "failed") ??
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "transfer-profit" && cashPriority >= 8) ??
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-rebuild-cash-buffer") ??
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-salary-ratio" && objective.status !== "completed") ??
    pickUrgentObjective(input.objectives, "finance");
  add(urgentEconomy);

  add(
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "roster-optimum" && objective.status !== "completed") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "roster-form-color-cover") ??
      pickUrgentObjective(input.objectives, "roster"),
  );

  add(
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-axis-allround-tophalf" && objective.status !== "completed") ??
      pickFirstObjective(
        input.objectives,
        (objective) =>
          objective.objectiveId.startsWith("sport-axis-rank-") &&
          objective.source === "team_signature_axis_rank_goal" &&
          objective.status !== "completed",
      ) ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-axis-allround-tophalf") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top20-breakthrough") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-matchday-medals" && objective.status !== "open") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top20-repeat") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-matchday-medals") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top50-season") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top5-discipline-star") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId.startsWith("rivalry-")) ??
      pickFirstObjective(
        input.objectives,
        (objective) => objective.objectiveId.startsWith("sport-axis-rank-") && objective.source === "team_signature_axis_rank_goal",
      ) ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId.startsWith("sport-axis-")) ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-next-matchday-top10") ??
      pickUrgentObjective(input.objectives, "morale") ??
      pickUrgentObjective(input.objectives, "facility") ??
      pickUrgentObjective(input.objectives, "development"),
  );

  for (const objective of input.objectives) {
    add(objective);
  }

  return picked;
}

function buildTeamObjectives(input: {
  gameState: GameState;
  team: Team;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): TeamSeasonObjectiveRecord[] {
  const { gameState, team, row, rowsByTeamId, identity, profile } = input;
  const sportTarget = getSportTarget({ team, identity, profile, row, rowsByTeamId });
  const transferProfitTarget = team.shortCode === "C-C" || (profile?.bias.sellForProfitAggression ?? 0) >= 8 ? 10 : 0;
  const isInitialSeason = getSeasonNumber(gameState) === 1;
  const transferObjective: ObjectiveDraft | null = isInitialSeason
    ? null
    : {
        objectiveId: "transfer-profit",
        category: "transfer",
        label: transferProfitTarget > 0 ? "Transfergewinn erzielen" : "Transferbilanz stabil halten",
        targetValue: transferProfitTarget,
        currentValue: row.transferNet,
        status: statusForMin(row.transferNet, transferProfitTarget),
        rewardCash: transferProfitTarget > 0 ? 5 : undefined,
        boardConfidenceDelta: (row.transferNet ?? 0) >= transferProfitTarget ? 0.25 : -0.25,
        source: "local_transfer_history",
      };
  const objectiveDrafts = selectBoardObjectiveDrafts({
    identity,
    profile,
    objectives: [
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
        source: "team_identity_ambition_current_rank",
      },
      getPreferredAxisObjective({ team, identity, profile, row }),
      getAxisRankObjective({ team, identity, profile, rowsByTeamId }),
      getAllRoundAxisObjective({ team, identity, profile, rowsByTeamId }),
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
      buildSalaryPressureObjective({ row, rowsByTeamId }),
      transferObjective,
      getRosterTarget(row),
      getFormColorObjective(gameState, team),
      getNextMatchdayTop10Objective(gameState, team),
      getMatchdayMedalObjective({ gameState, team, identity, profile }),
      getFacilityObjective(gameState, team, profile),
      getDevelopmentObjective(gameState, row, team),
      getTeamMoraleObjective({ gameState, team, identity, profile }),
      getPlayerTop20Objective({ gameState, team, identity, profile }),
      getPlayerTop50Objective({ gameState, team, identity, profile }),
      getTopPlayerObjective({ gameState, team, identity, profile }),
      getRebuildCashObjective({ team, row, identity, profile }),
      getRivalryObjective({ gameState, team, row, rowsByTeamId }),
    ].filter((objective): objective is ObjectiveDraft => Boolean(objective)),
  });

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
  const merged: TeamSeasonObjectiveRecord[] = [];
  const appendObjectiveSource = (source: string | null | undefined, nextSource: string) =>
    Array.from(new Set([...(source ?? "").split("+"), nextSource].map((entry) => entry.trim()).filter(Boolean))).join("+");
  for (const storedObjective of stored) {
    const generatedObjective = generatedById.get(storedObjective.objectiveId);
    if (!generatedObjective) {
      continue;
    }

    merged.push({
      ...storedObjective,
      label: storedObjective.label || generatedObjective.label,
      targetValue: generatedObjective.targetValue,
      rewardCash: generatedObjective.rewardCash,
      penaltyCash: generatedObjective.penaltyCash,
      detail: generatedObjective.detail ?? storedObjective.detail ?? null,
      actionHint: generatedObjective.actionHint ?? storedObjective.actionHint ?? null,
      currentValue: generatedObjective.currentValue,
      status: generatedObjective.status,
      boardConfidenceDelta: generatedObjective.boardConfidenceDelta,
      source: appendObjectiveSource(storedObjective.source, "status_refresh"),
    });
  }
  const storedIds = new Set(merged.map((objective) => objective.objectiveId));
  return [...merged, ...input.generated.filter((objective) => !storedIds.has(objective.objectiveId))];
}

function calculateBoardConfidence(input: {
  teamId: string;
  identity: TeamIdentity | null;
  objectives: TeamSeasonObjectiveRecord[];
  storedBoard?: TeamBoardConfidenceRecord | null;
}): TeamBoardConfidenceRecord {
  const base = normalizeBoardConfidence(input.identity?.boardConfidence ?? input.storedBoard?.value ?? null);
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
  const hasMoraleRisk = input.objectives.some((objective) => objective.category === "morale" && objective.status !== "completed");
  const hasPlayerPeakNeed = input.objectives.some((objective) => objective.category === "player" && objective.status !== "completed");
  const hasMedalPushNeed = input.objectives.some((objective) => objective.objectiveId === "sport-matchday-medals" && objective.status !== "completed");
  const axisPriorities: Partial<Record<AxisKey, number>> = {};
  for (const objective of input.objectives) {
    if (objective.status === "completed") continue;
    const axisRankMatch = /^sport-axis-rank-(pow|spe|men|soc)-top-\d+$/.exec(objective.objectiveId);
    if (axisRankMatch?.[1]) {
      const axis = axisRankMatch[1] as AxisKey;
      axisPriorities[axis] = Math.max(axisPriorities[axis] ?? 0, objective.status === "failed" ? 0.95 : 0.75);
    }
    if (objective.objectiveId === "sport-axis-allround-tophalf") {
      for (const axis of Object.keys(AXIS_OBJECTIVE_META) as AxisKey[]) {
        axisPriorities[axis] = Math.max(axisPriorities[axis] ?? 0, objective.status === "failed" ? 0.45 : 0.32);
      }
    }
    const preferredAxisMatch = /^sport-axis-(pow|spe|men|soc)$/.exec(objective.objectiveId);
    if (preferredAxisMatch?.[1]) {
      const axis = preferredAxisMatch[1] as AxisKey;
      axisPriorities[axis] = Math.max(axisPriorities[axis] ?? 0, objective.status === "failed" ? 0.35 : 0.22);
    }
  }
  const hasAxisPushNeed = Object.values(axisPriorities).some((value) => (value ?? 0) >= 0.7);
  const pressureFactor = input.board.pressure / 10;
  const budgetConservatism = clamp((hasFinanceRisk ? 0.65 : 0.35) + pressureFactor * 0.15, 0, 1);
  const sellAggression = clamp((hasFinanceRisk ? 0.7 : 0.35) + pressureFactor * 0.25, 0, 1);
  const buyAggression = clamp(
    (hasRosterRisk ? 0.72 : 0.42) +
      pressureFactor * 0.12 +
      (hasPlayerPeakNeed ? 0.11 : 0) +
      (hasMedalPushNeed ? 0.08 : 0) -
      (hasFinanceRisk ? 0.18 : 0) +
      (hasAxisPushNeed ? 0.06 : 0),
    0,
    1,
  );

  return {
    teamId: input.teamId,
    pressure: input.board.pressure,
    transferAggression: roundValue((sellAggression + buyAggression) / 2, 2),
    buyAggression: roundValue(buyAggression, 2),
    sellAggression: roundValue(sellAggression, 2),
    budgetConservatism: roundValue(budgetConservatism, 2),
    facilityPriority: hasFacilityOpen ? 0.75 : 0.25,
    developmentPriority: hasDevelopmentOpen || hasPlayerPeakNeed ? 0.7 : 0.3,
    moralePriority: hasMoraleRisk ? 0.8 : 0.25,
    rosterUrgency: hasRosterRisk || hasPlayerPeakNeed || hasMedalPushNeed || hasAxisPushNeed ? 0.8 : 0.25,
    axisPriorities,
    warnings: [
      hasFinanceRisk ? "objective_bias_finance_caution" : null,
      hasRosterRisk ? "objective_bias_roster_topup" : null,
      hasMoraleRisk ? "objective_bias_morale_repair" : null,
      hasPlayerPeakNeed ? "objective_bias_player_peak_needed" : null,
      hasMedalPushNeed ? "objective_bias_medal_push" : null,
      hasAxisPushNeed ? "objective_bias_axis_rank_push" : null,
      input.board.pressure >= 8 ? "objective_bias_high_pressure_aggression" : null,
    ].filter((warning): warning is string => Boolean(warning)),
  };
}

export function buildTeamObjectiveOverview(gameState: GameState): TeamObjectiveOverview {
  const cached = TEAM_OBJECTIVE_OVERVIEW_CACHE.get(gameState);
  if (cached) {
    return cached;
  }

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
    const generatedObjectives = buildTeamObjectives({ gameState, team, row, rowsByTeamId, identity, profile });
    const teamObjectives = mergeStoredTeamObjectives({ gameState, teamId: team.teamId, generated: generatedObjectives });
    objectives.push(...teamObjectives);
    const storedBoard = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
    const board = calculateBoardConfidence({ teamId: team.teamId, identity, objectives: teamObjectives, storedBoard });
    boardConfidence[team.teamId] = board;
    aiBiasByTeamId[team.teamId] = buildAiBias({ teamId: team.teamId, objectives: teamObjectives, board });
  }

  const overview = {
    seasonId: gameState.season.id,
    objectives,
    boardConfidence,
    aiBiasByTeamId,
    warnings: Array.from(new Set(warnings)),
  };
  TEAM_OBJECTIVE_OVERVIEW_CACHE.set(gameState, overview);
  return overview;
}

export function buildTeamSeasonObjectiveSettlement(gameState: GameState): TeamSeasonObjectiveSettlement {
  const overview = buildTeamObjectiveOverview(gameState);
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const rows: TeamSeasonObjectiveSettlementRow[] = overview.objectives.map((objective) => {
    const cashDelta =
      objective.status === "completed"
        ? objective.rewardCash ?? 0
        : objective.status === "failed"
          ? -(objective.penaltyCash ?? 0)
          : 0;
    const boardConfidenceDelta =
      objective.status === "completed" || objective.status === "failed" || objective.status === "at_risk"
        ? objective.boardConfidenceDelta ?? 0
        : 0;
    const visibleResult = cashDelta > 0 || boardConfidenceDelta > 0 ? "plus" : cashDelta < 0 || boardConfidenceDelta < 0 ? "minus" : "neutral";
    return {
      teamId: objective.teamId,
      teamName: teamById.get(objective.teamId)?.name ?? objective.teamId,
      objectiveId: objective.objectiveId,
      label: objective.label,
      category: objective.category,
      status: objective.status,
      cashDelta: roundValue(cashDelta, 1),
      boardConfidenceDelta: roundValue(boardConfidenceDelta, 2),
      visibleResult,
      reason: `${objective.status}: ${String(objective.currentValue ?? "—")} / ${String(objective.targetValue ?? "—")}`,
    };
  });

  const byTeamId: TeamSeasonObjectiveSettlement["byTeamId"] = {};
  for (const row of rows) {
    const summary = byTeamId[row.teamId] ?? {
      teamId: row.teamId,
      teamName: row.teamName,
      completed: 0,
      failed: 0,
      atRisk: 0,
      open: 0,
      cashDelta: 0,
      boardConfidenceDelta: 0,
      resultLabel: "neutral",
    };
    if (row.status === "completed") summary.completed += 1;
    if (row.status === "failed") summary.failed += 1;
    if (row.status === "at_risk") summary.atRisk += 1;
    if (row.status === "open") summary.open += 1;
    summary.cashDelta = roundValue(summary.cashDelta + row.cashDelta, 1);
    summary.boardConfidenceDelta = roundValue(summary.boardConfidenceDelta + row.boardConfidenceDelta, 2);
    summary.resultLabel =
      summary.cashDelta > 0 || summary.boardConfidenceDelta > 0
        ? "plus"
        : summary.cashDelta < 0 || summary.boardConfidenceDelta < 0
          ? "minus"
          : "neutral";
    byTeamId[row.teamId] = summary;
  }

  return {
    seasonId: gameState.season.id,
    rows,
    byTeamId,
    totals: {
      cashDelta: roundValue(rows.reduce((sum, row) => sum + row.cashDelta, 0), 1),
      boardConfidenceDelta: roundValue(rows.reduce((sum, row) => sum + row.boardConfidenceDelta, 0), 2),
      completed: rows.filter((row) => row.status === "completed").length,
      failed: rows.filter((row) => row.status === "failed").length,
    },
  };
}

export function getTeamObjectives(gameState: GameState, teamId: string) {
  return buildTeamObjectiveOverview(gameState).objectives.filter((objective) => objective.teamId === teamId);
}

function buildStoredObjectiveAiBiasByTeamId(gameState: GameState) {
  const cached = TEAM_OBJECTIVE_AI_BIAS_CACHE.get(gameState);
  if (cached) {
    return cached;
  }

  const currentSeasonId = gameState.season.id;
  const storedObjectives = (gameState.seasonState.teamSeasonObjectives ?? []).filter(
    (objective) => objective.seasonId === currentSeasonId,
  );
  const storedBoardConfidence = gameState.seasonState.boardConfidence ?? {};
  const hasStoredBoardConfidence = Object.keys(storedBoardConfidence).length > 0;
  if (storedObjectives.length === 0 && !hasStoredBoardConfidence) {
    return null;
  }

  const objectivesByTeamId = new Map<string, TeamSeasonObjectiveRecord[]>();
  for (const objective of storedObjectives) {
    const objectives = objectivesByTeamId.get(objective.teamId) ?? [];
    objectives.push(objective);
    objectivesByTeamId.set(objective.teamId, objectives);
  }

  const aiBiasByTeamId: Record<string, TeamObjectiveAiBias> = {};
  for (const team of gameState.teams) {
    const objectives = objectivesByTeamId.get(team.teamId) ?? [];
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const storedBoard = storedBoardConfidence[team.teamId] ?? null;
    const board = storedBoard ?? calculateBoardConfidence({ teamId: team.teamId, identity, objectives, storedBoard: null });
    aiBiasByTeamId[team.teamId] = buildAiBias({ teamId: team.teamId, objectives, board });
  }

  TEAM_OBJECTIVE_AI_BIAS_CACHE.set(gameState, aiBiasByTeamId);
  return aiBiasByTeamId;
}

export function getTeamObjectiveAiBias(gameState: GameState, teamId: string) {
  const storedBias = buildStoredObjectiveAiBiasByTeamId(gameState);
  if (storedBias) {
    return storedBias[teamId] ?? null;
  }
  return buildTeamObjectiveOverview(gameState).aiBiasByTeamId[teamId] ?? null;
}

export function refreshTeamObjectiveState(gameState: GameState): GameState {
  const overview = buildTeamObjectiveOverview(gameState);
  const currentSeasonId = gameState.season.id;
  const otherSeasonObjectives = (gameState.seasonState.teamSeasonObjectives ?? []).filter(
    (objective) => objective.seasonId !== currentSeasonId,
  );

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamSeasonObjectives: [...otherSeasonObjectives, ...overview.objectives],
      boardConfidence: {
        ...(gameState.seasonState.boardConfidence ?? {}),
        ...overview.boardConfidence,
      },
    },
  };
}
