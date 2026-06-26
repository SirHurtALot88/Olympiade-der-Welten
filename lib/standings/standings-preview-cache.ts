type StandingsPreviewCacheEntry<T> = {
  signature: string;
  payload: T;
  cachedAt: number;
};

const standingsPreviewCache = new Map<string, StandingsPreviewCacheEntry<unknown>>();

export function readStandingsPreviewCache<T>(cacheKey: string, signature: string): T | null {
  const entry = standingsPreviewCache.get(cacheKey);
  if (!entry || entry.signature !== signature) {
    return null;
  }
  return entry.payload as T;
}

export function writeStandingsPreviewCache<T>(cacheKey: string, signature: string, payload: T) {
  standingsPreviewCache.set(cacheKey, {
    signature,
    payload,
    cachedAt: Date.now(),
  });
}

export function invalidateStandingsPreviewCache(saveId?: string) {
  if (!saveId) {
    standingsPreviewCache.clear();
    return;
  }

  for (const key of standingsPreviewCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      standingsPreviewCache.delete(key);
    }
  }
}
