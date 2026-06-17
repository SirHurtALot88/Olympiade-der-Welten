import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

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
      points: row.points ?? row.disciplinePoints,
      cash: row.cashEnd,
      cashFc: null,
      startplatz: row.rank,
      rankDiff: null,
      sponsorBasis: null,
      sponsorRank: null,
      sponsorTotal: null,
      guv: row.transferNet,
      cashTotal: row.cashEnd,
      form: null,
      transfers: row.transferCount,
      rosterCount: row.rosterCountEnd ?? row.rosterEnd ?? null,
      salaryTotal: row.salaryTotalEnd ?? row.salaryEnd ?? null,
      marketValueTotal: row.marketValueTotalEnd ?? row.marketValueEnd ?? null,
      disciplineValues: {
        pow: row.disciplinePointsByArea.pow,
        spe: row.disciplinePointsByArea.spe,
        men: row.disciplinePointsByArea.men,
        soc: row.disciplinePointsByArea.soc,
      },
      warnings: [],
    }));
}
