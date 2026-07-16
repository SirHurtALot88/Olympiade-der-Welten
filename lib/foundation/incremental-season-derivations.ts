import type { GameState } from "@/lib/data/olyDataTypes";

import { hasRatingRelevantGameStateChange } from "./materialize-on-save";
import {
  readPersistedSeasonDerivations,
  serializeSeasonDerivations,
  type PersistedSeasonDerivationsRecord,
} from "./materialize-season-derivations";
import { computeSeasonDerivationsFresh } from "./season-derivations-compute";
import { buildGameStateContentSignature } from "./season-derivations-signature";
import { buildLeagueMarketValuePlayerSignature } from "@/lib/player-formulas/league-market-value-snapshot";

function serializeRecordMap<T>(record: Map<string, T>): Record<string, T> {
  return Object.fromEntries(record);
}

/**
 * Recompute season derivations for roster/player-economy changes (e.g. transfer buy/sell).
 * Reuses ledger + performance from the prior persisted block when still valid; always refreshes
 * ratings (league-relative ranks).
 */
export function recomputeSeasonDerivationsForPlayerIds(
  gameState: GameState,
  playerIds: string[],
): GameState {
  const seasonId = gameState.season.id;
  const contentSignature = buildGameStateContentSignature(gameState);
  const priorRecord = gameState.seasonState.persistedSeasonDerivations as
    | PersistedSeasonDerivationsRecord
    | null
    | undefined;

  const fresh = computeSeasonDerivationsFresh(gameState, seasonId);

  if (!priorRecord || priorRecord.seasonId !== seasonId) {
    const record = serializeSeasonDerivations({
      derivations: fresh,
      seasonId,
      contentSignature,
    });
    return {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        persistedSeasonDerivations: record,
      },
    };
  }

  const priorHydrated = readPersistedSeasonDerivations(gameState, priorRecord.contentSignature);
  const reuseLedgerAndPerformance =
    priorHydrated != null &&
    !hasRatingRelevantGameStateChange(
      {
        ...gameState,
        seasonState: {
          ...gameState.seasonState,
          persistedSeasonDerivations: priorRecord,
        },
      } as GameState,
      {
        ...gameState,
        seasonState: {
          ...gameState.seasonState,
          persistedSeasonDerivations: undefined,
        },
      } as GameState,
    );

  const mergedPerformance = { ...priorRecord.performanceByPlayerId };
  if (playerIds.length > 0) {
    for (const playerId of playerIds) {
      const performance = fresh.performanceByPlayerId.get(playerId);
      if (performance) {
        mergedPerformance[playerId] = performance;
      } else {
        delete mergedPerformance[playerId];
      }
    }
  } else {
    Object.assign(mergedPerformance, serializeRecordMap(fresh.performanceByPlayerId));
  }

  // Ligaweite MW-Map ueber die Transfer-Grenze MITNEHMEN, statt sie zu
  // verwerfen: die MW-Map haengt ausschliesslich an disciplineRatings +
  // mwChangeFix (= der PlayerSignature), und ein Transfer aendert die nicht.
  // Solange die Signatur unveraendert ist, ist die alte Map per Konstruktion
  // korrekt — ohne diese Weitergabe erzwang jeder Buy/Sell-Flush eine volle
  // ~243ms-Neuberechnung beim naechsten Snapshot-Read (pro Runde/Team-Cycle).
  const currentMarketValueSignature = buildLeagueMarketValuePlayerSignature(gameState.players);
  const canCarryMarketValue =
    priorRecord.marketValueByPlayerId != null &&
    priorRecord.marketValuePlayerSignature === currentMarketValueSignature;

  const record: PersistedSeasonDerivationsRecord = {
    seasonId,
    contentSignature,
    updatedAt: new Date().toISOString(),
    ledger: reuseLedgerAndPerformance
      ? priorRecord.ledger
      : serializeSeasonDerivations({
          derivations: fresh,
          seasonId,
          contentSignature,
        }).ledger,
    ratingsByPlayerId: serializeRecordMap(fresh.ratingsById),
    performanceByPlayerId:
      reuseLedgerAndPerformance && playerIds.length === 0
        ? priorRecord.performanceByPlayerId
        : mergedPerformance,
    ...(canCarryMarketValue
      ? {
          marketValueByPlayerId: priorRecord.marketValueByPlayerId,
          marketValuePlayerSignature: priorRecord.marketValuePlayerSignature,
        }
      : {}),
  };

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations: record,
    },
  };
}

export function withIncrementalSeasonDerivationsAfterTransfer(
  gameState: GameState,
  affectedPlayerIds: string[],
): GameState {
  return recomputeSeasonDerivationsForPlayerIds(gameState, affectedPlayerIds);
}
