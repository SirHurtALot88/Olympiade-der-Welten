"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerDirectorySliceResponse } from "@/lib/foundation/player-directory-slice";
import { hydrateSeasonRatingsSliceMap } from "@/lib/foundation/season-ratings-slice";

// Stable, module-level fallbacks: reused whenever `payload` is null so that
// consumers relying on referential identity (useMemo/useEffect deps) don't
// see a "new" value every render. See use-player-directory-slice.ts history:
// building fresh Map/object literals directly in the render body caused an
// infinite render loop once the Players tab payload loaded (every downstream
// useMemo/useEffect "correctly" recomputed forever because its input never
// stabilized).
const EMPTY_RATINGS_MAP = new Map<string, PlayerRatingContractRow>();
const EMPTY_PERFORMANCE_BY_PLAYER_ID: PlayerDirectorySliceResponse["performanceByPlayerId"] = {};
const EMPTY_CAREER_STATS_BY_PLAYER_ID: PlayerDirectorySliceResponse["careerStatsByPlayerId"] = {};

function buildPlayerDirectorySliceRequestKey(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
}) {
  return `${input.saveId}:${input.seasonId}:${input.contentSignature}`;
}

let prefetchedPlayerDirectorySlice: { key: string; payload: PlayerDirectorySliceResponse } | null = null;

export function seedPlayerDirectorySliceCache(
  input: { saveId: string; seasonId: string; contentSignature: string },
  payload: PlayerDirectorySliceResponse,
) {
  prefetchedPlayerDirectorySlice = {
    key: buildPlayerDirectorySliceRequestKey(input),
    payload,
  };
}

export function usePlayerDirectorySlice(input: {
  enabled: boolean;
  saveId: string;
  seasonId: string;
  contentSignature: string;
}) {
  const requestKey = buildPlayerDirectorySliceRequestKey(input);
  const cachedPayload =
    prefetchedPlayerDirectorySlice?.key === requestKey ? prefetchedPlayerDirectorySlice.payload : null;
  const [payload, setPayload] = useState<PlayerDirectorySliceResponse | null>(cachedPayload);
  const [loading, setLoading] = useState(() => input.enabled && !cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!input.enabled || input.seasonId === "loading") {
      setPayload(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (prefetchedPlayerDirectorySlice?.key === requestKey) {
      setPayload(prefetchedPlayerDirectorySlice.payload);
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
        });
        const response = await fetch(`/api/season/player-directory-slice?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as PlayerDirectorySliceResponse & { error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? `player_directory_slice_http_${response.status}`);
        }
        if (requestId !== requestIdRef.current) {
          return;
        }
        seedPlayerDirectorySliceCache(
          {
            saveId: input.saveId,
            seasonId: input.seasonId,
            contentSignature: input.contentSignature,
          },
          body,
        );
        setPayload(body);
      } catch (cause) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setError(cause instanceof Error ? cause.message : "player_directory_slice_failed");
        setPayload(null);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [input.contentSignature, input.enabled, input.saveId, input.seasonId]);

  const ratingsById = useMemo(
    () => (payload ? hydrateSeasonRatingsSliceMap(payload.ratingsByPlayerId) : EMPTY_RATINGS_MAP),
    [payload],
  );
  const performanceByPlayerId = payload?.performanceByPlayerId ?? EMPTY_PERFORMANCE_BY_PLAYER_ID;
  const careerStatsByPlayerId = payload?.careerStatsByPlayerId ?? EMPTY_CAREER_STATS_BY_PLAYER_ID;

  return {
    payload,
    ratingsById,
    performanceByPlayerId,
    careerStatsByPlayerId,
    loading,
    error,
  };
}
