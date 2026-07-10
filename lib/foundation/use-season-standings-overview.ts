"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchSeasonSliceJson,
  readSeasonSliceClientCache,
  writeSeasonSliceClientCache,
} from "@/lib/foundation/season-slice-http";

export type SeasonStandingsOverviewScope = {
  saveId: string;
  seasonId: string;
};

export type SeasonStandingsOverviewResponse = {
  items: unknown[];
  missingMappings: unknown[];
  mappingWarnings: string[];
  source: {
    kind: string;
    access?: string;
    detectedColumns?: string[];
    disciplineColumns?: Array<{ normalizedKey: string; sheetColumn: string }>;
  };
  scope: SeasonStandingsOverviewScope | null;
  error?: string;
};

function buildStandingsOverviewCacheKey(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  source: string;
}) {
  return `${input.saveId}:${input.seasonId}:${input.contentSignature}:${input.source}`;
}

export function seedSeasonStandingsOverviewCache(
  input: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
    source?: string;
  },
  payload: SeasonStandingsOverviewResponse,
) {
  const cacheKey = buildStandingsOverviewCacheKey({
    saveId: input.saveId,
    seasonId: input.seasonId,
    contentSignature: input.contentSignature,
    source: input.source ?? "sqlite",
  });
  writeSeasonSliceClientCache(
    cacheKey,
    `"standings-overview:${input.saveId}:${input.seasonId}:${input.contentSignature}"`,
    payload,
  );
}

export function useSeasonStandingsOverview(input: {
  enabled: boolean;
  saveId: string;
  seasonId: string;
  contentSignature: string;
  source?: string;
}) {
  const source = input.source ?? "sqlite";
  const cacheKey = buildStandingsOverviewCacheKey({
    saveId: input.saveId,
    seasonId: input.seasonId,
    contentSignature: input.contentSignature,
    source,
  });
  const cachedPayload = readSeasonSliceClientCache<SeasonStandingsOverviewResponse>(
    cacheKey,
    input.contentSignature,
  );
  const [payload, setPayload] = useState<SeasonStandingsOverviewResponse | null>(cachedPayload);
  const [loading, setLoading] = useState(() => input.enabled && !cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!input.saveId || input.seasonId === "loading") {
      return null;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        saveId: input.saveId,
        seasonId: input.seasonId,
        source,
        contentSignature: input.contentSignature,
      });
      const result = await fetchSeasonSliceJson<SeasonStandingsOverviewResponse>({
        cacheKey,
        url: `/api/season/standings-overview?${params.toString()}`,
        contentSignature: input.contentSignature,
      });
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setPayload(result.payload);
      return result.payload;
    } catch (cause) {
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setError(cause instanceof Error ? cause.message : "standings_overview_failed");
      setPayload(null);
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [cacheKey, input.contentSignature, input.saveId, input.seasonId, source]);

  useEffect(() => {
    if (!input.enabled || input.seasonId === "loading") {
      setPayload(null);
      setLoading(false);
      setError(null);
      return;
    }

    const seeded = readSeasonSliceClientCache<SeasonStandingsOverviewResponse>(
      cacheKey,
      input.contentSignature,
    );
    if (seeded) {
      setPayload(seeded);
      setLoading(false);
      setError(null);
      return;
    }

    void reload();
    return () => {
      requestIdRef.current += 1;
    };
  }, [cacheKey, input.contentSignature, input.enabled, input.seasonId, reload]);

  return {
    payload,
    loading,
    error,
    reload,
  };
}
