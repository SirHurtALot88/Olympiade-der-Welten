"use client";

import { useEffect, useRef, useState } from "react";

import type { TeamOverviewSliceResponse } from "@/lib/foundation/team-overview-slice";
import {
  fetchSeasonSliceJson,
  readSeasonSliceClientCache,
  writeSeasonSliceClientCache,
} from "@/lib/foundation/season-slice-http";

function buildTeamOverviewSliceRequestKey(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
}) {
  return `${input.saveId}:${input.seasonId}:${input.contentSignature}`;
}

let prefetchedTeamOverviewSlice: { key: string; payload: TeamOverviewSliceResponse } | null = null;

export function seedTeamOverviewSliceCache(
  input: { saveId: string; seasonId: string; contentSignature: string },
  payload: TeamOverviewSliceResponse,
) {
  prefetchedTeamOverviewSlice = {
    key: buildTeamOverviewSliceRequestKey(input),
    payload,
  };
  writeSeasonSliceClientCache(
    buildTeamOverviewSliceRequestKey(input),
    `"team-overview-slice:${input.saveId}:${input.seasonId}:${input.contentSignature}"`,
    payload,
  );
}

export function useTeamOverviewSlice(input: {
  enabled: boolean;
  saveId: string;
  seasonId: string;
  contentSignature: string;
}) {
  const requestKey = buildTeamOverviewSliceRequestKey(input);
  const cachedPayload =
    prefetchedTeamOverviewSlice?.key === requestKey ? prefetchedTeamOverviewSlice.payload : null;
  const [payload, setPayload] = useState<TeamOverviewSliceResponse | null>(cachedPayload);
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

    if (prefetchedTeamOverviewSlice?.key === requestKey) {
      setPayload(prefetchedTeamOverviewSlice.payload);
      setLoading(false);
      setError(null);
      return;
    }

    const memoryCached = readSeasonSliceClientCache<TeamOverviewSliceResponse>(
      requestKey,
      input.contentSignature,
    );
    if (memoryCached) {
      seedTeamOverviewSliceCache(
        {
          saveId: input.saveId,
          seasonId: input.seasonId,
          contentSignature: input.contentSignature,
        },
        memoryCached,
      );
      setPayload(memoryCached);
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
        const result = await fetchSeasonSliceJson<TeamOverviewSliceResponse & { error?: string }>({
          cacheKey: requestKey,
          url: `/api/season/team-overview-slice?${params.toString()}`,
          contentSignature: input.contentSignature,
          signal: controller.signal,
        });
        const body = result.payload;
        if (requestId !== requestIdRef.current) {
          return;
        }
        seedTeamOverviewSliceCache(
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
        setError(cause instanceof Error ? cause.message : "team_overview_slice_failed");
        setPayload(null);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [input.contentSignature, input.enabled, input.saveId, input.seasonId, requestKey]);

  return {
    enabled: input.enabled,
    payload,
    rows: payload?.rows ?? [],
    loading,
    error,
  };
}
