"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import { applyCompactSeasonArchiveSentinelIfNeeded } from "@/lib/foundation/apply-compact-season-archive-sentinel";
import { invalidatePlayerAttributeSheetCache } from "@/lib/foundation/hydrate-player-attribute-sheet";
import { invalidatePlayerProfileSessionCache } from "@/lib/foundation/player-profile-session-cache";
import { invalidateTeamProfileSessionCache } from "@/lib/foundation/team-profile-session-cache";
import {
  buildAutoPersistContentSignature,
  buildFoundationPersistPutBody,
  putFoundationGameState,
} from "@/lib/foundation/tabs/use-foundation-persist";
import {
  normalizeFoundationSaveMode,
  type FoundationSaveMode,
} from "@/lib/persistence/foundation-save-mode";
import type { SaveSummary } from "@/lib/persistence/types";
import { describeRoomWriteError, isStaleSaveVersionError } from "@/lib/room/parse-room-write-context";
import type {
  FoundationReadMeta,
  FoundationReadSource,
  FoundationView,
  SaveActionRequest,
} from "@/lib/foundation/tabs/foundation-page-types";
import { TRANSFER_MARKET_INITIAL_RENDER_LIMIT } from "@/lib/foundation/tabs/foundation-page-types";
import type { ActiveManagerTeamSource } from "@/lib/foundation/tabs/foundation-page-types";
import {
  persistFoundationManagerTeamId,
  persistFoundationSaveMode,
  resolveFoundationTeamId,
  resolvePreferredFoundationTeamContext,
  syncFoundationSaveIdInUrl,
  syncFoundationTeamIdInUrl,
  withNormalizedLocalTeamSettings,
  type syncFoundationViewInUrl,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import type { TrainingClassDraft, TrainingModeDraft } from "@/lib/foundation/tabs/foundation-page-types";
import { foundationFetchWithRetry } from "@/lib/foundation/foundation-fetch-with-retry";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { FoundationPanelId } from "@/lib/foundation/foundation-navigation-history";
import type {
  FacilityUpgradeSummary,
  FoundationAiLineupBatchApplyResponse,
  FoundationAiMarketPlanApplyResponse,
  FoundationAiMarketPlanPreviewResponse,
  FoundationAiNeedsPicksCompareResponse,
  FoundationAiPickAuditResetResponse,
  FoundationAiPreseasonAutomationResponse,
  FoundationAiSellPreviewResponse,
  FoundationAiTransferPreviewResponse,
  FoundationApplySummary,
  FoundationAutoRosterFillResponse,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpScoringResponse,
  FoundationPrizePreviewResponse,
  FoundationResolvePreviewResponse,
  FoundationSeasonManagementResponse,
  FoundationSeasonSnapshotSummary,
  FoundationSeasonStandingsOverviewResponse,
  FoundationSeasonStartResetResponse,
  FoundationStandingsPreviewResponse,
  FoundationTransferHistoryResponse,
  FoundationTransferRecapResponse,
  FoundationTransfermarktResponse,
  FoundationWholeSeasonDryRunSummary,
  PreSeasonWorkflowSummaryResponse,
  SeasonCompletionSummaryResponse,
  SeasonTransitionSummaryResponse,
  TransfermarktBuyPreviewSubject,
  TransfermarktBuyRequestContext,
  TransfermarktBuySummary,
  TransfermarktSellPreviewSubject,
  TransfermarktSellSummary,
} from "@/lib/foundation/tabs/foundation-page-types";

export type FoundationSaveScopedFeedSetters = {
  setMarketFeed: Dispatch<SetStateAction<FoundationTransfermarktResponse | null>>;
  setMarketRenderLimit: Dispatch<SetStateAction<number>>;
  setMarketLoadingMore: Dispatch<SetStateAction<boolean>>;
  setMarketBuyPreview: Dispatch<SetStateAction<TransfermarktBuySummary | null>>;
  setMarketBuyPreviewContext: Dispatch<SetStateAction<TransfermarktBuyRequestContext | null>>;
  setMarketBuyError: Dispatch<SetStateAction<string | null>>;
  setMarketBuySuccess: Dispatch<SetStateAction<string | null>>;
  setMarketBuySubject: Dispatch<SetStateAction<TransfermarktBuyPreviewSubject | null>>;
  setFoundationPanel: Dispatch<SetStateAction<FoundationPanelId>>;
  setMarketSellPreview: Dispatch<SetStateAction<TransfermarktSellSummary | null>>;
  setMarketSellError: Dispatch<SetStateAction<string | null>>;
  setMarketSellSuccess: Dispatch<SetStateAction<string | null>>;
  setMarketSellSubject: Dispatch<SetStateAction<TransfermarktSellPreviewSubject | null>>;
  setMarketSellRiskAcknowledged: Dispatch<SetStateAction<boolean>>;
  setMarketAiPreviewFeed: Dispatch<SetStateAction<FoundationAiTransferPreviewResponse | null>>;
  setMarketAiSellPreviewFeed: Dispatch<SetStateAction<FoundationAiSellPreviewResponse | null>>;
  setMarketAiPlanPreviewFeed: Dispatch<SetStateAction<FoundationAiMarketPlanPreviewResponse | null>>;
  setMarketAiCompareFeed: Dispatch<SetStateAction<FoundationAiNeedsPicksCompareResponse | null>>;
  setMarketAiApplyFeed: Dispatch<SetStateAction<FoundationAiMarketPlanApplyResponse | null>>;
  setRosterFillFeed: Dispatch<SetStateAction<FoundationAutoRosterFillResponse | null>>;
  setAiPreseasonFeed: Dispatch<SetStateAction<FoundationAiPreseasonAutomationResponse | null>>;
  setAiPreseasonBusy: Dispatch<SetStateAction<boolean>>;
  setAiPickAuditFeed: Dispatch<SetStateAction<FoundationAiPickAuditResetResponse | null>>;
  setSeasonStartResetFeed: Dispatch<SetStateAction<FoundationSeasonStartResetResponse | null>>;
  setHistoryFeed: Dispatch<SetStateAction<FoundationTransferHistoryResponse | null>>;
  setHistorySeasonFilter: Dispatch<SetStateAction<string>>;
  setTransferRecapFeed: Dispatch<SetStateAction<FoundationTransferRecapResponse | null>>;
  setResolvePreviewFeed: Dispatch<SetStateAction<FoundationResolvePreviewResponse | null>>;
  setCockpitAiBatchApplyFeed: Dispatch<SetStateAction<FoundationAiLineupBatchApplyResponse | null>>;
  setMatchdayMvpScoringFeed: Dispatch<SetStateAction<FoundationMatchdayMvpScoringResponse | null>>;
  setResultApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setStandingsPreviewFeed: Dispatch<SetStateAction<FoundationStandingsPreviewResponse | null>>;
  setStandingsApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setSeasonManagementFeed: Dispatch<SetStateAction<FoundationSeasonManagementResponse | null>>;
  setFacilityUpgradePreview: Dispatch<SetStateAction<FacilityUpgradeSummary | null>>;
  setFacilityUpgradeError: Dispatch<SetStateAction<string | null>>;
  setFacilityUpgradeSuccess: Dispatch<SetStateAction<string | null>>;
  setPreSeasonWorkflowFeed: Dispatch<SetStateAction<PreSeasonWorkflowSummaryResponse | null>>;
  setPreSeasonWorkflowError: Dispatch<SetStateAction<string | null>>;
  setSeasonTransitionFeed: Dispatch<SetStateAction<SeasonTransitionSummaryResponse | null>>;
  setSeasonCompletionFeed: Dispatch<SetStateAction<SeasonCompletionSummaryResponse | null>>;
  setSeasonTransitionError: Dispatch<SetStateAction<string | null>>;
  setSeasonStandingsFeed: Dispatch<SetStateAction<FoundationSeasonStandingsOverviewResponse | null>>;
  setSeasonOverviewSeasonId: Dispatch<SetStateAction<string>>;
  setPrizePreviewFeed: Dispatch<SetStateAction<FoundationPrizePreviewResponse | null>>;
  setCashApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setMatchdayAdvanceFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setMatchdayAutoRunFeed: Dispatch<SetStateAction<FoundationMatchdayAutoRunSummary | null>>;
  setWholeSeasonDryRunFeed: Dispatch<SetStateAction<FoundationWholeSeasonDryRunSummary | null>>;
  setSeasonSnapshotFeed: Dispatch<SetStateAction<FoundationSeasonSnapshotSummary | null>>;
  setPlayerProfileData: Dispatch<SetStateAction<PlayerDetailDrawerData | null>>;
  setTeamProfileTeamId: Dispatch<SetStateAction<string | null>>;
  setFoundationActionFeedback: Dispatch<
    SetStateAction<{ tone: "warning" | "success" | "info" | "blocked" | "error"; title: string; detail: string } | null>
  >;
};

export type UseFoundationPersistenceActionsInput = {
  initialPersistedSave?: { gameState?: GameState } | null;
  initialSaveId?: string | null;
  initialReadSource?: FoundationReadSource | null;
  initialSelectedTeamId?: string | null;
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  gameStateRef: MutableRefObject<GameState>;
  activeSaveId: string;
  setActiveSaveId: Dispatch<SetStateAction<string>>;
  setActiveSaveName: Dispatch<SetStateAction<string>>;
  foundationSaveMode: FoundationSaveMode;
  setFoundationSaveMode: Dispatch<SetStateAction<FoundationSaveMode>>;
  setSaveSummaries: Dispatch<SetStateAction<SaveSummary[]>>;
  readMeta: FoundationReadMeta;
  setReadMeta: Dispatch<SetStateAction<FoundationReadMeta>>;
  selectedTeamId: string;
  setSelectedTeamId: Dispatch<SetStateAction<string>>;
  activeManagerTeamSource: ActiveManagerTeamSource;
  setActiveManagerTeamSource: Dispatch<SetStateAction<ActiveManagerTeamSource>>;
  setActiveManagerTeamWarning: Dispatch<SetStateAction<string | null>>;
  setMarketTeamId: Dispatch<SetStateAction<string>>;
  setIsSaveBusy: Dispatch<SetStateAction<boolean>>;
  setPersistenceError: Dispatch<SetStateAction<string | null>>;
  setBootstrapError: Dispatch<SetStateAction<string | null>>;
  setTrainingModeDraft: Dispatch<SetStateAction<Record<string, TrainingModeDraft>>>;
  setTrainingClassDraft: Dispatch<SetStateAction<Record<string, TrainingClassDraft>>>;
  setActiveView: Dispatch<SetStateAction<FoundationView>>;
  setSeasonOverviewSeasonId: Dispatch<SetStateAction<string>>;
  roomContext: unknown;
  feedSetters: FoundationSaveScopedFeedSetters;
  onSaveConflictReload: (reloaded: GameState) => Promise<void>;
  showReadOnlyNotice: () => void;
  syncFoundationViewInUrl: typeof syncFoundationViewInUrl;
  setFreshSeasonStartMessage: Dispatch<SetStateAction<string | null>>;
  onFetchSlow?: () => void;
  onFetchSlowClear?: () => void;
};

export function useFoundationPersistenceActions(input: UseFoundationPersistenceActionsInput) {
  const {
    initialPersistedSave,
    initialSaveId,
    initialReadSource,
    initialSelectedTeamId,
    gameState,
    setGameState,
    gameStateRef,
    activeSaveId,
    setActiveSaveId,
    setActiveSaveName,
    foundationSaveMode,
    setFoundationSaveMode,
    setSaveSummaries,
    readMeta,
    setReadMeta,
    selectedTeamId,
    setSelectedTeamId,
    activeManagerTeamSource,
    setActiveManagerTeamSource,
    setActiveManagerTeamWarning,
    setMarketTeamId,
    setIsSaveBusy,
    setPersistenceError,
    setBootstrapError,
    setTrainingModeDraft,
    setTrainingClassDraft,
    setActiveView,
    setSeasonOverviewSeasonId,
    roomContext,
    feedSetters,
    onSaveConflictReload,
    showReadOnlyNotice,
    syncFoundationViewInUrl,
    setFreshSeasonStartMessage,
    onFetchSlow,
    onFetchSlowClear,
  } = input;

  const fetchRetryOptions = useMemo(
    () => ({
      onSlow: onFetchSlow,
    }),
    [onFetchSlow],
  );

  const hasPersistedInitialState = useRef(false);
  const hasLoadedPersistentState = useRef(Boolean(initialPersistedSave));
  const skipInitialClientBootstrapRef = useRef(Boolean(initialPersistedSave?.gameState));
  const loadSaveRequestVersion = useRef(0);
  const saveActionRequestVersion = useRef(0);
  const skipNextFullPersistCountRef = useRef(0);
  const liveSaveVersionSignatureRef = useRef<string | null>(null);
  const liveSaveRefreshInFlightRef = useRef(false);
  const autoPersistPausedRef = useRef(false);
  const autoPersistUnpauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPersistTimerRef = useRef<number | null>(null);
  const autoPersistInFlightRef = useRef(false);
  const autoPersistContentSignatureRef = useRef<string | null>(null);
  const foundationViewTransitionUntilRef = useRef(0);
  const persistRequestVersionRef = useRef(0);
  const persistSnapshotRef = useRef<{ requestVersion: number; snapshot: GameState } | null>(null);
  const loadedWithCompactInitialRef = useRef(true);
  // Serialisiert ALLE lokalen Save-PUTs (Sofort-Persist + Auto-Save), damit
  // zwei schnelle Schreibaktionen sich nicht selbst einen 409-Konflikt bauen
  // (die zweite würde sonst mit veralteter saveVersion abschicken, bevor die
  // erste die Version hochgezählt hat). `lastKnownSaveVersionRef` hält die
  // zuletzt vom Server bestätigte Version synchron vor, sodass ein in der
  // Queue wartender Write seine expectedSaveVersion auf den frischen Stand
  // heben kann. Ein echter Fremdkonflikt (Version steigt serverseitig, ohne
  // dass wir das über einen Load erfahren) führt weiterhin zu 409 + Reload.
  const saveWriteChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastKnownSaveVersionRef = useRef(0);

  const feedSettersRef = useRef(feedSetters);
  feedSettersRef.current = feedSetters;
  const onSaveConflictReloadRef = useRef(onSaveConflictReload);
  onSaveConflictReloadRef.current = onSaveConflictReload;

  const clearSaveScopedFeeds = useCallback(() => {
    const setters = feedSettersRef.current;
    setters.setMarketFeed(null);
    setters.setMarketRenderLimit(TRANSFER_MARKET_INITIAL_RENDER_LIMIT);
    setters.setMarketLoadingMore(false);
    setters.setMarketBuyPreview(null);
    setters.setMarketBuyPreviewContext(null);
    setters.setMarketBuyError(null);
    setters.setMarketBuySuccess(null);
    setters.setMarketBuySubject(null);
    setters.setFoundationPanel(null);
    setters.setMarketSellPreview(null);
    setters.setMarketSellError(null);
    setters.setMarketSellSuccess(null);
    setters.setMarketSellSubject(null);
    setters.setMarketSellRiskAcknowledged(false);
    setters.setMarketAiPreviewFeed(null);
    setters.setMarketAiSellPreviewFeed(null);
    setters.setMarketAiPlanPreviewFeed(null);
    setters.setMarketAiCompareFeed(null);
    setters.setMarketAiApplyFeed(null);
    setters.setRosterFillFeed(null);
    setters.setAiPreseasonFeed(null);
    setters.setAiPreseasonBusy(false);
    setters.setAiPickAuditFeed(null);
    setters.setSeasonStartResetFeed(null);
    setters.setHistoryFeed(null);
    setters.setHistorySeasonFilter(gameState.season.id);
    setters.setTransferRecapFeed(null);
    setters.setResolvePreviewFeed(null);
    setters.setCockpitAiBatchApplyFeed(null);
    setters.setMatchdayMvpScoringFeed(null);
    setters.setResultApplyFeed(null);
    setters.setStandingsPreviewFeed(null);
    setters.setStandingsApplyFeed(null);
    setters.setSeasonManagementFeed(null);
    setters.setFacilityUpgradePreview(null);
    setters.setFacilityUpgradeError(null);
    setters.setFacilityUpgradeSuccess(null);
    setters.setPreSeasonWorkflowFeed(null);
    setters.setPreSeasonWorkflowError(null);
    setters.setSeasonTransitionFeed(null);
    setters.setSeasonCompletionFeed(null);
    setters.setSeasonTransitionError(null);
    setters.setSeasonStandingsFeed(null);
    setters.setSeasonOverviewSeasonId(gameState.season.id);
    setters.setPrizePreviewFeed(null);
    setters.setCashApplyFeed(null);
    setters.setMatchdayAdvanceFeed(null);
    setters.setMatchdayAutoRunFeed(null);
    setters.setWholeSeasonDryRunFeed(null);
    setters.setSeasonSnapshotFeed(null);
    setters.setPlayerProfileData(null);
    setters.setTeamProfileTeamId(null);
    setters.setFoundationActionFeedback(null);
  }, [gameState.season.id, setSeasonOverviewSeasonId]);

  function buildStateApiPath(
    saveId?: string,
    saveMode: FoundationSaveMode = foundationSaveMode,
    options?: { compactInitial?: boolean },
  ) {
    const params = new URLSearchParams();
    if (saveId) {
      params.set("saveId", saveId);
    }
    if (saveMode !== "all") {
      params.set("saveMode", saveMode);
    }
    if (initialReadSource) {
      params.set("source", initialReadSource);
    }
    if (options?.compactInitial) {
      params.set("compact", "foundation-initial");
    }

    const query = params.toString();
    return `/api/singleplayer-state${query ? `?${query}` : ""}`;
  }

  function resetOptimisticDraftsAfterSaveConflictReload() {
    setTrainingModeDraft({});
    setTrainingClassDraft({});
  }

  async function applySaveConflictReload(reloaded: GameState) {
    autoPersistPausedRef.current = true;
    autoPersistContentSignatureRef.current = buildAutoPersistContentSignature(reloaded);
    setGameState(reloaded);
    resetOptimisticDraftsAfterSaveConflictReload();
    await onSaveConflictReloadRef.current(reloaded);
    window.setTimeout(() => {
      autoPersistPausedRef.current = false;
    }, 0);
  }

  async function loadSave(
    saveId?: string,
    saveMode: FoundationSaveMode = foundationSaveMode,
    options: { compactInitial?: boolean } = { compactInitial: true },
  ) {
      const requestVersion = loadSaveRequestVersion.current + 1;
      loadSaveRequestVersion.current = requestVersion;

      if (saveId && saveId !== activeSaveId) {
        clearSaveScopedFeeds();
        if (activeSaveId && activeSaveId !== "loading-save") {
          invalidatePlayerProfileSessionCache({ saveId: activeSaveId });
          invalidateTeamProfileSessionCache({ saveId: activeSaveId });
          invalidatePlayerAttributeSheetCache({ saveId: activeSaveId });
        }
      }

      try {
        const fetchResult = await foundationFetchWithRetry<{
          save?: { saveId: string; name?: string; gameState: GameState };
          saves?: SaveSummary[];
          _meta?: FoundationReadMeta;
        }>(buildStateApiPath(saveId, saveMode, { compactInitial: options.compactInitial ?? true }), {}, fetchRetryOptions);
        if (!fetchResult.ok) {
          console.warn("Save konnte gerade nicht geladen werden.", fetchResult.error, fetchResult.cause);
          // Nur melden, wenn tatsächlich ein ANDERER Save geladen werden sollte
          // oder noch gar kein Stand geladen wurde. Ein transienter Re-Load des
          // bereits aktiven Saves (dev slow-compile/timeout) soll die Meldung
          // nicht dauerhaft stehen lassen, obwohl der Stand angezeigt wird.
          if ((saveId && saveId !== activeSaveId) || !hasLoadedPersistentState.current) {
            setPersistenceError("Der Spielstand konnte nicht geladen werden.");
          }
          return null;
        }
        const payload = fetchResult.data;

        if (!payload.save?.gameState) {
          // Nur melden, wenn tatsächlich ein ANDERER Save geladen werden sollte
          // oder noch gar kein Stand geladen wurde. Ein transienter Re-Load des
          // bereits aktiven Saves (dev slow-compile/timeout) soll die Meldung
          // nicht dauerhaft stehen lassen, obwohl der Stand angezeigt wird.
          if ((saveId && saveId !== activeSaveId) || !hasLoadedPersistentState.current) {
            setPersistenceError("Der Spielstand konnte nicht geladen werden.");
          }
          return null;
        }

        const normalizedGameState =
          payload._meta?.source === "prisma" ? payload.save.gameState : withNormalizedLocalTeamSettings(payload.save.gameState);
        const sponsorOffersBefore = JSON.stringify(normalizedGameState.seasonState.sponsorOffersByTeamId ?? {});
        const nextGameState = applyCompactSeasonArchiveSentinelIfNeeded(refreshTeamObjectiveState(normalizedGameState), options);
        const sponsorOffersHydrated = sponsorOffersBefore !== JSON.stringify(nextGameState.seasonState.sponsorOffersByTeamId ?? {});

        if (requestVersion !== loadSaveRequestVersion.current) {
          return null;
        }

        hasPersistedInitialState.current = false;
        hasLoadedPersistentState.current = true;
        loadedWithCompactInitialRef.current = options.compactInitial ?? true;
        autoPersistContentSignatureRef.current = buildAutoPersistContentSignature(nextGameState);
        setGameState(nextGameState);
        noteKnownSaveVersion(nextGameState.saveVersion);
        setPersistenceError(null);
        // Ein erfolgreicher Load räumt AUCH einen evtl. hängengebliebenen
        // Bootstrap-Fehler weg (beide Pfade setzen sonst nur ihren eigenen
        // State → sonst blieb "konnte nicht geladen werden" stehen, obwohl der
        // Spielstand längst geladen ist).
        setBootstrapError(null);
        onFetchSlowClear?.();
        if (
          sponsorOffersHydrated &&
          payload._meta?.source !== "prisma" &&
          !payload._meta?.readOnly &&
          payload.save.saveId
        ) {
          void persistLocalGameStateImmediately(nextGameState).catch((error) => {
            console.warn("Sponsor-Hydration konnte nicht persistiert werden.", error);
          });
        }
        if (payload.save.saveId !== activeSaveId) {
          invalidatePlayerProfileSessionCache({ saveId: payload.save.saveId });
          invalidateTeamProfileSessionCache({ saveId: payload.save.saveId });
          invalidatePlayerAttributeSheetCache({ saveId: payload.save.saveId });
          setSeasonOverviewSeasonId(nextGameState.season.id);
        }
        setActiveSaveId(payload.save.saveId);
        setActiveSaveName(payload.save.name ?? "Oly Save");
        setSaveSummaries(payload.saves ?? []);
        if (payload._meta?.saveMode) {
          setFoundationSaveMode(normalizeFoundationSaveMode(payload._meta.saveMode));
        }
        if (payload._meta) {
          setReadMeta(payload._meta);
        }
        const saveTeamSettingsMap = buildTeamControlSettingsMap(nextGameState.teams, nextGameState.seasonState.teamControlSettings);
        const saveSelectedTeamId = resolveFoundationTeamId(nextGameState.teams, nextGameState.seasonState.newGameFlow?.selectedTeamId);
        const saveHasOwnedTeam = nextGameState.teams.some((team) => saveTeamSettingsMap[team.teamId]?.controlMode === "manual");
        const saveSelectionIsOwned =
          saveSelectedTeamId != null && saveTeamSettingsMap[saveSelectedTeamId]?.controlMode === "manual";
        // Honor the save's own picked team directly only when it is actually a
        // human-controlled team (or the save has no owned team at all). Otherwise a
        // stale/AI newGameFlow.selectedTeamId would bypass the owned-team guard in
        // resolvePreferredFoundationTeamContext and reopen the save on a club the
        // player cannot manage.
        const nextTeamContext =
          saveSelectedTeamId && (saveSelectionIsOwned || !saveHasOwnedTeam)
            ? { teamId: saveSelectedTeamId, source: "saved_preference" as const, warning: null }
            : resolvePreferredFoundationTeamContext(nextGameState.teams, {
                currentTeamId: selectedTeamId,
                currentSource: activeManagerTeamSource,
                initialTeamId: initialSelectedTeamId,
                savedTeamId: nextGameState.seasonState.newGameFlow?.selectedTeamId ?? null,
                activeSaveId: payload.save.saveId,
                settingsMap: saveTeamSettingsMap,
              });
        setSelectedTeamId(nextTeamContext.teamId);
        setActiveManagerTeamSource(nextTeamContext.source);
        setActiveManagerTeamWarning(nextTeamContext.warning ?? null);
        if (nextTeamContext.teamId) {
          setMarketTeamId(nextTeamContext.teamId);
          persistFoundationManagerTeamId(nextTeamContext.teamId, payload.save.saveId, nextTeamContext.source);
        }

        if (payload._meta?.source !== "prisma" && payload.save.saveId) {
          void fetch(`/api/season/warmup-derivations?saveId=${encodeURIComponent(payload.save.saveId)}`, {
            method: "POST",
          }).catch(() => null);
        }

        return nextGameState;
      } catch (error) {
        console.warn("Save konnte gerade nicht geladen werden.", error);
        if ((saveId && saveId !== activeSaveId) || !hasLoadedPersistentState.current) {
          setPersistenceError("Der Spielstand konnte nicht geladen werden.");
        }
        return null;
      }
  }

  // Merkt sich die zuletzt server-bestätigte saveVersion (nur aus eigenen
  // erfolgreichen Writes und aus Loads — nicht künstlich hochzählen, sonst
  // würden echte Fremdkonflikte verschluckt).
  function noteKnownSaveVersion(version: number | null | undefined) {
    if (typeof version === "number" && version > lastKnownSaveVersionRef.current) {
      lastKnownSaveVersionRef.current = version;
    }
  }

  // Hebt die expectedSaveVersion eines wartenden Writes auf den zuletzt
  // bekannten Stand — der Inhalt (kumulativer React-State) bleibt gültig.
  function withFreshSaveVersion(snapshot: GameState): GameState {
    const fresh = Math.max(snapshot.saveVersion ?? 0, lastKnownSaveVersionRef.current);
    return (snapshot.saveVersion ?? 0) === fresh ? snapshot : { ...snapshot, saveVersion: fresh };
  }

  // Serialisiert einen Save-Write hinter allen bereits laufenden/wartenden.
  function enqueueSaveWrite<T>(task: () => Promise<T>): Promise<T> {
    const result = saveWriteChainRef.current.then(task, task);
    saveWriteChainRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function persistLocalGameStateImmediately(
    nextGameState: GameState,
    options?: { materializeSeasonDerivations?: boolean },
  ): Promise<GameState> {
    const requestVersion = ++persistRequestVersionRef.current;
    persistSnapshotRef.current = { requestVersion, snapshot: nextGameState };

    return enqueueSaveWrite(() => persistLocalGameStateImmediatelyInner(nextGameState, requestVersion, options));
  }

  async function persistLocalGameStateImmediatelyInner(
    nextGameState: GameState,
    requestVersion: number,
    options?: { materializeSeasonDerivations?: boolean },
  ): Promise<GameState> {
    const response = await putFoundationGameState(
      buildFoundationPersistPutBody({
        saveId: activeSaveId,
        gameState: withFreshSaveVersion(nextGameState),
        compactPut: loadedWithCompactInitialRef.current,
        materializeSeasonDerivations: options?.materializeSeasonDerivations,
      }),
      fetchRetryOptions,
    );

    if (response.status === 409) {
      setPersistenceError("Save-Konflikt erkannt. Stand wird neu geladen.");
      const reloaded = await loadSave(activeSaveId, foundationSaveMode, { compactInitial: true });
      if (reloaded) {
        await applySaveConflictReload(reloaded);
      }
      throw new Error("Save-Konflikt erkannt. Stand wird neu geladen.");
    }

    if (!response.ok) {
      throw new Error("Lokaler Save konnte nicht aktualisiert werden.");
    }

    const payload = (await response.json()) as {
      save?: { saveId: string; name?: string; saveVersion?: number };
      saves?: SaveSummary[];
    };
    if (payload.save?.name) {
      setActiveSaveName(payload.save.name);
    }
    if (payload.saves) {
      setSaveSummaries(payload.saves);
    }
    if (payload.save?.saveVersion != null) {
      onFetchSlowClear?.();
      const newSaveVersion = payload.save.saveVersion;
      noteKnownSaveVersion(newSaveVersion);
      autoPersistContentSignatureRef.current = buildAutoPersistContentSignature({
        ...nextGameState,
        saveVersion: newSaveVersion,
      });
      setGameState((current) => {
        if (requestVersion !== persistRequestVersionRef.current) {
          return current;
        }
        const pendingPersist = persistSnapshotRef.current;
        if (!pendingPersist || pendingPersist.requestVersion !== requestVersion) {
          return current;
        }
        if (current !== pendingPersist.snapshot) {
          return current;
        }
        if (current.saveVersion === newSaveVersion) {
          return current;
        }
        return {
          ...current,
          saveVersion: newSaveVersion,
        };
      });
    }
    return payload.save?.saveVersion != null
      ? {
          ...nextGameState,
          saveVersion: payload.save.saveVersion,
        }
      : nextGameState;
  }

  async function handleStaleRoomSaveWrite(payload: unknown) {
    if (!roomContext || !isStaleSaveVersionError(payload)) {
      return false;
    }
    feedSettersRef.current.setFoundationActionFeedback({
      tone: "warning",
      title: "Save veraltet",
      detail: describeRoomWriteError(payload) ?? "Save wird neu geladen.",
    });
    await loadSave(activeSaveId);
    return true;
  }

  const runSaveAction = useCallback(
    async (body: SaveActionRequest) => {
      if (readMeta.readOnly) {
        showReadOnlyNotice();
        return;
      }

      setIsSaveBusy(true);
      const requestVersion = saveActionRequestVersion.current + 1;
      saveActionRequestVersion.current = requestVersion;
      if (body.action === "activate" || body.action === "clone" || body.action === "snapshot" || body.action === "fresh-season-1") {
        clearSaveScopedFeeds();
      }

      try {
        const response = await foundationFetchWithRetry<{
          save?: { saveId: string };
          saves?: SaveSummary[];
        }>(buildStateApiPath(undefined, foundationSaveMode), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }, fetchRetryOptions);

        if (!response.ok) {
          setPersistenceError("Save-Aktion fehlgeschlagen. Bitte erneut versuchen.");
          return;
        }

        const payload = response.data;

        setSaveSummaries(payload.saves ?? []);

        if (payload.save?.saveId) {
          onFetchSlowClear?.();
          if (requestVersion !== saveActionRequestVersion.current) {
            return;
          }
          await loadSave(payload.save.saveId);
          if (requestVersion !== saveActionRequestVersion.current) {
            return;
          }
          // Pin the save this action just switched us to into the URL so a
          // reload / new tab deterministically loads it instead of falling
          // back to the global active save row.
          syncFoundationSaveIdInUrl(payload.save.saveId);
          if (body.action === "fresh-season-1") {
            setActiveView("season");
            syncFoundationViewInUrl("season");
            setFreshSeasonStartMessage("Neuer lokaler Season-1-Testspielstand aktiv. Saisonstand ist bereit.");
          }
        }
      } finally {
        if (requestVersion === saveActionRequestVersion.current) {
          setIsSaveBusy(false);
        }
      }
    },
    [
      clearSaveScopedFeeds,
      foundationSaveMode,
      readMeta.readOnly,
      setActiveView,
      setFreshSeasonStartMessage,
      setIsSaveBusy,
      setSaveSummaries,
      showReadOnlyNotice,
      syncFoundationViewInUrl,
    ],
  );

  const changeFoundationSaveMode = useCallback(
    (nextSaveMode: FoundationSaveMode) => {
      setFoundationSaveMode(nextSaveMode);
      clearSaveScopedFeeds();
      void loadSave(undefined, nextSaveMode);
    },
    [clearSaveScopedFeeds, loadSave, setFoundationSaveMode],
  );

  useEffect(() => {
    persistFoundationSaveMode(foundationSaveMode);
  }, [foundationSaveMode]);

  useEffect(() => {
    if (
      skipInitialClientBootstrapRef.current &&
      gameStateRef.current.season.id !== "loading" &&
      (!initialSaveId || initialSaveId === activeSaveId)
    ) {
      skipInitialClientBootstrapRef.current = false;
      return undefined;
    }

    let cancelled = false;

    async function loadPersistentState() {
      const fetchResult = await foundationFetchWithRetry<{
        save?: { saveId: string; name?: string; gameState: GameState };
        saves?: SaveSummary[];
        _meta?: FoundationReadMeta;
      }>(buildStateApiPath(initialSaveId ?? undefined, foundationSaveMode, { compactInitial: true }), {}, fetchRetryOptions);

      if (cancelled) {
        return;
      }

      if (!fetchResult.ok) {
        console.warn("Initialer Spielstand konnte gerade nicht geladen werden.", fetchResult.error, fetchResult.cause);
        setBootstrapError("Der Spielstand konnte nicht geladen werden.");
        return;
      }

      const payload = fetchResult.data;
      if (!payload.save?.gameState) {
        setBootstrapError("Der Spielstand konnte nicht geladen werden.");
        return;
      }

      setBootstrapError(null);
      setPersistenceError(null);
      onFetchSlowClear?.();

      const nextGameState = applyCompactSeasonArchiveSentinelIfNeeded(
        payload._meta?.source === "prisma" ? payload.save.gameState : withNormalizedLocalTeamSettings(payload.save.gameState),
        { compactInitial: true },
      );

      hasPersistedInitialState.current = false;
      hasLoadedPersistentState.current = true;
      autoPersistContentSignatureRef.current = buildAutoPersistContentSignature(nextGameState);
      setGameState(nextGameState);
      noteKnownSaveVersion(nextGameState.saveVersion);
      setActiveSaveId(payload.save.saveId);
      setActiveSaveName(payload.save.name ?? "Oly Save");
      setSaveSummaries(payload.saves ?? []);
      if (payload._meta?.saveMode) {
        setFoundationSaveMode(normalizeFoundationSaveMode(payload._meta.saveMode));
      }
      if (payload._meta) {
        setReadMeta(payload._meta);
      }
      const saveTeamSettingsMap = buildTeamControlSettingsMap(nextGameState.teams, nextGameState.seasonState.teamControlSettings);
      const saveSelectedTeamId = resolveFoundationTeamId(nextGameState.teams, nextGameState.seasonState.newGameFlow?.selectedTeamId);
      const saveHasOwnedTeam = nextGameState.teams.some((team) => saveTeamSettingsMap[team.teamId]?.controlMode === "manual");
      const saveSelectionIsOwned =
        saveSelectedTeamId != null && saveTeamSettingsMap[saveSelectedTeamId]?.controlMode === "manual";
      // Honor the save's own picked team directly only when it is actually a
      // human-controlled team (or the save has no owned team at all). Otherwise a
      // stale/AI newGameFlow.selectedTeamId would bypass the owned-team guard in
      // resolvePreferredFoundationTeamContext and reopen the save on a club the
      // player cannot manage.
      const nextTeamContext =
        saveSelectedTeamId && (saveSelectionIsOwned || !saveHasOwnedTeam)
          ? { teamId: saveSelectedTeamId, source: "saved_preference" as const, warning: null }
          : resolvePreferredFoundationTeamContext(nextGameState.teams, {
              currentTeamId: selectedTeamId,
              currentSource: activeManagerTeamSource,
              initialTeamId: initialSelectedTeamId,
              savedTeamId: nextGameState.seasonState.newGameFlow?.selectedTeamId ?? null,
              activeSaveId: payload.save.saveId,
              settingsMap: saveTeamSettingsMap,
            });
      setSelectedTeamId(nextTeamContext.teamId);
      setActiveManagerTeamSource(nextTeamContext.source);
      setActiveManagerTeamWarning(nextTeamContext.warning ?? null);
      if (nextTeamContext.teamId && nextTeamContext.teamId !== "loading-team") {
        setMarketTeamId(nextTeamContext.teamId);
        persistFoundationManagerTeamId(nextTeamContext.teamId, payload.save.saveId, nextTeamContext.source);
        syncFoundationTeamIdInUrl(nextTeamContext.teamId);
      }
    }

    void loadPersistentState();

    return () => {
      cancelled = true;
    };
  }, [foundationSaveMode, initialSaveId]);

  useEffect(() => {
    if (!hasLoadedPersistentState.current) {
      return;
    }

    if (readMeta.readOnly) {
      return;
    }

    if (!hasPersistedInitialState.current) {
      hasPersistedInitialState.current = true;
      autoPersistContentSignatureRef.current = buildAutoPersistContentSignature(gameState);
      return;
    }

    const nextPersistSignature = buildAutoPersistContentSignature(gameState);
    if (autoPersistContentSignatureRef.current === nextPersistSignature) {
      return;
    }

    if (skipNextFullPersistCountRef.current > 0) {
      skipNextFullPersistCountRef.current -= 1;
      return;
    }

    if (autoPersistPausedRef.current || liveSaveRefreshInFlightRef.current) {
      return;
    }

    if (Date.now() < foundationViewTransitionUntilRef.current) {
      return;
    }

    if (autoPersistTimerRef.current != null) {
      window.clearTimeout(autoPersistTimerRef.current);
    }

    autoPersistTimerRef.current = window.setTimeout(() => {
      autoPersistTimerRef.current = null;
      if (autoPersistPausedRef.current || liveSaveRefreshInFlightRef.current || autoPersistInFlightRef.current) {
        return;
      }

      if (Date.now() < foundationViewTransitionUntilRef.current) {
        return;
      }

      const snapshot = gameStateRef.current;
      const persistSignature = buildAutoPersistContentSignature(snapshot);
      if (autoPersistContentSignatureRef.current === persistSignature) {
        return;
      }

      autoPersistInFlightRef.current = true;
      // Das GANZE Response-Handling (inkl. json() + noteKnownSaveVersion + der
      // 409-Reload) läuft INNERHALB der Queue-Task — sonst könnte ein danach
      // eingereihter Write sein withFreshSaveVersion berechnen, bevor diese
      // Version notiert ist, und sich erneut selbst einen 409 bauen.
      void enqueueSaveWrite(async () => {
        const response = await putFoundationGameState(
          buildFoundationPersistPutBody({
            saveId: activeSaveId,
            gameState: withFreshSaveVersion(snapshot),
            compactPut: loadedWithCompactInitialRef.current,
          }),
        );
        if (response.status === 409) {
          setPersistenceError("Save-Konflikt erkannt. Stand wird neu geladen.");
          const reloaded = await loadSave(activeSaveId, foundationSaveMode, { compactInitial: true });
          if (reloaded) {
            await applySaveConflictReload(reloaded);
          }
          return null;
        }
        if (!response.ok) {
          setPersistenceError("Auto-Save fehlgeschlagen.");
          return null;
        }
        setPersistenceError(null);
        const payload = (await response.json()) as {
          save?: { saveId: string; name?: string; saveVersion?: number };
          saves?: SaveSummary[];
        };
        noteKnownSaveVersion(payload.save?.saveVersion);
        return payload;
      })
        .then((payload) => {
          if (!payload) {
            return;
          }

          autoPersistContentSignatureRef.current = persistSignature;

          if (payload.save?.name) {
            setActiveSaveName(payload.save.name);
          }
          if (payload.saves) {
            setSaveSummaries(payload.saves);
          }
          if (payload.save?.saveVersion != null) {
            setGameState((current) =>
              current.saveVersion === payload.save?.saveVersion
                ? current
                : {
                    ...current,
                    saveVersion: payload.save?.saveVersion,
                  },
            );
          }
        })
        .catch((error) => {
          console.warn("Auto-Save konnte gerade nicht gespeichert werden.", error);
          setPersistenceError("Auto-Save fehlgeschlagen.");
        })
        .finally(() => {
          autoPersistInFlightRef.current = false;
        });
    }, 2500);

    return () => {
      if (autoPersistTimerRef.current != null) {
        window.clearTimeout(autoPersistTimerRef.current);
        autoPersistTimerRef.current = null;
      }
    };
  }, [activeSaveId, foundationSaveMode, gameState, readMeta.readOnly, setActiveSaveName, setGameState, setSaveSummaries, setPersistenceError]);

  return {
    loadSave,
    persistLocalGameStateImmediately,
    handleStaleRoomSaveWrite,
    runSaveAction,
    changeFoundationSaveMode,
    clearSaveScopedFeeds,
    skipNextFullPersistCountRef,
    hasPersistedInitialState,
    hasLoadedPersistentState,
    foundationViewTransitionUntilRef,
    autoPersistPausedRef,
    autoPersistUnpauseTimeoutRef,
    autoPersistInFlightRef,
    liveSaveRefreshInFlightRef,
    liveSaveVersionSignatureRef,
  };
}
