import type {
  FrozenValuationPlayerRow,
  FrozenValuationSnapshot,
  GameState,
} from "@/lib/data/olyDataTypes";
import {
  buildPlayerRatingContractMap,
  type PlayerRatingContractRow,
  type PlayerRatingSourceStatus,
  type PlayerRatingWarning,
} from "@/lib/foundation/player-rating-contract";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";

function toFiniteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function averageOrNull(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(2));
}

/**
 * Builds the MD10 valuation freeze from LIVE derivations. Must be called while no freeze snapshot is
 * present on the state (i.e. before it is written back), so the underlying rating/sale-factor gates
 * compute pool-relative live values for the full MD10 roster pool.
 */
export function buildFrozenValuationSnapshot(gameState: GameState): FrozenValuationSnapshot {
  const seasonId = gameState.season.id;
  const frozenAtMatchdayId = gameState.matchdayState?.matchdayId ?? "";
  const createdAt = new Date().toISOString();

  const ratingsById = buildPlayerRatingContractMap(gameState);
  const playersById = new Map((gameState.players ?? []).map((player) => [player.id, player] as const));

  const playersByIdOut: Record<string, FrozenValuationPlayerRow> = {};
  const teamOvrAccum = new Map<string, Array<number | null>>();
  const teamMvsAccum = new Map<string, Array<number | null>>();

  for (const rosterEntry of gameState.rosters ?? []) {
    const player = playersById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }

    const rating = ratingsById.get(player.id) ?? null;
    const saleBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry, {
      playerRatingsById: ratingsById,
    });

    const frozenMw = toFiniteOrNull(saleBreakdown.baseMarketValue ?? rating?.marketValue ?? null);
    const row: FrozenValuationPlayerRow = {
      playerId: player.id,
      frozenOvr: toFiniteOrNull(rating?.ovrNormalized ?? null),
      frozenOvrRank: toFiniteOrNull(rating?.ovrRank ?? null),
      frozenMvs: toFiniteOrNull(rating?.mvs ?? null),
      frozenMvsRank: toFiniteOrNull(rating?.mvsRank ?? null),
      frozenPps: toFiniteOrNull(rating?.ppsSeason ?? null),
      frozenPpsRank: toFiniteOrNull(rating?.ppsSeasonRank ?? null),
      frozenPpPow: toFiniteOrNull(rating?.ppPow ?? null),
      frozenPpPowRank: toFiniteOrNull(rating?.ppPowRank ?? null),
      frozenPpSpe: toFiniteOrNull(rating?.ppSpe ?? null),
      frozenPpSpeRank: toFiniteOrNull(rating?.ppSpeRank ?? null),
      frozenPpMen: toFiniteOrNull(rating?.ppMen ?? null),
      frozenPpMenRank: toFiniteOrNull(rating?.ppMenRank ?? null),
      frozenPpSoc: toFiniteOrNull(rating?.ppSoc ?? null),
      frozenPpSocRank: toFiniteOrNull(rating?.ppSocRank ?? null),
      frozenMw,
      frozenSaleBracket: toFiniteOrNull(saleBreakdown.bracket ?? null),
      frozenSaleRankInBracket: toFiniteOrNull(saleBreakdown.rankInBracket ?? null),
      frozenSaleBracketSize: toFiniteOrNull(saleBreakdown.bracketGroupSize ?? null),
    };

    playersByIdOut[player.id] = row;

    const teamId = rosterEntry.teamId;
    if (teamId) {
      const ovrBucket = teamOvrAccum.get(teamId) ?? [];
      ovrBucket.push(row.frozenOvr);
      teamOvrAccum.set(teamId, ovrBucket);
      const mvsBucket = teamMvsAccum.get(teamId) ?? [];
      mvsBucket.push(row.frozenMvs);
      teamMvsAccum.set(teamId, mvsBucket);
    }
  }

  const teamAggregatesByTeamId: Record<string, { frozenTeamOvr: number | null; frozenTeamMvs: number | null }> = {};
  for (const teamId of new Set([...teamOvrAccum.keys(), ...teamMvsAccum.keys()])) {
    teamAggregatesByTeamId[teamId] = {
      frozenTeamOvr: averageOrNull(teamOvrAccum.get(teamId) ?? []),
      frozenTeamMvs: averageOrNull(teamMvsAccum.get(teamId) ?? []),
    };
  }

  return {
    seasonId,
    frozenAtMatchdayId,
    createdAt,
    playersById: playersByIdOut,
    teamAggregatesByTeamId,
  };
}

/**
 * True while the current season's valuations are frozen: the game has left the live in-season phase
 * (gamePhase !== "season_active") AND a freeze snapshot for the current season is present.
 */
export function isValuationFrozen(gameState: GameState): boolean {
  if (gameState.gamePhase === "season_active") {
    return false;
  }
  const snapshot = gameState.seasonState?.frozenValuationSnapshot;
  return snapshot != null && snapshot.seasonId === gameState.season.id;
}

/** Returns the frozen row for a single player, or null when not frozen / not captured. */
export function getFrozenValuationRow(
  gameState: GameState,
  playerId: string | null | undefined,
): FrozenValuationPlayerRow | null {
  if (!playerId || !isValuationFrozen(gameState)) {
    return null;
  }
  return gameState.seasonState?.frozenValuationSnapshot?.playersById[playerId] ?? null;
}

const FROZEN_SOURCE_STATUS: PlayerRatingSourceStatus = {
  rawOvr: "ready",
  normalizedOvr: "ready",
  ppsSeason: "ready",
  mvs: "ready",
};

function toRatingRow(frozen: FrozenValuationPlayerRow): PlayerRatingContractRow {
  const warnings: PlayerRatingWarning[] = [];
  if (frozen.frozenMvs == null) {
    warnings.push("mvs_source_missing");
  }
  if (frozen.frozenOvr == null) {
    warnings.push("ovr_raw_source_missing");
  }
  return {
    playerId: frozen.playerId,
    rawOvrScore: frozen.frozenOvr,
    ovrNormalized: frozen.frozenOvr,
    ovrRank: frozen.frozenOvrRank,
    ppsSeason: frozen.frozenPps,
    ppsSeasonRank: frozen.frozenPpsRank,
    ppPow: frozen.frozenPpPow,
    ppPowRank: frozen.frozenPpPowRank,
    ppSpe: frozen.frozenPpSpe,
    ppSpeRank: frozen.frozenPpSpeRank,
    ppMen: frozen.frozenPpMen,
    ppMenRank: frozen.frozenPpMenRank,
    ppSoc: frozen.frozenPpSoc,
    ppSocRank: frozen.frozenPpSocRank,
    ratingPps: null,
    mvs: frozen.frozenMvs,
    mvsRank: frozen.frozenMvsRank,
    marketValue: frozen.frozenMw,
    sourceStatus: FROZEN_SOURCE_STATUS,
    warnings,
  };
}

/**
 * Rehydrates the frozen valuation rows back into the PlayerRatingContractRow shape consumed by the
 * derivations pipeline. Returns null when the state is not frozen.
 */
export function getFrozenRatingRowsMap(
  gameState: GameState,
): Map<string, PlayerRatingContractRow> | null {
  if (!isValuationFrozen(gameState)) {
    return null;
  }
  const snapshot = gameState.seasonState?.frozenValuationSnapshot;
  if (!snapshot) {
    return null;
  }
  const result = new Map<string, PlayerRatingContractRow>();
  for (const frozen of Object.values(snapshot.playersById)) {
    result.set(frozen.playerId, toRatingRow(frozen));
  }
  return result;
}
