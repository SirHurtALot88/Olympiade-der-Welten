import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { withRoomContextBody, type FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import type { FoundationAiMarketPlanApplyResponse } from "@/lib/foundation/tabs/foundation-page-types";
import type {
  FoundationAiLineupBatchApplyResponse,
  FoundationApplySummary,
  FoundationAutoRosterFillResponse,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpScoringResponse,
  FoundationSeasonSnapshotSummary,
  FoundationView,
  FoundationWholeSeasonDryRunSummary,
  PreSeasonWorkflowApiResponse,
  PreSeasonWorkflowSummaryResponse,
  SeasonCompletionApiResponse,
  SeasonCompletionSummaryResponse,
  SeasonTransitionApiResponse,
  SeasonTransitionSummaryResponse,
} from "@/lib/foundation/tabs/cockpit-types";
import { PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN, SEASON_COMPLETION_CONFIRM_TOKEN, SEASON_SNAPSHOT_CONFIRM_TOKEN } from "@/lib/foundation/tabs/cockpit-confirm-tokens";
import type { Dispatch, SetStateAction } from "react";

export {
  createCockpitMatchdayApplyHandlers,
  type CockpitMatchdayApplyHandlers,
  type CockpitMatchdayApplyHandlersDeps,
  type CockpitMatchdayMvpScoringFeed,
} from "@/lib/foundation/tabs/cockpit-matchday-handlers";

export type CockpitAiBatchHandlersDeps = {
  readMetaSource: "sqlite" | "prisma";
  showReadOnlyNotice: () => void;
  setCockpitBusyKey: Dispatch<SetStateAction<string | null>>;
  buildCockpitScopeParams: () => URLSearchParams;
  roomContext: FoundationRoomContext | null;
  marketAiApplyIncludeWarnings: boolean;
  cockpitAiIncludeWarningTeams: boolean;
  cockpitAiOverwriteExisting: boolean;
  setMarketAiApplyBusy: Dispatch<SetStateAction<boolean>>;
  setMarketAiApplyFeed: Dispatch<SetStateAction<FoundationAiMarketPlanApplyResponse | null>>;
  setRosterFillBusy: Dispatch<SetStateAction<boolean>>;
  setRosterFillFeed: Dispatch<SetStateAction<FoundationAutoRosterFillResponse | null>>;
  setCockpitAiBatchApplyFeed: Dispatch<SetStateAction<FoundationAiLineupBatchApplyResponse | null>>;
  reloadAfterMarketRosterApply: () => Promise<void>;
  reloadResolvePreview: (signal?: AbortSignal) => Promise<unknown>;
};

export type CockpitAiBatchHandlers = {
  runCockpitAiRosterFill: (execute: boolean) => Promise<FoundationAiMarketPlanApplyResponse | null>;
  runCockpitRosterFill: (execute: boolean) => Promise<FoundationAutoRosterFillResponse | null>;
  runCockpitAiLineupBatchApply: (execute: boolean) => Promise<FoundationAiLineupBatchApplyResponse | null>;
};

/**
 * Cockpit AI batch / roster-fill apply handlers (Strangler Phase 5.3+).
 * Factory keeps setCockpitBusyKey wiring out of FoundationPageClient.
 */
export function createCockpitAiBatchHandlers(deps: CockpitAiBatchHandlersDeps): CockpitAiBatchHandlers {
  const {
    readMetaSource,
    showReadOnlyNotice,
    setCockpitBusyKey,
    buildCockpitScopeParams,
    roomContext,
    marketAiApplyIncludeWarnings,
    cockpitAiIncludeWarningTeams,
    cockpitAiOverwriteExisting,
    setMarketAiApplyBusy,
    setMarketAiApplyFeed,
    setRosterFillBusy,
    setRosterFillFeed,
    setCockpitAiBatchApplyFeed,
    reloadAfterMarketRosterApply,
    reloadResolvePreview,
  } = deps;

  async function runCockpitAiRosterFill(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "ai-market-apply" : "ai-market-dry-run");
    setMarketAiApplyBusy(true);
    try {
      const marketApplyParams = buildCockpitScopeParams();
      marketApplyParams.set("teamScope", "ai");
      const response = await fetch(`/api/ai/market-plan-apply?${marketApplyParams.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomContextBody(
            {
              dryRun: !execute,
              includeWarningTeams: marketAiApplyIncludeWarnings,
              confirmToken: execute ? AI_MARKET_APPLY_CONFIRM_TOKEN : undefined,
              transferPhase: execute ? LOCAL_TRANSFER_WINDOW_PHASE : undefined,
              options: {
                includeWarningTeams: marketAiApplyIncludeWarnings,
                stopOnTeamFailure: true,
              },
            },
            roomContext,
          ),
        ),
      });
      const payload = (await response.json()) as FoundationAiMarketPlanApplyResponse;
      setMarketAiApplyFeed(payload);
      if (execute && response.ok && payload.executed) {
        await reloadAfterMarketRosterApply();
      }
      return payload;
    } finally {
      setMarketAiApplyBusy(false);
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitRosterFill(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "roster-fill-apply" : "roster-fill-dry-run");
    setRosterFillBusy(true);
    try {
      const response = await fetch(`/api/ai/roster-fill?${buildCockpitScopeParams().toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomContextBody(
            {
              dryRun: !execute,
              confirmToken: execute ? AUTO_ROSTER_FILL_CONFIRM_TOKEN : undefined,
            },
            roomContext,
          ),
        ),
      });
      const payload = (await response.json()) as FoundationAutoRosterFillResponse;
      setRosterFillFeed(payload);
      if (execute && response.ok && payload.executed) {
        await reloadAfterMarketRosterApply();
      }
      return payload;
    } finally {
      setRosterFillBusy(false);
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitAiLineupBatchApply(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "ai-lineup-apply" : "ai-lineup-dry-run");
    try {
      const response = await fetch(`/api/lineups/legacy/ai-batch-apply?${buildCockpitScopeParams().toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: !execute,
          confirm: execute,
          includeWarningTeams: cockpitAiIncludeWarningTeams,
          overwriteExisting: cockpitAiOverwriteExisting,
        }),
      });
      const payload = (await response.json()) as FoundationAiLineupBatchApplyResponse;
      setCockpitAiBatchApplyFeed(payload);
      if (execute && response.ok) {
        await reloadResolvePreview();
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  return {
    runCockpitAiRosterFill,
    runCockpitRosterFill,
    runCockpitAiLineupBatchApply,
  };
}


export type CockpitPreseasonHandlersDeps = {
  readMetaSource: "sqlite" | "prisma";
  showReadOnlyNotice: () => void;
  setCockpitBusyKey: Dispatch<SetStateAction<string | null>>;
  withRoomBody: <T extends Record<string, unknown>>(body: T) => Record<string, unknown>;
  activeSaveId: string;
  preSeasonWorkflowFeed: PreSeasonWorkflowSummaryResponse | null;
  setPreSeasonWorkflowBusy: Dispatch<SetStateAction<boolean>>;
  setPreSeasonWorkflowError: Dispatch<SetStateAction<string | null>>;
  setPreSeasonWorkflowFeed: Dispatch<SetStateAction<PreSeasonWorkflowSummaryResponse | null>>;
  loadSave: (saveId: string) => Promise<unknown>;
  reloadSeasonStandingsOverview: () => Promise<unknown>;
  reloadSeasonManagementOverview: () => Promise<unknown>;
  reloadHistoryFeed: () => Promise<unknown>;
  reloadTransferRecapFeed: () => Promise<unknown>;
  bumpMarketReloadToken: () => void;
  setActiveView: Dispatch<SetStateAction<FoundationView>>;
  syncFoundationViewInUrl: (view: FoundationView, tab?: string | null, playerId?: string | null) => void;
};

export type CockpitPreseasonHandlers = {
  runPreSeasonWorkflowPreview: () => Promise<PreSeasonWorkflowApiResponse | null>;
  runPreSeasonNextSeasonSetup: () => Promise<PreSeasonWorkflowApiResponse | null>;
};

/**
 * Preseason workflow handlers (Strangler Phase 5.3+).
 */
export function createCockpitPreseasonHandlers(deps: CockpitPreseasonHandlersDeps): CockpitPreseasonHandlers {
  const {
    readMetaSource,
    showReadOnlyNotice,
    setCockpitBusyKey,
    withRoomBody,
    activeSaveId,
    preSeasonWorkflowFeed,
    setPreSeasonWorkflowBusy,
    setPreSeasonWorkflowError,
    setPreSeasonWorkflowFeed,
    loadSave,
    reloadSeasonStandingsOverview,
    reloadSeasonManagementOverview,
    reloadHistoryFeed,
    reloadTransferRecapFeed,
    bumpMarketReloadToken,
    setActiveView,
    syncFoundationViewInUrl,
  } = deps;

  async function runPreSeasonWorkflowPreview() {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setPreSeasonWorkflowBusy(true);
    setPreSeasonWorkflowError(null);
    setCockpitBusyKey("preseason-preview");
    try {
      const response = await fetch("/api/season/preseason-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            source: readMetaSource,
            dryRun: true,
          }),
        ),
      });
      const payload = (await response.json()) as PreSeasonWorkflowApiResponse;
      setPreSeasonWorkflowFeed(payload.summary ?? null);
      if (!response.ok || payload.error) {
        setPreSeasonWorkflowError(payload.error ?? payload.blockingReasons?.join(" · ") ?? "Pre-Season Preview blockiert.");
      }
      return payload;
    } catch {
      setPreSeasonWorkflowError("Pre-Season Preview konnte nicht geladen werden.");
      return null;
    } finally {
      setPreSeasonWorkflowBusy(false);
      setCockpitBusyKey(null);
    }
  }

  async function runPreSeasonNextSeasonSetup() {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setPreSeasonWorkflowBusy(true);
    setPreSeasonWorkflowError(null);
    setCockpitBusyKey("preseason-next-season-setup");
    try {
      const response = await fetch("/api/season/preseason-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            source: readMetaSource,
            dryRun: false,
            stepId: "next_season_setup",
            confirmToken:
              preSeasonWorkflowFeed?.steps?.find((step) => step.stepId === "next_season_setup")?.confirmToken ??
              PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN,
          }),
        ),
      });
      const payload = (await response.json()) as PreSeasonWorkflowApiResponse;
      setPreSeasonWorkflowFeed(payload.summary ?? null);
      if (!response.ok || payload.error || !payload.success) {
        setPreSeasonWorkflowError(payload.error ?? payload.blockingReasons?.join(" · ") ?? "Neue Saison konnte nicht gestartet werden.");
      }
      if (response.ok && payload.success) {
        await Promise.all([
          loadSave(activeSaveId),
          reloadSeasonStandingsOverview(),
          reloadSeasonManagementOverview(),
          reloadHistoryFeed(),
          reloadTransferRecapFeed(),
        ]);
        bumpMarketReloadToken();
        setActiveView("home");
        syncFoundationViewInUrl("home");
      }
      return payload;
    } catch {
      setPreSeasonWorkflowError("Neue Saison konnte nicht gestartet werden.");
      return null;
    } finally {
      setPreSeasonWorkflowBusy(false);
      setCockpitBusyKey(null);
    }
  }

  return {
    runPreSeasonWorkflowPreview,
    runPreSeasonNextSeasonSetup,
  };
}

export type CockpitSeasonTransitionHandlersDeps = {
  readMetaSource: "sqlite" | "prisma";
  showReadOnlyNotice: () => void;
  setCockpitBusyKey: Dispatch<SetStateAction<string | null>>;
  withRoomBody: <T extends Record<string, unknown>>(body: T) => Record<string, unknown>;
  activeSaveId: string;
  seasonId: string;
  wholeSeasonMaxMatchdays: number;
  wholeSeasonIncludeWarningLineups: boolean;
  wholeSeasonOverwriteExistingLineups: boolean;
  wholeSeasonStopOnTie: boolean;
  setSeasonTransitionBusy: Dispatch<SetStateAction<boolean>>;
  setSeasonTransitionError: Dispatch<SetStateAction<string | null>>;
  setSeasonTransitionFeed: Dispatch<SetStateAction<SeasonTransitionSummaryResponse | null>>;
  setSeasonCompletionFeed: Dispatch<SetStateAction<SeasonCompletionSummaryResponse | null>>;
  setCashApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setSeasonSnapshotFeed: Dispatch<SetStateAction<FoundationSeasonSnapshotSummary | null>>;
  setWholeSeasonDryRunFeed: Dispatch<SetStateAction<FoundationWholeSeasonDryRunSummary | null>>;
  setFoundationActionFeedback: Dispatch<
    SetStateAction<{
      tone: "success" | "warning" | "info" | "blocked" | "error";
      title: string;
      detail: string;
    } | null>
  >;
  loadSave: (saveId: string) => Promise<unknown>;
  reloadResolvePreview: (signal?: AbortSignal) => Promise<unknown>;
  reloadStandingsPreviewFeed: (signal?: AbortSignal) => Promise<unknown>;
  reloadPrizePreviewFeed: () => Promise<unknown>;
  reloadSeasonStandingsOverview: () => Promise<unknown>;
  reloadSeasonManagementOverview: () => Promise<unknown>;
  reloadHistoryFeed: () => Promise<unknown>;
  reloadTransferRecapFeed: () => Promise<unknown>;
  setActiveView: Dispatch<SetStateAction<FoundationView>>;
  syncFoundationViewInUrl: (view: FoundationView, tab?: string | null, playerId?: string | null) => void;
};

export type CockpitSeasonTransitionHandlers = {
  runSeasonTransition: (action: "preview" | "start_transition") => Promise<SeasonTransitionApiResponse | null>;
  runSeasonCompletion: (execute: boolean) => Promise<SeasonCompletionApiResponse | null>;
  runCockpitWholeSeasonDryRun: () => Promise<FoundationWholeSeasonDryRunSummary | null>;
  runSeasonSnapshotAction: (
    execute: boolean,
    options?: { forceCreate?: boolean; replaceExisting?: boolean },
  ) => Promise<FoundationSeasonSnapshotSummary | null>;
  refreshSeasonCockpit: () => Promise<void>;
};

/**
 * Season transition / completion / snapshot handlers (Strangler Phase 5.3+).
 */
export function createCockpitSeasonTransitionHandlers(
  deps: CockpitSeasonTransitionHandlersDeps,
): CockpitSeasonTransitionHandlers {
  const {
    readMetaSource,
    showReadOnlyNotice,
    setCockpitBusyKey,
    withRoomBody,
    activeSaveId,
    seasonId,
    wholeSeasonMaxMatchdays,
    wholeSeasonIncludeWarningLineups,
    wholeSeasonOverwriteExistingLineups,
    wholeSeasonStopOnTie,
    setSeasonTransitionBusy,
    setSeasonTransitionError,
    setSeasonTransitionFeed,
    setSeasonCompletionFeed,
    setCashApplyFeed,
    setSeasonSnapshotFeed,
    setWholeSeasonDryRunFeed,
    setFoundationActionFeedback,
    loadSave,
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    reloadPrizePreviewFeed,
    reloadSeasonStandingsOverview,
    reloadSeasonManagementOverview,
    reloadHistoryFeed,
    reloadTransferRecapFeed,
    setActiveView,
    syncFoundationViewInUrl,
  } = deps;

  async function runSeasonTransition(action: "preview" | "start_transition") {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setSeasonTransitionBusy(true);
    setSeasonTransitionError(null);
    setCockpitBusyKey(action === "start_transition" ? "season-transition-start" : "season-transition-preview");
    try {
      const response = await fetch("/api/season/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            source: readMetaSource,
            dryRun: action !== "start_transition",
            action,
          }),
        ),
      });
      const payload = (await response.json()) as SeasonTransitionApiResponse;
      setSeasonTransitionFeed(payload.summary ?? null);
      if (!response.ok || payload.error) {
        setSeasonTransitionError(payload.error ?? payload.blockingReasons?.join(" · ") ?? "Season Transition blockiert.");
      }
      if (action === "start_transition" && response.ok && payload.success) {
        setFoundationActionFeedback({
          tone: "success",
          title: "Season-Wechsel gestartet",
          detail: `${payload.summary?.saveContext.fromSeasonId ?? seasonId} → ${
            payload.summary?.saveContext.toSeasonId ?? "nächste Season"
          }. Cockpit zeigt die nächsten Schritte.`,
        });
        await loadSave(activeSaveId);
        setActiveView("cockpit");
        syncFoundationViewInUrl("cockpit");
      }
      return payload;
    } catch {
      setSeasonTransitionError("Season Transition konnte nicht geladen werden.");
      return null;
    } finally {
      setSeasonTransitionBusy(false);
      setCockpitBusyKey(null);
    }
  }

  async function runSeasonCompletion(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setSeasonTransitionBusy(true);
    setSeasonTransitionError(null);
    setCockpitBusyKey(execute ? "season-completion-execute" : "season-completion-preview");
    try {
      const response = await fetch("/api/season/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirmToken: execute ? SEASON_COMPLETION_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await response.json()) as SeasonCompletionApiResponse;
      setSeasonCompletionFeed(payload.summary ?? null);
      if (payload.summary?.transition) {
        setSeasonTransitionFeed(payload.summary.transition);
      }
      if (payload.summary?.cashApply) {
        setCashApplyFeed(payload.summary.cashApply);
      }
      if (payload.summary?.snapshot) {
        setSeasonSnapshotFeed(payload.summary.snapshot);
      }
      if (!response.ok || payload.error) {
        setSeasonTransitionError(payload.error ?? payload.blockingReasons?.join(" · ") ?? "Saisonabschluss blockiert.");
      }
      if (execute && response.ok && payload.success) {
        const completion = payload.summary;
        const completedObjectives = completion?.seasonReview?.objectiveSettlement?.totals.completed ?? null;
        const failedObjectives = completion?.seasonReview?.objectiveSettlement?.totals.failed ?? null;
        setFoundationActionFeedback({
          tone: "success",
          title: "Saisonabschluss geschrieben",
          detail:
            completedObjectives != null && failedObjectives != null
              ? `Board-Ziele ${completedObjectives} erfüllt · ${failedObjectives} verfehlt. Cash, Snapshot, Storylines und Manager-Signale sind aktualisiert.`
              : "Cash, Snapshot, Storylines und Manager-Signale sind aktualisiert.",
        });
        await Promise.all([
          loadSave(activeSaveId),
          reloadPrizePreviewFeed(),
          reloadSeasonStandingsOverview(),
          reloadSeasonManagementOverview(),
          reloadHistoryFeed(),
          reloadTransferRecapFeed(),
        ]);
        setActiveView("cockpit");
        syncFoundationViewInUrl("cockpit");
      }
      return payload;
    } catch {
      setSeasonTransitionError("Saisonabschluss konnte nicht geladen werden.");
      return null;
    } finally {
      setSeasonTransitionBusy(false);
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitWholeSeasonDryRun() {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey("whole-season-dryrun");
    try {
      const response = await fetch("/api/season/whole-season-dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: activeSaveId,
          seasonId,
          maxMatchdays: Number.isFinite(wholeSeasonMaxMatchdays) ? wholeSeasonMaxMatchdays : undefined,
          source: readMetaSource,
          dryRun: true,
          options: {
            includeWarningLineups: wholeSeasonIncludeWarningLineups,
            overwriteExistingLineups: wholeSeasonOverwriteExistingLineups,
            stopOnTie: wholeSeasonStopOnTie,
            stopOnMissingManualLineups: true,
            advanceAfterEachMatchday: true,
            includeMarketPhase: false,
          },
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        summary?: FoundationWholeSeasonDryRunSummary;
      };
      if (payload.summary) {
        setWholeSeasonDryRunFeed(payload.summary);
      }
      return payload.summary ?? null;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runSeasonSnapshotAction(
    execute: boolean,
    options?: { forceCreate?: boolean; replaceExisting?: boolean },
  ) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "season-snapshot-apply" : "season-snapshot-dry-run");
    try {
      const response = await fetch("/api/season/season-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: activeSaveId,
          seasonId,
          source: readMetaSource,
          dryRun: !execute,
          execute,
          forceCreate: options?.forceCreate ?? false,
          replaceExisting: options?.replaceExisting ?? false,
          confirmToken: execute ? SEASON_SNAPSHOT_CONFIRM_TOKEN : undefined,
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        summary?: FoundationSeasonSnapshotSummary;
        error?: string;
        blockingReasons?: string[];
      };
      const nextSummary = payload.summary
        ? {
            ...payload.summary,
            error: payload.error ?? payload.summary.error,
            blockingReasons: payload.blockingReasons ?? payload.summary.blockingReasons,
          }
        : null;
      setSeasonSnapshotFeed(nextSummary);
      if (execute && response.ok && nextSummary?.applied) {
        await loadSave(activeSaveId);
      }
      return nextSummary;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function refreshSeasonCockpit() {
    setCockpitBusyKey("cockpit-refresh");
    try {
      await Promise.all([reloadResolvePreview(), reloadStandingsPreviewFeed(), reloadPrizePreviewFeed()]);
    } finally {
      setCockpitBusyKey(null);
    }
  }

  return {
    runSeasonTransition,
    runSeasonCompletion,
    runCockpitWholeSeasonDryRun,
    runSeasonSnapshotAction,
    refreshSeasonCockpit,
  };
}
