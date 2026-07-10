import { useMemo } from "react";

import { sortTableRows as sortRows } from "@/components/foundation/FoundationTableUi";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import {
  buildPpAreaFormBonusByTeamId,
  createEmptyPpAreaFormBonusTotals,
  resolvePpAreaTotalsFromSeasonRow,
} from "@/lib/foundation/pp-area-form-bonus";
import type {
  FoundationApplySummary,
  FoundationPrizePreviewResponse,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  buildMetricRankClassMap,
  buildSharedRankMap,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import {
  buildSeasonOverviewOptions,
  type SeasonOverviewOption,
} from "@/lib/foundation/tabs/use-season-v2-panel-derivations";
import {
  getPrizePreviewHardBlocked,
  getPrizePreviewRows,
  getSeasonEndChampionRow,
  getSelectedPrizePreviewRow,
} from "@/lib/foundation/tabs/use-prize-panel-derivations";
import {
  shouldBuildSeasonEndChampionRow as resolveShouldBuildSeasonEndChampionRow,
} from "@/lib/foundation/tabs/season-v2-derivations";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";

type SeasonSnapshotInput = NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number];

export type PrizeApplyState =
  | { status: "applied"; label: string }
  | { status: "blocked"; label: string }
  | { status: "open"; label: string }
  | { status: "warning"; label: string }
  | { status: "ready"; label: string };

export function shouldBuildFoundationPpAreaTableDerivations(shouldBuildPpAreaRows: boolean): boolean {
  return shouldBuildPpAreaRows;
}

export function shouldBuildFoundationPrizePreviewDerivations(shouldLoadPrizePreviewFeed: boolean): boolean {
  return shouldLoadPrizePreviewFeed;
}

export function shouldBuildFoundationSeasonEndChampionRow(activeView: FoundationViewId): boolean {
  return resolveShouldBuildSeasonEndChampionRow(activeView);
}

export function useFoundationCrossTabSeasonPrize(input: {
  activeView: FoundationViewId;
  shouldBuildPpAreaRows: boolean;
  shouldBuildSeasonHistorySnapshots: boolean;
  shouldBuildSeasonOverviewOptions: boolean;
  shouldLoadPrizePreviewFeed: boolean;
  gameState: GameState;
  seasonStandRows: TeamManagementSnapshotRow[];
  seasonFormBonusByTeamId: ReturnType<typeof buildPpAreaFormBonusByTeamId>;
  tableSorts: Record<string, SortState>;
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
  cashApplyFeed: FoundationApplySummary | null;
  selectedTeam: Team | null;
}) {
  const shouldBuildPpAreaTableDerivations = shouldBuildFoundationPpAreaTableDerivations(input.shouldBuildPpAreaRows);
  const shouldBuildPrizePreviewDerivations = shouldBuildFoundationPrizePreviewDerivations(
    input.shouldLoadPrizePreviewFeed,
  );
  const shouldBuildSeasonEndChampionRow = shouldBuildFoundationSeasonEndChampionRow(input.activeView);

  const ppAreaRows = useMemo(() => {
    if (!input.shouldBuildPpAreaRows) {
      return [];
    }
    return input.seasonStandRows
      .map((row) => {
        const pps = resolvePpAreaTotalsFromSeasonRow({
          disciplineValues: row.disciplineValues,
          ppsTotal: row.ppsTotal,
          ppsPow: row.ppsPow,
          ppsSpe: row.ppsSpe,
          ppsMen: row.ppsMen,
          ppsSoc: row.ppsSoc,
        });

        return {
          team: row.team,
          pps,
          formBonus: input.seasonFormBonusByTeamId[row.teamId] ?? createEmptyPpAreaFormBonusTotals(),
        };
      })
      .sort((left, right) => {
        if (right.pps.total !== left.pps.total) {
          return right.pps.total - left.pps.total;
        }
        return left.team.name.localeCompare(right.team.name, "de");
      })
      .map((row, index, sortedRows) => {
        const buildAreaRank = (selector: (entry: (typeof sortedRows)[number]) => number) =>
          buildSharedRankMap(
            sortedRows.map((entry) => ({
              teamId: entry.team.teamId,
              value: selector(entry),
            })),
          ).get(row.team.teamId) ?? 0;

        return {
          ...row,
          rank: index + 1,
          areaRanks: {
            total: index + 1,
            pow: buildAreaRank((entry) => entry.pps.pow),
            spe: buildAreaRank((entry) => entry.pps.spe),
            men: buildAreaRank((entry) => entry.pps.men),
            soc: buildAreaRank((entry) => entry.pps.soc),
          },
        };
      });
  }, [input.seasonFormBonusByTeamId, input.seasonStandRows, input.shouldBuildPpAreaRows]);

  const seasonHistorySnapshots = useMemo(
    (): SeasonSnapshotInput[] =>
      input.shouldBuildSeasonHistorySnapshots
        ? [...(input.gameState.seasonState.seasonSnapshots ?? [])].sort((left, right) =>
            right.seasonId.localeCompare(left.seasonId, "de"),
          )
        : [],
    [input.gameState.seasonState.seasonSnapshots, input.shouldBuildSeasonHistorySnapshots],
  );

  const seasonOverviewOptions = useMemo(
    (): SeasonOverviewOption[] =>
      buildSeasonOverviewOptions({
        gameState: input.gameState,
        seasonHistorySnapshots,
        shouldBuildFull: input.shouldBuildSeasonOverviewOptions,
      }),
    [input.gameState, input.shouldBuildSeasonOverviewOptions, seasonHistorySnapshots],
  );

  const sortedPpAreaRows = useMemo(
    () =>
      shouldBuildPpAreaTableDerivations
        ? sortRows(ppAreaRows, input.tableSorts.ppArea, {
            rank: (row) => row.rank,
            team: (row) => row.team.name,
            pps: (row) => row.pps.total,
            pow: (row) => row.pps.pow,
            spe: (row) => row.pps.spe,
            men: (row) => row.pps.men,
            soc: (row) => row.pps.soc,
          })
        : [],
    [input.tableSorts.ppArea, ppAreaRows, shouldBuildPpAreaTableDerivations],
  );

  const ppAreaRankClassMaps = useMemo(
    () =>
      shouldBuildPpAreaTableDerivations
        ? {
            total: buildMetricRankClassMap(ppAreaRows.map((row) => ({ id: row.team.teamId, value: row.pps.total }))),
            pow: buildMetricRankClassMap(ppAreaRows.map((row) => ({ id: row.team.teamId, value: row.pps.pow }))),
            spe: buildMetricRankClassMap(ppAreaRows.map((row) => ({ id: row.team.teamId, value: row.pps.spe }))),
            men: buildMetricRankClassMap(ppAreaRows.map((row) => ({ id: row.team.teamId, value: row.pps.men }))),
            soc: buildMetricRankClassMap(ppAreaRows.map((row) => ({ id: row.team.teamId, value: row.pps.soc }))),
          }
        : {
            total: new Map<string, string>(),
            pow: new Map<string, string>(),
            spe: new Map<string, string>(),
            men: new Map<string, string>(),
            soc: new Map<string, string>(),
          },
    [ppAreaRows, shouldBuildPpAreaTableDerivations],
  );

  const ppAreaMetricPools = useMemo(
    () =>
      shouldBuildPpAreaTableDerivations
        ? {
            total: ppAreaRows.map((row) => row.pps.total),
            pow: ppAreaRows.map((row) => row.pps.pow),
            spe: ppAreaRows.map((row) => row.pps.spe),
            men: ppAreaRows.map((row) => row.pps.men),
            soc: ppAreaRows.map((row) => row.pps.soc),
          }
        : {
            total: [] as number[],
            pow: [] as number[],
            spe: [] as number[],
            men: [] as number[],
            soc: [] as number[],
          },
    [ppAreaRows, shouldBuildPpAreaTableDerivations],
  );

  const prizePreviewRows = useMemo(
    () => (shouldBuildPrizePreviewDerivations ? getPrizePreviewRows(input.prizePreviewFeed) : []),
    [input.prizePreviewFeed, shouldBuildPrizePreviewDerivations],
  );

  const prizePreviewHardBlocked = useMemo(
    () => (shouldBuildPrizePreviewDerivations ? getPrizePreviewHardBlocked(input.prizePreviewFeed) : []),
    [input.prizePreviewFeed, shouldBuildPrizePreviewDerivations],
  );

  const selectedPrizePreviewRow = useMemo(
    () =>
      shouldBuildPrizePreviewDerivations
        ? getSelectedPrizePreviewRow(prizePreviewRows, input.selectedTeam?.teamId)
        : null,
    [input.selectedTeam?.teamId, prizePreviewRows, shouldBuildPrizePreviewDerivations],
  );

  const seasonEndChampionRow = useMemo(
    () =>
      shouldBuildSeasonEndChampionRow
        ? getSeasonEndChampionRow(input.activeView, input.seasonStandRows)
        : null,
    [input.activeView, input.seasonStandRows, shouldBuildSeasonEndChampionRow],
  );

  const currentSeasonCashPrizeApplyLogs = useMemo(
    () =>
      shouldBuildPrizePreviewDerivations
        ? (input.gameState.seasonState.cashPrizeApplyLogs ?? []).filter(
            (log) => log.seasonId === input.gameState.season.id,
          )
        : [],
    [
      input.gameState.season.id,
      input.gameState.seasonState.cashPrizeApplyLogs,
      shouldBuildPrizePreviewDerivations,
    ],
  );

  const prizeApplyState = useMemo((): PrizeApplyState => {
    if (!shouldBuildPrizePreviewDerivations) {
      return { status: "open", label: "Preisgeld noch offen" };
    }
    if (currentSeasonCashPrizeApplyLogs.length > 0 || input.cashApplyFeed?.applied) {
      return {
        status: "applied",
        label: currentSeasonCashPrizeApplyLogs.length > 1 ? "already_applied" : "Preisgeld angewendet",
      };
    }
    if (prizePreviewHardBlocked.length > 0) {
      return { status: "blocked", label: "blocked" };
    }
    if (!input.prizePreviewFeed) {
      return { status: "open", label: "Preisgeld noch offen" };
    }
    if (input.prizePreviewFeed.source.prizeTable === "missing" || input.prizePreviewFeed.source.placementTable === "missing") {
      return { status: "warning", label: "missing_source" };
    }
    return { status: "ready", label: "Preisgeld noch offen" };
  }, [
    currentSeasonCashPrizeApplyLogs.length,
    input.cashApplyFeed?.applied,
    input.prizePreviewFeed,
    prizePreviewHardBlocked,
    shouldBuildPrizePreviewDerivations,
  ]);

  const prizeAuditCompact = useMemo(() => {
    if (!shouldBuildPrizePreviewDerivations) {
      return { largeRankChanges: 0, missingSourceTeams: 0 };
    }
    const largeRankChanges = prizePreviewRows.filter((row) => Math.abs(row.rankChangePrize?.rankDelta ?? 0) >= 10).length;
    const missingSourceTeams = prizePreviewRows.filter(
      (row) =>
        row.warnings.includes("missing_rank") ||
        row.warnings.includes("missing_prize") ||
        row.rankChangePrize?.warning === "start_rank_source_missing" ||
        row.rankChangePrize?.source === "missing",
    ).length;
    return { largeRankChanges, missingSourceTeams };
  }, [prizePreviewRows, shouldBuildPrizePreviewDerivations]);

  return {
    ppAreaRows,
    seasonHistorySnapshots,
    seasonOverviewOptions,
    sortedPpAreaRows,
    ppAreaRankClassMaps,
    ppAreaMetricPools,
    prizePreviewRows,
    prizePreviewHardBlocked,
    selectedPrizePreviewRow,
    seasonEndChampionRow,
    currentSeasonCashPrizeApplyLogs,
    prizeApplyState,
    prizeAuditCompact,
  };
}
