type ArenaPreviewCacheEntry<T> = {
  signature: string;
  payload: T;
  cachedAt: number;
};

const arenaPreviewCache = new Map<string, ArenaPreviewCacheEntry<unknown>>();

export function readArenaPreviewCache<T>(cacheKey: string, signature: string): T | null {
  const entry = arenaPreviewCache.get(cacheKey);
  if (!entry || entry.signature !== signature) {
    return null;
  }
  return entry.payload as T;
}

export function writeArenaPreviewCache<T>(cacheKey: string, signature: string, payload: T) {
  arenaPreviewCache.set(cacheKey, {
    signature,
    payload,
    cachedAt: Date.now(),
  });
}

export function invalidateArenaPreviewCache(saveId?: string) {
  if (!saveId) {
    arenaPreviewCache.clear();
    return;
  }

  for (const key of arenaPreviewCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      arenaPreviewCache.delete(key);
    }
  }
}
