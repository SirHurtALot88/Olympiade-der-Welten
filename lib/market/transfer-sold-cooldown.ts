import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

export const SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER = "player_sold_this_season_unavailable";

export type SoldPlayerSeasonBan = {
  playerId: string;
  seasonId: string;
  fromTeamId: string;
  transferId: string;
  happenedAt: string;
  source: string | null;
  fee: number | null;
};

function isSeasonMarketSell(entry: TransferHistoryEntry) {
  return entry.transferType === "sell" && entry.fromTeamId != null;
}

export function buildSoldPlayerSeasonBans(gameState: GameState, seasonId = gameState.season.id) {
  const bans = new Map<string, SoldPlayerSeasonBan>();

  for (const entry of gameState.transferHistory) {
    if (!isSeasonMarketSell(entry) || entry.seasonId !== seasonId) {
      continue;
    }

    const previous = bans.get(entry.playerId);
    if (!previous || Date.parse(entry.happenedAt) >= Date.parse(previous.happenedAt)) {
      bans.set(entry.playerId, {
        playerId: entry.playerId,
        seasonId: entry.seasonId,
        fromTeamId: entry.fromTeamId!,
        transferId: entry.id,
        happenedAt: entry.happenedAt,
        source: entry.source ?? null,
        fee: entry.fee ?? null,
      });
    }
  }

  return bans;
}

export function getSoldPlayerSeasonBan(input: {
  gameState: GameState;
  playerId: string;
  seasonId?: string;
}) {
  return buildSoldPlayerSeasonBans(input.gameState, input.seasonId ?? input.gameState.season.id).get(input.playerId) ?? null;
}

export function isPlayerSoldThisSeason(input: {
  gameState: GameState;
  playerId: string;
  seasonId?: string;
}) {
  return getSoldPlayerSeasonBan(input) != null;
}

export function isPlayerTransferBuyBlocked(input: {
  gameState: GameState;
  playerId: string;
  seasonId?: string;
}) {
  return isPlayerSoldThisSeason(input);
}
