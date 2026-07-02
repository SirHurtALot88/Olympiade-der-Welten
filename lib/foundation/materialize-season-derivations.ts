import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type {
  SeasonPlayerPointLedgerEntry,
  SeasonPlayerPointsSummary,
  SeasonPointsLedger,
  SeasonTeamPointsSummary,
} from "@/lib/foundation/season-points-ledger";
import type { PersistenceService } from "@/lib/persistence/types";

import { buildGameStateContentSignature } from "./season-derivations-signature";
import { computeSeasonDerivationsFresh } from "./season-derivations-compute";
import type { SeasonDerivations } from "./season-derivations-cache";

type PersistedSeasonPointsLedger = {
  hasResultSource: boolean;
  pointEntries: SeasonPlayerPointLedgerEntry[];
  warnings: string[];
  teamSummariesByTeamId: Record<string, SeasonTeamPointsSummary>;
  playerSummariesByPlayerId: Record<string, SeasonPlayerPointsSummary>;
};

export type PersistedSeasonDerivationsRecord = {
  seasonId: string;
  contentSignature: string;
  updatedAt: string;
  ledger: PersistedSeasonPointsLedger;
  ratingsByPlayerId: Record<string, PlayerRatingContractRow>;
  performanceByPlayerId: Record<string, PlayerSeasonPerformanceSummary>;
};

function serializeLedger(ledger: SeasonPointsLedger): PersistedSeasonPointsLedger {
  return {
    hasResultSource: ledger.hasResultSource,
    pointEntries: ledger.pointEntries,
    warnings: ledger.warnings,
    teamSummariesByTeamId: Object.fromEntries(ledger.teamSummariesByTeamId),
    playerSummariesByPlayerId: Object.fromEntries(ledger.playerSummariesByPlayerId),
  };
}

function hydrateLedger(persisted: PersistedSeasonPointsLedger): SeasonPointsLedger {
  return {
    hasResultSource: persisted.hasResultSource,
    pointEntries: persisted.pointEntries,
    warnings: persisted.warnings,
    pointEntriesByPerformanceId: new Map(
      persisted.pointEntries.map((entry) => [entry.performanceId, entry] as const),
    ),
    teamSummariesByTeamId: new Map(Object.entries(persisted.teamSummariesByTeamId)),
    playerSummariesByPlayerId: new Map(Object.entries(persisted.playerSummariesByPlayerId)),
  };
}

function serializeRecordMap<T>(record: Map<string, T>): Record<string, T> {
  return Object.fromEntries(record);
}

export function serializeSeasonDerivations(input: {
  derivations: SeasonDerivations;
  seasonId: string;
  contentSignature: string;
  updatedAt?: string;
}): PersistedSeasonDerivationsRecord {
  return {
    seasonId: input.seasonId,
    contentSignature: input.contentSignature,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    ledger: serializeLedger(input.derivations.ledger),
    ratingsByPlayerId: serializeRecordMap(input.derivations.ratingsById),
    performanceByPlayerId: serializeRecordMap(input.derivations.performanceByPlayerId),
  };
}

export function hydrateSeasonDerivations(record: PersistedSeasonDerivationsRecord): SeasonDerivations {
  return {
    ledger: hydrateLedger(record.ledger),
    ratingsById: new Map(Object.entries(record.ratingsByPlayerId) as Array<[string, PlayerRatingContractRow]>),
    performanceByPlayerId: new Map(
      Object.entries(record.performanceByPlayerId) as Array<[string, PlayerSeasonPerformanceSummary]>,
    ),
  };
}

export function readPersistedSeasonDerivations(
  gameState: GameState,
  contentSignature: string,
): SeasonDerivations | null {
  const persisted = gameState.seasonState.persistedSeasonDerivations as PersistedSeasonDerivationsRecord | null | undefined;
  if (!persisted || persisted.contentSignature !== contentSignature) {
    return null;
  }
  if (persisted.seasonId !== gameState.season.id) {
    return null;
  }
  return hydrateSeasonDerivations(persisted);
}

export function buildPersistedSeasonDerivationsRecord(gameState: GameState): PersistedSeasonDerivationsRecord {
  const seasonId = gameState.season.id;
  const contentSignature = buildGameStateContentSignature(gameState);
  const derivations = computeSeasonDerivationsFresh(gameState, seasonId);
  return serializeSeasonDerivations({
    derivations,
    seasonId,
    contentSignature,
  });
}

export function withPersistedSeasonDerivations(gameState: GameState, _saveId?: string): GameState {
  const persistedSeasonDerivations = buildPersistedSeasonDerivationsRecord(gameState);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations,
    },
  };
}

export function persistGameStateWithMaterializedDerivations(
  persistence: PersistenceService,
  saveId: string,
  gameState: GameState,
) {
  return persistence.saveSingleplayerState(saveId, withPersistedSeasonDerivations(gameState, saveId));
}
