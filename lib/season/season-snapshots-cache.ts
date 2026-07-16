type SeasonSnapshotsCacheEntry<T> = {
  signature: string;
  payload: T;
  cachedAt: number;
};

const seasonSnapshotsCache = new Map<string, SeasonSnapshotsCacheEntry<unknown>>();

export function readSeasonSnapshotsCache<T>(cacheKey: string, signature: string): T | null {
  const entry = seasonSnapshotsCache.get(cacheKey);
  if (!entry || entry.signature !== signature) {
    return null;
  }
  return entry.payload as T;
}

export function writeSeasonSnapshotsCache<T>(cacheKey: string, signature: string, payload: T) {
  seasonSnapshotsCache.set(cacheKey, {
    signature,
    payload,
    cachedAt: Date.now(),
  });
}

export function invalidateSeasonSnapshotsCache(saveId?: string) {
  if (!saveId) {
    seasonSnapshotsCache.clear();
    return;
  }

  for (const key of seasonSnapshotsCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      seasonSnapshotsCache.delete(key);
    }
  }
}
