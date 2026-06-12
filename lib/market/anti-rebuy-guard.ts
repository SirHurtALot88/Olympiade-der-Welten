import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";

export const RECENTLY_SOLD_SAME_PRESEASON_BLOCKER = "recently_sold_same_preseason";
export const RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING = "recently_sold_same_preseason_override";

export type RecentlySoldPlayer = {
  playerId: string;
  teamId: string;
  seasonId: string;
  transferId: string;
  happenedAt: string;
  source: string | null;
};

function isCurrentPreseasonSale(entry: TransferHistoryEntry, seasonId: string) {
  return (
    entry.transferType === "sell" &&
    entry.seasonId === seasonId &&
    entry.phase === LOCAL_TRANSFER_WINDOW_PHASE &&
    entry.fromTeamId != null
  );
}

export function buildRecentlySoldByTeam(gameState: GameState, seasonId = gameState.season.id) {
  const byTeam = new Map<string, Map<string, RecentlySoldPlayer>>();

  for (const entry of gameState.transferHistory) {
    if (!isCurrentPreseasonSale(entry, seasonId) || !entry.fromTeamId) {
      continue;
    }

    const teamSales = byTeam.get(entry.fromTeamId) ?? new Map<string, RecentlySoldPlayer>();
    const previous = teamSales.get(entry.playerId);
    if (!previous || Date.parse(entry.happenedAt) >= Date.parse(previous.happenedAt)) {
      teamSales.set(entry.playerId, {
        playerId: entry.playerId,
        teamId: entry.fromTeamId,
        seasonId: entry.seasonId,
        transferId: entry.id,
        happenedAt: entry.happenedAt,
        source: entry.source ?? null,
      });
    }
    byTeam.set(entry.fromTeamId, teamSales);
  }

  return byTeam;
}

export function getRecentlySoldBySameTeam(input: {
  gameState: GameState;
  seasonId?: string;
  teamId: string;
  playerId: string;
}) {
  return buildRecentlySoldByTeam(input.gameState, input.seasonId ?? input.gameState.season.id)
    .get(input.teamId)
    ?.get(input.playerId) ?? null;
}

export function isRecentlySoldBySameTeam(input: {
  gameState: GameState;
  seasonId?: string;
  teamId: string;
  playerId: string;
}) {
  return getRecentlySoldBySameTeam(input) != null;
}
