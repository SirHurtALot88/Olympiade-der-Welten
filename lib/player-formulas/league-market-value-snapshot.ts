import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";

import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";
import type { MarketValueDisciplineInput } from "@/lib/player-formulas/player-formula-types";

function getPlayerMwChangeFix(player: Player) {
  const value = (player as Player & { mwChangeFix?: number | null }).mwChangeFix;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Stable for draft/transfers — only discipline scores + MW fix flags affect league ranks. */
export function buildLeagueMarketValuePlayerSignature(players: Player[]): string {
  const parts = players
    .map((player) => {
      const ratings = Object.entries(player.disciplineRatings ?? {})
        .filter(([, value]) => isFiniteNumber(value))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([disciplineId, value]) => `${disciplineId}:${value.toFixed(2)}`)
        .join(",");
      const fix = getPlayerMwChangeFix(player);
      return `${player.id}|${ratings}|fix:${fix ?? "none"}`;
    })
    .sort((left, right) => left.localeCompare(right));
  return `${players.length}:${parts.join(";")}`;
}

/** MW league ranks use stored discipline display stats (pick / economy path). */
export function buildMarketValueDisciplineInputsFromPlayers(players: Player[]): MarketValueDisciplineInput[] {
  return players
    .filter((player) =>
      Object.values(player.disciplineRatings ?? {}).some((value) => isFiniteNumber(value) && value > 0),
    )
    .map((player) => ({
      playerId: player.id,
      scores: player.disciplineRatings ?? {},
      mwChangeFix: getPlayerMwChangeFix(player) ?? undefined,
    }));
}

export function computeLeagueMarketValueMapFromPlayers(players: Player[]): Map<string, number> {
  const formulaSources = loadPlayerFormulaSources();
  const inputs = buildMarketValueDisciplineInputsFromPlayers(players);
  const result = calculateMarketValueFromRankTable({
    players: inputs,
    rankToDisciplineMarketValue: formulaSources.rankToDisciplineMarketValue,
  });
  if (result.status !== "ready") {
    return new Map();
  }
  return new Map(result.players.map((entry) => [entry.playerId, entry.marketValueNew] as const));
}

export function serializeLeagueMarketValueMap(marketValueByPlayerId: Map<string, number>): Record<string, number> {
  return Object.fromEntries(marketValueByPlayerId);
}

export function readCachedLeagueMarketValueMap(gameState: GameState): Map<string, number> | null {
  const persisted = gameState.seasonState.persistedSeasonDerivations as PersistedSeasonDerivationsRecord | null | undefined;
  if (!persisted?.marketValueByPlayerId) {
    return null;
  }
  if (persisted.seasonId !== gameState.season.id) {
    return null;
  }
  const playerSignature = buildLeagueMarketValuePlayerSignature(gameState.players);
  if (persisted.marketValuePlayerSignature !== playerSignature) {
    return null;
  }
  return new Map(Object.entries(persisted.marketValueByPlayerId));
}

export function resolveLeagueMarketValueMap(gameState: GameState): Map<string, number> {
  return readCachedLeagueMarketValueMap(gameState) ?? computeLeagueMarketValueMapFromPlayers(gameState.players);
}

/** In-memory MW snapshot for pick/planner hot paths — persists only when caller saves. */
export function ensureLeagueMarketValueSnapshot(gameState: GameState): GameState {
  if (readCachedLeagueMarketValueMap(gameState)) {
    return gameState;
  }

  const existing = gameState.seasonState.persistedSeasonDerivations as PersistedSeasonDerivationsRecord | null | undefined;
  if (!existing?.ratingsByPlayerId || existing.seasonId !== gameState.season.id) {
    return withPersistedSeasonDerivations(gameState);
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations: {
        ...existing,
        marketValueByPlayerId: serializeLeagueMarketValueMap(
          computeLeagueMarketValueMapFromPlayers(gameState.players),
        ),
        marketValuePlayerSignature: buildLeagueMarketValuePlayerSignature(gameState.players),
      },
    },
  };
}
