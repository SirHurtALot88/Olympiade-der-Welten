import type {
  GamePhase,
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
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getPrimaryTeamRivalry } from "@/lib/rivalries/team-rivalries";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  beschreibeSonderziel,
  evaluateSponsorImprovementObjective,
  evaluateSponsorRankObjective,
} from "@/lib/sponsor/sponsor-objective-evaluator";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
import {
  BOARD_V2_CALIBRATION,
  BOARD_V2_CAPTAIN,
  BOARD_V2_COMPOSITION,
  BOARD_V2_DISPOSITION,
  BOARD_V2_MEDALS,
  BOARD_V2_NET_TRANSFER,
  BOARD_V2_SLATE,
  isBoardObjectivesV2Enabled,
} from "@/lib/board/board-objectives-config";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { buildSeasonFormCardBonusByTeamId } from "@/lib/foundation/season-form-card-bonus";
import {
  buildLeagueMetricStanding,
  capProvisionalObjectiveStatus,
  isCashDistress,
  resolveLeagueRankTarget,
  statusForLeagueRank,
} from "@/lib/board/board-objective-league-calibration";

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
  /**
   * Das Ziel wird gegen eine Rangmarke gewertet (Liga-Rang, Achsen-Rang, Disziplin-Rang eines
   * Spielers). Der Vorstand stellt pro Saison nur EIN verbindliches Rang-Ziel — jedes weitere im
   * Slate wird in der Vergabe zum optionalen Zusatzziel herabgestuft (siehe
   * `demoteExtraRankTargets`).
   */
  rankTarget?: boolean;
  /** In der Vergabe zum Zusatzziel herabgestuft: bringt Bonus, kostet aber nichts. */
  optional?: boolean;
  /**
   * Der angezeigte Wert ist eine HOCHRECHNUNG, kein Ergebnis: das Ziel hängt an Cash, und die
   * Einnahmen der Saison (Sponsor, Apron, Gebäude) sind noch nicht gebucht. Solange das gilt, kann
   * das Ziel nicht „verfehlt" sein — siehe `capProvisionalObjectiveStatus`.
   */
  provisional?: boolean;
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

/**
 * Sind die EINNAHMEN dieser Saison schon auf den Konten?
 *
 * Sponsor, Apron und Gebäude werden am Saisonende in einem Rutsch gebucht
 * (`cash-prize-apply-service.ts` schreibt dabei seinen `cashPrizeApplyLog`). Vorher zeigt jeder
 * Cash-Stand nur die Ausgabenseite einer Saison, und jedes Ziel, das an Cash hängt, wertet gegen
 * eine Zahl, die es am Ende so nicht mehr gibt. Genau dieser Log ist deshalb der Schalter zwischen
 * „Hochrechnung" und „steht fest".
 *
 * Bewusst NICHT über die Spielphase entschieden: die Phase sagt, wo der Spieler in der Kette steht,
 * nicht, ob gebucht wurde — und im Live-Save von Chris war beides schon einmal auseinandergelaufen.
 */
function hasSeasonIncomeBeenBooked(gameState: GameState): boolean {
  return (gameState.seasonState.cashPrizeApplyLogs ?? []).some((log) => log.seasonId === gameState.season.id);
}

/**
 * Gehaltsquote eines Teams: `Gehalt / (Cash + Gehalt)`. `null`, wenn eine der beiden Größen fehlt.
 *
 * Als ABSOLUTE Marke ist diese Zahl unbrauchbar (siehe Kopfkommentar in
 * `board-objective-league-calibration.ts`): Cash fällt über die ganze Saison und wird erst am Ende
 * wieder aufgefüllt. Als LIGA-VERGLEICH trägt sie, weil alle Teams denselben Kalender haben.
 */
function getSalaryRatio(row: TeamManagementSnapshotRow): number | null {
  const salaryTotal = row.salaryTotal ?? 0;
  const cash = row.cash ?? null;
  if (salaryTotal <= 0 || cash == null) return null;
  return salaryTotal / Math.max(1, cash + salaryTotal);
}

function buildSalaryPressureObjective(input: {
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  /** `false` = die Einnahmen der Saison sind noch nicht gebucht, der Wert ist eine Hochrechnung. */
  settled: boolean;
}): ObjectiveDraft {
  // Anspruch des Vorstands auf Finanzdisziplin. Dieselbe Skala, die auch Cashpuffer und
  // Transferdeckel benutzen — ein sparsamer Vorstand ist auf allen drei Feldern sparsam.
  const demand = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const standing = buildLeagueMetricStanding({
    teamId: input.row.teamId,
    values: [...input.rowsByTeamId.values()].map((row) => ({ teamId: row.teamId, value: getSalaryRatio(row) })),
    direction: "lower_is_better",
  });
  const target = resolveLeagueRankTarget({ teamCount: standing.teamCount, demand });
  const rawStatus = statusForLeagueRank({ rank: standing.rank, targetRank: target.targetRank, teamCount: standing.teamCount });
  const salaryTotal = input.row.salaryTotal ?? 0;
  const cash = input.row.cash ?? null;
  // Ein Konto im Minus ist eine Tatsache, kein Zwischenstand — siehe `isCashDistress`. Es sticht den
  // Liga-Vergleich und nimmt dem Ziel den Hochrechnungs-Vorbehalt.
  const cashDistress = isCashDistress(cash);
  const provisional = !input.settled && !cashDistress;
  const status = cashDistress ? ("failed" satisfies TeamSeasonObjectiveStatus) : provisional ? capProvisionalObjectiveStatus(rawStatus) : rawStatus;

  const currentPercent = standing.value == null ? null : roundValue(standing.value * 100, 1);
  const medianPercent = standing.median == null ? null : roundValue(standing.median * 100, 1);

  const leagueDetail =
    standing.rank == null
      ? "Formel: Gehalt / (Cash + Gehalt), verglichen mit der Liga. Es fehlen Cash- oder Gehaltsdaten."
      : `Formel: Gehalt / (Cash + Gehalt), verglichen mit der Liga. Aktuell ${currentPercent}% bei ` +
        `${formatObjectiveMoney(salaryTotal)} Gehalt und ${formatObjectiveMoney(cash)} Cash — Rang ${standing.rank} von ` +
        `${standing.teamCount}, Ligamedian ${medianPercent}%. Gefordert ist ein Platz ${target.bandPhrase} ` +
        `(Rang ${target.targetRank} oder besser).` +
        (provisional
          ? " Hochrechnung: Sponsor, Apron und Gebäude werden erst am Saisonende gebucht, bis dahin fällt Cash bei allen Teams."
          : "");

  return {
    objectiveId: "finance-salary-ratio",
    category: "finance",
    // Das Label nennt die EINHEIT der beiden Zahlen darunter ("Ligarang"), damit „Ist 29 · Ziel 18"
    // auf der Zielkarte nicht wie eine Prozent- oder Geldangabe gelesen wird.
    label: `Gehaltsquote: Ligarang ${target.bandPhrase}`,
    detail: cashDistress
      ? `Das Konto steht bei ${formatObjectiveMoney(cash)} und damit im Minus. Der Ligavergleich der Gehaltsquote ` +
        `ist dann zweitrangig — der Vorstand erwartet zuerst ein gedecktes Konto. ${leagueDetail}`
      : leagueDetail,
    actionHint: cashDistress
      ? "Zuerst das Konto decken: Verkäufe vorziehen oder Gehalt abbauen, bevor der Vorstand über die Quote redet."
      : standing.rank != null && standing.rank > target.targetRank
        ? `Du liegst ${standing.rank - target.targetRank} Plätze hinter der Marke: teure Spieler verkaufen, auslaufende Verträge günstiger verlängern oder nur Spieler mit starkem MW/Gehalt-Ratio kaufen.`
        : "Erfüllt. Weiter auf günstige Verlängerungen und gute MW/Gehalt-Ratios achten.",
    // Rang als ZAHL, nicht als Satz: der Analytics-Raum bildet daraus den Abstand zur Marke
    // ("noch 11 Plaetze"), und der ist bei einer Rangskala richtungsfrei und immer richtig. Als Text
    // ("Rang 29 (95,5%)") war die Groesse fuer ihn nicht auswertbar.
    targetValue: target.targetRank,
    currentValue: standing.rank,
    status,
    // Malus nur, wenn das Ziel wirklich verfehlt ist — vor der Abrechnung nur bei gedecktem Konto
    // ausgeschlossen, denn ein Minus bleibt ein Minus.
    penaltyCash: status === "failed" ? 4 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.3 : status === "failed" ? -0.4 : status === "at_risk" ? -0.15 : 0,
    provisional,
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

/**
 * Where a team's squad strength says it "should" finish in the league, independent of the
 * board's ambition. Used as the baseline that #6 (expectation-rank) and #2a (upset-avoidance)
 * measure against.
 */
export function computeTeamExpectation(input: {
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  identity: TeamIdentity | null;
}): { expectedRank: number; strengthPct: number; ambitionMod: number; teamCount: number } {
  const teamCount = input.rowsByTeamId.size;
  const ranked = [...input.rowsByTeamId.values()].sort((left, right) => {
    const ppsDiff = (right.ppsTotal ?? 0) - (left.ppsTotal ?? 0);
    if (ppsDiff !== 0) return ppsDiff;
    return (right.marketValueTotal ?? 0) - (left.marketValueTotal ?? 0);
  });
  const index = ranked.findIndex((row) => row.teamId === input.row.teamId);
  const expectedRank = index >= 0 ? index + 1 : Math.max(1, teamCount);
  const strengthPct = clamp(teamCount > 1 ? (teamCount - expectedRank) / (teamCount - 1) : 1, 0, 1);
  // Normalize identity ambition (1..10, default 5) onto roughly -1..1.
  const ambitionMod = clamp(((input.identity?.ambition ?? 5) - 5) / 5, -1, 1);
  return { expectedRank, strengthPct, ambitionMod, teamCount: Math.max(1, teamCount) };
}

/**
 * Per-matchday, per-team totals for the current season, scoped to a single discipline
 * category (i.e. a single AxisKey). Mirrors getTeamMatchdayMedalSummary's scan/group
 * pattern but sums only disciplines whose category maps to the requested axis.
 */
function getAxisScoresByMatchday(input: {
  gameState: GameState;
  axis: AxisKey;
}): Map<string, Map<string, number>> {
  const disciplineCategoryById = new Map(
    input.gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );
  const axisByCategory: Record<string, AxisKey> = {
    power: "pow",
    speed: "spe",
    mental: "men",
    social: "soc",
  };
  const resultIds = getCurrentSeasonMatchdayResultIds(input.gameState);
  const scoresByResultId = new Map<string, Map<string, number>>();
  for (const result of input.gameState.seasonState.disciplineResults ?? []) {
    if (!resultIds.has(result.matchdayResultId)) continue;
    const category = disciplineCategoryById.get(result.disciplineId);
    if (!category || axisByCategory[category] !== input.axis) continue;
    const teamScores = scoresByResultId.get(result.matchdayResultId) ?? new Map<string, number>();
    teamScores.set(result.teamId, (teamScores.get(result.teamId) ?? 0) + (result.totalScore ?? 0));
    scoresByResultId.set(result.matchdayResultId, teamScores);
  }
  return scoresByResultId;
}

// #6 — reward/punish teams for beating (or missing) the finish their squad strength predicts,
// scaled by how ambitious the board is.
export function getExpectationRankObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  // V2: stärke-kalibrierter Zielrang (getSportTargetV2 mit BOARD_V2_CALIBRATION + Dispositions-
  // Ambition). Überschreibt NUR den Zielrang der gewerteten Slot-1-Sportvorgabe — Belohnung/Strafe
  // und der Confidence-Swing bleiben (rankDelta-basiert) unverändert. Ohne Override (V1, Flag aus)
  // greift weiter das statische identity.ambition-Ziel.
  targetRankOverride?: number | null;
}): ObjectiveDraft {
  const expectation = computeTeamExpectation({ row: input.row, rowsByTeamId: input.rowsByTeamId, identity: input.identity });
  const ambition = input.identity?.ambition ?? 5;
  const overachieveGap = Math.max(1, Math.round(1 + ambition / 3));
  const targetRank =
    input.targetRankOverride != null
      ? clamp(Math.round(input.targetRankOverride), 1, expectation.teamCount)
      : clamp(expectation.expectedRank - overachieveGap, 1, expectation.teamCount);
  // Für den Detail-Text: der tatsächlich geforderte Vorsprung. Ohne Override identisch zu
  // overachieveGap (V1 unverändert), mit Override das echte Delta zum kalibrierten V2-Ziel.
  const detailGap = input.targetRankOverride != null ? Math.max(0, expectation.expectedRank - targetRank) : overachieveGap;
  const currentRank = input.row.rank ?? null;
  const status = statusForRank(currentRank, targetRank);

  // Graduated confidence swing: beating expectation by many ranks earns a bigger boost than
  // a strong team barely clearing a low bar. rankDelta > 0 means "finished better than expected".
  const rankDelta = currentRank == null ? 0 : expectation.expectedRank - currentRank;
  const boardConfidenceDelta = clamp(roundValue(0.1 + rankDelta * 0.12, 2), -3, 4);
  const rewardCash = currentRank != null && rankDelta > 0 ? clamp(Math.round(2 + rankDelta * 0.8), 0, 12) : undefined;
  const penaltyCash = currentRank != null && rankDelta < 0 ? clamp(Math.round(2 + Math.abs(rankDelta) * 0.6), 0, 10) : undefined;

  return {
    objectiveId: "expectation-rank",
    category: "sport",
    label: `Übertreffe die Erwartung (Top ${targetRank})`,
    detail: `Kaderstärke erwartet Rang #${expectation.expectedRank}/${expectation.teamCount}. Ziel: mindestens ${detailGap} Plätze besser abschneiden.`,
    actionHint: "Transfers und Aufstellung so priorisieren, dass die Erwartung der Kaderstärke übertroffen wird.",
    targetValue: `Top ${targetRank}`,
    currentValue: currentRank ?? "offen",
    status,
    rewardCash,
    penaltyCash,
    boardConfidenceDelta,
    rankTarget: true,
    source: "team_expectation_rank_model",
  };
}

// #2a — teams strong enough to matter shouldn't shed too many "upset" losses (matchdays where a
// weaker-expectation team outranks them).
export function getUpsetAvoidanceObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  gameState: GameState;
}): ObjectiveDraft | null {
  const expectation = computeTeamExpectation({ row: input.row, rowsByTeamId: input.rowsByTeamId, identity: input.identity });
  const ambition = input.identity?.ambition ?? 5;
  if (expectation.strengthPct < 0.4 && ambition < 6) return null;

  const expectedRankByTeamId = new Map<string, number>();
  for (const row of input.rowsByTeamId.values()) {
    expectedRankByTeamId.set(
      row.teamId,
      computeTeamExpectation({ row, rowsByTeamId: input.rowsByTeamId, identity: null }).expectedRank,
    );
  }
  const ownExpectedRank = expectedRankByTeamId.get(input.team.teamId) ?? expectation.expectedRank;

  const resultIds = getCurrentSeasonMatchdayResultIds(input.gameState);
  const scoresByResultId = new Map<string, Map<string, number>>();
  for (const result of input.gameState.seasonState.disciplineResults ?? []) {
    if (!resultIds.has(result.matchdayResultId)) continue;
    const teamScores = scoresByResultId.get(result.matchdayResultId) ?? new Map<string, number>();
    teamScores.set(result.teamId, (teamScores.get(result.teamId) ?? 0) + (result.totalScore ?? 0));
    scoresByResultId.set(result.matchdayResultId, teamScores);
  }

  let upsetCount = 0;
  for (const teamScores of scoresByResultId.values()) {
    const ranked = [...teamScores.entries()].sort((left, right) => right[1] - left[1]);
    const ownIndex = ranked.findIndex(([teamId]) => teamId === input.team.teamId);
    if (ownIndex < 0) continue;
    for (let i = 0; i < ownIndex; i++) {
      const [otherTeamId] = ranked[i];
      const otherExpectedRank = expectedRankByTeamId.get(otherTeamId) ?? Number.POSITIVE_INFINITY;
      // An "upset": a team our model expected to finish worse than us (higher expectedRank
      // number) still outscored us this matchday.
      if (otherExpectedRank > ownExpectedRank) upsetCount += 1;
    }
  }

  const cap = Math.max(1, Math.round(3 - expectation.strengthPct * 2));
  const status = statusForMax(upsetCount, cap);

  return {
    objectiveId: "sport-upset-avoidance",
    category: "sport",
    label: `Verliere höchstens ${cap}x gegen schwächere Teams`,
    detail: `Bisher ${upsetCount} Aufholjagden schwächer erwarteter Teams zugelassen.`,
    actionHint: "Aufstellung und Form gegen vermeintlich schwächere Gegner konstant hoch halten.",
    targetValue: `<= ${cap}`,
    currentValue: upsetCount,
    status,
    penaltyCash: status === "failed" ? clamp(Math.round((upsetCount - cap) * 1.5), 1, 8) : undefined,
    boardConfidenceDelta: status === "completed" ? 0.3 : status === "at_risk" ? -0.15 : status === "failed" ? -0.6 : 0,
    source: "matchday_team_score_rank_upset_model",
  };
}

// #2b — a soft ceiling on net transfer spend for teams whose board cares about cash discipline.
export function getTransferSpendCeilingObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}): ObjectiveDraft | null {
  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  if (cashPriority < 7) return null;

  // GEMESSEN am Live-Save: der feste Deckel stand in Saison 2 bei fünf Teams gegen Netto-Ausgaben
  // von 218 bis 281 Mio — alle fünf „verfehlt". Der bisherige S1-Ausweg („in Saison 1 kauft jedes
  // Team seinen kompletten Kader") griff zu kurz: JEDER Saisonwechsel ist eine Kaufsaison, die Liga
  // verkauft und kauft geschlossen neu. Ein Deckel, der einen ligaweiten Umbau bestraft, misst den
  // Umbau, nicht die Ausgabendisziplin. Also wird gegen die Liga gewertet: wer im Vergleich zu den
  // anderen 31 Teams zurückhaltend eingekauft hat, hat das Ziel erfüllt — auch in einem Sommer, in
  // dem alle viel ausgegeben haben.
  const netSpend = Math.max(0, -(input.row.transferNet ?? 0));
  const standing = buildLeagueMetricStanding({
    teamId: input.row.teamId,
    values: [...input.rowsByTeamId.values()].map((row) => ({
      teamId: row.teamId,
      value: Math.max(0, -(row.transferNet ?? 0)),
    })),
    direction: "lower_is_better",
  });
  const target = resolveLeagueRankTarget({ teamCount: standing.teamCount, demand: cashPriority });
  const status = statusForLeagueRank({ rank: standing.rank, targetRank: target.targetRank, teamCount: standing.teamCount });

  return {
    objectiveId: "finance-transfer-ceiling",
    category: "finance",
    label: `Netto-Transferausgaben: Ligarang ${target.bandPhrase}`,
    detail:
      standing.rank == null
        ? "Netto-Transferausgaben im Ligavergleich. Es fehlen Transferdaten."
        : `Netto-Transferausgaben im Ligavergleich: ${formatObjectiveMoney(netSpend)} — Rang ${standing.rank} von ` +
          `${standing.teamCount} (sparsamste zuerst), Ligamedian ${formatObjectiveMoney(standing.median)}. ` +
          `Gefordert ist ein Platz ${target.bandPhrase} (Rang ${target.targetRank} oder besser).`,
    actionHint: "Transferausgaben im Rahmen halten: Verkäufe priorisieren, teure Neuzugänge nur bei klarem Mehrwert.",
    targetValue: target.targetRank,
    currentValue: standing.rank,
    status,
    penaltyCash: status === "failed" ? 3 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.25 : status === "at_risk" ? -0.1 : status === "failed" ? -0.4 : 0,
    source: "team_transfer_net_spend_ceiling",
  };
}

// #7 — reward repeatedly finishing #1 on a matchday within the team's own signature axis.
export function getSignatureAxisWinObjective(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  gameState: GameState;
}): ObjectiveDraft | null {
  const axis = getPrimaryAxis(input);
  const bias = getAxisBias({ axis, identity: input.identity, profile: input.profile });
  const ambition = input.profile?.bias.starPriority ?? input.identity?.ambition ?? 5;
  if (bias < 6 && ambition < 6) return null;

  const scoresByResultId = getAxisScoresByMatchday({ gameState: input.gameState, axis });
  let signatureWins = 0;
  for (const teamScores of scoresByResultId.values()) {
    const ranked = [...teamScores.entries()].sort((left, right) => right[1] - left[1]);
    if (ranked[0]?.[0] === input.team.teamId) signatureWins += 1;
  }

  const remaining = getRemainingMatchdays(input.gameState);
  const played = getCurrentSeasonMatchdayResults(input.gameState).length;
  const total = input.gameState.season.matchdayIds?.length ?? 0;
  const target = Math.max(1, 4 + (ambition >= 8 || bias >= 9 ? 2 : ambition >= 7 || bias >= 8 ? 1 : 0));
  const status = statusForSeasonCount({ current: signatureWins, target, remaining, played, total });
  const meta = AXIS_OBJECTIVE_META[axis];

  return {
    objectiveId: "sport-signature-wins",
    category: "sport",
    label: `Gewinne ${target} Spieltage über deine ${meta.label}-Achse`,
    detail: `Bisher ${signatureWins}/${target} Spieltagssiege in der ${meta.fullLabel}-Wertung.`,
    actionHint: `${meta.label}-Spezialisten und passendes Training priorisieren, um Spieltage in dieser Achse zu dominieren.`,
    targetValue: target,
    currentValue: signatureWins,
    status,
    rewardCash: status === "completed" ? 6 : undefined,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.5 : status === "failed" ? -0.4 : status === "at_risk" ? -0.15 : 0,
    source: "matchday_axis_score_rank",
  };
}

export function getSportTarget(input: {
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

/**
 * Board-Objectives V2 — expected league rank from team strength (composite of PPs + market-value
 * rank), the same signal getSportTarget uses internally, extracted for reuse by the calibrated
 * targets. Lower = stronger (1 = strongest team).
 */
function resolveExpectedLeagueRank(input: {
  teamId: string;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}) {
  const ppsRank = getRelativeMetricRank({ teamId: input.teamId, rowsByTeamId: input.rowsByTeamId, metric: "ppsTotal" }).rank;
  const marketValueRank = getRelativeMetricRank({
    teamId: input.teamId,
    rowsByTeamId: input.rowsByTeamId,
    metric: "marketValueTotal",
  }).rank;
  return Math.round((ppsRank * 2 + marketValueRank) / 3);
}

/**
 * Board disposition (Slice 3): ambition + patience that drift with recent results. Derived from
 * identity temperament plus a normalized "last season vs expectation" signal (the carried board
 * value relative to neutral). F1: disappointment (low carried value) lowers patience + ambition;
 * overperformance raises both. Multi-season memory comes for free via the board-value carry.
 */
export function resolveBoardDisposition(input: {
  identity: TeamIdentity | null;
  previousSeasonBoard?: TeamBoardConfidenceRecord | null;
}) {
  const baseAmbition = clamp((input.identity?.ambition ?? 5) / 10, 0, 1);
  const seed = normalizeBoardConfidence(input.identity?.boardConfidence ?? null);
  const basePatience = clamp(0.5 * (seed / 10) + 0.5 * ((input.identity?.harmony ?? 5) / 10), 0.1, 0.95);
  // Performance signal in [-~0.8, +1.0]: previous-season board value above/below neutral.
  const perf =
    input.previousSeasonBoard?.value != null
      ? (input.previousSeasonBoard.value - BOARD_V2_DISPOSITION.neutralValue) / BOARD_V2_DISPOSITION.neutralValue
      : 0;
  const ambition = clamp(
    baseAmbition + perf * BOARD_V2_DISPOSITION.ambitionResponse,
    BOARD_V2_DISPOSITION.ambitionMin,
    BOARD_V2_DISPOSITION.ambitionMax,
  );
  const patience = clamp(
    basePatience + perf * BOARD_V2_DISPOSITION.patienceResponse,
    BOARD_V2_DISPOSITION.patienceMin,
    BOARD_V2_DISPOSITION.patienceMax,
  );
  return { ambition, patience };
}

/**
 * V2 calibrated sport target: targetRank = expectedRank − stretch(ambition). Replaces the hardcoded
 * tier ladder + per-team shortCode special-cases with a strength-relative goal — weak teams get an
 * achievable "hold your ground" target, strong+ambitious teams get a real climb. Organic, no quotas.
 * `ambition01` overrides the identity ambition with the dynamic disposition value when provided.
 */
export function getSportTargetV2(input: {
  identity: TeamIdentity | null;
  teamId: string;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  ambition01?: number;
}) {
  const leagueSize = Math.max(1, input.rowsByTeamId.size);
  const expectedRank = clamp(resolveExpectedLeagueRank({ teamId: input.teamId, rowsByTeamId: input.rowsByTeamId }), 1, leagueSize);
  const ambition01 = clamp(input.ambition01 ?? (input.identity?.ambition ?? 5) / 10, 0, 1);
  let maxStretch = BOARD_V2_CALIBRATION.maxStretch;
  if (expectedRank >= BOARD_V2_CALIBRATION.bottomDampFromRank) {
    maxStretch *= BOARD_V2_CALIBRATION.bottomDampFactor;
  }
  const stretch = Math.round(BOARD_V2_CALIBRATION.minStretch + (maxStretch - BOARD_V2_CALIBRATION.minStretch) * ambition01);
  const rank = clamp(expectedRank - stretch, 1, leagueSize);
  const label =
    stretch <= 0
      ? `Erwartung bestätigen (~Rang ${rank})`
      : `Rang ${rank} angreifen (Stärke-Erwartung ~${expectedRank})`;
  return { rank, label };
}

/**
 * V2 finance goal (replaces the tautological "cash > 0"): a net transfer-balance target scaled by
 * cash priority + season maturity — a real "run a sustainable transfer economy" objective.
 */
export function getNetTransferBalanceObjective(input: {
  team: Team;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  profile: TeamStrategyProfile | null;
  seasonNum: number;
}): ObjectiveDraft {
  const cashPriority = input.profile?.bias.cashPriority ?? 5;
  if (input.seasonNum <= 1) {
    // DRAFT-SAISON: der komplette Kader wird erst gekauft, die Netto-Transferbilanz ist deshalb per
    // Konstruktion tief negativ (real gemessen: −193.7M gegen einen 8M-Deckel). Weder ein Überschuss-
    // noch ein Ausgaben-Deckel-Ziel ist hier erfüllbar, also tritt an seine Stelle eine Vorgabe, die das
    // Team tatsächlich steuern kann: einen Cash-Puffer über die Saison halten. Ab S2 greift wieder die
    // reguläre Transferbilanz-Vorgabe.
    const reserve = roundValue(
      clamp(
        input.team.budget * BOARD_V2_NET_TRANSFER.draftSeasonCashReserveBudgetFraction,
        BOARD_V2_NET_TRANSFER.draftSeasonCashReserveFloorM,
        BOARD_V2_NET_TRANSFER.draftSeasonCashReserveCapM,
      ),
      1,
    );
    const reserveStatus = statusForMin(input.row.cash ?? null, reserve);
    return {
      objectiveId: "finance-net-transfer-balance",
      category: "finance",
      label: `Cash-Reserve von ${reserve}M halten`,
      detail: `Aufbausaison: der Kader wird komplett eingekauft, deshalb wertet der Vorstand nicht die Transferbilanz, sondern die Liquidität. Aktuell ${roundValue(input.row.cash ?? 0, 1)}M Cash.`,
      actionHint: "Beim Kaderaufbau genug Cash zurückhalten — Gehälter und Nachverpflichtungen laufen die ganze Saison weiter.",
      targetValue: reserve,
      currentValue: roundValue(input.row.cash ?? 0, 1),
      status: reserveStatus,
      rewardCash: reserveStatus === "completed" ? 3 : undefined,
      penaltyCash: reserveStatus === "failed" ? 2 : undefined,
      boardConfidenceDelta: reserveStatus === "completed" ? 0.25 : reserveStatus === "failed" ? -0.35 : -0.1,
      source: "board_v2_net_transfer_balance",
    };
  }
  // AB SAISON 2 gegen die LIGA statt gegen eine feste Zahl.
  //
  // Vorher standen hier zwei feste Marken, und beide sind am Live-Save gescheitert: der
  // Überschuss-Zweig verlangte „Transferbilanz ≥ 1,4M" von einem Team bei −322, der Deckel-Zweig
  // „Transferausgaben unter 8M" von fünf Teams bei 218 bis 340. Der Grund ist derselbe wie beim
  // Gehaltsziel: JEDER Saisonwechsel ist eine Kaufsaison — die Liga verkauft und kauft geschlossen
  // neu. Eine absolute Marke misst dann den Umbau, nicht die Wirtschaftsführung.
  //
  // Der Ligavergleich misst, was das Ziel meinen soll: „führst du deine Transferkasse besser oder
  // schlechter als die anderen?" In einem Sommer, in dem alle viel ausgeben, kann man das immer
  // noch gewinnen — und in einem ruhigen Sommer immer noch verlieren.
  const current = roundValue(input.row.transferNet ?? 0, 1);
  const standing = buildLeagueMetricStanding({
    teamId: input.row.teamId,
    values: [...input.rowsByTeamId.values()].map((row) => ({ teamId: row.teamId, value: row.transferNet ?? 0 })),
    // Höhere (weniger negative) Netto-Bilanz ist die bessere Wirtschaftsführung.
    direction: "higher_is_better",
  });
  const target = resolveLeagueRankTarget({ teamCount: standing.teamCount, demand: cashPriority });
  const status = statusForLeagueRank({ rank: standing.rank, targetRank: target.targetRank, teamCount: standing.teamCount });

  return {
    objectiveId: "finance-net-transfer-balance",
    category: "finance",
    label: `Transferbilanz: Ligarang ${target.bandPhrase}`,
    detail:
      standing.rank == null
        ? "Netto-Transferbilanz im Ligavergleich. Es fehlen Transferdaten."
        : `Netto-Transferbilanz im Ligavergleich: ${formatObjectiveMoney(current)} — Rang ${standing.rank} von ` +
          `${standing.teamCount}, Ligamedian ${formatObjectiveMoney(standing.median)}. Gefordert ist ` +
          `ein Platz ${target.bandPhrase} (Rang ${target.targetRank} oder besser).`,
    actionHint:
      "Die Bilanz zählt, nicht der Verzicht: Verkäufe zum richtigen Zeitpunkt wiegen teure Neuzugänge auf.",
    targetValue: target.targetRank,
    currentValue: standing.rank,
    status,
    rewardCash: status === "completed" ? 4 : undefined,
    penaltyCash: status === "failed" ? 3 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.4 : status === "failed" ? -0.5 : status === "at_risk" ? -0.15 : 0,
    source: "board_v2_net_transfer_balance",
  };
}

/**
 * V2 roster goal (replaces the trivial "roster >= N"): minimum share of non-reserve players
 * (superstar+star+core+depth via fixed market-value tiers) on the roster, nudged by ambition. This
 * is the organic composition metric — a team is judged on squad *quality mix*, not headcount. No
 * hard tier quotas: it's a share target the AI/human satisfies by buying real core/depth over reserve.
 */
function getRosterQualityCompositionObjective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
}): ObjectiveDraft {
  const brackets = buildLeagueMarketBrackets(
    input.gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null),
  );
  const rosterPlayerIds = new Set(
    input.gameState.rosters.filter((entry) => entry.teamId === input.team.teamId).map((entry) => entry.playerId),
  );
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const rosterPlayers = [...rosterPlayerIds].map((id) => playersById.get(id)).filter((player): player is NonNullable<typeof player> => Boolean(player));
  const rosterCount = rosterPlayers.length;
  const nonReserve = rosterPlayers.filter((player) => {
    const tier = classifyMarketBracket(player.marketValue ?? player.displayMarketValue ?? null, brackets);
    return tier !== "Reserve" && tier !== "Backup";
  }).length;
  const currentShare = rosterCount > 0 ? nonReserve / rosterCount : 0;
  const ambition = input.identity?.ambition ?? 5;
  const targetShare = clamp(
    BOARD_V2_COMPOSITION.baseCoreShare + (ambition - 5) * BOARD_V2_COMPOSITION.perAmbitionShare,
    BOARD_V2_COMPOSITION.minCoreShare,
    BOARD_V2_COMPOSITION.maxCoreShare,
  );
  const status = statusForMin(currentShare, targetShare);
  return {
    objectiveId: "roster-quality-composition",
    category: "roster",
    label: `Kaderqualität: ≥ ${Math.round(targetShare * 100)}% Kern/Depth/Star`,
    detail: `Aktuell ${Math.round(currentShare * 100)}% Nicht-Reserve (${nonReserve}/${rosterCount}).`,
    targetValue: roundValue(targetShare, 2),
    currentValue: roundValue(currentShare, 2),
    status,
    boardConfidenceDelta: status === "completed" ? 0.3 : status === "failed" ? -0.6 : status === "at_risk" ? -0.15 : 0,
    source: "board_v2_roster_quality_composition",
  };
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

export function getAxisRankObjective(input: {
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

  const ambitionTarget = explicitPowerChase || explicitMentalChase || bias >= 9 || ambition >= 8 ? 5 : 8;
  const meta = AXIS_OBJECTIVE_META[axis];
  const rank = getAxisRank({ teamId: input.team.teamId, rowsByTeamId: input.rowsByTeamId, axis });
  // ERREICHBARKEIT: der Zielrang war fest 5 bzw. 8 — allein aus Ambition/Bias, ohne Blick darauf, wo das
  // Team auf dieser Achse überhaupt steht. Ein ehrgeiziges Team auf POW-Rang 28 bekam so "Power Top 5",
  // ein Ziel, das ein Kader in einer Saison nicht aufholt. Der Vorstand fordert jetzt höchstens den
  // gleichen Sprung, den er auch beim Ligarang fordert (BOARD_V2_CALIBRATION.maxStretch Plätze) — für
  // Teams, die ohnehin schon in Reichweite sind, bleibt die alte Ambitionsmarke unverändert stehen.
  const stretch = BOARD_V2_CALIBRATION.maxStretch;
  const targetRank =
    rank.rank == null
      ? ambitionTarget
      : clamp(Math.max(ambitionTarget, rank.rank - stretch), 1, Math.max(1, rank.teamCount));
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
    rankTarget: true,
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
    rankTarget: true,
    source: "team_profile_allround_axis_goal",
  };
}

function getFacilityObjective(gameState: GameState, team: Team, profile: TeamStrategyProfile | null): ObjectiveDraft {
  const facilities = gameState.seasonState.teamFacilities?.[team.teamId]?.facilities ?? {};
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const developmentTendency = getTeamDevelopmentTendency({ team, identity, profile });
  const wantsRecovery =
    (profile?.strategySummary ?? "").toLowerCase().includes("risk") ||
    (profile?.bias?.riskTolerance ?? 5) >= 8;
  const facilityId = wantsRecovery ? "recovery_center" : "training_center";
  const level = facilities[facilityId]?.level ?? 0;
  const targetLevel = wantsRecovery
    ? 1
    : Math.max(1, Math.round(developmentTendency.trainingFacilityTargetLevel));
  const developmentFocused = !wantsRecovery && developmentTendency.score >= 0.35;
  return {
    objectiveId: `facility-${facilityId}`,
    category: "facility",
    label: developmentFocused
      ? `Trainingszentrum L${targetLevel} (Entwicklung)`
      : wantsRecovery
        ? "Recovery Center aufbauen"
        : "Trainingszentrum aufbauen",
    targetValue: `Level >= ${targetLevel}`,
    currentValue: level,
    status: level >= targetLevel ? "completed" : level >= targetLevel - 1 ? "at_risk" : "open",
    rewardCash: roundValue(3 + developmentTendency.score * 2, 0),
    boardConfidenceDelta: level >= targetLevel ? 0.3 : 0,
    source: developmentFocused ? "team_development_tendency" : "facility_strategy_profile",
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

/**
 * FORMKARTEN-AUSBEUTE im Ligavergleich.
 *
 * VORHER: „Formfarben abdecken — 3+ Farben". Am Live-Save gemessen: 32 von 32 Teams erfüllt. Genau
 * die Sorte Ziel, die der V2-Umbau laut eigenem Kommentar abschaffen sollte (`cash-positive`,
 * `roster >= N`) — es fragt nicht nach Leistung, sondern danach, ob überhaupt gespielt wurde.
 *
 * JETZT wird der NENNWERT der AUSGESPIELTEN Karten gezählt und gegen die Liga gestellt. Das ist die
 * Größe, die auf dem Spieltag wirkt, und sie trennt die Teams tatsächlich: wer seine Karten setzt
 * statt sie verfallen zu lassen, steht vorn.
 *
 * GEZÄHLT WIRD ÜBER `buildSeasonFormCardBonusByTeamId` — dieselbe Quelle, aus der die Spalte
 * „Formkarten" im Saisonstand kommt. Das ist keine Bequemlichkeit: die Karten liegen paarweise im
 * Spielstand (zu jeder +8 gehört eine −8 desselben Spielers), die reine Summe über `formCards` ist
 * deshalb per Konstruktion 0. Nur die Zuordnung über die Aufstellungen (`lineupDrafts`) weiss, WELCHE
 * Karte wirklich aufs Feld kam. Eine zweite eigene Rechnung hier hätte still 0 für die ganze Liga
 * gemeldet — nachgemessen am Live-Save genau so passiert.
 *
 * SOLANGE NIEMAND GESPIELT HAT, steht das Ziel auf „offen" statt auf „erfüllt". Über den Rang
 * allein wäre am ersten Spieltag die ganze Liga bei 0 gleichauf — also alle auf Rang 1 und alle
 * erfüllt. Das wäre der alte Fehler in neuem Gewand.
 */
function getFormColorObjective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
}): ObjectiveDraft {
  const bonusByTeamId = buildSeasonFormCardBonusByTeamId(input.gameState, input.gameState.season.id);
  // Teams ohne Eintrag haben noch keine Karte gespielt — das ist eine 0, keine Lücke: sie hatten
  // dieselbe Gelegenheit wie alle anderen.
  const valueByTeamId = new Map<string, number>(
    input.gameState.teams.map((team) => [team.teamId, bonusByTeamId.get(team.teamId)?.total ?? 0]),
  );
  const gespielteKarten = [...bonusByTeamId.values()].reduce((sum, entry) => sum + entry.cards, 0);

  const standing = buildLeagueMetricStanding({
    teamId: input.team.teamId,
    values: [...valueByTeamId.entries()].map(([teamId, value]) => ({ teamId, value })),
    direction: "higher_is_better",
  });
  const target = resolveLeagueRankTarget({
    teamCount: standing.teamCount,
    demand: input.identity?.ambition ?? 5,
  });
  const status =
    gespielteKarten === 0
      ? ("open" satisfies TeamSeasonObjectiveStatus)
      : statusForLeagueRank({ rank: standing.rank, targetRank: target.targetRank, teamCount: standing.teamCount });

  return {
    objectiveId: "roster-form-color-cover",
    category: "roster",
    label: `Formkarten-Ausbeute: Ligarang ${target.bandPhrase}`,
    detail:
      gespielteKarten === 0
        ? "Nennwert der in dieser Saison ausgespielten Formkarten, verglichen mit der Liga. Es wurde noch keine Karte gespielt."
        : `Nennwert der ausgespielten Formkarten: ${formatObjectiveMoney(standing.value)} — Rang ${standing.rank} von ` +
          `${standing.teamCount}, Ligamedian ${formatObjectiveMoney(standing.median)}. Gefordert ist ` +
          `ein Platz ${target.bandPhrase} (Rang ${target.targetRank} oder besser).`,
    actionHint:
      "Formkarten wirken am Spieltag: starke Karten dort setzen, wo die Disziplin zum Spieler passt, statt sie verfallen zu lassen.",
    targetValue: target.targetRank,
    currentValue: gespielteKarten === 0 ? null : standing.rank,
    status,
    boardConfidenceDelta: status === "completed" ? 0.2 : status === "failed" ? -0.2 : 0,
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
    rankTarget: true,
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
    rankTarget: true,
    source: ranks.length ? "player_discipline_performance_rank" : "player_performance_pending",
  };
}

export function getMatchdayMedalObjective(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
}): ObjectiveDraft | null {
  const ambition = input.identity?.ambition ?? 5;
  const starPriority = input.profile?.bias.starPriority ?? ambition;
  const scheduled = input.gameState.season.matchdayIds?.length ?? 0;
  if (scheduled < 1 || (ambition < 6 && starPriority < 7)) return null;
  // STÄRKE-GATE: eine Spieltagsmedaille ist ein Top-3-Platz in der Teamwertung EINES Spieltags. Das Ziel
  // hing bisher allein an Ambition/Star-Priorität — ein ehrgeiziges, sportlich aber schwaches Team bekam
  // damit eine über die ganze Saison unerreichbare Vorgabe (gemessen: "0, bestes Team-Rank #5 · Ziel 1"
  // bei Liga-Rang 19). Wer nach Stärke-Erwartung nicht in Medaillennähe steht, bekommt sie gar nicht erst.
  const leagueSize = Math.max(1, input.rowsByTeamId.size);
  const expectedRank = clamp(
    resolveExpectedLeagueRank({ teamId: input.team.teamId, rowsByTeamId: input.rowsByTeamId }),
    1,
    leagueSize,
  );
  const eligibleRank = Math.max(
    BOARD_V2_MEDALS.eligibleExpectedRankFloor,
    Math.ceil(leagueSize * BOARD_V2_MEDALS.eligibleExpectedRankFraction),
  );
  if (expectedRank > eligibleRank) return null;
  const doubleRank = Math.max(1, Math.ceil(leagueSize * BOARD_V2_MEDALS.doubleTargetExpectedRankFraction));
  // Zwei Medaillen fordert der Vorstand nur von der echten Spitze — der frühere shortCode-Sonderfall
  // (M-M / Z-H) hing an Teamnamen statt an Stärke und verlangte das auch von einem abgestürzten Titelteam.
  const target = expectedRank <= doubleRank && (ambition >= 8 || starPriority >= 8) ? 2 : 1;
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
    rankTarget: true,
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
    rankTarget: true,
    source: summary.bestRank == null ? "player_performance_pending" : "player_discipline_performance_rank",
  };
}

function getRebuildCashObjective(input: {
  team: Team;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  /** `false` = die Einnahmen der Saison sind noch nicht gebucht, der Wert ist eine Hochrechnung. */
  settled: boolean;
}): ObjectiveDraft | null {
  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const ambition = input.identity?.ambition ?? 5;
  if (cashPriority < 8 && ambition > 4) return null;

  // GEMESSEN am Live-Save: die alte feste Marke „65 % des Budgets" traf drei Teams mit 8,7 / 35,6 /
  // −1,2 Cash gegen Vorgaben von 159,3 / 136,5 / 195 — allesamt unerreichbar, weil Cash mitten in
  // der Saison am Boden liegt und die Einnahmen erst am Ende kommen. Der Puffer wird deshalb gegen
  // die LIGA gemessen: wer im Vergleich zu den anderen 31 Teams liquide dasteht, hat den Puffer.
  const standing = buildLeagueMetricStanding({
    teamId: input.row.teamId,
    values: [...input.rowsByTeamId.values()].map((row) => ({ teamId: row.teamId, value: row.cash ?? null })),
    direction: "higher_is_better",
  });
  const target = resolveLeagueRankTarget({ teamCount: standing.teamCount, demand: cashPriority });
  const rawStatus = statusForLeagueRank({ rank: standing.rank, targetRank: target.targetRank, teamCount: standing.teamCount });
  // Wie beim Gehaltsziel: ein Konto im Minus ist keine Hochrechnung, sondern ein Befund.
  const cashDistress = isCashDistress(input.row.cash);
  const provisional = !input.settled && !cashDistress;
  const status = cashDistress
    ? ("failed" satisfies TeamSeasonObjectiveStatus)
    : provisional
      ? capProvisionalObjectiveStatus(rawStatus)
      : rawStatus;

  return {
    objectiveId: "finance-rebuild-cash-buffer",
    category: "finance",
    // Das Label nennt jetzt IMMER die gemessene Größe. Vorher hiess dasselbe Ziel bei niedriger
    // cashPriority „Rebuild-Kosten klein halten" — gemessen wurde aber der Cashbestand, nicht die
    // Kosten. Wer das Label las, suchte eine Ausgabengrenze, die es nie gab.
    label: `Cashpuffer: Ligarang ${target.bandPhrase}`,
    detail:
      standing.rank == null
        ? "Cashbestand im Ligavergleich. Es fehlen Cash-Daten."
        : `Cashbestand im Ligavergleich: ${formatObjectiveMoney(standing.value)} — Rang ${standing.rank} von ` +
          `${standing.teamCount}, Ligamedian ${formatObjectiveMoney(standing.median)}. Gefordert ist ` +
          `ein Platz ${target.bandPhrase} (Rang ${target.targetRank} oder besser).` +
          (provisional ? " Hochrechnung: die Einnahmen der Saison sind noch nicht gebucht." : "") +
          (cashDistress ? " Das Konto steht im Minus — der Puffer ist damit unabhängig vom Rang verfehlt." : ""),
    actionHint:
      "Liquide bleiben heisst nicht sparen um jeden Preis: Verkäufe zum richtigen Zeitpunkt, keine Gehälter, die den Puffer über die Saison aufzehren.",
    targetValue: target.targetRank,
    currentValue: standing.rank,
    status,
    rewardCash: status === "completed" ? 3 : undefined,
    penaltyCash: status === "failed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.35 : status === "failed" ? -0.45 : -0.1,
    provisional,
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
    rankTarget: true,
    source: `team_rivalry_matrix:${rivalry.rivalryId}`,
  };
}

function resolveSeasonNumberFromState(gameState: GameState) {
  const fromId = /season-(\d+)/i.exec(gameState.season.id)?.[1];
  const fromName = /season\s+(\d+)/i.exec(gameState.season.name)?.[1];
  const parsed = Number(fromId ?? fromName);
  return Number.isFinite(parsed) ? parsed : null;
}

const SEASON_ONE_PRESEASON_BOARD_NEUTRAL_PHASES = new Set<GamePhase>([
  "season_end_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
]);

export function isSeasonOnePreseasonNeutralBoard(gameState: GameState): boolean {
  if (resolveSeasonNumberFromState(gameState) !== 1) {
    return false;
  }
  const gamePhase = gameState.gamePhase ?? "season_active";
  return SEASON_ONE_PRESEASON_BOARD_NEUTRAL_PHASES.has(gamePhase);
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

/**
 * Regel über das Spiel (Chris): Der Vorstand kann pro Saison nicht zwei Rang-Ziele gleichzeitig
 * verlangen. Das erste vergebene Rang-Ziel bleibt verbindlich — es ist der Slot-1-Sportauftrag, an
 * dem die Saison gemessen wird. Jedes weitere Rang-Ziel im Slate wird zum optionalen Zusatzziel:
 * Es kann Bonus bringen, kostet aber weder Cash noch Vorstandsvertrauen, wenn es verfehlt wird.
 *
 * Das ist eine Entscheidung der VERGABE. Wie ein einzelnes Ziel gegen seine Marke gewertet wird,
 * bleibt unverändert — ein herabgestuftes Ziel zeigt weiter seinen echten Stand, nur ohne Strafe.
 */
function demoteExtraRankTargets(picked: ObjectiveDraft[]): ObjectiveDraft[] {
  let bindingRankTargetTaken = false;
  return picked.map((objective) => {
    if (!objective.rankTarget) return objective;
    if (!bindingRankTargetTaken) {
      bindingRankTargetTaken = true;
      return objective;
    }
    return {
      ...objective,
      optional: true,
      label: `${objective.label} (optional)`,
      penaltyCash: undefined,
      // Bonus bleibt, Abzug entfällt: ein Zusatzziel darf das Vertrauen nur heben.
      boardConfidenceDelta: Math.max(0, objective.boardConfidenceDelta ?? 0),
    };
  });
}

export function selectBoardObjectiveDrafts(input: {
  objectives: ObjectiveDraft[];
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  slateSize?: number;
}) {
  // F4: slate size is dynamic under V2 (3–5 by disposition); defaults to the legacy fixed 4.
  const slateSize = input.slateSize ?? 4;
  const picked: ObjectiveDraft[] = [];
  const add = (objective: ObjectiveDraft | null) => {
    if (!objective || picked.some((entry) => entry.objectiveId === objective.objectiveId)) return;
    if (picked.length < slateSize) picked.push(objective);
  };

  // Slot 1 (primary sport goal): the expectation-rank objective — "beat the finish your squad
  // strength predicts" — replaces the fixed sport-rank-X target for every team. sport-rank-X
  // remains only as an immediate fallback (expectation-rank currently always returns non-null,
  // so in practice it wins slot 1).
  const expectationRankPicked = pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "expectation-rank");
  add(
    expectationRankPicked ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId.startsWith("sport-rank-")),
  );

  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const urgentEconomy =
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-cash-positive" && objective.status === "failed") ??
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "transfer-profit" && cashPriority >= 8) ??
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-rebuild-cash-buffer") ??
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-salary-ratio" && objective.status !== "completed") ??
    pickUrgentObjective(input.objectives, "finance");
  add(urgentEconomy);

  add(
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "roster-form-color-cover") ??
      pickUrgentObjective(input.objectives, "roster"),
  );

  add(
    pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-axis-allround-tophalf" && objective.status !== "completed") ??
      pickFirstObjective(
        input.objectives,
        (objective) =>
          objective.objectiveId.startsWith("sport-axis-rank-") &&
          objective.source === "team_signature_axis_rank_goal",
      ) ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-axis-allround-tophalf") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top20-breakthrough") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-matchday-medals" && objective.status !== "open") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top20-repeat") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-matchday-medals") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top50-season") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "player-top5-discipline-star") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-signature-wins" && objective.status !== "open") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-upset-avoidance" && objective.status !== "open") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId.startsWith("rivalry-")) ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId.startsWith("sport-axis-")) ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "finance-transfer-ceiling" && objective.status !== "open") ??
      pickFirstObjective(input.objectives, (objective) => objective.objectiveId === "sport-next-matchday-top10") ??
      pickUrgentObjective(input.objectives, "morale") ??
      pickUrgentObjective(input.objectives, "facility") ??
      pickUrgentObjective(input.objectives, "development"),
  );

  for (const objective of input.objectives) {
    // Once expectation-rank holds the sport slot, skip the redundant fixed sport-rank-X target
    // from the general fill loop — both are sport-category rank objectives.
    if (expectationRankPicked && objective.objectiveId.startsWith("sport-rank-")) continue;
    add(objective);
  }

  return demoteExtraRankTargets(picked);
}

function buildSponsorObjectiveDrafts(input: {
  gameState: GameState;
  team: Team;
  row: TeamManagementSnapshotRow;
}): ObjectiveDraft[] {
  const contract = getTeamSponsorContract(input.gameState, input.team.teamId);
  if (!contract) {
    return [
      {
        objectiveId: "sponsor-choice-pending",
        category: "sponsor",
        label: "Sponsor-Vertrag wählen",
        targetValue: "1 von 3 Angeboten",
        currentValue: "offen",
        status: "open",
        actionHint: "Pre-Season oder Team-Board: einen von drei Sponsoren auswählen.",
        source: "sponsor_v2_choice_pending",
      },
    ];
  }

  return contract.components.map((component) => {
    if (component.kind === "base") {
      return {
        objectiveId: `sponsor-${component.componentId}`,
        category: "sponsor",
        label: component.label,
        targetValue: component.targetValue,
        currentValue: contract.payouts.baseFirstPaid ? "1. Rate gezahlt" : "ausstehend",
        status: contract.payouts.baseSecondPaid ? "completed" : contract.payouts.baseFirstPaid ? "open" : "open",
        rewardCash: component.rewardCash,
        boardConfidenceDelta: 0.2,
        source: "sponsor_v2_contract",
      };
    }
    if (component.kind === "rank") {
      if (contract.sponsorV3) {
        // SPONSOR V3/V4: die Rang-Komponente ist KEINE Zielmarke, sondern die gestaffelte
        // Auszahlungsleiter — jeder Endrang von 1 bis 32 zahlt, nur unterschiedlich viel. Ihr
        // `targetValue` steht auf 1, weil Rang 1 die oberste Sprosse ist. Als Board-Ziel gespiegelt
        // wurde daraus "Ziel Top 1", das 31 von 32 Teams jede Saison verfehlen — inklusive
        // Inbox-Meldung "Board-Ziel verfehlt" und −0,35 Vorstandsvertrauen für ein Team, das nie
        // Titelanwärter war. Die Leiter wird deshalb nur noch informativ gespiegelt: sichtbarer
        // Zwischenstand, aber kein verbindliches Ziel und keine Vertrauenswirkung.
        return {
          objectiveId: `sponsor-${component.componentId}`,
          category: "sponsor",
          label: component.label,
          detail: "Zahlt auf jeder Stufe — je besser der Endrang, desto höher die Sponsorenprämie. Kein Pass-/Fail-Ziel.",
          targetValue: "gestaffelt nach Endrang",
          currentValue: input.row.rank != null ? `Rang ${input.row.rank}` : "—",
          status: "open",
          optional: true,
          rewardCash: component.rewardCash,
          boardConfidenceDelta: 0,
          source: "sponsor_v2_contract",
        };
      }
      const target = typeof component.targetValue === "number" ? component.targetValue : 16;
      const status = evaluateSponsorRankObjective(input.row.rank ?? null, target);
      return {
        objectiveId: `sponsor-${component.componentId}`,
        category: "sponsor",
        label: component.label,
        targetValue: `Top ${target}`,
        currentValue: input.row.rank ?? "—",
        status,
        rewardCash: component.rewardCash,
        penaltyCash: component.penaltyCash,
        boardConfidenceDelta: status === "completed" ? 0.35 : status === "failed" ? -0.35 : 0,
        source: "sponsor_v2_contract",
      };
    }
    if (component.kind === "improvement") {
      const target = typeof component.targetValue === "number" ? component.targetValue : 2;
      const improvement =
        contract.startRank != null && input.row.rank != null ? contract.startRank - input.row.rank : null;
      const status = evaluateSponsorImprovementObjective(contract.startRank, input.row.rank ?? null, target);
      return {
        objectiveId: `sponsor-${component.componentId}`,
        category: "sponsor",
        label: component.label,
        targetValue: `+${target}`,
        currentValue: improvement == null ? "—" : `+${improvement}`,
        status,
        rewardCash: component.rewardCash,
        boardConfidenceDelta: status === "completed" ? 0.3 : 0,
        source: "sponsor_v2_contract",
      };
    }
    /**
     * GEMELDET VON CHRIS: „Ich habe als Saisonziel den Ausbau von 2 Gebäuden meiner Wahl — das habe
     * ich bereits erledigt. Da würde ich erwarten, dass das Ziel schon als abgeschlossen da steht."
     *
     * HIER STAND `evaluateSpecialComponentForObjective` — der BINAERE Alt-Bewerter. Er kennt die
     * V4-Zielachsen nicht und faellt fuer jede von ihnen bis zum abschliessenden `return "open"`
     * durch: ein Achsen-Ziel konnte auf dem Board NIE erfuellt aussehen. Dazu wurde der rohe
     * `targetValue` durchgereicht, sodass auf Chris' Bildschirm woertlich
     * `axisbase:2;axisscale:2;axisoffset:0` stand.
     *
     * `beschreibeSonderziel` liest denselben Stufen-Bewerter, aus dem auch die Abrechnung ihr Geld
     * zieht (`evaluateSpecialComponentStage`) — Anzeige und Auszahlung koennen damit nicht mehr
     * auseinanderlaufen.
     */
    const sonderziel = beschreibeSonderziel(input.gameState, input.team.teamId, component);
    return {
      objectiveId: `sponsor-${component.componentId}`,
      category: "sponsor",
      label: component.label,
      targetValue: sonderziel.zielText ?? component.targetValue,
      currentValue: sonderziel.standText,
      status: sonderziel.status,
      rewardCash: component.rewardCash,
      boardConfidenceDelta: sonderziel.status === "completed" ? 0.4 : 0,
      source: "sponsor_v2_contract",
    };
  });
}

/**
 * VERGABE UND BEWERTUNG SIND ZWEI VERSCHIEDENE DINGE.
 *
 * Ein Vorstand vergibt seine Saisonziele einmal und misst sie danach. Der Generator hier lieferte
 * beides in einem Aufruf: er baute den Kandidaten-Pool, wählte daraus einen Slate von 3–5 Zielen und
 * gab NUR den Slate zurück. Der Merge (`mergeStoredTeamObjectives`) verglich den gespeicherten
 * Bestand gegen diesen Slate — und warf jedes gespeicherte Ziel weg, das der Slate gerade nicht mehr
 * enthielt. Da die Slate-Auswahl status-abhängig ist (`status !== "completed"`, `pickUrgentObjective`)
 * und die Slate-GRÖSSE am Vorstandsdruck hängt, wählte genau der Moment der Erfüllung ein Ziel ab.
 * Der nächste Refresh löschte es dann samt Reward — am Live-Abbild gemessen: 225 → 222 Ziele, alle
 * drei bereits erfüllt, 11 C Abrechnungswirkung weg.
 *
 * Darum liefert der Generator jetzt beides getrennt:
 *   - `slate`  — die VERGABE: nur beim ersten Mal (noch kein gespeicherter Bestand für die Saison).
 *   - `pool`   — die BEWERTUNG: alle Kandidaten VOR der Auswahl, gegen die ein gespeichertes Ziel
 *                seinen frischen Stand bekommt, egal ob der Slate es heute noch wählen würde.
 *   - `eventAdditions` — die einzigen Ziele, die einem laufenden Bestand noch zuwachsen dürfen
 *                (Sponsor-Spiegel nach der Unterschrift, Budget-Kürzung des Vorstands).
 */
type TeamObjectiveGeneration = {
  slate: TeamSeasonObjectiveRecord[];
  pool: TeamSeasonObjectiveRecord[];
  eventAdditions: TeamSeasonObjectiveRecord[];
};

function buildTeamObjectives(input: {
  gameState: GameState;
  team: Team;
  row: TeamManagementSnapshotRow;
  rowsByTeamId: Map<string, TeamManagementSnapshotRow>;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): TeamObjectiveGeneration {
  const { gameState, team, row, rowsByTeamId, identity, profile } = input;
  const boardV2 = isBoardObjectivesV2Enabled();
  const previousSeasonBoard = gameState.seasonState.previousSeasonBoardConfidence?.[team.teamId] ?? null;
  const storedBoard = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
  const disposition = boardV2 ? resolveBoardDisposition({ identity, previousSeasonBoard }) : null;
  const sportTarget = boardV2
    ? getSportTargetV2({ identity, teamId: team.teamId, rowsByTeamId, ambition01: disposition?.ambition })
    : getSportTarget({ team, identity, profile, row, rowsByTeamId });
  // F4: dynamic slate size 3–5 from disposition ambition + last-known perceived pressure.
  const slateSize = disposition
    ? clamp(
        BOARD_V2_SLATE.minSize +
          Math.round(
            (BOARD_V2_SLATE.maxSize - BOARD_V2_SLATE.minSize) *
              (0.5 * disposition.ambition + 0.5 * ((storedBoard?.perceivedPressure ?? storedBoard?.pressure ?? 5) / 10)),
          ),
        BOARD_V2_SLATE.minSize,
        BOARD_V2_SLATE.maxSize,
      )
    : 4;
  const seasonNum = resolveSeasonNumberFromState(gameState) ?? 1;
  const isInitialSeason = seasonNum === 1;
  // Eine Quelle für „Hochrechnung oder Ergebnis" — beide cash-abhängigen Finanzziele lesen sie.
  const seasonIncomeBooked = hasSeasonIncomeBeenBooked(gameState);
  // C-C and high-profit teams have a transfer target that scales up over seasons.
  const isHighProfitTeam = team.shortCode === "C-C" || (profile?.bias.sellForProfitAggression ?? 0) >= 8;
  const transferProfitTarget = isHighProfitTeam
    ? (seasonNum <= 2 ? 10 : seasonNum === 3 ? 15 : 20)
    : 0;
  const transferObjective: ObjectiveDraft | null = isInitialSeason
    ? null
    : {
        objectiveId: "transfer-profit",
        category: "transfer",
        label: transferProfitTarget > 0 ? `Transfergewinn von ${transferProfitTarget}M erzielen` : "Transferbilanz stabil halten",
        targetValue: transferProfitTarget,
        currentValue: row.transferNet,
        status: statusForMin(row.transferNet, transferProfitTarget),
        rewardCash: transferProfitTarget > 0 ? 5 : undefined,
        penaltyCash: transferProfitTarget > 0 ? 3 : undefined,
        boardConfidenceDelta: (row.transferNet ?? 0) >= transferProfitTarget ? 0.35 : -0.35,
        source: "local_transfer_history",
      };
  const candidateDrafts: ObjectiveDraft[] = [
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
        rankTarget: true,
        source: "team_identity_ambition_current_rank",
      },
      getPreferredAxisObjective({ team, identity, profile, row }),
      getAxisRankObjective({ team, identity, profile, rowsByTeamId }),
      getAllRoundAxisObjective({ team, identity, profile, rowsByTeamId }),
      // From origin/main: richer board objective slate.
      // V2: die tatsächlich gewertete Slot-1-Sportvorgabe (expectation-rank) trägt jetzt den stärke-
      // kalibrierten V2-Zielrang (getSportTargetV2 mit BOARD_V2_CALIBRATION + Dispositions-Ambition)
      // statt des statischen identity.ambition-Ziels. Bisher wurde sportTarget nur in den stets
      // verworfenen sport-rank-* Draft eingebettet — die V2-Kalibrierung erreichte das gewertete Ziel nie.
      getExpectationRankObjective({
        team,
        identity,
        profile,
        row,
        rowsByTeamId,
        targetRankOverride: boardV2 ? sportTarget.rank : null,
      }),
      getUpsetAvoidanceObjective({ team, identity, profile, row, rowsByTeamId, gameState }),
      getTransferSpendCeilingObjective({ team, identity, profile, row, rowsByTeamId }),
      getSignatureAxisWinObjective({ team, identity, profile, gameState }),
      // From the balancing branch: V2 replaces the tautological "cash > 0" with a real
      // net-transfer-balance goal; V1 keeps the plain cash-positive objective (so no duplicate with the
      // standalone cash-positive that origin/main added — this conditional subsumes it).
      boardV2
        ? getNetTransferBalanceObjective({ team, row, rowsByTeamId, profile, seasonNum })
        : {
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
      buildSalaryPressureObjective({ row, rowsByTeamId, identity, profile, settled: seasonIncomeBooked }),
      transferObjective,
      // From the balancing branch: V2 adds a composition-quality (non-reserve share) roster goal. The old
      // V1 "roster >= N" objective (getRosterTarget) was removed on origin/main, so V1 now has no roster
      // objective here — null is filtered out of the slate below.
      boardV2 ? getRosterQualityCompositionObjective({ gameState, team, identity }) : null,
      getFormColorObjective({ gameState, team, identity }),
      getNextMatchdayTop10Objective(gameState, team),
      getMatchdayMedalObjective({ gameState, team, identity, profile, rowsByTeamId }),
      getFacilityObjective(gameState, team, profile),
      getDevelopmentObjective(gameState, row, team),
      getTeamMoraleObjective({ gameState, team, identity, profile }),
      getPlayerTop20Objective({ gameState, team, identity, profile }),
      getPlayerTop50Objective({ gameState, team, identity, profile }),
      getTopPlayerObjective({ gameState, team, identity, profile }),
      getRebuildCashObjective({ team, row, rowsByTeamId, identity, profile, settled: seasonIncomeBooked }),
      getRivalryObjective({ gameState, team, row, rowsByTeamId }),
    ].filter((objective): objective is ObjectiveDraft => Boolean(objective));
  const objectiveDrafts = selectBoardObjectiveDrafts({
    identity,
    profile,
    slateSize,
    objectives: candidateDrafts,
  });
  const sponsorDrafts = buildSponsorObjectiveDrafts({ gameState, team, row });

  // For human-controlled teams: if board confidence fell below 5.0 last season,
  // the board cuts the budget at season end. This prevents riskless eco rounds.
  const boardConfidencePenaltyDraft = ((): ObjectiveDraft | null => {
    if (!team.humanControlled || isInitialSeason) return null;
    const storedConfidence = gameState.seasonState.boardConfidence?.[team.teamId]?.value ?? null;
    if (storedConfidence == null || storedConfidence >= 5.0) return null;
    const penaltyCash = Math.round(Math.max(2, Math.min(10, (5.0 - storedConfidence) * 3.3)));
    const currentPct = roundValue(storedConfidence * 10, 0);
    return {
      objectiveId: "board-confidence-budget-cut",
      category: "finance",
      label: "Vorstandsvertrauen wiederherstellen",
      detail: `Board Confidence ${currentPct}% — Ziel ≥ 50%. Fehlgeschlagene Saisonziele haben das Vertrauen des Vorstands geschwächt.`,
      actionHint: `Der Vorstand kürzt das Budget um ${penaltyCash}M. Erfülle deine Saisonziele, um den Druck zu reduzieren.`,
      targetValue: 5.0,
      currentValue: storedConfidence,
      status: "failed",
      penaltyCash,
      boardConfidenceDelta: 0,
      source: "human_board_confidence_penalty",
    };
  })();

  // `rankTarget` ist reine Vergabe-Information (welche Ziele um das eine verbindliche Rang-Ziel
  // konkurrieren) und wandert nicht in den Spielstand — dort zählt nur noch `optional`.
  const toRecord = (drafts: ObjectiveDraft[]): TeamSeasonObjectiveRecord[] =>
    drafts.map(({ rankTarget: _rankTarget, ...objective }) => ({
      seasonId: gameState.season.id,
      teamId: team.teamId,
      source: objective.source ?? "board_objective_generator_v1",
      ...objective,
    }));

  // Ereignis-Zugänge: der Sponsor-Spiegel entsteht mit der Unterschrift, die Budget-Kürzung mit dem
  // Vorstandsvertrauen unter 5,0. Nur diese beiden dürfen einem laufenden Bestand noch zuwachsen —
  // alles andere würde den Slate über die Saison aufblähen.
  const eventDrafts = [...(boardConfidencePenaltyDraft ? [boardConfidencePenaltyDraft] : []), ...sponsorDrafts];

  return {
    slate: toRecord([...objectiveDrafts, ...eventDrafts]),
    pool: toRecord([...candidateDrafts, ...eventDrafts]),
    eventAdditions: toRecord(eventDrafts),
  };
}

/**
 * Zwei Ziel-Familien tragen eine BEWEGLICHE Zielmarke in ihrer Kennung: `sport-rank-<rang>` und
 * `sport-axis-rank-<achse>-top-<rang>`. Der Zielrang wird bei jedem Refresh neu kalibriert — steigt
 * ein Team von Rang 5 auf Rang 10, heißt dasselbe Ziel plötzlich anders. Für den Merge war das ein
 * fremdes Ziel: das alte fiel weg, ein neues kam hinzu (am Abbild gemessen:
 * `T-G|sport-axis-rank-pow-top-5` → `sport-axis-rank-pow-top-10`, ein verfehltes Ziel mit
 * 2 C Strafe). Deshalb wird zusätzlich über das Familien-Präfix gematcht; die gespeicherte Kennung
 * bleibt die bei der Vergabe geschriebene, Zielmarke und Label werden erneuert.
 */
function objectiveFamilyPrefix(objectiveId: string): string | null {
  if (/^sport-rank-\d+$/.test(objectiveId)) return "sport-rank-";
  const axisRank = /^(sport-axis-rank-[a-z]+-top-)\d+$/.exec(objectiveId);
  if (axisRank) return axisRank[1];
  return null;
}

const SPONSOR_CHOICE_PENDING_SOURCE = "sponsor_v2_choice_pending";
const SPONSOR_CONTRACT_SOURCE = "sponsor_v2_contract";

function mergeStoredTeamObjectives(input: {
  gameState: GameState;
  teamId: string;
  generation: TeamObjectiveGeneration;
}) {
  const stored = (input.gameState.seasonState.teamSeasonObjectives ?? []).filter(
    (objective) => objective.seasonId === input.gameState.season.id && objective.teamId === input.teamId,
  );
  // ERSTE VERGABE: noch kein Bestand für diese Saison — der Vorstand stellt seinen Slate.
  // `stored.length === 0` und nicht `stored ?? []`: eine LEERE Liste ist nicht nullish, ein `??`
  // hätte hier nie gegriffen.
  if (stored.length === 0) {
    return input.generation.slate;
  }

  // BEWERTUNG eines laufenden Bestands: gegen den vollen Kandidaten-Pool, nicht gegen den Slate.
  const generated = input.generation.pool;
  const generatedById = new Map(generated.map((objective) => [objective.objectiveId, objective] as const));
  const generatedByFamily = new Map<string, TeamSeasonObjectiveRecord>();
  for (const objective of generated) {
    const family = objectiveFamilyPrefix(objective.objectiveId);
    if (family && !generatedByFamily.has(family)) generatedByFamily.set(family, objective);
  }
  const merged: TeamSeasonObjectiveRecord[] = [];
  const appendObjectiveSource = (source: string | null | undefined, nextSource: string) =>
    Array.from(new Set([...(source ?? "").split("+"), nextSource].map((entry) => entry.trim()).filter(Boolean))).join("+");
  const splitObjectiveSource = (source: string | null | undefined) =>
    (source ?? "").split("+").map((entry) => entry.trim()).filter(Boolean);
  // Labels, die der Generator selbst geschrieben hat, tragen die Zielmarke im Text ("Übertreffe die
  // Erwartung (Top 25)"). Zielmarke und Status werden hier bei jedem Refresh neu gerechnet — das
  // eingefrorene Label blieb dagegen stehen. Nach einer Neukalibrierung zeigte die Oberfläche darum
  // eine Marke an, gegen die längst nicht mehr gewertet wird: Endrang 21 unter dem Label "Top 25" und
  // trotzdem "verfehlt", weil real gegen "Top 10" gewertet wurde. Anzeige und Auswertung müssen
  // dieselbe Marke nennen, also wird ein Generator-Label zusammen mit seiner Zielmarke erneuert.
  // Fremde, im Spielstand hinterlegte Labels (eigene Board-Aufträge, andere Quelle) bleiben unangetastet.
  const isGeneratorAuthoredLabel = (
    storedObjective: TeamSeasonObjectiveRecord,
    generatedObjective: TeamSeasonObjectiveRecord,
  ) => {
    if (!generatedObjective.source) return false;
    return splitObjectiveSource(storedObjective.source).includes(generatedObjective.source);
  };
  // Der Sponsor-Platzhalter ist kein Ziel, sondern eine Aufforderung („Sponsor-Vertrag wählen"). Mit
  // der Unterschrift ersetzen ihn die drei Vertrags-Komponenten — er wird also nicht eingefroren,
  // sondern zurückgezogen. Das ist der einzige definierte ABGANG; er kostet nichts (kein Reward,
  // keine Strafe).
  const sponsorContractSigned = generated.some((objective) =>
    splitObjectiveSource(objective.source).includes(SPONSOR_CONTRACT_SOURCE),
  );
  const isRetiredSponsorPlaceholder = (objective: TeamSeasonObjectiveRecord) =>
    sponsorContractSigned && splitObjectiveSource(objective.source).includes(SPONSOR_CHOICE_PENDING_SOURCE);

  for (const storedObjective of stored) {
    if (isRetiredSponsorPlaceholder(storedObjective)) {
      continue;
    }
    const generatedObjective =
      generatedById.get(storedObjective.objectiveId) ??
      (() => {
        const family = objectiveFamilyPrefix(storedObjective.objectiveId);
        return family ? generatedByFamily.get(family) ?? null : null;
      })();

    // OHNE frischen Kandidaten: das Ziel bleibt mit seinem letzten Stand stehen. Früher warf ein
    // `continue` es hier weg — samt Reward eines längst ERFÜLLTEN Ziels. Ein einmal vergebenes Ziel
    // bleibt bis zur Abrechnung bestehen; dass es gerade nicht nachgerechnet werden kann, steht als
    // `status_stale` im Audit, statt still zu verschwinden.
    if (!generatedObjective) {
      merged.push({
        ...storedObjective,
        source: appendObjectiveSource(storedObjective.source, "status_stale"),
      });
      continue;
    }

    // Die Herabstufung zum Zusatzziel ist eine Entscheidung der VERGABE (siehe
    // `demoteExtraRankTargets`) und wird deshalb aus dem gespeicherten Stand übernommen, nicht neu
    // gefällt: der Kandidaten-Pool durchläuft die Auswahl gar nicht. Ohne diese Übernahme bekäme ein
    // einmal herabgestuftes Rang-Ziel seine Strafe zurück.
    const optional = storedObjective.optional === true;
    const generatedLabel = isGeneratorAuthoredLabel(storedObjective, generatedObjective)
      ? generatedObjective.label || storedObjective.label
      : storedObjective.label || generatedObjective.label;

    merged.push({
      ...storedObjective,
      // Die Kennung bleibt die bei der Vergabe geschriebene — auch wenn der Pool-Treffer über das
      // Familien-Präfix kam und heute eine andere Zielmarke im Namen trägt.
      objectiveId: storedObjective.objectiveId,
      label: optional && !generatedLabel.endsWith(" (optional)") ? `${generatedLabel} (optional)` : generatedLabel,
      targetValue: generatedObjective.targetValue,
      rewardCash: generatedObjective.rewardCash,
      penaltyCash: optional ? undefined : generatedObjective.penaltyCash,
      detail: generatedObjective.detail ?? storedObjective.detail ?? null,
      actionHint: generatedObjective.actionHint ?? storedObjective.actionHint ?? null,
      currentValue: generatedObjective.currentValue,
      status: generatedObjective.status,
      boardConfidenceDelta: optional
        ? Math.max(0, generatedObjective.boardConfidenceDelta ?? 0)
        : generatedObjective.boardConfidenceDelta,
      optional: storedObjective.optional,
      // „Hochrechnung" ist dagegen ein Stand, kein Vergabe-Entscheid: der eingefrorene Wert stammt
      // aus einem Moment, in dem die Einnahmen noch nicht gebucht waren. Bliebe er stehen, trüge das
      // Ziel den Hinweis auch noch in der Abrechnung, in der es längst feststeht.
      provisional: generatedObjective.provisional,
      source: appendObjectiveSource(storedObjective.source, "status_refresh"),
    });
  }

  // ZUGANG nur über die definierten Ereignisse. Der volle Pool darf hier NICHT einfließen, sonst
  // wüchse der Slate bei jedem Refresh um alle nicht gewählten Kandidaten.
  const vorhandeneIds = new Set(merged.map((objective) => objective.objectiveId));
  return [
    ...merged,
    ...input.generation.eventAdditions.filter((objective) => !vorhandeneIds.has(objective.objectiveId)),
  ];
}

export function calculateBoardConfidence(input: {
  teamId: string;
  identity: TeamIdentity | null;
  objectives: TeamSeasonObjectiveRecord[];
  storedBoard?: TeamBoardConfidenceRecord | null;
  previousSeasonBoard?: TeamBoardConfidenceRecord | null;
  gmChangedThisSeason?: boolean;
  neutralPreseasonBoard?: boolean;
  /**
   * Season 1 (no prior board record): every team starts at the neutral DEFAULT_BOARD_RATING (5/10)
   * instead of its identity.boardConfidence. Board trust is then earned through performance via the
   * objective deltas below. Only applies when there is no carried previous-season board value.
   */
  initialSeason?: boolean;
  /** Slice 4 (F2): team captain's leadership score; dampens perceivedPressure under V2. */
  captainLeadershipScore?: number | null;
}): TeamBoardConfidenceRecord {
  const boardV2 = isBoardObjectivesV2Enabled();
  if (input.neutralPreseasonBoard) {
    return {
      teamId: input.teamId,
      value: DEFAULT_BOARD_RATING,
      pressure: DEFAULT_BOARD_RATING,
      warnings: [],
      ...(boardV2 ? { perceivedPressure: DEFAULT_BOARD_RATING, pressureMomentum: 0 } : {}),
    };
  }
  const identitySeed = normalizeBoardConfidence(input.identity?.boardConfidence ?? input.storedBoard?.value ?? null);
  const prev = input.previousSeasonBoard?.value ?? null;
  let base: number;
  if (input.initialSeason && prev == null) {
    // S1-for-all: uniform neutral start (5/10) regardless of identity.boardConfidence. The objective
    // deltas below still move it within the season, so the opening rating is neutral but not frozen.
    base = DEFAULT_BOARD_RATING;
  } else if (prev != null && !input.gmChangedThisSeason) {
    // Same GM: carry over last season's final confidence, blended slightly toward the
    // identity seed to prevent permanent drift away from the team's natural level.
    base = roundValue(prev * 0.8 + identitySeed * 0.2, 1);
  } else if (prev != null && input.gmChangedThisSeason) {
    // New GM: reset toward identity seed with a small honeymoon boost (+0.5, capped at 10).
    base = Math.min(identitySeed + 0.5, 10);
  } else {
    base = identitySeed;
  }
  const delta = input.objectives.reduce((sum, objective) => sum + (objective.boardConfidenceDelta ?? 0), 0);
  // Optionale Zusatzziele (herabgestufte Rang-Ziele) erzeugen keinen Druck: Der Vorstand hat sie
  // nicht verlangt, also darf ihr Verfehlen weder Vertrauen kosten noch die Pressure hochtreiben.
  const bindingObjectives = input.objectives.filter((objective) => !objective.optional);
  const failed = bindingObjectives.filter((objective) => objective.status === "failed").length;
  const atRisk = bindingObjectives.filter((objective) => objective.status === "at_risk").length;
  const value = roundValue(clamp(base + delta, 1, 10), 1);
  const pressure = roundValue(clamp(11 - value + failed * 0.8 + atRisk * 0.35, 1, 10), 1);

  // V2 perceived-pressure layer: momentum-smoothed pressure minus a patience damp derived from the
  // board's temperament. Goals never move; only the *felt* pressure has its own (laggier) dynamics.
  // Slice 3 makes `patience` dynamic (disposition); here it's an identity-temperament proxy.
  let perceivedPressure: number | undefined;
  let pressureMomentum: number | undefined;
  if (boardV2) {
    const rawGap = failed * 0.8 + atRisk * 0.35;
    const prevMomentum = input.storedBoard?.pressureMomentum ?? rawGap;
    pressureMomentum = roundValue(0.6 * prevMomentum + 0.4 * rawGap, 2);
    // Slice 3 (F1): patience is now the dynamic disposition value — disappointment (low carried board
    // value) lowers it, so a struggling team's board escalates pressure faster.
    const patience = resolveBoardDisposition({ identity: input.identity, previousSeasonBoard: input.previousSeasonBoard }).patience;
    const patienceDamp = 2.5 * patience;
    // Slice 4 (F2): a strong captain absorbs pressure — lowers perceivedPressure (and thereby GM-firing
    // risk + AI panic, which read it). Goals are untouched.
    const captainDamp = clamp((input.captainLeadershipScore ?? 0) / BOARD_V2_CAPTAIN.leadershipDivisor, 0, BOARD_V2_CAPTAIN.maxDamp);
    perceivedPressure = roundValue(clamp(11 - value + pressureMomentum - patienceDamp - captainDamp, 1, 10), 1);
  }

  const effectivePressure = perceivedPressure ?? pressure;
  const warnings = [
    input.storedBoard ? "board_confidence_source_saved_state" : null,
    failed > 0 ? "board_objectives_failed" : null,
    atRisk > 0 ? "board_objectives_at_risk" : null,
    effectivePressure >= 8 ? "high_board_pressure" : null,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    teamId: input.teamId,
    value,
    pressure,
    warnings,
    ...(boardV2 ? { perceivedPressure, pressureMomentum } : {}),
  };
}

function hasRosterObjectiveRisk(_objectives: TeamSeasonObjectiveRecord[]) {
  // The dedicated "roster-optimum" board objective was removed, so roster size is
  // treated as on target and there is no remaining objective that signals
  // roster-size risk. This keeps buildAiBias's roster-urgency logic unaffected.
  return false;
}

function buildAiBias(input: {
  teamId: string;
  objectives: TeamSeasonObjectiveRecord[];
  board: TeamBoardConfidenceRecord;
}): TeamObjectiveAiBias {
  const hasFinanceRisk = input.objectives.some((objective) => objective.category === "finance" && objective.status !== "completed");
  const hasRosterRisk = hasRosterObjectiveRisk(input.objectives);
  const hasFacilityOpen = input.objectives.some((objective) => objective.category === "facility" && objective.status === "open");
  const hasDevelopmentOpen = input.objectives.some((objective) => objective.category === "development" && objective.status !== "completed");
  const hasMoraleRisk = input.objectives.some((objective) => objective.category === "morale" && objective.status !== "completed");
  const hasPlayerPeakNeed = input.objectives.some((objective) => objective.category === "player" && objective.status !== "completed");
  const hasMedalPushNeed = input.objectives.some((objective) => objective.objectiveId === "sport-matchday-medals" && objective.status !== "completed");
  const axisPriorities: Partial<Record<AxisKey, number>> = {};
  // Note: a "completed" axis objective still contributes a low, non-zero maintenance
  // priority (rather than being skipped entirely) so a team's identity-defining axis
  // remains visible in its AI bias even after the goal has been achieved.
  for (const objective of input.objectives) {
    const axisRankMatch = /^sport-axis-rank-(pow|spe|men|soc)-top-\d+$/.exec(objective.objectiveId);
    if (axisRankMatch?.[1]) {
      const axis = axisRankMatch[1] as AxisKey;
      const weight = objective.status === "failed" ? 0.95 : objective.status === "completed" ? 0.2 : 0.75;
      axisPriorities[axis] = Math.max(axisPriorities[axis] ?? 0, weight);
    }
    if (objective.objectiveId === "sport-axis-allround-tophalf") {
      const weight = objective.status === "failed" ? 0.45 : objective.status === "completed" ? 0.15 : 0.32;
      for (const axis of Object.keys(AXIS_OBJECTIVE_META) as AxisKey[]) {
        axisPriorities[axis] = Math.max(axisPriorities[axis] ?? 0, weight);
      }
    }
    const preferredAxisMatch = /^sport-axis-(pow|spe|men|soc)$/.exec(objective.objectiveId);
    if (preferredAxisMatch?.[1]) {
      const axis = preferredAxisMatch[1] as AxisKey;
      const weight = objective.status === "failed" ? 0.35 : objective.status === "completed" ? 0.1 : 0.22;
      axisPriorities[axis] = Math.max(axisPriorities[axis] ?? 0, weight);
    }
  }
  const hasAxisPushNeed = Object.values(axisPriorities).some((value) => (value ?? 0) >= 0.7);
  // V2: react to the perceived-pressure layer when present (falls back to raw pressure under V1).
  const pressureFactor = (input.board.perceivedPressure ?? input.board.pressure) / 10;
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
    // V2: exponiere die *gedämpfte* Wahrnehmungs-Pressure (Kapitän- und Dispositions-Dämpfung),
    // damit die vier AI-Panik-Gates dieselbe gefühlte Pressure sehen wie die Aggressions-Skalare
    // oben (~:1889). Fällt unter V1 auf die rohe Pressure zurück. Ziele bleiben unberührt.
    pressure: input.board.perceivedPressure ?? input.board.pressure,
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
  const warnings: string[] = [];
  const neutralPreseasonBoard = isSeasonOnePreseasonNeutralBoard(gameState);
  const initialSeason = (resolveSeasonNumberFromState(gameState) ?? 1) === 1;

  for (const team of gameState.teams) {
    const row = rowsByTeamId.get(team.teamId);
    if (!row) {
      warnings.push(`${team.teamId}:objective_row_missing`);
      continue;
    }

    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const profile = getTeamStrategyProfile(gameState, team.teamId);
    const generation = buildTeamObjectives({ gameState, team, row, rowsByTeamId, identity, profile });
    const teamObjectives = mergeStoredTeamObjectives({ gameState, teamId: team.teamId, generation });
    objectives.push(...teamObjectives);
    const storedBoard = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
    const previousSeasonBoard = gameState.seasonState.previousSeasonBoardConfidence?.[team.teamId] ?? null;
    const gmAssignment = gameState.seasonState.teamGeneralManagers?.[team.teamId];
    const gmChangedThisSeason = gmAssignment?.assignedSeasonId === gameState.season.id;
    // Slice 4 (F2): captain leadership dampens perceivedPressure under V2. selectTeamCaptain auto-derives
    // the top-leadership roster player, so this works even when no captain was manually assigned.
    const captainLeadershipScore = isBoardObjectivesV2Enabled()
      ? selectTeamCaptain(gameState, team.teamId)?.leadershipScore ?? null
      : null;
    const board = calculateBoardConfidence({
      teamId: team.teamId,
      identity,
      objectives: teamObjectives,
      storedBoard,
      previousSeasonBoard,
      gmChangedThisSeason,
      neutralPreseasonBoard,
      initialSeason,
      captainLeadershipScore,
    });
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
    // KRITISCH (Doppelauszahlung): Objectives aus dem Sponsor-Vertrags-Spiegel (`sponsor_v2_contract`)
    // tragen dieselben rewardCash/penaltyCash wie die echten Vertragskomponenten — die werden aber bereits
    // im Sponsor-Settlement (sponsor-settlement-service.ts, VOR diesem Board-Settlement) auf team.cash
    // gebucht. Hier NUR die Board-Confidence-Wirkung behalten, cashDelta = 0, sonst käme Sponsorgeld ~2×
    // an (und verfehlte Rangziele würden doppelt bestraft). Nicht-Sponsor-Board-Ziele zahlen normal.
    const isSponsorContractMirror = (objective.source ?? "").includes("sponsor_v2_contract");
    const cashDelta = isSponsorContractMirror
      ? 0
      : objective.status === "completed"
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

export type ObjectiveRewardApplyResult = {
  ok: boolean;
  applied: boolean;
  duplicateDetected: boolean;
  auditLogId: string | null;
  settlement: TeamSeasonObjectiveSettlement;
  gameState: GameState;
  warnings: string[];
};

export function applyTeamSeasonObjectiveRewards(
  gameState: GameState,
  input?: { saveId?: string; seasonId?: string; execute?: boolean },
): ObjectiveRewardApplyResult {
  const seasonId = input?.seasonId ?? gameState.season.id;
  const settlement = buildTeamSeasonObjectiveSettlement(gameState);
  const existingLog = (gameState.seasonState.objectiveRewardApplyLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
  const warnings: string[] = [];

  if (existingLog) {
    return {
      ok: true,
      applied: false,
      duplicateDetected: true,
      auditLogId: existingLog.id,
      settlement,
      gameState,
      warnings,
    };
  }

  if (!input?.execute) {
    return {
      ok: true,
      applied: false,
      duplicateDetected: false,
      auditLogId: null,
      settlement,
      gameState,
      warnings,
    };
  }

  const nextTeams = gameState.teams.map((team) => {
    const summary = settlement.byTeamId[team.teamId];
    if (!summary || summary.cashDelta === 0) {
      return team;
    }
    return {
      ...team,
      // KEIN Math.max(0,…): negatives Cash ist ein valider Zustand (auch das Sponsor-Settlement clampt nicht).
      // Ein Clamp würde bei bereits negativem Cash eine Board-STRAFE stillschweigend in Schuldenerlass
      // verwandeln (Cash springt auf 0). Strafe muss voll greifen.
      cash: roundValue((team.cash ?? 0) + summary.cashDelta, 1),
    };
  });

  const nextBoardConfidence = { ...(gameState.seasonState.boardConfidence ?? {}) };
  for (const [teamId, summary] of Object.entries(settlement.byTeamId)) {
    if (!summary || summary.boardConfidenceDelta === 0) {
      continue;
    }
    const current = nextBoardConfidence[teamId];
    const nextValue = roundValue(clamp((current?.value ?? 5) + summary.boardConfidenceDelta, 1, 10), 1);
    nextBoardConfidence[teamId] = {
      teamId,
      value: nextValue,
      pressure: roundValue(clamp(11 - nextValue, 1, 10), 1),
      warnings: current?.warnings ?? [],
    };
  }

  const auditLogId = `objective-reward:${seasonId}:${Date.now()}`;
  const nextGameState: GameState = {
    ...gameState,
    teams: nextTeams,
    seasonState: {
      ...gameState.seasonState,
      boardConfidence: nextBoardConfidence,
      objectiveRewardApplyLogs: [
        ...(gameState.seasonState.objectiveRewardApplyLogs ?? []),
        {
          id: auditLogId,
          saveId: input.saveId ?? gameState.season.id,
          seasonId,
          action: "apply",
          payload: {
            totalCashDelta: settlement.totals.cashDelta,
            totalBoardConfidenceDelta: settlement.totals.boardConfidenceDelta,
            appliedTeams: Object.keys(settlement.byTeamId).length,
            // Die Aufteilung je Team gehört in den Beleg, nicht in eine spätere Nachrechnung —
            // siehe Kommentar am Typ. `settlement` ist genau die Grundlage, aus der oben `nextTeams`
            // gebaut wurde, also protokolliert der Log das GEBUCHTE und nicht etwas Ähnliches.
            cashDeltaByTeamId: Object.fromEntries(
              Object.values(settlement.byTeamId)
                .filter((summary) => summary.cashDelta !== 0)
                .map((summary) => [summary.teamId, summary.cashDelta] as const),
            ),
          },
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };

  return {
    ok: true,
    applied: true,
    duplicateDetected: false,
    auditLogId,
    settlement,
    gameState: refreshTeamObjectiveState(nextGameState),
    warnings,
  };
}

export function getTeamObjectives(gameState: GameState, teamId: string) {
  return buildTeamObjectiveOverview(gameState).objectives.filter((objective) => objective.teamId === teamId);
}

export type TeamBoardFlowSignals = {
  blockers: string[];
  warnings: string[];
};

export function getTeamBoardFlowSignals(gameState: GameState, teamId: string | null): TeamBoardFlowSignals {
  if (!teamId) {
    return { blockers: [], warnings: [] };
  }

  const board = buildTeamObjectiveOverview(gameState).boardConfidence[teamId];
  if (!board) {
    return { blockers: [], warnings: [] };
  }

  const blockers = board.warnings.filter((warning) => warning === "board_objectives_failed");
  const warnings = board.warnings.filter(
    (warning) => warning === "board_objectives_at_risk" || warning === "high_board_pressure",
  );
  return { blockers, warnings };
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

  const initialSeason = (resolveSeasonNumberFromState(gameState) ?? 1) === 1;
  const aiBiasByTeamId: Record<string, TeamObjectiveAiBias> = {};
  for (const team of gameState.teams) {
    const objectives = objectivesByTeamId.get(team.teamId) ?? [];
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const storedBoard = storedBoardConfidence[team.teamId] ?? null;
    const board = storedBoard ?? calculateBoardConfidence({ teamId: team.teamId, identity, objectives, storedBoard: null, initialSeason });
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
