"use client";

import dynamic from "next/dynamic";
import type { Dispatch, SetStateAction } from "react";

import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationTransferHistoryResponse, SortState } from "@/lib/foundation/tabs/cockpit-types";
import {
  useHistoryV2Derivations,
  type HistoryV2PlayerRatingsById,
} from "@/lib/foundation/tabs/use-history-v2-derivations";

const TransferHistoryV2Client = dynamic(() => import("@/app/foundation/transfer-history-v2/TransferHistoryV2Client"), {
  ssr: false,
  loading: () => (
    <FoundationPanelSkeleton variant="default" label="Historie wird geladen…" sectionClassName="transfer-history-v2-shell" />
  ),
});

export type FoundationHistoryV2ShellHostProps = {
  sourceBadgeLabel: string;
  activeSaveId: string;
  saveName: string;
  gameState: GameState;
  historyFeed: FoundationTransferHistoryResponse | null;
  playerRatingsById: HistoryV2PlayerRatingsById;
  transferHistorySort: SortState;
  seasonFilter: string;
  onSeasonFilterChange: Dispatch<SetStateAction<string>>;
  teamFilter: string;
  onTeamFilterChange: Dispatch<SetStateAction<string>>;
  typeFilter: string;
  onTypeFilterChange: Dispatch<SetStateAction<string>>;
  classFilter: string;
  onClassFilterChange: Dispatch<SetStateAction<string>>;
  sourceFilter: string;
  onSourceFilterChange: Dispatch<SetStateAction<string>>;
  search: string;
  onSearchChange: Dispatch<SetStateAction<string>>;
  teamOptions: Array<{ teamId: string; name: string; shortCode: string }>;
  onOpenPlayer: (playerId: string) => void;
  onOpenTeam: (teamId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore: () => void;
};

/**
 * Transfer history shell host (Strangler Phase 5.3). Mounts TransferHistoryV2Client
 * only while the history/historyV2 tab is active.
 */
export default function FoundationHistoryV2ShellHost({
  sourceBadgeLabel,
  activeSaveId,
  saveName,
  gameState,
  historyFeed,
  playerRatingsById,
  transferHistorySort,
  seasonFilter,
  onSeasonFilterChange,
  teamFilter,
  onTeamFilterChange,
  typeFilter,
  onTypeFilterChange,
  classFilter,
  onClassFilterChange,
  sourceFilter,
  onSourceFilterChange,
  search,
  onSearchChange,
  teamOptions,
  onOpenPlayer,
  onOpenTeam,
  hasMore,
  loadingMore,
  onLoadMore,
}: FoundationHistoryV2ShellHostProps) {
  const {
    allSeasonsValue,
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
    onPrevPage,
    onNextPage,
    resetHistoryPage,
  } = useHistoryV2Derivations({
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
  });

  return (
    <section className="panel" id="transfer-history">
      <div className="panel-header">
        <TooltipHeading
          as="h2"
          tooltip="Read-only Verlauf aus dem aktiven Save mit Save- und Season-Scope. Filter und Spalten bleiben direkt daneben."
        >
          Transferhistorie
        </TooltipHeading>
        <span className="pill foundation-source-pill">source: active local save</span>
      </div>
      <TransferHistoryV2Client
        sourceBadgeLabel={sourceBadgeLabel}
        saveName={saveName}
        requestedScopeLabel={`${historyFeed?.saveContext?.requestedSaveId ?? activeSaveId} / ${transferHistoryRequestedSeasonLabel}`}
        resolvedScopeLabel={`${historyFeed?.saveContext?.resolvedSaveId ?? historyFeed?.scope?.saveId ?? activeSaveId} / ${transferHistoryResolvedSeasonLabel}`}
        totalLoaded={historyFeed?.items.length ?? 0}
        totalAvailable={historyFeed?.total ?? 0}
        seasonBreakdown={transferHistorySeasonBreakdown}
        summary={transferHistorySummary}
        filteredRows={sortedTransferHistoryRows}
        visibleRows={visibleTransferHistoryRows}
        historyVisibleRangeLabel={historyVisibleRangeLabel}
        isAllSeasons={historyAllSeasonsSelected}
        historyPage={historyPage}
        historyPageCount={historyPageCount}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        scopeWarning={historyFeed?.saveContext?.scopeWarning ?? null}
        error={historyFeed?.error ?? null}
        seasonFilter={seasonFilter}
        allSeasonsValue={allSeasonsValue}
        seasonOptions={transferSeasonOptions}
        teamFilter={teamFilter}
        teamOptions={teamOptions}
        typeFilter={typeFilter}
        classFilter={classFilter}
        sourceFilter={sourceFilter}
        classOptions={transferHistoryClassOptions}
        sourceOptions={transferHistorySourceOptions.map((sourceKey) => ({
          key: sourceKey,
          label: getTransferSourceLabel(sourceKey === "missing_source" ? null : sourceKey),
        }))}
        search={search}
        onSeasonFilterChange={onSeasonFilterChange}
        onTeamFilterChange={onTeamFilterChange}
        onTypeFilterChange={onTypeFilterChange}
        onClassFilterChange={onClassFilterChange}
        onSourceFilterChange={onSourceFilterChange}
        onSearchChange={onSearchChange}
        onResetFilters={() => {
          onSeasonFilterChange(gameState.season.id);
          resetHistoryPage();
          onTeamFilterChange("ALL");
          onTypeFilterChange("ALL");
          onClassFilterChange("ALL");
          onSourceFilterChange("ALL");
          onSearchChange("");
        }}
        onOpenPlayer={onOpenPlayer}
        onOpenTeam={onOpenTeam}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
      />
    </section>
  );
}
