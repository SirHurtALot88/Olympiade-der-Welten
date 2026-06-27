import type { GameState, Player } from "@/lib/data/olyDataTypes";

import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";

function getPlayerMwChangeFix(player: Player) {
  const value = (player as Player & { mwChangeFix?: number | null }).mwChangeFix;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildRankTableMarketValueMap(gameState: GameState): Map<string, number> {
  const formulaSources = loadPlayerFormulaSources();
  const inputs = gameState.players
    .filter((player) =>
      Object.values(player.disciplineRatings ?? {}).some((value) => typeof value === "number" && Number.isFinite(value)),
    )
    .map((player) => ({
      playerId: player.id,
      scores: player.disciplineRatings ?? {},
      mwChangeFix: getPlayerMwChangeFix(player) ?? undefined,
    }));

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

  return {
    ...gameState,
    players: nextPlayers,
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
