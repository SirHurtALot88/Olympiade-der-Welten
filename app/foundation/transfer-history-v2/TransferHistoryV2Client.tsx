"use client";

import HistorieTransfers, { type HistorieTransfersProps } from "@/components/foundation/historie/HistorieTransfers";

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
  /**
   * Buchung nach „Fenster vor Saison N gehoert zu Saison N" (Chris 18.11.): Kaeufe/Verkaeufe des Fensters von
   * Saison 1 sind Kaderaufbau aus dem Startbudget, keine Transferbilanz. Optional: aeltere Aufrufer setzen es nicht.
   */
  buchungsArt?: "kaderaufbau" | "transfer" | "vertragsende";
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
    /** Erloese − Ausgaben OHNE den Kaderaufbau von Saison 1 (Chris 18.11.). */
    netTransferBalance: number;
    /** Kaderaufbau aus dem Startbudget (nur Saison-1-Fenster), `null` wenn keiner im Ausschnitt liegt. */
    kaderaufbauNet?: number | null;
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

/**
 * Reiter „Transfers" der Historie (Mockup 18.11.). Die alte Karten-Ansicht (Timeline/Tabelle, Top-Listen, Spotlight)
 * ist in `components/foundation/historie/HistorieTransfers.tsx` aufgegangen; die Zeilenform bleibt hier.
 */
export default function TransferHistoryV2Client(props: HistorieTransfersProps) {
  return <HistorieTransfers {...props} />;
}
