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

import {
  buildLeagueMarketValuePlayerSignature,
  computeLeagueMarketValueMapFromPlayers,
  serializeLeagueMarketValueMap,
} from "@/lib/player-formulas/league-market-value-snapshot";

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
  /** Cached league-wide rank-table MW for this season snapshot (pick / planner speed). */
  marketValueByPlayerId?: Record<string, number>;
  /** Invalidates MW cache when discipline scores change, not on every transfer. */
  marketValuePlayerSignature?: string;
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
    // Platzhalter — der Feld-Rennen-Ledger wird billig aus dem GameState
    // nachgerechnet (siehe readPersistedSeasonDerivations), statt ihn zu persistieren.
    fieldRaceLedger: { seasonId: record.seasonId, matchdays: [], rowsByTeamId: new Map() },
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
  // fieldRaceLedger bleibt der leere Platzhalter aus hydrateSeasonDerivations —
  // der Shell-Scope-Hook baut ihn on-demand (reine UI-Ableitung, siehe
  // computeSeasonDerivationsFresh).
  return hydrateSeasonDerivations(persisted);
}

export function buildPersistedSeasonDerivationsRecord(gameState: GameState): PersistedSeasonDerivationsRecord {
  const seasonId = gameState.season.id;
  const contentSignature = buildGameStateContentSignature(gameState);
  const derivations = computeSeasonDerivationsFresh(gameState, seasonId);

  // Die ligaweite MW-Berechnung (~3000 Spieler) dominiert diesen Record
  // (~90 % der Zeit) und haengt AUSSCHLIESSLICH an den MW-relevanten
  // Spielerdaten (disciplineRatings + mwChangeFix), die der PlayerSignature
  // entspricht. Ein Matchday-Ergebnis aendert diese nicht — also die teure
  // Map wiederverwenden, wenn die Signatur zum bereits persistierten Snapshot
  // passt, statt sie bei jedem Result-Apply neu zu berechnen. Ergebnis ist
  // per Konstruktion identisch (reine Funktion der Signatur).
  const playerSignature = buildLeagueMarketValuePlayerSignature(gameState.players);
  const existing = gameState.seasonState.persistedSeasonDerivations as PersistedSeasonDerivationsRecord | null | undefined;
  const canReuseMarketValue =
    existing?.marketValueByPlayerId != null &&
    existing.seasonId === seasonId &&
    existing.marketValuePlayerSignature === playerSignature;
  const marketValueByPlayerId = canReuseMarketValue
    ? existing.marketValueByPlayerId
    : serializeLeagueMarketValueMap(computeLeagueMarketValueMapFromPlayers(gameState.players));

  return {
    ...serializeSeasonDerivations({
      derivations,
      seasonId,
      contentSignature,
    }),
    marketValueByPlayerId,
    marketValuePlayerSignature: playerSignature,
  };
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
