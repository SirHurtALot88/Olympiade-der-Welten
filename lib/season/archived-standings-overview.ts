import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import {
  buildTeamHistoryDisciplineValuesFromSnapshot,
  SEASON_DISCIPLINE_AREA_GROUPS,
  sumSeasonDisciplineAreaTotal,
  type PlayerHistoryDisciplineValues,
} from "@/lib/season/season-discipline-area-groups";
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

function emptyDisciplineValues() {
  return Object.fromEntries(SEASON_STANDINGS_DISCIPLINE_COLUMNS.map((column) => [column.normalizedKey, null]));
}

function buildArchivedDisciplineValues(
  snapshot: SeasonSnapshotRecord,
  teamId: string,
  areaPoints?: {
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
  },
) {
  const fromPerformances = buildTeamHistoryDisciplineValuesFromSnapshot(snapshot, teamId);
  const merged = Object.fromEntries(
    SEASON_STANDINGS_DISCIPLINE_COLUMNS.map((column) => [
      column.normalizedKey,
      fromPerformances[column.normalizedKey as keyof PlayerHistoryDisciplineValues] ?? null,
    ]),
  ) as Record<string, number | null>;

  for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
    const currentTotal = sumSeasonDisciplineAreaTotal(merged, group.id);
    const fallback = areaPoints?.[group.id];
    if (
      currentTotal <= 0 &&
      fallback != null &&
      Number.isFinite(fallback) &&
      fallback > 0 &&
      group.keys.length > 0
    ) {
      merged[group.keys[0]] = roundValue(fallback, 1);
    }
  }

  return merged;
}

export function buildArchivedSeasonStandingsOverviewItems(
  snapshot: SeasonSnapshotRecord,
): ArchivedSeasonStandingsOverviewItem[] {
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
      points: row.points ?? row.disciplinePoints ?? null,
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
      disciplineValues: buildArchivedDisciplineValues(snapshot, row.teamId, row.disciplinePointsByArea) ?? emptyDisciplineValues(),
      warnings: [],
    }));
}
