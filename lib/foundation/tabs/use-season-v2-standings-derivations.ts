import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { SortState } from "@/lib/foundation/tabs/cockpit-types";
import type { buildPpAreaFormBonusByTeamId } from "@/lib/foundation/pp-area-form-bonus";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";
import type { SeasonV2DisciplineLeaderboardInput } from "@/lib/foundation/tabs/use-season-v2-panel-model";

type SeasonSnapshotInput = NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number];
type SeasonFormBonusByTeamId = ReturnType<typeof buildPpAreaFormBonusByTeamId>;

export interface UseSeasonV2StandingsDerivationsInput {
  seasonStandRows: TeamManagementSnapshotRow[];
  seasonFormBonusByTeamId: SeasonFormBonusByTeamId;
  teamTableSort: SortState;
  selectedSeasonSnapshot: SeasonSnapshotInput | null;
}

/**
 * Season V2-only standings derivations (Strangler Phase 4.4). Runs only while
 * `FoundationSeasonV2Host` is mounted (`activeView === "seasonV2"`).
 */
export function useSeasonV2StandingsDerivations(input: UseSeasonV2StandingsDerivationsInput) {
  const { seasonStandRows, seasonFormBonusByTeamId, teamTableSort, selectedSeasonSnapshot } = input;

  const sortedSeasonStandRows = useMemo(
    () =>
      sortFoundationTableRows(seasonStandRows, teamTableSort, {
        platzierung: () => Number.POSITIVE_INFINITY,
        platz: (row) => row.rank ?? Number.POSITIVE_INFINITY,
        mannschaft: (row) => row.teamName,
        kurzel: (row) => row.teamCode,
        punkte: (row) => row.points ?? Number.NEGATIVE_INFINITY,
        cash: (row) => row.cash ?? Number.NEGATIVE_INFINITY,
        cash_fc: (row) => row.cashFc ?? Number.NEGATIVE_INFINITY,
        startplatz: (row) => row.startplatz ?? Number.POSITIVE_INFINITY,
        rank_diff: (row) => row.rankDiff ?? Number.NEGATIVE_INFINITY,
        basis: (row) => row.sponsorBasis ?? Number.NEGATIVE_INFINITY,
        sponsor_total: (row) => row.sponsorTotal ?? Number.NEGATIVE_INFINITY,
        guv: (row) => row.guv ?? Number.NEGATIVE_INFINITY,
        cash_total: (row) => row.cashTotal ?? Number.NEGATIVE_INFINITY,
        form: (row) => seasonFormBonusByTeamId[row.teamId]?.total ?? row.financeForm ?? Number.NEGATIVE_INFINITY,
        gehalt: (row) => row.salaryTotal,
        vertragslange: (row) => row.avgContractLength ?? Number.NEGATIVE_INFINITY,
        transfers: (row) => row.transfersSeasonValue ?? Number.NEGATIVE_INFINITY,
      }),
    [seasonFormBonusByTeamId, seasonStandRows, teamTableSort],
  );

  const archivedSeasonDisciplineLeaderboards = useMemo((): SeasonV2DisciplineLeaderboardInput[] => {
    if (!selectedSeasonSnapshot) {
      return [];
    }

    const disciplineRows = new Map<
      string,
      {
        disciplineId: string;
        disciplineName: string;
        players: Array<{
          playerId: string;
          playerName: string;
          teamCode: string | null;
          teamName: string | null;
          appearances: number;
          totalContribution: number | null;
          averageContribution: number | null;
          averageFinalScore: number | null;
        }>;
      }
    >();

    for (const player of selectedSeasonSnapshot.playerPerformances ?? []) {
      for (const discipline of player.disciplineBreakdown ?? []) {
        const bucket = disciplineRows.get(discipline.disciplineId) ?? {
          disciplineId: discipline.disciplineId,
          disciplineName: discipline.disciplineName,
          players: [],
        };
        bucket.players.push({
          playerId: player.playerId,
          playerName: player.playerName,
          teamCode: player.teamCode ?? null,
          teamName: player.teamName ?? null,
          appearances: discipline.appearances,
          totalContribution: discipline.totalContribution ?? null,
          averageContribution: discipline.averageContribution ?? null,
          averageFinalScore: discipline.averageFinalScore ?? null,
        });
        disciplineRows.set(discipline.disciplineId, bucket);
      }
    }

    return Array.from(disciplineRows.values())
      .map((entry) => ({
        ...entry,
        players: entry.players
          .sort((left, right) => {
            const contributionDelta =
              (right.totalContribution ?? Number.NEGATIVE_INFINITY) -
              (left.totalContribution ?? Number.NEGATIVE_INFINITY);
            if (contributionDelta !== 0) {
              return contributionDelta;
            }
            return (right.averageFinalScore ?? Number.NEGATIVE_INFINITY) - (left.averageFinalScore ?? Number.NEGATIVE_INFINITY);
          })
          .slice(0, 6),
      }))
      .sort((left, right) => left.disciplineName.localeCompare(right.disciplineName, "de"));
  }, [selectedSeasonSnapshot]);

  return { sortedSeasonStandRows, archivedSeasonDisciplineLeaderboards };
}
