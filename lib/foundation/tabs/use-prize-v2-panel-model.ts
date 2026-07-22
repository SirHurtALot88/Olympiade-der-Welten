import { useEffect, useMemo, useState } from "react";

import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { GameState, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { getTeamAnnualLoanInstallment, getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import type {
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
  FoundationTableColumn,
  SortState,
} from "@/lib/foundation/tabs/cockpit-types";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundViewNumber(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function uniqueColumnIds(columnIds: string[]) {
  return [...new Set(columnIds.filter(Boolean))];
}

function applyStoredColumnOrder(
  columns: FoundationTableColumn[],
  columnOrder?: string[],
  pinnedLeft?: string[],
  pinnedRight?: string[],
) {
  const orderIndex = new Map((columnOrder ?? []).map((columnId, index) => [columnId, index]));
  const baseColumns = [...columns].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex == null && rightIndex == null) {
      return columns.findIndex((column) => column.id === left.id) - columns.findIndex((column) => column.id === right.id);
    }
    if (leftIndex == null) {
      return 1;
    }
    if (rightIndex == null) {
      return -1;
    }
    return leftIndex - rightIndex;
  });

  const columnById = new Map(baseColumns.map((column) => [column.id, column]));
  const leftPinnedColumns = uniqueColumnIds(pinnedLeft ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const rightPinnedColumns = uniqueColumnIds(pinnedRight ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const handled = new Set([...leftPinnedColumns, ...rightPinnedColumns].map((column) => column.id));
  const middleColumns = baseColumns.filter((column) => !handled.has(column.id));

  return [...leftPinnedColumns, ...middleColumns, ...rightPinnedColumns];
}

export interface PrizeV2Row {
  teamId: string;
  teamName: string;
  teamCode: string | null;
  logoUrl: string | null;
  logoInitials: string;
  rank: number | null;
  points: number | null;
  currentCash: number | null;
  basisCash: number | null;
  seasonCash: number | null;
  currentFactor: number | null;
  prizeMoney: number | null;
  sponsorCash: number | null;
  facilityIncome: number | null;
  bonusMalus: number | null;
  startRank: number | null;
  rankDelta: number | null;
  projectedCash: number | null;
  salaryTotal: number | null;
  status: string;
  warnings: string[];
  isSelected: boolean;
}

export interface UsePrizeV2PanelModelInput {
  gameState: GameState;
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
  prizePreviewRows: FoundationPrizePreviewItem[];
  selectedPrizePreviewRow: FoundationPrizePreviewItem | null;
  selectedTeam: Team | null;
  selectedRoster: RosterEntry[];
  selectedStandingRow: TeamManagementSnapshotRow | null;
  prizePreviewSort: SortState;
  tableColumnPreferences: Record<string, { columnOrder?: string[] } | undefined>;
  isTableColumnVisible: (tableId: string, columnId: string, visibleByDefault?: boolean) => boolean;
  getTablePinnedLeftIds: (tableId: string) => string[];
  getTablePinnedRightIds: (tableId: string) => string[];
}

export function usePrizeV2PanelModel({
  gameState,
  prizePreviewFeed,
  prizePreviewRows,
  selectedPrizePreviewRow,
  selectedTeam,
  selectedRoster,
  selectedStandingRow,
  prizePreviewSort,
  tableColumnPreferences,
  isTableColumnVisible,
  getTablePinnedLeftIds,
  getTablePinnedRightIds,
}: UsePrizeV2PanelModelInput) {
  const [prizeForecastRank, setPrizeForecastRank] = useState<number>(1);

  useEffect(() => {
    const defaultRank = selectedPrizePreviewRow?.rank ?? selectedStandingRow?.rank ?? 1;
    setPrizeForecastRank(clampValue(Math.round(defaultRank), 1, 32));
  }, [selectedPrizePreviewRow?.rank, selectedStandingRow?.rank, selectedTeam?.teamId]);

  const prizeForecastRankRow = useMemo(
    () => prizePreviewRows.find((row) => row.rank === prizeForecastRank) ?? null,
    [prizeForecastRank, prizePreviewRows],
  );

  const prizeForecastSalaryTotal = useMemo(() => {
    if (selectedPrizePreviewRow?.salaryTotal != null) {
      return selectedPrizePreviewRow.salaryTotal;
    }

    if (!selectedTeam) {
      return null;
    }

    return roundViewNumber(
      selectedRoster.reduce((sum, rosterEntry) => {
        const player = gameState.players.find((candidate) => candidate.id === rosterEntry.playerId) ?? null;
        return sum + (resolvePlayerEconomyContract({ player, rosterEntry }).salary ?? 0);
      }, 0),
      1,
    );
  }, [gameState.players, selectedPrizePreviewRow?.salaryTotal, selectedRoster, selectedTeam]);

  // Kredit-Kern (Fog of War): nur für das ausgewählte/aktive Manager-Team,
  // nie für ein fremdes Team, siehe `use-credits-view-model.ts`. Anders als
  // die öffentliche Preisgeld-Tabelle (`displayPrizePreviewRows`, alle Teams)
  // ist dieser 5-Seasons-Forecast schon heute exklusiv "Eigenes Team" —
  // die Kreditrate darf hier also mit in GuV/Cash einfließen, ohne fremde
  // Restschuld öffentlich zu machen.
  const selectedTeamLoanInstallment = useMemo(
    () => (selectedTeam ? getTeamAnnualLoanInstallment(gameState, selectedTeam.teamId) : 0),
    [gameState, selectedTeam],
  );
  const selectedTeamOutstandingDebt = useMemo(
    () => (selectedTeam ? getTeamOutstandingDebt(gameState, selectedTeam.teamId) : 0),
    [gameState, selectedTeam],
  );

  const prizeForecastRows = useMemo(() => {
    const startCash = selectedPrizePreviewRow?.currentCash ?? selectedTeam?.cash ?? null;
    const salaryTotal = prizeForecastSalaryTotal;
    // Sponsor-basierter Forecast: die aktuelle Sponsor- + Gebäude-Einnahme wird für 5 Seasons konstant
    // fortgeschrieben (Sponsoren werden pro Saison neu verhandelt → flache Annahme, kein Preisgeld mehr).
    const sponsorCash = selectedPrizePreviewRow?.sponsorCash ?? 0;
    const facilityIncome = selectedPrizePreviewRow?.facilityIncome ?? 0;
    const loanInstallment = selectedTeamLoanInstallment;

    if (startCash == null || salaryTotal == null) {
      return [];
    }

    const labels = ["GuV", "GuV +1", "GuV +2", "GuV +3", "GuV +4"];
    let runningCash = startCash;
    return labels.map((label) => {
      const projectedSalaryTotal = roundViewNumber(salaryTotal, 1);
      const projectedLoanInstallment = loanInstallment > 0 ? roundViewNumber(loanInstallment, 1) : null;
      const guv = roundViewNumber(
        sponsorCash + facilityIncome - projectedSalaryTotal - (projectedLoanInstallment ?? 0),
        1,
      );
      const cashAfter = roundViewNumber(runningCash + guv, 1);
      runningCash = cashAfter;

      return {
        label,
        factor: null as number | null,
        prizeMoney: null as number | null,
        sponsorCash: roundViewNumber(sponsorCash, 1),
        facilityIncome: roundViewNumber(facilityIncome, 1),
        salaryGrowthFactor: 1,
        salaryTotal: projectedSalaryTotal,
        loanInstallment: projectedLoanInstallment,
        guv,
        cashAfter,
      };
    });
  }, [
    prizeForecastSalaryTotal,
    selectedPrizePreviewRow?.currentCash,
    selectedPrizePreviewRow?.sponsorCash,
    selectedPrizePreviewRow?.facilityIncome,
    selectedTeam?.cash,
    selectedTeamLoanInstallment,
  ]);

  const sortedPrizePreviewRows = useMemo(
    () =>
      sortFoundationTableRows(prizePreviewRows, prizePreviewSort, {
        team: (row) => row.teamName,
        projectedRank: (row) => row.rank ?? Number.POSITIVE_INFINITY,
        points: (row) => row.points ?? Number.NEGATIVE_INFINITY,
        currentCash: (row) => row.currentCash ?? Number.NEGATIVE_INFINITY,
        basisCash: (row) => row.basisCash ?? Number.NEGATIVE_INFINITY,
        seasonCash: (row) => row.seasonCash ?? Number.NEGATIVE_INFINITY,
        prizeMoney: (row) => row.prizeMoney ?? Number.NEGATIVE_INFINITY,
        startRank: (row) => row.rankChangePrize?.startRank ?? Number.POSITIVE_INFINITY,
        rankDelta: (row) => row.rankChangePrize?.rankDelta ?? Number.NEGATIVE_INFINITY,
        rankChangePrize: (row) => row.rankChangePrize?.bonusMalus ?? Number.NEGATIVE_INFINITY,
        payoutIfTenBetter: (row) => row.payoutIfTenBetter ?? Number.NEGATIVE_INFINITY,
        payoutIfTenWorse: (row) => row.payoutIfTenWorse ?? Number.NEGATIVE_INFINITY,
        projectedCash: (row) => row.projectedCash ?? Number.NEGATIVE_INFINITY,
        status: (row) => row.status,
      }),
    [prizePreviewRows, prizePreviewSort],
  );

  const displayPrizePreviewRows = useMemo(() => {
    if (!selectedTeam?.teamId) {
      return sortedPrizePreviewRows;
    }
    const selectedRowIndex = sortedPrizePreviewRows.findIndex((row) => row.teamId === selectedTeam.teamId);
    if (selectedRowIndex <= 0) {
      return sortedPrizePreviewRows;
    }
    const selectedRow = sortedPrizePreviewRows[selectedRowIndex];
    return [selectedRow, ...sortedPrizePreviewRows.slice(0, selectedRowIndex), ...sortedPrizePreviewRows.slice(selectedRowIndex + 1)];
  }, [selectedTeam?.teamId, sortedPrizePreviewRows]);

  const prizeFutureSeasonLabels = useMemo(
    () => (prizePreviewFeed?.seasonFactors ?? []).filter((row) => row.seasonLabel !== "Aktuell"),
    [prizePreviewFeed],
  );

  const prizePreviewTableColumns = useMemo<FoundationTableColumn[]>(
    () => [
      { id: "team", label: "Team", dataKey: "team", defaultWidth: 220, minWidth: 170 },
      { id: "projectedRank", label: "Rang", dataKey: "projectedRank", defaultWidth: 84, minWidth: 68 },
      { id: "startRank", label: "Start", dataKey: "startRank", defaultWidth: 84, minWidth: 68 },
      { id: "rankDelta", label: "Δ Rang", dataKey: "rankDelta", defaultWidth: 92, minWidth: 74 },
      { id: "currentCash", label: "Cash aktuell", dataKey: "currentCash", defaultWidth: 120, minWidth: 96 },
      { id: "basisCash", label: "Basis Cash", dataKey: "basisCash", defaultWidth: 118, minWidth: 96 },
      { id: "seasonCash", label: "Season-Anteil", dataKey: "seasonCash", defaultWidth: 128, minWidth: 100 },
      { id: "currentFactor", label: "Faktor", dataKey: "currentFactor", defaultWidth: 88, minWidth: 74 },
      { id: "prizeMoney", label: "Preisgeld", dataKey: "prizeMoney", defaultWidth: 116, minWidth: 92 },
      { id: "rankChangePrize", label: "Rank Bonus", dataKey: "rankChangePrize", defaultWidth: 118, minWidth: 96 },
      { id: "payoutIfTenBetter", label: "+10 Plätze", dataKey: "payoutIfTenBetter", defaultWidth: 116, minWidth: 92 },
      { id: "payoutIfTenWorse", label: "-10 Plätze", dataKey: "payoutIfTenWorse", defaultWidth: 116, minWidth: 92 },
      { id: "projectedCash", label: "Cash nachher", dataKey: "projectedCash", defaultWidth: 126, minWidth: 100 },
      ...prizeFutureSeasonLabels.map((entry) => ({
        id: `future-${entry.seasonLabel}`,
        label: entry.seasonLabel,
        dataKey: `future-${entry.seasonLabel}`,
        defaultWidth: 112,
        minWidth: 90,
        visibleByDefault: false,
      })),
      { id: "warnings", label: "Hinweise", dataKey: "warnings", defaultWidth: 260, minWidth: 170 },
    ],
    [prizeFutureSeasonLabels],
  );

  const visiblePrizePreviewColumns = useMemo(
    () =>
      applyStoredColumnOrder(
        prizePreviewTableColumns,
        tableColumnPreferences.prizePreviewTable?.columnOrder,
        getTablePinnedLeftIds("prizePreviewTable"),
        getTablePinnedRightIds("prizePreviewTable"),
      ).filter((column) => isTableColumnVisible("prizePreviewTable", column.id, column.visibleByDefault)),
    [
      prizePreviewTableColumns,
      tableColumnPreferences,
      isTableColumnVisible,
      getTablePinnedLeftIds,
      getTablePinnedRightIds,
    ],
  );

  const prizeV2Rows = useMemo(
    () =>
      sortedPrizePreviewRows.map((row) => {
        const team = gameState.teams.find((entry) => entry.teamId === row.teamId) ?? null;
        const logoModel = team
          ? getTeamLogoModel(team, { variant: "thumb" })
          : {
              src: null,
              initials:
                row.teamCode ||
                row.teamName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("") ||
                "?",
            };
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          teamCode: row.teamCode,
          logoUrl: logoModel.src,
          logoInitials: logoModel.initials,
          rank: row.rank,
          points: row.points ?? null,
          currentCash: row.currentCash ?? null,
          basisCash: row.basisCash ?? null,
          seasonCash: row.seasonCash ?? null,
          currentFactor: prizePreviewFeed?.summary.currentFactor ?? null,
          prizeMoney: row.prizeMoney ?? null,
          sponsorCash: row.sponsorCash ?? null,
          facilityIncome: row.facilityIncome ?? null,
          bonusMalus: row.rankChangePrize?.bonusMalus ?? null,
          startRank: row.rankChangePrize?.startRank ?? null,
          rankDelta: row.rankChangePrize?.rankDelta ?? null,
          projectedCash: row.projectedCash ?? null,
          salaryTotal: row.salaryTotal ?? null,
          status: row.status,
          warnings: row.warnings,
          isSelected: row.teamId === selectedTeam?.teamId,
        };
      }),
    [gameState.teams, prizePreviewFeed?.summary.currentFactor, selectedTeam?.teamId, sortedPrizePreviewRows],
  );

  const prizeV2SelectedTeamSummary = useMemo(() => {
    if (!selectedPrizePreviewRow) {
      return null;
    }
    return {
      teamId: selectedPrizePreviewRow.teamId,
      teamName: selectedPrizePreviewRow.teamName,
      teamCode: selectedPrizePreviewRow.teamCode,
      rank: selectedPrizePreviewRow.rank,
      points: selectedPrizePreviewRow.points ?? null,
      currentCash: selectedPrizePreviewRow.currentCash ?? null,
      basisCash: selectedPrizePreviewRow.basisCash ?? null,
      seasonCash: selectedPrizePreviewRow.seasonCash ?? null,
      prizeMoney: selectedPrizePreviewRow.prizeMoney ?? null,
      bonusMalus: selectedPrizePreviewRow.rankChangePrize?.bonusMalus ?? null,
      projectedCash: selectedPrizePreviewRow.projectedCash ?? null,
      salaryTotal: selectedPrizePreviewRow.salaryTotal ?? null,
      payoutIfTenBetter: selectedPrizePreviewRow.payoutIfTenBetter ?? null,
      payoutIfTenWorse: selectedPrizePreviewRow.payoutIfTenWorse ?? null,
      loanInstallment: selectedTeamLoanInstallment > 0 ? selectedTeamLoanInstallment : null,
      outstandingDebt: selectedTeamOutstandingDebt > 0 ? selectedTeamOutstandingDebt : null,
    };
  }, [selectedPrizePreviewRow, selectedTeamLoanInstallment, selectedTeamOutstandingDebt]);

  const prizeV2LeaderRow = prizeV2Rows[0] ?? null;

  // Sponsor-Umbau: Team mit der höchsten projizierten Sponsor-Einnahme ("Top-Einnahme"-Story) + Liga-Summe.
  const prizeV2TopSponsorRow = useMemo(
    () => [...prizeV2Rows].sort((left, right) => (right.sponsorCash ?? -Infinity) - (left.sponsorCash ?? -Infinity))[0] ?? null,
    [prizeV2Rows],
  );
  const prizeV2TotalSponsorCash = useMemo(
    () => prizeV2Rows.reduce((sum, row) => sum + (row.sponsorCash ?? 0), 0),
    [prizeV2Rows],
  );

  const prizeV2SwingRow = useMemo(
    () =>
      [...prizeV2Rows].sort(
        (left, right) =>
          Math.abs(right.rankDelta ?? 0) - Math.abs(left.rankDelta ?? 0) || (left.rank ?? 99) - (right.rank ?? 99),
      )[0] ?? null,
    [prizeV2Rows],
  );

  const prizeV2RiskRow = useMemo(
    () =>
      [...prizeV2Rows].sort((left, right) => {
        const leftWarnings = left.warnings.length;
        const rightWarnings = right.warnings.length;
        if (rightWarnings !== leftWarnings) return rightWarnings - leftWarnings;
        return (left.projectedCash ?? Number.POSITIVE_INFINITY) - (right.projectedCash ?? Number.POSITIVE_INFINITY);
      })[0] ?? null,
    [prizeV2Rows],
  );

  const prizeV2FactorRows = useMemo(
    () => (prizePreviewFeed?.seasonFactors ?? []).map((entry) => ({ seasonLabel: entry.seasonLabel, factor: entry.factor ?? null })),
    [prizePreviewFeed],
  );

  const prizeV2Summary = useMemo(
    () => ({
      totalTeams: prizePreviewFeed?.summary.totalTeams ?? 0,
      calculableTeams: prizePreviewFeed?.summary.calculableTeams ?? 0,
      blockedItemsCount: prizePreviewFeed?.summary.blockedItemsCount ?? 0,
      currentFactor: prizePreviewFeed?.summary.currentFactor ?? null,
      futureSeasonCount: prizePreviewFeed?.summary.futureSeasonCount ?? 0,
      totalPrizeMoney: prizePreviewFeed?.summary.totalPrizeMoney ?? null,
      totalRankChangePrize: prizePreviewFeed?.summary.totalRankChangePrize ?? null,
      forecastSalaryFactorPassthrough: prizePreviewFeed?.summary.forecastSalaryFactorPassthrough ?? null,
    }),
    [prizePreviewFeed],
  );

  return {
    prizeForecastRank,
    setPrizeForecastRank,
    prizeForecastRankRow,
    prizeForecastRows,
    sortedPrizePreviewRows,
    displayPrizePreviewRows,
    prizeFutureSeasonLabels,
    prizePreviewTableColumns,
    visiblePrizePreviewColumns,
    prizeV2Rows,
    prizeV2SelectedTeamSummary,
    prizeV2LeaderRow,
    prizeV2TopSponsorRow,
    prizeV2TotalSponsorCash,
    prizeV2SwingRow,
    prizeV2RiskRow,
    prizeV2FactorRows,
    prizeV2Summary,
  };
}
