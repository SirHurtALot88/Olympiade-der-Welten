import type { GameState } from "@/lib/data/olyDataTypes";
import { type PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";

import { readPersistedSeasonDerivations } from "./materialize-season-derivations";
import { computeSeasonDerivationsFresh } from "./season-derivations-compute";
import { buildGameStateContentSignature } from "./season-derivations-signature";
import {
  buildSeasonDerivationsCacheKey,
  readSeasonDerivationsCache,
  writeSeasonDerivationsCache,
  type SeasonDerivations,
} from "./season-derivations-cache";

export { buildGameStateContentSignature } from "./season-derivations-signature";
export { computeSeasonDerivationsFresh } from "./season-derivations-compute";

export function pickRatingsForPlayerIds(
  ratingsById: Map<string, PlayerRatingContractRow>,
  playerIds: Iterable<string>,
): Map<string, PlayerRatingContractRow> {
  const result = new Map<string, PlayerRatingContractRow>();
  for (const playerId of playerIds) {
    const rating = ratingsById.get(playerId);
    if (rating) {
      result.set(playerId, rating);
    }
  }
  return result;
}

export function getSeasonDerivations(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
}): SeasonDerivations {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const signature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const cacheKey = buildSeasonDerivationsCacheKey(input.saveId, seasonId);

  const cached = readSeasonDerivationsCache(cacheKey, signature);
  if (cached) {
    return cached;
  }

  const persisted = readPersistedSeasonDerivations(input.gameState, signature);
  if (persisted) {
    writeSeasonDerivationsCache(cacheKey, signature, persisted);
    return persisted;
  }

  const payload = computeSeasonDerivationsFresh(input.gameState, seasonId);

  writeSeasonDerivationsCache(cacheKey, signature, payload);
  return payload;
}

export function getSeasonPointsLedger(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
}) {
  return getSeasonDerivations(input).ledger;
}
