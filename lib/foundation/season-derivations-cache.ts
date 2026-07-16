import type { FieldRaceLedger } from "@/lib/foundation/build-field-race-ledger";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

export type SeasonDerivations = {
  ledger: SeasonPointsLedger;
  ratingsById: Map<string, PlayerRatingContractRow>;
  performanceByPlayerId: Map<string, PlayerSeasonPerformanceSummary>;
  fieldRaceLedger: FieldRaceLedger;
};

type SeasonDerivationsCacheEntry = {
  signature: string;
  payload: SeasonDerivations;
  cachedAt: number;
};

const DEFAULT_MAX_CACHE_ENTRIES = 4;

let maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES;
const seasonDerivationsCache = new Map<string, SeasonDerivationsCacheEntry>();

export function setSeasonDerivationsCacheMaxEntries(maxEntries: number) {
  maxCacheEntries = Math.max(1, Math.round(maxEntries));
  evictSeasonDerivationsCacheToLimit();
}

export function getSeasonDerivationsCacheMaxEntries() {
  return maxCacheEntries;
}

function evictSeasonDerivationsCacheToLimit() {
  while (seasonDerivationsCache.size > maxCacheEntries) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of seasonDerivationsCache) {
      if (entry.cachedAt < oldestAt) {
        oldestAt = entry.cachedAt;
        oldestKey = key;
      }
    }
    if (!oldestKey) {
      break;
    }
    seasonDerivationsCache.delete(oldestKey);
  }
}

export function buildSeasonDerivationsCacheKey(saveId: string, seasonId: string) {
  return `${saveId}:${seasonId}`;
}

export function readSeasonDerivationsCache(cacheKey: string, signature: string): SeasonDerivations | null {
  const entry = seasonDerivationsCache.get(cacheKey);
  if (!entry || entry.signature !== signature) {
    return null;
  }
  seasonDerivationsCache.delete(cacheKey);
  seasonDerivationsCache.set(cacheKey, entry);
  return entry.payload;
}

export function writeSeasonDerivationsCache(cacheKey: string, signature: string, payload: SeasonDerivations) {
  seasonDerivationsCache.set(cacheKey, {
    signature,
    payload,
    cachedAt: Date.now(),
  });
  evictSeasonDerivationsCacheToLimit();
}

export function invalidateSeasonDerivationsCache(saveId?: string) {
  if (!saveId) {
    seasonDerivationsCache.clear();
    return;
  }

  for (const key of seasonDerivationsCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      seasonDerivationsCache.delete(key);
    }
  }
}

export function seasonDerivationsCacheSizeForTests() {
  return seasonDerivationsCache.size;
}
