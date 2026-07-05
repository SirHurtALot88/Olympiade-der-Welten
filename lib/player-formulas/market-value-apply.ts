import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

import { buildRawDisciplineScoresByPlayerId } from "@/lib/player-formulas/discipline-rating-engine";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";
import type { MarketValueDisciplineInput } from "@/lib/player-formulas/player-formula-types";

function getPlayerMwChangeFix(player: Player) {
  const value = (player as Player & { mwChangeFix?: number | null }).mwChangeFix;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** League-wide MW ranking inputs: raw attribute sums per discipline (not display discipline stats). */
export function buildMarketValueDisciplineInputsFromPlayers(players: Player[]): MarketValueDisciplineInput[] {
  const rawScoresByPlayerId = buildRawDisciplineScoresByPlayerId(players);
  return players
    .filter((player) => {
      const scores = rawScoresByPlayerId.get(player.id);
      return scores != null && Object.keys(scores).length > 0;
    })
    .map((player) => ({
      playerId: player.id,
      scores: rawScoresByPlayerId.get(player.id)!,
      mwChangeFix: getPlayerMwChangeFix(player) ?? undefined,
    }));
}

export function buildRankTableMarketValueMap(gameState: GameState): Map<string, number> {
  const formulaSources = loadPlayerFormulaSources();
  const inputs = buildMarketValueDisciplineInputsFromPlayers(gameState.players);

  const result = calculateMarketValueFromRankTable({
    players: inputs,
    rankToDisciplineMarketValue: formulaSources.rankToDisciplineMarketValue,
  });
  if (result.status !== "ready") {
    return new Map();
  }
  return new Map(result.players.map((entry) => [entry.playerId, entry.marketValueNew] as const));
}

export function applyRankTableMarketValuesToGameState(gameState: GameState): GameState {
  const marketValueByPlayerId = buildRankTableMarketValueMap(gameState);
  if (marketValueByPlayerId.size === 0) {
    return gameState;
  }

  const nextPlayers = gameState.players.map((player) => {
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
      marketValue,
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
    if (entry.currentValue === normalized && entry.marketValue === normalized) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      currentValue: normalized,
      marketValue: normalized,
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
}): GameState {
  const marketValueByPlayerId = buildRankTableMarketValueMap(input.gameState);
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
