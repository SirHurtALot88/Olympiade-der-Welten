import type { FoundationActionFeedback } from "@/lib/foundation/tabs/foundation-page-types";
import type { LiveSeasonReloadReason } from "@/lib/foundation/tabs/use-foundation-live-sync";
import type { Dispatch, SetStateAction } from "react";

import { invalidateMatchdayArenaSessionCache } from "@/lib/foundation/matchday-arena-session-cache";
import { clearPrefetchedMatchdayArenaBaseKeys } from "@/lib/foundation/foundation-panel-prefetch";
import type {
  FoundationApplySummary,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpScoringResponse,
} from "@/lib/foundation/tabs/cockpit-types";
import {
  ADVANCE_MATCHDAY_CONFIRM_TOKEN,
  CASH_APPLY_CONFIRM_TOKEN,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  RESULT_APPLY_CONFIRM_TOKEN,
  STANDINGS_APPLY_CONFIRM_TOKEN,
} from "@/lib/foundation/tabs/cockpit-confirm-tokens";

export type CockpitMatchdayApplyHandlersDeps = {
  readMetaSource: "sqlite" | "prisma";
  showReadOnlyNotice: () => void;
  setCockpitBusyKey: Dispatch<SetStateAction<string | null>>;
  withRoomBody: <T extends Record<string, unknown>>(body: T) => Record<string, unknown>;
  activeSaveId: string;
  seasonId: string;
  matchdayId: string;
  firstMatchdayId: string;
  matchdayMvpForceReplaceExisting: boolean;
  matchdayAutoRunIncludeWarningLineups: boolean;
  matchdayAutoRunOverwriteExistingLineups: boolean;
  matchdayAutoRunStopOnTie: boolean;
  setResultApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setStandingsApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setCashApplyFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setMatchdayAdvanceFeed: Dispatch<SetStateAction<FoundationApplySummary | null>>;
  setMatchdayAutoRunFeed: Dispatch<SetStateAction<FoundationMatchdayAutoRunSummary | null>>;
  setMatchdayMvpScoringFeed: Dispatch<SetStateAction<FoundationMatchdayMvpScoringResponse | null>>;
  reloadResolvePreview: (signal?: AbortSignal) => Promise<unknown>;
  reloadStandingsPreviewFeed: (signal?: AbortSignal) => Promise<unknown>;
  reloadPrizePreviewFeed: () => Promise<unknown>;
  reloadLiveSeasonState: (reason?: LiveSeasonReloadReason) => Promise<unknown>;
  loadSave: (saveId: string) => Promise<unknown>;
  reloadSeasonStandingsOverview: () => Promise<unknown>;
  reloadSeasonManagementOverview: () => Promise<unknown>;
  reloadHistoryFeed: () => Promise<unknown>;
  reloadTransferRecapFeed: () => Promise<unknown>;
  bumpMarketReloadToken: () => void;
  setFoundationActionFeedback: Dispatch<SetStateAction<FoundationActionFeedback | null>>;
};

export type CockpitMatchdayMvpScoringFeed = FoundationMatchdayMvpScoringResponse & { error?: string };

export type CockpitMatchdayApplyHandlers = {
  runCockpitMatchdayMvpScoring: (execute: boolean) => Promise<CockpitMatchdayMvpScoringFeed | null>;
  runCockpitResultApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitStandingsApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitCashApply: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitMatchdayAdvance: (execute: boolean) => Promise<FoundationApplySummary | null>;
  runCockpitMatchdayAutoRun: (execute: boolean) => Promise<FoundationMatchdayAutoRunSummary | null>;
};

/**
 * Matchday apply pipeline handlers (Strangler Phase 5.3+).
 * Result / standings / cash apply, matchday advance, auto-run, MVP scoring.
 */
export function createCockpitMatchdayApplyHandlers(
  deps: CockpitMatchdayApplyHandlersDeps,
): CockpitMatchdayApplyHandlers {
  const {
    readMetaSource,
    showReadOnlyNotice,
    setCockpitBusyKey,
    withRoomBody,
    activeSaveId,
    seasonId,
    matchdayId,
    firstMatchdayId,
    matchdayMvpForceReplaceExisting,
    matchdayAutoRunIncludeWarningLineups,
    matchdayAutoRunOverwriteExistingLineups,
    matchdayAutoRunStopOnTie,
    setResultApplyFeed,
    setStandingsApplyFeed,
    setCashApplyFeed,
    setMatchdayAdvanceFeed,
    setMatchdayAutoRunFeed,
    setMatchdayMvpScoringFeed,
    reloadResolvePreview,
    reloadStandingsPreviewFeed,
    reloadPrizePreviewFeed,
    reloadLiveSeasonState,
    loadSave,
    reloadSeasonStandingsOverview,
    reloadSeasonManagementOverview,
    reloadHistoryFeed,
    reloadTransferRecapFeed,
    bumpMarketReloadToken,
    setFoundationActionFeedback,
  } = deps;

  async function runCockpitMatchdayMvpScoring(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "matchday-mvp-apply" : "matchday-mvp-dry-run");
    try {
      const response = await fetch("/api/season/matchday-mvp-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveId: activeSaveId,
          seasonId,
          matchdayId: firstMatchdayId,
          source: readMetaSource,
          dryRun: !execute,
          execute,
          confirmToken: execute ? MATCHDAY_MVP_SCORING_CONFIRM_TOKEN : undefined,
          forceReplace: matchdayMvpForceReplaceExisting,
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        summary?: FoundationMatchdayMvpScoringResponse;
        error?: string;
      };
      const nextFeed = payload.summary ? { ...payload.summary, error: payload.error } : null;
      setMatchdayMvpScoringFeed(nextFeed);

      if (execute && response.ok && nextFeed?.executed) {
        setResultApplyFeed({
          ok: true,
          source: "sqlite",
          dryRun: false,
          applied: nextFeed.resultApply.applied,
          summary: {
            matchdayResultId: nextFeed.resultApply.matchdayResultId ?? undefined,
            previewStatus: nextFeed.resolveStatus,
            blockingReasons: nextFeed.blockingReasons,
            warnings: nextFeed.warnings,
          },
        });
        setStandingsApplyFeed({
          ok: true,
          source: "sqlite",
          dryRun: false,
          applied: nextFeed.standingsApply.applied,
          auditLogId: nextFeed.standingsApply.auditLogId,
          summary: {
            auditLogId: nextFeed.standingsApply.auditLogId,
            blockingReasons: nextFeed.blockingReasons,
            warnings: nextFeed.warnings,
          },
        });
        await Promise.all([
          loadSave(activeSaveId),
          reloadResolvePreview(),
          reloadStandingsPreviewFeed(),
          reloadPrizePreviewFeed(),
          reloadSeasonStandingsOverview(),
          reloadSeasonManagementOverview(),
          reloadHistoryFeed(),
          reloadTransferRecapFeed(),
        ]);
        bumpMarketReloadToken();
      }

      return nextFeed;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitResultApply(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "result-apply" : "result-dry-run");
    try {
      const response = await fetch("/api/resolve/legacy-matchday-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirm: execute ? RESULT_APPLY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await response.json()) as FoundationApplySummary;
      setResultApplyFeed(payload);
      if (execute && response.ok && payload.applied) {
        await Promise.all([reloadResolvePreview(), reloadStandingsPreviewFeed()]);
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitStandingsApply(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "standings-apply" : "standings-dry-run");
    try {
      const response = await fetch("/api/standings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirm: execute ? STANDINGS_APPLY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await response.json()) as FoundationApplySummary;
      setStandingsApplyFeed(payload);
      if (execute && response.ok && payload.applied) {
        await reloadLiveSeasonState("manual_apply");
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitCashApply(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "cash-apply" : "cash-dry-run");
    try {
      const response = await fetch("/api/season/cash-prize-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            phase: "season_end",
            dryRun: !execute,
            execute,
            confirm: execute ? CASH_APPLY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await response.json()) as FoundationApplySummary;
      setCashApplyFeed(payload);
      if (execute && response.ok && payload.applied) {
        await Promise.all([loadSave(activeSaveId), reloadPrizePreviewFeed(), reloadStandingsPreviewFeed()]);
        bumpMarketReloadToken();
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitMatchdayAdvance(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "matchday-advance" : "matchday-advance-dry-run");
    try {
      const response = await fetch("/api/season/advance-matchday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirm: execute ? ADVANCE_MATCHDAY_CONFIRM_TOKEN : undefined,
          }),
        ),
      });
      const payload = (await response.json()) as FoundationApplySummary;
      setMatchdayAdvanceFeed(payload);
      if (execute && response.ok && payload.applied) {
        invalidateMatchdayArenaSessionCache({
          saveId: activeSaveId,
          seasonId,
        });
        clearPrefetchedMatchdayArenaBaseKeys({
          saveId: activeSaveId,
          seasonId,
        });
        setFoundationActionFeedback({
          tone: "success",
          title: "Spieltag weitergeschaltet",
          detail: "Matchday wurde geschrieben. Tabelle, Preisgeld-Preview und naechster Spieltag sind aktualisiert.",
        });
        await Promise.all([loadSave(activeSaveId), reloadResolvePreview(), reloadStandingsPreviewFeed(), reloadPrizePreviewFeed()]);
        bumpMarketReloadToken();
      }
      return payload;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  async function runCockpitMatchdayAutoRun(execute: boolean) {
    if (readMetaSource === "prisma") {
      showReadOnlyNotice();
      return null;
    }

    setCockpitBusyKey(execute ? "matchday-auto-run-execute" : "matchday-auto-run-dry-run");
    try {
      const response = await fetch("/api/season/matchday-auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withRoomBody({
            saveId: activeSaveId,
            seasonId,
            matchdayId,
            source: readMetaSource,
            dryRun: !execute,
            execute,
            confirmToken: execute ? MATCHDAY_AUTO_RUN_CONFIRM_TOKEN : undefined,
            options: {
              includeWarningLineups: matchdayAutoRunIncludeWarningLineups,
              overwriteExistingLineups: matchdayAutoRunOverwriteExistingLineups,
              stopOnTie: matchdayAutoRunStopOnTie,
              advanceAfterCashApply: true,
            },
          }),
        ),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        summary?: FoundationMatchdayAutoRunSummary;
      };
      if (payload.summary) {
        setMatchdayAutoRunFeed(payload.summary);
      }
      if (execute) {
        invalidateMatchdayArenaSessionCache({
          saveId: activeSaveId,
          seasonId,
        });
        clearPrefetchedMatchdayArenaBaseKeys({
          saveId: activeSaveId,
          seasonId,
        });
        await Promise.all([loadSave(activeSaveId), reloadResolvePreview(), reloadStandingsPreviewFeed(), reloadPrizePreviewFeed()]);
        bumpMarketReloadToken();
      }
      return payload.summary ?? null;
    } finally {
      setCockpitBusyKey(null);
    }
  }

  return {
    runCockpitMatchdayMvpScoring,
    runCockpitResultApply,
    runCockpitStandingsApply,
    runCockpitCashApply,
    runCockpitMatchdayAdvance,
    runCockpitMatchdayAutoRun,
  };
}
