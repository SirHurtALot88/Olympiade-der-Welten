"use client";

import { useEffect, useRef, useState } from "react";

import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerDirectorySliceResponse } from "@/lib/foundation/player-directory-slice";
import { hydrateSeasonRatingsSliceMap } from "@/lib/foundation/season-ratings-slice";

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

  const ratingsById = payload
    ? hydrateSeasonRatingsSliceMap(payload.ratingsByPlayerId)
    : new Map<string, PlayerRatingContractRow>();

  return {
    payload,
    ratingsById,
    performanceByPlayerId: payload?.performanceByPlayerId ?? {},
    careerStatsByPlayerId: payload?.careerStatsByPlayerId ?? {},
    loading,
    error,
  };
}
