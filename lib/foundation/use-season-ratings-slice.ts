"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import { pickRatingsForPlayerIds } from "@/lib/foundation/get-season-derivations";
import {
  fetchSeasonSliceJson,
  readSeasonSliceClientCache,
  writeSeasonSliceClientCache,
} from "@/lib/foundation/season-slice-http";
import {
  hydrateSeasonRatingsSliceMap,
  type SeasonRatingsSliceResponse,
} from "@/lib/foundation/season-ratings-slice";

function buildSeasonRatingsSliceRequestKey(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  source?: "sqlite" | "prisma";
  playerIdsKey?: string;
}) {
  return `${input.saveId}:${input.seasonId}:${input.contentSignature}:${input.source ?? "sqlite"}:${input.playerIdsKey ?? ""}`;
}

let prefetchedSeasonRatingsSlice: { key: string; payload: SeasonRatingsSliceResponse } | null = null;

export function seedSeasonRatingsSliceCache(
  input: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
    source?: "sqlite" | "prisma";
    playerIdsKey?: string;
  },
  payload: SeasonRatingsSliceResponse,
) {
  prefetchedSeasonRatingsSlice = {
    key: buildSeasonRatingsSliceRequestKey(input),
    payload,
  };
  writeSeasonSliceClientCache(
    buildSeasonRatingsSliceRequestKey(input),
    `"ratings-slice:${input.saveId}:${input.seasonId}:${input.contentSignature}"`,
    payload,
  );
}

function resolveRatingsFromPrefetchedCache(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  source?: "sqlite" | "prisma";
  playerIds?: string[];
  playerIdsKey: string;
}): Map<string, PlayerRatingContractRow> | null {
  const fullKey = buildSeasonRatingsSliceRequestKey({
    saveId: input.saveId,
    seasonId: input.seasonId,
    contentSignature: input.contentSignature,
    source: input.source,
    playerIdsKey: "",
  });
  const scopedKey = buildSeasonRatingsSliceRequestKey({
    saveId: input.saveId,
    seasonId: input.seasonId,
    contentSignature: input.contentSignature,
    source: input.source,
    playerIdsKey: input.playerIdsKey,
  });

  const cached =
    prefetchedSeasonRatingsSlice?.key === scopedKey
      ? prefetchedSeasonRatingsSlice.payload
      : prefetchedSeasonRatingsSlice?.key === fullKey
        ? prefetchedSeasonRatingsSlice.payload
        : null;

  if (!cached) {
    return null;
  }

  const hydrated = hydrateSeasonRatingsSliceMap(cached.ratingsByPlayerId ?? {});
  if (!input.playerIds?.length) {
    return hydrated;
  }
  return pickRatingsForPlayerIds(hydrated, input.playerIds);
}

export function useSeasonRatingsSlice(input: {
  enabled: boolean;
  saveId: string;
  seasonId: string;
  contentSignature: string;
  source?: "sqlite" | "prisma";
  playerIds?: string[];
}) {
  const [ratingsById, setRatingsById] = useState<Map<string, PlayerRatingContractRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const playerIdsKey = useMemo(
    () => (input.playerIds?.length ? [...input.playerIds].sort().join(",") : ""),
    [input.playerIds],
  );

  useEffect(() => {
    if (!input.enabled || input.seasonId === "loading") {
      setRatingsById(new Map());
      setLoading(false);
      setError(null);
      return;
    }

    if (input.source === "prisma") {
      setRatingsById(new Map());
      setLoading(false);
      setError("ratings_slice_sqlite_only");
      return;
    }

    const cachedRatings = resolveRatingsFromPrefetchedCache({
      saveId: input.saveId,
      seasonId: input.seasonId,
      contentSignature: input.contentSignature,
      source: input.source,
      playerIds: input.playerIds,
      playerIdsKey,
    });
    if (cachedRatings) {
      setRatingsById(cachedRatings);
      setLoading(false);
      setError(null);
      return;
    }

    const memoryCached = readSeasonSliceClientCache<SeasonRatingsSliceResponse>(
      buildSeasonRatingsSliceRequestKey({
        saveId: input.saveId,
        seasonId: input.seasonId,
        contentSignature: input.contentSignature,
        source: input.source,
        playerIdsKey,
      }),
      input.contentSignature,
    );
    if (memoryCached) {
      seedSeasonRatingsSliceCache(
        {
          saveId: input.saveId,
          seasonId: input.seasonId,
          contentSignature: input.contentSignature,
          source: input.source,
          playerIdsKey,
        },
        memoryCached,
      );
      setRatingsById(hydrateSeasonRatingsSliceMap(memoryCached.ratingsByPlayerId ?? {}));
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          saveId: input.saveId,
          seasonId: input.seasonId,
          contentSignature: input.contentSignature,
          source: input.source ?? "sqlite",
        });
        if (playerIdsKey) {
          params.set("playerIds", playerIdsKey);
        }

        const cacheKey = buildSeasonRatingsSliceRequestKey({
          saveId: input.saveId,
          seasonId: input.seasonId,
          contentSignature: input.contentSignature,
          source: input.source,
          playerIdsKey,
        });
        const result = await fetchSeasonSliceJson<SeasonRatingsSliceResponse & { error?: string }>({
          cacheKey,
          url: `/api/season/ratings-slice?${params.toString()}`,
          contentSignature: input.contentSignature,
          signal: controller.signal,
        });
        const payload = result.payload;
        if (requestId !== requestIdRef.current) {
          return;
        }
        seedSeasonRatingsSliceCache(
          {
            saveId: input.saveId,
            seasonId: input.seasonId,
            contentSignature: input.contentSignature,
            source: input.source,
            playerIdsKey,
          },
          payload,
        );
        setRatingsById(hydrateSeasonRatingsSliceMap(payload.ratingsByPlayerId ?? {}));
      } catch (cause) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setError(cause instanceof Error ? cause.message : "ratings_slice_failed");
        setRatingsById(new Map());
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [
    input.contentSignature,
    input.enabled,
    input.saveId,
    input.seasonId,
    input.source,
    playerIdsKey,
  ]);

  return { ratingsById, loading, error };
}
