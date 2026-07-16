import { useDeferredValue, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { TransferHistoryV2Row } from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
import { getPlayerPortraitMediaModel } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import type { FoundationTransferHistoryResponse, SortState } from "@/lib/foundation/tabs/cockpit-types";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

export const TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE = 50;
export const HISTORY_ALL_SEASONS_FILTER = "__ALL_SEASONS__";

function roundViewNumber(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getTransferSourceLabel(source: string | null | undefined) {
  if (!source) {
    return "—";
  }

  const labels: Record<string, string> = {
    manual_transfermarkt_buy: "Manual Buy",
    manual_transfermarkt_sell: "Manual Sell",
    auto_roster_fill: "Setup / Auto Roster Fill",
    ai_roster_fill: "Setup / AI Roster Fill",
    smoke_setup: "Smoke/Setup",
  };

  return labels[source] ?? source.replaceAll("_", " ");
}

export type HistoryV2PlayerRatingsById = Map<
  string,
  { ovrNormalized?: number | null; ppsSeason?: number | null; mvs?: number | null }
>;

export interface UseHistoryV2DerivationsInput {
  activeSaveId: string;
  gameState: GameState;
  historyFeed: FoundationTransferHistoryResponse | null;
  playerRatingsById: HistoryV2PlayerRatingsById;
  transferHistorySort: SortState;
  seasonFilter: string;
  onSeasonFilterChange: Dispatch<SetStateAction<string>>;
  teamFilter: string;
  typeFilter: string;
  classFilter: string;
  sourceFilter: string;
  search: string;
}

/**
 * Transfer history panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationHistoryV2ShellHost` is mounted (`activeView === "history"` or `"historyV2"`).
 */
export function useHistoryV2Derivations(input: UseHistoryV2DerivationsInput) {
  const {
    activeSaveId,
    gameState,
    historyFeed,
    playerRatingsById,
    transferHistorySort,
    seasonFilter,
    onSeasonFilterChange,
    teamFilter,
    typeFilter,
    classFilter,
    sourceFilter,
    search,
  } = input;

  const deferredSearch = useDeferredValue(search);
  const [historyPage, setHistoryPage] = useState(1);
  const historyAllSeasonsSelected = seasonFilter === HISTORY_ALL_SEASONS_FILTER;

  useEffect(() => {
    setHistoryPage(1);
  }, [activeSaveId]);

  const transferSeasonOptions = useMemo(() => {
    const labelBySeasonId = new Map<string, string>();
    labelBySeasonId.set(
      gameState.season.id,
      getCanonicalSeasonLabel({
        seasonId: gameState.season.id,
        seasonName: gameState.season.name,
      }),
    );

    for (const entry of gameState.transferHistory) {
      labelBySeasonId.set(
        entry.seasonId,
        getCanonicalSeasonLabel({
          seasonId: entry.seasonId,
          seasonName: entry.seasonLabel ?? null,
        }),
      );
    }

    for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) {
      labelBySeasonId.set(
        snapshot.seasonId,
        getCanonicalSeasonLabel({
          seasonId: snapshot.seasonId,
          seasonName: snapshot.seasonName,
        }),
      );
    }

    return Array.from(labelBySeasonId.entries())
      .sort(([leftId], [rightId]) => rightId.localeCompare(leftId, "de", { numeric: true }))
      .map(([seasonId, label]) => ({ seasonId, label }));
  }, [
    gameState.season.id,
    gameState.season.name,
    gameState.seasonState.seasonSnapshots,
    gameState.transferHistory,
  ]);

  useEffect(() => {
    if (
      seasonFilter !== HISTORY_ALL_SEASONS_FILTER &&
      !transferSeasonOptions.some((option) => option.seasonId === seasonFilter)
    ) {
      onSeasonFilterChange(gameState.season.id);
    }
  }, [gameState.season.id, onSeasonFilterChange, seasonFilter, transferSeasonOptions]);

  useEffect(() => {
    setHistoryPage(1);
  }, [
    seasonFilter,
    teamFilter,
    typeFilter,
    classFilter,
    sourceFilter,
    deferredSearch,
    transferHistorySort.direction,
    transferHistorySort.key,
  ]);

  useEffect(() => {
    if (historyFeed?.offset === 0) {
      setHistoryPage(1);
    }
  }, [historyFeed]);

  const historyPlayerById = useMemo(
    () => new Map(gameState.players.map((player) => [player.id, player] as const)),
    [gameState.players],
  );

  const transferHistoryProfitById = useMemo(() => {
    const purchaseMap = new Map<string, number>();
    const profitByTransferId = new Map<string, number | null>();
    const sortedEntries = [...(historyFeed?.items ?? [])].sort(
      (left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt),
    );

    for (const entry of sortedEntries) {
      if (entry.type === "buy" && entry.toTeamId) {
        purchaseMap.set(`${entry.toTeamId}:${entry.playerId}`, entry.fee);
        continue;
      }

      if (entry.type === "sell" && entry.fromTeamId) {
        const key = `${entry.fromTeamId}:${entry.playerId}`;
        const previousBuyFee = purchaseMap.get(key);
        profitByTransferId.set(
          entry.transferId,
          previousBuyFee != null ? roundViewNumber(entry.fee - previousBuyFee, 2) : null,
        );
        purchaseMap.delete(key);
      }
    }

    return profitByTransferId;
  }, [historyFeed]);

  const transferHistoryClassOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (historyFeed?.items ?? [])
            .map((entry) => historyPlayerById.get(entry.playerId)?.className ?? null)
            .filter(Boolean) as string[],
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [historyFeed, historyPlayerById],
  );

  const transferHistorySourceOptions = useMemo(
    () =>
      Array.from(new Set((historyFeed?.items ?? []).map((entry) => entry.source ?? "missing_source"))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [historyFeed],
  );

  const transferHistoryRows = useMemo(() => {
    return (historyFeed?.items ?? [])
      .map((entry) => {
        const player = historyPlayerById.get(entry.playerId) ?? null;
        const portrait = getPlayerPortraitMediaModel({
          id: entry.playerId,
          name: entry.playerName,
          portraitUrl: player?.portraitUrl ?? null,
          portraitPath: player?.portraitPath ?? null,
        });
        const playerRating = playerRatingsById.get(entry.playerId) ?? null;
        const normalizedSource = entry.source ?? "missing_source";
        const economyBenchmark = player ? resolvePlayerEconomyContract({ playerId: player.id, player }) : null;
        const salaryBenchmark =
          entry.type === "buy" && economyBenchmark?.expectedSalary != null ? economyBenchmark.expectedSalary : null;
        const salaryDelta =
          salaryBenchmark != null && Number.isFinite(entry.salary)
            ? roundViewNumber(entry.salary - salaryBenchmark, 2)
            : null;

        return {
          ...entry,
          player,
          portraitUrl: portrait.previewSrc ?? portrait.src,
          portraitInitials: portrait.initials,
          seasonLabel: entry.seasonLabel ?? entry.seasonId,
          className: player?.className ?? null,
          race: player?.race ?? null,
          pow: player?.coreStats.pow ?? null,
          spe: player?.coreStats.spe ?? null,
          men: player?.coreStats.men ?? null,
          soc: player?.coreStats.soc ?? null,
          ovr: playerRating?.ovrNormalized ?? null,
          pps: playerRating?.ppsSeason ?? null,
          mvs: playerRating?.mvs ?? null,
          guv: entry.type === "sell" ? transferHistoryProfitById.get(entry.transferId) ?? null : null,
          salaryBenchmark,
          salaryDelta,
          sourceKey: normalizedSource,
          sourceLabel: getTransferSourceLabel(entry.source),
        };
      })
      .filter((entry) => {
        const normalizedHistorySearch = deferredSearch.trim().toLowerCase();
        const matchesSeason =
          seasonFilter === HISTORY_ALL_SEASONS_FILTER ||
          entry.seasonId === seasonFilter ||
          entry.seasonLabel === seasonFilter;
        const matchesType = typeFilter === "ALL" || entry.type === typeFilter;
        const matchesTeam =
          teamFilter === "ALL" || entry.fromTeamId === teamFilter || entry.toTeamId === teamFilter;
        const matchesClass = classFilter === "ALL" || entry.className === classFilter;
        const matchesSource = sourceFilter === "ALL" || entry.sourceKey === sourceFilter;
        const matchesSearch =
          normalizedHistorySearch.length === 0 || entry.playerName.toLowerCase().includes(normalizedHistorySearch);

        return matchesSeason && matchesType && matchesTeam && matchesClass && matchesSource && matchesSearch;
      }) as TransferHistoryV2Row[];
  }, [
    classFilter,
    deferredSearch,
    historyFeed,
    historyPlayerById,
    playerRatingsById,
    seasonFilter,
    sourceFilter,
    teamFilter,
    transferHistoryProfitById,
    typeFilter,
  ]);

  const transferHistorySummary = useMemo(() => {
    const buyRows = transferHistoryRows.filter((row) => row.type === "buy");
    const sellRows = transferHistoryRows.filter((row) => row.type === "sell");
    const totalFee = transferHistoryRows.reduce((sum, row) => sum + row.fee, 0);
    const buyFee = buyRows.reduce((sum, row) => sum + row.fee, 0);
    const sellFee = sellRows.reduce((sum, row) => sum + row.fee, 0);
    const sellProfitRows = sellRows.filter((row) => row.guv != null);
    const totalProfit = sellProfitRows.reduce((sum, row) => sum + (row.guv ?? 0), 0);

    return {
      count: transferHistoryRows.length,
      buyFee,
      sellFee,
      averageFee: transferHistoryRows.length > 0 ? totalFee / transferHistoryRows.length : null,
      averageProfit: sellProfitRows.length > 0 ? totalProfit / sellProfitRows.length : null,
      netTransferBalance: sellFee - buyFee,
    };
  }, [transferHistoryRows]);

  const transferHistorySeasonBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of historyFeed?.items ?? []) {
      const label = entry.seasonLabel ?? entry.seasonId;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries()).sort(([left], [right]) =>
      left.localeCompare(right, "de", { numeric: true }),
    );
  }, [historyFeed]);

  const transferHistoryRequestedSeasonLabel = historyFeed?.saveContext?.requestedSeasonId ?? "Alle Seasons";
  const transferHistoryResolvedSeasonLabel =
    historyFeed?.saveContext?.requestedSeasonId == null
      ? "Alle Seasons"
      : historyFeed?.saveContext?.resolvedSeasonId ?? historyFeed?.scope?.seasonId ?? gameState.season.id;

  const sortedTransferHistoryRows = useMemo(
    () =>
      sortFoundationTableRows(transferHistoryRows, transferHistorySort, {
        name: (row) => row.playerName,
        season: (row) => row.seasonLabel,
        from: (row) => row.fromTeamName ?? row.fromTeamId ?? "FA",
        to: (row) => row.toTeamName ?? row.toTeamId ?? "FA",
        type: (row) => row.type,
        fee: (row) => row.fee,
        guv: (row) => row.guv ?? Number.NEGATIVE_INFINITY,
        marketValue: (row) => row.marketValue,
        pow: (row) => row.pow ?? Number.NEGATIVE_INFINITY,
        spe: (row) => row.spe ?? Number.NEGATIVE_INFINITY,
        men: (row) => row.men ?? Number.NEGATIVE_INFINITY,
        soc: (row) => row.soc ?? Number.NEGATIVE_INFINITY,
        salary: (row) => row.salary,
        className: (row) => row.className ?? "",
        source: (row) => row.sourceLabel,
        remainingContractLength: (row) => row.remainingContractLength ?? Number.NEGATIVE_INFINITY,
        happenedAt: (row) => Date.parse(row.happenedAt),
      }),
    [transferHistoryRows, transferHistorySort],
  );

  const historyPageCount = useMemo(
    () =>
      historyAllSeasonsSelected
        ? Math.max(1, Math.ceil(sortedTransferHistoryRows.length / TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE))
        : 1,
    [historyAllSeasonsSelected, sortedTransferHistoryRows.length],
  );

  const visibleTransferHistoryRows = useMemo(
    () =>
      historyAllSeasonsSelected
        ? sortedTransferHistoryRows.slice(
            (historyPage - 1) * TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE,
            historyPage * TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE,
          )
        : sortedTransferHistoryRows,
    [historyAllSeasonsSelected, historyPage, sortedTransferHistoryRows],
  );

  const historyVisibleRangeLabel = useMemo(() => {
    if (sortedTransferHistoryRows.length === 0) {
      return "0–0";
    }
    if (!historyAllSeasonsSelected) {
      return `1–${visibleTransferHistoryRows.length}`;
    }
    const start = (historyPage - 1) * TRANSFER_HISTORY_ALL_SEASONS_PAGE_SIZE + 1;
    const end = start + visibleTransferHistoryRows.length - 1;
    return `${start}–${end}`;
  }, [historyAllSeasonsSelected, historyPage, sortedTransferHistoryRows.length, visibleTransferHistoryRows.length]);

  useEffect(() => {
    const maxLoadedPage = Math.max(1, historyPageCount);
    if (historyPage > maxLoadedPage) {
      setHistoryPage(maxLoadedPage);
    }
  }, [historyPage, historyPageCount]);

  return {
    allSeasonsValue: HISTORY_ALL_SEASONS_FILTER,
    transferSeasonOptions,
    transferHistoryRequestedSeasonLabel,
    transferHistoryResolvedSeasonLabel,
    transferHistorySeasonBreakdown,
    transferHistorySummary,
    sortedTransferHistoryRows,
    visibleTransferHistoryRows,
    historyVisibleRangeLabel,
    historyAllSeasonsSelected,
    historyPage,
    historyPageCount,
    transferHistoryClassOptions,
    transferHistorySourceOptions,
    getTransferSourceLabel,
    onPrevPage: () => setHistoryPage((current) => Math.max(1, current - 1)),
    onNextPage: () => setHistoryPage((current) => Math.min(historyPageCount, current + 1)),
    resetHistoryPage: () => setHistoryPage(1),
  };
}
