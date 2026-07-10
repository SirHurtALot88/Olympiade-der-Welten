"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { fetchSeasonSliceJson, readSeasonSliceClientCache } from "@/lib/foundation/season-slice-http";
import type {
  FoundationPrizePreviewResponse,
  FoundationReadMeta,
  FoundationResolvePreviewResponse,
  FoundationSeasonManagementResponse,
  FoundationSeasonStandingsOverviewResponse,
  FoundationStandingsPreviewResponse,
  FoundationView,
} from "@/lib/foundation/tabs/foundation-page-types";
import { isAbortError } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { appendRoomContextToParams, type FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import type { FoundationSeasonFeedReloaders } from "@/lib/foundation/tabs/use-foundation-live-sync";
import type { SeasonOverviewOption } from "@/lib/foundation/tabs/use-season-v2-panel-derivations";
import { seedSeasonStandingsOverviewCache } from "@/lib/foundation/use-season-standings-overview";

export type UseFoundationSeasonFeedActionsInput = {
  activeSaveId: string;
  activeView: FoundationView;
  gameStateSeasonId: string;
  gameStateMatchdayId: string;
  readMeta: FoundationReadMeta;
  isFoundationBootstrapState: boolean;
  roomContext: FoundationRoomContext | null;
  seasonOverviewSeasonId: string | null;
  seasonContentSignature: string;
  marketReloadToken: number;
  prizeFinanceTab: string;
  shouldLoadPrizePreviewFeed: boolean;
  shouldLoadStandingsPreviewFeed: boolean;
  shouldLoadSeasonManagementFeed: boolean;
  seasonFeedReloadersRef: MutableRefObject<FoundationSeasonFeedReloaders>;
  setResolvePreviewFeed: Dispatch<SetStateAction<FoundationResolvePreviewResponse | null>>;
  setStandingsPreviewFeed: Dispatch<SetStateAction<FoundationStandingsPreviewResponse | null>>;
  setPrizePreviewFeed: Dispatch<SetStateAction<FoundationPrizePreviewResponse | null>>;
  setSeasonStandingsFeed: Dispatch<SetStateAction<FoundationSeasonStandingsOverviewResponse | null>>;
  setSeasonStandingsLoading: Dispatch<SetStateAction<boolean>>;
  setSeasonManagementFeed: Dispatch<SetStateAction<FoundationSeasonManagementResponse | null>>;
  setCockpitAiBatchApplyFeed: Dispatch<SetStateAction<any>>;
  setResultApplyFeed: Dispatch<SetStateAction<any>>;
  setStandingsApplyFeed: Dispatch<SetStateAction<any>>;
  setCashApplyFeed: Dispatch<SetStateAction<any>>;
  setMatchdayAdvanceFeed: Dispatch<SetStateAction<any>>;
};

export function useFoundationSeasonFeedActions(input: UseFoundationSeasonFeedActionsInput) {
  const {
    activeSaveId,
    activeView,
    gameStateSeasonId,
    gameStateMatchdayId,
    readMeta,
    isFoundationBootstrapState,
    roomContext,
    seasonOverviewSeasonId,
    seasonContentSignature,
    marketReloadToken,
    prizeFinanceTab,
    shouldLoadPrizePreviewFeed,
    shouldLoadStandingsPreviewFeed,
    shouldLoadSeasonManagementFeed,
    seasonFeedReloadersRef,
    setResolvePreviewFeed,
    setStandingsPreviewFeed,
    setPrizePreviewFeed,
    setSeasonStandingsFeed,
    setSeasonStandingsLoading,
    setSeasonManagementFeed,
    setCockpitAiBatchApplyFeed,
    setResultApplyFeed,
    setStandingsApplyFeed,
    setCashApplyFeed,
    setMatchdayAdvanceFeed,
  } = input;

  const resolvePreviewAbortRef = useRef<AbortController | null>(null);
  const standingsPreviewAbortRef = useRef<AbortController | null>(null);

  function buildCockpitScopeParams() {
    return appendRoomContextToParams(
      new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameStateSeasonId,
        matchdayId: gameStateMatchdayId,
        source: readMeta.source,
      }),
      roomContext,
    );
  }

  async function reloadResolvePreview(signal?: AbortSignal) {
    const response = await fetch(`/api/resolve/legacy-matchday-preview?${buildCockpitScopeParams().toString()}`, {
      cache: "no-store",
      signal,
    });
    const payload = (await response.json()) as FoundationResolvePreviewResponse;
    if (signal?.aborted) {
      return null;
    }
    setResolvePreviewFeed(payload);
    return payload;
  }

  async function reloadStandingsPreviewFeed(signal?: AbortSignal) {
    if (gameStateSeasonId === "loading" || gameStateMatchdayId === "loading") {
      setStandingsPreviewFeed(null);
      return null;
    }
    const response = await fetch(`/api/standings/preview?${buildCockpitScopeParams().toString()}`, {
      cache: "no-store",
      signal,
    });
    const payload = (await response.json()) as FoundationStandingsPreviewResponse;
    if (signal?.aborted) {
      return null;
    }
    setStandingsPreviewFeed(payload);
    return payload;
  }

  async function reloadPrizePreviewFeed() {
    if (gameStateSeasonId === "loading") {
      setPrizePreviewFeed(null);
      return null;
    }
    const params = new URLSearchParams({
      saveId: activeSaveId,
      seasonId: gameStateSeasonId,
      source: readMeta.source,
      phase: "season_end",
    });
    const response = await fetch(`/api/season/prize-preview?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as FoundationPrizePreviewResponse;
    setPrizePreviewFeed(payload);
    return payload;
  }

  async function reloadSeasonStandingsOverview(seasonIdOverride?: string) {
    try {
      const targetSeasonId = seasonIdOverride || seasonOverviewSeasonId || gameStateSeasonId;
      if (targetSeasonId === "loading") {
        setSeasonStandingsFeed(null);
        setSeasonStandingsLoading(false);
        return null;
      }
      const source = readMeta.source ?? "sqlite";
      const cacheKey = `${activeSaveId}:${targetSeasonId}:${seasonContentSignature}:${source}`;
      const cached = readSeasonSliceClientCache<FoundationSeasonStandingsOverviewResponse>(
        cacheKey,
        seasonContentSignature,
      );
      if (cached) {
        setSeasonStandingsFeed(cached);
        setSeasonStandingsLoading(false);
        return cached;
      }
      setSeasonStandingsLoading(true);
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: targetSeasonId,
        source,
        contentSignature: seasonContentSignature,
      });
      const result = await fetchSeasonSliceJson<FoundationSeasonStandingsOverviewResponse>({
        cacheKey,
        url: `/api/season/standings-overview?${params.toString()}`,
        contentSignature: seasonContentSignature,
      });
      seedSeasonStandingsOverviewCache(
        {
          saveId: activeSaveId,
          seasonId: targetSeasonId,
          contentSignature: seasonContentSignature,
          source,
        },
        result.payload,
      );
      setSeasonStandingsFeed(result.payload);
      return result.payload;
    } catch {
      setSeasonStandingsFeed(null);
      return null;
    } finally {
      setSeasonStandingsLoading(false);
    }
  }

  async function reloadSeasonManagementOverview() {
    try {
      if (gameStateSeasonId === "loading") {
        setSeasonManagementFeed(null);
        return null;
      }
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameStateSeasonId,
        source: readMeta.source,
      });
      const response = await fetch(`/api/season/management-overview?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as FoundationSeasonManagementResponse;
      setSeasonManagementFeed(payload);
      return payload;
    } catch {
      setSeasonManagementFeed(null);
      return null;
    }
  }

  seasonFeedReloadersRef.current = {
    reloadSeasonStandingsOverview,
    reloadStandingsPreviewFeed,
    reloadPrizePreviewFeed,
    reloadSeasonManagementOverview,
    reloadResolvePreview,
  };

  useEffect(() => {
    if (!shouldLoadPrizePreviewFeed) {
      return undefined;
    }

    let cancelled = false;

    async function loadPrizePreview() {
      try {
        await reloadPrizePreviewFeed();
        if (cancelled) {
          return;
        }
      } catch {
        if (!cancelled) {
          setPrizePreviewFeed(null);
        }
      }
    }

    void loadPrizePreview();

    return () => {
      cancelled = true;
    };
  }, [
    activeSaveId,
    gameStateMatchdayId,
    gameStateSeasonId,
    marketReloadToken,
    prizeFinanceTab,
    readMeta.source,
    shouldLoadPrizePreviewFeed,
  ]);

  useEffect(() => {
    if (!shouldLoadSeasonManagementFeed || isFoundationBootstrapState) {
      return undefined;
    }

    let cancelled = false;

    async function loadSeasonManagementOverview() {
      try {
        const payload = await reloadSeasonManagementOverview();
        if (cancelled || !payload) {
          return;
        }
      } catch {
        if (!cancelled) {
          setSeasonManagementFeed(null);
        }
      }
    }

    const scheduleLoad = () => {
      if (cancelled) {
        return;
      }
      void loadSeasonManagementOverview();
    };

    let idleHandle: ReturnType<typeof setTimeout> | number | null = null;
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(scheduleLoad, { timeout: 3000 });
      } else {
        idleHandle = setTimeout(scheduleLoad, 150);
      }
    }

    return () => {
      cancelled = true;
      if (idleHandle == null) {
        return;
      }
      if (typeof window !== "undefined" && "requestIdleCallback" in window && typeof idleHandle === "number") {
        window.cancelIdleCallback(idleHandle);
      } else if (typeof window !== "undefined") {
        window.clearTimeout(idleHandle as number);
      }
    };
  }, [
    activeSaveId,
    gameStateSeasonId,
    isFoundationBootstrapState,
    marketReloadToken,
    readMeta.source,
    shouldLoadSeasonManagementFeed,
  ]);

  useEffect(() => {
    if (!shouldLoadStandingsPreviewFeed || isFoundationBootstrapState) {
      standingsPreviewAbortRef.current?.abort();
      standingsPreviewAbortRef.current = null;
      return undefined;
    }

    let cancelled = false;
    standingsPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    standingsPreviewAbortRef.current = controller;

    async function loadStandingsPreview() {
      try {
        const payload = await reloadStandingsPreviewFeed(controller.signal);
        if (cancelled || !payload) {
          return;
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          setStandingsPreviewFeed(null);
        }
      }
    }

    const scheduleLoad = () => {
      if (cancelled) {
        return;
      }
      void loadStandingsPreview();
    };

    let idleHandle: ReturnType<typeof setTimeout> | number | null = null;
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(scheduleLoad, { timeout: 4000 });
      } else {
        idleHandle = setTimeout(scheduleLoad, 200);
      }
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (standingsPreviewAbortRef.current === controller) {
        standingsPreviewAbortRef.current = null;
      }
      if (idleHandle == null) {
        return;
      }
      if (typeof window !== "undefined" && "requestIdleCallback" in window && typeof idleHandle === "number") {
        window.cancelIdleCallback(idleHandle);
      } else if (typeof window !== "undefined") {
        window.clearTimeout(idleHandle as number);
      }
    };
  }, [
    activeSaveId,
    gameStateMatchdayId,
    gameStateSeasonId,
    marketReloadToken,
    readMeta.source,
    shouldLoadStandingsPreviewFeed,
  ]);

  useEffect(() => {
    setResolvePreviewFeed(null);
    setCockpitAiBatchApplyFeed(null);
    setResultApplyFeed(null);
    setStandingsApplyFeed(null);
    setCashApplyFeed(null);
    setMatchdayAdvanceFeed(null);
  }, [activeSaveId, gameStateMatchdayId, gameStateSeasonId, readMeta.source]);

  useEffect(() => {
    if (activeView !== "cockpit") {
      resolvePreviewAbortRef.current?.abort();
      resolvePreviewAbortRef.current = null;
      return;
    }

    let cancelled = false;
    resolvePreviewAbortRef.current?.abort();
    const controller = new AbortController();
    resolvePreviewAbortRef.current = controller;

    async function loadResolvePreview() {
      try {
        const payload = await reloadResolvePreview(controller.signal);
        if (cancelled) {
          return;
        }
        if (payload) {
          setResolvePreviewFeed(payload);
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          setResolvePreviewFeed(null);
        }
      }
    }

    void loadResolvePreview();

    return () => {
      cancelled = true;
      controller.abort();
      if (resolvePreviewAbortRef.current === controller) {
        resolvePreviewAbortRef.current = null;
      }
    };
  }, [activeSaveId, activeView, gameStateMatchdayId, gameStateSeasonId, readMeta.source]);

  return {
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    reloadPrizePreviewFeed,
    reloadSeasonStandingsOverview,
    reloadSeasonManagementOverview,
    buildCockpitScopeParams,
  };
}

export type UseFoundationSeasonOverviewFeedEffectInput = {
  activeSaveId: string;
  gameStateSeasonId: string;
  isFoundationBootstrapState: boolean;
  seasonOverviewSeasonId: string | null;
  setSeasonOverviewSeasonId: Dispatch<SetStateAction<string>>;
  seasonStandingsFeed: FoundationSeasonStandingsOverviewResponse | null;
  seasonOverviewOptions: SeasonOverviewOption[];
  shouldLoadSeasonOverviewFeed: boolean;
  shouldLoadSeasonOverviewFeedActive: boolean;
  shouldLoadTeamsHistoryOverview: boolean;
  seasonOverviewScopeRef: MutableRefObject<string | null>;
  reloadSeasonStandingsOverview: (seasonIdOverride?: string) => Promise<unknown>;
};

export function useFoundationSeasonOverviewFeedEffect(input: UseFoundationSeasonOverviewFeedEffectInput) {
  const {
    activeSaveId,
    gameStateSeasonId,
    isFoundationBootstrapState,
    seasonOverviewSeasonId,
    setSeasonOverviewSeasonId,
    seasonStandingsFeed,
    seasonOverviewOptions,
    shouldLoadSeasonOverviewFeed,
    shouldLoadSeasonOverviewFeedActive,
    reloadSeasonStandingsOverview,
    seasonOverviewScopeRef,
  } = input;

  useEffect(() => {
    if (isFoundationBootstrapState || !shouldLoadSeasonOverviewFeedActive) {
      return;
    }

    const scopeKey = `${activeSaveId}:${gameStateSeasonId}`;
    if (seasonOverviewScopeRef.current !== scopeKey) {
      seasonOverviewScopeRef.current = scopeKey;
      setSeasonOverviewSeasonId(gameStateSeasonId);
      void reloadSeasonStandingsOverview(gameStateSeasonId);
      return;
    }

    if (shouldLoadSeasonOverviewFeed && !seasonStandingsFeed) {
      void reloadSeasonStandingsOverview(seasonOverviewSeasonId || gameStateSeasonId);
      return;
    }

    if (seasonOverviewOptions.some((option) => option.seasonId === seasonOverviewSeasonId)) {
      return;
    }
    setSeasonOverviewSeasonId(gameStateSeasonId);
    void reloadSeasonStandingsOverview(gameStateSeasonId);
  }, [
    activeSaveId,
    gameStateSeasonId,
    isFoundationBootstrapState,
    seasonOverviewOptions,
    seasonOverviewSeasonId,
    seasonStandingsFeed,
    shouldLoadSeasonOverviewFeed,
    shouldLoadSeasonOverviewFeedActive,
    reloadSeasonStandingsOverview,
    setSeasonOverviewSeasonId,
    seasonOverviewScopeRef,
  ]);
}
