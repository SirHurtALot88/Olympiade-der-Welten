import { NextResponse } from "next/server";

export function buildSeasonSliceEtag(input: {
  slice: string;
  saveId: string;
  seasonId: string;
  contentSignature: string;
}) {
  return `"${input.slice}:${input.saveId}:${input.seasonId}:${input.contentSignature}"`;
}

export function readSliceRequestEtag(request: Request): string | null {
  const value = request.headers.get("if-none-match")?.trim();
  return value || null;
}

export function sliceJsonResponse(payload: unknown, etag: string, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      ETag: etag,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

export function respondWithSliceEtag<T extends Record<string, unknown>>(
  request: Request,
  input: {
    slice: string;
    saveId: string;
    seasonId: string;
    contentSignature: string;
    payload: T;
  },
) {
  const etag = buildSeasonSliceEtag(input);
  if (readSliceRequestEtag(request) === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  }
  return sliceJsonResponse(input.payload, etag);
}

type SeasonSliceClientCacheEntry = {
  etag: string;
  payload: unknown;
};

const seasonSliceClientCache = new Map<string, SeasonSliceClientCacheEntry>();

export function readSeasonSliceClientCache<T>(cacheKey: string, contentSignature: string): T | null {
  const entry = seasonSliceClientCache.get(cacheKey);
  if (!entry || !entry.etag.includes(contentSignature)) {
    return null;
  }
  return entry.payload as T;
}

export function writeSeasonSliceClientCache(cacheKey: string, etag: string, payload: unknown) {
  seasonSliceClientCache.set(cacheKey, { etag, payload });
}

export function invalidateSeasonSliceClientCache(saveId?: string) {
  if (!saveId) {
    seasonSliceClientCache.clear();
    return;
  }

  for (const key of seasonSliceClientCache.keys()) {
    if (key.startsWith(`${saveId}:`)) {
      seasonSliceClientCache.delete(key);
    }
  }
}

export function seasonSliceClientCacheSizeForTests() {
  return seasonSliceClientCache.size;
}

export function seedSeasonSliceClientCacheEtagForTests(cacheKey: string, etag: string) {
  seasonSliceClientCache.set(cacheKey, { etag, payload: undefined });
}

export async function fetchSeasonSliceJson<T>(input: {
  cacheKey: string;
  url: string;
  contentSignature: string;
  signal?: AbortSignal;
}): Promise<{ payload: T; fromCache: boolean }> {
  const memoryCached = readSeasonSliceClientCache<T>(input.cacheKey, input.contentSignature);
  if (memoryCached) {
    return { payload: memoryCached, fromCache: true };
  }

  const cachedEntry = seasonSliceClientCache.get(input.cacheKey);
  const headers: HeadersInit = {};
  if (cachedEntry?.etag) {
    headers["If-None-Match"] = cachedEntry.etag;
  }

  const response = await fetch(input.url, {
    cache: "no-store",
    signal: input.signal,
    headers,
  });

  if (response.status === 304) {
    const entry = seasonSliceClientCache.get(input.cacheKey);
    if (entry?.payload) {
      return { payload: entry.payload as T, fromCache: true };
    }
    // ETag survived a module reset or partial invalidation — refetch without conditional headers.
    seasonSliceClientCache.delete(input.cacheKey);
    const retryResponse = await fetch(input.url, {
      cache: "no-store",
      signal: input.signal,
    });
    if (!retryResponse.ok) {
      const errorPayload = (await retryResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorPayload.error ?? `season_slice_http_${retryResponse.status}`);
    }
    const retryPayload = (await retryResponse.json()) as T;
    const retryEtag = retryResponse.headers.get("etag")?.trim();
    if (retryEtag) {
      writeSeasonSliceClientCache(input.cacheKey, retryEtag, retryPayload);
    } else {
      writeSeasonSliceClientCache(
        input.cacheKey,
        buildSeasonSliceEtag({
          slice: "unknown",
          saveId: input.cacheKey.split(":")[0] ?? "save",
          seasonId: input.cacheKey.split(":")[1] ?? "season",
          contentSignature: input.contentSignature,
        }),
        retryPayload,
      );
    }
    return { payload: retryPayload, fromCache: false };
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorPayload.error ?? `season_slice_http_${response.status}`);
  }

  const payload = (await response.json()) as T;
  const etag = response.headers.get("etag")?.trim();
  if (etag) {
    writeSeasonSliceClientCache(input.cacheKey, etag, payload);
  } else {
    writeSeasonSliceClientCache(
      input.cacheKey,
      buildSeasonSliceEtag({
        slice: "unknown",
        saveId: input.cacheKey.split(":")[0] ?? "save",
        seasonId: input.cacheKey.split(":")[1] ?? "season",
        contentSignature: input.contentSignature,
      }),
      payload,
    );
  }

  return { payload, fromCache: false };
}
