import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

type RankDirection = "up" | "down" | "same" | "unknown";

export type MatchdaySummaryTeamRow = {
  teamId: string;
  teamName: string;
  teamShortCode: string;
  matchdayRank: number | null;
  matchdayPoints: number | null;
  d1Score: number | null;
  d2Score: number | null;
  matchdayScore: number | null;
  seasonRankBeforeMatchday: number | null;
  seasonRankAfterMatchday: number | null;
  rankDelta: number | null;
  rankDirection: RankDirection;
  cumulativePointsBefore: number | null;
  cumulativePoints: number | null;
  warnings: string[];
};

export type MatchdaySummaryTopPlayer = {
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  teamId: string;
  teamName: string;
  teamShortCode: string;
  disciplineId: string;
  disciplineName: string;
  disciplineSide: "d1" | "d2";
  finalPlayerScore: number;
  points: number | null;
  mutatorScoreBonus: number | null;
  mutatorPpsBonus: number | null;
  formCardBonus: number | null;
  captainBonus: number | null;
  totalBonus: number | null;
  rankInDiscipline: number;
};

export type MatchdaySummaryHighlight = {
  id: string;
  label: string;
  value: string;
  source: string;
};

export type MatchdaySummary = {
  seasonId: string;
  matchdayId: string;
  matchdayNumber: number | null;
  d1: { disciplineId: string | null; disciplineName: string | null };
  d2: { disciplineId: string | null; disciplineName: string | null };
  hasResult: boolean;
  teamRows: MatchdaySummaryTeamRow[];
  topTeams: MatchdaySummaryTeamRow[];
  bottomTeams: MatchdaySummaryTeamRow[];
  topPlayers: MatchdaySummaryTopPlayer[];
  highlights: MatchdaySummaryHighlight[];
  warnings: string[];
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function rankTeams(rows: Array<{ teamId: string; teamName: string; points: number | null }>) {
  return new Map(
    [...rows]
      .sort((left, right) => {
        const pointDiff = (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
        if (pointDiff !== 0) return pointDiff;
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map((row, index) => [row.teamId, isFiniteNumber(row.points) ? index + 1 : null] as const),
  );
}

function sumByTeam(entries: Array<{ teamId: string; points: number }>) {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.teamId, roundValue((totals.get(entry.teamId) ?? 0) + entry.points, 4));
  }
  return totals;
}

function rankDirectionFromDelta(rankDelta: number | null): RankDirection {
  if (rankDelta == null) return "unknown";
  if (rankDelta > 0) return "up";
  if (rankDelta < 0) return "down";
  return "same";
}

export function getMatchdaySummaryOptions(gameState: GameState, seasonId = gameState.season.id) {
  return (gameState.seasonState.matchdayResults ?? [])
    .filter((result) => result.seasonId === seasonId && result.status === "preview_applied")
    .sort((left, right) => {
      const leftIndex = gameState.season.matchdayIds.indexOf(left.matchdayId);
      const rightIndex = gameState.season.matchdayIds.indexOf(right.matchdayId);
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    })
    .map((result) => ({
      matchdayId: result.matchdayId,
      matchdayNumber: gameState.season.matchdayIds.indexOf(result.matchdayId) + 1 || null,
      resultId: result.id,
    }));
}

export function buildMatchdaySummary(
  gameState: GameState,
  input?: { seasonId?: string; matchdayId?: string | null },
): MatchdaySummary {
  const seasonId = input?.seasonId ?? gameState.season.id;
  const matchdayId = input?.matchdayId ?? gameState.matchdayState.matchdayId;
  const matchdayIndex = gameState.season.matchdayIds.indexOf(matchdayId ?? "");
  const matchdayNumber = matchdayIndex >= 0 ? matchdayIndex + 1 : null;
  const warnings: string[] = [];
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const disciplinesById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline] as const));
  const result =
    (gameState.seasonState.matchdayResults ?? []).find(
      (entry) => entry.seasonId === seasonId && entry.matchdayId === matchdayId && entry.status === "preview_applied",
    ) ?? null;

  if (!result) {
    warnings.push("missing_matchday_result");
    return {
      seasonId,
      matchdayId: matchdayId ?? "—",
      matchdayNumber,
      d1: { disciplineId: null, disciplineName: null },
      d2: { disciplineId: null, disciplineName: null },
      hasResult: false,
      teamRows: gameState.teams.map((team) => ({
        teamId: team.teamId,
        teamName: team.name,
        teamShortCode: team.shortCode,
        matchdayRank: null,
        matchdayPoints: null,
        d1Score: null,
        d2Score: null,
        matchdayScore: null,
        seasonRankBeforeMatchday: null,
        seasonRankAfterMatchday: null,
        rankDelta: null,
        rankDirection: "unknown",
        cumulativePointsBefore: null,
        cumulativePoints: null,
        warnings: ["missing_matchday_result"],
      })),
      topTeams: [],
      bottomTeams: [],
      topPlayers: [],
      highlights: [],
      warnings,
    };
  }

  const resultId = result?.id ?? null;
  const disciplineRows = resultId
    ? (gameState.seasonState.disciplineResults ?? []).filter((entry) => entry.matchdayResultId === resultId)
    : [];
  const performanceRows = resultId
    ? (gameState.seasonState.playerDisciplinePerformances ?? []).filter((entry) => entry.matchdayResultId === resultId)
    : [];
  const highlights = resultId
    ? (gameState.seasonState.disciplineHighlights ?? []).filter((entry) => entry.matchdayResultId === resultId)
    : [];

  if (result && disciplineRows.length === 0) warnings.push("missing_discipline_results");
  if (result && performanceRows.length === 0) warnings.push("missing_player_performances");

  const ledger = buildSeasonPointsLedger(gameState, seasonId);
  warnings.push(...ledger.warnings);

  const matchdayPointEntries = ledger.pointEntries.filter((entry) => entry.matchdayResultId === resultId);
  const beforeMatchdayIds = new Set(
    gameState.season.matchdayIds.slice(0, Math.max(0, matchdayIndex)),
  );
  const throughMatchdayIds = new Set(
    matchdayIndex >= 0 ? gameState.season.matchdayIds.slice(0, matchdayIndex + 1) : [],
  );
  const beforePoints = sumByTeam(
    ledger.pointEntries
      .filter((entry) => entry.matchdayId != null && beforeMatchdayIds.has(entry.matchdayId))
      .map((entry) => ({ teamId: entry.teamId, points: entry.basePoints })),
  );
  const afterPoints = sumByTeam(
    ledger.pointEntries
      .filter((entry) => entry.matchdayId != null && throughMatchdayIds.has(entry.matchdayId))
      .map((entry) => ({ teamId: entry.teamId, points: entry.basePoints })),
  );
  const matchdayPoints = sumByTeam(matchdayPointEntries.map((entry) => ({ teamId: entry.teamId, points: entry.basePoints })));
  const rankBefore = rankTeams(
    gameState.teams.map((team) => ({ teamId: team.teamId, teamName: team.name, points: beforePoints.get(team.teamId) ?? 0 })),
  );
  const rankAfter = rankTeams(
    gameState.teams.map((team) => ({ teamId: team.teamId, teamName: team.name, points: afterPoints.get(team.teamId) ?? 0 })),
  );
  const matchdayRank = rankTeams(
    gameState.teams.map((team) => ({ teamId: team.teamId, teamName: team.name, points: matchdayPoints.get(team.teamId) ?? null })),
  );

  const scoreByTeam = new Map<string, { d1Score: number | null; d2Score: number | null; warnings: string[] }>();
  for (const row of disciplineRows) {
    const current = scoreByTeam.get(row.teamId) ?? { d1Score: null, d2Score: null, warnings: [] };
    if (row.disciplineSide === "d1") current.d1Score = row.totalScore;
    if (row.disciplineSide === "d2") current.d2Score = row.totalScore;
    current.warnings.push(...row.warnings);
    scoreByTeam.set(row.teamId, current);
  }

  const d1DisciplineId = disciplineRows.find((entry) => entry.disciplineSide === "d1")?.disciplineId ?? null;
  const d2DisciplineId = disciplineRows.find((entry) => entry.disciplineSide === "d2")?.disciplineId ?? null;

  const teamRows = gameState.teams
    .map<MatchdaySummaryTeamRow>((team) => {
      const scores = scoreByTeam.get(team.teamId);
      const beforeRank = rankBefore.get(team.teamId) ?? null;
      const afterRank = rankAfter.get(team.teamId) ?? null;
      const rankDelta = beforeRank != null && afterRank != null ? beforeRank - afterRank : null;
      const d1Score = scores?.d1Score ?? null;
      const d2Score = scores?.d2Score ?? null;
      return {
        teamId: team.teamId,
        teamName: team.name,
        teamShortCode: team.shortCode,
        matchdayRank: matchdayRank.get(team.teamId) ?? null,
        matchdayPoints: matchdayPoints.has(team.teamId) ? roundValue(matchdayPoints.get(team.teamId) ?? 0, 1) : null,
        d1Score,
        d2Score,
        matchdayScore: d1Score != null || d2Score != null ? roundValue((d1Score ?? 0) + (d2Score ?? 0), 1) : null,
        seasonRankBeforeMatchday: beforeRank,
        seasonRankAfterMatchday: afterRank,
        rankDelta,
        rankDirection: rankDirectionFromDelta(rankDelta),
        cumulativePointsBefore: roundValue(beforePoints.get(team.teamId) ?? 0, 1),
        cumulativePoints: roundValue(afterPoints.get(team.teamId) ?? 0, 1),
        warnings: Array.from(new Set(scores?.warnings ?? [])),
      };
    })
    .sort((left, right) => (left.matchdayRank ?? 999) - (right.matchdayRank ?? 999));

  const pointEntryByPerformanceId = ledger.pointEntriesByPerformanceId;
  const topPlayers = performanceRows
    .map<MatchdaySummaryTopPlayer>((performance) => {
      const player = playersById.get(performance.playerId);
      const team = teamsById.get(performance.teamId);
      const discipline = disciplinesById.get(performance.disciplineId);
      const points = pointEntryByPerformanceId.get(performance.id)?.points ?? null;
      const mutatorScoreBonus = performance.mutatorScoreBonus ?? null;
      const mutatorPpsBonus = performance.mutatorPpsBonus ?? null;
      const knownBonuses = [mutatorScoreBonus, mutatorPpsBonus].filter(isFiniteNumber);
      return {
        playerId: performance.playerId,
        activePlayerId: performance.activePlayerId,
        playerName: player?.name ?? performance.playerId,
        teamId: performance.teamId,
        teamName: team?.name ?? performance.teamId,
        teamShortCode: team?.shortCode ?? performance.teamId,
        disciplineId: performance.disciplineId,
        disciplineName: discipline?.name ?? performance.disciplineId,
        disciplineSide: performance.disciplineSide,
        finalPlayerScore: performance.finalPlayerScore,
        points,
        mutatorScoreBonus,
        mutatorPpsBonus,
        formCardBonus: null,
        captainBonus: null,
        totalBonus: knownBonuses.length ? roundValue(knownBonuses.reduce((sum, value) => sum + value, 0), 2) : null,
        rankInDiscipline: performance.rankInDiscipline,
      };
    })
    .sort((left, right) => right.finalPlayerScore - left.finalPlayerScore)
    .slice(0, 10);

  return {
    seasonId,
    matchdayId: matchdayId ?? "—",
    matchdayNumber,
    d1: { disciplineId: d1DisciplineId, disciplineName: d1DisciplineId ? disciplinesById.get(d1DisciplineId)?.name ?? d1DisciplineId : null },
    d2: { disciplineId: d2DisciplineId, disciplineName: d2DisciplineId ? disciplinesById.get(d2DisciplineId)?.name ?? d2DisciplineId : null },
    hasResult: Boolean(result),
    teamRows,
    topTeams: teamRows.slice(0, 5),
    bottomTeams: [...teamRows].filter((row) => row.matchdayRank != null).slice(-5).reverse(),
    topPlayers,
    highlights: highlights.slice(0, 8).map((highlight) => ({
      id: highlight.id,
      label: highlight.highlightType,
      value: highlight.shortSummary ?? "—",
      source: "seasonState.disciplineHighlights",
    })),
    warnings: Array.from(new Set(warnings)),
  };
}
