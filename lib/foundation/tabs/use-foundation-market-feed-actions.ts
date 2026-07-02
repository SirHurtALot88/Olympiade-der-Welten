"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  FoundationAiMarketPlanPreviewResponse,
  FoundationAiNeedsPicksCompareResponse,
  FoundationAiSellPreviewResponse,
  FoundationAiTransferPreviewResponse,
  FoundationReadMeta,
  FoundationTransferHistoryResponse,
  FoundationTransfermarktResponse,
  FoundationTransferRecapResponse,
  FoundationView,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  TRANSFER_HISTORY_SEASON_LIMIT,
  TRANSFER_MARKET_INITIAL_RENDER_LIMIT,
  TRANSFER_MARKET_RENDER_STEP,
} from "@/lib/foundation/tabs/foundation-page-types";
import { isAbortError } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { HISTORY_ALL_SEASONS_FILTER } from "@/lib/foundation/tabs/use-history-v2-derivations";
import type { FoundationMarketFeedReloaders } from "@/lib/foundation/tabs/use-foundation-live-sync";

export type UseFoundationMarketFeedActionsInput = {
  activeSaveId: string;
  activeView: FoundationView;
  gameStateSeasonId: string;
  readMeta: FoundationReadMeta;
  isFoundationBootstrapState: boolean;
  marketTeamId: string | null;
  marketMaxValue: number;
  marketFeed: FoundationTransfermarktResponse | null;
  setMarketFeed: Dispatch<SetStateAction<FoundationTransfermarktResponse | null>>;
  setMarketRenderLimit: Dispatch<SetStateAction<number>>;
  marketLoadingMore: boolean;
  setMarketLoadingMore: Dispatch<SetStateAction<boolean>>;
  marketReloadToken: number;
  marketAiTeamScope: string;
  marketAiSellTeamScope: string;
  marketAiPlanTeamScope: string;
  marketAiCompareTeamScope: string;
  setMarketAiPreviewBusy: Dispatch<SetStateAction<boolean>>;
  setMarketAiPreviewError: Dispatch<SetStateAction<string | null>>;
  setMarketAiPreviewFeed: Dispatch<SetStateAction<FoundationAiTransferPreviewResponse | null>>;
  setMarketAiPreviewSelectedTeamId: Dispatch<SetStateAction<string | null>>;
  setMarketAiSellPreviewBusy: Dispatch<SetStateAction<boolean>>;
  setMarketAiSellPreviewError: Dispatch<SetStateAction<string | null>>;
  setMarketAiSellPreviewFeed: Dispatch<SetStateAction<FoundationAiSellPreviewResponse | null>>;
  setMarketAiSellPreviewSelectedTeamId: Dispatch<SetStateAction<string | null>>;
  setMarketAiPlanPreviewBusy: Dispatch<SetStateAction<boolean>>;
  setMarketAiPlanPreviewError: Dispatch<SetStateAction<string | null>>;
  setMarketAiPlanPreviewFeed: Dispatch<SetStateAction<FoundationAiMarketPlanPreviewResponse | null>>;
  setMarketAiPlanPreviewSelectedTeamId: Dispatch<SetStateAction<string | null>>;
  setMarketAiCompareBusy: Dispatch<SetStateAction<boolean>>;
  setMarketAiCompareError: Dispatch<SetStateAction<string | null>>;
  setMarketAiCompareFeed: Dispatch<SetStateAction<FoundationAiNeedsPicksCompareResponse | null>>;
  setMarketAiCompareSelectedTeamId: Dispatch<SetStateAction<string | null>>;
  historyFeed: FoundationTransferHistoryResponse | null;
  setHistoryFeed: Dispatch<SetStateAction<FoundationTransferHistoryResponse | null>>;
  historySeasonFilter: string;
  historyLoadingMore: boolean;
  setHistoryLoadingMore: Dispatch<SetStateAction<boolean>>;
  setTransferRecapFeed: Dispatch<SetStateAction<FoundationTransferRecapResponse | null>>;
  shouldLoadTransferHistoryFeed: boolean;
  shouldLoadTransferRecapFeed: boolean;
  seasonOverviewSeasonId: string | null;
  marketFeedReloadersRef: MutableRefObject<FoundationMarketFeedReloaders>;
};

export function useFoundationMarketFeedActions(input: UseFoundationMarketFeedActionsInput) {
  const {
    activeSaveId,
    activeView,
    gameStateSeasonId,
    readMeta,
    isFoundationBootstrapState,
    marketTeamId,
    marketMaxValue,
    marketFeed,
    setMarketFeed,
    setMarketRenderLimit,
    marketLoadingMore,
    setMarketLoadingMore,
    marketReloadToken,
    marketAiTeamScope,
    marketAiSellTeamScope,
    marketAiPlanTeamScope,
    marketAiCompareTeamScope,
    setMarketAiPreviewBusy,
    setMarketAiPreviewError,
    setMarketAiPreviewFeed,
    setMarketAiPreviewSelectedTeamId,
    setMarketAiSellPreviewBusy,
    setMarketAiSellPreviewError,
    setMarketAiSellPreviewFeed,
    setMarketAiSellPreviewSelectedTeamId,
    setMarketAiPlanPreviewBusy,
    setMarketAiPlanPreviewError,
    setMarketAiPlanPreviewFeed,
    setMarketAiPlanPreviewSelectedTeamId,
    setMarketAiCompareBusy,
    setMarketAiCompareError,
    setMarketAiCompareFeed,
    setMarketAiCompareSelectedTeamId,
    historyFeed,
    setHistoryFeed,
    historySeasonFilter,
    historyLoadingMore,
    setHistoryLoadingMore,
    setTransferRecapFeed,
    shouldLoadTransferHistoryFeed,
    shouldLoadTransferRecapFeed,
    seasonOverviewSeasonId,
    marketFeedReloadersRef,
  } = input;

  const marketFeedAbortRef = useRef<AbortController | null>(null);
  const historyFeedAbortRef = useRef<AbortController | null>(null);
  const transferRecapAbortRef = useRef<AbortController | null>(null);

  async function reloadMarketFeed(
    teamIdOverride?: string,
    signal?: AbortSignal,
    options?: { append?: boolean; offset?: number },
  ) {
    try {
      const effectiveTeamId = typeof teamIdOverride === "string" ? teamIdOverride : marketTeamId;
      if (gameStateSeasonId === "loading" || effectiveTeamId === "loading-team") {
        setMarketFeed(null);
        return null;
      }
      const offset = options?.offset ?? (options?.append ? marketFeed?.items.length ?? 0 : 0);
      const params = new URLSearchParams({
        saveId: activeSaveId,
        source: readMeta.source,
        limit: String(TRANSFER_MARKET_RENDER_STEP),
        offset: String(offset),
        maxMarketValue: String(marketMaxValue),
      });
      if (effectiveTeamId) {
        params.set("teamId", effectiveTeamId);
      }
      const response = await fetch(`/api/transfermarkt/free-agents?${params.toString()}`, { cache: "no-store", signal });
      const payload = (await response.json()) as FoundationTransfermarktResponse;
      if (signal?.aborted) {
        return null;
      }
      if (!response.ok || payload.error) {
        setMarketFeed(null);
        return null;
      }
      const nextPayload =
        options?.append && marketFeed
          ? {
              ...payload,
              items: [
                ...marketFeed.items,
                ...payload.items.filter((item) => !marketFeed.items.some((existing) => existing.playerId === item.playerId)),
              ],
              returned:
                marketFeed.items.length +
                payload.items.filter((item) => !marketFeed.items.some((existing) => existing.playerId === item.playerId)).length,
            }
          : payload;
      if (!options?.append) {
        setMarketRenderLimit(TRANSFER_MARKET_INITIAL_RENDER_LIMIT);
      }
      setMarketFeed(nextPayload);
      return nextPayload;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        return null;
      }
      setMarketFeed(null);
      return null;
    }
  }

  async function reloadAiTransferPreview(teamIdOverride?: string | null) {
    try {
      setMarketAiPreviewBusy(true);
      setMarketAiPreviewError(null);
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameStateSeasonId,
        source: readMeta.source,
        teamScope: marketAiTeamScope,
        limit: "90",
      });
      const effectiveTeamId = typeof teamIdOverride === "string" ? teamIdOverride : null;
      if (effectiveTeamId) {
        params.set("teamId", effectiveTeamId);
      }
      const response = await fetch(`/api/transfermarkt/ai-preview?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as FoundationAiTransferPreviewResponse;
      if (!response.ok || payload.error) {
        setMarketAiPreviewFeed(null);
        setMarketAiPreviewError(payload.error ?? "Auto-Kaufideen konnten nicht geladen werden.");
        return null;
      }
      setMarketAiPreviewFeed(payload);
      setMarketAiPreviewSelectedTeamId((current) => {
        const nextTeamId = effectiveTeamId ?? current ?? payload.teams[0]?.teamId ?? null;
        return payload.teams.some((team) => team.teamId === nextTeamId) ? nextTeamId : payload.teams[0]?.teamId ?? null;
      });
      return payload;
    } catch {
      setMarketAiPreviewFeed(null);
      setMarketAiPreviewError("Auto-Kaufideen konnten nicht geladen werden.");
      return null;
    } finally {
      setMarketAiPreviewBusy(false);
    }
  }

  async function reloadAiSellPreview(teamIdOverride?: string | null) {
    try {
      setMarketAiSellPreviewBusy(true);
      setMarketAiSellPreviewError(null);
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameStateSeasonId,
        source: readMeta.source,
        teamScope: marketAiSellTeamScope,
        limit: "6",
      });
      const effectiveTeamId = typeof teamIdOverride === "string" ? teamIdOverride : null;
      if (effectiveTeamId) {
        params.set("teamId", effectiveTeamId);
      }
      const response = await fetch(`/api/transfermarkt/ai-sell-preview?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as FoundationAiSellPreviewResponse;
      if (!response.ok || payload.error) {
        setMarketAiSellPreviewFeed(null);
        setMarketAiSellPreviewError(payload.error ?? "Auto-Verkaufsideen konnten nicht geladen werden.");
        return null;
      }
      setMarketAiSellPreviewFeed(payload);
      setMarketAiSellPreviewSelectedTeamId((current) => {
        const nextTeamId = effectiveTeamId ?? current ?? payload.teams[0]?.teamId ?? null;
        return payload.teams.some((team) => team.teamId === nextTeamId) ? nextTeamId : payload.teams[0]?.teamId ?? null;
      });
      return payload;
    } catch {
      setMarketAiSellPreviewFeed(null);
      setMarketAiSellPreviewError("Auto-Verkaufsideen konnten nicht geladen werden.");
      return null;
    } finally {
      setMarketAiSellPreviewBusy(false);
    }
  }

  async function reloadAiMarketPlanPreview(teamIdOverride?: string | null) {
    try {
      setMarketAiPlanPreviewBusy(true);
      setMarketAiPlanPreviewError(null);
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameStateSeasonId,
        source: readMeta.source,
        teamScope: marketAiPlanTeamScope,
        buyLimit: "90",
        sellLimit: "6",
      });
      const effectiveTeamId = typeof teamIdOverride === "string" ? teamIdOverride : null;
      if (effectiveTeamId) {
        params.set("teamId", effectiveTeamId);
      }
      const response = await fetch(`/api/ai/market-plan-preview?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as FoundationAiMarketPlanPreviewResponse;
      if (!response.ok || payload.error) {
        setMarketAiPlanPreviewFeed(null);
        setMarketAiPlanPreviewError(payload.error ?? "Auto-Marktplan konnte nicht geladen werden.");
        return null;
      }
      setMarketAiPlanPreviewFeed(payload);
      setMarketAiPlanPreviewSelectedTeamId((current) => {
        const nextTeamId = effectiveTeamId ?? current ?? payload.teams[0]?.teamId ?? null;
        return payload.teams.some((team) => team.teamId === nextTeamId) ? nextTeamId : payload.teams[0]?.teamId ?? null;
      });
      return payload;
    } catch {
      setMarketAiPlanPreviewFeed(null);
      setMarketAiPlanPreviewError("Auto-Marktplan konnte nicht geladen werden.");
      return null;
    } finally {
      setMarketAiPlanPreviewBusy(false);
    }
  }

  async function reloadAiNeedsPicksCompare(teamIdOverride?: string | null) {
    try {
      setMarketAiCompareBusy(true);
      setMarketAiCompareError(null);
      const params = new URLSearchParams({
        saveId: activeSaveId,
        seasonId: gameStateSeasonId,
        source: readMeta.source,
        teamScope: marketAiCompareTeamScope,
        steps: "3",
        limit: "90",
      });
      const effectiveTeamId = typeof teamIdOverride === "string" ? teamIdOverride : null;
      if (effectiveTeamId) {
        params.set("teamId", effectiveTeamId);
      }
      const response = await fetch(`/api/ai/needs-picks-compare?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as FoundationAiNeedsPicksCompareResponse;
      if (!response.ok || payload.error) {
        setMarketAiCompareFeed(null);
        setMarketAiCompareError(payload.error ?? "Needs & Picks konnten nicht geladen werden.");
        return null;
      }
      setMarketAiCompareFeed(payload);
      setMarketAiCompareSelectedTeamId((current) => {
        const nextTeamId = effectiveTeamId ?? current ?? payload.teams[0]?.teamId ?? null;
        return payload.teams.some((team) => team.teamId === nextTeamId) ? nextTeamId : payload.teams[0]?.teamId ?? null;
      });
      return payload;
    } catch {
      setMarketAiCompareFeed(null);
      setMarketAiCompareError("Needs & Picks konnten nicht geladen werden.");
      return null;
    } finally {
      setMarketAiCompareBusy(false);
    }
  }

  async function reloadHistoryFeed(signal?: AbortSignal, options?: { append?: boolean; offset?: number }) {
    try {
      const offset = options?.offset ?? (options?.append ? historyFeed?.items.length ?? 0 : 0);
      const isAllSeasonsRequest = historySeasonFilter === HISTORY_ALL_SEASONS_FILTER;
      const requestedSeasonId = isAllSeasonsRequest ? null : historySeasonFilter;
      const params = new URLSearchParams({
        saveId: activeSaveId,
        source: readMeta.source,
        limit: String(TRANSFER_HISTORY_SEASON_LIMIT),
        offset: String(offset),
      });
      if (isAllSeasonsRequest) {
        params.set("allSeasons", "1");
      } else if (requestedSeasonId) {
        params.set("seasonId", requestedSeasonId);
      }
      const response = await fetch(`/api/transfermarkt/history?${params.toString()}`, { cache: "no-store", signal });
      const payload = (await response.json()) as FoundationTransferHistoryResponse;
      if (signal?.aborted) {
        return null;
      }
      if (!response.ok || payload.error) {
        setHistoryFeed(payload);
        return null;
      }
      const nextPayload =
        options?.append && historyFeed
          ? {
              ...payload,
              items: [
                ...historyFeed.items,
                ...payload.items.filter(
                  (item) => !historyFeed.items.some((existing) => existing.transferId === item.transferId),
                ),
              ],
              returned:
                historyFeed.items.length +
                payload.items.filter(
                  (item) => !historyFeed.items.some((existing) => existing.transferId === item.transferId),
                ).length,
            }
          : payload;
      setHistoryFeed(nextPayload);
      return nextPayload;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        return null;
      }
      setHistoryFeed(null);
      return null;
    }
  }

  async function loadMoreHistoryFeed() {
    if (historyLoadingMore || !historyFeed || (historyFeed.total ?? 0) <= (historyFeed.items.length ?? 0)) {
      return;
    }

    historyFeedAbortRef.current?.abort();
    const controller = new AbortController();
    historyFeedAbortRef.current = controller;
    setHistoryLoadingMore(true);
    try {
      await reloadHistoryFeed(controller.signal, {
        append: true,
        offset: historyFeed.items.length,
      });
    } finally {
      setHistoryLoadingMore(false);
      if (historyFeedAbortRef.current === controller) {
        historyFeedAbortRef.current = null;
      }
    }
  }

  async function reloadTransferRecapFeed(signal?: AbortSignal) {
    try {
      const isAllSeasonsRequest = historySeasonFilter === HISTORY_ALL_SEASONS_FILTER;
      const params = new URLSearchParams({
        saveId: activeSaveId,
        source: readMeta.source,
        limit: "5",
      });
      if (!isAllSeasonsRequest && historySeasonFilter) {
        params.set("seasonId", historySeasonFilter);
      }
      const response = await fetch(`/api/transfermarkt/recap?${params.toString()}`, { cache: "no-store", signal });
      const payload = (await response.json()) as FoundationTransferRecapResponse;
      if (signal?.aborted) {
        return null;
      }
      if (!response.ok || payload.error) {
        setTransferRecapFeed(null);
        return null;
      }
      setTransferRecapFeed(payload);
      return payload;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        return null;
      }
      setTransferRecapFeed(null);
      return null;
    }
  }

  async function loadMoreMarketFeed() {
    if (marketLoadingMore || !marketFeed?.hasMore) {
      return;
    }

    marketFeedAbortRef.current?.abort();
    const controller = new AbortController();
    marketFeedAbortRef.current = controller;
    setMarketLoadingMore(true);
    try {
      const payload = await reloadMarketFeed(undefined, controller.signal, {
        append: true,
        offset: marketFeed.items.length,
      });
      if (!payload) {
        return;
      }
      setMarketRenderLimit(payload.items.length);
    } finally {
      setMarketLoadingMore(false);
      if (marketFeedAbortRef.current === controller) {
        marketFeedAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    const shouldLoadMarketFeed = false;
    if (!shouldLoadMarketFeed || isFoundationBootstrapState) {
      marketFeedAbortRef.current?.abort();
      marketFeedAbortRef.current = null;
      return undefined;
    }

    let cancelled = false;
    marketFeedAbortRef.current?.abort();
    const controller = new AbortController();
    marketFeedAbortRef.current = controller;

    async function loadMarketFeed() {
      try {
        const payload = await reloadMarketFeed(undefined, controller.signal);
        if (cancelled || !payload) {
          return;
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          setMarketFeed(null);
        }
      }
    }

    void loadMarketFeed();

    return () => {
      cancelled = true;
      controller.abort();
      if (marketFeedAbortRef.current === controller) {
        marketFeedAbortRef.current = null;
      }
    };
  }, [activeSaveId, activeView, gameStateSeasonId, isFoundationBootstrapState, marketMaxValue, marketReloadToken, marketTeamId, readMeta.source]);

  useEffect(() => {
    if (!shouldLoadTransferHistoryFeed) {
      historyFeedAbortRef.current?.abort();
      historyFeedAbortRef.current = null;
      return undefined;
    }

    let cancelled = false;
    historyFeedAbortRef.current?.abort();
    const controller = new AbortController();
    historyFeedAbortRef.current = controller;

    async function loadHistoryFeed() {
      try {
        const payload = await reloadHistoryFeed(controller.signal);
        if (cancelled || !payload) {
          return;
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          setHistoryFeed(null);
        }
      }
    }

    void loadHistoryFeed();

    return () => {
      cancelled = true;
      controller.abort();
      if (historyFeedAbortRef.current === controller) {
        historyFeedAbortRef.current = null;
      }
    };
  }, [activeSaveId, gameStateSeasonId, historySeasonFilter, marketReloadToken, readMeta.source, shouldLoadTransferHistoryFeed]);

  useEffect(() => {
    if (!shouldLoadTransferRecapFeed) {
      transferRecapAbortRef.current?.abort();
      transferRecapAbortRef.current = null;
      return undefined;
    }

    let cancelled = false;
    transferRecapAbortRef.current?.abort();
    const controller = new AbortController();
    transferRecapAbortRef.current = controller;

    async function loadTransferRecap() {
      try {
        const payload = await reloadTransferRecapFeed(controller.signal);
        if (cancelled || !payload) {
          return;
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        if (!cancelled) {
          setTransferRecapFeed(null);
        }
      }
    }

    void loadTransferRecap();

    return () => {
      cancelled = true;
      controller.abort();
      if (transferRecapAbortRef.current === controller) {
        transferRecapAbortRef.current = null;
      }
    };
  }, [activeSaveId, gameStateSeasonId, marketReloadToken, readMeta.source, seasonOverviewSeasonId, shouldLoadTransferRecapFeed]);

  marketFeedReloadersRef.current = {
    reloadMarketFeed,
    reloadHistoryFeed,
    reloadTransferRecapFeed,
  };

  return {
    reloadMarketFeed,
    reloadAiTransferPreview,
    reloadAiSellPreview,
    reloadAiMarketPlanPreview,
    reloadAiNeedsPicksCompare,
    reloadHistoryFeed,
    loadMoreHistoryFeed,
    reloadTransferRecapFeed,
    loadMoreMarketFeed,
  };
}
