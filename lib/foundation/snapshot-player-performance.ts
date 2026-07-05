import type { GameState, SeasonSnapshotPlayerPerformanceRecord, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function snapshotPerformanceRowHasData(row: SeasonSnapshotPlayerPerformanceRecord) {
  if ((row.appearances ?? 0) > 0) {
    return true;
  }
  if (typeof row.totalPoints === "number" && Number.isFinite(row.totalPoints) && row.totalPoints > 0) {
    return true;
  }
  if (typeof row.totalContribution === "number" && Number.isFinite(row.totalContribution) && row.totalContribution > 0) {
    return true;
  }
  if ((row.disciplineBreakdown?.length ?? 0) > 0) {
    return true;
  }
  return false;
}

export function getSnapshotPlayerPerformances(snapshot: SeasonSnapshotRecord) {
  const byPlayerId = new Map<string, SeasonSnapshotPlayerPerformanceRecord>();
  for (const row of snapshot.playerPerformances ?? []) {
    byPlayerId.set(row.playerId, row);
  }
  for (const row of snapshot.playerPerformanceSnapshots ?? []) {
    if (!byPlayerId.has(row.playerId)) {
      byPlayerId.set(row.playerId, row);
    }
  }
  return [...byPlayerId.values()];
}

export function snapshotHasPlayerPerformance(
  gameState: GameState,
  snapshot: SeasonSnapshotRecord,
  playerId: string,
) {
  const row = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, playerId);
  return row != null && snapshotPerformanceRowHasData(row);
}

export function findLatestArchivedSnapshotForPerformanceFallback(gameState: GameState) {
  const eligible = [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => {
      const status = snapshot.status;
      return status == null || status === "completed" || status === "partial";
    })
    .filter((snapshot) => {
      if (getSnapshotPlayerPerformances(snapshot).some(snapshotPerformanceRowHasData)) {
        return true;
      }
      return (
        (snapshot.playerDisciplinePerformances?.length ?? 0) > 0 &&
        (snapshot.matchdayResults ?? []).some((result) => result.status === "preview_applied")
      );
    })
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de"));

  return (
    eligible.find((snapshot) => snapshot.seasonId !== gameState.season.id) ??
    eligible.find((snapshot) => snapshot.seasonId === gameState.season.id) ??
    null
  );
}

export function resolveSnapshotPlayerPerformanceRow(
  gameState: GameState,
  snapshot: SeasonSnapshotRecord,
  playerId: string,
): SeasonSnapshotPlayerPerformanceRecord | null {
  const existing =
    snapshot.playerPerformances?.find((entry) => entry.playerId === playerId) ??
    snapshot.playerPerformanceSnapshots?.find((entry) => entry.playerId === playerId) ??
    null;
  if (existing && snapshotPerformanceRowHasData(existing)) {
    return existing;
  }

  const seasonResultIds = new Set(
    (snapshot.matchdayResults ?? [])
      .filter((result) => result.status === "preview_applied")
      .map((result) => result.id),
  );

  const disciplineById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline] as const));
  const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
  const playerDisciplineEntries = (snapshot.playerDisciplinePerformances ?? []).filter(
    (performance) => performance.playerId === playerId,
  );
  const entries =
    seasonResultIds.size > 0
      ? playerDisciplineEntries.filter((performance) => seasonResultIds.has(performance.matchdayResultId))
      : playerDisciplineEntries;
  if (entries.length === 0) {
    return existing && snapshotPerformanceRowHasData(existing) ? existing : null;
  }

  const disciplineBreakdownMap = new Map<
    string,
    {
      disciplineId: string;
      disciplineName: string;
      appearances: number;
      totalContribution: number;
      totalFinalScore: number;
    }
  >();
  let appearances = 0;
  let totalContribution = 0;
  let totalFinalScore = 0;
  let top10Count = 0;
  let mvpCount = 0;
  let bestDisciplineId: string | null = null;
  let bestDisciplineLabel: string | null = null;
  let bestDisciplineScore: number | null = null;
  let teamId: string | null = null;

  for (const entry of entries) {
    appearances += 1;
    const points = entry.scoreContribution ?? 0;
    totalContribution += points;
    totalFinalScore += entry.finalPlayerScore ?? 0;
    top10Count += entry.isTop10 ? 1 : 0;
    mvpCount += entry.isMvpCandidate ? 1 : 0;
    teamId = entry.teamId ?? teamId;

    const discipline = disciplineById.get(entry.disciplineId);
    const disciplineLabel = discipline?.name ?? entry.disciplineId;
    const breakdown = disciplineBreakdownMap.get(entry.disciplineId) ?? {
      disciplineId: entry.disciplineId,
      disciplineName: disciplineLabel,
      appearances: 0,
      totalContribution: 0,
      totalFinalScore: 0,
    };
    breakdown.appearances += 1;
    breakdown.totalContribution += points;
    breakdown.totalFinalScore += entry.finalPlayerScore ?? 0;
    disciplineBreakdownMap.set(entry.disciplineId, breakdown);

    if ((bestDisciplineScore ?? Number.NEGATIVE_INFINITY) < (entry.finalPlayerScore ?? 0)) {
      bestDisciplineScore = entry.finalPlayerScore ?? null;
      bestDisciplineId = entry.disciplineId;
      bestDisciplineLabel = disciplineLabel;
    }
  }

  const team = teamId ? (gameState.teams.find((entry) => entry.teamId === teamId) ?? null) : null;
  const disciplineBreakdown = [...disciplineBreakdownMap.values()].map((entry) => ({
    disciplineId: entry.disciplineId,
    disciplineName: entry.disciplineName,
    appearances: entry.appearances,
    totalContribution: roundValue(entry.totalContribution, 1),
    averageContribution: roundValue(entry.totalContribution / entry.appearances, 1),
    averageFinalScore: roundValue(entry.totalFinalScore / entry.appearances, 1),
  }));
  const disciplineCategoryById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const));
  const pointsByArea = disciplineBreakdown.reduce(
    (totals, discipline) => {
      const category = disciplineCategoryById.get(discipline.disciplineId);
      if (category === "power") totals.pow += discipline.totalContribution ?? 0;
      if (category === "speed") totals.spe += discipline.totalContribution ?? 0;
      if (category === "mental") totals.men += discipline.totalContribution ?? 0;
      if (category === "social") totals.soc += discipline.totalContribution ?? 0;
      return totals;
    },
    { pow: 0, spe: 0, men: 0, soc: 0 },
  );

  return {
    playerId,
    playerName: player?.name ?? playerId,
    teamId,
    teamCode: team?.shortCode ?? null,
    teamName: team?.name ?? null,
    seasonId: snapshot.seasonId,
    appearances,
    totalContribution: roundValue(totalContribution, 1),
    totalPoints: roundValue(totalContribution, 1),
    averageContribution: roundValue(totalContribution / appearances, 1),
    averageFinalScore: roundValue(totalFinalScore / appearances, 1),
    powPoints: roundValue(pointsByArea.pow, 1),
    spePoints: roundValue(pointsByArea.spe, 1),
    menPoints: roundValue(pointsByArea.men, 1),
    socPoints: roundValue(pointsByArea.soc, 1),
    top10Count,
    mvpCount,
    bestDisciplineId,
    bestDisciplineLabel,
    bestDisciplineScore: bestDisciplineScore != null ? roundValue(bestDisciplineScore, 1) : null,
    disciplineBreakdown,
    warnings: ["snapshot_player_performance_rebuilt_from_discipline_rows"],
  };
}

export function collectSnapshotPerformancePlayerIds(snapshot: SeasonSnapshotRecord) {
  const playerIds = new Set<string>();
  for (const row of getSnapshotPlayerPerformances(snapshot)) {
    playerIds.add(row.playerId);
  }
  for (const entry of snapshot.playerDisciplinePerformances ?? []) {
    playerIds.add(entry.playerId);
  }
  return [...playerIds];
}
