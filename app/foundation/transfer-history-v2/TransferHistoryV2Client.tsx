"use client";

import { useEffect, useMemo, useState } from "react";

import TransferHistoryV2NewLook from "@/app/foundation/transfer-history-v2/TransferHistoryV2NewLook";

export type TransferHistoryV2Row = {
  transferId: string;
  playerId: string;
  playerName: string;
  portraitUrl: string | null;
  portraitInitials: string;
  seasonId: string;
  seasonLabel: string;
  type: "buy" | "sell" | "contract_exit";
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  fee: number;
  salary: number;
  marketValue: number;
  guv: number | null;
  className: string | null;
  race: string | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  sourceLabel: string;
  happenedAt: string;
  matchdayId?: string | null;
  phase?: string | null;
  remainingContractLength?: number | null;
};

export type TransferHistoryV2ClientProps = {
  sourceBadgeLabel: string;
  saveName: string;
  /** #D10: Eigenes/gemanagtes Team (für die kumulative Netto-Ausgaben-Sparkline). Fog-safe: nur eigene, ohnehin sichtbare Deals. */
  ownTeamId?: string | null;
  requestedScopeLabel: string;
  resolvedScopeLabel: string;
  totalLoaded: number;
  totalAvailable: number;
  seasonBreakdown: Array<[string, number]>;
  summary: {
    count: number;
    buyFee: number;
    sellFee: number;
    averageFee: number | null;
    averageProfit: number | null;
    netTransferBalance: number;
  };
  filteredRows: TransferHistoryV2Row[];
  visibleRows: TransferHistoryV2Row[];
  historyVisibleRangeLabel: string;
  isAllSeasons: boolean;
  historyPage: number;
  historyPageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  scopeWarning?: string | null;
  error?: string | null;
  seasonFilter: string;
  allSeasonsValue: string;
  seasonOptions: Array<{ seasonId: string; label: string }>;
  teamFilter: string;
  teamOptions: Array<{ teamId: string; name: string; shortCode: string }>;
  typeFilter: string;
  classFilter: string;
  sourceFilter: string;
  classOptions: string[];
  sourceOptions: Array<{ key: string; label: string }>;
  search: string;
  onSeasonFilterChange: (value: string) => void;
  onTeamFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onClassFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onResetFilters: () => void;
  onOpenPlayer: (playerId: string) => void;
  onOpenTeam: (teamId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export type ActivityCard = {
  teamId: string;
  teamName: string;
  shortCode: string;
  volume: number;
  buys: number;
  sells: number;
  spend: number;
  income: number;
  net: number;
};

function getActivitySummary(rows: TransferHistoryV2Row[], teamOptions: TransferHistoryV2ClientProps["teamOptions"]) {
  const shortCodeById = new Map(teamOptions.map((team) => [team.teamId, team.shortCode] as const));
  const nameById = new Map(teamOptions.map((team) => [team.teamId, team.name] as const));
  const entries = new Map<string, ActivityCard>();

  const ensureEntry = (teamId: string, fallbackName: string | null | undefined) => {
    const existing = entries.get(teamId);
    if (existing) return existing;
    const next: ActivityCard = {
      teamId,
      teamName: nameById.get(teamId) ?? fallbackName ?? teamId,
      shortCode: shortCodeById.get(teamId) ?? teamId,
      volume: 0,
      buys: 0,
      sells: 0,
      spend: 0,
      income: 0,
      net: 0,
    };
    entries.set(teamId, next);
    return next;
  };

  for (const row of rows) {
    if (row.type === "buy" && row.toTeamId) {
      const entry = ensureEntry(row.toTeamId, row.toTeamName);
      entry.volume += 1;
      entry.buys += 1;
      entry.spend += row.fee;
      entry.net -= row.fee;
    }
    if ((row.type === "sell" || row.type === "contract_exit") && row.fromTeamId) {
      const entry = ensureEntry(row.fromTeamId, row.fromTeamName);
      entry.volume += 1;
      entry.sells += 1;
      entry.income += row.fee;
      entry.net += row.fee;
    }
  }

  return Array.from(entries.values()).sort((left, right) => {
    if (right.income !== left.income) return right.income - left.income;
    if (right.spend !== left.spend) return right.spend - left.spend;
    if (right.volume !== left.volume) return right.volume - left.volume;
    return left.teamName.localeCompare(right.teamName, "de", { sensitivity: "base" });
  });
}

export default function TransferHistoryV2Client(props: TransferHistoryV2ClientProps) {
  const { filteredRows, visibleRows, teamOptions } = props;
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(visibleRows[0]?.transferId ?? null);

  useEffect(() => {
    if (!visibleRows.some((row) => row.transferId === selectedTransferId)) {
      setSelectedTransferId(visibleRows[0]?.transferId ?? null);
    }
  }, [selectedTransferId, visibleRows]);

  const activityCards = useMemo(() => getActivitySummary(filteredRows, teamOptions), [filteredRows, teamOptions]);
  const timelineRows = useMemo(() => visibleRows, [visibleRows]);
  const mostActiveTeam = useMemo(
    () =>
      [...activityCards].sort((left, right) => {
        if (right.volume !== left.volume) return right.volume - left.volume;
        return right.income - left.income;
      })[0] ?? null,
    [activityCards],
  );
  const biggestBuy = useMemo(
    () => filteredRows.filter((row) => row.type === "buy").sort((left, right) => right.fee - left.fee)[0] ?? null,
    [filteredRows],
  );
  const biggestSale = useMemo(
    () => filteredRows.filter((row) => row.type === "sell").sort((left, right) => right.fee - left.fee)[0] ?? null,
    [filteredRows],
  );
  const bestProfit = useMemo(
    () =>
      filteredRows
        .filter((row) => row.type === "sell" && row.guv != null)
        .sort((left, right) => (right.guv ?? Number.NEGATIVE_INFINITY) - (left.guv ?? Number.NEGATIVE_INFINITY))[0] ?? null,
    [filteredRows],
  );
  const selectedRow =
    timelineRows.find((row) => row.transferId === selectedTransferId) ??
    filteredRows.find((row) => row.transferId === selectedTransferId) ??
    timelineRows[0] ??
    null;

  return (
    <TransferHistoryV2NewLook
      {...props}
      activityCards={activityCards}
      mostActiveTeam={mostActiveTeam}
      biggestBuy={biggestBuy}
      biggestSale={biggestSale}
      bestProfit={bestProfit}
      selectedRow={selectedRow}
      selectedTransferId={selectedTransferId}
      onSelectTransfer={setSelectedTransferId}
    />
  );
}
