import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

import {
  buildMarketValueDisciplineInputsFromPlayers,
  computeLeagueMarketValueMapFromPlayers,
  ensureLeagueMarketValueSnapshot,
  readCachedLeagueMarketValueMap,
  resolveLeagueMarketValueMap,
} from "@/lib/player-formulas/league-market-value-snapshot";

export {
  buildMarketValueDisciplineInputsFromPlayers,
  computeLeagueMarketValueMapFromPlayers,
  ensureLeagueMarketValueSnapshot,
  readCachedLeagueMarketValueMap,
  resolveLeagueMarketValueMap,
} from "@/lib/player-formulas/league-market-value-snapshot";

export function buildRankTableMarketValueMap(gameState: GameState): Map<string, number> {
  return resolveLeagueMarketValueMap(gameState);
}

export function applyRankTableMarketValuesToGameState(gameState: GameState): GameState {
  return applyMarketValueMapToGameState(gameState, buildRankTableMarketValueMap(gameState));
}

export function applyMarketValueMapToGameState(
  gameState: GameState,
  marketValueByPlayerId: Map<string, number>,
  playerIds?: Iterable<string>,
): GameState {
  if (marketValueByPlayerId.size === 0) {
    return gameState;
  }
  const targetIds = playerIds ? new Set(playerIds) : null;

  const nextPlayers = gameState.players.map((player) => {
    if (targetIds && !targetIds.has(player.id)) {
      return player;
    }
    const marketValue = marketValueByPlayerId.get(player.id);
    if (marketValue == null) {
      return player;
    }
    return {
      ...player,
      marketValue,
      displayMarketValue: marketValue,
    };
  });

  const nextRosters = gameState.rosters.map((entry) => {
    const marketValue = marketValueByPlayerId.get(entry.playerId);
    if (marketValue == null) {
      return entry;
    }
    return {
      ...entry,
      currentValue: marketValue,
    };
  });

  return syncRosterMarketValuesWithPlayerEconomy({
    ...gameState,
    players: nextPlayers,
    rosters: nextRosters,
  });
}

/** Align roster currentValue/marketValue with canonical player economy MV (rank-table / display). */
export function syncRosterMarketValuesWithPlayerEconomy(gameState: GameState): GameState {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  let changed = false;
  const nextRosters = gameState.rosters.map((entry) => {
    const player = playerById.get(entry.playerId);
    const marketValue = resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue;
    if (marketValue == null) {
      return entry;
    }
    const normalized = Number(marketValue.toFixed(2));
    if (entry.currentValue === normalized) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      currentValue: normalized,
    };
  });
  if (!changed) {
    return gameState;
  }
  return {
    ...gameState,
    rosters: nextRosters,
  };
}

export function patchSeasonProgressionEventMarketValues(input: {
  gameState: GameState;
  seasonId: string;
  playerIds?: Iterable<string>;
  marketValueByPlayerId?: Map<string, number>;
}): GameState {
  const marketValueByPlayerId = input.marketValueByPlayerId ?? buildRankTableMarketValueMap(input.gameState);
  if (marketValueByPlayerId.size === 0) {
    return input.gameState;
  }
  const playerIds = input.playerIds ? new Set(input.playerIds) : null;
  const events = input.gameState.playerProgressionEvents;
  if (!events || events.length === 0) {
    return input.gameState;
  }

  const nextEvents = events.map((event) => {
    if (event.seasonId !== input.seasonId) {
      return event;
    }
    if (playerIds && !playerIds.has(event.playerId)) {
      return event;
    }
    const marketValue = marketValueByPlayerId.get(event.playerId);
    if (marketValue == null || !event.progressionSnapshotAfter) {
      return event;
    }
    return {
      ...event,
      progressionSnapshotAfter: {
        ...event.progressionSnapshotAfter,
        marketValue,
        marketValuePreview: marketValue,
      },
    };
  });

  return {
    ...input.gameState,
    playerProgressionEvents: nextEvents,
  };
}
