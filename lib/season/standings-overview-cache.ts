type StandingsOverviewCacheEntry<T> = {
  signature: string;
  payload: T;
  cachedAt: number;
};

const standingsOverviewCache = new Map<string, StandingsOverviewCacheEntry<unknown>>();

export function readStandingsOverviewCache<T>(cacheKey: string, signature: string): T | null {
  const entry = standingsOverviewCache.get(cacheKey);
  if (!entry || entry.signature !== signature) {
    return null;
  }
  return entry.payload as T;
}

export function writeStandingsOverviewCache<T>(cacheKey: string, signature: string, payload: T) {
  standingsOverviewCache.set(cacheKey, {
    signature,
    payload,
    cachedAt: Date.now(),
  });
}

export function invalidateStandingsOverviewCache(saveId?: string) {
  if (!saveId) {
    standingsOverviewCache.clear();
    return;
  }

  for (const key of standingsOverviewCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      standingsOverviewCache.delete(key);
    }
  }
}
