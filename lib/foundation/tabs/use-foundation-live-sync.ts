"use client";

import { useEffect, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import type { FoundationReadMeta, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";
import { isFoundationNavigationQuiet, markFoundationNavigationQuiet } from "@/lib/foundation/navigation-coalescing";
import { shouldRefreshSeasonOverviewOnReload } from "@/lib/foundation/tabs/use-standings-preview-feed";
import { getClientSocket } from "@/lib/socket/client";
import type { OlyRoomState, RoomRealtimeEvent } from "@/types/game";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

type LiveSeasonReloadReason = "manual_apply" | "room_event" | "local_save_version";

export type FoundationSeasonFeedReloaders = {
  reloadSeasonStandingsOverview: (seasonIdOverride?: string) => Promise<unknown>;
  reloadStandingsPreviewFeed: (signal?: AbortSignal) => Promise<unknown>;
  reloadPrizePreviewFeed: () => Promise<unknown>;
  reloadSeasonManagementOverview: () => Promise<unknown>;
  reloadResolvePreview: (signal?: AbortSignal) => Promise<unknown>;
};

export type FoundationMarketFeedReloaders = {
  reloadMarketFeed: (teamIdOverride?: string, signal?: AbortSignal, options?: { append?: boolean; offset?: number }) => Promise<unknown>;
  reloadHistoryFeed: (signal?: AbortSignal, options?: { append?: boolean; offset?: number }) => Promise<unknown>;
  reloadTransferRecapFeed: (signal?: AbortSignal) => Promise<unknown>;
};

export type UseFoundationLiveSyncInput = {
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  activeSaveId: string;
  foundationSaveMode: FoundationSaveMode;
  readMeta: FoundationReadMeta;
  activeView: FoundationView;
  seasonOverviewSeasonId: string;
  setSeasonOverviewSeasonId: Dispatch<SetStateAction<string>>;
  roomContext: unknown;
  roomLiveState: OlyRoomState | null;
  setRoomActivityNotice: Dispatch<
    SetStateAction<{ title: string; detail: string } | null>
  >;
  setSaveSyncError: Dispatch<SetStateAction<string | null>>;
  setFoundationActionFeedback: Dispatch<
    SetStateAction<{ tone: "success" | "warning" | "info" | "blocked" | "error"; title: string; detail: string } | null>
  >;
  setMarketReloadToken: Dispatch<SetStateAction<number>>;
  shouldLoadStandingsPreviewFeed: boolean;
  shouldLoadPrizePreviewFeed: boolean;
  shouldLoadSeasonManagementFeed: boolean;
  loadSave: (
    saveId?: string,
    saveMode?: FoundationSaveMode,
    options?: { compactInitial?: boolean },
  ) => Promise<GameState | null>;
  marketFeedReloadersRef: MutableRefObject<FoundationMarketFeedReloaders>;
  seasonFeedReloadersRef: MutableRefObject<FoundationSeasonFeedReloaders>;
  autoPersistPausedRef: MutableRefObject<boolean>;
  autoPersistUnpauseTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  autoPersistInFlightRef: MutableRefObject<boolean>;
  liveSaveRefreshInFlightRef: MutableRefObject<boolean>;
  liveSaveVersionSignatureRef: MutableRefObject<string | null>;
  foundationViewTransitionUntilRef: MutableRefObject<number>;
  hasLoadedPersistentState: MutableRefObject<boolean>;
};

export function useFoundationLiveSync(input: UseFoundationLiveSyncInput) {
  const [liveSyncStatus, setLiveSyncStatus] = useState<"connected" | "syncing" | "reconnecting" | "disconnected" | "idle">("idle");
  const {
    gameState,
    setGameState,
    activeSaveId,
    foundationSaveMode,
    readMeta,
    activeView,
    seasonOverviewSeasonId,
    setSeasonOverviewSeasonId,
    roomContext,
    roomLiveState,
    setRoomActivityNotice,
    setSaveSyncError,
    setFoundationActionFeedback,
    setMarketReloadToken,
    shouldLoadStandingsPreviewFeed,
    shouldLoadPrizePreviewFeed,
    shouldLoadSeasonManagementFeed,
    loadSave,
    marketFeedReloadersRef,
    seasonFeedReloadersRef,
    autoPersistPausedRef,
    autoPersistUnpauseTimeoutRef,
    autoPersistInFlightRef,
    liveSaveRefreshInFlightRef,
    liveSaveVersionSignatureRef,
    foundationViewTransitionUntilRef,
    hasLoadedPersistentState,
  } = input;

  async function reloadLiveSeasonState(
    reason: LiveSeasonReloadReason = "local_save_version",
    options: { skipGameStateReload?: boolean; reloadFullGameState?: boolean; compactReload?: boolean } = {},
  ): Promise<boolean> {
    if (
      reason === "local_save_version" &&
      isFoundationNavigationQuiet(input.foundationViewTransitionUntilRef)
    ) {
      return false;
    }
    const shouldReloadGameState =
      options.compactReload ||
      options.reloadFullGameState ||
      (options.skipGameStateReload !== true && reason !== "local_save_version");
    const nextGameState = shouldReloadGameState
      ? await loadSave(activeSaveId, foundationSaveMode, {
          compactInitial: options.reloadFullGameState ? false : true,
        })
      : null;
    if (nextGameState) {
      autoPersistPausedRef.current = true;
      setGameState(nextGameState);
      window.setTimeout(() => {
        autoPersistPausedRef.current = false;
      }, 0);
    }
    const nextSeasonId = nextGameState?.season.id ?? gameState.season.id;
    if (nextSeasonId && seasonOverviewSeasonId !== nextSeasonId) {
      setSeasonOverviewSeasonId(nextSeasonId);
    }

    const seasonReloaders = seasonFeedReloadersRef.current;
    const marketReloaders = marketFeedReloadersRef.current;
    const refreshes: Array<Promise<unknown>> = [];
    const shouldRefreshSeasonOverview = shouldRefreshSeasonOverviewOnReload(activeView as FoundationViewId);

    if (shouldRefreshSeasonOverview) {
      refreshes.push(seasonReloaders.reloadSeasonStandingsOverview(nextSeasonId));
    }
    if (shouldLoadStandingsPreviewFeed) {
      refreshes.push(seasonReloaders.reloadStandingsPreviewFeed());
    }
    if (shouldLoadPrizePreviewFeed) {
      refreshes.push(seasonReloaders.reloadPrizePreviewFeed());
    }
    if (shouldLoadSeasonManagementFeed) {
      refreshes.push(seasonReloaders.reloadSeasonManagementOverview());
    }
    if (activeView === "historyV2") {
      refreshes.push(marketReloaders.reloadHistoryFeed(), marketReloaders.reloadTransferRecapFeed());
    }
    if (refreshes.length > 0) {
      await Promise.all(refreshes);
    }
    return true;
  }

  useEffect(() => {
    if (!roomContext) {
      setLiveSyncStatus("idle");
      return undefined;
    }

    const socket = getClientSocket();
    function handleConnect() {
      setLiveSyncStatus("connected");
    }
    function handleDisconnect() {
      setLiveSyncStatus("disconnected");
    }
    function handleReconnectAttempt() {
      setLiveSyncStatus("reconnecting");
    }
    function handleReconnect() {
      setLiveSyncStatus("syncing");
      void reloadLiveSeasonState("room_event", { compactReload: true }).finally(() => {
        setLiveSyncStatus("connected");
      });
    }

    setLiveSyncStatus(socket.connected ? "connected" : "reconnecting");
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect", handleReconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect", handleReconnect);
    };
  }, [roomContext]);

  useEffect(() => {
    if (!roomContext) {
      return undefined;
    }

    const currentRoomContext = roomContext as { participantId: string };
    const socket = getClientSocket();
    function handleRoomGameplayEvent(event: RoomRealtimeEvent) {
      if (event.saveId !== activeSaveId) {
        return;
      }
      const actorParticipantId = typeof event.payload?.participantId === "string" ? event.payload.participantId : null;
      if (actorParticipantId === currentRoomContext.participantId) {
        return;
      }
      const affectedViews = Array.isArray(event.payload?.affectedViews)
        ? event.payload.affectedViews.filter((view): view is string => typeof view === "string")
        : [];
      const actorName =
        roomLiveState?.roomParticipants.find((participant) => participant.participantId === actorParticipantId)?.displayName ??
        "Ein anderer Coach";
      const actionLabel =
        event.type === "matchday_applied"
          ? "Spieltag angewendet"
          : event.type === "lineup_updated"
            ? "Lineup bestätigt"
            : event.type === "transfer_completed"
              ? "Transfer abgeschlossen"
              : "Room-Aktion";
      setRoomActivityNotice({
        title: `${actorName}: ${actionLabel}`,
        detail: affectedViews.length > 0 ? `Betroffene Views: ${affectedViews.join(", ")}` : "Save wurde im Hintergrund synchronisiert.",
      });

      void (async () => {
        const marketReloaders = marketFeedReloadersRef.current;
        await loadSave(activeSaveId);
        if (affectedViews.some((view) => ["market", "team", "contracts"].includes(view))) {
          await Promise.all([
            marketReloaders.reloadMarketFeed(),
            marketReloaders.reloadHistoryFeed(),
            marketReloaders.reloadTransferRecapFeed(),
          ]);
        }
        if (affectedViews.some((view) => ["season", "standings", "matchday", "arena", "lineup"].includes(view))) {
          const seasonReloaders = seasonFeedReloadersRef.current;
          await Promise.all([seasonReloaders.reloadResolvePreview(), reloadLiveSeasonState("room_event")]);
        }
        setMarketReloadToken((current) => current + 1);
      })();
    }

    socket.on("roomGameplayEvent", handleRoomGameplayEvent);
    return () => {
      socket.off("roomGameplayEvent", handleRoomGameplayEvent);
    };
  }, [activeSaveId, roomContext, roomLiveState, readMeta.source]);

  useEffect(() => {
    if (readMeta.source !== "sqlite" || !activeSaveId || !hasLoadedPersistentState.current) {
      return undefined;
    }

    let cancelled = false;
    liveSaveVersionSignatureRef.current = null;

    async function pollLocalSaveVersion() {
      if (cancelled || liveSaveRefreshInFlightRef.current) {
        return;
      }

      // Never let a version-check reload race a local write: `autoPersistPausedRef` is held
      // while a just-applied reload is settling, and `autoPersistInFlightRef` is held for the
      // duration of an outgoing autosave PUT. Skipping here just means the next trigger (the
      // room-poll interval a few seconds later, or the next tab refocus) retries.
      if (autoPersistPausedRef.current || autoPersistInFlightRef.current) {
        return;
      }

      if (Date.now() < foundationViewTransitionUntilRef.current) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      try {
        const params = new URLSearchParams({ saveId: activeSaveId });
        const response = await fetch(`/api/singleplayer-state/version?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { ok?: boolean; signature?: string; contentSignature?: string };
        const nextSignature = payload.contentSignature ?? payload.signature;
        if (!response.ok || !payload.ok || !nextSignature) {
          return;
        }

        const previousSignature = liveSaveVersionSignatureRef.current;
        if (!previousSignature) {
          liveSaveVersionSignatureRef.current = nextSignature;
          return;
        }
        if (previousSignature === nextSignature) {
          return;
        }

        liveSaveRefreshInFlightRef.current = true;
        setLiveSyncStatus("syncing");
        try {
          const reloaded = await reloadLiveSeasonState("local_save_version", { compactReload: true });
          if (!reloaded) {
            return;
          }
          liveSaveVersionSignatureRef.current = nextSignature;
          setSaveSyncError(null);
          if (roomContext) {
            setFoundationActionFeedback({
              tone: "warning",
              title: "Save aktualisiert",
              detail: "Der Spielstand wurde extern geändert und neu geladen.",
            });
          }
        } finally {
          liveSaveRefreshInFlightRef.current = false;
          setLiveSyncStatus(roomContext ? "connected" : "idle");
        }
      } catch {
        liveSaveRefreshInFlightRef.current = false;
        setSaveSyncError("Save-Sync fehlgeschlagen. Bitte Seite neu laden oder kurz warten.");
      }
    }

    void pollLocalSaveVersion();

    // Continuous co-op sync: while a Room is active, keep polling for external changes on an
    // interval instead of relying solely on mount + tab-refocus. This is the only place this
    // hook starts a recurring timer — it is intentionally gated on `roomContext` so solo /
    // no-room saves keep the exact previous behaviour (mount-once + refocus-once, no interval).
    let roomPollIntervalId: ReturnType<typeof setInterval> | null = null;
    function stopRoomPollInterval() {
      if (roomPollIntervalId != null) {
        clearInterval(roomPollIntervalId);
        roomPollIntervalId = null;
      }
    }
    function startRoomPollInterval() {
      if (!roomContext || roomPollIntervalId != null || cancelled) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      roomPollIntervalId = setInterval(() => {
        void pollLocalSaveVersion();
      }, 4000);
    }
    startRoomPollInterval();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pollLocalSaveVersion();
        startRoomPollInterval();
      } else {
        stopRoomPollInterval();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      stopRoomPollInterval();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeSaveId, readMeta.source, roomContext]);

  useEffect(() => {
    markFoundationNavigationQuiet(foundationViewTransitionUntilRef, undefined, {
      autoPersistPausedRef,
      autoPersistUnpauseTimeoutRef,
    });
  }, [activeView, autoPersistPausedRef, autoPersistUnpauseTimeoutRef, foundationViewTransitionUntilRef]);

  return {
    reloadLiveSeasonState,
    liveSyncStatus,
  };
}
