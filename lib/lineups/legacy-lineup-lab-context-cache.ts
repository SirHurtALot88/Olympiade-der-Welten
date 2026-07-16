type LegacyLineupLabContextCacheEntry = {
  signature: string;
  payload: unknown;
  cachedAt: number;
};

const legacyLineupLabContextCache = new Map<string, LegacyLineupLabContextCacheEntry>();

export function buildLegacyLineupLabContextCacheKey(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  activeOwnerId: string;
}) {
  return `${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.teamId}:${input.activeOwnerId}`;
}

export function readLegacyLineupLabContextCache<T>(cacheKey: string, signature: string): T | null {
  const entry = legacyLineupLabContextCache.get(cacheKey);
  if (!entry || entry.signature !== signature) {
    return null;
  }
  return entry.payload as T;
}

export function writeLegacyLineupLabContextCache<T>(cacheKey: string, signature: string, payload: T) {
  legacyLineupLabContextCache.set(cacheKey, {
    signature,
    payload,
    cachedAt: Date.now(),
  });
}

export function invalidateLegacyLineupLabContextCache(saveId?: string) {
  if (!saveId) {
    legacyLineupLabContextCache.clear();
    return;
  }

  for (const key of legacyLineupLabContextCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      legacyLineupLabContextCache.delete(key);
    }
  }
}
