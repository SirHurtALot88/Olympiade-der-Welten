import { useMemo } from "react";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
// `TransfermarktSellSummary` is the shared shape returned by the sell-preview API
// (see `TransfermarktSellPreview` in lib/market/transfermarkt-sell-service.ts, which
// includes `buyoutCost`/`netProceeds`) — reuse the canonical definition instead of
// keeping a second, drifting copy here.
import type { TransfermarktSellSummary } from "@/lib/foundation/tabs/foundation-page-types";

export type { TransfermarktSellSummary } from "@/lib/foundation/tabs/foundation-page-types";

export type TransfermarktSellPreviewSubject = {
  activePlayerId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  portraitUrl?: string | null;
};

export type MarketSellPlayerRatingsById = Map<
  string,
  {
    ovrNormalized?: number | null;
    ovrRank?: number | null;
    mvs?: number | null;
    mvsRank?: number | null;
    ppsSeason?: number | null;
    ppsSeasonRank?: number | null;
    ppPow?: number | null;
    ppSpe?: number | null;
    ppMen?: number | null;
    ppSoc?: number | null;
  }
>;

export type MarketSellPlayerPerformance = {
  totalPoints?: number | null;
  appearances?: number | null;
  top10Count?: number | null;
  mvpCount?: number | null;
  latestDisciplineLabel?: string | null;
  latestFinalScore?: number | null;
  latestRankInDiscipline?: number | null;
  bestDisciplineLabel?: string | null;
  bestDisciplineScore?: number | null;
  pointsByArea: {
    pow?: number | null;
    spe?: number | null;
    men?: number | null;
    soc?: number | null;
  };
  matchdayBreakdown: Array<{
    matchdayId: string;
    totalContribution: number | null;
    averageFinalScore: number | null;
    bestDisciplineLabel: string | null;
  }>;
  topDisciplineRows: Array<{
    disciplineId: string;
    disciplineName: string;
    totalContribution: number | null;
    averageContribution: number | null;
    averageFinalScore: number | null;
  }>;
};

function roundViewNumber(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getTransferTypeLabel(type: "buy" | "sell" | "contract_exit") {
  if (type === "contract_exit") return "Contract Exit";
  return type === "buy" ? "Kauf" : "Verkauf";
}

export interface UseMarketSellDerivationsInput {
  gameState: GameState;
  marketSellPreview: TransfermarktSellSummary | null;
  marketSellSubject: TransfermarktSellPreviewSubject | null;
  playerRatingsById: MarketSellPlayerRatingsById;
  playerSeasonPerformanceMap: Map<string, MarketSellPlayerPerformance>;
  selectedTeamId: string;
  getPlayerDisplayMarketValue: (player?: Pick<Player, "id" | "marketValue" | "displayMarketValue"> | null) => number | null;
  getRosterEntryDisplayMarketValue: (
    entry?: Pick<RosterEntry, "currentValue" | "purchasePrice"> | null,
    player?: Player | null,
  ) => number | null;
  getRosterEntryDisplaySalary: (entry: Pick<RosterEntry, "salary">, player?: Player | null) => number | null;
  getPlayerDisplayMarketValueDelta: (
    player?: Player | null,
    entry?: Pick<RosterEntry, "currentValue" | "purchasePrice" | "joinedSeasonId"> | null,
    gameState?: GameState | null,
  ) => number | null;
  getRosterEntrySalaryDelta: (
    entry?: Pick<RosterEntry, "salary"> | null,
    player?: Player | null,
    gameState?: GameState | null,
  ) => number | null;
}

/**
 * Market sell drilldown derivations (Strangler Phase 5.3). Runs only while
 * `FoundationMarketSellShellHost` is mounted (`isMarketSellPanelOpen`).
 */
export function useMarketSellDerivations(input: UseMarketSellDerivationsInput) {
  const {
    gameState,
    marketSellPreview,
    marketSellSubject,
    playerRatingsById,
    playerSeasonPerformanceMap,
    selectedTeamId,
    getPlayerDisplayMarketValue,
    getRosterEntryDisplayMarketValue,
    getRosterEntryDisplaySalary,
    getPlayerDisplayMarketValueDelta,
    getRosterEntrySalaryDelta,
  } = input;

  const marketSellPlayerContext = useMemo(() => {
    const playerId =
      marketSellPreview?.player?.id ??
      marketSellPreview?.activePlayer?.playerId ??
      marketSellSubject?.playerId ??
      null;
    if (!playerId) {
      return null;
    }

    const teamId =
      marketSellPreview?.team?.id ??
      gameState.rosters.find(
        (entry) => entry.id === marketSellPreview?.activePlayer?.id || entry.id === marketSellSubject?.activePlayerId,
      )?.teamId ??
      selectedTeamId;
    const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
    const rosterEntry =
      gameState.rosters.find((entry) => entry.id === marketSellPreview?.activePlayer?.id) ??
      gameState.rosters.find((entry) => entry.id === marketSellSubject?.activePlayerId) ??
      gameState.rosters.find((entry) => entry.playerId === playerId && entry.teamId === teamId) ??
      null;
    const rating = playerRatingsById.get(playerId) ?? null;
    const performance = playerSeasonPerformanceMap.get(playerId) ?? null;
    const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));
    const transferEvents = gameState.transferHistory
      .filter((entry) => entry.playerId === playerId)
      .sort((left, right) => {
        const rightTime = Date.parse(right.happenedAt);
        const leftTime = Date.parse(left.happenedAt);
        if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
          return rightTime - leftTime;
        }
        return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
      })
      .slice(0, 5)
      .map((entry) => ({
        id: entry.id,
        type: entry.transferType,
        label: getTransferTypeLabel(entry.transferType),
        seasonLabel: entry.seasonLabel ?? entry.seasonId,
        phase: entry.phase ?? "—",
        fee: entry.fee,
        salary: entry.salary,
        marketValue: entry.marketValue,
        fromTeam: entry.fromTeamId ? (teamById.get(entry.fromTeamId)?.shortCode ?? entry.fromTeamId) : "Free",
        toTeam: entry.toTeamId ? (teamById.get(entry.toTeamId)?.shortCode ?? entry.toTeamId) : "Free",
      }));
    const latestBuyForCurrentTeam =
      [...gameState.transferHistory]
        .filter((entry) => entry.playerId === playerId && entry.transferType === "buy" && entry.toTeamId === teamId)
        .sort((left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt))[0] ?? null;
    const purchasePrice =
      latestBuyForCurrentTeam?.fee ??
      rosterEntry?.purchasePrice ??
      marketSellPreview?.activePlayer?.purchasePrice ??
      null;
    const currentMarketValue = player
      ? getPlayerDisplayMarketValue(player)
      : (marketSellPreview?.marketValueReference ?? null);
    const rosterMarketValue =
      player && rosterEntry
        ? getRosterEntryDisplayMarketValue(rosterEntry, player)
        : (marketSellPreview?.activePlayer?.currentValue ?? null);
    const marketValueDelta =
      player && rosterEntry ? getPlayerDisplayMarketValueDelta(player, rosterEntry, gameState) : null;
    const salary =
      player && rosterEntry
        ? getRosterEntryDisplaySalary(rosterEntry, player)
        : (marketSellPreview?.activePlayer?.salary ?? null);
    const salaryDelta = player && rosterEntry ? getRosterEntrySalaryDelta(rosterEntry, player, gameState) : null;
    const saleProfit =
      marketSellPreview?.salePrice != null && purchasePrice != null
        ? roundViewNumber(marketSellPreview.salePrice - purchasePrice, 2)
        : (marketSellPreview?.profit ?? null);
    const areaRows = [
      { key: "POW", value: rating?.ppPow ?? performance?.pointsByArea.pow ?? null, tone: "power" },
      { key: "SPE", value: rating?.ppSpe ?? performance?.pointsByArea.spe ?? null, tone: "speed" },
      { key: "MEN", value: rating?.ppMen ?? performance?.pointsByArea.men ?? null, tone: "mental" },
      { key: "SOC", value: rating?.ppSoc ?? performance?.pointsByArea.soc ?? null, tone: "social" },
    ];

    return {
      player,
      rosterEntry,
      rating,
      performance,
      transferEvents,
      purchasePrice,
      currentMarketValue,
      rosterMarketValue,
      marketValueDelta,
      salary,
      salaryDelta,
      saleProfit,
      areaRows,
      recentMatchdays: performance?.matchdayBreakdown.slice(0, 4) ?? [],
      topDisciplines: performance?.topDisciplineRows.slice(0, 4) ?? [],
    };
  }, [
    gameState,
    getPlayerDisplayMarketValue,
    getPlayerDisplayMarketValueDelta,
    getRosterEntryDisplayMarketValue,
    getRosterEntryDisplaySalary,
    getRosterEntrySalaryDelta,
    marketSellPreview,
    marketSellSubject,
    playerRatingsById,
    playerSeasonPerformanceMap,
    selectedTeamId,
  ]);

  return { marketSellPlayerContext };
}
