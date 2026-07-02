import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildLightweightTeamSeasonStandRows,
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";
import { hydrateTeamOverviewSliceRows, type TeamOverviewSliceRow } from "@/lib/foundation/team-overview-slice";
import { buildStandingsTransferBalanceByTeamId } from "@/lib/season/transfer-standings-balance";

type SeasonStandingsFeedItem = {
  teamId: string;
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
};

type SeasonStandingsFeed = {
  items: SeasonStandingsFeedItem[];
  source: { kind: "season_standings_sheet" | "season_snapshot" };
} | null;

type SeasonManagementFeed = {
  items: Array<{
    teamId: string;
    startBudget: number | null;
    playerMin: number | null;
    playerOpt: number | null;
  }>;
} | null;

export interface UseSeasonStandRowsInput {
  shouldBuildSeasonStandRows: boolean;
  /** Full rows (teams, home, season tabs). When false but stand rows are needed, cockpit gets lightweight rows. */
  shouldBuildFullSeasonStandRows: boolean;
  gameState: GameState;
  activeSaveId: string;
  seasonOverviewSeasonId: string;
  seasonStandingsFeed: SeasonStandingsFeed;
  seasonManagementFeed: SeasonManagementFeed;
  teamOverviewSlice: {
    enabled: boolean;
    rows: TeamOverviewSliceRow[];
    error: string | null;
  };
}

/**
 * Cross-tab season stand rows build chain (Strangler Phase 4.5).
 *
 * Consumer map:
 * | Output | Primary consumers |
 * |---|---|
 * | seasonStandRows | teams, homeV2, cockpit (lightweight), seasonV2, prize, matchdayArena, teamProfile, teamSettings, scoutingCenterV2, ppArea/ranks/diszis |
 *
 * Upstream (gated by shouldBuildSeasonStandRows):
 * - standingsSnapshotByTeamId ← seasonStandingsFeed
 * - seasonManagementByTeamId ← seasonManagementFeed
 * - transferSummaryByTeamId ← buildStandingsTransferBalanceByTeamId (full build only)
 * - mergedStandingsByTeamId ← gameState.standings + feeds
 * - teamOverviewSlice rows (hydrate or lightweight fallback)
 */
export function useSeasonStandRows(input: UseSeasonStandRowsInput): { seasonStandRows: TeamManagementSnapshotRow[] } {
  const {
    shouldBuildSeasonStandRows,
    shouldBuildFullSeasonStandRows,
    gameState,
    activeSaveId,
    seasonOverviewSeasonId,
    seasonStandingsFeed,
    seasonManagementFeed,
    teamOverviewSlice,
  } = input;

  const standingsSnapshotByTeamId = useMemo(() => {
    if (!shouldBuildSeasonStandRows) {
      return {};
    }

    return Object.fromEntries(
      (seasonStandingsFeed?.items ?? []).map((item) => [
        item.teamId,
        {
          rank: item.rank,
          points: item.points,
          cash: item.cash,
          cashFc: item.cashFc,
          startplatz: item.startplatz,
          rankDiff: item.rankDiff,
          sponsorBasis: item.sponsorBasis,
          sponsorRank: item.sponsorRank,
          sponsorTotal: item.sponsorTotal,
          guv: item.guv,
          cashTotal: item.cashTotal,
          form: item.form,
          transfers: item.transfers,
          rosterCount: item.rosterCount,
          salaryTotal: item.salaryTotal,
          marketValueTotal: item.marketValueTotal,
          disciplineValues: item.disciplineValues,
        },
      ]),
    );
  }, [seasonStandingsFeed, shouldBuildSeasonStandRows]);

  const seasonManagementByTeamId = useMemo(() => {
    if (!shouldBuildSeasonStandRows) {
      return {};
    }

    return Object.fromEntries(
      (seasonManagementFeed?.items ?? []).map((item) => [
        item.teamId,
        {
          budget: item.startBudget,
          playerMin: item.playerMin,
          playerOpt: item.playerOpt,
        },
      ]),
    );
  }, [seasonManagementFeed, shouldBuildSeasonStandRows]);

  const transferSummaryByTeamId = useMemo(() => {
    if (!shouldBuildSeasonStandRows || !shouldBuildFullSeasonStandRows) {
      return {};
    }

    const seasonId = seasonOverviewSeasonId ?? gameState.season.id;
    return buildStandingsTransferBalanceByTeamId(gameState, seasonId);
  }, [gameState, seasonOverviewSeasonId, shouldBuildFullSeasonStandRows, shouldBuildSeasonStandRows]);

  const mergedStandingsByTeamId = useMemo(() => {
    if (!shouldBuildSeasonStandRows) {
      return {};
    }

    const fallbackSorted = [...gameState.teams]
      .map((team) => ({
        teamId: team.teamId,
        points: gameState.seasonState.standings[team.teamId]?.points ?? 0,
        cash: team.cash,
      }))
      .sort((left, right) => {
        if (right.points !== left.points) {
          return right.points - left.points;
        }

        return right.cash - left.cash;
      });

    const fallbackStandingsByTeamId = Object.fromEntries(
      fallbackSorted.map((row, index) => [
        row.teamId,
        {
          rank: index + 1,
          points: row.points,
          cash: row.cash,
        },
      ]),
    );

    return {
      ...Object.fromEntries(
        Object.entries(fallbackStandingsByTeamId).map(([teamId, row]) => [
          teamId,
          {
            ...row,
            budget: seasonManagementByTeamId[teamId]?.budget ?? null,
            playerMin: seasonManagementByTeamId[teamId]?.playerMin ?? null,
            playerOpt: seasonManagementByTeamId[teamId]?.playerOpt ?? null,
          },
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(standingsSnapshotByTeamId).map(([teamId, row]) => [
          teamId,
          {
            ...row,
            budget: seasonManagementByTeamId[teamId]?.budget ?? null,
            playerMin: seasonManagementByTeamId[teamId]?.playerMin ?? null,
            playerOpt: seasonManagementByTeamId[teamId]?.playerOpt ?? null,
          },
        ]),
      ),
    };
  }, [gameState, seasonManagementByTeamId, shouldBuildSeasonStandRows, standingsSnapshotByTeamId]);

  const seasonStandRows = useMemo(() => {
    if (!shouldBuildSeasonStandRows) {
      return [];
    }

    if (!shouldBuildFullSeasonStandRows) {
      return buildLightweightTeamSeasonStandRows({
        gameState,
        standingsByTeamId: mergedStandingsByTeamId,
      });
    }

    if (teamOverviewSlice.rows.length > 0 && !teamOverviewSlice.error) {
      return hydrateTeamOverviewSliceRows(teamOverviewSlice.rows, gameState);
    }

    if (teamOverviewSlice.enabled) {
      return buildLightweightTeamSeasonStandRows({
        gameState,
        standingsByTeamId: mergedStandingsByTeamId,
        transferSummaryByTeamId,
      });
    }

    return buildTeamSeasonOverviewRows({
      gameState,
      saveId: activeSaveId,
      seasonId: seasonOverviewSeasonId,
      preferStandingDisciplineValues:
        seasonOverviewSeasonId !== gameState.season.id || seasonStandingsFeed?.source.kind === "season_snapshot",
      standingsByTeamId: mergedStandingsByTeamId,
      transferSummaryByTeamId,
    });
  }, [
    activeSaveId,
    gameState,
    mergedStandingsByTeamId,
    seasonOverviewSeasonId,
    seasonStandingsFeed?.source.kind,
    shouldBuildFullSeasonStandRows,
    shouldBuildSeasonStandRows,
    teamOverviewSlice.enabled,
    teamOverviewSlice.error,
    teamOverviewSlice.rows,
    transferSummaryByTeamId,
  ]);

  return { seasonStandRows };
}
