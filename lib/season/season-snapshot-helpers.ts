import type { SeasonSnapshotRecord, SeasonSnapshotTeamRecord, Team } from "@/lib/data/olyDataTypes";

export type SeasonSnapshotAllTimeRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  seasonsPlayed: number;
  gold: number;
  silver: number;
  bronze: number;
  top5: number;
  top10: number;
  avgRank: number | null;
  totalHistoricalPoints: number | null;
  lastSeasonRank: number | null;
  bestRank: number | null;
  worstRank: number | null;
  historicalPow: number | null;
  historicalSpe: number | null;
  historicalMen: number | null;
  historicalSoc: number | null;
  hasHistory: boolean;
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function buildAllTimeTableFromSnapshots(
  snapshots: SeasonSnapshotRecord[] | undefined,
  teams: Team[] = [],
): SeasonSnapshotAllTimeRow[] {
  const snapshotList = snapshots ?? [];
  const teamMap = new Map<string, { teamId: string; teamCode: string; teamName: string }>();

  for (const team of teams) {
    teamMap.set(team.teamId, {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
    });
  }

  for (const snapshot of snapshotList) {
    for (const row of snapshot.finalStandings) {
      teamMap.set(row.teamId, {
        teamId: row.teamId,
        teamCode: row.teamCode,
        teamName: row.teamName,
      });
    }
  }

  return Array.from(teamMap.values())
    .map((team) => {
      const standings = snapshotList
        .map((snapshot) => snapshot.finalStandings.find((entry) => entry.teamId === team.teamId) ?? null)
        .filter((entry): entry is SeasonSnapshotTeamRecord => Boolean(entry));
      const ranks = standings.map((entry) => entry.rank).filter((value): value is number => value != null);
      const totalHistoricalPoints =
        standings.length > 0
          ? roundValue(standings.reduce((sum, entry) => sum + (entry.disciplinePoints ?? 0), 0), 1)
          : null;

      return {
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        seasonsPlayed: standings.length,
        gold: standings.filter((entry) => entry.rank === 1).length,
        silver: standings.filter((entry) => entry.rank === 2).length,
        bronze: standings.filter((entry) => entry.rank === 3).length,
        top5: standings.filter((entry) => entry.rank != null && entry.rank <= 5).length,
        top10: standings.filter((entry) => entry.rank != null && entry.rank <= 10).length,
        avgRank: ranks.length > 0 ? roundValue(ranks.reduce((sum, value) => sum + value, 0) / ranks.length, 1) : null,
        totalHistoricalPoints,
        lastSeasonRank: standings[0]?.rank ?? null,
        bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
        worstRank: ranks.length > 0 ? Math.max(...ranks) : null,
        historicalPow:
          standings.length > 0
            ? roundValue(standings.reduce((sum, entry) => sum + (entry.disciplinePointsByArea.pow ?? 0), 0), 1)
            : null,
        historicalSpe:
          standings.length > 0
            ? roundValue(standings.reduce((sum, entry) => sum + (entry.disciplinePointsByArea.spe ?? 0), 0), 1)
            : null,
        historicalMen:
          standings.length > 0
            ? roundValue(standings.reduce((sum, entry) => sum + (entry.disciplinePointsByArea.men ?? 0), 0), 1)
            : null,
        historicalSoc:
          standings.length > 0
            ? roundValue(standings.reduce((sum, entry) => sum + (entry.disciplinePointsByArea.soc ?? 0), 0), 1)
            : null,
        hasHistory: standings.length > 0,
      };
    })
    .sort((left, right) => {
      if ((right.gold ?? 0) !== (left.gold ?? 0)) return right.gold - left.gold;
      if ((right.silver ?? 0) !== (left.silver ?? 0)) return right.silver - left.silver;
      if ((right.bronze ?? 0) !== (left.bronze ?? 0)) return right.bronze - left.bronze;
      if ((right.top5 ?? 0) !== (left.top5 ?? 0)) return right.top5 - left.top5;
      if ((right.top10 ?? 0) !== (left.top10 ?? 0)) return right.top10 - left.top10;
      if ((right.totalHistoricalPoints ?? Number.NEGATIVE_INFINITY) !== (left.totalHistoricalPoints ?? Number.NEGATIVE_INFINITY)) {
        return (right.totalHistoricalPoints ?? Number.NEGATIVE_INFINITY) - (left.totalHistoricalPoints ?? Number.NEGATIVE_INFINITY);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });
}

export function resolveSeasonSnapshotTeamRecords(snapshot: SeasonSnapshotRecord): SeasonSnapshotTeamRecord[] {
  if (snapshot.teamSnapshots != null && snapshot.teamSnapshots.length > 0) {
    return snapshot.teamSnapshots;
  }
  return snapshot.finalStandings ?? [];
}
