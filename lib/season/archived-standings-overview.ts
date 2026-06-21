import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import { SEASON_STANDINGS_DISCIPLINE_COLUMNS } from "@/lib/standings/season-standings-sheet";

export type ArchivedSeasonStandingsOverviewItem = {
  teamId: string;
  teamName: string | null;
  teamCode: string | null;
  rank: number | null;
  points: number | null;
  cash: number | null;
  cashFc: number | null;
  startplatz: number | null;
  rankDiff: number | null;
  sponsorBasis: number | null;
  sponsorRank: number | null;
  sponsorTotal: number | null;
  guv: number | null;
  cashTotal: number | null;
  form: number | null;
  transfers: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  disciplineValues: Record<string, number | null>;
  warnings: string[];
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function buildDisciplinePointsByTeamId(snapshot: SeasonSnapshotRecord) {
  const totalsByTeamId = new Map<string, Record<string, number | null>>();

  for (const player of snapshot.playerPerformances ?? []) {
    if (!player.teamId) {
      continue;
    }

    const current =
      totalsByTeamId.get(player.teamId) ??
      Object.fromEntries(SEASON_STANDINGS_DISCIPLINE_COLUMNS.map((column) => [column.normalizedKey, null]));

    for (const discipline of player.disciplineBreakdown ?? []) {
      const disciplineKey = normalizeLineupDisciplineFieldName(discipline.disciplineId);
      if (!disciplineKey || !(disciplineKey in current)) {
        continue;
      }

      const value = discipline.totalContribution ?? 0;
      if (!Number.isFinite(value)) {
        continue;
      }

      current[disciplineKey] = roundValue((current[disciplineKey] ?? 0) + value, 1);
    }

    totalsByTeamId.set(player.teamId, current);
  }

  return totalsByTeamId;
}

export function buildArchivedSeasonStandingsOverviewItems(
  snapshot: SeasonSnapshotRecord,
): ArchivedSeasonStandingsOverviewItem[] {
  const disciplinePointsByTeamId = buildDisciplinePointsByTeamId(snapshot);

  return [...snapshot.finalStandings]
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.rank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      if ((right.points ?? Number.NEGATIVE_INFINITY) !== (left.points ?? Number.NEGATIVE_INFINITY)) {
        return (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    })
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      teamCode: row.teamCode,
      rank: row.rank,
      points: row.points ?? row.disciplinePoints,
      cash: row.cashEnd,
      cashFc: row.cashFc ?? null,
      startplatz: row.startplatz ?? row.rank,
      rankDiff: row.rankDiff ?? null,
      sponsorBasis: row.sponsorBasis ?? null,
      sponsorRank: row.sponsorRank ?? null,
      sponsorTotal: row.sponsorTotal ?? null,
      guv:
        row.guv ??
        (row.sponsorTotal != null && (row.salaryTotalEnd ?? row.salaryEnd) != null
          ? Number((row.sponsorTotal - (row.salaryTotalEnd ?? row.salaryEnd ?? 0)).toFixed(2))
          : null),
      cashTotal: row.cashTotal ?? row.cashEnd,
      form: null,
      transfers: row.transferNet,
      rosterCount: row.rosterCountEnd ?? row.rosterEnd ?? null,
      salaryTotal: row.salaryTotalEnd ?? row.salaryEnd ?? null,
      marketValueTotal: row.marketValueTotalEnd ?? row.marketValueEnd ?? null,
      disciplineValues:
        disciplinePointsByTeamId.get(row.teamId) ??
        Object.fromEntries(SEASON_STANDINGS_DISCIPLINE_COLUMNS.map((column) => [column.normalizedKey, null])),
      warnings: [],
    }));
}
