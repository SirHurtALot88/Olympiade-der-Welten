/**
 * In-memory session cache for Matchday Arena v2 API bundles.
 * Survives tab unmount/remount within the same browser session.
 */

export type MatchdayArenaSessionParams = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  source: "sqlite" | "prisma";
};

export type MatchdayArenaBaseBundleCacheEntry = {
  storedAt: number;
  payload: unknown;
};

export type MatchdayArenaResolveCacheEntry = {
  storedAt: number;
  payload: unknown;
};

const MAX_ARENA_BASE_ENTRIES = 12;
const MAX_ARENA_RESOLVE_ENTRIES = 12;

const arenaBaseBundleByKey = new Map<string, MatchdayArenaBaseBundleCacheEntry>();
const arenaResolvePreviewByKey = new Map<string, MatchdayArenaResolveCacheEntry>();

export function buildMatchdayArenaBaseSessionKey(params: MatchdayArenaSessionParams) {
  return `${params.saveId}:${params.seasonId}:${params.matchdayId}:${params.teamId}:${params.source}:base`;
}

export function buildMatchdayArenaResolveSessionKey(
  params: Pick<MatchdayArenaSessionParams, "saveId" | "seasonId" | "matchdayId" | "source">,
) {
  return `${params.saveId}:${params.seasonId}:${params.matchdayId}:${params.source}:resolve`;
}

function trimCacheMap<T>(map: Map<string, T>, maxEntries: number) {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey == null) {
      break;
    }
    map.delete(oldestKey);
  }
}

export function getMatchdayArenaBaseBundle<T = unknown>(key: string): T | null {
  const entry = arenaBaseBundleByKey.get(key);
  return (entry?.payload as T | undefined) ?? null;
}

export function setMatchdayArenaBaseBundle(key: string, payload: unknown) {
  arenaBaseBundleByKey.set(key, { storedAt: Date.now(), payload });
  trimCacheMap(arenaBaseBundleByKey, MAX_ARENA_BASE_ENTRIES);
}

export function getMatchdayArenaResolvePreview<T = unknown>(key: string): T | null {
  const entry = arenaResolvePreviewByKey.get(key);
  return (entry?.payload as T | undefined) ?? null;
}

export function setMatchdayArenaResolvePreview(key: string, payload: unknown) {
  arenaResolvePreviewByKey.set(key, { storedAt: Date.now(), payload });
  trimCacheMap(arenaResolvePreviewByKey, MAX_ARENA_RESOLVE_ENTRIES);
}

export function invalidateMatchdayArenaSessionCache(input?: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
}) {
  if (!input?.saveId && !input?.seasonId && !input?.matchdayId) {
    arenaBaseBundleByKey.clear();
    arenaResolvePreviewByKey.clear();
    return;
  }

  for (const key of arenaBaseBundleByKey.keys()) {
    if (input.saveId && !key.startsWith(`${input.saveId}:`)) {
      continue;
    }
    if (input.seasonId && !key.includes(`:${input.seasonId}:`)) {
      continue;
    }
    if (input.matchdayId && !key.includes(`:${input.matchdayId}:`)) {
      continue;
    }
    arenaBaseBundleByKey.delete(key);
  }

  for (const key of arenaResolvePreviewByKey.keys()) {
    if (input.saveId && !key.startsWith(`${input.saveId}:`)) {
      continue;
    }
    if (input.seasonId && !key.includes(`:${input.seasonId}:`)) {
      continue;
    }
    if (input.matchdayId && !key.includes(`:${input.matchdayId}:`)) {
      continue;
    }
    arenaResolvePreviewByKey.delete(key);
  }
}
